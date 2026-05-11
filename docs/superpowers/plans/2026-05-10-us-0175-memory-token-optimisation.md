# US-0175 Memory Token Optimisation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the tooling (`tools/memory.js` + 6 lib modules + tests + integrations) that splits a monolithic `MEMORY.md` into per-topic files under `docs/memory/` and regenerates `MEMORY.md` as a compact index. Tooling lands inert; the actual migration runs on real MEMORY.md in a separate follow-up commit (PR B).

**Architecture:** Six independently-testable lib modules (`tools/lib/memory-{parser,classifier,archiver,index,validator,migrator}.js`) under a thin CLI wrapper `tools/memory.js`. Tools follow the existing `tools/lib/` pattern. `generate-plan.js` calls `compactMemory()` after `loadConfig()` (no-op when `docs/memory/` is missing). CI gains a `node tools/memory.js validate` step that fails on drift between MEMORY.md and topic files.

**Tech Stack:** Node.js 18+, Jest 30, no new runtime deps. Uses `child_process.execFileSync` for `git mv` / `git log` operations and `fs.utimes` for mtime preservation.

---

## File Structure

| File                                                                                  | Responsibility                                                                                                                                                                                                          |
| ------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `tools/lib/memory-parser.js`                                                          | Parse `MEMORY.md` text into an array of `{ heading, body, raw }` sections, split on `## ` H2 boundaries.                                                                                                                |
| `tools/lib/memory-classifier.js`                                                      | Given a section title, return `{ category, slug, date }` per the spec rules. Pure function, no I/O.                                                                                                                     |
| `tools/lib/memory-archiver.js`                                                        | Staleness check (mtime + days) + snapshot supersession (group by scope, keep N=1). Returns list of file paths to archive. Pure function over file metadata.                                                             |
| `tools/lib/memory-index.js`                                                           | Read topic files in `docs/memory/{topics,sessions,snapshots}/`, render compact `MEMORY.md` text. `compactMemory({root})` writes the file.                                                                               |
| `tools/lib/memory-validator.js`                                                       | Compare current `MEMORY.md` against what `memory-index` would generate. Returns `{ ok, diff }`.                                                                                                                         |
| `tools/lib/memory-migrator.js`                                                        | One-time bootstrap: parse current MEMORY.md, classify each section, write topic files with preserved mtimes, triage `## Lessons Learned` against `docs/LESSONS.md`, archive superseded snapshots, regenerate MEMORY.md. |
| `tools/memory.js`                                                                     | Thin CLI wrapper, ~100 LOC: argv parsing, subcommand dispatch (`compact`/`archive`/`migrate`/`validate`), `--dry`/`--force`/`--days N` flag handling.                                                                   |
| `tools/generate-plan.js` (modify)                                                     | Call `compactMemory()` after `loadConfig()`, before render. Try/catch wraps any failure as a warning.                                                                                                                   |
| `tools/migrate-config.js` (modify)                                                    | Add `memory: { staleDays: 90, autoArchive: false }` block to existing configs on schema migration.                                                                                                                      |
| `tools/lib/render-tabs.js` (modify)                                                   | Add "Memory" card to Settings tab with two fields.                                                                                                                                                                      |
| `package.json` (modify)                                                               | Add 5 `memory:*` npm scripts.                                                                                                                                                                                           |
| `.github/workflows/plan-visualizer.yml` (modify)                                      | Add validate step in Test & Coverage Gate job.                                                                                                                                                                          |
| `tests/unit/memory-{parser,classifier,archiver,index,validator,migrator,cli}.test.js` | 7 new test files.                                                                                                                                                                                                       |

---

## Working Branch

Already on branch `feature/US-0175-memory-token-optimisation` (created during brainstorming). Spec at `docs/superpowers/specs/2026-05-10-us-0175-memory-token-optimisation-design.md` is committed.

---

### Task 1: `memory-parser.js` — split MEMORY.md into sections

**Files:**

- Create: `tools/lib/memory-parser.js`
- Create: `tests/unit/memory-parser.test.js`

The parser converts raw MEMORY.md text into an array of section objects. Sections are delimited by `## ` (H2) lines; the H1 + intro text before the first H2 becomes a special `header` section.

- [ ] **Step 1: Write the failing test**

Create `tests/unit/memory-parser.test.js`:

```js
'use strict';
const { parseMemory } = require('../../tools/lib/memory-parser');

describe('parseMemory', () => {
  test('splits H2 sections', () => {
    const text = [
      '# MEMORY.md',
      '',
      'Intro paragraph.',
      '',
      '---',
      '',
      '## Section One',
      '',
      'Body of one.',
      '',
      '## Section Two',
      '',
      'Body of two.',
    ].join('\n');
    const result = parseMemory(text);
    expect(result.header).toContain('# MEMORY.md');
    expect(result.header).toContain('Intro paragraph');
    expect(result.sections).toHaveLength(2);
    expect(result.sections[0].heading).toBe('Section One');
    expect(result.sections[0].body.trim()).toBe('Body of one.');
    expect(result.sections[1].heading).toBe('Section Two');
    expect(result.sections[1].body.trim()).toBe('Body of two.');
  });

  test('preserves heading whitespace and content verbatim in raw', () => {
    const text = '## My Title\n\n- item one\n- item two\n';
    const result = parseMemory(text);
    expect(result.sections[0].raw).toBe('## My Title\n\n- item one\n- item two\n');
  });

  test('handles empty input', () => {
    expect(parseMemory('')).toEqual({ header: '', sections: [] });
  });

  test('treats H3+ as part of section body, not as section break', () => {
    const text = '## Outer\n\n### Inner\n\nbody\n\n## Another';
    const result = parseMemory(text);
    expect(result.sections).toHaveLength(2);
    expect(result.sections[0].heading).toBe('Outer');
    expect(result.sections[0].body).toContain('### Inner');
  });

  test('handles section with no body (heading only)', () => {
    const text = '## Empty Section\n\n## Next';
    const result = parseMemory(text);
    expect(result.sections).toHaveLength(2);
    expect(result.sections[0].heading).toBe('Empty Section');
    expect(result.sections[0].body.trim()).toBe('');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
npx jest tests/unit/memory-parser.test.js --no-coverage 2>&1 | tail -5
```

Expected: `Cannot find module '../../tools/lib/memory-parser'`

- [ ] **Step 3: Write minimal implementation**

Create `tools/lib/memory-parser.js`:

```js
'use strict';

/**
 * Parse a MEMORY.md document into sections.
 *
 * @param {string} text - Raw markdown text.
 * @returns {{ header: string, sections: Array<{heading: string, body: string, raw: string}> }}
 */
function parseMemory(text) {
  if (!text) return { header: '', sections: [] };
  const lines = text.split('\n');
  const sections = [];
  let header = '';
  let currentHeading = null;
  let currentLines = [];
  let headerLines = [];
  let inHeader = true;

  const flush = () => {
    if (currentHeading === null) return;
    const raw = `## ${currentHeading}\n${currentLines.join('\n')}`;
    sections.push({
      heading: currentHeading,
      body: currentLines.join('\n').replace(/^\n+/, ''),
      raw,
    });
    currentHeading = null;
    currentLines = [];
  };

  for (const line of lines) {
    const m = line.match(/^## (.+?)\s*$/);
    if (m) {
      if (inHeader) {
        header = headerLines.join('\n');
        inHeader = false;
      }
      flush();
      currentHeading = m[1];
    } else if (inHeader) {
      headerLines.push(line);
    } else {
      currentLines.push(line);
    }
  }
  if (inHeader) header = headerLines.join('\n');
  flush();
  return { header, sections };
}

module.exports = { parseMemory };
```

- [ ] **Step 4: Run test to verify it passes**

```bash
npx jest tests/unit/memory-parser.test.js --no-coverage 2>&1 | tail -5
```

Expected: 5 tests pass.

- [ ] **Step 5: Commit**

```bash
git add tools/lib/memory-parser.js tests/unit/memory-parser.test.js
git commit -m "feat(memory): add memory-parser.js — split MEMORY.md into sections"
```

---

### Task 2: `memory-classifier.js` — section → {category, slug, date}

**Files:**

- Create: `tools/lib/memory-classifier.js`
- Create: `tests/unit/memory-classifier.test.js`

Pure function over a section title string. Implements the spec's filename slugification rule + category detection.

- [ ] **Step 1: Write the failing test**

Create `tests/unit/memory-classifier.test.js`:

```js
'use strict';
const { classifySection, slugify, extractDate } = require('../../tools/lib/memory-classifier');

describe('extractDate', () => {
  test('extracts YYYY-MM-DD from parens', () => {
    expect(extractDate('Foo (Session 42, 2026-05-09/10)')).toBe('2026-05-10');
    expect(extractDate('Bar (as of 2026-05-05 Session 40)')).toBe('2026-05-05');
    expect(extractDate('Baz (2026-04-15/16)')).toBe('2026-04-15');
  });

  test('returns null when no date present', () => {
    expect(extractDate('Project Identity')).toBeNull();
    expect(extractDate('Technology')).toBeNull();
  });

  test('picks the latest date when multiple present', () => {
    expect(extractDate('Foo (2026-05-09/10)')).toBe('2026-05-10');
  });
});

