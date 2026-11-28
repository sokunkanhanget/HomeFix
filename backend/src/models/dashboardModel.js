import { pool } from "../config/database.js";

export async function findShopByOwner(ownerId, database = pool) {
  const result = await database.query(
    `SELECT id, name, category, address, description, phone, email,
            operating_hours, service_type, supports_emergency, status, submitted_at
     FROM shop_registrations
     WHERE owner_id = $1`,
    [ownerId],
  );
  return result.rows[0] || null;
}

export async function countShopRequests(shopId, database = pool) {
  const result = await database.query(
    `SELECT COUNT(*)::int AS total,
            COUNT(*) FILTER (WHERE status = 'Pending')::int AS pending,
            COUNT(*) FILTER (WHERE status = 'Accepted')::int AS accepted,
            COUNT(*) FILTER (WHERE status = 'In Progress')::int AS in_progress,
            COUNT(*) FILTER (WHERE status = 'Completed')::int AS completed,
            COUNT(*) FILTER (WHERE status = 'Rejected')::int AS rejected,
            COUNT(*) FILTER (WHERE status = 'Cancelled')::int AS cancelled,
            COUNT(*) FILTER (WHERE priority = 'emergency')::int AS emergency,
            COUNT(*) FILTER (WHERE priority = 'emergency' AND status = 'Pending')::int AS emergency_pending
     FROM repair_requests
     WHERE shop_id = $1`,
    [String(shopId)],
  );
  return result.rows[0];
}

export async function findRecentShopRequests(shopId, limit, database = pool) {
  const result = await database.query(
    `SELECT id, category, problem_description, contact_name, contact_phone, location,
            service_type, appointment_date, appointment_time, priority, status, created_at
     FROM repair_requests
     WHERE shop_id = $1
     ORDER BY created_at DESC, id DESC
     LIMIT $2`,
    [String(shopId), limit],
  );
  return result.rows;
}
