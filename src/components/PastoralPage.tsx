"use client";

import { useState, useMemo, useEffect, useCallback, useRef, type CSSProperties, type ReactNode } from "react";
import type { DB, Member, Note, AttStatus } from "@/types/db";
import { DEFAULT_DB } from "@/types/db";
import { loadDB, loadDBFromSupabase, saveDBToSupabase, getWeekNum } from "@/lib/store";

/* ---------- useIsMobile ---------- */
function useIsMobile(bp = 768) {
  const [m, setM] = useState(false);
  useEffect(() => { const c = () => setM(window.innerWidth <= bp); c(); window.addEventListener("resize", c); return () => window.removeEventListener("resize", c); }, [bp]);
  return m;
}

/* ============================================================
   교역자 슈퍼플래너 — 목양노트
   ============================================================ */

/* ---------- Utilities ---------- */
const todayStr = () => new Date().toISOString().slice(0, 10);
const uid = () => Math.random().toString(36).slice(2, 9);

function getDepts(db: DB): string[] {
  return (db.settings.depts || "").split(",").map(d => d.trim()).filter(Boolean);
}

const STATUS_BADGE: Record<string, string> = {
  "새가족": "accent", "정착중": "teal", "정착": "success",
  "간헐": "warning", "위험": "danger", "휴면": "gray", "졸업/전출": "gray",
};
const NOTE_ICONS: Record<string, string> = { memo: "📝", prayer: "🙏", visit: "🏠", event: "🎉" };
const NOTE_LABELS: Record<string, string> = { memo: "메모", prayer: "기도제목", visit: "심방", event: "경조사" };

/* ---------- Colors (same as FinancePage) ---------- */
const C = {
  bg: "#f8f7f4", card: "#ffffff", navy: "#1b2a4a", navyLight: "#2d4373",
  text: "#1b2a4a", textMuted: "#6b7b9e", textFaint: "#a0aec0",
  border: "#e8e6e1", borderLight: "#f0eeeb",
  accent: "#4361ee", accentBg: "#eef0ff",
  success: "#06d6a0", successBg: "#e6faf3",
  danger: "#ef476f", dangerBg: "#fde8ed",
  warning: "#ffd166", warningBg: "#fff8e6",
  purple: "#7209b7", purpleBg: "#f3e8ff",
  teal: "#118ab2", tealBg: "#e4f4fb",
  pink: "#f72585", pinkBg: "#fde4f0",
  orange: "#ff9500",
};

const statusColors: Record<string, string> = {
  "새가족": C.accent, "정착중": C.teal, "정착": C.success,
  "간헐": C.orange, "위험": C.danger, "휴면": C.textMuted,
};
const badgeBg: Record<string, [string, string]> = {
  accent: [C.accent, C.accentBg], teal: [C.teal, C.tealBg], success: [C.success, C.successBg],
  warning: ["#946b00", C.warningBg], danger: [C.danger, C.dangerBg], gray: [C.textMuted, "rgba(107,123,158,0.1)"],
  purple: [C.purple, C.purpleBg], pink: [C.pink, C.pinkBg],
};

/* ---------- Icons ---------- */
const Icons = {
  Search: () => <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="11" cy="11" r="8"/><path d="M21 21l-4.35-4.35"/></svg>,
  Plus: () => <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M12 5v14M5 12h14"/></svg>,
  X: () => <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M18 6L6 18M6 6l12 12"/></svg>,
  Export: () => <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4M7 10l5 5 5-5M12 15V3"/></svg>,
  Church: () => <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M12 2v4M10 6h4M8 6v4l-5 3v9h18v-9l-5-3V6"/><rect x="10" y="16" width="4" height="6"/></svg>,
};

/* ---------- Shared UI ---------- */
function Card({ children, style, onClick }: { children: ReactNode; style?: CSSProperties; onClick?: () => void }) {
  return <div onClick={onClick} style={{ background: C.card, borderRadius: 16, border: `1px solid ${C.border}`, padding: 24, transition: "all 0.2s", cursor: onClick ? "pointer" : "default", ...style }}>{children}</div>;
}

function SBadge({ children, variant = "gray" }: { children: ReactNode; variant?: string }) {
  const [color, bg] = badgeBg[variant] || badgeBg.gray;
  return <span style={{ display: "inline-flex", alignItems: "center", gap: 4, padding: "4px 12px", borderRadius: 20, fontSize: 12, fontWeight: 600, color, background: bg, whiteSpace: "nowrap" }}>{children}</span>;
}

function Btn({ children, onClick, variant = "primary", size = "md", icon, style: s }: { children?: ReactNode; onClick?: (e?: React.MouseEvent) => void; variant?: string; size?: string; icon?: ReactNode; style?: CSSProperties }) {
  const base: CSSProperties = { display: "inline-flex", alignItems: "center", gap: 6, border: "none", borderRadius: 10, cursor: "pointer", fontWeight: 600, fontFamily: "inherit", transition: "all 0.15s", fontSize: size === "sm" ? 13 : 14, padding: size === "sm" ? "6px 14px" : "10px 20px" };
  const v: Record<string, CSSProperties> = {
    primary: { background: C.navy, color: "#fff" }, accent: { background: C.accent, color: "#fff" },
    success: { background: C.success, color: "#fff" }, danger: { background: C.danger, color: "#fff" },
    ghost: { background: "transparent", color: C.navy, border: `1px solid ${C.border}` },
    soft: { background: C.accentBg, color: C.accent },
  };
  return <button onClick={onClick} style={{ ...base, ...(v[variant] || v.primary), ...s }}>{icon}{children}</button>;
}

function FormInput({ label, ...props }: { label?: string; [k: string]: unknown }) {
  return (
    <div style={{ marginBottom: 16 }}>
      {label && <label style={{ display: "block", fontSize: 13, fontWeight: 600, color: C.navy, marginBottom: 6 }}>{label}</label>}
      <input {...(props as React.InputHTMLAttributes<HTMLInputElement>)} style={{ width: "100%", padding: "10px 14px", borderRadius: 10, border: `1px solid ${C.border}`, fontSize: 14, fontFamily: "inherit", color: C.text, background: "#fff", outline: "none", ...(props.style as CSSProperties || {}) }} />
    </div>
  );
}

function FormSelect({ label, options, ...props }: { label?: string; options: { value: string; label: string }[]; [k: string]: unknown }) {
  return (
    <div style={{ marginBottom: 16 }}>
      {label && <label style={{ display: "block", fontSize: 13, fontWeight: 600, color: C.navy, marginBottom: 6 }}>{label}</label>}
      <select {...(props as React.SelectHTMLAttributes<HTMLSelectElement>)} style={{ width: "100%", padding: "10px 14px", borderRadius: 10, border: `1px solid ${C.border}`, fontSize: 14, fontFamily: "inherit", color: C.text, background: "#fff", outline: "none", cursor: "pointer", ...(props.style as CSSProperties || {}) }}>
        {options.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
      </select>
    </div>
  );
}

function FormTextarea({ label, ...props }: { label?: string; [k: string]: unknown }) {
  return (
    <div style={{ marginBottom: 16 }}>
      {label && <label style={{ display: "block", fontSize: 13, fontWeight: 600, color: C.navy, marginBottom: 6 }}>{label}</label>}
      <textarea {...(props as React.TextareaHTMLAttributes<HTMLTextAreaElement>)} style={{ width: "100%", padding: "10px 14px", borderRadius: 10, border: `1px solid ${C.border}`, fontSize: 14, fontFamily: "inherit", color: C.text, background: "#fff", outline: "none", resize: "vertical", minHeight: 72, ...(props.style as CSSProperties || {}) }} />
    </div>
  );
}

function Modal({ open, onClose, title, children, width = 540 }: { open: boolean; onClose: () => void; title: string; children: ReactNode; width?: number }) {
  const mob = useIsMobile();
  if (!open) return null;
  return (
    <div style={{ position: "fixed", inset: 0, zIndex: 1000, display: "flex", alignItems: mob ? "flex-end" : "center", justifyContent: "center", background: "rgba(27,42,74,0.4)", backdropFilter: "blur(4px)", padding: mob ? 0 : 20 }} onClick={onClose}>
      <div onClick={e => e.stopPropagation()} style={{ background: "#fff", borderRadius: mob ? "20px 20px 0 0" : 20, padding: mob ? 20 : 32, width: mob ? "100%" : "90%", maxWidth: mob ? "100%" : width, maxHeight: mob ? "92vh" : "85vh", overflowY: "auto", boxShadow: "0 20px 60px rgba(27,42,74,0.15)" }}>
        {mob && <div style={{ width: 36, height: 4, background: C.border, borderRadius: 4, margin: "0 auto 12px" }} />}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
          <h3 style={{ margin: 0, fontSize: mob ? 17 : 20, color: C.navy }}>{title}</h3>
          <button onClick={onClose} style={{ background: "none", border: "none", cursor: "pointer", padding: 4, borderRadius: 8, display: "flex" }}><Icons.X /></button>
        </div>
        {children}
      </div>
    </div>
  );
}

function StatCard({ label, value, sub, color = C.accent }: { label: string; value: string; sub?: string; color?: string }) {
  return (
    <Card style={{ display: "flex", flexDirection: "column", gap: 4, position: "relative", overflow: "hidden", padding: "20px 24px" }}>
      <div style={{ position: "absolute", top: -10, right: -10, width: 60, height: 60, borderRadius: "50%", background: `${color}15` }} />
      <div style={{ fontSize: 13, color: C.textMuted, fontWeight: 500 }}>{label}</div>
      <div style={{ fontSize: 26, fontWeight: 700, color: C.navy, letterSpacing: "-0.5px" }}>{value}</div>
      {sub && <div style={{ fontSize: 12, color: C.textMuted }}>{sub}</div>}
    </Card>
  );
}

function Progress({ pct, color }: { pct: number; color: string }) {
  return <div style={{ height: 6, borderRadius: 3, background: C.bg, overflow: "hidden" }}><div style={{ height: "100%", borderRadius: 3, width: `${pct}%`, background: color, transition: "width 0.5s ease" }} /></div>;
}

function AttDot({ status, onClick }: { status: string; onClick: () => void }) {
  const colors: Record<string, string> = { p: C.success, l: C.warning, a: C.danger, n: C.border };
  return <div onClick={e => { e.stopPropagation(); onClick(); }} style={{ width: 14, height: 14, borderRadius: "50%", background: colors[status] || C.border, cursor: "pointer", transition: "transform 0.15s", border: `2px solid ${(colors[status] || C.border)}30` }} />;
}

function NoteCard({ n, mbrName, mbrDept, onClick }: { n: Note; mbrName?: string; mbrDept?: string; onClick?: () => void }) {
  const borderColors: Record<string, string> = { memo: C.accent, prayer: C.purple, visit: C.teal, event: C.pink };
  const badgeV: Record<string, string> = { memo: "gray", prayer: "purple", visit: "teal", event: "pink" };
  return (
    <div onClick={onClick} style={{ background: C.bg, borderRadius: 10, padding: "14px 16px", borderLeft: `3px solid ${borderColors[n.type] || C.accent}`, marginBottom: 10, cursor: onClick ? "pointer" : "default" }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 4 }}>
        <span style={{ fontSize: 12, color: C.textFaint, fontWeight: 500 }}>{n.date}{mbrName ? ` · ${mbrName}` : ""}{mbrDept ? ` (${mbrDept})` : ""}</span>
        <SBadge variant={badgeV[n.type] || "gray"}>{NOTE_ICONS[n.type] || "📝"} {NOTE_LABELS[n.type] || "메모"}</SBadge>
      </div>
      <div style={{ fontSize: 13, lineHeight: 1.6, color: C.text }}>{n.content}</div>
    </div>
  );
}

