# TripForge

Plan trips with shared day-by-day itineraries. Specs live in [`specs/`](specs/) and are the source of truth.

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

Details: `specs/backend-spec.md` §14–15.
