import type { Metadata } from "next";
import { AnalyticsView } from "@/components/analytics/AnalyticsView";
import { PinGate } from "@/components/dashboard/PinGate";

export const metadata: Metadata = { title: "Analytics" };

export default function AnalyticsPage() {
  return (
    <PinGate>
      <AnalyticsView />
    </PinGate>
  );
}
