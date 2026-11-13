# Design Tokens

다른 프로젝트에 그대로 붙일 수 있게, 이 저장소의 디자인 값만 모았다.
도메인 데이터·화면 카피는 넣지 않았다.

## 출처

| 파일 | 역할 |
|---|---|
| `tailwind.config.ts` | Tailwind `colors`, `fontFamily`, `borderRadius` |
| `app/globals.css` | 테마 색(`--color-*`), 폰트, 페이지 셸, `.card` / `table.tbl` / `.pco-*` |
| `src/styles/tokens.css` | 컴포넌트 토큰(`--pc-*`). 간격·라운드·그림자·타이포 스케일의 원본 |
| `adminStyles.ts` | **이 저장소에 없다.** 같은 역할의 실제 파일은 `src/styles/tokens.ts`(`pcTokens`), `src/styles/designTokens.ts`, `src/components/layout/UnifiedPageLayout.tsx`의 `LAYOUT` |

값이 겹치면 아래 순서로 덮인다.

1. `tokens.css`가 `--pc-*` 리터럴을 넣는다.
2. `globals.css`의 `@layer base`가 그중 색·표면 일부를 `--color-*` 별칭으로 다시 연결한다.
3. 그래서 라이트 모드에서 화면에 칠해지는 primary는 `tokens.css`의 `#4466e0`이 아니라 `--color-primary` `#E76F51`이다.

대시보드 카드·좌측 메뉴는 CSS 변수가 아니라 `src/styles/pastoralDashboardTokens.ts`의 고정 hex를 쓴다. 그 값은 4·6·7절에 따로 적었다.

---

## 1. 색상

### 1-1. 라이트 테마 — 화면에 실제로 칠해지는 값

`app/globals.css` `:root` / `:root[data-mode="light"]`.

```css
:root,
:root[data-mode="light"] {
  --color-primary: #E76F51;
  --color-primary-hover: #D85C3F;
  --color-primary-soft: #FDF1E8;
  --color-primary-on: #ffffff;

  --color-surface: #ffffff;
  --color-surface-muted: #ffffff;
  --color-surface-sidebar: #f4f4f6;
  --color-surface-elevated: #ffffff;

  --color-border: #E5E7EB;
  --color-border-strong: #D1D5DB;
  --color-border-soft: #F3F4F6;

  --color-text: #1a1d26;
  --color-text-muted: #4a5068;
  --color-text-faint: #8b90a0;

  --color-success: #16a34a;
  --color-danger: #dc2626;
  --color-warning: #e59500;
  --color-info: #2563eb;
}
```

`@layer base`가 컴포넌트 토큰을 위 값에 묶는다. 라이트에서 풀어 쓴 결과:

| 변수 | 라이트에서 실제 색 |
|---|---|
| `--pc-text-strong`, `--pc-text`, `--text1` | `#1a1d26` |
| `--pc-text-sub`, `--text2` | `#4a5068` |
| `--pc-text-faint`, `--text3` | `#8b90a0` |
| `--pc-bg`, `--bg` | `#ffffff` |
| `--pc-bg-alt` | `#F3F4F6` |
| `--pc-surface`, `--surface` | `#ffffff` |
| `--pc-surface-hover`, `--surface2` | `#ffffff` |
| `--pc-border`, `--border` | `#E5E7EB` |
| `--pc-border-strong`, `--border2` | `#D1D5DB` |
| `--pc-divider`, `--sep`, `--border-light` | `#F3F4F6` |
| `--pc-primary`, `--blue` | `#E76F51` |
| `--pc-primary-hover`, `--blue-dark` | `#D85C3F` |
| `--pc-primary-soft`, `--blue-light` | `#FDF1E8` |
| `--pc-success`, `--green` | `#16a34a` |
| `--pc-danger`, `--red` | `#dc2626` |
| `--pc-warning`, `--orange` | `#e59500` |
| `--pc-info` | `#2563eb` |
| `--pc-overlay` | `rgba(0, 0, 0, 0.6)` |
| `--pc-success-soft` | `color-mix(in srgb, var(--color-success) 14%, transparent)` |
| `--pc-danger-soft` | `color-mix(in srgb, var(--color-danger) 14%, transparent)` |
| `--pc-warning-soft` | `color-mix(in srgb, var(--color-warning) 16%, transparent)` |
| `--pc-info-soft` | `color-mix(in srgb, var(--color-info) 18%, transparent)` |

### 1-2. primary 테마 스위치

`html`에 `data-theme`만 바꾸면 primary 4개만 바뀐다. 표면·텍스트·보더는 그대로다.

```css
:root[data-theme="orange"] {
  --color-primary: #E76F51;
  --color-primary-hover: #D85C3F;
  --color-primary-soft: #FDF1E8;
  --color-primary-on: #ffffff;
}
:root[data-theme="blue"] {
  --color-primary: #2563eb;
  --color-primary-hover: #1d4ed8;
  --color-primary-soft: #DBEAFE;
  --color-primary-on: #ffffff;
}
:root[data-theme="green"] {
  --color-primary: #16a34a;
  --color-primary-hover: #15803d;
  --color-primary-soft: #DCFCE7;
  --color-primary-on: #ffffff;
}
:root[data-theme="purple"] {
  --color-primary: #7c5ce0;
  --color-primary-hover: #6d47d4;
  --color-primary-soft: #F3F0FF;
  --color-primary-on: #ffffff;
}
```

