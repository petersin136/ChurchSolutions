"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { AuthCardShell } from "@/components/auth/AuthCardShell";

export default function EmailConfirmedForm() {
  const router = useRouter();

  useEffect(() => {
    if (!supabase) return;
    void supabase.auth.signOut();
  }, []);

  return (
    <AuthCardShell styleTag={styleTag}>
      <div style={{ textAlign: "center", marginBottom: 24 }}>
        <div style={{ fontSize: 15, fontWeight: 700, color: "var(--color-black)" }}>이메일 인증이 완료됐어요</div>
        <div style={{ marginTop: 8, fontSize: 13, lineHeight: 1.5, color: "var(--color-text-muted)" }}>
          이제 로그인 페이지에서 로그인해 주세요.
        </div>
      </div>

      <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 18, color: "var(--color-black)", fontSize: 13 }}>
        <span
          style={{
            width: 16,
            height: 16,
            borderRadius: "50%",
            background: "var(--color-black)",
            color: "#ffffff",
            fontSize: 11,
            fontWeight: 700,
            display: "inline-flex",
            alignItems: "center",
            justifyContent: "center",
            flexShrink: 0,
          }}
        >
          ✓
        </span>
        이메일 인증이 정상적으로 완료되었습니다.
      </div>

      <button
        type="button"
        onClick={() => router.push("/login")}
        style={{
          width: "100%",
          height: 52,
          borderRadius: 4,
          background: "var(--color-black)",
          color: "#ffffff",
          fontSize: 15,
          fontWeight: 700,
          border: "none",
          cursor: "pointer",
        }}
      >
        로그인하러 가기
      </button>
    </AuthCardShell>
  );
}

const styleTag = (
  <style>{`
    .cu-input { transition: border-color .12s ease; }
    .cu-input::placeholder { color: var(--color-text-faint); }
    .cu-input:focus { border-color: var(--color-black); }
    .cu-input:-webkit-autofill,
    .cu-input:-webkit-autofill:hover,
    .cu-input:-webkit-autofill:focus,
    .cu-input:-webkit-autofill:active {
      -webkit-text-fill-color: var(--color-black);
      -webkit-box-shadow: 0 0 0 1000px #ebebeb inset;
      box-shadow: 0 0 0 1000px #ebebeb inset;
      caret-color: var(--color-black);
      transition: background-color 9999s ease-in-out 0s;
    }
    .cu-link { transition: color .12s ease; }
    .cu-link:hover, .cu-link:active { color: var(--color-black); }
  `}</style>
);
