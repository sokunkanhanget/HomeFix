import { Router } from "express";
import { pool } from "../config/database.js";
import { createAdminController } from "../controllers/adminController.js";
import { requireRole } from "../middleware/requireRole.js";
import { createRequireUser } from "../middleware/requireUser.js";
import { AppError } from "../utils/AppError.js";
import { asyncHandler } from "../utils/asyncHandler.js";

// /api/admin/*: every route requires a logged-in administrator.
export function createAdminRouter(database = pool) {
  const router = Router();
  const admin = createAdminController(database);

  router.use(createRequireUser(database), requireRole("admin"));

  // Activity logs are read-only through the API (and append-only in the
  // database). Any attempt to change them is refused explicitly.
  router.get("/activity-logs", asyncHandler(admin.listActivityLogs));
  router.all(["/activity-logs", "/activity-logs/*path"], (request, response, next) => {
    if (request.method === "GET" || request.method === "HEAD") return next();
    response.set("Allow", "GET");
    return next(new AppError(405, "Activity logs are read-only and cannot be modified.", { code: "METHOD_NOT_ALLOWED" }));
  });

  router.get("/shop-registrations", asyncHandler(admin.listShopRegistrations));
  router.patch("/shop-registrations/:shopId", asyncHandler(admin.reviewShopRegistration));

  return router;
}

export default createAdminRouter();
