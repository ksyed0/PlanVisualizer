# Post-C.5 Indexer Hygiene Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Resolve all duplicate-ID data drift in production planning markdown and sweep all 5 remaining indexers with the shared `tryInsert` observability pattern from C.5, so `plan:lint` returns `0/0/0` before Phase D starts.

**Architecture:** Two stories in one PR. US-0257 (data cleanup) lands first because the indexer sweep makes `duplicate-id` a TIER.ERROR — clean data first avoids a broken-CI bisect window. US-0256 then introduces Migration 004 (widening `bugs.status` CHECK to `Open | In Progress | Fixed | Verified | WontFix | Closed`), extracts the C5.2 inline `tryInsert` helper to a shared module at `tools/lib/repository/insert-helper.js`, and sweeps all 5 remaining indexers (`bugs`, `lessons`, `test-cases`, `id-registry`, `sdlc-status`) plus refactors `release-plan-indexer` to use the shared helper.

**Tech Stack:** Node.js, better-sqlite3, Jest

**Spec:** `docs/superpowers/specs/2026-05-21-post-c5-hygiene-design.md`
**Epic:** EPIC-0043
**Stories:** US-0256 (ENH-0003), US-0257 (ENH-0004)

---

## Setup (before starting Task 1)

This plan is executed against a **fresh worktree** branched from `develop` after the spec PR (#1084) merges. Steps reference `<worktree-root>` — substitute the absolute path of the worktree you created. Steps reference `<branch-name>` — substitute the branch you chose (suggested: `claude/post-c5-hygiene-impl` or `feature/post-c5-hygiene-impl`).

```bash
git fetch origin develop && \
  git worktree add /path/to/.claude/worktrees/post-c5-hygiene-impl -b claude/post-c5-hygiene-impl origin/develop && \
  cd /path/to/.claude/worktrees/post-c5-hygiene-impl && \
  npm install
```

The next-available IDs at the time of plan-writing (from `docs/ID_REGISTRY.md`): `EPIC-0043`, `US-0256`, `US-0257`, `AC-0989` (the new ACs in Task 5 are AC-0989 through AC-0995). These may have shifted if other PRs landed in the meantime — re-read `docs/ID_REGISTRY.md` at the start of Task 5 and adjust.

---

## Pre-implementation state of the codebase (verified 2026-05-21)

These statements about the **current** state are confirmed by reading each file — the plan's assumptions depend on them:

- `release-plan-indexer.js` (post-C.5): uses plain `INSERT` + an inline `tryInsert` helper that catches CHECK + PRIMARYKEY/UNIQUE. Task 4 extracts this helper.
- `bugs-indexer.js`: uses plain `INSERT` (NOT `INSERT OR IGNORE`) with a basic `try/catch` that emits a non-canonical `invalid-status` warning code. Task 4 replaces that catch with the shared helper, surfacing `check-rejected` for CHECK and `duplicate-id` for PRIMARYKEY/UNIQUE.
- `lessons-indexer.js`, `test-cases-indexer.js`, `id-registry-indexer.js`, `sdlc-status-indexer.js`: use plain `INSERT` with NO try/catch. Any PRIMARYKEY violation crashes the indexer transaction. Task 4 adds the shared helper wrapping.
- `validation.js` RULES already contains both `check-rejected` (TIER.WARNING, added in C5.2) and `duplicate-id` (TIER.ERROR, pre-existing).
- Bugs table schema (`001_initial_schema.sql`): 5 columns — `id`, `status` with CHECK, `severity`, `source_file`, `source_line`. No FKs from bugs to other tables (but `bug_stories` from Migration 002 references `bugs(id)` — handled by `PRAGMA foreign_keys = OFF` during the rebuild).
- Production data drift: 14 duplicate AC declarations (AC-0150..0153, AC-0334..0343) in `docs/RELEASE_PLAN.md`; 3 duplicate BUG declarations (BUG-0098, BUG-0099, BUG-0100) in `docs/BUGS.md`.

---

## Task 1: Resolve 14 duplicate AC declarations in `docs/RELEASE_PLAN.md` (US-0257 part 1)

**Files:**

- Modify: `docs/RELEASE_PLAN.md`

- [ ] **Step 1: Enumerate the duplicates**

```bash
cd <worktree-root> && grep -n "AC-015[0-3]:\|AC-033[4-9]:\|AC-034[0-3]:" docs/RELEASE_PLAN.md
```

Expected: 28 line hits (14 ACs × 2 occurrences each). Note each occurrence's line number.

- [ ] **Step 2: For each of the 14 AC IDs, diff the two occurrences and decide which to keep**

For each AC ID `X` in `{AC-0150, AC-0151, AC-0152, AC-0153, AC-0334, AC-0335, AC-0336, AC-0337, AC-0338, AC-0339, AC-0340, AC-0341, AC-0342, AC-0343}`:

```bash
cd <worktree-root> && grep -B1 -A1 "${X}:" docs/RELEASE_PLAN.md
```

Read both occurrences. Decision rule:

1. If the two occurrences are textually identical → delete the later one
2. If they differ → keep the one that is more complete or more recent (later wins if it represents refinement)
3. If both look valid in different contexts (e.g. legitimate references in two epics) → STOP and escalate to the user — do not delete either

Delete the loser by editing `docs/RELEASE_PLAN.md` directly. Preserve the surrounding story's formatting (don't leave orphan blank lines).

