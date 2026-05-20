const fs = require('fs');
const path = require('path');
const os = require('os');
const { withFileLock } = require('../../../tools/lib/repository/file-lock');

describe('withFileLock', () => {
  let tmpFile;
  beforeEach(() => {
    tmpFile = path.join(os.tmpdir(), `lock-test-${Date.now()}.md`);
    fs.writeFileSync(tmpFile, 'initial');
  });
  afterEach(() => {
    try {
      fs.unlinkSync(tmpFile);
    } catch {
      /* ignore */
    }
  });

  test('serializes concurrent writes', async () => {
    const order = [];
    await Promise.all([
      withFileLock(tmpFile, async () => {
        order.push('A-start');
        await new Promise((r) => setTimeout(r, 50));
        order.push('A-end');
      }),
      withFileLock(tmpFile, async () => {
        order.push('B-start');
        order.push('B-end');
      }),
    ]);
    expect(order).toEqual(['A-start', 'A-end', 'B-start', 'B-end']);
  });

  test('locks are released after function throws', async () => {
    await expect(
      withFileLock(tmpFile, async () => {
        throw new Error('boom');
      }),
    ).rejects.toThrow('boom');
    let ran = false;
    await withFileLock(tmpFile, async () => {
      ran = true;
    });
    expect(ran).toBe(true);
  });

  test('acquireMany locks files in lexicographic order', async () => {
    const f2 = tmpFile + '.2';
    fs.writeFileSync(f2, 'x');
    const { acquireMany } = require('../../../tools/lib/repository/file-lock');
    const acquired = [];
    const release = await acquireMany([f2, tmpFile], (p) => acquired.push(p));
    expect(acquired).toEqual([tmpFile, f2].sort());
    await release();
    fs.unlinkSync(f2);
  });
});
