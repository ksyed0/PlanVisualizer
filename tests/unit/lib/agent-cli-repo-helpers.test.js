'use strict';

/**
 * Unit tests for tools/lib/agent-cli-repo-helpers.js — the shared
 * legacy-bridge module extracted in D.6 (US-0237 / TASK-0062). Covers the
 * happy paths the three Phase-D writer CLIs (agent-lifecycle.js,
 * agent-task-review.js, agent-spec-plan.js) rely on, plus the
 * constraint-violation path that proves seedTasksFromLegacyJson surfaces
 * writer errors verbatim (AC-1013: writers throw, indexers warn).
 */

const fs = require('fs');
const os = require('os');
const path = require('path');

const helpers = require('../../../tools/lib/agent-cli-repo-helpers');
const { Repository } = require('../../../tools/lib/repository');

function mkTmp(prefix = 'agent-cli-helpers-') {
  return fs.mkdtempSync(path.join(os.tmpdir(), prefix));
}

afterEach(() => {
  Repository._reset();
});

describe('resolveRoot', () => {
  test('honours ctx.root verbatim', () => {
    expect(helpers.resolveRoot({ root: '/explicit/root' })).toBe('/explicit/root');
  });

  test('strips trailing docs/sdlc-status.json to recover root', () => {
    expect(helpers.resolveRoot({ sdlcPath: '/repo/docs/sdlc-status.json' })).toBe('/repo');
  });

  test('synthesises root from a non-canonical sdlcPath (tmpdir/sdlc-status.json)', () => {
    expect(helpers.resolveRoot({ sdlcPath: '/tmp/foo/sdlc-status.json' })).toBe('/tmp/foo');
  });

  test('falls back to defaultRoot when ctx is empty', () => {
    expect(helpers.resolveRoot({}, { defaultRoot: '/fallback' })).toBe('/fallback');
    expect(helpers.resolveRoot(undefined, { defaultRoot: '/fallback' })).toBe('/fallback');
  });
});

describe('ensureDocsDir / adoptLegacySdlcPath / syncLegacySdlcPath', () => {
  let tmp;
  beforeEach(() => {
    tmp = mkTmp();
  });
  afterEach(() => {
    fs.rmSync(tmp, { recursive: true, force: true });
  });

  test('ensureDocsDir creates docs/ recursively and is idempotent', () => {
    helpers.ensureDocsDir(tmp);
    helpers.ensureDocsDir(tmp);
    expect(fs.existsSync(path.join(tmp, 'docs'))).toBe(true);
  });

  test('adoptLegacySdlcPath migrates a non-canonical seed into docs/', () => {
    const legacy = path.join(tmp, 'sdlc-status.json');
    fs.writeFileSync(legacy, JSON.stringify({ tasks: { 't-1': { state: 'doing' } } }));
    helpers.adoptLegacySdlcPath({ sdlcPath: legacy }, tmp);
    const canonical = path.join(tmp, 'docs', 'sdlc-status.json');
    expect(fs.existsSync(canonical)).toBe(true);
    const parsed = JSON.parse(fs.readFileSync(canonical, 'utf8'));
    expect(parsed.tasks['t-1']).toEqual({ state: 'doing' });
  });

  test('adoptLegacySdlcPath seeds empty canonical when neither file exists', () => {
    helpers.adoptLegacySdlcPath({ sdlcPath: path.join(tmp, 'sdlc-status.json') }, tmp);
    const canonical = path.join(tmp, 'docs', 'sdlc-status.json');
    expect(fs.existsSync(canonical)).toBe(true);
    expect(JSON.parse(fs.readFileSync(canonical, 'utf8'))).toEqual({ tasks: {}, log: [], programme: {} });
  });

  test('adoptLegacySdlcPath is a no-op when sdlcPath IS the canonical location', () => {
    const canonical = path.join(tmp, 'docs', 'sdlc-status.json');
    fs.mkdirSync(path.dirname(canonical), { recursive: true });
    fs.writeFileSync(canonical, JSON.stringify({ marker: 'untouched' }));
    helpers.adoptLegacySdlcPath({ sdlcPath: canonical }, tmp);
    expect(JSON.parse(fs.readFileSync(canonical, 'utf8'))).toEqual({ marker: 'untouched' });
  });

  test('syncLegacySdlcPath copies canonical back to the legacy path', () => {
    const canonical = path.join(tmp, 'docs', 'sdlc-status.json');
    fs.mkdirSync(path.dirname(canonical), { recursive: true });
    fs.writeFileSync(canonical, JSON.stringify({ marker: 'fresh' }));
    const legacy = path.join(tmp, 'sdlc-status.json');
    helpers.syncLegacySdlcPath({ sdlcPath: legacy }, tmp);
    expect(JSON.parse(fs.readFileSync(legacy, 'utf8'))).toEqual({ marker: 'fresh' });
  });
});

