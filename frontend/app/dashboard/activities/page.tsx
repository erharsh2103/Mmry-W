import type { Metadata } from "next";
import { ActivitiesScreen } from "@/components/dashboard/ActivitiesScreen";

export const metadata: Metadata = { title: "Activities" };

export default function ActivitiesPage() {
  return <ActivitiesScreen />;
}
