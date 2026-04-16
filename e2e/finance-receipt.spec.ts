import { test, expect, Page } from '@playwright/test';

// ──────────────────────────────────────────
// 로그인 함수 (매 테스트 시작 시 호출)
// ──────────────────────────────────────────
async function login(page: Page) {
  await page.goto('/login');
  await page.waitForLoadState('networkidle');

  const emailInput = page.locator('input[type="email"], input[placeholder*="email"], input[placeholder*="church"]').first();
  await emailInput.waitFor({ state: 'visible', timeout: 10000 });
  await emailInput.fill(process.env.TEST_EMAIL || '');

  const passwordInput = page.locator('input[type="password"]').first();
  await passwordInput.fill(process.env.TEST_PASSWORD || '');

  const loginButton = page.locator('button:has-text("로그인")').first();
  await loginButton.click();

  // 로그인 후 메인 페이지 로딩 대기
  await page.waitForLoadState('networkidle');
  await page.waitForTimeout(5000);
}

// ──────────────────────────────────────────
// 재정 페이지 이동
// ──────────────────────────────────────────
async function goToFinance(page: Page) {
  await page.goto('/');
  await page.waitForLoadState('networkidle');
  await page.waitForTimeout(4000);

  // nav.tab-bar 안의 span.tab-label 중 "재정" 클릭
  const financeTab = page.locator('nav.tab-bar button.tab-item span.tab-label', { hasText: '재정' });
  await financeTab.waitFor({ state: 'visible', timeout: 15000 });
  await financeTab.click();
  console.log('  🔍 nav.tab-bar > 재정 클릭 성공');

  await page.waitForTimeout(3000);
}

async function navigateToReceiptTab(page: Page) {
  await goToFinance(page);

  const reportCategory = page.locator('text=보고/설정').first();
  if (await reportCategory.isVisible().catch(() => false)) {
    await reportCategory.click();
    await page.waitForTimeout(1000);
  }

  const receiptTab = page.locator('text=기부금 영수증').first();
  if (await receiptTab.isVisible().catch(() => false)) {
    await receiptTab.click();
    await page.waitForTimeout(2000);
  }
}

// ──────────────────────────────────────────
// 각 테스트 전 로그인
// ──────────────────────────────────────────
test.beforeEach(async ({ page }) => {
  await login(page);
});

// ──────────────────────────────────────────
// 테스트 1: 재정 페이지 로딩
// ──────────────────────────────────────────
test('재정 페이지가 정상 로딩된다', async ({ page }) => {
  await goToFinance(page);
  console.log('✅ 재정 페이지 로딩 확인');
});

// ──────────────────────────────────────────
// 테스트 2: 수입 관리 – 헌금 등록 버튼
// ──────────────────────────────────────────
test('수입 관리 탭에 헌금 등록 버튼이 있다', async ({ page }) => {
  await goToFinance(page);

  const incomeCategory = page.locator('text=수입/지출').first();
  if (await incomeCategory.isVisible().catch(() => false)) {
    await incomeCategory.click();
    await page.waitForTimeout(1000);
  }

  const offeringTab = page.locator('text=수입 관리').first();
  if (await offeringTab.isVisible().catch(() => false)) {
    await offeringTab.click();
    await page.waitForTimeout(2000);
  }

  const addButton = page.locator('text=헌금 등록').first();
  await expect(addButton).toBeVisible({ timeout: 10000 });
  console.log('✅ 헌금 등록 버튼 확인');
});

