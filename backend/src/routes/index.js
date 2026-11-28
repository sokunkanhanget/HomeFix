import { Router } from "express";
import healthRouter from "./health.js";
import authRouter from "./auth.js";
import shopsRouter from "./shops.js";
import repairRequestsRouter from "./repairRequests.js";
import usersRouter from "./users.js";

// Mounts every feature router under /api. Add new feature routers here.
const router = Router();

router.use(healthRouter);
router.use("/auth", authRouter);
router.use("/shops", shopsRouter);
router.use("/repair-requests", repairRequestsRouter);
router.use("/users", usersRouter);

export default router;
