-- 006_analytics.sql
-- Written only by the Python analytics pipeline (analytics/data_processing)
-- and read by the API. One row per patient per day.

CREATE TABLE patient_daily_metrics (
  patient_id         uuid         NOT NULL REFERENCES patients (id) ON DELETE CASCADE,
  day                date         NOT NULL,
  sessions           integer      NOT NULL DEFAULT 0 CHECK (sessions >= 0),
  mean_accuracy      numeric(4,3) CHECK (mean_accuracy BETWEEN 0 AND 1),
  mean_response_ms   integer      CHECK (mean_response_ms >= 0),
  tasks_done         integer      NOT NULL DEFAULT 0 CHECK (tasks_done >= 0),
  tasks_total        integer      NOT NULL DEFAULT 0 CHECK (tasks_total >= 0),
  engagement_score   smallint     CHECK (engagement_score BETWEEN 0 AND 100),
  geofence_exits     integer      NOT NULL DEFAULT 0 CHECK (geofence_exits >= 0),
  sos_count          integer      NOT NULL DEFAULT 0 CHECK (sos_count >= 0),
  computed_at        timestamptz  NOT NULL DEFAULT now(),
  PRIMARY KEY (patient_id, day)
);

CREATE TABLE analytics_runs (
  id                  uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  started_at          timestamptz NOT NULL DEFAULT now(),
  finished_at         timestamptz,
  status              text        NOT NULL DEFAULT 'running' CHECK (status IN ('running', 'succeeded', 'failed')),
  patients_processed  integer     NOT NULL DEFAULT 0,
  rows_written        integer     NOT NULL DEFAULT 0,
  message             text        CHECK (char_length(message) <= 2000)
);