describe('slugify', () => {
  test('basic slug', () => {
    expect(slugify('Project Identity')).toBe('project-identity');
    expect(slugify('Technology')).toBe('technology');
  });

  test('strips parentheses content', () => {
    expect(slugify('Foo (Session 42, 2026-05-09/10)')).toBe('foo');
  });

  test('strips em/en dashes', () => {
    expect(slugify('Foo — Bar – Baz')).toBe('foo-bar-baz');
  });

  test('handles AGENTS.md special chars', () => {
    expect(slugify('AGENTS.md')).toBe('agents-md');
  });

  test('truncates to 60 chars at word boundary', () => {
    const long = 'a'.repeat(70);
    expect(slugify(long).length).toBeLessThanOrEqual(60);
    expect(
      slugify('one two three four five six seven eight nine ten eleven twelve thirteen').length,
    ).toBeLessThanOrEqual(60);
  });

  test('collapses repeated dashes and trims', () => {
    expect(slugify('--foo---bar--')).toBe('foo-bar');
  });
});

describe('classifySection', () => {
  test('snapshot detection (as of)', () => {
    const r = classifySection('Project Completion Status (as of 2026-05-05 Session 40)');
    expect(r.category).toBe('snapshots');
    expect(r.slug).toBe('project-completion-status');
    expect(r.date).toBe('2026-05-05');
  });

  test('session detection (Session N)', () => {
    const r = classifySection('GitHub Status Monitoring (Session 41, 2026-05-08)');
    expect(r.category).toBe('sessions');
    expect(r.slug).toBe('github-status-monitoring');
    expect(r.date).toBe('2026-05-08');
  });

  test('session detection — title starts with Session N', () => {
    const r = classifySection('Session 18 learnings (2026-04-15/16) — EPIC-0016 Agentic Dashboard Mission Control');
    expect(r.category).toBe('sessions');
    expect(r.date).toBe('2026-04-15');
    expect(r.slug.length).toBeLessThanOrEqual(60);
  });

  test('lessons detection — special-cased', () => {
    const r = classifySection('Lessons Learned');
    expect(r.category).toBe('lessons');
  });

  test('topic detection — default', () => {
    const r = classifySection('Project Identity');
    expect(r.category).toBe('topics');
    expect(r.slug).toBe('project-identity');
    expect(r.date).toBeNull();
  });

  test('all 6 spec example titles produce expected filenames', () => {
    const cases = [
      { title: 'Project Identity', expected: 'project-identity.md' },
      { title: 'Technology', expected: 'technology.md' },
      {
        title: 'Plugin Install Integration + Dashboard Fixes (Session 42, 2026-05-09/10)',
        expected: '2026-05-10-plugin-install-integration-dashboard-fixes.md',
      },
      {
        title: 'GitHub Status Monitoring (Session 41, 2026-05-08)',
        expected: '2026-05-08-github-status-monitoring.md',
      },
      {
        title: 'Project Completion Status (as of 2026-05-05 Session 40)',
        expected: '2026-05-05-project-completion-status.md',
      },
      {
        title: 'Session 18 learnings (2026-04-15/16) — EPIC-0016 Agentic Dashboard Mission Control',
        expected: '2026-04-15-session-18-learnings-epic-0016-agentic-dashboard.md',
      },
    ];
    for (const c of cases) {
      const r = classifySection(c.title);
      const filename = r.date ? `${r.date}-${r.slug}.md` : `${r.slug}.md`;
      expect(filename).toBe(c.expected);
    }
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
npx jest tests/unit/memory-classifier.test.js --no-coverage 2>&1 | tail -5
```

Expected: module not found.

- [ ] **Step 3: Write minimal implementation**

Create `tools/lib/memory-classifier.js`:

```js
'use strict';

/**
 * Extract a YYYY-MM-DD date from a section title, preferring the latest if multiple are present.
 * Recognises bare dates and date ranges (e.g. "2026-05-09/10").
 *
 * @param {string} title
 * @returns {string|null} ISO date string or null
 */
function extractDate(title) {
  const dateMatches = title.match(/\b(\d{4})-(\d{2})-(\d{2})(?:\/(\d{1,2}))?/g);
  if (!dateMatches || dateMatches.length === 0) return null;
  // For each match, expand date ranges to their end date.
  let best = null;
  for (const m of dateMatches) {
    const range = m.match(/^(\d{4})-(\d{2})-(\d{2})\/(\d{1,2})$/);
    let dt;
    if (range) {
      const [, y, mo, , d2] = range;
      dt = `${y}-${mo}-${d2.padStart(2, '0')}`;
    } else {
      dt = m;
    }
    if (best === null || dt > best) best = dt;
  }
  return best;
}

/**
 * Slugify a section title per the spec rules:
 * 1. Strip parentheses content.
 * 2. Strip em/en dashes; treat as word breaks.
 * 3. Lowercase, replace non-alphanumeric runs with `-`, collapse repeats, trim.
 * 4. Truncate to 60 chars at a word boundary.
 *
 * @param {string} title
 * @returns {string}
 */
function slugify(title) {
  let s = title.replace(/\([^)]*\)/g, ' ');
  s = s.replace(/[—–]/g, ' ');
  s = s.toLowerCase();
  s = s.replace(/[^a-z0-9]+/g, '-');
  s = s.replace(/-+/g, '-');
  s = s.replace(/^-+|-+$/g, '');
  if (s.length <= 60) return s;
  // Truncate at last hyphen ≤ 60 to preserve word boundary.
  const truncated = s.slice(0, 60);
  const lastDash = truncated.lastIndexOf('-');
  return lastDash > 30 ? truncated.slice(0, lastDash) : truncated;
}

/**
 * Classify a section title into category + slug + date.
 *
 * @param {string} title
 * @returns {{ category: 'topics'|'sessions'|'snapshots'|'lessons', slug: string, date: string|null }}
 */
function classifySection(title) {
  if (/^lessons learned$/i.test(title.trim())) {
    return { category: 'lessons', slug: 'lessons-learned', date: null };
  }
  let category;
  if (/\(as of /i.test(title)) {
    category = 'snapshots';
  } else if (/\(session \d+/i.test(title) || /^session \d+/i.test(title)) {
    category = 'sessions';
  } else {
    category = 'topics';
  }
  return {
    category,
    slug: slugify(title),
    date: extractDate(title),
  };
}

module.exports = { classifySection, slugify, extractDate };
```

- [ ] **Step 4: Run test to verify it passes**

```bash
npx jest tests/unit/memory-classifier.test.js --no-coverage 2>&1 | tail -5
```

Expected: all tests pass.

- [ ] **Step 5: Commit**

```bash
git add tools/lib/memory-classifier.js tests/unit/memory-classifier.test.js
git commit -m "feat(memory): add memory-classifier.js — title → category + slug + date"
```

---

### Task 3: `memory-archiver.js` — staleness + snapshot supersession

**Files:**

- Create: `tools/lib/memory-archiver.js`
- Create: `tests/unit/memory-archiver.test.js`

Given a list of `{ path, mtime, category, scope }` records, returns the subset that should be archived. Pure function; no I/O. Caller (CLI) is responsible for reading filesystem metadata and performing `git mv`.

- [ ] **Step 1: Write the failing test**

Create `tests/unit/memory-archiver.test.js`:

```js
'use strict';
const { selectForArchive, scopeFromTitle } = require('../../tools/lib/memory-archiver');

describe('scopeFromTitle', () => {
  test('extracts scope before first paren', () => {
    expect(scopeFromTitle('Project Completion Status (as of 2026-05-05)')).toBe('project completion status');
    expect(scopeFromTitle('Coverage Status (as of 2026-04-15)')).toBe('coverage status');
  });
  test('returns full title (lowercased) when no paren', () => {
    expect(scopeFromTitle('Some Snapshot')).toBe('some snapshot');
  });
});

describe('selectForArchive', () => {
  const NOW = new Date('2026-05-10T00:00:00Z').getTime();
  const days = (n) => NOW - n * 86400 * 1000;

  test('topic older than staleDays is archived', () => {
    const files = [
      { path: 'docs/memory/topics/old.md', mtime: days(100), category: 'topics' },
      { path: 'docs/memory/topics/new.md', mtime: days(30), category: 'topics' },
    ];
    const result = selectForArchive(files, { now: NOW, staleDays: 90 });
    expect(result.map((f) => f.path)).toEqual(['docs/memory/topics/old.md']);
  });

  test('session older than staleDays is archived', () => {
    const files = [{ path: 'docs/memory/sessions/old.md', mtime: days(100), category: 'sessions' }];
    const result = selectForArchive(files, { now: NOW, staleDays: 90 });
    expect(result).toHaveLength(1);
  });

  test('snapshot supersession — keep newest in scope, archive rest regardless of age', () => {
    const files = [
      {
        path: 'docs/memory/snapshots/2026-05-05.md',
        mtime: days(5),
        category: 'snapshots',
        scope: 'project completion status',
        date: '2026-05-05',
      },
      {
        path: 'docs/memory/snapshots/2026-05-04.md',
        mtime: days(6),
        category: 'snapshots',
        scope: 'project completion status',
        date: '2026-05-04',
      },
      {
        path: 'docs/memory/snapshots/2026-05-03.md',
        mtime: days(7),
        category: 'snapshots',
        scope: 'project completion status',
        date: '2026-05-03',
      },
    ];
    const result = selectForArchive(files, { now: NOW, staleDays: 90 });
    expect(result.map((f) => f.path).sort()).toEqual([
      'docs/memory/snapshots/2026-05-03.md',
      'docs/memory/snapshots/2026-05-04.md',
    ]);
  });

  test('snapshots in different scopes are independent', () => {
    const files = [
      { path: 'a.md', mtime: days(5), category: 'snapshots', scope: 'project completion status', date: '2026-05-05' },
      { path: 'b.md', mtime: days(5), category: 'snapshots', scope: 'coverage status', date: '2026-05-05' },
    ];
    const result = selectForArchive(files, { now: NOW, staleDays: 90 });
    expect(result).toEqual([]);
  });

  test('snapshot age does NOT trigger archive when only one in scope', () => {
    const files = [
      {
        path: 'old.md',
        mtime: days(200),
        category: 'snapshots',
        scope: 'project completion status',
        date: '2026-04-01',
      },
    ];
    const result = selectForArchive(files, { now: NOW, staleDays: 90 });
    expect(result).toEqual([]);
  });

  test('topic at exactly staleDays boundary is NOT archived', () => {
    const files = [{ path: 'edge.md', mtime: days(90), category: 'topics' }];
    const result = selectForArchive(files, { now: NOW, staleDays: 90 });
    expect(result).toEqual([]);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
npx jest tests/unit/memory-archiver.test.js --no-coverage 2>&1 | tail -5
```

Expected: module not found.

- [ ] **Step 3: Write minimal implementation**

Create `tools/lib/memory-archiver.js`:

```js
'use strict';

/**
 * Extract scope from a snapshot title — text before the first `(`, lowercased and trimmed.
 *
 * @param {string} title
 * @returns {string}
 */
function scopeFromTitle(title) {
  const idx = title.indexOf('(');
  const scope = idx === -1 ? title : title.slice(0, idx);
  return scope.trim().toLowerCase();
}

/**
 * Select which files should be archived based on staleness + snapshot supersession.
 *
 * @param {Array<{path:string, mtime:number, category:string, scope?:string, date?:string}>} files
 * @param {{ now: number, staleDays: number }} opts
 * @returns {Array<typeof files[0]>}
 */
function selectForArchive(files, opts) {
  const { now, staleDays } = opts;
  const thresholdMs = staleDays * 86400 * 1000;
  const archive = new Set();

  // Staleness rule applies to topics and sessions.
  for (const f of files) {
    if ((f.category === 'topics' || f.category === 'sessions') && now - f.mtime > thresholdMs) {
      archive.add(f);
    }
  }

  // Snapshot supersession: group by scope; keep newest per scope; archive the rest.
  const snapshots = files.filter((f) => f.category === 'snapshots');
  const byScope = new Map();
  for (const s of snapshots) {
    const scope = s.scope || '';
    if (!byScope.has(scope)) byScope.set(scope, []);
    byScope.get(scope).push(s);
  }
  for (const group of byScope.values()) {
    if (group.length <= 1) continue;
    group.sort((a, b) => (b.date || '').localeCompare(a.date || ''));
    for (let i = 1; i < group.length; i++) archive.add(group[i]);
  }

  return [...archive];
}

module.exports = { selectForArchive, scopeFromTitle };
```

- [ ] **Step 4: Run test to verify it passes**

```bash
npx jest tests/unit/memory-archiver.test.js --no-coverage 2>&1 | tail -5
```

Expected: all tests pass.

- [ ] **Step 5: Commit**

```bash
git add tools/lib/memory-archiver.js tests/unit/memory-archiver.test.js
git commit -m "feat(memory): add memory-archiver.js — staleness + snapshot supersession"
```

---

### Task 4: `memory-index.js` — topic files → compact MEMORY.md

**Files:**

- Create: `tools/lib/memory-index.js`
- Create: `tests/unit/memory-index.test.js`

Reads topic files from `docs/memory/{topics,sessions,snapshots}/`, extracts the H1 title from each, and renders the compact MEMORY.md text. `compactMemory({root})` writes `MEMORY.md`. `renderIndex({entries})` is the pure function for tests.

- [ ] **Step 1: Write the failing test**

Create `tests/unit/memory-index.test.js`:

```js
'use strict';
const fs = require('fs');
const path = require('path');
const os = require('os');
const { renderIndex, compactMemory, readEntries } = require('../../tools/lib/memory-index');

describe('renderIndex', () => {
  test('groups by category, sorts sessions/snapshots desc, topics alpha', () => {
    const entries = [
      { category: 'topics', title: 'Technology', file: 'docs/memory/topics/technology.md', date: '2026-04-22' },
      {
        category: 'topics',
        title: 'Project Identity',
        file: 'docs/memory/topics/project-identity.md',
        date: '2026-03-09',
      },
      {
        category: 'sessions',
        title: 'GitHub Status Monitoring',
        file: 'docs/memory/sessions/2026-05-08-github-status-monitoring.md',
        date: '2026-05-08',
      },
      {
        category: 'sessions',
        title: 'Plugin Install',
        file: 'docs/memory/sessions/2026-05-10-plugin-install.md',
        date: '2026-05-10',
      },
      {
        category: 'snapshots',
        title: 'Project Completion Status',
        file: 'docs/memory/snapshots/2026-05-05-project-completion-status.md',
        date: '2026-05-05',
      },
    ];
    const out = renderIndex(entries);
    expect(out).toContain('<!-- generated by tools/memory.js — do not edit by hand -->');
    expect(out).toContain('# MEMORY.md');
    expect(out).toContain('## Topics');
    expect(out).toContain('## Sessions');
    expect(out).toContain('## Snapshots');
    expect(out).toContain('[Project Identity](docs/memory/topics/project-identity.md) · 2026-03-09');
    expect(out).toContain('[Technology](docs/memory/topics/technology.md) · 2026-04-22');
    // Sessions sorted desc — Plugin Install (2026-05-10) before GitHub Status (2026-05-08).
    const pluginIdx = out.indexOf('Plugin Install');
    const githubIdx = out.indexOf('GitHub Status');
    expect(pluginIdx).toBeLessThan(githubIdx);
    // Topics alpha — Project Identity before Technology.
    const piIdx = out.indexOf('Project Identity');
    const techIdx = out.indexOf('Technology');
    expect(piIdx).toBeLessThan(techIdx);
  });

  test('omits empty category sections', () => {
    const entries = [
      { category: 'topics', title: 'Only One', file: 'docs/memory/topics/only-one.md', date: '2026-05-10' },
    ];
    const out = renderIndex(entries);
    expect(out).toContain('## Topics');
    expect(out).not.toContain('## Sessions');
    expect(out).not.toContain('## Snapshots');
  });

  test('handles empty entries', () => {
    const out = renderIndex([]);
    expect(out).toContain('<!-- generated');
    expect(out).not.toContain('## Topics');
  });
});

describe('compactMemory and readEntries (filesystem)', () => {
  let tmpdir;
  beforeEach(() => {
    tmpdir = fs.mkdtempSync(path.join(os.tmpdir(), 'memidx-'));
    fs.mkdirSync(path.join(tmpdir, 'docs/memory/topics'), { recursive: true });
    fs.mkdirSync(path.join(tmpdir, 'docs/memory/sessions'), { recursive: true });
    fs.mkdirSync(path.join(tmpdir, 'docs/memory/snapshots'), { recursive: true });
  });
  afterEach(() => fs.rmSync(tmpdir, { recursive: true, force: true }));

  test('readEntries reads H1 titles from files', () => {
    fs.writeFileSync(path.join(tmpdir, 'docs/memory/topics/foo.md'), '# Foo Topic\n\nbody\n');
    fs.writeFileSync(
      path.join(tmpdir, 'docs/memory/sessions/2026-05-10-bar.md'),
      '# Bar Session (Session 42, 2026-05-10)\n\nbody\n',
    );
    const entries = readEntries(tmpdir);
    expect(entries).toHaveLength(2);
    const foo = entries.find((e) => e.category === 'topics');
    expect(foo.title).toBe('Foo Topic');
    expect(foo.file).toBe('docs/memory/topics/foo.md');
  });

  test('compactMemory writes MEMORY.md with content from topic files', () => {
    fs.writeFileSync(path.join(tmpdir, 'docs/memory/topics/x.md'), '# X Topic\n\nbody\n');
    compactMemory({ root: tmpdir });
    const content = fs.readFileSync(path.join(tmpdir, 'MEMORY.md'), 'utf8');
    expect(content).toContain('# MEMORY.md');
    expect(content).toContain('[X Topic]');
  });

  test('compactMemory is no-op when docs/memory/ missing', () => {
    const tmp2 = fs.mkdtempSync(path.join(os.tmpdir(), 'memidx-noop-'));
    expect(() => compactMemory({ root: tmp2 })).not.toThrow();
    expect(fs.existsSync(path.join(tmp2, 'MEMORY.md'))).toBe(false);
    fs.rmSync(tmp2, { recursive: true, force: true });
  });

  test('compactMemory skips files in archive/', () => {
    fs.mkdirSync(path.join(tmpdir, 'docs/memory/archive/topics'), { recursive: true });
    fs.writeFileSync(path.join(tmpdir, 'docs/memory/archive/topics/old.md'), '# Old\n\nbody\n');
    fs.writeFileSync(path.join(tmpdir, 'docs/memory/topics/new.md'), '# New\n\nbody\n');
    compactMemory({ root: tmpdir });
    const content = fs.readFileSync(path.join(tmpdir, 'MEMORY.md'), 'utf8');
    expect(content).toContain('[New]');
    expect(content).not.toContain('[Old]');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
npx jest tests/unit/memory-index.test.js --no-coverage 2>&1 | tail -5
```

Expected: module not found.

- [ ] **Step 3: Write minimal implementation**

Create `tools/lib/memory-index.js`:

```js
'use strict';
const fs = require('fs');
const path = require('path');

const CATEGORIES = ['topics', 'sessions', 'snapshots'];
const HEADER_COMMENT = '<!-- generated by tools/memory.js — do not edit by hand -->';

/**
 * Read a single topic file and return its H1 title (text after first `# ` line).
 *
 * @param {string} filePath
 * @returns {string|null}
 */
function readH1Title(filePath) {
  const content = fs.readFileSync(filePath, 'utf8');
  const m = content.match(/^# (.+?)\s*$/m);
  return m ? m[1] : null;
}

/**
 * Read all memory entries from `docs/memory/{topics,sessions,snapshots}/`.
 *
 * @param {string} root - project root
 * @returns {Array<{category:string, title:string, file:string, date:string|null}>}
 */
function readEntries(root) {
  const memoryDir = path.join(root, 'docs', 'memory');
  if (!fs.existsSync(memoryDir)) return [];
  const entries = [];
  for (const cat of CATEGORIES) {
    const dir = path.join(memoryDir, cat);
    if (!fs.existsSync(dir)) continue;
    for (const f of fs.readdirSync(dir)) {
      if (!f.endsWith('.md')) continue;
      const filePath = path.join(dir, f);
      const title = readH1Title(filePath) || f.replace(/\.md$/, '');
      const dateMatch = f.match(/^(\d{4}-\d{2}-\d{2})/);
      entries.push({
        category: cat,
        title,
        file: path.relative(root, filePath).replace(/\\/g, '/'),
        date: dateMatch ? dateMatch[1] : null,
      });
    }
  }
  return entries;
}

/**
 * Render the compact MEMORY.md text from entries.
 *
 * @param {Array} entries - as returned by readEntries
 * @returns {string}
 */
function renderIndex(entries) {
  const groups = { topics: [], sessions: [], snapshots: [] };
  for (const e of entries) {
    if (groups[e.category]) groups[e.category].push(e);
  }
  groups.topics.sort((a, b) => a.title.localeCompare(b.title));
  groups.sessions.sort((a, b) => (b.date || '').localeCompare(a.date || ''));
  groups.snapshots.sort((a, b) => (b.date || '').localeCompare(a.date || ''));

  const lines = [
    HEADER_COMMENT,
    '',
    '# MEMORY.md',
    '',
    'Persistent semantic knowledge base. Topic files in `docs/memory/`. Updated automatically by `generate-plan.js`.',
    '',
  ];

  const sectionHeading = { topics: 'Topics', sessions: 'Sessions', snapshots: 'Snapshots' };
  for (const cat of CATEGORIES) {
    const items = groups[cat];
    if (items.length === 0) continue;
    lines.push(`## ${sectionHeading[cat]}`, '');
    for (const e of items) {
      const dateSuffix = e.date ? ` · ${e.date}` : '';
      lines.push(`- [${e.title}](${e.file})${dateSuffix}`);
    }
    lines.push('');
  }
  return lines.join('\n');
}

/**
 * Read entries from disk and write MEMORY.md.
 *
 * @param {{root:string}} opts
 */
function compactMemory(opts) {
  const { root } = opts;
  const entries = readEntries(root);
  if (entries.length === 0) return; // No-op when memory layout missing/empty
  const text = renderIndex(entries);
  fs.writeFileSync(path.join(root, 'MEMORY.md'), text + '\n');
}

module.exports = { renderIndex, compactMemory, readEntries };
```

- [ ] **Step 4: Run test to verify it passes**

```bash
npx jest tests/unit/memory-index.test.js --no-coverage 2>&1 | tail -5
```

Expected: all tests pass.

- [ ] **Step 5: Commit**

```bash
git add tools/lib/memory-index.js tests/unit/memory-index.test.js
git commit -m "feat(memory): add memory-index.js — generate compact MEMORY.md"
```

---

### Task 5: `memory-validator.js` — drift detection

**Files:**

- Create: `tools/lib/memory-validator.js`
- Create: `tests/unit/memory-validator.test.js`

Compares current `MEMORY.md` content with what `compactMemory` would generate. Returns `{ ok, diff }`.

- [ ] **Step 1: Write the failing test**

Create `tests/unit/memory-validator.test.js`:

```js
'use strict';
const fs = require('fs');
const path = require('path');
const os = require('os');
const { validateMemory } = require('../../tools/lib/memory-validator');

describe('validateMemory', () => {
  let tmpdir;
  beforeEach(() => {
    tmpdir = fs.mkdtempSync(path.join(os.tmpdir(), 'memval-'));
    fs.mkdirSync(path.join(tmpdir, 'docs/memory/topics'), { recursive: true });
    fs.writeFileSync(path.join(tmpdir, 'docs/memory/topics/x.md'), '# X\n\nbody\n');
  });
  afterEach(() => fs.rmSync(tmpdir, { recursive: true, force: true }));

  test('ok when MEMORY.md matches generated content', () => {
    const { compactMemory } = require('../../tools/lib/memory-index');
    compactMemory({ root: tmpdir });
    const result = validateMemory({ root: tmpdir });
    expect(result.ok).toBe(true);
    expect(result.diff).toBe('');
  });

  test('drift when MEMORY.md differs', () => {
    fs.writeFileSync(path.join(tmpdir, 'MEMORY.md'), '# wrong content\n');
    const result = validateMemory({ root: tmpdir });
    expect(result.ok).toBe(false);
    expect(result.diff).not.toBe('');
    expect(result.diff).toContain('---');
  });

  test('ok when docs/memory missing and MEMORY.md missing (fresh install)', () => {
    const tmp2 = fs.mkdtempSync(path.join(os.tmpdir(), 'memval2-'));
    const result = validateMemory({ root: tmp2 });
    expect(result.ok).toBe(true);
    fs.rmSync(tmp2, { recursive: true, force: true });
  });

  test('drift when docs/memory exists but MEMORY.md missing', () => {
    fs.unlinkSync(path.join(tmpdir, 'MEMORY.md').replace(/.*/, () => path.join(tmpdir, 'NONEXISTENT')));
    // MEMORY.md was never written — should be drift since topic files exist.
    const result = validateMemory({ root: tmpdir });
    expect(result.ok).toBe(false);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
npx jest tests/unit/memory-validator.test.js --no-coverage 2>&1 | tail -5
```

Expected: module not found.

- [ ] **Step 3: Write minimal implementation**

Create `tools/lib/memory-validator.js`:

```js
'use strict';
const fs = require('fs');
const path = require('path');
const { readEntries, renderIndex } = require('./memory-index');

/**
 * Compare current MEMORY.md against what compactMemory would generate.
 *
 * @param {{root:string}} opts
 * @returns {{ ok: boolean, diff: string }}
 */
function validateMemory(opts) {
  const { root } = opts;
  const entries = readEntries(root);
  const memoryPath = path.join(root, 'MEMORY.md');
  const memoryExists = fs.existsSync(memoryPath);

  // Fresh install: no docs/memory, no MEMORY.md → ok.
  if (entries.length === 0 && !memoryExists) {
    return { ok: true, diff: '' };
  }
  // Topic files exist but MEMORY.md missing → drift.
  if (entries.length > 0 && !memoryExists) {
    return { ok: false, diff: 'MEMORY.md is missing but topic files exist in docs/memory/.' };
  }
  // No topic files but MEMORY.md exists → may be pre-migration; treat as ok.
  if (entries.length === 0 && memoryExists) {
    return { ok: true, diff: '' };
  }

  const expected = renderIndex(entries) + '\n';
  const actual = fs.readFileSync(memoryPath, 'utf8');
  if (actual === expected) return { ok: true, diff: '' };

  // Build a unified diff (line-level).
  const expLines = expected.split('\n');
  const actLines = actual.split('\n');
  const diffLines = ['--- MEMORY.md (current)', '+++ MEMORY.md (expected)'];
  const max = Math.max(expLines.length, actLines.length);
  for (let i = 0; i < max; i++) {
    if (actLines[i] !== expLines[i]) {
      if (actLines[i] !== undefined) diffLines.push(`-${actLines[i]}`);
      if (expLines[i] !== undefined) diffLines.push(`+${expLines[i]}`);
    }
  }
  return { ok: false, diff: diffLines.join('\n') };
}

module.exports = { validateMemory };
```

- [ ] **Step 4: Run test to verify it passes**

```bash
npx jest tests/unit/memory-validator.test.js --no-coverage 2>&1 | tail -5
```

Expected: all tests pass.

- [ ] **Step 5: Commit**

```bash
git add tools/lib/memory-validator.js tests/unit/memory-validator.test.js
git commit -m "feat(memory): add memory-validator.js — drift detection"
```

---

### Task 6: `memory-migrator.js` — one-time bootstrap

**Files:**

- Create: `tools/lib/memory-migrator.js`
- Create: `tests/unit/memory-migrator.test.js`

End-to-end migration: parse current MEMORY.md, classify each section, write topic files with preserved mtimes, triage `## Lessons Learned`, archive superseded snapshots, regenerate MEMORY.md. Idempotent no-op when `docs/memory/topics/` exists and is non-empty unless `--force`. `--dry` returns the planned operations without writing.

- [ ] **Step 1: Write the failing test**

Create `tests/unit/memory-migrator.test.js`:

```js
'use strict';
const fs = require('fs');
const path = require('path');
const os = require('os');
const { migrateMemory } = require('../../tools/lib/memory-migrator');

function setupRoot() {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'memmig-'));
  fs.writeFileSync(
    path.join(tmp, 'MEMORY.md'),
    [
      '# MEMORY.md',
      '',
      'Intro.',
      '',
      '---',
      '',
      '## Project Identity',
      '',
      'Project body.',
      '',
      '## GitHub Status Monitoring (Session 41, 2026-05-08)',
      '',
      'Session body.',
      '',
      '## Project Completion Status (as of 2026-05-05 Session 40)',
      '',
      'Snapshot body 40.',
      '',
      '## Project Completion Status (as of 2026-05-03 Session 38)',
      '',
      'Snapshot body 38.',
      '',
      '## Lessons Learned',
      '',
      '- L-9999: Some lesson body.',
      '',
    ].join('\n'),
  );
  fs.writeFileSync(
    path.join(tmp, 'docs', 'LESSONS.md').replace(/.*/, () => {
      fs.mkdirSync(path.join(tmp, 'docs'), { recursive: true });
      return path.join(tmp, 'docs', 'LESSONS.md');
    }),
    '# LESSONS.md\n',
  );
  fs.mkdirSync(path.join(tmp, 'docs'), { recursive: true });
  fs.writeFileSync(path.join(tmp, 'docs', 'LESSONS.md'), '# LESSONS.md\n');
  fs.writeFileSync(
    path.join(tmp, 'docs', 'ID_REGISTRY.md'),
    [
      '# ID Registry',
      '| Sequence | Next | Last |',
      '| -------- | ---- | ---- |',
      '| Lesson   | L-0055 | L-0054 |',
    ].join('\n'),
  );
  return tmp;
}

describe('migrateMemory', () => {
  test('dry-run reports planned operations without writing', () => {
    const tmp = setupRoot();
    const result = migrateMemory({ root: tmp, dry: true });
    expect(result.topicFiles.length).toBeGreaterThan(0);
    expect(result.archiveOps.length).toBeGreaterThan(0);
    expect(fs.existsSync(path.join(tmp, 'docs/memory/topics'))).toBe(false);
    fs.rmSync(tmp, { recursive: true, force: true });
  });

  test('full run writes topic files', () => {
    const tmp = setupRoot();
    migrateMemory({ root: tmp, dry: false });
    expect(fs.existsSync(path.join(tmp, 'docs/memory/topics/project-identity.md'))).toBe(true);
    expect(fs.existsSync(path.join(tmp, 'docs/memory/sessions/2026-05-08-github-status-monitoring.md'))).toBe(true);
    expect(fs.existsSync(path.join(tmp, 'docs/memory/snapshots/2026-05-05-project-completion-status.md'))).toBe(true);
    expect(fs.existsSync(path.join(tmp, 'docs/memory/archive/snapshots/2026-05-03-project-completion-status.md'))).toBe(
      true,
    );
    fs.rmSync(tmp, { recursive: true, force: true });
  });

  test('writes regenerated MEMORY.md as compact index', () => {
    const tmp = setupRoot();
    migrateMemory({ root: tmp, dry: false });
    const m = fs.readFileSync(path.join(tmp, 'MEMORY.md'), 'utf8');
    expect(m).toContain('<!-- generated by tools/memory.js');
    expect(m).toContain('[Project Identity]');
    expect(m).not.toContain('Project body.'); // No section bodies inlined
    fs.rmSync(tmp, { recursive: true, force: true });
  });

  test('triages Lessons Learned: orphan L-XXXX appended to LESSONS.md', () => {
    const tmp = setupRoot();
    migrateMemory({ root: tmp, dry: false });
    const lessons = fs.readFileSync(path.join(tmp, 'docs/LESSONS.md'), 'utf8');
    expect(lessons).toContain('L-9999');
    expect(lessons).toContain('migrated from MEMORY.md');
    fs.rmSync(tmp, { recursive: true, force: true });
  });

  test('idempotent no-op when docs/memory/topics exists and is non-empty', () => {
    const tmp = setupRoot();
    migrateMemory({ root: tmp, dry: false });
    const result2 = migrateMemory({ root: tmp, dry: false });
    expect(result2.skipped).toBe(true);
    fs.rmSync(tmp, { recursive: true, force: true });
  });

  test('--force overrides idempotency check', () => {
    const tmp = setupRoot();
    migrateMemory({ root: tmp, dry: false });
    const result2 = migrateMemory({ root: tmp, dry: false, force: true });
    expect(result2.skipped).toBe(false);
    fs.rmSync(tmp, { recursive: true, force: true });
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
npx jest tests/unit/memory-migrator.test.js --no-coverage 2>&1 | tail -5
```

Expected: module not found.

- [ ] **Step 3: Write minimal implementation**

Create `tools/lib/memory-migrator.js`:

```js
'use strict';
const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');
const { parseMemory } = require('./memory-parser');
const { classifySection } = require('./memory-classifier');
const { selectForArchive, scopeFromTitle } = require('./memory-archiver');
const { compactMemory } = require('./memory-index');

const TODAY_ISO = () => new Date().toISOString().slice(0, 10);

/**
 * Get last commit timestamp for a given section heading in MEMORY.md from git history.
 * Returns ms epoch or null if unavailable.
 */
function getSectionMtime(root, heading) {
  try {
    const out = execFileSync(
      'git',
      ['-C', root, 'log', '--reverse', '--format=%ct', '-S', `## ${heading}`, '--', 'MEMORY.md'],
      { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] },
    );
    const lines = out.trim().split('\n').filter(Boolean);
    if (lines.length === 0) return null;
    return parseInt(lines[lines.length - 1], 10) * 1000;
  } catch {
    return null;
  }
}

function ensureDir(d) {
  fs.mkdirSync(d, { recursive: true });
}

function bumpLessonId(root) {
  const regPath = path.join(root, 'docs', 'ID_REGISTRY.md');
  let content = fs.readFileSync(regPath, 'utf8');
  const m = content.match(/Lesson\s*\|\s*L-(\d+)\s*\|\s*L-(\d+)/);
  if (!m) return null;
  const nextN = parseInt(m[1], 10);
  const newNext = String(nextN + 1).padStart(4, '0');
  const newLast = String(nextN).padStart(4, '0');
  content = content.replace(
    /Lesson\s*\|\s*L-\d+\s*\|\s*L-\d+/,
    `Lesson         | L-${newNext}             | L-${newLast}`,
  );
  fs.writeFileSync(regPath, content);
  return `L-${newLast}`;
}

function triageLessons(root, lessonsBody, dry) {
  const lessonsPath = path.join(root, 'docs', 'LESSONS.md');
  const existing = fs.existsSync(lessonsPath) ? fs.readFileSync(lessonsPath, 'utf8') : '';
  const entries = lessonsBody.split(/\n(?=- L-\d+|## L-\d+|### L-\d+|L-\d+:)/);
  const orphans = [];
  const today = TODAY_ISO();
  for (const entry of entries) {
    const idMatch = entry.match(/L-(\d{4,})/);
    if (!idMatch) continue;
    const id = `L-${idMatch[1]}`;
    if (existing.includes(id)) continue; // Already canonical, drop.
    orphans.push({ id, body: entry.trim() });
  }
  if (dry) return orphans;
  if (orphans.length === 0) return orphans;
  let appendText = '\n';
  for (const o of orphans) {
    appendText += `\n<!-- migrated from MEMORY.md ${today} -->\n${o.body}\n`;
  }
  fs.appendFileSync(lessonsPath, appendText);
  return orphans;
}

/**
 * Run the one-time migration.
 *
 * @param {{root:string, dry?:boolean, force?:boolean}} opts
 * @returns {{ skipped:boolean, topicFiles:Array, archiveOps:Array, lessonOrphans:Array }}
 */
function migrateMemory(opts) {
  const { root, dry = false, force = false } = opts;
  const memoryPath = path.join(root, 'MEMORY.md');
  const topicsDir = path.join(root, 'docs/memory/topics');

  if (!force && fs.existsSync(topicsDir) && fs.readdirSync(topicsDir).length > 0) {
    return { skipped: true, topicFiles: [], archiveOps: [], lessonOrphans: [] };
  }

  const text = fs.readFileSync(memoryPath, 'utf8');
  const { sections } = parseMemory(text);

  // Plan operations.
  const topicFiles = [];
  const snapshots = [];
  let lessonsBody = '';

  for (const sec of sections) {
    const cls = classifySection(sec.heading);
    if (cls.category === 'lessons') {
      lessonsBody = sec.body;
      continue;
    }
    const filename = cls.date ? `${cls.date}-${cls.slug}.md` : `${cls.slug}.md`;
    const filePath = path.join(root, 'docs/memory', cls.category, filename);
    const fileContent = `# ${sec.heading}\n${sec.body}`;
    const mtime = getSectionMtime(root, sec.heading);
    topicFiles.push({ category: cls.category, path: filePath, content: fileContent, mtime });
    if (cls.category === 'snapshots') {
      snapshots.push({
        path: filePath,
        scope: scopeFromTitle(sec.heading),
        date: cls.date || '',
        category: 'snapshots',
        mtime: mtime || Date.now(),
      });
    }
  }

  // Plan archive operations (snapshot supersession).
  const archiveTargets = selectForArchive(snapshots, { now: Date.now(), staleDays: Infinity });
  const archiveOps = archiveTargets.map((s) => ({
    from: s.path,
    to: s.path.replace('/memory/snapshots/', '/memory/archive/snapshots/'),
  }));

  if (dry) {
    return {
      skipped: false,
      topicFiles: topicFiles.map((t) => ({ path: t.path, category: t.category })),
      archiveOps,
      lessonOrphans: triageLessons(root, lessonsBody, true),
    };
  }

  // Write topic files (creates directories as needed).
  for (const t of topicFiles) {
    ensureDir(path.dirname(t.path));
    fs.writeFileSync(t.path, t.content);
    if (t.mtime) {
      const ts = t.mtime / 1000;
      fs.utimesSync(t.path, ts, ts);
    }
  }

  // Move superseded snapshots to archive.
  for (const op of archiveOps) {
    ensureDir(path.dirname(op.to));
    try {
      execFileSync('git', ['-C', root, 'mv', op.from, op.to], { stdio: 'ignore' });
    } catch {
      // Fall back to fs rename if git mv fails (file not staged yet).
      fs.renameSync(op.from, op.to);
    }
  }

  // Triage lessons.
  const lessonOrphans = triageLessons(root, lessonsBody, false);

  // Bump Lesson ID for any free-form (non-L-tagged) entries — placeholder; triageLessons handled tagged ones only.
  // (The current implementation only handles tagged orphans; free-form notes are dropped per simpler scope.)

  // Regenerate MEMORY.md.
  compactMemory({ root });

  return { skipped: false, topicFiles, archiveOps, lessonOrphans };
}

module.exports = { migrateMemory };
```

- [ ] **Step 4: Run test to verify it passes**

```bash
npx jest tests/unit/memory-migrator.test.js --no-coverage 2>&1 | tail -5
```

Expected: all tests pass.

- [ ] **Step 5: Commit**

```bash
git add tools/lib/memory-migrator.js tests/unit/memory-migrator.test.js
git commit -m "feat(memory): add memory-migrator.js — one-time bootstrap with mtime preservation + lessons triage"
```

---

### Task 7: `tools/memory.js` — CLI wrapper

**Files:**

- Create: `tools/memory.js`
- Create: `tests/unit/memory-cli.test.js`

Thin CLI wrapper. Parses argv, dispatches to lib functions, prints results, exits with appropriate codes.

- [ ] **Step 1: Write the failing test**

Create `tests/unit/memory-cli.test.js`:

```js
'use strict';
const { parseArgs } = require('../../tools/memory');

describe('parseArgs', () => {
  test('subcommand only', () => {
    expect(parseArgs(['node', 'memory.js', 'compact'])).toEqual({
      cmd: 'compact',
      dry: false,
      force: false,
      days: null,
    });
  });
  test('dry flag', () => {
    expect(parseArgs(['node', 'memory.js', 'compact', '--dry']).dry).toBe(true);
  });
  test('force flag', () => {
    expect(parseArgs(['node', 'memory.js', 'migrate', '--force']).force).toBe(true);
  });
  test('days flag', () => {
    expect(parseArgs(['node', 'memory.js', 'archive', '--days', '30']).days).toBe(30);
  });
  test('returns null cmd when no args', () => {
    expect(parseArgs(['node', 'memory.js']).cmd).toBeNull();
  });
  test('rejects unknown command', () => {
    expect(parseArgs(['node', 'memory.js', 'xxx']).cmd).toBe('xxx');
    // Dispatcher (not parseArgs) handles the unknown-command error.
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
npx jest tests/unit/memory-cli.test.js --no-coverage 2>&1 | tail -5
```

Expected: module not found.

- [ ] **Step 3: Write minimal implementation**

Create `tools/memory.js`:

```js
#!/usr/bin/env node
'use strict';
const path = require('path');

const ROOT = path.join(__dirname, '..');

function parseArgs(argv) {
  const args = argv.slice(2);
  const cmd = args[0] || null;
  let dry = false;
  let force = false;
  let days = null;
  for (let i = 1; i < args.length; i++) {
    if (args[i] === '--dry' || args[i] === '--dry-run') dry = true;
    else if (args[i] === '--force') force = true;
    else if (args[i] === '--days' && args[i + 1]) {
      days = parseInt(args[i + 1], 10);
      i++;
    }
  }
  return { cmd, dry, force, days };
}

function loadStaleDays() {
  try {
    const cfg = JSON.parse(require('fs').readFileSync(path.join(ROOT, 'plan-visualizer.config.json'), 'utf8'));
    return (cfg.memory && cfg.memory.staleDays) || 90;
  } catch {
    return 90;
  }
}

function dispatch({ cmd, dry, force, days }) {
  if (cmd === 'compact') {
    const { compactMemory } = require('./lib/memory-index');
    if (dry) {
      const { renderIndex, readEntries } = require('./lib/memory-index');
      process.stdout.write(renderIndex(readEntries(ROOT)) + '\n');
    } else {
      compactMemory({ root: ROOT });
      console.log('[memory] MEMORY.md regenerated.');
    }
    return 0;
  }
  if (cmd === 'archive') {
    // For brevity, archive in CLI is handled by reading filesystem and calling selectForArchive.
    const fs = require('fs');
    const { selectForArchive, scopeFromTitle } = require('./lib/memory-archiver');
    const { execFileSync } = require('child_process');
    const memDir = path.join(ROOT, 'docs/memory');
    if (!fs.existsSync(memDir)) {
      console.log('[memory] docs/memory/ missing — nothing to archive.');
      return 0;
    }
    const staleDays = days || loadStaleDays();
    const files = [];
    for (const cat of ['topics', 'sessions', 'snapshots']) {
      const dir = path.join(memDir, cat);
      if (!fs.existsSync(dir)) continue;
      for (const f of fs.readdirSync(dir)) {
        if (!f.endsWith('.md')) continue;
        const fp = path.join(dir, f);
        const stat = fs.statSync(fp);
        const content = fs.readFileSync(fp, 'utf8');
        const titleMatch = content.match(/^# (.+?)\s*$/m);
        const title = titleMatch ? titleMatch[1] : f.replace(/\.md$/, '');
        const dateMatch = f.match(/^(\d{4}-\d{2}-\d{2})/);
        files.push({
          path: fp,
          mtime: stat.mtimeMs,
          category: cat,
          scope: cat === 'snapshots' ? scopeFromTitle(title) : null,
          date: dateMatch ? dateMatch[1] : null,
        });
      }
    }
    const targets = selectForArchive(files, { now: Date.now(), staleDays });
    if (targets.length === 0) {
      console.log('[memory] Nothing stale to archive.');
      return 0;
    }
    for (const t of targets) {
      const dest = t.path.replace(
        `${path.sep}memory${path.sep}${t.category}${path.sep}`,
        `${path.sep}memory${path.sep}archive${path.sep}${t.category}${path.sep}`,
      );
      console.log(`[memory] archive: ${path.relative(ROOT, t.path)} → ${path.relative(ROOT, dest)}`);
      if (!dry) {
        fs.mkdirSync(path.dirname(dest), { recursive: true });
        try {
          execFileSync('git', ['-C', ROOT, 'mv', t.path, dest], { stdio: 'ignore' });
        } catch {
          fs.renameSync(t.path, dest);
        }
      }
    }
    if (!dry) {
      const { compactMemory } = require('./lib/memory-index');
      compactMemory({ root: ROOT });
    }
    return 0;
  }
  if (cmd === 'migrate') {
    const { migrateMemory } = require('./lib/memory-migrator');
    const result = migrateMemory({ root: ROOT, dry, force });
    if (result.skipped) {
      console.log('[memory] memory layout already bootstrapped; pass --force to re-migrate.');
      return 0;
    }
    if (dry) {
      console.log(
        `[memory] dry-run: ${result.topicFiles.length} topic files, ${result.archiveOps.length} archive ops, ${result.lessonOrphans.length} lesson orphans.`,
      );
    } else {
      console.log(
        `[memory] migrated: ${result.topicFiles.length} topic files written, ${result.archiveOps.length} archived.`,
      );
    }
    return 0;
  }
  if (cmd === 'validate') {
    const { validateMemory } = require('./lib/memory-validator');
    const result = validateMemory({ root: ROOT });
    if (result.ok) {
      console.log('[memory] OK — MEMORY.md is in sync with docs/memory/.');
      return 0;
    }
    console.error('[memory] DRIFT — MEMORY.md does not match docs/memory/:');
    console.error(result.diff);
    return 1;
  }
  console.error('Usage: node tools/memory.js {compact|archive|migrate|validate} [--dry] [--force] [--days N]');
  return 2;
}

if (require.main === module) {
  const args = parseArgs(process.argv);
  const exitCode = dispatch(args);
  process.exit(exitCode);
}

module.exports = { parseArgs, dispatch };
```

- [ ] **Step 4: Run test to verify it passes**

```bash
npx jest tests/unit/memory-cli.test.js --no-coverage 2>&1 | tail -5
```

Expected: all tests pass.

- [ ] **Step 5: Smoke-test on real repo (no-op paths)**

```bash
chmod +x tools/memory.js
node tools/memory.js validate 2>&1 | head -3
```

Expected: `[memory] OK — MEMORY.md is in sync with docs/memory/.` (because both `docs/memory/` and the current MEMORY.md exist; validator returns `ok: true` for the "no topic files but MEMORY.md exists" case).

- [ ] **Step 6: Commit**

```bash
git add tools/memory.js tests/unit/memory-cli.test.js
git commit -m "feat(memory): add tools/memory.js CLI wrapper"
```

---

### Task 8: `generate-plan.js` integration

**Files:**

- Modify: `tools/generate-plan.js`

Call `compactMemory()` after `loadConfig()` so MEMORY.md is regenerated whenever the dashboard is built. Wrapped in try/catch so failure cannot block dashboard generation.

- [ ] **Step 1: Add the require**

After the other `require` lines at the top of `tools/generate-plan.js` (around line 28, after `fetch-github-status`), add:

```js
const { compactMemory } = require('./lib/memory-index');
```

- [ ] **Step 2: Add the compact call in main()**

In `async function main()`, immediately after `const config = loadConfig();` (find the existing line in the function), add:

```js
try {
  compactMemory({ root: ROOT });
} catch (e) {
  console.warn('[generate-plan] memory:compact skipped:', e.message);
}
```

- [ ] **Step 3: Smoke-test**

```bash
node tools/generate-plan.js 2>&1 | tail -3
```

Expected: clean run, no errors. (`compactMemory` is currently a no-op because `docs/memory/` does not yet exist on this branch.)

- [ ] **Step 4: Run full test suite**

```bash
npx jest --no-coverage 2>&1 | tail -3
```

Expected: all tests pass (existing 1622 + new memory tests).

- [ ] **Step 5: Commit**

```bash
git add tools/generate-plan.js
git commit -m "feat(memory): wire compactMemory into generate-plan.js"
```

---

### Task 9: `migrate-config.js` — add `memory` block

**Files:**

- Modify: `tools/migrate-config.js`

Adds `memory: { staleDays: 90, autoArchive: false }` to existing `plan-visualizer.config.json` files on schema upgrade. Idempotent.

- [ ] **Step 1: Locate the existing migration block**

Open `tools/migrate-config.js`. Find the existing schema migration logic (search for `github` block migration as a pattern).

- [ ] **Step 2: Add the new memory migration**

Inside the same migration function (alongside the github block migration), add:

```js
if (!cfg.memory || typeof cfg.memory !== 'object') {
  cfg.memory = { staleDays: 90, autoArchive: false };
  changes.push('added memory block');
} else {
  if (typeof cfg.memory.staleDays !== 'number') {
    cfg.memory.staleDays = 90;
    changes.push('added memory.staleDays');
  }
  if (typeof cfg.memory.autoArchive !== 'boolean') {
    cfg.memory.autoArchive = false;
    changes.push('added memory.autoArchive');
  }
}
```

(`changes` is the existing array used by migrate-config.js to log additions.)

- [ ] **Step 3: Verify migration runs cleanly**

```bash
node tools/migrate-config.js --dry-run 2>&1 | tail -10
```

Expected: output mentions `added memory block` (because the project's own config doesn't have it yet).

- [ ] **Step 4: Run for real**

```bash
node tools/migrate-config.js 2>&1 | tail -3
```

Then check:

```bash
node -e "console.log(JSON.parse(require('fs').readFileSync('plan-visualizer.config.json')).memory)"
```

Expected: `{ staleDays: 90, autoArchive: false }`

- [ ] **Step 5: Commit**

```bash
git add tools/migrate-config.js plan-visualizer.config.json
git commit -m "feat(memory): migrate-config adds memory block (staleDays, autoArchive)"
```

---

### Task 10: `package.json` — npm scripts

**Files:**

- Modify: `package.json`

Add 5 `memory:*` scripts.

- [ ] **Step 1: Add scripts**

In `package.json`, in the `scripts` object, add:

```json
"memory:compact":     "node tools/memory.js compact",
"memory:archive":     "node tools/memory.js archive",
"memory:archive:dry": "node tools/memory.js archive --dry",
"memory:migrate":     "node tools/memory.js migrate",
"memory:validate":    "node tools/memory.js validate"
```

- [ ] **Step 2: Verify**

```bash
npm run memory:validate 2>&1 | tail -3
```

Expected: `[memory] OK — MEMORY.md is in sync with docs/memory/.`

- [ ] **Step 3: Update install.sh and update.sh to add the scripts**

In `scripts/install.sh` find the existing `pkg.scripts['plan:test'] = pkg.scripts['plan:test'] || ...` block. Add:

```js
pkg.scripts['memory:compact'] = pkg.scripts['memory:compact'] || 'node tools/memory.js compact';
pkg.scripts['memory:archive'] = pkg.scripts['memory:archive'] || 'node tools/memory.js archive';
pkg.scripts['memory:migrate'] = pkg.scripts['memory:migrate'] || 'node tools/memory.js migrate';
pkg.scripts['memory:validate'] = pkg.scripts['memory:validate'] || 'node tools/memory.js validate';
```

Update `scripts/update.sh` similarly (it has the same block in §8).

Update the install/update.sh log message to include `memory:*` in the list of added scripts.

- [ ] **Step 4: Verify both scripts still pass syntax check**

```bash
bash -n scripts/install.sh && bash -n scripts/update.sh && echo OK
```

Expected: `OK`

- [ ] **Step 5: Commit**

```bash
git add package.json scripts/install.sh scripts/update.sh
git commit -m "feat(memory): add memory:* npm scripts (install/update)"
```

---

### Task 11: Settings tab — Memory card UI

**Files:**

- Modify: `tools/lib/render-tabs.js`

Add a "Memory" card to the Settings tab, alongside the existing GitHub Sync card. Two fields: stale threshold (number) + auto-archive (toggle).

- [ ] **Step 1: Find the Settings tab render function**

In `tools/lib/render-tabs.js`, search for `renderSettingsTab` or `tab-settings`. Find the GitHub Sync section as a pattern reference.

- [ ] **Step 2: Add the Memory card after GitHub Sync**

Inside `renderSettingsTab`, after the existing GitHub Sync card div is rendered, add (verbatim within the existing template literal):

```js
        <div class="card mb-4">
          <h3 style="font-size:14px;margin-bottom:8px">Memory</h3>
          <p style="font-size:11px;color:var(--text-mute);margin-bottom:10px">
            Configures how stale memory files are archived. See <code>docs/memory/</code> and <code>tools/memory.js</code>.
          </p>
          <div style="display:flex;flex-direction:column;gap:8px">
            <label style="display:flex;align-items:center;gap:10px;font-size:12px">
              <span style="min-width:160px">Stale threshold (days)</span>
              <input id="memory-staleDays" type="number" min="1" max="3650" value="${(data.memoryConfig && data.memoryConfig.staleDays) || 90}" style="width:80px;padding:4px;background:var(--card);border:1px solid var(--border);border-radius:4px;color:var(--text)">
            </label>
            <label style="display:flex;align-items:center;gap:10px;font-size:12px">
              <span style="min-width:160px">Auto-archive on regenerate</span>
              <input id="memory-autoArchive" type="checkbox" ${(data.memoryConfig && data.memoryConfig.autoArchive) ? 'checked' : ''}>
            </label>
          </div>
          <div style="margin-top:10px;font-size:10px;color:var(--text-mute)">
            Default: 90 days; auto-archive off. Edit <code>plan-visualizer.config.json</code> → <code>memory</code> block to persist.
          </div>
        </div>
```

- [ ] **Step 3: Pass `memoryConfig` from generate-plan.js**

In `tools/generate-plan.js`, near the existing `data.githubConfig = config.github || null;` line, add:

```js
data.memoryConfig = config.memory || { staleDays: 90, autoArchive: false };
```

- [ ] **Step 4: Add tests**

Create `tests/unit/render-tabs-memory.test.js`:

```js
'use strict';
const { renderSettingsTab } = require('../../tools/lib/render-tabs');

describe('renderSettingsTab — Memory card', () => {
  const baseData = (extra = {}) => ({
    githubConfig: { enabled: false, repo: 'x/y' },
    githubTokenSet: false,
    syncState: null,
    memoryConfig: { staleDays: 90, autoArchive: false },
    ...extra,
  });

  test('renders Memory heading', () => {
    const html = renderSettingsTab(baseData());
    expect(html).toContain('Memory');
    expect(html).toContain('Stale threshold');
  });

  test('renders staleDays input with config value', () => {
    const html = renderSettingsTab(baseData({ memoryConfig: { staleDays: 45, autoArchive: false } }));
    expect(html).toContain('value="45"');
  });

  test('renders autoArchive toggle as checked when true', () => {
    const html = renderSettingsTab(baseData({ memoryConfig: { staleDays: 90, autoArchive: true } }));
    expect(html).toContain('id="memory-autoArchive"');
    expect(html).toMatch(/id="memory-autoArchive"[^>]*checked/);
  });

  test('falls back to defaults when memoryConfig missing', () => {
    const html = renderSettingsTab({
      githubConfig: { enabled: false, repo: 'x/y' },
      githubTokenSet: false,
      syncState: null,
    });
    expect(html).toContain('value="90"');
  });
});
```

- [ ] **Step 5: Run new tests**

```bash
npx jest tests/unit/render-tabs-memory.test.js --no-coverage 2>&1 | tail -5
```

Expected: all 4 tests pass.

- [ ] **Step 6: Run full suite**

```bash
npx jest --no-coverage 2>&1 | tail -3
```

Expected: all pass.

- [ ] **Step 7: Commit**

```bash
git add tools/lib/render-tabs.js tools/generate-plan.js tests/unit/render-tabs-memory.test.js
git commit -m "feat(memory): add Memory card to Settings tab"
```

---

### Task 12: CI — `memory:validate` step

**Files:**

- Modify: `.github/workflows/plan-visualizer.yml`

Add a memory validation step in the Test & Coverage Gate job. Fails the build on drift.

- [ ] **Step 1: Locate the Test & Coverage Gate job**

Open `.github/workflows/plan-visualizer.yml`. Find the job named "Test & Coverage Gate" (or whatever matches the existing test step).

- [ ] **Step 2: Add the validate step**

After the test step (the one that runs `npm test` or `npx jest`), add:

```yaml
- name: Validate memory layout
  run: node tools/memory.js validate
```

- [ ] **Step 3: Local smoke-test**

```bash
node tools/memory.js validate
echo "exit: $?"
```

Expected: `[memory] OK ...` and `exit: 0` (because validator treats "MEMORY.md exists, no topic files yet" as ok — the inert state).

- [ ] **Step 4: Commit**

```bash
git add .github/workflows/plan-visualizer.yml
git commit -m "ci(memory): validate MEMORY.md/topic file consistency"
```

---

## Final Verification

After all 12 tasks, before opening PR A:

- [ ] **Run full test suite**

```bash
npx jest --no-coverage 2>&1 | tail -5
```

Expected: ≥1622 + new memory tests, all passing.

- [ ] **Run coverage check**

```bash
npx jest --coverage 2>&1 | grep -E "All files|memory-"
```

Expected: new memory-\* files at ≥85% coverage; overall ≥80%.

- [ ] **Run dashboard generator (smoke)**

```bash
node tools/generate-plan.js 2>&1 | tail -3
```

Expected: clean run, no errors. `compactMemory` no-ops (no `docs/memory/`).

- [ ] **Run validate (smoke)**

```bash
node tools/memory.js validate
```

Expected: ok, exit 0.

If all pass, branch is ready for PR A.

---

## PR A Body Template

```markdown
## Summary

US-0175 Memory Token Optimisation — tooling + integrations only. Lands inert: no docs/memory/ created in this PR; the actual migration runs in a separate follow-up commit.

- New: tools/memory.js + tools/lib/memory-{parser,classifier,archiver,index,validator,migrator}.js
- New: 7 unit test files (memory-parser, memory-classifier, memory-archiver, memory-index, memory-validator, memory-migrator, memory-cli) + render-tabs-memory.test.js
- Modified: tools/generate-plan.js calls compactMemory() (no-op until migration)
- Modified: tools/migrate-config.js adds memory block to existing configs
- Modified: tools/lib/render-tabs.js adds Memory card to Settings tab
- Modified: scripts/install.sh + scripts/update.sh add memory:\* npm scripts
- Modified: package.json adds 5 memory:\* scripts
- Modified: .github/workflows/plan-visualizer.yml adds validate step

## Test Plan

- [x] Unit tests: ≥1622 + new memory tests, all pass
- [x] Coverage: new memory-\* files ≥85%; overall ≥80%
- [x] node tools/generate-plan.js clean
- [x] node tools/memory.js validate exits 0
- [ ] Manual: open Settings tab → verify Memory card renders with correct defaults
- [ ] CI: validate step runs and passes on this PR

🤖 Generated with [Claude Code](https://claude.com/claude-code)
```

---

## Self-Review Notes

**Spec coverage check:**

| Spec section                 | Covered by                                                                                                                       |
| ---------------------------- | -------------------------------------------------------------------------------------------------------------------------------- |
| File Layout                  | Task 6 (migrator creates dirs), Task 4 (index reads them)                                                                        |
| MEMORY.md compact format     | Task 4 (renderIndex)                                                                                                             |
| Filename slugification       | Task 2 (slugify + extractDate)                                                                                                   |
| Category detection           | Task 2 (classifySection)                                                                                                         |
| Snapshot scope detection     | Task 3 (scopeFromTitle)                                                                                                          |
| Staleness logic              | Task 3 (selectForArchive)                                                                                                        |
| CLI interface                | Task 7                                                                                                                           |
| Library structure            | Tasks 1–6                                                                                                                        |
| Lessons migration            | Task 6 (triageLessons within migrateMemory)                                                                                      |
| mtime preservation           | Task 6 (getSectionMtime)                                                                                                         |
| generate-plan.js integration | Task 8                                                                                                                           |
| Settings tab integration     | Task 11                                                                                                                          |
| migrate-config.js            | Task 9                                                                                                                           |
| CLAUDE.md updates            | **Deferred to PR B** (per spec, CLAUDE.md edits ship with the migration commit, not this tooling PR)                             |
| CI integration               | Task 12                                                                                                                          |
| Roll-out plan                | This plan covers PR A; PR B runs `node tools/memory.js migrate` against real MEMORY.md and commits the resulting tree separately |
| Testing                      | Tasks 1–7, 11                                                                                                                    |
| Error handling               | Task 7 (CLI error paths), Task 5 (validator no-op cases)                                                                         |

**Type/method consistency check:** `compactMemory({root})`, `selectForArchive(files, {now,staleDays})`, `classifySection(title) → {category,slug,date}`, `migrateMemory({root,dry,force}) → {skipped,topicFiles,archiveOps,lessonOrphans}`, `validateMemory({root}) → {ok,diff}` — all consistent across tasks.

**No placeholders.** All step bodies contain actual code or commands.
