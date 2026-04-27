"use client";

import { useMemo, useState, useEffect } from "react";

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
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer } from "recharts";
import { useAppData } from "@/contexts/AppDataContext";
import LazyChart from "../common/LazyChart";

const fmt = (n: number) => new Intl.NumberFormat("ko-KR").format(n);

interface OfferingLike { donorId?: string; donorName?: string; amount: number; date: string; categoryId?: string; }
interface DonorLike { id: string; name: string; group?: string; }
interface CategoryLike { id: string; name: string; }

/** 교회 정보는 영수증 발행 시 사용 (선택) */
export interface ReceiptSettings {
  churchName?: string;
  address?: string;
  pastor?: string;
  businessNumber?: string;
}

/** TODO: 헌금자 순위는 민감 정보. 추후 역할 기반(재정 담당자/목사) 접근 제한 추가 */
export interface DonorStatisticsProps {
  year: string;
  offerings: OfferingLike[];
  donors: DonorLike[];
  categories: CategoryLike[];
  toast?: (msg: string, type?: "ok" | "err" | "warn") => void;
  receiptSettings?: ReceiptSettings;
}

type PrintDonor = { id: string; name: string; total: number; byCat: Record<string, number> };

export function DonorStatistics({ year, offerings, donors, categories, toast, receiptSettings }: DonorStatisticsProps) {
  const mob = useIsMobile();
  const { db } = useAppData();
  const [search, setSearch] = useState("");
  const [printDonor, setPrintDonor] = useState<PrintDonor | null>(null);

  const incomeRows = useMemo(() => {
    const start = `${year}-01-01`;
    const end = `${year}-12-31`;
    return db.income.filter(i => i.date >= start && i.date <= end);
  }, [db.income, year]);

  const prevYearKeys = useMemo(() => {
    const prevYear = String(Number(year) - 1);
    const keys = new Set<string>();
    db.income.filter(i => i.date?.startsWith(prevYear)).forEach(r => {
      const k = r.member_id || r.donor || "";
      if (k) keys.add(k);
    });
    return keys;
  }, [db.income, year]);

  useEffect(() => {
    if (!printDonor) return;
    const onAfterPrint = () => setPrintDonor(null);
    window.addEventListener("afterprint", onAfterPrint);
    const t = setTimeout(() => window.print(), 100);
    return () => {
      window.removeEventListener("afterprint", onAfterPrint);
      clearTimeout(t);
    };
  }, [printDonor]);

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

  return (
    <div className="relative">
      <div className={printDonor ? "no-print" : ""}>
        <div className="space-y-6">
      {/* TODO: 역할 기반 접근 제한 추가 예정 */}
      <div style={{ display: "grid", gridTemplateColumns: mob ? "1fr 1fr" : "repeat(4, 1fr)", gap: mob ? 8 : 16 }}>
        <div
          style={{
            background: "#fff",
            borderRadius: mob ? 8 : 16,
            border: "1px solid #e2e5ef",
            padding: mob ? "8px 10px" : "16px 20px",
            minHeight: mob ? 56 : 90,
            boxSizing: "border-box",
          }}
        >
          <div style={{ fontSize: mob ? 10 : 13, color: "#6b7b9e", marginBottom: 4 }}>총 헌금자 수</div>
          <div style={{ fontSize: mob ? 20 : 26, fontWeight: mob ? 800 : 700, color: "#2563eb", lineHeight: 1.2 }}>{donorList.length}명</div>
        </div>
        <div
          style={{
            background: "#fff",
            borderRadius: mob ? 8 : 16,
            border: "1px solid #e2e5ef",
            padding: mob ? "8px 10px" : "16px 20px",
            minHeight: mob ? 56 : 90,
            boxSizing: "border-box",
            minWidth: 0,
          }}
        >
          <div style={{ fontSize: mob ? 10 : 13, color: "#6b7b9e", marginBottom: 4 }}>총 헌금 금액</div>
          <div
            style={{
              fontSize: mob ? 20 : 26,
              fontWeight: mob ? 800 : 700,
              color: "#2563eb",
              lineHeight: 1.2,
              overflow: "hidden",
              textOverflow: "ellipsis",
              whiteSpace: "nowrap",
              maxWidth: "100%",
            }}
          >
            ₩{fmt(totalAmount)}
          </div>
        </div>
        <div
          style={{
            background: "#fff",
            borderRadius: mob ? 8 : 16,
            border: "1px solid #e2e5ef",
            padding: mob ? "6px 8px" : "16px 20px",
            minHeight: mob ? 48 : 90,
            boxSizing: "border-box",
            minWidth: 0,
          }}
        >
          <div style={{ fontSize: mob ? 10 : 13, color: "#6b7b9e", marginBottom: 2 }}>1인당 평균</div>
          <div style={{ fontSize: mob ? 16 : 22, fontWeight: mob ? 800 : 700, color: "#2563eb", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>₩{fmt(avgPerDonor)}</div>
        </div>
        <div
          style={{
            background: "#fff",
            borderRadius: mob ? 8 : 16,
            border: "1px solid #e2e5ef",
            padding: mob ? "6px 8px" : "16px 20px",
            minHeight: mob ? 48 : 90,
            boxSizing: "border-box",
          }}
        >
          <div style={{ fontSize: mob ? 10 : 13, color: "#6b7b9e", marginBottom: 2 }}>신규 헌금자 (올해)</div>
          <div style={{ fontSize: mob ? 16 : 22, fontWeight: mob ? 800 : 700, color: "#2563eb" }}>{newDonorsThisYear}명</div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-3 lg:p-6">
          <h4 className="font-semibold text-[#2563eb] mb-4 text-sm lg:text-base">월별 헌금자 수</h4>
          <LazyChart height={mob ? 200 : 300}>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={monthlyDonorCount}>
                <XAxis dataKey="month" tick={{ fontSize: mob ? 10 : 12 }} />
                <YAxis tick={{ fontSize: mob ? 10 : 12 }} />
                <Tooltip />
                <Bar dataKey="인원" fill="#2563eb" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </LazyChart>
        </div>
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-3 lg:p-6">
          <h4 className="font-semibold text-[#2563eb] mb-4 text-sm lg:text-base">헌금 구간별 분포</h4>
          <LazyChart height={mob ? 200 : 300}>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={bracketDist}>
                <XAxis dataKey="name" tick={{ fontSize: mob ? 10 : 12 }} />
                <YAxis tick={{ fontSize: mob ? 10 : 12 }} />
                <Tooltip />
                <Bar dataKey="인원" fill="#6b7b9e" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </LazyChart>
        </div>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
        <div className="px-4 py-3 lg:px-5 border-b border-gray-100 flex items-center justify-between gap-4">
          <h4 className="font-semibold text-[#2563eb] text-sm lg:text-base">헌금자 목록</h4>
          <input type="text" value={search} onChange={(e) => setSearch(e.target.value)} placeholder="이름/부서 검색" className="px-3 py-2 rounded-lg border border-gray-200 text-sm lg:text-base w-48 lg:w-64" />
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm lg:text-base">
            <thead><tr className="bg-gray-50 border-b"><th className="text-left py-2 px-3 lg:py-3 lg:px-4">순위</th><th className="text-left py-2 px-3 lg:py-3 lg:px-4">이름</th><th className="text-left py-2 px-3 lg:py-3 lg:px-4">부서</th><th className="text-right py-2 px-3 lg:py-3 lg:px-4">십일조</th><th className="text-right py-2 px-3 lg:py-3 lg:px-4">감사</th><th className="text-right py-2 px-3 lg:py-3 lg:px-4">선교</th><th className="text-right py-2 px-3 lg:py-3 lg:px-4">기타</th><th className="text-right py-2 px-3 lg:py-3 lg:px-4">합계</th><th className="text-right py-2 px-3 lg:py-3 lg:px-4">비율</th><th className="text-center py-2 px-3 lg:py-3 lg:px-4 no-print">영수증</th></tr></thead>
            <tbody>
              {filteredList.slice(0, 100).map((d, i) => {
                const tithe = d.byCat?.tithe ?? 0;
                const thanks = d.byCat?.thanks ?? 0;
                const mission = d.byCat?.mission ?? 0;
                const other = d.total - tithe - thanks - mission;
                const pct = totalAmount > 0 ? Math.round((d.total / totalAmount) * 100) : 0;
                return (
                  <tr key={d.id} className="border-b border-gray-100 hover:bg-gray-50/50">
                    <td className="py-2 px-3 lg:py-3 lg:px-4">{i + 1}</td>
                    <td className="py-2 px-3 lg:py-3 lg:px-4 font-medium">{d.name}</td>
                    <td className="py-2 px-3 lg:py-3 lg:px-4">{d.group}</td>
                    <td className="py-2 px-3 lg:py-3 lg:px-4 text-right">{fmt(tithe)}</td>
                    <td className="py-2 px-3 lg:py-3 lg:px-4 text-right">{fmt(thanks)}</td>
                    <td className="py-2 px-3 lg:py-3 lg:px-4 text-right">{fmt(mission)}</td>
                    <td className="py-2 px-3 lg:py-3 lg:px-4 text-right">{fmt(other)}</td>
                    <td className="py-2 px-3 lg:py-3 lg:px-4 text-right font-semibold">₩{fmt(d.total)}</td>
                    <td className="py-2 px-3 lg:py-3 lg:px-4 text-right text-gray-600">{pct}%</td>
                    <td className="py-2 px-3 lg:py-3 lg:px-4 text-center no-print">
                      <button type="button" onClick={() => setPrintDonor({ id: d.id, name: d.name, total: d.total, byCat: d.byCat ?? {} })} className="text-xs text-[#2563eb] hover:underline">
                        영수증 발행
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
        </div>
      </div>

      {printDonor && (
        <div className="hidden print:block print:fixed print:inset-0 print:bg-white print:p-6" aria-hidden>
          <div className="w-full max-w-lg mx-auto p-6 bg-white text-black">
            <p className="text-lg font-bold">{receiptSettings?.churchName || "교회"} 기부금 영수증</p>
            {receiptSettings?.address && <p className="text-sm text-gray-600">{receiptSettings.address}</p>}
            {receiptSettings?.pastor && <p className="text-sm text-gray-600">담임: {receiptSettings.pastor}</p>}
            {receiptSettings?.businessNumber && <p className="text-sm text-gray-600">사업자(고유)번호: {receiptSettings.businessNumber}</p>}
            <p className="mt-4 font-medium">헌금자: {printDonor.name}</p>
            <p className="text-sm">연도: {year}년</p>
            <p className="mt-2">연간 헌금 합계: ₩{fmt(printDonor.total)}</p>
            {Object.keys(printDonor.byCat).length > 0 && (
              <ul className="mt-2 text-sm list-disc list-inside">
                {Object.entries(printDonor.byCat).map(([cat, amt]) => (
                  <li key={cat}>{cat}: ₩{fmt(amt)}</li>
                ))}
              </ul>
            )}
            <p className="mt-6 text-xs text-gray-500">위 금액을 영수증으로 확인합니다.</p>
          </div>
        </div>
      )}
    </div>
  );
}
