# US-0183 Task Lifecycle Protocol Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add per-task DONE/DONE_WITH_CONCERNS/NEEDS_CONTEXT/BLOCKED status tracking via `tools/agent-lifecycle.js` CLI; patch three US-0182 engine gaps (plan-update command, specApprove/planApprove idempotency, DM_AGENT verbal-cue rule); and show live task progress in the Agentic Dashboard.

**Architecture:** Pure state-machine module (`agent-lifecycle-state.js`) + CLI wrapper (`agent-lifecycle.js`) following the exact same split as `agent-spec-plan-state.js` / `agent-spec-plan.js`. State stored in `docs/sdlc-status.json` under a new `tasks` object keyed by UUID. `blocked` command pattern-matches the reason text and emits a resolution hint to stdout. Three bundled gap fixes touch the existing state machine and CLI.

**Tech Stack:** Node.js 18+ (`crypto.randomUUID()` built-in), Jest 30, no new dependencies.

**Spec:** `docs/superpowers/specs/2026-05-13-us-0183-task-lifecycle-protocol-design.md`

**Branch:** `feature/US-0183-task-lifecycle-protocol`

---

## File Map

| File                                             | Change                                                                          |
| ------------------------------------------------ | ------------------------------------------------------------------------------- |
| `tools/lib/agent-lifecycle-state.js`             | Create — pure state machine, UUID gen, BLOCKED routing (~200 LOC)               |
| `tools/agent-lifecycle.js`                       | Create — CLI wrapper; `start` prints UUID to stdout (~220 LOC)                  |
| `tools/lib/agent-spec-plan-state.js`             | Modify — idempotent `specApprove`/`planApprove`; add `VALID_PLAN_UPDATE_FIELDS` |
| `tools/agent-spec-plan.js`                       | Modify — add `plan-update` dispatch command                                     |
| `tools/generate-dashboard.js`                    | Modify — `patchTaskList()` called inside `patchDOM()`                           |
| `docs/agents/DM_AGENT.md`                        | Modify — §Per-Task Dispatch Ritual + verbal-cue correction                      |
| `tests/unit/agent-lifecycle-state.test.js`       | Create — ~35 tests                                                              |
| `tests/unit/agent-lifecycle-cli.test.js`         | Create — ~15 tests                                                              |
| `tests/unit/agent-spec-plan-state.test.js`       | Extend — +2 idempotency tests                                                   |
| `tests/unit/agent-spec-plan-cli.test.js`         | Extend — +1 plan-update test                                                    |
| `tests/integration/agent-lifecycle-flow.test.js` | Create — 3 smoke tests                                                          |

---

## Working Branch Setup

```bash
cd /Users/Kamal_Syed/Projects/PlanVisualizer
git fetch origin develop
git checkout -b feature/US-0183-task-lifecycle-protocol origin/develop
```

---

### Task 1: State machine — initTask + startTask

**Files:**

- Create: `tools/lib/agent-lifecycle-state.js`
- Create: `tests/unit/agent-lifecycle-state.test.js`

- [ ] **Step 1: Write failing tests for initTask and startTask**

Create `tests/unit/agent-lifecycle-state.test.js`:

```js
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
```

- [ ] **Step 2: Run tests to confirm failure**

```bash
cd /Users/Kamal_Syed/Projects/PlanVisualizer
npx jest tests/unit/agent-lifecycle-state.test.js --no-coverage 2>&1 | tail -5
```

Expected: `Cannot find module '../../tools/lib/agent-lifecycle-state'`

- [ ] **Step 3: Create `tools/lib/agent-lifecycle-state.js` with initTask + startTask**

```js
'use strict';

const crypto = require('crypto');

const TASK_STATES = ['in_progress', 'done', 'done_with_concerns', 'needs_context', 'blocked', 'escalated'];

// BLOCKED reason → resolution hint mapping (first match wins)
const BLOCKED_ROUTING_RULES = [
  { patterns: ['missing', 'not found', 'undefined', 'no such', 'cannot find'], suggestion: 'MORE_CONTEXT' },
  { patterns: ['ambiguous', 'unclear', 'which', 'conflicting', 'contradiction'], suggestion: 'MORE_CONTEXT' },
  { patterns: ['complex', 'too many', 'large', 'too big', 'scope'], suggestion: 'SPLIT_TASK' },
  { patterns: ['permission', 'access', 'auth', 'credentials'], suggestion: 'ESCALATE_HUMAN' },
];

const ESCALATION_CAP = 2; // blocked resolutions before forced escalation

function nowISO() {
  return new Date().toISOString();
}

/**
 * Generate a fresh task record. Does NOT write to sdlc-status.json yet.
 * Call startTask(data, task) to persist it.
 */
function initTask(opts) {
  return {
    id: 'task-' + crypto.randomUUID(),
    story: opts.story || null,
    agent: opts.agent || null,
    model: opts.model || 'sonnet',
    description: opts.description || '',
    state: 'in_progress',
    concerns: null,
    blockedReason: null,
    blockedResolutions: [],
    startedAt: nowISO(),
    completedAt: null,
    retryCount: 0,
  };
}

/**
 * Persist an initTask() result into sdlcData.tasks.
 */
function startTask(data, task) {
  if (!data.tasks) data.tasks = {};
  data.tasks[task.id] = task;
}

module.exports = {
  TASK_STATES,
  BLOCKED_ROUTING_RULES,
  ESCALATION_CAP,
  initTask,
  startTask,
};
```

- [ ] **Step 4: Run tests to confirm pass**

```bash
npx jest tests/unit/agent-lifecycle-state.test.js --no-coverage 2>&1 | tail -5
```

Expected: all initTask + startTask tests pass.

- [ ] **Step 5: Commit**

```bash
git add tools/lib/agent-lifecycle-state.js tests/unit/agent-lifecycle-state.test.js
git commit -m "feat(US-0183): agent-lifecycle-state.js — initTask, startTask, routing rules"
```

---

### Task 2: State machine — terminal transitions (done/concerns/needs-context)

**Files:**

- Modify: `tools/lib/agent-lifecycle-state.js`
- Modify: `tests/unit/agent-lifecycle-state.test.js`

- [ ] **Step 1: Append failing tests**

```js
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
```

