"use client";

import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from "react";
import type { DB } from "@/types/db";
import { DEFAULT_DB } from "@/types/db";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/contexts/AuthContext";
import { loadDBFromSupabase, saveDBToSupabase, toMember, toVisit, toIncome, toExpense, toNewFamilyProgram } from "@/lib/supabase-db";

interface AppDataContextType {
  db: DB;
  setDb: React.Dispatch<React.SetStateAction<DB>>;
  saveDb: (d: DB) => Promise<void>;
  loading: boolean;
  loadError: boolean;

  refreshAll: () => Promise<void>;
  refreshMembers: () => Promise<void>;
  refreshAttendance: () => Promise<void>;
  refreshNotes: () => Promise<void>;
  refreshVisits: () => Promise<void>;
  refreshIncome: () => Promise<void>;
  refreshExpense: () => Promise<void>;
  refreshNewFamilyPrograms: () => Promise<void>;
}

const AppDataContext = createContext<AppDataContextType | null>(null);

export function useAppData() {
  const ctx = useContext(AppDataContext);
  if (!ctx) throw new Error("useAppData must be used within AppDataProvider");
  return ctx;
}

export function AppDataProvider({ children }: { children: React.ReactNode }) {
  const { churchId } = useAuth();
  const [db, setDb] = useState<DB>(() => DEFAULT_DB);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const channelRef = useRef<any>(null);
  const churchIdRef = useRef(churchId);
  churchIdRef.current = churchId;

  const refreshAll = useCallback(async () => {
    const cid = churchIdRef.current;
    if (!cid) return;
    try {
      const data = await loadDBFromSupabase(cid);
      setDb(data);
      setLoadError(false);
    } catch (e) {
      console.error("[AppData] refreshAll failed:", e);
      setLoadError(true);
    }
  }, []);

  const partialRefresh = useCallback(async (table: string) => {
    const cid = churchIdRef.current;
    if (!cid || !supabase) return;

    try {
      if (table === "members") {
        const { data } = await supabase.from("members").select("*").eq("church_id", cid).order("created_at", { ascending: true });
        if (data) {
          const members = data.map((r: Record<string, unknown>) => toMember(r));
          setDb(prev => ({ ...prev, members }));
        }
      } else if (table === "attendance") {
        const { data } = await supabase.from("attendance").select("*").eq("church_id", cid);
        if (data) {
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
      } else {
        await refreshAll();
      }
    } catch (e) {
      console.error(`[AppData] partial refresh ${table} failed:`, e);
    }
  }, [refreshAll]);

  const refreshMembers = useCallback(() => partialRefresh("members"), [partialRefresh]);
  const refreshAttendance = useCallback(() => partialRefresh("attendance"), [partialRefresh]);
  const refreshNotes = useCallback(() => partialRefresh("notes"), [partialRefresh]);
  const refreshVisits = useCallback(() => partialRefresh("visits"), [partialRefresh]);
  const refreshIncome = useCallback(() => partialRefresh("income"), [partialRefresh]);
  const refreshExpense = useCallback(() => partialRefresh("expense"), [partialRefresh]);
  const refreshNewFamilyPrograms = useCallback(() => partialRefresh("new_family_program"), [partialRefresh]);

  useEffect(() => {
    if (!churchId) {
      setLoading(false);
      return;
    }
    setLoading(true);
    setLoadError(false);
    loadDBFromSupabase(churchId)
      .then(data => {
        setDb(data);
        setLoadError(false);
      })
      .catch(e => {
        console.error("[AppData] initial load failed:", e);
        setLoadError(true);
      })
      .finally(() => setLoading(false));
  }, [churchId]);

  useEffect(() => {
    if (!churchId || !supabase) return;

    if (channelRef.current) {
      supabase.removeChannel(channelRef.current);
    }

    const WATCHED_TABLES = [
      "members", "attendance", "notes", "visits",
      "income", "expense", "new_family_program",
      "plans", "sermons", "settings",
    ];

    let channel = supabase.channel(`app-data-${churchId}`);

    WATCHED_TABLES.forEach(table => {
      channel = channel.on(
        "postgres_changes" as any,
        { event: "*", schema: "public", table, filter: `church_id=eq.${churchId}` },
        () => {
          console.log(`[Realtime] ${table} changed`);
          partialRefresh(table);
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
  }, [churchId, partialRefresh]);

  const saveDb = useCallback(async (d: DB) => {
    await saveDBToSupabase(d);
  }, []);

  const value: AppDataContextType = {
    db, setDb, saveDb, loading, loadError,
    refreshAll, refreshMembers, refreshAttendance, refreshNotes,
    refreshVisits, refreshIncome, refreshExpense, refreshNewFamilyPrograms,
  };

  return <AppDataContext.Provider value={value}>{children}</AppDataContext.Provider>;
}
