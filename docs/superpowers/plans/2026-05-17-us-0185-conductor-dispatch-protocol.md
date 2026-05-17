# US-0185 Conductor Dispatch Protocol Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship `tools/agent-task-review.js` — a CLI + pure state machine that drives the post-task Lens review loop (spec compliance → code quality, two sequential dispatches with retry cap), the `[sha:<commit>]` convention parser in `agent-lifecycle.js done`, and the DM_AGENT.md protocol updates that wire it all together (including automated `MORE_CONTEXT` and `UPGRADE_MODEL` BLOCKED routing).

**Architecture:** Thin CLI wrapper (`tools/agent-task-review.js`) owns all filesystem I/O; pure state machine (`tools/lib/agent-task-review-state.js`) takes plain objects and returns next-action token strings. State recording always exits 0; next action is emitted on stdout. Same split as every prior EPIC-0028 story.

**Tech Stack:** Node.js 18+, Jest 30, no new dependencies. All paths relative to repo root `/Users/Kamal_Syed/Projects/PlanVisualizer` (or the worktree clone of it).

**Spec:** `docs/superpowers/specs/2026-05-15-us-0185-conductor-dispatch-protocol-design.md`

---

## File Structure

| Path                                               | Action | Responsibility                                                                                                   |
| -------------------------------------------------- | ------ | ---------------------------------------------------------------------------------------------------------------- |
| `tools/lib/agent-lifecycle-state.js`               | Modify | `markDone` parses `[sha:...]` from summary, stores on `task.headSha`, strips token from stored summary           |
| `tools/agent-lifecycle.js`                         | Modify | `done` command requires `--summary` containing `[sha:...]` token; clear error if missing                         |
| `tools/lib/agent-task-review-state.js`             | Create | Pure state machine: `initTaskReview`, `setSpecVerdict`, `setQualityVerdict`, `forgeRetry`, exports enum + tokens |
| `tools/agent-task-review.js`                       | Create | CLI wrapper for 5 commands (`start`, `spec-verdict`, `quality-verdict`, `forge-retry`, `status`); reads config   |
| `plan-visualizer.config.json`                      | Modify | Add `orchestration.iterationCap.taskReview: 2`                                                                   |
| `tools/migrate-config.js`                          | Modify | Default-injection migration for `iterationCap.taskReview`                                                        |
| `tests/unit/agent-lifecycle-state.test.js`         | Modify | Update existing markDone tests; add new tests for `[sha:...]` extraction                                         |
| `tests/unit/agent-lifecycle-cli.test.js`           | Modify | `done` exits 1 without summary, exits 1 on malformed token, succeeds with valid token                            |
| `tests/unit/agent-task-review-state.test.js`       | Create | All state transitions, cap enforcement, retry-triggered-by behaviour, SKIP_REVIEW                                |
| `tests/unit/agent-task-review-cli.test.js`         | Create | All 5 commands, stdout token contract, exit 0 on success / exit 1 on actual errors only                          |
| `tests/integration/agent-task-review-flow.test.js` | Create | Happy path, single spec retry, single quality retry (no spec re-review), cap exhaustion, SKIP_REVIEW             |
| `tests/unit/migrate-config.test.js`                | Modify | Adds default `iterationCap.taskReview = 2` on migration                                                          |
| `tests/unit/agent-files-protocol.test.js`          | Modify | DM_AGENT.md 6 edits; BE_DEV_AGENT.md + FE_DEV_AGENT.md §Commit SHA Reporting                                     |
| `docs/agents/DM_AGENT.md`                          | Modify | 6 edits in §Per-Task Dispatch Ritual                                                                             |
| `docs/agents/BE_DEV_AGENT.md`                      | Modify | New §Commit SHA Reporting section                                                                                |
| `docs/agents/FE_DEV_AGENT.md`                      | Modify | New §Commit SHA Reporting section                                                                                |
| `docs/RELEASE_PLAN.md`                             | Modify | US-0185 Status: Planned → In Progress (set to Done after PR merge in a follow-up commit)                         |

---

## Task 1: `[sha:...]` parser in `agent-lifecycle-state.js`

**Files:**

- Modify: `tools/lib/agent-lifecycle-state.js`
- Test: `tests/unit/agent-lifecycle-state.test.js`

**Note for the engineer:** This task changes existing `markDone` behaviour. Two existing tests are updated; one is replaced; new tests are added.

- [ ] **Step 1: Update existing markDone tests + add new ones**

Open `tests/unit/agent-lifecycle-state.test.js`. Locate the `describe('markDone — US-0184 summary support', ...)` block. **Replace the entire block** with the following:

```js
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
    markDone(data, taskId, 'Did it [sha:abc1234567890abcdef1234567890abcdef12345678]');
    expect(data.tasks[taskId].headSha).toBe('abc1234567890abcdef1234567890abcdef12345678');
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
```

Then locate the existing `describe('initTask', ...)` block first test (around line 11) which asserts task fields. **Add** these two assertions to the existing first test (after `expect(t.summary).toBeNull()` if present, else after the last `expect` line):

```js
expect(t.headSha).toBeNull();
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx jest tests/unit/agent-lifecycle-state.test.js --no-coverage`
Expected: 9 new test failures (markDone tests), plus 1 failure on `initTask` snapshot test (`headSha` is undefined, not null).

- [ ] **Step 3: Add `headSha` field to `initTask`**

In `tools/lib/agent-lifecycle-state.js`, modify `initTask` to add `headSha: null` to the returned task object (place after `summary: null`):

```js
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
    planTaskIndex:
      typeof opts.planTaskIndex === 'number' && Number.isFinite(opts.planTaskIndex) ? opts.planTaskIndex : null,
    summary: null,
    headSha: null,
  };
}
```

- [ ] **Step 4: Rewrite `markDone` to parse `[sha:...]` token**

In `tools/lib/agent-lifecycle-state.js`, **replace the entire `markDone` function** with:

```js
const SHA_TOKEN_RE = /\s*\[sha:([0-9a-f]{7,40}|none)\]$/i;

function markDone(data, taskId, summary) {
  const t = _requireTask(data, taskId);
  _requireInProgress(t, 'done');
  if (typeof summary !== 'string' || summary.trim().length === 0) {
    throw new Error(
      'done: --summary required ending with [sha:<commit>] token; see BE_DEV_AGENT.md §Commit SHA Reporting',
    );
  }
  const match = summary.match(SHA_TOKEN_RE);
  if (!match) {
    throw new Error(
      'done: --summary must end with [sha:<7-40 hex chars>] or [sha:none] token; see BE_DEV_AGENT.md §Commit SHA Reporting',
    );
  }
  const sha = match[1].toLowerCase();
  const cleanSummary = summary.slice(0, match.index).trimEnd();
  t.state = 'done';
  t.completedAt = nowISO();
  t.summary = cleanSummary;
  t.headSha = sha;
}
```

Leave `module.exports` unchanged — same names exported.

- [ ] **Step 5: Run tests to verify all pass**

Run: `npx jest tests/unit/agent-lifecycle-state.test.js --no-coverage`
Expected: all tests pass (including 9 new markDone tests and the updated initTask snapshot).

- [ ] **Step 6: Commit**

```bash
git add tools/lib/agent-lifecycle-state.js tests/unit/agent-lifecycle-state.test.js
git commit -m "feat(US-0185): parse [sha:<commit>] from done summary; add headSha field"
```

---

## Task 2: `agent-lifecycle.js done` rejects missing/malformed summary

**Files:**

- Modify: `tools/agent-lifecycle.js`
- Test: `tests/unit/agent-lifecycle-cli.test.js`

- [ ] **Step 1: Write the failing tests**

Append to `tests/unit/agent-lifecycle-cli.test.js` (new describe block at end of file):

```js
describe('agent-lifecycle CLI — US-0185 [sha:...] convention', () => {
  const { dispatch } = require('../../tools/agent-lifecycle');
  const fs = require('fs');
  const path = require('path');
  const os = require('os');

  function tmpSdlcWithTask() {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'agent-lifecycle-us0185-'));
    const sdlcPath = path.join(dir, 'sdlc-status.json');
    fs.writeFileSync(sdlcPath, JSON.stringify({ tasks: {} }));
    const out = [];
    dispatch(
      { cmd: 'start', story: 'US-0185', agent: 'Forge', task: 'do x' },
      { sdlcPath, stdout: (s) => out.push(s), skipRegen: true },
    );
    const taskId = out[0];
    return { sdlcPath, taskId };
  }

  test('done with valid [sha:abc1234] summary writes headSha and strips token', () => {
    const { sdlcPath, taskId } = tmpSdlcWithTask();
    const rc = dispatch(
      { cmd: 'done', taskId, summary: 'Implemented parseFoo [sha:abc1234]' },
      { sdlcPath, stdout: () => {}, skipRegen: true },
    );
    expect(rc).toBe(0);
    const data = JSON.parse(fs.readFileSync(sdlcPath, 'utf8'));
    expect(data.tasks[taskId].headSha).toBe('abc1234');
    expect(data.tasks[taskId].summary).toBe('Implemented parseFoo');
  });

  test('done with [sha:none] writes headSha = "none"', () => {
    const { sdlcPath, taskId } = tmpSdlcWithTask();
    const rc = dispatch(
      { cmd: 'done', taskId, summary: 'Reviewed only [sha:none]' },
      { sdlcPath, stdout: () => {}, skipRegen: true },
    );
    expect(rc).toBe(0);
    const data = JSON.parse(fs.readFileSync(sdlcPath, 'utf8'));
    expect(data.tasks[taskId].headSha).toBe('none');
  });

  test('done without --summary exits 1 with helpful stderr', () => {
    const { sdlcPath, taskId } = tmpSdlcWithTask();
    const errs = [];
    const rc = dispatch(
      { cmd: 'done', taskId },
      { sdlcPath, stdout: () => {}, stderr: (s) => errs.push(s), skipRegen: true },
    );
    expect(rc).toBe(1);
    expect(errs.join(' ')).toMatch(/--summary required.*\[sha:/);
  });

  test('done with summary lacking [sha:...] token exits 1', () => {
    const { sdlcPath, taskId } = tmpSdlcWithTask();
    const errs = [];
    const rc = dispatch(
      { cmd: 'done', taskId, summary: 'No sha token here' },
      { sdlcPath, stdout: () => {}, stderr: (s) => errs.push(s), skipRegen: true },
    );
    expect(rc).toBe(1);
    expect(errs.join(' ')).toMatch(/\[sha:.*\] token/);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx jest tests/unit/agent-lifecycle-cli.test.js --no-coverage`
Expected: 4 new failures — the `done` case in `dispatch` currently swallows the markDone throw or returns 0 without checking summary.

- [ ] **Step 3: Update the `done` case in `dispatch`**

In `tools/agent-lifecycle.js`, locate `case 'done':` (around line 117). **Replace it** with:

