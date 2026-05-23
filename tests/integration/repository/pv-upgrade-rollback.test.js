'use strict';

/**
 * Phase D Task D.8 (US-0239 / TASK-0064) — pv:upgrade + pv:rollback round trip.
 *
 * AC-0934..AC-0937. Fixture-driven, modelled on D.7's
 * live-dashboard-parity.test.js (same temp-root pattern, same Repository._reset()
 * choreography for cross-process simulation).
 */

const fs = require('fs');
const os = require('os');
const path = require('path');

const { Repository } = require('../../../tools/lib/repository');
const { SdlcMirror } = require('../../../tools/lib/repository/sdlc-mirror');
const snapshotLib = require('../../../tools/lib/migrations/sdlc-snapshot');
const upgrade = require('../../../tools/pv-upgrade');
const rollback = require('../../../tools/pv-rollback');

const SQL_OWNED_KEYS = ['tasks', 'log', 'programme'];

function mkRoot() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'd8-pv-'));
  fs.mkdirSync(path.join(root, 'docs'), { recursive: true });
  // Minimal package.json so the migration runner can read the version.
  fs.writeFileSync(path.join(root, 'package.json'), JSON.stringify({ name: 't', version: '1.0.0' }));
  return root;
}

function seedJson(root) {
  fs.writeFileSync(
    path.join(root, 'docs', 'sdlc-status.json'),
    JSON.stringify(
      {
        tasks: [
          { id: 'task-a', storyId: 'US-0001', agent: 'Forge', status: 'todo' },
          { id: 'task-b', storyId: 'US-0001', agent: 'Pixel', status: 'in_progress' },
        ],
        log: [
          { ts: '2026-05-21T00:00:00Z', kind: 'log', storyId: 'US-0001', agent: 'Forge', message: 'start' },
          { ts: '2026-05-21T01:00:00Z', kind: 'log', storyId: 'US-0001', agent: 'Pixel', message: 'pick up' },
        ],
        programme: { stories: { 'US-0001': { status: 'Planned' } } },
      },
      null,
      2,
    ),
  );
}

function freshRender(repo) {
  return new SdlcMirror({ root: repo.root, index: repo.index })._renderFromSql();
}

function projectSqlOwned(obj) {
  const out = {};
  for (const k of SQL_OWNED_KEYS) if (k in obj) out[k] = obj[k];
  return out;
}

function runCli(mod, argv) {
  const out = [];
  return mod.main({ argv, stdout: (s) => out.push(s) }).then((rc) => ({ rc, stdout: out.join('\n') }));
}

