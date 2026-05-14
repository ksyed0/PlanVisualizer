'use strict';
const { parseArgs } = require('../../tools/agent-lifecycle');

describe('parseArgs', () => {
  test('subcommand captured as cmd', () => {
    expect(parseArgs(['node', 'agent-lifecycle.js', 'start']).cmd).toBe('start');
  });
  test('--story flag', () => {
    expect(parseArgs(['node', 'x', 'start', '--story', 'US-0183']).story).toBe('US-0183');
  });
  test('--agent flag', () => {
    expect(parseArgs(['node', 'x', 'start', '--agent', 'Forge']).agent).toBe('Forge');
  });
  test('--model flag', () => {
    expect(parseArgs(['node', 'x', 'start', '--model', 'haiku']).model).toBe('haiku');
  });
  test('--task flag', () => {
    expect(parseArgs(['node', 'x', 'start', '--task', 'implement parser']).task).toBe('implement parser');
  });
  test('--task-id flag', () => {
    expect(parseArgs(['node', 'x', 'done', '--task-id', 'task-abc']).taskId).toBe('task-abc');
  });
  test('--note flag', () => {
    expect(parseArgs(['node', 'x', 'concerns', '--note', 'might fail']).note).toBe('might fail');
  });
  test('--missing flag', () => {
    expect(parseArgs(['node', 'x', 'needs-context', '--missing', 'config path']).missing).toBe('config path');
  });
  test('--reason flag', () => {
    expect(parseArgs(['node', 'x', 'blocked', '--reason', 'cannot find']).reason).toBe('cannot find');
  });
  test('--action flag', () => {
    expect(parseArgs(['node', 'x', 'resolve', '--action', 'MORE_CONTEXT']).action).toBe('MORE_CONTEXT');
  });
  test('--state filter', () => {
    expect(parseArgs(['node', 'x', 'list', '--state', 'blocked']).state).toBe('blocked');
  });
  test('returns all expected fields with defaults', () => {
    const r = parseArgs(['node', 'x', 'start']);
    ['cmd', 'story', 'agent', 'model', 'task', 'taskId', 'note', 'missing', 'reason', 'action', 'state'].forEach(
      (k) => {
        expect(r).toHaveProperty(k);
      },
    );
  });
});

const fs = require('fs');
const path = require('path');
const os = require('os');
const { dispatch } = require('../../tools/agent-lifecycle');

describe('dispatch — start + terminal commands', () => {
  let tmpdir, sdlcPath;
  beforeEach(() => {
    tmpdir = fs.mkdtempSync(path.join(os.tmpdir(), 'alc-'));
    sdlcPath = path.join(tmpdir, 'sdlc-status.json');
    fs.writeFileSync(sdlcPath, JSON.stringify({ stories: { 'US-0183': { status: 'InProgress' } } }));
  });
  afterEach(() => fs.rmSync(tmpdir, { recursive: true, force: true }));

  test('start: creates task, prints UUID to stdout only', () => {
    const stdout = [];
    const code = dispatch(
      { cmd: 'start', story: 'US-0183', agent: 'Forge', model: 'sonnet', task: 'implement x' },
      { sdlcPath, skipRegen: true, stdout: (s) => stdout.push(s) },
    );
    expect(code).toBe(0);
    expect(stdout).toHaveLength(1);
    expect(stdout[0]).toMatch(/^task-[0-9a-f-]{36}$/);
    const data = JSON.parse(fs.readFileSync(sdlcPath, 'utf8'));
    expect(data.tasks[stdout[0]].state).toBe('in_progress');
    expect(data.tasks[stdout[0]].agent).toBe('Forge');
  });

  test('start: exits 1 when --story missing', () => {
    expect(dispatch({ cmd: 'start', agent: 'Forge', model: 'sonnet', task: 'x' }, { sdlcPath, skipRegen: true })).toBe(
      1,
    );
  });

  test('done: transitions in_progress → done', () => {
    const stdout = [];
    dispatch(
      { cmd: 'start', story: 'US-0183', agent: 'Forge', model: 'sonnet', task: 'x' },
      { sdlcPath, skipRegen: true, stdout: (s) => stdout.push(s) },
    );
    const taskId = stdout[0];
    expect(dispatch({ cmd: 'done', taskId }, { sdlcPath, skipRegen: true })).toBe(0);
    const data = JSON.parse(fs.readFileSync(sdlcPath, 'utf8'));
    expect(data.tasks[taskId].state).toBe('done');
  });

  test('concerns: transitions to done_with_concerns', () => {
    const stdout = [];
    dispatch(
      { cmd: 'start', story: 'US-0183', agent: 'Forge', model: 'sonnet', task: 'x' },
      { sdlcPath, skipRegen: true, stdout: (s) => stdout.push(s) },
    );
    const taskId = stdout[0];
    expect(dispatch({ cmd: 'concerns', taskId, note: 'edge case' }, { sdlcPath, skipRegen: true })).toBe(0);
    const data = JSON.parse(fs.readFileSync(sdlcPath, 'utf8'));
    expect(data.tasks[taskId].state).toBe('done_with_concerns');
    expect(data.tasks[taskId].concerns).toBe('edge case');
  });

  test('needs-context: transitions to needs_context', () => {
    const stdout = [];
    dispatch(
      { cmd: 'start', story: 'US-0183', agent: 'Forge', model: 'sonnet', task: 'x' },
      { sdlcPath, skipRegen: true, stdout: (s) => stdout.push(s) },
    );
    const taskId = stdout[0];
    expect(dispatch({ cmd: 'needs-context', taskId, missing: 'config path' }, { sdlcPath, skipRegen: true })).toBe(0);
    const data = JSON.parse(fs.readFileSync(sdlcPath, 'utf8'));
    expect(data.tasks[taskId].state).toBe('needs_context');
  });
});

