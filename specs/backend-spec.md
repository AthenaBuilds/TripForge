# Backend Spec — TripForge

## 1. Overview
<!-- Summary of the backend system and its responsibilities. -->
A REST API server that owns all persistent TripForge data. It handles user signup/login, enforces that each user can only access their own trips, stores trips and their itinerary items in PostgreSQL, and generates PDF/Excel exports of a trip's itinerary. The React SPA (see frontend-spec.md) is its only client; request/response shapes are defined in api-contract-spec.md.

## 2. Tech Stack
<!-- Language, framework, runtime, hosting. -->
- Language: TypeScript
- Framework: Express
- Runtime/Hosting: Node.js 24 LTS (`node:24-alpine` base image) in a Docker container on **Google Cloud Run** (scale-to-zero, free tier); see §14
- ORM: Prisma
- Validation: Zod (request bodies, params, and query strings)
- Auth: `jsonwebtoken` + `bcrypt`
- Export: `pdfkit` (PDF), `exceljs` (Excel `.xlsx`)

## 3. Architecture
<!-- High-level architecture: monolith/microservices, layers, key modules. -->
- **Single monolith** Express app with a layered structure:
  - `routes/` — wire HTTP paths to controllers and middleware.
  - `controllers/` — parse and validate the request (Zod), call services, and shape the response envelope.
  - `services/` — business logic and ownership checks; the only layer that talks to Prisma.
  - `middleware/` — `requireAuth` (verifies the JWT cookie and sets `req.user`), `errorHandler`, request logging.
  - `export/` — PDF and Excel generators that take a trip with its items and return a buffer.
- **Modules:** `auth`, `trips`, `items`, `export`.
- The repo is an npm-workspaces monorepo: `/client` (frontend), `/server` (backend), `/shared` (Zod schemas, date helpers and error codes used by both), `/specs`, `/scripts` (test-DB and GCP setup scripts), and `.github/workflows`.

## 4. Data Model
<!-- Entities, relationships, key fields. Link to ER diagram if available. -->
| Entity | Fields | Relationships |
|--------|--------|----------------|
| User | `id` (uuid, PK), `email` (unique, lowercased), `passwordHash`, `name`, `createdAt`, `updatedAt` | has many Trips |
| Trip | `id` (uuid, PK), `userId` (FK), `destination` (string), `startDate` (date), `endDate` (date), `shareSlug` (string, nullable, unique), `sharedAt` (timestamp, nullable), `createdAt`, `updatedAt` | belongs to User; has many ItineraryItems (cascade delete) |
| ItineraryItem | `id` (uuid, PK), `tripId` (FK), `title` (string), `date` (date), `startTime` (`HH:mm`, nullable), `endTime` (`HH:mm`, nullable), `city` (nullable), `location` (nullable), `notes` (text, nullable), `createdAt`, `updatedAt` | belongs to Trip |

- Dates are stored as calendar dates with no time zone, because itineraries are in the destination's local time. Times are stored as `HH:mm` strings.
- Items are ordered by `date`, then `startTime` (items with no time come first), then `createdAt`. There is no manual ordering in the MVP.
- **Multi-city trips are supported in the MVP:**
  - `Trip.destination` is a free-text label for the whole trip (e.g. "South India" or "Goa").
  - Each item has an optional free-text `city` (e.g. "Mysuru"), which records where that activity happens.
  - There is no separate Stop/City entity and no per-city date validation (decided 2026-10-03).
  - `city` is distinct from `location`: `city` is the town, `location` is the specific place, such as a venue or address.

## 5. Database
<!-- Database choice, schema migrations strategy, indexing considerations. -->
- Database: PostgreSQL 16 (Docker locally; **Neon** serverless Postgres 16 in production, TLS required)
- Migration tool: Prisma Migrate (`prisma migrate dev` locally, `prisma migrate deploy` in CI/production)
- Indexes: `User.email` (unique), `Trip.shareSlug` (unique, nullable), `Trip.userId`, `ItineraryItem(tripId, date)`.
- Foreign keys use `ON DELETE CASCADE` from Trip to ItineraryItem, so deleting a trip deletes its items.

