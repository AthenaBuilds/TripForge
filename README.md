# TripForge

Plan trips with shared day-by-day itineraries. Specs live in [`specs/`](specs/) and are the source of truth.

## Layout

| Path      | What                                       |
| --------- | ------------------------------------------ |
| `client/` | React 18 + Vite + Tailwind SPA             |
| `server/` | Express + Prisma REST API                  |
| `shared/` | Zod schemas and types shared by both sides |
| `infra/`  | AWS CDK stack (coming later)               |

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
Run migrations with the same image: `docker run --rm -e DATABASE_URL=... tripforge-api npx prisma migrate deploy`.

Checks: `npm run lint`, `npm run typecheck`, `npm test`, `npm run build`.
