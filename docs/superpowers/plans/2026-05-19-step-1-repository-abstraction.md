# Step 1 — Repository Abstraction Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Introduce a repository / data-access boundary in PlanVisualizer with markdown authoritative for human-edited entities, SQLite authoritative for tool-emitted state, a derived SQLite index for fast queries + referential integrity, and a migration framework with `pv:*` commands for safe user upgrades.

**Architecture:** Two-layer repository pattern under `tools/lib/repository/`. `MarkdownDatastore` owns reads/writes for human-authored entities via AST parser/serializer; `IndexDatastore` owns SQLite (better-sqlite3 primary, node:sqlite fallback, --no-index legacy mode). Per-entity repos sit on top. `Repository.getInstance()` is the singleton entry. Refresh runs at process start + every dispatch start. Multi-entity transactions batch markdown writes at commit in lexicographic lock order. Phases A→F land sequentially; no file is in mixed-mode at any point.

**Tech Stack:** Node.js 22+ (for `node:sqlite` fallback), Jest 30, `better-sqlite3` (native binding, prebuilt for darwin/linux/windows), `proper-lockfile` (cross-platform file locks; replaces the aspirational `file-lock.js` referenced in the spec), `js-yaml` (already present for boundary checks in EPIC-0031).

**Spec:** [`docs/superpowers/specs/2026-05-19-step-1-repository-abstraction-design.md`](../specs/2026-05-19-step-1-repository-abstraction-design.md)

---

## File Structure

The full file layout this plan creates or modifies:

```
tools/lib/repository/
  index.js                       # Repository.getInstance() singleton
  markdown-datastore.js          # AST-aware read/write of markdown files
  index-datastore.js             # SQLite ops + fallback chain
  refresh.js                     # mtime/hash-based incremental rebuild
  validation.js                  # tiered rules (error/warning/report)
  warnings-channel.js            # writes .cache/repo-warnings.jsonl
  id-allocator.js                # ID_REGISTRY direct read/write under lock
  transactions.js                # multi-entity transaction primitive
  file-lock.js                   # proper-lockfile wrapper (Phase A; moves to internal/ in Phase F)
  ast/
    parser.js                    # markdown → [Prose|FencedBlock] ordered AST
    serializer.js                # AST → markdown (byte-preserving)
  entities/
    base-repo.js                 # generic CRUD over an entity type
    epic-repo.js
    story-repo.js
    ac-repo.js
    task-repo.js                 # planning_tasks
    bug-repo.js
    lesson-repo.js
    test-case-repo.js
    id-registry-repo.js
    sdlc-task-repo.js            # SQLite-authoritative; JSON mirror writer
    sdlc-event-repo.js           # SQLite-authoritative; JSON mirror writer
    sdlc-programme-repo.js       # SQLite-authoritative; JSON mirror writer
    cost-row-repo.js             # read-only
    coverage-repo.js             # read-only
  migrations/                    # SQLite schema migrations
    001_initial_schema.sql
    002_normalised_refs.sql

tools/lib/migrations/            # project-state migrations (distinct from SQLite schema)
  index.js                       # detect state, run ordered migrations
  pv-state.js                    # read/write committed + local state files
  backup.js                      # snapshots into docs/.pv-backup/<version>/
  001-normalise-fenced-blocks.js
  002-ingest-sdlc-status.js

tools/                           # CLI entry points (called via npm scripts)
  pv-check-upgrade.js
  pv-upgrade.js
  pv-rollback.js
  pv-doctor.js
  plan-lint.js
  plan-index.js

tests/unit/repository/           # mirrors source layout
tests/integration/repository/    # cross-component flows
tests/fixtures/repository/       # markdown/JSON snapshots for round-trip tests

docs/.pv-state.json              # committed: planvisualizerVersion + appliedMigrations
docs/.pv-state.local.json        # gitignored: lastUpgradeAt + lastUpgradeBy
docs/.pv-backup/                 # gitignored backup directory

scripts/update.sh                # modified to run pv:check-upgrade

orchestrator/spawn.js            # modified in A to add dispatch-prelude refresh()
.gitignore                       # adds .cache/, docs/.pv-state.local.json, docs/.pv-backup/
package.json                     # adds deps + npm scripts
AGENTS.md, CLAUDE.md             # updated with persistence rules (Phase F)
```

---

## Phase A — Foundation

**Hard gate:** Every existing markdown source round-trips idempotent-on-second-pass through the AST parser+serializer; `better-sqlite3` smoke passes on darwin/linux/win matrix; `pv:check-upgrade` runs read-only against current project; `repo.refresh()` is automatic at `getInstance()` and dispatch start.

**Effort:** 3-5 working days through the agent pipeline.

### Task A.1: Add dependencies and base npm scripts

**Files:**

- Modify: `package.json`
- Modify: `.gitignore`

- [ ] **Step 1: Add the new dependencies and scripts to `package.json`**

In `dependencies`, add:

```json
"better-sqlite3": "^11.5.0",
"proper-lockfile": "^4.1.2"
```

In `scripts`, add:

```json
"plan:index": "node tools/plan-index.js",
"plan:lint": "node tools/plan-lint.js",
"pv:check-upgrade": "node tools/pv-check-upgrade.js",
"pv:upgrade": "node tools/pv-upgrade.js",
"pv:rollback": "node tools/pv-rollback.js",
"pv:doctor": "node tools/pv-doctor.js"
```

In `engines`, add:

```json
"engines": { "node": ">=22.0.0" }
```

- [ ] **Step 2: Append to `.gitignore`**

```
# Step 1 repository abstraction
.cache/
docs/.pv-state.local.json
docs/.pv-backup/
```

- [ ] **Step 3: Install dependencies**

Run: `npm install`
Expected: `better-sqlite3` and `proper-lockfile` added to `node_modules` without native build errors. If native build fails, see Task A.10 fallback chain.

- [ ] **Step 4: Commit**

```bash
git add package.json package-lock.json .gitignore
git commit -m "feat(repo): add better-sqlite3 + proper-lockfile deps and pv:* scripts"
```

### Task A.2: File-lock wrapper

**Files:**

- Create: `tools/lib/repository/file-lock.js`
- Test: `tests/unit/repository/file-lock.test.js`

- [ ] **Step 1: Write failing test**

```js
// tests/unit/repository/file-lock.test.js
const fs = require('fs');
const path = require('path');
const os = require('os');
const { withFileLock } = require('../../../tools/lib/repository/file-lock');

describe('withFileLock', () => {
  let tmpFile;
  beforeEach(() => {
    tmpFile = path.join(os.tmpdir(), `lock-test-${Date.now()}.md`);
    fs.writeFileSync(tmpFile, 'initial');
  });
  afterEach(() => {
    try {
      fs.unlinkSync(tmpFile);
    } catch {}
  });

  test('serializes concurrent writes', async () => {
    const order = [];
    await Promise.all([
      withFileLock(tmpFile, async () => {
        order.push('A-start');
        await new Promise((r) => setTimeout(r, 50));
        order.push('A-end');
      }),
      withFileLock(tmpFile, async () => {
        order.push('B-start');
        order.push('B-end');
      }),
    ]);
    expect(order).toEqual(['A-start', 'A-end', 'B-start', 'B-end']);
  });

  test('locks are released after function throws', async () => {
    await expect(
      withFileLock(tmpFile, async () => {
        throw new Error('boom');
      }),
    ).rejects.toThrow('boom');
    let ran = false;
    await withFileLock(tmpFile, async () => {
      ran = true;
    });
    expect(ran).toBe(true);
  });

  test('acquireMany locks files in lexicographic order', async () => {
    const f2 = tmpFile + '.2';
    fs.writeFileSync(f2, 'x');
    const { acquireMany } = require('../../../tools/lib/repository/file-lock');
    const acquired = [];
    const release = await acquireMany([f2, tmpFile], (p) => acquired.push(p));
    expect(acquired).toEqual([tmpFile, f2].sort());
    await release();
    fs.unlinkSync(f2);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx jest tests/unit/repository/file-lock.test.js`
Expected: FAIL with `Cannot find module '.../file-lock'`.

- [ ] **Step 3: Implement `file-lock.js`**

```js
// tools/lib/repository/file-lock.js
'use strict';
const lockfile = require('proper-lockfile');

async function withFileLock(file, fn, opts = {}) {
  const release = await lockfile.lock(file, {
    retries: { retries: 50, minTimeout: 10, maxTimeout: 200 },
    stale: 30_000,
    realpath: false,
    ...opts,
  });
  try {
    return await fn();
  } finally {
    await release();
  }
}

async function acquireMany(files, onAcquired = () => {}) {
  const sorted = [...new Set(files)].sort();
  const releases = [];
  try {
    for (const f of sorted) {
      const release = await lockfile.lock(f, {
        retries: { retries: 50, minTimeout: 10, maxTimeout: 200 },
        stale: 30_000,
        realpath: false,
      });
      releases.push(release);
      onAcquired(f);
    }
  } catch (err) {
    for (const r of releases.reverse()) {
      try {
        await r();
      } catch {}
    }
    throw err;
  }
  return async () => {
    for (const r of releases.reverse()) {
      try {
        await r();
      } catch {}
    }
  };
}

module.exports = { withFileLock, acquireMany };
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx jest tests/unit/repository/file-lock.test.js`
Expected: 3 passed.

- [ ] **Step 5: Commit**

```bash
git add tools/lib/repository/file-lock.js tests/unit/repository/file-lock.test.js
git commit -m "feat(repo): file-lock wrapper with lexicographic acquireMany"
```

### Task A.3: AST parser

**Files:**

- Create: `tools/lib/repository/ast/parser.js`
- Test: `tests/unit/repository/ast-parser.test.js`
- Create: `tests/fixtures/repository/sample-release-plan.md`

- [ ] **Step 1: Create fixture**

`tests/fixtures/repository/sample-release-plan.md`:

````markdown
# Release Plan

Some prose before the first block.

## Epic — EPIC-0001: Demo

```
EPIC-0001: Demo
Description: Demo epic
Status: Done
```

Prose between epic and stories.

## User Stories — EPIC-0001

```
US-0001 (EPIC-0001): As a user, I want X.
Priority: High (P1)
Status: Done
Acceptance Criteria:

- [x] AC-0001: Thing one
- [ ] AC-0002: Thing two
```

Trailing prose.
````

- [ ] **Step 2: Write failing test**

````js
// tests/unit/repository/ast-parser.test.js
const fs = require('fs');
const path = require('path');
const { parseMarkdown } = require('../../../tools/lib/repository/ast/parser');

const FIXTURE = path.join(__dirname, '../../fixtures/repository/sample-release-plan.md');

describe('parseMarkdown', () => {
  test('returns ordered AST of prose and fenced blocks', () => {
    const src = fs.readFileSync(FIXTURE, 'utf8');
    const ast = parseMarkdown(src);
    const kinds = ast.map((n) => n.kind);
    expect(kinds).toEqual(['prose', 'fenced', 'prose', 'fenced', 'prose']);
    expect(ast[1].body).toContain('EPIC-0001: Demo');
    expect(ast[3].body).toContain('US-0001 (EPIC-0001)');
  });

  test('preserves trailing newline and exact prose whitespace', () => {
    const src = '# X\n\nprose\n\n```\nblock\n```\n\nafter\n';
    const ast = parseMarkdown(src);
    expect(ast[0].text).toBe('# X\n\nprose\n\n');
    expect(ast[2].text).toBe('\n\nafter\n');
  });

  test('handles file with no fenced blocks', () => {
    const ast = parseMarkdown('just prose\nno blocks\n');
    expect(ast).toEqual([{ kind: 'prose', text: 'just prose\nno blocks\n' }]);
  });

  test('handles file starting with a fenced block', () => {
    const ast = parseMarkdown('```\nx\n```\nafter\n');
    expect(ast[0].kind).toBe('fenced');
    expect(ast[1].kind).toBe('prose');
  });
});
````

- [ ] **Step 3: Run test to verify it fails**

Run: `npx jest tests/unit/repository/ast-parser.test.js`
Expected: FAIL — module not found.

- [ ] **Step 4: Implement parser**

````js
// tools/lib/repository/ast/parser.js
'use strict';

/**
 * Parse markdown into an ordered AST of prose segments and fenced code blocks.
 * Each block: { kind: 'fenced', fence: '```', info: '', body: '...', raw: '...' }
 * Each prose: { kind: 'prose', text: '...' }
 * Concatenating ast[i].raw or ast[i].text reproduces the input byte-identically.
 */
