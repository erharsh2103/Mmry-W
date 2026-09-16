import { pool, type Queryable } from "../config/postgres.js";
import type { RefreshTokenRecord, UserRecord, UserRole } from "../models/user.js";

interface UserRow {
  id: string;
  email: string;
  password_hash: string;
  full_name: string;
  role: UserRole;
  is_active: boolean;
  last_login_at: Date | null;
  created_at: Date;
}

const toUser = (r: UserRow): UserRecord => ({
  id: r.id,
  email: r.email,
  passwordHash: r.password_hash,
  fullName: r.full_name,
  role: r.role,
  isActive: r.is_active,
  lastLoginAt: r.last_login_at,
  createdAt: r.created_at,
});

const USER_COLUMNS = "id, email, password_hash, full_name, role, is_active, last_login_at, created_at";

export const usersRepository = {
  async findByEmail(email: string): Promise<UserRecord | null> {
    const { rows } = await pool.query<UserRow>(`SELECT ${USER_COLUMNS} FROM users WHERE email = $1`, [email]);
    return rows[0] ? toUser(rows[0]) : null;
  },

  async findById(id: string): Promise<UserRecord | null> {
    const { rows } = await pool.query<UserRow>(`SELECT ${USER_COLUMNS} FROM users WHERE id = $1`, [id]);
    return rows[0] ? toUser(rows[0]) : null;
  },

  async create(input: { email: string; passwordHash: string; fullName: string }): Promise<UserRecord> {
    const { rows } = await pool.query<UserRow>(
      `INSERT INTO users (email, password_hash, full_name) VALUES ($1, $2, $3) RETURNING ${USER_COLUMNS}`,
      [input.email, input.passwordHash, input.fullName],
    );
    return toUser(rows[0]!);
  },

  async touchLogin(id: string): Promise<void> {
    await pool.query("UPDATE users SET last_login_at = now() WHERE id = $1", [id]);
  },
};

interface TokenRow {
  id: string;
  user_id: string;
  family_id: string;
  expires_at: Date;
  revoked_at: Date | null;
  replaced_by: string | null;
}

const toToken = (r: TokenRow): RefreshTokenRecord => ({
  id: r.id,
  userId: r.user_id,
  familyId: r.family_id,
  expiresAt: r.expires_at,
  revokedAt: r.revoked_at,
  replacedBy: r.replaced_by,
});

export const refreshTokensRepository = {
  async insert(
    db: Queryable,
    input: { userId: string; familyId: string; tokenHash: string; expiresAt: Date; userAgent: string | null; ip: string | null },
  ): Promise<string> {
    const { rows } = await db.query<{ id: string }>(
      `INSERT INTO refresh_tokens (user_id, family_id, token_hash, expires_at, user_agent, ip_address)
       VALUES ($1, $2, $3, $4, $5, $6) RETURNING id`,
      [input.userId, input.familyId, input.tokenHash, input.expiresAt, input.userAgent, input.ip],
    );
    return rows[0]!.id;
  },

  /* Locks the row so two concurrent refreshes cannot both rotate it. */
  async findByHashForUpdate(db: Queryable, tokenHash: string): Promise<RefreshTokenRecord | null> {
    const { rows } = await db.query<TokenRow>(
      `SELECT id, user_id, family_id, expires_at, revoked_at, replaced_by
         FROM refresh_tokens WHERE token_hash = $1 FOR UPDATE`,
      [tokenHash],
    );
    return rows[0] ? toToken(rows[0]) : null;
  },

  async revoke(db: Queryable, id: string): Promise<void> {
    await db.query("UPDATE refresh_tokens SET revoked_at = now() WHERE id = $1 AND revoked_at IS NULL", [id]);
  },

  async markRotated(db: Queryable, id: string, replacedBy: string): Promise<void> {
    await db.query("UPDATE refresh_tokens SET replaced_by = $2, revoked_at = COALESCE(revoked_at, now()) WHERE id = $1", [id, replacedBy]);
  },

  async revokeFamily(db: Queryable, familyId: string): Promise<void> {
    await db.query("UPDATE refresh_tokens SET revoked_at = now() WHERE family_id = $1 AND revoked_at IS NULL", [familyId]);
  },

  async revokeByHash(tokenHash: string): Promise<void> {
    await pool.query("UPDATE refresh_tokens SET revoked_at = now() WHERE token_hash = $1 AND revoked_at IS NULL", [tokenHash]);
  },

  async deleteExpired(): Promise<number> {
    const { rowCount } = await pool.query("DELETE FROM refresh_tokens WHERE expires_at < now() - interval '1 day'");
    return rowCount ?? 0;
  },
};
