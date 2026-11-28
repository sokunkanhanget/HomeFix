# HomeFix backend

Express 5 + PostgreSQL REST API for HomeFix.

## Project setup

### Prerequisites

- Node.js 22 or newer
- PostgreSQL 14+ (or Docker, using the repository's `docker-compose.yml`)

### 1. Install dependencies

From the repository root (npm workspaces install both frontend and backend):

```bash
npm install
```

### 2. Start PostgreSQL

```bash
docker compose up -d db
```

This starts PostgreSQL on `localhost:5432` with database, user and password
`homefix`. You can use any other PostgreSQL server instead.

### 3. Configure environment variables

```bash
cp backend/.env.example backend/.env
```

Edit `backend/.env`. Sensitive settings are read only from the environment and
`backend/.env` is git-ignored, so never commit it.

| Variable | Required | Description |
| --- | --- | --- |
| `NODE_ENV` | No | `development` (default) or `production`. Production marks cookies `Secure`. |
| `PORT` | No | Port the API listens on. Default `3001`. |
| `DATABASE_URL` | Yes | PostgreSQL connection string. |
| `AUTH_TOKEN_SECRET` | Yes | Random secret, at least 32 characters, for signing login tokens. |
| `AUTH_TOKEN_EXPIRES_IN_SECONDS` | No | Login token lifetime. Default `86400`. |
| `HOMEFIX_UPLOAD_DIR` | No | Folder for repair photos. Default `backend/storage/repair-photos`. |

The server prints a warning on startup for any missing required setting.

### 4. Start the server

```bash
cd backend
npm run dev     # restarts on file changes
npm start       # without watching
```

Or run `npm run dev` from the repository root to start the frontend and the
backend together. Run backend commands from `backend/` so the `.env` file is
found.

Database tables are created automatically on startup. If PostgreSQL is
unreachable, the server still starts, but database features fail and the
health check reports `degraded`.

### 5. Check that it works

```bash
curl http://localhost:3001/api/health
```

```json
{
  "status": "ok",
  "service": "homefix-api",
  "uptimeSeconds": 12,
  "timestamp": "2026-11-28T08:00:00.000Z",
  "database": "connected"
}
```

`200` means the API and the database are working. `503` with
`"status": "degraded"` and `"database": "disconnected"` means the API is running
but cannot reach PostgreSQL.

### 6. Run tests

```bash
cd backend
npm run test:src
```

Tests in `src/` use stubs or in-memory PGlite and don't need PostgreSQL.

## Project structure

```
backend/
├── db/migrations/      SQL migrations
├── src/
│   ├── index.js        Entry point: validates config, prepares schema, starts server
│   ├── app.js          Builds the Express app (middleware, routes, error handling)
│   ├── config/         Environment (env.js) and database pool (database.js)
│   ├── routes/         URL → handler mapping; routes/index.js mounts all under /api
│   ├── controllers/    HTTP layer: read the request, call services, send the response
│   ├── services/       Business logic, independent of HTTP
│   ├── models/         Database access and table definitions
│   ├── middleware/     Authentication, 404 and error handling
│   └── utils/          Shared helpers (AppError, asyncHandler, authToken)
└── test/               Older integration tests
```

New features should follow **route → controller → service → model**. The health
check is the reference example (`routes/health.js` → `controllers/healthController.js`
→ `services/healthService.js` → `models/healthModel.js`). Register new routers
in `src/routes/index.js`.

## Error responses

Every error returns JSON in the same shape:

```json
{
  "message": "Validation failed.",
  "code": "VALIDATION_ERROR",
  "errors": { "email": "Please enter a valid email address." }
}
```

- `message`: always present and safe to show to users.
- `code`: machine-readable, for example `BAD_REQUEST`, `VALIDATION_ERROR`,
  `UNAUTHORIZED`, `FORBIDDEN`, `NOT_FOUND`, `CONFLICT`, `INVALID_JSON` or
  `INTERNAL_ERROR`.
- `errors`: only for validation errors, mapping each field to its message.

In new code, throw an `AppError` (`src/utils/AppError.js`), for example
`throw AppError.notFound("Shop not found.")` or
`throw AppError.badRequest("Validation failed.", errors)`. The central handler in
`src/middleware/errorHandler.js` formats it. Unknown routes return `404`,
malformed JSON bodies return `400`, and unexpected errors are logged on the
server and returned as a generic `500` without internal details.

## Repair shop details

`GET /api/shops/:shopId` is public and needs no login. It returns one
**approved** shop from `shop_registrations`:

```json
{
  "data": {
    "id": "10",
    "name": "CoolTech AC Service",
    "description": "AC cleaning and repair.",
    "location": "Street 516, Toul Kork, Phnom Penh",
    "address": "Street 516, Toul Kork, Phnom Penh",
    "phone": "012 345 678",
    "email": "hello@cooltech.example",
    "categories": [{ "slug": "air-conditioner", "name": "Air Conditioner" }],
    "operatingHours": "Mon-Sat 8:00-19:00",
    "serviceType": "Home service",
    "supportsEmergency": true,
    "verified": true,
    "listedSince": "2026-11-01T09:00:00.000Z"
  }
}
```

- `phone` and `email` are the shop's business contacts from its registration.
  The owner's account details (owner ID, name, email, phone) are never returned.
- Pending and rejected shops, unknown IDs and malformed IDs (`abc`, `0`, `-1`,
  oversized numbers) all return the same `404`, so the API never reveals that
  an unapproved shop exists:
  `{ "message": "Repair shop not found.", "code": "NOT_FOUND" }`.
- The frontend page `/repair-shops/<id>` loads its data from this endpoint.

## User profile

All endpoints require a login session cookie (`homefix_session`). Without one
they return `401`. The user is always identified from the session, never from
the request body or URL.

| Method & path | Description |
| --- | --- |
| `GET /api/users/me` | Your own profile. |
| `PATCH /api/users/me` | Update `name` and `phone` (JSON). |
| `PUT /api/users/me/photo` | Upload or replace your photo (multipart, field `photo`). |
| `GET /api/users/me/photo` | Your photo image. `404` if none. |
| `DELETE /api/users/me/photo` | Remove your photo. |
| `GET /api/users/:userId` | Your own profile if `:userId` is you, otherwise `403`. |

Profile response (`200`):

```json
{
  "data": {
    "id": "1",
    "name": "Sok Dara",
    "email": "dara@example.com",
    "phone": "012345678",
    "role": "customer",
    "photoUrl": "/api/users/me/photo?v=1764316800000",
    "createdAt": "2026-11-28T08:00:00.000Z",
    "updatedAt": "2026-11-28T08:30:00.000Z"
  }
}
```

`POST /api/auth/logout` deletes the current session and clears the cookie. It
always returns `200`.

`photoUrl` is `null` when no photo is uploaded. Password hashes are never returned.

Rules for `PATCH /api/users/me`:

- `name` is required, trimmed, 2–120 characters.
- `phone` is required, may contain digits, spaces, `+`, `-` and `()`, and must have 8–15 digits.
- Any other field is rejected with `400`. That includes `role` (*"Your role cannot be changed through your profile."*), `email` and `id`.

Photos must be real JPG, PNG or WebP images, checked by their content and not
the file name, and 2 MB or smaller. They are stored in the
`user_profile_photos` table, and each user can read only their own. The
`users.updated_at` column and `user_profile_photos` table are created
automatically on startup.

## Feature notes

Run the API from the repository root using `npm run dev:backend`. Configure
`DATABASE_URL` and `PORT` in `backend/.env` using `.env.example`, and run that
command from `backend` (`npm run dev`) so dotenv reads the backend file.
Alternatively, provide those environment variables to the root command.
PostgreSQL must be available for registration and login. The API initializes
the authentication and shop tables and indexes on startup. Shop schema creation
and category seeding run in a transaction and are safe to repeat. The initial
category catalog matches the frontend's twelve service categories. Startup does
not insert demonstration shops or import browser localStorage records.

## Customer registration

`POST /api/auth/register` with `Content-Type: application/json`:

```json
{
  "name": "Sok Dara",
  "email": "dara@example.com",
  "phone": "012345678",
  "password": "Password123"
}
```

All four fields are required strings. Name, email, and phone are trimmed;
email is also lowercased. Maximum lengths are 120 characters for name,
254 for email, and 40 for phone. Phone is stored as a string to preserve
leading zeroes and international prefixes. Passwords are preserved exactly
and must contain 8–128 characters, including a letter and a number.

Successful registration returns `201`:

```json
{
  "message": "Your account has been created.",
  "user": {
    "id": "1",
    "name": "Sok Dara",
    "email": "dara@example.com",
    "phone": "012345678",
    "role": "customer"
  }
}
```

The server always assigns `customer`, regardless of a submitted role. Passwords
are stored with salted scrypt hashes; neither passwords nor hashes are returned.
Registration also creates an HTTP-only session cookie. Account and session
inserts commit together; session failure rolls back the new account.

Invalid fields return `400` with all field errors:

```json
{
  "message": "Validation failed.",
  "errors": {
    "email": "Please enter a valid email address.",
    "phone": "Phone is required."
  }
}
```

An existing email returns `409` with a clear `message` and `errors.email`.
Database uniqueness ignores email case and surrounding spaces, including
concurrent inserts. Unexpected failures return `500` with a generic message.

On an existing database, the normalized unique index cannot be created if
multiple existing users share the same trimmed, lowercase email. Resolve those
duplicates before restarting; startup does not delete or merge accounts.

## Verification

Run `npm test --workspace backend` from the repository root. Authentication tests exercise
HTTP requests, validation, actual password hashing and verification, response
fields, duplicate handling, and transaction rollback. They substitute the
database boundary and do not require PostgreSQL; live database constraints
and concurrent inserts need separate verification against PostgreSQL.

Shop tests use the PGlite development dependency to execute actual PostgreSQL
queries in memory through HTTP requests. They cover schema initialization,
approval constraints, category support, all filter combinations, case-insensitive
text matching, literal wildcard characters, pagination, malformed inputs, and
database errors. No running PostgreSQL server or `.env` is needed for these tests.
Deployment connectivity and permissions still require verification against the
configured PostgreSQL server.

## Repair shop search and filters

Both endpoints are public and do not require a session.

`GET /api/shops?name=cool&location=phnom&category=air-conditioner&page=1&limit=12`

| Query parameter | Rules |
| --- | --- |
| `name` | Optional partial shop-name match, ignoring case; maximum 120 characters. |
| `location` | Optional partial match against location OR address, ignoring case; maximum 240 characters. |
| `category` | Optional exact, case-sensitive category slug; maximum 80 characters. |
| `page` | Positive decimal integer, default `1`; its calculated offset must be a safe integer. |
| `limit` | Integer from `1` to `100`, default `12`. |

Text values are trimmed; blank text values omit the corresponding condition.
Search characters `%`, `_`, and `\` match literally. Name, location, and category
conditions combine with AND. Category matching checks every supported category,
including secondary categories, and each shop appears once. Omitting all filters
lists approved shops. Pending and rejected shops never appear in results or totals;
clients cannot override the approval condition.

Successful response (`200`):

```json
{
  "data": [
    {
      "id": "1",
      "name": "CoolTech AC Service",
      "location": "Toul Kork, Phnom Penh",
      "address": "Street 516, Toul Kork, Phnom Penh",
      "description": "Air conditioner repairs and cleaning.",
      "categories": [
        { "slug": "air-conditioner", "name": "Air Conditioner" }
      ]
    }
  ],
  "pagination": { "page": 1, "limit": 12, "total": 1, "totalPages": 1 }
}
```

IDs are strings. Results are ordered by lowercase shop name, then numeric ID to
break ties. Pagination is applied after filtering, and `total` counts all matching
approved shops before pagination. The count and page use one database snapshot.
No matches returns `200` with `data: []`, `total: 0`, and `totalPages: 0`. A page
beyond the last page also returns `200` with `data: []` and retains the matching
total. Changes to the directory between requests can change offset-based pages.

Unknown category slugs, unknown query parameters, repeated parameters, null
characters, excessive text lengths, and invalid pagination return `400`:

```json
{
  "message": "Validation failed.",
  "errors": {
    "category": "Unknown service category. Use a slug from /api/service-categories."
  }
}
```

Database failures return `500` with a generic `message` and no database details.

### Category discovery

`GET /api/service-categories` returns `200` with the catalog ordered by display
name and slug:

```json
{
  "data": [
    { "slug": "air-conditioner", "name": "Air Conditioner" }
  ]
}
```

The example shows one entry; the actual response contains the full catalog.
Use the returned `slug` as the `category` parameter. Omit `category` for all
categories. A known category with no approved shops returns an empty successful
search response.

### Shop data and local development

`shops` stores shop details and status (`pending`, `approved`, or `rejected`).
New shops default to `pending`. `service_categories` stores the catalog and
`shop_categories` links each shop to one or more supported categories. Foreign
keys and a composite primary key enforce valid, unique associations. An approved
shop with no category links can appear when the category filter is omitted.

After starting the API against a development database, run this SQL in your
PostgreSQL client to create an approved example shop and its category association:

```sql
WITH example_shop AS (
  INSERT INTO shops (name, location, address, description, status)
  VALUES (
    'CoolTech AC Service', 'Toul Kork, Phnom Penh',
    'Street 516, Toul Kork, Phnom Penh',
    'Air conditioner repairs and cleaning.', 'approved'
  )
  RETURNING id
)
INSERT INTO shop_categories (shop_id, category_id)
SELECT example_shop.id, service_categories.id
FROM example_shop CROSS JOIN service_categories
WHERE service_categories.slug = 'air-conditioner';
```

Run the example once; each execution creates a new shop. Shop registration and
approval APIs and frontend integration are separate work: those features must
write to these same tables. Existing frontend fixture data and browser approvals
are not synchronized with PostgreSQL.