- [ ] **Step 2: Run tests to confirm failure**

```bash
npx jest tests/unit/agent-lifecycle-state.test.js --no-coverage 2>&1 | tail -5
```

- [ ] **Step 3: Add markDone, markConcerns, markNeedsContext to `tools/lib/agent-lifecycle-state.js`**

Append before `module.exports`:

```js
function _requireTask(data, taskId) {
  if (!data.tasks || !data.tasks[taskId]) {
    throw new Error(`Task '${taskId}' not found in sdlc-status.json`);
  }
  return data.tasks[taskId];
}

function _requireState(task, expected) {
  if (task.state !== expected) {
    throw new Error(`Cannot mark ${expected}: task '${task.id}' is in state '${task.state}', expected '${expected}'`);
  }
}

function _requireInProgress(task, operation) {
  if (task.state !== 'in_progress') {
    throw new Error(`Cannot mark ${operation}: task '${task.id}' is in state '${task.state}', expected 'in_progress'`);
  }
}

function markDone(data, taskId) {
  const t = _requireTask(data, taskId);
  _requireInProgress(t, 'done');
  t.state = 'done';
  t.completedAt = nowISO();
}

function markConcerns(data, taskId, note) {
  const t = _requireTask(data, taskId);
  _requireInProgress(t, 'concerns');
  t.state = 'done_with_concerns';
  t.concerns = note || '';
  t.completedAt = nowISO();
}

function markNeedsContext(data, taskId, missing) {
  const t = _requireTask(data, taskId);
  _requireInProgress(t, 'needs-context');
  t.state = 'needs_context';
  t.blockedReason = missing || '';
}
```

Update `module.exports` to add the new functions:

```js
module.exports = {
  TASK_STATES,
  BLOCKED_ROUTING_RULES,
  ESCALATION_CAP,
  initTask,
  startTask,
  markDone,
  markConcerns,
  markNeedsContext,
};
```

- [ ] **Step 4: Run tests to confirm pass**

```bash
npx jest tests/unit/agent-lifecycle-state.test.js --no-coverage 2>&1 | tail -5
```

- [ ] **Step 5: Commit**

```bash
git add tools/lib/agent-lifecycle-state.js tests/unit/agent-lifecycle-state.test.js
git commit -m "feat(US-0183): terminal state transitions — done, done_with_concerns, needs_context"
```

---

### Task 3: State machine — blocked routing + resolve + escalation

**Files:**

- Modify: `tools/lib/agent-lifecycle-state.js`
- Modify: `tests/unit/agent-lifecycle-state.test.js`

- [ ] **Step 1: Append failing tests**

```js
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
    markDone(data, t.id);
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
    // First block + resolve
    markBlocked(data, t.id, 'reason 1');
    resolveBlocked(data, t.id, { action: 'MORE_CONTEXT', note: 'try 1' });
    // Second block + resolve (cap = 2, this is attempt 2)
    markBlocked(data, t.id, 'reason 2');
    resolveBlocked(data, t.id, { action: 'MORE_CONTEXT', note: 'try 2' });
    // Third block — exceeds cap → escalated
    markBlocked(data, t.id, 'reason 3');
    expect(data.tasks[t.id].state).toBe('blocked');
    // Now resolve should escalate
    expect(() => resolveBlocked(data, t.id, { action: 'MORE_CONTEXT', note: 'try 3' })).toThrow(/escalated/i);
    expect(data.tasks[t.id].state).toBe('escalated');
  });

  test('throws when task is not blocked', () => {
    const { data, t } = freshTask();
    expect(() => resolveBlocked(data, t.id, { action: 'MORE_CONTEXT', note: 'x' })).toThrow(
      /cannot resolve.*'in_progress'/i,
    );
  });
});
```

- [ ] **Step 2: Run tests to confirm failure**

```bash
npx jest tests/unit/agent-lifecycle-state.test.js --no-coverage 2>&1 | tail -5
```

- [ ] **Step 3: Add routeBlockedReason, markBlocked, resolveBlocked to `tools/lib/agent-lifecycle-state.js`**

Append before `module.exports`:

```js
/**
 * Pattern-match blocked reason text → resolution suggestion.
 * Returns: MORE_CONTEXT | SPLIT_TASK | ESCALATE_HUMAN | UPGRADE_MODEL
 */
function routeBlockedReason(reason) {
  const r = (reason || '').toLowerCase();
  for (const rule of BLOCKED_ROUTING_RULES) {
    if (rule.patterns.some((p) => r.includes(p))) return rule.suggestion;
  }
  return 'UPGRADE_MODEL';
}

/**
 * Mark a task as blocked, return the routing suggestion.
 * @returns {'MORE_CONTEXT'|'SPLIT_TASK'|'ESCALATE_HUMAN'|'UPGRADE_MODEL'}
 */
function markBlocked(data, taskId, reason) {
  const t = _requireTask(data, taskId);
  _requireInProgress(t, 'blocked');
  t.state = 'blocked';
  t.blockedReason = reason || '';
  return routeBlockedReason(reason);
}

/**
 * Attempt to resolve a blocked task. Records the resolution attempt.
 * Auto-escalates if the escalation cap has been reached.
 * @throws if task is not blocked or escalation cap is already exhausted
 */
function resolveBlocked(data, taskId, opts) {
  const t = _requireTask(data, taskId);
  if (t.state !== 'blocked') {
    throw new Error(`Cannot resolve blocked: task '${taskId}' is in state '${t.state}', expected 'blocked'`);
  }
  // Check if we've already exhausted the cap
  if (t.blockedResolutions.length >= ESCALATION_CAP) {
    t.state = 'escalated';
    throw new Error(`Task '${taskId}' has reached escalation cap (${ESCALATION_CAP} resolutions). Forced escalated.`);
  }
  t.blockedResolutions.push({
    attempt: t.blockedResolutions.length + 1,
    action: opts.action || 'UPGRADE_MODEL',
    note: opts.note || '',
    resolvedAt: nowISO(),
  });
  t.retryCount += 1;
  t.state = 'in_progress';
  t.blockedReason = null;
}
```

Update `module.exports`:

