import type { NextFunction, Request, Response } from "express";
import { forbidden } from "../utils/httpError.js";

export const CSRF_HEADER = "x-mmry-csrf";

/*
 * Routes authenticated by the refresh cookie (refresh, logout) need CSRF
 * protection on top of SameSite=Strict. A cross-site form cannot set a custom
 * header, and a cross-site fetch that sets one triggers a CORS preflight this
 * API does not grant.
 */
export function requireCsrfHeader(req: Request, _res: Response, next: NextFunction): void {
  if (req.header(CSRF_HEADER) !== "1") return next(forbidden("Missing CSRF header"));
  next();
}
