import { createHash, randomUUID } from "node:crypto";
import { createReadStream } from "node:fs";
import { mkdir, unlink, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { Router } from "express";
import multer from "multer";
import { verifyAuthToken } from "../utils/authToken.js";
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
    ALTER TABLE repair_requests ADD COLUMN IF NOT EXISTS urgency_information TEXT NOT NULL DEFAULT '';
    ALTER TABLE repair_requests ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'Pending';
    ALTER TABLE repair_requests ADD COLUMN IF NOT EXISTS rejection_reason TEXT;
    ALTER TABLE repair_requests ADD COLUMN IF NOT EXISTS cancellation_reason TEXT;
    ALTER TABLE repair_requests ADD COLUMN IF NOT EXISTS cancellation_details TEXT;

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

    CREATE TABLE IF NOT EXISTS repair_request_status_history (
      id BIGSERIAL PRIMARY KEY,
      request_id TEXT NOT NULL REFERENCES repair_requests(id) ON DELETE CASCADE,
      status TEXT NOT NULL,
      rejection_reason TEXT,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
    CREATE INDEX IF NOT EXISTS repair_request_status_history_request_id_idx
      ON repair_request_status_history (request_id, created_at, id);
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

export const REQUEST_STATUSES = ["Pending", "Accepted", "Rejected", "In Progress", "Completed", "Cancelled"];

export function normalizeStatusFilter(value) {
  if (typeof value !== "string") return null;
  const key = value.trim().toLowerCase().replace(/[\s_-]+/g, " ");
  return REQUEST_STATUSES.find((status) => status.toLowerCase() === key) || null;
}

function formatStatusHistory(rows) {
  return rows.map((row) => ({
    status: row.status,
    ...(row.rejection_reason ? { rejectionReason: row.rejection_reason } : {}),
    createdAt: row.created_at,
  }));
}

export function createRepairRequestsRouter(database = pool, storageDirectory = STORAGE_DIRECTORY) {
  const router = Router();
  const upload = multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: MAX_PHOTO_SIZE, files: MAX_PHOTOS, fields: 13, parts: 20 },
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

  router.get("/", async (request, response) => {
    let user;
    try {
      user = await getUser(request, database);
    } catch (error) {
      console.error("Repair request listing authentication failed:", error);
      return response.status(500).json({ message: "Could not verify your account. Please try again." });
    }
    if (!user) {
      return response.status(401).json({ message: "Log in to view your repair requests." });
    }

    const rawStatus = request.query.status;
    const status = rawStatus === undefined ? undefined : normalizeStatusFilter(rawStatus);
    if (status === null) {
      return response.status(400).json({ message: `Status must be one of: ${REQUEST_STATUSES.join(", ")}.` });
    }
    const order = request.query.order === undefined ? "desc" : request.query.order;
    if (order !== "desc" && order !== "asc") {
      return response.status(400).json({ message: "Order must be desc (newest first) or asc (oldest first)." });
    }
    const direction = order === "asc" ? "ASC" : "DESC";
    const emergencyQuery = request.query.emergency;
    if (emergencyQuery !== undefined && emergencyQuery !== "true" && emergencyQuery !== "false") {
      return response.status(400).json({ message: "Emergency must be true or false." });
    }
    const page = request.query.page === undefined ? 1 : Number(request.query.page);
    const limit = request.query.limit === undefined ? 20 : Number(request.query.limit);
    if (
      !Number.isSafeInteger(page) || page < 1 ||
      !Number.isSafeInteger(limit) || limit < 1 || limit > 100 ||
      !Number.isSafeInteger((page - 1) * limit)
    ) {
      return response.status(400).json({ message: "Page must be positive and limit must be between 1 and 100." });
    }

    try {
      const scope = user.role === "owner"
        ? "shop_registrations.owner_id = $1 AND shop_registrations.status = 'approved'"
        : "repair_requests.customer_id = $1";
      const filters = [user.id, status || null, emergencyQuery === undefined ? null : emergencyQuery === "true"];
      const totalResult = await database.query(
        `SELECT COUNT(*)::int AS total
         FROM repair_requests
         LEFT JOIN shop_registrations
           ON shop_registrations.id::text = repair_requests.shop_id
         WHERE ${scope}
           AND ($2::text IS NULL OR repair_requests.status = $2)
           AND ($3::boolean IS NULL OR (repair_requests.priority = 'emergency') = $3)`,
        filters,
      );
      const total = Number(totalResult.rows[0]?.total || 0);
      const requestsResult = await database.query(
        `SELECT repair_requests.id, repair_requests.customer_id, repair_requests.shop_id,
                repair_requests.category, repair_requests.problem_description,
                repair_requests.appliance_details, repair_requests.contact_name,
                repair_requests.contact_phone, repair_requests.location,
                repair_requests.service_type, repair_requests.appointment_date,
                repair_requests.appointment_time, repair_requests.priority, repair_requests.urgency_information,
                repair_requests.status, repair_requests.rejection_reason, repair_requests.created_at,
                repair_requests.cancellation_reason, repair_requests.cancellation_details,
                users.name AS customer_name, users.email AS customer_email,
                users.phone AS customer_phone, shop_registrations.name AS shop_name
         FROM repair_requests
         LEFT JOIN shop_registrations
           ON shop_registrations.id::text = repair_requests.shop_id
         JOIN users ON users.id = repair_requests.customer_id
         WHERE ${scope}
           AND ($2::text IS NULL OR repair_requests.status = $2)
           AND ($3::boolean IS NULL OR (repair_requests.priority = 'emergency') = $3)
         ORDER BY repair_requests.created_at ${direction}, repair_requests.id ${direction}
         LIMIT $4 OFFSET $5`,
        [...filters, limit, (page - 1) * limit],
      );
      const rows = requestsResult.rows;
      const photosResult = rows.length
        ? await database.query(
          `SELECT id, request_id, original_name, content_type, size_bytes
           FROM repair_request_photos
           WHERE request_id = ANY($1::text[])
           ORDER BY created_at, id`,
          [rows.map((row) => row.id)],
        )
        : { rows: [] };
      const historyResult = rows.length
        ? await database.query(
          `SELECT request_id, status, rejection_reason, created_at
           FROM repair_request_status_history
           WHERE request_id = ANY($1::text[])
           ORDER BY created_at, id`,
          [rows.map((row) => row.id)],
        )
        : { rows: [] };
      const photosByRequest = new Map();
      for (const photo of photosResult.rows) {
        const photos = photosByRequest.get(photo.request_id) || [];
        photos.push(formatPhoto(photo, photo.request_id));
        photosByRequest.set(photo.request_id, photos);
      }
      const historyByRequest = new Map();
      for (const entry of historyResult.rows) {
        const history = historyByRequest.get(entry.request_id) || [];
        history.push(entry);
        historyByRequest.set(entry.request_id, history);
      }

      return response.json({
        requests: rows.map((row) => ({
          id: row.id,
          customerId: String(row.customer_id),
          customer: {
            id: String(row.customer_id),
            name: row.customer_name,
            email: row.customer_email,
            phone: row.customer_phone,
          },
          shopId: String(row.shop_id),
          shop: { id: String(row.shop_id), name: row.shop_name ?? null },
          appliance: row.category,
          category: row.category,
          problemDescription: row.problem_description,
          applianceDetails: row.appliance_details,
          contactName: row.contact_name,
          contactPhone: row.contact_phone,
          location: row.location,
          serviceType: row.service_type,
          appointmentDate: row.appointment_date,
          appointmentTime: row.appointment_time,
          priority: row.priority,
          emergency: row.priority === "emergency",
          urgencyInformation: row.urgency_information || "",
          status: row.status,
          rejectionReason: row.rejection_reason || "",
          cancellationReason: row.cancellation_reason || "",
          cancellationDetails: row.cancellation_details || "",
          statusHistory: formatStatusHistory(historyByRequest.get(row.id) || []),
          createdAt: row.created_at,
          photos: photosByRequest.get(row.id) || [],
        })),
        pagination: {
          page,
          limit,
          total,
          totalPages: Math.ceil(total / limit),
        },
        filters: { status: status || null, order },
      });
    } catch (error) {
      console.error("Repair requests could not be loaded:", error);
      return response.status(500).json({ message: "Could not load repair requests. Please try again." });
    }
  });

  router.get("/:requestId", async (request, response) => {
    try {
      const user = await getUser(request, database);
      if (!user || user.role !== "customer") {
        return response.status(401).json({ message: "Log in with a customer account to view repair request status." });
      }
      const result = await database.query(
        `SELECT id, priority, status, rejection_reason, created_at, urgency_information
         FROM repair_requests
         WHERE id = $1 AND customer_id = $2`,
        [request.params.requestId, user.id],
      );
      const row = result.rows[0];
      if (!row) return response.status(404).json({ message: "Repair request not found." });
      const history = await database.query(
        `SELECT status, rejection_reason, created_at
         FROM repair_request_status_history
         WHERE request_id = $1
         ORDER BY created_at, id`,
        [row.id],
      );
      return response.json({
        request: {
          id: row.id,
          priority: row.priority,
          emergency: row.priority === "emergency",
          urgencyInformation: row.urgency_information || "",
          status: row.status,
          rejectionReason: row.rejection_reason || "",
          statusHistory: formatStatusHistory(history.rows),
          createdAt: row.created_at,
        },
      });
    } catch (error) {
      console.error("Repair request status could not be loaded:", error);
      return response.status(500).json({ message: "Could not load repair request status. Please try again." });
    }
  });

  router.patch("/:requestId/status", async (request, response) => {
    let user;
    try {
      user = await getUser(request, database);
    } catch (error) {
      console.error("Repair request update authentication failed:", error);
      return response.status(500).json({ message: "Could not verify your account. Please try again." });
    }
    if (!user) {
      return response.status(401).json({ message: "Log in to update repair requests." });
    }

    const status = typeof request.body?.status === "string" ? request.body.status.trim() : "";
    const rawReason = request.body?.rejectionReason;
    const rejectionReason = typeof rawReason === "string" ? rawReason.trim() : "";
    const cancellationReason = typeof request.body?.cancellationReason === "string" ? request.body.cancellationReason.trim() : "";
    const cancellationDetails = typeof request.body?.cancellationDetails === "string" ? request.body.cancellationDetails.trim() : "";
    const cancelling = user.role === "customer" && status === "Cancelled";
    if (user.role === "customer" && !cancelling) {
      return response.status(403).json({ message: "Only the assigned shop can update repair status." });
    }
    if (!cancelling && !["Accepted", "Rejected", "In Progress", "Completed"].includes(status)) {
      return response.status(400).json({ message: "Choose a valid repair request status." });
    }
    if (status === "Rejected" && (!rejectionReason || rejectionReason.length > 500)) {
      return response.status(400).json({ message: "A rejection reason of 1 to 500 characters is required." });
    }
    if (cancelling && (!cancellationReason || cancellationReason.length > 500 || cancellationDetails.length > 2000)) {
      return response.status(400).json({ message: "Provide a cancellation reason of 1 to 500 characters and details of at most 2000 characters." });
    }

    try {
      const updated = await withTransaction(database, async (client) => {
        const scope = cancelling
          ? "repair_requests.customer_id = $2"
          : "shop_registrations.owner_id = $2 AND shop_registrations.status = 'approved'";
        const selected = await client.query(
          `SELECT repair_requests.id, repair_requests.priority, repair_requests.status
           FROM repair_requests
           JOIN shop_registrations
             ON shop_registrations.id::text = repair_requests.shop_id
           WHERE repair_requests.id = $1
             AND ${scope}
           FOR UPDATE OF repair_requests`,
          [request.params.requestId, user.id],
        );
        const current = selected.rows[0];
        if (!current) return { notFound: true };
        const allowedTransitions = {
          Pending: ["Accepted", "Rejected"],
          Accepted: ["In Progress"],
          "In Progress": ["Completed"],
        };
        if (cancelling ? !["Pending", "Accepted"].includes(current.status) : !allowedTransitions[current.status]?.includes(status)) return { conflict: true };

        const result = await client.query(
          `UPDATE repair_requests
           SET status = $2, rejection_reason = $3, cancellation_reason = $4, cancellation_details = $5
           WHERE id = $1
           RETURNING id, priority, status, rejection_reason, created_at`,
          [current.id, status, status === "Rejected" ? rejectionReason : null,
            cancelling ? cancellationReason : null, cancelling ? cancellationDetails : null],
        );
        await client.query(
          `INSERT INTO repair_request_status_history (request_id, status, rejection_reason)
           VALUES ($1, $2, $3)
           RETURNING status, rejection_reason, created_at`,
          [current.id, status, status === "Rejected" ? rejectionReason : null],
        );
        const history = await client.query(
          `SELECT status, rejection_reason, created_at
           FROM repair_request_status_history
           WHERE request_id = $1
           ORDER BY created_at, id`,
          [current.id],
        );
        return { request: result.rows[0], history: history.rows };
      });
      if (updated.notFound) return response.status(404).json({ message: "Repair request not found." });
      if (updated.conflict) return response.status(409).json({ message: "This request has changed. Refresh and review its current status." });
      const row = updated.request;
      return response.json({
        request: {
          id: row.id,
          priority: row.priority,
          emergency: row.priority === "emergency",
          status: row.status,
          rejectionReason: row.rejection_reason || "",
          statusHistory: formatStatusHistory(updated.history),
          createdAt: row.created_at,
        },
      });
    } catch (error) {
      console.error("Repair request status update failed:", error);
      return response.status(500).json({ message: "Could not update repair request status. Please try again." });
    }
  });

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
      const priority = request.body?.priority === undefined ? "regular"
        : typeof request.body.priority === "string" ? request.body.priority.trim() : "";
      const rawUrgency = request.body?.urgencyInformation;
      const urgencyInformation = typeof rawUrgency === "string" ? rawUrgency.trim() : "";
      if ((rawUrgency !== undefined && typeof rawUrgency !== "string") || urgencyInformation.length > 1000 ||
          (priority !== "emergency" && urgencyInformation)) {
        return response.status(400).json({ message: "Urgency information is only available for emergency requests and must be 1000 characters or fewer." });
      }
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
            `SELECT id, name, category, address, supports_emergency
             FROM shop_registrations
             WHERE id::text = $1 AND status = 'approved'
             FOR SHARE`,
            [shopId],
          );
          const shop = shopResult.rows[0];
          if (!shop) return { invalidShop: true };
          if (shop.category !== category) return { categoryMismatch: true };
          if (priority === "emergency" && shop.supports_emergency !== true) return { emergencyUnavailable: true };

          const inserted = await client.query(
            `INSERT INTO repair_requests
               (id, customer_id, shop_id, category, problem_description, appliance_details,
                contact_name, contact_phone, location, service_type, appointment_date,
                appointment_time, priority, urgency_information, status)
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, 'Pending')
             RETURNING id, customer_id, shop_id, category, problem_description, appliance_details,
                       contact_name, contact_phone, location, service_type, appointment_date,
                       appointment_time, priority, urgency_information, status, created_at`,
            [
              requestId, user.id, shopId, category, problemDescription, applianceDetails,
              contactName, contactPhone, location, serviceType, appointmentDate,
              appointmentTime, priority, urgencyInformation,
            ],
          );
          const photos = await savePhotos(client, requestId, request.files, writtenFiles);
          return { request: {
            ...inserted.rows[0],
            id: inserted.rows[0].id,
            emergency: priority === "emergency",
            urgencyInformation: inserted.rows[0].urgency_information,
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
        if (result.emergencyUnavailable) {
          return response.status(400).json({ message: "This shop does not offer emergency services. Choose an emergency-enabled shop or submit a regular request." });
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
