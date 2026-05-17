# US-0184 Context Curator Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship `tools/agent-context.js generate` — a CLI that assembles a structured markdown context payload (task, ACs, plan excerpt, prior-work summaries, agent-tagged lessons) for sub-agent dispatches. Bundles two US-0183 schema patches (`--plan-task-index`, `--summary`) and migrates `docs/LESSONS.md` to use `@agent:` tagging.

**Architecture:** Thin CLI wrapper (`tools/agent-context.js`) owns all filesystem I/O; pure assembler module (`tools/lib/agent-context-assembler.js`) is a function that takes plain objects and returns a markdown string. Same split as `agent-lifecycle.js` + `agent-lifecycle-state.js`.

**Tech Stack:** Node.js 18+, Jest 30, no new dependencies. All file paths relative to repo root `/Users/Kamal_Syed/Projects/PlanVisualizer` (or the worktree clone of it).

**Spec:** `docs/superpowers/specs/2026-05-14-us-0184-context-curator-design.md`

---

## File Structure

| Path                                           | Action | Responsibility                                                                           |
| ---------------------------------------------- | ------ | ---------------------------------------------------------------------------------------- |
| `tools/lib/agent-lifecycle-state.js`           | Modify | Add `planTaskIndex` + `summary` fields and accept them in `initTask` / `markDone`        |
| `tools/agent-lifecycle.js`                     | Modify | Add `--plan-task-index` + `--summary` argparse + thread through dispatch                 |
| `tools/lib/agent-context-assembler.js`         | Create | Pure module: parseStoryACs, parsePlanBlock, filterLessons, validateLessonsTags, assemble |
| `tools/agent-context.js`                       | Create | CLI wrapper for `generate` — reads files, calls assembler, prints stdout                 |
| `tests/unit/agent-lifecycle-state.test.js`     | Modify | +2 tests for new fields                                                                  |
| `tests/unit/agent-lifecycle-cli.test.js`       | Modify | +2 tests for new flags                                                                   |
| `tests/unit/agent-context-assembler.test.js`   | Create | Unit tests for every assembler function + section suppression                            |
| `tests/unit/agent-context-cli.test.js`         | Create | CLI tests for `generate`                                                                 |
| `tests/integration/agent-context-flow.test.js` | Create | start → done(summary) → start → generate flow                                            |
| `tests/unit/lessons-tagging.test.js`           | Create | Every L-XXXX has canonical `@agent:` tag                                                 |
| `tests/unit/agent-files-protocol.test.js`      | Modify | Assert DM_AGENT.md `§Per-Task Dispatch Ritual` updates                                   |
| `docs/LESSONS.md`                              | Modify | One-time migration: add `@agent:` line to each L-XXXX entry                              |
| `docs/agents/DM_AGENT.md`                      | Modify | Three edits in `§Per-Task Dispatch Ritual`                                               |
| `docs/RELEASE_PLAN.md`                         | Modify | Add US-0184 with ACs under EPIC-0028                                                     |
| `docs/ID_REGISTRY.md`                          | Modify | Bump next AC ID counter (0720→0726 reserved)                                             |

---

## Task 1: Schema additions to `agent-lifecycle-state.js`

**Files:**

- Modify: `tools/lib/agent-lifecycle-state.js`
- Test: `tests/unit/agent-lifecycle-state.test.js`

- [ ] **Step 1: Write the failing tests**

Append to `tests/unit/agent-lifecycle-state.test.js` (after the existing `describe('initTask', ...)` block):

```js
describe('initTask — US-0184 schema additions', () => {
  test('defaults planTaskIndex to null when not provided', () => {
    const t = initTask({ story: 'US-0184', agent: 'Forge', model: 'sonnet', description: 'x' });
    expect(t.planTaskIndex).toBeNull();
  });

  test('stores planTaskIndex when provided', () => {
    const t = initTask({ story: 'US-0184', agent: 'Forge', model: 'sonnet', description: 'x', planTaskIndex: 3 });
    expect(t.planTaskIndex).toBe(3);
  });

  test('defaults summary to null', () => {
    const t = initTask({ story: 'US-0184', agent: 'Forge', model: 'sonnet', description: 'x' });
    expect(t.summary).toBeNull();
  });
});

describe('markDone — US-0184 summary support', () => {
  const { markDone } = require('../../tools/lib/agent-lifecycle-state');
  function freshTaskWithId() {
    const data = {};
    const t = initTask({ story: 'US-0184', agent: 'Forge', model: 'sonnet', description: 'x' });
    startTask(data, t);
    return { data, taskId: t.id };
  }

  test('markDone stores summary when provided', () => {
    const { data, taskId } = freshTaskWithId();
    markDone(data, taskId, 'shipped foo');
    expect(data.tasks[taskId].summary).toBe('shipped foo');
    expect(data.tasks[taskId].state).toBe('done');
  });

  test('markDone leaves summary null when not provided', () => {
    const { data, taskId } = freshTaskWithId();
    markDone(data, taskId);
    expect(data.tasks[taskId].summary).toBeNull();
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx jest tests/unit/agent-lifecycle-state.test.js --no-coverage`
Expected: 5 failures. `planTaskIndex` and `summary` are `undefined` on the task object; `markDone` doesn't accept a third arg.

- [ ] **Step 3: Implement the schema additions**

In `tools/lib/agent-lifecycle-state.js`, modify `initTask`:

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
    planTaskIndex: typeof opts.planTaskIndex === 'number' ? opts.planTaskIndex : null,
    summary: null,
  };
}
```

Modify `markDone` to accept an optional summary:

```js
function markDone(data, taskId, summary) {
  const t = _requireTask(data, taskId);
  _requireInProgress(t, 'done');
  t.state = 'done';
  t.completedAt = nowISO();
  if (typeof summary === 'string' && summary.length > 0) {
    t.summary = summary;
  }
}
```

(No change to the module.exports list — same names exported.)

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx jest tests/unit/agent-lifecycle-state.test.js --no-coverage`
Expected: all tests pass (including the 5 new ones).

- [ ] **Step 5: Commit**

```bash
git add tools/lib/agent-lifecycle-state.js tests/unit/agent-lifecycle-state.test.js
git commit -m "feat(US-0184): add planTaskIndex + summary fields to task schema"
```

---

## Task 2: CLI flags for `agent-lifecycle.js`

**Files:**

- Modify: `tools/agent-lifecycle.js`
- Test: `tests/unit/agent-lifecycle-cli.test.js`

- [ ] **Step 1: Write the failing tests**

Append to `tests/unit/agent-lifecycle-cli.test.js` (find an existing `describe` block for start/done and add a sibling block):

