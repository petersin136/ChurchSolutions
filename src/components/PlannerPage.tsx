"use client";

import { useState, useMemo, useCallback, useEffect, useRef, type CSSProperties, type ReactNode } from "react";
import { LayoutDashboard, Calendar, BookOpen, Home, CheckSquare, MessageCircle, TrendingUp, Settings, ClipboardList } from "lucide-react";

/* ============================================================
   교역자 슈퍼플래너 — 플래너
   Self-contained component with own sidebar, 8 sub-pages,
   own localStorage ("planner_db"), own modals.
   Fully mobile-responsive.
   ============================================================ */

/* ---------- useIsMobile ---------- */
function useIsMobile(breakpoint = 768) {
  const [mob, setMob] = useState(false);
  useEffect(() => {
    const check = () => setMob(window.innerWidth <= breakpoint);
    check();
    window.addEventListener("resize", check);
    return () => window.removeEventListener("resize", check);
  }, [breakpoint]);
  return mob;
}

/* ---------- Types ---------- */
interface PEvent { id: number; title: string; date: string; time: string; endTime: string; category: string; note: string; recur: string; }
interface PSermon { id: number; title: string; date: string; passage: string; keyMessage: string; illustration: string; application: string; status: string; progress: number; }
interface PVisit { id: number; name: string; reason: string; date: string; time: string; address: string; phone: string; status: string; note: string; prayerNote: string; }
interface PCheck { id: number; text: string; group: string; priority: string; done: boolean; dueDay: number; }
interface PCounsel { id: number; name: string; date: string; type: string; summary: string; followUp: string; }
interface PSettings { name: string; role: string; church: string; weekStart: number; }
interface PDB { settings: PSettings; events: PEvent[]; sermons: PSermon[]; visits: PVisit[]; checklist: PCheck[]; counsels: PCounsel[]; nextId: number; }

/* ---------- Date helpers ---------- */
function todayStr() { return new Date().toISOString().split("T")[0]; }
function getWeekStart() { const t = new Date(); const d = t.getDay(); return new Date(t.getFullYear(), t.getMonth(), t.getDate() - d); }
function weekDateStr(off: number) { const w = getWeekStart(); const d = new Date(w); d.setDate(d.getDate() + off); return d.toISOString().split("T")[0]; }
function nextWeekDateStr(off: number) { const w = getWeekStart(); const d = new Date(w); d.setDate(d.getDate() + 7 + off); return d.toISOString().split("T")[0]; }
function prevWeekDateStr(off: number) { const w = getWeekStart(); const d = new Date(w); d.setDate(d.getDate() - 7 + off); return d.toISOString().split("T")[0]; }
function getWeekDates(offset: number) {
  const t = new Date(); const d = t.getDay();
  const s = new Date(t); s.setDate(t.getDate() - d + offset * 7);
  return Array.from({ length: 7 }, (_, i) => { const x = new Date(s); x.setDate(s.getDate() + i); return x; });
}
function fmtDate(d: Date) { return d.toISOString().split("T")[0]; }
function fmtDateKR(ds: string) { const d = new Date(ds); return `${d.getMonth() + 1}/${d.getDate()}`; }
function fmtDateFullKR(ds: string) {
  const d = new Date(ds); const days = ["일","월","화","수","목","금","토"];
  return `${d.getFullYear()}년 ${d.getMonth()+1}월 ${d.getDate()}일 (${days[d.getDay()]})`;
}
function fmtDateShortKR(ds: string) { const d = new Date(ds); const days = ["일","월","화","수","목","금","토"]; return `${d.getMonth()+1}/${d.getDate()} (${days[d.getDay()]})`; }
function getDayName(d: Date) { return ["일","월","화","수","목","금","토"][d.getDay()]; }

/** 초기화 후 또는 저장 데이터 없을 때 — 일정/설교/심방 등 비움 (더미 데이터 자동 생성 안 함) */
function makeEmpty(): PDB {
  return {
    settings: { name: "", role: "", church: "", weekStart: 0 },
    events: [],
    sermons: [],
    visits: [],
    checklist: [],
    counsels: [],
    nextId: 1,
  };
}

const STORAGE_KEY = "planner_db";
function loadPDB(): PDB {
  try {
    const s = localStorage.getItem(STORAGE_KEY);
    return s ? JSON.parse(s) : makeEmpty();
  } catch {
    return makeEmpty();
  }
}
function savePDB(db: PDB) { try { localStorage.setItem(STORAGE_KEY, JSON.stringify(db)); } catch { /* */ } }

/* ---------- Categories ---------- */
const CATS: Record<string, { label: string; icon: string; color: string; bg: string }> = {
  worship:   { label: "예배/설교", icon: "⛪", color: "#8b5cf6", bg: "#ede9fe" },
  visit:     { label: "심방/방문", icon: "🏠", color: "#3b82f6", bg: "#dbeafe" },
  meeting:   { label: "회의/행정", icon: "📋", color: "#6b7280", bg: "#f3f4f6" },
  event:     { label: "행사/교육", icon: "🎉", color: "#10b981", bg: "#d1fae5" },
  personal:  { label: "개인/경건", icon: "🙏", color: "#f59e0b", bg: "#fef3c7" },
  sermon:    { label: "설교 준비", icon: "📖", color: "#f97316", bg: "#ffedd5" },
  counsel:   { label: "상담",     icon: "💬", color: "#ec4899", bg: "#fce7f3" },
  education: { label: "교육",     icon: "📚", color: "#14b8a6", bg: "#ccfbf1" },
};
const SERMON_ST: Record<string, { label: string; color: string }> = {
  draft:    { label: "구상중", color: "#6b7280" },
  research: { label: "연구중", color: "#3b82f6" },
  writing:  { label: "초고",   color: "#f59e0b" },
  editing:  { label: "수정중", color: "#f97316" },
  done:     { label: "완료",   color: "#10b981" },
};
const CHECK_GROUPS: Record<string, string> = { worship: "예배/설교", admin: "행정/회의", visit: "심방/방문", education: "교육", sermon: "설교 준비", personal: "개인/경건" };

/* ---------- Colors ---------- */
const C = {
  bg: "#f9fafb", card: "#ffffff", navy: "#1a1f36", navyHover: "#2d3460",
  text: "#1f2937", textMuted: "#6b7280", textFaint: "#9ca3af",
  border: "#e5e7eb", borderLight: "#f3f4f6",
  blue: "#3b82f6", blueBg: "#dbeafe", blueDark: "#1d4ed8",
  green: "#10b981", greenBg: "#d1fae5",
  red: "#ef4444", redBg: "#fee2e2",
  yellow: "#f59e0b", yellowBg: "#fef3c7",
  purple: "#8b5cf6", purpleBg: "#ede9fe",
  orange: "#f97316", orangeBg: "#ffedd5",
  pink: "#ec4899", pinkBg: "#fce7f3",
  teal: "#14b8a6", tealBg: "#ccfbf1",
};

/* ---------- Shared UI ---------- */
function Card({ children, style, onClick }: { children: ReactNode; style?: CSSProperties; onClick?: () => void }) {
  return <div onClick={onClick} style={{ background: C.card, borderRadius: 16, border: `1px solid ${C.border}`, transition: "all 0.2s", cursor: onClick ? "pointer" : "default", overflow: "hidden", ...style }}>{children}</div>;
}
function Btn({ children, onClick, variant = "primary", size = "md", style: s }: { children?: ReactNode; onClick?: (e?: React.MouseEvent) => void; variant?: string; size?: string; style?: CSSProperties }) {
  const base: CSSProperties = { display: "inline-flex", alignItems: "center", gap: 6, border: "none", borderRadius: 8, cursor: "pointer", fontWeight: 600, fontFamily: "inherit", transition: "all 0.15s", fontSize: size === "sm" ? 13 : 14, padding: size === "sm" ? "6px 14px" : "10px 20px", whiteSpace: "nowrap" };
  const v: Record<string, CSSProperties> = {
    primary: { background: C.blue, color: "#fff" }, secondary: { background: C.borderLight, color: C.text, border: `1px solid ${C.border}` },
    ghost: { background: "transparent", color: C.textMuted }, danger: { background: C.red, color: "#fff" },
    navy: { background: C.navy, color: "#fff" },
  };
  return <button onClick={onClick} style={{ ...base, ...(v[variant] || v.primary), ...s }}>{children}</button>;
}
function Badge({ children, bg, color }: { children: ReactNode; bg: string; color: string }) {
  return <span style={{ display: "inline-flex", alignItems: "center", gap: 4, padding: "3px 10px", borderRadius: 20, fontSize: 11, fontWeight: 700, background: bg, color, whiteSpace: "nowrap" }}>{children}</span>;
}
function StatCard({ icon, iconBg, iconColor, value, label, sub, subUp, mob }: { icon: string; iconBg: string; iconColor: string; value: string; label: string; sub?: string; subUp?: boolean; mob?: boolean }) {
  return (
    <Card style={{ padding: mob ? 14 : 20 }}>
      <div style={{ width: mob ? 34 : 42, height: mob ? 34 : 42, borderRadius: 12, background: iconBg, color: iconColor, display: "flex", alignItems: "center", justifyContent: "center", fontSize: mob ? 16 : 20, marginBottom: mob ? 8 : 14 }}>{icon}</div>
      <div style={{ fontSize: mob ? 22 : 28, fontWeight: 800, letterSpacing: -1 }}>{value}</div>
      <div style={{ fontSize: mob ? 11 : 13, color: C.textMuted, marginTop: 2 }}>{label}</div>
      {sub && <div style={{ fontSize: mob ? 10 : 12, fontWeight: 600, marginTop: 4, display: "inline-flex", alignItems: "center", gap: 3, padding: "2px 8px", borderRadius: 20, background: subUp ? C.greenBg : C.redBg, color: subUp ? C.green : C.red }}>{sub}</div>}
    </Card>
  );
}
function FormInput({ label, ...props }: { label?: string; [k: string]: unknown }) {
  return (
    <div style={{ marginBottom: 16 }}>
      {label && <label style={{ display: "block", fontSize: 13, fontWeight: 600, color: C.text, marginBottom: 6 }}>{label}</label>}
      <input {...(props as React.InputHTMLAttributes<HTMLInputElement>)} style={{ width: "100%", padding: "10px 14px", border: `1px solid ${C.border}`, borderRadius: 8, fontSize: 14, fontFamily: "inherit", background: C.bg, color: C.text, outline: "none", ...(props.style as CSSProperties || {}) }} />
    </div>
  );
}
function FormSelect({ label, options, ...props }: { label?: string; options: { value: string; label: string }[]; [k: string]: unknown }) {
  return (
    <div style={{ marginBottom: 16 }}>
      {label && <label style={{ display: "block", fontSize: 13, fontWeight: 600, color: C.text, marginBottom: 6 }}>{label}</label>}
      <select {...(props as React.SelectHTMLAttributes<HTMLSelectElement>)} style={{ width: "100%", padding: "10px 14px", border: `1px solid ${C.border}`, borderRadius: 8, fontSize: 14, fontFamily: "inherit", background: C.bg, color: C.text, outline: "none", cursor: "pointer", ...(props.style as CSSProperties || {}) }}>
        {options.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
      </select>
    </div>
  );
}
function FormTextarea({ label, ...props }: { label?: string; [k: string]: unknown }) {
  return (
    <div style={{ marginBottom: 16 }}>
      {label && <label style={{ display: "block", fontSize: 13, fontWeight: 600, color: C.text, marginBottom: 6 }}>{label}</label>}
      <textarea {...(props as React.TextareaHTMLAttributes<HTMLTextAreaElement>)} style={{ width: "100%", padding: "10px 14px", border: `1px solid ${C.border}`, borderRadius: 8, fontSize: 14, fontFamily: "inherit", background: C.bg, color: C.text, outline: "none", resize: "vertical", minHeight: 80, ...(props.style as CSSProperties || {}) }} />
    </div>
  );
}
function Modal({ open, onClose, title, children, footer, mob }: { open: boolean; onClose: () => void; title: string; children: ReactNode; footer?: ReactNode; mob?: boolean }) {
  if (!open) return null;
  return (
    <div style={{ position: "fixed", inset: 0, zIndex: 1000, display: "flex", alignItems: "flex-end", justifyContent: "center", background: "rgba(0,0,0,0.4)", backdropFilter: "blur(8px)", padding: mob ? 0 : 20 }} onClick={onClose}>
      <div onClick={e => e.stopPropagation()} style={{ background: "#fff", borderRadius: mob ? "20px 20px 0 0" : "20px 20px 0 0", width: "100%", maxWidth: mob ? "100%" : 560, maxHeight: mob ? "92vh" : "85vh", overflowY: "auto", animation: "slideUp 0.3s ease" }}>
        <div style={{ width: 36, height: 4, background: C.border, borderRadius: 4, margin: "10px auto" }} />
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: mob ? "12px 16px" : "16px 24px", borderBottom: `1px solid ${C.borderLight}` }}>
          <span style={{ fontSize: mob ? 15 : 17, fontWeight: 700 }}>{title}</span>
          <button onClick={onClose} style={{ width: 30, height: 30, borderRadius: "50%", background: C.borderLight, border: "none", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 16, color: C.textMuted }}>✕</button>
        </div>
        <div style={{ padding: mob ? 16 : 24 }}>{children}</div>
        {footer && <div style={{ padding: mob ? "12px 16px" : "16px 24px", borderTop: `1px solid ${C.borderLight}`, display: "flex", gap: 10, justifyContent: "flex-end" }}>{footer}</div>}
      </div>
    </div>
  );
}

