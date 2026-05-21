"use client";

/**
 * 진행카드 상세 모달 (재설계).
 *
 * NewFamilyProgramDetailModal 의 디자인을 따라:
 *   - PcModalShell + CalendarDropdown + PcButton + PcTextarea
 *   - 단계별 카드(아이콘 + 제목 + 완료일 + 체크리스트 + 메모) 타임라인
 *   - 모든 변경은 local state 에 누적, "저장" 버튼 클릭 시에만 DB 반영
 *   - 모든 단계가 done 상태가 되면 "완료 처리" 버튼 활성화
 */

import { useEffect, useMemo, useState } from "react";
import { PcModalShell } from "@/components/common/PcModalShell";
import { PcButton } from "@/components/ui/PcButton";
import { PcTextarea } from "@/components/ui/PcTextarea";
import { CalendarDropdown } from "@/components/CalendarDropdown";
import { C } from "@/styles/designTokens";
import { useAppData } from "@/contexts/AppDataContext";
import { useWorkflowPermissions } from "@/lib/permissions";
import { logAction } from "@/utils/auditLog";
import type {
  WorkflowCard,
  WorkflowCardStage,
  WorkflowChecklistState,
  WorkflowStep,
} from "@/types/db";
import {
  completeCard,
  dropCard,
  reopenCard,
  snoozeCard,
  updateCardAssignee,
  updateCardChecklist,
} from "@/lib/workflow";

/* ──────────────────────────────────────────
 *  Props
 * ────────────────────────────────────────── */
export interface WorkflowCardModalProps {
  open: boolean;
  cardId: string | null;
  onClose: () => void;
  /** 액션 후 호출 (Toast 등) */
  onToast?: (msg: string, type?: "ok" | "err" | "warn") => void;
}

/* ──────────────────────────────────────────
 *  Helpers
 * ────────────────────────────────────────── */
function useIsMobile(): boolean {
  const [mob, setMob] = useState(false);
  useEffect(() => {
    if (typeof window === "undefined") return;
    const mq = window.matchMedia("(max-width: 720px)");
    const update = () => setMob(mq.matches);
    update();
    mq.addEventListener("change", update);
    return () => mq.removeEventListener("change", update);
  }, []);
  return mob;
}

