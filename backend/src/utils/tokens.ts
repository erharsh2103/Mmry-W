/*
 * Access tokens: short-lived HS256 JWTs carried in the Authorization header,
 * held only in memory by the frontend.
 *
 * Refresh tokens: 256-bit random opaque values in an httpOnly cookie. Only
 * their SHA-256 is stored, and each use rotates them.
 */
import { createHash, randomBytes } from "node:crypto";
import jwt from "jsonwebtoken";
import { env } from "../config/env.js";
import type { UserRole } from "../models/user.js";

const ISSUER = "mmry-backend";
const AUDIENCE = "mmry-api";

export interface AccessClaims {
  sub: string;
  role: UserRole;
}

export function signAccessToken(claims: AccessClaims): string {
  return jwt.sign({ role: claims.role }, env.JWT_ACCESS_SECRET, {
    algorithm: "HS256",
    subject: claims.sub,
    issuer: ISSUER,
    audience: AUDIENCE,
    expiresIn: env.JWT_ACCESS_TTL_SECONDS,
  });
}

export function verifyAccessToken(token: string): AccessClaims {
  const payload = jwt.verify(token, env.JWT_ACCESS_SECRET, {
    algorithms: ["HS256"],
    issuer: ISSUER,
    audience: AUDIENCE,
  });
  if (typeof payload === "string" || typeof payload.sub !== "string") throw new Error("malformed token");
  const role = payload.role;
  if (role !== "caregiver" && role !== "admin") throw new Error("malformed token");
  return { sub: payload.sub, role };
}

export function newRefreshToken(): string {
  return randomBytes(32).toString("base64url");
}

export function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}
