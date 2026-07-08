"use client";

import React, { createContext, useContext, useState, useEffect, useCallback, useRef, useMemo, startTransition } from "react";
import type { DB, SchoolDepartment, SchoolClass, SchoolEnrollment, Workflow, WorkflowStep, WorkflowCard, CeremonyTemplate, CeremonyStep, CeremonySession } from "@/types/db";
import { DEFAULT_DB } from "@/types/db";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/contexts/AuthContext";
import { loadDBFromSupabase, saveDBToSupabase, toMember, toVisit, toIncome, toExpense, toNewFamilyProgram, toPlan, toSermon } from "@/lib/supabase-db";
import { getAttendanceLoadMinYear } from "@/lib/attendance-utils";

/** attendance 등 대량 테이블은 여러 페이지 fetch로 10초를 넘길 수 있음 */
const REFRESH_TIMEOUT_MS = 120000;

function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  return Promise.race([
    promise,
    new Promise<T>((_, reject) => setTimeout(() => reject(new Error("timeout")), ms)),
  ]);
}

/** Realtime 이벤트를 모아 한 번에 처리 (테이블별 500ms 타이머 난립 방지) */
const REALTIME_COALESCE_MS = 2000;

function createCoalescedTableRefresh(run: (table: string) => void, ms: number) {
  const pending = new Set<string>();
  let timer: ReturnType<typeof setTimeout> | null = null;
  let paused = false;

  const flush = () => {
    timer = null;
    if (paused) {
      timer = setTimeout(flush, ms);
      return;
    }
    const tables = Array.from(pending);
    pending.clear();
    const order = ["settings", "budget", "members", "notes", "visits", "income", "expense", "attendance"];
    tables
      .sort((a, b) => {
        const ai = order.indexOf(a);
        const bi = order.indexOf(b);
        return (ai === -1 ? 99 : ai) - (bi === -1 ? 99 : bi);
      })
      .forEach((table) => run(table));
  };

  const schedule = (table: string) => {
    pending.add(table);
    if (timer) clearTimeout(timer);
    timer = setTimeout(flush, ms);
  };

  return {
    schedule,
    setPaused(value: boolean) {
      paused = value;
      if (!paused && pending.size > 0 && !timer) {
        timer = setTimeout(flush, 0);
      }
    },
    dispose() {
      if (timer) clearTimeout(timer);
      timer = null;
      pending.clear();
    },
  };
}

export interface RawAttendanceRow {
  member_id: string;
  date: string;
  week_num?: number;
  year?: number;
  service_type?: string;
  status: string;
  note?: string;
  check_in_time?: string;
  check_in_method?: string;
}

interface AppDataContextType {
  db: DB;
  setDb: React.Dispatch<React.SetStateAction<DB>>;
  saveDb: (d: DB) => Promise<void>;
  loading: boolean;
  loadError: boolean;

  rawAttendance: RawAttendanceRow[];
  schoolDepartments: SchoolDepartment[];
  schoolClasses: SchoolClass[];
  schoolEnrollments: SchoolEnrollment[];

  workflows: Workflow[];
  workflowSteps: WorkflowStep[];
  workflowCards: WorkflowCard[];

  ceremonyTemplates: CeremonyTemplate[];
  ceremonySteps: CeremonyStep[];
  ceremonySessions: CeremonySession[];

  refreshAll: () => Promise<void>;
  refreshMembers: () => Promise<void>;
  refreshAttendance: () => Promise<void>;
  refreshNotes: () => Promise<void>;
  refreshVisits: () => Promise<void>;
  refreshIncome: () => Promise<void>;
  refreshExpense: () => Promise<void>;
  refreshNewFamilyPrograms: () => Promise<void>;
  refreshPlans: () => Promise<void>;
  refreshSermons: () => Promise<void>;
  refreshSettings: () => Promise<void>;
  refreshBudget: () => Promise<void>;
  refreshSchoolDepartments: () => Promise<void>;
  refreshSchoolClasses: () => Promise<void>;
  refreshSchoolEnrollments: () => Promise<void>;
  refreshWorkflows: () => Promise<void>;
  refreshWorkflowSteps: () => Promise<void>;
  refreshWorkflowCards: () => Promise<void>;
  refreshCeremonyTemplates: () => Promise<void>;
  refreshCeremonySteps: () => Promise<void>;
  refreshCeremonySessions: () => Promise<void>;
}

