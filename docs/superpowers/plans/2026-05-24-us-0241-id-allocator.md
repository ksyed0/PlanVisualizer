# US-0241 Implementation Plan — `repo.idRegistry.allocate(sequence, count)`

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship `tools/lib/repository/id-allocator.js` exposing `allocate(sequence, count = 1) → string | string[]` and wire it onto `Repository` as `repo.idRegistry`. The allocator reads `docs/ID_REGISTRY.md` under `withFileLock`, bumps the matching row's `next_id` by `count`, sets `last_assigned` to the highest allocated ID, rewrites the row IN PLACE preserving the pipe-table column alignment, releases the lock, and returns the allocated IDs. **Bypasses the SQLite index entirely** (registry is meta-state; putting it in SQL creates a bootstrap cycle — see spec §4.1).

**Architecture:** One module, one exported function. Pure-string parsing for the pipe-table row (no full-markdown round-trip needed). Concurrent allocations are serialised by `proper-lockfile` via `withFileLock`. The allocator does NOT touch the SQLite index — every other entity write goes through SQL, but ID allocation is the bootstrap that produces the IDs SQL stores. Inside a transaction (US-0242) the allocator reserves IDs in-memory and defers the on-disk mutation to commit; that wrapping is added by US-0242, not here.

**Tech Stack:** Node ≥20, Jest, `proper-lockfile` (already a dep). No new runtime modules.

---

## File Structure

| File                                                           | Action | Responsibility                                                                                   |
| -------------------------------------------------------------- | ------ | ------------------------------------------------------------------------------------------------ |
| `tools/lib/repository/id-allocator.js`                         | Create | `allocate(sequence, count)` + helpers for parsing the row + bumping the IDs + rewriting the row. |
| `tools/lib/repository/index.js`                                | Modify | Construct `this.idRegistry = new IdAllocator({ root })` in the Repository ctor.                  |
| `tests/unit/repository/id-allocator.test.js`                   | Create | Single-allocate / multi-allocate / column-alignment / round-trip-parse coverage.                 |
| `tests/integration/repository/id-allocator-concurrent.test.js` | Create | Concurrent `Promise.all([allocate('US'), allocate('US')])` returns non-overlapping IDs.          |

---

## Pre-Work

Branch base: **`origin/develop`**. This story is parallel-safe with US-0240 (no shared files). If running both in parallel, allow US-0240's PR to land first to avoid touching `index.js` twice.

- [ ] **Pre-Step 1: Branch + commit plan**

```bash
cd /Users/Kamal_Syed/Projects/PlanVisualizer/.claude/worktrees/phase-e-impl
git fetch origin develop --quiet
git checkout -b feature/US-0241-id-allocator origin/develop
git add docs/superpowers/plans/2026-05-24-us-0241-id-allocator.md
git commit -m "docs: US-0241 implementation plan

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>"
```

- [ ] **Pre-Step 2: Verify current ID_REGISTRY.md format**

```bash
head -16 docs/ID_REGISTRY.md
```

Expected first 16 lines: the title, a 2-line intro, an 8-row pipe table with header `| **Sequence** | **Next Available ID** | **Last Assigned** |` and a separator row `| ------------ | --------------------- | ----------------- |`, then 8 data rows. The allocator must preserve this exact spacing.

---

## Task 1: Pure-string row parser + bumper

**Files:**

- Create: `tools/lib/repository/id-allocator.js` (helpers only — no allocate() yet)
- Create: `tests/unit/repository/id-allocator.test.js` (helper-level tests)

- [ ] **Step 1: Write the failing test**

Create `tests/unit/repository/id-allocator.test.js`:

