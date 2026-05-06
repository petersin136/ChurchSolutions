"use client";

import { useState, useEffect, useMemo, useCallback, type CSSProperties } from "react";
import {
  CalendarDays,
  Building2,
  ChevronLeft,
  ChevronRight,
  Pencil,
  Trash2,
} from "lucide-react";
import { UnifiedPageLayout } from "@/components/layout/UnifiedPageLayout";
import { PcModalShell } from "@/components/common/PcModalShell";
import { supabase } from "@/lib/supabase";
import { getChurchId } from "@/lib/tenant";
import { useAuth } from "@/contexts/AuthContext";
import {
  ACCENT,
  NAVY,
  COLOR_PRESETS,
  DEFAULT_DEPARTMENT_ROWS,
  DEFAULT_PLACE_ROWS,
  TB_CHURCH_CALENDAR,
  TB_DEPARTMENTS,
  TB_EVENTS,
  TB_PLACES,
} from "./plannerDb";

export type PlannerToast = (msg: string, type?: "ok" | "err" | "warn") => void;

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
  place_name?: string | null;
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

const EVENT_TYPES: { value: string; label: string }[] = [
  { value: "worship", label: "예배" },
  { value: "event", label: "행사" },
  { value: "meeting", label: "회의" },
  { value: "retreat", label: "수련회" },
  { value: "service", label: "봉사" },
  { value: "other", label: "기타" },
];

const RECURRENCE: { value: string; label: string }[] = [
  { value: "", label: "안함" },
  { value: "weekly", label: "매주" },
  { value: "monthly", label: "매월" },
  { value: "yearly", label: "매년" },
];

const EQUIPMENT_OPTS = ["빔프로젝터", "음향", "영상", "모니터"] as const;

/** Typography & accent (다른 탭과 동일 규칙) */
const C = {
  primary: "var(--color-primary)",
  text: "var(--color-text)",
  textSub: "var(--color-text-muted)",
  textFaint: "var(--color-text-faint)",
  border: "var(--color-border)",
} as const;

function pad2(n: number) {
  return String(n).padStart(2, "0");
}

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

const eventCoversDate = (ev: PlannerEventRow, dateStr: string) => {
  if (!ev || !ev.start_date || !dateStr) return false;
  const start = ev.start_date.substring(0, 10);
  const end = ev.end_date ? ev.end_date.substring(0, 10) : start;
  return dateStr >= start && dateStr <= end;
};

/** ISO date key for church_calendar map */
function dateKey(y: number, m: number, d: number) {
  return `${y}-${pad2(m)}-${pad2(d)}`;
}

type MonthCell = { y: number; m: number; d: number; inMonth: boolean };

function buildMonthGridCells(viewYear: number, viewMonth: number): MonthCell[] {
  const first = new Date(viewYear, viewMonth - 1, 1);
  const startDow = first.getDay();
  const dim = new Date(viewYear, viewMonth, 0).getDate();
  const cells: MonthCell[] = [];
  const prevLast = new Date(viewYear, viewMonth - 1, 0);
  const prevDim = prevLast.getDate();
  const py = viewMonth === 1 ? viewYear - 1 : viewYear;
  const pm = viewMonth === 1 ? 12 : viewMonth - 1;
  for (let i = 0; i < startDow; i++) {
    const d = prevDim - startDow + i + 1;
    cells.push({ y: py, m: pm, d, inMonth: false });
  }
  for (let d = 1; d <= dim; d++) {
    cells.push({ y: viewYear, m: viewMonth, d, inMonth: true });
  }
  const ny = viewMonth === 12 ? viewYear + 1 : viewYear;
  const nm = viewMonth === 12 ? 1 : viewMonth + 1;
  let nd = 1;
  while (cells.length % 7 !== 0) {
    cells.push({ y: ny, m: nm, d: nd++, inMonth: false });
  }
  return cells;
}

/** month: 0–11 (Date month index); totalCells 35 (모바일) or 42 (데스크톱) */
function generateMiniCalendarDays(
  year: number,
  month: number,
  totalCells: number = 42
): { day: number; isCurrentMonth: boolean; dateStr: string }[] {
  const firstDay = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const prevDaysInMonth = new Date(year, month, 0).getDate();
  const cells: { day: number; isCurrentMonth: boolean; dateStr: string }[] = [];
  for (let i = firstDay - 1; i >= 0; i--) {
    const d = prevDaysInMonth - i;
    const pm = month === 0 ? 11 : month - 1;
    const py = month === 0 ? year - 1 : year;
    cells.push({
      day: d,
      isCurrentMonth: false,
      dateStr: `${py}-${String(pm + 1).padStart(2, "0")}-${String(d).padStart(2, "0")}`,
    });
  }
  for (let d = 1; d <= daysInMonth; d++) {
    cells.push({
      day: d,
      isCurrentMonth: true,
      dateStr: `${year}-${String(month + 1).padStart(2, "0")}-${String(d).padStart(2, "0")}`,
    });
  }
  const remaining = totalCells - cells.length;
  if (remaining < 0) {
    return cells.slice(0, totalCells);
  }
  for (let d = 1; d <= remaining; d++) {
    const nm = month === 11 ? 0 : month + 1;
    const ny = month === 11 ? year + 1 : year;
    cells.push({
      day: d,
      isCurrentMonth: false,
      dateStr: `${ny}-${String(nm + 1).padStart(2, "0")}-${String(d).padStart(2, "0")}`,
    });
  }
  return cells.slice(0, totalCells);
}

function countEventsOverlappingMonth(year: number, month1to12: number, evs: PlannerEventRow[]): number {
  const dim = new Date(year, month1to12, 0).getDate();
  const monthStart = dateKey(year, month1to12, 1);
  const monthEnd = dateKey(year, month1to12, dim);
  return evs.filter((ev) => {
    const s = ev.start_date.substring(0, 10);
    const end = (ev.end_date || ev.start_date).substring(0, 10);
    return !(end < monthStart || s > monthEnd);
  }).length;
}

function startOfWeekSunday(d: Date): Date {
  const x = new Date(d);
  const dow = x.getDay();
  x.setDate(x.getDate() - dow);
  x.setHours(0, 0, 0, 0);
  return x;
}

function deptColor(depts: PlannerDepartment[], id: string | null): string {
  if (!id) return ACCENT;
  return depts.find((x) => x.id === id)?.color ?? ACCENT;
}

function eventDisplayColor(ev: PlannerEventRow, depts: PlannerDepartment[]): string {
  const join = (ev as PlannerEventRow & { departments?: { color?: string | null } | null }).departments?.color;
  if (join) return join;
  if (ev.department_id) return deptColor(depts, ev.department_id);
  return "#94a3b8";
}

function eventDepartmentName(ev: PlannerEventRow, depts: PlannerDepartment[]): string {
  const join = (ev as PlannerEventRow & { departments?: { name?: string | null } | null }).departments?.name;
  if (join) return join;
  if (ev.department_id) return depts.find((d) => d.id === ev.department_id)?.name ?? "미지정";
  return "미지정";
}

function rgbaFromHex(hex: string, alpha: number): string {
  let h = hex.replace("#", "");
  if (h.length === 3) h = h.split("").map((c) => c + c).join("");
  const r = parseInt(h.slice(0, 2), 16);
  const g = parseInt(h.slice(2, 4), 16);
  const b = parseInt(h.slice(4, 6), 16);
  return `rgba(${r},${g},${b},${alpha})`;
}

