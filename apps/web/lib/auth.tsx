"use client";

import type { MeDto } from "@billy/shared";
import { useRouter } from "next/navigation";
import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from "react";
import { api, getToken, setToken } from "./api";

interface AuthState {
  me: MeDto | null;
  loading: boolean;
  refresh: () => Promise<MeDto | null>;
  login: (token: string, me: MeDto) => void;
  logout: () => void;
  setMe: (me: MeDto) => void;
}

const AuthContext = createContext<AuthState | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [me, setMe] = useState<MeDto | null>(null);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    if (!getToken()) {
      setMe(null);
      setLoading(false);
      return null;
    }
    try {
      const user = await api<MeDto>("/me");
      setMe(user);
      return user;
    } catch {
      setMe(null);
      return null;
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refresh();
    const onLogout = () => setMe(null);
    window.addEventListener("billy:logout", onLogout);
    return () => window.removeEventListener("billy:logout", onLogout);
  }, [refresh]);

  const login = useCallback((token: string, user: MeDto) => {
    setToken(token);
    setMe(user);
  }, []);

  const logout = useCallback(() => {
    setToken(null);
    setMe(null);
  }, []);

  return (
    <AuthContext.Provider value={{ me, loading, refresh, login, logout, setMe }}>{children}</AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used inside AuthProvider");
  return ctx;
}

/**
 * For pages that need a logged-in user with a finished profile.
 * Sends people to /login or /onboarding as needed.
 */
export function useRequireUser(opts: { allowIncompleteProfile?: boolean } = {}) {
  const auth = useAuth();
  const router = useRouter();
  useEffect(() => {
    if (auth.loading) return;
    if (!auth.me) router.replace("/login");
    else if (!opts.allowIncompleteProfile && (!auth.me.name || !auth.me.username)) router.replace("/onboarding");
  }, [auth.loading, auth.me, opts.allowIncompleteProfile, router]);
  return auth;
}
