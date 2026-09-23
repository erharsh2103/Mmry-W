import type { Translator } from "@/lib/i18n/translate";
import { DATE_LOCALE } from "@/lib/i18n/languages";

const TIME_WORDS = /\b(?:what(?:'s| is)?\s+(?:the\s+)?(?:current\s+)?time|time\s+is\s+it|current\s+time|tell(?: me)?\s+(?:the\s+)?(?:current\s+)?time|time\s+now|what\s+is\s+the\s+clock|clock)\b|समय|टाइम/i;

export function isTimeQuestion(text: string): boolean {
  return TIME_WORDS.test(text);
}

export function currentTimeReply(lang: string, t: Translator): string {
  const locale = DATE_LOCALE[lang] ?? "en-IN";
  const time = new Intl.DateTimeFormat(locale, { hour: "numeric", minute: "2-digit" }).format(new Date());
  return t("vTimeNow", { time });
}