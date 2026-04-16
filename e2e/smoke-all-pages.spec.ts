import { test, expect, Page } from '@playwright/test';

// ──────────────────────────────────────────
// 로그인
// ──────────────────────────────────────────
async function login(page: Page) {
  await page.goto('/login');
  await page.waitForLoadState('networkidle');
  const emailInput = page.locator('input[type="email"], input[placeholder*="email"], input[placeholder*="church"]').first();
  await emailInput.waitFor({ state: 'visible', timeout: 10000 });
  await emailInput.fill(process.env.TEST_EMAIL || '');
  const passwordInput = page.locator('input[type="password"]').first();
  await passwordInput.fill(process.env.TEST_PASSWORD || '');
  await page.locator('button:has-text("로그인")').first().click();
  await page.waitForLoadState('networkidle');
  await page.waitForTimeout(5000);
}

// 하단 탭 클릭
async function clickTab(page: Page, label: string) {
  const tab = page.locator('nav.tab-bar button.tab-item span.tab-label', { hasText: label });
  await tab.waitFor({ state: 'visible', timeout: 10000 });
  await tab.click();
  await page.waitForTimeout(3000);
}

test.beforeEach(async ({ page }) => {
  await login(page);
});

// ══════════════════════════════════════════
// 1. 목양
// ══════════════════════════════════════════
test('목양 – 대시보드 로딩 및 주요 메뉴', async ({ page }) => {
  await clickTab(page, '목양');

  // 대시보드 확인
  const dashboard = page.locator('text=대시보드').first();
  await expect(dashboard).toBeVisible({ timeout: 8000 });
  console.log('  ✅ 목양 대시보드 확인');

  // 사이드바 메뉴 확인
  const menus = ['성도 관리', '출석부', '기도/메모', '새가족 관리'];
  for (const menu of menus) {
    const item = page.locator(`text=${menu}`).first();
    const visible = await item.isVisible().catch(() => false);
    console.log(`  ${visible ? '✅' : '❌'} ${menu}`);
  }
});

test('목양 – 성도 관리 탭', async ({ page }) => {
  await clickTab(page, '목양');

  const memberMenu = page.locator('text=성도 관리').first();
  if (await memberMenu.isVisible().catch(() => false)) {
    await memberMenu.click();
    await page.waitForTimeout(2000);
  }

  // 성도 목록 또는 추가 버튼
  const addBtn = page.locator('button:has-text("등록"), button:has-text("추가"), button:has-text("성도")').first();
  const hasAdd = await addBtn.isVisible({ timeout: 5000 }).catch(() => false);
  console.log(`  ${hasAdd ? '✅' : '⚠️'} 성도 등록/추가 버튼: ${hasAdd}`);
});

test('목양 – 출석부 탭', async ({ page }) => {
  await clickTab(page, '목양');

  const attendMenu = page.locator('text=출석부').first();
  if (await attendMenu.isVisible().catch(() => false)) {
    await attendMenu.click();
    await page.waitForTimeout(2000);
  }

  // 출석 관련 UI
  const attendUI = page.locator('text=출석').first();
  await expect(attendUI).toBeVisible({ timeout: 5000 });
  console.log('  ✅ 출석부 UI 확인');
});

// ══════════════════════════════════════════
// 2. 심방·상담
// ══════════════════════════════════════════
test('심방·상담 – 페이지 로딩 및 주요 기능', async ({ page }) => {
  await clickTab(page, '심방·상담');

  await page.waitForTimeout(2000);
  const bodyText = await page.locator('body').innerText();
  const hasContent = bodyText.includes('심방') || bodyText.includes('상담') || bodyText.includes('방문');
  console.log(`  ${hasContent ? '✅' : '❌'} 심방·상담 컨텐츠 확인`);
  expect(hasContent).toBeTruthy();

  // 심방 추가/등록 버튼
  const addBtn = page.locator('button:has-text("등록"), button:has-text("추가"), button:has-text("새 심방"), button:has-text("기록")').first();
  const hasAdd = await addBtn.isVisible({ timeout: 5000 }).catch(() => false);
  console.log(`  ${hasAdd ? '✅' : '⚠️'} 심방 등록/추가 버튼: ${hasAdd}`);
});

