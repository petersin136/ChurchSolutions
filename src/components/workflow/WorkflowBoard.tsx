"use client";

/**
 * 사역흐름 진행카드 보드.
 *
 *   - 상단: 페이지 제목 + 선택 흐름 부제 + "+ 카드 추가"
 *   - 가로 탭: 활성 사역흐름(getVisibleWorkflows)
 *   - 요약 카드 4종: 진행중 / 완료 / 보류 / 중단
 *   - 필터 chip 5종: 전체 / 진행중 / 완료 / 보류 / 중단
 *   - 본문: 단계별 컬럼 (Kanban) — 카드 클릭 시 WorkflowCardModal 오픈
 *
 * 스타일은 NewFamilySub(`PastoralPage.tsx`)의 sub-tab / 요약 카드 /
 * 필터 chip inline 패턴을 그대로 복제하여 시각적 통일성을 확보한다.
 */

import { useEffect, useMemo, useState } from "react";
import { GitBranch, Plus } from "lucide-react";
import { useAppData } from "@/contexts/AppDataContext";
import type {
  Workflow,
  WorkflowCard,
  WorkflowStep,
  WorkflowCardStage,
} from "@/types/db";
import { C } from "@/styles/designTokens";
import { getVisibleWorkflows } from "@/lib/workflow";
import WorkflowCardModal from "./WorkflowCardModal";
import WorkflowTemplatePicker from "./WorkflowTemplatePicker";

/* ---------- useIsMobile (로컬, 다른 페이지들과 동일 패턴) ---------- */
function useIsMobile(bp = 768) {
  const [m, setM] = useState(false);
  useEffect(() => {
    const c = () => setM(window.innerWidth <= bp);
    c();
    window.addEventListener("resize", c);
    return () => window.removeEventListener("resize", c);
  }, [bp]);
  return m;
}

type StageFilter = "all" | WorkflowCardStage;

export interface WorkflowBoardProps {
  /** 기본 선택할 사역흐름 id (옵션) */
  initialWorkflowId?: string;
  toast?: (msg: string, type?: "ok" | "err" | "warn") => void;
}

