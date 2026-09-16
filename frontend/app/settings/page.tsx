import type { Metadata } from "next";
import { PinGate } from "@/components/dashboard/PinGate";
import { SettingsForm } from "@/components/forms/SettingsForm";

export const metadata: Metadata = { title: "Settings" };

export default function SettingsPage() {
  return (
    <PinGate>
      <SettingsForm />
    </PinGate>
  );
}
