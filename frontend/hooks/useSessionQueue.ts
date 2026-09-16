"use client";

/*
 * Finished activities are sent to the API straight away. If the connection
 * is down, they wait in a small local queue (summary numbers only, no names
 * or text) and are replayed when the device is back online or the caregiver
 * taps "Sync now". Each carries a clientRef, so a replay can never duplicate.
 */
import { useCallback, useEffect, useState } from "react";
import { ApiError, api } from "@/lib/api";
import { invalidate } from "@/hooks/useResource";
import { resourceKey } from "@/hooks/usePatientData";
import type { SessionInput } from "@/types/api";

const keyFor = (patientId: string) => `mmry-queue-${patientId}`;
const changed = "mmry-queue-changed";

function read(patientId: string): SessionInput[] {
  try {
    return JSON.parse(window.localStorage.getItem(keyFor(patientId)) ?? "[]") as SessionInput[];
  } catch {
    return [];
  }
}

function write(patientId: string, items: SessionInput[]) {
  try {
    window.localStorage.setItem(keyFor(patientId), JSON.stringify(items.slice(-50)));
  } catch {
    /* storage full or blocked: the result is lost only if the network is also down */
  }
  window.dispatchEvent(new Event(changed));
}

export function useSessionQueue(patientId: string) {
  const [pending, setPending] = useState(0);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    const sync = () => setPending(read(patientId).length);
    sync();
    window.addEventListener(changed, sync);
    return () => window.removeEventListener(changed, sync);
  }, [patientId]);

  const refreshViews = useCallback(() => {
    invalidate(resourceKey(patientId, ""));
  }, [patientId]);

  const flush = useCallback(async () => {
    const items = read(patientId);
    if (!items.length) return;
    try {
      await api.sessions.record(patientId, items);
      write(patientId, []);
      setFailed(false);
      refreshViews();
    } catch (err) {
      // Keep the queue only for connectivity problems; a rejected item would never succeed.
      if ((err as ApiError).isNetwork || (err as ApiError).status >= 500) setFailed(true);
      else write(patientId, []);
    }
  }, [patientId, refreshViews]);

  const record = useCallback(
    async (session: SessionInput) => {
      try {
        await api.sessions.record(patientId, [session]);
        refreshViews();
      } catch (err) {
        const e = err as ApiError;
        if (e.isNetwork || e.status >= 500) {
          write(patientId, [...read(patientId), session]);
          return;
        }
        throw err;
      }
    },
    [patientId, refreshViews],
  );

  useEffect(() => {
    void flush();
    window.addEventListener("online", flush);
    return () => window.removeEventListener("online", flush);
  }, [flush]);

  return { pending, failed, record, flush };
}
