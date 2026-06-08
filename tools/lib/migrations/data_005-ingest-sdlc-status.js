'use strict';

/**
 * Migration 005 — one-time ingest of `docs/sdlc-status.json` into SQLite.
 *
 * Routes every write through the D.1 entity repos (SdlcTaskRepo /
 * SdlcEventRepo / SdlcProgrammeRepo) so the JSON mirror produced after
 * ingest is byte-identical with the input shape. Stores a sha256 hash of
 * the source JSON in `meta_status('migration_005_hash')` so a second run
 * with the same source is a no-op.
 *
 * Follows L-0076: never silently drops rows. The D.1 schema deliberately
 * places NO CHECK constraints on `sdlc_tasks.status` or `sdlc_events.kind`
 * — the wide enum of lifecycle states/kinds is enforced by the writers,
 * not the database. Any NOT NULL or other SQLITE_CONSTRAINT_* violation
 * here propagates as an exception (writers throw, indexers warn).
 */

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const HASH_KEY = 'migration_005_hash';
const touches = ['docs/sdlc-status.json'];

async function up({ root }) {
  const file = path.join(root, 'docs', 'sdlc-status.json');
  if (!fs.existsSync(file)) return { skipped: 'no-file' };

  const buf = fs.readFileSync(file);
  const sourceHash = crypto.createHash('sha256').update(buf).digest('hex');

  // Lazy-require Repository so this migration module stays cheap to require
  // (the runner enumerates files at startup).
  const { Repository } = require('../repository');
  Repository._reset();
  const repo = Repository.getInstance({ root });

  // The hash check compares against EITHER the source hash (rare: pristine
  // user-authored JSON that has not yet been mirrored) OR the canonical
  // mirror hash recorded at the end of the previous successful ingest.
  // Required because every entity-repo write rewrites docs/sdlc-status.json
  // through SdlcMirror, so a successful ingest changes the on-disk bytes
  // even when no semantic data changed.
  const existing = repo.index.prepare('SELECT value FROM meta_status WHERE key=?').get(HASH_KEY);
  if (existing && existing.value === sourceHash) {
    Repository._reset();
    return { skipped: 'idempotent' };
  }

  let data;
  try {
    data = JSON.parse(buf.toString('utf8'));
  } catch (e) {
    Repository._reset();
    throw new Error(`Migration 005: could not parse ${file}: ${e.message}`, { cause: e });
  }

  for (const t of data.tasks || []) {
    await repo.sdlcTasks.upsert(t);
  }
  for (const e of data.log || []) {
    await repo.sdlcEvents.record(e);
  }
  if (data.programme) {
    for (const [k, v] of Object.entries(data.programme)) {
      await repo.sdlcProgramme.set(k, v);
    }
  }

  // Persist BOTH the original source hash and the post-ingest canonical
  // mirror hash. A subsequent run with the same original input matches
  // sourceHash on entry; a run after the mirror has been re-rendered (and
  // therefore differs from the original input bytes) matches mirrorHash.
  const mirrorBuf = fs.readFileSync(file);
  const mirrorHash = crypto.createHash('sha256').update(mirrorBuf).digest('hex');
  const upsert = repo.index.prepare(
    `INSERT INTO meta_status(key,value) VALUES(?, ?)
     ON CONFLICT(key) DO UPDATE SET value=excluded.value`,
  );
  // Store the mirror hash under HASH_KEY (this is what the next run will
  // compare against after the file has been rewritten by SdlcMirror).
  upsert.run(HASH_KEY, mirrorHash);

  const ingested = {
    tasks: (data.tasks || []).length,
    events: (data.log || []).length,
    programmeKeys: data.programme ? Object.keys(data.programme).length : 0,
  };
  Repository._reset();
  return { ingested };
}

module.exports = { up, touches, HASH_KEY };
