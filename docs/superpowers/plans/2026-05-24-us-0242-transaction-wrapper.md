# US-0242 Implementation Plan — `repo.transaction((tx) => ...)` with RYOW + Lex-Ordered Locks

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship `repo.transaction(async (tx) => {...})` — a multi-entity, multi-file write wrapper that opens `SQLite BEGIN DEFERRED`, exposes a `tx` proxy whose entity-repo methods stage markdown mutations into a pending list, and at commit acquires every touched file's lock in **lexicographic absolute-path order** via `acquireMany`, flushes the pending mutations, and `COMMIT`s. Read-Your-Own-Writes (RYOW): `tx.X.get(id)` returns the staged value if one exists, else the underlying repo's read. Throw inside the callback → SQLite ROLLBACK + zero file mutations.

**Architecture:** One module (`tools/lib/repository/transaction.js`) exporting the wrapper + a `TxCtx` shape. Each entity repo's `.update` / `.create` accepts a NEW optional `{tx}` parameter; when present, the method routes its write into `ctx.stagedWrites` (for RYOW) + `ctx.pendingFileMutations` (for commit-time flush) and upserts the entity row into SQLite synchronously inside the deferred transaction (so general SQL queries inside the tx see the staged state — spec §3.4 step 2.f).

**Tech Stack:** Node ≥20, Jest, existing `better-sqlite3` transaction support (`db.transaction(fn)` for the synchronous SQLite scope; the wrapper opens the underlying handle's transaction manually so the async callback can interleave with awaited file operations).

---

## File Structure

| File                                                            | Action | Responsibility                                                                                                |
| --------------------------------------------------------------- | ------ | ------------------------------------------------------------------------------------------------------------- |
| `tools/lib/repository/transaction.js`                           | Create | `repo.transaction(fn)` + `TxCtx` factory + tx proxy + commit/rollback protocol.                               |
| `tools/lib/repository/index.js`                                 | Modify | Bind `repo.transaction = transactionFn(this)` in the constructor.                                             |
| `tools/lib/repository/entities/story-repo.js`                   | Modify | `.update(id, fn, opts = {})` + `.create(entity, opts = {})` — if `opts.tx` set, stage instead of commit.      |
| `tools/lib/repository/entities/epic-repo.js`                    | Modify | Same.                                                                                                         |
| `tools/lib/repository/entities/ac-repo.js`                      | Modify | Same.                                                                                                         |
| `tools/lib/repository/entities/bug-repo.js`                     | Modify | Same.                                                                                                         |
| `tools/lib/repository/entities/lesson-repo.js`                  | Modify | Same.                                                                                                         |
| `tools/lib/repository/entities/test-case-repo.js`               | Modify | Same.                                                                                                         |
| `tools/lib/repository/entities/task-repo.js`                    | Modify | Same.                                                                                                         |
| `tools/lib/repository/id-allocator.js`                          | Modify | `.allocate(seq, count, opts = {})` — if `opts.tx` set, reserve in-memory + defer registry mutation to commit. |
| `tests/unit/repository/transaction.test.js`                     | Create | RYOW / rollback / lex-order / multi-entity atomicity / in-tx allocation deferred — 6 unit specs.              |
| `tests/integration/repository/transaction-multi-entity.test.js` | Create | End-to-end: tx that updates a story + creates an AC + allocates a US ID, all visible after commit.            |

---

## Pre-Work

**Dependencies:** US-0240 (writer APIs) AND US-0241 (id-allocator) must both have merged to develop. Verify:

```bash
test -f tools/lib/repository/markdown-mutator.js && echo "US-0240 OK"
test -f tools/lib/repository/id-allocator.js && echo "US-0241 OK"
```

- [ ] **Pre-Step 1: Branch + commit plan**

```bash
cd /Users/Kamal_Syed/Projects/PlanVisualizer/.claude/worktrees/phase-e-impl
git fetch origin develop --quiet
git checkout -b feature/US-0242-transaction-wrapper origin/develop
git add docs/superpowers/plans/2026-05-24-us-0242-transaction-wrapper.md
git commit -m "docs: US-0242 implementation plan

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>"
```

---

## Task 1: `TxCtx` skeleton + `repo.transaction(fn)` happy-path no-op

**Why first:** Land the wiring before any entity opt-in. A tx that does nothing must still BEGIN + COMMIT cleanly.

**Files:**

- Create: `tools/lib/repository/transaction.js`
- Modify: `tools/lib/repository/index.js`
- Create: `tests/unit/repository/transaction.test.js` (first test only)

- [ ] **Step 1: Write the failing test**

Create `tests/unit/repository/transaction.test.js`:

```js
'use strict';

const fs = require('fs');
const os = require('os');
const path = require('path');
const { Repository } = require('../../../tools/lib/repository');

function mkRoot() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'us0242-tx-'));
  fs.mkdirSync(path.join(root, 'docs'), { recursive: true });
  fs.writeFileSync(path.join(root, 'package.json'), JSON.stringify({ name: 't', version: '1.0.0' }));
  return root;
}

describe('US-0242 / AC-0946: repo.transaction wrapper', () => {
  let root;
  afterEach(() => {
    Repository._reset();
    if (root) fs.rmSync(root, { recursive: true, force: true });
  });

  it('empty callback: BEGIN + COMMIT without errors, returns the callback return value', async () => {
    root = mkRoot();
    Repository._reset();
    const repo = Repository.getInstance({ root });
    const result = await repo.transaction(async () => 42);
    expect(result).toBe(42);
  });

  it('tx exposes entity-repo handles for stories/epics/acs/bugs/lessons/testCases/tasks/idRegistry', async () => {
    root = mkRoot();
    Repository._reset();
    const repo = Repository.getInstance({ root });
    await repo.transaction(async (tx) => {
      expect(typeof tx.stories.get).toBe('function');
      expect(typeof tx.stories.update).toBe('function');
      expect(typeof tx.stories.create).toBe('function');
      expect(typeof tx.epics.update).toBe('function');
      expect(typeof tx.acs.update).toBe('function');
      expect(typeof tx.bugs.update).toBe('function');
      expect(typeof tx.lessons.update).toBe('function');
      expect(typeof tx.testCases.update).toBe('function');
      expect(typeof tx.tasks.update).toBe('function');
      expect(typeof tx.idRegistry.allocate).toBe('function');
    });
  });
});
```

- [ ] **Step 2: Run, expect failure**

```bash
npx jest tests/unit/repository/transaction.test.js 2>&1 | tail -4
```

- [ ] **Step 3: Implement skeleton**

Create `tools/lib/repository/transaction.js`:

```js
'use strict';

const { acquireMany } = require('./file-lock');
const fs = require('fs');

/**
 * Build the transaction context — the shared state every tx.X.* call
 * mutates. See spec §3.4 for the field meanings.
 */
function makeCtx() {
  return {
    sqliteTxBegun: false,
    stagedWrites: new Map(), // key: 'story:US-0001' → fullEntity
    pendingFileMutations: [], // [{path, mutator}]
    pendingIdAllocations: new Map(), // sequence → { reservedCount, originalRow }
  };
}

/**
 * Build the tx proxy that the user's callback receives. Each handle is a
 * thin facade around the corresponding repo, with the {tx: ctx} option
 * passed into every write call so the repo routes into staging.
 */
function makeProxy(repo, ctx) {
  // Build a per-entity facade that forwards .get / .update / .create with
  // the {tx} option threaded through.
  const wrap = (under, key) => ({
    get: (id) => {
      // RYOW: if we've staged a write for this id, return that.
      const stagedKey = `${key}:${id}`;
      if (ctx.stagedWrites.has(stagedKey)) return ctx.stagedWrites.get(stagedKey);
      return under.get(id);
    },
    list: under.list ? under.list.bind(under) : undefined,
    update: under.update ? (id, fn) => under.update(id, fn, { tx: ctx }) : undefined,
    create: under.create ? (entity) => under.create(entity, { tx: ctx }) : undefined,
  });

  return {
    stories: wrap(repo.stories, 'story'),
    epics: wrap(repo.epics, 'epic'),
    acs: wrap(repo.acs, 'ac'),
    bugs: wrap(repo.bugs, 'bug'),
    lessons: wrap(repo.lessons, 'lesson'),
    testCases: wrap(repo.testCases, 'testCase'),
    tasks: wrap(repo.tasks, 'task'),
    idRegistry: {
      allocate: (sequence, count = 1) => repo.idRegistry.allocate(sequence, count, { tx: ctx }),
    },
  };
}

/**
 * Bind the transaction wrapper to a Repository instance.
 */
function bindTransaction(repo) {
  return async function transaction(fn) {
    const ctx = makeCtx();
    // BEGIN DEFERRED — no lock held until first write.
    repo.index.exec('BEGIN DEFERRED');
    ctx.sqliteTxBegun = true;
    let result;
    let userError = null;
    try {
      const tx = makeProxy(repo, ctx);
      result = await fn(tx);
    } catch (err) {
      userError = err;
    }
    if (userError) {
      // Roll back SQL; discard staged file mutations (never written).
      try {
        repo.index.exec('ROLLBACK');
      } catch {
        /* ignore */
      }
      ctx.sqliteTxBegun = false;
      throw userError;
    }
    // Commit: group pendingFileMutations by path, acquire lex-ordered
    // locks, apply mutators, write each file, then SQLite COMMIT.
    const paths = [...new Set(ctx.pendingFileMutations.map((m) => m.path))];
    if (paths.length === 0) {
      // Pure-read tx (or no writes staged): just COMMIT.
      repo.index.exec('COMMIT');
      ctx.sqliteTxBegun = false;
      return result;
    }
    let release;
    try {
      release = await acquireMany(paths);
      // For each path, apply its mutator chain in insertion order.
      const byPath = new Map();
      for (const m of ctx.pendingFileMutations) {
        if (!byPath.has(m.path)) byPath.set(m.path, []);
        byPath.get(m.path).push(m.mutator);
      }
      for (const [p, mutators] of byPath) {
        let text = fs.readFileSync(p, 'utf8');
        for (const mut of mutators) text = mut(text);
        const tmp = p + '.tmp';
        fs.writeFileSync(tmp, text);
        fs.renameSync(tmp, p);
      }
      repo.index.exec('COMMIT');
      ctx.sqliteTxBegun = false;
    } catch (err) {
      try {
        repo.index.exec('ROLLBACK');
      } catch {
        /* ignore */
      }
      ctx.sqliteTxBegun = false;
      throw err;
    } finally {
      if (release) await release();
    }
    return result;
  };
}

module.exports = { bindTransaction, makeCtx, makeProxy };
```

Edit `tools/lib/repository/index.js` to bind the wrapper. In the constructor, AFTER all entity repos:

```js
const { bindTransaction } = require('./transaction');
// ...
this.transaction = bindTransaction(this);
```

- [ ] **Step 4: Run, expect green**

```bash
npx jest tests/unit/repository/transaction.test.js 2>&1 | tail -4
```

Expected: 2 passed.

- [ ] **Step 5: Commit**

```bash
git add tools/lib/repository/transaction.js tools/lib/repository/index.js tests/unit/repository/transaction.test.js
git commit -m "[feat] US-0242 | E.3: transaction wrapper skeleton (no-op + proxy shape)

Lands the skeleton: BEGIN DEFERRED + COMMIT + proxy that exposes every
entity-repo handle with .get/.update/.create stubs. Subsequent tasks
fill in the staging machinery on each entity repo.

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>"
```

---

## Task 2: StoryRepo opt-in `{tx}` staging + RYOW unit test

**Files:**

- Modify: `tools/lib/repository/entities/story-repo.js`
- Extend: `tests/unit/repository/transaction.test.js`

- [ ] **Step 1: Append RYOW test cases**

Append to `tests/unit/repository/transaction.test.js` (inside the existing top-level describe):

````js
it('RYOW: write A=Done, subsequent tx.stories.get returns Done before commit', async () => {
  root = mkRoot();
  fs.writeFileSync(
    path.join(root, 'docs', 'RELEASE_PLAN.md'),
    '# Plan\n\n```\nUS-0001 (EPIC-0001): A\nPriority: High (P1)\nEstimate: M\nStatus: To Do\n```\n',
  );
  Repository._reset();
  const repo = Repository.getInstance({ root });
  repo.refresh();
  await repo.transaction(async (tx) => {
    expect(tx.stories.get('US-0001').status).toBe('To Do');
    await tx.stories.update('US-0001', (s) => {
      s.status = 'Done';
    });
    expect(tx.stories.get('US-0001').status).toBe('Done'); // RYOW
  });
  expect(repo.stories.get('US-0001').status).toBe('Done'); // committed
});

it('AC-0947: throw inside callback rolls back SQL AND leaves markdown unchanged', async () => {
  root = mkRoot();
  const SEED = '# Plan\n\n```\nUS-0001 (EPIC-0001): A\nPriority: High (P1)\nEstimate: M\nStatus: To Do\n```\n';
  fs.writeFileSync(path.join(root, 'docs', 'RELEASE_PLAN.md'), SEED);
  Repository._reset();
  const repo = Repository.getInstance({ root });
  repo.refresh();
  await expect(
    repo.transaction(async (tx) => {
      await tx.stories.update('US-0001', (s) => {
        s.status = 'Done';
      });
      throw new Error('intentional');
    }),
  ).rejects.toThrow('intentional');
  // The markdown file is byte-identical to seed (no flush happened).
  expect(fs.readFileSync(path.join(root, 'docs', 'RELEASE_PLAN.md'), 'utf8')).toBe(SEED);
  // The SQL row is still 'To Do' (ROLLBACK reverted the in-tx upsert).
  expect(repo.stories.get('US-0001').status).toBe('To Do');
});
````

- [ ] **Step 2: Run, expect failure**

```bash
npx jest tests/unit/repository/transaction.test.js 2>&1 | tail -10
```

Expected: the RYOW test fails because the un-modified StoryRepo.update writes through to disk immediately (no staging).

- [ ] **Step 3: Refactor StoryRepo.update to accept `{tx}`**

Edit `tools/lib/repository/entities/story-repo.js`. Modify `update` and `create` signatures to accept `opts = {}`. When `opts.tx` is set, the methods MUST:

1. Re-use existing parse+mutate+serialize flow but in pure-string mode (no file IO).
2. Push a mutator into `opts.tx.pendingFileMutations` keyed on the file path.
3. Stage the new entity in `opts.tx.stagedWrites.set('story:<id>', newEntity)`.
4. Upsert the row into SQLite synchronously (so general SQL queries inside the tx see staged state).
5. Do NOT acquire the file lock — the commit step does that.

Replacement skeleton (replace the `update` method body in StoryRepo):

```js
async update(id, fn, opts = {}) {
  const current = (opts.tx && opts.tx.stagedWrites.get(`story:${id}`)) || this.get(id);
  if (!current) throw new Error(`StoryRepo.update: ${id} not found`);
  const draft = JSON.parse(JSON.stringify(current));
  fn(draft);
  // Validate via serializer — throws ValidationError on bad input. Run
  // serialize BEFORE staging so a validation error never pollutes ctx.
  const newBody = serializeStory(draft);
  if (opts.tx) {
    const idRegex = new RegExp(`^${id}\\b`);
    opts.tx.pendingFileMutations.push({
      path: this._releasePlanPath,
      mutator: (text) => {
        const { replaceBlockInText } = require('../markdown-mutator');
        return replaceBlockInText(text, idRegex, () => newBody);
      },
    });
    opts.tx.stagedWrites.set(`story:${id}`, draft);
    // Synchronously upsert into SQLite so in-tx SQL queries see it.
    this._upsertRow(draft);
    return;
  }
  // Non-tx path: existing behavior unchanged (Task 7 of US-0240).
  const idRegex = new RegExp(`^${id}\\b`);
  await replaceBlock({ path: this._releasePlanPath, idRegex, mutator: () => newBody });
  this._reindex();
}

_upsertRow(story) {
  this.index.prepare(`
    INSERT INTO stories (id, epic_id, title, status, priority, estimate, branch, pr_number, spec_path, plan_path, source_file, source_line)
    VALUES (@id, @epicId, @title, @status, @priority, @estimate, @branch, @prNumber, @specPath, @planPath, @sourceFile, @sourceLine)
    ON CONFLICT(id) DO UPDATE SET
      epic_id=excluded.epic_id, title=excluded.title, status=excluded.status,
      priority=excluded.priority, estimate=excluded.estimate, branch=excluded.branch,
      pr_number=excluded.pr_number, spec_path=excluded.spec_path, plan_path=excluded.plan_path,
      source_file=excluded.source_file, source_line=excluded.source_line
  `).run({
    id: story.id,
    epicId: story.epicId || null,
    title: story.title,
    status: story.status,
    priority: story.priority,
    estimate: story.estimate,
    branch: story.branch || null,
    prNumber: story.prNumber || null,
    specPath: story.specPath || null,
    planPath: story.planPath || null,
    sourceFile: story.sourceFile || 'docs/RELEASE_PLAN.md',
    sourceLine: story.sourceLine || null,
  });
}

_reindex() {
  const path = require('path');
  const { indexReleasePlan } = require('../indexers/release-plan-indexer');
  indexReleasePlan({
    index: this.index,
    markdown: { absolute: (rel) => path.join(this._root || path.dirname(path.dirname(this._releasePlanPath)), rel) },
    rel: 'docs/RELEASE_PLAN.md',
  });
}
```

Apply the same `{tx}` opt-in to `create` (stage an "append at end of file" mutator + `_upsertRow`).

- [ ] **Step 4: Run, expect green**

```bash
npx jest tests/unit/repository/transaction.test.js 2>&1 | tail -8
```

Expected: 4 passed (the 2 from Task 1 + the 2 new).

- [ ] **Step 5: Commit**

```bash
git add tools/lib/repository/entities/story-repo.js tests/unit/repository/transaction.test.js
git commit -m "[feat] US-0242 | E.3: StoryRepo {tx} opt-in + RYOW + rollback semantics

StoryRepo.update + .create now accept opts.tx. When set:
  - Validation runs first (ValidationError still throws cleanly).
  - The mutator is pushed into ctx.pendingFileMutations (flushed at commit).
  - The entity is staged in ctx.stagedWrites for RYOW reads.
  - The SQL row is upserted synchronously inside BEGIN DEFERRED so
    general SQL queries inside the tx see staged state.

Two new tests: RYOW (tx.stories.get returns staged value) + rollback
(throw inside callback leaves markdown byte-identical AND SQL un-mutated
via ROLLBACK).

Closes AC-0946 + AC-0947 for stories. Other entities follow in Task 4.

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>"
```

---

## Task 3: Lex-ordered lock acquisition test

**Files:**

- Extend: `tests/unit/repository/transaction.test.js`

- [ ] **Step 1: Write the lex-order test**

Append:

````js
it('AC-0946: commit acquires file locks in lexicographic absolute-path order', async () => {
  root = mkRoot();
  // Seed three files so a tx touching all three has multiple paths.
  fs.writeFileSync(
    path.join(root, 'docs', 'RELEASE_PLAN.md'),
    '# Plan\n\n```\nUS-0001 (EPIC-0001): A\nPriority: High (P1)\nEstimate: M\nStatus: To Do\n```\n',
  );
  fs.writeFileSync(path.join(root, 'docs', 'BUGS.md'), 'BUG-0001: B\nSeverity: Low\nStatus: Open\n');
  fs.writeFileSync(path.join(root, 'docs', 'LESSONS.md'), '## L-0001 — L\n\n**Rule:** sample\n');

  // Spy acquireMany.
  const fileLockModule = require('../../../tools/lib/repository/file-lock');
  const realAcquireMany = fileLockModule.acquireMany;
  const calls = [];
  fileLockModule.acquireMany = async (files, ...rest) => {
    calls.push([...files]);
    return realAcquireMany(files, ...rest);
  };

  try {
    Repository._reset();
    const repo = Repository.getInstance({ root });
    repo.refresh();
    await repo.transaction(async (tx) => {
      await tx.bugs.update('BUG-0001', (b) => {
        b.status = 'Fixed';
      });
      await tx.lessons.update('L-0001', (l) => {
        l.rule = 'updated';
      });
      await tx.stories.update('US-0001', (s) => {
        s.status = 'Done';
      });
    });

    expect(calls.length).toBe(1);
    const acquiredPaths = calls[0];
    // Must be the three paths, in lex-sorted order. acquireMany already
    // sorts internally; we assert it's called with the deduped set, and
    // we additionally verify the sort is preserved.
    const sorted = [...new Set(acquiredPaths)].sort();
    expect(acquiredPaths).toEqual(expect.arrayContaining(sorted));
    expect(sorted).toEqual([
      path.join(root, 'docs', 'BUGS.md'),
      path.join(root, 'docs', 'LESSONS.md'),
      path.join(root, 'docs', 'RELEASE_PLAN.md'),
    ]);
  } finally {
    fileLockModule.acquireMany = realAcquireMany;
  }
});
````

- [ ] **Step 2: Run + iterate**

```bash
npx jest tests/unit/repository/transaction.test.js 2>&1 | tail -10
```

This will fail because BugRepo + LessonRepo don't yet accept `{tx}`. That's Task 4 — temporarily expect this test to be the **red** marker until then.

Hold off on the commit for this test until after Task 4 lands the other entity tx opt-ins. Or commit the test alone with `--no-verify` per the US-0261 red→green pattern:

```bash
git add tests/unit/repository/transaction.test.js
git commit --no-verify -m "[test] US-0242 | E.3: lex-order lock-acquisition test (FAILS pre-impl)

Asserts repo.transaction calls acquireMany once with the 3 touched
paths in lex-sorted order. Lands red because BugRepo + LessonRepo
.update don't yet accept opts.tx — Task 4 closes the gap.

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>"
```

---

## Task 4: Apply `{tx}` opt-in to remaining entity repos

**Files:**

- Modify: `tools/lib/repository/entities/epic-repo.js`
- Modify: `tools/lib/repository/entities/bug-repo.js`
- Modify: `tools/lib/repository/entities/lesson-repo.js`
- Modify: `tools/lib/repository/entities/test-case-repo.js`
- Modify: `tools/lib/repository/entities/ac-repo.js`
- Modify: `tools/lib/repository/entities/task-repo.js`

- [ ] **Step 1: Apply the StoryRepo pattern from Task 2 to each repo**

For Epic / Bug / Lesson / TestCase — same structural change as Task 2. The serializer + parser + source-file path differ; the staging logic is identical.

For Ac / Task — they delegate to StoryRepo.update. The delegation works unchanged: `await storyRepo.update(parentStoryId, mutator, opts)`. The `opts.tx` flows through.

For Bug / Lesson / TestCase (which use `replaceUnfencedRange`, not `replaceBlockInText`), the mutator pushed into `pendingFileMutations` calls `replaceUnfencedRange` instead.

Add an `_upsertRow` helper to each repo. The schema column names per table (`bugs`, `lessons`, `test_cases`) come from the SQL migrations — `grep "CREATE TABLE bugs" tools/lib/repository/migrations/*.sql`.

- [ ] **Step 2: Run the full transaction test file**

```bash
npx jest tests/unit/repository/transaction.test.js 2>&1 | tail -8
```

Expected: 5 passed (skeleton 2 + RYOW + rollback + lex-order).

- [ ] **Step 3: Commit**

```bash
git add tools/lib/repository/entities/
git commit -m "[feat] US-0242 | E.3: opt-in {tx} on every entity repo

Epic/Bug/Lesson/TestCase get the same tx-opt-in pattern as Story:
stage the file mutator, stage the entity for RYOW, upsert the SQL row
synchronously inside BEGIN DEFERRED. Ac/Task inherit via delegation.

Closes AC-0949 — every entity repo participates in transactions.

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>"
```

---

## Task 5: In-tx ID allocation deferred to commit

**Files:**

- Modify: `tools/lib/repository/id-allocator.js`
- Extend: `tests/unit/repository/transaction.test.js`

- [ ] **Step 1: Write the failing test**

Append to `tests/unit/repository/transaction.test.js`:

```js
it('AC-0948: tx.idRegistry.allocate reserves in-memory; ID_REGISTRY.md unchanged until commit', async () => {
  root = mkRoot();
  const SEED_REGISTRY = `# ID Registry\n\n| **Sequence** | **Next Available ID** | **Last Assigned** |\n| ------------ | --------------------- | ----------------- |\n| US           | US-0264               | US-0263           |\n`;
  fs.writeFileSync(path.join(root, 'docs', 'ID_REGISTRY.md'), SEED_REGISTRY);
  Repository._reset();
  const repo = Repository.getInstance({ root });

  let mid;
  await repo.transaction(async (tx) => {
    const id = await tx.idRegistry.allocate('US');
    expect(id).toBe('US-0264');
    // Mid-tx: file is UNCHANGED.
    mid = fs.readFileSync(path.join(root, 'docs', 'ID_REGISTRY.md'), 'utf8');
    expect(mid).toBe(SEED_REGISTRY);
    // Second allocate in the same tx returns the next ID (in-memory bump).
    const id2 = await tx.idRegistry.allocate('US');
    expect(id2).toBe('US-0265');
  });
  // After commit: file shows the cumulative bump.
  const after = fs.readFileSync(path.join(root, 'docs', 'ID_REGISTRY.md'), 'utf8');
  expect(after).toContain('| US           | US-0266               | US-0265           |');
});

