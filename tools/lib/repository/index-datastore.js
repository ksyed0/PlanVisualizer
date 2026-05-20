// tools/lib/repository/index-datastore.js
'use strict';
const fs = require('fs');
const path = require('path');

function openBetterSqlite3(dbPath) {
  const Database = require('better-sqlite3');
  fs.mkdirSync(path.dirname(dbPath), { recursive: true });
  const db = new Database(dbPath);
  db.pragma('journal_mode = WAL');
  db.pragma('synchronous = NORMAL');
  db.pragma('foreign_keys = ON');
  return {
    mode: 'better-sqlite3',
    exec: (sql) => db.exec(sql),
    prepare: (sql) => db.prepare(sql),
    transaction: (fn) => db.transaction(fn)(),
    close: () => db.close(),
  };
}

function openNodeSqlite(dbPath) {
  const { DatabaseSync } = require('node:sqlite');
  fs.mkdirSync(path.dirname(dbPath), { recursive: true });
  const db = new DatabaseSync(dbPath);
  db.exec('PRAGMA journal_mode = WAL');
  db.exec('PRAGMA synchronous = NORMAL');
  db.exec('PRAGMA foreign_keys = ON');
  return {
    mode: 'node:sqlite',
    exec: (sql) => db.exec(sql),
    prepare: (sql) => {
      const stmt = db.prepare(sql);
      return { run: (...a) => stmt.run(...a), get: (...a) => stmt.get(...a), all: (...a) => stmt.all(...a) };
    },
    transaction: (fn) => {
      db.exec('BEGIN');
      try {
        fn();
        db.exec('COMMIT');
      } catch (e) {
        db.exec('ROLLBACK');
        throw e;
      }
    },
    close: () => db.close(),
  };
}

function noopDatastore() {
  return {
    mode: 'no-index',
    exec: () => {},
    prepare: () => ({ run: () => ({ changes: 0 }), get: () => undefined, all: () => [] }),
    transaction: (fn) => fn(),
    close: () => {},
  };
}

function openIndexDatastore({ path: dbPath, mode } = {}) {
  if (mode === 'no-index' || process.env.PV_NO_INDEX === '1') return noopDatastore();
  if (mode === 'node:sqlite') return openNodeSqlite(dbPath);
  if (mode === 'better-sqlite3') return openBetterSqlite3(dbPath);
  try {
    return openBetterSqlite3(dbPath);
  } catch {
    try {
      return openNodeSqlite(dbPath);
    } catch (e2) {
      console.warn('[repo] SQLite unavailable, falling back to --no-index legacy mode:', e2.message);
      return noopDatastore();
    }
  }
}

module.exports = { openIndexDatastore };
