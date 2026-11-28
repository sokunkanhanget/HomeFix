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
    { id: "9", role: "owner" },
    { id: "10", role: "owner" },
  ];
  const tokens = users.map((user) => issueAuthToken(user, secret, 120));
  const sessions = new Map(tokens.map((token, index) => [
    createHash("sha256").update(token).digest("hex"),
    users[index],
  ]));
  const requests = new Map();
  const photos = [];
  const statusHistory = [];
  const shopOwners = new Map([["cooltech", "9"], ["coldstore", "10"]]);
  const database = {
    async query(sql, values = []) {
      if (sql.includes("FROM users") && sql.includes("JOIN user_sessions")) {
        const user = sessions.get(values[2]);
        return { rows: user && user.id === values[0] && user.role === values[1] ? [user] : [] };
      }
      if (["BEGIN", "COMMIT", "ROLLBACK"].includes(sql)) return { rows: [] };
      if (sql.includes("FROM shop_registrations") && sql.includes("id::text = $1")) {
        return { rows: shopOwners.has(values[0]) ? [{
          id: values[0],
          name: values[0] === "cooltech" ? "CoolTech" : "ColdStore",
          category: "Air Conditioner",
          address: "Street 1",
        }] : [] };
      }
      if (sql.includes("FROM repair_request_status_history")) {
        const history = sql.includes("ANY($1::text[])")
          ? statusHistory.filter((entry) => values[0].includes(entry.request_id))
          : statusHistory.filter((entry) => entry.request_id === values[0]);
        return { rows: history };
      }
      if (sql.startsWith("INSERT INTO repair_request_status_history")) {
        const [request_id, status, rejection_reason] = values;
        const entry = { request_id, status, rejection_reason, created_at: new Date().toISOString(), id: statusHistory.length + 1 };
        statusHistory.push(entry);
        return { rows: [entry] };
      }
      if (sql.startsWith("UPDATE repair_requests")) {
        const [id, status, rejection_reason] = values;
        const record = requests.get(id);
        Object.assign(record, { status, rejection_reason });
        return { rows: [record] };
      }
      if (sql.includes("FOR UPDATE OF repair_requests")) {
        const [id, ownerId] = values;
        const record = requests.get(id);
        return { rows: record && shopOwners.get(record.shop_id) === ownerId
          ? [{ id, priority: record.priority, status: record.status }]
          : [] };
      }
      if (sql.startsWith("SELECT id, priority, status, rejection_reason, created_at")) {
        const [id, customerId] = values;
        const record = requests.get(id);
        return { rows: record?.customer_id === customerId ? [record] : [] };
      }
      if (sql.includes("SELECT COUNT(*)::int AS total")) {
        const [ownerId, status, emergency] = values;
        const matches = [...requests.values()].filter((record) =>
          (sql.includes("repair_requests.customer_id = $1") ? record.customer_id === ownerId : shopOwners.get(record.shop_id) === ownerId) &&
          (!status || record.status === status) &&
          (emergency === null || (record.priority === "emergency") === emergency));
        return { rows: [{ total: matches.length }] };
      }
      if (sql.includes("LIMIT $4 OFFSET $5")) {
        const [ownerId, status, emergency, limit, offset] = values;
        const matches = [...requests.values()]
          .filter((record) =>
            (sql.includes("repair_requests.customer_id = $1") ? record.customer_id === ownerId : shopOwners.get(record.shop_id) === ownerId) &&
            (!status || record.status === status) &&
            (emergency === null || (record.priority === "emergency") === emergency))
          .sort((first, second) => second.created_at.localeCompare(first.created_at))
          .slice(offset, offset + limit)
          .map((record) => ({
            ...record,
            customer_name: "Customer Name",
            customer_email: "customer@example.com",
            customer_phone: "012 345 678",
            shop_name: record.shop_id === "cooltech" ? "CoolTech" : "ColdStore",
          }));
        return { rows: matches };
      }
      if (sql.includes("request_id = ANY($1::text[])")) {
        return { rows: photos.filter((photo) => values[0].includes(photo.request_id)) };
      }
      if (sql.startsWith("INSERT INTO repair_requests")) {
        if (requests.has(values[0])) {
          const error = new Error("duplicate request");
          error.code = "23505";
          throw error;
        }
        const [
          id, customer_id, shop_id, category, problem_description, appliance_details,
          contact_name, contact_phone, location, service_type, appointment_date,
          appointment_time, priority,
        ] = values;
        const record = {
          id, customer_id, shop_id, category, problem_description, appliance_details,
          contact_name, contact_phone, location, service_type, appointment_date,
          appointment_time, priority, status: "Pending", created_at: new Date().toISOString(),
          rejection_reason: null,
        };
        requests.set(id, record);
        return { rows: [record] };
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
  app.use(express.json());
  app.use("/api/repair-requests", createRepairRequestsRouter(database, storageDirectory));
  const server = app.listen(0);
  await new Promise((resolve) => server.once("listening", resolve));
  t.after(() => new Promise((resolve, reject) => {
    server.close((error) => error ? reject(error) : resolve());
  }));
  const address = server.address();

  function send(method, route, { userIndex = 0, fields = {}, files = [], authenticated = true } = {}) {
    const body = new FormData();
    const requestFields = route === "/" && method === "POST" ? {
      requestId: "HF-2026-123456",
      shopId: "cooltech",
      category: "Air Conditioner",
      problemDescription: "The appliance is not cooling.",
      applianceDetails: "Daikin inverter",
      contactName: "Customer Name",
      contactPhone: "012 345 678",
      location: "Street 2, Phnom Penh",
      serviceType: "Home visit",
      appointmentDate: "2026-11-28",
      appointmentTime: "Morning",
      priority: "regular",
      ...fields,
    } : fields;
    Object.entries(requestFields).forEach(([name, value]) => body.append(name, value));
    files.forEach(({ bytes = png, type = "image/png", name = "damage.png" }) => {
      body.append("photos", new Blob([bytes], { type }), name);
    });
    return fetch(`http://127.0.0.1:${address.port}/api/repair-requests${route}`, {
      method,
      headers: {
        ...(authenticated ? { Cookie: `homefix_session=${tokens[userIndex]}` } : {}),
        ...(method === "PATCH" ? { "Content-Type": "application/json" } : {}),
      },
      ...(method === "GET" ? {} : { body: method === "PATCH" ? JSON.stringify(fields) : body }),
    });
  }

  return { send, requests, photos, statusHistory, storageDirectory };
}

test("customer creates a request, uploads and views authorized photo references", async (t) => {
  const harness = await createHarness(t);
  const created = await harness.send("POST", "/", {
    fields: { requestId: "HF-2026-123456", shopId: "cooltech" },
    files: [{ name: "broken.png" }],
  });
  const createdBody = await created.json();

  assert.equal(created.status, 201);
  assert.equal(createdBody.request.status, "Pending");
  assert.equal(createdBody.request.customerId, "7");
  assert.equal(createdBody.request.shop.name, "CoolTech");
  assert.equal(createdBody.request.problemDescription, "The appliance is not cooling.");
  assert.equal(createdBody.request.location, "Street 2, Phnom Penh");
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

test("repair request creation rejects missing details, unapproved shops, and mismatched categories", async (t) => {
  const harness = await createHarness(t);

  const missingDescription = await harness.send("POST", "/", {
    fields: { problemDescription: "   " },
  });
  assert.equal(missingDescription.status, 400);

  const missingContact = await harness.send("POST", "/", {
    fields: { contactPhone: "" },
  });
  assert.equal(missingContact.status, 400);

  const missingLocation = await harness.send("POST", "/", {
    fields: { location: "   " },
  });
  assert.equal(missingLocation.status, 400);

  const unapprovedShop = await harness.send("POST", "/", {
    fields: { shopId: "unapproved" },
  });
  assert.equal(unapprovedShop.status, 400);
  assert.match((await unapprovedShop.json()).message, /approved repair shop/);

  const unsupportedCategory = await harness.send("POST", "/", {
    fields: { category: "Refrigerator" },
  });
  assert.equal(unsupportedCategory.status, 400);
  assert.match((await unsupportedCategory.json()).message, /does not support/);
  assert.equal(harness.requests.size, 0);
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

test("shop owners cannot submit customer repair requests", async (t) => {
  const harness = await createHarness(t);
  const response = await harness.send("POST", "/", {
    userIndex: 2,
  });

  assert.equal(response.status, 401);
  assert.equal(harness.requests.size, 0);
});

test("shop owners can list their requests with customer details, photos, filters, and pagination", async (t) => {
  const harness = await createHarness(t);
  await harness.send("POST", "/", {
    fields: { requestId: "HF-regular-1" },
    files: [{ name: "damage.png" }],
  });
  await harness.send("POST", "/", {
    fields: { requestId: "HF-emergency-1", priority: "emergency", appointmentDate: "", appointmentTime: "" },
  });
  await harness.send("POST", "/", {
    fields: { requestId: "HF-accepted-1" },
  });
  harness.requests.get("HF-accepted-1").status = "Accepted";

  const filtered = await harness.send("GET", "/?status=Pending&emergency=true", { userIndex: 2 });
  const filteredBody = await filtered.json();
  assert.equal(filtered.status, 200);
  assert.equal(filteredBody.pagination.total, 1);
  assert.equal(filteredBody.requests[0].id, "HF-emergency-1");
  assert.equal(filteredBody.requests[0].emergency, true);

  const paginated = await harness.send("GET", "/?page=2&limit=1", { userIndex: 2 });
  const pageBody = await paginated.json();
  assert.equal(pageBody.pagination.total, 3);
  assert.equal(pageBody.pagination.totalPages, 3);
  assert.equal(pageBody.pagination.page, 2);

  const all = await harness.send("GET", "/", { userIndex: 2 });
  const allBody = await all.json();
  const withPhoto = allBody.requests.find((item) => item.id === "HF-regular-1");
  assert.deepEqual(withPhoto.customer, {
    id: "7",
    name: "Customer Name",
    email: "customer@example.com",
    phone: "012 345 678",
  });
  assert.equal(withPhoto.category, "Air Conditioner");
  assert.equal(withPhoto.problemDescription, "The appliance is not cooling.");
  assert.equal(withPhoto.appointmentDate, "2026-11-28");
  assert.equal(withPhoto.photos.length, 1);
  assert.match(withPhoto.photos[0].url, /\/photos\/[0-9a-f-]+$/);
});

test("shop owners cannot list requests for another shop and list query is validated", async (t) => {
  const harness = await createHarness(t);
  await harness.send("POST", "/", { fields: { requestId: "HF-owner-9" } });
  await harness.send("POST", "/", {
    fields: { requestId: "HF-owner-10", shopId: "coldstore" },
  });

  const otherOwner = await harness.send("GET", "/", { userIndex: 3 });
  const otherOwnerBody = await otherOwner.json();
  assert.equal(otherOwnerBody.requests.length, 1);
  assert.equal(otherOwnerBody.requests[0].id, "HF-owner-10");

  const invalidFilter = await harness.send("GET", "/?emergency=yes", { userIndex: 2 });
  assert.equal(invalidFilter.status, 400);
  const invalidPage = await harness.send("GET", "/?page=0", { userIndex: 2 });
  assert.equal(invalidPage.status, 400);
  const customer = await harness.send("GET", "/", { userIndex: 0 });
  assert.equal(customer.status, 200);
});

test("shop owners can progress emergency requests and customers can retrieve recorded status", async (t) => {
  const harness = await createHarness(t);
  await harness.send("POST", "/", {
    fields: { requestId: "HF-emergency-status", priority: "emergency", appointmentDate: "", appointmentTime: "" },
  });

  const accepted = await harness.send("PATCH", "/HF-emergency-status/status", {
    userIndex: 2,
    fields: { status: "Accepted" },
  });
  assert.equal(accepted.status, 200);
  assert.equal((await accepted.json()).request.status, "Accepted");

  const inProgress = await harness.send("PATCH", "/HF-emergency-status/status", {
    userIndex: 2,
    fields: { status: "In Progress" },
  });
  assert.equal(inProgress.status, 200);

  const completed = await harness.send("PATCH", "/HF-emergency-status/status", {
    userIndex: 2,
    fields: { status: "Completed" },
  });
  const completedBody = await completed.json();
  assert.equal(completed.status, 200);
  assert.deepEqual(completedBody.request.statusHistory.map((entry) => entry.status), ["Accepted", "In Progress", "Completed"]);

  const customerStatus = await harness.send("GET", "/HF-emergency-status");
  const customerBody = await customerStatus.json();
  assert.equal(customerStatus.status, 200);
  assert.equal(customerBody.request.status, "Completed");
  assert.equal(customerBody.request.emergency, true);
  assert.deepEqual(customerBody.request.statusHistory.map((entry) => entry.status), ["Accepted", "In Progress", "Completed"]);

  const ownerList = await harness.send("GET", "/?emergency=true&status=Completed", { userIndex: 2 });
  const ownerListBody = await ownerList.json();
  assert.equal(ownerListBody.pagination.total, 1);
  assert.equal(ownerListBody.requests[0].statusHistory.length, 3);
});

test("only the assigned shop can manage an emergency, with rejection reasons and guarded transitions", async (t) => {
  const harness = await createHarness(t);
  await harness.send("POST", "/", {
    fields: { requestId: "HF-emergency-reject", priority: "emergency", appointmentDate: "", appointmentTime: "" },
  });
  await harness.send("POST", "/", { fields: { requestId: "HF-regular-status" } });

  const wrongShop = await harness.send("PATCH", "/HF-emergency-reject/status", {
    userIndex: 3,
    fields: { status: "Accepted" },
  });
  assert.equal(wrongShop.status, 404);

  const missingReason = await harness.send("PATCH", "/HF-emergency-reject/status", {
    userIndex: 2,
    fields: { status: "Rejected", rejectionReason: "  " },
  });
  assert.equal(missingReason.status, 400);

  const rejected = await harness.send("PATCH", "/HF-emergency-reject/status", {
    userIndex: 2,
    fields: { status: "Rejected", rejectionReason: "No emergency technician available." },
  });
  const rejectedBody = await rejected.json();
  assert.equal(rejected.status, 200);
  assert.equal(rejectedBody.request.rejectionReason, "No emergency technician available.");
  assert.equal(rejectedBody.request.statusHistory[0].rejectionReason, "No emergency technician available.");

  const customerStatus = await harness.send("GET", "/HF-emergency-reject");
  const customerBody = await customerStatus.json();
  assert.equal(customerBody.request.status, "Rejected");
  assert.equal(customerBody.request.rejectionReason, "No emergency technician available.");

  const staleTransition = await harness.send("PATCH", "/HF-emergency-reject/status", {
    userIndex: 2,
    fields: { status: "Accepted" },
  });
  assert.equal(staleTransition.status, 409);

  const regularRequest = await harness.send("PATCH", "/HF-regular-status/status", {
    userIndex: 2,
    fields: { status: "Accepted" },
  });
  assert.equal(regularRequest.status, 200);

  const unauthorizedLookup = await harness.send("GET", "/HF-emergency-reject", { userIndex: 1 });
  assert.equal(unauthorizedLookup.status, 404);
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
