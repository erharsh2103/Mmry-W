import { z } from "zod";
import { cleanText, langCode, uuid } from "./common.js";

export const updateZoneBody = z
  .object({
    // must match models/safety.ts RADII and the CHECK on safe_zones.radius_m
    radiusM: z.union([z.literal(200), z.literal(500), z.literal(1000), z.literal(2000)]),
    armed: z.boolean(),
    trackingEnabled: z.boolean(),
  })
  .partial()
  .refine((v) => Object.keys(v).length > 0, "Nothing to update");

export const setHomeBody = z.discriminatedUnion("kind", [
  z.object({ kind: z.literal("lastFix") }),
  z.object({ kind: z.literal("place"), personId: uuid }),
]);

export const reportFixBody = z.object({
  lat: z.number().min(-90).max(90),
  lon: z.number().min(-180).max(180),
  accuracyM: z.number().min(0).max(100_000),
});

export const classifyIntentBody = z.object({
  text: cleanText(500).pipe(z.string().min(1, "Nothing was said")),
  lang: langCode,
  source: z.enum(["speech", "chip"]),
  speechConfidence: z.number().min(0).max(1).nullable().default(null),
});
