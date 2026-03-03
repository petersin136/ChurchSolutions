"use client";

import { useState, useMemo, useCallback, useEffect } from "react";
import type { CSSProperties } from "react";

function getDaysInMonth(year: number, month: number): number {
  return new Date(year, month, 0).getDate();
}

const BORDER = "#e5e7eb";
const NAVY = "#1a1f36";
const TEXT = "#1a1f36";

export interface BirthDateSelectProps {
  value: string;
  onChange: (value: string) => void;
  label?: string;
  showClearButton?: boolean;
  /** 기존 폼과 동일한 스타일을 위해 (PastoralPage C 등) */
  style?: CSSProperties;
}

/** 생년월일: 연/월/일 3단 네이티브 select. value/onChange는 YYYY-MM-DD. */
export function BirthDateSelect({ value, onChange, label, showClearButton = false, style }: BirthDateSelectProps) {
  const parse = useCallback((v: string) => {
    if (!v || !v.trim()) return { y: "", m: "", d: "" };
    const match = v.trim().match(/^(\d{4})[.\s\-]*(\d{1,2})[.\s\-]*(\d{1,2})/);
    if (match) return { y: match[1], m: match[2], d: match[3] };
    return { y: "", m: "", d: "" };
  }, []);
  const currentYear = useMemo(() => new Date().getFullYear(), []);
  const years = useMemo(() => Array.from({ length: currentYear - 1920 + 1 }, (_, i) => currentYear - i), [currentYear]);
  const months = useMemo(() => Array.from({ length: 12 }, (_, i) => i + 1), []);

  const parsed = parse(value);
  const [y, setY] = useState(parsed.y);
  const [m, setM] = useState(parsed.m);
  const [d, setD] = useState(parsed.d);

  useEffect(() => {
    const p = parse(value);
    if (!p.y || !p.m) {
      setY(p.y);
      setM(p.m);
      setD(p.d);
      return;
    }
    const yN = parseInt(p.y, 10);
    const mN = parseInt(p.m, 10);
    const maxD = getDaysInMonth(yN, mN);
    const dN = p.d ? Math.min(parseInt(p.d, 10), maxD) : 1;
    setY(p.y);
    setM(p.m);
    setD(String(dN));
  }, [value, parse]);

  const yearNum = y ? parseInt(y, 10) : 0;
  const monthNum = m ? parseInt(m, 10) : 0;
  const maxDay = yearNum && monthNum ? getDaysInMonth(yearNum, monthNum) : 31;
  const days = useMemo(() => Array.from({ length: maxDay }, (_, i) => i + 1), [maxDay]);

  const dayNum = d ? parseInt(d, 10) : 0;
  const clampedD = dayNum && maxDay ? Math.min(dayNum, maxDay) : "";

  const commit = useCallback(
    (ny: string, nm: string, nd: string) => {
      if (!ny || !nm || !nd) {
        onChange("");
        return;
      }
      const mm = String(parseInt(nm, 10)).padStart(2, "0");
      const dd = String(parseInt(nd, 10)).padStart(2, "0");
      onChange(`${ny}-${mm}-${dd}`);
    },
    [onChange]
  );

  const handleY = useCallback(
    (e: React.ChangeEvent<HTMLSelectElement>) => {
      const ny = e.target.value;
      setY(ny);
      if (!m || !d) {
        commit(ny, m, d);
        return;
      }
      const nyr = parseInt(ny, 10);
      const nmr = parseInt(m, 10);
      const maxD = getDaysInMonth(nyr, nmr);
      const nd = String(Math.min(parseInt(d, 10), maxD));
      setD(nd);
      commit(ny, m, nd);
    },
    [m, d, commit]
  );
  const handleM = useCallback(
    (e: React.ChangeEvent<HTMLSelectElement>) => {
      const nm = e.target.value;
      setM(nm);
      if (!y || !d) {
        commit(y, nm, d);
        return;
      }
      const nyr = parseInt(y, 10);
      const nmr = parseInt(nm, 10);
      const maxD = getDaysInMonth(nyr, nmr);
      const nd = String(Math.min(parseInt(d, 10), maxD));
      setD(nd);
      commit(y, nm, nd);
    },
    [y, d, commit]
  );
  const handleD = useCallback(
    (e: React.ChangeEvent<HTMLSelectElement>) => {
      const nd = e.target.value;
      setD(nd);
      commit(y, m, nd);
    },
    [y, m, commit]
  );

  const selectStyle: CSSProperties = {
    padding: "10px 14px",
    borderRadius: 10,
    border: `1px solid ${BORDER}`,
    fontSize: 14,
    fontFamily: "inherit",
    color: TEXT,
    background: "#fff",
    outline: "none",
    cursor: "pointer",
    width: "100%",
  };

  return (
    <div style={{ marginBottom: 16, ...style }}>
      {label && (
        <label style={{ display: "block", fontSize: 13, fontWeight: 600, color: NAVY, marginBottom: 6 }}>{label}</label>
      )}
      <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
        <select value={y} onChange={handleY} style={{ ...selectStyle, flex: "0 0 40%" }} aria-label="연도">
          <option value="">연도</option>
          {years.map((yr) => (
            <option key={yr} value={yr}>
              {yr}
            </option>
          ))}
        </select>
        <select value={m} onChange={handleM} style={{ ...selectStyle, flex: "0 0 30%" }} aria-label="월">
          <option value="">월</option>
          {months.map((mo) => (
            <option key={mo} value={mo}>
              {mo}
            </option>
          ))}
        </select>
        <select value={clampedD ? String(clampedD) : d} onChange={handleD} style={{ ...selectStyle, flex: "0 0 30%" }} aria-label="일">
          <option value="">일</option>
          {days.map((day) => (
            <option key={day} value={day}>
              {day}
            </option>
          ))}
        </select>
      </div>
      {showClearButton && (y || m || d) ? (
        <button
          type="button"
          onClick={() => {
            setY("");
            setM("");
            setD("");
            onChange("");
          }}
          style={{
            marginTop: 6,
            padding: "4px 0",
            fontSize: 13,
            fontWeight: 600,
            color: "#6b7280",
            background: "none",
            border: "none",
            cursor: "pointer",
          }}
        >
          삭제
        </button>
      ) : null}
    </div>
  );
}