export function PlannerPage({ toast }: { toast: PlannerToast }) {
  const mob = useIsMobile();
  const { churchId: ctxChurchId } = useAuth();
  const [churchId, setChurchId] = useState<string | null>(null);

  useEffect(() => {
    const styleId = "hide-scrollbar-style";
    if (!document.getElementById(styleId)) {
      const style = document.createElement("style");
      style.id = styleId;
      style.textContent = `
      /* 모든 요소의 스크롤바 숨기기 */
      *::-webkit-scrollbar {
        display: none !important;
        width: 0 !important;
        height: 0 !important;
      }
      * {
        -ms-overflow-style: none !important;
        scrollbar-width: none !important;
      }
    `;
      document.head.appendChild(style);
    }
    return () => {
      const el = document.getElementById(styleId);
      if (el) el.remove();
    };
  }, []);

  useEffect(() => {
    if (ctxChurchId) {
      setChurchId(ctxChurchId);
      return;
    }
    try {
      setChurchId(getChurchId());
    } catch {
      setChurchId(null);
    }
  }, [ctxChurchId]);

  const [sidebarTab, setSidebarTab] = useState<"calendar" | "admin">("calendar");
  const now = new Date();
  const [cursorY, setCursorY] = useState(now.getFullYear());
  const [cursorM, setCursorM] = useState(now.getMonth() + 1);

  const [departments, setDepartments] = useState<PlannerDepartment[]>([]);
  const [places, setPlaces] = useState<PlannerPlace[]>([]);
  const [events, setEvents] = useState<PlannerEventRow[]>([]);
  const [yearEvents, setYearEvents] = useState<PlannerEventRow[]>([]);
  const [calRows, setCalRows] = useState<ChurchCalendarRow[]>([]);
  const [loading, setLoading] = useState(true);

  const [eventModalOpen, setEventModalOpen] = useState(false);
  const [editingEventId, setEditingEventId] = useState<string | null>(null);
  const [eventForm, setEventForm] = useState({
    title: "",
    department_id: "",
    event_type: "event",
    start_date: "",
    end_date: "",
    is_all_day: true,
    start_time: "09:00",
    end_time: "10:00",
    place_id: "",
    place_name: "",
    recurrence_rule: "",
    expected_people: "" as string | number,
    description: "",
  });

  const [customPlace, setCustomPlace] = useState("");
  const [useCustomPlace, setUseCustomPlace] = useState(false);
  const [customEventType, setCustomEventType] = useState("");
  const [useCustomEventType, setUseCustomEventType] = useState(false);

  const [deptModalOpen, setDeptModalOpen] = useState(false);
  const [editingDeptId, setEditingDeptId] = useState<string | null>(null);
  const [deptForm, setDeptForm] = useState<{ name: string; color: string; leader_name: string }>({
    name: "",
    color: String(COLOR_PRESETS[0]),
    leader_name: "",
  });

  const [placeModalOpen, setPlaceModalOpen] = useState(false);
  const [editingPlaceId, setEditingPlaceId] = useState<string | null>(null);
  const [placeForm, setPlaceForm] = useState({
    name: "",
    capacity: "",
    equipment: [] as string[],
  });

  const [moreModal, setMoreModal] = useState<{ y: number; m: number; d: number; list: PlannerEventRow[] } | null>(null);

  const [selectMode, setSelectMode] = useState(false);
  const [selectedEventIds, setSelectedEventIds] = useState<Set<string>>(new Set());
  const [yearlyHoverMonth, setYearlyHoverMonth] = useState<number | null>(null);
  const [showLegendModal, setShowLegendModal] = useState(false);
  const [briefingEvent, setBriefingEvent] = useState<any>(null);

  const resetEventForm = useCallback(() => {
    setEventForm({
      title: "",
      department_id: "",
      event_type: "event",
      start_date: "",
      end_date: "",
      is_all_day: true,
      start_time: "09:00",
      end_time: "10:00",
      place_id: "",
      place_name: "",
      recurrence_rule: "",
      expected_people: "",
      description: "",
    });
    setEditingEventId(null);
    setUseCustomPlace(false);
    setCustomPlace("");
    setUseCustomEventType(false);
    setCustomEventType("");
  }, []);

  const loadDepartments = useCallback(async () => {
    if (!supabase || !churchId) return;
    try {
      const { data, error } = await supabase
        .from(TB_DEPARTMENTS)
        .select("*")
        .eq("church_id", churchId)
        .order("sort_order");
      if (error) {
        console.error("[planner] loadDepartments", error);
        return;
      }
      if (data && data.length === 0) {
        const rows = DEFAULT_DEPARTMENT_ROWS.map((r) => ({
          church_id: churchId,
          name: r.name,
          color: r.color,
          sort_order: r.sort_order,
          is_active: true,
        }));
        const { error: insErr } = await supabase.from(TB_DEPARTMENTS).insert(rows);
        if (insErr) console.error("[planner] seed departments", insErr);
        const { data: d2, error: e2 } = await supabase
          .from(TB_DEPARTMENTS)
          .select("*")
          .eq("church_id", churchId)
          .order("sort_order");
        if (e2) console.error("[planner] loadDepartments reload", e2);
        else setDepartments((d2 ?? []) as PlannerDepartment[]);
        return;
      }
      setDepartments((data ?? []) as PlannerDepartment[]);
    } catch (e) {
      console.error("[planner] loadDepartments", e);
    }
  }, [churchId]);

  const loadPlaces = useCallback(async () => {
    if (!supabase || !churchId) return;
    try {
      const { data, error } = await supabase.from(TB_PLACES).select("*").eq("church_id", churchId).order("sort_order");
      if (error) {
        console.error("[planner] loadPlaces", error);
        return;
      }
      if (data && data.length === 0) {
        const rows = DEFAULT_PLACE_ROWS.map((r) => ({
          church_id: churchId,
          name: r.name,
          capacity: r.capacity,
          equipment: r.equipment,
          sort_order: r.sort_order,
          is_active: true,
        }));
        const { error: insErr } = await supabase.from(TB_PLACES).insert(rows);
        if (insErr) console.error("[planner] seed places", insErr);
        const { data: d2, error: e2 } = await supabase.from(TB_PLACES).select("*").eq("church_id", churchId).order("sort_order");
        if (e2) console.error("[planner] loadPlaces reload", e2);
        else setPlaces((d2 ?? []) as PlannerPlace[]);
        return;
      }
      setPlaces((data ?? []) as PlannerPlace[]);
    } catch (e) {
      console.error("[planner] loadPlaces", e);
    }
  }, [churchId]);

  const loadEvents = useCallback(async () => {
    if (!supabase || !churchId) return;
    const currentYear = cursorY;
    try {
      const { data, error } = await supabase
        .from("events")
        .select("*, departments(name, color), places(name)")
        .eq("church_id", churchId)
        .gte("start_date", `${currentYear}-01-01`)
        .lte("start_date", `${currentYear}-12-31`);

      if (error) {
        console.error("[planner] loadEvents error:", error);
        return;
      }
      console.log("[planner] loaded events:", data?.length, data);
      if (data) {
        setEvents(data as PlannerEventRow[]);
        setYearEvents(data as PlannerEventRow[]);
      }
    } catch (e) {
      console.error("[planner] loadEvents catch:", e);
    }
  }, [churchId, cursorY]);

  const loadYearEvents = loadEvents;

  const loadChurchCalendar = useCallback(async () => {
    if (!supabase || !churchId) return;
    try {
      const { data, error } = await supabase
        .from(TB_CHURCH_CALENDAR)
        .select("*")
        .eq("church_id", churchId)
        .eq("year", cursorY);
      if (error) {
        console.error("[planner] loadChurchCalendar", error);
        return;
      }
      setCalRows((data ?? []) as ChurchCalendarRow[]);
    } catch (e) {
      console.error("[planner] loadChurchCalendar", e);
    }
  }, [churchId, cursorY]);

  useEffect(() => {
    if (!churchId) {
      setLoading(false);
      return;
    }
    let cancelled = false;
    (async () => {
      setLoading(true);
      try {
        await Promise.all([loadDepartments(), loadPlaces(), loadEvents(), loadChurchCalendar()]);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [churchId, cursorY, cursorM, loadDepartments, loadPlaces, loadEvents, loadChurchCalendar]);

  const calByDate = useMemo(() => {
    const m = new Map<string, ChurchCalendarRow[]>();
    for (const r of calRows) {
      const k = r.date;
      if (!m.has(k)) m.set(k, []);
      m.get(k)!.push(r);
    }
    return m;
  }, [calRows]);

  const monthCells = useMemo(() => buildMonthGridCells(cursorY, cursorM), [cursorY, cursorM]);

  const monthEventsForBulkDelete = useMemo(() => {
    const dim = new Date(cursorY, cursorM, 0).getDate();
    const monthStart = dateKey(cursorY, cursorM, 1);
    const monthEnd = dateKey(cursorY, cursorM, dim);
    return events.filter((ev) => {
      const s = ev.start_date.substring(0, 10);
      const end = (ev.end_date || ev.start_date).substring(0, 10);
      return !(end < monthStart || s > monthEnd);
    });
  }, [events, cursorY, cursorM]);

  const openAddEvent = (y: number, m: number, d: number) => {
    resetEventForm();
    setEventForm((f) => ({
      ...f,
      start_date: `${y}-${pad2(m)}-${pad2(d)}`,
      department_id: departments[0]?.id ?? "",
    }));
    setEditingEventId(null);
    setEventModalOpen(true);
  };

  const openEditEvent = (ev: PlannerEventRow) => {
    setEditingEventId(ev.id);
    const pn = ev.place_name ?? "";
    setEventForm({
      title: ev.title,
      department_id: ev.department_id ?? "",
      event_type: ev.event_type || "event",
      start_date: ev.start_date,
      end_date: ev.end_date ?? "",
      is_all_day: !!ev.is_all_day,
      start_time: (ev.start_time || "09:00").slice(0, 5),
      end_time: (ev.end_time || "10:00").slice(0, 5),
      place_id: ev.place_id ?? "",
      place_name: pn,
      recurrence_rule: ev.recurrence_rule ?? "",
      expected_people: ev.expected_people != null ? ev.expected_people : "",
      description: ev.description ?? "",
    });
    if (ev.place_id) {
      setUseCustomPlace(false);
      setCustomPlace("");
    } else if (pn) {
      setUseCustomPlace(true);
      setCustomPlace(pn);
    } else {
      setUseCustomPlace(false);
      setCustomPlace("");
    }
    const predefinedTypeValues = EVENT_TYPES.map((t) => t.value);
    if (ev.event_type && !predefinedTypeValues.includes(ev.event_type)) {
      setUseCustomEventType(true);
      setCustomEventType(ev.event_type);
    } else {
      setUseCustomEventType(false);
      setCustomEventType("");
    }
    setEventModalOpen(true);
  };

  const handleSaveEvent = async () => {
    if (!supabase || !churchId) {
      toast("Supabase 또는 교회 정보를 확인할 수 없습니다.", "err");
      return;
    }
    if (!eventForm.title.trim()) {
      alert("제목을 입력하세요");
      return;
    }
    if (!eventForm.start_date) {
      alert("시작일을 선택하세요");
      return;
    }
    try {
      if (!useCustomPlace && eventForm.place_id) {
        let q = supabase
          .from(TB_EVENTS)
          .select("id,title,department_id")
          .eq("church_id", churchId)
          .eq("place_id", eventForm.place_id)
          .eq("start_date", eventForm.start_date);
        if (editingEventId) q = q.neq("id", editingEventId);
        const { data: conflicts, error: cErr } = await q;
        if (cErr) console.error("[planner] conflict query", cErr);
        if (conflicts && conflicts.length > 0) {
          const msg = conflicts
            .map((c) => {
              const dn = departments.find((d) => d.id === c.department_id)?.name ?? "미지정";
              return `- ${c.title} (${dn})`;
            })
            .join("\n");
          if (!confirm(`⚠️ 같은 날짜, 같은 장소에 일정이 있습니다:\n${msg}\n\n그래도 저장하시겠습니까?`)) return;
        }
      }

      const payload = {
        church_id: churchId,
        title: eventForm.title.trim(),
        department_id: eventForm.department_id || null,
        event_type: eventForm.event_type,
        start_date: eventForm.start_date,
        end_date: eventForm.end_date.trim() || null,
        start_time: eventForm.is_all_day ? null : eventForm.start_time ? `${eventForm.start_time}:00` : null,
        end_time: eventForm.is_all_day ? null : eventForm.end_time ? `${eventForm.end_time}:00` : null,
        is_all_day: eventForm.is_all_day,
        place_id: useCustomPlace ? null : eventForm.place_id || null,
        place_name: useCustomPlace ? (customPlace.trim() || null) : null,
        recurrence_rule: eventForm.recurrence_rule || null,
        description: eventForm.description.trim() || null,
        expected_people:
          eventForm.expected_people === "" || eventForm.expected_people === null
            ? null
            : Number(eventForm.expected_people),
        is_public: true,
      };

      if (editingEventId) {
        const { error } = await supabase
          .from(TB_EVENTS)
          .update({ ...payload, updated_at: new Date().toISOString() })
          .eq("id", editingEventId);
        if (error) {
          console.error("[planner] update event", error);
          toast("저장 실패: " + error.message, "err");
          return;
        }
        toast("일정이 수정되었습니다.", "ok");
      } else {
        const { error } = await supabase.from(TB_EVENTS).insert(payload);
        if (error) {
          console.error("[planner] insert event", error);
          toast("저장 실패: " + error.message, "err");
          return;
        }
        toast("일정이 추가되었습니다.", "ok");
      }
      setEventModalOpen(false);
      setEditingEventId(null);
      resetEventForm();
      await loadEvents();
    } catch (e) {
      console.error("[planner] handleSaveEvent", e);
      toast("저장 중 오류가 발생했습니다.", "err");
    }
  };

  const handleSaveDept = async () => {
    if (!supabase || !churchId) return;
    if (!deptForm.name.trim()) {
      alert("부서명을 입력하세요");
      return;
    }
    try {
      const payload = {
        church_id: churchId,
        name: deptForm.name.trim(),
        color: deptForm.color,
        leader_name: deptForm.leader_name.trim() || null,
        sort_order: editingDeptId ? departments.find((d) => d.id === editingDeptId)?.sort_order ?? departments.length : departments.length,
        is_active: true,
      };
      if (editingDeptId) {
        const { name, color, leader_name } = deptForm;
        const { error } = await supabase
          .from(TB_DEPARTMENTS)
          .update({
            name: name.trim(),
            color,
            leader_name: leader_name.trim() || null,
          })
          .eq("id", editingDeptId);
        if (error) {
          console.error("[planner] update dept", error);
          alert(error.message);
          return;
        }
      } else {
        const { error } = await supabase.from(TB_DEPARTMENTS).insert(payload);
        if (error) {
          console.error("[planner] insert dept", error);
          alert(error.message);
          return;
        }
      }
      setDeptModalOpen(false);
      setEditingDeptId(null);
      setDeptForm({ name: "", color: String(COLOR_PRESETS[0]), leader_name: "" });
      await loadDepartments();
      toast("부서가 저장되었습니다.", "ok");
    } catch (e) {
      console.error("[planner] handleSaveDept", e);
    }
  };

  const handleDeleteDept = async (id: string) => {
    if (!supabase) return;
    if (!confirm("정말 삭제하시겠습니까?")) return;
    try {
      const { error } = await supabase.from(TB_DEPARTMENTS).delete().eq("id", id);
      if (error) {
        console.error("[planner] delete dept", error);
        alert(error.message);
        return;
      }
      await loadDepartments();
      toast("삭제되었습니다.", "ok");
    } catch (e) {
      console.error("[planner] handleDeleteDept", e);
    }
  };

  const handleSavePlace = async () => {
    if (!supabase || !churchId) return;
    if (!placeForm.name.trim()) {
      alert("장소명을 입력하세요");
      return;
    }
    try {
      if (editingPlaceId) {
        const { error } = await supabase
          .from(TB_PLACES)
          .update({
            name: placeForm.name.trim(),
            capacity: placeForm.capacity.trim() ? Number(placeForm.capacity) : null,
            equipment: placeForm.equipment.length ? placeForm.equipment : [],
          })
          .eq("id", editingPlaceId);
        if (error) {
          console.error("[planner] update place", error);
          alert(error.message);
          return;
        }
      } else {
        const { error } = await supabase.from(TB_PLACES).insert({
          church_id: churchId,
          name: placeForm.name.trim(),
          capacity: placeForm.capacity.trim() ? Number(placeForm.capacity) : null,
          equipment: placeForm.equipment.length ? placeForm.equipment : [],
          sort_order: places.length,
          is_active: true,
        });
        if (error) {
          console.error("[planner] insert place", error);
          alert(error.message);
          return;
        }
      }
      setPlaceModalOpen(false);
      setEditingPlaceId(null);
      setPlaceForm({ name: "", capacity: "", equipment: [] });
      await loadPlaces();
      toast("장소가 저장되었습니다.", "ok");
    } catch (e) {
      console.error("[planner] handleSavePlace", e);
    }
  };

  const handleDeletePlace = async (id: string) => {
    if (!supabase) return;
    if (!confirm("정말 삭제하시겠습니까?")) return;
    try {
      const { error } = await supabase.from(TB_PLACES).delete().eq("id", id);
      if (error) {
        console.error("[planner] delete place", error);
        alert(error.message);
        return;
      }
      await loadPlaces();
      toast("삭제되었습니다.", "ok");
    } catch (e) {
      console.error("[planner] handleDeletePlace", e);
    }
  };

  const weekDays = useMemo(() => {
    const s = startOfWeekSunday(new Date());
    return Array.from({ length: 7 }, (_, i) => {
      const d = new Date(s);
      d.setDate(s.getDate() + i);
      return d;
    });
  }, []);

  const todayD = now.getDate();
  const todayM = now.getMonth() + 1;
  const todayY = now.getFullYear();

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

  const goPrevMonth = () => {
    if (cursorM === 1) {
      setCursorY((y) => y - 1);
      setCursorM(12);
    } else setCursorM((m) => m - 1);
  };

  const goNextMonth = () => {
    if (cursorM === 12) {
      setCursorY((y) => y + 1);
      setCursorM(1);
    } else setCursorM((m) => m + 1);
  };

  const addEventDayForHeader =
    cursorY === todayY && cursorM === todayM ? todayD : 1;

  const plannerMonthGridInner = useMemo(
    () => (
      <>
                <div
                  style={{
                    display: "grid",
                    gridTemplateColumns: "repeat(7, 1fr)",
                    borderBottom: mob ? "1.5px solid var(--color-border)" : "2px solid var(--color-border)",
                    marginBottom: 0,
                  }}
                >
                  {["일", "월", "화", "수", "목", "금", "토"].map((label, i) => (
                    <div
                      key={label}
                      style={{
                        textAlign: "center",
                        fontSize: mob ? 11 : 13,
                        fontWeight: 600,
                        color: i === 0 ? "var(--color-danger)" : i === 6 ? "var(--color-info)" : C.textSub,
                        padding: mob ? "8px 0" : "12px 0",
                      }}
                    >
                      {label}
                    </div>
                  ))}
                </div>

                <div style={{ display: "grid", gridTemplateColumns: "repeat(7, minmax(0, 1fr))", gap: 0 }}>
                  {monthCells.map((cell, idx) => {
                  const col = idx % 7;
                  const row = Math.floor(idx / 7);
                  const nRows = Math.ceil(monthCells.length / 7);
                  const isLastCol = col === 6;
                  const isLastRow = row === nRows - 1;
                  const list = events.filter((e) => eventCoversDate(e, dateKey(cell.y, cell.m, cell.d)));
                  const markers = calByDate.get(dateKey(cell.y, cell.m, cell.d));
                  const seasonText = markers?.map((x) => x.name).join(" · ");
                  const isTodayCell = cell.y === todayY && cell.m === todayM && cell.d === todayD;
                  const sunday = col === 0;
                  const saturday = col === 6;
                  const numColor = mob
                    ? !cell.inMonth
                      ? "var(--color-text-faint)"
                      : sunday
                        ? "var(--color-danger)"
                        : saturday
                          ? "var(--color-info)"
                          : C.text
                    : !cell.inMonth
                      ? "var(--color-text-faint)"
                      : sunday
                        ? "var(--color-danger)"
                        : saturday
                          ? "var(--color-info)"
                          : C.text;
                  const visible = mob ? list : list.slice(0, 3);
                  const more = mob ? 0 : Math.max(0, list.length - 3);
                  const baseBg = !cell.inMonth ? "var(--color-surface-muted)" : "var(--color-surface)";

                  return (
                    <button
                      key={`${cell.y}-${cell.m}-${cell.d}-${idx}`}
                      type="button"
                      onClick={() => openAddEvent(cell.y, cell.m, cell.d)}
                      style={{
                        minHeight: mob ? 38 : 140,
                        padding: mob ? 2 : 8,
                        cursor: "pointer",
                        transition: "background 0.15s",
                        border: "none",
                        borderRight: isLastCol ? "none" : "1px solid var(--color-border)",
                        borderBottom: isLastRow ? "none" : "1px solid var(--color-border)",
                        borderRadius: 0,
                        background: baseBg,
                        textAlign: "left",
                        verticalAlign: "top",
                        display: "flex",
                        flexDirection: "column",
                        alignItems: "stretch",
                        alignContent: "flex-start",
                        overflow: "hidden",
                        boxSizing: "border-box",
                      }}
                      onMouseEnter={(e) => {
                        e.currentTarget.style.background = "color-mix(in srgb, var(--color-primary) 12%, var(--color-surface-elevated))";
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.background = baseBg;
                      }}
                    >
                      <span
                        style={{
                          display: isTodayCell ? "inline-flex" : "inline-block",
                          alignItems: isTodayCell ? "center" : undefined,
                          justifyContent: isTodayCell ? "center" : undefined,
                          fontSize: mob ? 12 : 14,
                          fontWeight: 600,
                          marginBottom: 4,
                          color: isTodayCell ? "var(--color-primary-on)" : numColor,
                          width: isTodayCell ? 28 : undefined,
                          height: isTodayCell ? 28 : undefined,
                          minWidth: isTodayCell ? 28 : undefined,
                          borderRadius: isTodayCell ? "50%" : undefined,
                          background: isTodayCell ? C.primary : "transparent",
                          boxSizing: "border-box",
                        }}
                      >
                        {cell.d}
                      </span>
                      {seasonText ? (
                        <div style={{ fontSize: 9, color: "var(--color-danger)", fontWeight: 500, lineHeight: 1.2, marginBottom: 2 }}>{seasonText}</div>
                      ) : null}
                      <div style={{ flex: 1, minHeight: 0, display: "flex", flexDirection: "column", gap: 2 }}>
                        {visible.map((ev) => {
                          const hex = eventDisplayColor(ev, departments);
                          const toggleSelect = () => {
                            setSelectedEventIds((prev) => {
                              const s = new Set(prev);
                              if (s.has(ev.id)) s.delete(ev.id);
                              else s.add(ev.id);
                              return s;
                            });
                          };
                          if (mob) {
                            const dn = eventDepartmentName(ev, departments);
                            return (
                              <span
                                key={ev.id}
                                title={`${dn}: ${ev.title}`}
                                onClick={(e) => {
                                  e.stopPropagation();
                                  if (selectMode) toggleSelect();
                                  else setBriefingEvent(ev);
                                }}
                                style={{
                                  display: "inline-flex",
                                  alignItems: "center",
                                  gap: 4,
                                  flexShrink: 0,
                                  cursor: "pointer",
                                  marginBottom: 2,
                                  maxWidth: "100%",
                                }}
                                role="presentation"
                              >
                                {selectMode && (
                                  <input
                                    type="checkbox"
                                    checked={selectedEventIds.has(ev.id)}
                                    onChange={(e) => {
                                      e.stopPropagation();
                                      toggleSelect();
                                    }}
                                    onClick={(e) => e.stopPropagation()}
                                    style={{
                                      width: 13,
                                      height: 13,
                                      marginRight: 4,
                                      cursor: "pointer",
                                      flexShrink: 0,
                                      accentColor: C.primary,
                                    }}
                                  />
                                )}
                                <span
                                  style={{
                                    width: 5,
                                    height: 5,
                                    borderRadius: "50%",
                                    background: hex,
                                    flexShrink: 0,
                                  }}
                                />
                              </span>
                            );
                          }
                          return (
                            <div
                              key={ev.id}
                              role="button"
                              tabIndex={0}
                              onClick={(e) => {
                                e.stopPropagation();
                                if (selectMode) toggleSelect();
                                else setBriefingEvent(ev);
                              }}
                              onKeyDown={(e) => {
                                if (e.key === "Enter" || e.key === " ") {
                                  e.preventDefault();
                                  e.stopPropagation();
                                  if (selectMode) toggleSelect();
                                  else setBriefingEvent(ev);
                                }
                              }}
                              style={{
                                display: "flex",
                                alignItems: "center",
                                gap: 0,
                                background: `${hex}20`,
                                color: hex,
                                fontSize: mob ? 8 : 11,
                                fontWeight: 600,
                                borderRadius: mob ? 4 : 6,
                                padding: mob ? "1px 3px" : "2px 6px",
                                marginBottom: 2,
                                cursor: "pointer",
                                maxWidth: "100%",
                                overflow: "hidden",
                                textOverflow: "ellipsis",
                                whiteSpace: "nowrap",
                              }}
                            >
                              {selectMode && (
                                <input
                                  type="checkbox"
                                  checked={selectedEventIds.has(ev.id)}
                                  onChange={(e) => {
                                    e.stopPropagation();
                                    toggleSelect();
                                  }}
                                  onClick={(e) => e.stopPropagation()}
                                  style={{
                                    width: 13,
                                    height: 13,
                                    marginRight: 4,
                                    cursor: "pointer",
                                    flexShrink: 0,
                                    accentColor: "#4A90D9",
                                  }}
                                />
                              )}
                              <span
                                style={{
                                  display: "flex",
                                  alignItems: "center",
                                  gap: 0,
                                  minWidth: 0,
                                  flex: 1,
                                  overflow: "hidden",
                                }}
                              >
                                <span style={{ fontWeight: 600, fontSize: mob ? 8 : 10, flexShrink: 0 }}>
                                  {eventDepartmentName(ev, departments)}
                                </span>
                                <span style={{ margin: "0 3px", opacity: 0.5, flexShrink: 0 }}>:</span>
                                <span
                                  style={{
                                    minWidth: 0,
                                    overflow: "hidden",
                                    textOverflow: "ellipsis",
                                    whiteSpace: "nowrap",
                                  }}
                                >
                                  {ev.title}
                                </span>
                              </span>
                            </div>
                          );
                        })}
                        {!mob && more > 0 && (
                          <span
                            role="button"
                            tabIndex={0}
                            onClick={(e) => {
                              e.stopPropagation();
                              setMoreModal({ y: cell.y, m: cell.m, d: cell.d, list });
                            }}
                            onKeyDown={(e) => {
                              if (e.key === "Enter" || e.key === " ") {
                                e.preventDefault();
                                e.stopPropagation();
                                setMoreModal({ y: cell.y, m: cell.m, d: cell.d, list });
                              }
                            }}
                            style={{ fontSize: 10, color: C.textFaint, cursor: "pointer" }}
                          >
                            +{more} 더보기
                          </span>
                        )}
                      </div>
                    </button>
                  );
                })}
                </div>
      </>
    ),
    [
      mob,
      monthCells,
      events,
      calByDate,
      departments,
      selectMode,
      selectedEventIds,
      todayY,
      todayM,
      todayD,
    ],
  );

  return (
    <UnifiedPageLayout
      pageTitle="플래너"
      pageSubtitle={new Date().toLocaleDateString("ko-KR", { year: "numeric", month: "long", day: "numeric" })}
      navSections={navSections}
      activeId={sidebarTab}
      onNav={(id) => setSidebarTab(id as "calendar" | "admin")}
      versionText="플래너 v2"
      headerTitle="교회 플래너"
      headerDesc="교회 전체 일정을 한눈에 관리합니다"
      SidebarIcon={CalendarDays}
      accentColor={ACCENT}
    >
      {loading && (
        <div style={{ padding: 40, textAlign: "center", color: C.textSub }}>불러오는 중…</div>
      )}
      {!loading && !churchId && (
        <div style={{ padding: 40, textAlign: "center", color: C.textSub }}>로그인 후 교회를 선택하면 플래너를 사용할 수 있습니다.</div>
      )}

      {!loading && churchId && sidebarTab === "calendar" && (
        <div style={{ maxWidth: "100%", overflowX: "hidden", paddingBottom: 32 }}>
          {/* 월간 (제목 없음 — 카드로만 구분) */}
          <section style={{ paddingTop: 16, marginBottom: mob ? 24 : 40 }}>
            {mob ? (
              <div
                style={{
                  background: "transparent",
                  borderRadius: 0,
                  border: "none",
                  padding: 0,
                  boxShadow: "none",
                  marginBottom: 16,
                  overflow: "visible",
                  maxWidth: "100%",
                  boxSizing: "border-box",
                }}
              >
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 8,
                    marginBottom: 12,
                  }}
                >
                  <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <button
                      type="button"
                      aria-label="이전 달"
                      onClick={goPrevMonth}
                      style={{
                        width: 28,
                        height: 28,
                        borderRadius: "50%",
                        border: "1.5px solid #e9ecf0",
                        background: "var(--color-surface)",
                        cursor: "pointer",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        fontSize: 12,
                        color: C.textSub,
                      }}
                    >
                      <ChevronLeft size={14} />
                    </button>
                    <span
                      style={{
                        fontSize: 15,
                        fontWeight: 700,
                        color: C.text,
                        whiteSpace: "nowrap",
                      }}
                    >
                      {cursorY}년 {cursorM}월
                    </span>
                    <button
                      type="button"
                      aria-label="다음 달"
                      onClick={goNextMonth}
                      style={{
                        width: 28,
                        height: 28,
                        borderRadius: "50%",
                        border: "1.5px solid #e9ecf0",
                        background: "var(--color-surface)",
                        cursor: "pointer",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        fontSize: 12,
                        color: C.textSub,
                      }}
                    >
                      <ChevronRight size={14} />
                    </button>
                  </div>
                </div>

                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    marginBottom: 12,
                    gap: 6,
                  }}
                >
                  <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                    <button
                      type="button"
                      onClick={() => {
                        setSelectMode((v) => !v);
                        setSelectedEventIds(new Set());
                      }}
                      style={{
                        background: selectMode ? "color-mix(in srgb, var(--color-danger) 14%, var(--color-surface-elevated))" : "var(--color-surface)",
                        color: selectMode ? "var(--color-danger)" : "var(--color-text-muted)",
                        border: `1.5px solid ${selectMode ? "color-mix(in srgb, var(--color-danger) 34%, var(--color-border))" : "var(--color-border)"}`,
                        fontSize: 11,
                        fontWeight: 600,
                        borderRadius: 8,
                        padding: "4px 8px",
                        height: 28,
                        boxSizing: "border-box",
                        cursor: "pointer",
                        whiteSpace: "nowrap",
                      }}
                    >
                      선택 삭제
                    </button>
                    <button
                      type="button"
                      onClick={async () => {
                        const n = monthEventsForBulkDelete.length;
                        if (n === 0) {
                          alert("삭제할 일정이 없습니다.");
                          return;
                        }
                        if (
                          !confirm(
                            `이 달의 모든 일정(${n}개)을 삭제하시겠습니까?\n\n이 작업은 되돌릴 수 없습니다.`
                          )
                        )
                          return;
                        if (!confirm("정말로 전체 삭제하시겠습니까?")) return;
                        if (!supabase) {
                          toast("Supabase를 사용할 수 없습니다.", "err");
                          return;
                        }
                        const ids = monthEventsForBulkDelete.map((e) => e.id);
                        const { error } = await supabase.from("events").delete().in("id", ids);
                        if (error) {
                          console.error("[planner] bulk delete error:", error);
                          alert("삭제 실패: " + error.message);
                          return;
                        }
                        await loadEvents();
                        if (typeof loadYearEvents === "function") await loadYearEvents();
                        toast("이 달의 일정이 삭제되었습니다.", "ok");
                      }}
                      style={{
                        background: "var(--color-surface)",
                        color: "var(--color-danger)",
                        border: "1.5px solid var(--color-border)",
                        fontSize: 11,
                        fontWeight: 600,
                        borderRadius: 8,
                        padding: "4px 8px",
                        height: 28,
                        boxSizing: "border-box",
                        cursor: "pointer",
                        whiteSpace: "nowrap",
                      }}
                    >
                      전체 삭제
                    </button>
                    <button
                      type="button"
                      onClick={() => openAddEvent(cursorY, cursorM, addEventDayForHeader)}
                      style={{
                        background: C.primary,
                        color: "var(--color-primary-on)",
                        border: "none",
                        fontSize: 11,
                        fontWeight: 700,
                        borderRadius: 8,
                        padding: "4px 8px",
                        height: 28,
                        boxSizing: "border-box",
                        cursor: "pointer",
                        whiteSpace: "nowrap",
                      }}
                    >
                      + 일정 추가
                    </button>
                  </div>
                  {departments.length > 0 && (
                    <button
                      type="button"
                      onClick={() => setShowLegendModal(true)}
                      style={{
                        background: "var(--color-surface)",
                        color: C.textSub,
                        border: "1.5px solid var(--color-border)",
                        fontSize: 11,
                        fontWeight: 600,
                        borderRadius: 8,
                        padding: "5px 10px",
                        cursor: "pointer",
                        whiteSpace: "nowrap",
                        display: "flex",
                        alignItems: "center",
                        gap: 4,
                      }}
                    >
                      <span
                        style={{
                          width: 8,
                          height: 8,
                          borderRadius: "50%",
                          background: "linear-gradient(135deg, #EF4444, #4A90D9, #22C55E)",
                          display: "inline-block",
                        }}
                      />
                      범례
                    </button>
                  )}
                </div>

                {selectMode && selectedEventIds.size > 0 && (
                  <div
                    style={{
                      background: "#FEF2F2",
                      borderRadius: 12,
                      padding: "10px 16px",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "space-between",
                      marginBottom: 12,
                    }}
                  >
                    <span style={{ fontSize: 14, fontWeight: 600, color: "#EF4444" }}>
                      {selectedEventIds.size}개 선택됨
                    </span>
                    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                      <button
                        type="button"
                        onClick={() => {
                          if (events.length > 0 && selectedEventIds.size === events.length) {
                            setSelectedEventIds(new Set());
                          } else {
                            setSelectedEventIds(new Set(events.map((e) => e.id)));
                          }
                        }}
                        style={{
                          background: "var(--color-surface)",
                          color: C.textSub,
                          border: "1.5px solid #e8e9f0",
                          borderRadius: 8,
                          padding: "6px 12px",
                          fontSize: 12,
                          fontWeight: 600,
                          cursor: "pointer",
                        }}
                      >
                        {events.length > 0 && selectedEventIds.size === events.length ? "선택 해제" : "전체 선택"}
                      </button>
                      <button
                        type="button"
                        onClick={async () => {
                          if (!confirm(`선택한 ${selectedEventIds.size}개 일정을 삭제하시겠습니까?`)) return;
                          if (!supabase) {
                            toast("Supabase를 사용할 수 없습니다.", "err");
                            return;
                          }
                          const ids = Array.from(selectedEventIds);
                          const { error } = await supabase.from("events").delete().in("id", ids);
                          if (error) {
                            alert("삭제 실패: " + error.message);
                            return;
                          }
                          setSelectedEventIds(new Set());
                          setSelectMode(false);
                          await loadEvents();
                          toast("선택한 일정이 삭제되었습니다.", "ok");
                        }}
                        style={{
                          background: "#EF4444",
                          color: "#fff",
                          border: "none",
                          borderRadius: 8,
                          padding: "6px 16px",
                          fontSize: 13,
                          fontWeight: 700,
                          cursor: "pointer",
                        }}
                      >
                        삭제
                      </button>
                    </div>
                  </div>
                )}

                <div
                  style={{
                    border: "1px solid var(--color-border)",
                    borderRadius: 12,
                    overflow: "hidden",
                  }}
                >
                  {plannerMonthGridInner}
                </div>
              </div>
            ) : (
              <div
                style={{
                  background: "var(--color-surface)",
                  borderRadius: 20,
                  border: "1.5px solid #e9ecf0",
                  boxShadow: "none",
                  padding: 20,
                  marginBottom: 24,
                  overflow: "visible",
                  maxWidth: "100%",
                  boxSizing: "border-box",
                }}
              >
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    marginBottom: 16,
                    flexWrap: "wrap",
                    gap: 8,
                  }}
                >
                  <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                    <button
                      type="button"
                      aria-label="이전 달"
                      onClick={goPrevMonth}
                      style={{
                        width: 36,
                        height: 36,
                        borderRadius: "50%",
                        border: "1.5px solid #e9ecf0",
                        background: "var(--color-surface)",
                        cursor: "pointer",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        fontSize: 16,
                        color: C.textSub,
                      }}
                    >
                      <ChevronLeft size={18} />
                    </button>
                    <span
                      style={{
                        fontSize: 20,
                        fontWeight: 700,
                        color: C.text,
                        whiteSpace: "nowrap",
                      }}
                    >
                      {cursorY}년 {cursorM}월
                    </span>
                    <button
                      type="button"
                      aria-label="다음 달"
                      onClick={goNextMonth}
                      style={{
                        width: 36,
                        height: 36,
                        borderRadius: "50%",
                        border: "1.5px solid #e9ecf0",
                        background: "var(--color-surface)",
                        cursor: "pointer",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        fontSize: 16,
                        color: C.textSub,
                      }}
                    >
                      <ChevronRight size={18} />
                    </button>
                  </div>
                  <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <button
                      type="button"
                      onClick={() => {
                        setSelectMode((v) => !v);
                        setSelectedEventIds(new Set());
                      }}
                      style={{
                        background: selectMode ? "#FEF2F2" : "#fff",
                        color: selectMode ? "#EF4444" : "#64748b",
                        border: `1.5px solid ${selectMode ? "#FECACA" : "#e9ecf0"}`,
                        fontSize: 13,
                        fontWeight: 600,
                        borderRadius: 10,
                        padding: "6px 14px",
                        boxSizing: "border-box",
                        cursor: "pointer",
                        whiteSpace: "nowrap",
                      }}
                    >
                      선택 삭제
                    </button>
                    <button
                      type="button"
                      onClick={async () => {
                        const n = monthEventsForBulkDelete.length;
                        if (n === 0) {
                          alert("삭제할 일정이 없습니다.");
                          return;
                        }
                        if (
                          !confirm(
                            `이 달의 모든 일정(${n}개)을 삭제하시겠습니까?\n\n이 작업은 되돌릴 수 없습니다.`
                          )
                        )
                          return;
                        if (!confirm("정말로 전체 삭제하시겠습니까?")) return;
                        if (!supabase) {
                          toast("Supabase를 사용할 수 없습니다.", "err");
                          return;
                        }
                        const ids = monthEventsForBulkDelete.map((e) => e.id);
                        const { error } = await supabase.from("events").delete().in("id", ids);
                        if (error) {
                          console.error("[planner] bulk delete error:", error);
                          alert("삭제 실패: " + error.message);
                          return;
                        }
                        await loadEvents();
                        if (typeof loadYearEvents === "function") await loadYearEvents();
                        toast("이 달의 일정이 삭제되었습니다.", "ok");
                      }}
                      style={{
                        background: "var(--color-surface)",
                        color: "#EF4444",
                        border: "1.5px solid #FECACA",
                        fontSize: 13,
                        fontWeight: 600,
                        borderRadius: 10,
                        padding: "6px 14px",
                        boxSizing: "border-box",
                        cursor: "pointer",
                        whiteSpace: "nowrap",
                      }}
                    >
                      전체 삭제
                    </button>
                    <button
                      type="button"
                      onClick={() => openAddEvent(cursorY, cursorM, addEventDayForHeader)}
                      style={{
                        background: "#4A90D9",
                        color: "#fff",
                        border: "none",
                        fontSize: 14,
                        fontWeight: 700,
                        borderRadius: 10,
                        padding: "6px 18px",
                        boxSizing: "border-box",
                        cursor: "pointer",
                        whiteSpace: "nowrap",
                      }}
                    >
                      + 일정 추가
                    </button>
                  </div>
                </div>

                {selectMode && selectedEventIds.size > 0 && (
                  <div
                    style={{
                      background: "#FEF2F2",
                      borderRadius: 12,
                      padding: "10px 16px",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "space-between",
                      marginBottom: 12,
                    }}
                  >
                    <span style={{ fontSize: 14, fontWeight: 600, color: "#EF4444" }}>
                      {selectedEventIds.size}개 선택됨
                    </span>
                    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                      <button
                        type="button"
                        onClick={() => {
                          if (events.length > 0 && selectedEventIds.size === events.length) {
                            setSelectedEventIds(new Set());
                          } else {
                            setSelectedEventIds(new Set(events.map((e) => e.id)));
                          }
                        }}
                        style={{
                          background: "var(--color-surface)",
                          color: C.textSub,
                          border: "1.5px solid #e8e9f0",
                          borderRadius: 8,
                          padding: "6px 12px",
                          fontSize: 12,
                          fontWeight: 600,
                          cursor: "pointer",
                        }}
                      >
                        {events.length > 0 && selectedEventIds.size === events.length ? "선택 해제" : "전체 선택"}
                      </button>
                      <button
                        type="button"
                        onClick={async () => {
                          if (!confirm(`선택한 ${selectedEventIds.size}개 일정을 삭제하시겠습니까?`)) return;
                          if (!supabase) {
                            toast("Supabase를 사용할 수 없습니다.", "err");
                            return;
                          }
                          const ids = Array.from(selectedEventIds);
                          const { error } = await supabase.from("events").delete().in("id", ids);
                          if (error) {
                            alert("삭제 실패: " + error.message);
                            return;
                          }
                          setSelectedEventIds(new Set());
                          setSelectMode(false);
                          await loadEvents();
                          toast("선택한 일정이 삭제되었습니다.", "ok");
                        }}
                        style={{
                          background: "#EF4444",
                          color: "#fff",
                          border: "none",
                          borderRadius: 8,
                          padding: "6px 16px",
                          fontSize: 13,
                          fontWeight: 700,
                          cursor: "pointer",
                        }}
                      >
                        삭제
                      </button>
                    </div>
                  </div>
                )}

                <div
                  style={{
                    border: "1px solid var(--color-border)",
                    borderRadius: 12,
                    overflow: "hidden",
                  }}
                >
                  {plannerMonthGridInner}
                </div>
              </div>
            )}

            {/* 부서 컬러 범례 — 데스크톱만 인라인; 모바일은 버튼+모달 */}
            {departments.length > 0 && !mob && (
              <div
                style={{
                  background: "var(--color-surface)",
                  borderRadius: 16,
                  border: "1.5px solid var(--color-border)",
                  padding: "12px 16px",
                  marginBottom: 16,
                }}
              >
                <div
                  style={{
                    fontSize: 11,
                    fontWeight: 600,
                    color: C.textFaint,
                    marginBottom: 8,
                    letterSpacing: "0.5px",
                  }}
                >
                  부서 색상 안내
                </div>
                <div
                  style={{
                    display: "grid",
                    gridTemplateColumns: `repeat(${Math.max(1, Math.min(departments.filter((d) => d.is_active !== false).length, 6))}, auto)`,
                    gap: "6px 16px",
                    alignItems: "center",
                  }}
                >
                  {departments
                    .filter((d) => d.is_active !== false)
                    .map((dept) => (
                      <div
                        key={dept.id}
                        style={{
                          display: "flex",
                          alignItems: "center",
                          gap: 6,
                        }}
                      >
                        <span
                          style={{
                            width: 10,
                            height: 10,
                            borderRadius: "50%",
                            background: dept.color || "#94a3b8",
                            display: "inline-block",
                          }}
                        />
                        <span
                          style={{
                            fontSize: 12,
                            color: "var(--color-text-muted)",
                            fontWeight: 500,
                            whiteSpace: "nowrap",
                            overflow: "hidden",
                            textOverflow: "ellipsis",
                          }}
                        >
                          {dept.name}
                        </span>
                      </div>
                    ))}
                </div>
              </div>
            )}
          </section>

          {/* 주간 */}
          <section style={{ marginBottom: 40 }}>
            <h2
              style={{
                fontSize: mob ? 15 : 17,
                fontWeight: 700,
                color: C.text,
                margin: mob ? "0 0 10px" : "0 0 16px",
              }}
            >
              이번 주
            </h2>
            {mob ? (
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                {weekDays.map((d) => {
                  const y = d.getFullYear();
                  const m = d.getMonth();
                  const day = d.getDate();
                  const dow = d.getDay();
                  const dateStr = `${y}-${String(m + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
                  const dayEvents = events.filter((ev) => eventCoversDate(ev, dateStr));
                  const isToday = dateStr === dateKey(todayY, todayM, todayD);
                  const isSunday = dow === 0;
                  const isSaturday = dow === 6;
                  const dayNames = ["일", "월", "화", "수", "목", "금", "토"];
                  return (
                    <div
                      key={d.toISOString()}
                      style={{
                        background: isToday ? "var(--color-surface-elevated)" : "var(--color-surface)",
                        borderRadius: 16,
                        border: isToday ? `1.5px solid ${C.primary}` : "1.5px solid var(--color-border)",
                        padding: "10px 12px",
                        boxShadow: "none",
                      }}
                    >
                      <div
                        style={{
                          display: "flex",
                          alignItems: "center",
                          gap: 8,
                          marginBottom: dayEvents.length > 0 ? 8 : 0,
                        }}
                      >
                        <span
                          style={{
                            fontSize: 13,
                            fontWeight: 700,
                            color: isSunday ? "#EF4444" : isSaturday ? "#3B82F6" : C.text,
                          }}
                        >
                          {m + 1}/{day}
                        </span>
                        <span style={{ fontSize: 12, color: C.textFaint, fontWeight: 500 }}>({dayNames[dow]})</span>
                        {isToday && (
                          <span
                            style={{
                              fontSize: 9,
                              fontWeight: 700,
                              background: C.primary,
                              color: "var(--color-primary-on)",
                              borderRadius: 6,
                              padding: "2px 6px",
                            }}
                          >
                            오늘
                          </span>
                        )}
                      </div>
                      {dayEvents.length > 0 ? (
                        <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                          {dayEvents.map((ev) => {
                            const hex = eventDisplayColor(ev, departments);
                            const toggleSelect = () => {
                              setSelectedEventIds((prev) => {
                                const s = new Set(prev);
                                if (s.has(ev.id)) s.delete(ev.id);
                                else s.add(ev.id);
                                return s;
                              });
                            };
                            return (
                              <div
                                key={ev.id}
                                role="button"
                                tabIndex={0}
                                onClick={() => {
                                  if (selectMode) toggleSelect();
                                  else setBriefingEvent(ev);
                                }}
                                onKeyDown={(e) => {
                                  if (e.key === "Enter" || e.key === " ") {
                                    e.preventDefault();
                                    if (selectMode) toggleSelect();
                                    else setBriefingEvent(ev);
                                  }
                                }}
                                style={{
                                  display: "flex",
                                  alignItems: "center",
                                  gap: 8,
                                  padding: "6px 8px",
                                  background: `${hex}12`,
                                  borderLeft: `3px solid ${hex}`,
                                  borderRadius: 10,
                                  cursor: "pointer",
                                  maxWidth: "100%",
                                  overflow: "hidden",
                                }}
                              >
                                {selectMode && (
                                  <input
                                    type="checkbox"
                                    checked={selectedEventIds.has(ev.id)}
                                    onChange={(e) => {
                                      e.stopPropagation();
                                      toggleSelect();
                                    }}
                                    onClick={(e) => e.stopPropagation()}
                                    style={{
                                      width: 14,
                                      height: 14,
                                      accentColor: C.primary,
                                      flexShrink: 0,
                                      cursor: "pointer",
                                    }}
                                  />
                                )}
                                <span
                                  style={{
                                    width: 8,
                                    height: 8,
                                    borderRadius: "50%",
                                    background: hex,
                                    flexShrink: 0,
                                  }}
                                />
                                <span style={{ fontSize: 11, fontWeight: 600, color: "var(--color-text-muted)", flexShrink: 0 }}>
                                  {eventDepartmentName(ev, departments)}:
                                </span>
                                <span
                                  style={{
                                    fontSize: 11,
                                    color: NAVY,
                                    fontWeight: 500,
                                    minWidth: 0,
                                    overflow: "hidden",
                                    textOverflow: "ellipsis",
                                    whiteSpace: "nowrap",
                                  }}
                                >
                                  {ev.title}
                                </span>
                              </div>
                            );
                          })}
                        </div>
                      ) : (
                        <span style={{ fontSize: 11, color: "#cbd5e1" }}>일정 없음</span>
                      )}
                    </div>
                  );
                })}
              </div>
            ) : (
              <div style={{ display: "grid", gridTemplateColumns: "repeat(7, minmax(0, 1fr))", gap: 10 }}>
                {weekDays.map((d) => {
                  const y = d.getFullYear();
                  const m = d.getMonth();
                  const day = d.getDate();
                  const dow = d.getDay();
                  const dateStr = `${y}-${String(m + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
                  const dayEvents = events.filter((ev) => eventCoversDate(ev, dateStr));
                  return (
                    <div
                      key={d.toISOString()}
                      style={{
                        background: "var(--color-surface)",
                        borderRadius: 16,
                        padding: 12,
                        boxShadow: "0 2px 16px rgba(0,0,0,0.06)",
                        minWidth: 0,
                      }}
                    >
                      <div
                        style={{
                          fontWeight: 800,
                          fontSize: 14,
                          marginBottom: 10,
                          color: dow === 0 ? "#EF4444" : dow === 6 ? "#3B82F6" : NAVY,
                        }}
                      >
                        {m + 1}/{day}
                      </div>
                      <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                        {dayEvents.length === 0 && <span style={{ fontSize: 12, color: C.textFaint }}>일정 없음</span>}
                        {dayEvents.map((ev) => {
                          const hex = eventDisplayColor(ev, departments);
                          const toggleSelect = () => {
                            setSelectedEventIds((prev) => {
                              const s = new Set(prev);
                              if (s.has(ev.id)) s.delete(ev.id);
                              else s.add(ev.id);
                              return s;
                            });
                          };
                          return (
                            <div
                              key={ev.id}
                              role="button"
                              tabIndex={0}
                              onClick={() => {
                                if (selectMode) toggleSelect();
                                else setBriefingEvent(ev);
                              }}
                              onKeyDown={(e) => {
                                if (e.key === "Enter" || e.key === " ") {
                                  e.preventDefault();
                                  if (selectMode) toggleSelect();
                                  else setBriefingEvent(ev);
                                }
                              }}
                              style={{
                                display: "flex",
                                alignItems: "center",
                                gap: 6,
                                textAlign: "left",
                                fontSize: 12,
                                fontWeight: 600,
                                padding: "6px 8px",
                                borderRadius: 8,
                                border: "1px solid #f0f0f0",
                                background: `${hex}20`,
                                color: hex,
                                cursor: "pointer",
                                maxWidth: "100%",
                                overflow: "hidden",
                              }}
                            >
                              {selectMode && (
                                <input
                                  type="checkbox"
                                  checked={selectedEventIds.has(ev.id)}
                                  onChange={(e) => {
                                    e.stopPropagation();
                                    toggleSelect();
                                  }}
                                  onClick={(e) => e.stopPropagation()}
                                  style={{
                                    width: 13,
                                    height: 13,
                                    marginRight: 4,
                                    cursor: "pointer",
                                    flexShrink: 0,
                                    accentColor: "#4A90D9",
                                  }}
                                />
                              )}
                              <span
                                style={{
                                  display: "flex",
                                  alignItems: "center",
                                  gap: 0,
                                  minWidth: 0,
                                  flex: 1,
                                  overflow: "hidden",
                                }}
                              >
                                <span style={{ fontWeight: 700, flexShrink: 0 }}>
                                  {eventDepartmentName(ev, departments)}
                                </span>
                                <span style={{ margin: "0 3px", opacity: 0.5, flexShrink: 0 }}>:</span>
                                <span
                                  style={{
                                    minWidth: 0,
                                    overflow: "hidden",
                                    textOverflow: "ellipsis",
                                    whiteSpace: "nowrap",
                                  }}
                                >
                                  {ev.title}
                                </span>
                              </span>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </section>

          {/* 연간 */}
          <section style={{ marginBottom: 40 }}>
            <h2
              style={{
                fontSize: mob ? 15 : 17,
                fontWeight: 700,
                color: C.text,
                margin: mob ? "0 0 10px" : "0 0 16px",
              }}
            >
              {cursorY}년 연간 일정
            </h2>
            <div
              style={{
                display: "grid",
                gridTemplateColumns: mob ? "repeat(4, 1fr)" : "repeat(6, 1fr)",
                gap: mob ? 3 : 16,
              }}
            >
              {Array.from({ length: 12 }, (_, mi) => {
                const monthNum = mi + 1;
                const miniCells = generateMiniCalendarDays(cursorY, mi, mob ? 35 : 42);
                const monthEventCount = countEventsOverlappingMonth(cursorY, monthNum, yearEvents);
                const isActiveMonth = cursorM === monthNum;
                const isHovered = yearlyHoverMonth === monthNum;
                const todayStr = dateKey(todayY, todayM, todayD);
                const cardBorder = mob
                  ? isActiveMonth
                    ? `1.5px solid ${C.primary}`
                    : isHovered
                      ? "1.5px solid var(--color-border-strong)"
                      : "1.5px solid var(--color-border)"
                  : isActiveMonth
                    ? "2px solid var(--color-primary)"
                    : isHovered
                      ? "1.5px solid var(--color-primary)"
                      : "1.5px solid var(--color-border)";
                return (
                  <button
                    key={monthNum}
                    type="button"
                    onClick={() => {
                      setCursorM(monthNum);
                      window.scrollTo({ top: 0, behavior: "smooth" });
                    }}
                    onMouseEnter={() => setYearlyHoverMonth(monthNum)}
                    onMouseLeave={() => setYearlyHoverMonth(null)}
                    style={{
                      background: "var(--color-surface)",
                      borderRadius: mob ? 10 : 14,
                      border: cardBorder,
                      padding: mob ? 4 : 14,
                      cursor: "pointer",
                      transition: "box-shadow 0.2s, border-color 0.2s",
                      boxShadow: mob
                        ? "none"
                        : isHovered
                          ? "0 4px 16px rgba(74,144,217,0.12)"
                          : isActiveMonth
                            ? "0 2px 12px rgba(74,144,217,0.10)"
                            : "none",
                      textAlign: "left",
                      boxSizing: "border-box",
                      minWidth: 0,
                      ...(mob
                        ? {
                            display: "flex",
                            flexDirection: "column" as const,
                            overflow: "visible",
                          }
                        : {}),
                    }}
                  >
                    <div
                      style={{
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        marginBottom: mob ? 3 : 8,
                        position: "relative",
                        width: "100%",
                      }}
                    >
                      <span
                        style={{
                          fontSize: mob ? 9 : 14,
                          fontWeight: mob ? 600 : 700,
                          color: C.text,
                        }}
                      >
                        {monthNum}월
                      </span>
                      {monthEventCount > 0 && (
                        <span
                          style={{
                            position: "absolute",
                            right: 0,
                            fontSize: mob ? 7 : 10,
                            fontWeight: 700,
                            background: "color-mix(in srgb, var(--color-primary) 16%, var(--color-surface-elevated))",
                            color: "var(--color-primary)",
                            borderRadius: 8,
                            padding: mob ? "0px 3px" : "2px 7px",
                          }}
                        >
                          {monthEventCount}
                        </span>
                      )}
                    </div>
                    <div
                      style={{
                        display: "grid",
                        gridTemplateColumns: "repeat(7, 1fr)",
                        textAlign: "center",
                        fontSize: mob ? 5.5 : 9,
                        color: C.textFaint,
                        fontWeight: 600,
                        marginBottom: mob ? 1 : 4,
                      }}
                    >
                      {["일", "월", "화", "수", "목", "금", "토"].map((label, wi) => (
                        <div
                          key={label}
                          style={{
                            color: mob
                              ? wi === 0
                                ? "#EF4444"
                                : "#94a3b8"
                              : wi === 0
                                ? "#EF4444"
                                : wi === 6
                                  ? "#3B82F6"
                                  : "#94a3b8",
                          }}
                        >
                          {label}
                        </div>
                      ))}
                    </div>
                    <div style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", gap: 0 }}>
                      {miniCells.map((cell, ci) => {
                        const col = ci % 7;
                        const isTodayCell = cell.dateStr === todayStr;
                        const dayEvts = yearEvents.filter((ev) => eventCoversDate(ev, cell.dateStr));
                        const numColor = mob
                          ? !cell.isCurrentMonth
                            ? "#d1d5db"
                            : col === 0
                              ? "#EF4444"
                              : "var(--color-text-muted)"
                          : !cell.isCurrentMonth
                            ? "#d1d5db"
                            : col === 0
                              ? "#EF4444"
                              : col === 6
                                ? "#3B82F6"
                                : "var(--color-text-muted)";
                        return (
                          <div
                            key={`${cell.dateStr}-${ci}`}
                            title={
                              dayEvts.length > 0
                                ? dayEvts.map((ev) => `${eventDepartmentName(ev, departments)}: ${ev.title}`).join("\n")
                                : undefined
                            }
                            style={{
                              textAlign: "center",
                              fontSize: mob ? 5.5 : 10,
                              padding: mob ? "0.5px 0" : "3px 0",
                              color: numColor,
                              position: "relative",
                              lineHeight: mob ? 1.3 : 1.4,
                              display: "flex",
                              flexDirection: "column",
                              alignItems: "center",
                              justifyContent: "flex-start",
                              minHeight: 0,
                            }}
                          >
                            {isTodayCell ? (
                              <span
                                style={{
                                  width: mob ? 11 : 20,
                                  height: mob ? 11 : 20,
                                  borderRadius: "50%",
                                  background: "#4A90D9",
                                  color: "#fff",
                                  display: "inline-flex",
                                  alignItems: "center",
                                  justifyContent: "center",
                                  fontSize: mob ? 5.5 : 10,
                                  fontWeight: 700,
                                }}
                              >
                                {cell.day}
                              </span>
                            ) : (
                              <span style={{ color: numColor, fontSize: mob ? 5.5 : 10, fontWeight: 400 }}>{cell.day}</span>
                            )}
                            {dayEvts.length > 0 ? (
                              <div
                                style={{
                                  display: "flex",
                                  justifyContent: "center",
                                  gap: 2,
                                  marginTop: 1,
                                  flexWrap: "nowrap",
                                }}
                              >
                                {dayEvts.slice(0, 3).map((ev) => (
                                  <span
                                    key={ev.id}
                                    style={{
                                      width: mob ? 2 : 4,
                                      height: mob ? 2 : 4,
                                      borderRadius: "50%",
                                      background: eventDisplayColor(ev, departments),
                                      flexShrink: 0,
                                    }}
                                  />
                                ))}
                              </div>
                            ) : null}
                          </div>
                        );
                      })}
                    </div>
                  </button>
                );
              })}
            </div>
          </section>
        </div>
      )}

      {!loading && churchId && sidebarTab === "admin" && (
        <div style={{ display: "flex", flexDirection: "column", gap: 32, maxWidth: "100%" }}>
          <div
            style={{
              background: "var(--color-surface)",
              borderRadius: 20,
              padding: 24,
              boxShadow: "0 2px 16px rgba(0,0,0,0.06)",
            }}
          >
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16, flexWrap: "wrap", gap: 8 }}>
              <h3 style={{ fontSize: 18, fontWeight: 800, color: NAVY, margin: 0 }}>부서 관리</h3>
              <button
                type="button"
                onClick={() => {
                  setEditingDeptId(null);
                  setDeptForm({ name: "", color: String(COLOR_PRESETS[0]), leader_name: "" });
                  setDeptModalOpen(true);
                }}
                style={{
                  background: "var(--color-primary)",
                  color: "var(--color-primary-on)",
                  border: "none",
                  borderRadius: 12,
                  padding: "8px 16px",
                  fontWeight: 700,
                  cursor: "pointer",
                }}
              >
                부서 추가
              </button>
            </div>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 12 }}>
              {departments.map((d) => (
                <div
                  key={d.id}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    padding: "12px 16px",
                    borderRadius: 14,
                    border: "1.5px solid var(--color-border)",
                    background: "var(--color-surface-muted)",
                    flex: mob ? "1 1 100%" : "1 1 280px",
                    minWidth: mob ? "100%" : 200,
                    maxWidth: "100%",
                    boxSizing: "border-box",
                  }}
                >
                  <span style={{ width: 24, height: 24, borderRadius: "50%", background: d.color, marginRight: 12, flexShrink: 0 }} />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 15, fontWeight: 700, color: NAVY }}>{d.name}</div>
                    <div style={{ fontSize: 12, color: C.textFaint }}>{d.leader_name || "담당자 미지정"}</div>
                  </div>
                  <button
                    type="button"
                    aria-label="수정"
                    onClick={() => {
                      setEditingDeptId(d.id);
                      setDeptForm({ name: d.name, color: d.color, leader_name: d.leader_name ?? "" });
                      setDeptModalOpen(true);
                    }}
                    style={{ border: "none", background: "none", cursor: "pointer", padding: 8, color: C.textSub }}
                  >
                    <Pencil size={18} />
                  </button>
                  <button
                    type="button"
                    aria-label="삭제"
                    onClick={() => void handleDeleteDept(d.id)}
                    style={{ border: "none", background: "none", cursor: "pointer", padding: 8, color: "#EF4444" }}
                  >
                    <Trash2 size={18} />
                  </button>
                </div>
              ))}
            </div>
          </div>

          <div
            style={{
              background: "var(--color-surface)",
              borderRadius: 20,
              padding: 24,
              boxShadow: "0 2px 16px rgba(0,0,0,0.06)",
            }}
          >
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16, flexWrap: "wrap", gap: 8 }}>
              <h3 style={{ fontSize: 18, fontWeight: 800, color: NAVY, margin: 0 }}>장소 관리</h3>
              <button
                type="button"
                onClick={() => {
                  setEditingPlaceId(null);
                  setPlaceForm({ name: "", capacity: "", equipment: [] });
                  setPlaceModalOpen(true);
                }}
                style={{
                  background: "var(--color-primary)",
                  color: "var(--color-primary-on)",
                  border: "none",
                  borderRadius: 12,
                  padding: "8px 16px",
                  fontWeight: 700,
                  cursor: "pointer",
                }}
              >
                장소 추가
              </button>
            </div>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 12 }}>
              {places.map((p) => (
                <div
                  key={p.id}
                  style={{
                    display: "flex",
                    flexDirection: mob ? "column" : "row",
                    alignItems: mob ? "stretch" : "center",
                    gap: 10,
                    padding: "12px 16px",
                    borderRadius: 14,
                    border: "1.5px solid var(--color-border)",
                    background: "var(--color-surface-muted)",
                    flex: mob ? "1 1 100%" : "1 1 300px",
                    minWidth: mob ? "100%" : 220,
                    maxWidth: "100%",
                    boxSizing: "border-box",
                  }}
                >
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 15, fontWeight: 700, color: NAVY }}>{p.name}</div>
                    <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginTop: 8 }}>
                      <span style={{ fontSize: 11, padding: "4px 8px", borderRadius: 8, background: "color-mix(in srgb, var(--color-primary) 16%, var(--color-surface-elevated))", color: "var(--color-primary)", fontWeight: 600 }}>
                        수용 {p.capacity ?? "—"}
                      </span>
                      {(p.equipment ?? []).map((eq) => (
                        <span key={eq} style={{ fontSize: 11, padding: "4px 8px", borderRadius: 8, background: "var(--color-surface-elevated)", color: "var(--color-text-muted)" }}>
                          {eq}
                        </span>
                      ))}
                    </div>
                  </div>
                  <div style={{ display: "flex", gap: 4, justifyContent: "flex-end" }}>
                    <button
                      type="button"
                      aria-label="수정"
                      onClick={() => {
                        setEditingPlaceId(p.id);
                        setPlaceForm({
                          name: p.name,
                          capacity: p.capacity != null ? String(p.capacity) : "",
                          equipment: [...(p.equipment ?? [])],
                        });
                        setPlaceModalOpen(true);
                      }}
                      style={{ border: "none", background: "none", cursor: "pointer", padding: 8, color: C.textSub }}
                    >
                      <Pencil size={18} />
                    </button>
                    <button
                      type="button"
                      aria-label="삭제"
                      onClick={() => void handleDeletePlace(p.id)}
                      style={{ border: "none", background: "none", cursor: "pointer", padding: 8, color: "#EF4444" }}
                    >
                      <Trash2 size={18} />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* 이벤트 브리핑 모달 */}
      {briefingEvent && (
        <PcModalShell
          open
          overlayStyle={{ zIndex: 9999 }}
          title={briefingEvent.title}
          onClose={() => setBriefingEvent(null)}
          maxWidth={460}
          footer={
            <div style={{ display: "flex", gap: 8, width: "100%", alignItems: "center" }}>
              <button
                type="button"
                className="btn btn-primary"
                onClick={() => {
                  const ev = briefingEvent;
                  setBriefingEvent(null);
                  openEditEvent(ev);
                }}
                style={{ flex: 1 }}
              >
                수정
              </button>
              <button
                type="button"
                className="btn btn-secondary"
                onClick={async () => {
                  if (!confirm("이 일정을 삭제하시겠습니까?")) return;
                  if (!supabase) {
                    alert("삭제 실패: 연결을 확인하세요.");
                    return;
                  }
                  const { error } = await supabase.from(TB_EVENTS).delete().eq("id", briefingEvent.id);
                  if (error) {
                    alert("삭제 실패: " + error.message);
                    return;
                  }
                  setBriefingEvent(null);
                  await loadEvents();
                }}
                style={{ color: "#EF4444", borderColor: "#fecaca" }}
                aria-label="삭제"
              >
                삭제
              </button>
            </div>
          }
        >
            <div
              style={{
                background: briefingEvent.departments?.color || "#94a3b8",
                padding: mob ? "16px 14px 14px" : "18px 18px 16px",
                borderRadius: 12,
                marginBottom: 16,
              }}
            >
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 8,
                  marginBottom: 10,
                  flexWrap: "wrap",
                }}
              >
                {briefingEvent.departments?.name && (
                  <span
                    style={{
                      background: "rgba(255,255,255,0.25)",
                      color: "#fff",
                      fontSize: mob ? 11 : 12,
                      fontWeight: 600,
                      padding: "3px 10px",
                      borderRadius: 6,
                      wordBreak: "break-word",
                      overflowWrap: "break-word",
                      maxWidth: "100%",
                    }}
                  >
                    {briefingEvent.departments.name}
                  </span>
                )}
                {briefingEvent.event_type && (
                  <span
                    style={{
                      background: "rgba(255,255,255,0.15)",
                      color: "rgba(255,255,255,0.9)",
                      fontSize: mob ? 11 : 12,
                      fontWeight: 500,
                      padding: "3px 10px",
                      borderRadius: 6,
                      wordBreak: "break-word",
                      overflowWrap: "break-word",
                      maxWidth: "100%",
                    }}
                  >
                    {EVENT_TYPES.find((t) => t.value === briefingEvent.event_type)?.label ?? briefingEvent.event_type}
                  </span>
                )}
              </div>
            </div>

            <div
              style={{
                padding: mob ? "18px 18px 8px" : "22px 24px 8px",
                display: "flex",
                flexDirection: "column",
                gap: 0,
                minWidth: 0,
              }}
            >
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 12,
                  padding: "12px 0",
                  borderBottom: "1px solid #f0f0f0",
                  minWidth: 0,
                }}
              >
                <div
                  style={{
                    width: 32,
                    height: 32,
                    borderRadius: 8,
                    background: "#f1f5f9",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    flexShrink: 0,
                  }}
                >
                  <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden>
                    <rect x="1" y="2" width="14" height="13" rx="2" stroke="#64748b" strokeWidth="1.5" fill="none" />
                    <line x1="1" y1="6" x2="15" y2="6" stroke="#64748b" strokeWidth="1.5" />
                    <line x1="5" y1="1" x2="5" y2="3" stroke="#64748b" strokeWidth="1.5" strokeLinecap="round" />
                    <line x1="11" y1="1" x2="11" y2="3" stroke="#64748b" strokeWidth="1.5" strokeLinecap="round" />
                  </svg>
                </div>
                <div style={{ minWidth: 0, flex: 1 }}>
                  <div style={{ fontSize: mob ? 10 : 11, color: C.textFaint, fontWeight: 600, marginBottom: 1 }}>날짜</div>
                  <div
                    style={{
                      fontSize: mob ? 13 : 14,
                      color: C.text,
                      fontWeight: 600,
                      wordBreak: "break-word",
                      overflowWrap: "break-word",
                      maxWidth: "100%",
                    }}
                  >
                    {briefingEvent.start_date?.substring(0, 10)}
                    {briefingEvent.end_date &&
                      briefingEvent.end_date.substring(0, 10) !== briefingEvent.start_date?.substring(0, 10) && (
                        <span style={{ fontWeight: 400 }}> ~ {briefingEvent.end_date.substring(0, 10)}</span>
                      )}
                    {briefingEvent.is_all_day ? (
                      <span style={{ color: C.textFaint, fontSize: mob ? 11 : 12, fontWeight: 400, marginLeft: 6 }}>종일</span>
                    ) : (
                      briefingEvent.start_time && (
                        <span style={{ color: C.textSub, fontSize: mob ? 11 : 12, fontWeight: 400, marginLeft: 6 }}>
                          {String(briefingEvent.start_time).slice(0, 5)}
                          {briefingEvent.end_time && ` ~ ${String(briefingEvent.end_time).slice(0, 5)}`}
                        </span>
                      )
                    )}
                  </div>
                </div>
              </div>

              {(briefingEvent.place_name || briefingEvent.places?.name) && (
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 12,
                    padding: "12px 0",
                    borderBottom: "1px solid #f0f0f0",
                    minWidth: 0,
                  }}
                >
                  <div
                    style={{
                      width: 32,
                      height: 32,
                      borderRadius: 8,
                      background: "#f1f5f9",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      flexShrink: 0,
                    }}
                  >
                    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden>
                      <path
                        d="M8 1C5.24 1 3 3.24 3 6c0 3.75 5 9 5 9s5-5.25 5-9c0-2.76-2.24-5-5-5z"
                        stroke="#64748b"
                        strokeWidth="1.5"
                        fill="none"
                      />
                      <circle cx="8" cy="6" r="2" stroke="#64748b" strokeWidth="1.3" fill="none" />
                    </svg>
                  </div>
                  <div style={{ minWidth: 0, flex: 1 }}>
                    <div style={{ fontSize: mob ? 10 : 11, color: C.textFaint, fontWeight: 600, marginBottom: 1 }}>장소</div>
                    <div
                      style={{
                        fontSize: mob ? 13 : 14,
                        color: C.text,
                        fontWeight: 500,
                        wordBreak: "break-word",
                        overflowWrap: "break-word",
                        maxWidth: "100%",
                      }}
                    >
                      {briefingEvent.place_name || briefingEvent.places?.name}
                    </div>
                  </div>
                </div>
              )}

              {briefingEvent.expected_people != null && briefingEvent.expected_people !== "" && (
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 12,
                    padding: "12px 0",
                    borderBottom: "1px solid #f0f0f0",
                  }}
                >
                  <div
                    style={{
                      width: 32,
                      height: 32,
                      borderRadius: 8,
                      background: "#f1f5f9",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      flexShrink: 0,
                    }}
                  >
                    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden>
                      <circle cx="6" cy="5" r="2.5" stroke="#64748b" strokeWidth="1.5" fill="none" />
                      <path
                        d="M1.5 14c0-2.5 2-4.5 4.5-4.5s4.5 2 4.5 4.5"
                        stroke="#64748b"
                        strokeWidth="1.5"
                        strokeLinecap="round"
                        fill="none"
                      />
                      <circle cx="11.5" cy="5.5" r="1.8" stroke="#64748b" strokeWidth="1.2" fill="none" />
                      <path d="M11 9.5c1.5 0 3.5 1 3.5 3" stroke="#64748b" strokeWidth="1.2" strokeLinecap="round" fill="none" />
                    </svg>
                  </div>
                  <div>
                    <div style={{ fontSize: mob ? 10 : 11, color: C.textFaint, fontWeight: 600, marginBottom: 1 }}>예상 인원</div>
                    <div
                      style={{
                        fontSize: mob ? 13 : 14,
                        color: C.text,
                        fontWeight: 500,
                        wordBreak: "break-word",
                        overflowWrap: "break-word",
                        maxWidth: "100%",
                      }}
                    >
                      {briefingEvent.expected_people}명
                    </div>
                  </div>
                </div>
              )}

              {(() => {
                const rr = briefingEvent.recurrence_rule as string | null | undefined;
                const recurrenceLabel = rr ? RECURRENCE.find((r) => r.value === rr)?.label ?? rr : "";
                if (!rr || !recurrenceLabel || recurrenceLabel === "안함") return null;
                return (
                  <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 12,
                      padding: "12px 0",
                      borderBottom: "1px solid #f0f0f0",
                      minWidth: 0,
                    }}
                  >
                    <div
                      style={{
                        width: 32,
                        height: 32,
                        borderRadius: 8,
                        background: "#f1f5f9",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        flexShrink: 0,
                      }}
                    >
                      <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden>
                        <path d="M2 8a6 6 0 0 1 10.5-4" stroke="#64748b" strokeWidth="1.5" strokeLinecap="round" fill="none" />
                        <path d="M14 8a6 6 0 0 1-10.5 4" stroke="#64748b" strokeWidth="1.5" strokeLinecap="round" fill="none" />
                        <polyline
                          points="12,2 13,4.5 10.5,4.5"
                          stroke="#64748b"
                          strokeWidth="1.3"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          fill="none"
                        />
                        <polyline
                          points="4,14 3,11.5 5.5,11.5"
                          stroke="#64748b"
                          strokeWidth="1.3"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          fill="none"
                        />
                      </svg>
                    </div>
                    <div style={{ minWidth: 0, flex: 1 }}>
                      <div style={{ fontSize: mob ? 10 : 11, color: C.textFaint, fontWeight: 600, marginBottom: 1 }}>반복</div>
                      <div
                        style={{
                          fontSize: mob ? 13 : 14,
                          color: C.text,
                          fontWeight: 500,
                          wordBreak: "break-word",
                          overflowWrap: "break-word",
                          maxWidth: "100%",
                        }}
                      >
                        {recurrenceLabel}
                      </div>
                    </div>
                  </div>
                );
              })()}

              {(briefingEvent.memo || briefingEvent.description) && (
                <div style={{ padding: "12px 0", minWidth: 0 }}>
                  <div style={{ fontSize: mob ? 10 : 11, color: C.textFaint, fontWeight: 600, marginBottom: 6 }}>메모</div>
                  <div
                    style={{
                      fontSize: mob ? 13 : 14,
                      color: "#475569",
                      fontWeight: 400,
                      lineHeight: 1.6,
                      whiteSpace: "pre-wrap",
                      wordBreak: "break-word",
                      overflowWrap: "break-word",
                      maxWidth: "100%",
                      background: "#f8f9fc",
                      padding: "10px 12px",
                      borderRadius: 10,
                    }}
                  >
                    {briefingEvent.memo ?? briefingEvent.description}
                  </div>
                </div>
              )}
            </div>
        </PcModalShell>
      )}

      {eventModalOpen && (
        <PcModalShell
          open
          overlayStyle={{ zIndex: 9999 }}
          title={editingEventId ? "일정 수정" : "일정 추가"}
          onClose={() => {
            setEventModalOpen(false);
            resetEventForm();
          }}
          maxWidth={520}
        >
          <label style={plannerFieldLabel(mob)}>제목 *</label>
          <FieldInput
            mob={mob}
            value={eventForm.title}
            onChange={(v) => setEventForm((f) => ({ ...f, title: v }))}
            placeholder="일정 제목을 입력하세요"
          />
          <label style={plannerFieldLabel(mob)}>부서</label>
          <select
            value={eventForm.department_id}
            onChange={(e) => setEventForm((f) => ({ ...f, department_id: e.target.value }))}
            style={plannerFieldControl(mob)}
          >
            <option value="">부서 선택</option>
            {departments.filter((d) => d.is_active !== false).map((d) => (
              <option key={d.id} value={d.id}>
                {d.name}
              </option>
            ))}
          </select>
          <div>
            <label style={plannerFieldLabel(mob)}>일정 유형</label>
            {!useCustomEventType ? (
              <div style={{ display: "flex", gap: 6 }}>
                <select
                  value={EVENT_TYPES.some((t) => t.value === eventForm.event_type) ? eventForm.event_type : ""}
                  onChange={(e) => {
                    if (e.target.value === "__custom__") {
                      setUseCustomEventType(true);
                      setCustomEventType("");
                      setEventForm((f) => ({ ...f, event_type: "" }));
                    } else {
                      setEventForm((f) => ({ ...f, event_type: e.target.value }));
                    }
                  }}
                  style={{ ...plannerFieldControl(mob), flex: 1, marginBottom: 18 }}
                >
                  <option value="">유형 선택</option>
                  {EVENT_TYPES.map((t) => (
                    <option key={t.value} value={t.value}>
                      {t.label}
                    </option>
                  ))}
                  <option value="__custom__">✏️ 직접 입력</option>
                </select>
              </div>
            ) : (
              <div style={{ display: "flex", gap: 6, marginBottom: 18 }}>
                <input
                  type="text"
                  placeholder="유형을 입력하세요"
                  value={customEventType}
                  onChange={(e) => {
                    const v = e.target.value;
                    setCustomEventType(v);
                    setEventForm((f) => ({ ...f, event_type: v }));
                  }}
                  style={{ ...plannerFieldControl(mob), flex: 1, marginBottom: 0 }}
                />
                <button
                  type="button"
                  onClick={() => {
                    setUseCustomEventType(false);
                    setCustomEventType("");
                    setEventForm((f) => ({ ...f, event_type: "" }));
                  }}
                  style={{
                    background: "var(--color-surface-elevated)",
                    border: "1.5px solid var(--color-border)",
                    borderRadius: mob ? 8 : 10,
                    padding: "0 10px",
                    fontSize: mob ? 11 : 12,
                    color: C.textSub,
                    cursor: "pointer",
                    whiteSpace: "nowrap",
                    height: mob ? 38 : 44,
                    alignSelf: "flex-start",
                  }}
                >
                  목록
                </button>
              </div>
            )}
          </div>
          <label style={plannerFieldLabel(mob)}>시작일 *</label>
          <input
            type="date"
            value={eventForm.start_date}
            onChange={(e) => setEventForm((f) => ({ ...f, start_date: e.target.value }))}
            style={plannerFieldControl(mob)}
          />
          <label style={plannerFieldLabel(mob)}>종료일 (선택)</label>
          <input
            type="date"
            value={eventForm.end_date}
            onChange={(e) => setEventForm((f) => ({ ...f, end_date: e.target.value }))}
            style={plannerFieldControl(mob)}
          />
          <label
            style={{
              ...plannerFieldLabel(mob),
              display: "flex",
              alignItems: "center",
              gap: 8,
              cursor: "pointer",
            }}
          >
            <input
              type="checkbox"
              checked={eventForm.is_all_day}
              onChange={(e) => setEventForm((f) => ({ ...f, is_all_day: e.target.checked }))}
            />
            종일
          </label>
          {!eventForm.is_all_day && (
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 18 }}>
              <div>
                <label style={plannerFieldLabel(mob)}>시작 시간</label>
                <input
                  type="time"
                  value={eventForm.start_time}
                  onChange={(e) => setEventForm((f) => ({ ...f, start_time: e.target.value }))}
                  style={plannerFieldControl(mob)}
                />
              </div>
              <div>
                <label style={plannerFieldLabel(mob)}>종료 시간</label>
                <input
                  type="time"
                  value={eventForm.end_time}
                  onChange={(e) => setEventForm((f) => ({ ...f, end_time: e.target.value }))}
                  style={plannerFieldControl(mob)}
                />
              </div>
            </div>
          )}
          <div>
            <label style={plannerFieldLabel(mob)}>장소</label>
            {!useCustomPlace ? (
              <div style={{ display: "flex", gap: 6 }}>
                <select
                  value={eventForm.place_id || ""}
                  onChange={(e) => {
                    if (e.target.value === "__custom__") {
                      setUseCustomPlace(true);
                      setCustomPlace("");
                      setEventForm((f) => ({ ...f, place_id: "", place_name: "" }));
                    } else {
                      setEventForm((f) => ({ ...f, place_id: e.target.value, place_name: "" }));
                    }
                  }}
                  style={{ ...plannerFieldControl(mob), flex: 1, marginBottom: 18 }}
                >
                  <option value="">장소 선택</option>
                  {places
                    .filter((p) => p.is_active !== false)
                    .map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.name}
                      </option>
                    ))}
                  <option value="__custom__">✏️ 직접 입력</option>
                </select>
              </div>
            ) : (
              <div style={{ display: "flex", gap: 6, marginBottom: 18 }}>
                <input
                  type="text"
                  placeholder="장소를 입력하세요"
                  value={customPlace}
                  onChange={(e) => {
                    const v = e.target.value;
                    setCustomPlace(v);
                    setEventForm((f) => ({ ...f, place_id: "", place_name: v }));
                  }}
                  style={{ ...plannerFieldControl(mob), flex: 1, marginBottom: 0 }}
                />
                <button
                  type="button"
                  onClick={() => {
                    setUseCustomPlace(false);
                    setCustomPlace("");
                    setEventForm((f) => ({ ...f, place_name: "" }));
                  }}
                  style={{
                    background: "var(--color-surface-elevated)",
                    border: "1.5px solid var(--color-border)",
                    borderRadius: mob ? 8 : 10,
                    padding: "0 10px",
                    fontSize: mob ? 11 : 12,
                    color: C.textSub,
                    cursor: "pointer",
                    whiteSpace: "nowrap",
                    height: mob ? 38 : 44,
                    alignSelf: "flex-start",
                  }}
                >
                  목록
                </button>
              </div>
            )}
          </div>
          <label style={plannerFieldLabel(mob)}>반복</label>
          <select
            value={eventForm.recurrence_rule}
            onChange={(e) => setEventForm((f) => ({ ...f, recurrence_rule: e.target.value }))}
            style={plannerFieldControl(mob)}
          >
            {RECURRENCE.map((r) => (
              <option key={r.value || "x"} value={r.value}>
                {r.label}
              </option>
            ))}
          </select>
          <label style={plannerFieldLabel(mob)}>예상 인원</label>
          <input
            type="number"
            min={0}
            value={eventForm.expected_people}
            onChange={(e) => setEventForm((f) => ({ ...f, expected_people: e.target.value }))}
            style={plannerFieldControl(mob)}
          />
          <label style={plannerFieldLabel(mob)}>메모</label>
          <textarea
            rows={3}
            value={eventForm.description}
            onChange={(e) => setEventForm((f) => ({ ...f, description: e.target.value }))}
            style={{
              ...plannerFieldControl(mob),
              height: "auto",
              minHeight: mob ? 80 : 100,
              paddingTop: mob ? 10 : 14,
              paddingBottom: mob ? 10 : 14,
              resize: "vertical",
            }}
          />
          <button type="button" onClick={() => void handleSaveEvent()} style={plannerPrimaryButton(mob)}>
            저장
          </button>
          {editingEventId && (
            <button
              type="button"
              onClick={async () => {
                if (!confirm("이 일정을 삭제하시겠습니까?")) return;
                if (!supabase || !editingEventId) return;
                const { error } = await supabase.from("events").delete().eq("id", editingEventId);
                if (error) {
                  console.error("[planner] delete event:", error);
                  alert("삭제 실패");
                  return;
                }
                toast("삭제되었습니다.", "ok");
                setEventModalOpen(false);
                resetEventForm();
                await loadEvents();
              }}
              style={{
                width: "100%",
                height: mob ? 40 : 44,
                background: "var(--color-surface)",
                color: "var(--color-danger)",
                border: "1.5px solid color-mix(in srgb, var(--color-danger) 34%, var(--color-border))",
                borderRadius: 14,
                fontSize: mob ? 13 : 14,
                fontWeight: 600,
                cursor: "pointer",
                marginTop: 8,
              }}
            >
              이 일정 삭제
            </button>
          )}
          <button
            type="button"
            onClick={() => {
              setEventModalOpen(false);
              resetEventForm();
            }}
            style={btnGhost}
          >
            취소
          </button>
        </PcModalShell>
      )}

      {deptModalOpen && (
        <PcModalShell
          open
          overlayStyle={{ zIndex: 9999 }}
          title={editingDeptId ? "부서 수정" : "부서 추가"}
          onClose={() => {
            setDeptModalOpen(false);
            setEditingDeptId(null);
          }}
          maxWidth={480}
        >
          <label style={lbl}>부서명 *</label>
          <FieldInput value={deptForm.name} onChange={(v) => setDeptForm((f) => ({ ...f, name: v }))} placeholder="부서명" />
          <label style={lbl}>색상</label>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 10, marginBottom: 18 }}>
            {COLOR_PRESETS.map((c) => (
              <button
                key={c}
                type="button"
                onClick={() => setDeptForm((f) => ({ ...f, color: c }))}
                style={{
                  width: 32,
                  height: 32,
                  borderRadius: "50%",
                  background: c,
                  border: deptForm.color === c ? `3px solid ${NAVY}` : "2px solid #e8e9f0",
                  cursor: "pointer",
                  padding: 0,
                }}
              />
            ))}
          </div>
          <label style={lbl}>담당자</label>
          <FieldInput
            value={deptForm.leader_name}
            onChange={(v) => setDeptForm((f) => ({ ...f, leader_name: v }))}
            placeholder="담당자 이름 (선택)"
          />
          <button type="button" onClick={() => void handleSaveDept()} style={btnPrimary}>
            저장
          </button>
          <button
            type="button"
            onClick={() => {
              setDeptModalOpen(false);
              setEditingDeptId(null);
            }}
            style={btnGhost}
          >
            취소
          </button>
        </PcModalShell>
      )}

      {placeModalOpen && (
        <PcModalShell
          open
          overlayStyle={{ zIndex: 9999 }}
          title={editingPlaceId ? "장소 수정" : "장소 추가"}
          onClose={() => {
            setPlaceModalOpen(false);
            setEditingPlaceId(null);
          }}
          maxWidth={480}
        >
          <label style={lbl}>장소명 *</label>
          <FieldInput value={placeForm.name} onChange={(v) => setPlaceForm((f) => ({ ...f, name: v }))} placeholder="장소명" />
          <label style={lbl}>수용 인원</label>
          <input
            type="number"
            min={0}
            value={placeForm.capacity}
            onChange={(e) => setPlaceForm((f) => ({ ...f, capacity: e.target.value }))}
            style={sel}
          />
          <label style={lbl}>장비</label>
          <div style={{ marginBottom: 18 }}>
            {EQUIPMENT_OPTS.map((x) => (
              <label key={x} style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8, fontSize: 14, color: "#475569" }}>
                <input
                  type="checkbox"
                  checked={placeForm.equipment.includes(x)}
                  onChange={() =>
                    setPlaceForm((f) => ({
                      ...f,
                      equipment: f.equipment.includes(x) ? f.equipment.filter((e) => e !== x) : [...f.equipment, x],
                    }))
                  }
                />
                {x}
              </label>
            ))}
          </div>
          <button type="button" onClick={() => void handleSavePlace()} style={btnPrimary}>
            저장
          </button>
          <button
            type="button"
            onClick={() => {
              setPlaceModalOpen(false);
              setEditingPlaceId(null);
            }}
            style={btnGhost}
          >
            취소
          </button>
        </PcModalShell>
      )}

      {moreModal && (
        <PcModalShell open overlayStyle={{ zIndex: 9999 }} title="일정 목록" onClose={() => setMoreModal(null)} maxWidth={480}>
          <p style={{ fontSize: 15, fontWeight: 700, color: NAVY, margin: "0 0 16px" }}>
            {moreModal.y}년 {moreModal.m}월 {moreModal.d}일
          </p>
          {moreModal.list.map((ev) => (
            <button
              key={ev.id}
              type="button"
              onClick={() => {
                setMoreModal(null);
                openEditEvent(ev);
              }}
              style={{
                display: "block",
                width: "100%",
                textAlign: "left",
                padding: "12px 14px",
                marginBottom: 8,
                borderRadius: 12,
                border: "1px solid var(--color-border)",
                background: "#fafafa",
                cursor: "pointer",
                fontWeight: 600,
              }}
            >
              {ev.title}
            </button>
          ))}
        </PcModalShell>
      )}

      {showLegendModal && mob && (
        <PcModalShell
          open
          overlayStyle={{ zIndex: 9999 }}
          title="부서 색상"
          onClose={() => setShowLegendModal(false)}
          maxWidth={320}
        >
          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            {departments
              .filter((d) => d.is_active !== false)
              .map((dept) => (
                <div
                  key={dept.id}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 10,
                    padding: "7px 0",
                    borderBottom: "1px solid #f5f5f5",
                  }}
                >
                  <span
                    style={{
                      width: 10,
                      height: 10,
                      borderRadius: "50%",
                      background: dept.color || "#94a3b8",
                      flexShrink: 0,
                    }}
                  />
                  <span style={{ fontSize: 13, color: "#334155", fontWeight: 500 }}>{dept.name}</span>
                </div>
              ))}
          </div>
        </PcModalShell>
      )}
    </UnifiedPageLayout>
  );
}

