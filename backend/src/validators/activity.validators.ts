import { z } from "zod";
import { CHECK_AREAS, GAME_TYPE_VALUES } from "../models/activity.js";

const pastOrNow = z.iso
  .datetime({ offset: true })
  .refine((v) => Date.parse(v) <= Date.now() + 5 * 60_000, "Time cannot be in the future");

const session = z.object({
  clientRef: z.uuid(),
  gameType: z.enum(GAME_TYPE_VALUES),
  level: z.number().int().min(1).max(5),
  accuracy: z.number().min(0).max(1),
  responseMs: z.number().int().min(0).max(3_600_000),
  attempts: z.number().int().min(1).max(1000),
  playedAt: pastOrNow,
  localDay: z.iso.date(),
  detail: z
    .object({
      puzzle: z.record(z.string(), z.unknown()).refine((v) => JSON.stringify(v).length <= 8_000, "Puzzle too large"),
      picks: z
        .array(z.object({ atMs: z.number().int().min(0), value: z.string().max(64), correct: z.boolean() }))
        .max(500),
    })
    .optional(),
});

/* One session, or an offline queue of up to 50 replayed together. */
export const recordSessionsBody = z.object({ sessions: z.array(session).min(1).max(50) });

export const listQuery = z.object({ limit: z.coerce.number().int().min(1).max(200).default(50) });

export const recordMindCheckBody = z.object({
  clientRef: z.uuid(),
  takenAt: pastOrNow,
  answers: z
    .array(
      z.object({
        area: z.enum(CHECK_AREAS),
        question: z.string().max(40),
        kind: z.enum(["choice", "multi"]),
        score: z.number().min(0).max(1),
        ms: z.number().int().min(0).max(3_600_000),
      }),
    )
    .min(1)
    .max(50),
});

export const analyticsQuery = z.object({ days: z.coerce.number().int().min(7).max(365).default(30) });
