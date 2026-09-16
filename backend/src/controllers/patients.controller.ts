import type { Request, Response } from "express";
import { input } from "../middleware/validate.js";
import { patientService, type PatientProfileInput } from "../services/patient.service.js";
import { peopleService, routineService } from "../services/routine.service.js";

const pid = (req: Request) => req.params.patientId as string;

export const patientsController = {
  async list(req: Request, res: Response) {
    res.json({ patients: await patientService.list(req.auth!.sub) });
  },

  async create(req: Request, res: Response) {
    const body = input<{ displayName: string; language: string }>(res, "body");
    res.status(201).json({ patient: await patientService.create(req.auth!.sub, body) });
  },

  async get(req: Request, res: Response) {
    res.json({ patient: await patientService.get(pid(req), req.patientAccess!) });
  },

  async update(req: Request, res: Response) {
    const body = input<PatientProfileInput>(res, "body");
    res.json({ patient: await patientService.update(pid(req), req.patientAccess!, body) });
  },

  async remove(req: Request, res: Response) {
    await patientService.remove(pid(req), req.patientAccess!);
    res.status(204).end();
  },

  async setPin(req: Request, res: Response) {
    const { pin } = input<{ pin: string | null }>(res, "body");
    res.json({ patient: await patientService.setPin(pid(req), req.patientAccess!, pin) });
  },

  async verifyPin(req: Request, res: Response) {
    const { pin } = input<{ pin: string }>(res, "body");
    await patientService.verifyPin(pid(req), pin);
    res.json({ ok: true });
  },
};

export const routineController = {
  async listTasks(req: Request, res: Response) {
    const { day } = input<{ day: string }>(res, "query");
    res.json({ day, tasks: await routineService.listTasks(pid(req), day) });
  },

  async setTask(req: Request, res: Response) {
    const { taskId } = input<{ taskId: string }>(res, "params");
    const { day, done } = input<{ day: string; done: boolean }>(res, "body");
    res.json({ day, tasks: await routineService.setTaskDone(pid(req), taskId, day, done, req.auth!.sub) });
  },
};

export const peopleController = {
  async list(req: Request, res: Response) {
    res.json({ people: await peopleService.list(pid(req)) });
  },

  async create(req: Request, res: Response) {
    const body = input<{ name: string; relation?: string | null; note?: string | null; emoji: string; isPlace: boolean }>(res, "body");
    res.status(201).json({ person: await peopleService.create(pid(req), body) });
  },

  async remove(req: Request, res: Response) {
    const { personId } = input<{ personId: string }>(res, "params");
    await peopleService.remove(pid(req), personId);
    res.status(204).end();
  },

  async pinHere(req: Request, res: Response) {
    const { personId } = input<{ personId: string }>(res, "params");
    res.json({ person: await peopleService.pinAtLastFix(pid(req), personId) });
  },

  async clearPin(req: Request, res: Response) {
    const { personId } = input<{ personId: string }>(res, "params");
    res.json({ person: await peopleService.clearPin(pid(req), personId) });
  },
};
