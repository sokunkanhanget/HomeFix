# Emergency repair requests (frontend demo)

Open `/owner/emergency-requests` from the owner's **Emergency requests** navigation.

## Try the complete workflow

1. Open `/request-repair?priority=emergency` and choose a shop supporting the appliance category.
2. Enter a problem description, location, customer name and phone number, then submit.
3. Open `/owner/emergency-requests` and select the same shop in **Preview provider account**.
4. Confirm that the request shows its emergency label, contact details, appliance, problem and location.
5. Accept it, then use **Start repair** and **Mark as completed**. Each transition adds a customer notification.
6. Open `/my-repair-requests` in another tab of the same browser. Status updates sync automatically; notifications can be marked as read.
7. Submit another emergency and reject it with a reason. Confirm the customer sees the reason and rejected status.
8. Submit a regular repair and confirm it appears under booking requests without an emergency label, and stays out of the emergency queue.

The queue supports status filters, text search and summary counts. Incoming requests appear first, oldest first. The dashboard highlights emergencies awaiting a response.

## Scope

The frontend demo stores requests, status history, rejection reasons and unread notifications in `localStorage` under the existing `homefix-repair-requests` key. The backend also supports authenticated, database-backed owner listing and emergency status updates, plus a customer status lookup. The demo screens are not yet connected to those backend status endpoints; they continue to use browser storage.

Allowed owner transitions are Incoming → Accepted → In progress → Completed, or Incoming → Rejected with a nonempty reason. Repeated, backwards, skipped and terminal transitions are blocked using the latest saved request.

## Backend API

All endpoints require the existing `homefix_session` authentication cookie. Owners can list requests assigned to their approved shop with `GET /api/repair-requests`; optional `emergency=true|false` and `status=<stored status>` filters can be combined. Emergency status transitions use `PATCH /api/repair-requests/:requestId/status` with JSON `{ "status": "Accepted" }`, `{ "status": "Rejected", "rejectionReason": "..." }`, `{ "status": "In Progress" }` or `{ "status": "Completed" }`. Only the assigned shop can update an emergency request, and invalid or stale transitions are rejected. The current status, rejection reason and ordered status history are returned by the update and owner-list endpoints.

Customers can retrieve their own request's latest status and history with `GET /api/repair-requests/:requestId`. Status transitions and rejection reasons are persisted in the database. The frontend demo remains browser-only for owner actions and customer status refresh; SMS, email and cross-device notification delivery are not implemented.

## Validation

Run `npm run build` from the repository root. Run request logic tests with:

```sh
node --test frontend/src/data/ownerRequests.test.js
```
