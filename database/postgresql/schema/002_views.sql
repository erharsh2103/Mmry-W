-- 002_views.sql  (repeatable)
-- Read models for the analytics pipeline. They expose no encrypted columns,
-- so the analytics role never needs the data encryption key.

CREATE OR REPLACE VIEW v_daily_sessions AS
SELECT
  gs.patient_id,
  (gs.played_at AT TIME ZONE 'UTC')::date AS day,
  count(*)                                AS sessions,
  avg(gs.accuracy)                        AS mean_accuracy,
  avg(gs.response_ms)                     AS mean_response_ms,
  avg(CASE WHEN gs.attempts <= 1 THEN 1.0 ELSE 1.0 / gs.attempts END) AS mean_first_try
FROM game_sessions gs
GROUP BY gs.patient_id, (gs.played_at AT TIME ZONE 'UTC')::date;

CREATE OR REPLACE VIEW v_daily_routine AS
SELECT
  t.patient_id,
  tc.completed_on AS day,
  count(*)        AS tasks_done
FROM task_completions tc
JOIN tasks t ON t.id = tc.task_id
GROUP BY t.patient_id, tc.completed_on;

CREATE OR REPLACE VIEW v_daily_safety AS
SELECT
  le.patient_id,
  (le.occurred_at AT TIME ZONE 'UTC')::date     AS day,
  count(*) FILTER (WHERE le.kind = 'out')       AS geofence_exits,
  count(*) FILTER (WHERE le.kind = 'sos')       AS sos_count
FROM location_events le
GROUP BY le.patient_id, (le.occurred_at AT TIME ZONE 'UTC')::date;

CREATE OR REPLACE VIEW v_patient_overview AS
SELECT
  p.id                AS patient_id,
  p.language,
  p.age,
  p.created_at,
  (SELECT count(*) FROM tasks t WHERE t.patient_id = p.id AND t.is_active) AS active_tasks,
  (SELECT max(gs.played_at) FROM game_sessions gs WHERE gs.patient_id = p.id) AS last_session_at,
  (SELECT max(mc.taken_at) FROM mind_checks mc WHERE mc.patient_id = p.id)    AS last_check_at
FROM patients p;
