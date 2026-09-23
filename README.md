# Mmry

A memory-care companion for people living with dementia and the families who
look after them: a spoken daily routine, eight gentle brain games that adjust
their own difficulty, the faces and places that matter, a guided mind check,
a safe zone with SOS, and a caregiver view of engagement trends. It is built
for North-East India, in 28 Indian languages.

> Engagement trends only, never a diagnosis.

## TL;DR

Mmry is a full-stack, privacy-conscious memory-care companion for people
living with dementia and the caregivers who support them. It is designed for
North-East India and supports 28 Indian languages. The product combines a
patient-facing daily companion with caregiver tools for routines, safety,
engagement and trends.

### What the product does

- Provides a spoken daily routine with tasks, reminders and completion status.
- Offers eight gentle brain games whose difficulty adapts to recent performance.
- Stores important people and places so the patient can recognise and revisit
  the relationships and locations that matter to them.
- Includes a guided mind check that records answers and calculates area scores.
- Provides a talk companion that recognises intents such as medication,
  today's routine, people, games and mind checks.
- Supports a caregiver-managed safe zone with location tracking, exit/return
  events and SOS recording.
- Gives caregivers protected Care, Analytics, Profile and Settings areas,
  including engagement trends and game-level insights.

### How it works

The repository is split into independently deployable services:

1. `frontend/` is a Next.js, React and TypeScript application. It serves the
   patient and caregiver experiences and calls only same-origin `/api/v1`
   routes. It never connects directly to a database, model or server secret.
2. `backend/` is a Node.js, Express and TypeScript API. It owns
   authentication, authorisation, validation, business rules and all database
   access. Patient routes enforce caregiver-to-patient access.
3. `ai/` is an internal FastAPI service with a scikit-learn talk-intent model
   and a TensorFlow adaptive-difficulty model. The backend calls it with a
   service token and falls back to deterministic rules when it is unavailable.
4. `analytics/` is a Python pipeline that reads permitted operational data,
   computes daily metrics, and exposes a Streamlit dashboard and Markdown/CSV
   reports.
5. `database/` contains PostgreSQL migrations/schema/seeds and MongoDB
   validators/indexes.

PostgreSQL stores relational and transactional data such as users, patients,
caregiver links, routines, people, session summaries, safety events and
analytics output. MongoDB stores document-shaped details such as game step
trails, mind-check answers, encrypted talk turns and AI logs. Encrypted talk
turns expire after 180 days and AI logs after 90 days.

### Security and safety boundaries

- Access tokens are short-lived and held in browser memory; refresh tokens are
  rotated and stored in an `httpOnly`, `SameSite=Strict` cookie.
- Passwords and caregiver PINs are hashed with scrypt and rate limited.
- Request bodies, queries and route parameters are validated with Zod, and SQL
  is parameterised.
- Phone numbers, memory-vault data and coordinates are encrypted at rest.
- Location tracking is disabled until a caregiver enables it.
- Safe-zone notifications are queued for configured contacts, but delivery is
  not claimed until an SMS or push provider and worker are configured.
- The AI models support assistance and engagement features only. They are not
  diagnostic tools, and the difficulty model has been evaluated on simulated
  players rather than real patient data.

### Start it locally

Prerequisites: Node.js 20.9+, Python 3.12 and Docker.

```bash
node scripts/generate-env.mjs
npm run install:all
npm run db:up
npm run db:setup

# Create the Python environments once
python3.12 -m venv ai/.venv
python3.12 -m venv analytics/.venv
ai/.venv/bin/pip install -r ai/requirements.txt
analytics/.venv/bin/pip install -r analytics/requirements.txt
# faster-whisper downloads WHISPER_MODEL once; afterward STT can run offline

# Run the services in separate terminals
npm run dev:ai          # internal AI service: 127.0.0.1:8000
npm run dev:backend     # API: 127.0.0.1:4000/api/v1
npm run dev:frontend    # app: http://localhost:3000
```

On Windows, use `ai\.venv\Scripts\python.exe` and the equivalent interpreter
under `analytics\.venv`. To start the complete containerised stack instead,
run `node scripts/generate-env.mjs` followed by `docker compose up -d --build`.

### Useful commands

```bash
npm run dev:all             # frontend, backend and AI together
npm run typecheck           # TypeScript checks
npm test                    # backend, frontend, AI and analytics tests
npm run verify:structure    # repository and frontend-boundary checks
npm run analytics:run       # recompute daily metrics
npm run analytics:dashboard # Streamlit dashboard on 127.0.0.1:8501
npm run analytics:report    # write Markdown and CSV reports
npm run ai:train            # rebuild data and retrain both AI models
```

For deeper implementation details, start with
[docs/ARCHITECTURE.md](docs/ARCHITECTURE.md), then read
[docs/API.md](docs/API.md), [docs/SECURITY.md](docs/SECURITY.md),
[docs/AI_MODELS.md](docs/AI_MODELS.md) and
[docs/DEPLOYMENT.md](docs/DEPLOYMENT.md).

## Architecture

