import test from "node:test";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import express from "express";
import { PGlite } from "@electric-sql/pglite";
import { issueAuthToken } from "../utils/authToken.js";
import { createShopRouter, initializeShopSchema } from "./shops.js";
import { createRepairRequestsRouter, initializeRepairRequestSchema } from "./repairRequests.js";

test("emergency requests require an opted-in shop and persist urgency for authorized readers", async (t) => {
  const secret = "emergency-request-database-test-secret-at-least-32-characters";
  process.env.AUTH_TOKEN_SECRET = secret;
  const db = new PGlite();
  t.after(() => db.close());
  await db.exec(`
    CREATE TABLE users (id BIGINT PRIMARY KEY, role TEXT, name TEXT, email TEXT, phone TEXT);
    CREATE TABLE user_sessions (user_id BIGINT, token_hash TEXT, expires_at TIMESTAMPTZ);
    CREATE TABLE service_categories (id BIGSERIAL PRIMARY KEY, slug TEXT NOT NULL UNIQUE, name TEXT NOT NULL UNIQUE);
    INSERT INTO service_categories (slug, name) VALUES ('air-conditioner', 'Air Conditioner');
    INSERT INTO users VALUES (1, 'customer', 'Customer', 'customer@test.com', '012345678'),
      (2, 'customer', 'Other', 'other@test.com', '012345679'),
      (3, 'owner', 'Owner', 'owner@test.com', '012345680'),
      (4, 'owner', 'Other Owner', 'owner2@test.com', '012345681');
  `);
  const database = {
    query(sql, values = []) {
      return sql.includes("CREATE TABLE") ? db.exec(sql) : db.query(sql, values);
    },
  };
  await initializeShopSchema(database);
  await initializeShopSchema(database);
  await initializeRepairRequestSchema(database);
  await initializeRepairRequestSchema(database);
  await db.exec(`
    INSERT INTO shop_registrations (id, owner_id, status, name, category, address)
    VALUES (10, 3, 'approved', 'Assigned Shop', 'Air Conditioner', 'Phnom Penh'),
      (20, 4, 'approved', 'Regular Shop', 'Air Conditioner', 'Phnom Penh');
  `);
  const tokens = {};
  for (const [id, role] of [[1, "customer"], [2, "customer"], [3, "owner"], [4, "owner"]]) {
    tokens[id] = issueAuthToken({ id: String(id), role }, secret, 120);
    await db.query("INSERT INTO user_sessions VALUES ($1, $2, NOW() + INTERVAL '2 minutes')", [
      id, createHash("sha256").update(tokens[id]).digest("hex"),
    ]);
  }
  const app = express();
  app.use(express.json());
  app.use("/api/shops", createShopRouter(database));
  app.use("/api/repair-requests", createRepairRequestsRouter(database));
  const server = app.listen(0, "127.0.0.1");
  await new Promise((resolve) => server.once("listening", resolve));
  t.after(() => new Promise((resolve) => server.close(resolve)));
  const base = `http://127.0.0.1:${server.address().port}/api`;
  async function send(user, route, method = "GET", body) {
    const multipart = body instanceof FormData;
    const response = await fetch(base + route, {
      method,
      headers: { ...(user ? { Cookie: `homefix_session=${tokens[user]}` } : {}),
        ...(!multipart && body ? { "Content-Type": "application/json" } : {}) },
      ...(body ? { body: multipart ? body : JSON.stringify(body) } : {}),
    });
    return { code: response.status, body: await response.json() };
  }
  function submit(fields, user = 1, extraFields = []) {
    const data = new FormData();
    const defaults = { requestId: "urgent", shopId: "10", category: "Air Conditioner",
      problemDescription: "The AC is leaking", applianceDetails: "Daikin", contactName: "Customer",
      contactPhone: "012345678", location: "Phnom Penh", serviceType: "Home visit",
      appointmentDate: "", appointmentTime: "", priority: "emergency", urgencyInformation: "  Water is spreading across the floor.  " };
    for (const [key, value] of Object.entries({ ...defaults, ...fields })) data.append(key, value);
    for (const [key, value] of extraFields) data.append(key, value);
    return send(user, "/repair-requests", "POST", data);
  }
  const settingRoute = "/shops/owner/emergency-service";
  assert.equal((await send(3, settingRoute)).body.shop.supportsEmergency, false);
  assert.ok((await send(null, "/shops")).body.data.every((shop) => shop.supportsEmergency === false));
  assert.equal((await submit({})).code, 400);
  assert.equal((await db.query("SELECT COUNT(*)::int AS count FROM repair_requests")).rows[0].count, 0);
  assert.equal((await send(null, settingRoute, "PATCH", { supportsEmergency: true })).code, 401);
  assert.equal((await send(1, settingRoute, "PATCH", { supportsEmergency: true })).code, 401);
  assert.equal((await send(3, settingRoute, "PATCH", { supportsEmergency: "true" })).code, 400);
  assert.equal((await send(3, settingRoute, "PATCH", { supportsEmergency: true, shopId: "20" })).code, 200);
  assert.equal((await send(4, settingRoute)).body.shop.supportsEmergency, false);
  assert.equal((await send(3, settingRoute)).body.shop.supportsEmergency, true);
  assert.equal((await db.query("SELECT supports_emergency FROM shop_registrations WHERE id = 10")).rows[0].supports_emergency, true);
  const shops = (await send(null, "/shops")).body.data;
  assert.equal(shops.find((shop) => shop.id === "10").supportsEmergency, true);
  assert.equal((await submit({}, null)).code, 401);
  assert.equal((await submit({}, 3)).code, 401);
  assert.equal((await submit({ priority: "urgent" })).code, 400);
  assert.equal((await submit({ urgencyInformation: "x".repeat(1001) })).code, 400);
  assert.equal((await submit({ priority: "regular" })).code, 400);
  assert.equal((await submit({ category: "Plumbing" })).code, 400);
  assert.equal((await submit({ shopId: "20" })).code, 400);
  await db.query("UPDATE shop_registrations SET status = 'pending' WHERE id = 10");
  assert.equal((await submit({})).code, 400);
  await db.query("UPDATE shop_registrations SET status = 'approved' WHERE id = 10");
  const created = await submit({});
  assert.equal(created.code, 201);
  assert.equal(created.body.request.emergency, true);
  assert.equal(created.body.request.status, "Pending");
  assert.equal(created.body.request.urgencyInformation, "Water is spreading across the floor.");
  const persisted = (await db.query("SELECT priority, urgency_information FROM repair_requests WHERE id = 'urgent'")).rows[0];
  assert.deepEqual(persisted, { priority: "emergency", urgency_information: "Water is spreading across the floor." });
  const customerDetail = (await send(1, "/repair-requests/urgent")).body.request;
  assert.equal(customerDetail.emergency, true);
  assert.equal(customerDetail.urgencyInformation, persisted.urgency_information);
  assert.equal((await send(2, "/repair-requests/urgent")).code, 404);
  assert.equal((await send(4, "/repair-requests?emergency=true")).body.requests.length, 0);
  assert.equal((await send(2, "/repair-requests?emergency=true")).body.requests.length, 0);
  const ownerList = (await send(3, "/repair-requests?emergency=true")).body.requests;
  assert.equal(ownerList.length, 1);
  assert.equal(ownerList[0].emergency, true);
  assert.equal(ownerList[0].urgencyInformation, persisted.urgency_information);
  assert.equal((await submit({ requestId: "optional-notes", urgencyInformation: "" })).code, 201);
  assert.equal((await submit({ requestId: "max-notes", urgencyInformation: "x".repeat(1000) })).code, 201);
  assert.equal((await submit({ requestId: "regular", shopId: "20", priority: "regular", urgencyInformation: "", appointmentDate: "2026-11-28", appointmentTime: "Morning" })).code, 201);
  assert.equal((await send(1, "/repair-requests/regular")).body.request.emergency, false);
  assert.equal((await send(3, settingRoute, "PATCH", { supportsEmergency: false })).code, 200);
  assert.equal((await submit({ requestId: "disabled" })).code, 400);
  assert.equal((await send(1, "/repair-requests/urgent")).body.request.emergency, true);
  assert.equal((await send(3, "/repair-requests/urgent/status", "PATCH", { status: "Accepted" })).code, 200);
});
