import { createHash } from "node:crypto";
import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

// Applies the SQL files in backend/db/migrations to PostgreSQL, in filename
// order, and records each one in the schema_migrations table so it runs only
// once per database. Each migration runs in its own transaction: if it fails,
// its changes are rolled back, the migrations after it are not attempted, and
// a MigrationError describes what went wrong.

export const MIGRATIONS_DIRECTORY = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)), "..", "..", "db", "migrations",
);

const MIGRATION_FILE = /^(\d+)_[\w-]+\.sql$/;
// Any fixed number works; it only has to be the same for every HomeFix process.
const MIGRATION_LOCK_ID = 482_013_964;
// The runner wraps each file in a transaction, so a file must not end it early.
// (A PL/pgSQL "END;" inside a function body is fine, so END is not matched.)
const TRANSACTION_CONTROL = /^\s*(BEGIN|START\s+TRANSACTION|COMMIT|ROLLBACK)\s*;/im;

export class MigrationError extends Error {
  constructor(message, { migration, cause } = {}) {
    super(message, { cause });
    this.name = "MigrationError";
    this.migration = migration;
  }
}

// Line endings are normalized so Windows and macOS checkouts of the same file
// produce the same checksum.
function checksumOf(sql) {
  return createHash("sha256").update(sql.replace(/\r\n/g, "\n")).digest("hex");
}

export async function loadMigrations(directory = MIGRATIONS_DIRECTORY) {
  let entries;
  try {
    entries = await readdir(directory);
  } catch (error) {
    throw new MigrationError(`Cannot read the migrations folder ${directory}: ${error.message}`, { cause: error });
  }

  const migrations = [];
  const versions = new Map();
  for (const name of entries.filter((entry) => entry.endsWith(".sql")).sort()) {
    const match = MIGRATION_FILE.exec(name);
    if (!match) {
      throw new MigrationError(
        `Migration file "${name}" is not named like 003_short_description.sql.`,
        { migration: name },
      );
    }
    const version = Number(match[1]);
    if (versions.has(version)) {
      throw new MigrationError(
        `Migrations "${versions.get(version)}" and "${name}" share the number ${match[1]}. Renumber one of them.`,
        { migration: name },
      );
    }
    versions.set(version, name);

    const sql = await readFile(path.join(directory, name), "utf8");
    if (TRANSACTION_CONTROL.test(sql)) {
      throw new MigrationError(
        `Migration "${name}" contains BEGIN, COMMIT or ROLLBACK. Remove them: each migration already runs in its own transaction.`,
        { migration: name },
      );
    }
    migrations.push({ name, version, sql, checksum: checksumOf(sql) });
  }
  return migrations.sort((a, b) => a.version - b.version);
}

async function ensureMigrationsTable(client) {
  await client.query(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      name TEXT PRIMARY KEY,
      checksum CHAR(64) NOT NULL,
      applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);
}

async function readApplied(client) {
  const { rows } = await client.query("SELECT name, checksum, applied_at FROM schema_migrations ORDER BY name");
  return new Map(rows.map((row) => [row.name, row]));
}

// Fails if a migration that already ran has since been edited, because the
// database would silently differ from what the file now says.
function assertUnchanged(migrations, applied) {
  for (const migration of migrations) {
    const record = applied.get(migration.name);
    if (record && record.checksum.trim() !== migration.checksum) {
      throw new MigrationError(
        `Migration "${migration.name}" was changed after it was applied to this database. `
          + "Restore the original file and put the change in a new migration.",
        { migration: migration.name },
      );
    }
  }
}

function lineOfPosition(sql, position) {
  const offset = Number(position);
  if (!Number.isInteger(offset) || offset < 1) return null;
  return sql.slice(0, offset - 1).split("\n").length;
}

function describeFailure(migration, error) {
  const line = lineOfPosition(migration.sql, error.position);
  const parts = [`Migration "${migration.name}" failed${line ? ` at line ${line}` : ""}: ${error.message}`];
  if (error.code) parts.push(`PostgreSQL error code: ${error.code}`);
  if (error.detail) parts.push(`Detail: ${error.detail}`);
  if (error.hint) parts.push(`Hint: ${error.hint}`);
  parts.push("Its changes were rolled back; later migrations were not run.");
  return parts.join("\n");
}

async function withMigrationClient(database, work) {
  const client = await database.connect();
  try {
    // Stops two processes (for example two backend instances starting at once)
    // from applying the same migration simultaneously.
    await client.query("SELECT pg_advisory_lock($1)", [MIGRATION_LOCK_ID]);
    try {
      await ensureMigrationsTable(client);
      return await work(client);
    } finally {
      // Never let a failed unlock hide the real error; the lock is also
      // released automatically when the connection closes.
      await client.query("SELECT pg_advisory_unlock($1)", [MIGRATION_LOCK_ID]).catch(() => {});
    }
  } finally {
    client.release();
  }
}

// Applies every pending migration. Returns the names of the ones applied.
export async function runMigrations(database, { directory = MIGRATIONS_DIRECTORY, logger = console } = {}) {
  const migrations = await loadMigrations(directory);

  return withMigrationClient(database, async (client) => {
    const applied = await readApplied(client);
    assertUnchanged(migrations, applied);

    const appliedNow = [];
    for (const migration of migrations) {
      if (applied.has(migration.name)) continue;
      logger.log(`Applying migration ${migration.name}`);
      try {
        await client.query("BEGIN");
        await client.query(migration.sql);
        await client.query(
          "INSERT INTO schema_migrations (name, checksum) VALUES ($1, $2)",
          [migration.name, migration.checksum],
        );
        await client.query("COMMIT");
      } catch (error) {
        await client.query("ROLLBACK").catch(() => {});
        throw new MigrationError(describeFailure(migration, error), { migration: migration.name, cause: error });
      }
      appliedNow.push(migration.name);
    }
    return appliedNow;
  });
}

// Lists every migration file and whether it has been applied to the database.
export async function getMigrationStatus(database, { directory = MIGRATIONS_DIRECTORY } = {}) {
  const migrations = await loadMigrations(directory);
  return withMigrationClient(database, async (client) => {
    const applied = await readApplied(client);
    assertUnchanged(migrations, applied);
    return migrations.map(({ name }) => ({
      name,
      appliedAt: applied.get(name)?.applied_at ?? null,
    }));
  });
}
