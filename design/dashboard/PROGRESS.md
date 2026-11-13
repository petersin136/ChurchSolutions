# 대시보드 v2 진행

브랜치: `design/dashboard-v2` (push 안 함)
시작: 2026-11-14
작업 트리: 시작 시 `main` clean. WIP 커밋 없음.

## 준비

- [x] git status — clean, `main` = `origin/main`
- [x] 브랜치 `design/dashboard-v2` 생성·이동
- [x] PNG 14장 `design/dashboard/` 복사 (`~/Desktop/a. 대시보드/`)
- [x] `caffeinate -dimsu` 백그라운드 (pid 기록은 세션 로컬)
- [x] localhost:3000 개발 서버는 그대로 둠
- [x] `RULES.md` 저장

## 0단계 — 분석 (앱 코드 미수정)

- [x] 대시보드 파일 구조 파악 → `DESIGN_TOKENS.md` §1
- [x] 01·04 vs 현재 소스 차이 → `DESIGN_TOKENS.md` §6
- [x] PIL 픽셀 HEX 추출 → `DESIGN_TOKENS.md` §2, 스크립트 `extract_tokens.py`
- [x] 폰트·간격·radius 측정 → `DESIGN_TOKENS.md` §3–4
- [x] `npx tsc --noEmit` 통과. `next lint` 기존 경고만 있고 이번 파일 관련 신규 오류 없음

### 확인 필요

1. **라이브 localhost 스크린샷**
   Cursor 브라우저에는 로그인 세션이 없고 `.env.local`에 테스트 계정도 없다. Computer Use(Chrome)는 Accessibility 권한 대기로 스킵. 01·04 대조는 **시안 PNG ↔ 현재 소스/토큰**으로 했다. 이후 단계에서 이미 열린 브라우저와 눈으로 한 번 더 맞출 것.

2. **카드 그림자**
   PNG에서 카드 밖 1px은 `#f4f4f6` 순색. 시안이 그림자를 안 쓰거나 export가 버렸을 수 있다. 보수적으로 기존 `floatShadow` 유지.

3. **콘텐츠 여백 24 vs 40**
   시안 카드 x=264 → 좌 여백 24. 현재 `DASH_GLOBAL.contentPadLeft = 40`은 성도관리 등과 공유. 대시보드만 24로 오버라이드.

4. **히어로 숫자 크기**
   잉크 37px → 추정 48–52. 현재 62. 시안 우선(≈50). 너무 작으면 이 항목을 다시 연다.

5. **심방 예정/완료, 기도 요청/응답**
   시안은 서브·큰 숫자를 쪼갠다. 코드는 visit 건수 / 기도문 있는 성도 수. 계산 로직은 안 바꾸고, 있는 값으로 라벨만 맞추거나 UI만 두고 여기 남긴다. DB 가짜 데이터 금지.

6. **기도 단위 「명」**
   시안 큰 숫자 `요청 50명`. 코드는 `N건`. 기존 카운트를 쓰면 단위가 시안과 다를 수 있다. 보수적으로 기존 건수를 유지할지, 시안 카피만 쓸지 구현 때 시안 카피 우선 + 이 항목 유지.

7. **로그아웃 hover**
   시안은 회색. 현재 전역 CSS는 빨강. 전역을 바꾸지 말고 대시보드에서만 회색으로.

8. **W/M/Y 활성 = 검정**
   현재 활성 배경이 회색(`#d8dce3`). 시안은 `#0b0c0e` + 흰 글자. `dashPeriodBtnStyle`는 대시보드 전용 함수라 여기서 바꿔도 됨. 부서 + 버튼도 이 스타일을 씀 → 부서 버튼이 시안 ↗로 바뀌면 충돌 없음.

9. **드롭다운·M 호버·툴팁 패딩**
   HEX가 한 점으로 안 떨어짐. 툴팁 `#0b0c0e` / 흰 글자. 패딩·radius는 구현 때 기존 값에 가깝게.

## 1단계 — 01·04 기본 레이아웃·색·타이포

대상: 출석률, 전체 성도, 중간 4카드, 사이드바, 상단 탭, 04 카드 활성.

