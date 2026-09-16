"use client";

/*
 * While a caregiver has switched tracking on, report this device's position
 * to the API. The geofence decision is made server-side; a crossing comes
 * back as a transition, and the patient hears a gentle prompt.
 *
 * Reports are throttled: at most one every 30 s unless the position moved
 * more than 25 m, so a phone lying on a table does not flood the server.
 */
import { useEffect, useRef, useState } from "react";
import { api } from "@/lib/api";
import { distanceM, fmtDist } from "@/lib/care/format";
import { setResource } from "@/hooks/useResource";
import { resourceKey } from "@/hooks/usePatientData";
import type { SafetyState } from "@/types/api";

export type LocationError = "" | "denied" | "unsupported" | "unavailable";

const MIN_INTERVAL_MS = 30_000;
const MIN_MOVE_M = 25;

export function useLocationTracking(
  patientId: string,
  enabled: boolean,
  onTransition: (kind: "out" | "in", state: SafetyState) => void,
) {
  const [error, setError] = useState<LocationError>("");
  const [watching, setWatching] = useState(false);
  const last = useRef<{ at: number; lat: number; lon: number } | null>(null);
  const transitionRef = useRef(onTransition);
  transitionRef.current = onTransition;

  useEffect(() => {
    if (!enabled) {
      setWatching(false);
      return;
    }
    if (typeof navigator === "undefined" || !navigator.geolocation) {
      setError("unsupported");
      return;
    }
    setError("");
    const id = navigator.geolocation.watchPosition(
      (pos) => {
        const { latitude: lat, longitude: lon, accuracy } = pos.coords;
        const prev = last.current;
        const now = Date.now();
        if (prev && now - prev.at < MIN_INTERVAL_MS && distanceM(prev, { lat, lon }) < MIN_MOVE_M) return;
        last.current = { at: now, lat, lon };
        api.safety
          .reportFix(patientId, { lat, lon, accuracyM: Math.round(accuracy || 0) })
          .then(({ transition, state }) => {
            setResource(resourceKey(patientId, "safety"), state);
            if (transition === "out" || transition === "in") transitionRef.current(transition, state);
          })
          .catch(() => undefined);
      },
      (err) => setError(err.code === 1 ? "denied" : "unavailable"),
      { enableHighAccuracy: true, maximumAge: 15_000, timeout: 30_000 },
    );
    setWatching(true);
    return () => {
      navigator.geolocation.clearWatch(id);
      setWatching(false);
    };
  }, [enabled, patientId]);

  return { error, watching };
}

export const breachVars = (state: SafetyState) => ({ n: fmtDist(state.distanceM) });
