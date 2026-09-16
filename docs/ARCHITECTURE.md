# Architecture

## Components and boundaries

| Component | Stack | May talk to | Never talks to |
| --- | --- | --- | --- |
| `frontend/` | Next.js 16, React 19, TypeScript | the backend, via same-origin `/api/v1` | databases, the AI service, secrets |
| `backend/` | Node.js 20, Express 5, TypeScript | PostgreSQL, MongoDB, the AI service | - |
| `ai/` | Python 3.12, FastAPI, scikit-learn, TensorFlow | nothing (stateless; called by the backend) | databases, the frontend |
| `analytics/` | Python 3.12, pandas, SciPy, Streamlit | PostgreSQL (read + metrics tables), MongoDB (read) | the frontend, the AI service |

`npm run verify:structure` checks the frontend side of this mechanically.

## Request flow

```
Browser
  └─ Next.js page (client components)
       └─ lib/api.ts  fetch("/api/v1/...")  + Bearer access token (memory only)
            └─ proxy.ts rewrites to BACKEND_INTERNAL_URL at request time
                 └─ backend: requestContext → helmet/cors → rate limit
                      → authenticate (JWT) → requirePatientAccess (object-level)
                      → validate (zod) → controller → service → repository
                           ├─ PostgreSQL (pg, least-privileged role)
                           ├─ MongoDB (driver, readWrite on mmry only)
                           └─ AI service (Bearer AI_SERVICE_TOKEN, 4 s timeout, rule fallback)
```

## Backend layers

- `routes/`: URL → middleware chain → controller. No logic.
- `controllers/`: read validated input from `res.locals`, call one service, shape the response.
- `services/`: business rules (geofence hysteresis, scoring, insights, token rotation, AI fallbacks).
- `repositories/`: the only code that issues SQL or Mongo queries. Parameterised throughout.
- `models/`: TypeScript types for records and API views.
- `validators/`: zod schemas for bodies, queries and params.
- `middleware/`: auth, authorisation, validation, CSRF, rate limits, error handling.
- `utils/`: crypto, password hashing, tokens, geo maths, scoring rules, DB setup tooling.
- `config/`: validated environment, connection pools, logger.

## Data placement

PostgreSQL holds everything relational and transactional: users, refresh
tokens, patients and caregiver links, routine and daily completions, people
and places, game-session and mind-check **summaries**, safe zones and the
breach/SOS history, and the analytics output.

MongoDB holds only document-shaped data that varies by kind and is read as a
whole: the pick-by-pick trail of each game (different per game), the
question-level answers of each mind check, talk-companion turns (encrypted
text, 180-day TTL) and AI inference logs (90-day TTL). Nothing is stored in
both: Mongo documents reference PostgreSQL ids and carry no summary numbers.

## Frontend structure

- `app/`: routes. `/`, `/login`, `/register` are public. `/dashboard/**` holds the patient
  screens (home, day, activities, talk, people, check) and the caregiver Care
  screen. `/analytics`, `/profile` and `/settings` are caregiver areas behind the patient's PIN.
- `components/`: `ui/` primitives, `navbar/` header and bottom bar, `sidebar/` wide-screen
  navigation, `dashboard/` screens and the app shell, `forms/`, `analytics/`.
- `hooks/`: auth, patient, i18n and speech providers; live data (`useResource`); game driver;
  offline session queue; location tracking.
- `lib/`: API client, session handling, cross-tab sync, pure domain logic (game engine,
  mind check, formatting, voice selection, conversation), translations.

### Live data

`hooks/useResource.ts` is a stale-while-revalidate cache. Data on screen
refreshes when the tab regains focus or visibility, when the device comes back
online, when another open tab changes it (`lib/sync.ts`, BroadcastChannel),
and on a timer for live screens: safe zone every 30 s, routine and insights
every 60 s, analytics every 5 min. Polling pauses while the tab is hidden.
Writes update the cache optimistically and broadcast an invalidation.

### Responsive layout

Type, spacing and component sizes are fluid (`clamp()`), from a 320 px phone
to wide desktop screens:

- phones: single column, bottom navigation, full-screen dialogs, 4-column game grids fold to 3 below 380 px, tables become labelled cards;
- tablets (≥ 640 px): wider content, the four home tiles in one row, two-column feature and form grids;
- desktops (≥ 1024 px): sidebar navigation replaces the bottom bar, Care shows the safe zone beside alerts and the activity log, Profile and Talk split into columns;
- landscape phones: shorter tiles and a horizontal bottom bar; safe-area insets respected on notched devices.

The patient's text-size setting scales everything on top of the fluid base.
