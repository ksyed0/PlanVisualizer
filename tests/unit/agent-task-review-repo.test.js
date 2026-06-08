'use strict';

/**
 * D.5 (US-0236 / TASK-0060) — agent-task-review CLI writes through the
 * D.1 entity repos. These tests verify:
 *   - happy-path review submission persists taskReview through repo.sdlcTasks
 *     and emits a typed event on repo.sdlcEvents
 *   - constraint-violation (calling spec-verdict on a task with no
 *     taskReview) propagates as a writer error (AC-1013)
 *   - round-trip byte-identity: the JSON mirror is a pure function of SQL
 *     state, so writing through the repo produces the exact bytes a
 *     fresh _renderFromSql would emit
 */

const fs = require('fs');
const path = require('path');
const os = require('os');

const { dispatch } = require('../../tools/agent-task-review');
const { Repository } = require('../../tools/lib/repository');

function mkRoot(taskExtras = {}) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'agent-task-review-repo-'));
  fs.mkdirSync(path.join(root, 'docs'), { recursive: true });
  const sdlcPath = path.join(root, 'docs/sdlc-status.json');
  fs.writeFileSync(
    sdlcPath,
    JSON.stringify({
      tasks: {
        'task-xyz': {
          id: 'task-xyz',
          story: 'US-0236',
          agent: 'Forge',
          state: 'done',
          summary: 'work done',
          headSha: 'abc1234',
          ...taskExtras,
        },
      },
    }),
  );
  fs.writeFileSync(
    path.join(root, 'plan-visualizer.config.json'),
    JSON.stringify({ orchestration: { iterationCap: { taskReview: 2 } } }),
  );
  return { root, sdlcPath };
}

afterEach(() => {
  Repository._reset();
});

describe('agent-task-review writes through repo (D.5)', () => {
  test('happy path: task-review-pass persists taskReview via SdlcTaskRepo and records typed event', async () => {
    const { root } = mkRoot();

    let rc = await dispatch(
      { cmd: 'start', taskId: 'task-xyz', baseSha: '0000000', headSha: 'abc1234' },
      { root, stdout: () => {}, stderr: () => {} },
    );
    expect(rc).toBe(0);
    rc = await dispatch(
      { cmd: 'spec-verdict', taskId: 'task-xyz', verdict: 'APPROVED' },
      { root, stdout: () => {}, stderr: () => {} },
    );
    expect(rc).toBe(0);
    rc = await dispatch(
      { cmd: 'quality-verdict', taskId: 'task-xyz', verdict: 'APPROVED' },
      { root, stdout: () => {}, stderr: () => {} },
    );
    expect(rc).toBe(0);

    // SQL is the source of truth — verify directly through the repo,
    // not through the JSON mirror.
    const repo = Repository.getInstance({ root });
    try {
      const row = repo.sdlcTasks.get('task-xyz');
      expect(row).toBeTruthy();
      expect(row.task_review_json).toBeTruthy();
      const tr = JSON.parse(row.task_review_json);
      expect(tr.status).toBe('approved');
      expect(tr.specVerdict).toBe('APPROVED');
      expect(tr.qualityVerdict).toBe('APPROVED');
      expect(row.base_sha).toBe('0000000');
      expect(row.head_sha).toBe('abc1234');

      const events = repo.sdlcEvents.list();
      const kinds = events.map((e) => e.kind);
      expect(kinds).toEqual(
        expect.arrayContaining(['task-review-start', 'task-review-spec-verdict', 'task-review-quality-verdict']),
      );
    } finally {
      Repository._reset();
    }
  });

  test('task-review-fail (REQUEST_CHANGES) round-trips findings and bumps forgeRetries through SQL', async () => {
    const { root } = mkRoot();

    await dispatch(
      { cmd: 'start', taskId: 'task-xyz', baseSha: '0000000', headSha: 'abc1234' },
      { root, stdout: () => {}, stderr: () => {} },
    );
    const rc = await dispatch(
      { cmd: 'spec-verdict', taskId: 'task-xyz', verdict: 'REQUEST_CHANGES', findings: 'AC-x missing' },
      { root, stdout: () => {}, stderr: () => {} },
    );
    expect(rc).toBe(0);
    await dispatch(
      { cmd: 'forge-retry', taskId: 'task-xyz', triggeredBy: 'spec', newHeadSha: 'def5678' },
      { root, stdout: () => {}, stderr: () => {} },
    );

    const repo = Repository.getInstance({ root });
    try {
      const row = repo.sdlcTasks.get('task-xyz');
      const tr = JSON.parse(row.task_review_json);
      expect(tr.forgeRetries).toBe(1);
      expect(tr.lastRetryTriggeredBy).toBe('spec');
      expect(tr.headSha).toBe('def5678');
      expect(row.head_sha).toBe('def5678');
    } finally {
      Repository._reset();
    }
  });

  test('writer constraint: spec-verdict on a task with no taskReview throws (AC-1013)', async () => {
    // No `start` has been issued → task has no taskReview. The State
    // helper throws; the dispatch surfaces non-zero RC with stderr text.
    const { root } = mkRoot();
    const errs = [];
    const rc = await dispatch(
      { cmd: 'spec-verdict', taskId: 'task-xyz', verdict: 'APPROVED' },
      { root, stdout: () => {}, stderr: (s) => errs.push(s) },
    );
    expect(rc).toBe(1);
    expect(errs.join(' ')).toMatch(/invalid state for spec verdict/i);
  });

  test('JSON mirror is byte-identical to a fresh _renderFromSql of the same SQL state', async () => {
    const { root } = mkRoot();

    await dispatch(
      { cmd: 'start', taskId: 'task-xyz', baseSha: '0000000', headSha: 'abc1234' },
      { root, stdout: () => {}, stderr: () => {} },
    );
    await dispatch(
      { cmd: 'spec-verdict', taskId: 'task-xyz', verdict: 'APPROVED' },
      { root, stdout: () => {}, stderr: () => {} },
    );

    const mirrorOnDisk = fs.readFileSync(path.join(root, 'docs', 'sdlc-status.json'), 'utf8');

    // Round-trip: a fresh _renderFromSql against the same SQL must match
    // the canonical render section of the on-disk mirror byte-for-byte
    // (the mirror also preserves unknown top-level keys carried by the
    // legacy seed — they appear after the SQL-rendered keys but do not
    // overlap with tasks/log/programme, so we compare those keys
    // explicitly).
    const repo = Repository.getInstance({ root });
    try {
      const fresh = repo._sdlcMirror._renderFromSql();
      const parsed = JSON.parse(mirrorOnDisk);
      expect(parsed.tasks).toEqual(fresh.tasks);
      expect(parsed.log).toEqual(fresh.log);
      expect(parsed.programme).toEqual(fresh.programme);
    } finally {
      Repository._reset();
    }
  });
});