function plannerFieldLabel(mob: boolean): CSSProperties {
  return {
    fontSize: mob ? 12 : 13,
    fontWeight: 600,
    color: "var(--color-text-muted)",
    marginBottom: 6,
    display: "block",
  };
}

function plannerFieldControl(mob: boolean): CSSProperties {
  return {
    width: "100%",
    height: mob ? 38 : 44,
    fontSize: mob ? 13 : 14,
    padding: mob ? "0 10px" : "0 14px",
    borderRadius: mob ? 8 : 10,
    border: "1.5px solid var(--color-border)",
    boxSizing: "border-box",
    outline: "none",
    marginBottom: 18,
    background: "var(--color-surface-elevated)",
    color: C.text,
  };
}

function plannerPrimaryButton(mob: boolean): CSSProperties {
  return {
    width: "100%",
    height: mob ? 42 : 48,
    background: "var(--color-primary)",
    color: "var(--color-primary-on)",
    borderRadius: mob ? 10 : 14,
    fontSize: mob ? 14 : 15,
    fontWeight: 700,
    cursor: "pointer",
    border: "none",
    marginTop: 8,
  };
}

const lbl: CSSProperties = {
  fontSize: 13,
  fontWeight: 700,
  color: "var(--color-text-muted)",
  marginBottom: 6,
  display: "block",
};

