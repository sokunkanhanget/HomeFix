import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { after, before, test } from "node:test";
import { Router } from "express";
import { PGlite } from "@electric-sql/pglite";
import { createApp } from "../app.js";
import { runMigrations } from "../db/migrator.js";
import { issueAuthToken } from "../utils/authToken.js";
import { createAdminRouter } from "./admin.js";
import { createAuthRouter } from "./auth.js";
import { createRepairRequestsRouter } from "./repairRequests.js";
import { createShopRouter } from "./shops.js";

// End to end: the real routes run against the migrated schema in PGlite
// (in-memory PostgreSQL), and each important action must leave an entry in
// activity_logs that administrators can page through.
const secret = "activity-log-test-secret-at-least-32-characters-long";
let db;
let server;
let base;
let uploads;
const cookies = {};

async function call(who, method, route, body) {
  const headers = cookies[who] ? { Cookie: cookies[who] } : {};
  let payload;
  if (body instanceof FormData) payload = body;
  else if (body !== undefined) {
    headers["Content-Type"] = "application/json";
    payload = JSON.stringify(body);
  }
  const response = await fetch(base + route, { method, headers, body: payload });
  const text = await response.text();
  return { status: response.status, body: text ? JSON.parse(text) : null, headers: response.headers };
}

async function logs(query = "") {
  const result = await call("admin", "GET", `/admin/activity-logs${query}`);
  assert.equal(result.status, 200, JSON.stringify(result.body));
  return result.body;
}

async function sessionFor(id, role) {
  const token = issueAuthToken({ id: String(id), role }, secret, 300);
  await db.query(
    "INSERT INTO user_sessions (token_hash, user_id, expires_at) VALUES ($1, $2, NOW() + INTERVAL '5 minutes')",
    [createHash("sha256").update(token).digest("hex"), id],
  );
  return `homefix_session=${token}`;
}

function bookingForm(fields) {
  const form = new FormData();
  for (const [key, value] of Object.entries({
    shopId: "1", category: "Air Conditioner", problemDescription: "Not cooling.",
    contactName: "Sok Dara", contactPhone: "012345678", location: "Street 271",
    serviceType: "Home visit", appointmentDate: "2026-12-01", appointmentTime: "Morning",
    priority: "regular", ...fields,
  })) form.append(key, value);
  return form;
}

before(async () => {
  process.env.AUTH_TOKEN_SECRET = secret;
  uploads = await mkdtemp(path.join(tmpdir(), "homefix-activity-"));
  db = new PGlite();
  const client = {
    async query(sql, values) {
      if (values) return db.query(sql, values);
      return (await db.exec(sql)).at(-1) ?? { rows: [] };
    },
    release() {},
  };
  const database = { query: client.query, connect: async () => client };
  await runMigrations(database, { logger: { log() {} } });
  await db.exec(`
    INSERT INTO users (id, name, email, phone, password_hash, role) VALUES
      (100, 'Platform Admin', 'admin@example.com', '010000000', 'x', 'admin'),
      (101, 'Shop Owner', 'owner@example.com', '099999999', 'x', 'owner');
    SELECT setval(pg_get_serial_sequence('users', 'id'), 200);
  `);
  cookies.admin = await sessionFor(100, "admin");
  cookies.owner = await sessionFor(101, "owner");

  const api = Router();
  api.use("/auth", createAuthRouter(database));
  api.use("/shops", createShopRouter(database));
  api.use("/repair-requests", createRepairRequestsRouter(database, uploads));
  api.use("/admin", createAdminRouter(database));
  server = createApp({ router: api }).listen(0, "127.0.0.1");
  await new Promise((resolve) => server.once("listening", resolve));
  base = `http://127.0.0.1:${server.address().port}/api`;
});

after(async () => {
  await new Promise((resolve) => server.close(resolve));
  await db.close();
  await rm(uploads, { recursive: true, force: true });
});

