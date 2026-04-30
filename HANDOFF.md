# 목양노트 UI 리디자인 — 마스터 플랜 v3

## 0. 프로젝트 정체성

**목표**: 한국 교회용 SaaS "목양노트"를 Planning Center Online 수준의 통일성·완성도로 재설계. 구독료를 받고 배포해도 손색없는 상품화 수준 달성.

**디자인 철학**:
- Planning Center의 구조·레이아웃·CSS 패턴을 적극 차용 (한국형 변형은 톤·언어·문화적 디테일에서)
- "프로페셔널" = 모든 화면에서 같은 컴포넌트가 같은 모양으로 동작
- "AI 바이브 코딩 티"가 안 나도록: 모달/캘린더/버튼/폼이 7개 탭에서 100% 동일

**차별화 포인트 (한국 교회 특화)**:
- **A3 PDF 부서별 출석 보고서** — 교회 게시판에 붙일 수 있는 인쇄물 수준의 출력물. 한국 목회 현장에서 실제로 쓰이는 핵심 기능.
- 한국어 우선 타이포그래피, 교회력 반영, 헌금/심방 등 한국 교회 특화 도메인.

**타임라인**: 2~3주 풀스프린트, 단계별 게이트로 진행.

---

## 1. 디자인 토큰 (단일 소스)

### 색상 (Planning Center 톤 유지 + 한국 정서 약간 따뜻하게)

```
/* 텍스트 */
--pc-text-strong: #1a1d26    /* 제목, 숫자, 강조 */
--pc-text:        #2d3142    /* 본문 기본 */
--pc-text-sub:    #4a5068    /* 라벨, 보조 본문 */
--pc-text-faint:  #8b90a0    /* 메타, 날짜, 테이블 헤더 */
--pc-text-disabled: #c4c8d4

/* 배경/표면 */
--pc-bg:          #f5f6fb    /* 전체 배경 (Planning Center보다 약간 따뜻) */
--pc-bg-alt:      #eef0f8    /* 섹션 구분 배경 */
--pc-surface:     #ffffff    /* 카드, 모달 */
--pc-surface-hover: #f8f9ff
--pc-overlay:     rgba(20, 24, 40, 0.45)  /* 모달 오버레이 */

/* 보더 */
--pc-border:      #e8e9f0    /* 일반 보더 */
--pc-border-strong: #d4d7e3  /* 강조 보더 */
--pc-divider:     #eef0f6    /* 구분선 */

/* 액센트 (단일 primary로 통일 — #2563eb 폐기, #4466e0로 일원화) */
--pc-primary:     #4466e0
--pc-primary-hover: #3855c4
--pc-primary-soft: #e8edff   /* 활성 배경, 선택 */

/* 보조 액센트 (Planning Center의 제품별 컬러 차용) */
--pc-purple:      #7c5ce0    /* 일정, 그룹 */
--pc-teal:        #14b8a6    /* 출석 */
--pc-orange:      #f59e0b    /* 알림, 경고 */
--pc-pink:        #ec4899    /* 새가족 */
--pc-indigo:      #6366f1    /* 보고서 */

/* 상태 */
--pc-success:     #16a34a
--pc-success-soft: #dcfce7
--pc-warning:     #d97706
--pc-warning-soft: #fef3c7
--pc-danger:      #dc2626
--pc-danger-soft: #fde8e8
--pc-info:        #2563eb
--pc-info-soft:   #dbeafe

/* 차트 (파스텔 채도, A3 인쇄에도 적합) */
--pc-chart-1: #6b8aff    /* 메인 (파랑) */
--pc-chart-2: #9b7cf2    /* 보라 */
--pc-chart-3: #4ade80    /* 초록 */
--pc-chart-4: #fbbf24    /* 노랑 */
--pc-chart-5: #fb7185    /* 분홍 */
--pc-chart-6: #38bdf8    /* 하늘 */
--pc-chart-7: #a78bfa    /* 라벤더 */
--pc-chart-8: #34d399    /* 민트 */
```