- [ ] **Step 3: Verify there are no more duplicates in the AC clusters**

```bash
cd <worktree-root> && grep -c "AC-015[0-3]:\|AC-033[4-9]:\|AC-034[0-3]:" docs/RELEASE_PLAN.md
```

Expected: 14 (was 28).

- [ ] **Step 4: Audit RELEASE_PLAN.md for any other duplicate ACs not in the known clusters**

```bash
cd <worktree-root> && grep -oE "AC-[0-9]+" docs/RELEASE_PLAN.md | sort | uniq -d
```

Expected: empty output (no duplicate AC IDs remain).

- [ ] **Step 5: Run plan:lint and confirm AC dedup warnings have dropped**

```bash
cd <worktree-root> && npm run plan:lint 2>&1 | tail -5
```

Expected: `[plan:lint] errors: 0, warnings: 0, reports: 0`. The 14 `duplicate-ac` warnings present before this task should be gone.

- [ ] **Step 6: Run the full test suite to confirm nothing broke**

```bash
cd <worktree-root> && npx jest 2>&1 | tail -5
```

Expected: same pass count as before this task (the dashboard/indexer behaviour is unchanged; only the source markdown changed).

- [ ] **Step 7: Commit**

```bash
cd <worktree-root> && git add docs/RELEASE_PLAN.md && git commit -m "[fix] US-0257: resolve 14 duplicate AC declarations in RELEASE_PLAN.md"
```

---

## Task 2: Resolve 3 duplicate BUG declarations + update BUGS.md format-doc convention (US-0257 part 2)

**Files:**

- Modify: `docs/BUGS.md`

- [ ] **Step 1: Locate the duplicate BUG declarations**

```bash
cd <worktree-root> && grep -n "^BUG-0098:\|^BUG-0099:\|^BUG-0100:" docs/BUGS.md
```

Expected: 6 line hits (3 IDs × 2 occurrences each). Confirmed locations from the audit:

- `BUG-0098`: lines 1221 and 1283
- `BUG-0099`: lines 1236 and 1300
- `BUG-0100`: lines 126 and 1251

Line numbers may have shifted; re-run the grep to get current numbers before editing.

- [ ] **Step 2: For each duplicate BUG ID, diff both occurrences and decide which to keep**

For each of BUG-0098, BUG-0099, BUG-0100:

```bash
cd <worktree-root> && grep -A8 "^${BUG_ID}:" docs/BUGS.md
```

Read both. Decision rule (same as ACs):

1. Identical → delete the later
2. Different → keep the more complete / more recent
3. Both valid in different contexts → STOP and escalate

Delete the loser; preserve surrounding bug-block formatting (each bug entry is followed by a blank line and a `---` separator in BUGS.md style).

- [ ] **Step 3: Update the BUGS.md format-doc convention line**

The format-doc line currently reads:

```
Status: Open | In Progress | Fixed | Verified | Closed
```

Replace with:

```
Status: Open | In Progress | Fixed | Verified | WontFix | Closed
```

This aligns the documented convention with Migration 004's widened CHECK constraint (lands in Task 3).

- [ ] **Step 4: Verify no more duplicate BUG IDs remain**

```bash
cd <worktree-root> && grep -oE "^BUG-[0-9]+" docs/BUGS.md | sort | uniq -d
```

Expected: empty output.

- [ ] **Step 5: Run plan:lint to confirm clean state**

```bash
cd <worktree-root> && npm run plan:lint 2>&1 | tail -5
```

Expected: `[plan:lint] errors: 0, warnings: 0, reports: 0`.

- [ ] **Step 6: Run full suite**

```bash
cd <worktree-root> && npx jest 2>&1 | tail -5
```

Expected: full suite passes; pass count unchanged from Task 1.

- [ ] **Step 7: Commit**

```bash
cd <worktree-root> && git add docs/BUGS.md && git commit -m "[fix] US-0257: resolve 3 duplicate BUG declarations + update format-doc convention"
```

---

## Task 3: Migration 004 + shared `insert-helper` + helper test (US-0256 part 1)

**Files:**

- Create: `tools/lib/repository/migrations/004_bugs_status_widen.sql`
- Create: `tools/lib/repository/insert-helper.js`
- Create: `tests/unit/repository/insert-helper.test.js`
- Modify: `tests/unit/repository/schema.test.js` (bump migration count from 3 to 4 if hardcoded)

- [ ] **Step 1: Write the failing migration test**

Create `tests/unit/repository/migrations/004-bugs-status-widen.test.js`:

