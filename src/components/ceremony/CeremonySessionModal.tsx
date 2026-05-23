"use client";

/**
 * 예식 가이드 — 세션 상세/진행 모달.
 *
 *   - 헤더: 제목 + 상태 뱃지
 *   - 상단 액션 바: 상태별 액션 버튼 + 진행률
 *   - 메타 정보 아코디언: 제목·일정·장소·대상·유족·인도자 (수정 후 명시적 저장)
 *   - 식순 아코디언: 각 step 의 콘텐츠(인도자 멘트·찬송·성경구절·기도문 예시·팁)
 *     + 체크박스(즉시 저장, 직렬화된 큐로 race-condition 방지)
 *   - 진행 메모: 모달 open 시 lazy fetch, 새 메모는 prepend.
 *
 * 시각적 톤은 src/components/workflow/WorkflowCardModal.tsx 와 동일:
 *   PcModalShell + PcButton + PcInput + PcTextarea + PcSelect + ModernSelect + CalendarDropdown
 */

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import {
  ChevronDown,
  ChevronUp,
  ChevronRight,
  Play,
  Check,
  X,
  RotateCcw,
  Trash2,
  Save,
  Plus,
  Calendar,
  Clock,
  Printer,
  FileText,
} from "lucide-react";
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
  getStepsForTemplate,
  updateSession,
  toggleStepProgress,
  startSession,
  completeSession,
  cancelSession,
  deleteSession,
  addSessionNote,
  fetchSessionNotes,
  getCategoryFormCopy,
  substituteCeremonyPlaceholders,
} from "@/lib/ceremony";
import { CeremonyPrintView } from "./CeremonyPrintView";
import type {
  CeremonySession,
  CeremonySessionNote,
  CeremonySessionStatus,
  CeremonyProgressState,
  CeremonyStepProgress,
  CeremonyFamilyInfo,
} from "@/types/db";

/* ──────────────────────────────────────────
 *  useIsMobile
 * ────────────────────────────────────────── */
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

/* ──────────────────────────────────────────
 *  상수
 * ────────────────────────────────────────── */
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

/* ──────────────────────────────────────────
 *  헬퍼
 * ────────────────────────────────────────── */
function statusBadge(status: CeremonySessionStatus): {
  label: string;
  fg: string;
  bg: string;
  border: string;
} {
  switch (status) {
    case "in_progress":
      return { label: "진행중", fg: C.accent, bg: C.accentBg, border: C.accent };
    case "completed":
      return { label: "완료", fg: C.success, bg: C.successBg, border: C.success };
    case "cancelled":
      return { label: "취소", fg: C.textFaint, bg: C.bg, border: C.border };
    case "planned":
    default:
      return { label: "예정", fg: C.textMuted, bg: C.bg, border: C.border };
  }
}

function fmtNoteTime(iso: string | null | undefined): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  const y = d.getFullYear();
  const mo = String(d.getMonth() + 1).padStart(2, "0");
  const da = String(d.getDate()).padStart(2, "0");
  const h = String(d.getHours()).padStart(2, "0");
  const mi = String(d.getMinutes()).padStart(2, "0");
  return `${y}-${mo}-${da} ${h}:${mi}`;
}

function splitScheduledAt(iso: string | null): { date: string; time: string } {
  if (!iso) return { date: "", time: "" };
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return { date: "", time: "" };
  const y = d.getFullYear();
  const mo = String(d.getMonth() + 1).padStart(2, "0");
  const da = String(d.getDate()).padStart(2, "0");
  const h = String(d.getHours()).padStart(2, "0");
  const mi = String(d.getMinutes()).padStart(2, "0");
  return { date: `${y}-${mo}-${da}`, time: `${h}:${mi}` };
}

function combineScheduledAt(date: string, time: string): string | null {
  if (!date) return null;
  const t = time && /^\d{2}:\d{2}$/.test(time) ? time : "00:00";
  const iso = new Date(`${date}T${t}:00`);
  if (Number.isNaN(iso.getTime())) return null;
  return iso.toISOString();
}

function shortUserLabel(userId: string | null | undefined): string {
  if (!userId) return "사용자";
  return userId.length > 8 ? `${userId.slice(0, 8)}…` : userId;
}

/* ──────────────────────────────────────────
 *  Props
 * ────────────────────────────────────────── */
export interface CeremonySessionModalProps {
  open: boolean;
  sessionId: string | null;
  onClose: () => void;
  toast: (message: string, type?: "ok" | "err" | "warn") => void;
}

/* ──────────────────────────────────────────
 *  Component
 * ────────────────────────────────────────── */
