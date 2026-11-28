import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { mkdtemp, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { after, before, beforeEach, test } from "node:test";
import express from "express";
import { PGlite } from "@electric-sql/pglite";
import { runMigrations } from "../db/migrator.js";
import { addDays, localNow } from "../services/appointmentPreferences.js";
import { issueAuthToken } from "../utils/authToken.js";
import { createRepairRequestsRouter } from "./repairRequests.js";

// HF-76 through HTTP against the real schema (PGlite runs PostgreSQL in memory
// with the project's migrations). Users: 1 and 2 are customers, 3 owns shop 10.
const secret = "appointment-preference-tests-use-a-long-secret";
process.env.AUTH_TOKEN_SECRET = secret;
const tomorrow = addDays(localNow().date, 1);
const nextWeek = addDays(localNow().date, 7);

let db;
let server;
let base;
let storage;
const tokens = {};

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

  for (const [id, role] of [[1, "customer"], [2, "customer"], [3, "owner"]]) {
    await db.query(
      "INSERT INTO users (id, name, email, phone, password_hash, role) VALUES ($1, $2, $3, '012345678', 'hash', $4)",
      [id, `User ${id}`, `user${id}@example.com`, role],
    );
    tokens[id] = issueAuthToken({ id: String(id), role }, secret, 600);
    await db.query(
      "INSERT INTO user_sessions (token_hash, user_id, expires_at) VALUES ($1, $2, NOW() + INTERVAL '10 minutes')",
      [createHash("sha256").update(tokens[id]).digest("hex"), id],
    );
  }
  await db.query(
    `INSERT INTO shop_registrations (id, owner_id, name, category, address, status)
     VALUES (10, 3, 'CoolTech', 'Air Conditioner', 'Phnom Penh', 'approved')`,
  );

  storage = await mkdtemp(path.join(os.tmpdir(), "homefix-preferences-"));
  const app = express();
  app.use(express.json());
  app.use("/api/repair-requests", createRepairRequestsRouter(database, storage));
  server = app.listen(0, "127.0.0.1");
  await new Promise((resolve) => server.once("listening", resolve));
  base = `http://127.0.0.1:${server.address().port}/api/repair-requests`;
});

after(async () => {
  await new Promise((resolve) => server.close(resolve));
  await rm(storage, { recursive: true, force: true });
});

beforeEach(() => db.exec("DELETE FROM repair_requests"));

async function call(user, route, method = "GET", body) {
  const multipart = body instanceof FormData;
  const response = await fetch(base + route, {
    method,
    headers: {
      ...(user ? { Cookie: `homefix_session=${tokens[user]}` } : {}),
      ...(body && !multipart ? { "Content-Type": "application/json" } : {}),
    },
    ...(body ? { body: multipart ? body : JSON.stringify(body) } : {}),
  });
  return { status: response.status, body: await response.json() };
}

function submit(fields = {}, user = 1) {
  const form = new FormData();
  const values = {
    requestId: "req-1", shopId: "10", category: "Air Conditioner", problemDescription: "AC is not cooling",
    contactName: "Customer", contactPhone: "012345678", location: "Toul Kork", serviceType: "Home visit",
    priority: "regular", appointmentDate: tomorrow, appointmentTime: "afternoon",
    schedulingNotes: "Please call 30 minutes before arriving.", ...fields,
  };
  for (const [key, value] of Object.entries(values)) form.append(key, value);
  return call(user, "", "POST", form);
}

const storedRow = async (id = "req-1") => (await db.query(
  "SELECT status, appointment_date, appointment_time, scheduling_notes, preferences_updated_at FROM repair_requests WHERE id = $1",
  [id],
)).rows[0];

test("customer submits a preferred date, time range and scheduling notes with the request", async () => {
  const { status, body } = await submit();

  assert.equal(status, 201);
  assert.deepEqual(body.request.appointmentPreference, {
    date: tomorrow,
    time: "Afternoon (12:00 – 17:00)",
    notes: "Please call 30 minutes before arriving.",
    updatedAt: null,
  });
  assert.match(body.message, /not a confirmed booking/);
  const row = await storedRow();
  assert.equal(row.appointment_date, tomorrow, "stored on the repair request itself");
  assert.equal(row.scheduling_notes, "Please call 30 minutes before arriving.");
});

test("an exact time or a custom time range can be submitted, and notes are optional", async () => {
  assert.equal((await submit({ requestId: "exact", appointmentTime: "14:30", schedulingNotes: "" })).status, 201);
  assert.equal((await submit({ requestId: "range", appointmentTime: "09:00 - 11:00" })).status, 201);
  assert.equal((await storedRow("exact")).appointment_time, "14:30");
  assert.equal((await storedRow("exact")).scheduling_notes, "");
  assert.equal((await storedRow("range")).appointment_time, "09:00-11:00");
});