```js
'use strict';
const fs = require('fs');
const path = require('path');
const os = require('os');
const { Repository } = require('../../../../tools/lib/repository');

describe('Migration 004: widen bugs.status CHECK', () => {
  let root, repo;

  beforeEach(() => {
    root = fs.mkdtempSync(path.join(os.tmpdir(), 'mig004-'));
    fs.mkdirSync(path.join(root, 'docs'));
    Repository._reset();
    repo = Repository.getInstance({ root });
  });
  afterEach(() => {
    Repository._reset();
    fs.rmSync(root, { recursive: true, force: true });
  });

  test('bugs.status accepts Verified post-migration', () => {
    expect(() =>
      repo.index
        .prepare(
          "INSERT INTO bugs(id,status,severity,source_file,source_line) VALUES('BUG-9999','Verified',NULL,'docs/BUGS.md',NULL)",
        )
        .run(),
    ).not.toThrow();
    expect(repo.index.prepare("SELECT status FROM bugs WHERE id='BUG-9999'").get().status).toBe('Verified');
  });

  test('bugs.status accepts WontFix post-migration', () => {
    expect(() =>
      repo.index
        .prepare(
          "INSERT INTO bugs(id,status,severity,source_file,source_line) VALUES('BUG-9998','WontFix',NULL,'docs/BUGS.md',NULL)",
        )
        .run(),
    ).not.toThrow();
  });

  test('bugs.status accepts Closed post-migration', () => {
    expect(() =>
      repo.index
        .prepare(
          "INSERT INTO bugs(id,status,severity,source_file,source_line) VALUES('BUG-9997','Closed',NULL,'docs/BUGS.md',NULL)",
        )
        .run(),
    ).not.toThrow();
  });

  test('bugs.status still rejects unknown status', () => {
    expect(() =>
      repo.index
        .prepare(
          "INSERT INTO bugs(id,status,severity,source_file,source_line) VALUES('BUG-9996','Cancelled',NULL,'docs/BUGS.md',NULL)",
        )
        .run(),
    ).toThrow(/CHECK constraint failed/);
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

```bash
cd <worktree-root> && npx jest tests/unit/repository/migrations/004-bugs-status-widen.test.js 2>&1 | tail -10
```

Expected: FAIL with `CHECK constraint failed` on the Verified/WontFix/Closed tests.

- [ ] **Step 3: Create Migration 004 SQL**

Create `tools/lib/repository/migrations/004_bugs_status_widen.sql`:

```sql
-- tools/lib/repository/migrations/004_bugs_status_widen.sql
-- Widens bugs.status CHECK to the canonical set:
--   Open | In Progress | Fixed | Verified | WontFix | Closed
-- Drops the previous values Wontfix and Done (no production rows use them).
-- SQLite has no ALTER TABLE ... ALTER CHECK, so we rebuild the table.
-- See ENH-0003 design spec.

PRAGMA foreign_keys = OFF;

CREATE TABLE bugs_new (
  id TEXT PRIMARY KEY,
  status TEXT NOT NULL CHECK (status IN ('Open','In Progress','Fixed','Verified','WontFix','Closed')),
  severity TEXT,
  source_file TEXT NOT NULL,
  source_line INTEGER
);
INSERT INTO bugs_new SELECT * FROM bugs;
DROP TABLE bugs;
ALTER TABLE bugs_new RENAME TO bugs;

PRAGMA foreign_keys = ON;
```

- [ ] **Step 4: Bump migration count in schema.test.js (if hardcoded)**

```bash
cd <worktree-root> && grep -n "toBe(3)" tests/unit/repository/schema.test.js
```

If the grep finds hardcoded assertions on schema version `3`, change each occurrence to `4`. (C5.1 did the same when bumping 2→3.)

If the grep returns nothing, skip this step — the test doesn't hardcode the count.

- [ ] **Step 5: Run the migration test to verify it passes**

```bash
cd <worktree-root> && npx jest tests/unit/repository/migrations/004-bugs-status-widen.test.js 2>&1 | tail -10
```

Expected: PASS (4 tests).

- [ ] **Step 6: Write the failing helper test**

Create `tests/unit/repository/insert-helper.test.js`:

```js
'use strict';
const fs = require('fs');
const path = require('path');
const os = require('os');
const Database = require('better-sqlite3');
const { createTryInsert } = require('../../../tools/lib/repository/insert-helper');

