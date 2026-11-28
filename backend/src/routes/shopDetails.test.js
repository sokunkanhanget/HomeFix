import assert from "node:assert/strict";
import { after, before, test } from "node:test";
import { Router } from "express";
import { PGlite } from "@electric-sql/pglite";
import { createApp } from "../app.js";
import { runMigrations } from "../db/migrator.js";
import { createShopRouter } from "./shops.js";

// Real PostgreSQL in memory (PGlite) with the project's migrations applied:
// no database server needed.
let db;
let server;
let base;

before(async () => {
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
      (1, 'Owner Secret Name', 'owner.private@example.com', '099 999 999', 'x', 'owner'),
      (2, 'Pending Owner', 'pending@example.com', '088 888 888', 'x', 'owner'),
      (3, 'Rejected Owner', 'rejected@example.com', '077 777 777', 'x', 'owner');
  `);
  await db.exec(`
    INSERT INTO shop_registrations
      (id, owner_id, name, category, address, description, phone, email, operating_hours,
       service_type, supports_emergency, status, reviewed_at)
    VALUES
      (10, 1, 'CoolTech AC Service', 'Air Conditioner', 'Street 516, Toul Kork, Phnom Penh',
       'AC cleaning and repair.', '012 345 678', 'hello@cooltech.example', 'Mon-Sat 8:00-19:00',
       'Home service', TRUE, 'approved', '2026-11-01T09:00:00Z'),
      (20, 2, 'Pending Fixers', 'Plumbing', 'Sen Sok', '', '011 111 111', NULL, NULL, NULL, FALSE, 'pending', NULL),
      (30, 3, 'Rejected Repairs', 'Electrical', 'Daun Penh', '', '022 222 222', NULL, NULL, NULL, FALSE, 'rejected', NOW());
  `);

  const api = Router();
  api.use("/shops", createShopRouter(database));
  server = createApp({ router: api }).listen(0, "127.0.0.1");
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
    operatingHours: "Mon-Sat 8:00-19:00",
    serviceType: "Home service",
    supportsEmergency: true,
    category: "Air Conditioner",
    categories: [{ slug: "air-conditioner", name: "Air Conditioner" }],
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
  assert.deepEqual(list.body.data.map((shop) => shop.id), ["10"]);

  const owner = await get("/owner/emergency-service");
  assert.equal(owner.status, 401, "owner route is not captured by /:shopId");
});
