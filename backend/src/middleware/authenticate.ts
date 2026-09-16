import type { NextFunction, Request, Response } from "express";
import { unauthorized } from "../utils/httpError.js";
import { verifyAccessToken } from "../utils/tokens.js";

/* Requires a valid access token in `Authorization: Bearer <jwt>`. */
export function authenticate(req: Request, _res: Response, next: NextFunction): void {
  const header = req.header("authorization") ?? "";
  const [scheme, token] = header.split(" ");
  if (scheme !== "Bearer" || !token) return next(unauthorized());
  try {
    req.auth = verifyAccessToken(token);
    next();
  } catch {
    next(unauthorized("Session expired"));
  }
}
