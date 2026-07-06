"use client";

import Image from "next/image";
import { DASH_COLOR, DASH_GLOBAL, DASH_SIDEBAR } from "@/styles/pastoralDashboardTokens";

/** 처치업 앱 아이콘 — Garb 마크 (사이드바 하단 프로필과 동일) */
const GARB_APP_ICON = "/icons/icon-192x192.png";

/**
 * 실험 워드마크: "church" 텍스트 + Garb 앱 아이콘(네모 up 로고).
 * 아이콘은 시계방향 45° 회전해 up 글자가 수평이 되도록 한다.
 */
export function SidebarBrandMark({ onClick }: { onClick?: () => void }) {
  const box = DASH_SIDEBAR.appIconSize;
  const inner = Math.round(box * DASH_SIDEBAR.appIconInnerRatio);

  const innerStyle = {
    display: "flex",
    alignItems: "center",
    gap: DASH_SIDEBAR.appIconGap,
    width: "fit-content",
    maxWidth: "100%",
  } as const;

  const mark = (
    <>
      <span
        style={{
          fontFamily: DASH_GLOBAL.fontLatin,
          fontSize: DASH_SIDEBAR.churchTextSize,
          fontWeight: DASH_SIDEBAR.churchTextWeight,
          letterSpacing: "-0.045em",
          color: DASH_COLOR.ink,
          lineHeight: 1,
          flexShrink: 0,
        }}
      >
        church
      </span>
      <span
        style={{
          width: box,
          height: box,
          flexShrink: 0,
          display: "inline-flex",
          alignItems: "center",
          justifyContent: "center",
        }}
        aria-label="Garb"
        title="Garb"
      >
        <Image
          src={GARB_APP_ICON}
          alt=""
          width={192}
          height={192}
          priority
          style={{
            width: inner,
            height: inner,
            display: "block",
            borderRadius: Math.round(inner * 0.22),
            transform: `rotate(${DASH_SIDEBAR.appIconRotateDeg}deg)`,
          }}
        />
      </span>
    </>
  );

  if (!onClick) {
    return <div style={innerStyle}>{mark}</div>;
  }

  return (
    <button
      type="button"
      onClick={onClick}
      aria-label="홈으로 이동"
      title="홈으로 이동"
      style={{
        ...innerStyle,
        border: "none",
        background: "transparent",
        padding: 0,
        margin: 0,
        cursor: "pointer",
        font: "inherit",
        textAlign: "left",
      }}
    >
      {mark}
    </button>
  );
}
