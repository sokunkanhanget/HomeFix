import { pool } from "../config/database.js";
import { countActivities, findActivities, insertActivity } from "../models/activityLogModel.js";
import { AppError } from "../utils/AppError.js";
import { parsePagination } from "./shopService.js";

// Every action the platform records. Use these constants (not strings) when
// calling recordActivity so the names stay consistent and filterable.
export const ACTIVITY = Object.freeze({
  USER_REGISTERED: "user.registered",
  SHOP_REGISTRATION_SUBMITTED: "shop.registration_submitted",
  SHOP_REGISTRATION_APPROVED: "shop.registration_approved",
  SHOP_REGISTRATION_REJECTED: "shop.registration_rejected",
  SHOP_EMERGENCY_SERVICE_UPDATED: "shop.emergency_service_updated",
  BOOKING_CREATED: "booking.created",
  BOOKING_STATUS_CHANGED: "booking.status_changed",
  EMERGENCY_REQUEST_CREATED: "emergency_request.created",
  EMERGENCY_REQUEST_STATUS_CHANGED: "emergency_request.status_changed",
});

export const ENTITY = Object.freeze({
  USER: "user",
  SHOP_REGISTRATION: "shop_registration",
  REPAIR_REQUEST: "repair_request",
});

const KNOWN_ACTIONS = new Set(Object.values(ACTIVITY));
const KNOWN_ENTITIES = new Set(Object.values(ENTITY));

// Records an activity. Logging never breaks the action being logged: the
// change has already been saved, so a logging failure is reported on the
// server console instead of failing the user's request.
export async function recordActivity(database, { actor, action, entityType, entityId, details }) {
  try {
    await insertActivity({
      actorId: actor?.id != null ? String(actor.id) : null,
      actorRole: actor?.role || null,
      actorName: actor?.name || null,
      action,
      entityType,
      entityId: entityId != null ? String(entityId) : null,
      details,
    }, database || pool);
  } catch (error) {
    console.error(`Could not record activity "${action}":`, error.code || error.message);
  }
}

function toEntry(row) {
  return {
    id: String(row.id),
    action: row.action,
    actor: row.actor_user_id == null && !row.actor_role
      ? null
      : { id: row.actor_user_id == null ? null : String(row.actor_user_id), role: row.actor_role, name: row.actor_name },
    entity: { type: row.entity_type, id: row.entity_id },
    details: typeof row.details === "string" ? JSON.parse(row.details) : row.details || {},
    createdAt: new Date(row.created_at).toISOString(),
  };
}

function readOne(query, name) {
  const value = query[name];
  if (value === undefined || value === "") return undefined;
  if (typeof value !== "string") throw AppError.badRequest("Validation failed.", { [name]: `Provide ${name} only once.` });
  return value.trim();
}

function readDate(query, name, errors) {
  const value = readOne(query, name);
  if (value === undefined) return null;
  if (Number.isNaN(Date.parse(value))) {
    errors[name] = `${name} must be a date or date-time, e.g. 2026-11-28 or 2026-11-28T08:00:00Z.`;
    return null;
  }
  return new Date(value).toISOString();
}

export function parseActivityFilters(query = {}) {
  const errors = {};
  const allowed = new Set(["page", "limit", "action", "entityType", "entityId", "actorId", "from", "to"]);
  for (const key of Object.keys(query)) {
    if (!allowed.has(key)) errors[key] = "Unknown filter.";
  }
  const action = readOne(query, "action");
  if (action !== undefined && !KNOWN_ACTIONS.has(action)) errors.action = `Unknown action. Use one of: ${[...KNOWN_ACTIONS].join(", ")}.`;
  const entityType = readOne(query, "entityType");
  if (entityType !== undefined && !KNOWN_ENTITIES.has(entityType)) errors.entityType = `Unknown entity type. Use one of: ${[...KNOWN_ENTITIES].join(", ")}.`;
  const entityId = readOne(query, "entityId");
  if (entityId !== undefined && entityId.length > 100) errors.entityId = "entityId must be 100 characters or fewer.";
  const actorId = readOne(query, "actorId");
  if (actorId !== undefined && !/^[1-9]\d{0,17}$/.test(actorId)) errors.actorId = "actorId must be a user ID.";
  const from = readDate(query, "from", errors);
  const to = readDate(query, "to", errors);
  if (Object.keys(errors).length) throw AppError.badRequest("Validation failed.", errors);
  return { action, entityType, entityId, actorId, from, to };
}

// Administrator listing, newest first, with pagination and optional filters.
export async function listActivityLogs(query, database = pool) {
  // Validate filters and pagination together so every problem is reported at once.
  let filters;
  let pagination;
  const errors = {};
  try { filters = parseActivityFilters(query); } catch (error) { if (!error.errors) throw error; Object.assign(errors, error.errors); }
  try { pagination = parsePagination({ page: query.page, limit: query.limit }); } catch (error) { if (!error.errors) throw error; Object.assign(errors, error.errors); }
  if (Object.keys(errors).length) throw AppError.badRequest("Validation failed.", errors);
  const { page, limit, offset } = pagination;
  const total = await countActivities(filters, database);
  const rows = total > offset ? await findActivities(filters, { limit, offset }, database) : [];
  return {
    data: rows.map(toEntry),
    pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
  };
}
