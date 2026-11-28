import pg from "pg";
import { env } from "./env.js";

const { Pool } = pg;

const databaseUrl = env.databaseUrl || undefined;

function hostOf(url) {
  if (!url) return "";
  try {
    return new URL(url).hostname;
  } catch {
    throw new Error(
      "DATABASE_URL is not a valid connection string. Expected postgresql://user:password@host:5432/database",
    );
  }
}

const databaseHost = hostOf(databaseUrl);
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
