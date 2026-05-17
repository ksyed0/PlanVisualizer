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
    expect(t.planTaskIndex).toBeNull();
    expect(t.summary).toBeNull();
    expect(t.headSha).toBeNull();
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
    markDone(data, t.id, 'task completed [sha:abc1234]');
    expect(data.tasks[t.id].state).toBe('done');
    expect(data.tasks[t.id].completedAt).toMatch(/\d{4}-\d{2}-\d{2}T/);
  });

  test('throws when task not found', () => {
    expect(() => markDone({}, 'task-nonexistent', 'summary [sha:abc1234]')).toThrow(/not found/i);
  });

  test('throws when state is not in_progress', () => {
    const { data, t } = freshTask();
    markDone(data, t.id, 'done [sha:abc1234]');
    expect(() => markDone(data, t.id, 'retry [sha:abc1234]')).toThrow(/cannot mark done.*'done'/i);
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
    markDone(data, t.id, 'done [sha:abc1234]');
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

const { markBlocked, routeBlockedReason, resolveBlocked } = require('../../tools/lib/agent-lifecycle-state');

describe('routeBlockedReason', () => {
  test('"cannot find config" → MORE_CONTEXT', () => {
    expect(routeBlockedReason('cannot find the config file')).toBe('MORE_CONTEXT');
  });
  test('"not found" → MORE_CONTEXT', () => {
    expect(routeBlockedReason('module not found')).toBe('MORE_CONTEXT');
  });
  test('"ambiguous spec" → MORE_CONTEXT', () => {
    expect(routeBlockedReason('the spec is ambiguous')).toBe('MORE_CONTEXT');
  });
  test('"too complex" → SPLIT_TASK', () => {
    expect(routeBlockedReason('task is too complex')).toBe('SPLIT_TASK');
  });
  test('"access denied" → ESCALATE_HUMAN', () => {
    expect(routeBlockedReason('access denied')).toBe('ESCALATE_HUMAN');
  });
  test('unrecognised reason → UPGRADE_MODEL', () => {
    expect(routeBlockedReason('something completely unexpected happened')).toBe('UPGRADE_MODEL');
  });
  test('empty reason → UPGRADE_MODEL', () => {
    expect(routeBlockedReason('')).toBe('UPGRADE_MODEL');
  });
});

describe('markBlocked', () => {
  test('transitions in_progress → blocked, returns routing suggestion', () => {
    const { data, t } = freshTask();
    const suggestion = markBlocked(data, t.id, 'cannot find the schema file');
    expect(data.tasks[t.id].state).toBe('blocked');
    expect(data.tasks[t.id].blockedReason).toBe('cannot find the schema file');
    expect(suggestion).toBe('MORE_CONTEXT');
  });

  test('throws when state is not in_progress', () => {
    const { data, t } = freshTask();
    markDone(data, t.id, 'done [sha:abc1234]');
    expect(() => markBlocked(data, t.id, 'reason')).toThrow(/cannot mark blocked.*'done'/i);
  });
});

describe('resolveBlocked', () => {
  test('transitions blocked → in_progress, records resolution, increments retryCount', () => {
    const { data, t } = freshTask();
    markBlocked(data, t.id, 'cannot find');
    resolveBlocked(data, t.id, { action: 'MORE_CONTEXT', note: 'added config path to context' });
    const task = data.tasks[t.id];
    expect(task.state).toBe('in_progress');
    expect(task.retryCount).toBe(1);
    expect(task.blockedResolutions).toHaveLength(1);
    expect(task.blockedResolutions[0].action).toBe('MORE_CONTEXT');
    expect(task.blockedResolutions[0].note).toBe('added config path to context');
    expect(typeof task.blockedResolutions[0].resolvedAt).toBe('string');
  });

  test('auto-escalates when resolution cap reached', () => {
    const { data, t } = freshTask();
    // Block + resolve twice (cap = 2)
    for (let i = 0; i < 2; i++) {
      markBlocked(data, t.id, 'reason ' + i);
      resolveBlocked(data, t.id, { action: 'MORE_CONTEXT', note: 'try ' + i });
    }
    // Third block then resolve → exceeds cap → escalated
    markBlocked(data, t.id, 'reason final');
    expect(() => resolveBlocked(data, t.id, { action: 'MORE_CONTEXT', note: 'try final' })).toThrow(/escalated/i);
    expect(data.tasks[t.id].state).toBe('escalated');
  });

  test('throws when task is not blocked', () => {
    const { data, t } = freshTask();
    expect(() => resolveBlocked(data, t.id, { action: 'MORE_CONTEXT', note: 'x' })).toThrow(
      /cannot resolve.*'in_progress'/i,
    );
  });
});

describe('initTask — US-0184 schema additions', () => {
  test('defaults planTaskIndex to null when not provided', () => {
    const t = initTask({ story: 'US-0184', agent: 'Forge', model: 'sonnet', description: 'x' });
    expect(t.planTaskIndex).toBeNull();
  });

  test('stores planTaskIndex when provided', () => {
    const t = initTask({ story: 'US-0184', agent: 'Forge', model: 'sonnet', description: 'x', planTaskIndex: 3 });
    expect(t.planTaskIndex).toBe(3);
  });

  test('stores planTaskIndex: 0 correctly (not dropped to null)', () => {
    const t = initTask({ story: 'US-0184', agent: 'Forge', model: 'sonnet', description: 'x', planTaskIndex: 0 });
    expect(t.planTaskIndex).toBe(0);
  });

  test('drops planTaskIndex: NaN to null', () => {
    const t = initTask({ story: 'US-0184', agent: 'Forge', model: 'sonnet', description: 'x', planTaskIndex: NaN });
    expect(t.planTaskIndex).toBeNull();
  });

  test('defaults summary to null', () => {
    const t = initTask({ story: 'US-0184', agent: 'Forge', model: 'sonnet', description: 'x' });
    expect(t.summary).toBeNull();
  });
});

describe('markDone — US-0185 [sha:...] convention', () => {
  const { markDone } = require('../../tools/lib/agent-lifecycle-state');
  function freshTaskWithId() {
    const data = {};
    const t = initTask({ story: 'US-0185', agent: 'Forge', model: 'sonnet', description: 'x' });
    startTask(data, t);
    return { data, taskId: t.id };
  }

  test('markDone extracts [sha:<hex>] from summary and stores on task.headSha', () => {
    const { data, taskId } = freshTaskWithId();
    markDone(data, taskId, 'Implemented parseFoo [sha:abc1234]');
    expect(data.tasks[taskId].summary).toBe('Implemented parseFoo');
    expect(data.tasks[taskId].headSha).toBe('abc1234');
    expect(data.tasks[taskId].state).toBe('done');
  });

  test('markDone accepts [sha:none] for no-commit tasks', () => {
    const { data, taskId } = freshTaskWithId();
    markDone(data, taskId, 'Reviewed doc, no code changes [sha:none]');
    expect(data.tasks[taskId].summary).toBe('Reviewed doc, no code changes');
    expect(data.tasks[taskId].headSha).toBe('none');
  });

  test('markDone strips trailing whitespace when stripping [sha:...]', () => {
    const { data, taskId } = freshTaskWithId();
    markDone(data, taskId, 'Did the thing   [sha:abc1234]');
    expect(data.tasks[taskId].summary).toBe('Did the thing');
  });

  test('markDone accepts 40-char full SHA', () => {
    const { data, taskId } = freshTaskWithId();
    markDone(data, taskId, 'Did it [sha:abc1234567890abcdef1234567890abcdef12345]');
    expect(data.tasks[taskId].headSha).toBe('abc1234567890abcdef1234567890abcdef12345');
  });

  test('markDone throws when summary is missing', () => {
    const { data, taskId } = freshTaskWithId();
    expect(() => markDone(data, taskId)).toThrow(/summary required.*\[sha:/);
  });

  test('markDone throws when summary lacks [sha:...] token', () => {
    const { data, taskId } = freshTaskWithId();
    expect(() => markDone(data, taskId, 'Did the thing')).toThrow(/\[sha:.*\] token/);
  });

  test('markDone throws when [sha:...] token is not at the end', () => {
    const { data, taskId } = freshTaskWithId();
    expect(() => markDone(data, taskId, 'Did [sha:abc1234] more text')).toThrow(/\[sha:.*\] token/);
  });

  test('markDone throws when SHA hex is malformed', () => {
    const { data, taskId } = freshTaskWithId();
    expect(() => markDone(data, taskId, 'Did it [sha:ZZZ]')).toThrow(/\[sha:.*\] token/);
  });

  test('markDone throws when SHA is too short (<7 chars)', () => {
    const { data, taskId } = freshTaskWithId();
    expect(() => markDone(data, taskId, 'Did it [sha:abc]')).toThrow(/\[sha:.*\] token/);
  });
});
