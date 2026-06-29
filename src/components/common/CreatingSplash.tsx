"use client";

export function CreatingSplash() {
  return (
    <div
      style={{
        minHeight: "100vh",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        flexDirection: "column",
        gap: 20,
        background: "#FAFAFA",
        fontFamily: "var(--font-sans)",
        textAlign: "center",
        padding: 24,
      }}
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src="/churchup-logo.png"
        alt="church up"
        style={{ height: 32, opacity: 0.9 }}
      />
      <div
        style={{
          width: 28,
          height: 28,
          border: "3px solid #E5E7EB",
          borderTopColor: "#374151",
          borderRadius: "50%",
          animation: "creatingspin 0.8s linear infinite",
        }}
      />
      <div style={{ fontSize: 16, fontWeight: 600, color: "#374151" }}>
        교회를 생성하고 있어요
      </div>
      <div style={{ fontSize: 13, color: "#6B7280" }}>
        잠시만 기다려 주세요. 시간이 조금 걸릴 수 있어요.
      </div>
      <style>{`
        @keyframes creatingspin {
          to { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  );
}