```
Browser ──► frontend/ (Next.js + React + TypeScript)
               │  same-origin /api/*  (proxy.ts forwards at request time)
               ▼
            backend/  (Node.js + TypeScript, REST /api/v1)
               │ controllers → services → repositories
               ├──► PostgreSQL   users, auth, patients, routine, people, sessions, safety
               ├──► MongoDB      game step trails, mind-check answers, talk turns, AI logs
               └──► ai/ (Python: FastAPI, scikit-learn, TensorFlow)   internal only

database ──► analytics/ (Python: pandas, SciPy, Streamlit)
               └──► patient_daily_metrics (read back by the API) + dashboard + reports
```

The frontend never touches a database, a model or a server secret; the
backend is the only component that does. See
[docs/ARCHITECTURE.md](docs/ARCHITECTURE.md).

| Folder | What lives there |
| --- | --- |
| [`frontend/`](frontend) | Next.js App Router UI: routes, components, hooks, typed API client |
| [`backend/`](backend) | REST API: auth, authorisation, validation, business rules, DB access |
| [`ai/`](ai) | Intent classifier (scikit-learn) and adaptive-difficulty model (TensorFlow), with training code |
| [`analytics/`](analytics) | Daily-metrics pipeline, cohort reports, institutional dashboard |
| [`database/`](database) | PostgreSQL migrations, repeatable schema, seeds; MongoDB validators and indexes |
| [`docs/`](docs) | Architecture, API, security, AI models, deployment, migration notes |
| [`scripts/`](scripts) | Environment generation, DB init roles, Python runner, structure check |

## Getting started

Requires Node.js 20.9+, Python 3.12 and Docker Desktop. Run the setup commands
once from the repository root:

```bash
node scripts/generate-env.mjs
npm run install:all
npm run db:up
npm run db:setup
```

Create the Python environments. On macOS/Linux:

```bash
python3.12 -m venv ai/.venv
ai/.venv/bin/pip install -r ai/requirements.txt
python3.12 -m venv analytics/.venv
analytics/.venv/bin/pip install -r analytics/requirements.txt
```

On Windows PowerShell:

```powershell
py -3.12 -m venv ai\.venv
ai\.venv\Scripts\python.exe -m pip install -r ai\requirements.txt
py -3.12 -m venv analytics\.venv
analytics\.venv\Scripts\python.exe -m pip install -r analytics\requirements.txt
```

### Run with npm

Use three terminals, or run the combined command. The combined command starts
the frontend, backend and AI service together:

```bash
npm run dev:all
```

For separate terminals:

```bash
npm run dev:ai          # local AI service: http://127.0.0.1:8000
npm run dev:backend     # API: http://127.0.0.1:4000/api/v1
npm run dev:frontend    # website: http://localhost:3000
```

Open `http://localhost:3000`. The local multilingual `tiny` faster-whisper STT
model downloads once on first AI startup; wait for the AI service to become healthy before
using the microphone. After that download, transcription runs locally.

Stop npm development processes with `Ctrl+C`. Stop the database containers with:

```bash
docker compose stop postgres mongodb
```

### Run with Docker

Docker runs the frontend, backend, AI service, databases and analytics:

```bash
docker compose up -d --build
```

Open `http://localhost:3000`. Check the services with:

```bash
docker compose ps
docker compose logs -f ai
```

After changing backend, frontend or AI code, rebuild the affected services:

```bash
docker compose build ai backend frontend
docker compose up -d ai backend frontend
```

Stop the full Docker stack with:

```bash
docker compose down
```

If only the AI service is stopped or unhealthy, restart it with:

```bash
docker compose up -d --build ai
```

If ports 5432 or 27017 are taken, change `POSTGRES_PORT` or `MONGO_PORT` in
`.env`. The website uses port 3000, the AI service uses 8000, and the analytics
dashboard uses 8501 by default.

Analytics:

```bash
npm run analytics:run         # recompute daily metrics now
npm run analytics:dashboard   # http://127.0.0.1:8501 (password: ANALYTICS_DASHBOARD_PASSWORD)
npm run analytics:report      # Markdown + CSV in analytics/reports/output/
```

## Full stack in containers

```bash
node scripts/generate-env.mjs
docker compose up -d --build     # frontend on http://localhost:3000
```

See [docs/DEPLOYMENT.md](docs/DEPLOYMENT.md) for cloud and institutional
(on-premises) deployment.

## Checks

```bash
npm run typecheck          # backend + frontend
npm test                   # backend, frontend, AI and analytics test suites
npm run verify:structure   # required layout, zero .html files, frontend isolation
```

## What changed from the single-file app

Mmry used to be one self-extracting `Mmry.html`. It was migrated feature by
feature into this stack and removed; every screen, game, translation, voice
rule and safety behaviour was carried over. Two things could not survive the
move, and [docs/MIGRATION.md](docs/MIGRATION.md) explains both:

- Speech-to-text now uses a local `faster-whisper` model through the Python AI
  service. It is offline after the model has been downloaded once; the browser
  records audio locally and sends it only to the local backend. Text-to-speech
  still uses the browser's installed voices.
- **The Expo mobile wrapper** loaded `Mmry.html` directly and was retired
  with it.

The legacy project is preserved outside this repository in
`../Mmry-legacy-backup/`.
