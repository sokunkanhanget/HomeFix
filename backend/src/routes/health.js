import { Router } from "express";
import { pool } from "../config/database.js";

const router = Router();

router.get("/health", async (_request, response) => {
  try {
    await pool.query("SELECT 1");
    response.json({ status: "ok", database: "connected" });
  } catch (error) {
    console.error("Health check failed:", error);
    response.status(503).json({
      status: "error",
      error: "Database connection unavailable",
    });
  }
});

export default router;
