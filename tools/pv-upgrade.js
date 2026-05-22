#!/usr/bin/env node
'use strict';

/**
 * pv:upgrade — forward migration / first-run safety for Phase D state.
 *
 * Story: US-0239 (EPIC-0039) / TASK-0064.
 * ACs: AC-0934 (refuses dirty tree unless --force, lists pending),
 *      AC-0936 (snapshots touched state into docs/.pv-backup/pre-<id>/).
 *
 * Snapshot layout: see `docs/architecture/pv-backup-format.md`.
 *
 * What it does, in order:
 *   1. Detects pending migrations (`tools/lib/migrations/index.js#pending`).
 *      If none and the on-disk JSON mirror already matches a fresh SQL render,
 *      exits 0 with "no-op".
 *   2. Refuses to run if `git status --porcelain` reports a dirty tree, unless
 *      --force is passed.
 *   3. Captures a full snapshot (SQL tables + meta_status + JSON mirror) into
 *      `docs/.pv-backup/pre-upgrade-<ISO-timestamp>/` BEFORE applying any
 *      migrations.
 *   4. Applies each pending migration via the existing `run()` runner. The
 *      idempotency contract is delegated to the migration itself (Migration
 *      005 checks `meta_status('migration_005_hash')`).
 *   5. Verifies post-migration byte-identity: the SQL-owned keys on the
 *      on-disk JSON mirror must equal a fresh `SdlcMirror._renderFromSql()`.
 *      A mismatch is a fail-loud condition (exit non-zero).
 *
 * Idempotency: a second `pv:upgrade` invocation with no pending migrations
 * and the mirror already in sync skips snapshot capture and exits 0 with
 * "no-op (already up to date)".
 *
 * Flags:
 *   --force        Override the dirty-tree refusal.
 *   --dry-run      Print the plan and exit 0 without mutating anything.
 *   --root <path>  Override repository root (default: process.cwd()).
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const { pending, run } = require('./lib/migrations');
const { Repository } = require('./lib/repository');
const { SdlcMirror } = require('./lib/repository/sdlc-mirror');
const snapshotLib = require('./lib/migrations/sdlc-snapshot');

const SQL_OWNED_KEYS = ['tasks', 'log', 'programme'];

function parseArgs(argv) {
  const opts = { force: false, dryRun: false, root: process.cwd() };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--force') opts.force = true;
    else if (a === '--dry-run') opts.dryRun = true;
    else if (a === '--root') opts.root = path.resolve(argv[++i]);
    else if (a === '--help' || a === '-h') opts.help = true;
  }
  return opts;
}

function isDirtyTree(root) {
  try {
    const out = execSync('git status --porcelain', {
      cwd: root,
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'ignore'],
    });
    // Ignore changes inside docs/.pv-backup/ (this command writes there).
    return out
      .split('\n')
      .filter(Boolean)
      .some((line) => !/docs\/\.pv-backup\//.test(line));
  } catch {
    return false; // not a git repo (test fixtures) — treat as clean
  }
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
  const mirror = new SdlcMirror({ root: repo.root, index: repo.index });
  return mirror._renderFromSql();
}

function mirrorMatchesSql(repo) {
  const onDisk = readMirrorOnDisk(repo.root);
  if (!onDisk) return false;
  const rendered = freshRender(repo);
  return JSON.stringify(projectSqlOwned(onDisk)) === JSON.stringify(rendered);
}

function helpText() {
  return [
    'pv:upgrade — apply pending PlanVisualizer migrations with snapshot safety',
    '',
    'Usage: npm run pv:upgrade -- [--force] [--dry-run]',
    '',
    'Options:',
    '  --force      Run even if the git working tree is dirty.',
    '  --dry-run    Print the plan; make no changes.',
    '  --root PATH  Repository root (default: cwd).',
  ].join('\n');
}

async function main({ argv = process.argv.slice(2), stdout = (s) => process.stdout.write(s + '\n') } = {}) {
  const opts = parseArgs(argv);
  if (opts.help) {
    stdout(helpText());
    return 0;
  }
  const root = opts.root;

  // Plan: pending migrations + whether mirror is in sync.
  const todo = pending({ root });
  // Use a Repository instance to check mirror parity. We open it before
  // running migrations because the migrations themselves call
  // `Repository._reset()` and reopen their own.
  Repository._reset();
  const repo = Repository.getInstance({ root });
  const mirrorInSync = mirrorMatchesSql(repo);
  Repository._reset();

  if (todo.length === 0 && mirrorInSync) {
    stdout('pv:upgrade: no-op (already up to date, mirror matches SQL)');
    return 0;
  }

  stdout(`pv:upgrade: ${todo.length} pending migration(s): ${todo.map((m) => m.id).join(', ') || '(none)'}`);
  if (!mirrorInSync) {
    stdout('pv:upgrade: JSON mirror is out of sync with SQL — will re-render after migrations.');
  }

  if (opts.dryRun) {
    stdout('pv:upgrade: --dry-run set; not mutating.');
    return 0;
  }

  if (isDirtyTree(root) && !opts.force) {
    stdout('pv:upgrade: refusing — git working tree is dirty. Re-run with --force to override.');
    return 2;
  }

  // Pre-flight snapshot. Label encodes timestamp so concurrent / serial runs
  // do not collide. We also keep the per-migration `pre-<id>` snapshots
  // produced by the existing runner (backup.js) for AC-0936 — they are flat
  // file copies and complement the SQL-aware snapshot we capture here.
  const label = `pre-upgrade-${snapshotLib.timestampLabel()}`;
  Repository._reset();
  const repoForSnap = Repository.getInstance({ root });
  const snap = snapshotLib.capture({ root, label, repo: repoForSnap });
  Repository._reset();
  stdout(
    `pv:upgrade: snapshot captured → ${path.relative(root, snap.dir)} ` +
      `(events=${snap.counts.sdlc_events}, tasks=${snap.counts.sdlc_tasks}, programme=${snap.counts.sdlc_programme})`,
  );

  // Run migrations. The runner records `appliedMigrations` in .pv-state.json.
  const results = await run({ root });
  if (results.length === 0) {
    stdout('pv:upgrade: no pending migrations after snapshot — checking mirror parity.');
  } else {
    for (const r of results) stdout(`pv:upgrade: applied ${r.id}`);
  }

  // Re-render and verify byte-identity. Always force a final mirror write
  // so the on-disk JSON is freshly rendered post-migration. (Migration 005
  // triggers a mirror write per upsert when it ingests data; for skipped or
  // empty migrations the JSON would otherwise stay missing/stale.)
  Repository._reset();
  const verifyRepo = Repository.getInstance({ root });
  if (!mirrorInSync || results.length > 0) {
    await verifyRepo._sdlcMirror.write();
  }
  const onDisk = readMirrorOnDisk(root);
  const rendered = freshRender(verifyRepo);
  Repository._reset();
  const onDiskOwned = JSON.stringify(projectSqlOwned(onDisk), null, 2);
  const renderedStr = JSON.stringify(rendered, null, 2);
  if (onDiskOwned !== renderedStr) {
    stdout('pv:upgrade: FAILED — post-migration mirror does NOT match fresh SQL render.');
    stdout('  This indicates a writer/mirror bug or partial write. The snapshot is preserved at:');
    stdout(`    ${path.relative(root, snap.dir)}`);
    stdout('  Run `npm run pv:rollback -- --to ' + label + '` to restore.');
    return 3;
  }

  stdout('pv:upgrade: success — mirror matches SQL post-migration.');
  return 0;
}

if (require.main === module) {
  main()
    .then((rc) => {
      process.exit(rc);
    })
    .catch((err) => {
      process.stderr.write(`pv:upgrade: error — ${err.stack || err.message}\n`);
      process.exit(1);
    });
}

module.exports = { main, parseArgs };
