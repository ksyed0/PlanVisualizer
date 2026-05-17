'use strict';

const fs = require('fs');
const path = require('path');
const os = require('os');

const Review = require('../../tools/agent-task-review');

function mkProjectWithTask(headSha = 'abc1234') {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'agent-task-review-int-'));
  fs.mkdirSync(path.join(root, 'docs'), { recursive: true });
  const sdlcPath = path.join(root, 'docs/sdlc-status.json');
  fs.writeFileSync(
    sdlcPath,
    JSON.stringify({
      tasks: {
        'task-abc': {
          id: 'task-abc',
          story: 'US-0185',
          agent: 'Forge',
          state: 'done',
          summary: 'did it',
          headSha,
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

function runDispatch(opts, ctx) {
  const out = [];
  const errs = [];
  const rc = Review.dispatch(opts, {
    ...ctx,
    stdout: (s) => out.push(s),
    stderr: (s) => errs.push(s),
  });
  return { rc, stdout: out.join('').trim(), stderr: errs.join('\n') };
}

test('happy path: start → spec APPROVED → quality APPROVED → cleared', () => {
  const { root, sdlcPath } = mkProjectWithTask();
  const ctx = { root, sdlcPath };

  expect(runDispatch({ cmd: 'start', taskId: 'task-abc', baseSha: '0000000', headSha: 'abc1234' }, ctx).stdout).toBe(
    'READY_FOR_SPEC',
  );
  expect(runDispatch({ cmd: 'spec-verdict', taskId: 'task-abc', verdict: 'APPROVED' }, ctx).stdout).toBe(
    'PROCEED_TO_QUALITY',
  );
  expect(runDispatch({ cmd: 'quality-verdict', taskId: 'task-abc', verdict: 'APPROVED' }, ctx).stdout).toBe(
    'TASK_CLEARED',
  );

  const data = JSON.parse(fs.readFileSync(sdlcPath, 'utf8'));
  expect(data.tasks['task-abc'].taskReview.status).toBe('approved');
  expect(data.tasks['task-abc'].taskReview.forgeRetries).toBe(0);
});

test('single spec retry: spec REQ_CHANGES → forge-retry → spec APPROVED → quality APPROVED', () => {
  const { root, sdlcPath } = mkProjectWithTask();
  const ctx = { root, sdlcPath };

  runDispatch({ cmd: 'start', taskId: 'task-abc', baseSha: '0000000', headSha: 'abc1234' }, ctx);
  expect(
    runDispatch({ cmd: 'spec-verdict', taskId: 'task-abc', verdict: 'REQUEST_CHANGES', findings: 'AC-x missing' }, ctx)
      .stdout,
  ).toBe('RETRY_FORGE');
  expect(
    runDispatch({ cmd: 'forge-retry', taskId: 'task-abc', triggeredBy: 'spec', newHeadSha: 'def5678' }, ctx).stdout,
  ).toBe('READY_FOR_SPEC');
  expect(runDispatch({ cmd: 'spec-verdict', taskId: 'task-abc', verdict: 'APPROVED' }, ctx).stdout).toBe(
    'PROCEED_TO_QUALITY',
  );
  expect(runDispatch({ cmd: 'quality-verdict', taskId: 'task-abc', verdict: 'APPROVED' }, ctx).stdout).toBe(
    'TASK_CLEARED',
  );

  const data = JSON.parse(fs.readFileSync(sdlcPath, 'utf8'));
  expect(data.tasks['task-abc'].taskReview.forgeRetries).toBe(1);
  expect(data.tasks['task-abc'].taskReview.lastRetryTriggeredBy).toBe('spec');
});

test('single quality retry skips spec re-review on retry', () => {
  const { root, sdlcPath } = mkProjectWithTask();
  const ctx = { root, sdlcPath };

  runDispatch({ cmd: 'start', taskId: 'task-abc', baseSha: '0000000', headSha: 'abc1234' }, ctx);
  runDispatch({ cmd: 'spec-verdict', taskId: 'task-abc', verdict: 'APPROVED' }, ctx);
  expect(
    runDispatch(
      { cmd: 'quality-verdict', taskId: 'task-abc', verdict: 'REQUEST_CHANGES', findings: 'magic number' },
      ctx,
    ).stdout,
  ).toBe('RETRY_FORGE');
  expect(
    runDispatch({ cmd: 'forge-retry', taskId: 'task-abc', triggeredBy: 'quality', newHeadSha: 'def5678' }, ctx).stdout,
  ).toBe('READY_FOR_QUALITY');
  // Direct quality re-review — spec phase skipped
  expect(runDispatch({ cmd: 'quality-verdict', taskId: 'task-abc', verdict: 'APPROVED' }, ctx).stdout).toBe(
    'TASK_CLEARED',
  );

  const data = JSON.parse(fs.readFileSync(sdlcPath, 'utf8'));
  expect(data.tasks['task-abc'].taskReview.specVerdict).toBe('APPROVED'); // preserved
  expect(data.tasks['task-abc'].taskReview.forgeRetries).toBe(1);
});

test('cap exhaustion on spec phase emits ESCALATE', () => {
  const { root, sdlcPath } = mkProjectWithTask();
  const ctx = { root, sdlcPath };

  runDispatch({ cmd: 'start', taskId: 'task-abc', baseSha: '0000000', headSha: 'abc1234' }, ctx);
  // First REQUEST_CHANGES → RETRY (forgeRetries 0 → after forge-retry 1)
  runDispatch({ cmd: 'spec-verdict', taskId: 'task-abc', verdict: 'REQUEST_CHANGES', findings: 'fail 1' }, ctx);
  runDispatch({ cmd: 'forge-retry', taskId: 'task-abc', triggeredBy: 'spec', newHeadSha: 'def5678' }, ctx);
  // Second REQUEST_CHANGES → RETRY (forgeRetries 1 → after forge-retry 2)
  runDispatch({ cmd: 'spec-verdict', taskId: 'task-abc', verdict: 'REQUEST_CHANGES', findings: 'fail 2' }, ctx);
  runDispatch({ cmd: 'forge-retry', taskId: 'task-abc', triggeredBy: 'spec', newHeadSha: '789abcd' }, ctx);
  // Third REQUEST_CHANGES (forgeRetries === cap=2) → ESCALATE
  expect(
    runDispatch({ cmd: 'spec-verdict', taskId: 'task-abc', verdict: 'REQUEST_CHANGES', findings: 'fail 3' }, ctx)
      .stdout,
  ).toBe('ESCALATE');

  const data = JSON.parse(fs.readFileSync(sdlcPath, 'utf8'));
  expect(data.tasks['task-abc'].taskReview.status).toBe('escalated');
  expect(typeof data.tasks['task-abc'].taskReview.completedAt).toBe('string');
});

test('SKIP_REVIEW when headSha === "none"', () => {
  const { root, sdlcPath } = mkProjectWithTask('none');
  const ctx = { root, sdlcPath };

  const { stdout } = runDispatch({ cmd: 'start', taskId: 'task-abc', baseSha: '0000000', headSha: 'none' }, ctx);
  expect(stdout).toBe('SKIP_REVIEW');

  const data = JSON.parse(fs.readFileSync(sdlcPath, 'utf8'));
  expect(data.tasks['task-abc'].taskReview.status).toBe('approved');
});
