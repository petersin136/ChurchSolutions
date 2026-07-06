"use client";

import Image from "next/image";
import { DASH_SIDEBAR } from "@/styles/pastoralDashboardTokens";

const DEFAULT_APP_ICON = "/icons/icon-192x192.png";

type ChurchUpAppIconProps = {
  size?: number;
  /** full: 실제 앱 아이콘 그대로 · muted: 회색 박스 + lighten (접힘 헤더 등) */
  variant?: "full" | "muted";
};

/** 처치업 앱 아이콘 — 프로필·접힘 헤더 등 */
export function ChurchUpAppIcon({
  size = DASH_SIDEBAR.profileIconSize,
  variant = "muted",
}: ChurchUpAppIconProps) {
  if (variant === "full") {
    return (
      <span
        style={{
          width: size,
          height: size,
          borderRadius: DASH_SIDEBAR.profileIconRadius,
          overflow: "hidden",
          flexShrink: 0,
          display: "inline-flex",
          alignItems: "center",
          justifyContent: "center",
          background: "#0b0c0e",
        }}
      >
        <Image
          src={DEFAULT_APP_ICON}
          alt="church up"
          width={192}
          height={192}
          style={{
            width: size,
            height: size,
            objectFit: "cover",
            display: "block",
          }}
        />
      </span>
    );
  }

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
