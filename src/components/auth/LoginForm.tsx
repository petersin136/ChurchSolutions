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
  const [keepLoggedIn, setKeepLoggedIn] = useState(false);

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
      <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", background: PAGE_BG }}>
        <div style={{ fontSize: 14, color: "#9ca3af" }}>로딩 중...</div>
      </div>
    );
  }

  if (user) return null;

  const Brand = (
    <div style={{ textAlign: "center", marginBottom: 40 }}>
      <div style={{ color: "#111111", fontWeight: 800, fontSize: 40, letterSpacing: -1, lineHeight: 1.2 }}>
        church u<span style={{ display: "inline-block", transform: "translateY(-0.2em)" }}>p</span>
      </div>
      <div style={{ marginTop: 12, fontSize: 14 }}>
        <span style={{ color: "#6b7280", fontWeight: 500 }}>행정은 가볍게 </span>
        <span style={{ color: "#111111", fontWeight: 700 }}>시선은 목양에</span>
      </div>
    </div>
  );

  return (
    <div style={pageStyle}>
      {styleTag}
      <div style={cardStyle}>
        {Brand}

        <form onSubmit={handleLogin} noValidate>
          <input
            className="cu-input"
            type="email"
            value={email}
            onChange={(e) => {
              setEmail(e.target.value);
              if (error) setError("");
            }}
            placeholder="이메일 주소"
            required
            autoComplete="email"
            style={inputStyle}
          />
          <div style={{ height: 12 }} />
          <input
            className="cu-input"
            type="password"
            value={password}
            onChange={(e) => {
              setPassword(e.target.value);
              if (error) setError("");
            }}
            placeholder="비밀번호"
            required
            autoComplete="current-password"
            style={inputStyle}
          />

          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginTop: 14 }}>
            <label style={{ display: "inline-flex", alignItems: "center", gap: 8, cursor: "pointer", userSelect: "none" }}>
              <input
                type="checkbox"
                checked={keepLoggedIn}
                onChange={(e) => setKeepLoggedIn(e.target.checked)}
                style={{ position: "absolute", opacity: 0, width: 0, height: 0 }}
              />
              <span
                style={{
                  width: 16,
                  height: 16,
                  borderRadius: 4,
                  flexShrink: 0,
                  display: "inline-flex",
                  alignItems: "center",
                  justifyContent: "center",
                  background: keepLoggedIn ? "#111111" : "#ffffff",
                  border: keepLoggedIn ? "1px solid #111111" : "1px solid #c4c4c8",
                }}
              >
                {keepLoggedIn ? (
                  <svg width="10" height="10" viewBox="0 0 12 12" fill="none">
                    <path d="M2.5 6.2l2.3 2.3 4.7-4.9" stroke="#ffffff" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                ) : null}
              </span>
              <span style={{ fontSize: 13, color: keepLoggedIn ? "#111111" : "#6b7280", fontWeight: keepLoggedIn ? 600 : 400 }}>
                로그인 상태 유지
              </span>
            </label>

            <button
              type="button"
              className="cu-link"
              onClick={() => router.push("/forgot-password")}
              style={{ background: "none", border: "none", fontSize: 13, color: "#9ca3af", cursor: "pointer" }}
            >
              비밀번호 찾기
            </button>
          </div>

          {error ? (
            <div style={{ display: "flex", alignItems: "center", gap: 6, marginTop: 12, color: "#e02424", fontSize: 13 }}>
              <span
                style={{
                  width: 16,
                  height: 16,
                  borderRadius: "50%",
                  background: "#e02424",
                  color: "#ffffff",
                  fontSize: 11,
                  fontWeight: 700,
                  display: "inline-flex",
                  alignItems: "center",
                  justifyContent: "center",
                  flexShrink: 0,
                }}
              >
                !
              </span>
              {error}
            </div>
          ) : null}

          <button
            type="submit"
            disabled={loading}
            style={{
              width: "100%",
              height: 52,
              marginTop: 18,
              borderRadius: 4,
              background: loading ? "#3a3a3a" : "#111111",
              color: "#ffffff",
              fontSize: 15,
              fontWeight: 700,
              border: "none",
              cursor: loading ? "not-allowed" : "pointer",
            }}
          >
            {loading ? "로그인 중..." : "로그인"}
          </button>
        </form>

        <div style={{ textAlign: "center", fontSize: 13, marginTop: 20 }}>
          <span style={{ color: "#9ca3af" }}>계정이 없으신가요? </span>
          <a href="/register" className="cu-link-strong" style={{ color: "#111111", fontWeight: 700, textDecoration: "none" }}>
            회원가입
          </a>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: 12, margin: "28px 0 20px" }}>
          <div style={{ flex: 1, height: 1, background: "#ebebeb" }} />
          <span style={{ fontSize: 12, color: "#9ca3af" }}>SNS 계정으로 시작</span>
          <div style={{ flex: 1, height: 1, background: "#ebebeb" }} />
        </div>

        <button
          type="button"
          className="cu-social"
          onClick={() => alert("카카오 로그인은 준비 중입니다")}
          style={{ ...socialBtnBase, background: "#FEE500", color: "#111111" }}
        >
          <span style={{ position: "absolute", left: 18, fontSize: 16, fontWeight: 800 }}>K</span>
          카카오로 시작하기
        </button>

        <div style={{ height: 10 }} />

        <button
          type="button"
          className="cu-social"
          onClick={() => alert("구글 로그인은 준비 중입니다")}
          style={{ ...socialBtnBase, background: "#ebebeb", color: "#111111" }}
        >
          <span style={{ position: "absolute", left: 18, fontSize: 16, fontWeight: 800 }}>G</span>
          구글로 시작하기
        </button>
      </div>
    </div>
  );
}

