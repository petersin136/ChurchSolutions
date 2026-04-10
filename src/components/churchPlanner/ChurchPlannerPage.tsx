"use client";

import { useState, useMemo, useEffect, useCallback, type CSSProperties, type ReactNode } from "react";
import {
  CalendarDays,
  Building2,
  ChevronLeft,
  ChevronRight,
  Plus,
  X,
} from "lucide-react";
import { UnifiedPageLayout } from "@/components/layout/UnifiedPageLayout";
import { supabase } from "@/lib/supabase";
import { getChurchId } from "@/lib/tenant";
import { useAuth } from "@/contexts/AuthContext";
import {
  TB_DEPARTMENTS,
  TB_PLACES,
  TB_EVENTS,
  COLOR_PRESETS,
  DEFAULT_DEPARTMENT_SEED,
  DEFAULT_PLACE_SEED,
} from "./plannerDb";

const ACCENT = "#4A90D9";
const BORDER = "#e5e7eb";
const NAVY = "#1B2A4A";

export type PlannerToast = (msg: string, type?: "ok" | "err" | "warn") => void;

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

export type PlannerDepartment = {
  id: string;
  church_id: string;
  name: string;
  color: string;
  icon: string | null;
  leader_name: string | null;
  sort_order: number | null;
  is_active: boolean | null;
};

export type PlannerPlace = {
  id: string;
  church_id: string;
  name: string;
  capacity: number | null;
  equipment: string[] | null;
  sort_order: number | null;
  is_active: boolean | null;
};

export type PlannerEventRow = {
  id: string;
  church_id: string;
  title: string;
  department_id: string | null;
  event_type: string;
  start_date: string;
  end_date: string | null;
  start_time: string | null;
  end_time: string | null;
  is_all_day: boolean | null;
  place_id: string | null;
  recurrence_rule: string | null;
  description: string | null;
  expected_people: number | null;
  created_by: string | null;
  is_public: boolean | null;
};

export type ChurchCalendarRow = {
  id: string;
  church_id: string;
  year: number;
  name: string;
  date: string;
  calendar_type: string;
  color: string | null;
};

const EVENT_TYPE_OPTIONS: { value: string; label: string }[] = [
  { value: "worship", label: "예배" },
  { value: "event", label: "행사" },
  { value: "meeting", label: "회의" },
  { value: "retreat", label: "수련회" },
  { value: "service", label: "봉사" },
  { value: "other", label: "기타" },
];

const RECURRENCE_OPTIONS: { value: string; label: string }[] = [
  { value: "", label: "안 함" },
  { value: "weekly", label: "매주" },
  { value: "monthly", label: "매월" },
  { value: "yearly", label: "매년" },
];

const EQUIPMENT_OPTS = ["빔프로젝터", "음향", "영상", "모니터"];

function pad2(n: number) {
  return String(n).padStart(2, "0");
}

function parseISODate(s: string): Date {
  const [y, m, d] = s.split("-").map(Number);
  return new Date(y, m - 1, d);
}

/** 이벤트가 해당 로컬 일자에 표시되는지 (종일·기간 포함) */
function eventCoversDate(ev: PlannerEventRow, y: number, month: number, day: number): boolean {
  const cell = new Date(y, month - 1, day);
  const start = parseISODate(ev.start_date);
  const end = ev.end_date ? parseISODate(ev.end_date) : start;
  return cell >= start && cell <= end;
}

function timeToMinutes(t: string | null): number | null {
  if (!t) return null;
  const p = t.slice(0, 5).split(":");
  const h = Number(p[0]);
  const m = Number(p[1]);
  if (!Number.isFinite(h) || !Number.isFinite(m)) return null;
  return h * 60 + m;
}

function rangesOverlap(
  aStart: number,
  aEnd: number,
  bStart: number,
  bEnd: number
): boolean {
  return aStart < bEnd && bStart < aEnd;
}

function findConflicts(
  events: PlannerEventRow[],
  candidate: {
    id?: string;
    place_id: string | null;
    start_date: string;
    end_date: string | null;
    is_all_day: boolean;
    start_time: string | null;
    end_time: string | null;
  },
  places: PlannerPlace[],
  departments: PlannerDepartment[]
): { message: string; otherTitle: string } | null {
  if (!candidate.place_id) return null;
  const place = places.find((p) => p.id === candidate.place_id);
  const placeName = place?.name ?? "장소";

  const cStart = parseISODate(candidate.start_date);
  const cEnd = candidate.end_date ? parseISODate(candidate.end_date) : cStart;

  for (const ev of events) {
    if (ev.id === candidate.id) continue;
    if (ev.place_id !== candidate.place_id) continue;
    const eStart = parseISODate(ev.start_date);
    const eEnd = ev.end_date ? parseISODate(ev.end_date) : eStart;
    if (cEnd < eStart || cStart > eEnd) continue;

    const dept = departments.find((d) => d.id === ev.department_id);
    const deptName = dept?.name ?? "부서";

    if (candidate.is_all_day || ev.is_all_day) {
      return {
        message: `⚠️ ${placeName}에서 같은 기간에 ${ev.title}(${deptName})이 이미 있습니다`,
        otherTitle: ev.title,
      };
    }

    const cs = timeToMinutes(candidate.start_time);
    const ce = timeToMinutes(candidate.end_time) ?? cs;
    const es = timeToMinutes(ev.start_time);
    const ee = timeToMinutes(ev.end_time) ?? es;
    if (cs == null || ce == null || es == null || ee == null) {
      const timeLabel = `${(ev.start_time || "").slice(0, 5)}~${(ev.end_time || "").slice(0, 5) || "?"}`;
      return {
        message: `⚠️ ${placeName}에서 ${timeLabel}에 ${ev.title}(${deptName})이 이미 있습니다`,
        otherTitle: ev.title,
      };
    }
    if (rangesOverlap(cs, ce, es, ee)) {
      const timeLabel = `${(ev.start_time || "").slice(0, 5)}`;
      return {
        message: `⚠️ ${placeName}에서 ${timeLabel}에 ${ev.title}(${deptName})이 이미 있습니다`,
        otherTitle: ev.title,
      };
    }
  }
  return null;
}

async function seedPlannerDefaultsIfEmpty(
  supabaseClient: NonNullable<typeof supabase>,
  cid: string
): Promise<void> {
  const [dRes, pRes] = await Promise.all([
    supabaseClient.from(TB_DEPARTMENTS).select("id").eq("church_id", cid).limit(1),
    supabaseClient.from(TB_PLACES).select("id").eq("church_id", cid).limit(1),
  ]);
  if (dRes.error || pRes.error) return;
  if ((dRes.data?.length ?? 0) > 0 || (pRes.data?.length ?? 0) > 0) return;

  const deptRows = DEFAULT_DEPARTMENT_SEED.map((r) => ({
    church_id: cid,
    name: r.name,
    color: r.color,
    sort_order: r.sort_order,
    is_active: true,
  }));
  const { error: de } = await supabaseClient.from(TB_DEPARTMENTS).insert(deptRows);
  if (de) {
    console.error(de);
    return;
  }
  const placeRows = DEFAULT_PLACE_SEED.map((r) => ({
    church_id: cid,
    name: r.name,
    capacity: r.capacity,
    equipment: r.equipment,
    sort_order: r.sort_order,
    is_active: true,
  }));
  const { error: pe } = await supabaseClient.from(TB_PLACES).insert(placeRows);
  if (pe) console.error(pe);
}

function monthGrid(year: number, month: number): (number | null)[] {
  const first = new Date(year, month - 1, 1);
  const startDow = first.getDay();
  const dim = new Date(year, month, 0).getDate();
  const cells: (number | null)[] = [];
  for (let i = 0; i < startDow; i++) cells.push(null);
  for (let d = 1; d <= dim; d++) cells.push(d);
  while (cells.length % 7 !== 0) cells.push(null);
  return cells;
}

