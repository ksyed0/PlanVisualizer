#!/usr/bin/env node
'use strict';

/**
 * pv:rollback — restore PlanVisualizer state from a docs/.pv-backup snapshot.
 *
 * Story: US-0239 (EPIC-0039) / TASK-0064.
 * ACs: AC-0935 (--to <label> restores; without --to lists available backups).
 *
 * Restore order (matters):
 *   1. Refuse to clobber uncommitted writes — if `docs/sdlc-status.json` on
 *      disk differs from a freshly-rendered mirror at rollback start, exit
 *      non-zero with a clear message.
 *   2. Read + validate the snapshot (corrupt snapshot → exit non-zero).
 *   3. Restore the three SQL tables inside one transaction
 *      (DELETE + INSERT from snapshot rows), then restore the captured
 *      `meta_status` rows.
 *   4. Re-render `docs/sdlc-status.json` from the restored SQL via
 *      `SdlcMirror._renderFromSql()`. The snapshot's JSON copy is NOT
 *      re-used as the canonical state — SQL is the source of truth in
 *      Phase D, so the mirror is regenerated.
 *   5. Verify byte-identity: the freshly-rendered SQL-owned keys must match
 *      the snapshot's JSON copy on the same keys. Mismatch → fail loudly.
 *
 * Usage:
 *   npm run pv:rollback                       # list available snapshots
 *   npm run pv:rollback -- --to latest        # restore the newest snapshot
 *   npm run pv:rollback -- --to <label>       # restore a specific snapshot
 *   npm run pv:rollback -- --to <label> --dry-run   # print the plan only
 */

const fs = require('fs');
const path = require('path');

const { Repository } = require('./lib/repository');
const { SdlcMirror } = require('./lib/repository/sdlc-mirror');
const snapshotLib = require('./lib/migrations/sdlc-snapshot');

const SQL_OWNED_KEYS = ['tasks', 'log', 'programme'];

function parseArgs(argv) {
  const opts = { to: null, dryRun: false, root: process.cwd() };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--to') opts.to = argv[++i];
    else if (a === '--dry-run') opts.dryRun = true;
    else if (a === '--root') opts.root = path.resolve(argv[++i]);
    else if (a === '--help' || a === '-h') opts.help = true;
  }
  return opts;
}

function readMirrorOnDisk(root) {
  const p = path.join(root, 'docs', 'sdlc-status.json');
  if (!fs.existsSync(p)) return null;
  try {
    return JSON.parse(fs.readFileSync(p, 'utf8'));
  } catch {
    return null;
  }
}

function projectSqlOwned(obj) {
  if (!obj) return {};
  const out = {};
  for (const k of SQL_OWNED_KEYS) if (k in obj) out[k] = obj[k];
  return out;
}

function freshRender(repo) {
  return new SdlcMirror({ root: repo.root, index: repo.index })._renderFromSql();
}

function helpText() {
  return [
    'pv:rollback — restore PlanVisualizer state from a docs/.pv-backup snapshot',
    '',
    'Usage: npm run pv:rollback -- [--to LABEL|latest] [--dry-run]',
    '',
    'Without --to, lists available snapshots.',
  ].join('\n');
}

async function main({ argv = process.argv.slice(2), stdout = (s) => process.stdout.write(s + '\n') } = {}) {
  const opts = parseArgs(argv);
  if (opts.help) {
    stdout(helpText());
    return 0;
  }
  const root = opts.root;

  if (!opts.to) {
    const all = snapshotLib.listSnapshots(root);
    if (all.length === 0) {
      stdout('pv:rollback: no snapshots found under docs/.pv-backup/');
      return 0;
    }
    stdout('pv:rollback: available snapshots (most recent last):');
    for (const label of all) stdout(`  ${label}`);
    stdout('');
    stdout('Re-run with --to <label> or --to latest to restore.');
    return 0;
  }

  let label = opts.to;
  if (label === 'latest') {
    label = snapshotLib.resolveLatest(root);
    if (!label) {
      stdout('pv:rollback: --to latest requested but no snapshots exist.');
      return 2;
    }
  }

  // (1) Refuse to clobber. Open the repo, compare on-disk JSON's SQL-owned
  //     keys to a fresh SQL render. If they diverge, a writer is mid-flight
  //     or the mirror is stale — bail.
  Repository._reset();
  let repo = Repository.getInstance({ root });
  const onDiskBefore = readMirrorOnDisk(root);
  if (onDiskBefore) {
    const renderedBefore = freshRender(repo);
    const onDiskOwned = JSON.stringify(projectSqlOwned(onDiskBefore), null, 2);
    const renderedStr = JSON.stringify(renderedBefore, null, 2);
    if (onDiskOwned !== renderedStr) {
      Repository._reset();
      stdout('pv:rollback: refusing — docs/sdlc-status.json differs from SQL state.');
      stdout('  This means a writer is mid-flight or the mirror is stale.');
      stdout('  Run a writer-quiescent command (or delete the JSON to regenerate) then retry.');
      return 4;
    }
  }

  // (2) Read snapshot. readSnapshot throws on missing/malformed files.
  let snapshot;
  try {
    snapshot = snapshotLib.readSnapshot({ root, label });
  } catch (e) {
    Repository._reset();
    stdout(`pv:rollback: ${e.message}`);
    return 5;
  }

  stdout(`pv:rollback: restoring snapshot ${label}`);
  stdout(
    `  events=${snapshot.sql.sdlc_events.length}, ` +
      `tasks=${snapshot.sql.sdlc_tasks.length}, ` +
      `programme=${snapshot.sql.sdlc_programme.length}`,
  );

  if (opts.dryRun) {
    stdout('pv:rollback: --dry-run set; not mutating.');
    Repository._reset();
    return 0;
  }

  // (3) Restore SQL inside one transaction.
  snapshotLib.restoreSqlInto({ snapshot, repo });

  // (4) Re-render JSON mirror from restored SQL.
  await repo._sdlcMirror.write();

  // (5) Verify byte-identity between freshly-rendered SQL-owned keys and the
  //     snapshot's JSON copy on the same keys. If the snapshot was authored
  //     by `capture()` correctly, these MUST match — Phase D guarantees the
  //     JSON mirror is a pure function of SQL.
  if (snapshot.mirror) {
    const renderedAfter = freshRender(repo);
    const snapshotOwned = JSON.stringify(projectSqlOwned(snapshot.mirror), null, 2);
    const renderedStr = JSON.stringify(renderedAfter, null, 2);
    if (snapshotOwned !== renderedStr) {
      Repository._reset();
      stdout('pv:rollback: FAILED — restored SQL does not match snapshot JSON mirror.');
      stdout('  The snapshot may be corrupt or was authored against a different schema.');
      return 6;
    }
  }
  Repository._reset();

  stdout('pv:rollback: success — SQL + JSON mirror restored from snapshot.');
  return 0;
}

if (require.main === module) {
  main()
    .then((rc) => {
      process.exit(rc);
    })
    .catch((err) => {
      process.stderr.write(`pv:rollback: error — ${err.stack || err.message}\n`);
      process.exit(1);
    });
}

module.exports = { main, parseArgs };