### 타이포그래피

```
/* 폰트 패밀리 */
--pc-font: "Pretendard", "Inter", -apple-system, BlinkMacSystemFont, sans-serif;
--pc-font-mono: "JetBrains Mono", "D2Coding", monospace;

/* 사이즈 (8단계) */
--pc-text-xs:   11px   /* 메타, 테이블 헤더 (uppercase) */
--pc-text-sm:   12px   /* 보조 텍스트 */
--pc-text-base: 14px   /* 본문 기본 */
--pc-text-md:   15px   /* 본문 강조 */
--pc-text-lg:   16px   /* 카드 제목 */
--pc-text-xl:   20px   /* 페이지 부제 */
--pc-text-2xl:  24px   /* 페이지 제목 */
--pc-text-3xl:  28px   /* 통계 카드 숫자 */
--pc-text-4xl:  36px   /* 대시보드 핵심 숫자 */

/* 웨이트 */
--pc-weight-regular: 400
--pc-weight-medium:  500
--pc-weight-semibold: 600
--pc-weight-bold:    700
--pc-weight-extrabold: 800

/* 라인하이트 */
--pc-leading-tight:  1.2   /* 제목, 숫자 */
--pc-leading-normal: 1.5   /* 본문 */
--pc-leading-relaxed: 1.7  /* 긴 텍스트 */
```

### 간격 (4px 그리드)

```
--pc-space-1:  4px
--pc-space-2:  8px
--pc-space-3:  12px
--pc-space-4:  16px
--pc-space-5:  20px
--pc-space-6:  24px
--pc-space-8:  32px
--pc-space-10: 40px
--pc-space-12: 48px
--pc-space-16: 64px
```

### 둥근 모서리

```
--pc-radius-sm: 6px    /* 작은 칩, 인풋 */
--pc-radius:    8px    /* 버튼 기본 */
--pc-radius-md: 12px   /* 카드, 테이블 */
--pc-radius-lg: 16px   /* 모달 */
--pc-radius-xl: 20px   /* 배지 (pill) */
--pc-radius-avatar: 10px  /* 아바타 (둥근 사각형, 사용자 요청) */
--pc-radius-full: 9999px
```

### 그림자

```
--pc-shadow-sm: 0 1px 2px rgba(20, 24, 40, 0.04)
--pc-shadow:    0 2px 8px rgba(20, 24, 40, 0.06), 0 1px 2px rgba(20, 24, 40, 0.04)
--pc-shadow-md: 0 8px 24px rgba(20, 24, 40, 0.08)
--pc-shadow-lg: 0 20px 60px rgba(20, 24, 40, 0.15)  /* 모달 */
--pc-shadow-focus: 0 0 0 3px rgba(68, 102, 224, 0.25)
```

### 트랜지션

```
--pc-transition-fast: 0.12s ease
--pc-transition:      0.18s ease
--pc-transition-slow: 0.3s ease
```

### 단일 소스 정책

**파일**: `src/styles/tokens.css` (CSS 변수) + `src/styles/tokens.ts` (TypeScript 상수, CSS 변수 참조).
**규칙**: 새 코드는 무조건 토큰 사용. 컴포넌트 파일의 `const C` 블록은 점진적으로 토큰 import로 교체. globals.css의 중복 변수는 토큰으로 통합.

---

## 2. 컴포넌트 카탈로그 (`src/components/ui/`)

### 절대 원칙
- **모든 탭이 같은 컴포넌트를 import해서 씀.**
- **로컬 변형 금지.** 디자인 변형이 필요하면 컴포넌트에 prop을 추가.
- **인라인 style 금지.** 위치/크기 같은 레이아웃은 허용, 색/폰트/패딩은 컴포넌트가 처리.

### 1) 레이아웃

`PcAppShell` — 상단 탭 + 우측 바 + 좌측 사이드바 + 본문
`PcSidebar` — 접이식, 섹션+아이템, 배지 슬롯
`PcPageHeader` — 제목, 부제, 우측 액션 영역
`PcSection` — 카드 그룹의 묶음 단위

