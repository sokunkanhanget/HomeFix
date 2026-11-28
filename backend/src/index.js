import { env, validateEnv } from "./config/env.js";
import { pool } from "./config/database.js";

import healthRouter from "./routes/health.js";
import authRouter, { initializeAuthSchema } from "./routes/auth.js";
import shopsRouter from "./routes/shops.js";
import customerDashboardRouter from "./routes/customerDashboard.js";
import { initializeShopSchema } from "./schema/shops.js";

import { createApp } from "./app.js";
import { MigrationError, runMigrations } from "./db/migrator.js";


for (const problem of validateEnv()) console.warn(`Configuration warning: ${problem}`);

 
app.use(express.json());
app.use("/api", healthRouter);
app.use("/api/auth", authRouter);
app.use("/api", shopsRouter);
app.use("/api", customerDashboardRouter);

try {
  await initializeAuthSchema();
  await initializeShopSchema();
  console.log("Database schema is ready.");
} catch (error) {
  console.warn("Database is unavailable; starting the API without database features.");
  console.warn(error.message);

// Brings the database schema up to date by applying any pending migrations
// from backend/db/migrations (the same as running `npm run migrate`).
if (env.databaseUrl) {
  try {
    await runMigrations(pool);
    console.log("Database schema is up to date.");
  } catch (error) {
    if (error instanceof MigrationError) {
      console.error(error.message);
      console.error("Starting the API anyway; features that need the failed migration will not work.");
    } else {
      console.warn("Database is unavailable; starting the API without database features.");
      console.warn(error.message || error.code || String(error));
    }
  }

}

const app = createApp();

const server = app.listen(env.port, () => {
  console.log(`HomeFix API (${env.nodeEnv}) listening on http://localhost:${env.port}`);
  console.log(`Health check: http://localhost:${env.port}/api/health`);
});

async function shutdown(signal) {
  console.log(`${signal} received; closing server`);
  server.close(async (serverError) => {
    try {
      await pool.end();
    } catch (poolError) {
      console.error("Failed to close PostgreSQL pool:", poolError);
      process.exitCode = 1;
    }

    if (serverError) {
      console.error("Failed to close HTTP server:", serverError);
      process.exitCode = 1;
    }
  });
}

process.on("SIGINT", () => shutdown("SIGINT"));
process.on("SIGTERM", () => shutdown("SIGTERM"));
