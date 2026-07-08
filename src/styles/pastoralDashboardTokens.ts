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
  contentPadBottom: 0,
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
  /** 상단 메뉴·성도관리 페이지네이션 공통 — 트랙 연한색 */
  menubarBaseline: "#ccd0d7",
  /** 활성 하이라이트 — 트랙과 동일 굵기, 진한색만 구분 */
  indicator: "#33343a",
  cardBg: "#ffffff",
  cardBorder: "rgba(0,0,0,0.03)",
  sidebarHoverBox: "#ffffff",
} as const;

/** 좌측 사이드바 */
export const DASH_SIDEBAR = {
  width: 240,
  /** 로고·날짜·메뉴 좌측 정렬 기준 */
  insetX: 20,
  headerPaddingTop: 34,
  /** church up 워드마크 블록(로고+날짜) */
  brandWidth: 168,
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
  /** 날짜 라인 — Today 바로 옆에 일자 */
  dateFontSize: 13,
  dateLetterSpacing: 0,
  dateLineHeight: 1.2,
  itemColor: "#0b0c0e",
  /** hover/active 흰색 라운드 박스 */
  hoverBoxWidth: 200,
  hoverBoxHeight: 40,
  hoverBoxRadius: 7,
  hoverBoxPaddingX: 12,
  /** 메뉴 항목 사이 세로 간격 — 40px 박스 + gap = 한 줄 리듬 */
  itemRowGap: 36,
  /** [아이콘 18][여백 10][글씨] */
  iconSize: 18,
  iconGap: 10,
  menuFontSize: 15,
  /** 날짜 아래 → 첫 메뉴(대시보드)까지 */
  dateToMenuGap: 56,
  /** 하단 프로필 아이콘 — 실제 앱 아이콘(검정 up 로고) */
  profileIconSize: 44,
  profileIconRadius: 7,
  profileIconBg: "#c2c5cc",
  /** lighten 블렌드 시 up 글자 크기(박스 대비) — 접힘 헤더 등 */
  profileIconInnerRatio: 0.78,
  profileChurchFontSize: 15,
  profileUserFontSize: 13,
  /** 하단 교회·계정 블록 패딩 — bottom을 키워 화면 하단에서 살짝 위로 */
  profilePaddingTop: 12,
  profilePaddingX: 20,
  profilePaddingBottom: 26,
  /** 하단 프로필 블록 폭 — 메뉴·로고와 동일 */
  profileBlockWidth: 200,
} as const;

/** 상단 메인 메뉴바 */
export const DASH_MENUBAR = {
  fontSize: 15,
  color: "#0b0c0e",
  letterSpacing: 0.35,
  itemGap: 56,
  /** 전체를 받치는 가로 기준선 — 레거시 상단바(확장). 콘텐츠 스팬 탭은 tabLineInset 사용 */
  baselineExtend: 32,
  /** 대시보드 상단 탭: 기준선 안에서 첫·마지막 탭까지 (≈1cm) */
  tabLineInset: 32,
  /**
   * 성도관리 하단 페이지네이션(MEMBER_MGMT.pager*)과 동일 형식:
   * 트랙·하이라이트 동일 굵기(3), 색만 연한/진한 구분, 끝 반원.
   */
  baselineHeight: 3,
  baselineColor: "#ccd0d7",
  /** 활성/hover 인디케이터 — 글씨보다 좌우 6px 더 길게 */
  indicatorHeight: 3,
  indicatorExtend: 6,
  indicatorRadius: 1.5,
  indicatorColor: "#33343a",
  /** 비활성 탭 SemiBold(600), 활성 Bold(700) */
  fontWeight: 600,
  fontWeightActive: 700,
} as const;

