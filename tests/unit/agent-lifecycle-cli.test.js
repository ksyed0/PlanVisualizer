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
