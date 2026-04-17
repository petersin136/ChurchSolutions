import { test, expect, Page } from '@playwright/test';

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
// 1. 헌금 등록 → DB 저장 → 목록 표시
// ══════════════════════════════════════════
test('헌금 등록 후 목록에 표시된다', async ({ page }) => {
  await clickTab(page, '재정');

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

  // "헌금 등록" 버튼으로 모달 열기
  const openModalBtn = page.locator('button:has-text("헌금 등록")').first();
  await openModalBtn.click();
  await page.waitForTimeout(2000);

  const testAmount = String(Math.floor(Math.random() * 9000) + 1000);
  console.log(`  💰 테스트 금액: ${testAmount}`);

  // 모달 내 금액 입력 (모든 visible input 중 숫자 입력 가능한 것)
  const inputs = await page.locator('input:visible').all();
  let amountFilled = false;
  for (const inp of inputs) {
    const type = await inp.getAttribute('type');
    const mode = await inp.getAttribute('inputmode');
    const placeholder = await inp.getAttribute('placeholder') || '';
    if (type === 'number' || mode === 'numeric' || placeholder.includes('금액') || placeholder.includes('0')) {
      await inp.fill(testAmount);
      console.log(`  ✅ 금액 입력 (placeholder: ${placeholder})`);
      amountFilled = true;
      break;
    }
  }
  if (!amountFilled) {
    console.log('  ⚠️ 금액 input 못 찾음, visible inputs:');
    for (let i = 0; i < Math.min(inputs.length, 8); i++) {
      const attrs = await inputs[i].evaluate(el => ({
        type: el.getAttribute('type'), placeholder: el.getAttribute('placeholder'),
        inputMode: el.getAttribute('inputmode'),
      }));
      console.log(`    [${i}]: ${JSON.stringify(attrs)}`);
    }
  }

  // 모달 내 "등록" 버튼 클릭 (모달 바깥 "헌금 등록"과 구분)
  // 모달은 position:fixed 또는 z-index가 높은 div
  const modalButtons = page.locator('button:visible:has-text("등록")');
  const btnCount = await modalButtons.count();
  console.log(`  🔘 "등록" 버튼 수: ${btnCount}`);

  // 마지막 "등록" 버튼이 모달 안의 확인 버튼일 확률이 높음
  if (btnCount > 0) {
    await modalButtons.last().click();
    console.log('  ✅ 모달 내 등록 버튼 클릭');
  }
  await page.waitForTimeout(3000);

  // 새로고침 후 목록 확인
  await page.reload();
  await page.waitForLoadState('networkidle');
  await page.waitForTimeout(5000);

  await clickTab(page, '재정');
  const ic2 = page.locator('text=수입/지출').first();
  if (await ic2.isVisible().catch(() => false)) { await ic2.click(); await page.waitForTimeout(1000); }
  const ot2 = page.locator('text=수입 관리').first();
  if (await ot2.isVisible().catch(() => false)) { await ot2.click(); await page.waitForTimeout(3000); }

  const bodyText = await page.locator('body').innerText();
  const found = bodyText.includes(testAmount) || bodyText.includes(Number(testAmount).toLocaleString());
  console.log(`  🔍 금액 ${testAmount} 표시: ${found}`);
  if (!found) console.log('  ❌ DB 저장 실패 또는 목록에 미표시');
  expect(found).toBeTruthy();
});