export function CeremonySessionModal({
  open,
  sessionId,
  onClose,
  toast,
}: CeremonySessionModalProps) {
  const mob = useIsMobile();
  const {
    ceremonyTemplates,
    ceremonySteps,
    ceremonySessions,
    db,
    refreshCeremonySessions,
  } = useAppData();
  const { user, churchName } = useAuth();
  const { canManage, canEdit } = useCeremonyPermissions();

  /* ---------- 데이터 lookup ---------- */
  const session = useMemo<CeremonySession | null>(
    () => (sessionId ? ceremonySessions.find((s) => s.id === sessionId) ?? null : null),
    [ceremonySessions, sessionId],
  );
  const template = useMemo(
    () => (session ? ceremonyTemplates.find((t) => t.id === session.template_id) ?? null : null),
    [ceremonyTemplates, session],
  );
  const steps = useMemo(
    () => (session ? getStepsForTemplate(ceremonySteps, session.template_id) : []),
    [ceremonySteps, session],
  );
  const subjectMember = useMemo(
    () => (session?.subject_member_id
      ? db.members.find((m) => m.id === session.subject_member_id) ?? null
      : null),
    [db.members, session?.subject_member_id],
  );
  /**
   * 두 번째 대상자 (예: 결혼예식 신부) - family_info.partner_member_id 기준.
   * 인쇄 헤더에서 신랑·신부 두 이름을 함께 노출하기 위해 사용.
   */
  const partnerMember = useMemo(() => {
    const pid =
      typeof session?.family_info?.partner_member_id === "string"
        ? (session.family_info.partner_member_id as string)
        : "";
    if (!pid) return null;
    return db.members.find((m) => m.id === pid) ?? null;
  }, [db.members, session?.family_info?.partner_member_id]);

  /* ---------- 진행 상태 (낙관적 미러) ---------- */
  const [progressState, setProgressState] = useState<CeremonyProgressState>({});

  /* ---------- 메타 편집 폼 state ---------- */
  const [titleInput, setTitleInput] = useState("");
  const [dateInput, setDateInput] = useState("");
  const [timeInput, setTimeInput] = useState("");
  const [locationInput, setLocationInput] = useState("");
  const [subjectInput, setSubjectInput] = useState("");
  /** 두 번째 대상자 (결혼예식 신부 등) — family_info.partner_member_id 에 저장 */
  const [partnerInput, setPartnerInput] = useState("");
  const [familyNoteInput, setFamilyNoteInput] = useState("");
  /**
   * 인도자 표시 이름 — system user (`leader_user_id`) 외에 외부 강사·노회장 등을
   * 자유 입력으로 표시하기 위한 필드. family_info.leader_name_override 에 저장.
   */
  const [leaderNameInput, setLeaderNameInput] = useState("");
  const [metaSaving, setMetaSaving] = useState(false);
  const [metaCollapsed, setMetaCollapsed] = useState(false);

  /**
   * 폼 값을 초기화한 session id 를 추적.
   * 같은 세션의 realtime 업데이트가 도착해도 사용자가 편집 중인 폼 입력을
   * 덮어쓰지 않도록 sessionId 가 바뀔 때 한 번만 init.
   */
  const initedSessionIdRef = useRef<string | null>(null);

  /* ---------- 식순 아코디언 ---------- */
  const [expandedSteps, setExpandedSteps] = useState<Set<string>>(new Set());

  /* ---------- 메모 ---------- */
  const [notes, setNotes] = useState<CeremonySessionNote[]>([]);
  const [notesLoading, setNotesLoading] = useState(false);
  const [noteDraft, setNoteDraft] = useState("");
  const [noteSaving, setNoteSaving] = useState(false);

  /* ---------- 액션 busy ---------- */
  const [actionBusy, setActionBusy] = useState(false);

  /* ---------- 인쇄 모드 (null = 비인쇄) ---------- */
  const [printMode, setPrintMode] = useState<"participant" | "leader" | null>(null);

  /* ---------- 직렬화된 토글 큐 (race-condition 방지) ---------- */
  const toggleQueueRef = useRef<Promise<void>>(Promise.resolve());

  /* ──────────────────────────────────────────
   *  session 변경 시 내부 state 재초기화
   *
   *  주의: dependency 가 session 객체 전체가 아니라 sessionId 인 점.
   *  realtime 업데이트로 session 객체가 새로 생성되어도 sessionId 만 같으면
   *  편집 중인 form input(titleInput 등)을 보존한다. 그렇지 않으면
   *  사용자가 제목을 타이핑하는 동안 realtime tick 마다 입력이 사라짐.
   *
   *  progress_state 는 사용자가 실시간으로 토글하는 값이므로 init 시점에만
   *  복사하면 충분 (이후엔 optimistic local state 로 관리).
   * ────────────────────────────────────────── */
  useEffect(() => {
    if (!open) {
      initedSessionIdRef.current = null;
      return;
    }
    if (!session) return;
    if (initedSessionIdRef.current === session.id) return;
    initedSessionIdRef.current = session.id;

    setProgressState(session.progress_state ?? {});
    setTitleInput(session.title || "");
    const { date, time } = splitScheduledAt(session.scheduled_at);
    setDateInput(date);
    setTimeInput(time);
    setLocationInput(session.location || "");
    setSubjectInput(session.subject_member_id || "");
    const partnerId =
      typeof session.family_info?.partner_member_id === "string"
        ? (session.family_info.partner_member_id as string)
        : "";
    setPartnerInput(partnerId);
    const freeNote =
      typeof session.family_info?.free_note === "string"
        ? (session.family_info.free_note as string)
        : "";
    setFamilyNoteInput(freeNote);
    const leaderOverride =
      typeof session.family_info?.leader_name_override === "string"
        ? (session.family_info.leader_name_override as string)
        : "";
    setLeaderNameInput(leaderOverride);
    setMetaCollapsed(false);
    setExpandedSteps(new Set());
    setNoteDraft("");
  }, [open, session?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  /* ──────────────────────────────────────────
   *  메모 lazy fetch (sessionId 변경 시)
   * ────────────────────────────────────────── */
  const loadNotes = useCallback(async (sid: string) => {
    setNotesLoading(true);
    try {
      const list = await fetchSessionNotes(sid);
      setNotes(list);
    } finally {
      setNotesLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!open || !sessionId) {
      setNotes([]);
      return;
    }
    void loadNotes(sessionId);
  }, [open, sessionId, loadNotes]);

  /* ──────────────────────────────────────────
   *  파생 데이터
   * ────────────────────────────────────────── */
  const totalSteps = steps.length;
  /**
   * 식순지/인도자용에 포함될 step 수.
   *
   * 의미: 체크 = "이 식순을 포함" (기본 ON).
   *   - progress_state 에 entry 가 없거나 checked !== false → 포함
   *   - 명시적으로 checked === false → 제외
   *
   * 따라서 신규 세션(progress_state 비어 있음)은 자동으로 모든 step 이
   * 포함된 것으로 시작하고, 사용자가 빼고 싶은 항목만 체크 해제하면 된다.
   */
  const checkedCount = useMemo(
    () =>
      steps.reduce(
        (acc, s) => acc + (progressState[s.id]?.checked !== false ? 1 : 0),
        0,
      ),
    [steps, progressState],
  );
  const progressPercent = totalSteps > 0 ? Math.round((checkedCount / totalSteps) * 100) : 0;

  /**
   * 식순지/인도자용 인쇄에 포함될 step 목록.
   * 체크 해제된 step (progress_state[id].checked === false) 은 제외.
   * 인쇄 포털과 함께 사용되며, hooks rule 을 위해 component 상단에서 계산.
   */
  const printableSteps = useMemo(
    () => steps.filter((s) => progressState[s.id]?.checked !== false),
    [steps, progressState],
  );

  const memberOptions = useMemo<PcSelectOption[]>(() => {
    const opts: PcSelectOption[] = [{ value: "", label: "선택 안 함" }];
    for (const m of db.members.slice().sort((a, b) => (a.name || "").localeCompare(b.name || ""))) {
      const tag = m.mokjang || m.dept || m.role || "";
      opts.push({ value: m.id, label: tag ? `${m.name} · ${tag}` : m.name });
    }
    return opts;
  }, [db.members]);

  const metaDirty = useMemo(() => {
    if (!session) return false;
    const origFreeNote =
      typeof session.family_info?.free_note === "string"
        ? (session.family_info.free_note as string)
        : "";
    const origLeaderOverride =
      typeof session.family_info?.leader_name_override === "string"
        ? (session.family_info.leader_name_override as string)
        : "";
    const origPartner =
      typeof session.family_info?.partner_member_id === "string"
        ? (session.family_info.partner_member_id as string)
        : "";
    const origSched = splitScheduledAt(session.scheduled_at);
    return (
      titleInput !== (session.title || "") ||
      dateInput !== origSched.date ||
      timeInput !== origSched.time ||
      locationInput !== (session.location || "") ||
      subjectInput !== (session.subject_member_id || "") ||
      partnerInput !== origPartner ||
      familyNoteInput !== origFreeNote ||
      leaderNameInput !== origLeaderOverride
    );
  }, [
    session,
    titleInput,
    dateInput,
    timeInput,
    locationInput,
    subjectInput,
    partnerInput,
    familyNoteInput,
    leaderNameInput,
  ]);

  /** 현재 세션의 카테고리(템플릿 기준) — 폼 카피/placeholder 분기에 사용 */
  const sessionCategory = template?.category ?? null;
  const formCopy = useMemo(
    () => getCategoryFormCopy(sessionCategory),
    [sessionCategory],
  );

  const leaderLabel = useMemo(() => {
    if (!session?.leader_user_id) return "미배정";
    if (user?.id && session.leader_user_id === user.id) {
      return `본인 (${user.email ?? shortUserLabel(user.id)})`;
    }
    return shortUserLabel(session.leader_user_id);
  }, [session?.leader_user_id, user?.id, user?.email]);

  /**
   * 인쇄용 인도자 이름.
   *
   * 우선순위:
   *   1) family_info.leader_name_override  (사용자가 폼에서 직접 입력한 자유 텍스트)
   *      - 외부 강사·노회장 등 system user 가 아닌 인도자를 표시할 때 사용.
   *   2) leader_user_id 가 현재 로그인 사용자와 같을 경우 사용자의 metadata.name / email
   *   3) 그 외엔 null → 헤더에서 인도자 라인 생략 (다른 user 의 실명을 노출하지 않음)
   */
  const printLeaderName = useMemo<string | null>(() => {
    const override =
      typeof session?.family_info?.leader_name_override === "string"
        ? (session.family_info.leader_name_override as string).trim()
        : "";
    if (override) return override;
    if (!session?.leader_user_id) return null;
    if (user?.id && session.leader_user_id === user.id) {
      const meta = user.user_metadata as { name?: string } | undefined;
      return meta?.name ?? user.email ?? null;
    }
    return null;
  }, [
    session?.family_info?.leader_name_override,
    session?.leader_user_id,
    user?.id,
    user?.email,
    user?.user_metadata,
  ]);

  /* ──────────────────────────────────────────
   *  핸들러 — 식순
   * ────────────────────────────────────────── */
  const toggleStepExpansion = (stepId: string) => {
    setExpandedSteps((prev) => {
      const next = new Set(prev);
      if (next.has(stepId)) next.delete(stepId);
      else next.add(stepId);
      return next;
    });
  };
  const expandAll = () => setExpandedSteps(new Set(steps.map((s) => s.id)));
  const collapseAll = () => setExpandedSteps(new Set());

  const handleToggleStep = useCallback(
    (stepId: string, nextChecked: boolean) => {
      if (!sessionId || !canEdit) return;
      // 낙관적 로컬 업데이트
      setProgressState((prev) => {
        const next: CeremonyProgressState = { ...prev };
        const entry: CeremonyStepProgress = nextChecked
          ? { checked: true, checked_at: new Date().toISOString() }
          : { checked: false };
        next[stepId] = entry;
        return next;
      });

      // 직렬 큐 — 이전 토글이 끝난 다음에 다음 토글 실행
      toggleQueueRef.current = toggleQueueRef.current.then(async () => {
        const ok = await toggleStepProgress(sessionId, stepId, nextChecked);
        if (!ok) {
          // 실패 시 롤백
          setProgressState((prev) => {
            const next: CeremonyProgressState = { ...prev };
            next[stepId] = { checked: !nextChecked };
            return next;
          });
          toast("진행 체크 저장에 실패했습니다.", "err");
        }
      });
    },
    [sessionId, canEdit, toast],
  );

  /* ──────────────────────────────────────────
   *  핸들러 — 메타 저장
   * ────────────────────────────────────────── */
  const handleSaveMeta = async () => {
    if (!session || !sessionId || !canEdit || !metaDirty) return;
    const trimmedTitle = titleInput.trim();
    if (!trimmedTitle) {
      toast("예식 제목은 비울 수 없습니다.", "warn");
      return;
    }
    setMetaSaving(true);
    try {
      const next: CeremonyFamilyInfo = {
        ...(session.family_info ?? {}),
      };
      const trimmedFree = familyNoteInput.trim();
      if (trimmedFree) next.free_note = trimmedFree;
      else if (next.free_note !== undefined) delete next.free_note;

      const trimmedLeader = leaderNameInput.trim();
      if (trimmedLeader) next.leader_name_override = trimmedLeader;
      else if (next.leader_name_override !== undefined) delete next.leader_name_override;

      if (partnerInput) next.partner_member_id = partnerInput;
      else if (next.partner_member_id !== undefined) delete next.partner_member_id;

      const ok = await updateSession(sessionId, {
        title: trimmedTitle,
        scheduled_at: combineScheduledAt(dateInput, timeInput),
        location: locationInput.trim() || null,
        subject_member_id: subjectInput || null,
        family_info: next,
      });
      if (!ok) {
        toast("메타 정보 저장에 실패했습니다.", "err");
        return;
      }
      await refreshCeremonySessions();
      toast("메타 정보가 저장되었습니다.", "ok");
    } catch (e) {
      console.error("[CeremonySessionModal] saveMeta failed:", e);
      toast("메타 정보 저장에 실패했습니다.", "err");
    } finally {
      setMetaSaving(false);
    }
  };

  /* ──────────────────────────────────────────
   *  핸들러 — 상태 변경
   * ────────────────────────────────────────── */
  const guardManage = () => {
    if (!canManage) {
      toast("관리자/담임/부교역자만 사용할 수 있습니다.", "warn");
      return false;
    }
    return true;
  };

  const handleStart = async () => {
    if (!sessionId || !guardManage()) return;
    setActionBusy(true);
    try {
      const ok = await startSession(sessionId);
      if (ok) {
        await refreshCeremonySessions();
        toast("예식을 시작했습니다.", "ok");
      } else {
        toast("시작 처리에 실패했습니다.", "err");
      }
    } catch (e) {
      console.error("[CeremonySessionModal] start failed:", e);
      toast("시작 처리에 실패했습니다.", "err");
    } finally {
      setActionBusy(false);
    }
  };

  const handleComplete = async () => {
    if (!sessionId || !guardManage()) return;
    setActionBusy(true);
    try {
      const ok = await completeSession(sessionId);
      if (ok) {
        await refreshCeremonySessions();
        toast("예식을 완료 처리했습니다.", "ok");
      } else {
        toast("완료 처리에 실패했습니다.", "err");
      }
    } catch (e) {
      console.error("[CeremonySessionModal] complete failed:", e);
      toast("완료 처리에 실패했습니다.", "err");
    } finally {
      setActionBusy(false);
    }
  };

  const handleCancel = async () => {
    if (!sessionId || !guardManage()) return;
    if (!window.confirm("이 예식을 취소 처리하시겠습니까?")) return;
    setActionBusy(true);
    try {
      const ok = await cancelSession(sessionId);
      if (ok) {
        await refreshCeremonySessions();
        toast("예식을 취소 처리했습니다.", "ok");
      } else {
        toast("취소 처리에 실패했습니다.", "err");
      }
    } catch (e) {
      console.error("[CeremonySessionModal] cancel failed:", e);
      toast("취소 처리에 실패했습니다.", "err");
    } finally {
      setActionBusy(false);
    }
  };

  const handleResume = async () => {
    if (!sessionId || !guardManage()) return;
    setActionBusy(true);
    try {
      const ok = await startSession(sessionId);
      if (ok) {
        await refreshCeremonySessions();
        toast("예식을 다시 진행 상태로 되돌렸습니다.", "ok");
      } else {
        toast("재진행 처리에 실패했습니다.", "err");
      }
    } catch (e) {
      console.error("[CeremonySessionModal] resume failed:", e);
      toast("재진행 처리에 실패했습니다.", "err");
    } finally {
      setActionBusy(false);
    }
  };

  const handleDelete = async () => {
    if (!sessionId || !guardManage()) return;
    if (!window.confirm("이 예식을 영구 삭제하시겠습니까? 진행 메모도 함께 사라집니다.")) return;
    setActionBusy(true);
    try {
      const ok = await deleteSession(sessionId);
      if (ok) {
        await refreshCeremonySessions();
        toast("예식이 삭제되었습니다.", "ok");
        onClose();
      } else {
        toast("삭제에 실패했습니다.", "err");
      }
    } catch (e) {
      console.error("[CeremonySessionModal] delete failed:", e);
      toast("삭제에 실패했습니다.", "err");
    } finally {
      setActionBusy(false);
    }
  };

  /* ──────────────────────────────────────────
   *  핸들러 — 메모 추가
   * ────────────────────────────────────────── */
  const handleAddNote = async () => {
    if (!sessionId || !canEdit) return;
    const body = noteDraft.trim();
    if (!body) return;
    setNoteSaving(true);
    try {
      const created = await addSessionNote(sessionId, body);
      if (!created) {
        toast("메모 추가에 실패했습니다.", "err");
        return;
      }
      setNotes((prev) => [...prev, created]);
      setNoteDraft("");
      toast("메모가 추가되었습니다.", "ok");
    } catch (e) {
      console.error("[CeremonySessionModal] addNote failed:", e);
      toast("메모 추가에 실패했습니다.", "err");
    } finally {
      setNoteSaving(false);
    }
  };

  const handleNoteKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if ((e.metaKey || e.ctrlKey) && e.key === "Enter") {
      e.preventDefault();
      void handleAddNote();
    }
  };

  /* ──────────────────────────────────────────
   *  핸들러 — 인쇄 (브라우저 window.print)
   *
   *  · document.title 을 임시로 "{예식제목}_{식순지|인도자용}" 으로 변경 →
   *    macOS "PDF로 저장" / Chrome 인쇄 다이얼로그에서 자동 파일명으로 들어감.
   *  · 인쇄 끝나면 원래 title 복원.
   * ────────────────────────────────────────── */
  const handlePrint = (mode: "participant" | "leader") => {
    if (steps.length === 0) {
      toast("식순이 없어 인쇄할 수 없습니다.", "warn");
      return;
    }
    setPrintMode(mode);
    setTimeout(() => {
      // 다른 인쇄 시스템(BulletinPage 등)이 <head> 에 동적 주입한 @media print
      // <style> 를 일시 비활성화. cascade 순서상 우리 print.css 보다 늦게
      // 주입되면 우리 룰을 무력화하기 때문. window.print() 완료 후 복원.
      const CONFLICTING_STYLE_IDS = ["bulletin-print-media-style"];
      const toRestore: { el: HTMLStyleElement; prevDisabled: boolean }[] = [];
      for (const id of CONFLICTING_STYLE_IDS) {
        const el = document.getElementById(id) as HTMLStyleElement | null;
        if (el) {
          toRestore.push({ el, prevDisabled: el.disabled });
          el.disabled = true;
        }
      }

      // document.title → 시스템 인쇄 다이얼로그의 기본 파일명
      const originalTitle = document.title;
      const modeLabel = mode === "leader" ? "인도자용" : "식순지";
      const safeTitle = (session?.title ?? "예식").replace(/[\\/:*?"<>|]/g, "_");
      document.title = `${safeTitle}_${modeLabel}`;

      try {
        window.print();
      } finally {
        // setTimeout 으로 인쇄 다이얼로그가 title 을 다 읽은 후 복원
        setTimeout(() => {
          document.title = originalTitle;
        }, 100);
        for (const { el, prevDisabled } of toRestore) {
          el.disabled = prevDisabled;
        }
        setPrintMode(null);
      }
    }, 100);
  };

  /* ──────────────────────────────────────────
   *  렌더 가드
   * ────────────────────────────────────────── */
  if (!open) return null;

  if (!session) {
    return (
      <PcModalShell
        open={open}
        onClose={onClose}
        title="예식 상세"
        maxWidth={760}
        footer={
          <div style={{ display: "flex", justifyContent: "flex-end", width: "100%" }}>
            <PcButton variant="ghost" onClick={onClose}>
              닫기
            </PcButton>
          </div>
        }
      >
        <div
          style={{
            padding: "40px 20px",
            textAlign: "center",
            color: C.textMuted,
            fontSize: 14,
          }}
        >
          세션을 찾을 수 없습니다. 이미 삭제되었거나 권한이 없을 수 있습니다.
        </div>
      </PcModalShell>
    );
  }

  const sb = statusBadge(session.status);

  /* ──────────────────────────────────────────
   *  타이틀 (제목 + 상태 뱃지)
   * ────────────────────────────────────────── */
  const modalTitle = (
    <span style={{ display: "inline-flex", alignItems: "center", gap: 10, minWidth: 0 }}>
      <span
        style={{
          color: C.text,
          fontWeight: 700,
          fontSize: mob ? 15 : 17,
          overflow: "hidden",
          textOverflow: "ellipsis",
          whiteSpace: "nowrap",
          maxWidth: mob ? 200 : 420,
        }}
      >
        {session.title || "(제목 없음)"}
      </span>
      <span
        style={{
          display: "inline-flex",
          alignItems: "center",
          fontSize: 11,
          fontWeight: 600,
          color: sb.fg,
          background: sb.bg,
          padding: "3px 10px",
          borderRadius: 14,
          border: `1px solid ${sb.border}`,
          flexShrink: 0,
          whiteSpace: "nowrap",
        }}
      >
        {sb.label}
      </span>
    </span>
  );

  /* ──────────────────────────────────────────
   *  상단 액션 바
   * ────────────────────────────────────────── */
  const actionBar = (
    <div
      style={{
        display: "flex",
        flexDirection: mob ? "column" : "row",
        alignItems: mob ? "stretch" : "center",
        justifyContent: "space-between",
        gap: 10,
        padding: "10px 12px",
        background: C.bg,
        border: `1px solid ${C.border}`,
        borderRadius: 10,
      }}
    >
      {/* 좌측: 진행률 */}
      <div style={{ display: "flex", flexDirection: "column", gap: 4, minWidth: 0, flex: 1 }}>
        <div style={{ fontSize: 12, color: C.textMuted, fontWeight: 600 }}>
          포함 식순 <span style={{ color: C.text }}>{checkedCount}</span> /{" "}
          <span style={{ color: C.text }}>{totalSteps}</span>
        </div>
        <div
          style={{
            height: 6,
            background: C.card,
            borderRadius: 3,
            overflow: "hidden",
            border: `1px solid ${C.border}`,
          }}
        >
          <div
            style={{
              width: `${progressPercent}%`,
              height: "100%",
              background: session.status === "completed" ? C.success : C.accent,
              transition: "width 0.2s",
            }}
          />
        </div>
      </div>

      {/* 우측: 상태별 액션 */}
      <div style={{ display: "flex", gap: 6, flexWrap: "wrap", justifyContent: "flex-end" }}>
        {session.status === "planned" ? (
          <>
            <PcButton
              size="sm"
              variant="primary"
              leftIcon={<Play size={12} />}
              onClick={handleStart}
              disabled={actionBusy || !canManage}
            >
              시작하기
            </PcButton>
            <PcButton
              size="sm"
              variant="ghost"
              leftIcon={<X size={12} />}
              onClick={handleCancel}
              disabled={actionBusy || !canManage}
            >
              취소
            </PcButton>
            {canManage ? (
              <PcButton
                size="sm"
                variant="ghost"
                leftIcon={<Trash2 size={12} />}
                onClick={handleDelete}
                disabled={actionBusy}
              >
                삭제
              </PcButton>
            ) : null}
          </>
        ) : null}

        {session.status === "in_progress" ? (
          <>
            <PcButton
              size="sm"
              variant="primary"
              leftIcon={<Check size={12} />}
              onClick={handleComplete}
              disabled={actionBusy || !canManage}
            >
              완료
            </PcButton>
            <PcButton
              size="sm"
              variant="ghost"
              leftIcon={<X size={12} />}
              onClick={handleCancel}
              disabled={actionBusy || !canManage}
            >
              취소
            </PcButton>
          </>
        ) : null}

        {session.status === "completed" || session.status === "cancelled" ? (
          <>
            <PcButton
              size="sm"
              variant="ghost"
              leftIcon={<RotateCcw size={12} />}
              onClick={handleResume}
              disabled={actionBusy || !canManage}
            >
              다시 진행
            </PcButton>
            {canManage ? (
              <PcButton
                size="sm"
                variant="ghost"
                leftIcon={<Trash2 size={12} />}
                onClick={handleDelete}
                disabled={actionBusy}
              >
                삭제
              </PcButton>
            ) : null}
          </>
        ) : null}

        {/* 인쇄 — 상태와 무관하게 canEdit 권한이면 항상 노출 */}
        {canEdit && steps.length > 0 ? (
          <>
            <span
              aria-hidden
              style={{
                width: 1,
                alignSelf: "stretch",
                background: C.border,
                margin: "0 2px",
              }}
            />
            <PcButton
              size="sm"
              variant="ghost"
              leftIcon={<Printer size={12} />}
              onClick={() => handlePrint("participant")}
              disabled={printMode != null}
            >
              식순지 인쇄
            </PcButton>
            <PcButton
              size="sm"
              variant="ghost"
              leftIcon={<FileText size={12} />}
              onClick={() => handlePrint("leader")}
              disabled={printMode != null}
            >
              인도자용 인쇄
            </PcButton>
          </>
        ) : null}
      </div>
    </div>
  );

  /* ──────────────────────────────────────────
   *  메타 정보 아코디언
   * ────────────────────────────────────────── */
  const metaBlock = (
    <section
      style={{
        background: C.card,
        border: `1px solid ${C.border}`,
        borderRadius: 10,
        padding: mob ? 12 : 14,
      }}
    >
      {/* 섹션 헤더 */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 8,
          marginBottom: metaCollapsed ? 0 : 12,
        }}
      >
        <div style={{ fontSize: 13, fontWeight: 700, color: C.text }}>예식 정보</div>
        <PcButton
          variant="link"
          size="sm"
          leftIcon={metaCollapsed ? <ChevronRight size={12} /> : <ChevronDown size={12} />}
          onClick={() => setMetaCollapsed((p) => !p)}
        >
          {metaCollapsed ? "펼치기" : "접기"}
        </PcButton>
      </div>

      {!metaCollapsed ? (
        <div style={{ display: "flex", flexDirection: "column", gap: mob ? 12 : 14 }}>
          <PcInput
            label="식순 제목"
            value={titleInput}
            onChange={(e) => setTitleInput(e.target.value)}
            disabled={!canEdit}
            placeholder={formCopy.titleEx}
          />

          {/* 일정 */}
          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            <label
              style={{
                fontSize: 13,
                fontWeight: 600,
                color: "var(--color-primary)",
              }}
            >
              일정
            </label>
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              <div style={{ flex: 1, minWidth: 160 }}>
                <CalendarDropdown
                  value={dateInput}
                  onChange={(v) => canEdit && setDateInput(v)}
                  showClearButton
                  onClear={() => canEdit && setDateInput("")}
                  disabled={!canEdit}
                />
              </div>
              <div style={{ width: mob ? "100%" : 130 }}>
                <ModernSelect
                  value={timeInput}
                  onChange={(v) => canEdit && setTimeInput(v)}
                  options={TIME_SLOTS}
                  placeholder="시간"
                  disabled={!canEdit}
                />
              </div>
            </div>
          </div>

          <PcInput
            label="장소"
            value={locationInput}
            onChange={(e) => setLocationInput(e.target.value)}
            disabled={!canEdit}
            placeholder={formCopy.locationEx}
          />

          <PcSelect
            label={formCopy.subjectLabel}
            value={subjectInput}
            onChange={setSubjectInput}
            options={memberOptions}
            placeholder="성도를 검색·선택하세요"
            searchable
            disabled={!canEdit}
            fullWidth
          />

          {/*
            두 명을 함께 선택해야 하는 카테고리(결혼: 신랑·신부)에서만 노출.
            저장 위치: family_info.partner_member_id (JSONB)
          */}
          {formCopy.secondarySubjectLabel ? (
            <PcSelect
              label={formCopy.secondarySubjectLabel}
              value={partnerInput}
              onChange={setPartnerInput}
              options={memberOptions}
              placeholder="성도를 검색·선택하세요"
              searchable
              disabled={!canEdit}
              fullWidth
            />
          ) : null}

          <PcTextarea
            label={formCopy.familyLabel}
            value={familyNoteInput}
            onChange={(e) => setFamilyNoteInput(e.target.value)}
            rows={4}
            placeholder={formCopy.familyEx}
            disabled={!canEdit}
            fullWidth
          />

          {/*
            인도자 — 시스템 사용자(leader_user_id)와 별개로 외부 인도자(노회장·강사 등)
            도 직접 입력할 수 있도록 자유 텍스트로 전환.
            저장 위치: family_info.leader_name_override
            - 비워두면 system user(leader_user_id) 의 이름이 표시됨
            - 입력하면 인쇄/표시에서 우선 사용됨
          */}
          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            <PcInput
              label="인도자"
              value={leaderNameInput}
              onChange={(e) => setLeaderNameInput(e.target.value)}
              placeholder={
                session?.leader_user_id
                  ? `${leaderLabel} (기본값) · 다른 인도자를 입력하려면 적어주세요`
                  : "예: 김○○ 목사 / 노회장 / 외부 강사"
              }
              disabled={!canEdit}
            />
            {!leaderNameInput.trim() && session?.leader_user_id ? (
              <div
                style={{
                  fontSize: 11,
                  color: C.textMuted,
                  paddingLeft: 2,
                }}
              >
                현재 인쇄·표시 인도자: <strong>{leaderLabel}</strong>
              </div>
            ) : null}
          </div>

          {/* 저장 액션 */}
          <div style={{ display: "flex", justifyContent: "flex-end" }}>
            <PcButton
              variant="secondary"
              size="sm"
              leftIcon={<Save size={12} />}
              onClick={handleSaveMeta}
              disabled={!canEdit || !metaDirty || metaSaving}
              loading={metaSaving}
            >
              변경 사항 저장
            </PcButton>
          </div>
        </div>
      ) : null}
    </section>
  );

  /* ──────────────────────────────────────────
   *  식순 카드
   * ────────────────────────────────────────── */
  const allExpanded = expandedSteps.size === steps.length && steps.length > 0;
  const stepsBlock = (
    <section
      style={{
        background: C.card,
        border: `1px solid ${C.border}`,
        borderRadius: 10,
        padding: mob ? 12 : 14,
      }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 8,
          marginBottom: 12,
        }}
      >
        <div style={{ display: "flex", flexDirection: "column", gap: 2, minWidth: 0 }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: C.text }}>식순</div>
          <div style={{ fontSize: 11, color: C.textMuted, lineHeight: 1.4 }}>
            체크된 식순만 식순지·인도자용에 포함됩니다. 빼고 싶은 식순은 체크를 해제하세요.
          </div>
        </div>
        {steps.length > 0 ? (
          <PcButton
            variant="link"
            size="sm"
            onClick={allExpanded ? collapseAll : expandAll}
          >
            {allExpanded ? "모두 접기" : "모두 펼치기"}
          </PcButton>
        ) : null}
      </div>

      {steps.length === 0 ? (
        <div
          style={{
            background: C.bg,
            border: `1px dashed ${C.border}`,
            borderRadius: 8,
            padding: 20,
            textAlign: "center",
            color: C.textMuted,
            fontSize: 13,
          }}
        >
          이 가이드에는 정의된 식순이 없습니다.
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {steps.map((s) => {
            const prog = progressState[s.id];
            // 의미: missing entry → 기본 포함(체크 표시), 명시적 false 만 제외
            const isChecked = prog?.checked !== false;
            const isExpanded = expandedSteps.has(s.id);
            const content = s.content ?? {};
            // 템플릿의 ○○○ 자리표시자 → 선택된 신랑·신부/단일 대상자 이름으로 치환
            const substCtx = {
              category: template?.category ?? null,
              subjectName: subjectMember?.name ?? null,
              partnerName: partnerMember?.name ?? null,
            };
            const leaderScriptResolved = substituteCeremonyPlaceholders(content.leader_script, substCtx);
            const tipsResolved = substituteCeremonyPlaceholders(content.tips, substCtx);
            const prayerExamplesResolved = (content.prayer_examples ?? []).map((p) =>
              substituteCeremonyPlaceholders(p, substCtx),
            );
            const hasContent =
              !!leaderScriptResolved ||
              (content.hymn_numbers && content.hymn_numbers.length > 0) ||
              (content.scriptures && content.scriptures.length > 0) ||
              (prayerExamplesResolved.length > 0) ||
              !!tipsResolved;

            return (
              <div
                key={s.id}
                style={{
                  background: isChecked ? C.successBg : C.card,
                  border: `1px solid ${isChecked ? C.success : C.border}`,
                  borderRadius: 10,
                  overflow: "hidden",
                  transition: "background 0.15s, border-color 0.15s",
                }}
              >
                {/* 헤더 */}
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 10,
                    padding: mob ? "10px 12px" : "12px 14px",
                  }}
                >
                  {/* 커스텀 체크박스 */}
                  <div
                    role="checkbox"
                    aria-checked={isChecked}
                    tabIndex={canEdit ? 0 : -1}
                    aria-disabled={!canEdit}
                    onClick={(e) => {
                      e.stopPropagation();
                      if (!canEdit) return;
                      handleToggleStep(s.id, !isChecked);
                    }}
                    onKeyDown={(e) => {
                      if (!canEdit) return;
                      if (e.key === " " || e.key === "Enter") {
                        e.preventDefault();
                        handleToggleStep(s.id, !isChecked);
                      }
                    }}
                    style={{
                      width: 22,
                      height: 22,
                      borderRadius: 6,
                      border: `2px solid ${isChecked ? C.success : C.border}`,
                      background: isChecked ? C.success : C.card,
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      cursor: canEdit ? "pointer" : "not-allowed",
                      opacity: canEdit ? 1 : 0.6,
                      flexShrink: 0,
                      transition: "all 0.15s",
                    }}
                  >
                    {isChecked ? <Check size={14} color={C.card} strokeWidth={3} /> : null}
                  </div>

                  {/* 번호 */}
                  <div
                    style={{
                      fontSize: 12,
                      fontWeight: 700,
                      color: C.textMuted,
                      minWidth: 16,
                      textAlign: "center",
                    }}
                  >
                    {s.step_order}
                  </div>

                  {/* 본문 — 토글 영역 */}
                  <div
                    role="button"
                    tabIndex={0}
                    aria-expanded={isExpanded}
                    onClick={() => toggleStepExpansion(s.id)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" || e.key === " ") {
                        e.preventDefault();
                        toggleStepExpansion(s.id);
                      }
                    }}
                    style={{
                      flex: 1,
                      minWidth: 0,
                      cursor: "pointer",
                      display: "flex",
                      alignItems: "center",
                      gap: 8,
                      padding: "2px 0",
                    }}
                  >
                    <div
                      style={{
                        fontSize: mob ? 14 : 15,
                        fontWeight: 600,
                        color: C.text,
                        flex: 1,
                        minWidth: 0,
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                        whiteSpace: "nowrap",
                      }}
                    >
                      {s.title}
                      {s.is_optional ? (
                        <span style={{ marginLeft: 6, fontSize: 11, color: C.textFaint, fontWeight: 500 }}>
                          (선택)
                        </span>
                      ) : null}
                    </div>
                    {s.duration_minutes ? (
                      <span
                        style={{
                          display: "inline-flex",
                          alignItems: "center",
                          gap: 3,
                          fontSize: 11,
                          color: C.textMuted,
                          flexShrink: 0,
                        }}
                      >
                        <Clock size={10} /> {s.duration_minutes}분
                      </span>
                    ) : null}
                    {hasContent ? (
                      isExpanded ? (
                        <ChevronUp size={16} color={C.textMuted} />
                      ) : (
                        <ChevronDown size={16} color={C.textMuted} />
                      )
                    ) : null}
                  </div>
                </div>

                {/* 콘텐츠 */}
                {isExpanded && hasContent ? (
                  <div
                    style={{
                      borderTop: `1px solid ${C.border}`,
                      padding: mob ? "12px" : "14px",
                      background: C.card,
                      display: "flex",
                      flexDirection: "column",
                      gap: 14,
                    }}
                  >
                    {leaderScriptResolved ? (
                      <ContentSection title="인도자 멘트">
                        <div
                          style={{
                            fontSize: mob ? 13 : 14,
                            lineHeight: 1.6,
                            color: C.text,
                            whiteSpace: "pre-wrap",
                          }}
                        >
                          {leaderScriptResolved}
                        </div>
                      </ContentSection>
                    ) : null}

                    {content.hymn_numbers && content.hymn_numbers.length > 0 ? (
                      <ContentSection title="찬송">
                        <div style={{ fontSize: 13, color: C.text }}>
                          {content.hymn_numbers.map((n) => `${n}장`).join(", ")}
                        </div>
                      </ContentSection>
                    ) : null}

                    {content.scriptures && content.scriptures.length > 0 ? (
                      <ContentSection title="성경구절">
                        <ul
                          style={{
                            margin: 0,
                            padding: "0 0 0 18px",
                            display: "flex",
                            flexDirection: "column",
                            gap: 4,
                          }}
                        >
                          {content.scriptures.map((sc, idx) => (
                            <li
                              key={`${sc.ref}-${idx}`}
                              style={{ fontSize: 13, color: C.text, lineHeight: 1.5 }}
                            >
                              {sc.ref}
                              {sc.text ? (
                                <div
                                  style={{
                                    marginTop: 4,
                                    fontSize: 12,
                                    color: C.textMuted,
                                    whiteSpace: "pre-wrap",
                                    lineHeight: 1.5,
                                  }}
                                >
                                  {sc.text}
                                </div>
                              ) : null}
                            </li>
                          ))}
                        </ul>
                      </ContentSection>
                    ) : null}

                    {prayerExamplesResolved.length > 0 ? (
                      <ContentSection title="기도문 예시">
                        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                          {prayerExamplesResolved.map((p, idx) => (
                            <div
                              key={idx}
                              style={{
                                background: C.bg,
                                border: `1px solid ${C.border}`,
                                borderRadius: 8,
                                padding: "10px 12px",
                                fontSize: 13,
                                color: C.text,
                                lineHeight: 1.6,
                                whiteSpace: "pre-wrap",
                              }}
                            >
                              {p}
                            </div>
                          ))}
                        </div>
                      </ContentSection>
                    ) : null}

                    {tipsResolved ? (
                      <ContentSection title="진행 팁">
                        <div
                          style={{
                            fontSize: 12,
                            color: C.textMuted,
                            lineHeight: 1.5,
                            whiteSpace: "pre-wrap",
                          }}
                        >
                          {tipsResolved}
                        </div>
                      </ContentSection>
                    ) : null}

                    {prog?.checked_at ? (
                      <div
                        style={{
                          fontSize: 11,
                          color: C.textFaint,
                          paddingTop: 4,
                          borderTop: `1px solid ${C.borderLight}`,
                        }}
                      >
                        체크된 시각: {fmtNoteTime(prog.checked_at)}
                      </div>
                    ) : null}
                  </div>
                ) : null}
              </div>
            );
          })}
        </div>
      )}
    </section>
  );

  /* ──────────────────────────────────────────
   *  메모 영역
   * ────────────────────────────────────────── */
  const notesBlock = (
    <section
      style={{
        background: C.card,
        border: `1px solid ${C.border}`,
        borderRadius: 10,
        padding: mob ? 12 : 14,
      }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 8,
          marginBottom: 12,
        }}
      >
        <div style={{ fontSize: 13, fontWeight: 700, color: C.text }}>진행 메모</div>
        <div style={{ fontSize: 11, color: C.textMuted }}>
          {notesLoading ? "불러오는 중…" : `${notes.length}개`}
        </div>
      </div>

      {/* 메모 입력 */}
      <div style={{ display: "flex", flexDirection: "column", gap: 8, marginBottom: 14 }}>
        <PcTextarea
          value={noteDraft}
          onChange={(e) => setNoteDraft(e.target.value)}
          onKeyDown={handleNoteKeyDown}
          rows={3}
          placeholder={
            canEdit
              ? "진행 메모를 입력하세요 (Cmd/Ctrl + Enter 로 빠르게 추가)"
              : "권한이 없어 메모를 추가할 수 없습니다."
          }
          disabled={!canEdit || noteSaving}
          fullWidth
        />
        <div style={{ display: "flex", justifyContent: "flex-end" }}>
          <PcButton
            variant="primary"
            size="sm"
            leftIcon={<Plus size={12} />}
            onClick={handleAddNote}
            disabled={!canEdit || !noteDraft.trim() || noteSaving}
            loading={noteSaving}
          >
            추가
          </PcButton>
        </div>
      </div>

      {/* 메모 리스트 */}
      {notes.length === 0 ? (
        <div
          style={{
            fontSize: 12,
            color: C.textFaint,
            textAlign: "center",
            padding: "12px 0",
          }}
        >
          {notesLoading ? "" : "아직 작성된 메모가 없습니다."}
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {notes.map((n) => {
            const isMine = !!(user?.id && n.created_by === user.id);
            const authorLabel = isMine
              ? user?.email ?? "본인"
              : shortUserLabel(n.created_by);
            return (
              <div
                key={n.id}
                style={{
                  background: C.bg,
                  border: `1px solid ${C.border}`,
                  borderRadius: 8,
                  padding: "10px 12px",
                }}
              >
                <div
                  style={{
                    display: "flex",
                    alignItems: "baseline",
                    justifyContent: "space-between",
                    gap: 8,
                    marginBottom: 4,
                  }}
                >
                  <div style={{ fontSize: 12, fontWeight: 600, color: C.text }}>{authorLabel}</div>
                  <div style={{ fontSize: 11, color: C.textFaint }}>{fmtNoteTime(n.created_at)}</div>
                </div>
                <div
                  style={{
                    fontSize: 13,
                    color: C.text,
                    lineHeight: 1.5,
                    whiteSpace: "pre-wrap",
                  }}
                >
                  {n.body}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </section>
  );

  /* ──────────────────────────────────────────
   *  Footer
   * ────────────────────────────────────────── */
  const footer = (
    <div style={{ display: "flex", justifyContent: "space-between", width: "100%", gap: 8, flexWrap: "wrap" }}>
      <div style={{ fontSize: 11, color: C.textFaint, display: "inline-flex", alignItems: "center", gap: 4 }}>
        {template ? (
          <>
            <Calendar size={11} />
            {template.name}
          </>
        ) : null}
      </div>
      <PcButton variant="ghost" onClick={onClose}>
        닫기
      </PcButton>
    </div>
  );

  /* ──────────────────────────────────────────
   *  인쇄 포털 — body 직속에 ceremony-print-root 마운트
   *  (visibility 트릭과 page-break 규칙은 src/styles/print.css 참고)
   *
   *  체크 해제된 step 은 인쇄에서 제외 (포함 식순만 출력).
   *  printableSteps 는 component 상단 hooks 영역에서 계산 (early return 보다 위).
   * ────────────────────────────────────────── */
  const printPortal =
    printMode && template && typeof document !== "undefined"
      ? createPortal(
          <div
            className={`ceremony-print-root ${
              printMode === "leader" ? "ceremony-leader" : "ceremony-participant"
            }`}
          >
            <CeremonyPrintView
              mode={printMode}
              session={session}
              template={template}
              steps={printableSteps}
              churchName={churchName ?? "교회"}
              subjectMember={subjectMember}
              partnerMember={partnerMember}
              leaderName={printLeaderName}
            />
          </div>,
          document.body,
        )
      : null;

  return (
    <>
      <PcModalShell
        open={open}
        onClose={onClose}
        title={modalTitle}
        maxWidth={mob ? 720 : 860}
        footer={footer}
      >
        <div style={{ display: "flex", flexDirection: "column", gap: mob ? 12 : 14 }}>
          {actionBar}
          {metaBlock}
          {stepsBlock}
          {notesBlock}
        </div>
      </PcModalShell>
      {printPortal}
    </>
  );
}

/* ──────────────────────────────────────────
 *  작은 도우미 컴포넌트
 * ────────────────────────────────────────── */
function ContentSection({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 6,
          fontSize: 11,
          fontWeight: 700,
          color: C.accent,
          letterSpacing: "0.02em",
        }}
      >
        <span
          aria-hidden
          style={{
            display: "inline-block",
            width: 3,
            height: 12,
            background: C.accent,
            borderRadius: 1.5,
          }}
        />
        {title}
      </div>
      <div style={{ paddingLeft: 9 }}>{children}</div>
    </div>
  );
}

export default CeremonySessionModal;
