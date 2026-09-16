import type { ReactNode } from "react";
import { AppShell } from "@/components/dashboard/AppShell";

export default function SettingsLayout({ children }: { children: ReactNode }) {
  return <AppShell>{children}</AppShell>;
}