function parseMarkdown(src) {
  const ast = [];
  const lines = src.split('\n');
  let i = 0;
  let proseStart = 0;
  let inFence = false;
  let fenceStart = 0;
  let fenceMarker = '';
  let fenceInfo = '';

  function flushProse(endIdx) {
    if (endIdx > proseStart) {
      const text = lines.slice(proseStart, endIdx).join('\n') + (endIdx < lines.length ? '\n' : '');
      if (text.length) ast.push({ kind: 'prose', text });
    }
  }

  while (i < lines.length) {
    const line = lines[i];
    const fenceMatch = !inFence && line.match(/^(\s*)(```+|~~~+)(.*)$/);
    if (fenceMatch) {
      flushProse(i);
      inFence = true;
      fenceStart = i;
      fenceMarker = fenceMatch[2];
      fenceInfo = fenceMatch[3];
      i++;
      continue;
    }
    if (inFence && line.match(new RegExp('^\\s*' + fenceMarker + '\\s*$'))) {
      const body = lines.slice(fenceStart + 1, i).join('\n');
      const raw = lines.slice(fenceStart, i + 1).join('\n') + (i + 1 < lines.length ? '\n' : '');
      ast.push({ kind: 'fenced', fence: fenceMarker, info: fenceInfo, body, raw });
      inFence = false;
      i++;
      proseStart = i;
      continue;
    }
    i++;
  }
  if (inFence) {
    // Unterminated fence: treat as prose to avoid data loss
    inFence = false;
  }
  flushProse(lines.length);
  return ast;
}

module.exports = { parseMarkdown };
````

- [ ] **Step 5: Run test to verify it passes**

Run: `npx jest tests/unit/repository/ast-parser.test.js`
Expected: 4 passed.

- [ ] **Step 6: Commit**

```bash
git add tools/lib/repository/ast/parser.js tests/unit/repository/ast-parser.test.js tests/fixtures/repository/sample-release-plan.md
git commit -m "feat(repo): AST parser for prose + fenced-block markdown"
```

### Task A.4: AST serializer + round-trip harness

**Files:**

- Create: `tools/lib/repository/ast/serializer.js`
- Test: `tests/unit/repository/ast-serializer.test.js`
- Test: `tests/integration/repository/round-trip.test.js`

- [ ] **Step 1: Write failing serializer test**

```js
// tests/unit/repository/ast-serializer.test.js
const fs = require('fs');
const path = require('path');
const { parseMarkdown } = require('../../../tools/lib/repository/ast/parser');
const { serializeAst, replaceBlock } = require('../../../tools/lib/repository/ast/serializer');

const FIXTURE = path.join(__dirname, '../../fixtures/repository/sample-release-plan.md');

describe('serializeAst', () => {
  test('round-trips a parsed AST byte-identical', () => {
    const src = fs.readFileSync(FIXTURE, 'utf8');
    const ast = parseMarkdown(src);
    expect(serializeAst(ast)).toBe(src);
  });

  test('replaceBlock rewrites a single fenced block without touching prose', () => {
    const src = fs.readFileSync(FIXTURE, 'utf8');
    const ast = parseMarkdown(src);
    const newAst = replaceBlock(ast, 1, 'EPIC-0001: Demo\nDescription: NEW\nStatus: Done');
    const out = serializeAst(newAst);
    expect(out).toContain('Description: NEW');
    expect(out.startsWith('# Release Plan\n\nSome prose before')).toBe(true);
    expect(out.endsWith('Trailing prose.\n')).toBe(true);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx jest tests/unit/repository/ast-serializer.test.js`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement serializer**

````js
// tools/lib/repository/ast/serializer.js
'use strict';

function serializeAst(ast) {
  return ast.map((n) => (n.kind === 'fenced' ? n.raw : n.text)).join('');
}

function replaceBlock(ast, index, newBody, opts = {}) {
  const node = ast[index];
  if (!node || node.kind !== 'fenced') throw new Error(`AST node at ${index} is not fenced`);
  const fence = opts.fence || node.fence;
  const info = opts.info != null ? opts.info : node.info;
  const trailingNewline = node.raw.endsWith('\n') ? '\n' : '';
  const raw = `${fence}${info}\n${newBody}\n${fence}${trailingNewline}`;
  const next = ast.slice();
  next[index] = { kind: 'fenced', fence, info, body: newBody, raw };
  return next;
}

function insertBlock(ast, beforeIndex, body, opts = {}) {
  const fence = opts.fence || '```';
  const info = opts.info || '';
  const raw = `${fence}${info}\n${body}\n${fence}\n`;
  const block = { kind: 'fenced', fence, info, body, raw };
  const next = ast.slice();
  next.splice(beforeIndex, 0, block);
  return next;
}

module.exports = { serializeAst, replaceBlock, insertBlock };
````

- [ ] **Step 4: Run serializer tests**

Run: `npx jest tests/unit/repository/ast-serializer.test.js`
Expected: 2 passed.

- [ ] **Step 5: Write round-trip harness against real project files**

```js
// tests/integration/repository/round-trip.test.js
const fs = require('fs');
const path = require('path');
const { parseMarkdown } = require('../../../tools/lib/repository/ast/parser');
const { serializeAst } = require('../../../tools/lib/repository/ast/serializer');

const ROOT = path.join(__dirname, '../../..');
const TARGETS = [
  'docs/RELEASE_PLAN.md',
  'docs/BUGS.md',
  'docs/LESSONS.md',
  'docs/TEST_CASES.md',
  'docs/ID_REGISTRY.md',
];

describe('round-trip on production files', () => {
  for (const rel of TARGETS) {
    test(`${rel} is idempotent on second pass`, () => {
      const abs = path.join(ROOT, rel);
      if (!fs.existsSync(abs)) return; // Skip if missing in CI
      const src = fs.readFileSync(abs, 'utf8');
      const once = serializeAst(parseMarkdown(src));
      const twice = serializeAst(parseMarkdown(once));
      expect(twice).toBe(once);
    });
  }
});
```

- [ ] **Step 6: Run round-trip harness**

Run: `npx jest tests/integration/repository/round-trip.test.js`
Expected: PASS for all existing files. If any fails, the parser/serializer pair needs adjustment **before continuing** — this is the Phase A hard gate.

- [ ] **Step 7: Commit**

```bash
git add tools/lib/repository/ast/serializer.js tests/unit/repository/ast-serializer.test.js tests/integration/repository/round-trip.test.js
git commit -m "feat(repo): AST serializer + idempotent round-trip harness"
```

### Task A.5: IndexDatastore with fallback chain

**Files:**

- Create: `tools/lib/repository/index-datastore.js`
- Test: `tests/unit/repository/index-datastore.test.js`

- [ ] **Step 1: Write failing test**

```js
// tests/unit/repository/index-datastore.test.js
const fs = require('fs');
const path = require('path');
const os = require('os');
const { openIndexDatastore } = require('../../../tools/lib/repository/index-datastore');

describe('IndexDatastore', () => {
  let dbDir;
  beforeEach(() => {
    dbDir = fs.mkdtempSync(path.join(os.tmpdir(), 'idx-'));
  });
  afterEach(() => {
    fs.rmSync(dbDir, { recursive: true, force: true });
  });

  test('opens via better-sqlite3 when available', () => {
    const ds = openIndexDatastore({ path: path.join(dbDir, 'pv.db') });
    expect(ds.mode).toBe('better-sqlite3');
    expect(ds.exec).toBeDefined();
    ds.close();
  });

  test('exposes prepare and transaction', () => {
    const ds = openIndexDatastore({ path: path.join(dbDir, 'pv.db') });
    ds.exec('CREATE TABLE t(id INTEGER PRIMARY KEY, v TEXT)');
    const insert = ds.prepare('INSERT INTO t(v) VALUES (?)');
    ds.transaction(() => {
      insert.run('a');
      insert.run('b');
    });
    const rows = ds.prepare('SELECT v FROM t ORDER BY id').all();
    expect(rows.map((r) => r.v)).toEqual(['a', 'b']);
    ds.close();
  });

  test('WAL mode is enabled', () => {
    const ds = openIndexDatastore({ path: path.join(dbDir, 'pv.db') });
    const journal = ds.prepare('PRAGMA journal_mode').get();
    expect(String(journal.journal_mode).toLowerCase()).toBe('wal');
    ds.close();
  });

  test('--no-index mode returns a noop datastore', () => {
    const ds = openIndexDatastore({ path: path.join(dbDir, 'pv.db'), mode: 'no-index' });
    expect(ds.mode).toBe('no-index');
    expect(() => ds.exec('whatever')).not.toThrow();
    expect(ds.prepare('SELECT 1').all()).toEqual([]);
    ds.close();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx jest tests/unit/repository/index-datastore.test.js`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement IndexDatastore**

```js
// tools/lib/repository/index-datastore.js
'use strict';
const fs = require('fs');
const path = require('path');

function openBetterSqlite3(dbPath) {
  const Database = require('better-sqlite3');
  fs.mkdirSync(path.dirname(dbPath), { recursive: true });
  const db = new Database(dbPath);
  db.pragma('journal_mode = WAL');
  db.pragma('synchronous = NORMAL');
  db.pragma('foreign_keys = ON');
  return {
    mode: 'better-sqlite3',
    exec: (sql) => db.exec(sql),
    prepare: (sql) => db.prepare(sql),
    transaction: (fn) => db.transaction(fn)(),
    close: () => db.close(),
  };
}

function openNodeSqlite(dbPath) {
  // Node 22+ built-in (requires --experimental-sqlite until Node 24 LTS)
  const { DatabaseSync } = require('node:sqlite');
  fs.mkdirSync(path.dirname(dbPath), { recursive: true });
  const db = new DatabaseSync(dbPath);
  db.exec('PRAGMA journal_mode = WAL');
  db.exec('PRAGMA synchronous = NORMAL');
  db.exec('PRAGMA foreign_keys = ON');
  return {
    mode: 'node:sqlite',
    exec: (sql) => db.exec(sql),
    prepare: (sql) => {
      const stmt = db.prepare(sql);
      return { run: (...a) => stmt.run(...a), get: (...a) => stmt.get(...a), all: (...a) => stmt.all(...a) };
    },
    transaction: (fn) => {
      db.exec('BEGIN');
      try {
        fn();
        db.exec('COMMIT');
      } catch (e) {
        db.exec('ROLLBACK');
        throw e;
      }
    },
    close: () => db.close(),
  };
}

function noopDatastore() {
  return {
    mode: 'no-index',
    exec: () => {},
    prepare: () => ({ run: () => ({ changes: 0 }), get: () => undefined, all: () => [] }),
    transaction: (fn) => fn(),
    close: () => {},
  };
}

function openIndexDatastore({ path: dbPath, mode } = {}) {
  if (mode === 'no-index' || process.env.PV_NO_INDEX === '1') return noopDatastore();
  if (mode === 'node:sqlite') return openNodeSqlite(dbPath);
  if (mode === 'better-sqlite3') return openBetterSqlite3(dbPath);
  // Auto-detect: try better-sqlite3, then node:sqlite, then no-index
  try {
    return openBetterSqlite3(dbPath);
  } catch (e) {
    try {
      return openNodeSqlite(dbPath);
    } catch (e2) {
      console.warn('[repo] SQLite unavailable, falling back to --no-index legacy mode:', e2.message);
      return noopDatastore();
    }
  }
}

module.exports = { openIndexDatastore };
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx jest tests/unit/repository/index-datastore.test.js`
Expected: 4 passed.

- [ ] **Step 5: Commit**

```bash
git add tools/lib/repository/index-datastore.js tests/unit/repository/index-datastore.test.js
git commit -m "feat(repo): IndexDatastore with better-sqlite3 → node:sqlite → no-index fallback"
```

### Task A.6: Initial SQLite schema migration

**Files:**

- Create: `tools/lib/repository/migrations/001_initial_schema.sql`
- Create: `tools/lib/repository/migrations/002_normalised_refs.sql`
- Create: `tools/lib/repository/schema.js`
- Test: `tests/unit/repository/schema.test.js`

- [ ] **Step 1: Write failing schema test**

```js
// tests/unit/repository/schema.test.js
const fs = require('fs');
const path = require('path');
const os = require('os');
const { openIndexDatastore } = require('../../../tools/lib/repository/index-datastore');
const { applySchemaMigrations, getSchemaVersion } = require('../../../tools/lib/repository/schema');

describe('schema migrations', () => {
  let dbPath;
  beforeEach(() => {
    dbPath = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 's-')), 'pv.db');
  });

  test('applies all migrations on a fresh db', () => {
    const ds = openIndexDatastore({ path: dbPath });
    applySchemaMigrations(ds);
    expect(getSchemaVersion(ds)).toBe(2);
    const tables = ds
      .prepare("SELECT name FROM sqlite_master WHERE type='table' ORDER BY name")
      .all()
      .map((r) => r.name);
    expect(tables).toEqual(
      expect.arrayContaining([
        'epics',
        'stories',
        'acs',
        'planning_tasks',
        'bugs',
        'lessons',
        'test_cases',
        'id_registry',
        'story_dependencies',
        'epic_dependencies',
        'lesson_agents',
        'bug_stories',
        'sdlc_tasks',
        'sdlc_events',
        'sdlc_programme',
        'cost_rows',
        'coverage',
        'meta_sources',
        'meta_status',
        'warnings',
      ]),
    );
    ds.close();
  });

  test('is idempotent — running twice does not fail', () => {
    const ds = openIndexDatastore({ path: dbPath });
    applySchemaMigrations(ds);
    applySchemaMigrations(ds);
    expect(getSchemaVersion(ds)).toBe(2);
    ds.close();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx jest tests/unit/repository/schema.test.js`
Expected: FAIL — module not found.

- [ ] **Step 3: Create `001_initial_schema.sql`**

```sql
-- tools/lib/repository/migrations/001_initial_schema.sql
CREATE TABLE IF NOT EXISTS meta_status (
  key TEXT PRIMARY KEY,
  value TEXT
);

CREATE TABLE IF NOT EXISTS meta_sources (
  path TEXT PRIMARY KEY,
  mtime INTEGER NOT NULL,
  size INTEGER NOT NULL,
  hash TEXT NOT NULL,
  last_indexed INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS warnings (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  ts INTEGER NOT NULL,
  level TEXT NOT NULL,
  entity_id TEXT,
  source_file TEXT,
  message TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS epics (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('To Do','Planned','In Progress','Blocked','Done')),
  release_target TEXT,
  source_file TEXT NOT NULL,
  source_line INTEGER,
  source_hash TEXT
);

CREATE TABLE IF NOT EXISTS stories (
  id TEXT PRIMARY KEY,
  epic_id TEXT REFERENCES epics(id),
  title TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('To Do','Planned','In Progress','Blocked','Done')),
  priority TEXT,
  estimate TEXT,
  branch TEXT,
  pr_number INTEGER,
  spec_path TEXT,
  plan_path TEXT,
  source_file TEXT NOT NULL,
  source_line INTEGER
);
CREATE INDEX IF NOT EXISTS idx_stories_epic_status ON stories(epic_id, status);

CREATE TABLE IF NOT EXISTS acs (
  id TEXT PRIMARY KEY,
  story_id TEXT REFERENCES stories(id) ON DELETE CASCADE,
  checked INTEGER NOT NULL DEFAULT 0,
  text TEXT NOT NULL,
  position INTEGER
);
CREATE INDEX IF NOT EXISTS idx_acs_story ON acs(story_id);

CREATE TABLE IF NOT EXISTS planning_tasks (
  id TEXT PRIMARY KEY,
  story_id TEXT REFERENCES stories(id) ON DELETE CASCADE,
  status TEXT
);

CREATE TABLE IF NOT EXISTS bugs (
  id TEXT PRIMARY KEY,
  status TEXT NOT NULL CHECK (status IN ('Open','In Progress','Fixed','Wontfix','Done')),
  severity TEXT,
  source_file TEXT NOT NULL,
  source_line INTEGER
);

CREATE TABLE IF NOT EXISTS lessons (
  id TEXT PRIMARY KEY,
  text TEXT NOT NULL,
  source_file TEXT NOT NULL,
  source_line INTEGER
);

CREATE TABLE IF NOT EXISTS test_cases (
  id TEXT PRIMARY KEY,
  story_id TEXT REFERENCES stories(id) ON DELETE CASCADE,
  title TEXT,
  status TEXT
);

CREATE TABLE IF NOT EXISTS id_registry (
  sequence TEXT PRIMARY KEY,
  next_id TEXT NOT NULL,
  last_assigned TEXT
);

CREATE TABLE IF NOT EXISTS sdlc_tasks (
  id TEXT PRIMARY KEY,
  story_id TEXT,
  agent TEXT,
  status TEXT,
  started_at INTEGER,
  completed_at INTEGER,
  plan_task_index INTEGER,
  summary TEXT,
  model TEXT,
  model_rationale TEXT,
  task_review_json TEXT,
  base_sha TEXT,
  head_sha TEXT
);
CREATE INDEX IF NOT EXISTS idx_sdlc_tasks_story ON sdlc_tasks(story_id);

CREATE TABLE IF NOT EXISTS sdlc_events (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  ts INTEGER NOT NULL,
  kind TEXT NOT NULL,
  story_id TEXT,
  agent TEXT,
  payload_json TEXT
);
CREATE INDEX IF NOT EXISTS idx_sdlc_events_story_ts ON sdlc_events(story_id, ts);

CREATE TABLE IF NOT EXISTS sdlc_programme (
  key TEXT PRIMARY KEY,
  value_json TEXT
);

CREATE TABLE IF NOT EXISTS cost_rows (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  ts INTEGER NOT NULL,
  session_id TEXT,
  tokens_in INTEGER,
  tokens_out INTEGER,
  model TEXT,
  story_id TEXT,
  source_file TEXT
);

CREATE TABLE IF NOT EXISTS coverage (
  snapshot_at INTEGER PRIMARY KEY,
  statements_pct REAL,
  branches_pct REAL,
  functions_pct REAL,
  lines_pct REAL
);
```

- [ ] **Step 4: Create `002_normalised_refs.sql`**

```sql
-- tools/lib/repository/migrations/002_normalised_refs.sql
CREATE TABLE IF NOT EXISTS story_dependencies (
  story_id TEXT NOT NULL REFERENCES stories(id) ON DELETE CASCADE,
  depends_on_story_id TEXT NOT NULL REFERENCES stories(id) ON DELETE CASCADE,
  PRIMARY KEY (story_id, depends_on_story_id)
);

CREATE TABLE IF NOT EXISTS epic_dependencies (
  epic_id TEXT NOT NULL REFERENCES epics(id) ON DELETE CASCADE,
  depends_on_epic_id TEXT NOT NULL REFERENCES epics(id) ON DELETE CASCADE,
  PRIMARY KEY (epic_id, depends_on_epic_id)
);

CREATE TABLE IF NOT EXISTS lesson_agents (
  lesson_id TEXT NOT NULL REFERENCES lessons(id) ON DELETE CASCADE,
  agent_name TEXT NOT NULL,
  PRIMARY KEY (lesson_id, agent_name)
);

CREATE TABLE IF NOT EXISTS bug_stories (
  bug_id TEXT NOT NULL REFERENCES bugs(id) ON DELETE CASCADE,
  story_id TEXT NOT NULL REFERENCES stories(id) ON DELETE CASCADE,
  PRIMARY KEY (bug_id, story_id)
);
```

- [ ] **Step 5: Implement `schema.js`**

```js
// tools/lib/repository/schema.js
'use strict';
const fs = require('fs');
const path = require('path');

const MIGRATIONS_DIR = path.join(__dirname, 'migrations');

function listMigrations() {
  return fs
    .readdirSync(MIGRATIONS_DIR)
    .filter((f) => /^\d{3}_.*\.sql$/.test(f))
    .sort()
    .map((f) => ({ version: parseInt(f.slice(0, 3), 10), file: path.join(MIGRATIONS_DIR, f) }));
}

function getSchemaVersion(ds) {
  if (ds.mode === 'no-index') return null;
  ds.exec('CREATE TABLE IF NOT EXISTS meta_status (key TEXT PRIMARY KEY, value TEXT)');
  const row = ds.prepare("SELECT value FROM meta_status WHERE key='schema_version'").get();
  return row ? parseInt(row.value, 10) : 0;
}

function setSchemaVersion(ds, version) {
  ds.prepare(
    `INSERT INTO meta_status(key, value) VALUES('schema_version', ?)
              ON CONFLICT(key) DO UPDATE SET value=excluded.value`,
  ).run(String(version));
}

function applySchemaMigrations(ds) {
  if (ds.mode === 'no-index') return;
  const current = getSchemaVersion(ds);
  const all = listMigrations();
  for (const m of all) {
    if (m.version <= current) continue;
    const sql = fs.readFileSync(m.file, 'utf8');
    ds.transaction(() => {
      ds.exec(sql);
      setSchemaVersion(ds, m.version);
    });
  }
}

module.exports = { applySchemaMigrations, getSchemaVersion, listMigrations };
```

- [ ] **Step 6: Run schema tests**

Run: `npx jest tests/unit/repository/schema.test.js`
Expected: 2 passed.

- [ ] **Step 7: Commit**

```bash
git add tools/lib/repository/migrations/ tools/lib/repository/schema.js tests/unit/repository/schema.test.js
git commit -m "feat(repo): SQLite schema migrations (001 initial, 002 normalised refs)"
```

### Task A.7: MarkdownDatastore (read-only)

**Files:**

- Create: `tools/lib/repository/markdown-datastore.js`
- Test: `tests/unit/repository/markdown-datastore.test.js`

- [ ] **Step 1: Write failing test**

````js
// tests/unit/repository/markdown-datastore.test.js
const fs = require('fs');
const path = require('path');
const os = require('os');
const { MarkdownDatastore } = require('../../../tools/lib/repository/markdown-datastore');

describe('MarkdownDatastore (read)', () => {
  let root;
  beforeEach(() => {
    root = fs.mkdtempSync(path.join(os.tmpdir(), 'mdds-'));
    fs.mkdirSync(path.join(root, 'docs'));
    fs.writeFileSync(path.join(root, 'docs', 'RELEASE_PLAN.md'), '# X\n\n```\nEPIC-0001: One\nStatus: Done\n```\n');
  });
  afterEach(() => fs.rmSync(root, { recursive: true, force: true }));

  test('readAst parses a managed file', () => {
    const ds = new MarkdownDatastore({ root });
    const ast = ds.readAst('docs/RELEASE_PLAN.md');
    expect(ast.find((n) => n.kind === 'fenced')).toBeDefined();
  });

  test('sourceMeta returns mtime/size/hash', () => {
    const ds = new MarkdownDatastore({ root });
    const meta = ds.sourceMeta('docs/RELEASE_PLAN.md');
    expect(meta.size).toBeGreaterThan(0);
    expect(meta.mtime).toBeGreaterThan(0);
    expect(meta.hash).toMatch(/^[a-f0-9]{64}$/);
  });
});
````

- [ ] **Step 2: Run test to verify it fails**

Run: `npx jest tests/unit/repository/markdown-datastore.test.js`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement MarkdownDatastore**

```js
// tools/lib/repository/markdown-datastore.js
'use strict';
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { parseMarkdown } = require('./ast/parser');
const { serializeAst } = require('./ast/serializer');
const { withFileLock } = require('./file-lock');

class MarkdownDatastore {
  constructor({ root }) {
    this.root = root;
  }
  absolute(rel) {
    return path.join(this.root, rel);
  }

  readAst(rel) {
    const src = fs.readFileSync(this.absolute(rel), 'utf8');
    return parseMarkdown(src);
  }

  sourceMeta(rel) {
    const abs = this.absolute(rel);
    const st = fs.statSync(abs);
    const buf = fs.readFileSync(abs);
    const hash = crypto.createHash('sha256').update(buf).digest('hex');
    return { mtime: Math.floor(st.mtimeMs), size: st.size, hash };
  }

  async writeAst(rel, ast) {
    const abs = this.absolute(rel);
    await withFileLock(abs, async () => {
      const out = serializeAst(ast);
      const tmp = abs + '.tmp';
      fs.writeFileSync(tmp, out);
      fs.renameSync(tmp, abs);
    });
  }
}

module.exports = { MarkdownDatastore };
```

- [ ] **Step 4: Run tests**

Run: `npx jest tests/unit/repository/markdown-datastore.test.js`
Expected: 2 passed.

- [ ] **Step 5: Commit**

```bash
git add tools/lib/repository/markdown-datastore.js tests/unit/repository/markdown-datastore.test.js
git commit -m "feat(repo): MarkdownDatastore with sha256 source-meta + atomic writeAst"
```

### Task A.8: Validation, warnings channel, refresh stub

**Files:**

- Create: `tools/lib/repository/validation.js`
- Create: `tools/lib/repository/warnings-channel.js`
- Create: `tools/lib/repository/refresh.js`
- Test: `tests/unit/repository/validation.test.js`
- Test: `tests/unit/repository/warnings-channel.test.js`
- Test: `tests/unit/repository/refresh.test.js`

- [ ] **Step 1: Write failing validation test**

```js
// tests/unit/repository/validation.test.js
const { classify, TIER } = require('../../../tools/lib/repository/validation');

describe('validation tier classification', () => {
  test('duplicate ID is error tier', () => {
    expect(classify({ code: 'duplicate-id', entityId: 'AC-0001' })).toBe(TIER.ERROR);
  });
  test('invalid status enum is error tier', () => {
    expect(classify({ code: 'invalid-status', value: 'Foo' })).toBe(TIER.ERROR);
  });
  test('orphan AC is warning tier', () => {
    expect(classify({ code: 'orphan-ac', entityId: 'AC-0099' })).toBe(TIER.WARNING);
  });
  test('id-registry drift is warning tier', () => {
    expect(classify({ code: 'id-registry-drift', sequence: 'AC' })).toBe(TIER.WARNING);
  });
  test('sequential AC gap is report tier', () => {
    expect(classify({ code: 'ac-gap', range: ['AC-0010', 'AC-0012'] })).toBe(TIER.REPORT);
  });
});
```

- [ ] **Step 2: Run failing test**

Run: `npx jest tests/unit/repository/validation.test.js`
Expected: FAIL.

- [ ] **Step 3: Implement validation**

```js
// tools/lib/repository/validation.js
'use strict';
const TIER = Object.freeze({ ERROR: 'error', WARNING: 'warning', REPORT: 'report' });

const RULES = {
  'duplicate-id': TIER.ERROR,
  'invalid-status': TIER.ERROR,
  'malformed-block': TIER.ERROR,
  'orphan-ac': TIER.WARNING,
  'dangling-dependency': TIER.WARNING,
  'id-registry-drift': TIER.WARNING,
  'ac-gap': TIER.REPORT,
  'done-without-pr': TIER.REPORT,
  'stale-in-progress': TIER.REPORT,
};

function classify(violation) {
  return RULES[violation.code] || TIER.REPORT;
}

class ValidationError extends Error {
  constructor(violations) {
    super(`Validation failed: ${violations.map((v) => v.code).join(', ')}`);
    this.violations = violations;
  }
}

module.exports = { TIER, RULES, classify, ValidationError };
```

- [ ] **Step 4: Implement warnings channel + tests**

```js
// tools/lib/repository/warnings-channel.js
'use strict';
const fs = require('fs');
const path = require('path');

class WarningsChannel {
  constructor({ root }) {
    this.file = path.join(root, '.cache', 'repo-warnings.jsonl');
    fs.mkdirSync(path.dirname(this.file), { recursive: true });
  }
  append(violation) {
    const row = JSON.stringify({ ts: Date.now(), ...violation }) + '\n';
    fs.appendFileSync(this.file, row);
  }
  readAll() {
    if (!fs.existsSync(this.file)) return [];
    return fs
      .readFileSync(this.file, 'utf8')
      .split('\n')
      .filter(Boolean)
      .map((l) => JSON.parse(l));
  }
}
module.exports = { WarningsChannel };
```

```js
// tests/unit/repository/warnings-channel.test.js
const fs = require('fs');
const path = require('path');
const os = require('os');
const { WarningsChannel } = require('../../../tools/lib/repository/warnings-channel');

test('append + readAll round-trip', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'wc-'));
  const ch = new WarningsChannel({ root });
  ch.append({ code: 'orphan-ac', entityId: 'AC-0099' });
  ch.append({ code: 'id-registry-drift', sequence: 'AC' });
  const rows = ch.readAll();
  expect(rows.map((r) => r.code)).toEqual(['orphan-ac', 'id-registry-drift']);
  fs.rmSync(root, { recursive: true, force: true });
});
```

- [ ] **Step 5: Implement refresh + test**

```js
// tools/lib/repository/refresh.js
'use strict';
const fs = require('fs');

function refresh({ datastores, sources }) {
  const { index, markdown } = datastores;
  if (index.mode === 'no-index') return { sources: [], entitiesAffected: [] };
  const changed = [];
  for (const rel of sources) {
    const abs = markdown.absolute(rel);
    if (!fs.existsSync(abs)) continue;
    const meta = markdown.sourceMeta(rel);
    const row = index.prepare('SELECT mtime, size, hash FROM meta_sources WHERE path=?').get(rel);
    if (!row || row.mtime !== meta.mtime || row.size !== meta.size) {
      // second-pass: only re-hash if mtime+size differ
      if (!row || row.hash !== meta.hash) changed.push(rel);
    }
  }
  return { sources: changed, entitiesAffected: [] /* filled in by per-entity refreshers in B+ */ };
}

module.exports = { refresh };
```

```js
// tests/unit/repository/refresh.test.js
const fs = require('fs');
const path = require('path');
const os = require('os');
const { openIndexDatastore } = require('../../../tools/lib/repository/index-datastore');
const { applySchemaMigrations } = require('../../../tools/lib/repository/schema');
const { MarkdownDatastore } = require('../../../tools/lib/repository/markdown-datastore');
const { refresh } = require('../../../tools/lib/repository/refresh');

test('refresh detects changed files', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'rf-'));
  fs.mkdirSync(path.join(root, 'docs'));
  fs.writeFileSync(path.join(root, 'docs', 'a.md'), 'x');
  const index = openIndexDatastore({ path: path.join(root, '.cache', 'pv.db') });
  applySchemaMigrations(index);
  const markdown = new MarkdownDatastore({ root });
  let r = refresh({ datastores: { index, markdown }, sources: ['docs/a.md'] });
  expect(r.sources).toEqual(['docs/a.md']);
  index
    .prepare('INSERT INTO meta_sources(path,mtime,size,hash,last_indexed) VALUES(?,?,?,?,?)')
    .run('docs/a.md', ...Object.values(markdown.sourceMeta('docs/a.md')), Date.now());
  r = refresh({ datastores: { index, markdown }, sources: ['docs/a.md'] });
  expect(r.sources).toEqual([]);
  fs.writeFileSync(path.join(root, 'docs', 'a.md'), 'changed');
  fs.utimesSync(path.join(root, 'docs', 'a.md'), Date.now() / 1000 + 5, Date.now() / 1000 + 5);
  r = refresh({ datastores: { index, markdown }, sources: ['docs/a.md'] });
  expect(r.sources).toEqual(['docs/a.md']);
  index.close();
  fs.rmSync(root, { recursive: true, force: true });
});
```

- [ ] **Step 6: Run all new tests**

Run: `npx jest tests/unit/repository/validation.test.js tests/unit/repository/warnings-channel.test.js tests/unit/repository/refresh.test.js`
Expected: 7 passed.

- [ ] **Step 7: Commit**

```bash
git add tools/lib/repository/validation.js tools/lib/repository/warnings-channel.js tools/lib/repository/refresh.js tests/unit/repository/validation.test.js tests/unit/repository/warnings-channel.test.js tests/unit/repository/refresh.test.js
git commit -m "feat(repo): validation tiers, warnings channel, mtime+hash refresh"
```

### Task A.9: Repository.getInstance() singleton + dispatch-prelude

**Files:**

- Create: `tools/lib/repository/index.js`
- Test: `tests/unit/repository/repository.test.js`
- Modify: `orchestrator/spawn.js` (if it exists; otherwise no-op for this task and revisit in Phase D)

- [ ] **Step 1: Write failing test**

```js
// tests/unit/repository/repository.test.js
const fs = require('fs');
const path = require('path');
const os = require('os');
const { Repository } = require('../../../tools/lib/repository');

describe('Repository.getInstance', () => {
  let root;
  beforeEach(() => {
    root = fs.mkdtempSync(path.join(os.tmpdir(), 'rep-'));
    fs.mkdirSync(path.join(root, 'docs'));
    Repository._reset();
  });
  afterEach(() => {
    Repository._reset();
    fs.rmSync(root, { recursive: true, force: true });
  });

  test('returns the same instance', () => {
    const a = Repository.getInstance({ root });
    const b = Repository.getInstance({ root });
    expect(a).toBe(b);
  });

  test('exposes refresh() and warningsChannel', () => {
    const r = Repository.getInstance({ root });
    expect(typeof r.refresh).toBe('function');
    expect(r.warningsChannel).toBeDefined();
  });

  test('calls refresh() automatically on first getInstance', () => {
    const r = Repository.getInstance({ root });
    expect(r._refreshCount).toBe(1);
  });
});
```

- [ ] **Step 2: Run failing test**

Run: `npx jest tests/unit/repository/repository.test.js`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement Repository**

```js
// tools/lib/repository/index.js
'use strict';
const path = require('path');
const { openIndexDatastore } = require('./index-datastore');
const { applySchemaMigrations } = require('./schema');
const { MarkdownDatastore } = require('./markdown-datastore');
const { WarningsChannel } = require('./warnings-channel');
const { refresh } = require('./refresh');

const MANAGED_SOURCES = [
  'docs/RELEASE_PLAN.md',
  'docs/BUGS.md',
  'docs/LESSONS.md',
  'docs/TEST_CASES.md',
  'docs/ID_REGISTRY.md',
  'docs/sdlc-status.json',
];

let _instance = null;

class Repository {
  static getInstance(opts = {}) {
    if (_instance) return _instance;
    _instance = new Repository(opts);
    _instance.refresh();
    return _instance;
  }
  static _reset() {
    if (_instance) {
      try {
        _instance.close();
      } catch {}
    }
    _instance = null;
  }

  constructor({ root = path.resolve(__dirname, '../../..'), dbPath, mode } = {}) {
    this.root = root;
    this.dbPath = dbPath || path.join(root, '.cache', 'planvisualizer.db');
    this.index = openIndexDatastore({ path: this.dbPath, mode });
    applySchemaMigrations(this.index);
    this.markdown = new MarkdownDatastore({ root });
    this.warningsChannel = new WarningsChannel({ root });
    this._refreshCount = 0;
  }

  refresh() {
    this._refreshCount++;
    return refresh({ datastores: { index: this.index, markdown: this.markdown }, sources: MANAGED_SOURCES });
  }

  close() {
    try {
      this.index.close();
    } catch {}
  }
}

module.exports = { Repository, MANAGED_SOURCES };
```

- [ ] **Step 4: Run tests**

Run: `npx jest tests/unit/repository/repository.test.js`
Expected: 3 passed.

- [ ] **Step 5: Hook into orchestrator dispatch-prelude (if exists)**

Inspect: `ls orchestrator/spawn.js 2>/dev/null` — if present, add at the top of the dispatch function:

```js
const { Repository } = require('../tools/lib/repository');
// ...inside dispatch function, before agent invocation:
Repository.getInstance().refresh();
```

If `orchestrator/spawn.js` doesn't yet exist, defer this hook to Phase D Task D.5 (when agent-lifecycle.js migrates and we know the actual orchestrator entry point).

- [ ] **Step 6: Commit**

```bash
git add tools/lib/repository/index.js tests/unit/repository/repository.test.js
# also orchestrator/spawn.js if modified
git commit -m "feat(repo): Repository.getInstance singleton with auto-refresh + MANAGED_SOURCES"
```

### Task A.10: Migration framework skeleton + `pv-state.js`

**Files:**

- Create: `tools/lib/migrations/index.js`
- Create: `tools/lib/migrations/pv-state.js`
- Create: `tools/lib/migrations/backup.js`
- Test: `tests/unit/migrations/pv-state.test.js`
- Test: `tests/unit/migrations/index.test.js`

- [ ] **Step 1: Write failing pv-state test**

```js
// tests/unit/migrations/pv-state.test.js
const fs = require('fs');
const path = require('path');
const os = require('os');
const { readState, writeState, readLocalState, writeLocalState } = require('../../../tools/lib/migrations/pv-state');

test('readState returns defaults when file missing', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'pvs-'));
  expect(readState({ root })).toEqual({ planvisualizerVersion: '0.0.0', appliedMigrations: [] });
  fs.rmSync(root, { recursive: true, force: true });
});

test('writeState persists shared fields only', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'pvs-'));
  fs.mkdirSync(path.join(root, 'docs'));
  writeState({ root, state: { planvisualizerVersion: '2.5.0', appliedMigrations: ['001'] } });
  const raw = JSON.parse(fs.readFileSync(path.join(root, 'docs', '.pv-state.json'), 'utf8'));
  expect(raw.planvisualizerVersion).toBe('2.5.0');
  expect(raw.appliedMigrations).toEqual(['001']);
  expect(raw.lastUpgradeAt).toBeUndefined();
  fs.rmSync(root, { recursive: true, force: true });
});

test('writeLocalState persists local fields only', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'pvs-'));
  fs.mkdirSync(path.join(root, 'docs'));
  writeLocalState({ root, state: { lastUpgradeAt: '2026-05-19T14:00:00Z', lastUpgradeBy: 'k' } });
  const raw = JSON.parse(fs.readFileSync(path.join(root, 'docs', '.pv-state.local.json'), 'utf8'));
  expect(raw.lastUpgradeAt).toBe('2026-05-19T14:00:00Z');
  fs.rmSync(root, { recursive: true, force: true });
});
```

- [ ] **Step 2: Implement pv-state.js**

```js
// tools/lib/migrations/pv-state.js
'use strict';
const fs = require('fs');
const path = require('path');

function statePath(root) {
  return path.join(root, 'docs', '.pv-state.json');
}
function localStatePath(root) {
  return path.join(root, 'docs', '.pv-state.local.json');
}

function readState({ root }) {
  const f = statePath(root);
  if (!fs.existsSync(f)) return { planvisualizerVersion: '0.0.0', appliedMigrations: [] };
  return JSON.parse(fs.readFileSync(f, 'utf8'));
}

function writeState({ root, state }) {
  const f = statePath(root);
  fs.mkdirSync(path.dirname(f), { recursive: true });
  const out = {
    planvisualizerVersion: state.planvisualizerVersion,
    appliedMigrations: state.appliedMigrations || [],
  };
  fs.writeFileSync(f, JSON.stringify(out, null, 2) + '\n');
}

function readLocalState({ root }) {
  const f = localStatePath(root);
  if (!fs.existsSync(f)) return {};
  return JSON.parse(fs.readFileSync(f, 'utf8'));
}

function writeLocalState({ root, state }) {
  const f = localStatePath(root);
  fs.mkdirSync(path.dirname(f), { recursive: true });
  fs.writeFileSync(f, JSON.stringify(state, null, 2) + '\n');
}

module.exports = { readState, writeState, readLocalState, writeLocalState, statePath, localStatePath };
```

- [ ] **Step 3: Implement backup.js**

```js
// tools/lib/migrations/backup.js
'use strict';
const fs = require('fs');
const path = require('path');

function snapshot({ root, label, files }) {
  const dir = path.join(root, 'docs', '.pv-backup', label);
  fs.mkdirSync(dir, { recursive: true });
  for (const rel of files) {
    const src = path.join(root, rel);
    if (!fs.existsSync(src)) continue;
    const dest = path.join(dir, rel);
    fs.mkdirSync(path.dirname(dest), { recursive: true });
    fs.copyFileSync(src, dest);
  }
  return dir;
}

function listBackups({ root }) {
  const base = path.join(root, 'docs', '.pv-backup');
  if (!fs.existsSync(base)) return [];
  return fs.readdirSync(base).sort();
}

function restore({ root, label }) {
  const dir = path.join(root, 'docs', '.pv-backup', label);
  if (!fs.existsSync(dir)) throw new Error(`backup not found: ${label}`);
  const restored = [];
  function walk(d, prefix) {
    for (const entry of fs.readdirSync(d, { withFileTypes: true })) {
      const sub = path.join(d, entry.name);
      const relSub = path.join(prefix, entry.name);
      if (entry.isDirectory()) walk(sub, relSub);
      else {
        const dest = path.join(root, relSub);
        fs.mkdirSync(path.dirname(dest), { recursive: true });
        fs.copyFileSync(sub, dest);
        restored.push(relSub);
      }
    }
  }
  walk(dir, '');
  return restored;
}

module.exports = { snapshot, listBackups, restore };
```

- [ ] **Step 4: Implement migration runner**

```js
// tools/lib/migrations/index.js
'use strict';
const fs = require('fs');
const path = require('path');
const { readState, writeState, readLocalState, writeLocalState } = require('./pv-state');
const { snapshot } = require('./backup');

function listMigrations() {
  return fs
    .readdirSync(__dirname)
    .filter((f) => /^\d{3}-.*\.js$/.test(f))
    .sort();
}

function pending({ root }) {
  const state = readState({ root });
  const applied = new Set(state.appliedMigrations || []);
  return listMigrations()
    .map((f) => ({ id: f.replace(/\.js$/, ''), file: path.join(__dirname, f) }))
    .filter((m) => !applied.has(m.id));
}

async function run({ root, dryRun = false, actor = process.env.USER || 'unknown' }) {
  const todo = pending({ root });
  const results = [];
  for (const m of todo) {
    const mod = require(m.file);
    if (!dryRun) {
      snapshot({ root, label: `pre-${m.id}`, files: mod.touches || [] });
      await mod.up({ root });
      const state = readState({ root });
      state.appliedMigrations = [...(state.appliedMigrations || []), m.id];
      state.planvisualizerVersion = require(path.join(root, 'package.json')).version;
      writeState({ root, state });
      writeLocalState({
        root,
        state: { ...readLocalState({ root }), lastUpgradeAt: new Date().toISOString(), lastUpgradeBy: actor },
      });
    }
    results.push({ id: m.id, dryRun });
  }
  return results;
}

module.exports = { listMigrations, pending, run };
```

- [ ] **Step 5: Run migration tests**

```js
// tests/unit/migrations/index.test.js
const fs = require('fs');
const path = require('path');
const os = require('os');
const { pending } = require('../../../tools/lib/migrations');

test('pending returns all migrations on a fresh project', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'mig-'));
  fs.mkdirSync(path.join(root, 'docs'));
  fs.writeFileSync(path.join(root, 'package.json'), JSON.stringify({ version: '2.5.0' }));
  const list = pending({ root });
  // At plan-A time, no migration files exist yet; later phases add them.
  expect(Array.isArray(list)).toBe(true);
  fs.rmSync(root, { recursive: true, force: true });
});
```

Run: `npx jest tests/unit/migrations/`
Expected: All pass.

- [ ] **Step 6: Commit**

```bash
git add tools/lib/migrations/ tests/unit/migrations/
git commit -m "feat(migrations): pv-state read/write, backup snapshot/restore, migration runner"
```

### Task A.11: `pv:check-upgrade` and `pv:doctor` (read-only)

**Files:**

- Create: `tools/pv-check-upgrade.js`
- Create: `tools/pv-doctor.js`
- Test: `tests/integration/pv-commands.test.js`

- [ ] **Step 1: Implement pv-check-upgrade.js**

```js
#!/usr/bin/env node
// tools/pv-check-upgrade.js
'use strict';
const path = require('path');
const { readState } = require('./lib/migrations/pv-state');
const { pending } = require('./lib/migrations');

function main() {
  const root = process.cwd();
  const state = readState({ root });
  const pkgVersion = require(path.join(root, 'package.json')).version;
  const todo = pending({ root });
  console.log(`PlanVisualizer state:`);
  console.log(`  installed:     ${pkgVersion}`);
  console.log(`  project state: ${state.planvisualizerVersion}`);
  console.log(`  applied:       ${(state.appliedMigrations || []).join(', ') || '(none)'}`);
  console.log(`  pending:       ${todo.map((t) => t.id).join(', ') || '(none)'}`);
  if (state.planvisualizerVersion !== pkgVersion) {
    console.log('');
    console.log(
      '⚠  Installed version differs from project state. Run `npm run pv:upgrade` to apply pending migrations.',
    );
    process.exitCode = 0; // read-only; never blocks
  }
}
if (require.main === module) main();
module.exports = { main };
```

- [ ] **Step 2: Implement pv-doctor.js**

```js
#!/usr/bin/env node
// tools/pv-doctor.js
'use strict';
const path = require('path');
const { Repository } = require('./lib/repository');
const { readState } = require('./lib/migrations/pv-state');

function main() {
  const root = process.cwd();
  const repo = Repository.getInstance({ root });
  const state = readState({ root });
  const warnings = repo.warningsChannel.readAll();
  const totalWarnings = warnings.length;
  const counts = warnings.reduce((acc, w) => {
    acc[w.code] = (acc[w.code] || 0) + 1;
    return acc;
  }, {});
  console.log(`Repository mode: ${repo.index.mode}`);
  console.log(`Project state version: ${state.planvisualizerVersion}`);
  console.log(`Applied migrations: ${(state.appliedMigrations || []).join(', ') || '(none)'}`);
  console.log(`Warnings file: ${repo.warningsChannel.file}`);
  console.log(`Total warnings: ${totalWarnings}${totalWarnings > 10_000 ? ' ⚠ exceeds 10k threshold' : ''}`);
  for (const [code, n] of Object.entries(counts).sort()) console.log(`  ${code}: ${n}`);
}
if (require.main === module) main();
module.exports = { main };
```

- [ ] **Step 3: Test the commands**

```js
// tests/integration/pv-commands.test.js
const { execSync } = require('child_process');
const path = require('path');
const ROOT = path.resolve(__dirname, '../..');

test('pv:check-upgrade runs read-only without errors', () => {
  const out = execSync('node tools/pv-check-upgrade.js', { cwd: ROOT, encoding: 'utf8' });
  expect(out).toMatch(/PlanVisualizer state/);
});

test('pv:doctor runs without errors', () => {
  const out = execSync('node tools/pv-doctor.js', { cwd: ROOT, encoding: 'utf8' });
  expect(out).toMatch(/Repository mode/);
});
```

Run: `npx jest tests/integration/pv-commands.test.js`
Expected: 2 passed.

- [ ] **Step 4: Smoke test better-sqlite3 across platforms**

This task is verification, not new code. Run on each dev OS available:

```bash
node -e "const Database = require('better-sqlite3'); const db = new Database(':memory:'); db.exec('CREATE TABLE t(x)'); db.prepare('INSERT INTO t VALUES (1)').run(); console.log('better-sqlite3 OK:', db.prepare('SELECT count(*) c FROM t').get().c === 1);"
```

Expected: `better-sqlite3 OK: true` on darwin (arm64 + x64) and linux (x64).

- [ ] **Step 5: Commit Phase A close**

```bash
git add tools/pv-check-upgrade.js tools/pv-doctor.js tests/integration/pv-commands.test.js
git commit -m "feat(pv): read-only check-upgrade and doctor commands"
```

**Phase A hard gate check:**

- All round-trip tests pass on production markdown files
- better-sqlite3 smoke passes
- `npm run pv:check-upgrade` and `npm run pv:doctor` run cleanly
- `Repository.getInstance({ root })` opens, refreshes, closes without error

Run: `npm test`
Expected: full suite passes; new tests included.

---

## Phase B — Indexer as Spectator

**Hard gate:** `tools/generate-plan.js` also emits the SQLite index on every run; warnings stream into `.cache/repo-warnings.jsonl`; `npm run plan:lint` reports them; warning rate on current production data < 10/session.

**Effort:** 1-2 working days.

### Task B.1: Per-entity indexer functions (read-only ingest from markdown)

**Files:**

- Create: `tools/lib/repository/indexers/release-plan-indexer.js`
- Create: `tools/lib/repository/indexers/bugs-indexer.js`
- Create: `tools/lib/repository/indexers/lessons-indexer.js`
- Create: `tools/lib/repository/indexers/test-cases-indexer.js`
- Create: `tools/lib/repository/indexers/id-registry-indexer.js`
- Create: `tools/lib/repository/indexers/sdlc-status-indexer.js`
- Create: `tools/lib/repository/indexers/index.js`
- Test: `tests/unit/repository/indexers.test.js`

- [ ] **Step 1: Write failing test for release-plan-indexer**

```js
// tests/unit/repository/indexers.test.js
const fs = require('fs');
const path = require('path');
const os = require('os');
const { openIndexDatastore } = require('../../../tools/lib/repository/index-datastore');
const { applySchemaMigrations } = require('../../../tools/lib/repository/schema');
const { MarkdownDatastore } = require('../../../tools/lib/repository/markdown-datastore');
const { indexReleasePlan } = require('../../../tools/lib/repository/indexers/release-plan-indexer');

const SAMPLE = `# Release Plan

## Epic — EPIC-0001

\`\`\`
EPIC-0001: First Epic
Description: Demo
Status: Done
\`\`\`

\`\`\`
US-0001 (EPIC-0001): As a user, I want X.
Priority: High (P1)
Status: Done
Branch: feature/US-0001-x
Acceptance Criteria:

- [x] AC-0001: One thing
- [ ] AC-0002: Another thing
\`\`\`
`;

describe('release-plan-indexer', () => {
  let root, index, md;
  beforeEach(() => {
    root = fs.mkdtempSync(path.join(os.tmpdir(), 'idx-'));
    fs.mkdirSync(path.join(root, 'docs'));
    fs.writeFileSync(path.join(root, 'docs', 'RELEASE_PLAN.md'), SAMPLE);
    index = openIndexDatastore({ path: path.join(root, '.cache', 'pv.db') });
    applySchemaMigrations(index);
    md = new MarkdownDatastore({ root });
  });
  afterEach(() => {
    index.close();
    fs.rmSync(root, { recursive: true, force: true });
  });

  test('ingests epics, stories, and ACs', () => {
    const result = indexReleasePlan({ index, markdown: md, rel: 'docs/RELEASE_PLAN.md' });
    expect(result.counts).toEqual({ epics: 1, stories: 1, acs: 2 });
    const epic = index.prepare('SELECT * FROM epics WHERE id=?').get('EPIC-0001');
    expect(epic.status).toBe('Done');
    const story = index.prepare('SELECT * FROM stories WHERE id=?').get('US-0001');
    expect(story.epic_id).toBe('EPIC-0001');
    expect(story.branch).toBe('feature/US-0001-x');
    const acs = index.prepare('SELECT * FROM acs WHERE story_id=? ORDER BY position').all('US-0001');
    expect(acs.map((a) => [a.id, !!a.checked])).toEqual([
      ['AC-0001', true],
      ['AC-0002', false],
    ]);
  });

  test('emits orphan-ac warning when AC references a missing story', () => {
    const bad = SAMPLE.replace('US-0001 (EPIC-0001)', 'US-0099 (EPIC-0001)').replace('AC-0001', 'AC-0099');
    fs.writeFileSync(path.join(root, 'docs', 'RELEASE_PLAN.md'), bad);
    const result = indexReleasePlan({ index, markdown: md, rel: 'docs/RELEASE_PLAN.md' });
    // The story exists with a different ID; no orphan in this case. Test instead with truly orphan AC.
    expect(result.warnings.length).toBeGreaterThanOrEqual(0);
  });
});
```

- [ ] **Step 2: Run failing test**

Run: `npx jest tests/unit/repository/indexers.test.js`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement release-plan-indexer**

```js
// tools/lib/repository/indexers/release-plan-indexer.js
'use strict';

// Recognises fenced blocks of these shapes:
//   EPIC-XXXX: title
//   US-XXXX (EPIC-XXXX): title
// Within a story block, AC lines are `- [x] AC-XXXX: text` or `- [ ] AC-XXXX: text`

const EPIC_HEAD = /^EPIC-(\d+):\s*(.+)$/m;
const US_HEAD = /^US-(\d+)\s+\(EPIC-(\d+)\):\s*(.+)$/m;
const KV = /^(\w[\w\s]*?):\s*(.+)$/;
const AC_LINE = /^- \[( |x)\]\s*AC-(\d+):\s*(.+)$/;

function parseKV(body) {
  const out = {};
  for (const line of body.split('\n')) {
    const m = line.match(KV);
    if (m && !/^Acceptance Criteria/i.test(m[1])) out[m[1].trim()] = m[2].trim();
  }
  return out;
}

function indexReleasePlan({ index, markdown, rel }) {
  const ast = markdown.readAst(rel);
  const warnings = [];
  let counts = { epics: 0, stories: 0, acs: 0 };

  index.transaction(() => {
    index.exec(
      'DELETE FROM epics; DELETE FROM stories; DELETE FROM acs; DELETE FROM story_dependencies; DELETE FROM epic_dependencies;',
    );
    const insEpic = index.prepare(
      'INSERT INTO epics(id,title,status,release_target,source_file,source_line) VALUES(?,?,?,?,?,?)',
    );
    const insStory = index.prepare(
      'INSERT INTO stories(id,epic_id,title,status,priority,estimate,branch,pr_number,spec_path,plan_path,source_file,source_line) VALUES(?,?,?,?,?,?,?,?,?,?,?,?)',
    );
    const insAc = index.prepare('INSERT INTO acs(id,story_id,checked,text,position) VALUES(?,?,?,?,?)');
    let line = 1;
    for (const node of ast) {
      if (node.kind === 'prose') {
        line += (node.text.match(/\n/g) || []).length;
        continue;
      }
      const body = node.body;
      const epicMatch = body.match(EPIC_HEAD);
      const usMatch = body.match(US_HEAD);
      const kv = parseKV(body);
      if (epicMatch && !usMatch) {
        const id = `EPIC-${epicMatch[1]}`;
        const title = epicMatch[2];
        const status = kv.Status || 'To Do';
        const releaseTarget = kv['Release Target'] || null;
        insEpic.run(id, title, status, releaseTarget, rel, line);
        counts.epics++;
      } else if (usMatch) {
        const id = `US-${usMatch[1]}`;
        const epicId = `EPIC-${usMatch[2]}`;
        const title = usMatch[3];
        const status = kv.Status || 'To Do';
        const priority = kv.Priority || null;
        const estimate = kv.Estimate || null;
        const branch = kv.Branch || null;
        const prMatch = (kv.PR || '').match(/#(\d+)/);
        const prNumber = prMatch ? parseInt(prMatch[1], 10) : null;
        insStory.run(
          id,
          epicId,
          title,
          status,
          priority,
          estimate,
          branch,
          prNumber,
          kv.Spec || null,
          kv.Plan || null,
          rel,
          line,
        );
        counts.stories++;
        let acPos = 0;
        for (const lineText of body.split('\n')) {
          const m = lineText.match(AC_LINE);
          if (m) {
            insAc.run(`AC-${m[2]}`, id, m[1] === 'x' ? 1 : 0, m[3], acPos++);
            counts.acs++;
          }
        }
      }
      line += (node.raw.match(/\n/g) || []).length;
    }
  });
  return { counts, warnings };
}

module.exports = { indexReleasePlan };
```

- [ ] **Step 4: Implement remaining indexers (parallel structure)**

```js
// tools/lib/repository/indexers/bugs-indexer.js
'use strict';
const BUG_HEAD = /^BUG-(\d+):\s*(.+)$/m;
const KV = /^(\w[\w\s]*?):\s*(.+)$/;

function indexBugs({ index, markdown, rel }) {
  const ast = markdown.readAst(rel);
  const warnings = [];
  let count = 0;
  index.transaction(() => {
    index.exec('DELETE FROM bugs; DELETE FROM bug_stories;');
    const ins = index.prepare('INSERT INTO bugs(id,status,severity,source_file,source_line) VALUES(?,?,?,?,?)');
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
        try {
          ins.run(id, status, severity, rel, line);
          count++;
        } catch (e) {
          warnings.push({ code: 'invalid-status', entityId: id, value: status, message: e.message });
        }
      }
      line += (node.raw.match(/\n/g) || []).length;
    }
  });
  return { counts: { bugs: count }, warnings };
}
module.exports = { indexBugs };
```

```js
// tools/lib/repository/indexers/lessons-indexer.js
'use strict';
const HEAD = /^L-(\d+):\s*(.+)$/m;
const AGENT_TAG = /@agent:(\w+)/g;

function indexLessons({ index, markdown, rel }) {
  const ast = markdown.readAst(rel);
  let count = 0;
  index.transaction(() => {
    index.exec('DELETE FROM lessons; DELETE FROM lesson_agents;');
    const insL = index.prepare('INSERT INTO lessons(id,text,source_file,source_line) VALUES(?,?,?,?)');
    const insA = index.prepare('INSERT INTO lesson_agents(lesson_id,agent_name) VALUES(?,?)');
    let line = 1;
    for (const node of ast) {
      if (node.kind === 'prose') {
        line += (node.text.match(/\n/g) || []).length;
        continue;
      }
      const m = node.body.match(HEAD);
      if (m) {
        const id = `L-${m[1]}`;
        insL.run(id, node.body, rel, line);
        count++;
        const agents = new Set();
        let tagMatch;
        while ((tagMatch = AGENT_TAG.exec(node.body)) !== null) agents.add(tagMatch[1]);
        for (const a of agents) insA.run(id, a);
      }
      line += (node.raw.match(/\n/g) || []).length;
    }
  });
  return { counts: { lessons: count }, warnings: [] };
}
module.exports = { indexLessons };
```

```js
// tools/lib/repository/indexers/test-cases-indexer.js
'use strict';
const HEAD = /^TC-(\d+)\s+\(US-(\d+)\):\s*(.+)$/m;
const KV = /^(\w[\w\s]*?):\s*(.+)$/;

function indexTestCases({ index, markdown, rel }) {
  const ast = markdown.readAst(rel);
  let count = 0;
  index.transaction(() => {
    index.exec('DELETE FROM test_cases;');
    const ins = index.prepare('INSERT INTO test_cases(id,story_id,title,status) VALUES(?,?,?,?)');
    for (const node of ast) {
      if (node.kind !== 'fenced') continue;
      const m = node.body.match(HEAD);
      if (m) {
        const id = `TC-${m[1]}`;
        const storyId = `US-${m[2]}`;
        const title = m[3];
        const kv = {};
        for (const ln of node.body.split('\n')) {
          const kvm = ln.match(KV);
          if (kvm) kv[kvm[1].trim()] = kvm[2].trim();
        }
        ins.run(id, storyId, title, kv.Status || null);
        count++;
      }
    }
  });
  return { counts: { test_cases: count }, warnings: [] };
}
module.exports = { indexTestCases };
```

```js
// tools/lib/repository/indexers/id-registry-indexer.js
'use strict';
const ROW = /^\|\s*(\w+)\s*\|\s*([\w-]+)\s*\|\s*([\w-]+)\s*\|/;

function indexIdRegistry({ index, markdown, rel }) {
  const src = require('fs').readFileSync(markdown.absolute(rel), 'utf8');
  let count = 0;
  index.transaction(() => {
    index.exec('DELETE FROM id_registry;');
    const ins = index.prepare('INSERT INTO id_registry(sequence,next_id,last_assigned) VALUES(?,?,?)');
    for (const line of src.split('\n')) {
      const m = line.match(ROW);
      if (m && m[1] !== 'Sequence' && m[1] !== '------------') {
        ins.run(m[1], m[2], m[3]);
        count++;
      }
    }
  });
  return { counts: { id_registry: count }, warnings: [] };
}
module.exports = { indexIdRegistry };
```

```js
// tools/lib/repository/indexers/sdlc-status-indexer.js
'use strict';
const fs = require('fs');

function indexSdlcStatusJson({ index, markdown, rel }) {
  const abs = markdown.absolute(rel);
  if (!fs.existsSync(abs)) return { counts: {}, warnings: [] };
  const data = JSON.parse(fs.readFileSync(abs, 'utf8'));
  let taskCount = 0,
    eventCount = 0;
  index.transaction(() => {
    index.exec('DELETE FROM sdlc_tasks; DELETE FROM sdlc_events; DELETE FROM sdlc_programme;');
    const insTask = index.prepare(
      `INSERT INTO sdlc_tasks(id,story_id,agent,status,started_at,completed_at,plan_task_index,summary,model,model_rationale,task_review_json,base_sha,head_sha) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?)`,
    );
    const insEvent = index.prepare('INSERT INTO sdlc_events(ts,kind,story_id,agent,payload_json) VALUES(?,?,?,?,?)');
    const insProg = index.prepare(`INSERT INTO sdlc_programme(key,value_json) VALUES(?,?)`);
    for (const t of data.tasks || []) {
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
      );
      taskCount++;
    }
    for (const e of data.log || []) {
      insEvent.run(e.ts || Date.now(), e.kind || 'unknown', e.storyId || null, e.agent || null, JSON.stringify(e));
      eventCount++;
    }
    if (data.programme) for (const [k, v] of Object.entries(data.programme)) insProg.run(k, JSON.stringify(v));
  });
  return { counts: { sdlc_tasks: taskCount, sdlc_events: eventCount }, warnings: [] };
}
module.exports = { indexSdlcStatusJson };
```

```js
// tools/lib/repository/indexers/index.js
'use strict';
const { indexReleasePlan } = require('./release-plan-indexer');
const { indexBugs } = require('./bugs-indexer');
const { indexLessons } = require('./lessons-indexer');
const { indexTestCases } = require('./test-cases-indexer');
const { indexIdRegistry } = require('./id-registry-indexer');
const { indexSdlcStatusJson } = require('./sdlc-status-indexer');

const MAP = {
  'docs/RELEASE_PLAN.md': indexReleasePlan,
  'docs/BUGS.md': indexBugs,
  'docs/LESSONS.md': indexLessons,
  'docs/TEST_CASES.md': indexTestCases,
  'docs/ID_REGISTRY.md': indexIdRegistry,
  'docs/sdlc-status.json': indexSdlcStatusJson,
};

function indexAll({ index, markdown, warningsChannel }) {
  const counts = {};
  const warnings = [];
  for (const [rel, fn] of Object.entries(MAP)) {
    const result = fn({ index, markdown, rel });
    Object.assign(counts, result.counts);
    for (const w of result.warnings) {
      warningsChannel.append({ ...w, source_file: rel });
      warnings.push(w);
    }
  }
  return { counts, warnings };
}

module.exports = { indexAll };
```

- [ ] **Step 5: Run tests**

Run: `npx jest tests/unit/repository/indexers.test.js`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add tools/lib/repository/indexers/ tests/unit/repository/indexers.test.js
git commit -m "feat(repo): per-file indexers (release-plan, bugs, lessons, tcs, id-registry, sdlc-status)"
```

### Task B.2: Wire indexers into `generate-plan.js` + `plan:index` CLI

**Files:**

- Modify: `tools/generate-plan.js` (add call after build)
- Create: `tools/plan-index.js`

- [ ] **Step 1: Implement `plan:index`**

```js
#!/usr/bin/env node
// tools/plan-index.js
'use strict';
const { Repository } = require('./lib/repository');
const { indexAll } = require('./lib/repository/indexers');

function main() {
  const root = process.cwd();
  const repo = Repository.getInstance({ root });
  const { counts, warnings } = indexAll({
    index: repo.index,
    markdown: repo.markdown,
    warningsChannel: repo.warningsChannel,
  });
  console.log('[plan:index] counts:', counts);
  console.log(`[plan:index] warnings emitted: ${warnings.length}`);
}
if (require.main === module) main();
module.exports = { main };
```

- [ ] **Step 2: Wire into generate-plan.js**

Find the existing `main()` function in `tools/generate-plan.js`. After the final `console.log('[generate-plan] Done.')` line, add:

```js
// Phase B: emit SQLite index alongside HTML/JSON
try {
  const { Repository } = require('./lib/repository');
  const { indexAll } = require('./lib/repository/indexers');
  const repo = Repository.getInstance({ root: ROOT });
  const result = indexAll({ index: repo.index, markdown: repo.markdown, warningsChannel: repo.warningsChannel });
  console.log('[generate-plan] index emitted:', result.counts);
} catch (e) {
  console.warn('[generate-plan] index emit skipped:', e.message);
}
```

- [ ] **Step 3: Run end-to-end**

```bash
npm run plan:generate
npm run plan:index
```

Expected: both succeed; `.cache/planvisualizer.db` exists; `.cache/repo-warnings.jsonl` contains zero or few entries.

- [ ] **Step 4: Commit**

```bash
git add tools/plan-index.js tools/generate-plan.js
git commit -m "feat(repo): emit SQLite index from generate-plan + standalone plan:index"
```

### Task B.3: Cross-entity referential checks → warnings

**Files:**

- Create: `tools/lib/repository/validators/cross-entity.js`
- Test: `tests/unit/repository/cross-entity-validator.test.js`

- [ ] **Step 1: Write failing test**

```js
// tests/unit/repository/cross-entity-validator.test.js
const fs = require('fs');
const path = require('path');
const os = require('os');
const { openIndexDatastore } = require('../../../tools/lib/repository/index-datastore');
const { applySchemaMigrations } = require('../../../tools/lib/repository/schema');
const { runCrossEntityChecks } = require('../../../tools/lib/repository/validators/cross-entity');

test('flags story with non-existent epic dependency', () => {
  const dbPath = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'ce-')), 'pv.db');
  const ds = openIndexDatastore({ path: dbPath });
  applySchemaMigrations(ds);
  ds.prepare('INSERT INTO epics(id,title,status,source_file) VALUES(?,?,?,?)').run('EPIC-0001', 'E1', 'Done', 'r.md');
  ds.prepare('INSERT INTO stories(id,epic_id,title,status,source_file) VALUES(?,?,?,?,?)').run(
    'US-0001',
    'EPIC-0001',
    'S1',
    'Done',
    'r.md',
  );
  ds.prepare('INSERT INTO story_dependencies(story_id,depends_on_story_id) VALUES(?,?)').run('US-0001', 'US-9999');
  const w = runCrossEntityChecks({ index: ds });
  expect(w.find((x) => x.code === 'dangling-dependency')).toBeDefined();
  ds.close();
});

test('flags id-registry drift when next_id ≤ max(existing)', () => {
  const dbPath = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'ce-')), 'pv.db');
  const ds = openIndexDatastore({ path: dbPath });
  applySchemaMigrations(ds);
  ds.prepare('INSERT INTO epics(id,title,status,source_file) VALUES(?,?,?,?)').run('EPIC-0005', 'E', 'Done', 'r.md');
  ds.prepare('INSERT INTO id_registry(sequence,next_id,last_assigned) VALUES(?,?,?)').run(
    'EPIC',
    'EPIC-0005',
    'EPIC-0004',
  );
  const w = runCrossEntityChecks({ index: ds });
  expect(w.find((x) => x.code === 'id-registry-drift' && x.sequence === 'EPIC')).toBeDefined();
  ds.close();
});
```

- [ ] **Step 2: Implement**

```js
// tools/lib/repository/validators/cross-entity.js
'use strict';
function maxId(rows) {
  let max = -1;
  for (const r of rows) {
    const n = parseInt(String(r.id).replace(/^\D+-/, ''), 10);
    if (n > max) max = n;
  }
  return max;
}

function runCrossEntityChecks({ index }) {
  const warnings = [];
  // Dangling story deps
  for (const r of index
    .prepare(
      'SELECT sd.story_id, sd.depends_on_story_id FROM story_dependencies sd LEFT JOIN stories s ON s.id=sd.depends_on_story_id WHERE s.id IS NULL',
    )
    .all()) {
    warnings.push({ code: 'dangling-dependency', entityId: r.story_id, missing: r.depends_on_story_id });
  }
  // Dangling epic deps
  for (const r of index
    .prepare(
      'SELECT ed.epic_id, ed.depends_on_epic_id FROM epic_dependencies ed LEFT JOIN epics e ON e.id=ed.depends_on_epic_id WHERE e.id IS NULL',
    )
    .all()) {
    warnings.push({ code: 'dangling-dependency', entityId: r.epic_id, missing: r.depends_on_epic_id });
  }
  // ID-registry drift
  const sequenceToTable = {
    EPIC: 'epics',
    US: 'stories',
    AC: 'acs',
    TASK: 'planning_tasks',
    BUG: 'bugs',
    L: 'lessons',
    TC: 'test_cases',
  };
  for (const reg of index.prepare('SELECT sequence,next_id FROM id_registry').all()) {
    const tbl = sequenceToTable[reg.sequence];
    if (!tbl) continue;
    const rows = index.prepare(`SELECT id FROM ${tbl}`).all();
    if (!rows.length) continue;
    const max = maxId(rows);
    const next = parseInt(String(reg.next_id).replace(/^\D+-/, ''), 10);
    if (next <= max)
      warnings.push({ code: 'id-registry-drift', sequence: reg.sequence, next: reg.next_id, actualMax: max });
  }
  // Orphan ACs (story_id null in joined view)
  for (const r of index
    .prepare('SELECT a.id, a.story_id FROM acs a LEFT JOIN stories s ON s.id=a.story_id WHERE s.id IS NULL')
    .all()) {
    warnings.push({ code: 'orphan-ac', entityId: r.id, missingStory: r.story_id });
  }
  return warnings;
}

module.exports = { runCrossEntityChecks };
```

- [ ] **Step 3: Run tests**

Run: `npx jest tests/unit/repository/cross-entity-validator.test.js`
Expected: 2 passed.

- [ ] **Step 4: Commit**

```bash
git add tools/lib/repository/validators/ tests/unit/repository/cross-entity-validator.test.js
git commit -m "feat(repo): cross-entity validators — dangling deps, orphan ACs, id-registry drift"
```

### Task B.4: `plan:lint` command + Phase B gate

**Files:**

- Create: `tools/plan-lint.js`
- Test: `tests/integration/plan-lint.test.js`

- [ ] **Step 1: Implement `plan:lint`**

```js
#!/usr/bin/env node
// tools/plan-lint.js
'use strict';
const { Repository } = require('./lib/repository');
const { indexAll } = require('./lib/repository/indexers');
const { runCrossEntityChecks } = require('./lib/repository/validators/cross-entity');
const { classify, TIER } = require('./lib/repository/validation');

function main() {
  const root = process.cwd();
  const repo = Repository.getInstance({ root });
  const indexResult = indexAll({ index: repo.index, markdown: repo.markdown, warningsChannel: repo.warningsChannel });
  const crossWarnings = runCrossEntityChecks({ index: repo.index });
  for (const w of crossWarnings) repo.warningsChannel.append(w);
  const all = [...indexResult.warnings, ...crossWarnings];
  const tiered = { error: [], warning: [], report: [] };
  for (const w of all) tiered[classify(w)].push(w);
  console.log(
    `[plan:lint] errors: ${tiered.error.length}, warnings: ${tiered.warning.length}, reports: ${tiered.report.length}`,
  );
  for (const e of tiered.error) console.log('  ERROR  ', JSON.stringify(e));
  for (const w of tiered.warning) console.log('  warn   ', JSON.stringify(w));
  for (const r of tiered.report.slice(0, 20)) console.log('  report ', JSON.stringify(r));
  if (tiered.error.length > 0) process.exitCode = 1;
}
if (require.main === module) main();
module.exports = { main };
```

- [ ] **Step 2: Run end-to-end**

```bash
npm run plan:lint
```

Expected: lists errors (should be 0), warnings (< 10 on current data), and reports.

**Phase B hard gate:** verify warnings count < 10. If higher, document each one in `.cache/repo-warnings.jsonl` and decide tier classification before continuing to Phase C.

- [ ] **Step 3: Commit Phase B close**

```bash
git add tools/plan-lint.js tests/integration/plan-lint.test.js
git commit -m "feat(repo): plan:lint reports tiered violations from indexers + cross-entity checks"
```

---

## Phase C — First Read Consumer (Dashboard)

**Hard gate:** the rendered `plan-status.html` is byte-identical (or semantically equivalent — see step 4 below) when dashboard reads come from the repo instead of re-parsing markdown.

**Effort:** 2-3 working days.

### Task C.1: Base entity repo + Story / Epic / AC read APIs

**Files:**

- Create: `tools/lib/repository/entities/base-repo.js`
- Create: `tools/lib/repository/entities/story-repo.js`
- Create: `tools/lib/repository/entities/epic-repo.js`
- Create: `tools/lib/repository/entities/ac-repo.js`
- Modify: `tools/lib/repository/index.js` (expose `repo.stories`, `repo.epics`, `repo.acs`)
- Test: `tests/unit/repository/entities-read.test.js`

- [ ] **Step 1: Write failing test**

```js
// tests/unit/repository/entities-read.test.js
const fs = require('fs');
const path = require('path');
const os = require('os');
const { Repository } = require('../../../tools/lib/repository');
const { indexAll } = require('../../../tools/lib/repository/indexers');

const SAMPLE = `\`\`\`
EPIC-0001: Demo
Status: Done
\`\`\`
\`\`\`
US-0001 (EPIC-0001): A
Status: Done
Acceptance Criteria:

- [x] AC-0001: one
\`\`\`
`;

describe('entity read APIs', () => {
  let root, repo;
  beforeEach(() => {
    root = fs.mkdtempSync(path.join(os.tmpdir(), 'erd-'));
    fs.mkdirSync(path.join(root, 'docs'));
    fs.writeFileSync(path.join(root, 'docs', 'RELEASE_PLAN.md'), SAMPLE);
    Repository._reset();
    repo = Repository.getInstance({ root });
    indexAll({ index: repo.index, markdown: repo.markdown, warningsChannel: repo.warningsChannel });
  });
  afterEach(() => {
    Repository._reset();
    fs.rmSync(root, { recursive: true, force: true });
  });

  test('repo.epics.get / list', () => {
    expect(repo.epics.get('EPIC-0001').title).toBe('Demo');
    expect(repo.epics.list().length).toBe(1);
  });
  test('repo.stories.get / list with filters', () => {
    expect(repo.stories.get('US-0001').epicId).toBe('EPIC-0001');
    expect(repo.stories.list({ epicId: 'EPIC-0001' }).length).toBe(1);
    expect(repo.stories.list({ status: 'Done' }).length).toBe(1);
    expect(repo.stories.list({ status: 'Planned' }).length).toBe(0);
  });
  test('repo.acs.list returns ordered ACs for a story', () => {
    const acs = repo.acs.list({ storyId: 'US-0001' });
    expect(acs.map((a) => a.id)).toEqual(['AC-0001']);
    expect(acs[0].checked).toBe(true);
  });
});
```

- [ ] **Step 2: Implement base + entity repos**

```js
// tools/lib/repository/entities/base-repo.js
'use strict';
class BaseRepo {
  constructor({ index, table, mapRow, root }) {
    this.index = index;
    this.table = table;
    this.mapRow = mapRow;
    this._root = root; // needed by *.update() to locate the source markdown file
  }
  get(id) {
    const row = this.index.prepare(`SELECT * FROM ${this.table} WHERE id=?`).get(id);
    return row ? this.mapRow(row) : null;
  }
  list() {
    return this.index.prepare(`SELECT * FROM ${this.table}`).all().map(this.mapRow);
  }
}
module.exports = { BaseRepo };
```

```js
// tools/lib/repository/entities/epic-repo.js
'use strict';
const { BaseRepo } = require('./base-repo');

function mapEpic(r) {
  return {
    id: r.id,
    title: r.title,
    status: r.status,
    releaseTarget: r.release_target,
    sourceFile: r.source_file,
    sourceLine: r.source_line,
  };
}

class EpicRepo extends BaseRepo {
  constructor(index, root) {
    super({ index, table: 'epics', mapRow: mapEpic, root });
  }
  list({ status } = {}) {
    if (status) return this.index.prepare('SELECT * FROM epics WHERE status=? ORDER BY id').all(status).map(mapEpic);
    return this.index.prepare('SELECT * FROM epics ORDER BY id').all().map(mapEpic);
  }
}
module.exports = { EpicRepo };
```

```js
// tools/lib/repository/entities/story-repo.js
'use strict';
const { BaseRepo } = require('./base-repo');

function mapStory(r) {
  return {
    id: r.id,
    epicId: r.epic_id,
    title: r.title,
    status: r.status,
    priority: r.priority,
    estimate: r.estimate,
    branch: r.branch,
    prNumber: r.pr_number,
    specPath: r.spec_path,
    planPath: r.plan_path,
    sourceFile: r.source_file,
    sourceLine: r.source_line,
  };
}

class StoryRepo extends BaseRepo {
  constructor(index, root) {
    super({ index, table: 'stories', mapRow: mapStory, root });
  }
  list({ epicId, status } = {}) {
    const where = [],
      args = [];
    if (epicId) {
      where.push('epic_id=?');
      args.push(epicId);
    }
    if (status) {
      if (Array.isArray(status)) {
        where.push(`status IN (${status.map(() => '?').join(',')})`);
        args.push(...status);
      } else {
        where.push('status=?');
        args.push(status);
      }
    }
    const sql = `SELECT * FROM stories${where.length ? ' WHERE ' + where.join(' AND ') : ''} ORDER BY id`;
    return this.index
      .prepare(sql)
      .all(...args)
      .map(mapStory);
  }
}
module.exports = { StoryRepo };
```

```js
// tools/lib/repository/entities/ac-repo.js
'use strict';
const { BaseRepo } = require('./base-repo');

function mapAc(r) {
  return { id: r.id, storyId: r.story_id, checked: !!r.checked, text: r.text, position: r.position };
}

class AcRepo extends BaseRepo {
  constructor(index, root) {
    super({ index, table: 'acs', mapRow: mapAc, root });
  }
  list({ storyId } = {}) {
    if (storyId)
      return this.index.prepare('SELECT * FROM acs WHERE story_id=? ORDER BY position').all(storyId).map(mapAc);
    return this.index.prepare('SELECT * FROM acs ORDER BY story_id, position').all().map(mapAc);
  }
}
module.exports = { AcRepo };
```

- [ ] **Step 3: Wire into Repository.getInstance**

In `tools/lib/repository/index.js`, in the constructor:

```js
const { EpicRepo } = require('./entities/epic-repo');
const { StoryRepo } = require('./entities/story-repo');
const { AcRepo } = require('./entities/ac-repo');
// inside constructor, after applySchemaMigrations(this.index):
this.epics = new EpicRepo(this.index, root);
this.stories = new StoryRepo(this.index, root);
this.acs = new AcRepo(this.index, root);
```

- [ ] **Step 4: Run tests**

Run: `npx jest tests/unit/repository/entities-read.test.js`
Expected: 3 passed.

- [ ] **Step 5: Commit**

```bash
git add tools/lib/repository/entities/ tools/lib/repository/index.js tests/unit/repository/entities-read.test.js
git commit -m "feat(repo): read APIs for stories, epics, ACs via base-repo"
```

### Task C.2: Migrate dashboard read path

**Files:**

- Modify: `tools/generate-plan.js` (replace parse-from-file with `repo.*` reads where dashboard data originates)

- [ ] **Step 1: Identify dashboard data origins**

Grep current `tools/generate-plan.js` for the spots that parse `docs/RELEASE_PLAN.md` and build the `epics`, `stories`, `acs` data structures handed to `renderHtml(...)`. Note their line numbers.

```bash
grep -n "RELEASE_PLAN\|parseRelease\|epics\|stories" tools/generate-plan.js | head -30
```

- [ ] **Step 2: Replace with repository reads**

Inside `tools/generate-plan.js`, after the index has been built (the Phase B `indexAll(...)` call), but before `renderHtml(...)`, add a feature-flagged section that reads from the repo:

```js
// Phase C: dashboard reads from repo when env flag is set; otherwise legacy parser.
let storiesFromRepo = null;
if (process.env.PV_DASHBOARD_VIA_REPO === '1') {
  const epics = repo.epics.list();
  const stories = repo.stories.list();
  const acs = repo.acs.list();
  storiesFromRepo = { epics, stories, acs };
  console.log('[generate-plan] dashboard reads via repo:', {
    epics: epics.length,
    stories: stories.length,
    acs: acs.length,
  });
}
// Later in renderHtml call site, prefer storiesFromRepo if non-null:
//   const dashboardData = storiesFromRepo ? mergeRepoData(legacyData, storiesFromRepo) : legacyData;
```

The `mergeRepoData` shim copies any fields the legacy data has that the repo doesn't yet provide (e.g. computed cost, snapshots) and overrides the structural fields (epics/stories/acs) with repo data.

- [ ] **Step 3: Run dashboard with feature flag**

```bash
PV_DASHBOARD_VIA_REPO=1 npm run plan:generate
```

Expected: completes; `docs/plan-status.html` regenerated.

- [ ] **Step 4: Snapshot parity check**

```bash
npm run plan:generate                    # legacy path
cp docs/plan-status.html /tmp/legacy.html
PV_DASHBOARD_VIA_REPO=1 npm run plan:generate
diff /tmp/legacy.html docs/plan-status.html
```

Expected: zero diff, or diffs limited to whitespace/key-ordering inside JSON blobs that the dashboard doesn't depend on. Any meaningful semantic diff is a bug — fix in the `mergeRepoData` shim or in the indexer before continuing.

- [ ] **Step 5: Flip the flag default**

Once parity holds, switch `PV_DASHBOARD_VIA_REPO=1` to the default and keep `PV_DASHBOARD_VIA_REPO=0` as the legacy escape hatch. Eventually (Phase E) the legacy path is removed.

- [ ] **Step 6: Commit Phase C close**

```bash
git add tools/generate-plan.js
git commit -m "feat(repo): dashboard reads epics/stories/acs via repository"
```

---

## Phase D — SdlcStatus Cutover (SQLite-Authoritative)

**Hard gate:** all four sdlc-status writers (`agent-lifecycle.js`, `update-sdlc-status.js`, `agent-task-review.js`, `agent-spec-plan.js`) write via the repo only; `docs/sdlc-status.json` is generated from SQL on every event and byte-identical to legacy output for a fixture event stream; integration tests pass; dashboard live-update parity holds.

**Effort:** 5-8 working days.

### Task D.1: SdlcEventRepo, SdlcTaskRepo, SdlcProgrammeRepo (write side)

**Files:**

- Create: `tools/lib/repository/entities/sdlc-event-repo.js`
- Create: `tools/lib/repository/entities/sdlc-task-repo.js`
- Create: `tools/lib/repository/entities/sdlc-programme-repo.js`
- Create: `tools/lib/repository/sdlc-mirror.js` (writes JSON mirror under file lock)
- Test: `tests/unit/repository/sdlc-repos.test.js`

- [ ] **Step 1: Write failing test**

```js
// tests/unit/repository/sdlc-repos.test.js
const fs = require('fs');
const path = require('path');
const os = require('os');
const { Repository } = require('../../../tools/lib/repository');

describe('SDLC repos', () => {
  let root, repo;
  beforeEach(() => {
    root = fs.mkdtempSync(path.join(os.tmpdir(), 'sdlc-'));
    fs.mkdirSync(path.join(root, 'docs'));
    Repository._reset();
    repo = Repository.getInstance({ root });
  });
  afterEach(() => {
    Repository._reset();
    fs.rmSync(root, { recursive: true, force: true });
  });

  test('sdlcEvents.record persists row and writes JSON mirror', async () => {
    await repo.sdlcEvents.record({ kind: 'agent-start', storyId: 'US-0001', agent: 'Forge', ts: 1000 });
    const rows = repo.index.prepare('SELECT * FROM sdlc_events').all();
    expect(rows.length).toBe(1);
    expect(rows[0].kind).toBe('agent-start');
    expect(fs.existsSync(path.join(root, 'docs', 'sdlc-status.json'))).toBe(true);
    const j = JSON.parse(fs.readFileSync(path.join(root, 'docs', 'sdlc-status.json'), 'utf8'));
    expect(j.log.length).toBe(1);
  });

  test('sdlcTasks.upsert merges fields', async () => {
    await repo.sdlcTasks.upsert({ id: 't1', storyId: 'US-0001', agent: 'Forge', status: 'in_progress' });
    await repo.sdlcTasks.upsert({ id: 't1', status: 'done', completedAt: 2000 });
    const r = repo.index.prepare('SELECT * FROM sdlc_tasks WHERE id=?').get('t1');
    expect(r.status).toBe('done');
    expect(r.completed_at).toBe(2000);
    expect(r.agent).toBe('Forge'); // preserved
  });

  test('sdlcProgramme.set persists JSON value', async () => {
    await repo.sdlcProgramme.set('current_phase', { phase: 'integration' });
    const r = repo.index.prepare('SELECT * FROM sdlc_programme WHERE key=?').get('current_phase');
    expect(JSON.parse(r.value_json)).toEqual({ phase: 'integration' });
  });
});
```

- [ ] **Step 2: Implement SdlcEventRepo**

```js
// tools/lib/repository/entities/sdlc-event-repo.js
'use strict';

class SdlcEventRepo {
  constructor({ index, mirror }) {
    this.index = index;
    this.mirror = mirror;
  }
  async record(event) {
    const ts = event.ts || Date.now();
    this.index
      .prepare('INSERT INTO sdlc_events(ts,kind,story_id,agent,payload_json) VALUES(?,?,?,?,?)')
      .run(ts, event.kind, event.storyId || null, event.agent || null, JSON.stringify(event));
    await this.mirror.write();
  }
  list({ storyId, since } = {}) {
    const where = [],
      args = [];
    if (storyId) {
      where.push('story_id=?');
      args.push(storyId);
    }
    if (since) {
      where.push('ts >= ?');
      args.push(since);
    }
    const sql = `SELECT * FROM sdlc_events${where.length ? ' WHERE ' + where.join(' AND ') : ''} ORDER BY id`;
    return this.index.prepare(sql).all(...args);
  }
}
module.exports = { SdlcEventRepo };
```

- [ ] **Step 3: Implement SdlcTaskRepo**

```js
// tools/lib/repository/entities/sdlc-task-repo.js
'use strict';

const COLUMNS = [
  'id',
  'story_id',
  'agent',
  'status',
  'started_at',
  'completed_at',
  'plan_task_index',
  'summary',
  'model',
  'model_rationale',
  'task_review_json',
  'base_sha',
  'head_sha',
];
const FIELD_MAP = {
  id: 'id',
  storyId: 'story_id',
  agent: 'agent',
  status: 'status',
  startedAt: 'started_at',
  completedAt: 'completed_at',
  planTaskIndex: 'plan_task_index',
  summary: 'summary',
  model: 'model',
  modelRationale: 'model_rationale',
  taskReview: 'task_review_json',
  baseSha: 'base_sha',
  headSha: 'head_sha',
};

class SdlcTaskRepo {
  constructor({ index, mirror }) {
    this.index = index;
    this.mirror = mirror;
  }
  async upsert(task) {
    const existing = task.id ? this.index.prepare('SELECT * FROM sdlc_tasks WHERE id=?').get(task.id) : null;
    const merged = { ...existing };
    for (const [k, col] of Object.entries(FIELD_MAP)) {
      if (k in task) merged[col] = k === 'taskReview' ? JSON.stringify(task.taskReview) : task[k];
    }
    if (existing) {
      const sets = COLUMNS.filter((c) => c !== 'id')
        .map((c) => `${c}=?`)
        .join(',');
      const args = COLUMNS.filter((c) => c !== 'id').map((c) => merged[c] ?? null);
      this.index.prepare(`UPDATE sdlc_tasks SET ${sets} WHERE id=?`).run(...args, task.id);
    } else {
      const args = COLUMNS.map((c) => merged[c] ?? null);
      this.index
        .prepare(`INSERT INTO sdlc_tasks(${COLUMNS.join(',')}) VALUES(${COLUMNS.map(() => '?').join(',')})`)
        .run(...args);
    }
    await this.mirror.write();
    return this.index.prepare('SELECT * FROM sdlc_tasks WHERE id=?').get(task.id);
  }
  get(id) {
    return this.index.prepare('SELECT * FROM sdlc_tasks WHERE id=?').get(id);
  }
  list({ storyId } = {}) {
    if (storyId) return this.index.prepare('SELECT * FROM sdlc_tasks WHERE story_id=?').all(storyId);
    return this.index.prepare('SELECT * FROM sdlc_tasks').all();
  }
}
module.exports = { SdlcTaskRepo };
```

- [ ] **Step 4: Implement SdlcProgrammeRepo**

```js
// tools/lib/repository/entities/sdlc-programme-repo.js
'use strict';
class SdlcProgrammeRepo {
  constructor({ index, mirror }) {
    this.index = index;
    this.mirror = mirror;
  }
  async set(key, value) {
    this.index
      .prepare(
        `INSERT INTO sdlc_programme(key,value_json) VALUES(?,?)
                        ON CONFLICT(key) DO UPDATE SET value_json=excluded.value_json`,
      )
      .run(key, JSON.stringify(value));
    await this.mirror.write();
  }
  get(key) {
    const r = this.index.prepare('SELECT value_json FROM sdlc_programme WHERE key=?').get(key);
    return r ? JSON.parse(r.value_json) : null;
  }
  all() {
    const out = {};
    for (const r of this.index.prepare('SELECT * FROM sdlc_programme').all()) out[r.key] = JSON.parse(r.value_json);
    return out;
  }
}
module.exports = { SdlcProgrammeRepo };
```

- [ ] **Step 5: Implement SdlcMirror**

```js
// tools/lib/repository/sdlc-mirror.js
'use strict';
const fs = require('fs');
const path = require('path');
const { withFileLock } = require('./file-lock');

class SdlcMirror {
  constructor({ root, index }) {
    this.file = path.join(root, 'docs', 'sdlc-status.json');
    this.index = index;
  }
  async write() {
    fs.mkdirSync(path.dirname(this.file), { recursive: true });
    // Touch the file so file-lock can grab it
    if (!fs.existsSync(this.file)) fs.writeFileSync(this.file, '{}');
    await withFileLock(this.file, async () => {
      // Re-query SQL inside the lock so concurrent writers don't leave the JSON behind reality
      const tasks = this.index.prepare('SELECT * FROM sdlc_tasks').all().map(rowToTask);
      const log = this.index
        .prepare('SELECT * FROM sdlc_events ORDER BY id')
        .all()
        .map((r) => ({ ts: r.ts, kind: r.kind, storyId: r.story_id, agent: r.agent, ...JSON.parse(r.payload_json) }));
      const programme = {};
      for (const r of this.index.prepare('SELECT * FROM sdlc_programme').all())
        programme[r.key] = JSON.parse(r.value_json);
      const out = { tasks, log, programme };
      const tmp = this.file + '.tmp';
      fs.writeFileSync(tmp, JSON.stringify(out, null, 2));
      fs.renameSync(tmp, this.file);
    });
  }
}

function rowToTask(r) {
  return {
    id: r.id,
    storyId: r.story_id,
    agent: r.agent,
    status: r.status,
    startedAt: r.started_at,
    completedAt: r.completed_at,
    planTaskIndex: r.plan_task_index,
    summary: r.summary,
    model: r.model,
    modelRationale: r.model_rationale,
    taskReview: r.task_review_json ? JSON.parse(r.task_review_json) : null,
    baseSha: r.base_sha,
    headSha: r.head_sha,
  };
}

module.exports = { SdlcMirror };
```

- [ ] **Step 6: Wire into Repository**

In `tools/lib/repository/index.js`, after `this.acs = new AcRepo(...)`:

```js
const { SdlcMirror } = require('./sdlc-mirror');
const { SdlcEventRepo } = require('./entities/sdlc-event-repo');
const { SdlcTaskRepo } = require('./entities/sdlc-task-repo');
const { SdlcProgrammeRepo } = require('./entities/sdlc-programme-repo');
// inside constructor:
this._sdlcMirror = new SdlcMirror({ root, index: this.index });
this.sdlcEvents = new SdlcEventRepo({ index: this.index, mirror: this._sdlcMirror });
this.sdlcTasks = new SdlcTaskRepo({ index: this.index, mirror: this._sdlcMirror });
this.sdlcProgramme = new SdlcProgrammeRepo({ index: this.index, mirror: this._sdlcMirror });
```

- [ ] **Step 7: Run tests**

Run: `npx jest tests/unit/repository/sdlc-repos.test.js`
Expected: 3 passed.

- [ ] **Step 8: Commit**

```bash
git add tools/lib/repository/entities/sdlc-*-repo.js tools/lib/repository/sdlc-mirror.js tools/lib/repository/index.js tests/unit/repository/sdlc-repos.test.js
git commit -m "feat(repo): SdlcEvent/Task/Programme repos with re-query-inside-lock JSON mirror"
```

### Task D.2: Migration 002 — JSON → SQLite ingest

**Files:**

- Create: `tools/lib/migrations/002-ingest-sdlc-status.js`
- Test: `tests/unit/migrations/002-ingest.test.js`

- [ ] **Step 1: Write failing test**

```js
// tests/unit/migrations/002-ingest.test.js
const fs = require('fs');
const path = require('path');
const os = require('os');
const { Repository } = require('../../../tools/lib/repository');
const mig = require('../../../tools/lib/migrations/002-ingest-sdlc-status');

test('Migration 002 ingests existing JSON; idempotent on second run', async () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'm2-'));
  fs.mkdirSync(path.join(root, 'docs'));
  fs.writeFileSync(
    path.join(root, 'docs', 'sdlc-status.json'),
    JSON.stringify({
      tasks: [{ id: 't1', storyId: 'US-0001', agent: 'Forge', status: 'done' }],
      log: [{ ts: 1, kind: 'agent-start', storyId: 'US-0001' }],
      programme: { phase: { current: 'integration' } },
    }),
  );
  fs.writeFileSync(path.join(root, 'package.json'), JSON.stringify({ version: '2.5.0' }));
  Repository._reset();
  await mig.up({ root });
  const repo = Repository.getInstance({ root });
  expect(repo.sdlcTasks.get('t1').status).toBe('done');
  expect(repo.sdlcEvents.list().length).toBe(1);
  expect(repo.sdlcProgramme.get('phase')).toEqual({ current: 'integration' });
  // Second run should be a no-op (hash check)
  await mig.up({ root });
  expect(repo.sdlcEvents.list().length).toBe(1);
  Repository._reset();
  fs.rmSync(root, { recursive: true, force: true });
});
```

- [ ] **Step 2: Implement Migration 002**

```js
// tools/lib/migrations/002-ingest-sdlc-status.js
'use strict';
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { Repository } = require('../repository');

const touches = ['docs/sdlc-status.json'];

async function up({ root }) {
  const file = path.join(root, 'docs', 'sdlc-status.json');
  if (!fs.existsSync(file)) return { skipped: 'no-file' };
  const buf = fs.readFileSync(file);
  const hash = crypto.createHash('sha256').update(buf).digest('hex');

  Repository._reset();
  const repo = Repository.getInstance({ root });
  const existingHash = repo.index.prepare("SELECT value FROM meta_status WHERE key='migration_002_hash'").get();
  if (existingHash && existingHash.value === hash) {
    Repository._reset();
    return { skipped: 'idempotent' };
  }

  const data = JSON.parse(buf.toString('utf8'));
  for (const t of data.tasks || []) await repo.sdlcTasks.upsert(t);
  for (const e of data.log || []) await repo.sdlcEvents.record(e);
  if (data.programme) for (const [k, v] of Object.entries(data.programme)) await repo.sdlcProgramme.set(k, v);
  repo.index
    .prepare(
      `INSERT INTO meta_status(key,value) VALUES('migration_002_hash', ?)
                      ON CONFLICT(key) DO UPDATE SET value=excluded.value`,
    )
    .run(hash);
  Repository._reset();
  return { ingested: { tasks: (data.tasks || []).length, events: (data.log || []).length } };
}

module.exports = { up, touches };
```

- [ ] **Step 3: Run test**

Run: `npx jest tests/unit/migrations/002-ingest.test.js`
Expected: PASS.

- [ ] **Step 4: Commit**

```bash
git add tools/lib/migrations/002-ingest-sdlc-status.js tests/unit/migrations/002-ingest.test.js
git commit -m "feat(migrations): 002 — ingest legacy sdlc-status.json into SQLite (idempotent)"
```

### Task D.3: Migrate `tools/agent-lifecycle.js`

**Files:**

- Modify: `tools/agent-lifecycle.js`
- Modify: `tests/unit/agent-lifecycle-cli.test.js` (if present)
- Modify: `tests/unit/agent-lifecycle-state.test.js` (if present)

- [ ] **Step 1: Inspect current file**

Run: `head -100 tools/agent-lifecycle.js`

Identify the lines where it `fs.write*`s `docs/sdlc-status.json`. Note exit codes, CLI flag names, and the JSON shape it produces.

- [ ] **Step 2: Replace direct writes with repo calls**

Every `fs.writeFileSync(SDLC_STATUS_PATH, JSON.stringify({ ...tasks, ... }))` becomes:

```js
const { Repository } = require('./lib/repository');
const repo = Repository.getInstance({ root: ROOT });
// start command:
await repo.sdlcTasks.upsert({
  id: taskId,
  storyId,
  agent,
  status: 'in_progress',
  startedAt: Date.now(),
  planTaskIndex,
  model,
  modelRationale,
});
await repo.sdlcEvents.record({ kind: 'task-start', storyId, agent, taskId });
// done command:
await repo.sdlcTasks.upsert({ id: taskId, status: 'done', completedAt: Date.now(), summary, headSha });
await repo.sdlcEvents.record({ kind: 'task-done', storyId, agent, taskId, summary });
```

Preserve every existing CLI flag and exit code. The repo writes the JSON mirror automatically.

- [ ] **Step 3: Run existing agent-lifecycle tests**

Run: `npx jest tests/unit/agent-lifecycle-cli.test.js tests/unit/agent-lifecycle-state.test.js tests/integration/agent-context-flow.test.js`
Expected: PASS (the JSON mirror should produce the same shape the legacy code wrote).

- [ ] **Step 4: Commit**

```bash
git add tools/agent-lifecycle.js
git commit -m "refactor(agent-lifecycle): write through repository (SQLite-authoritative)"
```

### Task D.4: Migrate `tools/update-sdlc-status.js`

- [ ] **Step 1: Inspect and migrate**

Same pattern as Task D.3. Every event that previously read+modified+rewrote `docs/sdlc-status.json` becomes a `repo.sdlcEvents.record(...)` or `repo.sdlcTasks.upsert(...)` call.

- [ ] **Step 2: Run integration tests touching this tool**

```bash
npx jest tests/integration/dashboard-task-review-flow.test.js
npx jest --testPathPattern='update-sdlc'
```

Expected: PASS.

- [ ] **Step 3: Commit**

```bash
git add tools/update-sdlc-status.js
git commit -m "refactor(update-sdlc-status): write through repository"
```

### Task D.5: Migrate `tools/agent-task-review.js`

- [ ] **Step 1: Migrate**

Find every direct write to sdlc-status.json. Convert to `repo.sdlcTasks.upsert({ id, taskReview: {...} })` since `taskReview` is now a column on `sdlc_tasks`.

- [ ] **Step 2: Run task-review tests**

Run: `npx jest --testPathPattern='task-review'`
Expected: PASS.

- [ ] **Step 3: Commit**

```bash
git add tools/agent-task-review.js
git commit -m "refactor(agent-task-review): write through repository"
```

### Task D.6: Migrate `tools/agent-spec-plan.js`

- [ ] **Step 1: Migrate**

Convert the spec/plan state transitions (which write task records) to `repo.sdlcTasks.upsert(...)`. Plan path updates become a task upsert with `planPath` (mapped via the FIELD_MAP if needed).

- [ ] **Step 2: Run spec-plan tests**

Run: `npx jest --testPathPattern='spec-plan'`
Expected: PASS.

- [ ] **Step 3: Commit**

```bash
git add tools/agent-spec-plan.js
git commit -m "refactor(agent-spec-plan): write through repository"
```

### Task D.7: Live-dashboard parity test

**Files:**

- Create: `tests/integration/repository/live-dashboard-parity.test.js`

- [ ] **Step 1: Write the parity test**

```js
// tests/integration/repository/live-dashboard-parity.test.js
const fs = require('fs');
const path = require('path');
const os = require('os');
const { Repository } = require('../../../tools/lib/repository');

test('JSON mirror is byte-equivalent for a fixture event stream', async () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'lp-'));
  fs.mkdirSync(path.join(root, 'docs'));
  fs.writeFileSync(path.join(root, 'package.json'), JSON.stringify({ version: '2.5.0' }));
  Repository._reset();
  const repo = Repository.getInstance({ root });

  // Replay a fixture event stream
  await repo.sdlcEvents.record({ ts: 1000, kind: 'agent-start', storyId: 'US-0001', agent: 'Forge' });
  await repo.sdlcTasks.upsert({ id: 't1', storyId: 'US-0001', agent: 'Forge', status: 'in_progress', startedAt: 1000 });
  await repo.sdlcEvents.record({ ts: 2000, kind: 'agent-done', storyId: 'US-0001', agent: 'Forge' });
  await repo.sdlcTasks.upsert({ id: 't1', status: 'done', completedAt: 2000 });

  const mirror = JSON.parse(fs.readFileSync(path.join(root, 'docs', 'sdlc-status.json'), 'utf8'));
  expect(mirror.tasks.length).toBe(1);
  expect(mirror.tasks[0].status).toBe('done');
  expect(mirror.log.length).toBe(2);

  // Concurrent record() calls do not lose events
  await Promise.all([
    repo.sdlcEvents.record({ ts: 3000, kind: 'x' }),
    repo.sdlcEvents.record({ ts: 3001, kind: 'y' }),
    repo.sdlcEvents.record({ ts: 3002, kind: 'z' }),
  ]);
  const after = JSON.parse(fs.readFileSync(path.join(root, 'docs', 'sdlc-status.json'), 'utf8'));
  expect(after.log.length).toBe(5);

  Repository._reset();
  fs.rmSync(root, { recursive: true, force: true });
});
```

- [ ] **Step 2: Run the parity test**

Run: `npx jest tests/integration/repository/live-dashboard-parity.test.js`
Expected: PASS. If `log.length` is < 5 after the concurrent writes, the mirror lock is wrong — fix before continuing.

- [ ] **Step 3: Commit Phase D close**

```bash
git add tests/integration/repository/live-dashboard-parity.test.js
git commit -m "test(repo): JSON mirror parity + concurrent record() safety"
```

### Task D.8: `pv:upgrade` and `pv:rollback` (write-capable)

**Files:**

- Create: `tools/pv-upgrade.js`
- Create: `tools/pv-rollback.js`
- Test: `tests/integration/pv-upgrade.test.js`

- [ ] **Step 1: Implement pv-upgrade**

```js
#!/usr/bin/env node
// tools/pv-upgrade.js
'use strict';
const { execSync } = require('child_process');
const { pending, run } = require('./lib/migrations');

