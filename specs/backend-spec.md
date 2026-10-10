# Backend Spec — TripForge

## 1. Overview
<!-- Summary of the backend system and its responsibilities. -->
A REST API server that owns all persistent TripForge data. It handles user signup/login, enforces that each user can only access their own trips, stores trips and their itinerary items in PostgreSQL, and generates PDF/Excel exports of a trip's itinerary. The React SPA (see frontend-spec.md) is its only client; request/response shapes are defined in api-contract-spec.md.

## 2. Tech Stack
<!-- Language, framework, runtime, hosting. -->
- Language: TypeScript
- Framework: Express
- Runtime/Hosting: Node.js 24 LTS (`node:24-alpine` base image) in a Docker container on **AWS** (ECS Fargate behind **Amazon API Gateway** HTTP API); see §14
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
- The repo layout is planned as a monorepo: `/client` (frontend), `/server` (backend), `/specs`.

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
- Database: PostgreSQL 16 (Docker locally; **Amazon RDS for PostgreSQL** in production, in a private subnet reachable only from the ECS service)
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
- **Same-origin via Vercel rewrite:** the SPA is hosted on Vercel and calls the API at the relative path `/api/*`. A Vercel rewrite (`vercel.json`) proxies `/api/:path*` to the AWS backend. From the browser's point of view, the cookie is first-party on the Vercel domain, so `SameSite=Lax` works and browsers that block third-party cookies (e.g. Safari) don't break login.
- CORS: the browser never calls the backend's origin directly, so CORS is restricted to the Vercel production origin (and `http://localhost:5173` in local dev), with `credentials: true`. Locally, the Vite dev server proxies `/api` the same way.
- Express sets `trust proxy` so it reads the client IP (for rate limiting) and the HTTPS scheme from `X-Forwarded-*` headers set by Vercel and API Gateway.

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
- **AWS production setup** (region e.g. `ap-south-1`):
  - **ECR** stores the backend Docker image.
  - **ECS Fargate** runs the service: 1 task (0.25 vCPU / 0.5 GB), in private subnets.
  - **API Gateway (HTTP API)** is the public HTTPS entry point, using its default URL (`https://<api-id>.execute-api.<region>.amazonaws.com`). No custom domain or certificate is needed.
  - A **VPC Link** connects API Gateway privately to the ECS service, which registers its tasks in **AWS Cloud Map** for service discovery. A single `ANY /{proxy+}` route forwards every request to Express. No load balancer is needed.
  - API Gateway stage throttling (e.g. 50 req/s, burst 100) is a coarse backstop in front of the per-IP Express rate limits.
  - **RDS PostgreSQL** (`db.t4g.micro`, single-AZ) in private subnets; its security group allows port 5432 only from the ECS service.
  - **Secrets Manager** holds `DATABASE_URL` and `JWT_SECRET`, injected into the task as environment variables.
  - **CloudWatch Logs** collects the pino JSON logs from the container.
  - Infrastructure is defined as code with **AWS CDK (TypeScript)** in `/infra`.
- CI/CD details are in §15.
- `GET /health` returns `200` for ECS container health checks.
- Cost note: RDS is the main ongoing cost (API Gateway HTTP API is billed per request and is negligible at this scale) (RDS is covered by the free tier for the first 12 months on eligible accounts). Tear the stack down with `cdk destroy` when not in use.

## 15. CI/CD
All pipelines run on **GitHub Actions**. The repo is a monorepo (`/client`, `/server`, `/shared`, `/infra`), and each job runs only when its paths change.

**Branch workflow**
- `main` is protected: no direct pushes. All changes go through a pull request, and merging requires the required CI checks to pass.
- Merges use squash-merge, giving one commit per pull request on `main`.

**CI — `.github/workflows/ci.yml`** (runs on every pull request and every push to `main`)
| Job | Runs when these paths change | Steps |
|-----|------------------------------|-------|
| `server` | `server/**`, `shared/**` | install → lint → type-check → `prisma migrate deploy` against a Postgres service container → Vitest (unit + Supertest integration) |
| `client` | `client/**`, `shared/**` | install → lint → type-check → Vitest + React Testing Library → `vite build` |
| `infra` | `infra/**` | install → type-check → `cdk synth` → `cdk diff` against production, posted as a PR comment (read-only AWS role) |
| `ci-ok` | always | Gate job that passes only when every job above passed or was skipped. Branch protection requires only this check, so path filtering doesn't block merges. |

- Dependencies are cached through `actions/setup-node` (npm cache). Node 24 everywhere: CI (`node-version: 24`), the Docker image, Vercel builds, and `engines.node: ">=24 <25"` in the root `package.json`, plus an `.nvmrc` file.

**Backend CD — `.github/workflows/deploy-backend.yml`**
- Trigger: the CI workflow completes successfully on `main` and the push changed `server/**` or `shared/**`. It can also be run manually (`workflow_dispatch`).
- Steps:
  1. Build the Docker image, tagged with the git SHA.
  2. Push the image to ECR.
  3. Run `prisma migrate deploy` as a one-off ECS task using the new image. The deploy stops if the migration fails.
  4. Update the ECS service to the new task definition and wait until the service is stable.
  5. Smoke-test `GET /health` through the API Gateway URL.
- AWS access uses GitHub **OIDC**: a deploy role scoped to ECR, ECS, and passing the task role. There are no long-lived AWS keys.
- Uses a GitHub Environment named `production`, so deployments are tracked. Only one deploy runs at a time (`concurrency: deploy-backend`).
- Rollback: re-run the workflow for the previous good SHA, or point the ECS service back to the previous task definition revision. ECS deployment circuit breaker with automatic rollback is turned on.

**Infrastructure CD — `.github/workflows/deploy-infra.yml`**
- Trigger: manual only (`workflow_dispatch`). Infrastructure changes (VPC, RDS, API Gateway) are rare and risky, so they are never applied automatically on merge.
- Runs `cdk deploy` with the `production` GitHub Environment, which requires manual approval. The PR comment from the CI `infra` job shows the diff before approval.
- The RDS instance has deletion protection and `RemovalPolicy.SNAPSHOT`, so a bad CDK change can't silently delete data.

**Frontend CD** is handled by Vercel (see frontend-spec.md §13). Vercel waits for the GitHub `ci-ok` check before promoting a production deployment.

**Deploy ordering and compatibility**
- The frontend and backend deploy independently, so neither can assume the other has deployed first.
- API changes must be **backward-compatible** (add fields or endpoints; never remove or rename them in the same release). The backend ships first, and the frontend starts using the change in a later pull request. Removals happen only after the frontend no longer uses the field or endpoint.
- Database migrations must be **expand-then-contract**. Each migration must work with both the currently running code and the new code. Destructive changes (dropping or renaming columns) wait for a later release.

**Secrets**
- GitHub stores only non-secret identifiers (the AWS account ID and the role ARN) as variables. App secrets stay in AWS Secrets Manager.

## 16. Open Questions
- None currently. Resolved decisions are logged in goal-spec.md §10.
