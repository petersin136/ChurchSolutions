/**
 * 목양 대시보드 디자이너 핸드오프 스펙 토큰
 * ---------------------------------------------------------------------
 * 디자이너 시안의 정확한 px·컬러코드·폰트 값을 한곳에 모아 재사용한다.
 * 이미지와 값이 충돌하면 여기의 수치를 우선한다. (임의 변경 금지)
 *
 * 기본 지침
 * 1. 1440px 기준 그리드·비율 — 1280~1920+ 구간은 flex·여백으로 확장
 * 2. 배경 #f4f4f6
 * 3. 영문·숫자·기호 → Inter / 한글 → Pretendard
 * 4. 콘텐츠 여백: 상 32 / 좌 40 / 우 24 / 하 24 (px)
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
  /** 사이드바 Today 라인 — 시안 대비 조금 더 진하게 */
  sidebarDateToday: "#a4aab4",
  sidebarDateValue: "#787f8c",
  menubarBaseline: "#D2D4DB",
  indicator: "#4E5159",
  cardBg: "#ffffff",
  cardBorder: "rgba(0,0,0,0.03)",
  sidebarHoverBox: "#ffffff",
} as const;

/** 좌측 사이드바 */
export const DASH_SIDEBAR = {
  width: 240,
  /** 로고·날짜·메뉴 좌측 정렬 기준 */
  insetX: 20,
  headerPaddingTop: 24,
  /** church up 브랜드 블록(로고+날짜) — 사이드바 콘텐츠 영역(200px) 가운데 정렬 */
  brandWidth: 200,
  /** 실험 워드마크: "church" + Garb 앱 아이콘 */
  churchTextSize: 36,
  churchTextWeight: 600,
  /** Garb 앱 아이콘 (/icons/icon-192x192.png) */
  appIconSize: 50,
  /** 45° 회전 후에도 up 마크가 잘 보이도록 내부 채움 비율 */
  appIconInnerRatio: 0.88,
  appIconGap: 9,
  /** 실험: 아이콘 내 up 글자 수평 맞춤 — 원본 -45° 보정(시계방향 38°) */
  appIconRotateDeg: 40,
  logoToDateGap: 18,
  /** 날짜 라인 — 로고(church+아이콘) 폭에 맞춰 양끝 정렬 */
  dateFontSize: 12,
  dateLetterSpacing: 0,
  dateLineHeight: 1.2,
  itemColor: "#0b0c0e",
  /** hover/active 흰색 라운드 박스 */
  hoverBoxWidth: 200,
  hoverBoxHeight: 40,
  hoverBoxRadius: 8,
  hoverBoxPaddingX: 12,
  /** 메뉴 항목 사이 세로 간격 — 40px 박스 + gap = 한 줄 리듬 */
  itemRowGap: 36,
  /** [아이콘 18][여백 10][글씨] */
  iconSize: 18,
  iconGap: 10,
  menuFontSize: 15,
  /** 날짜 아래 → 첫 메뉴(대시보드)까지 */
  dateToMenuGap: 56,
} as const;

/** 상단 메인 메뉴바 */
export const DASH_MENUBAR = {
  fontSize: 14,
  color: "#0b0c0e",
  letterSpacing: 0.35,
  itemGap: 56,
  /** 전체를 받치는 가로 기준선 — 첫·마지막 탭 밖으로 ~32px(≈1cm) 연장 */
  baselineExtend: 32,
  baselineHeight: 2,
  baselineColor: "#D2D4DB",
  /** 활성/hover 인디케이터 — 글씨보다 좌우 6px 더 길게, 끝 곡률 */
  indicatorHeight: 3,
  indicatorExtend: 6,
  indicatorRadius: 2,
  indicatorColor: "#4E5159",
  /** 비활성 탭 Medium(500), 활성 SemiBold(600) */
  fontWeight: 500,
  fontWeightActive: 600,
} as const;

