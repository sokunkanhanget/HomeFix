import { pool } from "../config/database.js";

export async function withTransaction(database, operation) {
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
    if (client !== database) client.release?.();
  }
}

export async function findServiceCategories(database = pool) {
  const result = await database.query("SELECT id, slug, name FROM service_categories ORDER BY id");
  return result.rows;
}

export async function findRegistrationByOwner(ownerId, database = pool, { lock = false } = {}) {
  const result = await database.query(
    `SELECT id, category FROM shop_registrations WHERE owner_id = $1${lock ? " FOR UPDATE" : ""}`,
    [ownerId],
  );
  return result.rows[0] || null;
}

export async function findLinkedCategoryIds(registrationId, database = pool) {
  const result = await database.query(
    "SELECT category_id FROM shop_registration_categories WHERE registration_id = $1",
    [registrationId],
  );
  return result.rows.map((row) => String(row.category_id));
}

export async function replaceLinkedCategories(registrationId, categoryIds, mainCategory, database = pool) {
  await database.query(
    `DELETE FROM shop_registration_categories
     WHERE registration_id = $1 AND NOT (category_id = ANY($2::bigint[]))`,
    [registrationId, categoryIds],
  );
  await database.query(
    `INSERT INTO shop_registration_categories (registration_id, category_id)
     SELECT $1, UNNEST($2::bigint[])
     ON CONFLICT DO NOTHING`,
    [registrationId, categoryIds],
  );
  await database.query("UPDATE shop_registrations SET category = $2 WHERE id = $1", [registrationId, mainCategory]);
}