it('AC-0948: tx rollback discards in-tx allocations', async () => {
  root = mkRoot();
  const SEED_REGISTRY = `# ID Registry\n\n| **Sequence** | **Next Available ID** | **Last Assigned** |\n| ------------ | --------------------- | ----------------- |\n| US           | US-0264               | US-0263           |\n`;
  fs.writeFileSync(path.join(root, 'docs', 'ID_REGISTRY.md'), SEED_REGISTRY);
  Repository._reset();
  const repo = Repository.getInstance({ root });
  await expect(
    repo.transaction(async (tx) => {
      await tx.idRegistry.allocate('US', 5);
      throw new Error('intentional');
    }),
  ).rejects.toThrow('intentional');
  expect(fs.readFileSync(path.join(root, 'docs', 'ID_REGISTRY.md'), 'utf8')).toBe(SEED_REGISTRY);
});
```

- [ ] **Step 2: Run, expect failure**

```bash
npx jest tests/unit/repository/transaction.test.js -t "AC-0948" 2>&1 | tail -8
```

- [ ] **Step 3: Extend IdAllocator to support `opts.tx`**

Edit `tools/lib/repository/id-allocator.js`. Add to the `IdAllocator` class:

```js
async allocate(sequence, count = 1, opts = {}) {
  if (!Number.isInteger(count) || count <= 0) {
    throw new Error(`IdAllocator.allocate: count must be positive integer, got ${count}`);
  }
  if (opts.tx) {
    return this._allocateInTx(sequence, count, opts.tx);
  }
  // Non-tx path: existing behavior unchanged.
  let returned;
  await withFileLock(this._registryPath, async () => {
    const text = fs.readFileSync(this._registryPath, 'utf8');
    const row = _parseRow(text, sequence);
    if (!row) throw new Error(`IdAllocator.allocate: sequence "${sequence}" not found`);
    const { ids, newRow } = _bumpRow(row, count);
    fs.writeFileSync(this._registryPath + '.tmp', _rewriteRow(text, row, newRow));
    fs.renameSync(this._registryPath + '.tmp', this._registryPath);
    returned = count === 1 ? ids[0] : ids;
  });
  return returned;
}

