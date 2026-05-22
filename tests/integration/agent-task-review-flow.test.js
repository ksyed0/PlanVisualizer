'use strict';

const fs = require('fs');
const path = require('path');
const os = require('os');

const Review = require('../../tools/agent-task-review');
const { Repository } = require('../../tools/lib/repository');

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

async function runDispatch(opts, ctx) {
  const out = [];
  const errs = [];
  const rc = await Review.dispatch(opts, {
    ...ctx,
    stdout: (s) => out.push(s),
    stderr: (s) => errs.push(s),
  });
  return { rc, stdout: out.join('').trim(), stderr: errs.join('\n') };
}

afterEach(() => {
  Repository._reset();
});

test('happy path: start → spec APPROVED → quality APPROVED → cleared', async () => {
  const { root, sdlcPath } = mkProjectWithTask();
  const ctx = { root, sdlcPath };

  expect(
    (await runDispatch({ cmd: 'start', taskId: 'task-abc', baseSha: '0000000', headSha: 'abc1234' }, ctx)).stdout,
  ).toBe('READY_FOR_SPEC');
  expect((await runDispatch({ cmd: 'spec-verdict', taskId: 'task-abc', verdict: 'APPROVED' }, ctx)).stdout).toBe(
    'PROCEED_TO_QUALITY',
  );
  expect((await runDispatch({ cmd: 'quality-verdict', taskId: 'task-abc', verdict: 'APPROVED' }, ctx)).stdout).toBe(
    'TASK_CLEARED',
  );

  const data = JSON.parse(fs.readFileSync(sdlcPath, 'utf8'));
  expect(data.tasks['task-abc'].taskReview.status).toBe('approved');
  expect(data.tasks['task-abc'].taskReview.forgeRetries).toBe(0);
});

test('single spec retry: spec REQ_CHANGES → forge-retry → spec APPROVED → quality APPROVED', async () => {
  const { root, sdlcPath } = mkProjectWithTask();
  const ctx = { root, sdlcPath };

  await runDispatch({ cmd: 'start', taskId: 'task-abc', baseSha: '0000000', headSha: 'abc1234' }, ctx);
  expect(
    (
      await runDispatch(
        { cmd: 'spec-verdict', taskId: 'task-abc', verdict: 'REQUEST_CHANGES', findings: 'AC-x missing' },
        ctx,
      )
    ).stdout,
  ).toBe('RETRY_FORGE');
  expect(
    (await runDispatch({ cmd: 'forge-retry', taskId: 'task-abc', triggeredBy: 'spec', newHeadSha: 'def5678' }, ctx))
      .stdout,
  ).toBe('READY_FOR_SPEC');
  expect((await runDispatch({ cmd: 'spec-verdict', taskId: 'task-abc', verdict: 'APPROVED' }, ctx)).stdout).toBe(
    'PROCEED_TO_QUALITY',
  );
  expect((await runDispatch({ cmd: 'quality-verdict', taskId: 'task-abc', verdict: 'APPROVED' }, ctx)).stdout).toBe(
    'TASK_CLEARED',
  );

  const data = JSON.parse(fs.readFileSync(sdlcPath, 'utf8'));
  expect(data.tasks['task-abc'].taskReview.forgeRetries).toBe(1);
  expect(data.tasks['task-abc'].taskReview.lastRetryTriggeredBy).toBe('spec');
});

test('single quality retry skips spec re-review on retry', async () => {
  const { root, sdlcPath } = mkProjectWithTask();
  const ctx = { root, sdlcPath };

  await runDispatch({ cmd: 'start', taskId: 'task-abc', baseSha: '0000000', headSha: 'abc1234' }, ctx);
  await runDispatch({ cmd: 'spec-verdict', taskId: 'task-abc', verdict: 'APPROVED' }, ctx);
  expect(
    (
      await runDispatch(
        { cmd: 'quality-verdict', taskId: 'task-abc', verdict: 'REQUEST_CHANGES', findings: 'magic number' },
        ctx,
      )
    ).stdout,
  ).toBe('RETRY_FORGE');
  expect(
    (await runDispatch({ cmd: 'forge-retry', taskId: 'task-abc', triggeredBy: 'quality', newHeadSha: 'def5678' }, ctx))
      .stdout,
  ).toBe('READY_FOR_QUALITY');
  // Direct quality re-review — spec phase skipped
  expect((await runDispatch({ cmd: 'quality-verdict', taskId: 'task-abc', verdict: 'APPROVED' }, ctx)).stdout).toBe(
    'TASK_CLEARED',
  );

  const data = JSON.parse(fs.readFileSync(sdlcPath, 'utf8'));
  expect(data.tasks['task-abc'].taskReview.specVerdict).toBe('APPROVED'); // preserved
  expect(data.tasks['task-abc'].taskReview.forgeRetries).toBe(1);
});

test('cap exhaustion on spec phase emits ESCALATE', async () => {
  const { root, sdlcPath } = mkProjectWithTask();
  const ctx = { root, sdlcPath };

  await runDispatch({ cmd: 'start', taskId: 'task-abc', baseSha: '0000000', headSha: 'abc1234' }, ctx);
  // First REQUEST_CHANGES → RETRY (forgeRetries 0 → after forge-retry 1)
  await runDispatch({ cmd: 'spec-verdict', taskId: 'task-abc', verdict: 'REQUEST_CHANGES', findings: 'fail 1' }, ctx);
  await runDispatch({ cmd: 'forge-retry', taskId: 'task-abc', triggeredBy: 'spec', newHeadSha: 'def5678' }, ctx);
  // Second REQUEST_CHANGES → RETRY (forgeRetries 1 → after forge-retry 2)
  await runDispatch({ cmd: 'spec-verdict', taskId: 'task-abc', verdict: 'REQUEST_CHANGES', findings: 'fail 2' }, ctx);
  await runDispatch({ cmd: 'forge-retry', taskId: 'task-abc', triggeredBy: 'spec', newHeadSha: '789abcd' }, ctx);
  // Third REQUEST_CHANGES (forgeRetries === cap=2) → ESCALATE
  expect(
    (
      await runDispatch(
        { cmd: 'spec-verdict', taskId: 'task-abc', verdict: 'REQUEST_CHANGES', findings: 'fail 3' },
        ctx,
      )
    ).stdout,
  ).toBe('ESCALATE');

  const data = JSON.parse(fs.readFileSync(sdlcPath, 'utf8'));
  expect(data.tasks['task-abc'].taskReview.status).toBe('escalated');
  expect(typeof data.tasks['task-abc'].taskReview.completedAt).toBe('string');
});

test('SKIP_REVIEW when headSha === "none"', async () => {
  const { root, sdlcPath } = mkProjectWithTask('none');
  const ctx = { root, sdlcPath };

  const { stdout } = await runDispatch({ cmd: 'start', taskId: 'task-abc', baseSha: '0000000', headSha: 'none' }, ctx);
  expect(stdout).toBe('SKIP_REVIEW');

  const data = JSON.parse(fs.readFileSync(sdlcPath, 'utf8'));
  expect(data.tasks['task-abc'].taskReview.status).toBe('approved');
});