### 1-3. 다크 모드

```css
:root[data-mode="dark"] {
  --color-surface: #1f2128;
  --color-surface-muted: #15171c;
  --color-surface-sidebar: #1a1d24;
  --color-surface-elevated: #2a2d36;
  --color-border: #2f333d;
  --color-border-strong: #3f4450;
  --color-border-soft: #25282f;
  --color-text: #f0f1f5;
  --color-text-muted: #a8aebd;
  --color-text-faint: #6b7180;
  --color-success: #22c55e;
  --color-danger: #ef4444;
  --color-warning: #f59e0b;
  --color-info: #60a5fa;
}
```

### 1-4. Design System v1 — 뉴트럴 + 액센트 8색

`app/globals.css` 상단, `tailwind.config.ts`의 `app-*` / 액센트 키와 동일하다.
페이지 배경은 이 `--color-white`(`#f4f4f6`)다. 순백이 아니다.

```css
:root {
  --color-black: #0b0c0e;
  --color-white: #f4f4f6;
  --color-gray: #a0a5b1;

  --color-lavender: #c7b0ff;
  --color-citrus-green: #e0e446;
  --color-peach: #ffe8d2;
  --color-sunset-orange: #ff7144;
  --color-glacier-blue: #d8e6ff;
  --color-blue: #334ed8;
  --color-deep-green: #33473b;
  --color-pink: #ffa9ff;

  --font-sans: 'Inter', 'Pretendard', system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif;
}
```

Tailwind 클래스명 (`tailwind.config.ts`):

| 클래스 | 값 |
|---|---|
| `bg-app-black` / `text-app-black` | `#0b0c0e` |
| `bg-app-white` | `#f4f4f6` |
| `text-app-gray` | `#a0a5b1` |
| `bg-lavender` | `#c7b0ff` |
| `bg-citrus-green` | `#e0e446` |
| `bg-peach` | `#ffe8d2` |
| `bg-sunset-orange` | `#ff7144` |
| `bg-glacier-blue` | `#d8e6ff` |
| `bg-app-blue` | `#334ed8` |
| `bg-deep-green` | `#33473b` |
| `bg-app-pink` | `#ffa9ff` |
| `bg-surface` `text-text1` 등 | `var(--surface)` `var(--text1)` … (`@layer base` 별칭) |

### 1-5. `tokens.css` 원본 — `@layer base`가 덮기 전의 `--pc-*`

컴포넌트(`PcCard`, `PcTable`)는 변수 이름만 참조한다.
색을 이식할 때 라이트 테마(1-1)를 쓰면 현재 앱과 같고, 아래 리터럴을 쓰면 HANDOFF v3(파란 primary)가 된다.

```css
:root {
  --pc-text-strong: #1a1d26;
  --pc-text: #2d3142;
  --pc-text-sub: #4a5068;
  --pc-text-faint: #8b90a0;
  --pc-text-disabled: #c4c8d4;

  --pc-bg: #f5f6fb;
  --pc-bg-alt: #eef0f8;
  --pc-surface: #ffffff;
  --pc-surface-hover: #f8f9ff;
  --pc-overlay: rgba(20, 24, 40, 0.45);

  --pc-border: #e8e9f0;
  --pc-border-strong: #d4d7e3;
  --pc-divider: #eef0f6;

  --pc-primary: #4466e0;
  --pc-primary-hover: #3855c4;
  --pc-primary-soft: #e8edff;

  --pc-purple: #7c5ce0;
  --pc-teal: #14b8a6;
  --pc-orange: #f59e0b;
  --pc-pink: #ec4899;
  --pc-indigo: #6366f1;

  --pc-success: #16a34a;
  --pc-success-soft: #dcfce7;
  --pc-warning: #d97706;
  --pc-warning-soft: #fef3c7;
  --pc-danger: #dc2626;
  --pc-danger-soft: #fde8e8;
  --pc-info: #2563eb;
  --pc-info-soft: #dbeafe;

  --pc-chart-1: #6b8aff;
  --pc-chart-2: #9b7cf2;
  --pc-chart-3: #4ade80;
  --pc-chart-4: #fbbf24;
  --pc-chart-5: #fb7185;
  --pc-chart-6: #38bdf8;
  --pc-chart-7: #a78bfa;
  --pc-chart-8: #34d399;

  --pc-purple-light: #ede9fe;
  --pc-teal-light: #cffafe;
  --pc-indigo-light: #e0e7ff;
  --pc-pink-light: #fce7f3;

  --pc-on-accent: #ffffff;
  --pc-bg-alt-hover: #ebecf3;
}
```

`@layer base`가 덮지 않아 라이트에서도 위 리터럴이 유지되는 색: `--pc-text-disabled`, `--pc-purple`, `--pc-teal`, `--pc-pink`, `--pc-indigo`, `--pc-chart-1`~`8`, `*-light` 4개.

### 1-6. 통계 카드 톤 · 카드 테두리

`tokens.css` 원본. 라이트에서는 `--pc-stat-card-*`와 orange/blue 톤만 `globals.css`가 다시 지정한다.