```js
describe('agent-lifecycle CLI — US-0184 flags', () => {
  const { parseArgs, dispatch } = require('../../tools/agent-lifecycle');
  const fs = require('fs');
  const path = require('path');
  const os = require('os');

  function tmpSdlcWith(initial) {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'agent-lifecycle-'));
    const p = path.join(dir, 'sdlc-status.json');
    fs.writeFileSync(p, JSON.stringify(initial, null, 2));
    return p;
  }

  test('parseArgs picks up --plan-task-index as a number', () => {
    const opts = parseArgs(['node', 'cli', 'start', '--plan-task-index', '4']);
    expect(opts.planTaskIndex).toBe(4);
  });

  test('parseArgs picks up --summary as a string', () => {
    const opts = parseArgs(['node', 'cli', 'done', '--summary', 'shipped foo']);
    expect(opts.summary).toBe('shipped foo');
  });

  test('start writes planTaskIndex to the task record', () => {
    const sdlcPath = tmpSdlcWith({ tasks: {} });
    const out = [];
    const rc = dispatch(
      { cmd: 'start', story: 'US-0184', agent: 'Forge', task: 'do x', planTaskIndex: 3 },
      { sdlcPath, stdout: (s) => out.push(s), skipRegen: true },
    );
    expect(rc).toBe(0);
    const data = JSON.parse(fs.readFileSync(sdlcPath, 'utf8'));
    const t = Object.values(data.tasks)[0];
    expect(t.planTaskIndex).toBe(3);
    expect(out[0]).toBe(t.id);
  });

  test('done writes summary to the task record', () => {
    const sdlcPath = tmpSdlcWith({ tasks: {} });
    dispatch(
      { cmd: 'start', story: 'US-0184', agent: 'Forge', task: 'do x' },
      { sdlcPath, stdout: () => {}, skipRegen: true },
    );
    const data1 = JSON.parse(fs.readFileSync(sdlcPath, 'utf8'));
    const taskId = Object.keys(data1.tasks)[0];

    const rc = dispatch(
      { cmd: 'done', taskId, summary: 'shipped foo' },
      { sdlcPath, stdout: () => {}, skipRegen: true },
    );
    expect(rc).toBe(0);
    const data2 = JSON.parse(fs.readFileSync(sdlcPath, 'utf8'));
    expect(data2.tasks[taskId].summary).toBe('shipped foo');
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx jest tests/unit/agent-lifecycle-cli.test.js --no-coverage`
Expected: 4 failures. `opts.planTaskIndex` and `opts.summary` are `undefined`; the dispatch ignores them.

- [ ] **Step 3: Extend parseArgs to handle the two new flags**

In `tools/agent-lifecycle.js`, update the `parseArgs` function. Add two fields to the `out` default object (after the existing fields):

```js
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
  planTaskIndex: null,
  summary: null,
};
```

Add two `else if` branches inside the existing arg loop (after the `--state` branch and before the closing brace):

```js
    } else if (a === '--plan-task-index' && next !== undefined) {
      const n = parseInt(next, 10);
      out.planTaskIndex = Number.isNaN(n) ? null : n;
      i++;
    } else if (a === '--summary' && next !== undefined) {
      out.summary = next;
      i++;
    }
```

- [ ] **Step 4: Thread the flags through `dispatch`**

In the `case 'start':` branch of `dispatch`, modify the `initTask` call to pass `planTaskIndex`:

```js
const task = LifeState.initTask({
  story: opts.story,
  agent: opts.agent,
  model: opts.model,
  description: opts.task || '',
  planTaskIndex: opts.planTaskIndex,
});
```

In the `case 'done':` branch, pass `summary` as the third arg to `markDone`:

```js
LifeState.markDone(data, opts.taskId, opts.summary || undefined);
```

- [ ] **Step 5: Run tests to verify they pass**

Run: `npx jest tests/unit/agent-lifecycle-cli.test.js tests/unit/agent-lifecycle-state.test.js --no-coverage`
Expected: all tests pass (Task 1's 5 + Task 2's 4 + the pre-existing tests).

- [ ] **Step 6: Commit**

```bash
git add tools/agent-lifecycle.js tests/unit/agent-lifecycle-cli.test.js
git commit -m "feat(US-0184): wire --plan-task-index and --summary CLI flags"
```

---

## Task 3: Assembler — `parseStoryACs(specContent)`

**Files:**

- Create: `tools/lib/agent-context-assembler.js`
- Test: `tests/unit/agent-context-assembler.test.js`

- [ ] **Step 1: Write the failing test**

Create `tests/unit/agent-context-assembler.test.js`:

```js
'use strict';

const path = require('path');
const ASM_PATH = path.join(__dirname, '../../tools/lib/agent-context-assembler');

describe('parseStoryACs', () => {
  test('extracts an AC list from a fenced "Acceptance Criteria:" block', () => {
    const { parseStoryACs } = require(ASM_PATH);
    const spec = `
## 12. Acceptance Criteria (draft for RELEASE_PLAN.md)

- **AC-0720:** First criterion
- **AC-0721:** Second criterion with **bold** text
- **AC-0722:** Third
`;
    expect(parseStoryACs(spec)).toEqual([
      'AC-0720: First criterion',
      'AC-0721: Second criterion with **bold** text',
      'AC-0722: Third',
    ]);
  });

  test('returns null when no Acceptance Criteria section is present', () => {
    const { parseStoryACs } = require(ASM_PATH);
    expect(parseStoryACs('# random spec\n\nnothing about ACs here\n')).toBeNull();
  });

  test('returns null when the AC section exists but has no bullet items', () => {
    const { parseStoryACs } = require(ASM_PATH);
    expect(parseStoryACs('## Acceptance Criteria\n\n(none yet)\n')).toBeNull();
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx jest tests/unit/agent-context-assembler.test.js --no-coverage`
Expected: FAIL with "Cannot find module".

- [ ] **Step 3: Create the module skeleton + implement parseStoryACs**

Create `tools/lib/agent-context-assembler.js`:

```js
'use strict';

const CANONICAL_AGENTS = [
  'Compass',
  'Palette',
  'Pixel',
  'Keystone',
  'Lens',
  'Forge',
  'Sentinel',
  'Circuit',
  'Conductor',
];

function parseStoryACs(specContent) {
  if (typeof specContent !== 'string') return null;
  const headingRe = /^##\s+\d*\.?\s*Acceptance Criteria/im;
  const match = specContent.match(headingRe);
  if (!match) return null;
  const after = specContent.slice(match.index + match[0].length);
  const nextHeading = after.search(/^##\s+/m);
  const section = nextHeading >= 0 ? after.slice(0, nextHeading) : after;

  const items = [];
  const bulletRe = /^[-*]\s+\*?\*?(AC-\d+)\*?\*?:?\s*(.+)$/gm;
  let m;
  while ((m = bulletRe.exec(section)) !== null) {
    const id = m[1];
    const body = m[2].trim().replace(/\*\*$/, '');
    items.push(`${id}: ${body}`);
  }
  return items.length > 0 ? items : null;
}

module.exports = {
  CANONICAL_AGENTS,
  parseStoryACs,
};
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npx jest tests/unit/agent-context-assembler.test.js --no-coverage`
Expected: all 3 tests pass.

- [ ] **Step 5: Commit**

```bash
git add tools/lib/agent-context-assembler.js tests/unit/agent-context-assembler.test.js
git commit -m "feat(US-0184): add parseStoryACs to context assembler"
```

