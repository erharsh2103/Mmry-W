"use client";

import { useEffect, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { ApiError } from "@/lib/api";
import { useAuth } from "@/hooks/useAuth";
import { useI18n, useLanguageDraft } from "@/hooks/useI18n";
import { usePatient } from "@/hooks/usePatient";
import { resourceKey, useSafety } from "@/hooks/usePatientData";
import { setResource } from "@/hooks/useResource";
import { useSpeech } from "@/hooks/useSpeech";
import { breachVars, useLocationTracking } from "@/hooks/useLocationTracking";
import { Header } from "@/components/navbar/Header";
import { BottomNav } from "@/components/navbar/BottomNav";
import { Sidebar } from "@/components/sidebar/Sidebar";
import { StateMessage } from "@/components/ui/StateMessage";
import { SetupDialog } from "@/components/forms/SetupDialog";
import styles from "./shell.module.css";

interface Props {
  children: ReactNode;
}

/*
 * The frame every signed-in screen shares: header, bottom navigation, the
 * wide-screen sidebar, first-run setup and safe-zone
 * tracking while it is switched on.
 */
export function AppShell({ children }: Props) {
  const router = useRouter();
  const { status: authStatus, retry } = useAuth();
  const { patient, status, error, reload } = usePatient();
  const { dir } = useI18n();
  const setDraft = useLanguageDraft();

  useEffect(() => {
    if (authStatus === "anonymous") router.replace(`/login?next=${encodeURIComponent(window.location.pathname)}`);
  }, [authStatus, router]);

  if (authStatus === "offline") {
    return (
      <div className={styles.center}>
        <StateMessage error={new ApiError(0, "network", "offline")} onRetry={retry} />
      </div>
    );
  }
  if (authStatus !== "authenticated" || status === "idle" || status === "loading") {
    return (
      <div className={styles.center}>
        <StateMessage loading />
      </div>
    );
  }
  if (status === "error") {
    return (
      <div className={styles.center}>
        <StateMessage error={error} onRetry={reload} />
      </div>
    );
  }

  const needsSetup = !patient || !patient.onboardingDone;
  const initial = (patient?.displayName || "M").trim().charAt(0).toUpperCase();

  return (
    <div className={styles.shell} dir={dir} style={{ fontSize: `${Math.round(19 * (patient?.fontScale ?? 1))}px` }}>
      <Header initial={initial} />
      <div className={styles.body}>
        <Sidebar />
        <main className={styles.main} id="main">
          <div className={styles.content}>
            {needsSetup ? null : children}
          </div>
        </main>
      </div>
      <BottomNav />
      {patient && patient.onboardingDone && <Tracking patientId={patient.id} />}
      {needsSetup && <SetupDialog onLanguage={setDraft} />}
    </div>
  );
}

/* Watches position only while the caregiver has tracking switched on. */
function Tracking({ patientId }: { patientId: string }) {
  const { data: safety } = useSafety();
  const { say } = useSpeech();
  const { error } = useLocationTracking(patientId, !!safety?.zone.trackingEnabled, (kind, state) => {
    if (kind === "out") say("locBreachSpoken", breachVars(state));
    else say("locReturnSpoken");
  });
  // The Care screen shows why tracking is not working (permission refused, no GPS).
  useEffect(() => {
    setResource(resourceKey(patientId, "geoError"), error);
  }, [patientId, error]);
  return null;
}
