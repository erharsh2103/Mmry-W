import type { Translator } from "@/lib/i18n/translate";
import type { PersonCard } from "@/lib/games/engine";
import type { Person } from "@/types/api";

/* Template people carry i18n keys; people a caregiver added carry plain text. */
export function personText(p: Person, t: Translator) {
  return {
    name: p.nameKey ? t(p.nameKey) : p.name ?? "",
    relation: p.relationKey ? t(p.relationKey) : p.relation ?? "",
    note: p.noteKey ? t(p.noteKey) : p.note ?? "",
  };
}

export function toPersonCards(people: Person[], t: Translator): PersonCard[] {
  return people.map((p) => {
    const { name, relation } = personText(p, t);
    return { id: p.id, emoji: p.emoji, name, relation };
  });
}

export const isPlace = (p: Person) => p.isPlace || p.relationKey === "rel_place" || !!p.location;
