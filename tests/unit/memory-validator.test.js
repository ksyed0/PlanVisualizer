// tests/unit/memory-validator.test.js
'use strict';
const fs = require('fs');
const path = require('path');
const os = require('os');
const { validateMemory } = require('../../tools/lib/memory-validator');

describe('validateMemory', () => {
  let tmpdir;
  beforeEach(() => {
    tmpdir = fs.mkdtempSync(path.join(os.tmpdir(), 'memval-'));
    fs.mkdirSync(path.join(tmpdir, 'docs/memory/topics'), { recursive: true });
    fs.writeFileSync(path.join(tmpdir, 'docs/memory/topics/x.md'), '# X\n\nbody\n');
  });
  afterEach(() => fs.rmSync(tmpdir, { recursive: true, force: true }));

  test('ok when MEMORY.md matches generated content', () => {
    const { compactMemory } = require('../../tools/lib/memory-index');
    compactMemory({ root: tmpdir });
    const result = validateMemory({ root: tmpdir });
    expect(result.ok).toBe(true);
    expect(result.diff).toBe('');
  });

  test('drift when MEMORY.md differs', () => {
    fs.writeFileSync(path.join(tmpdir, 'MEMORY.md'), '# wrong content\n');
    const result = validateMemory({ root: tmpdir });
    expect(result.ok).toBe(false);
    expect(result.diff).not.toBe('');
    expect(result.diff).toContain('---');
  });

  test('ok when docs/memory missing and MEMORY.md missing (fresh install)', () => {
    const tmp2 = fs.mkdtempSync(path.join(os.tmpdir(), 'memval2-'));
    const result = validateMemory({ root: tmp2 });
    expect(result.ok).toBe(true);
    fs.rmSync(tmp2, { recursive: true, force: true });
  });

  test('drift when topic files exist but MEMORY.md missing', () => {
    // MEMORY.md was never written — drift since topic files exist.
    const result = validateMemory({ root: tmpdir });
    expect(result.ok).toBe(false);
  });
});
