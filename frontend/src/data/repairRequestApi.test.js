import test from "node:test";
import assert from "node:assert/strict";
import { loadRepairRequests, updateRepairStatus } from "./repairRequestApi.js";

test("loads all pages from the authenticated API and maps persisted booking details", async (t) => {
  const calls = [];
  t.mock.method(globalThis, "fetch", async (url, options) => {
    calls.push({ url, options });
    return { ok: true, json: async () => ({
      requests: [{ id: `request-${calls.length}`, category: "Air Conditioner", shop: { name: "Assigned Shop" },
        problemDescription: "Not cooling", status: "Completed", rejectionReason: "", statusHistory: [
          { status: "Completed", createdAt: "2026-11-28T10:00:00Z" },
        ] }], pagination: { totalPages: 2 },
    }) };
  });
  const requests = await loadRepairRequests();
  assert.equal(requests.length, 2);
  assert.match(calls[1].url, /page=2/);
  assert.ok(calls.every(({ options }) => options.credentials === "include"));
  assert.equal(requests[0].shop, "Assigned Shop");
  assert.equal(requests[0].issue, "Not cooling");
  assert.equal(requests[0].status, "Completed");
  assert.equal(requests[0].updatedAt, "2026-11-28T10:00:00Z");
});

test("status changes use authenticated PATCH with the backend's canonical status", async (t) => {
  t.mock.method(globalThis, "fetch", async (url, options) => {
    assert.equal(url, "/api/repair-requests/request%2F1/status");
    assert.equal(options.method, "PATCH");
    assert.equal(options.credentials, "include");
    assert.equal(JSON.parse(options.body).status, "In Progress");
    return { ok: true, json: async () => ({ request: { status: "In Progress" } }) };
  });
  assert.equal((await updateRepairStatus("request/1", "In progress")).status, "In Progress");
});

test("rejection reasons reach the API and failed updates reject without reporting success", async (t) => {
  t.mock.method(globalThis, "fetch", async (_url, options) => {
    assert.equal(JSON.parse(options.body).rejectionReason, "No technician");
    return { ok: false, json: async () => ({ message: "This request has changed." }) };
  });
  await assert.rejects(updateRepairStatus("1", "Rejected", "No technician"), /request has changed/);
});

test("listing failures are visible instead of returning browser-only booking data", async (t) => {
  t.mock.method(globalThis, "fetch", async () => ({ ok: false, json: async () => ({ message: "Log in to view your repair requests." }) }));
  await assert.rejects(loadRepairRequests(), /Log in/);
});
