# UI 토큰 / 컴포넌트 마이그레이션 노트 (Phase 0 이후)

## Pretendard (적용됨)

- `public/fonts/PretendardVariable.woff2` — 저장소에 포함 (원본: [Pretendard v1.3.9](https://github.com/orioncactus/pretendard/tree/v1.3.9) `packages/pretendard/dist/web/variable/woff2/`).
- `app/layout.tsx`: `next/font/local` → `variable: "--pc-font-loaded"`, `<html className={pretendard.variable}>`.
- `src/styles/tokens.css`: `--pc-font: var(--pc-font-loaded, "Inter"), "Noto Sans KR", ...` — 폰트 로드 전에는 Inter 폴백.

## `NAVY` 이름 폐기 (Phase 1~3)

같은 이름이 **서로 다른 색**으로 쓰였습니다. 변수명 삭제 후 의미별 토큰으로 치환하세요.

| 위치 | 현재 값 | 의미 | 치환 목표 |
|------|---------|------|-----------|
| `ReportsSettingsPage.tsx` | `#2563eb` | 액센트/헤더 강조 | `var(--pc-primary)` (`#4466e0`로 통일) |
| `school/*.tsx` (`NAVY`) | `#1a1d26` | 본문/제목 강조 | `var(--pc-text-strong)` |
| `churchPlanner/plannerDb.ts` `NAVY` | `#1B2A4A` | 브랜드 네이비 | `var(--pc-text-strong)` 또는 별도 `--pc-planner-navy` 검토 |

## `const C` 점진 이전 대상 (Phase 1~3)

다음 파일의 로컬 팔레트를 `pcTokens` / CSS 변수로 통합합니다. **Phase 0에서는 수정하지 않음.**

- `src/components/PastoralPage.tsx`
- `src/components/VisitCounselPage.tsx`
- `src/components/FinancePage.tsx` (`RECEIPT_CSS` 제외)
- `src/components/BulletinPage.tsx`
- `src/components/churchPlanner/ChurchPlannerPage.tsx` + `plannerDb.ts` 액센트
- `src/components/school/*.tsx` (`NAVY`/`TEXT`/`BORDER` 상수)
- `src/components/ReportsSettingsPage.tsx` (상단 상수 블록)

## Phase 4에서 제거 예정: globals 레거시 별칭

`app/globals.css` `@layer base` 안 `:root`의 다음 이름들은 `--pc-*`만 쓰도록 전역을 고친 뒤 삭제합니다.

`--text1`, `--text2`, `--text3`, `--bg`, `--surface`, `--surface2`, `--blue`, `--blue-light`, `--blue-dark`, `--green`, `--green-light`, `--orange`, `--orange-light`, `--red`, `--red-light`, `--purple`, `--purple-light`, `--teal`, `--teal-light`, `--indigo`, `--indigo-light`, `--pink`, `--pink-light`, `--border`, `--border-light`, `--border2`, `--sep`, `--font`, `--shadow-*`, `--radius-*`, `--pco-*`

(실제 스타일은 `tokens.css`의 `--pc-*`에 유지.)

## `--pco-*` 전역 클래스

**정의 위치:** `app/globals.css` 하단 (`.pco-table`, `.pco-btn-primary`, …).

**TS/TSX 사용처:** 없음 (grep 기준). Phase 1에서 `PcTable`, `PcButton` 등으로 대체 후 클래스 블록 삭제 가능.

## 레거시 `export const tokens` (TS)

`src/styles/tokens.ts`의 hex 기반 `tokens` 객체는 `@deprecated`입니다. 신규 코드는 `pcTokens`와 CSS 변수를 사용하세요.
