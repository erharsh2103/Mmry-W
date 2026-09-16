import { pool } from "../config/postgres.js";

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

interface Row {
  day: string;
  sessions: number;
  mean_accuracy: number | null;
  mean_response_ms: number | null;
  tasks_done: number;
  tasks_total: number;
  engagement_score: number | null;
  geofence_exits: number;
  sos_count: number;
  computed_at: Date;
}

/* Read-only: rows are produced by the Python analytics pipeline. */
export const metricsRepository = {
  async daily(patientId: string, days: number): Promise<DailyMetric[]> {
    const { rows } = await pool.query<Row>(
      `SELECT day, sessions, mean_accuracy, mean_response_ms, tasks_done, tasks_total, engagement_score,
              geofence_exits, sos_count, computed_at
         FROM patient_daily_metrics
        WHERE patient_id = $1 AND day >= current_date - ($2::int - 1)
        ORDER BY day`,
      [patientId, days],
    );
    return rows.map((r) => ({
      day: r.day,
      sessions: r.sessions,
      meanAccuracy: r.mean_accuracy,
      meanResponseMs: r.mean_response_ms,
      tasksDone: r.tasks_done,
      tasksTotal: r.tasks_total,
      engagementScore: r.engagement_score,
      geofenceExits: r.geofence_exits,
      sosCount: r.sos_count,
      computedAt: r.computed_at.toISOString(),
    }));
  },

  async lastRun(): Promise<{ finishedAt: string | null; status: string } | null> {
    const { rows } = await pool.query<{ finished_at: Date | null; status: string }>(
      "SELECT finished_at, status FROM analytics_runs ORDER BY started_at DESC LIMIT 1",
    );
    const r = rows[0];
    return r ? { finishedAt: r.finished_at ? r.finished_at.toISOString() : null, status: r.status } : null;
  },
};
