# Goal Spec — TripForge

## 1. Overview
<!-- One paragraph: what is TripForge and why are we building it? -->
TripForge is an web application that supports both desktop and mobile devices. It helps solo/couple/friends/families plan trips together by building shared day-by-day itineraries. 

## 2. Problem Statement
<!-- What problem does this solve? Who has this problem today? -->
Planning a trip with multiple people is messy today — plans get scattered across chat threads, spreadsheets, and notes apps, with no single place to see the itinerary or agree on what's happening each day. TripForge gives a group a shared, structured itinerary so everyone can see the plan in one place.

## 3. Target Users / Personas
<!-- Who will use this app? List primary and secondary personas. -->
**Primary: Trip organizer** — the person planning a trip for self or a family or group of friends, who wants to layout destinations/activities day by day and have others see the plan.
**Secondary: Trip participant** — a family/group member who views the itinerary the organizer built, through a read-only share link. They don't need an account. Editing and collaboration are out of scope (see Non-Goals).

## 4. Core Use Cases
<!-- List the top user journeys/scenarios this app must support. -->
- Create a new trip (name, dates, destination).
- Build a day-by-day itinerary: add activities/destinations to specific days with times/notes.
- View a trip's full itinerary in a clear, chronological layout.
- Edit or remove an itinerary item.
- Edit or delete a trip.
- Share a trip as a read-only link, and revoke that link.

## 5. Goals
<!-- What must be true for this project to be considered successful? -->
- A user can create a trip and build out a complete day-by-day itinerary end to end.
- The app works as a real, usable full-stack application (frontend, backend, database, API) — not just a static mockup.
- The build follows spec-driven development: goal, frontend, backend, and API-contract specs stay the source of truth as code is written.

## 6. Non-Goals
<!-- Explicitly out of scope for this version. -->
Real-time multi-user collaboration (multiple people editing the same trip simultaneously).
- Budget/expense tracking and splitting.
- Destination/activity recommendations or search integration (maps, weather, booking APIs).
- Notifications or calendar sync.
- Per-person invitations or access control for viewers. Sharing is link-based only: anyone with the link can view the trip.
- Production concerns like horizontal scaling, multi-region hosting, or formal SLAs.

## 7. Success Metrics
<!-- How will we measure success? (e.g. adoption, engagement, performance) -->
Since this is a learning/portfolio project, success is measured by delivery and learning outcomes rather than adoption:
- End-to-end core use cases (create trip → build itinerary → view itinerary) work without manual workarounds.
- All four specs (goal, frontend, backend, api-contract) stay accurate and in sync with the implementation.
- Clean, well-structured codebase suitable to showcase in a portfolio.

## 8. Constraints & Assumptions
<!-- Technical, business, timeline, or budget constraints. Assumptions being made. -->
- Single developer, built incrementally alongside spec work.
- No fixed deadline; scope is intentionally small to stay achievable.
- Must work well on both desktop and mobile via responsive web design — no native mobile app in this version.
- Hosting: frontend on Vercel, backend API on Render, PostgreSQL on Neon — details in frontend-spec.md and backend-spec.md.
- CI/CD from day one: every change goes through a pull request with automated checks (lint, type-check, tests, build) before merging to `main`, and merges to `main` deploy automatically (backend-spec.md §15).
- Assumes single-user ownership of a trip for this version; participants view it through a read-only share link (no shared editing permissions model needed).

## 9. Milestones / Phasing
<!-- MVP vs later phases, if applicable. -->
- **Phase 1 (MVP)**: Create trip, add/edit/remove itinerary items, view itinerary, and share it read-only via a link — responsive on desktop and mobile. Basic auth (single user owns their trips).
- **Phase 2 (stretch, if time allows)**: Basic trip list/dashboard polish.
- **Future / explicitly deferred**: Collaboration, budgeting, recommendations, notifications (see Non-Goals).

## 10. Decisions Log
- **2026-10-03 — Auth in MVP:** yes. Email/password login with a JWT in an httpOnly cookie (backend-spec.md §7).
- **2026-10-03 — Multi-city trips in MVP:** yes, in the simplest form. The trip `destination` is an overall label, and each itinerary item has an optional free-text `city`. There is no per-city date structure.
- **2026-10-03 — Trip participant (viewer) role in MVP:** yes.
- **2026-10-03 — How viewers get access:** a public share link (`/shared/:slug`) with an unguessable random slug. No login is needed. The owner can revoke the link, and revoking then sharing again issues a new link.
- **2026-10-03 — Unsaved new-trip drafts:** auto-saved to `localStorage` (one per user), with Resume/Discard offered on the dashboard. Drafts are never stored on the backend (frontend-spec.md §6).
- **2026-10-03 — Dashboard ordering:** Upcoming (soonest first) and Past (most recent first) sections, split on the client. The API returns trips sorted by `startDate` ascending.
- **2026-10-03 — Trip date changes with out-of-range items:** rejected by default. An optional `shiftItems: true` moves every item by the change in start date. Items are never deleted automatically.
- **2026-10-10 — Editing a saved trip's itinerary (from manual testing):** item adds, edits, and removals on `/trips/:tripId` are held on the page until the user clicks **Update Trip**, which saves them all at once (`PUT /trips/:tripId/items`, one transaction). **Discard changes** drops them, and leaving the page with unsaved changes asks for confirmation. Previously each change was saved immediately, which testers found unclear.
- **2026-10-10 — No trips starting in the past:** a new trip's start date must be today or later, and changing an existing trip's start date cannot move it into the past. An ongoing trip whose (unchanged) start date is already past can still be edited. The frontend uses the user's local date; the backend allows one day of slack for time zones (`START_DATE_IN_PAST`).
- **2026-10-12 — Production hosting: Render + Neon instead of AWS:** the AWS account and the GCP billing account were both still waiting on activation, so the MVP deploys on free tiers that need no card: the API on a Render free web service (Docker, Singapore) and Postgres 16 on Neon free. Accepted trade-off: cold starts of ~30–60 s after idle. The Docker image stays cloud-neutral, so moving to AWS or GCP later only changes deploy config (backend-spec.md §14–15).

## 11. Open Questions
<!-- Unresolved decisions to track. -->
- None currently. Resolved decisions are logged in goal-spec.md §10.
