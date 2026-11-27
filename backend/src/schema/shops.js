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

export async function initializeShopSchema(database = pool) {
  const client = await database.connect();
  try {
    await client.query("BEGIN");
    await client.query(`
      CREATE TABLE IF NOT EXISTS shops (
        id BIGSERIAL PRIMARY KEY,
        name TEXT NOT NULL CHECK (BTRIM(name) <> ''),
        location TEXT NOT NULL,
        address TEXT NOT NULL,
        description TEXT NOT NULL DEFAULT '',
        status TEXT NOT NULL DEFAULT 'pending'
          CHECK (status IN ('pending', 'approved', 'rejected')),
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
      CREATE TABLE IF NOT EXISTS service_categories (
        id BIGSERIAL PRIMARY KEY,
        slug TEXT NOT NULL UNIQUE,
        name TEXT NOT NULL
      );
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
