import test from "node:test";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import express from "express";
import { issueAuthToken } from "../authToken.js";
import { createRepairRequestsRouter } from "./repairRequests.js";

const secret = "repair-photo-route-tests-use-a-long-secret";
process.env.AUTH_TOKEN_SECRET = secret;
const png = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10, 0]);

async function createHarness(t) {
  const storageDirectory = await mkdtemp(path.join(os.tmpdir(), "homefix-photos-"));
  t.after(() => rm(storageDirectory, { recursive: true, force: true }));
  const users = [
    { id: "7", role: "customer" },
    { id: "8", role: "customer" },
  ];
  const tokens = users.map((user) => issueAuthToken(user, secret, 120));
  const sessions = new Map(tokens.map((token, index) => [
    createHash("sha256").update(token).digest("hex"),
    users[index],
  ]));
  const requests = new Map();
  const photos = [];
  const database = {
    async query(sql, values = []) {
      if (sql.includes("FROM users") && sql.includes("JOIN user_sessions")) {
        const user = sessions.get(values[2]);
        return { rows: user && user.id === values[0] && user.role === values[1] ? [user] : [] };
      }
      if (["BEGIN", "COMMIT", "ROLLBACK"].includes(sql)) return { rows: [] };
      if (sql.startsWith("INSERT INTO repair_requests")) {
        if (requests.has(values[0])) {
          const error = new Error("duplicate request");
          error.code = "23505";
          throw error;
        }
        requests.set(values[0], { id: values[0], customer_id: values[1], shop_id: values[2] });
        return { rows: [] };
      }
      if (sql.startsWith("INSERT INTO repair_request_photos")) {
        const [id, request_id, storage_key, original_name, content_type, size_bytes] = values;
        const photo = { id, request_id, storage_key, original_name, content_type, size_bytes };
        photos.push(photo);
        return { rows: [photo] };
      }
      if (sql.startsWith("SELECT id FROM repair_requests")) {
        const record = requests.get(values[0]);
        return { rows: record?.customer_id === values[1] ? [{ id: record.id }] : [] };
      }
      if (sql.startsWith("SELECT COUNT(*)")) {
        return { rows: [{ count: photos.filter((photo) => photo.request_id === values[0]).length }] };
      }
      if (sql.startsWith("SELECT repair_requests.id")) {
        const record = requests.get(values[0]);
        return { rows: record?.customer_id === values[1] ? [{ id: record.id }] : [] };
      }
      if (sql.includes("FROM repair_request_photos WHERE request_id")) {
        return { rows: photos.filter((photo) => photo.request_id === values[0]) };
      }
      if (sql.includes("FROM repair_request_photos WHERE id =")) {
        const photo = photos.find((item) => item.id === values[0] && item.request_id === values[1]);
        return { rows: photo ? [photo] : [] };
      }
      throw new Error(`Unexpected query: ${sql}`);
    },
  };
  const app = express();
  app.use("/api/repair-requests", createRepairRequestsRouter(database, storageDirectory));
  const server = app.listen(0);
  await new Promise((resolve) => server.once("listening", resolve));
  t.after(() => new Promise((resolve, reject) => {
    server.close((error) => error ? reject(error) : resolve());
  }));
  const address = server.address();

  function send(method, route, { userIndex = 0, fields = {}, files = [], authenticated = true } = {}) {
    const body = new FormData();
    Object.entries(fields).forEach(([name, value]) => body.append(name, value));
    files.forEach(({ bytes = png, type = "image/png", name = "damage.png" }) => {
      body.append("photos", new Blob([bytes], { type }), name);
    });
    return fetch(`http://127.0.0.1:${address.port}/api/repair-requests${route}`, {
      method,
      headers: authenticated ? { Cookie: `homefix_session=${tokens[userIndex]}` } : {},
      ...(method === "GET" ? {} : { body }),
    });
  }

  return { send, requests, photos, storageDirectory };
}

