"use client";

import { useRef, useState } from "react";
import type { DB } from "@/types/db";
import { DEFAULT_SETTINGS } from "@/types/db";

interface SettingsPageProps {
  db: DB;
  setDb: React.Dispatch<React.SetStateAction<DB>>;
  save: () => void;
  saveDb?: (d: DB) => Promise<void>;
  toast: (msg: string, type?: "ok" | "err" | "warn") => void;
}

export function SettingsPage({
  db,
  setDb,
  save,
  saveDb,
  toast,
}: SettingsPageProps) {
  const importRef = useRef<HTMLInputElement>(null);
  const [resetLoading, setResetLoading] = useState(false);

  function saveSettings(
    churchName: string,
    depts: string,
    fiscalStart: string
  ) {
    setDb((prev) => ({
      ...prev,
      settings: {
        ...prev.settings,
        churchName,
        depts,
        fiscalStart,
      },
    }));
    save();
  }

  function exportBackup() {
    const json = JSON.stringify(db);
    const blob = new Blob([json], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `superplanner_backup_${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
    toast("백업 파일이 다운로드되었습니다", "ok");
  }

  function importBackup(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const parsed = JSON.parse(reader.result as string) as Partial<DB>;
        const merged = { ...db, ...parsed };
        setDb(() => merged);
        if (saveDb) saveDb(merged).then(() => toast("복원 완료", "ok")).catch(() => toast("저장 실패", "err"));
        else { save(); toast("복원 완료", "ok"); }
      } catch {
        toast("잘못된 백업 파일입니다", "err");
      }
    };
    reader.readAsText(file);
    e.target.value = "";
  }

  async function clearAllData() {
    if (typeof window === "undefined") return;
    if (!window.confirm("정말 모든 데이터를 초기화하시겠습니까?\n이 작업은 되돌릴 수 없습니다.")) return;
    try {
      setResetLoading(true);
      if (saveDb) {
        const res = await fetch("/api/reset", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ scope: "all" }) });
        const data = await res.json().catch(() => ({}));
        if (!res.ok || !data?.ok) {
          throw new Error(data?.message || res.statusText || "전체 초기화 요청 실패");
        }
      }
      const emptyDb: DB = {
        settings: { ...DEFAULT_SETTINGS },
        members: [],
        attendance: {},
        attendanceReasons: {},
        notes: {},
        plans: [],
        sermons: [],
        visits: [],
        income: [],
        expense: [],
        budget: {},
        checklist: {},
      };
      setDb(emptyDb);
      save();
      toast("전체 초기화 완료", "warn");
      window.location.reload();
    } catch (err) {
      console.error("전체 초기화 오류:", err);
      alert("초기화 중 오류가 발생했습니다.\n" + (err instanceof Error ? err.message : String(err)));
    } finally {
      setResetLoading(false);
    }
  }

  async function handleSave() {
    save();
    if (saveDb) {
      try {
        const res = await fetch("/api/settings", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(db.settings),
        });
        const data = await res.json().catch(() => ({}));
        if (res.ok && data?.ok) toast("저장되었습니다", "ok");
        else throw new Error(data?.message || "저장 실패");
      } catch (e) {
        console.warn("설정 저장 실패:", e);
        toast("저장 실패", "err");
      }
    } else {
      toast("저장되었습니다", "ok");
    }
  }

  async function resetTab(name: "pastoral" | "finance" | "planner" | "visit" | "bulletin") {
    const msg =
      name === "pastoral" ? "목양(성도·출석·노트) 데이터를 초기화하시겠습니까?"
      : name === "finance" ? "재정(수입·지출·예산) 데이터를 초기화하시겠습니까?"
      : name === "planner" ? "플래너 데이터를 초기화하시겠습니까?"
      : name === "visit" ? "심방/상담 데이터를 초기화하시겠습니까?"
      : "주보 데이터를 초기화하시겠습니까?";
    if (typeof window === "undefined" || !window.confirm(msg)) return;

    try {
      setResetLoading(true);

      if (name === "pastoral") {
        if (saveDb) {
          const res = await fetch("/api/reset", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ scope: "pastoral" }) });
          const data = await res.json().catch(() => ({}));
          if (!res.ok || !data?.ok) throw new Error(data?.message || res.statusText || "목양 초기화 실패");
        }
        setDb((prev) => ({ ...prev, members: [], attendance: {}, attendanceReasons: {}, notes: {} }));
        save();
        toast("목양 데이터가 초기화되었습니다", "warn");
        window.location.reload();
      } else if (name === "finance") {
        if (saveDb) {
          const res = await fetch("/api/reset", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ scope: "finance" }) });
          const data = await res.json().catch(() => ({}));
          if (!res.ok || !data?.ok) throw new Error(data?.message || res.statusText || "재정 초기화 실패");
        }
        setDb((prev) => ({ ...prev, income: [], expense: [], budget: {} }));
        save();
        toast("재정 데이터가 초기화되었습니다", "warn");
        window.location.reload();
      } else if (name === "planner") {
        if (saveDb) {
          const res = await fetch("/api/reset", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ scope: "planner" }) });
          const data = await res.json().catch(() => ({}));
          if (!res.ok || !data?.ok) throw new Error(data?.message || res.statusText || "플래너 초기화 실패");
        }
        if (typeof window !== "undefined") window.localStorage.removeItem("planner_db");
        setDb((prev) => ({ ...prev, plans: [] }));
        save();
        toast("플래너 데이터가 초기화되었습니다", "warn");
        window.location.reload();
      } else if (name === "visit") {
        if (saveDb) {
          const res = await fetch("/api/reset", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ scope: "visits" }) });
          const data = await res.json().catch(() => ({}));
          if (!res.ok || !data?.ok) throw new Error(data?.message || res.statusText || "심방 초기화 실패");
        }
        if (typeof window !== "undefined") window.localStorage.removeItem("visit_counsel_db");
        setDb((prev) => ({ ...prev, visits: [] }));
        save();
        toast("심방/상담 데이터가 초기화되었습니다", "warn");
        window.location.reload();
      } else {
        if (typeof window !== "undefined") window.localStorage.removeItem("bulletin_db");
        toast("주보 데이터가 초기화되었습니다", "warn");
        window.location.reload();
      }
    } catch (err) {
      console.error(`${name} 초기화 오류:`, err);
      alert("초기화 중 오류가 발생했습니다.\n" + (err instanceof Error ? err.message : String(err)));
    } finally {
      setResetLoading(false);
    }
  }

  return (
    <>
      <h3
        style={{
          fontSize: 20,
          fontWeight: 700,
          marginBottom: 20,
        }}
      >
        ⚙️ 설정
      </h3>

      <div className="card card-body-padded">
        <div className="fg">
          <label className="fl">교회 이름</label>
          <input
            type="text"
            className="fi"
            placeholder="○○교회"
            value={db.settings.churchName ?? ""}
            onInput={(e) =>
              saveSettings(
                (e.target as HTMLInputElement).value,
                db.settings.depts,
                db.settings.fiscalStart
              )
            }
          />
        </div>
        <div className="fg">
          <label className="fl">부서 목록 (쉼표 구분)</label>
          <input
            type="text"
            className="fi"
            placeholder="유아부,유치부,유년부,초등부,중등부,고등부,청년부,장년부"
            value={db.settings.depts ?? ""}
            onInput={(e) =>
              saveSettings(
                db.settings.churchName,
                (e.target as HTMLInputElement).value,
                db.settings.fiscalStart
              )
            }
          />
        </div>
        <div className="fg">
          <label className="fl">회계연도 시작월</label>
          <select
            className="fs"
            value={db.settings.fiscalStart}
            onChange={(e) =>
              saveSettings(
                db.settings.churchName,
                db.settings.depts,
                e.target.value
              )
            }
          >
            <option value="1">1월</option>
            <option value="3">3월</option>
            <option value="9">9월</option>
          </select>
        </div>
        <p style={{ fontSize: 12, color: "var(--text2)", lineHeight: 1.5, marginTop: 8, marginBottom: 4 }}>
          아래 항목은 필수가 아니며, 기부금 영수증 발행 시에만 사용됩니다. 비워두면 영수증에 &quot;-&quot;로 표시됩니다.
        </p>
        <div className="fg">
          <label className="fl">사업자등록번호 (고유번호)</label>
          <input
            type="text"
            className="fi"
            placeholder="000-00-00000 (선택)"
            value={db.settings.businessNumber ?? ""}
            onInput={(e) => {
              setDb((prev) => ({
                ...prev,
                settings: { ...prev.settings, businessNumber: (e.target as HTMLInputElement).value },
              }));
              save();
            }}
          />
        </div>
        <div className="fg">
          <label className="fl">소재지</label>
          <input
            type="text"
            className="fi"
            placeholder="서울시 강남구 ○○로 123 (선택)"
            value={db.settings.address ?? ""}
            onInput={(e) => {
              setDb((prev) => ({
                ...prev,
                settings: { ...prev.settings, address: (e.target as HTMLInputElement).value },
              }));
              save();
            }}
          />
        </div>
        <div className="fg">
          <label className="fl">담임목사</label>
          <input
            type="text"
            className="fi"
            placeholder="홍길동 목사 (선택)"
            value={db.settings.pastor ?? ""}
            onInput={(e) => {
              setDb((prev) => ({
                ...prev,
                settings: { ...prev.settings, pastor: (e.target as HTMLInputElement).value },
              }));
              save();
            }}
          />
        </div>
        <details style={{ marginTop: 12, marginBottom: 0 }}>
          <summary style={{ cursor: "pointer", fontSize: 13, color: "var(--text2)" }}>
            영수증 양식 참고 이미지 보기
          </summary>
          <div style={{ marginTop: 12, padding: 12, background: "var(--bg2)", borderRadius: 8 }}>
            <img
              src="/receipt-reference.png"
              alt="기부금 영수증 양식 참고"
              style={{ maxWidth: "100%", height: "auto", border: "1px solid var(--border)", borderRadius: 4 }}
            />
          </div>
        </details>
        <div style={{ marginTop: 16 }}>
          <button type="button" className="btn btn-primary" onClick={handleSave}>
            저장
          </button>
        </div>
      </div>

      <div
        className="card card-body-padded"
        style={{ marginTop: 16 }}
      >
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          <button type="button" className="btn btn-secondary" onClick={exportBackup}>
            전체 백업
          </button>
          <button type="button" className="btn btn-secondary" onClick={() => importRef.current?.click()}>
            백업 복원
          </button>
          <input
            ref={importRef}
            type="file"
            accept=".json"
            style={{ display: "none" }}
            onChange={importBackup}
          />
          <button type="button" className="btn btn-danger" onClick={() => clearAllData()} disabled={resetLoading}>
            {resetLoading ? "처리 중..." : "전체 초기화"}
          </button>
        </div>
      </div>

      <div className="card card-body-padded" style={{ marginTop: 16 }}>
        <h4 style={{ fontSize: 15, fontWeight: 600, marginBottom: 4 }}>탭별 초기화</h4>
        <p style={{ fontSize: 13, color: "var(--text2)", marginBottom: 14 }}>
          해당 탭의 데이터만 삭제됩니다. 복구할 수 없습니다.
        </p>
        <ul style={{ listStyle: "none", padding: 0, margin: 0, display: "flex", flexDirection: "column", gap: 6 }}>
          {[
            { key: "pastoral" as const, label: "목양" },
            { key: "planner" as const, label: "플래너" },
            { key: "finance" as const, label: "재정" },
            { key: "visit" as const, label: "심방/상담" },
            { key: "bulletin" as const, label: "주보" },
          ].map(({ key, label }) => (
            <li
              key={key}
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                padding: "10px 12px",
                background: "var(--bg2)",
                borderRadius: 8,
                border: "1px solid var(--border)",
              }}
            >
              <span style={{ fontSize: 14, fontWeight: 500 }}>{label}</span>
              <button
                type="button"
                onClick={() => resetTab(key)}
                disabled={resetLoading}
                style={{
                  fontSize: 13,
                  padding: "6px 12px",
                  color: "var(--danger, #dc2626)",
                  background: "transparent",
                  border: "1px solid var(--border)",
                  borderRadius: 6,
                  cursor: resetLoading ? "not-allowed" : "pointer",
                  opacity: resetLoading ? 0.6 : 1,
                }}
              >
                초기화
              </button>
            </li>
          ))}
        </ul>
      </div>
    </>
  );
}