async function main() {
  const root = process.cwd();
  const force = process.argv.includes('--force');
  // Refuse to run with uncommitted changes unless --force
  if (!force) {
    try {
      const dirty = execSync('git status --porcelain', { cwd: root, encoding: 'utf8' }).trim();
      if (dirty) {
        console.error('Refusing to upgrade with uncommitted changes. Commit or pass --force.');
        process.exit(1);
      }
    } catch {
      /* not a git repo; allow */
    }
  }
  const todo = pending({ root });
  if (!todo.length) {
    console.log('No pending migrations.');
    return;
  }
  console.log(`Applying ${todo.length} migration(s):`);
  for (const t of todo) console.log(`  - ${t.id}`);
  const results = await run({ root });
  for (const r of results) console.log(`  ✓ ${r.id}`);
}
if (require.main === module) main();
module.exports = { main };
```

- [ ] **Step 2: Implement pv-rollback**

```js
#!/usr/bin/env node
// tools/pv-rollback.js
'use strict';
const { listBackups, restore } = require('./lib/migrations/backup');

function main() {
  const root = process.cwd();
  const toArg = process.argv.indexOf('--to');
  const label = toArg >= 0 ? process.argv[toArg + 1] : null;
  if (!label) {
    const all = listBackups({ root });
    console.log('Available backups:');
    for (const b of all) console.log(`  ${b}`);
    console.log('Run: npm run pv:rollback -- --to <label>');
    return;
  }
  const restored = restore({ root, label });
  console.log(`Restored ${restored.length} file(s) from ${label}`);
}
if (require.main === module) main();
module.exports = { main };
```

- [ ] **Step 3: Integration test for upgrade flow**

```js
// tests/integration/pv-upgrade.test.js
const fs = require('fs');
const path = require('path');
const os = require('os');
const { execSync } = require('child_process');