```js
module.exports = {
  TASK_STATES,
  BLOCKED_ROUTING_RULES,
  ESCALATION_CAP,
  initTask,
  startTask,
  markDone,
  markConcerns,
  markNeedsContext,
  markBlocked,
  resolveBlocked,
  routeBlockedReason,
};
```

- [ ] **Step 4: Run all state machine tests**

```bash
npx jest tests/unit/agent-lifecycle-state.test.js --no-coverage 2>&1 | tail -5
```

Expected: all 25+ tests pass.

- [ ] **Step 5: Commit**

```bash
git add tools/lib/agent-lifecycle-state.js tests/unit/agent-lifecycle-state.test.js
git commit -m "feat(US-0183): blocked routing, resolve, escalation cap enforcement"
```

---

### Task 4: CLI skeleton — parseArgs

**Files:**

- Create: `tools/agent-lifecycle.js`
- Create: `tests/unit/agent-lifecycle-cli.test.js`

- [ ] **Step 1: Write failing tests for parseArgs**

Create `tests/unit/agent-lifecycle-cli.test.js`:

```js
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
    expect(r).toHaveProperty('cmd');
    expect(r).toHaveProperty('story');
    expect(r).toHaveProperty('agent');
    expect(r).toHaveProperty('model');
    expect(r).toHaveProperty('task');
    expect(r).toHaveProperty('taskId');
    expect(r).toHaveProperty('note');
    expect(r).toHaveProperty('missing');
    expect(r).toHaveProperty('reason');
    expect(r).toHaveProperty('action');
    expect(r).toHaveProperty('state');
  });
});
```

- [ ] **Step 2: Run tests to confirm failure**

```bash
npx jest tests/unit/agent-lifecycle-cli.test.js --no-coverage 2>&1 | tail -5
```

Expected: module not found.

- [ ] **Step 3: Create `tools/agent-lifecycle.js` skeleton with parseArgs**

```js
#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');
const LifeState = require('./lib/agent-lifecycle-state');

const ROOT = path.join(__dirname, '..');
const SDLC_PATH = path.join(ROOT, 'docs/sdlc-status.json');

function parseArgs(argv) {
  const args = argv.slice(2);
  const cmd = args[0] || null;
  const out = {
    cmd,
    story: null,
    agent: null,
    model: null,
    task: null,
    taskId: null,
    note: null,
    missing: null,
    reason: null,
    action: null,
    state: null,
  };
  for (let i = 1; i < args.length; i++) {
    const a = args[i];
    const next = args[i + 1];
    if (a === '--story' && next) {
      out.story = next;
      i++;
    } else if (a === '--agent' && next) {
      out.agent = next;
      i++;
    } else if (a === '--model' && next) {
      out.model = next;
      i++;
    } else if (a === '--task' && next !== undefined) {
      out.task = next;
      i++;
    } else if (a === '--task-id' && next) {
      out.taskId = next;
      i++;
    } else if (a === '--note' && next !== undefined) {
      out.note = next;
      i++;
    } else if (a === '--missing' && next !== undefined) {
      out.missing = next;
      i++;
    } else if (a === '--reason' && next !== undefined) {
      out.reason = next;
      i++;
    } else if (a === '--action' && next) {
      out.action = next;
      i++;
    } else if (a === '--state' && next) {
      out.state = next;
      i++;
    }
  }
  return out;
}

function main() {
  const opts = parseArgs(process.argv);
  if (!opts.cmd) {
    console.error('Usage: node tools/agent-lifecycle.js <command> [options]');
    console.error('Commands: start, done, concerns, needs-context, blocked, resolve, list, status');
    return 1;
  }
  // Dispatch added in Task 5
  console.error(`[agent-lifecycle] dispatch not yet implemented for '${opts.cmd}'`);
  return 1;
}

module.exports = { parseArgs, main };

if (require.main === module) process.exit(main());
```

- [ ] **Step 4: Run tests to confirm pass**

```bash
npx jest tests/unit/agent-lifecycle-cli.test.js --no-coverage 2>&1 | tail -5
```

Expected: all 12 parseArgs tests pass.

- [ ] **Step 5: Commit**

```bash
git add tools/agent-lifecycle.js tests/unit/agent-lifecycle-cli.test.js
git commit -m "feat(US-0183): agent-lifecycle.js CLI skeleton with parseArgs"
```

---

### Task 5: CLI dispatch — start (UUID to stdout) + done/concerns/needs-context

**Files:**

- Modify: `tools/agent-lifecycle.js`
- Modify: `tests/unit/agent-lifecycle-cli.test.js`

- [ ] **Step 1: Append failing dispatch tests**

