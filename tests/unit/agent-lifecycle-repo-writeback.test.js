'use strict';

// US-0234 / TASK-0058 (D.3) — assert that tools/agent-lifecycle.js writes
// through the D.1 entity repos (no direct fs.writeFileSync on
// docs/sdlc-status.json) and that:
//   1. A happy-path start → done lifecycle transition lands a task row +
//      two events in SQL and the JSON mirror.
//   2. A constraint violation surfaces as a thrown exception — writers
//      throw, indexers warn (AC-1013). The CLI must NOT swallow it.
//   3. The on-disk JSON mirror is a pure function of the SQL state after
//      the writer runs (byte-identity round-trip).

const fs = require('fs');
const path = require('path');
const os = require('os');

const Lifecycle = require('../../tools/agent-lifecycle');
const { Repository } = require('../../tools/lib/repository');
const { SdlcMirror } = require('../../tools/lib/repository/sdlc-mirror');

function mkRoot(prefix = 'alc-repo-') {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), prefix));
  fs.mkdirSync(path.join(root, 'docs'), { recursive: true });
  return root;
}

describe('agent-lifecycle — repository write-through (US-0234 / TASK-0058)', () => {
  beforeEach(() => Repository._reset());
  afterEach(() => Repository._reset());

  test('AC-0919 hard gate — tools/agent-lifecycle.js does not call fs.writeFileSync on sdlc-status.json', () => {
    const source = fs.readFileSync(path.join(__dirname, '..', '..', 'tools', 'agent-lifecycle.js'), 'utf8');
    expect(source).not.toMatch(/fs\.writeFileSync\([^)]*sdlc-status/);
  });

  test('AC-0920 — start upserts task and records task-start event in one logical transaction', async () => {
    const root = mkRoot();
    try {
      const sdlcPath = path.join(root, 'docs', 'sdlc-status.json');
      const out = [];
      const rc = await Lifecycle.dispatch(
        { cmd: 'start', story: 'US-0234', agent: 'Forge', model: 'sonnet', task: 'do D.3' },
        { sdlcPath, root, skipRegen: true, stdout: (s) => out.push(s) },
      );
      expect(rc).toBe(0);
      const taskId = out[0];

      // SQL rows persisted via repos (not direct JSON writes).
      const repo = Repository.getInstance({ root });
      const taskRow = repo.sdlcTasks.get(taskId);
      expect(taskRow).toBeTruthy();
      expect(taskRow.status).toBe('in_progress');
      expect(taskRow.agent).toBe('Forge');
      expect(taskRow.story_id).toBe('US-0234');
      expect(taskRow.description).toBe('do D.3');

      const events = repo.sdlcEvents.list({ storyId: 'US-0234' });
      expect(events).toHaveLength(1);
      expect(events[0].kind).toBe('task-start');

      // JSON mirror is in sync.
      const mirror = JSON.parse(fs.readFileSync(sdlcPath, 'utf8'));
      expect(mirror.tasks[taskId].state).toBe('in_progress');
      expect(mirror.log).toHaveLength(1);
    } finally {
      fs.rmSync(root, { recursive: true, force: true });
    }
  });

  test('AC-0921 — done upserts status/completedAt/summary/headSha and records task-done event', async () => {
    const root = mkRoot();
    try {
      const sdlcPath = path.join(root, 'docs', 'sdlc-status.json');
      const out = [];
      await Lifecycle.dispatch(
        { cmd: 'start', story: 'US-0234', agent: 'Forge', task: 't' },
        { sdlcPath, root, skipRegen: true, stdout: (s) => out.push(s) },
      );
      const taskId = out[0];

      const rc = await Lifecycle.dispatch(
        { cmd: 'done', taskId, summary: 'Implemented D.3 [sha:deadbee]' },
        { sdlcPath, root, skipRegen: true },
      );
      expect(rc).toBe(0);

      const repo = Repository.getInstance({ root });
      const taskRow = repo.sdlcTasks.get(taskId);
      expect(taskRow.status).toBe('done');
      expect(taskRow.summary).toBe('Implemented D.3');
      expect(taskRow.head_sha).toBe('deadbee');
      expect(typeof taskRow.completed_at).toBe('number');

      // Both events (start + done) are appended to sdlc_events.
      const kinds = repo.sdlcEvents.list({ storyId: 'US-0234' }).map((r) => r.kind);
      expect(kinds).toEqual(['task-start', 'task-done']);
    } finally {
      fs.rmSync(root, { recursive: true, force: true });
    }
  });

  // AC-1013 — writers throw, indexers warn. A constraint violation
  // (here: a task whose payload would require persisting a malformed
  // record) must surface as a non-zero exit code and stderr line, not be
  // silently dropped. We force this by attempting `done` on a task id
  // that has no SQL row — LifeState._requireTask throws and the CLI
  // must propagate it.
  test('AC-1013 — done on an unknown task id propagates the error (writer throws, CLI exits 1)', async () => {
    const root = mkRoot();
    try {
      const sdlcPath = path.join(root, 'docs', 'sdlc-status.json');
      const errs = [];
      const rc = await Lifecycle.dispatch(
        { cmd: 'done', taskId: 'task-does-not-exist', summary: 'nope [sha:none]' },
        { sdlcPath, root, skipRegen: true, stderr: (s) => errs.push(s) },
      );
      expect(rc).toBe(1);
      expect(errs.join(' ')).toMatch(/not found/);
    } finally {
      fs.rmSync(root, { recursive: true, force: true });
    }
  });

  // Round-trip / byte-identity: after the lifecycle CLI runs, the on-disk
  // JSON mirror equals what we get by re-rendering from SQL with a fresh
  // SdlcMirror. This is the same invariant D.2's ingest asserts — proving
  // the writer route through the repo and never patches JSON in place.
  test('byte-identity: on-disk JSON mirror == SQL→JSON re-render after writer runs', async () => {
    const root = mkRoot();
    try {
      const sdlcPath = path.join(root, 'docs', 'sdlc-status.json');
      const out = [];
      await Lifecycle.dispatch(
        { cmd: 'start', story: 'US-0234', agent: 'Forge', task: 'roundtrip' },
        { sdlcPath, root, skipRegen: true, stdout: (s) => out.push(s) },
      );
      const taskId = out[0];
      await Lifecycle.dispatch(
        { cmd: 'blocked', taskId, reason: 'cannot find schema' },
        { sdlcPath, root, skipRegen: true, stdout: () => {} },
      );
      await Lifecycle.dispatch(
        { cmd: 'resolve', taskId, action: 'MORE_CONTEXT', note: 'added' },
        { sdlcPath, root, skipRegen: true },
      );
      await Lifecycle.dispatch(
        { cmd: 'done', taskId, summary: 'finished [sha:abc1234]' },
        { sdlcPath, root, skipRegen: true },
      );

      const onDisk = fs.readFileSync(sdlcPath, 'utf8');
      const repo = Repository.getInstance({ root });
      const fresh = new SdlcMirror({ root, index: repo.index });
      const expected = JSON.stringify(fresh._renderFromSql(), null, 2);
      expect(onDisk).toBe(expected);

      // And the semantic content is intact: every event survived (no
      // silent drops — L-0076).
      const kinds = repo.sdlcEvents.list({ storyId: 'US-0234' }).map((r) => r.kind);
      expect(kinds).toEqual(['task-start', 'task-blocked', 'task-resolved', 'task-done']);
    } finally {
      fs.rmSync(root, { recursive: true, force: true });
    }
  });
});
