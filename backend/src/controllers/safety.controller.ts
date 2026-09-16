import type { Request, Response } from "express";
import { input } from "../middleware/validate.js";
import { safetyService } from "../services/safety.service.js";

const pid = (req: Request) => req.params.patientId as string;

export const safetyController = {
  async state(req: Request, res: Response) {
    res.json(await safetyService.state(pid(req)));
  },

  async updateZone(req: Request, res: Response) {
    const body = input<{ radiusM?: number; armed?: boolean; trackingEnabled?: boolean }>(res, "body");
    res.json(await safetyService.updateZone(pid(req), body));
  },

  async setHome(req: Request, res: Response) {
    const body = input<{ kind: "lastFix" } | { kind: "place"; personId: string }>(res, "body");
    res.json(await safetyService.setHome(pid(req), body));
  },

  async reportFix(req: Request, res: Response) {
    const body = input<{ lat: number; lon: number; accuracyM: number }>(res, "body");
    res.json(await safetyService.reportFix(pid(req), body));
  },

  async sos(req: Request, res: Response) {
    res.status(201).json(await safetyService.recordSos(pid(req)));
  },
};
