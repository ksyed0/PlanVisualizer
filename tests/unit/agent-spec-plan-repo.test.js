'use strict';

/**
 * D.6 (US-0237 / TASK-0061) — agent-spec-plan CLI writes through the D.1
 * entity repos. These tests verify:
 *   - happy-path spec-start/approve persists stories through repo.sdlcProgramme
 *     and emits typed events on repo.sdlcEvents
 *   - BUG-0183 specApprove() idempotency guard survives the migration
 *     (re-approving an already-approved spec returns 0, no SQL/event churn)
 *   - constraint-violation (calling approve --gate spec on a pending story)
 *     propagates as a writer error (AC-1013: writers throw)
 *   - JSON mirror byte-identity round-trip for SQL-owned keys
 */

const fs = require('fs');
const path = require('path');
const os = require('os');

const { dispatch } = require('../../tools/agent-spec-plan');
const { Repository } = require('../../tools/lib/repository');
const { SdlcMirror } = require('../../tools/lib/repository/sdlc-mirror');

function mkRoot(storyExtras = {}) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'agent-spec-plan-repo-'));
  fs.mkdirSync(path.join(root, 'docs'), { recursive: true });
  fs.writeFileSync(
    path.join(root, 'docs/sdlc-status.json'),
    JSON.stringify({
      tasks: {},
      log: [],
      programme: {
        stories: {
          'US-0181': { status: 'Planned', ...storyExtras },
        },
      },
    }),
  );
  return root;
}

afterEach(() => {
  Repository._reset();
});

