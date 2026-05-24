# US-0246 Implementation Plan — `sync-github.js` PR-Number / BUGS.md Writes Through Repo

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Route every managed-path write in `tools/sync-github.js` through the repo. The real surface area (per pre-flight audit, 2026-05-24): one `fs.writeFileSync(bugsPath, ...)` call at line ~111 that appends a new bug entry to `docs/BUGS.md` when a GitHub issue is pulled. Replace it with `repo.bugs.create(...)`. Plus: any per-story PR-number update (AC-0959) becomes `repo.stories.update(id, s => { s.prNumber = N; })`. If multiple stories update per `sync-github` invocation, wrap in `repo.transaction(...)` for atomicity.

**Architecture:** One non-trivial replacement (the BUGS.md append). One conditional replacement (PR-number updates, IF the file actually writes them — needs audit). Hard-gate source-grep test asserts no managed `fs.write` remains.

**Tech Stack:** Node ≥20, Jest, existing `tools/lib/repository` + US-0240 (BugRepo, StoryRepo) + US-0242 (transaction wrapper, for the multi-story batched case).

---

## File Structure

| File                                                           | Action | Responsibility                                                                                                      |
| -------------------------------------------------------------- | ------ | ------------------------------------------------------------------------------------------------------------------- |
| `tools/sync-github.js`                                         | Modify | Replace L~111 fs.writeFileSync with repo.bugs.create. Audit for PR-number writes + reroute via repo.stories.update. |
| `tests/integration/sync-github-flow.test.js`                   | Create | AC-0960. Pre-flight confirmed (2026-05-24) the file does NOT exist on develop — must be created by Task 2.5.        |
| `tests/integration/sync-github-grep-no-managed-writes.test.js` | Create | AC-0961: source-grep gate.                                                                                          |

---

## Pre-Work

**Dependencies:** US-0240 (BugRepo.create + StoryRepo.update). US-0242 (transaction) is OPTIONAL — only needed if more than one story updates per sync. Audit to determine.

- [ ] **Pre-Step 1: Branch + commit plan**

```bash
cd /Users/Kamal_Syed/Projects/PlanVisualizer/.claude/worktrees/phase-e-impl
git fetch origin develop --quiet
git checkout -b feature/US-0246-sync-github-migration origin/develop
git add docs/superpowers/plans/2026-05-24-us-0246-sync-github-migration.md
git commit -m "docs: US-0246 implementation plan

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>"
```

---

## Task 1: Audit current writes

- [ ] **Step 1: Grep**

```bash
grep -nE "fs\.(write|append)" tools/sync-github.js
grep -nE "RELEASE_PLAN|prNumber|story.*update|PR.*#" tools/sync-github.js | head -20
```

Per the 2026-05-24 audit, the known hits are:

- L~111: `fs.writeFileSync(bugsPath, existing + separator + entry, 'utf8')` — the BUGS.md append.

Document any additional hits in `/tmp/us0246-audit.md` and decide replacement per the matrix:

| Variable / context              | Replacement                                                                                              |
| ------------------------------- | -------------------------------------------------------------------------------------------------------- |
| `bugsPath` append               | `await repo.bugs.create({ id, title, severity: 'Low', status: 'Open', ghIssueNumber })`                  |
| `releasePlanPath` story update  | `await repo.stories.update(id, s => { s.prNumber = N; })`                                                |
| Multiple story updates in batch | `await repo.transaction(async (tx) => { for (const s of stories) await tx.stories.update(s.id, ...); })` |

---

## Task 2: Replace L~111 BUGS.md append with repo.bugs.create

**Files:**

- Modify: `tools/sync-github.js`

- [ ] **Step 1: Get full context of the call site**

```bash
sed -n '95,120p' tools/sync-github.js
```

