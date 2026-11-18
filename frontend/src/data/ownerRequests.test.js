import test from "node:test";
import assert from "node:assert/strict";
import { isEmergencyRequest, parseRequests, requestsForShop, summarizeRequests, transitionEmergencyRequest } from "./ownerRequests.js";

const shop = { id: "cooltech", name: "CoolTech AC Service" };
test("dashboard isolates a shop's bookings, including legacy records", () => {
  const requests = [
    { id: "other", shopId: "frostfix", shop: shop.name },
    { id: "legacy", shop: shop.name },
    { id: "current", shopId: shop.id, createdAt: "2026-11-18T10:00:00Z" },
    { id: "older", shopId: shop.id, createdAt: "2026-11-17T10:00:00Z" },
    { id: "unassigned" },
  ];
  assert.deepEqual(requestsForShop(requests, shop).map(({ id }) => id), ["current", "older", "legacy"]);
  assert.equal(requests[0].id, "other");
});
test("summary maps existing booking statuses and excludes cancellations", () => {
  const requests = ["Awaiting confirmation", "Incoming", "Confirmed", "Accepted", "In-progress", "In progress", "Completed", "Cancellation requested", "Cancelled"].map((status) => ({ status }));
  assert.deepEqual(summarizeRequests(requests), { Incoming: 2, Accepted: 2, "In progress": 2, Completed: 1 });
  assert.deepEqual(summarizeRequests([]), { Incoming: 0, Accepted: 0, "In progress": 0, Completed: 0 });
});
test("invalid browser data does not crash the dashboard", () => {
  for (const value of [null, "bad json", "null", "{}", '"text"']) assert.deepEqual(parseRequests(value), []);
  assert.deepEqual(parseRequests('[null, 4, {}, {"id":"valid"}]'), [{ id: "valid" }]);
});

const emergency = { id: "urgent", shopId: shop.id, shop: shop.name, priority: "emergency", status: "Awaiting confirmation" };

test("emergency page requests appear in the owner queue and can be accepted", () => {
  const request = { id: "EM-2026-123456", shop: shop.name, emergency: true, status: "Emergency - Awaiting response" };
  assert.equal(isEmergencyRequest(request), true);
  assert.deepEqual(requestsForShop([request], shop), [request]);
  assert.equal(summarizeRequests([request]).Incoming, 1);
  const accepted = transitionEmergencyRequest(request, "Accepted");
  assert.equal(accepted.status, "Accepted");
  assert.equal(accepted.notifications[0].status, "Accepted");
  assert.equal(isEmergencyRequest({ emergency: false }), false);
});

test("emergency repairs progress forward and notify the customer at every change", () => {
  let request = emergency;
  for (const status of ["Accepted", "In progress", "Completed"]) {
    request = transitionEmergencyRequest(request, status, "", "2026-11-19T10:00:00Z");
    assert.equal(request.status, status);
    assert.equal(request.notifications.at(-1).status, status);
    assert.equal(request.notifications.at(-1).read, false);
    assert.equal(request.statusHistory.at(-1).status, status);
  }
  assert.equal(request.notifications.length, 3);
  assert.equal(emergency.status, "Awaiting confirmation");
  assert.throws(() => transitionEmergencyRequest(request, "In progress"));
});

test("rejection requires a nonempty reason and shares it with the customer", () => {
  for (const reason of ["", "  "]) assert.throws(() => transitionEmergencyRequest(emergency, "Rejected", reason), /reason/);
  const rejected = transitionEmergencyRequest(emergency, "Rejected", "  No technician available  ");
  assert.equal(rejected.rejectionReason, "No technician available");
  assert.match(rejected.notifications[0].message, /No technician available/);
  assert.throws(() => transitionEmergencyRequest(rejected, "Accepted"));
});

test("stale actions, skipped stages, cancelled requests and regular requests cannot transition", () => {
  assert.throws(() => transitionEmergencyRequest(emergency, "Completed"));
  const accepted = transitionEmergencyRequest(emergency, "Accepted");
  assert.throws(() => transitionEmergencyRequest(accepted, "Accepted"));
  assert.throws(() => transitionEmergencyRequest(accepted, "Rejected", "Unavailable"));
  assert.throws(() => transitionEmergencyRequest({ ...emergency, status: "Cancellation requested" }, "Accepted"));
  assert.throws(() => transitionEmergencyRequest({ ...emergency, priority: "regular" }, "Accepted"));
  assert.equal(isEmergencyRequest({ isEmergency: true }), true);
  assert.equal(isEmergencyRequest({}), false);
});