test("important activities are recorded with actor, action, entity and timestamp", async () => {
  // User registration
  const registered = await call(null, "POST", "/auth/register", {
    name: "Sok Dara", email: "dara@example.com", phone: "012345678", password: "Password123",
  });
  assert.equal(registered.status, 201);
  cookies.customer = registered.headers.get("set-cookie").split(";")[0];
  const customerId = String(registered.body.user.id);

  // Shop registration, then approval by an administrator
  const shop = await call("owner", "POST", "/shops/registrations", {
    name: "CoolTech AC Service", category: "Air Conditioner", address: "Street 516", supportsEmergency: true,
  });
  assert.equal(shop.status, 201);
  const shopId = shop.body.registration.id;
  const approved = await call("admin", "PATCH", `/admin/shop-registrations/${shopId}`, { status: "approved" });
  assert.equal(approved.status, 200);
  assert.equal((await call("admin", "PATCH", `/admin/shop-registrations/${shopId}`, { status: "rejected" })).status, 409);

  // Emergency service setting
  assert.equal((await call("owner", "PATCH", "/shops/owner/emergency-service", { supportsEmergency: true })).status, 200);

  // Booking creation and status change
  const booking = await call("customer", "POST", "/repair-requests", bookingForm({ requestId: "booking-1", shopId }));
  assert.equal(booking.status, 201, JSON.stringify(booking.body));
  assert.equal((await call("owner", "PATCH", "/repair-requests/booking-1/status", { status: "Accepted" })).status, 200);

  // Emergency request creation and status change
  const emergency = await call("customer", "POST", "/repair-requests", bookingForm({
    requestId: "emergency-1", shopId, priority: "emergency", appointmentDate: "", appointmentTime: "",
    urgencyInformation: "Water leaking onto the floor.",
  }));
  assert.equal(emergency.status, 201, JSON.stringify(emergency.body));
  assert.equal((await call("owner", "PATCH", "/repair-requests/emergency-1/status", {
    status: "Rejected", rejectionReason: "No technician available tonight.",
  })).status, 200);

  const { data } = await logs("?limit=100");
  const byAction = Object.fromEntries(data.map((entry) => [`${entry.action}:${entry.entity.id}`, entry]));

  const userEntry = byAction[`user.registered:${customerId}`];
  assert.deepEqual(userEntry.actor, { id: customerId, role: "customer", name: "Sok Dara" });
  assert.deepEqual(userEntry.entity, { type: "user", id: customerId });
  assert.equal(userEntry.details.email, "dara@example.com");
  assert.doesNotMatch(JSON.stringify(userEntry), /Password123|password_hash|scrypt/);
  assert.ok(!Number.isNaN(Date.parse(userEntry.createdAt)));

  assert.equal(byAction[`shop.registration_submitted:${shopId}`].actor.id, "101");
  const approval = byAction[`shop.registration_approved:${shopId}`];
  assert.deepEqual(approval.actor, { id: "100", role: "admin", name: "Platform Admin" });
  assert.deepEqual(approval.details, {
    shopName: "CoolTech AC Service", ownerId: "101", previousStatus: "pending", status: "approved",
  });
  assert.equal(byAction[`shop.emergency_service_updated:${shopId}`].details.supportsEmergency, true);

  const created = byAction["booking.created:booking-1"];
  assert.equal(created.actor.id, customerId);
  assert.deepEqual(created.entity, { type: "repair_request", id: "booking-1" });
  assert.equal(created.details.priority, "regular");
  assert.deepEqual(
    { from: byAction["booking.status_changed:booking-1"].details.previousStatus, to: byAction["booking.status_changed:booking-1"].details.status },
    { from: "Pending", to: "Accepted" },
  );
  assert.equal(byAction["booking.status_changed:booking-1"].actor.role, "owner");

  assert.equal(byAction["emergency_request.created:emergency-1"].details.priority, "emergency");
  const emergencyChange = byAction["emergency_request.status_changed:emergency-1"];
  assert.equal(emergencyChange.details.status, "Rejected");
  assert.equal(emergencyChange.details.rejectionReason, "No technician available tonight.");
});

test("logs are newest first, paginated and filterable", async () => {
  const all = await logs("?limit=100");
  const total = all.pagination.total;
  assert.equal(total, 8, "one entry per action in the previous test");
  const times = all.data.map((entry) => entry.createdAt);
  assert.deepEqual([...times].sort().reverse(), times);

  const first = await logs("?page=1&limit=3");
  const second = await logs("?page=2&limit=3");
  assert.deepEqual(first.pagination, { page: 1, limit: 3, total, totalPages: Math.ceil(total / 3) });
  assert.equal(first.data.length, 3);
  assert.equal(second.data.length, 3);
  assert.equal(new Set([...first.data, ...second.data].map((entry) => entry.id)).size, 6, "pages do not overlap");
  assert.deepEqual((await logs(`?page=${first.pagination.totalPages + 1}&limit=3`)).data, []);

  const filtered = await logs("?action=booking.status_changed");
  assert.ok(filtered.data.length >= 1 && filtered.data.every((entry) => entry.action === "booking.status_changed"));
  const forRequest = await logs("?entityType=repair_request&entityId=emergency-1");
  assert.deepEqual(forRequest.data.map((entry) => entry.action).sort(), ["emergency_request.created", "emergency_request.status_changed"]);
  assert.ok((await logs("?actorId=100")).data.every((entry) => entry.actor.id === "100"));

  const invalid = await call("admin", "GET", "/admin/activity-logs?limit=500&action=hack.everything&page=0");
  assert.equal(invalid.status, 400);
  assert.ok(invalid.body.errors.limit && invalid.body.errors.action && invalid.body.errors.page);
});

test("only administrators can read logs", async () => {
  assert.equal((await call(null, "GET", "/admin/activity-logs")).status, 401);
  for (const who of ["customer", "owner"]) {
    const result = await call(who, "GET", "/admin/activity-logs");
    assert.equal(result.status, 403, who);
    assert.equal(result.body.code, "FORBIDDEN");
  }
  assert.equal((await call("customer", "PATCH", "/admin/shop-registrations/1", { status: "approved" })).status, 403);
});

test("activity logs cannot be modified through the API or in the database", async () => {
  const [entry] = (await logs("?limit=1")).data;
  for (const method of ["POST", "PUT", "PATCH", "DELETE"]) {
    const route = method === "POST" ? "/admin/activity-logs" : `/admin/activity-logs/${entry.id}`;
    for (const who of ["customer", "admin"]) {
      const result = await call(who, method, route, method === "DELETE" ? undefined : { action: "user.registered" });
      assert.equal(result.status, who === "admin" ? 405 : 403, `${who} ${method}`);
    }
  }

  await assert.rejects(db.query("UPDATE activity_logs SET action = 'user.registered' WHERE id = $1", [entry.id]), /append-only/);
  await assert.rejects(db.query("DELETE FROM activity_logs WHERE id = $1", [entry.id]), /append-only/);
  assert.equal((await logs("?limit=1")).data[0].action, entry.action, "entry unchanged");
});
