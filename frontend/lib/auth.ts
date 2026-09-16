/*
 * Session handling on the client.
 *
 * The access token lives only in memory (never localStorage), so an injected
 * script cannot read a long-lived credential from storage. The refresh token
 * is an httpOnly cookie scoped to /api/v1/auth that JavaScript cannot see;
 * /auth/refresh swaps it for a new access token.
 */
import { broadcast } from "@/lib/sync";
import type { SessionResponse, User } from "@/types/api";

export const CSRF_HEADER = "x-mmry-csrf";

let accessToken: string | null = null;
let currentUser: User | null = null;
let refreshing: Promise<SessionResponse | null> | null = null;
const listeners = new Set<(user: User | null) => void>();

export function getAccessToken(): string | null {
  return accessToken;
}

export function getUser(): User | null {
  return currentUser;
}

export function setSession(session: SessionResponse | null, { share = true } = {}): void {
  const wasSignedIn = currentUser !== null;
  accessToken = session?.accessToken ?? null;
  currentUser = session?.user ?? null;
  listeners.forEach((fn) => fn(currentUser));
  if (share && wasSignedIn && !currentUser) broadcast({ type: "signout" });
  if (share && !wasSignedIn && currentUser) broadcast({ type: "signin" });
}

export function onUserChange(fn: (user: User | null) => void): () => void {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

async function requestRefresh(): Promise<SessionResponse | null> {
  const res = await fetch("/api/v1/auth/refresh", {
    method: "POST",
    credentials: "same-origin",
    headers: { [CSRF_HEADER]: "1" },
    cache: "no-store",
  });
  if (res.ok) return (await res.json()) as SessionResponse;
  if (res.status === 401 || res.status === 403) return null;
  throw new Error(`refresh failed with ${res.status}`);
}

/*
 * Single-flight: concurrent callers share one refresh. If another tab rotated
 * the cookie a moment earlier the first attempt is rejected, so one retry
 * after a short pause picks up the new cookie.
 */
export function refreshSession(): Promise<SessionResponse | null> {
  refreshing ??= (async () => {
    try {
      let session = await requestRefresh();
      if (!session) {
        await new Promise((r) => setTimeout(r, 400));
        session = await requestRefresh();
      }
      setSession(session);
      return session;
    } finally {
      refreshing = null;
    }
  })();
  return refreshing;
}

export async function signOut(): Promise<void> {
  try {
    await fetch("/api/v1/auth/logout", { method: "POST", credentials: "same-origin", headers: { [CSRF_HEADER]: "1" } });
  } finally {
    setSession(null);
  }
}
