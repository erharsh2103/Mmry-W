# Security

## Authentication

- Passwords: scrypt (N=2^15, r=8, p=1, 16-byte salt), parameters stored with each hash. 10-128 characters.
- Login answers in constant time whether or not the email exists (a dummy hash is verified).
- Access tokens: HS256 JWT, 15 min, issuer and audience checked, algorithm pinned. Held in memory in the browser, never in storage.
- Refresh tokens: 256-bit random, stored only as SHA-256, httpOnly + SameSite=Strict + Secure (behind HTTPS) cookie scoped to `/api/v1/auth`. Rotated on every use. Replaying an already-rotated token (outside a 10 s multi-tab grace) revokes the whole token family.
- Cross-tab: signing out in one tab signs out every tab.

## Authorisation

- Every patient route runs `requirePatientAccess`: the caller must be linked in `patient_caregivers`. Unlinked ids answer 404 so they cannot be probed.
- Owner-only actions: deleting a patient, setting or removing the caregiver PIN.
- The caregiver PIN (Care, Analytics, Profile, Settings on a shared device) is scrypt-hashed and verified by the API, rate limited to 8 failures per 15 minutes per user and patient.
- Roles `caregiver` and `admin` are carried in the token, and `requireRole` middleware exists for role-restricted routes. No route is admin-only yet; every account registers as `caregiver`.

## Input and output

- Every body, query and route parameter is validated with zod before it reaches a controller; handlers read only the parsed copy.
- Free text is stripped of control characters and length-capped; the database repeats the limits as CHECK constraints.
- All SQL is parameterised; dynamic column names come from fixed allow-lists.
- JSON bodies are capped at 100 kB. Malformed JSON → 400, oversized → 413.
- One error handler: internal errors are logged with a request id and returned as a generic 500. No stack traces or driver messages reach clients.
- Logs record method, route pattern, status, latency and user id only - never bodies, tokens or patient text.

## Data protection

- AES-256-GCM field encryption (random IV, authenticated, versioned) for caregiver phone numbers, the memory vault, every coordinate (home, last fix, pinned places, event positions) and talk-companion transcripts.
- The analytics role cannot read `users` or `refresh_tokens` and never holds the encryption key.
- MongoDB TTL indexes expire transcripts after 180 days and AI logs after 90.
- Location tracking is off until a caregiver switches it on.

## Transport and browser

- Frontend: CSP (`default-src 'self'`, no framing, `connect-src 'self'`), HSTS in production, `X-Content-Type-Options`, `Referrer-Policy`, and a Permissions-Policy allowing only microphone and geolocation on this origin.
- API: helmet with `default-src 'none'`, CORS locked to `CORS_ORIGIN` with credentials, `Cache-Control: no-store`, no `X-Powered-By`.
- Rate limits: 20 failed auth attempts / 15 min per client, 300 requests / min overall.

## Least privilege

| Account | Can |
| --- | --- |
| `POSTGRES_OWNER_USER` | migrations only (never used by a running service) |
| `POSTGRES_APP_USER` | SELECT/INSERT/UPDATE/DELETE on product tables; read-only on templates and metrics |
| `POSTGRES_ANALYTICS_USER` | SELECT (except users/tokens); write only metrics and run tables |
| `MONGO_APP_USER` | readWrite on the `mmry` database |
| `MONGO_ANALYTICS_USER` | read on the `mmry` database |
| `AI_SERVICE_TOKEN` | the only credential the AI service accepts |

## Secrets

No secret has a default. Services refuse to start when one is missing, too
short, or still `CHANGE_ME`. `.env` is git-ignored. Generate local values with
`node scripts/generate-env.mjs`; in production inject them from a secret manager.