```js
'use strict';

const { _parseRow, _bumpRow, _rewriteRow } = require('../../../tools/lib/repository/id-allocator');

const SAMPLE_REGISTRY = [
  '# ID Registry',
  '',
  'Single source of truth for the next available ID in every artefact sequence.',
  '**Update this file immediately whenever a new artefact is created.**',
  '',
  '| **Sequence** | **Next Available ID** | **Last Assigned** |',
  '| ------------ | --------------------- | ----------------- |',
  '| EPIC         | EPIC-0046             | EPIC-0045         |',
  '| US           | US-0264               | US-0263           |',
  '| TASK         | TASK-0071             | TASK-0070         |',
  '| AC           | AC-1023               | AC-1022           |',
  '| TC           | TC-0553               | TC-0552           |',
  '| BUG          | BUG-0264              | BUG-0263          |',
  '| Lesson       | L-0086                | L-0085            |',
  '| ENH          | ENH-0005              | ENH-0004          |',
  '',
  '**Rules:**',
  '',
].join('\n');

describe('_parseRow', () => {
  it('extracts the US row sequence/next/last', () => {
    const row = _parseRow(SAMPLE_REGISTRY, 'US');
    expect(row).toEqual({
      sequence: 'US',
      prefix: 'US',
      nextId: 'US-0264',
      nextNum: 264,
      lastAssigned: 'US-0263',
      lastNum: 263,
      // The exact text of the matched line for in-place replacement:
      lineText: '| US           | US-0264               | US-0263           |',
    });
  });

  it('extracts the Lesson row whose prefix is "L" not "Lesson"', () => {
    const row = _parseRow(SAMPLE_REGISTRY, 'Lesson');
    expect(row.prefix).toBe('L');
    expect(row.nextId).toBe('L-0086');
  });

  it('returns null when the sequence is not in the table', () => {
    expect(_parseRow(SAMPLE_REGISTRY, 'NOPE')).toBeNull();
  });
});

describe('_bumpRow', () => {
  it('count=1: allocates [US-0264], next becomes US-0265, last becomes US-0264', () => {
    const row = _parseRow(SAMPLE_REGISTRY, 'US');
    const { ids, newRow } = _bumpRow(row, 1);
    expect(ids).toEqual(['US-0264']);
    expect(newRow.nextId).toBe('US-0265');
    expect(newRow.lastAssigned).toBe('US-0264');
  });

  it('count=3: allocates 3 contiguous, next bumped by 3, last is the highest', () => {
    const row = _parseRow(SAMPLE_REGISTRY, 'US');
    const { ids, newRow } = _bumpRow(row, 3);
    expect(ids).toEqual(['US-0264', 'US-0265', 'US-0266']);
    expect(newRow.nextId).toBe('US-0267');
    expect(newRow.lastAssigned).toBe('US-0266');
  });

  it('preserves zero-padding width of the source row', () => {
    const row = _parseRow(SAMPLE_REGISTRY, 'AC');
    const { ids } = _bumpRow(row, 1);
    expect(ids).toEqual(['AC-1023']); // 4-digit padding preserved
  });

  it('grows past zero-pad boundary naturally (5 digits past 9999)', () => {
    const row = {
      sequence: 'US',
      prefix: 'US',
      nextId: 'US-9998',
      nextNum: 9998,
      lastAssigned: 'US-9997',
      lastNum: 9997,
      lineText: '...',
    };
    const { ids, newRow } = _bumpRow(row, 3);
    expect(ids).toEqual(['US-9998', 'US-9999', 'US-10000']);
    expect(newRow.nextId).toBe('US-10001');
  });

  it('throws on count <= 0', () => {
    const row = _parseRow(SAMPLE_REGISTRY, 'US');
    expect(() => _bumpRow(row, 0)).toThrow(/count/);
    expect(() => _bumpRow(row, -1)).toThrow(/count/);
  });
});

describe('_rewriteRow', () => {
  it('replaces only the targeted row line, preserves column alignment', () => {
    const row = _parseRow(SAMPLE_REGISTRY, 'US');
    const { newRow } = _bumpRow(row, 1);
    const out = _rewriteRow(SAMPLE_REGISTRY, row, newRow);
    // The US row is updated.
    expect(out).toContain('| US           | US-0265               | US-0264           |');
    // The other rows are byte-identical.
    expect(out).toContain('| EPIC         | EPIC-0046             | EPIC-0045         |');
    expect(out).toContain('| Lesson       | L-0086                | L-0085            |');
    // Column widths are preserved — the new line has the same length as
    // the old (padding with spaces to fit the wider column).
    const newLine = out.split('\n').find((l) => l.match(/^\| US\s/));
    const oldLine = row.lineText;
    expect(newLine.length).toBe(oldLine.length);
  });
});
```

