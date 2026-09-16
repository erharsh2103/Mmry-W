"use client";

import { useEffect, useState, type ReactNode } from "react";
import { AuthProvider } from "@/hooks/useAuth";
import { I18nProvider, LanguageDraftContext } from "@/hooks/useI18n";
import { PatientProvider, usePatient } from "@/hooks/usePatient";
import { SpeechProvider } from "@/hooks/useSpeech";

/* Language, voice and speed follow the selected patient; signed-out pages use English. */
function PatientScoped({ children }: { children: ReactNode }) {
  const { patient } = usePatient();
  const [draft, setDraft] = useState<string | null>(null);
  const saved = patient?.language;

  useEffect(() => {
    setDraft(null);
  }, [saved]);

  return (
    <LanguageDraftContext.Provider value={setDraft}>
      <I18nProvider lang={draft ?? saved ?? "en"}>
        <SpeechProvider voiceOn={patient?.voiceOn ?? true} voicePref={patient?.voicePref ?? "auto"} voiceRate={patient?.voiceRate ?? 0.9}>
          {children}
        </SpeechProvider>
      </I18nProvider>
    </LanguageDraftContext.Provider>
  );
}

export function Providers({ children }: { children: ReactNode }) {
  return (
    <AuthProvider>
      <PatientProvider>
        <PatientScoped>{children}</PatientScoped>
      </PatientProvider>
    </AuthProvider>
  );
}