describe('createTryInsert helper', () => {
  let root, db;

  beforeEach(() => {
    root = fs.mkdtempSync(path.join(os.tmpdir(), 'ins-help-'));
    db = new Database(path.join(root, 'test.db'));
    db.exec(
      "CREATE TABLE widgets (id TEXT PRIMARY KEY, kind TEXT NOT NULL CHECK (kind IN ('A','B','C')), label TEXT, UNIQUE(label))",
    );
  });
  afterEach(() => {
    db.close();
    fs.rmSync(root, { recursive: true, force: true });
  });

  test('successful insert returns true and produces no warning', () => {
    const warnings = [];
    const tryInsert = createTryInsert({ warnings });
    const ins = db.prepare('INSERT INTO widgets(id,kind,label) VALUES(?,?,?)');
    const ok = tryInsert(() => ins.run('W-1', 'A', 'first'), 'W-1');
    expect(ok).toBe(true);
    expect(warnings).toEqual([]);
  });

  test('SQLITE_CONSTRAINT_CHECK produces check-rejected warning and returns false', () => {
    const warnings = [];
    const tryInsert = createTryInsert({ warnings });
    const ins = db.prepare('INSERT INTO widgets(id,kind,label) VALUES(?,?,?)');
    const ok = tryInsert(() => ins.run('W-2', 'BAD', 'second'), 'W-2');
    expect(ok).toBe(false);
    expect(warnings).toHaveLength(1);
    expect(warnings[0].code).toBe('check-rejected');
    expect(warnings[0].entityId).toBe('W-2');
    expect(warnings[0].message).toMatch(/CHECK constraint failed/);
  });

  test('SQLITE_CONSTRAINT_PRIMARYKEY produces duplicate-id warning and returns false', () => {
    const warnings = [];
    const tryInsert = createTryInsert({ warnings });
    const ins = db.prepare('INSERT INTO widgets(id,kind,label) VALUES(?,?,?)');
    ins.run('W-3', 'A', 'third');
    const ok = tryInsert(() => ins.run('W-3', 'B', 'third-dup'), 'W-3');
    expect(ok).toBe(false);
    expect(warnings).toHaveLength(1);
    expect(warnings[0].code).toBe('duplicate-id');
    expect(warnings[0].entityId).toBe('W-3');
  });

  test('SQLITE_CONSTRAINT_UNIQUE produces duplicate-id warning and returns false', () => {
    const warnings = [];
    const tryInsert = createTryInsert({ warnings });
    const ins = db.prepare('INSERT INTO widgets(id,kind,label) VALUES(?,?,?)');
    ins.run('W-4', 'A', 'shared-label');
    const ok = tryInsert(() => ins.run('W-5', 'A', 'shared-label'), 'W-5');
    expect(ok).toBe(false);
    expect(warnings).toHaveLength(1);
    expect(warnings[0].code).toBe('duplicate-id');
  });

  test('unexpected errors rethrow', () => {
    const warnings = [];
    const tryInsert = createTryInsert({ warnings });
    const fn = () => {
      const e = new Error('boom');
      e.code = 'SOMETHING_ELSE';
      throw e;
    };
    expect(() => tryInsert(fn, 'X-1')).toThrow(/boom/);
    expect(warnings).toEqual([]);
  });
});
```

- [ ] **Step 7: Run the helper test to verify it fails**

```bash
cd <worktree-root> && npx jest tests/unit/repository/insert-helper.test.js 2>&1 | tail -10
```

Expected: FAIL — module not found (helper doesn't exist yet).

- [ ] **Step 8: Create the shared helper**

Create `tools/lib/repository/insert-helper.js`:

```js
'use strict';

/**
 * Factory returning a `tryInsert(fn, entityId)` closure that wraps a SQLite
 * INSERT call. Catches:
 *   - SQLITE_CONSTRAINT_CHECK     → warnings.push({code: 'check-rejected'})
 *   - SQLITE_CONSTRAINT_PRIMARYKEY → warnings.push({code: 'duplicate-id'})
 *   - SQLITE_CONSTRAINT_UNIQUE     → warnings.push({code: 'duplicate-id'})
 * Rethrows everything else so the indexer's transaction rolls back on
 * unexpected failures.
 *
 * Returns true if the INSERT succeeded; false if a known constraint
 * violation was caught and a warning was logged.
 */
function createTryInsert({ warnings }) {
  return function tryInsert(fn, entityId) {
    try {
      fn();
      return true;
    } catch (e) {
      if (e.code === 'SQLITE_CONSTRAINT_CHECK') {
        warnings.push({ code: 'check-rejected', entityId, message: e.message });
        return false;
      }
      if (e.code === 'SQLITE_CONSTRAINT_PRIMARYKEY' || e.code === 'SQLITE_CONSTRAINT_UNIQUE') {
        warnings.push({ code: 'duplicate-id', entityId, message: `Duplicate entity skipped: ${entityId}` });
        return false;
      }
      throw e;
    }
  };
}

module.exports = { createTryInsert };
```

- [ ] **Step 9: Run the helper test to verify it passes**

```bash
cd <worktree-root> && npx jest tests/unit/repository/insert-helper.test.js 2>&1 | tail -10
```

Expected: PASS — 5 tests.

- [ ] **Step 10: Run the full repository suite to confirm no regressions**

```bash
cd <worktree-root> && npx jest tests/unit/repository/ 2>&1 | tail -5
```

Expected: PASS — all previous tests still green, plus the new 4 migration tests and 5 helper tests.

- [ ] **Step 11: Commit**

```bash
cd <worktree-root> && \
  git add tools/lib/repository/migrations/004_bugs_status_widen.sql tools/lib/repository/insert-helper.js tests/unit/repository/migrations/004-bugs-status-widen.test.js tests/unit/repository/insert-helper.test.js tests/unit/repository/schema.test.js 2>&1 && \
  git commit -m "[feat] US-0256: Migration 004 widens bugs.status CHECK + shared insert-helper"
