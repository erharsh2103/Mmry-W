import assert from "node:assert/strict";
import { afterEach, describe, it } from "node:test";
import { ApiError, api } from "@/lib/api";

const realFetch = globalThis.fetch;
const respond = (body: string, status: number, contentType = "text/plain") => {
  globalThis.fetch = (async () => new Response(body, { status, headers: { "content-type": contentType } })) as typeof fetch;
};

describe("API client", () => {
  afterEach(() => {
    globalThis.fetch = realFetch;
  });

  it("reports a plain-text error page (backend unreachable) as a connection failure", async () => {
    respond("Internal Server Error", 500);
    await assert.rejects(api.auth.login({ email: "a@b.co", password: "x" }), (err: unknown) => {
      assert.ok(err instanceof ApiError);
      assert.equal(err.isNetwork, true);
      return true;
    });
  });

  it("keeps the API's own error code and details", async () => {
    respond(JSON.stringify({ error: { code: "unauthorized", message: "Email or password is incorrect" } }), 401, "application/json");
    await assert.rejects(api.auth.login({ email: "a@b.co", password: "x" }), (err: unknown) => {
      assert.ok(err instanceof ApiError);
      assert.equal(err.status, 401);
      assert.equal(err.code, "unauthorized");
      assert.equal(err.isNetwork, false);
      return true;
    });
  });

  it("reports a failed fetch as a connection failure", async () => {
    globalThis.fetch = (async () => {
      throw new TypeError("fetch failed");
    }) as typeof fetch;
    await assert.rejects(api.auth.login({ email: "a@b.co", password: "x" }), (err: unknown) => err instanceof ApiError && err.isNetwork);
  });
});