const AppDataContext = createContext<AppDataContextType | null>(null);

export function useAppData() {
  const ctx = useContext(AppDataContext);
  if (!ctx) throw new Error("useAppData must be used within AppDataProvider");
  return ctx;
}

const CURRENT_YEAR = new Date().getFullYear();

export function AppDataProvider({ children }: { children: React.ReactNode }) {
  const { churchId } = useAuth();
  const [db, setDb] = useState<DB>(() => DEFAULT_DB);
  const [coreLoading, setCoreLoading] = useState(true);
  const [bgLoading, setBgLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [rawAttendance, setRawAttendance] = useState<RawAttendanceRow[]>([]);
  const [schoolDepartments, setSchoolDepartments] = useState<SchoolDepartment[]>([]);
  const [schoolClasses, setSchoolClasses] = useState<SchoolClass[]>([]);
  const [schoolEnrollments, setSchoolEnrollments] = useState<SchoolEnrollment[]>([]);
  const [workflows, setWorkflows] = useState<Workflow[]>([]);
  const [workflowSteps, setWorkflowSteps] = useState<WorkflowStep[]>([]);
  const [workflowCards, setWorkflowCards] = useState<WorkflowCard[]>([]);
  const [ceremonyTemplates, setCeremonyTemplates] = useState<CeremonyTemplate[]>([]);
  const [ceremonySteps, setCeremonySteps] = useState<CeremonyStep[]>([]);
  const [ceremonySessions, setCeremonySessions] = useState<CeremonySession[]>([]);
  const channelRef = useRef<any>(null);
  const churchIdRef = useRef(churchId);
  const partialRefreshInflightRef = useRef(new Set<string>());
  const coalescedRefreshRef = useRef<ReturnType<typeof createCoalescedTableRefresh> | null>(null);
  churchIdRef.current = churchId;

  const loading = coreLoading;

  const partialRefresh = useCallback(async (table: string) => {
    const cid = churchIdRef.current;
    if (!cid || !supabase) return;
    if (partialRefreshInflightRef.current.has(table)) return;
    partialRefreshInflightRef.current.add(table);

    try {
      if (table === "members") {
        const { data } = await supabase.from("members").select("*").eq("church_id", cid).order("created_at", { ascending: true });
        if (data) {
          startTransition(() => {
            setDb((prev) => ({ ...prev, members: data.map((r: Record<string, unknown>) => toMember(r)) }));
          });
        }
      } else if (table === "attendance") {
        const PAGE_SIZE = 1000;
        const minYear = getAttendanceLoadMinYear();
        const allRows: RawAttendanceRow[] = [];
        let from = 0;
        while (true) {
          const { data, error } = await supabase
            .from("attendance")
            .select("*")
            .eq("church_id", cid)
            .gte("year", minYear)
            .range(from, from + PAGE_SIZE - 1);
          if (error) {
            console.warn("[AppData] attendance fetch error:", error.message);
            break;
          }
          if (!data || data.length === 0) break;
          allRows.push(...(data as RawAttendanceRow[]));
          if (data.length < PAGE_SIZE) break;
          from += PAGE_SIZE;
          if (from > 200000) break;
        }
        const attendance: DB["attendance"] = {};
        const attendanceReasons: NonNullable<DB["attendanceReasons"]> = {};
        allRows.forEach((r: any) => {
          const mid = r.member_id as string;
          const week = r.week_num as number;
          if (!attendance[mid]) attendance[mid] = {};
          const status = r.status as string;
          attendance[mid][week] = (status === "p" || status === "a" || status === "n" ? status : "n") as any;
          const absentNote = String(r.note ?? r.reason ?? "").trim();
          if (absentNote) {
            if (!attendanceReasons[mid]) attendanceReasons[mid] = {};
            attendanceReasons[mid][week] = absentNote;
          }
        });
        startTransition(() => {
          setRawAttendance(allRows);
          setDb((prev) => ({ ...prev, attendance, attendanceReasons }));
        });
      } else if (table === "notes") {
        const { data } = await supabase.from("notes").select("*").eq("church_id", cid);
        if (data) {
          const notes: DB["notes"] = {};
          const answeredPrayerKeys: string[] = [];
          const answeredPrayerDates: Record<string, string> = {};
          const answeredPrayerComments: Record<string, string> = {};
          const answeredPrayerByNoteId: Record<string, { answeredAt: string; comment?: string }> = {};
          data.forEach((r: any) => {
            const mid = r.member_id as string;
            if (!notes[mid]) notes[mid] = [];
            const createdAt = r.created_at || "";
            const noteId = r.id as string | number | undefined;
            const answered = r.answered === true || Boolean(r.answered_at);
            const answeredAt = r.answered_at ? String(r.answered_at).slice(0, 10) : undefined;
            const answeredComment = r.answered_comment ? String(r.answered_comment) : undefined;
            notes[mid].push({
              id: noteId,
              date: r.date || "",
              type: r.type || "memo",
              content: r.content || "",
              createdAt,
              answered,
              answeredAt,
              answeredComment,
            });
            if (r.type === "prayer" && answered && noteId != null) {
              const key = `id\t${String(noteId)}`;
              answeredPrayerKeys.push(key);
              if (answeredAt) answeredPrayerDates[key] = answeredAt;
              if (answeredComment) answeredPrayerComments[key] = answeredComment;
              answeredPrayerByNoteId[String(noteId)] = {
                answeredAt: answeredAt || String(createdAt).slice(0, 10),
                ...(answeredComment ? { comment: answeredComment } : {}),
              };
            }
          });
          startTransition(() => {
            setDb((prev) => {
              // localStorage에만 남은 응답완료를 DB(false) 위에 보강
              const fromStorage =
                typeof window !== "undefined" && cid
                  ? (() => {
                      try {
                        const raw = localStorage.getItem(`church_solution_answered_prayers_${cid}`);
                        if (!raw) return {} as Record<string, { answeredAt: string; comment?: string }>;
                        const parsed = JSON.parse(raw) as Record<string, { answeredAt: string; comment?: string } | string>;
                        const out: Record<string, { answeredAt: string; comment?: string }> = {};
                        for (const [id, v] of Object.entries(parsed || {})) {
                          if (typeof v === "string") out[id] = { answeredAt: v };
                          else if (v && typeof v === "object" && typeof v.answeredAt === "string") out[id] = v;
                        }
                        return out;
                      } catch {
                        return {};
                      }
                    })()
                  : {};

              const byNoteId = { ...fromStorage, ...answeredPrayerByNoteId };
              const keys = new Set<string>([...Object.keys(byNoteId).map((id) => `id\t${id}`)]);
              const dates = { ...answeredPrayerDates };
              const comments = { ...answeredPrayerComments };
              for (const [id, rec] of Object.entries(byNoteId)) {
                const k = `id\t${id}`;
                dates[k] = rec.answeredAt;
                if (rec.comment) comments[k] = rec.comment;
              }

              // 스토리지에만 남은 응답을 DB에 다시 심어 복구
              if (supabase && cid) {
                for (const [id, rec] of Object.entries(fromStorage)) {
                  if (answeredPrayerByNoteId[id]) continue;
                  void supabase
                    .from("notes")
                    .update({
                      answered: true,
                      answered_at: rec.answeredAt || null,
                      ...(rec.comment ? { answered_comment: rec.comment } : {}),
                    })
                    .eq("church_id", cid)
                    .eq("id", id);
                }
              }

              return {
                ...prev,
                notes,
                answeredPrayerKeys: [...keys],
                answeredPrayerDates: dates,
                answeredPrayerComments: comments,
                answeredPrayerByNoteId: byNoteId,
              };
            });
          });
        }
      } else if (table === "visits") {
        const { data } = await supabase.from("visits").select("*").eq("church_id", cid).order("date", { ascending: false });
        if (data) {
          startTransition(() => {
            setDb((prev) => ({ ...prev, visits: data.map((r: any) => toVisit(r)) }));
          });
        }
      } else if (table === "income") {
        const PAGE_SIZE = 1000;
        let allRows: any[] = [];
        let from = 0;
        while (true) {
          const { data, error } = await supabase
            .from("income")
            .select("*")
            .eq("church_id", cid)
            .order("date", { ascending: false })
            .range(from, from + PAGE_SIZE - 1);
          if (error) {
            console.warn("[AppData] income fetch error:", error.message);
            break;
          }
          if (!data || data.length === 0) break;
          allRows = allRows.concat(data);
          if (data.length < PAGE_SIZE) break;
          from += PAGE_SIZE;
          if (from > 200000) break;
        }
        const data = allRows;
        if (data) {
          startTransition(() => {
            setDb((prev) => ({ ...prev, income: data.map((r: any) => toIncome(r)) }));
          });
        }
      } else if (table === "expense") {
        const PAGE_SIZE = 1000;
        let allRows: any[] = [];
        let from = 0;
        while (true) {
          const { data, error } = await supabase
            .from("expense")
            .select("*")
            .eq("church_id", cid)
            .order("date", { ascending: false })
            .range(from, from + PAGE_SIZE - 1);
          if (error) {
            console.warn("[AppData] expense fetch error:", error.message);
            break;
          }
          if (!data || data.length === 0) break;
          allRows = allRows.concat(data);
          if (data.length < PAGE_SIZE) break;
          from += PAGE_SIZE;
          if (from > 200000) break;
        }
        const data = allRows;
        if (data) {
          startTransition(() => {
            setDb((prev) => ({ ...prev, expense: data.map((r: any) => toExpense(r)) }));
          });
        }
      } else if (table === "new_family_program") {
        const { data } = await supabase.from("new_family_program").select("*").eq("church_id", cid);
        if (data) {
          startTransition(() => {
            setDb((prev) => ({ ...prev, newFamilyPrograms: data.map((r: any) => toNewFamilyProgram(r)) }));
          });
        }
      } else if (table === "plans") {
        const { data } = await supabase.from("plans").select("*").eq("church_id", cid).order("date", { ascending: true });
        if (data) {
          startTransition(() => {
            setDb((prev) => ({ ...prev, plans: data.map((r: any) => toPlan(r)) }));
          });
        }
      } else if (table === "sermons") {
        const { data } = await supabase.from("sermons").select("*").eq("church_id", cid).order("date", { ascending: false });
        if (data) {
          startTransition(() => {
            setDb((prev) => ({ ...prev, sermons: data.map((r: any) => toSermon(r)) }));
          });
        }
      } else if (table === "settings") {
        const { data } = await supabase.from("settings").select("*").eq("church_id", cid).limit(1);
        if (data?.[0]) {
          const s = data[0] as Record<string, unknown>;
          startTransition(() => {
            setDb((prev) => ({
              ...prev,
              settings: {
                churchName: (s.church_name as string) ?? prev.settings.churchName,
                depts: (s.depts as string) ?? prev.settings.depts,
                fiscalStart: (s.fiscal_start as string) ?? prev.settings.fiscalStart,
                denomination: (s.denomination as string | undefined) ?? prev.settings.denomination,
                baptismTerminology: (() => {
                  const raw = s.baptism_terminology as string | undefined;
                  if (raw === "chimrye" || raw === "seryae") return raw;
                  return prev.settings.baptismTerminology ?? "auto";
                })(),
                address: (s.address as string | undefined) ?? prev.settings.address,
                pastor: (s.pastor as string | undefined) ?? prev.settings.pastor,
                businessNumber: (s.business_number as string | undefined) ?? prev.settings.businessNumber,
              },
            }));
          });
        }
      } else if (table === "budget") {
        const { data } = await supabase.from("budget").select("*").eq("church_id", cid).eq("fiscal_year", String(CURRENT_YEAR));
        if (data) {
          const budget: Record<string, number> = {};
          data.forEach((r: any) => {
            if (r.fiscal_year != null && r.category_type != null && r.category != null) {
              budget[`${r.category_type}:${r.category}`] = Number(r.annual_total) ?? 0;
            } else if (r.category != null) {
              budget[r.category as string] = Number(r.annual_total ?? r.amount) ?? 0;
            }
          });
          startTransition(() => {
            setDb((prev) => ({ ...prev, budget }));
          });
        }
      } else if (table === "school_departments") {
        const { data } = await supabase.from("school_departments").select("*").eq("church_id", cid).order("sort_order");
        if (data) setSchoolDepartments(data as SchoolDepartment[]);
      } else if (table === "school_classes") {
        const { data } = await supabase.from("school_classes").select("*").eq("church_id", cid).order("sort_order");
        if (data) setSchoolClasses(data as SchoolClass[]);
      } else if (table === "school_enrollments") {
        const { data } = await supabase.from("school_enrollments").select("*").eq("church_id", cid).eq("is_active", true);
        if (data) setSchoolEnrollments(data as SchoolEnrollment[]);
      } else if (table === "workflows") {
        const { data } = await supabase.from("workflows").select("*").eq("church_id", cid).order("created_at", { ascending: true });
        if (data) setWorkflows(data as Workflow[]);
      } else if (table === "workflow_steps") {
        const { data } = await supabase.from("workflow_steps").select("*").eq("church_id", cid).order("sort_order", { ascending: true });
        if (data) setWorkflowSteps(data as WorkflowStep[]);
      } else if (table === "workflow_cards") {
        const { data } = await supabase.from("workflow_cards").select("*").eq("church_id", cid).order("moved_to_step_at", { ascending: false });
        if (data) setWorkflowCards(data as WorkflowCard[]);
      } else if (table === "ceremony_templates") {
        const { data } = await supabase.from("ceremony_templates").select("*").order("is_system", { ascending: false }).order("sort_order", { ascending: true }).order("name", { ascending: true });
        if (data) setCeremonyTemplates(data as CeremonyTemplate[]);
      } else if (table === "ceremony_steps") {
        const { data } = await supabase.from("ceremony_steps").select("*").order("template_id", { ascending: true }).order("step_order", { ascending: true });
        if (data) setCeremonySteps(data as CeremonyStep[]);
      } else if (table === "ceremony_sessions") {
        const { data } = await supabase.from("ceremony_sessions").select("*").eq("church_id", cid).order("scheduled_at", { ascending: false, nullsFirst: false }).order("created_at", { ascending: false });
        if (data) setCeremonySessions(data as CeremonySession[]);
      }
    } catch (e) {
      console.error(`[AppData] partial refresh ${table} failed:`, e);
    } finally {
      partialRefreshInflightRef.current.delete(table);
    }
  }, []);

  const refreshMembers = useCallback(async () => {
    try {
      await withTimeout(partialRefresh("members"), REFRESH_TIMEOUT_MS);
    } catch (e) {
      console.error("[AppData] members timeout or error:", e);
    }
  }, [partialRefresh]);
  const refreshAttendance = useCallback(async () => {
    try {
      await withTimeout(partialRefresh("attendance"), REFRESH_TIMEOUT_MS);
    } catch (e) {
      console.error("[AppData] attendance timeout or error:", e);
    }
  }, [partialRefresh]);
  const refreshNotes = useCallback(async () => {
    try {
      await withTimeout(partialRefresh("notes"), REFRESH_TIMEOUT_MS);
    } catch (e) {
      console.error("[AppData] notes timeout or error:", e);
    }
  }, [partialRefresh]);
  const refreshVisits = useCallback(async () => {
    try {
      await withTimeout(partialRefresh("visits"), REFRESH_TIMEOUT_MS);
    } catch (e) {
      console.error("[AppData] visits timeout or error:", e);
    }
  }, [partialRefresh]);
  const refreshIncome = useCallback(async () => {
    try {
      await withTimeout(partialRefresh("income"), REFRESH_TIMEOUT_MS);
    } catch (e) {
      console.error("[AppData] income timeout or error:", e);
    }
  }, [partialRefresh]);
  const refreshExpense = useCallback(async () => {
    try {
      await withTimeout(partialRefresh("expense"), REFRESH_TIMEOUT_MS);
    } catch (e) {
      console.error("[AppData] expense timeout or error:", e);
    }
  }, [partialRefresh]);
  const refreshNewFamilyPrograms = useCallback(async () => {
    try {
      await withTimeout(partialRefresh("new_family_program"), REFRESH_TIMEOUT_MS);
    } catch (e) {
      console.error("[AppData] new_family_program timeout or error:", e);
    }
  }, [partialRefresh]);
  const refreshPlans = useCallback(async () => {
    try {
      await withTimeout(partialRefresh("plans"), REFRESH_TIMEOUT_MS);
    } catch (e) {
      console.error("[AppData] plans timeout or error:", e);
    }
  }, [partialRefresh]);
  const refreshSermons = useCallback(async () => {
    try {
      await withTimeout(partialRefresh("sermons"), REFRESH_TIMEOUT_MS);
    } catch (e) {
      console.error("[AppData] sermons timeout or error:", e);
    }
  }, [partialRefresh]);
  const refreshSettings = useCallback(async () => {
    try {
      await withTimeout(partialRefresh("settings"), REFRESH_TIMEOUT_MS);
    } catch (e) {
      console.error("[AppData] settings timeout or error:", e);
    }
  }, [partialRefresh]);
  const refreshBudget = useCallback(async () => {
    try {
      await withTimeout(partialRefresh("budget"), REFRESH_TIMEOUT_MS);
    } catch (e) {
      console.error("[AppData] budget timeout or error:", e);
    }
  }, [partialRefresh]);
  const refreshSchoolDepartments = useCallback(async () => {
    try {
      await withTimeout(partialRefresh("school_departments"), REFRESH_TIMEOUT_MS);
    } catch (e) {
      console.error("[AppData] school_departments timeout or error:", e);
    }
  }, [partialRefresh]);
  const refreshSchoolClasses = useCallback(async () => {
    try {
      await withTimeout(partialRefresh("school_classes"), REFRESH_TIMEOUT_MS);
    } catch (e) {
      console.error("[AppData] school_classes timeout or error:", e);
    }
  }, [partialRefresh]);
  const refreshSchoolEnrollments = useCallback(async () => {
    try {
      await withTimeout(partialRefresh("school_enrollments"), REFRESH_TIMEOUT_MS);
    } catch (e) {
      console.error("[AppData] school_enrollments timeout or error:", e);
    }
  }, [partialRefresh]);
  const refreshWorkflows = useCallback(async () => {
    try {
      await withTimeout(partialRefresh("workflows"), REFRESH_TIMEOUT_MS);
    } catch (e) {
      console.error("[AppData] workflows timeout or error:", e);
    }
  }, [partialRefresh]);
  const refreshWorkflowSteps = useCallback(async () => {
    try {
      await withTimeout(partialRefresh("workflow_steps"), REFRESH_TIMEOUT_MS);
    } catch (e) {
      console.error("[AppData] workflow_steps timeout or error:", e);
    }
  }, [partialRefresh]);
  const refreshWorkflowCards = useCallback(async () => {
    try {
      await withTimeout(partialRefresh("workflow_cards"), REFRESH_TIMEOUT_MS);
    } catch (e) {
      console.error("[AppData] workflow_cards timeout or error:", e);
    }
  }, [partialRefresh]);
  const refreshCeremonyTemplates = useCallback(async () => {
    try {
      await withTimeout(partialRefresh("ceremony_templates"), REFRESH_TIMEOUT_MS);
    } catch (e) {
      console.error("[AppData] ceremony_templates timeout or error:", e);
    }
  }, [partialRefresh]);
  const refreshCeremonySteps = useCallback(async () => {
    try {
      await withTimeout(partialRefresh("ceremony_steps"), REFRESH_TIMEOUT_MS);
    } catch (e) {
      console.error("[AppData] ceremony_steps timeout or error:", e);
    }
  }, [partialRefresh]);
  const refreshCeremonySessions = useCallback(async () => {
    try {
      await withTimeout(partialRefresh("ceremony_sessions"), REFRESH_TIMEOUT_MS);
    } catch (e) {
      console.error("[AppData] ceremony_sessions timeout or error:", e);
    }
  }, [partialRefresh]);

  const refreshCore = useCallback(async () => {
    const cid = churchIdRef.current;
    if (!cid) return;
    setCoreLoading(true);
    setLoadError(false);
    try {
      await Promise.all([refreshMembers(), refreshSettings()]);
      setLoadError(false);
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "데이터 로딩 실패";
      console.error("[AppData] core load error:", e);
      setLoadError(true);
    } finally {
      setCoreLoading(false);
    }
  }, [refreshMembers, refreshSettings]);

  const refreshBackground = useCallback(async () => {
    const cid = churchIdRef.current;
    if (!cid) return;
    setBgLoading(true);
    try {
      await Promise.all([
        refreshAttendance(),
        refreshNotes(),
        refreshVisits(),
        refreshPlans(),
        refreshSermons(),
        refreshNewFamilyPrograms(),
        refreshIncome(),
        refreshExpense(),
        refreshBudget(),
        refreshSchoolDepartments(),
        refreshSchoolClasses(),
        refreshSchoolEnrollments(),
        refreshWorkflows(),
        refreshWorkflowSteps(),
        refreshWorkflowCards(),
        refreshCeremonyTemplates(),
        refreshCeremonySteps(),
        refreshCeremonySessions(),
      ]);
    } catch (e) {
      console.error("[AppData] background load error:", e);
    } finally {
      setBgLoading(false);
    }
  }, [
    refreshAttendance,
    refreshNotes,
    refreshVisits,
    refreshPlans,
    refreshSermons,
    refreshNewFamilyPrograms,
    refreshIncome,
    refreshExpense,
    refreshBudget,
    refreshSchoolDepartments,
    refreshSchoolClasses,
    refreshSchoolEnrollments,
    refreshWorkflows,
    refreshWorkflowSteps,
    refreshWorkflowCards,
    refreshCeremonyTemplates,
    refreshCeremonySteps,
    refreshCeremonySessions,
  ]);

  const refreshAll = useCallback(async () => {
    await refreshCore();
    refreshBackground();
  }, [refreshCore, refreshBackground]);

  const partialRefreshRef = useRef(partialRefresh);
  partialRefreshRef.current = partialRefresh;

  useEffect(() => {
    coalescedRefreshRef.current = createCoalescedTableRefresh(
      (table) => { void partialRefreshRef.current(table); },
      REALTIME_COALESCE_MS,
    );
    return () => {
      coalescedRefreshRef.current?.dispose();
      coalescedRefreshRef.current = null;
    };
  }, []);

  useEffect(() => {
    if (!churchId) {
      setCoreLoading(false);
      setBgLoading(false);
      return;
    }
    setLoadError(false);
    refreshCore().then(() => {
      refreshBackground();
    });
  }, [churchId, refreshCore, refreshBackground]);

  useEffect(() => {
    if (!churchId || !supabase) return;

    const onVisibility = () => {
      coalescedRefreshRef.current?.setPaused(document.hidden);
    };
    onVisibility();
    document.addEventListener("visibilitychange", onVisibility);

    if (channelRef.current) {
      supabase.removeChannel(channelRef.current);
    }

    const WATCHED_TABLES = [
      "members", "attendance", "notes", "visits",
      "income", "expense", "settings", "budget",
    ];

    let channel = supabase.channel(`app-data-${churchId}`);

    WATCHED_TABLES.forEach((table) => {
      channel = channel.on(
        "postgres_changes" as any,
        { event: "*", schema: "public", table, filter: `church_id=eq.${churchId}` },
        () => {
          coalescedRefreshRef.current?.schedule(table);
        },
      );
    });

    channel.subscribe();

    channelRef.current = channel;

    return () => {
      document.removeEventListener("visibilitychange", onVisibility);
      if (channelRef.current && supabase) {
        supabase.removeChannel(channelRef.current);
        channelRef.current = null;
      }
    };
  }, [churchId]);

  const saveDb = useCallback(async (d: DB) => {
    await saveDBToSupabase(d);
  }, []);

  const value = useMemo<AppDataContextType>(
    () => ({
      db, setDb, saveDb, loading, loadError,
      rawAttendance, schoolDepartments, schoolClasses, schoolEnrollments,
      workflows, workflowSteps, workflowCards,
      ceremonyTemplates, ceremonySteps, ceremonySessions,
      refreshAll, refreshMembers, refreshAttendance, refreshNotes,
      refreshVisits, refreshIncome, refreshExpense, refreshNewFamilyPrograms,
      refreshPlans, refreshSermons, refreshSettings, refreshBudget,
      refreshSchoolDepartments, refreshSchoolClasses, refreshSchoolEnrollments,
      refreshWorkflows, refreshWorkflowSteps, refreshWorkflowCards,
      refreshCeremonyTemplates, refreshCeremonySteps, refreshCeremonySessions,
    }),
    [
      db, saveDb, loading, loadError,
      rawAttendance, schoolDepartments, schoolClasses, schoolEnrollments,
      workflows, workflowSteps, workflowCards,
      ceremonyTemplates, ceremonySteps, ceremonySessions,
      refreshAll, refreshMembers, refreshAttendance, refreshNotes,
      refreshVisits, refreshIncome, refreshExpense, refreshNewFamilyPrograms,
      refreshPlans, refreshSermons, refreshSettings, refreshBudget,
      refreshSchoolDepartments, refreshSchoolClasses, refreshSchoolEnrollments,
      refreshWorkflows, refreshWorkflowSteps, refreshWorkflowCards,
      refreshCeremonyTemplates, refreshCeremonySteps, refreshCeremonySessions,
    ],
  );

  return <AppDataContext.Provider value={value}>{children}</AppDataContext.Provider>;
}
