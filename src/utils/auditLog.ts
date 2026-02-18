import { supabase } from "@/lib/supabase";
import type { AuditLog } from "@/types/db";

export type AuditAction = "CREATE" | "UPDATE" | "DELETE" | "LOGIN" | "EXPORT" | "PRINT";

export interface LogActionParams {
  action: AuditAction;
  targetTable: string;
  targetId?: string;
  targetName?: string;
  details?: Record<string, unknown>;
}

/** 작업 이력을 audit_logs 테이블에 기록. Supabase 미연결 시 무시. */
export async function logAction(params: LogActionParams): Promise<void> {
  if (!supabase) return;
  try {
    const { data: { user } } = await supabase.auth.getUser();
    await supabase.from("audit_logs").insert({
      user_id: user?.id ?? null,
      user_name: user?.email ?? user?.user_metadata?.name ?? "알 수 없음",
      action: params.action,
      target_table: params.targetTable,
      target_id: params.targetId ?? null,
      target_name: params.targetName ?? null,
      details: params.details ?? null,
    } as Partial<AuditLog>);
  } catch (e) {
    console.warn("audit log insert failed:", e);
  }
}
