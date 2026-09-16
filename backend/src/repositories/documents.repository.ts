/*
 * MongoDB repositories for document-shaped data. Collection validators live in
 * database/mongodb/schemas and are applied by `npm run db:mongo:init`.
 */
import { mongo } from "../config/mongo.js";
import type { GameEventDocument, MindCheckAnswersDocument } from "../models/activity.js";

export interface AssistantTurnDocument {
  patientId: string;
  userId: string;
  lang: string;
  source: "speech" | "chip";
  textEnc: string;
  speechConfidence: number | null;
  intent: string;
  confidence: number;
  classifier: { name: string; version: string; fallback: boolean };
  createdAt: Date;
}

export interface InferenceLogDocument {
  task: "intent" | "difficulty";
  patientId: string;
  modelVersion: string | null;
  ok: boolean;
  fallback: boolean;
  latencyMs: number;
  error: string | null;
  createdAt: Date;
}

const isDuplicateKey = (err: unknown) => (err as { code?: number }).code === 11000;

export const gameEventsRepository = {
  /* Replays of an offline queue hit the unique sessionId index and are ignored. */
  async insert(doc: GameEventDocument): Promise<void> {
    try {
      await mongo().collection<GameEventDocument>("game_events").insertOne(doc);
    } catch (err) {
      if (!isDuplicateKey(err)) throw err;
    }
  },
};

export const mindCheckAnswersRepository = {
  async insert(doc: MindCheckAnswersDocument): Promise<void> {
    try {
      await mongo().collection<MindCheckAnswersDocument>("mind_check_answers").insertOne(doc);
    } catch (err) {
      if (!isDuplicateKey(err)) throw err;
    }
  },
};

export const assistantTurnsRepository = {
  async insert(doc: AssistantTurnDocument): Promise<void> {
    await mongo().collection<AssistantTurnDocument>("assistant_turns").insertOne(doc);
  },
};

export const inferenceLogsRepository = {
  async insert(doc: InferenceLogDocument): Promise<void> {
    await mongo().collection<InferenceLogDocument>("ai_inference_logs").insertOne(doc);
  },
};
