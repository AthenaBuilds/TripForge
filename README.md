# TripForge

Plan trips with shared day-by-day itineraries.

**Live:** https://tripforge-alpha.vercel.app (free hosting: the first request after ~15 minutes idle takes 30–60 s while the API wakes up).

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
            Render (Express API in Docker, Singapore)
              │  Prisma + pg adapter, TLS
              ▼
            Neon (PostgreSQL 16, Singapore)
```

Stack: TypeScript everywhere, React 18 + Vite + Tailwind v4, Express 5 + Prisma 7, Zod schemas shared between client and server, Vitest + Supertest + React Testing Library, GitHub Actions CI.

## Layout

| Path      | What                                       |
| --------- | ------------------------------------------ |
| `client/` | React 18 + Vite + Tailwind SPA             |
| `server/` | Express + Prisma REST API                  |
| `shared/` | Zod schemas and types shared by both sides |

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

- API: Render free web service built from `server/Dockerfile`, defined in `render.yaml`. It auto-deploys from `main` after CI passes.
- Database: Neon Postgres 16. Set `DATABASE_URL` (pooled) and `DIRECT_URL` (direct, for migrations) in Render.
- Frontend: Vercel (Root Directory `client`); `client/vercel.json` proxies `/api` to the Render URL.

Every change goes through a pull request; the `ci-ok` check gates merges and both deploys.

Details: `specs/backend-spec.md` §14–15. Known limitations: `specs/backend-spec.md` §16.
