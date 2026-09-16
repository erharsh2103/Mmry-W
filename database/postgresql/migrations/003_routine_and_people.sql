-- 003_routine_and_people.sql
-- Daily routine, the people and places a patient should remember, and the
-- reference templates every new patient starts from.
--
-- *_key columns hold i18n keys the frontend resolves in the patient's own
-- language; the plain columns hold free text a caregiver typed. At least one
-- of each pair is required, enforced by CHECK.

CREATE TABLE task_templates (
  code        text         PRIMARY KEY CHECK (code ~ '^[a-z0-9_]{1,40}$'),
  label_key   text         NOT NULL,
  time_key    text         NOT NULL,
  hour        numeric(4,2) NOT NULL CHECK (hour >= 0 AND hour < 24),
  icon        text         NOT NULL CHECK (icon ~ '^[a-z0-9_]{1,40}$'),
  sort_order  smallint     NOT NULL DEFAULT 0
);

CREATE TABLE person_templates (
  code          text     PRIMARY KEY CHECK (code ~ '^[a-z0-9_]{1,40}$'),
  name_key      text     NOT NULL,
  relation_key  text     NOT NULL,
  note_key      text     NOT NULL,
  emoji         text     NOT NULL CHECK (char_length(emoji) BETWEEN 1 AND 16),
  is_place      boolean  NOT NULL DEFAULT false,
  sort_order    smallint NOT NULL DEFAULT 0
);

CREATE TABLE tasks (
  id          uuid         PRIMARY KEY DEFAULT gen_random_uuid(),
  patient_id  uuid         NOT NULL REFERENCES patients (id) ON DELETE CASCADE,
  label_key   text,
  label       text         CHECK (char_length(label) <= 120),
  time_key    text,
  hour        numeric(4,2) NOT NULL CHECK (hour >= 0 AND hour < 24),
  icon        text         NOT NULL DEFAULT 'event_note' CHECK (icon ~ '^[a-z0-9_]{1,40}$'),
  sort_order  smallint     NOT NULL DEFAULT 0,
  is_active   boolean      NOT NULL DEFAULT true,
  created_at  timestamptz  NOT NULL DEFAULT now(),
  CHECK (label_key IS NOT NULL OR label IS NOT NULL)
);
CREATE INDEX tasks_patient_idx ON tasks (patient_id) WHERE is_active;

-- One row per task per local calendar day: the routine resets every morning.
CREATE TABLE task_completions (
  task_id       uuid        NOT NULL REFERENCES tasks (id) ON DELETE CASCADE,
  completed_on  date        NOT NULL,
  completed_at  timestamptz NOT NULL DEFAULT now(),
  completed_by  uuid        REFERENCES users (id) ON DELETE SET NULL,
  PRIMARY KEY (task_id, completed_on)
);

CREATE TABLE people (
  id            uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  patient_id    uuid        NOT NULL REFERENCES patients (id) ON DELETE CASCADE,
  name_key      text,
  name          text        CHECK (char_length(name) <= 80),
  relation_key  text,
  relation      text        CHECK (char_length(relation) <= 80),
  note_key      text,
  note          text        CHECK (char_length(note) <= 500),
  emoji         text        NOT NULL CHECK (char_length(emoji) BETWEEN 1 AND 16),
  is_place      boolean     NOT NULL DEFAULT false,
  -- encrypted {"lat":..,"lon":..} of a pinned place
  location_enc  text,
  located_at    timestamptz,
  sort_order    smallint    NOT NULL DEFAULT 0,
  created_at    timestamptz NOT NULL DEFAULT now(),
  CHECK (name_key IS NOT NULL OR name IS NOT NULL)
);
CREATE INDEX people_patient_idx ON people (patient_id);
