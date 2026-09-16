/*
 * The eight activities as pure state machines, ported from the original app.
 *
 *   start(game, level, people)  -> state
 *   tick(state, now)            -> state          (count-down of "look" phases)
 *   pick(state, key, now)       -> step           (one tap)
 *   resolve(state, now)         -> step           (delayed card flip-back)
 *   submit(state, now)          -> step           (the Done button)
 *   view(state, t)              -> what to draw   (translated with `t`)
 *
 * No timers, no DOM, no network: hooks/useGame.ts drives these, and the unit
 * tests call them directly.
 */
import type { GameType, SessionPick } from "@/types/api";
import type { Translator } from "@/lib/i18n/translate";
import { GAMES, OBJECTS, ROUTINE, pickOne, shuffle, type GameObject, type Rng } from "./data";

export interface PersonCard {
  id: string;
  emoji: string;
  name: string;
  relation: string;
}

interface Base {
  game: GameType;
  level: number;
  startedAt: number;
  /* when play began, for the pick log; startedAt resets after a look phase */
  openedAt: number;
  picks: SessionPick[];
}

export type GameState =
  | (Base & { game: "object-recall"; phase: "show" | "pick"; target: GameObject[]; options: GameObject[]; picked: string[]; seconds: number; total: number })
  | (Base & { game: "sequence"; steps: GameObject[]; pool: GameObject[]; order: string[]; mistakes: number })
  | (Base & { game: "name-face"; questions: PersonCard[]; i: number; right: number; attempts: number; options: PersonCard[] })
  | (Base & { game: "attention"; cells: { id: string; m: boolean }[]; targets: number; tapped: string[]; wrong: number })
  | (Base & { game: "memory-cards"; cards: { cid: string; n: string; e: string }[]; open: { cid: string; n: string; e: string }[]; matched: string[]; misses: number; pairs: number })
  | (Base & { game: "pattern"; seq: GameObject[]; answer: GameObject; options: GameObject[] })
  | (Base & { game: "find-object"; set: GameObject[]; target: GameObject; round: number; rounds: number; right: number; wrong: number })
  | (Base & { game: "picture-recall"; phase: "show" | "ask"; scene: GameObject[]; options: GameObject[]; absentName: string; seconds: number; total: number });

export interface Outcome {
  accuracy: number;
  responseMs: number;
  attempts: number;
}

export interface Step {
  state: GameState;
  finished?: Outcome;
  /* ask the driver to call resolve() after this many ms */
  resolveAfterMs?: number;
}

const clamp01 = (v: number) => Math.max(0, Math.min(1, v));
const log = (s: GameState, value: string, correct: boolean, now: number): SessionPick[] =>
  [...s.picks, { atMs: Math.max(0, Math.round(now - s.openedAt)), value: value.slice(0, 64), correct }].slice(-500);
const done = (s: GameState, accuracy: number, attempts: number, now: number): Step => ({
  state: s,
  finished: { accuracy: clamp01(accuracy), responseMs: Math.max(0, Math.round(now - s.startedAt)), attempts: Math.max(1, attempts) },
});

export function start(game: GameType, level: number, people: PersonCard[], now: number, rng: Rng = Math.random): GameState {
  const base = { level, startedAt: now, openedAt: now, picks: [] as SessionPick[] };
  switch (game) {
    case "object-recall": {
      const count = Math.min(3 + level, 7);
      const target = shuffle(OBJECTS, rng).slice(0, count);
      const names = target.map((o) => o.n);
      const decoys = shuffle(OBJECTS.filter((o) => !names.includes(o.n)), rng).slice(0, count);
      return { ...base, game, phase: "show", target, options: shuffle([...target, ...decoys], rng), picked: [], seconds: 4 + count, total: 4 + count };
    }
    case "sequence": {
      const steps = ROUTINE.slice(0, Math.min(3 + level, 7));
      return { ...base, game, steps, pool: shuffle(steps, rng), order: [], mistakes: 0 };
    }
    case "name-face": {
      const rounds = Math.min(2 + level, Math.max(2, people.length));
      const questions = shuffle(people, rng).slice(0, rounds);
      return { ...base, game, questions, i: 0, right: 0, attempts: 0, options: faceOptions(people, questions[0], rng) };
    }
    case "attention": {
      const size = 6 + level * 2;
      const targets = Math.max(2, Math.round(size / 3));
      const cells = shuffle(
        [
          ...Array.from({ length: targets }, (_, i) => ({ id: `t${i}`, m: true })),
          ...Array.from({ length: size - targets }, (_, i) => ({ id: `d${i}`, m: false })),
        ],
        rng,
      );
      return { ...base, game, cells, targets, tapped: [], wrong: 0 };
    }
    case "memory-cards": {
      const pairs = Math.min(2 + level, 6);
      const set = shuffle(OBJECTS, rng).slice(0, pairs);
      const cards = shuffle([...set, ...set].map((o, i) => ({ cid: `c${i}`, n: o.n, e: o.e })), rng);
      return { ...base, game, cards, open: [], matched: [], misses: 0, pairs };
    }
    case "pattern": {
      const set = shuffle(OBJECTS, rng).slice(0, Math.min(2 + level, 4));
      const seq = [...set, ...set];
      const answer = set[0]!;
      const decoys = shuffle(OBJECTS.filter((o) => o.n !== answer.n), rng).slice(0, 2);
      return { ...base, game, seq, answer, options: shuffle([answer, ...decoys], rng) };
    }
    case "find-object": {
      const set = shuffle(OBJECTS, rng).slice(0, Math.min(6 + level * 2, 12));
      return { ...base, game, set, target: pickOne(set, rng), round: 1, rounds: Math.min(2 + level, 5), right: 0, wrong: 0 };
    }
    case "picture-recall": {
      const count = Math.min(3 + level, 6);
      const scene = shuffle(OBJECTS, rng).slice(0, count);
      const absent = shuffle(OBJECTS.filter((o) => !scene.some((x) => x.n === o.n)), rng).slice(0, 2);
      const options = shuffle([...shuffle(scene, rng).slice(0, 2), absent[0]!], rng);
      return { ...base, game, phase: "show", scene, options, absentName: absent[0]!.n, seconds: 4 + count, total: 4 + count };
    }
  }
}