```css
:root {
  --pc-stat-tone-orange-bg: #FCE8D5;
  --pc-stat-tone-orange-fg: #E76F51;
  --pc-stat-tone-green-bg: #EAF4EC;
  --pc-stat-tone-green-fg: #5B8B6A;
  --pc-stat-tone-pink-bg: #F5E8F0;
  --pc-stat-tone-pink-fg: #A26B8E;
  --pc-stat-tone-yellow-bg: #FDF6E3;
  --pc-stat-tone-yellow-fg: #C9A227;
  --pc-stat-tone-blue-bg: #E8EEF7;
  --pc-stat-tone-blue-fg: #4466E0;
  --pc-stat-tone-gray-bg: #F1EFEC;
  --pc-stat-tone-gray-fg: #6B6B6B;

  --pc-stat-card-border: #E8E2D8;
  --pc-stat-card-shadow: 0 1px 2px rgba(60, 40, 20, 0.04), 0 4px 12px rgba(60, 40, 20, 0.06);
  --pc-stat-card-shadow-hover: 0 2px 4px rgba(60, 40, 20, 0.06), 0 8px 20px rgba(60, 40, 20, 0.08);
}
```

라이트 `@layer base` 덮어쓰기:

```css
--pc-stat-card-border: var(--color-border);          /* #E5E7EB */
--pc-stat-card-shadow: 0 1px 2px rgba(0,0,0,0.12), 0 4px 12px rgba(0,0,0,0.10);
--pc-stat-card-shadow-hover: 0 2px 4px rgba(0,0,0,0.16), 0 8px 20px rgba(0,0,0,0.14);
--pc-stat-tone-orange-bg: var(--color-primary-soft); /* #FDF1E8 */
--pc-stat-tone-orange-fg: var(--color-primary);      /* #E76F51 */
--pc-stat-tone-blue-bg: var(--color-primary-soft);
--pc-stat-tone-blue-fg: var(--color-primary);
```

추세 배지 (`PcStatCard.module.css`, 토큰 밖 고정색):

| 클래스 | 글자 | 배경 |
|---|---|---|
| `.trend-up` | `#2D7A4A` | `#EAF4EC` |
| `.trend-down` | `#C44545` | `#FBEAEA` |
| `.trend-flat` | `#6B6B6B` | `#F1EFEC` |

### 1-7. 대시보드·메뉴에서 쓰는 고정색

`src/styles/pastoralDashboardTokens.ts`. CSS 변수를 타지 않는다.

| 이름 | 값 | 쓰는 곳 |
|---|---|---|
| `DASH_GLOBAL.bg` | `#f4f4f6` | 페이지·사이드바·콘텐츠 배경 |
| `DASH_COLOR.ink` | `#0b0c0e` | 본문 잉크 |
| `DASH_COLOR.cardBg` | `#ffffff` | 카드, 메뉴 hover 박스 |
| `DASH_COLOR.cardBorder` | `rgba(0,0,0,0.03)` | 카드 테두리 |
| `DASH_COLOR.sidebarDateToday` | `#a4aab4` | 사이드바 "Today" |
| `DASH_COLOR.sidebarDateValue` | `#787f8c` | 사이드바 날짜 |
| `DASH_COLOR.menubarBaseline` | `#ccd0d7` | 상단 메뉴·검색 밑줄 |
| `DASH_COLOR.indicator` | `#33343a` | 활성 탭 하이라이트 |
| `DASH_CARD.floatShadow` | `0 2px 12px rgba(17,17,26,0.05)` | 떠 있는 카드 |

상단 검색 (`globals.css`):

```css
:root {
  --topbar-search-w: 283px;
  --topbar-search-h: 34px;
  --topbar-search-radius: 0px;
  --topbar-search-bg: transparent;
  --topbar-search-underline: #ccd0d7;
  --topbar-menu-underline-h: 3px;
  --topbar-search-placeholder: #b4b4b8;
  --topbar-search-icon: #171719;
}
```

배지 (`.pco-badge-*`, `globals.css`):

| 클래스 | 배경 | 글자 |
|---|---|---|
| `.pco-badge-blue` | `#e8f0fe` | `#2952b3` |
| `.pco-badge-green` | `#dcfce7` | `#15803d` |
| `.pco-badge-yellow` | `#fef3c7` | `#a16207` |
| `.pco-badge-red` | `#fde8e8` | `#b91c1c` |

---

## 2. 타이포그래피

### 2-1. 폰트 패밀리

영문·숫자·기호는 Inter, 한글은 Pretendard.

```css
@font-face {
  font-family: 'Inter';
  src: url('/fonts/Inter-VariableFont_opsz,wght.ttf') format('truetype-variations');
  font-weight: 100 900;
  font-style: normal;
  font-display: swap;
}
@font-face {
  font-family: 'Pretendard';
  src: url('/fonts/PretendardVariable.woff2') format('woff2-variations');
  font-weight: 45 920;
  font-style: normal;
  font-display: swap;
}

:root {
  --font-sans: 'Inter', 'Pretendard', system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif;
  --pc-font: var(--pc-font-loaded, "Inter"), "Noto Sans KR", -apple-system, BlinkMacSystemFont, sans-serif;
  --pc-font-mono: "JetBrains Mono", "D2Coding", ui-monospace, monospace;
}

html, body {
  font-family: var(--font-sans);
  -webkit-font-smoothing: antialiased;
  -moz-osx-font-smoothing: grayscale;
}
```

`tailwind.config.ts`: `fontFamily.sans = ["var(--font-sans)"]` → `font-sans`.

메뉴·검색 입력은 한글 우선으로 직접 지정한다.