```js
const fs = require('fs');
const path = require('path');
const os = require('os');
const { dispatch } = require('../../tools/agent-lifecycle');

describe('dispatch — start', () => {
  let tmpdir, sdlcPath;
  beforeEach(() => {
    tmpdir = fs.mkdtempSync(path.join(os.tmpdir(), 'alc-'));
    sdlcPath = path.join(tmpdir, 'sdlc-status.json');
    fs.writeFileSync(sdlcPath, JSON.stringify({ stories: { 'US-0183': { status: 'InProgress' } } }));
  });
  afterEach(() => fs.rmSync(tmpdir, { recursive: true, force: true }));

  test('start: creates task in sdlc-status.json, prints UUID to stdout', () => {
    const stdout = [];
    const code = dispatch(
      { cmd: 'start', story: 'US-0183', agent: 'Forge', model: 'sonnet', task: 'implement x' },
      { sdlcPath, stdout: (s) => stdout.push(s) },
    );
    expect(code).toBe(0);
    expect(stdout).toHaveLength(1);
    expect(stdout[0]).toMatch(/^task-[0-9a-f-]{36}$/);
    const data = JSON.parse(fs.readFileSync(sdlcPath, 'utf8'));
    expect(data.tasks[stdout[0]].state).toBe('in_progress');
    expect(data.tasks[stdout[0]].agent).toBe('Forge');
  });

  test('start: exits 1 when --story missing', () => {
    const code = dispatch({ cmd: 'start', agent: 'Forge', model: 'sonnet', task: 'x' }, { sdlcPath });
    expect(code).toBe(1);
  });

  test('done: transitions in_progress → done', () => {
    const stdout = [];
    dispatch(
      { cmd: 'start', story: 'US-0183', agent: 'Forge', model: 'sonnet', task: 'x' },
      { sdlcPath, stdout: (s) => stdout.push(s) },
    );
    const taskId = stdout[0];
    const code = dispatch({ cmd: 'done', taskId }, { sdlcPath });
    expect(code).toBe(0);
    const data = JSON.parse(fs.readFileSync(sdlcPath, 'utf8'));
    expect(data.tasks[taskId].state).toBe('done');
    expect(data.tasks[taskId].completedAt).toBeTruthy();
  });

  test('concerns: transitions in_progress → done_with_concerns', () => {
    const stdout = [];
    dispatch(
      { cmd: 'start', story: 'US-0183', agent: 'Forge', model: 'sonnet', task: 'x' },
      { sdlcPath, stdout: (s) => stdout.push(s) },
    );
    const taskId = stdout[0];
    const code = dispatch({ cmd: 'concerns', taskId, note: 'edge case missing' }, { sdlcPath });
    expect(code).toBe(0);
    const data = JSON.parse(fs.readFileSync(sdlcPath, 'utf8'));
    expect(data.tasks[taskId].state).toBe('done_with_concerns');
    expect(data.tasks[taskId].concerns).toBe('edge case missing');
  });

  test('needs-context: transitions in_progress → needs_context', () => {
    const stdout = [];
    dispatch(
      { cmd: 'start', story: 'US-0183', agent: 'Forge', model: 'sonnet', task: 'x' },
      { sdlcPath, stdout: (s) => stdout.push(s) },
    );
    const taskId = stdout[0];
    const code = dispatch({ cmd: 'needs-context', taskId, missing: 'config path' }, { sdlcPath });
    expect(code).toBe(0);
    const data = JSON.parse(fs.readFileSync(sdlcPath, 'utf8'));
    expect(data.tasks[taskId].state).toBe('needs_context');
  });
});
```

- [ ] **Step 2: Run tests to confirm failure**

```bash
npx jest tests/unit/agent-lifecycle-cli.test.js --no-coverage 2>&1 | tail -5
```

- [ ] **Step 3: Implement dispatch in `tools/agent-lifecycle.js`**

Add after `parseArgs`:

```js
function readSdlc(sdlcPath) {
  return JSON.parse(fs.readFileSync(sdlcPath, 'utf8'));
}

function writeSdlc(sdlcPath, data) {
  fs.writeFileSync(sdlcPath, JSON.stringify(data, null, 2) + '\n');
}

function regenDashboard(ctx) {
  if (ctx && ctx.skipRegen) return;
  try {
    const script = path.join(ROOT, 'tools/generate-dashboard.js');
    if (fs.existsSync(script)) require('./generate-dashboard');
  } catch {
    /* silent */
  }
}

function dispatch(opts, ctx = {}) {
  const sdlcPath = ctx.sdlcPath || SDLC_PATH;
  const stdout = ctx.stdout || ((s) => process.stdout.write(s + '\n'));
  const cmd = opts.cmd;

  let data;
  try {
    data = readSdlc(sdlcPath);
  } catch (e) {
    console.error(`[agent-lifecycle] cannot read ${sdlcPath}: ${e.message}`);
    return 1;
  }

  try {
    switch (cmd) {
      case 'start': {
        if (!opts.story) {
          console.error('--story required');
          return 1;
        }
        if (!opts.agent) {
          console.error('--agent required');
          return 1;
        }
        const task = LifeState.initTask({
          story: opts.story,
          agent: opts.agent,
          model: opts.model,
          description: opts.task || '',
        });
        LifeState.startTask(data, task);
        writeSdlc(sdlcPath, data);
        stdout(task.id); // UUID only — no other text on stdout
        regenDashboard(ctx);
        return 0;
      }
      case 'done': {
        if (!opts.taskId) {
          console.error('--task-id required');
          return 1;
        }
        LifeState.markDone(data, opts.taskId);
        writeSdlc(sdlcPath, data);
        regenDashboard(ctx);
        return 0;
      }
      case 'concerns': {
        if (!opts.taskId) {
          console.error('--task-id required');
          return 1;
        }
        LifeState.markConcerns(data, opts.taskId, opts.note || '');
        writeSdlc(sdlcPath, data);
        regenDashboard(ctx);
        return 0;
      }
      case 'needs-context': {
        if (!opts.taskId) {
          console.error('--task-id required');
          return 1;
        }
        LifeState.markNeedsContext(data, opts.taskId, opts.missing || '');
        writeSdlc(sdlcPath, data);
        regenDashboard(ctx);
        return 0;
      }
      default:
        console.error(`[agent-lifecycle] unknown command '${cmd}'`);
        return 1;
    }
  } catch (e) {
    console.error(`[agent-lifecycle] ${e.message}`);
    return 1;
  }
}
```

Update `module.exports` and `main`:

```js
function main() {
  const opts = parseArgs(process.argv);
  if (!opts.cmd) {
    console.error('Usage: node tools/agent-lifecycle.js <command> [options]');
    return 1;
  }
  return dispatch(opts);
}

module.exports = { parseArgs, dispatch, main };
```

- [ ] **Step 4: Run tests to confirm pass**

```bash
npx jest tests/unit/agent-lifecycle-cli.test.js --no-coverage 2>&1 | tail -5
```

Expected: 17 tests pass.

- [ ] **Step 5: Commit**

```bash
git add tools/agent-lifecycle.js tests/unit/agent-lifecycle-cli.test.js
git commit -m "feat(US-0183): CLI dispatch — start (UUID stdout), done, concerns, needs-context"
```

---

### Task 6: CLI dispatch — blocked, resolve, list, status

**Files:**

- Modify: `tools/agent-lifecycle.js`
- Modify: `tests/unit/agent-lifecycle-cli.test.js`

- [ ] **Step 1: Append failing tests**