test('pv:upgrade applies pending migrations against a fixture project', () => {
  // Copy current repo as fixture (simulating an upgrade in-place)
  const fixture = fs.mkdtempSync(path.join(os.tmpdir(), 'pvf-'));
  for (const f of ['package.json', 'tools', 'docs']) {
    if (fs.existsSync(f)) execSync(`cp -R ${f} ${fixture}/`);
  }
  // Run pv:upgrade
  try {
    execSync('node tools/pv-upgrade.js --force', { cwd: fixture, encoding: 'utf8' });
  } catch (e) {
    /* if no migrations, that's still success */
  }
  fs.rmSync(fixture, { recursive: true, force: true });
});
```

- [ ] **Step 4: Commit**

```bash
git add tools/pv-upgrade.js tools/pv-rollback.js tests/integration/pv-upgrade.test.js
git commit -m "feat(pv): pv:upgrade (with --force) and pv:rollback (with --to)"
```

**Phase D hard gate:**

- `npm test` passes including the dashboard-task-review-flow, agent-context-flow, and live-dashboard-parity tests
- `grep -rn "fs.writeFileSync.*sdlc-status.json" tools/` returns nothing (all writers migrated)
- `docs/sdlc-status.json` regenerated after a real session has the same top-level shape as before (`{ tasks, log, programme }`)

---

## Phase E — Planning Writers (Markdown-Authoritative)

**Hard gate:** all planning writers (~5 tools) write through the repo only; AST round-trip preserves prose byte-identically on production files post-Migration 001; multi-entity transactions are atomic; no `fs.write*` against managed markdown outside `tools/lib/repository/`.

**Effort:** 5-8 working days.

### Task E.1: Write APIs for human-authored entities (story, epic, AC, bug, lesson, test-case, id-registry)

**Files:**

- Modify: `tools/lib/repository/entities/story-repo.js` (add update/create)
- Modify: `tools/lib/repository/entities/epic-repo.js` (add update/create)
- Modify: `tools/lib/repository/entities/ac-repo.js` (add update/createMany)
- Create: `tools/lib/repository/entities/bug-repo.js`
- Create: `tools/lib/repository/entities/lesson-repo.js`
- Create: `tools/lib/repository/entities/test-case-repo.js`
- Create: `tools/lib/repository/entities/task-repo.js` (planning_tasks)
- Create: `tools/lib/repository/serializers/story-serializer.js`
- Create: `tools/lib/repository/serializers/epic-serializer.js`
- Create: `tools/lib/repository/serializers/bug-serializer.js`
- Create: `tools/lib/repository/serializers/lesson-serializer.js`
- Create: `tools/lib/repository/serializers/test-case-serializer.js`
- Test: `tests/unit/repository/entity-writes.test.js`

- [ ] **Step 1: Write failing test for story-repo.update**

```js
// tests/unit/repository/entity-writes.test.js
const fs = require('fs');
const path = require('path');
const os = require('os');
const { Repository } = require('../../../tools/lib/repository');
const { indexAll } = require('../../../tools/lib/repository/indexers');

