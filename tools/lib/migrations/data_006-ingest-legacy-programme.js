'use strict';

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const HASH_KEY = 'migration_006_hash';
const touches = ['docs/sdlc-status.json'];

const LEGACY_KEYS = [
  'agents',
  'metrics',
  'stories',
  'epics',
  'phases',
  'cycles',
  'currentPhase',
  'githubStatus',
  'project',
];

async function up({ root }) {
  const file = path.join(root, 'docs', 'sdlc-status.json');
  if (!fs.existsSync(file)) return { skipped: 'no-file' };
  const { Repository } = require('../repository');
  Repository._reset();
  const repo = Repository.getInstance({ root });
  try {
    const buf = fs.readFileSync(file);
    const currentHash = crypto.createHash('sha256').update(buf).digest('hex');
    const existing = repo.index.prepare('SELECT value FROM meta_status WHERE key=?').get(HASH_KEY);
    if (existing && existing.value === currentHash) return { skipped: 'idempotent' };
    const programmeFromSql = repo.sdlcProgramme.all();
    let data;
    try {
      data = JSON.parse(buf.toString('utf8'));
    } catch (e) {
      throw new Error(`Migration 006: could not parse ${file}: ${e.message}`, { cause: e });
    }
    let ingested = 0;
    const insert = repo.index.prepare(
      `INSERT INTO sdlc_programme(key,value_json) VALUES(?,?)
       ON CONFLICT(key) DO UPDATE SET value_json=excluded.value_json`,
    );

    // Single explicit transaction. On any error during the loop, ROLLBACK
    // and rethrow so the runner does NOT append our id to appliedMigrations
    // — the next pv:upgrade retries cleanly. Bypassing SdlcProgrammeRepo.set()
    // means no per-key mirror write touches disk before commit.
    repo.index.exec('BEGIN');
    try {
      for (const k of LEGACY_KEYS) {
        const inJson = Object.prototype.hasOwnProperty.call(data, k);
        const inProgramme = programmeFromSql[k] !== undefined;
        if (inJson && !inProgramme) {
          // State B → C: legacy top-level row absent from SQL. Ingest.
          insert.run(k, JSON.stringify(data[k]));
          ingested++;
        } else if (inJson && inProgramme) {
          // State C: both shapes populated. SQL is canonical — never
          // overwrite. Divergence indicates manual tampering or a stale
          // legacy write that beat D.4 to the JSON. Log and continue.
          if (JSON.stringify(data[k]) !== JSON.stringify(programmeFromSql[k])) {
            repo.warningsChannel.append({ kind: `migration_006_conflict_${k}`, key: k });
          }
        }
        // State A (!inJson, *) is the implicit no-op — nothing to do.
      }
      repo.index.exec('COMMIT');
    } catch (e) {
      repo.index.exec('ROLLBACK');
      throw e;
    }

    // After commit, render the mirror exactly once so the on-disk JSON
    // reflects the new programme rows. Per-key mirror writes during the
    // loop would (a) read uncommitted SQL inside the txn, (b) acquire
    // the file lock 9 times, (c) break rollback semantics. One write here
    // is the only correct shape.
    if (ingested > 0) {
      await repo._sdlcMirror.write();
    }

    const mirrorBuf = fs.readFileSync(file);
    const mirrorHash = crypto.createHash('sha256').update(mirrorBuf).digest('hex');
    repo.index
      .prepare(`INSERT INTO meta_status(key,value) VALUES(?,?) ON CONFLICT(key) DO UPDATE SET value=excluded.value`)
      .run(HASH_KEY, mirrorHash);
    void LEGACY_KEYS;
    return { ingested };
  } finally {
    Repository._reset();
  }
}

module.exports = { up, touches, HASH_KEY };
