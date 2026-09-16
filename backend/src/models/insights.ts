import type { GameType } from "./activity.js";

/*
 * Insights and alerts are returned as stable ids plus raw numbers. The
 * frontend turns them into sentences in the patient's language, so the API
 * never formats text or distances.
 */
export type InsightId = "thin" | "provisional" | "visual_strong" | "focus_strong" | "routine_low" | "drop" | "up" | "slow" | "steady";

export interface Insight {
  id: InsightId;
  data?: Record<string, number>;
}

export type AlertId =
  | "geo_outside"
  | "geo_stale"
  | "perf_drop"
  | "evening_med"
  | "idle"
  | "no_baseline"
  | "inconsistent"
  | "none";

export type AlertTone = "warn" | "info" | "ok";

export interface Alert {
  id: AlertId;
  tone: AlertTone;
  data?: Record<string, number | string>;
}

export interface LevelRecommendation {
  level: number;
  source: "model" | "rule";
}

export interface InsightsResponse {
  score: number | null;
  levelKey: string;
  trendPct: number | null;
  provisional: boolean;
  activityCount: number;
  needs: { activities: number; mindCheck: boolean };
  metrics: { visual: number | null; focus: number | null; routine: number };
  bars: number[];
  insights: Insight[];
  alerts: Alert[];
  levels: Record<GameType, LevelRecommendation>;
  routine: { done: number; total: number };
  generatedAt: string;
}