```js
      case 'done': {
        if (!opts.taskId) {
          console.error('--task-id required');
          return 1;
        }
        if (typeof opts.summary !== 'string' || opts.summary.trim().length === 0) {
          console.error(
            '[agent-lifecycle] done: --summary required ending with [sha:<commit>] token; see BE_DEV_AGENT.md §Commit SHA Reporting',
          );
          return 1;
        }
        try {
          LifeState.markDone(data, opts.taskId, opts.summary);
        } catch (e) {
          console.error(`[agent-lifecycle] ${e.message}`);
          return 1;
        }
        writeSdlc(sdlcPath, data);
        regenDashboard(ctx);
        return 0;
      }
```

Replace `console.error` with `ctx.stderr || ((s) => process.stderr.write(s + '\n'))` semantics — to match the rest of the file, change `console.error(...)` calls inside the new `done` block to use a `stderr` callback consistent with the rest of the dispatcher. If the existing `dispatch` already binds `stderr` from `ctx`, follow that pattern; if it uses `console.error` directly everywhere, leave `console.error` for now (the test infrastructure captures it via the `ctx.stderr` indirection in newer code paths — but the existing CLI test pattern in `agent-lifecycle-cli.test.js` reads stderr via Jest's `jest.spyOn(console, 'error')` if needed).

**Quick check:** open `tools/agent-lifecycle.js` and search for `stderr`. If `dispatch` already takes `ctx.stderr`, use it; otherwise keep `console.error` and update the test setup to spy on `console.error`. Inspect carefully — do not break existing tests.

- [ ] **Step 4: Run tests to verify all pass**

Run: `npx jest tests/unit/agent-lifecycle-cli.test.js tests/unit/agent-lifecycle-state.test.js --no-coverage`
Expected: all tests pass.

- [ ] **Step 5: Commit**

```bash
git add tools/agent-lifecycle.js tests/unit/agent-lifecycle-cli.test.js
git commit -m "feat(US-0185): agent-lifecycle.js done requires [sha:...] in --summary"
```

---

## Task 3: Config schema — `iterationCap.taskReview` default 2

**Files:**

- Modify: `plan-visualizer.config.json`
- Modify: `tools/migrate-config.js`
- Test: `tests/unit/migrate-config.test.js`

- [ ] **Step 1: Write the failing test**

Append to `tests/unit/migrate-config.test.js` (find the existing test block for `iterationCap` and add a new test inside the same describe, or create a sibling test):

```js
test('migrate adds iterationCap.taskReview default 2 when missing', () => {
  const before = {
    orchestration: {
      iterationCap: { spec: 3, plan: 3 }, // no taskReview
    },
  };
  const { config: after, changes } = migrateConfig(before);
  expect(after.orchestration.iterationCap.taskReview).toBe(2);
  expect(changes.join(' ')).toMatch(/iterationCap\.taskReview/);
});

test('migrate preserves existing iterationCap.taskReview', () => {
  const before = {
    orchestration: {
      iterationCap: { spec: 3, plan: 3, taskReview: 5 },
    },
  };
  const { config: after } = migrateConfig(before);
  expect(after.orchestration.iterationCap.taskReview).toBe(5);
});
```

Adjust to match the exact `migrateConfig` API in the existing test file — peek at the file first to confirm the function name and return shape.

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx jest tests/unit/migrate-config.test.js --no-coverage`
Expected: 2 failures — `taskReview` is `undefined` after migration.

- [ ] **Step 3: Update `migrate-config.js`**

In `tools/migrate-config.js`, locate the block that handles `iterationCap.plan` (around line 139). After the `iterationCap.plan` injection, add a sibling block for `taskReview`:

```js
if (typeof cfg.orchestration.iterationCap.plan !== 'number') {
  cfg.orchestration.iterationCap.plan = 3;
  additions.push('added orchestration.iterationCap.plan');
}
if (typeof cfg.orchestration.iterationCap.taskReview !== 'number') {
  cfg.orchestration.iterationCap.taskReview = 2;
  additions.push('added orchestration.iterationCap.taskReview');
}
```

Also update the initial default object at line 126 from `iterationCap: { spec: 3, plan: 3 }` to `iterationCap: { spec: 3, plan: 3, taskReview: 2 }`.

- [ ] **Step 4: Update `plan-visualizer.config.json`**

In the root `plan-visualizer.config.json`, update the `orchestration.iterationCap` block:

```json
  "orchestration": {
    "iterationCap": {
      "spec": 3,
      "plan": 3,
      "taskReview": 2
    },
    "pendingApprovalsDir": "docs/pending-approvals"
  }
```

- [ ] **Step 5: Run tests to verify all pass**

Run: `npx jest tests/unit/migrate-config.test.js --no-coverage`
Expected: all tests pass.

- [ ] **Step 6: Commit**

```bash
git add tools/migrate-config.js plan-visualizer.config.json tests/unit/migrate-config.test.js
git commit -m "feat(US-0185): add iterationCap.taskReview default 2 + migration"
```

---

## Task 4: `agent-task-review-state.js` — `initTaskReview`

**Files:**

- Create: `tools/lib/agent-task-review-state.js`
- Create: `tests/unit/agent-task-review-state.test.js`

- [ ] **Step 1: Create the test file**

Create `tests/unit/agent-task-review-state.test.js`:

```js
'use strict';

const State = require('../../tools/lib/agent-task-review-state');

function dataWithTask(overrides = {}) {
  return {
    tasks: {
      'task-abc': {
        id: 'task-abc',
        story: 'US-0185',
        agent: 'Forge',
        state: 'done',
        summary: 'did it',
        headSha: 'abc1234',
        ...overrides,
      },
    },
  };
}

describe('TASK_REVIEW_STATES and NEXT_ACTION_TOKENS', () => {
  test('exports the 6 review states', () => {
    expect(State.TASK_REVIEW_STATES).toEqual([
      'pending',
      'spec_reviewing',
      'quality_reviewing',
      'forge_retry',
      'approved',
      'escalated',
    ]);
  });

  test('exports the 7 next-action tokens', () => {
    expect(State.NEXT_ACTION_TOKENS).toEqual({
      SKIP_REVIEW: 'SKIP_REVIEW',
      READY_FOR_SPEC: 'READY_FOR_SPEC',
      PROCEED_TO_QUALITY: 'PROCEED_TO_QUALITY',
      TASK_CLEARED: 'TASK_CLEARED',
      RETRY_FORGE: 'RETRY_FORGE',
      ESCALATE: 'ESCALATE',
      READY_FOR_QUALITY: 'READY_FOR_QUALITY',
    });
  });
});

describe('initTaskReview', () => {
  test('initializes taskReview with status spec_reviewing on normal SHA', () => {
    const data = dataWithTask();
    const token = State.initTaskReview(data, 'task-abc', '0000000', 'abc1234');
    const tr = data.tasks['task-abc'].taskReview;
    expect(token).toBe('READY_FOR_SPEC');
    expect(tr.status).toBe('spec_reviewing');
    expect(tr.baseSha).toBe('0000000');
    expect(tr.headSha).toBe('abc1234');
    expect(tr.specVerdict).toBeNull();
    expect(tr.qualityVerdict).toBeNull();
    expect(tr.forgeRetries).toBe(0);
    expect(tr.lastRetryTriggeredBy).toBeNull();
    expect(typeof tr.startedAt).toBe('string');
    expect(tr.completedAt).toBeNull();
  });

  test('returns SKIP_REVIEW and marks approved when headSha === "none"', () => {
    const data = dataWithTask();
    const token = State.initTaskReview(data, 'task-abc', '0000000', 'none');
    const tr = data.tasks['task-abc'].taskReview;
    expect(token).toBe('SKIP_REVIEW');
    expect(tr.status).toBe('approved');
    expect(typeof tr.completedAt).toBe('string');
  });

  test('throws when task does not exist', () => {
    const data = { tasks: {} };
    expect(() => State.initTaskReview(data, 'task-missing', 'abc', 'def')).toThrow(/not found/i);
  });

  test('throws when baseSha is missing or not a string', () => {
    const data = dataWithTask();
    expect(() => State.initTaskReview(data, 'task-abc', null, 'abc')).toThrow(/baseSha/);
    expect(() => State.initTaskReview(data, 'task-abc', '', 'abc')).toThrow(/baseSha/);
  });

  test('throws when headSha is missing', () => {
    const data = dataWithTask();
    expect(() => State.initTaskReview(data, 'task-abc', 'abc', null)).toThrow(/headSha/);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx jest tests/unit/agent-task-review-state.test.js --no-coverage`
Expected: FAIL with "Cannot find module".

- [ ] **Step 3: Create the state module**

Create `tools/lib/agent-task-review-state.js`:

```js
'use strict';

const TASK_REVIEW_STATES = ['pending', 'spec_reviewing', 'quality_reviewing', 'forge_retry', 'approved', 'escalated'];

const NEXT_ACTION_TOKENS = {
  SKIP_REVIEW: 'SKIP_REVIEW',
  READY_FOR_SPEC: 'READY_FOR_SPEC',
  PROCEED_TO_QUALITY: 'PROCEED_TO_QUALITY',
  TASK_CLEARED: 'TASK_CLEARED',
  RETRY_FORGE: 'RETRY_FORGE',
  ESCALATE: 'ESCALATE',
  READY_FOR_QUALITY: 'READY_FOR_QUALITY',
};

function nowISO() {
  return new Date().toISOString();
}

function _requireTask(data, taskId) {
  if (!data.tasks || !data.tasks[taskId]) {
    throw new Error(`Task '${taskId}' not found in sdlc-status.json`);
  }
  return data.tasks[taskId];
}

function initTaskReview(data, taskId, baseSha, headSha) {
  const t = _requireTask(data, taskId);
  if (typeof baseSha !== 'string' || baseSha.length === 0) {
    throw new Error('initTaskReview: baseSha must be a non-empty string');
  }
  if (typeof headSha !== 'string' || headSha.length === 0) {
    throw new Error('initTaskReview: headSha must be a non-empty string');
  }
  const now = nowISO();
  if (headSha === 'none') {
    t.taskReview = {
      status: 'approved',
      baseSha,
      headSha,
      specVerdict: null,
      specFindings: null,
      qualityVerdict: null,
      qualityFindings: null,
      forgeRetries: 0,
      lastRetryTriggeredBy: null,
      startedAt: now,
      completedAt: now,
    };
    return NEXT_ACTION_TOKENS.SKIP_REVIEW;
  }
  t.taskReview = {
    status: 'spec_reviewing',
    baseSha,
    headSha,
    specVerdict: null,
    specFindings: null,
    qualityVerdict: null,
    qualityFindings: null,
    forgeRetries: 0,
    lastRetryTriggeredBy: null,
    startedAt: now,
    completedAt: null,
  };
  return NEXT_ACTION_TOKENS.READY_FOR_SPEC;
}

module.exports = {
  TASK_REVIEW_STATES,
  NEXT_ACTION_TOKENS,
  initTaskReview,
};
```

- [ ] **Step 4: Run tests to verify all pass**

Run: `npx jest tests/unit/agent-task-review-state.test.js --no-coverage`
Expected: all tests pass.

- [ ] **Step 5: Commit**

```bash
git add tools/lib/agent-task-review-state.js tests/unit/agent-task-review-state.test.js
git commit -m "feat(US-0185): add agent-task-review-state.js initTaskReview"
```

---

## Task 5: `setSpecVerdict`

**Files:**

- Modify: `tools/lib/agent-task-review-state.js`
- Modify: `tests/unit/agent-task-review-state.test.js`

- [ ] **Step 1: Append failing tests**

Append to `tests/unit/agent-task-review-state.test.js`:

```js
describe('setSpecVerdict', () => {
  function startedData() {
    const data = dataWithTask();
    State.initTaskReview(data, 'task-abc', '0000000', 'abc1234');
    return data;
  }

  test('APPROVED → PROCEED_TO_QUALITY, status quality_reviewing', () => {
    const data = startedData();
    const token = State.setSpecVerdict(data, 'task-abc', 'APPROVED', null, 2);
    const tr = data.tasks['task-abc'].taskReview;
    expect(token).toBe('PROCEED_TO_QUALITY');
    expect(tr.status).toBe('quality_reviewing');
    expect(tr.specVerdict).toBe('APPROVED');
    expect(tr.specFindings).toBeNull();
  });

  test('REQUEST_CHANGES with retries<cap → RETRY_FORGE, status forge_retry', () => {
    const data = startedData();
    const token = State.setSpecVerdict(data, 'task-abc', 'REQUEST_CHANGES', 'AC-x missing', 2);
    const tr = data.tasks['task-abc'].taskReview;
    expect(token).toBe('RETRY_FORGE');
    expect(tr.status).toBe('forge_retry');
    expect(tr.specVerdict).toBe('REQUEST_CHANGES');
    expect(tr.specFindings).toBe('AC-x missing');
  });

  test('REQUEST_CHANGES with retries === cap → ESCALATE, status escalated, completedAt set', () => {
    const data = startedData();
    data.tasks['task-abc'].taskReview.forgeRetries = 2;
    const token = State.setSpecVerdict(data, 'task-abc', 'REQUEST_CHANGES', 'still missing', 2);
    const tr = data.tasks['task-abc'].taskReview;
    expect(token).toBe('ESCALATE');
    expect(tr.status).toBe('escalated');
    expect(typeof tr.completedAt).toBe('string');
  });

  test('throws when called outside spec_reviewing state', () => {
    const data = startedData();
    data.tasks['task-abc'].taskReview.status = 'quality_reviewing';
    expect(() => State.setSpecVerdict(data, 'task-abc', 'APPROVED', null, 2)).toThrow(/invalid state|spec_reviewing/i);
  });

  test('throws on unknown verdict value', () => {
    const data = startedData();
    expect(() => State.setSpecVerdict(data, 'task-abc', 'OOPS', null, 2)).toThrow(/verdict/i);
  });

  test('throws when REQUEST_CHANGES has no findings', () => {
    const data = startedData();
    expect(() => State.setSpecVerdict(data, 'task-abc', 'REQUEST_CHANGES', null, 2)).toThrow(/findings/i);
    expect(() => State.setSpecVerdict(data, 'task-abc', 'REQUEST_CHANGES', '', 2)).toThrow(/findings/i);
  });
});
```

- [ ] **Step 2: Run tests to verify 6 fail**

Run: `npx jest tests/unit/agent-task-review-state.test.js --no-coverage`
Expected: 6 failures (`setSpecVerdict is not a function`).

- [ ] **Step 3: Implement `setSpecVerdict`**

In `tools/lib/agent-task-review-state.js`, add after `initTaskReview`:

```js
const VALID_VERDICTS = ['APPROVED', 'REQUEST_CHANGES'];

function setSpecVerdict(data, taskId, verdict, findings, cap) {
  const t = _requireTask(data, taskId);
  if (!t.taskReview || t.taskReview.status !== 'spec_reviewing') {
    throw new Error(
      `setSpecVerdict: task '${taskId}' is in invalid state for spec verdict; expected status='spec_reviewing'`,
    );
  }
  if (!VALID_VERDICTS.includes(verdict)) {
    throw new Error(`setSpecVerdict: verdict must be APPROVED or REQUEST_CHANGES (got '${verdict}')`);
  }
  if (typeof cap !== 'number' || !Number.isFinite(cap) || cap < 1) {
    throw new Error('setSpecVerdict: cap must be a positive integer');
  }
  if (verdict === 'REQUEST_CHANGES' && (typeof findings !== 'string' || findings.trim().length === 0)) {
    throw new Error('setSpecVerdict: REQUEST_CHANGES requires non-empty findings');
  }
  t.taskReview.specVerdict = verdict;
  t.taskReview.specFindings = verdict === 'REQUEST_CHANGES' ? findings : null;
  if (verdict === 'APPROVED') {
    t.taskReview.status = 'quality_reviewing';
    return NEXT_ACTION_TOKENS.PROCEED_TO_QUALITY;
  }
  // REQUEST_CHANGES
  if (t.taskReview.forgeRetries >= cap) {
    t.taskReview.status = 'escalated';
    t.taskReview.completedAt = nowISO();
    return NEXT_ACTION_TOKENS.ESCALATE;
  }
  t.taskReview.status = 'forge_retry';
  return NEXT_ACTION_TOKENS.RETRY_FORGE;
}
```

Update `module.exports` to add `setSpecVerdict`:

```js
module.exports = {
  TASK_REVIEW_STATES,
  NEXT_ACTION_TOKENS,
  initTaskReview,
  setSpecVerdict,
};
```

- [ ] **Step 4: Run tests to verify all pass**

Run: `npx jest tests/unit/agent-task-review-state.test.js --no-coverage`
Expected: all tests pass.

- [ ] **Step 5: Commit**

```bash
git add tools/lib/agent-task-review-state.js tests/unit/agent-task-review-state.test.js
git commit -m "feat(US-0185): add setSpecVerdict to task review state"
```

---

## Task 6: `setQualityVerdict`

**Files:**

- Modify: `tools/lib/agent-task-review-state.js`
- Modify: `tests/unit/agent-task-review-state.test.js`

- [ ] **Step 1: Append failing tests**

Append to `tests/unit/agent-task-review-state.test.js`:

```js
describe('setQualityVerdict', () => {
  function readyForQuality() {
    const data = dataWithTask();
    State.initTaskReview(data, 'task-abc', '0000000', 'abc1234');
    State.setSpecVerdict(data, 'task-abc', 'APPROVED', null, 2);
    return data;
  }

  test('APPROVED → TASK_CLEARED, status approved, completedAt set', () => {
    const data = readyForQuality();
    const token = State.setQualityVerdict(data, 'task-abc', 'APPROVED', null, 2);
    const tr = data.tasks['task-abc'].taskReview;
    expect(token).toBe('TASK_CLEARED');
    expect(tr.status).toBe('approved');
    expect(tr.qualityVerdict).toBe('APPROVED');
    expect(typeof tr.completedAt).toBe('string');
  });

  test('REQUEST_CHANGES with retries<cap → RETRY_FORGE, status forge_retry', () => {
    const data = readyForQuality();
    const token = State.setQualityVerdict(data, 'task-abc', 'REQUEST_CHANGES', 'magic number', 2);
    const tr = data.tasks['task-abc'].taskReview;
    expect(token).toBe('RETRY_FORGE');
    expect(tr.status).toBe('forge_retry');
    expect(tr.qualityFindings).toBe('magic number');
  });

  test('REQUEST_CHANGES with retries === cap → ESCALATE', () => {
    const data = readyForQuality();
    data.tasks['task-abc'].taskReview.forgeRetries = 2;
    const token = State.setQualityVerdict(data, 'task-abc', 'REQUEST_CHANGES', 'still bad', 2);
    expect(token).toBe('ESCALATE');
    expect(data.tasks['task-abc'].taskReview.status).toBe('escalated');
  });

  test('throws when called outside quality_reviewing state', () => {
    const data = dataWithTask();
    State.initTaskReview(data, 'task-abc', '0000000', 'abc1234');
    // not yet in quality_reviewing
    expect(() => State.setQualityVerdict(data, 'task-abc', 'APPROVED', null, 2)).toThrow(/quality_reviewing/i);
  });

  test('throws when REQUEST_CHANGES has no findings', () => {
    const data = readyForQuality();
    expect(() => State.setQualityVerdict(data, 'task-abc', 'REQUEST_CHANGES', null, 2)).toThrow(/findings/i);
  });
});
```

- [ ] **Step 2: Run tests to verify 5 fail**

Run: `npx jest tests/unit/agent-task-review-state.test.js --no-coverage`
Expected: 5 failures.

- [ ] **Step 3: Implement `setQualityVerdict`**

In `tools/lib/agent-task-review-state.js`, add:

```js
function setQualityVerdict(data, taskId, verdict, findings, cap) {
  const t = _requireTask(data, taskId);
  if (!t.taskReview || t.taskReview.status !== 'quality_reviewing') {
    throw new Error(
      `setQualityVerdict: task '${taskId}' is in invalid state for quality verdict; expected status='quality_reviewing'`,
    );
  }
  if (!VALID_VERDICTS.includes(verdict)) {
    throw new Error(`setQualityVerdict: verdict must be APPROVED or REQUEST_CHANGES (got '${verdict}')`);
  }
  if (typeof cap !== 'number' || !Number.isFinite(cap) || cap < 1) {
    throw new Error('setQualityVerdict: cap must be a positive integer');
  }
  if (verdict === 'REQUEST_CHANGES' && (typeof findings !== 'string' || findings.trim().length === 0)) {
    throw new Error('setQualityVerdict: REQUEST_CHANGES requires non-empty findings');
  }
  t.taskReview.qualityVerdict = verdict;
  t.taskReview.qualityFindings = verdict === 'REQUEST_CHANGES' ? findings : null;
  if (verdict === 'APPROVED') {
    t.taskReview.status = 'approved';
    t.taskReview.completedAt = nowISO();
    return NEXT_ACTION_TOKENS.TASK_CLEARED;
  }
  // REQUEST_CHANGES
  if (t.taskReview.forgeRetries >= cap) {
    t.taskReview.status = 'escalated';
    t.taskReview.completedAt = nowISO();
    return NEXT_ACTION_TOKENS.ESCALATE;
  }
  t.taskReview.status = 'forge_retry';
  return NEXT_ACTION_TOKENS.RETRY_FORGE;
}
```

Update `module.exports` to add `setQualityVerdict`.

- [ ] **Step 4: Run tests to verify all pass**

Run: `npx jest tests/unit/agent-task-review-state.test.js --no-coverage`
Expected: all tests pass.

- [ ] **Step 5: Commit**

```bash
git add tools/lib/agent-task-review-state.js tests/unit/agent-task-review-state.test.js
git commit -m "feat(US-0185): add setQualityVerdict to task review state"
```

---

## Task 7: `forgeRetry`

**Files:**

- Modify: `tools/lib/agent-task-review-state.js`
- Modify: `tests/unit/agent-task-review-state.test.js`

- [ ] **Step 1: Append failing tests**

Append to `tests/unit/agent-task-review-state.test.js`:

```js
describe('forgeRetry', () => {
  function inForgeRetry(reason) {
    const data = dataWithTask();
    State.initTaskReview(data, 'task-abc', '0000000', 'abc1234');
    if (reason === 'spec') {
      State.setSpecVerdict(data, 'task-abc', 'REQUEST_CHANGES', 'spec fail', 2);
    } else {
      State.setSpecVerdict(data, 'task-abc', 'APPROVED', null, 2);
      State.setQualityVerdict(data, 'task-abc', 'REQUEST_CHANGES', 'quality fail', 2);
    }
    return data;
  }

  test('spec retry: resets both verdicts, status → spec_reviewing, returns READY_FOR_SPEC', () => {
    const data = inForgeRetry('spec');
    const token = State.forgeRetry(data, 'task-abc', 'spec', 'def5678');
    const tr = data.tasks['task-abc'].taskReview;
    expect(token).toBe('READY_FOR_SPEC');
    expect(tr.status).toBe('spec_reviewing');
    expect(tr.specVerdict).toBeNull();
    expect(tr.specFindings).toBeNull();
    expect(tr.qualityVerdict).toBeNull();
    expect(tr.qualityFindings).toBeNull();
    expect(tr.forgeRetries).toBe(1);
    expect(tr.lastRetryTriggeredBy).toBe('spec');
    expect(tr.headSha).toBe('def5678');
  });

  test('quality retry: keeps spec verdict, status → quality_reviewing, returns READY_FOR_QUALITY', () => {
    const data = inForgeRetry('quality');
    const token = State.forgeRetry(data, 'task-abc', 'quality', 'def5678');
    const tr = data.tasks['task-abc'].taskReview;
    expect(token).toBe('READY_FOR_QUALITY');
    expect(tr.status).toBe('quality_reviewing');
    expect(tr.specVerdict).toBe('APPROVED'); // preserved
    expect(tr.qualityVerdict).toBeNull(); // reset
    expect(tr.forgeRetries).toBe(1);
    expect(tr.lastRetryTriggeredBy).toBe('quality');
  });

  test('multiple spec retries increment forgeRetries', () => {
    const data = inForgeRetry('spec');
    State.forgeRetry(data, 'task-abc', 'spec', 'def5678');
    State.setSpecVerdict(data, 'task-abc', 'REQUEST_CHANGES', 'still bad', 2);
    State.forgeRetry(data, 'task-abc', 'spec', '789abcd');
    expect(data.tasks['task-abc'].taskReview.forgeRetries).toBe(2);
  });

  test('throws when called outside forge_retry state', () => {
    const data = dataWithTask();
    State.initTaskReview(data, 'task-abc', '0000000', 'abc1234');
    // currently in spec_reviewing, not forge_retry
    expect(() => State.forgeRetry(data, 'task-abc', 'spec', 'def5678')).toThrow(/forge_retry/i);
  });

  test('throws on invalid triggered-by value', () => {
    const data = inForgeRetry('spec');
    expect(() => State.forgeRetry(data, 'task-abc', 'oops', 'def5678')).toThrow(/triggered-by|spec|quality/i);
  });

  test('throws on missing newHeadSha', () => {
    const data = inForgeRetry('spec');
    expect(() => State.forgeRetry(data, 'task-abc', 'spec', '')).toThrow(/newHeadSha/i);
    expect(() => State.forgeRetry(data, 'task-abc', 'spec', null)).toThrow(/newHeadSha/i);
  });
});
```

- [ ] **Step 2: Run tests to verify 6 fail**

Run: `npx jest tests/unit/agent-task-review-state.test.js --no-coverage`
Expected: 6 failures.

- [ ] **Step 3: Implement `forgeRetry`**

In `tools/lib/agent-task-review-state.js`, add:

```js
const VALID_TRIGGERED_BY = ['spec', 'quality'];

function forgeRetry(data, taskId, triggeredBy, newHeadSha) {
  const t = _requireTask(data, taskId);
  if (!t.taskReview || t.taskReview.status !== 'forge_retry') {
    throw new Error(`forgeRetry: task '${taskId}' is in invalid state for retry; expected status='forge_retry'`);
  }
  if (!VALID_TRIGGERED_BY.includes(triggeredBy)) {
    throw new Error(`forgeRetry: triggered-by must be 'spec' or 'quality' (got '${triggeredBy}')`);
  }
  if (typeof newHeadSha !== 'string' || newHeadSha.length === 0) {
    throw new Error('forgeRetry: newHeadSha must be a non-empty string');
  }
  t.taskReview.forgeRetries += 1;
  t.taskReview.lastRetryTriggeredBy = triggeredBy;
  t.taskReview.headSha = newHeadSha;
  if (triggeredBy === 'spec') {
    t.taskReview.specVerdict = null;
    t.taskReview.specFindings = null;
    t.taskReview.qualityVerdict = null;
    t.taskReview.qualityFindings = null;
    t.taskReview.status = 'spec_reviewing';
    return NEXT_ACTION_TOKENS.READY_FOR_SPEC;
  }
  // triggeredBy === 'quality' — preserve spec verdict
  t.taskReview.qualityVerdict = null;
  t.taskReview.qualityFindings = null;
  t.taskReview.status = 'quality_reviewing';
  return NEXT_ACTION_TOKENS.READY_FOR_QUALITY;
}
```

Update `module.exports` to add `forgeRetry`.

- [ ] **Step 4: Run tests to verify all pass**

Run: `npx jest tests/unit/agent-task-review-state.test.js --no-coverage`
Expected: all tests pass.

- [ ] **Step 5: Commit**

```bash
git add tools/lib/agent-task-review-state.js tests/unit/agent-task-review-state.test.js
git commit -m "feat(US-0185): add forgeRetry to task review state"
```

---

## Task 8: CLI wrapper — `tools/agent-task-review.js` (start + status)

**Files:**

- Create: `tools/agent-task-review.js`
- Create: `tests/unit/agent-task-review-cli.test.js`

- [ ] **Step 1: Create the test file**

Create `tests/unit/agent-task-review-cli.test.js`:

```js
'use strict';

const fs = require('fs');
const path = require('path');
const os = require('os');

const { parseArgs, dispatch } = require('../../tools/agent-task-review');

function mkProjectWithTask(opts = {}) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'agent-task-review-cli-'));
  fs.mkdirSync(path.join(root, 'docs'), { recursive: true });
  const sdlcPath = path.join(root, 'docs/sdlc-status.json');
  fs.writeFileSync(
    sdlcPath,
    JSON.stringify({
      tasks: {
        'task-abc': {
          id: 'task-abc',
          story: 'US-0185',
          agent: 'Forge',
          state: 'done',
          summary: 'did it',
          headSha: 'abc1234',
          ...opts.taskOverrides,
        },
      },
    }),
  );
  // Minimal config
  fs.writeFileSync(
    path.join(root, 'plan-visualizer.config.json'),
    JSON.stringify({ orchestration: { iterationCap: { taskReview: 2 } } }),
  );
  return { root, sdlcPath };
}

describe('parseArgs', () => {
  test('parses start command with all flags', () => {
    const opts = parseArgs([
      'node',
      'cli',
      'start',
      '--task-id',
      'task-abc',
      '--base-sha',
      '0000000',
      '--head-sha',
      'abc1234',
    ]);
    expect(opts).toMatchObject({ cmd: 'start', taskId: 'task-abc', baseSha: '0000000', headSha: 'abc1234' });
  });

  test('parses verdict command with --verdict and --findings', () => {
    const opts = parseArgs([
      'node',
      'cli',
      'spec-verdict',
      '--task-id',
      'task-abc',
      '--verdict',
      'REQUEST_CHANGES',
      '--findings',
      'AC-x missing',
    ]);
    expect(opts).toMatchObject({
      cmd: 'spec-verdict',
      taskId: 'task-abc',
      verdict: 'REQUEST_CHANGES',
      findings: 'AC-x missing',
    });
  });

  test('parses forge-retry with --triggered-by and --new-head-sha', () => {
    const opts = parseArgs([
      'node',
      'cli',
      'forge-retry',
      '--task-id',
      'task-abc',
      '--triggered-by',
      'spec',
      '--new-head-sha',
      'def5678',
    ]);
    expect(opts).toMatchObject({ cmd: 'forge-retry', taskId: 'task-abc', triggeredBy: 'spec', newHeadSha: 'def5678' });
  });
});

describe('dispatch — start', () => {
  test('happy path: emits READY_FOR_SPEC on stdout, exit 0', () => {
    const { root, sdlcPath } = mkProjectWithTask();
    const out = [];
    const rc = dispatch(
      { cmd: 'start', taskId: 'task-abc', baseSha: '0000000', headSha: 'abc1234' },
      { root, sdlcPath, stdout: (s) => out.push(s), stderr: () => {} },
    );
    expect(rc).toBe(0);
    expect(out.join('').trim()).toBe('READY_FOR_SPEC');
  });

  test('headSha === "none" emits SKIP_REVIEW', () => {
    const { root, sdlcPath } = mkProjectWithTask({ taskOverrides: { headSha: 'none' } });
    const out = [];
    const rc = dispatch(
      { cmd: 'start', taskId: 'task-abc', baseSha: '0000000', headSha: 'none' },
      { root, sdlcPath, stdout: (s) => out.push(s), stderr: () => {} },
    );
    expect(rc).toBe(0);
    expect(out.join('').trim()).toBe('SKIP_REVIEW');
  });

  test('missing --task-id exits 1 with stderr', () => {
    const { root, sdlcPath } = mkProjectWithTask();
    const errs = [];
    const rc = dispatch(
      { cmd: 'start', baseSha: '0000000', headSha: 'abc1234' },
      { root, sdlcPath, stdout: () => {}, stderr: (s) => errs.push(s) },
    );
    expect(rc).toBe(1);
    expect(errs.join(' ')).toMatch(/--task-id required/);
  });

  test('missing --base-sha exits 1', () => {
    const { root, sdlcPath } = mkProjectWithTask();
    const errs = [];
    const rc = dispatch(
      { cmd: 'start', taskId: 'task-abc', headSha: 'abc1234' },
      { root, sdlcPath, stdout: () => {}, stderr: (s) => errs.push(s) },
    );
    expect(rc).toBe(1);
    expect(errs.join(' ')).toMatch(/--base-sha required/);
  });
});

describe('dispatch — status', () => {
  test('prints taskReview JSON to stdout, exit 0', () => {
    const { root, sdlcPath } = mkProjectWithTask();
    // Initialize taskReview
    dispatch(
      { cmd: 'start', taskId: 'task-abc', baseSha: '0000000', headSha: 'abc1234' },
      { root, sdlcPath, stdout: () => {}, stderr: () => {} },
    );
    const out = [];
    const rc = dispatch(
      { cmd: 'status', taskId: 'task-abc' },
      { root, sdlcPath, stdout: (s) => out.push(s), stderr: () => {} },
    );
    expect(rc).toBe(0);
    const parsed = JSON.parse(out.join(''));
    expect(parsed.status).toBe('spec_reviewing');
    expect(parsed.baseSha).toBe('0000000');
  });

  test('status on task without taskReview exits 1', () => {
    const { root, sdlcPath } = mkProjectWithTask();
    const errs = [];
    const rc = dispatch(
      { cmd: 'status', taskId: 'task-abc' },
      { root, sdlcPath, stdout: () => {}, stderr: (s) => errs.push(s) },
    );
    expect(rc).toBe(1);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx jest tests/unit/agent-task-review-cli.test.js --no-coverage`
Expected: FAIL with "Cannot find module".

- [ ] **Step 3: Create `tools/agent-task-review.js` (start + status only for now)**

Create `tools/agent-task-review.js`:

```js
#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');
const State = require('./lib/agent-task-review-state');

const DEFAULT_ROOT = path.join(__dirname, '..');
const DEFAULT_CAP = 2;

function parseArgs(argv) {
  const args = argv.slice(2);
  const out = {
    cmd: args[0] || null,
    taskId: null,
    baseSha: null,
    headSha: null,
    verdict: null,
    findings: null,
    triggeredBy: null,
    newHeadSha: null,
  };
  for (let i = 1; i < args.length; i++) {
    const a = args[i];
    const next = args[i + 1];
    if (a === '--task-id' && next) {
      out.taskId = next;
      i++;
    } else if (a === '--base-sha' && next) {
      out.baseSha = next;
      i++;
    } else if (a === '--head-sha' && next) {
      out.headSha = next;
      i++;
    } else if (a === '--verdict' && next) {
      out.verdict = next;
      i++;
    } else if (a === '--findings' && next !== undefined) {
      out.findings = next;
      i++;
    } else if (a === '--triggered-by' && next) {
      out.triggeredBy = next;
      i++;
    } else if (a === '--new-head-sha' && next) {
      out.newHeadSha = next;
      i++;
    }
  }
  return out;
}

function readJson(p) {
  return JSON.parse(fs.readFileSync(p, 'utf8'));
}

function writeJson(p, data) {
  fs.writeFileSync(p, JSON.stringify(data, null, 2) + '\n');
}

function readCap(root) {
  try {
    const cfg = readJson(path.join(root, 'plan-visualizer.config.json'));
    const v = cfg && cfg.orchestration && cfg.orchestration.iterationCap && cfg.orchestration.iterationCap.taskReview;
    return typeof v === 'number' && Number.isFinite(v) && v >= 1 ? v : DEFAULT_CAP;
  } catch {
    return DEFAULT_CAP;
  }
}

function dispatch(opts, ctx = {}) {
  const root = ctx.root || DEFAULT_ROOT;
  const sdlcPath = ctx.sdlcPath || path.join(root, 'docs/sdlc-status.json');
  const stdout = ctx.stdout || ((s) => process.stdout.write(s));
  const stderr = ctx.stderr || ((s) => process.stderr.write(s + '\n'));

  if (!opts.cmd) {
    stderr(
      '[agent-task-review] usage: agent-task-review.js <start|spec-verdict|quality-verdict|forge-retry|status> [options]',
    );
    return 1;
  }
  if (!opts.taskId) {
    stderr('[agent-task-review] --task-id required');
    return 1;
  }

  let data;
  try {
    data = readJson(sdlcPath);
  } catch (e) {
    stderr(`[agent-task-review] cannot read ${sdlcPath}: ${e.message}`);
    return 1;
  }

  try {
    switch (opts.cmd) {
      case 'start': {
        if (!opts.baseSha) {
          stderr('[agent-task-review] --base-sha required');
          return 1;
        }
        if (!opts.headSha) {
          stderr('[agent-task-review] --head-sha required');
          return 1;
        }
        const token = State.initTaskReview(data, opts.taskId, opts.baseSha, opts.headSha);
        writeJson(sdlcPath, data);
        stdout(token + '\n');
        return 0;
      }

      case 'status': {
        const t = (data.tasks || {})[opts.taskId];
        if (!t) {
          stderr(`[agent-task-review] task '${opts.taskId}' not found`);
          return 1;
        }
        if (!t.taskReview) {
          stderr(`[agent-task-review] task '${opts.taskId}' has no taskReview record`);
          return 1;
        }
        stdout(JSON.stringify(t.taskReview, null, 2));
        return 0;
      }

      default:
        stderr(`[agent-task-review] unknown command '${opts.cmd}'`);
        return 1;
    }
  } catch (e) {
    stderr(`[agent-task-review] ${e.message}`);
    return 1;
  }
}

function main() {
  const opts = parseArgs(process.argv);
  return dispatch(opts);
}

if (require.main === module) {
  process.exit(main());
}

module.exports = { parseArgs, dispatch, main, readCap };
```

- [ ] **Step 4: Run tests to verify all pass**

Run: `npx jest tests/unit/agent-task-review-cli.test.js --no-coverage`
Expected: all tests pass.

- [ ] **Step 5: Commit**

```bash
git add tools/agent-task-review.js tests/unit/agent-task-review-cli.test.js
git commit -m "feat(US-0185): add agent-task-review.js with start + status commands"
```

---

## Task 9: CLI — `spec-verdict` and `quality-verdict`

**Files:**

- Modify: `tools/agent-task-review.js`
- Modify: `tests/unit/agent-task-review-cli.test.js`

- [ ] **Step 1: Append failing tests**

Append to `tests/unit/agent-task-review-cli.test.js`:

```js
describe('dispatch — spec-verdict', () => {
  function startedProject() {
    const { root, sdlcPath } = mkProjectWithTask();
    dispatch(
      { cmd: 'start', taskId: 'task-abc', baseSha: '0000000', headSha: 'abc1234' },
      { root, sdlcPath, stdout: () => {}, stderr: () => {} },
    );
    return { root, sdlcPath };
  }

  test('APPROVED emits PROCEED_TO_QUALITY', () => {
    const { root, sdlcPath } = startedProject();
    const out = [];
    const rc = dispatch(
      { cmd: 'spec-verdict', taskId: 'task-abc', verdict: 'APPROVED' },
      { root, sdlcPath, stdout: (s) => out.push(s), stderr: () => {} },
    );
    expect(rc).toBe(0);
    expect(out.join('').trim()).toBe('PROCEED_TO_QUALITY');
  });

  test('REQUEST_CHANGES with retries < cap emits RETRY_FORGE', () => {
    const { root, sdlcPath } = startedProject();
    const out = [];
    const rc = dispatch(
      { cmd: 'spec-verdict', taskId: 'task-abc', verdict: 'REQUEST_CHANGES', findings: 'AC-x missing' },
      { root, sdlcPath, stdout: (s) => out.push(s), stderr: () => {} },
    );
    expect(rc).toBe(0);
    expect(out.join('').trim()).toBe('RETRY_FORGE');
  });

  test('REQUEST_CHANGES at cap emits ESCALATE', () => {
    const { root, sdlcPath } = startedProject();
    // Bump retries to cap (2) by manipulating sdlc-status directly
    const data = JSON.parse(fs.readFileSync(sdlcPath, 'utf8'));
    data.tasks['task-abc'].taskReview.forgeRetries = 2;
    fs.writeFileSync(sdlcPath, JSON.stringify(data, null, 2));

    const out = [];
    const rc = dispatch(
      { cmd: 'spec-verdict', taskId: 'task-abc', verdict: 'REQUEST_CHANGES', findings: 'still bad' },
      { root, sdlcPath, stdout: (s) => out.push(s), stderr: () => {} },
    );
    expect(rc).toBe(0);
    expect(out.join('').trim()).toBe('ESCALATE');
  });

  test('REQUEST_CHANGES without --findings exits 1', () => {
    const { root, sdlcPath } = startedProject();
    const errs = [];
    const rc = dispatch(
      { cmd: 'spec-verdict', taskId: 'task-abc', verdict: 'REQUEST_CHANGES' },
      { root, sdlcPath, stdout: () => {}, stderr: (s) => errs.push(s) },
    );
    expect(rc).toBe(1);
    expect(errs.join(' ')).toMatch(/findings/i);
  });
});

describe('dispatch — quality-verdict', () => {
  function readyForQuality() {
    const { root, sdlcPath } = mkProjectWithTask();
    dispatch(
      { cmd: 'start', taskId: 'task-abc', baseSha: '0000000', headSha: 'abc1234' },
      { root, sdlcPath, stdout: () => {}, stderr: () => {} },
    );
    dispatch(
      { cmd: 'spec-verdict', taskId: 'task-abc', verdict: 'APPROVED' },
      { root, sdlcPath, stdout: () => {}, stderr: () => {} },
    );
    return { root, sdlcPath };
  }

  test('APPROVED emits TASK_CLEARED', () => {
    const { root, sdlcPath } = readyForQuality();
    const out = [];
    const rc = dispatch(
      { cmd: 'quality-verdict', taskId: 'task-abc', verdict: 'APPROVED' },
      { root, sdlcPath, stdout: (s) => out.push(s), stderr: () => {} },
    );
    expect(rc).toBe(0);
    expect(out.join('').trim()).toBe('TASK_CLEARED');
  });

  test('REQUEST_CHANGES with retries < cap emits RETRY_FORGE', () => {
    const { root, sdlcPath } = readyForQuality();
    const out = [];
    const rc = dispatch(
      { cmd: 'quality-verdict', taskId: 'task-abc', verdict: 'REQUEST_CHANGES', findings: 'magic number' },
      { root, sdlcPath, stdout: (s) => out.push(s), stderr: () => {} },
    );
    expect(rc).toBe(0);
    expect(out.join('').trim()).toBe('RETRY_FORGE');
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx jest tests/unit/agent-task-review-cli.test.js --no-coverage`
Expected: 6 failures (`unknown command 'spec-verdict'` and `unknown command 'quality-verdict'`).

- [ ] **Step 3: Implement spec-verdict + quality-verdict in `dispatch`**

In `tools/agent-task-review.js`, add two new cases inside the existing `switch (opts.cmd)` block (before the `default:`):

```js
      case 'spec-verdict': {
        if (!opts.verdict) {
          stderr('[agent-task-review] --verdict required (APPROVED or REQUEST_CHANGES)');
          return 1;
        }
        if (opts.verdict === 'REQUEST_CHANGES' && (typeof opts.findings !== 'string' || opts.findings.trim().length === 0)) {
          stderr('[agent-task-review] --findings required for REQUEST_CHANGES verdict');
          return 1;
        }
        const cap = readCap(root);
        const token = State.setSpecVerdict(data, opts.taskId, opts.verdict, opts.findings, cap);
        writeJson(sdlcPath, data);
        stdout(token + '\n');
        return 0;
      }

      case 'quality-verdict': {
        if (!opts.verdict) {
          stderr('[agent-task-review] --verdict required (APPROVED or REQUEST_CHANGES)');
          return 1;
        }
        if (opts.verdict === 'REQUEST_CHANGES' && (typeof opts.findings !== 'string' || opts.findings.trim().length === 0)) {
          stderr('[agent-task-review] --findings required for REQUEST_CHANGES verdict');
          return 1;
        }
        const cap = readCap(root);
        const token = State.setQualityVerdict(data, opts.taskId, opts.verdict, opts.findings, cap);
        writeJson(sdlcPath, data);
        stdout(token + '\n');
        return 0;
      }
```

- [ ] **Step 4: Run tests to verify all pass**

Run: `npx jest tests/unit/agent-task-review-cli.test.js --no-coverage`
Expected: all tests pass.

- [ ] **Step 5: Commit**

```bash
git add tools/agent-task-review.js tests/unit/agent-task-review-cli.test.js
git commit -m "feat(US-0185): add spec-verdict and quality-verdict CLI commands"
```

---

## Task 10: CLI — `forge-retry`

**Files:**

- Modify: `tools/agent-task-review.js`
- Modify: `tests/unit/agent-task-review-cli.test.js`

- [ ] **Step 1: Append failing tests**

Append to `tests/unit/agent-task-review-cli.test.js`:

```js
describe('dispatch — forge-retry', () => {
  function inForgeRetry(reason) {
    const { root, sdlcPath } = mkProjectWithTask();
    dispatch(
      { cmd: 'start', taskId: 'task-abc', baseSha: '0000000', headSha: 'abc1234' },
      { root, sdlcPath, stdout: () => {}, stderr: () => {} },
    );
    if (reason === 'spec') {
      dispatch(
        { cmd: 'spec-verdict', taskId: 'task-abc', verdict: 'REQUEST_CHANGES', findings: 'spec fail' },
        { root, sdlcPath, stdout: () => {}, stderr: () => {} },
      );
    } else {
      dispatch(
        { cmd: 'spec-verdict', taskId: 'task-abc', verdict: 'APPROVED' },
        { root, sdlcPath, stdout: () => {}, stderr: () => {} },
      );
      dispatch(
        { cmd: 'quality-verdict', taskId: 'task-abc', verdict: 'REQUEST_CHANGES', findings: 'quality fail' },
        { root, sdlcPath, stdout: () => {}, stderr: () => {} },
      );
    }
    return { root, sdlcPath };
  }

  test('spec retry emits READY_FOR_SPEC, increments forgeRetries', () => {
    const { root, sdlcPath } = inForgeRetry('spec');
    const out = [];
    const rc = dispatch(
      { cmd: 'forge-retry', taskId: 'task-abc', triggeredBy: 'spec', newHeadSha: 'def5678' },
      { root, sdlcPath, stdout: (s) => out.push(s), stderr: () => {} },
    );
    expect(rc).toBe(0);
    expect(out.join('').trim()).toBe('READY_FOR_SPEC');
    const data = JSON.parse(fs.readFileSync(sdlcPath, 'utf8'));
    expect(data.tasks['task-abc'].taskReview.forgeRetries).toBe(1);
    expect(data.tasks['task-abc'].taskReview.headSha).toBe('def5678');
  });

  test('quality retry emits READY_FOR_QUALITY, preserves spec verdict', () => {
    const { root, sdlcPath } = inForgeRetry('quality');
    const out = [];
    const rc = dispatch(
      { cmd: 'forge-retry', taskId: 'task-abc', triggeredBy: 'quality', newHeadSha: 'def5678' },
      { root, sdlcPath, stdout: (s) => out.push(s), stderr: () => {} },
    );
    expect(rc).toBe(0);
    expect(out.join('').trim()).toBe('READY_FOR_QUALITY');
    const data = JSON.parse(fs.readFileSync(sdlcPath, 'utf8'));
    expect(data.tasks['task-abc'].taskReview.specVerdict).toBe('APPROVED');
  });

  test('missing --triggered-by exits 1', () => {
    const { root, sdlcPath } = inForgeRetry('spec');
    const errs = [];
    const rc = dispatch(
      { cmd: 'forge-retry', taskId: 'task-abc', newHeadSha: 'def5678' },
      { root, sdlcPath, stdout: () => {}, stderr: (s) => errs.push(s) },
    );
    expect(rc).toBe(1);
    expect(errs.join(' ')).toMatch(/--triggered-by/);
  });

  test('missing --new-head-sha exits 1', () => {
    const { root, sdlcPath } = inForgeRetry('spec');
    const errs = [];
    const rc = dispatch(
      { cmd: 'forge-retry', taskId: 'task-abc', triggeredBy: 'spec' },
      { root, sdlcPath, stdout: () => {}, stderr: (s) => errs.push(s) },
    );
    expect(rc).toBe(1);
    expect(errs.join(' ')).toMatch(/--new-head-sha/);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx jest tests/unit/agent-task-review-cli.test.js --no-coverage`
Expected: 4 failures (`unknown command 'forge-retry'`).

- [ ] **Step 3: Implement forge-retry in `dispatch`**

In `tools/agent-task-review.js`, add a new case before `default:`:

```js
      case 'forge-retry': {
        if (!opts.triggeredBy) {
          stderr('[agent-task-review] --triggered-by required (spec or quality)');
          return 1;
        }
        if (!opts.newHeadSha) {
          stderr('[agent-task-review] --new-head-sha required');
          return 1;
        }
        const token = State.forgeRetry(data, opts.taskId, opts.triggeredBy, opts.newHeadSha);
        writeJson(sdlcPath, data);
        stdout(token + '\n');
        return 0;
      }
```

- [ ] **Step 4: Run tests to verify all pass**

Run: `npx jest tests/unit/agent-task-review-cli.test.js --no-coverage`
Expected: all tests pass.

- [ ] **Step 5: Run full suite to verify no regressions**

Run: `npx jest --no-coverage 2>&1 | tail -5`
Expected: all tests pass.

- [ ] **Step 6: Commit**

```bash
git add tools/agent-task-review.js tests/unit/agent-task-review-cli.test.js
git commit -m "feat(US-0185): add forge-retry CLI command"
```

---

## Task 11: Integration flow test

**Files:**

- Create: `tests/integration/agent-task-review-flow.test.js`

- [ ] **Step 1: Create the integration test**

Create `tests/integration/agent-task-review-flow.test.js`:

```js
'use strict';

const fs = require('fs');
const path = require('path');
const os = require('os');

const Review = require('../../tools/agent-task-review');

function mkProjectWithTask(headSha = 'abc1234') {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'agent-task-review-int-'));
  fs.mkdirSync(path.join(root, 'docs'), { recursive: true });
  const sdlcPath = path.join(root, 'docs/sdlc-status.json');
  fs.writeFileSync(
    sdlcPath,
    JSON.stringify({
      tasks: {
        'task-abc': {
          id: 'task-abc',
          story: 'US-0185',
          agent: 'Forge',
          state: 'done',
          summary: 'did it',
          headSha,
        },
      },
    }),
  );
  fs.writeFileSync(
    path.join(root, 'plan-visualizer.config.json'),
    JSON.stringify({ orchestration: { iterationCap: { taskReview: 2 } } }),
  );
  return { root, sdlcPath };
}

function runDispatch(opts, ctx) {
  const out = [];
  const errs = [];
  const rc = Review.dispatch(opts, {
    ...ctx,
    stdout: (s) => out.push(s),
    stderr: (s) => errs.push(s),
  });
  return { rc, stdout: out.join('').trim(), stderr: errs.join('\n') };
}

test('happy path: start → spec APPROVED → quality APPROVED → cleared', () => {
  const { root, sdlcPath } = mkProjectWithTask();
  const ctx = { root, sdlcPath };

  expect(runDispatch({ cmd: 'start', taskId: 'task-abc', baseSha: '0000000', headSha: 'abc1234' }, ctx).stdout).toBe(
    'READY_FOR_SPEC',
  );
  expect(runDispatch({ cmd: 'spec-verdict', taskId: 'task-abc', verdict: 'APPROVED' }, ctx).stdout).toBe(
    'PROCEED_TO_QUALITY',
  );
  expect(runDispatch({ cmd: 'quality-verdict', taskId: 'task-abc', verdict: 'APPROVED' }, ctx).stdout).toBe(
    'TASK_CLEARED',
  );

  const data = JSON.parse(fs.readFileSync(sdlcPath, 'utf8'));
  expect(data.tasks['task-abc'].taskReview.status).toBe('approved');
  expect(data.tasks['task-abc'].taskReview.forgeRetries).toBe(0);
});

test('single spec retry: spec REQ_CHANGES → forge-retry → spec APPROVED → quality APPROVED', () => {
  const { root, sdlcPath } = mkProjectWithTask();
  const ctx = { root, sdlcPath };

  runDispatch({ cmd: 'start', taskId: 'task-abc', baseSha: '0000000', headSha: 'abc1234' }, ctx);
  expect(
    runDispatch({ cmd: 'spec-verdict', taskId: 'task-abc', verdict: 'REQUEST_CHANGES', findings: 'AC-x missing' }, ctx)
      .stdout,
  ).toBe('RETRY_FORGE');
  expect(
    runDispatch({ cmd: 'forge-retry', taskId: 'task-abc', triggeredBy: 'spec', newHeadSha: 'def5678' }, ctx).stdout,
  ).toBe('READY_FOR_SPEC');
  expect(runDispatch({ cmd: 'spec-verdict', taskId: 'task-abc', verdict: 'APPROVED' }, ctx).stdout).toBe(
    'PROCEED_TO_QUALITY',
  );
  expect(runDispatch({ cmd: 'quality-verdict', taskId: 'task-abc', verdict: 'APPROVED' }, ctx).stdout).toBe(
    'TASK_CLEARED',
  );

  const data = JSON.parse(fs.readFileSync(sdlcPath, 'utf8'));
  expect(data.tasks['task-abc'].taskReview.forgeRetries).toBe(1);
  expect(data.tasks['task-abc'].taskReview.lastRetryTriggeredBy).toBe('spec');
});

test('single quality retry skips spec re-review on retry', () => {
  const { root, sdlcPath } = mkProjectWithTask();
  const ctx = { root, sdlcPath };

  runDispatch({ cmd: 'start', taskId: 'task-abc', baseSha: '0000000', headSha: 'abc1234' }, ctx);
  runDispatch({ cmd: 'spec-verdict', taskId: 'task-abc', verdict: 'APPROVED' }, ctx);
  expect(
    runDispatch(
      { cmd: 'quality-verdict', taskId: 'task-abc', verdict: 'REQUEST_CHANGES', findings: 'magic number' },
      ctx,
    ).stdout,
  ).toBe('RETRY_FORGE');
  expect(
    runDispatch({ cmd: 'forge-retry', taskId: 'task-abc', triggeredBy: 'quality', newHeadSha: 'def5678' }, ctx).stdout,
  ).toBe('READY_FOR_QUALITY');
  // Direct quality re-review — spec phase skipped
  expect(runDispatch({ cmd: 'quality-verdict', taskId: 'task-abc', verdict: 'APPROVED' }, ctx).stdout).toBe(
    'TASK_CLEARED',
  );

  const data = JSON.parse(fs.readFileSync(sdlcPath, 'utf8'));
  expect(data.tasks['task-abc'].taskReview.specVerdict).toBe('APPROVED'); // preserved
  expect(data.tasks['task-abc'].taskReview.forgeRetries).toBe(1);
});

test('cap exhaustion on spec phase emits ESCALATE', () => {
  const { root, sdlcPath } = mkProjectWithTask();
  const ctx = { root, sdlcPath };

  runDispatch({ cmd: 'start', taskId: 'task-abc', baseSha: '0000000', headSha: 'abc1234' }, ctx);
  // First REQUEST_CHANGES → RETRY (forgeRetries 0 → after forge-retry 1)
  runDispatch({ cmd: 'spec-verdict', taskId: 'task-abc', verdict: 'REQUEST_CHANGES', findings: 'fail 1' }, ctx);
  runDispatch({ cmd: 'forge-retry', taskId: 'task-abc', triggeredBy: 'spec', newHeadSha: 'def5678' }, ctx);
  // Second REQUEST_CHANGES → RETRY (forgeRetries 1 → after forge-retry 2)
  runDispatch({ cmd: 'spec-verdict', taskId: 'task-abc', verdict: 'REQUEST_CHANGES', findings: 'fail 2' }, ctx);
  runDispatch({ cmd: 'forge-retry', taskId: 'task-abc', triggeredBy: 'spec', newHeadSha: '789abcd' }, ctx);
  // Third REQUEST_CHANGES (forgeRetries === cap=2) → ESCALATE
  expect(
    runDispatch({ cmd: 'spec-verdict', taskId: 'task-abc', verdict: 'REQUEST_CHANGES', findings: 'fail 3' }, ctx)
      .stdout,
  ).toBe('ESCALATE');

  const data = JSON.parse(fs.readFileSync(sdlcPath, 'utf8'));
  expect(data.tasks['task-abc'].taskReview.status).toBe('escalated');
  expect(typeof data.tasks['task-abc'].taskReview.completedAt).toBe('string');
});

test('SKIP_REVIEW when headSha === "none"', () => {
  const { root, sdlcPath } = mkProjectWithTask('none');
  const ctx = { root, sdlcPath };

  const { stdout } = runDispatch({ cmd: 'start', taskId: 'task-abc', baseSha: '0000000', headSha: 'none' }, ctx);
  expect(stdout).toBe('SKIP_REVIEW');

  const data = JSON.parse(fs.readFileSync(sdlcPath, 'utf8'));
  expect(data.tasks['task-abc'].taskReview.status).toBe('approved');
});
```

- [ ] **Step 2: Run the integration test**

Run: `npx jest tests/integration/agent-task-review-flow.test.js --no-coverage`
Expected: all 5 tests pass.

- [ ] **Step 3: Commit**

```bash
git add tests/integration/agent-task-review-flow.test.js
git commit -m "test(US-0185): integration flow tests for task review pipeline"
```

---

## Task 12: DM_AGENT.md §Per-Task Dispatch Ritual updates

**Files:**

- Modify: `docs/agents/DM_AGENT.md`
- Modify: `tests/unit/agent-files-protocol.test.js`

- [ ] **Step 1: Write the failing tests**

Append to `tests/unit/agent-files-protocol.test.js` (new describe block at the end):

```js
describe('DM_AGENT.md — US-0185 review gate + automated BLOCKED routing', () => {
  const fs = require('fs');
  const path = require('path');
  const content = fs.readFileSync(path.join(__dirname, '../../docs/agents/DM_AGENT.md'), 'utf8');

  test('captures BASE_SHA before TASK_ID assignment', () => {
    expect(content).toMatch(
      /BASE_SHA=\$\(git rev-parse HEAD\)\s*\n\s*TASK_ID=\$\(node tools\/agent-lifecycle\.js start/,
    );
  });

  test('step 3b uses agent-task-review.js start', () => {
    expect(content).toMatch(/node tools\/agent-task-review\.js start/);
  });

  test('handles SKIP_REVIEW token branch', () => {
    expect(content).toMatch(/SKIP_REVIEW/);
  });

  test('step 3c dispatches Lens for spec compliance and uses spec-verdict', () => {
    expect(content).toMatch(/agent-task-review\.js spec-verdict/);
    expect(content).toMatch(/PROCEED_TO_QUALITY/);
  });

  test('step 3d uses quality-verdict and TASK_CLEARED branch', () => {
    expect(content).toMatch(/agent-task-review\.js quality-verdict/);
    expect(content).toMatch(/TASK_CLEARED/);
  });

  test('forge-retry is called with --triggered-by', () => {
    expect(content).toMatch(/agent-task-review\.js forge-retry[\s\S]+--triggered-by/);
  });

  test('automated BLOCKED routing handles MORE_CONTEXT and UPGRADE_MODEL', () => {
    expect(content).toMatch(/MORE_CONTEXT[\s\S]+UPGRADE_MODEL/);
    expect(content).toMatch(/haiku|sonnet|opus/);
  });

  test('SPLIT_TASK and ESCALATE_HUMAN both halt and surface', () => {
    expect(content).toMatch(/SPLIT_TASK\)[\s\S]+progress\.md/);
    expect(content).toMatch(/ESCALATE_HUMAN\)[\s\S]+progress\.md/);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx jest tests/unit/agent-files-protocol.test.js --no-coverage`
Expected: 8 new failures.

- [ ] **Step 3: Apply the 6 edits to DM_AGENT.md**

Open `docs/agents/DM_AGENT.md`. Locate `### Per-Task Dispatch Ritual` (around line 115).

**Edit 1 — capture BASE_SHA before step 1's TASK_ID line:**

Change step 1's code block from:

```bash
TASK_ID=$(node tools/agent-lifecycle.js start \
  --story <id> --agent <name> --model <tier> \
  --task "<description>" \
  --plan-task-index <N>)
```

To:

```bash
BASE_SHA=$(git rev-parse HEAD)
TASK_ID=$(node tools/agent-lifecycle.js start \
  --story <id> --agent <name> --model <tier> \
  --task "<description>" \
  --plan-task-index <N>)
```

**Edit 2 — insert step 3b (start review) after the existing step 3 table:**

````markdown
3b. **Start review after `done` or `done_with_concerns`** (skip for `needs-context` or `blocked`):

    ```bash
    HEAD_SHA=$(node tools/agent-lifecycle.js status --task-id $TASK_ID | jq -r .headSha)

    NEXT=$(node tools/agent-task-review.js start \
      --task-id $TASK_ID --base-sha $BASE_SHA --head-sha $HEAD_SHA)

    case "$NEXT" in
      SKIP_REVIEW)      # no commit produced; move to next task
        continue
        ;;
      READY_FOR_SPEC)   # proceed to step 3c
        ;;
    esac
    ```
````

**Edit 3 — insert step 3c (Lens spec compliance review):**

````markdown
3c. **Lens spec compliance review** — Conductor dispatches Lens with the task description, story acceptance criteria, plan task block, and the diff `git diff $BASE_SHA..$HEAD_SHA`. Lens reports `APPROVED` or `REQUEST_CHANGES` with findings.

    ```bash
    NEXT=$(node tools/agent-task-review.js spec-verdict \
      --task-id $TASK_ID --verdict APPROVED)
    # or, on REQUEST_CHANGES:
    NEXT=$(node tools/agent-task-review.js spec-verdict \
      --task-id $TASK_ID --verdict REQUEST_CHANGES --findings "$LENS_FINDINGS")

    case "$NEXT" in
      PROCEED_TO_QUALITY)
        ;; # → step 3d
      RETRY_FORGE)
        # Redispatch Forge with findings spliced into the context payload.
        # Forge produces a new commit; capture NEW_HEAD from Forge's response
        # text which must end with [sha:<new-commit>] (same convention as --summary).
        node tools/agent-task-review.js forge-retry \
          --task-id $TASK_ID --triggered-by spec --new-head-sha "$NEW_HEAD"
        # Loop back to step 3c with the new diff range.
        ;;
      ESCALATE)
        # Write ## TASK REVIEW BLOCKED — spec compliance cap exhausted to progress.md
        # Halt the story.
        ;;
    esac
    ```
````

**Edit 4 — insert step 3d (Lens code quality review):**

````markdown
3d. **Lens code quality review** — Conductor dispatches Lens with the diff and code-quality criteria. On `RETRY_FORGE` from this phase, `forge-retry --triggered-by quality` preserves the spec verdict and only re-runs quality on the next iteration.

    ```bash
    NEXT=$(node tools/agent-task-review.js quality-verdict \
      --task-id $TASK_ID --verdict APPROVED)
    # or, on REQUEST_CHANGES:
    NEXT=$(node tools/agent-task-review.js quality-verdict \
      --task-id $TASK_ID --verdict REQUEST_CHANGES --findings "$LENS_FINDINGS")

    case "$NEXT" in
      TASK_CLEARED)
        ;; # → move to next task in the plan
      RETRY_FORGE)
        node tools/agent-task-review.js forge-retry \
          --task-id $TASK_ID --triggered-by quality --new-head-sha "$NEW_HEAD"
        # Loop back to step 3d (skips 3c — spec verdict preserved).
        ;;
      ESCALATE)
        # Write ## TASK REVIEW BLOCKED — code quality cap exhausted to progress.md
        # Halt the story.
        ;;
    esac
    ```
````

**Edit 5 — replace step 4 (automated BLOCKED routing):**

Replace the existing step 4 ("On BLOCKED: read the routing suggestion...") with:

````markdown
4. **On BLOCKED** — automated routing handles `MORE_CONTEXT` and `UPGRADE_MODEL`; `SPLIT_TASK` and `ESCALATE_HUMAN` halt and surface to the user.

   ```bash
   ROUTING=$(node tools/agent-lifecycle.js blocked --task-id $TASK_ID --reason "$REASON")

   case "$ROUTING" in
     MORE_CONTEXT)
       CONTEXT=$(node tools/agent-context.js generate \
         --story <id> --agent Forge --task-id $TASK_ID)
       SPLICED_MESSAGE="$CONTEXT

   ---

   ### Previous attempt was blocked

   Your previous attempt at this task was blocked. You reported:

   > $REASON

   Address that specifically. If you cannot proceed because of the same issue, mark the task \`needs-context\` rather than \`blocked\` again."

       node tools/agent-lifecycle.js resolve --task-id $TASK_ID --action MORE_CONTEXT --note "$REASON"
       # Redispatch Forge with $SPLICED_MESSAGE as the prompt prefix. Same model.
       ;;

     UPGRADE_MODEL)
       CURRENT_MODEL=$(node tools/agent-lifecycle.js status --task-id $TASK_ID | jq -r .model)
       case "$CURRENT_MODEL" in
         haiku)  NEXT_TIER=sonnet ;;
         sonnet) NEXT_TIER=opus ;;
         opus)
           echo "## TASK BLOCKED — at max model tier (opus)" >> progress.md
           echo "Reason: $REASON" >> progress.md
           exit 1
           ;;
       esac
       node tools/agent-lifecycle.js resolve --task-id $TASK_ID --action UPGRADE_MODEL --note "previous tier: $CURRENT_MODEL"
       # Redispatch Forge with $NEXT_TIER model.
       ;;

     SPLIT_TASK)
       echo "## TASK BLOCKED — split required" >> progress.md
       echo "Reason: $REASON" >> progress.md
       echo "Task: $TASK_DESC" >> progress.md
       # Surface to user with verbal cue.
       exit 1
       ;;

     ESCALATE_HUMAN)
       echo "## TASK BLOCKED — $REASON" >> progress.md
       # Surface to user verbally.
       exit 1
       ;;
   esac
   ```
````

**Edit 6 — extend step 5 with task review escalation path:**

Change step 5 from:

```markdown
5. **On escalation cap exhausted** (exit 1 from `resolve`): halt the story, write `## TASK BLOCKED` to `progress.md`, surface to user.
```

To:

```markdown
5. **On any escalation** (`agent-lifecycle.js resolve` exit 1, or `agent-task-review.js spec-verdict`/`quality-verdict` stdout = `ESCALATE`): halt the story, write `## TASK BLOCKED — <reason>` or `## TASK REVIEW BLOCKED — <phase> cap exhausted` to `progress.md`, surface to user verbally.
```

- [ ] **Step 4: Run tests to verify all pass**

Run: `npx jest tests/unit/agent-files-protocol.test.js --no-coverage`
Expected: all tests pass.

- [ ] **Step 5: Commit**

```bash
git add docs/agents/DM_AGENT.md tests/unit/agent-files-protocol.test.js
git commit -m "docs(US-0185): DM_AGENT.md Per-Task Dispatch Ritual review gates + BLOCKED routing"
```

---

## Task 13: BE_DEV_AGENT.md + FE_DEV_AGENT.md §Commit SHA Reporting

**Files:**

- Modify: `docs/agents/BE_DEV_AGENT.md`
- Modify: `docs/agents/FE_DEV_AGENT.md`
- Modify: `tests/unit/agent-files-protocol.test.js`

- [ ] **Step 1: Append failing tests**

Append to `tests/unit/agent-files-protocol.test.js` (new describe block):

```js
describe('Forge agent files — US-0185 §Commit SHA Reporting', () => {
  const fs = require('fs');
  const path = require('path');

  for (const file of ['BE_DEV_AGENT.md', 'FE_DEV_AGENT.md']) {
    describe(file, () => {
      const content = fs.readFileSync(path.join(__dirname, '../../docs/agents/', file), 'utf8');

      test('contains §Commit SHA Reporting section', () => {
        expect(content).toMatch(/## Commit SHA Reporting/);
      });

      test('documents [sha:<commit>] token format', () => {
        expect(content).toMatch(/\[sha:.*?<commit>.*?\]/);
      });

      test('documents [sha:none] for no-commit tasks', () => {
        expect(content).toMatch(/\[sha:none\]/);
      });

      test('states that done and done_with_concerns require the token', () => {
        expect(content).toMatch(/done.*and.*done_with_concerns/);
      });
    });
  }
});
```

- [ ] **Step 2: Run tests to verify 8 fail**

Run: `npx jest tests/unit/agent-files-protocol.test.js --no-coverage`
Expected: 8 new failures.

- [ ] **Step 3: Add the section to both files**

Open `docs/agents/BE_DEV_AGENT.md`. Locate the existing `## Model Selection` section. **Insert immediately before it** the following new section:

````markdown
## Commit SHA Reporting

When you complete a task and call `agent-lifecycle.js done`, your `--summary` argument must end with a `[sha:<commit>]` token. This lets the Conductor capture the commit SHA your work produced without needing to know your worktree path.

Format: `[sha:<7-40 hex chars>]` for tasks that produced a commit, or `[sha:none]` for tasks that produced no commit (e.g., review-only, design discussion, "verify and report").

Examples:

```bash
# Normal case: task produced a commit
node tools/agent-lifecycle.js done --task-id $TASK_ID \
  --summary "Implemented parseTaskBlock() with 3 tests [sha:abc1234]"

# Review-only or design-only task: no commit produced
node tools/agent-lifecycle.js done --task-id $TASK_ID \
  --summary "Reviewed design doc, no code changes [sha:none]"
```

If the `[sha:...]` token is missing, `agent-lifecycle.js done` exits 1 with a clear error message. You must retry the command with the corrected format.

This convention applies to `done` and `done_with_concerns` only. It does not apply to `needs-context` or `blocked` (you are not reporting completion in those cases).

On a retry following a Lens review `REQUEST_CHANGES`: you do NOT call `agent-lifecycle.js done` again (the task is already in `done` state). Instead, make your fix commits and report back to the Conductor in your response text, ending that response with the same `[sha:<new-commit>]` token. The Conductor parses the token from your response.

---
````

**Repeat the exact same insert** in `docs/agents/FE_DEV_AGENT.md`, also immediately before the `## Model Selection` section.

- [ ] **Step 4: Run tests to verify all pass**

Run: `npx jest tests/unit/agent-files-protocol.test.js --no-coverage`
Expected: all tests pass.

- [ ] **Step 5: Commit**

```bash
git add docs/agents/BE_DEV_AGENT.md docs/agents/FE_DEV_AGENT.md tests/unit/agent-files-protocol.test.js
git commit -m "docs(US-0185): add §Commit SHA Reporting to Forge agent files"
```

---

## Task 14: RELEASE_PLAN.md status update

**Files:**

- Modify: `docs/RELEASE_PLAN.md`

- [ ] **Step 1: Update US-0185 status**

In `docs/RELEASE_PLAN.md`, locate the US-0185 block (under `## User Stories — EPIC-0028`). Update its `Status:` field from `Planned` to `In Progress`. Update its `Branch:` field to the actual feature branch name used for this work (e.g. `claude/<worktree-name>` if working in a worktree, or `feature/US-0185-conductor-dispatch-protocol` if a named branch).

(Status moves to `Done` and all `- [ ]` ACs become `- [x]` in a separate session-close commit _after_ the implementation PR merges, following the same pattern as US-0184.)

- [ ] **Step 2: Run full test suite with coverage**

Run: `npm test -- --coverage 2>&1 | tail -15`
Expected: all tests pass, coverage gate green (≥80% statements).

- [ ] **Step 3: Commit**

```bash
git add docs/RELEASE_PLAN.md
git commit -m "docs(US-0185): mark Status: In Progress and record branch"
```

---

## Final verification

- [ ] **Run the entire test suite with coverage:**

Run: `npm test -- --coverage`
Expected: all tests pass; coverage ≥80% across statements/branches/functions/lines.

- [ ] **Manual smoke (optional but recommended):**

```bash
# In a temp project root with a task in sdlc-status.json:
node tools/agent-task-review.js start --task-id task-abc --base-sha 0000000 --head-sha abc1234
# Expected stdout: READY_FOR_SPEC

node tools/agent-task-review.js spec-verdict --task-id task-abc --verdict APPROVED
# Expected stdout: PROCEED_TO_QUALITY

node tools/agent-task-review.js quality-verdict --task-id task-abc --verdict APPROVED
# Expected stdout: TASK_CLEARED

node tools/agent-task-review.js status --task-id task-abc
# Expected: JSON with status: "approved", completedAt: "<ISO>"
```

- [ ] **Open PR to `develop`:**

Push the feature branch and open a pull request to `develop` with this checklist:

- All 14 tasks committed
- Coverage gate green
- No new CodeQL alerts
- US-0185 status in RELEASE_PLAN.md will move to `Done` and all ACs checked in a follow-up session-close commit after merge

---

## Spec coverage verification

| Spec section                                                                                           | Covered by task(s)                                                              |
| ------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------- |
| §2 Architecture (CLI + pure state machine, data flow)                                                  | Tasks 4–10                                                                      |
| §3 CLI Surface (5 commands, stdout token contract)                                                     | Tasks 8, 9, 10                                                                  |
| §4 State Schema (`tasks.<uuid>.taskReview` + `headSha` field)                                          | Tasks 1, 4                                                                      |
| §5 Forge `[sha:...]` convention (parser, `[sha:none]`, validation)                                     | Tasks 1, 2                                                                      |
| §6 Automated BLOCKED routing (MORE_CONTEXT splice, UPGRADE_MODEL tier, SPLIT_TASK/ESCALATE_HUMAN halt) | Task 12 (DM_AGENT.md protocol)                                                  |
| §6.1 MORE_CONTEXT spliced message                                                                      | Task 12                                                                         |
| §6.2 Two independent caps (US-0183 escalation cap + US-0185 taskReview cap)                            | Task 12 documentation; caps are independent by construction (separate counters) |
| §7 DM_AGENT.md updates (6 edits)                                                                       | Task 12                                                                         |
| §8 Forge agent file updates                                                                            | Task 13                                                                         |
| §9 Configuration (`iterationCap.taskReview` default 2)                                                 | Task 3                                                                          |
| §10 Module layout (agent-task-review.js + state module)                                                | Tasks 4, 8                                                                      |
| §11 Testing strategy (unit, CLI, integration)                                                          | Tasks 4–11                                                                      |
| §12 Scope boundaries                                                                                   | Task 14 (RELEASE_PLAN update reflects in-scope items)                           |
| §13 No open questions                                                                                  | n/a — all design decisions resolved in the brainstorm                           |
