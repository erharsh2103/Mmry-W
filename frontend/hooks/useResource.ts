"use client";

/*
 * Minimal stale-while-revalidate cache for API reads. Moving between screens
 * shows the last known data immediately and refreshes it in the background,
 * which matters on slow rural connections.
 */
import { useCallback, useEffect, useRef, useSyncExternalStore } from "react";
import type { ApiError } from "@/lib/api";

interface Entry<T> {
  data: T | undefined;
  error: ApiError | null;
  loading: boolean;
  stale: boolean;
  promise?: Promise<T>;
}

const store = new Map<string, Entry<unknown>>();
const subscribers = new Map<string, Set<() => void>>();

function notify(key: string) {
  subscribers.get(key)?.forEach((fn) => fn());
}

function put<T>(key: string, next: Entry<T>) {
  store.set(key, next as Entry<unknown>);
  notify(key);
}

/* Replace cached data directly, e.g. with the fresh object a write returned. */
export function setResource<T>(key: string, data: T): void {
  put(key, { data, error: null, loading: false, stale: false });
}

/* Mark every key with this prefix stale; mounted screens refetch. */
export function invalidate(prefix: string): void {
  for (const [key, e] of store) {
    if (key.startsWith(prefix)) put(key, { ...e, stale: true });
  }
}

export function clearResources(): void {
  const keys = [...store.keys()];
  store.clear();
  keys.forEach(notify);
}

export interface Resource<T> {
  data: T | undefined;
  error: ApiError | null;
  loading: boolean;
  reload: () => Promise<void>;
  mutate: (data: T) => void;
}

export function useResource<T>(key: string | null, fetcher: () => Promise<T>): Resource<T> {
  const fetcherRef = useRef(fetcher);
  fetcherRef.current = fetcher;

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
  const snapshot = useSyncExternalStore(
    subscribe,
    () => (key ? store.get(key) : undefined),
    () => undefined,
  ) as Entry<T> | undefined;

  const load = useCallback(async () => {
    if (!key) return;
    const current = store.get(key) as Entry<T> | undefined;
    if (current?.promise) {
      await current.promise.catch(() => undefined);
      return;
    }
    const promise = fetcherRef.current();
    put<T>(key, { data: current?.data, error: current?.error ?? null, loading: true, stale: false, promise });
    try {
      const data = await promise;
      put<T>(key, { data, error: null, loading: false, stale: false });
    } catch (err) {
      put<T>(key, { data: current?.data, error: err as ApiError, loading: false, stale: false });
    }
  }, [key]);

  // Revalidate whenever a screen mounts or the key changes...
  useEffect(() => {
    void load();
  }, [load]);

  // ...and whenever something invalidated this key.
  const stale = snapshot?.stale ?? false;
  useEffect(() => {
    if (stale) void load();
  }, [stale, load]);

  return {
    data: snapshot?.data,
    error: snapshot?.error ?? null,
    loading: snapshot?.loading ?? !!key,
    reload: load,
    mutate: (data: T) => {
      if (key) setResource(key, data);
    },
  };
}

/* Read a value another component put in the store, without fetching anything. */
export function useStoredValue<T>(key: string): T | undefined {
  const subscribe = useCallback(
    (fn: () => void) => {
      const set = subscribers.get(key) ?? new Set<() => void>();
      set.add(fn);
      subscribers.set(key, set);
      return () => {
        set.delete(fn);
      };
    },
    [key],
  );
  const e = useSyncExternalStore(subscribe, () => store.get(key), () => undefined) as Entry<T> | undefined;
  return e?.data;
}
