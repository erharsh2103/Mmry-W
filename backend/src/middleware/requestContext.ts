import { randomUUID } from "node:crypto";
import type { NextFunction, Request, Response } from "express";
import { logger } from "../config/logger.js";
import type { CaregiverAccess } from "../models/patient.js";
import type { AccessClaims } from "../utils/tokens.js";

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      id: string;
      auth?: AccessClaims;
      patientAccess?: CaregiverAccess;
    }
  }
}

const SAFE_ID = /^[A-Za-z0-9._-]{8,64}$/;

/* Correlates one request across logs and the error body. Only a well-formed
   incoming X-Request-Id is honoured, so logs cannot be injected through it. */
export function requestContext(req: Request, res: Response, next: NextFunction): void {
  const incoming = req.header("x-request-id");
  req.id = incoming && SAFE_ID.test(incoming) ? incoming : randomUUID();
  res.setHeader("x-request-id", req.id);

  const started = performance.now();
  res.on("finish", () => {
    logger.info("request", {
      requestId: req.id,
      method: req.method,
      // route pattern, not the raw URL, so ids and query strings stay out of logs
      path: req.baseUrl + (req.route?.path ?? ""),
      status: res.statusCode,
      ms: Math.round(performance.now() - started),
      user: req.auth?.sub,
    });
  });
  next();
}
