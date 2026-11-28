import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { after, before, test } from "node:test";
import express from "express";
import { PGlite } from "@electric-sql/pglite";
import { runMigrations } from "../db/migrator.js";
import { issueAuthToken } from "../utils/authToken.js";
import { createRepairRequestsRouter } from "./repairRequests.js";

// GET /api/repair-requests/:requestId against the real schema (migrations
// applied to in-memory PostgreSQL). No database server or .env is needed.
const secret = "repair-request-details-test-secret-at-least-32-chars";
const REQUEST_ID = "6f1c2a4e-1b2c-4d5e-8f90-123456789abc";
const users = {
  customer: { id: 1, role: "customer" },
  otherCustomer: { id: 2, role: "customer" },
  owner: { id: 3, role: "owner" },
  otherOwner: { id: 4, role: "owner" },
};
const tokens = {};
let db;
let server;
let base;

before(async () => {
  process.env.AUTH_TOKEN_SECRET = secret;
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
      (1, 'Sok Dara', 'dara@example.com', '012345678', 'x', 'customer'),
      (2, 'Other Customer', 'other@example.com', '011111111', 'x', 'customer'),
      (3, 'Shop Owner', 'owner@example.com', '099999999', 'x', 'owner'),
      (4, 'Other Owner', 'owner2@example.com', '088888888', 'x', 'owner');
    INSERT INTO shop_registrations (id, owner_id, name, category, address, phone, status) VALUES
      (10, 3, 'CoolTech AC Service', 'Air Conditioner', 'Street 516, Toul Kork', '012 345 678', 'approved'),
      (20, 4, 'Other Shop', 'Plumbing', 'Sen Sok', '023 456 789', 'approved');
    INSERT INTO repair_requests
      (id, customer_id, shop_id, category, problem_description, appliance_details, contact_name,
       contact_phone, location, service_type, appointment_date, appointment_time, priority, status, created_at)
    VALUES
      ('${REQUEST_ID}', 1, '10', 'Air Conditioner', 'The AC is blowing warm air.', 'Daikin FTKC35',
       'Sok Dara', '012345678', 'House 12, Street 271', 'Home visit', '2026-12-01', 'Morning',
       'regular', 'Accepted', '2026-11-28T08:00:00Z'),
      ('other-shop-request', 2, '20', 'Plumbing', 'Leaking pipe.', '', 'Other Customer',
       '011111111', 'Sen Sok', 'Home visit', '', '', 'regular', 'Pending', '2026-11-28T09:00:00Z');
    INSERT INTO repair_request_photos (id, request_id, storage_key, original_name, content_type, size_bytes, created_at)
    VALUES ('11111111-1111-4111-8111-111111111111', '${REQUEST_ID}', '22222222-2222-4222-8222-222222222222',
            'ac-unit.jpg', 'image/jpeg', 2048, '2026-11-28T08:01:00Z');
    INSERT INTO repair_request_status_history (request_id, status, created_at) VALUES
      ('${REQUEST_ID}', 'Pending', '2026-11-28T08:00:00Z'),
      ('${REQUEST_ID}', 'Accepted', '2026-11-28T10:30:00Z');
  `);

  for (const [name, user] of Object.entries(users)) {
    tokens[name] = issueAuthToken({ id: String(user.id), role: user.role }, secret, 120);
    await db.query(
      "INSERT INTO user_sessions (token_hash, user_id, expires_at) VALUES ($1, $2, NOW() + INTERVAL '2 minutes')",
      [createHash("sha256").update(tokens[name]).digest("hex"), user.id],
    );
  }

  const app = express();
  app.use(express.json());
  app.use("/api/repair-requests", createRepairRequestsRouter(database));
  server = app.listen(0, "127.0.0.1");
  await new Promise((resolve) => server.once("listening", resolve));
  base = `http://127.0.0.1:${server.address().port}/api/repair-requests`;
});

after(async () => {
  await new Promise((resolve) => server.close(resolve));
  await db.close();
});