### 2) 데이터 표시

`PcCard` — 제목/액션/본문 슬롯, padding/elevation prop
`PcStatCard` — 왼쪽 컬러바 + 라벨(uppercase) + 큰 숫자 + 보조텍스트 + 옵션 미니 트렌드. **5개 색상 변형** (primary/purple/success/danger/warning).
`PcTable` — 헤더 11px uppercase 회색, 행 hover, 정렬 아이콘, 빈 상태, 페이지네이션 통합.
`PcList` — 아바타+제목+메타+우측 액션의 리스트 행 (Planning Center People 스타일).
`PcBadge` — pill 형태, 7가지 컬러 변형 (blue/green/yellow/red/purple/teal/gray).
`PcTag` — 필터칩, X 버튼 옵션.
`PcAvatar` — **둥근 사각형 (radius 10px)**, 사이즈 sm(28)/md(36)/lg(48)/xl(72), 이미지 없으면 이니셜+자동생성 컬러(이름 해시 기반 8색 중 하나).
`PcProgressBar` — 라벨/값/색상 prop.
`PcEmptyState` — 일러스트 + 제목 + 설명 + 액션 버튼.

### 3) 입력

`PcButton` — variant: primary/secondary/danger/ghost/link, size: sm/md/lg, 아이콘 슬롯.
`PcInput` — 라벨/에러/도움말/접두/접미 슬롯.
`PcSelect` — Planning Center 스타일 드롭다운 (네이티브 select 아님, 커스텀).
`PcTextarea`
`PcDatePicker` — **단 하나의 캘린더 컴포넌트.** 모든 탭에서 이것만 사용.
`PcDateRangePicker`
`PcSearchInput` — 돋보기 아이콘 + 클리어 버튼.
`PcCheckbox`, `PcRadio`, `PcSwitch`
`PcSegmented` — 주별/월별/연별 같은 토글.

### 4) 오버레이 (통일성 핵심)

`PcModal` — **단 하나의 모달.** size: sm(400px)/md(560px)/lg(800px)/xl(1100px)/full. 헤더(제목+닫기)/본문/푸터(좌측 보조액션 + 우측 primary/cancel) 슬롯. **fade-in 애니메이션, 포커스 트랩, ESC 닫기, 배경 클릭 닫기, 스크롤 잠금** 모두 자동.
`PcDrawer` — 우측 슬라이드 패널 (모바일 친화).
`PcConfirmDialog` — 삭제/확인 등 단순 다이얼로그.
`PcToast` — 우측 하단 알림.
`PcTooltip`
`PcPopover` — 드롭다운 메뉴, 추가 옵션 패널.

### 5) 네비게이션

`PcTabs` — 상단 탭 (활성 밑줄).
`PcSubTabs` — 섹션 내 작은 탭.
`PcBreadcrumb`
`PcPagination`

### 6) 차트 (recharts 래퍼)

`PcLineChart`, `PcBarChart`, `PcPieChart`, `PcDonutChart`, `PcAreaChart`
- 자동으로 토큰 색상 사용 (`--pc-chart-1` ~ `--pc-chart-8`)
- 폰트, 격자, 툴팁 디자인 통일
- A3 인쇄 모드 prop (인쇄 시 색감/폰트 자동 조정)

### 7) 한국 교회 특화

`PcMemberCard` — 교인 1명 카드 (아바타+이름+직분+상태배지)
`PcAttendanceGrid` — 주차×교인 출석 체크 그리드
`PcDepartmentBadge` — 부서 라벨 (자동 컬러)
`PcReportSheet` — A3 출력용 보고서 컨테이너 (인쇄 CSS 자동 적용)

---

## 3. A3 PDF 출석 보고서 (핵심 차별화)

이게 한국 교회들이 실제로 쓰는 기능이고, 경쟁자가 잘 못 만드는 부분입니다. 별도로 공들여야 합니다.