describe('readMirror', () => {
  let tmp;
  beforeEach(() => {
    tmp = mkTmp();
    fs.mkdirSync(path.join(tmp, 'docs'), { recursive: true });
  });
  afterEach(() => fs.rmSync(tmp, { recursive: true, force: true }));

  test('returns empty shape when file is missing', () => {
    expect(helpers.readMirror(tmp)).toEqual({ tasks: {}, log: [], programme: {} });
  });

  test('returns empty shape when file is malformed JSON', () => {
    fs.writeFileSync(path.join(tmp, 'docs', 'sdlc-status.json'), 'not json{');
    expect(helpers.readMirror(tmp)).toEqual({ tasks: {}, log: [], programme: {} });
  });

  test('preserves unknown top-level keys (transitional-debt scaffolding)', () => {
    fs.writeFileSync(
      path.join(tmp, 'docs', 'sdlc-status.json'),
      JSON.stringify({ stories: { 'US-0181': { status: 'Planned' } }, log: [] }),
    );
    const data = helpers.readMirror(tmp);
    expect(data.stories['US-0181']).toEqual({ status: 'Planned' });
    expect(data.tasks).toEqual({});
  });
});

describe('parseTimestamp', () => {
  test('null / undefined → null', () => {
    expect(helpers.parseTimestamp(null)).toBeNull();
    expect(helpers.parseTimestamp(undefined)).toBeNull();
  });
  test('numbers pass through', () => {
    expect(helpers.parseTimestamp(1717777777000)).toBe(1717777777000);
  });
  test('ISO strings parse to epoch ms', () => {
    expect(helpers.parseTimestamp('2026-05-21T00:00:00.000Z')).toBe(Date.parse('2026-05-21T00:00:00.000Z'));
  });
  test('garbage strings → null', () => {
    expect(helpers.parseTimestamp('not a date')).toBeNull();
  });
});

describe('taskToUpsert', () => {
  test('translates legacy keys (story → storyId, state → status)', () => {
    const t = {
      id: 'task-1',
      story: 'US-0001',
      state: 'doing',
      agent: 'Forge',
      startedAt: '2026-05-21T00:00:00.000Z',
      completedAt: null,
      summary: 'wip',
    };
    const upsert = helpers.taskToUpsert(t);
    expect(upsert.id).toBe('task-1');
    expect(upsert.storyId).toBe('US-0001');
    expect(upsert.status).toBe('doing');
    expect(upsert.startedAt).toBe(Date.parse('2026-05-21T00:00:00.000Z'));
    expect(upsert.completedAt).toBeNull();
  });
});

