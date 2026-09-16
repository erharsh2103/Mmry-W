"use client";

/*
 * Live, cached API reads (stale-while-revalidate).
 *
 * Moving between screens shows the last known data at once and refreshes it
 * in the background, which matters on slow rural connections. Data on screen
 * refreshes itself when:
 *   - the tab becomes visible or the window regains focus,
 *   - the device comes back online,
 *   - another tab changes the same data (lib/sync.ts),
 *   - a screen asks to poll (e.g. the safe zone while Care is open).
 */
import { useCallback, useEffect, useRef, useSyncExternalStore } from "react";
import type { ApiError } from "@/lib/api";
import { broadcast, onSync } from "@/lib/sync";

interface Entry<T> {
  data: T | undefined;
  error: ApiError | null;
  loading: boolean;
  stale: boolean;
  fetchedAt: number;
  promise?: Promise<T>;
}

/* Focus and reconnect refreshes skip data fetched within this window. */
const FRESH_MS = 5_000;

const store = new Map<string, Entry<unknown>>();
const subscribers = new Map<string, Set<() => void>>();

function notify(key: string) {
  subscribers.get(key)?.forEach((fn) => fn());
}

function put<T>(key: string, next: Entry<T>) {
  store.set(key, next as Entry<unknown>);
  notify(key);
}

function markStale(match: (key: string, e: Entry<unknown>) => boolean) {
  for (const [key, e] of store) {
    // Only data a screen is showing is refetched; the rest refreshes when opened.
    if ((subscribers.get(key)?.size ?? 0) > 0 && match(key, e)) put(key, { ...e, stale: true });
  }
}

/* Replace cached data directly, e.g. with the fresh object a write returned. */
export function setResource<T>(key: string, data: T, { share = true } = {}): void {
  put(key, { data, error: null, loading: false, stale: false, fetchedAt: Date.now() });
  if (share) broadcast({ type: "invalidate", prefix: key });
}

/* Mark every key with this prefix stale; mounted screens refetch. */
export function invalidate(prefix: string, { share = true } = {}): void {
  markStale((key) => key.startsWith(prefix));
  if (share) broadcast({ type: "invalidate", prefix });
}

export function clearResources(): void {
  const keys = [...store.keys()];
  store.clear();
  keys.forEach(notify);
}

let listening = false;
function listenGlobally() {
  if (listening || typeof window === "undefined") return;
  listening = true;
  const refreshVisible = () => {
    if (document.visibilityState === "visible") markStale((_, e) => Date.now() - e.fetchedAt > FRESH_MS);
  };
  window.addEventListener("focus", refreshVisible);
  window.addEventListener("online", () => markStale(() => true));
  document.addEventListener("visibilitychange", refreshVisible);
  onSync((msg) => {
    if (msg.type === "invalidate") invalidate(msg.prefix, { share: false });
    if (msg.type === "signout") clearResources();
  });
}

export interface Resource<T> {
  data: T | undefined;
  error: ApiError | null;
  loading: boolean;
  /* when the data on screen was fetched (ms since epoch), 0 if never */
  updatedAt: number;
  reload: () => Promise<void>;
  mutate: (data: T) => void;
}

export interface ResourceOptions {
  /* poll every N ms while the tab is visible */
  refreshMs?: number;
}

function useStoreEntry<T>(key: string | null): Entry<T> | undefined {
  const subscribe = useCallback(
    (fn: () => void) => {
      if (!key) return () => undefined;
      const set = subscribers.get(key) ?? new Set<() => void>();
      set.add(fn);
      subscribers.set(key, set);
      return () => {
        set.delete(fn);
      };
    },
    [key],
  );
  return useSyncExternalStore(
    subscribe,
    () => (key ? store.get(key) : undefined),
    () => undefined,
  ) as Entry<T> | undefined;
}

export function useResource<T>(key: string | null, fetcher: () => Promise<T>, options: ResourceOptions = {}): Resource<T> {
  const fetcherRef = useRef(fetcher);
  fetcherRef.current = fetcher;
  const snapshot = useStoreEntry<T>(key);

  useEffect(listenGlobally, []);

  const load = useCallback(async () => {
    if (!key) return;
    const current = store.get(key) as Entry<T> | undefined;
    if (current?.promise) {
      await current.promise.catch(() => undefined);
      return;
    }
    const promise = fetcherRef.current();
    put<T>(key, { data: current?.data, error: current?.error ?? null, loading: true, stale: false, fetchedAt: current?.fetchedAt ?? 0, promise });
    try {
      const data = await promise;
      put<T>(key, { data, error: null, loading: false, stale: false, fetchedAt: Date.now() });
    } catch (err) {
      put<T>(key, { data: current?.data, error: err as ApiError, loading: false, stale: false, fetchedAt: current?.fetchedAt ?? 0 });
    }
  }, [key]);

  // Revalidate whenever a screen mounts or the key changes...
  useEffect(() => {
    void load();
  }, [load]);

  // ...whenever something marked it stale...
  const stale = snapshot?.stale ?? false;
  useEffect(() => {
    if (stale) void load();
  }, [stale, load]);

  // ...and on a timer for live screens, paused while the tab is hidden.
  const { refreshMs } = options;
  useEffect(() => {
    if (!refreshMs) return;
    const id = window.setInterval(() => {
      if (document.visibilityState === "visible" && navigator.onLine !== false) void load();
    }, refreshMs);
    return () => window.clearInterval(id);
  }, [refreshMs, load]);

  return {
    data: snapshot?.data,
    error: snapshot?.error ?? null,
    loading: snapshot?.loading ?? !!key,
    updatedAt: snapshot?.fetchedAt ?? 0,
    reload: load,
    mutate: (data: T) => {
      if (key) setResource(key, data);
    },
  };
}

/* Read a value another component put in the store, without fetching anything. */
export function useStoredValue<T>(key: string): T | undefined {
  return useStoreEntry<T>(key)?.data;
}
