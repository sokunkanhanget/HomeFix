# Shop registration API

Shop owners must be logged in with an account whose role is `owner`. The
authenticated session cookie is used to associate each registration with its
owner. Each owner can submit one registration.

`POST /api/shops/registrations` accepts JSON fields `name` and `address`
(required), plus `category`, `description`, `phone`, `email`,
`operatingHours`, and `serviceType`. A successful request returns HTTP 201 and
the persisted registration with its owner and `pending` status. Duplicate
registrations return HTTP 409.

`GET /api/shops` returns approved registrations only; pending and rejected
shops are excluded from the public results.