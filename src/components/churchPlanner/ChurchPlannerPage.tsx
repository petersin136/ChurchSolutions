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

const ACCENT = "#4A90D9";
const BORDER = "#e5e7eb";
const NAVY = "#1F2937";

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

    if (candidate.is_all_day || ev.is_all_day) {
      const dept = departments.find((d) => d.id === ev.department_id);
      return {
        message: `⚠️ ${placeName}에서 같은 기간에 "${ev.title}" (${dept?.name ?? "부서"})이(가) 이미 있습니다. 그래도 저장하시겠습니까?`,
        otherTitle: ev.title,
      };
    }

    const cs = timeToMinutes(candidate.start_time);
    const ce = timeToMinutes(candidate.end_time) ?? cs;
    const es = timeToMinutes(ev.start_time);
    const ee = timeToMinutes(ev.end_time) ?? es;
    if (cs == null || ce == null || es == null || ee == null) {
      const dept = departments.find((d) => d.id === ev.department_id);
      return {
        message: `⚠️ ${placeName}에서 "${ev.title}" (${dept?.name ?? "부서"})과(와) 시간이 겹칠 수 있습니다. 그래도 저장하시겠습니까?`,
        otherTitle: ev.title,
      };
    }
    if (rangesOverlap(cs, ce, es, ee)) {
      const dept = departments.find((d) => d.id === ev.department_id);
      const timeLabel = `${(ev.start_time || "").slice(0, 5)}`;
      return {
        message: `⚠️ ${placeName}에서 ${timeLabel}에 "${ev.title}" (${dept?.name ?? "부서"})이(가) 이미 있습니다. 그래도 저장하시겠습니까?`,
        otherTitle: ev.title,
      };
    }
  }
  return null;
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

  const [selectedDay, setSelectedDay] = useState<{ y: number; m: number; d: number } | null>(null);
  const [panelOpen, setPanelOpen] = useState(false);

  const [modalOpen, setModalOpen] = useState(false);
  const [editingEvent, setEditingEvent] = useState<PlannerEventRow | null>(null);
  const [conflict, setConflict] = useState<string | null>(null);

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
    const [dRes, pRes, eRes] = await Promise.all([
      supabase.from("planner_departments").select("*").eq("church_id", cid).order("sort_order"),
      supabase.from("planner_places").select("*").eq("church_id", cid).order("sort_order"),
      supabase.from("planner_events").select("*").eq("church_id", cid).order("start_date"),
    ]);
    if (dRes.error) console.error(dRes.error);
    if (pRes.error) console.error(pRes.error);
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
      const c = findConflicts(
        events,
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
        .from("planner_events")
        .update({ ...payload, updated_at: new Date().toISOString() })
        .eq("id", editingEvent.id);
      if (error) {
        toast("저장 실패: " + error.message, "err");
        return;
      }
      toast("일정이 수정되었습니다.");
    } else {
      const { error } = await supabase.from("planner_events").insert(payload);
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
    const { error } = await supabase.from("planner_events").delete().eq("id", id);
    if (error) {
      toast("삭제 실패: " + error.message, "err");
      return;
    }
    toast("삭제되었습니다.");
    setModalOpen(false);
    setPanelOpen(false);
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

  const dayEvents = useMemo(() => {
    if (!selectedDay) return [];
    const { y, m, d } = selectedDay;
    return events.filter((e) => eventCoversDate(e, y, m, d));
  }, [selectedDay, events]);

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
          events={events}
          calByDate={calByDate}
          isToday={isToday}
          selectedDay={selectedDay}
          setSelectedDay={setSelectedDay}
          panelOpen={panelOpen}
          setPanelOpen={setPanelOpen}
          dayEvents={dayEvents}
          openModalForDay={openModalForDay}
          deleteEvent={deleteEvent}
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

      {sidebarTab === "calendar" && churchId && !loading && (
        <button
          type="button"
          onClick={() => openModalForDay(cursor.y, cursor.m, today.getDate())}
          style={{
            position: "fixed",
            right: mob ? 16 : 32,
            bottom: mob ? 88 : 32,
            width: 52,
            height: 52,
            borderRadius: "50%",
            background: ACCENT,
            color: "#fff",
            border: "none",
            boxShadow: "0 4px 14px rgba(74,144,217,0.45)",
            cursor: "pointer",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 50,
          }}
          aria-label="일정 추가"
        >
          <Plus size={26} strokeWidth={2.5} />
        </button>
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
  events,
  calByDate,
  isToday,
  selectedDay,
  setSelectedDay,
  panelOpen,
  setPanelOpen,
  dayEvents,
  openModalForDay,
  deleteEvent,
  weekDays,
}: {
  mob: boolean;
  viewMode: "month" | "week" | "year";
  setViewMode: (v: "month" | "week" | "year") => void;
  cursor: { y: number; m: number };
  setCursor: React.Dispatch<React.SetStateAction<{ y: number; m: number }>>;
  grid: (number | null)[];
  departments: PlannerDepartment[];
  events: PlannerEventRow[];
  calByDate: Map<string, ChurchCalendarRow[]>;
  isToday: (d: number | null) => boolean;
  selectedDay: { y: number; m: number; d: number } | null;
  setSelectedDay: React.Dispatch<React.SetStateAction<{ y: number; m: number; d: number } | null>>;
  panelOpen: boolean;
  setPanelOpen: React.Dispatch<React.SetStateAction<boolean>>;
  dayEvents: PlannerEventRow[];
  openModalForDay: (y: number, m: number, d: number, ev?: PlannerEventRow) => void;
  deleteEvent: (id: string) => void;
  weekDays: Date[];
}) {
  const headerRow: ReactNode = (
    <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", justifyContent: "space-between", gap: 12, marginBottom: 16 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
        <button
          type="button"
          className="finance-nav-btn"
          onClick={() => setCursor((c) => ({ y: c.m === 1 ? c.y - 1 : c.y, m: c.m === 1 ? 12 : c.m - 1 }))}
          style={pillNavBtn}
        >
          <ChevronLeft size={18} />
        </button>
        <span style={{ fontSize: mob ? 16 : 18, fontWeight: 700, color: NAVY, minWidth: 140, textAlign: "center" }}>
          {cursor.y}년 {cursor.m}월
        </span>
        <button
          type="button"
          className="finance-nav-btn"
          onClick={() => setCursor((c) => ({ y: c.m === 12 ? c.y + 1 : c.y, m: c.m === 12 ? 1 : c.m + 1 }))}
          style={pillNavBtn}
        >
          <ChevronRight size={18} />
        </button>
      </div>
      <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
        {(["month", "week", "year"] as const).map((v) => (
          <button
            key={v}
            type="button"
            className="finance-nav-btn"
            onClick={() => setViewMode(v)}
            style={{
              ...viewToggleBtn,
              background: viewMode === v ? ACCENT : "#f3f4f6",
              color: viewMode === v ? "#fff" : "#374151",
            }}
          >
            {v === "month" ? "월간" : v === "week" ? "주간" : "연간"}
          </button>
        ))}
        <button
          type="button"
          className="finance-nav-btn"
          onClick={() => openModalForDay(cursor.y, cursor.m, new Date().getDate())}
          style={{ ...viewToggleBtn, background: NAVY, color: "#fff" }}
        >
          + 일정 추가
        </button>
      </div>
    </div>
  );

  return (
    <div style={{ display: "flex", gap: 16, alignItems: "flex-start", position: "relative" }}>
      <div style={{ flex: 1, minWidth: 0 }}>
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
              setSelectedDay({ y: cursor.y, m: cursor.m, d });
              setPanelOpen(true);
            }}
          />
        )}
        {viewMode === "week" && (
          <WeekStripView weekDays={weekDays} departments={departments} events={events} onPickDay={(d) => openModalForDay(d.getFullYear(), d.getMonth() + 1, d.getDate())} />
        )}
        {viewMode === "year" && <YearPlaceholder year={cursor.y} />}
      </div>
      {panelOpen && selectedDay && (
        <DaySidePanel
          mob={mob}
          selectedDay={selectedDay}
          dayEvents={dayEvents}
          departments={departments}
          onClose={() => setPanelOpen(false)}
          onAdd={() => openModalForDay(selectedDay.y, selectedDay.m, selectedDay.d)}
          onEdit={(ev) => openModalForDay(selectedDay.y, selectedDay.m, selectedDay.d, ev)}
          onDelete={deleteEvent}
        />
      )}
      {mob && panelOpen && selectedDay && (
        <div
          role="presentation"
          onClick={() => setPanelOpen(false)}
          style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.35)", zIndex: 60 }}
        />
      )}
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

