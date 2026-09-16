import type { NextFunction, Request, Response } from "express";
import { isProduction } from "../config/env.js";
import { logger } from "../config/logger.js";
import { HttpError, notFound } from "../utils/httpError.js";

export function notFoundHandler(_req: Request, _res: Response, next: NextFunction): void {
  next(notFound("Route not found"));
}

/*
 * The one place errors become responses. Known HttpErrors are returned as-is.
 * Everything else is logged with its stack and returned as a generic 500, so
 * SQL, driver messages and stack traces never reach a client.
 */
// Express recognises error middleware by its four parameters.
export function errorHandler(err: unknown, req: Request, res: Response, _next: NextFunction): void {
  if (res.headersSent) return;

  const status = (err as { status?: number; type?: string }).status;
  const type = (err as { type?: string }).type;

  if (err instanceof HttpError) {
    if (err.status >= 500) logger.error("http error", { requestId: req.id, code: err.code, message: err.message });
    res.status(err.status).json({ error: { code: err.code, message: err.message, details: err.details, requestId: req.id } });
    return;
  }

  // body-parser failures: malformed JSON or an oversized body
  if (type === "entity.parse.failed") {
    res.status(400).json({ error: { code: "bad_request", message: "Malformed JSON body", requestId: req.id } });
    return;
  }
  if (type === "entity.too.large" || status === 413) {
    res.status(413).json({ error: { code: "payload_too_large", message: "Request body is too large", requestId: req.id } });
    return;
  }

  const e = err as Error;
  logger.error("unhandled error", { requestId: req.id, error: e?.message, stack: isProduction ? undefined : e?.stack });
  res.status(500).json({ error: { code: "internal_error", message: "Something went wrong", requestId: req.id } });
}
