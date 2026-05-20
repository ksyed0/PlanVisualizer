// tests/unit/migrations/backup.test.js
const fs = require('fs');
const path = require('path');
const os = require('os');
const { snapshot, listBackups, restore } = require('../../../tools/lib/migrations/backup');

let root;

beforeEach(() => {
  root = fs.mkdtempSync(path.join(os.tmpdir(), 'bk-'));
});

afterEach(() => {
  fs.rmSync(root, { recursive: true, force: true });
});

test('snapshot → listBackups → restore round-trips a single file', () => {
  // Create a source file
  const srcRel = 'docs/sample.md';
  fs.mkdirSync(path.join(root, 'docs'), { recursive: true });
  fs.writeFileSync(path.join(root, srcRel), 'hello world');

  // Snapshot
  const dir = snapshot({ root, label: 'pre-001', files: [srcRel] });
  expect(fs.existsSync(dir)).toBe(true);

  // List
  const backups = listBackups({ root });
  expect(backups).toContain('pre-001');

  // Overwrite source
  fs.writeFileSync(path.join(root, srcRel), 'modified');
  expect(fs.readFileSync(path.join(root, srcRel), 'utf8')).toBe('modified');

  // Restore
  const restored = restore({ root, label: 'pre-001' });
  expect(restored).toContain(srcRel);
  expect(fs.readFileSync(path.join(root, srcRel), 'utf8')).toBe('hello world');
});

test('listBackups returns [] when no backups exist', () => {
  expect(listBackups({ root })).toEqual([]);
});

test('restore throws for unknown label', () => {
  expect(() => restore({ root, label: 'nonexistent' })).toThrow('backup not found: nonexistent');
});
