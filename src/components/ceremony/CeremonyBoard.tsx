"use client";

/**
 * 예식 가이드 보드.
 *
 *   - 상단: 페이지 제목 + "새 예식 시작" 액션
 *   - 가로 카테고리 탭: 전체 / 장례 / 추도예배 / 심방예배 / 명절 / 성찬식 / 결혼 / 기타
 *   - 요약 카드 4종: 예정 / 진행중 / 이번 주 / 완료(30일)
 *   - 상태 chip 5종: 전체 / 예정 / 진행중 / 완료 / 취소
 *   - 검색 입력 (제목 + 가족 정보 키 부분일치)
 *   - 본문 섹션 1: 사용 가능한 가이드(템플릿 갤러리) — 3/2/1열 그리드
 *   - 본문 섹션 2: 내 예식(세션 리스트) — WorkflowBoard 의 카드 리스트와 동일 톤
 *
 * 디자인·상태관리 패턴은 `src/components/workflow/WorkflowBoard.tsx` 와 동일.
 * 토큰은 `C` 만 사용하며 hex/Tailwind 직접 사용 없음.
 */

import { useEffect, useMemo, useState } from "react";
import { Plus, Search, BookOpen, Trash2 } from "lucide-react";
import { useAppData } from "@/contexts/AppDataContext";
import type {
  CeremonyTemplate,
  CeremonySession,
  CeremonySessionStatus,
} from "@/types/db";
import { C } from "@/styles/designTokens";
import { useCeremonyPermissions } from "@/lib/permissions";
import {
  getVisibleTemplates,
  getStepsForTemplate,
  deleteSession,
} from "@/lib/ceremony";
import { PcButton } from "@/components/ui/PcButton";
import { PcInput } from "@/components/ui/PcInput";
import { CeremonyTemplatePicker } from "./CeremonyTemplatePicker";
import { CeremonySessionModal } from "./CeremonySessionModal";

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

/* ---------- 상수 / 타입 ---------- */
// TODO: 추후 useAuth 또는 church 설정에서 가져올 것
const HARDCODED_DENOMINATION = "presbyterian_unified";

/** 카테고리 탭에 명시되지 않은 — 또는 사용자가 임의로 입력한 — 카테고리는
 *  자동으로 '기타' 로 묶인다 (whitelist 보다 known 카테고리의 not-in 으로 처리). */
const KNOWN_CATEGORIES = [
  "funeral",
  "memorial",
  "visit",
  "holiday",
  "communion",
  "baptism",
  "wedding",
  "ordination",
] as const;

interface CategoryTab {
  id: string;
  label: string;
  /** 이 탭이 매칭하는 category 코드 목록. null 이면 전체 매칭. */
  categories: readonly string[] | null;
  /** "기타" 처럼 known 에 없는 모든 카테고리를 잡기 위한 inverse 매칭 플래그 */
  matchUnknown?: boolean;
}

const CATEGORY_TABS: CategoryTab[] = [
  { id: "all",       label: "전체",     categories: null },
  { id: "funeral",   label: "장례",     categories: ["funeral"] },
  { id: "memorial",  label: "추도예배", categories: ["memorial"] },
  { id: "visit",     label: "심방예배", categories: ["visit"] },
  { id: "holiday",   label: "명절",     categories: ["holiday"] },
  { id: "communion", label: "성찬식",   categories: ["communion"] },
  { id: "baptism",   label: "세례",     categories: ["baptism"] },
  { id: "wedding",   label: "결혼",     categories: ["wedding"] },
  { id: "ordination", label: "임직",   categories: ["ordination"] },
  { id: "etc",       label: "기타",     categories: null, matchUnknown: true },
];

type StatusFilter = "all" | CeremonySessionStatus;

interface CeremonyBoardProps {
  toast: (message: string, type?: "ok" | "err" | "warn") => void;
}

