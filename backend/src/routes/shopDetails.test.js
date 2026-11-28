import assert from "node:assert/strict";
import { after, before, test } from "node:test";
import express from "express";
import { PGlite } from "@electric-sql/pglite";
import { errorHandler } from "../middleware/errorHandler.js";
import { createShopRouter, initializeShopSchema } from "./shops.js";

// Real PostgreSQL in memory (PGlite): no database server needed.
let db;
let server;
let base;

before(async () => {
  db = new PGlite();
  await db.exec(`
    CREATE TABLE users (id BIGINT PRIMARY KEY, name TEXT, email TEXT, phone TEXT, role TEXT);
    INSERT INTO users VALUES
      (1, 'Owner Secret Name', 'owner.private@example.com', '099 999 999', 'owner'),
      (2, 'Pending Owner', 'pending@example.com', '088 888 888', 'owner'),
      (3, 'Rejected Owner', 'rejected@example.com', '077 777 777', 'owner');
  `);
  const database = {
    query(sql, values = []) {
      return /CREATE TABLE|ALTER TABLE/.test(sql) ? db.exec(sql) : db.query(sql, values);
    },
  };
  await initializeShopSchema(database);
  await db.exec(`
    INSERT INTO shop_registrations
      (id, owner_id, name, category, address, description, phone, email, operating_hours,
       service_type, supports_emergency, status, reviewed_at)
    VALUES
      (10, 1, 'CoolTech AC Service', 'Air Conditioner, Refrigerator', 'Street 516, Toul Kork, Phnom Penh',
       'AC cleaning and repair.', '012 345 678', 'hello@cooltech.example', 'Mon-Sat 8:00-19:00',
       'Home service', TRUE, 'approved', '2026-11-01T09:00:00Z'),
      (20, 2, 'Pending Fixers', 'Plumbing', 'Sen Sok', '', '011 111 111', NULL, NULL, NULL, FALSE, 'pending', NULL),
      (30, 3, 'Rejected Repairs', 'Electrical', 'Daun Penh', '', '022 222 222', NULL, NULL, NULL, FALSE, 'rejected', NOW());
  `);

  const app = express();
  app.use("/api/shops", createShopRouter(database));
  app.use(errorHandler);
  server = app.listen(0, "127.0.0.1");
  await new Promise((resolve) => server.once("listening", resolve));
  base = `http://127.0.0.1:${server.address().port}/api/shops`;
});

after(async () => {
  await new Promise((resolve) => server.close(resolve));
  await db.close();
});

async function get(path) {
  const response = await fetch(base + path);
  return { status: response.status, body: await response.json() };
}

test("retrieves an approved shop by ID with its public details, without login", async () => {
  const { status, body } = await get("/10");
  assert.equal(status, 200);
  assert.deepEqual(body.data, {
    id: "10",
    name: "CoolTech AC Service",
    description: "AC cleaning and repair.",
    location: "Street 516, Toul Kork, Phnom Penh",
    address: "Street 516, Toul Kork, Phnom Penh",
    phone: "012 345 678",
    email: "hello@cooltech.example",
    categories: [
      { slug: "air-conditioner", name: "Air Conditioner" },
      { slug: "refrigerator", name: "Refrigerator" },
    ],
    operatingHours: "Mon-Sat 8:00-19:00",
    serviceType: "Home service",
    supportsEmergency: true,
    verified: true,
    listedSince: "2026-11-01T09:00:00.000Z",
  });
});

test("does not expose private owner information", async () => {
  const { body } = await get("/10");
  const text = JSON.stringify(body);
  assert.equal(body.data.owner, undefined);
  assert.equal(body.data.ownerId, undefined);
  assert.equal(body.data.owner_id, undefined);
  assert.doesNotMatch(text, /Owner Secret Name|owner\.private@example\.com|099 999 999/);
});

test("pending and rejected shops are not publicly visible", async () => {
  for (const id of ["20", "30"]) {
    const { status, body } = await get(`/${id}`);
    assert.equal(status, 404, `shop ${id}`);
    assert.deepEqual(body, { message: "Repair shop not found.", code: "NOT_FOUND" });
  }
});

test("invalid and unknown shop IDs return 404", async () => {
  for (const id of ["999", "abc", "0", "-1", "1.5", "10abc", "99999999999999999999", "%20"]) {
    const { status, body } = await get(`/${id}`);
    assert.equal(status, 404, `ID ${JSON.stringify(id)}`);
    assert.equal(body.code, "NOT_FOUND");
  }
});

test("existing shop routes still work alongside /:shopId", async () => {
  const list = await get("/");
  assert.equal(list.status, 200);
  assert.deepEqual(list.body.map((shop) => shop.id), ["10"]);

  const owner = await get("/owner/emergency-service");
  assert.equal(owner.status, 401, "owner route is not captured by /:shopId");
});
