# US-0181 Pre-Dispatch Spec & Plan Orchestration Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a state-machine + CLI + dashboard widget + agent protocol that drives every story through `spec → plan → ready_for_dispatch` with user approval gates and Lens-reviewed artifacts on disk.

**Architecture:** A pure-Node state machine module + flag scanner + Lens findings parser, wrapped by a single `tools/agent-spec-plan.js` CLI. State persists in `docs/sdlc-status.json` under each `stories.<id>` record. Approvals come from CLI (fast-path) or dashboard flag-file downloads (visual path). Agent files (DM_AGENT and 5 specialists) gain protocol subsections that tell agents WHEN to call the CLI. Works with or without the superpowers plugin via tiered fallback.

**Tech Stack:** Node.js 18+, Jest 30, no new runtime dependencies. Existing `tools/memory.js` pattern (parseArgs + dispatch + lib modules) is the template.

**Spec:** `docs/superpowers/specs/2026-05-11-us-0181-pre-dispatch-spec-plan-orchestration-design.md`

**Branch:** `feature/US-0181-pre-dispatch-orchestration`

---

## File Map

| File                                             | Change                                                                  |
| ------------------------------------------------ | ----------------------------------------------------------------------- |
| `.gitignore`                                     | Modify — add `docs/pending-approvals/`                                  |
| `plan-visualizer.config.json`                    | Modify — add `orchestration` block with `iterationCap` defaults         |
| `package.json`                                   | Modify — add 6 `agent:*` npm script aliases                             |
| `tools/lib/agent-spec-plan-state.js`             | Create — pure state machine (~280 LOC)                                  |
| `tools/lib/lens-findings-parser.js`              | Create — parse markdown `@persona` findings (~80 LOC)                   |
| `tools/lib/agent-spec-plan-flags.js`             | Create — flag file scanner/applier (~140 LOC)                           |
| `tools/agent-spec-plan.js`                       | Create — CLI wrapper with 13 commands (~340 LOC)                        |
| `tools/generate-plan.js`                         | Modify — auto-invoke `apply-pending` as first step                      |
| `tools/lib/render-tabs.js`                       | Modify — add Pending Approvals widget on Status tab                     |
| `tests/unit/agent-spec-plan-state.test.js`       | Create — ~40 tests, state transitions                                   |
| `tests/unit/lens-findings-parser.test.js`        | Create — ~12 tests, parsing rules                                       |
| `tests/unit/agent-spec-plan-flags.test.js`       | Create — ~15 tests, flag scanner                                        |
| `tests/unit/agent-spec-plan-cli.test.js`         | Create — ~12 tests, CLI arg parsing + exit codes                        |
| `tests/unit/dashboard-pending-approvals.test.js` | Create — ~8 tests, widget rendering                                     |
| `tests/unit/agent-files-protocol.test.js`        | Create — 7 format-contract tests                                        |
| `tests/integration/agent-spec-plan-flow.test.js` | Create — 4 smoke tests                                                  |
| `tests/e2e/agent-spec-plan-download.spec.js`     | Create — 1 Playwright spec                                              |
| `docs/agents/DM_AGENT.md`                        | Modify — add `## Pre-Dispatch Spec & Plan Orchestration` section        |
| `docs/agents/PO_AGENT.md`                        | Modify — add `## Spec Brainstorming Protocol` + `## Spec Output Schema` |
| `docs/agents/ARCHITECT_AGENT.md`                 | Modify — add `## Plan Writing Protocol` + `## Self-Review Checklist`    |
| `docs/agents/UI_DESIGNER_AGENT.md`               | Modify — add `## Spec Contribution Protocol`                            |
| `docs/agents/FE_DEV_AGENT.md`                    | Modify — add `## UI Mockup Protocol`                                    |
| `docs/agents/CODE_REVIEWER_AGENT.md`             | Modify — add `## Spec/Plan Review Protocol`                             |
| `docs/test-procedures/agent-spec-plan-smoke.md`  | Create — manual smoke checklist                                         |

---

## Working Branch Setup

```bash
cd /Users/Kamal_Syed/Projects/PlanVisualizer
git checkout develop && git pull origin develop
git checkout -b feature/US-0181-pre-dispatch-orchestration
```

---

### Task 1: Setup — gitignore, config, npm scripts

**Files:**

- Modify: `.gitignore`
- Modify: `plan-visualizer.config.json`
- Modify: `package.json`

- [ ] **Step 1: Add `.gitignore` entry for pending-approvals**

Append to `.gitignore`:

```
# Ephemeral approval flag files dropped by the dashboard widget (US-0181)
docs/pending-approvals/
```

- [ ] **Step 2: Add orchestration config block to `plan-visualizer.config.json`**

Open `plan-visualizer.config.json`. Find the closing `}` of the `memory` block. Add a new `orchestration` block after it (keep memory block intact):

```json
,
  "orchestration": {
    "iterationCap": {
      "spec": 3,
      "plan": 3
    },
    "pendingApprovalsDir": "docs/pending-approvals"
  }
```

The final structure should have `memory` and `orchestration` as siblings under the top-level object.

- [ ] **Step 3: Add npm script aliases to `package.json`**

In `package.json`, in the `scripts` object, add these entries after `memory:suggest-model` (or any existing memory script):

```json
"agent:approve": "node tools/agent-spec-plan.js approve",
"agent:reject": "node tools/agent-spec-plan.js reject",
"agent:pending": "node tools/agent-spec-plan.js show-pending",
"agent:apply": "node tools/agent-spec-plan.js apply-pending",
"agent:list": "node tools/agent-spec-plan.js list",
"agent:status": "node tools/agent-spec-plan.js status"
```

- [ ] **Step 4: Create the pending-approvals directory with `.gitkeep`**

```bash
mkdir -p docs/pending-approvals
touch docs/pending-approvals/.gitkeep
```

Update `.gitignore` to allow `.gitkeep`:

```
docs/pending-approvals/
!docs/pending-approvals/.gitkeep
```

- [ ] **Step 5: Verify changes are consistent**

Run:

```bash
node -e "const c=require('./plan-visualizer.config.json'); console.log('orchestration:', JSON.stringify(c.orchestration))"
node -e "const p=require('./package.json'); console.log('agent scripts:', Object.keys(p.scripts).filter(k=>k.startsWith('agent:')))"
```

Expected: orchestration block prints, 6 agent: scripts listed.

- [ ] **Step 6: Commit**

```bash
git add .gitignore plan-visualizer.config.json package.json docs/pending-approvals/.gitkeep
git commit -m "chore(US-0181): scaffold gitignore, orchestration config, npm scripts"
```

---

### Task 2: State machine — initStory + deriveOverall

**Files:**

- Create: `tools/lib/agent-spec-plan-state.js`
- Create: `tests/unit/agent-spec-plan-state.test.js`

We build the state machine in slices — initialization + derivation first, then transitions in subsequent tasks. Pure functions only.

- [ ] **Step 1: Write failing tests for initStory + deriveOverall**

Create `tests/unit/agent-spec-plan-state.test.js`:

```js
'use strict';
const { initStory, deriveOverall, SPEC_STATES, PLAN_STATES } = require('../../tools/lib/agent-spec-plan-state');

describe('initStory', () => {
  test('returns specPhase + planPhase + phaseHistory with default values', () => {
    const s = initStory();
    expect(s.specPhase.state).toBe('pending');
    expect(s.specPhase.reviewIterations).toBe(0);
    expect(s.specPhase.reviewIterationCap).toBe(3);
    expect(s.specPhase.specPath).toBeNull();
    expect(s.specPhase.mockupPath).toBeNull();
    expect(s.specPhase.uiSurface).toBe(false);
    expect(s.specPhase.lastReviewVerdict).toBeNull();
    expect(s.specPhase.acApprovedAt).toBeNull();
    expect(s.specPhase.specApprovedAt).toBeNull();
    expect(s.planPhase.state).toBe('pending');
    expect(s.planPhase.author).toBeNull();
    expect(s.phaseHistory).toEqual([]);
  });

  test('accepts custom iteration caps', () => {
    const s = initStory({ specCap: 5, planCap: 2 });
    expect(s.specPhase.reviewIterationCap).toBe(5);
    expect(s.planPhase.reviewIterationCap).toBe(2);
  });
});

describe('SPEC_STATES enum', () => {
  test('lists all 7 spec states', () => {
    expect(SPEC_STATES).toEqual([
      'pending',
      'in_progress',
      'review',
      'awaiting_ac_approval',
      'awaiting_spec_approval',
      'approved',
      'escalated',
    ]);
  });
});

describe('PLAN_STATES enum', () => {
  test('lists all 7 plan states', () => {
    expect(PLAN_STATES).toEqual([
      'pending',
      'in_progress',
      'review',
      'spec_gap',
      'awaiting_plan_approval',
      'approved',
      'escalated',
    ]);
  });
});

describe('deriveOverall', () => {
  test('returns "ready_for_dispatch" when plan approved', () => {
    expect(deriveOverall('approved', 'approved')).toBe('ready_for_dispatch');
  });
  test('returns "plan" when plan in_progress', () => {
    expect(deriveOverall('approved', 'in_progress')).toBe('plan');
  });
  test('returns "plan" when plan in review', () => {
    expect(deriveOverall('approved', 'review')).toBe('plan');
  });
  test('returns "plan" when spec approved but plan pending', () => {
    expect(deriveOverall('approved', 'pending')).toBe('plan');
  });
  test('returns "spec" when spec in_progress', () => {
    expect(deriveOverall('in_progress', 'pending')).toBe('spec');
  });
  test('returns "spec" when spec awaiting AC approval', () => {
    expect(deriveOverall('awaiting_ac_approval', 'pending')).toBe('spec');
  });
  test('returns "pending" when both phases pending', () => {
    expect(deriveOverall('pending', 'pending')).toBe('pending');
  });
  test('returns "escalated" when either phase escalated', () => {
    expect(deriveOverall('escalated', 'pending')).toBe('escalated');
    expect(deriveOverall('approved', 'escalated')).toBe('escalated');
  });
});
```

- [ ] **Step 2: Run tests to confirm failure**

```bash
cd /Users/Kamal_Syed/Projects/PlanVisualizer
npx jest tests/unit/agent-spec-plan-state.test.js --no-coverage 2>&1 | tail -5
```

Expected: `Cannot find module '../../tools/lib/agent-spec-plan-state'`

- [ ] **Step 3: Create `tools/lib/agent-spec-plan-state.js` with initStory + deriveOverall**

```js
'use strict';

// State enums
const SPEC_STATES = [
  'pending',
  'in_progress',
  'review',
  'awaiting_ac_approval',
  'awaiting_spec_approval',
  'approved',
  'escalated',
];

const PLAN_STATES = ['pending', 'in_progress', 'review', 'spec_gap', 'awaiting_plan_approval', 'approved', 'escalated'];

/**
 * Initialize a fresh orchestration record for a story.
 * @param {{ specCap?: number, planCap?: number }} opts
 */
function initStory(opts = {}) {
  return {
    specPhase: {
      state: 'pending',
      specPath: null,
      mockupPath: null,
      uiSurface: false,
      reviewIterations: 0,
      reviewIterationCap: opts.specCap || 3,
      lastReviewVerdict: null,
      acApprovedAt: null,
      specApprovedAt: null,
    },
    planPhase: {
      state: 'pending',
      planPath: null,
      author: null,
      reviewIterations: 0,
      reviewIterationCap: opts.planCap || 3,
      lastReviewVerdict: null,
      planApprovedAt: null,
    },
    phaseHistory: [],
  };
}

/**
 * Derive the overall orchestration state from spec + plan phase states.
 * Never stored — always computed.
 */
function deriveOverall(specState, planState) {
  if (specState === 'escalated' || planState === 'escalated') return 'escalated';
  if (planState === 'approved') return 'ready_for_dispatch';
  if (planState && planState !== 'pending') return 'plan';
  if (specState === 'approved') return 'plan';
  if (specState && specState !== 'pending') return 'spec';
  return 'pending';
}

module.exports = {
  SPEC_STATES,
  PLAN_STATES,
  initStory,
  deriveOverall,
};
```

- [ ] **Step 4: Run tests to confirm pass**

```bash
npx jest tests/unit/agent-spec-plan-state.test.js --no-coverage 2>&1 | tail -5
```

Expected: All initStory + deriveOverall + enum tests pass.

- [ ] **Step 5: Commit**

```bash
git add tools/lib/agent-spec-plan-state.js tests/unit/agent-spec-plan-state.test.js
git commit -m "feat(US-0181): state machine module — initStory + deriveOverall"
```

---

### Task 3: State machine — spec phase transitions

**Files:**

- Modify: `tools/lib/agent-spec-plan-state.js`
- Modify: `tests/unit/agent-spec-plan-state.test.js`

Add the spec-phase transition functions: `specStart`, `specUpdate`, `specAwaitAc`, `acApprove`, `acReject`, `specReviewResult`, `specAwaitFinal`, `specApprove`, `specReject`.

- [ ] **Step 1: Append failing tests to `agent-spec-plan-state.test.js`**

```js
const {
  specStart,
  specUpdate,
  specAwaitAc,
  acApprove,
  acReject,
  specReviewResult,
  specAwaitFinal,
  specApprove,
  specReject,
} = require('../../tools/lib/agent-spec-plan-state');

describe('specStart', () => {
  test('transitions pending → in_progress', () => {
    const s = specStart(initStory(), { specPath: 'docs/specs/x.md' });
    expect(s.specPhase.state).toBe('in_progress');
    expect(s.specPhase.specPath).toBe('docs/specs/x.md');
  });

  test('records phase history entry', () => {
    const s = specStart(initStory(), { specPath: 'x' });
    expect(s.phaseHistory).toHaveLength(1);
    expect(s.phaseHistory[0].phase).toBe('spec');
    expect(typeof s.phaseHistory[0].enteredAt).toBe('string');
  });

  test('throws when specPhase not pending', () => {
    const s = specStart(initStory(), { specPath: 'x' });
    expect(() => specStart(s, { specPath: 'y' })).toThrow(/cannot spec-start.*'in_progress'/i);
  });
});

describe('specUpdate', () => {
  test('updates a top-level specPhase field', () => {
    const s = specUpdate(specStart(initStory(), {}), { field: 'uiSurface', value: true });
    expect(s.specPhase.uiSurface).toBe(true);
  });

  test('rejects unknown field', () => {
    expect(() => specUpdate(initStory(), { field: 'badField', value: 1 })).toThrow(/unknown field/i);
  });

  test('coerces "true"/"false" strings to boolean for uiSurface', () => {
    const s = specUpdate(specStart(initStory(), {}), { field: 'uiSurface', value: 'true' });
    expect(s.specPhase.uiSurface).toBe(true);
  });
});

describe('specAwaitAc + acApprove + acReject', () => {
  test('specAwaitAc transitions in_progress → awaiting_ac_approval', () => {
    const s = specAwaitAc(specStart(initStory(), {}));
    expect(s.specPhase.state).toBe('awaiting_ac_approval');
  });

  test('acApprove transitions awaiting_ac_approval → in_progress, records timestamp', () => {
    let s = specAwaitAc(specStart(initStory(), {}));
    s = acApprove(s);
    expect(s.specPhase.state).toBe('in_progress');
    expect(s.specPhase.acApprovedAt).toMatch(/\d{4}-\d{2}-\d{2}T/);
  });

  test('acReject returns to in_progress with reason logged via lastReviewVerdict-like field', () => {
    let s = specAwaitAc(specStart(initStory(), {}));
    s = acReject(s, { reason: 'missing edge case' });
    expect(s.specPhase.state).toBe('in_progress');
    expect(s.specPhase.acApprovedAt).toBeNull();
  });

  test('acApprove throws when not in awaiting_ac_approval', () => {
    expect(() => acApprove(initStory())).toThrow(/cannot approve ac/i);
  });
});

describe('specReviewResult', () => {
  test('APPROVED transitions in_progress → review (cap not enforced on approve)', () => {
    let s = acApprove(specAwaitAc(specStart(initStory(), {})));
    s = specReviewResult(s, { verdict: 'APPROVED' });
    expect(s.specPhase.state).toBe('review');
    expect(s.specPhase.lastReviewVerdict).toBe('APPROVED');
  });

  test('REQUEST_CHANGES increments iterations, stays in review', () => {
    let s = acApprove(specAwaitAc(specStart(initStory(), {})));
    s = specReviewResult(s, { verdict: 'REQUEST_CHANGES' });
    expect(s.specPhase.state).toBe('review');
    expect(s.specPhase.reviewIterations).toBe(1);
  });

  test('REQUEST_CHANGES at cap auto-escalates', () => {
    let s = acApprove(specAwaitAc(specStart(initStory({ specCap: 2 }), {})));
    s = specReviewResult(s, { verdict: 'REQUEST_CHANGES' });
    s = specReviewResult(s, { verdict: 'REQUEST_CHANGES' });
    expect(s.specPhase.state).toBe('escalated');
  });

  test('rejects unknown verdict', () => {
    const s = acApprove(specAwaitAc(specStart(initStory(), {})));
    expect(() => specReviewResult(s, { verdict: 'WHATEVER' })).toThrow(/unknown verdict/i);
  });
});

describe('specAwaitFinal + specApprove + specReject', () => {
  test('specAwaitFinal transitions review → awaiting_spec_approval (only after APPROVED verdict)', () => {
    let s = acApprove(specAwaitAc(specStart(initStory(), {})));
    s = specReviewResult(s, { verdict: 'APPROVED' });
    s = specAwaitFinal(s);
    expect(s.specPhase.state).toBe('awaiting_spec_approval');
  });

  test('specAwaitFinal throws if last verdict was REQUEST_CHANGES', () => {
    let s = acApprove(specAwaitAc(specStart(initStory(), {})));
    s = specReviewResult(s, { verdict: 'REQUEST_CHANGES' });
    expect(() => specAwaitFinal(s)).toThrow(/lens has not approved/i);
  });

  test('specApprove transitions awaiting_spec_approval → approved, records timestamp + closes history entry', () => {
    let s = specAwaitFinal(
      specReviewResult(acApprove(specAwaitAc(specStart(initStory(), {}))), { verdict: 'APPROVED' }),
    );
    s = specApprove(s);
    expect(s.specPhase.state).toBe('approved');
    expect(s.specPhase.specApprovedAt).toMatch(/\d{4}-\d{2}-\d{2}T/);
    expect(s.phaseHistory[0].exitedAt).toMatch(/\d{4}-\d{2}-\d{2}T/);
  });

  test('specReject returns awaiting_spec_approval → in_progress with reason logged', () => {
    let s = specAwaitFinal(
      specReviewResult(acApprove(specAwaitAc(specStart(initStory(), {}))), { verdict: 'APPROVED' }),
    );
    s = specReject(s, { reason: 'scope creep' });
    expect(s.specPhase.state).toBe('in_progress');
    expect(s.specPhase.specApprovedAt).toBeNull();
  });
});
```

