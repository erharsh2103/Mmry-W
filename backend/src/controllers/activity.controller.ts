import type { Request, Response } from "express";
import { input } from "../middleware/validate.js";
import { activityService, type MindCheckInput, type SessionInput } from "../services/activity.service.js";
import { analyticsService } from "../services/analytics.service.js";
import { assistantService } from "../services/assistant.service.js";
import { insightsService } from "../services/insights.service.js";

const pid = (req: Request) => req.params.patientId as string;

export const activityController = {
  async recordSessions(req: Request, res: Response) {
    const { sessions } = input<{ sessions: SessionInput[] }>(res, "body");
    const result = await activityService.recordSessions(pid(req), req.auth!.sub, sessions);
    res.status(result.created ? 201 : 200).json(result);
  },

  async listSessions(req: Request, res: Response) {
    const { limit } = input<{ limit: number }>(res, "query");
    res.json({ sessions: await activityService.recentSessions(pid(req), limit) });
  },

  async recordMindCheck(req: Request, res: Response) {
    const body = input<MindCheckInput>(res, "body");
    const { check, created } = await activityService.recordMindCheck(pid(req), body);
    res.status(created ? 201 : 200).json({ mindCheck: check });
  },

  async listMindChecks(req: Request, res: Response) {
    const { limit } = input<{ limit: number }>(res, "query");
    res.json({ mindChecks: await activityService.listMindChecks(pid(req), limit) });
  },
};

export const insightsController = {
  async get(req: Request, res: Response) {
    const { day } = input<{ day: string }>(res, "query");
    res.json(await insightsService.forPatient(pid(req), day));
  },

  async analytics(req: Request, res: Response) {
    const { days } = input<{ days: number }>(res, "query");
    res.json(await analyticsService.forPatient(pid(req), days));
  },
};

export const assistantController = {
  async transcribe(req: Request, res: Response) {
    const file = req.file;
    if (!file) return res.status(400).json({ error: { code: "bad_request", message: "audio is required" } });
    res.json(await assistantService.transcribe(file.buffer, file.mimetype, String(req.body.lang ?? "en")));
  },

  async classify(req: Request, res: Response) {
    const body = input<{ text: string; lang: string; source: "speech" | "chip"; speechConfidence: number | null }>(res, "body");
    res.json(await assistantService.classify(pid(req), req.auth!.sub, body));
  },

  async answer(req: Request, res: Response) {
    const body = input<{ text: string; lang: string; source: "speech" | "chip"; speechConfidence: number | null; day?: string }>(res, "body");
    res.json(await assistantService.answer(pid(req), req.auth!.sub, req.patientAccess!, body));
  },
};