function DetailRow({ icon, label, value }: { icon: string; label: string; value: string }) {
  return (
    <div style={{ display: "flex", alignItems: "flex-start", gap: 12, padding: "10px 14px", background: C.bg, borderRadius: 8, marginBottom: 6 }}>
      <span style={{ fontSize: 17, flexShrink: 0, marginTop: 1 }}>{icon}</span>
      <div><div style={{ fontSize: 11, color: C.textMuted, fontWeight: 500 }}>{label}</div><div style={{ fontSize: 14, color: C.text, marginTop: 1 }}>{value}</div></div>
    </div>
  );
}

/* ---------- CSV helper ---------- */
function csvRow(arr: (string | number)[]) { return arr.map(c => `"${String(c || "").replace(/"/g, '""')}"`).join(","); }
function dlCSV(csv: string, name: string) {
  const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8;" });
  const a = document.createElement("a"); a.href = URL.createObjectURL(blob); a.download = name; a.click();
}

/* ---------- Photo compress ---------- */
function compressPhoto(src: string, cb: (r: string) => void) {
  if (typeof window === "undefined") return;
  const img = new Image();
  img.onload = () => {
    const c = document.createElement("canvas");
    let w = img.width, h = img.height;
    if (w > 300) { h = (300 / w) * h; w = 300; }
    c.width = w; c.height = h;
    c.getContext("2d")?.drawImage(img, 0, 0, w, h);
    cb(c.toDataURL("image/jpeg", 0.7));
  };
  img.src = src;
}

/* ============================================================
   SUB-PAGES
   ============================================================ */

/* ====== Dashboard ====== */
function DashboardSub({ db, currentWeek }: { db: DB; currentWeek: number }) {
  const mob = useIsMobile();
  const m = db.members.filter(x => x.status !== "졸업/전출");
  const total = m.length;
  const att = m.filter(s => (db.attendance[s.id] || {})[currentWeek] === "p").length;
  const newF = m.filter(s => s.status === "새가족" || s.status === "정착중").length;
  const risk = m.filter(s => s.status === "위험" || s.status === "휴면").length;
  const prayers = m.filter(s => s.prayer && s.prayer.trim()).length;
  const rate = total > 0 ? Math.round(att / total * 100) : 0;

  const monthlyAtt = useMemo(() => {
    const data = new Array(12).fill(0);
    m.forEach(s => {
      const a = db.attendance[s.id] || {};
      Object.keys(a).forEach(w => {
        const wn = parseInt(w);
        const mn = Math.min(11, Math.floor((wn - 1) / 4.33));
        if (a[parseInt(w)] === "p") data[mn]++;
      });
    });
    return data;
  }, [db, m]);

  const statusCounts = useMemo(() => {
    const r: Record<string, number> = {};
    m.forEach(s => { r[s.status || ""] = (r[s.status || ""] || 0) + 1; });
    return r;
  }, [m]);

  const deptCounts = useMemo(() => {
    const r: Record<string, number> = {};
    m.forEach(s => { r[s.dept || ""] = (r[s.dept || ""] || 0) + 1; });
    return Object.entries(r).sort((a, b) => b[1] - a[1]);
  }, [m]);

  const recentNotes = useMemo(() => {
    const all: (Note & { mbrName: string; mbrId: string; mbrDept: string })[] = [];
    Object.keys(db.notes).forEach(mid => {
      const mbr = db.members.find(x => x.id === mid);
      (db.notes[mid] || []).forEach(n => all.push({ ...n, mbrName: mbr?.name || "?", mbrId: mid, mbrDept: mbr?.dept || "" }));
    });
    return all.sort((a, b) => (b.date || "").localeCompare(a.date || "")).slice(0, 6);
  }, [db]);

  const deptColors = [C.accent, C.pink, C.purple, C.success, C.teal, C.orange, C.danger, C.warning];
  const maxBar = Math.max(...monthlyAtt, 1);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: 16 }}>
        <StatCard label="전체 성도" value={`${total}명`} sub="활성 등록" color={C.accent} />
        <StatCard label="금주 출석률" value={`${rate}%`} sub={`${att}/${total}명 출석`} color={C.success} />
        <StatCard label="새가족" value={`${newF}명`} sub="정착 진행중" color={C.teal} />
        <StatCard label="위험/휴면" value={`${risk}명`} sub="관심 필요" color={C.danger} />
        <StatCard label="기도제목" value={`${prayers}건`} sub="함께 기도합니다" color={C.purple} />
      </div>

      <div style={{ display: "grid", gridTemplateColumns: mob ? "1fr" : "1fr 1fr", gap: 16 }}>
        <Card style={{ padding: 0, overflow: "hidden" }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: mob ? "12px 16px" : "16px 24px", borderBottom: `1px solid ${C.border}` }}>
            <h4 style={{ margin: 0, fontSize: mob ? 14 : 16, fontWeight: 700, color: C.navy }}>월별 출석 추이</h4>
            <SBadge variant="accent">2025년</SBadge>
          </div>
          <div style={{ padding: "20px 24px 16px", display: "flex", alignItems: "end", gap: 6, height: 180 }}>
            {monthlyAtt.map((v, i) => {
              const h = Math.max(4, (v / maxBar) * 140);
              return (
                <div key={i} style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", gap: 4 }}>
                  <span style={{ fontSize: 10, color: C.textMuted }}>{v || ""}</span>
                  <div style={{ width: "100%", height: h, minHeight: 4, background: `linear-gradient(to top, ${C.accent}, ${C.accent}aa)`, borderRadius: "6px 6px 2px 2px", transition: "height 0.3s" }} />
                  <span style={{ fontSize: 10, color: C.textMuted }}>{i + 1}월</span>
                </div>
              );
            })}
          </div>
        </Card>

        <Card style={{ padding: 0, overflow: "hidden" }}>
          <div style={{ padding: "16px 24px", borderBottom: `1px solid ${C.border}` }}>
            <h4 style={{ margin: 0, fontSize: 16, fontWeight: 700, color: C.navy }}>상태별 현황</h4>
          </div>
          <div style={{ padding: "20px 24px" }}>
            {Object.entries(statusCounts).map(([st, cnt]) => {
              const pct = total > 0 ? (cnt / total * 100) : 0;
              return (
                <div key={st} style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 10 }}>
                  <span style={{ fontSize: 13, fontWeight: 600, color: C.navy, width: 60 }}>{st}</span>
                  <div style={{ flex: 1 }}><Progress pct={pct} color={statusColors[st] || C.border} /></div>
                  <span style={{ fontSize: 13, color: C.textMuted, minWidth: 80, textAlign: "right" }}>{cnt}명 ({pct.toFixed(0)}%)</span>
                </div>
              );
            })}
          </div>
        </Card>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: mob ? "1fr" : "1fr 1fr", gap: 16 }}>
        <Card style={{ padding: 0, overflow: "hidden" }}>
          <div style={{ padding: mob ? "12px 16px" : "16px 24px", borderBottom: `1px solid ${C.border}` }}>
            <h4 style={{ margin: 0, fontSize: mob ? 14 : 16, fontWeight: 700, color: C.navy }}>부서별 인원</h4>
          </div>
          <div style={{ padding: "20px 24px" }}>
            {deptCounts.map(([d, cnt], i) => {
              const pct = total > 0 ? (cnt / total * 100) : 0;
              const clr = deptColors[i % deptColors.length];
              return (
                <div key={d} style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 10 }}>
                  <div style={{ width: 28, height: 28, borderRadius: 8, background: `${clr}15`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 12, fontWeight: 700, color: clr }}>{d[0]}</div>
                  <span style={{ fontSize: 13, fontWeight: 600, color: C.navy, width: 60 }}>{d}</span>
                  <div style={{ flex: 1 }}><Progress pct={pct} color={clr} /></div>
                  <span style={{ fontSize: 13, color: C.textMuted }}>{cnt}명</span>
                </div>
              );
            })}
          </div>
        </Card>

        <Card style={{ padding: 0, overflow: "hidden" }}>
          <div style={{ padding: "16px 24px", borderBottom: `1px solid ${C.border}` }}>
            <h4 style={{ margin: 0, fontSize: 16, fontWeight: 700, color: C.navy }}>최근 기록</h4>
          </div>
          <div style={{ padding: "16px 24px", maxHeight: 300, overflowY: "auto" }}>
            {recentNotes.length ? recentNotes.map((n, i) => <NoteCard key={i} n={n} mbrName={n.mbrName} />) : <div style={{ textAlign: "center", color: C.textMuted, padding: 20 }}>기록이 없습니다</div>}
          </div>
        </Card>
      </div>
    </div>
  );
}

