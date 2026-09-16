import "./setupEnv.js";
import assert from "node:assert/strict";
import type { AddressInfo } from "node:net";
import { after, before, describe, it } from "node:test";

/*
 * Security behaviour at the HTTP boundary that must hold before any database
 * is reached: authentication, CSRF, validation, error shape and headers.
 */
const { createApp } = await import("../src/app.js");
const { signAccessToken } = await import("../src/utils/tokens.js");
const { pool } = await import("../src/config/postgres.js");

let base = "";
let server: ReturnType<ReturnType<typeof createApp>["listen"]>;

before(async () => {
  server = createApp().listen(0);
  await new Promise((r) => server.once("listening", r));
  base = `http://127.0.0.1:${(server.address() as AddressInfo).port}/api/v1`;
});

after(async () => {
  server.close();
  await pool.end();
});

const json = { "content-type": "application/json" };

describe("API boundary", () => {
  it("serves liveness with security headers and no framework banner", async () => {
    const res = await fetch(`${base}/health`);
    assert.equal(res.status, 200);
    assert.equal(res.headers.get("x-powered-by"), null);
    assert.equal(res.headers.get("x-content-type-options"), "nosniff");
    assert.match(res.headers.get("content-security-policy") ?? "", /default-src 'none'/);
    assert.ok(res.headers.get("x-request-id"));
  });

  it("requires a bearer token for patient data", async () => {
    const res = await fetch(`${base}/patients`);
    assert.equal(res.status, 401);
    const body = (await res.json()) as { error: { code: string } };
    assert.equal(body.error.code, "unauthorized");
  });

  it("rejects forged and expired-looking tokens", async () => {
    const good = signAccessToken({ sub: "u", role: "caregiver" });
    const res = await fetch(`${base}/patients`, { headers: { authorization: `Bearer ${good.slice(0, -2)}xx` } });
    assert.equal(res.status, 401);
  });

  it("validates registration input before touching the database", async () => {
    const res = await fetch(`${base}/auth/register`, {
      method: "POST",
      headers: json,
      body: JSON.stringify({ email: "not-an-email", password: "short", fullName: "" }),
    });
    assert.equal(res.status, 400);
    const body = (await res.json()) as { error: { details: { path: string }[] } };
    const paths = body.error.details.map((d) => d.path).sort();
    assert.deepEqual(paths, ["email", "fullName", "password"]);
  });

  it("refuses cookie-authenticated calls without the CSRF header", async () => {
    const res = await fetch(`${base}/auth/refresh`, { method: "POST" });
    assert.equal(res.status, 403);
  });

  it("returns 404 for a malformed patient id without querying", async () => {
    const token = signAccessToken({ sub: "u", role: "caregiver" });
    const res = await fetch(`${base}/patients/not-a-uuid/tasks?day=2026-01-01`, { headers: { authorization: `Bearer ${token}` } });
    assert.equal(res.status, 404);
  });

  it("reports malformed JSON as a 400, not a crash", async () => {
    const res = await fetch(`${base}/auth/login`, { method: "POST", headers: json, body: "{nope" });
    assert.equal(res.status, 400);
  });

  it("rejects oversized bodies", async () => {
    const res = await fetch(`${base}/auth/login`, { method: "POST", headers: json, body: JSON.stringify({ email: "a@b.co", password: "x".repeat(200_000) }) });
    assert.equal(res.status, 413);
  });

  it("answers unknown routes with the standard error shape", async () => {
    const res = await fetch(`${base}/nope`);
    assert.equal(res.status, 404);
    const body = (await res.json()) as { error: { code: string; requestId: string } };
    assert.equal(body.error.code, "not_found");
    assert.ok(body.error.requestId);
  });
});