/** 카드 차트 색상 — 디자이너 시안 PNG에서 픽셀 추출 (추측값 아님) */
export const DASH_CHART = {
  /** 금주 출석률 bar — 채워진 진초록 */
  attendanceBarFill: "#33473b",
  /** 금주 출석률 bar — 빈 회색 */
  attendanceBarEmpty: "#e4e5e9",
  /** 전체 성도 원 — 채워진 보라(라벤더) — 시안 픽셀 #c3b1fa */
  memberDotFill: "#c3b1fa",
  /** 전체 성도 원 — 빈 회색 — 시안 픽셀 #e3e4e8 */
  memberDotEmpty: "#e3e4e8",
  /** 출석 통계 막대 — 현재/최신 기간 하이라이트(주황) */
  statBarHighlight: "#ff7044",
  /** 출석 통계 막대 — 기본 회색 */
  statBarBase: "#e4e5e9",
  /** 부서별 인원 — 1위 막대(라임그린) */
  deptBarTop: "#e0e447",
  /** 부서별 인원 — 그 외 채움 막대 */
  deptBarFill: "#dadbe0",
  /** 부서별 인원 — 막대 트랙(배경) */
  deptBarTrack: "#ececef",
  /** 출석 통계 — 일반(회색) 막대 위 % 숫자 색 */
  statTextGray: "#6f7480",
  /** 출석 통계 — 일반(회색) 막대 위 n/n명 색 (시안 픽셀 추출 #b1b5c0) */
  statSubGray: "#b1b5c0",
  /** 연간(Y) 겹침 블록 — 뒤쪽 연도(예: 2024) */
  statBarYearBack: "#b2b8c2",
  /** 연간(Y) 겹침 블록 — 중간 연도(예: 2025) */
  statBarYearMid: "#e5e7eb",
  /** 연간(Y) 겹침 블록 — 뒤쪽 % 텍스트 */
  statTextYearBack: "#7a8290",
  statSubYearBack: "#959dab",
  /** 연간(Y) 겹침 블록 — 중간 % 텍스트 */
  statTextYearMid: "#9ca3af",
  statSubYearMid: "#b1b5c0",
  /** 연간(Y) 겹침 블록 — 최신 연도(주황) 위 텍스트 — 시안 픽셀 추출 */
  statTextYearHighlight: "#c45a3a",
  statSubYearHighlight: "#d4714f",
} as const;

/** 출석 통계 카드 헤더 — 연도·W/M/Y (시안 2번) */
export const DASH_ATT_CHART_CTRL = {
  yearFontSize: 17,
  yearFontWeight: 600,
  yearChevron: "#8b909a",
  periodBtnSize: 38,
  periodBtnSizeMob: 34,
  periodBtnFontSize: 16,
  periodBtnFontSizeMob: 14,
  periodBtnRadius: 7,
  periodBtnGap: 6,
  periodActiveBg: "#d8dce3",
  periodInactiveBg: "#eceef1",
  periodText: "#0b0c0e",
  controlsGap: 14,
  controlsGapMob: 10,
} as const;

/** 출석 통계 막대 내부 타이포 — 막대 너비 대비 스케일 */
export const DASH_ATT_CHART_BAR = {
  /** 시안 기준 막대 너비(px) — 이때 타이포 100% */
  weekBarDesignWidth: 96,
  monthBarDesignWidth: 44,
  yearBlockDesignWidth: 200,
  weekGap: 16,
  weekGapMob: 8,
  monthGap: 8,
  monthGapMob: 4,
  yearBlockWidthRatio: 0.48,
  yearBlockWidthRatioMob: 0.5,
  /** 막대가 아주 좁아질 때 하한 */
  minScale: 0.42,
} as const;

export function dashChartBarTypoScale(barWidth: number, designBarWidth: number): number {
  if (barWidth <= 0 || designBarWidth <= 0) return 1;
  return Math.max(DASH_ATT_CHART_BAR.minScale, Math.min(1, barWidth / designBarWidth));
}

