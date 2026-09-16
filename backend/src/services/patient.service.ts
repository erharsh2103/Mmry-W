import { withTransaction } from "../config/postgres.js";
import { EMPTY_VAULT, type CaregiverAccess, type MemoryVault, type Patient, type PatientRecord, type VoicePref } from "../models/patient.js";
import { patientsRepository, type PatientUpdate } from "../repositories/patients.repository.js";
import { peopleRepository, tasksRepository } from "../repositories/routine.repository.js";
import { safeZonesRepository } from "../repositories/safety.repository.js";
import { decryptJson, decryptOptional, encryptJson, encryptOptional } from "../utils/crypto.js";
import { HttpError, forbidden, notFound } from "../utils/httpError.js";
import { hashSecret, verifySecret } from "../utils/password.js";

function toPatient(r: PatientRecord, access: CaregiverAccess): Patient {
  return {
    id: r.id,
    displayName: r.displayName,
    age: r.age,
    language: r.language,
    caregiverName: r.caregiverName,
    caregiverPhone: decryptOptional(r.caregiverPhoneEnc),
    vault: { ...EMPTY_VAULT, ...decryptJson<Partial<MemoryVault>>(r.vaultEnc) },
    hasPin: !!r.pinHash,
    voiceOn: r.voiceOn,
    voicePref: r.voicePref,
    voiceRate: r.voiceRate,
    fontScale: r.fontScale,
    onboardingDone: r.onboardingDone,
    access,
    createdAt: r.createdAt.toISOString(),
    updatedAt: r.updatedAt.toISOString(),
  };
}

export interface PatientProfileInput {
  displayName?: string;
  age?: number | null;
  language?: string;
  caregiverName?: string | null;
  caregiverPhone?: string | null;
  vault?: Partial<MemoryVault>;
  voiceOn?: boolean;
  voicePref?: VoicePref;
  voiceRate?: number;
  fontScale?: number;
  onboardingDone?: boolean;
}

/* Keep only digits and a leading +, as the original SOS flow did. */
export const normalisePhone = (raw: string) => raw.replace(/[^0-9+]/g, "").replace(/(?!^)\+/g, "");

export const patientService = {
  async list(userId: string): Promise<Patient[]> {
    const rows = await patientsRepository.listForUser(userId);
    return rows.map((r) => toPatient(r, r.access));
  },

  /* A new patient starts with the reference routine, people and a safe zone that is switched off. */
  async create(userId: string, input: { displayName: string; language: string }): Promise<Patient> {
    const record = await withTransaction(async (db) => {
      const patient = await patientsRepository.create(db, { ...input, createdBy: userId });
      await patientsRepository.addCaregiver(db, patient.id, userId, "owner");
      await tasksRepository.createFromTemplates(db, patient.id);
      await peopleRepository.createFromTemplates(db, patient.id);
      await safeZonesRepository.createDefault(db, patient.id);
      return patient;
    });
    return toPatient(record, "owner");
  },

  async get(patientId: string, access: CaregiverAccess): Promise<Patient> {
    const record = await patientsRepository.findById(patientId);
    if (!record) throw notFound("Patient not found");
    return toPatient(record, access);
  },

  async update(patientId: string, access: CaregiverAccess, input: PatientProfileInput): Promise<Patient> {
    const changes: PatientUpdate = {
      displayName: input.displayName,
      age: input.age,
      language: input.language,
      caregiverName: input.caregiverName,
      voiceOn: input.voiceOn,
      voicePref: input.voicePref,
      voiceRate: input.voiceRate,
      fontScale: input.fontScale,
      onboardingDone: input.onboardingDone,
    };
    if (input.caregiverPhone !== undefined) {
      const phone = input.caregiverPhone ? normalisePhone(input.caregiverPhone) : "";
      changes.caregiverPhoneEnc = encryptOptional(phone || null);
    }
    if (input.vault) {
      const current = await patientsRepository.findById(patientId);
      if (!current) throw notFound("Patient not found");
      const merged = { ...EMPTY_VAULT, ...decryptJson<Partial<MemoryVault>>(current.vaultEnc), ...input.vault };
      changes.vaultEnc = encryptJson(merged);
    }
    const updated = await patientsRepository.update(patientId, changes);
    if (!updated) throw notFound("Patient not found");
    return toPatient(updated, access);
  },

  async setPin(patientId: string, access: CaregiverAccess, pin: string | null): Promise<Patient> {
    const updated = await patientsRepository.update(patientId, { pinHash: pin ? await hashSecret(pin) : null });
    if (!updated) throw notFound("Patient not found");
    return toPatient(updated, access);
  },

  /* The caregiver lock that guards Care, Analytics and Profile on a shared device. */
  async verifyPin(patientId: string, pin: string): Promise<void> {
    const record = await patientsRepository.findById(patientId);
    if (!record) throw notFound("Patient not found");
    if (!record.pinHash) return;
    // 403, not 401: a wrong PIN must not look like an expired session to the client.
    if (!(await verifySecret(pin, record.pinHash))) throw new HttpError(403, "wrong_pin", "Wrong code");
  },

  async remove(patientId: string, access: CaregiverAccess): Promise<void> {
    if (access !== "owner") throw forbidden("Only the owning caregiver can delete a patient");
    await patientsRepository.delete(patientId);
  },
};