```js
describe('dispatch — blocked + resolve + list + status', () => {
  let tmpdir, sdlcPath;
  function startedTask() {
    const stdout = [];
    dispatch(
      { cmd: 'start', story: 'US-0183', agent: 'Forge', model: 'sonnet', task: 'impl' },
      { sdlcPath, stdout: (s) => stdout.push(s) },
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
      { sdlcPath, stdout: (s) => stdout.push(s) },
    );
    expect(code).toBe(0);
    expect(stdout.join('')).toContain('MORE_CONTEXT');
    const data = JSON.parse(fs.readFileSync(sdlcPath, 'utf8'));
    expect(data.tasks[taskId].state).toBe('blocked');
  });

  test('blocked: exits 1 after escalation cap', () => {
    const taskId = startedTask();
    // Block → resolve × 2, then block again should escalate
    for (let i = 0; i < 2; i++) {
      dispatch({ cmd: 'blocked', taskId, reason: 'reason' }, { sdlcPath });
      dispatch({ cmd: 'resolve', taskId, action: 'MORE_CONTEXT', note: 'try' }, { sdlcPath });
    }
    dispatch({ cmd: 'blocked', taskId, reason: 'final' }, { sdlcPath });
    const code = dispatch({ cmd: 'resolve', taskId, action: 'MORE_CONTEXT', note: 'x' }, { sdlcPath });
    expect(code).toBe(1); // escalated
    const data = JSON.parse(fs.readFileSync(sdlcPath, 'utf8'));
    expect(data.tasks[taskId].state).toBe('escalated');
  });

  test('resolve: transitions blocked → in_progress', () => {
    const taskId = startedTask();
    dispatch({ cmd: 'blocked', taskId, reason: 'missing schema' }, { sdlcPath });
    const code = dispatch({ cmd: 'resolve', taskId, action: 'MORE_CONTEXT', note: 'added schema' }, { sdlcPath });
    expect(code).toBe(0);
    const data = JSON.parse(fs.readFileSync(sdlcPath, 'utf8'));
    expect(data.tasks[taskId].state).toBe('in_progress');
    expect(data.tasks[taskId].blockedResolutions).toHaveLength(1);
  });

  test('list: prints task rows for story', () => {
    startedTask();
    const stdout = [];
    const code = dispatch({ cmd: 'list', story: 'US-0183' }, { sdlcPath, stdout: (s) => stdout.push(s) });
    expect(code).toBe(0);
    expect(stdout.join('\n')).toMatch(/in_progress/);
    expect(stdout.join('\n')).toMatch(/US-0183/);
  });

  test('status: prints task JSON', () => {
    const taskId = startedTask();
    const stdout = [];
    const code = dispatch({ cmd: 'status', taskId }, { sdlcPath, stdout: (s) => stdout.push(s) });
    expect(code).toBe(0);
    const parsed = JSON.parse(stdout.join(''));
    expect(parsed.id).toBe(taskId);
    expect(parsed.state).toBe('in_progress');
  });
});
```

- [ ] **Step 2: Run tests to confirm failure**

```bash
npx jest tests/unit/agent-lifecycle-cli.test.js --no-coverage 2>&1 | tail -5
```

- [ ] **Step 3: Add remaining cases to dispatch switch in `tools/agent-lifecycle.js`**

Add these cases to the `switch (cmd)` block (before the `default:`):

```js
      case 'blocked': {
        if (!opts.taskId) { console.error('--task-id required'); return 1; }
        const suggestion = LifeState.markBlocked(data, opts.taskId, opts.reason || '');
        writeSdlc(sdlcPath, data);
        stdout(suggestion);
        regenDashboard(ctx);
        return 0;
      }
      case 'resolve': {
        if (!opts.taskId) { console.error('--task-id required'); return 1; }
        try {
          LifeState.resolveBlocked(data, opts.taskId, { action: opts.action, note: opts.note });
          writeSdlc(sdlcPath, data);
          regenDashboard(ctx);
          return 0;
        } catch (e) {
          // resolveBlocked throws and sets state to escalated
          writeSdlc(sdlcPath, data);
          console.error(`[agent-lifecycle] ${e.message}`);
          return 1;
        }
      }
      case 'list': {
        const tasks = data.tasks || {};
        const rows = Object.values(tasks).filter((t) => {
          if (opts.story && t.story !== opts.story) return false;
          if (opts.state && t.state !== opts.state) return false;
          return true;
        });
        if (rows.length === 0) {
          stdout('[agent-lifecycle] No matching tasks.');
        } else {
          rows.forEach((t) =>
            stdout(`  ${t.id}  ${t.story || '—'}  ${t.agent}  ${t.state}  "${t.description}"`),
          );
        }
        return 0;
      }
      case 'status': {
        if (!opts.taskId) { console.error('--task-id required'); return 1; }
        const t = (data.tasks || {})[opts.taskId];
        if (!t) { console.error(`[agent-lifecycle] task '${opts.taskId}' not found`); return 1; }
        stdout(JSON.stringify(t, null, 2));
        return 0;
      }
```

- [ ] **Step 4: Run full CLI test suite**

```bash
npx jest tests/unit/agent-lifecycle-cli.test.js --no-coverage 2>&1 | tail -5
```

Expected: all 23+ tests pass.

- [ ] **Step 5: Run state machine tests still pass**

```bash
npx jest tests/unit/agent-lifecycle-state.test.js tests/unit/agent-lifecycle-cli.test.js --no-coverage 2>&1 | tail -5
```

- [ ] **Step 6: Commit**

```bash
git add tools/agent-lifecycle.js tests/unit/agent-lifecycle-cli.test.js
git commit -m "feat(US-0183): CLI dispatch complete — blocked, resolve, list, status"
```

---

### Task 7: Gap fix — plan-update command + specApprove/planApprove idempotency

**Files:**

- Modify: `tools/lib/agent-spec-plan-state.js`
- Modify: `tools/agent-spec-plan.js`
- Modify: `tests/unit/agent-spec-plan-state.test.js`
- Modify: `tests/unit/agent-spec-plan-cli.test.js`

- [ ] **Step 1: Append idempotency tests to `tests/unit/agent-spec-plan-state.test.js`**