export function PlannerPage({ toast }: { toast: PlannerToast }) {
  const mob = useIsMobile();
  const { churchId } = useAuth();

  const [sidebarTab, setSidebarTab] = useState<"calendar" | "admin">("calendar");
  const [viewMode, setViewMode] = useState<"month" | "week" | "year">("month");
  const [cursor, setCursor] = useState(() => {
    const t = new Date();
    return { y: t.getFullYear(), m: t.getMonth() + 1 };
  });

  const [departments, setDepartments] = useState<PlannerDepartment[]>([]);
  const [places, setPlaces] = useState<PlannerPlace[]>([]);
  const [events, setEvents] = useState<PlannerEventRow[]>([]);
  const [calMarkers, setCalMarkers] = useState<ChurchCalendarRow[]>([]);
  const [loading, setLoading] = useState(true);

  const [modalOpen, setModalOpen] = useState(false);
  const [editingEvent, setEditingEvent] = useState<PlannerEventRow | null>(null);
  const [conflict, setConflict] = useState<string | null>(null);
  const [detailEvent, setDetailEvent] = useState<PlannerEventRow | null>(null);
  const [dayListModal, setDayListModal] = useState<{
    y: number;
    m: number;
    d: number;
    list: PlannerEventRow[];
  } | null>(null);

  const [formTitle, setFormTitle] = useState("");
  const [formDeptId, setFormDeptId] = useState<string>("");
  const [formType, setFormType] = useState("event");
  const [formStart, setFormStart] = useState("");
  const [formEnd, setFormEnd] = useState("");
  const [formAllDay, setFormAllDay] = useState(true);
  const [formStartT, setFormStartT] = useState("09:00");
  const [formEndT, setFormEndT] = useState("10:00");
  const [formPlaceId, setFormPlaceId] = useState<string>("");
  const [formRecurrence, setFormRecurrence] = useState("");
  const [formPeople, setFormPeople] = useState("");
  const [formDesc, setFormDesc] = useState("");
  const [formPublic, setFormPublic] = useState(true);

  const loadAll = useCallback(async () => {
    if (!supabase || !churchId) {
      setLoading(false);
      return;
    }
    let cid: string;
    try {
      cid = getChurchId();
    } catch {
      setLoading(false);
      toast("교회 정보를 불러올 수 없습니다. 로그인 상태를 확인하세요.", "err");
      return;
    }
    setLoading(true);
    let [dRes, pRes] = await Promise.all([
      supabase.from(TB_DEPARTMENTS).select("*").eq("church_id", cid).order("sort_order"),
      supabase.from(TB_PLACES).select("*").eq("church_id", cid).order("sort_order"),
    ]);
    if (dRes.error) console.error(dRes.error);
    if (pRes.error) console.error(pRes.error);
    if (
      !dRes.error &&
      !pRes.error &&
      (dRes.data?.length ?? 0) === 0 &&
      (pRes.data?.length ?? 0) === 0
    ) {
      await seedPlannerDefaultsIfEmpty(supabase, cid);
      [dRes, pRes] = await Promise.all([
        supabase.from(TB_DEPARTMENTS).select("*").eq("church_id", cid).order("sort_order"),
        supabase.from(TB_PLACES).select("*").eq("church_id", cid).order("sort_order"),
      ]);
    }
    const eRes = await supabase.from(TB_EVENTS).select("*").eq("church_id", cid).order("start_date");
    if (eRes.error) console.error(eRes.error);
    setDepartments((dRes.data ?? []) as PlannerDepartment[]);
    setPlaces((pRes.data ?? []) as PlannerPlace[]);
    setEvents((eRes.data ?? []) as PlannerEventRow[]);
    setLoading(false);
  }, [churchId, toast]);

  useEffect(() => {
    void loadAll();
  }, [loadAll]);

  const reloadCalendarMarkers = useCallback(async () => {
    if (!supabase || !churchId) return;
    let cid: string;
    try {
      cid = getChurchId();
    } catch {
      return;
    }
    const { data, error } = await supabase.from("church_calendar").select("*").eq("church_id", cid).eq("year", cursor.y);
    if (error) console.error(error);
    setCalMarkers((data ?? []) as ChurchCalendarRow[]);
  }, [churchId, cursor.y]);

  useEffect(() => {
    void reloadCalendarMarkers();
  }, [reloadCalendarMarkers]);

  const openModalForDay = (y: number, m: number, d: number, ev?: PlannerEventRow) => {
    setConflict(null);
    if (ev) {
      setEditingEvent(ev);
      setFormTitle(ev.title);
      setFormDeptId(ev.department_id ?? "");
      setFormType(ev.event_type || "event");
      setFormStart(ev.start_date);
      setFormEnd(ev.end_date ?? "");
      setFormAllDay(!!ev.is_all_day);
      setFormStartT((ev.start_time || "09:00").slice(0, 5));
      setFormEndT((ev.end_time || "10:00").slice(0, 5));
      setFormPlaceId(ev.place_id ?? "");
      setFormRecurrence(ev.recurrence_rule ?? "");
      setFormPeople(ev.expected_people != null ? String(ev.expected_people) : "");
      setFormDesc(ev.description ?? "");
      setFormPublic(ev.is_public !== false);
    } else {
      setEditingEvent(null);
      setFormTitle("");
      setFormDeptId(departments[0]?.id ?? "");
      setFormType("event");
      setFormStart(`${y}-${pad2(m)}-${pad2(d)}`);
      setFormEnd("");
      setFormAllDay(true);
      setFormStartT("09:00");
      setFormEndT("10:00");
      setFormPlaceId("");
      setFormRecurrence("");
      setFormPeople("");
      setFormDesc("");
      setFormPublic(true);
    }
    setModalOpen(true);
  };

  const saveEvent = async (force?: boolean) => {
    if (!supabase) return;
    let cid: string;
    try {
      cid = getChurchId();
    } catch {
      toast("로그인이 필요합니다.", "err");
      return;
    }
    if (!formTitle.trim()) {
      toast("제목을 입력하세요.", "warn");
      return;
    }
    const payload = {
      church_id: cid,
      title: formTitle.trim(),
      department_id: formDeptId || null,
      event_type: formType,
      start_date: formStart,
      end_date: formEnd.trim() || null,
      start_time: formAllDay ? null : `${formStartT}:00`,
      end_time: formAllDay ? null : `${formEndT}:00`,
      is_all_day: formAllDay,
      place_id: formPlaceId || null,
      recurrence_rule: formRecurrence || null,
      description: formDesc.trim() || null,
      expected_people: formPeople.trim() ? Number(formPeople) : null,
      is_public: formPublic,
    };

    if (!force) {
      let samePlaceEvents = events;
      if (payload.place_id) {
        const { data: dbEv } = await supabase
          .from(TB_EVENTS)
          .select("*")
          .eq("church_id", cid)
          .eq("place_id", payload.place_id);
        const byId = new Map<string, PlannerEventRow>();
        for (const e of events) byId.set(e.id, e);
        for (const e of (dbEv ?? []) as PlannerEventRow[]) byId.set(e.id, e);
        samePlaceEvents = Array.from(byId.values()).filter((e) => e.place_id === payload.place_id);
      }
      const c = findConflicts(
        samePlaceEvents,
        {
          id: editingEvent?.id,
          place_id: payload.place_id,
          start_date: payload.start_date,
          end_date: payload.end_date,
          is_all_day: formAllDay,
          start_time: formAllDay ? null : payload.start_time,
          end_time: formAllDay ? null : payload.end_time,
        },
        places,
        departments
      );
      if (c) {
        setConflict(c.message);
        return;
      }
    }

    setConflict(null);
    if (editingEvent) {
      const { error } = await supabase
        .from(TB_EVENTS)
        .update({ ...payload, updated_at: new Date().toISOString() })
        .eq("id", editingEvent.id);
      if (error) {
        toast("저장 실패: " + error.message, "err");
        return;
      }
      toast("일정이 수정되었습니다.");
    } else {
      const { error } = await supabase.from(TB_EVENTS).insert(payload);
      if (error) {
        toast("저장 실패: " + error.message, "err");
        return;
      }
      toast("일정이 추가되었습니다.");
    }
    setModalOpen(false);
    await loadAll();
  };

  const deleteEvent = async (id: string) => {
    if (!supabase) return;
    if (!confirm("이 일정을 삭제할까요?")) return;
    const { error } = await supabase.from(TB_EVENTS).delete().eq("id", id);
    if (error) {
      toast("삭제 실패: " + error.message, "err");
      return;
    }
    toast("삭제되었습니다.");
    setModalOpen(false);
    setDetailEvent(null);
    setDayListModal(null);
    await loadAll();
  };

  const grid = useMemo(() => monthGrid(cursor.y, cursor.m), [cursor.y, cursor.m]);
  const today = new Date();
  const isToday = (d: number | null) =>
    d != null && today.getFullYear() === cursor.y && today.getMonth() + 1 === cursor.m && today.getDate() === d;

  const calByDate = useMemo(() => {
    const m = new Map<string, ChurchCalendarRow[]>();
    for (const r of calMarkers) {
      const k = r.date;
      if (!m.has(k)) m.set(k, []);
      m.get(k)!.push(r);
    }
    return m;
  }, [calMarkers]);

  const navSections = useMemo(
    () => [
      {
        sectionLabel: "플래너",
        items: [
          { id: "calendar", label: "캘린더", Icon: CalendarDays },
          { id: "admin", label: "부서/장소 관리", Icon: Building2 },
        ],
      },
    ],
    []
  );

  const weekStart = useMemo(() => {
    const t = new Date(cursor.y, cursor.m - 1, 1);
    const dow = t.getDay();
    const s = new Date(t);
    s.setDate(1 - dow);
    return s;
  }, [cursor.y, cursor.m]);

  const weekDays = useMemo(() => {
    return Array.from({ length: 7 }, (_, i) => {
      const d = new Date(weekStart);
      d.setDate(weekStart.getDate() + i);
      return d;
    });
  }, [weekStart]);

  return (
    <UnifiedPageLayout
      pageTitle="플래너"
      pageSubtitle={new Date().toLocaleDateString("ko-KR", { year: "numeric", month: "long", day: "numeric" })}
      navSections={navSections}
      activeId={sidebarTab}
      onNav={(id) => setSidebarTab(id as "calendar" | "admin")}
      versionText="플래너 v1.0"
      headerTitle="교회 플래너"
      headerDesc="교회 전체 일정을 한눈에 관리합니다"
      SidebarIcon={CalendarDays}
      accentColor={ACCENT}
    >
      {loading && (
        <div style={{ padding: 40, textAlign: "center", color: "#6b7280" }}>불러오는 중…</div>
      )}
      {!loading && !churchId && (
        <div style={{ padding: 40, textAlign: "center", color: "#6b7280" }}>로그인 후 이용할 수 있습니다.</div>
      )}
      {!loading && churchId && sidebarTab === "calendar" && (
        <CalendarTabBody
          mob={mob}
          viewMode={viewMode}
          setViewMode={setViewMode}
          cursor={cursor}
          setCursor={setCursor}
          grid={grid}
          departments={departments}
          places={places}
          events={events}
          calByDate={calByDate}
          isToday={isToday}
          openModalForDay={openModalForDay}
          onEventPillClick={(ev) => setDetailEvent(ev)}
          onShowMoreDay={(y, m, d, list) => setDayListModal({ y, m, d, list })}
          weekDays={weekDays}
        />
      )}
      {!loading && churchId && sidebarTab === "admin" && (
        <DeptPlaceAdmin
          mob={mob}
          departments={departments}
          places={places}
          onRefresh={loadAll}
          toast={toast}
        />
      )}

      {detailEvent && (
        <EventDetailModal
          mob={mob}
          ev={detailEvent}
          departments={departments}
          places={places}
          onClose={() => setDetailEvent(null)}
          onEdit={() => {
            const ev = detailEvent;
            setDetailEvent(null);
            openModalForDay(
              Number(ev.start_date.slice(0, 4)),
              Number(ev.start_date.slice(5, 7)),
              Number(ev.start_date.slice(8, 10)),
              ev
            );
          }}
          onDelete={() => deleteEvent(detailEvent.id)}
        />
      )}

      {dayListModal && (
        <DayEventsListModal
          mob={mob}
          y={dayListModal.y}
          m={dayListModal.m}
          d={dayListModal.d}
          list={dayListModal.list}
          departments={departments}
          onClose={() => setDayListModal(null)}
          onPickEvent={(ev) => {
            setDayListModal(null);
            setDetailEvent(ev);
          }}
        />
      )}

      {modalOpen && (
        <EventModal
          mob={mob}
          conflict={conflict}
          setConflict={setConflict}
          onClose={() => {
            setModalOpen(false);
            setConflict(null);
          }}
          onSave={saveEvent}
          editingEvent={editingEvent}
          onDelete={editingEvent ? () => deleteEvent(editingEvent.id) : undefined}
          departments={departments}
          places={places}
          formTitle={formTitle}
          setFormTitle={setFormTitle}
          formDeptId={formDeptId}
          setFormDeptId={setFormDeptId}
          formType={formType}
          setFormType={setFormType}
          formStart={formStart}
          setFormStart={setFormStart}
          formEnd={formEnd}
          setFormEnd={setFormEnd}
          formAllDay={formAllDay}
          setFormAllDay={setFormAllDay}
          formStartT={formStartT}
          setFormStartT={setFormStartT}
          formEndT={formEndT}
          setFormEndT={setFormEndT}
          formPlaceId={formPlaceId}
          setFormPlaceId={setFormPlaceId}
          formRecurrence={formRecurrence}
          setFormRecurrence={setFormRecurrence}
          formPeople={formPeople}
          setFormPeople={setFormPeople}
          formDesc={formDesc}
          setFormDesc={setFormDesc}
          formPublic={formPublic}
          setFormPublic={setFormPublic}
        />
      )}

    </UnifiedPageLayout>
  );
}