- [x] `pastoralDashboardTokens.ts` — 막대/dot HEX, 4카드 그라데이션, radius 8, 막대 gap 5/r 4, 히어로 50px, 대시보드 전용 pad 24
- [x] `PastoralPage.tsx` DashboardSub — 카피, 빈 숫자 회색, W/M/Y 검정 활성, 주간에 연도 칩 숨김, 대시보드만 pad 24
- [x] MemberDotGrid는 토큰만 따라가 파일 수정 없음
- [x] `npx tsc --noEmit` 통과. lint는 기존 PastoralPage 경고만
- [x] 01·04 대조 후 커밋

### 1단계 PNG 대조

| 항목 | 시안 | 코드 | 일치 |
|---|---|---|---|
| 출석 막대 채움 | `#5b7be6` | `#5b7be6` | 예 |
| 출석 막대 빈칸 | `#ebebef` | `#ebebef` | 예 |
| 성도 dot | `#3a9a8c` / `#e3e4e9` | 동일 | 예 |
| 새가족 활성 그라데이션 | `#e9f2ff` → `#fdfeff` | 동일 | 예 |
| 위험/휴면 활성 그라데이션 | `#ffefe0` → `#fffdfc` | 동일 | 예 |
| 심방·기도 면 | 흰 | 흰 | 예 |
| 01 빈 4카드 | 흰 | `emptyFill #ffffff` | 예 |
| 빈 숫자 | `#a0a5b1` | `DASH_COLOR.emptyValue` | 예 |
| 히어로 숫자 | ≈50 | 50 | 예 |
| 카드 radius | 8 | 8 | 예 |
| 대시보드 좌·상 여백 | 24 | `dashboardPad*` 대시보드만 | 예 |
| 출석 서브 카피 | 활동 성도 n명 중 n명 출석 | 동일 | 예 |
| 성도 서브 | 활동 n · 비활동 n | 동일 | 예 |
| 중간 카드 접두 | 등록/합계/완료/요청 | 동일 | 예 |
| W 활성 | 검정+흰 글자 | `periodActiveBg #0b0c0e` | 예 |
| 주간 연도 칩 | 없음 | `attChartView !== week` 숨김 | 예 |
| 최근 사역 타이틀 | 최근 사역 | 동일 | 예 |

### 확인 필요 (1단계)

10. **This Week 줄** — 시안 사이드바에 `This Week 11. 08 – 11. 14`가 있다. `UnifiedPageLayout` 수정이 필요해 이번엔 안 넣음.
11. **상단 탭 인디케이터 `#0b0c0e`** — `globals.css` 전역. `#33343a`와 거의 같아 전역 CSS는 안 바꿈.
12. **설정/검색 idle HEX** — 설정·로그아웃 idle은 2단계에서 `#ebebef`로 맞춤. 검색 밑줄은 아직 전역 CSS.
13. **심방 예정** — 예정 일정 필드가 없어 `예정 0건`, 완료만 visit 노트 건수.
14. **기도 요청 명 / 응답 건** — 요청 = 기도문 있는 성도 수(명). 응답 = `answeredPrayerDates` 키 수. 계산 함수는 안 바꿈.
15. **부서 + 버튼** — 3단계에서 ↗로 교체. idle `#646977` / hover·click `#0b0c0e`.
16. **히어로 50px** — 시안 추정 48–52. 작아 보이면 이 항목을 다시 연다.

## 2단계 — 02·03 설정·로그아웃 hover·click

- [x] `DASH_ICON_BTN` 토큰: idle `#ebebef` / hover `#dfe0e5`, 아이콘 idle `#646977` / hover `#0b0c0e`
- [x] `pastoralDashboardChrome.css` — `html[data-dash-v2]` 한정. `globals.css`·로그아웃 로직 미변경
- [x] `PastoralPage` 마운트 시 `data-dash-v2` + CSS 변수. 언마운트 시 제거 (재정 등 다른 탭은 기존 전역 스타일)
- [x] click(`:active`) = hover와 동일 HEX. 시안이 hover·click을 한 장으로 줌
- [x] `npx tsc --noEmit` · lint
- [x] 02·03 대조 후 커밋

### 2단계 PNG 대조

