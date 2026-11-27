import { createHash, randomUUID } from "node:crypto";
import { createReadStream } from "node:fs";
import { mkdir, unlink, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { Router } from "express";
import multer from "multer";
import { verifyAuthToken } from "../authToken.js";
import { pool } from "../config/database.js";

const SESSION_COOKIE = "homefix_session";
const MAX_PHOTOS = 5;
const MAX_PHOTO_SIZE = 5 * 1024 * 1024;
const STORAGE_DIRECTORY = process.env.HOMEFIX_UPLOAD_DIR
  || path.join(path.dirname(fileURLToPath(import.meta.url)), "..", "..", "storage", "repair-photos");

export async function initializeRepairRequestSchema(database = pool) {
  await database.query(`
    CREATE TABLE IF NOT EXISTS repair_requests (
      id TEXT PRIMARY KEY,
      customer_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      shop_id TEXT NOT NULL,
      category TEXT NOT NULL,
      problem_description TEXT NOT NULL,
      appliance_details TEXT NOT NULL DEFAULT '',
      contact_name TEXT NOT NULL,
      contact_phone TEXT NOT NULL,
      location TEXT NOT NULL,
      service_type TEXT NOT NULL DEFAULT 'Home visit',
      appointment_date TEXT NOT NULL DEFAULT '',
      appointment_time TEXT NOT NULL DEFAULT '',
      priority TEXT NOT NULL DEFAULT 'regular',
      status TEXT NOT NULL DEFAULT 'Pending',
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );

    ALTER TABLE repair_requests ADD COLUMN IF NOT EXISTS category TEXT NOT NULL DEFAULT '';
    ALTER TABLE repair_requests ADD COLUMN IF NOT EXISTS problem_description TEXT NOT NULL DEFAULT '';
    ALTER TABLE repair_requests ADD COLUMN IF NOT EXISTS appliance_details TEXT NOT NULL DEFAULT '';
    ALTER TABLE repair_requests ADD COLUMN IF NOT EXISTS contact_name TEXT NOT NULL DEFAULT '';
    ALTER TABLE repair_requests ADD COLUMN IF NOT EXISTS contact_phone TEXT NOT NULL DEFAULT '';
    ALTER TABLE repair_requests ADD COLUMN IF NOT EXISTS location TEXT NOT NULL DEFAULT '';
    ALTER TABLE repair_requests ADD COLUMN IF NOT EXISTS service_type TEXT NOT NULL DEFAULT 'Home visit';
    ALTER TABLE repair_requests ADD COLUMN IF NOT EXISTS appointment_date TEXT NOT NULL DEFAULT '';
    ALTER TABLE repair_requests ADD COLUMN IF NOT EXISTS appointment_time TEXT NOT NULL DEFAULT '';
    ALTER TABLE repair_requests ADD COLUMN IF NOT EXISTS priority TEXT NOT NULL DEFAULT 'regular';
    ALTER TABLE repair_requests ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'Pending';

    CREATE TABLE IF NOT EXISTS repair_request_photos (
      id UUID PRIMARY KEY,
      request_id TEXT NOT NULL REFERENCES repair_requests(id) ON DELETE CASCADE,
      storage_key UUID NOT NULL UNIQUE,
      original_name TEXT NOT NULL,
      content_type TEXT NOT NULL CHECK (content_type IN ('image/jpeg', 'image/png')),
      size_bytes BIGINT NOT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
    CREATE INDEX IF NOT EXISTS repair_request_photos_request_id_idx
      ON repair_request_photos (request_id, created_at);
  `);
}

function getSessionToken(request) {
  const cookies = request.headers.cookie?.split(";") || [];
  const cookie = cookies.find((item) => item.trim().startsWith(`${SESSION_COOKIE}=`));
  return cookie?.trim().slice(SESSION_COOKIE.length + 1) || "";
}

async function getUser(request, database) {
  const token = getSessionToken(request);
  if (!token) return null;

  let claims;
  try {
    claims = verifyAuthToken(token, process.env.AUTH_TOKEN_SECRET);
  } catch {
    return null;
  }
  if (!["customer", "owner"].includes(claims.role)) return null;

  const result = await database.query(
    `SELECT users.id, users.role
     FROM users
     JOIN user_sessions ON user_sessions.user_id = users.id
     WHERE users.id = $1 AND users.role = $2
       AND user_sessions.token_hash = $3 AND user_sessions.expires_at > NOW()`,
    [claims.sub, claims.role, createHash("sha256").update(token).digest("hex")],
  );
  return result.rows[0] || null;
}

function isValidImage(file) {
  if (file.mimetype === "image/png") {
    return file.buffer.length >= 8
      && file.buffer.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]));
  }
  if (file.mimetype === "image/jpeg") {
    return file.buffer.length >= 3
      && file.buffer[0] === 0xff && file.buffer[1] === 0xd8 && file.buffer[2] === 0xff;
  }
  return false;
}

