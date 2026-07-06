"use client";

import Image from "next/image";
import { DASH_SIDEBAR } from "@/styles/pastoralDashboardTokens";

const CHURCHUP_LOGO = "/churchup-logo-black.png";

/** 사이드바 상단 — 처치업(church up) 워드마크 */
export function SidebarBrandMark({ onClick, compact = false }: { onClick?: () => void; compact?: boolean }) {
  const logoWidth = compact ? 42 : DASH_SIDEBAR.brandWidth;

  const mark = (
    <Image
      src={CHURCHUP_LOGO}
      alt="church up"
      width={1000}
      height={167}
      priority
      style={{
        width: logoWidth,
        height: "auto",
        display: "block",
        maxWidth: "100%",
      }}
    />
  );

  const innerStyle = {
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    width: compact ? "100%" : "fit-content",
    maxWidth: "100%",
  } as const;

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
        textAlign: "center",
      }}
    >
      {mark}
    </button>
  );
}
