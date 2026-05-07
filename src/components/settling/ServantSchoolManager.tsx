"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import { supabase } from "@/lib/supabase";
import { getChurchId } from "@/lib/tenant";
import { CalendarDropdown } from "@/components/CalendarDropdown";
import { ModernSelect } from "@/components/common/ModernSelect";

interface Graduate {
  id: string;
  member_id: string;
  name: string;
  graduated_at: string;
  is_active: boolean;
  notes: string | null;
}

interface MemberOption {
  id: string;
  name: string;
  dept?: string;
  role?: string;
}

interface Props {
  members: MemberOption[];
  toast: (msg: string, type?: "ok" | "err" | "warn") => void;
}

function isServantEligibleRole(role?: string): boolean {
  const v = (role || "").trim();
  if (!v) return false;
  if (v.includes("집사")) return true; // 집사, 안수집사 포함
  if (v.includes("권사") || v.includes("장로")) return true;
  if (v.includes("목사") || v.includes("전도사")) return true;
  return false;
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

export function ServantSchoolManager({ members, toast }: Props) {
  const mob = useIsMobile();
  const [graduates, setGraduates] = useState<Graduate[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedMemberId, setSelectedMemberId] = useState("");
  const [graduatedAt, setGraduatedAt] = useState(() => new Date().toISOString().slice(0, 10));
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);

  const fetchGraduates = useCallback(async () => {
    if (!supabase) {
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      let churchId = "";
      try {
        churchId = getChurchId();
      } catch {
        /* ignore */
      }
      if (!churchId) {
        setLoading(false);
        return;
      }

      const { data, error } = await supabase
        .from("servant_school_graduates")
        .select("id, member_id, name, graduated_at, is_active, notes")
        .eq("church_id", churchId)
        .order("graduated_at", { ascending: false });

      if (error) {
        console.error("[ServantSchool] graduates load error:", error);
      } else {
        setGraduates((data ?? []) as Graduate[]);
      }
    } catch (err) {
      console.error("[ServantSchool] fetchGraduates error:", err);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    fetchGraduates();
  }, [fetchGraduates]);

  const existingMemberIds = useMemo(() => new Set(graduates.map((g) => g.member_id)), [graduates]);

  const availableMembers = useMemo(
    () => members.filter((m) => !existingMemberIds.has(m.id) && isServantEligibleRole(m.role)),
    [members, existingMemberIds]
  );
  const availableMemberOptions = useMemo(
    () => [
      { value: "", label: `집사 이상 성도 선택 (${availableMembers.length}명)` },
      ...availableMembers.map((m) => ({
        value: m.id,
        label: `${m.name}${m.role ? ` (${m.role})` : ""}${m.dept ? ` · ${m.dept}` : ""}`,
      })),
    ],
    [availableMembers]
  );

  const selectedMember = useMemo(
    () => availableMembers.find((m) => m.id === selectedMemberId) ?? null,
    [availableMembers, selectedMemberId]
  );

  const handleRegister = async () => {
    if (!supabase || !selectedMember) return;
    setSaving(true);
    const churchId = getChurchId();
    const { error } = await supabase.from("servant_school_graduates").insert({
      member_id: selectedMember.id,
      name: selectedMember.name,
      graduated_at: graduatedAt,
      is_active: true,
      notes: notes.trim() || null,
      church_id: churchId,
    });
    if (error) {
      if (error.code === "23505") {
        toast("이미 등록된 수료자입니다", "warn");
      } else {
        toast("등록 실패: " + error.message, "err");
      }
    } else {
      toast(`${selectedMember.name} 수료자 등록 완료`, "ok");
      setSelectedMemberId("");
      setNotes("");
      setGraduatedAt(new Date().toISOString().slice(0, 10));
      fetchGraduates();
    }
    setSaving(false);
  };

  const toggleActive = async (g: Graduate) => {
    if (!supabase) return;
    const { error } = await supabase
      .from("servant_school_graduates")
      .update({ is_active: !g.is_active, updated_at: new Date().toISOString() })
      .eq("id", g.id);
    if (error) {
      toast("상태 변경 실패: " + error.message, "err");
    } else {
      toast(g.is_active ? `${g.name} 비활성화됨` : `${g.name} 활성화됨`, "ok");
      fetchGraduates();
    }
  };

  const handleDelete = async (g: Graduate) => {
    if (!supabase) return;
    if (!confirm(`${g.name} 수료자를 삭제하시겠습니까?`)) return;
    const { error } = await supabase.from("servant_school_graduates").delete().eq("id", g.id);
    if (error) {
      toast("삭제 실패: " + error.message, "err");
    } else {
      toast(`${g.name} 삭제됨`, "ok");
      fetchGraduates();
    }
  };

  const activeGraduates = graduates.filter((g) => g.is_active);
  const inactiveGraduates = graduates.filter((g) => !g.is_active);

  return (
    <div className={mob ? "space-y-3" : "space-y-6"}>
      <div
        className={
          mob
            ? "rounded-lg border border-gray-100 bg-white p-3"
            : "rounded-xl border border-gray-100 bg-white p-5 shadow-sm"
        }
      >
        <h3
          className={
            mob ? "mb-2 text-[12px] font-bold text-[#1e40af]" : "mb-4 text-base font-bold text-[#1e40af]"
          }
        >
          섬김이 학교 수료자 등록
        </h3>
        <div className={mob ? "flex flex-col gap-2" : "flex flex-col items-start gap-3 sm:flex-row"}>
          <ModernSelect
            value={selectedMemberId}
            onChange={setSelectedMemberId}
            options={availableMemberOptions}
            compact={mob}
            style={{ marginBottom: 0, minWidth: 0, flex: 1, width: "100%" }}
          />
          <div className={mob ? "w-full" : "w-full shrink-0 sm:w-48"}>
            <CalendarDropdown
              value={graduatedAt}
              onChange={setGraduatedAt}
              compact
              style={{ marginBottom: 0 }}
              triggerStyle={
                mob
                  ? { fontSize: 11, minHeight: 28, height: 28, padding: "4px 8px", borderRadius: 6 }
                  : undefined
              }
            />
          </div>
          <input
            type="text"
            placeholder="메모 (선택)"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            className={
              mob
                ? "h-7 w-full rounded border border-gray-200 px-2 py-1.5 text-[11px]"
                : "w-full shrink-0 rounded-lg border border-gray-200 px-3 py-2.5 text-sm focus:border-[#1e40af] focus:outline-none focus:ring-2 focus:ring-[#1e40af]/20 sm:w-48"
            }
          />
          <button
            type="button"
            onClick={handleRegister}
            disabled={!selectedMemberId || saving}
            className={
              mob
                ? "h-7 w-full rounded-lg bg-[#1e40af] px-3 py-1.5 text-[11px] font-semibold text-white disabled:opacity-40"
                : "shrink-0 whitespace-nowrap rounded-xl bg-[#1e40af] px-5 py-2.5 text-sm font-semibold text-white hover:opacity-90 disabled:opacity-40"
            }
          >
            {saving ? "등록 중..." : "수료자 등록"}
          </button>
        </div>
      </div>

      <div
        className={
          mob
            ? "overflow-hidden rounded-lg border border-gray-100 bg-white"
            : "overflow-hidden rounded-xl border border-gray-100 bg-white shadow-sm"
        }
      >
        <div className={mob ? "border-b border-gray-100 px-3 py-2" : "border-b border-gray-100 px-5 py-3"}>
          <h3 className={mob ? "text-[11px] font-bold text-[#1e40af]" : "text-base font-bold text-[#1e40af]"}>
            수료자 목록{" "}
            <span className={mob ? "ml-1 text-[10px] font-normal text-gray-400" : "ml-1 text-sm font-normal text-gray-400"}>
              ({activeGraduates.length}명 활성)
            </span>
          </h3>
        </div>
        {loading ? (
          <div className={mob ? "flex items-center justify-center py-6" : "flex items-center justify-center py-12"}>
            <span
              className={
                mob
                  ? "inline-block h-5 w-5 animate-spin rounded-full border-2 border-[#1e40af] border-t-transparent"
                  : "inline-block h-6 w-6 animate-spin rounded-full border-2 border-[#1e40af] border-t-transparent"
              }
            />
            <span className={mob ? "ml-2 text-[10px] text-gray-500" : "ml-2 text-gray-500"}>로딩 중...</span>
          </div>
        ) : activeGraduates.length === 0 ? (
          <div className={mob ? "py-6 text-center text-[11px] text-gray-400" : "py-12 text-center text-gray-400"}>
            등록된 섬김이 학교 수료자가 없습니다.
          </div>
        ) : mob ? (
          <div className="divide-y divide-gray-50">
            {activeGraduates.map((g) => (
              <div key={g.id} className="flex items-center gap-2 px-3 py-2 text-[11px]">
                <span className="w-[50px] truncate font-medium text-gray-900">{g.name}</span>
                <span className="w-[70px] text-gray-500">{g.graduated_at}</span>
                <span className="flex-1 truncate text-gray-400">{g.notes || "-"}</span>
                <button
                  type="button"
                  onClick={() => toggleActive(g)}
                  className="rounded-full bg-green-100 px-1.5 py-0.5 text-[9px] font-medium text-green-700"
                >
                  활성
                </button>
                <button type="button" onClick={() => handleDelete(g)} className="text-[9px] font-medium text-red-500">
                  삭제
                </button>
              </div>
            ))}
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-200 bg-gray-50/50">
                <th className="px-4 py-3 text-left font-semibold text-[#1e40af]">이름</th>
                <th className="px-4 py-3 text-left font-semibold text-[#1e40af]">수료일</th>
                <th className="px-4 py-3 text-left font-semibold text-[#1e40af]">메모</th>
                <th className="px-4 py-3 text-center font-semibold text-[#1e40af]">활성</th>
                <th className="px-4 py-3 text-center font-semibold text-[#1e40af]">액션</th>
              </tr>
            </thead>
            <tbody>
              {activeGraduates.map((g) => (
                <tr key={g.id} className="border-b border-gray-50 hover:bg-gray-50/50">
                  <td className="px-4 py-3 font-medium">{g.name}</td>
                  <td className="px-4 py-3 text-gray-600">{g.graduated_at}</td>
                  <td className="max-w-[200px] truncate px-4 py-3 text-gray-500">{g.notes || "-"}</td>
                  <td className="px-4 py-3 text-center">
                    <button
                      type="button"
                      onClick={() => toggleActive(g)}
                      className="inline-flex items-center gap-1.5 rounded-full bg-green-100 px-2.5 py-1 text-xs font-medium text-green-700 hover:bg-green-200"
                    >
                      활성
                    </button>
                  </td>
                  <td className="px-4 py-3 text-center">
                    <button type="button" onClick={() => handleDelete(g)} className="text-xs font-medium text-red-500 hover:text-red-700">
                      삭제
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {inactiveGraduates.length > 0 && (
        <div
          className={
            mob
              ? "overflow-hidden rounded-lg border border-gray-100 bg-white"
              : "overflow-hidden rounded-xl border border-gray-100 bg-white shadow-sm"
          }
        >
          <div className={mob ? "border-b border-gray-100 px-3 py-2" : "border-b border-gray-100 px-5 py-3"}>
            <h3 className={mob ? "text-[10px] font-semibold text-gray-400" : "text-sm font-semibold text-gray-400"}>
              비활성 수료자 ({inactiveGraduates.length}명)
            </h3>
          </div>
          {mob ? (
            <div className="divide-y divide-gray-50">
              {inactiveGraduates.map((g) => (
                <div key={g.id} className="flex items-center gap-2 px-3 py-1.5 text-[10px] opacity-60">
                  <span className="w-[50px] truncate font-medium">{g.name}</span>
                  <span className="w-[70px] text-gray-500">{g.graduated_at}</span>
                  <span className="flex-1 truncate text-gray-400">{g.notes || "-"}</span>
                  <button
                    type="button"
                    onClick={() => toggleActive(g)}
                    className="rounded-full bg-gray-100 px-1.5 py-0.5 text-[9px] font-medium text-gray-500"
                  >
                    비활성
                  </button>
                  <button type="button" onClick={() => handleDelete(g)} className="text-[9px] font-medium text-red-500">
                    삭제
                  </button>
                </div>
              ))}
            </div>
          ) : (
            <table className="w-full text-sm">
              <tbody>
                {inactiveGraduates.map((g) => (
                  <tr key={g.id} className="border-b border-gray-50 opacity-60 hover:bg-gray-50/50">
                    <td className="px-4 py-2.5 font-medium">{g.name}</td>
                    <td className="px-4 py-2.5 text-gray-500">{g.graduated_at}</td>
                    <td className="max-w-[200px] truncate px-4 py-2.5 text-gray-400">{g.notes || "-"}</td>
                    <td className="px-4 py-2.5 text-center">
                      <button
                        type="button"
                        onClick={() => toggleActive(g)}
                        className="inline-flex items-center gap-1.5 rounded-full bg-gray-100 px-2.5 py-1 text-xs font-medium text-gray-500 hover:bg-gray-200"
                      >
                        비활성
                      </button>
                    </td>
                    <td className="px-4 py-2.5 text-center">
                      <button type="button" onClick={() => handleDelete(g)} className="text-xs font-medium text-red-500 hover:text-red-700">
                        삭제
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}
    </div>
  );
}
