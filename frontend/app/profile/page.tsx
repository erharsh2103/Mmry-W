import type { Metadata } from "next";
import { PinGate } from "@/components/dashboard/PinGate";
import { ProfileForm } from "@/components/forms/ProfileForm";

export const metadata: Metadata = { title: "Profile" };

export default function ProfilePage() {
  return (
    <PinGate>
      <ProfileForm />
    </PinGate>
  );
}
