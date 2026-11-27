import assert from "node:assert/strict";
import { after, before, test } from "node:test";
import express from "express";
import { PGlite } from "@electric-sql/pglite";
import { createShopsRouter } from "../src/routes/shops.js";
import { initializeShopSchema, serviceCategories } from "../src/schema/shops.js";

// PGlite executes actual PostgreSQL SQL in memory; no external database or
// application .env is needed. Only the pg connection interface is adapted.
let database;
let server;
let url;
let queryCount = 0;
let failDatabase = false;
const fixtures = [
  ["CoolTech AC Service", "Toul Kork, Phnom Penh", "Street 516", "approved", ["air-conditioner", "refrigerator"]],
  ["CoolTech AC Service", "Sen Sok", "Phnom Penh, Street 10", "approved", ["air-conditioner"]],
  ["FrostFix", "Sen Sok, Phnom Penh", "Street 20", "approved", ["refrigerator"]],
  ["Percent 100%_ Repair", "Kampot", "Lane \\ West", "approved", []],
  ["Percent 100XX Repair", "Kampot", "Lane East", "approved", []],
  ["Pending CoolTech", "Toul Kork, Phnom Penh", "Street 516", "pending", ["air-conditioner"]],
  ["Rejected CoolTech", "Toul Kork, Phnom Penh", "Street 516", "rejected", ["air-conditioner"]],
];

before(async () => {
  database = new PGlite();
  const adapter = {
    async query(sql, values) {
      queryCount++;
      if (failDatabase) throw new Error("Private database connection details");
      if (sql.includes("CREATE TABLE")) return database.exec(sql);
      return database.query(sql, values);
    },
    async connect() { return { query: adapter.query, release() {} }; },
  };
  await initializeShopSchema(adapter);
  await initializeShopSchema(adapter); // Startup is safe to repeat.
  for (const [name, location, address, status, categories] of fixtures) {
    const { rows } = await database.query(
      "INSERT INTO shops (name, location, address, status) VALUES ($1, $2, $3, $4) RETURNING id",
      [name, location, address, status],
    );
    for (const category of categories) {
      await database.query(
        "INSERT INTO shop_categories (shop_id, category_id) SELECT $1, id FROM service_categories WHERE slug = $2",
        [rows[0].id, category],
      );
    }
  }
  const app = express();
  app.use("/api", createShopsRouter(adapter));
  await new Promise((resolve) => { server = app.listen(0, "127.0.0.1", resolve); });
  url = `http://127.0.0.1:${server.address().port}/api`;
});

