import { pool } from "../config/database.js";
import { countShopRequests, findRecentShopRequests, findShopByOwner } from "../models/dashboardModel.js";
import { AppError } from "../utils/AppError.js";

export const DEFAULT_RECENT_LIMIT = 5;
export const MAX_RECENT_LIMIT = 20;
const OWNER_ROLES = new Set(["owner", "shop_owner"]);
const emptySummary = {
  total: 0, pending: 0, accepted: 0, in_progress: 0, completed: 0,
  rejected: 0, cancelled: 0, emergency: 0, emergency_pending: 0,
};

export function parseRecentLimit(query = {}) {
  const raw = query.recent;
  if (raw === undefined) return DEFAULT_RECENT_LIMIT;
  if (typeof raw !== "string" || !/^[1-9]\d*$/.test(raw) || Number(raw) > MAX_RECENT_LIMIT) {
    throw AppError.badRequest("Validation failed.", {
      recent: `Recent must be a whole number from 1 to ${MAX_RECENT_LIMIT}.`,
    });
  }
  return Number(raw);
}

function toDashboardShop(row) {
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
  };
}

function toSummary(counts) {
  return {
    totalIncoming: counts.total,
    pending: counts.pending,
    accepted: counts.accepted,
    inProgress: counts.in_progress,
    completed: counts.completed,
    rejected: counts.rejected,
    cancelled: counts.cancelled,
    emergency: counts.emergency,
    emergencyPending: counts.emergency_pending,
  };
}

function toRecentRequest(row) {
  return {
    id: row.id,
    category: row.category,
    problemDescription: row.problem_description,
    contactName: row.contact_name,
    contactPhone: row.contact_phone,
    location: row.location,
    serviceType: row.service_type,
    appointmentDate: row.appointment_date,
    appointmentTime: row.appointment_time,
    priority: row.priority,
    emergency: row.priority === "emergency",
    status: row.status,
    createdAt: row.created_at,
  };
}

export async function getOwnerDashboard(user, query, database = pool) {
  if (!OWNER_ROLES.has(user?.role)) throw AppError.forbidden("A repair shop owner account is required.");
  const recentLimit = parseRecentLimit(query);

  const shop = await findShopByOwner(user.id, database);
  if (!shop) throw AppError.notFound("No shop is registered to this account.");

  const approved = shop.status === "approved";
  const [counts, recent] = approved
    ? await Promise.all([
      countShopRequests(shop.id, database),
      findRecentShopRequests(shop.id, recentLimit, database),
    ])
    : [emptySummary, []];

  return {
    data: {
      shop: toDashboardShop(shop),
      summary: toSummary(counts),
      recentRequests: recent.map(toRecentRequest),
      notifications: { implemented: false, unreadCount: null },
      generatedAt: new Date().toISOString(),
    },
  };
}