- [ ] **Step 2: Run, expect failure**

```bash
npx jest tests/unit/repository/id-allocator.test.js 2>&1 | tail -4
```

Expected: module-not-found.

- [ ] **Step 3: Implement helpers**

Create `tools/lib/repository/id-allocator.js`:

```js
'use strict';

const fs = require('fs');
const path = require('path');
const { withFileLock } = require('./file-lock');

const ID_REGISTRY_REL = path.join('docs', 'ID_REGISTRY.md');

/**
 * Map from `sequence` label (as it appears in the table) to the ID prefix
 * (which differs only for "Lesson" → "L").
 */
const PREFIX_OVERRIDES = { Lesson: 'L' };

function _prefixFor(sequence) {
  return PREFIX_OVERRIDES[sequence] || sequence;
}

/**
 * Parse the pipe-table row for `sequence`. Returns null if not found.
 *
 * `lineText` is the exact whole-line string so _rewriteRow can do a literal
 * string replace (avoids fragile regex over the table).
 */
function _parseRow(text, sequence) {
  const prefix = _prefixFor(sequence);
  // Row pattern: starts with `|`, the sequence label, `|`, the IDs.
  // Use a multiline literal-string scan to find the line.
  const lines = text.split('\n');
  const re = new RegExp(`^\\|\\s*${sequence}\\s*\\|\\s*(${prefix}-\\d+)\\s*\\|\\s*(${prefix}-\\d+)\\s*\\|\\s*$`);
  for (const line of lines) {
    const m = line.match(re);
    if (m) {
      const nextId = m[1];
      const lastAssigned = m[2];
      const nextNum = parseInt(nextId.slice(prefix.length + 1), 10);
      const lastNum = parseInt(lastAssigned.slice(prefix.length + 1), 10);
      return { sequence, prefix, nextId, nextNum, lastAssigned, lastNum, lineText: line };
    }
  }
  return null;
}

function _zeroPadWidth(idStr, prefix) {
  return idStr.length - (prefix.length + 1);
}

function _formatId(prefix, num, padWidth) {
  const s = String(num);
  if (s.length >= padWidth) return `${prefix}-${s}`;
  return `${prefix}-${s.padStart(padWidth, '0')}`;
}

function _bumpRow(row, count) {
  if (!Number.isInteger(count) || count <= 0) {
    throw new Error(`_bumpRow: count must be positive integer, got ${count}`);
  }
  const padWidth = _zeroPadWidth(row.nextId, row.prefix);
  const ids = [];
  for (let i = 0; i < count; i++) {
    ids.push(_formatId(row.prefix, row.nextNum + i, padWidth));
  }
  const newNextNum = row.nextNum + count;
  const newLastNum = row.nextNum + count - 1;
  const newRow = {
    ...row,
    nextNum: newNextNum,
    nextId: _formatId(row.prefix, newNextNum, padWidth),
    lastNum: newLastNum,
    lastAssigned: _formatId(row.prefix, newLastNum, padWidth),
  };
  return { ids, newRow };
}

function _rewriteRow(text, oldRow, newRow) {
  // Determine column widths from oldRow's lineText. The line is
  //   `| <seq>  | <nextId>  | <lastAssigned>  |`
  // Each cell pads on the right with spaces.
  const cells = oldRow.lineText.split('|').slice(1, -1); // drop leading/trailing ''
  const seqWidth = cells[0].length - 2; // -2 for the spaces immediately after / before pipe
  const nextWidth = cells[1].length - 2;
  const lastWidth = cells[2].length - 2;
  const fmt = (val, width) => ` ${val.padEnd(width, ' ')} `;
  const newLine =
    '|' +
    fmt(newRow.sequence, seqWidth) +
    '|' +
    fmt(newRow.nextId, nextWidth) +
    '|' +
    fmt(newRow.lastAssigned, lastWidth) +
    '|';
  // Sanity: lengths match for IDs that fit the existing pad-width; if a
  // bumped ID is WIDER than the column (e.g. AC-1023 → AC-9999 → AC-10000)
  // the new line is intentionally wider and the table loses alignment.
  // Accept that — alignment matters for readability, not parsing.
  return text.replace(oldRow.lineText, newLine);
}

class IdAllocator {
  constructor({ root }) {
    this._registryPath = path.join(root, ID_REGISTRY_REL);
  }

  /**
   * Allocate `count` IDs for `sequence`. Returns:
   *   - count == 1 → single string ('US-0264')
   *   - count > 1  → array of strings (['US-0264', 'US-0265', ...])
   *
   * Concurrent allocations across processes are serialised by
   * proper-lockfile on docs/ID_REGISTRY.md.
   */
  async allocate(sequence, count = 1) {
    if (!Number.isInteger(count) || count <= 0) {
      throw new Error(`IdAllocator.allocate: count must be positive integer, got ${count}`);
    }
    let returned;
    await withFileLock(this._registryPath, async () => {
      const text = fs.readFileSync(this._registryPath, 'utf8');
      const row = _parseRow(text, sequence);
      if (!row) throw new Error(`IdAllocator.allocate: sequence "${sequence}" not found in ${this._registryPath}`);
      const { ids, newRow } = _bumpRow(row, count);
      const next = _rewriteRow(text, row, newRow);
      const tmp = this._registryPath + '.tmp';
      fs.writeFileSync(tmp, next);
      fs.renameSync(tmp, this._registryPath);
      returned = count === 1 ? ids[0] : ids;
    });
    return returned;
  }
}

module.exports = { IdAllocator, _parseRow, _bumpRow, _rewriteRow, _prefixFor, _formatId };
```