### 요구사항
- A3 가로(420×297mm) 또는 세로 출력
- 부서별(영아부/유년부/청소년부/청년부/장년부 등) 월별 출석 추이를 한 장에 시각화
- 교회 게시판에 붙여서 지나가는 성도들이 한눈에 알아볼 수 있는 레벨의 가독성
- 교회 로고/이름/기간 헤더, 푸터에 출력일·담당자
- 색상은 채도 낮은 파스텔 (인쇄 시 잉크 절약, 컬러 프린터에서도 흑백에서도 잘 보임)
- 큰 폰트 (5미터 거리에서도 핵심 숫자 보이도록)

### 컴포넌트 구조
`PcReportA3Attendance`
- 상단: 교회 로고 + "2026년 4월 부서별 출석 현황" 큰 제목
- 중앙: 부서별 막대그래프 또는 라인차트 (8개 부서 1장에)
- 하단: 부서별 요약 표 (지난달 대비, 작년 동월 대비)
- 우측 또는 하단: 핵심 인사이트 박스 ("이번 달 새가족 12명, 청년부 출석률 상승")
- 인쇄 CSS: `@page { size: A3 landscape; margin: 15mm; }`, 폰트 사이즈 인쇄용으로 별도 정의

### 우선순위
Phase 3에서 목양 탭 작업할 때 같이 작업. 별도 Phase로 빼지 않음 (도메인 결합도 높음).

---

## 4. 통일성 체크리스트 (매 탭 작업 후 검증)

### 모달
- [ ] 7개 탭의 모든 모달이 `PcModal`만 사용하는가
- [ ] 모달 헤더/푸터 레이아웃이 동일한가
- [ ] 닫기 버튼 위치/모양 동일한가
- [ ] 오버레이 색상/투명도 동일한가
- [ ] 등장/소멸 애니메이션 동일한가

### 캘린더
- [ ] 7개 탭의 모든 날짜 입력이 `PcDatePicker`만 사용하는가
- [ ] 월 이동 버튼 모양/위치 동일한가
- [ ] 오늘 표시 스타일 동일한가
- [ ] 선택된 날짜 스타일 동일한가
- [ ] 일요일 빨강/토요일 파랑 처리 동일한가

