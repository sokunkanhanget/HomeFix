import { pingDatabase } from "../models/healthModel.js";

// Business logic for the health check. Returns the report and whether the
// service is fully healthy; it never throws.
export async function getHealthReport({ ping = pingDatabase } = {}) {
  let database = "connected";
  try {
    await ping();
  } catch (error) {
    console.error("Health check database ping failed:", error.code || error.message);
    database = "disconnected";
  }

  const healthy = database === "connected";
  return {
    healthy,
    report: {
      status: healthy ? "ok" : "degraded",
      service: "homefix-api",
      uptimeSeconds: Math.round(process.uptime()),
      timestamp: new Date().toISOString(),
      database,
    },
  };
}
