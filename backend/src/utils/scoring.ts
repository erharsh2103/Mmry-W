/*
 * Engagement scoring and adaptive-difficulty rules, ported from the original
 * app. These are transparent heuristics describing engagement trends. They
 * are not a diagnosis and must never be presented as one.
 */
import type { GameType, MindCheck, SessionSummary } from "../models/activity.js";

export const MIN_SESSIONS = 3;
export const TREND_MIN = 4;

const mean = (xs: number[]) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : 0);
const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));

/* 0-100 over the last 12 sessions: accuracy, first-try recall, speed, consistency. */
export function engagementScore(sessions: SessionSummary[]): number | null {
  const r = sessions.slice(-12);
  if (!r.length) return null;
  const acc = mean(r.map((s) => s.accuracy));
  const recall = mean(r.map((s) => (s.attempts <= 1 ? 1 : 1 / s.attempts)));
  const speed = mean(r.map((s) => clamp(1 - (s.responseMs - 1500) / 9000, 0, 1)));
  const cons = 1 - Math.min(1, Math.sqrt(mean(r.map((s) => (s.accuracy - acc) ** 2))) * 1.6);
  return Math.round((0.4 * acc + 0.25 * recall + 0.2 * speed + 0.15 * cons) * 100);
}

/* i18n key describing a score band. */
export function levelKey(score: number | null): string {
  if (score === null || score === 0) return "lvNone";
  if (score <= 30) return "lv1";
  if (score <= 50) return "lv2";
  if (score <= 70) return "lv3";
  if (score <= 85) return "lv4";
  return "lv5";
}

/* Percentage change of the last 4 sessions against the 4 before; null under 4 each side's minimum. */
export function trendPct(sessions: SessionSummary[]): number | null {
  const recent = sessions.slice(-4);
  const older = sessions.slice(-8, -4);
  if (recent.length < 2 || older.length < 2) return null;
  const a = mean(recent.map((s) => s.accuracy));
  const b = mean(older.map((s) => s.accuracy));
  return Math.round(((a - b) / Math.max(0.01, b)) * 100);
}

export function metricFor(sessions: SessionSummary[], games: GameType[]): number | null {
  const sub = sessions.filter((s) => games.includes(s.gameType)).slice(-8);
  if (!sub.length) return null;
  return Math.round(mean(sub.map((s) => s.accuracy)) * 100);
}

export const GAME_AREA: Record<GameType, keyof Omit<MindCheck, "id" | "takenAt" | "overall" | "avgResponseMs" | "answerCount" | "inconsistent">> = {
  "object-recall": "memory",
  sequence: "reasoning",
  "name-face": "recognition",
  attention: "attention",
  "memory-cards": "memory",
  pattern: "reasoning",
  "find-object": "attention",
  "picture-recall": "recall",
};

export const GAME_TYPES = Object.keys(GAME_AREA) as GameType[];

/* Starting level for a game never played: from the latest mind check. */
export function baselineLevel(game: GameType, latest: MindCheck | null): number {
  if (!latest) return 1;
  const areaScore = latest[GAME_AREA[game]];
  const pct = typeof areaScore === "number" ? areaScore : latest.overall;
  return clamp(Math.round(pct / 22), 1, 5);
}

/* Rule: up after >= 80%, down after two sessions under 45%, otherwise hold. */
export function ruleNextLevel(game: GameType, sessions: SessionSummary[], latest: MindCheck | null): number {
  const played = sessions.filter((s) => s.gameType === game);
  const last = played.at(-1);
  if (!last) return baselineLevel(game, latest);
  const two = played.slice(-2);
  if (last.accuracy >= 0.8) return Math.min(5, last.level + 1);
  if (two.length === 2 && two.every((s) => s.accuracy < 0.45)) return Math.max(1, last.level - 1);
  return last.level;
}

/* Recognition fell 34+ points between consecutive checks. */
export function isInconsistent(previous: MindCheck | null, recognition: number | null): boolean {
  return !!(previous && typeof previous.recognition === "number" && typeof recognition === "number" &&
    previous.recognition - recognition >= 34);
}