test("invalid or past preferences are rejected with a clear reason and nothing is saved", async () => {
  const cases = [
    [{ appointmentDate: addDays(localNow().date, -1) }, "appointmentDate", /past/],
    [{ appointmentDate: "2027-02-30" }, "appointmentDate", /real date/],
    [{ appointmentDate: addDays(localNow().date, 120) }, "appointmentDate", /90 days/],
    [{ appointmentDate: "" }, "appointmentDate", /Choose a preferred date/],
    [{ appointmentTime: "06:00" }, "appointmentTime", /08:00 and 20:00/],
    [{ appointmentTime: "15:00-13:00" }, "appointmentTime", /08:00 and 20:00/],
    [{ appointmentTime: "" }, "appointmentTime", /time range/],
    [{ schedulingNotes: "x".repeat(501) }, "schedulingNotes", /500 characters/],
  ];
  for (const [fields, field, pattern] of cases) {
    const { status, body } = await submit(fields);
    assert.equal(status, 400, JSON.stringify(fields));
    assert.match(body.errors[field], pattern, JSON.stringify(fields));
    assert.equal(body.message, body.errors[field]);
  }
  assert.equal((await db.query("SELECT COUNT(*)::int AS n FROM repair_requests")).rows[0].n, 0);
});

test("the shop owner sees the customer's preferences on their requests", async () => {
  await submit();

  const { status, body } = await call(3, "?page=1&limit=10");

  assert.equal(status, 200);
  const [request] = body.requests;
  assert.equal(request.appointmentDate, tomorrow);
  assert.equal(request.appointmentTime, "Afternoon (12:00 – 17:00)");
  assert.equal(request.schedulingNotes, "Please call 30 minutes before arriving.");
  assert.equal(request.appointmentPreference.notes, "Please call 30 minutes before arriving.");
});

test("customer updates preferences while the request is Pending; omitted fields are kept", async () => {
  await submit();

  const { status, body } = await call(1, "/req-1/appointment-preferences", "PATCH", {
    appointmentDate: nextWeek, appointmentTime: "Evening",
  });

  assert.equal(status, 200);
  assert.equal(body.request.appointmentDate, nextWeek);
  assert.equal(body.request.appointmentTime, "Evening (17:00 – 20:00)");
  assert.equal(body.request.schedulingNotes, "Please call 30 minutes before arriving.", "notes kept");
  assert.ok(body.request.appointmentPreference.updatedAt, "records when it changed");

  const notesOnly = await call(1, "/req-1/appointment-preferences", "PATCH", { schedulingNotes: "Gate code 1234." });
  assert.equal(notesOnly.status, 200);
  assert.equal(notesOnly.body.request.appointmentDate, nextWeek, "date kept");

  const own = await call(1, "/req-1");
  assert.deepEqual(
    { date: own.body.request.appointmentPreference.date, notes: own.body.request.appointmentPreference.notes },
    { date: nextWeek, notes: "Gate code 1234." },
  );
});

test("invalid updates and fields other than preferences are rejected without changes", async () => {
  await submit();
  const before = await storedRow();

  const past = await call(1, "/req-1/appointment-preferences", "PATCH", { appointmentDate: addDays(localNow().date, -3) });
  assert.equal(past.status, 400);
  assert.match(past.body.errors.appointmentDate, /past/);

  const sneaky = await call(1, "/req-1/appointment-preferences", "PATCH", { status: "Accepted", appointmentTime: "Morning" });
  assert.equal(sneaky.status, 400);
  assert.ok(sneaky.body.errors.status);

  assert.equal((await call(1, "/req-1/appointment-preferences", "PATCH", {})).status, 400);
  assert.deepEqual(await storedRow(), before);
});

test("only the customer who made the request can change its preferences", async () => {
  await submit();
  const change = { schedulingNotes: "Changed" };

  assert.equal((await call(null, "/req-1/appointment-preferences", "PATCH", change)).status, 401);
  assert.equal((await call(3, "/req-1/appointment-preferences", "PATCH", change)).status, 401, "shop owner");
  assert.equal((await call(2, "/req-1/appointment-preferences", "PATCH", change)).status, 404, "another customer");
  assert.equal((await storedRow()).scheduling_notes, "Please call 30 minutes before arriving.");
});

test("once the shop has responded, preferences can no longer be changed", async () => {
  await submit();
  assert.equal((await call(3, "/req-1/status", "PATCH", { status: "Accepted" })).status, 200);

  const { status, body } = await call(1, "/req-1/appointment-preferences", "PATCH", { appointmentTime: "Morning" });

  assert.equal(status, 409);
  assert.match(body.message, /only be changed while the request is Pending\. This request is Accepted/);
  assert.equal((await storedRow()).appointment_time, "Afternoon (12:00 – 17:00)");
});

test("submitting or updating preferences never confirms an appointment", async () => {
  await submit();
  await call(1, "/req-1/appointment-preferences", "PATCH", { appointmentTime: "10:00" });

  const row = await storedRow();
  assert.equal(row.status, "Pending", "the request still waits for the shop");
  const history = await db.query("SELECT status FROM repair_request_status_history WHERE request_id = 'req-1'");
  assert.deepEqual(history.rows, [], "no status change was recorded");
});

test("emergency requests may leave the preferred time empty", async () => {
  await db.exec("UPDATE shop_registrations SET supports_emergency = TRUE WHERE id = 10");
  const { status, body } = await submit({
    requestId: "urgent", priority: "emergency", appointmentDate: "", appointmentTime: "", schedulingNotes: "",
  });

  assert.equal(status, 201);
  assert.deepEqual(body.request.appointmentPreference, { date: null, time: null, notes: "", updatedAt: null });
  assert.doesNotMatch(body.message, /preferred appointment/);
});
