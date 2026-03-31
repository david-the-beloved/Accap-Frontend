# Deployment notes

This repository contains a Next.js frontend (deployed on Vercel) and a FastAPI backend.

Quick checklist before deploy

- Ensure sensitive secrets are not committed to the repo. Use environment variables or a secret store.
- Set `DATABASE_URL` (or `SUPABASE_DATABASE_URL`) for production with `sslmode=require`.
- Set `JWT_SECRET` strong value.
- Set SMTP credentials (`SMTP_HOST`, `SMTP_USER`, `SMTP_PASSWORD`, `SMTP_FROM_EMAIL`) or `RESEND_API_KEY`.
- Set `GOOGLE_CLIENT_ID` and configure authorized origins in Google Cloud Console.

Frontend (Vercel)

- Push the frontend to GitHub and link it to Vercel.
- Set `NEXT_PUBLIC_API_URL` to your backend URL in Vercel environment variables.
- Set `NEXT_PUBLIC_GOOGLE_CLIENT_ID` in Vercel env.

Backend options (free / low-cost)

- Fly.io: supports Docker images and has a free allowance for small apps.
- Render / Railway: (may have free tiers or low-cost plans) — check current provider docs.
- Supabase / Neon: use Postgres hosting and host the backend separately.

Local production testing with Docker

1. Build and start services:

```powershell
docker compose -f docker-compose.prod.yml up --build
```

2. Run migrations:

```powershell
cd backend
alembic upgrade head
```

Running in production

- Prefer running multiple worker processes behind a process manager (Gunicorn + Uvicorn workers) or use a container orchestration platform.
- Run the scheduler as a single leader (avoid starting the scheduler in every replica). Use a dedicated scheduler worker or leader election.

CI / CD suggestions

- Frontend: Vercel automatic deploys on push.
- Backend: build Docker image and deploy to Fly.io or your chosen provider.