export function dashChartBarWidths(chartWidth: number, mob: boolean) {
  const wg = mob ? DASH_ATT_CHART_BAR.weekGapMob : DASH_ATT_CHART_BAR.weekGap;
  const mg = mob ? DASH_ATT_CHART_BAR.monthGapMob : DASH_ATT_CHART_BAR.monthGap;
  const yr = mob ? DASH_ATT_CHART_BAR.yearBlockWidthRatioMob : DASH_ATT_CHART_BAR.yearBlockWidthRatio;
  return {
    week: Math.max(0, (chartWidth - wg * 4) / 5),
    month: Math.max(0, (chartWidth - mg * 11) / 12),
    year: Math.max(0, chartWidth * yr),
  };
}

/** 대시보드 카드 공통 radius */
export const DASH_RADIUS = {
  /** 큰 카드(금주출석률/전체성도/출석통계/부서별/현황보고) */
  card: 7,
  /** 중간 4카드 */
  mid: 7,
} as const;

/** 중간 4카드(새가족/위험휴면/심방/기도) 배경 — 시안 픽셀 추출 */
export const DASH_MID = {
  /** 새가족 — 시안: 연한 라벤더 → 흰색 그라디언트 */
  newFamilyFill: "linear-gradient(152deg, #e8efff 0%, #f6f8ff 42%, #ffffff 78%)",
  /** 위험/휴면 — 시안 픽셀 #fbebe1·#f8eee7·#f7efe9 (살구/베이지, 회색 아님) */
  riskFill: "linear-gradient(152deg, #fbebe1 0%, #fdf6f1 42%, #ffffff 78%)",
  /** 심방 — 항상 회색(변화 없음) */
  visitFill: "#e9e8ed",
  /** 기도 — 흰색 */
  prayerFill: "#ffffff",
  /** 데이터 없을 때(빈 상태) — 새가족·기도만 */
  emptyFill: "#f2f1f6",
  /** 카드 흰 테두리 — 시안 픽셀 추출 */
  cardBorder: "1px solid #ffffff",
} as const;

/** 현황 보고 카드 — 리스트·헤더 간격 (카드 곡률은 DASH_RADIUS.card 공통) */
export const DASH_FEED_CARD = {
  padding: 24,
  /** 제목(현황 보고) ↔ 리스트 사이 */
  headerListGap: 40,
  badgeRadius: 7,
  badgePaddingY: 6,
  badgePaddingX: 8,
  /** 모든 태그 동일 크기 (가장 긴 라벨 기준) */
  badgeWidth: 92,
  badgeMinHeight: 28,
  /** 리스트 행 상·하 패딩 */
  rowPaddingY: 22,
  /** 태그 · 이름 · 상태 · 시간 사이 횡간격 */
  rowColumnGap: 32,
  /** 리스트 첫 행 위 추가 여백 */
  listPaddingTop: 4,
  /** 헤더 우측 "총 N건" */
  countFontSize: 17,
  countFontWeight: 700,
  /** 페이지당 리스트 행 수 */
  itemsPerPage: 11,
} as const;

/** 현황 보고 페이지네이션 바 고정 높이 (comfortable) */
export const DASH_FEED_PAGINATION_HEIGHT = 60;

/** 현황 보고 리스트 1행 고정 높이 */
export function dashFeedRowHeight(typoScale = 1): number {
  const py = dashScalePx(DASH_FEED_CARD.rowPaddingY, typoScale) * 2;
  const badge = dashScalePx(DASH_FEED_CARD.badgeMinHeight, typoScale);
  return py + badge;
}

/** 현황 보고 리스트 영역 고정 높이 (항상 itemsPerPage 행 분량) */
export function dashFeedListAreaHeight(typoScale = 1): number {
  return (
    dashScalePx(DASH_FEED_CARD.listPaddingTop, typoScale) +
    dashFeedRowHeight(typoScale) * DASH_FEED_CARD.itemsPerPage
  );
}

