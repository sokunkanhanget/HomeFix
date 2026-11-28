import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { after, before, beforeEach, test } from "node:test";
import { Router } from "express";
import { PGlite } from "@electric-sql/pglite";
import { createApp } from "../app.js";
import { runMigrations } from "../db/migrator.js";
import { issueAuthToken } from "../utils/authToken.js";
import { createOwnerCategoriesRouter, createServiceCategoriesRouter } from "./shopCategories.js";
import { createShopRouter } from "./shops.js";
import { createRepairRequestsRouter } from "./repairRequests.js";

const secret = "shop-categories-test-secret-at-least-32-characters";
let db;
let database;
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
  database = { query: client.query, connect: async () => client };
  await runMigrations(database, { logger: { log() {} } });

  for (const [id, role] of [[1, "customer"], [2, "owner"], [3, "owner"], [4, "owner"], [5, "owner"]]) {
    await db.query(
      "INSERT INTO users (id, name, email, password_hash, role) VALUES ($1, $2, $3, 'hash', $4)",
      [id, `User ${id}`, `user${id}@example.com`, role],
    );
    tokens[id] = issueAuthToken({ id: String(id), role }, secret, 600);
    await db.query(
      "INSERT INTO user_sessions (token_hash, user_id, expires_at) VALUES ($1, $2, NOW() + INTERVAL '10 minutes')",
      [createHash("sha256").update(tokens[id]).digest("hex"), id],
    );
  }

  const api = Router();
  api.use("/shops/owner/categories", createOwnerCategoriesRouter(database));
  api.use("/service-categories", createServiceCategoriesRouter(database));
  api.use("/shops", createShopRouter(database));
  api.use("/repair-requests", createRepairRequestsRouter(database));
  server = createApp({ router: api }).listen(0, "127.0.0.1");
  await new Promise((resolve) => server.once("listening", resolve));
  baseUrl = `http://127.0.0.1:${server.address().port}/api`;
});

after(async () => {
  await new Promise((resolve) => server.close(resolve));
  await db.close();
});

beforeEach(async () => {
  failQueries = false;
  await db.exec(`
    TRUNCATE repair_requests, shop_registrations RESTART IDENTITY CASCADE;
    INSERT INTO shop_registrations (id, owner_id, name, category, address, status) VALUES
      (10, 2, 'CoolTech AC Service', 'Air Conditioner', 'Toul Kork, Phnom Penh', 'approved'),
      (20, 3, 'AquaPro Plumbing', 'Plumbing', 'BKK1, Phnom Penh', 'approved'),
      (30, 4, 'Pending Shop', 'Refrigerator', 'Sen Sok, Phnom Penh', 'pending');
  `);
});

async function send(user, path, method = "GET", body) {
  const response = await fetch(baseUrl + path, {
    method,
    headers: {
      ...(user ? { Cookie: `homefix_session=${tokens[user]}` } : {}),
      ...(body ? { "Content-Type": "application/json" } : {}),
    },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });
  return { status: response.status, body: await response.json() };
}

const slugs = (body) => body.data.categories.map((category) => category.slug);

async function storedSlugs(registrationId) {
  const { rows } = await db.query(
    `SELECT service_categories.slug FROM shop_registration_categories
     JOIN service_categories ON service_categories.id = shop_registration_categories.category_id
     WHERE registration_id = $1 ORDER BY service_categories.id`,
    [registrationId],
  );
  return rows.map((row) => row.slug);
}

test("the API returns every available service category", async () => {
  const { status, body } = await send(null, "/service-categories");
  assert.equal(status, 200);
  assert.equal(body.data.length, 12);
  assert.deepEqual(body.data[0], { slug: "air-conditioner", name: "Air Conditioner" });
  assert.ok(body.data.some((category) => category.slug === "plumbing" && category.name === "Plumbing"));
});

test("an owner sees their shop's current categories, starting from the registered category", async () => {
  const { status, body } = await send(2, "/shops/owner/categories");
  assert.equal(status, 200);
  assert.deepEqual(body.data, { shopId: "10", categories: [{ slug: "air-conditioner", name: "Air Conditioner" }] });
});

