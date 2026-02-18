"use client";

import { useMemo, useState } from "react";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer } from "recharts";

const fmt = (n: number) => new Intl.NumberFormat("ko-KR").format(n);

interface OfferingLike { donorId?: string; donorName?: string; amount: number; date: string; categoryId?: string; }
interface DonorLike { id: string; name: string; group?: string; }
interface CategoryLike { id: string; name: string; }

/** TODO: 헌금자 순위는 민감 정보. 추후 역할 기반(재정 담당자/목사) 접근 제한 추가 */
export interface DonorStatisticsProps {
  year: string;
  offerings: OfferingLike[];
  donors: DonorLike[];
  categories: CategoryLike[];
}

export function DonorStatistics({ year, offerings, donors, categories }: DonorStatisticsProps) {
  const [search, setSearch] = useState("");

  const byDonor = useMemo(() => {
    const map: Record<string, { total: number; byCat: Record<string, number>; count: number }> = {};
    offerings.filter((o) => o.date?.startsWith(year)).forEach((o) => {
      const id = o.donorId || o.donorName || "anonymous";
      if (!map[id]) map[id] = { total: 0, byCat: {}, count: 0 };
      map[id].total += o.amount;
      map[id].count += 1;
      const cat = o.categoryId || "other";
      map[id].byCat[cat] = (map[id].byCat[cat] || 0) + o.amount;
    });
    return map;
  }, [offerings, year]);

  const donorList = useMemo(() => {
    const list = donors.map((d) => ({
      id: d.id,
      name: d.name,
      group: d.group ?? "",
      ...byDonor[d.id],
      total: byDonor[d.id]?.total ?? 0,
      byCat: byDonor[d.id]?.byCat ?? {},
    })).filter((d) => d.total > 0);
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
  const newDonorsThisYear = 0; // placeholder: 올해 처음 헌금한 사람 수

  const monthlyDonorCount = useMemo(() => {
    return Array.from({ length: 12 }, (_, i) => {
      const mStr = String(i + 1).padStart(2, "0");
      const set = new Set(offerings.filter((o) => o.date?.startsWith(`${year}-${mStr}`)).map((o) => o.donorId || o.donorName));
      return { month: `${i + 1}월`, 인원: set.size };
    });
  }, [offerings, year]);

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