_allocateInTx(sequence, count, ctx) {
  // First in-tx allocation for this sequence: parse the on-disk row,
  // snapshot it in ctx.pendingIdAllocations. Subsequent allocations
  // bump the in-memory counter from the same snapshot.
  let alloc = ctx.pendingIdAllocations.get(sequence);
  if (!alloc) {
    const text = fs.readFileSync(this._registryPath, 'utf8');
    const row = _parseRow(text, sequence);
    if (!row) throw new Error(`IdAllocator.allocate: sequence "${sequence}" not found`);
    alloc = { originalRow: row, nextNum: row.nextNum, padWidth: _padWidthOf(row) };
    ctx.pendingIdAllocations.set(sequence, alloc);
    // Schedule ONE mutator for ID_REGISTRY.md per sequence — coalesces
    // all in-tx allocations into a single file rewrite at commit.
    ctx.pendingFileMutations.push({
      path: this._registryPath,
      mutator: (text) => {
        const row2 = _parseRow(text, sequence); // re-parse at commit time
        if (!row2) throw new Error(`IdAllocator: sequence ${sequence} vanished mid-tx`);
        const finalCount = ctx.pendingIdAllocations.get(sequence).nextNum - row2.nextNum;
        if (finalCount === 0) return text;
        const { newRow } = _bumpRow(row2, finalCount);
        return _rewriteRow(text, row2, newRow);
      },
    });
  }
  const ids = [];
  for (let i = 0; i < count; i++) {
    ids.push(_formatId(alloc.originalRow.prefix, alloc.nextNum + i, alloc.padWidth));
  }
  alloc.nextNum += count;
  return count === 1 ? ids[0] : ids;
}
```

And export the helper:

```js
function _padWidthOf(row) { return row.nextId.length - (row.prefix.length + 1); }
module.exports = { /* ...existing... */, _padWidthOf };
```

- [ ] **Step 4: Run, expect green**

```bash
npx jest tests/unit/repository/transaction.test.js 2>&1 | tail -8
```

Expected: 7 passed (5 prior + 2 new AC-0948 tests).

- [ ] **Step 5: Commit**

```bash
git add tools/lib/repository/id-allocator.js tests/unit/repository/transaction.test.js
git commit -m "[feat] US-0242 | E.3: in-tx ID allocation deferred to commit (AC-0948)

