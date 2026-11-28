import { Router } from "express";
import multer from "multer";
import { pool } from "../config/database.js";
import { createProfileController } from "../controllers/profileController.js";
import { createRequireUser } from "../middleware/requireUser.js";
import { MAX_PROFILE_PHOTO_BYTES } from "../services/profileService.js";
import { AppError } from "../utils/AppError.js";
import { asyncHandler } from "../utils/asyncHandler.js";

// Accepts one image in the "photo" form field, kept in memory and validated by
// the service before it is saved.
function photoUpload(request, response, next) {
  multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: MAX_PROFILE_PHOTO_BYTES, files: 1, fields: 0 },
  }).single("photo")(request, response, (error) => {
    if (!error) return next();
    if (error.code === "LIMIT_FILE_SIZE") {
      return next(AppError.badRequest("Validation failed.", { photo: "The photo must be 2 MB or smaller." }));
    }
    if (error instanceof multer.MulterError) {
      return next(AppError.badRequest("Validation failed.", { photo: "Upload a single image in the \"photo\" field." }));
    }
    return next(error);
  });
}

export function createUsersRouter(database = pool) {
  const router = Router();
  const requireUser = createRequireUser(database);
  const profile = createProfileController(database);

  router.use(requireUser);

  router.get("/me", asyncHandler(profile.getMe));
  router.patch("/me", asyncHandler(profile.updateMe));
  router.get("/me/photo", asyncHandler(profile.getPhoto));
  router.put("/me/photo", photoUpload, asyncHandler(profile.updatePhoto));
  router.delete("/me/photo", asyncHandler(profile.deletePhoto));
  router.get("/:userId", asyncHandler(profile.getById));

  return router;
}

export default createUsersRouter();
