/*
 * Languages Mmry supports and how each one is read aloud. Carried over from
 * the original app unchanged.
 */

export interface Language {
  code: string;
  label: string;
}

export const LANGS: Language[] = [
  { code: "as", label: "অসমীয়া · Assamese" },
  { code: "brx", label: "बड़ो · Bodo" },
  { code: "kha", label: "Khasi" },
  { code: "lus", label: "Mizo (Lushai)" },
  { code: "mni", label: "মৈতৈলোন় · Manipuri" },
  { code: "nag", label: "Nagamese" },
  { code: "grt", label: "Garo · A·chik" },
  { code: "trp", label: "ককবরক · Kokborok" },
  { code: "sat", label: "ᱥᱟᱱᱛᱟᱲᱤ · Santali" },
  { code: "en", label: "English" },
  { code: "hi", label: "हिन्दी · Hindi" },
  { code: "bn", label: "বাংলা · Bengali" },
  { code: "mr", label: "मराठी · Marathi" },
  { code: "gu", label: "ગુજરાતી · Gujarati" },
  { code: "pa", label: "ਪੰਜਾਬੀ · Punjabi" },
  { code: "or", label: "ଓଡ଼ିଆ · Odia" },
  { code: "ta", label: "தமிழ் · Tamil" },
  { code: "te", label: "తెలుగు · Telugu" },
  { code: "kn", label: "ಕನ್ನಡ · Kannada" },
  { code: "ml", label: "മലയാളം · Malayalam" },
  { code: "ur", label: "اردو · Urdu" },
  { code: "ne", label: "नेपाली · Nepali" },
  { code: "sa", label: "संस्कृतम् · Sanskrit" },
  { code: "sd", label: "سنڌي · Sindhi" },
  { code: "ks", label: "کٲشُر · Kashmiri" },
  { code: "kok", label: "कोंकणी · Konkani" },
  { code: "mai", label: "मैथिली · Maithili" },
  { code: "doi", label: "डोगरी · Dogri" },
];

/* The languages offered in setup, North-East first. */
export const SELECTOR = ["as", "bn", "brx", "mni", "kha", "lus", "nag", "ne", "grt", "trp", "hi", "en"];

/* Languages with a translation table; the rest read English text. */
export const TABLE_LANGS = new Set([
  "en", "brx", "kha", "lus", "mni", "nag", "hi", "bn", "as", "mr", "gu", "pa", "or", "ta", "te", "kn", "ml", "ur", "ne",
  "sa", "sd", "ks", "kok", "mai", "doi", "sat",
]);

export const RTL = new Set(["ur", "sd", "ks"]);

export const DATE_LOCALE: Record<string, string> = {
  hi: "hi-IN", bn: "bn-IN", as: "as-IN", mr: "mr-IN", gu: "gu-IN", pa: "pa-IN", or: "or-IN",
  ta: "ta-IN", te: "te-IN", kn: "kn-IN", ml: "ml-IN", ur: "ur-IN", ne: "ne-NP", sa: "hi-IN",
  brx: "hi-IN", mai: "hi-IN", doi: "hi-IN", kok: "mr-IN", sat: "hi-IN", sd: "ur-IN", ks: "ur-IN",
  mni: "bn-IN", en: "en-IN", kha: "en-IN", lus: "en-IN", nag: "en-IN", grt: "en-IN", trp: "bn-IN",
};

/* Voice preference chain per language: the first installed tag wins. */
export const VOICE_CHAIN: Record<string, string[]> = {
  hi: ["hi-IN", "hi"], bn: ["bn-IN", "bn-BD", "bn"], as: ["as-IN", "bn-IN", "hi-IN"],
  grt: ["en-IN", "en"], trp: ["bn-IN", "bn-BD", "as-IN"],
  mr: ["mr-IN", "hi-IN"], gu: ["gu-IN", "hi-IN"], pa: ["pa-IN", "pa-Guru-IN", "hi-IN"],
  or: ["or-IN", "bn-IN", "hi-IN"], ta: ["ta-IN", "ta-LK", "ta"], te: ["te-IN", "te"],
  kn: ["kn-IN", "kn"], ml: ["ml-IN", "ml"], ur: ["ur-PK", "ur-IN", "hi-IN"],
  ne: ["ne-NP", "hi-IN"], en: ["en-IN", "en-GB", "en-US", "en"],
  brx: ["brx-IN", "hi-IN"], sat: ["sat-IN", "hi-IN"], sa: ["sa-IN", "hi-IN"],
  mai: ["mai-IN", "hi-IN"], doi: ["doi-IN", "hi-IN"], kok: ["kok-IN", "mr-IN", "hi-IN"],
  sd: ["sd-IN", "ur-PK", "hi-IN"], ks: ["ks-IN", "ur-PK", "hi-IN"],
  kha: ["kha-IN", "en-IN"], lus: ["lus-IN", "en-IN"], nag: ["nag-IN", "as-IN", "en-IN"],
  mni: ["mni-IN", "bn-IN", "en-IN"],
};

/* Script each language is written in. */
export const SCRIPT: Record<string, string> = {
  hi: "deva", mr: "deva", ne: "deva", sa: "deva", brx: "deva", mai: "deva", doi: "deva", kok: "deva",
  bn: "beng", as: "beng", mni: "mtei", or: "orya", gu: "gujr", pa: "guru",
  ta: "taml", te: "telu", kn: "knda", ml: "mlym", ur: "arab", sd: "arab", ks: "arab",
  sat: "olck", en: "latn", kha: "latn", lus: "latn", nag: "latn",
};

/* Which script a voice of a given base language can actually pronounce. */
export const VOICE_SCRIPT: Record<string, string> = {
  hi: "deva", mr: "deva", ne: "deva", sa: "deva",
  bn: "beng", as: "beng", or: "orya", gu: "gujr", pa: "guru",
  ta: "taml", te: "telu", kn: "knda", ml: "mlym", ur: "arab", en: "latn",
};

/* Readable stand-in language for each script, used when no voice can read the display language. */
export const SCRIPT_DICT: Record<string, string> = {
  deva: "hi", beng: "bn", orya: "or", gujr: "gu", guru: "pa", taml: "ta", telu: "te", knda: "kn", mlym: "ml", arab: "ur", latn: "en",
};

export const NATIVE_TAG: Record<string, string> = {
  hi: "hi", bn: "bn", as: "as", mr: "mr", gu: "gu", pa: "pa", or: "or", ta: "ta", te: "te", kn: "kn", ml: "ml", ur: "ur", ne: "ne", en: "en",
};

export const VOICE_LANGS: Record<string, string> = {
  brx: "hi-IN", kha: "en-IN", lus: "en-IN", nag: "as-IN", mni: "bn-IN", grt: "en-IN", trp: "bn-IN",
  sat: "hi-IN", sa: "hi-IN", sd: "ur-PK", ks: "ur-PK", kok: "mr-IN", mai: "hi-IN", doi: "hi-IN", hi: "hi-IN",
  bn: "bn-IN", as: "as-IN", ta: "ta-IN", te: "te-IN", kn: "kn-IN", ml: "ml-IN", mr: "mr-IN", gu: "gu-IN",
  pa: "pa-IN", or: "or-IN", ur: "ur-IN", ne: "ne-NP",
};

export function languageLabel(code: string): string {
  return LANGS.find((l) => l.code === code)?.label ?? code;
}

export function splitLabel(code: string): { native: string; english: string } {
  const parts = languageLabel(code).split(" · ");
  return { native: parts[0] ?? code, english: parts[1] ?? "" };
}
