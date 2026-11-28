// Command line entry for database migrations. Run from backend/:
//   npm run migrate          apply every pending migration
//   npm run migrate:status   list migrations and whether each is applied
import { env } from "../config/env.js";
import { getMigrationStatus, MigrationError, runMigrations } from "./migrator.js";

const command = process.argv[2] || "up";
let pool;

async function main() {
  if (!env.databaseUrl) {
    throw new Error("DATABASE_URL is not set. Copy backend/.env.example to backend/.env and fill it in.");
  }
  // Imported here so an invalid DATABASE_URL is reported below like any other error.
  ({ pool } = await import("../config/database.js"));

  if (command === "up") {
    const applied = await runMigrations(pool);
    console.log(applied.length
      ? `Applied ${applied.length} migration(s). Database is up to date.`
      : "No pending migrations. Database is up to date.");
  } else if (command === "status") {
    const migrations = await getMigrationStatus(pool);
    for (const { name, appliedAt } of migrations) {
      console.log(`${appliedAt ? "applied" : "pending"}  ${name}${appliedAt ? `  (${appliedAt.toISOString()})` : ""}`);
    }
    const pending = migrations.filter((migration) => !migration.appliedAt).length;
    console.log(pending ? `${pending} pending migration(s). Run: npm run migrate` : "Database is up to date.");
  } else {
    throw new Error(`Unknown command "${command}". Use "up" or "status".`);
  }
}

try {
  await main();
} catch (error) {
  if (error instanceof MigrationError) {
    console.error(error.message);
  } else {
    // Usually a connection problem: wrong DATABASE_URL, PostgreSQL not running,
    // wrong password, or the database does not exist.
    console.error(`Could not run migrations: ${error.message || error.code || error}`);
    console.error("Check that PostgreSQL is running and DATABASE_URL in backend/.env is correct.");
  }
  process.exitCode = 1;
} finally {
  await pool?.end().catch(() => {});
}