const viewToggleBtn: CSSProperties = {
  padding: "8px 14px",
  borderRadius: 8,
  border: "none",
  fontWeight: 600,
  fontSize: 13,
  cursor: "pointer",
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
}: {
  mob: boolean;
  cursor: { y: number; m: number };
  grid: (number | null)[];
  departments: PlannerDepartment[];
  events: PlannerEventRow[];
  calByDate: Map<string, ChurchCalendarRow[]>;
  isToday: (d: number | null) => boolean;
  onCellClick: (d: number | null) => void;
}) {
  const dow = ["일", "월", "화", "수", "목", "금", "토"];
  return (
    <div style={{ background: "#fff", borderRadius: 12, border: `1px solid ${BORDER}`, overflow: "hidden" }}>
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(7, 1fr)",
          background: "#f9fafb",
          borderBottom: `1px solid ${BORDER}`,
        }}
      >
        {dow.map((label, i) => (
          <div
            key={label}
            style={{
              padding: mob ? "6px 4px" : "10px 8px",
              textAlign: "center",
              fontSize: mob ? 11 : 12,
              fontWeight: 700,
              color: i === 0 ? "#dc2626" : i === 6 ? "#2563eb" : "#6b7280",
            }}
          >
            {label}
          </div>
        ))}
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)" }}>
        {grid.map((d, idx) => {
          const col = idx % 7;
          const dateKey = d != null ? `${cursor.y}-${pad2(cursor.m)}-${pad2(d)}` : "";
          const markers = d != null ? calByDate.get(dateKey) : undefined;
          const cellEvents = d != null ? events.filter((e) => eventCoversDate(e, cursor.y, cursor.m, d)) : [];
          const sunday = col === 0;
          const saturday = col === 6;
          return (
            <button
              key={idx}
              type="button"
              onClick={() => onCellClick(d)}
              style={{
                minHeight: mob ? 72 : 100,
                borderRight: col < 6 ? `1px solid ${BORDER}` : undefined,
                borderBottom: `1px solid ${BORDER}`,
                padding: mob ? 4 : 6,
                textAlign: "left",
                verticalAlign: "top",
                background: "#fff",
                cursor: d == null ? "default" : "pointer",
                overflow: "hidden",
              }}
            >
              {d != null && (
                <>
                  <div style={{ display: "flex", alignItems: "center", gap: 4, marginBottom: 4 }}>
                    <span
                      style={{
                        display: "inline-flex",
                        alignItems: "center",
                        justifyContent: "center",
                        minWidth: mob ? 22 : 26,
                        height: mob ? 22 : 26,
                        borderRadius: "50%",
                        fontSize: mob ? 11 : 13,
                        fontWeight: 600,
                        color: sunday ? "#dc2626" : saturday ? "#2563eb" : NAVY,
                        background: isToday(d) ? "rgba(74,144,217,0.2)" : "transparent",
                      }}
                    >
                      {d}
                    </span>
                    {markers && markers.length > 0 && (
                      <span style={{ width: 6, height: 6, borderRadius: "50%", background: markers[0].color || "#EF4444", flexShrink: 0 }} title={markers.map((m) => m.name).join(", ")} />
                    )}
                  </div>
                  <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
                    {cellEvents.slice(0, mob ? 2 : 4).map((ev) => {
                      const dept = departments.find((x) => x.id === ev.department_id);
                      const bg = dept?.color ?? ACCENT;
                      return (
                        <div
                          key={ev.id}
                          title={ev.title}
                          style={{
                            borderRadius: 6,
                            fontSize: mob ? 0 : 12,
                            padding: mob ? "3px 4px" : "2px 8px",
                            background: `${bg}22`,
                            color: bg,
                            fontWeight: 600,
                            overflow: "hidden",
                            textOverflow: "ellipsis",
                            whiteSpace: "nowrap",
                            border: `1px solid ${bg}44`,
                            minHeight: mob ? 8 : undefined,
                          }}
                        >
                          {mob ? <span style={{ display: "block", width: 8, height: 8, borderRadius: 4, background: bg, margin: "0 auto" }} /> : ev.title}
                        </div>
                      );
                    })}
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

function DaySidePanel({
  mob,
  selectedDay,
  dayEvents,
  departments,
  onClose,
  onAdd,
  onEdit,
  onDelete,
}: {
  mob: boolean;
  selectedDay: { y: number; m: number; d: number };
  dayEvents: PlannerEventRow[];
  departments: PlannerDepartment[];
  onClose: () => void;
  onAdd: () => void;
  onEdit: (ev: PlannerEventRow) => void;
  onDelete: (id: string) => void;
}) {
  const label = `${selectedDay.y}년 ${selectedDay.m}월 ${selectedDay.d}일`;
  return (
    <aside
      style={{
        width: mob ? "min(100%, 320px)" : 300,
        flexShrink: 0,
        background: "#fff",
        border: `1px solid ${BORDER}`,
        borderRadius: 12,
        padding: 16,
        maxHeight: mob ? "70vh" : "calc(100vh - 200px)",
        overflowY: "auto",
        position: mob ? "fixed" : "sticky",
        top: mob ? "15%" : 0,
        right: mob ? 12 : undefined,
        zIndex: mob ? 70 : 1,
        boxShadow: mob ? "0 8px 32px rgba(0,0,0,0.12)" : undefined,
      }}
    >
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
        <span style={{ fontWeight: 700, color: NAVY }}>{label}</span>
        <button type="button" className="finance-nav-btn" onClick={onClose} style={{ border: "none", background: "none", cursor: "pointer", padding: 4 }}>
          <X size={20} />
        </button>
      </div>
      <button
        type="button"
        className="finance-nav-btn"
        onClick={onAdd}
        style={{ width: "100%", padding: "10px", borderRadius: 8, background: ACCENT, color: "#fff", border: "none", fontWeight: 600, marginBottom: 12, cursor: "pointer" }}
      >
        + 일정 추가
      </button>
      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        {dayEvents.length === 0 && <div style={{ fontSize: 13, color: "#9ca3af" }}>등록된 일정이 없습니다.</div>}
        {dayEvents.map((ev) => {
          const dept = departments.find((d) => d.id === ev.department_id);
          return (
            <div key={ev.id} style={{ padding: 10, borderRadius: 8, border: `1px solid ${BORDER}`, background: "#fafafa" }}>
              <div style={{ fontWeight: 600, fontSize: 14, color: NAVY }}>{ev.title}</div>
              <div style={{ fontSize: 12, color: "#6b7280", marginTop: 4 }}>{dept?.name ?? "부서 미지정"} · {EVENT_TYPE_OPTIONS.find((t) => t.value === ev.event_type)?.label ?? ev.event_type}</div>
              <div style={{ display: "flex", gap: 8, marginTop: 8 }}>
                <button type="button" className="finance-nav-btn" onClick={() => onEdit(ev)} style={{ fontSize: 12, padding: "4px 10px", borderRadius: 6, border: `1px solid ${BORDER}`, cursor: "pointer", background: "#fff" }}>
                  수정
                </button>
                <button type="button" className="finance-nav-btn" onClick={() => onDelete(ev.id)} style={{ fontSize: 12, padding: "4px 10px", borderRadius: 6, border: "1px solid #fecaca", color: "#b91c1c", cursor: "pointer", background: "#fff" }}>
                  삭제
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </aside>
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
    padding: "10px 12px",
    borderRadius: 8,
    border: `1px solid ${BORDER}`,
    fontSize: 14,
    boxSizing: "border-box",
  };
  const labelStyle: CSSProperties = { fontSize: 12, fontWeight: 600, color: NAVY, marginBottom: 6, display: "block" };

  return (
    <div className="modal-bg" style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.45)", zIndex: 200, display: "flex", alignItems: "center", justifyContent: "center", padding: mob ? 12 : 24 }}>
      <div className="modal" style={{ background: "#fff", borderRadius: 16, width: "100%", maxWidth: 520, maxHeight: "90vh", overflow: "hidden", display: "flex", flexDirection: "column" }}>
        <div style={{ padding: "16px 20px", borderBottom: `1px solid ${BORDER}`, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <span style={{ fontWeight: 700, fontSize: 17, color: NAVY }}>{editingEvent ? "일정 수정" : "일정 추가"}</span>
          <button type="button" className="finance-nav-btn" onClick={onClose} style={{ border: "none", background: "none", cursor: "pointer" }}>
            <X size={22} />
          </button>
        </div>
        <div className="modal-body" style={{ padding: "16px 20px", overflowY: "auto", flex: 1 }}>
          {conflict && (
            <div style={{ padding: 12, background: "#fff7ed", border: "1px solid #fdba74", borderRadius: 8, marginBottom: 16, fontSize: 13, color: "#9a3412" }}>
              {conflict}
              <div style={{ display: "flex", gap: 8, marginTop: 12 }}>
                <button type="button" className="finance-nav-btn" onClick={() => onSave(true)} style={{ padding: "8px 12px", borderRadius: 8, background: "#ea580c", color: "#fff", border: "none", fontWeight: 600, cursor: "pointer" }}>
                  그래도 저장
                </button>
                <button type="button" className="finance-nav-btn" onClick={() => setConflict(null)} style={{ padding: "8px 12px", borderRadius: 8, border: `1px solid ${BORDER}`, background: "#fff", cursor: "pointer" }}>
                  일정 조정
                </button>
              </div>
            </div>
          )}
          <label style={labelStyle}>제목 *</label>
          <input value={formTitle} onChange={(e) => setFormTitle(e.target.value)} style={{ ...inputStyle, marginBottom: 14 }} />

          <label style={labelStyle}>부서</label>
          <select value={formDeptId} onChange={(e) => setFormDeptId(e.target.value)} className="select-modern" style={{ ...inputStyle, marginBottom: 14 }}>
            <option value="">선택</option>
            {departments.filter((d) => d.is_active !== false).map((d) => (
              <option key={d.id} value={d.id}>
                {d.name}
              </option>
            ))}
          </select>

          <label style={labelStyle}>일정 유형</label>
          <select value={formType} onChange={(e) => setFormType(e.target.value)} className="select-modern" style={{ ...inputStyle, marginBottom: 14 }}>
            {EVENT_TYPE_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>

          <label style={labelStyle}>시작일</label>
          <input type="date" value={formStart} onChange={(e) => setFormStart(e.target.value)} style={{ ...inputStyle, marginBottom: 14 }} />
          <label style={labelStyle}>종료일 (선택)</label>
          <input type="date" value={formEnd} onChange={(e) => setFormEnd(e.target.value)} style={{ ...inputStyle, marginBottom: 14 }} />

          <label style={{ ...labelStyle, display: "flex", alignItems: "center", gap: 8 }}>
            <input type="checkbox" checked={formAllDay} onChange={(e) => setFormAllDay(e.target.checked)} />
            종일
          </label>
          {!formAllDay && (
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 14 }}>
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

          <label style={labelStyle}>장소</label>
          <select value={formPlaceId} onChange={(e) => setFormPlaceId(e.target.value)} className="select-modern" style={{ ...inputStyle, marginBottom: 14 }}>
            <option value="">선택</option>
            {places.filter((p) => p.is_active !== false).map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>

          <label style={labelStyle}>반복</label>
          <select value={formRecurrence} onChange={(e) => setFormRecurrence(e.target.value)} className="select-modern" style={{ ...inputStyle, marginBottom: 14 }}>
            {RECURRENCE_OPTIONS.map((o) => (
              <option key={o.value || "none"} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>

          <label style={labelStyle}>예상 인원</label>
          <input type="number" min={0} value={formPeople} onChange={(e) => setFormPeople(e.target.value)} style={{ ...inputStyle, marginBottom: 14 }} />

          <label style={labelStyle}>메모</label>
          <textarea value={formDesc} onChange={(e) => setFormDesc(e.target.value)} rows={3} style={{ ...inputStyle, marginBottom: 14, resize: "vertical" }} />

          <label style={{ ...labelStyle, display: "flex", alignItems: "center", gap: 8 }}>
            <input type="checkbox" checked={formPublic} onChange={(e) => setFormPublic(e.target.checked)} />
            공개
          </label>
        </div>
        <div className="modal-foot" style={{ padding: "12px 20px", borderTop: `1px solid ${BORDER}`, display: "flex", gap: 10, justifyContent: "flex-end", flexWrap: "wrap" }}>
          {onDelete && (
            <button type="button" className="finance-nav-btn" onClick={onDelete} style={{ marginRight: "auto", padding: "10px 16px", borderRadius: 8, border: "1px solid #fecaca", color: "#b91c1c", background: "#fff", cursor: "pointer" }}>
              삭제
            </button>
          )}
          <button type="button" className="finance-nav-btn" onClick={onClose} style={{ padding: "10px 16px", borderRadius: 8, border: `1px solid ${BORDER}`, background: "#fff", cursor: "pointer" }}>
            취소
          </button>
          <button type="button" className="finance-nav-btn" onClick={() => onSave()} style={{ padding: "10px 20px", borderRadius: 8, background: ACCENT, color: "#fff", border: "none", fontWeight: 600, cursor: "pointer" }}>
            저장
          </button>
        </div>
      </div>
    </div>
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

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 28 }}>
      <section>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
          <h3 style={{ fontSize: mob ? 15 : 17, fontWeight: 700, color: NAVY }}>부서 관리</h3>
          <button type="button" className="finance-nav-btn" onClick={() => setDeptModal("new")} style={{ padding: "8px 14px", borderRadius: 8, background: ACCENT, color: "#fff", border: "none", fontWeight: 600, cursor: "pointer" }}>
            부서 추가
          </button>
        </div>
        <div style={{ background: "#fff", border: `1px solid ${BORDER}`, borderRadius: 12, overflow: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: mob ? 12 : 14 }}>
            <thead>
              <tr style={{ background: "#f9fafb", borderBottom: `1px solid ${BORDER}` }}>
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
                    <span style={{ width: 18, height: 18, borderRadius: "50%", background: d.color, display: "inline-block", verticalAlign: "middle" }} />
                  </td>
                  <td style={{ padding: "10px 12px" }}>{d.name}</td>
                  <td style={{ padding: "10px 12px" }}>{d.leader_name ?? "—"}</td>
                  <td style={{ padding: "10px 12px" }}>{d.sort_order ?? 0}</td>
                  <td style={{ padding: "10px 12px" }}>{d.is_active === false ? "아니오" : "예"}</td>
                  <td style={{ padding: "10px 12px" }}>
                    <button type="button" className="finance-nav-btn" onClick={() => setDeptModal(d)} style={{ fontSize: 12, marginRight: 8, cursor: "pointer" }}>
                      수정
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
          <h3 style={{ fontSize: mob ? 15 : 17, fontWeight: 700, color: NAVY }}>장소 관리</h3>
          <button type="button" className="finance-nav-btn" onClick={() => setPlaceModal("new")} style={{ padding: "8px 14px", borderRadius: 8, background: ACCENT, color: "#fff", border: "none", fontWeight: 600, cursor: "pointer" }}>
            장소 추가
          </button>
        </div>
        <div style={{ background: "#fff", border: `1px solid ${BORDER}`, borderRadius: 12, overflow: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: mob ? 12 : 14 }}>
            <thead>
              <tr style={{ background: "#f9fafb", borderBottom: `1px solid ${BORDER}` }}>
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
                  <td style={{ padding: "10px 12px" }}>{p.is_active === false ? "아니오" : "예"}</td>
                  <td style={{ padding: "10px 12px" }}>
                    <button type="button" className="finance-nav-btn" onClick={() => setPlaceModal(p)} style={{ fontSize: 12, cursor: "pointer" }}>
                      수정
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {deptModal && (
        <DepartmentEditModal
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
  initial,
  onClose,
  onSaved,
  toast,
}: {
  initial: PlannerDepartment | null;
  onClose: () => void;
  onSaved: () => Promise<void>;
  toast: PlannerToast;
}) {
  const [name, setName] = useState(initial?.name ?? "");
  const [color, setColor] = useState(initial?.color ?? "#4A90D9");
  const [leader, setLeader] = useState(initial?.leader_name ?? "");
  const [sort, setSort] = useState(String(initial?.sort_order ?? 0));
  const [active, setActive] = useState(initial?.is_active !== false);

  useEffect(() => {
    setName(initial?.name ?? "");
    setColor(initial?.color ?? "#4A90D9");
    setLeader(initial?.leader_name ?? "");
    setSort(String(initial?.sort_order ?? 0));
    setActive(initial?.is_active !== false);
  }, [initial]);

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
    const row = {
      church_id: cid,
      name: name.trim(),
      color,
      leader_name: leader.trim() || null,
      sort_order: Number(sort) || 0,
      is_active: active,
    };
    if (initial) {
      const { error } = await supabase.from("planner_departments").update(row).eq("id", initial.id);
      if (error) {
        toast("저장 실패: " + error.message, "err");
        return;
      }
    } else {
      const { error } = await supabase.from("planner_departments").insert(row);
      if (error) {
        toast("저장 실패: " + error.message, "err");
        return;
      }
    }
    toast("저장되었습니다.");
    await onSaved();
  };

  const del = async () => {
    if (!initial || !supabase) return;
    if (!confirm("이 부서를 삭제할까요? 연결된 일정이 있으면 오류가 날 수 있습니다.")) return;
    const { error } = await supabase.from("planner_departments").delete().eq("id", initial.id);
    if (error) {
      toast("삭제 실패: " + error.message, "err");
      return;
    }
    toast("삭제되었습니다.");
    await onSaved();
  };

  return (
    <div className="modal-bg" style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.45)", zIndex: 210, display: "flex", alignItems: "center", justifyContent: "center", padding: 16 }}>
      <div style={{ background: "#fff", borderRadius: 12, padding: 20, width: "100%", maxWidth: 400 }}>
        <h4 style={{ marginBottom: 16, fontWeight: 700 }}>{initial ? "부서 수정" : "부서 추가"}</h4>
        <label style={{ display: "block", fontSize: 12, fontWeight: 600, marginBottom: 4 }}>부서명</label>
        <input value={name} onChange={(e) => setName(e.target.value)} style={{ width: "100%", padding: 10, borderRadius: 8, border: `1px solid ${BORDER}`, marginBottom: 12, boxSizing: "border-box" }} />
        <label style={{ display: "block", fontSize: 12, fontWeight: 600, marginBottom: 4 }}>색상</label>
        <input type="color" value={color} onChange={(e) => setColor(e.target.value)} style={{ width: "100%", height: 40, border: "none", marginBottom: 12 }} />
        <label style={{ display: "block", fontSize: 12, fontWeight: 600, marginBottom: 4 }}>담당자</label>
        <input value={leader} onChange={(e) => setLeader(e.target.value)} style={{ width: "100%", padding: 10, borderRadius: 8, border: `1px solid ${BORDER}`, marginBottom: 12, boxSizing: "border-box" }} />
        <label style={{ display: "block", fontSize: 12, fontWeight: 600, marginBottom: 4 }}>정렬 순서</label>
        <input type="number" value={sort} onChange={(e) => setSort(e.target.value)} style={{ width: "100%", padding: 10, borderRadius: 8, border: `1px solid ${BORDER}`, marginBottom: 12, boxSizing: "border-box" }} />
        <label style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 16 }}>
          <input type="checkbox" checked={active} onChange={(e) => setActive(e.target.checked)} />
          활성
        </label>
        <div style={{ display: "flex", gap: 8, justifyContent: "flex-end", flexWrap: "wrap" }}>
          {initial && (
            <button type="button" className="finance-nav-btn" onClick={del} style={{ padding: "8px 12px", borderRadius: 8, border: "1px solid #fecaca", color: "#b91c1c", marginRight: "auto" }}>
              삭제
            </button>
          )}
          <button type="button" className="finance-nav-btn" onClick={onClose} style={{ padding: "8px 12px", borderRadius: 8, border: `1px solid ${BORDER}` }}>
            취소
          </button>
          <button type="button" className="finance-nav-btn" onClick={save} style={{ padding: "8px 16px", borderRadius: 8, background: ACCENT, color: "#fff", border: "none", fontWeight: 600 }}>
            저장
          </button>
        </div>
      </div>
    </div>
  );
}

function PlaceEditModal({
  initial,
  onClose,
  onSaved,
  toast,
}: {
  initial: PlannerPlace | null;
  onClose: () => void;
  onSaved: () => Promise<void>;
  toast: PlannerToast;
}) {
  const [name, setName] = useState(initial?.name ?? "");
  const [cap, setCap] = useState(initial?.capacity != null ? String(initial.capacity) : "");
  const [eq, setEq] = useState<string[]>(initial?.equipment ?? []);
  const [active, setActive] = useState(initial?.is_active !== false);

  useEffect(() => {
    setName(initial?.name ?? "");
    setCap(initial?.capacity != null ? String(initial.capacity) : "");
    setEq(initial?.equipment ?? []);
    setActive(initial?.is_active !== false);
  }, [initial]);

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
    const row = {
      church_id: cid,
      name: name.trim(),
      capacity: cap.trim() ? Number(cap) : null,
      equipment: eq.length ? eq : [],
      sort_order: initial?.sort_order ?? 0,
      is_active: active,
    };
    if (initial) {
      const { error } = await supabase.from("planner_places").update(row).eq("id", initial.id);
      if (error) {
        toast("저장 실패: " + error.message, "err");
        return;
      }
    } else {
      const { error } = await supabase.from("planner_places").insert(row);
      if (error) {
        toast("저장 실패: " + error.message, "err");
        return;
      }
    }
    toast("저장되었습니다.");
    await onSaved();
  };

  const del = async () => {
    if (!initial || !supabase) return;
    if (!confirm("이 장소를 삭제할까요?")) return;
    const { error } = await supabase.from("planner_places").delete().eq("id", initial.id);
    if (error) {
      toast("삭제 실패: " + error.message, "err");
      return;
    }
    toast("삭제되었습니다.");
    await onSaved();
  };

  return (
    <div className="modal-bg" style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.45)", zIndex: 210, display: "flex", alignItems: "center", justifyContent: "center", padding: 16 }}>
      <div style={{ background: "#fff", borderRadius: 12, padding: 20, width: "100%", maxWidth: 400 }}>
        <h4 style={{ marginBottom: 16, fontWeight: 700 }}>{initial ? "장소 수정" : "장소 추가"}</h4>
        <label style={{ display: "block", fontSize: 12, fontWeight: 600, marginBottom: 4 }}>장소명</label>
        <input value={name} onChange={(e) => setName(e.target.value)} style={{ width: "100%", padding: 10, borderRadius: 8, border: `1px solid ${BORDER}`, marginBottom: 12, boxSizing: "border-box" }} />
        <label style={{ display: "block", fontSize: 12, fontWeight: 600, marginBottom: 4 }}>수용 인원</label>
        <input type="number" min={0} value={cap} onChange={(e) => setCap(e.target.value)} style={{ width: "100%", padding: 10, borderRadius: 8, border: `1px solid ${BORDER}`, marginBottom: 12, boxSizing: "border-box" }} />
        <div style={{ marginBottom: 12 }}>
          <span style={{ fontSize: 12, fontWeight: 600, display: "block", marginBottom: 8 }}>장비</span>
          {EQUIPMENT_OPTS.map((x) => (
            <label key={x} style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6, fontSize: 13 }}>
              <input type="checkbox" checked={eq.includes(x)} onChange={() => toggleEq(x)} />
              {x}
            </label>
          ))}
        </div>
        <label style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 16 }}>
          <input type="checkbox" checked={active} onChange={(e) => setActive(e.target.checked)} />
          활성
        </label>
        <div style={{ display: "flex", gap: 8, justifyContent: "flex-end", flexWrap: "wrap" }}>
          {initial && (
            <button type="button" className="finance-nav-btn" onClick={del} style={{ padding: "8px 12px", borderRadius: 8, border: "1px solid #fecaca", color: "#b91c1c", marginRight: "auto" }}>
              삭제
            </button>
          )}
          <button type="button" className="finance-nav-btn" onClick={onClose} style={{ padding: "8px 12px", borderRadius: 8, border: `1px solid ${BORDER}` }}>
            취소
          </button>
          <button type="button" className="finance-nav-btn" onClick={save} style={{ padding: "8px 16px", borderRadius: 8, background: ACCENT, color: "#fff", border: "none", fontWeight: 600 }}>
            저장
          </button>
        </div>
      </div>
    </div>
  );
}
