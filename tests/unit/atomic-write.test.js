'use strict';

const fs = require('fs');
const path = require('path');
const {
  atomicWrite,
  atomicWriteJson,
  atomicReadModifyWriteJson,
  atomicAppend,
} = require('../../orchestrator/atomic-write');
const { LOCK_DIR } = require('../../orchestrator/file-lock');

const ROOT = path.join(__dirname, '..', '..');
const TMP_DIR = path.join(ROOT, 'tests', '.tmp-atomic');

describe('atomic-write', () => {
  beforeAll(() => {
    if (!fs.existsSync(TMP_DIR)) fs.mkdirSync(TMP_DIR, { recursive: true });
  });

  afterAll(() => {
    fs.rmSync(TMP_DIR, { recursive: true, force: true });
    try {
      if (fs.existsSync(LOCK_DIR)) {
        fs.rmSync(LOCK_DIR, { recursive: true, force: true });
      }
    } catch {
      // ignore
    }
  });

  describe('atomicWrite', () => {
    it('writes a file atomically', () => {
      const filePath = path.join(TMP_DIR, 'test.txt');
      atomicWrite(filePath, 'hello world');
      expect(fs.readFileSync(filePath, 'utf8')).toBe('hello world');
    });

    it('overwrites existing file', () => {
      const filePath = path.join(TMP_DIR, 'overwrite.txt');
      atomicWrite(filePath, 'first');
      atomicWrite(filePath, 'second');
      expect(fs.readFileSync(filePath, 'utf8')).toBe('second');
    });

    it('leaves no temp file behind', () => {
      const filePath = path.join(TMP_DIR, 'clean.txt');
      atomicWrite(filePath, 'data');
      const files = fs.readdirSync(TMP_DIR).filter((f) => f.includes('.tmp.'));
      expect(files).toHaveLength(0);
    });
  });

  describe('atomicWriteJson', () => {
    it('writes pretty-printed JSON with trailing newline', () => {
      const filePath = path.join(TMP_DIR, 'data.json');
      atomicWriteJson(filePath, { key: 'value', num: 42 });
      const content = fs.readFileSync(filePath, 'utf8');
      expect(content).toBe('{\n  "key": "value",\n  "num": 42\n}\n');
    });
  });

  describe('atomicReadModifyWriteJson', () => {
    it('reads, modifies, and writes back atomically', async () => {
      const filePath = path.join(TMP_DIR, 'modify.json');
      fs.writeFileSync(filePath, JSON.stringify({ count: 0 }, null, 2) + '\n');

      const result = await atomicReadModifyWriteJson(filePath, (data) => {
        data.count += 1;
        return data;
      });

      expect(result.count).toBe(1);
      const saved = JSON.parse(fs.readFileSync(filePath, 'utf8'));
      expect(saved.count).toBe(1);
    });

    it('serializes concurrent modifications', async () => {
      const filePath = path.join(TMP_DIR, 'concurrent.json');
      fs.writeFileSync(filePath, JSON.stringify({ count: 0 }, null, 2) + '\n');

      // 5 concurrent increments should all succeed
      await Promise.all(
        Array.from({ length: 5 }, () =>
          atomicReadModifyWriteJson(filePath, (data) => {
            data.count += 1;
            return data;
          }),
        ),
      );

      const saved = JSON.parse(fs.readFileSync(filePath, 'utf8'));
      expect(saved.count).toBe(5);
    });
  });

  describe('atomicAppend', () => {
    it('appends content to a file', async () => {
      const filePath = path.join(TMP_DIR, 'log.txt');
      fs.writeFileSync(filePath, 'line1\n');
      await atomicAppend(filePath, 'line2\n');
      expect(fs.readFileSync(filePath, 'utf8')).toBe('line1\nline2\n');
    });

    it('serializes concurrent appends', async () => {
      const filePath = path.join(TMP_DIR, 'concurrent-log.txt');
      fs.writeFileSync(filePath, '');

      await Promise.all(Array.from({ length: 10 }, (_, i) => atomicAppend(filePath, `line-${i}\n`)));

      const lines = fs.readFileSync(filePath, 'utf8').split('\n').filter(Boolean);
      expect(lines).toHaveLength(10);
    });
  });
});
