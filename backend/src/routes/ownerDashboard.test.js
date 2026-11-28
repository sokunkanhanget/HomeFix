import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { after, before, test } from "node:test";
import { Router } from "express";
import { PGlite } from "@electric-sql/pglite";
import { createApp } from "../app.js";
import { runMigrations } from "../db/migrator.js";
import { issueAuthToken } from "../utils/authToken.js";
import { createOwnerDashboardRouter } from "./ownerDashboard.js";

const secret = "owner-dashboard-test-secret-at-least-32-characters";
let db;
let server;
let baseUrl;
let failQueries = false;
const tokens = {};

before(async () => {
  process.env.AUTH_TOKEN_SECRET = secret;
  db = new PGlite();
  const client = {
    async query(sql, values) {
      if (failQueries) throw new Error("connection to 10.0.0.5 failed: password for admin is wrong");
      if (values) return db.query(sql, values);
      return (await db.exec(sql)).at(-1) ?? { rows: [] };
    },
    release() {},
  };
  const database = { query: client.query, connect: async () => client };
  await runMigrations(database, { logger: { log() {} } });

  for (const [id, role] of [[1, "customer"], [2, "owner"], [3, "owner"], [4, "owner"], [5, "owner"]]) {
    await db.query(
      "INSERT INTO users (id, name, email, password_hash, role) VALUES ($1, $2, $3, 'hash', $4)",
      [id, `User ${id}`, `user${id}@example.com`, role],
    );
    tokens[id] = issueAuthToken({ id: String(id), role }, secret, 120);
    await db.query(
      "INSERT INTO user_sessions (token_hash, user_id, expires_at) VALUES ($1, $2, NOW() + INTERVAL '2 minutes')",
      [createHash("sha256").update(tokens[id]).digest("hex"), id],
    );
  }
  await db.exec(`
    INSERT INTO shop_registrations (id, owner_id, name, category, address, phone, supports_emergency, status) VALUES
      (10, 2, 'CoolTech AC Service', 'Air Conditioner', 'Toul Kork, Phnom Penh', '012345678', TRUE, 'approved'),
      (20, 3, 'Other Shop', 'Air Conditioner', 'BKK1, Phnom Penh', NULL, FALSE, 'approved'),
      (30, 4, 'Pending Shop', 'Air Conditioner', 'Sen Sok, Phnom Penh', NULL, FALSE, 'pending');
  `);
  const requests = [
    ["p1", "10", "regular", "Pending", "2026-11-20T08:00:00Z"],
    ["p2", "10", "emergency", "Pending", "2026-11-21T08:00:00Z"],
    ["a1", "10", "regular", "Accepted", "2026-11-22T08:00:00Z"],
    ["i1", "10", "emergency", "In Progress", "2026-11-23T08:00:00Z"],
    ["c1", "10", "regular", "Completed", "2026-11-24T08:00:00Z"],
    ["c2", "10", "regular", "Completed", "2026-11-25T08:00:00Z"],
    ["r1", "10", "regular", "Rejected", "2026-11-26T08:00:00Z"],
    ["x1", "10", "regular", "Cancelled", "2026-11-27T08:00:00Z"],
    ["other", "20", "emergency", "Pending", "2026-11-28T08:00:00Z"],
    ["pending-shop", "30", "regular", "Pending", "2026-11-28T08:00:00Z"],
  ];
  for (const [id, shopId, priority, status, createdAt] of requests) {
    await db.query(
      `INSERT INTO repair_requests
         (id, customer_id, shop_id, category, problem_description, contact_name, contact_phone,
          location, appointment_date, appointment_time, priority, status, created_at)
       VALUES ($1, 1, $2, 'Air Conditioner', 'Not cooling', 'Customer', '012345678',
               'Phnom Penh', '2026-12-01', '09:00', $3, $4, $5)`,
      [id, shopId, priority, status, createdAt],
    );
  }

  const api = Router();
  api.use("/shops/owner/dashboard", createOwnerDashboardRouter(database));
  server = createApp({ router: api }).listen(0, "127.0.0.1");
  await new Promise((resolve) => server.once("listening", resolve));
  baseUrl = `http://127.0.0.1:${server.address().port}/api/shops/owner/dashboard`;
});

after(async () => {
  await new Promise((resolve) => server.close(resolve));
  await db.close();
});

