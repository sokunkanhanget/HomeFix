import { env, validateEnv } from "./config/env.js";
import { pool } from "./config/database.js";
import { createApp } from "./app.js";
import { initializeAuthSchema } from "./routes/auth.js";
import { initializeShopSchema } from "./routes/shops.js";
import { initializeRepairRequestSchema } from "./routes/repairRequests.js";
import { initializeUserProfileSchema } from "./models/userModel.js";

for (const problem of validateEnv()) console.warn(`Configuration warning: ${problem}`);

try {
  await initializeAuthSchema();
  await initializeUserProfileSchema();
  await initializeShopSchema();
  await initializeRepairRequestSchema();
  console.log("Database schema is ready.");
} catch (error) {
  console.warn("Database is unavailable; starting the API without database features.");
  console.warn(error.message);
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