// ══════════════════════════════════════════
// 2. 지출 등록 → DB 저장 → 목록 표시
// ══════════════════════════════════════════
test('지출 등록 후 목록에 표시된다', async ({ page }) => {
  await clickTab(page, '재정');

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

  const openModalBtn = page.locator('button:has-text("지출 등록")').first();
  await openModalBtn.click();
  await page.waitForTimeout(2000);

  const testAmount = String(Math.floor(Math.random() * 9000) + 1000);
  console.log(`  💰 테스트 지출 금액: ${testAmount}`);

  const inputs = await page.locator('input:visible').all();
  for (const inp of inputs) {
    const type = await inp.getAttribute('type');
    const mode = await inp.getAttribute('inputmode');
    const placeholder = await inp.getAttribute('placeholder') || '';
    if (type === 'number' || mode === 'numeric' || placeholder.includes('금액') || placeholder.includes('0')) {
      await inp.fill(testAmount);
      console.log(`  ✅ 금액 입력`);
      break;
    }
  }

  const modalButtons = page.locator('button:visible:has-text("등록")');
  const btnCount = await modalButtons.count();
  if (btnCount > 0) {
    await modalButtons.last().click();
    console.log('  ✅ 모달 내 등록 버튼 클릭');
  }
  await page.waitForTimeout(3000);

  await page.reload();
  await page.waitForLoadState('networkidle');
  await page.waitForTimeout(5000);

  await clickTab(page, '재정');
  const ic2 = page.locator('text=수입/지출').first();
  if (await ic2.isVisible().catch(() => false)) { await ic2.click(); await page.waitForTimeout(1000); }
  const et2 = page.locator('text=지출 관리').first();
  if (await et2.isVisible().catch(() => false)) { await et2.click(); await page.waitForTimeout(3000); }

  const bodyText = await page.locator('body').innerText();
  const found = bodyText.includes(testAmount) || bodyText.includes(Number(testAmount).toLocaleString());
  console.log(`  🔍 지출 금액 ${testAmount} 표시: ${found}`);
  expect(found).toBeTruthy();
});

// 3. 성도 등록 → DB 저장 확인
test('성도 등록 후 목록에 표시된다 (DB 저장 확인)', async ({ page }) => {
  await clickTab(page, '목양');
  await page.waitForTimeout(2000);

  const membersTab = page.locator('text=성도 관리').first();
  if (await membersTab.isVisible({ timeout: 3000 }).catch(() => false)) {
    await membersTab.click();
    await page.waitForTimeout(2000);
  }

  // "새 교인 등록" 버튼
  const addBtn = page.locator('button:has-text("새 교인 등록")').first();
  await addBtn.waitFor({ state: 'visible', timeout: 10000 });
  await addBtn.click();
  console.log('  ✅ 새 교인 등록 모달 열기');
  await page.waitForTimeout(2000);

  // 이름 입력
  const testName = `테스트교인${Date.now().toString().slice(-4)}`;
  const nameInput = page.locator('input[placeholder="이름"]').first();
  if (await nameInput.isVisible({ timeout: 5000 }).catch(() => false)) {
    await nameInput.fill(testName);
    console.log(`  ✏️ 이름: ${testName}`);
  }

  // 성별은 건너뜀 (필수 아님) – 바로 저장
  await page.waitForTimeout(500);

  // 저장 버튼 – 모달 하단의 마지막 "저장"
  const saveBtns = page.locator('button:has-text("저장"):visible');
  const saveCount = await saveBtns.count();
  console.log(`  📋 "저장" 버튼 수: ${saveCount}`);
  if (saveCount > 0) {
    await saveBtns.last().click();
    console.log('  💾 저장 클릭');
    await page.waitForTimeout(3000);
  }

  // 에러 토스트 확인 (필수 필드 누락 시)
  const errorToast = page.locator('text=이름').first();
  const bodyAfterSave = await page.locator('body').innerText();
  if (bodyAfterSave.includes('필수') || bodyAfterSave.includes('입력')) {
    console.log('  ⚠️ 필수 필드 에러 감지 – 이름만으로 저장 시도');
  }

  // 새로고침 후 확인
  await page.reload();
  await page.waitForLoadState('networkidle');
  await page.waitForTimeout(5000);
  await clickTab(page, '목양');
  await page.waitForTimeout(2000);
  const membersTab2 = page.locator('text=성도 관리').first();
  if (await membersTab2.isVisible({ timeout: 3000 }).catch(() => false)) {
    await membersTab2.click();
    await page.waitForTimeout(2000);
  }

  const body = await page.locator('body').innerText();
  const found = body.includes(testName);
  console.log(`  🔍 "${testName}" 발견: ${found}`);
  expect(found).toBeTruthy();
  console.log('✅ 성도 등록 DB 저장 확인');
});

