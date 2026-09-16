/*
 * Registration, login and refresh-token rotation.
 *
 * Rotation with reuse detection: every refresh swaps the presented token for a
 * new one in the same family. If an already-rotated token is presented again,
 * someone holds a stolen copy, so the whole family is revoked and both parties
 * must sign in again.
 */
import { randomUUID } from "node:crypto";
import { env } from "../config/env.js";
import { withTransaction } from "../config/postgres.js";
import { toPublicUser, type PublicUser } from "../models/user.js";
import { refreshTokensRepository, usersRepository } from "../repositories/users.repository.js";
import { conflict, unauthorized } from "../utils/httpError.js";
import { dummyPasswordHash, hashSecret, verifySecret } from "../utils/password.js";
import { hashToken, newRefreshToken, signAccessToken } from "../utils/tokens.js";

export interface ClientContext {
  userAgent: string | null;
  ip: string | null;
}

export interface Session {
  user: PublicUser;
  accessToken: string;
  accessTokenExpiresIn: number;
  refreshToken: string;
  refreshTokenExpiresAt: Date;
}

const ROTATION_GRACE_MS = 10_000;

const refreshExpiry = () => new Date(Date.now() + env.REFRESH_TOKEN_TTL_DAYS * 86_400_000);

async function issueSession(user: PublicUser, familyId: string, ctx: ClientContext, previousId?: string): Promise<Session> {
  const refreshToken = newRefreshToken();
  const expiresAt = refreshExpiry();
  await withTransaction(async (db) => {
    const id = await refreshTokensRepository.insert(db, {
      userId: user.id,
      familyId,
      tokenHash: hashToken(refreshToken),
      expiresAt,
      userAgent: ctx.userAgent?.slice(0, 400) ?? null,
      ip: ctx.ip,
    });
    if (previousId) await refreshTokensRepository.markRotated(db, previousId, id);
  });
  return {
    user,
    accessToken: signAccessToken({ sub: user.id, role: user.role }),
    accessTokenExpiresIn: env.JWT_ACCESS_TTL_SECONDS,
    refreshToken,
    refreshTokenExpiresAt: expiresAt,
  };
}

export const authService = {
  async register(input: { email: string; password: string; fullName: string }, ctx: ClientContext): Promise<Session> {
    const email = input.email.trim().toLowerCase();
    if (await usersRepository.findByEmail(email)) throw conflict("An account with this email already exists");
    const passwordHash = await hashSecret(input.password);
    let record;
    try {
      record = await usersRepository.create({ email, passwordHash, fullName: input.fullName.trim() });
    } catch (err) {
      // Lost a race with a concurrent registration for the same email.
      if ((err as { code?: string }).code === "23505") throw conflict("An account with this email already exists");
      throw err;
    }
    return issueSession(toPublicUser(record), randomUUID(), ctx);
  },

  async login(input: { email: string; password: string }, ctx: ClientContext): Promise<Session> {
    const email = input.email.trim().toLowerCase();
    const user = await usersRepository.findByEmail(email);
    // Always run one scrypt verification so response time does not reveal
    // whether the email is registered.
    const ok = await verifySecret(input.password, user?.passwordHash ?? (await dummyPasswordHash()));
    if (!user || !ok || !user.isActive) throw unauthorized("Email or password is incorrect");
    await usersRepository.touchLogin(user.id);
    return issueSession(toPublicUser(user), randomUUID(), ctx);
  },

  async refresh(presented: string, ctx: ClientContext): Promise<Session> {
    const tokenHash = hashToken(presented);
    const outcome = await withTransaction(async (db) => {
      const token = await refreshTokensRepository.findByHashForUpdate(db, tokenHash);
      if (!token) return { kind: "invalid" as const };
      if (token.revokedAt) {
        // Two tabs refreshing at the same moment present the same token; a
        // replay within a few seconds of rotation is treated as that race,
        // not as theft. Anything later revokes the whole family.
        const sinceRotation = Date.now() - token.revokedAt.getTime();
        if (sinceRotation < ROTATION_GRACE_MS) return { kind: "invalid" as const };
        await refreshTokensRepository.revokeFamily(db, token.familyId);
        return { kind: "reused" as const };
      }
      if (token.expiresAt.getTime() <= Date.now()) return { kind: "invalid" as const };
      // Revoke immediately; the replacement id is linked once it exists.
      await refreshTokensRepository.revoke(db, token.id);
      return { kind: "ok" as const, token };
    });

    if (outcome.kind !== "ok") throw unauthorized("Session expired, please sign in again");
    const user = await usersRepository.findById(outcome.token.userId);
    if (!user || !user.isActive) throw unauthorized("Session expired, please sign in again");
    return issueSession(toPublicUser(user), outcome.token.familyId, ctx, outcome.token.id);
  },

  async logout(presented: string | undefined): Promise<void> {
    if (presented) await refreshTokensRepository.revokeByHash(hashToken(presented));
  },

  async me(userId: string): Promise<PublicUser> {
    const user = await usersRepository.findById(userId);
    if (!user || !user.isActive) throw unauthorized();
    return toPublicUser(user);
  },
};
