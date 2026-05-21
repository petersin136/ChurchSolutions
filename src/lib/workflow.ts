/**
 * 사역흐름(Workflow) 클라이언트 헬퍼.
 *
 * - 모든 SELECT 는 filterByChurch() 로 church_id 필터링
 * - 모든 INSERT 는 withChurchId() 로 church_id 자동 주입
 * - 모든 카드 변경(CREATE/MOVE/COMPLETE)은 logAction() 으로 감사 로그 기록
 */

import { supabase } from "@/lib/supabase";
import { withChurchId, filterByChurch } from "@/lib/tenant";
import { logAction } from "@/utils/auditLog";
import type {
  Workflow,
  WorkflowStep,
  WorkflowCard,
  WorkflowCardNote,
  WorkflowCardStage,
  WorkflowCardPriority,
  WorkflowCardSource,
  WorkflowChecklistState,
  WorkflowTemplateKey,
} from "@/types/db";

/* ──────────────────────────────────────────
 *  SELECT
 * ────────────────────────────────────────── */
export async function fetchWorkflows(): Promise<Workflow[]> {
  if (!supabase) return [];
  const q = supabase.from("workflows").select("*").order("created_at", { ascending: true });
  const { data, error } = await filterByChurch(q);
  if (error) {
    console.warn("[workflow] fetchWorkflows error:", error.message);
    return [];
  }
  return (data ?? []) as Workflow[];
}

export async function fetchWorkflowSteps(): Promise<WorkflowStep[]> {
  if (!supabase) return [];
  const q = supabase.from("workflow_steps").select("*").order("sort_order", { ascending: true });
  const { data, error } = await filterByChurch(q);
  if (error) {
    console.warn("[workflow] fetchWorkflowSteps error:", error.message);
    return [];
  }
  return (data ?? []) as WorkflowStep[];
}

export async function fetchWorkflowCards(): Promise<WorkflowCard[]> {
  if (!supabase) return [];
  const q = supabase.from("workflow_cards").select("*").order("moved_to_step_at", { ascending: false });
  const { data, error } = await filterByChurch(q);
  if (error) {
    console.warn("[workflow] fetchWorkflowCards error:", error.message);
    return [];
  }
  return (data ?? []) as WorkflowCard[];
}

export async function fetchCardNotes(cardId: string): Promise<WorkflowCardNote[]> {
  if (!supabase) return [];
  const q = supabase.from("workflow_card_notes").select("*").eq("card_id", cardId)
    .order("created_at", { ascending: false });
  const { data, error } = await filterByChurch(q);
  if (error) {
    console.warn("[workflow] fetchCardNotes error:", error.message);
    return [];
  }
  return (data ?? []) as WorkflowCardNote[];
}

/* ──────────────────────────────────────────
 *  UI 표시용 selector
 * ────────────────────────────────────────── */
/**
 * 사용자에게 노출할 사역흐름만 반환.
 *
 * - `is_active = false` 는 일반 화면에서 숨김
 * - `template_key = "new_family"` 는 기존 새가족 정착 프로그램(PastoralPage)과
 *   기능이 중복되므로 사역흐름 보드/시작 모달에서는 숨긴다.
 *   (자동 카드 생성 등 내부 로직은 `workflows` 원본을 그대로 사용하므로 영향 없음)
 */
export function getVisibleWorkflows(workflows: Workflow[]): Workflow[] {
  return workflows.filter(
    (w) => w.is_active && w.template_key !== "new_family",
  );
}

/* ──────────────────────────────────────────
 *  카드 생성
 * ────────────────────────────────────────── */
/** 카드 생성 시 받는 성도 정보 — phone 은 null 허용 (DB snapshot 용도). */
export type WorkflowMemberRef = { id: string; name: string; phone?: string | null };

export interface CreateCardInput {
  workflowId: string;
  member: WorkflowMemberRef;
  assigneeId?: string | null;
  assigneeName?: string | null;
  priority?: WorkflowCardPriority;
  dueDate?: string | null;
  source?: WorkflowCardSource;
  sourceRef?: string | null;
  initialNote?: string | null;
}

export async function createCard(input: CreateCardInput): Promise<WorkflowCard | null> {
  if (!supabase) return null;

  // 첫 단계 찾기
  const { data: stepRow } = await supabase.from("workflow_steps")
    .select("id, name").eq("workflow_id", input.workflowId)
    .order("sort_order", { ascending: true }).limit(1).maybeSingle();

  const firstStepId = (stepRow as { id?: string } | null)?.id ?? null;
  const firstStepName = (stepRow as { name?: string } | null)?.name ?? null;

  const payload = withChurchId({
    workflow_id: input.workflowId,
    current_step_id: firstStepId,
    member_id: input.member.id,
    member_name: input.member.name,
    member_phone: input.member.phone ?? null,
    assignee_id: input.assigneeId ?? null,
    assignee_name: input.assigneeName ?? null,
    stage: "open" as WorkflowCardStage,
    priority: input.priority ?? "normal",
    due_date: input.dueDate ?? null,
    source: input.source ?? "manual",
    source_ref: input.sourceRef ?? null,
  });

  const { data, error } = await supabase.from("workflow_cards").insert(payload).select().maybeSingle();
  if (error) {
    console.error("[workflow] createCard error:", error.message);
    return null;
  }
  const created = data as WorkflowCard;

  if (input.initialNote && created?.id) {
    await addCardNote(created.id, input.initialNote, firstStepId);
  }

  await logAction({
    action: "CREATE",
    targetTable: "workflow_cards",
    targetId: created?.id,
    targetName: input.member.name,
    details: {
      workflow_id: input.workflowId,
      step: firstStepName,
      source: input.source ?? "manual",
    },
  });

  return created;
}