---

## Task 4: Assembler — `parsePlanBlock(planContent, n)`

**Files:**

- Modify: `tools/lib/agent-context-assembler.js`
- Test: `tests/unit/agent-context-assembler.test.js`

- [ ] **Step 1: Write the failing tests**

Append to `tests/unit/agent-context-assembler.test.js`:

```js
describe('parsePlanBlock', () => {
  const PLAN = `# Some Plan

## Task 1: First task

Some content for task 1.

## Task 2: Second task

Multi-line
content for task 2.

## Task 3: Third task

End content.
`;

  test('returns the requested block and total task count', () => {
    const { parsePlanBlock } = require(ASM_PATH);
    const r = parsePlanBlock(PLAN, 2);
    expect(r).not.toBeNull();
    expect(r.totalTasks).toBe(3);
    expect(r.block).toContain('Second task');
    expect(r.block).toContain('Multi-line');
    expect(r.block).not.toContain('Third task');
  });

  test('returns null when n is out of range', () => {
    const { parsePlanBlock } = require(ASM_PATH);
    expect(parsePlanBlock(PLAN, 5)).toBeNull();
    expect(parsePlanBlock(PLAN, 0)).toBeNull();
    expect(parsePlanBlock(PLAN, -1)).toBeNull();
  });

  test('returns null when no Task headings are present', () => {
    const { parsePlanBlock } = require(ASM_PATH);
    expect(parsePlanBlock('# No tasks here\n\nplain text\n', 1)).toBeNull();
  });

  test('returns the last block (no trailing heading to bound it)', () => {
    const { parsePlanBlock } = require(ASM_PATH);
    const r = parsePlanBlock(PLAN, 3);
    expect(r.block).toContain('Third task');
    expect(r.block).toContain('End content.');
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx jest tests/unit/agent-context-assembler.test.js --no-coverage`
Expected: 4 failures — `parsePlanBlock is not a function`.

- [ ] **Step 3: Implement `parsePlanBlock`**

In `tools/lib/agent-context-assembler.js`, add the function and export it:

```js
function parsePlanBlock(planContent, n) {
  if (typeof planContent !== 'string' || typeof n !== 'number' || n < 1) return null;
  const headingRe = /^##\s+Task\s+\d+\b[^\n]*$/gim;
  const matches = [];
  let m;
  while ((m = headingRe.exec(planContent)) !== null) {
    matches.push({ index: m.index, length: m[0].length });
  }
  if (matches.length === 0) return null;
  if (n > matches.length) return null;

  const target = matches[n - 1];
  const start = target.index;
  const next = matches[n];
  const end = next ? next.index : planContent.length;
  const block = planContent.slice(start, end).trimEnd();
  return { block, totalTasks: matches.length };
}

module.exports = {
  CANONICAL_AGENTS,
  parseStoryACs,
  parsePlanBlock,
};
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx jest tests/unit/agent-context-assembler.test.js --no-coverage`
Expected: all tests pass.

- [ ] **Step 5: Commit**

```bash
git add tools/lib/agent-context-assembler.js tests/unit/agent-context-assembler.test.js
git commit -m "feat(US-0184): add parsePlanBlock to context assembler"
```

---

## Task 5: Assembler — `filterLessons(lessonsContent, agentName)`

**Files:**

- Modify: `tools/lib/agent-context-assembler.js`
- Test: `tests/unit/agent-context-assembler.test.js`

- [ ] **Step 1: Write the failing tests**

Append to `tests/unit/agent-context-assembler.test.js`:

```js
describe('filterLessons', () => {
  const LESSONS = `# LESSONS.md

## L-0057 — Use try/catch ENOENT instead of existsSync+readFileSync
@agent: Forge

Body.

## L-0054 — Always dispatch subagents from absolute paths
@agent: Forge, Sentinel

Body.

## L-0050 — Some cross-cutting truth
@agent: all

Body.

## L-0049 — Compass-only thing
@agent: Compass

Body.

## L-0048 — Untagged old lesson

Body.
`;

  test('returns lessons tagged for the requested agent, including @agent: all', () => {
    const { filterLessons } = require(ASM_PATH);
    const r = filterLessons(LESSONS, 'Forge');
    expect(r.map((l) => l.id)).toEqual(['L-0057', 'L-0054', 'L-0050']);
    expect(r[0].title).toMatch(/Use try\/catch ENOENT/);
  });

  test('returns only @agent: all when no agent-specific matches exist', () => {
    const { filterLessons } = require(ASM_PATH);
    const r = filterLessons(LESSONS, 'Pixel');
    expect(r.map((l) => l.id)).toEqual(['L-0050']);
  });

  test('returns [] when no lessons match and there are no all-tagged lessons', () => {
    const { filterLessons } = require(ASM_PATH);
    const noAll = LESSONS.replace('@agent: all', '@agent: Lens');
    expect(filterLessons(noAll, 'Circuit')).toEqual([]);
  });

  test('comma-separated tags match each listed agent', () => {
    const { filterLessons } = require(ASM_PATH);
    expect(filterLessons(LESSONS, 'Sentinel').map((l) => l.id)).toEqual(['L-0054', 'L-0050']);
  });

  test('untagged lessons are not surfaced', () => {
    const { filterLessons } = require(ASM_PATH);
    const all = filterLessons(LESSONS, 'Forge');
    expect(all.map((l) => l.id)).not.toContain('L-0048');
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx jest tests/unit/agent-context-assembler.test.js --no-coverage`
Expected: 5 failures — `filterLessons is not a function`.

- [ ] **Step 3: Implement `filterLessons`**

In `tools/lib/agent-context-assembler.js`, add the function:

```js
function filterLessons(lessonsContent, agentName) {
  if (typeof lessonsContent !== 'string' || typeof agentName !== 'string') return [];
  const out = [];
  const entryRe = /^##\s+(L-\d+)\s+—\s+(.+)$/gm;
  let m;
  while ((m = entryRe.exec(lessonsContent)) !== null) {
    const id = m[1];
    const title = m[2].trim();
    const after = lessonsContent.slice(m.index + m[0].length);
    const nextHeading = after.search(/^##\s+/m);
    const body = nextHeading >= 0 ? after.slice(0, nextHeading) : after;
    const tagMatch = body.match(/^@agent:\s*(.+)$/m);
    if (!tagMatch) continue;
    const tags = tagMatch[1]
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean);
    if (tags.includes('all') || tags.includes(agentName)) {
      out.push({ id, title });
    }
  }
  return out;
}
```