| 항목 | 이미지 지정값 | 코드 | 일치 |
|---|---|---|---|
| 설정 idle 면 | `#ebebef` | `DASH_ICON_BTN.idleBg` | 예 |
| 로그아웃 idle 면 | `#ebebef` | 동일 | 예 |
| 설정 hover·click 면 | `#dfe0e5` | `hoverBg` + `:hover,:active` | 예 |
| 로그아웃 hover·click 면 | `#dfe0e5` (빨강 아님) | 동일. `color` 빨강 오버라이드 | 예 |
| 아이콘 idle | `#646977` | `idleInk` | 예 |
| 아이콘 hover | `#0b0c0e` | `hoverInk` | 예 |
| 버튼 크기·radius | 40 / 7 | 전역 CSS 유지 | 예 |
| 로그아웃 onClick | 기존 | `GlobalTopBar` 미수정 | 예 |

### 확인 필요 (2단계)

17. **테두리** — 시안에 별도 보더 HEX 없음. 1px 링이 안 보이게 `border-color`를 fill과 같게 맞춤.
18. **적용 범위** — 목양 탭이 열려 있는 동안만. 대시보드 서브페이지만이 아니라 성도관리 등 목양 안 화면도 같은 상단 버튼을 씀. 재정·학교 등 다른 메인 탭은 기존 전역(로그아웃 hover 빨강) 유지.
19. **검색 idle HEX** — 이번 단계 대상 아님.

## 3단계 — 05·06 부서별 인원 막대·화살표

- [x] 막대 색: 1위 `#d468c8`, 나머지 `#c6c9d1`, 트랙 `#ebebef`
- [x] 높이 36 / 행간격 16 / radius 5. 라벨 왼쪽 `#646977`, 인원 오른쪽 `#0b0c0e`
- [x] 막대 폭 = 해당 부서 수 / 최다 부서 수 (표시만. `deptCounts` 계산·쿼리 변경 없음)
- [x] 헤더 ↗ idle `#646977` / hover·click `#0b0c0e`. onClick은 기존 `openDeptAdd`
- [x] 기존 `settings.depts` + `member.dept` 연결. 새 쿼리 없음
- [x] `npx tsc --noEmit` · lint
- [x] 05·06 대조 후 커밋

### 3단계 PNG 대조

| 항목 | 이미지 지정값 | 코드 | 일치 |
|---|---|---|---|
| 1위 막대 | `#d468c8` | `deptBarTop` | 예 |
| 나머지 채움 | `#c6c9d1` | `deptBarFill` | 예 |
| 트랙 | `#ebebef` | `deptBarTrack` | 예 |
| 막대 높이 | 36 | `barHeight: 36` | 예 |
| 행 간격 | 16 | `rowGap: 16` | 예 |
| radius | ≈5 | 5 | 예 |
| 라벨 위치 | 막대 왼쪽 | `labelMinWidth` 열 | 예 |
| 라벨 색 | `#646977` | `labelColor` | 예 |
| 인원 색 | `#0b0c0e` | `countColor` | 예 |
| 화살표 idle | `#646977` ~16px | `arrowIdle` / `arrowSize 16` | 예 |
| 화살표 hover·click | `#0b0c0e` | `arrowHover` | 예 |

### 확인 필요 (3단계)

20. **화살표 클릭 목적지** — 시안은 hover만 보여 줌. 기존 `openDeptAdd` 모달을 유지. 조직/자원관리로 이동하는지는 미정.
21. **행 hover 수정·삭제** — 05·06에 없음. 기존 연필/휴지통은 그대로 둠.
22. **막대 폭 기준** — 시안 장년부 50명이 트랙 풀폭. 전체 성도(101)가 아니라 최다 부서 대비로 그림. 집계 함수는 안 바꿈.
23. **새 쿼리** — 필요 없음. 부서 목록·인원 수는 이미 메모리의 `depts`/`members`로 그림.

## 4단계 — 07·08 출석 통계 주간(W) 그래프·툴팁

- [x] `DASH_WEEK_CHART` 전용 토큰. `statBarHighlight`는 AttendanceDashboard와 공유라 안 바꿈
- [x] 풀높이 트랙 + 아래부터 채움. 강조 `#5b7be6`, 일반 `#c6c9d1`, 트랙 `#ebebef`
- [x] 회색 막대 % `#646977`(채움 위), 이번 주 % 흰색(블루 안). 축 일반 `#93969f` / 이번 주 `#0b0c0e`
- [x] hover 툴팁 `#0b0c0e` / 흰 글자, 카피 `{present}/{total}명`. `weekly5` 계산 미변경
- [x] `npx tsc --noEmit` · lint
- [x] 07·08 대조 후 커밋

