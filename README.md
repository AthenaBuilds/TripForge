# TripForge

Plan trips with shared day-by-day itineraries.

**Live:** https://tripforge-alpha.vercel.app (the API scales to zero, so the first request after idle takes a few seconds while it starts).

Built spec-first: the goal, frontend, backend, and API-contract specs in [`specs/`](specs/) are the source of truth, and every behavior change updates them before code. Decisions are logged in [`specs/goal-spec.md`](specs/goal-spec.md) §10.

## Features

- Email/password accounts (JWT in an httpOnly cookie)
- Create trips with a day-by-day itinerary; new-trip drafts auto-save locally
- Edit a saved itinerary with staged changes and a single **Update Trip** save
- Dashboard with upcoming and past trips
- Read-only share links that can be revoked
- PDF and Excel export of an itinerary
- Responsive on desktop and mobile

## Architecture

```
Browser ──► Vercel (React SPA)
              │  /api/* rewrite (same-origin, so the session cookie is first-party)
              ▼
            Cloud Run (Express API in Docker, Singapore)
              │  Prisma + pg adapter, TLS
              ▼
            Neon (PostgreSQL 16, Singapore)
```

Stack: TypeScript everywhere, React 18 + Vite + Tailwind v4, Express 5 + Prisma 7, Zod schemas shared between client and server, Vitest + Supertest + React Testing Library, GitHub Actions CI/CD.

## Layout

| Path                 | What                                                             |
| -------------------- | ---------------------------------------------------------------- |
| `client/`            | React 18 + Vite + Tailwind SPA                                   |
| `server/`            | Express + Prisma REST API                                        |
| `shared/`            | Zod schemas and types shared by both sides                       |
| `specs/`             | Goal, frontend, backend and API-contract specs (source of truth) |
| `scripts/`           | Test-DB init SQL and the one-time GCP setup script               |
| `.github/workflows/` | CI (`ci.yml`) and the Cloud Run deploy (`deploy-api.yml`)        |

## Local development

Requires Node 24 (`nvm use`) and Docker.

```sh
npm install
docker compose up -d          # Postgres 16 on :5432 (dbs: tripforge, tripforge_test)
cp server/.env.example server/.env
npm run db:migrate -w @tripforge/server   # apply migrations to the dev db
npm run dev -w @tripforge/server   # API on :3000
npm run dev -w @tripforge/client   # SPA on :5173, proxies /api -> :3000
```

Server tests use `server/.env.test` (the `tripforge_test` db) and truncate it, never your dev db.

Production image (API): `docker build -f server/Dockerfile -t tripforge-api .` from the repo root.
The image applies pending migrations on start (`npm run start:prod`), then starts the API.

Checks: `npm run lint`, `npm run typecheck`, `npm test`, `npm run build`.

## Deployment

| Part     | Where                                                        | URL                                                        |
| -------- | ------------------------------------------------------------ | ---------------------------------------------------------- |
| Frontend | Vercel (Root Directory `client`)                             | https://tripforge-alpha.vercel.app                         |
| API      | Google Cloud Run, service `tripforge-api`, `asia-southeast1` | https://tripforge-api-201572810260.asia-southeast1.run.app |
| Database | Neon Postgres 16 (free plan, Singapore)                      | —                                                          |

The browser only talks to Vercel: `client/vercel.json` rewrites `/api/*` to the Cloud Run URL, so the session cookie stays first-party.

### How a change ships

1. Open a pull request. CI (`.github/workflows/ci.yml`) runs lint, type-check, tests and builds for the parts that changed (all jobs when `ci.yml` itself changes). The `ci-ok` check gates the merge.
2. Merge to `main`.
   - **API:** if `server/`, `shared/`, package files or the workflows changed, CI calls `deploy-api.yml` after `ci-ok` passes. It signs in to GCP with Workload Identity Federation (no stored keys), builds `server/Dockerfile`, pushes the image to Artifact Registry tagged with the commit SHA, deploys it to Cloud Run, and fails unless `/health` returns 200.
   - **Frontend:** Vercel builds `client/` and promotes it after `ci-ok` passes.
3. Migrations run when the new container starts (`prisma migrate deploy`). A revision that fails to start never gets traffic, so the previous one keeps serving.

Redeploy by hand: **Actions → Deploy API → Run workflow** (branch `main`).

Roll back the API: `gcloud run services update-traffic tripforge-api --region=asia-southeast1 --to-revisions=<previous-revision>=100`, or use the Cloud Run console.

### Configuration

- **Secrets** (`DATABASE_URL` pooled, `DIRECT_URL` direct for migrations, `JWT_SECRET`) live only in GCP Secret Manager. Each Neon URL is stored as the bare `postgresql://…` string.
- **GitHub repository variables** (one per name, no surrounding spaces): `GCP_PROJECT_ID`, `GCP_REGION`, `GCP_WIF_PROVIDER`, `GCP_DEPLOYER_SA`, `CORS_ORIGIN`, `TRUST_PROXY_HOPS` (`2`: Vercel edge + Google front end). The deploy job runs in the `production` environment.

### First-time setup or secret rotation

Run `scripts/gcp-setup.sh` as a GCP project owner. It is idempotent and creates or updates the APIs, service accounts, Artifact Registry repo, IAM, Workload Identity Federation, secrets (hidden prompts) and budget, then prints the GitHub variables to add. After the first deploy, make the service public once with the `gcloud run services add-iam-policy-binding … --member=allUsers --role=roles/run.invoker` command it prints. To rotate the Neon password, re-run it with the new URLs, redeploy, then destroy the old secret versions.

### Cost guardrails

Expected cost is $0 a month on free tiers: Cloud Run scales to zero (max 2 instances), Artifact Registry keeps the newest 2 images, only the latest version of each secret stays active, and a ₹450 (about $5) monthly budget sends alerts at 50%, 90% and 100%.

Details: `specs/backend-spec.md` §14–15. Known limitations: `specs/backend-spec.md` §16.
