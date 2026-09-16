import type { Metadata } from "next";
import { CheckScreen } from "@/components/dashboard/CheckScreen";

export const metadata: Metadata = { title: "Mind check" };

export default function CheckPage() {
  return <CheckScreen />;
}
