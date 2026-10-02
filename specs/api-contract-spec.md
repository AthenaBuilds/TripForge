# API Contract Spec — TripForge

## 1. Overview
<!-- Summary of the API surface (REST/GraphQL/etc), base URL, versioning strategy. -->
- Protocol:
- Base URL:
- Versioning strategy:

## 2. Conventions
<!-- Naming, casing, pagination, filtering, sorting conventions. -->
-

## 3. Authentication
<!-- How requests are authenticated (headers, tokens, cookies). -->
-

## 4. Common Response Envelope
<!-- Standard success/error response shape. -->
```json
{
  "data": {},
  "error": null
}
```

## 5. Error Codes
| Code | HTTP Status | Meaning |
|------|-------------|---------|
|      |             |         |

## 6. Endpoints

### 6.1 <Resource Name>
#### `GET /resource`
- **Description:**
- **Auth required:** Yes/No
- **Query params:**
- **Request body:**
- **Response body:**
```json
{}
```
- **Error cases:**

#### `POST /resource`
- **Description:**
- **Auth required:** Yes/No
- **Request body:**
```json
{}
```
- **Response body:**
```json
{}
```
- **Error cases:**

<!-- Duplicate the pattern above for each resource: trips, destinations, itineraries, users, etc. -->

## 7. Data Types / Schemas
<!-- Shared schema definitions referenced by multiple endpoints. -->
-

## 8. Rate Limiting
-

## 9. Webhooks / Callbacks (if any)
-

## 10. Open Questions
-
