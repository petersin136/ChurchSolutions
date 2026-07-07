"use client";

/**
 * 사역흐름 카드 시작(추가) 모달 — 재설계.
 *
 * NewFamilyProgramDetailModal / WorkflowCardModal 과 동일한 컨벤션:
 *   - PcModalShell + ModernSelect/PcSelect + CalendarDropdown + PcTextarea + PcButton
 *   - 한 번에 1명의 성도 + 1개의 사역흐름으로 카드 1개 생성
 *   - presetTemplateKey 가 있으면 사역흐름 선택 UI 숨기고 자동 선택 (자동 카드 흐름)
 *   - presetMember 가 있으면 대상 선택 UI 숨기고 읽기 전용 표시
 */

import { useEffect, useMemo, useState } from "react";
import { PcModalShell } from "@/components/common/PcModalShell";
import { ModernSelect } from "@/components/common/ModernSelect";
import { PcSelect, type PcSelectOption } from "@/components/ui/PcSelect";
import { PcButton } from "@/components/ui/PcButton";
import { PcTextarea } from "@/components/ui/PcTextarea";
import { CalendarDropdown } from "@/components/CalendarDropdown";
import { C } from "@/styles/designTokens";
import { useAppData } from "@/contexts/AppDataContext";
import type {
  Workflow,
  WorkflowCardPriority,
  WorkflowCardSource,
} from "@/types/db";
import {
  createCard,
  getVisibleWorkflows,
  type WorkflowMemberRef,
} from "@/lib/workflow";

/* ──────────────────────────────────────────
 *  Props
 * ────────────────────────────────────────── */