```

If `tests/unit/repository/schema.test.js` was not modified in Step 4, drop it from the `git add` line.

---

## Task 4: Sweep all 5 remaining indexers via shared helper + refactor `release-plan-indexer` (US-0256 part 2)

**Files:**

- Modify: `tools/lib/repository/indexers/release-plan-indexer.js` (use shared helper)
- Modify: `tools/lib/repository/indexers/bugs-indexer.js` (replace inline `invalid-status` catch with shared helper)
- Modify: `tools/lib/repository/indexers/lessons-indexer.js` (wrap INSERTs with shared helper)
- Modify: `tools/lib/repository/indexers/test-cases-indexer.js` (same)
- Modify: `tools/lib/repository/indexers/id-registry-indexer.js` (same)
- Modify: `tools/lib/repository/indexers/sdlc-status-indexer.js` (same)

- [ ] **Step 1: Refactor `release-plan-indexer.js` to use the shared helper**

Find the inline `tryInsert` declaration inside the `index.transaction(() => {...})` callback in `tools/lib/repository/indexers/release-plan-indexer.js`. It currently looks like:

```js
const tryInsert = (fn, entityId) => {
  try {
    fn();
    return true;
  } catch (e) {
    if (e.code === 'SQLITE_CONSTRAINT_CHECK') {
      warnings.push({ code: 'check-rejected', entityId, message: e.message });
      return false;
    }
    throw e;
  }
};
```

Delete that block entirely. At the top of the file (after the existing requires), add:

```js
const { createTryInsert } = require('../insert-helper');
```

Inside the transaction callback, replace the deleted inline declaration with:

```js
const tryInsert = createTryInsert({ warnings });
```

The call sites (`tryInsert(() => insXXX.run(...), entityId)`) remain unchanged.

- [ ] **Step 2: Run the release-plan-indexer tests to confirm the refactor didn't break anything**

```bash
cd <worktree-root> && npx jest tests/unit/repository/indexers/release-plan-indexer-rewrite.test.js tests/unit/repository/entities-read.test.js tests/integration/dashboard-parity.test.js 2>&1 | tail -10
```

Expected: PASS — all existing tests still green.

Note: a SIDE EFFECT of this refactor is that the helper now ALSO catches `SQLITE_CONSTRAINT_PRIMARYKEY` and `SQLITE_CONSTRAINT_UNIQUE`. The current `release-plan-indexer` should never trigger those (parseReleasePlan dedups upstream), but if any latent issue exists in production data, it will now surface as `duplicate-id` warnings on the next `plan:lint` run. Run `plan:lint` after this step:

```bash
cd <worktree-root> && npm run plan:lint 2>&1 | tail -5
```

Expected: `[plan:lint] errors: 0, warnings: 0, reports: 0`. If `duplicate-id` errors surface for release-plan entities, STOP and investigate before proceeding.

- [ ] **Step 3: Replace `bugs-indexer.js` body with the shared-helper version**

Open `tools/lib/repository/indexers/bugs-indexer.js`. Replace the entire file contents with:

```js
'use strict';
const fs = require('fs');
const { createTryInsert } = require('../insert-helper');

const BUG_HEAD = /^BUG-(\d+):\s*(.+)$/m;
const KV = /^(\w[\w\s]*?):\s*(.+)$/;

function indexBugs({ index, markdown, rel }) {
  if (!fs.existsSync(markdown.absolute(rel))) return { counts: {}, warnings: [] };
  const ast = markdown.readAst(rel);
  const warnings = [];
  let count = 0;
  index.transaction(() => {
    index.exec('DELETE FROM bugs; DELETE FROM bug_stories;');
    const ins = index.prepare('INSERT INTO bugs(id,status,severity,source_file,source_line) VALUES(?,?,?,?,?)');
    const tryInsert = createTryInsert({ warnings });
    let line = 1;
    for (const node of ast) {
      if (node.kind === 'prose') {
        line += (node.text.match(/\n/g) || []).length;
        continue;
      }
      const m = node.body.match(BUG_HEAD);
      if (m) {
        const id = `BUG-${m[1]}`;
        const kv = {};
        for (const ln of node.body.split('\n')) {
          const kvm = ln.match(KV);
          if (kvm) kv[kvm[1].trim()] = kvm[2].trim();
        }
        const status = kv.Status || 'Open';
        const severity = kv.Severity || null;
        if (tryInsert(() => ins.run(id, status, severity, rel, line), id)) {
          count++;
        }
      }
      line += (node.raw.match(/\n/g) || []).length;
    }
  });
  return { counts: { bugs: count }, warnings };
}
module.exports = { indexBugs };
```

The change: removed the inline `try/catch` that emitted `invalid-status`; replaced with the shared helper. CHECK violations now surface as `check-rejected` (consistent with C.5); duplicate BUG IDs surface as `duplicate-id`.

- [ ] **Step 4: Replace `lessons-indexer.js` INSERTs to use the helper**

Open `tools/lib/repository/indexers/lessons-indexer.js`. Replace the entire file contents with:

```js
'use strict';
const fs = require('fs');
const { createTryInsert } = require('../insert-helper');

const HEAD = /^L-(\d+):\s*(.+)$/m;
const AGENT_TAG = /@agent:(\w+)/g;

