"use client";
import React from "react";
import { Wallet, Users, Heart, Sparkles, TrendingUp, Calendar } from "lucide-react";

function Sparkline({ color = "#E76F51" }: { color?: string }) {
  return (
    <svg width="100%" height="40" viewBox="0 0 200 40" preserveAspectRatio="none" style={{ display: "block" }}>
      <defs>
        <linearGradient id="spark-grad" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity="0.25" />
          <stop offset="100%" stopColor={color} stopOpacity="0" />
        </linearGradient>
      </defs>
      <path d="M0,30 L25,28 L50,24 L75,26 L100,18 L125,20 L150,12 L175,14 L200,6 L200,40 L0,40 Z" fill="url(#spark-grad)" />
      <path d="M0,30 L25,28 L50,24 L75,26 L100,18 L125,20 L150,12 L175,14 L200,6" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

const cardBase: React.CSSProperties = {
  background: "#FFFFFF",
  border: "1px solid #E8E2D8",
  borderRadius: 16,
  padding: 20,
  boxShadow: "0 1px 2px rgba(60,40,20,0.04), 0 4px 12px rgba(60,40,20,0.06)",
  display: "flex",
  flexDirection: "column",
  gap: 12,
};

const labelStyle: React.CSSProperties = {
  fontSize: 13,
  fontWeight: 500,
  color: "#6B6B6B",
  letterSpacing: "-0.01em",
};

const subStyle: React.CSSProperties = {
  fontSize: 12,
  color: "#6B6B6B",
};

const trendUp: React.CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  gap: 4,
  fontSize: 12,
  fontWeight: 600,
  color: "#2D7A4A",
  background: "#EAF4EC",
  padding: "2px 6px",
  borderRadius: 4,
};

const iconBox = (bg: string, fg: string): React.CSSProperties => ({
  width: 36,
  height: 36,
  borderRadius: 10,
  background: bg,
  color: fg,
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  flexShrink: 0,
});

export function DevWave6BentoDemo() {
  return (
    <section style={{ padding: 24, display: "flex", flexDirection: "column", gap: 24, background: "#FAFAFA" }}>
      <h2 style={{ fontSize: 20, fontWeight: 700 }}>Wave 6 — Bento Layout (대안)</h2>
      <p style={{ fontSize: 13, color: "#6B6B6B", marginTop: -12 }}>
        카드 크기를 차별화해서 시각적 위계를 만든 레이아웃. 메인 KPI는 크게, 보조 지표는 작게.
      </p>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(4, 1fr)",
          gridAutoRows: "minmax(120px, auto)",
          gap: 16,
        }}
      >
        <div
          style={{
            ...cardBase,
            gridColumn: "span 2",
            gridRow: "span 2",
            padding: 24,
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <div style={iconBox("#FCE8D5", "#E76F51")}>
              <Wallet size={18} />
            </div>
            <span style={labelStyle}>이번달 헌금</span>
          </div>
          <div style={{ fontSize: 44, fontWeight: 700, color: "#1A1A1A", letterSpacing: "-0.02em", lineHeight: 1.05, marginTop: 4 }}>
            ₩12,450,000
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 4 }}>
            <span style={trendUp}>▲ 8.2%</span>
            <span style={subStyle}>지난달 대비</span>
          </div>
          <div style={{ marginTop: "auto", paddingTop: 12 }}>
            <Sparkline color="#E76F51" />
          </div>
        </div>

        <div style={{ ...cardBase, gridColumn: "span 2" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <div style={iconBox("#EAF4EC", "#5B8B6A")}>
              <Users size={18} />
            </div>
            <span style={labelStyle}>금주 출석률</span>
          </div>
          <div style={{ display: "flex", alignItems: "baseline", gap: 12 }}>
            <div style={{ fontSize: 32, fontWeight: 700, color: "#1A1A1A", letterSpacing: "-0.02em", lineHeight: 1.1 }}>
              87%
            </div>
            <span style={trendUp}>▲ 3.1%</span>
            <span style={{ ...subStyle, marginLeft: "auto" }}>312 / 358명</span>
          </div>
        </div>

        <div style={cardBase}>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <div style={iconBox("#FDF6E3", "#C9A227")}>
              <Sparkles size={16} />
            </div>
            <span style={labelStyle}>새가족</span>
          </div>
          <div style={{ fontSize: 28, fontWeight: 700, color: "#1A1A1A", letterSpacing: "-0.02em", lineHeight: 1.1 }}>
            5명
          </div>
          <span style={subStyle}>정착 진행중</span>
        </div>

        <div style={cardBase}>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <div style={iconBox("#F1EFEC", "#6B6B6B")}>
              <Calendar size={16} />
            </div>
            <span style={labelStyle}>다음 일정</span>
          </div>
          <div style={{ fontSize: 28, fontWeight: 700, color: "#1A1A1A", letterSpacing: "-0.02em", lineHeight: 1.1 }}>
            3건
          </div>
          <span style={subStyle}>이번주 예정</span>
        </div>

        <div style={cardBase}>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <div style={iconBox("#F5E8F0", "#A26B8E")}>
              <Heart size={16} />
            </div>
            <span style={labelStyle}>심방</span>
          </div>
          <div style={{ fontSize: 28, fontWeight: 700, color: "#1A1A1A", letterSpacing: "-0.02em", lineHeight: 1.1 }}>
            24건
          </div>
          <span style={subStyle}>이번주</span>
        </div>

        <div style={cardBase}>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <div style={iconBox("#E8EEF7", "#4466E0")}>
              <TrendingUp size={16} />
            </div>
            <span style={labelStyle}>기도제목</span>
          </div>
          <div style={{ fontSize: 28, fontWeight: 700, color: "#1A1A1A", letterSpacing: "-0.02em", lineHeight: 1.1 }}>
            18건
          </div>
          <span style={subStyle}>함께 기도</span>
        </div>

        <div style={{ ...cardBase, gridColumn: "span 2" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <div style={iconBox("#FBEAEA", "#C44545")}>
              <Users size={18} />
            </div>
            <span style={labelStyle}>3주 연속 결석</span>
          </div>
          <div style={{ display: "flex", alignItems: "baseline", gap: 12 }}>
            <div style={{ fontSize: 32, fontWeight: 700, color: "#1A1A1A", letterSpacing: "-0.02em", lineHeight: 1.1 }}>
              7명
            </div>
            <span style={{ ...subStyle, marginLeft: "auto" }}>심방 우선 대상</span>
          </div>
        </div>
      </div>

      <p style={{ fontSize: 12, color: "#9B9B9B", marginTop: 8 }}>
        ※ 위는 정적 데모입니다. 실제 적용 시 각 페이지의 데이터로 연결됩니다.
      </p>
    </section>
  );
}