```css
font-family: 'Pretendard', 'Inter', system-ui, sans-serif;
```

### 2-2. 크기 스케일 (`tokens.css` / `pcTokens.font.sizes`)

| 토큰 | px | 굵기 토큰 |
|---|---|---|
| `--pc-text-xs` | 11 | `--pc-weight-regular` 400 |
| `--pc-text-sm` | 12 | `--pc-weight-medium` 500 |
| `--pc-text-base` | 14 | `--pc-weight-semibold` 600 |
| `--pc-text-md` | 15 | `--pc-weight-bold` 700 |
| `--pc-text-lg` | 16 | `--pc-weight-extrabold` 800 |
| `--pc-text-xl` | 20 | |
| `--pc-text-2xl` | 24 | |
| `--pc-text-3xl` | 28 | |
| `--pc-text-4xl` | 36 | |

행간: `--pc-leading-tight` 1.2 / `--pc-leading-normal` 1.5 / `--pc-leading-relaxed` 1.7.

`body` 기본은 15px / line-height 1.5 / `color: var(--text1)`.

### 2-3. 역할별 크기 — 코드가 실제로 쓰는 값

| 역할 | 크기 | 굵기 | 색 | 출처 |
|---|---|---|---|---|
| 페이지 제목 | 24px (모바일 16px) | 700 | `var(--color-text)` `#1a1d26` | `LAYOUT.headerTitleFontSize` |
| 페이지 설명 | 14px (모바일 11px) | 400 | `var(--color-text-muted)` `#4a5068` | `LAYOUT.headerDescFontSize` |
| 카드 제목 | 16px (`--pc-text-lg`) | 700 | `--pc-text-strong` | `PcCard` `.title` |
| 섹션 제목 | 19px (모바일 17px) | 700 | `#0b0c0e` | `DASH_SECTION.titleSize` |
| 본문 | 15px (콘텐츠 영역), 카드 본문 14px | 400 | `--pc-text` | `UnifiedPageLayout` 콘텐츠 `fontSize`, `PcCard` `.body` |
| 보조 텍스트 | 12px (`--pc-text-sm`) | 400 | `--pc-text-sub` | `PcCard` `.subtitle`, 통계 카드 `.sub` |
| 표 헤더 | 11px (`--pc-text-xs`), uppercase, letter-spacing 0.5px | 600 | `--pc-text-faint` | `PcTable` `.th` |
| 표 셀 | 12px (`--pc-text-sm`), `size="lg"`면 14px | 400 | `--pc-text` | `PcTable` `.td` |
| 통계 숫자 | 28px (compact 24 / dense 20) | 700 | `--pc-text-strong`, letter-spacing -0.02em, line-height 1.1 | `PcStatCard` `.value` |
| 히어로 숫자 | 62px | 800 | letter-spacing -0.03em | `DASH_ATTENDANCE_CARD.valueSize` |
| 히어로 라벨 | 19px | 700 | | `DASH_ATTENDANCE_CARD.labelSize` |
| 좌측 메뉴 | 15px | 600, 활성·hover 700 | `#0b0c0e` | `DASH_SIDEBAR.menuFontSize` |
| 상단 탭 | 15px, letter-spacing 0.35px | 600, 활성 700 | `#0b0c0e` | `.pc-nav-tab` |

```css
/* 페이지 제목 / 설명 */
.page-title { font-size: 24px; font-weight: 700; letter-spacing: -0.5px; line-height: 1.2; color: var(--color-text); }
.page-desc  { font-size: 14px; margin-top: 2px; line-height: 1.2; color: var(--color-text-muted); }

/* 카드 제목 / 본문 / 보조 */
.card-title { font-size: var(--pc-text-lg); font-weight: var(--pc-weight-bold); color: var(--pc-text-strong); margin: 0; }
.card-body  { font-size: var(--pc-text-base); color: var(--pc-text); line-height: var(--pc-leading-normal); }
.card-sub   { font-size: var(--pc-text-sm); color: var(--pc-text-sub); line-height: var(--pc-leading-normal); }

/* 통계 숫자 */
.stat-value { font-size: 28px; font-weight: 700; color: var(--pc-text-strong); letter-spacing: -0.02em; line-height: 1.1; }
.stat-label { font-size: 13px; font-weight: 500; color: var(--pc-text-sub); letter-spacing: -0.01em; }
```

---

## 3. 간격 · 라운드 · 그림자

### 3-1. 간격 — 4px 그리드 (`tokens.css`)

```css
:root {
  --pc-space-1: 4px;
  --pc-space-1-5: 6px;
  --pc-space-2: 8px;
  --pc-space-3: 12px;
  --pc-space-3-5: 14px;
  --pc-space-4: 16px;
  --pc-space-5: 20px;
  --pc-space-6: 24px;
  --pc-space-8: 32px;
  --pc-space-10: 40px;
  --pc-space-12: 48px;
  --pc-space-16: 64px;
}
```

`src/styles/tokens.ts`의 `tokens.space.gap` (레거시, px 숫자): `xxs 2 / xs 4 / sm 6 / md 8 / lg 12 / xl 16 / 2xl 20 / 3xl 24`.

### 3-2. 라운드

거의 전부 7px. pill도 7px다 (`--pc-radius-full: 7px`). 예외는 아바타·뱃지 점의 `50%` / `9999px`뿐이다.

