'use strict';

/**
 * sdlc-snapshot.js — full SQL + JSON snapshot/restore for Phase D state
 * (US-0239 / TASK-0064, AC-0934..AC-0937).
 *
 * The pre-existing `backup.js` snapshots flat files only. Phase D promotes
 * SQLite to authoritative for SDLC state (sdlc_events, sdlc_tasks,
 * sdlc_programme + `meta_status('migration_005_hash')`), so a meaningful
 * snapshot must include the SQL row state too. The JSON mirror is also
 * captured for human review and emergency manual recovery, but on rollback
 * the canonical state re-renders from the restored SQL via
 * `SdlcMirror._renderFromSql()` (the whole point of Phase D — SQL is the
 * source of truth).
 *
 * Snapshot layout: `docs/.pv-backup/<label>/`
 *   - sdlc-status.json                — copy of the JSON mirror at snapshot
 *                                       time (for review only)
 *   - sql/sdlc_events.json            — full row array
 *   - sql/sdlc_tasks.json             — full row array
 *   - sql/sdlc_programme.json         — full row array
 *   - sql/meta_status.json            — { migration_005_hash: <value|null> }
 *   - manifest.json                   — { createdAt, label, schemaVersion,
 *                                         counts: { events, tasks, programme } }
 *
 * Format choice rationale: JSON row arrays rather than SQLite binary dumps
 * because (a) human-reviewable in `git diff`, (b) portable across
 * better-sqlite3 versions, (c) Phase D's invariant is that the JSON mirror
 * is a pure function of SQL state, so a JSON snapshot of SQL rows preserves
 * exactly what the system needs to round-trip.
 */

const fs = require('fs');
const path = require('path');

const SQL_TABLES = ['sdlc_events', 'sdlc_tasks', 'sdlc_programme'];
const META_KEYS = ['migration_005_hash'];

function backupDir(root, label) {
  return path.join(root, 'docs', '.pv-backup', label);
}

function listSnapshots(root) {
  const base = path.join(root, 'docs', '.pv-backup');
  if (!fs.existsSync(base)) return [];
  return fs
    .readdirSync(base)
    .filter((name) => {
      const dir = path.join(base, name);
      if (!fs.statSync(dir).isDirectory()) return false;
      // Only list SQL-aware snapshots (those with a manifest.json + sql/
      // subdirectory). The pre-existing `backup.js` snapshots (e.g.
      // `pre-005-ingest-sdlc-status/`) are flat-file copies and are not
      // restorable by `pv:rollback`.
      return fs.existsSync(path.join(dir, 'manifest.json')) && fs.existsSync(path.join(dir, 'sql'));
    })
    .sort();
}

function resolveLatest(root) {
  const all = listSnapshots(root);
  if (!all.length) return null;
  return all[all.length - 1];
}

function timestampLabel(now = new Date()) {
  // 2026-05-21T13-14-15-678Z — filesystem-safe, lexically sortable.
  return now.toISOString().replace(/[:.]/g, '-');
}

/**
 * Capture a full snapshot of SDLC state into docs/.pv-backup/<label>/.
 * Returns { dir, label, counts }.
 */
function capture({ root, label, repo }) {
  const dir = backupDir(root, label);
  fs.mkdirSync(path.join(dir, 'sql'), { recursive: true });

  // SQL rows
  const counts = {};
  for (const table of SQL_TABLES) {
    const rows = repo.index.prepare(`SELECT * FROM ${table} ORDER BY rowid`).all();
    counts[table] = rows.length;
    fs.writeFileSync(path.join(dir, 'sql', `${table}.json`), JSON.stringify(rows, null, 2) + '\n');
  }

  // meta_status — only the keys this snapshot cares about (full table would
  // also include schema_version, which is managed by applySchemaMigrations
  // and must not be restored from a snapshot).
  const meta = {};
  for (const key of META_KEYS) {
    const row = repo.index.prepare('SELECT value FROM meta_status WHERE key=?').get(key);
    meta[key] = row ? row.value : null;
  }
  fs.writeFileSync(path.join(dir, 'sql', 'meta_status.json'), JSON.stringify(meta, null, 2) + '\n');

  // JSON mirror — copy as-is for human review.
  const jsonPath = path.join(root, 'docs', 'sdlc-status.json');
  if (fs.existsSync(jsonPath)) {
    fs.copyFileSync(jsonPath, path.join(dir, 'sdlc-status.json'));
  }

  const manifest = {
    createdAt: new Date().toISOString(),
    label,
    counts,
    metaKeysCaptured: META_KEYS,
  };
  fs.writeFileSync(path.join(dir, 'manifest.json'), JSON.stringify(manifest, null, 2) + '\n');

  return { dir, label, counts };
}