test("an owner can select multiple categories and the selection is saved", async () => {
  const { status, body } = await send(2, "/shops/owner/categories", "PUT", {
    categories: ["refrigerator", "Air Conditioner", " PLUMBING "],
  });
  assert.equal(status, 200);
  assert.equal(body.message, "Supported categories saved.");
  assert.deepEqual(slugs(body), ["air-conditioner", "refrigerator", "plumbing"]);
  assert.deepEqual(await storedSlugs(10), ["air-conditioner", "refrigerator", "plumbing"]);
  assert.deepEqual(slugs((await send(2, "/shops/owner/categories")).body), ["air-conditioner", "refrigerator", "plumbing"]);

  const replaced = await send(2, "/shops/owner/categories", "PUT", { categories: ["electrical"] });
  assert.deepEqual(slugs(replaced.body), ["electrical"]);
  assert.deepEqual(await storedSlugs(10), ["electrical"]);
  const { rows } = await db.query("SELECT category FROM shop_registrations WHERE id = 10");
  assert.equal(rows[0].category, "Electrical");
});

test("an owner can add and remove single categories", async () => {
  const added = await send(2, "/shops/owner/categories", "POST", { category: "plumbing" });
  assert.equal(added.status, 201);
  assert.equal(added.body.message, "Plumbing added to your shop's categories.");
  assert.deepEqual(slugs(added.body), ["air-conditioner", "plumbing"]);

  const removed = await send(2, "/shops/owner/categories/air-conditioner", "DELETE");
  assert.equal(removed.status, 200);
  assert.deepEqual(slugs(removed.body), ["plumbing"]);
  assert.deepEqual(await storedSlugs(10), ["plumbing"]);
  const { rows } = await db.query("SELECT category FROM shop_registrations WHERE id = 10");
  assert.equal(rows[0].category, "Plumbing");

  assert.equal((await send(2, "/shops/owner/categories/air-conditioner", "DELETE")).status, 404);
  const last = await send(2, "/shops/owner/categories/plumbing", "DELETE");
  assert.equal(last.status, 409);
  assert.match(last.body.message, /at least one category/);
  assert.deepEqual(await storedSlugs(10), ["plumbing"]);
});

test("only valid categories can be selected", async () => {
  for (const body of [
    { categories: ["solar-panels"] },
    { categories: ["plumbing", 42] },
    { categories: [""] },
    { categories: [] },
    { categories: "plumbing" },
    {},
  ]) {
    const response = await send(2, "/shops/owner/categories", "PUT", body);
    assert.equal(response.status, 400, JSON.stringify(body));
    assert.equal(response.body.code, "VALIDATION_ERROR");
  }
  const unknown = await send(2, "/shops/owner/categories", "PUT", { categories: ["plumbing", "solar-panels"] });
  assert.match(unknown.body.errors.categories, /Unknown categories: "solar-panels"/);
  for (const category of ["solar-panels", "", undefined, ["plumbing"]]) {
    assert.equal((await send(2, "/shops/owner/categories", "POST", { category })).status, 400);
  }
  assert.equal((await send(2, "/shops/owner/categories/solar-panels", "DELETE")).status, 400);
  assert.deepEqual(slugs((await send(2, "/shops/owner/categories")).body), ["air-conditioner"]);
});

test("duplicate categories are prevented", async () => {
  const duplicate = await send(2, "/shops/owner/categories", "PUT", {
    categories: ["plumbing", "Plumbing", "electrical", "electrical"],
  });
  assert.equal(duplicate.status, 400);
  assert.equal(duplicate.body.errors.categories, "Each category can only be selected once: Plumbing, Electrical.");

  const again = await send(2, "/shops/owner/categories", "POST", { category: "Air Conditioner" });
  assert.equal(again.status, 409);
  assert.equal(again.body.message, "Air Conditioner is already one of your shop's categories.");
  assert.deepEqual(await storedSlugs(10), []);
  await assert.rejects(
    db.query("INSERT INTO shop_registration_categories (registration_id, category_id) VALUES (20, 7), (20, 7)"),
    /duplicate key/,
  );
});