// 4. 심방 기록 등록 → DB 저장 확인
test('심방 기록 등록 후 목록에 표시된다 (DB 저장 확인)', async ({ page }) => {
  await clickTab(page, '심방·상담');
  await page.waitForTimeout(3000);

  // "심방 기록" 서브탭 클릭 (activeSub → "visits")
  const visitSubTab = page.locator('text=심방 기록').first();
  if (await visitSubTab.isVisible({ timeout: 5000 }).catch(() => false)) {
    await visitSubTab.click();
    console.log('  📂 심방 기록 서브탭 클릭');
    await page.waitForTimeout(2000);
  } else {
    console.log('  ⚠️ 심방 기록 서브탭 안 보임, 현재 화면에서 진행');
  }

  // "심방 등록" 버튼 클릭
  const addBtn = page.locator('button:has-text("심방 등록")').first();
  if (await addBtn.isVisible({ timeout: 10000 }).catch(() => false)) {
    await addBtn.click();
    console.log('  ✅ 심방 등록 모달 열기');
    await page.waitForTimeout(2000);
  } else {
    // 헤더 액션 버튼으로 시도 (UnifiedPageLayout 상단)
    const headerBtn = page.locator('button').filter({ hasText: /심방|등록/ }).first();
    if (await headerBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
      await headerBtn.click();
      console.log('  ✅ 헤더 버튼으로 심방 모달 열기');
      await page.waitForTimeout(2000);
    } else {
      console.log('  ❌ 심방 등록 버튼을 찾을 수 없음');
    }
  }

  // 성도 선택 (FSelect → 실제로 <select> 또는 ModernSelect)
  // FSelect가 네이티브 select인지 먼저 확인
  const nativeSelect = page.locator('select:visible').first();
  if (await nativeSelect.isVisible({ timeout: 3000 }).catch(() => false)) {
    const options = nativeSelect.locator('option');
    const optCount = await options.count();
    console.log(`  📋 select 옵션 수: ${optCount}`);
    if (optCount > 1) {
      const val = await options.nth(1).getAttribute('value');
      if (val) {
        await nativeSelect.selectOption(val);
        const text = await options.nth(1).textContent();
        console.log(`  👤 성도 선택: ${text?.trim()}`);
      }
    }
    await page.waitForTimeout(1000);
  } else {
    // ModernSelect일 수 있음 – "선택" 버튼 클릭 후 첫 option
    const trigger = page.locator('button:has-text("선택"):visible').first();
    if (await trigger.isVisible({ timeout: 3000 }).catch(() => false)) {
      await trigger.click();
      await page.waitForTimeout(500);
      const opt = page.locator('[role="option"]').first();
      if (await opt.isVisible({ timeout: 3000 }).catch(() => false)) {
        await opt.click();
        console.log('  👤 ModernSelect로 성도 선택');
      }
    }
  }

  // 내용 입력
  const testMemo = `테스트심방${Date.now().toString().slice(-4)}`;
  const contentArea = page.locator('textarea:visible').first();
  if (await contentArea.isVisible({ timeout: 5000 }).catch(() => false)) {
    await contentArea.fill(testMemo);
    console.log(`  ✏️ 내용: ${testMemo}`);
  }

  // 저장
  const saveBtn = page.locator('button:has-text("저장"):visible').last();
  if (await saveBtn.isVisible({ timeout: 5000 }).catch(() => false)) {
    await saveBtn.click();
    console.log('  💾 저장 클릭');
    await page.waitForTimeout(3000);
  }

  // 새로고침 후 확인
  await page.reload();
  await page.waitForLoadState('networkidle');
  await page.waitForTimeout(5000);
  await clickTab(page, '심방·상담');
  await page.waitForTimeout(2000);
  const visitSubTab2 = page.locator('text=심방 기록').first();
  if (await visitSubTab2.isVisible({ timeout: 3000 }).catch(() => false)) {
    await visitSubTab2.click();
    await page.waitForTimeout(2000);
  }

  const body = await page.locator('body').innerText();
  const found = body.includes(testMemo);
  console.log(`  🔍 "${testMemo}" 발견: ${found}`);
  expect(found).toBeTruthy();
  console.log('✅ 심방 기록 DB 저장 확인');
});