/* ---------- 헬퍼 ---------- */
function fmtScheduledAt(iso: string | null): string {
  if (!iso) return "일정 미정";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "일정 미정";
  const days = ["일", "월", "화", "수", "목", "금", "토"];
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  const day = days[d.getDay()];
  const hh = String(d.getHours()).padStart(2, "0");
  const mi = String(d.getMinutes()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd} (${day}) ${hh}:${mi}`;
}

function startOfWeek(): Date {
  const now = new Date();
  const day = now.getDay(); // 0=일, 1=월 ...
  const diff = day === 0 ? -6 : 1 - day;
  const monday = new Date(now);
  monday.setDate(now.getDate() + diff);
  monday.setHours(0, 0, 0, 0);
  return monday;
}

function endOfWeekExclusive(): Date {
  const start = startOfWeek();
  const end = new Date(start);
  end.setDate(start.getDate() + 7);
  return end;
}

function statusBadge(status: CeremonySessionStatus): { label: string; fg: string; bg: string } {
  switch (status) {
    case "in_progress":
      return { label: "진행중", fg: C.accent, bg: C.accentBg };
    case "completed":
      return { label: "완료", fg: C.success, bg: C.successBg };
    case "cancelled":
      return { label: "취소", fg: C.textFaint, bg: C.bg };
    case "planned":
    default:
      return { label: "예정", fg: C.textMuted, bg: C.bg };
  }
}

/** 진행률 계산 (체크된 step 개수 / 템플릿의 전체 step 수). */
function calcProgress(
  session: CeremonySession,
  totalSteps: number,
): { checked: number; total: number; pct: number } {
  const checked = Object.values(session.progress_state ?? {})
    .filter((p) => p?.checked === true).length;
  const pct = totalSteps > 0 ? Math.min(100, Math.round((checked / totalSteps) * 100)) : 0;
  return { checked, total: totalSteps, pct };
}

/* ──────────────────────────────────────────
 *  메인 컴포넌트
 * ────────────────────────────────────────── */
export function CeremonyBoard({ toast }: CeremonyBoardProps) {
  const mob = useIsMobile();
  const { ceremonyTemplates, ceremonySteps, ceremonySessions, refreshCeremonySessions } =
    useAppData();
  const { canEdit, canManage } = useCeremonyPermissions();

  const [categoryTabId, setCategoryTabId] = useState<string>("all");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const currentTab = useMemo(
    () => CATEGORY_TABS.find((t) => t.id === categoryTabId) ?? CATEGORY_TABS[0],
    [categoryTabId],
  );

  /** 카테고리 탭 + 교단 + is_active 필터가 적용된 가시 템플릿 */
  const visibleTemplates = useMemo(() => {
    const all = getVisibleTemplates(ceremonyTemplates, HARDCODED_DENOMINATION);
    if (currentTab.matchUnknown) {
      /* 기타 탭: known 에 없는 모든 카테고리 (newyear/easter/thanksgiving/
       * housewarming/등). 사용자가 직접 만든 임의 카테고리도 자동 포함. */
      return all.filter((t) => !(KNOWN_CATEGORIES as readonly string[]).includes(t.category as string));
    }
    if (currentTab.categories === null) return all;
    const cats = currentTab.categories;
    return all.filter((t) => cats.includes(t.category as string));
  }, [ceremonyTemplates, currentTab]);

  /** template_id → template (세션의 category 매칭용) */
  const templateMap = useMemo(() => {
    const m: Record<string, CeremonyTemplate> = {};
    for (const t of ceremonyTemplates) m[t.id] = t;
    return m;
  }, [ceremonyTemplates]);

  /** 템플릿별 식순 통계 (단계 수 / 예상 시간 합계) */
  const templateStats = useMemo(() => {
    const stats: Record<string, { stepCount: number; totalMinutes: number }> = {};
    for (const t of ceremonyTemplates) {
      const ts = getStepsForTemplate(ceremonySteps, t.id);
      const totalMinutes = ts.reduce((acc, s) => acc + (s.duration_minutes ?? 0), 0);
      stats[t.id] = { stepCount: ts.length, totalMinutes };
    }
    return stats;
  }, [ceremonyTemplates, ceremonySteps]);

  /** 카테고리 탭으로 1차 필터링된 세션 */
  const categoryScopedSessions = useMemo(() => {
    if (currentTab.matchUnknown) {
      return ceremonySessions.filter((s) => {
        const t = templateMap[s.template_id];
        if (!t) return false;
        return !(KNOWN_CATEGORIES as readonly string[]).includes(t.category as string);
      });
    }
    if (currentTab.categories === null) return ceremonySessions;
    const cats = currentTab.categories;
    return ceremonySessions.filter((s) => {
      const t = templateMap[s.template_id];
      return t ? cats.includes(t.category as string) : false;
    });
  }, [ceremonySessions, templateMap, currentTab]);

  /** 요약 카드용 카운트 */
  const summary = useMemo(() => {
    const weekStart = startOfWeek();
    const weekEnd = endOfWeekExclusive();
    const cutoff30 = new Date();
    cutoff30.setDate(cutoff30.getDate() - 30);

    let planned = 0;
    let inProgress = 0;
    let thisWeek = 0;
    let completedRecent = 0;

    for (const s of categoryScopedSessions) {
      if (s.status === "planned") planned += 1;
      if (s.status === "in_progress") inProgress += 1;
      if (s.status !== "cancelled" && s.status !== "completed" && s.scheduled_at) {
        const d = new Date(s.scheduled_at);
        if (!Number.isNaN(d.getTime()) && d >= weekStart && d < weekEnd) thisWeek += 1;
      }
      if (s.status === "completed") {
        const ref = s.updated_at ? new Date(s.updated_at) : null;
        if (ref && !Number.isNaN(ref.getTime()) && ref >= cutoff30) completedRecent += 1;
      }
    }
    return { planned, inProgress, thisWeek, completedRecent };
  }, [categoryScopedSessions]);

  /** 상태 chip + 검색어가 적용된 최종 세션 목록 */
  const filteredSessions = useMemo(() => {
    let list = categoryScopedSessions;
    if (statusFilter !== "all") {
      list = list.filter((s) => s.status === statusFilter);
    }
    const q = searchQuery.trim().toLowerCase();
    if (q) {
      list = list.filter((s) => {
        const title = (s.title ?? "").toLowerCase();
        const fi = s.family_info ?? {};
        const dec = String(fi.deceased_name ?? "").toLowerCase();
        const chief = String(fi.chief_mourner ?? "").toLowerCase();
        return title.includes(q) || dec.includes(q) || chief.includes(q);
      });
    }
    return [...list].sort((a, b) => {
      const ta = a.scheduled_at
        ? new Date(a.scheduled_at).getTime()
        : new Date(a.created_at).getTime();
      const tb = b.scheduled_at
        ? new Date(b.scheduled_at).getTime()
        : new Date(b.created_at).getTime();
      return tb - ta;
    });
  }, [categoryScopedSessions, statusFilter, searchQuery]);

  /* ---------- 모달 상태 ---------- */
  const [pickerOpen, setPickerOpen] = useState(false);
  const [pickerInitialTemplateId, setPickerInitialTemplateId] = useState<string | null>(null);
  const [sessionModalId, setSessionModalId] = useState<string | null>(null);

  /* ---------- 핸들러 ---------- */
  const handleStartNew = () => {
    setPickerInitialTemplateId(null);
    setPickerOpen(true);
  };
  const handleTemplateClick = (template: CeremonyTemplate) => {
    setPickerInitialTemplateId(template.id);
    setPickerOpen(true);
  };
  const handleSessionClick = (session: CeremonySession) => {
    setSessionModalId(session.id);
  };
  const handlePickerCreated = (sessionId: string) => {
    // Picker 가 이미 성공 토스트를 띄우지만, 세션 모달을 바로 열어 진행을 이어간다.
    toast("예식이 생성되었습니다.", "ok");
    setSessionModalId(sessionId);
  };

  /** 카드별 인라인 삭제. 카드 클릭(모달 열기)과 분리되어야 하므로 호출부에서
   *  stopPropagation 처리 필요. canManage 권한 + confirm 다이얼로그로 보호. */
  const handleDeleteSession = async (session: CeremonySession) => {
    if (!canManage) {
      toast("관리자/담임/부교역자만 삭제할 수 있습니다.", "warn");
      return;
    }
    const label = session.title || "(제목 없음)";
    if (
      !window.confirm(
        `「${label}」 예식을 영구 삭제하시겠습니까?\n진행 메모도 함께 사라집니다.`,
      )
    ) {
      return;
    }
    setDeletingId(session.id);
    try {
      const ok = await deleteSession(session.id);
      if (ok) {
        await refreshCeremonySessions();
        toast("예식이 삭제되었습니다.", "ok");
      } else {
        toast("삭제에 실패했습니다.", "err");
      }
    } catch (e) {
      console.error("[CeremonyBoard] delete failed:", e);
      toast("삭제에 실패했습니다.", "err");
    } finally {
      setDeletingId(null);
    }
  };

  /* ──────────────────────────────────────────
   *  렌더
   * ────────────────────────────────────────── */
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: mob ? 8 : 12 }}>
      {/* 1) 가로 카테고리 탭 + "새 예식 시작" 액션 (헤더는 UnifiedPageLayout 이 담당) */}
      <div
        style={{
          display: "flex",
          alignItems: "flex-start",
          justifyContent: "space-between",
          gap: 12,
          marginBottom: 2,
        }}
      >
        <div
          role="tablist"
          aria-label="식순 카테고리"
          style={{
            display: "flex",
            gap: 12,
            flexWrap: "wrap",
            flex: 1,
            minWidth: 0,
          }}
        >
          {CATEGORY_TABS.map((tab) => {
            const selected = tab.id === categoryTabId;
            return (
              <button
                key={tab.id}
                role="tab"
                aria-selected={selected}
                type="button"
                onClick={() => setCategoryTabId(tab.id)}
                style={{
                  height: 34,
                  padding: mob ? "0 14px" : "0 16px",
                  borderRadius: 10,
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
                {tab.label}
              </button>
            );
          })}
        </div>
        <PcButton
          variant="primary"
          size={mob ? "sm" : "md"}
          leftIcon={<Plus size={mob ? 13 : 15} />}
          onClick={handleStartNew}
          disabled={!canEdit}
        >
          새 식순 시작
        </PcButton>
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
          { label: "예정",    value: summary.planned,         sub: "planned" },
          { label: "진행중",  value: summary.inProgress,      sub: "in_progress" },
          { label: "이번 주", value: summary.thisWeek,        sub: "scheduled_at" },
          { label: "완료",    value: summary.completedRecent, sub: "최근 30일" },
        ].map((row) => (
          <div
            key={row.label}
            style={{
              background: C.card,
              border: `1px solid ${C.border}`,
              borderRadius: 16,
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

      {/* 4) 상태 필터 chip 5종 */}
      <div
        style={{
          display: "flex",
          flexWrap: "wrap",
          gap: mob ? 8 : 8,
          marginBottom: mob ? 4 : 4,
        }}
      >
        {(
          [
            { id: "all",         label: "전체" },
            { id: "planned",     label: "예정" },
            { id: "in_progress", label: "진행중" },
            { id: "completed",   label: "완료" },
            { id: "cancelled",   label: "취소" },
          ] as { id: StatusFilter; label: string }[]
        ).map((f) => {
          const selected = statusFilter === f.id;
          return (
            <button
              key={f.id}
              type="button"
              onClick={() => setStatusFilter(f.id)}
              style={{
                padding: mob ? "4px 10px" : "8px 14px",
                borderRadius: 8,
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

      {/* 5) 검색 입력 */}
      <div style={{ marginBottom: mob ? 4 : 6, maxWidth: mob ? "100%" : 420 }}>
        <PcInput
          size={mob ? "sm" : "md"}
          placeholder="식순 제목 또는 대상 성도 검색"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          prefix={<Search size={14} color={C.textMuted} />}
        />
      </div>

      {/* 6) 표준 식순 (템플릿 갤러리) */}
      <section style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        <div
          style={{
            display: "flex",
            alignItems: "baseline",
            justifyContent: "space-between",
            gap: 8,
            flexWrap: "wrap",
          }}
        >
          <h3
            style={{
              margin: 0,
              fontSize: mob ? 13 : 15,
              fontWeight: 700,
              color: C.text,
              letterSpacing: "-0.01em",
            }}
          >
            {currentTab.id === "etc" ? "기타 · 우리 교회 식순" : "표준 식순"}
          </h3>
          {currentTab.id === "etc" && canEdit ? (
            <span style={{ fontSize: 11, color: C.textFaint }}>
              자유롭게 만들 수 있는 우리 교회 전용 식순. (목양 &gt; 식순 관리에서 편집)
            </span>
          ) : null}
        </div>
        {visibleTemplates.length === 0 ? (
          <div
            style={{
              background: C.card,
              border: `1px dashed ${C.border}`,
              borderRadius: 16,
              padding: mob ? 20 : 32,
              textAlign: "center",
              boxShadow: "0 1px 3px rgba(0,0,0,0.04)",
            }}
          >
            <BookOpen size={28} color={C.textFaint} style={{ margin: "0 auto 8px" }} />
            <div style={{ fontSize: 13, color: C.textMuted, marginBottom: currentTab.id === "etc" ? 12 : 0 }}>
              {currentTab.id === "etc"
                ? "아직 만든 식순이 없습니다. 표준에 없는 행사·예배는 직접 만들어 사용할 수 있습니다."
                : "이 카테고리에 준비된 표준 식순이 없습니다."}
            </div>
            {currentTab.id === "etc" && canEdit ? (
              <PcButton
                variant="primary"
                size="sm"
                leftIcon={<Plus size={13} />}
                onClick={() => toast("커스텀 식순 만들기는 곧 추가됩니다.", "warn")}
              >
                새 커스텀 식순 만들기
              </PcButton>
            ) : null}
          </div>
        ) : (
          <div
            style={{
              display: "grid",
              gridTemplateColumns: mob
                ? "1fr"
                : "repeat(auto-fill, minmax(260px, 1fr))",
              gap: mob ? 8 : 12,
            }}
          >
            {visibleTemplates.map((t) => {
              const stats = templateStats[t.id] ?? { stepCount: 0, totalMinutes: 0 };
              return (
                <div
                  key={t.id}
                  role="button"
                  tabIndex={0}
                  onClick={() => handleTemplateClick(t)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ") {
                      e.preventDefault();
                      handleTemplateClick(t);
                    }
                  }}
                  style={{
                    background: C.card,
                    border: `1px solid ${C.border}`,
                    borderRadius: 12,
                    padding: 14,
                    cursor: "pointer",
                    boxShadow: "0 1px 3px rgba(0,0,0,0.04)",
                    transition: "box-shadow 0.15s, border-color 0.15s",
                    display: "flex",
                    flexDirection: "column",
                    gap: 8,
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
                  <div
                    style={{
                      display: "flex",
                      alignItems: "flex-start",
                      justifyContent: "space-between",
                      gap: 8,
                    }}
                  >
                    <div
                      style={{
                        fontSize: mob ? 14 : 15,
                        fontWeight: 700,
                        color: C.text,
                        lineHeight: 1.3,
                        minWidth: 0,
                        wordBreak: "keep-all",
                      }}
                    >
                      {t.name}
                    </div>
                    <span
                      style={{
                        display: "inline-flex",
                        alignItems: "center",
                        fontSize: 10,
                        fontWeight: 600,
                        color: t.is_system ? C.textMuted : C.accent,
                        background: t.is_system ? C.bg : C.accentBg,
                        padding: "2px 8px",
                        borderRadius: 12,
                        border: `1px solid ${t.is_system ? C.border : C.accent}`,
                        flexShrink: 0,
                        whiteSpace: "nowrap",
                      }}
                    >
                      {t.is_system ? "표준" : "우리 교회"}
                    </span>
                  </div>
                  {t.description ? (
                    <div
                      style={{
                        fontSize: 12,
                        color: C.textMuted,
                        lineHeight: 1.4,
                        display: "-webkit-box",
                        WebkitLineClamp: 2,
                        WebkitBoxOrient: "vertical",
                        overflow: "hidden",
                      }}
                    >
                      {t.description}
                    </div>
                  ) : (
                    <div style={{ fontSize: 12, color: C.textFaint, lineHeight: 1.4 }}>
                      설명이 없습니다.
                    </div>
                  )}
                  <div
                    style={{
                      display: "flex",
                      flexWrap: "wrap",
                      gap: "2px 12px",
                      fontSize: 11,
                      color: C.textMuted,
                      marginTop: 2,
                    }}
                  >
                    <span>
                      <span style={{ color: C.text, fontWeight: 600 }}>{stats.stepCount}</span>단계
                    </span>
                    {stats.totalMinutes > 0 ? (
                      <span>
                        약{" "}
                        <span style={{ color: C.text, fontWeight: 600 }}>{stats.totalMinutes}</span>
                        분
                      </span>
                    ) : (
                      <span style={{ color: C.textFaint }}>시간 미정</span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </section>

      {/* 7) 내 식순 (세션 리스트) */}
      <section style={{ display: "flex", flexDirection: "column", gap: 10, marginTop: mob ? 6 : 8 }}>
        <h3
          style={{
            margin: 0,
            fontSize: mob ? 13 : 15,
            fontWeight: 700,
            color: C.text,
            letterSpacing: "-0.01em",
          }}
        >
          내 식순
        </h3>
        {filteredSessions.length === 0 ? (
          <div
            style={{
              background: C.card,
              border: `1px dashed ${C.border}`,
              borderRadius: 16,
              padding: mob ? 24 : 40,
              textAlign: "center",
              boxShadow: "0 1px 3px rgba(0,0,0,0.04)",
            }}
          >
            <div style={{ fontSize: 13, color: C.textMuted, marginBottom: 12 }}>
              아직 진행 중인 식순이 없습니다. 우측 상단 &lsquo;새 식순 시작&rsquo; 을 눌러 시작하세요.
            </div>
            <PcButton
              variant="primary"
              size="md"
              leftIcon={<Plus size={14} />}
              onClick={handleStartNew}
              disabled={!canEdit}
            >
              새 식순 시작
            </PcButton>
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {filteredSessions.map((s) => {
              const tpl = templateMap[s.template_id];
              const stats = templateStats[s.template_id];
              const totalSteps = stats?.stepCount ?? 0;
              const prog = calcProgress(s, totalSteps);
              const sb = statusBadge(s.status);
              const initial =
                (s.title || "예").trim().charAt(0) || "예";

              return (
                <div
                  key={s.id}
                  role="button"
                  tabIndex={0}
                  onClick={() => handleSessionClick(s)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ") {
                      e.preventDefault();
                      handleSessionClick(s);
                    }
                  }}
                  style={{
                    background: C.card,
                    border: `1px solid ${C.border}`,
                    borderRadius: 12,
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
                  {/* 좌측: 아바타 + 제목·부제·진행바 */}
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
                        {s.title || "(제목 없음)"}
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
                        <span>
                          <span style={{ color: C.text }}>{tpl?.name ?? "(가이드 없음)"}</span>
                        </span>
                        <span>{fmtScheduledAt(s.scheduled_at)}</span>
                        {s.location ? <span>{s.location}</span> : null}
                      </div>

                      {/* 진행바 */}
                      <div style={{ marginTop: 10 }}>
                        {prog.checked === 0 ? (
                          <span
                            style={{
                              fontSize: mob ? 10 : 11,
                              fontWeight: 600,
                              color: C.textFaint,
                            }}
                          >
                            시작 전
                          </span>
                        ) : (
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
                                borderRadius: 3,
                                overflow: "hidden",
                              }}
                            >
                              <div
                                style={{
                                  height: "100%",
                                  width: `${prog.pct}%`,
                                  background: s.status === "completed" ? C.success : C.accent,
                                  borderRadius: 3,
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
                              {prog.checked}/{prog.total} 단계
                            </span>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* 우측: 상태 뱃지 + 삭제 버튼 */}
                  <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: mob ? 6 : 8,
                      flexShrink: 0,
                      alignSelf: mob ? "flex-start" : "center",
                    }}
                    onClick={(e) => e.stopPropagation()}
                  >
                    <span
                      style={{
                        display: "inline-flex",
                        alignItems: "center",
                        fontSize: mob ? 10 : 12,
                        fontWeight: 600,
                        color: sb.fg,
                        background: sb.bg,
                        padding: mob ? "3px 10px" : "4px 12px",
                        borderRadius: 20,
                        border: `1px solid ${sb.fg}`,
                        whiteSpace: "nowrap",
                      }}
                    >
                      {sb.label}
                    </span>
                    {canManage ? (
                      <button
                        type="button"
                        aria-label="예식 삭제"
                        title="예식 삭제"
                        onClick={(e) => {
                          e.stopPropagation();
                          void handleDeleteSession(s);
                        }}
                        onKeyDown={(e) => e.stopPropagation()}
                        disabled={deletingId === s.id}
                        style={{
                          display: "inline-flex",
                          alignItems: "center",
                          justifyContent: "center",
                          width: mob ? 28 : 32,
                          height: mob ? 28 : 32,
                          borderRadius: 8,
                          border: `1px solid ${C.border}`,
                          background: C.card,
                          color: C.textMuted,
                          cursor: deletingId === s.id ? "wait" : "pointer",
                          padding: 0,
                          fontFamily: "inherit",
                          transition: "background 0.15s, color 0.15s, border-color 0.15s",
                          opacity: deletingId === s.id ? 0.5 : 1,
                        }}
                        onMouseEnter={(e) => {
                          if (deletingId === s.id) return;
                          e.currentTarget.style.background = C.dangerBg;
                          e.currentTarget.style.color = C.danger;
                          e.currentTarget.style.borderColor = C.danger;
                        }}
                        onMouseLeave={(e) => {
                          e.currentTarget.style.background = C.card;
                          e.currentTarget.style.color = C.textMuted;
                          e.currentTarget.style.borderColor = C.border;
                        }}
                      >
                        <Trash2 size={mob ? 14 : 15} />
                      </button>
                    ) : null}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </section>

      {/* ----- 예식 시작 모달 (Step 1·2) ----- */}
      <CeremonyTemplatePicker
        open={pickerOpen}
        onClose={() => setPickerOpen(false)}
        initialTemplateId={pickerInitialTemplateId}
        onCreated={handlePickerCreated}
        toast={toast}
      />

      {/* ----- 세션 상세 모달 ----- */}
      <CeremonySessionModal
        open={sessionModalId != null}
        sessionId={sessionModalId}
        onClose={() => setSessionModalId(null)}
        toast={toast}
      />
    </div>
  );
}

export default CeremonyBoard;
