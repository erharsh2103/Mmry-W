/*
 * Client for the Python AI service (ai/). The backend is its only caller.
 *
 * Every call has a hard timeout and a rule-based fallback in the calling
 * service, so the product keeps working when the AI service is down; the
 * response says which path answered. Each call is recorded in MongoDB
 * ai_inference_logs (no patient text).
 */
import { z } from "zod";
import { env } from "../config/env.js";
import { logger } from "../config/logger.js";
import type { GameType, SessionSummary } from "../models/activity.js";
import { inferenceLogsRepository } from "../repositories/documents.repository.js";

const modelInfo = z.object({ name: z.string(), version: z.string() });

const intentResponse = z.object({
  intent: z.enum(["med", "today", "who", "game", "check", "people", "unknown"]),
  confidence: z.number().min(0).max(1),
  model: modelInfo,
});

const difficultyResponse = z.object({
  recommendations: z.array(
    z.object({ game_type: z.string(), level: z.number().int().min(1).max(5), p_success: z.number().min(0).max(1) }),
  ),
  model: modelInfo,
});

export type IntentResult = z.infer<typeof intentResponse>;
export type DifficultyResult = z.infer<typeof difficultyResponse>;

async function call<T>(path: string, body: unknown, schema: z.ZodType<T>): Promise<T> {
  const res = await fetch(new URL(path, env.AI_SERVICE_URL), {
    method: "POST",
    headers: { "content-type": "application/json", authorization: `Bearer ${env.AI_SERVICE_TOKEN}` },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(env.AI_SERVICE_TIMEOUT_MS),
  });
  if (!res.ok) throw new Error(`AI service ${path} returned ${res.status}`);
  return schema.parse(await res.json());
}

function record(task: "intent" | "difficulty", patientId: string, started: number, result: { modelVersion?: string; error?: string }) {
  const ok = !result.error;
  inferenceLogsRepository
    .insert({
      task,
      patientId,
      modelVersion: result.modelVersion ?? null,
      ok,
      fallback: !ok,
      latencyMs: Math.round(performance.now() - started),
      error: result.error ? result.error.slice(0, 300) : null,
      createdAt: new Date(),
    })
    .catch((err: Error) => logger.warn("could not record inference log", { error: err.message }));
}

export const aiClient = {
  async classifyIntent(patientId: string, text: string, lang: string): Promise<IntentResult | null> {
    const started = performance.now();
    try {
      const result = await call("/v1/intent", { text, lang }, intentResponse);
      record("intent", patientId, started, { modelVersion: result.model.version });
      return result;
    } catch (err) {
      const message = (err as Error).message;
      logger.warn("AI intent classification unavailable, using keyword rule", { error: message });
      record("intent", patientId, started, { error: message });
      return null;
    }
  },

  async recommendDifficulty(
    patientId: string,
    games: { gameType: GameType; sessions: SessionSummary[]; baselineAreaScore: number | null }[],
  ): Promise<DifficultyResult | null> {
    const started = performance.now();
    try {
      const result = await call(
        "/v1/difficulty",
        {
          games: games.map((g) => ({
            game_type: g.gameType,
            baseline_area_score: g.baselineAreaScore,
            sessions: g.sessions.slice(-8).map((s) => ({
              level: s.level,
              accuracy: s.accuracy,
              response_ms: s.responseMs,
              attempts: s.attempts,
            })),
          })),
        },
        difficultyResponse,
      );
      record("difficulty", patientId, started, { modelVersion: result.model.version });
      return result;
    } catch (err) {
      const message = (err as Error).message;
      logger.warn("AI difficulty model unavailable, using rule", { error: message });
      record("difficulty", patientId, started, { error: message });
      return null;
    }
  },

  async health(): Promise<boolean> {
    try {
      const res = await fetch(new URL("/health", env.AI_SERVICE_URL), { signal: AbortSignal.timeout(2000) });
      return res.ok;
    } catch {
      return false;
    }
  },
};
