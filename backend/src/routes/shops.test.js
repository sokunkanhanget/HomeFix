import test from "node:test";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import express from "express";
import { issueAuthToken } from "../authToken.js";
import { createShopRouter } from "./shops.js";

const secret = "shop-registration-route-tests-use-a-long-secret";
process.env.AUTH_TOKEN_SECRET = secret;

async function createHarness(role = "owner") {
  const owner = { id: "7", name: "Shop Owner", email: "owner@example.com", phone: "0123456789" };
  const token = issueAuthToken({ id: owner.id, role }, secret, 120);
  const queries = [];
  const registrations = [];
  const database = {
    async query(sql, values = []) {
      queries.push({ sql, values });
      if (sql.includes("FROM users") && sql.includes("JOIN user_sessions")) {
        assert.equal(values[1], createHash("sha256").update(token).digest("hex"));
        return { rows: [owner] };
      }
      if (sql.startsWith("INSERT INTO shop_registrations")) {
        if (registrations.some((registration) => registration.owner_id === values[0])) {
          const error = new Error("duplicate owner");
          error.code = "23505";
          throw error;
        }
        const [
          owner_id, name, category, address, description, phone, email, operating_hours, service_type,
        ] = values;
        const registration = {
          id: String(registrations.length + 1),
          owner_id,
          name,
          category,
          address,
          description,
          phone,
          email,
          operating_hours,
          service_type,
          status: "pending",
          submitted_at: new Date().toISOString(),
        };
        registrations.push(registration);
        return { rows: [registration] };
      }
      if (sql.includes("FROM shop_registrations")) {
        return { rows: registrations.filter(({ status }) => status === "approved") };
      }
      throw new Error(`Unexpected query: ${sql}`);
    },
  };
  const app = express();
  app.use(express.json());
  app.use("/api/shops", createShopRouter(database));
  const server = app.listen(0);
  await new Promise((resolve) => server.once("listening", resolve));
  const address = server.address();
  const request = (path, options = {}) => fetch(`http://127.0.0.1:${address.port}/api/shops${path}`, {
    ...options,
    headers: {
      ...(options.body ? { "Content-Type": "application/json" } : {}),
      ...(options.headers || {}),
    },
  });

  return {
    queries,
    registrations,
    close: () => new Promise((resolve, reject) => {
      server.close((error) => error ? reject(error) : resolve());
    }),
    register: (body, authenticated = true) => request("/registrations", {
      method: "POST",
      ...(authenticated ? { headers: { Cookie: `homefix_session=${token}` } } : {}),
      body: JSON.stringify(body),
    }),
    publicShops: () => request("/"),
  };
}

test("shop registration requires an authenticated shop owner", async (t) => {
  const harness = await createHarness();
  t.after(() => harness.close());

  const response = await harness.register({ name: "Cool Shop", address: "Street 1" }, false);

  assert.equal(response.status, 401);
  assert.deepEqual(await response.json(), {
    message: "Log in with a shop owner account to register your shop.",
  });
  assert.equal(harness.registrations.length, 0);
});

test("shop registration rejects authenticated non-owner accounts", async (t) => {
  const harness = await createHarness("customer");
  t.after(() => harness.close());

  const response = await harness.register({ name: "Cool Shop", address: "Street 1" });

  assert.equal(response.status, 401);
  assert.equal(harness.queries.some(({ sql }) => sql.includes("JOIN user_sessions")), false);
});

test("shop registration stores owner details with pending status and prevents duplicates", async (t) => {
  const harness = await createHarness();
  t.after(() => harness.close());

  const body = {
    name: "Cool Shop",
    category: "Air Conditioner",
    address: "Street 1, Phnom Penh",
    description: "Repairs and services for home air conditioners.",
    phone: "012 345 678",
  };
  const response = await harness.register(body);
  const result = await response.json();

  assert.equal(response.status, 201);
  assert.equal(result.registration.name, body.name);
  assert.equal(result.registration.address, body.address);
  assert.equal(result.registration.description, body.description);
  assert.equal(result.registration.phone, body.phone);
  assert.equal(result.registration.status, "pending");
  assert.deepEqual(result.registration.owner, {
    id: "7",
    name: "Shop Owner",
    email: "owner@example.com",
    phone: "0123456789",
  });

  const duplicate = await harness.register(body);
  assert.equal(duplicate.status, 409);
  assert.equal(harness.registrations.length, 1);
});

test("shop name and address are required and pending registrations are not public", async (t) => {
  const harness = await createHarness();
  t.after(() => harness.close());

  const missingFields = await harness.register({ name: "Cool Shop" });
  assert.equal(missingFields.status, 400);
  const missingName = await harness.register({ address: "Street 1, Phnom Penh" });
  assert.equal(missingName.status, 400);

  await harness.register({ name: "Cool Shop", address: "Street 1, Phnom Penh" });
  const response = await harness.publicShops();

  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), []);
  assert.match(harness.queries.find(({ sql }) => sql.includes("FROM shop_registrations")).sql, /WHERE status = 'approved'/);

  harness.registrations[0].status = "approved";
  const approvedResponse = await harness.publicShops();
  assert.equal((await approvedResponse.json()).length, 1);
});