function fmtDate(iso: string | null | undefined): string {
  if (!iso) return "-";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "-";
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function stageBadge(stage: WorkflowCardStage): { label: string; fg: string; bg: string } {
  switch (stage) {
    case "completed":
      return { label: "완료", fg: C.success, bg: C.successBg };
    case "snoozed":
      return { label: "보류", fg: C.warning, bg: `color-mix(in srgb, ${C.warning} 18%, transparent)` };
    case "dropped":
      return { label: "중단", fg: C.danger, bg: C.dangerBg };
    case "open":
    default:
      return { label: "진행중", fg: C.accent, bg: C.accentBg };
  }
}

/** step 이 "완료된" 단계인지 판정: 체크리스트 항목이 0개 또는 모두 체크 + 완료일 입력됨 */
function isStepDone(
  step: WorkflowStep,
  checked: Record<string, boolean>,
  stepDates: Record<string, string>,
): boolean {
  const items = step.checklist_items ?? [];
  const allChecked = items.length === 0 || items.every((it) => checked[it.id] === true);
  const dateOk = !!stepDates[step.id];
  return allChecked && dateOk;
}

/* ──────────────────────────────────────────
 *  Component
 * ────────────────────────────────────────── */
export function WorkflowCardModal({ open, cardId, onClose, onToast }: WorkflowCardModalProps) {
  const mob = useIsMobile();
  const { workflowCards, workflowSteps, workflows, refreshWorkflowCards } = useAppData();
  const { canManage, canEdit } = useWorkflowPermissions();

  const card = useMemo<WorkflowCard | null>(
    () => workflowCards.find((c) => c.id === cardId) ?? null,
    [workflowCards, cardId],
  );
  const workflow = useMemo(
    () => (card ? workflows.find((w) => w.id === card.workflow_id) ?? null : null),
    [card, workflows],
  );
  const steps = useMemo<WorkflowStep[]>(
    () => (card
      ? workflowSteps.filter((s) => s.workflow_id === card.workflow_id)
          .sort((a, b) => a.sort_order - b.sort_order)
      : []),
    [workflowSteps, card],
  );

  // ── local state (모든 변경 누적 → "저장" 클릭 시 DB 반영) ──
  const [checked, setChecked] = useState<Record<string, boolean>>({});
  const [stepDates, setStepDates] = useState<Record<string, string>>({});
  const [stepNotes, setStepNotes] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  const [dirty, setDirty] = useState(false);

  // checklist_state 동기화 (open 또는 card 변경 시)
  useEffect(() => {
    if (!open || !card) return;
    const state = (card.checklist_state ?? {}) as WorkflowChecklistState;
    setChecked(state.items ?? {});
    setStepDates(
      Object.fromEntries(
        Object.entries(state.step_dates ?? {}).map(([k, v]) => [k, v ?? ""]),
      ),
    );
    setStepNotes(
      Object.fromEntries(
        Object.entries(state.step_notes ?? {}).map(([k, v]) => [k, v ?? ""]),
      ),
    );
    setDirty(false);
  }, [open, card]);

  // ESC 키로 닫기 (PcModalShell 기본 동작이 backdrop 클릭만 처리하므로 보강)
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open || !card) return null;

  const readonly = !canEdit;
  const sb = stageBadge(card.stage);
  const initial = (card.member_name || "?").trim().charAt(0) || "?";

  const currentStepIdx = steps.findIndex((s) => s.id === card.current_step_id);
  const allDone = steps.length > 0 && steps.every((s) => isStepDone(s, checked, stepDates));

  /* ── 입력 핸들러 ── */
  const setCheck = (itemId: string, v: boolean) => {
    if (readonly) return;
    setChecked((prev) => ({ ...prev, [itemId]: v }));
    setDirty(true);
  };
  const setDate = (stepId: string, v: string) => {
    if (readonly) return;
    setStepDates((prev) => ({ ...prev, [stepId]: v }));
    setDirty(true);
  };
  const setNote = (stepId: string, v: string) => {
    if (readonly) return;
    setStepNotes((prev) => ({ ...prev, [stepId]: v }));
    setDirty(true);
  };

  /* ── 저장 ── */
  const saveAll = async (opts?: { complete?: boolean }) => {
    if (!card) return;
    setBusy(true);
    try {
      const nextState: WorkflowChecklistState = {
        items: checked,
        step_dates: Object.fromEntries(
          Object.entries(stepDates).map(([k, v]) => [k, v || null]),
        ),
        step_notes: Object.fromEntries(
          Object.entries(stepNotes).map(([k, v]) => [k, v || null]),
        ),
      };

      // 자동 전진: 첫 번째 "미완료" 단계로 current_step_id 갱신
      // 모두 완료된 경우엔 마지막 단계 유지
      const firstPending = steps.findIndex((s) => !isStepDone(s, checked, stepDates));
      const nextCurrentStepId = firstPending === -1
        ? steps[steps.length - 1]?.id ?? card.current_step_id ?? null
        : steps[firstPending]?.id ?? card.current_step_id ?? null;

      const ok = await updateCardChecklist(card, {
        checklist_state: nextState,
        current_step_id: nextCurrentStepId,
      });
      if (!ok) {
        onToast?.("저장에 실패했습니다.", "err");
        return;
      }

      if (opts?.complete && card.stage !== "completed") {
        const done = await completeCard({ ...card, current_step_id: nextCurrentStepId });
        if (!done) {
          onToast?.("완료 처리에 실패했습니다.", "err");
          return;
        }
      }

      await logAction({
        action: "UPDATE",
        targetTable: "workflow_cards",
        targetId: card.id,
        targetName: card.member_name,
        details: {
          kind: opts?.complete ? "complete_with_checklist" : "save_checklist",
          checked_count: Object.values(checked).filter(Boolean).length,
          steps_done: steps.filter((s) => isStepDone(s, checked, stepDates)).length,
        },
      });

      await refreshWorkflowCards();
      setDirty(false);
      onToast?.(opts?.complete ? "사역흐름을 완료 처리했습니다." : "저장되었습니다.", "ok");
      if (opts?.complete) onClose();
    } finally {
      setBusy(false);
    }
  };

  const handleAssignToMe = async () => {
    if (!canManage) {
      onToast?.("담당자 변경 권한이 없습니다 (관리자/담임/부교역자만).", "warn");
      return;
    }
    setBusy(true);
    try {
      const { supabase } = await import("@/lib/supabase");
      if (!supabase) return;
      const { data: userRes } = await supabase.auth.getUser();
      const u = userRes.user;
      const ok = await updateCardAssignee(
        card,
        u?.id ?? null,
        u?.email ?? u?.user_metadata?.name ?? "나",
      );
      if (ok) {
        await refreshWorkflowCards();
        onToast?.("담당자가 나로 변경되었습니다.", "ok");
      } else {
        onToast?.("담당자 변경에 실패했습니다.", "err");
      }
    } finally {
      setBusy(false);
    }
  };

  const handleSnooze = async () => {
    const until = new Date(Date.now() + 7 * 86400000).toISOString().slice(0, 10);
    setBusy(true);
    try {
      const ok = await snoozeCard(card, until);
      if (ok) {
        await refreshWorkflowCards();
        onToast?.("7일 보류 처리했습니다.", "ok");
      } else {
        onToast?.("보류 처리에 실패했습니다.", "err");
      }
    } finally {
      setBusy(false);
    }
  };

  const handleDrop = async () => {
    if (!window.confirm("이 사역흐름을 중단하시겠습니까? 이력은 보존됩니다.")) return;
    setBusy(true);
    try {
      const ok = await dropCard(card);
      if (ok) {
        await refreshWorkflowCards();
        onToast?.("중단 처리했습니다.", "ok");
        onClose();
      } else {
        onToast?.("처리에 실패했습니다.", "err");
      }
    } finally {
      setBusy(false);
    }
  };

  const handleReopen = async () => {
    setBusy(true);
    try {
      const ok = await reopenCard(card);
      if (ok) {
        await refreshWorkflowCards();
        onToast?.("사역흐름을 재개했습니다.", "ok");
      } else {
        onToast?.("처리에 실패했습니다.", "err");
      }
    } finally {
      setBusy(false);
    }
  };

  /* ────────────────────────────────────────
   *  헤더 영역 (모달 body 안)
   * ──────────────────────────────────────── */
  const headerBlock = (
    <div style={{ marginBottom: 20, paddingBottom: 16, borderBottom: `1px solid ${C.border}` }}>
      <div style={{ display: "flex", alignItems: "flex-start", gap: 12 }}>
        <div
          style={{
            width: mob ? 48 : 56,
            height: mob ? 48 : 56,
            borderRadius: "50%",
            background: `linear-gradient(135deg, ${C.accentBg}, ${C.tealBg})`,
            color: C.text,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            fontWeight: 700,
            fontSize: mob ? 18 : 22,
            flexShrink: 0,
          }}
        >
          {initial}
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontWeight: 700, fontSize: mob ? 16 : 18, color: C.text }}>
            {card.member_name}
          </div>
          <div style={{ fontSize: 12, color: C.textMuted, marginTop: 2 }}>
            {workflow?.name ?? "사역흐름"} · 시작 {fmtDate(card.created_at)}
          </div>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 8,
              marginTop: 8,
              flexWrap: "wrap",
            }}
          >
            {card.assignee_name ? (
              <span style={{ fontSize: 13, color: C.text }}>담당 {card.assignee_name}</span>
            ) : (
              <span style={{ fontSize: 13, color: C.danger, fontWeight: 600 }}>담당자 미배정</span>
            )}
            <PcButton
              size="sm"
              variant={card.assignee_name ? "secondary" : "primary"}
              onClick={handleAssignToMe}
              disabled={busy || !canManage}
              title={canManage ? undefined : "권한 없음 (관리자/담임/부교역자만)"}
            >
              담당자 배정
            </PcButton>
          </div>
        </div>
        <span
          style={{
            display: "inline-flex",
            alignItems: "center",
            fontSize: mob ? 11 : 12,
            fontWeight: 600,
            color: sb.fg,
            background: sb.bg,
            padding: mob ? "3px 10px" : "4px 12px",
            borderRadius: 20,
            border: `1px solid ${sb.fg}`,
            flexShrink: 0,
            whiteSpace: "nowrap",
          }}
        >
          {sb.label}
        </span>
      </div>
    </div>
  );

  /* ────────────────────────────────────────
   *  단계 카드 영역 (타임라인)
   * ──────────────────────────────────────── */
  const stepsBlock = (
    <div style={{ position: "relative", paddingLeft: 24 }}>
      <div
        style={{
          position: "absolute",
          left: 11,
          top: 12,
          bottom: 12,
          width: 2,
          background: C.border,
          borderRadius: 1,
        }}
      />
      {steps.length === 0 ? (
        <div style={{ fontSize: 13, color: C.textMuted, padding: 16 }}>
          이 사역흐름에는 정의된 단계가 없습니다.
        </div>
      ) : (
        steps.map((s, i) => {
          const done = isStepDone(s, checked, stepDates);
          const isCurrent = i === currentStepIdx && !done;
          const items = s.checklist_items ?? [];
          const dateVal = stepDates[s.id] || "";
          const noteVal = stepNotes[s.id] || "";

          return (
            <div key={s.id} style={{ position: "relative", marginBottom: 16 }}>
              <div
                style={{
                  position: "absolute",
                  left: -24,
                  top: 4,
                  width: 24,
                  height: 24,
                  borderRadius: "50%",
                  background: done ? C.success : isCurrent ? C.accent : C.borderLight,
                  color: done || isCurrent ? "#fff" : C.textMuted,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontSize: 12,
                  fontWeight: 700,
                  boxShadow: isCurrent
                    ? `0 0 0 3px color-mix(in srgb, ${C.accent} 25%, transparent)`
                    : undefined,
                }}
              >
                {done ? "✓" : i + 1}
              </div>

              <div
                style={{
                  padding: mob ? 12 : 16,
                  background: C.card,
                  border: `1px solid ${isCurrent ? C.accent : C.border}`,
                  borderRadius: 12,
                  boxShadow: "0 1px 3px rgba(0,0,0,0.04)",
                }}
              >
                <div
                  style={{
                    display: "flex",
                    alignItems: mob ? "flex-start" : "center",
                    flexDirection: mob ? "column" : "row",
                    gap: mob ? 8 : 12,
                    marginBottom: 12,
                  }}
                >
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div
                      style={{
                        fontWeight: 700,
                        fontSize: mob ? 14 : 15,
                        color: C.text,
                      }}
                    >
                      {s.name}
                    </div>
                    {s.expected_days ? (
                      <div style={{ fontSize: 11, color: C.textMuted, marginTop: 2 }}>
                        권장 {s.expected_days}일
                      </div>
                    ) : null}
                  </div>
                  <div style={{ width: mob ? "100%" : 200 }}>
                    <CalendarDropdown
                      label="완료일"
                      value={dateVal}
                      onChange={(v) => setDate(s.id, v)}
                      disabled={readonly}
                    />
                  </div>
                </div>

                {items.length > 0 ? (
                  <div
                    style={{
                      display: "flex",
                      flexDirection: "column",
                      gap: 6,
                      marginBottom: 12,
                    }}
                  >
                    {items.map((it) => (
                      <label
                        key={it.id}
                        style={{
                          display: "flex",
                          alignItems: "center",
                          gap: 8,
                          cursor: readonly ? "default" : "pointer",
                          fontSize: 13,
                          color: C.text,
                        }}
                      >
                        <input
                          type="checkbox"
                          checked={!!checked[it.id]}
                          onChange={(e) => setCheck(it.id, e.target.checked)}
                          disabled={readonly}
                          style={{ width: 18, height: 18, accentColor: C.accent }}
                        />
                        <span>{it.label}</span>
                      </label>
                    ))}
                  </div>
                ) : null}

                <PcTextarea
                  value={noteVal}
                  onChange={(e) => setNote(s.id, e.target.value)}
                  rows={2}
                  placeholder={`${s.name} 메모`}
                  disabled={readonly}
                  fullWidth
                />
              </div>
            </div>
          );
        })
      )}
    </div>
  );

  /* ────────────────────────────────────────
   *  푸터 영역
   * ──────────────────────────────────────── */
  const footer = (
    <div
      style={{
        display: "flex",
        justifyContent: "space-between",
        alignItems: "center",
        gap: 8,
        flexWrap: "wrap",
        width: "100%",
      }}
    >
      <div style={{ display: "flex", gap: 6 }}>
        {card.stage === "completed" || card.stage === "dropped" ? (
          <PcButton size="sm" variant="ghost" onClick={handleReopen} disabled={busy || readonly}>
            재개
          </PcButton>
        ) : (
          <>
            <PcButton size="sm" variant="ghost" onClick={handleSnooze} disabled={busy || readonly}>
              보류
            </PcButton>
            <PcButton size="sm" variant="ghost" onClick={handleDrop} disabled={busy || readonly}>
              중단
            </PcButton>
          </>
        )}
      </div>
      <div style={{ display: "flex", gap: 8 }}>
        <PcButton variant="ghost" onClick={onClose} disabled={busy}>
          취소
        </PcButton>
        <PcButton
          variant="secondary"
          onClick={() => void saveAll()}
          disabled={busy || readonly || !dirty}
          loading={busy}
        >
          저장
        </PcButton>
        {card.stage !== "completed" ? (
          <PcButton
            variant="primary"
            onClick={() => void saveAll({ complete: true })}
            disabled={busy || readonly || !allDone}
            title={!allDone ? "모든 단계의 체크리스트와 완료일을 입력해야 합니다." : undefined}
          >
            완료 처리
          </PcButton>
        ) : null}
      </div>
    </div>
  );

  return (
    <PcModalShell
      open={open}
      onClose={onClose}
      title="사역흐름 상세"
      maxWidth={640}
      footer={footer}
    >
      {headerBlock}
      {stepsBlock}
    </PcModalShell>
  );
}

export default WorkflowCardModal;