function indexLessons({ index, markdown, rel }) {
  if (!fs.existsSync(markdown.absolute(rel))) return { counts: {}, warnings: [] };
  const ast = markdown.readAst(rel);
  const warnings = [];
  let count = 0;
  index.transaction(() => {
    index.exec('DELETE FROM lessons; DELETE FROM lesson_agents;');
    const insL = index.prepare('INSERT INTO lessons(id,text,source_file,source_line) VALUES(?,?,?,?)');
    const insA = index.prepare('INSERT INTO lesson_agents(lesson_id,agent_name) VALUES(?,?)');
    const tryInsert = createTryInsert({ warnings });
    let line = 1;
    for (const node of ast) {
      if (node.kind === 'prose') {
        line += (node.text.match(/\n/g) || []).length;
        continue;
      }
      const m = node.body.match(HEAD);
      if (m) {
        const id = `L-${m[1]}`;
        if (tryInsert(() => insL.run(id, node.body, rel, line), id)) {
          count++;
          const agents = new Set();
          let tagMatch;
          AGENT_TAG.lastIndex = 0;
          while ((tagMatch = AGENT_TAG.exec(node.body)) !== null) agents.add(tagMatch[1]);
          for (const a of agents) tryInsert(() => insA.run(id, a), `${id}@${a}`);
        }
      }
      line += (node.raw.match(/\n/g) || []).length;
    }
  });
  return { counts: { lessons: count }, warnings };
}
module.exports = { indexLessons };
```

Notes:

- The return value now includes `warnings` (previously hardcoded to `[]`).
- The agent-tag INSERT also goes through the helper so duplicate `(lesson_id, agent_name)` pairs surface as warnings rather than crashing the transaction.

- [ ] **Step 5: Replace `test-cases-indexer.js` INSERTs to use the helper**

Open `tools/lib/repository/indexers/test-cases-indexer.js`. Replace the entire file contents with:

```js
'use strict';
const fs = require('fs');
const { createTryInsert } = require('../insert-helper');

const HEAD = /^TC-(\d+)\s+\(US-(\d+)\):\s*(.+)$/m;
const KV = /^(\w[\w\s]*?):\s*(.+)$/;

function indexTestCases({ index, markdown, rel }) {
  if (!fs.existsSync(markdown.absolute(rel))) return { counts: {}, warnings: [] };
  const ast = markdown.readAst(rel);
  const warnings = [];
  let count = 0;
  index.transaction(() => {
    index.exec('DELETE FROM test_cases;');
    const ins = index.prepare('INSERT INTO test_cases(id,story_id,title,status) VALUES(?,?,?,?)');
    const tryInsert = createTryInsert({ warnings });
    for (const node of ast) {
      if (node.kind !== 'fenced') continue;
      const m = node.body.match(HEAD);
      if (m) {
        const id = `TC-${m[1]}`;
        const kv = {};
        for (const ln of node.body.split('\n')) {
          const kvm = ln.match(KV);
          if (kvm) kv[kvm[1].trim()] = kvm[2].trim();
        }
        if (tryInsert(() => ins.run(id, `US-${m[2]}`, m[3], kv.Status || null), id)) {
          count++;
        }
      }
    }
  });
  return { counts: { test_cases: count }, warnings };
}
module.exports = { indexTestCases };
```

- [ ] **Step 6: Replace `id-registry-indexer.js` INSERTs to use the helper**

Open `tools/lib/repository/indexers/id-registry-indexer.js`. Replace the entire file contents with:

```js
'use strict';
const fs = require('fs');
const { createTryInsert } = require('../insert-helper');

const ROW = /^\|\s*(\w+)\s*\|\s*([\w-]+)\s*\|\s*([\w-]+)\s*\|/;

function indexIdRegistry({ index, markdown, rel }) {
  if (!fs.existsSync(markdown.absolute(rel))) return { counts: { id_registry: 0 }, warnings: [] };
  const src = fs.readFileSync(markdown.absolute(rel), 'utf8');
  const warnings = [];
  let count = 0;
  index.transaction(() => {
    index.exec('DELETE FROM id_registry;');
    const ins = index.prepare('INSERT INTO id_registry(sequence,next_id,last_assigned) VALUES(?,?,?)');
    const tryInsert = createTryInsert({ warnings });
    for (const line of src.split('\n')) {
      const m = line.match(ROW);
      if (m && m[1] !== 'Sequence' && m[1] !== '------------') {
        if (tryInsert(() => ins.run(m[1], m[2], m[3]), m[1])) {
          count++;
        }
      }
    }
  });
  return { counts: { id_registry: count }, warnings };
}
module.exports = { indexIdRegistry };
```

- [ ] **Step 7: Replace `sdlc-status-indexer.js` INSERTs to use the helper**

Open `tools/lib/repository/indexers/sdlc-status-indexer.js`. Replace the entire file contents with:

```js
'use strict';
const fs = require('fs');
const { createTryInsert } = require('../insert-helper');

