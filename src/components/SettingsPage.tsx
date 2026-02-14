"use client";

import { useRef } from "react";
import type { DB } from "@/types/db";

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

  function clearAllData() {
    if (
      typeof window !== "undefined" &&
      !window.confirm("모든 데이터를 삭제하시겠습니까? 복구할 수 없습니다.")
    )
      return;
    const emptyDb: DB = {
      settings: { ...db.settings },
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
    if (saveDb) saveDb(emptyDb).then(() => toast("전체 초기화 완료", "warn")).catch(() => toast("저장 실패", "err"));
    else { save(); toast("전체 초기화 완료", "warn"); }
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
            defaultValue={db.settings.churchName}
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
            defaultValue={db.settings.depts}
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
            defaultValue={db.settings.fiscalStart}
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
      </div>

      <div className="card card-body-padded" style={{ marginTop: 16 }}>
        <h4 style={{ fontSize: 15, fontWeight: 600, marginBottom: 8 }}>
          📋 교회 정보 (기부금 영수증용)
        </h4>
        <p style={{ fontSize: 12, color: "var(--text2)", lineHeight: 1.6, marginBottom: 12 }}>
          아래 항목은 설정 시에는 <strong>필수가 아니며</strong> 비워 두어도 됩니다.
          다만 <strong>기부금 영수증 발행 시에는 반드시 필요</strong>하며, 공란이 있으면 영수증에 &quot;-&quot;로 표시됩니다.
        </p>
        <details style={{ marginBottom: 16 }}>
          <summary style={{ cursor: "pointer", fontSize: 13, color: "var(--text2)" }}>
            영수증 양식 참고 이미지 보기
          </summary>
          <div style={{ marginTop: 12, padding: 12, background: "var(--bg2)", borderRadius: 8 }}>
            <img
              src="/receipt-reference.png"
              alt="기부금 영수증 양식 참고"
              style={{ maxWidth: "100%", height: "auto", border: "1px solid var(--border)", borderRadius: 4 }}
            />
            <p style={{ fontSize: 11, color: "var(--text2)", marginTop: 8 }}>
              ② 기부금 단체: 단체명(교회 이름), 사업자등록번호, 소재지가 영수증에 표시됩니다.
            </p>
          </div>
        </details>
        <div className="fg">
          <label className="fl">사업자등록번호 (고유번호)</label>
          <input
            type="text"
            className="fi"
            placeholder="000-00-00000"
            defaultValue={db.settings.businessNumber ?? ""}
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
            placeholder="서울시 강남구 ○○로 123"
            defaultValue={db.settings.address ?? ""}
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
            placeholder="홍길동 목사"
            defaultValue={db.settings.pastor ?? ""}
            onInput={(e) => {
              setDb((prev) => ({
                ...prev,
                settings: { ...prev.settings, pastor: (e.target as HTMLInputElement).value },
              }));
              save();
            }}
          />
        </div>
      </div>

      <div
        className="card card-body-padded"
        style={{ marginTop: 16 }}
      >
        <h3
          style={{
            fontSize: 15,
            fontWeight: 600,
            marginBottom: 12,
          }}
        >
          💾 데이터 백업/복원
        </h3>
        <div
          style={{
            display: "flex",
            gap: 8,
            flexWrap: "wrap",
          }}
        >
          <button
            type="button"
            className="btn btn-secondary"
            onClick={exportBackup}
          >
            📤 전체 백업 (JSON)
          </button>
          <button
            type="button"
            className="btn btn-secondary"
            onClick={() => importRef.current?.click()}
          >
            📥 백업 복원
          </button>
          <input
            ref={importRef}
            type="file"
            accept=".json"
            style={{ display: "none" }}
            onChange={importBackup}
          />
          <button
            type="button"
            className="btn btn-danger"
            onClick={clearAllData}
          >
            🗑 전체 초기화
          </button>
        </div>
      </div>

      <div
        className="card card-body-padded"
        style={{ marginTop: 16 }}
      >
        <h3
          style={{
            fontSize: 15,
            fontWeight: 600,
            marginBottom: 8,
          }}
        >
          ℹ️ 정보
        </h3>
        <p
          style={{
            fontSize: 13,
            color: "var(--text2)",
            lineHeight: 1.7,
          }}
        >
          교역자 슈퍼플래너 MVP v1.0
          <br />
          목양노트 · 교역자 플래너 · 재정관리
          <br />
          데이터는 Supabase 클라우드에 저장됩니다.
          <br />
          정기적으로 백업을 권장합니다.
        </p>
      </div>
    </>
  );
}
