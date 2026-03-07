"use client";

import { createContext, useContext, useEffect, useState, useRef, useCallback, type ReactNode } from "react";
import { supabase } from "@/lib/supabase";
import type { User, Session } from "@supabase/supabase-js";

const CHURCH_ID_KEY = "church_solution_church_id";
const CHURCH_NAME_KEY = "church_solution_church_name";

interface AuthState {
  user: User | null;
  session: Session | null;
  churchId: string | null;
  churchName: string | null;
  loading: boolean;
  signOut: () => Promise<void>;
  setRegistering: (v: boolean) => void;
}

const AuthContext = createContext<AuthState>({
  user: null,
  session: null,
  churchId: null,
  churchName: null,
  loading: true,
  signOut: async () => {},
  setRegistering: () => {},
});

export function useAuth() {
  return useContext(AuthContext);
}

async function fetchChurchForUser(userId: string): Promise<{ churchId: string; churchName: string } | null> {
  if (!supabase) return null;
  const { data, error } = await supabase
    .from("church_users")
    .select("church_id, churches(name)")
    .eq("user_id", userId)
    .limit(1)
    .maybeSingle();
  console.log("[AuthContext] church_users 조회 결과:", { data, error: error?.message });
  if (error || !data) {
    console.warn("[AuthContext] church_users 조회 실패:", error?.message ?? "no data");
    return null;
  }
  const cid = data.church_id as string | null;
  if (!cid || cid === "null" || cid === "undefined") {
    console.warn("[AuthContext] church_users에 church_id 비어있음:", cid);
    return null;
  }
  const churchName = (data as Record<string, unknown>).churches
    ? ((data as Record<string, unknown>).churches as { name?: string })?.name ?? ""
    : "";
  return { churchId: cid, churchName };
}

export function AuthProvider({ children }: { children: ReactNode }) {
  // SSR과 클라이언트 첫 렌더 모두 동일한 초기값 (null/true)
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [churchId, setChurchId] = useState<string | null>(null);
  const [churchName, setChurchName] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [isRegistering, setIsRegistering] = useState(false);
  const isRegisteringRef = useRef(false);
  useEffect(() => {
    isRegisteringRef.current = isRegistering;
  }, [isRegistering]);

  const loadChurch = useCallback(async (userId: string) => {
    const result = await fetchChurchForUser(userId);
    if (result && result.churchId) {
      console.log("[AuthContext] church_users 조회 결과:", result);
      console.log("[AuthContext] 설정된 churchId:", result.churchId);
      setChurchId(result.churchId);
      setChurchName(result.churchName);
      if (typeof window !== "undefined") {
        localStorage.setItem(CHURCH_ID_KEY, result.churchId);
        if (result.churchName) localStorage.setItem(CHURCH_NAME_KEY, result.churchName);
      }
    } else {
      const envId = process.env.NEXT_PUBLIC_CHURCH_ID;
      if (envId && envId !== "undefined" && envId !== "null") {
        setChurchId(envId);
        if (typeof window !== "undefined") {
          localStorage.setItem(CHURCH_ID_KEY, envId);
        }
      }
    }
  }, []);

  // 클라이언트에서만 실행: auth 상태 + localStorage 읽기. 한 번만 구독, cleanup 필수.
  useEffect(() => {
    if (!supabase) {
      setLoading(false);
      return;
    }

    let cancelled = false;

    supabase.auth.getSession().then(async ({ data: { session: s } }) => {
      if (cancelled) return;
      setSession(s);
      setUser(s?.user ?? null);
      if (s?.user) {
        await loadChurch(s.user.id);
      } else {
        setChurchId(null);
        setChurchName(null);
        const cached = localStorage.getItem(CHURCH_ID_KEY);
        if (cached && cached !== "null" && cached !== "undefined") setChurchId(cached);
        const cachedName = localStorage.getItem(CHURCH_NAME_KEY);
        if (cachedName) setChurchName(cachedName);
      }
      if (!cancelled) {
        setLoading(false);
        console.log("[AuthContext] getSession 완료, loading=false, user=", !!s?.user);
      }
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(async (_event, s) => {
      if (cancelled) return;
      if (isRegisteringRef.current) {
        console.log("[AuthContext] 회원가입 중 - onAuthStateChange 무시");
        return;
      }
      if (typeof window !== "undefined" && window.location.pathname === "/register") {
        console.log("[AuthContext] /register 페이지에서는 자동 로드 스킵");
        setLoading(false);
        return;
      }
      setSession(s);
      setUser(s?.user ?? null);
      if (s?.user) {
        await loadChurch(s.user.id);
      } else {
        setChurchId(null);
        setChurchName(null);
        localStorage.removeItem(CHURCH_ID_KEY);
        localStorage.removeItem(CHURCH_NAME_KEY);
      }
    });

    return () => {
      cancelled = true;
      subscription.unsubscribe();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- 단일 구독 유지, StrictMode 대응
  }, []);

  const signOut = useCallback(async () => {
    try {
      if (supabase) await supabase.auth.signOut({ scope: "global" });
    } catch (e) {
      console.error("[signOut] supabase error:", e);
    }

    setUser(null);
    setSession(null);
    setChurchId(null);
    setChurchName(null);

    if (typeof window !== "undefined") {
      localStorage.clear();
    }

    if (typeof window !== "undefined") {
      sessionStorage.clear();
    }

    if (typeof document !== "undefined") {
      document.cookie.split(";").forEach((c) => {
        document.cookie = c.trim().split("=")[0] + "=;expires=Thu, 01 Jan 1970 00:00:00 GMT;path=/";
      });
    }

    if (typeof window !== "undefined" && window.indexedDB) {
      try {
        const databases = await window.indexedDB.databases();
        databases.forEach((db) => {
          if (db.name) window.indexedDB.deleteDatabase(db.name);
        });
      } catch (_) {
        // indexedDB.databases() 미지원 등
      }
    }

    window.location.replace("/login");
  }, []);

  return (
    <AuthContext.Provider value={{ user, session, churchId, churchName, loading, signOut, setRegistering: setIsRegistering }}>
      {children}
    </AuthContext.Provider>
  );
}
