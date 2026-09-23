-- 007_location_notifications.sql
-- Encrypted recipients and an outbox for safe-zone alerts. A delivery worker or
-- provider adapter can consume pending rows without exposing phone numbers or
-- coordinates to the database role in plaintext.

CREATE TABLE patient_alert_contacts (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  patient_id  uuid NOT NULL REFERENCES patients (id) ON DELETE CASCADE,
  label       text NOT NULL CHECK (char_length(label) BETWEEN 1 AND 80),
  phone_enc   text NOT NULL,
  enabled     boolean NOT NULL DEFAULT true,
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX patient_alert_contacts_patient_idx ON patient_alert_contacts (patient_id, enabled);

CREATE TABLE location_notifications (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  patient_id     uuid NOT NULL REFERENCES patients (id) ON DELETE CASCADE,
  event_id       uuid REFERENCES location_events (id) ON DELETE SET NULL,
  contact_id     uuid REFERENCES patient_alert_contacts (id) ON DELETE SET NULL,
  kind           text NOT NULL CHECK (kind IN ('geofence_out', 'location_update', 'geofence_in')),
  recipient_enc  text NOT NULL,
  location_enc   text,
  status         text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'sent', 'failed', 'disabled')),
  attempts       integer NOT NULL DEFAULT 0 CHECK (attempts >= 0),
  last_error     text,
  created_at     timestamptz NOT NULL DEFAULT now(),
  sent_at        timestamptz
);
CREATE INDEX location_notifications_pending_idx ON location_notifications (status, created_at);
CREATE INDEX location_notifications_patient_idx ON location_notifications (patient_id, created_at DESC);

ALTER TABLE safe_zones ADD COLUMN last_location_alert_at timestamptz;
