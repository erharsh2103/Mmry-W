export const GAME_TYPE_VALUES = [
  "object-recall",
  "sequence",
  "name-face",
  "attention",
  "memory-cards",
  "pattern",
  "find-object",
  "picture-recall",
] as const;

export type GameType = (typeof GAME_TYPE_VALUES)[number];

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

/* Document stored in MongoDB game_events. */
export interface GameEventDocument {
  patientId: string;
  sessionId: string;
  gameType: GameType;
  level: number;
  puzzle: Record<string, unknown>;
  picks: { atMs: number; value: string; correct: boolean }[];
  createdAt: Date;
}

/* Document stored in MongoDB mind_check_answers. */
export interface MindCheckAnswersDocument {
  patientId: string;
  mindCheckId: string;
  steps: { area: CheckArea; question: string; kind: "choice" | "multi"; score: number; ms: number }[];
  createdAt: Date;
}