## 6. Business Logic / Domain Rules
<!-- Key rules and validations the backend must enforce. -->
- Every trip operation is scoped to `req.user.id`. Accessing a trip owned by another user returns **404** (not 403), so the API does not reveal that the trip exists.
- `startDate <= endDate`, and a trip lasts at most 60 days.
- A trip can't start in the past: on create, and on update when `startDate` changes, `startDate` must be no earlier than **yesterday in UTC** (one day of slack, because the server doesn't know the user's time zone; the frontend enforces the user's local today). Otherwise `422 START_DATE_IN_PAST`. An unchanged past start date (an ongoing trip) is allowed.
- `PUT /trips/:tripId/items` replaces the trip's whole itinerary in **one transaction**: listed items with an `id` are updated, items without an `id` are created, and existing items not listed are deleted. All item rules (dates within the trip, start ≤ end time, ≤ 200 items) are checked on the final list before anything is written. An `id` that doesn't belong to this trip returns `404`. Existing item ids and `createdAt` are kept.
- An item's `date` must fall within its trip's `startDate`–`endDate`. If an item has both `startTime` and `endTime`, then `startTime <= endTime`.
- When a trip's dates are changed, the update is rejected (`422 ITEMS_OUT_OF_RANGE`) if any existing item would fall outside the new range. Items are never silently deleted.
- If the request sets `shiftItems: true`, every item's date is first moved by `newStartDate − oldStartDate` days, in the same transaction as the trip update. The range check then runs on the shifted dates. See api-contract-spec.md `PATCH /trips/:tripId`.
- `POST /trips` creates the trip and all of its initial items in a **single transaction**: either everything is saved or nothing is.
- Required string fields are trimmed and must not be empty. Length limits: destination ≤ 100, title ≤ 120, city ≤ 80, location ≤ 120, notes ≤ 1000.
- A trip can have at most 200 items.

## 7. Authentication & Authorization
<!-- Auth strategy (JWT/session/OAuth), roles/permissions. -->
- Email and password signup/login. Passwords are hashed with bcrypt (cost factor 12) and must be at least 8 characters.
- On signup or login, the server issues a JWT (`sub` = user id, 7-day expiry) in an **httpOnly** cookie with `Secure` (in production) and `SameSite=Lax`. This resolves the frontend's open question about token storage.
- `POST /auth/logout` clears the cookie. `GET /auth/me` returns the current user so the SPA can restore the session when the page reloads.
- `requireAuth` middleware protects all `/trips*` routes and returns 401 if the cookie is missing or invalid. `/shared/*` routes are public.
- Each user owns their own trips; only the owner can edit a trip.
- **Read-only sharing (public link):**
  - The owner can turn on sharing for a trip. This generates a `shareSlug`: 16 bytes from `crypto.randomBytes`, base64url-encoded (22 characters, 128 bits of entropy).
  - Anyone with the link can call the unauthenticated `/shared/:slug` endpoints and gets a read-only view.
  - Revoking sets `shareSlug` back to `null`, and the old link immediately returns 404. Sharing again always generates a new slug; an old slug is never reused.
  - The public view never exposes `userId`, item IDs, the owner's email, or any internal timestamps other than `updatedAt`. It shows the owner's `name` as "Planned by …".
  - Responses from `/shared/*` include the headers `X-Robots-Tag: noindex, nofollow`, `Cache-Control: no-store`, and `Referrer-Policy: no-referrer`, so shared trips aren't indexed by search engines or cached after revocation.
- **Same-origin via Vercel rewrite:** the SPA is hosted on Vercel and calls the API at the relative path `/api/*`. A Vercel rewrite (`vercel.json`) proxies `/api/:path*` to the Cloud Run backend. From the browser's point of view, the cookie is first-party on the Vercel domain, so `SameSite=Lax` works and browsers that block third-party cookies (e.g. Safari) don't break login.
- CORS: the browser never calls the backend's origin directly, so CORS is restricted to the Vercel production origin (and `http://localhost:5173` in local dev), with `credentials: true`. Locally, the Vite dev server proxies `/api` the same way.
- Express sets `trust proxy` so it reads the client IP (for rate limiting) and the HTTPS scheme from `X-Forwarded-*` headers set by Vercel and Google's front end. `TRUST_PROXY_HOPS` is set to the measured hop count in production. On Cloud Run it is `2` (measured 2026-10-14): `X-Forwarded-For` arrives as `<client>, <Vercel edge>` and the socket peer is Google's front end, so trusting 2 hops yields the real client IP. (It was `4` on Render.)

## 8. Third-Party Integrations
<!-- External APIs/services (e.g. maps, weather, payments) and how they're used. -->
- None for the MVP. Maps, weather, and booking integrations are non-goals (see goal-spec.md).

