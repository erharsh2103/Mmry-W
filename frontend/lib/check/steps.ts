/*
 * The guided mind check: eight short questions across six areas, ported from
 * the original app. Scoring per area happens on the server from the answers.
 */
import type { CheckArea, MindCheckAnswer } from "@/types/api";
import type { Translator } from "@/lib/i18n/translate";
import { ODD_SETS, OBJECTS, WEEKDAYS, pickOne, shuffle, type Rng } from "@/lib/games/data";
import type { PersonCard } from "@/lib/games/engine";

export interface CheckTile {
  key: string;
  icon: string;
  label: string;
  sub?: string;
  ok: boolean;
}

export interface CheckStep {
  area: CheckArea;
  questionKey: string;
  kind: "choice" | "multi" | "show";
  seconds?: number;
  need?: string[];
  face?: { emoji: string };
  tiles: CheckTile[];
}

export function buildCheckSteps(people: PersonCard[], t: Translator, now: Date = new Date(), rng: Rng = Math.random): CheckStep[] {
  const objs = shuffle(OBJECTS, rng);
  const show = objs.slice(0, 3);
  const d1 = objs.slice(3, 6);
  const d2 = objs.slice(6, 9);
  const person = people.length ? pickOne(people, rng) : null;
  const others = person ? shuffle(people.filter((p) => p.id !== person.id), rng).slice(0, 2) : [];
  const hour = now.getHours();
  const partIdx = hour < 12 ? 0 : hour < 17 ? 1 : 2;
  const dow = now.getDay();
  const dayOpts = shuffle([WEEKDAYS[dow]!, WEEKDAYS[(dow + 2) % 7]!, WEEKDAYS[(dow + 5) % 7]!], rng);
  const odd = pickOne(ODD_SETS, rng);
  const oddObjs = shuffle([...odd.keep, odd.odd].map((n) => OBJECTS.find((o) => o.n === n)!), rng);
  const flower = OBJECTS.find((o) => o.n === "obj_flower")!;
  const attn = shuffle([flower, ...shuffle(OBJECTS.filter((o) => o.n !== "obj_flower"), rng).slice(0, 5)], rng);
  const shown = (o: { n: string }) => show.some((x) => x.n === o.n);

  const steps: CheckStep[] = [
    {
      area: "orientation", questionKey: "qDayPart", kind: "choice",
      tiles: ["optMorning", "optAfternoon", "optEvening"].map((k, i) => ({ key: k, icon: ["🌅", "☀️", "🌆"][i]!, label: t(k), ok: i === partIdx })),
    },
    {
      area: "orientation", questionKey: "qToday", kind: "choice",
      tiles: dayOpts.map((k) => ({ key: k, icon: "📅", label: t(k), ok: k === WEEKDAYS[dow] })),
    },
    { area: "memory", questionKey: "qLook", kind: "show", seconds: 6, tiles: show.map((o) => ({ key: o.n, icon: o.e, label: t(o.n), ok: true })) },
    {
      area: "memory", questionKey: "qWhich", kind: "multi", need: show.map((o) => o.n),
      tiles: shuffle([...show, ...d1], rng).map((o) => ({ key: o.n, icon: o.e, label: t(o.n), ok: shown(o) })),
    },
    {
      area: "attention", questionKey: "qTapFlower", kind: "choice",
      tiles: attn.map((o) => ({ key: o.n, icon: o.e, label: "", ok: o.n === "obj_flower" })),
    },
    ...(person
      ? [{
          area: "recognition" as const, questionKey: "qWho", kind: "choice" as const, face: { emoji: person.emoji },
          tiles: shuffle([person, ...others], rng).map((p) => ({ key: p.id, icon: "", label: p.name, sub: p.relation, ok: p.id === person.id })),
        }]
      : []),
    {
      area: "reasoning", questionKey: "qOdd", kind: "choice",
      tiles: oddObjs.map((o) => ({ key: o.n, icon: o.e, label: t(o.n), ok: o.n === odd.odd })),
    },
    {
      area: "recall", questionKey: "qRecall", kind: "multi", need: show.map((o) => o.n),
      tiles: shuffle([...show, ...d2], rng).map((o) => ({ key: o.n, icon: o.e, label: t(o.n), ok: shown(o) })),
    },
  ];
  return steps;
}

/* Multi-select score: hits minus wrong picks, over what was needed, never below zero. */
export function scoreMulti(step: CheckStep, picked: string[]): number {
  const need = step.need ?? [];
  const hits = picked.filter((p) => need.includes(p)).length;
  const miss = picked.length - hits;
  return Math.max(0, (hits - miss) / Math.max(1, need.length));
}

export function answerFor(step: CheckStep, score: number, ms: number): MindCheckAnswer | null {
  if (step.kind === "show") return null;
  return { area: step.area, question: step.questionKey, kind: step.kind, score, ms: Math.max(0, Math.round(ms)) };
}