async function dashboard(user, query = "") {
  const response = await fetch(baseUrl + query, {
    headers: user ? { Cookie: `homefix_session=${tokens[user]}` } : {},
  });
  return { status: response.status, headers: response.headers, body: await response.json() };
}

test("returns the owner's shop, request counts, recent requests and notification support", async () => {
  const { status, headers, body } = await dashboard(2);
  assert.equal(status, 200);
  assert.equal(headers.get("cache-control"), "private, no-store");
  assert.deepEqual(body.data.shop, {
    id: "10",
    name: "CoolTech AC Service",
    category: "Air Conditioner",
    address: "Toul Kork, Phnom Penh",
    description: "",
    phone: "012345678",
    email: null,
    operatingHours: null,
    serviceType: null,
    supportsEmergency: true,
    status: "approved",
  });
  assert.deepEqual(body.data.summary, {
    totalIncoming: 8,
    pending: 2,
    accepted: 1,
    inProgress: 1,
    completed: 2,
    rejected: 1,
    cancelled: 1,
    emergency: 2,
    emergencyPending: 1,
  });
  assert.deepEqual(body.data.recentRequests.map((request) => request.id), ["x1", "r1", "c2", "c1", "i1"]);
  assert.deepEqual(body.data.recentRequests[4], {
    id: "i1",
    category: "Air Conditioner",
    problemDescription: "Not cooling",
    contactName: "Customer",
    contactPhone: "012345678",
    location: "Phnom Penh",
    serviceType: "Home visit",
    appointmentDate: "2026-12-01",
    appointmentTime: "09:00",
    priority: "emergency",
    emergency: true,
    status: "In Progress",
    createdAt: "2026-11-23T08:00:00.000Z",
  });
  assert.deepEqual(body.data.notifications, { implemented: false, unreadCount: null });
  assert.ok(Number.isFinite(Date.parse(body.data.generatedAt)));
});

test("owners only ever see their own shop's data", async () => {
  const other = await dashboard(3);
  assert.equal(other.status, 200);
  assert.equal(other.body.data.shop.id, "20");
  assert.equal(other.body.data.summary.totalIncoming, 1);
  assert.equal(other.body.data.summary.emergency, 1);
  assert.deepEqual(other.body.data.recentRequests.map((request) => request.id), ["other"]);
  const spoofed = await dashboard(3, "?shopId=10&ownerId=2");
  assert.equal(spoofed.body.data.shop.id, "20");
});

test("a shop that is not approved shows its details with no requests", async () => {
  const { status, body } = await dashboard(4);
  assert.equal(status, 200);
  assert.equal(body.data.shop.status, "pending");
  assert.equal(body.data.summary.totalIncoming, 0);
  assert.equal(body.data.summary.pending, 0);
  assert.deepEqual(body.data.recentRequests, []);
});

test("the number of recent requests can be chosen and is validated", async () => {
  assert.deepEqual((await dashboard(2, "?recent=2")).body.data.recentRequests.map((request) => request.id), ["x1", "r1"]);
  assert.equal((await dashboard(2, "?recent=20")).body.data.recentRequests.length, 8);
  for (const value of ["0", "21", "-1", "abc", "2.5", "1&recent=2"]) {
    const { status, body } = await dashboard(2, `?recent=${value}`);
    assert.equal(status, 400, value);
    assert.equal(body.code, "VALIDATION_ERROR");
    assert.match(body.errors.recent, /1 to 20/);
  }
});

test("rejects logged-out users, customers and owners without a shop", async () => {
  assert.equal((await dashboard(null)).status, 401);
  const customer = await dashboard(1);
  assert.equal(customer.status, 403);
  assert.equal(customer.body.code, "FORBIDDEN");
  const noShop = await dashboard(5);
  assert.equal(noShop.status, 404);
  assert.equal(noShop.body.message, "No shop is registered to this account.");
});

test("database failures return a generic error without internal details", async () => {
  failQueries = true;
  try {
    const { status, body } = await dashboard(2);
    assert.equal(status, 500);
    assert.equal(body.code, "INTERNAL_ERROR");
    assert.doesNotMatch(JSON.stringify(body), /10\.0\.0\.5|password/);
  } finally {
    failQueries = false;
  }
});
