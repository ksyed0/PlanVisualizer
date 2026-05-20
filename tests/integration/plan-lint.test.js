// tests/integration/plan-lint.test.js
'use strict';
const { execSync } = require('child_process');
const path = require('path');
const ROOT = path.resolve(__dirname, '../..');

test('plan:lint runs without crashing', () => {
  const out = execSync('node tools/plan-lint.js', { cwd: ROOT, encoding: 'utf8' });
  expect(out).toMatch(/\[plan:lint\] errors:/);
});

test('plan:lint exits 0 (no error-tier violations on current data)', () => {
  expect(() =>
    execSync('node tools/plan-lint.js', { cwd: ROOT, encoding: 'utf8', stdio: ['pipe', 'pipe', 'pipe'] }),
  ).not.toThrow();
});