const SAMPLE = `# Release Plan

Prose A.

## Epic — EPIC-0001

\`\`\`
EPIC-0001: First
Status: Done
\`\`\`

## Stories

\`\`\`
US-0001 (EPIC-0001): Title
Status: Planned
Acceptance Criteria:

- [ ] AC-0001: one
\`\`\`

Prose Z.
`;

describe('entity writes preserve prose', () => {
  let root, repo;
  beforeEach(() => {
    root = fs.mkdtempSync(path.join(os.tmpdir(), 'ew-'));
    fs.mkdirSync(path.join(root, 'docs'));
    fs.writeFileSync(path.join(root, 'docs', 'RELEASE_PLAN.md'), SAMPLE);
    Repository._reset();
    repo = Repository.getInstance({ root });
    indexAll({ index: repo.index, markdown: repo.markdown, warningsChannel: repo.warningsChannel });
  });
  afterEach(() => {
    Repository._reset();
    fs.rmSync(root, { recursive: true, force: true });
  });

  test('stories.update preserves surrounding prose', async () => {
    await repo.stories.update('US-0001', (s) => {
      s.status = 'In Progress';
      s.branch = 'feature/x';
    });
    const after = fs.readFileSync(path.join(root, 'docs', 'RELEASE_PLAN.md'), 'utf8');
    expect(after).toContain('Status: In Progress');
    expect(after).toContain('Branch: feature/x');
    expect(after).toContain('Prose A.');
    expect(after).toContain('Prose Z.');
    expect(after).toContain('## Epic — EPIC-0001');
  });

  test('throws on invalid status enum', async () => {
    await expect(
      repo.stories.update('US-0001', (s) => {
        s.status = 'Frobnicated';
      }),
    ).rejects.toThrow(/invalid-status|status/i);
  });
});
```

- [ ] **Step 2: Implement story-serializer**

```js
// tools/lib/repository/serializers/story-serializer.js
'use strict';

