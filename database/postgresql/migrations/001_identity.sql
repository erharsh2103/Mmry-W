-- 001_identity.sql
-- Accounts and refresh-token rotation. Emails are stored lower-cased; the
-- application normalises before insert and the CHECK enforces it.

CREATE TYPE user_role AS ENUM ('caregiver', 'admin');

CREATE TABLE users (
  id             uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  email          text        NOT NULL CHECK (email = lower(email) AND char_length(email) BETWEEN 3 AND 254),
  password_hash  text        NOT NULL,
  full_name      text        NOT NULL CHECK (char_length(full_name) BETWEEN 1 AND 120),
  role           user_role   NOT NULL DEFAULT 'caregiver',
  is_active      boolean     NOT NULL DEFAULT true,
  last_login_at  timestamptz,
  created_at     timestamptz NOT NULL DEFAULT now(),
  updated_at     timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX users_email_key ON users (email);

-- Opaque refresh tokens: only a SHA-256 of the token is stored. Tokens in one
-- login chain share a family_id, so reuse of a rotated token revokes the chain.
CREATE TABLE refresh_tokens (
  id           uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id      uuid        NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  family_id    uuid        NOT NULL,
  token_hash   text        NOT NULL CHECK (token_hash ~ '^[0-9a-f]{64}$'),
  expires_at   timestamptz NOT NULL,
  revoked_at   timestamptz,
  replaced_by  uuid        REFERENCES refresh_tokens (id) ON DELETE SET NULL,
  user_agent   text        CHECK (char_length(user_agent) <= 400),
  ip_address   inet,
  created_at   timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX refresh_tokens_hash_key ON refresh_tokens (token_hash);
CREATE INDEX refresh_tokens_user_idx ON refresh_tokens (user_id);
CREATE INDEX refresh_tokens_family_idx ON refresh_tokens (family_id);
