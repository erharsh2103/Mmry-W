# Deployment

Every component ships as a container; `docker-compose.yml` wires them together.

| Service | Image source | Port | Exposure |
| --- | --- | --- | --- |
| `frontend` | `frontend/Dockerfile` (Next.js standalone) | 3000 | public, behind TLS |
| `backend` | `backend/Dockerfile` | 4000 | internal (frontend forwards `/api`) |
| `ai` | `ai/Dockerfile` | 8000 | internal only |
| `analytics-worker` | `analytics/Dockerfile` | - | internal, hourly pipeline |
| `analytics-dashboard` | `analytics/Dockerfile` (Streamlit) | 8501 | staff network / VPN only |
| `postgres`, `mongodb` | official images | 5432, 27017 | internal only |
| `db-setup` | backend image | - | one-shot migrations + Mongo validators |

## Single host / institutional server

```bash
node scripts/generate-env.mjs          # or write .env from your secret store
# set COOKIE_SECURE=true, TRUST_PROXY_HOPS=1, CORS_ORIGIN=https://your.host
docker compose up -d --build
```

Put a TLS-terminating reverse proxy (nginx, Caddy, Traefik) in front of
`frontend:3000`. Remove the `127.0.0.1:` port mappings of the internal services
in production. Back up the `postgres-data` and `mongo-data` volumes **and the
`DATA_ENCRYPTION_KEY`**: without the key, encrypted fields cannot be recovered.

Air-gapped hospitals: build images on a connected machine, `docker save` /
`docker load` them, and host everything on the internal network. No component
needs internet access at runtime (fonts and translations are bundled).

## Cloud

| Piece | Typical managed service |
| --- | --- |
| frontend, backend, ai, analytics | any container platform (Cloud Run, ECS/Fargate, Azure Container Apps, Kubernetes) |
| PostgreSQL | Cloud SQL, RDS, Azure Database for PostgreSQL |
| MongoDB | MongoDB Atlas, or DocumentDB with care over `$jsonSchema` support |
| secrets | Secret Manager, AWS Secrets Manager, Azure Key Vault |

Configuration is entirely environment variables (`.env.example` lists them).
Run `node dist/utils/setupDatabases.js` from the backend image as a release job
before rolling out a new backend version. The backend is stateless and scales
horizontally; the AI service loads its models at start and can be replicated.
Health checks: `GET /api/v1/health` (liveness), `/api/v1/health/ready` (readiness),
`GET /health` on the AI service.

The frontend map uses Google Maps when `NEXT_PUBLIC_GOOGLE_MAPS_API_KEY` is
provided to the frontend build. Enable Maps JavaScript API and billing in the
Google Cloud project, then restrict the key to the app's allowed origins.

## Twilio safe-zone alerts

Set these backend environment variables to enable the notification outbox
worker:

```text
TWILIO_ACCOUNT_SID=AC...
TWILIO_AUTH_TOKEN=...
TWILIO_FROM_NUMBER=+1...
```

All three must be set together. The backend polls pending safe-zone alerts
every 15 seconds and retries failed sends up to five times. A trial account can
send only from its Twilio trial number and only to phone numbers verified in
the Twilio console. Keep the auth token in the secret store or local `.env`;
never commit it.
