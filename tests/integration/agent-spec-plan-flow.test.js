'use strict';

/**
 * Post-D.6 (US-0237 / TASK-0061) integration flow tests. Dispatch is async
 * and writes through the D.1 entity repos; story orchestration lives under
 * `programme.stories` in the on-disk JSON mirror.
 */

const fs = require('fs');
const path = require('path');
const os = require('os');
const { dispatch } = require('../../tools/agent-spec-plan');
const { Repository } = require('../../tools/lib/repository');

function setupTmp() {
  const tmpdir = fs.mkdtempSync(path.join(os.tmpdir(), 'agt-int-'));
  const sdlcPath = path.join(tmpdir, 'sdlc-status.json');
  const pendingDir = path.join(tmpdir, 'pending');
  fs.mkdirSync(pendingDir, { recursive: true });
  fs.writeFileSync(sdlcPath, JSON.stringify({ stories: { 'US-0181': { status: 'Planned' } } }));
  return { tmpdir, sdlcPath, pendingDir };
}

function getStory(sdlcPath, id) {
  const data = JSON.parse(fs.readFileSync(sdlcPath, 'utf8'));
  return data.programme && data.programme.stories ? data.programme.stories[id] : undefined;
}

afterEach(() => Repository._reset());

describe('agent-spec-plan — full flow integration', () => {
  let tmp;
  beforeEach(() => {
    tmp = setupTmp();
  });
  afterEach(() => fs.rmSync(tmp.tmpdir, { recursive: true, force: true }));

  test('happy path: pending → ready_for_dispatch', async () => {
    const { sdlcPath } = tmp;
    expect(await dispatch({ cmd: 'spec-start', story: 'US-0181' }, { sdlcPath })).toBe(0);
    expect(await dispatch({ cmd: 'spec-await-ac', story: 'US-0181' }, { sdlcPath })).toBe(2);
    expect(await dispatch({ cmd: 'approve', story: 'US-0181', gate: 'ac' }, { sdlcPath })).toBe(0);
    expect(await dispatch({ cmd: 'spec-review-result', story: 'US-0181', verdict: 'APPROVED' }, { sdlcPath })).toBe(0);
    expect(await dispatch({ cmd: 'spec-await-final', story: 'US-0181' }, { sdlcPath })).toBe(2);
    expect(await dispatch({ cmd: 'approve', story: 'US-0181', gate: 'spec' }, { sdlcPath })).toBe(0);
    expect(await dispatch({ cmd: 'plan-start', story: 'US-0181', author: 'Keystone' }, { sdlcPath })).toBe(0);
    expect(await dispatch({ cmd: 'plan-review-result', story: 'US-0181', verdict: 'APPROVED' }, { sdlcPath })).toBe(0);
    expect(await dispatch({ cmd: 'plan-await-approval', story: 'US-0181' }, { sdlcPath })).toBe(2);
    expect(await dispatch({ cmd: 'approve', story: 'US-0181', gate: 'plan' }, { sdlcPath })).toBe(0);

    const st = getStory(sdlcPath, 'US-0181');
    expect(st.specPhase.state).toBe('approved');
    expect(st.planPhase.state).toBe('approved');
  });

  test('sad path: plan-spec-gap reopens spec phase', async () => {
    const { sdlcPath } = tmp;
    await dispatch({ cmd: 'spec-start', story: 'US-0181' }, { sdlcPath });
    await dispatch({ cmd: 'spec-await-ac', story: 'US-0181' }, { sdlcPath });
    await dispatch({ cmd: 'approve', story: 'US-0181', gate: 'ac' }, { sdlcPath });
    await dispatch({ cmd: 'spec-review-result', story: 'US-0181', verdict: 'APPROVED' }, { sdlcPath });
    await dispatch({ cmd: 'spec-await-final', story: 'US-0181' }, { sdlcPath });
    await dispatch({ cmd: 'approve', story: 'US-0181', gate: 'spec' }, { sdlcPath });
    await dispatch({ cmd: 'plan-start', story: 'US-0181', author: 'Keystone' }, { sdlcPath });
    await dispatch({ cmd: 'plan-spec-gap', story: 'US-0181', reason: 'AC misses error case' }, { sdlcPath });

    const st = getStory(sdlcPath, 'US-0181');
    expect(st.specPhase.state).toBe('in_progress');
    expect(st.planPhase.state).toBe('pending');
    expect(st.specPhase.specApprovedAt).toBeNull();
  });

  test('cap path: 3 REQUEST_CHANGES → escalated', async () => {
    const { sdlcPath } = tmp;
    await dispatch({ cmd: 'spec-start', story: 'US-0181' }, { sdlcPath });
    await dispatch({ cmd: 'spec-await-ac', story: 'US-0181' }, { sdlcPath });
    await dispatch({ cmd: 'approve', story: 'US-0181', gate: 'ac' }, { sdlcPath });
    expect(
      await dispatch({ cmd: 'spec-review-result', story: 'US-0181', verdict: 'REQUEST_CHANGES' }, { sdlcPath }),
    ).toBe(0);
    expect(
      await dispatch({ cmd: 'spec-review-result', story: 'US-0181', verdict: 'REQUEST_CHANGES' }, { sdlcPath }),
    ).toBe(0);
    expect(
      await dispatch({ cmd: 'spec-review-result', story: 'US-0181', verdict: 'REQUEST_CHANGES' }, { sdlcPath }),
    ).toBe(1);

    expect(getStory(sdlcPath, 'US-0181').specPhase.state).toBe('escalated');
  });

  test('flag-file path: drop approve flag, apply-pending applies it', async () => {
    const { sdlcPath, pendingDir } = tmp;
    await dispatch({ cmd: 'spec-start', story: 'US-0181' }, { sdlcPath });
    await dispatch({ cmd: 'spec-await-ac', story: 'US-0181' }, { sdlcPath });

    const flagPath = path.join(pendingDir, 'approve-US-0181-ac.flag');
    fs.writeFileSync(
      flagPath,
      JSON.stringify({
        story: 'US-0181',
        gate: 'ac',
        action: 'approve',
        timestamp: new Date().toISOString(),
      }),
    );

    expect(await dispatch({ cmd: 'apply-pending', dir: pendingDir }, { sdlcPath })).toBe(0);
    expect(fs.existsSync(flagPath)).toBe(false);

    expect(getStory(sdlcPath, 'US-0181').specPhase.acApprovedAt).toBeTruthy();
  });
});
