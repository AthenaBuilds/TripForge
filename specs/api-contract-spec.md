# API Contract Spec — TripForge

## 1. Overview
<!-- Summary of the API surface (REST/GraphQL/etc), base URL, versioning strategy. -->
- Protocol: REST over HTTPS, JSON request and response bodies. The only exception is the export endpoint, which returns a binary file.
- Base URL: `/api`, relative to the frontend origin. Vercel forwards these requests to the AWS API Gateway URL in production, and the Vite dev server forwards them to `http://localhost:3000` locally. All paths below are relative to `/api`.
- Versioning strategy: none for the MVP (single client, deployed together). If a breaking change is ever needed, a `/api/v2` prefix will be introduced, rather than changing the existing endpoints in place.

## 2. Conventions
<!-- Naming, casing, pagination, filtering, sorting conventions. -->
- Paths use plural, lowercase resource nouns (`/trips`, `/trips/:tripId/items/:itemId`). JSON fields use `camelCase`.
- IDs are UUID v4 strings.
- Dates are `YYYY-MM-DD` (calendar dates, no time zone). Times are `HH:mm` (24-hour). Timestamps (`createdAt`, `updatedAt`) are ISO 8601 UTC strings.
- `PATCH` is a partial update: omitted fields are unchanged, and nullable fields are cleared by sending `null`.
- Successful `DELETE` returns `204 No Content` with an empty body.
- No pagination, filtering, or sorting parameters in the MVP. Lists are bounded (a user's trips; at most 200 items per trip) and returned in a fixed order:
  - Trips: by `startDate` descending (upcoming and most recent first).
  - Items: by `date`, then `startTime` (items with no time come first), then `createdAt`.
- Unknown fields in request bodies are rejected with `400 VALIDATION_ERROR` (strict Zod schemas).

## 3. Authentication
<!-- How requests are authenticated (headers, tokens, cookies). -->
- Session auth uses a JWT in an httpOnly cookie named `tf_session`, set by `POST /auth/signup` and `POST /auth/login` and cleared by `POST /auth/logout`.
  - Cookie attributes: `HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=604800` (7 days). `Secure` is omitted in local dev over HTTP.
- The frontend sends every request with `credentials: 'include'` and never reads the token.
- Endpoints marked **Auth required** return `401 UNAUTHENTICATED` if the cookie is missing, expired, or invalid.
- Cross-user access: a trip or item that exists but belongs to another user returns `404 NOT_FOUND`, exactly as if it didn't exist.

## 4. Common Response Envelope
<!-- Standard success/error response shape. -->
Every JSON response uses one envelope. On success, `error` is `null`:
```json
{
  "data": { },
  "error": null
}
```
On failure, `data` is `null`:
```json
{
  "data": null,
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Request validation failed",
    "details": [
      { "field": "endDate", "message": "endDate must be on or after startDate" }
    ]
  }
}
```
- `details` is present only for `VALIDATION_ERROR` and `ITEMS_OUT_OF_RANGE`.
- `204` responses and successful export downloads have no envelope.

## 5. Error Codes
| Code | HTTP Status | Meaning |
|------|-------------|---------|
| `VALIDATION_ERROR` | 400 | Body, params, or query failed schema validation (malformed JSON, missing or extra fields, bad formats or lengths). `details` lists the failing fields. |
| `UNAUTHENTICATED` | 401 | No valid session cookie. The frontend clears its session and redirects to `/`. |
| `INVALID_CREDENTIALS` | 401 | Login failed. The message is generic: it doesn't say whether the email or the password was wrong. |
| `NOT_FOUND` | 404 | The route, trip, or item doesn't exist, or belongs to another user. |
| `EMAIL_TAKEN` | 409 | Signup with an email that is already registered. |
| `DATE_RANGE_INVALID` | 422 | `startDate > endDate`, or the trip lasts more than 60 days. |
| `ITEM_DATE_OUT_OF_RANGE` | 422 | An item's `date` falls outside its trip's dates. |
| `ITEM_TIME_INVALID` | 422 | `startTime` is after `endTime`. |
| `ITEMS_OUT_OF_RANGE` | 422 | A trip date change would leave existing items outside the new range. `details` lists the affected item ids. |
| `ITEM_LIMIT_REACHED` | 422 | The trip would exceed 200 items. |
| `RATE_LIMITED` | 429 | Too many requests. A `Retry-After` header is included. |
| `INTERNAL_ERROR` | 500 | Unexpected server error, with a generic message. |

## 6. Endpoints

### 6.1 Health
#### `GET /health`
- **Description:** Liveness check for ECS health checks and smoke tests.
- **Auth required:** No
- **Response body (200):**
```json
{ "data": { "status": "ok" }, "error": null }
```

### 6.2 Auth
#### `POST /auth/signup`
- **Description:** Create an account and start a session (sets the `tf_session` cookie).
- **Auth required:** No
- **Request body:**
```json
{ "name": "Asha Rao", "email": "asha@example.com", "password": "s3cretpass" }
```
- **Rules:**
  - `name`: 1–60 characters after trimming.
  - `email`: a valid email, stored lowercased.
  - `password`: 8–72 characters (72 is bcrypt's input limit).
- **Response body (201):** `{ "data": { "user": User }, "error": null }`
- **Error cases:** `400 VALIDATION_ERROR`, `409 EMAIL_TAKEN`, `429 RATE_LIMITED`

#### `POST /auth/login`
- **Description:** Log in and start a session (sets the `tf_session` cookie).
- **Auth required:** No
- **Request body:**
```json
{ "email": "asha@example.com", "password": "s3cretpass" }
```
- **Response body (200):** `{ "data": { "user": User }, "error": null }`
- **Error cases:** `400 VALIDATION_ERROR`, `401 INVALID_CREDENTIALS`, `429 RATE_LIMITED`

#### `POST /auth/logout`
- **Description:** End the session (clears the `tf_session` cookie). It succeeds even if there was no valid session.
- **Auth required:** No
- **Response:** `204 No Content`

#### `GET /auth/me`
- **Description:** Return the currently logged-in user. The frontend calls this when the app loads to restore the session.
- **Auth required:** Yes
- **Response body (200):** `{ "data": { "user": User }, "error": null }`
- **Error cases:** `401 UNAUTHENTICATED` (the frontend treats this as "logged out")

### 6.3 Trips
#### `GET /trips`
- **Description:** List the current user's trips for the dashboard.
- **Auth required:** Yes
- **Query params:** none
- **Response body (200):**
```json
{
  "data": {
    "trips": [
      {
        "id": "8f0c…",
        "destination": "Goa",
        "startDate": "2026-12-20",
        "endDate": "2026-12-24",
        "itemCount": 9,
        "createdAt": "2026-10-03T10:15:00.000Z",
        "updatedAt": "2026-10-03T10:15:00.000Z"
      }
    ]
  },
  "error": null
}
```
  An empty array means the frontend shows the "No trips so far" empty state.
- **Error cases:** `401 UNAUTHENTICATED`

#### `POST /trips`
- **Description:** Create a trip together with its full initial itinerary, in a single transaction. This is the "Save Trip" call from `/trips/new/itinerary`.
- **Auth required:** Yes
- **Request body:**
```json
{
  "destination": "Goa",
  "startDate": "2026-12-20",
  "endDate": "2026-12-24",
  "items": [
    {
      "title": "Check in at hotel",
      "date": "2026-12-20",
      "startTime": "14:00",
      "endTime": null,
      "location": "Candolim",
      "notes": null
    }
  ]
}
```
  `items` is optional and defaults to `[]`, with a maximum of 200. Each entry has the same shape as `ItineraryItemInput`.
- **Response body (201):** `{ "data": { "trip": TripDetail }, "error": null }`. The frontend then navigates to `/trips/:id`.
- **Error cases:**
  - `400 VALIDATION_ERROR` (item errors use `details[].field` paths like `items[3].title`)
  - `401 UNAUTHENTICATED`
  - `422 DATE_RANGE_INVALID`, `ITEM_DATE_OUT_OF_RANGE`, `ITEM_TIME_INVALID`, `ITEM_LIMIT_REACHED`

  If any check fails, nothing is saved.

#### `GET /trips/:tripId`
- **Description:** Get one trip with all its itinerary items, sorted by the item order in §2.
- **Auth required:** Yes
- **Response body (200):** `{ "data": { "trip": TripDetail }, "error": null }`
- **Error cases:** `400 VALIDATION_ERROR` (`tripId` is not a UUID), `401 UNAUTHENTICATED`, `404 NOT_FOUND`

#### `PATCH /trips/:tripId`
- **Description:** Update a trip's destination and/or dates.
- **Auth required:** Yes
- **Request body:** any subset of these fields (at least one is required):
```json
{ "destination": "North Goa", "startDate": "2026-12-19", "endDate": "2026-12-24" }
```
- **Response body (200):** `{ "data": { "trip": TripDetail }, "error": null }`
- **Error cases:**
  - `400 VALIDATION_ERROR`
  - `401 UNAUTHENTICATED`
  - `404 NOT_FOUND`
  - `422 DATE_RANGE_INVALID`
  - `422 ITEMS_OUT_OF_RANGE`, with `details` like:
```json
[{ "field": "items", "message": "2 items fall outside the new dates", "itemIds": ["…", "…"] }]
```

#### `DELETE /trips/:tripId`
- **Description:** Delete a trip and all of its items.
- **Auth required:** Yes
- **Response:** `204 No Content`
- **Error cases:** `401 UNAUTHENTICATED`, `404 NOT_FOUND`

### 6.4 Itinerary Items
#### `POST /trips/:tripId/items`
- **Description:** Add one item to an existing trip.
- **Auth required:** Yes
- **Request body:** `ItineraryItemInput`
```json
{
  "title": "Dudhsagar Falls day trip",
  "date": "2026-12-22",
  "startTime": "07:00",
  "endTime": "17:00",
  "location": "Dudhsagar",
  "notes": "Book jeep safari in advance"
}
```
- **Response body (201):** `{ "data": { "item": ItineraryItem }, "error": null }`
- **Error cases:**
  - `400 VALIDATION_ERROR`
  - `401 UNAUTHENTICATED`
  - `404 NOT_FOUND`
  - `422 ITEM_DATE_OUT_OF_RANGE`, `ITEM_TIME_INVALID`, `ITEM_LIMIT_REACHED`

#### `PATCH /trips/:tripId/items/:itemId`
- **Description:** Update an item. Accepts any subset of the `ItineraryItemInput` fields, with at least one field.
- **Auth required:** Yes
- **Request body (example):**
```json
{ "startTime": "08:00", "notes": null }
```
- **Response body (200):** `{ "data": { "item": ItineraryItem }, "error": null }`
- **Error cases:**
  - `400 VALIDATION_ERROR`
  - `401 UNAUTHENTICATED`
  - `404 NOT_FOUND` (the trip or the item doesn't exist, or the item belongs to a different trip)
  - `422 ITEM_DATE_OUT_OF_RANGE`, `ITEM_TIME_INVALID`

  The time check runs on the merged result, i.e. the item's stored values combined with the patch.

#### `DELETE /trips/:tripId/items/:itemId`
- **Description:** Remove an item.
- **Auth required:** Yes
- **Response:** `204 No Content`
- **Error cases:** `401 UNAUTHENTICATED`, `404 NOT_FOUND`

### 6.5 Export
#### `GET /trips/:tripId/export`
- **Description:** Download the trip's itinerary as a PDF or Excel file. This only works for saved trips.
- **Auth required:** Yes
- **Query params:** `format` — required, either `pdf` or `xlsx`.
- **Response (200):** the raw file, with no envelope.
  - `Content-Type`: `application/pdf` or `application/vnd.openxmlformats-officedocument.spreadsheetml.sheet`
  - `Content-Disposition: attachment; filename="tripforge-<destination-slug>-<startDate>.<pdf|xlsx>"`
- **File contents:**
  - Header: destination and date range.
  - Body: items grouped by day, each with time range, title, location, and notes. Days with no items show "Nothing planned".
  - Excel: one sheet with the columns Date, Day, Start, End, Title, Location, Notes.
- **Error cases:** `400 VALIDATION_ERROR` (missing or unknown `format`), `401 UNAUTHENTICATED`, `404 NOT_FOUND`. These errors still use the JSON envelope.
- **Frontend note:** fetch the file as a Blob and trigger the download through an object URL, so the auth cookie is sent and errors can be shown in `ErrorBanner`.

## 7. Data Types / Schemas
<!-- Shared schema definitions referenced by multiple endpoints. -->
```ts
type User = {
  id: string;            // uuid
  name: string;
  email: string;
  createdAt: string;     // ISO 8601 UTC
};

type TripSummary = {
  id: string;
  destination: string;   // 1–100 chars, trimmed
  startDate: string;     // YYYY-MM-DD
  endDate: string;       // YYYY-MM-DD, >= startDate, span ≤ 60 days
  itemCount: number;
  createdAt: string;
  updatedAt: string;
};

type TripDetail = Omit<TripSummary, "itemCount"> & {
  items: ItineraryItem[]; // sorted per §2
};

type ItineraryItemInput = {
  title: string;              // 1–120 chars, trimmed, required
  date: string;               // YYYY-MM-DD, within trip range, required
  startTime?: string | null;  // HH:mm
  endTime?: string | null;    // HH:mm, >= startTime when both set
  location?: string | null;   // ≤ 120 chars
  notes?: string | null;      // ≤ 1000 chars
};

type ItineraryItem = Required<ItineraryItemInput> & {
  id: string;
  tripId: string;
  createdAt: string;
  updatedAt: string;
};

type ApiError = {
  code: string;               // see §5
  message: string;
  details?: Array<{ field: string; message: string; [k: string]: unknown }>;
};
```
- These types live in a shared module that both `/client` and `/server` import, so the contract is defined in one place. The Zod schemas on the server are the runtime source of truth, and the TypeScript types are inferred from them with `z.infer`.

## 8. Rate Limiting
- Applied by Express per client IP (taken from `X-Forwarded-For`, with `trust proxy` set):
  - `/auth/signup` and `/auth/login`: 10 requests per minute.
  - All other endpoints: 100 requests per minute.
- When a limit is exceeded, the API returns `429 RATE_LIMITED` with a `Retry-After` header (in seconds) and the `RateLimit-*` headers (draft-7).
- API Gateway stage throttling (50 req/s, burst 100) acts as a coarse global backstop. When it triggers, API Gateway returns its own `429` without our envelope; the frontend treats any 429 as "try again shortly".

## 9. Webhooks / Callbacks (if any)
- None.

## 10. Open Questions
- The `GET /trips` order puts the newest `startDate` first. Should the dashboard instead split trips into "Upcoming" and "Past" sections (which could be done client-side from the same data)?
- Should the response to a trip date change (`PATCH /trips/:tripId`) offer to move items that would fall outside the new range (e.g. shift all items by the same offset), instead of only rejecting with `ITEMS_OUT_OF_RANGE`? This is deferred for the MVP.
- Phase 2 read-only sharing will likely add `POST /trips/:tripId/share` and a public `GET /shared/:slug`. The design is deferred.
