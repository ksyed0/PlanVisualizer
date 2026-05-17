'use strict';
const fs = require('fs');
const path = require('path');
const os = require('os');
const { dispatch } = require('../../tools/agent-lifecycle');

function setupTmp() {
  const tmpdir = fs.mkdtempSync(path.join(os.tmpdir(), 'alc-int-'));
  const sdlcPath = path.join(tmpdir, 'sdlc-status.json');
  fs.writeFileSync(sdlcPath, JSON.stringify({ stories: { 'US-0183': { status: 'InProgress' } } }));
  return { tmpdir, sdlcPath };
}

describe('agent-lifecycle — full flow integration', () => {
  let tmp;
  beforeEach(() => {
    tmp = setupTmp();
  });
  afterEach(() => fs.rmSync(tmp.tmpdir, { recursive: true, force: true }));

  test('happy path: start → done', () => {
    const { sdlcPath } = tmp;
    const stdout = [];
    expect(
      dispatch(
        { cmd: 'start', story: 'US-0183', agent: 'Forge', model: 'sonnet', task: 'implement x' },
        { sdlcPath, skipRegen: true, stdout: (s) => stdout.push(s) },
      ),
    ).toBe(0);
    const taskId = stdout[0];
    expect(taskId).toMatch(/^task-/);
    expect(dispatch({ cmd: 'done', taskId, summary: 'done [sha:abc1234]' }, { sdlcPath, skipRegen: true })).toBe(0);
    const data = JSON.parse(fs.readFileSync(sdlcPath, 'utf8'));
    expect(data.tasks[taskId].state).toBe('done');
  });

  test('blocked → resolve → done', () => {
    const { sdlcPath } = tmp;
    const stdout = [];
    dispatch(
      { cmd: 'start', story: 'US-0183', agent: 'Forge', model: 'sonnet', task: 'impl' },
      { sdlcPath, skipRegen: true, stdout: (s) => stdout.push(s) },
    );
    const taskId = stdout[0];
    dispatch({ cmd: 'blocked', taskId, reason: 'cannot find schema' }, { sdlcPath, skipRegen: true, stdout: () => {} });
    dispatch({ cmd: 'resolve', taskId, action: 'MORE_CONTEXT', note: 'added schema' }, { sdlcPath, skipRegen: true });
    dispatch({ cmd: 'done', taskId, summary: 'done [sha:abc1234]' }, { sdlcPath, skipRegen: true });
    const data = JSON.parse(fs.readFileSync(sdlcPath, 'utf8'));
    expect(data.tasks[taskId].state).toBe('done');
    expect(data.tasks[taskId].retryCount).toBe(1);
  });

  test('blocked cap → escalated, exit 1', () => {
    const { sdlcPath } = tmp;
    const stdout = [];
    dispatch(
      { cmd: 'start', story: 'US-0183', agent: 'Forge', model: 'sonnet', task: 'hard task' },
      { sdlcPath, skipRegen: true, stdout: (s) => stdout.push(s) },
    );
    const taskId = stdout[0];
    for (let i = 0; i < 2; i++) {
      dispatch({ cmd: 'blocked', taskId, reason: 'stuck' }, { sdlcPath, skipRegen: true, stdout: () => {} });
      dispatch({ cmd: 'resolve', taskId, action: 'UPGRADE_MODEL', note: 'tried' }, { sdlcPath, skipRegen: true });
    }
    dispatch({ cmd: 'blocked', taskId, reason: 'still stuck' }, { sdlcPath, skipRegen: true, stdout: () => {} });
    const code = dispatch(
      { cmd: 'resolve', taskId, action: 'UPGRADE_MODEL', note: 'last try' },
      { sdlcPath, skipRegen: true },
    );
    expect(code).toBe(1);
    const data = JSON.parse(fs.readFileSync(sdlcPath, 'utf8'));
    expect(data.tasks[taskId].state).toBe('escalated');
  });
});
