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
