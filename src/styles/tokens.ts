/**
 * App-wide design tokens (legacy hex object).
 *
 * @deprecated For new UI use {@link pcTokens} (CSS `var(--pc-*)` references). Kept for
 *   PastoralPage spacing math and existing imports until Phase 4. See `src/styles/MIGRATION_NOTES.md`.
 */
export const tokens = {
  color: {
    // Surfaces & text (app-wide, low-chroma SaaS tone)
    bg: "#f5f7fb",
    card: "#ffffff",
    navy: "#4466e0",
    navyLight: "#3355cc",
    /** Headers, 출석 대시보드 강조 */
    navyEmphasis: "#E76F51", // 사이드바 주황 톤과 통일 (이전: #1a1d26)
    text: "#1a1d26",
    /** 세그먼트·보조 텍스트 (비강조 라벨) */
    sub: "#4a5068",
    textMuted: "#4a5068",
    textFaint: "#8b90a0",
    /** 작은 메트릭 라벨 (출석 카드 등) */
    labelMuted: "#8b90a0",
    border: "#e2e5ef",
    borderLight: "#eef0f6",

    blue: "#4466e0",
    blueBg: "#eef1fb",
    accent: "#4466e0",
    accentLight: "#eef1fb",
    accentBg: "#eef1fb",

    success: "#16a34a",
    successBg: "#f0fdf4",
    /** 차트·UI에서 쓰이는 보조 성공색 */
    successStrong: "#15803d",

    danger: "#dc2626",
    dangerBg: "#fef2f2",

    warning: "#e59500",
    warningBg: "#fffbeb",
    warningText: "#946b00",

    purple: "#7c5ce0",
    purpleBg: "#f3f0ff",
    teal: "#0d9488",
    tealBg: "#ecfdf5",
    pink: "#db2777",
    pinkBg: "#fce7f3",
    orange: "#ea580c",

    // Attendance / charts / heatmap
    gold: "#d4a853",
    grayUi: "#6b7280",
    trendPositive: "#4466e0",
    trendNegative: "#dc2626",
    chartGrid: "#eeeeee",
    heatMid: "#4a6fa5",
    heatLight: "#7a9bc4",
    heatFaint: "rgba(30,58,95,0.2)",
    grayBadgeMuted: "rgba(107,123,158,0.1)",
    white: "#ffffff",
  },

  fontSize: {
    scale: {
      xxs: 9,
      xs: 10,
      sm: 11,
      md: 12,
      base: 13,
      lg: 14,
      xl: 15,
      "2xl": 18,
      "3xl": 22,
      metric: 24,
    },
    mobile: {
      tab: 11,
      input: 12,
      search: 12,
      filter: 12,
      label: 10,
      value: 20,
      sub: 9,
      button: 11,
      tableHead: 10,
      tableBody: 12,
      cardTitle: 13,
      sectionTitle: 14,
      modalTitle: 16,
      dashboardTitle: 18,
      chartSectionTitle: 13,
    },
    desktop: {
      tab: 14,
      input: 14,
      search: 14,
      filter: 14,
      label: 12,
      value: 28,
      sub: 11,
      button: 14,
      tableHead: 12,
      tableBody: 14,
      cardTitle: 15,
      sectionTitle: 18,
      modalTitle: 20,
      dashboardTitle: 24,
      chartSectionTitle: 16,
    },
  },

  fontWeight: {
    normal: 400,
    medium: 500,
    semibold: 600,
    bold: 700,
    extrabold: 800,
  },

  height: {
    // 모바일
    mobileInput: 32,
    mobileSelect: 32,
    mobileButton: 32,
    mobileSegment: 28,
    mobileCardMin: 56,
    mobileAvatar: 24,
    mobileTableRow: 36,
    mobileChart: 160,
    // 데스크톱
    desktopInput: 40,
    desktopSelect: 40,
    desktopButton: 40,
    desktopSegment: 38,
    desktopCardMin: 90,
    desktopAvatar: 36,
    desktopTableRow: 48,
    desktopChart: 260,
  },

  space: {
    gap: { xxs: 2, xs: 4, sm: 6, md: 8, lg: 12, xl: 16, "2xl": 20, "3xl": 24 },
    padding: {
      // 모바일
      mobileCard: "8px 10px",
      mobileSection: 8,
      mobileFilter: "0 8px",
      mobileInput: "0 10px 0 30px",
      // 데스크톱
      desktopCard: "16px 20px",
      desktopSection: 16,
      desktopFilter: "0 14px",
      desktopInput: "0 14px 0 40px",
    },
  },

  radius: {
    xs: 7,
    sm: 7,
    md: 7,
    lg: 7,
    xl: 7,
    "2xl": 7,
    pill: 7,
  },

  /** 모바일 목양/출석: 하단 네비·헤더·서브탭 제외 — 리스트 스크롤 + 하단 페이지네이션 고정 */
  layout: {
    mobPastoralPanelMinHeight: "calc(100vh - 88px - 48px - 40px)",
  },
} as const;

export type Tokens = typeof tokens;

/** HANDOFF v3 — CSS custom properties (`src/styles/tokens.css`). Safe for new components. */
export const pcTokens = {
  color: {
    textStrong: "var(--pc-text-strong)",
    text: "var(--pc-text)",
    textSub: "var(--pc-text-sub)",
    textFaint: "var(--pc-text-faint)",
    bg: "var(--pc-bg)",
    surface: "var(--pc-surface)",
    border: "var(--pc-border)",
    primary: "var(--pc-primary)",
    primaryHover: "var(--pc-primary-hover)",
    primarySoft: "var(--pc-primary-soft)",
    success: "var(--pc-success)",
    danger: "var(--pc-danger)",
    warning: "var(--pc-warning)",
    purple: "var(--pc-purple)",
    teal: "var(--pc-teal)",
    orange: "var(--pc-orange)",
    pink: "var(--pc-pink)",
    indigo: "var(--pc-indigo)",
    chart: [
      "var(--pc-chart-1)",
      "var(--pc-chart-2)",
      "var(--pc-chart-3)",
      "var(--pc-chart-4)",
      "var(--pc-chart-5)",
      "var(--pc-chart-6)",
      "var(--pc-chart-7)",
      "var(--pc-chart-8)",
    ] as const,
  },
  radius: {
    sm: "var(--pc-radius-sm)",
    base: "var(--pc-radius)",
    md: "var(--pc-radius-md)",
    lg: "var(--pc-radius-lg)",
    xl: "var(--pc-radius-xl)",
    avatar: "var(--pc-radius-avatar)",
    full: "var(--pc-radius-full)",
  },
  shadow: {
    sm: "var(--pc-shadow-sm)",
    base: "var(--pc-shadow)",
    md: "var(--pc-shadow-md)",
    lg: "var(--pc-shadow-lg)",
    focus: "var(--pc-shadow-focus)",
  },
  space: {
    1: "4px",
    2: "8px",
    3: "12px",
    4: "16px",
    5: "20px",
    6: "24px",
    8: "32px",
    10: "40px",
    12: "48px",
    16: "64px",
  },
  font: {
    family: "var(--font-sans)",
    sizes: {
      xs: "11px",
      sm: "12px",
      base: "14px",
      md: "15px",
      lg: "16px",
      xl: "20px",
      "2xl": "24px",
      "3xl": "28px",
      "4xl": "36px",
    },
    weights: {
      regular: 400,
      medium: 500,
      semibold: 600,
      bold: 700,
      extrabold: 800,
    },
  },
} as const;

export type PcTokens = typeof pcTokens;
