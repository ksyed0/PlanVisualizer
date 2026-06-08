'use strict';
const fs = require('fs');
const path = require('path');
const os = require('os');
const Database = require('better-sqlite3');
const { createTryInsert } = require('../../../tools/lib/repository/insert-helper');

describe('createTryInsert helper', () => {
  let root, db;

  beforeEach(() => {
    root = fs.mkdtempSync(path.join(os.tmpdir(), 'ins-help-'));
    db = new Database(path.join(root, 'test.db'));
    db.exec(
      "CREATE TABLE widgets (id TEXT PRIMARY KEY, kind TEXT NOT NULL CHECK (kind IN ('A','B','C')), label TEXT, UNIQUE(label))",
    );
  });
  afterEach(() => {
    db.close();
    fs.rmSync(root, { recursive: true, force: true });
  });

  test('successful insert returns true and produces no warning', () => {
    const warnings = [];
    const tryInsert = createTryInsert({ warnings });
    const ins = db.prepare('INSERT INTO widgets(id,kind,label) VALUES(?,?,?)');
    const ok = tryInsert(() => ins.run('W-1', 'A', 'first'), 'W-1');
    expect(ok).toBe(true);
    expect(warnings).toEqual([]);
  });

  test('SQLITE_CONSTRAINT_CHECK produces check-rejected warning and returns false', () => {
    const warnings = [];
    const tryInsert = createTryInsert({ warnings });
    const ins = db.prepare('INSERT INTO widgets(id,kind,label) VALUES(?,?,?)');
    const ok = tryInsert(() => ins.run('W-2', 'BAD', 'second'), 'W-2');
    expect(ok).toBe(false);
    expect(warnings).toHaveLength(1);
    expect(warnings[0].code).toBe('check-rejected');
    expect(warnings[0].entityId).toBe('W-2');
    expect(warnings[0].message).toMatch(/CHECK constraint failed/);
  });

  test('SQLITE_CONSTRAINT_PRIMARYKEY produces duplicate-id warning and returns false', () => {
    const warnings = [];
    const tryInsert = createTryInsert({ warnings });
    const ins = db.prepare('INSERT INTO widgets(id,kind,label) VALUES(?,?,?)');
    ins.run('W-3', 'A', 'third');
    const ok = tryInsert(() => ins.run('W-3', 'B', 'third-dup'), 'W-3');
    expect(ok).toBe(false);
    expect(warnings).toHaveLength(1);
    expect(warnings[0].code).toBe('duplicate-id');
    expect(warnings[0].entityId).toBe('W-3');
  });

  test('SQLITE_CONSTRAINT_UNIQUE produces duplicate-id warning and returns false', () => {
    const warnings = [];
    const tryInsert = createTryInsert({ warnings });
    const ins = db.prepare('INSERT INTO widgets(id,kind,label) VALUES(?,?,?)');
    ins.run('W-4', 'A', 'shared-label');
    const ok = tryInsert(() => ins.run('W-5', 'A', 'shared-label'), 'W-5');
    expect(ok).toBe(false);
    expect(warnings).toHaveLength(1);
    expect(warnings[0].code).toBe('duplicate-id');
  });

  test('unexpected errors rethrow', () => {
    const warnings = [];
    const tryInsert = createTryInsert({ warnings });
    const fn = () => {
      const e = new Error('boom');
      e.code = 'SOMETHING_ELSE';
      throw e;
    };
    expect(() => tryInsert(fn, 'X-1')).toThrow(/boom/);
    expect(warnings).toEqual([]);
  });
});
