"use client";

import { api } from "@/lib/api";
import { localDay } from "@/lib/routine/now";
import { useCurrentPatient } from "@/hooks/usePatient";
import { useResource, type ResourceOptions } from "@/hooks/useResource";

/* Keys are namespaced by patient so switching patients never shows stale data. */
export const resourceKey = (patientId: string, name: string) => `p:${patientId}:${name}`;

export function useTasks(day: string = localDay(), options?: ResourceOptions) {
  const patient = useCurrentPatient();
  return useResource(resourceKey(patient.id, `tasks:${day}`), async () => (await api.tasks.list(patient.id, day)).tasks, options);
}

export function usePeople(options?: ResourceOptions) {
  const patient = useCurrentPatient();
  return useResource(resourceKey(patient.id, "people"), async () => (await api.people.list(patient.id)).people, options);
}

export function useSessions(limit = 50, options?: ResourceOptions) {
  const patient = useCurrentPatient();
  return useResource(resourceKey(patient.id, `sessions:${limit}`), async () => (await api.sessions.list(patient.id, limit)).sessions, options);
}

export function useMindChecks(limit = 10) {
  const patient = useCurrentPatient();
  return useResource(resourceKey(patient.id, `checks:${limit}`), async () => (await api.mindChecks.list(patient.id, limit)).mindChecks);
}

export function useSafety(options?: ResourceOptions) {
  const patient = useCurrentPatient();
  return useResource(resourceKey(patient.id, "safety"), () => api.safety.get(patient.id), options);
}

export function useInsights(day: string = localDay(), options?: ResourceOptions) {
  const patient = useCurrentPatient();
  return useResource(resourceKey(patient.id, `insights:${day}`), () => api.insights.get(patient.id, day), options);
}

export function useAnalytics(days: number, options?: ResourceOptions) {
  const patient = useCurrentPatient();
  return useResource(resourceKey(patient.id, `analytics:${days}`), () => api.insights.analytics(patient.id, days), options);
}

/* How often live screens poll while the tab is visible. */
export const LIVE = {
  safety: { refreshMs: 30_000 },
  routine: { refreshMs: 60_000 },
  insights: { refreshMs: 60_000 },
  analytics: { refreshMs: 5 * 60_000 },
} satisfies Record<string, ResourceOptions>;