function safeFileName(name) {
  const cleaned = path.basename(name).replace(/[\u0000-\u001f\u007f]/g, "").slice(0, 180);
  return cleaned || "photo";
}

function formatPhoto(row, requestId) {
  return {
    id: row.id,
    name: row.original_name,
    contentType: row.content_type,
    size: Number(row.size_bytes),
    url: `/api/repair-requests/${encodeURIComponent(requestId)}/photos/${row.id}`,
  };
}

async function withTransaction(database, operation) {
  const client = typeof database.connect === "function" ? await database.connect() : database;
  try {
    await client.query("BEGIN");
    const result = await operation(client);
    await client.query("COMMIT");
    return result;
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    if (client !== database) client.release();
  }
}

async function canReadRequest(database, requestId, user) {
  const result = await database.query(
    `SELECT repair_requests.id
     FROM repair_requests
     WHERE repair_requests.id = $1
       AND (
         repair_requests.customer_id = $2
         OR EXISTS (
           SELECT 1 FROM shop_registrations
           WHERE shop_registrations.id::text = repair_requests.shop_id
             AND shop_registrations.owner_id = $2
             AND shop_registrations.status = 'approved'
         )
       )`,
    [requestId, user.id],
  );
  return result.rows.length > 0;
}

function uploadErrorMessage(error) {
  if (error instanceof multer.MulterError) {
    if (error.code === "LIMIT_FILE_SIZE") return `Each photo must be 5 MB or smaller.`;
    if (error.code === "LIMIT_FILE_COUNT") return `You can attach up to ${MAX_PHOTOS} photos.`;
    return "The selected photos could not be uploaded. Please try again.";
  }
  return error.message || "The selected photos could not be uploaded. Please try again.";
}