function CalendarTabBody({
  mob,
  viewMode,
  setViewMode,
  cursor,
  setCursor,
  grid,
  departments,
  places,
  events,
  calByDate,
  isToday,
  openModalForDay,
  onEventPillClick,
  onShowMoreDay,
  weekDays,
}: {
  mob: boolean;
  viewMode: "month" | "week" | "year";
  setViewMode: (v: "month" | "week" | "year") => void;
  cursor: { y: number; m: number };
  setCursor: React.Dispatch<React.SetStateAction<{ y: number; m: number }>>;
  grid: (number | null)[];
  departments: PlannerDepartment[];
  places: PlannerPlace[];
  events: PlannerEventRow[];
  calByDate: Map<string, ChurchCalendarRow[]>;
  isToday: (d: number | null) => boolean;
  openModalForDay: (y: number, m: number, d: number, ev?: PlannerEventRow) => void;
  onEventPillClick: (ev: PlannerEventRow) => void;
  onShowMoreDay: (y: number, m: number, d: number, list: PlannerEventRow[]) => void;
  weekDays: Date[];
}) {
  const navArrowBtn: CSSProperties = {
    ...pillNavBtn,
    borderRadius: "50%",
    transition: "background 0.15s",
  };

  const headerRow: ReactNode = (
    <div
      style={{
        display: "flex",
        flexWrap: "wrap",
        alignItems: "center",
        justifyContent: "space-between",
        gap: 12,
        marginBottom: 16,
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
        <button
          type="button"
          className="finance-nav-btn"
          onClick={() => setCursor((c) => ({ y: c.m === 1 ? c.y - 1 : c.y, m: c.m === 1 ? 12 : c.m - 1 }))}
          style={navArrowBtn}
          onMouseEnter={(e) => {
            e.currentTarget.style.background = "#f0f4ff";
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.background = "#fff";
          }}
        >
          <ChevronLeft size={18} />
        </button>
        <span
          style={{
            fontSize: 18,
            fontWeight: 700,
            color: NAVY,
            minWidth: 160,
            textAlign: "center",
          }}
        >
          {cursor.y}년 {cursor.m}월
        </span>
        <button
          type="button"
          className="finance-nav-btn"
          onClick={() => setCursor((c) => ({ y: c.m === 12 ? c.y + 1 : c.y, m: c.m === 12 ? 1 : c.m + 1 }))}
          style={navArrowBtn}
          onMouseEnter={(e) => {
            e.currentTarget.style.background = "#f0f4ff";
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.background = "#fff";
          }}
        >
          <ChevronRight size={18} />
        </button>
      </div>
      <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
        <div
          style={{
            display: "flex",
            border: `1px solid ${BORDER}`,
            borderRadius: 10,
            overflow: "hidden",
          }}
        >
          {(["month", "week", "year"] as const).map((v, i) => (
            <button
              key={v}
              type="button"
              className="finance-nav-btn"
              onClick={() => setViewMode(v)}
              style={{
                padding: "6px 16px",
                fontSize: 13,
                fontWeight: 500,
                background: viewMode === v ? ACCENT : "#fff",
                color: viewMode === v ? "#fff" : "#64748b",
                border: "none",
                borderRight: i < 2 ? `1px solid ${BORDER}` : undefined,
                cursor: "pointer",
              }}
            >
              {v === "month" ? "월간" : v === "week" ? "주간" : "연간"}
            </button>
          ))}
        </div>
        <button
          type="button"
          className="finance-nav-btn"
          onClick={() => {
            console.log("일정 추가 클릭");
            openModalForDay(cursor.y, cursor.m, new Date().getDate());
          }}
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: 6,
            background: ACCENT,
            color: "#fff",
            borderRadius: 10,
            height: 38,
            padding: "0 16px",
            fontSize: 14,
            fontWeight: 600,
            border: "none",
            cursor: "pointer",
          }}
        >
          <Plus size={18} strokeWidth={2.5} />
          일정 추가
        </button>
      </div>
    </div>
  );

  return (
    <div
      style={{
        display: "flex",
        gap: 16,
        alignItems: "flex-start",
        position: "relative",
        maxWidth: "100%",
        overflow: "hidden",
        boxSizing: "border-box",
      }}
    >
      <div style={{ flex: 1, minWidth: 0, maxWidth: "100%", overflow: "hidden" }}>
        {headerRow}
        {viewMode === "month" && (
          <MonthGridView
            mob={mob}
            cursor={cursor}
            grid={grid}
            departments={departments}
            events={events}
            calByDate={calByDate}
            isToday={isToday}
            onCellClick={(d) => {
              if (d == null) return;
              const date = { y: cursor.y, m: cursor.m, d };
              console.log("날짜 클릭:", date);
              openModalForDay(cursor.y, cursor.m, d);
            }}
            onEventPillClick={onEventPillClick}
            onShowMoreDay={onShowMoreDay}
          />
        )}
        {viewMode === "week" && (
          <WeekStripView weekDays={weekDays} departments={departments} events={events} onPickDay={(d) => openModalForDay(d.getFullYear(), d.getMonth() + 1, d.getDate())} />
        )}
        {viewMode === "year" && <YearPlaceholder year={cursor.y} />}
      </div>
    </div>
  );
}

const pillNavBtn: CSSProperties = {
  width: 36,
  height: 36,
  borderRadius: 8,
  border: `1px solid ${BORDER}`,
  background: "#fff",
  cursor: "pointer",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
};