/** 현황 보고 카드 콘텐츠 최소 높이 — 페이지 수와 무관하게 동일 */
export function dashFeedCardContentMinHeight(sectionTitleSize: number, typoScale = 1): number {
  const headerH =
    Math.ceil(sectionTitleSize * 1.25) + dashScalePx(DASH_FEED_CARD.headerListGap, typoScale);
  return (
    dashScalePx(DASH_FEED_CARD.padding, typoScale) * 2 +
    headerH +
    dashFeedListAreaHeight(typoScale) +
    DASH_FEED_PAGINATION_HEIGHT
  );
}

/** 부서별 인원(2행 좌) — 현황 보고 카드 하단과 맞추기 위한 최소 높이 */
export function dashDeptBlockMinHeight(feedCardMinHeightPx: number, statRowHeight: number): string {
  const topCards = statRowHeight * 2 + DASH_LAYOUT.gridGap;
  const offset = DASH_LAYOUT.dashboardViewportOffset + topCards + DASH_LAYOUT.gridGap * 2;
  return `max(0px, calc(${feedCardMinHeightPx}px - 100dvh + ${offset}px - ${DASH_LAYOUT.gridGap}px))`;
}

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
  /** 1·2행 공통 높이 — 2행 aspect 기준(ResizeObserver로 1행과 동기화). 3행보다 낮게 유지 */
  topCardHeight: 232,
  topCardPadding: 24,
  /** 금주 출석률 세그먼트 막대 최소 높이 — 카드 남은 높이는 flex로 채움 */
  attendanceBarHeight: 68,
  /** 금주 출석률 세그먼트 간격·모서리 — 시안 픽셀 추출 */
  attendanceBarGap: 6,
  attendanceBarRadius: 7,
  /** 2행(새가족·위험·심방·기도) — 1행과 같은 높이. 값↑ = 카드↓ (3행에 여유 확보) */
  midCardAspectRatio: "1.62 / 1",
  midCardPadding: 22,
  /** 우상단 ↗ 아이콘 — 시안 대비 130% */
  midCardArrowSize: 36,
  midCardArrowStroke: 2.25,
  midCardArrowInset: 20,
  /** 출석통계(좌) : 현황보고(우). 부서별 인원은 출석통계 아래 별도 행 */
  bottomLeftFr: 1.63,
  bottomRightFr: 1,
  /** 출석 통계 차트 본문 — flex 확장 시 너무 작아지지 않게 하는 하한 */
  attendanceChartMinHeight: 160,
  /** 연간(Y) 차트 — 시안 픽셀 기준 고정 높이 (카드 flex 채움 방지) */
  attendanceYearPlotHeight: 172,
  attendanceYearMaxBarHeight: 156,
  /** 데스크톱 대시보드 — 상단바·콘텐츠 패딩 (100dvh 계산용) */
  dashboardViewportOffset: 96,
  /** 전체 성도 dot — 시안 고정(px), 화면 크기와 무관 동일 형태 */
  memberDotSize: 13,
  memberDotGap: 6,
  memberDotCols: 25,
  memberDotRows: 4,
} as const;

/** 연간(Y) 출석 통계 — 3년 겹침 블록 (1440 시안) */
export const DASH_ATT_YEAR_CHART = {
  maxBarHeight: DASH_LAYOUT.attendanceYearMaxBarHeight,
  /** 헤더 아래 차트 영역 세로 패딩 합 */
  bodyPadY: 32,
  blockRadius: 7,
  /** 좌(높음) · 중(낮음·뒤) · 우(넓음·앞) — left+width 합이 100% 넘어도 겹침 허용 */
  blockLayout: [
    { leftPct: 0, widthPct: 29, zIndex: 1 },
    { leftPct: 18, widthPct: 32, zIndex: 2 },
    { leftPct: 26, widthPct: 50, zIndex: 3 },
  ] as const,
  designBlockWidth: 200,
} as const;

