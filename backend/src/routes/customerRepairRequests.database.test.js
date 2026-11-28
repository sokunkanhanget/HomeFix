import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { after, before, test } from "node:test";
import express from "express";
import { PGlite } from "@electric-sql/pglite";
import { runMigrations } from "../db/migrator.js";
import { issueAuthToken } from "../utils/authToken.js";
import { createRepairRequestsRouter, normalizeStatusFilter } from "./repairRequests.js";

const secret = "customer-requests-test-secret-at-least-32-characters";
let db;
let server;
let baseUrl;
const tokens = {};

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

  for (const [id, role] of [[1, "customer"], [2, "customer"], [3, "owner"]]) {
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
    INSERT INTO shop_registrations (id, owner_id, name, category, address, status) VALUES
      (10, 3, 'CoolTech AC Service', 'Air Conditioner', 'Toul Kork, Phnom Penh', 'approved');
  `);
  const requests = [
    ["HF-1", 1, "10", "Air Conditioner", "Pending", "2026-11-20T08:00:00Z"],
    ["HF-2", 1, "10", "Air Conditioner", "In Progress", "2026-11-21T08:00:00Z"],
    ["HF-3", 1, "10", "Air Conditioner", "Completed", "2026-11-22T08:00:00Z"],
    ["HF-4", 1, "10", "Air Conditioner", "Pending", "2026-11-23T08:00:00Z"],
    ["HF-5", 1, "99", "Refrigerator", "Cancelled", "2026-11-24T08:00:00Z"],
    ["HF-OTHER", 2, "10", "Air Conditioner", "Pending", "2026-11-25T08:00:00Z"],
  ];
  for (const [id, customerId, shopId, category, status, createdAt] of requests) {
    await db.query(
      `INSERT INTO repair_requests
         (id, customer_id, shop_id, category, problem_description, contact_name, contact_phone,
          location, status, created_at)
       VALUES ($1, $2, $3, $4, 'Not working', 'Customer', '012345678', 'Phnom Penh', $5, $6)`,
      [id, customerId, shopId, category, status, createdAt],
    );
  }

  const app = express();
  app.use(express.json());
  app.use("/api/repair-requests", createRepairRequestsRouter(database));
  server = app.listen(0, "127.0.0.1");
  await new Promise((resolve) => server.once("listening", resolve));
  baseUrl = `http://127.0.0.1:${server.address().port}/api/repair-requests`;
});

after(async () => {
  await new Promise((resolve) => server.close(resolve));
  await db.close();
});

async function list(user, query = "") {
  const response = await fetch(baseUrl + query, {
    headers: user ? { Cookie: `homefix_session=${tokens[user]}` } : {},
  });
  return { status: response.status, body: await response.json() };
}

const ids = (body) => body.requests.map((request) => request.id);

test("an authenticated customer retrieves only their own requests, newest first", async () => {
  const { status, body } = await list(1);
  assert.equal(status, 200);
  assert.deepEqual(ids(body), ["HF-5", "HF-4", "HF-3", "HF-2", "HF-1"]);
  assert.ok(body.requests.every((request) => request.customerId === "1"));
  assert.deepEqual(body.pagination, { page: 1, limit: 20, total: 5, totalPages: 1 });
  assert.deepEqual(body.filters, { status: null, order: "desc" });

  const other = await list(2);
  assert.deepEqual(ids(other.body), ["HF-OTHER"]);
});

test("each request includes its ID, shop, appliance, creation date and status", async () => {
  const request = (await list(1)).body.requests.find((item) => item.id === "HF-2");
  assert.equal(request.id, "HF-2");
  assert.deepEqual(request.shop, { id: "10", name: "CoolTech AC Service" });
  assert.equal(request.appliance, "Air Conditioner");
  assert.equal(request.createdAt, "2026-11-21T08:00:00.000Z");
  assert.equal(request.status, "In Progress");
});

test("requests whose shop registration no longer exists are still listed", async () => {
  const request = (await list(1)).body.requests.find((item) => item.id === "HF-5");
  assert.deepEqual(request.shop, { id: "99", name: null });
  assert.equal(request.appliance, "Refrigerator");
});

test("requests can be filtered by status, written in any common form", async () => {
  for (const value of ["Pending", "pending", "PENDING"]) {
    const { status, body } = await list(1, `?status=${value}`);
    assert.equal(status, 200);
    assert.deepEqual(ids(body), ["HF-4", "HF-1"]);
    assert.equal(body.pagination.total, 2);
    assert.equal(body.filters.status, "Pending");
  }
  for (const value of ["In%20Progress", "in_progress", "in-progress"]) {
    assert.deepEqual(ids((await list(1, `?status=${value}`)).body), ["HF-2"]);
  }
  assert.deepEqual(ids((await list(1, "?status=Rejected")).body), []);
  for (const value of ["Unknown", "", "Pending&status=Completed"]) {
    const { status, body } = await list(1, `?status=${value}`);
    assert.equal(status, 400, value);
    assert.match(body.message, /Status must be one of/);
  }
});

test("requests are paginated and can be ordered oldest first", async () => {
  const first = await list(1, "?page=1&limit=2");
  assert.deepEqual(ids(first.body), ["HF-5", "HF-4"]);
  assert.deepEqual(first.body.pagination, { page: 1, limit: 2, total: 5, totalPages: 3 });
  assert.deepEqual(ids((await list(1, "?page=3&limit=2")).body), ["HF-1"]);
  assert.deepEqual(ids((await list(1, "?page=4&limit=2")).body), []);

  assert.deepEqual(ids((await list(1, "?order=asc")).body), ["HF-1", "HF-2", "HF-3", "HF-4", "HF-5"]);
  assert.deepEqual(ids((await list(1, "?order=asc&status=pending&limit=1&page=2")).body), ["HF-4"]);
  for (const query of ["?order=newest", "?page=0", "?limit=101"]) {
    assert.equal((await list(1, query)).status, 400, query);
  }
});

test("customers cannot retrieve another customer's requests", async () => {
  assert.equal((await list(null)).status, 401);
  const spoofed = await list(2, "?customerId=1&customer_id=1");
  assert.deepEqual(ids(spoofed.body), ["HF-OTHER"]);
  const response = await fetch(`${baseUrl}/HF-1`, { headers: { Cookie: `homefix_session=${tokens[2]}` } });
  assert.equal(response.status, 404);
});

test("status filter values are normalized to the stored statuses", () => {
  assert.equal(normalizeStatusFilter(" in progress "), "In Progress");
  assert.equal(normalizeStatusFilter("CANCELLED"), "Cancelled");
  assert.equal(normalizeStatusFilter("done"), null);
  assert.equal(normalizeStatusFilter(["Pending"]), null);
});