test("public shop details and the shop listing show the selected categories", async () => {
  await send(2, "/shops/owner/categories", "PUT", { categories: ["air-conditioner", "refrigerator"] });
  const expected = [
    { slug: "air-conditioner", name: "Air Conditioner" },
    { slug: "refrigerator", name: "Refrigerator" },
  ];

  const details = await send(null, "/shops/10");
  assert.equal(details.status, 200);
  assert.equal(details.body.data.name, "CoolTech AC Service");
  assert.equal(details.body.data.category, "Air Conditioner");
  assert.deepEqual(details.body.data.categories, expected);

  const listing = await send(null, "/shops");
  assert.deepEqual(listing.body.data.find((shop) => shop.id === "10").categories, expected);
  assert.deepEqual(listing.body.data.find((shop) => shop.id === "20").categories, [{ slug: "plumbing", name: "Plumbing" }]);

  for (const id of ["30", "999", "abc", "0"]) {
    const missing = await send(null, `/shops/${id}`);
    assert.equal(missing.status, 404, id);
    assert.equal(missing.body.message, "Shop not found.");
  }
});

test("customers can book any category the shop has selected, and no others", async () => {
  await send(2, "/shops/owner/categories", "PUT", { categories: ["refrigerator", "plumbing"] });
  async function book(requestId, category) {
    const form = new FormData();
    const fields = {
      requestId, shopId: "10", category, problemDescription: "Leaking", contactName: "Customer",
      contactPhone: "012345678", location: "Phnom Penh", serviceType: "Home visit",
      appointmentDate: "2026-12-01", appointmentTime: "09:00",
    };
    for (const [key, value] of Object.entries(fields)) form.append(key, value);
    const response = await fetch(`${baseUrl}/repair-requests`, {
      method: "POST", headers: { Cookie: `homefix_session=${tokens[1]}` }, body: form,
    });
    return response.status;
  }
  assert.equal(await book("HF-PLUMBING", "Plumbing"), 201);
  assert.equal(await book("HF-FRIDGE", "Refrigerator"), 201);
  assert.equal(await book("HF-AIRCON", "Air Conditioner"), 400);
});

test("owners can only manage their own shop", async () => {
  assert.equal((await send(null, "/shops/owner/categories")).status, 401);
  assert.equal((await send(null, "/shops/owner/categories", "PUT", { categories: ["plumbing"] })).status, 401);
  const customer = await send(1, "/shops/owner/categories", "PUT", { categories: ["plumbing"] });
  assert.equal(customer.status, 403);
  const noShop = await send(5, "/shops/owner/categories");
  assert.equal(noShop.status, 404);
  assert.equal(noShop.body.message, "No shop is registered to this account.");

  await send(3, "/shops/owner/categories", "PUT", { categories: ["electrical", "plumbing"], shopId: "10" });
  assert.deepEqual(await storedSlugs(20), ["electrical", "plumbing"]);
  assert.deepEqual(await storedSlugs(10), []);
  assert.deepEqual(slugs((await send(2, "/shops/owner/categories")).body), ["air-conditioner"]);
});

test("database failures return a generic error without internal details", async () => {
  failQueries = true;
  const { status, body } = await send(null, "/service-categories");
  failQueries = false;
  assert.equal(status, 500);
  assert.equal(body.code, "INTERNAL_ERROR");
  assert.doesNotMatch(JSON.stringify(body), /10\.0\.0\.5|password/);
});

test("the migration links existing shops to the category they registered with", async () => {
  await db.exec(`
    DROP TABLE shop_registration_categories;
    DELETE FROM schema_migrations WHERE name = '003_shop_registration_categories.sql';
  `);
  assert.deepEqual(await runMigrations(database, { logger: { log() {} } }), ["003_shop_registration_categories.sql"]);
  assert.deepEqual(await storedSlugs(10), ["air-conditioner"]);
  assert.deepEqual(await storedSlugs(20), ["plumbing"]);
  assert.deepEqual(await storedSlugs(30), ["refrigerator"]);
});