```css
:root {
  --pc-radius-sm: 7px;
  --pc-radius: 7px;
  --pc-radius-md: 7px;
  --pc-radius-lg: 7px;
  --pc-radius-xl: 7px;
  --pc-radius-avatar: 7px;
  --pc-radius-full: 7px;
}
```

`tailwind.config.ts`의 `rounded-sm` ~ `rounded-3xl`도 전부 `7px`. `rounded-full`만 `9999px`.

### 3-3. 그림자

```css
:root {
  --pc-shadow-sm: 0 1px 2px rgba(20, 24, 40, 0.04);
  --pc-shadow: 0 2px 8px rgba(20, 24, 40, 0.06), 0 1px 2px rgba(20, 24, 40, 0.04);
  --pc-shadow-md: 0 8px 24px rgba(20, 24, 40, 0.08);
  --pc-shadow-lg: 0 20px 60px rgba(20, 24, 40, 0.15);
  --pc-shadow-focus: 0 0 0 3px rgba(68, 102, 224, 0.25);
  --pc-shadow-focus-danger: 0 0 0 3px rgba(220, 38, 38, 0.22);
}
```

`@layer base` 별칭: `--shadow-sm` = `--pc-shadow-sm`, `--shadow-md` = `--pc-shadow`, `--shadow-lg` = `--pc-shadow-md`, `--shadow-xl` = `--pc-shadow-lg`, `--shadow-card` = `--pc-shadow-sm`.

컴포넌트가 변수 대신 직접 쓴 그림자:

| 쓰임 | 값 |
|---|---|
| `.card` / `.card-unified` | `0 1px 3px rgba(0,0,0,0.04)` |
| `.pc-card` | `0 1px 3px rgba(0, 0, 0, 0.03)` |
| 대시보드 플로팅 카드 | `0 2px 12px rgba(17,17,26,0.05)` |
| 좌측 메뉴 active/hover | `0 1px 2px rgba(0,0,0,0.04)` |
| `.btn-primary` (하단 오버라이드) | `0 2px 8px rgba(68,102,224,0.2)` |
| 검색 결과 패널 | `0 12px 32px rgba(11, 12, 14, 0.12)` |
| `.app-modal-card` | `0 2px 12px rgba(17, 17, 26, 0.05)` |
| `.pco-modal` | `0 20px 60px rgba(0,0,0,0.15)` |

### 3-4. 컨트롤 높이 (`tokens.css`)

```css
:root {
  --pc-control-height-sm: 28px;
  --pc-control-height-md: 36px;
  --pc-control-height-lg: 44px;
  --pc-input-height-sm: 32px;
  --pc-input-height-md: 38px;
  --pc-input-height-lg: 44px;
  --pc-transition-fast: 0.12s ease;
  --pc-transition: 0.18s ease;
  --pc-transition-slow: 0.3s ease;
}
```

---

## 4. 카드

세 층이 있다. 새 화면의 흰 카드 클래스는 `.pc-card` / `.card`. 컴포넌트 API는 `PcCard`. 대시보드 큰 카드만 테두리 없이 그림자로 뜬다.

### 4-1. 전역 클래스 (`app/globals.css`)

나중에 나오는 `.card` 블록이 `!important`로 앞의 `.card`를 덮는다. 복사할 때는 아래 최종값만 쓰면 된다.

```css
.card {
  background: #ffffff;
  border: 1px solid #e8e9f0;
  border-radius: 7px;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.04);
  overflow: hidden;
  margin-bottom: 16px;
}

.card-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 14px 16px;
  border-bottom: 0.5px solid var(--sep);
}

.card-body { padding: 0; }
.card-body-padded { padding: 16px; }

.card-unified {
  background: var(--color-surface);
  color: var(--color-text);
  border: 1px solid #e8e9f0; /* 소스에 border가 두 번 있고, 이 선언이 이긴다 */
  border-radius: 7px;
  box-shadow: 0 1px 3px rgba(0,0,0,0.04);
  padding: 24px;
}

.pc-card {
  background: #ffffff;
  border: 1px solid #e2e5ef;
  border-radius: 7px;
  padding: 20px;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.03);
}

.pco-card {
  background: var(--pco-card);          /* = --color-surface #ffffff */
  border: 1px solid var(--pco-border);  /* = --color-border #E5E7EB */
  border-radius: 7px;
  padding: 24px;
}
.pco-card-title {
  font-size: 16px;
  font-weight: 700;
  color: var(--pco-text);
  margin: 0 0 16px 0;
}
```

```html
<article class="pc-card">
  <header class="card-header">
    <h3 class="pco-card-title">제목</h3>
  </header>
  <div class="card-body-padded">본문</div>
</article>
```

### 4-2. `PcCard` 구조

`src/components/ui/PcCard.tsx` + `PcCard.module.css`.
CSS Module이라 클래스명은 빌드 때 해시된다. 다른 프로젝트에는 아래 CSS를 일반 클래스로 붙이면 된다.

DOM:

```text
div.pc-card.pc-card--md.pc-card--sm
  header.pc-card__header
    div.pc-card__title-block
      h3.pc-card__title
      p.pc-card__subtitle
    div.pc-card__actions
  hr.pc-card__divider
  div.pc-card__body
```

`padding`: `sm` 16 / `md` 24 / `lg` 32 (`--pc-space-4/6/8`).
`elevation`: `none` / `sm`(`--pc-shadow-sm`) / `md`(`--pc-shadow`). 기본은 `md` 패딩 + `sm` 그림자.

