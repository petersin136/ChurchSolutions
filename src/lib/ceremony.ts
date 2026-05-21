/**
 * Ceremony Guide System — 비즈니스 로직 헬퍼
 * 대응: src/lib/workflow.ts 와 동일 컨벤션
 */

import { supabase } from "@/lib/supabase";
import { logAction } from "@/utils/auditLog";
import type {
  CeremonyTemplate,
  CeremonyStep,
  CeremonySession,
  CeremonySessionNote,
  CeremonyStepContent,
  CeremonyProgressState,
  CeremonyFamilyInfo,
  CeremonySessionStatus,
} from "@/types/db";

/* ──────────────────────────────────────────
 *  UI 표시용 selector (순수 함수, DB 호출 없음)
 * ────────────────────────────────────────── */
/**
 * 사용자에게 노출할 예식 템플릿만 반환.
 *
 * - `is_active = false` 는 일반 화면에서 숨김 (opts.includeInactive=true 면 무시)
 * - 본인 교회 템플릿(is_system=false) 은 항상 포함
 * - 시스템 템플릿(is_system=true) 은 교단이 일치하거나 'common' 인 것만 포함
 * - 정렬: 본인 교회 템플릿 우선 → 시스템 템플릿. 같은 그룹 내에서는 sort_order ASC, name ASC.
 */
export function getVisibleTemplates(
  templates: CeremonyTemplate[],
  churchDenomination: string,
  opts?: { includeInactive?: boolean },
): CeremonyTemplate[] {
  const includeInactive = opts?.includeInactive ?? false;
  const filtered = templates.filter((t) => {
    if (!includeInactive && !t.is_active) return false;
    if (!t.is_system) return true;
    return t.denomination === churchDenomination || t.denomination === "common";
  });
  return filtered.slice().sort((a, b) => {
    if (a.is_system !== b.is_system) return a.is_system ? 1 : -1;
    if (a.sort_order !== b.sort_order) return a.sort_order - b.sort_order;
    return a.name.localeCompare(b.name);
  });
}

export function getStepsForTemplate(
  steps: CeremonyStep[],
  templateId: string,
): CeremonyStep[] {
  return steps
    .filter((s) => s.template_id === templateId)
    .slice()
    .sort((a, b) => a.step_order - b.step_order);
}

export function getTemplatesByCategory(
  templates: CeremonyTemplate[],
  category: string,
): CeremonyTemplate[] {
  return templates
    .filter((t) => t.category === category)
    .slice()
    .sort((a, b) => a.sort_order - b.sort_order);
}

/* ──────────────────────────────────────────
 *  템플릿 관리
 * ────────────────────────────────────────── */
export async function cloneSystemTemplate(
  sourceTemplateId: string,
  targetChurchId: string,
): Promise<string | null> {
  if (!supabase) return null;
  const { data, error } = await supabase.rpc("clone_ceremony_template", {
    p_source_template_id: sourceTemplateId,
    p_target_church_id: targetChurchId,
  });
  if (error) {
    console.error("[ceremony] cloneSystemTemplate:", error.message);
    return null;
  }
  return (data as string | null) ?? null;
}

export async function updateTemplate(
  templateId: string,
  patch: Partial<Pick<CeremonyTemplate,
    "name" | "description" | "sort_order" | "is_active" | "subtype" | "is_customized"
  >>,
): Promise<boolean> {
  if (!supabase) return false;
  const { error } = await supabase.from("ceremony_templates")
    .update(patch)
    .eq("id", templateId);
  if (error) {
    console.error("[ceremony] updateTemplate:", error.message);
    return false;
  }
  return true;
}

export async function markTemplateCustomized(templateId: string): Promise<boolean> {
  if (!supabase) return false;
  const { error } = await supabase.from("ceremony_templates")
    .update({ is_customized: true })
    .eq("id", templateId);
  if (error) {
    console.error("[ceremony] markTemplateCustomized:", error.message);
    return false;
  }
  return true;
}

export async function deleteTemplate(templateId: string): Promise<boolean> {
  if (!supabase) return false;
  const { error } = await supabase.from("ceremony_templates")
    .delete()
    .eq("id", templateId);
  if (error) {
    console.error("[ceremony] deleteTemplate:", error.message);
    return false;
  }
  return true;
}

/* ──────────────────────────────────────────
 *  식순(step) 관리
 * ────────────────────────────────────────── */
export interface AddStepInput {
  templateId: string;
  title: string;
  stepOrder?: number;
  durationMinutes?: number | null;
  content?: CeremonyStepContent;
  isOptional?: boolean;
}