## 9. Background Jobs / Async Processing
<!-- Scheduled jobs, queues, notifications. -->
- None. Exports are generated synchronously within the request, which is fine at MVP scale (≤ 200 items per trip).

## 10. Error Handling & Logging
<!-- Error response conventions, logging/monitoring approach. -->
- All errors use the shared envelope `{ "data": null, "error": { "code", "message", "details?" } }`, with codes defined in api-contract-spec.md.
- A central `errorHandler` middleware maps errors to responses: Zod errors → `400 VALIDATION_ERROR` (with per-field details), domain errors → their own codes, and anything else → `500 INTERNAL_ERROR` with a generic message. Stack traces are never sent to clients.
- Structured JSON logging with `pino` (`pino-http` for request logs). Passwords, tokens, and cookies are redacted from logs.

## 11. Security Requirements
<!-- Input validation, rate limiting, secrets management, data protection. -->
- Every input is validated with Zod at the controller boundary. Prisma uses parameterized queries.
- `helmet` sets security headers. The request body size limit is 100 KB.
- Rate limiting (`express-rate-limit`): `/auth/*` allows 10 requests per minute per IP; `/shared/*` allows 60 requests per minute per IP (this hinders slug guessing, which is already infeasible at 128 bits); the rest of the API allows 100 requests per minute per IP.
- Secrets (`DATABASE_URL`, `JWT_SECRET`) come from environment variables. Only `.env.example` is committed.
- Login failures return the same generic message whether the email or the password was wrong.

## 12. Scalability & Performance
<!-- Caching, expected load, bottlenecks to watch. -->
- The expected load is tiny (a portfolio project). There is no caching layer.
- `GET /trips` returns trip summaries plus an item count, not the full item lists.
- Export generation is the heaviest operation, and the per-trip item cap keeps it bounded.

## 13. Testing Strategy
<!-- Unit, integration tests, tooling. -->
- Vitest is the test runner, matching the frontend.
- Unit tests cover services (date-range rules, ownership checks) and the export generators.
- Integration tests use Supertest against the Express app with a dedicated test Postgres database (Docker), reset between test files. They cover the auth flow, trip CRUD, item CRUD, cross-user isolation (expect 404), and export content types.

## 14. Deployment & Infrastructure
<!-- CI/CD, environments, hosting provider. -->
- Environments: `local` (Docker Compose runs Postgres) and `production`. There is no staging environment.
- **Production setup** (moved from Render to Cloud Run on 2026-10-13 to remove the ~45 s cold starts; see goal-spec.md §10):
  - **Google Cloud Run** runs `server/Dockerfile` as the service `tripforge-api` in the existing GCP project `project-e5876b6a-ef84-4b68-a0d`, region **`asia-southeast1` (Singapore)**. This is the same region as the Neon database, which keeps every query in one region. Cloud Run gives a public HTTPS URL (`https://tripforge-api-201572810260.asia-southeast1.run.app`). No custom domain is needed.
  - Service settings:
    - Public (`allUsers` has `roles/run.invoker`) with ingress `all`, because Vercel's rewrite calls the API over the public internet. The app does its own auth (§7).
    - That invoker grant is a one-time step by the project owner, not part of the deploy: the deployer's `roles/run.developer` cannot change IAM, and should not be able to.
    - Min instances `0` (scale to zero, so it stays in the free tier) and max instances `2` (a hard cap on cost and on Neon connections).
    - 1 vCPU, 512 MiB, concurrency 80, request-based billing (CPU only while handling requests), and startup CPU boost.
    - Startup probe: HTTP `GET /health` every 2 s with a 1 s timeout, up to 60 attempts (2 minutes). Cloud Run requires the timeout to be below the period, so 2 s is the shortest valid period. It was 5 s, which left a ready instance waiting up to 5 s for traffic.
  - A dedicated runtime service account `tripforge-run@…` holds only `roles/secretmanager.secretAccessor` on the three app secrets. It is not the default compute service account.
  - **Artifact Registry**: a Docker repo `tripforge` in `asia-southeast1`. Images are tagged with the git commit SHA. A cleanup policy keeps the newest **2** images (the live one plus one rollback target). Each image is about 176 MB, so 2 images (~350 MB) stay under the 0.5 GB free allowance, while 5 would not.
  - **Secret Manager** holds `DATABASE_URL`, `DIRECT_URL`, and `JWT_SECRET`, mounted as environment variables. Non-secret settings (`NODE_ENV`, `LOG_LEVEL`, `TRUST_PROXY_HOPS`, `CORS_ORIGIN`) are plain environment variables set at deploy.
  - **Neon** (free plan, Singapore) hosts PostgreSQL 16, unchanged from the Render setup. Two connection strings:
    - `DATABASE_URL`: the **pooled** URL (PgBouncer, `-pooler` host), used by the app at runtime.
    - `DIRECT_URL`: the **direct** URL, used only by `prisma migrate deploy` (migrations need a direct session). Both use `sslmode=require&channel_binding=require`.
    - Each secret holds only the bare `postgresql://…` URL. Neon's "psql" copy button wraps it as `psql '…'`, which Prisma rejects (P1013) and which made the first Cloud Run revision fail to start; `scripts/gcp-setup.sh` strips that wrapper.
  - Migrations run **once per deploy**, not at container start: the deploy workflow runs the same image as the Cloud Run job `tripforge-migrate` (`npm run db:deploy` = `prisma migrate deploy`, runtime service account, `DATABASE_URL`/`DIRECT_URL` secrets, no retries) and waits for it before deploying the service. If the job fails, the deploy stops and the previous revision keeps serving. The image `CMD` is `node dist/index.js` directly (no npm wrapper), so a cold start only boots the server.
  - Logs: Cloud Logging collects the pino JSON logs from stdout. Severity is read from the JSON.
