"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";

export default function ForgotPasswordForm() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [error, setError] = useState("");
  const [sent, setSent] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!supabase) {
      setError("서버 연결에 실패했습니다.");
      return;
    }
    setError("");
    setLoading(true);

    const { error: resetError } = await supabase.auth.resetPasswordForEmail(email.trim(), {
      redirectTo: typeof window !== "undefined" ? `${window.location.origin}/login` : undefined,
    });

    setLoading(false);
    if (resetError) {
      setError(resetError.message);
      return;
    }
    setSent(true);
  };

  return (
    <div style={pageStyle}>
      {styleTag}
      <div style={cardStyle}>
        <div style={{ textAlign: "center", marginBottom: 40 }}>
          <div style={{ color: "#0B0C0E", fontWeight: 800, fontSize: 40, letterSpacing: -1, lineHeight: 1.2 }}>
            church u<span style={{ display: "inline-block", transform: "translateY(-0.2em)" }}>p</span>
          </div>
          <div style={{ marginTop: 12, fontSize: 14 }}>
            <span style={{ color: "#6b7280", fontWeight: 500 }}>행정은 가볍게 </span>
            <span style={{ color: "#0B0C0E", fontWeight: 700 }}>시선은 목양에</span>
          </div>
        </div>

        <div style={{ textAlign: "center", marginBottom: 24 }}>
          <div style={{ fontSize: 15, fontWeight: 700, color: "#0B0C0E" }}>비밀번호 재설정</div>
          <div style={{ marginTop: 8, fontSize: 13, lineHeight: 1.5, color: "#9ca3af" }}>
            가입하신 이메일 주소를 입력하시면
            <br />
            재설정 링크를 보내드립니다.
          </div>
        </div>

        {sent ? (
          <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 18, color: "#0B0C0E", fontSize: 13 }}>
            <span
              style={{
                width: 16,
                height: 16,
                borderRadius: "50%",
                background: "#0B0C0E",
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
            재설정 링크를 보냈습니다. 메일함을 확인해 주세요.
          </div>
        ) : (
          <form onSubmit={handleSubmit} noValidate>
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
                background: loading ? "#3a3a3a" : "#0B0C0E",
                color: "#ffffff",
                fontSize: 15,
                fontWeight: 700,
                border: "none",
                cursor: loading ? "not-allowed" : "pointer",
              }}
            >
              {loading ? "전송 중..." : "재설정 링크 받기"}
            </button>
          </form>
        )}

        <div style={{ textAlign: "center", marginTop: 18 }}>
          <button
            type="button"
            className="cu-link"
            onClick={() => router.push("/login")}
            style={{ background: "none", border: "none", fontSize: 13, color: "#9ca3af", cursor: "pointer" }}
          >
            로그인 화면으로 돌아가기
          </button>
        </div>
      </div>
    </div>
  );
}

const pageStyle: React.CSSProperties = {
  minHeight: "100vh",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  background: "#f0f0f2",
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
  color: "#0B0C0E",
  fontSize: 15,
  outline: "none",
  boxSizing: "border-box",
};

const styleTag = (
  <style>{`
    .cu-input { transition: border-color .12s ease; }
    .cu-input::placeholder { color: #9ca3af; }
    .cu-input:focus { border-color: #0B0C0E; }
    .cu-input:-webkit-autofill,
    .cu-input:-webkit-autofill:hover,
    .cu-input:-webkit-autofill:focus,
    .cu-input:-webkit-autofill:active {
      -webkit-text-fill-color: #0B0C0E;
      -webkit-box-shadow: 0 0 0 1000px #ebebeb inset;
      box-shadow: 0 0 0 1000px #ebebeb inset;
      caret-color: #0B0C0E;
      transition: background-color 9999s ease-in-out 0s;
    }
    .cu-link { transition: color .12s ease; }
    .cu-link:hover, .cu-link:active { color: #0B0C0E; }
  `}</style>
);
