import type { Metadata } from "next";
import { PeopleScreen } from "@/components/dashboard/PeopleScreen";

export const metadata: Metadata = { title: "My people" };

export default function PeoplePage() {
  return <PeopleScreen />;
}
