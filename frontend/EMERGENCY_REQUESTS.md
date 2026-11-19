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

Requests, status history, rejection reasons and unread notifications persist in `localStorage` under the existing `homefix-repair-requests` key. Same-tab events and browser storage events refresh open views. Updates save the status and notification together before displaying success.

Allowed owner transitions are Incoming → Accepted → In progress → Completed, or Incoming → Rejected with a nonempty reason. Repeated, backwards, skipped and terminal transitions are blocked using the latest saved request.

This follows the existing browser-only demo model: the owner selector scopes requests by shop, while the customer page displays this browser's requests. Production needs authenticated owner/customer identities, server-side authorization, a shared database, concurrency handling and a notification delivery service. SMS, email and cross-device delivery are not implemented.

## Validation

Run `npm run build` from the repository root. Run request logic tests with:

```sh
node --test frontend/src/data/ownerRequests.test.js
```
