import pg from "pg";
import { env } from "./env.js";

const { Pool } = pg;

const databaseUrl = env.databaseUrl || undefined;
const databaseHost = databaseUrl ? new URL(databaseUrl).hostname : "";
const isLocalDatabase = ["localhost", "127.0.0.1", "::1"].includes(databaseHost);

export const pool = new Pool({
  connectionString: databaseUrl,
  // Hosted PostgreSQL providers (including Supabase) require TLS. Keep local
  // Docker/PostgreSQL development connections plain.
  ssl: databaseUrl && !isLocalDatabase ? { rejectUnauthorized: false } : undefined,
});

pool.on("error", (error) => {
  console.error("Unexpected PostgreSQL pool error:", error);
});
