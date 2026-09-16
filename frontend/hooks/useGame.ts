"use client";

/*
 * Drives one activity: the pure engine (lib/games/engine.ts) plus the timers
 * and result hand-off the engine deliberately knows nothing about.
 *
 * The live state is kept in a ref and mirrored into React state for
 * rendering, so every tap is applied exactly once (state updaters can run
 * twice in development).
 */
import { useCallback, useEffect, useRef, useState } from "react";
import {
  isTimed,
  pick as enginePick,
  puzzleOf,
  resolve,
  start,
  submit,
  tick,
  type GameState,
  type Outcome,
  type PersonCard,
  type Step,
} from "@/lib/games/engine";
import { localDay } from "@/lib/routine/now";
import type { SessionInput } from "@/types/api";

interface Options {
  game: GameState["game"];
  level: number;
  people: PersonCard[];
  onFinish: (outcome: Outcome, session: SessionInput) => void;
}

export function useGame({ game, level, people, onFinish }: Options) {
  const [state, setState] = useState<GameState | null>(null);
  const live = useRef<GameState | null>(null);
  const finished = useRef(false);
  const timers = useRef<number[]>([]);
  const onFinishRef = useRef(onFinish);
  onFinishRef.current = onFinish;
  const peopleRef = useRef(people);
  peopleRef.current = people;

  const commit = useCallback((next: GameState) => {
    live.current = next;
    setState(next);
  }, []);

  const apply = useCallback(
    (step: Step) => {
      if (finished.current) return;
      commit(step.state);
      if (step.finished) {
        finished.current = true;
        const s = step.state;
        onFinishRef.current(step.finished, {
          clientRef: crypto.randomUUID(),
          gameType: s.game,
          level: s.level,
          accuracy: Math.round(step.finished.accuracy * 1000) / 1000,
          responseMs: step.finished.responseMs,
          attempts: step.finished.attempts,
          playedAt: new Date().toISOString(),
          localDay: localDay(),
          detail: { puzzle: puzzleOf(s), picks: s.picks },
        });
        return;
      }
      if (step.resolveAfterMs !== undefined) {
        const id = window.setTimeout(() => {
          if (live.current) apply(resolve(live.current, Date.now()));
        }, step.resolveAfterMs);
        timers.current.push(id);
      }
    },
    [commit],
  );

  useEffect(() => {
    finished.current = false;
    commit(start(game, level, peopleRef.current, Date.now()));
    const pending = timers.current;
    return () => pending.forEach((id) => window.clearTimeout(id));
  }, [game, level, commit]);

  // Count down the "look" phases.
  const timed = state ? isTimed(state) : false;
  useEffect(() => {
    if (!timed) return;
    const id = window.setInterval(() => {
      if (live.current && !finished.current) commit(tick(live.current, Date.now()));
    }, 1000);
    return () => window.clearInterval(id);
  }, [timed, commit]);

  const pick = useCallback(
    (key: string) => {
      if (live.current && !finished.current) apply(enginePick(live.current, key, Date.now(), peopleRef.current));
    },
    [apply],
  );

  const done = useCallback(() => {
    if (live.current && !finished.current) apply(submit(live.current, Date.now()));
  }, [apply]);

  return { state, pick, done };
}
