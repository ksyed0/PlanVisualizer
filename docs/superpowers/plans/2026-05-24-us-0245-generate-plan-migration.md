# US-0245 Implementation Plan — `generate-plan.js` Writer Paths Through Repo

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Route every WRITER path in `tools/generate-plan.js` (status patches from the dashboard UI, story-row updates, any markdown mutation) through `repo.stories.update` / `repo.bugs.update` etc. Delete any legacy markdown writes that are no longer needed. The two writes the current file performs (`plan-status.json` + `plan-status.html`) are **generated output**, NOT managed source — they remain as direct `fs.writeFileSync` calls under the EXEMPT allowlist. The migration's real surface area is the patchDOM-driven status writer (the dashboard's "click a story badge to flip its status" affordance, if implemented) and any other dashboard-build-time markdown mutation.

**Architecture:** Audit-and-migrate. Same shape as US-0244. Generated outputs (`docs/plan-status.json`, `docs/plan-status.html`) are explicitly classified as exempt in the hard-gate test because they are not source-of-truth files. Any write to `docs/RELEASE_PLAN.md` / `docs/BUGS.md` / `docs/LESSONS.md` / `docs/TEST_CASES.md` / `docs/ID_REGISTRY.md` / `docs/sdlc-status.json` becomes a `repo.X.*` call. `npm run plan:generate && npm run plan:lint` must report zero errors after migration.

**Tech Stack:** Node ≥20, Jest, existing `tools/lib/repository` (Phase D + US-0240 writer APIs).

---

## File Structure

| File                                                          | Action | Responsibility                                                                            |
| ------------------------------------------------------------- | ------ | ----------------------------------------------------------------------------------------- |
| `tools/generate-plan.js`                                      | Modify | Re-route any managed-path writes through repo. (Generated outputs stay as direct writes.) |
| `tests/integration/generate-plan-grep-managed-writes.test.js` | Create | AC-0957's source-grep gate: no fs.write to managed paths.                                 |
| `tests/integration/dashboard-uses-accessor.test.js`           | Verify | Existing test must continue to pass (read-side regression check).                         |
| `docs/dashboard.html`                                         | Verify | `npm run plan:generate` produces valid HTML; `npm run plan:lint` reports `0/0/0`.         |

---

## Pre-Work

**Dependencies:** US-0240 (writer APIs). Confirm `repo.stories.update` exists:

```bash
grep -n "async update" tools/lib/repository/entities/story-repo.js
```

- [ ] **Pre-Step 1: Branch + commit plan**

```bash
cd /Users/Kamal_Syed/Projects/PlanVisualizer/.claude/worktrees/phase-e-impl
git fetch origin develop --quiet
git checkout -b feature/US-0245-generate-plan-migration origin/develop
git add docs/superpowers/plans/2026-05-24-us-0245-generate-plan-migration.md
git commit -m "docs: US-0245 implementation plan

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>"
```

---

## Task 1: Audit current state

- [ ] **Step 1: Grep for all writes**

```bash
grep -nE "fs\.(write|append)" tools/generate-plan.js
```

Per the EPIC-0040 spec session audit (2026-05-24), the file has two writes:

- L477: `fs.writeFileSync(jsonPath, JSON.stringify(data, null, 2), 'utf8')` — writes `docs/plan-status.json` (generated output, exempt).
- L508: `fs.writeFileSync(htmlPath, html, 'utf8')` — writes `docs/plan-status.html` (generated output, exempt).

If the audit returns ONLY these two, jump to Task 2 (hard-gate test only — no migration needed). If new writes have appeared since 2026-05-24, plan a per-call-site migration as Task 3.

- [ ] **Step 2: Search for status-patch / patchDOM affordances**

