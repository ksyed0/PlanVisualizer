'use strict';
const fs = require('fs');
const path = require('path');
const os = require('os');
const { dispatch } = require('../../tools/agent-spec-plan');

function setupTmp() {
  const tmpdir = fs.mkdtempSync(path.join(os.tmpdir(), 'agt-int-'));
  const sdlcPath = path.join(tmpdir, 'sdlc-status.json');
  const pendingDir = path.join(tmpdir, 'pending');
  fs.mkdirSync(pendingDir, { recursive: true });
  fs.writeFileSync(sdlcPath, JSON.stringify({ stories: { 'US-0181': { status: 'Planned' } } }));
  return { tmpdir, sdlcPath, pendingDir };
}

describe('agent-spec-plan — full flow integration', () => {
  let tmp;
  beforeEach(() => {
    tmp = setupTmp();
  });
  afterEach(() => fs.rmSync(tmp.tmpdir, { recursive: true, force: true }));

  test('happy path: pending → ready_for_dispatch', () => {
    const { sdlcPath } = tmp;
    expect(dispatch({ cmd: 'spec-start', story: 'US-0181' }, { sdlcPath })).toBe(0);
    expect(dispatch({ cmd: 'spec-await-ac', story: 'US-0181' }, { sdlcPath })).toBe(2);
    expect(dispatch({ cmd: 'approve', story: 'US-0181', gate: 'ac' }, { sdlcPath })).toBe(0);
    expect(dispatch({ cmd: 'spec-review-result', story: 'US-0181', verdict: 'APPROVED' }, { sdlcPath })).toBe(0);
    expect(dispatch({ cmd: 'spec-await-final', story: 'US-0181' }, { sdlcPath })).toBe(2);
    expect(dispatch({ cmd: 'approve', story: 'US-0181', gate: 'spec' }, { sdlcPath })).toBe(0);
    expect(dispatch({ cmd: 'plan-start', story: 'US-0181', author: 'Keystone' }, { sdlcPath })).toBe(0);
    expect(dispatch({ cmd: 'plan-review-result', story: 'US-0181', verdict: 'APPROVED' }, { sdlcPath })).toBe(0);
    expect(dispatch({ cmd: 'plan-await-approval', story: 'US-0181' }, { sdlcPath })).toBe(2);
    expect(dispatch({ cmd: 'approve', story: 'US-0181', gate: 'plan' }, { sdlcPath })).toBe(0);

    const data = JSON.parse(fs.readFileSync(sdlcPath, 'utf8'));
    expect(data.stories['US-0181'].specPhase.state).toBe('approved');
    expect(data.stories['US-0181'].planPhase.state).toBe('approved');
  });

  test('sad path: plan-spec-gap reopens spec phase', () => {
    const { sdlcPath } = tmp;
    dispatch({ cmd: 'spec-start', story: 'US-0181' }, { sdlcPath });
    dispatch({ cmd: 'spec-await-ac', story: 'US-0181' }, { sdlcPath });
    dispatch({ cmd: 'approve', story: 'US-0181', gate: 'ac' }, { sdlcPath });
    dispatch({ cmd: 'spec-review-result', story: 'US-0181', verdict: 'APPROVED' }, { sdlcPath });
    dispatch({ cmd: 'spec-await-final', story: 'US-0181' }, { sdlcPath });
    dispatch({ cmd: 'approve', story: 'US-0181', gate: 'spec' }, { sdlcPath });
    dispatch({ cmd: 'plan-start', story: 'US-0181', author: 'Keystone' }, { sdlcPath });
    dispatch({ cmd: 'plan-spec-gap', story: 'US-0181', reason: 'AC misses error case' }, { sdlcPath });

    const data = JSON.parse(fs.readFileSync(sdlcPath, 'utf8'));
    expect(data.stories['US-0181'].specPhase.state).toBe('in_progress');
    expect(data.stories['US-0181'].planPhase.state).toBe('pending');
    expect(data.stories['US-0181'].specPhase.specApprovedAt).toBeNull();
  });

  test('cap path: 3 REQUEST_CHANGES → escalated', () => {
    const { sdlcPath } = tmp;
    dispatch({ cmd: 'spec-start', story: 'US-0181' }, { sdlcPath });
    dispatch({ cmd: 'spec-await-ac', story: 'US-0181' }, { sdlcPath });
    dispatch({ cmd: 'approve', story: 'US-0181', gate: 'ac' }, { sdlcPath });
    expect(dispatch({ cmd: 'spec-review-result', story: 'US-0181', verdict: 'REQUEST_CHANGES' }, { sdlcPath })).toBe(0);
    expect(dispatch({ cmd: 'spec-review-result', story: 'US-0181', verdict: 'REQUEST_CHANGES' }, { sdlcPath })).toBe(0);
    expect(dispatch({ cmd: 'spec-review-result', story: 'US-0181', verdict: 'REQUEST_CHANGES' }, { sdlcPath })).toBe(1);

    const data = JSON.parse(fs.readFileSync(sdlcPath, 'utf8'));
    expect(data.stories['US-0181'].specPhase.state).toBe('escalated');
  });

  test('flag-file path: drop approve flag, apply-pending applies it', () => {
    const { sdlcPath, pendingDir } = tmp;
    dispatch({ cmd: 'spec-start', story: 'US-0181' }, { sdlcPath });
    dispatch({ cmd: 'spec-await-ac', story: 'US-0181' }, { sdlcPath });

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

    expect(dispatch({ cmd: 'apply-pending', dir: pendingDir }, { sdlcPath })).toBe(0);
    expect(fs.existsSync(flagPath)).toBe(false);

    const data = JSON.parse(fs.readFileSync(sdlcPath, 'utf8'));
    expect(data.stories['US-0181'].specPhase.acApprovedAt).toBeTruthy();
  });
});
