import type { Request, Response } from "express";
import { pingMongo } from "../config/mongo.js";
import { pingPostgres } from "../config/postgres.js";
import { aiClient } from "../services/aiClient.service.js";

export const healthController = {
  /* Liveness: the process is up. No dependencies, no details. */
  live(_req: Request, res: Response) {
    res.json({ status: "ok" });
  },

  /* Readiness: databases must answer. The AI service is reported but is not
     required, because every AI call has a rule-based fallback. */
  async ready(_req: Request, res: Response) {
    const [postgres, mongodb, ai] = await Promise.all([pingPostgres(), pingMongo(), aiClient.health()]);
    const ready = postgres && mongodb;
    res.status(ready ? 200 : 503).json({
      status: ready ? "ready" : "unavailable",
      checks: { postgres, mongodb, ai: ai ? "up" : "down (rule fallbacks active)" },
    });
  },
};
