'use strict';

const fs = require('fs');
const path = require('path');
const os = require('os');
const { Repository } = require('../../../tools/lib/repository');
const { SdlcMirror } = require('../../../tools/lib/repository/sdlc-mirror');

function mkRoot(prefix) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), prefix));
  fs.mkdirSync(path.join(root, 'docs'));
  return root;
}

describe('SDLC repos (US-0232)', () => {
  let root;
  let repo;

  beforeEach(() => {
    root = mkRoot('sdlc-');
    Repository._reset();
    repo = Repository.getInstance({ root });
  });

  afterEach(() => {
    Repository._reset();
    fs.rmSync(root, { recursive: true, force: true });
  });

  // AC-0912 — record + list + JSON mirror
  test('sdlcEvents.record persists a row and writes the JSON mirror', async () => {
    await repo.sdlcEvents.record({ kind: 'agent-start', storyId: 'US-0001', agent: 'Forge', ts: 1000 });
    const rows = repo.index.prepare('SELECT * FROM sdlc_events').all();
    expect(rows.length).toBe(1);
    expect(rows[0].kind).toBe('agent-start');
    expect(rows[0].story_id).toBe('US-0001');
    expect(rows[0].agent).toBe('Forge');

    const mirrorPath = path.join(root, 'docs', 'sdlc-status.json');
    expect(fs.existsSync(mirrorPath)).toBe(true);
    const j = JSON.parse(fs.readFileSync(mirrorPath, 'utf8'));
    expect(j.log.length).toBe(1);
    expect(j.log[0].kind).toBe('agent-start');
    expect(j.log[0].storyId).toBe('US-0001');
  });

  test('sdlcEvents.list filters by storyId and since', async () => {
    await repo.sdlcEvents.record({ kind: 'a', storyId: 'US-0001', ts: 100 });
    await repo.sdlcEvents.record({ kind: 'b', storyId: 'US-0002', ts: 200 });
    await repo.sdlcEvents.record({ kind: 'c', storyId: 'US-0001', ts: 300 });

    expect(repo.sdlcEvents.list({ storyId: 'US-0001' }).map((r) => r.kind)).toEqual(['a', 'c']);
    expect(repo.sdlcEvents.list({ since: 200 }).map((r) => r.kind)).toEqual(['b', 'c']);
    expect(repo.sdlcEvents.list({ storyId: 'US-0001', since: 200 }).map((r) => r.kind)).toEqual(['c']);
    expect(repo.sdlcEvents.list().length).toBe(3);
  });

  // AC-0913 — upsert merges fields, preserves unset
  test('sdlcTasks.upsert merges fields and preserves agent on partial update', async () => {
    await repo.sdlcTasks.upsert({ id: 't1', storyId: 'US-0001', agent: 'Forge', status: 'in_progress' });
    await repo.sdlcTasks.upsert({ id: 't1', status: 'done', completedAt: 2000 });

    const r = repo.index.prepare('SELECT * FROM sdlc_tasks WHERE id=?').get('t1');
    expect(r.status).toBe('done');
    expect(r.completed_at).toBe(2000);
    expect(r.agent).toBe('Forge');
    expect(r.story_id).toBe('US-0001');
  });

  test('sdlcTasks.upsert maps every FIELD_MAP key on insert', async () => {
    await repo.sdlcTasks.upsert({
      id: 't2',
      storyId: 'US-0002',
      agent: 'Forge',
      status: 'in_progress',
      startedAt: 1,
      completedAt: 2,
      planTaskIndex: 7,
      summary: 's',
      model: 'm',
      modelRationale: 'mr',
      taskReview: { ok: true },
      baseSha: 'base',
      headSha: 'head',
    });
    const r = repo.sdlcTasks.get('t2');
    expect(r).toMatchObject({
      id: 't2',
      story_id: 'US-0002',
      agent: 'Forge',
      status: 'in_progress',
      started_at: 1,
      completed_at: 2,
      plan_task_index: 7,
      summary: 's',
      model: 'm',
      model_rationale: 'mr',
      base_sha: 'base',
      head_sha: 'head',
    });
    expect(JSON.parse(r.task_review_json)).toEqual({ ok: true });
  });

  test('sdlcTasks.list filters by storyId', async () => {
    await repo.sdlcTasks.upsert({ id: 't1', storyId: 'US-0001' });
    await repo.sdlcTasks.upsert({ id: 't2', storyId: 'US-0002' });
    await repo.sdlcTasks.upsert({ id: 't3', storyId: 'US-0001' });
    expect(
      repo.sdlcTasks
        .list({ storyId: 'US-0001' })
        .map((r) => r.id)
        .sort(),
    ).toEqual(['t1', 't3']);
    expect(repo.sdlcTasks.list().length).toBe(3);
  });

  // AC-0914 — sdlcProgramme JSON value
  test('sdlcProgramme.set persists JSON value', async () => {
    await repo.sdlcProgramme.set('current_phase', { phase: 'integration' });
    const r = repo.index.prepare('SELECT * FROM sdlc_programme WHERE key=?').get('current_phase');
    expect(JSON.parse(r.value_json)).toEqual({ phase: 'integration' });
    expect(repo.sdlcProgramme.get('current_phase')).toEqual({ phase: 'integration' });
  });

  test('sdlcProgramme.set is idempotent (upsert)', async () => {
    await repo.sdlcProgramme.set('k', { v: 1 });
    await repo.sdlcProgramme.set('k', { v: 2 });
    expect(repo.sdlcProgramme.get('k')).toEqual({ v: 2 });
    expect(repo.sdlcProgramme.all()).toEqual({ k: { v: 2 } });
  });

  test('sdlcProgramme.get returns null when key missing', () => {
    expect(repo.sdlcProgramme.get('does-not-exist')).toBeNull();
  });

  // AC-0915 — file lock + re-query inside lock
  test('concurrent record() calls preserve every event (file-locked mirror)', async () => {
    await Promise.all([
      repo.sdlcEvents.record({ ts: 1, kind: 'a' }),
      repo.sdlcEvents.record({ ts: 2, kind: 'b' }),
      repo.sdlcEvents.record({ ts: 3, kind: 'c' }),
      repo.sdlcEvents.record({ ts: 4, kind: 'd' }),
      repo.sdlcEvents.record({ ts: 5, kind: 'e' }),
    ]);
    const j = JSON.parse(fs.readFileSync(path.join(root, 'docs', 'sdlc-status.json'), 'utf8'));
    expect(j.log.length).toBe(5);
    expect(new Set(j.log.map((r) => r.kind))).toEqual(new Set(['a', 'b', 'c', 'd', 'e']));
  });

  test('mirror is byte-identical to a fresh SQL→JSON render for the same SQL state', async () => {
    await repo.sdlcEvents.record({ ts: 1000, kind: 'agent-start', storyId: 'US-0001', agent: 'Forge' });
    await repo.sdlcTasks.upsert({
      id: 't1',
      storyId: 'US-0001',
      agent: 'Forge',
      status: 'done',
      startedAt: 1000,
      completedAt: 2000,
    });
    await repo.sdlcProgramme.set('phase', { current: 'integration' });

    const onDisk = fs.readFileSync(path.join(root, 'docs', 'sdlc-status.json'), 'utf8');

    // Construct a fresh mirror against the SAME SQL state and re-render in-memory.
    const fresh = new SdlcMirror({ root, index: repo.index });
    const expected = JSON.stringify(fresh._renderFromSql(), null, 2);

    expect(onDisk).toBe(expected);
  });
});
