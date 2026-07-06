"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/contexts/AuthContext";

/** 사용자 지정 이미지가 없을 때 기본 처치업 앱 아이콘 */
const DEFAULT_APP_ICON = "/icons/icon-192x192.png";

interface SidebarProfileProps {
  /** 사이드바 펼침 여부 — 접힘(64px)일 땐 아바타만 표시 */
  expanded: boolean;
  /** useAuth().churchName 이 비어 있을 때 대체 교회명(예: 설정의 churchName) */
  churchNameFallback?: string;
  /** 사용자 지정 프로필 이미지 URL — 없으면 기본 앱 아이콘 */
  avatarUrl?: string | null;
}

/**
 * 사이드바 하단 프로필 영역.
 * 왼쪽: 사용자 지정 이미지(없으면 기본 처치업 앱 아이콘)
 * 오른쪽: 교회 이름 + 역할(role)
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
  const src = avatarUrl || DEFAULT_APP_ICON;

  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: expanded ? 10 : 0,
        justifyContent: expanded ? "flex-start" : "center",
        width: "100%",
      }}
    >
      <span
        style={{
          width: 36,
          height: 36,
          borderRadius: 10,
          overflow: "hidden",
          flexShrink: 0,
          background: "var(--color-surface)",
          border: "1px solid var(--color-border)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <Image
          src={src}
          alt="프로필"
          width={36}
          height={36}
          style={{
            width: 36,
            height: 36,
            objectFit: "cover",
            /* 기본 앱 아이콘일 때만 시안처럼 연한 회색 톤으로 (사용자 지정 아바타는 원본 유지) */
            ...(src === DEFAULT_APP_ICON ? { filter: "grayscale(1) brightness(1.65) opacity(0.55)" } : {}),
          }}
        />
      </span>
      {expanded && (
        <div style={{ minWidth: 0, flex: 1, textAlign: "left" }}>
          <div
            style={{
              fontSize: 14,
              fontWeight: 600,
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
              fontSize: 12,
              color: "var(--color-text-muted)",
              lineHeight: 1.3,
              overflow: "hidden",
              textOverflow: "ellipsis",
              whiteSpace: "nowrap",
            }}
          >
            {role || "\u00a0"}
          </div>
        </div>
      )}
    </div>
  );
}
