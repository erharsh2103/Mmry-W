#!/usr/bin/env node
/*
 * Create a local `.env` from `.env.example`, replacing every CHANGE_ME
 * placeholder with a freshly generated random value.
 *
 *   node scripts/generate-env.mjs          # writes .env (refuses to overwrite)
 *   node scripts/generate-env.mjs --print  # prints to stdout instead
 *
 * For production, generate secrets with your secret manager instead and
 * inject them as environment variables; never commit a `.env`.
 */
import { randomBytes } from "node:crypto";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const example = readFileSync(join(ROOT, ".env.example"), "utf8");

const token = (bytes) => randomBytes(bytes).toString("base64url");

const out = example
  .split(/\r?\n/)
  .map((line) => {
    const m = line.match(/^([A-Z0-9_]+)=(.*)$/);
    if (!m || !m[2].startsWith("CHANGE_ME")) return line;
    const key = m[1];
    if (key === "DATA_ENCRYPTION_KEY") return `${key}=${randomBytes(32).toString("base64")}`;
    if (key.endsWith("_SECRET") || key.endsWith("_TOKEN")) return `${key}=${token(48)}`;
    return `${key}=${token(24)}`;
  })
  .join("\n");

if (process.argv.includes("--print")) {
  process.stdout.write(out);
} else {
  const target = join(ROOT, ".env");
  if (existsSync(target)) {
    console.error(".env already exists - not overwriting. Use --print to see fresh values.");
    process.exit(1);
  }
  writeFileSync(target, out, { mode: 0o600 });
  console.log("wrote .env with generated secrets");
}