- [ ] **Step 2: Run tests to confirm failure**

```bash
npx jest tests/unit/agent-spec-plan-state.test.js --no-coverage 2>&1 | tail -8
```

Expected: All new spec-phase tests fail (functions not defined yet).

- [ ] **Step 3: Add spec-phase transitions to `tools/lib/agent-spec-plan-state.js`**

Append these functions to the file, before `module.exports`:

```js
const VALID_SPEC_UPDATE_FIELDS = ['specPath', 'mockupPath', 'uiSurface'];

function nowISO() {
  return new Date().toISOString();
}

function _enterPhase(orchestration, phase) {
  return {
    ...orchestration,
    phaseHistory: [...orchestration.phaseHistory, { phase, enteredAt: nowISO(), exitedAt: null }],
  };
}

function _exitPhase(orchestration, phase) {
  const last = orchestration.phaseHistory.findIndex((p) => p.phase === phase && !p.exitedAt);
  if (last === -1) return orchestration;
  const newHistory = [...orchestration.phaseHistory];
  newHistory[last] = { ...newHistory[last], exitedAt: nowISO() };
  return { ...orchestration, phaseHistory: newHistory };
}

/** spec-start: pending → in_progress */
function specStart(orchestration, opts = {}) {
  if (orchestration.specPhase.state !== 'pending') {
    throw new Error(`Cannot spec-start: specPhase is '${orchestration.specPhase.state}', expected 'pending'`);
  }
  const o = _enterPhase(orchestration, 'spec');
  return {
    ...o,
    specPhase: {
      ...o.specPhase,
      state: 'in_progress',
      specPath: opts.specPath || null,
      uiSurface: opts.uiSurface || false,
    },
  };
}

/** spec-update: update a top-level specPhase field */
function specUpdate(orchestration, opts) {
  if (!VALID_SPEC_UPDATE_FIELDS.includes(opts.field)) {
    throw new Error(`Unknown field '${opts.field}'; valid: ${VALID_SPEC_UPDATE_FIELDS.join(', ')}`);
  }
  let value = opts.value;
  if (opts.field === 'uiSurface') {
    if (value === 'true') value = true;
    else if (value === 'false') value = false;
    else value = !!value;
  }
  return {
    ...orchestration,
    specPhase: { ...orchestration.specPhase, [opts.field]: value },
  };
}

/** spec-await-ac: in_progress → awaiting_ac_approval */
function specAwaitAc(orchestration) {
  if (orchestration.specPhase.state !== 'in_progress') {
    throw new Error(`Cannot spec-await-ac: specPhase is '${orchestration.specPhase.state}', expected 'in_progress'`);
  }
  return {
    ...orchestration,
    specPhase: { ...orchestration.specPhase, state: 'awaiting_ac_approval' },
  };
}

/** approve --gate ac */
function acApprove(orchestration) {
  if (orchestration.specPhase.state !== 'awaiting_ac_approval') {
    throw new Error(
      `Cannot approve AC: specPhase is '${orchestration.specPhase.state}', expected 'awaiting_ac_approval'`,
    );
  }
  return {
    ...orchestration,
    specPhase: {
      ...orchestration.specPhase,
      state: 'in_progress',
      acApprovedAt: nowISO(),
    },
  };
}

/** reject --gate ac */
function acReject(orchestration, opts) {
  if (orchestration.specPhase.state !== 'awaiting_ac_approval') {
    throw new Error(
      `Cannot reject AC: specPhase is '${orchestration.specPhase.state}', expected 'awaiting_ac_approval'`,
    );
  }
  return {
    ...orchestration,
    specPhase: {
      ...orchestration.specPhase,
      state: 'in_progress',
      acApprovedAt: null,
      _lastRejectReason: opts.reason || 'no reason given',
    },
  };
}

/** spec-review-result --verdict APPROVED|REQUEST_CHANGES */
function specReviewResult(orchestration, opts) {
  if (opts.verdict !== 'APPROVED' && opts.verdict !== 'REQUEST_CHANGES') {
    throw new Error(`Unknown verdict '${opts.verdict}'; expected APPROVED or REQUEST_CHANGES`);
  }
  let next = {
    ...orchestration,
    specPhase: {
      ...orchestration.specPhase,
      state: 'review',
      lastReviewVerdict: opts.verdict,
    },
  };
  if (opts.verdict === 'REQUEST_CHANGES') {
    const newIter = next.specPhase.reviewIterations + 1;
    next = {
      ...next,
      specPhase: { ...next.specPhase, reviewIterations: newIter },
    };
    if (newIter >= next.specPhase.reviewIterationCap) {
      next = { ...next, specPhase: { ...next.specPhase, state: 'escalated' } };
    }
  }
  return next;
}

/** spec-await-final: review → awaiting_spec_approval (only after APPROVED) */
function specAwaitFinal(orchestration) {
  if (orchestration.specPhase.state !== 'review') {
    throw new Error(`Cannot spec-await-final: specPhase is '${orchestration.specPhase.state}', expected 'review'`);
  }
  if (orchestration.specPhase.lastReviewVerdict !== 'APPROVED') {
    throw new Error('Cannot spec-await-final: Lens has not approved the spec');
  }
  return {
    ...orchestration,
    specPhase: { ...orchestration.specPhase, state: 'awaiting_spec_approval' },
  };
}

/** approve --gate spec */
function specApprove(orchestration) {
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

/** reject --gate spec */
function specReject(orchestration, opts) {
  if (orchestration.specPhase.state !== 'awaiting_spec_approval') {
    throw new Error(
      `Cannot reject spec: specPhase is '${orchestration.specPhase.state}', expected 'awaiting_spec_approval'`,
    );
  }
  return {
    ...orchestration,
    specPhase: {
      ...orchestration.specPhase,
      state: 'in_progress',
      specApprovedAt: null,
      _lastRejectReason: opts.reason || 'no reason given',
    },
  };
}
```

Update `module.exports` to include the new functions:

```js
module.exports = {
  SPEC_STATES,
  PLAN_STATES,
  initStory,
  deriveOverall,
  specStart,
  specUpdate,
  specAwaitAc,
  acApprove,
  acReject,
  specReviewResult,
  specAwaitFinal,
  specApprove,
  specReject,
};
```

- [ ] **Step 4: Run tests to confirm pass**

```bash
npx jest tests/unit/agent-spec-plan-state.test.js --no-coverage 2>&1 | tail -5
```

Expected: All tests pass.

- [ ] **Step 5: Commit**

```bash
git add tools/lib/agent-spec-plan-state.js tests/unit/agent-spec-plan-state.test.js
git commit -m "feat(US-0181): spec-phase state transitions (start/update/await-ac/approve/reject/review/await-final)"
```

---

### Task 4: State machine — plan phase transitions

**Files:**

- Modify: `tools/lib/agent-spec-plan-state.js`
- Modify: `tests/unit/agent-spec-plan-state.test.js`

Add plan-phase transitions: `planStart`, `planSpecGap`, `planReviewResult`, `planAwaitApproval`, `planApprove`, `planReject`.

- [ ] **Step 1: Append failing tests to `agent-spec-plan-state.test.js`**

```js
const {
  planStart,
  planSpecGap,
  planReviewResult,
  planAwaitApproval,
  planApprove,
  planReject,
} = require('../../tools/lib/agent-spec-plan-state');

function approvedSpec() {
  let s = specStart(initStory(), {});
  s = specAwaitAc(s);
  s = acApprove(s);
  s = specReviewResult(s, { verdict: 'APPROVED' });
  s = specAwaitFinal(s);
  return specApprove(s);
}

describe('planStart', () => {
  test('transitions plan pending → in_progress, records author + phase history', () => {
    const s = planStart(approvedSpec(), { author: 'Keystone', planPath: 'docs/plans/x.md' });
    expect(s.planPhase.state).toBe('in_progress');
    expect(s.planPhase.author).toBe('Keystone');
    expect(s.planPhase.planPath).toBe('docs/plans/x.md');
    const planHist = s.phaseHistory.find((p) => p.phase === 'plan');
    expect(planHist).toBeTruthy();
  });

  test('throws if spec not approved', () => {
    expect(() => planStart(initStory(), { author: 'Keystone' })).toThrow(/spec not approved/i);
  });
});

describe('planSpecGap', () => {
  test('reopens spec to in_progress and resets plan to pending', () => {
    let s = planStart(approvedSpec(), { author: 'Keystone' });
    s = planSpecGap(s, { reason: 'AC misses error case' });
    expect(s.specPhase.state).toBe('in_progress');
    expect(s.planPhase.state).toBe('pending');
    expect(s.specPhase.specApprovedAt).toBeNull();
  });

  test('throws if plan not in_progress', () => {
    expect(() => planSpecGap(approvedSpec(), { reason: 'x' })).toThrow(/cannot plan-spec-gap/i);
  });
});

describe('planReviewResult', () => {
  test('APPROVED transitions in_progress → review with verdict recorded', () => {
    let s = planStart(approvedSpec(), { author: 'Keystone' });
    s = planReviewResult(s, { verdict: 'APPROVED' });
    expect(s.planPhase.state).toBe('review');
    expect(s.planPhase.lastReviewVerdict).toBe('APPROVED');
  });

  test('REQUEST_CHANGES increments iterations', () => {
    let s = planStart(approvedSpec(), { author: 'Keystone' });
    s = planReviewResult(s, { verdict: 'REQUEST_CHANGES' });
    expect(s.planPhase.reviewIterations).toBe(1);
  });

  test('REQUEST_CHANGES at cap auto-escalates', () => {
    let s = planStart(approvedSpec(), { author: 'Keystone' });
    s.planPhase.reviewIterationCap = 2;
    s = planReviewResult(s, { verdict: 'REQUEST_CHANGES' });
    s = planReviewResult(s, { verdict: 'REQUEST_CHANGES' });
    expect(s.planPhase.state).toBe('escalated');
  });
});

describe('planAwaitApproval + planApprove + planReject', () => {
  test('planAwaitApproval requires APPROVED verdict', () => {
    let s = planStart(approvedSpec(), { author: 'Keystone' });
    s = planReviewResult(s, { verdict: 'REQUEST_CHANGES' });
    expect(() => planAwaitApproval(s)).toThrow(/has not approved/i);
  });

  test('planAwaitApproval transitions review → awaiting_plan_approval', () => {
    let s = planStart(approvedSpec(), { author: 'Keystone' });
    s = planReviewResult(s, { verdict: 'APPROVED' });
    s = planAwaitApproval(s);
    expect(s.planPhase.state).toBe('awaiting_plan_approval');
  });

  test('planApprove transitions to approved, records timestamp, closes phase history', () => {
    let s = planAwaitApproval(
      planReviewResult(planStart(approvedSpec(), { author: 'Keystone' }), { verdict: 'APPROVED' }),
    );
    s = planApprove(s);
    expect(s.planPhase.state).toBe('approved');
    expect(s.planPhase.planApprovedAt).toMatch(/\d{4}-\d{2}-\d{2}T/);
    expect(deriveOverall(s.specPhase.state, s.planPhase.state)).toBe('ready_for_dispatch');
  });

  test('planReject returns awaiting_plan_approval → in_progress', () => {
    let s = planAwaitApproval(
      planReviewResult(planStart(approvedSpec(), { author: 'Keystone' }), { verdict: 'APPROVED' }),
    );
    s = planReject(s, { reason: 'tasks too large' });
    expect(s.planPhase.state).toBe('in_progress');
    expect(s.planPhase.planApprovedAt).toBeNull();
  });
});
```

- [ ] **Step 2: Run tests to confirm failure**

```bash
npx jest tests/unit/agent-spec-plan-state.test.js --no-coverage 2>&1 | tail -8
```

- [ ] **Step 3: Add plan-phase transitions to `tools/lib/agent-spec-plan-state.js`**

Append before `module.exports`:

```js
/** plan-start: requires spec approved; planPhase pending → in_progress */
function planStart(orchestration, opts = {}) {
  if (orchestration.specPhase.state !== 'approved') {
    throw new Error(`Cannot plan-start: spec not approved (specPhase='${orchestration.specPhase.state}')`);
  }
  if (orchestration.planPhase.state !== 'pending') {
    throw new Error(`Cannot plan-start: planPhase is '${orchestration.planPhase.state}', expected 'pending'`);
  }
  const o = _enterPhase(orchestration, 'plan');
  return {
    ...o,
    planPhase: {
      ...o.planPhase,
      state: 'in_progress',
      author: opts.author || null,
      planPath: opts.planPath || null,
    },
  };
}

/** plan-spec-gap: plan in_progress → spec reopens, plan resets */
function planSpecGap(orchestration, opts) {
  if (orchestration.planPhase.state !== 'in_progress') {
    throw new Error(`Cannot plan-spec-gap: planPhase is '${orchestration.planPhase.state}', expected 'in_progress'`);
  }
  return {
    ...orchestration,
    specPhase: {
      ...orchestration.specPhase,
      state: 'in_progress',
      specApprovedAt: null,
      _lastSpecGapReason: opts.reason || 'no reason given',
    },
    planPhase: {
      ...orchestration.planPhase,
      state: 'pending',
      planPath: null,
    },
  };
}

/** plan-review-result --verdict APPROVED|REQUEST_CHANGES */
function planReviewResult(orchestration, opts) {
  if (opts.verdict !== 'APPROVED' && opts.verdict !== 'REQUEST_CHANGES') {
    throw new Error(`Unknown verdict '${opts.verdict}'; expected APPROVED or REQUEST_CHANGES`);
  }
  let next = {
    ...orchestration,
    planPhase: {
      ...orchestration.planPhase,
      state: 'review',
      lastReviewVerdict: opts.verdict,
    },
  };
  if (opts.verdict === 'REQUEST_CHANGES') {
    const newIter = next.planPhase.reviewIterations + 1;
    next = {
      ...next,
      planPhase: { ...next.planPhase, reviewIterations: newIter },
    };
    if (newIter >= next.planPhase.reviewIterationCap) {
      next = { ...next, planPhase: { ...next.planPhase, state: 'escalated' } };
    }
  }
  return next;
}

/** plan-await-approval: review → awaiting_plan_approval (only after APPROVED) */
function planAwaitApproval(orchestration) {
  if (orchestration.planPhase.state !== 'review') {
    throw new Error(`Cannot plan-await-approval: planPhase is '${orchestration.planPhase.state}', expected 'review'`);
  }
  if (orchestration.planPhase.lastReviewVerdict !== 'APPROVED') {
    throw new Error('Cannot plan-await-approval: Lens has not approved the plan');
  }
  return {
    ...orchestration,
    planPhase: { ...orchestration.planPhase, state: 'awaiting_plan_approval' },
  };
}

/** approve --gate plan */
function planApprove(orchestration) {
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

/** reject --gate plan */
function planReject(orchestration, opts) {
  if (orchestration.planPhase.state !== 'awaiting_plan_approval') {
    throw new Error(
      `Cannot reject plan: planPhase is '${orchestration.planPhase.state}', expected 'awaiting_plan_approval'`,
    );
  }
  return {
    ...orchestration,
    planPhase: {
      ...orchestration.planPhase,
      state: 'in_progress',
      planApprovedAt: null,
      _lastRejectReason: opts.reason || 'no reason given',
    },
  };
}
```

