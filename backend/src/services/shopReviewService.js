import { pool } from "../config/database.js";
import {
  countShopRegistrationsForReview,
  findShopRegistrationsForReview,
  reviewShopRegistration,
} from "../models/shopModel.js";
import { AppError } from "../utils/AppError.js";
import { ACTIVITY, ENTITY, recordActivity } from "./activityLogService.js";
import { parsePagination } from "./shopService.js";

const STATUSES = new Set(["pending", "approved", "rejected"]);
const DECISIONS = { approved: ACTIVITY.SHOP_REGISTRATION_APPROVED, rejected: ACTIVITY.SHOP_REGISTRATION_REJECTED };

function toRegistration(row) {
  return {
    id: String(row.id),
    name: row.name,
    category: row.category,
    address: row.address,
    description: row.description || "",
    phone: row.phone || null,
    email: row.email || null,
    operatingHours: row.operating_hours || null,
    serviceType: row.service_type || null,
    supportsEmergency: row.supports_emergency === true,
    status: row.status,
    submittedAt: row.submitted_at ? new Date(row.submitted_at).toISOString() : null,
    reviewedAt: row.reviewed_at ? new Date(row.reviewed_at).toISOString() : null,
    owner: { id: String(row.owner_id), name: row.owner_name, email: row.owner_email },
  };
}

export async function listShopRegistrations(query, database = pool) {
  const status = typeof query.status === "string" && query.status ? query.status : undefined;
  if (query.status !== undefined && !STATUSES.has(status)) {
    throw AppError.badRequest("Validation failed.", { status: "Status must be pending, approved or rejected." });
  }
  const { page, limit, offset } = parsePagination({ page: query.page, limit: query.limit });
  const total = await countShopRegistrationsForReview({ status }, database);
  const rows = total > offset ? await findShopRegistrationsForReview({ status, limit, offset }, database) : [];
  return { data: rows.map(toRegistration), pagination: { page, limit, total, totalPages: Math.ceil(total / limit) } };
}

export async function decideShopRegistration(shopId, body, admin, database = pool) {
  if (typeof shopId !== "string" || !/^[1-9]\d{0,17}$/.test(shopId)) throw AppError.notFound("Shop registration not found.");
  const decision = body?.status;
  if (!(decision in DECISIONS)) {
    throw AppError.badRequest("Validation failed.", { status: "Status must be approved or rejected." });
  }
  const reason = typeof body?.reason === "string" ? body.reason.trim() : "";
  if (reason.length > 500) throw AppError.badRequest("Validation failed.", { reason: "Reason must be 500 characters or fewer." });

  const result = await reviewShopRegistration(shopId, decision, database);
  if (!result) throw AppError.notFound("Shop registration not found.");
  if (result.conflict) {
    throw AppError.conflict(`This registration was already ${result.conflict}.`);
  }

  await recordActivity(database, {
    actor: admin,
    action: DECISIONS[decision],
    entityType: ENTITY.SHOP_REGISTRATION,
    entityId: result.id,
    details: { shopName: result.name, ownerId: String(result.owner_id), previousStatus: "pending", status: decision, ...(reason ? { reason } : {}) },
  });
  return {
    id: String(result.id),
    name: result.name,
    status: result.status,
    reviewedAt: new Date(result.reviewed_at).toISOString(),
  };
}
