/*
 * Serves the output of the Python analytics pipeline to the frontend. The
 * pipeline writes patient_daily_metrics; this service only reads it.
 */
import type { MindCheck } from "../models/activity.js";
import { mindChecksRepository } from "../repositories/activity.repository.js";
import { metricsRepository, type DailyMetric } from "../repositories/metrics.repository.js";

export interface PatientAnalytics {
  days: number;
  daily: DailyMetric[];
  mindChecks: MindCheck[];
  pipeline: { lastRunAt: string | null; status: string | null };
}

export const analyticsService = {
  async forPatient(patientId: string, days: number): Promise<PatientAnalytics> {
    const [daily, mindChecks, run] = await Promise.all([
      metricsRepository.daily(patientId, days),
      mindChecksRepository.list(patientId, 10),
      metricsRepository.lastRun(),
    ]);
    return {
      days,
      daily,
      mindChecks,
      pipeline: { lastRunAt: run?.finishedAt ?? null, status: run?.status ?? null },
    };
  },
};
