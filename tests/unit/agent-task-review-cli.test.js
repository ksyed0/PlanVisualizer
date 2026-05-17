'use strict';

const fs = require('fs');
const path = require('path');
const os = require('os');

const { parseArgs, dispatch } = require('../../tools/agent-task-review');

function mkProjectWithTask(opts = {}) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'agent-task-review-cli-'));
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
          headSha: 'abc1234',
          ...(opts.taskOverrides || {}),
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

describe('parseArgs', () => {
  test('parses start command with all flags', () => {
    const opts = parseArgs([
      'node',
      'cli',
      'start',
      '--task-id',
      'task-abc',
      '--base-sha',
      '0000000',
      '--head-sha',
      'abc1234',
    ]);
    expect(opts).toMatchObject({ cmd: 'start', taskId: 'task-abc', baseSha: '0000000', headSha: 'abc1234' });
  });

  test('parses verdict command with --verdict and --findings', () => {
    const opts = parseArgs([
      'node',
      'cli',
      'spec-verdict',
      '--task-id',
      'task-abc',
      '--verdict',
      'REQUEST_CHANGES',
      '--findings',
      'AC-x missing',
    ]);
    expect(opts).toMatchObject({
      cmd: 'spec-verdict',
      taskId: 'task-abc',
      verdict: 'REQUEST_CHANGES',
      findings: 'AC-x missing',
    });
  });

  test('parses forge-retry with --triggered-by and --new-head-sha', () => {
    const opts = parseArgs([
      'node',
      'cli',
      'forge-retry',
      '--task-id',
      'task-abc',
      '--triggered-by',
      'spec',
      '--new-head-sha',
      'def5678',
    ]);
    expect(opts).toMatchObject({ cmd: 'forge-retry', taskId: 'task-abc', triggeredBy: 'spec', newHeadSha: 'def5678' });
  });
});

describe('dispatch — start', () => {
  test('happy path: emits READY_FOR_SPEC on stdout, exit 0', () => {
    const { root, sdlcPath } = mkProjectWithTask();
    const out = [];
    const rc = dispatch(
      { cmd: 'start', taskId: 'task-abc', baseSha: '0000000', headSha: 'abc1234' },
      { root, sdlcPath, stdout: (s) => out.push(s), stderr: () => {} },
    );
    expect(rc).toBe(0);
    expect(out.join('').trim()).toBe('READY_FOR_SPEC');
  });

  test('headSha === "none" emits SKIP_REVIEW', () => {
    const { root, sdlcPath } = mkProjectWithTask({ taskOverrides: { headSha: 'none' } });
    const out = [];
    const rc = dispatch(
      { cmd: 'start', taskId: 'task-abc', baseSha: '0000000', headSha: 'none' },
      { root, sdlcPath, stdout: (s) => out.push(s), stderr: () => {} },
    );
    expect(rc).toBe(0);
    expect(out.join('').trim()).toBe('SKIP_REVIEW');
  });

  test('missing --task-id exits 1 with stderr', () => {
    const { root, sdlcPath } = mkProjectWithTask();
    const errs = [];
    const rc = dispatch(
      { cmd: 'start', baseSha: '0000000', headSha: 'abc1234' },
      { root, sdlcPath, stdout: () => {}, stderr: (s) => errs.push(s) },
    );
    expect(rc).toBe(1);
    expect(errs.join(' ')).toMatch(/--task-id required/);
  });

  test('missing --base-sha exits 1', () => {
    const { root, sdlcPath } = mkProjectWithTask();
    const errs = [];
    const rc = dispatch(
      { cmd: 'start', taskId: 'task-abc', headSha: 'abc1234' },
      { root, sdlcPath, stdout: () => {}, stderr: (s) => errs.push(s) },
    );
    expect(rc).toBe(1);
    expect(errs.join(' ')).toMatch(/--base-sha required/);
  });
});

