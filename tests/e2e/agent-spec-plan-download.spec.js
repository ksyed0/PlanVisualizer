'use strict';
const { test, expect } = require('@playwright/test');
const path = require('path');
const fs = require('fs');

test.describe('Pending Approvals widget — flag download', () => {
  test('Approve button triggers flag-file download with correct filename', async ({ page }) => {
    const fixturePath = path.join(__dirname, 'fixtures', 'pending-approvals-fixture.html');
    if (!fs.existsSync(fixturePath)) {
      test.skip(true, 'Fixture not found — skip E2E (smoke only)');
      return;
    }

    await page.goto('file://' + fixturePath);

    const [download] = await Promise.all([
      page.waitForEvent('download'),
      page.click('[data-action="approve"][data-story="US-0181"][data-gate="ac"]'),
    ]);

    expect(download.suggestedFilename()).toBe('approve-US-0181-ac.flag');
  });
});
