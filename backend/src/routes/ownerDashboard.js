import { Router } from "express";
import { pool } from "../config/database.js";
import { createDashboardController } from "../controllers/dashboardController.js";
import { createRequireUser } from "../middleware/requireUser.js";
import { asyncHandler } from "../utils/asyncHandler.js";

export function createOwnerDashboardRouter(database = pool) {
  const router = Router();
  const controller = createDashboardController(database);
  router.get("/", createRequireUser(database), asyncHandler(controller.getOwnerDashboard));
  return router;
}

export default createOwnerDashboardRouter();