/* ---------- CSV helper ---------- */
function dlCSV(csv: string, name: string) {
  const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8;" });
  const a = document.createElement("a"); a.href = URL.createObjectURL(blob); a.download = name; a.click();
}

/* ============================================================
   SUB-PAGES — all accept `mob` prop
   ============================================================ */

/* ====== Dashboard ====== */
function DashSub({ db, toast, openEventModal, openSermonModal, openVisitModal, openCheckModal, toggleCheck, setPage, mob }: {
  db: PDB; toast: TFn; mob: boolean;
  openEventModal: (date?: string, id?: number) => void; openSermonModal: (id?: number) => void;
  openVisitModal: (id?: number) => void; openCheckModal: (id?: number) => void;
  toggleCheck: (id: number) => void; setPage: (p: SubPage) => void;
}) {
  const today = todayStr();
  const weekDates = getWeekDates(0).map(fmtDate);
  const weekEvents = db.events.filter(e => weekDates.includes(e.date));
  const todayEvents = db.events.filter(e => e.date === today).sort((a, b) => a.time.localeCompare(b.time));
  const doneChecks = db.checklist.filter(c => c.done).length;
  const totalChecks = db.checklist.length;
  const scheduledVisits = db.visits.filter(v => v.status === "scheduled" && weekDates.includes(v.date)).length;
  const activeSermons = db.sermons.filter(s => s.status !== "done").length;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: mob ? 16 : 24 }}>
      <div style={{ display: "grid", gridTemplateColumns: mob ? "1fr 1fr" : "repeat(auto-fit, minmax(200px, 1fr))", gap: mob ? 10 : 16 }}>
        <StatCard mob={mob} icon="📅" iconBg={C.blueBg} iconColor={C.blue} value={`${weekEvents.length}`} label="이번 주 일정" sub={`오늘 ${todayEvents.length}건`} subUp />
        <StatCard mob={mob} icon="✅" iconBg={C.greenBg} iconColor={C.green} value={`${doneChecks}/${totalChecks}`} label="체크리스트" sub={`${totalChecks > 0 ? Math.round(doneChecks / totalChecks * 100) : 0}%`} subUp={doneChecks / totalChecks >= 0.5} />
        <StatCard mob={mob} icon="📖" iconBg={C.purpleBg} iconColor={C.purple} value={`${activeSermons}`} label="준비 중 설교" />
        <StatCard mob={mob} icon="🏠" iconBg={C.orangeBg} iconColor={C.orange} value={`${scheduledVisits}`} label="이번 주 심방" />
      </div>
      <div style={{ display: "grid", gridTemplateColumns: mob ? "1fr" : "1fr 1fr", gap: mob ? 12 : 20 }}>
        <Card>
          <div style={{ padding: mob ? "14px 16px" : "18px 22px", borderBottom: `1px solid ${C.borderLight}`, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <span style={{ fontSize: mob ? 14 : 16, fontWeight: 700 }}>📅 오늘의 일정</span>
            <Btn variant="ghost" size="sm" onClick={() => setPage("weekly")}>전체 보기 →</Btn>
          </div>
          <div style={{ padding: mob ? 14 : 22 }}>
            {todayEvents.length === 0 ? (
              <div style={{ textAlign: "center", padding: mob ? 16 : 24, color: C.textFaint }}>
                <div style={{ fontSize: 32, marginBottom: 8 }}>🌤</div>
                <div style={{ fontSize: 14 }}>오늘 등록된 일정이 없습니다</div>
              </div>
            ) : (
              <div style={{ position: "relative", paddingLeft: 28 }}>
                <div style={{ position: "absolute", left: 8, top: 0, bottom: 0, width: 2, background: C.border }} />
                {todayEvents.map((ev, i) => {
                  const cat = CATS[ev.category] || CATS.meeting;
                  return (
                    <div key={i} style={{ position: "relative", paddingBottom: 16, cursor: "pointer" }} onClick={() => openEventModal(undefined, ev.id)}>
                      <div style={{ position: "absolute", left: -24, top: 4, width: 12, height: 12, borderRadius: "50%", border: `2px solid ${cat.color}`, background: "#fff" }} />
                      <div style={{ fontSize: 12, color: C.textMuted, fontWeight: 600 }}>{ev.time}{ev.endTime ? ` - ${ev.endTime}` : ""}</div>
                      <div style={{ fontSize: 14, fontWeight: 500, color: cat.color, marginTop: 2 }}>{cat.icon} {ev.title}</div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </Card>
        <Card>
          <div style={{ padding: mob ? "14px 16px" : "18px 22px", borderBottom: `1px solid ${C.borderLight}`, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <span style={{ fontSize: mob ? 14 : 16, fontWeight: 700 }}>✅ 오늘 할 일</span>
            <Btn variant="ghost" size="sm" onClick={() => setPage("checklist")}>전체 보기 →</Btn>
          </div>
          <div style={{ padding: mob ? 14 : 22 }}>
            {db.checklist.slice(0, 5).map(item => (
              <div key={item.id} style={{ display: "flex", alignItems: "center", gap: 10, padding: "10px 0", borderBottom: `1px solid ${C.bg}` }}>
                <div onClick={() => toggleCheck(item.id)} style={{ width: 24, height: 24, borderRadius: "50%", border: `2px solid ${item.done ? C.blue : C.border}`, background: item.done ? C.blue : "transparent", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", fontSize: 13, color: item.done ? "#fff" : "transparent", flexShrink: 0 }}>{item.done ? "✓" : ""}</div>
                <span style={{ fontSize: 13, fontWeight: 500, textDecoration: item.done ? "line-through" : "none", color: item.done ? C.textFaint : C.text }}>{item.text}</span>
              </div>
            ))}
          </div>
        </Card>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: mob ? "1fr" : "1fr 1fr", gap: mob ? 12 : 20 }}>
        <Card>
          <div style={{ padding: mob ? "14px 16px" : "18px 22px", borderBottom: `1px solid ${C.borderLight}` }}><span style={{ fontSize: mob ? 14 : 16, fontWeight: 700 }}>📖 설교 준비 현황</span></div>
          <div style={{ padding: mob ? 14 : 22 }}>
            {db.sermons.filter(s => s.status !== "done").slice(0, 3).map(s => {
              const st = SERMON_ST[s.status] || SERMON_ST.draft;
              return (
                <div key={s.id} style={{ marginBottom: 12, paddingBottom: 12, borderBottom: `1px solid ${C.borderLight}`, cursor: "pointer" }} onClick={() => openSermonModal(s.id)}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8 }}>
                    <strong style={{ fontSize: 14, minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{s.title}</strong>
                    <Badge bg={`${st.color}20`} color={st.color}>{st.label}</Badge>
                  </div>
                  <div style={{ fontSize: 12, color: C.textMuted, marginTop: 4 }}>{s.passage} · {fmtDateKR(s.date)}</div>
                  <div style={{ height: 4, background: C.borderLight, borderRadius: 4, marginTop: 8, overflow: "hidden" }}><div style={{ height: "100%", borderRadius: 4, width: `${s.progress}%`, background: st.color, transition: "width 0.5s" }} /></div>
                </div>
              );
            })}
            {db.sermons.filter(s => s.status !== "done").length === 0 && <div style={{ textAlign: "center", color: C.textFaint, padding: 16 }}>준비 중인 설교가 없습니다</div>}
          </div>
        </Card>
        <Card>
          <div style={{ padding: mob ? "14px 16px" : "18px 22px", borderBottom: `1px solid ${C.borderLight}` }}><span style={{ fontSize: mob ? 14 : 16, fontWeight: 700 }}>🏠 이번 주 심방</span></div>
          <div style={{ padding: mob ? 14 : 22 }}>
            {(() => {
              const wv = db.visits.filter(v => v.status === "scheduled" && weekDates.includes(v.date));
              return wv.length ? wv.map(v => (
                <div key={v.id} style={{ display: "flex", alignItems: "center", gap: 12, padding: "12px 0", borderBottom: `1px solid ${C.borderLight}`, cursor: "pointer" }} onClick={() => openVisitModal(v.id)}>
                  <div style={{ width: mob ? 36 : 44, height: mob ? 36 : 44, borderRadius: "50%", background: C.blueBg, color: C.blue, display: "flex", alignItems: "center", justifyContent: "center", fontSize: mob ? 15 : 18, fontWeight: 700, flexShrink: 0 }}>{v.name[0]}</div>
                  <div style={{ minWidth: 0 }}><div style={{ fontSize: 14, fontWeight: 700, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{v.name}</div><div style={{ fontSize: 12, color: C.textMuted, marginTop: 2, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{fmtDateKR(v.date)} {v.time} · {v.reason}</div></div>
                </div>
              )) : <div style={{ textAlign: "center", color: C.textFaint, padding: 16 }}>이번 주 예정된 심방이 없습니다</div>;
            })()}
          </div>
        </Card>
      </div>
    </div>
  );
}

/* ====== Weekly ====== */
function WeeklySub({ db, weekOffset, setWeekOffset, openEventModal, mob }: { db: PDB; weekOffset: number; setWeekOffset: (n: number) => void; openEventModal: (date?: string, id?: number) => void; mob: boolean }) {
  const dates = getWeekDates(weekOffset);
  const today = todayStr();
  return (
    <div>
      {!mob && <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginBottom: 20 }}>
        {Object.entries(CATS).map(([, cat]) => <div key={cat.label} style={{ display: "flex", alignItems: "center", gap: 6, padding: "5px 12px", borderRadius: 20, fontSize: 12, fontWeight: 600, background: cat.bg, color: cat.color }}><div style={{ width: 8, height: 8, borderRadius: "50%", background: cat.color }} />{cat.label}</div>)}
      </div>}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: mob ? 12 : 20, gap: 8 }}>
        <Btn variant="secondary" size="sm" onClick={() => setWeekOffset(weekOffset - 1)} style={{ width: 36, height: 36, padding: 0, justifyContent: "center", flexShrink: 0 }}>◀</Btn>
        <div style={{ display: "flex", alignItems: "center", gap: 8, justifyContent: "center", flex: 1, minWidth: 0 }}>
          <span style={{ fontSize: mob ? 14 : 18, fontWeight: 700, textAlign: "center", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
            {mob ? `${dates[0].getMonth()+1}/${dates[0].getDate()} — ${dates[6].getMonth()+1}/${dates[6].getDate()}` : `${dates[0].getFullYear()}년 ${dates[0].getMonth()+1}월 ${dates[0].getDate()}일 — ${dates[6].getMonth()+1}월 ${dates[6].getDate()}일`}
          </span>
          <Btn variant="secondary" size="sm" onClick={() => setWeekOffset(0)}>오늘</Btn>
        </div>
        <Btn variant="secondary" size="sm" onClick={() => setWeekOffset(weekOffset + 1)} style={{ width: 36, height: 36, padding: 0, justifyContent: "center", flexShrink: 0 }}>▶</Btn>
      </div>
      {/* Mobile: vertical list; Desktop: 7-col grid */}
      {mob ? (
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {dates.map(d => {
            const ds = fmtDate(d); const isT = ds === today;
            const dayEvts = db.events.filter(e => e.date === ds).sort((a, b) => a.time.localeCompare(b.time));
            return (
              <Card key={ds} style={{ borderLeft: isT ? `3px solid ${C.blue}` : undefined }}>
                <div style={{ padding: "12px 14px", borderBottom: `1px solid ${C.borderLight}`, display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                    <div style={{ fontSize: 11, color: C.textMuted, fontWeight: 600, textTransform: "uppercase" }}>{getDayName(d)}</div>
                    <div style={{ fontSize: 18, fontWeight: 800, ...(isT ? { background: C.blue, color: "#fff", width: 30, height: 30, borderRadius: "50%", display: "inline-flex", alignItems: "center", justifyContent: "center", lineHeight: 1, fontSize: 14 } : {}) }}>{d.getDate()}</div>
                  </div>
                  <button onClick={() => openEventModal(ds)} style={{ width: 28, height: 28, borderRadius: 8, border: `1px dashed ${C.border}`, background: "transparent", color: C.textFaint, fontSize: 16, cursor: "pointer" }}>+</button>
                </div>
                {dayEvts.length > 0 && <div style={{ padding: "8px 10px" }}>
                  {dayEvts.map(ev => {
                    const cat = CATS[ev.category] || CATS.meeting;
                    return (
                      <div key={ev.id} onClick={() => openEventModal(undefined, ev.id)} style={{ padding: "8px 10px", borderRadius: 8, marginBottom: 4, fontSize: 12, fontWeight: 500, cursor: "pointer", borderLeft: `3px solid ${cat.color}`, background: cat.bg, color: cat.color }}>
                        <div style={{ fontSize: 10, opacity: 0.7, fontWeight: 600 }}>{ev.time}</div>
                        <div style={{ fontWeight: 600, lineHeight: 1.3 }}>{ev.title}</div>
                      </div>
                    );
                  })}
                </div>}
              </Card>
            );
          })}
        </div>
      ) : (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", gap: 12 }}>
          {dates.map(d => {
            const ds = fmtDate(d); const isT = ds === today;
            const dayEvts = db.events.filter(e => e.date === ds).sort((a, b) => a.time.localeCompare(b.time));
            return (
              <div key={ds} style={{ background: "#fff", borderRadius: 16, border: `${isT ? 2 : 1}px solid ${isT ? C.blue : C.border}`, minHeight: 360, overflow: "hidden" }}>
                <div style={{ padding: "14px 14px 10px", textAlign: "center", borderBottom: `1px solid ${C.borderLight}` }}>
                  <div style={{ fontSize: 11, textTransform: "uppercase", color: C.textMuted, fontWeight: 600, letterSpacing: 0.5 }}>{getDayName(d)}</div>
                  <div style={{ fontSize: 22, fontWeight: 800, marginTop: 2, ...(isT ? { background: C.blue, color: "#fff", width: 36, height: 36, borderRadius: "50%", display: "inline-flex", alignItems: "center", justifyContent: "center", lineHeight: 1 } : {}) }}>{d.getDate()}</div>
                </div>
                <div style={{ padding: 8 }}>
                  {dayEvts.map(ev => {
                    const cat = CATS[ev.category] || CATS.meeting;
                    return (
                      <div key={ev.id} onClick={() => openEventModal(undefined, ev.id)} style={{ padding: "8px 10px", borderRadius: 8, marginBottom: 6, fontSize: 12, fontWeight: 500, cursor: "pointer", borderLeft: `3px solid ${cat.color}`, background: cat.bg, color: cat.color }}>
                        <div style={{ fontSize: 10, opacity: 0.7, marginBottom: 2, fontWeight: 600 }}>{ev.time}</div>
                        <div style={{ fontWeight: 600, lineHeight: 1.3 }}>{ev.title}</div>
                      </div>
                    );
                  })}
                  <button onClick={() => openEventModal(ds)} style={{ width: "100%", padding: 8, border: `1px dashed ${C.border}`, borderRadius: 8, background: "transparent", color: C.textFaint, fontSize: 18, cursor: "pointer", marginTop: 4 }}>+</button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

/* ====== Sermon ====== */
function SermonSub({ db, openSermonModal, mob }: { db: PDB; openSermonModal: (id?: number) => void; mob: boolean }) {
  const [filter, setFilter] = useState("all");
  const tabs = [["all","전체"],["draft","구상중"],["research","연구중"],["writing","초고"],["editing","수정중"],["done","완료"]];
  const list = filter === "all" ? db.sermons : db.sermons.filter(s => s.status === filter);
  return (
    <div>
      <div style={{ display: "flex", gap: 2, background: C.borderLight, borderRadius: 8, padding: 3, marginBottom: mob ? 14 : 20, overflowX: "auto", WebkitOverflowScrolling: "touch" }}>
        {tabs.map(([k, l]) => <div key={k} onClick={() => setFilter(k)} style={{ flex: mob ? "0 0 auto" : 1, padding: mob ? "7px 14px" : "8px 16px", textAlign: "center", fontSize: 13, fontWeight: 600, color: filter === k ? C.text : C.textMuted, borderRadius: 6, cursor: "pointer", background: filter === k ? "#fff" : "transparent", boxShadow: filter === k ? "0 1px 2px rgba(0,0,0,0.05)" : "none", whiteSpace: "nowrap" }}>{l}</div>)}
      </div>
      {list.length === 0 ? <div style={{ textAlign: "center", padding: mob ? 40 : 60, color: C.textFaint }}><div style={{ fontSize: 48, marginBottom: 12 }}>📖</div><div style={{ fontSize: 14 }}>해당 상태의 설교가 없습니다</div></div> :
        list.sort((a, b) => a.date.localeCompare(b.date)).map(s => {
          const st = SERMON_ST[s.status] || SERMON_ST.draft;
          return (
            <Card key={s.id} onClick={() => openSermonModal(s.id)} style={{ padding: mob ? 14 : 20, marginBottom: 12, cursor: "pointer" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 8 }}>
                <div style={{ minWidth: 0, flex: 1 }}><div style={{ fontSize: mob ? 15 : 17, fontWeight: 700, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{s.title}</div><div style={{ fontSize: 13, color: C.textMuted, marginTop: 4 }}>{s.passage}</div></div>
                <Badge bg={`${st.color}20`} color={st.color}>{st.label}</Badge>
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: mob ? 8 : 16, marginTop: 10, fontSize: 13, color: C.textMuted, flexWrap: "wrap" }}>
                <span>📅 {mob ? fmtDateShortKR(s.date) : fmtDateFullKR(s.date)}</span>
                {s.keyMessage && <span>💡 {s.keyMessage.length > 20 ? s.keyMessage.substring(0, 20) + "…" : s.keyMessage}</span>}
              </div>
              <div style={{ height: 4, background: C.borderLight, borderRadius: 4, marginTop: 10, overflow: "hidden" }}><div style={{ height: "100%", borderRadius: 4, width: `${s.progress}%`, background: st.color, transition: "width 0.5s" }} /></div>
            </Card>
          );
        })
      }
    </div>
  );
}

/* ====== Visit ====== */
function VisitSub({ db, openVisitModal, mob }: { db: PDB; openVisitModal: (id?: number) => void; mob: boolean }) {
  const [filter, setFilter] = useState("all");
  const tabs = [["all","전체"],["scheduled","예정"],["completed","완료"],["cancelled","취소"]];
  const list = filter === "all" ? db.visits : db.visits.filter(v => v.status === filter);
  const stColors: Record<string, [string, string]> = { scheduled: [C.blue, C.blueBg], completed: [C.green, C.greenBg], cancelled: [C.red, C.redBg] };
  const stLabels: Record<string, string> = { scheduled: "예정", completed: "완료", cancelled: "취소" };
  return (
    <div>
      <div style={{ display: "flex", gap: 2, background: C.borderLight, borderRadius: 8, padding: 3, marginBottom: mob ? 14 : 20 }}>
        {tabs.map(([k, l]) => <div key={k} onClick={() => setFilter(k)} style={{ flex: 1, padding: "8px 12px", textAlign: "center", fontSize: 13, fontWeight: 600, color: filter === k ? C.text : C.textMuted, borderRadius: 6, cursor: "pointer", background: filter === k ? "#fff" : "transparent", boxShadow: filter === k ? "0 1px 2px rgba(0,0,0,0.05)" : "none" }}>{l}</div>)}
      </div>
      <Card>
        <div style={{ padding: mob ? 14 : 22 }}>
          {list.length === 0 ? <div style={{ textAlign: "center", padding: 40, color: C.textFaint }}><div style={{ fontSize: 48, marginBottom: 12 }}>🏠</div><div style={{ fontSize: 14 }}>해당 심방 기록이 없습니다</div></div> :
            list.sort((a, b) => b.date.localeCompare(a.date)).map(v => {
              const [clr, bg] = stColors[v.status] || stColors.scheduled;
              return (
                <div key={v.id} onClick={() => openVisitModal(v.id)} style={{ display: "flex", alignItems: "center", gap: mob ? 10 : 14, padding: mob ? "12px 0" : "16px 0", borderBottom: `1px solid ${C.borderLight}`, cursor: "pointer" }}>
                  <div style={{ width: mob ? 36 : 44, height: mob ? 36 : 44, borderRadius: "50%", background: bg, color: clr, display: "flex", alignItems: "center", justifyContent: "center", fontSize: mob ? 15 : 18, fontWeight: 700, flexShrink: 0 }}>{v.name[0]}</div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 14, fontWeight: 700, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{v.name}</div>
                    <div style={{ fontSize: 12, color: C.textMuted, marginTop: 2, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{mob ? fmtDateShortKR(v.date) : fmtDateFullKR(v.date)} {v.time} · {v.reason}</div>
                    {v.prayerNote && <div style={{ fontSize: 12, color: C.purple, marginTop: 2, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>🙏 {v.prayerNote}</div>}
                  </div>
                  <Badge bg={bg} color={clr}>{stLabels[v.status]}</Badge>
                </div>
              );
            })
          }
        </div>
      </Card>
    </div>
  );
}

/* ====== Checklist ====== */
function ChecklistSub({ db, toggleCheck, openCheckModal, mob }: { db: PDB; toggleCheck: (id: number) => void; openCheckModal: (id?: number) => void; mob: boolean }) {
  const total = db.checklist.length; const done = db.checklist.filter(c => c.done).length;
  const pct = total > 0 ? Math.round(done / total * 100) : 0;
  const grouped: Record<string, PCheck[]> = {};
  db.checklist.forEach(c => { if (!grouped[c.group]) grouped[c.group] = []; grouped[c.group].push(c); });
  const r = 35; const circ = 2 * Math.PI * r; const off = circ - (pct / 100) * circ;
  const ringColor = pct >= 80 ? C.green : pct >= 50 ? C.blue : C.yellow;
  const priColors: Record<string, [string, string, string]> = { high: [C.red, C.redBg, "긴급"], medium: [C.yellow, C.yellowBg, "보통"], low: [C.green, C.greenBg, "낮음"] };
  return (
    <div style={{ display: "grid", gridTemplateColumns: mob ? "1fr" : "1fr 1fr", gap: mob ? 12 : 20 }}>
      {/* Progress card first on mobile for overview */}
      {mob && (
        <Card>
          <div style={{ padding: 14, display: "flex", alignItems: "center", gap: 16 }}>
            <div style={{ position: "relative", width: 60, height: 60, flexShrink: 0 }}>
              <svg width="60" height="60" style={{ transform: "rotate(-90deg)" }}>
                <circle cx="30" cy="30" r={25} fill="none" stroke={C.borderLight} strokeWidth="5" />
                <circle cx="30" cy="30" r={25} fill="none" stroke={ringColor} strokeWidth="5" strokeDasharray={2 * Math.PI * 25} strokeDashoffset={2 * Math.PI * 25 - (pct / 100) * 2 * Math.PI * 25} strokeLinecap="round" />
              </svg>
              <div style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 14, fontWeight: 800 }}>{pct}%</div>
            </div>
            <div>
              <div style={{ fontSize: 20, fontWeight: 800 }}>{done} / {total}</div>
              <div style={{ fontSize: 12, color: C.textMuted }}>완료된 항목</div>
              <div style={{ display: "flex", gap: 12, marginTop: 4 }}>
                <span style={{ fontSize: 11, color: C.red, fontWeight: 600 }}>긴급 {db.checklist.filter(c => c.priority === "high" && !c.done).length}</span>
                <span style={{ fontSize: 11, color: C.yellow, fontWeight: 600 }}>보통 {db.checklist.filter(c => c.priority === "medium" && !c.done).length}</span>
              </div>
            </div>
          </div>
        </Card>
      )}
      <Card>
        <div style={{ padding: mob ? "12px 14px" : "18px 22px", borderBottom: `1px solid ${C.borderLight}`, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <span style={{ fontSize: mob ? 14 : 16, fontWeight: 700 }}>이번 주 할 일</span>
          <Btn variant="primary" size="sm" onClick={() => openCheckModal()}>＋ 추가</Btn>
        </div>
        <div style={{ padding: mob ? 12 : 22 }}>
          {Object.entries(grouped).map(([g, items]) => (
            <div key={g}>
              <div style={{ fontSize: 12, fontWeight: 700, color: C.textMuted, textTransform: "uppercase", letterSpacing: 0.5, margin: "12px 0 6px" }}>{CHECK_GROUPS[g] || g}</div>
              {items.sort((a, b) => Number(a.done) - Number(b.done)).map(item => {
                const [pc, pb, pl] = priColors[item.priority] || priColors.medium;
                return (
                  <div key={item.id} style={{ display: "flex", alignItems: "center", gap: 10, padding: "10px 0", borderBottom: `1px solid ${C.bg}` }}>
                    <div onClick={() => toggleCheck(item.id)} style={{ width: 24, height: 24, borderRadius: "50%", border: `2px solid ${item.done ? C.blue : C.border}`, background: item.done ? C.blue : "transparent", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", fontSize: 13, color: item.done ? "#fff" : "transparent", flexShrink: 0 }}>{item.done ? "✓" : ""}</div>
                    <span style={{ flex: 1, fontSize: 13, fontWeight: 500, textDecoration: item.done ? "line-through" : "none", color: item.done ? C.textFaint : C.text }}>{item.text}</span>
                    <span style={{ fontSize: 10, fontWeight: 700, padding: "2px 8px", borderRadius: 10, background: pb, color: pc, flexShrink: 0 }}>{pl}</span>
                  </div>
                );
              })}
            </div>
          ))}
        </div>
      </Card>
      {/* Progress card on desktop */}
      {!mob && (
        <Card>
          <div style={{ padding: "18px 22px", borderBottom: `1px solid ${C.borderLight}` }}><span style={{ fontSize: 16, fontWeight: 700 }}>주간 진행률</span></div>
          <div style={{ padding: 22, display: "flex", flexDirection: "column", alignItems: "center", gap: 16 }}>
            <div style={{ position: "relative", width: 80, height: 80 }}>
              <svg width="80" height="80" style={{ transform: "rotate(-90deg)" }}>
                <circle cx="40" cy="40" r={r} fill="none" stroke={C.borderLight} strokeWidth="6" />
                <circle cx="40" cy="40" r={r} fill="none" stroke={ringColor} strokeWidth="6" strokeDasharray={circ} strokeDashoffset={off} strokeLinecap="round" />
              </svg>
              <div style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 18, fontWeight: 800 }}>{pct}%</div>
            </div>
            <div style={{ textAlign: "center" }}>
              <div style={{ fontSize: 24, fontWeight: 800 }}>{done} / {total}</div>
              <div style={{ fontSize: 13, color: C.textMuted, marginTop: 4 }}>완료된 항목</div>
            </div>
            <div style={{ marginTop: 16, width: "100%", display: "flex", justifyContent: "space-between" }}>
              <span style={{ fontSize: 12, color: C.red, fontWeight: 600 }}>긴급: {db.checklist.filter(c => c.priority === "high" && !c.done).length}건 남음</span>
              <span style={{ fontSize: 12, color: C.yellow, fontWeight: 600 }}>보통: {db.checklist.filter(c => c.priority === "medium" && !c.done).length}건 남음</span>
            </div>
          </div>
        </Card>
      )}
    </div>
  );
}

/* ====== Counsel ====== */
function CounselSub({ db, openCounselModal, mob }: { db: PDB; openCounselModal: (id?: number) => void; mob: boolean }) {
  return (
    <Card>
      <div style={{ padding: mob ? "12px 14px" : "18px 22px", borderBottom: `1px solid ${C.borderLight}`, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <span style={{ fontSize: mob ? 14 : 16, fontWeight: 700 }}>상담 기록</span>
        <Btn variant="primary" size="sm" onClick={() => openCounselModal()}>＋ 새 상담</Btn>
      </div>
      <div style={{ padding: mob ? 14 : 22 }}>
        {db.counsels.length === 0 ? <div style={{ textAlign: "center", padding: 40, color: C.textFaint }}><div style={{ fontSize: 48, marginBottom: 12 }}>💬</div><div style={{ fontSize: 14 }}>상담 기록이 없습니다</div></div> :
          db.counsels.sort((a, b) => b.date.localeCompare(a.date)).map(c => (
            <div key={c.id} onClick={() => openCounselModal(c.id)} style={{ display: "flex", alignItems: "center", gap: mob ? 10 : 14, padding: mob ? "12px 0" : "16px 0", borderBottom: `1px solid ${C.borderLight}`, cursor: "pointer" }}>
              <div style={{ width: mob ? 36 : 44, height: mob ? 36 : 44, borderRadius: "50%", background: C.pinkBg, color: C.pink, display: "flex", alignItems: "center", justifyContent: "center", fontSize: mob ? 15 : 18, fontWeight: 700, flexShrink: 0 }}>{c.name[0]}</div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 14, fontWeight: 700, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{c.name}</div>
                <div style={{ fontSize: 12, color: C.textMuted, marginTop: 2 }}>{mob ? fmtDateShortKR(c.date) : fmtDateFullKR(c.date)} · {c.type}</div>
                <div style={{ fontSize: 12, color: C.textMuted, marginTop: 2, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{c.summary.length > (mob ? 30 : 50) ? c.summary.substring(0, mob ? 30 : 50) + "…" : c.summary}</div>
              </div>
              {c.followUp && <Badge bg={C.blueBg} color={C.blue}>{mob ? fmtDateKR(c.followUp) : `재상담 ${fmtDateKR(c.followUp)}`}</Badge>}
            </div>
          ))
        }
      </div>
    </Card>
  );
}

/* ====== Report ====== */
function ReportSub({ db, toast, mob }: { db: PDB; toast: TFn; mob: boolean }) {
  const weekDates = getWeekDates(0).map(fmtDate);
  const weekEvents = db.events.filter(e => weekDates.includes(e.date));
  const completedVisits = db.visits.filter(v => v.status === "completed" && weekDates.includes(v.date));
  const doneChecks = db.checklist.filter(c => c.done).length;
  const totalChecks = db.checklist.length;
  const byCat: Record<string, number> = {};
  weekEvents.forEach(e => { const l = CATS[e.category]?.label || e.category; byCat[l] = (byCat[l] || 0) + 1; });

  const exportCSV = () => {
    let csv = `교역자 주간 보고서\n교회,${db.settings.church}\n교역자,${db.settings.name} ${db.settings.role}\n기간,${weekDates[0]} ~ ${weekDates[6]}\n\n`;
    csv += "=== 주간 일정 ===\n날짜,시간,제목,카테고리,메모\n";
    weekEvents.sort((a, b) => (a.date + a.time).localeCompare(b.date + b.time)).forEach(ev => { csv += `${ev.date},${ev.time},${ev.title},${CATS[ev.category]?.label || ev.category},"${(ev.note || "").replace(/"/g, '""')}"\n`; });
    csv += "\n=== 설교 준비 현황 ===\n제목,본문,설교날짜,상태,진행률\n";
    db.sermons.forEach(s => { csv += `${s.title},${s.passage},${s.date},${SERMON_ST[s.status]?.label || s.status},${s.progress}%\n`; });
    csv += "\n=== 심방 기록 ===\n이름,사유,날짜,시간,상태,기록,기도제목\n";
    db.visits.forEach(v => { csv += `${v.name},${v.reason},${v.date},${v.time},${v.status === "completed" ? "완료" : v.status === "scheduled" ? "예정" : "취소"},"${(v.note || "").replace(/"/g, '""')}","${(v.prayerNote || "").replace(/"/g, '""')}"\n`; });
    csv += "\n=== 상담 기록 ===\n이름,날짜,유형,요약,재상담\n";
    db.counsels.forEach(c => { csv += `${c.name},${c.date},${c.type},"${c.summary.replace(/"/g, '""')}",${c.followUp || ""}\n`; });
    csv += "\n=== 체크리스트 ===\n항목,분류,우선순위,완료여부\n";
    db.checklist.forEach(c => { csv += `${c.text},${c.group},${c.priority},${c.done ? "완료" : "미완료"}\n`; });
    dlCSV(csv, `주간사역보고서_${todayStr()}.csv`);
    toast("보고서 다운로드 완료");
  };

  return (
    <Card>
      <div style={{ padding: mob ? "12px 14px" : "18px 22px", borderBottom: `1px solid ${C.borderLight}`, display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
        <span style={{ fontSize: mob ? 14 : 16, fontWeight: 700 }}>주간 사역 보고서</span>
        <Btn variant="primary" size="sm" onClick={exportCSV}>📥 내보내기</Btn>
      </div>
      <div style={{ padding: mob ? 14 : 22 }}>
        <div style={{ marginBottom: 20 }}>
          <div style={{ fontSize: mob ? 16 : 20, fontWeight: 800, marginBottom: 4 }}>{db.settings.church} · {db.settings.name} {db.settings.role}</div>
          <div style={{ fontSize: mob ? 12 : 14, color: C.textMuted }}>주간 사역 보고서 ({fmtDateKR(weekDates[0])} ~ {fmtDateKR(weekDates[6])})</div>
        </div>
        <div style={{ fontSize: 15, fontWeight: 700, marginBottom: 12 }}>📊 주간 요약</div>
        <div style={{ display: "grid", gridTemplateColumns: mob ? "1fr 1fr" : "repeat(4, 1fr)", gap: 10, marginBottom: 20 }}>
          <Card style={{ padding: mob ? 12 : 16 }}><div style={{ fontSize: mob ? 20 : 24, fontWeight: 800 }}>{weekEvents.length}</div><div style={{ fontSize: 12, color: C.textMuted }}>전체 일정</div></Card>
          <Card style={{ padding: mob ? 12 : 16 }}><div style={{ fontSize: mob ? 20 : 24, fontWeight: 800 }}>{completedVisits.length}</div><div style={{ fontSize: 12, color: C.textMuted }}>완료 심방</div></Card>
          <Card style={{ padding: mob ? 12 : 16 }}><div style={{ fontSize: mob ? 20 : 24, fontWeight: 800 }}>{doneChecks}/{totalChecks}</div><div style={{ fontSize: 12, color: C.textMuted }}>체크리스트</div></Card>
          <Card style={{ padding: mob ? 12 : 16 }}><div style={{ fontSize: mob ? 20 : 24, fontWeight: 800 }}>{db.counsels.filter(c => weekDates.includes(c.date)).length}</div><div style={{ fontSize: 12, color: C.textMuted }}>상담 건수</div></Card>
        </div>
        <div style={{ fontSize: 15, fontWeight: 700, marginBottom: 12 }}>📅 카테고리별 일정</div>
        <div style={{ marginBottom: 20 }}>
          {Object.entries(byCat).map(([cat, cnt]) => (
            <div key={cat} style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
              <span style={{ fontSize: 13, fontWeight: 600, width: mob ? 70 : 100, flexShrink: 0 }}>{cat}</span>
              <div style={{ flex: 1, height: 24, background: C.borderLight, borderRadius: 12, overflow: "hidden" }}>
                <div style={{ height: "100%", width: `${weekEvents.length > 0 ? (cnt / weekEvents.length) * 100 : 0}%`, background: C.blue, borderRadius: 12, display: "flex", alignItems: "center", justifyContent: "flex-end", paddingRight: 8, fontSize: 11, color: "#fff", fontWeight: 700 }}>{cnt}건</div>
              </div>
            </div>
          ))}
        </div>
        <div style={{ fontSize: 15, fontWeight: 700, marginBottom: 12 }}>✅ 미완료 할 일</div>
        {db.checklist.filter(c => !c.done).map(c => {
          const priColors: Record<string, [string, string, string]> = { high: [C.red, C.redBg, "긴급"], medium: [C.yellow, C.yellowBg, "보통"], low: [C.green, C.greenBg, "낮음"] };
          const [pc, pb, pl] = priColors[c.priority] || priColors.medium;
          return (
            <div key={c.id} style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
              <span style={{ fontSize: 10, fontWeight: 700, padding: "2px 8px", borderRadius: 10, background: pb, color: pc, minWidth: 40, textAlign: "center" }}>{pl}</span>
              <span style={{ fontSize: 14 }}>{c.text}</span>
            </div>
          );
        })}
        {db.checklist.filter(c => !c.done).length === 0 && <div style={{ color: C.textFaint, fontSize: 14 }}>모든 할 일 완료!</div>}
      </div>
    </Card>
  );
}

/* ====== Settings ====== */
function SettingsSub({ db, setDb, persist, toast, mob }: { db: PDB; setDb: (fn: (prev: PDB) => PDB) => void; persist: () => void; toast: TFn; mob: boolean }) {
  const fileRef = useRef<HTMLInputElement>(null);
  const exportBackup = () => { const blob = new Blob([JSON.stringify(db, null, 2)], { type: "application/json" }); const a = document.createElement("a"); a.href = URL.createObjectURL(blob); a.download = `플래너_백업_${todayStr()}.json`; a.click(); toast("백업 완료"); };
  const importBackup = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]; if (!file) return;
    const reader = new FileReader();
    reader.onload = ev => { try { const d = JSON.parse(ev.target?.result as string); if (d.settings && d.events) { setDb(() => d); persist(); toast("복원 완료"); } else toast("올바른 백업 파일이 아닙니다", "err"); } catch { toast("파일 오류", "err"); } };
    reader.readAsText(file);
  };
  const resetAll = () => { if (typeof window !== "undefined" && !window.confirm("모든 데이터를 초기화하시겠습니까?")) return; if (typeof window !== "undefined" && !window.confirm("정말로 초기화하시겠습니까?")) return; localStorage.removeItem(STORAGE_KEY); if (typeof window !== "undefined") location.reload(); };
  return (
    <Card>
      <div style={{ padding: mob ? "12px 14px" : "18px 22px", borderBottom: `1px solid ${C.borderLight}` }}><span style={{ fontSize: mob ? 14 : 16, fontWeight: 700 }}>플래너 설정</span></div>
      <div style={{ padding: mob ? 14 : 22 }}>
        <FormInput label="교역자 이름" value={db.settings.name} onChange={(e: React.ChangeEvent<HTMLInputElement>) => { setDb(p => ({ ...p, settings: { ...p.settings, name: e.target.value } })); persist(); }} />
        <FormSelect label="직분" value={db.settings.role} onChange={(e: React.ChangeEvent<HTMLSelectElement>) => { setDb(p => ({ ...p, settings: { ...p.settings, role: e.target.value } })); persist(); }} options={[{ value: "담임목사", label: "담임목사" }, { value: "부목사", label: "부목사" }, { value: "전도사", label: "전도사" }, { value: "강도사", label: "강도사" }, { value: "교육전도사", label: "교육전도사" }]} />
        <FormInput label="교회명" value={db.settings.church} onChange={(e: React.ChangeEvent<HTMLInputElement>) => { setDb(p => ({ ...p, settings: { ...p.settings, church: e.target.value } })); persist(); }} />
        <hr style={{ margin: "20px 0", border: "none", borderTop: `1px solid ${C.borderLight}` }} />
        <div style={{ display: "flex", flexWrap: "wrap", gap: 10 }}>
          <Btn variant="secondary" size={mob ? "sm" : "md"} onClick={exportBackup}>📦 백업</Btn>
          <Btn variant="secondary" size={mob ? "sm" : "md"} onClick={() => fileRef.current?.click()}>📂 복원</Btn>
          <input ref={fileRef} type="file" accept=".json" style={{ display: "none" }} onChange={importBackup} />
          <Btn variant="danger" size={mob ? "sm" : "md"} onClick={resetAll}>🗑 초기화</Btn>
        </div>
      </div>
    </Card>
  );
}

/* ============================================================
   MAIN COMPONENT
   ============================================================ */
type SubPage = "dashboard" | "weekly" | "sermon" | "visit" | "checklist" | "counsel" | "report" | "settings";
type TFn = (m: string, t?: string) => void;

const NAV: { id: SubPage; Icon: React.ComponentType<any>; label: string; section?: string }[] = [
  { id: "dashboard", Icon: LayoutDashboard, label: "대시보드", section: "플래너" },
  { id: "weekly", Icon: Calendar, label: "주간 일정" },
  { id: "sermon", Icon: BookOpen, label: "설교 준비" },
  { id: "visit", Icon: Home, label: "심방 관리" },
  { id: "checklist", Icon: CheckSquare, label: "주간 체크리스트" },
  { id: "counsel", Icon: MessageCircle, label: "상담 기록", section: "관리" },
  { id: "report", Icon: TrendingUp, label: "주간 보고서" },
  { id: "settings", Icon: Settings, label: "설정" },
];
const PAGE_META: Record<SubPage, [string, string]> = {
  dashboard: ["대시보드", "이번 주 사역 현황을 확인하세요"],
  weekly: ["주간 일정", "일정을 등록하고 관리하세요"],
  sermon: ["설교 준비", "설교 준비 상태를 추적합니다"],
  visit: ["심방 관리", "심방 일정과 기록을 관리하세요"],
  checklist: ["주간 체크리스트", "이번 주 할 일을 체크하세요"],
  counsel: ["상담 기록", "상담 내역을 기록하고 관리합니다"],
  report: ["주간 보고서", "사역 보고서를 생성합니다"],
  settings: ["설정", "플래너 설정을 관리합니다"],
};

export function PlannerPage() {
  const mob = useIsMobile();
  const [db, setDb] = useState<PDB>(() => (typeof window !== "undefined" ? loadPDB() : makeEmpty()));
  const [activeSub, setActiveSub] = useState<SubPage>("dashboard");
  const [sideOpen, setSideOpen] = useState(false); // closed by default on mobile
  const [weekOffset, setWeekOffset] = useState(0);
  const [toasts, setToasts] = useState<{ id: number; msg: string; type: string }[]>([]);

  // On desktop, auto-open sidebar
  useEffect(() => { if (!mob) setSideOpen(true); else setSideOpen(false); }, [mob]);

  // Modals
  const [showEventModal, setShowEventModal] = useState(false);
  const [eventEditId, setEventEditId] = useState<number | null>(null);
  const [showSermonModal, setShowSermonModal] = useState(false);
  const [sermonEditId, setSermonEditId] = useState<number | null>(null);
  const [showVisitModal, setShowVisitModal] = useState(false);
  const [visitEditId, setVisitEditId] = useState<number | null>(null);
  const [showCheckModal, setShowCheckModal] = useState(false);
  const [checkEditId, setCheckEditId] = useState<number | null>(null);
  const [showCounselModal, setShowCounselModal] = useState(false);
  const [counselEditId, setCounselEditId] = useState<number | null>(null);
  const [showQuickAdd, setShowQuickAdd] = useState(false);

  // Form states
  const [fEvTitle, setFEvTitle] = useState(""); const [fEvCat, setFEvCat] = useState("worship"); const [fEvDate, setFEvDate] = useState(todayStr());
  const [fEvTime, setFEvTime] = useState("09:00"); const [fEvEnd, setFEvEnd] = useState(""); const [fEvRecur, setFEvRecur] = useState(""); const [fEvNote, setFEvNote] = useState("");
  const [fSmTitle, setFSmTitle] = useState(""); const [fSmDate, setFSmDate] = useState(todayStr()); const [fSmPassage, setFSmPassage] = useState(""); const [fSmKey, setFSmKey] = useState("");
  const [fSmIllust, setFSmIllust] = useState(""); const [fSmApp, setFSmApp] = useState(""); const [fSmStatus, setFSmStatus] = useState("draft"); const [fSmProgress, setFSmProgress] = useState(10);
  const [fViName, setFViName] = useState(""); const [fViReason, setFViReason] = useState(""); const [fViDate, setFViDate] = useState(todayStr()); const [fViTime, setFViTime] = useState("14:00");
  const [fViAddr, setFViAddr] = useState(""); const [fViPhone, setFViPhone] = useState(""); const [fViStatus, setFViStatus] = useState("scheduled"); const [fViNote, setFViNote] = useState(""); const [fViPrayer, setFViPrayer] = useState("");
  const [fChText, setFChText] = useState(""); const [fChGroup, setFChGroup] = useState("worship"); const [fChPri, setFChPri] = useState("medium");
  const [fCoName, setFCoName] = useState(""); const [fCoDate, setFCoDate] = useState(todayStr()); const [fCoType, setFCoType] = useState("가정"); const [fCoSumm, setFCoSumm] = useState(""); const [fCoFollow, setFCoFollow] = useState("");

  const persist = useCallback(() => { savePDB(db); }, [db]);
  useEffect(() => { savePDB(db); }, [db]);

  const toast = useCallback((msg: string, type = "ok") => {
    const id = Date.now(); setToasts(p => [...p, { id, msg, type }]);
    setTimeout(() => setToasts(p => p.filter(t => t.id !== id)), 2500);
  }, []);

  // Open event modal
  const openEventModal = useCallback((date?: string, id?: number) => {
    const ev = id ? db.events.find(e => e.id === id) : null;
    setEventEditId(id ?? null); setFEvTitle(ev?.title || ""); setFEvCat(ev?.category || "worship");
    setFEvDate(ev?.date || date || todayStr()); setFEvTime(ev?.time || "09:00"); setFEvEnd(ev?.endTime || ""); setFEvRecur(ev?.recur || ""); setFEvNote(ev?.note || "");
    setShowEventModal(true);
  }, [db.events]);
  const saveEvent = () => {
    if (!fEvTitle.trim()) { toast("제목을 입력하세요", "err"); return; }
    const data: Partial<PEvent> = { title: fEvTitle.trim(), category: fEvCat, date: fEvDate, time: fEvTime, endTime: fEvEnd, recur: fEvRecur, note: fEvNote };
    if (eventEditId) { setDb(p => ({ ...p, events: p.events.map(e => e.id === eventEditId ? { ...e, ...data } as PEvent : e) })); toast("일정 수정 완료"); }
    else { setDb(p => ({ ...p, events: [...p.events, { ...data, id: p.nextId } as PEvent], nextId: p.nextId + 1 })); toast("일정 등록 완료"); }
    setShowEventModal(false);
  };
  const deleteEvent = (id: number) => { if (!confirm("이 일정을 삭제하시겠습니까?")) return; setDb(p => ({ ...p, events: p.events.filter(e => e.id !== id) })); setShowEventModal(false); toast("일정 삭제 완료"); };

  const openSermonModal = useCallback((id?: number) => {
    const s = id ? db.sermons.find(x => x.id === id) : null;
    setSermonEditId(id ?? null); setFSmTitle(s?.title || ""); setFSmDate(s?.date || todayStr()); setFSmPassage(s?.passage || "");
    setFSmKey(s?.keyMessage || ""); setFSmIllust(s?.illustration || ""); setFSmApp(s?.application || ""); setFSmStatus(s?.status || "draft"); setFSmProgress(s?.progress ?? 10);
    setShowSermonModal(true);
  }, [db.sermons]);
  const saveSermon = () => {
    if (!fSmTitle.trim()) { toast("제목을 입력하세요", "err"); return; }
    const data: Partial<PSermon> = { title: fSmTitle.trim(), date: fSmDate, passage: fSmPassage, keyMessage: fSmKey, illustration: fSmIllust, application: fSmApp, status: fSmStatus, progress: fSmProgress };
    if (sermonEditId) { setDb(p => ({ ...p, sermons: p.sermons.map(s => s.id === sermonEditId ? { ...s, ...data } as PSermon : s) })); toast("설교 수정 완료"); }
    else { setDb(p => ({ ...p, sermons: [...p.sermons, { ...data, id: p.nextId } as PSermon], nextId: p.nextId + 1 })); toast("설교 등록 완료"); }
    setShowSermonModal(false);
  };
  const deleteSermon = (id: number) => { if (!confirm("삭제하시겠습니까?")) return; setDb(p => ({ ...p, sermons: p.sermons.filter(s => s.id !== id) })); setShowSermonModal(false); toast("삭제 완료"); };

  const openVisitModal = useCallback((id?: number) => {
    const v = id ? db.visits.find(x => x.id === id) : null;
    setVisitEditId(id ?? null); setFViName(v?.name || ""); setFViReason(v?.reason || ""); setFViDate(v?.date || todayStr());
    setFViTime(v?.time || "14:00"); setFViAddr(v?.address || ""); setFViPhone(v?.phone || ""); setFViStatus(v?.status || "scheduled"); setFViNote(v?.note || ""); setFViPrayer(v?.prayerNote || "");
    setShowVisitModal(true);
  }, [db.visits]);
  const saveVisit = () => {
    if (!fViName.trim()) { toast("이름을 입력하세요", "err"); return; }
    const data: Partial<PVisit> = { name: fViName.trim(), reason: fViReason, date: fViDate, time: fViTime, address: fViAddr, phone: fViPhone, status: fViStatus, note: fViNote, prayerNote: fViPrayer };
    if (visitEditId) { setDb(p => ({ ...p, visits: p.visits.map(v => v.id === visitEditId ? { ...v, ...data } as PVisit : v) })); toast("심방 수정 완료"); }
    else { setDb(p => ({ ...p, visits: [...p.visits, { ...data, id: p.nextId } as PVisit], nextId: p.nextId + 1 })); toast("심방 등록 완료"); }
    setShowVisitModal(false);
  };
  const deleteVisit = (id: number) => { if (!confirm("삭제하시겠습니까?")) return; setDb(p => ({ ...p, visits: p.visits.filter(v => v.id !== id) })); setShowVisitModal(false); toast("삭제 완료"); };

  const openCheckModal = useCallback((id?: number) => {
    const c = id ? db.checklist.find(x => x.id === id) : null;
    setCheckEditId(id ?? null); setFChText(c?.text || ""); setFChGroup(c?.group || "worship"); setFChPri(c?.priority || "medium");
    setShowCheckModal(true);
  }, [db.checklist]);
  const saveCheck = () => {
    if (!fChText.trim()) { toast("내용을 입력하세요", "err"); return; }
    if (checkEditId) { setDb(p => ({ ...p, checklist: p.checklist.map(c => c.id === checkEditId ? { ...c, text: fChText.trim(), group: fChGroup, priority: fChPri } : c) })); }
    else { setDb(p => ({ ...p, checklist: [...p.checklist, { id: p.nextId, text: fChText.trim(), group: fChGroup, priority: fChPri, done: false, dueDay: 0 }], nextId: p.nextId + 1 })); }
    setShowCheckModal(false); toast(checkEditId ? "수정 완료" : "추가 완료");
  };
  const deleteCheck = (id: number) => { if (!confirm("삭제하시겠습니까?")) return; setDb(p => ({ ...p, checklist: p.checklist.filter(c => c.id !== id) })); setShowCheckModal(false); toast("삭제 완료"); };
  const toggleCheck = useCallback((id: number) => { setDb(p => ({ ...p, checklist: p.checklist.map(c => c.id === id ? { ...c, done: !c.done } : c) })); }, []);

  const openCounselModal = useCallback((id?: number) => {
    const c = id ? db.counsels.find(x => x.id === id) : null;
    setCounselEditId(id ?? null); setFCoName(c?.name || ""); setFCoDate(c?.date || todayStr()); setFCoType(c?.type || "가정"); setFCoSumm(c?.summary || ""); setFCoFollow(c?.followUp || "");
    setShowCounselModal(true);
  }, [db.counsels]);
  const saveCounsel = () => {
    if (!fCoName.trim()) { toast("이름을 입력하세요", "err"); return; }
    const data: Partial<PCounsel> = { name: fCoName.trim(), date: fCoDate, type: fCoType, summary: fCoSumm, followUp: fCoFollow };
    if (counselEditId) { setDb(p => ({ ...p, counsels: p.counsels.map(c => c.id === counselEditId ? { ...c, ...data } as PCounsel : c) })); toast("상담 수정 완료"); }
    else { setDb(p => ({ ...p, counsels: [...p.counsels, { ...data, id: p.nextId } as PCounsel], nextId: p.nextId + 1 })); toast("상담 등록 완료"); }
    setShowCounselModal(false);
  };
  const deleteCounsel = (id: number) => { if (!confirm("삭제하시겠습니까?")) return; setDb(p => ({ ...p, counsels: p.counsels.filter(c => c.id !== id) })); setShowCounselModal(false); toast("삭제 완료"); };

  const weekEvCount = useMemo(() => { const wd = getWeekDates(0).map(fmtDate); return db.events.filter(e => wd.includes(e.date)).length; }, [db.events]);
  const meta = PAGE_META[activeSub];

  // Close sidebar when navigating on mobile
  const handleNavClick = (page: SubPage) => { setActiveSub(page); if (mob) setSideOpen(false); };

  return (
    <div style={{ fontFamily: "-apple-system, BlinkMacSystemFont, 'SF Pro Display', 'Noto Sans KR', sans-serif", background: C.bg, display: "flex", color: C.text, minHeight: "calc(100vh - 56px)", overflow: "hidden", position: "relative" }}>
      {/* Mobile sidebar overlay backdrop */}
      {mob && sideOpen && <div onClick={() => setSideOpen(false)} style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.4)", zIndex: 99 }} />}

      {/* Sidebar */}
      <aside style={{
        width: mob ? 260 : (sideOpen ? 260 : 64),
        background: "#1a1f36", color: "#fff", display: "flex", flexDirection: "column", flexShrink: 0,
        transition: mob ? "transform 0.3s ease" : "width 0.25s ease",
        overflow: "hidden", zIndex: 100,
        ...(mob ? { position: "fixed", top: 0, left: 0, bottom: 0, transform: sideOpen ? "translateX(0)" : "translateX(-100%)" } : {}),
      }}>
        <div style={{ padding: "20px 16px", borderBottom: "1px solid rgba(255,255,255,0.08)", display: "flex", alignItems: "center", gap: 10, color: "rgba(255,255,255,0.9)" }}>
          <div style={{ width: 36, height: 36, background: "rgba(255,255,255,0.1)", borderRadius: 10, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}><ClipboardList size={20} strokeWidth={1.5} /></div>
          <div><div style={{ fontSize: 18, fontWeight: 700, letterSpacing: -0.5 }}>슈퍼플래너</div><div style={{ fontSize: 12, color: "rgba(255,255,255,0.5)", marginTop: 2 }}>교역자 통합 관리</div></div>
        </div>
        <nav style={{ flex: 1, padding: "12px 10px", overflowY: "auto" }}>
          {NAV.map(n => {
            const isActive = activeSub === n.id;
            const Icon = n.Icon;
            return (
              <div key={n.id}>
                {n.section && <div style={{ fontSize: 11, textTransform: "uppercase", color: "rgba(255,255,255,0.35)", padding: "16px 12px 6px", letterSpacing: 1, fontWeight: 600 }}>{n.section}</div>}
                <button onClick={() => handleNavClick(n.id)} style={{
                  display: "flex", alignItems: "center", gap: 12, padding: "10px 12px",
                  borderRadius: 8, border: "none", width: "100%",
                  background: isActive ? "rgba(255,255,255,0.12)" : "transparent",
                  color: isActive ? "#fff" : "rgba(255,255,255,0.5)",
                  fontWeight: isActive ? 600 : 500, fontSize: 14, cursor: "pointer", fontFamily: "inherit",
                  marginBottom: 2, transition: "all 0.15s", textAlign: "left",
                }}>
                  <Icon size={20} strokeWidth={isActive ? 2 : 1.5} style={{ flexShrink: 0 }} />
                  <span>{n.label}</span>
                  {n.id === "weekly" && <span style={{ marginLeft: "auto", background: C.red, color: "#fff", fontSize: 11, padding: "1px 7px", borderRadius: 10, fontWeight: 600 }}>{weekEvCount}</span>}
                </button>
              </div>
            );
          })}
        </nav>
        <div style={{ padding: "12px 16px", borderTop: "1px solid rgba(255,255,255,0.08)", fontSize: 12, color: "rgba(255,255,255,0.35)", textAlign: "center" }}>교역자 슈퍼플래너 v1.0</div>
      </aside>

      {/* Main */}
      <main style={{ flex: 1, minHeight: 0, display: "flex", flexDirection: "column", overflow: "hidden", minWidth: 0 }}>
        <header style={{
          height: mob ? 52 : 64, background: "rgba(255,255,255,0.9)", backdropFilter: "blur(20px)",
          borderBottom: `1px solid ${C.border}`, display: "flex", alignItems: "center",
          justifyContent: "space-between", padding: mob ? "0 12px" : "0 28px", flexShrink: 0, zIndex: 50, gap: 8,
        }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10, minWidth: 0 }}>
            {mob && <button onClick={() => setSideOpen(true)} style={{ width: 36, height: 36, border: "none", background: C.borderLight, borderRadius: 8, fontSize: 18, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>☰</button>}
            <div style={{ minWidth: 0 }}>
              <div style={{ fontSize: mob ? 16 : 20, fontWeight: 700, letterSpacing: -0.5, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{meta[0]}</div>
              {!mob && <div style={{ fontSize: 13, color: C.textMuted }}>{meta[1]}</div>}
            </div>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 8, flexShrink: 0 }}>
            {!mob && <Btn variant="secondary" size="sm" onClick={() => { const wd = getWeekDates(0).map(fmtDate); let csv = "\uFEFF주간사역보고서\n"; csv += `교역자,${db.settings.name}\n교회,${db.settings.church}\n기간,${wd[0]}~${wd[6]}\n\n날짜,시간,제목,카테고리\n`; db.events.filter(e => wd.includes(e.date)).sort((a, b) => (a.date + a.time).localeCompare(b.date + b.time)).forEach(ev => { csv += `${ev.date},${ev.time},${ev.title},${CATS[ev.category]?.label || ""}\n`; }); dlCSV(csv, `주간보고_${todayStr()}.csv`); toast("다운로드 완료"); }}>📥 엑셀</Btn>}
            <Btn variant="primary" size="sm" onClick={() => setShowQuickAdd(true)}>＋{mob ? "" : " 빠른 등록"}</Btn>
          </div>
        </header>
        <div style={{ flex: 1, minHeight: 0, overflowY: "auto", WebkitOverflowScrolling: "touch", padding: mob ? "14px 12px" : "24px 28px" }}>
          {activeSub === "dashboard" && <DashSub mob={mob} db={db} toast={toast} openEventModal={openEventModal} openSermonModal={openSermonModal} openVisitModal={openVisitModal} openCheckModal={openCheckModal} toggleCheck={toggleCheck} setPage={handleNavClick} />}
          {activeSub === "weekly" && <WeeklySub mob={mob} db={db} weekOffset={weekOffset} setWeekOffset={setWeekOffset} openEventModal={openEventModal} />}
          {activeSub === "sermon" && <SermonSub mob={mob} db={db} openSermonModal={openSermonModal} />}
          {activeSub === "visit" && <VisitSub mob={mob} db={db} openVisitModal={openVisitModal} />}
          {activeSub === "checklist" && <ChecklistSub mob={mob} db={db} toggleCheck={toggleCheck} openCheckModal={openCheckModal} />}
          {activeSub === "counsel" && <CounselSub mob={mob} db={db} openCounselModal={openCounselModal} />}
          {activeSub === "report" && <ReportSub mob={mob} db={db} toast={toast} />}
          {activeSub === "settings" && <SettingsSub mob={mob} db={db} setDb={fn => setDb(fn)} persist={persist} toast={toast} />}
        </div>
      </main>

      {/* ===== MODALS — all pass mob ===== */}
      <Modal mob={mob} open={showEventModal} onClose={() => setShowEventModal(false)} title={eventEditId ? "일정 수정" : "새 일정"} footer={<>
        {eventEditId && <Btn variant="danger" size="sm" onClick={() => deleteEvent(eventEditId)}>삭제</Btn>}
        <div style={{ flex: 1 }} />
        <Btn variant="secondary" size={mob ? "sm" : "md"} onClick={() => setShowEventModal(false)}>취소</Btn>
        <Btn size={mob ? "sm" : "md"} onClick={saveEvent}>저장</Btn>
      </>}>
        <FormInput label="제목" value={fEvTitle} onChange={(e: React.ChangeEvent<HTMLInputElement>) => setFEvTitle(e.target.value)} placeholder="일정 제목을 입력하세요" />
        <div style={{ marginBottom: 16 }}>
          <label style={{ display: "block", fontSize: 13, fontWeight: 600, color: C.text, marginBottom: 6 }}>카테고리</label>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
            {Object.entries(CATS).map(([k, v]) => (
              <div key={k} onClick={() => setFEvCat(k)} style={{ padding: mob ? "5px 10px" : "6px 14px", borderRadius: 20, fontSize: mob ? 11 : 12, fontWeight: 600, cursor: "pointer", border: `1px solid ${fEvCat === k ? C.blue : C.border}`, background: fEvCat === k ? C.blue : C.bg, color: fEvCat === k ? "#fff" : C.text }}>{v.icon} {v.label}</div>
            ))}
          </div>
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
          <FormInput label="날짜" type="date" value={fEvDate} onChange={(e: React.ChangeEvent<HTMLInputElement>) => setFEvDate(e.target.value)} />
          <FormInput label="시작 시간" type="time" value={fEvTime} onChange={(e: React.ChangeEvent<HTMLInputElement>) => setFEvTime(e.target.value)} />
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
          <FormInput label="종료 시간" type="time" value={fEvEnd} onChange={(e: React.ChangeEvent<HTMLInputElement>) => setFEvEnd(e.target.value)} />
          <FormSelect label="반복" value={fEvRecur} onChange={(e: React.ChangeEvent<HTMLSelectElement>) => setFEvRecur(e.target.value)} options={[{ value: "", label: "반복 없음" }, { value: "weekly", label: "매주" }, { value: "monthly", label: "매월" }]} />
        </div>
        <FormTextarea label="메모" value={fEvNote} onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => setFEvNote(e.target.value)} placeholder="메모를 입력하세요" />
      </Modal>

      <Modal mob={mob} open={showSermonModal} onClose={() => setShowSermonModal(false)} title={sermonEditId ? "설교 수정" : "새 설교"} footer={<>
        {sermonEditId && <Btn variant="danger" size="sm" onClick={() => deleteSermon(sermonEditId)}>삭제</Btn>}
        <div style={{ flex: 1 }} /><Btn variant="secondary" size={mob ? "sm" : "md"} onClick={() => setShowSermonModal(false)}>취소</Btn><Btn size={mob ? "sm" : "md"} onClick={saveSermon}>저장</Btn>
      </>}>
        <FormInput label="설교 제목" value={fSmTitle} onChange={(e: React.ChangeEvent<HTMLInputElement>) => setFSmTitle(e.target.value)} placeholder="설교 제목" />
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
          <FormInput label="설교 날짜" type="date" value={fSmDate} onChange={(e: React.ChangeEvent<HTMLInputElement>) => setFSmDate(e.target.value)} />
          <FormSelect label="준비 상태" value={fSmStatus} onChange={(e: React.ChangeEvent<HTMLSelectElement>) => setFSmStatus(e.target.value)} options={Object.entries(SERMON_ST).map(([k, v]) => ({ value: k, label: v.label }))} />
        </div>
        <FormInput label="본문" value={fSmPassage} onChange={(e: React.ChangeEvent<HTMLInputElement>) => setFSmPassage(e.target.value)} placeholder="예: 마태복음 5:1-12" />
        <FormInput label="핵심 메시지" value={fSmKey} onChange={(e: React.ChangeEvent<HTMLInputElement>) => setFSmKey(e.target.value)} placeholder="한 줄로 핵심 메시지" />
        <FormTextarea label="예화/일러스트" value={fSmIllust} onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => setFSmIllust(e.target.value)} placeholder="설교에 사용할 예화" />
        <FormTextarea label="적용 포인트" value={fSmApp} onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => setFSmApp(e.target.value)} placeholder="성도들이 적용할 점" />
        <div style={{ marginBottom: 16 }}>
          <label style={{ display: "block", fontSize: 13, fontWeight: 600, color: C.text, marginBottom: 6 }}>진행률 ({fSmProgress}%)</label>
          <input type="range" min="0" max="100" value={fSmProgress} onChange={e => setFSmProgress(parseInt(e.target.value))} style={{ width: "100%" }} />
        </div>
      </Modal>

      <Modal mob={mob} open={showVisitModal} onClose={() => setShowVisitModal(false)} title={visitEditId ? "심방 수정" : "새 심방"} footer={<>
        {visitEditId && <Btn variant="danger" size="sm" onClick={() => deleteVisit(visitEditId)}>삭제</Btn>}
        <div style={{ flex: 1 }} /><Btn variant="secondary" size={mob ? "sm" : "md"} onClick={() => setShowVisitModal(false)}>취소</Btn><Btn size={mob ? "sm" : "md"} onClick={saveVisit}>저장</Btn>
      </>}>
        <FormInput label="성도 이름" value={fViName} onChange={(e: React.ChangeEvent<HTMLInputElement>) => setFViName(e.target.value)} placeholder="이름" />
        <FormInput label="심방 사유" value={fViReason} onChange={(e: React.ChangeEvent<HTMLInputElement>) => setFViReason(e.target.value)} placeholder="예: 수술 후 회복 심방" />
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
          <FormInput label="날짜" type="date" value={fViDate} onChange={(e: React.ChangeEvent<HTMLInputElement>) => setFViDate(e.target.value)} />
          <FormInput label="시간" type="time" value={fViTime} onChange={(e: React.ChangeEvent<HTMLInputElement>) => setFViTime(e.target.value)} />
        </div>
        <FormInput label="주소" value={fViAddr} onChange={(e: React.ChangeEvent<HTMLInputElement>) => setFViAddr(e.target.value)} placeholder="방문 주소" />
        <FormInput label="연락처" value={fViPhone} onChange={(e: React.ChangeEvent<HTMLInputElement>) => setFViPhone(e.target.value)} placeholder="010-0000-0000" />
        <FormSelect label="상태" value={fViStatus} onChange={(e: React.ChangeEvent<HTMLSelectElement>) => setFViStatus(e.target.value)} options={[{ value: "scheduled", label: "예정" }, { value: "completed", label: "완료" }, { value: "cancelled", label: "취소" }]} />
        <FormTextarea label="심방 기록" value={fViNote} onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => setFViNote(e.target.value)} placeholder="심방 후 기록" />
        <FormTextarea label="기도 제목" value={fViPrayer} onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => setFViPrayer(e.target.value)} placeholder="기도 제목" />
      </Modal>

      <Modal mob={mob} open={showCheckModal} onClose={() => setShowCheckModal(false)} title={checkEditId ? "할 일 수정" : "새 할 일"} footer={<>
        {checkEditId && <Btn variant="danger" size="sm" onClick={() => deleteCheck(checkEditId)}>삭제</Btn>}
        <div style={{ flex: 1 }} /><Btn variant="secondary" size={mob ? "sm" : "md"} onClick={() => setShowCheckModal(false)}>취소</Btn><Btn size={mob ? "sm" : "md"} onClick={saveCheck}>저장</Btn>
      </>}>
        <FormInput label="할 일" value={fChText} onChange={(e: React.ChangeEvent<HTMLInputElement>) => setFChText(e.target.value)} placeholder="할 일을 입력하세요" />
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
          <FormSelect label="분류" value={fChGroup} onChange={(e: React.ChangeEvent<HTMLSelectElement>) => setFChGroup(e.target.value)} options={Object.entries(CHECK_GROUPS).map(([k, v]) => ({ value: k, label: v }))} />
          <FormSelect label="우선순위" value={fChPri} onChange={(e: React.ChangeEvent<HTMLSelectElement>) => setFChPri(e.target.value)} options={[{ value: "high", label: "긴급" }, { value: "medium", label: "보통" }, { value: "low", label: "낮음" }]} />
        </div>
      </Modal>

      <Modal mob={mob} open={showCounselModal} onClose={() => setShowCounselModal(false)} title={counselEditId ? "상담 수정" : "새 상담"} footer={<>
        {counselEditId && <Btn variant="danger" size="sm" onClick={() => deleteCounsel(counselEditId)}>삭제</Btn>}
        <div style={{ flex: 1 }} /><Btn variant="secondary" size={mob ? "sm" : "md"} onClick={() => setShowCounselModal(false)}>취소</Btn><Btn size={mob ? "sm" : "md"} onClick={saveCounsel}>저장</Btn>
      </>}>
        <FormInput label="상담자 이름" value={fCoName} onChange={(e: React.ChangeEvent<HTMLInputElement>) => setFCoName(e.target.value)} placeholder="이름" />
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
          <FormInput label="날짜" type="date" value={fCoDate} onChange={(e: React.ChangeEvent<HTMLInputElement>) => setFCoDate(e.target.value)} />
          <FormSelect label="유형" value={fCoType} onChange={(e: React.ChangeEvent<HTMLSelectElement>) => setFCoType(e.target.value)} options={["가정","신앙","진로","건강","재정","기타"].map(t => ({ value: t, label: t }))} />
        </div>
        <FormTextarea label="상담 요약" value={fCoSumm} onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => setFCoSumm(e.target.value)} placeholder="상담 내용 요약" style={{ minHeight: 120 }} />
        <FormInput label="재상담 일정" type="date" value={fCoFollow} onChange={(e: React.ChangeEvent<HTMLInputElement>) => setFCoFollow(e.target.value)} />
      </Modal>

      <Modal mob={mob} open={showQuickAdd} onClose={() => setShowQuickAdd(false)} title="빠른 등록">
        <div style={{ display: "grid", gridTemplateColumns: mob ? "1fr 1fr" : "1fr 1fr 1fr", gap: 12 }}>
          {[
            { icon: "📅", label: "일정", fn: () => { setShowQuickAdd(false); openEventModal(); } },
            { icon: "📖", label: "설교", fn: () => { setShowQuickAdd(false); openSermonModal(); } },
            { icon: "🏠", label: "심방", fn: () => { setShowQuickAdd(false); openVisitModal(); } },
            { icon: "✅", label: "할 일", fn: () => { setShowQuickAdd(false); openCheckModal(); } },
            { icon: "💬", label: "상담", fn: () => { setShowQuickAdd(false); openCounselModal(); } },
          ].map((item, i) => (
            <Card key={i} onClick={item.fn} style={{ padding: mob ? 14 : 20, cursor: "pointer", textAlign: "center" }}>
              <div style={{ fontSize: mob ? 24 : 28, marginBottom: 6 }}>{item.icon}</div>
              <div style={{ fontSize: mob ? 12 : 14, fontWeight: 700 }}>{item.label}</div>
            </Card>
          ))}
        </div>
      </Modal>

      {/* Toasts */}
      <div style={{ position: "fixed", top: mob ? 8 : 20, right: mob ? 8 : 20, left: mob ? 8 : "auto", zIndex: 2000, display: "flex", flexDirection: "column", gap: 8 }}>
        {toasts.map(t => (
          <div key={t.id} style={{ background: t.type === "err" ? C.red : C.text, color: "#fff", padding: mob ? "10px 14px" : "12px 20px", borderRadius: 12, fontSize: 13, fontWeight: 600, boxShadow: "0 20px 60px rgba(0,0,0,0.15)", display: "flex", alignItems: "center", gap: 8 }}>
            {t.type === "err" ? "✕" : "✓"} {t.msg}
          </div>
        ))}
      </div>
    </div>
  );
}