/**
 * Read a snapshot's contents into memory.
 * Throws if the snapshot is missing or malformed.
 */
function readSnapshot({ root, label }) {
  const dir = backupDir(root, label);
  if (!fs.existsSync(dir)) {
    throw new Error(`Snapshot not found: ${label} (looked in ${dir})`);
  }
  const out = { dir, label, sql: {}, meta: {}, manifest: null, mirror: null };
  for (const table of SQL_TABLES) {
    const file = path.join(dir, 'sql', `${table}.json`);
    if (!fs.existsSync(file)) throw new Error(`Corrupt snapshot ${label}: missing sql/${table}.json`);
    try {
      out.sql[table] = JSON.parse(fs.readFileSync(file, 'utf8'));
    } catch (e) {
      throw new Error(`Corrupt snapshot ${label}: sql/${table}.json is not valid JSON: ${e.message}`, { cause: e });
    }
    if (!Array.isArray(out.sql[table])) {
      throw new Error(`Corrupt snapshot ${label}: sql/${table}.json is not an array`);
    }
  }
  const metaFile = path.join(dir, 'sql', 'meta_status.json');
  if (!fs.existsSync(metaFile)) throw new Error(`Corrupt snapshot ${label}: missing sql/meta_status.json`);
  try {
    out.meta = JSON.parse(fs.readFileSync(metaFile, 'utf8'));
  } catch (e) {
    throw new Error(`Corrupt snapshot ${label}: sql/meta_status.json is not valid JSON: ${e.message}`, { cause: e });
  }
  const manifestFile = path.join(dir, 'manifest.json');
  if (fs.existsSync(manifestFile)) {
    try {
      out.manifest = JSON.parse(fs.readFileSync(manifestFile, 'utf8'));
    } catch (e) {
      throw new Error(`Corrupt snapshot ${label}: manifest.json is not valid JSON: ${e.message}`, { cause: e });
    }
  }
  const mirrorFile = path.join(dir, 'sdlc-status.json');
  if (fs.existsSync(mirrorFile)) {
    try {
      out.mirror = JSON.parse(fs.readFileSync(mirrorFile, 'utf8'));
    } catch (e) {
      throw new Error(`Corrupt snapshot ${label}: sdlc-status.json is not valid JSON: ${e.message}`, { cause: e });
    }
  }
  return out;
}

/**
 * Restore SQL state from a parsed snapshot, inside a single transaction.
 * Does NOT touch the JSON mirror — the caller re-renders it from SQL.
 */
function restoreSqlInto({ snapshot, repo }) {
  const db = repo.index;
  // NOTE: `repo.index.transaction(fn)` (see index-datastore.js) immediately
  // invokes `fn` inside BEGIN/COMMIT and returns undefined — it does NOT
  // return a callable like raw better-sqlite3 does. So we don't call the
  // result.
  db.transaction(() => {
    // Order doesn't matter (no FKs between these three tables), but we go
    // in dependency-friendly order anyway.
    for (const table of SQL_TABLES) {
      db.prepare(`DELETE FROM ${table}`).run();
      const rows = snapshot.sql[table];
      if (!rows.length) continue;
      const cols = Object.keys(rows[0]);
      const placeholders = cols.map(() => '?').join(',');
      const insert = db.prepare(`INSERT INTO ${table} (${cols.join(',')}) VALUES (${placeholders})`);
      for (const row of rows) {
        insert.run(...cols.map((c) => row[c]));
      }
    }
    // meta_status: upsert the captured keys; remove the row if the snapshot
    // captured a null (meaning the key did not exist at snapshot time).
    for (const [key, value] of Object.entries(snapshot.meta)) {
      if (value === null || value === undefined) {
        db.prepare('DELETE FROM meta_status WHERE key=?').run(key);
      } else {
        db.prepare(
          `INSERT INTO meta_status(key,value) VALUES(?, ?)
           ON CONFLICT(key) DO UPDATE SET value=excluded.value`,
        ).run(key, value);
      }
    }
  });
}

module.exports = {
  SQL_TABLES,
  META_KEYS,
  backupDir,
  listSnapshots,
  resolveLatest,
  timestampLabel,
  capture,
  readSnapshot,
  restoreSqlInto,
};
