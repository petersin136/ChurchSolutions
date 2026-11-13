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

## 이후 단계

큐에 쌓인 프롬프트가 구현을 이어 간다. 단계마다 tsc·lint → PNG 대조 → `design(dashboard): N단계 - …` 커밋.

## 실패 기록

- Computer Use Chrome 캡처: 권한 창 대기. 스킵하고 소스 대조로 진행.
- 08 툴팁 bbox 1차 검출이 차트 전체를 먹음. 이후 점 샘플로 `#0b0c0e` 확인.
