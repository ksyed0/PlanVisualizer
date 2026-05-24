# US-0240 Implementation Plan — Writer APIs + 7 Serializers + Anchored-Block `.update()`

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship the writer-side foundation for EPIC-0040 — 7 per-entity serializers (story, epic, ac, bug, lesson, test_case, task), a shared `_fence-utils.js`, a `ValidationError` class, and `.update(id, fn)` / `.create(entity)` methods on each entity repo backed by the **anchored-block replacement** mechanic (regex-anchor on the entity-ID line → slice → parse → mutate → serialize → splice back; surrounding prose byte-identical).

**Architecture:** Each serializer is the inverse of its existing parser (`tools/lib/parse-{release-plan,bugs,lessons,test-cases}.js` for the markdown side; for entities-with-no-parse-module-yet — epic, ac, task — the indexers carry the parsing logic and the serializer mirrors that). All 7 serializers share `_fence-utils.js` for fence-delimiter handling, ID-line emission, and value-escape rules. `.update(id, fn)` acquires `withFileLock(SOURCE_FILE)`, reads the full file, locates the fenced block via a regex anchored on the entity-ID line, slices it out, parses just that block, applies `fn(entity)`, validates via the serializer, serializes back to a block string, splices it into the file at the original character range, writes the file back, releases the lock, and mirrors the mutated entity to SQL via the existing indexer path. `.create(entity)` appends a new fenced block to the appropriate section of the source file (per-entity rules for "appropriate section").

**Tech Stack:** Node ≥20, Jest, `better-sqlite3`, `proper-lockfile` (via `tools/lib/repository/file-lock.js`). No new runtime dependencies.

---

## File Structure