/** 금주 출석률 카드 타이포·간격 — 120% 스케일 */
export const DASH_ATTENDANCE_CARD = {
  labelSize: 19,
  labelWeight: 700,
  labelValueGap: 12,
  valueSize: 62,
  valueWeight: 800,
  valueLetterSpacing: "-0.03em",
  subSize: 17,
  subWeight: 400,
  valueSubGap: 14,
  barMarginTop: 26,
} as const;

/** 전체 성도 카드 타이포·간격 — 120% 스케일 */
export const DASH_MEMBER_CARD = {
  labelSize: 19,
  labelWeight: 700,
  labelValueGap: 12,
  valueSize: 62,
  valueWeight: 800,
  valueLetterSpacing: "-0.03em",
  unitSize: 24,
  unitWeight: 700,
  subSize: 17,
  subWeight: 400,
  valueSubGap: 14,
  dotMarginTop: 17,
} as const;

/** 2행 중간 카드(새가족/위험·휴면/심방/기도) — 120% 스케일 */
export const DASH_MID_CARD = {
  labelSize: 23,
  labelWeight: 700,
  labelSubGap: 6,
  subSize: 17,
  subWeight: 400,
  subColor: "#8e8e8e",
  valueSize: 60,
  valueWeight: 800,
  valueLetterSpacing: "-0.03em",
  unitSize: 24,
  unitWeight: 700,
  titleReserveRight: 43,
} as const;

/** 출석통계·현황보고·부서별 등 하단 카드 타이포 — 120% 스케일 */
export const DASH_SECTION = {
  titleSize: 19,
  titleSizeMob: 17,
  metaSize: 14,
  bodySize: 16,
  smallSize: 13,
  tinySize: 12,
  chartWeekValue: 44,
  chartWeekValueMob: 30,
  chartWeekSub: 17,
  chartWeekPadTop: 18,
  chartWeekPadLeft: 14,
  chartAxis: 15,
  chartAxisTiny: 13,
  chartYearValue: 52,
  chartYearValueMob: 36,
  chartYearSub: 17,
  chartYearLabel: 14,
  chartYearPadTop: 14,
  chartYearPadLeft: 14,
  chartYearPadBottom: 12,
  /** 데이터 없는 연도 — 연도만 표시하는 최소 블록 높이 */
  chartYearEmptyMinH: 52,
  feedBadgeWidth: 92,
  feedNameWidth: 96,
  feedTimeMinWidth: 84,
} as const;

/** 부서별 인원 카드 — 막대·간격 (시안 2번) */
export const DASH_DEPT_CARD = {
  barHeight: 48,
  rowGap: 16,
  bodyPaddingY: 28,
  bodyPaddingX: 24,
  headerPaddingBottom: 8,
  barRadius: 7,
  labelInset: 16,
  countMinWidth: 52,
  countGap: 14,
} as const;

/** 대시보드 타이포 반응형 — 컨테이너 너비 / 세션 최대 너비 */
export const DASH_TYPO_SCALE = {
  /** 이보다 작아지지 않음 (노트북·작은 창) */
  minScale: 0.78,
} as const;

export function dashScalePx(px: number, scale: number): number {
  return Math.max(1, Math.round(px * scale));
}

/**
 * 컨테이너 너비를 세션에서 본 최대 너비와 비교해 타이포 스케일 산출.
 * 전체 화면에서 1, 창을 줄이면 비례 축소.
 */
export function dashTopCardTypoScale(containerWidth: number, maxContainerWidth: number): number {
  if (containerWidth <= 0 || maxContainerWidth <= 0) return 1;
  const raw = containerWidth / maxContainerWidth;
  return Math.max(DASH_TYPO_SCALE.minScale, Math.min(1, raw));
}

/** 숫자 토큰만 비율 유지하며 스케일 */
export function scaleDashTypo<T extends Record<string, unknown>>(tokens: T, scale: number): T {
  if (scale >= 0.9995) return tokens;
  const result = { ...tokens } as T;
  for (const key of Object.keys(tokens)) {
    const v = tokens[key as keyof T];
    if (typeof v === "number") {
      (result as Record<string, number>)[key] = dashScalePx(v, scale);
    }
  }
  return result;
}

