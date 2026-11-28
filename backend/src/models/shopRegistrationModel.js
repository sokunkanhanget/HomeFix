import { pool } from "../config/database.js";

// Public columns only. owner_id and anything about the owner's user account
// are deliberately never selected for public reads.
const PUBLIC_SHOP_COLUMNS = `
  id, name, category, address, description, phone, email,
  operating_hours, service_type, supports_emergency, status, reviewed_at, submitted_at`;

// Returns the shop only when it is approved; pending and rejected shops are
// treated as if they did not exist.
export async function findApprovedShopById(shopId, database = pool) {
  const result = await database.query(
    `SELECT ${PUBLIC_SHOP_COLUMNS}
     FROM shop_registrations
     WHERE id = $1 AND status = 'approved'`,
    [shopId],
  );
  return result.rows[0] || null;
}
