-- 002_patients.sql
-- A patient is cared for by one or more caregiver accounts. Every patient
-- resource is authorised through patient_caregivers.

CREATE TYPE caregiver_access AS ENUM ('owner', 'member');

CREATE TABLE patients (
  id                   uuid         PRIMARY KEY DEFAULT gen_random_uuid(),
  display_name         text         NOT NULL CHECK (char_length(display_name) BETWEEN 1 AND 80),
  age                  smallint     CHECK (age BETWEEN 1 AND 130),
  language             text         NOT NULL DEFAULT 'en' CHECK (language ~ '^[a-z]{2,3}$'),
  caregiver_name       text         CHECK (char_length(caregiver_name) <= 80),
  -- AES-256-GCM ciphertext, see backend/src/utils/crypto.ts
  caregiver_phone_enc  text,
  -- AES-256-GCM ciphertext of the memory vault JSON:
  -- {"home","doctor","emergency","medicines"}
  vault_enc            text,
  -- scrypt hash of the 4-digit caregiver lock; NULL means no lock
  pin_hash             text,
  voice_on             boolean      NOT NULL DEFAULT true,
  voice_pref           text         NOT NULL DEFAULT 'auto' CHECK (voice_pref IN ('auto', 'female', 'male')),
  voice_rate           numeric(3,2) NOT NULL DEFAULT 0.90 CHECK (voice_rate IN (0.75, 0.90, 1.10)),
  font_scale           numeric(3,2) NOT NULL DEFAULT 1.00 CHECK (font_scale BETWEEN 0.90 AND 1.40),
  onboarding_done      boolean      NOT NULL DEFAULT false,
  created_by           uuid         REFERENCES users (id) ON DELETE SET NULL,
  created_at           timestamptz  NOT NULL DEFAULT now(),
  updated_at           timestamptz  NOT NULL DEFAULT now()
);

CREATE TABLE patient_caregivers (
  patient_id  uuid             NOT NULL REFERENCES patients (id) ON DELETE CASCADE,
  user_id     uuid             NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  access      caregiver_access NOT NULL DEFAULT 'member',
  created_at  timestamptz      NOT NULL DEFAULT now(),
  PRIMARY KEY (patient_id, user_id)
);
CREATE INDEX patient_caregivers_user_idx ON patient_caregivers (user_id);