const PAGE_BG = "#f0f0f2";

const pageStyle: React.CSSProperties = {
  minHeight: "100vh",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  background: PAGE_BG,
  padding: "24px 16px",
};

const cardStyle: React.CSSProperties = {
  width: "100%",
  maxWidth: 420,
  background: "#ffffff",
  borderRadius: 12,
  padding: "48px 40px",
  boxSizing: "border-box",
};

const inputStyle: React.CSSProperties = {
  width: "100%",
  height: 52,
  padding: "0 16px",
  borderRadius: 4,
  border: "1px solid transparent",
  background: "#ebebeb",
  color: "#111111",
  fontSize: 15,
  outline: "none",
  boxSizing: "border-box",
};

const socialBtnBase: React.CSSProperties = {
  width: "100%",
  height: 52,
  borderRadius: 4,
  fontSize: 15,
  fontWeight: 700,
  border: "none",
  cursor: "pointer",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  position: "relative",
};

const styleTag = (
  <style>{`
    .cu-input { transition: border-color .12s ease; }
    .cu-input::placeholder { color: #9ca3af; }
    .cu-input:focus { border-color: #111111; }
    .cu-input:-webkit-autofill,
    .cu-input:-webkit-autofill:hover,
    .cu-input:-webkit-autofill:focus,
    .cu-input:-webkit-autofill:active {
      -webkit-text-fill-color: #111111;
      -webkit-box-shadow: 0 0 0 1000px #ebebeb inset;
      box-shadow: 0 0 0 1000px #ebebeb inset;
      caret-color: #111111;
      transition: background-color 9999s ease-in-out 0s;
    }
    .cu-link { transition: color .12s ease; }
    .cu-link:hover, .cu-link:active { color: #111111; }
    .cu-link-strong { transition: opacity .12s ease; }
    .cu-link-strong:hover { opacity: .65; }
    .cu-social { transition: transform .06s ease, filter .12s ease; }
    .cu-social:hover { filter: brightness(.97); }
    .cu-social:active { transform: translateY(1px); }
  `}</style>
);
