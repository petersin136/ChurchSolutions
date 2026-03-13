"use client";

import React, { createContext, useContext, useState, useEffect, useCallback, useRef, useMemo } from "react";
import type { DB, SchoolDepartment, SchoolClass, SchoolEnrollment } from "@/types/db";
import { DEFAULT_DB } from "@/types/db";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/contexts/AuthContext";
import { loadDBFromSupabase, saveDBToSupabase, toMember, toVisit, toIncome, toExpense, toNewFamilyProgram, toPlan, toSermon } from "@/lib/supabase-db";

const REFRESH_TIMEOUT_MS = 10000;

function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  return Promise.race([
    promise,
    new Promise<T>((_, reject) => setTimeout(() => reject(new Error("timeout")), ms)),
  ]);
}

function debounceByKey<T extends string>(fn: (key: T) => void, ms: number): (key: T) => void {
  const timers: Record<string, ReturnType<typeof setTimeout>> = {};
  return (key: T) => {
    clearTimeout(timers[key]);
    timers[key] = setTimeout(() => fn(key), ms);
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
  const channelRef = useRef<any>(null);
  const churchIdRef = useRef(churchId);
  churchIdRef.current = churchId;

  const loading = coreLoading;

  const partialRefresh = useCallback(async (table: string) => {
    const cid = churchIdRef.current;
    if (!cid || !supabase) return;

    try {
      if (table === "members") {
        const { data } = await supabase.from("members").select("*").eq("church_id", cid).order("created_at", { ascending: true });
        if (data) {
          setDb(prev => ({ ...prev, members: data.map((r: Record<string, unknown>) => toMember(r)) }));
        }
      } else if (table === "attendance") {
        const { data } = await supabase.from("attendance").select("*").eq("church_id", cid);
        if (data) {
          setRawAttendance(data as RawAttendanceRow[]);
          const attendance: DB["attendance"] = {};
          const attendanceReasons: NonNullable<DB["attendanceReasons"]> = {};
          data.forEach((r: any) => {
            const mid = r.member_id as string;
            const week = r.week_num as number;
            if (!attendance[mid]) attendance[mid] = {};
            const status = r.status as string;
            attendance[mid][week] = (status === "p" || status === "a" || status === "n" ? status : "n") as any;
            if (r.reason?.trim()) {
              if (!attendanceReasons[mid]) attendanceReasons[mid] = {};
              attendanceReasons[mid][week] = r.reason;
            }
          });
          setDb(prev => ({ ...prev, attendance, attendanceReasons }));
        }
      } else if (table === "notes") {
        const { data } = await supabase.from("notes").select("*").eq("church_id", cid);
        if (data) {
          const notes: DB["notes"] = {};
          const answeredPrayerKeys: string[] = [];
          const answeredPrayerDates: Record<string, string> = {};
          data.forEach((r: any) => {
            const mid = r.member_id as string;
            if (!notes[mid]) notes[mid] = [];
            const createdAt = r.created_at || "";
            notes[mid].push({ date: r.date || "", type: r.type || "memo", content: r.content || "", createdAt });
            if (r.type === "prayer" && (r.answered === true || r.answered_at)) {
              const key = `note\t${mid}\t${r.date || ""}\t${createdAt}\t${r.content || ""}`;
              answeredPrayerKeys.push(key);
              if (r.answered_at) answeredPrayerDates[key] = String(r.answered_at).slice(0, 10);
            }
          });
          setDb(prev => ({
            ...prev, notes,
            answeredPrayerKeys: answeredPrayerKeys.length > 0 ? [...new Set([...(prev.answeredPrayerKeys || []), ...answeredPrayerKeys])] : prev.answeredPrayerKeys,
            answeredPrayerDates: { ...(prev.answeredPrayerDates || {}), ...answeredPrayerDates },
          }));
        }
      } else if (table === "visits") {
        const { data } = await supabase.from("visits").select("*").eq("church_id", cid).order("date", { ascending: false });
        if (data) {
          setDb(prev => ({ ...prev, visits: data.map((r: any) => toVisit(r)) }));
        }
      } else if (table === "income") {
        const { data } = await supabase.from("income").select("*").eq("church_id", cid).order("date", { ascending: false });
        if (data) {
          setDb(prev => ({ ...prev, income: data.map((r: any) => toIncome(r)) }));
        }
      } else if (table === "expense") {
        const { data } = await supabase.from("expense").select("*").eq("church_id", cid).order("date", { ascending: false });
        if (data) {
          setDb(prev => ({ ...prev, expense: data.map((r: any) => toExpense(r)) }));
        }
      } else if (table === "new_family_program") {
        const { data } = await supabase.from("new_family_program").select("*").eq("church_id", cid);
        if (data) {
          setDb(prev => ({ ...prev, newFamilyPrograms: data.map((r: any) => toNewFamilyProgram(r)) }));
        }
      } else if (table === "plans") {
        const { data } = await supabase.from("plans").select("*").eq("church_id", cid).order("date", { ascending: true });
        if (data) {
          setDb(prev => ({ ...prev, plans: data.map((r: any) => toPlan(r)) }));
        }
      } else if (table === "sermons") {
        const { data } = await supabase.from("sermons").select("*").eq("church_id", cid).order("date", { ascending: false });
        if (data) {
          setDb(prev => ({ ...prev, sermons: data.map((r: any) => toSermon(r)) }));
        }
      } else if (table === "settings") {
        const { data } = await supabase.from("settings").select("*").eq("church_id", cid).limit(1);
        if (data?.[0]) {
          const s = data[0] as Record<string, unknown>;
          setDb(prev => ({
            ...prev,
            settings: {
              churchName: (s.church_name as string) ?? prev.settings.churchName,
              depts: (s.depts as string) ?? prev.settings.depts,
              fiscalStart: (s.fiscal_start as string) ?? prev.settings.fiscalStart,
              denomination: (s.denomination as string | undefined) ?? prev.settings.denomination,
              address: (s.address as string | undefined) ?? prev.settings.address,
              pastor: (s.pastor as string | undefined) ?? prev.settings.pastor,
              businessNumber: (s.business_number as string | undefined) ?? prev.settings.businessNumber,
            },
          }));
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
          setDb(prev => ({ ...prev, budget }));
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
      }
    } catch (e) {
      console.error(`[AppData] partial refresh ${table} failed:`, e);
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
      await Promise.all([refreshAttendance(), refreshNotes()]);
      await Promise.all([refreshVisits(), refreshPlans()]);
      await Promise.all([refreshSermons(), refreshNewFamilyPrograms()]);
      await Promise.all([refreshIncome(), refreshExpense()]);
      await refreshBudget();
      await Promise.all([refreshSchoolDepartments(), refreshSchoolClasses(), refreshSchoolEnrollments()]);
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
  ]);

  const refreshAll = useCallback(async () => {
    await refreshCore();
    refreshBackground();
  }, [refreshCore, refreshBackground]);

  const debouncedPartialRefresh = useMemo(
    () => debounceByKey((table: string) => partialRefresh(table), 500),
    [partialRefresh],
  );

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

    if (channelRef.current) {
      supabase.removeChannel(channelRef.current);
    }

    const WATCHED_TABLES = [
      "members", "attendance", "notes", "visits",
      "income", "expense", "new_family_program",
      "plans", "sermons", "settings", "budget",
      "school_departments", "school_classes", "school_enrollments",
    ];

    let channel = supabase.channel(`app-data-${churchId}`);

    WATCHED_TABLES.forEach(table => {
      channel = channel.on(
        "postgres_changes" as any,
        { event: "*", schema: "public", table, filter: `church_id=eq.${churchId}` },
        () => {
          debouncedPartialRefresh(table);
        }
      );
    });

    channel.subscribe((status: string) => {
      console.log("[Realtime] subscription status:", status);
    });

    channelRef.current = channel;

    return () => {
      if (channelRef.current && supabase) {
        supabase.removeChannel(channelRef.current);
        channelRef.current = null;
      }
    };
  }, [churchId, debouncedPartialRefresh]);

  const saveDb = useCallback(async (d: DB) => {
    await saveDBToSupabase(d);
  }, []);

  const value: AppDataContextType = {
    db, setDb, saveDb, loading, loadError,
    rawAttendance, schoolDepartments, schoolClasses, schoolEnrollments,
    refreshAll, refreshMembers, refreshAttendance, refreshNotes,
    refreshVisits, refreshIncome, refreshExpense, refreshNewFamilyPrograms,
    refreshPlans, refreshSermons, refreshSettings, refreshBudget,
    refreshSchoolDepartments, refreshSchoolClasses, refreshSchoolEnrollments,
  };

  return <AppDataContext.Provider value={value}>{children}</AppDataContext.Provider>;
}