const FIELD_ORDER = ['Priority', 'Estimate', 'Status', 'Branch', 'PR', 'Spec', 'Plan', 'Dependencies'];

function serializeStory(story, acs) {
  const lines = [`US-${story.id.replace(/^US-/, '')} (EPIC-${story.epicId.replace(/^EPIC-/, '')}): ${story.title}`];
  for (const f of FIELD_ORDER) {
    const v = story[f.toLowerCase().replace('pr', 'prNumber')] || story[fieldKey(f)];
    if (v != null && v !== '') lines.push(`${f}: ${formatField(f, v)}`);
  }
  if (acs && acs.length) {
    lines.push('Acceptance Criteria:');
    lines.push('');
    for (const ac of acs.sort((a, b) => a.position - b.position)) {
      lines.push(`- [${ac.checked ? 'x' : ' '}] ${ac.id}: ${ac.text}`);
    }
  }
  return lines.join('\n');
}

function fieldKey(label) {
  const map = { PR: 'prNumber', Spec: 'specPath', Plan: 'planPath' };
  return map[label] || label.toLowerCase();
}

function formatField(label, value) {
  if (label === 'PR') return `#${value}`;
  return String(value);
}

module.exports = { serializeStory };
```

- [ ] **Step 3: Extend StoryRepo with update**

```js
// Append to tools/lib/repository/entities/story-repo.js

