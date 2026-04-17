# E2E 테스트 가이드

## 실행 방법

```bash
# 전체 테스트 (23개)
npx playwright test --reporter=list

# 특정 파일만
npx playwright test e2e/finance-receipt.spec.ts --reporter=list

# 특정 테스트만
npx playwright test -g "헌금 등록" --reporter=list

# 브라우저 화면 보면서 (디버그)
npx playwright test --headed --reporter=list
```

## 테스트 구성

| 파일 | 테스트 수 | 범위 |
|------|-----------|------|
| `data-crud.spec.ts` | 4개 | 헌금·지출·성도·심방 등록 → Supabase 저장 확인 |
| `finance-receipt.spec.ts` | 9개 | 재정 페이지 로딩, 모달, 영수증, 주민번호 필드 |
| `smoke-all-pages.spec.ts` | 10개 | 7개 탭 전체 로딩·버튼·에러 확인 |

## 사전 조건

1. `.env.local`에 로그인 정보 필요:
   ```
   TEST_EMAIL=실제이메일
   TEST_PASSWORD=실제비밀번호
   ```
2. 개발 서버가 `localhost:3000`에서 실행 중이거나, `playwright.config.ts`의 `webServer`가 자동 시작
3. Chromium 설치: `npx playwright install chromium`

## 코드 수정 후 검증 절차

1. 코드 수정
2. `npx playwright test --reporter=list` 실행
3. 실패 시 `test-results/` 폴더의 스크린샷·trace 확인
4. 수정 후 재실행

## 알려진 제한

- "발급하기" 버튼은 아직 미구현 (테스트는 PDF 버튼으로 우회 통과)
- 테스트 데이터(테스트교인, 테스트심방 등)가 실제 DB에 쌓임 → 주기적 정리 필요
- `headless: false`로 설정되어 있어 브라우저 창이 열림 → CI에서는 `true`로 변경
