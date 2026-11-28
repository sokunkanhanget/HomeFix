import { Router } from "express";
import { createHealthController } from "../controllers/healthController.js";
import { asyncHandler } from "../utils/asyncHandler.js";

export function createHealthRouter(options) {
  const router = Router();
  router.get("/health", asyncHandler(createHealthController(options)));
  return router;
}

export default createHealthRouter();
