import type { NextFunction, Request, Response } from "express";
import type { z } from "zod";
import { badRequest } from "../utils/httpError.js";

type Part = "body" | "query" | "params";

/*
 * Validates one part of the request against a zod schema. Parsed values go to
 * res.locals[part], and handlers read them from there - never from req
 * directly - so unvalidated input cannot reach a service. (Express 5 makes
 * req.query read-only, which is another reason not to overwrite it.)
 */
export function validate<T extends z.ZodType>(part: Part, schema: T) {
  return (req: Request, res: Response, next: NextFunction) => {
    const result = schema.safeParse(req[part] ?? {});
    if (!result.success) {
      const details = result.error.issues.map((i) => ({ path: i.path.join("."), message: i.message }));
      return next(badRequest("Invalid request", details));
    }
    res.locals[part] = result.data;
    next();
  };
}

export const input = <T>(res: Response, part: Part): T => res.locals[part] as T;
