'use strict';

const fs = require('fs');
const path = require('path');
const os = require('os');

const mig = require('../../../tools/lib/migrations/005-ingest-sdlc-status');
const { Repository } = require('../../../tools/lib/repository');
const { SdlcMirror } = require('../../../tools/lib/repository/sdlc-mirror');

function makeRoot(prefix) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), prefix));
  fs.mkdirSync(path.join(root, 'docs'));
  fs.writeFileSync(path.join(root, 'package.json'), JSON.stringify({ version: '2.5.0' }));
  return root;
}

describe('Migration 005 — JSON → SQLite ingest (US-0233)', () => {
  let root;

  beforeEach(() => {
    Repository._reset();
  });

  afterEach(() => {
    Repository._reset();
    if (root && fs.existsSync(root)) fs.rmSync(root, { recursive: true, force: true });
    root = null;
  });

  // AC-0918 — missing source file: graceful skip
  test('skipped when docs/sdlc-status.json is missing', async () => {
    root = makeRoot('m5-missing-');
    const result = await mig.up({ root });
    expect(result).toEqual({ skipped: 'no-file' });
  });

  // AC-0916 — ingest tasks/log/programme through the entity repos
  test('ingests tasks, events, and programme entries via the D.1 repos', async () => {
    root = makeRoot('m5-ingest-');
    const fixture = {
      tasks: [
        { id: 't1', storyId: 'US-0001', agent: 'Forge', status: 'done', startedAt: 1000, completedAt: 2000 },
        { id: 't2', storyId: 'US-0002', agent: 'Scribe', status: 'in_progress', startedAt: 1500 },
      ],
      log: [
        { ts: 1000, kind: 'agent-start', storyId: 'US-0001', agent: 'Forge' },
        { ts: 2000, kind: 'agent-done', storyId: 'US-0001', agent: 'Forge' },
        { ts: 1500, kind: 'agent-start', storyId: 'US-0002', agent: 'Scribe' },
      ],
      programme: {
        phase: { current: 'integration' },
        last_dispatch: { agent: 'Conductor', ts: 2000 },
      },
    };
    fs.writeFileSync(path.join(root, 'docs', 'sdlc-status.json'), JSON.stringify(fixture));

    const result = await mig.up({ root });
    expect(result).toEqual({ ingested: { tasks: 2, events: 3, programmeKeys: 2 } });

    Repository._reset();
    const repo = Repository.getInstance({ root });
    expect(repo.sdlcTasks.get('t1').status).toBe('done');
    expect(repo.sdlcTasks.get('t2').status).toBe('in_progress');
    expect(repo.sdlcEvents.list().length).toBe(3);
    expect(repo.sdlcEvents.list({ storyId: 'US-0001' }).length).toBe(2);
    expect(repo.sdlcProgramme.get('phase')).toEqual({ current: 'integration' });
    expect(repo.sdlcProgramme.get('last_dispatch')).toEqual({ agent: 'Conductor', ts: 2000 });
  });

  // AC-0917 — idempotency via meta_status('migration_005_hash')
  test('second run with identical source is a no-op (hash matches)', async () => {
    root = makeRoot('m5-idem-');
    fs.writeFileSync(
      path.join(root, 'docs', 'sdlc-status.json'),
      JSON.stringify({
        tasks: [{ id: 't1', storyId: 'US-0001', agent: 'Forge', status: 'done' }],
        log: [{ ts: 1, kind: 'agent-start', storyId: 'US-0001' }],
        programme: { phase: { current: 'integration' } },
      }),
    );

    const first = await mig.up({ root });
    expect(first.ingested).toBeDefined();

    // Hash row is persisted under the documented key.
    Repository._reset();
    let repo = Repository.getInstance({ root });
    const row = repo.index.prepare('SELECT value FROM meta_status WHERE key=?').get(mig.HASH_KEY);
    expect(row).toBeTruthy();
    expect(typeof row.value).toBe('string');
    expect(row.value).toHaveLength(64); // sha256 hex
    const eventsAfterFirst = repo.sdlcEvents.list().length;
    expect(eventsAfterFirst).toBe(1);
    Repository._reset();

    const second = await mig.up({ root });
    expect(second).toEqual({ skipped: 'idempotent' });

    repo = Repository.getInstance({ root });
    // No duplicate events / tasks were inserted on re-run.
    expect(repo.sdlcEvents.list().length).toBe(eventsAfterFirst);
    expect(repo.sdlcTasks.list().length).toBe(1);
  });

  // Byte-identity: after ingest, the JSON mirror produced via the D.1 writers
  // equals the canonical SQL→JSON render of the same SQL state, byte-for-byte.
  // This proves no silent drops (L-0076) and that ingest routes through the
  // same code path as runtime writers.
  test('post-ingest JSON mirror is byte-identical to a fresh SQL→JSON render', async () => {
    root = makeRoot('m5-byte-');
    const fixture = {
      tasks: [{ id: 't1', storyId: 'US-0001', agent: 'Forge', status: 'done', startedAt: 1000, completedAt: 2000 }],
      log: [
        { ts: 1000, kind: 'agent-start', storyId: 'US-0001', agent: 'Forge' },
        { ts: 2000, kind: 'agent-done', storyId: 'US-0001', agent: 'Forge' },
      ],
      programme: { phase: { current: 'integration' } },
    };
    fs.writeFileSync(path.join(root, 'docs', 'sdlc-status.json'), JSON.stringify(fixture));

    await mig.up({ root });

    Repository._reset();
    const repo = Repository.getInstance({ root });
    const onDisk = fs.readFileSync(path.join(root, 'docs', 'sdlc-status.json'), 'utf8');
    const fresh = new SdlcMirror({ root, index: repo.index });
    const expected = JSON.stringify(fresh._renderFromSql(), null, 2);
    expect(onDisk).toBe(expected);

    // And the semantic content matches the fixture.
    const parsed = JSON.parse(onDisk);
    expect(parsed.tasks).toHaveLength(1);
    expect(parsed.log).toHaveLength(2);
    expect(parsed.programme).toEqual({ phase: { current: 'integration' } });
  });

  // L-0076 — surface parse errors loudly rather than silently skipping.
  test('throws on malformed JSON source rather than silently skipping', async () => {
    root = makeRoot('m5-bad-');
    fs.writeFileSync(path.join(root, 'docs', 'sdlc-status.json'), '{not valid json');
    await expect(mig.up({ root })).rejects.toThrow(/Migration 005/);
  });

  // Re-ingest after the source changes (hash differs) updates state without
  // losing prior events — this guards against the "silent no-op on drift"
  // bug.
  test('re-ingest when source changes appends rather than skipping', async () => {
    root = makeRoot('m5-drift-');
    const file = path.join(root, 'docs', 'sdlc-status.json');
    fs.writeFileSync(
      file,
      JSON.stringify({
        tasks: [{ id: 't1', storyId: 'US-0001', agent: 'Forge', status: 'in_progress' }],
        log: [{ ts: 1, kind: 'agent-start', storyId: 'US-0001' }],
        programme: {},
      }),
    );
    await mig.up({ root });

    fs.writeFileSync(
      file,
      JSON.stringify({
        tasks: [{ id: 't1', storyId: 'US-0001', agent: 'Forge', status: 'done', completedAt: 2 }],
        log: [
          { ts: 1, kind: 'agent-start', storyId: 'US-0001' },
          { ts: 2, kind: 'agent-done', storyId: 'US-0001' },
        ],
        programme: {},
      }),
    );
    const second = await mig.up({ root });
    expect(second.ingested).toBeDefined();

    Repository._reset();
    const repo = Repository.getInstance({ root });
    expect(repo.sdlcTasks.get('t1').status).toBe('done');
    // The append model: re-ingesting the changed source records the new
    // event again (append-only events). The upsert collapses the task.
    expect(repo.sdlcEvents.list().length).toBeGreaterThanOrEqual(2);
  });
});
