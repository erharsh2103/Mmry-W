export type UserRole = "caregiver" | "admin";

export interface UserRecord {
  id: string;
  email: string;
  passwordHash: string;
  fullName: string;
  role: UserRole;
  isActive: boolean;
  lastLoginAt: Date | null;
  createdAt: Date;
}

/* What the API returns about a user. Never includes the password hash. */
export interface PublicUser {
  id: string;
  email: string;
  fullName: string;
  role: UserRole;
  createdAt: string;
}

export function toPublicUser(u: UserRecord): PublicUser {
  return { id: u.id, email: u.email, fullName: u.fullName, role: u.role, createdAt: u.createdAt.toISOString() };
}

export interface RefreshTokenRecord {
  id: string;
  userId: string;
  familyId: string;
  expiresAt: Date;
  revokedAt: Date | null;
  replacedBy: string | null;
}