- Cold starts: a scaled-to-zero instance is ready in about 5–6 s (measured 2026-10-14; it was ~15 s when migrations ran at start and the probe ran every 5 s). Neon waking from autosuspend adds about 1–3 s to the first database query after idle. This replaces Render's 30–60 s.
- **Cost guardrails.** Expected cost is $0 a month within the free tier: 2M requests, 180k vCPU-seconds, and 360k GiB-seconds per billing account per month, plus 0.5 GB of Artifact Registry storage and 6 active secret versions.
  - Only the latest version of each of the 3 secrets stays enabled. After a rotation and a successful redeploy, older versions are destroyed, so active versions stay at 3.
  - The max-instances cap of `2` limits how far a traffic spike can scale.
  - A **Cloud Billing budget of ₹450 a month (about $5)** sends email alerts at 50%, 90%, and 100%. The amount is in INR because a budget must use the billing account's currency.
  - Min instances is never raised above 0, because an always-on instance is billed continuously.
- Portability: the image stays cloud-neutral, so only the deploy config changes if the API moves again.
- CI/CD details are in §15.

## 15. CI/CD
All pipelines run on **GitHub Actions**. The repo is a monorepo (`/client`, `/server`, `/shared`), and each job runs only when its paths change.

**Branch workflow**
- `main` is protected: no direct pushes. All changes go through a pull request, and merging requires the required CI checks to pass.
- Merges use squash-merge, giving one commit per pull request on `main`.

**CI — `.github/workflows/ci.yml`** (runs on every pull request and every push to `main`)
| Job | Runs when these paths change | Steps |
|-----|------------------------------|-------|
| `server` | `server/**`, `shared/**`, `.dockerignore`, `package-lock.json`, `.github/workflows/ci.yml` | install → lint → type-check → `prisma migrate deploy` against a Postgres service container → Vitest (unit + Supertest integration) → build → production Docker image build |
| `client` | `client/**`, `shared/**`, `package-lock.json`, `.github/workflows/ci.yml` | install → lint → type-check → Vitest + React Testing Library → `vite build` |
| `ci-ok` | always | Gate job that passes only when every job above passed or was skipped. Branch protection requires only this check, so path filtering doesn't block merges. |

- Dependencies are cached through `actions/setup-node` (npm cache). Node 24 everywhere: CI (`node-version: 24`), the Docker image, Vercel builds, and `engines.node: ">=24 <25"` in the root `package.json`, plus an `.nvmrc` file.
- A change to `ci.yml` runs every job, so CI changes are tested end to end before they merge.
- **Actions and runners.** Every action is on a major version that runs on Node 24: `actions/checkout@v7`, `actions/setup-node@v7`, `dorny/paths-filter@v4`, `google-github-actions/auth@v3`, `google-github-actions/setup-gcloud@v3`. Jobs use `runs-on: ubuntu-latest`. When GitHub moves that label to a new Ubuntu release (Ubuntu 26.04 from 2026-10-19), the full CI is first run once on the new image by pinning `runs-on` in a pull request, then switched back to `ubuntu-latest`.

