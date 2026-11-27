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

## Repair request photos

Signed-in customers can attach up to five PNG or JPG photos (maximum 5 MB
each) when submitting a regular or emergency request, or add photos later from
the request details page. Photos are kept in a private local filesystem
directory, while the database stores each photo's request association,
original filename, content type, size, and storage key. They are never exposed
as static files: photo listing, upload, and retrieval endpoints require the
customer session, and retrieval is limited to the request's customer or its
registered shop owner.

By default, files are stored under `backend/storage/repair-photos`. Set
`HOMEFIX_UPLOAD_DIR` to a persistent, access-controlled directory in
deployments; back up this directory along with the database. Do not mount it as
a public web directory.

The API creates an authenticated request and its initial photos with
`POST /api/repair-requests` (multipart fields `requestId`, optional `shopId`,
and repeated `photos` files). Existing requests accept additional files at
`POST /api/repair-requests/:requestId/photos`. Use
`GET /api/repair-requests/:requestId/photos` for authorized photo references
and `GET /api/repair-requests/:requestId/photos/:photoId` to retrieve an image.