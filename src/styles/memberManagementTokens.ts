import { DASH_SIDEBAR } from "@/styles/pastoralDashboardTokens";

const MEMBER_TOPBAR_HEIGHT = 64;
const MEMBER_SIDEBAR_LOGO_HEIGHT = Math.round(DASH_SIDEBAR.brandWidth * (167 / 1000));
const MEMBER_SIDEBAR_DATE_LINE = Math.round(DASH_SIDEBAR.dateFontSize * DASH_SIDEBAR.dateLineHeight);

/** 사이드바 첫 메뉴(대시보드) 텍스트 세로 중심 — 뷰포트 기준 px (사이드바는 이동하지 않음) */
export const MEMBER_SIDEBAR_MENU_ALIGN_Y =
  DASH_SIDEBAR.headerPaddingTop +
  MEMBER_SIDEBAR_LOGO_HEIGHT +
  DASH_SIDEBAR.logoToDateGap +
  MEMBER_SIDEBAR_DATE_LINE +
  DASH_SIDEBAR.dateToMenuGap +
  DASH_SIDEBAR.hoverBoxHeight / 2;

/** 성도 관리 — 디자이너 시안 (1440px, grayscale) */
export const MEMBER_MGMT = {
  fontKR: "'Pretendard', system-ui, -apple-system, sans-serif",
  radius: 7,
  pageBg: "#f4f4f6",
  /** 검색 위 여백(패널 내부) — 상단바와 검색 사이 숨 쉴 공간 */
  toolbarPadTop: 20,
  toolbarPadBottom: 10,
  /** 검색 ↔ 컬럼 헤더 ↔ 카드 — 상·하 동일 여백으로 헤더 텍스트 수직 중앙 */
  headerRowGap: 14,
  headerToCardGap: 14,
  toolbarGap: 10,
  /** 검색·등록 바 */
  searchHeight: 48,
  searchBorder: "#e2e4e8",
  searchBg: "#ffffff",
  searchPlaceholder: "#a3a8b0",
  searchText: "#1a1c20",
  searchPadX: 16,
  searchFontSize: 14,
  searchLineHeight: 1.5,
  registerHeight: 48,
  registerPadX: 36,
  registerBorder: "#d7d8dd",
  registerBg: "#e0e1e5",
  registerBgHover: "#d3d4d9",
  registerText: "#1a1c20",
  registerFontSize: 14,
  registerFontWeight: 600,
  /**
   * 컬럼 그리드 (1440px 콘텐츠 기준 — 디자이너 가이드 횡간격)
   * 좌측 4열 고정 → 기도제목 유동 → 우측 3열 고정
   */
  gridPadX: 24,
  tableBorderWidth: 0,
  colTemplate: "48px 176px 96px 152px minmax(240px, 1fr) 112px minmax(180px, 0.85fr) minmax(80px, 80px)",
  colMinWidth: 1084,
  /** +N 배지 — 다음 열(최recent심방·활동기록)과의 간격 */
  badgeBeforeNextColGap: "4cm",
  badgeTextGap: 8,
  /** 기도제목 +N 배지 — 최recent심방 열 직전 고정 위치(음수 = 왼쪽) */
  prayerBadgeOffsetX: -100,
  /** 목록 미리보기 최대 글자 수 (칸 너비 + 말줄임) */
  prayerPreviewMaxChars: 45,
  memoPreviewMaxChars: 35,
  nameAvatarGap: 8,
  /** 테이블 헤더 — 사이드바 메뉴(40px)와 동일 리듬 */
  headerText: "#111827",
  headerFontSize: 16,
  headerFontWeight: 700,
  headerLineHeight: 1.4,
  headerMinHeight: 40,
  headerPadY: 0,
  /**
   * 헤더·데이터 가로 미세 조정 — 앞 5열만. 최근심방·메모는 그리드 열 너비로 정렬.
   */
  headerNumOffsetX: -5, // 번호
  headerNameOffsetX: 45, // 이름
  headerRoleOffsetX: 0, // 직분
  headerDeptOffsetX: 15, // 부서/목장
  headerPrayerOffsetX: 10, // 기도제목
  headerVisitOffsetX: -150, // 최근심방 (헤더·데이터 함께)
  headerMemoOffsetX: -100, // 메모 (헤더·데이터 함께)
  /** 브랜드 보라 액센트 — 배지·호버·활성 상태 */
  accent: "#6c5ce7",
  accentSoft: "#ebe9fb",
  /** 데이터 카드 */
  tableBorder: "#e8eaed",
  tableBg: "#ffffff",
  rowHeight: 58,
  rowBorderWidth: 2,
  rowBorder: "#e8eaed",
  rowHover: "#f4f4f6",
  /** 호버 행 상단 — 바로 위 흰 행 아래 찐한 그레이 그림자 (레퍼런스 y19~20) */
  rowHoverTopLine: "#e3e4e8",
  rowHoverTopFade: "#ecedef",
  rowText: "#6b7280",
  /** 직분·부서/목장 — 굵고 흐린 회색 (레퍼런스) */
  subText: "#93969e",
  subFontWeight: 600,
  deptText: "#93969e",
  nameText: "#111827",
  nameFontWeight: 700,
  nameFontSize: 16,
  cellFontSize: 15,
  numText: "#9ca3af",
  /** 클릭 가능한 셀(이름·기도제목·메모·최근심방) 호버 시 텍스트 */
  cellHoverText: "#6c5ce7",
  avatarSize: 34,
  avatarBg: "#eceaf6",
  avatarText: "#7c74a8",
  avatarFontSize: 15,
  avatarFontWeight: 600,
  prayerText: "#2c2d33",
  contentText: "#2c2d33",
  contentFontWeight: 600,
  /** +N 배지 — 연한 라벤더 정원, 진한 보라 글씨 (디자이너 레퍼런스) */
  prayerBadgeBg: "#cdbcfa",
  prayerBadgeText: "#6f4ad6",
  prayerBadgeFontSize: 12,
  prayerBadgeFontWeight: 700,
  prayerBadgePadX: 2,
  prayerBadgeRadius: 999,
  prayerBadgeMinWidth: 20,
  memoBadgeBg: "#cdbcfa",
  memoBadgeText: "#6f4ad6",
  memoMuted: "#c4c7cf",
  activityText: "#6b7280",
  activityBtnSize: 28,
  activityBtnBorder: "#d7d8dd",
  activityBtnBg: "#e0e1e5",
  activityBtnHover: "#d3d4d9",
  activityPlusSize: 16,
  /** 페이지네이션 — 전체 트랙·활성 하이라이트 동일 굵기, 색만 구분 */
  pagerText: "#b0b4bd",
  pagerActiveText: "#33343a",
  pagerTrack: "#ccd0d7",
  pagerDot: "#33343a",
  pagerBarWidth: 24,
  pagerBarHeight: 4, // 트랙 전체 + 현재 페이지 하이라이트 공통 두께
  pagerArrow: "#4b5563",
  pagerArrowDisabled: "#d1d5db",
  pagerFontSize: 18,
  pagerGap: 20,
  pagerItemSize: 28,
  pagerRowGap: 16,
  dropdownBg: "#ffffff",
  dropdownBorder: "#e2e4e8",
  dropdownShadow: "0 8px 24px rgba(15,23,42,0.1)",
  dropdownItemPad: "10px 14px",
  dropdownItemHover: "#f5f5f6",
  dropdownSectionLabel: "#9ca3af",
  dropdownSectionFontSize: 11,
  panelMinHeightDesktop: "calc(100vh - 168px)",
  panelMinHeightMob: "calc(100dvh - 140px)",
} as const;