function MonthGridView({
  mob,
  cursor,
  grid,
  departments,
  events,
  calByDate,
  isToday,
  onCellClick,
  onEventPillClick,
  onShowMoreDay,
}: {
  mob: boolean;
  cursor: { y: number; m: number };
  grid: (number | null)[];
  departments: PlannerDepartment[];
  events: PlannerEventRow[];
  calByDate: Map<string, ChurchCalendarRow[]>;
  isToday: (d: number | null) => boolean;
  onCellClick: (d: number | null) => void;
  onEventPillClick: (ev: PlannerEventRow) => void;
  onShowMoreDay: (y: number, m: number, d: number, list: PlannerEventRow[]) => void;
}) {
  const dow = ["일", "월", "화", "수", "목", "금", "토"];
  const cellMinH = mob ? 44 : 100;
  const pillBg = (hex: string) => {
    const h = hex.startsWith("#") ? hex.slice(1) : hex;
    if (h.length === 6) return `#${h}33`;
    return hex;
  };

  return (
    <div
      style={{
        background: "#fff",
        borderRadius: 16,
        boxShadow: "0 2px 12px rgba(0,0,0,0.06)",
        overflow: "hidden",
        maxWidth: "100%",
        width: "100%",
        minWidth: 0,
        boxSizing: "border-box",
      }}
    >
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(7, minmax(0, 1fr))",
          background: "#f8f9fc",
          borderBottom: "1px solid #e5e7eb",
          height: 40,
          alignItems: "center",
        }}
      >
        {dow.map((label, i) => (
          <div
            key={label}
            style={{
              textAlign: "center",
              fontSize: 13,
              fontWeight: 700,
              color: i === 0 ? "#EF4444" : i === 6 ? "#3B82F6" : "#64748b",
            }}
          >
            {label}
          </div>
        ))}
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(7, minmax(0, 1fr))", width: "100%", minWidth: 0 }}>
        {grid.map((d, idx) => {
          const col = idx % 7;
          const dateKey = d != null ? `${cursor.y}-${pad2(cursor.m)}-${pad2(d)}` : "";
          const markers = d != null ? calByDate.get(dateKey) : undefined;
          const cellEvents = d != null ? events.filter((e) => eventCoversDate(e, cursor.y, cursor.m, d)) : [];
          const sunday = col === 0;
          const saturday = col === 6;
          const seasonNames = markers?.map((m) => m.name).join(" · ");
          const visible = mob ? cellEvents : cellEvents.slice(0, 3);
          const moreCount = mob ? 0 : Math.max(0, cellEvents.length - 3);

          return (
            <button
              key={idx}
              type="button"
              onClick={() => onCellClick(d)}
              style={{
                minHeight: cellMinH,
                borderRight: "1px solid #f0f0f0",
                borderBottom: "1px solid #f0f0f0",
                padding: 6,
                textAlign: "left",
                verticalAlign: "top",
                background: "#fff",
                cursor: d == null ? "default" : "pointer",
                overflow: "hidden",
                boxSizing: "border-box",
              }}
              onMouseEnter={(e) => {
                if (d != null) e.currentTarget.style.background = "#f8fafc";
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = "#fff";
              }}
            >
              {d != null && (
                <>
                  <div
                    style={{
                      display: "flex",
                      flexDirection: "column",
                      alignItems: "flex-start",
                      gap: 2,
                      marginBottom: 2,
                    }}
                  >
                    <span
                      style={{
                        display: "inline-flex",
                        alignItems: "center",
                        justifyContent: "center",
                        width: isToday(d) ? 28 : undefined,
                        height: isToday(d) ? 28 : undefined,
                        minWidth: isToday(d) ? 28 : undefined,
                        borderRadius: isToday(d) ? "50%" : undefined,
                        fontSize: 13,
                        fontWeight: 500,
                        color: isToday(d) ? "#fff" : sunday ? "#EF4444" : saturday ? "#3B82F6" : NAVY,
                        background: isToday(d) ? ACCENT : "transparent",
                      }}
                    >
                      {d}
                    </span>
                    {seasonNames ? (
                      <span
                        style={{
                          fontSize: 9,
                          color: "#EF4444",
                          lineHeight: 1.2,
                          maxWidth: "100%",
                          overflow: "hidden",
                          textOverflow: "ellipsis",
                          whiteSpace: "nowrap",
                        }}
                        title={seasonNames}
                      >
                        {seasonNames}
                      </span>
                    ) : null}
                  </div>
                  <div style={{ display: "flex", flexDirection: "column", marginTop: 2 }}>
                    {visible.map((ev) => {
                      const dept = departments.find((x) => x.id === ev.department_id);
                      const c = dept?.color ?? ACCENT;
                      if (mob) {
                        return (
                          <button
                            key={ev.id}
                            type="button"
                            title={ev.title}
                            onClick={(e) => {
                              e.stopPropagation();
                              onEventPillClick(ev);
                            }}
                            style={{
                              width: 6,
                              height: 6,
                              borderRadius: "50%",
                              background: c,
                              border: "none",
                              padding: 0,
                              marginBottom: 3,
                              cursor: "pointer",
                              alignSelf: "flex-start",
                            }}
                          />
                        );
                      }
                      return (
                        <button
                          key={ev.id}
                          type="button"
                          title={ev.title}
                          onClick={(e) => {
                            e.stopPropagation();
                            onEventPillClick(ev);
                          }}
                          style={{
                            marginTop: 2,
                            marginBottom: 2,
                            maxWidth: "100%",
                            overflow: "hidden",
                            textOverflow: "ellipsis",
                            whiteSpace: "nowrap",
                            fontSize: 11,
                            lineHeight: 1.3,
                            borderRadius: 4,
                            padding: "1px 6px",
                            border: "none",
                            cursor: "pointer",
                            textAlign: "left",
                            background: pillBg(c),
                            color: c,
                            fontWeight: 500,
                          }}
                        >
                          {ev.title}
                        </button>
                      );
                    })}
                    {!mob && moreCount > 0 && (
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          onShowMoreDay(cursor.y, cursor.m, d, cellEvents);
                        }}
                        style={{
                          marginTop: 2,
                          fontSize: 11,
                          color: "#64748b",
                          background: "transparent",
                          border: "none",
                          cursor: "pointer",
                          padding: "1px 0",
                          textAlign: "left",
                        }}
                      >
                        +{moreCount} 더보기
                      </button>
                    )}
                  </div>
                </>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}

function WeekStripView({
  weekDays,
  departments,
  events,
  onPickDay,
}: {
  weekDays: Date[];
  departments: PlannerDepartment[];
  events: PlannerEventRow[];
  onPickDay: (d: Date) => void;
}) {
  return (
    <div style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", gap: 8 }}>
      {weekDays.map((d) => {
        const y = d.getFullYear();
        const m = d.getMonth() + 1;
        const day = d.getDate();
        const list = events.filter((e) => eventCoversDate(e, y, m, day));
        return (
          <div key={d.toISOString()} style={{ background: "#fff", border: `1px solid ${BORDER}`, borderRadius: 10, padding: 8, minHeight: 120 }}>
            <div style={{ fontWeight: 700, fontSize: 12, marginBottom: 8, color: d.getDay() === 0 ? "#dc2626" : d.getDay() === 6 ? "#2563eb" : NAVY }}>
              {m}/{day}
            </div>
            {list.map((ev) => {
              const dept = departments.find((x) => x.id === ev.department_id);
              const bg = dept?.color ?? ACCENT;
              return (
                <div
                  key={ev.id}
                  style={{
                    borderRadius: 6,
                    fontSize: 11,
                    padding: "2px 6px",
                    marginBottom: 4,
                    background: `${bg}18`,
                    color: bg,
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                    whiteSpace: "nowrap",
                  }}
                >
                  {ev.title}
                </div>
              );
            })}
            <button type="button" className="finance-nav-btn" onClick={() => onPickDay(d)} style={{ marginTop: 8, fontSize: 11, color: ACCENT, background: "none", border: "none", cursor: "pointer" }}>
              + 추가
            </button>
          </div>
        );
      })}
    </div>
  );
}

function YearPlaceholder({ year }: { year: number }) {
  return (
    <div style={{ padding: 32, textAlign: "center", background: "#fff", border: `1px solid ${BORDER}`, borderRadius: 12, color: "#6b7280" }}>
      {year}년 연간 뷰는 2단계에서 확장됩니다. 월간/주간에서 일정을 관리해 주세요.
    </div>
  );
}

function EventDetailModal({
  mob,
  ev,
  departments,
  places,
  onClose,
  onEdit,
  onDelete,
}: {
  mob: boolean;
  ev: PlannerEventRow;
  departments: PlannerDepartment[];
  places: PlannerPlace[];
  onClose: () => void;
  onEdit: () => void;
  onDelete: () => void;
}) {
  const dept = departments.find((d) => d.id === ev.department_id);
  const place = places.find((p) => p.id === ev.place_id);
  const typeLabel = EVENT_TYPE_OPTIONS.find((t) => t.value === ev.event_type)?.label ?? ev.event_type;
  let timeStr = "종일";
  if (!ev.is_all_day && (ev.start_time || ev.end_time)) {
    timeStr = `${(ev.start_time || "").slice(0, 5)} ~ ${(ev.end_time || "").slice(0, 5)}`;
  }
  const cardStyle: CSSProperties = mob
    ? {
        background: "#fff",
        borderRadius: "20px 20px 0 0",
        padding: 24,
        maxHeight: "85vh",
        overflowY: "auto",
        width: "100%",
        maxWidth: 500,
        boxShadow: "0 20px 60px rgba(0,0,0,0.15)",
      }
    : {
        background: "#fff",
        borderRadius: 20,
        padding: 28,
        maxWidth: 500,
        width: "90%",
        boxShadow: "0 20px 60px rgba(0,0,0,0.15)",
      };

  return (
    <div
      role="presentation"
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(0,0,0,0.4)",
        backdropFilter: "blur(4px)",
        WebkitBackdropFilter: "blur(4px)",
        zIndex: 220,
        display: "flex",
        alignItems: mob ? "flex-end" : "center",
        justifyContent: "center",
        padding: mob ? 0 : 24,
      }}
      onClick={onClose}
    >
      <div role="dialog" style={cardStyle} onClick={(e) => e.stopPropagation()}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 16 }}>
          <h2 style={{ fontSize: 18, fontWeight: 700, color: NAVY, margin: 0, flex: 1, paddingRight: 8 }}>{ev.title}</h2>
          <button type="button" onClick={onClose} style={{ border: "none", background: "none", cursor: "pointer", padding: 4 }}>
            <X size={22} />
          </button>
        </div>
        <div style={{ fontSize: 14, color: "#475569", lineHeight: 1.6 }}>
          <div>
            <strong style={{ color: NAVY }}>부서</strong> {dept?.name ?? "—"}
          </div>
          <div>
            <strong style={{ color: NAVY }}>유형</strong> {typeLabel}
          </div>
          <div>
            <strong style={{ color: NAVY }}>기간</strong> {ev.start_date}
            {ev.end_date && ev.end_date !== ev.start_date ? ` ~ ${ev.end_date}` : ""}
          </div>
          <div>
            <strong style={{ color: NAVY }}>시간</strong> {timeStr}
          </div>
          <div>
            <strong style={{ color: NAVY }}>장소</strong> {place?.name ?? "—"}
          </div>
          {ev.expected_people != null && (
            <div>
              <strong style={{ color: NAVY }}>예상 인원</strong> {ev.expected_people}명
            </div>
          )}
          {ev.description ? (
            <div style={{ marginTop: 12 }}>
              <strong style={{ color: NAVY }}>메모</strong>
              <div style={{ marginTop: 4, whiteSpace: "pre-wrap" }}>{ev.description}</div>
            </div>
          ) : null}
        </div>
        <div style={{ display: "flex", gap: 10, marginTop: 24, flexWrap: "wrap" }}>
          <button
            type="button"
            onClick={onDelete}
            style={{
              padding: "10px 16px",
              borderRadius: 12,
              border: "1px solid #fecaca",
              color: "#b91c1c",
              background: "#fff",
              cursor: "pointer",
              fontWeight: 600,
            }}
          >
            삭제
          </button>
          <button
            type="button"
            onClick={onEdit}
            style={{
              flex: 1,
              minWidth: 120,
              padding: "10px 16px",
              borderRadius: 12,
              background: ACCENT,
              color: "#fff",
              border: "none",
              cursor: "pointer",
              fontWeight: 700,
            }}
          >
            수정
          </button>
        </div>
      </div>
    </div>
  );
}

