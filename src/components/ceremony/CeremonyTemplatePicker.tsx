"use client";

/**
 * 예식 가이드 시작 모달 — 2단계.
 *
 *   Step 1: 카테고리 탭 + 템플릿 카드 그리드에서 가이드 선택
 *   Step 2: 선택된 가이드의 요약 + 입력 폼 (제목·일정·장소·대상·유족 정보)
 *
 * 시각적 톤은 src/components/workflow/WorkflowTemplatePicker.tsx 와 동일:
 *   - PcModalShell + PcButton + PcInput + PcTextarea + PcSelect + ModernSelect + CalendarDropdown
 *   - 푸터 우측 정렬, 좌측 ghost / 우측 primary
 *   - 인라인 스타일은 C 디자인 토큰만 사용
 *
 * 구조는 사역흐름과 다름 — 사역흐름은 한 번에 한 폼이지만, 예식은
 *   "어떤 가이드로 시작할지" 가 1단계, "그 가이드의 인스턴스(세션) 만들기"
 *   가 2단계로 분리되어 있다.
 */

import { useEffect, useMemo, useState } from "react";
import { Plus, ArrowLeft } from "lucide-react";
import { PcModalShell } from "@/components/common/PcModalShell";
import { PcButton } from "@/components/ui/PcButton";
import { PcInput } from "@/components/ui/PcInput";
import { PcTextarea } from "@/components/ui/PcTextarea";
import { PcSelect, type PcSelectOption } from "@/components/ui/PcSelect";
import { ModernSelect, type ModernSelectOption } from "@/components/common/ModernSelect";
import { CalendarDropdown } from "@/components/CalendarDropdown";
import { C } from "@/styles/designTokens";
import { useAppData } from "@/contexts/AppDataContext";
import { useAuth } from "@/contexts/AuthContext";
import { useCeremonyPermissions } from "@/lib/permissions";
import {
  getVisibleTemplates,
  getStepsForTemplate,
  createSession,
} from "@/lib/ceremony";
import type {
  CeremonyTemplate,
  CeremonyFamilyInfo,
  Member,
} from "@/types/db";

/* ---------- useIsMobile ---------- */
function useIsMobile(bp = 720): boolean {
  const [m, setM] = useState(false);
  useEffect(() => {
    if (typeof window === "undefined") return;
    const c = () => setM(window.innerWidth <= bp);
    c();
    window.addEventListener("resize", c);
    return () => window.removeEventListener("resize", c);
  }, [bp]);
  return m;
}

/* ---------- 상수 ---------- */
// TODO: 추후 useAuth 또는 church 설정에서 가져올 것
const HARDCODED_DENOMINATION = "presbyterian_unified";

const ETC_CATEGORIES = ["newyear", "easter", "housewarming", "ordination"] as const;

interface CategoryTab {
  id: string;
  label: string;
  categories: readonly string[] | null;
}

const CATEGORY_TABS: CategoryTab[] = [
  { id: "all",       label: "전체",     categories: null },
  { id: "funeral",   label: "장례",     categories: ["funeral"] },
  { id: "memorial",  label: "추도예배", categories: ["memorial"] },
  { id: "visit",     label: "심방예배", categories: ["visit"] },
  { id: "holiday",   label: "명절",     categories: ["holiday"] },
  { id: "communion", label: "성찬식",   categories: ["communion"] },
  { id: "wedding",   label: "결혼",     categories: ["wedding"] },
  { id: "etc",       label: "기타",     categories: ETC_CATEGORIES },
];

/** 30분 단위 06:00 ~ 23:30 */
const TIME_SLOTS: ModernSelectOption[] = (() => {
  const slots: ModernSelectOption[] = [];
  for (let h = 6; h < 24; h++) {
    for (let m = 0; m < 60; m += 30) {
      const hh = String(h).padStart(2, "0");
      const mm = String(m).padStart(2, "0");
      const v = `${hh}:${mm}`;
      slots.push({ value: v, label: v });
    }
  }
  return slots;
})();

