# HomeFix backend

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
