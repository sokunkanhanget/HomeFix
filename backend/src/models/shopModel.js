import { pool } from "../config/database.js";

// Stable API slugs; display names match the existing frontend categories.
export const serviceCategories = [
  ["air-conditioner", "Air Conditioner"],
  ["refrigerator", "Refrigerator"],
  ["tv-electronics", "TV & Electronics"],
  ["washing-machine", "Washing Machine"],
  ["wifi-internet", "Wi-Fi & Internet"],
  ["electrical", "Electrical"],
  ["plumbing", "Plumbing"],
  ["general-maintenance", "General Maintenance"],
  ["painting", "Painting"],
  ["home-appliances", "Home Appliances"],
  ["water-heater", "Water Heater"],
  ["security-systems", "Security Systems"],
];

// Public listing: only registrations an administrator approved. Pending and
// rejected registrations are filtered here, in SQL, so no caller can list them.
export async function countApprovedShops(database = pool) {
  const result = await database.query(
    "SELECT COUNT(*)::int AS total FROM shop_registrations WHERE status = 'approved'",
  );
  return result.rows[0]?.total ?? 0;
}

// Newest approvals first; the id tie-breaker keeps page boundaries stable.
// category_slug comes from the category catalog when the name matches it.
export async function findApprovedShops({ limit, offset }, database = pool) {
  const result = await database.query(
    `SELECT shop_registrations.id, shop_registrations.name, shop_registrations.category,
            service_categories.slug AS category_slug,
            shop_registrations.address, shop_registrations.description,
            shop_registrations.phone, shop_registrations.email,
            shop_registrations.operating_hours, shop_registrations.service_type,
            shop_registrations.supports_emergency
     FROM shop_registrations
     LEFT JOIN service_categories ON service_categories.name = shop_registrations.category
     WHERE shop_registrations.status = 'approved'
     ORDER BY shop_registrations.submitted_at DESC, shop_registrations.id DESC
     LIMIT $1 OFFSET $2`,
    [limit, offset],
  );
  return result.rows;
}

// One approved shop for the public details page. Same public columns as the
// listing plus review dates; owner_id and the owner's account are never read.
export async function findApprovedShopById(shopId, database = pool) {
  const result = await database.query(
    `SELECT shop_registrations.id, shop_registrations.name, shop_registrations.category,
            service_categories.slug AS category_slug,
            shop_registrations.address, shop_registrations.description,
            shop_registrations.phone, shop_registrations.email,
            shop_registrations.operating_hours, shop_registrations.service_type,
            shop_registrations.supports_emergency,
            shop_registrations.submitted_at, shop_registrations.reviewed_at
     FROM shop_registrations
     LEFT JOIN service_categories ON service_categories.name = shop_registrations.category
     WHERE shop_registrations.id = $1 AND shop_registrations.status = 'approved'`,
    [shopId],
  );
  return result.rows[0] || null;
}

// Administrator review of shop registrations. Includes the owner's account
// details, so these functions must only be used behind an admin check.
export async function findShopRegistrationsForReview({ status, limit, offset }, database = pool) {
  const result = await database.query(
    `SELECT shop_registrations.id, shop_registrations.name, shop_registrations.category,
            shop_registrations.address, shop_registrations.description, shop_registrations.phone,
            shop_registrations.email, shop_registrations.operating_hours, shop_registrations.service_type,
            shop_registrations.supports_emergency, shop_registrations.status,
            shop_registrations.submitted_at, shop_registrations.reviewed_at,
            users.id AS owner_id, users.name AS owner_name, users.email AS owner_email
     FROM shop_registrations
     JOIN users ON users.id = shop_registrations.owner_id
     WHERE ($1::text IS NULL OR shop_registrations.status = $1)
     ORDER BY shop_registrations.submitted_at DESC, shop_registrations.id DESC
     LIMIT $2 OFFSET $3`,
    [status ?? null, limit, offset],
  );
  return result.rows;
}

export async function countShopRegistrationsForReview({ status }, database = pool) {
  const result = await database.query(
    "SELECT COUNT(*)::int AS total FROM shop_registrations WHERE ($1::text IS NULL OR status = $1)",
    [status ?? null],
  );
  return Number(result.rows[0]?.total ?? 0);
}

