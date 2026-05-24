# US-0244 Implementation Plan — `agent-context.js` Managed-Path Writes Through Repo

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Route every managed-path write in `tools/agent-context.js` through the Phase D repo API (`repo.sdlcTasks.upsert`, `repo.sdlcProgramme.set`, etc.) and prove via a hard-gate test that no `fs.write` or `fs.append` to a managed path remains in the file. Phase D already migrated most writes; US-0244 is the audit-and-close pass.

**Architecture:** Audit-then-migrate. Find every `fs.writeFileSync` / `fs.appendFileSync` in `agent-context.js`, classify each call site as **managed** (touches `docs/sdlc-status.json`, `docs/RELEASE_PLAN.md`, `docs/BUGS.md`, `docs/LESSONS.md`, `docs/TEST_CASES.md`, or `docs/ID_REGISTRY.md`) or **exempt** (logs, debug output, temp files). Reroute every managed call through the repo. Add a source-grep hard-gate test that asserts the file has zero managed `fs.write`s (allowlist for the exempt paths). Run the existing `tests/integration/agent-context-flow.test.js` to ensure no regression.

**Tech Stack:** Node ≥20, Jest, existing `tools/lib/repository` (Phase D Sdlc\* repos).

---

## File Structure

| File                                                            | Action | Responsibility                                                                                              |
| --------------------------------------------------------------- | ------ | ----------------------------------------------------------------------------------------------------------- |
| `tools/agent-context.js`                                        | Modify | Re-route any remaining managed-path writes through repo. (Audit may reveal zero — that's the success case.) |
| `tests/integration/agent-context-grep-no-direct-writes.test.js` | Create | AC-0955: source-grep gate on `tools/agent-context.js`.                                                      |
| `tests/integration/agent-context-flow.test.js`                  | Verify | AC-0954: existing test must continue to pass.                                                               |

---

## Pre-Work

**Dependencies:** US-0240 (writer APIs). The Phase D writer APIs (`SdlcTaskRepo.upsert`, `SdlcProgrammeRepo.set`) are already on develop from EPIC-0039. US-0244's only new dependency is on US-0240 for any `repo.stories.update` / `repo.bugs.update` calls that turn up in the audit.

- [ ] **Pre-Step 1: Branch + commit plan**

```bash
cd /Users/Kamal_Syed/Projects/PlanVisualizer/.claude/worktrees/phase-e-impl
git fetch origin develop --quiet
git checkout -b feature/US-0244-agent-context-migration origin/develop
git add docs/superpowers/plans/2026-05-24-us-0244-agent-context-migration.md
git commit -m "docs: US-0244 implementation plan

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>"
```

---

## Task 1: Audit current state

**Files:** none (read-only).

- [ ] **Step 1: Grep for all writes in agent-context.js**

```bash
grep -nE "fs\.(write|append)" tools/agent-context.js
```

For each hit, capture:

- Line number.
- Variable holding the path (e.g., `taskSummaryPath`).
- Trace the variable back to its definition. Is the path inside `docs/`? Is it one of the 6 managed files?

Document findings in a scratch `/tmp/us0244-audit.md`:

```markdown
# agent-context.js fs.write audit (2026-05-24)

| Line | Call | Path variable | Resolved path | Classification |
| ---- | ---- | ------------- | ------------- | -------------- |
| ...  | ...  | ...           | ...           | managed/exempt |
```

- [ ] **Step 2: Decide migration scope**

Based on the audit:

- **Outcome A — zero managed writes:** the file is already compliant. Skip to Task 2 (just add the hard-gate test).
- **Outcome B — N managed writes:** plan a one-task-per-call-site migration in Task 3.

---

## Task 2: Hard-gate source-grep test (AC-0955)

**Files:**

- Create: `tests/integration/agent-context-grep-no-direct-writes.test.js`

- [ ] **Step 1: Write the test**

```js
'use strict';

/**
 * US-0244 / AC-0955: tools/agent-context.js must not have any direct
 * fs.write / fs.append to managed paths. Allowed:
 *   - writes to /tmp/* (debug output)
 *   - writes where the resolved path is in the AGENT_CONTEXT_EXEMPT list
 */

const fs = require('fs');
const path = require('path');

const FILE = path.join(__dirname, '..', '..', 'tools', 'agent-context.js');

describe('US-0244 / AC-0955: agent-context.js managed-path write gate', () => {
  const source = fs.readFileSync(FILE, 'utf8');

  it('no fs.writeFileSync or fs.appendFileSync targets a managed path', () => {
    // Match `fs.writeFileSync(arg1, ...)` and `fs.appendFileSync(arg1, ...)`.
    const re = /fs\.(writeFileSync|appendFileSync)\s*\(\s*([^,)\s]+)/g;
    const hits = [];
    let m;
    while ((m = re.exec(source)) !== null) {
      const arg = m[2];
      // Heuristic allowlist by argument-name. Refine as real usages appear.
      const exemptByName = /(?:^|[._/])(tmp|debug|log|cache|out)/i.test(arg) || /\/tmp\//.test(arg);
      if (!exemptByName) hits.push({ line: source.slice(0, m.index).split('\n').length, call: m[0] });
    }
    // Report any non-exempt hits.
    if (hits.length > 0) {
      throw new Error(
        `agent-context.js still contains ${hits.length} non-exempt fs.write call(s):\n` +
          hits.map((h) => `  L${h.line}: ${h.call}`).join('\n'),
      );
    }
  });

  it('does not import "parse-release-plan" / "parse-bugs" / "parse-lessons" for write purposes', () => {
    // Sanity check: agent-context should READ through repo, not parse +
    // mutate + write raw markdown.
    expect(source).not.toMatch(/require\(['"][^'"]*parse-release-plan['"]\)/);
    expect(source).not.toMatch(/require\(['"][^'"]*parse-bugs['"]\)/);
    expect(source).not.toMatch(/require\(['"][^'"]*parse-lessons['"]\)/);
  });
});
```

- [ ] **Step 2: Run**

```bash
npx jest tests/integration/agent-context-grep-no-direct-writes.test.js 2>&1 | tail -8
```

If Outcome A from Task 1, this should be green immediately. If Outcome B, it surfaces the offending lines; proceed to Task 3.

- [ ] **Step 3: Commit (only if green)**

If green:

```bash
git add tests/integration/agent-context-grep-no-direct-writes.test.js
git commit -m "[test] US-0244 | E.5: AC-0955 source-grep gate for agent-context.js

Asserts no non-exempt fs.write* call targets a managed path in
tools/agent-context.js. The exempt allowlist covers /tmp/*, *.log,
*.cache, debug/tmp/out variable patterns — extend as real usages appear.

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>"
```

If RED, skip the commit and proceed to Task 3.

---

## Task 3: Re-route managed writes through repo (only if Task 1 Outcome B)

**Files:**

- Modify: `tools/agent-context.js`

- [ ] **Step 1: For each call site identified in Task 1, apply the replacement**

Pattern matrix (apply the one that matches the variable name + the file being written):

| Original target                       | Replacement                                                                           |
| ------------------------------------- | ------------------------------------------------------------------------------------- |
| `docs/sdlc-status.json` task          | `await repo.sdlcTasks.upsert({...})` — the upsert triggers the Phase D mirror render. |
| `docs/sdlc-status.json` event         | `await repo.sdlcEvents.append({...})`                                                 |
| `docs/sdlc-status.json` programme key | `await repo.sdlcProgramme.set(key, value)`                                            |
| `docs/RELEASE_PLAN.md` story update   | `await repo.stories.update(id, s => { /* mutate */ })`                                |
| `docs/BUGS.md` bug update             | `await repo.bugs.update(id, b => { /* mutate */ })`                                   |

For each replacement:

1. Verify the call site has access to a `repo` instance. If not, add at function entry: `const { Repository } = require('./lib/repository'); const repo = Repository.getInstance({ root: ROOT });`.
2. Replace the `fs.write*` block with the repo call.
3. Run `tests/integration/agent-context-flow.test.js` after EACH replacement to catch regressions early.

- [ ] **Step 2: Run the flow test**

```bash
npx jest tests/integration/agent-context-flow.test.js 2>&1 | tail -8
```

Expected: pass. If failures appear, fix them inline — they're typically (per L-0085) tests that built fixtures via raw `fs.writeFileSync` and now need to go through the repo too.

- [ ] **Step 3: Run the hard-gate test, expect green now**

```bash
npx jest tests/integration/agent-context-grep-no-direct-writes.test.js 2>&1 | tail -4
```

- [ ] **Step 4: Commit**

```bash
git add tools/agent-context.js tests/integration/agent-context-grep-no-direct-writes.test.js tests/integration/agent-context-flow.test.js
git commit -m "[feat] US-0244 | E.5: route managed-path writes through repo in agent-context.js

[List each call site replaced + its repo equivalent. If Outcome A — no
managed writes existed — say so explicitly and note the hard-gate test
landed on its own.]

Closes AC-0953 (writes use repo.sdlcTasks.upsert etc.), AC-0954
(agent-context-flow.test.js passes), AC-0955 (source-grep clean).

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>"
```

---

## Task 4: Coverage + finishing-a-development-branch

- [ ] **Step 1: Full suite**

```bash
npx jest --runInBand --silent 2>&1 | tail -4
npm run lint 2>&1 | tail -3
npm run format:check 2>&1 | tail -3
```

- [ ] **Step 2: Hand off**

Announce: "I'm using the finishing-a-development-branch skill to complete this work."

Expected PR title: `feat: US-0244 — agent-context.js managed-path writes through repo`.

---

## Self-Review

### Spec coverage

| Spec item                                 | Task          |
| ----------------------------------------- | ------------- |
| §4.5 agent-context.js audit + reroute     | Tasks 1, 3    |
| AC-0953 sdlcTasks.upsert routing          | Task 3        |
| AC-0954 agent-context-flow.test.js passes | Task 3 Step 2 |
| AC-0955 grep clean                        | Task 2        |

### Placeholder scan

No "TBD"/"TODO" tokens. Outcome A / Outcome B branching in Task 1 Step 2 makes the conditional path explicit.

### Type consistency

- `repo.sdlcTasks.upsert(task)` / `repo.sdlcProgramme.set(key, value)` — match the Phase D entity-repo signatures (`tools/lib/repository/entities/sdlc-*-repo.js`).
- The hard-gate regex `/fs\.(writeFileSync|appendFileSync)\s*\(\s*([^,)\s]+)/g` captures only the first positional arg — sufficient for path-variable inspection.