| File                                                             | Action | Responsibility                                                                                                                                                                                                                                                                                                                                                                     |
| ---------------------------------------------------------------- | ------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `tools/lib/repository/errors.js`                                 | Create | `ValidationError`, `SerializerStabilityError` classes. Both extend `Error` with `.code` + `.details`.                                                                                                                                                                                                                                                                              |
| `tools/lib/repository/serializers/_fence-utils.js`               | Create | Shared helpers: `findBlockRange(text, idRe)`, `padValue(s)`, `joinLines(lines)`, fence-aware whitespace rules.                                                                                                                                                                                                                                                                     |
| `tools/lib/repository/serializers/story-serializer.js`           | Create | Inverse of `parse-release-plan.js#parseStory`. Emits the `US-XXXX (EPIC-YYYY): ...` block.                                                                                                                                                                                                                                                                                         |
| `tools/lib/repository/serializers/epic-serializer.js`            | Create | Inverse of `parse-release-plan.js#parseEpicBlock`. Emits the `EPIC-XXXX: Title` block.                                                                                                                                                                                                                                                                                             |
| `tools/lib/repository/serializers/ac-serializer.js`              | Create | Emits a single `  - [ ] AC-XXXX: text` line (no fence — ACs nest inside a story's `Acceptance Criteria:` list).                                                                                                                                                                                                                                                                    |
| `tools/lib/repository/serializers/bug-serializer.js`             | Create | Inverse of `parse-bugs.js`. Emits the `BUG-XXXX: Title` block with `Severity:`, `Related Story:`, etc.                                                                                                                                                                                                                                                                             |
| `tools/lib/repository/serializers/lesson-serializer.js`          | Create | Inverse of `parse-lessons.js`. Emits the `## L-XXXX — Title` block with `**Rule:**`, `**Date:**`, `**Bugs:**`.                                                                                                                                                                                                                                                                     |
| `tools/lib/repository/serializers/test-case-serializer.js`       | Create | Inverse of `parse-test-cases.js`. Emits the `TC-XXXX: Title` block.                                                                                                                                                                                                                                                                                                                |
| `tools/lib/repository/serializers/task-serializer.js`            | Create | Inverse of the task-line format used in `RELEASE_PLAN.md` plan-task sections (`Plan Task: E.N`). Emits the `TASK-XXXX: ...` line.                                                                                                                                                                                                                                                  |
| `tools/lib/repository/markdown-mutator.js`                       | Create | `replaceBlock({path, idRegex, mutator})` — the anchored-block-replacement core used by every `.update(id, fn)`. Pure-string variant `replaceBlockInText(text, idRegex, mutator)` is the unit-testable inner. Unfenced sibling: `replaceUnfencedRange(text, startRe, nextRe, mutator)` (positional — there is no fs wrapper; entity repos call it inside their own `withFileLock`). |
| `tools/lib/repository/entities/story-repo.js`                    | Modify | Add `async update(id, fn)` + `async create(entity)`. Both run under `withFileLock(RELEASE_PLAN.md)` + re-index via existing indexer.                                                                                                                                                                                                                                               |
| `tools/lib/repository/entities/epic-repo.js`                     | Modify | Same `.update` / `.create` pattern as StoryRepo.                                                                                                                                                                                                                                                                                                                                   |
| `tools/lib/repository/entities/ac-repo.js`                       | Modify | `.update(id, fn)` only — ACs are created by mutating their parent story's AC list, not standalone (see Task 8 note).                                                                                                                                                                                                                                                               |
| `tools/lib/repository/entities/bug-repo.js`                      | Create | New entity repo over `bugs` table + BUGS.md source file.                                                                                                                                                                                                                                                                                                                           |
| `tools/lib/repository/entities/lesson-repo.js`                   | Create | New entity repo over `lessons` table + LESSONS.md.                                                                                                                                                                                                                                                                                                                                 |
| `tools/lib/repository/entities/test-case-repo.js`                | Create | New entity repo over `test_cases` table + TEST_CASES.md.                                                                                                                                                                                                                                                                                                                           |
| `tools/lib/repository/entities/task-repo.js`                     | Create | New entity repo over `tasks` table + RELEASE_PLAN.md plan-task sections.                                                                                                                                                                                                                                                                                                           |
| `tools/lib/repository/index.js`                                  | Modify | Wire the 4 new entity repos into `Repository`'s constructor (`this.bugs`, `this.lessons`, `this.testCases`, `this.tasks`).                                                                                                                                                                                                                                                         |
| `tests/unit/repository/errors.test.js`                           | Create | ValidationError shape + JSON serialisability.                                                                                                                                                                                                                                                                                                                                      |
| `tests/unit/repository/serializers/_fence-utils.test.js`         | Create | findBlockRange, padValue, joinLines unit coverage.                                                                                                                                                                                                                                                                                                                                 |
| `tests/unit/repository/serializers/story-serializer.test.js`     | Create | Round-trip (parse→serialize→parse equal) + byte-stability (serialize→parse→serialize === input) for 6 story fixtures.                                                                                                                                                                                                                                                              |
| `tests/unit/repository/serializers/epic-serializer.test.js`      | Create | Same for 3 epic fixtures.                                                                                                                                                                                                                                                                                                                                                          |
| `tests/unit/repository/serializers/ac-serializer.test.js`        | Create | Same for [ ]/[x] checked/unchecked + AC-TBD variants.                                                                                                                                                                                                                                                                                                                              |
| `tests/unit/repository/serializers/bug-serializer.test.js`       | Create | Same for 4 bug fixtures including the `### BUG-` heading-prefix form.                                                                                                                                                                                                                                                                                                              |
| `tests/unit/repository/serializers/lesson-serializer.test.js`    | Create | Same for both `—` and `:` separator forms.                                                                                                                                                                                                                                                                                                                                         |
| `tests/unit/repository/serializers/test-case-serializer.test.js` | Create | Same for Pass/Fail/Not Run status variants.                                                                                                                                                                                                                                                                                                                                        |
| `tests/unit/repository/serializers/task-serializer.test.js`      | Create | Same for TASK rows.                                                                                                                                                                                                                                                                                                                                                                |
| `tests/unit/repository/markdown-mutator.test.js`                 | Create | replaceBlock pure-string unit tests (no fs).                                                                                                                                                                                                                                                                                                                                       |
| `tests/integration/repository/story-update.test.js`              | Create | AC-0938 + AC-0942: full-flow story update with byte-identical surrounding prose regression.                                                                                                                                                                                                                                                                                        |
| `tests/integration/repository/entity-write-matrix.test.js`       | Create | AC-0939: one update + one create per entity type, with assertion that SQL index reflects the change.                                                                                                                                                                                                                                                                               |

---

## Pre-Work

Branch base: **`origin/develop`**. The EPIC-0040 spec (PR #1118) and the 8-plan bundle (PR #1119) are docs-only. **Order requirement:** merge #1118 + #1119 BEFORE branching for US-0240, otherwise the spec + plan files this story references won't be on `develop`. Reverify with `ls docs/superpowers/specs/2026-05-24-epic-0040-planning-writers-design.md docs/superpowers/plans/2026-05-24-us-024*.md` before Pre-Step 1.

- [ ] **Pre-Step 1: Create the feature branch**

```bash
cd /Users/Kamal_Syed/Projects/PlanVisualizer/.claude/worktrees/phase-e-impl
git fetch origin develop --quiet
git checkout -b feature/US-0240-writer-apis-serializers origin/develop
```

Expected: `Switched to a new branch 'feature/US-0240-writer-apis-serializers'`.

- [ ] **Pre-Step 2: Commit this plan file**

```bash
git add docs/superpowers/plans/2026-05-24-us-0240-writer-apis-and-serializers.md
git commit -m "docs: US-0240 implementation plan

EPIC-0040 foundation story. Per-entity serializers + anchored-block
.update()/.create() on every entity repo. Spec reference:
docs/superpowers/specs/2026-05-24-epic-0040-planning-writers-design.md
§3.2, §3.3, §4.

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>"
```

- [ ] **Pre-Step 3: Verify schema + indexers (pre-flighted 2026-05-24 — included for re-verification)**

```bash
grep -E "CREATE TABLE IF NOT EXISTS (bugs|lessons|test_cases|planning_tasks)" tools/lib/repository/migrations/001_initial_schema.sql
ls tools/lib/repository/indexers/
```

**Pre-flight findings (must still hold at execution time — STOP if not):**

- Table names: `bugs`, `lessons`, `test_cases`, `planning_tasks` (NOT `tasks`).
- All 4 indexers exist: `bugs-indexer.js`, `lessons-indexer.js`, `test-cases-indexer.js`, `release-plan-indexer.js` (the last covers stories + epics + planning_tasks; the planning-task `TASK-XXXX` lines live inside story blocks).
- **Schema is a THIN index** — the SQL tables hold only a subset of the entity fields the parsers extract. Verbatim column lists (from `001_initial_schema.sql`):
  - `bugs (id, status, severity, source_file, source_line)` — NO title/related_story/fix_branch/lesson_encoded/gh_issue_number/estimated_cost_usd. Status post-`004_bugs_status_widen.sql`: `{Open, In Progress, Fixed, Verified, WontFix, Closed}`.
  - `lessons (id, text, source_file, source_line)` — NO title/rule/date/bug_ids broken out.
  - `test_cases (id, story_id, title, status)` — NO type/related_task/related_ac/defect.
  - `planning_tasks (id, story_id, status)` — NO title.
  - `stories`/`epics` status post-`003_widen_status_check.sql`: `{To Do, Planned, In Progress, Blocked, Done, Retired}`.

**Consequence — markdown is the source of truth, SQL is a search index.** Tasks 7, 8, 9 implement entity repos that:

1. Mutate the FULL entity in markdown via the serializer.
2. Re-call the existing indexer (`indexBugs` / `indexLessons` / `indexTestCases` / `indexReleasePlan`) to refresh the THIN SQL columns from the just-written markdown.

The plan does NOT invent a custom `_upsertRow` per entity that tries to persist fields the schema doesn't have. The `_upsertRow` sketch shown for StoryRepo (Task 7 Step 3) is correct because `stories` is fully columnar; for bugs/lessons/test_cases/planning_tasks, use `_reindex()` (which calls the indexer) instead. US-0242's `_upsertRow` shows the StoryRepo pattern only — for other entities the tx commit re-runs the indexer at flush time, not a per-entity upsert.

If schema names/columns or indexer file list have drifted since 2026-05-24, STOP and update the plan before proceeding.

---

## Task 1: ValidationError + SerializerStabilityError classes

**Files:**

- Create: `tools/lib/repository/errors.js`
- Create: `tests/unit/repository/errors.test.js`

- [ ] **Step 1: Write the failing test**

Create `tests/unit/repository/errors.test.js` with this exact content:

```js
'use strict';

const { ValidationError, SerializerStabilityError } = require('../../../tools/lib/repository/errors');

describe('ValidationError', () => {
  it('extends Error, carries code + details, is throwable', () => {
    const e = new ValidationError('bad status', {
      code: 'INVALID_STATUS',
      details: { got: 'Maybe', expected: ['To Do', 'In Progress', 'Done'] },
    });
    expect(e).toBeInstanceOf(Error);
    expect(e).toBeInstanceOf(ValidationError);
    expect(e.code).toBe('INVALID_STATUS');
    expect(e.details).toEqual({ got: 'Maybe', expected: ['To Do', 'In Progress', 'Done'] });
    expect(e.message).toBe('bad status');
  });

  it('defaults code to "VALIDATION" and details to {} when omitted', () => {
    const e = new ValidationError('plain');
    expect(e.code).toBe('VALIDATION');
    expect(e.details).toEqual({});
  });

  it('serialises to JSON with name + message + code + details', () => {
    const e = new ValidationError('bad', { code: 'X', details: { y: 1 } });
    expect(JSON.parse(JSON.stringify(e))).toEqual({
      name: 'ValidationError',
      message: 'bad',
      code: 'X',
      details: { y: 1 },
    });
  });
});

describe('SerializerStabilityError', () => {
  it('extends Error, exposes pass1 / pass2 / diffPath for the migration harness', () => {
    const e = new SerializerStabilityError('pass1 !== pass2', {
      pass1: 'a',
      pass2: 'b',
      diffPath: '/tmp/docs-pre-norm/_pass1-vs-pass2-X.diff',
    });
    expect(e).toBeInstanceOf(SerializerStabilityError);
    expect(e.pass1).toBe('a');
    expect(e.pass2).toBe('b');
    expect(e.diffPath).toBe('/tmp/docs-pre-norm/_pass1-vs-pass2-X.diff');
  });
});
```

- [ ] **Step 2: Run, expect failure**

```bash
npx jest tests/unit/repository/errors.test.js 2>&1 | tail -6
```

Expected: `Cannot find module .../errors` (red).

- [ ] **Step 3: Implement**

Create `tools/lib/repository/errors.js`:

```js
'use strict';

class ValidationError extends Error {
  constructor(message, { code = 'VALIDATION', details = {} } = {}) {
    super(message);
    this.name = 'ValidationError';
    this.code = code;
    this.details = details;
  }
  toJSON() {
    return { name: this.name, message: this.message, code: this.code, details: this.details };
  }
}

class SerializerStabilityError extends Error {
  constructor(message, { pass1 = '', pass2 = '', diffPath = '' } = {}) {
    super(message);
    this.name = 'SerializerStabilityError';
    this.pass1 = pass1;
    this.pass2 = pass2;
    this.diffPath = diffPath;
  }
}

module.exports = { ValidationError, SerializerStabilityError };
```

- [ ] **Step 4: Run, expect green**

```bash
npx jest tests/unit/repository/errors.test.js 2>&1 | tail -4
```

Expected: 4 passed.

- [ ] **Step 5: Commit**

```bash
git add tools/lib/repository/errors.js tests/unit/repository/errors.test.js
git commit -m "[feat] US-0240 | E.1: ValidationError + SerializerStabilityError classes

Foundational error classes for EPIC-0040 writers. ValidationError is
thrown by serializers when status/enum/duplicate-ID checks fail (per
spec §3.2 + AC-0941). SerializerStabilityError surfaces from Migration
001 (US-0243) when pass1 !== pass2 round-trip output.

Both serialise to JSON for the warnings-channel + dashboard banners
that the Phase F lock-down (EPIC-0041) will surface.

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>"
```

---

## Task 2: `_fence-utils.js` — shared serializer helpers

**Files:**

- Create: `tools/lib/repository/serializers/_fence-utils.js`
- Create: `tests/unit/repository/serializers/_fence-utils.test.js`

- [ ] **Step 1: Write the failing test**

Create `tests/unit/repository/serializers/_fence-utils.test.js`:

````js
'use strict';

const { findBlockRange, joinLines } = require('../../../../tools/lib/repository/serializers/_fence-utils');

describe('findBlockRange', () => {
  // The input is a markdown document where each top-level entity lives inside
  // a fenced code block (``` ... ```). The function returns the half-open
  // [start, end) character range of the FULL block (including the opening
  // and closing fence lines) for the entity whose body matches idRe on its
  // first non-empty line.
  const SAMPLE = [
    '# Header',
    '',
    '```',
    'US-0001 (EPIC-0010): Title A',
    'Status: Done',
    '```',
    '',
    'prose between blocks',
    '',
    '```',
    'US-0002 (EPIC-0010): Title B',
    'Status: To Do',
    '```',
    '',
  ].join('\n');

  it('locates the first block whose body starts with US-0001', () => {
    const r = findBlockRange(SAMPLE, /^US-0001\b/);
    expect(r).not.toBeNull();
    expect(SAMPLE.slice(r.start, r.end)).toContain('US-0001 (EPIC-0010): Title A');
    expect(SAMPLE.slice(r.start, r.end)).toContain('Status: Done');
    expect(SAMPLE.slice(r.start, r.end)).not.toContain('US-0002');
    // The range must start at the opening ``` and end at the line after the
    // closing ``` (i.e. include the trailing newline of the closing fence).
    expect(SAMPLE.slice(r.start, r.start + 3)).toBe('```');
  });

  it('locates the second block (US-0002) — anchor regex picks correct block', () => {
    const r = findBlockRange(SAMPLE, /^US-0002\b/);
    expect(SAMPLE.slice(r.start, r.end)).toContain('US-0002 (EPIC-0010): Title B');
    expect(SAMPLE.slice(r.start, r.end)).not.toContain('US-0001');
  });

  it('returns null when no matching block is found', () => {
    expect(findBlockRange(SAMPLE, /^US-9999\b/)).toBeNull();
  });

  it('ignores fenced blocks whose body does not match (different ID-line, different prefix)', () => {
    const doc = '```\nrandom text\n```\n```\nUS-0001: real\n```\n';
    const r = findBlockRange(doc, /^US-0001\b/);
    expect(doc.slice(r.start, r.end)).toContain('US-0001: real');
  });
});

describe('joinLines', () => {
  it('joins with \\n + trailing newline (matches existing file convention)', () => {
    expect(joinLines(['a', 'b', 'c'])).toBe('a\nb\nc\n');
  });
  it('handles empty array → empty string', () => {
    expect(joinLines([])).toBe('');
  });
});
````

- [ ] **Step 2: Run, expect failure**

```bash
npx jest tests/unit/repository/serializers/_fence-utils.test.js 2>&1 | tail -4
```

Expected: module-not-found red.

- [ ] **Step 3: Implement**

Create `tools/lib/repository/serializers/_fence-utils.js`:

````js
'use strict';

/**
 * Find the half-open [start, end) character range of the fenced code block
 * (``` ... ```) in `text` whose body's first non-empty line matches `idRe`.
 * Returns null if no matching block exists.
 *
 * The returned range includes the opening fence line, the body, the closing
 * fence line, and the trailing newline of the closing fence (so splicing
 * a replacement of the same shape preserves the surrounding blank-line
 * structure byte-for-byte).
 */
function findBlockRange(text, idRe) {
  const FENCE = /^```\s*$/;
  const lines = text.split('\n');
  let cursor = 0; // running character offset to start of current line
  const lineStarts = new Array(lines.length);
  for (let i = 0; i < lines.length; i++) {
    lineStarts[i] = cursor;
    cursor += lines[i].length + 1; // +1 for the \n we split on
  }

  for (let i = 0; i < lines.length; i++) {
    if (!FENCE.test(lines[i])) continue;
    // Find the matching closing fence.
    let j = i + 1;
    while (j < lines.length && !FENCE.test(lines[j])) j++;
    if (j >= lines.length) return null; // unterminated fence, skip
    // Scan body for first non-empty line and check the regex.
    for (let b = i + 1; b < j; b++) {
      const trimmed = lines[b].trim();
      if (!trimmed) continue;
      if (idRe.test(trimmed)) {
        const start = lineStarts[i];
        // end = start of line AFTER the closing fence (j+1 if it exists,
        // otherwise end-of-text).
        const end = j + 1 < lines.length ? lineStarts[j + 1] : text.length;
        return { start, end, openFenceLine: i, closeFenceLine: j };
      }
      break; // first non-empty line didn't match — skip this block
    }
    i = j; // advance past this block's closing fence
  }
  return null;
}

function joinLines(lines) {
  if (lines.length === 0) return '';
  return lines.join('\n') + '\n';
}

module.exports = { findBlockRange, joinLines };
````

- [ ] **Step 4: Run, expect green**

```bash
npx jest tests/unit/repository/serializers/_fence-utils.test.js 2>&1 | tail -4
```

Expected: 6 passed.

- [ ] **Step 5: Commit**

```bash
git add tools/lib/repository/serializers/_fence-utils.js tests/unit/repository/serializers/_fence-utils.test.js
git commit -m "[feat] US-0240 | E.1: shared serializer fence-utils

findBlockRange + joinLines underpin the anchored-block-replacement
mechanic (spec §3.3). Every entity serializer relies on these two
helpers; they get their own coverage so per-entity tests don't repeat
the same edge cases.

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>"
```

---

## Task 3: story-serializer + round-trip + byte-stability tests

**Files:**

- Create: `tools/lib/repository/serializers/story-serializer.js`
- Create: `tests/unit/repository/serializers/story-serializer.test.js`
- Create: `tests/fixtures/serializers/stories/*.md` (6 fixtures — see Step 1)

- [ ] **Step 1: Capture fixtures**

Pull 6 representative story blocks from the live `docs/RELEASE_PLAN.md` into `tests/fixtures/serializers/stories/`:

```bash
mkdir -p tests/fixtures/serializers/stories
```

Use these representative selections (pull the exact fenced block including the opening/closing ```):

- `story-minimal.md` — `US-0241` (id + title + Priority + Estimate + Status + Plan Task + 3 ACs; no Branch/PR/Dependencies)
- `story-with-deps.md` — `US-0242` (has Dependencies: list)
- `story-with-related-bug.md` — `US-0241` (has `Related Bug:` field; pull a different real story that uses it)
- `story-completed.md` — `US-0259` (Status: Done, Branch:, PR: #1102, all ACs `[x]`)
- `story-multiline-ac-text.md` — `US-0259` AC-1015 (the long text wraps in source files)
- `story-with-doneDate.md` — find any story with `DoneDate:` field via `grep -B1 -A20 "^DoneDate:" docs/RELEASE_PLAN.md | head -25` and capture its block.

Each fixture is the **complete fenced block** (opening `through closing`), exactly as it appears in `RELEASE_PLAN.md`. The byte-stability assertion is per-block, not per-file.

- [ ] **Step 2: Write the failing test**

Create `tests/unit/repository/serializers/story-serializer.test.js`:

````js
'use strict';

const fs = require('fs');
const path = require('path');

const { serialize } = require('../../../../tools/lib/repository/serializers/story-serializer');
const { parseStories } = require('../../../../tools/lib/parse-release-plan'); // existing parser

const FIXTURE_DIR = path.join(__dirname, '..', '..', '..', 'fixtures', 'serializers', 'stories');

function loadFixture(name) {
  return fs.readFileSync(path.join(FIXTURE_DIR, name), 'utf8');
}

const FIXTURES = [
  'story-minimal.md',
  'story-with-deps.md',
  'story-with-related-bug.md',
  'story-completed.md',
  'story-multiline-ac-text.md',
  'story-with-doneDate.md',
];

describe('story-serializer', () => {
  describe.each(FIXTURES)('%s', (name) => {
    const input = loadFixture(name);
    // parseStories expects a full markdown document; our fixtures are the
    // raw fenced-block body. Wrap each fixture in a minimal doc so parse
    // returns exactly one story.
    const doc = '# Test\n\n' + input + '\n';
    const parsed = parseStories(doc);

    it('parses to exactly one story', () => {
      expect(parsed).toHaveLength(1);
    });

    it('round-trip: parse(serialize(parse(input))) deep-equals parse(input)', () => {
      const blockText = serialize(parsed[0]);
      const doc2 = '# Test\n\n```\n' + blockText + '```\n';
      const reparsed = parseStories(doc2);
      expect(reparsed).toEqual(parsed);
    });

    it('byte-stability: serialize(parse(input)) === inner-block-body of input', () => {
      // Strip the opening ``` line + closing ``` line + their newlines from
      // the input to get the body that serialize() emits.
      const innerBody = input.replace(/^```\s*\n/, '').replace(/```\s*\n?$/, '');
      expect(serialize(parsed[0])).toBe(innerBody);
    });
  });

  describe('validation', () => {
    it('throws ValidationError when status is not in the allowed enum', () => {
      const { ValidationError } = require('../../../../tools/lib/repository/errors');
      const bad = {
        id: 'US-9999',
        epicId: 'EPIC-0001',
        title: 'x',
        status: 'Maybe',
        priority: 'High (P1)',
        estimate: 'M',
        acs: [],
      };
      expect(() => serialize(bad)).toThrow(ValidationError);
    });

    it('throws ValidationError when id does not match US-\\d+', () => {
      const { ValidationError } = require('../../../../tools/lib/repository/errors');
      const bad = { id: 'WAT-0001', title: 'x', status: 'To Do', priority: 'High (P1)', estimate: 'M', acs: [] };
      expect(() => serialize(bad)).toThrow(ValidationError);
    });
  });
});
````

- [ ] **Step 3: Run, expect failure**

```bash
npx jest tests/unit/repository/serializers/story-serializer.test.js 2>&1 | tail -8
```

Expected: module-not-found red, then once Step 4 stub exists, the byte-stability assertions are the most likely first reds.

- [ ] **Step 4: Implement story-serializer**

Open `tools/lib/parse-release-plan.js` and identify EXACTLY which fields `parseStory` extracts (`id`, `epicId`, `title`, `priority`, `estimate`, `status`, `branch`, `prNumber`, `specPath`, `planPath`, `dependencies`, `relatedBug`, `planTask`, `acs`, `doneDate`, plus any others). The serializer must emit a block whose re-parse produces a deep-equal entity.

Create `tools/lib/repository/serializers/story-serializer.js`:

````js
'use strict';

const { ValidationError } = require('../errors');
const { joinLines } = require('./_fence-utils');

// Must match the SQLite CHECK constraint in migration 003_widen_status_check.sql:
//   CHECK (status IN ('To Do','Planned','In Progress','Blocked','Done','Retired'))
// Adding values here without a matching schema migration → _upsertRow throws
// SQLITE_CONSTRAINT_CHECK at runtime. Keep this set in lock-step with the schema.
const ALLOWED_STATUS = new Set(['To Do', 'Planned', 'In Progress', 'Blocked', 'Done', 'Retired']);
const ID_RE = /^US-\d+$/;

/**
 * Serialize a story entity to the fenced-block body string (NOT including
 * the opening/closing ``` fences — those are added by the markdown-mutator
 * when splicing back into RELEASE_PLAN.md).
 *
 * The body string ends with a single trailing newline so concatenation
 * inside ``` ... ``` preserves the existing file's blank-line convention.
 *
 * Throws ValidationError on:
 *   - id not matching /^US-\d+$/
 *   - status not in ALLOWED_STATUS
 *   - missing required field (id, title, status, priority, estimate)
 */
function serialize(story) {
  if (!story || typeof story !== 'object') {
    throw new ValidationError('story must be an object', { code: 'NOT_OBJECT' });
  }
  if (!ID_RE.test(story.id || '')) {
    throw new ValidationError(`invalid story id: ${story.id}`, { code: 'INVALID_ID', details: { id: story.id } });
  }
  if (!story.title) {
    throw new ValidationError('story.title is required', { code: 'MISSING_FIELD', details: { field: 'title' } });
  }
  if (!ALLOWED_STATUS.has(story.status)) {
    throw new ValidationError(`invalid story.status: ${story.status}`, {
      code: 'INVALID_STATUS',
      details: { got: story.status, expected: [...ALLOWED_STATUS] },
    });
  }
  if (!story.priority) {
    throw new ValidationError('story.priority is required', { code: 'MISSING_FIELD', details: { field: 'priority' } });
  }
  if (!story.estimate) {
    throw new ValidationError('story.estimate is required', { code: 'MISSING_FIELD', details: { field: 'estimate' } });
  }

  const lines = [];
  const epicSuffix = story.epicId ? ` (${story.epicId})` : '';
  lines.push(`${story.id}${epicSuffix}: ${story.title}`);
  lines.push(`Priority: ${story.priority}`);
  lines.push(`Estimate: ${story.estimate}`);
  lines.push(`Status: ${story.status}`);
  if (story.branch) lines.push(`Branch: ${story.branch}`);
  if (story.prNumber != null) lines.push(`PR: #${story.prNumber}`);
  if (story.specPath) lines.push(`Spec: ${story.specPath}`);
  if (story.planPath) lines.push(`Plan: ${story.planPath}`);
  if (story.planTask) lines.push(`Plan Task: ${story.planTask}`);
  if (story.relatedBug) lines.push(`Related Bug: ${story.relatedBug}`);
  if (story.doneDate) lines.push(`DoneDate: ${story.doneDate}`);
  if (Array.isArray(story.dependencies) && story.dependencies.length > 0) {
    lines.push(`Dependencies: ${story.dependencies.join(', ')}`);
  } else if (story.dependencies !== undefined) {
    lines.push('Dependencies: None');
  }
  if (Array.isArray(story.acs) && story.acs.length > 0) {
    lines.push('Acceptance Criteria:');
    lines.push('');
    for (const ac of story.acs) {
      const check = ac.checked ? 'x' : ' ';
      lines.push(`- [${check}] ${ac.id}: ${ac.text}`);
    }
  }
  return joinLines(lines);
}

module.exports = { serialize, ALLOWED_STATUS, ID_RE };
````

- [ ] **Step 5: Iterate to green**

```bash
npx jest tests/unit/repository/serializers/story-serializer.test.js 2>&1 | tail -10
```

If byte-stability fails for any fixture, the assertion message will print the EXACT diff between `serialize(parse(input))` and the fixture body. Adjust the serializer until every fixture passes. **Common adjustments:**

- Order of optional fields (`Branch:` before `PR:`, etc.) must match the fixture order. If the fixtures disagree among themselves, the serializer cannot satisfy byte-stability against ALL of them simultaneously — accept that Migration 001 (US-0243) will normalise to ONE canonical order, then declare which fixtures are "pre-norm" (byte-stability will fail; only round-trip needs to pass) vs "post-norm" (both pass).
- Mark pre-norm fixtures by skipping the byte-stability `it` for that fixture with a comment `// PRE-NORM: byte-stability is restored by Migration 001`.

Expected: all 6 round-trip tests pass; 4-6 byte-stability tests pass (the others are accepted as pre-norm with a comment).

- [ ] **Step 6: Commit**

```bash
git add tools/lib/repository/serializers/story-serializer.js tests/unit/repository/serializers/story-serializer.test.js tests/fixtures/serializers/stories/
git commit -m "[feat] US-0240 | E.1: story-serializer (inverse of parse-release-plan#parseStory)

Emits the canonical fenced-block body for a story entity. Round-trip
property holds against 6 production-pulled fixtures. Byte-stability
holds against post-normalised fixtures; pre-norm fixtures opt out
with a comment pointing at Migration 001 (US-0243).

ValidationError thrown on invalid id (must match /^US-\\d+\$/), invalid
status (not in ALLOWED_STATUS), or missing required field
(id, title, status, priority, estimate) — per AC-0941.

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>"
```

---

## Task 4: epic-serializer + ac-serializer (smaller, batched)

**Files:**

- Create: `tools/lib/repository/serializers/epic-serializer.js`
- Create: `tools/lib/repository/serializers/ac-serializer.js`
- Create: `tests/unit/repository/serializers/epic-serializer.test.js`
- Create: `tests/unit/repository/serializers/ac-serializer.test.js`
- Create: 3 epic fixtures + 4 ac variants under `tests/fixtures/serializers/`

- [ ] **Step 1: Capture epic fixtures**

```bash
mkdir -p tests/fixtures/serializers/epics tests/fixtures/serializers/acs
```

Pull 3 epic blocks from `RELEASE_PLAN.md` into `tests/fixtures/serializers/epics/`:

- `epic-minimal.md` — an epic with only id/title/Status/Release Target.
- `epic-with-deps.md` — an epic with `Dependencies:` list.
- `epic-with-dates.md` — an epic with `StartDate:` and `DoneDate:`.

For ACs, no separate fixture files — write inline strings in the test (ACs are single-line, 4 variants is overkill for files):

- unchecked: `- [ ] AC-0938: text here`
- checked: `- [x] AC-0938: text here`
- AC-TBD: `- [ ] AC-TBD: pending allocation`
- with extra indentation: `  - [x] AC-0939: indented text`

- [ ] **Step 2: Write the failing tests (both files)**

Create `tests/unit/repository/serializers/epic-serializer.test.js`:

````js
'use strict';

const fs = require('fs');
const path = require('path');
const { serialize } = require('../../../../tools/lib/repository/serializers/epic-serializer');
const { parseEpics } = require('../../../../tools/lib/parse-release-plan');
const { ValidationError } = require('../../../../tools/lib/repository/errors');

const DIR = path.join(__dirname, '..', '..', '..', 'fixtures', 'serializers', 'epics');
const FIXTURES = ['epic-minimal.md', 'epic-with-deps.md', 'epic-with-dates.md'];

describe('epic-serializer', () => {
  describe.each(FIXTURES)('%s', (name) => {
    const input = fs.readFileSync(path.join(DIR, name), 'utf8');
    const doc = '# Test\n\n' + input + '\n';
    const parsed = parseEpics(doc);

    it('parses to exactly one epic', () => expect(parsed).toHaveLength(1));

    it('round-trip', () => {
      const out = serialize(parsed[0]);
      const reparsed = parseEpics('# Test\n\n```\n' + out + '```\n');
      expect(reparsed).toEqual(parsed);
    });
  });

  it('throws ValidationError when id is not EPIC-XXXX', () => {
    expect(() => serialize({ id: 'WAT', title: 'x', status: 'To Do' })).toThrow(ValidationError);
  });
});
````

Create `tests/unit/repository/serializers/ac-serializer.test.js`:

```js
'use strict';

const { serialize } = require('../../../../tools/lib/repository/serializers/ac-serializer');
const { ValidationError } = require('../../../../tools/lib/repository/errors');

describe('ac-serializer', () => {
  it('emits unchecked AC with leading indent', () => {
    expect(serialize({ id: 'AC-0938', text: 'hello', checked: false })).toBe('- [ ] AC-0938: hello');
  });

  it('emits checked AC', () => {
    expect(serialize({ id: 'AC-0938', text: 'hello', checked: true })).toBe('- [x] AC-0938: hello');
  });

  it('accepts AC-TBD as a valid id (pending allocation pattern)', () => {
    expect(serialize({ id: 'AC-TBD', text: 'pending', checked: false })).toBe('- [ ] AC-TBD: pending');
  });

  it('throws ValidationError when id is not AC-\\d+ or AC-TBD', () => {
    expect(() => serialize({ id: 'BAD-1', text: 'x', checked: false })).toThrow(ValidationError);
  });

  it('throws ValidationError when text is empty', () => {
    expect(() => serialize({ id: 'AC-0938', text: '', checked: false })).toThrow(ValidationError);
  });
});
```

- [ ] **Step 3: Implement both serializers**

Create `tools/lib/repository/serializers/epic-serializer.js`:

```js
'use strict';

const { ValidationError } = require('../errors');
const { joinLines } = require('./_fence-utils');

const ID_RE = /^EPIC-\d+$/;
// Matches the epics CHECK constraint post-migration 003. See story-serializer
// for the lock-step rationale.
const ALLOWED_STATUS = new Set(['To Do', 'Planned', 'In Progress', 'Blocked', 'Done', 'Retired']);

function serialize(epic) {
  if (!epic || !ID_RE.test(epic.id || '')) {
    throw new ValidationError(`invalid epic id: ${epic && epic.id}`, { code: 'INVALID_ID' });
  }
  if (!ALLOWED_STATUS.has(epic.status)) {
    throw new ValidationError(`invalid epic.status: ${epic.status}`, { code: 'INVALID_STATUS' });
  }
  if (!epic.title) {
    throw new ValidationError('epic.title required', { code: 'MISSING_FIELD' });
  }
  const lines = [];
  lines.push(`${epic.id}: ${epic.title}`);
  if (epic.description) lines.push(`Description: ${epic.description}`);
  if (epic.releaseTarget) lines.push(`Release Target: ${epic.releaseTarget}`);
  lines.push(`Status: ${epic.status}`);
  if (epic.startDate) lines.push(`StartDate: ${epic.startDate}`);
  if (epic.doneDate) lines.push(`DoneDate: ${epic.doneDate}`);
  if (Array.isArray(epic.dependencies) && epic.dependencies.length > 0) {
    lines.push(`Dependencies: ${epic.dependencies.join(', ')}`);
  } else if (epic.dependencies !== undefined) {
    lines.push('Dependencies: None');
  }
  return joinLines(lines);
}

module.exports = { serialize, ID_RE, ALLOWED_STATUS };
```

Create `tools/lib/repository/serializers/ac-serializer.js`:

```js
'use strict';

const { ValidationError } = require('../errors');

const ID_RE = /^(AC-\d+|AC-TBD)$/;

/**
 * Serialize a single AC line. Returns the line WITHOUT a trailing newline.
 * The story-serializer adds these lines to its block body with joinLines.
 *
 * The leading-indent variation in production files (some have `  - [ ]`,
 * some have `- [ ]`) is normalised to NO leading indent by this serializer.
 * Migration 001 will collapse production divergence.
 */
function serialize(ac) {
  if (!ac || !ID_RE.test(ac.id || '')) {
    throw new ValidationError(`invalid ac id: ${ac && ac.id}`, { code: 'INVALID_ID' });
  }
  if (!ac.text) {
    throw new ValidationError('ac.text required', { code: 'MISSING_FIELD' });
  }
  const check = ac.checked ? 'x' : ' ';
  return `- [${check}] ${ac.id}: ${ac.text}`;
}

module.exports = { serialize, ID_RE };
```

- [ ] **Step 4: Run, expect green**

```bash
npx jest tests/unit/repository/serializers/epic-serializer.test.js tests/unit/repository/serializers/ac-serializer.test.js 2>&1 | tail -8
```

Expected: all pass. If any epic round-trip fails, inspect `parseEpicBlock` and align field order; same as Task 3 Step 5.

- [ ] **Step 5: Commit**

```bash
git add tools/lib/repository/serializers/epic-serializer.js tools/lib/repository/serializers/ac-serializer.js tests/unit/repository/serializers/epic-serializer.test.js tests/unit/repository/serializers/ac-serializer.test.js tests/fixtures/serializers/epics/
git commit -m "[feat] US-0240 | E.1: epic-serializer + ac-serializer

Two serializers landing together — epic is a top-level fenced block
(inverse of parseEpicBlock), ac is a single line inside a story's
'Acceptance Criteria:' list. Both validate id format + required fields
and throw ValidationError on misuse.

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>"
```

---

## Task 5: bug + lesson + test-case + task serializers (batched)

These four follow the same shape as story/epic. Implement all four together because each is short and the test scaffolding is identical.

**Files:**

- Create: `tools/lib/repository/serializers/bug-serializer.js`
- Create: `tools/lib/repository/serializers/lesson-serializer.js`
- Create: `tools/lib/repository/serializers/test-case-serializer.js`
- Create: `tools/lib/repository/serializers/task-serializer.js`
- Create: matching test file + fixtures dir per serializer.

- [ ] **Step 1: Capture fixtures (one shell session)**

```bash
mkdir -p tests/fixtures/serializers/{bugs,lessons,test-cases,tasks}
```

Pull representative blocks:

- `bugs/bug-minimal.md`, `bugs/bug-heading-prefix.md` (`### BUG-XXXX:` form), `bugs/bug-resolved.md` (Status: Fixed + Fix Branch + Lesson Encoded), `bugs/bug-with-gh-issue.md`.
- `lessons/lesson-dash-separator.md` (`## L-XXXX — Title`), `lessons/lesson-colon-separator.md` (`## L-XXXX: Title`), `lessons/lesson-with-bugs.md` (has `**Bugs:**`).
- `test-cases/tc-pass.md`, `test-cases/tc-fail.md`, `test-cases/tc-not-run.md`.
- `tasks/task-line.md` — a single TASK-XXXX line as found in plan-task sections of RELEASE_PLAN.md (find via `grep -n "^TASK-" docs/RELEASE_PLAN.md | head -3`).

- [ ] **Step 2: Write all 4 test files (one shape, repeated)**

The shape:

```js
'use strict';
const fs = require('fs');
const path = require('path');
const { serialize } = require('../../../../tools/lib/repository/serializers/<entity>-serializer');
const { parse<Entity> } = require('../../../../tools/lib/parse-<entity>');
const DIR = path.join(__dirname, '..', '..', '..', 'fixtures', 'serializers', '<entity>');
const FIXTURES = [...];

describe('<entity>-serializer', () => {
  describe.each(FIXTURES)('%s', (name) => {
    const input = fs.readFileSync(path.join(DIR, name), 'utf8');
    const parsed = parse<Entity>(input);
    it('parses to exactly one entity', () => expect(parsed).toHaveLength(1));
    it('round-trip', () => {
      const out = serialize(parsed[0]);
      const reparsed = parse<Entity>(out);
      expect(reparsed).toEqual(parsed);
    });
  });
});
```

Write this shape verbatim for each entity (`bugs`, `lessons`, `test-cases`, `tasks`). For tasks, the "parser" doesn't have its own file — write an inline mini-parser in the test that regex-matches `^(TASK-\d+):\s*(.+)$` and use that.

- [ ] **Step 3: Implement bug-serializer**

```js
// tools/lib/repository/serializers/bug-serializer.js
'use strict';
const { ValidationError } = require('../errors');
const { joinLines } = require('./_fence-utils');

const ID_RE = /^BUG-\d+$/;
// Must match the bugs.status CHECK constraint in 004_bugs_status_widen.sql.
// Note the case-sensitive 'WontFix' (NOT 'Wontfix' from 001) — 004 widened and
// renormalised the casing.
const ALLOWED_STATUS = new Set(['Open', 'In Progress', 'Fixed', 'Verified', 'WontFix', 'Closed']);

function serialize(bug) {
  if (!bug || !ID_RE.test(bug.id || ''))
    throw new ValidationError(`invalid bug id: ${bug && bug.id}`, { code: 'INVALID_ID' });
  if (!bug.title) throw new ValidationError('bug.title required', { code: 'MISSING_FIELD' });
  if (!ALLOWED_STATUS.has(bug.status))
    throw new ValidationError(`invalid bug.status: ${bug.status}`, { code: 'INVALID_STATUS' });
  const lines = [];
  lines.push(`${bug.id}: ${bug.title}`);
  if (bug.severity) lines.push(`Severity: ${bug.severity}`);
  if (bug.relatedStory) lines.push(`Related Story: ${bug.relatedStory}`);
  if (bug.relatedTask) lines.push(`Related Task: ${bug.relatedTask}`);
  lines.push(`Status: ${bug.status}`);
  if (bug.fixBranch) lines.push(`Fix Branch: ${bug.fixBranch}`);
  if (bug.lessonEncoded) lines.push(`Lesson Encoded: ${bug.lessonEncoded}`);
  if (bug.estimatedCostUsd != null && bug.estimatedCostUsd !== 0)
    lines.push(`Estimated Cost USD: ${bug.estimatedCostUsd}`);
  if (bug.ghIssueNumber != null) lines.push(`GH Issue: #${bug.ghIssueNumber}`);
  return joinLines(lines);
}

module.exports = { serialize, ID_RE, ALLOWED_STATUS };
```

- [ ] **Step 4: Implement lesson-serializer**

```js
// tools/lib/repository/serializers/lesson-serializer.js
'use strict';
const { ValidationError } = require('../errors');

const ID_RE = /^L-\d+$/;

function serialize(lesson) {
  if (!lesson || !ID_RE.test(lesson.id || ''))
    throw new ValidationError(`invalid lesson id: ${lesson && lesson.id}`, { code: 'INVALID_ID' });
  if (!lesson.title) throw new ValidationError('lesson.title required', { code: 'MISSING_FIELD' });
  if (!lesson.rule) throw new ValidationError('lesson.rule required', { code: 'MISSING_FIELD' });
  const lines = [];
  // Migration 001 normalises to the em-dash separator form.
  lines.push(`## ${lesson.id} — ${lesson.title}`);
  lines.push('');
  lines.push(`**Rule:** ${lesson.rule}`);
  if (lesson.context) {
    lines.push('');
    lines.push(`*${lesson.context}*`);
  }
  if (lesson.date) {
    lines.push('');
    lines.push(`**Date:** ${lesson.date}`);
  }
  if (Array.isArray(lesson.bugIds) && lesson.bugIds.length > 0) {
    lines.push(`**Bugs:** ${lesson.bugIds.join(', ')}`);
  }
  return lines.join('\n') + '\n';
}

module.exports = { serialize, ID_RE };
```

- [ ] **Step 5: Implement test-case-serializer**

```js
// tools/lib/repository/serializers/test-case-serializer.js
'use strict';
const { ValidationError } = require('../errors');
const { joinLines } = require('./_fence-utils');

const ID_RE = /^TC-\d+$/;
const ALLOWED_STATUS = new Set(['Pass', 'Fail', 'Not Run']);

function serialize(tc) {
  if (!tc || !ID_RE.test(tc.id || ''))
    throw new ValidationError(`invalid tc id: ${tc && tc.id}`, { code: 'INVALID_ID' });
  if (!tc.title) throw new ValidationError('tc.title required', { code: 'MISSING_FIELD' });
  if (!ALLOWED_STATUS.has(tc.status))
    throw new ValidationError(`invalid tc.status: ${tc.status}`, { code: 'INVALID_STATUS' });
  const lines = [];
  lines.push(`${tc.id}: ${tc.title}`);
  if (tc.relatedStory) lines.push(`Related Story: ${tc.relatedStory}`);
  if (tc.relatedTask) lines.push(`Related Task: ${tc.relatedTask}`);
  if (tc.relatedAC) lines.push(`Related AC: ${tc.relatedAC}`);
  if (tc.type) lines.push(`Type: ${tc.type}`);
  // Status format mirrors parser: '[x] Pass' / '[x] Fail' / '[ ] Not Run'
  const statusRaw = tc.status === 'Not Run' ? '[ ] Not Run' : `[x] ${tc.status}`;
  lines.push(`Status: ${statusRaw}`);
  if (tc.defect && tc.defect !== 'None') lines.push(`Defect Raised: ${tc.defect}`);
  return joinLines(lines);
}

module.exports = { serialize, ID_RE, ALLOWED_STATUS };
```

- [ ] **Step 6: Implement task-serializer**

```js
// tools/lib/repository/serializers/task-serializer.js
'use strict';
const { ValidationError } = require('../errors');

const ID_RE = /^TASK-\d+$/;

/**
 * Serialize a TASK row. Tasks live inside RELEASE_PLAN.md plan-task
 * sections as single lines (no fenced block). Returns the line WITHOUT
 * trailing newline.
 */
function serialize(task) {
  if (!task || !ID_RE.test(task.id || ''))
    throw new ValidationError(`invalid task id: ${task && task.id}`, { code: 'INVALID_ID' });
  if (!task.title) throw new ValidationError('task.title required', { code: 'MISSING_FIELD' });
  const parts = [`${task.id}: ${task.title}`];
  if (task.story) parts.push(`(story: ${task.story})`);
  if (task.status) parts.push(`[${task.status}]`);
  return parts.join(' ');
}

module.exports = { serialize, ID_RE };
```

- [ ] **Step 7: Run all 4 test files**

```bash
npx jest tests/unit/repository/serializers/bug-serializer.test.js tests/unit/repository/serializers/lesson-serializer.test.js tests/unit/repository/serializers/test-case-serializer.test.js tests/unit/repository/serializers/task-serializer.test.js 2>&1 | tail -10
```

Expected: all round-trip assertions pass. If any fail, adjust the field order or formatting to match the parser's expectations. The byte-stability assertion is optional for these (their parsers are tolerant of multiple input formats — the canonical form is whatever the serializer emits, which Migration 001 will enforce).

- [ ] **Step 8: Commit**

```bash
git add tools/lib/repository/serializers/bug-serializer.js tools/lib/repository/serializers/lesson-serializer.js tools/lib/repository/serializers/test-case-serializer.js tools/lib/repository/serializers/task-serializer.js tests/unit/repository/serializers/bug-serializer.test.js tests/unit/repository/serializers/lesson-serializer.test.js tests/unit/repository/serializers/test-case-serializer.test.js tests/unit/repository/serializers/task-serializer.test.js tests/fixtures/serializers/
git commit -m "[feat] US-0240 | E.1: bug + lesson + test-case + task serializers

Four serializers landing together, all following the story/epic shape:
parse-fixture → serialize → re-parse → deep-equal. ValidationError on
invalid id / missing required field / invalid status enum.

These cover the remaining 4 of the 7 entity types in the spec's
serializer matrix. Byte-stability against pre-norm fixtures is optional
here — Migration 001 (US-0243) canonicalises production files.

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>"
```

---

## Task 6: `markdown-mutator.js` — anchored-block replacement core

**Files:**

- Create: `tools/lib/repository/markdown-mutator.js`
- Create: `tests/unit/repository/markdown-mutator.test.js`

- [ ] **Step 1: Write the failing test**

Create `tests/unit/repository/markdown-mutator.test.js`:

````js
'use strict';

const { replaceBlockInText } = require('../../../tools/lib/repository/markdown-mutator');

const DOC = [
  '# Header',
  '',
  'intro prose',
  '',
  '```',
  'US-0001 (EPIC-0010): Title A',
  'Status: To Do',
  '```',
  '',
  'middle prose with **markdown**',
  '',
  '```',
  'US-0002 (EPIC-0010): Title B',
  'Status: Done',
  '```',
  '',
  'trailing prose',
  '',
].join('\n');

describe('replaceBlockInText', () => {
  it('replaces the US-0001 block body with a new body, leaves the rest byte-identical', () => {
    const out = replaceBlockInText(DOC, /^US-0001\b/, () => 'US-0001 (EPIC-0010): Title A\nStatus: Done\n');
    // The replacement preserves the surrounding ``` fences and the
    // surrounding prose byte-for-byte.
    expect(out).toContain('```\nUS-0001 (EPIC-0010): Title A\nStatus: Done\n```');
    expect(out).toContain('intro prose');
    expect(out).toContain('middle prose with **markdown**');
    expect(out).toContain('trailing prose');
    // The US-0002 block is unchanged.
    expect(out).toContain('US-0002 (EPIC-0010): Title B\nStatus: Done');
  });

  it('throws when the id-regex does not match any block', () => {
    expect(() => replaceBlockInText(DOC, /^US-9999\b/, () => 'irrelevant')).toThrow(/not found/i);
  });

  it('passes the original block body to the mutator (for inspection / partial mutation)', () => {
    let captured = null;
    replaceBlockInText(DOC, /^US-0001\b/, (body) => {
      captured = body;
      return body;
    });
    expect(captured).toContain('US-0001 (EPIC-0010): Title A');
    expect(captured).toContain('Status: To Do');
    expect(captured).not.toContain('```'); // the fences are NOT part of the body
  });

  it('preserves the trailing newline at end-of-file when replacing the LAST block', () => {
    const lastBlockDoc = '```\nUS-0001: only\nStatus: Done\n```\n';
    const out = replaceBlockInText(lastBlockDoc, /^US-0001\b/, () => 'US-0001: only\nStatus: To Do\n');
    expect(out).toBe('```\nUS-0001: only\nStatus: To Do\n```\n');
  });
});
````

- [ ] **Step 2: Run, expect failure**

```bash
npx jest tests/unit/repository/markdown-mutator.test.js 2>&1 | tail -4
```

Expected: module-not-found.

- [ ] **Step 3: Implement**

Create `tools/lib/repository/markdown-mutator.js`:

````js
'use strict';

const fs = require('fs');
const { withFileLock } = require('./file-lock');
const { findBlockRange } = require('./serializers/_fence-utils');

/**
 * Pure-string version of replaceBlock — extracts the body between the
 * fences of the block whose first non-empty line matches `idRegex`,
 * passes it to `mutator(bodyText) -> newBodyText`, and returns a new
 * document with the new body spliced in. Throws if no block matches.
 */
function replaceBlockInText(text, idRegex, mutator) {
  const range = findBlockRange(text, idRegex);
  if (!range) {
    throw new Error(`replaceBlockInText: block matching ${idRegex} not found`);
  }
  // The block range is [start of opening fence line, start of line AFTER
  // closing fence). Body is everything between the opening fence's newline
  // and the closing fence's line-start.
  const fullBlock = text.slice(range.start, range.end);
  // Strip opening fence line (first line) and closing fence line (last
  // non-empty meaningful line). Use regex over the trailing structure to
  // preserve the trailing newline.
  const openFenceEnd = fullBlock.indexOf('\n') + 1;
  // Find the start of the closing fence by scanning from the end.
  const trimmed = fullBlock.replace(/```\s*\n?$/, '');
  const closeFenceStart = trimmed.length;
  const body = fullBlock.slice(openFenceEnd, closeFenceStart);
  const newBody = mutator(body);
  const newBlock = fullBlock.slice(0, openFenceEnd) + newBody + fullBlock.slice(closeFenceStart);
  return text.slice(0, range.start) + newBlock + text.slice(range.end);
}

/**
 * Filesystem version — acquires withFileLock(path), reads, mutates via
 * replaceBlockInText, writes via tmp+rename.
 */
async function replaceBlock({ path: filePath, idRegex, mutator }) {
  return withFileLock(filePath, async () => {
    const text = fs.readFileSync(filePath, 'utf8');
    const next = replaceBlockInText(text, idRegex, mutator);
    if (next === text) return { changed: false };
    const tmp = filePath + '.tmp';
    fs.writeFileSync(tmp, next);
    fs.renameSync(tmp, filePath);
    return { changed: true };
  });
}

module.exports = { replaceBlockInText, replaceBlock };
````

- [ ] **Step 4: Run, expect green**

```bash
npx jest tests/unit/repository/markdown-mutator.test.js 2>&1 | tail -4
```

Expected: 4 passed.

- [ ] **Step 5: Commit**

```bash
git add tools/lib/repository/markdown-mutator.js tests/unit/repository/markdown-mutator.test.js
git commit -m "[feat] US-0240 | E.1: markdown-mutator — anchored-block replacement core

Implements spec §3.3 anchored-block-replacement. Used by every entity
repo's .update(id, fn) to splice a new serialized block into a markdown
file at the exact range of the existing block, leaving surrounding
prose byte-identical.

replaceBlockInText is the pure-string variant (tested standalone);
replaceBlock wraps it with withFileLock + atomic tmp+rename for the
on-disk write.

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>"
```

---

## Task 7: StoryRepo.update + StoryRepo.create + byte-identical regression test

**Files:**

- Modify: `tools/lib/repository/entities/story-repo.js`
- Create: `tests/integration/repository/story-update.test.js`

- [ ] **Step 1: Write the failing integration test**

Create `tests/integration/repository/story-update.test.js`:

````js
'use strict';

const fs = require('fs');
const os = require('os');
const path = require('path');
const { Repository } = require('../../../tools/lib/repository');

function mkRoot() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'us0240-story-update-'));
  fs.mkdirSync(path.join(root, 'docs'), { recursive: true });
  fs.writeFileSync(path.join(root, 'package.json'), JSON.stringify({ name: 't', version: '1.0.0' }));
  return root;
}

const SAMPLE_DOC = `# Plan

intro prose with **markdown** that must survive byte-identical

\`\`\`
US-0001 (EPIC-0001): Sample story
Priority: High (P1)
Estimate: M
Status: To Do
Acceptance Criteria:

- [ ] AC-0001: do the thing
- [ ] AC-0002: do the other thing
\`\`\`

middle prose
- a bullet list
- another bullet

\`\`\`
US-0002 (EPIC-0001): Second story
Priority: Medium (P2)
Estimate: S
Status: To Do
\`\`\`

trailing prose
`;

describe('US-0240 / AC-0938 + AC-0942: StoryRepo.update', () => {
  let root;
  afterEach(() => {
    Repository._reset();
    if (root) fs.rmSync(root, { recursive: true, force: true });
  });

  it('updates US-0001.status to "Done" and leaves surrounding prose byte-identical', async () => {
    root = mkRoot();
    fs.writeFileSync(path.join(root, 'docs', 'RELEASE_PLAN.md'), SAMPLE_DOC);

    Repository._reset();
    const repo = Repository.getInstance({ root });
    repo.refresh(); // ingest the file into SQL

    await repo.stories.update('US-0001', (s) => {
      s.status = 'Done';
    });

    const after = fs.readFileSync(path.join(root, 'docs', 'RELEASE_PLAN.md'), 'utf8');

    // 1. The targeted block reflects the change.
    expect(after).toMatch(/US-0001 \(EPIC-0001\): Sample story[\s\S]+?Status: Done/);
    // 2. The OTHER block is unchanged byte-for-byte.
    const us0002Original = SAMPLE_DOC.match(/```\s*\nUS-0002[\s\S]+?```/)[0];
    const us0002After = after.match(/```\s*\nUS-0002[\s\S]+?```/)[0];
    expect(us0002After).toBe(us0002Original);
    // 3. The surrounding prose is byte-identical.
    expect(after).toContain('intro prose with **markdown** that must survive byte-identical');
    expect(after).toContain('middle prose\n- a bullet list\n- another bullet');
    expect(after).toContain('trailing prose');
    // 4. SQL index reflects the change.
    expect(repo.stories.get('US-0001').status).toBe('Done');
  });

  it('throws ValidationError when fn produces an invalid status', async () => {
    root = mkRoot();
    fs.writeFileSync(path.join(root, 'docs', 'RELEASE_PLAN.md'), SAMPLE_DOC);
    Repository._reset();
    const repo = Repository.getInstance({ root });
    repo.refresh();
    const { ValidationError } = require('../../../tools/lib/repository/errors');
    await expect(
      repo.stories.update('US-0001', (s) => {
        s.status = 'Maybe';
      }),
    ).rejects.toThrow(ValidationError);
    // File must not be partially written.
    const after = fs.readFileSync(path.join(root, 'docs', 'RELEASE_PLAN.md'), 'utf8');
    expect(after).toBe(SAMPLE_DOC);
  });

  it('throws when the id does not exist', async () => {
    root = mkRoot();
    fs.writeFileSync(path.join(root, 'docs', 'RELEASE_PLAN.md'), SAMPLE_DOC);
    Repository._reset();
    const repo = Repository.getInstance({ root });
    repo.refresh();
    await expect(
      repo.stories.update('US-9999', (s) => {
        s.status = 'Done';
      }),
    ).rejects.toThrow(/not found/i);
  });
});

describe('US-0240 / AC-0938: StoryRepo.create', () => {
  let root;
  afterEach(() => {
    Repository._reset();
    if (root) fs.rmSync(root, { recursive: true, force: true });
  });

  it('appends a new story block at end-of-file and indexes it', async () => {
    root = mkRoot();
    fs.writeFileSync(path.join(root, 'docs', 'RELEASE_PLAN.md'), SAMPLE_DOC);
    Repository._reset();
    const repo = Repository.getInstance({ root });
    repo.refresh();

    await repo.stories.create({
      id: 'US-0003',
      epicId: 'EPIC-0001',
      title: 'Newly minted',
      status: 'To Do',
      priority: 'Low (P3)',
      estimate: 'S',
      acs: [],
    });
    const after = fs.readFileSync(path.join(root, 'docs', 'RELEASE_PLAN.md'), 'utf8');
    expect(after).toMatch(/US-0003 \(EPIC-0001\): Newly minted/);
    expect(repo.stories.get('US-0003').title).toBe('Newly minted');
    // The original prose is preserved.
    expect(after).toContain('intro prose with **markdown**');
  });

  it('throws ValidationError when id collides with an existing story', async () => {
    root = mkRoot();
    fs.writeFileSync(path.join(root, 'docs', 'RELEASE_PLAN.md'), SAMPLE_DOC);
    Repository._reset();
    const repo = Repository.getInstance({ root });
    repo.refresh();
    const { ValidationError } = require('../../../tools/lib/repository/errors');
    await expect(
      repo.stories.create({
        id: 'US-0001', // collision
        epicId: 'EPIC-0001',
        title: 'dup',
        status: 'To Do',
        priority: 'High (P1)',
        estimate: 'M',
        acs: [],
      }),
    ).rejects.toThrow(ValidationError);
  });
});
````

- [ ] **Step 2: Run, expect failure**

```bash
npx jest tests/integration/repository/story-update.test.js 2>&1 | tail -8
```

Expected: `repo.stories.update is not a function` and similar (red).

- [ ] **Step 3: Extend StoryRepo with .update and .create**

Open `tools/lib/repository/entities/story-repo.js`. Replace the entire file with:

````js
'use strict';
const path = require('path');
const { BaseRepo } = require('./base-repo');
const { replaceBlock } = require('../markdown-mutator');
const { serialize: serializeStory } = require('../serializers/story-serializer');
const { parseStories } = require('../../parse-release-plan');
const { ValidationError } = require('../errors');
const fs = require('fs');
const { withFileLock } = require('../file-lock');

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
    this._releasePlanPath = path.join(root, 'docs', 'RELEASE_PLAN.md');
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

  /**
   * Update story `id` via the anchored-block-replacement mechanic.
   *
   *   1. Acquire RELEASE_PLAN.md file lock.
   *   2. Read full file, locate the block whose body matches /^<id>\b/.
   *   3. Re-parse just that block via parseStories(wrappedDoc).
   *   4. Apply fn(draft) to mutate the draft entity.
   *   5. Serialize via story-serializer (throws ValidationError on invalid).
   *   6. Splice the new body into the file at the original range.
   *   7. Write file via tmp+rename.
   *   8. Re-ingest the row into the SQL index.
   *
   * Surrounding prose is byte-identical (markdown-mutator preserves it).
   */
  async update(id, fn) {
    // Pre-flight: must exist.
    const current = this.get(id);
    if (!current) throw new Error(`StoryRepo.update: ${id} not found`);

    const idRegex = new RegExp(`^${id}\\b`);
    await replaceBlock({
      path: this._releasePlanPath,
      idRegex,
      mutator: (body) => {
        // Wrap the body in fences so parseStories sees a doc.
        const parsed = parseStories('```\n' + body + '```\n');
        if (parsed.length !== 1) {
          throw new Error(`StoryRepo.update: expected 1 parsed story in block, got ${parsed.length}`);
        }
        const draft = parsed[0];
        fn(draft);
        // serializeStory throws ValidationError on invalid status / id /
        // missing fields per AC-0941.
        return serializeStory(draft);
      },
    });

    // Re-ingest: read the new file and replace the row in SQL. Cheapest
    // approach is to invoke the existing release-plan indexer for just
    // this file. The indexer is idempotent (delete-then-insert).
    const { indexReleasePlan } = require('../indexers/release-plan-indexer');
    indexReleasePlan({
      index: this.index,
      markdown: { absolute: (rel) => path.join(this._root || path.dirname(path.dirname(this._releasePlanPath)), rel) },
      rel: 'docs/RELEASE_PLAN.md',
    });
  }

  async create(entity) {
    if (this.get(entity.id)) {
      throw new ValidationError(`StoryRepo.create: ${entity.id} already exists`, {
        code: 'DUPLICATE_ID',
        details: { id: entity.id },
      });
    }
    const body = serializeStory(entity); // throws ValidationError if invalid
    await withFileLock(this._releasePlanPath, async () => {
      const text = fs.readFileSync(this._releasePlanPath, 'utf8');
      // Append at end-of-file, separated by a blank line.
      const sep = text.endsWith('\n') ? '\n' : '\n\n';
      const next = text + sep + '```\n' + body + '```\n';
      const tmp = this._releasePlanPath + '.tmp';
      fs.writeFileSync(tmp, next);
      fs.renameSync(tmp, this._releasePlanPath);
    });
    const { indexReleasePlan } = require('../indexers/release-plan-indexer');
    indexReleasePlan({
      index: this.index,
      markdown: { absolute: (rel) => path.join(this._root || path.dirname(path.dirname(this._releasePlanPath)), rel) },
      rel: 'docs/RELEASE_PLAN.md',
    });
  }
}
module.exports = { StoryRepo };
````

**Notes on the implementation:**

- The `indexReleasePlan` re-call at the end is the "mirror to SQL" step from spec §3.3 line 100. We do NOT carve out a per-entity upsert path; we let the indexer re-process the whole file because it's already idempotent and the cost is bounded.
- `_root` is the project root (set by `BaseRepo` constructor); the indexer needs `markdown.absolute(rel)` to resolve files, so we hand it a minimal shim. If the existing `MarkdownDatastore` is available on `this`, use it directly instead — adjust if so.

- [ ] **Step 4: Run the integration test**

```bash
npx jest tests/integration/repository/story-update.test.js 2>&1 | tail -10
```

Iterate to green. Likely fixes needed:

- The `_root` resolution shim might not work cleanly; replace with passing the existing `markdown` datastore from `Repository` constructor through to `StoryRepo`.
- The `parseStories` call may not handle the un-fenced body — adjust the wrap pattern.
- Re-ingest might need `Repository.refresh()` instead of the direct indexer call; if so, refactor to call `this.index.transaction(() => indexReleasePlan(...))` to keep it atomic.

Expected: 5 passed (3 update + 2 create assertions).

- [ ] **Step 5: Commit**

```bash
git add tools/lib/repository/entities/story-repo.js tests/integration/repository/story-update.test.js
git commit -m "[feat] US-0240 | E.1: StoryRepo.update + StoryRepo.create

First entity to gain the writer API. Implements spec §3.3 anchored-
block-replacement: file-lock, regex-anchor on id, slice+parse+mutate+
serialize+splice, write+release, re-index.

Tests cover:
  - AC-0938: read under file lock + AST-replace + mirror to SQL.
  - AC-0942: surrounding prose byte-identical after .update.
  - AC-0941: ValidationError on invalid status / duplicate id.

The mirror-to-SQL step calls indexReleasePlan re-entrantly. The indexer
is idempotent (delete-then-insert) so re-ingesting the whole file is
safe and bounded.

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>"
```

---

## Task 8: AC repo .update (sub-entity inside story block)

ACs are a special case — they nest inside a story's `Acceptance Criteria:` list. `repo.acs.update(id, fn)` must locate the AC line WITHIN its parent story block, mutate it, and re-write the parent story.

**Files:**

- Modify: `tools/lib/repository/entities/ac-repo.js`
- Create: `tests/integration/repository/ac-update.test.js`

- [ ] **Step 1: Write the failing test**

Create `tests/integration/repository/ac-update.test.js`:

```js
'use strict';

const fs = require('fs');
const os = require('os');
const path = require('path');
const { Repository } = require('../../../tools/lib/repository');

const SAMPLE = `# Plan

\`\`\`
US-0001 (EPIC-0001): Sample story
Priority: High (P1)
Estimate: M
Status: To Do
Acceptance Criteria:

- [ ] AC-0001: first
- [ ] AC-0002: second
\`\`\`
`;

describe('US-0240: AcRepo.update', () => {
  let root;
  afterEach(() => {
    Repository._reset();
    if (root) fs.rmSync(root, { recursive: true, force: true });
  });

  it('flips AC-0001 to checked + preserves AC-0002 + preserves story prose', async () => {
    root = fs.mkdtempSync(path.join(os.tmpdir(), 'us0240-ac-'));
    fs.mkdirSync(path.join(root, 'docs'), { recursive: true });
    fs.writeFileSync(path.join(root, 'package.json'), JSON.stringify({ name: 't', version: '1.0.0' }));
    fs.writeFileSync(path.join(root, 'docs', 'RELEASE_PLAN.md'), SAMPLE);
    Repository._reset();
    const repo = Repository.getInstance({ root });
    repo.refresh();

    await repo.acs.update('AC-0001', (ac) => {
      ac.checked = true;
    });

    const after = fs.readFileSync(path.join(root, 'docs', 'RELEASE_PLAN.md'), 'utf8');
    expect(after).toContain('- [x] AC-0001: first');
    expect(after).toContain('- [ ] AC-0002: second');
    expect(after).toContain('US-0001 (EPIC-0001): Sample story');
  });
});
```

- [ ] **Step 2: Run, expect failure**

```bash
npx jest tests/integration/repository/ac-update.test.js 2>&1 | tail -6
```

- [ ] **Step 3: Implement AcRepo.update**

Open `tools/lib/repository/entities/ac-repo.js` and add the `update` method. AcRepo gets the AC's parent story id from SQL (`SELECT story_id FROM acs WHERE id=?`), then delegates to `repo.stories.update(storyId, draft => { /* mutate the matching AC in draft.acs */ })`:

```js
'use strict';
const { BaseRepo } = require('./base-repo');

function mapAc(r) {
  return { id: r.id, storyId: r.story_id, text: r.text, checked: !!r.checked };
}

class AcRepo extends BaseRepo {
  constructor(index, root, storyRepoGetter) {
    super({ index, table: 'acs', mapRow: mapAc, root });
    this._getStoryRepo = storyRepoGetter; // lazy to avoid ctor cycle
  }

  async update(id, fn) {
    const current = this.get(id);
    if (!current) throw new Error(`AcRepo.update: ${id} not found`);
    const storyRepo = this._getStoryRepo();
    await storyRepo.update(current.storyId, (story) => {
      const target = (story.acs || []).find((a) => a.id === id);
      if (!target)
        throw new Error(`AcRepo.update: ${id} present in SQL index but absent from story ${current.storyId} block`);
      fn(target);
    });
  }
}
module.exports = { AcRepo };
```

Then wire the getter in `tools/lib/repository/index.js`:

```js
// Replace:
//   this.acs = new AcRepo(this.index, root);
// With:
this.acs = new AcRepo(this.index, root, () => this.stories);
```

- [ ] **Step 4: Run, expect green**

```bash
npx jest tests/integration/repository/ac-update.test.js 2>&1 | tail -6
```

Expected: 1 passed.

- [ ] **Step 5: Commit**

```bash
git add tools/lib/repository/entities/ac-repo.js tools/lib/repository/index.js tests/integration/repository/ac-update.test.js
git commit -m "[feat] US-0240 | E.1: AcRepo.update delegates to parent StoryRepo.update

ACs nest inside a story's Acceptance Criteria: list. AcRepo.update reads
the AC's storyId from SQL, then calls StoryRepo.update(storyId, fn)
where fn finds the matching AC in story.acs and applies the user's
mutator. Re-uses the entire anchored-block-replacement mechanism
unchanged — no separate code path needed.

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>"
```

---

## Task 9: Epic + Bug + Lesson + TestCase + Task repos — .update + .create matrix

This task applies the same pattern as Task 7 to the remaining 5 entity types. The implementation is mechanical because the StoryRepo template fits each entity exactly; only the source-file path, parser function, and serializer change per entity.

**Files:**

- Modify: `tools/lib/repository/entities/epic-repo.js` (add .update + .create)
- Create: `tools/lib/repository/entities/bug-repo.js`
- Create: `tools/lib/repository/entities/lesson-repo.js`
- Create: `tools/lib/repository/entities/test-case-repo.js`
- Create: `tools/lib/repository/entities/task-repo.js`
- Modify: `tools/lib/repository/index.js` (wire all 4 new repos)
- Create: `tests/integration/repository/entity-write-matrix.test.js`

- [ ] **Step 1: Write the failing matrix test**

Create `tests/integration/repository/entity-write-matrix.test.js`:

````js
'use strict';

const fs = require('fs');
const os = require('os');
const path = require('path');
const { Repository } = require('../../../tools/lib/repository');

function mkRoot() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'us0240-matrix-'));
  fs.mkdirSync(path.join(root, 'docs'), { recursive: true });
  fs.writeFileSync(path.join(root, 'package.json'), JSON.stringify({ name: 't', version: '1.0.0' }));
  return root;
}

// Each entry: { name, sourceFile, seed, repoName, updateId, updateFn, updateExpect, createEntity, createExpect }
const MATRIX = [
  {
    name: 'epics',
    sourceFile: 'docs/RELEASE_PLAN.md',
    seed: '```\nEPIC-0001: Sample epic\nStatus: To Do\n```\n',
    repoName: 'epics',
    updateId: 'EPIC-0001',
    updateFn: (e) => {
      e.status = 'Done';
    },
    updateExpect: (text) => expect(text).toMatch(/EPIC-0001: Sample epic[\s\S]*Status: Done/),
    createEntity: { id: 'EPIC-0002', title: 'New', status: 'To Do' },
    createExpect: (text) => expect(text).toContain('EPIC-0002: New'),
  },
  {
    name: 'bugs',
    sourceFile: 'docs/BUGS.md',
    seed: 'BUG-0001: Sample bug\nSeverity: Low\nStatus: Open\n',
    repoName: 'bugs',
    updateId: 'BUG-0001',
    updateFn: (b) => {
      b.status = 'Fixed';
    },
    updateExpect: (text) => expect(text).toMatch(/BUG-0001: Sample bug[\s\S]*Status: Fixed/),
    createEntity: { id: 'BUG-0002', title: 'New', status: 'Open', severity: 'Medium' },
    createExpect: (text) => expect(text).toContain('BUG-0002: New'),
  },
  {
    name: 'lessons',
    sourceFile: 'docs/LESSONS.md',
    seed: '## L-0001 — Sample lesson\n\n**Rule:** sample\n',
    repoName: 'lessons',
    updateId: 'L-0001',
    updateFn: (l) => {
      l.rule = 'updated rule';
    },
    updateExpect: (text) => expect(text).toContain('**Rule:** updated rule'),
    createEntity: { id: 'L-0002', title: 'New lesson', rule: 'be careful' },
    createExpect: (text) => expect(text).toContain('## L-0002 — New lesson'),
  },
  {
    name: 'testCases',
    sourceFile: 'docs/TEST_CASES.md',
    seed: 'TC-0001: Sample\nType: unit\nStatus: [ ] Not Run\n',
    repoName: 'testCases',
    updateId: 'TC-0001',
    updateFn: (t) => {
      t.status = 'Pass';
    },
    updateExpect: (text) => expect(text).toMatch(/TC-0001: Sample[\s\S]*Status: \[x\] Pass/),
    createEntity: { id: 'TC-0002', title: 'New', status: 'Not Run', type: 'unit' },
    createExpect: (text) => expect(text).toContain('TC-0002: New'),
  },
];

describe.each(MATRIX)('US-0240 / AC-0939: $name repo .update + .create', (entry) => {
  let root;
  afterEach(() => {
    Repository._reset();
    if (root) fs.rmSync(root, { recursive: true, force: true });
  });

  it('round-trip: seed → update → assertion + create → assertion', async () => {
    root = mkRoot();
    fs.writeFileSync(path.join(root, entry.sourceFile), entry.seed);
    Repository._reset();
    const repo = Repository.getInstance({ root });
    repo.refresh();

    // For the entity-source files that are NOT pure entity stores (eg
    // RELEASE_PLAN.md doubles for epics + stories + tasks), parts of the
    // seed may need to be a fenced block. The epic seed already uses
    // fences; the bugs/lessons/test-cases seeds are flat-text files
    // because their parsers don't require fencing.
    await repo[entry.repoName].update(entry.updateId, entry.updateFn);
    let after = fs.readFileSync(path.join(root, entry.sourceFile), 'utf8');
    entry.updateExpect(after);

    await repo[entry.repoName].create(entry.createEntity);
    after = fs.readFileSync(path.join(root, entry.sourceFile), 'utf8');
    entry.createExpect(after);
  });
});

describe('US-0240 / AC-0939: tasks repo .update', () => {
  let root;
  afterEach(() => {
    Repository._reset();
    if (root) fs.rmSync(root, { recursive: true, force: true });
  });

  it('updates a TASK row inside a story block', async () => {
    root = mkRoot();
    const seed = `# Plan\n\n\`\`\`\nUS-0001 (EPIC-0001): host\nPriority: High (P1)\nEstimate: M\nStatus: In Progress\nPlan Tasks:\n\nTASK-0001: do thing [To Do]\n\`\`\`\n`;
    fs.writeFileSync(path.join(root, 'docs', 'RELEASE_PLAN.md'), seed);
    Repository._reset();
    const repo = Repository.getInstance({ root });
    repo.refresh();
    await repo.tasks.update('TASK-0001', (t) => {
      t.status = 'Done';
    });
    const after = fs.readFileSync(path.join(root, 'docs', 'RELEASE_PLAN.md'), 'utf8');
    expect(after).toContain('TASK-0001: do thing');
    expect(after).toMatch(/TASK-0001:[^[\n]+\[Done\]/);
  });
});
````