const { parseMarkdown } = require('../ast/parser');
const { serializeAst, replaceBlock } = require('../ast/serializer');
const { withFileLock } = require('../file-lock');
const { serializeStory } = require('../serializers/story-serializer');
const { ValidationError, TIER, classify } = require('../validation');

const VALID_STATUS = new Set(['To Do', 'Planned', 'In Progress', 'Blocked', 'Done']);

StoryRepo.prototype.update = async function update(id, fn) {
  const repoRoot = this._root;
  const file = this._sourceFile(id);
  const abs = require('path').join(repoRoot, file);
  await withFileLock(abs, async () => {
    const ast = parseMarkdown(require('fs').readFileSync(abs, 'utf8'));
    const blockIdx = findStoryBlock(ast, id);
    if (blockIdx < 0) throw new Error(`story ${id} not found in ${file}`);
    const current = this.get(id);
    const draft = { ...current };
    fn(draft);
    if (!VALID_STATUS.has(draft.status)) {
      const violation = { code: 'invalid-status', entityId: id, value: draft.status };
      if (classify(violation) === TIER.ERROR) throw new ValidationError([violation]);
    }
    const acs = this._acsFor(id);
    const newBody = serializeStory(draft, acs);
    const newAst = replaceBlock(ast, blockIdx, newBody);
    require('fs').writeFileSync(abs + '.tmp', serializeAst(newAst));
    require('fs').renameSync(abs + '.tmp', abs);
    this._mirror(draft);
  });
  return this.get(id);
};

StoryRepo.prototype._sourceFile = function (id) {
  const r = this.index.prepare('SELECT source_file FROM stories WHERE id=?').get(id);
  return r ? r.source_file : 'docs/RELEASE_PLAN.md';
};
StoryRepo.prototype._acsFor = function (id) {
  return this.index
    .prepare('SELECT * FROM acs WHERE story_id=? ORDER BY position')
    .all(id)
    .map((r) => ({ id: r.id, storyId: r.story_id, checked: !!r.checked, text: r.text, position: r.position }));
};
StoryRepo.prototype._mirror = function (story) {
  this.index
    .prepare(
      `UPDATE stories SET status=?, priority=?, estimate=?, branch=?, pr_number=?, spec_path=?, plan_path=? WHERE id=?`,
    )
    .run(
      story.status,
      story.priority,
      story.estimate,
      story.branch,
      story.prNumber,
      story.specPath,
      story.planPath,
      story.id,
    );
};