describe('dispatch — status', () => {
  test('prints taskReview JSON to stdout, exit 0', () => {
    const { root, sdlcPath } = mkProjectWithTask();
    dispatch(
      { cmd: 'start', taskId: 'task-abc', baseSha: '0000000', headSha: 'abc1234' },
      { root, sdlcPath, stdout: () => {}, stderr: () => {} },
    );
    const out = [];
    const rc = dispatch(
      { cmd: 'status', taskId: 'task-abc' },
      { root, sdlcPath, stdout: (s) => out.push(s), stderr: () => {} },
    );
    expect(rc).toBe(0);
    const parsed = JSON.parse(out.join(''));
    expect(parsed.status).toBe('spec_reviewing');
    expect(parsed.baseSha).toBe('0000000');
  });

  test('status on task without taskReview exits 1', () => {
    const { root, sdlcPath } = mkProjectWithTask();
    const errs = [];
    const rc = dispatch(
      { cmd: 'status', taskId: 'task-abc' },
      { root, sdlcPath, stdout: () => {}, stderr: (s) => errs.push(s) },
    );
    expect(rc).toBe(1);
  });
});

describe('dispatch — spec-verdict', () => {
  function startedProject() {
    const { root, sdlcPath } = mkProjectWithTask();
    dispatch(
      { cmd: 'start', taskId: 'task-abc', baseSha: '0000000', headSha: 'abc1234' },
      { root, sdlcPath, stdout: () => {}, stderr: () => {} },
    );
    return { root, sdlcPath };
  }

  test('APPROVED emits PROCEED_TO_QUALITY', () => {
    const { root, sdlcPath } = startedProject();
    const out = [];
    const rc = dispatch(
      { cmd: 'spec-verdict', taskId: 'task-abc', verdict: 'APPROVED' },
      { root, sdlcPath, stdout: (s) => out.push(s), stderr: () => {} },
    );
    expect(rc).toBe(0);
    expect(out.join('').trim()).toBe('PROCEED_TO_QUALITY');
  });

  test('REQUEST_CHANGES with retries < cap emits RETRY_FORGE', () => {
    const { root, sdlcPath } = startedProject();
    const out = [];
    const rc = dispatch(
      { cmd: 'spec-verdict', taskId: 'task-abc', verdict: 'REQUEST_CHANGES', findings: 'AC-x missing' },
      { root, sdlcPath, stdout: (s) => out.push(s), stderr: () => {} },
    );
    expect(rc).toBe(0);
    expect(out.join('').trim()).toBe('RETRY_FORGE');
  });

  test('REQUEST_CHANGES at cap emits ESCALATE', () => {
    const { root, sdlcPath } = startedProject();
    const data = JSON.parse(fs.readFileSync(sdlcPath, 'utf8'));
    data.tasks['task-abc'].taskReview.forgeRetries = 2;
    fs.writeFileSync(sdlcPath, JSON.stringify(data, null, 2));
    const out = [];
    const rc = dispatch(
      { cmd: 'spec-verdict', taskId: 'task-abc', verdict: 'REQUEST_CHANGES', findings: 'still bad' },
      { root, sdlcPath, stdout: (s) => out.push(s), stderr: () => {} },
    );
    expect(rc).toBe(0);
    expect(out.join('').trim()).toBe('ESCALATE');
  });

  test('REQUEST_CHANGES without --findings exits 1', () => {
    const { root, sdlcPath } = startedProject();
    const errs = [];
    const rc = dispatch(
      { cmd: 'spec-verdict', taskId: 'task-abc', verdict: 'REQUEST_CHANGES' },
      { root, sdlcPath, stdout: () => {}, stderr: (s) => errs.push(s) },
    );
    expect(rc).toBe(1);
    expect(errs.join(' ')).toMatch(/findings/i);
  });
});

describe('dispatch — quality-verdict', () => {
  function readyForQuality() {
    const { root, sdlcPath } = mkProjectWithTask();
    dispatch(
      { cmd: 'start', taskId: 'task-abc', baseSha: '0000000', headSha: 'abc1234' },
      { root, sdlcPath, stdout: () => {}, stderr: () => {} },
    );
    dispatch(
      { cmd: 'spec-verdict', taskId: 'task-abc', verdict: 'APPROVED' },
      { root, sdlcPath, stdout: () => {}, stderr: () => {} },
    );
    return { root, sdlcPath };
  }

  test('APPROVED emits TASK_CLEARED', () => {
    const { root, sdlcPath } = readyForQuality();
    const out = [];
    const rc = dispatch(
      { cmd: 'quality-verdict', taskId: 'task-abc', verdict: 'APPROVED' },
      { root, sdlcPath, stdout: (s) => out.push(s), stderr: () => {} },
    );
    expect(rc).toBe(0);
    expect(out.join('').trim()).toBe('TASK_CLEARED');
  });

  test('REQUEST_CHANGES with retries < cap emits RETRY_FORGE', () => {
    const { root, sdlcPath } = readyForQuality();
    const out = [];
    const rc = dispatch(
      { cmd: 'quality-verdict', taskId: 'task-abc', verdict: 'REQUEST_CHANGES', findings: 'magic number' },
      { root, sdlcPath, stdout: (s) => out.push(s), stderr: () => {} },
    );
    expect(rc).toBe(0);
    expect(out.join('').trim()).toBe('RETRY_FORGE');
  });
});