/** 카드 차트 색상 — 디자이너 시안 PNG에서 픽셀 추출 (추측값 아님) */
export const DASH_CHART = {
  /** 금주 출석률 bar — 채워진 진초록 */
  attendanceBarFill: "#33473b",
  /** 금주 출석률 bar — 빈 회색 */
  attendanceBarEmpty: "#e4e5e9",
  /** 전체 성도 원 — 채워진 보라(라벤더) */
  memberDotFill: "#c8b1ff",
  /** 전체 성도 원 — 빈 회색 */
  memberDotEmpty: "#e3e4e9",
  /** 출석 통계 막대 — 현재/최신 기간 하이라이트(주황) */
  statBarHighlight: "#ff7044",
  /** 출석 통계 막대 — 기본 회색 */
  statBarBase: "#e4e5e9",
  /** 부서별 인원 — 1위 막대(라임그린) */
  deptBarTop: "#e0e447",
  /** 부서별 인원 — 그 외 막대(회색) */
  deptBarOther: "#dadbe0",
  /** 출석 통계 — 일반(회색) 막대 위 % 숫자 색 */
  statTextGray: "#6f7480",
  /** 출석 통계 — 일반(회색) 막대 위 n/n명 색 (시안 픽셀 추출 #b1b5c0) */
  statSubGray: "#b1b5c0",
} as const;

/** 대시보드 카드 공통 radius — 시안 픽셀 추출(각진 편, 12~14px) */
export const DASH_RADIUS = {
  /** 큰 카드(금주출석률/전체성도/출석통계/부서별/현황보고) */
  card: 14,
  /** 중간 4카드 */
  mid: 14,
} as const;

/** 중간 4카드(새가족/위험휴면/심방/기도) 배경 — 시안 픽셀 추출 */
export const DASH_MID = {
  /** 새가족 — 연블루 그라디언트 */
  newFamilyFill: "linear-gradient(135deg, #dce8fe 0%, #ffffff 72%)",
  /** 위험/휴면 — 시안 픽셀 #fbebe1·#f8eee7·#f7efe9 (살구/베이지, 회색 아님) */
  riskFill: "linear-gradient(135deg, #fbebe1 0%, #ffffff 72%)",
  /** 심방 — 항상 회색(변화 없음) */
  visitFill: "#e9e8ed",
  /** 기도 — 흰색 */
  prayerFill: "#ffffff",
  /** 데이터 없을 때(빈 상태) — 새가족·기도만 */
  emptyFill: "#f2f1f6",
} as const;

/** 현황 보고 태그 배지 — 시안 픽셀 추출 (bg / fg) */
export const DASH_BADGE = {
  newfamily: { bg: "#dbe7ff", fg: "#4a58c8", label: "새가족관리" },
  prayer: { bg: "#ffe8d1", fg: "#c9773a", label: "기도" },
  memo: { bg: "#ececf0", fg: "#6d7280", label: "메모" },
  ceremony: { bg: "#efe9fb", fg: "#7c5fcf", label: "식순" },
  visit: { bg: "#e4f3ea", fg: "#3f9e63", label: "심방" },
} as const;

/** 모듈(카드) 공통 */
export const DASH_CARD = {
  /** 상단 메뉴바 아래 → 첫 모듈 (DASH_GLOBAL.contentPadTop 과 동일) */
  topGap: 32,
  /** 모듈 사이 간격 */
  gap: 16,
  bg: "#ffffff",
  border: "1px solid rgba(0,0,0,0.03)",
  /** 시안: 테두리 없이 부드러운 그림자로만 "섬처럼 떠 있는" 느낌 */
  floatShadow: "0 2px 12px rgba(17,17,26,0.05)",
} as const;

/**
 * 대시보드 그리드·카드 치수 — 1440px 시안 기준
 * 콘텐츠 폭 ≈ 1440 − 240(사이드바) − 40(좌) − 24(우) = 1136px, 4열 flex + gap 16
 */
export const DASH_LAYOUT = {
  gridColumns: 4,
  gridGap: 16,
  /** 1행(금주 출석률·전체 성도) — 시안: 가로 2:1보다 세로 여유 */
  topCardHeight: 232,
  topCardPadding: 24,
  attendanceBarHeight: 60,
  /** 2행(새가족·위험·심방·기도) — 정사각에 가깝게(열 너비 = 높이) */
  midCardAspectRatio: "1 / 1",
  midCardPadding: 18,
  /** 우상단 ↗ 아이콘 — 시안 대비 카드 폭 ~5% */
  midCardArrowSize: 14,
  midCardArrowStroke: 2,
  midCardArrowInset: 18,
  /** 출석통계(좌) : 현황보고(우). 부서별 인원은 출석통계 아래 별도 행 */
  bottomLeftFr: 1.63,
  bottomRightFr: 1,
  /** 출석 통계 차트 본문 높이 — 시안: 첫 화면에 출석통계까지만 보이도록 충분히 큼 */
  attendanceChartHeight: 272,
  memberDotSize: 10,
  memberDotGap: 2,
  memberDotCols: 25,
} as const;
