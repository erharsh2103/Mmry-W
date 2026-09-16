/*
 * Response shapes of the Mmry REST API (backend/src/models). The frontend
 * consumes these and never talks to a database or model directly.
 */

export type UserRole = "caregiver" | "admin";

export interface User {
  id: string;
  email: string;
  fullName: string;
  role: UserRole;
  createdAt: string;
}

export interface SessionResponse {
  user: User;
  accessToken: string;
  expiresIn: number;
}

export type VoicePref = "auto" | "female" | "male";

export interface MemoryVault {
  home: string;
  doctor: string;
  emergency: string;
  medicines: string;
}

export interface Patient {
  id: string;
  displayName: string;
  age: number | null;
  language: string;
  caregiverName: string | null;
  caregiverPhone: string | null;
  vault: MemoryVault;
  hasPin: boolean;
  voiceOn: boolean;
  voicePref: VoicePref;
  voiceRate: number;
  fontScale: number;
  onboardingDone: boolean;
  access: "owner" | "member";
  createdAt: string;
  updatedAt: string;
}

export type PatientUpdate = Partial<{
  displayName: string;
  age: number | null;
  language: string;
  caregiverName: string | null;
  caregiverPhone: string | null;
  vault: Partial<MemoryVault>;
  voiceOn: boolean;
  voicePref: VoicePref;
  voiceRate: 0.75 | 0.9 | 1.1;
  fontScale: number;
  onboardingDone: boolean;
}>;

export interface Task {
  id: string;
  labelKey: string | null;
  label: string | null;
  timeKey: string | null;
  hour: number;
  icon: string;
  sortOrder: number;
  done: boolean;
}

export interface LatLon {
  lat: number;
  lon: number;
}

export interface Person {
  id: string;
  nameKey: string | null;
  name: string | null;
  relationKey: string | null;
  relation: string | null;
  noteKey: string | null;
  note: string | null;
  emoji: string;
  isPlace: boolean;
  location: LatLon | null;
  locatedAt: string | null;
}

export const GAME_TYPES = [
  "object-recall",
  "sequence",
  "name-face",
  "attention",
  "memory-cards",
  "pattern",
  "find-object",
  "picture-recall",
] as const;
export type GameType = (typeof GAME_TYPES)[number];

export const CHECK_AREAS = ["memory", "attention", "recognition", "recall", "reasoning", "orientation"] as const;
export type CheckArea = (typeof CHECK_AREAS)[number];

export interface SessionSummary {
  id: string;
  clientRef: string;
  gameType: GameType;
  level: number;
  accuracy: number;
  responseMs: number;
  attempts: number;
  playedAt: string;
}

export interface SessionPick {
  atMs: number;
  value: string;
  correct: boolean;
}

export interface SessionInput {
  clientRef: string;
  gameType: GameType;
  level: number;
  accuracy: number;
  responseMs: number;
  attempts: number;
  playedAt: string;
  localDay: string;
  detail?: { puzzle: Record<string, unknown>; picks: SessionPick[] };
}

export interface MindCheck {
  id: string;
  takenAt: string;
  memory: number | null;
  attention: number | null;
  recognition: number | null;
  recall: number | null;
  reasoning: number | null;
  orientation: number | null;
  overall: number;
  avgResponseMs: number;
  answerCount: number;
  inconsistent: boolean;
}

export interface MindCheckAnswer {
  area: CheckArea;
  question: string;
  kind: "choice" | "multi";
  score: number;
  ms: number;
}

export type LocationEventKind = "out" | "in" | "sos";

export interface SafetyState {
  zone: { home: LatLon | null; radiusM: number; armed: boolean; trackingEnabled: boolean };
  lastFix: (LatLon & { accuracyM: number; at: string }) | null;
  distanceM: number | null;
  bearingDeg: number | null;
  outside: boolean;
  events: { id: string; kind: LocationEventKind; at: string; distanceM: number | null }[];
}

export type InsightId = "thin" | "provisional" | "visual_strong" | "focus_strong" | "routine_low" | "drop" | "up" | "slow" | "steady";
export type AlertId = "geo_outside" | "geo_stale" | "perf_drop" | "evening_med" | "idle" | "no_baseline" | "inconsistent" | "none";

export interface Insights {
  score: number | null;
  levelKey: string;
  trendPct: number | null;
  provisional: boolean;
  activityCount: number;
  needs: { activities: number; mindCheck: boolean };
  metrics: { visual: number | null; focus: number | null; routine: number };
  bars: number[];
  insights: { id: InsightId; data?: Record<string, number> }[];
  alerts: { id: AlertId; tone: "warn" | "info" | "ok"; data?: Record<string, number | string> }[];
  levels: Record<GameType, { level: number; source: "model" | "rule" }>;
  routine: { done: number; total: number };
  generatedAt: string;
}

export interface DailyMetric {
  day: string;
  sessions: number;
  meanAccuracy: number | null;
  meanResponseMs: number | null;
  tasksDone: number;
  tasksTotal: number;
  engagementScore: number | null;
  geofenceExits: number;
  sosCount: number;
  computedAt: string;
}

export interface PatientAnalytics {
  days: number;
  daily: DailyMetric[];
  mindChecks: MindCheck[];
  pipeline: { lastRunAt: string | null; status: string | null };
}

export type IntentId = "med" | "today" | "who" | "game" | "check" | "people" | "unknown";

export interface IntentOutcome {
  intent: IntentId;
  confidence: number;
  source: "model" | "rule";
  modelVersion: string | null;
}

export interface ApiErrorBody {
  error: { code: string; message: string; details?: { path: string; message: string }[]; requestId?: string };
}