### 버튼
- [ ] primary 버튼 색이 정확히 `--pc-primary` 한 가지인가 (#2563eb 등 다른 파랑 없음)
- [ ] 버튼 높이/패딩이 size별로 일관된가
- [ ] hover/active/disabled 상태 동일한가

### 폼
- [ ] 인풋 높이 동일한가
- [ ] 라벨 위치/스타일 동일한가
- [ ] 에러 메시지 표시 방식 동일한가
- [ ] 포커스 링 색상 동일한가

### 카드
- [ ] 카드 padding/radius/border/shadow 동일한가
- [ ] 카드 제목 폰트 사이즈/웨이트 동일한가

### 차트
- [ ] 모든 차트가 토큰 색상만 사용하는가
- [ ] 차트 폰트/격자/툴팁 디자인 동일한가
- [ ] 채도가 과하게 높은 차트가 없는가

---

## 5. 실행 단계

### Phase 0: 디자인 토큰 정립 (Day 1~2)
- `src/styles/tokens.css` 생성, 위 변수 모두 정의
- `src/styles/tokens.ts` TypeScript 상수
- globals.css 정리 (중복 변수 제거, 토큰 import)
- 폰트 로드 (Pretendard)
- **검증**: DevTools에서 모든 `--pc-*` 변수 확인

### Phase 1: 컴포넌트 카탈로그 구축 (Day 3~7)
- `src/components/ui/` 폴더 생성
- 위 컴포넌트 카탈로그 순서대로 구현 (레이아웃 → 데이터 표시 → 입력 → 오버레이 → 네비게이션 → 차트 → 특화)
- 각 컴포넌트마다 Storybook 대신 **`/dev/components` 페이지** 만들어서 모든 변형 한눈에 보기
- **검증**: `/dev/components`에서 모든 컴포넌트가 렌더링되고 일관된 톤

### Phase 2: 셸 통일 + 보고서·설정 재구축 (Day 8~9)
- UnifiedPageLayout을 PcAppShell로 리팩토링
- ReportsSettingsPage를 PcAppShell 안으로 편입
- 보고서·설정 탭을 Planning Center People 프로필 스타일로 재구축 (좌측 메뉴 + 중앙 카드 그룹)
- **검증**: 7개 탭 셸이 동일

### Phase 3: 탭별 재구축 (Day 10~18)

순서: 심방·상담 → 교회학교 → 플래너 → 주보 → 목양(+A3 보고서) → 재정

각 탭당:
1. Planning Center 참고 화면 결정
2. 와이어프레임 (텍스트로 충분: "상단 PcPageHeader, 좌측 PcSidebar 4항목, 본문은 PcStatCard 5개 + PcCard 안에 PcLineChart")
3. PcAppShell + ui 컴포넌트로 조립
4. 인라인 스타일 90%+ 제거
5. 통일성 체크리스트 통과
6. **검증**: 다른 탭과 나란히 놓고 비교했을 때 같은 앱으로 보이는가

### Phase 4: 디테일 마감 (Day 19~21)
- 빈 상태 일러스트 (간단한 SVG, 톤 통일)
- 애니메이션 미세 조정
- 접근성 (키보드 네비, aria-label, 색대비)
- 모바일 반응형 전 탭 점검
- 인쇄 CSS (A3 보고서, 영수증)
- 최종 통일성 감사 (모든 모달 1개씩 열어보기, 모든 캘린더 1개씩 열어보기)

---

## 6. 절대 규칙 (모든 단계 공통)

1. **`FinancePage.tsx`의 `RECEIPT_CSS`는 절대 수정 금지.**
2. **인라인 스타일 신규 작성 금지.** 색/폰트/패딩은 컴포넌트가 처리. 위치/크기만 인라인 허용.
3. **컴포넌트 로컬 변형 금지.** 모든 탭에서 같은 ui 컴포넌트 사용.
4. **하드코딩 색상 금지.** 무조건 토큰 변수 사용.
5. **모달은 PcModal, 캘린더는 PcDatePicker만.** 다른 모달/캘린더 신규 생성 금지.
6. **각 Phase 끝나기 전 git commit.** 되돌리기 가능하도록.
7. **Cursor에 한 번에 한 Phase만 시킨다.** 여러 Phase 동시 진행 금지.

---

## 7. 과거 실수 기록

1. StatCard ≠ summaryCards (대시보드 카드는 별도 코드).
2. querySelector('borderLeft') 실패 — DOM은 kebab-case (`border-left`).
3. 줄 번호는 시간 지나면 밀림 — 코드 패턴(함수명/변수명)으로 식별.
4. 인라인 스타일 100개를 한 번에 클래스로 못 바꾼다 — 컴포넌트로 묶어야 한다.
5. 탭별 `const C`가 따로 정의되어 있어서 색이 미묘하게 다 다르다 — 단일 토큰 필수.

---

## 8. 산출물 정의 (완료 기준)

이 프로젝트가 "끝났다"고 말할 수 있는 조건:

- [ ] 7개 탭이 PcAppShell을 공유하고 동일한 셸 디자인
- [ ] 모든 모달이 PcModal로 통일, 시각적으로 100% 동일
- [ ] 모든 날짜 선택이 PcDatePicker로 통일
- [ ] 색상 사용이 토큰 한 소스로 통일 (#4466e0 vs #2563eb 같은 이중 사용 0건)
- [ ] 인라인 스타일 비율 평균 30% 이하
- [ ] A3 PDF 출석 보고서 출력 가능, 교회 게시판에 바로 붙일 수 있는 수준
- [ ] 보고서·설정 탭이 다른 탭과 동일한 완성도
- [ ] 처음 보는 사람이 "이거 SaaS 상품이네"라고 느끼는 수준