describe('dispatch — blocked + resolve + list + status', () => {
  let tmpdir, sdlcPath;
  function startedTask() {
    const stdout = [];
    dispatch(
      { cmd: 'start', story: 'US-0183', agent: 'Forge', model: 'sonnet', task: 'impl' },
      { sdlcPath, skipRegen: true, stdout: (s) => stdout.push(s) },
    );
    return stdout[0];
  }
  beforeEach(() => {
    tmpdir = fs.mkdtempSync(path.join(os.tmpdir(), 'alc-'));
    sdlcPath = path.join(tmpdir, 'sdlc-status.json');
    fs.writeFileSync(sdlcPath, JSON.stringify({ stories: { 'US-0183': { status: 'InProgress' } } }));
  });
  afterEach(() => fs.rmSync(tmpdir, { recursive: true, force: true }));

  test('blocked: transitions to blocked, prints routing suggestion to stdout', () => {
    const taskId = startedTask();
    const stdout = [];
    const code = dispatch(
      { cmd: 'blocked', taskId, reason: 'cannot find config' },
      { sdlcPath, skipRegen: true, stdout: (s) => stdout.push(s) },
    );
    expect(code).toBe(0);
    expect(stdout.join('')).toContain('MORE_CONTEXT');
    const data = JSON.parse(fs.readFileSync(sdlcPath, 'utf8'));
    expect(data.tasks[taskId].state).toBe('blocked');
  });

  test('blocked: exits 1 after escalation cap', () => {
    const taskId = startedTask();
    for (let i = 0; i < 2; i++) {
      dispatch({ cmd: 'blocked', taskId, reason: 'reason' }, { sdlcPath, skipRegen: true, stdout: () => {} });
      dispatch({ cmd: 'resolve', taskId, action: 'MORE_CONTEXT', note: 'try' }, { sdlcPath, skipRegen: true });
    }
    dispatch({ cmd: 'blocked', taskId, reason: 'final' }, { sdlcPath, skipRegen: true, stdout: () => {} });
    const code = dispatch({ cmd: 'resolve', taskId, action: 'MORE_CONTEXT', note: 'x' }, { sdlcPath, skipRegen: true });
    expect(code).toBe(1);
    const data = JSON.parse(fs.readFileSync(sdlcPath, 'utf8'));
    expect(data.tasks[taskId].state).toBe('escalated');
  });

  test('resolve: transitions blocked → in_progress', () => {
    const taskId = startedTask();
    dispatch({ cmd: 'blocked', taskId, reason: 'missing schema' }, { sdlcPath, skipRegen: true, stdout: () => {} });
    expect(
      dispatch({ cmd: 'resolve', taskId, action: 'MORE_CONTEXT', note: 'added schema' }, { sdlcPath, skipRegen: true }),
    ).toBe(0);
    const data = JSON.parse(fs.readFileSync(sdlcPath, 'utf8'));
    expect(data.tasks[taskId].state).toBe('in_progress');
    expect(data.tasks[taskId].blockedResolutions).toHaveLength(1);
  });

  test('list: prints task rows for story', () => {
    startedTask();
    const stdout = [];
    expect(
      dispatch({ cmd: 'list', story: 'US-0183' }, { sdlcPath, skipRegen: true, stdout: (s) => stdout.push(s) }),
    ).toBe(0);
    expect(stdout.join('\n')).toMatch(/in_progress/);
  });

  test('status: prints task JSON', () => {
    const taskId = startedTask();
    const stdout = [];
    expect(dispatch({ cmd: 'status', taskId }, { sdlcPath, skipRegen: true, stdout: (s) => stdout.push(s) })).toBe(0);
    const parsed = JSON.parse(stdout.join(''));
    expect(parsed.id).toBe(taskId);
    expect(parsed.state).toBe('in_progress');
  });
});
