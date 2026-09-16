"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { api } from "@/lib/api";
import { getUser, onUserChange, refreshSession, setSession, signOut } from "@/lib/auth";
import { onSync } from "@/lib/sync";
import type { User } from "@/types/api";

type Status = "loading" | "authenticated" | "anonymous" | "offline";

interface AuthValue {
  user: User | null;
  status: Status;
  login: (email: string, password: string) => Promise<void>;
  register: (fullName: string, email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  retry: () => void;
}

const AuthContext = createContext<AuthValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(getUser());
  const [status, setStatus] = useState<Status>("loading");
  const [attempt, setAttempt] = useState(0);

  useEffect(() => onUserChange((u) => {
    setUser(u);
    setStatus(u ? "authenticated" : "anonymous");
  }), []);

  // Signing in or out in another tab applies here too.
  useEffect(
    () =>
      onSync((msg) => {
        if (msg.type === "signout") setSession(null, { share: false });
        if (msg.type === "signin" && !getUser()) void refreshSession().catch(() => undefined);
      }),
    [],
  );

  // On load, trade the httpOnly refresh cookie for an in-memory access token.
  // Without the session hint cookie there is nothing to refresh.
  useEffect(() => {
    let cancelled = false;
    if (!/(?:^|;\s*)mmry_session=1(?:;|$)/.test(document.cookie)) {
      setStatus("anonymous");
      return;
    }
    refreshSession()
      .then((session) => !cancelled && setStatus(session ? "authenticated" : "anonymous"))
      .catch(() => !cancelled && setStatus("offline"));
    return () => {
      cancelled = true;
    };
  }, [attempt]);

  const login = useCallback(async (email: string, password: string) => {
    setSession(await api.auth.login({ email, password }));
  }, []);

  const register = useCallback(async (fullName: string, email: string, password: string) => {
    setSession(await api.auth.register({ fullName, email, password }));
  }, []);

  const logout = useCallback(async () => {
    await signOut();
  }, []);

  const value = useMemo(
    () => ({ user, status, login, register, logout, retry: () => setAttempt((n) => n + 1) }),
    [user, status, login, register, logout],
  );
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used inside <AuthProvider>");
  return ctx;
}
