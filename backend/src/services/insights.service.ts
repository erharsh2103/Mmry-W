/*
 * Caregiver insights: engagement score, trend, alerts and the level each game
 * should start at.
 *
 * Scores and alerts are transparent rules (utils/scoring.ts). Difficulty comes
 * from the TensorFlow model in the AI service when it answers, clamped to one
 * step from the rule so a model error can never jump a patient several levels;
 * otherwise the rule stands. Engagement trends only - not a diagnosis.
 */
import type { GameType, SessionSummary } from "../models/activity.js";
import type { Alert, Insight, InsightsResponse, LevelRecommendation } from "../models/insights.js";
import { mindChecksRepository, sessionsRepository } from "../repositories/activity.repository.js";
import { routineService } from "./routine.service.js";
import { safetyService } from "./safety.service.js";
import { aiClient } from "./aiClient.service.js";
import {
  GAME_AREA,
  GAME_TYPES,
  MIN_SESSIONS,
  engagementScore,
  levelKey,
  metricFor,
  ruleNextLevel,
  trendPct,
} from "../utils/scoring.js";

const HISTORY = 200;

async function levelsFor(
  patientId: string,
  sessions: SessionSummary[],
  latest: Awaited<ReturnType<typeof mindChecksRepository.latest>>,
): Promise<Record<GameType, LevelRecommendation>> {
  const rule = Object.fromEntries(GAME_TYPES.map((g) => [g, ruleNextLevel(g, sessions, latest)])) as Record<GameType, number>;

  const ai = await aiClient.recommendDifficulty(
    patientId,
    GAME_TYPES.map((g) => ({
      gameType: g,
      sessions: sessions.filter((s) => s.gameType === g),
      baselineAreaScore: latest ? (latest[GAME_AREA[g]] ?? latest.overall) : null,
    })),
  );

  const out = {} as Record<GameType, LevelRecommendation>;
  for (const g of GAME_TYPES) {
    const rec = ai?.recommendations.find((r) => r.game_type === g);
    if (!rec) {
      out[g] = { level: rule[g], source: "rule" };
      continue;
    }
    const played = sessions.filter((s) => s.gameType === g);
    const last = played.at(-1);
    const two = played.slice(-2);
    let clamped = Math.max(1, Math.min(5, Math.max(rule[g] - 1, Math.min(rule[g] + 1, rec.level))));
    // The model may tune difficulty near the transparent rule, but it must not
    // cancel an earned level-up or a needed level-down after the latest attempts.
    if (last?.accuracy !== undefined && last.accuracy >= 0.8) clamped = Math.max(clamped, rule[g]);
    if (two.length === 2 && two.every((s) => s.accuracy < 0.45)) clamped = Math.min(clamped, rule[g]);
    out[g] = { level: clamped, source: "model" };
  }
  return out;
}

export const insightsService = {
  async forPatient(patientId: string, localDay: string): Promise<InsightsResponse> {
    const [sessions, activityCount, latest, tasks, safety] = await Promise.all([
      sessionsRepository.recent(patientId, HISTORY),
      sessionsRepository.count(patientId),
      mindChecksRepository.latest(patientId),
      routineService.listTasks(patientId, localDay),
      safetyService.state(patientId),
    ]);

    const score = engagementScore(sessions);
    const trend = trendPct(sessions);
    const visual = metricFor(sessions, ["object-recall", "name-face"]);
    const focus = metricFor(sessions, ["sequence", "attention"]);
    const done = tasks.filter((t) => t.done).length;
    const routine = tasks.length ? Math.round((done / tasks.length) * 100) : 0;
    const provisional = !(activityCount >= MIN_SESSIONS && latest !== null);
    const needs = { activities: Math.max(0, MIN_SESSIONS - activityCount), mindCheck: latest === null };

    const insights: Insight[] = [];
    const routineLow = done < tasks.length / 2;
    const strength = (): Insight[] =>
      visual && focus && Math.abs(visual - focus) >= 10 ? [{ id: visual > focus ? "visual_strong" : "focus_strong" }] : [];

    if (!activityCount) {
      insights.push({ id: "thin" });
    } else if (provisional) {
      insights.push({ id: "provisional", data: { activities: activityCount } }, ...strength());
      if (routineLow) insights.push({ id: "routine_low" });
    } else {
      insights.push(...strength());
      if (trend !== null && trend <= -12) insights.push({ id: "drop", data: { pct: Math.abs(trend) } });
      else if (trend !== null && trend >= 12) insights.push({ id: "up", data: { pct: trend } });
      if (sessions.slice(-5).filter((s) => s.responseMs > 7000).length >= 3) insights.push({ id: "slow" });
      if (routineLow) insights.push({ id: "routine_low" });
      if (!insights.length) insights.push({ id: "steady" });
    }

    const alerts: Alert[] = [];
    if (safety.outside && safety.distanceM !== null) {
      alerts.push({
        id: "geo_outside",
        tone: "warn",
        data: { distanceM: safety.distanceM, radiusM: safety.zone.radiusM, fixAt: safety.lastFix?.at ?? "" },
      });
    }
    if (safety.zone.trackingEnabled && safety.lastFix && Date.now() - Date.parse(safety.lastFix.at) >= 3_600_000) {
      alerts.push({ id: "geo_stale", tone: "info" });
    }
    if (trend !== null && trend <= -12) alerts.push({ id: "perf_drop", tone: "warn", data: { pct: Math.abs(trend) } });
    const eveningMed = tasks.find((t) => t.labelKey === "task_med_pm");
    if (eveningMed && !eveningMed.done) alerts.push({ id: "evening_med", tone: "info" });
    const lastPlay = sessions.at(-1);
    if (lastPlay) {
      const idleDays = Math.floor((Date.now() - Date.parse(lastPlay.playedAt)) / 86_400_000);
      if (idleDays >= 3) alerts.push({ id: "idle", tone: "warn", data: { days: idleDays } });
    }
    if (!latest) alerts.push({ id: "no_baseline", tone: "info" });
    if (latest?.inconsistent) alerts.push({ id: "inconsistent", tone: "warn" });
    if (!alerts.length) alerts.push({ id: "none", tone: "ok" });

    return {
      score,
      levelKey: levelKey(score),
      trendPct: trend,
      provisional,
      activityCount,
      needs,
      metrics: { visual, focus, routine },
      bars: sessions.slice(-8).map((s) => s.accuracy),
      insights,
      alerts,
      levels: await levelsFor(patientId, sessions, latest),
      routine: { done, total: tasks.length },
      generatedAt: new Date().toISOString(),
    };
  },
};
