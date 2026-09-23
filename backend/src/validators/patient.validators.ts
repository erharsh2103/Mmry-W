import { z } from "zod";
import { cleanText, langCode, uuid } from "./common.js";

export const createPatientBody = z.object({
  displayName: cleanText(80).pipe(z.string().min(1, "Name is required")),
  language: langCode.default("en"),
});

const vault = z
  .object({
    home: cleanText(300),
    doctor: cleanText(300),
    emergency: cleanText(300),
    medicines: cleanText(300),
    memories: z.array(z.object({
      id: z.string().uuid(),
      kind: z.enum(["family", "object"]),
      title: cleanText(80).pipe(z.string().min(1)),
      note: cleanText(300),
      image: z.string().max(2_000_000).nullable(),
      createdAt: z.string().datetime(),
    })).max(30),
  })
  .partial();

export const updatePatientBody = z
  .object({
    displayName: cleanText(80).pipe(z.string().min(1)),
    age: z.number().int().min(1).max(130).nullable(),
    language: langCode,
    caregiverName: cleanText(80).nullable(),
    caregiverPhone: z
      .string()
      .max(32)
      .regex(/^[0-9+()\-\s]*$/, "Phone may contain only digits, spaces, +, - and brackets")
      .nullable(),
    vault,
    voiceOn: z.boolean(),
    voicePref: z.enum(["auto", "female", "male"]),
    voiceRate: z.union([z.literal(0.75), z.literal(0.9), z.literal(1.1)]),
    fontScale: z.number().min(0.9).max(1.4),
    onboardingDone: z.boolean(),
  })
  .partial()
  .refine((v) => Object.keys(v).length > 0, "Nothing to update");

export const setPinBody = z.object({
  pin: z.string().regex(/^\d{4}$/, "The code must be exactly 4 digits").nullable(),
});

export const verifyPinBody = z.object({
  pin: z.string().regex(/^\d{4}$/, "The code must be exactly 4 digits"),
});

export const taskParams = z.object({ patientId: uuid, taskId: uuid });
export const setTaskBody = z.object({ day: z.iso.date(), done: z.boolean() });

/* Bounds mirror the CHECK constraints on tasks (label <= 120, 0 <= hour < 24, icon pattern). */
export const createTaskBody = z.object({
  label: cleanText(120).pipe(z.string().min(1, "A reminder needs something to remember")),
  hour: z.number().finite().min(0).max(23.99),
  icon: z
    .string()
    .regex(/^[a-z0-9_]{1,40}$/, "Unknown icon")
    .default("event_note"),
  day: z.iso.date().optional(),
});

export const personParams = z.object({ patientId: uuid, personId: uuid });
export const createPersonBody = z.object({
  name: cleanText(80).pipe(z.string().min(1, "Name is required")),
  relation: cleanText(80).nullable().optional(),
  note: cleanText(500).nullable().optional(),
  emoji: z.string().min(1).max(16),
  isPlace: z.boolean().default(false),
});