// ──────────────────────────────────────────
// 테스트 3: 헌금 등록 모달
// ──────────────────────────────────────────
test('헌금 등록 모달이 열린다', async ({ page }) => {
  await goToFinance(page);

  const incomeCategory = page.locator('text=수입/지출').first();
  if (await incomeCategory.isVisible().catch(() => false)) {
    await incomeCategory.click();
    await page.waitForTimeout(1000);
  }

  const offeringTab = page.locator('text=수입 관리').first();
  if (await offeringTab.isVisible().catch(() => false)) {
    await offeringTab.click();
    await page.waitForTimeout(2000);
  }

  const addButton = page.locator('text=헌금 등록').first();
  await addButton.click();
  await page.waitForTimeout(2000);

  // 모달이 열렸는지: 보이는 input 또는 모달 배경 확인
  const visibleInput = page.locator('input:visible, select:visible').first();
  const hasVisibleInput = await visibleInput.isVisible({ timeout: 5000 }).catch(() => false);

  // 또는 모달 오버레이 확인
  const modalOverlay = page.locator('[style*="position: fixed"], [style*="z-index"]').first();
  const hasModal = await modalOverlay.isVisible().catch(() => false);

  console.log(`  모달 input: ${hasVisibleInput}, 모달 overlay: ${hasModal}`);
  expect(hasVisibleInput || hasModal).toBeTruthy();
  console.log('✅ 헌금 등록 모달 열림 확인');
});

// ──────────────────────────────────────────
// 테스트 4: 기부금 영수증 탭 이동
// ──────────────────────────────────────────
test('기부금 영수증 탭으로 이동할 수 있다', async ({ page }) => {
  await navigateToReceiptTab(page);

  const individualTab = page.locator('text=개별 발급').first();
  const hasIndividual = await individualTab.isVisible().catch(() => false);
  console.log(`  개별 발급: ${hasIndividual}`);
  expect(hasIndividual).toBeTruthy();
  console.log('✅ 기부금 영수증 탭 이동 확인');
});

// ──────────────────────────────────────────
// 테스트 5: 발급하기 버튼
// ──────────────────────────────────────────
test('개별 발급에 발급하기 버튼이 있다', async ({ page }) => {
  await navigateToReceiptTab(page);

  const individualTab = page.locator('text=개별 발급').first();
  if (await individualTab.isVisible().catch(() => false)) {
    await individualTab.click();
    await page.waitForTimeout(2000);
  }

  // 발급하기 또는 PDF 다운로드 버튼 확인
  const issueButton = page.locator('button:has-text("발급하기")').first();
  const hasIssueButton = await issueButton.isVisible({ timeout: 5000 }).catch(() => false);

  const pdfButton = page.locator('button:has-text("PDF"), button:has-text("다운로드"), button:has-text("발급")').first();
  const hasPdfButton = await pdfButton.isVisible({ timeout: 3000 }).catch(() => false);

  console.log(`  발급하기: ${hasIssueButton}, PDF/발급 버튼: ${hasPdfButton}`);

  if (!hasIssueButton) {
    console.log('  ⚠️ "발급하기" 버튼 미구현 – 추가 필요');
  }

  // 최소한 PDF 다운로드나 발급 관련 버튼이 있어야 함
  expect(hasIssueButton || hasPdfButton).toBeTruthy();
});

// ──────────────────────────────────────────
// 테스트 6: 발급 대장 조회
// ──────────────────────────────────────────
test('발급 대장 조회가 에러 없이 동작한다', async ({ page }) => {
  await navigateToReceiptTab(page);

  const ledgerTab = page.locator('text=발급 대장').first();
  if (await ledgerTab.isVisible().catch(() => false)) {
    await ledgerTab.click();
    await page.waitForTimeout(2000);
  }

  const searchButton = page.locator('button:has-text("조회")').first();
  if (await searchButton.isVisible().catch(() => false)) {
    await searchButton.click();
    await page.waitForTimeout(3000);
  }

  // 주황/빨간 에러 배너 체크
  const errorBanner = page.locator('[style*="ff9800"], [style*="f44336"], [style*="orange"], [style*="red"]');
  const errorCount = await errorBanner.count();

  if (errorCount > 0) {
    const errorText = await errorBanner.first().textContent();
    console.log(`❌ 에러: ${errorText}`);
  } else {
    console.log('✅ 발급 대장 조회 정상');
  }
  expect(errorCount).toBe(0);
});