const sel: CSSProperties = {
  width: "100%",
  height: 44,
  fontSize: 14,
  border: "1.5px solid var(--color-border)",
  borderRadius: 12,
  padding: "0 14px",
  boxSizing: "border-box",
  outline: "none",
  marginBottom: 18,
};

const btnPrimary: CSSProperties = {
  width: "100%",
  height: 48,
  background: "var(--color-primary)",
  color: "var(--color-primary-on)",
  borderRadius: 14,
  fontSize: 16,
  fontWeight: 700,
  cursor: "pointer",
  border: "none",
  marginTop: 8,
};

const btnGhost: CSSProperties = {
  width: "100%",
  height: 44,
  background: "transparent",
  color: C.textSub,
  border: "1.5px solid var(--color-border)",
  borderRadius: 14,
  fontSize: 14,
  marginTop: 8,
  cursor: "pointer",
};

function FieldInput({
  value,
  onChange,
  placeholder,
  mob = false,
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  mob?: boolean;
}) {
  const [focus, setFocus] = useState(false);
  return (
    <input
      value={value}
      placeholder={placeholder}
      onChange={(e) => onChange(e.target.value)}
      onFocus={() => setFocus(true)}
      onBlur={() => setFocus(false)}
      style={{
        ...plannerFieldControl(mob),
        borderColor: focus ? "var(--color-primary)" : "var(--color-border)",
      }}
    />
  );
}
