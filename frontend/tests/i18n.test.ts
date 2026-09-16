import assert from "node:assert/strict";
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, it } from "node:test";
import { translate } from "@/lib/i18n/translate";

const DIR = join(import.meta.dirname, "..", "lib", "i18n", "locales");
const load = (file: string) => JSON.parse(readFileSync(join(DIR, file), "utf8")) as Record<string, string>;
const en = load("en.json");

describe("translations", () => {
  it("falls back to English, then to the key", () => {
    assert.equal(translate("en", "greeting"), en.greeting);
    assert.equal(translate("xx", "greeting"), en.greeting);
    assert.equal(translate("en", "no_such_key"), "no_such_key");
  });

  it("substitutes every occurrence of a variable", () => {
    assert.equal(translate("en", "vMed", { label: "Morning medicine", time: "8:00" }), "Morning medicine is at 8:00.");
  });

  it("every locale only uses keys English defines", () => {
    for (const file of readdirSync(DIR)) {
      const extra = Object.keys(load(file)).filter((k) => !(k in en));
      assert.deepEqual(extra, [], file);
    }
  });

  it("no locale still carries retired offline-pack strings", () => {
    for (const file of readdirSync(DIR)) {
      const keys = Object.keys(load(file));
      assert.deepEqual(keys.filter((k) => k.startsWith("pk") || k === "offline" || k === "vNeedPack"), [], file);
    }
  });
});
