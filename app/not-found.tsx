import Link from "next/link";

export default function NotFound() {
  return (
    <div
      style={{
        minHeight: "100vh",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        padding: 24,
        fontFamily: "system-ui, sans-serif",
        background: "var(--bg, #F2F2F7)",
        color: "var(--text1, #1C1C1E)",
      }}
    >
      <p style={{ fontSize: 48, fontWeight: 700, marginBottom: 8 }}>404</p>
      <p style={{ fontSize: 17, color: "var(--text2, #8E8E93)", marginBottom: 24 }}>
        이 페이지를 찾을 수 없습니다.
      </p>
      <Link
        href="/"
        style={{
          display: "inline-block",
          padding: "12px 24px",
          background: "#007AFF",
          color: "#fff",
          borderRadius: 9999,
          fontWeight: 600,
          textDecoration: "none",
        }}
      >
        ⛪ 슈퍼플래너 홈으로
      </Link>
    </div>
  );
}
