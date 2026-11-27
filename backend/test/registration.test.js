import assert from "node:assert/strict";
import { scryptSync } from "node:crypto";
import { after, before, beforeEach, test } from "node:test";
import express from "express";
import authRouter from "../src/routes/auth.js";
import { pool } from "../src/config/database.js";

const valid = { name: "Sok Dara", email: "dara@example.com", phone: "012345678", password: "Password123" };
let server;
let url;
let calls;
let storedUsers;
let sessionFailure;
let connectFailure;
let insertFailure;
let released;
const originalConnect = pool.connect;

before(async () => {
  // Exercise real HTTP routing and hashing; substitute only the database boundary.
  pool.connect = async () => {
    if (connectFailure) throw new Error("Database unavailable");
    let pending;
    return {
      async query(sql, values) {
        calls.push({ sql, values });
        if (sql.startsWith("INSERT INTO users")) {
          if (insertFailure) throw insertFailure;
          if (storedUsers.some((user) => user.email.trim().toLowerCase() === values[1])) {
            throw Object.assign(new Error("duplicate"), { code: "23505", constraint: "users_email_normalized_unique" });
          }
          pending = { id: String(storedUsers.length + 1), name: values[0], email: values[1], phone: values[2], password_hash: values[3], role: "customer" };
          const { password_hash, ...user } = pending;
          return { rows: [user] };
        }
        if (sql.startsWith("INSERT INTO user_sessions") && sessionFailure) throw new Error("Session failed");
        if (sql === "COMMIT") storedUsers.push(pending);
        if (sql === "ROLLBACK") pending = undefined;
        return { rows: [] };
      },
      release() { released += 1; },
    };
  };
  const app = express();
  app.use(express.json());
  app.use("/api/auth", authRouter);
  await new Promise((resolve) => { server = app.listen(0, "127.0.0.1", resolve); });
  url = `http://127.0.0.1:${server.address().port}/api/auth/register`;
});

beforeEach(() => {
  calls = [];
  storedUsers = [];
  sessionFailure = false;
  connectFailure = false;
  insertFailure = undefined;
  released = 0;
});

after(async () => {
  pool.connect = originalConnect;
  await new Promise((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
  await pool.end();
});

async function register(body) {
  const response = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  return { response, body: await response.json() };
}

test("creates a normalized customer account, hashes the unchanged password, and commits before issuing a session", async () => {
  const password = "  Password123  ";
  const { response, body } = await register({ ...valid, name: " Sok Dara ", email: " DARA@Example.COM ", phone: " 012345678 ", password, role: "admin", password_hash: "injected" });
  assert.equal(response.status, 201);
  assert.deepEqual(body.user, { id: "1", name: valid.name, email: valid.email, phone: valid.phone, role: "customer" });
  const [algorithm, salt, hash] = storedUsers[0].password_hash.split(":");
  assert.equal(algorithm, "scrypt");
  assert.equal(salt.length, 32);
  assert.equal(hash.length, 128);
  assert.equal(scryptSync(password, Buffer.from(salt, "hex"), 64).toString("hex"), hash);
  assert.equal(JSON.stringify(body).includes("password"), false);
  assert.match(response.headers.get("set-cookie"), /homefix_session=.*HttpOnly.*SameSite=Lax/);
  assert.equal(calls[0].sql, "BEGIN");
  assert.equal(calls.at(-1).sql, "COMMIT");
  assert.equal(released, 1);
  const session = calls.find((call) => call.sql.startsWith("INSERT INTO user_sessions"));
  assert.equal(session.values[0].length, 64);
  assert.equal(response.headers.get("set-cookie").includes(session.values[0]), false);
});

test("identical passwords get different salts and hashes", async () => {
  await register(valid);
  await register({ ...valid, email: "other@example.com" });
  assert.equal(storedUsers.length, 2);
  assert.notEqual(storedUsers[0].password_hash, storedUsers[1].password_hash);
});

test("registered passwords still work with login and login excludes the hash", async () => {
  await register(valid);
  const originalQuery = pool.query;
  pool.query = async (sql, values) => {
    if (sql.startsWith("SELECT")) {
      assert.match(sql, /LOWER\(BTRIM\(email\)\)/);
      assert.equal(values[0], valid.email);
      return { rows: [{ ...storedUsers[0] }] };
    }
    return { rows: [] };
  };
  try {
    const response = await fetch(url.replace("/register", "/login"), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: " DARA@EXAMPLE.COM ", password: valid.password }),
    });
    assert.equal(response.status, 200);
    const body = await response.json();
    assert.equal(body.user.email, valid.email);
    assert.equal("password_hash" in body.user, false);
    assert.match(response.headers.get("set-cookie"), /homefix_session=/);
  } finally {
    pool.query = originalQuery;
  }
});