```css
.pc-card {
  background: var(--pc-surface);
  border: 1px solid var(--pc-border);
  border-radius: var(--pc-radius-md);
  box-sizing: border-box;
  font-family: var(--font-sans);
  color: var(--pc-text-strong);
  padding: var(--pc-space-6);          /* md = 24px */
  box-shadow: var(--pc-shadow-sm);
}
.pc-card__header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: var(--pc-space-4);
  margin-bottom: var(--pc-space-4);
}
.pc-card__title {
  font-size: var(--pc-text-lg);
  font-weight: var(--pc-weight-bold);
  color: var(--pc-text-strong);
  margin: 0;
}
.pc-card__subtitle {
  margin: var(--pc-space-2) 0 0;
  font-size: var(--pc-text-sm);
  color: var(--pc-text-sub);
  line-height: var(--pc-leading-normal);
}
.pc-card__divider {
  height: 1px;
  background: var(--pc-divider);
  margin: 0 0 var(--pc-space-4);
  border: none;
}
.pc-card__body {
  font-size: var(--pc-text-base);
  color: var(--pc-text);
  line-height: var(--pc-leading-normal);
}
```

```html
<div class="pc-card">
  <header class="pc-card__header">
    <div>
      <h3 class="pc-card__title">제목</h3>
      <p class="pc-card__subtitle">보조 설명</p>
    </div>
    <div class="pc-card__actions"><!-- 버튼 --></div>
  </header>
  <hr class="pc-card__divider" />
  <div class="pc-card__body">본문</div>
</div>
```

### 4-3. 대시보드 플로팅 카드

`DASH_CARD`. 테두리는 거의 안 보이고 그림자로만 떠 있다.

```css
.float-card {
  background: #ffffff;
  border: 1px solid rgba(0, 0, 0, 0.03);
  border-radius: 7px;
  box-shadow: 0 2px 12px rgba(17, 17, 26, 0.05);
  padding: 24px;
}
```

통계 카드 (`PcStatCard.module.css` 하단 `.card`가 위 블록을 덮는다):

```css
.stat-card {
  display: flex;
  align-items: flex-start;
  gap: 14px;
  padding: 18px 20px;
  min-height: 88px;
  box-sizing: border-box;
  background: var(--pc-surface);
  border: 1px solid var(--pc-stat-card-border);
  border-radius: 7px;
  box-shadow: var(--pc-stat-card-shadow);
  transition: transform 150ms ease, box-shadow 150ms ease;
}
.stat-card:hover {
  transform: translateY(-1px);
  box-shadow: var(--pc-stat-card-shadow-hover);
}
.stat-card__icon {
  width: 36px;
  height: 36px;
  border-radius: 7px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}
```

---

## 5. 표

### 5-1. `table.tbl` (`app/globals.css`)

정의가 두 번 있다. 아래는 나중 블록까지 합친 최종 모습이다.

```css
.tbl-wrap {
  overflow-x: auto;
  -webkit-overflow-scrolling: touch;
}

table.tbl {
  width: 100%;
  border-collapse: collapse;
  font-size: 13px;
  border: 1px solid #e8e9f0;
  border-radius: 7px;
  overflow: hidden;
}

table.tbl thead th {
  padding: 10px 14px;
  text-align: left;
  font-weight: 600;
  font-size: 13px;          /* 앞 블록은 11px + uppercase. 뒤 블록이 13px로 덮음 */
  color: #4b5563;
  letter-spacing: 0.5px;
  text-transform: uppercase;
  background: #f6f7fd;
  border-bottom: 1px solid #e8e9f0;
  white-space: nowrap;
  position: sticky;
  top: 0;
  z-index: 1;
}

table.tbl tbody tr {
  border-bottom: 1px solid #e8ecf4;
  transition: background 0.1s;
  cursor: pointer;
}
table.tbl tbody tr:hover { background: #f8f9ff; }

table.tbl tbody td {
  padding: 10px 14px;
  border-bottom: 0.5px solid var(--sep);
  vertical-align: middle;
  white-space: nowrap;
}
table.tbl tbody tr:last-child td { border-bottom: none; }
```

```html
<div class="tbl-wrap">
  <table class="tbl">
    <thead>
      <tr>
        <th>이름</th>
        <th>상태</th>
      </tr>
    </thead>
    <tbody>
      <tr>
        <td>항목</td>
        <td>값</td>
      </tr>
    </tbody>
  </table>
</div>
```

### 5-2. `.pco-table`

```css
.pco-table {
  border-radius: 7px;
  overflow: hidden;
  background: var(--pco-card);
  border: 1px solid var(--pco-border);
  width: 100%;
  border-collapse: collapse;
}
.pco-table th {
  font-size: 11px;
  text-transform: uppercase;
  letter-spacing: 0.5px;
  color: var(--pco-text-faint);
  font-weight: 600;
  padding: 12px 16px;
  border-bottom: 2px solid var(--pco-border);
  background: none;
  text-align: left;
}
.pco-table td {
  padding: 12px 16px;
  border-bottom: 1px solid var(--pco-border);
  color: var(--pco-text);
}
.pco-table tr:last-child td { border-bottom: none; }
.pco-table tr:hover td { background: #f8f9ff; }
```

### 5-3. `PcTable` 구조

`src/components/ui/PcTable.tsx` + `PcTable.module.css`.