function DayEventsListModal({
  mob,
  y,
  m,
  d,
  list,
  departments,
  onClose,
  onPickEvent,
}: {
  mob: boolean;
  y: number;
  m: number;
  d: number;
  list: PlannerEventRow[];
  departments: PlannerDepartment[];
  onClose: () => void;
  onPickEvent: (ev: PlannerEventRow) => void;
}) {
  const label = `${y}년 ${m}월 ${d}일`;
  const cardStyle: CSSProperties = mob
    ? {
        background: "#fff",
        borderRadius: "20px 20px 0 0",
        padding: 24,
        maxHeight: "85vh",
        overflowY: "auto",
        width: "100%",
        maxWidth: 500,
        boxShadow: "0 20px 60px rgba(0,0,0,0.15)",
      }
    : {
        background: "#fff",
        borderRadius: 20,
        padding: 28,
        maxWidth: 500,
        width: "90%",
        boxShadow: "0 20px 60px rgba(0,0,0,0.15)",
      };

  return (
    <div
      role="presentation"
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(0,0,0,0.4)",
        backdropFilter: "blur(4px)",
        WebkitBackdropFilter: "blur(4px)",
        zIndex: 215,
        display: "flex",
        alignItems: mob ? "flex-end" : "center",
        justifyContent: "center",
        padding: mob ? 0 : 24,
      }}
      onClick={onClose}
    >
      <div role="dialog" style={cardStyle} onClick={(e) => e.stopPropagation()}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
          <h2 style={{ fontSize: 18, fontWeight: 700, color: NAVY, margin: 0 }}>{label} 일정</h2>
          <button type="button" onClick={onClose} style={{ border: "none", background: "none", cursor: "pointer", padding: 4 }}>
            <X size={22} />
          </button>
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {list.map((ev) => {
            const dept = departments.find((x) => x.id === ev.department_id);
            const c = dept?.color ?? ACCENT;
            return (
              <button
                key={ev.id}
                type="button"
                onClick={() => onPickEvent(ev)}
                style={{
                  textAlign: "left",
                  padding: "12px 14px",
                  borderRadius: 12,
                  border: `1px solid ${BORDER}`,
                  background: "#fafafa",
                  cursor: "pointer",
                }}
              >
                <span style={{ display: "inline-block", width: 8, height: 8, borderRadius: "50%", background: c, marginRight: 8, verticalAlign: "middle" }} />
                <span style={{ fontWeight: 600, color: NAVY }}>{ev.title}</span>
                <span style={{ fontSize: 12, color: "#64748b", marginLeft: 8 }}>{dept?.name ?? ""}</span>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}

function EventModal({
  mob,
  conflict,
  setConflict,
  onClose,
  onSave,
  editingEvent,
  onDelete,
  departments,
  places,
  formTitle,
  setFormTitle,
  formDeptId,
  setFormDeptId,
  formType,
  setFormType,
  formStart,
  setFormStart,
  formEnd,
  setFormEnd,
  formAllDay,
  setFormAllDay,
  formStartT,
  setFormStartT,
  formEndT,
  setFormEndT,
  formPlaceId,
  setFormPlaceId,
  formRecurrence,
  setFormRecurrence,
  formPeople,
  setFormPeople,
  formDesc,
  setFormDesc,
  formPublic,
  setFormPublic,
}: {
  mob: boolean;
  conflict: string | null;
  setConflict: (s: string | null) => void;
  onClose: () => void;
  onSave: (force?: boolean) => void;
  editingEvent: PlannerEventRow | null;
  onDelete?: () => void;
  departments: PlannerDepartment[];
  places: PlannerPlace[];
  formTitle: string;
  setFormTitle: (s: string) => void;
  formDeptId: string;
  setFormDeptId: (s: string) => void;
  formType: string;
  setFormType: (s: string) => void;
  formStart: string;
  setFormStart: (s: string) => void;
  formEnd: string;
  setFormEnd: (s: string) => void;
  formAllDay: boolean;
  setFormAllDay: (b: boolean) => void;
  formStartT: string;
  setFormStartT: (s: string) => void;
  formEndT: string;
  setFormEndT: (s: string) => void;
  formPlaceId: string;
  setFormPlaceId: (s: string) => void;
  formRecurrence: string;
  setFormRecurrence: (s: string) => void;
  formPeople: string;
  setFormPeople: (s: string) => void;
  formDesc: string;
  setFormDesc: (s: string) => void;
  formPublic: boolean;
  setFormPublic: (b: boolean) => void;
}) {
  const inputStyle: CSSProperties = {
    width: "100%",
    height: 42,
    padding: "0 14px",
    borderRadius: 10,
    border: "1.5px solid #e0e3ea",
    fontSize: 14,
    boxSizing: "border-box",
  };
  const labelStyle: CSSProperties = {
    fontSize: 13,
    fontWeight: 600,
    color: "#475569",
    marginBottom: 6,
    display: "block",
  };
  const fieldMb = { marginBottom: 16 } as CSSProperties;

  const wrapAlign = mob ? ("flex-end" as const) : ("center" as const);
  const cardStyle: CSSProperties = mob
    ? {
        background: "#fff",
        borderRadius: "20px 20px 0 0",
        width: "100%",
        maxWidth: 500,
        maxHeight: "85vh",
        overflow: "hidden",
        display: "flex",
        flexDirection: "column",
        boxShadow: "0 20px 60px rgba(0,0,0,0.15)",
      }
    : {
        background: "#fff",
        borderRadius: 20,
        padding: 28,
        width: "90%",
        maxWidth: 500,
        maxHeight: "90vh",
        overflow: "hidden",
        display: "flex",
        flexDirection: "column",
        boxShadow: "0 20px 60px rgba(0,0,0,0.15)",
      };

  const innerPad: CSSProperties = mob
    ? { padding: "20px 20px 0", overflowY: "auto", flex: 1 }
    : { overflowY: "auto", flex: 1 };

  const footPad: CSSProperties = mob
    ? { padding: "16px 20px 24px", borderTop: `1px solid ${BORDER}`, display: "flex", gap: 10, flexDirection: "column" as const }
    : { marginTop: 8, display: "flex", gap: 10, flexWrap: "wrap", justifyContent: "flex-end" as const };

  return (
    <div
      className="modal-bg"
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(0,0,0,0.4)",
        backdropFilter: "blur(4px)",
        WebkitBackdropFilter: "blur(4px)",
        zIndex: 200,
        display: "flex",
        alignItems: wrapAlign,
        justifyContent: "center",
        padding: mob ? 0 : 24,
      }}
    >
      <div className="modal" style={cardStyle}>
        {mob ? (
          <div style={{ padding: "20px 20px 0", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <span style={{ fontWeight: 700, fontSize: 18, color: NAVY }}>{editingEvent ? "일정 수정" : "일정 추가"}</span>
            <button type="button" className="finance-nav-btn" onClick={onClose} style={{ border: "none", background: "none", cursor: "pointer" }}>
              <X size={22} />
            </button>
          </div>
        ) : (
          <h2 style={{ fontSize: 18, fontWeight: 700, color: NAVY, margin: "0 0 20px" }}>{editingEvent ? "일정 수정" : "일정 추가"}</h2>
        )}
        <div className="modal-body" style={innerPad}>
          {conflict && (
            <div
              style={{
                padding: 14,
                background: "#fff7ed",
                border: "1px solid #fdba74",
                borderRadius: 10,
                marginBottom: 16,
                fontSize: 13,
                color: "#9a3412",
              }}
            >
              {conflict}
              <div style={{ display: "flex", gap: 8, marginTop: 12, flexWrap: "wrap" }}>
                <button
                  type="button"
                  className="finance-nav-btn"
                  onClick={() => onSave(true)}
                  style={{
                    padding: "8px 14px",
                    borderRadius: 10,
                    background: ACCENT,
                    color: "#fff",
                    border: "none",
                    fontWeight: 600,
                    cursor: "pointer",
                  }}
                >
                  그래도 저장
                </button>
                <button
                  type="button"
                  className="finance-nav-btn"
                  onClick={() => setConflict(null)}
                  style={{
                    padding: "8px 14px",
                    borderRadius: 10,
                    border: "1.5px solid #e0e3ea",
                    background: "transparent",
                    color: "#64748b",
                    cursor: "pointer",
                    fontWeight: 600,
                  }}
                >
                  취소
                </button>
              </div>
            </div>
          )}
          <div style={fieldMb}>
            <label style={labelStyle}>제목 *</label>
            <input value={formTitle} onChange={(e) => setFormTitle(e.target.value)} style={inputStyle} />
          </div>

          <div style={fieldMb}>
            <label style={labelStyle}>부서</label>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginBottom: 8 }}>
              {departments
                .filter((d) => d.is_active !== false)
                .map((d) => (
                  <button
                    key={d.id}
                    type="button"
                    title={d.name}
                    onClick={() => setFormDeptId(d.id)}
                    style={{
                      width: 22,
                      height: 22,
                      borderRadius: "50%",
                      background: d.color,
                      border: formDeptId === d.id ? "2px solid #1B2A4A" : "2px solid transparent",
                      cursor: "pointer",
                      padding: 0,
                      boxSizing: "border-box",
                    }}
                  />
                ))}
            </div>
            <select value={formDeptId} onChange={(e) => setFormDeptId(e.target.value)} className="select-modern" style={{ ...inputStyle, height: 42 }}>
              <option value="">선택</option>
              {departments.filter((d) => d.is_active !== false).map((d) => (
                <option key={d.id} value={d.id}>
                  {d.name}
                </option>
              ))}
            </select>
          </div>

          <div style={fieldMb}>
            <label style={labelStyle}>일정 유형</label>
            <select value={formType} onChange={(e) => setFormType(e.target.value)} className="select-modern" style={{ ...inputStyle, height: 42 }}>
              {EVENT_TYPE_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
          </div>

          <div style={fieldMb}>
            <label style={labelStyle}>시작일</label>
            <input type="date" value={formStart} onChange={(e) => setFormStart(e.target.value)} style={inputStyle} />
          </div>
          <div style={fieldMb}>
            <label style={labelStyle}>종료일 (선택)</label>
            <input type="date" value={formEnd} onChange={(e) => setFormEnd(e.target.value)} style={inputStyle} />
          </div>

          <div style={{ ...fieldMb, display: "flex", alignItems: "center", gap: 10 }}>
            <PlannerSwitch checked={formAllDay} onChange={setFormAllDay} label="종일" />
          </div>
          {!formAllDay && (
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 16 }}>
              <div>
                <label style={labelStyle}>시작 시간</label>
                <input type="time" value={formStartT} onChange={(e) => setFormStartT(e.target.value)} style={inputStyle} />
              </div>
              <div>
                <label style={labelStyle}>종료 시간</label>
                <input type="time" value={formEndT} onChange={(e) => setFormEndT(e.target.value)} style={inputStyle} />
              </div>
            </div>
          )}

          <div style={fieldMb}>
            <label style={labelStyle}>장소</label>
            <select value={formPlaceId} onChange={(e) => setFormPlaceId(e.target.value)} className="select-modern" style={{ ...inputStyle, height: 42 }}>
              <option value="">선택</option>
              {places.filter((p) => p.is_active !== false).map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
          </div>

          <div style={fieldMb}>
            <label style={labelStyle}>반복</label>
            <select value={formRecurrence} onChange={(e) => setFormRecurrence(e.target.value)} className="select-modern" style={{ ...inputStyle, height: 42 }}>
              {RECURRENCE_OPTIONS.map((o) => (
                <option key={o.value || "none"} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
          </div>

          <div style={fieldMb}>
            <label style={labelStyle}>예상 인원</label>
            <input type="number" min={0} value={formPeople} onChange={(e) => setFormPeople(e.target.value)} style={inputStyle} />
          </div>

          <div style={fieldMb}>
            <label style={labelStyle}>메모</label>
            <textarea
              value={formDesc}
              onChange={(e) => setFormDesc(e.target.value)}
              rows={3}
              style={{ ...inputStyle, height: "auto", minHeight: 80, paddingTop: 10, paddingBottom: 10, resize: "vertical" }}
            />
          </div>

          <div style={{ marginBottom: mob ? 8 : 0 }}>
            <PlannerSwitch checked={formPublic} onChange={setFormPublic} label="공개" />
          </div>
        </div>
        <div className="modal-foot" style={footPad}>
          {onDelete && (
            <button
              type="button"
              className="finance-nav-btn"
              onClick={onDelete}
              style={{
                marginRight: mob ? 0 : "auto",
                padding: "10px 16px",
                borderRadius: 12,
                border: "1px solid #fecaca",
                color: "#b91c1c",
                background: "#fff",
                cursor: "pointer",
                order: mob ? 2 : 0,
              }}
            >
              삭제
            </button>
          )}
          <button
            type="button"
            className="finance-nav-btn"
            onClick={onClose}
            style={{
              width: mob ? "100%" : "auto",
              padding: "12px 16px",
              borderRadius: 12,
              border: "1.5px solid #e0e3ea",
              background: "transparent",
              color: "#64748b",
              cursor: "pointer",
              fontWeight: 600,
              order: mob ? 1 : 0,
            }}
          >
            취소
          </button>
          <button
            type="button"
            className="finance-nav-btn"
            onClick={() => onSave()}
            style={{
              width: mob ? "100%" : "auto",
              flex: mob ? undefined : 1,
              maxWidth: mob ? undefined : "100%",
              padding: "12px 16px",
              borderRadius: 12,
              background: ACCENT,
              color: "#fff",
              border: "none",
              fontWeight: 700,
              fontSize: 15,
              cursor: "pointer",
              order: mob ? 0 : 0,
            }}
          >
            저장
          </button>
        </div>
      </div>
    </div>
  );
}

function PlannerSwitch({
  checked,
  onChange,
  label,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
  label?: string;
}) {
  const inner = (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label || "토글"}
      onClick={() => onChange(!checked)}
      style={{
        width: 40,
        height: 22,
        borderRadius: 11,
        border: "none",
        padding: 2,
        background: checked ? ACCENT : "#cbd5e1",
        cursor: "pointer",
        position: "relative",
        flexShrink: 0,
      }}
    >
      <span
        style={{
          display: "block",
          width: 18,
          height: 18,
          borderRadius: "50%",
          background: "#fff",
          marginLeft: checked ? 18 : 0,
          transition: "margin 0.15s ease",
        }}
      />
    </button>
  );
  if (!label) return <span style={{ display: "inline-flex", alignItems: "center" }}>{inner}</span>;
  return (
    <label style={{ display: "inline-flex", alignItems: "center", gap: 10, cursor: "pointer", userSelect: "none" }}>
      {inner}
      <span style={{ fontSize: 13, fontWeight: 600, color: "#475569" }}>{label}</span>
    </label>
  );
}

function DeptPlaceAdmin({
  mob,
  departments,
  places,
  onRefresh,
  toast,
}: {
  mob: boolean;
  departments: PlannerDepartment[];
  places: PlannerPlace[];
  onRefresh: () => Promise<void>;
  toast: PlannerToast;
}) {
  const [deptModal, setDeptModal] = useState<null | PlannerDepartment | "new">(null);
  const [placeModal, setPlaceModal] = useState<null | PlannerPlace | "new">(null);

  const cardShell: CSSProperties = {
    background: "#fff",
    borderRadius: 16,
    padding: 24,
    boxShadow: "0 2px 12px rgba(0,0,0,0.06)",
  };

  const toggleDeptActive = async (d: PlannerDepartment, next: boolean) => {
    if (!supabase) return;
    const { error } = await supabase.from(TB_DEPARTMENTS).update({ is_active: next }).eq("id", d.id);
    if (error) {
      window.alert(error.message);
      return;
    }
    await onRefresh();
  };

  const togglePlaceActive = async (p: PlannerPlace, next: boolean) => {
    if (!supabase) return;
    const { error } = await supabase.from(TB_PLACES).update({ is_active: next }).eq("id", p.id);
    if (error) {
      window.alert(error.message);
      return;
    }
    await onRefresh();
  };

  const deleteDept = async (d: PlannerDepartment) => {
    if (!supabase) return;
    if (!window.confirm("정말 삭제하시겠습니까?")) return;
    const { error } = await supabase.from(TB_DEPARTMENTS).delete().eq("id", d.id);
    if (error) {
      window.alert(error.message);
      return;
    }
    toast("삭제되었습니다.");
    await onRefresh();
  };

  const deletePlace = async (p: PlannerPlace) => {
    if (!supabase) return;
    if (!window.confirm("정말 삭제하시겠습니까?")) return;
    const { error } = await supabase.from(TB_PLACES).delete().eq("id", p.id);
    if (error) {
      window.alert(error.message);
      return;
    }
    toast("삭제되었습니다.");
    await onRefresh();
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 24, maxWidth: "100%", minWidth: 0, boxSizing: "border-box" }}>
      <section style={{ ...cardShell, maxWidth: "100%", minWidth: 0, boxSizing: "border-box" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
          <h3 style={{ fontSize: 17, fontWeight: 700, color: NAVY, margin: 0 }}>부서 관리</h3>
          <button
            type="button"
            className="finance-nav-btn"
            onClick={() => {
              console.log("부서 추가 클릭");
              setDeptModal("new");
            }}
            style={{ padding: "8px 14px", borderRadius: 10, background: ACCENT, color: "#fff", border: "none", fontWeight: 600, cursor: "pointer" }}
          >
            부서 추가
          </button>
        </div>
        {mob ? (
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            {departments.map((d) => (
              <div key={d.id} style={{ border: `1px solid ${BORDER}`, borderRadius: 12, padding: 14 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 8 }}>
                  <span style={{ width: 20, height: 20, borderRadius: "50%", background: d.color, display: "inline-block", flexShrink: 0 }} />
                  <span style={{ fontWeight: 700, color: NAVY, flex: 1 }}>{d.name}</span>
                  <PlannerSwitch checked={d.is_active !== false} onChange={(v) => void toggleDeptActive(d, v)} label="" />
                </div>
                <div style={{ fontSize: 13, color: "#64748b", marginBottom: 8 }}>
                  담당: {d.leader_name ?? "—"} · 순서 {d.sort_order ?? 0}
                </div>
                <div style={{ display: "flex", gap: 8 }}>
                  <button type="button" className="finance-nav-btn" onClick={() => setDeptModal(d)} style={{ flex: 1, padding: "8px", borderRadius: 8, border: `1px solid ${BORDER}`, background: "#fff", cursor: "pointer" }}>
                    수정
                  </button>
                  <button
                    type="button"
                    className="finance-nav-btn"
                    onClick={() => void deleteDept(d)}
                    style={{ flex: 1, padding: "8px", borderRadius: 8, border: "1px solid #fecaca", color: "#b91c1c", background: "#fff", cursor: "pointer" }}
                  >
                    삭제
                  </button>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div style={{ overflow: "auto" }}>
            <table className="data-table" style={{ width: "100%", borderCollapse: "collapse", fontSize: 14 }}>
              <thead>
                <tr style={{ borderBottom: `1px solid ${BORDER}` }}>
                  {["색상", "부서명", "담당자", "순서", "활성", ""].map((h) => (
                    <th key={h} style={{ textAlign: "left", padding: "10px 12px", fontWeight: 700, color: NAVY }}>
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {departments.map((d) => (
                  <tr key={d.id} style={{ borderBottom: `1px solid ${BORDER}` }}>
                    <td style={{ padding: "10px 12px" }}>
                      <span style={{ width: 20, height: 20, borderRadius: "50%", background: d.color, display: "inline-block", verticalAlign: "middle" }} />
                    </td>
                    <td style={{ padding: "10px 12px" }}>{d.name}</td>
                    <td style={{ padding: "10px 12px" }}>{d.leader_name ?? "—"}</td>
                    <td style={{ padding: "10px 12px" }}>{d.sort_order ?? 0}</td>
                    <td style={{ padding: "10px 12px" }}>
                      <PlannerSwitch checked={d.is_active !== false} onChange={(v) => void toggleDeptActive(d, v)} label="" />
                    </td>
                    <td style={{ padding: "10px 12px", whiteSpace: "nowrap" }}>
                      <button type="button" className="finance-nav-btn" onClick={() => setDeptModal(d)} style={{ fontSize: 12, marginRight: 8, cursor: "pointer" }}>
                        수정
                      </button>
                      <button type="button" className="finance-nav-btn" onClick={() => void deleteDept(d)} style={{ fontSize: 12, cursor: "pointer", color: "#b91c1c" }}>
                        삭제
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section style={{ ...cardShell, maxWidth: "100%", minWidth: 0, boxSizing: "border-box" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
          <h3 style={{ fontSize: 17, fontWeight: 700, color: NAVY, margin: 0 }}>장소 관리</h3>
          <button
            type="button"
            className="finance-nav-btn"
            onClick={() => {
              console.log("장소 추가 클릭");
              setPlaceModal("new");
            }}
            style={{ padding: "8px 14px", borderRadius: 10, background: ACCENT, color: "#fff", border: "none", fontWeight: 600, cursor: "pointer" }}
          >
            장소 추가
          </button>
        </div>
        {mob ? (
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            {places.map((p) => (
              <div key={p.id} style={{ border: `1px solid ${BORDER}`, borderRadius: 12, padding: 14 }}>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10, marginBottom: 8 }}>
                  <span style={{ fontWeight: 700, color: NAVY }}>{p.name}</span>
                  <PlannerSwitch checked={p.is_active !== false} onChange={(v) => void togglePlaceActive(p, v)} label="" />
                </div>
                <div style={{ fontSize: 13, color: "#64748b", marginBottom: 8 }}>
                  수용 {p.capacity ?? "—"} · {(p.equipment ?? []).join(", ") || "장비 없음"}
                </div>
                <div style={{ display: "flex", gap: 8 }}>
                  <button type="button" className="finance-nav-btn" onClick={() => setPlaceModal(p)} style={{ flex: 1, padding: "8px", borderRadius: 8, border: `1px solid ${BORDER}`, background: "#fff", cursor: "pointer" }}>
                    수정
                  </button>
                  <button
                    type="button"
                    className="finance-nav-btn"
                    onClick={() => void deletePlace(p)}
                    style={{ flex: 1, padding: "8px", borderRadius: 8, border: "1px solid #fecaca", color: "#b91c1c", background: "#fff", cursor: "pointer" }}
                  >
                    삭제
                  </button>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div style={{ overflow: "auto" }}>
            <table className="data-table" style={{ width: "100%", borderCollapse: "collapse", fontSize: 14 }}>
              <thead>
                <tr style={{ borderBottom: `1px solid ${BORDER}` }}>
                  {["장소명", "수용인원", "장비", "활성", ""].map((h) => (
                    <th key={h} style={{ textAlign: "left", padding: "10px 12px", fontWeight: 700, color: NAVY }}>
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {places.map((p) => (
                  <tr key={p.id} style={{ borderBottom: `1px solid ${BORDER}` }}>
                    <td style={{ padding: "10px 12px" }}>{p.name}</td>
                    <td style={{ padding: "10px 12px" }}>{p.capacity ?? "—"}</td>
                    <td style={{ padding: "10px 12px" }}>{(p.equipment ?? []).join(", ") || "—"}</td>
                    <td style={{ padding: "10px 12px" }}>
                      <PlannerSwitch checked={p.is_active !== false} onChange={(v) => void togglePlaceActive(p, v)} label="" />
                    </td>
                    <td style={{ padding: "10px 12px", whiteSpace: "nowrap" }}>
                      <button type="button" className="finance-nav-btn" onClick={() => setPlaceModal(p)} style={{ fontSize: 12, marginRight: 8, cursor: "pointer" }}>
                        수정
                      </button>
                      <button type="button" className="finance-nav-btn" onClick={() => void deletePlace(p)} style={{ fontSize: 12, cursor: "pointer", color: "#b91c1c" }}>
                        삭제
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {deptModal && (
        <DepartmentEditModal
          mob={mob}
          allDepartments={departments}
          initial={deptModal === "new" ? null : deptModal}
          onClose={() => setDeptModal(null)}
          onSaved={async () => {
            setDeptModal(null);
            await onRefresh();
          }}
          toast={toast}
        />
      )}
      {placeModal && (
        <PlaceEditModal
          mob={mob}
          allPlaces={places}
          initial={placeModal === "new" ? null : placeModal}
          onClose={() => setPlaceModal(null)}
          onSaved={async () => {
            setPlaceModal(null);
            await onRefresh();
          }}
          toast={toast}
        />
      )}
    </div>
  );
}

function DepartmentEditModal({
  mob,
  allDepartments,
  initial,
  onClose,
  onSaved,
  toast,
}: {
  mob: boolean;
  allDepartments: PlannerDepartment[];
  initial: PlannerDepartment | null;
  onClose: () => void;
  onSaved: () => Promise<void>;
  toast: PlannerToast;
}) {
  const [name, setName] = useState(initial?.name ?? "");
  const [color, setColor] = useState(initial?.color ?? COLOR_PRESETS[0]);
  const [leader, setLeader] = useState(initial?.leader_name ?? "");

  useEffect(() => {
    setName(initial?.name ?? "");
    setColor(initial?.color ?? COLOR_PRESETS[0]);
    setLeader(initial?.leader_name ?? "");
  }, [initial]);

  const nextSortOrder = useMemo(() => {
    const nums = allDepartments.map((d) => d.sort_order ?? 0);
    return (nums.length ? Math.max(...nums) : -1) + 1;
  }, [allDepartments]);

  const save = async () => {
    if (!supabase) return;
    let cid: string;
    try {
      cid = getChurchId();
    } catch {
      toast("로그인이 필요합니다.", "err");
      return;
    }
    if (!name.trim()) {
      toast("부서명을 입력하세요.", "warn");
      return;
    }
    if (initial) {
      const row = {
        name: name.trim(),
        color,
        leader_name: leader.trim() || null,
        sort_order: initial.sort_order ?? 0,
        is_active: initial.is_active !== false,
      };
      const { error } = await supabase.from(TB_DEPARTMENTS).update(row).eq("id", initial.id);
      if (error) {
        window.alert(error.message);
        return;
      }
    } else {
      const row = {
        church_id: cid,
        name: name.trim(),
        color,
        leader_name: leader.trim() || null,
        sort_order: nextSortOrder,
        is_active: true,
      };
      const { error } = await supabase.from(TB_DEPARTMENTS).insert(row);
      if (error) {
        window.alert(error.message);
        return;
      }
    }
    toast("저장되었습니다.");
    await onSaved();
  };

  const del = async () => {
    if (!initial || !supabase) return;
    if (!window.confirm("정말 삭제하시겠습니까?")) return;
    const { error } = await supabase.from(TB_DEPARTMENTS).delete().eq("id", initial.id);
    if (error) {
      window.alert(error.message);
      return;
    }
    toast("삭제되었습니다.");
    await onSaved();
  };

  const lbl: CSSProperties = { fontSize: 13, fontWeight: 600, color: "#475569", marginBottom: 6, display: "block" };
  const inp: CSSProperties = {
    width: "100%",
    height: 42,
    padding: "0 14px",
    borderRadius: 10,
    border: "1.5px solid #e0e3ea",
    fontSize: 14,
    boxSizing: "border-box",
    marginBottom: 16,
  };

  const cardStyle: CSSProperties = mob
    ? {
        background: "#fff",
        borderRadius: "20px 20px 0 0",
        padding: 28,
        width: "100%",
        maxWidth: 500,
        maxHeight: "85vh",
        overflowY: "auto",
        boxShadow: "0 20px 60px rgba(0,0,0,0.15)",
      }
    : {
        background: "#fff",
        borderRadius: 20,
        padding: 28,
        width: "90%",
        maxWidth: 500,
        boxShadow: "0 20px 60px rgba(0,0,0,0.15)",
      };

  return (
    <div
      className="modal-bg"
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(0,0,0,0.4)",
        backdropFilter: "blur(4px)",
        WebkitBackdropFilter: "blur(4px)",
        zIndex: 210,
        display: "flex",
        alignItems: mob ? "flex-end" : "center",
        justifyContent: "center",
        padding: mob ? 0 : 16,
      }}
      onClick={onClose}
    >
      <div style={cardStyle} onClick={(e) => e.stopPropagation()}>
        <h2 style={{ fontSize: 18, fontWeight: 700, color: NAVY, margin: "0 0 20px" }}>{initial ? "부서 수정" : "부서 추가"}</h2>
        <label style={lbl}>부서명 *</label>
        <input value={name} onChange={(e) => setName(e.target.value)} style={inp} />
        <label style={lbl}>색상</label>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 10, marginBottom: 16 }}>
          {COLOR_PRESETS.map((c) => (
            <button
              key={c}
              type="button"
              title={c}
              onClick={() => setColor(c)}
              style={{
                width: 28,
                height: 28,
                borderRadius: "50%",
                background: c,
                border: color === c ? "2px solid #1B2A4A" : "2px solid #e5e7eb",
                cursor: "pointer",
                padding: 0,
                boxSizing: "border-box",
              }}
            />
          ))}
        </div>
        <label style={lbl}>담당자 이름 (선택)</label>
        <input value={leader} onChange={(e) => setLeader(e.target.value)} style={inp} />
        <button
          type="button"
          className="finance-nav-btn"
          onClick={save}
          style={{
            width: "100%",
            height: 46,
            borderRadius: 12,
            background: ACCENT,
            color: "#fff",
            border: "none",
            fontWeight: 700,
            fontSize: 15,
            cursor: "pointer",
            marginBottom: 10,
          }}
        >
          저장
        </button>
        <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
          <button
            type="button"
            className="finance-nav-btn"
            onClick={onClose}
            style={{
              flex: 1,
              minWidth: 120,
              height: 44,
              borderRadius: 12,
              border: "1.5px solid #e0e3ea",
              background: "transparent",
              color: "#64748b",
              cursor: "pointer",
              fontWeight: 600,
            }}
          >
            취소
          </button>
          {initial && (
            <button
              type="button"
              className="finance-nav-btn"
              onClick={del}
              style={{
                flex: 1,
                minWidth: 120,
                height: 44,
                borderRadius: 12,
                border: "1px solid #fecaca",
                color: "#b91c1c",
                background: "#fff",
                cursor: "pointer",
                fontWeight: 600,
              }}
            >
              삭제
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

function PlaceEditModal({
  mob,
  allPlaces,
  initial,
  onClose,
  onSaved,
  toast,
}: {
  mob: boolean;
  allPlaces: PlannerPlace[];
  initial: PlannerPlace | null;
  onClose: () => void;
  onSaved: () => Promise<void>;
  toast: PlannerToast;
}) {
  const [name, setName] = useState(initial?.name ?? "");
  const [cap, setCap] = useState(initial?.capacity != null ? String(initial.capacity) : "");
  const [eq, setEq] = useState<string[]>(initial?.equipment ?? []);

  useEffect(() => {
    setName(initial?.name ?? "");
    setCap(initial?.capacity != null ? String(initial.capacity) : "");
    setEq(initial?.equipment ?? []);
  }, [initial]);

  const nextSortOrder = useMemo(() => {
    const nums = allPlaces.map((p) => p.sort_order ?? 0);
    return (nums.length ? Math.max(...nums) : -1) + 1;
  }, [allPlaces]);

  const toggleEq = (x: string) => {
    setEq((prev) => (prev.includes(x) ? prev.filter((e) => e !== x) : [...prev, x]));
  };

  const save = async () => {
    if (!supabase) return;
    let cid: string;
    try {
      cid = getChurchId();
    } catch {
      toast("로그인이 필요합니다.", "err");
      return;
    }
    if (!name.trim()) {
      toast("장소명을 입력하세요.", "warn");
      return;
    }
    if (initial) {
      const row = {
        name: name.trim(),
        capacity: cap.trim() ? Number(cap) : null,
        equipment: eq.length ? eq : [],
        sort_order: initial.sort_order ?? 0,
        is_active: initial.is_active !== false,
      };
      const { error } = await supabase.from(TB_PLACES).update(row).eq("id", initial.id);
      if (error) {
        window.alert(error.message);
        return;
      }
    } else {
      const row = {
        church_id: cid,
        name: name.trim(),
        capacity: cap.trim() ? Number(cap) : null,
        equipment: eq.length ? eq : [],
        sort_order: nextSortOrder,
        is_active: true,
      };
      const { error } = await supabase.from(TB_PLACES).insert(row);
      if (error) {
        window.alert(error.message);
        return;
      }
    }
    toast("저장되었습니다.");
    await onSaved();
  };

  const del = async () => {
    if (!initial || !supabase) return;
    if (!window.confirm("정말 삭제하시겠습니까?")) return;
    const { error } = await supabase.from(TB_PLACES).delete().eq("id", initial.id);
    if (error) {
      window.alert(error.message);
      return;
    }
    toast("삭제되었습니다.");
    await onSaved();
  };

  const lbl: CSSProperties = { fontSize: 13, fontWeight: 600, color: "#475569", marginBottom: 6, display: "block" };
  const inp: CSSProperties = {
    width: "100%",
    height: 42,
    padding: "0 14px",
    borderRadius: 10,
    border: "1.5px solid #e0e3ea",
    fontSize: 14,
    boxSizing: "border-box",
    marginBottom: 16,
  };

  const cardStyle: CSSProperties = mob
    ? {
        background: "#fff",
        borderRadius: "20px 20px 0 0",
        padding: 28,
        width: "100%",
        maxWidth: 500,
        maxHeight: "85vh",
        overflowY: "auto",
        boxShadow: "0 20px 60px rgba(0,0,0,0.15)",
      }
    : {
        background: "#fff",
        borderRadius: 20,
        padding: 28,
        width: "90%",
        maxWidth: 500,
        boxShadow: "0 20px 60px rgba(0,0,0,0.15)",
      };

  return (
    <div
      className="modal-bg"
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(0,0,0,0.4)",
        backdropFilter: "blur(4px)",
        WebkitBackdropFilter: "blur(4px)",
        zIndex: 210,
        display: "flex",
        alignItems: mob ? "flex-end" : "center",
        justifyContent: "center",
        padding: mob ? 0 : 16,
      }}
      onClick={onClose}
    >
      <div style={cardStyle} onClick={(e) => e.stopPropagation()}>
        <h2 style={{ fontSize: 18, fontWeight: 700, color: NAVY, margin: "0 0 20px" }}>{initial ? "장소 수정" : "장소 추가"}</h2>
        <label style={lbl}>장소명 *</label>
        <input value={name} onChange={(e) => setName(e.target.value)} style={inp} />
        <label style={lbl}>수용 인원</label>
        <input type="number" min={0} value={cap} onChange={(e) => setCap(e.target.value)} style={inp} />
        <label style={lbl}>장비</label>
        <div style={{ marginBottom: 16 }}>
          {EQUIPMENT_OPTS.map((x) => (
            <label key={x} style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8, fontSize: 14, color: "#475569" }}>
              <input type="checkbox" checked={eq.includes(x)} onChange={() => toggleEq(x)} />
              {x}
            </label>
          ))}
        </div>
        <button
          type="button"
          className="finance-nav-btn"
          onClick={save}
          style={{
            width: "100%",
            height: 46,
            borderRadius: 12,
            background: ACCENT,
            color: "#fff",
            border: "none",
            fontWeight: 700,
            fontSize: 15,
            cursor: "pointer",
            marginBottom: 10,
          }}
        >
          저장
        </button>
        <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
          <button
            type="button"
            className="finance-nav-btn"
            onClick={onClose}
            style={{
              flex: 1,
              minWidth: 120,
              height: 44,
              borderRadius: 12,
              border: "1.5px solid #e0e3ea",
              background: "transparent",
              color: "#64748b",
              cursor: "pointer",
              fontWeight: 600,
            }}
          >
            취소
          </button>
          {initial && (
            <button
              type="button"
              className="finance-nav-btn"
              onClick={del}
              style={{
                flex: 1,
                minWidth: 120,
                height: 44,
                borderRadius: 12,
                border: "1px solid #fecaca",
                color: "#b91c1c",
                background: "#fff",
                cursor: "pointer",
                fontWeight: 600,
              }}
            >
              삭제
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