Update `module.exports` to add `filterLessons`.

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx jest tests/unit/agent-context-assembler.test.js --no-coverage`
Expected: all tests pass.

- [ ] **Step 5: Commit**

```bash
git add tools/lib/agent-context-assembler.js tests/unit/agent-context-assembler.test.js
git commit -m "feat(US-0184): add filterLessons to context assembler"
```

---

## Task 6: Assembler — `validateLessonsTags(lessonsContent)`

**Files:**

- Modify: `tools/lib/agent-context-assembler.js`
- Test: `tests/unit/agent-context-assembler.test.js`

- [ ] **Step 1: Write the failing tests**

Append to `tests/unit/agent-context-assembler.test.js`:

```js
describe('validateLessonsTags', () => {
  test('reports tagged + untagged + invalid agent names', () => {
    const { validateLessonsTags } = require(ASM_PATH);
    const content = `
## L-0001 — A
@agent: Forge

## L-0002 — B
@agent: Pixel, NotAnAgent

## L-0003 — C
(untagged)

## L-0004 — D
@agent: all
`;
    const r = validateLessonsTags(content);
    expect(r.taggedCount).toBe(3);
    expect(r.untaggedCount).toBe(1);
    expect(r.invalidNames.sort()).toEqual(['NotAnAgent']);
  });

  test('returns zero counts on empty input', () => {
    const { validateLessonsTags } = require(ASM_PATH);
    expect(validateLessonsTags('')).toEqual({ taggedCount: 0, untaggedCount: 0, invalidNames: [] });
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx jest tests/unit/agent-context-assembler.test.js --no-coverage`
Expected: 2 failures — `validateLessonsTags is not a function`.

- [ ] **Step 3: Implement `validateLessonsTags`**

In `tools/lib/agent-context-assembler.js`:

```js
function validateLessonsTags(lessonsContent) {
  if (typeof lessonsContent !== 'string') {
    return { taggedCount: 0, untaggedCount: 0, invalidNames: [] };
  }
  const valid = new Set([...CANONICAL_AGENTS, 'all']);
  let taggedCount = 0;
  let untaggedCount = 0;
  const invalidNames = new Set();
  const entryRe = /^##\s+L-\d+\s+—/gm;
  let m;
  const positions = [];
  while ((m = entryRe.exec(lessonsContent)) !== null) positions.push(m.index);
  for (let i = 0; i < positions.length; i++) {
    const start = positions[i];
    const end = i + 1 < positions.length ? positions[i + 1] : lessonsContent.length;
    const body = lessonsContent.slice(start, end);
    const tagMatch = body.match(/^@agent:\s*(.+)$/m);
    if (!tagMatch) {
      untaggedCount++;
      continue;
    }
    taggedCount++;
    const tags = tagMatch[1]
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean);
    for (const t of tags) {
      if (!valid.has(t)) invalidNames.add(t);
    }
  }
  return { taggedCount, untaggedCount, invalidNames: Array.from(invalidNames) };
}
```

Update `module.exports` to add `validateLessonsTags`.

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx jest tests/unit/agent-context-assembler.test.js --no-coverage`
Expected: all tests pass.

- [ ] **Step 5: Commit**

```bash
git add tools/lib/agent-context-assembler.js tests/unit/agent-context-assembler.test.js
git commit -m "feat(US-0184): add validateLessonsTags to context assembler"
```

---

## Task 7: Assembler — `assemble(input)` top-level

**Files:**

- Modify: `tools/lib/agent-context-assembler.js`
- Test: `tests/unit/agent-context-assembler.test.js`

- [ ] **Step 1: Write the failing tests**

Append to `tests/unit/agent-context-assembler.test.js`:

```js
describe('assemble', () => {
  const { assemble } = require(ASM_PATH);

  const fullInput = {
    story: 'US-0184',
    agent: 'Forge',
    task: { description: 'Implement parseTaskBlock() in tools/lib/plan-parser.js' },
    planTaskIndex: 3,
    totalTasks: 7,
    ACs: ['AC-0720: First', 'AC-0721: Second'],
    planBlock: '## Task 3: Implement parseTaskBlock()\n\nSteps:\n1. Read plan\n2. Split on headings',
    priorTasks: [
      { state: 'done', summary: 'Added parseHeading() helper', planTaskIndex: 1 },
      { state: 'done_with_concerns', summary: 'Wrote initial tests', concerns: 'edge case untested', planTaskIndex: 2 },
    ],
    lessons: [
      { id: 'L-0057', title: 'Use try/catch ENOENT instead of existsSync+readFileSync' },
      { id: 'L-0054', title: 'Always dispatch subagents from absolute paths' },
    ],
  };

  test('renders all sections when content is present', () => {
    const md = assemble(fullInput);
    expect(md).toMatch(/^## Context for Forge — US-0184 \(Task 3\/7\)/);
    expect(md).toContain('### Your task');
    expect(md).toContain('Implement parseTaskBlock() in tools/lib/plan-parser.js');
    expect(md).toContain('### Story acceptance criteria');
    expect(md).toContain('- AC-0720: First');
    expect(md).toContain('### Plan excerpt');
    expect(md).toContain('> ## Task 3: Implement parseTaskBlock()');
    expect(md).toContain('### Prior work on this story');
    expect(md).toContain('- Task 1 (done): Added parseHeading() helper');
    expect(md).toContain('- Task 2 (done_with_concerns): Wrote initial tests');
    expect(md).toContain('  - Concern: edge case untested');
    expect(md).toContain('### Relevant lessons for Forge');
    expect(md).toContain('- **L-0057**');
  });

  test('drops "(Task N/M)" suffix when planTaskIndex missing', () => {
    const md = assemble({ ...fullInput, planTaskIndex: null });
    expect(md).toMatch(/^## Context for Forge — US-0184\n/);
    expect(md).not.toMatch(/\(Task /);
  });

  test('suppresses "Plan excerpt" section when planBlock is null', () => {
    const md = assemble({ ...fullInput, planBlock: null });
    expect(md).not.toContain('### Plan excerpt');
  });

  test('suppresses "Story acceptance criteria" section when ACs is null', () => {
    const md = assemble({ ...fullInput, ACs: null });
    expect(md).not.toContain('### Story acceptance criteria');
  });

  test('suppresses "Prior work on this story" section when priorTasks is empty', () => {
    const md = assemble({ ...fullInput, priorTasks: [] });
    expect(md).not.toContain('### Prior work on this story');
  });

  test('suppresses "Relevant lessons" section when lessons is empty', () => {
    const md = assemble({ ...fullInput, lessons: [] });
    expect(md).not.toContain('### Relevant lessons');
  });

  test('prior-task summary falls back to bare line when summary is null', () => {
    const md = assemble({
      ...fullInput,
      priorTasks: [{ state: 'done', summary: null, planTaskIndex: 1 }],
    });
    expect(md).toContain('- Task 1 (done)\n');
  });

  test('done_with_concerns prior task renders concern as sub-bullet', () => {
    const md = assemble({
      ...fullInput,
      priorTasks: [
        { state: 'done_with_concerns', summary: 'wrote tests', concerns: 'multi-line\nconcern', planTaskIndex: 2 },
      ],
    });
    expect(md).toContain('  - Concern: multi-line\nconcern');
  });

  test('your task section is always rendered even with everything else empty', () => {
    const md = assemble({
      story: 'US-0184',
      agent: 'Forge',
      task: { description: 'Bare task' },
      planTaskIndex: null,
      totalTasks: 0,
      ACs: null,
      planBlock: null,
      priorTasks: [],
      lessons: [],
    });
    expect(md).toContain('### Your task');
    expect(md).toContain('Bare task');
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx jest tests/unit/agent-context-assembler.test.js --no-coverage`
Expected: 9 failures — `assemble is not a function`.

- [ ] **Step 3: Implement `assemble`**

In `tools/lib/agent-context-assembler.js`:

```js
function _renderPriorTasks(priorTasks) {
  return priorTasks
    .sort((a, b) => (a.planTaskIndex || 0) - (b.planTaskIndex || 0))
    .map((t) => {
      const idx = t.planTaskIndex != null ? t.planTaskIndex : '?';
      const head = `- Task ${idx} (${t.state})`;
      const main = t.summary ? `${head}: ${t.summary}` : head;
      if (t.state === 'done_with_concerns' && t.concerns) {
        return `${main}\n  - Concern: ${t.concerns}`;
      }
      return main;
    })
    .join('\n');
}

function _quotePlanBlock(block) {
  return block
    .split('\n')
    .map((line) => '> ' + line)
    .join('\n');
}

function assemble(input) {
  const { story, agent, task, planTaskIndex, totalTasks, ACs, planBlock, priorTasks, lessons } = input;

  const header =
    planTaskIndex != null && totalTasks > 0
      ? `## Context for ${agent} — ${story} (Task ${planTaskIndex}/${totalTasks})`
      : `## Context for ${agent} — ${story}`;

  const parts = [header, '', '### Your task', '', task.description];

  if (Array.isArray(ACs) && ACs.length > 0) {
    parts.push('', '### Story acceptance criteria', '');
    for (const ac of ACs) parts.push(`- ${ac}`);
  }

  if (typeof planBlock === 'string' && planBlock.length > 0) {
    parts.push('', '### Plan excerpt', '', _quotePlanBlock(planBlock));
  }

  if (Array.isArray(priorTasks) && priorTasks.length > 0) {
    parts.push('', '### Prior work on this story', '', _renderPriorTasks(priorTasks));
  }

  if (Array.isArray(lessons) && lessons.length > 0) {
    parts.push('', `### Relevant lessons for ${agent}`, '');
    for (const l of lessons) parts.push(`- **${l.id}** — ${l.title}`);
  }

  return parts.join('\n') + '\n';
}
```

Update `module.exports` to include `assemble`.

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx jest tests/unit/agent-context-assembler.test.js --no-coverage`
Expected: all tests pass (across Tasks 3–7).

- [ ] **Step 5: Commit**

```bash
git add tools/lib/agent-context-assembler.js tests/unit/agent-context-assembler.test.js
git commit -m "feat(US-0184): add assemble() top-level to context assembler"
```

---

## Task 8: CLI wrapper — `tools/agent-context.js`

**Files:**

- Create: `tools/agent-context.js`
- Test: `tests/unit/agent-context-cli.test.js`

- [ ] **Step 1: Write the failing tests**

Create `tests/unit/agent-context-cli.test.js`:

```js
'use strict';

const fs = require('fs');
const path = require('path');
const os = require('os');

const { parseArgs, dispatch } = require('../../tools/agent-context');

function mkProject() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'agent-context-'));
  fs.mkdirSync(path.join(root, 'docs'), { recursive: true });
  return root;
}

function writeFile(root, rel, contents) {
  const p = path.join(root, rel);
  fs.mkdirSync(path.dirname(p), { recursive: true });
  fs.writeFileSync(p, contents);
  return p;
}

describe('agent-context CLI — parseArgs', () => {
  test('parses generate command with all required flags', () => {
    const opts = parseArgs([
      'node',
      'cli',
      'generate',
      '--story',
      'US-0184',
      '--agent',
      'Forge',
      '--task-id',
      'task-abc',
    ]);
    expect(opts).toEqual({ cmd: 'generate', story: 'US-0184', agent: 'Forge', taskId: 'task-abc' });
  });
});

describe('agent-context CLI — dispatch', () => {
  test('exits 1 when --story missing', () => {
    const root = mkProject();
    writeFile(root, 'docs/sdlc-status.json', JSON.stringify({ tasks: {} }));
    const err = [];
    const rc = dispatch(
      { cmd: 'generate', agent: 'Forge', taskId: 'task-x' },
      { root, stdout: () => {}, stderr: (s) => err.push(s) },
    );
    expect(rc).toBe(1);
    expect(err.join('\n')).toMatch(/--story required/);
  });

  test('exits 1 when --agent is not in canonical list', () => {
    const root = mkProject();
    writeFile(root, 'docs/sdlc-status.json', JSON.stringify({ tasks: {} }));
    const err = [];
    const rc = dispatch(
      { cmd: 'generate', story: 'US-0184', agent: 'Bogus', taskId: 'task-x' },
      { root, stdout: () => {}, stderr: (s) => err.push(s) },
    );
    expect(rc).toBe(1);
    expect(err.join('\n')).toMatch(/unknown agent/i);
  });

  test('exits 1 when task-id not found in sdlc-status', () => {
    const root = mkProject();
    writeFile(root, 'docs/sdlc-status.json', JSON.stringify({ tasks: {} }));
    const err = [];
    const rc = dispatch(
      { cmd: 'generate', story: 'US-0184', agent: 'Forge', taskId: 'task-missing' },
      { root, stdout: () => {}, stderr: (s) => err.push(s) },
    );
    expect(rc).toBe(1);
    expect(err.join('\n')).toMatch(/not found/i);
  });

  test('happy path writes payload to stdout, exit 0, no stderr', () => {
    const root = mkProject();
    writeFile(
      root,
      'docs/sdlc-status.json',
      JSON.stringify({
        stories: {
          'US-0184': {
            specPhase: { specPath: 'docs/spec.md' },
            planPhase: { planPath: 'docs/plan.md' },
          },
        },
        tasks: {
          'task-abc': {
            id: 'task-abc',
            story: 'US-0184',
            agent: 'Forge',
            description: 'Do the thing',
            state: 'in_progress',
            planTaskIndex: 1,
            summary: null,
          },
        },
      }),
    );
    writeFile(root, 'docs/spec.md', '## Acceptance Criteria\n\n- AC-0720: First\n- AC-0721: Second\n');
    writeFile(root, 'docs/plan.md', '## Task 1: Do it\n\nSteps:\n1. step one\n');
    writeFile(root, 'docs/LESSONS.md', '## L-0001 — Foo\n@agent: Forge\n\nbody\n');

    const out = [];
    const err = [];
    const rc = dispatch(
      { cmd: 'generate', story: 'US-0184', agent: 'Forge', taskId: 'task-abc' },
      { root, stdout: (s) => out.push(s), stderr: (s) => err.push(s) },
    );
    expect(rc).toBe(0);
    expect(err).toEqual([]);
    const payload = out.join('');
    expect(payload).toContain('## Context for Forge — US-0184 (Task 1/1)');
    expect(payload).toContain('Do the thing');
    expect(payload).toContain('AC-0720: First');
    expect(payload).toContain('### Plan excerpt');
    expect(payload).toContain('- **L-0001**');
  });

  test('missing spec doc → ACs section suppressed, exit 0', () => {
    const root = mkProject();
    writeFile(
      root,
      'docs/sdlc-status.json',
      JSON.stringify({
        stories: { 'US-0184': { planPhase: { planPath: 'docs/plan.md' } } },
        tasks: {
          'task-abc': {
            id: 'task-abc',
            story: 'US-0184',
            agent: 'Forge',
            description: 'task',
            state: 'in_progress',
            planTaskIndex: 1,
          },
        },
      }),
    );
    writeFile(root, 'docs/plan.md', '## Task 1: x\n\nstuff\n');
    writeFile(root, 'docs/LESSONS.md', '');

    const out = [];
    const rc = dispatch(
      { cmd: 'generate', story: 'US-0184', agent: 'Forge', taskId: 'task-abc' },
      { root, stdout: (s) => out.push(s), stderr: () => {} },
    );
    expect(rc).toBe(0);
    expect(out.join('')).not.toContain('Story acceptance criteria');
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx jest tests/unit/agent-context-cli.test.js --no-coverage`
Expected: failures because `tools/agent-context.js` does not yet exist.

- [ ] **Step 3: Implement `tools/agent-context.js`**

Create `tools/agent-context.js`:

```js
#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');
const Assembler = require('./lib/agent-context-assembler');

const DEFAULT_ROOT = path.join(__dirname, '..');

function parseArgs(argv) {
  const args = argv.slice(2);
  const out = { cmd: args[0] || null, story: null, agent: null, taskId: null };
  for (let i = 1; i < args.length; i++) {
    const a = args[i];
    const next = args[i + 1];
    if (a === '--story' && next) {
      out.story = next;
      i++;
    } else if (a === '--agent' && next) {
      out.agent = next;
      i++;
    } else if (a === '--task-id' && next) {
      out.taskId = next;
      i++;
    }
  }
  return out;
}

function readFileOrNull(p) {
  try {
    return fs.readFileSync(p, 'utf8');
  } catch {
    return null;
  }
}

function dispatch(opts, ctx = {}) {
  const root = ctx.root || DEFAULT_ROOT;
  const stdout = ctx.stdout || ((s) => process.stdout.write(s));
  const stderr = ctx.stderr || ((s) => process.stderr.write(s + '\n'));

  if (opts.cmd !== 'generate') {
    stderr(
      `[agent-context] unknown command '${opts.cmd}'. Usage: agent-context.js generate --story X --agent Y --task-id Z`,
    );
    return 1;
  }
  if (!opts.story) {
    stderr('[agent-context] --story required');
    return 1;
  }
  if (!opts.agent) {
    stderr('[agent-context] --agent required');
    return 1;
  }
  if (!opts.taskId) {
    stderr('[agent-context] --task-id required');
    return 1;
  }
  if (!Assembler.CANONICAL_AGENTS.includes(opts.agent)) {
    stderr(`[agent-context] unknown agent '${opts.agent}'. Canonical names: ${Assembler.CANONICAL_AGENTS.join(', ')}`);
    return 1;
  }

  const sdlcPath = path.join(root, 'docs/sdlc-status.json');
  let sdlc;
  try {
    sdlc = JSON.parse(fs.readFileSync(sdlcPath, 'utf8'));
  } catch (e) {
    stderr(`[agent-context] cannot read ${sdlcPath}: ${e.message}`);
    return 1;
  }

  const task = (sdlc.tasks || {})[opts.taskId];
  if (!task) {
    stderr(`[agent-context] task '${opts.taskId}' not found in sdlc-status.json`);
    return 1;
  }

  const story = (sdlc.stories || {})[opts.story] || {};
  const specPath = story.specPhase && story.specPhase.specPath;
  const planPath = story.planPhase && story.planPhase.planPath;

  const specContent = specPath ? readFileOrNull(path.join(root, specPath)) : null;
  const planContent = planPath ? readFileOrNull(path.join(root, planPath)) : null;
  const lessonsContent = readFileOrNull(path.join(root, 'docs/LESSONS.md')) || '';

  const ACs = specContent ? Assembler.parseStoryACs(specContent) : null;
  const planParsed =
    planContent && typeof task.planTaskIndex === 'number'
      ? Assembler.parsePlanBlock(planContent, task.planTaskIndex)
      : null;
  const lessons = Assembler.filterLessons(lessonsContent, opts.agent);

  const priorTasks = Object.values(sdlc.tasks || {}).filter(
    (t) => t.story === opts.story && t.id !== opts.taskId && (t.state === 'done' || t.state === 'done_with_concerns'),
  );

  const payload = Assembler.assemble({
    story: opts.story,
    agent: opts.agent,
    task,
    planTaskIndex: task.planTaskIndex,
    totalTasks: planParsed ? planParsed.totalTasks : 0,
    ACs,
    planBlock: planParsed ? planParsed.block : null,
    priorTasks,
    lessons,
  });

  stdout(payload);
  return 0;
}

function main() {
  const opts = parseArgs(process.argv);
  return dispatch(opts);
}

if (require.main === module) {
  process.exit(main());
}

module.exports = { parseArgs, dispatch, main };
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx jest tests/unit/agent-context-cli.test.js --no-coverage`
Expected: all tests pass.

- [ ] **Step 5: Commit**

```bash
git add tools/agent-context.js tests/unit/agent-context-cli.test.js
git commit -m "feat(US-0184): add tools/agent-context.js generate CLI"
```

---

## Task 9: Integration flow test

**Files:**

- Create: `tests/integration/agent-context-flow.test.js`

- [ ] **Step 1: Write the integration test**

Create `tests/integration/agent-context-flow.test.js`:

```js
'use strict';

const fs = require('fs');
const path = require('path');
const os = require('os');

const Lifecycle = require('../../tools/agent-lifecycle');
const Context = require('../../tools/agent-context');

function mkProject() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'agent-context-int-'));
  fs.mkdirSync(path.join(root, 'docs'), { recursive: true });
  fs.writeFileSync(
    path.join(root, 'docs/sdlc-status.json'),
    JSON.stringify({
      stories: { 'US-0184': { planPhase: { planPath: 'docs/plan.md' } } },
      tasks: {},
    }),
  );
  fs.writeFileSync(path.join(root, 'docs/plan.md'), '## Task 1: First\n\nstep one\n\n## Task 2: Second\n\nstep two\n');
  fs.writeFileSync(path.join(root, 'docs/LESSONS.md'), '');
  return root;
}

test('start → done(summary) → start → generate yields prior-work containing the first summary', () => {
  const root = mkProject();
  const sdlcPath = path.join(root, 'docs/sdlc-status.json');
  const out = [];

  // Task 1 start + done with summary
  Lifecycle.dispatch(
    { cmd: 'start', story: 'US-0184', agent: 'Forge', task: 'first task', planTaskIndex: 1 },
    { sdlcPath, stdout: (s) => out.push(s), skipRegen: true },
  );
  const data1 = JSON.parse(fs.readFileSync(sdlcPath, 'utf8'));
  const task1Id = Object.keys(data1.tasks)[0];
  Lifecycle.dispatch(
    { cmd: 'done', taskId: task1Id, summary: 'Implemented first thing' },
    { sdlcPath, stdout: () => {}, skipRegen: true },
  );

  // Task 2 start
  Lifecycle.dispatch(
    { cmd: 'start', story: 'US-0184', agent: 'Forge', task: 'second task', planTaskIndex: 2 },
    { sdlcPath, stdout: () => {}, skipRegen: true },
  );
  const data2 = JSON.parse(fs.readFileSync(sdlcPath, 'utf8'));
  const task2Id = Object.values(data2.tasks).find((t) => t.id !== task1Id).id;

  // generate context for task 2
  const payload = [];
  const rc = Context.dispatch(
    { cmd: 'generate', story: 'US-0184', agent: 'Forge', taskId: task2Id },
    { root, stdout: (s) => payload.push(s), stderr: () => {} },
  );

  expect(rc).toBe(0);
  const md = payload.join('');
  expect(md).toContain('## Context for Forge — US-0184 (Task 2/2)');
  expect(md).toContain('### Prior work on this story');
  expect(md).toContain('Task 1 (done): Implemented first thing');
  expect(md).toContain('### Plan excerpt');
  expect(md).toContain('## Task 2: Second');
});
```

- [ ] **Step 2: Run the integration test**

Run: `npx jest tests/integration/agent-context-flow.test.js --no-coverage`
Expected: test passes (no new implementation needed — this exercises code from prior tasks).

- [ ] **Step 3: Commit**

```bash
git add tests/integration/agent-context-flow.test.js
git commit -m "test(US-0184): add integration test for start → done → generate flow"
```

---

## Task 10: LESSONS.md tagging migration

**Files:**

- Modify: `docs/LESSONS.md` (add `@agent:` line to all 62 entries)
- Create: `tests/unit/lessons-tagging.test.js`

- [ ] **Step 1: Write the failing test**

Create `tests/unit/lessons-tagging.test.js`:

```js
'use strict';

const fs = require('fs');
const path = require('path');
const { validateLessonsTags } = require('../../tools/lib/agent-context-assembler');

test('every L-XXXX entry in LESSONS.md has a canonical @agent: tag', () => {
  const content = fs.readFileSync(path.join(__dirname, '../../docs/LESSONS.md'), 'utf8');
  const result = validateLessonsTags(content);
  expect(result.untaggedCount).toBe(0);
  expect(result.invalidNames).toEqual([]);
  expect(result.taggedCount).toBeGreaterThan(0);
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx jest tests/unit/lessons-tagging.test.js --no-coverage`
Expected: FAIL with `untaggedCount > 0` (all 62 entries are untagged at this point).

- [ ] **Step 3: Perform the tagging migration**

Open `docs/LESSONS.md`. For each `## L-XXXX — <title>` entry, insert a new line `@agent: <name>` directly after the heading (before the blank line that precedes the `**Rule:**` paragraph).

Use this rubric to choose the tag:

- Lesson about test design, jest fixtures, coverage gate, CI testing → `@agent: Sentinel`
- Lesson about state design, CLI architecture, lib module patterns, schema decisions → `@agent: Keystone`
- Lesson about UI behavior, dashboard rendering, patchDOM, widget UX → `@agent: Pixel`
- Lesson about design tokens, colors, typography → `@agent: Palette`
- Lesson about spec ACs, requirements drift, brainstorming format → `@agent: Compass`
- Lesson about code review findings, Lens patterns, persona-tag routing → `@agent: Lens`
- Lesson about implementation bugs/fixes, generator code, parser code, regex pitfalls → `@agent: Forge`
- Lesson about CI/CD, GitHub Actions, npm scripts, dependabot, release process, hooks → `@agent: Circuit`
- Lesson about orchestration, dispatch, sub-agent patterns, model selection, worktree management → `@agent: Conductor`
- Lesson that is truly cross-cutting (git hygiene, CodeQL TOCTOU, language pitfalls applicable to any agent writing JS) → `@agent: all`

When in doubt between two candidates, use comma-separated tagging: `@agent: Forge, Sentinel`.

Example transformation:

```diff
 ## L-0057 — CodeQL TOCTOU (`js/file-system-race`) fires on `statSync+readFileSync`
+@agent: all

 **Rule:** ...
```

```diff
 ## L-0054 — Haiku subagents commit to whichever repo their CWD resolves to
+@agent: Conductor

 _Observed in Session 41..._
```

After tagging all 62 entries, verify there are no remaining untagged entries:

```bash
node -e "const a=require('./tools/lib/agent-context-assembler'); const fs=require('fs'); console.log(a.validateLessonsTags(fs.readFileSync('docs/LESSONS.md','utf8')))"
```

Expected output: `{ taggedCount: 62, untaggedCount: 0, invalidNames: [] }`.

- [ ] **Step 4: Run the test to verify it passes**

Run: `npx jest tests/unit/lessons-tagging.test.js --no-coverage`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add docs/LESSONS.md tests/unit/lessons-tagging.test.js
git commit -m "docs(US-0184): tag all 62 LESSONS.md entries with canonical @agent:"
```

---

## Task 11: DM_AGENT.md protocol updates

**Files:**

- Modify: `docs/agents/DM_AGENT.md`
- Modify: `tests/unit/agent-files-protocol.test.js`

- [ ] **Step 1: Write the failing test**

In `tests/unit/agent-files-protocol.test.js`, find the existing `describe('DM_AGENT.md', ...)` block (or the test that asserts §Per-Task Dispatch Ritual exists) and append the following test inside the same describe (or in a new `describe('DM_AGENT.md — US-0184 updates', ...)` block):

```js
describe('DM_AGENT.md — US-0184 updates to Per-Task Dispatch Ritual', () => {
  const fs = require('fs');
  const path = require('path');
  const content = fs.readFileSync(path.join(__dirname, '../../docs/agents/DM_AGENT.md'), 'utf8');

  test('start command example includes --plan-task-index flag', () => {
    expect(content).toMatch(/--plan-task-index/);
  });

  test('step 1b context-generation block uses agent-context.js generate', () => {
    expect(content).toMatch(/node tools\/agent-context\.js generate/);
    expect(content).toMatch(/CONTEXT=\$\(node tools\/agent-context\.js/);
  });

  test('done command row includes --summary flag', () => {
    // Match the done row in the §Per-Task Dispatch Ritual table or code block
    expect(content).toMatch(/agent-lifecycle\.js done[^\n]*--summary/);
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx jest tests/unit/agent-files-protocol.test.js --no-coverage`
Expected: 3 failures (the strings don't yet exist in DM_AGENT.md).

- [ ] **Step 3: Apply the three edits to DM_AGENT.md**

Open `docs/agents/DM_AGENT.md` and locate `### Per-Task Dispatch Ritual` (around line 115). Make these three edits:

**Edit 3.1** — In step 1's `TASK_ID=$(node tools/agent-lifecycle.js start ...)` block, add the `--plan-task-index` argument:

```bash
TASK_ID=$(node tools/agent-lifecycle.js start \
  --story <id> --agent <name> --model <tier> \
  --task "<description>" \
  --plan-task-index <N>)
```

**Edit 3.2** — Insert a new step `1b` between step 1 and step 2:

````markdown
1b. **Generate context payload and inject into the dispatch message:**

    ```bash
    CONTEXT=$(node tools/agent-context.js generate \
      --story <id> --agent <name> --task-id $TASK_ID)
    ```

    Include `$CONTEXT` verbatim at the top of the sub-agent dispatch message,
    before any per-dispatch overrides.
````

**Edit 3.3** — In the step-3 table row for "Task complete, no issues" (or the corresponding `done` code example), add `--summary "<one-line handoff>"`:

```bash
node tools/agent-lifecycle.js done --task-id $TASK_ID --summary "<one-line handoff>"
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npx jest tests/unit/agent-files-protocol.test.js --no-coverage`
Expected: all tests pass.

- [ ] **Step 5: Commit**

```bash
git add docs/agents/DM_AGENT.md tests/unit/agent-files-protocol.test.js
git commit -m "docs(US-0184): update DM_AGENT.md Per-Task Dispatch Ritual"
```

---

## Task 12: RELEASE_PLAN.md + ID_REGISTRY.md entries

**Files:**

- Modify: `docs/RELEASE_PLAN.md`
- Modify: `docs/ID_REGISTRY.md`

- [ ] **Step 1: Append the US-0184 story under EPIC-0028**

In `docs/RELEASE_PLAN.md`, locate the US-0183 block under `## User Stories — EPIC-0028: Agentic Orchestration Engine` and append the following block immediately after the US-0183 closing ``` fence:

```markdown

```

US-0184 (EPIC-0028): As the Conductor, I want a context curator CLI that assembles structured markdown context payloads (task, acceptance criteria, plan excerpt, prior-work summaries, agent-tagged lessons) for sub-agent dispatches, so that specialist agents start with exactly the context they need instead of burning tokens discovering it.
Priority: High (P1)
Estimate: L
Status: Planned
Branch: feature/US-0184-context-curator
Dependencies: US-0182 (EPIC-0028), US-0183 (EPIC-0028)
Spec: docs/superpowers/specs/2026-05-14-us-0184-context-curator-design.md
Plan: docs/superpowers/plans/2026-05-14-us-0184-context-curator.md
Bundled schema patches from US-0183:

- --plan-task-index on agent-lifecycle.js start (optional, stored on task record)
- --summary on agent-lifecycle.js done (optional, rendered in prior-work section)
  Acceptance Criteria:

- [ ] AC-0720: tools/agent-context.js generate --story X --agent Y --task-id Z writes a markdown payload to stdout and exits 0 on the happy path
- [ ] AC-0721: Payload includes "Your task" plus (when content available) "Story acceptance criteria", "Plan excerpt", "Prior work on this story", "Relevant lessons for <Agent>" — empty sections are suppressed entirely
- [ ] AC-0722: --plan-task-index and --summary added as optional CLI flags to agent-lifecycle.js; corresponding task fields default to null and persist when provided
- [ ] AC-0723: LESSONS.md @agent: tagging convention is documented; every existing L-XXXX entry receives a canonical tag; validateLessonsTags() returns zero untagged and zero invalid agent names
- [ ] AC-0724: DM_AGENT.md §Per-Task Dispatch Ritual is updated with --plan-task-index capture, new step 1b context generation, and --summary on the done row
- [ ] AC-0725: Coverage gate (≥80% statements) remains green; all new test files meet the per-file targets in spec §10

```

```

(Note: the outer triple-backticks are the existing RELEASE_PLAN.md story-block fence; preserve that style.)

- [ ] **Step 2: Update `docs/ID_REGISTRY.md`**

Read the file to find the next-AC counter row. The previous next-AC value was 0710 (used by US-0183). US-0184 reserves AC-0720 through AC-0725, so the new next-AC value is 0726. Locate the table row similar to:

```markdown
| AC | AC-0726 | AC-0720 |
```

and update the **Last Used** column to `AC-0725` and the **Next Available** to `AC-0726`. Also bump the US row: change Last Used to `US-0184` (Next remains `US-0185`).

- [ ] **Step 3: Verify the full test suite still passes**

Run: `npm test -- --coverage`
Expected: all tests pass, coverage gate green (≥80% statements). Note new file coverage targets from spec §10.

- [ ] **Step 4: Commit**

```bash
git add docs/RELEASE_PLAN.md docs/ID_REGISTRY.md
git commit -m "docs(US-0184): add US-0184 to RELEASE_PLAN and bump ID_REGISTRY"
```

---

## Final verification

- [ ] **Run the entire test suite with coverage:**

Run: `npm test -- --coverage`
Expected: all tests pass, coverage ≥80% across statements/branches/functions/lines.

- [ ] **Manual smoke (optional but recommended):**

```bash
# From a fresh project clone or worktree where the changes are applied:
TASK_ID=$(node tools/agent-lifecycle.js start \
  --story US-0184 --agent Forge --model sonnet \
  --task "smoke test" --plan-task-index 1)

node tools/agent-context.js generate --story US-0184 --agent Forge --task-id $TASK_ID
```

Expected: a markdown payload prints to stdout with `## Context for Forge — US-0184 (Task 1/...)`.

- [ ] **Open PR to `develop`:**

Push the feature branch and open a pull request to `develop` with this checklist:

- All 12 tasks committed
- Coverage gate green
- No new CodeQL alerts
- US-0184 status in RELEASE_PLAN.md to be moved to `Done` (all ACs checked) only after PR merges

---

## Spec coverage verification

| Spec section                                                                   | Covered by task(s)                          |
| ------------------------------------------------------------------------------ | ------------------------------------------- |
| §2 Architecture (CLI + pure assembler split)                                   | Tasks 3–8                                   |
| §3 CLI Surface                                                                 | Task 8                                      |
| §4.1 `--summary` flag                                                          | Tasks 1, 2                                  |
| §4.2 `--plan-task-index` flag                                                  | Tasks 1, 2                                  |
| §4.3 Task schema additions                                                     | Task 1                                      |
| §5 Markdown payload template + suppression rules                               | Task 7                                      |
| §6 LESSONS.md `@agent:` convention + migration + validator                     | Tasks 6, 10                                 |
| §7 DM_AGENT.md updates (3 edits)                                               | Task 11                                     |
| §8 State storage schema (uses §4.3 fields + existing specPath/planPath)        | Tasks 1, 8                                  |
| §9 Module layout                                                               | Tasks 1–11                                  |
| §10 Testing strategy (per-file targets, critical scenarios, integration smoke) | Tasks 1–11                                  |
| §11 Scope boundaries                                                           | Task 12 (RELEASE_PLAN entry confirms scope) |
| §12 Acceptance criteria draft                                                  | Task 12                                     |
