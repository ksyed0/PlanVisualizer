const { execSync } = require('child_process');
const path = require('path');
const ROOT = path.resolve(__dirname, '../..');

test('pv:check-upgrade runs read-only without errors', () => {
  const out = execSync('node tools/pv-check-upgrade.js', { cwd: ROOT, encoding: 'utf8' });
  expect(out).toMatch(/PlanVisualizer state/);
});

test('pv:doctor runs without errors', () => {
  const out = execSync('node tools/pv-doctor.js', { cwd: ROOT, encoding: 'utf8' });
  expect(out).toMatch(/Repository mode/);
});