/** 컬럼별 셀 정렬 — 번호 열은 순번(데이터) 위치에 헤더만 맞춤 */
export const MEMBER_MGMT_COL_LAYOUT = [
  { align: "left" as const },   // 번호
  { align: "left" as const },   // 이름
  { align: "left" as const },   // 직분
  { align: "left" as const },   // 부서/목장
  { align: "left" as const },   // 기도제목
  { align: "left" as const },   // 최근심방
  { align: "left" as const },   // 메모
  { align: "right" as const },  // 활동기록
] as const;

/**
 * 콘텐츠 상단 여백 — 사이드바 대시보드 텍스트와 컬럼 헤더 행을 같은 높이에 맞춤.
 * 사이드바는 건드리지 않고 메인 패널만 내린다.
 */
export function getMemberContentTopGap(): number {
  const headerTextCenterOffset = MEMBER_MGMT.headerMinHeight / 2;
  const headerRowTop = MEMBER_SIDEBAR_MENU_ALIGN_Y - headerTextCenterOffset;
  const belowTopbar =
    MEMBER_MGMT.toolbarPadTop +
    MEMBER_MGMT.searchHeight +
    MEMBER_MGMT.headerRowGap;
  return Math.max(0, Math.round(headerRowTop - MEMBER_TOPBAR_HEIGHT - belowTopbar));
}

export const MEMBER_MGMT_COLUMNS = [
  "번호",
  "이름",
  "직분",
  "부서/목장",
  "기도제목",
  "최근심방",
  "메모",
  "활동기록",
] as const;