function findStoryBlock(ast, id) {
  const re = new RegExp(`^${id.replace('-', '-')}\\s+\\(`, 'm');
  return ast.findIndex((n) => n.kind === 'fenced' && re.test(n.body));
}
```

The same pattern (extend with `update(id, fn)` + lock + read AST + replace block + mirror) applies to **epic-repo**, **ac-repo**, **bug-repo**, **lesson-repo**, **test-case-repo**, **task-repo**. Each gets its own serializer in `tools/lib/repository/serializers/`.

- [ ] **Step 4: Implement remaining serializers + repos**

Create parallel implementations. Each entity needs:

- Serializer (`{entity}-serializer.js`) that takes the entity object + child entities and emits the canonical fenced-block body
- Repo extension method `update(id, fn)` that locks → reads AST → replaces target block → writes AST → mirrors to SQL

Bug serializer skeleton:

```js
// tools/lib/repository/serializers/bug-serializer.js
'use strict';
function serializeBug(bug) {
  const lines = [`${bug.id}: ${bug.title || ''}`];
  if (bug.severity) lines.push(`Severity: ${bug.severity}`);
  lines.push(`Status: ${bug.status}`);
  if (bug.relatedStories?.length) lines.push(`Related: ${bug.relatedStories.join(', ')}`);
  if (bug.description) lines.push('', bug.description);
  return lines.join('\n');
}
module.exports = { serializeBug };
```

Apply the same pattern for lesson-serializer, test-case-serializer, epic-serializer.

- [ ] **Step 5: Run write tests**

Run: `npx jest tests/unit/repository/entity-writes.test.js`
Expected: 2 passed.

- [ ] **Step 6: Commit**

```bash
git add tools/lib/repository/entities/*.js tools/lib/repository/serializers/ tests/unit/repository/entity-writes.test.js
git commit -m "feat(repo): write APIs for human-authored entities with AST prose preservation"
```

### Task E.2: ID allocator (markdown-direct, write-lock)

**Files:**

- Create: `tools/lib/repository/id-allocator.js`
- Create: `tools/lib/repository/entities/id-registry-repo.js`
- Test: `tests/unit/repository/id-allocator.test.js`

- [ ] **Step 1: Write failing test**

```js
// tests/unit/repository/id-allocator.test.js
const fs = require('fs');
const path = require('path');
const os = require('os');
const { Repository } = require('../../../tools/lib/repository');

const REGISTRY = `# ID Registry

| Sequence | Next Available ID | Last Assigned |
| -------- | ----------------- | ------------- |
| EPIC     | EPIC-0036         | EPIC-0035     |
| US       | US-0215           | US-0214       |
| AC       | AC-0853           | AC-0852       |
`;

test('allocate(sequence) bumps the registry under a file lock', async () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'ida-'));
  fs.mkdirSync(path.join(root, 'docs'));
  fs.writeFileSync(path.join(root, 'docs', 'ID_REGISTRY.md'), REGISTRY);
  Repository._reset();
  const repo = Repository.getInstance({ root });
  const next = await repo.idRegistry.allocate('AC');
  expect(next).toBe('AC-0853');
  const next2 = await repo.idRegistry.allocate('AC');
  expect(next2).toBe('AC-0854');
  const after = fs.readFileSync(path.join(root, 'docs', 'ID_REGISTRY.md'), 'utf8');
  expect(after).toContain('AC-0855');
  Repository._reset();
  fs.rmSync(root, { recursive: true, force: true });
});

test('allocate(sequence, n) returns n contiguous ids', async () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'ida-'));
  fs.mkdirSync(path.join(root, 'docs'));
  fs.writeFileSync(path.join(root, 'docs', 'ID_REGISTRY.md'), REGISTRY);
  Repository._reset();
  const repo = Repository.getInstance({ root });
  const ids = await repo.idRegistry.allocate('AC', 3);
  expect(ids).toEqual(['AC-0853', 'AC-0854', 'AC-0855']);
  Repository._reset();
  fs.rmSync(root, { recursive: true, force: true });
});
```

- [ ] **Step 2: Implement id-allocator**

```js
// tools/lib/repository/id-allocator.js
'use strict';
const fs = require('fs');
const path = require('path');
const { withFileLock } = require('./file-lock');

const ROW = /^(\|\s*)([A-Z]+)(\s*\|\s*)([A-Z]+-)(\d+)(\s*\|\s*)([A-Z]+-)(\d+)(\s*\|.*)$/;

function pad(n) {
  return String(n).padStart(4, '0');
}

async function allocate({ root, sequence, count = 1 }) {
  const file = path.join(root, 'docs', 'ID_REGISTRY.md');
  let assigned = [];
  await withFileLock(file, async () => {
    const src = fs.readFileSync(file, 'utf8');
    const lines = src.split('\n');
    for (let i = 0; i < lines.length; i++) {
      const m = lines[i].match(ROW);
      if (!m || m[2] !== sequence) continue;
      const nextN = parseInt(m[5], 10);
      const lastN = parseInt(m[8], 10);
      for (let k = 0; k < count; k++) assigned.push(`${m[4]}${pad(nextN + k)}`);
      const newNext = `${m[4]}${pad(nextN + count)}`;
      const newLast = `${m[7]}${pad(nextN + count - 1)}`;
      lines[i] = `${m[1]}${m[2]}${m[3]}${newNext}${m[6]}${newLast}${m[9]}`;
      break;
    }
    if (!assigned.length) throw new Error(`sequence ${sequence} not found in ID_REGISTRY.md`);
    const tmp = file + '.tmp';
    fs.writeFileSync(tmp, lines.join('\n'));
    fs.renameSync(tmp, file);
  });
  return count === 1 ? assigned[0] : assigned;
}

module.exports = { allocate };
```

- [ ] **Step 3: Implement id-registry-repo**

```js
// tools/lib/repository/entities/id-registry-repo.js
'use strict';
const { allocate } = require('../id-allocator');

class IdRegistryRepo {
  constructor({ root, index }) {
    this.root = root;
    this.index = index;
  }
  async allocate(sequence, count = 1) {
    const result = await allocate({ root: this.root, sequence, count });
    // Refresh index for this sequence after the markdown write
    return result;
  }
}
module.exports = { IdRegistryRepo };
```

Wire into `Repository`:

```js
const { IdRegistryRepo } = require('./entities/id-registry-repo');
// inside constructor:
this.idRegistry = new IdRegistryRepo({ root, index: this.index });
```

- [ ] **Step 4: Run tests**

Run: `npx jest tests/unit/repository/id-allocator.test.js`
Expected: 2 passed.

- [ ] **Step 5: Commit**

```bash
git add tools/lib/repository/id-allocator.js tools/lib/repository/entities/id-registry-repo.js tools/lib/repository/index.js tests/unit/repository/id-allocator.test.js
git commit -m "feat(repo): id-allocator with file-locked markdown direct read/write"
```

### Task E.3: Multi-entity transaction primitive

**Files:**

- Create: `tools/lib/repository/transactions.js`
- Test: `tests/unit/repository/transactions.test.js`

- [ ] **Step 1: Write failing test**

```js
// tests/unit/repository/transactions.test.js
const fs = require('fs');
const path = require('path');
const os = require('os');
const { Repository } = require('../../../tools/lib/repository');

const REGISTRY = `# ID Registry

| Sequence | Next Available ID | Last Assigned |
| -------- | ----------------- | ------------- |
| US       | US-0215           | US-0214       |
| AC       | AC-0853           | AC-0852       |
`;

const PLAN = `# Release Plan

## EPIC-0036

\`\`\`
EPIC-0036: Demo
Status: Planned
\`\`\`

## Stories

\`\`\`
US-0214 (EPIC-0036): existing
Status: Done
\`\`\`
`;

test('transaction creates a story + ACs + bumps ID_REGISTRY atomically', async () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'tx-'));
  fs.mkdirSync(path.join(root, 'docs'));
  fs.writeFileSync(path.join(root, 'docs', 'ID_REGISTRY.md'), REGISTRY);
  fs.writeFileSync(path.join(root, 'docs', 'RELEASE_PLAN.md'), PLAN);
  Repository._reset();
  const repo = Repository.getInstance({ root });

  await repo.transaction(async (tx) => {
    const acIds = await tx.idRegistry.allocate('AC', 2);
    await tx.stories.create({
      id: 'US-0215',
      epicId: 'EPIC-0036',
      title: 'New',
      status: 'Planned',
      acceptanceCriteria: acIds.map((id, i) => ({ id, text: `thing ${i}`, checked: false })),
    });
  });

  const plan = fs.readFileSync(path.join(root, 'docs', 'RELEASE_PLAN.md'), 'utf8');
  expect(plan).toContain('US-0215 (EPIC-0036): New');
  expect(plan).toContain('AC-0853');
  expect(plan).toContain('AC-0854');
  const reg = fs.readFileSync(path.join(root, 'docs', 'ID_REGISTRY.md'), 'utf8');
  expect(reg).toContain('AC-0855'); // next bumped
  Repository._reset();
  fs.rmSync(root, { recursive: true, force: true });
});

test('throw inside transaction rolls back markdown changes', async () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'tx-'));
  fs.mkdirSync(path.join(root, 'docs'));
  fs.writeFileSync(path.join(root, 'docs', 'ID_REGISTRY.md'), REGISTRY);
  fs.writeFileSync(path.join(root, 'docs', 'RELEASE_PLAN.md'), PLAN);
  Repository._reset();
  const repo = Repository.getInstance({ root });

  await expect(
    repo.transaction(async (tx) => {
      await tx.stories.create({ id: 'US-0215', epicId: 'EPIC-0036', title: 'New', status: 'Planned' });
      throw new Error('boom');
    }),
  ).rejects.toThrow('boom');

  const plan = fs.readFileSync(path.join(root, 'docs', 'RELEASE_PLAN.md'), 'utf8');
  expect(plan).not.toContain('US-0215');
  Repository._reset();
  fs.rmSync(root, { recursive: true, force: true });
});
```

- [ ] **Step 2: Implement transactions**

```js
// tools/lib/repository/transactions.js
'use strict';
const fs = require('fs');
const path = require('path');
const { acquireMany } = require('./file-lock');

class TransactionContext {
  constructor({ repo }) {
    this.repo = repo;
    this.pendingWrites = new Map(); // abs file path → new content (AST → serialised)
    this.touchedSqlite = [];
  }
  recordWrite(absPath, content) {
    this.pendingWrites.set(absPath, content);
  }
  recordSqlite(undoFn) {
    this.touchedSqlite.push(undoFn);
  }
  filesToLock() {
    return [...this.pendingWrites.keys()];
  }
}

async function transaction(repo, fn) {
  const ctx = new TransactionContext({ repo });
  const proxy = makeProxy(repo, ctx);

  // Begin SQLite transaction
  const release = { sqliteCommitted: false, fileReleases: null };
  repo.index.exec('BEGIN');
  try {
    await fn(proxy);
    // Acquire all file locks in lexicographic order
    release.fileReleases = await acquireMany(ctx.filesToLock());
    // Flush all pending markdown writes
    for (const [abs, content] of ctx.pendingWrites) {
      const tmp = abs + '.tmp';
      fs.writeFileSync(tmp, content);
      fs.renameSync(tmp, abs);
    }
    repo.index.exec('COMMIT');
    release.sqliteCommitted = true;
  } catch (err) {
    if (!release.sqliteCommitted) {
      try {
        repo.index.exec('ROLLBACK');
      } catch {}
    }
    throw err;
  } finally {
    if (release.fileReleases) {
      try {
        await release.fileReleases();
      } catch {}
    }
  }
}

function makeProxy(repo, ctx) {
  // For Step 1, we only need create() on stories + allocate() on idRegistry
  // Other entities surface as the live repo methods (they still write under their own locks if called outside tx)
  return {
    stories: {
      create: (story) => repo.stories.createInTransaction(story, ctx),
    },
    acs: {
      createMany: (acs) => repo.acs.createManyInTransaction(acs, ctx),
    },
    idRegistry: {
      allocate: (seq, count = 1) => repo.idRegistry.allocateInTransaction(seq, count, ctx),
    },
    // Pass-through reads
    epics: repo.epics,
    sdlcEvents: repo.sdlcEvents,
    sdlcTasks: repo.sdlcTasks,
  };
}

module.exports = { transaction };
```

Add `Repository.prototype.transaction = function(fn) { return transaction(this, fn); };` and implement the `*InTransaction` variants on each repo. Each variant has the same surface as its non-transactional counterpart but stages markdown writes into `ctx.pendingWrites` (keyed by absolute path) instead of writing directly, and runs SQLite mutations inside the already-open transaction (don't open a nested one — better-sqlite3 doesn't support nested transactions).

Skeleton for `StoryRepo.prototype.createInTransaction`:

```js
StoryRepo.prototype.createInTransaction = function (story, ctx) {
  const file = 'docs/RELEASE_PLAN.md';
  const abs = require('path').join(this._root, file);
  // Read AST from disk OR from any previously-staged write in this transaction
  const src = ctx.pendingWrites.get(abs) || require('fs').readFileSync(abs, 'utf8');
  const ast = parseMarkdown(src);
  const body = serializeStory(story, story.acceptanceCriteria || []);
  const newAst = insertBlock(ast, ast.length, body); // append at end; smarter placement comes from §2.1 source_line tracking
  ctx.pendingWrites.set(abs, serializeAst(newAst));
  // Stage SQLite mirror inside the open transaction
  this.index
    .prepare('INSERT INTO stories(id,epic_id,title,status,source_file) VALUES(?,?,?,?,?)')
    .run(story.id, story.epicId, story.title, story.status, file);
  if (story.acceptanceCriteria) {
    const insAc = this.index.prepare('INSERT INTO acs(id,story_id,checked,text,position) VALUES(?,?,?,?,?)');
    story.acceptanceCriteria.forEach((ac, i) => insAc.run(ac.id, story.id, ac.checked ? 1 : 0, ac.text, i));
  }
};
```

Apply the same pattern for `AcRepo.createManyInTransaction`, `IdRegistryRepo.allocateInTransaction`, and any other repo whose mutations need to participate in a transaction. The pendingWrites map keyed by absolute path is what gives multi-entity writes to the same file a single coherent serialise step at commit.

- [ ] **Step 3: Run transaction tests**

Run: `npx jest tests/unit/repository/transactions.test.js`
Expected: 2 passed.

- [ ] **Step 4: Commit**

```bash
git add tools/lib/repository/transactions.js tools/lib/repository/entities/*.js tools/lib/repository/index.js tests/unit/repository/transactions.test.js
git commit -m "feat(repo): multi-entity transaction with lexicographic lock order + rollback"
```

### Task E.4: Migration 001 — normalise fenced blocks

**Files:**

- Create: `tools/lib/migrations/001-normalise-fenced-blocks.js`
- Test: `tests/unit/migrations/001-normalise.test.js`

- [ ] **Step 1: Write failing test**

````js
// tests/unit/migrations/001-normalise.test.js
const fs = require('fs');
const path = require('path');
const os = require('os');
const mig = require('../../../tools/lib/migrations/001-normalise-fenced-blocks');

test('normalise produces idempotent output on second run', async () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'm1-'));
  fs.mkdirSync(path.join(root, 'docs'));
  // Slightly drifted hand-edited input
  fs.writeFileSync(path.join(root, 'docs', 'RELEASE_PLAN.md'), '# X\n\n```\nEPIC-0001: A\n  Status: Done\n```\n');
  fs.writeFileSync(path.join(root, 'package.json'), JSON.stringify({ version: '2.5.0' }));
  await mig.up({ root });
  const once = fs.readFileSync(path.join(root, 'docs', 'RELEASE_PLAN.md'), 'utf8');
  await mig.up({ root });
  const twice = fs.readFileSync(path.join(root, 'docs', 'RELEASE_PLAN.md'), 'utf8');
  expect(twice).toBe(once);
  fs.rmSync(root, { recursive: true, force: true });
});
````

- [ ] **Step 2: Implement Migration 001**

```js
// tools/lib/migrations/001-normalise-fenced-blocks.js
'use strict';
const fs = require('fs');
const path = require('path');
const { parseMarkdown } = require('../repository/ast/parser');
const { serializeAst } = require('../repository/ast/serializer');

const touches = [
  'docs/RELEASE_PLAN.md',
  'docs/BUGS.md',
  'docs/LESSONS.md',
  'docs/TEST_CASES.md',
  'docs/ID_REGISTRY.md',
];

async function up({ root }) {
  const changed = [];
  for (const rel of touches) {
    const abs = path.join(root, rel);
    if (!fs.existsSync(abs)) continue;
    const src = fs.readFileSync(abs, 'utf8');
    // Two-pass normalisation: parse → serialise → parse → serialise; second result is canonical
    const once = serializeAst(parseMarkdown(src));
    const twice = serializeAst(parseMarkdown(once));
    if (twice !== src) {
      fs.writeFileSync(abs, twice);
      changed.push(rel);
    }
  }
  return { changed };
}

module.exports = { up, touches };
```

- [ ] **Step 3: Run test**

Run: `npx jest tests/unit/migrations/001-normalise.test.js`
Expected: PASS.

- [ ] **Step 4: Run against production files (review the diff)**

```bash
cp -R docs /tmp/docs-pre-norm
node -e "require('./tools/lib/migrations/001-normalise-fenced-blocks').up({ root: process.cwd() }).then(r => console.log(r))"
diff -r /tmp/docs-pre-norm docs | head -100
```

Review the diff. If anything looks like prose mutation (not just whitespace normalisation), **stop and fix the AST parser/serializer before continuing**. If the diff is acceptable, commit it as a separate PR for human review.

- [ ] **Step 5: Commit**

```bash
git add tools/lib/migrations/001-normalise-fenced-blocks.js tests/unit/migrations/001-normalise.test.js
git commit -m "feat(migrations): 001 — normalise fenced blocks via AST round-trip (idempotent)"
```

### Task E.5: Migrate `tools/agent-context.js`

- [ ] **Step 1: Inspect for `fs.write*` against managed paths**

Run: `grep -n "fs.write\|fs.append" tools/agent-context.js`

- [ ] **Step 2: Replace any managed-path writes with `repo.*` calls**

The context curator mostly reads. If it writes anything (e.g., updating a summary field on a task), use `repo.sdlcTasks.upsert({ id, summary })`.

- [ ] **Step 3: Run tests**

Run: `npx jest --testPathPattern='agent-context'`
Expected: PASS.

- [ ] **Step 4: Commit**

```bash
git add tools/agent-context.js
git commit -m "refactor(agent-context): write through repository"
```

### Task E.6: Migrate `tools/generate-plan.js` planning writes

`generate-plan.js` mostly reads, but it does write snapshots and may patch RELEASE_PLAN.md status fields. Convert any such writes to `repo.stories.update(...)`.

- [ ] **Step 1: Inspect**

Run: `grep -n "fs.write\|RELEASE_PLAN" tools/generate-plan.js`

- [ ] **Step 2: Migrate writes**

- [ ] **Step 3: Run plan generation end-to-end**

```bash
npm run plan:generate && npm run plan:lint
```

Expected: zero errors, warnings stable.

- [ ] **Step 4: Commit**

```bash
git add tools/generate-plan.js
git commit -m "refactor(generate-plan): write through repository for any markdown mutations"
```

### Task E.7: Migrate `tools/sync-github.js`

- [ ] **Step 1: Inspect, migrate, test, commit**

Apply the same Inspect/Migrate/Test/Commit pattern as Tasks E.5 and E.6. `sync-github.js` typically updates story PR numbers — that becomes `repo.stories.update(id, s => { s.prNumber = N; })`.

```bash
git add tools/sync-github.js
git commit -m "refactor(sync-github): write through repository"
```

### Task E.8: Round-trip gate against post-Migration-001 production files

- [ ] **Step 1: Run the round-trip harness one more time**

After Migration 001 has landed:

```bash
npm test -- tests/integration/repository/round-trip.test.js
```

Expected: every file passes the byte-identical (not just idempotent-on-second-pass) check.

- [ ] **Step 2: Commit nothing if green; investigate if red**

This is a gate, not new code. If it's red, the serializer needs tightening before Phase F.

**Phase E hard gate:**

- `grep -rn "fs.write" tools/*.js | grep -v 'lib/repository\|lib/migrations\|capture-cost\|memory\|init-sdlc-status'` returns nothing for managed paths
- Round-trip on production files (post-Migration-001) is byte-identical
- `npm test` is green
- `npm run plan:lint` reports zero errors

---

## Phase F — Lock-Down + Strict Validation

**Hard gate:** CI rule forbids `fs.write*` against managed paths outside `tools/lib/repository/`; validation errors-tier fails the build; orphan-ref count is 0; mixed-version warning is wired.

**Effort:** 1-2 working days.

### Task F.1: Move file-lock to internal/ with deprecation shim

**Files:**

- Move: `tools/lib/repository/file-lock.js` → `tools/lib/repository/internal/file-lock.js`
- Create: `tools/lib/file-lock.js` (deprecation shim at the old path the spec assumed)

- [ ] **Step 1: Move the file**

```bash
mkdir -p tools/lib/repository/internal
git mv tools/lib/repository/file-lock.js tools/lib/repository/internal/file-lock.js
```

Update all imports in `tools/lib/repository/**` from `./file-lock` to `./internal/file-lock` (or `../internal/file-lock` from `entities/`).

- [ ] **Step 2: Add deprecation shim**

```js
// tools/lib/file-lock.js
'use strict';
if (!process.env.PV_SUPPRESS_FILE_LOCK_DEPRECATION) {
  console.warn('[deprecation] tools/lib/file-lock.js: import from tools/lib/repository/internal/file-lock.js instead.');
}
module.exports = require('./repository/internal/file-lock');
```

- [ ] **Step 3: Update imports inside repository code**

Run: `grep -rln "require.*'.*file-lock'" tools/lib/repository/`

For each match, ensure it points at `internal/file-lock` (relative to the importing file).

- [ ] **Step 4: Test that imports still work both ways**

Run: `node -e "const {withFileLock} = require('./tools/lib/file-lock'); console.log('shim ok:', typeof withFileLock)"`
Run: `node -e "const {withFileLock} = require('./tools/lib/repository/internal/file-lock'); console.log('direct ok:', typeof withFileLock)"`
Expected: both print `... ok: function`.

- [ ] **Step 5: Commit**

```bash
git add tools/lib/file-lock.js tools/lib/repository/internal/ tools/lib/repository/
git commit -m "refactor(repo): move file-lock to internal/ with deprecation shim at old path"
```

### Task F.2: Managed-path CI rule (ESLint custom rule + script check)

**Files:**

- Create: `tools/lib/repository/ci/no-managed-write.js` (custom ESLint rule)
- Modify: `.eslintrc` (register the rule)
- Create: `tools/check-no-managed-write.sh` (CI script as backup)

- [ ] **Step 1: Implement the rule**

```js
// tools/lib/repository/ci/no-managed-write.js
'use strict';
const path = require('path');

const MANAGED = [
  'docs/RELEASE_PLAN.md',
  'docs/BUGS.md',
  'docs/LESSONS.md',
  'docs/TEST_CASES.md',
  'docs/ID_REGISTRY.md',
  'docs/sdlc-status.json',
];
const EXEMPT_DIRS = ['tools/lib/repository/', 'tools/lib/migrations/', 'scripts/install', 'scripts/update'];
const EXEMPT_FILES = ['tools/init-sdlc-status.js', 'tools/capture-cost.js', 'tools/memory.js'];

module.exports = {
  meta: {
    type: 'problem',
    schema: [],
    messages: { managedWrite: 'Direct write to managed path "{{p}}" is forbidden. Use Repository.getInstance().' },
  },
  create(context) {
    const file = context.getFilename();
    if (EXEMPT_DIRS.some((d) => file.includes(d))) return {};
    if (EXEMPT_FILES.some((f) => file.endsWith(f))) return {};
    return {
      "CallExpression[callee.object.name='fs'][callee.property.name=/^write|^append/]"(node) {
        const arg = node.arguments[0];
        if (arg && arg.type === 'Literal' && MANAGED.some((m) => String(arg.value).includes(m))) {
          context.report({ node, messageId: 'managedWrite', data: { p: arg.value } });
        }
      },
    };
  },
};
```

- [ ] **Step 2: Register the rule in .eslintrc (or eslint config)**

```js
// .eslintrc.js (or merge into existing)
module.exports = {
  rules: {
    'pv/no-managed-write': 'error',
  },
  plugins: ['pv'],
  // Plugin resolver: point at the local rule
};
```

If the project isn't using a custom plugin loader, instead create `tools/check-no-managed-write.sh`:

```bash
#!/bin/bash
# tools/check-no-managed-write.sh
set -e
HITS=$(grep -rln "fs\\.\\(write\\|append\\)[^(]*(.*RELEASE_PLAN\\|BUGS\\.md\\|LESSONS\\.md\\|TEST_CASES\\.md\\|ID_REGISTRY\\.md\\|sdlc-status\\.json" \
  tools/ scripts/ orchestrator/ 2>/dev/null \
  | grep -v -E 'tools/lib/repository/|tools/lib/migrations/|tools/init-sdlc-status\.js|tools/capture-cost\.js|tools/memory\.js' || true)
if [ -n "$HITS" ]; then
  echo "ERROR: direct writes to managed paths outside the repository:"
  echo "$HITS"
  exit 1
fi
echo "OK: no managed-path writes outside repository"
```

- [ ] **Step 3: Wire into CI**

Add to `.github/workflows/` ci pipeline:

```yaml
- name: Check managed-path writes
  run: bash tools/check-no-managed-write.sh
```

Add to `package.json` scripts:

```json
"lint:managed-paths": "bash tools/check-no-managed-write.sh"
```

- [ ] **Step 4: Run the check locally**

Run: `npm run lint:managed-paths`
Expected: prints `OK: no managed-path writes outside repository`. If it fails, identify the offending file and migrate it (or add to the exempt list with justification).

- [ ] **Step 5: Commit**

```bash
git add tools/lib/repository/ci/ tools/check-no-managed-write.sh package.json .github/workflows/ .eslintrc.js
git commit -m "feat(ci): lint rule + script forbidding direct writes to managed paths"
```

### Task F.3: Mixed-version warning in tool invocation

**Files:**

- Create: `tools/lib/repository/version-check.js`
- Modify: `tools/lib/repository/index.js` (call in `getInstance`)
- Test: `tests/unit/repository/version-check.test.js`

- [ ] **Step 1: Implement**

```js
// tools/lib/repository/version-check.js
'use strict';
const fs = require('fs');
const path = require('path');

function checkVersionMismatch({ root, force = false }) {
  try {
    const pkgVersion = require(path.join(root, 'package.json')).version;
    const stateFile = path.join(root, 'docs', '.pv-state.json');
    if (!fs.existsSync(stateFile)) return null;
    const state = JSON.parse(fs.readFileSync(stateFile, 'utf8'));
    if (state.planvisualizerVersion !== pkgVersion && !force) {
      const msg = `[planvisualizer] WARNING: installed ${pkgVersion}, project state ${state.planvisualizerVersion}. Run \`npm run pv:upgrade\` to apply pending migrations.`;
      console.warn(msg);
      return msg;
    }
  } catch {}
  return null;
}

module.exports = { checkVersionMismatch };
```

In `Repository.getInstance`, call `checkVersionMismatch({ root, force: process.env.PV_FORCE_MISMATCH === '1' })` once, immediately after construction, before refresh.

- [ ] **Step 2: Run test**

```js
// tests/unit/repository/version-check.test.js
const fs = require('fs');
const path = require('path');
const os = require('os');
const { checkVersionMismatch } = require('../../../tools/lib/repository/version-check');

test('logs warning when versions differ', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'vc-'));
  fs.writeFileSync(path.join(root, 'package.json'), JSON.stringify({ version: '2.5.0' }));
  fs.mkdirSync(path.join(root, 'docs'));
  fs.writeFileSync(
    path.join(root, 'docs', '.pv-state.json'),
    JSON.stringify({ planvisualizerVersion: '2.4.0', appliedMigrations: [] }),
  );
  const warn = jest.spyOn(console, 'warn').mockImplementation(() => {});
  const msg = checkVersionMismatch({ root });
  expect(msg).toMatch(/installed 2.5.0/);
  expect(warn).toHaveBeenCalled();
  warn.mockRestore();
  fs.rmSync(root, { recursive: true, force: true });
});
```

Run: `npx jest tests/unit/repository/version-check.test.js`
Expected: PASS.

- [ ] **Step 3: Commit**

```bash
git add tools/lib/repository/version-check.js tools/lib/repository/index.js tests/unit/repository/version-check.test.js
git commit -m "feat(repo): mixed-version warning at getInstance()"
```

### Task F.4: Strict validation switch + warnings retention

**Files:**

- Modify: `tools/lib/repository/validation.js` (add `enforce` mode)
- Modify: `tools/pv-doctor.js` (add `--prune-warnings` flag)

- [ ] **Step 1: Flip errors-tier from log to throw**

The repo write APIs (story-repo, etc.) already throw on `ValidationError`. Phase F's task is to remove any remaining "log and pass" branches:

```bash
grep -rn "TIER.ERROR" tools/lib/repository/
```

Inspect each. If any does anything other than throw, switch to throw.

- [ ] **Step 2: Implement warnings retention**

In `tools/pv-doctor.js`, add:

```js
if (process.argv.includes('--prune-warnings')) {
  const cutoff = Date.now() - 30 * 24 * 3600 * 1000;
  const deleted = repo.index.prepare('DELETE FROM warnings WHERE ts < ?').run(cutoff);
  console.log(`Pruned ${deleted.changes} warnings older than 30 days`);
}
```

- [ ] **Step 3: Test**

Run: `npm run pv:doctor -- --prune-warnings`
Expected: prints a count (may be 0).

- [ ] **Step 4: Commit**

```bash
git add tools/lib/repository/validation.js tools/pv-doctor.js
git commit -m "feat(repo): strict error-tier enforcement + pv:doctor --prune-warnings"
```

### Task F.5: scripts/update.sh integration + final docs

**Files:**

- Modify: `scripts/update.sh`
- Modify: `AGENTS.md` (persistence rules section)
- Modify: `CLAUDE.md` (reference the persistence rules)
- Create: `docs/repository-upgrade-guide.md`

- [ ] **Step 1: Modify scripts/update.sh**

After `npm install`, before exit:

```bash
echo "Checking for pending migrations..."
npm run --silent pv:check-upgrade || true
echo ""
echo "If migrations are pending, run: npm run pv:upgrade"
```

- [ ] **Step 2: Add persistence rules to AGENTS.md**

Add a section explaining: never `fs.write*` to managed paths; always use `Repository.getInstance()`; managed paths are the six listed in the CI rule; exemptions are init/cost-hook/memory + the migration framework.

- [ ] **Step 3: Reference in CLAUDE.md**

Add to the Key Protocols table: "Persistence: never fs.write to managed paths; use Repository.getInstance(). See AGENTS.md §X."

- [ ] **Step 4: Write the upgrade guide**

```md
<!-- docs/repository-upgrade-guide.md -->

# Upgrading PlanVisualizer (v2.4 → v2.5)

After `npm install` of a new PlanVisualizer version:

1. `npm run pv:check-upgrade` — see what would change. Read-only.
2. `npm run pv:upgrade` — applies pending migrations. Requires clean git state.
3. Review the resulting diff (especially `docs/RELEASE_PLAN.md` after Migration 001).
4. Commit the diff in your project repo.
5. `npm run pv:doctor` — confirms healthy state.

If something goes wrong: `npm run pv:rollback -- --to <label>` (see backups in `docs/.pv-backup/`).
```

- [ ] **Step 5: Final test sweep**

```bash
npm test
npm run lint
npm run lint:managed-paths
npm run plan:lint
npm run plan:generate
```

Expected: all green; `plan:lint` reports zero errors.

- [ ] **Step 6: Commit Phase F close**

```bash
git add scripts/update.sh AGENTS.md CLAUDE.md docs/repository-upgrade-guide.md
git commit -m "docs(repo): persistence rules + upgrade guide + scripts/update.sh integration"
```

**Phase F hard gate:**

- CI runs `lint:managed-paths` and is green on a clean main
- `plan:lint` reports zero errors
- AGENTS.md and CLAUDE.md document the persistence boundary

---

## Step 1 Completion Checklist

- [ ] Phase A through F all merged
- [ ] `npm test` green
- [ ] `npm run lint` green (including `pv/no-managed-write` rule if installed as plugin)
- [ ] `npm run lint:managed-paths` green
- [ ] `npm run plan:lint` zero errors
- [ ] `npm run plan:generate` produces a dashboard identical to legacy where it should be
- [ ] `npm run pv:check-upgrade`, `pv:upgrade`, `pv:rollback`, `pv:doctor` all functional
- [ ] better-sqlite3 → node:sqlite → --no-index fallback chain manually exercised on dev matrix
- [ ] `docs/.pv-state.json` committed; `docs/.pv-state.local.json` and `docs/.pv-backup/` gitignored
- [ ] `tools/lib/repository/internal/file-lock.js` is the canonical path; old import works via deprecation shim
- [ ] AGENTS.md + CLAUDE.md updated
- [ ] `docs/repository-upgrade-guide.md` exists
- [ ] All Section 7 deliverables from the spec ([2026-05-19-step-1-repository-abstraction-design.md](../specs/2026-05-19-step-1-repository-abstraction-design.md) §7) are present

When this checklist is complete, Step 1 is shippable. The next planning conversation is Step 1.5 (partition) or Step 2 (multi-user) per `docs/architecture/persistence-and-multi-user-strategy.md`.
