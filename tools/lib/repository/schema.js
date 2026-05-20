// tools/lib/repository/schema.js
'use strict';
const fs = require('fs');
const path = require('path');

const MIGRATIONS_DIR = path.join(__dirname, 'migrations');

function listMigrations() {
  return fs
    .readdirSync(MIGRATIONS_DIR)
    .filter((f) => /^\d{3}_.*\.sql$/.test(f))
    .sort()
    .map((f) => ({ version: parseInt(f.slice(0, 3), 10), file: path.join(MIGRATIONS_DIR, f) }));
}

function getSchemaVersion(ds) {
  if (ds.mode === 'no-index') return null;
  ds.exec('CREATE TABLE IF NOT EXISTS meta_status (key TEXT PRIMARY KEY, value TEXT)');
  const row = ds.prepare("SELECT value FROM meta_status WHERE key='schema_version'").get();
  return row ? parseInt(row.value, 10) : 0;
}

function setSchemaVersion(ds, version) {
  ds.prepare(
    `INSERT INTO meta_status(key, value) VALUES('schema_version', ?)
              ON CONFLICT(key) DO UPDATE SET value=excluded.value`,
  ).run(String(version));
}

function applySchemaMigrations(ds) {
  if (ds.mode === 'no-index') return;
  const current = getSchemaVersion(ds);
  const all = listMigrations();
  for (const m of all) {
    if (m.version <= current) continue;
    const sql = fs.readFileSync(m.file, 'utf8');
    try {
      ds.transaction(() => {
        ds.exec(sql);
        setSchemaVersion(ds, m.version);
      });
    } catch (err) {
      err.message = `[schema] migration ${path.basename(m.file)} failed: ${err.message}`;
      throw err;
    }
  }
}

module.exports = { applySchemaMigrations, getSchemaVersion, listMigrations };
