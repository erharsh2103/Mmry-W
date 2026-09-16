/*
 * Choosing a speech voice for a patient's language from what the device has
 * installed. Ported from the original app.
 *
 * The rule that matters: never hand a voice text in a script it cannot read.
 * If no installed voice can pronounce the display language, the spoken line
 * switches to a stand-in language that shares the voice's script, while the
 * screen keeps the patient's own language.
 */
import { NATIVE_TAG, SCRIPT, SCRIPT_DICT, TABLE_LANGS, VOICE_CHAIN, VOICE_LANGS, VOICE_SCRIPT } from "@/lib/i18n/languages";
import type { VoicePref } from "@/types/api";

export interface VoiceLike {
  name: string;
  lang: string;
}

export type Gender = "female" | "male" | "unknown";

const FEMALE_HINTS = ["female", "woman", "heera", "kalpana", "swara", "zira", "susan", "samantha", "karen", "moira", "tessa", "veena", "priya", "aditi", "lekha", "sangeeta", "kanya", "shruti", "google हिन्दी", "eva", "hazel", "catherine", "linda", "maria", "anna", "neerja", "aarohi"];
const MALE_HINTS = ["male", "man", "ravi", "hemant", "david", "mark", "george", "james", "daniel", "alex", "fred", "rishi", "prabhat", "madhur", "sylvester", "guy", "eric", "ryan", "thomas"];

const tagOf = (v: VoiceLike) => (v.lang || "").replace("_", "-");
const baseOf = (v: VoiceLike) => tagOf(v).split("-")[0]?.toLowerCase() ?? "";

export function genderOf(v: VoiceLike | null | undefined): Gender {
  const n = (v?.name ?? "").toLowerCase();
  // Check female first: "female" contains "male".
  if (FEMALE_HINTS.some((x) => n.includes(x))) return "female";
  if (MALE_HINTS.some((x) => n.includes(x))) return "male";
  return "unknown";
}

export interface ResolvedVoice {
  voice: VoiceLike | null;
  tag: string;
  status: "native" | "substitute" | "none";
}

export function resolveVoice(lang: string, voices: VoiceLike[], pref: VoicePref): ResolvedVoice {
  const prefer = (pool: VoiceLike[]) => (pref === "auto" || !pool.length ? pool[0] : pool.find((v) => genderOf(v) === pref) ?? pool[0]);
  if (!voices.length) return { voice: null, tag: VOICE_LANGS[lang] ?? "en-IN", status: "none" };

  const chain = VOICE_CHAIN[lang] ?? ["en-IN"];
  const nativeTag = NATIVE_TAG[lang];
  for (const tag of chain) {
    const base = tag.split("-")[0];
    const exact = voices.filter((v) => tagOf(v) === tag);
    const loose = voices.filter((v) => baseOf(v) === base);
    const hit = prefer(exact.length ? exact : loose);
    if (hit) return { voice: hit, tag: hit.lang, status: nativeTag && base === nativeTag ? "native" : "substitute" };
  }

  // Nothing in the chain: fall back to a voice whose script we can write for.
  const scriptOf = (v: VoiceLike) => VOICE_SCRIPT[baseOf(v)] ?? "latn";
  for (const script of ["deva", "latn", "beng", "taml", "telu", "knda", "mlym", "gujr", "guru", "orya", "arab"]) {
    const stand = SCRIPT_DICT[script];
    const pool = voices.filter((v) => scriptOf(v) === script);
    if (!stand || !pool.length) continue;
    for (const tag of VOICE_CHAIN[stand] ?? []) {
      const hit = prefer(pool.filter((v) => tagOf(v) === tag));
      if (hit) return { voice: hit, tag: hit.lang, status: "substitute" };
    }
    const v = prefer(pool.filter((x) => /-IN$/i.test(tagOf(x)))) ?? prefer(pool)!;
    return { voice: v, tag: v.lang, status: "substitute" };
  }
  return { voice: null, tag: VOICE_LANGS[lang] ?? "en-IN", status: "none" };
}

/* The language whose words the resolved voice can actually pronounce. */
export function speechLanguage(display: string, resolved: ResolvedVoice): string {
  if (!resolved.voice) return display;
  const canRead = VOICE_SCRIPT[baseOf(resolved.voice)] ?? "latn";
  if ((SCRIPT[display] ?? "latn") === canRead) return display;
  const stand = SCRIPT_DICT[canRead] ?? "en";
  return TABLE_LANGS.has(stand) ? stand : "en";
}

/* Whether a language's intended voice is installed, for the language picker. */
export function voiceInfoFor(code: string, voices: VoiceLike[]): { status: "native" | "none"; gender: Gender; stand: VoiceLike | null } {
  if (!voices.length) return { status: "none", gender: "unknown", stand: null };
  const chain = VOICE_CHAIN[code] ?? [];
  const intended = [NATIVE_TAG[code], (chain[0] ?? "").split("-")[0], (VOICE_LANGS[code] ?? "").split("-")[0]].filter(Boolean);
  for (const want of intended) {
    const exact = voices.find((v) => tagOf(v) === (chain[0] ?? ""));
    const hit = exact && baseOf(exact) === want ? exact : voices.find((v) => baseOf(v) === want);
    if (hit) return { status: "native", gender: genderOf(hit), stand: null };
  }
  const r = resolveVoice(code, voices, "auto");
  return { status: "none", gender: r.voice ? genderOf(r.voice) : "unknown", stand: r.voice };
}

/* Emoji never reach the speech engine. */
export function speakable(text: string): string {
  return text.replace(/[\u{1F000}-\u{1FAFF}\u{2600}-\u{27BF}\u{FE0F}]/gu, "").replace(/\s+/g, " ").trim();
}