describe('agent-spec-plan writes through repo (D.6)', () => {
  test('happy path: spec-start + approve gate=spec persist via sdlcProgramme + sdlcEvents', async () => {
    const root = mkRoot();
    expect(await dispatch({ cmd: 'spec-start', story: 'US-0181' }, { root })).toBe(0);
    expect(await dispatch({ cmd: 'spec-await-ac', story: 'US-0181' }, { root })).toBe(2);
    expect(await dispatch({ cmd: 'approve', story: 'US-0181', gate: 'ac' }, { root })).toBe(0);
    expect(await dispatch({ cmd: 'spec-review-result', story: 'US-0181', verdict: 'APPROVED' }, { root })).toBe(0);
    expect(await dispatch({ cmd: 'spec-await-final', story: 'US-0181' }, { root })).toBe(2);
    expect(await dispatch({ cmd: 'approve', story: 'US-0181', gate: 'spec' }, { root })).toBe(0);

    // SQL is source of truth — verify via the repo.
    const repo = Repository.getInstance({ root });
    try {
      const stories = repo.sdlcProgramme.get('stories');
      expect(stories['US-0181'].specPhase.state).toBe('approved');
      expect(stories['US-0181'].specPhase.specApprovedAt).toBeTruthy();

      const kinds = repo.sdlcEvents.list().map((e) => e.kind);
      expect(kinds).toEqual(
        expect.arrayContaining([
          'spec-plan-spec-start',
          'spec-plan-spec-await-ac',
          'spec-plan-approve',
          'spec-plan-spec-review-result',
          'spec-plan-spec-await-final',
        ]),
      );
    } finally {
      Repository._reset();
    }
  });

  // AC-0929 — specApprove() / planApprove() idempotency guard (BUG handled
  // in US-0183) must survive the migration unchanged. A second approve on
  // an already-approved spec returns 0, leaves SQL state unchanged, AND
  // does NOT emit a duplicate event row.
  test('BUG-0183 / AC-0929: specApprove() idempotency guard preserved through repo', async () => {
    const root = mkRoot();
    // Walk to approved-spec.
    await dispatch({ cmd: 'spec-start', story: 'US-0181' }, { root });
    await dispatch({ cmd: 'spec-await-ac', story: 'US-0181' }, { root });
    await dispatch({ cmd: 'approve', story: 'US-0181', gate: 'ac' }, { root });
    await dispatch({ cmd: 'spec-review-result', story: 'US-0181', verdict: 'APPROVED' }, { root });
    await dispatch({ cmd: 'spec-await-final', story: 'US-0181' }, { root });
    await dispatch({ cmd: 'approve', story: 'US-0181', gate: 'spec' }, { root });

    // Open repo for "before" snapshot; dispatch will reset the singleton
    // in its finally so we re-open after each dispatch call.
    let repo = Repository.getInstance({ root });
    const beforeApprovedAt = repo.sdlcProgramme.get('stories')['US-0181'].specPhase.specApprovedAt;
    const beforeApproveEvents = repo.sdlcEvents.list().filter((e) => e.kind === 'spec-plan-approve').length;
    Repository._reset();

    // Second approve — must be a no-op (exit 0, state unchanged).
    const code = await dispatch({ cmd: 'approve', story: 'US-0181', gate: 'spec' }, { root });
    expect(code).toBe(0);

    repo = Repository.getInstance({ root });
    try {
      const after = repo.sdlcProgramme.get('stories');
      expect(after['US-0181'].specPhase.state).toBe('approved');
      // Timestamp unchanged — proves the idempotency guard short-circuited
      // before re-stamping specApprovedAt.
      expect(after['US-0181'].specPhase.specApprovedAt).toBe(beforeApprovedAt);

      // No duplicate event row.
      const afterApproveEvents = repo.sdlcEvents.list().filter((e) => e.kind === 'spec-plan-approve').length;
      expect(afterApproveEvents).toBe(beforeApproveEvents);
    } finally {
      Repository._reset();
    }
  });

  // AC-1013 — writer errors (e.g. invalid state transition) propagate as
  // non-zero exit; they are NOT swallowed into a warnings channel.
  test('writer constraint: approve --gate spec on a pending story throws → exit 1', async () => {
    const root = mkRoot();
    // No spec-start has run — specPhase doesn't exist; approve --gate spec
    // initializes orchestration then tries to approve a story in 'pending'.
    const code = await dispatch({ cmd: 'approve', story: 'US-0181', gate: 'spec' }, { root });
    expect(code).toBe(1);
  });

  // Hard-gate-supporting test: the on-disk JSON mirror matches a fresh
  // _renderFromSql() against the same SQL state byte-for-byte (for the
  // SQL-owned keys — tasks/log/programme).
  test('JSON mirror is byte-identical to a fresh _renderFromSql for SQL-owned keys', async () => {
    const root = mkRoot();
    await dispatch({ cmd: 'spec-start', story: 'US-0181' }, { root });
    await dispatch({ cmd: 'spec-await-ac', story: 'US-0181' }, { root });
    await dispatch({ cmd: 'approve', story: 'US-0181', gate: 'ac' }, { root });

    const mirrorOnDisk = JSON.parse(fs.readFileSync(path.join(root, 'docs', 'sdlc-status.json'), 'utf8'));

    const repo = Repository.getInstance({ root });
    try {
      const fresh = new SdlcMirror({ root, index: repo.index })._renderFromSql();
      expect(mirrorOnDisk.tasks).toEqual(fresh.tasks);
      expect(mirrorOnDisk.log).toEqual(fresh.log);
      expect(mirrorOnDisk.programme).toEqual(fresh.programme);
      // And the SQL-owned story state survived the round-trip.
      expect(mirrorOnDisk.programme.stories['US-0181'].specPhase.acApprovedAt).toBeTruthy();
    } finally {
      Repository._reset();
    }
  });

  // Confirms no live fs.writeFileSync(sdlc-status, …) call is reachable
  // from the module (hard-gate grep guard at the source level).
  test('source code contains no direct fs.writeFileSync of sdlc-status', () => {
    const src = fs.readFileSync(path.join(__dirname, '..', '..', 'tools', 'agent-spec-plan.js'), 'utf8');
    const codeOnly = src
      .split('\n')
      .filter((line) => !/^\s*(\/\/|\*|\/\*)/.test(line))
      .join('\n');
    expect(codeOnly).not.toMatch(/fs\.writeFileSync[^;]*sdlc-status/);
    expect(codeOnly).not.toMatch(/atomicReadModifyWriteJson[^;]*sdlc-status/);
  });
});
