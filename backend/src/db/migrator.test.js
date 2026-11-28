import assert from "node:assert/strict";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, test } from "node:test";
import { PGlite } from "@electric-sql/pglite";
import { getMigrationStatus, loadMigrations, MigrationError, runMigrations } from "./migrator.js";
import { initializeUserProfileSchema } from "../models/userModel.js";
import { initializeShopSchema } from "../routes/shops.js";
import { initializeRepairRequestSchema } from "../routes/repairRequests.js";

// PGlite is real PostgreSQL running in memory, so these tests execute the
// actual migration files without a database server or .env.
const quiet = { log() {} };
const temporaryDirectories = [];

function createDatabase() {
  const db = new PGlite();
  const client = {
    async query(sql, values) {
      if (values) return db.query(sql, values);
      const results = await db.exec(sql);
      return results.at(-1) ?? { rows: [] };
    },
    release() {},
  };
  return { db, pool: { connect: async () => client, query: client.query } };
}

async function migrationsFolder(files) {
  const directory = await mkdtemp(path.join(os.tmpdir(), "homefix-migrations-"));
  temporaryDirectories.push(directory);
  for (const [name, sql] of Object.entries(files)) await writeFile(path.join(directory, name), sql);
  return directory;
}

async function tableNames(db) {
  const { rows } = await db.query(
    "SELECT table_name FROM information_schema.tables WHERE table_schema = 'public' ORDER BY table_name",
  );
  return rows.map((row) => row.table_name);
}

afterEach(async () => {
  while (temporaryDirectories.length) await rm(temporaryDirectories.pop(), { recursive: true, force: true });
});

test("the real migrations build the full schema on a clean database", async () => {
  const { db, pool } = createDatabase();

  const applied = await runMigrations(pool, { logger: quiet });

  assert.deepEqual(applied, ["001_homefix_core.sql", "002_application_tables.sql", "003_activity_logs.sql"]);
  const tables = await tableNames(db);
  for (const table of [
    "schema_migrations", "users", "user_sessions", "customers", "user_profile_photos",
    "shops", "service_categories", "shop_categories", "shop_registrations",
    "repair_requests", "repair_request_photos", "repair_request_status_history",
    "activity_logs",
  ]) {
    assert.ok(tables.includes(table), `missing table ${table}`);
  }
  const { rows } = await db.query("SELECT COUNT(*)::int AS count FROM service_categories");
  assert.equal(rows[0].count, 12);
});

test("the schema accepts the roles the API uses", async () => {
  const { db, pool } = createDatabase();
  await runMigrations(pool, { logger: quiet });

  for (const role of ["customer", "owner", "admin"]) {
    await db.query(
      "INSERT INTO users (name, email, password_hash, role) VALUES ($1, $2, 'hash', $3)",
      [role, `${role}@example.com`, role],
    );
  }
  await assert.rejects(
    db.query("INSERT INTO users (name, email, password_hash, role) VALUES ('x', 'x@example.com', 'hash', 'hacker')"),
    /users_role_check/,
  );
});

test("running migrations again applies nothing", async () => {
  const { db, pool } = createDatabase();
  await runMigrations(pool, { logger: quiet });

  assert.deepEqual(await runMigrations(pool, { logger: quiet }), []);
  const { rows } = await db.query("SELECT COUNT(*)::int AS count FROM schema_migrations");
  assert.equal(rows[0].count, 3);
  const status = await getMigrationStatus(pool);
  assert.ok(status.every((migration) => migration.appliedAt instanceof Date));
});

test("migrations upgrade a database created by the old startup code", async () => {
  const { db, pool } = createDatabase();
  // What the server used to create on startup before migrations existed.
  await db.exec(`
    CREATE TABLE users (
      id BIGSERIAL PRIMARY KEY, name TEXT NOT NULL, email TEXT NOT NULL UNIQUE, phone TEXT,
      password_hash TEXT NOT NULL, role TEXT NOT NULL DEFAULT 'customer',
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
    CREATE TABLE user_sessions (
      token_hash TEXT PRIMARY KEY, user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      expires_at TIMESTAMPTZ NOT NULL, created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
    CREATE TABLE customers (
      user_id BIGINT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(), updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
    INSERT INTO users (name, email, password_hash, role) VALUES
      ('Dara', 'dara@example.com', 'hash', 'customer'), ('Lina', 'lina@example.com', 'hash', 'owner');
  `);
  await initializeUserProfileSchema(pool);
  await initializeShopSchema(pool);
  await initializeRepairRequestSchema(pool);

  assert.equal((await runMigrations(pool, { logger: quiet })).length, 3);

  const { rows } = await db.query("SELECT email, role FROM users ORDER BY id");
  assert.deepEqual(rows, [
    { email: "dara@example.com", role: "customer" },
    { email: "lina@example.com", role: "owner" },
  ]);
  assert.ok((await tableNames(db)).includes("shops"));
});