Update `module.exports` to include the new functions (add to the existing list):

```js
  planStart,
  planSpecGap,
  planReviewResult,
  planAwaitApproval,
  planApprove,
  planReject,
```

- [ ] **Step 4: Run tests to confirm pass**

```bash
npx jest tests/unit/agent-spec-plan-state.test.js --no-coverage 2>&1 | tail -5
```

Expected: All plan-phase tests pass.

- [ ] **Step 5: Commit**

```bash
git add tools/lib/agent-spec-plan-state.js tests/unit/agent-spec-plan-state.test.js
git commit -m "feat(US-0181): plan-phase state transitions (start/spec-gap/review/await/approve/reject)"
```

---

### Task 5: Lens findings parser

**Files:**

- Create: `tools/lib/lens-findings-parser.js`
- Create: `tests/unit/lens-findings-parser.test.js`

Parses Lens's markdown findings into structured records.

- [ ] **Step 1: Write failing tests**

Create `tests/unit/lens-findings-parser.test.js`:

```js
'use strict';
const { parseLensFindings, CANONICAL_PERSONAS } = require('../../tools/lib/lens-findings-parser');

describe('parseLensFindings', () => {
  test('parses single-tag finding: primary set, cc empty', () => {
    const md = `## Findings
- @compass: AC-007 missing edge case for empty list`;
    const f = parseLensFindings(md);
    expect(f).toHaveLength(1);
    expect(f[0].primary).toBe('compass');
    expect(f[0].cc).toEqual([]);
    expect(f[0].text).toContain('AC-007 missing edge case');
  });

  test('parses multi-tag finding: first tag = primary, rest = cc', () => {
    const md = `## Findings
- @compass @keystone: behavior X is underspecified`;
    const f = parseLensFindings(md);
    expect(f[0].primary).toBe('compass');
    expect(f[0].cc).toEqual(['keystone']);
  });

  test('parses multiple findings into array', () => {
    const md = `## Findings
- @compass: missing AC
- @palette: contrast ratio too low
- @pixel: form error state missing`;
    const f = parseLensFindings(md);
    expect(f).toHaveLength(3);
    expect(f.map((x) => x.primary)).toEqual(['compass', 'palette', 'pixel']);
  });

  test('lowercases tags', () => {
    const md = `## Findings
- @Compass: x
- @PALETTE: y`;
    const f = parseLensFindings(md);
    expect(f[0].primary).toBe('compass');
    expect(f[1].primary).toBe('palette');
  });

  test('skips bullets without @persona tags', () => {
    const md = `## Findings
- this is a free-form comment
- @compass: actual finding
- another comment`;
    const f = parseLensFindings(md);
    expect(f).toHaveLength(1);
    expect(f[0].primary).toBe('compass');
  });

  test('returns empty array when no findings section', () => {
    expect(parseLensFindings('## Other Section\n- @compass: x')).toEqual([]);
  });

  test('returns empty array on empty input', () => {
    expect(parseLensFindings('')).toEqual([]);
  });

  test('handles findings section at end of file without trailing newline', () => {
    const md = `## Findings\n- @compass: x`;
    expect(parseLensFindings(md)).toHaveLength(1);
  });

  test('stops parsing at next ## section', () => {
    const md = `## Findings
- @compass: x
## Other
- @palette: should not be parsed`;
    expect(parseLensFindings(md)).toHaveLength(1);
  });

  test('exports canonical persona list', () => {
    expect(CANONICAL_PERSONAS).toContain('compass');
    expect(CANONICAL_PERSONAS).toContain('palette');
    expect(CANONICAL_PERSONAS).toContain('pixel');
    expect(CANONICAL_PERSONAS).toContain('keystone');
    expect(CANONICAL_PERSONAS).toContain('lens');
    expect(CANONICAL_PERSONAS).toContain('forge');
    expect(CANONICAL_PERSONAS).toContain('sentinel');
    expect(CANONICAL_PERSONAS).toContain('circuit');
    expect(CANONICAL_PERSONAS).toContain('plan-author');
  });

  test('flags unknown personas with warning property on finding', () => {
    const md = `## Findings
- @unknown-bot: this won't route anywhere known`;
    const f = parseLensFindings(md);
    expect(f[0].primary).toBe('unknown-bot');
    expect(f[0].warning).toMatch(/unknown persona/i);
  });
});
```

- [ ] **Step 2: Run tests to confirm failure**

```bash
npx jest tests/unit/lens-findings-parser.test.js --no-coverage 2>&1 | tail -5
```

Expected: module not found.

- [ ] **Step 3: Create `tools/lib/lens-findings-parser.js`**

```js
'use strict';

const CANONICAL_PERSONAS = [
  'compass',
  'palette',
  'pixel',
  'keystone',
  'lens',
  'forge',
  'sentinel',
  'circuit',
  'plan-author',
];

/**
 * Parse Lens findings from a markdown document.
 * Expected format: a `## Findings` section with bullets like:
 *   - @compass: AC-007 missing edge case
 *   - @palette @keystone: contrast plus spec gap
 * Returns array of { primary, cc[], text, warning? }.
 */
function parseLensFindings(markdown) {
  if (!markdown) return [];

  // Find the `## Findings` section. Stop at next `## ` heading or end of file.
  const findingsMatch = markdown.match(/^##\s+Findings\s*$([\s\S]*?)(?=^##\s+|\Z)/m);
  if (!findingsMatch) return [];

  const body = findingsMatch[1];
  const lines = body.split('\n');
  const findings = [];

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed.startsWith('-')) continue;

    // Strip bullet prefix
    const content = trimmed.replace(/^-\s*/, '');

    // Match leading @tags (possibly multiple separated by spaces)
    const tagMatch = content.match(/^((?:@[a-zA-Z][a-zA-Z0-9-]*\s*)+):\s*(.*)$/);
    if (!tagMatch) continue;

    const tagsString = tagMatch[1];
    const text = tagMatch[2].trim();
    const tags = (tagsString.match(/@([a-zA-Z][a-zA-Z0-9-]*)/g) || []).map((t) => t.slice(1).toLowerCase());

    if (tags.length === 0) continue;

    const finding = {
      primary: tags[0],
      cc: tags.slice(1),
      text,
    };

    if (!CANONICAL_PERSONAS.includes(finding.primary)) {
      finding.warning = `unknown persona '${finding.primary}'; not in canonical list`;
    }

    findings.push(finding);
  }

  return findings;
}

module.exports = {
  parseLensFindings,
  CANONICAL_PERSONAS,
};
```

- [ ] **Step 4: Run tests to confirm pass**

```bash
npx jest tests/unit/lens-findings-parser.test.js --no-coverage 2>&1 | tail -5
```

Expected: all 12 tests pass.

- [ ] **Step 5: Commit**

```bash
git add tools/lib/lens-findings-parser.js tests/unit/lens-findings-parser.test.js
git commit -m "feat(US-0181): lens findings parser with canonical persona list and CC routing"
```

---

### Task 6: Flag file scanner

**Files:**

- Create: `tools/lib/agent-spec-plan-flags.js`
- Create: `tests/unit/agent-spec-plan-flags.test.js`

Scans `docs/pending-approvals/` for flag files and applies them via the state machine.

- [ ] **Step 1: Write failing tests**

Create `tests/unit/agent-spec-plan-flags.test.js`:

```js
'use strict';
const fs = require('fs');
const path = require('path');
const os = require('os');
const { parseFlagFilename, readFlag, scanPendingDir } = require('../../tools/lib/agent-spec-plan-flags');

describe('parseFlagFilename', () => {
  test('parses approve filename', () => {
    expect(parseFlagFilename('approve-US-0181-spec.flag')).toEqual({
      action: 'approve',
      story: 'US-0181',
      gate: 'spec',
    });
  });

  test('parses reject filename', () => {
    expect(parseFlagFilename('reject-US-0181-plan.flag')).toEqual({
      action: 'reject',
      story: 'US-0181',
      gate: 'plan',
    });
  });

  test('parses ac gate', () => {
    expect(parseFlagFilename('approve-US-0181-ac.flag')).toEqual({
      action: 'approve',
      story: 'US-0181',
      gate: 'ac',
    });
  });

  test('returns null for invalid filename', () => {
    expect(parseFlagFilename('whatever.txt')).toBeNull();
    expect(parseFlagFilename('approve-bad.flag')).toBeNull();
    expect(parseFlagFilename('approve-US-0181.flag')).toBeNull();
  });
});

describe('readFlag', () => {
  let tmpdir;
  beforeEach(() => {
    tmpdir = fs.mkdtempSync(path.join(os.tmpdir(), 'agt-flags-'));
  });
  afterEach(() => fs.rmSync(tmpdir, { recursive: true, force: true }));

  test('reads valid JSON flag', () => {
    const fp = path.join(tmpdir, 'approve-US-0181-spec.flag');
    fs.writeFileSync(
      fp,
      JSON.stringify({
        story: 'US-0181',
        gate: 'spec',
        action: 'approve',
        timestamp: '2026-05-11T12:00:00Z',
      }),
    );
    const r = readFlag(fp);
    expect(r.ok).toBe(true);
    expect(r.payload.story).toBe('US-0181');
  });

  test('rejects malformed JSON with logged reason', () => {
    const fp = path.join(tmpdir, 'approve-US-0181-spec.flag');
    fs.writeFileSync(fp, 'not json');
    const r = readFlag(fp);
    expect(r.ok).toBe(false);
    expect(r.reason).toMatch(/parse/i);
  });

  test('rejects flag with missing required fields', () => {
    const fp = path.join(tmpdir, 'approve-US-0181-spec.flag');
    fs.writeFileSync(fp, JSON.stringify({ story: 'US-0181' }));
    const r = readFlag(fp);
    expect(r.ok).toBe(false);
    expect(r.reason).toMatch(/missing field/i);
  });

  test('reads reject flag with reason', () => {
    const fp = path.join(tmpdir, 'reject-US-0181-spec.flag');
    fs.writeFileSync(
      fp,
      JSON.stringify({
        story: 'US-0181',
        gate: 'spec',
        action: 'reject',
        reason: 'scope creep',
        timestamp: '2026-05-11T12:00:00Z',
      }),
    );
    const r = readFlag(fp);
    expect(r.ok).toBe(true);
    expect(r.payload.reason).toBe('scope creep');
  });

  test('handles CRLF line endings in JSON', () => {
    const fp = path.join(tmpdir, 'approve-US-0181-spec.flag');
    fs.writeFileSync(
      fp,
      '{\r\n"story":"US-0181","gate":"spec","action":"approve","timestamp":"2026-05-11T12:00:00Z"\r\n}',
    );
    const r = readFlag(fp);
    expect(r.ok).toBe(true);
  });
});

describe('scanPendingDir', () => {
  let tmpdir;
  beforeEach(() => {
    tmpdir = fs.mkdtempSync(path.join(os.tmpdir(), 'agt-flags-'));
  });
  afterEach(() => fs.rmSync(tmpdir, { recursive: true, force: true }));

  function writeFlag(name, payload) {
    fs.writeFileSync(path.join(tmpdir, name), JSON.stringify(payload));
  }

  test('returns flags sorted by timestamp ascending', () => {
    writeFlag('approve-US-A-spec.flag', {
      story: 'US-A',
      gate: 'spec',
      action: 'approve',
      timestamp: '2026-05-11T12:00:00Z',
    });
    writeFlag('approve-US-B-spec.flag', {
      story: 'US-B',
      gate: 'spec',
      action: 'approve',
      timestamp: '2026-05-11T10:00:00Z',
    });
    const flags = scanPendingDir(tmpdir);
    expect(flags[0].payload.story).toBe('US-B');
    expect(flags[1].payload.story).toBe('US-A');
  });

  test('returns empty array when dir empty', () => {
    expect(scanPendingDir(tmpdir)).toEqual([]);
  });

  test('returns empty array when dir does not exist', () => {
    expect(scanPendingDir(path.join(tmpdir, 'nonexistent'))).toEqual([]);
  });

  test('ignores non-.flag files', () => {
    writeFlag('approve-US-0181-spec.flag', {
      story: 'US-0181',
      gate: 'spec',
      action: 'approve',
      timestamp: '2026-05-11T12:00:00Z',
    });
    fs.writeFileSync(path.join(tmpdir, '.gitkeep'), '');
    fs.writeFileSync(path.join(tmpdir, 'readme.md'), '');
    const flags = scanPendingDir(tmpdir);
    expect(flags).toHaveLength(1);
  });

  test('attaches malformed flags with ok:false and reason', () => {
    fs.writeFileSync(path.join(tmpdir, 'approve-US-0181-spec.flag'), 'not json');
    const flags = scanPendingDir(tmpdir);
    expect(flags[0].ok).toBe(false);
    expect(flags[0].reason).toBeTruthy();
  });
});
```

- [ ] **Step 2: Run tests to confirm failure**

```bash
npx jest tests/unit/agent-spec-plan-flags.test.js --no-coverage 2>&1 | tail -5
```

- [ ] **Step 3: Create `tools/lib/agent-spec-plan-flags.js`**

```js
'use strict';
const fs = require('fs');
const path = require('path');

const FLAG_REGEX = /^(approve|reject)-(US-\d+)-(ac|spec|plan)\.flag$/;

/**
 * Parse a flag filename into its components.
 * Returns { action, story, gate } or null if invalid.
 */
function parseFlagFilename(name) {
  const m = name.match(FLAG_REGEX);
  if (!m) return null;
  return { action: m[1], story: m[2], gate: m[3] };
}

/**
 * Read and validate a flag file.
 * Returns { ok: true, payload } or { ok: false, reason }.
 */
function readFlag(filePath) {
  let text;
  try {
    text = fs.readFileSync(filePath, 'utf8');
  } catch (e) {
    return { ok: false, reason: `read failed: ${e.message}` };
  }
  let payload;
  try {
    payload = JSON.parse(text);
  } catch (e) {
    return { ok: false, reason: `JSON parse failed: ${e.message}` };
  }
  const required = ['story', 'gate', 'action', 'timestamp'];
  for (const f of required) {
    if (!payload[f]) return { ok: false, reason: `missing field '${f}'` };
  }
  if (payload.action === 'reject' && !payload.reason) {
    return { ok: false, reason: `missing field 'reason' for reject action` };
  }
  return { ok: true, payload };
}

/**
 * Scan a directory for .flag files. Returns sorted-by-timestamp array.
 * Each entry: { filePath, name, parsed, ok, payload | reason }.
 * Malformed flags have ok:false and reason.
 */
function scanPendingDir(dir) {
  if (!fs.existsSync(dir)) return [];
  const entries = fs
    .readdirSync(dir)
    .filter((n) => n.endsWith('.flag'))
    .map((name) => {
      const filePath = path.join(dir, name);
      const parsed = parseFlagFilename(name);
      if (!parsed) {
        return { filePath, name, parsed: null, ok: false, reason: `invalid filename '${name}'` };
      }
      const r = readFlag(filePath);
      if (!r.ok) return { filePath, name, parsed, ok: false, reason: r.reason };
      return { filePath, name, parsed, ok: true, payload: r.payload };
    });
  // Sort by timestamp (malformed entries get sorted last using string fallback)
  entries.sort((a, b) => {
    const aTs = a.ok ? a.payload.timestamp : 'z';
    const bTs = b.ok ? b.payload.timestamp : 'z';
    return aTs.localeCompare(bTs);
  });
  return entries;
}

