/*
 * Game content, unchanged from the original app. Every label is an i18n key:
 * familiar North-East Indian household objects and a daily routine.
 */
import type { CheckArea, GameType } from "@/types/api";

export interface GameObject {
  e: string;
  n: string;
}

export const OBJECTS: GameObject[] = [
  { e: "🍌", n: "obj_banana" }, { e: "🪔", n: "obj_diya" }, { e: "🧺", n: "obj_basket" },
  { e: "🌾", n: "obj_paddy" }, { e: "🌸", n: "obj_flower" }, { e: "🫖", n: "obj_kettle" },
  { e: "🥥", n: "obj_coconut" }, { e: "🪘", n: "obj_dhol" }, { e: "🐟", n: "obj_fish" },
  { e: "🧣", n: "obj_gamosa" }, { e: "🍵", n: "obj_tea" }, { e: "🪴", n: "obj_tulsi" },
];

export const ROUTINE: GameObject[] = [
  { e: "🌅", n: "rt_wake" }, { e: "🪥", n: "rt_brush" }, { e: "🍵", n: "rt_tea" },
  { e: "💊", n: "rt_med" }, { e: "🍚", n: "rt_lunch" }, { e: "🚶", n: "rt_walk" },
  { e: "🌙", n: "rt_sleep" },
];

export const EMOJIS = ["👨", "👩", "🧓", "👵", "🩺", "🏡", "🌾", "🐕"];

export const ODD_SETS = [
  { keep: ["obj_banana", "obj_coconut", "obj_tea"], odd: "obj_basket" },
  { keep: ["obj_flower", "obj_tulsi", "obj_paddy"], odd: "obj_kettle" },
];

export const WEEKDAYS = ["wdSun", "wdMon", "wdTue", "wdWed", "wdThu", "wdFri", "wdSat"];

export interface GameMeta {
  icon: string;
  tint: string;
  glyph: string;
  titleKey: string;
  blurbKey: string;
  area: CheckArea;
}

export const GAMES: Record<GameType, GameMeta> = {
  "object-recall": { icon: "🧺", tint: "#EFEEEA", glyph: "inventory_2", titleKey: "g1t", blurbKey: "g1b", area: "memory" },
  sequence: { icon: "🌅", tint: "#DCEFD8", glyph: "wb_twilight", titleKey: "g2t", blurbKey: "g2b", area: "reasoning" },
  "name-face": { icon: "👨‍👩‍👧", tint: "#EAE8E4", glyph: "groups", titleKey: "g3t", blurbKey: "g3b", area: "recognition" },
  attention: { icon: "🌼", tint: "#EFEEEA", glyph: "local_florist", titleKey: "g4t", blurbKey: "g4b", area: "attention" },
  "memory-cards": { icon: "🃏", tint: "#DCEFD8", glyph: "style", titleKey: "g5t", blurbKey: "g5b", area: "memory" },
  pattern: { icon: "🔁", tint: "#EAE8E4", glyph: "repeat", titleKey: "g6t", blurbKey: "g6b", area: "reasoning" },
  "find-object": { icon: "🔍", tint: "#EFEEEA", glyph: "search", titleKey: "g7t", blurbKey: "g7b", area: "attention" },
  "picture-recall": { icon: "🖼️", tint: "#DCEFD8", glyph: "image", titleKey: "g8t", blurbKey: "g8b", area: "recall" },
};

export type Rng = () => number;

export function shuffle<T>(items: readonly T[], rng: Rng = Math.random): T[] {
  const c = [...items];
  for (let i = c.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [c[i], c[j]] = [c[j]!, c[i]!];
  }
  return c;
}

export const pickOne = <T,>(items: readonly T[], rng: Rng = Math.random): T => items[Math.floor(rng() * items.length)]!;