/* ---------- 헬퍼 ---------- */
function buildDefaultTitle(template: CeremonyTemplate | null, member: Member | null): string {
  if (!template) return "";
  const name = member?.name?.trim() ?? "";
  if (name) {
    switch (template.category) {
      case "funeral":
        return `故 ${name} 성도 ${template.name}`;
      case "memorial":
        return `${name} 성도 추도예배`;
      case "visit":
        return `${name} 가정 심방예배`;
      case "wedding":
        return `${name} 성도 결혼예식`;
      case "housewarming":
        return `${name} 성도 가정 ${template.name}`;
      case "ordination":
        return `${name} ${template.name}`;
      default:
        return template.name;
    }
  }
  return template.name;
}

/** 카테고리별 폼 placeholder/label 세트.
 *  장례 가정이 전부 default 였던 기존 동작을 카테고리별로 분리.
 *  template.category 가 null/unknown 인 경우는 generic 으로 fallback. */
interface CategoryFormCopy {
  titleEx: string;
  locationEx: string;
  subjectLabel: string;
  familyLabel: string;
  familyEx: string;
}

function getCategoryFormCopy(category: string | null | undefined): CategoryFormCopy {
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
        subjectLabel: "신랑·신부 (선택)",
        familyLabel: "양가·가족 정보 (선택)",
        familyEx: "신랑 측: ○○○ 장로 자녀\n신부 측: ○○○ 권사 자녀\n참석 인원: 약 ○○명",
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

/** YYYY-MM-DD + HH:MM → ISO. 빈 입력이면 null. */
function combineScheduledAt(date: string, time: string): string | null {
  if (!date) return null;
  const t = time && /^\d{2}:\d{2}$/.test(time) ? time : "00:00";
  const iso = new Date(`${date}T${t}:00`);
  if (Number.isNaN(iso.getTime())) return null;
  return iso.toISOString();
}

/* ---------- Props ---------- */
export interface CeremonyTemplatePickerProps {
  open: boolean;
  onClose: () => void;
  /** 미리 선택된 템플릿 id (경로 B). 있으면 Step 2 부터 시작 */
  initialTemplateId?: string | null;
  /** 세션 생성 성공 시 호출 — 새로 만든 session id 를 전달 */
  onCreated: (sessionId: string) => void;
  toast: (message: string, type?: "ok" | "err" | "warn") => void;
}

/* ──────────────────────────────────────────
 *  Component
 * ────────────────────────────────────────── */
export function CeremonyTemplatePicker({
  open,
  onClose,
  initialTemplateId,
  onCreated,
  toast,
}: CeremonyTemplatePickerProps) {
  const mob = useIsMobile();
  const { ceremonyTemplates, ceremonySteps, db, refreshCeremonySessions } = useAppData();
  const { user, churchId } = useAuth();
  const { canEdit } = useCeremonyPermissions();

  /* ---------- state ---------- */
  const [step, setStep] = useState<1 | 2>(initialTemplateId ? 2 : 1);
  const [selectedTemplateId, setSelectedTemplateId] = useState<string | null>(
    initialTemplateId ?? null,
  );
  const [categoryFilter, setCategoryFilter] = useState<string>("all");

  const [title, setTitle] = useState<string>("");
  const [titleDirty, setTitleDirty] = useState(false);
  const [scheduledDate, setScheduledDate] = useState<string>("");
  const [scheduledTime, setScheduledTime] = useState<string>("");
  const [location, setLocation] = useState<string>("");
  const [subjectMemberId, setSubjectMemberId] = useState<string>("");
  const [familyNote, setFamilyNote] = useState<string>("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  /* ---------- 모달 open/close 시 상태 리셋 ---------- */
  useEffect(() => {
    if (!open) {
      setStep(1);
      setSelectedTemplateId(null);
      setCategoryFilter("all");
      setTitle("");
      setTitleDirty(false);
      setScheduledDate("");
      setScheduledTime("");
      setLocation("");
      setSubjectMemberId("");
      setFamilyNote("");
      setSaving(false);
      setError(null);
      return;
    }
    // 모달이 열릴 때마다 initialTemplateId 기반 진입 분기 재계산
    if (initialTemplateId) {
      setStep(2);
      setSelectedTemplateId(initialTemplateId);
    } else {
      setStep(1);
      setSelectedTemplateId(null);
    }
  }, [open, initialTemplateId]);

  /* ---------- 파생 데이터 ---------- */
  const currentTab = useMemo(
    () => CATEGORY_TABS.find((t) => t.id === categoryFilter) ?? CATEGORY_TABS[0],
    [categoryFilter],
  );

  const visibleTemplatesAll = useMemo(
    () => getVisibleTemplates(ceremonyTemplates, HARDCODED_DENOMINATION),
    [ceremonyTemplates],
  );

  const visibleTemplates = useMemo(() => {
    if (currentTab.categories === null) return visibleTemplatesAll;
    const cats = currentTab.categories;
    return visibleTemplatesAll.filter((t) => cats.includes(t.category as string));
  }, [visibleTemplatesAll, currentTab]);

  const selectedTemplate = useMemo(
    () => (selectedTemplateId
      ? ceremonyTemplates.find((t) => t.id === selectedTemplateId) ?? null
      : null),
    [ceremonyTemplates, selectedTemplateId],
  );

  const selectedSteps = useMemo(
    () => (selectedTemplateId ? getStepsForTemplate(ceremonySteps, selectedTemplateId) : []),
    [ceremonySteps, selectedTemplateId],
  );

  const totalMinutes = useMemo(
    () => selectedSteps.reduce((acc, s) => acc + (s.duration_minutes ?? 0), 0),
    [selectedSteps],
  );

  const subjectMember = useMemo(
    () => (subjectMemberId ? db.members.find((m) => m.id === subjectMemberId) ?? null : null),
    [db.members, subjectMemberId],
  );

  const memberOptions = useMemo<PcSelectOption[]>(() => {
    const opts: PcSelectOption[] = [{ value: "", label: "선택 안 함" }];
    for (const m of db.members.slice().sort((a, b) => (a.name || "").localeCompare(b.name || ""))) {
      const tag = m.mokjang || m.dept || m.role || "";
      opts.push({ value: m.id, label: tag ? `${m.name} · ${tag}` : m.name });
    }
    return opts;
  }, [db.members]);

  /* ---------- 자동 제목 (dirty 아니면) ---------- */
  useEffect(() => {
    if (!open) return;
    if (step !== 2) return;
    if (titleDirty) return;
    setTitle(buildDefaultTitle(selectedTemplate, subjectMember));
  }, [open, step, selectedTemplate, subjectMember, titleDirty]);

  /* ---------- 카테고리별 폼 카피 ---------- */
  const formCopy = useMemo(
    () => getCategoryFormCopy(selectedTemplate?.category),
    [selectedTemplate?.category],
  );

  /* ---------- 핸들러 ---------- */
  const handlePickTemplate = (templateId: string) => {
    setSelectedTemplateId(templateId);
    setStep(2);
    setError(null);
  };

  const handleBackToStep1 = () => {
    setStep(1);
    setSelectedTemplateId(null);
    setError(null);
  };

  const handleSubmit = async () => {
    if (!selectedTemplate || !selectedTemplateId) {
      setError("가이드를 먼저 선택해주세요.");
      return;
    }
    if (!churchId) {
      setError("교회 정보를 확인할 수 없습니다.");
      toast("교회 정보를 확인할 수 없습니다.", "err");
      return;
    }
    const trimmedTitle = title.trim();
    if (!trimmedTitle) {
      setError("예식 제목을 입력해주세요.");
      return;
    }

    setError(null);
    setSaving(true);
    try {
      const familyInfo: CeremonyFamilyInfo = familyNote.trim()
        ? { free_note: familyNote.trim() }
        : {};

      const session = await createSession({
        churchId,
        templateId: selectedTemplateId,
        title: trimmedTitle,
        scheduledAt: combineScheduledAt(scheduledDate, scheduledTime),
        location: location.trim() || null,
        leaderUserId: user?.id ?? null,
        subjectMemberId: subjectMemberId || null,
        familyInfo,
        notes: null,
      });

      if (!session?.id) {
        setError("생성에 실패했습니다. 잠시 후 다시 시도하세요.");
        toast("생성에 실패했습니다. 잠시 후 다시 시도하세요.", "err");
        return;
      }

      await refreshCeremonySessions();
      toast("예식이 생성되었습니다.", "ok");
      onCreated(session.id);
      onClose();
    } catch (e) {
      console.error("[CeremonyTemplatePicker] createSession failed:", e);
      setError("생성에 실패했습니다. 잠시 후 다시 시도하세요.");
      toast("생성에 실패했습니다. 잠시 후 다시 시도하세요.", "err");
    } finally {
      setSaving(false);
    }
  };

  /* ---------- 가드 ---------- */
  if (!open) return null;

  const canSubmit = step === 2 && !!selectedTemplateId && !!title.trim() && canEdit;

  /* ──────────────────────────────────────────
   *  Step 1 — 템플릿 선택
   * ────────────────────────────────────────── */
  const step1Body = (
    <div style={{ display: "flex", flexDirection: "column", gap: mob ? 12 : 16 }}>
      {/* 카테고리 탭 */}
      <div
        role="tablist"
        aria-label="예식 카테고리"
        style={{
          display: "flex",
          gap: 8,
          flexWrap: "wrap",
        }}
      >
        {CATEGORY_TABS.map((tab) => {
          const selected = tab.id === categoryFilter;
          return (
            <button
              key={tab.id}
              role="tab"
              aria-selected={selected}
              type="button"
              onClick={() => setCategoryFilter(tab.id)}
              style={{
                height: 30,
                padding: mob ? "0 10px" : "0 12px",
                borderRadius: 8,
                fontSize: 12,
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

      {/* 템플릿 그리드 */}
      {visibleTemplates.length === 0 ? (
        <div
          style={{
            background: C.bg,
            border: `1px dashed ${C.border}`,
            borderRadius: 12,
            padding: mob ? 20 : 32,
            textAlign: "center",
            color: C.textMuted,
            fontSize: 13,
          }}
        >
          이 카테고리에 사용 가능한 가이드가 없습니다.
        </div>
      ) : (
        <div
          style={{
            display: "grid",
            gridTemplateColumns: mob
              ? "1fr"
              : "repeat(auto-fill, minmax(200px, 1fr))",
            gap: mob ? 8 : 10,
          }}
        >
          {visibleTemplates.map((t) => {
            const steps = getStepsForTemplate(ceremonySteps, t.id);
            const totalMin = steps.reduce((acc, s) => acc + (s.duration_minutes ?? 0), 0);
            return (
              <div
                key={t.id}
                role="button"
                tabIndex={0}
                onClick={() => handlePickTemplate(t.id)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    handlePickTemplate(t.id);
                  }
                }}
                style={{
                  background: C.card,
                  border: `1px solid ${C.border}`,
                  borderRadius: 10,
                  padding: 12,
                  cursor: "pointer",
                  boxShadow: "0 1px 3px rgba(0,0,0,0.04)",
                  transition: "box-shadow 0.15s, border-color 0.15s",
                  display: "flex",
                  flexDirection: "column",
                  gap: 6,
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
                    gap: 6,
                  }}
                >
                  <div
                    style={{
                      fontSize: 13,
                      fontWeight: 700,
                      color: C.text,
                      lineHeight: 1.3,
                      wordBreak: "keep-all",
                      minWidth: 0,
                    }}
                  >
                    {t.name}
                  </div>
                  <span
                    style={{
                      display: "inline-flex",
                      alignItems: "center",
                      fontSize: 9,
                      fontWeight: 600,
                      color: t.is_system ? C.textMuted : C.accent,
                      background: t.is_system ? C.bg : C.accentBg,
                      padding: "1px 6px",
                      borderRadius: 10,
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
                      fontSize: 11,
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
                ) : null}
                <div
                  style={{
                    display: "flex",
                    flexWrap: "wrap",
                    gap: "0 10px",
                    fontSize: 10,
                    color: C.textMuted,
                    marginTop: 2,
                  }}
                >
                  <span>
                    <span style={{ color: C.text, fontWeight: 600 }}>{steps.length}</span>단계
                  </span>
                  {totalMin > 0 ? (
                    <span>
                      약 <span style={{ color: C.text, fontWeight: 600 }}>{totalMin}</span>분
                    </span>
                  ) : null}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* 좌하단 안내 */}
      <div
        style={{
          fontSize: 11,
          color: C.textFaint,
          lineHeight: 1.5,
          paddingTop: 4,
        }}
      >
        표준 가이드는 장로교 합동/통합 기준입니다. &lsquo;우리 교회&rsquo; 가이드는{" "}
        <span style={{ color: C.textMuted }}>[목양 &gt; 예식]</span> 에서 직접 만들 수 있습니다.
      </div>
    </div>
  );

  /* ──────────────────────────────────────────
   *  Step 2 — 입력 폼
   * ────────────────────────────────────────── */
  const previewSteps = selectedSteps.slice(0, 3);
  const remainingSteps = Math.max(0, selectedSteps.length - 3);

  const formId = "ceremony-template-picker-form";

  const step2Body = (
    <form
      id={formId}
      onSubmit={(e) => {
        e.preventDefault();
        void handleSubmit();
      }}
      style={{ display: "flex", flexDirection: "column", gap: mob ? 14 : 18 }}
    >
      {/* 선택된 템플릿 요약 + 다른 가이드 선택 링크 */}
      {selectedTemplate ? (
        <div
          style={{
            display: "flex",
            alignItems: "flex-start",
            justifyContent: "space-between",
            gap: 10,
            padding: "12px 14px",
            background: C.accentBg,
            border: `1px solid ${C.accent}`,
            borderRadius: 10,
          }}
        >
          <div style={{ minWidth: 0 }}>
            <div
              style={{
                fontSize: 14,
                fontWeight: 700,
                color: C.text,
                lineHeight: 1.3,
              }}
            >
              {selectedTemplate.name}
            </div>
            <div
              style={{
                display: "flex",
                flexWrap: "wrap",
                gap: "0 12px",
                fontSize: 11,
                color: C.textMuted,
                marginTop: 4,
              }}
            >
              <span>
                <span style={{ color: C.text, fontWeight: 600 }}>{selectedSteps.length}</span>단계
              </span>
              {totalMinutes > 0 ? (
                <span>
                  약 <span style={{ color: C.text, fontWeight: 600 }}>{totalMinutes}</span>분
                </span>
              ) : null}
              <span style={{ color: selectedTemplate.is_system ? C.textMuted : C.accent }}>
                {selectedTemplate.is_system ? "표준 가이드" : "우리 교회 가이드"}
              </span>
            </div>
          </div>
          {!initialTemplateId ? (
            <PcButton
              variant="link"
              size="sm"
              leftIcon={<ArrowLeft size={12} />}
              onClick={handleBackToStep1}
            >
              다른 가이드 선택
            </PcButton>
          ) : null}
        </div>
      ) : (
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
          선택된 가이드를 찾을 수 없습니다. 다른 가이드를 선택해주세요.
        </div>
      )}

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

      {/* 1) 제목 */}
      <PcInput
        label="예식 제목"
        value={title}
        onChange={(e) => {
          setTitle(e.target.value);
          setTitleDirty(true);
        }}
        placeholder={formCopy.titleEx}
        autoFocus
        required
      />

      {/* 2) 일정 — 날짜 + 시간 */}
      <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
        <label
          style={{
            fontSize: 13,
            fontWeight: 600,
            color: "var(--color-primary)",
          }}
        >
          일정 (선택)
        </label>
        <div
          style={{
            display: "flex",
            gap: 8,
            flexWrap: "wrap",
          }}
        >
          <div style={{ flex: 1, minWidth: 160 }}>
            <CalendarDropdown
              value={scheduledDate}
              onChange={setScheduledDate}
              showClearButton
              onClear={() => setScheduledDate("")}
            />
          </div>
          <div style={{ width: mob ? "100%" : 130 }}>
            <ModernSelect
              value={scheduledTime}
              onChange={setScheduledTime}
              options={TIME_SLOTS}
              placeholder="시간"
            />
          </div>
        </div>
      </div>

      {/* 3) 장소 */}
      <PcInput
        label="장소 (선택)"
        value={location}
        onChange={(e) => setLocation(e.target.value)}
        placeholder={formCopy.locationEx}
      />

      {/* 4) 대상 성도 */}
      <PcSelect
        label={formCopy.subjectLabel}
        value={subjectMemberId}
        onChange={setSubjectMemberId}
        options={memberOptions}
        placeholder="성도를 검색·선택하세요"
        searchable
        fullWidth
      />

      {/* 5) 유족/가족 정보 */}
      <PcTextarea
        label={formCopy.familyLabel}
        value={familyNote}
        onChange={(e) => setFamilyNote(e.target.value)}
        rows={4}
        placeholder={formCopy.familyEx}
        fullWidth
      />

      {/* 6) 인도자 — TODO: 추후 인도자 선택 UI 추가 예정 (현재는 본인 자동) */}

      {/* 식순 미리보기 */}
      {previewSteps.length > 0 ? (
        <div
          style={{
            background: C.bg,
            border: `1px solid ${C.border}`,
            borderRadius: 10,
            padding: "10px 12px",
          }}
        >
          <div
            style={{
              fontSize: 11,
              fontWeight: 600,
              color: C.textMuted,
              marginBottom: 6,
            }}
          >
            식순 미리보기
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
            {previewSteps.map((s) => (
              <div
                key={s.id}
                style={{
                  fontSize: 12,
                  color: C.textMuted,
                  lineHeight: 1.4,
                }}
              >
                <span style={{ color: C.text, fontWeight: 600 }}>{s.step_order}.</span> {s.title}
              </div>
            ))}
            {remainingSteps > 0 ? (
              <div
                style={{
                  fontSize: 11,
                  color: C.textFaint,
                  marginTop: 2,
                }}
              >
                외 {remainingSteps}개 단계
              </div>
            ) : null}
          </div>
        </div>
      ) : null}
    </form>
  );

  /* ──────────────────────────────────────────
   *  Footer
   * ────────────────────────────────────────── */
  const footer = step === 1 ? (
    <div style={{ display: "flex", justifyContent: "flex-end", gap: 8, width: "100%" }}>
      <PcButton variant="ghost" onClick={onClose}>
        취소
      </PcButton>
    </div>
  ) : (
    <div style={{ display: "flex", justifyContent: "flex-end", gap: 8, width: "100%" }}>
      <PcButton variant="ghost" onClick={onClose} disabled={saving}>
        취소
      </PcButton>
      <PcButton
        type="submit"
        form={formId}
        variant="primary"
        leftIcon={<Plus size={14} />}
        disabled={!canSubmit || saving}
        loading={saving}
      >
        세션 만들기
      </PcButton>
    </div>
  );

  return (
    <PcModalShell
      open={open}
      onClose={onClose}
      title="새 예식 시작"
      maxWidth={720}
      footer={footer}
    >
      {step === 1 ? step1Body : step2Body}
    </PcModalShell>
  );
}

export default CeremonyTemplatePicker;