describe('dispatch — forge-retry', () => {
  function inForgeRetry(reason) {
    const { root, sdlcPath } = mkProjectWithTask();
    dispatch(
      { cmd: 'start', taskId: 'task-abc', baseSha: '0000000', headSha: 'abc1234' },
      { root, sdlcPath, stdout: () => {}, stderr: () => {} },
    );
    if (reason === 'spec') {
      dispatch(
        { cmd: 'spec-verdict', taskId: 'task-abc', verdict: 'REQUEST_CHANGES', findings: 'spec fail' },
        { root, sdlcPath, stdout: () => {}, stderr: () => {} },
      );
    } else {
      dispatch(
        { cmd: 'spec-verdict', taskId: 'task-abc', verdict: 'APPROVED' },
        { root, sdlcPath, stdout: () => {}, stderr: () => {} },
      );
      dispatch(
        { cmd: 'quality-verdict', taskId: 'task-abc', verdict: 'REQUEST_CHANGES', findings: 'quality fail' },
        { root, sdlcPath, stdout: () => {}, stderr: () => {} },
      );
    }
    return { root, sdlcPath };
  }

  test('spec retry emits READY_FOR_SPEC, increments forgeRetries', () => {
    const { root, sdlcPath } = inForgeRetry('spec');
    const out = [];
    const rc = dispatch(
      { cmd: 'forge-retry', taskId: 'task-abc', triggeredBy: 'spec', newHeadSha: 'def5678' },
      { root, sdlcPath, stdout: (s) => out.push(s), stderr: () => {} },
    );
    expect(rc).toBe(0);
    expect(out.join('').trim()).toBe('READY_FOR_SPEC');
    const data = JSON.parse(fs.readFileSync(sdlcPath, 'utf8'));
    expect(data.tasks['task-abc'].taskReview.forgeRetries).toBe(1);
    expect(data.tasks['task-abc'].taskReview.headSha).toBe('def5678');
  });

  test('quality retry emits READY_FOR_QUALITY, preserves spec verdict', () => {
    const { root, sdlcPath } = inForgeRetry('quality');
    const out = [];
    const rc = dispatch(
      { cmd: 'forge-retry', taskId: 'task-abc', triggeredBy: 'quality', newHeadSha: 'def5678' },
      { root, sdlcPath, stdout: (s) => out.push(s), stderr: () => {} },
    );
    expect(rc).toBe(0);
    expect(out.join('').trim()).toBe('READY_FOR_QUALITY');
    const data = JSON.parse(fs.readFileSync(sdlcPath, 'utf8'));
    expect(data.tasks['task-abc'].taskReview.specVerdict).toBe('APPROVED');
  });

  test('missing --triggered-by exits 1', () => {
    const { root, sdlcPath } = inForgeRetry('spec');
    const errs = [];
    const rc = dispatch(
      { cmd: 'forge-retry', taskId: 'task-abc', newHeadSha: 'def5678' },
      { root, sdlcPath, stdout: () => {}, stderr: (s) => errs.push(s) },
    );
    expect(rc).toBe(1);
    expect(errs.join(' ')).toMatch(/--triggered-by/);
  });

  test('missing --new-head-sha exits 1', () => {
    const { root, sdlcPath } = inForgeRetry('spec');
    const errs = [];
    const rc = dispatch(
      { cmd: 'forge-retry', taskId: 'task-abc', triggeredBy: 'spec' },
      { root, sdlcPath, stdout: () => {}, stderr: (s) => errs.push(s) },
    );
    expect(rc).toBe(1);
    expect(errs.join(' ')).toMatch(/--new-head-sha/);
  });
});