```js
describe('specApprove / planApprove — idempotency', () => {
  test('specApprove on already-approved state returns unchanged orchestration, no error', () => {
    let s = specApprove(
      specAwaitFinal(specReviewResult(acApprove(specAwaitAc(specStart(initStory(), {}))), { verdict: 'APPROVED' })),
    );
    // Second call — should not throw
    const before = s.specPhase.specApprovedAt;
    s = specApprove(s); // was: throws; now: no-op
    expect(s.specPhase.state).toBe('approved');
    expect(s.specPhase.specApprovedAt).toBe(before); // timestamp unchanged
  });

  test('planApprove on already-approved state returns unchanged orchestration, no error', () => {
    function approvedSpec() {
      let s = specStart(initStory(), {});
      s = specAwaitAc(s);
      s = acApprove(s);
      s = specReviewResult(s, { verdict: 'APPROVED' });
      s = specAwaitFinal(s);
      return specApprove(s);
    }
    let s = planApprove(
      planAwaitApproval(planReviewResult(planStart(approvedSpec(), { author: 'Keystone' }), { verdict: 'APPROVED' })),
    );
    const before = s.planPhase.planApprovedAt;
    s = planApprove(s);
    expect(s.planPhase.state).toBe('approved');
    expect(s.planPhase.planApprovedAt).toBe(before);
  });
});
```

- [ ] **Step 2: Append plan-update test to `tests/unit/agent-spec-plan-cli.test.js`**

```js
describe('dispatch — plan-update', () => {
  let tmpdir, sdlcPath;
  beforeEach(() => {
    tmpdir = fs.mkdtempSync(path.join(os.tmpdir(), 'agt-plan-upd-'));
    sdlcPath = path.join(tmpdir, 'sdlc-status.json');
    fs.writeFileSync(sdlcPath, JSON.stringify({ stories: { 'US-0183': { status: 'Planned' } } }));
  });
  afterEach(() => fs.rmSync(tmpdir, { recursive: true, force: true }));

  test('plan-update sets planPath on planPhase', () => {
    // Set up spec + plan phase
    dispatch({ cmd: 'spec-start', story: 'US-0183' }, { sdlcPath });
    dispatch({ cmd: 'spec-await-ac', story: 'US-0183' }, { sdlcPath });
    dispatch({ cmd: 'approve', story: 'US-0183', gate: 'ac' }, { sdlcPath });
    dispatch({ cmd: 'spec-review-result', story: 'US-0183', verdict: 'APPROVED' }, { sdlcPath });
    dispatch({ cmd: 'spec-await-final', story: 'US-0183' }, { sdlcPath });
    dispatch({ cmd: 'approve', story: 'US-0183', gate: 'spec' }, { sdlcPath });
    dispatch({ cmd: 'plan-start', story: 'US-0183', author: 'Keystone' }, { sdlcPath });
    // Now update planPath
    const code = dispatch(
      {
        cmd: 'plan-update',
        story: 'US-0183',
        field: 'planPath',
        value: 'docs/superpowers/plans/2026-05-14-us-0183.md',
      },
      { sdlcPath },
    );
    expect(code).toBe(0);
    const data = JSON.parse(fs.readFileSync(sdlcPath, 'utf8'));
    expect(data.stories['US-0183'].planPhase.planPath).toBe('docs/superpowers/plans/2026-05-14-us-0183.md');
  });
});
```

- [ ] **Step 3: Run tests to confirm failures**

```bash
npx jest tests/unit/agent-spec-plan-state.test.js tests/unit/agent-spec-plan-cli.test.js --no-coverage 2>&1 | tail -8
```

Expected: idempotency tests fail (specApprove/planApprove throw on second call), plan-update fails (unknown command).

- [ ] **Step 4: Fix `specApprove` and `planApprove` in `tools/lib/agent-spec-plan-state.js`**

Find and update the `specApprove` function:

```js
/** approve --gate spec */
function specApprove(orchestration) {
  // Idempotent: if already approved, return unchanged
  if (orchestration.specPhase.state === 'approved') return orchestration;
  if (orchestration.specPhase.state !== 'awaiting_spec_approval') {
    throw new Error(
      `Cannot approve spec: specPhase is '${orchestration.specPhase.state}', expected 'awaiting_spec_approval'`,
    );
  }
  const o = _exitPhase(orchestration, 'spec');
  return {
    ...o,
    specPhase: {
      ...o.specPhase,
      state: 'approved',
      specApprovedAt: nowISO(),
    },
  };
}
```

Find and update `planApprove`:

```js
/** approve --gate plan */
function planApprove(orchestration) {
  // Idempotent: if already approved, return unchanged
  if (orchestration.planPhase.state === 'approved') return orchestration;
  if (orchestration.planPhase.state !== 'awaiting_plan_approval') {
    throw new Error(
      `Cannot approve plan: planPhase is '${orchestration.planPhase.state}', expected 'awaiting_plan_approval'`,
    );
  }
  const o = _exitPhase(orchestration, 'plan');
  return {
    ...o,
    planPhase: {
      ...o.planPhase,
      state: 'approved',
      planApprovedAt: nowISO(),
    },
  };
}
```

- [ ] **Step 5: Add `VALID_PLAN_UPDATE_FIELDS` and `plan-update` to `tools/lib/agent-spec-plan-state.js`**

Near the existing `VALID_SPEC_UPDATE_FIELDS` constant (line ~59), add:

```js
const VALID_PLAN_UPDATE_FIELDS = ['planPath'];
```

Then add a `planUpdate` function near `specUpdate`:

```js
/** plan-update: update a planPhase field */
function planUpdate(orchestration, opts) {
  if (!VALID_PLAN_UPDATE_FIELDS.includes(opts.field)) {
    throw new Error(`Unknown plan field '${opts.field}'; valid: ${VALID_PLAN_UPDATE_FIELDS.join(', ')}`);
  }
  return {
    ...orchestration,
    planPhase: { ...orchestration.planPhase, [opts.field]: opts.value },
  };
}
```

Export it:

```js
module.exports = {
  // ... existing exports ...
  planUpdate,
};
```

- [ ] **Step 6: Add `plan-update` dispatch to `tools/agent-spec-plan.js`**

In the `switch (cmd)` block, add before the existing `plan-start` case:

```js
      case 'plan-update':
        if (!opts.field) { console.error('--field required'); return 1; }
        newOrch = State.planUpdate(orch, { field: opts.field, value: opts.value });
        applyOrchestration(story, newOrch);
        writeSdlc(sdlcPath, data);
        return 0;
```

- [ ] **Step 7: Run tests to confirm all pass**

