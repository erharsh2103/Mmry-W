import { pool, type Queryable } from "../config/postgres.js";
import type { CaregiverAccess, PatientRecord, VoicePref } from "../models/patient.js";

interface PatientRow {
  id: string;
  display_name: string;
  age: number | null;
  language: string;
  caregiver_name: string | null;
  caregiver_phone_enc: string | null;
  vault_enc: string | null;
  pin_hash: string | null;
  voice_on: boolean;
  voice_pref: VoicePref;
  voice_rate: number;
  font_scale: number;
  onboarding_done: boolean;
  created_at: Date;
  updated_at: Date;
}

const COLUMNS = `p.id, p.display_name, p.age, p.language, p.caregiver_name, p.caregiver_phone_enc, p.vault_enc,
  p.pin_hash, p.voice_on, p.voice_pref, p.voice_rate, p.font_scale, p.onboarding_done, p.created_at, p.updated_at`;

const toRecord = (r: PatientRow): PatientRecord => ({
  id: r.id,
  displayName: r.display_name,
  age: r.age,
  language: r.language,
  caregiverName: r.caregiver_name,
  caregiverPhoneEnc: r.caregiver_phone_enc,
  vaultEnc: r.vault_enc,
  pinHash: r.pin_hash,
  voiceOn: r.voice_on,
  voicePref: r.voice_pref,
  voiceRate: r.voice_rate,
  fontScale: r.font_scale,
  onboardingDone: r.onboarding_done,
  createdAt: r.created_at,
  updatedAt: r.updated_at,
});

/* Columns a caller may update, mapped to their SQL names. */
const UPDATABLE = {
  displayName: "display_name",
  age: "age",
  language: "language",
  caregiverName: "caregiver_name",
  caregiverPhoneEnc: "caregiver_phone_enc",
  vaultEnc: "vault_enc",
  pinHash: "pin_hash",
  voiceOn: "voice_on",
  voicePref: "voice_pref",
  voiceRate: "voice_rate",
  fontScale: "font_scale",
  onboardingDone: "onboarding_done",
} as const;

export type PatientUpdate = { -readonly [K in keyof typeof UPDATABLE]?: PatientRecord[K] };

export const patientsRepository = {
  async listForUser(userId: string): Promise<(PatientRecord & { access: CaregiverAccess })[]> {
    const { rows } = await pool.query<PatientRow & { access: CaregiverAccess }>(
      `SELECT ${COLUMNS}, pc.access
         FROM patients p JOIN patient_caregivers pc ON pc.patient_id = p.id
        WHERE pc.user_id = $1
        ORDER BY p.created_at`,
      [userId],
    );
    return rows.map((r) => ({ ...toRecord(r), access: r.access }));
  },

  async findById(id: string): Promise<PatientRecord | null> {
    const { rows } = await pool.query<PatientRow>(`SELECT ${COLUMNS} FROM patients p WHERE p.id = $1`, [id]);
    return rows[0] ? toRecord(rows[0]) : null;
  },

  async accessFor(patientId: string, userId: string): Promise<CaregiverAccess | null> {
    const { rows } = await pool.query<{ access: CaregiverAccess }>(
      "SELECT access FROM patient_caregivers WHERE patient_id = $1 AND user_id = $2",
      [patientId, userId],
    );
    return rows[0]?.access ?? null;
  },

  async create(db: Queryable, input: { displayName: string; language: string; createdBy: string }): Promise<PatientRecord> {
    const { rows } = await db.query<PatientRow>(
      `INSERT INTO patients AS p (display_name, language, created_by) VALUES ($1, $2, $3) RETURNING ${COLUMNS}`,
      [input.displayName, input.language, input.createdBy],
    );
    return toRecord(rows[0]!);
  },

  async addCaregiver(db: Queryable, patientId: string, userId: string, access: CaregiverAccess): Promise<void> {
    await db.query(
      `INSERT INTO patient_caregivers (patient_id, user_id, access) VALUES ($1, $2, $3)
       ON CONFLICT (patient_id, user_id) DO NOTHING`,
      [patientId, userId, access],
    );
  },

  async update(id: string, changes: PatientUpdate): Promise<PatientRecord | null> {
    const entries = Object.entries(changes).filter(([, v]) => v !== undefined) as [keyof typeof UPDATABLE, unknown][];
    if (!entries.length) return this.findById(id);
    const sets = entries.map(([k], i) => `${UPDATABLE[k]} = $${i + 2}`);
    const { rows } = await pool.query<PatientRow>(
      `UPDATE patients AS p SET ${sets.join(", ")} WHERE p.id = $1 RETURNING ${COLUMNS}`,
      [id, ...entries.map(([, v]) => v)],
    );
    return rows[0] ? toRecord(rows[0]) : null;
  },

  async delete(id: string): Promise<void> {
    await pool.query("DELETE FROM patients WHERE id = $1", [id]);
  },
};
