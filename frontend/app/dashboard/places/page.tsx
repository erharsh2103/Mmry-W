import type { Metadata } from "next";
import { PlacesScreen } from "@/components/dashboard/PlacesScreen";

export const metadata: Metadata = { title: "Places" };

export default function PlacesPage() {
  return <PlacesScreen />;
}