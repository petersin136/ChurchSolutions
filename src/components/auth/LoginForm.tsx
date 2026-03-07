"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/contexts/AuthContext";

export default function LoginForm() {
  const router = useRouter();
  const { user, loading: authLoading } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!authLoading && user) router.replace("/");
  }, [user, authLoading, router]);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!supabase) {
      setError("서버 연결에 실패했습니다.");
      return;
    }
    setError("");
    setLoading(true);

    const { error: signInError } = await supabase.auth.signInWithPassword({
      email: email.trim(),
      password,
    });

    if (signInError) {
      setLoading(false);
      if (signInError.message.includes("Invalid login")) {
        setError("이메일 또는 비밀번호가 올바르지 않습니다.");
      } else if (signInError.message.includes("Email not confirmed")) {
        setError("이메일 인증이 필요합니다. 메일함을 확인해주세요.");
      } else {
        setError(signInError.message);
      }
      return;
    }

    router.replace("/");
  };

  if (authLoading) {
    return (
      <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", background: "#f8f7f4" }}>
        <div style={{ fontSize: 14, color: "#6b7280" }}>로딩 중...</div>
      </div>
    );
  }

  if (user) return null;

  return (
    <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", background: "#f8f7f4", padding: "0 16px" }}>
      <div style={{ width: "100%", maxWidth: 384 }}>
        <div style={{ textAlign: "center", marginBottom: 32 }}>
          <div style={{ fontSize: 48, marginBottom: 12 }}>⛪</div>
          <div style={{ fontSize: 24, fontWeight: 700, color: "#1b2a4a" }}>교역자 슈퍼플래너</div>
          <div style={{ fontSize: 14, color: "#6b7b9e", marginTop: 4 }}>교회 관리의 시작</div>
        </div>

        <form onSubmit={handleLogin} style={{ background: "#fff", borderRadius: 16, boxShadow: "0 1px 2px rgba(0,0,0,0.05)", border: "1px solid #e8e6e1", padding: 24 }}>
          <div style={{ marginBottom: 16 }}>
            <label style={{ display: "block", fontSize: 12, fontWeight: 500, color: "#6b7b9e", marginBottom: 6 }}>이메일</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="example@church.com"
              required
              autoComplete="email"
              style={{ width: "100%", padding: "10px 14px", borderRadius: 12, border: "1px solid #e8e6e1", fontSize: 14, outline: "none", boxSizing: "border-box" }}
            />
          </div>
          <div style={{ marginBottom: 16 }}>
            <label style={{ display: "block", fontSize: 12, fontWeight: 500, color: "#6b7b9e", marginBottom: 6 }}>비밀번호</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              required
              autoComplete="current-password"
              style={{ width: "100%", padding: "10px 14px", borderRadius: 12, border: "1px solid #e8e6e1", fontSize: 14, outline: "none", boxSizing: "border-box" }}
            />
          </div>

          {error ? (
            <div style={{ borderRadius: 12, background: "#fef2f2", border: "1px solid #fecaca", color: "#dc2626", fontSize: 12, padding: "10px 12px", marginBottom: 16 }}>
              {error}
            </div>
          ) : null}

          <button
            type="submit"
            disabled={loading}
            style={{
              width: "100%",
              padding: "12px 0",
              borderRadius: 12,
              backgroundColor: loading ? "#9ca3af" : "#1b2a4a",
              color: "#ffffff",
              fontSize: 14,
              fontWeight: 600,
              border: "none",
              cursor: loading ? "not-allowed" : "pointer",
              marginTop: 8,
            }}
          >
            {loading ? "로그인 중..." : "로그인"}
          </button>
        </form>

        <div style={{ textAlign: "center", fontSize: 12, color: "#6b7b9e", marginTop: 20 }}>
          계정이 없으신가요?{" "}
          <a href="/register" style={{ color: "#4361ee", fontWeight: 500, textDecoration: "none" }}>
            회원가입
          </a>
        </div>
      </div>
    </div>
  );
}