### 4단계 PNG 대조

| 항목 | 이미지 지정값 | 코드 | 일치 |
|---|---|---|---|
| 강조 막대 | `#5b7be6` | `DASH_WEEK_CHART.highlight` | 예 |
| 일반 채움 | `#c6c9d1` | `fill` | 예 |
| 트랙 | DESIGN_TOKENS `#ebebef` | `track` | 예 (아래 24) |
| 막대 폭·간격 | 99 / 6 | flex 5칸, gap 6 | 예 |
| 회색 % | `#646977` 채움 위 | `pctGray` | 예 |
| 강조 % | 흰색, 블루 안 | `pctHot` | 예 |
| 축 일반 | `#93969f` | `axis` | 예 |
| 축 이번 주 | `#0b0c0e` | `axisHot` | 예 |
| 툴팁 면 | `#0b0c0e` | `tooltipBg` | 예 |
| 툴팁 카피 | `240/300명` 형식 | `{present}/{total}명` | 예 |
| 계산 | 기존 weekly5 | 미변경 | 예 |

### 확인 필요 (4단계)

24. **트랙 HEX** — 07 PNG 막대 위 구간 샘플은 `#f4f4f6`(페이지색). DESIGN_TOKENS는 `#ebebef`. 토큰을 따름.
25. **% 크기 32** — 시안 추정 28–36. 기존 44는 줄임.
26. **모바일 툴팁** — hover가 없어 안 뜸. 카드 클릭(출석 통계 이동)과 겹치지 않게 탭 토글은 안 넣음.
27. **월·연 차트** — 월간은 5단계에서 블루 트랙 차트로 맞춤. 연간(Y)은 아직 주황.

## 5단계 — 09~11 M hover·월간 그래프·툴팁

- [x] W/M/Y 비활성 hover `#c6c9d1` (09 실측). 활성은 검정 유지
- [x] 월간: 트랙+하단 채움, 강조 `#5b7be6`, 일반 `#c6c9d1`, 축 `1월`…`12월`
- [x] %는 기존 `monthlyAvg.avg / 활동성도` 표시만. `monthlyAvg` 집계 미변경
- [x] hover 툴팁 `활동 평균 {avg}/{활동성도}명`
- [x] `npx tsc --noEmit` · lint
- [x] 09~11 대조 후 커밋

### 5단계 PNG 대조

| 항목 | 이미지 지정값 | 코드 | 일치 |
|---|---|---|---|
| M hover 면 | `#c6c9d1` | `periodHoverBg` | 예 |
| 강조 막대 | `#5b7be6` | `DASH_MONTH_CHART.highlight` | 예 |
| 일반 채움 | `#c6c9d1` | `fill` | 예 |
| 트랙 | `#ebebef` | `track` | 예 |
| 막대 간격 | 7 | `gap: 7` | 예 |
| 축 | `1월`…`12월` | `MON` 한글 | 예 |
| 축 이번 달 | `#0b0c0e` | `axisHot` | 예 |
| 축 빈 달 | `#a0a5b1` | `axisEmpty` | 예 |
| 회색 % | `#646977` | `pctGray` | 예 |
| 강조 % | 흰색 | `pctHot` | 예 |
| 툴팁 | `활동 평균 72/87명` 형식 | `활동 평균 {avg}/{denom}명` | 예 |
| 연도 칩 | 월간에만 | 기존 `attChartView !== week` | 예 |

### 확인 필요 (5단계)

28. **월 % 분모** — 시안 툴팁 87, 막대는 %. 집계 함수는 안 바꾸고 `avg / 활동성도`로만 그림. 시안 72/87과 실데이터 수는 다를 수 있음.
29. **빈 달 트랙** — 10 PNG 12월 구간은 흰 면. 주간과 같이 `#ebebef` 트랙은 유지.
30. **연간(Y)** — 다음 단계.

## 이후 단계

큐에 쌓인 프롬프트가 구현을 이어 간다. 단계마다 tsc·lint → PNG 대조 → `design(dashboard): N단계 - …` 커밋.

## 실패 기록

- Computer Use Chrome 캡처: 권한 창 대기. 스킵하고 소스 대조로 진행.
- 08 툴팁 bbox 1차 검출이 차트 전체를 먹음. 이후 점 샘플로 `#0b0c0e` 확인.
