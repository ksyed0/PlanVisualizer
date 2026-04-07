'use strict';

const fs = require('fs');
const path = require('path');
const { withLock, withLockSync, tryAcquire, release, LOCK_DIR } = require('../../orchestrator/file-lock');

describe('file-lock', () => {
  const testFile = 'test-file.json';

  afterEach(() => {
    release(testFile);
    // Clean up lock directory
    try {
      if (fs.existsSync(LOCK_DIR)) {
        fs.rmSync(LOCK_DIR, { recursive: true, force: true });
      }
    } catch {
      // ignore
    }
  });

  describe('tryAcquire / release', () => {
    it('acquires a lock successfully', () => {
      expect(tryAcquire(testFile)).toBe(true);
    });

    it('fails to acquire an already-held lock', () => {
      expect(tryAcquire(testFile)).toBe(true);
      expect(tryAcquire(testFile)).toBe(false);
    });

    it('re-acquires after release', () => {
      expect(tryAcquire(testFile)).toBe(true);
      release(testFile);
      expect(tryAcquire(testFile)).toBe(true);
    });

    it('breaks stale locks', () => {
      // Acquire and manually backdate the timestamp
      expect(tryAcquire(testFile)).toBe(true);
      const lockDir = path.join(LOCK_DIR, testFile.replace(/[/\\]/g, '_').replace(/\./g, '_') + '.lock');
      const infoPath = path.join(lockDir, 'info');
      const info = JSON.parse(fs.readFileSync(infoPath, 'utf8'));
      info.ts = Date.now() - 60_000; // 60 seconds ago
      fs.writeFileSync(infoPath, JSON.stringify(info));

      // Should break the stale lock and acquire
      expect(tryAcquire(testFile)).toBe(true);
    });
  });

  describe('withLock (async)', () => {
    it('executes callback and returns result', async () => {
      const result = await withLock(testFile, async () => 42);
      expect(result).toBe(42);
    });

    it('releases lock even if callback throws', async () => {
      await expect(
        withLock(testFile, async () => {
          throw new Error('test error');
        }),
      ).rejects.toThrow('test error');

      // Lock should be released — we can acquire again
      expect(tryAcquire(testFile)).toBe(true);
    });

    it('serializes concurrent access', async () => {
      const order = [];
      const task = (id, ms) =>
        withLock(testFile, async () => {
          order.push(`start-${id}`);
          await new Promise((r) => setTimeout(r, ms));
          order.push(`end-${id}`);
        });

      await Promise.all([task('A', 50), task('B', 10)]);

      // Both tasks should complete without interleaving
      expect(order[0]).toBe('start-A');
      expect(order[1]).toBe('end-A');
      expect(order[2]).toBe('start-B');
      expect(order[3]).toBe('end-B');
    });
  });

  describe('withLockSync', () => {
    it('executes callback and returns result', () => {
      const result = withLockSync(testFile, () => 'hello');
      expect(result).toBe('hello');
    });

    it('releases lock even if callback throws', () => {
      expect(() =>
        withLockSync(testFile, () => {
          throw new Error('sync error');
        }),
      ).toThrow('sync error');

      expect(tryAcquire(testFile)).toBe(true);
    });
  });
});
