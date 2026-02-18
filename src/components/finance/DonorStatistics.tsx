"use client";

import { useMemo, useState, useEffect } from "react";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer } from "recharts";
import { supabase } from "@/lib/supabase";

const fmt = (n: number) => new Intl.NumberFormat("ko-KR").format(n);

interface OfferingLike { donorId?: string; donorName?: string; amount: number; date: string; categoryId?: string; }
interface DonorLike { id: string; name: string; group?: string; }
interface CategoryLike { id: string; name: string; }

type IncomeRow = { id: string; date: string; amount: number; donor?: string; member_id?: string; type?: string; };

/** TODO: 헌금자 순위는 민감 정보. 추후 역할 기반(재정 담당자/목사) 접근 제한 추가 */
export interface DonorStatisticsProps {
  year: string;
  offerings: OfferingLike[];
  donors: DonorLike[];
  categories: CategoryLike[];
  toast?: (msg: string, type?: "ok" | "err" | "warn") => void;
}

export function DonorStatistics({ year, offerings, donors, categories, toast }: DonorStatisticsProps) {
  const [search, setSearch] = useState("");
  const [incomeRows, setIncomeRows] = useState<IncomeRow[]>([]);
  const [prevYearKeys, setPrevYearKeys] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!supabase) {
      setLoading(false);
      return;
    }
    setLoading(true);
    const start = `${year}-01-01`;
    const end = `${year}-12-31`;
    const prevStart = `${Number(year) - 1}-01-01`;
    const prevEnd = `${Number(year) - 1}-12-31`;
    Promise.all([
      supabase.from("income").select("id, date, amount, donor, member_id, type").gte("date", start).lte("date", end),
      supabase.from("income").select("donor, member_id").gte("date", prevStart).lte("date", prevEnd),
    ]).then(([curr, prev]) => {
      if (curr.error && toast) toast("헌금 데이터 로드 실패: " + curr.error.message, "err");
      setIncomeRows((curr.data ?? []) as IncomeRow[]);
      const keys = new Set<string>();
      (prev.data ?? []).forEach((r: { donor?: string; member_id?: string }) => {
        const k = r.member_id || r.donor || "";
        if (k) keys.add(k);
      });
      setPrevYearKeys(keys);
    }).finally(() => setLoading(false));
  }, [year, toast]);

  const byDonor = useMemo(() => {
    const map: Record<string, { total: number; byCat: Record<string, number>; count: number }> = {};
    const source = incomeRows.length > 0 ? incomeRows.map((i) => ({ donorId: i.member_id, donorName: i.donor, amount: Number(i.amount), date: i.date, categoryId: i.type })) : offerings.filter((o) => o.date?.startsWith(year));
    source.forEach((o) => {
      const id = (o as { donorId?: string; donorName?: string }).donorId || (o as { donorName?: string }).donorName || "anonymous";
      if (!map[id]) map[id] = { total: 0, byCat: {}, count: 0 };
      map[id].total += o.amount;
      map[id].count += 1;
      const cat = (o as { categoryId?: string }).categoryId || "other";
      map[id].byCat[cat] = (map[id].byCat[cat] || 0) + o.amount;
    });
    return map;
  }, [incomeRows, offerings, year]);

  const donorList = useMemo(() => {
    const keys = Object.keys(byDonor).filter((k) => k !== "anonymous" && byDonor[k].total > 0);
    const list = keys.map((key) => {
      const d = donors.find((x) => x.id === key);
      return {
        id: key,
        name: d?.name ?? (byDonor[key] ? String(key) : key),
        group: d?.group ?? "",
        total: byDonor[key].total,
        byCat: byDonor[key].byCat,
      };
    });
    list.sort((a, b) => b.total - a.total);
    return list;
  }, [donors, byDonor]);

  const filteredList = useMemo(() => {
    if (!search.trim()) return donorList;
    const q = search.toLowerCase();
    return donorList.filter((d) => d.name.toLowerCase().includes(q) || (d.group || "").toLowerCase().includes(q));
  }, [donorList, search]);

  const totalAmount = useMemo(() => donorList.reduce((s, d) => s + d.total, 0), [donorList]);
  const avgPerDonor = donorList.length > 0 ? Math.round(totalAmount / donorList.length) : 0;
  const newDonorsThisYear = useMemo(() => {
    return donorList.filter((d) => d.id && !prevYearKeys.has(d.id)).length;
  }, [donorList, prevYearKeys]);

  const monthlyDonorCount = useMemo(() => {
    const source = incomeRows.length > 0 ? incomeRows : offerings.filter((o) => o.date?.startsWith(year)).map((o) => ({ date: o.date, donorId: (o as OfferingLike).donorId, donorName: (o as OfferingLike).donorName }));
    return Array.from({ length: 12 }, (_, i) => {
      const mStr = String(i + 1).padStart(2, "0");
      const set = new Set(
        source.map((o: { date: string; donorId?: string; donorName?: string; member_id?: string }) => {
          if (o.date?.startsWith(`${year}-${mStr}`)) return (o as { member_id?: string }).member_id || (o as { donorId?: string }).donorId || (o as { donorName?: string }).donorName;
          return null;
        }).filter(Boolean)
      );
      return { month: `${i + 1}월`, 인원: set.size };
    });
  }, [incomeRows, offerings, year]);

  const bracketLabels = ["10만 이하", "10-30만", "30-50만", "50-100만", "100만 이상"];
  const bracketRanges = [0, 100000, 300000, 500000, 1000000, Infinity];
  const bracketDist = useMemo(() => {
    const counts = [0, 0, 0, 0, 0];
    donorList.forEach((d) => {
      const t = d.total;
      for (let i = 0; i < bracketRanges.length - 1; i++) {
        if (t >= bracketRanges[i] && t < bracketRanges[i + 1]) {
          counts[i]++;
          break;
        }
      }
    });
    return bracketLabels.map((label, i) => ({ name: label, 인원: counts[i] }));
  }, [donorList]);

  if (loading) return <div className="p-6 text-gray-500">로딩 중...</div>;

  return (
    <div className="space-y-6">
      {/* TODO: 역할 기반 접근 제한 추가 예정 */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-5">
          <div className="text-xs text-gray-500 mb-1">총 헌금자 수</div>
          <div className="text-2xl font-bold text-[#1e3a5f]">{donorList.length}명</div>
        </div>
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-5">
          <div className="text-xs text-gray-500 mb-1">총 헌금 금액</div>
          <div className="text-xl font-bold text-[#1e3a5f]">₩{fmt(totalAmount)}</div>
        </div>
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-5">
          <div className="text-xs text-gray-500 mb-1">1인당 평균</div>
          <div className="text-xl font-bold text-[#1e3a5f]">₩{fmt(avgPerDonor)}</div>
        </div>
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-5">
          <div className="text-xs text-gray-500 mb-1">신규 헌금자 (올해)</div>
          <div className="text-2xl font-bold text-[#1e3a5f]">{newDonorsThisYear}명</div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-5">
          <h4 className="font-semibold text-[#1e3a5f] mb-4">월별 헌금자 수</h4>
          <div className="h-48">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={monthlyDonorCount}>
                <XAxis dataKey="month" tick={{ fontSize: 10 }} />
                <YAxis tick={{ fontSize: 10 }} />
                <Tooltip />
                <Bar dataKey="인원" fill="#1e3a5f" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-5">
          <h4 className="font-semibold text-[#1e3a5f] mb-4">헌금 구간별 분포</h4>
          <div className="h-48">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={bracketDist}>
                <XAxis dataKey="name" tick={{ fontSize: 10 }} />
                <YAxis tick={{ fontSize: 10 }} />
                <Tooltip />
                <Bar dataKey="인원" fill="#d4a574" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
        <div className="px-5 py-3 border-b border-gray-100 flex items-center justify-between gap-4">
          <h4 className="font-semibold text-[#1e3a5f]">헌금자 목록</h4>
          <input type="text" value={search} onChange={(e) => setSearch(e.target.value)} placeholder="이름/부서 검색" className="px-3 py-2 rounded-lg border border-gray-200 text-sm w-48" />
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead><tr className="bg-gray-50 border-b"><th className="text-left py-2 px-3">순위</th><th className="text-left py-2 px-3">이름</th><th className="text-left py-2 px-3">부서</th><th className="text-right py-2 px-3">십일조</th><th className="text-right py-2 px-3">감사</th><th className="text-right py-2 px-3">선교</th><th className="text-right py-2 px-3">기타</th><th className="text-right py-2 px-3">합계</th><th className="text-right py-2 px-3">비율</th></tr></thead>
            <tbody>
              {filteredList.slice(0, 100).map((d, i) => {
                const tithe = d.byCat?.tithe ?? 0;
                const thanks = d.byCat?.thanks ?? 0;
                const mission = d.byCat?.mission ?? 0;
                const other = d.total - tithe - thanks - mission;
                const pct = totalAmount > 0 ? Math.round((d.total / totalAmount) * 100) : 0;
                return (
                  <tr key={d.id} className="border-b border-gray-100 hover:bg-gray-50/50">
                    <td className="py-2 px-3">{i + 1}</td>
                    <td className="py-2 px-3 font-medium">{d.name}</td>
                    <td className="py-2 px-3">{d.group}</td>
                    <td className="py-2 px-3 text-right">{fmt(tithe)}</td>
                    <td className="py-2 px-3 text-right">{fmt(thanks)}</td>
                    <td className="py-2 px-3 text-right">{fmt(mission)}</td>
                    <td className="py-2 px-3 text-right">{fmt(other)}</td>
                    <td className="py-2 px-3 text-right font-semibold">₩{fmt(d.total)}</td>
                    <td className="py-2 px-3 text-right text-gray-600">{pct}%</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
