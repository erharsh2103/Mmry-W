import { Router } from "express";
import { authController } from "../controllers/auth.controller.js";
import { authenticate } from "../middleware/authenticate.js";
import { requireCsrfHeader } from "../middleware/csrf.js";
import { authLimiter } from "../middleware/rateLimits.js";
import { validate } from "../middleware/validate.js";
import { loginBody, registerBody } from "../validators/auth.validators.js";

export const authRoutes = Router();

authRoutes.post("/register", authLimiter, validate("body", registerBody), authController.register);
authRoutes.post("/login", authLimiter, validate("body", loginBody), authController.login);
authRoutes.post("/refresh", authLimiter, requireCsrfHeader, authController.refresh);
authRoutes.post("/logout", requireCsrfHeader, authController.logout);
authRoutes.get("/me", authenticate, authController.me);
