import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { pick, puzzleOf, resolve, start, submit, tick, view, type GameState, type PersonCard } from "@/lib/games/engine";
import { GAME_TYPES } from "@/types/api";

/* Deterministic random numbers so every run plays the same puzzle. */
function seeded(seed = 42) {
  let s = seed;
  return () => ((s = (s * 16807) % 2147483647) - 1) / 2147483646;
}

const t = (key: string, vars?: Record<string, string | number>) => (vars ? `${key}:${JSON.stringify(vars)}` : key);
const PEOPLE: PersonCard[] = [
  { id: "a", emoji: "👨", name: "Bishnu", relation: "Son" },
  { id: "b", emoji: "👩", name: "Rupa", relation: "Daughter-in-law" },
  { id: "c", emoji: "🧓", name: "Mina", relation: "Neighbour" },
];

describe("game engine", () => {
  it("renders a view for every game at every level", () => {
    for (const game of GAME_TYPES) {
      for (let level = 1; level <= 5; level++) {
        const state = start(game, level, PEOPLE, 0, seeded(level));
        const v = view(state, t);
        assert.ok(v.prompt.length > 0, `${game} prompt`);
        assert.ok(v.tiles.length > 0, `${game} tiles`);
        assert.ok(Object.keys(puzzleOf(state)).length > 0, `${game} puzzle`);
      }
    }
  });

  it("scores a perfect sequence as 1 with a single attempt", () => {
    let s = start("sequence", 2, PEOPLE, 0, seeded()) as Extract<GameState, { game: "sequence" }>;
    let finished;
    for (const step of s.steps) {
      const r = pick(s, step.n, 1000);
      finished = r.finished;
      s = r.state as typeof s;
    }
    assert.deepEqual(finished, { accuracy: 1, responseMs: 1000, attempts: 1 });
    assert.equal(s.picks.length, s.steps.length);
    assert.ok(s.picks.every((p) => p.correct));
  });

  it("counts a wrong first step as a mistake", () => {
    const s = start("sequence", 1, PEOPLE, 0, seeded()) as Extract<GameState, { game: "sequence" }>;
    const wrong = s.steps[1]!.n;
    const r = pick(s, wrong, 10);
    assert.equal((r.state as typeof s).mistakes, 1);
    assert.equal(r.state.picks[0]!.correct, false);
  });

  it("object recall moves from look to pick when the timer runs out", () => {
    let s = start("object-recall", 1, PEOPLE, 0, seeded()) as Extract<GameState, { game: "object-recall" }>;
    assert.equal(s.phase, "show");
    for (let i = 0; i < 20 && s.phase === "show"; i++) s = tick(s, 5000) as typeof s;
    assert.equal(s.phase, "pick");
    for (const o of s.target) s = pick(s, o.n, 6000).state as typeof s;
    assert.equal(submit(s, 8000).finished?.accuracy, 1);
  });

  it("memory cards keep a matching pair and flip back a miss", () => {
    const s = start("memory-cards", 1, PEOPLE, 0, seeded()) as Extract<GameState, { game: "memory-cards" }>;
    const first = s.cards[0]!;
    const twin = s.cards.find((c) => c.n === first.n && c.cid !== first.cid)!;
    const other = s.cards.find((c) => c.n !== first.n)!;

    const miss = pick(pick(s, first.cid, 1).state, other.cid, 2);
    assert.equal(miss.resolveAfterMs, 750);
    const afterMiss = resolve(miss.state, 800).state as typeof s;
    assert.deepEqual(afterMiss.open, []);
    assert.equal(afterMiss.misses, 1);

    const hit = pick(pick(afterMiss, first.cid, 900).state, twin.cid, 1000);
    assert.equal(hit.resolveAfterMs, 350);
    const afterHit = resolve(hit.state, 1400).state as typeof s;
    assert.deepEqual(afterHit.matched, [first.n]);
  });

  it("attention penalises taps on leaves", () => {
    let s = start("attention", 1, PEOPLE, 0, seeded()) as Extract<GameState, { game: "attention" }>;
    s = pick(s, s.cells.find((c) => !c.m)!.id, 1).state as typeof s;
    let finished;
    for (const c of s.cells.filter((x) => x.m)) {
      const r = pick(s, c.id, 2000);
      s = r.state as typeof s;
      finished = r.finished;
    }
    assert.equal(finished?.attempts, 2);
    assert.equal(finished?.accuracy, (s.targets - 0.5) / s.targets);
  });

  it("ignores taps once a tile is used", () => {
    const s = start("attention", 1, PEOPLE, 0, seeded()) as Extract<GameState, { game: "attention" }>;
    const target = s.cells.find((c) => c.m)!;
    const once = pick(s, target.id, 1).state;
    assert.equal(pick(once, target.id, 2).state, once);
  });
});
