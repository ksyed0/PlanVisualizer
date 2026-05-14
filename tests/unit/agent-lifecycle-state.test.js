'use strict';
const { initTask, startTask, TASK_STATES } = require('../../tools/lib/agent-lifecycle-state');

describe('TASK_STATES', () => {
  test('contains all 6 valid states', () => {
    expect(TASK_STATES).toEqual(['in_progress', 'done', 'done_with_concerns', 'needs_context', 'blocked', 'escalated']);
  });
});

describe('initTask', () => {
  test('returns task object with all required fields', () => {
    const t = initTask({ story: 'US-0183', agent: 'Forge', model: 'sonnet', description: 'implement x' });
    expect(t.id).toMatch(/^task-[0-9a-f-]{36}$/);
    expect(t.story).toBe('US-0183');
    expect(t.agent).toBe('Forge');
    expect(t.model).toBe('sonnet');
    expect(t.description).toBe('implement x');
    expect(t.state).toBe('in_progress');
    expect(t.concerns).toBeNull();
    expect(t.blockedReason).toBeNull();
    expect(t.blockedResolutions).toEqual([]);
    expect(t.completedAt).toBeNull();
    expect(t.retryCount).toBe(0);
    expect(typeof t.startedAt).toBe('string');
  });

  test('generates unique IDs on each call', () => {
    const a = initTask({ story: 'US-0183', agent: 'Forge', model: 'sonnet', description: 'x' });
    const b = initTask({ story: 'US-0183', agent: 'Forge', model: 'sonnet', description: 'y' });
    expect(a.id).not.toBe(b.id);
  });

  test('defaults model to sonnet when not provided', () => {
    const t = initTask({ story: 'US-0183', agent: 'Forge', description: 'x' });
    expect(t.model).toBe('sonnet');
  });
});

describe('startTask', () => {
  test('persists task into sdlcData.tasks under the task ID', () => {
    const data = { tasks: {} };
    const t = initTask({ story: 'US-0183', agent: 'Forge', model: 'sonnet', description: 'x' });
    startTask(data, t);
    expect(data.tasks[t.id]).toBe(t);
  });

  test('creates data.tasks if missing', () => {
    const data = {};
    const t = initTask({ story: 'US-0183', agent: 'Forge', model: 'sonnet', description: 'x' });
    startTask(data, t);
    expect(data.tasks[t.id]).toBe(t);
  });
});

const { markDone, markConcerns, markNeedsContext } = require('../../tools/lib/agent-lifecycle-state');

function freshTask() {
  const data = {};
  const t = initTask({ story: 'US-0183', agent: 'Forge', model: 'sonnet', description: 'test task' });
  startTask(data, t);
  return { data, t };
}

describe('markDone', () => {
  test('transitions in_progress → done, records completedAt', () => {
    const { data, t } = freshTask();
    markDone(data, t.id);
    expect(data.tasks[t.id].state).toBe('done');
    expect(data.tasks[t.id].completedAt).toMatch(/\d{4}-\d{2}-\d{2}T/);
  });

  test('throws when task not found', () => {
    expect(() => markDone({}, 'task-nonexistent')).toThrow(/not found/i);
  });

  test('throws when state is not in_progress', () => {
    const { data, t } = freshTask();
    markDone(data, t.id);
    expect(() => markDone(data, t.id)).toThrow(/cannot mark done.*'done'/i);
  });
});

describe('markConcerns', () => {
  test('transitions in_progress → done_with_concerns, records note', () => {
    const { data, t } = freshTask();
    markConcerns(data, t.id, 'logic may fail on empty input');
    expect(data.tasks[t.id].state).toBe('done_with_concerns');
    expect(data.tasks[t.id].concerns).toBe('logic may fail on empty input');
    expect(data.tasks[t.id].completedAt).toMatch(/\d{4}-\d{2}-\d{2}T/);
  });

  test('throws when state is not in_progress', () => {
    const { data, t } = freshTask();
    markDone(data, t.id);
    expect(() => markConcerns(data, t.id, 'note')).toThrow(/cannot mark concerns.*'done'/i);
  });
});

describe('markNeedsContext', () => {
  test('transitions in_progress → needs_context, records missing info', () => {
    const { data, t } = freshTask();
    markNeedsContext(data, t.id, 'need the config file path');
    expect(data.tasks[t.id].state).toBe('needs_context');
    expect(data.tasks[t.id].blockedReason).toBe('need the config file path');
  });

  test('throws when state is not in_progress', () => {
    const { data, t } = freshTask();
    markNeedsContext(data, t.id, 'x');
    expect(() => markNeedsContext(data, t.id, 'y')).toThrow(/cannot mark needs-context.*'needs_context'/i);
  });
});