module.exports = {
  parseFlagFilename,
  readFlag,
  scanPendingDir,
};
```

- [ ] **Step 4: Run tests to confirm pass**

```bash
npx jest tests/unit/agent-spec-plan-flags.test.js --no-coverage 2>&1 | tail -5
```

Expected: all flag scanner tests pass.

- [ ] **Step 5: Commit**

```bash
git add tools/lib/agent-spec-plan-flags.js tests/unit/agent-spec-plan-flags.test.js
git commit -m "feat(US-0181): flag file scanner — parse filename, validate JSON, sort by timestamp"
```

---

### Task 7: CLI dispatcher — argument parsing and skeleton

**Files:**

- Create: `tools/agent-spec-plan.js`
- Create: `tests/unit/agent-spec-plan-cli.test.js`

Build the CLI entry point with arg parsing and command dispatch. Each command wraps a state machine transition.

- [ ] **Step 1: Write failing tests for arg parsing**

Create `tests/unit/agent-spec-plan-cli.test.js`:

```js
'use strict';
const { parseArgs } = require('../../tools/agent-spec-plan');

describe('parseArgs', () => {
  test('subcommand only', () => {
    expect(parseArgs(['node', 'agent-spec-plan.js', 'spec-start'])).toEqual(
      expect.objectContaining({ cmd: 'spec-start' }),
    );
  });

  test('--story flag', () => {
    expect(parseArgs(['node', 'x', 'spec-start', '--story', 'US-0181']).story).toBe('US-0181');
  });

  test('--gate flag', () => {
    expect(parseArgs(['node', 'x', 'approve', '--gate', 'spec']).gate).toBe('spec');
  });

  test('--verdict flag', () => {
    expect(parseArgs(['node', 'x', 'spec-review-result', '--verdict', 'APPROVED']).verdict).toBe('APPROVED');
  });

  test('--reason captures string with spaces', () => {
    expect(parseArgs(['node', 'x', 'reject', '--reason', 'scope creep here']).reason).toBe('scope creep here');
  });

  test('--field and --value pair', () => {
    const r = parseArgs(['node', 'x', 'spec-update', '--field', 'uiSurface', '--value', 'true']);
    expect(r.field).toBe('uiSurface');
    expect(r.value).toBe('true');
  });

  test('--findings-file flag', () => {
    expect(parseArgs(['node', 'x', 'spec-review-result', '--findings-file', '/tmp/f.md']).findingsFile).toBe(
      '/tmp/f.md',
    );
  });

  test('--author flag', () => {
    expect(parseArgs(['node', 'x', 'plan-start', '--author', 'Keystone']).author).toBe('Keystone');
  });

  test('--dir flag for apply-pending', () => {
    expect(parseArgs(['node', 'x', 'apply-pending', '--dir', '/tmp/p']).dir).toBe('/tmp/p');
  });

  test('--state filter for list', () => {
    expect(parseArgs(['node', 'x', 'list', '--state', 'ready_for_dispatch']).state).toBe('ready_for_dispatch');
  });

  test('--phase for escalate', () => {
    expect(parseArgs(['node', 'x', 'escalate', '--story', 'US-0181', '--phase', 'spec']).phase).toBe('spec');
  });

  test('returns all expected fields with defaults', () => {
    const r = parseArgs(['node', 'x', 'spec-start']);
    expect(r).toHaveProperty('cmd');
    expect(r).toHaveProperty('story');
    expect(r).toHaveProperty('gate');
    expect(r).toHaveProperty('verdict');
    expect(r).toHaveProperty('reason');
    expect(r).toHaveProperty('field');
    expect(r).toHaveProperty('value');
    expect(r).toHaveProperty('findingsFile');
    expect(r).toHaveProperty('author');
    expect(r).toHaveProperty('dir');
    expect(r).toHaveProperty('state');
    expect(r).toHaveProperty('phase');
  });
});
```

- [ ] **Step 2: Run tests to confirm failure**

```bash
npx jest tests/unit/agent-spec-plan-cli.test.js --no-coverage 2>&1 | tail -5
```

- [ ] **Step 3: Create `tools/agent-spec-plan.js` skeleton with parseArgs**

```js
#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const SDLC_PATH = path.join(ROOT, 'docs/sdlc-status.json');

function parseArgs(argv) {
  const args = argv.slice(2);
  const cmd = args[0] || null;
  const out = {
    cmd,
    story: null,
    gate: null,
    verdict: null,
    reason: null,
    field: null,
    value: null,
    findingsFile: null,
    author: null,
    dir: null,
    state: null,
    phase: null,
    uiSurface: null,
  };
  for (let i = 1; i < args.length; i++) {
    const a = args[i];
    const next = args[i + 1];
    if (a === '--story' && next) {
      out.story = next;
      i++;
    } else if (a === '--gate' && next) {
      out.gate = next;
      i++;
    } else if (a === '--verdict' && next) {
      out.verdict = next;
      i++;
    } else if (a === '--reason' && next !== undefined) {
      out.reason = next;
      i++;
    } else if (a === '--field' && next) {
      out.field = next;
      i++;
    } else if (a === '--value' && next !== undefined) {
      out.value = next;
      i++;
    } else if (a === '--findings-file' && next) {
      out.findingsFile = next;
      i++;
    } else if (a === '--author' && next) {
      out.author = next;
      i++;
    } else if (a === '--dir' && next) {
      out.dir = next;
      i++;
    } else if (a === '--state' && next) {
      out.state = next;
      i++;
    } else if (a === '--phase' && next) {
      out.phase = next;
      i++;
    } else if (a === '--ui-surface' && next !== undefined) {
      out.uiSurface = next;
      i++;
    }
  }
  return out;
}

function main() {
  const opts = parseArgs(process.argv);
  if (!opts.cmd) {
    console.error('Usage: node tools/agent-spec-plan.js <command> [--story US-XXXX] [--gate ac|spec|plan] ...');
    console.error('Commands: spec-start, spec-update, spec-review-result, spec-await-ac, spec-await-final,');
    console.error('          plan-start, plan-spec-gap, plan-review-result, plan-await-approval,');
    console.error('          approve, reject, apply-pending, list, status, show-pending, escalate');
    return 1;
  }
  // Dispatch happens in next task
  console.error(`[agent-spec-plan] dispatch not yet implemented for '${opts.cmd}'`);
  return 1;
}

module.exports = { parseArgs, main };

if (require.main === module) {
  process.exit(main());
}
```

- [ ] **Step 4: Run tests to confirm pass**

```bash
npx jest tests/unit/agent-spec-plan-cli.test.js --no-coverage 2>&1 | tail -5
```

Expected: all 12 parseArgs tests pass.

- [ ] **Step 5: Commit**

```bash
git add tools/agent-spec-plan.js tests/unit/agent-spec-plan-cli.test.js
git commit -m "feat(US-0181): CLI skeleton with parseArgs covering all command flags"
```

---

### Task 8: CLI dispatch — spec phase commands wired to state machine

**Files:**

- Modify: `tools/agent-spec-plan.js`
- Modify: `tests/unit/agent-spec-plan-cli.test.js`

Wire the spec-phase CLI commands to the state machine. Persist to `sdlc-status.json`.

- [ ] **Step 1: Add dispatch tests to `tests/unit/agent-spec-plan-cli.test.js`**

```js
const fs = require('fs');
const path = require('path');
const os = require('os');
const { dispatch } = require('../../tools/agent-spec-plan');

describe('dispatch — spec phase', () => {
  let tmpdir;
  let sdlcPath;
  beforeEach(() => {
    tmpdir = fs.mkdtempSync(path.join(os.tmpdir(), 'agt-cli-'));
    sdlcPath = path.join(tmpdir, 'sdlc-status.json');
    fs.writeFileSync(sdlcPath, JSON.stringify({ stories: { 'US-0181': { status: 'Planned' } } }));
  });
  afterEach(() => fs.rmSync(tmpdir, { recursive: true, force: true }));

  test('spec-start creates specPhase + planPhase, writes to sdlc-status', () => {
    const exitCode = dispatch({ cmd: 'spec-start', story: 'US-0181', uiSurface: 'false' }, { sdlcPath });
    expect(exitCode).toBe(0);
    const data = JSON.parse(fs.readFileSync(sdlcPath, 'utf8'));
    expect(data.stories['US-0181'].specPhase.state).toBe('in_progress');
  });

  test('spec-start exits 1 if story missing', () => {
    const exitCode = dispatch({ cmd: 'spec-start', story: 'US-9999' }, { sdlcPath });
    expect(exitCode).toBe(1);
  });

  test('spec-await-ac exits 2 (await signal)', () => {
    dispatch({ cmd: 'spec-start', story: 'US-0181' }, { sdlcPath });
    const exitCode = dispatch({ cmd: 'spec-await-ac', story: 'US-0181' }, { sdlcPath });
    expect(exitCode).toBe(2);
  });

  test('approve --gate ac transitions awaiting_ac_approval → in_progress', () => {
    dispatch({ cmd: 'spec-start', story: 'US-0181' }, { sdlcPath });
    dispatch({ cmd: 'spec-await-ac', story: 'US-0181' }, { sdlcPath });
    const exitCode = dispatch({ cmd: 'approve', story: 'US-0181', gate: 'ac' }, { sdlcPath });
    expect(exitCode).toBe(0);
    const data = JSON.parse(fs.readFileSync(sdlcPath, 'utf8'));
    expect(data.stories['US-0181'].specPhase.acApprovedAt).toBeTruthy();
  });

  test('spec-update sets uiSurface field', () => {
    dispatch({ cmd: 'spec-start', story: 'US-0181' }, { sdlcPath });
    dispatch({ cmd: 'spec-update', story: 'US-0181', field: 'uiSurface', value: 'true' }, { sdlcPath });
    const data = JSON.parse(fs.readFileSync(sdlcPath, 'utf8'));
    expect(data.stories['US-0181'].specPhase.uiSurface).toBe(true);
  });

  test('iteration cap auto-escalates and returns exit 1', () => {
    dispatch({ cmd: 'spec-start', story: 'US-0181' }, { sdlcPath });
    dispatch({ cmd: 'spec-await-ac', story: 'US-0181' }, { sdlcPath });
    dispatch({ cmd: 'approve', story: 'US-0181', gate: 'ac' }, { sdlcPath });
    // First two REQUEST_CHANGES return exit 0
    expect(dispatch({ cmd: 'spec-review-result', story: 'US-0181', verdict: 'REQUEST_CHANGES' }, { sdlcPath })).toBe(0);
    expect(dispatch({ cmd: 'spec-review-result', story: 'US-0181', verdict: 'REQUEST_CHANGES' }, { sdlcPath })).toBe(0);
    // Third hits cap (default 3) → auto-escalates, exit 1
    expect(dispatch({ cmd: 'spec-review-result', story: 'US-0181', verdict: 'REQUEST_CHANGES' }, { sdlcPath })).toBe(1);
    const data = JSON.parse(fs.readFileSync(sdlcPath, 'utf8'));
    expect(data.stories['US-0181'].specPhase.state).toBe('escalated');
  });
});
```

- [ ] **Step 2: Run tests to confirm failure**

```bash
npx jest tests/unit/agent-spec-plan-cli.test.js --no-coverage 2>&1 | tail -5
```

- [ ] **Step 3: Implement dispatch in `tools/agent-spec-plan.js`**

Replace the placeholder `main()` and add `dispatch`:

```js
const State = require('./lib/agent-spec-plan-state');

function readSdlc(sdlcPath) {
  return JSON.parse(fs.readFileSync(sdlcPath, 'utf8'));
}

function writeSdlc(sdlcPath, data) {
  fs.writeFileSync(sdlcPath, JSON.stringify(data, null, 2) + '\n');
}

function ensureStory(data, storyId) {
  if (!data.stories) data.stories = {};
  const story = data.stories[storyId];
  if (!story) {
    throw new Error(`Story '${storyId}' not found in sdlc-status.json`);
  }
  return story;
}

function ensureOrchestration(story) {
  if (!story.specPhase || !story.planPhase) {
    const init = State.initStory();
    story.specPhase = init.specPhase;
    story.planPhase = init.planPhase;
    story.phaseHistory = init.phaseHistory;
  }
  return story;
}

function getOrchestration(story) {
  return {
    specPhase: story.specPhase,
    planPhase: story.planPhase,
    phaseHistory: story.phaseHistory || [],
  };
}

function applyOrchestration(story, newO) {
  story.specPhase = newO.specPhase;
  story.planPhase = newO.planPhase;
  story.phaseHistory = newO.phaseHistory;
}

function dispatch(opts, ctx = {}) {
  const sdlcPath = ctx.sdlcPath || SDLC_PATH;
  let data;
  try {
    data = readSdlc(sdlcPath);
  } catch (e) {
    console.error(`[agent-spec-plan] Cannot read ${sdlcPath}: ${e.message}`);
    return 1;
  }

  const cmd = opts.cmd;

  // Commands that need a story
  const storyCmds = new Set([
    'spec-start',
    'spec-update',
    'spec-await-ac',
    'spec-await-final',
    'spec-review-result',
    'plan-start',
    'plan-spec-gap',
    'plan-review-result',
    'plan-await-approval',
    'approve',
    'reject',
    'escalate',
    'status',
  ]);
  if (storyCmds.has(cmd) && !opts.story) {
    console.error(`[agent-spec-plan] Command '${cmd}' requires --story US-XXXX`);
    return 1;
  }

  try {
    let story, orch, newOrch;
    if (storyCmds.has(cmd)) {
      story = ensureStory(data, opts.story);
      ensureOrchestration(story);
      orch = getOrchestration(story);
    }

    switch (cmd) {
      case 'spec-start':
        newOrch = State.specStart(orch, { uiSurface: opts.uiSurface === 'true' });
        applyOrchestration(story, newOrch);
        writeSdlc(sdlcPath, data);
        return 0;

      case 'spec-update':
        if (!opts.field) {
          console.error('--field required');
          return 1;
        }
        newOrch = State.specUpdate(orch, { field: opts.field, value: opts.value });
        applyOrchestration(story, newOrch);
        writeSdlc(sdlcPath, data);
        return 0;

      case 'spec-await-ac':
        newOrch = State.specAwaitAc(orch);
        applyOrchestration(story, newOrch);
        writeSdlc(sdlcPath, data);
        return 2; // await signal

      case 'spec-review-result':
        newOrch = State.specReviewResult(orch, { verdict: opts.verdict });
        applyOrchestration(story, newOrch);
        writeSdlc(sdlcPath, data);
        // If transitioned to escalated, exit 1
        if (story.specPhase.state === 'escalated') {
          console.error(
            `[agent-spec-plan] Iteration cap reached for spec phase. Story escalated. Manual resolution required.`,
          );
          return 1;
        }
        return 0;

      case 'spec-await-final':
        newOrch = State.specAwaitFinal(orch);
        applyOrchestration(story, newOrch);
        writeSdlc(sdlcPath, data);
        return 2;

      case 'approve':
        if (!opts.gate) {
          console.error('--gate required');
          return 1;
        }
        if (opts.gate === 'ac') newOrch = State.acApprove(orch);
        else if (opts.gate === 'spec') newOrch = State.specApprove(orch);
        else if (opts.gate === 'plan') newOrch = State.planApprove(orch);
        else {
          console.error(`Unknown gate '${opts.gate}'`);
          return 1;
        }
        applyOrchestration(story, newOrch);
        writeSdlc(sdlcPath, data);
        console.log(`[agent-spec-plan] Approved ${opts.gate} gate for ${opts.story}.`);
        return 0;

      case 'reject':
        if (!opts.gate) {
          console.error('--gate required');
          return 1;
        }
        if (!opts.reason) {
          console.error('--reason required for reject');
          return 1;
        }
        if (opts.gate === 'ac') newOrch = State.acReject(orch, { reason: opts.reason });
        else if (opts.gate === 'spec') newOrch = State.specReject(orch, { reason: opts.reason });
        else if (opts.gate === 'plan') newOrch = State.planReject(orch, { reason: opts.reason });
        else {
          console.error(`Unknown gate '${opts.gate}'`);
          return 1;
        }
        applyOrchestration(story, newOrch);
        writeSdlc(sdlcPath, data);
        console.log(`[agent-spec-plan] Rejected ${opts.gate} gate for ${opts.story}: ${opts.reason}`);
        return 0;

      case 'status':
        console.log(
          JSON.stringify(
            {
              story: opts.story,
              specPhase: story.specPhase,
              planPhase: story.planPhase,
              overall: State.deriveOverall(story.specPhase.state, story.planPhase.state),
            },
            null,
            2,
          ),
        );
        return 0;

      default:
        console.error(`[agent-spec-plan] Unknown command '${cmd}'`);
        return 1;
    }
  } catch (e) {
    console.error(`[agent-spec-plan] ${e.message}`);
    return 1;
  }
}