/** 전체 성도 dot — 고정 100칸(25×4) 백분율 그래프. 인원 수와 무관하게 활동 비율(%)만 색 채움 */
export type MemberDotScale = {
  /** 화면에 그릴 칸 수 — 항상 100 */
  slotCount: number;
  /** 보라 칸 수 — 활동 비율(%)에 비례 */
  activeDots: number;
};

const MEMBER_DOT_GRID_TOTAL = 100;

export function getMemberDotScale(total: number, activeCount: number): MemberDotScale {
  if (total <= 0) {
    return { slotCount: MEMBER_DOT_GRID_TOTAL, activeDots: 0 };
  }
  const activeDots = Math.round((activeCount / total) * MEMBER_DOT_GRID_TOTAL);
  return {
    slotCount: MEMBER_DOT_GRID_TOTAL,
    activeDots: Math.min(MEMBER_DOT_GRID_TOTAL, Math.max(0, activeDots)),
  };
}

/** 전체 성도 2칸 카드 — dot 그리드가 너비를 채울 때 필요한 최소 카드 높이 */
export function dashMemberCardMinHeight(cardInnerWidth: number): number {
  const cols = DASH_LAYOUT.memberDotCols;
  const rows = DASH_LAYOUT.memberDotRows;
  const gap = DASH_LAYOUT.memberDotGap;
  const dotSize =
    cardInnerWidth > 0
      ? Math.max(1, Math.floor((cardInnerWidth - (cols - 1) * gap) / cols))
      : DASH_LAYOUT.memberDotSize;
  const gridH = rows * dotSize + (rows - 1) * gap;
  const headerH =
    Math.ceil(DASH_MEMBER_CARD.labelSize * 1.2) +
    DASH_MEMBER_CARD.labelValueGap +
    DASH_MEMBER_CARD.valueSize;
  return headerH + gridH + DASH_LAYOUT.topCardPadding * 2;
}

/** 4열 그리드에서 2행 카드 높이(=1행 카드 높이) */
export function dashStatRowHeight(gridWidth: number): number {
  const cols = DASH_LAYOUT.gridColumns;
  const gap = DASH_LAYOUT.gridGap;
  const colW = (gridWidth - (cols - 1) * gap) / cols;
  if (colW <= 0) return DASH_LAYOUT.topCardHeight;

  const memberCardW = 2 * colW + gap;
  const memberInnerW = memberCardW - DASH_LAYOUT.topCardPadding * 2;
  const memberMinH = dashMemberCardMinHeight(memberInnerW);

  const [aw, ah] = DASH_LAYOUT.midCardAspectRatio.split("/").map((s) => parseFloat(s.trim()));
  const aspectH = aw && ah ? Math.round(colW * (ah / aw)) : DASH_LAYOUT.topCardHeight;

  return Math.max(memberMinH, aspectH, DASH_LAYOUT.topCardHeight);
}

/**
 * 출석 통계 블록(1행 좌) 최소 높이 — 첫 화면에서 상단 카드 아래~뷰포트 하단까지 채움.
 * 부서별 인원은 그 아래(스크롤)로 밀림.
 */
export function dashAttendanceSectionMinHeight(statRowHeight: number): string {
  const topCards = statRowHeight * 2 + DASH_LAYOUT.gridGap;
  const offset =
    DASH_LAYOUT.dashboardViewportOffset + topCards + DASH_LAYOUT.gridGap * 2;
  return `calc(100dvh - ${offset}px)`;
}

/** 4열 그리드 2칸(금주 출석률) 폭 — 상단 메뉴 기준선과 동일 */
export function dashTopNavTabsWidthCss(spanCols = 2): string {
  const cols = DASH_LAYOUT.gridColumns;
  const gap = DASH_LAYOUT.gridGap;
  if (spanCols >= cols) return "100%";
  const gapsInside = spanCols - 1;
  const gapsTotal = cols - 1;
  return `calc((100% - ${gapsTotal * gap}px) / ${cols} * ${spanCols} + ${gapsInside * gap}px)`;
}

