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
**Secondary: Trip participant** — a family/group member who views the itinerary the organizer built (editing/collaboration is out of scope for now — see Non-Goals).

## 4. Core Use Cases
<!-- List the top user journeys/scenarios this app must support. -->
- Create a new trip (name, dates, destination).
- Build a day-by-day itinerary: add activities/destinations to specific days with times/notes.
- View a trip's full itinerary in a clear, chronological layout.
- Edit or remove an itinerary item.
- Edit or delete a trip.

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
- Notifications, calendar sync or public trip links.
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
- Hosting: frontend on Vercel, backend (API + PostgreSQL) on AWS — details in frontend-spec.md and backend-spec.md.
- CI/CD from day one: every change goes through a pull request with automated checks (lint, type-check, tests, build) before merging to `main`, and merges to `main` deploy automatically (backend-spec.md §15).
- Assumes single-user ownership of a trip for this version; other participants are view-only (no shared editing permissions model needed yet).

## 9. Milestones / Phasing
<!-- MVP vs later phases, if applicable. -->
- **Phase 1 (MVP)**: Create trip, add/edit/remove itinerary items, view itinerary — responsive on desktop and mobile. Basic auth (single user owns their trips).
- **Phase 2 (stretch, if time allows)**: Sharing a trip as read-only, basic trip list/dashboard polish.
- **Future / explicitly deferred**: Collaboration, budgeting, recommendations, notifications (see Non-Goals).

## 10. Decisions Log
- **2026-10-03 — Auth in MVP:** yes. Email/password login with a JWT in an httpOnly cookie (backend-spec.md §7).
- **2026-10-03 — Multi-city trips in MVP:** yes, in the simplest form. The trip `destination` is an overall label, and each itinerary item has an optional free-text `city`. There is no per-city date structure.

## 11. Open Questions
<!-- Unresolved decisions to track. -->
- Now that solo travelers are in scope alongside groups/families, is the "trip participant" viewer role part of MVP, or deferred to Phase 2 along with sharing?