- [ ] **Step 4: Run helpers tests, expect green**

```bash
npx jest tests/unit/repository/id-allocator.test.js 2>&1 | tail -6
```

Expected: all helper-level tests pass.

- [ ] **Step 5: Commit**

```bash
git add tools/lib/repository/id-allocator.js tests/unit/repository/id-allocator.test.js
git commit -m "[feat] US-0241 | E.2: IdAllocator + pure-string row helpers

_parseRow / _bumpRow / _rewriteRow are the pure-string core of the
allocator. They operate on the pipe-table format of ID_REGISTRY.md
without parsing the surrounding markdown — only the matched row line
is touched on rewrite.

The IdAllocator class wraps these helpers with withFileLock + atomic
tmp+rename for cross-process concurrency safety (AC-0943, AC-0944).
count=1 returns a string; count>1 returns an array (AC-0945).

The PREFIX_OVERRIDES map handles 'Lesson' → 'L' (the only sequence
where the label and the prefix differ).

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>"
```

---

## Task 2: Wire IdAllocator into Repository + happy-path integration test

**Files:**

- Modify: `tools/lib/repository/index.js`
- Create: `tests/integration/repository/id-allocator-concurrent.test.js`

- [ ] **Step 1: Write the failing integration test**

Create `tests/integration/repository/id-allocator-concurrent.test.js`:

```js
'use strict';

const fs = require('fs');
const os = require('os');
const path = require('path');
const { Repository } = require('../../../tools/lib/repository');

const SAMPLE_REGISTRY = [
  '# ID Registry',
  '',
  'intro',
  '',
  '| **Sequence** | **Next Available ID** | **Last Assigned** |',
  '| ------------ | --------------------- | ----------------- |',
  '| EPIC         | EPIC-0046             | EPIC-0045         |',
  '| US           | US-0264               | US-0263           |',
  '| BUG          | BUG-0264              | BUG-0263          |',
  '| Lesson       | L-0086                | L-0085            |',
  '',
].join('\n');

function mkRoot() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'us0241-alloc-'));
  fs.mkdirSync(path.join(root, 'docs'), { recursive: true });
  fs.writeFileSync(path.join(root, 'package.json'), JSON.stringify({ name: 't', version: '1.0.0' }));
  fs.writeFileSync(path.join(root, 'docs', 'ID_REGISTRY.md'), SAMPLE_REGISTRY);
  return root;
}

describe('US-0241 / AC-0943..0945: repo.idRegistry.allocate', () => {
  let root;
  afterEach(() => {
    Repository._reset();
    if (root) fs.rmSync(root, { recursive: true, force: true });
  });

  it('single allocate returns a string + bumps the row on disk', async () => {
    root = mkRoot();
    Repository._reset();
    const repo = Repository.getInstance({ root });
    const id = await repo.idRegistry.allocate('US');
    expect(typeof id).toBe('string');
    expect(id).toBe('US-0264');
    const after = fs.readFileSync(path.join(root, 'docs', 'ID_REGISTRY.md'), 'utf8');
    expect(after).toContain('| US           | US-0265               | US-0264           |');
  });

  it('count=3 returns array of contiguous IDs', async () => {
    root = mkRoot();
    Repository._reset();
    const repo = Repository.getInstance({ root });
    const ids = await repo.idRegistry.allocate('US', 3);
    expect(ids).toEqual(['US-0264', 'US-0265', 'US-0266']);
    const after = fs.readFileSync(path.join(root, 'docs', 'ID_REGISTRY.md'), 'utf8');
    expect(after).toContain('| US           | US-0267               | US-0266           |');
  });

  it('Lesson allocate uses L- prefix despite "Lesson" sequence label', async () => {
    root = mkRoot();
    Repository._reset();
    const repo = Repository.getInstance({ root });
    const id = await repo.idRegistry.allocate('Lesson');
    expect(id).toBe('L-0086');
  });

  it('AC-0943: concurrent allocations on the same sequence return non-overlapping IDs', async () => {
    root = mkRoot();
    Repository._reset();
    const repo = Repository.getInstance({ root });
    const [a, b, c] = await Promise.all([
      repo.idRegistry.allocate('US'),
      repo.idRegistry.allocate('US'),
      repo.idRegistry.allocate('US'),
    ]);
    // Whichever order they resolve in, the three returned IDs must be the
    // three consecutive numbers starting at the original nextNum.
    expect(new Set([a, b, c])).toEqual(new Set(['US-0264', 'US-0265', 'US-0266']));
    const after = fs.readFileSync(path.join(root, 'docs', 'ID_REGISTRY.md'), 'utf8');
    expect(after).toContain('| US           | US-0267               | US-0266           |');
  });

  it('throws when the sequence is missing from the registry', async () => {
    root = mkRoot();
    Repository._reset();
    const repo = Repository.getInstance({ root });
    await expect(repo.idRegistry.allocate('NOPE')).rejects.toThrow(/NOPE.*not found/);
  });
});
```

- [ ] **Step 2: Run, expect failure**

```bash
npx jest tests/integration/repository/id-allocator-concurrent.test.js 2>&1 | tail -6
```

Expected: `repo.idRegistry is undefined`.

- [ ] **Step 3: Wire into Repository**

Edit `tools/lib/repository/index.js`. At the top:

```js
const { IdAllocator } = require('./id-allocator');
```

In the constructor, AFTER the entity repos and BEFORE `Repository._instance = this;`:

```js
this.idRegistry = new IdAllocator({ root });
```

- [ ] **Step 4: Run, expect green**

```bash
npx jest tests/integration/repository/id-allocator-concurrent.test.js 2>&1 | tail -6
```

Expected: 5 passed. The concurrent test is the load-bearing one — it proves `withFileLock` serialises the three concurrent calls so no two ever observe the same `nextId`.

