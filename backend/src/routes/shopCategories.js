import { Router } from "express";
import { pool } from "../config/database.js";
import { createShopCategoryController } from "../controllers/shopCategoryController.js";
import { createRequireUser } from "../middleware/requireUser.js";
import { asyncHandler } from "../utils/asyncHandler.js";

export function createServiceCategoriesRouter(database = pool) {
  const router = Router();
  const controller = createShopCategoryController(database);
  router.get("/", asyncHandler(controller.listServiceCategories));
  return router;
}

export function createOwnerCategoriesRouter(database = pool) {
  const router = Router();
  const controller = createShopCategoryController(database);
  const requireUser = createRequireUser(database);
  router.get("/", requireUser, asyncHandler(controller.getOwnerCategories));
  router.put("/", requireUser, asyncHandler(controller.replaceOwnerCategories));
  router.post("/", requireUser, asyncHandler(controller.addOwnerCategory));
  router.delete("/:category", requireUser, asyncHandler(controller.removeOwnerCategory));
  return router;
}

export const serviceCategoriesRouter = createServiceCategoriesRouter();
export const ownerCategoriesRouter = createOwnerCategoriesRouter();
