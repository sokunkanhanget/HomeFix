import { pool } from "../config/database.js";

// Data access for the append-only activity_logs table. There are deliberately
// no update or delete functions (the database also rejects them).

// The actor's name and role are snapshotted from the users table when the
// caller does not already know them, so every entry records who acted.
export async function insertActivity(entry, database = pool) {
  await database.query(
    `INSERT INTO activity_logs (actor_user_id, actor_role, actor_name, action, entity_type, entity_id, details)
     VALUES (
       $1::bigint,
       COALESCE($2::text, (SELECT role FROM users WHERE id = $1::bigint)),
       COALESCE($3::text, (SELECT name FROM users WHERE id = $1::bigint)),
       $4, $5, $6, $7::jsonb
     )`,
    [
      entry.actorId, entry.actorRole, entry.actorName, entry.action,
      entry.entityType, entry.entityId, JSON.stringify(entry.details || {}),
    ],
  );
}

// Optional filters; NULL means "any".
const FILTER_SQL = `
  ($1::text IS NULL OR action = $1)
  AND ($2::text IS NULL OR entity_type = $2)
  AND ($3::text IS NULL OR entity_id = $3)
  AND ($4::bigint IS NULL OR actor_user_id = $4)
  AND ($5::timestamptz IS NULL OR created_at >= $5)
  AND ($6::timestamptz IS NULL OR created_at < $6)`;

function filterValues(filters) {
  return [
    filters.action ?? null, filters.entityType ?? null, filters.entityId ?? null,
    filters.actorId ?? null, filters.from ?? null, filters.to ?? null,
  ];
}

export async function countActivities(filters, database = pool) {
  const result = await database.query(
    `SELECT COUNT(*)::int AS total FROM activity_logs WHERE ${FILTER_SQL}`,
    filterValues(filters),
  );
  return Number(result.rows[0]?.total ?? 0);
}

// Newest first; the id tie-breaker keeps page boundaries stable.
export async function findActivities(filters, { limit, offset }, database = pool) {
  const result = await database.query(
    `SELECT id, actor_user_id, actor_role, actor_name, action, entity_type, entity_id, details, created_at
     FROM activity_logs
     WHERE ${FILTER_SQL}
     ORDER BY created_at DESC, id DESC
     LIMIT $7 OFFSET $8`,
    [...filterValues(filters), limit, offset],
  );
  return result.rows;
}
