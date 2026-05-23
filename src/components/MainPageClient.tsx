"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/contexts/AuthContext";
import dynamic from "next/dynamic";

const SuperPlanner = dynamic(() => import("@/components/SuperPlanner"), { ssr: false });

export default function MainPageClient() {
  const { user, churchId, loading, signOut } = useAuth();
  const router = useRouter();
  const [orphanState, setOrphanState] = useState<"idle" | "checking" | "signingOut">("idle");
  const signOutTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  console.log("[MainPage] loading:", loading, "user:", !!user, "churchId:", churchId);

  // 1) 비로그인 → /login
  useEffect(() => {
    if (!loading && !user) {
      router.replace("/login");
    }
  }, [loading, user, router]);

  // 2) 로그인은 됐는데 churchId 가 끝까지 null —
  //    DB에서 교회가 삭제된 계정이거나 church_users 매핑이 없는 경우.
  //    무한 blank 화면 방지를 위해 안내 화면 표시 후 자동 정리 → /login.
  useEffect(() => {
    if (loading) return;
    if (!user) return;
    if (churchId) {
      if (signOutTimerRef.current) {
        clearTimeout(signOutTimerRef.current);
        signOutTimerRef.current = null;
      }
      setOrphanState("idle");
      return;
    }
    if (orphanState !== "idle") return;
    setOrphanState("checking");
    signOutTimerRef.current = setTimeout(() => {
      setOrphanState("signingOut");
      console.warn("[MainPage] churchId 미결정 — 강제 정리 후 로그인 화면으로 이동");
      void signOut();
    }, 1500);
    return () => {
      if (signOutTimerRef.current) {
        clearTimeout(signOutTimerRef.current);
        signOutTimerRef.current = null;
      }
    };
  }, [loading, user, churchId, orphanState, signOut, router]);

  if (loading || !user) {
    return <div style={{ minHeight: "100vh" }} />;
  }

  if (!churchId) {
    return (
      <div
        style={{
          minHeight: "100vh",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          flexDirection: "column",
          gap: 12,
          padding: 24,
          background: "#FAFAFA",
          color: "#374151",
          fontFamily: "Inter, system-ui, sans-serif",
          textAlign: "center",
        }}
      >
        <div style={{ fontSize: 16, fontWeight: 600 }}>
          연결된 교회 정보를 찾을 수 없습니다.
        </div>
        <div style={{ fontSize: 13, color: "#6B7280", maxWidth: 420 }}>
          이 계정은 더 이상 등록된 교회와 연결되어 있지 않습니다. 잠시 후 로그인
          화면으로 이동합니다.
        </div>
        <button
          type="button"
          onClick={() => {
            // ⚠️ supabase 응답을 기다리지 않고 즉시 강제 이동.
            //    네트워크/Supabase 가 느려도 사용자가 반드시 빠져나갈 수 있어야 함.
            void signOut();
            try {
              if (typeof window !== "undefined") {
                localStorage.clear();
                sessionStorage.clear();
              }
            } catch {}
            setTimeout(() => {
              if (typeof window !== "undefined") {
                window.location.replace("/login");
              }
            }, 50);
          }}
          style={{
            marginTop: 6,
            padding: "8px 16px",
            border: "1px solid #D1D5DB",
            borderRadius: 8,
            background: "#FFFFFF",
            color: "#374151",
            fontSize: 13,
            cursor: "pointer",
          }}
        >
          지금 로그인 화면으로 이동
        </button>
      </div>
    );
  }

  return <SuperPlanner />;
}
