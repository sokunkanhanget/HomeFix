import test, { after } from "node:test";
import assert from "node:assert/strict";
import { createHash, scrypt as scryptCallback } from "node:crypto";
import { promisify } from "node:util";
import express from "express";
import { createAuthRouter } from "./auth.js";
import { verifyAuthToken } from "../authToken.js";

const scrypt = promisify(scryptCallback);
const originalSecret = process.env.AUTH_TOKEN_SECRET;
const originalLifetime = process.env.AUTH_TOKEN_EXPIRES_IN_SECONDS;
const secret = "route-tests-use-a-secret-that-is-at-least-32-characters";
const lifetimeSeconds = 120;
const salt = Buffer.from("0123456789abcdef");
const password = "HomeFixPass123";

process.env.AUTH_TOKEN_SECRET = secret;
process.env.AUTH_TOKEN_EXPIRES_IN_SECONDS = String(lifetimeSeconds);

after(() => {
  if (originalSecret === undefined) delete process.env.AUTH_TOKEN_SECRET;
  else process.env.AUTH_TOKEN_SECRET = originalSecret;

  if (originalLifetime === undefined) delete process.env.AUTH_TOKEN_EXPIRES_IN_SECONDS;
  else process.env.AUTH_TOKEN_EXPIRES_IN_SECONDS = originalLifetime;
});

async function createHarness() {
  const derivedKey = await scrypt(password, salt, 64);
  const user = {
    id: "7",
    name: "HomeFix User",
    email: "user@example.com",
    phone: "0123456789",
    role: "owner",
    password_hash: `scrypt:${salt.toString("hex")}:${derivedKey.toString("hex")}`,
  };
  const queries = [];
  const database = {
    async query(sql, values = []) {
      queries.push({ sql, values });
      if (sql.startsWith("SELECT id, name, email, phone, role, password_hash")) {
        return { rows: [user] };
      }
      if (sql.startsWith("INSERT INTO user_sessions")) {
        return { rows: [] };
      }
      if (sql.startsWith("DELETE FROM user_sessions")) {
        return { rows: [] };
      }
      throw new Error(`Unexpected query: ${sql}`);
    },
  };
  const app = express();
  app.use(express.json());
  app.use("/api/auth", createAuthRouter(database));
  const server = app.listen(0);
  await new Promise((resolve) => server.once("listening", resolve));
  const address = server.address();

  return {
    queries,
    close: () => new Promise((resolve, reject) => {
      server.close((error) => error ? reject(error) : resolve());
    }),
    login: (body) => fetch(`http://127.0.0.1:${address.port}/api/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    }),
  };
}

test("login returns a signed token and user data without password credentials", async (t) => {
  const harness = await createHarness();
  t.after(() => harness.close());

  const response = await harness.login({ email: "USER@example.com", password });
  const body = await response.json();

  assert.equal(response.status, 200);
  assert.equal(body.user.email, "user@example.com");
  assert.equal(body.user.role, "owner");
  assert.equal("password" in body.user, false);
  assert.equal("password_hash" in body.user, false);
  assert.equal(JSON.stringify(body).includes(password), false);

  const claims = verifyAuthToken(body.token, secret);
  assert.equal(claims.sub, "7");
  assert.equal(claims.role, "owner");
  assert.equal(claims.exp - claims.iat, lifetimeSeconds);

  const sessionInsert = harness.queries.find(({ sql }) => sql.startsWith("INSERT INTO user_sessions"));
  assert.ok(sessionInsert);
  assert.equal(
    sessionInsert.values[0],
    createHash("sha256").update(body.token).digest("hex"),
  );
});

test("login rejects an incorrect password without creating a session", async (t) => {
  const harness = await createHarness();
  t.after(() => harness.close());

  const response = await harness.login({ email: "user@example.com", password: "wrong-password" });
  const body = await response.json();

  assert.equal(response.status, 401);
  assert.deepEqual(body, { message: "Email or password is incorrect." });
  assert.equal(harness.queries.some(({ sql }) => sql.startsWith("INSERT INTO user_sessions")), false);
});
