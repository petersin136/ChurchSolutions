# 대시보드 디자인 v2 작업 규칙

이 파일의 규칙은 `design/dashboard-v2` 작업의 모든 단계에서 지킨다.

## Git
1. `main` 브랜치로 이동하지 않는다.
2. `git push` 하지 않는다.
3. 커밋은 `design/dashboard-v2` 브랜치에만 한다.
4. 단계가 끝나면 `design(dashboard): N단계 - 내용` 형식으로 커밋한다.

## 코드 범위
1. Supabase 호출, 쿼리, 저장/로드 함수, 데이터 계산 로직은 변경하지 않는다. 스타일과 UI만 수정한다.
2. 대시보드 관련 파일만 수정한다.
   - 허용: `src/styles/pastoralDashboardTokens.ts`, `src/components/PastoralPage.tsx`의 대시보드 UI, `src/components/pastoral/MemberDotGrid.tsx`, 대시보드 전용 스타일.
   - 금지: `AttendanceCheck.tsx`, `AbsenteeManagement.tsx`, `MembersManagementPanel` 및 그 외 다른 화면.
3. 공용 토큰/전역 CSS가 다른 화면에 영향을 주면 대시보드 전용 스타일로 처리한다.
4. 모바일 레이아웃이 깨지지 않게 한다.

## 판단·데이터
1. 판단이 애매하면 보수적으로 선택하고, `design/dashboard/PROGRESS.md`에 "확인 필요"로 기록한 뒤 계속 진행한다.
2. 데이터가 없는 새 UI는 기존 데이터로 연결할 수 있으면 연결하고, 안 되면 UI만 만든 뒤 기록한다. DB에 가짜 데이터를 넣지 않는다.

## 단계 종료
1. 단계가 끝날 때마다 `npx tsc --noEmit`과 lint를 통과시킨다.
2. PNG와 다시 대조해 차이를 고친 뒤 커밋하고 `PROGRESS.md`를 갱신한다.
3. 어떤 단계가 실패해도 멈추지 말고, 기록한 뒤 다음 단계로 넘어간다.