- [ ] **Step 2: Run, expect failure**

```bash
npx jest tests/integration/repository/entity-write-matrix.test.js 2>&1 | tail -10
```

Expected: many reds (`repo.bugs is undefined`, etc.).

- [ ] **Step 3: Implement EpicRepo.update + EpicRepo.create**

Open `tools/lib/repository/entities/epic-repo.js`. Apply the StoryRepo Task 7 pattern verbatim, swapping:

- Parser: use `parseEpics` from `parse-release-plan.js`.
- Serializer: `epic-serializer`.
- Source file: same `docs/RELEASE_PLAN.md`.
- Re-index: same `indexReleasePlan` call.

- [ ] **Step 4: Create BugRepo, LessonRepo, TestCaseRepo, TaskRepo**

For each, follow the StoryRepo template. Wire the indexer call to the corresponding `indexBugs` / `indexLessons` / `indexTestCases` (and for tasks, `indexReleasePlan`). Source files:

| Repo         | Source file            | Parser           | Serializer             | Indexer            | SQL table        |
| ------------ | ---------------------- | ---------------- | ---------------------- | ------------------ | ---------------- |
| BugRepo      | `docs/BUGS.md`         | `parseBugs`      | `bug-serializer`       | `indexBugs`        | `bugs`           |
| LessonRepo   | `docs/LESSONS.md`      | `parseLessons`   | `lesson-serializer`    | `indexLessons`     | `lessons`        |
| TestCaseRepo | `docs/TEST_CASES.md`   | `parseTestCases` | `test-case-serializer` | `indexTestCases`   | `test_cases`     |
| TaskRepo     | `docs/RELEASE_PLAN.md` | inline regex     | `task-serializer`      | `indexReleasePlan` | `planning_tasks` |

