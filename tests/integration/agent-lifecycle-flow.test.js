'use strict';
const fs = require('fs');
const path = require('path');
const os = require('os');
const { dispatch } = require('../../tools/agent-lifecycle');
const { Repository } = require('../../tools/lib/repository');

function setupTmp() {
  const tmpdir = fs.mkdtempSync(path.join(os.tmpdir(), 'alc-int-'));
  fs.mkdirSync(path.join(tmpdir, 'docs'), { recursive: true });
  const sdlcPath = path.join(tmpdir, 'docs', 'sdlc-status.json');
  fs.writeFileSync(sdlcPath, JSON.stringify({ stories: { 'US-0183': { status: 'InProgress' } } }));
  return { tmpdir, sdlcPath, root: tmpdir };
}

describe('agent-lifecycle — full flow integration', () => {
  let tmp;
  beforeEach(() => {
    Repository._reset();
    tmp = setupTmp();
  });
  afterEach(() => {
    Repository._reset();
    fs.rmSync(tmp.tmpdir, { recursive: true, force: true });
  });

  test('happy path: start → done', async () => {
    const { sdlcPath, root } = tmp;
    const stdout = [];
    expect(
      await dispatch(
        { cmd: 'start', story: 'US-0183', agent: 'Forge', model: 'sonnet', task: 'implement x' },
        { sdlcPath, root, skipRegen: true, stdout: (s) => stdout.push(s) },
      ),
    ).toBe(0);
    const taskId = stdout[0];
    expect(taskId).toMatch(/^task-/);
    expect(
      await dispatch({ cmd: 'done', taskId, summary: 'done [sha:abc1234]' }, { sdlcPath, root, skipRegen: true }),
    ).toBe(0);
    const data = JSON.parse(fs.readFileSync(sdlcPath, 'utf8'));
    expect(data.tasks[taskId].state).toBe('done');
  });

  test('blocked → resolve → done', async () => {
    const { sdlcPath, root } = tmp;
    const stdout = [];
    await dispatch(
      { cmd: 'start', story: 'US-0183', agent: 'Forge', model: 'sonnet', task: 'impl' },
      { sdlcPath, root, skipRegen: true, stdout: (s) => stdout.push(s) },
    );
    const taskId = stdout[0];
    await dispatch(
      { cmd: 'blocked', taskId, reason: 'cannot find schema' },
      { sdlcPath, root, skipRegen: true, stdout: () => {} },
    );
    await dispatch(
      { cmd: 'resolve', taskId, action: 'MORE_CONTEXT', note: 'added schema' },
      { sdlcPath, root, skipRegen: true },
    );
    await dispatch({ cmd: 'done', taskId, summary: 'done [sha:abc1234]' }, { sdlcPath, root, skipRegen: true });
    const data = JSON.parse(fs.readFileSync(sdlcPath, 'utf8'));
    expect(data.tasks[taskId].state).toBe('done');
    expect(data.tasks[taskId].retryCount).toBe(1);
  });

  test('blocked cap → escalated, exit 1', async () => {
    const { sdlcPath, root } = tmp;
    const stdout = [];
    await dispatch(
      { cmd: 'start', story: 'US-0183', agent: 'Forge', model: 'sonnet', task: 'hard task' },
      { sdlcPath, root, skipRegen: true, stdout: (s) => stdout.push(s) },
    );
    const taskId = stdout[0];
    for (let i = 0; i < 2; i++) {
      await dispatch(
        { cmd: 'blocked', taskId, reason: 'stuck' },
        { sdlcPath, root, skipRegen: true, stdout: () => {} },
      );
      await dispatch(
        { cmd: 'resolve', taskId, action: 'UPGRADE_MODEL', note: 'tried' },
        { sdlcPath, root, skipRegen: true },
      );
    }
    await dispatch(
      { cmd: 'blocked', taskId, reason: 'still stuck' },
      { sdlcPath, root, skipRegen: true, stdout: () => {} },
    );
    const code = await dispatch(
      { cmd: 'resolve', taskId, action: 'UPGRADE_MODEL', note: 'last try' },
      { sdlcPath, root, skipRegen: true, stderr: () => {} },
    );
    expect(code).toBe(1);
    const data = JSON.parse(fs.readFileSync(sdlcPath, 'utf8'));
    expect(data.tasks[taskId].state).toBe('escalated');
  });
});