export function createRepairRequestsRouter(database = pool, storageDirectory = STORAGE_DIRECTORY) {
  const router = Router();
  const upload = multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: MAX_PHOTO_SIZE, files: MAX_PHOTOS, fields: 12, parts: 20 },
    fileFilter: (_request, file, callback) => {
      if (!["image/jpeg", "image/png"].includes(file.mimetype)) {
        callback(new Error("Only JPG and PNG photos are supported."));
        return;
      }
      callback(null, true);
    },
  }).array("photos", MAX_PHOTOS);

  function parseUploads(request, response, next) {
    if (!request.is("multipart/form-data")) {
      return response.status(400).json({ message: "Upload photos using multipart form data." });
    }
    upload(request, response, (error) => {
      if (error) return response.status(400).json({ message: uploadErrorMessage(error) });
      next();
    });
  }

  function requireCustomer(message) {
    return (request, response, next) => {
      getUser(request, database).then((user) => {
        if (!user || user.role !== "customer") {
          response.status(401).json({ message });
          return;
        }
        request.repairCustomer = user;
        next();
      }).catch((error) => {
        console.error("Repair request authentication failed:", error);
        response.status(500).json({ message: "Could not verify your account. Please try again." });
      });
    };
  }

  async function savePhotos(client, requestId, files, writtenFiles) {
    const metadata = [];
    if (!files.length) return metadata;
    await mkdir(storageDirectory, { recursive: true, mode: 0o700 });
    for (const file of files) {
      if (!isValidImage(file)) throw new Error("One or more files are not valid PNG or JPG images.");
      const id = randomUUID();
      const extension = file.mimetype === "image/png" ? ".png" : ".jpg";
      const storageKey = `${id}${extension}`;
      const destination = path.join(storageDirectory, storageKey);
      writtenFiles.push(destination);
      await writeFile(destination, file.buffer, { flag: "wx", mode: 0o600 });
      const result = await client.query(
        `INSERT INTO repair_request_photos
           (id, request_id, storage_key, original_name, content_type, size_bytes)
         VALUES ($1, $2, $3, $4, $5, $6)
         RETURNING id, storage_key, original_name, content_type, size_bytes`,
        [id, requestId, id, safeFileName(file.originalname), file.mimetype, file.size],
      );
      metadata.push(formatPhoto(result.rows[0], requestId));
    }
    return metadata;
  }

  router.post(
    "/",
    requireCustomer("Log in with a customer account to save repair requests and photos."),
    parseUploads,
    async (request, response) => {
      const user = request.repairCustomer;
      const requestId = typeof request.body?.requestId === "string" ? request.body.requestId.trim() : "";
      const shopId = typeof request.body?.shopId === "string" ? request.body.shopId.trim() : "";
      const category = typeof request.body?.category === "string" ? request.body.category.trim() : "";
      const problemDescription = typeof request.body?.problemDescription === "string"
        ? request.body.problemDescription.trim()
        : "";
      const applianceDetails = typeof request.body?.applianceDetails === "string"
        ? request.body.applianceDetails.trim()
        : "";
      const contactName = typeof request.body?.contactName === "string" ? request.body.contactName.trim() : "";
      const contactPhone = typeof request.body?.contactPhone === "string" ? request.body.contactPhone.trim() : "";
      const location = typeof request.body?.location === "string" ? request.body.location.trim() : "";
      const serviceType = typeof request.body?.serviceType === "string" ? request.body.serviceType.trim() : "";
      const appointmentDate = typeof request.body?.appointmentDate === "string" ? request.body.appointmentDate.trim() : "";
      const appointmentTime = typeof request.body?.appointmentTime === "string" ? request.body.appointmentTime.trim() : "";
      const priority = typeof request.body?.priority === "string" ? request.body.priority.trim() : "regular";
      if (!/^[A-Za-z0-9_-]{1,80}$/.test(requestId)) {
        return response.status(400).json({ message: "A valid repair request ID is required." });
      }
      if (!shopId || shopId.length > 120) {
        return response.status(400).json({ message: "The selected repair shop is invalid." });
      }
      if (!category || category.length > 120 || !problemDescription || problemDescription.length > 2000) {
        return response.status(400).json({ message: "Choose an appliance category and describe the problem." });
      }
      if (
        applianceDetails.length > 500 || !contactName || contactName.length > 120 ||
        !contactPhone || contactPhone.length > 40 || !location || location.length > 500 ||
        !["Home visit", "In-shop repair"].includes(serviceType) ||
        appointmentDate.length > 10 || appointmentTime.length > 80 ||
        !["regular", "emergency"].includes(priority) ||
        (priority === "regular" && (!/^\d{4}-\d{2}-\d{2}$/.test(appointmentDate) || !appointmentTime))
      ) {
        return response.status(400).json({ message: "Check the contact, location, and appointment details." });
      }
      for (const file of request.files) {
        if (!isValidImage(file)) {
          return response.status(400).json({ message: "One or more files are not valid PNG or JPG images." });
        }
      }

      const writtenFiles = [];
      try {
        const result = await withTransaction(database, async (client) => {
          const shopResult = await client.query(
            `SELECT id, name, category, address
             FROM shop_registrations
             WHERE id::text = $1 AND status = 'approved'`,
            [shopId],
          );
          const shop = shopResult.rows[0];
          if (!shop) return { invalidShop: true };
          if (shop.category !== category) return { categoryMismatch: true };

          const inserted = await client.query(
            `INSERT INTO repair_requests
               (id, customer_id, shop_id, category, problem_description, appliance_details,
                contact_name, contact_phone, location, service_type, appointment_date,
                appointment_time, priority, status)
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, 'Pending')
             RETURNING id, customer_id, shop_id, category, problem_description, appliance_details,
                       contact_name, contact_phone, location, service_type, appointment_date,
                       appointment_time, priority, status, created_at`,
            [
              requestId, user.id, shopId, category, problemDescription, applianceDetails,
              contactName, contactPhone, location, serviceType, appointmentDate,
              appointmentTime, priority,
            ],
          );
          const photos = await savePhotos(client, requestId, request.files, writtenFiles);
          return { request: {
            ...inserted.rows[0],
            id: inserted.rows[0].id,
            customerId: String(inserted.rows[0].customer_id),
            shopId: String(inserted.rows[0].shop_id),
            problemDescription: inserted.rows[0].problem_description,
            applianceDetails: inserted.rows[0].appliance_details,
            contactName: inserted.rows[0].contact_name,
            contactPhone: inserted.rows[0].contact_phone,
            serviceType: inserted.rows[0].service_type,
            appointmentDate: inserted.rows[0].appointment_date,
            appointmentTime: inserted.rows[0].appointment_time,
            shop: { id: String(shop.id), name: shop.name, category: shop.category, address: shop.address },
          }, photos };
        });
        if (result.invalidShop) {
          return response.status(400).json({ message: "Choose an approved repair shop." });
        }
        if (result.categoryMismatch) {
          return response.status(400).json({ message: "The selected shop does not support this appliance category." });
        }
        return response.status(201).json({
          requestId,
          request: { ...result.request, photos: result.photos },
          photos: result.photos,
        });
      } catch (error) {
        await Promise.all(writtenFiles.map((file) => unlink(file).catch((cleanupError) => {
          console.error("Could not remove an unassociated repair photo:", cleanupError);
        })));
        if (error.code === "23505") {
          return response.status(409).json({ message: "This repair request already exists. Refresh and try again." });
        }
        console.error("Repair request creation failed:", error);
        return response.status(500).json({ message: "Could not save your repair request and photos. Please try again." });
      }
    },
  );

  router.post(
    "/:requestId/photos",
    requireCustomer("Log in with a customer account to add photos."),
    parseUploads,
    async (request, response) => {
      const user = request.repairCustomer;
      const requestId = request.params.requestId;
      if (request.files.length === 0) {
        return response.status(400).json({ message: "Choose at least one PNG or JPG photo to upload." });
      }
      for (const file of request.files) {
        if (!isValidImage(file)) {
          return response.status(400).json({ message: "One or more files are not valid PNG or JPG images." });
        }
      }

      const writtenFiles = [];
      try {
        const photos = await withTransaction(database, async (client) => {
          const requestResult = await client.query(
            "SELECT id FROM repair_requests WHERE id = $1 AND customer_id = $2 FOR UPDATE",
            [requestId, user.id],
          );
          if (!requestResult.rows.length) return null;
          const countResult = await client.query(
            "SELECT COUNT(*)::int AS count FROM repair_request_photos WHERE request_id = $1",
            [requestId],
          );
          if (countResult.rows[0].count + request.files.length > MAX_PHOTOS) {
            const error = new Error(`A repair request can have up to ${MAX_PHOTOS} photos.`);
            error.statusCode = 400;
            throw error;
          }
          return savePhotos(client, requestId, request.files, writtenFiles);
        });
        if (!photos) return response.status(404).json({ message: "Repair request not found." });
        return response.status(201).json({ photos });
      } catch (error) {
        await Promise.all(writtenFiles.map((file) => unlink(file).catch((cleanupError) => {
          console.error("Could not remove an unassociated repair photo:", cleanupError);
        })));
        if (error.statusCode === 400) return response.status(400).json({ message: error.message });
        console.error("Repair photo upload failed:", error);
        return response.status(500).json({ message: "Could not save your photos. Please try again." });
      }
    },
  );

  router.get("/:requestId/photos", async (request, response) => {
    try {
      const user = await getUser(request, database);
      if (!user || !(await canReadRequest(database, request.params.requestId, user))) {
        return response.status(404).json({ message: "Repair request not found." });
      }
      const result = await database.query(
        `SELECT id, original_name, content_type, size_bytes
         FROM repair_request_photos WHERE request_id = $1 ORDER BY created_at, id`,
        [request.params.requestId],
      );
      return response.json(result.rows.map((row) => formatPhoto(row, request.params.requestId)));
    } catch (error) {
      console.error("Repair photos could not be loaded:", error);
      return response.status(500).json({ message: "Could not load photos. Please try again." });
    }
  });

  router.get("/:requestId/photos/:photoId", async (request, response) => {
    try {
      const user = await getUser(request, database);
      if (!user || !(await canReadRequest(database, request.params.requestId, user))) {
        return response.status(404).json({ message: "Repair photo not found." });
      }
      const result = await database.query(
        `SELECT storage_key, original_name, content_type
         FROM repair_request_photos WHERE id = $1 AND request_id = $2`,
        [request.params.photoId, request.params.requestId],
      );
      const photo = result.rows[0];
      if (!photo) return response.status(404).json({ message: "Repair photo not found." });
      response.set({
        "Content-Type": photo.content_type,
        "Content-Disposition": `inline; filename="${photo.content_type === "image/png" ? "repair-photo.png" : "repair-photo.jpg"}"`,
        "Cache-Control": "private, no-store",
        "X-Content-Type-Options": "nosniff",
      });
      const stream = createReadStream(path.join(storageDirectory, `${photo.storage_key}${photo.content_type === "image/png" ? ".png" : ".jpg"}`));
      stream.on("error", (error) => {
        console.error("Stored repair photo could not be read:", error);
        if (!response.headersSent) response.status(404).json({ message: "Repair photo not found." });
        else response.destroy(error);
      });
      return stream.pipe(response);
    } catch (error) {
      console.error("Repair photo could not be loaded:", error);
      return response.status(500).json({ message: "Could not load this photo. Please try again." });
    }
  });

  return router;
}

export default createRepairRequestsRouter();