If the concurrent test is flaky, the failure mode will be "two of the three IDs are equal" — meaning the lock didn't actually serialise. Check that `proper-lockfile` is configured with `realpath: false` (it is, in `file-lock.js`) and that the tmpdir's filesystem supports the lockfile sentinel. If running under macOS APFS, this works; under tmpfs without `o_excl` semantics it may not. Fall back to a longer retry config if needed:

```js
// Inside IdAllocator.allocate, replace withFileLock call with explicit opts:
await withFileLock(
  this._registryPath,
  async () => {
    /* ... */
  },
  { retries: { retries: 200, minTimeout: 5, maxTimeout: 100 } },
);
```

- [ ] **Step 5: Commit**

```bash
git add tools/lib/repository/index.js tests/integration/repository/id-allocator-concurrent.test.js
git commit -m "[feat] US-0241 | E.2: wire IdAllocator into Repository + concurrency test

repo.idRegistry.allocate is now available. The concurrency test fires
three Promise.all allocations and asserts the returned set is exactly
the three consecutive IDs starting at nextNum — proves withFileLock
serialises across the in-process callers.

Cross-process concurrency relies on proper-lockfile's sentinel file
+ atime-based stale detection (30s timeout) inherited from
file-lock.js#withFileLock — verified by existing tests at
tests/unit/repository/file-lock.test.js, no additional cross-process
test added here (L-0083 covers the mutual-exclusion contract).

Closes AC-0943, AC-0944, AC-0945.

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>"
```

---

## Task 3: Lint + coverage + finishing-a-development-branch

- [ ] **Step 1: Coverage**

```bash
npx jest --coverage --runInBand tests/unit/repository/id-allocator.test.js tests/integration/repository/id-allocator-concurrent.test.js 2>&1 | grep -A 3 "id-allocator"
```

Expected: `id-allocator.js` ≥90% statements per spec §6.7.

- [ ] **Step 2: Full suite + lint + format**

```bash
npx jest --runInBand --silent 2>&1 | tail -4
npm run lint 2>&1 | tail -3
npm run format:check 2>&1 | tail -3
```

Expected: all green.

- [ ] **Step 3: Hand off to finishing-a-development-branch**

Announce: "I'm using the finishing-a-development-branch skill to complete this work."

Expected PR title: `feat: US-0241 — id-allocator with file-locked ID_REGISTRY mutation`.

---

## Self-Review

### Spec coverage

| Spec item                                      | Task                   |
| ---------------------------------------------- | ---------------------- |
| §4.1 allocate(sequence, count) bypasses SQL    | Task 1, 2              |
| §4.1 reads under withFileLock                  | Task 1 impl            |
| §4.1 count=1 string, count>1 array             | Task 1 + 2             |
| §4.1 column alignment preserved                | Task 1                 |
| AC-0943 concurrent allocations non-overlapping | Task 2 Step 1 case 4   |
| AC-0944 last_assigned set to highest allocated | Task 1 \_bumpRow tests |
| AC-0945 count=1 string, count>1 array          | Task 1 + 2             |

### Placeholder scan

No "TBD", "TODO", "handle edge cases" tokens. Concrete fallback for proper-lockfile flakiness on non-APFS filesystems is given inline in Task 2 Step 4.

### Type consistency

- `allocate(sequence, count = 1) → Promise<string | string[]>` — return type is conditional on count, documented in JSDoc + asserted in tests.
- `_parseRow → { sequence, prefix, nextId, nextNum, lastAssigned, lastNum, lineText } | null` — every consumer destructures the same field set.
- `_bumpRow → { ids: string[], newRow }` — both consumers use both fields.

### Known follow-ups (out of scope, flagged for US-0242)

- In-transaction allocation (`tx.idRegistry.allocate`) defers the registry mutation until commit. US-0242 wraps `IdAllocator` with a tx-aware proxy that holds the lock across the entire transaction. The current API exposes the direct path; no changes needed here.
