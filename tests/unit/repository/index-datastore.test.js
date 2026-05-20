// tests/unit/repository/index-datastore.test.js
const fs = require('fs');
const path = require('path');
const os = require('os');
const { openIndexDatastore } = require('../../../tools/lib/repository/index-datastore');

describe('IndexDatastore', () => {
  let dbDir;
  beforeEach(() => {
    dbDir = fs.mkdtempSync(path.join(os.tmpdir(), 'idx-'));
  });
  afterEach(() => {
    fs.rmSync(dbDir, { recursive: true, force: true });
  });

  test('opens via better-sqlite3 when available', () => {
    const ds = openIndexDatastore({ path: path.join(dbDir, 'pv.db') });
    expect(ds.mode).toBe('better-sqlite3');
    expect(ds.exec).toBeDefined();
    ds.close();
  });

  test('exposes prepare and transaction', () => {
    const ds = openIndexDatastore({ path: path.join(dbDir, 'pv.db') });
    ds.exec('CREATE TABLE t(id INTEGER PRIMARY KEY, v TEXT)');
    const insert = ds.prepare('INSERT INTO t(v) VALUES (?)');
    ds.transaction(() => {
      insert.run('a');
      insert.run('b');
    });
    const rows = ds.prepare('SELECT v FROM t ORDER BY id').all();
    expect(rows.map((r) => r.v)).toEqual(['a', 'b']);
    ds.close();
  });

  test('WAL mode is enabled', () => {
    const ds = openIndexDatastore({ path: path.join(dbDir, 'pv.db') });
    const journal = ds.prepare('PRAGMA journal_mode').get();
    expect(String(journal.journal_mode).toLowerCase()).toBe('wal');
    ds.close();
  });

  test('--no-index mode returns a noop datastore', () => {
    const ds = openIndexDatastore({ path: path.join(dbDir, 'pv.db'), mode: 'no-index' });
    expect(ds.mode).toBe('no-index');
    expect(() => ds.exec('whatever')).not.toThrow();
    expect(ds.prepare('SELECT 1').all()).toEqual([]);
    ds.close();
  });
});
