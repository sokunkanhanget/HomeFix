import { pool } from "../config/database.js";

// Database access for user profiles. Profile photos are stored in PostgreSQL
// so a profile and its photo are always saved together.

export async function initializeUserProfileSchema(database = pool) {
  await database.query(`
    ALTER TABLE users ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW();

    CREATE TABLE IF NOT EXISTS user_profile_photos (
      user_id BIGINT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
      content_type TEXT NOT NULL CHECK (content_type IN ('image/jpeg', 'image/png', 'image/webp')),
      data BYTEA NOT NULL,
      size_bytes INTEGER NOT NULL,
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
  `);
}

const profileColumns = `
  users.id, users.name, users.email, users.phone, users.role,
  users.created_at, users.updated_at,
  user_profile_photos.updated_at AS photo_updated_at`;

export async function findProfileById(userId, database = pool) {
  const result = await database.query(
    `SELECT ${profileColumns}
     FROM users
     LEFT JOIN user_profile_photos ON user_profile_photos.user_id = users.id
     WHERE users.id = $1`,
    [userId],
  );
  return result.rows[0] || null;
}

// Updates only name and phone. Role, email and password are never touched here.
export async function updateProfileDetails(userId, { name, phone }, database = pool) {
  const result = await database.query(
    `UPDATE users SET name = $2, phone = $3, updated_at = NOW()
     WHERE id = $1
     RETURNING id`,
    [userId, name, phone],
  );
  return result.rows.length > 0;
}

export async function saveProfilePhoto(userId, { contentType, data }, database = pool) {
  await database.query(
    `INSERT INTO user_profile_photos (user_id, content_type, data, size_bytes, updated_at)
     VALUES ($1, $2, $3, $4, NOW())
     ON CONFLICT (user_id) DO UPDATE
       SET content_type = EXCLUDED.content_type,
           data = EXCLUDED.data,
           size_bytes = EXCLUDED.size_bytes,
           updated_at = NOW()`,
    [userId, contentType, data, data.length],
  );
}

export async function findProfilePhoto(userId, database = pool) {
  const result = await database.query(
    "SELECT content_type, data, updated_at FROM user_profile_photos WHERE user_id = $1",
    [userId],
  );
  return result.rows[0] || null;
}

export async function deleteProfilePhoto(userId, database = pool) {
  const result = await database.query("DELETE FROM user_profile_photos WHERE user_id = $1", [userId]);
  return (result.rowCount ?? result.affectedRows ?? 0) > 0;
}