IdAllocator.allocate(seq, count, {tx}) reserves IDs in-memory by
bumping ctx.pendingIdAllocations[seq].nextNum. The actual ID_REGISTRY.md
rewrite is scheduled as ONE mutator per sequence in pendingFileMutations;
multiple allocations on the same seq within one tx coalesce into a
single file write at commit.

ROLLBACK discards the pending allocations because the mutators never
flush — same mechanism as staged story/bug/lesson writes.

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>"
```

---

## Task 6: Multi-entity integration test

**Files:**

- Create: `tests/integration/repository/transaction-multi-entity.test.js`

- [ ] **Step 1: Write the test**

```js
'use strict';

const fs = require('fs');
const os = require('os');
const path = require('path');
const { Repository } = require('../../../tools/lib/repository');

describe('US-0242 / AC-0946: multi-entity atomic transaction', () => {
  let root;
  afterEach(() => {
    Repository._reset();
    if (root) fs.rmSync(root, { recursive: true, force: true });
  });

  it('story update + AC update + ID allocation commit together', async () => {
    root = fs.mkdtempSync(path.join(os.tmpdir(), 'us0242-multi-'));
    fs.mkdirSync(path.join(root, 'docs'), { recursive: true });
    fs.writeFileSync(path.join(root, 'package.json'), JSON.stringify({ name: 't', version: '1.0.0' }));
    fs.writeFileSync(
      path.join(root, 'docs', 'RELEASE_PLAN.md'),
      `# Plan\n\n\`\`\`\nUS-0001 (EPIC-0001): A\nPriority: High (P1)\nEstimate: M\nStatus: To Do\nAcceptance Criteria:\n\n- [ ] AC-0001: first\n\`\`\`\n`,
    );
    fs.writeFileSync(
      path.join(root, 'docs', 'ID_REGISTRY.md'),
      `| **Sequence** | **Next Available ID** | **Last Assigned** |\n| ------------ | --------------------- | ----------------- |\n| US           | US-0002               | US-0001           |\n`,
    );
    Repository._reset();
    const repo = Repository.getInstance({ root });
    repo.refresh();

    const newId = await repo.transaction(async (tx) => {
      await tx.stories.update('US-0001', (s) => {
        s.status = 'Done';
      });
      await tx.acs.update('AC-0001', (a) => {
        a.checked = true;
      });
      return tx.idRegistry.allocate('US');
    });

    expect(newId).toBe('US-0002');
    const planText = fs.readFileSync(path.join(root, 'docs', 'RELEASE_PLAN.md'), 'utf8');
    expect(planText).toContain('Status: Done');
    expect(planText).toContain('- [x] AC-0001: first');
    const regText = fs.readFileSync(path.join(root, 'docs', 'ID_REGISTRY.md'), 'utf8');
    expect(regText).toContain('| US           | US-0003               | US-0002           |');
  });

  it('throw mid-tx leaves ALL three files byte-identical to seed', async () => {
    root = fs.mkdtempSync(path.join(os.tmpdir(), 'us0242-multi-rb-'));
    fs.mkdirSync(path.join(root, 'docs'), { recursive: true });
    fs.writeFileSync(path.join(root, 'package.json'), JSON.stringify({ name: 't', version: '1.0.0' }));
    const SEED_PLAN = `# Plan\n\n\`\`\`\nUS-0001 (EPIC-0001): A\nPriority: High (P1)\nEstimate: M\nStatus: To Do\n\`\`\`\n`;
    const SEED_REG = `| **Sequence** | **Next Available ID** | **Last Assigned** |\n| ------------ | --------------------- | ----------------- |\n| US           | US-0002               | US-0001           |\n`;
    fs.writeFileSync(path.join(root, 'docs', 'RELEASE_PLAN.md'), SEED_PLAN);
    fs.writeFileSync(path.join(root, 'docs', 'ID_REGISTRY.md'), SEED_REG);
    Repository._reset();
    const repo = Repository.getInstance({ root });
    repo.refresh();

    await expect(
      repo.transaction(async (tx) => {
        await tx.stories.update('US-0001', (s) => {
          s.status = 'Done';
        });
        await tx.idRegistry.allocate('US');
        throw new Error('boom');
      }),
    ).rejects.toThrow('boom');

    expect(fs.readFileSync(path.join(root, 'docs', 'RELEASE_PLAN.md'), 'utf8')).toBe(SEED_PLAN);
    expect(fs.readFileSync(path.join(root, 'docs', 'ID_REGISTRY.md'), 'utf8')).toBe(SEED_REG);
    expect(repo.stories.get('US-0001').status).toBe('To Do');
  });
});
```

- [ ] **Step 2: Run, iterate to green**

```bash
npx jest tests/integration/repository/transaction-multi-entity.test.js 2>&1 | tail -8
```

Expected: 2 passed.

- [ ] **Step 3: Commit**

```bash
git add tests/integration/repository/transaction-multi-entity.test.js
git commit -m "[test] US-0242 | E.3: multi-entity atomic transaction integration

