import { logger } from "../config/logger.js";
import { withTransaction } from "../config/postgres.js";
import { CHECK_AREAS, type CheckArea, type GameType, type MindCheck, type SessionSummary } from "../models/activity.js";
import { mindChecksRepository, sessionsRepository } from "../repositories/activity.repository.js";
import { gameEventsRepository, mindCheckAnswersRepository } from "../repositories/documents.repository.js";
import { tasksRepository } from "../repositories/routine.repository.js";
import { isInconsistent } from "../utils/scoring.js";

export interface SessionInput {
  clientRef: string;
  gameType: GameType;
  level: number;
  accuracy: number;
  responseMs: number;
  attempts: number;
  playedAt: string;
  /* patient's local calendar day, so the right day's activity task is ticked */
  localDay: string;
  detail?: {
    puzzle: Record<string, unknown>;
    picks: { atMs: number; value: string; correct: boolean }[];
  };
}

export interface MindCheckInput {
  clientRef: string;
  takenAt: string;
  answers: { area: CheckArea; question: string; kind: "choice" | "multi"; score: number; ms: number }[];
}

export const activityService = {
  /*
   * Accepts one session or a replayed offline batch. The summary and the
   * activity-task tick commit together in PostgreSQL; the step-by-step detail
   * goes to MongoDB afterwards and is best-effort, because losing it never
   * loses the result itself.
   */
  async recordSessions(patientId: string, userId: string, inputs: SessionInput[]): Promise<{ sessions: SessionSummary[]; created: number }> {
    const results: { session: SessionSummary; created: boolean; input: SessionInput }[] = [];
    await withTransaction(async (db) => {
      for (const input of inputs) {
        const { session, created } = await sessionsRepository.insert(db, patientId, {
          clientRef: input.clientRef,
          gameType: input.gameType,
          level: input.level,
          accuracy: Math.round(Math.max(0, Math.min(1, input.accuracy)) * 1000) / 1000,
          responseMs: input.responseMs,
          attempts: input.attempts,
          playedAt: input.playedAt,
        });
        if (created) await tasksRepository.completeByLabelKey(db, patientId, "task_activity", input.localDay, userId);
        results.push({ session, created, input });
      }
    });

    for (const { session, created, input } of results) {
      if (!created || !input.detail) continue;
      await gameEventsRepository
        .insert({
          patientId,
          sessionId: session.id,
          gameType: session.gameType,
          level: session.level,
          puzzle: input.detail.puzzle,
          picks: input.detail.picks,
          createdAt: new Date(),
        })
        .catch((err: Error) => logger.warn("game detail not stored", { sessionId: session.id, error: err.message }));
    }
    return { sessions: results.map((r) => r.session), created: results.filter((r) => r.created).length };
  },

  recentSessions(patientId: string, limit: number): Promise<SessionSummary[]> {
    return sessionsRepository.recent(patientId, limit);
  },

  /* Area scores are computed here from the raw answers, so every client scores a check the same way. */
  async recordMindCheck(patientId: string, input: MindCheckInput): Promise<{ check: MindCheck; created: boolean }> {
    const byArea: Partial<Record<CheckArea, number>> = {};
    for (const area of CHECK_AREAS) {
      const rows = input.answers.filter((a) => a.area === area);
      if (rows.length) byArea[area] = Math.round((rows.reduce((s, a) => s + a.score, 0) / rows.length) * 100);
    }
    const values = Object.values(byArea);
    const overall = Math.round(values.reduce((a, b) => a + b, 0) / Math.max(1, values.length));
    const avgResponseMs = Math.round(input.answers.reduce((s, a) => s + a.ms, 0) / Math.max(1, input.answers.length));

    const result = await withTransaction(async (db) => {
      const previous = await mindChecksRepository.latest(patientId, db);
      return mindChecksRepository.insert(db, patientId, input.clientRef, {
        takenAt: input.takenAt,
        memory: byArea.memory ?? null,
        attention: byArea.attention ?? null,
        recognition: byArea.recognition ?? null,
        recall: byArea.recall ?? null,
        reasoning: byArea.reasoning ?? null,
        orientation: byArea.orientation ?? null,
        overall,
        avgResponseMs,
        answerCount: input.answers.length,
        inconsistent: isInconsistent(previous, byArea.recognition ?? null),
      });
    });

    if (result.created) {
      await mindCheckAnswersRepository
        .insert({ patientId, mindCheckId: result.check.id, steps: input.answers, createdAt: new Date() })
        .catch((err: Error) => logger.warn("mind check answers not stored", { mindCheckId: result.check.id, error: err.message }));
    }
    return result;
  },

  listMindChecks(patientId: string, limit: number): Promise<MindCheck[]> {
    return mindChecksRepository.list(patientId, limit);
  },
};
