"use client";

import dynamic from "next/dynamic";

const SuperPlanner = dynamic(() => import("@/components/SuperPlanner"), {
  ssr: false,
  loading: () => (
    <div
      style={{
        minHeight: "100vh",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        fontFamily: "system-ui",
        background: "#F2F2F7",
      }}
    >
      <div style={{ textAlign: "center" }}>
        <p style={{ fontSize: 40, marginBottom: 8 }}>⛪</p>
        <p style={{ fontSize: 17, fontWeight: 600, color: "#1C1C1E" }}>
          슈퍼플래너 로딩 중…
        </p>
      </div>
    </div>
  ),
});

export default function Home() {
  return <SuperPlanner />;
}