for (const field of ["name", "email", "phone", "password"]) {
  for (const [label, value] of [["missing", undefined], ["null", null], ["blank", "   "], ["wrong type", 123]]) {
    test(`rejects ${label} ${field} before accessing the database`, async () => {
      const { response, body } = await register({ ...valid, [field]: value });
      assert.equal(response.status, 400);
      assert.ok(body.errors[field]);
      assert.equal(calls.length, 0);
    });
  }
}

for (const [field, value] of [
  ["name", "x".repeat(121)], ["email", `${"a".repeat(243)}@example.com`],
  ["phone", "1".repeat(41)], ["email", "invalid-email"],
  ["password", "Abc123"], ["password", "a1".repeat(65)],
  ["password", "abcdefgh"], ["password", "12345678"],
]) {
  test(`rejects invalid ${field}: ${value.slice(0, 15)}`, async () => {
    const { response, body } = await register({ ...valid, [field]: value });
    assert.equal(response.status, 400);
    assert.ok(body.errors[field]);
    assert.equal(calls.length, 0);
  });
}

test("returns all missing field errors together", async () => {
  const { response, body } = await register({});
  assert.equal(response.status, 400);
  assert.deepEqual(Object.keys(body.errors).sort(), ["email", "name", "password", "phone"]);
});

test("rejects duplicate email including existing mixed-case records", async () => {
  storedUsers.push({ email: " DARA@Example.COM " });
  const { response, body } = await register(valid);
  assert.equal(response.status, 409);
  assert.match(body.errors.email, /already exists/);
  assert.equal(calls.at(-1).sql, "ROLLBACK");
  assert.equal(response.headers.get("set-cookie"), null);
  assert.equal(released, 1);
});

test("recognizes the existing email unique constraint", async () => {
  insertFailure = Object.assign(new Error("duplicate"), { code: "23505", constraint: "users_email_key" });
  const { response } = await register(valid);
  assert.equal(response.status, 409);
});

test("does not label unrelated unique violations as duplicate emails", async () => {
  insertFailure = Object.assign(new Error("duplicate"), { code: "23505", constraint: "user_sessions_pkey" });
  const { response } = await register(valid);
  assert.equal(response.status, 500);
});

test("rolls back the account when session creation fails and issues no cookie", async () => {
  sessionFailure = true;
  const { response, body } = await register(valid);
  assert.equal(response.status, 500);
  assert.equal(storedUsers.length, 0);
  assert.equal(calls.at(-1).sql, "ROLLBACK");
  assert.equal(response.headers.get("set-cookie"), null);
  assert.equal(released, 1);
  assert.equal(JSON.stringify(body).includes("Session failed"), false);
});

test("returns a safe error when the database is unavailable", async () => {
  connectFailure = true;
  const { response, body } = await register(valid);
  assert.equal(response.status, 500);
  assert.equal(body.message, "Could not create your account. Please try again.");
  assert.equal(response.headers.get("set-cookie"), null);
});