End-to-end coverage: tx that touches RELEASE_PLAN.md (story + AC) AND
ID_REGISTRY.md commits together. Rollback variant proves all three
files remain byte-identical to seed on a thrown tx.

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>"
```

---

## Task 7: Module-level JSDoc guideline (callback-runs-while-BEGIN-open hazard)

**Files:**

- Modify: `tools/lib/repository/transaction.js`

- [ ] **Step 1: Add JSDoc per spec §3.6**

At the top of `transaction.js`, add:

```js
/**
 * Multi-entity, multi-file write transaction wrapper.
 *
 * Usage:
 *   await repo.transaction(async (tx) => {
 *     await tx.stories.update('US-0001', s => { s.status = 'Done'; });
 *     await tx.acs.update('AC-0001', a => { a.checked = true; });
 *   });
 *
 * Read-Your-Own-Writes: staged writes are visible to subsequent
 * tx.X.get(id) calls within the same callback.
 *
 * GUIDELINE — keep the callback minimal:
 *   The transaction opens SQLite BEGIN DEFERRED at the start of the
 *   callback. Once the first write fires, SQLite holds a write lock
 *   until COMMIT. A callback that awaits network I/O, reads unrelated
 *   files, or sleeps holds that lock and blocks concurrent writers.
 *
 *   Stage your writes and return. Don't await anything inside
 *   repo.transaction(...) that isn't a tx.X.* call.
 *
 * This is documentation-only — there is no runtime enforcement.
 */
