-- 004_activity.sql
-- Summaries of each game and mind check. The step-by-step detail of a session
-- is document-shaped and varies by game, so it lives in MongoDB
-- (game_events / mind_check_answers) keyed by these ids. It is not copied here.
--
-- client_ref is minted on the device so an offline queue can be replayed
-- without creating duplicates.

CREATE TABLE game_sessions (
  id           uuid         PRIMARY KEY DEFAULT gen_random_uuid(),
  patient_id   uuid         NOT NULL REFERENCES patients (id) ON DELETE CASCADE,
  client_ref   uuid         NOT NULL,
  game_type    text         NOT NULL CHECK (game_type IN (
                 'object-recall', 'sequence', 'name-face', 'attention',
                 'memory-cards', 'pattern', 'find-object', 'picture-recall')),
  level        smallint     NOT NULL CHECK (level BETWEEN 1 AND 5),
  accuracy     numeric(4,3) NOT NULL CHECK (accuracy BETWEEN 0 AND 1),
  response_ms  integer      NOT NULL CHECK (response_ms BETWEEN 0 AND 3600000),
  attempts     smallint     NOT NULL CHECK (attempts BETWEEN 1 AND 1000),
  played_at    timestamptz  NOT NULL,
  recorded_at  timestamptz  NOT NULL DEFAULT now(),
  UNIQUE (patient_id, client_ref)
);
CREATE INDEX game_sessions_patient_time_idx ON game_sessions (patient_id, played_at DESC);

CREATE TABLE mind_checks (
  id               uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  patient_id       uuid        NOT NULL REFERENCES patients (id) ON DELETE CASCADE,
  client_ref       uuid        NOT NULL,
  taken_at         timestamptz NOT NULL,
  memory           smallint    CHECK (memory BETWEEN 0 AND 100),
  attention        smallint    CHECK (attention BETWEEN 0 AND 100),
  recognition      smallint    CHECK (recognition BETWEEN 0 AND 100),
  recall           smallint    CHECK (recall BETWEEN 0 AND 100),
  reasoning        smallint    CHECK (reasoning BETWEEN 0 AND 100),
  orientation      smallint    CHECK (orientation BETWEEN 0 AND 100),
  overall          smallint    NOT NULL CHECK (overall BETWEEN 0 AND 100),
  avg_response_ms  integer     NOT NULL CHECK (avg_response_ms >= 0),
  answer_count     smallint    NOT NULL CHECK (answer_count >= 0),
  -- recognition fell 34 or more points since the previous check
  inconsistent     boolean     NOT NULL DEFAULT false,
  recorded_at      timestamptz NOT NULL DEFAULT now(),
  UNIQUE (patient_id, client_ref)
);
CREATE INDEX mind_checks_patient_time_idx ON mind_checks (patient_id, taken_at DESC);
