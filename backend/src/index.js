import "dotenv/config";
import express from "express";
import { pool } from "./config/database.js";
import healthRouter from "./routes/health.js";

const app = express();
const port = Number(process.env.PORT) || 3001;

app.use(express.json());
app.use("/api", healthRouter);

const server = app.listen(port, () => {
  console.log(`HomeFix API listening on http://localhost:${port}`);
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