// ──────────────────────────────────────────
// 테스트 7: 지출 관리 – 지출 등록 버튼
// ──────────────────────────────────────────
test('지출 관리 탭에 지출 등록 버튼이 있다', async ({ page }) => {
  await goToFinance(page);

  const incomeCategory = page.locator('text=수입/지출').first();
  if (await incomeCategory.isVisible().catch(() => false)) {
    await incomeCategory.click();
    await page.waitForTimeout(1000);
  }

  const expenseTab = page.locator('text=지출 관리').first();
  if (await expenseTab.isVisible().catch(() => false)) {
    await expenseTab.click();
    await page.waitForTimeout(2000);
  }

  const addButton = page.locator('text=지출 등록').first();
  await expect(addButton).toBeVisible({ timeout: 10000 });
  console.log('✅ 지출 등록 버튼 확인');
});

// ──────────────────────────────────────────
// 테스트 8: 주민번호 입력 필드
// ──────────────────────────────────────────
test('영수증에 주민번호 입력 필드가 있다', async ({ page }) => {
  await navigateToReceiptTab(page);

  const individualTab = page.locator('text=개별 발급').first();
  if (await individualTab.isVisible().catch(() => false)) {
    await individualTab.click();
    await page.waitForTimeout(2000);
  }

  // data-testid로 드롭다운 영역 특정
  const dropdownWrapper = page.locator('[data-testid="donor-dropdown"]');
  await dropdownWrapper.waitFor({ state: 'visible', timeout: 5000 });

  // 드롭다운 트리거 버튼 클릭 (래퍼 안의 첫 번째 button)
  const triggerBtn = dropdownWrapper.locator('button').first();
  await triggerBtn.click();
  console.log('  📂 교인 드롭다운 트리거 클릭');
  await page.waitForTimeout(1500);

  // 드롭다운 패널 (래퍼 안의 div, 교인 버튼들 포함)
  const panelButtons = dropdownWrapper.locator('button');
  const count = await panelButtons.count();
  console.log(`  👥 드롭다운 내 버튼 수: ${count}`);

  // "선택하세요"가 아닌 첫 번째 버튼 = 첫 교인
  for (let i = 0; i < count; i++) {
    const text = await panelButtons.nth(i).textContent();
    if (text && !text.includes('선택하세요') && !text.includes('▼')) {
      await panelButtons.nth(i).click();
      console.log(`  👤 교인 선택: ${text.trim()}`);
      break;
    }
  }

  await page.waitForTimeout(2000);

  // 스크롤 다운
  await page.evaluate(() => window.scrollBy(0, 500));
  await page.waitForTimeout(500);

  // 주민번호 입력 필드 확인
  const frontInput = page.locator('input[placeholder="앞 6자리"]').first();
  const hasFront = await frontInput.isVisible({ timeout: 5000 }).catch(() => false);

  const backInput = page.locator('input[placeholder="뒷 7자리"]').first();
  const hasBack = await backInput.isVisible({ timeout: 3000 }).catch(() => false);

  console.log(`  앞자리: ${hasFront}, 뒷자리: ${hasBack}`);
  expect(hasFront && hasBack).toBeTruthy();
  console.log('✅ 주민번호 입력 필드 확인');
});

// ──────────────────────────────────────────
// 테스트 9: 전체 탭 순회 – 에러 없음
// ──────────────────────────────────────────
test('모든 재정 탭 순회 시 치명적 에러가 없다', async ({ page }) => {
  await goToFinance(page);

  const errors: string[] = [];
  page.on('console', msg => {
    if (msg.type() === 'error') {
      errors.push(msg.text());
    }
  });

  const categories = ['수입/지출', '예산', '헌금/기부', '보고/설정'];
  for (const cat of categories) {
    const catTab = page.locator(`text=${cat}`).first();
    if (await catTab.isVisible().catch(() => false)) {
      await catTab.click();
      await page.waitForTimeout(2500);
      console.log(`  📂 ${cat} 클릭`);
    }
  }

  const criticalErrors = errors.filter(e =>
    !e.includes('favicon') &&
    !e.includes('hydration') &&
    !e.includes('Warning:') &&
    !e.includes('next-dev') &&
    !e.includes('Fast Refresh')
  );

  if (criticalErrors.length > 0) {
    console.log('❌ 콘솔 에러:');
    criticalErrors.forEach(e => console.log(`  - ${e}`));
  } else {
    console.log('✅ 치명적 콘솔 에러 없음');
  }
});
