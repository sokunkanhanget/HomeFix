import { pool } from "../config/database.js";

// Data access for the health check: confirms PostgreSQL answers a query.
export async function pingDatabase(database = pool) {
  await database.query("SELECT 1");
}
