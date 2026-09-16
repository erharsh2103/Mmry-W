"use client";

import { api } from "@/lib/api";
import { localDay } from "@/lib/routine/now";
import { useCurrentPatient } from "@/hooks/usePatient";
import { useResource } from "@/hooks/useResource";

/* Keys are namespaced by patient so switching patients never shows stale data. */
export const resourceKey = (patientId: string, name: string) => `p:${patientId}:${name}`;

export function useTasks(day: string = localDay()) {
  const patient = useCurrentPatient();
  return useResource(resourceKey(patient.id, `tasks:${day}`), async () => (await api.tasks.list(patient.id, day)).tasks);
}

export function usePeople() {
  const patient = useCurrentPatient();
  return useResource(resourceKey(patient.id, "people"), async () => (await api.people.list(patient.id)).people);
}

export function useSessions(limit = 50) {
  const patient = useCurrentPatient();
  return useResource(resourceKey(patient.id, `sessions:${limit}`), async () => (await api.sessions.list(patient.id, limit)).sessions);
}

export function useMindChecks(limit = 10) {
  const patient = useCurrentPatient();
  return useResource(resourceKey(patient.id, `checks:${limit}`), async () => (await api.mindChecks.list(patient.id, limit)).mindChecks);
}

export function useSafety() {
  const patient = useCurrentPatient();
  return useResource(resourceKey(patient.id, "safety"), () => api.safety.get(patient.id));
}

export function useInsights(day: string = localDay()) {
  const patient = useCurrentPatient();
  return useResource(resourceKey(patient.id, `insights:${day}`), () => api.insights.get(patient.id, day));
}

export function useAnalytics(days: number) {
  const patient = useCurrentPatient();
  return useResource(resourceKey(patient.id, `analytics:${days}`), () => api.insights.analytics(patient.id, days));
}
