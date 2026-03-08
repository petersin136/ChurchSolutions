"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import { supabase } from "@/lib/supabase";
import { getChurchId, withChurchId } from "@/lib/tenant";
import { CalendarDropdown } from "@/components/CalendarDropdown";

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

export function ServantSchoolManager({ members, toast }: Props) {
  const [graduates, setGraduates] = useState<Graduate[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedMemberId, setSelectedMemberId] = useState("");
  const [graduatedAt, setGraduatedAt] = useState(() => new Date().toISOString().slice(0, 10));
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);

  const fetchGraduates = useCallback(async () => {
    if (!supabase) { setLoading(false); return; }
    setLoading(true);
    try {
      let churchId = "";
      try { churchId = getChurchId(); } catch { /* ignore */ }
      if (!churchId) { setLoading(false); return; }

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

  const existingMemberIds = useMemo(() => new Set(graduates.map(g => g.member_id)), [graduates]);

  const availableMembers = useMemo(
    () => members.filter(m => !existingMemberIds.has(m.id)),
    [members, existingMemberIds]
  );

  const selectedMember = useMemo(
    () => availableMembers.find(m => m.id === selectedMemberId) ?? null,
    [availableMembers, selectedMemberId]
  );

  const handleRegister = async () => {
    if (!supabase || !selectedMember) return;
    setSaving(true);
    const { error } = await supabase.from("servant_school_graduates").insert(
      withChurchId({
        member_id: selectedMember.id,
        name: selectedMember.name,
        graduated_at: graduatedAt,
        is_active: true,
        notes: notes.trim() || null,
      }) as any
    );
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
    const { error } = await supabase
      .from("servant_school_graduates")
      .delete()
      .eq("id", g.id);
    if (error) {
      toast("삭제 실패: " + error.message, "err");
    } else {
      toast(`${g.name} 삭제됨`, "ok");
      fetchGraduates();
    }
  };

  const activeGraduates = graduates.filter(g => g.is_active);
  const inactiveGraduates = graduates.filter(g => !g.is_active);

  return (
    <div className="space-y-6">
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-5">
        <h3 className="text-base font-bold text-[#1e3a5f] mb-4">섬김이 학교 수료자 등록</h3>
        <div className="flex flex-col sm:flex-row gap-3 items-start">
          <select
            value={selectedMemberId}
            onChange={(e) => setSelectedMemberId(e.target.value)}
            className="flex-1 rounded-lg border border-gray-200 px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#1e3a5f]/20 focus:border-[#1e3a5f] min-w-0"
          >
            <option value="">-- 성도 선택 ({availableMembers.length}명) --</option>
            {availableMembers.map(m => (
              <option key={m.id} value={m.id}>
                {m.name}{m.role ? ` (${m.role})` : ""}{m.dept ? ` · ${m.dept}` : ""}
              </option>
            ))}
          </select>
          <div className="w-full sm:w-48 shrink-0">
            <CalendarDropdown
              value={graduatedAt}
              onChange={setGraduatedAt}
              compact
              style={{ marginBottom: 0 }}
            />
          </div>
          <input
            type="text"
            placeholder="메모 (선택)"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            className="rounded-lg border border-gray-200 px-3 py-2.5 text-sm w-full sm:w-48 shrink-0"
          />
          <button
            type="button"
            onClick={handleRegister}
            disabled={!selectedMemberId || saving}
            className="px-5 py-2.5 rounded-xl bg-[#1e3a5f] text-white font-semibold text-sm hover:opacity-90 disabled:opacity-40 whitespace-nowrap shrink-0"
          >
            {saving ? "등록 중..." : "수료자 등록"}
          </button>
        </div>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
        <div className="px-5 py-3 border-b border-gray-100">
          <h3 className="text-base font-bold text-[#1e3a5f]">
            수료자 목록 <span className="text-sm font-normal text-gray-400 ml-1">({activeGraduates.length}명 활성)</span>
          </h3>
        </div>
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <span className="inline-block w-6 h-6 rounded-full border-2 border-[#1e3a5f] border-t-transparent animate-spin" />
            <span className="ml-2 text-gray-500">로딩 중...</span>
          </div>
        ) : activeGraduates.length === 0 ? (
          <div className="py-12 text-center text-gray-400">등록된 섬김이 학교 수료자가 없습니다.</div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-200 bg-gray-50/50">
                <th className="text-left py-3 px-4 font-semibold text-[#1e3a5f]">이름</th>
                <th className="text-left py-3 px-4 font-semibold text-[#1e3a5f]">수료일</th>
                <th className="text-left py-3 px-4 font-semibold text-[#1e3a5f]">메모</th>
                <th className="text-center py-3 px-4 font-semibold text-[#1e3a5f]">활성</th>
                <th className="text-center py-3 px-4 font-semibold text-[#1e3a5f]">액션</th>
              </tr>
            </thead>
            <tbody>
              {activeGraduates.map(g => (
                <tr key={g.id} className="border-b border-gray-50 hover:bg-gray-50/50">
                  <td className="py-3 px-4 font-medium">{g.name}</td>
                  <td className="py-3 px-4 text-gray-600">{g.graduated_at}</td>
                  <td className="py-3 px-4 text-gray-500 max-w-[200px] truncate">{g.notes || "-"}</td>
                  <td className="py-3 px-4 text-center">
                    <button type="button" onClick={() => toggleActive(g)} className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-green-100 text-green-700 hover:bg-green-200">활성</button>
                  </td>
                  <td className="py-3 px-4 text-center">
                    <button type="button" onClick={() => handleDelete(g)} className="text-xs text-red-500 hover:text-red-700 font-medium">삭제</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {inactiveGraduates.length > 0 && (
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
          <div className="px-5 py-3 border-b border-gray-100">
            <h3 className="text-sm font-semibold text-gray-400">비활성 수료자 ({inactiveGraduates.length}명)</h3>
          </div>
          <table className="w-full text-sm">
            <tbody>
              {inactiveGraduates.map(g => (
                <tr key={g.id} className="border-b border-gray-50 hover:bg-gray-50/50 opacity-60">
                  <td className="py-2.5 px-4 font-medium">{g.name}</td>
                  <td className="py-2.5 px-4 text-gray-500">{g.graduated_at}</td>
                  <td className="py-2.5 px-4 text-gray-400 max-w-[200px] truncate">{g.notes || "-"}</td>
                  <td className="py-2.5 px-4 text-center">
                    <button type="button" onClick={() => toggleActive(g)} className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-gray-100 text-gray-500 hover:bg-gray-200">비활성</button>
                  </td>
                  <td className="py-2.5 px-4 text-center">
                    <button type="button" onClick={() => handleDelete(g)} className="text-xs text-red-500 hover:text-red-700 font-medium">삭제</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
