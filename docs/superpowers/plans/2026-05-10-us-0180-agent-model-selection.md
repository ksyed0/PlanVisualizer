# US-0180 Agent Model Selection Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add `--model` and `--model-rationale` flags to `agent-start` in `tools/update-sdlc-status.js`. Add `## Model Selection` tables to all 8 specialist agent files plus a scenario quick-reference and dispatch ritual to `DM_AGENT.md`. Render an inline model chip on each agent card in the agentic dashboard's Agent Workload widget.

**Architecture:** Prompt-driven model selection — the Conductor reads markdown tables and dispatches via Task tool's `model` parameter. `agent-start --model <tier>` records the choice into `sdlcStatus.agents.<name>.model` AND `sdlcStatus.log[].model`. `generate-dashboard.js` reads the field and renders an inline chip next to the existing status chip. No new dispatcher code.

**Tech Stack:** Node.js 18+, Jest 30. No new dependencies.

**Depends on:** None.

---

## File Map

| File                                     | Change                                                                                                                                                |
| ---------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------- |
| `tools/update-sdlc-status.js`            | Modify — `agent-start` accepts `--model` and `--model-rationale`; `agent-done` clears `model` field; log entries include `model` and `modelRationale` |
| `tools/generate-dashboard.js`            | Modify — render inline model chip next to status chip in Agent Workload widget                                                                        |
| `docs/agents/DM_AGENT.md`                | Modify — add Model Selection Ritual subsection + scenario quick-reference table                                                                       |
| `docs/agents/PO_AGENT.md`                | Modify — add `## Model Selection` table (2 rows)                                                                                                      |
| `docs/agents/ARCHITECT_AGENT.md`         | Modify — add `## Model Selection` table (3 rows including opus)                                                                                       |
| `docs/agents/UI_DESIGNER_AGENT.md`       | Modify — add `## Model Selection` table (2 rows)                                                                                                      |
| `docs/agents/FE_DEV_AGENT.md`            | Modify — add `## Model Selection` table (2 rows)                                                                                                      |
| `docs/agents/BE_DEV_AGENT.md`            | Modify — add `## Model Selection` table (3 rows including opus)                                                                                       |
| `docs/agents/CODE_REVIEWER_AGENT.md`     | Modify — add `## Model Selection` table (3 rows including opus)                                                                                       |
| `docs/agents/FUNCTIONAL_TESTER_AGENT.md` | Modify — add `## Model Selection` table (2 rows)                                                                                                      |
| `docs/agents/AUTOMATION_TESTER_AGENT.md` | Modify — add `## Model Selection` table (2 rows)                                                                                                      |
| `tests/unit/update-sdlc-status.test.js`  | Extend — +6 tests for `--model` and `--model-rationale`                                                                                               |
| `tests/unit/generate-dashboard.test.js`  | Extend — +5 tests for model chip rendering                                                                                                            |
| `tests/unit/agent-files.test.js`         | New — +4 tests enforcing format contract + opus rarity policy                                                                                         |

---

## Working Branch

```bash
cd /Users/Kamal_Syed/Projects/PlanVisualizer
git checkout -b feature/US-0180-agent-model-selection
```

---

### Task 1: Extend `agent-start` and `agent-done` with model fields

**Files:**

- Modify: `tools/update-sdlc-status.js`
- Modify: `tests/unit/update-sdlc-status.test.js`

Add `--model` (optional, default `sonnet`) and `--model-rationale` (optional string) to the `agent-start` command. Record into `sdlcStatus.agents.<name>.model` and as fields on the log entry. `agent-done` sets `model` back to `null`.

- [ ] **Step 1: Write failing tests**

Append to `tests/unit/update-sdlc-status.test.js`:

```js
describe('agent-start — model selection', () => {
  test('records --model sonnet on agents.<name>.model', () => {
    const data = baseData();
    HANDLERS['agent-start'](data, { agent: 'Pixel', story: 'US-0181', task: 't', model: 'sonnet' });
    expect(data.agents.Pixel.model).toBe('sonnet');
  });

  test('defaults to sonnet when --model not provided', () => {
    const data = baseData();
    HANDLERS['agent-start'](data, { agent: 'Pixel', story: 'US-0181', task: 't' });
    expect(data.agents.Pixel.model).toBe('sonnet');
  });

  test('accepts haiku/sonnet/opus', () => {
    for (const m of ['haiku', 'sonnet', 'opus']) {
      const data = baseData();
      HANDLERS['agent-start'](data, { agent: 'A', model: m });
      expect(data.agents.A.model).toBe(m);
    }
  });

  test('rejects invalid model tier with error', () => {
    const data = baseData();
    expect(() => HANDLERS['agent-start'](data, { agent: 'A', model: 'gpt5' })).toThrow(/must be one of/i);
  });

  test('stores model-rationale on the log entry', () => {
    const data = baseData();
    HANDLERS['agent-start'](data, {
      agent: 'Pixel',
      story: 'US-0181',
      task: 't',
      model: 'opus',
      'model-rationale': 'system-design decision',
    });
    const last = data.log[data.log.length - 1];
    expect(last.model).toBe('opus');
    expect(last.modelRationale).toBe('system-design decision');
  });
});

describe('agent-done — clears model field', () => {
  test('agent-done sets agents.<name>.model to null', () => {
    const data = baseData();
    HANDLERS['agent-start'](data, { agent: 'Pixel', story: 'US-0181', task: 't', model: 'sonnet' });
    HANDLERS['agent-done'](data, { agent: 'Pixel', story: 'US-0181' });
    expect(data.agents.Pixel.model).toBeNull();
  });
});
```

(Assumes `baseData()` is the existing helper in the test file; if its name differs, find and use whatever creates a fresh sdlc-status data object.)

- [ ] **Step 2: Run to confirm failure**

```bash
cd /Users/Kamal_Syed/Projects/PlanVisualizer
npx jest tests/unit/update-sdlc-status.test.js --no-coverage -t "model selection" 2>&1 | tail -5
```

Expected: tests fail because `data.agents.Pixel.model` is undefined.

- [ ] **Step 3: Update `agent-start` handler in `tools/update-sdlc-status.js`**

Find the `agent-start` handler in the `HANDLERS` object. Update its body to capture model + rationale:

```js
  'agent-start': (data, opts) => {
    const VALID_MODELS = ['haiku', 'sonnet', 'opus'];
    const model = opts.model || 'sonnet';
    if (!VALID_MODELS.includes(model)) {
      throw new Error(`--model must be one of ${VALID_MODELS.join(', ')} (got: ${opts.model})`);
    }
    const modelRationale = opts['model-rationale'] || null;

    const agent = opts.agent;
    if (!data.agents[agent]) data.agents[agent] = {};
    data.agents[agent].status = 'active';
    data.agents[agent].currentTask = opts.task || null;
    data.agents[agent].currentStory = opts.story || null;
    data.agents[agent].model = model;   // NEW

    if (opts.story) {
      data.stories = data.stories || {};
      data.stories[opts.story] = data.stories[opts.story] || {};
      data.stories[opts.story].status = 'InProgress';
      data.stories[opts.story].assignedAgent = agent;
    }

    appendLog(data, agent, `started ${opts.story || ''} ${opts.task || ''}`.trim(), 'STARTED', {
      story: opts.story,
      task: opts.task,
      model,             // NEW
      modelRationale,    // NEW
    });
    return data;
  },
```

(The exact existing body may differ; preserve all existing fields and just add the model handling + log fields. The key change is adding `data.agents[agent].model = model` and passing `model`/`modelRationale` into `appendLog`.)

Also update `appendLog` if it doesn't yet accept the extra metadata parameter. If it currently signs as `appendLog(data, agent, message, tag)`, extend it:

```js
function appendLog(data, agent, message, tag, extra = {}) {
  data.log = data.log || [];
  data.log.push({
    timestamp: new Date().toISOString(),
    agent,
    message,
    tag,
    ...extra,
  });
}
```

(If `appendLog` already accepts extras via a different signature, adapt accordingly — keep the call site shape from the example above.)

- [ ] **Step 4: Update `agent-done` handler**

Find the `agent-done` handler in `HANDLERS`. Add the model clear:

```js
  'agent-done': (data, opts) => {
    const agent = opts.agent;
    if (!data.agents[agent]) data.agents[agent] = {};
    data.agents[agent].status = 'idle';
    data.agents[agent].currentTask = null;
    data.agents[agent].model = null;   // NEW
    data.agents[agent].tasksCompleted = (data.agents[agent].tasksCompleted || 0) + 1;
    data.metrics.tasksCompleted = (data.metrics.tasksCompleted || 0) + 1;
    appendLog(data, agent, `done ${opts.story || ''}`.trim(), 'DONE', { story: opts.story });
    return data;
  },
```