/* ──────────────────────────────────────────
 *  카드 단계 이동 / 상태 변경
 * ────────────────────────────────────────── */
export async function moveCardToStep(
  card: WorkflowCard,
  stepId: string,
  stepName?: string,
): Promise<boolean> {
  if (!supabase) return false;
  const { error } = await supabase.from("workflow_cards")
    .update({ current_step_id: stepId, stage: "open" })
    .eq("id", card.id)
    .eq("church_id", card.church_id);
  if (error) {
    console.error("[workflow] moveCardToStep error:", error.message);
    return false;
  }
  await logAction({
    action: "UPDATE",
    targetTable: "workflow_cards",
    targetId: card.id,
    targetName: card.member_name,
    details: { kind: "move", from_step_id: card.current_step_id, to_step_id: stepId, to_step: stepName ?? null },
  });
  return true;
}

export async function promoteCard(
  card: WorkflowCard,
  steps: WorkflowStep[],
): Promise<boolean> {
  const ordered = steps.filter(s => s.workflow_id === card.workflow_id)
    .sort((a, b) => a.sort_order - b.sort_order);
  const idx = ordered.findIndex(s => s.id === card.current_step_id);
  if (idx < 0) return false;
  const next = ordered[idx + 1];
  if (!next) {
    return completeCard(card);
  }
  if (next.is_terminal) {
    const moved = await moveCardToStep(card, next.id, next.name);
    if (!moved) return false;
    return completeCard({ ...card, current_step_id: next.id });
  }
  return moveCardToStep(card, next.id, next.name);
}

export async function goBackCard(
  card: WorkflowCard,
  steps: WorkflowStep[],
): Promise<boolean> {
  const ordered = steps.filter(s => s.workflow_id === card.workflow_id)
    .sort((a, b) => a.sort_order - b.sort_order);
  const idx = ordered.findIndex(s => s.id === card.current_step_id);
  if (idx <= 0) return false;
  const prev = ordered[idx - 1];
  return moveCardToStep(card, prev.id, prev.name);
}

export async function snoozeCard(card: WorkflowCard, until: string): Promise<boolean> {
  if (!supabase) return false;
  const { error } = await supabase.from("workflow_cards")
    .update({ stage: "snoozed", snooze_until: until })
    .eq("id", card.id).eq("church_id", card.church_id);
  if (error) { console.error("[workflow] snoozeCard:", error.message); return false; }
  await logAction({ action: "UPDATE", targetTable: "workflow_cards", targetId: card.id,
    targetName: card.member_name, details: { kind: "snooze", until } });
  return true;
}

export async function reopenCard(card: WorkflowCard): Promise<boolean> {
  if (!supabase) return false;
  const { error } = await supabase.from("workflow_cards")
    .update({ stage: "open", snooze_until: null })
    .eq("id", card.id).eq("church_id", card.church_id);
  if (error) { console.error("[workflow] reopenCard:", error.message); return false; }
  await logAction({ action: "UPDATE", targetTable: "workflow_cards", targetId: card.id,
    targetName: card.member_name, details: { kind: "reopen" } });
  return true;
}

export async function completeCard(card: WorkflowCard): Promise<boolean> {
  if (!supabase) return false;
  const { error } = await supabase.from("workflow_cards")
    .update({ stage: "completed" })
    .eq("id", card.id).eq("church_id", card.church_id);
  if (error) { console.error("[workflow] completeCard:", error.message); return false; }
  await logAction({ action: "UPDATE", targetTable: "workflow_cards", targetId: card.id,
    targetName: card.member_name, details: { kind: "complete" } });
  return true;
}

export async function dropCard(card: WorkflowCard, reason?: string): Promise<boolean> {
  if (!supabase) return false;
  const { error } = await supabase.from("workflow_cards")
    .update({ stage: "dropped" })
    .eq("id", card.id).eq("church_id", card.church_id);
  if (error) { console.error("[workflow] dropCard:", error.message); return false; }
  await logAction({ action: "UPDATE", targetTable: "workflow_cards", targetId: card.id,
    targetName: card.member_name, details: { kind: "drop", reason: reason ?? null } });
  return true;
}

/* ──────────────────────────────────────────
 *  체크리스트 / 단계별 메모 저장
 * ────────────────────────────────────────── */
export interface UpdateCardChecklistPatch {
  checklist_state: WorkflowChecklistState;
  /** 자동 전진 결과를 함께 반영하고 싶을 때 전달 */
  current_step_id?: string | null;
}

