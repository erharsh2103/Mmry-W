import type { Metadata } from "next";
import { HomeScreen } from "@/components/dashboard/HomeScreen";

export const metadata: Metadata = { title: "Home" };

export default function DashboardPage() {
  return <HomeScreen />;
}