describe('D.8 — pv:upgrade + pv:rollback', () => {
  afterEach(() => Repository._reset());

  test('AC-0934/0936/0937: upgrade → mutate → rollback round trip restores exact SQL + mirror state', async () => {
    const root = mkRoot();
    seedJson(root);

    // (1) Upgrade. AC-0934 lists pending; AC-0936 snapshots into docs/.pv-backup/.
    const up1 = await runCli(upgrade, ['--root', root]);
    expect(up1.rc).toBe(0);
    expect(up1.stdout).toMatch(
      /2 pending migration\(s\): data_005-ingest-sdlc-status, data_006-ingest-legacy-programme/,
    );
    expect(up1.stdout).toMatch(/success — mirror matches SQL/);

    // Snapshot directory exists with manifest + sql/ files.
    const snaps = snapshotLib.listSnapshots(root);
    expect(snaps.length).toBe(1);
    const preUpDir = path.join(root, 'docs', '.pv-backup', snaps[0]);
    expect(fs.existsSync(path.join(preUpDir, 'manifest.json'))).toBe(true);
    expect(fs.existsSync(path.join(preUpDir, 'sql', 'sdlc_tasks.json'))).toBe(true);
    expect(fs.existsSync(path.join(preUpDir, 'sql', 'meta_status.json'))).toBe(true);

    // Capture a post-upgrade snapshot manually — this is the target of the
    // rollback. (pv:upgrade only takes pre-snapshots; an explicit
    // post-upgrade snapshot is the natural "save point".)
    Repository._reset();
    let repo = Repository.getInstance({ root });
    const postUp = snapshotLib.capture({ root, label: 'post-upgrade', repo });
    expect(postUp.counts.sdlc_tasks).toBe(2);
    expect(postUp.counts.sdlc_events).toBe(2);

    // Mutate post-upgrade state: add an event + a task.
    await repo.sdlcEvents.record({
      ts: '2026-05-22T00:00:00Z',
      kind: 'log',
      storyId: 'US-0001',
      agent: 'Lens',
      message: 'post-upgrade write',
    });
    await repo.sdlcTasks.upsert({ id: 'task-c', storyId: 'US-0001', agent: 'Lens', status: 'todo' });
    expect(repo.index.prepare('SELECT COUNT(*) as n FROM sdlc_tasks').get().n).toBe(3);
    expect(repo.index.prepare('SELECT COUNT(*) as n FROM sdlc_events').get().n).toBe(3);

    const postMutateMirror = freshRender(repo);
    Repository._reset();

    // (2) Rollback to post-upgrade.
    const rb = await runCli(rollback, ['--root', root, '--to', 'post-upgrade']);
    expect(rb.rc).toBe(0);
    expect(rb.stdout).toMatch(/success — SQL \+ JSON mirror restored/);

    // SQL state matches the post-upgrade snapshot exactly.
    Repository._reset();
    repo = Repository.getInstance({ root });
    expect(repo.index.prepare('SELECT COUNT(*) as n FROM sdlc_tasks').get().n).toBe(2);
    expect(repo.index.prepare('SELECT COUNT(*) as n FROM sdlc_events').get().n).toBe(3 - 1);
    expect(repo.index.prepare("SELECT * FROM sdlc_tasks WHERE id='task-c'").get()).toBeUndefined();

    // JSON mirror SQL-owned keys are byte-identical to a fresh SQL render
    // and to the snapshotted JSON (on the same keys).
    const onDisk = JSON.parse(fs.readFileSync(path.join(root, 'docs', 'sdlc-status.json'), 'utf8'));
    const rendered = freshRender(repo);
    expect(JSON.stringify(projectSqlOwned(onDisk), null, 2)).toBe(JSON.stringify(rendered, null, 2));
    // And the post-mutate mirror is provably different (no post-upgrade
    // writes survived).
    expect(JSON.stringify(projectSqlOwned(onDisk))).not.toBe(JSON.stringify(postMutateMirror));

    Repository._reset();
    fs.rmSync(root, { recursive: true, force: true });
  });

  test('AC-0934: idempotent upgrade — second run is a no-op (no new snapshot, exit 0, "no-op" stdout)', async () => {
    const root = mkRoot();
    seedJson(root);

    const up1 = await runCli(upgrade, ['--root', root]);
    expect(up1.rc).toBe(0);
    const snapsAfter1 = snapshotLib.listSnapshots(root);
    expect(snapsAfter1.length).toBe(1);

    const up2 = await runCli(upgrade, ['--root', root]);
    expect(up2.rc).toBe(0);
    expect(up2.stdout).toMatch(/no-op \(already up to date/);

    const snapsAfter2 = snapshotLib.listSnapshots(root);
    // Second upgrade did NOT take another snapshot.
    expect(snapsAfter2).toEqual(snapsAfter1);

    Repository._reset();
    fs.rmSync(root, { recursive: true, force: true });
  });

  test('AC-0935: corrupt snapshot detection — mutating sql/sdlc_tasks.json yields a non-zero exit', async () => {
    const root = mkRoot();
    seedJson(root);

    await runCli(upgrade, ['--root', root]);
    Repository._reset();
    const repo = Repository.getInstance({ root });
    const cap = snapshotLib.capture({ root, label: 'tamper', repo });
    Repository._reset();

    // Tamper.
    fs.writeFileSync(path.join(cap.dir, 'sql', 'sdlc_tasks.json'), '{this is not json');

    const rb = await runCli(rollback, ['--root', root, '--to', 'tamper']);
    expect(rb.rc).not.toBe(0);
    expect(rb.stdout).toMatch(/Corrupt snapshot/);

    Repository._reset();
    fs.rmSync(root, { recursive: true, force: true });
  });

  test('refuse-to-clobber — pv:rollback aborts if docs/sdlc-status.json diverges from SQL state', async () => {
    const root = mkRoot();
    seedJson(root);

    await runCli(upgrade, ['--root', root]);
    Repository._reset();
    const repo = Repository.getInstance({ root });
    snapshotLib.capture({ root, label: 'before-clobber', repo });
    Repository._reset();

    // Hand-edit the mirror so its SQL-owned keys no longer match SQL.
    const sdlcPath = path.join(root, 'docs', 'sdlc-status.json');
    const onDisk = JSON.parse(fs.readFileSync(sdlcPath, 'utf8'));
    onDisk.tasks = { 'task-fake': { id: 'task-fake', storyId: 'US-9999', status: 'todo' } };
    fs.writeFileSync(sdlcPath, JSON.stringify(onDisk, null, 2));

    const rb = await runCli(rollback, ['--root', root, '--to', 'before-clobber']);
    expect(rb.rc).not.toBe(0);
    expect(rb.stdout).toMatch(/refusing — docs\/sdlc-status\.json differs from SQL state/);

    Repository._reset();
    fs.rmSync(root, { recursive: true, force: true });
  });

  test('--dry-run purity — pv:rollback --dry-run leaves filesystem + SQL unchanged', async () => {
    const root = mkRoot();
    seedJson(root);

    await runCli(upgrade, ['--root', root]);
    Repository._reset();
    let repo = Repository.getInstance({ root });
    snapshotLib.capture({ root, label: 'dry-target', repo });

    // Add a post-upgrade event we expect to STILL be there after --dry-run.
    await repo.sdlcEvents.record({
      ts: '2026-05-23T00:00:00Z',
      kind: 'log',
      storyId: 'US-0001',
      agent: 'X',
      message: 'survive',
    });
    const eventsBefore = repo.index.prepare('SELECT COUNT(*) as n FROM sdlc_events').get().n;
    const jsonBefore = fs.readFileSync(path.join(root, 'docs', 'sdlc-status.json'), 'utf8');
    Repository._reset();

    const rb = await runCli(rollback, ['--root', root, '--to', 'dry-target', '--dry-run']);
    expect(rb.rc).toBe(0);
    expect(rb.stdout).toMatch(/--dry-run set; not mutating/);

    // SQL + JSON unchanged.
    Repository._reset();
    repo = Repository.getInstance({ root });
    expect(repo.index.prepare('SELECT COUNT(*) as n FROM sdlc_events').get().n).toBe(eventsBefore);
    expect(fs.readFileSync(path.join(root, 'docs', 'sdlc-status.json'), 'utf8')).toBe(jsonBefore);

    Repository._reset();
    fs.rmSync(root, { recursive: true, force: true });
  });

  test('pv:rollback with no args lists available snapshots', async () => {
    const root = mkRoot();
    seedJson(root);
    await runCli(upgrade, ['--root', root]);
    Repository._reset();
    const repo = Repository.getInstance({ root });
    snapshotLib.capture({ root, label: 'alpha', repo });
    snapshotLib.capture({ root, label: 'beta', repo });
    Repository._reset();

    const rb = await runCli(rollback, ['--root', root]);
    expect(rb.rc).toBe(0);
    expect(rb.stdout).toMatch(/available snapshots/);
    expect(rb.stdout).toMatch(/alpha/);
    expect(rb.stdout).toMatch(/beta/);

    Repository._reset();
    fs.rmSync(root, { recursive: true, force: true });
  });
});