```

- [ ] **Step 2: Commit**

```bash
git add tools/lib/repository/transaction.js
git commit -m "[docs] US-0242 | E.3: module-level guideline on minimal tx callbacks

Spec §3.6 — document the BEGIN-DEFERRED-held-while-callback hazard.
No runtime enforcement; per-consumer integration tests (US-0244/0245/
0246) catch hangs by virtue of completing quickly.

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>"
```

---

## Task 8: Coverage + finishing-a-development-branch

- [ ] **Step 1: Coverage**

```bash
npx jest --coverage --runInBand tests/unit/repository/transaction.test.js tests/integration/repository/transaction-multi-entity.test.js 2>&1 | grep -E "transaction|id-allocator"
```

Expected: `transaction.js` ≥90% statements; `id-allocator.js` still ≥90% (US-0241 baseline + tx path).

- [ ] **Step 2: Full suite + lint**

```bash
npx jest --runInBand --silent 2>&1 | tail -4
npm run lint 2>&1 | tail -3
npm run format:check 2>&1 | tail -3
```

- [ ] **Step 3: Hand off to finishing-a-development-branch**

Announce: "I'm using the finishing-a-development-branch skill to complete this work."

Expected PR title: `feat: US-0242 — repo.transaction wrapper with RYOW + lex-ordered locks`.

---

## Self-Review

### Spec coverage

| Spec item                                                                         | Task                     |
| --------------------------------------------------------------------------------- | ------------------------ |
| §3.4 RYOW                                                                         | Tasks 1, 2               |
| §3.4 BEGIN DEFERRED + COMMIT protocol                                             | Task 1                   |
| §3.4 lex-ordered lock acquisition via acquireMany                                 | Tasks 1 (impl), 3 (test) |
| §3.4 step 2.f synchronous index upsert inside BEGIN                               | Task 2 (\_upsertRow)     |
| §3.4 ID allocator deferred to commit                                              | Task 5                   |
| §3.6 documentation guideline                                                      | Task 7                   |
| AC-0946 transaction(fn) opens BEGIN, runs fn, acquires lex-ordered locks, COMMITs | Tasks 1, 3               |
| AC-0947 throw → ROLLBACK + zero file mutations                                    | Tasks 2, 6               |
| AC-0948 in-tx alloc deferred                                                      | Task 5                   |
| AC-0949 each entity has \*InTransaction (here: {tx} opt-in)                       | Task 4                   |

### Placeholder scan

No "TBD", "TODO", "handle edge cases" tokens. The schema-column-name list for `_upsertRow` per entity is given as "grep CREATE TABLE …" in Task 4 — that's the appropriate next step, not a placeholder.

### Type consistency

- `opts.tx` is a TxCtx object (the same one passed into the user callback). Every consumer destructures `pendingFileMutations` + `stagedWrites` + `pendingIdAllocations`.
- The proxy returns `Promise<void>` for `update`/`create` and `string|string[]` for `allocate` — matches the underlying repo signatures.
- `pendingFileMutations` entries are `{path: string, mutator: (text: string) => string}` everywhere.

### Open decision (spec §8.1) — resolved here

The spec listed two viable shapes for entity opt-in: (a) `<EntityRepo>InTransaction` helper modules or (b) `update(id, fn, {tx})` parameter. **This plan picks (b)** — every entity repo's `.update` / `.create` accepts `opts = {}` with `tx` as a key. Single source of truth per entity; no parallel helper modules to maintain.
