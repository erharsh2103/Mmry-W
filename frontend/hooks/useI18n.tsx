"use client";

import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { DATE_LOCALE, RTL } from "@/lib/i18n/languages";
import { hasLocale, loadLocale, translatorFor, type Translator } from "@/lib/i18n/translate";

interface I18nValue {
  lang: string;
  t: Translator;
  dir: "ltr" | "rtl";
  locale: string;
  /* make another language's table available (e.g. for the speech stand-in) */
  ensure: (lang: string) => Promise<void>;
  translatorFor: (lang: string) => Translator;
}

const I18nContext = createContext<I18nValue | null>(null);

export function I18nProvider({ lang, children }: { lang: string; children: ReactNode }) {
  const [, setLoaded] = useState(0);

  useEffect(() => {
    if (hasLocale(lang)) return;
    let live = true;
    loadLocale(lang).then(() => live && setLoaded((n) => n + 1));
    return () => {
      live = false;
    };
  }, [lang]);

  // Flips to true once the table arrives, which produces a fresh translator.
  const ready = hasLocale(lang);

  const value = useMemo<I18nValue>(
    () => ({
      lang,
      t: translatorFor(lang),
      dir: RTL.has(lang) ? "rtl" : "ltr",
      locale: DATE_LOCALE[lang] ?? "en-IN",
      ensure: async (other) => {
        if (!hasLocale(other)) {
          await loadLocale(other);
          setLoaded((n) => n + 1);
        }
      },
      translatorFor,
    }),
    [lang, ready],
  );

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

export function useI18n(): I18nValue {
  const ctx = useContext(I18nContext);
  if (!ctx) throw new Error("useI18n must be used inside <I18nProvider>");
  return ctx;
}

/*
 * Lets first-run setup preview a language before the patient record exists
 * (or before the choice is saved). Cleared once the saved language arrives.
 */
export const LanguageDraftContext = createContext<(lang: string | null) => void>(() => undefined);

export function useLanguageDraft(): (lang: string | null) => void {
  return useContext(LanguageDraftContext);
}
