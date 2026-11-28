import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { after, before, test } from "node:test";
import express from "express";
import { PGlite } from "@electric-sql/pglite";
import { errorHandler } from "../middleware/errorHandler.js";
import { initializeUserProfileSchema } from "../models/userModel.js";
import { issueAuthToken } from "../utils/authToken.js";
import { createUsersRouter } from "./users.js";

// PGlite runs real PostgreSQL in memory, so these tests check that changes
// are actually saved to the database.
const secret = "profile-api-test-secret-at-least-32-characters-long";
const PNG = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 1, 2, 3, 4]);
const JPEG = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 5, 6, 7, 8]);

let db;
let server;
let base;
const tokens = {};

before(async () => {
  process.env.AUTH_TOKEN_SECRET = secret;
  db = new PGlite();
  await db.exec(`
    CREATE TABLE users (
      id BIGSERIAL PRIMARY KEY, name TEXT NOT NULL, email TEXT NOT NULL UNIQUE, phone TEXT,
      password_hash TEXT NOT NULL, role TEXT NOT NULL DEFAULT 'customer',
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
    CREATE TABLE user_sessions (token_hash TEXT PRIMARY KEY, user_id BIGINT, expires_at TIMESTAMPTZ);
    INSERT INTO users (id, name, email, phone, password_hash, role) VALUES
      (1, 'Sok Dara', 'dara@example.com', '012345678', 'hash', 'customer'),
      (2, 'Chan Lina', 'lina@example.com', '098765432', 'hash', 'owner');
  `);
  const database = {
    query(sql, values = []) {
      return /CREATE TABLE|ALTER TABLE/.test(sql) ? db.exec(sql) : db.query(sql, values);
    },
  };
  await initializeUserProfileSchema(database);
  await initializeUserProfileSchema(database); // safe to run twice

  for (const [id, role] of [[1, "customer"], [2, "owner"]]) {
    tokens[id] = issueAuthToken({ id: String(id), role }, secret, 120);
    await db.query("INSERT INTO user_sessions VALUES ($1, $2, NOW() + INTERVAL '2 minutes')", [
      createHash("sha256").update(tokens[id]).digest("hex"), id,
    ]);
  }

  const app = express();
  app.use(express.json());
  app.use("/api/users", createUsersRouter(database));
  app.use(errorHandler);
  server = app.listen(0, "127.0.0.1");
  await new Promise((resolve) => server.once("listening", resolve));
  base = `http://127.0.0.1:${server.address().port}/api/users`;
});

after(async () => {
  await new Promise((resolve) => server.close(resolve));
  await db.close();
});

async function send(user, path, { method = "GET", json, form } = {}) {
  const headers = user ? { Cookie: `homefix_session=${tokens[user]}` } : {};
  if (json !== undefined) headers["Content-Type"] = "application/json";
  const response = await fetch(base + path, {
    method,
    headers,
    body: form || (json !== undefined ? JSON.stringify(json) : undefined),
  });
  const type = response.headers.get("content-type") || "";
  const body = type.includes("json") ? await response.json() : Buffer.from(await response.arrayBuffer());
  return { status: response.status, body, type };
}

function photoForm(buffer, type = "image/png", name = "me.png") {
  const form = new FormData();
  form.append("photo", new Blob([buffer], { type }), name);
  return form;
}

test("requires login", async () => {
  const response = await send(null, "/me");
  assert.equal(response.status, 401);
  assert.equal(response.body.code, "UNAUTHORIZED");

  const forged = await fetch(`${base}/me`, { headers: { Cookie: "homefix_session=not-a-real-token" } });
  assert.equal(forged.status, 401);
});

test("authenticated user retrieves their own profile without private credentials", async () => {
  const { status, body } = await send(1, "/me");
  assert.equal(status, 200);
  assert.deepEqual(
    { id: body.data.id, name: body.data.name, email: body.data.email, phone: body.data.phone, role: body.data.role, photoUrl: body.data.photoUrl },
    { id: "1", name: "Sok Dara", email: "dara@example.com", phone: "012345678", role: "customer", photoUrl: null },
  );
  assert.equal(body.data.password_hash, undefined);
  assert.doesNotMatch(JSON.stringify(body), /hash/);
});

test("user updates name and phone and the change is saved in the database", async () => {
  const { status, body } = await send(1, "/me", { method: "PATCH", json: { name: "  Sok Dara Updated ", phone: "+855 12 345 679" } });
  assert.equal(status, 200);
  assert.equal(body.data.name, "Sok Dara Updated");
  assert.equal(body.data.phone, "+855 12 345 679");

  const saved = await db.query("SELECT name, phone FROM users WHERE id = 1");
  assert.deepEqual(saved.rows[0], { name: "Sok Dara Updated", phone: "+855 12 345 679" });

  const reread = await send(1, "/me");
  assert.equal(reread.body.data.name, "Sok Dara Updated");
});

