/*
 * Password and PIN hashing with scrypt (memory-hard, built into Node).
 *
 * Stored format: scrypt$N$r$p$<salt base64url>$<hash base64url>
 * Parameters are stored with each hash so they can be raised later without
 * invalidating existing accounts.
 */
import { randomBytes, scrypt as scryptCb, timingSafeEqual, type ScryptOptions } from "node:crypto";

const N = 2 ** 15;
const R = 8;
const P = 1;
const KEY_LEN = 32;

function scrypt(secret: string, salt: Buffer, keylen: number, opts: ScryptOptions): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    scryptCb(secret, salt, keylen, opts, (err, key) => (err ? reject(err) : resolve(key)));
  });
}

export async function hashSecret(secret: string): Promise<string> {
  const salt = randomBytes(16);
  const hash = await scrypt(secret.normalize("NFKC"), salt, KEY_LEN, { N, r: R, p: P, maxmem: 128 * N * R * 2 });
  return ["scrypt", N, R, P, salt.toString("base64url"), hash.toString("base64url")].join("$");
}

export async function verifySecret(secret: string, stored: string): Promise<boolean> {
  const parts = stored.split("$");
  if (parts.length !== 6 || parts[0] !== "scrypt") return false;
  const [, n, r, p, saltB64, hashB64] = parts as [string, string, string, string, string, string];
  const expected = Buffer.from(hashB64, "base64url");
  const cost = Number(n);
  const block = Number(r);
  const actual = await scrypt(secret.normalize("NFKC"), Buffer.from(saltB64, "base64url"), expected.length, {
    N: cost,
    r: block,
    p: Number(p),
    maxmem: 128 * cost * block * 2,
  });
  return actual.length === expected.length && timingSafeEqual(actual, expected);
}

/* A real hash of a random value, verified against when an account does not
   exist, so login takes the same time whether or not the email is known. */
let dummyHash: Promise<string> | null = null;
export function dummyPasswordHash(): Promise<string> {
  dummyHash ??= hashSecret(randomBytes(24).toString("base64url"));
  return dummyHash;
}
