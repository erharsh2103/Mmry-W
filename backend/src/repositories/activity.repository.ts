import { pool, type Queryable } from "../config/postgres.js";
import type { GameType, MindCheck, SessionSummary } from "../models/activity.js";

interface SessionRow {
  id: string;
  client_ref: string;
  game_type: GameType;
  level: number;
  accuracy: number;
  response_ms: number;
  attempts: number;
  played_at: Date;
}

const toSession = (r: SessionRow): SessionSummary => ({
  id: r.id,
  clientRef: r.client_ref,
  gameType: r.game_type,
  level: r.level,
  accuracy: r.accuracy,
  responseMs: r.response_ms,
  attempts: r.attempts,
  playedAt: r.played_at.toISOString(),
});

export const sessionsRepository = {
  /*
   * Idempotent on (patient_id, client_ref): replaying an offline queue returns
   * the row created the first time, with `created: false`.
   */
  async insert(
    db: Queryable,
    patientId: string,
    s: Omit<SessionSummary, "id">,
  ): Promise<{ session: SessionSummary; created: boolean }> {
    const inserted = await db.query<SessionRow>(
      `INSERT INTO game_sessions (patient_id, client_ref, game_type, level, accuracy, response_ms, attempts, played_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
       ON CONFLICT (patient_id, client_ref) DO NOTHING
       RETURNING id, client_ref, game_type, level, accuracy, response_ms, attempts, played_at`,
      [patientId, s.clientRef, s.gameType, s.level, s.accuracy, s.responseMs, s.attempts, s.playedAt],
    );
    if (inserted.rows[0]) return { session: toSession(inserted.rows[0]), created: true };
    const existing = await db.query<SessionRow>(
      `SELECT id, client_ref, game_type, level, accuracy, response_ms, attempts, played_at
         FROM game_sessions WHERE patient_id = $1 AND client_ref = $2`,
      [patientId, s.clientRef],
    );
    return { session: toSession(existing.rows[0]!), created: false };
  },

  /* Most recent `limit` sessions, returned oldest first (the order the scoring expects). */
  async recent(patientId: string, limit: number): Promise<SessionSummary[]> {
    const { rows } = await pool.query<SessionRow>(
      `SELECT * FROM (
         SELECT id, client_ref, game_type, level, accuracy, response_ms, attempts, played_at
           FROM game_sessions WHERE patient_id = $1 ORDER BY played_at DESC LIMIT $2
       ) s ORDER BY played_at ASC`,
      [patientId, limit],
    );
    return rows.map(toSession);
  },

  async count(patientId: string): Promise<number> {
    const { rows } = await pool.query<{ n: number }>("SELECT count(*)::int AS n FROM game_sessions WHERE patient_id = $1", [patientId]);
    return rows[0]?.n ?? 0;
  },
};

interface CheckRow {
  id: string;
  taken_at: Date;
  memory: number | null;
  attention: number | null;
  recognition: number | null;
  recall: number | null;
  reasoning: number | null;
  orientation: number | null;
  overall: number;
  avg_response_ms: number;
  answer_count: number;
  inconsistent: boolean;
}

const toCheck = (r: CheckRow): MindCheck => ({
  id: r.id,
  takenAt: r.taken_at.toISOString(),
  memory: r.memory,
  attention: r.attention,
  recognition: r.recognition,
  recall: r.recall,
  reasoning: r.reasoning,
  orientation: r.orientation,
  overall: r.overall,
  avgResponseMs: r.avg_response_ms,
  answerCount: r.answer_count,
  inconsistent: r.inconsistent,
});

const CHECK_COLUMNS =
  "id, taken_at, memory, attention, recognition, recall, reasoning, orientation, overall, avg_response_ms, answer_count, inconsistent";

export const mindChecksRepository = {
  async latest(patientId: string, db: Queryable = pool): Promise<MindCheck | null> {
    const { rows } = await db.query<CheckRow>(
      `SELECT ${CHECK_COLUMNS} FROM mind_checks WHERE patient_id = $1 ORDER BY taken_at DESC LIMIT 1`,
      [patientId],
    );
    return rows[0] ? toCheck(rows[0]) : null;
  },

  async list(patientId: string, limit: number): Promise<MindCheck[]> {
    const { rows } = await pool.query<CheckRow>(
      `SELECT ${CHECK_COLUMNS} FROM mind_checks WHERE patient_id = $1 ORDER BY taken_at DESC LIMIT $2`,
      [patientId, limit],
    );
    return rows.map(toCheck);
  },

  async insert(
    db: Queryable,
    patientId: string,
    clientRef: string,
    c: Omit<MindCheck, "id">,
  ): Promise<{ check: MindCheck; created: boolean }> {
    const inserted = await db.query<CheckRow>(
      `INSERT INTO mind_checks (patient_id, client_ref, taken_at, memory, attention, recognition, recall,
                                reasoning, orientation, overall, avg_response_ms, answer_count, inconsistent)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
       ON CONFLICT (patient_id, client_ref) DO NOTHING
       RETURNING ${CHECK_COLUMNS}`,
      [patientId, clientRef, c.takenAt, c.memory, c.attention, c.recognition, c.recall, c.reasoning, c.orientation,
        c.overall, c.avgResponseMs, c.answerCount, c.inconsistent],
    );
    if (inserted.rows[0]) return { check: toCheck(inserted.rows[0]), created: true };
    const { rows } = await db.query<CheckRow>(
      `SELECT ${CHECK_COLUMNS} FROM mind_checks WHERE patient_id = $1 AND client_ref = $2`,
      [patientId, clientRef],
    );
    return { check: toCheck(rows[0]!), created: false };
  },
};