after(async () => {
  if (server) await new Promise((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
  if (database) await database.close();
});

async function search(params = {}) {
  const response = await fetch(`${url}/shops?${new URLSearchParams(params)}`);
  return { status: response.status, body: await response.json() };
}

test("lists only approved shops, public fields, all categories, and correct default pagination", async () => {
  const { status, body } = await search();
  assert.equal(status, 200);
  assert.deepEqual(body.pagination, { page: 1, limit: 12, total: 5, totalPages: 1 });
  assert.deepEqual(body.data.map((shop) => shop.id), ["1", "2", "3", "4", "5"]);
  assert.deepEqual(Object.keys(body.data[0]).sort(), ["address", "categories", "description", "id", "location", "name"]);
  assert.deepEqual(body.data[0].categories.map((category) => category.slug), ["air-conditioner", "refrigerator"]);
  assert.deepEqual(body.data.at(-1).categories, []);
});

for (const [label, params, ids] of [
  ["name", { name: "  cOoLtEcH  " }, ["1", "2"]],
  ["location", { location: "  tOuL kOrK " }, ["1"]],
  ["address", { location: "sTrEeT 516" }, ["1"]],
  ["location or address", { location: "PHNOM PENH" }, ["1", "2", "3"]],
  ["category including secondary support", { category: "refrigerator" }, ["1", "3"]],
  ["name + location", { name: "cool", location: "sen sok" }, ["2"]],
  ["name + category", { name: "cool", category: "refrigerator" }, ["1"]],
  ["location + category", { location: "sen sok", category: "refrigerator" }, ["3"]],
  ["all conditions", { name: "COOL", location: "toul", category: "air-conditioner" }, ["1"]],
  ["conditions combine with AND", { name: "FrostFix", location: "toul", category: "refrigerator" }, []],
  ["literal percent and underscore", { name: "100%_" }, ["4"]],
  ["literal backslash", { location: "\\" }, ["4"]],
  ["SQL injection text", { name: "' OR 1=1 --" }, []],
  ["blank filters", { name: " ", location: " ", category: " " }, ["1", "2", "3", "4", "5"]],
  ["valid category with no shops", { category: "painting" }, []],
]) {
  test(`searches ${label} using PostgreSQL`, async () => {
    const { status, body } = await search(params);
    assert.equal(status, 200);
    assert.deepEqual(body.data.map((shop) => shop.id), ids);
    assert.equal(body.pagination.total, ids.length);
  });
}

test("pagination applies after filtering, counts unique shops, and breaks equal-name ties by ID", async () => {
  const params = { name: "cool", location: "phnom", category: "air-conditioner", limit: "1" };
  const first = await search(params);
  const second = await search({ ...params, page: "2" });
  assert.deepEqual(first.body.data.map((shop) => shop.id), ["1"]);
  assert.deepEqual(second.body.data.map((shop) => shop.id), ["2"]);
  assert.deepEqual(second.body.pagination, { page: 2, limit: 1, total: 2, totalPages: 2 });
  const beyond = await search({ ...params, page: "3" });
  assert.equal(beyond.status, 200);
  assert.deepEqual(beyond.body.data, []);
  assert.deepEqual(beyond.body.pagination, { page: 3, limit: 1, total: 2, totalPages: 2 });
});

test("no matches returns 200 with zero totals", async () => {
  const { status, body } = await search({ name: "does not exist" });
  assert.equal(status, 200);
  assert.deepEqual(body, { data: [], pagination: { page: 1, limit: 12, total: 0, totalPages: 0 } });
});

test("accepts the maximum page size", async () => {
  const { status, body } = await search({ limit: "100" });
  assert.equal(status, 200);
  assert.deepEqual(body.pagination, { page: 1, limit: 100, total: 5, totalPages: 1 });
});

for (const [field, value] of [
  ["page", "0"], ["page", "-1"], ["page", "1.5"], ["page", "1e2"],
  ["page", ""], ["page", "9007199254740992"], ["page", "9007199254740991"],
  ["limit", "0"], ["limit", "101"], ["limit", "many"],
  ["name", "x".repeat(121)], ["location", "x".repeat(241)],
  ["category", "x".repeat(81)], ["name", "\0"], ["status", "pending"],
]) {
  test(`rejects invalid ${field}=${value.slice(0, 20)} before querying`, async () => {
    const beforeCount = queryCount;
    const { status, body } = await search({ [field]: value });
    assert.equal(status, 400);
    assert.equal(body.message, "Validation failed.");
    assert.ok(body.errors[field]);
    assert.equal(queryCount, beforeCount);
  });
}

test("rejects repeated and structured query parameters", async () => {
  for (const query of ["category=air-conditioner&category=refrigerator", "name=a&name=b", "limit=1&limit=2", "location[x]=a"]) {
    const beforeCount = queryCount;
    const response = await fetch(`${url}/shops?${query}`);
    assert.equal(response.status, 400);
    assert.equal(queryCount, beforeCount);
  }
});

test("rejects unknown and incorrectly cased category slugs", async () => {
  for (const category of ["unknown", "AIR-CONDITIONER", "' OR 1=1 --"]) {
    const { status, body } = await search({ category });
    assert.equal(status, 400);
    assert.ok(body.errors.category);
  }
});

test("category discovery lists each seeded category once after repeated initialization", async () => {
  const response = await fetch(`${url}/service-categories`);
  assert.equal(response.status, 200);
  const { data } = await response.json();
  assert.equal(data.length, serviceCategories.length);
  assert.deepEqual(data.find((category) => category.slug === "air-conditioner"), { slug: "air-conditioner", name: "Air Conditioner" });
});

test("new shops default to pending and never appear in the public directory", async () => {
  const { rows } = await database.query("INSERT INTO shops (name, location, address) VALUES ('Default Pending', 'Test', 'Test') RETURNING status");
  assert.equal(rows[0].status, "pending");
  assert.equal((await search({ name: "Default Pending" })).body.pagination.total, 0);
  await assert.rejects(database.query("INSERT INTO shops (name, location, address, status) VALUES ('Bad Status', 'Test', 'Test', 'public')"));
});

test("database failures return generic errors for both endpoints", async () => {
  failDatabase = true;
  try {
    for (const path of ["shops", "shops?category=air-conditioner", "service-categories"]) {
      const response = await fetch(`${url}/${path}`);
      assert.equal(response.status, 500);
      const body = await response.json();
      assert.equal(typeof body.message, "string");
      assert.equal(JSON.stringify(body).includes("Private"), false);
    }
  } finally {
    failDatabase = false;
  }
});