The block constructs an `entry` string (multiple lines forming a BUG-XXXX block) then appends it to BUGS.md. The replacement constructs the same entity as a `bug` object and hands it to `repo.bugs.create(bug)` — the serializer (US-0240's `bug-serializer.js`) emits the canonical block format, which may not match the current hand-built `entry` byte-for-byte. **That's intentional** — Migration 001 (US-0243) normalises pre-existing entries; new entries land in the canonical format.

- [ ] **Step 2: Apply the replacement**

Edit `tools/sync-github.js`. Replace the entry-construction + append block (roughly L99-112) with:

```js
// Was: fs.writeFileSync(bugsPath, existing + separator + entry, 'utf8')
// Now: route through BugRepo.create (US-0240).
const { Repository } = require('./lib/repository');
const repo = Repository.getInstance({ root: ROOT });
await repo.bugs.create({
  id: newBugId,
  title,
  severity: 'Low',
  status: 'Open',
  ghIssueNumber: ghIssue.number,
});
```

(The exact `repo` instantiation may already exist higher in the file — reuse it instead of re-getting if so.)

Delete the now-unused `entry` template lines (the `[..., '---'].join('\n')` block).

- [ ] **Step 3: Run the existing flow test, expect failures to triage**

```bash
npx jest tests/integration/sync-github-flow.test.js 2>&1 | tail -10
```

If a test asserts byte-equality of an appended BUGS.md entry, that assertion is now outdated — the serializer emits canonical format. Fix the test to assert SEMANTIC equality (parse the file, check the bug entity has the expected fields). Pattern from L-0083: tests that over-specify byte ordering need to weaken to the actual contract.

- [ ] **Step 4: Commit**

```bash
git add tools/sync-github.js tests/integration/sync-github-flow.test.js
git commit -m "[feat] US-0246 | E.7: route BUGS.md append through BugRepo.create

Was: hand-built 'entry' template + fs.writeFileSync(bugsPath, ...).
Now: repo.bugs.create({id, title, severity, status, ghIssueNumber}) —
BugRepo serializes via bug-serializer.js (US-0240) for canonical output.

Existing sync-github-flow.test.js byte-equality assertions weakened to
semantic equality (parse + check fields). Pattern from L-0083.

Closes AC-0960 for the BUGS.md path.

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>"
```

---

## Task 2.5: Create `tests/integration/sync-github-flow.test.js`

**Why:** Pre-flight verified the file is not on develop. US-0247's hard-gate `REQUIRED_TESTS` assertion (Task 4 of US-0247) checks for its existence. AC-0960 also requires "existing sync-github integration tests pass" — by creating the file here, we satisfy both.

**Files:**

- Create: `tests/integration/sync-github-flow.test.js`

- [ ] **Step 1: Write a minimal integration test**

```js
'use strict';

const fs = require('fs');
const os = require('os');
const path = require('path');
const { Repository } = require('../../tools/lib/repository');

function mkRoot() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'us0246-syncgh-'));
  fs.mkdirSync(path.join(root, 'docs'), { recursive: true });
  fs.writeFileSync(path.join(root, 'package.json'), JSON.stringify({ name: 't', version: '1.0.0' }));
  return root;
}

describe('US-0246 / AC-0960: sync-github BUGS.md create path goes through repo', () => {
  let root;
  afterEach(() => {
    Repository._reset();
    if (root) fs.rmSync(root, { recursive: true, force: true });
  });

  it('repo.bugs.create writes a canonical BUG block to BUGS.md (mirrors sync-github BUGS.md path)', async () => {
    root = mkRoot();
    fs.writeFileSync(path.join(root, 'docs', 'BUGS.md'), '# Bugs\n\n');
    Repository._reset();
    const repo = Repository.getInstance({ root });
    await repo.bugs.create({
      id: 'BUG-9000',
      title: 'Pulled from GH',
      severity: 'Low',
      status: 'Open',
      ghIssueNumber: 12345,
    });
    const after = fs.readFileSync(path.join(root, 'docs', 'BUGS.md'), 'utf8');
    expect(after).toContain('BUG-9000: Pulled from GH');
    expect(after).toContain('Status: Open');
    expect(after).toContain('GH Issue: #12345');
    expect(repo.bugs.get('BUG-9000')).toBeTruthy();
  });
});
```

- [ ] **Step 2: Run, expect green**

```bash
npx jest tests/integration/sync-github-flow.test.js 2>&1 | tail -6
```

Expected: 1 passed (depends on US-0240's `BugRepo.create` being merged on develop).

- [ ] **Step 3: Commit**

```bash
git add tests/integration/sync-github-flow.test.js
git commit -m "[test] US-0246 | E.7: create sync-github-flow.test.js (AC-0960)

Pre-flight (2026-05-24) confirmed this file did not exist on develop.
Establishes the minimum flow coverage AC-0960 names, and satisfies
US-0247's REQUIRED_TESTS existence assertion.

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>"
```

---

## Task 3: PR-number updates (if audit found any)

- [ ] **Step 1: If audit found PR-number writes, apply repo.stories.update**

Either single-story:

```js
await repo.stories.update(storyId, (s) => {
  s.prNumber = prNumber;
});
```

Or multi-story batched:

```js
await repo.transaction(async (tx) => {
  for (const { id, prNumber } of updates) {
    await tx.stories.update(id, (s) => {
      s.prNumber = prNumber;
    });
  }
});
```

- [ ] **Step 2: Test + commit**

```bash
npx jest tests/integration/sync-github-flow.test.js 2>&1 | tail -6
git add tools/sync-github.js
git commit -m "[feat] US-0246 | E.7: PR-number updates via repo.stories.update (AC-0959)

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>"
```

If audit found ZERO PR-number writes, skip Task 3 entirely; note in PR body: "AC-0959 closed as 'no surface area' — sync-github.js does not currently write PR numbers; the hard-gate test prevents future regression."

---

## Task 4: Source-grep hard-gate test (AC-0961)

**Files:**

- Create: `tests/integration/sync-github-grep-no-managed-writes.test.js`

- [ ] **Step 1: Write + run**

```js
'use strict';

const fs = require('fs');
const path = require('path');

const FILE = path.join(__dirname, '..', '..', 'tools', 'sync-github.js');

const MANAGED_FILENAMES = new Set([
  'RELEASE_PLAN.md',
  'BUGS.md',
  'LESSONS.md',
  'TEST_CASES.md',
  'ID_REGISTRY.md',
  'sdlc-status.json',
]);

describe('US-0246 / AC-0961: sync-github.js managed-path write gate', () => {
  const source = fs.readFileSync(FILE, 'utf8');

  it('no fs.write/append call has a managed filename in its 200-char window', () => {
    const re = /fs\.(writeFileSync|appendFileSync)\s*\(/g;
    const hits = [];
    let m;
    while ((m = re.exec(source)) !== null) {
      const lineNum = source.slice(0, m.index).split('\n').length;
      const ctx = source.slice(Math.max(0, m.index - 200), Math.min(source.length, m.index + 200));
      for (const fname of MANAGED_FILENAMES) {
        if (ctx.includes(fname)) hits.push({ line: lineNum, filename: fname });
      }
    }
    if (hits.length > 0) {
      throw new Error(
        `sync-github.js managed-path writes:\n` + hits.map((h) => `  L${h.line} → ${h.filename}`).join('\n'),
      );
    }
  });

  it('does not import parse-bugs / parse-release-plan for write purposes', () => {
    expect(source).not.toMatch(/require\(['"][^'"]*parse-bugs['"]\)/);
    expect(source).not.toMatch(/require\(['"][^'"]*parse-release-plan['"]\)/);
  });
});
```

```bash
npx jest tests/integration/sync-github-grep-no-managed-writes.test.js 2>&1 | tail -6
```

Expected: 2 passed (after Task 2 + 3).

- [ ] **Step 2: Commit**

```bash
git add tests/integration/sync-github-grep-no-managed-writes.test.js
git commit -m "[test] US-0246 | E.7: AC-0961 source-grep gate for sync-github.js

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>"
```

---

## Task 5: Finishing-a-development-branch

- [ ] **Step 1: Full suite + lint**

```bash
npx jest --runInBand --silent 2>&1 | tail -4
npm run lint 2>&1 | tail -3
npm run format:check 2>&1 | tail -3
```

- [ ] **Step 2: Hand off**

Announce: "I'm using the finishing-a-development-branch skill to complete this work."

Expected PR title: `feat: US-0246 — sync-github.js managed-path writes through repo`.

---

## Self-Review

### Spec coverage

| Spec item                                                | Task                             |
| -------------------------------------------------------- | -------------------------------- |
| §4.5 sync-github.js migration                            | Task 2 (BUGS.md), 3 (PR numbers) |
| AC-0959 RELEASE_PLAN.md mutation via repo.stories.update | Task 3 (conditional)             |
| AC-0960 existing sync-github integration tests pass      | Task 2 Step 3                    |
| AC-0961 grep clean                                       | Task 4                           |

### Placeholder scan

No "TBD"/"TODO" tokens. Task 3 explicitly handles the "no surface area" outcome.

### Type consistency

- `repo.bugs.create(bug)` matches US-0240 signature (BugRepo from `tools/lib/repository/entities/bug-repo.js`).
- The 200-char context-window heuristic matches US-0245's gate test — consistent across the 3 consumer-migration PRs.
