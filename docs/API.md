# REST API - `/api/v1`

All responses are JSON. Errors share one shape:

```json
{ "error": { "code": "bad_request", "message": "Invalid request", "details": [{ "path": "email", "message": "..." }], "requestId": "..." } }
```

Authentication: `Authorization: Bearer <access token>` (15 min). The refresh
token is an httpOnly cookie (`mmry_rt`, path `/api/v1/auth`, SameSite=Strict);
routes that use it also require the header `x-mmry-csrf: 1`.

## Health

| Method | Path | Auth | Notes |
| --- | --- | --- | --- |
| GET | `/health` | - | liveness |
| GET | `/health/ready` | - | 200 when PostgreSQL and MongoDB answer; reports AI status |

## Auth

| Method | Path | Body | Notes |
| --- | --- | --- | --- |
| POST | `/auth/register` | `{ email, password (10-128), fullName }` | 201, sets cookies, returns `{ user, accessToken, expiresIn }` |
| POST | `/auth/login` | `{ email, password }` | rate limited; constant-time for unknown emails |
| POST | `/auth/refresh` | - (cookie + CSRF header) | rotates the refresh token; reuse revokes the family |
| POST | `/auth/logout` | - (cookie + CSRF header) | 204, revokes the token |
| GET | `/auth/me` | Bearer | current user |

## Patients

Every `/patients/:patientId/...` route checks the caller is linked to that
patient; otherwise it answers 404.

| Method | Path | Body / query |
| --- | --- | --- |
| GET | `/patients` | patients linked to the caller |
| POST | `/patients` | `{ displayName, language }`; seeds routine, people, safe zone |
| GET / PATCH / DELETE | `/patients/:id` | PATCH any of `displayName, age, language, caregiverName, caregiverPhone, vault{home,doctor,emergency,medicines}, voiceOn, voicePref, voiceRate, fontScale, onboardingDone`; DELETE owner only |
| PUT | `/patients/:id/pin` | `{ pin: "1234" | null }`, owner only |
| POST | `/patients/:id/pin/verify` | `{ pin }`; 403 `wrong_pin`; tightly rate limited |
| GET | `/patients/:id/tasks?day=YYYY-MM-DD` | tasks with completion for the patient's local day |
| PUT | `/patients/:id/tasks/:taskId` | `{ day, done }` |
| GET / POST | `/patients/:id/people` | POST `{ name, relation?, note?, emoji, isPlace }` |
| DELETE | `/patients/:id/people/:personId` | |
| PUT / DELETE | `/patients/:id/people/:personId/location` | pin a place at the last position / clear it |
| POST | `/patients/:id/sessions` | `{ sessions: [...] }` (1-50, idempotent on `clientRef`) |
| GET | `/patients/:id/sessions?limit=` | recent sessions, oldest first |
| POST | `/patients/:id/mind-checks` | `{ clientRef, takenAt, answers: [{ area, question, kind, score, ms }] }`; server computes area scores |
| GET | `/patients/:id/mind-checks?limit=` | newest first |
| GET | `/patients/:id/insights?day=` | score, trend, metrics, insight/alert ids, level per game (model or rule) |
| GET | `/patients/:id/analytics?days=7..365` | daily metrics from the analytics pipeline + mind checks |
| GET | `/patients/:id/safety` | zone, last fix, distance/bearing, events |
| PATCH | `/patients/:id/safety/zone` | `{ radiusM: 200|500|1000|2000, armed, trackingEnabled }` |
| PUT | `/patients/:id/safety/home` | `{ kind: "lastFix" }` or `{ kind: "place", personId }` |
| POST | `/patients/:id/safety/fixes` | `{ lat, lon, accuracyM }` → `{ transition: "out"|"in"|null, state }` |
| POST | `/patients/:id/safety/sos` | records an SOS at the last position |
| GET | `/patients/:id/safety/contacts` | encrypted alert contacts returned to the authorised caregiver |
| POST | `/patients/:id/safety/contacts` | `{ label, phone }`; adds an enabled safe-zone alert recipient |
| DELETE | `/patients/:id/safety/contacts/:contactId` | removes an alert recipient |
| POST | `/patients/:id/assistant/intent` | `{ text, lang, source, speechConfidence }` → `{ intent, confidence, source: model|rule }` |

Safe-zone exits and returns create one notification-outbox row per enabled alert
contact. While the patient remains outside, a location update is queued at most
once every five minutes. Phone numbers and coordinates are encrypted at rest.
The outbox remains `pending` until an SMS/push provider and delivery worker are
configured; the application does not claim that a message was sent without one.

## AI service (internal, not exposed)

| Method | Path | Notes |
| --- | --- | --- |
| GET | `/health` | loaded model versions |
| POST | `/v1/intent` | `{ text, lang }` → `{ intent, confidence, model }` |
| POST | `/v1/difficulty` | `{ games: [{ game_type, sessions[], baseline_area_score }] }` → recommended level per game |

Both POST routes require `Authorization: Bearer $AI_SERVICE_TOKEN`.
