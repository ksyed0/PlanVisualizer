'use strict';

/**
 * D.4 (US-0235) — verify update-sdlc-status.js writes through the entity
 * repos rather than directly to docs/sdlc-status.json.
 *
 * Covers AC-0922 (event-kind paths use repo.sdlcEvents.record /
 * repo.sdlcProgramme.set), AC-0924 (mirror is byte-equivalent for a fixture
 * event stream) and AC-1013 (writers throw on constraint violations — they
 * do not swallow into a warnings channel).
 */

const fs = require('fs');
const os = require('os');
const path = require('path');

const { Repository } = require('../../tools/lib/repository');
const { readState, writeState, HANDLERS } = require('../../tools/update-sdlc-status');
const { SdlcMirror } = require('../../tools/lib/repository/sdlc-mirror');

function mkRoot() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'd4-'));
  fs.mkdirSync(path.join(root, 'docs'));
  return root;
}

describe('update-sdlc-status — repo-backed main loop (US-0235)', () => {
  let root;
  let repo;

  beforeEach(() => {
    root = mkRoot();
    Repository._reset();
    repo = Repository.getInstance({ root });
  });

  afterEach(() => {
    Repository._reset();
    fs.rmSync(root, { recursive: true, force: true });
  });

  // AC-0922 — happy-path agent-start routes a log entry through
  // sdlcEvents.record and an agents update through sdlcProgramme.set.
  test('agent-start persists log via sdlcEvents and agents via sdlcProgramme', async () => {
    const before = readState(repo);
    const data = JSON.parse(JSON.stringify(before));
    const after = HANDLERS['agent-start'](data, {
      agent: 'Pixel',
      story: 'US-0096',
      task: 'zebra striping',
      model: 'sonnet',
    });
    await writeState(repo, before, after);

    // Event row was inserted.
    const rows = repo.index.prepare('SELECT * FROM sdlc_events ORDER BY id').all();
    expect(rows).toHaveLength(1);
    expect(rows[0].agent).toBe('Pixel');
    const payload = JSON.parse(rows[0].payload_json);
    expect(payload.message).toContain('US-0096');
    expect(payload.model).toBe('sonnet');

    // Programme fields persisted.
    expect(repo.sdlcProgramme.get('agents').Pixel.status).toBe('active');
    expect(repo.sdlcProgramme.get('agents').Pixel.currentTask).toBe('zebra striping');
    expect(repo.sdlcProgramme.get('stories')['US-0096'].status).toBe('InProgress');
  });

  // AC-1013 — writers throw on errors from the repo layer rather than
  // swallowing them (L-0076: no silent drops). We assert this at the
  // writeState boundary by injecting a stub repo whose sdlcEvents.record
  // rejects; writeState must propagate.
  test('writeState propagates errors from sdlcEvents.record (writers throw, indexers warn)', async () => {
    const before = readState(repo);
    const after = JSON.parse(JSON.stringify(before));
    after.log = [{ time: new Date().toISOString(), agent: 'X', message: 'boom' }];

    const failingRepo = {
      sdlcProgramme: { set: jest.fn().mockResolvedValue() },
      sdlcEvents: {
        record: jest.fn().mockRejectedValue(new Error('SQLITE_CONSTRAINT_NOTNULL: sdlc_events.kind')),
      },
    };

    await expect(writeState(failingRepo, before, after)).rejects.toThrow(/SQLITE_CONSTRAINT|NOT ?NULL/i);
    expect(failingRepo.sdlcEvents.record).toHaveBeenCalled();
  });

  // AC-0924 — JSON mirror on disk is byte-identical to a fresh SQL→JSON
  // render against the same SQL state after a representative fixture event
  // stream replays through the repo-backed main loop.
  test('JSON mirror is byte-identical to a fresh SQL→JSON render for a fixture event stream', async () => {
    // Replay a small fixture stream: agent-start → agent-done → story-complete.
    let before = readState(repo);
    let data = JSON.parse(JSON.stringify(before));
    let after = HANDLERS['agent-start'](data, { agent: 'Forge', story: 'US-0001', task: 'impl', model: 'sonnet' });
    await writeState(repo, before, after);

    before = readState(repo);
    data = JSON.parse(JSON.stringify(before));
    after = HANDLERS['agent-done'](data, { agent: 'Forge', story: 'US-0001' });
    await writeState(repo, before, after);

    before = readState(repo);
    data = JSON.parse(JSON.stringify(before));
    after = HANDLERS['story-complete'](data, { story: 'US-0001', epic: 'EPIC-0001' });
    await writeState(repo, before, after);

    // On-disk JSON
    const onDisk = fs.readFileSync(path.join(root, 'docs', 'sdlc-status.json'), 'utf8');

    // Re-render in-memory against the SAME SQL state and compare bytes.
    const fresh = new SdlcMirror({ root, index: repo.index });
    const expected = JSON.stringify(fresh._renderFromSql(), null, 2);

    expect(onDisk).toBe(expected);

    // Round-trip sanity: log has 3 entries (one per handler).
    const parsed = JSON.parse(onDisk);
    expect(parsed.log).toHaveLength(3);
    // Programme carries the rich-state fields.
    expect(parsed.programme.agents.Forge.status).toBe('idle');
    expect(parsed.programme.stories['US-0001'].status).toBe('Complete');
    expect(parsed.programme.metrics.storiesCompleted).toBe(1);
  });

  // Confirms no live fs.writeFileSync(sdlc-status, …) call is reachable
  // from the module — guards the hard-gate grep in scope §4 by introspecting
  // the source. We strip line-leading comments before matching so the
  // module's own documentation referring to the removed call doesn't trip
  // the assertion.
  test('source code contains no direct fs.writeFileSync of sdlc-status', () => {
    const src = fs.readFileSync(path.join(__dirname, '..', '..', 'tools', 'update-sdlc-status.js'), 'utf8');
    const codeOnly = src
      .split('\n')
      .filter((line) => !/^\s*(\/\/|\*|\/\*)/.test(line))
      .join('\n');
    expect(codeOnly).not.toMatch(/fs\.writeFileSync[^;]*sdlc-status/);
  });
});
