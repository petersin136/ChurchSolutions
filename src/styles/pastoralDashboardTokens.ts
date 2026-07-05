/**
 * 목양 대시보드 디자이너 핸드오프 스펙 토큰
 * ---------------------------------------------------------------------
 * 디자이너 시안의 정확한 px·컬러코드·폰트 값을 한곳에 모아 재사용한다.
 * 이미지와 값이 충돌하면 여기의 수치를 우선한다. (임의 변경 금지)
 */

/** 전역 기준 */
export const DASH_GLOBAL = {
  /** 디자인 기준 폭 */
  baseWidth: 1440,
  /** 앱 배경색 */
  bg: "#f4f4f6",
  /** 콘텐츠 여백 (상 / 우 / 하 / 좌) */
  contentPadTop: 32,
  contentPadRight: 24,
  contentPadBottom: 24,
  contentPadLeft: 40,
  /** 영문·숫자·기호는 Inter, 한글은 Pretendard */
  fontLatin: "'Inter', 'Pretendard', system-ui, -apple-system, sans-serif",
  fontKR: "'Pretendard', 'Inter', system-ui, -apple-system, sans-serif",
} as const;

/** 색상 */
export const DASH_COLOR = {
  ink: "#0b0c0e",
  dateToday: "#c2c5cd",
  dateValue: "#9fa4b0",
  menubarBaseline: "#D2D4DB",
  indicator: "#0B0C0E",
  cardBg: "#ffffff",
  cardBorder: "rgba(0,0,0,0.03)",
  sidebarHoverBox: "#ffffff",
} as const;

/** 좌측 사이드바 */
export const DASH_SIDEBAR = {
  width: 240,
  itemColor: "#0b0c0e",
  /** hover 시 글씨 뒤 흰색 라운드 박스 */
  hoverBoxWidth: 200,
  hoverBoxHeight: 40,
  hoverBoxRadius: 8,
  /** [아이콘 18][여백 10][글씨] */
  iconSize: 18,
  iconGap: 10,
  /** 날짜 라인 (Inter, 14pt, letter-spacing ≈ -0.28px) */
  dateFontSize: 14,
  dateLetterSpacing: -0.28,
} as const;

/** 상단 메인 메뉴바 */
export const DASH_MENUBAR = {
  fontSize: 14,
  color: "#0b0c0e",
  letterSpacing: 0.35,
  itemGap: 56,
  /** 전체를 받치는 가로 기준선 */
  baselineWidth: 566,
  baselineHeight: 1,
  baselineColor: "#D2D4DB",
  /** 활성/hover 인디케이터 (텍스트 폭에 맞춰 가변) */
  indicatorHeight: 2,
  indicatorColor: "#0B0C0E",
} as const;

/** 모듈(카드) 공통 */
export const DASH_CARD = {
  /** 상단 메뉴바와 첫 모듈 사이 */
  topGap: 24,
  /** 모듈 사이 간격 */
  gap: 16,
  bg: "#ffffff",
  border: "1px solid rgba(0,0,0,0.03)",
} as const;