async function get(who, id = REQUEST_ID) {
  const headers = who ? { Cookie: `homefix_session=${tokens[who]}` } : {};
  const response = await fetch(`${base}/${id}`, { headers });
  return { status: response.status, body: await response.json() };
}

test("customer retrieves their own request by ID with full details", async () => {
  const { status, body } = await get("customer");
  assert.equal(status, 200);
  const request = body.request;
  assert.equal(request.id, REQUEST_ID);
  assert.equal(request.viewerAccess, "customer");

  // Appliance category and problem description
  assert.equal(request.category, "Air Conditioner");
  assert.equal(request.problemDescription, "The AC is blowing warm air.");
  assert.equal(request.applianceDetails, "Daikin FTKC35");

  // Appointment preferences
  assert.deepEqual(request.appointment, {
    preferredDate: "2026-12-01",
    preferredTime: "Morning",
    serviceType: "Home visit",
    location: "House 12, Street 271",
  });

  // Contact information and shop
  assert.equal(request.contactName, "Sok Dara");
  assert.equal(request.contactPhone, "012345678");
  assert.deepEqual(request.shop, { id: "10", name: "CoolTech AC Service" });

  // Attached photos
  assert.deepEqual(request.photos, [{
    id: "11111111-1111-4111-8111-111111111111",
    name: "ac-unit.jpg",
    contentType: "image/jpeg",
    size: 2048,
    uploadedAt: "2026-11-28T08:01:00.000Z",
    url: `/api/repair-requests/${REQUEST_ID}/photos/11111111-1111-4111-8111-111111111111`,
  }]);

  // Status and timestamps
  assert.equal(request.status, "Accepted");
  assert.equal(request.createdAt, "2026-11-28T08:00:00.000Z");
  assert.equal(request.updatedAt, "2026-11-28T10:30:00.000Z");
  assert.deepEqual(request.statusHistory.map((entry) => entry.status), ["Pending", "Accepted"]);
});

test("the owner of the selected shop retrieves the request assigned to their shop", async () => {
  const { status, body } = await get("owner");
  assert.equal(status, 200);
  assert.equal(body.request.viewerAccess, "shop_owner");
  assert.equal(body.request.problemDescription, "The AC is blowing warm air.");
  assert.equal(body.request.customer.name, "Sok Dara");
  assert.equal(body.request.photos.length, 1);
});

test("a shop owner loses access when their shop is no longer approved", async () => {
  await db.query("UPDATE shop_registrations SET status = 'rejected' WHERE id = 10");
  try {
    assert.equal((await get("owner")).status, 404);
    assert.equal((await get("customer")).status, 200, "the customer still sees their own request");
  } finally {
    await db.query("UPDATE shop_registrations SET status = 'approved' WHERE id = 10");
  }
});

test("unauthorized users cannot access the request", async () => {
  const anonymous = await get(null);
  assert.equal(anonymous.status, 401);
  assert.equal(anonymous.body.code, "UNAUTHORIZED");

  for (const who of ["otherCustomer", "otherOwner"]) {
    const { status, body } = await get(who);
    assert.equal(status, 404, who);
    assert.deepEqual(body, { message: "Repair request not found.", code: "NOT_FOUND" });
    assert.doesNotMatch(JSON.stringify(body), /AC is blowing|Sok Dara/);
  }

  const forged = await fetch(`${base}/${REQUEST_ID}`, { headers: { Cookie: "homefix_session=forged.token.value" } });
  assert.equal(forged.status, 401);
});

test("invalid IDs return 400 and unknown IDs return 404", async () => {
  for (const id of ["bad%20id", "a".repeat(101), "id.with.dots", "%27%3B--"]) {
    const { status, body } = await get("customer", id);
    assert.equal(status, 400, id);
    assert.deepEqual(body, { message: "Invalid repair request ID.", code: "INVALID_ID" });
  }
  const unknown = await get("customer", "00000000-0000-4000-8000-000000000000");
  assert.equal(unknown.status, 404);
});
