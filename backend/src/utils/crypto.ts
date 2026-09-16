/*
 * Field-level encryption for sensitive data at rest (phone numbers,
 * coordinates, the memory vault, talk-companion transcripts).
 *
 * AES-256-GCM with a random 12-byte IV per value. Output format:
 *
 *   v1.<iv base64url>.<auth tag base64url>.<ciphertext base64url>
 *
 * The version prefix leaves room for key rotation: a future v2 can decrypt
 * v1 values with the old key and re-encrypt them.
 */
import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";
import { env } from "../config/env.js";

const VERSION = "v1";
const key = Buffer.from(env.DATA_ENCRYPTION_KEY, "base64");

export function encrypt(plaintext: string): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", key, iv);
  const body = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return [VERSION, iv.toString("base64url"), tag.toString("base64url"), body.toString("base64url")].join(".");
}

export function decrypt(payload: string): string {
  const [version, iv, tag, body] = payload.split(".");
  if (version !== VERSION || !iv || !tag || body === undefined) {
    throw new Error("unsupported ciphertext format");
  }
  const decipher = createDecipheriv("aes-256-gcm", key, Buffer.from(iv, "base64url"));
  decipher.setAuthTag(Buffer.from(tag, "base64url"));
  return Buffer.concat([decipher.update(Buffer.from(body, "base64url")), decipher.final()]).toString("utf8");
}

export function encryptJson(value: unknown): string {
  return encrypt(JSON.stringify(value));
}

export function decryptJson<T>(payload: string | null | undefined): T | null {
  if (!payload) return null;
  return JSON.parse(decrypt(payload)) as T;
}

export function encryptOptional(value: string | null | undefined): string | null {
  return value ? encrypt(value) : null;
}

export function decryptOptional(payload: string | null | undefined): string | null {
  return payload ? decrypt(payload) : null;
}
