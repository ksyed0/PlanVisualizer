// tests/unit/repository/index-datastore.test.js
const fs = require('fs');
const path = require('path');
const os = require('os');
const { openIndexDatastore } = require('../../../tools/lib/repository/index-datastore');

describe('IndexDatastore', () => {
  let dbDir;
  let ds;

  beforeEach(() => {
    dbDir = fs.mkdtempSync(path.join(os.tmpdir(), 'idx-'));
  });

  afterEach(() => {
    if (ds) {
      try {
        ds.close();
      } catch {
        /* ignore close errors */
      }
      ds = undefined;
    }
    fs.rmSync(dbDir, { recursive: true, force: true });
  });

  test('opens via better-sqlite3 when available', () => {
    ds = openIndexDatastore({ path: path.join(dbDir, 'pv.db') });
    expect(ds.mode).toBe('better-sqlite3');
    expect(ds.exec).toBeDefined();
  });

  test('exposes prepare and transaction', () => {
    ds = openIndexDatastore({ path: path.join(dbDir, 'pv.db') });
    ds.exec('CREATE TABLE t(id INTEGER PRIMARY KEY, v TEXT)');
    const insert = ds.prepare('INSERT INTO t(v) VALUES (?)');
    ds.transaction(() => {
      insert.run('a');
      insert.run('b');
    });
    const rows = ds.prepare('SELECT v FROM t ORDER BY id').all();
    expect(rows.map((r) => r.v)).toEqual(['a', 'b']);
  });

  test('WAL mode is enabled', () => {
    ds = openIndexDatastore({ path: path.join(dbDir, 'pv.db') });
    const journal = ds.prepare('PRAGMA journal_mode').get();
    expect(String(journal.journal_mode).toLowerCase()).toBe('wal');
  });

  test('--no-index mode returns a noop datastore', () => {
    ds = openIndexDatastore({ path: path.join(dbDir, 'pv.db'), mode: 'no-index' });
    expect(ds.mode).toBe('no-index');
    expect(() => ds.exec('whatever')).not.toThrow();
    expect(ds.prepare('SELECT 1').all()).toEqual([]);
  });
});