```text
div.pc-table
  table.pc-table__table
    thead.pc-table__head [.is-sticky]
      tr
        th.pc-table__th.pc-table__th--md [.is-sortable]
          span.pc-table__th-inner
    tbody
      tr.pc-table__tr [.is-stripe] [.is-last] [.is-clickable]
        td.pc-table__td.pc-table__td--md
```

패딩 토큰 (`tokens.css`):

| size | 헤더 | 셀 |
|---|---|---|
| sm | 8px 12px | 8px 12px |
| md | 12px 16px | 12px 16px |
| lg | 14px 20px | 16px 20px |

```css
.pc-table { position: relative; width: 100%; font-family: var(--font-sans); }

.pc-table__table {
  width: 100%;
  border-collapse: separate;
  border-spacing: 0;
  border: 1px solid var(--pc-border);
  border-radius: var(--pc-radius);
  overflow: hidden;
  background: var(--pc-surface);
  box-sizing: border-box;
}

.pc-table__head { background: var(--pc-bg-alt); }
.pc-table__head.is-sticky {
  position: sticky;
  top: 0;
  z-index: 2; /* --pc-z-table-sticky-header */
}

.pc-table__th {
  text-align: left;
  vertical-align: middle;
  text-transform: uppercase;
  font-size: var(--pc-text-xs);       /* 11px */
  letter-spacing: 0.5px;
  color: var(--pc-text-faint);
  font-weight: var(--pc-weight-semibold);
  border-bottom: 1px solid var(--pc-border);
  padding: var(--pc-space-3) var(--pc-space-4); /* md: 12px 16px */
}
.pc-table__th.is-sortable { cursor: pointer; transition: background-color 0.12s ease; }
.pc-table__th.is-sortable:hover { background: var(--pc-bg-alt-hover); }

.pc-table__th-inner {
  display: inline-flex;
  align-items: center;
  gap: var(--pc-space-2);
  width: 100%;
}

.pc-table__td {
  vertical-align: middle;
  color: var(--pc-text);
  font-size: var(--pc-text-sm);       /* 12px. size=lg 이면 14px */
  border-bottom: 1px solid var(--pc-border);
  padding: var(--pc-space-3) var(--pc-space-4);
}
.pc-table__tr.is-last .pc-table__td { border-bottom: none; }
.pc-table.is-striped .pc-table__tr.is-stripe .pc-table__td {
  background: color-mix(in srgb, var(--pc-bg-alt) 50%, var(--pc-surface));
}
.pc-table.is-hoverable .pc-table__tr:hover .pc-table__td { background: var(--pc-bg-alt); }
```

```html
<div class="pc-table is-hoverable">
  <table class="pc-table__table">
    <thead class="pc-table__head">
      <tr>
        <th class="pc-table__th"><span class="pc-table__th-inner">이름</span></th>
        <th class="pc-table__th"><span class="pc-table__th-inner">상태</span></th>
      </tr>
    </thead>
    <tbody>
      <tr class="pc-table__tr">
        <td class="pc-table__td">항목</td>
        <td class="pc-table__td">값</td>
      </tr>
      <tr class="pc-table__tr is-last">
        <td class="pc-table__td">항목</td>
        <td class="pc-table__td">값</td>
      </tr>
    </tbody>
  </table>
</div>
```

---

## 6. 좌측 메뉴

클래스가 없다. `UnifiedPageLayout.tsx`가 `DASH_SIDEBAR` 숫자를 인라인 스타일로 그린다.
아래 CSS는 그 인라인 값을 클래스로 옮긴 것이다.

토큰 (`pastoralDashboardTokens.ts` `DASH_SIDEBAR`):

| 키 | 값 |
|---|---|
| `width` | 240 |
| `insetX` | 20 |
| `headerPaddingTop` | 34 |
| `logoToDateGap` | 18 |
| `dateFontSize` | 13 |
| `dateToMenuGap` | 56 |
| `itemRowGap` | 36 |
| `hoverBoxWidth` / `Height` | 200 / 40 |
| `hoverBoxRadius` | 7 |
| `hoverBoxPaddingX` | 12 |
| `iconSize` / `iconGap` | 18 / 10 |
| `menuFontSize` | 15 |
| `itemColor` | `#0b0c0e` |
| hover/active 배경 | `#ffffff` |
| active 그림자 | `0 1px 2px rgba(0,0,0,0.04)` |

