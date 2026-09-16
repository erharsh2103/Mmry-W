import { Router } from "express";
import { healthController } from "../controllers/health.controller.js";
import { apiLimiter } from "../middleware/rateLimits.js";
import { authRoutes } from "./auth.routes.js";
import { patientRoutes } from "./patients.routes.js";

/* Mounted at /api/v1. */
export const apiRoutes = Router();

apiRoutes.get("/health", healthController.live);
apiRoutes.get("/health/ready", healthController.ready);

apiRoutes.use(apiLimiter);
apiRoutes.use("/auth", authRoutes);
apiRoutes.use("/patients", patientRoutes);