// Note: Phase D (EPIC-0039) replaces this indexer when SQLite becomes authoritative
// for sdlc-status. The shared-helper wrapping added here is preserved or improved
// in that rewrite, not discarded.
function indexSdlcStatusJson({ index, markdown, rel }) {
  const abs = markdown.absolute(rel);
  if (!fs.existsSync(abs)) return { counts: {}, warnings: [] };
  const data = JSON.parse(fs.readFileSync(abs, 'utf8'));
  const warnings = [];
  let taskCount = 0,
    eventCount = 0;
  index.transaction(() => {
    index.exec('DELETE FROM sdlc_tasks; DELETE FROM sdlc_events; DELETE FROM sdlc_programme;');
    const insTask = index.prepare(
      'INSERT INTO sdlc_tasks(id,story_id,agent,status,started_at,completed_at,plan_task_index,summary,model,model_rationale,task_review_json,base_sha,head_sha) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?)',
    );
    const insEvent = index.prepare('INSERT INTO sdlc_events(ts,kind,story_id,agent,payload_json) VALUES(?,?,?,?,?)');
    const insProg = index.prepare('INSERT INTO sdlc_programme(key,value_json) VALUES(?,?)');
    const tryInsert = createTryInsert({ warnings });
    for (const t of data.tasks || []) {
      if (
        tryInsert(
          () =>
            insTask.run(
              t.id,
              t.storyId || null,
              t.agent || null,
              t.status || null,
              t.startedAt || null,
              t.completedAt || null,
              t.planTaskIndex || null,
              t.summary || null,
              t.model || null,
              t.modelRationale || null,
              t.taskReview ? JSON.stringify(t.taskReview) : null,
              t.baseSha || null,
              t.headSha || null,
            ),
          t.id,
        )
      ) {
        taskCount++;
      }
    }
    for (const e of data.log || []) {
      const ts = e.ts || Date.now();
      const kind = e.kind || 'unknown';
      if (
        tryInsert(() => insEvent.run(ts, kind, e.storyId || null, e.agent || null, JSON.stringify(e)), `${kind}@${ts}`)
      ) {
        eventCount++;
      }
    }
    if (data.programme) {
      for (const [k, v] of Object.entries(data.programme)) {
        tryInsert(() => insProg.run(k, JSON.stringify(v)), k);
      }
    }
  });
  return { counts: { sdlc_tasks: taskCount, sdlc_events: eventCount }, warnings };
}
module.exports = { indexSdlcStatusJson };
```

- [ ] **Step 8: Run the full indexer test suite to confirm no regressions**

```bash
cd <worktree-root> && npx jest tests/unit/repository/indexers/ tests/unit/repository/entities-read.test.js tests/unit/repository/migrations/ tests/unit/repository/insert-helper.test.js 2>&1 | tail -10
```

Expected: PASS.

- [ ] **Step 9: Run plan:lint to confirm the swept indexers produce 0/0/0**

```bash
cd <worktree-root> && npm run plan:lint 2>&1 | tail -5
```

Expected: `[plan:lint] errors: 0, warnings: 0, reports: 0`.

If any `duplicate-id` errors surface, STOP — this indicates additional production data drift not caught by the pre-implementation audit. Either (a) resolve the new duplicates in this PR (extending Tasks 1-2's scope), or (b) escalate to the user.

- [ ] **Step 10: Run the integration parity test**

```bash
cd <worktree-root> && npx jest tests/integration/dashboard-parity.test.js 2>&1 | tail -5
```

Expected: PASS.

- [ ] **Step 11: Run the full suite**

```bash
cd <worktree-root> && npx jest 2>&1 | tail -5
```

Expected: PASS.

- [ ] **Step 12: Commit**

```bash
cd <worktree-root> && \
  git add tools/lib/repository/indexers/release-plan-indexer.js tools/lib/repository/indexers/bugs-indexer.js tools/lib/repository/indexers/lessons-indexer.js tools/lib/repository/indexers/test-cases-indexer.js tools/lib/repository/indexers/id-registry-indexer.js tools/lib/repository/indexers/sdlc-status-indexer.js && \
  git commit -m "[feat] US-0256: sweep all indexers via shared insert-helper"