describe('seedTasksFromLegacyJson', () => {
  let root;
  beforeEach(() => {
    root = mkTmp('seed-');
    fs.mkdirSync(path.join(root, 'docs'), { recursive: true });
  });
  afterEach(() => fs.rmSync(root, { recursive: true, force: true }));

  test('lifts a legacy tasks map into SQL via repo.sdlcTasks.upsert', async () => {
    fs.writeFileSync(
      path.join(root, 'docs', 'sdlc-status.json'),
      JSON.stringify({
        tasks: {
          'task-xyz': { id: 'task-xyz', story: 'US-0236', agent: 'Forge', state: 'done', headSha: 'abc1234' },
        },
      }),
    );
    Repository._reset();
    const repo = Repository.getInstance({ root });
    await helpers.seedTasksFromLegacyJson(repo, root);
    const row = repo.sdlcTasks.get('task-xyz');
    expect(row).toBeTruthy();
    expect(row.story_id).toBe('US-0236');
    expect(row.status).toBe('done');
    expect(row.head_sha).toBe('abc1234');
  });

  test('is idempotent — re-running on an already-seeded repo upserts no new rows', async () => {
    fs.writeFileSync(
      path.join(root, 'docs', 'sdlc-status.json'),
      JSON.stringify({ tasks: { t1: { id: 't1', story: 'US-1', state: 'done' } } }),
    );
    Repository._reset();
    const repo = Repository.getInstance({ root });
    await helpers.seedTasksFromLegacyJson(repo, root);
    await helpers.seedTasksFromLegacyJson(repo, root);
    const rows = repo.index.prepare('SELECT COUNT(*) AS n FROM sdlc_tasks').get();
    expect(rows.n).toBe(1);
  });

  test('no-op when file missing / malformed / tasks-is-array', async () => {
    Repository._reset();
    const repo = Repository.getInstance({ root });
    // File missing.
    await expect(helpers.seedTasksFromLegacyJson(repo, root)).resolves.toBeUndefined();
    // Malformed.
    fs.writeFileSync(path.join(root, 'docs', 'sdlc-status.json'), 'not json');
    await expect(helpers.seedTasksFromLegacyJson(repo, root)).resolves.toBeUndefined();
    // tasks-is-array (legacy array shape — not the object map we ingest).
    fs.writeFileSync(path.join(root, 'docs', 'sdlc-status.json'), JSON.stringify({ tasks: [] }));
    await expect(helpers.seedTasksFromLegacyJson(repo, root)).resolves.toBeUndefined();
    expect(repo.index.prepare('SELECT COUNT(*) AS n FROM sdlc_tasks').get().n).toBe(0);
  });

  test('propagates writer errors verbatim (AC-1013: writers throw, indexers warn)', async () => {
    fs.writeFileSync(
      path.join(root, 'docs', 'sdlc-status.json'),
      JSON.stringify({ tasks: { t1: { id: 't1', story: 'US-1', state: 'done' } } }),
    );
    const stubRepo = {
      sdlcTasks: {
        get: () => null,
        upsert: jest.fn().mockRejectedValue(new Error('SQLITE_CONSTRAINT_NOTNULL: sdlc_tasks.id')),
      },
    };
    await expect(helpers.seedTasksFromLegacyJson(stubRepo, root)).rejects.toThrow(/SQLITE_CONSTRAINT/);
    expect(stubRepo.sdlcTasks.upsert).toHaveBeenCalledTimes(1);
  });
});

describe('getRepoForCtx', () => {
  let tmp;
  beforeEach(() => {
    tmp = mkTmp('getrepo-');
  });
  afterEach(() => fs.rmSync(tmp, { recursive: true, force: true }));

  test('resolves root, ensures docs/, resets singleton, returns fresh { repo, root }', () => {
    const legacy = path.join(tmp, 'sdlc-status.json');
    fs.writeFileSync(legacy, JSON.stringify({ tasks: {} }));
    const out = helpers.getRepoForCtx({ sdlcPath: legacy }, { Repository });
    expect(out.root).toBe(tmp);
    expect(fs.existsSync(path.join(tmp, 'docs'))).toBe(true);
    expect(out.repo).toBeTruthy();
    expect(out.repo.sdlcTasks).toBeTruthy();
    expect(out.repo.sdlcEvents).toBeTruthy();
    expect(out.repo.sdlcProgramme).toBeTruthy();
  });

  test('honours ctx.root', () => {
    const out = helpers.getRepoForCtx({ root: tmp }, { Repository });
    expect(out.root).toBe(tmp);
  });
});
