-- 005_safety.sql
-- Safe zone (geofence), last known position and the breach / SOS history.
-- Every coordinate is encrypted at rest; distances are not.

CREATE TABLE safe_zones (
  patient_id           uuid        PRIMARY KEY REFERENCES patients (id) ON DELETE CASCADE,
  home_enc             text,
  radius_m             integer     NOT NULL DEFAULT 500 CHECK (radius_m IN (200, 500, 1000, 2000)),
  armed                boolean     NOT NULL DEFAULT true,
  -- Off until a caregiver switches it on: the app never asks an elderly
  -- user for location permission on first launch.
  tracking_enabled     boolean     NOT NULL DEFAULT false,
  last_fix_enc         text,
  last_fix_accuracy_m  integer     CHECK (last_fix_accuracy_m >= 0),
  last_fix_at          timestamptz,
  updated_at           timestamptz NOT NULL DEFAULT now()
);

CREATE TYPE location_event_kind AS ENUM ('out', 'in', 'sos');

CREATE TABLE location_events (
  id            uuid                PRIMARY KEY DEFAULT gen_random_uuid(),
  patient_id    uuid                NOT NULL REFERENCES patients (id) ON DELETE CASCADE,
  kind          location_event_kind NOT NULL,
  occurred_at   timestamptz         NOT NULL DEFAULT now(),
  distance_m    integer             CHECK (distance_m >= 0),
  position_enc  text
);
CREATE INDEX location_events_patient_time_idx ON location_events (patient_id, occurred_at DESC);