/** ISO 일시 → YYYY-MM-DD */
function fmtDate(iso: string | null | undefined): string {
  if (!iso) return "-";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "-";
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

/** stage 별 뱃지 색상·라벨 — C 토큰만 사용 */
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

export function WorkflowBoard({ initialWorkflowId, toast }: WorkflowBoardProps) {
  const mob = useIsMobile();
  const { workflows, workflowSteps, workflowCards } = useAppData();

  const activeWorkflows = useMemo(() => getVisibleWorkflows(workflows), [workflows]);

  const [selectedWorkflowId, setSelectedWorkflowId] = useState<string>(() =>
    initialWorkflowId ?? activeWorkflows[0]?.id ?? "",
  );

  // 활성 사역흐름 목록이 바뀌었는데 선택된 id 가 사라졌다면 첫 번째로 교정
  useEffect(() => {
    if (
      activeWorkflows.length > 0 &&
      !activeWorkflows.some((w) => w.id === selectedWorkflowId)
    ) {
      setSelectedWorkflowId(activeWorkflows[0].id);
    }
  }, [activeWorkflows, selectedWorkflowId]);

  const wf: Workflow | null = useMemo(
    () => activeWorkflows.find((w) => w.id === selectedWorkflowId) ?? activeWorkflows[0] ?? null,
    [activeWorkflows, selectedWorkflowId],
  );

  const steps: WorkflowStep[] = useMemo(
    () => wf
      ? workflowSteps.filter((s) => s.workflow_id === wf.id).sort((a, b) => a.sort_order - b.sort_order)
      : [],
    [workflowSteps, wf],
  );

  /** 현재 선택된 사역흐름에 속한 모든 카드 (필터 적용 전) */
  const workflowCardsScoped = useMemo(
    () => workflowCards.filter((c) => c.workflow_id === wf?.id),
    [workflowCards, wf],
  );

  /** stage 별 집계 — 요약 카드용 */
  const stageCounts = useMemo(
    () => ({
      open:      workflowCardsScoped.filter((c) => c.stage === "open").length,
      completed: workflowCardsScoped.filter((c) => c.stage === "completed").length,
      snoozed:   workflowCardsScoped.filter((c) => c.stage === "snoozed").length,
      dropped:   workflowCardsScoped.filter((c) => c.stage === "dropped").length,
    }),
    [workflowCardsScoped],
  );

  const [stageFilter, setStageFilter] = useState<StageFilter>("all");

  /** 필터 chip 이 적용된 최종 카드 목록 */
  const cards = useMemo(
    () => stageFilter === "all"
      ? workflowCardsScoped
      : workflowCardsScoped.filter((c) => c.stage === stageFilter),
    [workflowCardsScoped, stageFilter],
  );

  /** step id → 진행률 계산용 인덱스(1-base) */
  const stepIndexById = useMemo(() => {
    const map: Record<string, number> = {};
    steps.forEach((s, i) => { map[s.id] = i + 1; });
    return map;
  }, [steps]);

  /** 최신 카드가 위로 — created_at DESC 정렬 */
  const sortedCards = useMemo(
    () => [...cards].sort((a, b) => {
      const ta = a.created_at ? new Date(a.created_at).getTime() : 0;
      const tb = b.created_at ? new Date(b.created_at).getTime() : 0;
      return tb - ta;
    }),
    [cards],
  );

  const [picker, setPicker] = useState(false);
  const [openCardId, setOpenCardId] = useState<string | null>(null);

  /* ---------- 빈 상태: 활성 사역흐름 0개 ---------- */
  if (activeWorkflows.length === 0) {
    return (
      <div
        style={{
          background: C.card,
          border: `1px dashed ${C.border}`,
          borderRadius: 7,
          padding: mob ? 24 : 40,
          textAlign: "center",
          boxShadow: "0 1px 3px rgba(0,0,0,0.04)",
        }}
      >
        <GitBranch size={32} color={C.textFaint} style={{ margin: "0 auto 8px" }} />
        <div style={{ fontSize: 14, fontWeight: 600, color: C.text, marginBottom: 4 }}>
          아직 활성화된 사역흐름이 없습니다.
        </div>
        <div style={{ fontSize: 12, color: C.textMuted }}>
          <code style={{ background: C.bg, padding: "1px 6px", borderRadius: 7 }}>supabase/workflow_system.sql</code>
          {" + "}
          <code style={{ background: C.bg, padding: "1px 6px", borderRadius: 7 }}>supabase/seeds/workflow_templates.sql</code>
          {" 실행이 필요합니다."}
        </div>
      </div>
    );
  }

  /* ---------- 정상 화면 ---------- */
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: mob ? 8 : 12 }}>
      {/* 1) 헤더: 제목 + 부제 + "+ 카드 추가" */}
      <div
        style={{
          display: "flex",
          alignItems: "flex-start",
          justifyContent: "space-between",
          gap: 12,
          marginBottom: 2,
        }}
      >
        <div style={{ minWidth: 0 }}>
          <div
            style={{
              fontSize: mob ? 18 : 24,
              fontWeight: 800,
              color: C.text,
              letterSpacing: "-0.02em",
              lineHeight: 1.15,
            }}
          >
            사역흐름
          </div>
          <div style={{ fontSize: mob ? 11 : 13, color: C.textMuted, marginTop: 2 }}>
            {wf?.name ?? "사역흐름을 선택하세요"}
          </div>
        </div>
        <button
          type="button"
          onClick={() => setPicker(true)}
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: 6,
            height: mob ? 32 : 38,
            padding: mob ? "0 12px" : "0 16px",
            borderRadius: 7,
            background: C.accent,
            color: "var(--color-primary-on)",
            border: "none",
            fontWeight: 600,
            fontSize: mob ? 12 : 13,
            cursor: "pointer",
            fontFamily: "inherit",
            flexShrink: 0,
            transition: "all 0.15s",
          }}
        >
          <Plus size={mob ? 13 : 15} /> 카드 추가
        </button>
      </div>

      {/* 2) 가로 탭: 활성 사역흐름 */}
      <div
        style={{
          display: "flex",
          gap: 12,
          marginBottom: 2,
          flexWrap: "wrap",
        }}
      >
        {activeWorkflows.map((w) => {
          const selected = w.id === (wf?.id ?? "");
          return (
            <button
              key={w.id}
              type="button"
              onClick={() => setSelectedWorkflowId(w.id)}
              style={{
                height: 34,
                padding: mob ? "0 14px" : "0 16px",
                borderRadius: 7,
                fontSize: 13,
                fontWeight: 600,
                cursor: "pointer",
                fontFamily: "inherit",
                background: selected ? C.accentBg : C.card,
                color: selected ? C.accent : C.textMuted,
                border: selected ? `1px solid ${C.accent}` : `1px solid ${C.border}`,
                boxSizing: "border-box",
                whiteSpace: "nowrap",
                transition: "all 0.15s",
              }}
            >
              {w.name}
            </button>
          );
        })}
      </div>

      {/* 3) 요약 카드 4종 */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: mob ? "repeat(2, 1fr)" : "repeat(4, 1fr)",
          gap: mob ? 6 : 12,
          marginBottom: mob ? 8 : 8,
        }}
      >
        {[
          { label: "진행중", value: stageCounts.open,      sub: "open" },
          { label: "완료",   value: stageCounts.completed, sub: "completed" },
          { label: "보류",   value: stageCounts.snoozed,   sub: "snoozed" },
          { label: "중단",   value: stageCounts.dropped,   sub: "dropped" },
        ].map((row) => (
          <div
            key={row.label}
            style={{
              background: C.card,
              border: `1px solid ${C.border}`,
              borderRadius: 7,
              padding: mob ? "8px 10px" : "14px 18px",
              boxShadow: "0 1px 3px rgba(0,0,0,0.04)",
              boxSizing: "border-box",
            }}
          >
            <div style={{ fontSize: 10, color: C.textMuted, marginBottom: 4, lineHeight: 1.2 }}>
              {row.label}
            </div>
            <div
              style={{
                fontSize: 20,
                fontWeight: 800,
                color: C.text,
                lineHeight: 1.15,
                letterSpacing: "-0.02em",
              }}
            >
              {row.value}건
            </div>
            <div style={{ fontSize: 9, color: C.textFaint, marginTop: 4, lineHeight: 1.2 }}>
              {row.sub}
            </div>
          </div>
        ))}
      </div>

      {/* 4) 필터 chip 5종 */}
      <div
        style={{
          display: "flex",
          flexWrap: "wrap",
          gap: mob ? 8 : 8,
          marginBottom: mob ? 12 : 12,
        }}
      >
        {(
          [
            { id: "all",       label: "전체" },
            { id: "open",      label: "진행중" },
            { id: "completed", label: "완료" },
            { id: "snoozed",   label: "보류" },
            { id: "dropped",   label: "중단" },
          ] as { id: StageFilter; label: string }[]
        ).map((f) => {
          const selected = stageFilter === f.id;
          return (
            <button
              key={f.id}
              type="button"
              onClick={() => setStageFilter(f.id)}
              style={{
                padding: mob ? "4px 10px" : "8px 14px",
                borderRadius: 7,
                fontSize: mob ? 10 : 13,
                fontWeight: 600,
                cursor: "pointer",
                fontFamily: "inherit",
                boxSizing: "border-box",
                background: selected ? C.accentBg : C.card,
                color: selected ? C.accent : C.textMuted,
                border: selected ? `1px solid ${C.accent}` : `1px solid ${C.border}`,
                transition: "all 0.15s",
              }}
            >
              {f.label}
            </button>
          );
        })}
      </div>

      {/* 5) 본문 — 세로 리스트 */}
      {sortedCards.length === 0 ? (
        <div
          style={{
            background: C.card,
            border: `1px dashed ${C.border}`,
            borderRadius: 7,
            padding: mob ? 24 : 40,
            textAlign: "center",
            boxShadow: "0 1px 3px rgba(0,0,0,0.04)",
          }}
        >
          <div style={{ fontSize: 13, color: C.textMuted, marginBottom: 12 }}>
            등록된 카드가 없습니다.
          </div>
          <button
            type="button"
            onClick={() => setPicker(true)}
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 6,
              height: 36,
              padding: "0 14px",
              borderRadius: 7,
              background: C.accent,
              color: "var(--color-primary-on)",
              border: "none",
              fontWeight: 600,
              fontSize: 13,
              cursor: "pointer",
              fontFamily: "inherit",
            }}
          >
            <Plus size={14} /> 카드 추가
          </button>
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {sortedCards.map((c) => {
            const currentStep = c.current_step_id
              ? steps.find((s) => s.id === c.current_step_id) ?? null
              : null;
            const currentIdx = currentStep ? (stepIndexById[currentStep.id] ?? 0) : 0;
            const totalSteps = steps.length;
            // 완료 카드는 항상 100%, 그 외에는 현재 단계 sort_order 기준
            const progressPct = c.stage === "completed"
              ? 100
              : totalSteps > 0
                ? Math.min(100, Math.round((currentIdx / totalSteps) * 100))
                : 0;
            const sb = stageBadge(c.stage);
            const initial = (c.member_name || "?").trim().charAt(0) || "?";

            return (
              <div
                key={c.id}
                role="button"
                tabIndex={0}
                onClick={() => setOpenCardId(c.id)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    setOpenCardId(c.id);
                  }
                }}
                style={{
                  background: C.card,
                  border: `1px solid ${C.border}`,
                  borderRadius: 7,
                  padding: 16,
                  cursor: "pointer",
                  boxShadow: "0 1px 3px rgba(0,0,0,0.04)",
                  transition: "box-shadow 0.15s, border-color 0.15s",
                  display: "flex",
                  alignItems: mob ? "flex-start" : "center",
                  flexDirection: mob ? "column" : "row",
                  gap: mob ? 10 : 14,
                  boxSizing: "border-box",
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.boxShadow = "0 4px 12px rgba(0,0,0,0.08)";
                  e.currentTarget.style.borderColor = C.accent;
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.boxShadow = "0 1px 3px rgba(0,0,0,0.04)";
                  e.currentTarget.style.borderColor = C.border;
                }}
              >
                {/* 좌측: 아바타 + 이름·정보·진행바 */}
                <div
                  style={{
                    display: "flex",
                    alignItems: mob ? "flex-start" : "center",
                    gap: mob ? 10 : 14,
                    flex: 1,
                    minWidth: 0,
                    width: mob ? "100%" : undefined,
                  }}
                >
                  {/* 아바타 */}
                  <div
                    style={{
                      width: mob ? 36 : 44,
                      height: mob ? 36 : 44,
                      borderRadius: "50%",
                      background: C.accentBg,
                      color: C.accent,
                      border: `1px solid ${C.border}`,
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      fontWeight: 700,
                      fontSize: mob ? 14 : 18,
                      flexShrink: 0,
                    }}
                  >
                    {initial}
                  </div>

                  {/* 정보 영역 */}
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div
                      style={{
                        fontSize: mob ? 14 : 16,
                        fontWeight: 700,
                        color: C.text,
                        whiteSpace: "nowrap",
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                      }}
                    >
                      {c.member_name}
                    </div>

                    <div
                      style={{
                        display: "flex",
                        flexWrap: "wrap",
                        gap: mob ? "2px 10px" : "2px 14px",
                        fontSize: mob ? 11 : 12,
                        color: C.textMuted,
                        marginTop: 4,
                        lineHeight: 1.4,
                      }}
                    >
                      <span>시작 {fmtDate(c.created_at)}</span>
                      <span>
                        담당{" "}
                        {c.assignee_name ? (
                          <span style={{ color: C.text }}>{c.assignee_name}</span>
                        ) : (
                          <span style={{ color: C.textFaint }}>미배정</span>
                        )}
                      </span>
                      <span>
                        단계{" "}
                        <span style={{ color: C.text }}>
                          {currentStep?.name ?? "미지정"}
                        </span>
                      </span>
                    </div>

                    {/* 진행바 */}
                    <div style={{ marginTop: 10 }}>
                      <div
                        style={{
                          display: "flex",
                          alignItems: "center",
                          gap: 8,
                        }}
                      >
                        <div
                          style={{
                            flex: 1,
                            height: mob ? 4 : 6,
                            background: C.bg,
                            borderRadius: 7,
                            overflow: "hidden",
                          }}
                        >
                          <div
                            style={{
                              height: "100%",
                              width: `${progressPct}%`,
                              background: c.stage === "completed" ? C.success : C.accent,
                              borderRadius: 7,
                              transition: "width 0.3s ease",
                            }}
                          />
                        </div>
                        <span
                          style={{
                            fontSize: mob ? 10 : 11,
                            fontWeight: 600,
                            color: C.textMuted,
                            flexShrink: 0,
                          }}
                        >
                          {currentIdx}/{totalSteps} 단계
                        </span>
                      </div>
                    </div>
                  </div>
                </div>

                {/* 우측: 상태 뱃지 */}
                <span
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    fontSize: mob ? 10 : 12,
                    fontWeight: 600,
                    color: sb.fg,
                    background: sb.bg,
                    padding: mob ? "3px 10px" : "4px 12px",
                    borderRadius: 7,
                    border: `1px solid ${sb.fg}`,
                    flexShrink: 0,
                    alignSelf: mob ? "flex-start" : "center",
                    whiteSpace: "nowrap",
                  }}
                >
                  {sb.label}
                </span>
              </div>
            );
          })}
        </div>
      )}

      <WorkflowTemplatePicker
        open={picker}
        onClose={() => setPicker(false)}
        presetTemplateKey={wf?.template_key ?? undefined}
        onCreated={() => toast?.("진행카드가 생성되었습니다.", "ok")}
      />
      <WorkflowCardModal
        open={!!openCardId}
        cardId={openCardId}
        onClose={() => setOpenCardId(null)}
        onToast={toast}
      />
    </div>
  );
}

export default WorkflowBoard;
