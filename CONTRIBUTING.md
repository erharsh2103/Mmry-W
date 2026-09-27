# Contributing

Thanks for considering a contribution to Mmry.

## Getting set up

Follow [Start it locally](README.md#start-it-locally) in the README to get
the frontend, backend, AI service and databases running.

## Before opening a PR

```bash
npm run typecheck
npm test
npm run verify:structure
```

## Guidelines

- Keep the frontend/backend/ai/analytics boundaries intact — the frontend
  never talks to a database, model or server secret directly (see
  [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md)).
- Validate all request input; parameterize all SQL.
- Match the existing code style in the file you're editing.
- Keep PRs focused — one change per PR, with a clear description of why.
