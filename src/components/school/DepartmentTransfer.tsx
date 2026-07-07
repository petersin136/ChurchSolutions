"use client";

import { useState, useEffect, useMemo, type CSSProperties } from "react";
import type { DB } from "@/types/db";
import type { SchoolDepartment, SchoolTransferHistory } from "@/types/db";
import { supabase } from "@/lib/supabase";
import { getChurchId } from "@/lib/tenant";
import { useAppData } from "@/contexts/AppDataContext";

const NAVY = "#1a1d26";
const BORDER = "#e8e9f0";
const ROW_LINE = "#f0f2f5";
const MUTED = "#999";
const TEXT = "#555";
const LABEL = "#6b7b9e";

export interface DepartmentTransferProps {
  db: DB;
  toast: (msg: string, type?: "ok" | "err" | "warn") => void;
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

export function DepartmentTransfer({ toast }: DepartmentTransferProps) {
  const mob = useIsMobile();
  const selectStyle: CSSProperties = useMemo(
    () => ({
      flex: 1,
      minWidth: 0,
      width: "100%",
      height: mob ? 32 : 40,
      fontSize: mob ? 12 : 14,
      borderRadius: 7,
      border: `1px solid ${BORDER}`,
      padding: mob ? "0 8px" : "0 14px",
      background: "var(--color-surface)",
      color: TEXT,
      boxSizing: "border-box",
    }),
    [mob]
  );
  const inputStyle: CSSProperties = useMemo(
    () => ({
      flex: 1,
      minWidth: 0,
      height: mob ? 32 : 40,
      fontSize: mob ? 12 : 14,
      borderRadius: 7,
      border: `1px solid ${BORDER}`,
      padding: mob ? "0 8px" : "0 14px",
      color: TEXT,
      boxSizing: "border-box",
    }),
    [mob]
  );
  const { db, schoolDepartments, schoolEnrollments, refreshSchoolEnrollments } = useAppData();
  const [history, setHistory] = useState<SchoolTransferHistory[]>([]);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [fromDeptId, setFromDeptId] = useState<string | null>(null);
  const [toDeptId, setToDeptId] = useState<string | null>(null);
  const [reason, setReason] = useState("");
  const [loading, setLoading] = useState(true);

  const departments = useMemo(() => schoolDepartments.filter((d) => d.is_active !== false), [schoolDepartments]);
  const enrollments = schoolEnrollments;

  const loadHistory = async () => {
    if (!supabase) return;
    setLoading(true);
    try {
      const { data, error } = await supabase.from("school_transfer_history").select("*").order("created_at", { ascending: false }).limit(50);
      if (error) {
        toast("이력 로드 실패: " + error.message, "err");
        return;
      }
      setHistory((data as SchoolTransferHistory[]) ?? []);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadHistory();
  }, []);

  const filtered = fromDeptId ? enrollments.filter((e) => e.department_id === fromDeptId) : [];

  const toggle = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const handleTransfer = async () => {
    if (!supabase || !toDeptId || selectedIds.size === 0) {
      toast("이동할 학생과 새 부서를 선택하세요", "warn");
      return;
    }
    const toDept = departments.find((d) => d.id === toDeptId);
    const fromDept = fromDeptId ? departments.find((d) => d.id === fromDeptId) : null;
    const transferDate = new Date().toISOString().slice(0, 10);
    let churchId: string;
    try {
      churchId = getChurchId();
    } catch {
      toast("church_id를 확인할 수 없습니다.", "err");
      return;
    }
    try {
      for (const enrollId of selectedIds) {
        const en = enrollments.find((e) => e.id === enrollId);
        if (!en) continue;

        const { error: deactivateErr } = await supabase
          .from("school_enrollments")
          .update({ is_active: false, left_date: transferDate })
          .eq("church_id", churchId)
          .eq("id", enrollId);
        if (deactivateErr) {
          toast("기존 등록 비활성화 실패: " + deactivateErr.message, "err");
          return;
        }

        const { error: newEnrollErr } = await supabase.from("school_enrollments").insert({
          member_id: en.member_id,
          department_id: toDeptId,
          class_id: null,
          role: en.role,
          enrolled_date: transferDate,
          is_active: true,
          church_id: churchId,
        });
        if (newEnrollErr) {
          toast("새 부서 등록 실패: " + newEnrollErr.message, "err");
          return;
        }

        const { error: insErr } = await supabase.from("school_transfer_history").insert({
          member_id: en.member_id,
          from_department_id: fromDeptId ?? null,
          from_department_name: fromDept?.name ?? null,
          to_department_id: toDeptId,
          to_department_name: toDept?.name ?? null,
          transfer_date: transferDate,
          reason: reason.trim() || null,
          church_id: churchId,
        });
        if (insErr) {
          toast("이력 저장 실패: " + insErr.message, "err");
          return;
        }
      }
      toast("부서 이동이 완료되었습니다", "ok");
      setSelectedIds(new Set());
      setReason("");
      await Promise.all([refreshSchoolEnrollments(), loadHistory()]);
    } catch (err) {
      console.error(err);
      toast("이동 처리 실패", "err");
    }
  };

  const getMember = (id: string) => db.members?.find((m) => m.id === id);

  if (loading) return <div style={{ padding: 16, fontSize: mob ? 11 : 14, color: MUTED }}>로딩 중...</div>;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: mob ? 8 : 16 }}>
      <div style={{ background: "var(--color-surface)", borderRadius: 7, border: `1px solid ${BORDER}`, padding: mob ? 12 : 20, marginBottom: 0 }}>
        <h4 style={{ margin: "0 0 8px", fontSize: mob ? 13 : 16, fontWeight: 700, color: NAVY }}>부서 이동</h4>

        <div style={{ display: "flex", flexDirection: "row", flexWrap: "wrap", gap: mob ? 8 : 12, alignItems: "flex-end" }}>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: mob ? 10 : 13, fontWeight: 400, color: LABEL, marginBottom: 4 }}>현재 부서</div>
            <select
              className="compact-select school-dept-transfer-control"
              value={fromDeptId ?? ""}
              onChange={(e) => { setFromDeptId(e.target.value || null); setSelectedIds(new Set()); }}
              style={selectStyle}
            >
              <option value="">선택</option>
              {departments.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
            </select>
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: mob ? 10 : 13, fontWeight: 400, color: LABEL, marginBottom: 4 }}>새 부서</div>
            <select
              className="compact-select school-dept-transfer-control"
              value={toDeptId ?? ""}
              onChange={(e) => setToDeptId(e.target.value || null)}
              style={selectStyle}
            >
              <option value="">선택</option>
              {departments.filter((d) => d.id !== fromDeptId).map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
            </select>
          </div>
        </div>

        <div style={{ display: "flex", flexDirection: "row", flexWrap: "wrap", gap: mob ? 8 : 12, marginTop: mob ? 6 : 8, alignItems: "center" }}>
          <input
            type="text"
            className="school-transfer-reason school-dept-transfer-control"
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="이동 사유"
            style={inputStyle}
          />
          <button
            type="button"
            className="school-dept-transfer-btn"
            onClick={handleTransfer}
            disabled={selectedIds.size === 0 || !toDeptId}
            style={{
              height: mob ? 32 : 40,
              fontSize: mob ? 11 : 14,
              fontWeight: 600,
              padding: mob ? "0 16px" : "0 22px",
              borderRadius: 7,
              background: NAVY,
              color: "#fff",
              border: "none",
              cursor: selectedIds.size === 0 || !toDeptId ? "not-allowed" : "pointer",
              opacity: selectedIds.size === 0 || !toDeptId ? 0.5 : 1,
              flexShrink: 0,
              boxSizing: "border-box",
            }}
          >
            이동 실행
          </button>
        </div>

        <div style={{ maxHeight: 192, overflowY: "auto", border: `1px solid ${BORDER}`, borderRadius: 7, marginTop: 8 }}>
          {filtered.map((e) => (
            <label
              key={e.id}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 8,
                padding: mob ? "6px 8px" : "10px 14px",
                borderBottom: `1px solid ${ROW_LINE}`,
                cursor: "pointer",
                fontSize: mob ? 11 : 14,
                color: TEXT,
              }}
            >
              <input type="checkbox" checked={selectedIds.has(e.id)} onChange={() => toggle(e.id)} />
              <span>{getMember(e.member_id)?.name ?? e.member_id}</span>
            </label>
          ))}
        </div>
      </div>

      <div style={{ background: "var(--color-surface)", borderRadius: 7, border: `1px solid ${BORDER}`, padding: mob ? 12 : 20, overflowX: "auto" }}>
        <h4 style={{ margin: "0 0 8px", fontSize: mob ? 13 : 16, fontWeight: 700, color: NAVY }}>이동 이력</h4>
        <table style={{ width: "100%", borderCollapse: "collapse" }}>
          <thead>
            <tr style={{ background: "transparent" }}>
              <th style={{ textAlign: "left", padding: mob ? "6px 8px" : "10px 14px", fontSize: mob ? 10 : 13, fontWeight: 700, color: NAVY, borderBottom: `2px solid ${NAVY}`, background: "transparent" }}>이동일</th>
              <th style={{ textAlign: "left", padding: mob ? "6px 8px" : "10px 14px", fontSize: mob ? 10 : 13, fontWeight: 700, color: NAVY, borderBottom: `2px solid ${NAVY}`, background: "transparent" }}>구 부서</th>
              <th style={{ textAlign: "left", padding: mob ? "6px 8px" : "10px 14px", fontSize: mob ? 10 : 13, fontWeight: 700, color: NAVY, borderBottom: `2px solid ${NAVY}`, background: "transparent" }}>신 부서</th>
              <th style={{ textAlign: "left", padding: mob ? "6px 8px" : "10px 14px", fontSize: mob ? 10 : 13, fontWeight: 700, color: NAVY, borderBottom: `2px solid ${NAVY}`, background: "transparent" }}>사유</th>
            </tr>
          </thead>
          <tbody>
            {history.length === 0 ? (
              <tr><td colSpan={4} style={{ padding: "24px 0", textAlign: "center", fontSize: mob ? 12 : 14, color: MUTED }}>이력이 없습니다.</td></tr>
            ) : (
              history.map((h, i) => (
                <tr key={h.id} style={{ borderBottom: `1px solid ${ROW_LINE}`, background: i % 2 === 1 ? "#fafbfc" : "#fff" }}>
                  <td style={{ padding: mob ? 8 : "12px 14px", fontSize: mob ? 11 : 14, fontWeight: 400, color: TEXT }}>{h.transfer_date}</td>
                  <td style={{ padding: mob ? 8 : "12px 14px", fontSize: mob ? 11 : 14, fontWeight: 400, color: TEXT }}>{h.from_department_name ?? "-"}</td>
                  <td style={{ padding: mob ? 8 : "12px 14px", fontSize: mob ? 11 : 14, fontWeight: 400, color: TEXT }}>{h.to_department_name ?? "-"}</td>
                  <td style={{ padding: mob ? 8 : "12px 14px", fontSize: mob ? 11 : 14, fontWeight: 400, color: TEXT }}>{h.reason ?? "-"}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