test("required fields are validated", async () => {
  const blank = await send(1, "/me", { method: "PATCH", json: { name: "  ", phone: "" } });
  assert.equal(blank.status, 400);
  assert.equal(blank.body.code, "VALIDATION_ERROR");
  assert.equal(blank.body.errors.name, "Name is required.");
  assert.equal(blank.body.errors.phone, "Phone number is required.");

  const missing = await send(1, "/me", { method: "PATCH", json: {} });
  assert.equal(missing.status, 400);
  assert.ok(missing.body.errors.name && missing.body.errors.phone);

  const invalid = await send(1, "/me", { method: "PATCH", json: { name: "A".repeat(121), phone: "call me" } });
  assert.equal(invalid.status, 400);
  assert.match(invalid.body.errors.name, /120/);
  assert.match(invalid.body.errors.phone, /valid phone/);

  const tooShort = await send(1, "/me", { method: "PATCH", json: { name: "Dara", phone: "12345" } });
  assert.match(tooShort.body.errors.phone, /8 to 15 digits/);

  const saved = await db.query("SELECT name FROM users WHERE id = 1");
  assert.equal(saved.rows[0].name, "Sok Dara Updated", "invalid updates must not change the database");
});

test("users cannot change their own role (or email) through the profile API", async () => {
  const response = await send(1, "/me", { method: "PATCH", json: { name: "Sok Dara", phone: "012345678", role: "admin" } });
  assert.equal(response.status, 400);
  assert.equal(response.body.errors.role, "Your role cannot be changed through your profile.");

  const email = await send(1, "/me", { method: "PATCH", json: { name: "Sok Dara", phone: "012345678", email: "x@example.com" } });
  assert.equal(email.status, 400);
  assert.ok(email.body.errors.email);

  const saved = await db.query("SELECT role, email, name FROM users WHERE id = 1");
  assert.deepEqual(saved.rows[0], { role: "customer", email: "dara@example.com", name: "Sok Dara Updated" });
});

test("users cannot retrieve another user's private profile", async () => {
  const other = await send(1, "/2");
  assert.equal(other.status, 403);
  assert.equal(other.body.code, "FORBIDDEN");
  assert.doesNotMatch(JSON.stringify(other.body), /lina/i);

  const own = await send(1, "/1");
  assert.equal(own.status, 200);
  assert.equal(own.body.data.email, "dara@example.com");
});

test("user uploads, views, replaces and removes their profile photo", async () => {
  const uploaded = await send(1, "/me/photo", { method: "PUT", form: photoForm(PNG) });
  assert.equal(uploaded.status, 200);
  assert.match(uploaded.body.data.photoUrl, /^\/api\/users\/me\/photo\?v=\d+$/);

  const photo = await send(1, "/me/photo");
  assert.equal(photo.status, 200);
  assert.equal(photo.type, "image/png");
  assert.ok(photo.body.equals(PNG));

  const replaced = await send(1, "/me/photo", { method: "PUT", form: photoForm(JPEG, "image/jpeg", "me.jpg") });
  assert.equal(replaced.status, 200);
  const saved = await db.query("SELECT content_type FROM user_profile_photos WHERE user_id = 1");
  assert.deepEqual(saved.rows, [{ content_type: "image/jpeg" }]);

  // Another user only ever gets their own photo (none yet).
  assert.equal((await send(2, "/me/photo")).status, 404);

  const removed = await send(1, "/me/photo", { method: "DELETE" });
  assert.equal(removed.status, 200);
  assert.equal(removed.body.data.photoUrl, null);
  assert.equal((await send(1, "/me/photo")).status, 404);
});

test("profile photo must be a real, small image", async () => {
  const fake = await send(1, "/me/photo", { method: "PUT", form: photoForm(Buffer.from("not an image"), "image/png") });
  assert.equal(fake.status, 400);
  assert.match(fake.body.errors.photo, /JPG, PNG or WebP/);

  const big = Buffer.concat([PNG, Buffer.alloc(2 * 1024 * 1024)]);
  const tooBig = await send(1, "/me/photo", { method: "PUT", form: photoForm(big) });
  assert.equal(tooBig.status, 400);
  assert.match(tooBig.body.errors.photo, /2 MB/);

  const none = await send(1, "/me/photo", { method: "PUT", form: new FormData() });
  assert.equal(none.status, 400);
});
