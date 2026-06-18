# HireFit Backend

Node/Express backend for Naukri Excel imports, resume PDF extraction, private Supabase Storage uploads, and queued AI scoring.

## Commands

```bash
npm run backend:start
npm run backend:worker
npm run backend:seed-admin
npm run backend:test
```

## Required services

- Supabase project with the migrations in `supabase/migrations` applied.
- Redis for BullMQ scoring jobs. Set `REDIS_URL` if not using `redis://127.0.0.1:6379`.
- At least one AI provider token:
  - `GITHUB_MODELS_TOKEN`
  - `GROQ_API_KEY`
  - `OPENROUTER_API_KEY`

## Admin user

`npm run backend:seed-admin` creates or updates `SUPER_ADMIN_EMAIL` with `SUPER_ADMIN_PASSWORD`, and upserts the email into `allowed_emails`.

The seed command requires the Supabase tables to exist first.

## API

- `GET /health`
- `POST /api/jobs`
- `POST /api/jobs/:id/candidates/import`
- `POST /api/candidates/:id/resume`
- `POST /api/jobs/:id/score`
- `GET /api/jobs/:id/scoring-status`