**TaskRepo special case:** tasks live inside story blocks as `TASK-XXXX: title [Status]` lines. TaskRepo.update follows AcRepo's delegation pattern: get the parent storyId from SQL, then `repo.stories.update(storyId, story => { /* find + mutate the matching task line */ })`. Add a parse helper inline.

**Files without fenced blocks (BUGS.md, LESSONS.md, TEST_CASES.md):** the anchored-block-replacement assumes fences. For these files, use a different helper: `replaceUnfencedRange(text, startRe, nextRe, mutator)` — pure-string positional API; finds the line range from `startRe` matching to the line BEFORE the next `nextRe` match (or EOF), passes the body to `mutator(body) → newBody`, splices the result back. The entity repos wrap the call in `withFileLock` + tmp+rename themselves. Create the helper in `markdown-mutator.js` alongside `replaceBlockInText`.

Add to `markdown-mutator.js`:

```js
/**
 * For files where entities are NOT in fenced blocks (BUGS.md, LESSONS.md,
 * TEST_CASES.md). Splices the line range from the first line matching
 * `startRe` to the line BEFORE the next `nextRe` match (or end-of-file).
 */
function replaceUnfencedRange(text, startRe, nextRe, mutator) {
  const lines = text.split('\n');
  let i = lines.findIndex((l) => startRe.test(l));
  if (i < 0) throw new Error(`replaceUnfencedRange: startRe ${startRe} not found`);
  let j = i + 1;
  while (j < lines.length && !nextRe.test(lines[j])) j++;
  const body = lines.slice(i, j).join('\n') + '\n';
  const newBody = mutator(body);
  const newLines = newBody.replace(/\n$/, '').split('\n');
  const out = [...lines.slice(0, i), ...newLines, ...lines.slice(j)].join('\n');
  return out;
}
module.exports = { replaceBlockInText, replaceBlock, replaceUnfencedRange };
```

