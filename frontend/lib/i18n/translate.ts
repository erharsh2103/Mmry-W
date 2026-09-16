/*
 * Translation tables are split per language and loaded on demand, so a
 * patient downloads only English plus their own language.
 *
 * Lookup order, as in the original app: the language's own table, then
 * English, then the key itself.
 */
import en from "./locales/en.json";
import { TABLE_LANGS } from "./languages";

export type Table = Record<string, string>;
export type Vars = Record<string, string | number>;

const EN = en as Table;
const cache = new Map<string, Table>([["en", EN]]);

export function hasLocale(lang: string): boolean {
  return cache.has(lang) || !TABLE_LANGS.has(lang);
}

export async function loadLocale(lang: string): Promise<void> {
  if (hasLocale(lang)) return;
  const mod = (await import(`./locales/${lang}.json`)) as { default: Table };
  cache.set(lang, mod.default);
}

export function translate(lang: string, key: string, vars?: Vars): string {
  if (!key) return "";
  let out = cache.get(lang)?.[key] ?? EN[key] ?? key;
  if (vars) {
    for (const [name, value] of Object.entries(vars)) out = out.split(`{${name}}`).join(String(value));
  }
  return out;
}

export type Translator = (key: string, vars?: Vars) => string;

export const translatorFor =
  (lang: string): Translator =>
  (key, vars) =>
    translate(lang, key, vars);
