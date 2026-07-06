/** 앱 전역 검색 — 사이드바·상단 메뉴 이동 대상 */

export interface AppMenuEntry {
  id: string;
  page: string;
  sub?: string;
  label: string;
  /** 드롭다운 부제 — 예: 목양 · 성도 관리 */
  path: string;
  keywords?: string[];
}

function m(
  id: string,
  page: string,
  label: string,
  section: string,
  sub?: string,
  keywords?: string[],
): AppMenuEntry {
  return { id, page, sub, label, path: `${section} · ${label}`, keywords };
}

/** 검색 가능한 메인 탭 + 사이드바 하위 메뉴 */
export const APP_MENU_ENTRIES: AppMenuEntry[] = [
  m("tab-pastoral", "pastoral", "목양", "메인"),
  m("tab-visit", "visit", "심방·상담", "메인", undefined, ["심방", "상담"]),
  m("tab-school", "school", "교회학교", "메인", undefined, ["학교"]),
  m("tab-finance", "finance", "재정", "메인"),
  m("tab-planner", "planner", "플래너", "메인", undefined, ["캘린더", "일정"]),
  m("tab-bulletin", "bulletin", "주보", "메인"),
  m("tab-reports", "reports", "보고서", "메인"),
  m("tab-settings", "settings", "설정", "메인"),

  m("pastoral-dashboard", "pastoral", "대시보드", "목양", "dashboard", ["목양대시보드"]),
  m("pastoral-members", "pastoral", "성도 관리", "목양", "members", ["성도", "교인", "명단"]),
  m("pastoral-attendance", "pastoral", "출석부", "목양", "attendance", ["출석"]),
  m("pastoral-notes", "pastoral", "기도/메모", "목양", "notes", ["기도", "메모", "기도제목"]),
  m("pastoral-newfamily", "pastoral", "새가족 관리", "목양", "newfamily", ["새가족"]),
  m("pastoral-ceremony", "pastoral", "식순", "목양", "ceremony", ["예배순서", "성례"]),
  m("pastoral-org", "pastoral", "조직/자원관리", "목양", "settings", ["조직", "자원", "부서", "목장", "장소"]),

  m("visit-dash", "visit", "대시보드", "심방·상담", "dash"),
  m("visit-visits", "visit", "심방 기록", "심방·상담", "visits", ["심방"]),
  m("visit-counsels", "visit", "상담 기록", "심방·상담", "counsels", ["상담"]),
  m("visit-followup", "visit", "후속 조치", "심방·상담", "followup", ["후속"]),

  m("school-dashboard", "school", "대시보드", "교회학교", "dashboard"),
  m("school-departments", "school", "부서 관리", "교회학교", "departments", ["부서"]),
  m("school-students", "school", "학생 관리", "교회학교", "students", ["학생", "명단"]),
  m("school-attendance", "school", "출석부", "교회학교", "attendance", ["출석"]),
  m("school-transfer", "school", "부서 이동", "교회학교", "transfer"),

  m("finance-dashboard", "finance", "재정 대시보드", "재정", "dashboard"),
  m("finance-offering", "finance", "수입 관리", "재정", "offering", ["수입", "헌금입력"]),
  m("finance-expense", "finance", "지출 관리", "재정", "expense", ["지출"]),
  m("finance-cash", "finance", "현금출납장", "재정", "cashJournal"),
  m("finance-budget-mgmt", "finance", "예산 관리", "재정", "budgetManagement", ["예산"]),
  m("finance-budget-vs", "finance", "예산 대비 실적", "재정", "budgetVsActual"),
  m("finance-budget-actual", "finance", "예결산", "재정", "budgetActual"),
  m("finance-budget-plan", "finance", "예산 계획", "재정", "budget"),
  m("finance-donor-stats", "finance", "헌금자 통계", "재정", "donorStatistics"),
  m("finance-giving", "finance", "헌금 현황", "재정", "givingStatus", ["헌금"]),
  m("finance-donor", "finance", "헌금자 관리", "재정", "donor"),
  m("finance-special", "finance", "특별회계", "재정", "specialAccounts"),
  m("finance-report", "finance", "보고서", "재정", "report"),
  m("finance-export", "finance", "엑셀보내기", "재정", "export", ["엑셀"]),
  m("finance-receipt", "finance", "기부금 영수증", "재정", "receipt", ["영수증"]),

  m("bulletin-dash", "bulletin", "대시보드", "주보", "dash"),
  m("bulletin-edit", "bulletin", "주보 편집", "주보", "edit", ["편집"]),
  m("bulletin-history", "bulletin", "지난 주보", "주보", "history", ["지난주보"]),
  m("bulletin-settings", "bulletin", "설정", "주보", "settings"),

  m("planner-calendar", "planner", "캘린더", "플래너", "calendar", ["일정"]),
  m("planner-admin", "planner", "부서/장소 관리", "플래너", "admin", ["장소"]),
];

const MENU_BY_ID = new Map(APP_MENU_ENTRIES.map((e) => [e.id, e]));

function norm(s: string) {
  return (s ?? "").toLowerCase().replace(/\s+/g, "").replace(/[·/,\uFF0C.]/g, "");
}

function menuScore(entry: AppMenuEntry, query: string): number {
  const q = norm(query);
  if (!q) return 0;
  const labelN = norm(entry.label);
  const pathN = norm(entry.path);
  if (labelN === q) return 100;
  if (labelN.startsWith(q)) return 80;
  if (labelN.includes(q)) return 60;
  if (pathN.includes(q)) return 40;
  for (const kw of entry.keywords ?? []) {
    const kn = norm(kw);
    if (kn === q) return 70;
    if (kn.includes(q) || q.includes(kn)) return 35;
  }
  return 0;
}

const MENU_LIMIT = 8;

export function searchAppMenus(query: string): AppMenuEntry[] {
  const q = query.trim();
  if (!q) return [];
  const scored = APP_MENU_ENTRIES.map((entry) => ({ entry, score: menuScore(entry, q) }))
    .filter((x) => x.score > 0)
    .sort((a, b) => b.score - a.score || a.entry.label.localeCompare(b.entry.label, "ko"));
  const seen = new Set<string>();
  const out: AppMenuEntry[] = [];
  for (const { entry } of scored) {
    if (seen.has(entry.id)) continue;
    seen.add(entry.id);
    out.push(entry);
    if (out.length >= MENU_LIMIT) break;
  }
  return out;
}

export function getAppMenuEntry(id: string): AppMenuEntry | undefined {
  return MENU_BY_ID.get(id);
}
