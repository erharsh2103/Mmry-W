import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { genderOf, resolveVoice, speakable, speechLanguage, voiceInfoFor } from "@/lib/speech/voices";

const HINDI_F = { name: "Microsoft Swara Online", lang: "hi-IN" };
const HINDI_M = { name: "Google Madhur", lang: "hi-IN" };
const ENGLISH = { name: "Microsoft Ravi", lang: "en-IN" };

describe("voice selection", () => {
  it("detects female before male (female contains 'male')", () => {
    assert.equal(genderOf({ name: "Some Female Voice", lang: "en-US" }), "female");
    assert.equal(genderOf(HINDI_M), "male");
    assert.equal(genderOf({ name: "Unnamed", lang: "en-US" }), "unknown");
  });

  it("uses a native voice and honours the gender preference", () => {
    const r = resolveVoice("hi", [ENGLISH, HINDI_M, HINDI_F], "female");
    assert.equal(r.status, "native");
    assert.equal(r.voice?.name, HINDI_F.name);
  });

  it("follows the chain for Assamese to a Bengali-script voice", () => {
    const bengali = { name: "Bangla", lang: "bn-IN" };
    const r = resolveVoice("as", [ENGLISH, bengali], "auto");
    assert.equal(r.voice?.name, "Bangla");
    assert.equal(r.status, "substitute");
    assert.equal(speechLanguage("as", r), "as");
  });

  it("switches spoken text to a readable stand-in when no voice shares the script", () => {
    const r = resolveVoice("as", [HINDI_F], "auto");
    assert.equal(r.voice?.lang, "hi-IN");
    assert.equal(speechLanguage("as", r), "hi");
  });

  it("reports no voice when the device has none", () => {
    assert.equal(resolveVoice("hi", [], "auto").status, "none");
    assert.equal(voiceInfoFor("hi", []).status, "none");
  });

  it("strips emoji before speaking", () => {
    assert.equal(speakable("Find the fish 🐟  now"), "Find the fish now");
  });
});
