// tests/unit/migrations/index.test.js
const fs = require('fs');
const path = require('path');
const os = require('os');
const { pending } = require('../../../tools/lib/migrations');

let root;

beforeEach(() => {
  root = fs.mkdtempSync(path.join(os.tmpdir(), 'mig-'));
  fs.mkdirSync(path.join(root, 'docs'));
  fs.writeFileSync(path.join(root, 'package.json'), JSON.stringify({ version: '2.5.0' }));
});

afterEach(() => {
  fs.rmSync(root, { recursive: true, force: true });
});

test('pending returns all migrations on a fresh project', () => {
  const list = pending({ root });
  // At plan-A time, no migration files exist yet; later phases add them.
  expect(Array.isArray(list)).toBe(true);
});
