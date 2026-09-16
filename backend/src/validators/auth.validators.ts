import { z } from "zod";
import { cleanText } from "./common.js";

/* Length over composition rules (NIST SP 800-63B): 10+ characters, capped so
   hashing cost stays bounded. */
const password = z
  .string()
  .min(10, "Password must be at least 10 characters")
  .max(128, "Password must be at most 128 characters");

export const registerBody = z.object({
  email: z.email().max(254),
  password,
  fullName: cleanText(120).pipe(z.string().min(1, "Name is required")),
});

export const loginBody = z.object({
  email: z.email().max(254),
  password: z.string().min(1).max(128),
});
