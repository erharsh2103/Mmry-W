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

export const personParams = z.object({ patientId: uuid, personId: uuid });
export const createPersonBody = z.object({
  name: cleanText(80).pipe(z.string().min(1, "Name is required")),
  relation: cleanText(80).nullable().optional(),
  note: cleanText(500).nullable().optional(),
  emoji: z.string().min(1).max(16),
  isPlace: z.boolean().default(false),
});