export function faceOptions(people: PersonCard[], current: PersonCard | undefined, rng: Rng = Math.random): PersonCard[] {
  if (!current) return [];
  const others = shuffle(people.filter((p) => p.id !== current.id), rng).slice(0, 2);
  return shuffle([current, ...others], rng);
}

/* One second passes during a "look" phase. */
export function tick(s: GameState, now: number): GameState {
  if ((s.game === "object-recall" && s.phase === "show") || (s.game === "picture-recall" && s.phase === "show")) {
    if (s.seconds <= 1) {
      return s.game === "object-recall" ? { ...s, phase: "pick", seconds: 0, startedAt: now } : { ...s, phase: "ask", seconds: 0, startedAt: now };
    }
    return { ...s, seconds: s.seconds - 1 };
  }
  return s;
}

export const isTimed = (s: GameState) =>
  (s.game === "object-recall" && s.phase === "show") || (s.game === "picture-recall" && s.phase === "show");

export function pick(s: GameState, key: string, now: number, people: PersonCard[] = [], rng: Rng = Math.random): Step {
  switch (s.game) {
    case "object-recall": {
      if (s.phase !== "pick") return { state: s };
      const on = s.picked.includes(key);
      return { state: { ...s, picked: on ? s.picked.filter((x) => x !== key) : [...s.picked, key] } };
    }
    case "sequence": {
      if (s.order.includes(key)) return { state: s };
      const expected = s.steps[s.order.length];
      const correct = expected?.n === key;
      const order = [...s.order, key];
      const next = { ...s, order, mistakes: s.mistakes + (correct ? 0 : 1), picks: log(s, key, correct, now) };
      if (order.length < s.steps.length) return { state: next };
      const right = order.filter((n, i) => s.steps[i]?.n === n).length;
      return done(next, right / s.steps.length, 1 + next.mistakes, now);
    }
    case "name-face": {
      const current = s.questions[s.i];
      if (!current) return { state: s };
      const correct = key === current.id;
      const right = s.right + (correct ? 1 : 0);
      const attempts = s.attempts + 1;
      const next = { ...s, right, attempts, picks: log(s, key, correct, now) };
      if (s.i + 1 >= s.questions.length) return done(next, right / s.questions.length, attempts, now);
      return { state: { ...next, i: s.i + 1, options: faceOptions(people.length ? people : s.questions, s.questions[s.i + 1], rng) } };
    }
    case "attention": {
      if (s.tapped.includes(key)) return { state: s };
      const cell = s.cells.find((c) => c.id === key);
      if (!cell) return { state: s };
      if (!cell.m) return { state: { ...s, wrong: s.wrong + 1, picks: log(s, key, false, now) } };
      const tapped = [...s.tapped, key];
      const next = { ...s, tapped, picks: log(s, key, true, now) };
      if (tapped.length < s.targets) return { state: next };
      return done(next, (s.targets - s.wrong * 0.5) / s.targets, 1 + s.wrong, now);
    }
    case "memory-cards": {
      const card = s.cards.find((c) => c.cid === key);
      if (!card || s.open.length >= 2 || s.matched.includes(card.n) || s.open.some((o) => o.cid === key)) return { state: s };
      const open = [...s.open, card];
      if (open.length < 2) return { state: { ...s, open } };
      const hit = open[0]!.n === open[1]!.n;
      return { state: { ...s, open, picks: log(s, card.n, hit, now) }, resolveAfterMs: hit ? 350 : 750 };
    }
    case "pattern": {
      const correct = key === s.answer.n;
      return done({ ...s, picks: log(s, key, correct, now) }, correct ? 1 : 0, 1, now);
    }
    case "find-object": {
      const correct = key === s.target.n;
      const picks = log(s, key, correct, now);
      if (!correct) return { state: { ...s, wrong: s.wrong + 1, picks } };
      const right = s.right + 1;
      if (s.round >= s.rounds) return done({ ...s, right, picks }, (right - s.wrong * 0.5) / s.rounds, 1 + s.wrong, now);
      const set = shuffle(OBJECTS, rng).slice(0, s.set.length);
      return { state: { ...s, set, target: pickOne(set, rng), round: s.round + 1, right, picks } };
    }
    case "picture-recall": {
      if (s.phase !== "ask") return { state: s };
      const correct = key === s.absentName;
      return done({ ...s, picks: log(s, key, correct, now) }, correct ? 1 : 0, 1, now);
    }
  }
}

