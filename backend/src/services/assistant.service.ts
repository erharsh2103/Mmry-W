/*
 * Talk companion: decide what the patient asked for.
 *
 * The scikit-learn classifier in the AI service answers first. When it is
 * unreachable, the keyword rule from the original app answers instead, so the
 * companion never goes silent. Replies are composed by the frontend in the
 * patient's language from the returned intent.
 *
 * What the patient said is stored only encrypted, with a 180-day expiry.
 */
import { logger } from "../config/logger.js";
import { assistantTurnsRepository } from "../repositories/documents.repository.js";
import { encrypt } from "../utils/crypto.js";
import { aiClient } from "./aiClient.service.js";

export const INTENT_IDS = ["med", "today", "who", "game", "check", "people", "unknown"] as const;
export type IntentId = (typeof INTENT_IDS)[number];

/* Keyword rule from the original app - the fallback classifier. */
const KEYWORDS: { id: Exclude<IntentId, "unknown">; words: string[] }[] = [
  { id: "med", words: ["medicine", "medication", "tablet", "dawa", "davaa", "दवा", "दवाई", "ওষুধ", "మందు", "ಔಷಧಿ", "മരുന്ന്", "மாத்திரை", "دوا"] },
  { id: "today", words: ["today", "schedule", "routine", "aaj", "आज", "दिनचर्या", "আজ", "இன்று", "నేడు", "ಇಂದು", "ഇന്ന്", "آج"] },
  { id: "who", words: ["who is", "who's", "kaun", "कौन", "কে", "யார்", "ఎవరు", "ಯಾರು", "ആരാണ്", "کون"] },
  { id: "game", words: ["game", "play", "khel", "खेल", "খেল", "ஆட்டம்", "ఆట", "ಆಟ", "കളി", "کھیل"] },
  { id: "check", words: ["mind check", "question", "sawal", "सवाल", "प्रश्न", "প্রশ্ন", "கேள்வி", "ప్రశ్న", "ಪ್ರಶ್ನೆ", "ചോദ്യം", "سوال"] },
  { id: "people", words: ["family", "people", "parivar", "परिवार", "পরিবার", "குடும்பம்", "కుటుంబం", "ಕುಟುಂಬ", "കുടുംബം", "خاندان"] },
];

export function keywordIntent(text: string): IntentId {
  const low = ` ${text.toLowerCase()} `;
  return KEYWORDS.find((k) => k.words.some((w) => low.includes(w)))?.id ?? "unknown";
}

export interface IntentOutcome {
  intent: IntentId;
  confidence: number;
  source: "model" | "rule";
  modelVersion: string | null;
}

export const assistantService = {
  async classify(
    patientId: string,
    userId: string,
    input: { text: string; lang: string; source: "speech" | "chip"; speechConfidence: number | null },
  ): Promise<IntentOutcome> {
    const ai = await aiClient.classifyIntent(patientId, input.text, input.lang);
    const outcome: IntentOutcome = ai
      ? { intent: ai.intent, confidence: ai.confidence, source: "model", modelVersion: ai.model.version }
      : { intent: keywordIntent(input.text), confidence: 1, source: "rule", modelVersion: null };

    await assistantTurnsRepository
      .insert({
        patientId,
        userId,
        lang: input.lang,
        source: input.source,
        textEnc: encrypt(input.text),
        speechConfidence: input.speechConfidence,
        intent: outcome.intent,
        confidence: outcome.confidence,
        classifier: {
          name: ai ? ai.model.name : "keyword-rule",
          version: ai ? ai.model.version : "1",
          fallback: !ai,
        },
        createdAt: new Date(),
      })
      .catch((err: Error) => logger.warn("assistant turn not stored", { error: err.message }));

    return outcome;
  },
};
