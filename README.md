# Mmry

A memory-care companion for people living with dementia and the families who
look after them: a spoken daily routine, eight gentle brain games that adjust
their own difficulty, the faces and places that matter, a guided mind check,
a safe zone with SOS, and a caregiver view of engagement trends. It is built
for North-East India, in 28 Indian languages.

> Engagement trends only, never a diagnosis.

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

## Quick start (local development)

Requires Node.js 20.9+, Python 3.12 and Docker.

```bash
node scripts/generate-env.mjs            # .env with fresh random secrets
npm run install:all                      # backend + frontend dependencies
npm run db:up                            # PostgreSQL + MongoDB containers
npm run db:setup                         # migrations, schema, seeds, grants, Mongo validators

python3.12 -m venv ai/.venv        && ai/.venv/bin/pip install -r ai/requirements.txt
python3.12 -m venv analytics/.venv && analytics/.venv/bin/pip install -r analytics/requirements.txt

npm run dev:ai          # http://127.0.0.1:8000   (internal)
npm run dev:backend     # http://127.0.0.1:4000/api/v1
npm run dev:frontend    # http://localhost:3000   ← open this
```

On Windows the virtualenv interpreter is `ai\.venv\Scripts\python.exe`.
If ports 5432 or 27017 are taken, change `POSTGRES_PORT` / `MONGO_PORT` in `.env`.

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

- **Offline on-device speech** (ONNX Whisper and MMS voices running in the
  browser) is gone. Speech now uses the browser's own voices and recogniser,
  and in Chrome recognition sends audio to Google.
- **The Expo mobile wrapper** loaded `Mmry.html` directly and was retired
  with it.

The legacy project is preserved outside this repository in
`../Mmry-legacy-backup/`.