```

---

## Task 5: Session 55 close + PR

**Files:**

- Modify: `docs/RELEASE_PLAN.md` (tick ACs, mark stories Done, mark EPIC-0043 Done)
- Modify: `docs/ENHANCEMENTS.md` (Resolution postscripts on ENH-0003 and ENH-0004)
- Create: `docs/memory/sessions/2026-05-21-session-55-post-c5-hygiene-complete.md`
- Modify: `MEMORY.md` (prepend Session 55 link)
- Modify: `PROMPT_LOG.md` (append Session 55 block)
- Modify: `progress.md` (append Session 55 section)
- Modify: `docs/AI_COST_LOG.md` if accumulated rows exist

- [ ] **Step 1: Tick ACs and mark stories Done in RELEASE_PLAN.md**

In `docs/RELEASE_PLAN.md`:

1. Find the EPIC-0043 fenced block (search for `EPIC-0043:`). Change `Status: To Do` to `Status: Done`.
2. Find US-0256 fenced block. Change `Status: To Do` to `Status: Done`. Tick its ACs (AC-XXXX-EEEE format — replace `- [ ]` with `- [x]` for each).
3. Find US-0257 fenced block. Change `Status: To Do` to `Status: Done`. Tick its ACs.

If EPIC-0043 / US-0256 / US-0257 do not yet exist in `docs/RELEASE_PLAN.md` (depends on whether they were added when ENH-0003/0004 were filed), CREATE them as part of this step. Allocate the next available IDs from `docs/ID_REGISTRY.md` — current state per Session 54 should be `EPIC-0043`, `US-0256`, `US-0257`. Bump the registry's "Next Available ID" / "Last Assigned" cells accordingly.

Each story should have 3-4 ACs covering its work. Use these:

For US-0256:

- AC-XXXX: Migration 004 widens `bugs.status` CHECK to accept `Verified`, `WontFix`, `Closed`; existing rows preserved
- AC-XXXX: Shared `createTryInsert` helper exists at `tools/lib/repository/insert-helper.js` with dedicated unit test
- AC-XXXX: All 6 indexers (release-plan + bugs + lessons + test-cases + id-registry + sdlc-status) wrap INSERTs via the shared helper; CHECK + PRIMARYKEY/UNIQUE violations surface as warnings
- AC-XXXX: `docs/BUGS.md` format-doc convention line lists the new canonical status set

For US-0257:

- AC-XXXX: 14 duplicate AC declarations (AC-0150..0153, AC-0334..0343) resolved in `docs/RELEASE_PLAN.md` via diff-each-pair
- AC-XXXX: 3 duplicate BUG declarations (BUG-0098, BUG-0099, BUG-0100) resolved in `docs/BUGS.md`
- AC-XXXX: `plan:lint` returns `errors: 0, warnings: 0, reports: 0` on production data

- [ ] **Step 2: Add Resolution postscripts to ENH-0003 and ENH-0004 in ENHANCEMENTS.md**

In `docs/ENHANCEMENTS.md`, find the ENH-0003 entry. After its existing **Reference:** line, add a new paragraph:

```
**Resolved (2026-05-21, Session 55):** Migration 004 widened `bugs.status` CHECK to `Open | In Progress | Fixed | Verified | WontFix | Closed`. All 6 indexers (release-plan + bugs + lessons + test-cases + id-registry + sdlc-status) wrap INSERTs via the shared `createTryInsert` helper at `tools/lib/repository/insert-helper.js`. CHECK violations surface as `check-rejected` warnings; duplicate IDs surface as `duplicate-id` errors. `plan:lint` returns `0/0/0` post-cleanup.
```

Similarly for ENH-0004:

```
**Resolved (2026-05-21, Session 55):** 14 duplicate AC declarations and 3 duplicate BUG declarations resolved by diff-each-pair manual review. `plan:lint` returns `0/0/0`.
```

- [ ] **Step 3: Create the Session 55 memory file**

Create `docs/memory/sessions/2026-05-21-session-55-post-c5-hygiene-complete.md`. Use `docs/memory/sessions/2026-05-21-session-54-phase-c5-complete.md` as template. Sections:

- **Summary** — 2-3 sentences: EPIC-0043 shipped; ENH-0003 + ENH-0004 resolved; `plan:lint` at `0/0/0`; Phase D unblocked.
- **What shipped** — table of the 5 commits with SHAs, story, files.
- **Hard gate** — `plan:lint` 0/0/0 confirmed.
- **Tests** — counts before/after.
- **Deferred** — note that Phase D plan doc still says "Migration 002 ingests JSON" — it's actually Migration 005 post-this-PR.
- **Next session** — Phase D start (EPIC-0039).

- [ ] **Step 4: Prepend the Session 55 link to MEMORY.md**

In `MEMORY.md`, find the `## Sessions` list and prepend:

```
- ◐ [Session 55 — Post-C.5 Indexer Hygiene (EPIC-0043 Done, ENH-0003/0004 resolved)](docs/memory/sessions/2026-05-21-session-55-post-c5-hygiene-complete.md) · 2026-05-21
```

- [ ] **Step 5: Append the Session 55 block to PROMPT_LOG.md**

Append a new Session 55 block to `PROMPT_LOG.md`. Use today's date (`2026-05-21`). The user's prompts in this session (Session 55) in chronological order were:

1. `should we put ENH-0003 and 0004 into planning for Phase D? What is ENH-0001 and 0002`
2. `OK lets do brainstorming for ENH-0003 and 0004`
3. `In this context what is the difference between Verified and Fixed`
4. `full sweep`
5. `what do you think` (multiple times during section reviews)
6. `continue`
7. `proceed`

Use the same format as the existing Session 54 entries.

- [ ] **Step 6: Append the Session 55 entry to progress.md**

Append a new Session 55 section to `progress.md`. Cover: what was done (Tasks 1-4 summary), `plan:lint` final state, test counts, blockers (none), PR URL.

- [ ] **Step 7: Sync AI_COST_LOG.md if needed**

```bash
cd <worktree-root> && git status docs/AI_COST_LOG.md
```

If untracked changes exist: include in this commit. If clean: skip.

- [ ] **Step 8: Run plan:lint one final time**

```bash
cd <worktree-root> && npm run plan:lint 2>&1 | tail -3
```

Expected: `[plan:lint] errors: 0, warnings: 0, reports: 0`.

- [ ] **Step 9: Run the full test suite one final time**

```bash
cd <worktree-root> && npx jest 2>&1 | tail -5
```

Expected: PASS.

- [ ] **Step 10: Commit**

```bash
cd <worktree-root> && \
  git add docs/RELEASE_PLAN.md docs/ENHANCEMENTS.md docs/memory/sessions/2026-05-21-session-55-post-c5-hygiene-complete.md MEMORY.md PROMPT_LOG.md progress.md docs/ID_REGISTRY.md docs/AI_COST_LOG.md 2>/dev/null && \
  git commit -m "docs: Session 55 close — Post-C.5 hygiene complete (EPIC-0043)"
```

- [ ] **Step 11: Push and open PR**

```bash
cd <worktree-root> && \
  git push -u origin <branch-name>
```

Then `gh pr create --base develop --head <branch-name> --title "feat: Post-C.5 Indexer Hygiene (EPIC-0043) — ENH-0003 + ENH-0004"` with a body summarizing the 5 commits, the hard gate result (`plan:lint` 0/0/0), and the Phase D-unblock impact.

Watch CI; fix any failures; merge when green.
