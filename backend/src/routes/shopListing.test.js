import assert from "node:assert/strict";
import { after, before, beforeEach, test } from "node:test";
import { Router } from "express";
import { PGlite } from "@electric-sql/pglite";
import { createApp } from "../app.js";
import { runMigrations } from "../db/migrator.js";
import { createShopRouter } from "./shops.js";

// GET /api/shops against the real schema: PGlite runs actual PostgreSQL in
// memory with the project's migrations applied. No server or .env is needed.
let db;
let server;
let baseUrl;
let failQueries = false;

before(async () => {
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

  const api = Router();
  api.use("/shops", createShopRouter(database));
  server = createApp({ router: api }).listen(0, "127.0.0.1");
  await new Promise((resolve) => server.once("listening", resolve));
  baseUrl = `http://127.0.0.1:${server.address().port}/api/shops`;
});

after(() => new Promise((resolve) => server.close(resolve)));

beforeEach(async () => {
  failQueries = false;
  await db.exec("TRUNCATE shop_registrations, users RESTART IDENTITY CASCADE");
});

let ownerCount = 0;
async function addShop({ name, status = "approved", category = "Air Conditioner", submittedAt = "2026-11-01T00:00:00Z", ...rest }) {
  ownerCount += 1;
  const { rows: [owner] } = await db.query(
    "INSERT INTO users (name, email, password_hash, role) VALUES ($1, $2, 'hash', 'owner') RETURNING id",
    [`Owner ${ownerCount}`, `owner${ownerCount}@example.com`],
  );
  await db.query(
    `INSERT INTO shop_registrations
       (owner_id, name, category, address, description, phone, email, operating_hours, service_type, supports_emergency, status, submitted_at)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)`,
    [
      owner.id, name, category, rest.address ?? `${name} Street, Phnom Penh`, rest.description ?? "",
      rest.phone ?? "012345678", rest.email ?? null, rest.operatingHours ?? null, rest.serviceType ?? null,
      rest.supportsEmergency ?? false, status, submittedAt,
    ],
  );
}

async function get(query = "") {
  const response = await fetch(`${baseUrl}${query}`);
  return { status: response.status, body: await response.json() };
}

test("only approved shops are listed; pending and rejected are excluded", async () => {
  await addShop({ name: "Approved Shop" });
  await addShop({ name: "Pending Shop", status: "pending" });
  await addShop({ name: "Rejected Shop", status: "rejected" });

  const { status, body } = await get();

  assert.equal(status, 200);
  assert.deepEqual(body.data.map((shop) => shop.name), ["Approved Shop"]);
  assert.equal(body.pagination.total, 1, "pending and rejected shops are not counted either");
});

test("each shop includes name, location, contact, description and supported categories", async () => {
  await addShop({
    name: "CoolTech AC Service",
    category: "Air Conditioner",
    address: "Street 516, Toul Kork, Phnom Penh",
    description: "Air conditioner repairs and cleaning.",
    phone: "012 345 678",
    email: "hello@cooltech.example",
    operatingHours: "Mon-Sat 8:00-17:00",
    serviceType: "Home service",
    supportsEmergency: true,
  });

  const { body } = await get();

  assert.deepEqual(body.data, [{
    id: "1",
    name: "CoolTech AC Service",
    description: "Air conditioner repairs and cleaning.",
    location: "Street 516, Toul Kork, Phnom Penh",
    address: "Street 516, Toul Kork, Phnom Penh",
    phone: "012 345 678",
    email: "hello@cooltech.example",
    operatingHours: "Mon-Sat 8:00-17:00",
    serviceType: "Home service",
    supportsEmergency: true,
    category: "Air Conditioner",
    categories: [{ slug: "air-conditioner", name: "Air Conditioner" }],
  }]);
  assert.ok(!("status" in body.data[0]) && !("owner_id" in body.data[0]), "no internal fields");
});

test("categories outside the catalog still get a slug, and a missing category gives an empty list", async () => {
  await addShop({ name: "Solar Shop", category: "Solar Panels", submittedAt: "2026-11-02T00:00:00Z" });
  await addShop({ name: "No Category Shop", category: "", submittedAt: "2026-11-01T00:00:00Z" });

  const { body } = await get();

  assert.deepEqual(body.data[0].categories, [{ slug: "solar-panels", name: "Solar Panels" }]);
  assert.deepEqual(body.data[1].categories, []);
  assert.equal(body.data[1].category, null);
});

test("results are paginated, newest first, without overlaps", async () => {
  for (let day = 1; day <= 5; day += 1) {
    await addShop({ name: `Shop ${day}`, submittedAt: `2026-11-0${day}T00:00:00Z` });
  }
  await addShop({ name: "Pending Shop", status: "pending", submittedAt: "2026-11-09T00:00:00Z" });

  const pages = [];
  for (const page of [1, 2, 3]) pages.push(await get(`?page=${page}&limit=2`));

  assert.deepEqual(pages.map(({ body }) => body.data.map((shop) => shop.name)), [
    ["Shop 5", "Shop 4"], ["Shop 3", "Shop 2"], ["Shop 1"],
  ]);
  assert.deepEqual(pages[0].body.pagination, { page: 1, limit: 2, total: 5, totalPages: 3 });
  assert.deepEqual(pages[2].body.pagination, { page: 3, limit: 2, total: 5, totalPages: 3 });

  const beyond = await get("?page=4&limit=2");
  assert.equal(beyond.status, 200);
  assert.deepEqual(beyond.body, { data: [], pagination: { page: 4, limit: 2, total: 5, totalPages: 3 } });
});

test("default page size is 12 and the maximum is 100", async () => {
  for (let index = 1; index <= 13; index += 1) await addShop({ name: `Shop ${index}` });

  const first = await get();
  assert.equal(first.body.data.length, 12);
  assert.deepEqual(first.body.pagination, { page: 1, limit: 12, total: 13, totalPages: 2 });
  assert.equal((await get("?limit=100")).body.data.length, 13);
});

test("no approved shops returns 200 with an empty list and zero totals", async () => {
  await addShop({ name: "Pending Shop", status: "pending" });

  const { status, body } = await get();

  assert.equal(status, 200);
  assert.deepEqual(body, { data: [], pagination: { page: 1, limit: 12, total: 0, totalPages: 0 } });
});

test("invalid pagination returns 400 in the standard error format", async () => {
  const cases = [
    ["?page=0", "page"], ["?page=-1", "page"], ["?page=abc", "page"], ["?page=1.5", "page"],
    ["?limit=0", "limit"], ["?limit=101", "limit"], ["?limit=ten", "limit"],
    ["?page=1&page=2", "page"], ["?page=99999999999999999999", "page"],
  ];
  for (const [query, field] of cases) {
    const { status, body } = await get(query);
    assert.equal(status, 400, query);
    assert.equal(body.message, "Validation failed.", query);
    assert.equal(body.code, "VALIDATION_ERROR", query);
    assert.equal(typeof body.errors[field], "string", query);
  }
});

test("database failures return a generic 500 without internal details", async (t) => {
  t.mock.method(console, "error", () => {});
  failQueries = true;

  const { status, body } = await get();

  assert.equal(status, 500);
  assert.deepEqual(body, { message: "Something went wrong. Please try again later.", code: "INTERNAL_ERROR" });
});