export interface WorkflowTemplatePickerProps {
  open: boolean;
  onClose: () => void;
  /** 미리 선택된 성도 (옵션). 결석자 회복 등 자동 시나리오에서 1명을 자동 채움. */
  presetMember?: WorkflowMemberRef | null;
  /** 시작할 사역흐름 카테고리/템플릿을 강제하고 싶을 때 */
  presetTemplateKey?: Workflow["template_key"] | null;
  /** 카드 생성 시 source 표시 */
  source?: WorkflowCardSource;
  /** 카드 생성 성공 시 호출 — 부모는 이 cardId 로 상세 모달을 바로 열 수 있음 */
  onCreated?: (cardId: string) => void;
  /** 토스트 알림 */
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

const PRIORITY_OPTIONS: { value: WorkflowCardPriority; label: string }[] = [
  { value: "low", label: "낮음" },
  { value: "normal", label: "보통" },
  { value: "high", label: "높음" },
  { value: "urgent", label: "긴급" },
];

/* ──────────────────────────────────────────
 *  Component
 * ────────────────────────────────────────── */
export function WorkflowTemplatePicker({
  open,
  onClose,
  presetMember,
  presetTemplateKey,
  source = "manual",
  onCreated,
  onToast,
}: WorkflowTemplatePickerProps) {
  const mob = useIsMobile();
  const { workflows, db, refreshWorkflowCards } = useAppData();

  // 사역흐름 후보 — presetTemplateKey 가 있으면 new_family 도 통과시켜야 하므로
  // getVisibleWorkflows 를 건너뛰고 직접 필터.
  const activeWfs = useMemo(
    () => (presetTemplateKey
      ? workflows.filter(
          (w) => w.is_active && w.template_key === presetTemplateKey,
        )
      : getVisibleWorkflows(workflows)),
    [workflows, presetTemplateKey],
  );

  const [selectedWfId, setSelectedWfId] = useState<string>("");
  const [memberId, setMemberId] = useState<string>(presetMember?.id ?? "");
  const [priority, setPriority] = useState<WorkflowCardPriority>("normal");
  const [dueDate, setDueDate] = useState<string>("");
  const [initialNote, setInitialNote] = useState<string>("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // 모달 오픈 시 초기화 + preset 반영
  useEffect(() => {
    if (!open) return;
    setMemberId(presetMember?.id ?? "");
    setPriority("normal");
    setDueDate("");
    setInitialNote("");
    setError(null);
  }, [open, presetMember?.id]);

  // presetTemplateKey 가 명시되었거나 후보가 1개 뿐이면 자동 선택
  useEffect(() => {
    if (!open) return;
    if (presetTemplateKey && activeWfs[0]) {
      setSelectedWfId(activeWfs[0].id);
    } else if (!presetTemplateKey && activeWfs.length === 1) {
      setSelectedWfId(activeWfs[0].id);
    } else if (!presetTemplateKey) {
      setSelectedWfId((prev) =>
        activeWfs.some((w) => w.id === prev) ? prev : "",
      );
    }
  }, [open, presetTemplateKey, activeWfs]);

  // ESC 닫기 (PcModalShell 기본은 backdrop 만)
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  const selectedWf = useMemo(
    () => activeWfs.find((w) => w.id === selectedWfId) ?? null,
    [activeWfs, selectedWfId],
  );

  const wfOptions = useMemo(
    () => activeWfs.map((w) => ({ value: w.id, label: w.name })),
    [activeWfs],
  );

  const memberOptions = useMemo<PcSelectOption[]>(
    () => db.members
      .slice()
      .sort((a, b) => (a.name || "").localeCompare(b.name || ""))
      .map((m) => ({
        value: m.id,
        label: m.dept ? `${m.name} · ${m.dept}` : m.name,
      })),
    [db.members],
  );

  const title = useMemo(() => {
    if (presetTemplateKey && selectedWf) return `${selectedWf.name} 카드 시작`;
    return "사역흐름 카드 추가";
  }, [presetTemplateKey, selectedWf]);

  const canSubmit = !!selectedWfId && (!!memberId || !!presetMember?.id);

  if (!open) return null;

  /* ── 카드 시작 ── */
  const handleCreate = async () => {
    if (!selectedWfId) {
      setError("사역흐름을 선택해주세요.");
      return;
    }
    const effectiveMemberId = presetMember?.id ?? memberId;
    if (!effectiveMemberId) {
      setError("대상 성도를 선택해주세요.");
      return;
    }

    let memberRef: WorkflowMemberRef;
    if (presetMember) {
      memberRef = presetMember;
    } else {
      const m = db.members.find((x) => x.id === effectiveMemberId);
      if (!m) {
        setError("선택한 성도 정보를 찾을 수 없습니다.");
        return;
      }
      memberRef = { id: m.id, name: m.name, phone: m.phone ?? null };
    }

    setError(null);
    setBusy(true);
    try {
      const card = await createCard({
        workflowId: selectedWfId,
        member: memberRef,
        source,
        priority,
        dueDate: dueDate || null,
        initialNote: initialNote.trim() || null,
      });
      if (!card?.id) {
        setError("카드 생성에 실패했습니다.");
        onToast?.("카드 생성에 실패했습니다.", "err");
        return;
      }
      await refreshWorkflowCards();
      onToast?.("진행카드가 생성되었습니다.", "ok");
      onCreated?.(card.id);
      onClose();
    } catch (e) {
      console.error("[WorkflowTemplatePicker] create failed:", e);
      setError("카드 생성 중 오류가 발생했습니다.");
      onToast?.("카드 생성에 실패했습니다.", "err");
    } finally {
      setBusy(false);
    }
  };

  /* ── 본문 ── */
  const body = (
    <div style={{ display: "flex", flexDirection: "column", gap: mob ? 14 : 18 }}>
      {error ? (
        <div
          style={{
            padding: "10px 12px",
            borderRadius: 8,
            background: C.dangerBg,
            border: `1px solid ${C.danger}`,
            color: C.danger,
            fontSize: 13,
          }}
        >
          {error}
        </div>
      ) : null}

      {/* a) 사역흐름 — presetTemplateKey 없을 때만 노출 */}
      {!presetTemplateKey ? (
        activeWfs.length === 0 ? (
          <div
            style={{
              padding: "10px 12px",
              borderRadius: 8,
              background: `color-mix(in srgb, ${C.warning} 15%, transparent)`,
              border: `1px solid ${C.warning}`,
              color: C.text,
              fontSize: 13,
            }}
          >
            사용 가능한 사역흐름이 없습니다. 시드 데이터 실행이 필요합니다.
          </div>
        ) : (
          <ModernSelect
            label="사역흐름"
            value={selectedWfId}
            onChange={setSelectedWfId}
            options={wfOptions}
            placeholder="사역흐름을 선택하세요"
          />
        )
      ) : null}

      {/* b) 대상 멤버 */}
      {presetMember ? (
        <div>
          <label
            style={{
              display: "block",
              fontSize: 13,
              fontWeight: 600,
              color: "var(--color-primary)",
              marginBottom: 6,
            }}
          >
            대상
          </label>
          <div
            style={{
              padding: "10px 14px",
              border: `1px solid ${C.border}`,
              borderRadius: 8,
              background: C.bg,
              color: C.text,
              fontSize: 14,
              fontWeight: 600,
            }}
          >
            {presetMember.name}
          </div>
        </div>
      ) : (
        <PcSelect
          label="대상"
          value={memberId}
          onChange={setMemberId}
          options={memberOptions}
          placeholder="성도를 선택하세요"
          searchable
          fullWidth
        />
      )}

      {/* c) 우선순위 */}
      <ModernSelect
        label="우선순위"
        value={priority}
        onChange={(v) => setPriority(v as WorkflowCardPriority)}
        options={PRIORITY_OPTIONS.map((p) => ({ value: p.value, label: p.label }))}
      />

      {/* d) 마감일 */}
      <div>
        <label
          style={{
            display: "block",
            fontSize: 13,
            fontWeight: 600,
            color: "var(--color-primary)",
            marginBottom: 6,
          }}
        >
          마감일 (선택)
        </label>
        <CalendarDropdown
          value={dueDate}
          onChange={setDueDate}
          showClearButton
          onClear={() => setDueDate("")}
        />
      </div>

      {/* e) 초기 메모 */}
      <PcTextarea
        label="초기 메모 (선택)"
        value={initialNote}
        onChange={(e) => setInitialNote(e.target.value)}
        rows={3}
        placeholder="시작 시점의 상황·요청 사항을 적어두면 좋습니다."
        fullWidth
      />
    </div>
  );

  /* ── 푸터 ── */
  const footer = (
    <div
      style={{
        display: "flex",
        justifyContent: "flex-end",
        gap: 8,
        width: "100%",
      }}
    >
      <PcButton variant="ghost" onClick={onClose} disabled={busy}>
        취소
      </PcButton>
      <PcButton
        variant="primary"
        onClick={handleCreate}
        disabled={busy || !canSubmit}
        loading={busy}
      >
        카드 시작
      </PcButton>
    </div>
  );

  return (
    <PcModalShell
      open={open}
      onClose={onClose}
      title={title}
      footer={footer}
    >
      {body}
    </PcModalShell>
  );
}

export default WorkflowTemplatePicker;
