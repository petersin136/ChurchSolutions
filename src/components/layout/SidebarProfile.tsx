"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import { DASH_SIDEBAR } from "@/styles/pastoralDashboardTokens";
import { ChurchUpAppIcon } from "@/components/layout/ChurchUpAppIcon";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/lib/supabase";

interface SidebarProfileProps {
  /** 사이드바 펼침 여부 — 접힘(64px)일 땐 아바타만 표시 */
  expanded: boolean;
  /** useAuth().churchName 이 비어 있을 때 대체 교회명(예: 설정의 churchName) */
  churchNameFallback?: string;
  /** 사용자 지정 프로필 이미지 URL — 없으면 처치업 앱 아이콘 */
  avatarUrl?: string | null;
}

/**
 * 사이드바 하단 프로필 — [앱 아이콘] + 교회명 + 계정명
 */
export function SidebarProfile({ expanded, churchNameFallback, avatarUrl }: SidebarProfileProps) {
  const { user, churchId, churchName } = useAuth();
  const [role, setRole] = useState<string>("");

  useEffect(() => {
    if (!user || !churchId || !supabase) {
      setRole("");
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        const [churchUserRes, userRolesRes] = await Promise.all([
          supabase.from("church_users").select("role").eq("user_id", user.id).eq("church_id", churchId).maybeSingle(),
          supabase.from("user_roles").select("roles ( name )").eq("user_id", user.id),
        ]);
        if (cancelled) return;
        const roleNames: string[] = ((userRolesRes.data ?? []) as Array<{ roles?: { name?: string } | null }>)
          .map((r) => r.roles?.name ?? "")
          .filter(Boolean);
        const churchRole = (churchUserRes.data as { role?: string } | null)?.role ?? "";
        const display = roleNames[0] || (churchRole === "admin" ? "관리자" : churchRole ? "구성원" : "");
        setRole(display);
      } catch {
        if (!cancelled) setRole("");
      }
    })();
    return () => { cancelled = true; };
  }, [user, churchId]);

  const displayChurch = (churchName || churchNameFallback || "교회 이름").trim();
  const customAvatar = avatarUrl?.trim() || "";
  const iconBox = DASH_SIDEBAR.profileIconSize;
  const userMeta = user?.user_metadata as { name?: string } | undefined;
  const subtitle = userMeta?.name?.trim() || role || "\u00a0";

  const profileRow = (
    <>
      {customAvatar ? (
        <span
          style={{
            width: iconBox,
            height: iconBox,
            borderRadius: DASH_SIDEBAR.profileIconRadius,
            overflow: "hidden",
            flexShrink: 0,
            background: "var(--color-surface)",
            border: "1px solid var(--color-border)",
            display: "inline-flex",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <Image
            src={customAvatar}
            alt="프로필"
            width={iconBox}
            height={iconBox}
            style={{
              width: iconBox,
              height: iconBox,
              objectFit: "cover",
              display: "block",
            }}
          />
        </span>
      ) : (
        <ChurchUpAppIcon size={iconBox} variant="full" />
      )}
      {expanded && (
        <div style={{ minWidth: 0, flex: 1, textAlign: "left" }}>
          <div
            style={{
              fontSize: DASH_SIDEBAR.profileChurchFontSize,
              fontWeight: 700,
              color: "var(--color-text)",
              lineHeight: 1.3,
              overflow: "hidden",
              textOverflow: "ellipsis",
              whiteSpace: "nowrap",
            }}
          >
            {displayChurch}
          </div>
          <div
            style={{
              fontSize: DASH_SIDEBAR.profileUserFontSize,
              fontWeight: 500,
              color: "var(--color-text)",
              lineHeight: 1.3,
              marginTop: 3,
              overflow: "hidden",
              textOverflow: "ellipsis",
              whiteSpace: "nowrap",
            }}
          >
            {subtitle}
          </div>
        </div>
      )}
    </>
  );

  if (!expanded) {
    return (
      <div style={{ display: "flex", justifyContent: "center", width: "100%" }}>
        {profileRow}
      </div>
    );
  }

  return (
    <div style={{ display: "flex", justifyContent: "center", width: "100%" }}>
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 12,
          maxWidth: DASH_SIDEBAR.profileBlockWidth,
          width: "100%",
        }}
      >
        {profileRow}
      </div>
    </div>
  );
}
