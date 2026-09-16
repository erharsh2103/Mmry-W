"use client";

import type { ReactNode } from "react";
import { useRouter } from "next/navigation";
import { usePatient } from "@/hooks/usePatient";
import { PinDialog } from "./PinDialog";

/* Caregiver screens ask for the patient's code, when one is set, before showing anything. */
export function PinGate({ children }: { children: ReactNode }) {
  const router = useRouter();
  const { unlocked } = usePatient();
  if (!unlocked) return <PinDialog onCancel={() => router.replace("/dashboard")} />;
  return <>{children}</>;
}
