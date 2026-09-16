import "./setupEnv.js";
import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type { MindCheck, SessionSummary } from "../src/models/activity.js";

const { decrypt, encrypt, decryptJson, encryptJson } = await import("../src/utils/crypto.js");
const { hashSecret, verifySecret } = await import("../src/utils/password.js");
const { signAccessToken, verifyAccessToken, hashToken } = await import("../src/utils/tokens.js");
const { distanceM, bearingDeg, isOutside } = await import("../src/utils/geo.js");
const scoring = await import("../src/utils/scoring.js");

const session = (over: Partial<SessionSummary>): SessionSummary => ({
  id: "s", clientRef: "c", gameType: "memory-cards", level: 2, accuracy: 0.8, responseMs: 5200, attempts: 2,
  playedAt: new Date().toISOString(), ...over,
});

const check = (over: Partial<MindCheck>): MindCheck => ({
  id: "m", takenAt: new Date().toISOString(), memory: 67, attention: null, recognition: 80, recall: null, reasoning: null,
  orientation: 100, overall: 70, avgResponseMs: 3000, answerCount: 3, inconsistent: false, ...over,
});

describe("field encryption", () => {
  it("round-trips and never repeats ciphertext", () => {
    const a = encrypt("+919800000045");
    assert.notEqual(a, encrypt("+919800000045"));
    assert.equal(decrypt(a), "+919800000045");
    assert.deepEqual(decryptJson(encryptJson({ lat: 26.1, lon: 91.7 })), { lat: 26.1, lon: 91.7 });
  });

  it("rejects tampered ciphertext", () => {
    const parts = encrypt("secret").split(".");
    parts[3] = Buffer.from("tampered").toString("base64url");
    assert.throws(() => decrypt(parts.join(".")));
  });
});

describe("password hashing", () => {
  it("verifies the right secret only", async () => {
    const stored = await hashSecret("correct horse battery");
    assert.match(stored, /^scrypt\$/);
    assert.equal(await verifySecret("correct horse battery", stored), true);
    assert.equal(await verifySecret("wrong horse battery", stored), false);
    assert.equal(await verifySecret("anything", "not-a-hash"), false);
  });
});

describe("tokens", () => {
  it("signs and verifies access tokens, rejecting tampering", () => {
    const token = signAccessToken({ sub: "user-1", role: "caregiver" });
    assert.deepEqual(verifyAccessToken(token), { sub: "user-1", role: "caregiver" });
    assert.throws(() => verifyAccessToken(`${token}x`));
  });

  it("hashes refresh tokens to 64 hex characters", () => {
    assert.match(hashToken("abc"), /^[0-9a-f]{64}$/);
  });
});

describe("geofence", () => {
  const home = { lat: 26.1445, lon: 91.7362 };
  it("measures distance and bearing", () => {
    const ne = { lat: 26.1515, lon: 91.744 };
    assert.ok(Math.abs(distanceM(home, ne) - 1101) < 5);
    assert.ok(Math.abs(bearingDeg(home, ne) - 45) < 3);
  });

  it("applies hysteresis so the boundary does not flicker", () => {
    assert.equal(isOutside(510, 500, 20, false), false, "inside grace, was inside");
    assert.equal(isOutside(540, 500, 20, false), true, "past grace");
    assert.equal(isOutside(490, 500, 20, true), true, "just inside, was outside");
    assert.equal(isOutside(460, 500, 20, true), false, "well inside");
  });
});

describe("engagement scoring", () => {
  it("matches the original formula", () => {
    assert.equal(scoring.engagementScore([session({})]), 71);
    assert.equal(scoring.engagementScore([]), null);
  });

  it("needs two sessions on each side for a trend", () => {
    assert.equal(scoring.trendPct([session({}), session({})]), null);
    const older = [0.8, 0.8, 0.8, 0.8].map((accuracy) => session({ accuracy }));
    const recent = [0.4, 0.4, 0.4, 0.4].map((accuracy) => session({ accuracy }));
    assert.equal(scoring.trendPct([...older, ...recent]), -50);
  });

  it("levels up after 80%, down after two sessions under 45%", () => {
    assert.equal(scoring.ruleNextLevel("pattern", [session({ gameType: "pattern", level: 2, accuracy: 0.9 })], null), 3);
    const low = [0.3, 0.2].map((accuracy) => session({ gameType: "pattern", level: 3, accuracy }));
    assert.equal(scoring.ruleNextLevel("pattern", low, null), 2);
  });

  it("starts an unplayed game from the mind check", () => {
    assert.equal(scoring.baselineLevel("name-face", check({ recognition: 80 })), 4);
    assert.equal(scoring.baselineLevel("attention", check({ attention: null, overall: 44 })), 2);
    assert.equal(scoring.baselineLevel("attention", null), 1);
  });

  it("flags a 34-point recognition drop as inconsistent", () => {
    assert.equal(scoring.isInconsistent(check({ recognition: 90 }), 56), true);
    assert.equal(scoring.isInconsistent(check({ recognition: 90 }), 60), false);
  });
});