export async function addStep(params: AddStepInput): Promise<CeremonyStep | null> {
  if (!supabase) return null;

  let stepOrder = params.stepOrder;
  if (stepOrder === undefined) {
    const { data: maxRow } = await supabase.from("ceremony_steps")
      .select("step_order")
      .eq("template_id", params.templateId)
      .order("step_order", { ascending: false })
      .limit(1)
      .maybeSingle();
    const currentMax = (maxRow as { step_order?: number } | null)?.step_order ?? 0;
    stepOrder = currentMax + 1;
  }

  const payload = {
    template_id: params.templateId,
    title: params.title,
    step_order: stepOrder,
    duration_minutes: params.durationMinutes ?? null,
    content: params.content ?? {},
    is_optional: params.isOptional ?? false,
  };

  const { data, error } = await supabase.from("ceremony_steps")
    .insert(payload)
    .select()
    .maybeSingle();
  if (error) {
    console.error("[ceremony] addStep:", error.message);
    return null;
  }
  return data as CeremonyStep;
}

export async function updateStep(
  stepId: string,
  patch: Partial<Pick<CeremonyStep,
    "title" | "duration_minutes" | "content" | "is_optional" | "step_order"
  >>,
): Promise<boolean> {
  if (!supabase) return false;
  const { error } = await supabase.from("ceremony_steps")
    .update(patch)
    .eq("id", stepId);
  if (error) {
    console.error("[ceremony] updateStep:", error.message);
    return false;
  }
  return true;
}

export async function deleteStep(stepId: string): Promise<boolean> {
  if (!supabase) return false;
  const { error } = await supabase.from("ceremony_steps")
    .delete()
    .eq("id", stepId);
  if (error) {
    console.error("[ceremony] deleteStep:", error.message);
    return false;
  }
  return true;
}

/**
 * 식순 순서 재정렬.
 * 단일 트랜잭션 보장이 어렵기 때문에 순차 UPDATE 로 처리하며,
 * 한 건이라도 실패하면 즉시 중단하고 false 반환.
 */
export async function reorderSteps(
  templateId: string,
  orderedStepIds: string[],
): Promise<boolean> {
  if (!supabase) return false;
  for (let i = 0; i < orderedStepIds.length; i++) {
    const stepId = orderedStepIds[i];
    const { error } = await supabase.from("ceremony_steps")
      .update({ step_order: i + 1 })
      .eq("id", stepId)
      .eq("template_id", templateId);
    if (error) {
      console.error("[ceremony] reorderSteps:", error.message);
      return false;
    }
  }
  return true;
}

/* ──────────────────────────────────────────
 *  세션 (인스턴스) 관리
 * ────────────────────────────────────────── */
export interface CreateSessionInput {
  churchId: string;
  templateId: string;
  title: string;
  scheduledAt?: string | null;
  location?: string | null;
  leaderUserId?: string | null;
  subjectMemberId?: string | null;
  familyInfo?: CeremonyFamilyInfo;
  notes?: string | null;
}

export async function createSession(
  params: CreateSessionInput,
): Promise<CeremonySession | null> {
  if (!supabase) return null;

  const { data: userRes } = await supabase.auth.getUser();
  const author = userRes.user;

  const payload = {
    church_id: params.churchId,
    template_id: params.templateId,
    title: params.title,
    scheduled_at: params.scheduledAt ?? null,
    location: params.location ?? null,
    leader_user_id: params.leaderUserId ?? null,
    subject_member_id: params.subjectMemberId ?? null,
    family_info: params.familyInfo ?? {},
    status: "planned" as CeremonySessionStatus,
    progress_state: {} as CeremonyProgressState,
    notes: params.notes ?? null,
    created_by: author?.id ?? null,
  };

  const { data, error } = await supabase.from("ceremony_sessions")
    .insert(payload)
    .select()
    .maybeSingle();
  if (error) {
    console.error("[ceremony] createSession:", error.message);
    return null;
  }
  const created = data as CeremonySession;

  await logAction({
    action: "CREATE",
    targetTable: "ceremony_sessions",
    targetId: created?.id,
    targetName: created?.title,
    details: {
      template_id: params.templateId,
      scheduled_at: params.scheduledAt ?? null,
    },
  });

  return created;
}

export async function updateSession(
  sessionId: string,
  patch: Partial<Pick<CeremonySession,
    "title" | "scheduled_at" | "location" | "leader_user_id" | "subject_member_id"
    | "family_info" | "notes" | "status"
  >>,
): Promise<boolean> {
  if (!supabase) return false;
  const { error } = await supabase.from("ceremony_sessions")
    .update(patch)
    .eq("id", sessionId);
  if (error) {
    console.error("[ceremony] updateSession:", error.message);
    return false;
  }
  return true;
}