test("a failing migration is rolled back and reported with its file and line", async () => {
  const { db, pool } = createDatabase();
  const directory = await migrationsFolder({
    "001_first.sql": "CREATE TABLE first_table (id INT);",
    "002_broken.sql": "CREATE TABLE half_done (id INT);\n\nINSERT INTO missing_table VALUES (1);",
    "003_never_run.sql": "CREATE TABLE never_run (id INT);",
  });

  await assert.rejects(runMigrations(pool, { directory, logger: quiet }), (error) => {
    assert.ok(error instanceof MigrationError);
    assert.equal(error.migration, "002_broken.sql");
    assert.match(error.message, /Migration "002_broken.sql" failed at line 3: relation "missing_table" does not exist/);
    assert.match(error.message, /rolled back/);
    return true;
  });

  const tables = await tableNames(db);
  assert.ok(tables.includes("first_table"), "earlier migration stays applied");
  assert.ok(!tables.includes("half_done"), "failed migration is rolled back");
  assert.ok(!tables.includes("never_run"), "later migrations are not run");
  const { rows } = await db.query("SELECT name FROM schema_migrations");
  assert.deepEqual(rows, [{ name: "001_first.sql" }]);

  // After fixing the file, the next run continues from the failed migration.
  await writeFile(path.join(directory, "002_broken.sql"), "CREATE TABLE half_done (id INT);");
  assert.deepEqual(
    await runMigrations(pool, { directory, logger: quiet }),
    ["002_broken.sql", "003_never_run.sql"],
  );
});

test("editing a migration after it was applied is reported", async () => {
  const { pool } = createDatabase();
  const directory = await migrationsFolder({ "001_first.sql": "CREATE TABLE first_table (id INT);" });
  await runMigrations(pool, { directory, logger: quiet });

  await writeFile(path.join(directory, "001_first.sql"), "CREATE TABLE first_table (id BIGINT);");

  await assert.rejects(runMigrations(pool, { directory, logger: quiet }), /was changed after it was applied/);
});

test("line ending differences do not count as edits", async () => {
  const { pool } = createDatabase();
  const directory = await migrationsFolder({ "001_first.sql": "CREATE TABLE a (id INT);\nCREATE TABLE b (id INT);\n" });
  await runMigrations(pool, { directory, logger: quiet });

  await writeFile(path.join(directory, "001_first.sql"), "CREATE TABLE a (id INT);\r\nCREATE TABLE b (id INT);\r\n");

  assert.deepEqual(await runMigrations(pool, { directory, logger: quiet }), []);
});

test("badly named, duplicate-numbered and self-committing files are rejected before anything runs", async () => {
  await assert.rejects(
    loadMigrations(await migrationsFolder({ "create_users.sql": "SELECT 1;" })),
    /not named like 003_short_description.sql/,
  );
  await assert.rejects(
    loadMigrations(await migrationsFolder({ "003_a.sql": "SELECT 1;", "003_b.sql": "SELECT 1;" })),
    /share the number 003/,
  );
  await assert.rejects(
    loadMigrations(await migrationsFolder({ "001_a.sql": "BEGIN;\nCREATE TABLE a (id INT);\nCOMMIT;" })),
    /contains BEGIN, COMMIT or ROLLBACK/,
  );
  // PL/pgSQL blocks use BEGIN/END without being transaction control.
  const migrations = await loadMigrations(await migrationsFolder({
    "001_a.sql": "DO $$\nBEGIN\n  RAISE NOTICE 'hi';\nEND;\n$$;",
  }));
  assert.equal(migrations.length, 1);
});
