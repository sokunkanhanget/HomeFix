import test from "node:test";
import assert from "node:assert/strict";
import { parseRequests, requestsForShop, summarizeRequests } from "./ownerRequests.js";

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
