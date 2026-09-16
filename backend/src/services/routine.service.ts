import type { Person, Task } from "../models/routine.js";
import { peopleRepository, tasksRepository, type PersonRecord } from "../repositories/routine.repository.js";
import { safeZonesRepository } from "../repositories/safety.repository.js";
import { decryptJson } from "../utils/crypto.js";
import { badRequest, notFound } from "../utils/httpError.js";

const toPerson = (r: PersonRecord): Person => ({
  id: r.id,
  nameKey: r.nameKey,
  name: r.name,
  relationKey: r.relationKey,
  relation: r.relation,
  noteKey: r.noteKey,
  note: r.note,
  emoji: r.emoji,
  isPlace: r.isPlace,
  location: decryptJson<{ lat: number; lon: number }>(r.locationEnc),
  locatedAt: r.locatedAt ? r.locatedAt.toISOString() : null,
});

export const routineService = {
  listTasks(patientId: string, day: string): Promise<Task[]> {
    return tasksRepository.listForDay(patientId, day);
  },

  async setTaskDone(patientId: string, taskId: string, day: string, done: boolean, userId: string): Promise<Task[]> {
    if (!(await tasksRepository.belongsTo(taskId, patientId))) throw notFound("Task not found");
    await tasksRepository.setDone(taskId, day, done, userId);
    return tasksRepository.listForDay(patientId, day);
  },
};

export const peopleService = {
  async list(patientId: string): Promise<Person[]> {
    return (await peopleRepository.list(patientId)).map(toPerson);
  },

  async create(
    patientId: string,
    input: { name: string; relation?: string | null; note?: string | null; emoji: string; isPlace: boolean },
  ): Promise<Person> {
    const record = await peopleRepository.create(patientId, {
      name: input.name.trim(),
      relation: input.relation?.trim() || null,
      note: input.note?.trim() || null,
      emoji: input.emoji,
      isPlace: input.isPlace,
    });
    return toPerson(record);
  },

  async remove(patientId: string, personId: string): Promise<void> {
    if (!(await peopleRepository.delete(patientId, personId))) throw notFound("Person not found");
  },

  /* "Save this spot": pin a place at the patient's last known position. */
  async pinAtLastFix(patientId: string, personId: string): Promise<Person> {
    const zone = await safeZonesRepository.get(patientId);
    if (!zone?.lastFixEnc) throw badRequest("No position has been received yet");
    const updated = await peopleRepository.setLocation(patientId, personId, zone.lastFixEnc);
    if (!updated) throw notFound("Person not found");
    return toPerson(updated);
  },

  async clearPin(patientId: string, personId: string): Promise<Person> {
    const updated = await peopleRepository.setLocation(patientId, personId, null);
    if (!updated) throw notFound("Person not found");
    return toPerson(updated);
  },
};