```bash
npx jest tests/unit/agent-spec-plan-state.test.js tests/unit/agent-spec-plan-cli.test.js --no-coverage 2>&1 | tail -5
```

Expected: all tests pass including the 2 new idempotency tests and plan-update test.

- [ ] **Step 8: Commit**

```bash
git add tools/lib/agent-spec-plan-state.js tools/agent-spec-plan.js \
  tests/unit/agent-spec-plan-state.test.js tests/unit/agent-spec-plan-cli.test.js
git commit -m "fix(US-0183): specApprove/planApprove idempotent; add plan-update command"
```

---

### Task 8: Dashboard — patchTaskList() in patchDOM()

**Files:**

- Modify: `tools/generate-dashboard.js`

- [ ] **Step 1: Locate the end of patchDOM() and add patchTaskList call**

```bash
cd /Users/Kamal_Syed/Projects/PlanVisualizer
grep -n "patchPendingApprovals(status);" tools/generate-dashboard.js
```

Expected: a line near the end of `patchDOM()` that calls `patchPendingApprovals`.

- [ ] **Step 2: Add the patchTaskList call inside patchDOM**

Find:

```js
  // --- US-0181: Pending Approvals sidebar panel
  patchPendingApprovals(status);
}
```

Change to:

```js
  // --- US-0181: Pending Approvals sidebar panel
  patchPendingApprovals(status);

  // --- US-0183: Per-task progress on active story cards
  patchTaskList(status);
}
```

- [ ] **Step 3: Add the patchTaskList function**

Find `function patchPendingApprovals(status) {` and insert this new function **immediately before** it:

```js
// US-0183: Show live task progress (state + description) below each active agent card.
// Groups sdlc-status.tasks by story, finds the active story for each agent, renders inline.
function patchTaskList(status) {
  if (!status || !status.tasks) return;

  // Group tasks by story
  var tasksByStory = {};
  Object.keys(status.tasks).forEach(function (id) {
    var t = status.tasks[id];
    if (!t || !t.story) return;
    if (!tasksByStory[t.story]) tasksByStory[t.story] = [];
    tasksByStory[t.story].push(t);
  });

  // For each active agent card, find their current story and render tasks
  var agents = (status && status.agents) || {};
  Object.keys(agents).forEach(function (name) {
    var agent = agents[name];
    if (!agent || agent.status !== 'active' || !agent.currentStory) return;
    var story = agent.currentStory;
    var tasks = tasksByStory[story];
    if (!tasks || tasks.length === 0) return;

    // Find task list container on the agent's card (we use data-agent attribute)
    var card = document.querySelector('[data-agent="' + name + '"]');
    if (!card) return;

    var containerId = 'mc-tasks-' + name.replace(/[^a-zA-Z0-9]/g, '-');
    var container = document.getElementById(containerId);
    if (!container) {
      container = document.createElement('div');
      container.id = containerId;
      container.style.cssText = 'margin-top:6px;font-size:10px;padding:0 14px 8px;';
      card.appendChild(container);
    }

    var html = tasks
      .slice(-5)
      .map(function (t) {
        var color =
          t.state === 'done'
            ? 'var(--ok)'
            : t.state === 'blocked' || t.state === 'escalated'
              ? 'var(--risk)'
              : t.state === 'done_with_concerns'
                ? 'var(--warn)'
                : 'var(--text-mute)';
        var label = t.state.replace(/_/g, ' ').toUpperCase();
        var desc = t.description ? t.description.slice(0, 55) + (t.description.length > 55 ? '…' : '') : '';
        return (
          '<div style="display:flex;gap:6px;align-items:baseline;margin-bottom:2px">' +
          '<span style="color:' +
          color +
          ';font-weight:700;min-width:80px">' +
          label +
          '</span>' +
          '<span style="color:var(--text-dim)">' +
          desc +
          '</span>' +
          '</div>'
        );
      })
      .join('');

    container.innerHTML = html;
  });
}
```

- [ ] **Step 4: Smoke-test dashboard regeneration**

```bash
node tools/generate-dashboard.js 2>&1 | tail -2
node -e "require('./tools/generate-dashboard').generateHTML(require('./docs/sdlc-status.json'))" 2>&1 | grep -i "error" | head -3
```

Expected: no errors, dashboard generates cleanly.

- [ ] **Step 5: Run generate-dashboard tests**

```bash
npx jest tests/unit/generate-dashboard.test.js --no-coverage 2>&1 | tail -5
```

Expected: all tests pass.

- [ ] **Step 6: Commit**

```bash
git add tools/generate-dashboard.js docs/dashboard.html
git commit -m "feat(US-0183): patchTaskList() — live per-task progress on active agent cards"
```

---

### Task 9: DM_AGENT.md — Per-Task Dispatch Ritual + verbal-cue correction

**Files:**

- Modify: `docs/agents/DM_AGENT.md`

- [ ] **Step 1: Insert §Per-Task Dispatch Ritual into DM_AGENT.md**

Find `### Model Selection Ritual` in `docs/agents/DM_AGENT.md`. Insert a new subsection **after** the Model Selection Ritual section (after its closing `---`):

````markdown
### Per-Task Dispatch Ritual

For each task a specialist agent works within a story:

1. **Record task start and capture the UUID:**
   ```bash
   TASK_ID=$(node tools/agent-lifecycle.js start \
     --story <id> --agent <name> --model <tier> --task "<description>")
   ```
````

The UUID is printed to stdout only — capture it via `$()`.

2. **Agent works the task** (inline or as a sub-subagent with `isolation: "worktree"`).

3. **Agent reports status** — Conductor calls the matching command:
   | Agent says | Conductor runs |
   |---|---|
   | Task complete, no issues | `node tools/agent-lifecycle.js done --task-id $TASK_ID` |
   | Complete but has a doubt | `node tools/agent-lifecycle.js concerns --task-id $TASK_ID --note "<doubt>"` |
   | Needs specific information | `node tools/agent-lifecycle.js needs-context --task-id $TASK_ID --missing "<what>"` |
   | Stuck, cannot proceed | `node tools/agent-lifecycle.js blocked --task-id $TASK_ID --reason "<why>"` |