/* Memory cards: flip a non-matching pair back, or keep a match. */
export function resolve(s: GameState, now: number): Step {
  if (s.game !== "memory-cards" || s.open.length < 2) return { state: s };
  const [a, b] = s.open as [(typeof s.open)[0], (typeof s.open)[0]];
  const hit = a.n === b.n;
  const matched = hit ? [...s.matched, a.n] : s.matched;
  const misses = hit ? s.misses : s.misses + 1;
  const next = { ...s, matched, misses, open: [] };
  if (matched.length === s.pairs) return done(next, s.pairs / (s.pairs + misses), 1 + misses, now);
  return { state: next };
}

/* Object recall's Done button. */
export function submit(s: GameState, now: number): Step {
  if (s.game !== "object-recall" || s.phase !== "pick") return { state: s };
  const hits = s.picked.filter((p) => s.target.some((t) => t.n === p)).length;
  const miss = s.picked.length - hits;
  const picks = [...s.picks, ...s.picked.map((p) => ({ atMs: Math.round(now - s.openedAt), value: p, correct: s.target.some((t) => t.n === p) }))];
  return done({ ...s, picks }, (hits - miss) / s.target.length, 1, now);
}

/* What was asked, stored with the result so a session can be explained later. */
export function puzzleOf(s: GameState): Record<string, unknown> {
  switch (s.game) {
    case "object-recall": return { target: s.target.map((o) => o.n), options: s.options.map((o) => o.n) };
    case "sequence": return { steps: s.steps.map((o) => o.n) };
    case "name-face": return { questions: s.questions.map((p) => p.id) };
    case "attention": return { size: s.cells.length, targets: s.targets };
    case "memory-cards": return { pairs: s.pairs, cards: s.cards.map((c) => c.n) };
    case "pattern": return { sequence: s.seq.map((o) => o.n), answer: s.answer.n };
    case "find-object": return { rounds: s.rounds, setSize: s.set.length };
    case "picture-recall": return { scene: s.scene.map((o) => o.n), absent: s.absentName };
  }
}

/* ------------------------------------------------------------------ view */

export type TileTone = "idle" | "right" | "picked";

export interface GameTile {
  key: string;
  icon: string;
  label: string;
  sub: string;
  tone: TileTone;
  disabled?: boolean;
}

export interface GameView {
  title: string;
  level: number;
  /* prompt and sub as shown; spoken is the same text in the speech language */
  prompt: string;
  sub: string;
  spoken: string;
  stageKey: string;
  cols: number;
  tiles: GameTile[];
  footer: string;
  timerPct?: number;
  answerRow?: { key: string; n: number; icon: string; label: string; ok: boolean | null }[];
  answerEmpty?: boolean;
  faceCard?: { emoji: string };
  showDone?: boolean;
}