/** 전체 성도 카드 콘텐츠 너비(좌우 패딩 제외) */
export function dashMemberCardInnerWidth(statGridWidth: number): number {
  const cols = DASH_LAYOUT.gridColumns;
  const gap = DASH_LAYOUT.gridGap;
  const colW = (statGridWidth - (cols - 1) * gap) / cols;
  if (colW <= 0) return 0;
  return 2 * colW + gap - DASH_LAYOUT.topCardPadding * 2;
}

/** MemberDotGrid 렌더 높이 — 25열 aspect-ratio 1 dot × 4행 (그리드 공식과 동일) */
export function dashMemberDotGridRenderedHeight(dotGridWidth: number): number {
  const cols = DASH_LAYOUT.memberDotCols;
  const rows = DASH_LAYOUT.memberDotRows;
  const gap = DASH_LAYOUT.memberDotGap;
  if (dotGridWidth <= 0) {
    return rows * DASH_LAYOUT.memberDotSize + (rows - 1) * gap;
  }
  const cell = (dotGridWidth - (cols - 1) * gap) / cols;
  return rows * cell + (rows - 1) * gap;
}

/** 1행 카드 — 라벨·숫자 블록 높이(시각화 상단 여백 제외) */
export function dashTopCardTextBlockHeight(typoScale = 1): number {
  return (
    Math.ceil(dashScalePx(DASH_ATTENDANCE_CARD.labelSize, typoScale) * 1.2) +
    dashScalePx(DASH_ATTENDANCE_CARD.labelValueGap, typoScale) +
    dashScalePx(DASH_ATTENDANCE_CARD.valueSize, typoScale)
  );
}

/** @deprecated dashTopCardVisualMetrics 사용 */
export function dashTopCardHeaderBlockHeight(): number {
  return dashTopCardTextBlockHeight() + DASH_ATTENDANCE_CARD.barMarginTop;
}

export type DashTopCardVisualMetrics = {
  height: number;
  cell: number;
};

/**
 * 1행 카드 시각화(막대·dot) — 너비·높이 제약 중 작은 쪽으로 cell 산출.
 * scale 축소 없이 gap 6px 유지, 막대와 동일 높이.
 */
export function dashTopCardVisualMetrics(
  statGridWidth: number,
  cardRowHeight: number,
  typoScale = 1,
): DashTopCardVisualMetrics {
  const cols = DASH_LAYOUT.memberDotCols;
  const rows = DASH_LAYOUT.memberDotRows;
  const gap = DASH_LAYOUT.memberDotGap;
  const innerW = dashMemberCardInnerWidth(statGridWidth);
  const barMarginTop = dashScalePx(DASH_ATTENDANCE_CARD.barMarginTop, typoScale);

  const cellFromWidth =
    innerW > 0 ? (innerW - (cols - 1) * gap) / cols : DASH_LAYOUT.memberDotSize;

  const maxVisualH =
    cardRowHeight -
    DASH_LAYOUT.topCardPadding * 2 -
    dashTopCardTextBlockHeight(typoScale) -
    barMarginTop;

  const cellFromHeight =
    maxVisualH > 0 ? (maxVisualH - (rows - 1) * gap) / rows : cellFromWidth;

  const cell = Math.min(cellFromWidth, cellFromHeight);
  const height = rows * cell + (rows - 1) * gap;

  return { height, cell };
}

/**
 * 1행 카드 시각화(막대·dot) 공통 높이.
 */
export function dashTopCardVisualHeight(statGridWidth: number, cardRowHeight: number, typoScale = 1): number {
  return dashTopCardVisualMetrics(statGridWidth, cardRowHeight, typoScale).height;
}
