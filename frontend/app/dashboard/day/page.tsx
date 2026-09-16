import type { Metadata } from "next";
import { DayScreen } from "@/components/dashboard/DayScreen";

export const metadata: Metadata = { title: "My day" };

export default function DayPage() {
  return <DayScreen />;
}