test("customer creates a request, uploads and views authorized photo references", async (t) => {
  const harness = await createHarness(t);
  const created = await harness.send("POST", "/", {
    fields: { requestId: "HF-2026-123456", shopId: "cooltech" },
    files: [{ name: "broken.png" }],
  });
  const createdBody = await created.json();

  assert.equal(created.status, 201);
  assert.equal(createdBody.photos.length, 1);
  assert.equal(createdBody.photos[0].name, "broken.png");
  assert.match(createdBody.photos[0].url, /\/photos\/[0-9a-f-]+$/);
  assert.equal(harness.requests.get("HF-2026-123456").customer_id, "7");

  const listed = await harness.send("GET", "/HF-2026-123456/photos");
  assert.equal((await listed.json()).length, 1);
  const image = await harness.send("GET", createdBody.photos[0].url.replace("/api/repair-requests", ""));
  assert.equal(image.status, 200);
  assert.equal(image.headers.get("content-type"), "image/png");
  assert.equal(image.headers.get("cache-control"), "private, no-store");
  assert.equal(image.headers.get("x-content-type-options"), "nosniff");
  assert.deepEqual(Buffer.from(await image.arrayBuffer()), png);
});

test("customers cannot upload to or view another customer's request", async (t) => {
  const harness = await createHarness(t);
  await harness.send("POST", "/", { fields: { requestId: "HF-2026-123456" } });

  const upload = await harness.send("POST", "/HF-2026-123456/photos", {
    userIndex: 1,
    files: [{ name: "damage.png" }],
  });
  const view = await harness.send("GET", "/HF-2026-123456/photos", { userIndex: 1 });
  assert.equal(upload.status, 404);
  assert.equal(view.status, 404);
  assert.equal(harness.photos.length, 0);
});

test("rejects unauthenticated, unsupported and malformed uploads with clear errors", async (t) => {
  const harness = await createHarness(t);
  const unauthenticated = await harness.send("POST", "/", {
    authenticated: false,
    fields: { requestId: "HF-2026-123456" },
    files: [{ bytes: Buffer.alloc(5 * 1024 * 1024 + 1) }],
  });
  assert.equal(unauthenticated.status, 401);

  const unsupported = await harness.send("POST", "/", {
    fields: { requestId: "HF-2026-123456" },
    files: [{ type: "image/gif", name: "animation.gif" }],
  });
  assert.equal(unsupported.status, 400);
  assert.match((await unsupported.json()).message, /Only JPG and PNG/);

  const invalidImage = await harness.send("POST", "/", {
    fields: { requestId: "HF-2026-123456" },
    files: [{ bytes: Buffer.from("not an image"), type: "image/png" }],
  });
  assert.equal(invalidImage.status, 400);
  assert.match((await invalidImage.json()).message, /not valid PNG or JPG/);

  const tooLarge = await harness.send("POST", "/", {
    fields: { requestId: "HF-2026-123456" },
    files: [{ bytes: Buffer.alloc(5 * 1024 * 1024 + 1) }],
  });
  assert.equal(tooLarge.status, 400);
  assert.match((await tooLarge.json()).message, /5 MB or smaller/);
  assert.equal(harness.requests.size, 0);
});

test("limits the total photos on a repair request to five", async (t) => {
  const harness = await createHarness(t);
  await harness.send("POST", "/", {
    fields: { requestId: "HF-2026-123456" },
    files: Array.from({ length: 5 }, (_, index) => ({ name: `damage-${index}.png` })),
  });

  const response = await harness.send("POST", "/HF-2026-123456/photos", {
    files: [{ name: "extra.png" }],
  });
  assert.equal(response.status, 400);
  assert.match((await response.json()).message, /up to 5 photos/);
  assert.equal(harness.photos.length, 5);
  assert.equal(await readFile(path.join(harness.storageDirectory, `${harness.photos[0].storage_key}.png`)).then((file) => file.length), png.length);
});
