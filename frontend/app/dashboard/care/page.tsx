import type { Metadata } from "next";
import { CareScreen } from "@/components/dashboard/CareScreen";
import { PinGate } from "@/components/dashboard/PinGate";

export const metadata: Metadata = { title: "Care" };

export default function CarePage() {
  return (
    <PinGate>
      <CareScreen />
    </PinGate>
  );
}