```css
.sidebar {
  width: 240px;
  flex-shrink: 0;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  background: #f4f4f6;
  color: var(--color-text);
  border-right: none;
}

.sidebar__brand {
  padding: 34px 0 0;
  display: flex;
  justify-content: center;
  background: transparent;
}

.sidebar__date {
  margin-top: 18px;
  display: flex;
  align-items: baseline;
  justify-content: center;
  gap: 4px;
  font-family: 'Inter', 'Pretendard', system-ui, -apple-system, sans-serif;
  font-size: 13px;
  letter-spacing: 0;
  line-height: 1.2;
  white-space: nowrap;
}
.sidebar__date-label { font-weight: 500; color: #a4aab4; }
.sidebar__date-value { font-weight: 600; color: #787f8c; }

.sidebar__nav {
  flex: 1;
  padding: 56px 20px 12px;
  overflow-y: auto;
  display: flex;
  flex-direction: column;
}

.sidebar__group {
  display: flex;
  flex-direction: column;
  gap: 36px;
}

.sidebar__item {
  display: flex;
  align-items: center;
  gap: 10px;
  box-sizing: border-box;
  width: 200px;
  height: 40px;
  min-height: 40px;
  padding: 0 12px;
  border: none;
  border-radius: 7px;
  background: transparent;
  box-shadow: none;
  color: #0b0c0e;
  font-family: inherit;
  font-size: 15px;
  font-weight: 600;
  line-height: 1.4;
  letter-spacing: 0;
  text-align: left;
  white-space: nowrap;
  cursor: pointer;
  transition: background-color 0.15s ease, font-weight 0.12s ease;
}
.sidebar__item svg {
  width: 18px;
  height: 18px;
  flex-shrink: 0;
  stroke-width: 2.25;
}
.sidebar__item:hover,
.sidebar__item.is-active {
  background: #ffffff;
  font-weight: 700;
  box-shadow: 0 1px 2px rgba(0, 0, 0, 0.04);
}

.sidebar__badge {
  margin-left: auto;
  background: var(--color-danger);
  color: #fff;
  font-size: 11px;
  font-weight: 600;
  padding: 1px 7px;
  border-radius: 7px;
}
```

```html
<aside class="sidebar">
  <div class="sidebar__brand">
    <div class="sidebar__date">
      <span class="sidebar__date-label">Today</span>
      <span class="sidebar__date-value">2026. 09. 29. TUE</span>
    </div>
  </div>
  <nav class="sidebar__nav">
    <div class="sidebar__group">
      <button type="button" class="sidebar__item is-active">항목</button>
      <button type="button" class="sidebar__item">항목</button>
    </div>
  </nav>
</aside>
```

모바일(≤1024px)만 사이드바가 드로어다. 배경 `var(--color-surface-sidebar)`, 오른쪽 보더 `1px solid var(--color-border)`, 닫히면 `translateX(-100%)`, 오버레이 `rgba(0,0,0,0.4)`.

---

## 7. 페이지 레이아웃

### 7-1. 배경 · 셸

페이지 배경은 전 구간 `#f4f4f6`. 최대 너비 제한은 없다 (`max-width: 100%`).
디자인 기준 폭만 1440px이고, 콘텐츠 가용 폭은 `1440 − 240(사이드바) − 40(좌) − 24(우) = 1136px`이다.

너비 토큰이 있는 곳:

| 토큰 | 값 | 의미 |
|---|---|---|
| `DASH_GLOBAL.baseWidth` | 1440px | 시안 기준 폭. CSS `max-width`가 아님 |
| `DASH_SIDEBAR.width` | 240px | 좌측 메뉴 |
| `--pc-container-catalog` | 1200px | 카탈로그 그리드만 |
| `--pc-max-width-copy` | 360px | 짧은 카피 폭만 |
| `--header-h` / `--pc-nav-h` | 52px | 레거시 상단바 높이 |
| 콘텐츠 상단바 `.pc-content-topbar` | height 64px, padding `12px 24px 0 40px` | 사이드바 오른쪽 메뉴 |

```css
html, body {
  margin: 0;
  background: #f4f4f6;
  background-color: #f4f4f6;
  color: var(--text1);
  font-family: var(--font-sans);
  font-size: 15px;
  line-height: 1.5;
}

.app-shell {
  display: flex;
  width: 100%;
  height: 100%;
  overflow: hidden;
  background: #f4f4f6;
  color: var(--color-text);
  font-family: var(--font-sans);
}

.app-main {
  flex: 1;
  min-width: 0;
  min-height: 0;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  background: #f4f4f6;
}

.page-content {
  flex: 1;
  min-height: 0;
  width: 100%;
  max-width: none;
  overflow-y: auto;
  background: #f4f4f6;
  padding-top: 0;
  padding-left: 40px;    /* DASH_GLOBAL.contentPadLeft */
  padding-right: 24px;   /* DASH_GLOBAL.contentPadRight */
  padding-bottom: 120px; /* UnifiedPageLayout contentPadBottom 기본값 */
  font-size: 15px;
  line-height: 1.55;
}

.page-content > .page-inner {
  margin-top: 20px; /* 데스크톱 기본 contentMarginTop. 모바일 16px */
}
```

```html
<div class="app-shell">
  <aside class="sidebar"><!-- 6절 --></aside>
  <main class="app-main">
    <div class="page-content">
      <div class="page-inner">
        <!-- 카드, 표 -->
      </div>
    </div>
  </main>
</div>
```

모바일(≤1024px) 콘텐츠 패딩은 좌우 10px(`LAYOUT.mainContentPaddingMob`), 글자 14px.

### 7-2. 상단 탭 (참고)

데스크톱에서 전폭 `.pc-top-nav`(52px)는 숨기고, `.pc-content-topbar`(64px)만 쓴다.

```css
.pc-nav-tab {
  font-family: 'Pretendard', 'Inter', system-ui, sans-serif;
  font-size: 15px;
  font-weight: 600;
  color: #0b0c0e;
  letter-spacing: 0.35px;
  background: none;
  border: none;
  padding: 0 0 11px 0;
}
.pc-nav-tab:hover,
.pc-nav-tab.active { font-weight: 700; color: #0b0c0e; }
```

밑줄 트랙은 높이 3px, `#ccd0d7`, `border-radius: 1.5px`. 활성 하이라이트도 높이 3px, `#33343a`, 글자보다 좌우 6px 김.
