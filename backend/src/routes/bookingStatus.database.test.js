import test from "node:test";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import express from "express";
import { PGlite } from "@electric-sql/pglite";
import { issueAuthToken } from "../authToken.js";
import { createRepairRequestsRouter, initializeRepairRequestSchema } from "./repairRequests.js";

test("booking status persists with ownership, valid transitions, history, customer isolation and rollback", async (t) => {
  const secret = "booking-status-database-test-secret-at-least-32-characters";
  process.env.AUTH_TOKEN_SECRET = secret;
  const db = new PGlite();
  t.after(() => db.close());
  await db.exec(`
    CREATE TABLE users (id BIGINT PRIMARY KEY, role TEXT, name TEXT, email TEXT, phone TEXT);
    CREATE TABLE user_sessions (user_id BIGINT, token_hash TEXT, expires_at TIMESTAMPTZ);
    CREATE TABLE shop_registrations (id BIGINT PRIMARY KEY, owner_id BIGINT, status TEXT, name TEXT);
    INSERT INTO users VALUES (1, 'customer', 'Customer', 'customer@test.com', '012345678'),
      (2, 'customer', 'Other', 'other@test.com', '012345679'),
      (3, 'owner', 'Owner', 'owner@test.com', '012345680'),
      (4, 'owner', 'Other Owner', 'owner2@test.com', '012345681');
    INSERT INTO shop_registrations VALUES (10, 3, 'approved', 'Assigned Shop'),
      (20, 4, 'approved', 'Other Shop'), (30, 3, 'pending', 'Unapproved Shop');
  `);
  let failHistory = false;
  const database = {
    async query(sql, values) {
      if (failHistory && sql.includes("INSERT INTO repair_request_status_history")) throw new Error("History unavailable");
      return values ? db.query(sql, values) : db.exec(sql);
    },
  };
  await initializeRepairRequestSchema(database);
  await initializeRepairRequestSchema(database);
  const tokens = {};
  for (const [id, role] of [[1, "customer"], [2, "customer"], [3, "owner"], [4, "owner"]]) {
    tokens[id] = issueAuthToken({ id: String(id), role }, secret, 120);
    await db.query("INSERT INTO user_sessions VALUES ($1, $2, NOW() + INTERVAL '2 minutes')", [
      id, createHash("sha256").update(tokens[id]).digest("hex"),
    ]);
  }
  for (const [id, customer, shop, priority] of [
    ["regular", 1, 10, "regular"], ["reject", 1, 10, "regular"],
    ["rollback", 1, 10, "regular"], ["other-customer", 2, 10, "regular"],
    ["other-shop", 1, 20, "regular"], ["unapproved", 1, 30, "regular"],
    ["emergency", 1, 10, "emergency"], ["cancel", 1, 10, "regular"],
  ]) {
    await db.query(`INSERT INTO repair_requests
      (id, customer_id, shop_id, category, problem_description, contact_name, contact_phone, location, priority)
      VALUES ($1, $2, $3, 'Air Conditioner', 'Not cooling', 'Customer', '012345678', 'Phnom Penh', $4)`,
    [id, customer, String(shop), priority]);
  }
  const app = express();
  app.use(express.json());
  app.use("/requests", createRepairRequestsRouter(database));
  const server = app.listen(0, "127.0.0.1");
  await new Promise((resolve) => server.once("listening", resolve));
  t.after(() => new Promise((resolve) => server.close(resolve)));
  const base = `http://127.0.0.1:${server.address().port}/requests`;
  async function send(user, route, body) {
    const response = await fetch(base + route, {
      method: body ? "PATCH" : "GET",
      headers: { ...(user ? { Cookie: `homefix_session=${tokens[user]}` } : {}), "Content-Type": "application/json" },
      ...(body ? { body: JSON.stringify(body) } : {}),
    });
    return { code: response.status, body: await response.json() };
  }
  const change = (user, id, status, extra = {}) => send(user, `/${id}/status`, { status, ...extra });
  assert.equal((await change(null, "regular", "Accepted")).code, 401);
  assert.equal((await change(1, "regular", "Accepted")).code, 403);
  assert.equal((await change(4, "regular", "Accepted")).code, 404);
  assert.equal((await change(3, "unapproved", "Accepted")).code, 404);
  assert.equal((await change(3, "regular", "Completed")).code, 409);
  assert.equal((await change(3, "regular", "Unknown")).code, 400);
  for (const status of ["Accepted", "In Progress", "Completed"]) {
    const changed = await change(3, "regular", status);
    assert.equal(changed.code, 200);
    assert.equal(changed.body.request.status, status);
    assert.equal(changed.body.request.emergency, false);
    assert.equal((await db.query("SELECT status FROM repair_requests WHERE id = 'regular'")).rows[0].status, status);
    assert.equal((await send(1, "/regular")).body.request.status, status);
  }
  for (const status of ["Accepted", "Rejected", "In Progress", "Completed"]) {
    assert.equal((await change(3, "regular", status, { rejectionReason: "Unavailable" })).code, 409);
  }
  const history = (await send(1, "/regular")).body.request.statusHistory;
  assert.deepEqual(history.map((entry) => entry.status), ["Accepted", "In Progress", "Completed"]);
  assert.ok(history.every((entry) => Number.isFinite(Date.parse(entry.createdAt))));
  assert.equal((await change(3, "reject", "Rejected", { rejectionReason: " " })).code, 400);
  assert.equal((await change(3, "reject", "Rejected", { rejectionReason: "x".repeat(501) })).code, 400);
  assert.equal((await change(3, "reject", "Rejected", { rejectionReason: "  No technician  " })).code, 200);
  const rejected = (await send(1, "/reject")).body.request;
  assert.equal(rejected.rejectionReason, "No technician");
  assert.equal(rejected.statusHistory[0].rejectionReason, "No technician");
  assert.equal((await change(3, "reject", "Accepted")).code, 409);
  assert.equal((await send(2, "/regular")).code, 404);
  const customerList = (await send(1, "/")).body.requests;
  assert.ok(customerList.some((request) => request.id === "regular" && request.status === "Completed"));
  assert.ok(customerList.every((request) => request.customerId === "1"));
  assert.equal((await send(2, "/")).body.requests.length, 1);
  assert.ok((await send(3, "/")).body.requests.every((request) => request.shopId === "10"));
  assert.equal((await change(3, "emergency", "Accepted")).body.request.emergency, true);
  failHistory = true;
  assert.equal((await change(3, "rollback", "Accepted")).code, 500);
  failHistory = false;
  assert.equal((await send(1, "/rollback")).body.request.status, "Pending");
  assert.equal((await send(1, "/rollback")).body.request.statusHistory.length, 0);
  assert.equal((await change(2, "cancel", "Cancelled", { cancellationReason: "Fixed" })).code, 404);
  assert.equal((await change(1, "cancel", "Cancelled", { cancellationReason: "Fixed" })).code, 200);
  assert.equal((await change(3, "cancel", "Accepted")).code, 409);
});
