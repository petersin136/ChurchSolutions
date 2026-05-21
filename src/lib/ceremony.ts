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
 *  카테고리별 폼 카피 (Picker · SessionModal 공용)
 *
 *  기존엔 Picker 에만 있었으나 SessionModal 의 예식 정보 폼에서도
 *  동일한 카테고리 컨텍스트가 필요하므로 lib 로 승격.
 * ────────────────────────────────────────── */
export interface CategoryFormCopy {
  titleEx: string;
  locationEx: string;
  subjectLabel: string;
  /**
   * 두 명을 선택해야 하는 카테고리(예: 결혼 — 신랑·신부)의 두 번째 슬롯 라벨.
   * 값이 있으면 폼에서 두 번째 PcSelect 가 렌더링되며, 선택값은
   * `family_info.partner_member_id` 에 저장된다.
   * 값이 없으면 기존 단일 선택 동작.
   */
  secondarySubjectLabel?: string;
  familyLabel: string;
  familyEx: string;
}

/**
 * 템플릿의 인도자 멘트·기도문·팁에 들어 있는 `○○○` 자리표시자(placeholder) 를
 * 실제 선택된 이름으로 치환한다.
 *
 *  - `○○○○년` 처럼 4개 이상의 ○ 가 연속된 패턴(연도 자리)은 건드리지 않음
 *    (`(?<!○)○○○(?!○)` lookaround).
 *  - 결혼예식의 경우 `○○○ 형제` → subject(신랑), `○○○ 자매` → partner(신부)
 *    로 컨텍스트에 따라 다르게 치환.
 *  - 그 외 카테고리(장례·세례·임직 등)는 모든 `○○○` 자리표시자를 subject 이름
 *    으로 통일 치환. subjectName 이 비어 있으면 원문을 그대로 둠.
 *  - 이 함수는 순수 함수 — DB 호출 없음.
 */
export function substituteCeremonyPlaceholders(
  text: string | null | undefined,
  context: {
    category?: string | null;
    subjectName?: string | null;
    partnerName?: string | null;
  },
): string {
  if (!text) return text ?? "";
  const subject = (context.subjectName ?? "").trim();
  const partner = (context.partnerName ?? "").trim();

  let out = text;

  if (context.category === "wedding") {
    // 결혼: ○○○ 형제 → subject(신랑), ○○○ 자매 → partner(신부)
    if (subject) {
      out = out.replace(/○○○(?=\s*형제)/g, subject);
    }
    if (partner) {
      out = out.replace(/○○○(?=\s*자매)/g, partner);
    }
    return out;
  }

  // 그 외 카테고리: 단일 subject 로 모든 ○○○ 치환 (단, 연도 등 4+ 연속 제외)
  if (subject) {
    out = out.replace(/(?<!○)○○○(?!○)/g, subject);
  }

  return out;
}

export function getCategoryFormCopy(category: string | null | undefined): CategoryFormCopy {
  switch (category) {
    case "funeral":
      return {
        titleEx: "예: 故 홍길동 성도 발인예배",
        locationEx: "○○장례식장 1호실 / 본당 / 자택",
        subjectLabel: "고인 (선택)",
        familyLabel: "유족·가족 정보 (선택)",
        familyEx: "상주: ○○○ (장남)\n장지: ○○공원묘원\n발인일: ...",
      };
    case "memorial":
      return {
        titleEx: "예: 홍길동 성도 1주기 추도예배",
        locationEx: "유가족 자택 / 본당 / 묘소",
        subjectLabel: "추도 대상 (선택)",
        familyLabel: "유족·참석자 정보 (선택)",
        familyEx: "기일: 2025-12-25\n참석: 자녀·손주 등\n특별 기도 제목: ...",
      };
    case "visit":
      return {
        titleEx: "예: 홍길동 가정 심방예배",
        locationEx: "성도 자택 / 병원 / 직장",
        subjectLabel: "심방 대상 (선택)",
        familyLabel: "심방 정보 (선택)",
        familyEx: "심방 이유: 병환 회복 기도\n가족 구성원: ...\n특별 기도 제목: ...",
      };
    case "holiday":
      return {
        titleEx: "예: 설 명절 가족예배",
        locationEx: "성도 가정 / 본당",
        subjectLabel: "가정 대표 (선택)",
        familyLabel: "가족·참석자 정보 (선택)",
        familyEx: "참석 가족: 부모·자녀·손주 등\n특별 기도 제목: 한 해 감사·건강 등",
      };
    case "wedding":
      return {
        titleEx: "예: 홍길동·김순희 결혼예식",
        locationEx: "본당 / ○○예식장",
        subjectLabel: "신랑 (선택)",
        secondarySubjectLabel: "신부 (선택)",
        familyLabel: "양가·가족 정보 (선택)",
        familyEx: "신랑 측: ○○○ 장로 자녀\n신부 측: ○○○ 권사 자녀\n참석 인원: 약 ○○명",
      };
    case "baptism":
      return {
        titleEx: "예: 2026년 봄학기 성인 세례식",
        locationEx: "본당 / 세례탕",
        subjectLabel: "수세자 대표 (선택)",
        familyLabel: "수세자·후견인 메모 (선택)",
        familyEx: "수세자 명단: ○○○, ○○○, ...\n신앙고백 확인 여부: ...\n후견인/대부모: ...",
      };
    case "communion":
      return {
        titleEx: "예: 성찬식",
        locationEx: "본당",
        subjectLabel: "집례자 (선택)",
        familyLabel: "성찬 준비 메모 (선택)",
        familyEx: "성도 수: 약 ○○명\n준비물: 떡·잔\n특이사항: ...",
      };
    case "easter":
      return {
        titleEx: "예: 부활주일 새벽예배",
        locationEx: "본당 / 야외",
        subjectLabel: "참여 대표 (선택)",
        familyLabel: "참석·메모 (선택)",
        familyEx: "참석 인원: 약 ○○명\n특이사항: ...",
      };
    case "newyear":
      return {
        titleEx: "예: 신년 헌신예배",
        locationEx: "본당",
        subjectLabel: "참여 대표 (선택)",
        familyLabel: "참석·메모 (선택)",
        familyEx: "참석 인원: 약 ○○명\n특별 기도 제목: 한 해 비전·헌신 등",
      };
    case "thanksgiving":
      return {
        titleEx: "예: 추수감사주일 예배",
        locationEx: "본당",
        subjectLabel: "참여 대표 (선택)",
        familyLabel: "참석·메모 (선택)",
        familyEx: "참석 인원: 약 ○○명\n특별 감사 제목: ...",
      };
    case "housewarming":
      return {
        titleEx: "예: 입주 감사예배",
        locationEx: "○○○ 성도 가정 (새 주소)",
        subjectLabel: "가정 (선택)",
        familyLabel: "가정·축복 기도 메모 (선택)",
        familyEx: "이전 주소: ...\n새 주소: ...\n축복 기도 제목: 가정의 평안·자녀 등",
      };
    case "ordination":
      return {
        titleEx: "예: 안수식 / 임직예배",
        locationEx: "본당",
        subjectLabel: "임직 대상 (선택)",
        familyLabel: "임직·참석 정보 (선택)",
        familyEx: "임직 대상: ○○○ 집사 (장로 안수)\n참석: 노회 위원 등",
      };
    default:
      return {
        titleEx: "예식 제목을 입력하세요",
        locationEx: "본당 / 가정 등",
        subjectLabel: "대상 (선택)",
        familyLabel: "참석·메모 (선택)",
        familyEx: "참석 인원: ...\n특별 기도 제목: ...",
      };
  }
}

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