/* ====== Members ====== */
const ROLE_PRIORITY: Record<string, number> = { "장로": 0, "안수집사": 1, "권사": 2, "집사": 3, "청년": 4, "성도": 5, "학생": 6, "새가족": 7, "영아": 8 };

function MembersSub({ db, setDb, persist, toast, currentWeek, openMemberModal, openDetail, openNoteModal }: {
  db: DB; setDb: (fn: (prev: DB) => DB) => void; persist: () => void;
  toast: (m: string, t?: string) => void; currentWeek: number;
  openMemberModal: (id?: string) => void; openDetail: (id: string) => void; openNoteModal: (id: string) => void;
}) {
  const mob = useIsMobile();
  const [search, setSearch] = useState("");
  const [deptF, setDeptF] = useState("all");
  const [statusF, setStatusF] = useState("all");
  const [viewMode, setViewMode] = useState<"list" | "group">("group");
  const depts = getDepts(db);

  const filtered = useMemo(() => {
    let r = db.members.filter(m => m.status !== "졸업/전출");
    if (search) { const q = search.toLowerCase(); r = r.filter(m => (m.name || "").toLowerCase().includes(q) || (m.phone || "").includes(q) || (m.memo || "").toLowerCase().includes(q) || (m.prayer || "").toLowerCase().includes(q)); }
    if (deptF !== "all") r = r.filter(m => m.dept === deptF);
    if (statusF !== "all") r = r.filter(m => m.status === statusF);
    return r;
  }, [db.members, search, deptF, statusF]);

  /* 목장별 그룹핑 (목자=직분 높은 순 정렬) */
  const grouped = useMemo(() => {
    const map: Record<string, Member[]> = {};
    filtered.forEach(m => {
      const g = m.group || "미배정";
      if (!map[g]) map[g] = [];
      map[g].push(m);
    });
    for (const arr of Object.values(map)) {
      arr.sort((a, b) => (ROLE_PRIORITY[a.role || ""] ?? 99) - (ROLE_PRIORITY[b.role || ""] ?? 99));
    }
    return Object.entries(map).sort(([a], [b]) => a.localeCompare(b));
  }, [filtered]);

  const cycleAtt = (id: string) => {
    setDb(prev => {
      const att = { ...prev.attendance };
      if (!att[id]) att[id] = {};
      const cur = att[id][currentWeek] || "n";
      const next = ({ n: "p", p: "l", l: "a", a: "n" } as Record<string, AttStatus>)[cur] || "n";
      att[id] = { ...att[id], [currentWeek]: next };
      const labels: Record<string, string> = { p: "출석", l: "지각", a: "결석", n: "미기록" };
      toast(labels[next] + "으로 변경", "ok");
      return { ...prev, attendance: att };
    });
    persist();
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
      {/* ─── 필터 바 ─── */}
      <div style={{ display: "flex", gap: mob ? 8 : 12, alignItems: "center", flexWrap: "wrap" }}>
        <div style={{ position: "relative", flex: 1, minWidth: mob ? 0 : 200, width: mob ? "100%" : undefined }}>
          <div style={{ position: "absolute", left: 12, top: "50%", transform: "translateY(-50%)", color: C.textMuted }}><Icons.Search /></div>
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="이름, 연락처 검색..." style={{ width: "100%", height: mob ? 36 : 40, padding: "0 14px 0 38px", fontFamily: "inherit", fontSize: mob ? 13 : 14, background: "#fff", border: `1px solid ${C.border}`, borderRadius: 10, color: C.text, outline: "none" }} />
        </div>
        {mob ? (
          <div style={{ display: "flex", gap: 6, width: "100%" }}>
            <select value={deptF} onChange={e => setDeptF(e.target.value)} style={{ flex: 1, height: 36, padding: "0 8px", fontFamily: "inherit", fontSize: 12, background: "#fff", border: `1px solid ${C.border}`, borderRadius: 8, color: C.text, outline: "none", cursor: "pointer" }}>
              <option value="all">전체 부서</option>
              {depts.map(d => <option key={d} value={d}>{d}</option>)}
            </select>
            <select value={statusF} onChange={e => setStatusF(e.target.value)} style={{ flex: 1, height: 36, padding: "0 8px", fontFamily: "inherit", fontSize: 12, background: "#fff", border: `1px solid ${C.border}`, borderRadius: 8, color: C.text, outline: "none", cursor: "pointer" }}>
              <option value="all">전체 상태</option>
              {["새가족","정착중","정착","간헐","위험","휴면"].map(s => <option key={s} value={s}>{s}</option>)}
            </select>
            <SBadge variant="accent">{filtered.length}명</SBadge>
          </div>
        ) : (
          <>
            <select value={deptF} onChange={e => setDeptF(e.target.value)} style={{ height: 40, padding: "0 32px 0 12px", fontFamily: "inherit", fontSize: 14, background: "#fff", border: `1px solid ${C.border}`, borderRadius: 10, color: C.text, outline: "none", cursor: "pointer" }}>
              <option value="all">전체 부서</option>
              {depts.map(d => <option key={d} value={d}>{d}</option>)}
            </select>
            <select value={statusF} onChange={e => setStatusF(e.target.value)} style={{ height: 40, padding: "0 32px 0 12px", fontFamily: "inherit", fontSize: 14, background: "#fff", border: `1px solid ${C.border}`, borderRadius: 10, color: C.text, outline: "none", cursor: "pointer" }}>
              <option value="all">전체 상태</option>
              {["새가족","정착중","정착","간헐","위험","휴면"].map(s => <option key={s} value={s}>{s}</option>)}
            </select>
            <SBadge variant="accent">{filtered.length}명</SBadge>
            <Btn onClick={() => openMemberModal()} icon={<Icons.Plus />}>성도 등록</Btn>
          </>
        )}
      </div>

      {/* ─── 뷰 토글 ─── */}
      <div style={{ display: "flex", gap: 4, background: C.bg, borderRadius: 10, padding: 3, width: "fit-content" }}>
        {([["group", "🏠 목장별"], ["list", "📋 목록"]] as const).map(([v, label]) => (
          <button key={v} onClick={() => setViewMode(v as "list" | "group")} style={{
            padding: mob ? "6px 14px" : "7px 18px", borderRadius: 8, border: "none",
            fontSize: mob ? 12 : 13, fontWeight: 600, fontFamily: "inherit",
            background: viewMode === v ? C.card : "transparent",
            color: viewMode === v ? C.navy : C.textMuted,
            cursor: "pointer",
            boxShadow: viewMode === v ? "0 1px 4px rgba(0,0,0,0.06)" : "none",
            transition: "all 0.15s",
          }}>{label}</button>
        ))}
      </div>

      {/* ─── 목장별 뷰 ─── */}
      {viewMode === "group" && (
        <div style={{ display: "grid", gridTemplateColumns: mob ? "1fr" : "1fr 1fr", gap: 16 }}>
          {grouped.length === 0 ? (
            <Card><div style={{ textAlign: "center", color: C.textMuted, padding: 24 }}>검색 결과가 없습니다</div></Card>
          ) : grouped.map(([gName, gMembers]) => (
            <Card key={gName} style={{ padding: 0, overflow: "hidden" }}>
              {/* 목장 헤더 — 굵은 글씨 */}
              <div style={{
                padding: mob ? "14px 16px" : "16px 20px",
                background: `linear-gradient(135deg, ${C.navy}, ${C.navyLight})`,
                display: "flex", alignItems: "center", justifyContent: "space-between",
              }}>
                <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                  <span style={{ fontSize: 20 }}>🏠</span>
                  <span style={{ fontWeight: 900, fontSize: mob ? 16 : 18, color: "#fff", letterSpacing: "-0.3px" }}>{gName}</span>
                </div>
                <span style={{
                  fontSize: 13, fontWeight: 600, color: "rgba(255,255,255,0.75)",
                  background: "rgba(255,255,255,0.12)", padding: "4px 14px", borderRadius: 20,
                }}>{gMembers.length}명</span>
              </div>

              {/* 목장원 리스트 */}
              <div style={{ padding: "4px 0" }}>
                {gMembers.map((m, idx) => {
                  const ws = (db.attendance[m.id] || {})[currentWeek] || "n";
                  const isLeader = idx === 0;
                  return (
                    <div key={m.id} onClick={() => openDetail(m.id)}
                      style={{
                        display: "flex", alignItems: "center", gap: mob ? 10 : 14,
                        padding: mob ? "10px 14px" : "10px 20px", cursor: "pointer",
                        borderBottom: idx < gMembers.length - 1 ? `1px solid ${C.borderLight}` : "none",
                        transition: "background 0.1s",
                      }}
                      onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = C.bg; }}
                      onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = "transparent"; }}>
                      <div style={{
                        width: 36, height: 36, borderRadius: "50%", display: "flex",
                        alignItems: "center", justifyContent: "center", fontSize: 13, fontWeight: 700,
                        background: isLeader
                          ? `linear-gradient(135deg, ${C.accent}, ${C.purple})`
                          : `linear-gradient(135deg, ${C.accentBg}, ${C.tealBg})`,
                        color: isLeader ? "#fff" : C.accent, overflow: "hidden", flexShrink: 0,
                      }}>
                        {m.photo ? <img src={m.photo} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} /> : (m.name || "?")[0]}
                      </div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                          <span style={{ fontWeight: 700, fontSize: mob ? 14 : 15, color: C.navy }}>{m.name}</span>
                          <span style={{ fontSize: 12, color: C.textMuted, fontWeight: 500 }}>{m.role || ""}</span>
                          {isLeader && (
                            <span style={{
                              fontSize: 10, fontWeight: 700, color: C.accent,
                              background: C.accentBg, padding: "2px 8px", borderRadius: 10,
                            }}>목자</span>
                          )}
                        </div>
                        <div style={{
                          fontSize: 12, color: C.textMuted, marginTop: 2,
                          overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
                        }}>{m.phone || ""}{m.dept ? ` · ${m.dept}` : ""}</div>
                      </div>
                      <AttDot status={ws} onClick={() => cycleAtt(m.id)} />
                    </div>
                  );
                })}
              </div>
            </Card>
          ))}
        </div>
      )}

      {/* ─── 기존 목록 뷰 ─── */}
      {viewMode === "list" && (
        <Card style={{ padding: 0, overflow: "hidden" }}>
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 14 }}>
              <thead>
                <tr style={{ background: C.bg }}>
                  {["이름","부서","직분","상태","출석","기도제목","최근 메모",""].map((h, i) => (
                    <th key={i} style={{ padding: "12px 16px", textAlign: "left", fontWeight: 600, fontSize: 13, color: C.navy, borderBottom: `1px solid ${C.border}`, whiteSpace: "nowrap" }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filtered.length === 0 ? (
                  <tr><td colSpan={8} style={{ padding: 48, textAlign: "center", color: C.textMuted }}>
                    <div style={{ fontSize: 48, opacity: 0.3, marginBottom: 12 }}>📭</div>
                    <div style={{ fontSize: 17, fontWeight: 600, color: C.text, marginBottom: 6 }}>성도가 없습니다</div>
                    <div style={{ fontSize: 14 }}>&apos;+ 성도 등록&apos; 버튼으로 첫 성도를 등록해 주세요</div>
                  </td></tr>
                ) : filtered.map(m => {
                  const ws = (db.attendance[m.id] || {})[currentWeek] || "n";
                  const lastNote = (db.notes[m.id] || []).slice(-1)[0];
                  const prayerSnip = m.prayer ? (m.prayer.length > 20 ? m.prayer.substring(0, 20) + "…" : m.prayer) : "-";
                  return (
                    <tr key={m.id} onClick={() => openDetail(m.id)} style={{ cursor: "pointer", borderBottom: `1px solid ${C.borderLight}`, transition: "background 0.1s" }}
                      onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = C.bg; }}
                      onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = "transparent"; }}>
                      <td style={{ padding: "12px 16px" }}>
                        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                          <div style={{ width: 38, height: 38, borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 14, fontWeight: 700, background: `linear-gradient(135deg,${C.accentBg},${C.tealBg})`, color: C.accent, overflow: "hidden", flexShrink: 0 }}>
                            {m.photo ? <img src={m.photo} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} /> : (m.name || "?")[0]}
                          </div>
                          <div><div style={{ fontWeight: 600, color: C.navy }}>{m.name}</div><div style={{ fontSize: 12, color: C.textMuted }}>{m.phone || ""}</div></div>
                        </div>
                      </td>
                      <td style={{ padding: "12px 16px" }}><SBadge variant="gray">{m.dept || "-"}</SBadge></td>
                      <td style={{ padding: "12px 16px", whiteSpace: "nowrap" }}>{m.role || "-"}</td>
                      <td style={{ padding: "12px 16px" }}><SBadge variant={STATUS_BADGE[m.status || ""] || "gray"}>{m.status || "-"}</SBadge></td>
                      <td style={{ padding: "12px 16px" }}><AttDot status={ws} onClick={() => cycleAtt(m.id)} /></td>
                      <td style={{ padding: "12px 16px", maxWidth: 150, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", fontSize: 13, color: C.purple }}>{prayerSnip}</td>
                      <td style={{ padding: "12px 16px" }}>
                        {lastNote ? <SBadge variant={lastNote.type === "prayer" ? "purple" : "gray"}>{(NOTE_ICONS[lastNote.type] || "📝")} {lastNote.content.substring(0, 15)}…</SBadge> : <span style={{ color: C.textFaint, fontSize: 12 }}>-</span>}
                      </td>
                      <td style={{ padding: "12px 16px" }}><Btn variant="soft" size="sm" onClick={(e) => { e?.stopPropagation(); openNoteModal(m.id); }}>📝</Btn></td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </Card>
      )}
    </div>
  );
}