(Preserve existing fields; only add `data.agents[agent].model = null`.)

- [ ] **Step 5: Update `parseArgs` to accept `--model` and `--model-rationale`**

The existing `parseArgs` in `tools/update-sdlc-status.js` parses `--key value` pairs into the `opts` object. Verify it already handles arbitrary `--<key> <value>` pairs (it likely does). If so, no change needed — `--model sonnet` and `--model-rationale "reason"` will arrive as `opts.model` and `opts['model-rationale']`.

If parseArgs has a known-flags list, add `model` and `model-rationale` to it.

- [ ] **Step 6: Run tests to confirm pass**

```bash
npx jest tests/unit/update-sdlc-status.test.js --no-coverage 2>&1 | tail -5
```

Expected: all 6 new tests pass; no regressions.

- [ ] **Step 7: Smoke-test CLI**

```bash
cd /Users/Kamal_Syed/Projects/PlanVisualizer
node tools/update-sdlc-status.js agent-start --agent TestAgent --story TEST-1 --task "smoke test" --model haiku
grep -A 5 '"TestAgent"' docs/sdlc-status.json | head -10
```

Expected: `TestAgent` entry shows `"model": "haiku"`. Clean up:

```bash
node tools/update-sdlc-status.js agent-done --agent TestAgent --story TEST-1
```

- [ ] **Step 8: Commit**

```bash
git add tools/update-sdlc-status.js tests/unit/update-sdlc-status.test.js docs/sdlc-status.json
git commit -m "feat(US-0180): agent-start --model + --model-rationale; agent-done clears model"
```

---

### Task 2: Render inline model chip in Agent Workload widget

**Files:**

- Modify: `tools/generate-dashboard.js`
- Modify: `tests/unit/generate-dashboard.test.js`

In `generate-dashboard.js`, find the Agent Workload widget rendering. Add an inline model chip next to the existing Active/Idle status chip when `agents[name].model` is one of `haiku|sonnet|opus`. Add CSS classes for the three tiers using the low-saturation palette.

- [ ] **Step 1: Write failing tests**

Append to `tests/unit/generate-dashboard.test.js`:

```js
describe('agent workload — model chip', () => {
  function statusWithAgent(model) {
    return {
      currentPhase: 0,
      phases: [{ id: 1, name: 'Build', status: 'active' }],
      agents: {
        Pixel: { status: 'active', currentTask: 'X', currentStory: 'US-0001', model },
      },
      stories: { 'US-0001': { status: 'InProgress' } },
      metrics: {},
      log: [],
    };
  }

  test('renders inline model chip when model is sonnet', () => {
    const html = generateHTML(statusWithAgent('sonnet'));
    expect(html).toMatch(/mc-agent-model-chip sonnet[^>]*>sonnet</);
  });

  test('renders inline model chip when model is haiku', () => {
    const html = generateHTML(statusWithAgent('haiku'));
    expect(html).toMatch(/mc-agent-model-chip haiku[^>]*>haiku</);
  });

  test('renders inline model chip when model is opus', () => {
    const html = generateHTML(statusWithAgent('opus'));
    expect(html).toMatch(/mc-agent-model-chip opus[^>]*>opus</);
  });

  test('renders no model chip when model is null (idle)', () => {
    const status = statusWithAgent(null);
    status.agents.Pixel.status = 'idle';
    const html = generateHTML(status);
    expect(html).not.toContain('mc-agent-model-chip');
  });

  test('renders no model chip when model is undefined (pre-migration)', () => {
    const status = statusWithAgent(undefined);
    delete status.agents.Pixel.model;
    const html = generateHTML(status);
    expect(html).not.toContain('mc-agent-model-chip');
  });
});
```

- [ ] **Step 2: Run to confirm failure**

```bash
cd /Users/Kamal_Syed/Projects/PlanVisualizer
npx jest tests/unit/generate-dashboard.test.js --no-coverage -t "model chip" 2>&1 | tail -5
```

Expected: tests fail because the chip is not rendered.

- [ ] **Step 3: Add CSS for the model chip**

Find the `<style>` block in `tools/generate-dashboard.js` (search for `.pv-agent` or `mc-agent` selectors). Add these rules near the existing agent card styles:

```css
.mc-agent-model-chip {
  font-size: 9px;
  padding: 1px 6px;
  border-radius: 8px;
  margin-left: 4px;
  display: inline-block;
  font-weight: 600;
}
.mc-agent-model-chip.haiku {
  background: rgba(34, 197, 94, 0.1);
  color: oklch(60% 0.08 145);
}
.mc-agent-model-chip.sonnet {
  background: rgba(99, 102, 241, 0.1);
  color: oklch(60% 0.08 260);
}
.mc-agent-model-chip.opus {
  background: rgba(168, 85, 247, 0.1);
  color: oklch(60% 0.1 290);
}
```

- [ ] **Step 4: Render the chip inline next to the status chip**

Find the agent card template in `generate-dashboard.js`. It renders the status (Active/Idle) chip — search for `Active` or `Idle` in the agent loop. Adjacent to the existing chip render, add:

```js
const modelChip =
  agent.model && ['haiku', 'sonnet', 'opus'].includes(agent.model)
    ? `<span class="mc-agent-model-chip ${agent.model}">${agent.model}</span>`
    : '';
```

Then include `${modelChip}` immediately after the status chip in the template, so they sit inline (in the same flex row or container). Per L-0053, declare `modelChip` as a pre-computed `const` outside any nested template literals before the main HTML return.

- [ ] **Step 5: Run tests to confirm pass**

```bash
npx jest tests/unit/generate-dashboard.test.js --no-coverage 2>&1 | tail -5
```

Expected: 5 new tests pass.

- [ ] **Step 6: Smoke-test dashboard**

```bash
node tools/generate-dashboard.js 2>&1 | tail -3
grep -c "mc-agent-model-chip" docs/dashboard.html
```

