"use client";

import { useState, useRef } from "react";
import { useAuth } from "@/contexts/AuthContext";

export default function RegisterForm() {
  const isRegistering = useRef(false);
  const { loading: authLoading, setRegistering } = useAuth();
  const [churchName, setChurchName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();

    const trimmedChurch = churchName.trim();
    const trimmedEmail = email.trim();

    if (!trimmedChurch) {
      setError("교회 이름을 입력해주세요.");
      return;
    }
    if (password.length < 6) {
      setError("비밀번호는 6자 이상이어야 합니다.");
      return;
    }
    if (password !== confirmPassword) {
      setError("비밀번호가 일치하지 않습니다.");
      return;
    }

    setError("");
    setLoading(true);
    setRegistering(true);
    isRegistering.current = true;

    try {
      const res = await fetch("/api/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: trimmedEmail,
          password,
          churchName: trimmedChurch,
        }),
      });

      const result = await res.json();

      if (!res.ok) {
        setError(result.error ?? "회원가입에 실패했습니다.");
        setLoading(false);
        return;
      }

      setSuccess(true);
    } catch (err) {
      setError("회원가입 중 오류가 발생했습니다.");
      console.error(err);
      isRegistering.current = false;
    } finally {
      setRegistering(false);
      setLoading(false);
      isRegistering.current = false;
    }
  };

  if (authLoading) {
    return (
      <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", background: "#f0f0f2" }}>
        <div style={{ fontSize: 14, color: "#9ca3af" }}>로딩 중...</div>
      </div>
    );
  }

  const Brand = (
    <div style={{ textAlign: "center", marginBottom: 28 }}>
      <div style={{ color: "#0B0C0E", fontWeight: 800, fontSize: 40, letterSpacing: -1, lineHeight: 1.2 }}>
        church u<span style={{ display: "inline-block", transform: "translateY(-0.2em)" }}>p</span>
      </div>
      <div style={{ marginTop: 12, fontSize: 14 }}>
        <span style={{ color: "#6b7280", fontWeight: 500 }}>행정은 가볍게 </span>
        <span style={{ color: "#0B0C0E", fontWeight: 700 }}>시선은 목양에</span>
      </div>
    </div>
  );

  if (success) {
    return (
      <div style={pageStyle}>
        {styleTag}
        <div style={cardStyle}>
          {Brand}
          <div style={{ textAlign: "center" }}>
            <div
              style={{
                width: 44,
                height: 44,
                margin: "0 auto 16px",
                borderRadius: "50%",
                background: "#0B0C0E",
                color: "#ffffff",
                fontSize: 22,
                fontWeight: 700,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              ✓
            </div>
            <div style={{ fontSize: 16, fontWeight: 700, color: "#0B0C0E" }}>회원가입 완료</div>
            <div style={{ marginTop: 8, fontSize: 13, lineHeight: 1.5, color: "#9ca3af" }}>
              이메일 인증 후 로그인할 수 있습니다.
              <br />
              메일함을 확인해 주세요.
            </div>
            <a
              href="/login"
              style={{
                display: "block",
                width: "100%",
                height: 52,
                lineHeight: "52px",
                marginTop: 24,
                borderRadius: 4,
                background: "#0B0C0E",
                color: "#ffffff",
                fontSize: 15,
                fontWeight: 700,
                textDecoration: "none",
                textAlign: "center",
              }}
            >
              로그인 페이지로
            </a>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div style={pageStyle}>
      {styleTag}
      <div style={cardStyle}>
        {Brand}

        <div style={{ textAlign: "center", marginBottom: 24 }}>
          <div style={{ fontSize: 15, fontWeight: 700, color: "#0B0C0E" }}>회원가입</div>
          <div style={{ marginTop: 8, fontSize: 13, lineHeight: 1.5, color: "#9ca3af" }}>
            교회와 관리자 계정을 생성합니다.
          </div>
        </div>

        <form onSubmit={handleRegister} noValidate>
          <input
            className="cu-input"
            type="text"
            value={churchName}
            onChange={(e) => {
              setChurchName(e.target.value);
              if (error) setError("");
            }}
            placeholder="교회 이름"
            required
            style={inputStyle}
          />
          <div style={{ height: 12 }} />
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
            placeholder="비밀번호 (6자 이상)"
            required
            autoComplete="new-password"
            style={inputStyle}
          />
          <div style={{ height: 12 }} />
          <input
            className="cu-input"
            type="password"
            value={confirmPassword}
            onChange={(e) => {
              setConfirmPassword(e.target.value);
              if (error) setError("");
            }}
            placeholder="비밀번호 확인"
            required
            autoComplete="new-password"
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
            {loading ? "가입 중..." : "회원가입"}
          </button>
        </form>

        <div style={{ textAlign: "center", fontSize: 13, marginTop: 20 }}>
          <span style={{ color: "#9ca3af" }}>이미 계정이 있으신가요? </span>
          <a href="/login" className="cu-link-strong" style={{ color: "#0B0C0E", fontWeight: 700, textDecoration: "none" }}>
            로그인
          </a>
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
  padding: "40px 16px",
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
    .cu-link-strong { transition: opacity .12s ease; }
    .cu-link-strong:hover { opacity: .65; }
  `}</style>
);
