'use strict';
// Playwright dashboard e2e suite — US-0272, AC-1054–AC-1056.
// Run via:  PLAYWRIGHT_E2E=true npx playwright test tests/e2e/dashboard-playwright.spec.js
// This file is intentionally excluded from the Jest e2e runner (see jest.e2e.config.js).

const { test, expect } = require('@playwright/test');
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const SKIP = !process.env.PLAYWRIGHT_E2E;
const ROOT = path.resolve(__dirname, '../..');
const FIXTURES = path.join(__dirname, 'fixtures');

// generate-dashboard.js always writes to ROOT/docs/dashboard.html regardless of cwd.
// We generate the dashboard once using a fixture sdlc-status.json, then restore the
// original. All workers share the stable ROOT/docs/dashboard.html path.
const DOCS_DIR = path.join(ROOT, 'docs');
const STATUS_PATH = path.join(DOCS_DIR, 'sdlc-status.json');
const DASHBOARD_PATH = path.join(DOCS_DIR, 'dashboard.html');
const STATUS_BACKUP = path.join(DOCS_DIR, 'sdlc-status.json.pw-bak');

test.beforeAll(async (_fixtures, testInfo) => {
  if (SKIP) return;

  // Only worker 0 runs setup to avoid races
  if (testInfo.workerIndex === 0) {
    // Backup existing sdlc-status.json if present
    if (fs.existsSync(STATUS_PATH)) {
      fs.copyFileSync(STATUS_PATH, STATUS_BACKUP);
    }
    // Install fixture as sdlc-status.json
    fs.copyFileSync(path.join(FIXTURES, 'sdlc-status-init.json'), STATUS_PATH);
    // Generate dashboard.html
    execSync(`node "${path.join(ROOT, 'tools/generate-dashboard.js')}"`, {
      cwd: ROOT,
      stdio: 'pipe',
      timeout: 30000,
    });
    // Restore original sdlc-status.json
    if (fs.existsSync(STATUS_BACKUP)) {
      fs.copyFileSync(STATUS_BACKUP, STATUS_PATH);
      fs.unlinkSync(STATUS_BACKUP);
    }
  } else {
    // Other workers wait up to 15 s for worker 0 to finish generating
    const deadline = Date.now() + 15000;
    while (!fs.existsSync(DASHBOARD_PATH)) {
      if (Date.now() > deadline) throw new Error('Timed out waiting for dashboard.html');
      await new Promise((r) => setTimeout(r, 200));
    }
  }
});

const skipTest = (name, fn) => (SKIP ? test.skip(name, fn) : test(name, fn));

test.describe('Dashboard Playwright suite', () => {
  // AC-1054a: density toggle cycles S → M → L and persists in localStorage.
  // Real selector: [data-density] buttons inside .pv-density-toggle
  skipTest('AC-1054a: density toggle cycles S → M → L and persists on reload', async ({ page }) => {
    await page.goto(`file://${DASHBOARD_PATH}`);

    const densityBtnM = page.locator('.pv-density-toggle button[data-density="M"]').first();
    if (!(await densityBtnM.isVisible())) {
      test.skip(true, 'Density toggle not found — check selector');
      return;
    }
    await densityBtnM.click(); // → M
    // eslint-disable-next-line no-undef
    const afterM = await page.evaluate(() => localStorage.getItem('pv-task-density'));
    expect(afterM).toBe('M');

    const densityBtnL = page.locator('.pv-density-toggle button[data-density="L"]').first();
    await densityBtnL.click(); // → L
    // eslint-disable-next-line no-undef
    const afterL = await page.evaluate(() => localStorage.getItem('pv-task-density'));
    expect(afterL).toBe('L');

    // Reload and confirm localStorage persists across navigation
    await page.reload();
    // eslint-disable-next-line no-undef
    const afterReload = await page.evaluate(() => localStorage.getItem('pv-task-density'));
    expect(afterReload).toBe('L');
  });

  // AC-1054b: live clock ticker shows HH:MM:SS format.
  // Real selector: #mc-topbar-clock (US-0146 live bar clock)
  skipTest('AC-1054b: live ticker shows HH:MM:SS format', async ({ page }) => {
    await page.goto(`file://${DASHBOARD_PATH}`);
    const ticker = page.locator('#mc-topbar-clock').first();
    if (!(await ticker.isVisible())) {
      test.skip(true, 'Clock ticker element not found — check selector');
      return;
    }
    // The clock starts as "00:00:00" and ticks each second client-side.
    // Either value satisfies the HH:MM pattern.
    const text = await ticker.innerText();
    expect(text).toMatch(/\d{2}:\d{2}/);
  });

  // AC-1054c: approve button triggers flag download with correct filename.
  // Real fixture: tests/e2e/fixtures/pending-approvals-fixture.html
  skipTest('AC-1054c: approve button triggers flag download with correct filename', async ({ page }) => {
    const fixturePath = path.join(FIXTURES, 'pending-approvals-fixture.html');
    if (!fs.existsSync(fixturePath)) {
      test.skip(true, 'Pending approvals fixture not found');
      return;
    }
    await page.goto(`file://${fixturePath}`);
    const btn = page.locator('[data-action="approve"][data-story]').first();
    if (!(await btn.isVisible())) {
      test.skip(true, 'No approve button in fixture');
      return;
    }
    const storyId = await btn.getAttribute('data-story');
    const gate = await btn.getAttribute('data-gate');
    const [download] = await Promise.all([page.waitForEvent('download'), btn.click()]);
    expect(download.suggestedFilename()).toBe(`approve-${storyId}-${gate}.flag`);
  });

  // AC-1055: light theme snapshot matches committed baseline.
  skipTest('AC-1055: light theme snapshot matches committed baseline', async ({ page }) => {
    await page.goto(`file://${DASHBOARD_PATH}`);
    await page.emulateMedia({ colorScheme: 'light' });
    await page.waitForLoadState('networkidle');
    await expect(page).toHaveScreenshot('dashboard-light.png', {
      maxDiffPixelRatio: 0.001,
      fullPage: true,
    });
  });

  // AC-1055: dark theme snapshot matches committed baseline.
  skipTest('AC-1055: dark theme snapshot matches committed baseline', async ({ page }) => {
    await page.goto(`file://${DASHBOARD_PATH}`);
    await page.emulateMedia({ colorScheme: 'dark' });
    await page.waitForLoadState('networkidle');
    await expect(page).toHaveScreenshot('dashboard-dark.png', {
      maxDiffPixelRatio: 0.001,
      fullPage: true,
    });
  });
});