export async function updateCardChecklist(
  card: WorkflowCard,
  patch: UpdateCardChecklistPatch,
): Promise<boolean> {
  if (!supabase) return false;
  const update: Record<string, unknown> = { checklist_state: patch.checklist_state };
  if (patch.current_step_id !== undefined && patch.current_step_id !== card.current_step_id) {
    update.current_step_id = patch.current_step_id;
    update.moved_to_step_at = new Date().toISOString();
  }
  const { error } = await supabase.from("workflow_cards")
    .update(update)
    .eq("id", card.id).eq("church_id", card.church_id);
  if (error) {
    console.error("[workflow] updateCardChecklist:", error.message);
    return false;
  }
  return true;
}

/* ──────────────────────────────────────────
 *  담당자 변경 — 권한 체크 후 호출 (UI 단에서)
 * ────────────────────────────────────────── */
export async function updateCardAssignee(
  card: WorkflowCard,
  assigneeId: string | null,
  assigneeName: string | null,
): Promise<boolean> {
  if (!supabase) return false;
  const { error } = await supabase.from("workflow_cards")
    .update({ assignee_id: assigneeId, assignee_name: assigneeName })
    .eq("id", card.id).eq("church_id", card.church_id);
  if (error) { console.error("[workflow] updateCardAssignee:", error.message); return false; }
  await logAction({ action: "UPDATE", targetTable: "workflow_cards", targetId: card.id,
    targetName: card.member_name, details: { kind: "reassign", to: assigneeName ?? null } });
  return true;
}

/* ──────────────────────────────────────────
 *  카드 메모
 * ────────────────────────────────────────── */
export async function addCardNote(
  cardId: string,
  content: string,
  stepId?: string | null,
): Promise<WorkflowCardNote | null> {
  if (!supabase) return null;
  const trimmed = content.trim();
  if (!trimmed) return null;

  const { data: userRes } = await supabase.auth.getUser();
  const author = userRes.user;

  const payload = withChurchId({
    card_id: cardId,
    step_id: stepId ?? null,
    content: trimmed,
    author_id: author?.id ?? null,
    author_name: author?.email ?? author?.user_metadata?.name ?? null,
  });
  const { data, error } = await supabase.from("workflow_card_notes").insert(payload).select().maybeSingle();
  if (error) {
    console.error("[workflow] addCardNote:", error.message);
    return null;
  }
  return data as WorkflowCardNote;
}

/* ──────────────────────────────────────────
 *  자동 카드 생성 — 새가족 등록 시 / 결석자 회복 시
 *  멱등: 이미 동일 (member, workflow) 의 open/snoozed 카드가 있으면 건너뜀
 * ────────────────────────────────────────── */
async function findWorkflowByTemplateKey(key: WorkflowTemplateKey): Promise<Workflow | null> {
  if (!supabase) return null;
  const q = supabase.from("workflows").select("*").eq("template_key", key).limit(1);
  const { data } = await filterByChurch(q);
  const row = (data ?? [])[0];
  return (row as Workflow | undefined) ?? null;
}

async function hasOpenCardFor(memberId: string, workflowId: string): Promise<boolean> {
  if (!supabase) return false;
  const q = supabase.from("workflow_cards").select("id")
    .eq("member_id", memberId).eq("workflow_id", workflowId)
    .in("stage", ["open", "snoozed"]).limit(1);
  const { data } = await filterByChurch(q);
  return ((data ?? []).length ?? 0) > 0;
}

export async function ensureNewFamilyCard(
  member: WorkflowMemberRef,
): Promise<WorkflowCard | null> {
  try {
    const wf = await findWorkflowByTemplateKey("new_family");
    if (!wf) {
      console.warn("[workflow] new_family 템플릿이 없음 — 시드 실행 필요");
      return null;
    }
    if (await hasOpenCardFor(member.id, wf.id)) return null;
    return await createCard({
      workflowId: wf.id,
      member,
      source: "auto_new_family",
      sourceRef: null,
      priority: "normal",
    });
  } catch (e) {
    console.warn("[workflow] ensureNewFamilyCard failed:", e);
    return null;
  }
}

export async function ensureAbsenteeRecoveryCard(
  member: WorkflowMemberRef,
  consecutiveWeeks: number,
): Promise<WorkflowCard | null> {
  try {
    const wf = await findWorkflowByTemplateKey("absentee_recovery");
    if (!wf) {
      console.warn("[workflow] absentee_recovery 템플릿이 없음 — 시드 실행 필요");
      return null;
    }
    if (await hasOpenCardFor(member.id, wf.id)) return null;
    return await createCard({
      workflowId: wf.id,
      member,
      source: "auto_absentee",
      sourceRef: `consecutive_weeks=${consecutiveWeeks}`,
      priority: consecutiveWeeks >= 4 ? "high" : "normal",
    });
  } catch (e) {
    console.warn("[workflow] ensureAbsenteeRecoveryCard failed:", e);
    return null;
  }
}
