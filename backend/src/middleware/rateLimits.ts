import { rateLimit } from "express-rate-limit";
import type { Request } from "express";

const json = { standardHeaders: "draft-8" as const, legacyHeaders: false };
const message = { error: { code: "too_many_requests", message: "Too many attempts, try again later" } };
const isTest = () => process.env.NODE_ENV === "test";

/* Credential endpoints: slows password guessing per client address. */
export const authLimiter = rateLimit({
  ...json,
  windowMs: 15 * 60_000,
  limit: 20,
  skipSuccessfulRequests: true,
  skip: isTest,
  message,
});

/* Caregiver PIN: 4 digits is a small space, so a tight per-user-per-patient budget. */
export const pinLimiter = rateLimit({
  ...json,
  windowMs: 15 * 60_000,
  limit: 8,
  skipSuccessfulRequests: true,
  skip: isTest,
  keyGenerator: (req: Request) => `${req.auth?.sub ?? "anon"}:${req.params.patientId ?? ""}`,
  message,
});

/* Everything else under /api. */
export const apiLimiter = rateLimit({
  ...json,
  windowMs: 60_000,
  limit: 300,
  skip: isTest,
  message,
});