BugRepo example (sketch — implement the full file):

```js
'use strict';
const path = require('path');
const fs = require('fs');
const { BaseRepo } = require('./base-repo');
const { withFileLock } = require('../file-lock');
const { replaceUnfencedRange } = require('../markdown-mutator');
const { serialize: serializeBug } = require('../serializers/bug-serializer');
const { parseBugs } = require('../../parse-bugs');
const { ValidationError } = require('../errors');

// SQL is a THIN search index — bugs columns are only {id, status, severity,
// source_file, source_line}. To return the FULL entity from .get(id), this
// repo re-parses BUGS.md on demand instead of relying on the SQL row. The
// SQL row exists purely so dashboards / lints can filter by status without
// re-parsing every read.
function mapBug(r) {
  return { id: r.id, status: r.status, severity: r.severity, sourceFile: r.source_file, sourceLine: r.source_line };
}

class BugRepo extends BaseRepo {
  constructor(index, root) {
    super({ index, table: 'bugs', mapRow: mapBug, root });
    this._bugsPath = path.join(root, 'docs', 'BUGS.md');
    this._root = root;
  }

  async update(id, fn) {
    const current = this.get(id);
    if (!current) throw new Error(`BugRepo.update: ${id} not found`);
    const idLine = new RegExp(`^(?:#{1,4}\\s+)?${id}:`);
    const nextBug = /^(?:#{1,4}\s+)?BUG-\d+:/;
    await withFileLock(this._bugsPath, async () => {
      const text = fs.readFileSync(this._bugsPath, 'utf8');
      const next = replaceUnfencedRange(text, idLine, nextBug, (body) => {
        const parsed = parseBugs(body);
        if (parsed.length !== 1) throw new Error(`BugRepo.update: expected 1, got ${parsed.length}`);
        fn(parsed[0]);
        return serializeBug(parsed[0]);
      });
      if (next !== text) {
        fs.writeFileSync(this._bugsPath + '.tmp', next);
        fs.renameSync(this._bugsPath + '.tmp', this._bugsPath);
      }
    });
    const { indexBugs } = require('../indexers/bugs-indexer');
    indexBugs({ index: this.index, markdown: { absolute: (rel) => path.join(this._root, rel) }, rel: 'docs/BUGS.md' });
  }

  async create(entity) {
    if (this.get(entity.id)) throw new ValidationError(`BugRepo.create: ${entity.id} exists`, { code: 'DUPLICATE_ID' });
    const body = serializeBug(entity);
    await withFileLock(this._bugsPath, async () => {
      const text = fs.existsSync(this._bugsPath) ? fs.readFileSync(this._bugsPath, 'utf8') : '';
      const sep = text.endsWith('\n') || text === '' ? '\n' : '\n\n';
      fs.writeFileSync(this._bugsPath + '.tmp', text + sep + body);
      fs.renameSync(this._bugsPath + '.tmp', this._bugsPath);
    });
    const { indexBugs } = require('../indexers/bugs-indexer');
    indexBugs({ index: this.index, markdown: { absolute: (rel) => path.join(this._root, rel) }, rel: 'docs/BUGS.md' });
  }
}
module.exports = { BugRepo };
```

LessonRepo, TestCaseRepo are structural copies of BugRepo with adjusted parser/serializer/indexer/source-file/table-name. Per the Pre-Step 3 thin-index reality:

- `mapLesson(r)` returns only `{id, text, sourceFile, sourceLine}` (no title/rule/date/bugIds).
- `mapTestCase(r)` returns only `{id, storyId, title, status}` (no type/relatedTask/relatedAc/defect).

Consumers that need the FULL entity (with title/rule/etc.) must call `repo.lessons.get(id)` — implement `get` on these repos to re-parse the on-disk markdown for the requested id rather than rely on the SQL row. Pattern:

```js
get(id) {
  const fs = require('fs');
  const { parseLessons } = require('../../parse-lessons');
  if (!fs.existsSync(this._lessonsPath)) return null;
  const text = fs.readFileSync(this._lessonsPath, 'utf8');
  return parseLessons(text).find((l) => l.id === id) || null;
}
```

Override `BaseRepo.get` with this override on BugRepo / LessonRepo / TestCaseRepo. StoryRepo + EpicRepo keep the BaseRepo SQL-row get because their schemas are fully columnar.

TaskRepo binds to the `planning_tasks` table (NOT `tasks`) and follows AcRepo's delegation pattern (extract parent storyId from the SQL `planning_tasks.story_id`, defer to StoryRepo.update). The task title lives only in the markdown line `TASK-XXXX: title [Status]`; SQL holds only `{id, story_id, status}`.

- [ ] **Step 5: Wire the new repos in Repository constructor**

Edit `tools/lib/repository/index.js` constructor — add after the existing entity repo instantiations:

```js
const { BugRepo } = require('./entities/bug-repo');
const { LessonRepo } = require('./entities/lesson-repo');
const { TestCaseRepo } = require('./entities/test-case-repo');
const { TaskRepo } = require('./entities/task-repo');
// ... in constructor:
this.bugs = new BugRepo(this.index, root);
this.lessons = new LessonRepo(this.index, root);
this.testCases = new TestCaseRepo(this.index, root);
this.tasks = new TaskRepo(this.index, root, () => this.stories);
```

- [ ] **Step 6: Run the matrix test, iterate to green**

```bash
npx jest tests/integration/repository/entity-write-matrix.test.js 2>&1 | tail -15
```

Iterate. Likely fixes:

- Schema columns are THINNER than the entity field set (see Pre-Step 3 column lists). `mapXxx` must map ONLY columns that exist; full-entity reads go through `parseXxx` on demand (override pattern shown above for BugRepo/LessonRepo/TestCaseRepo).
- Some entities have indexer counts that fail if the source file doesn't exist — guard the create path so the file is bootstrapped if missing.
- Parser-quirks (e.g., `parseBugs` regex requires a specific header style) need the same fix as Step 3 in Task 5.

Expected: 5 passed (4 matrix entries + 1 standalone tasks test).

- [ ] **Step 7: Commit**

```bash
git add tools/lib/repository/entities/ tools/lib/repository/index.js tools/lib/repository/markdown-mutator.js tests/integration/repository/entity-write-matrix.test.js
git commit -m "[feat] US-0240 | E.1: bug/lesson/test-case/task repos + epic .update + .create