/* ====== Attendance ====== */
function AttendanceSub({ db, setDb, persist, toast, currentWeek, setCurrentWeek }: {
  db: DB; setDb: (fn: (prev: DB) => DB) => void; persist: () => void;
  toast: (m: string, t?: string) => void; currentWeek: number; setCurrentWeek: (w: number) => void;
}) {
  const mob = useIsMobile();
  const [deptF, setDeptF] = useState("all");
  const depts = getDepts(db);
  let m = db.members.filter(x => x.status !== "졸업/전출");
  if (deptF !== "all") m = m.filter(x => x.dept === deptF);

  const present = m.filter(s => (db.attendance[s.id] || {})[currentWeek] === "p").length;
  const late = m.filter(s => (db.attendance[s.id] || {})[currentWeek] === "l").length;
  const absent = m.filter(s => (db.attendance[s.id] || {})[currentWeek] === "a").length;
  const unchecked = m.length - present - late - absent;
  const rate = m.length > 0 ? Math.round(present / m.length * 100) : 0;

  const cycleAtt = (id: string) => {
    setDb(prev => {
      const att = { ...prev.attendance };
      if (!att[id]) att[id] = {};
      const cur = att[id][currentWeek] || "n";
      const next = ({ n: "p", p: "l", l: "a", a: "n" } as Record<string, AttStatus>)[cur] || "n";
      att[id] = { ...att[id], [currentWeek]: next };
      const labels: Record<string, string> = { p: "출석", l: "지각", a: "결석", n: "미기록" };
      toast(labels[next] + "으로 변경", "ok");
      return { ...prev, attendance: att };
    });
    persist();
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
      <Card>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: mob ? 8 : 12, marginBottom: 16 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <Btn variant="ghost" size="sm" onClick={() => setCurrentWeek(Math.max(1, currentWeek - 1))} style={{ width: 32, height: 32, padding: 0, justifyContent: "center" }}>◀</Btn>
            <span style={{ fontSize: mob ? 15 : 18, fontWeight: 700, minWidth: mob ? 60 : 80, textAlign: "center" }}>제{currentWeek}주</span>
            <Btn variant="ghost" size="sm" onClick={() => setCurrentWeek(Math.min(52, currentWeek + 1))} style={{ width: 32, height: 32, padding: 0, justifyContent: "center" }}>▶</Btn>
          </div>
          <select value={deptF} onChange={e => setDeptF(e.target.value)} style={{ height: mob ? 36 : 40, padding: "0 12px", fontFamily: "inherit", fontSize: mob ? 12 : 14, background: "#fff", border: `1px solid ${C.border}`, borderRadius: 10, color: C.text, outline: "none", cursor: "pointer" }}>
            <option value="all">전체 부서</option>
            {depts.map(d => <option key={d} value={d}>{d}</option>)}
          </select>
        </div>
        {!mob && <div style={{ display: "flex", gap: 3, flexWrap: "wrap" }}>
          {Array.from({ length: 52 }, (_, i) => i + 1).map(w => {
            const hasData = db.members.some(x => db.attendance[x.id] && db.attendance[x.id][w]);
            const isActive = w === currentWeek;
            return (
              <div key={w} onClick={() => setCurrentWeek(w)} style={{
                width: 24, height: 24, borderRadius: 6, fontSize: 10, fontWeight: 600,
                display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer",
                background: isActive ? C.accent : hasData ? C.accentBg : C.bg,
                color: isActive ? "#fff" : hasData ? C.accent : C.textFaint,
                border: isActive ? `1.5px solid ${C.accent}30` : "1.5px solid transparent", transition: "all 0.15s",
              }}>{w}</div>
            );
          })}
        </div>}
      </Card>

      <div style={{ display: "grid", gridTemplateColumns: mob ? "1fr 1fr" : "repeat(auto-fit, minmax(180px, 1fr))", gap: mob ? 10 : 16 }}>
        <StatCard label="출석" value={`${present}명`} color={C.success} />
        <StatCard label="지각" value={`${late}명`} color={C.orange} />
        <StatCard label="결석" value={`${absent}명`} color={C.danger} />
        <StatCard label="출석률" value={`${rate}%`} sub={`${unchecked}명 미체크`} color={C.accent} />
      </div>

      <Card style={{ padding: 0, overflow: "hidden" }}>
        <div style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 14 }}>
            <thead><tr style={{ background: C.bg }}>
              {["이름","부서","상태","출석체크","연속출석"].map((h, i) => (
                <th key={i} style={{ padding: "12px 16px", textAlign: i === 3 ? "center" : "left", fontWeight: 600, fontSize: 13, color: C.navy, borderBottom: `1px solid ${C.border}`, whiteSpace: "nowrap" }}>{h}</th>
              ))}
            </tr></thead>
            <tbody>
              {m.map(s => {
                const att = db.attendance[s.id] || {};
                const ws = att[currentWeek] || "n";
                const labels: Record<string, string> = { p: "출석", l: "지각", a: "결석", n: "미체크" };
                let streak = 0;
                for (let w = currentWeek; w >= 1; w--) { if (att[w] === "p") streak++; else break; }
                return (
                  <tr key={s.id} style={{ borderBottom: `1px solid ${C.borderLight}` }}>
                    <td style={{ padding: "12px 16px" }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                        <div style={{ width: 38, height: 38, borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 14, fontWeight: 700, background: `linear-gradient(135deg,${C.accentBg},${C.tealBg})`, color: C.accent, overflow: "hidden" }}>
                          {s.photo ? <img src={s.photo} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} /> : (s.name || "?")[0]}
                        </div>
                        <strong style={{ color: C.navy }}>{s.name}</strong>
                      </div>
                    </td>
                    <td style={{ padding: "12px 16px" }}><SBadge variant="gray">{s.dept}</SBadge></td>
                    <td style={{ padding: "12px 16px" }}><SBadge variant={STATUS_BADGE[s.status || ""] || "gray"}>{s.status}</SBadge></td>
                    <td style={{ padding: "12px 16px", textAlign: "center" }}>
                      <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 8 }}>
                        <AttDot status={ws} onClick={() => cycleAtt(s.id)} />
                        <span style={{ fontSize: 12, color: C.textMuted }}>{labels[ws]}</span>
                      </div>
                    </td>
                    <td style={{ padding: "12px 16px" }}>{streak > 0 ? <SBadge variant="success">{streak}주 연속</SBadge> : <span style={{ color: C.textFaint }}>-</span>}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}

/* ====== Notes ====== */
function NotesSub({ db, openDetail, openNoteModal }: { db: DB; openDetail: (id: string) => void; openNoteModal: (id?: string) => void }) {
  const mob = useIsMobile();
  const [search, setSearch] = useState("");
  const [typeF, setTypeF] = useState("all");

  const allNotes = useMemo(() => {
    const a: (Note & { mbrName: string; mbrId: string; mbrDept: string })[] = [];
    Object.keys(db.notes).forEach(mid => {
      const mbr = db.members.find(x => x.id === mid);
      (db.notes[mid] || []).forEach(n => a.push({ ...n, mbrName: mbr?.name || "?", mbrId: mid, mbrDept: mbr?.dept || "" }));
    });
    return a;
  }, [db]);

  const filtered = useMemo(() => {
    let r = [...allNotes];
    if (search) { const q = search.toLowerCase(); r = r.filter(n => n.mbrName.toLowerCase().includes(q) || n.content.toLowerCase().includes(q)); }
    if (typeF !== "all") r = r.filter(n => n.type === typeF);
    return r.sort((a, b) => (b.date || "").localeCompare(a.date || ""));
  }, [allNotes, search, typeF]);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
      <div style={{ display: "flex", gap: mob ? 8 : 12, alignItems: "center", flexWrap: "wrap" }}>
        <div style={{ position: "relative", flex: 1, minWidth: mob ? 0 : 200, width: mob ? "100%" : undefined }}>
          <div style={{ position: "absolute", left: 12, top: "50%", transform: "translateY(-50%)", color: C.textMuted }}><Icons.Search /></div>
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="이름, 기도제목 검색..." style={{ width: "100%", height: mob ? 36 : 40, padding: "0 14px 0 38px", fontFamily: "inherit", fontSize: mob ? 13 : 14, background: "#fff", border: `1px solid ${C.border}`, borderRadius: 10, color: C.text, outline: "none" }} />
        </div>
        <select value={typeF} onChange={e => setTypeF(e.target.value)} style={{ height: mob ? 36 : 40, padding: "0 12px", fontFamily: "inherit", fontSize: mob ? 12 : 14, background: "#fff", border: `1px solid ${C.border}`, borderRadius: 10, color: C.text, outline: "none", cursor: "pointer" }}>
          <option value="all">전체 유형</option>
          <option value="memo">📝 메모</option><option value="prayer">🙏 기도</option>
          <option value="visit">🏠 심방</option><option value="event">🎉 경조</option>
        </select>
        <Btn variant="accent" size="sm" onClick={() => openNoteModal()}>+ 기록</Btn>
      </div>
      <div>
        {filtered.length ? filtered.slice(0, 50).map((n, i) => <NoteCard key={i} n={n} mbrName={n.mbrName} mbrDept={n.mbrDept} onClick={() => openDetail(n.mbrId)} />) : (
          <div style={{ textAlign: "center", padding: 48, color: C.textMuted }}><div style={{ fontSize: 48, opacity: 0.3, marginBottom: 12 }}>📝</div><div style={{ fontSize: 17, fontWeight: 600 }}>기록이 없습니다</div></div>
        )}
      </div>
    </div>
  );
}

