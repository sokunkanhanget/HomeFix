import assert from "node:assert/strict";
import { after, before, test } from "node:test";
import { Router } from "express";
import { createApp } from "./app.js";
import { createHealthRouter } from "./routes/health.js";
import { AppError } from "./utils/AppError.js";

let databaseUp = true;
let server;
let url;

before(async () => {
  const router = Router();
  router.use(createHealthRouter({
    ping: async () => {
      if (!databaseUp) throw new Error("connection refused");
    },
  }));
  router.get("/validation", () => {
    throw AppError.badRequest("Validation failed.", { email: "Email is required." });
  });
  router.get("/crash", async () => {
    throw new Error("secret internal detail");
  });
  router.post("/echo", (request, response) => response.json(request.body));

  server = createApp({ router }).listen(0);
  await new Promise((resolve) => server.once("listening", resolve));
  url = `http://127.0.0.1:${server.address().port}/api`;
});

after(() => new Promise((resolve) => server.close(resolve)));

test("health check reports ok when the database is reachable", async () => {
  databaseUp = true;
  const response = await fetch(`${url}/health`);
  const body = await response.json();
  assert.equal(response.status, 200);
  assert.equal(body.status, "ok");
  assert.equal(body.database, "connected");
  assert.equal(body.service, "homefix-api");
  assert.ok(!Number.isNaN(Date.parse(body.timestamp)));
});

test("health check returns 503 when the database is down", async () => {
  databaseUp = false;
  const response = await fetch(`${url}/health`);
  const body = await response.json();
  assert.equal(response.status, 503);
  assert.equal(body.status, "degraded");
  assert.equal(body.database, "disconnected");
});

test("unknown routes return the standard 404 error", async () => {
  const response = await fetch(`${url}/does-not-exist`);
  assert.equal(response.status, 404);
  assert.deepEqual(await response.json(), {
    message: "Route GET /api/does-not-exist was not found.",
    code: "NOT_FOUND",
  });
});

test("AppError validation errors include field errors", async () => {
  const response = await fetch(`${url}/validation`);
  assert.equal(response.status, 400);
  assert.deepEqual(await response.json(), {
    message: "Validation failed.",
    code: "VALIDATION_ERROR",
    errors: { email: "Email is required." },
  });
});

test("unexpected errors return a generic 500 without internal details", async () => {
  const response = await fetch(`${url}/crash`);
  const body = await response.json();
  assert.equal(response.status, 500);
  assert.equal(body.code, "INTERNAL_ERROR");
  assert.doesNotMatch(JSON.stringify(body), /secret internal detail/);
});

test("malformed JSON bodies return a 400 in the standard format", async () => {
  const response = await fetch(`${url}/echo`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: "{not json",
  });
  assert.equal(response.status, 400);
  assert.deepEqual(await response.json(), {
    message: "The request body must be valid JSON.",
    code: "INVALID_JSON",
  });
});