**Backend CD — `.github/workflows/deploy-api.yml` (Cloud Run)**
- **Trigger:** a `deploy-api` job at the end of `ci.yml` calls the reusable workflow `deploy-api.yml`.
  - It runs only on a push to `main`, only after `ci-ok` passes, and only when the commit changed `server/**`, `shared/**`, `.dockerignore`, `package*.json`, `.github/workflows/deploy-api.yml`, or `.github/workflows/ci.yml`.
  - Its `if:` starts with `always() && needs.ci-ok.result == 'success'`. Without `always()`, the implicit `success()` also checks indirect dependencies, so a skipped `client` job would skip the deploy even though `ci-ok` passed.
  - `deploy-api.yml` can also be started by hand (`workflow_dispatch`).
  - The concurrency group `deploy-api` (without cancel-in-progress) keeps deploys from overlapping.
- **One-time setup: `scripts/gcp-setup.sh`**, run by a project owner. It is idempotent and holds no secrets. It enables the APIs and creates the service accounts, the Artifact Registry repo and its cleanup policy, the IAM grants, WIF, the secrets (from hidden prompts), and the budget. It then prints the GitHub variables to add and the one-time public-access grant to run after the first deploy. Re-run it to rotate the Neon URLs.
- **Auth: Workload Identity Federation (keyless).** No service-account JSON key exists anywhere.
  - A workload identity pool `github` with an OIDC provider for `token.actions.githubusercontent.com`. Its attribute condition limits it to `assertion.repository == 'AthenaBuilds/TripForge'` and `assertion.ref == 'refs/heads/main'`.
  - That provider may impersonate one deployer service account, `tripforge-deployer@…`, which has:
    - `roles/run.developer`
    - `roles/artifactregistry.writer` on the `tripforge` repo
    - `roles/iam.serviceAccountUser` on the runtime service account only
- **Steps:**
  1. `google-github-actions/auth`.
  2. Build `server/Dockerfile` and push it to Artifact Registry, tagged with the commit SHA.
  3. Run migrations: `gcloud run jobs deploy tripforge-migrate --execute-now --wait` with the new image (see §14). A failure stops the deploy.
  4. `gcloud run deploy` with the settings in §14.
  5. Smoke test: `curl` the new revision's `/health` and fail the job if it doesn't return 200.
- **Rollback:** `gcloud run services update-traffic tripforge-api --to-revisions=<previous>=100`, or the Cloud Run console. A revision that fails its startup probe never receives traffic. Migrations are expand-then-contract (below), so the previous revision still works against the migrated schema.

**Frontend CD** is handled by Vercel (see frontend-spec.md §13). Vercel waits for the GitHub `ci-ok` check before promoting a production deployment.

**Deploy ordering and compatibility**
- The frontend and backend deploy independently, so neither can assume the other has deployed first.
- API changes must be **backward-compatible** (add fields or endpoints; never remove or rename them in the same release). The backend ships first, and the frontend starts using the change in a later pull request. Removals happen only after the frontend no longer uses the field or endpoint.
- Database migrations must be **expand-then-contract**. Each migration must work with both the currently running code and the new code. Destructive changes (dropping or renaming columns) wait for a later release.

**Secrets**
- `DATABASE_URL`, `DIRECT_URL`, and `JWT_SECRET` live only in GCP Secret Manager. `JWT_SECRET` is newly generated for Cloud Run, so every user signs in once more after cutover.
- GitHub stores no deploy secrets. The WIF provider resource name, the deployer service-account email, the project ID, the region, `CORS_ORIGIN`, and `TRUST_PROXY_HOPS` are stored as repository **variables**, because none of them are secret.
- Each is a separate variable whose name is exactly the key and whose value has no surrounding spaces. A single combined variable left `GCP_WIF_PROVIDER` empty, and a leading space in `GCP_PROJECT_ID` produced an invalid image tag.

## 16. Known Limitations
- PDF export uses the built-in Helvetica font (WinAnsi encoding), so non-Latin text (e.g. Devanagari, CJK) does not render. Fixing this needs an embedded Unicode font.
- Scale-to-zero hosting: the first request after idle takes a few seconds (Cloud Run cold start plus Neon resume).
- Preview deployments on Vercel call the production API (no staging environment).

## 17. Open Questions
- None currently. Resolved decisions are logged in goal-spec.md §10.
