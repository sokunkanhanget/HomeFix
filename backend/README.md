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

**Option A: Docker.** From the repository root:

```bash
docker compose up -d db
```

This starts PostgreSQL 17 on `localhost:5432` with database, user and password
all `homefix`, which matches the `DATABASE_URL` in `.env.example`. Your data is
kept in a Docker volume between restarts.

**Option B: PostgreSQL installed on your computer** (version 14 or newer). Create
the user and database once, in `psql` or pgAdmin as the `postgres` superuser:

```sql
CREATE USER homefix WITH PASSWORD 'homefix';
CREATE DATABASE homefix OWNER homefix;
```

A hosted database such as Supabase also works: put its connection string in
`DATABASE_URL`. Connections to any host other than `localhost` use TLS.

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

`DATABASE_URL` has the form `postgresql://USER:PASSWORD@HOST:PORT/DATABASE`. If
the password contains `@`, `:`, `/` or `#`, URL-encode it (for example `@`
becomes `%40`).

### 4. Create the tables (run migrations)

```bash
cd backend
npm run migrate
```

On a new database this prints:

```
Applying migration 001_homefix_core.sql
Applying migration 002_application_tables.sql
Applied 2 migration(s). Database is up to date.
```

The server also applies pending migrations when it starts, so this step is
optional, but running it yourself shows any database problem straight away.
See [Database migrations](#database-migrations) below.

### 5. Start the server

```bash
cd backend
npm run dev     # restarts on file changes
npm start       # without watching
```

Or run `npm run dev` from the repository root to start the frontend and the
backend together. Run backend commands from `backend/` so the `.env` file is
found.

On startup the server applies any pending migrations and prints
`Database schema is up to date.` If PostgreSQL is unreachable, the server still
starts, but database features fail and the health check reports `degraded`.

### 6. Check that it works

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

### 7. Run tests

```bash
cd backend
npm run test:src
```

Tests in `src/` use stubs or in-memory PGlite and don't need PostgreSQL.

## Database migrations

The database schema is defined by the numbered SQL files in `db/migrations/`.
They are applied in number order, and each applied file is recorded in the
`schema_migrations` table so it never runs twice on the same database.

| Command (from `backend/`) | What it does |
| --- | --- |
| `npm run migrate` | Applies every pending migration. Safe to run at any time. |
| `npm run migrate:status` | Lists each migration as `applied` or `pending`. |

| File | Creates |
| --- | --- |
| `001_homefix_core.sql` | Core schema from the database design: `users`, `customers`, `user_sessions`, `repair_shops`, `service_categories`, `shop_services`, `bookings`, `booking_status_history`, `booking_photos`, `reviews`. |
| `002_application_tables.sql` | Tables the current API uses: `user_profile_photos`, `shops`, `shop_categories`, `shop_registrations`, `repair_requests`, `repair_request_photos`, `repair_request_status_history`. It also seeds the 12 service categories and allows the `owner` role. |

### Changing the schema

Never edit a migration that has already been merged: other teammates' databases
have already run it, so the change would never reach them. The runner refuses to
continue if an applied file has changed. Instead:

1. Add a new file with the next number, for example
   `db/migrations/003_add_shop_rating.sql`. Name it `NNN_short_description.sql`.
2. Write plain SQL. Do not add `BEGIN` or `COMMIT`: each file already runs in its
   own transaction.
3. Run `npm run migrate`, then commit the file.

If two branches both add `003_...`, renumber the one merged second.

### When a migration fails

The failing file's changes are rolled back, the migrations after it are not
run, and the command exits with code 1 and reports the cause, for example:

```
Migration "003_add_shop_rating.sql" failed at line 4: column "rating" of relation "shops" already exists
PostgreSQL error code: 42701
Its changes were rolled back; later migrations were not run.
```

Fix the file and run `npm run migrate` again; it continues from the failed
migration. If the server hits a failing migration on startup, it logs the same
message and starts anyway, but the features that need that migration won't work.

| Message | Fix |
| --- | --- |
| `DATABASE_URL is not set` | Create `backend/.env` from `.env.example` (step 3). |
| `connect ECONNREFUSED 127.0.0.1:5432` | PostgreSQL isn't running. Start it (step 2). |
| `password authentication failed for user "homefix"` | The user or password in `DATABASE_URL` is wrong. |
| `database "homefix" does not exist` | Create the database (step 2, option B). |
| `DATABASE_URL is not a valid connection string` | Use the form `postgresql://user:password@host:5432/database`. |
| `was changed after it was applied` | Restore the original file and put your change in a new migration. |

### Starting again with an empty database

With Docker, `docker compose down -v` deletes the database volume. Then run
`docker compose up -d db` and `npm run migrate`. Without Docker, drop and
recreate the database (step 2, option B). This deletes all data.

## Project structure

```
backend/
├── db/migrations/      Numbered SQL migrations (see Database migrations)
├── src/
│   ├── index.js        Entry point: validates config, applies migrations, starts server
│   ├── app.js          Builds the Express app (middleware, routes, error handling)
│   ├── config/         Environment (env.js) and database pool (database.js)
│   ├── db/             Migration runner (migrator.js) and its CLI (migrate.js)
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
`users.updated_at` column and `user_profile_photos` table are created by
migration `002_application_tables.sql`.

## Feature notes

Run the API from the repository root using `npm run dev:backend`. Configure
`DATABASE_URL` and `PORT` in `backend/.env` using `.env.example`, and run that
command from `backend` (`npm run dev`) so dotenv reads the backend file.
Alternatively, provide those environment variables to the root command.
PostgreSQL must be available for registration and login. The authentication
and shop tables, indexes and category catalog are created by the migrations
(see [Database migrations](#database-migrations)). The initial category catalog
matches the frontend's twelve service categories. Migrations do not insert
demonstration shops or import browser localStorage records.

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

## Repair shop listing

`GET /api/shops?page=1&limit=12` lists repair shops for customers to browse. It
is public: no login is needed.

Only shops an administrator has **approved** are listed. Pending and rejected
registrations never appear in the results or in `total`; the filter is applied in
the database query, so a client cannot request them.

| Query parameter | Rules |
| --- | --- |
| `page` | Whole number, 1 or more. Default `1`. |
| `limit` | Shops per page, from `1` to `100`. Default `12`. |

Successful response (`200`):

```json
{
  "data": [
    {
      "id": "1",
      "name": "CoolTech AC Service",
      "description": "Air conditioner repairs and cleaning.",
      "location": "Street 516, Toul Kork, Phnom Penh",
      "address": "Street 516, Toul Kork, Phnom Penh",
      "phone": "012 345 678",
      "email": "hello@cooltech.example",
      "operatingHours": "Mon-Sat 8:00-17:00",
      "serviceType": "Home service",
      "supportsEmergency": true,
      "category": "Air Conditioner",
      "categories": [
        { "slug": "air-conditioner", "name": "Air Conditioner" }
      ]
    }
  ],
  "pagination": { "page": 1, "limit": 12, "total": 1, "totalPages": 1 }
}
```

- IDs are strings. `phone`, `email`, `operatingHours` and `serviceType` are
  `null` when the shop did not provide them.
- `categories` lists the shop's supported categories. Its `slug` comes from the
  `service_categories` catalog. `category` repeats the main category's name for
  pages that filter by one category.
- Newest approved shops come first, with the ID breaking ties, so pages don't
  overlap.
- `total` counts every approved shop and `totalPages` is `total / limit` rounded
  up.

**No shops:** when there are no approved shops, the response is still `200`,
with `"data": []` and `"total": 0, "totalPages": 0`. Asking for a page after the
last one also returns `200` with `"data": []`, and `total` still shows how many
shops exist.

**Errors** use the standard error format (see [Error responses](#error-responses)).
An invalid `page` or `limit` (not a whole number, below 1, `limit` above 100, or
given twice) returns `400`:

```json
{
  "message": "Validation failed.",
  "code": "VALIDATION_ERROR",
  "errors": { "limit": "Limit must be 100 or less." }
}
```

A database failure returns `500` with a generic message and no database details.

The code follows route → controller → service → model:
`routes/shops.js` → `controllers/shopController.js` → `services/shopService.js`
→ `models/shopModel.js`. Tests: `npm run test:src` (`src/routes/shopListing.test.js`).

### Adding an approved shop for local testing

Shops come from `shop_registrations`. An owner submits one with
`POST /api/shops/registrations`, and it is listed once its status is `approved`.
To create one directly in a development database, run this in your PostgreSQL
client:

```sql
WITH owner AS (
  INSERT INTO users (name, email, password_hash, role)
  VALUES ('Example Owner', 'owner@example.com', 'not-a-real-hash', 'owner')
  RETURNING id
)
INSERT INTO shop_registrations
  (owner_id, name, category, address, description, phone, status)
SELECT id, 'CoolTech AC Service', 'Air Conditioner',
       'Street 516, Toul Kork, Phnom Penh',
       'Air conditioner repairs and cleaning.', '012 345 678', 'approved'
FROM owner;
```

The example owner can't log in (its password hash is a placeholder). Run it
once: the owner's email must be unique.

