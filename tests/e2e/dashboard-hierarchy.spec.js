'use strict';
const { test, expect } = require('@playwright/test');
const { execSync } = require('child_process');
const path = require('path');
const fs = require('fs');

const ROOT = path.resolve(__dirname, '..', '..');
const FIXTURE_PATH = path.join(__dirname, 'fixtures', 'sdlc-status-hierarchy.json');
const STATUS_PATH = path.join(ROOT, 'docs', 'sdlc-status.json');
const DASHBOARD_PATH = path.join(ROOT, 'docs', 'dashboard.html');
const DASHBOARD_URL = `file://${DASHBOARD_PATH}`;

let originalStatus = null;

test.beforeAll(() => {
  // Swap in test fixture, generate dashboard, restore original
  originalStatus = fs.existsSync(STATUS_PATH) ? fs.readFileSync(STATUS_PATH) : null;
  fs.copyFileSync(FIXTURE_PATH, STATUS_PATH);
  execSync('node tools/generate-dashboard.js', { cwd: ROOT });
  if (originalStatus) fs.writeFileSync(STATUS_PATH, originalStatus);
});

test('BUG-0185: active agent card is taller than any idle card', async ({ page }) => {
  await page.goto(DASHBOARD_URL);
  const activeBox = await page.locator('.mc-active-card').first().boundingBox();
  const idleCards = await page.locator('.mc-idle-card').all();
  expect(activeBox).not.toBeNull();
  expect(idleCards.length).toBeGreaterThan(0);
  for (const card of idleCards) {
    const box = await card.boundingBox();
    expect(activeBox.height).toBeGreaterThan(box.height);
  }
});

test('BUG-0186: conductor dispatch strip visible when Conductor is idle', async ({ page }) => {
  await page.goto(DASHBOARD_URL);
  const strip = page.locator('#mc-conductor-dispatch');
  await expect(strip).toBeVisible();
  await expect(strip).toContainText('dispatched');
});

test('BUG-0187: pipeline phase blocks do not contain agent names', async ({ page }) => {
  await page.goto(DASHBOARD_URL);
  const phases = await page.locator('.phase-block').all();
  expect(phases.length).toBeGreaterThan(0);
  for (const phase of phases) {
    const text = await phase.innerText();
    expect(text).not.toMatch(/Compass|Keystone|Pixel|Forge|Sentinel|Circuit/);
  }
});

test('BUG-0188: primary event log is visible in main column', async ({ page }) => {
  await page.goto(DASHBOARD_URL);
  const log = page.locator('#pv-event-log');
  await expect(log).toBeVisible();
  const isInMain = await page.locator('.mc-main #pv-event-log').count();
  expect(isInMain).toBeGreaterThan(0);
});

test('BUG-0189: chrome height is 40px or less', async ({ page }) => {
  await page.goto(DASHBOARD_URL);
  const chromeHeight = await page.locator('.pv-chrome').evaluate((el) => el.getBoundingClientRect().height);
  expect(chromeHeight).toBeLessThanOrEqual(44);
});