export async function deleteSession(sessionId: string): Promise<boolean> {
  if (!supabase) return false;
  const { error } = await supabase.from("ceremony_sessions")
    .delete()
    .eq("id", sessionId);
  if (error) {
    console.error("[ceremony] deleteSession:", error.message);
    return false;
  }
  return true;
}

/**
 * 세션의 progress_state JSONB 중 특정 step_id 키 하나만 갱신.
 * 1) 현재 progress_state SELECT
 * 2) 클라이언트 메모리에서 머지
 * 3) 전체 JSONB UPDATE
 */
export async function toggleStepProgress(
  sessionId: string,
  stepId: string,
  checked: boolean,
): Promise<boolean> {
  if (!supabase) return false;

  const { data: row, error: selErr } = await supabase.from("ceremony_sessions")
    .select("progress_state")
    .eq("id", sessionId)
    .maybeSingle();
  if (selErr) {
    console.error("[ceremony] toggleStepProgress select:", selErr.message);
    return false;
  }
  const current = ((row as { progress_state?: CeremonyProgressState } | null)?.progress_state ?? {}) as CeremonyProgressState;
  const next: CeremonyProgressState = { ...current };
  if (checked) {
    next[stepId] = { checked: true, checked_at: new Date().toISOString() };
  } else {
    next[stepId] = { checked: false };
  }

  const { error: updErr } = await supabase.from("ceremony_sessions")
    .update({ progress_state: next })
    .eq("id", sessionId);
  if (updErr) {
    console.error("[ceremony] toggleStepProgress update:", updErr.message);
    return false;
  }
  return true;
}

export async function startSession(sessionId: string): Promise<boolean> {
  if (!supabase) return false;
  const { error } = await supabase.from("ceremony_sessions")
    .update({ status: "in_progress" as CeremonySessionStatus })
    .eq("id", sessionId);
  if (error) {
    console.error("[ceremony] startSession:", error.message);
    return false;
  }
  await logAction({
    action: "UPDATE",
    targetTable: "ceremony_sessions",
    targetId: sessionId,
    details: { kind: "start" },
  });
  return true;
}

export async function completeSession(sessionId: string): Promise<boolean> {
  if (!supabase) return false;
  const { error } = await supabase.from("ceremony_sessions")
    .update({ status: "completed" as CeremonySessionStatus })
    .eq("id", sessionId);
  if (error) {
    console.error("[ceremony] completeSession:", error.message);
    return false;
  }
  await logAction({
    action: "UPDATE",
    targetTable: "ceremony_sessions",
    targetId: sessionId,
    details: { kind: "complete" },
  });
  return true;
}

export async function cancelSession(sessionId: string): Promise<boolean> {
  if (!supabase) return false;
  const { error } = await supabase.from("ceremony_sessions")
    .update({ status: "cancelled" as CeremonySessionStatus })
    .eq("id", sessionId);
  if (error) {
    console.error("[ceremony] cancelSession:", error.message);
    return false;
  }
  await logAction({
    action: "UPDATE",
    targetTable: "ceremony_sessions",
    targetId: sessionId,
    details: { kind: "cancel" },
  });
  return true;
}

/* ──────────────────────────────────────────
 *  세션 메모 (lazy load)
 * ────────────────────────────────────────── */
export async function fetchSessionNotes(sessionId: string): Promise<CeremonySessionNote[]> {
  if (!supabase) return [];
  const { data, error } = await supabase.from("ceremony_session_notes")
    .select("*")
    .eq("session_id", sessionId)
    .order("created_at", { ascending: true });
  if (error) {
    console.warn("[ceremony] fetchSessionNotes error:", error.message);
    return [];
  }
  return (data ?? []) as CeremonySessionNote[];
}

export async function addSessionNote(
  sessionId: string,
  body: string,
): Promise<CeremonySessionNote | null> {
  if (!supabase) return null;
  const trimmed = body.trim();
  if (!trimmed) return null;

  const { data: userRes } = await supabase.auth.getUser();
  const author = userRes.user;

  const payload = {
    session_id: sessionId,
    body: trimmed,
    created_by: author?.id ?? null,
  };
  const { data, error } = await supabase.from("ceremony_session_notes")
    .insert(payload)
    .select()
    .maybeSingle();
  if (error) {
    console.error("[ceremony] addSessionNote:", error.message);
    return null;
  }
  return data as CeremonySessionNote;
}