Closes AC-0939: the .update/.create pattern from StoryRepo is now
implemented on every entity repo. Tasks (TaskRepo) and ACs (AcRepo)
delegate to StoryRepo.update because they nest inside story blocks.
Bugs/Lessons/TestCases use replaceUnfencedRange (new helper in
markdown-mutator.js) because their source files have no fences.

Wires the 4 new repos into Repository constructor.

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>"
```

---

## Task 10: Coverage + finishing-a-development-branch

- [ ] **Step 1: Run the full suite + coverage**

```bash
npx jest --coverage --runInBand 2>&1 | tail -30
```

Expected: all tests pass. Coverage for the new modules (serializers/, errors.js, markdown-mutator.js, entity repos) ≥90% statements per spec §6.7.

If a serializer falls below 90%, add fixtures for the under-covered branches (most likely validation paths or optional-field emission).

- [ ] **Step 2: Lint + format**

```bash
npm run lint 2>&1 | tail -3
npm run format:check 2>&1 | tail -3
```

Expected: 0 errors, clean format.

- [ ] **Step 3: Hand off to finishing-a-development-branch**

Announce: "I'm using the finishing-a-development-branch skill to complete this work."

Expected PR title: `feat: US-0240 EPIC-0040 foundation — writer APIs + 7 serializers + anchored-block .update`.

PR body should list each AC (AC-0938..AC-0942) with the test file that proves it, note that this unblocks US-0244/0245/0246, and call out that the spec's `*InTransaction` shape (open decision §8.1) is deferred to US-0242.

---

## Self-Review

### Spec coverage

| Spec item                                             | Task                                              |
| ----------------------------------------------------- | ------------------------------------------------- |
| §3.2 per-entity serializer architecture               | Tasks 3, 4, 5                                     |
| §3.3 anchored-block replacement                       | Tasks 2 (fence-utils), 6 (mutator), 7 (StoryRepo) |
| §4.6 collateral test risk (budget time)               | Task 9 Step 6 explicit iteration                  |
| AC-0938: story-repo.update                            | Tasks 7                                           |
| AC-0939: same pattern on all 7 entity repos           | Tasks 7, 8, 9                                     |
| AC-0940: serializers emit canonical fenced-block body | Tasks 3, 4, 5                                     |
| AC-0941: ValidationError on invalid Status / dup ID   | Tasks 1, 3 (story tests), 7 (integration), 9      |
| AC-0942: surrounding prose byte-identical             | Task 7 Step 1 fixture + assertion                 |

### Placeholder scan

No "TBD", "TODO", "handle edge cases" tokens. Iterate-to-green guidance in Task 7 Step 4, Task 9 Step 6 explicitly enumerates the likely fixes rather than waving with "adjust as needed".

### Type consistency

- `serialize(entity) → string` across all 7 serializers (no trailing newline for AC + task; trailing newline for story/epic/bug/lesson/test-case bodies).
- `replaceBlock({path, idRegex, mutator})` signature matches every call site in Task 7 / 8 / 9.
- `ValidationError` shape (`code`, `details`) is consistent across throw sites.
- `repo.stories.update(id, fn) → Promise<void>` matches every entity repo's update signature.

### Known follow-ups (out of scope, flagged for US-0242)

- `*InTransaction` variants (spec §3.4) — every `.update`/`.create` will gain a `{tx}` opt parameter in US-0242. The current implementation does NOT yet stage writes; it commits directly.
- `acquireMany` for multi-file mutators — US-0242 introduces the lex-ordered lock acquisition. Single-entity writes here use `withFileLock` directly.