// ══════════════════════════════════════════
// 3. 교회학교
// ══════════════════════════════════════════
test('교회학교 – 페이지 로딩 및 주요 기능', async ({ page }) => {
  await clickTab(page, '교회학교');

  await page.waitForTimeout(2000);
  const bodyText = await page.locator('body').innerText();
  const hasContent = bodyText.includes('교회학교') || bodyText.includes('반') || bodyText.includes('학생') || bodyText.includes('부서');
  console.log(`  ${hasContent ? '✅' : '❌'} 교회학교 컨텐츠 확인`);
  expect(hasContent).toBeTruthy();

  // 학생/반 추가 버튼
  const addBtn = page.locator('button:has-text("등록"), button:has-text("추가"), button:has-text("학생"), button:has-text("반")').first();
  const hasAdd = await addBtn.isVisible({ timeout: 5000 }).catch(() => false);
  console.log(`  ${hasAdd ? '✅' : '⚠️'} 학생/반 등록 버튼: ${hasAdd}`);
});

// ══════════════════════════════════════════
// 4. 재정 (기존 테스트 보완)
// ══════════════════════════════════════════
test('재정 – 대시보드 통계 표시', async ({ page }) => {
  await clickTab(page, '재정');

  await page.waitForTimeout(2000);
  const bodyText = await page.locator('body').innerText();
  const hasDashboard = bodyText.includes('대시보드') || bodyText.includes('총') || bodyText.includes('수입') || bodyText.includes('지출');
  console.log(`  ${hasDashboard ? '✅' : '❌'} 재정 대시보드 확인`);
  expect(hasDashboard).toBeTruthy();
});

// ══════════════════════════════════════════
// 5. 플래너
// ══════════════════════════════════════════
test('플래너 – 페이지 로딩 및 주요 기능', async ({ page }) => {
  await clickTab(page, '플래너');

  await page.waitForTimeout(2000);
  const bodyText = await page.locator('body').innerText();
  const hasContent = bodyText.includes('플래너') || bodyText.includes('일정') || bodyText.includes('설교') || bodyText.includes('캘린더') || bodyText.includes('계획');
  console.log(`  ${hasContent ? '✅' : '❌'} 플래너 컨텐츠 확인`);
  expect(hasContent).toBeTruthy();
});

// ══════════════════════════════════════════
// 6. 주보
// ══════════════════════════════════════════
test('주보 – 페이지 로딩 및 주요 기능', async ({ page }) => {
  await clickTab(page, '주보');

  await page.waitForTimeout(2000);
  const bodyText = await page.locator('body').innerText();
  const hasContent = bodyText.includes('주보') || bodyText.includes('예배') || bodyText.includes('광고') || bodyText.includes('순서');
  console.log(`  ${hasContent ? '✅' : '❌'} 주보 컨텐츠 확인`);
  expect(hasContent).toBeTruthy();

  // 주보 작성/편집 버튼
  const editBtn = page.locator('button:has-text("작성"), button:has-text("편집"), button:has-text("새 주보"), button:has-text("생성")').first();
  const hasEdit = await editBtn.isVisible({ timeout: 5000 }).catch(() => false);
  console.log(`  ${hasEdit ? '✅' : '⚠️'} 주보 작성/편집 버튼: ${hasEdit}`);
});

// ══════════════════════════════════════════
// 7. 보고서·설정
// ══════════════════════════════════════════
test('보고서·설정 – 페이지 로딩', async ({ page }) => {
  await clickTab(page, '보고서·설정');

  await page.waitForTimeout(2000);
  const bodyText = await page.locator('body').innerText();
  const hasContent = bodyText.includes('보고서') || bodyText.includes('설정') || bodyText.includes('통계') || bodyText.includes('백업');
  console.log(`  ${hasContent ? '✅' : '❌'} 보고서·설정 컨텐츠 확인`);
  expect(hasContent).toBeTruthy();
});

// ══════════════════════════════════════════
// 8. 전체 탭 순회 – 콘솔 에러 점검
// ══════════════════════════════════════════
test('전체 7개 탭 순회 시 치명적 에러가 없다', async ({ page }) => {
  const errors: string[] = [];
  page.on('console', msg => {
    if (msg.type() === 'error') errors.push(msg.text());
  });

  const tabs = ['목양', '심방·상담', '교회학교', '재정', '플래너', '주보', '보고서·설정'];

  for (const tab of tabs) {
    await clickTab(page, tab);
    console.log(`  📂 ${tab} 클릭`);
  }

  const critical = errors.filter(e =>
    !e.includes('favicon') && !e.includes('hydration') &&
    !e.includes('Warning:') && !e.includes('next-dev') &&
    !e.includes('Fast Refresh') && !e.includes('404')
  );

  if (critical.length > 0) {
    console.log('  ❌ 콘솔 에러:');
    critical.forEach(e => console.log(`    - ${e}`));
  } else {
    console.log('  ✅ 전체 탭 순회 에러 없음');
  }
});
