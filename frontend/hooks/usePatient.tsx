"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { ApiError, api } from "@/lib/api";
import { useAuth } from "@/hooks/useAuth";
import type { Patient, PatientUpdate } from "@/types/api";

const SELECTED_KEY = "mmry-selected-patient";

type Status = "idle" | "loading" | "ready" | "none" | "error";

interface PatientValue {
  patients: Patient[];
  patient: Patient | null;
  status: Status;
  error: ApiError | null;
  reload: () => void;
  select: (id: string) => void;
  create: (displayName: string, language: string) => Promise<Patient>;
  /* id defaults to the selected patient; pass it right after create() */
  update: (changes: PatientUpdate, id?: string) => Promise<Patient>;
  setPin: (pin: string | null, id?: string) => Promise<Patient>;
  /* caregiver lock: Care, Analytics and Profile ask for the PIN once per session */
  unlocked: boolean;
  unlock: (pin: string) => Promise<void>;
  lock: () => void;
}

const PatientContext = createContext<PatientValue | null>(null);

function readSelected(): string | null {
  try {
    return window.localStorage.getItem(SELECTED_KEY);
  } catch {
    return null;
  }
}

export function PatientProvider({ children }: { children: ReactNode }) {
  const { status: authStatus } = useAuth();
  const [patients, setPatients] = useState<Patient[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [status, setStatus] = useState<Status>("idle");
  const [error, setError] = useState<ApiError | null>(null);
  const [unlocked, setUnlocked] = useState(false);
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    if (authStatus !== "authenticated") {
      setPatients([]);
      setStatus("idle");
      return;
    }
    let live = true;
    setStatus("loading");
    api.patients
      .list()
      .then(({ patients: list }) => {
        if (!live) return;
        setPatients(list);
        const remembered = readSelected();
        setSelectedId(list.find((p) => p.id === remembered)?.id ?? list[0]?.id ?? null);
        setStatus(list.length ? "ready" : "none");
        setError(null);
      })
      .catch((err: ApiError) => {
        if (!live) return;
        setError(err);
        setStatus("error");
      });
    return () => {
      live = false;
    };
  }, [authStatus, attempt]);

  const patient = patients.find((p) => p.id === selectedId) ?? null;

  const replace = useCallback((next: Patient) => {
    setPatients((list) => (list.some((p) => p.id === next.id) ? list.map((p) => (p.id === next.id ? next : p)) : [...list, next]));
    return next;
  }, []);

  const select = useCallback((id: string) => {
    setSelectedId(id);
    setUnlocked(false);
    try {
      window.localStorage.setItem(SELECTED_KEY, id);
    } catch {
      /* storage blocked */
    }
  }, []);

  const value = useMemo<PatientValue>(
    () => ({
      patients,
      patient,
      status,
      error,
      reload: () => setAttempt((n) => n + 1),
      select,
      create: async (displayName, language) => {
        const { patient: created } = await api.patients.create({ displayName, language });
        replace(created);
        select(created.id);
        setStatus("ready");
        return created;
      },
      update: async (changes, id = patient?.id) => {
        if (!id) throw new Error("no patient selected");
        return replace((await api.patients.update(id, changes)).patient);
      },
      setPin: async (pin, id = patient?.id) => {
        if (!id) throw new Error("no patient selected");
        return replace((await api.patients.setPin(id, pin)).patient);
      },
      unlocked: unlocked || !patient?.hasPin,
      unlock: async (pin) => {
        if (!patient) return;
        await api.patients.verifyPin(patient.id, pin);
        setUnlocked(true);
      },
      lock: () => setUnlocked(false),
    }),
    [patients, patient, status, error, select, replace, unlocked],
  );

  return <PatientContext.Provider value={value}>{children}</PatientContext.Provider>;
}

export function usePatient(): PatientValue {
  const ctx = useContext(PatientContext);
  if (!ctx) throw new Error("usePatient must be used inside <PatientProvider>");
  return ctx;
}

/* For screens that only render once a patient exists. */
export function useCurrentPatient(): Patient {
  const { patient } = usePatient();
  if (!patient) throw new Error("useCurrentPatient called before a patient was loaded");
  return patient;
}