// Approves or rejects a pending registration. Returns null when the
// registration does not exist, or { conflict: currentStatus } when it was
// already reviewed (so two admins cannot both review it).
export async function reviewShopRegistration(shopId, decision, database = pool) {
  const result = await database.query(
    `UPDATE shop_registrations SET status = $2, reviewed_at = NOW()
     WHERE id = $1 AND status = 'pending'
     RETURNING id, name, owner_id, status, reviewed_at`,
    [shopId, decision],
  );
  if (result.rows[0]) return result.rows[0];
  const existing = await database.query("SELECT status FROM shop_registrations WHERE id = $1", [shopId]);
  return existing.rows[0] ? { conflict: existing.rows[0].status } : null;
}

export async function initializeShopSchema(database = pool) {
  const client = await database.connect();
  try {
    await client.query("BEGIN");
    await client.query(`
      CREATE TABLE IF NOT EXISTS shops (
        id BIGSERIAL PRIMARY KEY,
        owner_user_id BIGINT REFERENCES users(id) ON DELETE RESTRICT,
        name TEXT NOT NULL CHECK (BTRIM(name) <> ''),
        location TEXT NOT NULL,
        address TEXT NOT NULL,
        phone VARCHAR(40) NOT NULL DEFAULT '',
        operating_hours VARCHAR(120) NOT NULL DEFAULT '',
        image_url TEXT,
        description TEXT NOT NULL DEFAULT '',
        status TEXT NOT NULL DEFAULT 'pending'
          CHECK (status IN ('pending', 'approved', 'rejected')),
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
      ALTER TABLE shops ADD COLUMN IF NOT EXISTS owner_user_id BIGINT REFERENCES users(id) ON DELETE RESTRICT;
      ALTER TABLE shops ADD COLUMN IF NOT EXISTS phone VARCHAR(40) NOT NULL DEFAULT '';
      ALTER TABLE shops ADD COLUMN IF NOT EXISTS operating_hours VARCHAR(120) NOT NULL DEFAULT '';
      ALTER TABLE shops ADD COLUMN IF NOT EXISTS image_url TEXT;
      CREATE INDEX IF NOT EXISTS shops_owner_user_idx ON shops (owner_user_id);
      CREATE TABLE IF NOT EXISTS service_categories (
        id BIGSERIAL PRIMARY KEY,
        slug TEXT NOT NULL UNIQUE,
        name TEXT NOT NULL
      );
      ALTER TABLE service_categories ADD COLUMN IF NOT EXISTS slug TEXT;
      UPDATE service_categories
        SET slug = trim(both '-' from regexp_replace(lower(name), '[^a-z0-9]+', '-', 'g'))
        WHERE slug IS NULL OR BTRIM(slug) = '';
      UPDATE service_categories
        SET slug = 'category-' || id::text
        WHERE slug IS NULL OR BTRIM(slug) = '';
      ALTER TABLE service_categories ALTER COLUMN slug SET NOT NULL;
      CREATE UNIQUE INDEX IF NOT EXISTS service_categories_slug_key ON service_categories (slug);
      CREATE TABLE IF NOT EXISTS shop_categories (
        shop_id BIGINT NOT NULL REFERENCES shops(id) ON DELETE CASCADE,
        category_id BIGINT NOT NULL REFERENCES service_categories(id) ON DELETE CASCADE,
        PRIMARY KEY (shop_id, category_id)
      );
      CREATE INDEX IF NOT EXISTS shop_categories_category_idx
        ON shop_categories (category_id, shop_id);
      CREATE INDEX IF NOT EXISTS shops_approved_name_idx
        ON shops (LOWER(name), id) WHERE status = 'approved';
    `);
    await client.query(`
      INSERT INTO service_categories (slug, name)
      SELECT slug, name FROM jsonb_to_recordset($1::jsonb) AS category(slug TEXT, name TEXT)
      ON CONFLICT (slug) DO NOTHING
    `, [JSON.stringify(serviceCategories.map(([slug, name]) => ({ slug, name })))]);
    await client.query("COMMIT");
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}
