"use client";

import Image from "next/image";
import { DASH_SIDEBAR } from "@/styles/pastoralDashboardTokens";

const DEFAULT_APP_ICON = "/icons/icon-192x192.png";

/** 처치업 앱 아이콘 — 회색 스쿼클 + 흰 up (시안·프로필·접힘 헤더 공통) */
export function ChurchUpAppIcon({ size = DASH_SIDEBAR.profileIconSize }: { size?: number }) {
  const inner = Math.round(size * DASH_SIDEBAR.profileIconInnerRatio);

  return (
    <span
      style={{
        width: size,
        height: size,
        borderRadius: DASH_SIDEBAR.profileIconRadius,
        background: DASH_SIDEBAR.profileIconBg,
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        overflow: "hidden",
        flexShrink: 0,
      }}
    >
      <Image
        src={DEFAULT_APP_ICON}
        alt=""
        width={192}
        height={192}
        style={{
          width: inner,
          height: inner,
          objectFit: "contain",
          display: "block",
          transform: `rotate(${DASH_SIDEBAR.appIconRotateDeg}deg)`,
          mixBlendMode: "lighten",
        }}
      />
    </span>
  );
}