function main() {
  const opts = parseArgs(process.argv);
  if (!opts.cmd) {
    console.error('Usage: node tools/agent-spec-plan.js <command> [options]');
    return 1;
  }
  return dispatch(opts);
}

module.exports = { parseArgs, dispatch, main };

if (require.main === module) {
  process.exit(main());
}
```

- [ ] **Step 4: Run tests to confirm pass**

```bash
npx jest tests/unit/agent-spec-plan-cli.test.js --no-coverage 2>&1 | tail -8
```

Expected: all dispatch tests pass.

- [ ] **Step 5: Commit**

```bash
git add tools/agent-spec-plan.js tests/unit/agent-spec-plan-cli.test.js
git commit -m "feat(US-0181): CLI dispatch for spec-phase commands wired to state machine"
```

---

### Task 9: CLI dispatch — plan phase + remaining commands

**Files:**

- Modify: `tools/agent-spec-plan.js`
- Modify: `tests/unit/agent-spec-plan-cli.test.js`

Wire the remaining commands: `plan-start`, `plan-spec-gap`, `plan-review-result`, `plan-await-approval`, `escalate`, `list`, `show-pending`, `apply-pending`.

- [ ] **Step 1: Append failing tests**

```js
describe('dispatch — plan phase + helpers', () => {
  let tmpdir, sdlcPath, pendingDir;
  beforeEach(() => {
    tmpdir = fs.mkdtempSync(path.join(os.tmpdir(), 'agt-cli-'));
    sdlcPath = path.join(tmpdir, 'sdlc-status.json');
    pendingDir = path.join(tmpdir, 'pending');
    fs.mkdirSync(pendingDir, { recursive: true });
    fs.writeFileSync(sdlcPath, JSON.stringify({ stories: { 'US-0181': { status: 'Planned' } } }));
  });
  afterEach(() => fs.rmSync(tmpdir, { recursive: true, force: true }));

  function fullSpecApproval() {
    dispatch({ cmd: 'spec-start', story: 'US-0181' }, { sdlcPath });
    dispatch({ cmd: 'spec-await-ac', story: 'US-0181' }, { sdlcPath });
    dispatch({ cmd: 'approve', story: 'US-0181', gate: 'ac' }, { sdlcPath });
    dispatch({ cmd: 'spec-review-result', story: 'US-0181', verdict: 'APPROVED' }, { sdlcPath });
    dispatch({ cmd: 'spec-await-final', story: 'US-0181' }, { sdlcPath });
    dispatch({ cmd: 'approve', story: 'US-0181', gate: 'spec' }, { sdlcPath });
  }

  test('plan-start requires spec approved', () => {
    expect(dispatch({ cmd: 'plan-start', story: 'US-0181', author: 'Keystone' }, { sdlcPath })).toBe(1);
  });

  test('plan-start works after spec approved', () => {
    fullSpecApproval();
    expect(dispatch({ cmd: 'plan-start', story: 'US-0181', author: 'Keystone' }, { sdlcPath })).toBe(0);
    const data = JSON.parse(fs.readFileSync(sdlcPath, 'utf8'));
    expect(data.stories['US-0181'].planPhase.author).toBe('Keystone');
  });

  test('plan-spec-gap reopens spec phase', () => {
    fullSpecApproval();
    dispatch({ cmd: 'plan-start', story: 'US-0181', author: 'Keystone' }, { sdlcPath });
    expect(dispatch({ cmd: 'plan-spec-gap', story: 'US-0181', reason: 'AC missing X' }, { sdlcPath })).toBe(0);
    const data = JSON.parse(fs.readFileSync(sdlcPath, 'utf8'));
    expect(data.stories['US-0181'].specPhase.state).toBe('in_progress');
    expect(data.stories['US-0181'].planPhase.state).toBe('pending');
  });

  test('full happy path reaches ready_for_dispatch', () => {
    fullSpecApproval();
    dispatch({ cmd: 'plan-start', story: 'US-0181', author: 'Keystone' }, { sdlcPath });
    dispatch({ cmd: 'plan-review-result', story: 'US-0181', verdict: 'APPROVED' }, { sdlcPath });
    expect(dispatch({ cmd: 'plan-await-approval', story: 'US-0181' }, { sdlcPath })).toBe(2);
    expect(dispatch({ cmd: 'approve', story: 'US-0181', gate: 'plan' }, { sdlcPath })).toBe(0);
    const data = JSON.parse(fs.readFileSync(sdlcPath, 'utf8'));
    expect(data.stories['US-0181'].planPhase.state).toBe('approved');
  });

  test('escalate forces escalated state', () => {
    fullSpecApproval();
    dispatch({ cmd: 'plan-start', story: 'US-0181', author: 'Keystone' }, { sdlcPath });
    expect(dispatch({ cmd: 'escalate', story: 'US-0181', phase: 'plan' }, { sdlcPath })).toBe(0);
    const data = JSON.parse(fs.readFileSync(sdlcPath, 'utf8'));
    expect(data.stories['US-0181'].planPhase.state).toBe('escalated');
  });

  test('show-pending lists stories with open gates', () => {
    dispatch({ cmd: 'spec-start', story: 'US-0181' }, { sdlcPath });
    dispatch({ cmd: 'spec-await-ac', story: 'US-0181' }, { sdlcPath });
    const log = [];
    const exitCode = dispatch({ cmd: 'show-pending' }, { sdlcPath, log: (m) => log.push(m) });
    expect(exitCode).toBe(0);
    expect(log.join('\n')).toMatch(/US-0181/);
    expect(log.join('\n')).toMatch(/ac/);
  });

  test('list filters by --state', () => {
    fullSpecApproval();
    const log = [];
    dispatch({ cmd: 'list', state: 'plan' }, { sdlcPath, log: (m) => log.push(m) });
    expect(log.join('\n')).toContain('US-0181');
  });

  test('apply-pending applies valid flag and deletes it', () => {
    dispatch({ cmd: 'spec-start', story: 'US-0181' }, { sdlcPath });
    dispatch({ cmd: 'spec-await-ac', story: 'US-0181' }, { sdlcPath });
    const flagPath = path.join(pendingDir, 'approve-US-0181-ac.flag');
    fs.writeFileSync(
      flagPath,
      JSON.stringify({
        story: 'US-0181',
        gate: 'ac',
        action: 'approve',
        timestamp: '2026-05-11T12:00:00Z',
      }),
    );
    expect(dispatch({ cmd: 'apply-pending', dir: pendingDir }, { sdlcPath })).toBe(0);
    expect(fs.existsSync(flagPath)).toBe(false);
    const data = JSON.parse(fs.readFileSync(sdlcPath, 'utf8'));
    expect(data.stories['US-0181'].specPhase.acApprovedAt).toBeTruthy();
  });

  test('apply-pending leaves malformed flag in place', () => {
    const flagPath = path.join(pendingDir, 'approve-US-0181-ac.flag');
    fs.writeFileSync(flagPath, 'not json');
    dispatch({ cmd: 'apply-pending', dir: pendingDir }, { sdlcPath });
    expect(fs.existsSync(flagPath)).toBe(true);
  });
});
```

- [ ] **Step 2: Run tests to confirm failure**

```bash
npx jest tests/unit/agent-spec-plan-cli.test.js --no-coverage 2>&1 | tail -8
```

- [ ] **Step 3: Extend dispatch in `tools/agent-spec-plan.js`**

Add `require('./lib/agent-spec-plan-flags')` at the top of the file:

```js
const Flags = require('./lib/agent-spec-plan-flags');
```

Add these cases to the `switch (cmd)` block in `dispatch`:

```js
      case 'plan-start':
        newOrch = State.planStart(orch, { author: opts.author });
        applyOrchestration(story, newOrch);
        writeSdlc(sdlcPath, data);
        return 0;

      case 'plan-spec-gap':
        if (!opts.reason) { console.error('--reason required'); return 1; }
        newOrch = State.planSpecGap(orch, { reason: opts.reason });
        applyOrchestration(story, newOrch);
        writeSdlc(sdlcPath, data);
        console.warn(`[agent-spec-plan] Spec gap reported by plan author. Spec phase reopened for ${opts.story}: ${opts.reason}`);
        return 0;

      case 'plan-review-result':
        newOrch = State.planReviewResult(orch, { verdict: opts.verdict });
        applyOrchestration(story, newOrch);
        writeSdlc(sdlcPath, data);
        if (story.planPhase.state === 'escalated') {
          console.error(`[agent-spec-plan] Iteration cap reached for plan phase. Story escalated.`);
          return 1;
        }
        return 0;

      case 'plan-await-approval':
        newOrch = State.planAwaitApproval(orch);
        applyOrchestration(story, newOrch);
        writeSdlc(sdlcPath, data);
        return 2;

      case 'escalate':
        if (!opts.phase) { console.error('--phase required (spec|plan)'); return 1; }
        if (opts.phase === 'spec') story.specPhase.state = 'escalated';
        else if (opts.phase === 'plan') story.planPhase.state = 'escalated';
        else { console.error(`Unknown phase '${opts.phase}'`); return 1; }
        writeSdlc(sdlcPath, data);
        return 0;

      case 'show-pending': {
        const log = ctx.log || console.log;
        const stories = data.stories || {};
        const pending = [];
        for (const [id, st] of Object.entries(stories)) {
          if (!st.specPhase) continue;
          if (st.specPhase.state === 'awaiting_ac_approval') pending.push({ id, gate: 'ac' });
          if (st.specPhase.state === 'awaiting_spec_approval') pending.push({ id, gate: 'spec' });
          if (st.planPhase && st.planPhase.state === 'awaiting_plan_approval') pending.push({ id, gate: 'plan' });
        }
        if (pending.length === 0) log('[agent-spec-plan] No pending approvals.');
        else pending.forEach((p) => log(`  ${p.id} — awaiting ${p.gate} approval`));
        return 0;
      }

      case 'list': {
        const log = ctx.log || console.log;
        const stories = data.stories || {};
        let rows = [];
        for (const [id, st] of Object.entries(stories)) {
          if (!st.specPhase) continue;
          const overall = State.deriveOverall(st.specPhase.state, st.planPhase.state);
          if (!opts.state || overall === opts.state) {
            rows.push(`  ${id} — ${overall} (spec=${st.specPhase.state}, plan=${st.planPhase.state})`);
          }
        }
        if (rows.length === 0) log('[agent-spec-plan] No matching stories.');
        else rows.forEach((r) => log(r));
        return 0;
      }

      case 'apply-pending': {
        const dir = opts.dir || path.join(ROOT, 'docs/pending-approvals');
        const flags = Flags.scanPendingDir(dir);
        for (const flag of flags) {
          if (!flag.ok) {
            console.warn(`[agent-spec-plan] Skipping malformed flag '${flag.name}': ${flag.reason}`);
            continue;
          }
          const p = flag.payload;
          const subOpts = { cmd: p.action, story: p.story, gate: p.gate, reason: p.reason };
          const code = dispatch(subOpts, { sdlcPath });
          if (code === 0) {
            try { fs.unlinkSync(flag.filePath); }
            catch (e) { console.warn(`[agent-spec-plan] Could not delete '${flag.name}': ${e.message}`); }
          } else {
            console.warn(`[agent-spec-plan] Skipping '${flag.name}': state transition failed (exit code ${code}). Flag left in place.`);
          }
        }
        return 0;
      }
```

- [ ] **Step 4: Run tests to confirm pass**

```bash
npx jest tests/unit/agent-spec-plan-cli.test.js --no-coverage 2>&1 | tail -5
```

Expected: all dispatch tests pass.

- [ ] **Step 5: Run full lib + CLI test suite**

```bash
npx jest tests/unit/agent-spec-plan-state.test.js tests/unit/agent-spec-plan-flags.test.js tests/unit/agent-spec-plan-cli.test.js tests/unit/lens-findings-parser.test.js --no-coverage 2>&1 | tail -5
```

Expected: all tests pass.

- [ ] **Step 6: Commit**

```bash
git add tools/agent-spec-plan.js tests/unit/agent-spec-plan-cli.test.js
git commit -m "feat(US-0181): CLI dispatch complete (plan phase, escalate, list, show-pending, apply-pending)"
```

---

### Task 10: Auto-invoke apply-pending from generate-plan.js

**Files:**

- Modify: `tools/generate-plan.js`

`generate-plan.js` runs `apply-pending` as its first step so flag-file approvals get flushed before regenerating the dashboard.

- [ ] **Step 1: Find the top of `tools/generate-plan.js` `main()` function**

```bash
grep -n "^function main\|^async function main\|^function generatePlan" tools/generate-plan.js | head -3
```

- [ ] **Step 2: Add apply-pending as first step**

Near the top of `tools/generate-plan.js` (after the existing `require` statements), add:

```js
function applyPendingApprovals() {
  try {
    const { dispatch } = require('./agent-spec-plan');
    dispatch({ cmd: 'apply-pending' }, {});
  } catch (e) {
    console.warn(`[generate-plan] apply-pending skipped: ${e.message}`);
  }
}
```

Then in the `main()` function (or the first executable block), call `applyPendingApprovals()` BEFORE any other work. Use grep to locate the first line of main:

```bash
grep -nE "function main\(|generatePlan\(|^const data =" tools/generate-plan.js | head -5
```

Find the first execution line of `main()` (often a console.log or readJson call) and insert above it:

```js
applyPendingApprovals();
```

- [ ] **Step 3: Smoke test**

```bash
cd /Users/Kamal_Syed/Projects/PlanVisualizer
node tools/generate-plan.js 2>&1 | head -5
```

Expected: dashboard regenerates normally; if no flag files exist, `apply-pending` runs silently or logs "No pending approvals" depending on log function.

Test with a stale flag:

```bash
echo '{"story":"US-9999","gate":"spec","action":"approve","timestamp":"2026-05-11T12:00:00Z"}' > docs/pending-approvals/approve-US-9999-spec.flag
node tools/generate-plan.js 2>&1 | grep -E "agent-spec-plan|Skipping"
rm -f docs/pending-approvals/approve-US-9999-spec.flag
```

Expected: warning about US-9999 not found, flag left in place (or skipped); generate-plan continues normally.

- [ ] **Step 4: Run full test suite**

```bash
npx jest --no-coverage --testPathIgnorePatterns=".claude/worktrees" 2>&1 | tail -3
```

Expected: all passing.

- [ ] **Step 5: Commit**

```bash
git add tools/generate-plan.js
git commit -m "feat(US-0181): generate-plan auto-invokes apply-pending as first step"
```

---

### Task 11: Dashboard Pending Approvals widget

**Files:**

- Modify: `tools/lib/render-tabs.js`
- Create: `tests/unit/dashboard-pending-approvals.test.js`

Add a "Pending Approvals" widget to the Status tab that lists stories with open gates and provides Approve/Reject buttons that download flag files.

- [ ] **Step 1: Write failing tests**

Create `tests/unit/dashboard-pending-approvals.test.js`:

```js
'use strict';
const { renderPendingApprovalsWidget } = require('../../tools/lib/render-tabs');

function mkData(stories) {
  return { stories };
}