4. **On BLOCKED:** read the routing suggestion from stdout (MORE_CONTEXT / SPLIT_TASK / UPGRADE_MODEL / ESCALATE_HUMAN) and act accordingly using `resolve`:

   ```bash
   node tools/agent-lifecycle.js resolve --task-id $TASK_ID \
     --action MORE_CONTEXT --note "<what you provided>"
   ```

5. **On escalation cap exhausted** (exit 1 from `resolve`): halt the story, write `## TASK BLOCKED` to `progress.md`, surface to user.

````

- [ ] **Step 2: Update §User approval gates to add verbal-cue correction**

Find the line in DM_AGENT.md that reads:

```markdown
Both paths are equivalent. CLI is faster for terminal users; dashboard is the remote/visual-review path.
````

Append after it:

```markdown
**Protocol violation rule:** If DM_AGENT's reply to the user at a gate prompt shows CLI command text (e.g., `npm run agent:approve ...`), this is a protocol violation. The agent must run the command on the user's behalf after the user says `approve` or `reject: <reason>`. The verbal-cue prompt ends with the response options — no CLI instructions.
```

- [ ] **Step 3: Check agent-files-protocol test still passes**

```bash
npx jest tests/unit/agent-files-protocol.test.js --no-coverage 2>&1 | tail -5
```

Expected: all 9 protocol contract tests pass (the contract checks section headings by name — no new sections were renamed).

- [ ] **Step 4: Commit**

```bash
git add docs/agents/DM_AGENT.md
git commit -m "docs(US-0183): DM_AGENT Per-Task Dispatch Ritual + verbal-cue protocol violation rule"
```

---

### Task 10: Integration smoke tests

**Files:**

- Create: `tests/integration/agent-lifecycle-flow.test.js`

- [ ] **Step 1: Create integration test file**

```js
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
    expect(dispatch({ cmd: 'done', taskId }, { sdlcPath, skipRegen: true })).toBe(0);
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
    dispatch({ cmd: 'done', taskId }, { sdlcPath, skipRegen: true });
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
```

- [ ] **Step 2: Check jest.config.js includes integration tests**

```bash
grep "integration" jest.config.js
```

If integration is not in testMatch, it should have been added by Task 19 in US-0181's plan. Verify:

```bash
npx jest tests/integration/agent-lifecycle-flow.test.js --no-coverage 2>&1 | tail -5
```

Expected: 3 tests pass.

- [ ] **Step 3: Commit**

```bash
git add tests/integration/agent-lifecycle-flow.test.js
git commit -m "test(US-0183): integration smoke — happy path, blocked-resolve, escalation"
```

---

### Task 11: Final verification

- [ ] **Step 1: Run full test suite**

```bash
cd /Users/Kamal_Syed/Projects/PlanVisualizer
npx jest --no-coverage --testPathIgnorePatterns=".claude/worktrees" 2>&1 | tail -5
```

Expected: all tests pass (≥1055 existing + ~55 new = ~1110 tests).

- [ ] **Step 2: Smoke-test the CLI end-to-end**

```bash
cd /Users/Kamal_Syed/Projects/PlanVisualizer

# Add a test story to sdlc-status.json
node -e "
const fs=require('fs');
const d=JSON.parse(fs.readFileSync('docs/sdlc-status.json','utf8'));
if(!d.stories['US-TEST']) d.stories['US-TEST']={status:'InProgress',assignedAgent:'Forge'};
if(!d.agents) d.agents={};
if(!d.agents['Forge']) d.agents['Forge']={status:'active',currentStory:'US-TEST',currentTask:'smoke test',tasksCompleted:0};
fs.writeFileSync('docs/sdlc-status.json',JSON.stringify(d,null,2)+'\n');
"

# Start a task — capture UUID
TASK_ID=$(node tools/agent-lifecycle.js start --story US-TEST --agent Forge --model sonnet --task "smoke test task")
echo "Task ID: $TASK_ID"

# Check status
node tools/agent-lifecycle.js status --task-id "$TASK_ID"

# Mark done
node tools/agent-lifecycle.js done --task-id "$TASK_ID"
node tools/agent-lifecycle.js list --story US-TEST

# Clean up
node -e "
const fs=require('fs');
const d=JSON.parse(fs.readFileSync('docs/sdlc-status.json','utf8'));
delete d.stories['US-TEST'];
delete d.agents['Forge'];
if(d.tasks) Object.keys(d.tasks).forEach(k=>{if(d.tasks[k].story==='US-TEST') delete d.tasks[k];});
fs.writeFileSync('docs/sdlc-status.json',JSON.stringify(d,null,2)+'\n');
"
```

Expected: TASK_ID printed as `task-<uuid>`, status shows `in_progress`, list shows `done` after marking done.

- [ ] **Step 3: Verify plan-update works**

```bash
node tools/agent-spec-plan.js status --story US-0001 2>&1 | python3 -c "
import sys,json; d=json.load(sys.stdin); print('planPath:', d.get('planPhase',{}).get('planPath'))
" 2>/dev/null || echo "US-0001 not in sdlc-status (OK — testing on fresh project)"
```

- [ ] **Step 4: Regenerate dashboards**

```bash
node tools/generate-plan.js 2>&1 | tail -2
node tools/generate-dashboard.js 2>&1 | tail -2
```

Expected: both generate cleanly.

---

## Final Verification Checklist

After all 11 tasks:

- [ ] `npx jest --no-coverage --testPathIgnorePatterns=".claude/worktrees" 2>&1 | tail -3` — all pass
- [ ] `node tools/agent-lifecycle.js start --story US-TEST --agent Forge --model sonnet --task "x"` prints `task-<uuid>` to stdout only
- [ ] `node tools/agent-lifecycle.js blocked --task-id <id> --reason "cannot find schema"` prints `MORE_CONTEXT` to stdout
- [ ] `node tools/agent-spec-plan.js plan-update --story US-XXXX --field planPath --value path` exits 0
- [ ] Second `approve --gate spec` call returns 0 (idempotent, no error)
- [ ] DM_AGENT.md contains `### Per-Task Dispatch Ritual` section
- [ ] `npx jest tests/unit/agent-files-protocol.test.js --no-coverage` — all 9 pass
- [ ] Dashboard generates cleanly: `node tools/generate-dashboard.js`

If all pass, branch is ready for PR via `superpowers:finishing-a-development-branch`.
