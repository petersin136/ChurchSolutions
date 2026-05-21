/**
 * 사역흐름 권한 — 카드 담당자 변경 등 민감 작업의 허용 여부.
 *
 * 허용 조건:
 *   1) church_users.role === 'admin'   (가입 시 자동 부여)
 *   2) user_roles → roles.name 이 '담임목사' / '부교역자' 인 사용자
 *
 * 결과는 한 번 조회 후 React state 로 캐시합니다.
 */

"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/contexts/AuthContext";

const PASTORAL_ROLES = ["담임목사", "부교역자", "담임", "부목사"] as const;

export interface WorkflowPermissions {
  /** 카드 담당자 변경, 사역흐름 정의 수정 가능 */
  canManage: boolean;
  /** 카드 생성·이동·메모 가능 (기본적으로 로그인된 사용자는 true) */
  canEdit: boolean;
  loading: boolean;
}

export function useWorkflowPermissions(): WorkflowPermissions {
  const { user, churchId } = useAuth();
  const [canManage, setCanManage] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user || !churchId || !supabase) {
      setCanManage(false);
      setLoading(false);
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        const [churchUserRes, userRolesRes] = await Promise.all([
          supabase.from("church_users")
            .select("role")
            .eq("user_id", user.id)
            .eq("church_id", churchId)
            .maybeSingle(),
          supabase.from("user_roles")
            .select("role_id, roles ( name )")
            .eq("user_id", user.id),
        ]);
        if (cancelled) return;

        const churchRole = (churchUserRes.data as { role?: string } | null)?.role ?? "";
        const roleNames: string[] = ((userRolesRes.data ?? []) as Array<{ roles?: { name?: string } | null }>)
          .map((r) => r.roles?.name ?? "")
          .filter(Boolean);

        const allowed =
          churchRole === "admin" ||
          roleNames.some((n) => (PASTORAL_ROLES as readonly string[]).includes(n));

        setCanManage(allowed);
      } catch (e) {
        console.warn("[permissions] 권한 조회 실패 — 안전을 위해 거부:", e);
        if (!cancelled) setCanManage(false);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [user, churchId]);

  return { canManage, canEdit: !!user, loading };
}

/** 비-React 컨텍스트(예: 서버 보조 함수)에서 단발성 체크용 */
export async function fetchCanManageWorkflow(userId: string, churchId: string): Promise<boolean> {
  if (!supabase) return false;
  try {
    const [{ data: cu }, { data: ur }] = await Promise.all([
      supabase.from("church_users").select("role")
        .eq("user_id", userId).eq("church_id", churchId).maybeSingle(),
      supabase.from("user_roles").select("roles ( name )").eq("user_id", userId),
    ]);
    const churchRole = (cu as { role?: string } | null)?.role ?? "";
    const roleNames: string[] = ((ur ?? []) as Array<{ roles?: { name?: string } | null }>)
      .map((r) => r.roles?.name ?? "")
      .filter(Boolean);
    return churchRole === "admin" ||
      roleNames.some((n) => (PASTORAL_ROLES as readonly string[]).includes(n));
  } catch {
    return false;
  }
}