describe('renderPendingApprovalsWidget', () => {
  test('renders empty state when no pending approvals', () => {
    const html = renderPendingApprovalsWidget(
      mkData({
        'US-0001': { specPhase: { state: 'approved' }, planPhase: { state: 'approved' } },
      }),
    );
    expect(html).toContain('No pending approvals');
  });

  test('renders awaiting_ac_approval row', () => {
    const html = renderPendingApprovalsWidget(
      mkData({
        'US-0181': { specPhase: { state: 'awaiting_ac_approval' }, planPhase: { state: 'pending' } },
      }),
    );
    expect(html).toContain('US-0181');
    expect(html).toContain('AC');
    expect(html).toContain('approve-US-0181-ac');
  });

  test('renders awaiting_spec_approval row', () => {
    const html = renderPendingApprovalsWidget(
      mkData({
        'US-0181': { specPhase: { state: 'awaiting_spec_approval' }, planPhase: { state: 'pending' } },
      }),
    );
    expect(html).toContain('US-0181');
    expect(html).toContain('Spec');
  });

  test('renders awaiting_plan_approval row', () => {
    const html = renderPendingApprovalsWidget(
      mkData({
        'US-0181': { specPhase: { state: 'approved' }, planPhase: { state: 'awaiting_plan_approval' } },
      }),
    );
    expect(html).toContain('Plan');
  });

  test('Approve button has correct data attributes for flag download', () => {
    const html = renderPendingApprovalsWidget(
      mkData({
        'US-0181': { specPhase: { state: 'awaiting_ac_approval' }, planPhase: { state: 'pending' } },
      }),
    );
    expect(html).toMatch(/data-story="US-0181"/);
    expect(html).toMatch(/data-gate="ac"/);
    expect(html).toMatch(/data-action="approve"/);
  });

  test('Reject button shows reason textarea', () => {
    const html = renderPendingApprovalsWidget(
      mkData({
        'US-0181': { specPhase: { state: 'awaiting_ac_approval' }, planPhase: { state: 'pending' } },
      }),
    );
    expect(html).toMatch(/data-action="reject"/);
    expect(html).toMatch(/<textarea[^>]*data-reason-for="US-0181-ac"/);
  });

  test('lists multiple pending stories', () => {
    const html = renderPendingApprovalsWidget(
      mkData({
        'US-0181': { specPhase: { state: 'awaiting_ac_approval' }, planPhase: { state: 'pending' } },
        'US-0182': { specPhase: { state: 'approved' }, planPhase: { state: 'awaiting_plan_approval' } },
      }),
    );
    expect(html).toContain('US-0181');
    expect(html).toContain('US-0182');
  });

  test('handles stories without orchestration state gracefully', () => {
    const html = renderPendingApprovalsWidget(
      mkData({
        'US-0001': { status: 'Done' },
      }),
    );
    expect(html).toContain('No pending approvals');
  });
});
```

- [ ] **Step 2: Run tests to confirm failure**

```bash
npx jest tests/unit/dashboard-pending-approvals.test.js --no-coverage 2>&1 | tail -5
```

Expected: `renderPendingApprovalsWidget is not a function`.

- [ ] **Step 3: Add `renderPendingApprovalsWidget` to `tools/lib/render-tabs.js`**

Locate the existing exports object near the end of the file. Before the `module.exports = { ... }` block, add:

```js
function renderPendingApprovalsWidget(data) {
  const stories = (data && data.stories) || {};
  const pending = [];
  for (const [id, st] of Object.entries(stories)) {
    if (!st.specPhase) continue;
    if (st.specPhase.state === 'awaiting_ac_approval') pending.push({ id, gate: 'ac', gateLabel: 'AC' });
    if (st.specPhase.state === 'awaiting_spec_approval') pending.push({ id, gate: 'spec', gateLabel: 'Spec' });
    if (st.planPhase && st.planPhase.state === 'awaiting_plan_approval')
      pending.push({ id, gate: 'plan', gateLabel: 'Plan' });
  }

  if (pending.length === 0) {
    return `<div class="card pv-pending-approvals" style="margin-bottom:16px">
  <div class="card-head"><h3 style="text-transform:uppercase;letter-spacing:.08em;font-size:11px;font-weight:700">Pending Approvals</h3></div>
  <div class="card-body" style="padding:12px;font-size:12px;color:var(--text-mute)">No pending approvals.</div>
</div>`;
  }

  const rows = pending
    .map(
      (p) => `
    <div class="pv-pending-row" style="display:flex;align-items:center;gap:8px;padding:8px 0;border-bottom:1px solid var(--border)">
      <span class="font-mono" style="font-size:12px;color:var(--text)">${esc(p.id)}</span>
      <span class="chip warn" style="font-size:9px">${p.gateLabel} review</span>
      <button class="chip ok" style="cursor:pointer;font-size:10px"
        data-action="approve" data-story="${esc(p.id)}" data-gate="${p.gate}"
        onclick="pvDownloadFlag(this)">Approve</button>
      <button class="chip risk" style="cursor:pointer;font-size:10px"
        data-action="reject" data-story="${esc(p.id)}" data-gate="${p.gate}"
        onclick="pvShowRejectForm(this)">Reject</button>
      <textarea class="pv-reject-reason" data-reason-for="${esc(p.id)}-${p.gate}"
        style="display:none;font-size:11px;padding:4px;border:1px solid var(--border);border-radius:4px;background:var(--clr-input-bg);color:var(--clr-input-text);flex:1"
        placeholder="Rejection reason..." rows="2"></textarea>
    </div>`,
    )
    .join('');

  return `<div class="card pv-pending-approvals" style="margin-bottom:16px">
  <div class="card-head"><h3 style="text-transform:uppercase;letter-spacing:.08em;font-size:11px;font-weight:700">Pending Approvals</h3></div>
  <div class="card-body" style="padding:12px">${rows}</div>
</div>
<script>
function pvDownloadFlag(btn) {
  var story  = btn.getAttribute('data-story');
  var gate   = btn.getAttribute('data-gate');
  var action = btn.getAttribute('data-action');
  var reason = '';
  if (action === 'reject') {
    var area = document.querySelector('[data-reason-for="' + story + '-' + gate + '"]');
    if (area) reason = area.value || '';
    if (!reason) { alert('Please enter a rejection reason.'); return; }
  }
  var payload = { story: story, gate: gate, action: action, timestamp: new Date().toISOString() };
  if (reason) payload.reason = reason;
  var blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
  var url = URL.createObjectURL(blob);
  var a = document.createElement('a');
  a.href = url;
  a.download = action + '-' + story + '-' + gate + '.flag';
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
  alert('Flag downloaded. Move it to docs/pending-approvals/ and run: npm run plan');
}
function pvShowRejectForm(btn) {
  var story = btn.getAttribute('data-story');
  var gate  = btn.getAttribute('data-gate');
  var area  = document.querySelector('[data-reason-for="' + story + '-' + gate + '"]');
  if (area) {
    if (area.style.display === 'none') {
      area.style.display = '';
      area.focus();
      btn.textContent = 'Confirm Reject';
      btn.setAttribute('onclick', 'pvDownloadFlag(this)');
    }
  }
}
</script>`;
}
```

Then update the `module.exports` block to include the new function. Find the `module.exports = {` block and add:

```js
  renderPendingApprovalsWidget,
```

- [ ] **Step 4: Run widget tests to confirm pass**

```bash
npx jest tests/unit/dashboard-pending-approvals.test.js --no-coverage 2>&1 | tail -5
```

Expected: all 8 widget tests pass.

- [ ] **Step 5: Inject widget into Status tab rendering**

In `tools/lib/render-tabs.js`, find `function renderStatusTab(data)`. Locate the return statement (search for `<div id="tab-status"`). Insert the widget output right after `_renderFullStatusHero(data)`:

```js
    ${_renderFullStatusHero(data)}
    ${renderPendingApprovalsWidget(data)}
```

- [ ] **Step 6: Smoke-test dashboard regeneration**

```bash
node tools/generate-plan.js 2>&1 | tail -3
grep -c "pv-pending-approvals" docs/plan-status.html
```

Expected: dashboard regenerates; `pv-pending-approvals` appears at least once.

- [ ] **Step 7: Commit**

```bash
git add tools/lib/render-tabs.js tests/unit/dashboard-pending-approvals.test.js docs/plan-status.html docs/plan-status.json
git commit -m "feat(US-0181): Pending Approvals widget on Status tab with flag-download buttons"
```

---

### Task 12: Agent files protocol contract test (TDD-first)

**Files:**

- Create: `tests/unit/agent-files-protocol.test.js`

This test will fail until Tasks 13-18 add the protocol subsections to agent files. Writing the test FIRST per the spec's implementation order.

- [ ] **Step 1: Write failing test**

Create `tests/unit/agent-files-protocol.test.js`:

```js
'use strict';
const fs = require('fs');
const path = require('path');

const AGENTS_DIR = path.join(__dirname, '..', '..', 'docs', 'agents');

function read(file) {
  return fs.readFileSync(path.join(AGENTS_DIR, file), 'utf8');
}

// NOTE TO MAINTAINERS: these section names are the protocol's public API.
// Renames require coordinated updates across all listed files AND this test.
// Brittleness is intentional.

describe('agent-files protocol contract', () => {
  test('DM_AGENT.md contains ## Pre-Dispatch Spec & Plan Orchestration', () => {
    expect(read('DM_AGENT.md')).toMatch(/^## Pre-Dispatch Spec & Plan Orchestration$/m);
  });

  test('PO_AGENT.md contains ## Spec Brainstorming Protocol', () => {
    expect(read('PO_AGENT.md')).toMatch(/^## Spec Brainstorming Protocol$/m);
  });

  test('PO_AGENT.md contains ## Spec Output Schema', () => {
    expect(read('PO_AGENT.md')).toMatch(/^## Spec Output Schema$/m);
  });

  test('ARCHITECT_AGENT.md contains ## Plan Writing Protocol', () => {
    expect(read('ARCHITECT_AGENT.md')).toMatch(/^## Plan Writing Protocol$/m);
  });

  test('ARCHITECT_AGENT.md contains ## Self-Review Checklist', () => {
    expect(read('ARCHITECT_AGENT.md')).toMatch(/^## Self-Review Checklist$/m);
  });

  test('UI_DESIGNER_AGENT.md contains ## Spec Contribution Protocol', () => {
    expect(read('UI_DESIGNER_AGENT.md')).toMatch(/^## Spec Contribution Protocol$/m);
  });

  test('FE_DEV_AGENT.md contains ## UI Mockup Protocol', () => {
    expect(read('FE_DEV_AGENT.md')).toMatch(/^## UI Mockup Protocol$/m);
  });

  test('CODE_REVIEWER_AGENT.md contains ## Spec/Plan Review Protocol', () => {
    expect(read('CODE_REVIEWER_AGENT.md')).toMatch(/^## Spec\/Plan Review Protocol$/m);
  });

  test('CODE_REVIEWER_AGENT.md contains canonical @persona list', () => {
    const text = read('CODE_REVIEWER_AGENT.md');
    expect(text).toContain('@compass');
    expect(text).toContain('@palette');
    expect(text).toContain('@pixel');
    expect(text).toContain('@keystone');
    expect(text).toContain('@lens');
    expect(text).toContain('@plan-author');
  });
});
```

- [ ] **Step 2: Run test to confirm failure**

```bash
npx jest tests/unit/agent-files-protocol.test.js --no-coverage 2>&1 | tail -10
```

Expected: 9 tests fail (sections don't exist yet in agent files).

- [ ] **Step 3: Commit (failing test — marks intent for Tasks 13-18)**

```bash
git add tests/unit/agent-files-protocol.test.js
git commit -m "test(US-0181): agent-files protocol contract test (failing — tasks 13-18 will satisfy)"
```

---

### Task 13: Update DM_AGENT.md with Pre-Dispatch section

**Files:**

- Modify: `docs/agents/DM_AGENT.md`

- [ ] **Step 1: Find the insertion point**

The new section goes BEFORE `## Orchestration Playbook`. Find it:

```bash
grep -n "^## Orchestration Playbook" docs/agents/DM_AGENT.md
```

- [ ] **Step 2: Insert the new section above ## Orchestration Playbook**

Open `docs/agents/DM_AGENT.md`. Above the `## Orchestration Playbook` line, insert:

```markdown
## Pre-Dispatch Spec & Plan Orchestration

Before any specialist agent is dispatched to implement a story, the spec and plan phases must complete. A story enters dispatch only when `planPhase.state === "approved"`.

This section specifies WHO to spawn and WHEN. For HOW to spawn (worktree isolation, model selection ritual, log via `agent-start`/`agent-done`), see §How to Spawn Sub-Agents.

### Spec phase sequence

1. `node tools/agent-spec-plan.js spec-start --story <id>`
2. Spawn Compass → ACs + scope (Compass uses superpowers:brainstorming skill if available, else manual dialogue per `PO_AGENT.md#Spec-Brainstorming-Protocol`).
3. `spec-await-ac --story <id>` → halts at exit 2 → user approves AC checkpoint via `approve --gate ac` (CLI) or dashboard widget download.
4. If `uiSurface === true`: spawn Palette (design tokens), then Pixel (interactive mockup at `docs/superpowers/mockups/<story>/index.html`).
5. Spawn Keystone for `## Technical Design` section.
6. Spawn Lens for spec review. Lens emits structured findings (see §Lens findings format).
7. `spec-review-result --verdict APPROVED|REQUEST_CHANGES --findings-file <path>`. On REQUEST_CHANGES, route findings by `@persona` primary tag and re-engage owner. Loop until APPROVED or iteration cap reached (default 3).
8. `spec-await-final --story <id>` → user approves final spec.
9. Spec phase complete (`specPhase.state === "approved"`).

### Plan phase sequence

1. `plan-start --story <id> --author Keystone`
2. Spawn Keystone (plan author). Keystone uses superpowers:writing-plans skill if available, else manual protocol per `ARCHITECT_AGENT.md#Plan-Writing-Protocol`. Keystone runs the self-review checklist before handoff.
3. If Keystone discovers a spec issue, call `plan-spec-gap --story <id> --reason "..."` → spec phase reopens.
4. Spawn Lens for plan review.
5. `plan-review-result --verdict ... --findings-file ...`. Loop on REQUEST_CHANGES (cap 3) routing findings.
6. `plan-await-approval --story <id>` → user approves plan.
7. Story state = `ready_for_dispatch` (derived). US-0182+ takes over from here.

### Tiered fallback

- **With superpowers installed:** Compass invokes `superpowers:brainstorming` skill; Keystone invokes `superpowers:writing-plans` skill; Lens follows `requesting-code-review` patterns.
- **Without superpowers:** agents follow manual protocols documented in their respective `_AGENT.md` files. The CLI tool and state machine work identically either way.

### Lens findings format

Lens emits findings as markdown bullets tagged with `@persona`:
```

## Findings

- @compass: AC-007 missing edge case for empty list
- @palette: contrast ratio of orange chip is 3.2:1 (needs >= 4.5:1)
- @pixel: form field has no error state in mockup
- @keystone: technical design omits retry policy for transient failures
- @compass @keystone: cross-cutting concern requiring both ACs and design update

```

**Canonical persona tags (lowercase):** `@compass`, `@palette`, `@pixel`, `@keystone`, `@lens`, `@forge`, `@sentinel`, `@circuit`, `@plan-author` (synonym for current plan owner).

**Routing rule:** First tag = primary owner (receives finding for fix). Additional tags = CC'd (informed via log entry, not directed to fix).

### Iteration cap

Default 3 per phase (configurable in `plan-visualizer.config.json` → `orchestration.iterationCap.{spec,plan}`). When `reviewIterations === reviewIterationCap`, the CLI auto-transitions state to `escalated`. DM_AGENT writes a `## ESCALATION` block to `progress.md` with current findings and stops orchestration. Human resolution required.

### User approval gates

Three gates per story: **AC**, **Spec**, **Plan**. Each can be approved via:

- **CLI fast-path:** `node tools/agent-spec-plan.js approve --story US-XXXX --gate ac|spec|plan`
- **Dashboard widget:** Status tab → Pending Approvals widget → click Approve → download `approve-US-XXXX-<gate>.flag` → move to `docs/pending-approvals/` → next `npm run plan` flushes pending approvals.

Both paths are equivalent. CLI is faster for terminal users; dashboard is the remote/visual-review path.

---
```

- [ ] **Step 3: Verify the section is in place and the contract test for DM_AGENT.md passes**

```bash
npx jest tests/unit/agent-files-protocol.test.js -t "DM_AGENT" --no-coverage 2>&1 | tail -3
```

Expected: DM_AGENT.md test passes (others may still fail).

- [ ] **Step 4: Commit**

```bash
git add docs/agents/DM_AGENT.md
git commit -m "docs(US-0181): DM_AGENT.md Pre-Dispatch Spec & Plan Orchestration section"
```

---

### Task 14: Update PO_AGENT.md with brainstorming + spec output protocol

**Files:**

- Modify: `docs/agents/PO_AGENT.md`

- [ ] **Step 1: Append to PO_AGENT.md**

Append at the END of `docs/agents/PO_AGENT.md`:

````markdown
## Spec Brainstorming Protocol

When dispatched during a story's spec phase, you (Compass) lead the spec brainstorming.

**Step 1: Log start.** Run `node tools/update-sdlc-status.js agent-start --agent Compass --story <id> --task "spec brainstorming" --model sonnet`.

**Step 2: Choose tooling.**

- **With superpowers installed** (`[ -d ~/.claude/plugins/cache/claude-plugins-official/superpowers ]`): invoke the `superpowers:brainstorming` skill. The skill drives the dialogue; you own the persona (PO scope refinement, AC writing, RELEASE_PLAN linkage).
- **Without superpowers:** run the manual dialogue below.

**Step 3 (manual dialogue, used when superpowers not installed):**

Ask the user questions one at a time. Prefer multiple-choice over open-ended where possible. Cover:

1. **Purpose** — what does this story enable for users/the project?
2. **Constraints** — performance, schema, compatibility, security?
3. **Success criteria** — how do we know it's done? What's measurable?
4. **Scope** — multi-subsystem? If so, decompose into sub-stories first.
5. **Alternatives** — propose 2-3 approaches with trade-offs, recommend one.

Loop on questions until you understand purpose + constraints + success criteria. Don't refine implementation details before scope is confirmed.

**Step 4: Write spec.** Save to `docs/superpowers/specs/<date>-<story>-design.md` per the schema in §Spec Output Schema.

**Step 5: Record spec path and UI flag.** Call:

- `node tools/agent-spec-plan.js spec-update --story <id> --field specPath --value docs/superpowers/specs/<date>-<story>-design.md`
- `node tools/agent-spec-plan.js spec-update --story <id> --field uiSurface --value true|false`

**Step 6: Signal AC checkpoint.** Call `node tools/agent-spec-plan.js spec-await-ac --story <id>`. This exits 2 — orchestration pauses for user approval.

**Step 7: Log done.** Run `node tools/update-sdlc-status.js agent-done --agent Compass --story <id>`.

## Spec Output Schema

**File path:** `docs/superpowers/specs/<YYYY-MM-DD>-<story-id>-design.md` (lowercase story id, e.g. `2026-05-11-us-0181-design.md`).

**Required top-level structure:**

```markdown
# <Story ID> — <Short Title>

**Epic:** <epic id and title>
**Status:** Design (in progress)
**Author:** <agent name(s)>
**Depends on:** <list or "none">

---

## 1. Goal

<one paragraph>

## 2. Acceptance Criteria

<AC-### bulleted list, each with measurable success criterion>

## 3. Out of Scope

<bulleted list>

---
```
````

Sections added by other agents (Palette → `## Design System`, Pixel → `## UI Preview`, Keystone → `## Technical Design`) are appended in sequence under their own headings.

**`uiSurface` flag (boolean):** set to `true` if the story has any user-facing visible surface (button, form, panel, mockup-worthy element). Otherwise `false`. Drives whether Palette and Pixel are spawned in subsequent steps.

````

- [ ] **Step 2: Verify the PO_AGENT.md tests pass**

```bash
npx jest tests/unit/agent-files-protocol.test.js -t "PO_AGENT" --no-coverage 2>&1 | tail -3
````

Expected: both PO_AGENT tests pass.

- [ ] **Step 3: Commit**

```bash
git add docs/agents/PO_AGENT.md
git commit -m "docs(US-0181): PO_AGENT.md Spec Brainstorming Protocol + Spec Output Schema"
```

---

### Task 15: Update ARCHITECT_AGENT.md with plan writing + self-review

**Files:**

- Modify: `docs/agents/ARCHITECT_AGENT.md`

- [ ] **Step 1: Append to ARCHITECT_AGENT.md**

Append at the END of `docs/agents/ARCHITECT_AGENT.md`:

```markdown
## Plan Writing Protocol

When dispatched as the plan author for an approved spec, you (Keystone) write the implementation plan.

**Step 1: Log start.** Run `node tools/update-sdlc-status.js agent-start --agent Keystone --story <id> --task "plan writing" --model sonnet`.

**Step 2: Choose tooling.**

- **With superpowers installed:** invoke the `superpowers:writing-plans` skill. It guides task decomposition, exact file paths, complete code, TDD-friendly ordering, frequent commits.
- **Without superpowers:** follow the manual discipline below — the rules are the same.

**Manual plan discipline (mirrors writing-plans skill):**

- Save to `docs/superpowers/plans/<YYYY-MM-DD>-<story-id>.md`.
- One action per step (e.g. "write failing test", "run test to verify failure", "implement minimum code", "run test to verify pass", "commit").
- Each task touches a small set of files (1-3 typical). Use exact file paths.
- Complete code in every step that changes code — never "implement similar to before".
- TDD-friendly: write the failing test first, then the implementation.
- Frequent commits — every successful task or sub-task ends with a commit.
- No placeholders: "TBD", "implement later", "add error handling" are plan failures.
- Cross-reference: types and method names used in later tasks must match earlier tasks.

**Step 3: If you discover a spec gap.** Stop plan writing. Call `node tools/agent-spec-plan.js plan-spec-gap --story <id> --reason "<short>"`. This reopens the spec phase. Do not attempt to fix the spec yourself — the gap routes back to Compass and/or you in the spec phase.

**Step 4: Self-review.** Before handing the plan to Lens, run through the Self-Review Checklist below.

**Step 5: Log done.** Run `node tools/update-sdlc-status.js agent-done --agent Keystone --story <id>`.

## Self-Review Checklist

Run through this list before handing the plan to Lens. The plan author runs this; it does not count as an iteration.

**1. Spec coverage.** Skim each section/requirement in the spec. Can you point to a task that implements it? List any gaps. (If you find a real gap, call `plan-spec-gap` instead of patching the spec yourself.)

**2. Placeholder scan.** Search for red flags — `TBD`, `TODO`, `fill in`, `implement later`, `add error handling` (without showing what error handling). Replace with concrete content.

**3. Type/method consistency.** Do the types, method signatures, and property names you used in later tasks match what you defined earlier? A function called `clearLayers()` in Task 3 and `clearFullLayers()` in Task 7 is a bug.

**4. TDD ordering.** Every code-producing task has a "write failing test" step BEFORE the "implement" step.

**5. Commit cadence.** Every task ends with at least one commit. Long tasks have intermediate commits.

If you find issues, fix them inline. No need to re-self-review — just fix and move on.
```

- [ ] **Step 2: Verify the ARCHITECT_AGENT.md tests pass**

```bash
npx jest tests/unit/agent-files-protocol.test.js -t "ARCHITECT_AGENT" --no-coverage 2>&1 | tail -3
```

- [ ] **Step 3: Commit**

```bash
git add docs/agents/ARCHITECT_AGENT.md
git commit -m "docs(US-0181): ARCHITECT_AGENT.md Plan Writing Protocol + Self-Review Checklist"
```

---

### Task 16: Update UI_DESIGNER_AGENT.md with spec contribution protocol

**Files:**

- Modify: `docs/agents/UI_DESIGNER_AGENT.md`

- [ ] **Step 1: Append to UI_DESIGNER_AGENT.md**

Append at the END of `docs/agents/UI_DESIGNER_AGENT.md`:

````markdown
## Spec Contribution Protocol

When dispatched during a story's spec phase (only when `uiSurface === true`), you (Palette) contribute the design-system section to the spec.

**Step 1: Log start.** Run `node tools/update-sdlc-status.js agent-start --agent Palette --story <id> --task "spec design contribution" --model sonnet`.

**Step 2: Read existing draft.** Open `docs/superpowers/specs/<date>-<story>-design.md`. Read Compass's ACs to understand the UI surface.

**Step 3: Define tokens and rules.** Reference the existing OKLCH palette in `tools/lib/render-tabs.js` (search for `--clr-` variables). Do NOT introduce new colors unless absolutely necessary for the story.

**Step 4: Write the `## Design System` section.** Append to the spec file:

```markdown
## Design System

**Color tokens (existing OKLCH palette):**

- <token name> — <usage>
- ...

**Layout rules:**

- <spacing, alignment, breakpoint rules>

**Typography:**

- <font family / size scales used>

**Custom UI flag:** set this if a bespoke mockup is needed beyond the design system.

- `customMockupNeeded: true|false`
```
````

**Step 5: Signal whether Pixel should build a mockup.** If `customMockupNeeded: true`, the orchestrator will spawn Pixel next. If `false`, Pixel is skipped and Keystone runs next.

**Step 6: Log done.** Run `node tools/update-sdlc-status.js agent-done --agent Palette --story <id>`.

````

- [ ] **Step 2: Verify the test passes**

```bash
npx jest tests/unit/agent-files-protocol.test.js -t "UI_DESIGNER" --no-coverage 2>&1 | tail -3
````

- [ ] **Step 3: Commit**

```bash
git add docs/agents/UI_DESIGNER_AGENT.md
git commit -m "docs(US-0181): UI_DESIGNER_AGENT.md Spec Contribution Protocol"
```

---

### Task 17: Update FE_DEV_AGENT.md with UI mockup protocol

**Files:**

- Modify: `docs/agents/FE_DEV_AGENT.md`

- [ ] **Step 1: Append to FE_DEV_AGENT.md**

Append at the END of `docs/agents/FE_DEV_AGENT.md`:

````markdown
## UI Mockup Protocol

When dispatched during a story's spec phase to build an interactive mockup (only when Palette flagged `customMockupNeeded: true`), you (Pixel) build a self-contained mockup.

**Step 1: Log start.** Run `node tools/update-sdlc-status.js agent-start --agent Pixel --story <id> --task "UI mockup" --model sonnet`.

**Step 2: Read spec + design system section.** Understand the user flow and design tokens.

**Step 3: Build self-contained mockup.** Create `docs/superpowers/mockups/<story-id>/index.html`. Must be:

- **Self-contained:** all CSS and JS inlined, or in sibling `.css` and `.js` files in the same directory. No CDN, no `<script src="https://...">`, no build step.
- **Uses existing tokens:** reference the OKLCH palette via CSS variables defined inline at top of the file (copy from `tools/lib/render-scripts.js` if needed).
- **Interactive:** real clickable elements, hover states, form interactions where applicable. Not static screenshots.
- **Browser-openable:** the user can open `file:///.../index.html` directly in any modern browser and the mockup works.

**Step 4: Add `## UI Preview` section to the spec.** Append:

```markdown
## UI Preview

Interactive mockup at `docs/superpowers/mockups/<story-id>/index.html` — open in browser.

- <screen 1 description>
- <interactions covered>
- <known limitations of mockup vs final implementation>
```
````

**Step 5: Smoke-test.** Open the mockup file in a browser yourself to confirm it renders and interactions work.

**Step 6: Log done.** Run `node tools/update-sdlc-status.js agent-done --agent Pixel --story <id>`.

````

- [ ] **Step 2: Verify the test passes**

```bash
npx jest tests/unit/agent-files-protocol.test.js -t "FE_DEV" --no-coverage 2>&1 | tail -3
````

- [ ] **Step 3: Commit**

```bash
git add docs/agents/FE_DEV_AGENT.md
git commit -m "docs(US-0181): FE_DEV_AGENT.md UI Mockup Protocol"
```

---

### Task 18: Update CODE_REVIEWER_AGENT.md with spec/plan review protocol

**Files:**

- Modify: `docs/agents/CODE_REVIEWER_AGENT.md`

- [ ] **Step 1: Append to CODE_REVIEWER_AGENT.md**

Append at the END of `docs/agents/CODE_REVIEWER_AGENT.md`:

````markdown
## Spec/Plan Review Protocol

When dispatched during a story's spec or plan phase, you (Lens) review the artifact and emit a structured verdict.

**Step 1: Log start.** Run `node tools/update-sdlc-status.js agent-start --agent Lens --story <id> --task "spec review" --model sonnet` (or `task "plan review"`).

**Step 2: Choose review template.**

### Spec review template

Check against:

- `AGENTS.md` standards (project-wide rules)
- `PROJECT.md` constitution (data schemas, behavioral rules)
- Design system rules (`UI_DESIGNER_AGENT.md` tokens if applicable)
- Story scope from `RELEASE_PLAN.md`
- AC measurability (each AC must be testable)
- Mockup matches design (if `uiSurface === true`)

### Plan review template

Check against:

- Spec coverage: every spec section has implementation tasks
- Task granularity: appropriately small (no formal time metric, but a task that would take a developer all day is too large)
- Placeholder scan: no `TBD`, `implement later`, `add error handling` (without showing what)
- Type/method consistency: same names across tasks
- TDD discipline: failing test before implementation in each task

**Step 3: Emit verdict.** Write your findings to a markdown file (e.g. `/tmp/lens-findings-<id>.md`):

```markdown
**Verdict:** APPROVED | REQUEST_CHANGES

## Findings

- @<persona>: <description of issue and what fix is needed>
- @<persona> @<persona>: <cross-cutting concern with primary + CC>
```
````

**Canonical persona tags (lowercase):** `@compass`, `@palette`, `@pixel`, `@keystone`, `@lens`, `@forge`, `@sentinel`, `@circuit`, `@plan-author`.

**Routing rule:** First tag = primary owner. Additional tags = CC'd (informed but not the owner).

**Step 4: Notify orchestrator.** The DM_AGENT will call `node tools/agent-spec-plan.js spec-review-result` or `plan-review-result` with your verdict and findings file. You don't call this yourself.

**Step 5: Log done.** Run `node tools/update-sdlc-status.js agent-done --agent Lens --story <id>`.

````

- [ ] **Step 2: Verify all agent-files-protocol tests pass**

```bash
npx jest tests/unit/agent-files-protocol.test.js --no-coverage 2>&1 | tail -5
````

Expected: all 9 tests pass.

- [ ] **Step 3: Commit**

```bash
git add docs/agents/CODE_REVIEWER_AGENT.md
git commit -m "docs(US-0181): CODE_REVIEWER_AGENT.md Spec/Plan Review Protocol"
```

---

### Task 19: Integration smoke tests

**Files:**

- Create: `tests/integration/agent-spec-plan-flow.test.js`

End-to-end smoke tests that exercise the full pending → ready_for_dispatch flow via the CLI.

- [ ] **Step 1: Create the integration test file**

```js
'use strict';
const fs = require('fs');
const path = require('path');
const os = require('os');
const { dispatch } = require('../../tools/agent-spec-plan');

function setupTmp() {
  const tmpdir = fs.mkdtempSync(path.join(os.tmpdir(), 'agt-int-'));
  const sdlcPath = path.join(tmpdir, 'sdlc-status.json');
  const pendingDir = path.join(tmpdir, 'pending');
  fs.mkdirSync(pendingDir, { recursive: true });
  fs.writeFileSync(sdlcPath, JSON.stringify({ stories: { 'US-0181': { status: 'Planned' } } }));
  return { tmpdir, sdlcPath, pendingDir };
}

describe('agent-spec-plan — full flow integration', () => {
  let tmp;
  beforeEach(() => {
    tmp = setupTmp();
  });
  afterEach(() => fs.rmSync(tmp.tmpdir, { recursive: true, force: true }));

  test('happy path: pending → ready_for_dispatch', () => {
    const { sdlcPath } = tmp;
    expect(dispatch({ cmd: 'spec-start', story: 'US-0181' }, { sdlcPath })).toBe(0);
    expect(dispatch({ cmd: 'spec-await-ac', story: 'US-0181' }, { sdlcPath })).toBe(2);
    expect(dispatch({ cmd: 'approve', story: 'US-0181', gate: 'ac' }, { sdlcPath })).toBe(0);
    expect(dispatch({ cmd: 'spec-review-result', story: 'US-0181', verdict: 'APPROVED' }, { sdlcPath })).toBe(0);
    expect(dispatch({ cmd: 'spec-await-final', story: 'US-0181' }, { sdlcPath })).toBe(2);
    expect(dispatch({ cmd: 'approve', story: 'US-0181', gate: 'spec' }, { sdlcPath })).toBe(0);
    expect(dispatch({ cmd: 'plan-start', story: 'US-0181', author: 'Keystone' }, { sdlcPath })).toBe(0);
    expect(dispatch({ cmd: 'plan-review-result', story: 'US-0181', verdict: 'APPROVED' }, { sdlcPath })).toBe(0);
    expect(dispatch({ cmd: 'plan-await-approval', story: 'US-0181' }, { sdlcPath })).toBe(2);
    expect(dispatch({ cmd: 'approve', story: 'US-0181', gate: 'plan' }, { sdlcPath })).toBe(0);

    const data = JSON.parse(fs.readFileSync(sdlcPath, 'utf8'));
    expect(data.stories['US-0181'].specPhase.state).toBe('approved');
    expect(data.stories['US-0181'].planPhase.state).toBe('approved');
  });

  test('sad path: plan-spec-gap reopens spec phase', () => {
    const { sdlcPath } = tmp;
    dispatch({ cmd: 'spec-start', story: 'US-0181' }, { sdlcPath });
    dispatch({ cmd: 'spec-await-ac', story: 'US-0181' }, { sdlcPath });
    dispatch({ cmd: 'approve', story: 'US-0181', gate: 'ac' }, { sdlcPath });
    dispatch({ cmd: 'spec-review-result', story: 'US-0181', verdict: 'APPROVED' }, { sdlcPath });
    dispatch({ cmd: 'spec-await-final', story: 'US-0181' }, { sdlcPath });
    dispatch({ cmd: 'approve', story: 'US-0181', gate: 'spec' }, { sdlcPath });
    dispatch({ cmd: 'plan-start', story: 'US-0181', author: 'Keystone' }, { sdlcPath });
    dispatch({ cmd: 'plan-spec-gap', story: 'US-0181', reason: 'AC misses error case' }, { sdlcPath });

    const data = JSON.parse(fs.readFileSync(sdlcPath, 'utf8'));
    expect(data.stories['US-0181'].specPhase.state).toBe('in_progress');
    expect(data.stories['US-0181'].planPhase.state).toBe('pending');
    expect(data.stories['US-0181'].specPhase.specApprovedAt).toBeNull();
  });

  test('cap path: 3 REQUEST_CHANGES → escalated', () => {
    const { sdlcPath } = tmp;
    dispatch({ cmd: 'spec-start', story: 'US-0181' }, { sdlcPath });
    dispatch({ cmd: 'spec-await-ac', story: 'US-0181' }, { sdlcPath });
    dispatch({ cmd: 'approve', story: 'US-0181', gate: 'ac' }, { sdlcPath });
    expect(dispatch({ cmd: 'spec-review-result', story: 'US-0181', verdict: 'REQUEST_CHANGES' }, { sdlcPath })).toBe(0);
    expect(dispatch({ cmd: 'spec-review-result', story: 'US-0181', verdict: 'REQUEST_CHANGES' }, { sdlcPath })).toBe(0);
    expect(dispatch({ cmd: 'spec-review-result', story: 'US-0181', verdict: 'REQUEST_CHANGES' }, { sdlcPath })).toBe(1);

    const data = JSON.parse(fs.readFileSync(sdlcPath, 'utf8'));
    expect(data.stories['US-0181'].specPhase.state).toBe('escalated');
  });

  test('flag-file path: drop approve flag, apply-pending applies it', () => {
    const { sdlcPath, pendingDir } = tmp;
    dispatch({ cmd: 'spec-start', story: 'US-0181' }, { sdlcPath });
    dispatch({ cmd: 'spec-await-ac', story: 'US-0181' }, { sdlcPath });

    const flagPath = path.join(pendingDir, 'approve-US-0181-ac.flag');
    fs.writeFileSync(
      flagPath,
      JSON.stringify({
        story: 'US-0181',
        gate: 'ac',
        action: 'approve',
        timestamp: new Date().toISOString(),
      }),
    );

    expect(dispatch({ cmd: 'apply-pending', dir: pendingDir }, { sdlcPath })).toBe(0);
    expect(fs.existsSync(flagPath)).toBe(false); // deleted after applying

    const data = JSON.parse(fs.readFileSync(sdlcPath, 'utf8'));
    expect(data.stories['US-0181'].specPhase.acApprovedAt).toBeTruthy();
  });
});
```

- [ ] **Step 2: Run integration tests**

```bash
npx jest tests/integration/agent-spec-plan-flow.test.js --no-coverage 2>&1 | tail -5
```

Expected: all 4 integration tests pass.

- [ ] **Step 3: Commit**

```bash
git add tests/integration/agent-spec-plan-flow.test.js
git commit -m "test(US-0181): integration smoke — full flow + sad paths + flag-file path"
```

---

### Task 20: Playwright E2E smoke test

**Files:**

- Create: `tests/e2e/agent-spec-plan-download.spec.js`

Verify the dashboard's Approve button triggers a flag-file download.

- [ ] **Step 1: Check Playwright is already configured**

```bash
grep -l "playwright" package.json
cat playwright.config.js 2>/dev/null | head -10
```

Playwright should already be installed (existing `tests/e2e/` dir). If not, skip this task and add a TODO note.

- [ ] **Step 2: Create the E2E test**

Create `tests/e2e/agent-spec-plan-download.spec.js`:

```js
'use strict';
const { test, expect } = require('@playwright/test');
const path = require('path');
const fs = require('fs');
const os = require('os');

// This test requires a generated dashboard with a Pending Approvals widget.
// We seed an awaiting_ac_approval state directly in sdlc-status.json before
// the dashboard regeneration step happens (or use a pre-baked HTML fixture).

test.describe('Pending Approvals widget — flag download', () => {
  test('Approve button triggers flag-file download with correct filename', async ({ page, context }) => {
    // Use a pre-generated fixture HTML with a known pending state
    const fixturePath = path.join(__dirname, 'fixtures', 'pending-approvals-fixture.html');
    if (!fs.existsSync(fixturePath)) {
      test.skip(true, 'Fixture not found — skip E2E (smoke only)');
      return;
    }

    await page.goto('file://' + fixturePath);

    const [download] = await Promise.all([
      page.waitForEvent('download'),
      page.click('[data-action="approve"][data-story="US-0181"][data-gate="ac"]'),
    ]);

    expect(download.suggestedFilename()).toBe('approve-US-0181-ac.flag');
  });
});
```

- [ ] **Step 3: Create the fixture HTML**

Create directory and fixture:

```bash
mkdir -p tests/e2e/fixtures
```

Create `tests/e2e/fixtures/pending-approvals-fixture.html`:

```html
<!DOCTYPE html>
<html>
  <head>
    <title>Pending Approvals Fixture</title>
  </head>
  <body>
    <div class="pv-pending-row">
      <button data-action="approve" data-story="US-0181" data-gate="ac" onclick="pvDownloadFlag(this)">Approve</button>
    </div>
    <script>
      function pvDownloadFlag(btn) {
        var story = btn.getAttribute('data-story');
        var gate = btn.getAttribute('data-gate');
        var action = btn.getAttribute('data-action');
        var payload = { story: story, gate: gate, action: action, timestamp: new Date().toISOString() };
        var blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
        var url = URL.createObjectURL(blob);
        var a = document.createElement('a');
        a.href = url;
        a.download = action + '-' + story + '-' + gate + '.flag';
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
      }
    </script>
  </body>
</html>
```

- [ ] **Step 4: Run the Playwright test**

```bash
npx playwright test tests/e2e/agent-spec-plan-download.spec.js 2>&1 | tail -10
```

Expected: test passes, OR skips with "Fixture not found" if Playwright isn't configured.

- [ ] **Step 5: Commit**

```bash
git add tests/e2e/agent-spec-plan-download.spec.js tests/e2e/fixtures/pending-approvals-fixture.html
git commit -m "test(US-0181): Playwright E2E smoke for flag-file download"
```

---

### Task 21: Manual smoke procedure documentation

**Files:**

- Create: `docs/test-procedures/agent-spec-plan-smoke.md`

Document the manual end-to-end smoke checklist for verifying the orchestration engine with real Claude agents.

- [ ] **Step 1: Create the directory and procedure document**

```bash
mkdir -p docs/test-procedures
```

Create `docs/test-procedures/agent-spec-plan-smoke.md`:

````markdown
# US-0181 Manual Smoke Test Procedure

End-to-end manual test for the Pre-Dispatch Spec & Plan Orchestration engine with real Claude agents.

**Prerequisites:**

- `feature/US-0181-pre-dispatch-orchestration` branch checked out (or merged to develop)
- Optional: superpowers plugin installed
- Test story added to `docs/RELEASE_PLAN.md` (e.g. `US-9999 — Smoke test story`)

## Procedure

### 1. Setup

```bash
node tools/agent-spec-plan.js status --story US-9999  # confirm story exists, no orchestration state yet
```
````

### 2. Start spec phase

Tell DM_AGENT: "Start spec phase for US-9999"

DM_AGENT should:

- Call `node tools/agent-spec-plan.js spec-start --story US-9999`
- Spawn Compass (logged via `agent-start`)
- Compass invokes brainstorming (skill if installed, otherwise manual dialogue)
- Compass writes ACs to `docs/superpowers/specs/<date>-us-9999-design.md`
- Compass sets `uiSurface` via `spec-update`
- Compass calls `spec-await-ac` → exit 2 → orchestration pauses

**Verify:**

- `node tools/agent-spec-plan.js status --story US-9999` shows `specPhase.state: awaiting_ac_approval`
- Dashboard "Pending Approvals" widget shows US-9999 AC review row

### 3. Approve ACs (try CLI fast-path)

```bash
node tools/agent-spec-plan.js approve --story US-9999 --gate ac
```

**Verify:**

- `acApprovedAt` is now set; `specPhase.state: in_progress`

### 4. Continue spec phase

DM_AGENT should:

- If uiSurface: spawn Palette → spawn Pixel (interactive mockup)
- Spawn Keystone (technical design)
- Spawn Lens for spec review with structured findings template

**If Lens emits REQUEST_CHANGES:**

- DM_AGENT parses findings, routes by `@persona` primary tag
- Re-engages owner to fix
- Re-spawns Lens
- Loops until APPROVED OR cap (3) reached

**If APPROVED:**

- DM_AGENT calls `spec-await-final` → exit 2

### 5. Approve final spec (try dashboard path)

- Open `docs/plan-status.html` in browser
- Status tab → Pending Approvals widget → US-9999 row → click "Approve"
- Browser downloads `approve-US-9999-spec.flag`
- Move flag to `docs/pending-approvals/`
- Run `node tools/generate-plan.js` (or `npm run plan`)

**Verify:**

- Flag file is deleted from `docs/pending-approvals/` after apply
- `specPhase.state: approved`
- Dashboard widget no longer shows US-9999 spec row

### 6. Plan phase

DM_AGENT should:

- Call `plan-start --author Keystone`
- Spawn Keystone for plan writing (writing-plans skill or manual)
- Keystone self-reviews
- Spawn Lens for plan review
- Loop on REQUEST_CHANGES (cap 3)
- On APPROVED → `plan-await-approval`

### 7. Approve plan

```bash
node tools/agent-spec-plan.js approve --story US-9999 --gate plan
```

**Verify:**

- `node tools/agent-spec-plan.js list --state ready_for_dispatch`
- US-9999 appears in the list

### 8. Sad path tests

Repeat the procedure with these variants:

- **Spec gap kickback:** during plan phase, have Keystone call `plan-spec-gap --reason "AC missing edge case"`. Verify spec phase reopens and plan resets.
- **Iteration cap:** issue `spec-review-result --verdict REQUEST_CHANGES` 3 times. Verify auto-escalation and exit 1.
- **Rejection:** Approve AC, then reject final spec via `reject --gate spec --reason "scope creep"`. Verify spec returns to `in_progress`.

### 9. Tiered fallback test

- Disable superpowers temporarily: `mv ~/.claude/plugins/cache/claude-plugins-official/superpowers /tmp/sp-disabled`
- Repeat steps 1-7 with manual protocol from PO_AGENT.md and ARCHITECT_AGENT.md
- Verify everything works
- Restore: `mv /tmp/sp-disabled ~/.claude/plugins/cache/claude-plugins-official/superpowers`

## Pass criteria

- Happy path completes: story reaches `ready_for_dispatch`
- Spec gap kickback works
- Iteration cap escalates correctly
- Both CLI and dashboard approval paths work
- With and without superpowers installed
- All flag files are cleaned up after successful application
- Malformed flag files are skipped with logged warnings (not deleted)

````

- [ ] **Step 2: Commit**

```bash
git add docs/test-procedures/agent-spec-plan-smoke.md
git commit -m "docs(US-0181): manual smoke test procedure"
````

---

### Task 22: Final verification — full test suite + dashboard regen

**Files:**

- None (verification only)

- [ ] **Step 1: Run full test suite**

```bash
cd /Users/Kamal_Syed/Projects/PlanVisualizer
npx jest --no-coverage --testPathIgnorePatterns=".claude/worktrees" 2>&1 | tail -5
```

Expected: all tests pass (≥ 940 existing + ~92 new = ~1032 tests).

- [ ] **Step 2: Run coverage check on new modules**

```bash
npx jest --coverage --testPathIgnorePatterns=".claude/worktrees" 2>&1 | grep -E "agent-spec-plan|lens-findings|All files" | head -10
```

Expected:

- `tools/lib/agent-spec-plan-state.js` ≥ 95% coverage
- `tools/lib/agent-spec-plan-flags.js` ≥ 90%
- `tools/agent-spec-plan.js` ≥ 85%
- `tools/lib/lens-findings-parser.js` ≥ 95%
- Overall ≥ 80%

- [ ] **Step 3: Regenerate dashboard end-to-end**

```bash
node tools/generate-plan.js 2>&1 | tail -3
```

Expected: dashboard regenerates cleanly. Open `docs/plan-status.html` in browser, click Status tab — "Pending Approvals" widget visible showing "No pending approvals" if no stories have open gates.

- [ ] **Step 4: Smoke-test happy path manually**

```bash
# Set up a test story
node -e "
const fs = require('fs');
const data = JSON.parse(fs.readFileSync('docs/sdlc-status.json', 'utf8'));
if (!data.stories['US-TEST']) data.stories['US-TEST'] = { status: 'Planned' };
fs.writeFileSync('docs/sdlc-status.json', JSON.stringify(data, null, 2) + '\n');
"

node tools/agent-spec-plan.js spec-start --story US-TEST
node tools/agent-spec-plan.js spec-await-ac --story US-TEST  # exit 2
node tools/agent-spec-plan.js approve --story US-TEST --gate ac
node tools/agent-spec-plan.js spec-review-result --story US-TEST --verdict APPROVED
node tools/agent-spec-plan.js spec-await-final --story US-TEST  # exit 2
node tools/agent-spec-plan.js approve --story US-TEST --gate spec
node tools/agent-spec-plan.js plan-start --story US-TEST --author Keystone
node tools/agent-spec-plan.js plan-review-result --story US-TEST --verdict APPROVED
node tools/agent-spec-plan.js plan-await-approval --story US-TEST  # exit 2
node tools/agent-spec-plan.js approve --story US-TEST --gate plan
node tools/agent-spec-plan.js status --story US-TEST
node tools/agent-spec-plan.js list --state ready_for_dispatch

# Clean up
node -e "
const fs = require('fs');
const data = JSON.parse(fs.readFileSync('docs/sdlc-status.json', 'utf8'));
delete data.stories['US-TEST'];
fs.writeFileSync('docs/sdlc-status.json', JSON.stringify(data, null, 2) + '\n');
"
```

Expected: all commands execute, `list` shows US-TEST in ready_for_dispatch state, cleanup succeeds.

- [ ] **Step 5: Smoke-test dashboard flag download path**

Open `docs/plan-status.html` in browser. Set up a story with an awaiting gate, regenerate dashboard, click Approve button:

```bash
node tools/agent-spec-plan.js spec-start --story US-TEST
node tools/agent-spec-plan.js spec-await-ac --story US-TEST
node tools/generate-plan.js
open docs/plan-status.html  # macOS
# Click Status tab → Pending Approvals → US-TEST → Approve
# Verify: browser downloads approve-US-TEST-ac.flag
# Move to docs/pending-approvals/, run npm run plan
node tools/agent-spec-plan.js status --story US-TEST
# Verify: acApprovedAt is set
```

- [ ] **Step 6: Final commit (if any changes needed during verification)**

If verification surfaced minor issues, fix them and commit. Otherwise no commit needed — Task 21 was the last code commit.

```bash
git log --oneline feature/US-0181-pre-dispatch-orchestration ^develop | wc -l
```

Expected: ~22 commits on the feature branch.

---

## Final Verification Checklist

After all 22 tasks:

- [ ] All test files pass: `npx jest --no-coverage --testPathIgnorePatterns=".claude/worktrees" 2>&1 | tail -3`
- [ ] Coverage ≥ 80% overall, ≥ 90% on new lib modules: `npx jest --coverage --testPathIgnorePatterns=".claude/worktrees" 2>&1 | grep "All files"`
- [ ] Dashboard regenerates: `node tools/generate-plan.js`
- [ ] Pending Approvals widget renders: `grep "pv-pending-approvals" docs/plan-status.html`
- [ ] CLI happy path completes end-to-end (Task 22 Step 4)
- [ ] Dashboard flag download works (Task 22 Step 5)
- [ ] All 6 agent files have the required protocol subsections: `npx jest tests/unit/agent-files-protocol.test.js`
- [ ] Branch ready for PR

If all pass, branch is ready for PR via `superpowers:finishing-a-development-branch`.