export function view(s: GameState, t: Translator, spoken: Translator = t): GameView {
  const title = t(GAMES[s.game].titleKey);
  const both = (key: string, vars?: Record<string, string | number>, spokenVars = vars) => ({
    shown: t(key, vars),
    said: spoken(key, spokenVars),
  });
  const base = { title, level: s.level, tiles: [] as GameTile[], footer: "", cols: 3 };
  const make = (p: { shown: string; said: string }, sub: { shown: string; said: string }, stage: string, rest: Partial<GameView>): GameView => ({
    ...base,
    prompt: p.shown,
    sub: sub.shown,
    spoken: `${p.said}. ${sub.said}`,
    stageKey: `${s.game}|${stage}`,
    ...rest,
  });
  const objTile = (o: GameObject, tone: TileTone = "idle", withLabel = true, sub = ""): GameTile => ({
    key: o.n, icon: o.e, label: withLabel ? t(o.n) : "", sub, tone,
  });

  switch (s.game) {
    case "object-recall":
      if (s.phase === "show") {
        return make(both("pLook"), both("pLookSub", { n: s.target.length, s: s.seconds }), "show", {
          timerPct: Math.round((s.seconds / s.total) * 100),
          tiles: s.target.map((o) => objTile(o, "idle", true)),
          footer: t("pJustLook"),
        });
      }
      return make(both("pWhich"), both("pWhichSub"), "pick", {
        tiles: s.options.map((o) => {
          const on = s.picked.includes(o.n);
          return objTile(o, on ? "picked" : "idle", true, on ? t("pChosenTag") : "");
        }),
        showDone: true,
        footer: t("pChosen", { n: s.picked.length }),
      });
    case "sequence":
      return make(both("pOrder"), both("pOrderSub"), `step${s.order.length}`, {
        answerRow: s.order.map((n, i) => ({
          key: n, n: i + 1, icon: s.steps.find((x) => x.n === n)?.e ?? "", label: t(n), ok: s.steps[i]?.n === n,
        })),
        answerEmpty: s.order.length === 0,
        tiles: s.pool.map((o) => ({ ...objTile(o, s.order.includes(o.n) ? "right" : "idle"), disabled: s.order.includes(o.n) })),
        footer: t("pStep", { n: s.order.length + 1, m: s.steps.length }),
      });
    case "name-face": {
      const current = s.questions[s.i];
      return make(both("pWho"), both("pWhoSub"), `q${s.i}`, {
        faceCard: current ? { emoji: current.emoji } : undefined,
        tiles: s.options.map((p) => ({ key: p.id, icon: "", label: p.name, sub: p.relation, tone: "idle" as const })),
        footer: t("pQuestion", { n: s.i + 1, m: s.questions.length }),
      });
    }
    case "attention":
      return make(both("pMari"), both("pMariSub"), "grid", {
        cols: 4,
        tiles: s.cells.map((c) => ({
          key: c.id, icon: c.m ? "🌼" : "🍃", label: "", sub: "", tone: s.tapped.includes(c.id) ? ("right" as const) : ("idle" as const),
          disabled: s.tapped.includes(c.id),
        })),
        footer: t("pFound", { n: s.tapped.length, m: s.targets }),
      });
    case "memory-cards":
      return make(both("pCards"), both("pCardsSub"), "cards", {
        cols: 4,
        tiles: s.cards.map((c) => {
          const matched = s.matched.includes(c.n);
          const open = matched || s.open.some((o) => o.cid === c.cid);
          return { key: c.cid, icon: open ? c.e : "❓", label: open ? t(c.n) : "", sub: "", tone: matched ? ("right" as const) : open ? ("picked" as const) : ("idle" as const) };
        }),
        footer: t("pPairs", { n: s.matched.length, m: s.pairs }),
      });
    case "pattern":
      return make(both("pPattern"), both("pPatternSub"), "pattern", {
        answerRow: [
          ...s.seq.map((o, i) => ({ key: `${i}`, n: i + 1, icon: o.e, label: t(o.n), ok: null })),
          { key: "q", n: s.seq.length + 1, icon: "❓", label: "?", ok: null },
        ],
        tiles: s.options.map((o) => objTile(o)),
        footer: t("pPatternFoot"),
      });
    case "find-object": {
      const p = both("pFind", { name: t(s.target.n) }, { name: spoken(s.target.n) });
      return make({ shown: `${p.shown} ${s.target.e}`, said: p.said }, both("pFindSub"), `round${s.round}`, {
        cols: 4,
        tiles: s.set.map((o) => objTile(o, "idle", false)),
        footer: t("pRound", { n: s.round, m: s.rounds }),
      });
    }
    case "picture-recall":
      if (s.phase === "show") {
        return make(both("pScene"), both("pSceneSub", { s: s.seconds }), "show", {
          timerPct: Math.round((s.seconds / s.total) * 100),
          tiles: s.scene.map((o) => objTile(o)),
          footer: t("pJustLook"),
        });
      }
      return make(both("pSceneAsk"), both("pSceneAskSub"), "ask", { tiles: s.options.map((o) => objTile(o)), footer: t("pSceneFoot") });
  }
}

/* The celebration shown after a game. */
export function resultOf(accuracy: number, level: number, t: Translator) {
  return {
    emoji: accuracy >= 0.8 ? "🌸" : accuracy >= 0.45 ? "👏" : "💛",
    headline: t(accuracy >= 0.8 ? "rWow" : accuracy >= 0.45 ? "rGood" : "rTry"),
    detail: t("rDetail", { p: Math.round(accuracy * 100), l: level }),
  };
}