Even though the AC mentions "patchDOM-driven status writes", the current `generate-plan.js` may not implement that affordance at all (it's a future dashboard feature). Confirm:

```bash
grep -n "patchDOM\|status.*update\|story.*status" tools/generate-plan.js | head -10
```

If no hits, the AC-0956 surface area doesn't exist yet. Document in the PR body: "AC-0956: no patchDOM writes currently exist in generate-plan.js; the AC is closed as 'no surface area' rather than 'migrated' — the hard-gate test will catch any future regression."

---

## Task 2: Source-grep hard-gate test

**Files:**

- Create: `tests/integration/generate-plan-grep-managed-writes.test.js`

- [ ] **Step 1: Write the test**

```js
'use strict';

const fs = require('fs');
const path = require('path');

const FILE = path.join(__dirname, '..', '..', 'tools', 'generate-plan.js');

// Paths classified as EXEMPT (generated outputs / debug / cache):
const EXEMPT_BASENAME_RES = [
  /plan-status\.(json|html)$/, // generated dashboard outputs
  /\.cache\//,
  /\/tmp\//,
];

// Paths classified as MANAGED (source-of-truth; must go through repo):
const MANAGED_FILENAMES = new Set([
  'RELEASE_PLAN.md',
  'BUGS.md',
  'LESSONS.md',
  'TEST_CASES.md',
  'ID_REGISTRY.md',
  'sdlc-status.json',
]);

describe('US-0245 / AC-0957..0958: generate-plan.js managed-path write gate', () => {
  const source = fs.readFileSync(FILE, 'utf8');

  it('no fs.write/append call targets a known managed file by name', () => {
    // For every fs.write call, capture the FIRST positional arg textually
    // and check it doesn't mention any managed filename string.
    const callRe = /fs\.(writeFileSync|appendFileSync)\s*\(\s*([^,)\s]+)/g;
    const hits = [];
    let m;
    while ((m = callRe.exec(source)) !== null) {
      const arg = m[2];
      const lineNum = source.slice(0, m.index).split('\n').length;
      // For each managed filename, check if it appears LITERALLY in the
      // surrounding 200-char window. Path variables (e.g. `jsonPath`) are
      // resolved by inspecting their definition lines below.
      const ctxStart = Math.max(0, m.index - 200);
      const ctxEnd = Math.min(source.length, m.index + 200);
      const ctx = source.slice(ctxStart, ctxEnd);
      for (const fname of MANAGED_FILENAMES) {
        if (ctx.includes(fname)) {
          hits.push({ line: lineNum, call: m[0], filename: fname });
        }
      }
    }
    if (hits.length > 0) {
      throw new Error(
        `generate-plan.js writes to managed paths directly:\n` +
          hits.map((h) => `  L${h.line}: ${h.call} → mentions ${h.filename}`).join('\n'),
      );
    }
  });

  it('every remaining fs.write call resolves to an EXEMPT path (sanity check)', () => {
    const callRe = /fs\.writeFileSync\s*\(\s*(\w+)/g;
    const varHits = [];
    let m;
    while ((m = callRe.exec(source)) !== null) {
      varHits.push({ varName: m[1], line: source.slice(0, m.index).split('\n').length });
    }
    // Each variable's definition must resolve to an exempt path. Grep for
    // the var-name's assignment line and check against EXEMPT_BASENAME_RES.
    for (const v of varHits) {
      const defRe = new RegExp(`const\\s+${v.varName}\\s*=\\s*[^;]+;`, 'g');
      const defMatch = defRe.exec(source);
      if (!defMatch) continue; // ad-hoc literal, will be caught by test 1
      const defText = defMatch[0];
      const isExempt = EXEMPT_BASENAME_RES.some((re) => re.test(defText));
      expect({ var: v.varName, line: v.line, def: defText, exempt: isExempt }).toMatchObject({ exempt: true });
    }
  });
});
```

- [ ] **Step 2: Run, expect green (per current state)**

```bash
npx jest tests/integration/generate-plan-grep-managed-writes.test.js 2>&1 | tail -6
```

Expected: 2 passed. The current generate-plan.js only writes to `plan-status.json` + `plan-status.html`, both exempt.

If red, Task 3 migrates the offending writes.

- [ ] **Step 3: Commit (if green)**

```bash
git add tests/integration/generate-plan-grep-managed-writes.test.js
git commit -m "[test] US-0245 | E.6: AC-0957 source-grep gate for generate-plan.js

Asserts the only fs.write* calls in tools/generate-plan.js target
generated outputs (plan-status.json/.html) — never a managed source
file. The test reads the file's source, captures every fs.write call's
first positional arg, scans the 200-char context window for any
managed filename literal, and fails on any hit.

Closes AC-0957 (no managed-path writes) + AC-0958 (legacy writes
removed or routed via repo).

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>"
```

---

## Task 3: Re-route managed writes (only if Task 2 red)

If Task 2 surfaces managed writes, follow the US-0244 Task 3 pattern: for each call site, replace `fs.writeFileSync` with the appropriate `repo.X.*` call. Run `tests/integration/dashboard-uses-accessor.test.js` after each replacement.

---

## Task 4: Verify plan:generate + plan:lint still green

- [ ] **Step 1: Run the dashboard build**

```bash
npm run plan:generate 2>&1 | tail -5
```

Expected: success. The generated `docs/plan-status.html` parses cleanly.

- [ ] **Step 2: Run plan:lint**

```bash
npm run plan:lint 2>&1 | tail -5
```

Expected: `0/0/0` errors per AC-0957.

- [ ] **Step 3: Existing dashboard tests still green**

```bash
npx jest tests/integration/dashboard-uses-accessor.test.js 2>&1 | tail -6
```

Expected: pass.

- [ ] **Step 4: Commit any incidental changes**

If steps 1-3 caused incidental file edits (regenerated `docs/dashboard.html`, etc.), commit them:

```bash
git status
git add docs/
git commit -m "[chore] US-0245 | E.6: regenerate dashboard outputs after writer migration

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>"
```

---

## Task 5: Finishing-a-development-branch

- [ ] **Step 1: Full suite + lint + format**

```bash
npx jest --runInBand --silent 2>&1 | tail -4
npm run lint 2>&1 | tail -3
npm run format:check 2>&1 | tail -3
```

- [ ] **Step 2: Hand off**

Announce: "I'm using the finishing-a-development-branch skill to complete this work."

Expected PR title: `feat: US-0245 — generate-plan.js writer paths through repo`.

PR body should note whether AC-0956 was closed as "no surface area" (the patchDOM affordance doesn't exist) or as "migrated" (with line refs).

---

## Self-Review

### Spec coverage

| Spec item                                        | Task                                                   |
| ------------------------------------------------ | ------------------------------------------------------ |
| §4.5 generate-plan.js migration                  | Tasks 1, 3 (conditional)                               |
| AC-0956 patchDOM writes use repo.stories.update  | Task 1 Step 2 — if no surface area, AC closed as "n/a" |
| AC-0957 plan:generate && plan:lint zero errors   | Task 4                                                 |
| AC-0958 legacy writes removed or routed via repo | Task 2 / 3                                             |

### Placeholder scan

No "TBD"/"TODO" tokens. The conditional Task 3 explicitly hinges on Task 2's outcome.

### Type consistency

- `EXEMPT_BASENAME_RES` is `RegExp[]`; `MANAGED_FILENAMES` is `Set<string>`. Both consumed uniformly inside the test's `it` blocks.
- `repo.stories.update(id, fn)` matches US-0240's signature.
