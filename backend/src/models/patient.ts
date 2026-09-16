export type CaregiverAccess = "owner" | "member";
export type VoicePref = "auto" | "female" | "male";

/* Row as stored: sensitive columns still encrypted. */
export interface PatientRecord {
  id: string;
  displayName: string;
  age: number | null;
  language: string;
  caregiverName: string | null;
  caregiverPhoneEnc: string | null;
  vaultEnc: string | null;
  pinHash: string | null;
  voiceOn: boolean;
  voicePref: VoicePref;
  voiceRate: number;
  fontScale: number;
  onboardingDone: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface MemoryVault {
  home: string;
  doctor: string;
  emergency: string;
  medicines: string;
}

/* Decrypted view returned to an authorised caregiver. */
export interface Patient {
  id: string;
  displayName: string;
  age: number | null;
  language: string;
  caregiverName: string | null;
  caregiverPhone: string | null;
  vault: MemoryVault;
  hasPin: boolean;
  voiceOn: boolean;
  voicePref: VoicePref;
  voiceRate: number;
  fontScale: number;
  onboardingDone: boolean;
  access: CaregiverAccess;
  createdAt: string;
  updatedAt: string;
}

export const EMPTY_VAULT: MemoryVault = { home: "", doctor: "", emergency: "", medicines: "" };
