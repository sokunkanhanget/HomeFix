# HomeFix backend

Run the API from the repository root using `npm run dev:backend`. Configure
`DATABASE_URL` and `PORT` in `backend/.env` using `.env.example`, and run that
command from `backend` (`npm run dev`) so dotenv reads the backend file.
Alternatively, provide those environment variables to the root command.
PostgreSQL must be available for registration and login. The API initializes
the authentication tables and indexes on startup.

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

Run `npm test --workspace backend` from the repository root. Tests exercise
HTTP requests, validation, actual password hashing and verification, response
fields, duplicate handling, and transaction rollback. They substitute the
database boundary and do not require PostgreSQL; live database constraints
and concurrent inserts need separate verification against PostgreSQL.