Expected: dashboard generates cleanly. The grep count depends on how many agents are currently active with a model — at least 0 (it's fine if no agents are currently active during smoke test).

To verify visually with a known state:

```bash
node tools/update-sdlc-status.js agent-start --agent Pixel --story TEST-1 --task "smoke" --model sonnet
node tools/generate-dashboard.js
grep "mc-agent-model-chip" docs/dashboard.html | head -2
node tools/update-sdlc-status.js agent-done --agent Pixel --story TEST-1
```

Expected grep result: one line containing `mc-agent-model-chip sonnet`.

- [ ] **Step 7: Commit**

```bash
git add tools/generate-dashboard.js tests/unit/generate-dashboard.test.js docs/dashboard.html
git commit -m "feat(US-0180): inline model chip in Agent Workload widget (haiku/sonnet/opus)"
```

---

### Task 3: Add `## Model Selection` table to PO_AGENT.md

**Files:**

- Modify: `docs/agents/PO_AGENT.md`

Append a new section per the spec.

- [ ] **Step 1: Add the section**

Find the end of `docs/agents/PO_AGENT.md` (or a sensible insertion point near other top-level sections). Append:

```markdown
## Model Selection

| Task type                                                | Model  | Rationale                                                          |
| -------------------------------------------------------- | ------ | ------------------------------------------------------------------ |
| Status check, story field update, AC marking complete    | haiku  | Pattern application — rules already documented                     |
| Story breakdown, AC writing, bug triage, roadmap shaping | sonnet | Integration judgment — combining context, requirements, priorities |
```

- [ ] **Step 2: Commit**

```bash
git add docs/agents/PO_AGENT.md
git commit -m "feat(US-0180): add Model Selection table to PO_AGENT.md"
```

---

### Task 4: Add `## Model Selection` table to ARCHITECT_AGENT.md

**Files:**

- Modify: `docs/agents/ARCHITECT_AGENT.md`

- [ ] **Step 1: Add the section**

Append to `docs/agents/ARCHITECT_AGENT.md`:

```markdown
## Model Selection

| Task type                                                                 | Model  | Rationale                                              |
| ------------------------------------------------------------------------- | ------ | ------------------------------------------------------ |
| Routine code structure question, lookup, clarification                    | haiku  | Pattern application                                    |
| Refactor planning, design doc within existing patterns, component diagram | sonnet | Integration judgment within established architecture   |
| System design, new architectural pattern, cross-cutting decision          | opus   | Irreversible — cascades through every downstream agent |
```

- [ ] **Step 2: Commit**

```bash
git add docs/agents/ARCHITECT_AGENT.md
git commit -m "feat(US-0180): add Model Selection table to ARCHITECT_AGENT.md"
```

---

### Task 5: Add `## Model Selection` table to UI_DESIGNER_AGENT.md

**Files:**

- Modify: `docs/agents/UI_DESIGNER_AGENT.md`

- [ ] **Step 1: Add the section**

```markdown
## Model Selection

| Task type                                                        | Model  | Rationale                                           |
| ---------------------------------------------------------------- | ------ | --------------------------------------------------- |
| Style adjustment, single-component tweak following design system | haiku  | Pattern application — design system is documented   |
| Mockup creation, design system update, new screen                | sonnet | Integration judgment across screens / design tokens |
```

- [ ] **Step 2: Commit**

```bash
git add docs/agents/UI_DESIGNER_AGENT.md
git commit -m "feat(US-0180): add Model Selection table to UI_DESIGNER_AGENT.md"
```

---

### Task 6: Add `## Model Selection` table to FE_DEV_AGENT.md

**Files:**

- Modify: `docs/agents/FE_DEV_AGENT.md`

- [ ] **Step 1: Add the section**

```markdown
## Model Selection

| Task type                                                                        | Model  | Rationale            |
| -------------------------------------------------------------------------------- | ------ | -------------------- |
| Style fix, format change, pattern-following implementation (Nth tab, Nth widget) | haiku  | Pattern application  |
| Net-new feature with non-trivial design choices, cross-cutting refactor          | sonnet | Integration judgment |
```

- [ ] **Step 2: Commit**

```bash
git add docs/agents/FE_DEV_AGENT.md
git commit -m "feat(US-0180): add Model Selection table to FE_DEV_AGENT.md"
```

---

### Task 7: Add `## Model Selection` table to BE_DEV_AGENT.md

**Files:**

- Modify: `docs/agents/BE_DEV_AGENT.md`

- [ ] **Step 1: Add the section**

```markdown
## Model Selection

| Task type                                                | Model  | Rationale                                          |
| -------------------------------------------------------- | ------ | -------------------------------------------------- |
| Constants change, pattern-following endpoint addition    | haiku  | Pattern application                                |
| Net-new feature, integration logic, multi-file bugfix    | sonnet | Integration judgment                               |
| Database schema migration, security-sensitive auth logic | opus   | Irreversible — hard to roll back without data loss |
```

- [ ] **Step 2: Commit**

```bash
git add docs/agents/BE_DEV_AGENT.md
git commit -m "feat(US-0180): add Model Selection table to BE_DEV_AGENT.md"
```

---

### Task 8: Add `## Model Selection` table to CODE_REVIEWER_AGENT.md

**Files:**

- Modify: `docs/agents/CODE_REVIEWER_AGENT.md`

- [ ] **Step 1: Add the section**

```markdown
## Model Selection

| Task type                                            | Model  | Rationale                                     |
| ---------------------------------------------------- | ------ | --------------------------------------------- |
| Syntax/style review, lint check, format verification | haiku  | Pattern application — rules are deterministic |
| Feature PR review, multi-file diff review            | sonnet | Integration judgment across the diff          |
| Security review, architectural PR review             | opus   | Irreversible if a flaw ships                  |
```

- [ ] **Step 2: Commit**

```bash
git add docs/agents/CODE_REVIEWER_AGENT.md
git commit -m "feat(US-0180): add Model Selection table to CODE_REVIEWER_AGENT.md"
```

---

### Task 9: Add `## Model Selection` table to FUNCTIONAL_TESTER_AGENT.md

**Files:**

- Modify: `docs/agents/FUNCTIONAL_TESTER_AGENT.md`

- [ ] **Step 1: Add the section**

```markdown
## Model Selection

| Task type                                                  | Model  | Rationale                            |
| ---------------------------------------------------------- | ------ | ------------------------------------ |
| Manual test execution, regression run, snapshot verify     | haiku  | Pattern application — runbook-driven |
| Test case writing, edge case identification, test strategy | sonnet | Integration judgment about coverage  |
```

- [ ] **Step 2: Commit**

```bash
git add docs/agents/FUNCTIONAL_TESTER_AGENT.md
git commit -m "feat(US-0180): add Model Selection table to FUNCTIONAL_TESTER_AGENT.md"
```

---

### Task 10: Add `## Model Selection` table to AUTOMATION_TESTER_AGENT.md

**Files:**

- Modify: `docs/agents/AUTOMATION_TESTER_AGENT.md`

- [ ] **Step 1: Add the section**

```markdown
## Model Selection

| Task type                                               | Model  | Rationale                                         |
| ------------------------------------------------------- | ------ | ------------------------------------------------- |
| Automated test run, flake re-run, simple fixture update | haiku  | Pattern application                               |
| New test suite, fixture design, framework refactor      | sonnet | Integration judgment across the test architecture |
```

- [ ] **Step 2: Commit**

```bash
git add docs/agents/AUTOMATION_TESTER_AGENT.md
git commit -m "feat(US-0180): add Model Selection table to AUTOMATION_TESTER_AGENT.md"
```

---

### Task 11: Add scenario quick-reference + Model Selection Ritual to DM_AGENT.md

**Files:**

- Modify: `docs/agents/DM_AGENT.md`

DM_AGENT.md gets TWO additions:

1. A "Model Selection — Scenario Quick-Reference" top-level section with the lean 7-row scenario index
2. A "Model Selection Ritual" subsection inserted into the existing "How to Spawn Sub-Agents" section

- [ ] **Step 1: Append scenario quick-reference section**

Append to `docs/agents/DM_AGENT.md`, ideally near other top-level reference sections (e.g., right after "Orchestration Playbook"):

```markdown
## Model Selection — Scenario Quick-Reference

Scenario → agent index. Consult the target agent's `## Model Selection` section for the model choice.

| Scenario                                       | Target agent                          | Notes                                             |
| ---------------------------------------------- | ------------------------------------- | ------------------------------------------------- |
| story-start (analysis, AC writing, breakdown)  | PO                                    | —                                                 |
| story-start (architecture review)              | Architect                             | opus when introducing a new architectural pattern |
| feature implementation                         | FE Dev / BE Dev                       | —                                                 |
| code review / release prep / pre-release audit | Code Reviewer                         | opus for security or architecture-level review    |
| test execution (automated or manual)           | Automation Tester / Functional Tester | —                                                 |
| design, mockups, design-system work            | UI Designer                           | —                                                 |
| bug triage / priority update                   | PO                                    | —                                                 |

**Fallback rule:** if no scenario matches, default to `sonnet`. Record `--model-rationale "no scenario match"` on the agent-start call.

**Cost ground rule:** opus dispatches require an irreversible-decision justification documented via `--model-rationale "..."`. If unsure whether opus is justified, sonnet is the right call.
```

- [ ] **Step 2: Insert Model Selection Ritual subsection**

Find the "How to Spawn Sub-Agents" section in DM_AGENT.md. Insert a new subsection at the end of it (before the next `## ` heading):

```markdown
### Model Selection Ritual

Before spawning any sub-agent:

1. Read the target agent's `## Model Selection` section in `docs/agents/<Agent>_AGENT.md`.
2. Match the dispatch task to a row in the table. If no row matches, default to `sonnet`.
3. Record the dispatch with the chosen model:
   `node tools/update-sdlc-status.js agent-start --agent <name> --story <id> --task "<desc>" --model <tier>`
4. Spawn the sub-agent using the platform's model-override mechanism (in Claude Code: pass `model: <tier>` to the Task tool).
5. If the table's recommendation does not fit the task — i.e., you have a deliberate reason to override — add `--model-rationale "<short justification>"` to step 3.

**Ordering rule:** log after spawn lands. If the spawn fails, do not log; if the log fails after a successful spawn, surface as an event but do not block.

**Opus discipline:** Opus dispatches require `--model-rationale "<reason>"` even when the table recommends opus. The rationale becomes the audit trail for high-cost decisions.

**Fallback rule:** If no row in the target agent's table matches the task, default to `sonnet`. Record `--model-rationale "no table match"` so adherence can be measured over time.
```

- [ ] **Step 3: Commit**

```bash
git add docs/agents/DM_AGENT.md
git commit -m "feat(US-0180): DM_AGENT scenario quick-reference + Model Selection Ritual"
```

---

### Task 12: Add `agent-files.test.js` with policy + format contract

**Files:**

- Create: `tests/unit/agent-files.test.js`

Tests that enforce the format contract Conductor relies on, and the "opus stays rare" policy.

- [ ] **Step 1: Write failing tests** (will fail until earlier tasks add the tables — but earlier tasks should already be done)

```js
// tests/unit/agent-files.test.js
'use strict';
const fs = require('fs');
const path = require('path');

const SPECIALIST_AGENTS = [
  'PO_AGENT.md',
  'ARCHITECT_AGENT.md',
  'UI_DESIGNER_AGENT.md',
  'FE_DEV_AGENT.md',
  'BE_DEV_AGENT.md',
  'CODE_REVIEWER_AGENT.md',
  'FUNCTIONAL_TESTER_AGENT.md',
  'AUTOMATION_TESTER_AGENT.md',
];

const AGENTS_DIR = path.join(__dirname, '..', '..', 'docs', 'agents');

function readAgentFile(name) {
  return fs.readFileSync(path.join(AGENTS_DIR, name), 'utf8');
}

function findModelSelectionTable(content) {
  // Find `## Model Selection` heading, then the markdown table that follows.
  const re = /## Model Selection\n+([^\n]+)\n([^\n]+)\n([\s\S]*?)(?=\n## |\Z)/m;
  const m = content.match(re);
  if (!m) return null;
  return { headerLine: m[1], separatorLine: m[2], body: m[3] };
}

function parseTableRows(body) {
  return body
    .split('\n')
    .filter((l) => l.trim().startsWith('|') && !l.match(/^\|\s*-+\s*\|/))
    .map((l) =>
      l
        .split('|')
        .map((s) => s.trim())
        .filter((s) => s !== ''),
    );
}

describe('agent-files — Model Selection contract', () => {
  test('all 8 specialist agent files contain a `## Model Selection` section', () => {
    for (const file of SPECIALIST_AGENTS) {
      const content = readAgentFile(file);
      const table = findModelSelectionTable(content);
      expect(table).not.toBeNull();
    }
  });

  test('each Model Selection table has exact column headers [Task type, Model, Rationale]', () => {
    for (const file of SPECIALIST_AGENTS) {
      const content = readAgentFile(file);
      const table = findModelSelectionTable(content);
      expect(table.headerLine).toMatch(/\|\s*Task type\s*\|\s*Model\s*\|\s*Rationale\s*\|/);
    }
  });

  test('opus row count across all 8 agent files is ≤ 20% of total rows', () => {
    let totalRows = 0;
    let opusRows = 0;
    for (const file of SPECIALIST_AGENTS) {
      const content = readAgentFile(file);
      const table = findModelSelectionTable(content);
      const rows = parseTableRows(table.body);
      totalRows += rows.length;
      opusRows += rows.filter((r) => r[1] === 'opus').length;
    }
    const ratio = opusRows / totalRows;
    expect(ratio).toBeLessThanOrEqual(0.2);
  });

  test('DM_AGENT.md does NOT contain a `## Model Selection` section', () => {
    const content = readAgentFile('DM_AGENT.md');
    // DM_AGENT owns the scenario quick-reference, not the per-agent table.
    expect(content).not.toMatch(/^## Model Selection$/m);
  });
});
```

- [ ] **Step 2: Run tests**

```bash
cd /Users/Kamal_Syed/Projects/PlanVisualizer
npx jest tests/unit/agent-files.test.js --no-coverage 2>&1 | tail -5
```

Expected: all 4 tests pass (because Tasks 3–10 added the tables and Task 11 left DM_AGENT.md with the scenario index instead of `## Model Selection`).

- [ ] **Step 3: Commit**

```bash
git add tests/unit/agent-files.test.js
git commit -m "test(US-0180): enforce agent-files Model Selection format + opus rarity policy"
```

---

## Final Verification

After all 12 tasks:

- [ ] **Run full test suite**

```bash
npx jest --no-coverage 2>&1 | tail -5
```

Expected: ≥1683 existing + ~15 new tests, all passing.

- [ ] **Run dashboard smoke test**

```bash
cd /Users/Kamal_Syed/Projects/PlanVisualizer
node tools/update-sdlc-status.js agent-start --agent Pixel --story TEST-99 --task "smoke" --model haiku
node tools/generate-dashboard.js
grep -c "mc-agent-model-chip haiku" docs/dashboard.html
node tools/update-sdlc-status.js agent-done --agent Pixel --story TEST-99
```

Expected: grep returns 1 (one inline haiku chip rendered).

- [ ] **Run coverage check**

```bash
npx jest --coverage 2>&1 | grep -E "All files|update-sdlc-status|generate-dashboard"
```

Expected: new test paths exercised; overall ≥80%.

If all pass, branch is ready for PR.