/* ====== New Family ====== */
function NewFamilySub({ db, currentWeek, openDetail }: { db: DB; currentWeek: number; openDetail: (id: string) => void }) {
  const mob = useIsMobile();
  const nf = db.members.filter(m => m.status === "새가족" || m.status === "정착중");
  const settled = db.members.filter(m => m.status === "정착").length;
  const total = nf.length;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
      <div style={{ display: "grid", gridTemplateColumns: mob ? "1fr" : "repeat(3, 1fr)", gap: 16 }}>
        <StatCard label="현재 새가족" value={`${total}명`} color={C.accent} />
        <StatCard label="정착 완료" value={`${settled}명`} color={C.success} />
        <StatCard label="정착률" value={`${(total + settled) > 0 ? Math.round(settled / (total + settled) * 100) : 0}%`} color={C.purple} />
      </div>
      <Card style={{ padding: 0, overflow: "hidden" }}>
        <div style={{ padding: "16px 24px", borderBottom: `1px solid ${C.border}` }}>
          <h4 style={{ margin: 0, fontSize: 16, fontWeight: 700, color: C.navy }}>새가족 트래킹 (4주)</h4>
        </div>
        <div style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 14 }}>
            <thead><tr style={{ background: C.bg }}>
              {["이름","등록일","경로","1주","2주","3주","4주","상태"].map((h, i) => (
                <th key={i} style={{ padding: "12px 16px", textAlign: i >= 3 && i <= 6 ? "center" : "left", fontWeight: 600, fontSize: 13, color: C.navy, borderBottom: `1px solid ${C.border}`, whiteSpace: "nowrap" }}>{h}</th>
              ))}
            </tr></thead>
            <tbody>
              {nf.length === 0 ? (
                <tr><td colSpan={8} style={{ padding: 32, textAlign: "center", color: C.textMuted }}>새가족이 없습니다</td></tr>
              ) : nf.map(m => {
                const att = db.attendance[m.id] || {};
                const regWeek = currentWeek;
                const weeks = [0, 1, 2, 3].map(i => {
                  const w = regWeek + i;
                  const s = att[w];
                  if (s === "p") return <SBadge variant="success">✓ 출석</SBadge>;
                  if (s === "a") return <SBadge variant="danger">✕ 결석</SBadge>;
                  if (s === "l") return <SBadge variant="warning">△ 지각</SBadge>;
                  return <SBadge variant="gray">—</SBadge>;
                });
                return (
                  <tr key={m.id} onClick={() => openDetail(m.id)} style={{ cursor: "pointer", borderBottom: `1px solid ${C.borderLight}` }}>
                    <td style={{ padding: "12px 16px", fontWeight: 600 }}>{m.name}</td>
                    <td style={{ padding: "12px 16px" }}>{m.createdAt ? m.createdAt.slice(0, 10) : "-"}</td>
                    <td style={{ padding: "12px 16px" }}>{m.source || "-"}</td>
                    {weeks.map((w, i) => <td key={i} style={{ padding: "12px 16px", textAlign: "center" }}>{w}</td>)}
                    <td style={{ padding: "12px 16px" }}><SBadge variant={STATUS_BADGE[m.status || ""] || "gray"}>{m.status}</SBadge></td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}

/* ====== Reports ====== */
function ReportsSub({ db, currentWeek, toast }: { db: DB; currentWeek: number; toast: (m: string, t?: string) => void }) {
  const mob = useIsMobile();
  const expMembers = () => {
    const h = ["이름","부서","직분","상태","성별","생년월일","연락처","주소","가족관계","등록경로","기도제목","메모"];
    const rows = db.members.map(m => csvRow([m.name, m.dept || "", m.role || "", m.status || "", m.gender || "", m.birth || "", m.phone || "", m.address || "", m.family || "", m.source || "", m.prayer || "", m.memo || ""]));
    dlCSV(csvRow(h) + "\n" + rows.join("\n"), `성도명단_${todayStr()}.csv`);
    toast("다운로드 완료", "ok");
  };
  const expAttendance = () => {
    const h = ["이름","부서","상태", ...Array.from({ length: 52 }, (_, i) => `${i + 1}주`)];
    const rows = db.members.filter(m => m.status !== "졸업/전출").map(m => {
      const att = db.attendance[m.id] || {};
      const weeks = Array.from({ length: 52 }, (_, i) => ({ p: "O", l: "△", a: "X" } as Record<string, string>)[att[i + 1] as string] || "");
      return csvRow([m.name, m.dept || "", m.status || "", ...weeks]);
    });
    dlCSV(csvRow(h) + "\n" + rows.join("\n"), `출석부_${todayStr()}.csv`);
    toast("다운로드 완료", "ok");
  };
  const expPrayers = () => {
    const h = ["이름","부서","기도제목"];
    const rows = db.members.filter(m => m.prayer).map(m => csvRow([m.name, m.dept || "", m.prayer || ""]));
    dlCSV(csvRow(h) + "\n" + rows.join("\n"), `기도제목_${todayStr()}.csv`);
    toast("다운로드 완료", "ok");
  };
  const expNotes = () => {
    const h = ["날짜","이름","부서","유형","내용"];
    const rows: string[] = [];
    Object.keys(db.notes).forEach(mid => {
      const mbr = db.members.find(x => x.id === mid);
      (db.notes[mid] || []).forEach(n => rows.push(csvRow([n.date, mbr?.name || "", mbr?.dept || "", NOTE_LABELS[n.type] || "메모", n.content])));
    });
    rows.sort().reverse();
    dlCSV(csvRow(h) + "\n" + rows.join("\n"), `기록전체_${todayStr()}.csv`);
    toast("다운로드 완료", "ok");
  };
  const expNewFamily = () => {
    const nf = db.members.filter(m => m.status === "새가족" || m.status === "정착중");
    const h = ["이름","등록일","경로","1주","2주","3주","4주","상태"];
    const rows = nf.map(m => {
      const att = db.attendance[m.id] || {};
      const rw = currentWeek;
      const weeks = [0, 1, 2, 3].map(i => ({ p: "O", l: "△", a: "X" } as Record<string, string>)[att[rw + i] as string] || "-");
      return csvRow([m.name, m.createdAt || "", m.source || "", ...weeks, m.status || ""]);
    });
    dlCSV(csvRow(h) + "\n" + rows.join("\n"), `새가족현황_${todayStr()}.csv`);
    toast("다운로드 완료", "ok");
  };
  const expFull = () => {
    const m = db.members.filter(x => x.status !== "졸업/전출");
    let csv = `"${db.settings.churchName || "교회"} 목양 종합 보고서 (${todayStr()})"\n\n`;
    csv += '"=== 현황 요약 ==="\n';
    csv += `"전체 성도","${m.length}명"\n`;
    const att = m.filter(s => (db.attendance[s.id] || {})[currentWeek] === "p").length;
    csv += `"금주 출석","${att}명 (${m.length > 0 ? Math.round(att / m.length * 100) : 0}%)"\n`;
    csv += `"새가족","${m.filter(s => s.status === "새가족" || s.status === "정착중").length}명"\n`;
    csv += `"위험/휴면","${m.filter(s => s.status === "위험" || s.status === "휴면").length}명"\n\n`;
    csv += '"=== 부서별 인원 ==="\n"부서","인원"\n';
    const dc: Record<string, number> = {};
    m.forEach(s => { dc[s.dept || ""] = (dc[s.dept || ""] || 0) + 1; });
    Object.entries(dc).forEach(([d, c]) => { csv += `"${d}","${c}"\n`; });
    csv += "\n";
    csv += '"=== 기도제목 ==="\n"이름","부서","기도제목"\n';
    m.filter(s => s.prayer).forEach(s => { csv += csvRow([s.name, s.dept || "", s.prayer || ""]) + "\n"; });
    dlCSV(csv, `목양종합보고서_${todayStr()}.csv`);
    toast("다운로드 완료", "ok");
  };

  const reports = [
    { icon: "👥", title: "성도 명단", desc: "전체 성도 정보 엑셀 다운로드", color: C.accent, fn: expMembers },
    { icon: "📅", title: "출석 현황", desc: "52주 출석 기록 전체 다운로드", color: C.success, fn: expAttendance },
    { icon: "🙏", title: "기도제목 목록", desc: "전 성도 기도제목 다운로드", color: C.purple, fn: expPrayers },
    { icon: "📝", title: "메모/기록 전체", desc: "메모, 심방, 경조사 기록 다운로드", color: C.teal, fn: expNotes },
    { icon: "🌱", title: "새가족 현황", desc: "새가족 4주 트래킹 보고서", color: C.pink, fn: expNewFamily },
    { icon: "📊", title: "목양 종합 보고서", desc: "당회 제출용 종합 보고서", color: C.navy, fn: expFull },
  ];

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
      <Card><p style={{ margin: 0, color: C.textMuted, fontSize: mob ? 13 : 14 }}>원하는 보고서를 클릭하면 엑셀(CSV) 파일로 즉시 다운로드됩니다.</p></Card>
      <div style={{ display: "grid", gridTemplateColumns: mob ? "1fr" : "repeat(auto-fit, minmax(280px, 1fr))", gap: mob ? 10 : 16 }}>
        {reports.map((r, i) => (
          <Card key={i} onClick={r.fn} style={{ cursor: "pointer", transition: "all 0.2s" }}>
            <div style={{ display: "flex", alignItems: "center", gap: mob ? 12 : 16 }}>
              <div style={{ width: mob ? 42 : 52, height: mob ? 42 : 52, borderRadius: 14, background: `${r.color}12`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: mob ? 20 : 24, flexShrink: 0 }}>{r.icon}</div>
              <div style={{ flex: 1, minWidth: 0 }}><div style={{ fontWeight: 700, color: C.navy, fontSize: mob ? 14 : 16, marginBottom: 4, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{r.title}</div><div style={{ fontSize: mob ? 12 : 13, color: C.textMuted, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{r.desc}</div></div>
              <div style={{ color: C.textMuted, flexShrink: 0 }}><Icons.Export /></div>
            </div>
          </Card>
        ))}
      </div>
    </div>
  );
}

/* ====== Settings ====== */
function SettingsSub({ db, setDb, persist, toast, saveDb }: { db: DB; setDb: (fn: (prev: DB) => DB) => void; persist: () => void; toast: (m: string, t?: string) => void; saveDb: (d: DB) => Promise<void> }) {
  const mob = useIsMobile();
  const fileRef = useRef<HTMLInputElement>(null);

  const exportBackup = () => {
    const blob = new Blob([JSON.stringify(db, null, 2)], { type: "application/json" });
    const a = document.createElement("a"); a.href = URL.createObjectURL(blob);
    a.download = `슈퍼플래너_백업_${todayStr()}.json`; a.click();
    toast("백업 완료", "ok");
  };

  const importBackup = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]; if (!file) return;
    const reader = new FileReader();
    reader.onload = ev => {
      try {
        const parsed = JSON.parse(ev.target?.result as string);
        const merged = { ...DEFAULT_DB, ...parsed };
        setDb(() => merged);
        saveDb(merged).then(() => toast("복원 완료", "ok")).catch(() => toast("Supabase 저장 실패", "err"));
      } catch { toast("파일 오류", "err"); }
    };
    reader.readAsText(file);
  };

  const clearAll = () => {
    if (typeof window !== "undefined" && !window.confirm("모든 데이터를 삭제하시겠습니까?")) return;
    if (typeof window !== "undefined") location.reload();
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16, maxWidth: mob ? "100%" : 600 }}>
      <Card>
        <h4 style={{ fontSize: mob ? 15 : 17, fontWeight: 700, color: C.navy, marginBottom: mob ? 14 : 20 }}>⚙️ 교회 설정</h4>
        <FormInput label="교회 이름" value={db.settings.churchName || ""} placeholder="○○교회"
          onChange={(e: React.ChangeEvent<HTMLInputElement>) => { setDb(prev => ({ ...prev, settings: { ...prev.settings, churchName: e.target.value } })); persist(); }} />
        <FormInput label="부서 목록 (쉼표 구분)" value={db.settings.depts || ""} placeholder="유아부,유치부,유년부,초등부,중등부,고등부,청년부,장년부"
          onChange={(e: React.ChangeEvent<HTMLInputElement>) => { setDb(prev => ({ ...prev, settings: { ...prev.settings, depts: e.target.value } })); persist(); }} />
      </Card>
      <Card>
        <h4 style={{ fontSize: mob ? 15 : 17, fontWeight: 700, color: C.navy, marginBottom: mob ? 12 : 16 }}>💾 데이터</h4>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          <Btn variant="ghost" onClick={exportBackup}>{mob ? "📤 백업" : "📤 전체 백업 (JSON)"}</Btn>
          <Btn variant="ghost" onClick={() => fileRef.current?.click()}>{mob ? "📥 복원" : "📥 백업 복원"}</Btn>
          <input ref={fileRef} type="file" accept=".json" style={{ display: "none" }} onChange={importBackup} />
          <Btn variant="danger" size="sm" onClick={clearAll}>🗑 전체 초기화</Btn>
        </div>
      </Card>
    </div>
  );
}

/* ============================================================
   MAIN COMPONENT
   ============================================================ */
type SubPage = "dashboard" | "members" | "attendance" | "notes" | "newfamily" | "reports" | "settings";

const NAV_ITEMS: { id: SubPage; icon: string; label: string }[] = [
  { id: "dashboard", icon: "📊", label: "대시보드" },
  { id: "members", icon: "👥", label: "성도 관리" },
  { id: "attendance", icon: "📅", label: "출석부" },
  { id: "notes", icon: "📝", label: "기도/메모" },
  { id: "newfamily", icon: "🌱", label: "새가족 관리" },
  { id: "reports", icon: "📋", label: "보고서" },
  { id: "settings", icon: "⚙️", label: "설정" },
];

const PAGE_INFO: Record<SubPage, { title: string; desc: string; addLabel?: string }> = {
  dashboard: { title: "대시보드", desc: "목양 현황을 한눈에 파악합니다", addLabel: "+ 성도 등록" },
  members: { title: "성도 관리", desc: "성도의 삶을 기억하고 돌봅니다", addLabel: "+ 성도 등록" },
  attendance: { title: "출석부", desc: "52주 출석 기록을 관리합니다" },
  notes: { title: "기도/메모", desc: "기도제목과 특이사항을 공유합니다", addLabel: "+ 기록" },
  newfamily: { title: "새가족 관리", desc: "새가족 4주 정착 트래킹" },
  reports: { title: "보고서", desc: "엑셀 보고서를 즉시 다운로드합니다" },
  settings: { title: "설정", desc: "교회 정보 및 데이터 관리" },
};

export function PastoralPage() {
  const mob = useIsMobile();
  const [db, setDb] = useState<DB>(() => loadDB());
  const [activeSub, setActiveSub] = useState<SubPage>("dashboard");
  const [sideOpen, setSideOpen] = useState(false);
  const [currentWeek, setCurrentWeek] = useState(getWeekNum);

  useEffect(() => { if (!mob) setSideOpen(true); else setSideOpen(false); }, [mob]);
  const [toasts, setToasts] = useState<{ id: number; msg: string; type: string }[]>([]);

  useEffect(() => {
    loadDBFromSupabase().then(setDb).catch(() => setDb(loadDB()));
  }, []);

  // Modals
  const [showMemberModal, setShowMemberModal] = useState(false);
  const [editMbrId, setEditMbrId] = useState<string | null>(null);
  const [showDetailModal, setShowDetailModal] = useState(false);
  const [detailId, setDetailId] = useState<string | null>(null);
  const [showNoteModal, setShowNoteModal] = useState(false);
  const [noteTargetId, setNoteTargetId] = useState<string | null>(null);

  // Member form
  const [fName, setFName] = useState(""); const [fDept, setFDept] = useState(""); const [fRole, setFRole] = useState("");
  const [fBirth, setFBirth] = useState(""); const [fGender, setFGender] = useState(""); const [fPhone, setFPhone] = useState("");
  const [fAddr, setFAddr] = useState(""); const [fFamily, setFFamily] = useState(""); const [fStatus, setFStatus] = useState("새가족");
  const [fSource, setFSource] = useState(""); const [fPrayer, setFPrayer] = useState(""); const [fMemo, setFMemo] = useState("");
  const [fPhoto, setFPhoto] = useState("");
  const photoRef = useRef<HTMLInputElement>(null);

  // Note form
  const [nDate, setNDate] = useState(todayStr()); const [nType, setNType] = useState<Note["type"]>("memo"); const [nContent, setNContent] = useState(""); const [nMbrSelect, setNMbrSelect] = useState("");

  const persist = useCallback(() => { saveDBToSupabase(db).catch(() => {}); }, [db]);
  useEffect(() => { if (db.members.length > 0 || db.settings.churchName) saveDBToSupabase(db).catch(() => {}); }, [db]);

  const toast = useCallback((msg: string, type = "ok") => {
    const id = Date.now();
    setToasts(prev => [...prev, { id, msg, type }]);
    setTimeout(() => setToasts(prev => prev.filter(t => t.id !== id)), 2500);
  }, []);

  const depts = getDepts(db);

  // Open member modal
  const openMemberModal = useCallback((id?: string) => {
    const m = id ? db.members.find(x => x.id === id) : null;
    setEditMbrId(id || null);
    if (m) {
      setFName(m.name || ""); setFDept(m.dept || depts[0] || ""); setFRole(m.role || "");
      setFBirth(m.birth || ""); setFGender(m.gender || ""); setFPhone(m.phone || "");
      setFAddr(m.address || ""); setFFamily(m.family || ""); setFStatus(m.status || "새가족");
      setFSource(m.source || ""); setFPrayer(m.prayer || ""); setFMemo(m.memo || ""); setFPhoto(m.photo || "");
    } else {
      setFName(""); setFDept(depts[0] || ""); setFRole(""); setFBirth(""); setFGender("");
      setFPhone(""); setFAddr(""); setFFamily(""); setFStatus("새가족"); setFSource("");
      setFPrayer(""); setFMemo(""); setFPhoto("");
    }
    setShowMemberModal(true);
  }, [db.members, depts]);

  const saveMember = () => {
    if (!fName.trim()) { toast("이름을 입력하세요", "err"); return; }
    const data: Partial<Member> = { name: fName.trim(), dept: fDept, role: fRole.trim(), birth: fBirth, gender: fGender, phone: fPhone.trim(), address: fAddr.trim(), family: fFamily.trim(), status: fStatus, source: fSource, prayer: fPrayer.trim(), memo: fMemo.trim(), photo: fPhoto };
    if (editMbrId) {
      setDb(prev => ({ ...prev, members: prev.members.map(m => m.id === editMbrId ? { ...m, ...data } : m) }));
      toast("수정 완료", "ok");
    } else {
      const newId = typeof crypto !== "undefined" && crypto.randomUUID ? crypto.randomUUID() : "mb_" + uid();
      setDb(prev => ({ ...prev, members: [...prev.members, { ...data, id: newId, createdAt: todayStr() } as Member] }));
      toast("등록 완료", "ok");
    }
    setShowMemberModal(false);
  };

  const openDetail = useCallback((id: string) => { setDetailId(id); setShowDetailModal(true); }, []);

  const deleteMember = (id: string) => {
    if (typeof window !== "undefined" && !window.confirm("삭제하시겠습니까?")) return;
    setDb(prev => {
      const { [id]: _a, ...att } = prev.attendance;
      const { [id]: _n, ...notes } = prev.notes;
      return { ...prev, members: prev.members.filter(m => m.id !== id), attendance: att, notes };
    });
    setShowDetailModal(false); toast("삭제 완료", "warn");
  };

  const openNoteModal = useCallback((id?: string) => {
    setNoteTargetId(id || null);
    setNMbrSelect(id || db.members[0]?.id || "");
    setNDate(todayStr()); setNType("memo"); setNContent("");
    setShowNoteModal(true);
  }, [db.members]);

  const saveNote = () => {
    const mid = nMbrSelect || noteTargetId;
    if (!nContent.trim()) { toast("내용을 입력하세요", "err"); return; }
    if (!mid) { toast("성도를 선택하세요", "err"); return; }
    setDb(prev => {
      const notes = { ...prev.notes };
      if (!notes[mid]) notes[mid] = [];
      notes[mid] = [...notes[mid], { date: nDate, type: nType, content: nContent.trim(), createdAt: new Date().toISOString() }];
      let members = prev.members;
      if (nType === "prayer") { members = members.map(m => m.id === mid ? { ...m, prayer: nContent.trim() } : m); }
      return { ...prev, notes, members };
    });
    setShowNoteModal(false); toast("기록 저장 완료", "ok");
  };

  const handlePhoto = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]; if (!file) return;
    const fd = new FormData(); fd.append("file", file);
    fetch("/api/upload-photo", { method: "POST", body: fd })
      .then(r => r.json())
      .then(data => { if (data.url) setFPhoto(data.url); else toast("업로드 실패", "err"); })
      .catch(() => toast("업로드 실패", "err"));
  };

  const topAdd = () => {
    if (activeSub === "dashboard" || activeSub === "members") openMemberModal();
    else if (activeSub === "notes") openNoteModal();
  };

  const handleNav = (id: SubPage) => { setActiveSub(id); if (mob) setSideOpen(false); };

  const info = PAGE_INFO[activeSub];
  const detailMember = detailId ? db.members.find(x => x.id === detailId) : null;

  return (
    <div style={{ fontFamily: "'Inter','Noto Sans KR',-apple-system,sans-serif", background: C.bg, display: "flex", color: C.text, minHeight: "calc(100vh - 56px)", overflow: "hidden", position: "relative" }}>
      {/* Mobile overlay */}
      {mob && sideOpen && <div onClick={() => setSideOpen(false)} style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.4)", zIndex: 99 }} />}

      {/* Sidebar */}
      <aside style={{
        width: mob ? 240 : (sideOpen ? 240 : 64), background: C.navy, color: "#fff",
        display: "flex", flexDirection: "column",
        transition: mob ? "transform 0.3s ease" : "width 0.25s ease",
        overflow: "hidden", flexShrink: 0, zIndex: 100,
        ...(mob ? { position: "fixed", top: 0, left: 0, bottom: 0, transform: sideOpen ? "translateX(0)" : "translateX(-100%)" } : {}),
      }}>
        <div style={{ padding: "20px 16px", display: "flex", alignItems: "center", gap: 12, borderBottom: "1px solid rgba(255,255,255,0.08)", cursor: mob ? "default" : "pointer" }} onClick={() => !mob && setSideOpen(!sideOpen)}>
          <div style={{ width: 36, height: 36, borderRadius: 10, background: "rgba(255,255,255,0.1)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}><Icons.Church /></div>
          <div><div style={{ fontWeight: 700, fontSize: 14, whiteSpace: "nowrap" }}>슈퍼플래너</div><div style={{ fontSize: 11, opacity: 0.6, whiteSpace: "nowrap" }}>Pastoral Care</div></div>
        </div>
        <nav style={{ flex: 1, padding: "12px 8px", display: "flex", flexDirection: "column", gap: 2 }}>
          {NAV_ITEMS.map(n => (
            <button key={n.id} onClick={() => handleNav(n.id)} style={{
              display: "flex", alignItems: "center", gap: 12, padding: "10px 14px",
              borderRadius: 10, border: "none", background: activeSub === n.id ? "rgba(255,255,255,0.12)" : "transparent",
              color: activeSub === n.id ? "#fff" : "rgba(255,255,255,0.6)", fontWeight: activeSub === n.id ? 600 : 400,
              fontSize: 13, cursor: "pointer", fontFamily: "inherit", transition: "all 0.15s",
              textAlign: "left", whiteSpace: "nowrap",
            }}><span style={{ fontSize: 16 }}>{n.icon}</span><span>{n.label}</span></button>
          ))}
        </nav>
        <div style={{ padding: "12px 16px", borderTop: "1px solid rgba(255,255,255,0.08)", fontSize: 11, opacity: 0.4 }}>v1.0 MVP · 2025</div>
      </aside>

      {/* Main */}
      <main style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden", minWidth: 0 }}>
        <header style={{ height: mob ? 52 : 70, padding: mob ? "0 12px" : "0 24px", background: C.card, borderBottom: `1px solid ${C.border}`, display: "flex", alignItems: "center", justifyContent: "space-between", flexShrink: 0, gap: 8 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10, minWidth: 0 }}>
            {mob && <button onClick={() => setSideOpen(true)} style={{ width: 36, height: 36, border: "none", background: C.bg, borderRadius: 8, fontSize: 18, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>☰</button>}
            <div style={{ minWidth: 0 }}>
              <h2 style={{ margin: 0, fontSize: mob ? 16 : 20, fontWeight: 700, color: C.navy, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{info.title}</h2>
              {!mob && <p style={{ margin: "2px 0 0", fontSize: 12, color: C.textMuted }}>{info.desc}</p>}
            </div>
          </div>
          <div style={{ display: "flex", gap: 8, alignItems: "center", flexShrink: 0 }}>
            {!mob && <SBadge variant="success">● 정상 운영중</SBadge>}
            {info.addLabel && <Btn size="sm" onClick={topAdd}>{mob ? "+" : info.addLabel}</Btn>}
          </div>
        </header>
        <div style={{ flex: 1, overflowY: "auto", padding: mob ? 12 : 24 }}>
          {activeSub === "dashboard" && <DashboardSub db={db} currentWeek={currentWeek} />}
          {activeSub === "members" && <MembersSub db={db} setDb={fn => setDb(fn)} persist={persist} toast={toast} currentWeek={currentWeek} openMemberModal={openMemberModal} openDetail={openDetail} openNoteModal={openNoteModal} />}
          {activeSub === "attendance" && <AttendanceSub db={db} setDb={fn => setDb(fn)} persist={persist} toast={toast} currentWeek={currentWeek} setCurrentWeek={setCurrentWeek} />}
          {activeSub === "notes" && <NotesSub db={db} openDetail={openDetail} openNoteModal={openNoteModal} />}
          {activeSub === "newfamily" && <NewFamilySub db={db} currentWeek={currentWeek} openDetail={openDetail} />}
          {activeSub === "reports" && <ReportsSub db={db} currentWeek={currentWeek} toast={toast} />}
          {activeSub === "settings" && <SettingsSub db={db} setDb={fn => setDb(fn)} persist={persist} toast={toast} saveDb={saveDBToSupabase} />}
        </div>
      </main>

      {/* ===== MODALS ===== */}

      {/* Member Modal */}
      <Modal open={showMemberModal} onClose={() => setShowMemberModal(false)} title={editMbrId ? "성도 수정" : "성도 등록"}>
        <FormInput label="이름 *" value={fName} onChange={(e: React.ChangeEvent<HTMLInputElement>) => setFName(e.target.value)} placeholder="이름" />
        <div style={{ display: "grid", gridTemplateColumns: mob ? "1fr" : "1fr 1fr", gap: 12 }}>
          <FormSelect label="부서" value={fDept} onChange={(e: React.ChangeEvent<HTMLSelectElement>) => setFDept(e.target.value)} options={depts.map(d => ({ value: d, label: d }))} />
          <FormInput label="직분/학년" value={fRole} onChange={(e: React.ChangeEvent<HTMLInputElement>) => setFRole(e.target.value)} placeholder="예: 집사, 3학년" />
        </div>
        <div style={{ display: "grid", gridTemplateColumns: mob ? "1fr" : "1fr 1fr", gap: 12 }}>
          <FormInput label="생년월일" type="date" value={fBirth} onChange={(e: React.ChangeEvent<HTMLInputElement>) => setFBirth(e.target.value)} />
          <FormSelect label="성별" value={fGender} onChange={(e: React.ChangeEvent<HTMLSelectElement>) => setFGender(e.target.value)} options={[{ value: "", label: "선택" }, { value: "남", label: "남" }, { value: "여", label: "여" }]} />
        </div>
        <FormInput label="연락처" type="tel" value={fPhone} onChange={(e: React.ChangeEvent<HTMLInputElement>) => setFPhone(e.target.value)} placeholder="010-0000-0000" />
        <FormInput label="주소" value={fAddr} onChange={(e: React.ChangeEvent<HTMLInputElement>) => setFAddr(e.target.value)} placeholder="주소" />
        <FormInput label="가족관계" value={fFamily} onChange={(e: React.ChangeEvent<HTMLInputElement>) => setFFamily(e.target.value)} placeholder="예: 김○○ 집사(배우자)" />
        <FormSelect label="상태" value={fStatus} onChange={(e: React.ChangeEvent<HTMLSelectElement>) => setFStatus(e.target.value)} options={[
          { value: "새가족", label: "새가족" }, { value: "정착중", label: "정착중" }, { value: "정착", label: "정착" },
          { value: "간헐", label: "간헐" }, { value: "위험", label: "위험" }, { value: "휴면", label: "휴면" }, { value: "졸업/전출", label: "졸업/전출" },
        ]} />
        <FormSelect label="등록 경로" value={fSource} onChange={(e: React.ChangeEvent<HTMLSelectElement>) => setFSource(e.target.value)} options={[
          { value: "", label: "선택" }, { value: "기존교인자녀", label: "기존 교인 자녀" }, { value: "전도", label: "전도" },
          { value: "전입", label: "타교회 전입" }, { value: "지인소개", label: "지인 소개" }, { value: "기타", label: "기타" },
        ]} />
        <div style={{ marginBottom: 16 }}>
          <label style={{ display: "block", fontSize: 13, fontWeight: 600, color: C.navy, marginBottom: 6 }}>프로필 사진</label>
          <div onClick={() => photoRef.current?.click()} style={{ border: `2px dashed ${C.border}`, borderRadius: 10, padding: 20, textAlign: "center", cursor: "pointer" }}>
            <div style={{ fontSize: 28, opacity: 0.5, marginBottom: 4 }}>📷</div>
            <div style={{ fontSize: 13, color: C.textMuted }}>사진 선택 (자동 압축)</div>
          </div>
          <input ref={photoRef} type="file" accept="image/*" style={{ display: "none" }} onChange={handlePhoto} />
          {fPhoto && <img src={fPhoto} alt="" style={{ width: 64, height: 64, borderRadius: 10, objectFit: "cover", border: `2px solid ${C.border}`, marginTop: 8 }} />}
        </div>
        <FormTextarea label="기도제목" value={fPrayer} onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => setFPrayer(e.target.value)} placeholder="이 성도를 위한 기도제목" />
        <FormTextarea label="특이사항 메모" value={fMemo} onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => setFMemo(e.target.value)} placeholder="사업장 개업, 병원치료, 가정문제, 진학, 취업 등" />
        <div style={{ display: "flex", gap: 12, justifyContent: "flex-end", marginTop: 8 }}>
          <Btn variant="ghost" onClick={() => setShowMemberModal(false)}>취소</Btn>
          <Btn onClick={saveMember}>저장</Btn>
        </div>
      </Modal>

      {/* Detail Modal */}
      <Modal open={showDetailModal} onClose={() => setShowDetailModal(false)} title="상세 정보" width={500}>
        {detailMember && (() => {
          const m = detailMember;
          const att = db.attendance[m.id] || {};
          const weeks = Object.keys(att).length;
          const pres = Object.values(att).filter(v => v === "p").length;
          const rate = weeks > 0 ? Math.round(pres / weeks * 100) : 0;
          const memberNotes = (db.notes[m.id] || []).slice(-5).reverse();
          return (
            <>
              <div style={{ textAlign: "center", paddingBottom: 20, borderBottom: `1px solid ${C.border}`, marginBottom: 20 }}>
                <div style={{ width: 80, height: 80, borderRadius: 20, display: "inline-flex", alignItems: "center", justifyContent: "center", fontSize: 28, fontWeight: 700, background: `linear-gradient(135deg,${C.accentBg},${C.tealBg})`, color: C.accent, overflow: "hidden", boxShadow: "0 4px 12px rgba(27,42,74,0.08)" }}>
                  {m.photo ? <img src={m.photo} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} /> : (m.name || "?")[0]}
                </div>
                <h2 style={{ fontSize: 22, fontWeight: 700, margin: "12px 0 4px", color: C.navy }}>{m.name}</h2>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 8 }}>
                  <SBadge variant={STATUS_BADGE[m.status || ""] || "gray"}>{m.status}</SBadge>
                  <span style={{ fontSize: 13, color: C.textMuted }}>{m.dept} {m.role || ""}</span>
                </div>
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 10, marginBottom: 20 }}>
                <div style={{ textAlign: "center" }}><div style={{ fontSize: 24, fontWeight: 700, color: C.accent }}>{rate}%</div><div style={{ fontSize: 12, color: C.textMuted }}>출석률</div></div>
                <div style={{ textAlign: "center" }}><div style={{ fontSize: 24, fontWeight: 700, color: C.success }}>{pres}</div><div style={{ fontSize: 12, color: C.textMuted }}>출석</div></div>
                <div style={{ textAlign: "center" }}><div style={{ fontSize: 24, fontWeight: 700 }}>{weeks}</div><div style={{ fontSize: 12, color: C.textMuted }}>기록</div></div>
              </div>
              <DetailRow icon="📞" label="연락처" value={m.phone || "-"} />
              <DetailRow icon="📍" label="주소" value={m.address || "-"} />
              <DetailRow icon="👨‍👩‍👧‍👦" label="가족" value={m.family || "-"} />
              <DetailRow icon="🎂" label="생년월일" value={m.birth || "-"} />
              <DetailRow icon="📮" label="등록경로" value={m.source || "-"} />
              {m.prayer && <DetailRow icon="🙏" label="기도제목" value={m.prayer} />}
              {m.memo && <DetailRow icon="📝" label="특이사항" value={m.memo} />}
              {memberNotes.length > 0 && (
                <div style={{ marginTop: 16 }}>
                  <label style={{ fontSize: 13, fontWeight: 600, color: C.navy, display: "block", marginBottom: 8 }}>최근 기록</label>
                  {memberNotes.map((n, i) => <NoteCard key={i} n={n} />)}
                </div>
              )}
              <div style={{ display: "flex", gap: 12, justifyContent: "flex-end", marginTop: 24 }}>
                <Btn variant="danger" size="sm" onClick={() => deleteMember(m.id)}>삭제</Btn>
                <Btn variant="ghost" size="sm" onClick={() => { setShowDetailModal(false); openMemberModal(m.id); }}>수정</Btn>
                <Btn variant="accent" size="sm" onClick={() => { setShowDetailModal(false); openNoteModal(m.id); }}>기록 추가</Btn>
              </div>
            </>
          );
        })()}
      </Modal>

      {/* Note Modal */}
      <Modal open={showNoteModal} onClose={() => setShowNoteModal(false)} title={noteTargetId ? (db.members.find(x => x.id === noteTargetId)?.name || "") + " — 기록 추가" : "기록 추가"} width={500}>
        <FormSelect label="대상 성도" value={nMbrSelect} onChange={(e: React.ChangeEvent<HTMLSelectElement>) => setNMbrSelect(e.target.value)}
          options={db.members.filter(x => x.status !== "졸업/전출").map(x => ({ value: x.id, label: `${x.name} (${x.dept || ""})` }))} />
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
          <FormInput label="날짜" type="date" value={nDate} onChange={(e: React.ChangeEvent<HTMLInputElement>) => setNDate(e.target.value)} />
          <FormSelect label="유형" value={nType} onChange={(e: React.ChangeEvent<HTMLSelectElement>) => setNType(e.target.value as Note["type"])}
            options={[{ value: "memo", label: "📝 메모" }, { value: "prayer", label: "🙏 기도제목" }, { value: "visit", label: "🏠 심방" }, { value: "event", label: "🎉 경조사" }]} />
        </div>
        <FormTextarea label="내용" value={nContent} onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => setNContent(e.target.value)} placeholder="기록 내용" style={{ minHeight: 100 }} />
        <div style={{ marginTop: 16 }}>
          <label style={{ fontSize: 13, fontWeight: 600, color: C.navy, display: "block", marginBottom: 8 }}>이전 기록</label>
          {(() => {
            const mid = nMbrSelect || noteTargetId;
            const hist = mid ? (db.notes[mid] || []).slice().reverse().slice(0, 5) : [];
            return hist.length ? hist.map((n, i) => <NoteCard key={i} n={n} />) : <div style={{ textAlign: "center", color: C.textFaint, padding: 16, fontSize: 13 }}>기록 없음</div>;
          })()}
        </div>
        <div style={{ display: "flex", gap: 12, justifyContent: "flex-end", marginTop: 16 }}>
          <Btn variant="ghost" onClick={() => setShowNoteModal(false)}>취소</Btn>
          <Btn variant="accent" onClick={saveNote}>저장</Btn>
        </div>
      </Modal>

      {/* Toasts */}
      <div style={{ position: "fixed", top: mob ? 8 : 20, right: mob ? 8 : 32, left: mob ? 8 : "auto", zIndex: 2000, display: "flex", flexDirection: "column", gap: 8 }}>
        {toasts.map(t => (
          <div key={t.id} style={{ padding: "12px 20px", borderRadius: 10, fontSize: 14, fontWeight: 500, color: "#fff", boxShadow: "0 8px 24px rgba(27,42,74,0.1)", display: "flex", alignItems: "center", gap: 8, background: t.type === "ok" ? C.success : t.type === "err" ? C.danger : C.orange, animation: "toastIn 0.3s forwards" }}>
            <span>{t.type === "ok" ? "✓" : t.type === "err" ? "✕" : "⚠"}</span> {t.msg}
          </div>
        ))}
      </div>
    </div>
  );
}
