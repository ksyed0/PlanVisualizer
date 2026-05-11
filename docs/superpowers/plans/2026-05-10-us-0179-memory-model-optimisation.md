# US-0179 Memory Model Optimisation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add `tools/memory.js suggest-model --task "<description>"` subcommand that recommends a Claude model (`haiku` or `sonnet`) based on topic complexity hints in `docs/memory/`. Add complexity badges to the compact MEMORY.md. Seed 12 existing topic files with hints.

**Architecture:** One new pure lib module (`memory-model-suggester.js`) for tokenisation + scoring + aggregation. Extend `memory-index.js` to surface `complexity` and `headBody` fields from each topic file. Extend `memory-validator.js` to warn on topic files missing complexity hints. Extend `memory-claude-md-patcher.js` (from US-0178) with a second patch function. Wire the new subcommand into `tools/memory.js`.

**Tech Stack:** Node.js 18+, Jest 30, no new dependencies.

**Depends on:** US-0178 must be merged first — this plan extends `memory-claude-md-patcher.js` and `memory-commit-orchestrator.js` created in US-0178.

---

## File Map

| File                                          | Change                                                                                                                      |
| --------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------- |
| `tools/lib/memory-model-suggester.js`         | New — pure suggester module (~120 LOC)                                                                                      |
| `tools/lib/memory-index.js`                   | Modify — `readEntries` returns `complexity` + `headBody`; `renderIndex` adds badges + legend                                |
| `tools/lib/memory-validator.js`               | Modify — return shape gains `warnings: string[]`; detect missing hints                                                      |
| `tools/lib/memory-claude-md-patcher.js`       | Modify — add `patchSuggestModelItem(text)` function                                                                         |
| `tools/lib/memory-commit-orchestrator.js`     | Modify — call new patch after existing `patchClaudeMd`                                                                      |
| `tools/memory.js`                             | Modify — `parseArgs` adds `--task` + `--json`; `dispatch` adds `suggest-model` branch; CLI prints `validateMemory` warnings |
| `package.json`                                | Modify — add `memory:suggest-model` npm script                                                                              |
| `docs/memory/topics/*.md` (12 files)          | Modify — add `<!-- complexity: ... -->` hint per spec heuristic                                                             |
| `tests/unit/memory-model-suggester.test.js`   | New — 15 tests                                                                                                              |
| `tests/unit/memory-index.test.js`             | Extend — +5 tests for complexity + headBody + badges + legend                                                               |
| `tests/unit/memory-validator.test.js`         | Extend — +2 tests for warnings field + missing-hint detection                                                               |
| `tests/unit/memory-claude-md-patcher.test.js` | Extend — +3 tests for `patchSuggestModelItem`                                                                               |
| `tests/unit/memory-cli.test.js`               | Extend — +5 tests for `--task` + `--json` + dispatch + JSON output                                                          |

---

## Working Branch

```bash
cd /Users/Kamal_Syed/Projects/PlanVisualizer
git checkout -b feature/US-0179-memory-model-optimisation
```

---

### Task 1: Extend `readEntries` with `complexity` and `headBody` fields

**Files:**

- Modify: `tools/lib/memory-index.js`
- Modify: `tests/unit/memory-index.test.js`

Existing `readEntries(root)` returns `{ category, title, file, date }`. Add `complexity` (parsed from `<!-- complexity: low|medium|high -->`) and `headBody` (first 5 content lines after H1, skipping HTML comment lines).

- [ ] **Step 1: Write failing tests**

Append to `tests/unit/memory-index.test.js` (find the existing `describe('readEntries')` block or add a new one):

```js
describe('readEntries — complexity + headBody', () => {
  let tmpdir;
  beforeEach(() => {
    tmpdir = fs.mkdtempSync(path.join(os.tmpdir(), 'memidx-c-'));
    fs.mkdirSync(path.join(tmpdir, 'docs/memory/topics'), { recursive: true });
  });
  afterEach(() => fs.rmSync(tmpdir, { recursive: true, force: true }));

  test('parses complexity hint (low/medium/high)', () => {
    fs.writeFileSync(path.join(tmpdir, 'docs/memory/topics/a.md'), '# A\n\n<!-- complexity: high -->\n\nbody\n');
    const entries = readEntries(tmpdir);
    expect(entries[0].complexity).toBe('high');
  });

  test('complexity hint is case-insensitive and whitespace-tolerant', () => {
    fs.writeFileSync(path.join(tmpdir, 'docs/memory/topics/b.md'), '# B\n\n<!--complexity:Low-->\n\nbody\n');
    const entries = readEntries(tmpdir);
    expect(entries[0].complexity).toBe('low');
  });

  test('returns complexity null when no hint present', () => {
    fs.writeFileSync(path.join(tmpdir, 'docs/memory/topics/c.md'), '# C\n\nbody only\n');
    const entries = readEntries(tmpdir);
    expect(entries[0].complexity).toBeNull();
  });

  test('returns headBody (first 5 content lines after H1, skips HTML comment lines)', () => {
    fs.writeFileSync(
      path.join(tmpdir, 'docs/memory/topics/d.md'),
      '# D\n\n<!-- complexity: low -->\n\nline 1\nline 2\nline 3\nline 4\nline 5\nline 6 (excluded)\n',
    );
    const entries = readEntries(tmpdir);
    const lines = entries[0].headBody.split('\n');
    expect(lines).toHaveLength(5);
    expect(lines[0]).toBe('line 1');
    expect(lines[4]).toBe('line 5');
    expect(entries[0].headBody).not.toContain('complexity'); // HTML comment line skipped
    expect(entries[0].headBody).not.toContain('line 6');
  });

  test('treats empty (whitespace-only) lines as non-content', () => {
    fs.writeFileSync(path.join(tmpdir, 'docs/memory/topics/e.md'), '# E\n\nline 1\n\n   \nline 2\nline 3\n');
    const entries = readEntries(tmpdir);
    const lines = entries[0].headBody.split('\n');
    expect(lines.filter((l) => l.trim()).length).toBeLessThanOrEqual(5);
    expect(entries[0].headBody).toContain('line 1');
    expect(entries[0].headBody).toContain('line 2');
  });
});
```

- [ ] **Step 2: Run to confirm failure**

```bash
cd /Users/Kamal_Syed/Projects/PlanVisualizer
npx jest tests/unit/memory-index.test.js --no-coverage -t "complexity" 2>&1 | tail -5
```

Expected: tests fail with `expect(entries[0].complexity)` getting `undefined`.

- [ ] **Step 3: Update `readEntries` in `tools/lib/memory-index.js`**

Find the existing `readEntries` function. Add a helper above it and update the body:

```js
const COMPLEXITY_REGEX = /<!--\s*complexity:\s*(low|medium|high)\s*-->/i;

function parseComplexity(content) {
  const m = content.match(COMPLEXITY_REGEX);
  return m ? m[1].toLowerCase() : null;
}

function extractHeadBody(content) {
  const lines = content.split('\n');
  // Find H1 line, then collect first 5 content lines after it.
  let pastH1 = false;
  const body = [];
  for (const line of lines) {
    if (!pastH1) {
      if (line.startsWith('# ')) pastH1 = true;
      continue;
    }
    if (!line.trim()) continue; // whitespace-only
    if (line.trim().startsWith('<!--') && line.trim().endsWith('-->')) continue; // HTML comment line
    body.push(line);
    if (body.length >= 5) break;
  }
  return body.join('\n');
}
```

Then update `readEntries` to use these helpers. Existing structure:

```js
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
      const content = fs.readFileSync(filePath, 'utf8'); // CHANGE: read content once, not just title
      const titleMatch = content.match(/^# (.+?)\s*$/m);
      const title = titleMatch ? titleMatch[1] : f.replace(/\.md$/, '');
      const dateMatch = f.match(/^(\d{4}-\d{2}-\d{2})/);
      entries.push({
        category: cat,
        title,
        file: path.relative(root, filePath).replace(/\\/g, '/'),
        date: dateMatch ? dateMatch[1] : null,
        complexity: parseComplexity(content), // NEW
        headBody: extractHeadBody(content), // NEW
      });
    }
  }
  return entries;
}
```

(The existing `readH1Title` helper is no longer needed for `readEntries` — the new code reads content once and extracts title inline. The helper can stay in the file if other callers use it.)

- [ ] **Step 4: Run tests to confirm pass**

```bash
npx jest tests/unit/memory-index.test.js --no-coverage 2>&1 | tail -5
```

Expected: all tests pass.

- [ ] **Step 5: Run full suite**

```bash
npx jest --no-coverage 2>&1 | tail -3
```

Expected: no regressions.

- [ ] **Step 6: Commit**

```bash
cd /Users/Kamal_Syed/Projects/PlanVisualizer
git add tools/lib/memory-index.js tests/unit/memory-index.test.js
git commit -m "feat(memory): extend readEntries with complexity + headBody fields"
```

---

### Task 2: Create `memory-model-suggester.js`

**Files:**

- Create: `tools/lib/memory-model-suggester.js`
- Create: `tests/unit/memory-model-suggester.test.js`

Pure function `suggestModel(entries, task) → { model, matched, reason }`. Tokenises the task, scores each entry against tokens, aggregates complexity to a model recommendation.

- [ ] **Step 1: Write failing tests**

```js
// tests/unit/memory-model-suggester.test.js
'use strict';
const { suggestModel, tokenise, escapeRegex } = require('../../tools/lib/memory-model-suggester');

const baseEntry = (overrides = {}) => ({
  category: 'topics',
  title: '',
  file: '',
  date: null,
  complexity: null,
  headBody: '',
  ...overrides,
});

describe('tokenise', () => {
  test('lowercases and splits on whitespace + punctuation', () => {
    expect(tokenise('Fix the BUG in render-tabs.js')).toEqual(['fix', 'bug', 'render', 'tabs']);
  });

  test('drops stopwords', () => {
    expect(tokenise('the of and a')).toEqual([]);
  });

  test('drops tokens shorter than 3 chars', () => {
    expect(tokenise('a be do go')).toEqual([]);
  });

  test('handles empty input', () => {
    expect(tokenise('')).toEqual([]);
  });
});

describe('escapeRegex', () => {
  test('escapes regex special characters', () => {
    expect(escapeRegex('c++')).toBe('c\\+\\+');
    expect(escapeRegex('node.js')).toBe('node\\.js');
    expect(escapeRegex('plain')).toBe('plain');
  });
});

describe('suggestModel — empty task', () => {
  test('throws when task is empty', () => {
    expect(() => suggestModel([], '')).toThrow(/task/i);
  });

  test('throws when task is all stopwords', () => {
    expect(() => suggestModel([], 'the of and')).toThrow(/task description too short/i);
  });
});

describe('suggestModel — word-boundary matching', () => {
  test('"render" matches "render-tabs" in title', () => {
    const entries = [baseEntry({ title: 'render-tabs handling', complexity: 'low' })];
    const r = suggestModel(entries, 'fix render output');
    expect(r.matched.length).toBe(1);
    expect(r.matched[0].matchedTokens).toContain('render');
  });

  test('"render" matches "renderer" (prefix-match via left word boundary)', () => {
    const entries = [baseEntry({ title: 'Renderer architecture', complexity: 'medium' })];
    const r = suggestModel(entries, 'review renderer changes');
    expect(r.matched.length).toBe(1);
  });

  test('"render" does NOT match "surrender" (no left word boundary)', () => {
    const entries = [baseEntry({ title: 'Surrender protocol', complexity: 'low' })];
    const r = suggestModel(entries, 'review render output');
    expect(r.matched.length).toBe(0);
  });
});

describe('suggestModel — score threshold', () => {
  test('single body hit (score=1) is NOT matched (threshold ≥ 2)', () => {
    const entries = [baseEntry({ title: 'X', complexity: 'low', headBody: 'mentions render once' })];
    const r = suggestModel(entries, 'render bug');
    expect(r.matched.length).toBe(0);
  });

  test('title hit alone (score=2) IS matched', () => {
    const entries = [baseEntry({ title: 'render bug', complexity: 'low' })];
    const r = suggestModel(entries, 'render output');
    expect(r.matched.length).toBe(1);
  });

  test('two body hits (score=2) IS matched', () => {
    const entries = [baseEntry({ title: 'X', complexity: 'low', headBody: 'render once\nrender twice' })];
    const r = suggestModel(entries, 'render bug');
    expect(r.matched.length).toBe(1);
  });
});

describe('suggestModel — aggregation', () => {
  test('all-low matched → haiku', () => {
    const entries = [
      baseEntry({ title: 'render basics', complexity: 'low' }),
      baseEntry({ title: 'render advanced', complexity: 'low' }),
    ];
    const r = suggestModel(entries, 'render output');
    expect(r.model).toBe('haiku');
    expect(r.reason).toMatch(/low/i);
  });

  test('any medium matched → sonnet', () => {
    const entries = [
      baseEntry({ title: 'render basics', complexity: 'low' }),
      baseEntry({ title: 'render core', complexity: 'medium' }),
    ];
    const r = suggestModel(entries, 'render output');
    expect(r.model).toBe('sonnet');
  });

  test('any high matched → sonnet', () => {
    const entries = [baseEntry({ title: 'render contract', complexity: 'high' })];
    const r = suggestModel(entries, 'render output');
    expect(r.model).toBe('sonnet');
    expect(r.reason).toMatch(/high/i);
  });

  test('null complexity treated as medium → sonnet', () => {
    const entries = [baseEntry({ title: 'render output', complexity: null })];
    const r = suggestModel(entries, 'render bug');
    expect(r.model).toBe('sonnet');
    expect(r.matched[0].complexitySource).toBe('default');
  });

  test('explicit complexity tagged "explicit" in complexitySource', () => {
    const entries = [baseEntry({ title: 'render output', complexity: 'low' })];
    const r = suggestModel(entries, 'render bug');
    expect(r.matched[0].complexitySource).toBe('explicit');
  });
});

describe('suggestModel — fallback', () => {
  test('zero matches → sonnet with safe-default reason', () => {
    const entries = [baseEntry({ title: 'unrelated topic', complexity: 'low' })];
    const r = suggestModel(entries, 'completely different task');
    expect(r.model).toBe('sonnet');
    expect(r.matched.length).toBe(0);
    expect(r.reason).toMatch(/no topics matched/i);
  });
});
```

- [ ] **Step 2: Run to confirm failure**

```bash
npx jest tests/unit/memory-model-suggester.test.js --no-coverage 2>&1 | tail -5
```

Expected: module not found.

- [ ] **Step 3: Create `tools/lib/memory-model-suggester.js`**

```js
'use strict';

const STOPWORDS = new Set([
  'a',
  'an',
  'and',
  'are',
  'as',
  'at',
  'be',
  'by',
  'for',
  'from',
  'has',
  'he',
  'in',
  'is',
  'it',
  'its',
  'of',
  'on',
  'that',
  'the',
  'to',
  'was',
  'were',
  'will',
  'with',
]);

const escapeRegex = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

function tokenise(task) {
  if (!task) return [];
  return task
    .toLowerCase()
    .split(/[\s,./!?;:()\[\]"'`-]+/)
    .filter((t) => t.length >= 3 && !STOPWORDS.has(t));
}

function scoreEntry(entry, tokens) {
  const titleLower = (entry.title || '').toLowerCase();
  const bodyLower = (entry.headBody || '').toLowerCase();
  let score = 0;
  const matchedTokens = [];
  for (const token of tokens) {
    const re = new RegExp('\\b' + escapeRegex(token), 'i');
    if (re.test(titleLower)) {
      score += 2;
      matchedTokens.push(token);
    } else if (re.test(bodyLower)) {
      score += 1;
      matchedTokens.push(token);
    }
  }
  return { score, matchedTokens };
}

function suggestModel(entries, task) {
  const tokens = tokenise(task);
  if (tokens.length === 0) {
    throw new Error('task description too short after filtering stopwords');
  }

  // Score every entry
  const scored = [];
  for (const entry of entries) {
    const { score, matchedTokens } = scoreEntry(entry, tokens);
    if (score >= 2) {
      const complexitySource = entry.complexity ? 'explicit' : 'default';
      const effectiveComplexity = entry.complexity || 'medium';
      scored.push({
        title: entry.title,
        file: entry.file,
        complexity: effectiveComplexity,
        complexitySource,
        score,
        matchedTokens,
      });
    }
  }

  // Aggregate
  if (scored.length === 0) {
    return {
      model: 'sonnet',
      matched: [],
      reason: 'No topics matched task description → sonnet (safe default)',
    };
  }

  const hasNonLow = scored.some((s) => s.complexity === 'medium' || s.complexity === 'high');
  if (hasNonLow) {
    const high = scored.find((s) => s.complexity === 'high');
    if (high) {
      return {
        model: 'sonnet',
        matched: scored,
        reason: `Found high-complexity topic '${high.title}' → sonnet`,
      };
    }
    const medium = scored.find((s) => s.complexity === 'medium' && s.complexitySource === 'explicit');
    if (medium) {
      return {
        model: 'sonnet',
        matched: scored,
        reason: `Found medium-complexity topic '${medium.title}' → sonnet`,
      };
    }
    const defaultedCount = scored.filter((s) => s.complexitySource === 'default').length;
    return {
      model: 'sonnet',
      matched: scored,
      reason: `${defaultedCount} matched topics have no explicit complexity hints → sonnet (safe default for unknown)`,
    };
  }

  return {
    model: 'haiku',
    matched: scored,
    reason: `All ${scored.length} matched topics low-complexity → haiku`,
  };
}

module.exports = { suggestModel, tokenise, escapeRegex, scoreEntry };
```

- [ ] **Step 4: Run tests to confirm pass**

```bash
npx jest tests/unit/memory-model-suggester.test.js --no-coverage 2>&1 | tail -5
```

Expected: all tests pass.

- [ ] **Step 5: Commit**

```bash
git add tools/lib/memory-model-suggester.js tests/unit/memory-model-suggester.test.js
git commit -m "feat(memory): add memory-model-suggester.js — tokenise + score + aggregate"
```

---

### Task 3: Extend `renderIndex` with complexity badges + legend

**Files:**

- Modify: `tools/lib/memory-index.js`
- Modify: `tests/unit/memory-index.test.js`

Existing `renderIndex(entries)` renders the compact MEMORY.md. Add complexity badge prefix per entry and a legend line below the intro paragraph.

- [ ] **Step 1: Write failing tests**

Append to `tests/unit/memory-index.test.js`:

```js
describe('renderIndex — complexity badges', () => {
  test('includes legend line below intro', () => {
    const out = renderIndex([
      { category: 'topics', title: 'X', file: 'x.md', date: null, complexity: 'low', headBody: '' },
    ]);
    expect(out).toContain('Complexity badges');
    expect(out).toContain('○ low');
    expect(out).toContain('◐ medium');
    expect(out).toContain('● high');
  });

  test('topic with explicit low complexity gets ○ badge', () => {
    const out = renderIndex([
      { category: 'topics', title: 'Low Topic', file: 'low.md', date: null, complexity: 'low' },
    ]);
    expect(out).toContain('- ○ [Low Topic]');
  });

  test('topic with explicit high complexity gets ● badge', () => {
    const out = renderIndex([
      { category: 'topics', title: 'High Topic', file: 'high.md', date: null, complexity: 'high' },
    ]);
    expect(out).toContain('- ● [High Topic]');
  });

  test('topic with no complexity hint gets no badge prefix', () => {
    const out = renderIndex([{ category: 'topics', title: 'No Hint', file: 'nh.md', date: null, complexity: null }]);
    expect(out).toContain('- [No Hint]');
    expect(out).not.toContain('- ○ [No Hint]');
    expect(out).not.toContain('- ◐ [No Hint]');
    expect(out).not.toContain('- ● [No Hint]');
  });

  test('sessions always get ◐ badge regardless of complexity', () => {
    const out = renderIndex([
      { category: 'sessions', title: 'Session 1', file: '2026-01-01-s1.md', date: '2026-01-01', complexity: null },
    ]);
    expect(out).toContain('- ◐ [Session 1]');
  });

  test('snapshots always get ◐ badge regardless of complexity', () => {
    const out = renderIndex([
      { category: 'snapshots', title: 'Snap 1', file: '2026-01-01-s.md', date: '2026-01-01', complexity: null },
    ]);
    expect(out).toContain('- ◐ [Snap 1]');
  });
});
```

- [ ] **Step 2: Run to confirm failure**

```bash
npx jest tests/unit/memory-index.test.js --no-coverage -t "complexity badges" 2>&1 | tail -5
```

Expected: tests fail because legend is not in output and entries have no badge prefix.

- [ ] **Step 3: Update `renderIndex` in `tools/lib/memory-index.js`**

Add a helper near the top of the file:

```js
const BADGE_FOR = { low: '○', medium: '◐', high: '●' };

function badgeFor(entry) {
  if (entry.category === 'sessions' || entry.category === 'snapshots') return '◐';
  if (entry.category === 'topics' && entry.complexity) {
    return BADGE_FOR[entry.complexity];
  }
  return null; // no badge for topics without hint
}
```

Update `renderIndex` — find the intro paragraph emit and add the legend line after it, then update the per-entry rendering loop to use `badgeFor`:

```js
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
    '**Complexity badges:** ○ low → haiku · ◐ medium → sonnet · ● high → sonnet · (no badge) unknown', // NEW
    '',
  ];

  const sectionHeading = { topics: 'Topics', sessions: 'Sessions', snapshots: 'Snapshots' };
  for (const cat of CATEGORIES) {
    const items = groups[cat];
    if (items.length === 0) continue;
    lines.push(`## ${sectionHeading[cat]}`, '');
    for (const e of items) {
      const badge = badgeFor(e);
      const badgePrefix = badge ? `${badge} ` : ''; // NEW
      const dateSuffix = e.date ? ` · ${e.date}` : '';
      lines.push(`- ${badgePrefix}[${e.title}](${e.file})${dateSuffix}`); // CHANGED
    }
    lines.push('');
  }
  return lines.join('\n');
}
```

- [ ] **Step 4: Run tests to confirm pass**

```bash
npx jest tests/unit/memory-index.test.js --no-coverage 2>&1 | tail -5
```

Expected: all tests pass.

- [ ] **Step 5: Smoke-test compact regeneration**

```bash
cd /Users/Kamal_Syed/Projects/PlanVisualizer
node tools/memory.js compact
head -15 MEMORY.md
```

Expected: legend line appears, entries have appropriate badges based on complexity (topics without hints render with no badge; sessions/snapshots show ◐).

- [ ] **Step 6: Commit**

```bash
git add tools/lib/memory-index.js tests/unit/memory-index.test.js MEMORY.md
git commit -m "feat(memory): renderIndex emits complexity badges + legend"
```

---

### Task 4: Extend `memory-validator.js` with warnings

**Files:**

- Modify: `tools/lib/memory-validator.js`
- Modify: `tools/memory.js` (CLI prints warnings)
- Modify: `tests/unit/memory-validator.test.js`

`validateMemory` now returns `{ ok, diff, warnings }` instead of `{ ok, diff }`. Warns when any topic file lacks a complexity hint. Warnings are non-fatal (exit code stays 0).

- [ ] **Step 1: Write failing tests**

Append to `tests/unit/memory-validator.test.js`:

```js
describe('validateMemory — warnings for missing complexity hints', () => {
  let tmpdir;
  beforeEach(() => {
    tmpdir = fs.mkdtempSync(path.join(os.tmpdir(), 'memval-w-'));
    fs.mkdirSync(path.join(tmpdir, 'docs/memory/topics'), { recursive: true });
    fs.writeFileSync(path.join(tmpdir, 'docs/memory/topics/with-hint.md'), '# A\n\n<!-- complexity: low -->\n\nbody\n');
    fs.writeFileSync(path.join(tmpdir, 'docs/memory/topics/missing-hint.md'), '# B\n\nbody\n');
    const { compactMemory } = require('../../tools/lib/memory-index');
    compactMemory({ root: tmpdir });
  });
  afterEach(() => fs.rmSync(tmpdir, { recursive: true, force: true }));

  test('returns warnings array with missing-hint files', () => {
    const result = validateMemory({ root: tmpdir });
    expect(result.warnings).toBeDefined();
    expect(Array.isArray(result.warnings)).toBe(true);
    expect(result.warnings.some((w) => w.includes('missing-hint.md'))).toBe(true);
  });

  test('warnings does not flag files with explicit hints', () => {
    const result = validateMemory({ root: tmpdir });
    expect(result.warnings.some((w) => w.includes('with-hint.md'))).toBe(false);
  });

  test('exit-equivalent: ok stays true when only warnings exist', () => {
    const result = validateMemory({ root: tmpdir });
    expect(result.ok).toBe(true); // warnings do not fail validation
  });
});
```

- [ ] **Step 2: Run to confirm failure**

```bash
npx jest tests/unit/memory-validator.test.js --no-coverage 2>&1 | tail -5
```

Expected: tests fail because `result.warnings` is undefined.

- [ ] **Step 3: Update `validateMemory` in `tools/lib/memory-validator.js`**

Find the existing `validateMemory` function. Add a warnings-collection pass after the drift detection:

```js
function validateMemory(opts) {
  const { root } = opts;
  const entries = readEntries(root);
  const memoryPath = path.join(root, 'MEMORY.md');
  const memoryExists = fs.existsSync(memoryPath);

  // Collect warnings for topic files missing complexity hints
  const warnings = [];
  for (const entry of entries) {
    if (entry.category === 'topics' && entry.complexity === null) {
      warnings.push(`topic file missing complexity hint: ${entry.file}`);
    }
  }

  // Existing fresh-install / drift detection (kept as-is)
  if (entries.length === 0 && !memoryExists) return { ok: true, diff: '', warnings };
  if (entries.length > 0 && !memoryExists) {
    return { ok: false, diff: 'MEMORY.md is missing but topic files exist in docs/memory/.', warnings };
  }
  if (entries.length === 0 && memoryExists) return { ok: true, diff: '', warnings };

  const expected = renderIndex(entries) + '\n';
  const actual = fs.readFileSync(memoryPath, 'utf8');
  if (actual === expected) return { ok: true, diff: '', warnings };

  // Existing diff code (kept as-is, append `warnings` to the return)
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
  return { ok: false, diff: diffLines.join('\n'), warnings };
}
```

- [ ] **Step 4: Update CLI in `tools/memory.js`**

Find the `validate` command branch in `dispatch`. Update it to print warnings:

```js
if (cmd === 'validate') {
  const { validateMemory } = require('./lib/memory-validator');
  const result = validateMemory({ root: ROOT });
  if (result.ok) {
    console.log('[memory] OK — MEMORY.md is in sync with docs/memory/.');
  } else {
    console.error('[memory] DRIFT — MEMORY.md does not match docs/memory/:');
    console.error(result.diff);
  }
  // Print warnings regardless of ok/drift state
  if (result.warnings && result.warnings.length > 0) {
    console.error(`[memory] Warning: ${result.warnings.length} topic files missing complexity hints:`);
    for (const w of result.warnings) {
      console.error(`  - ${w.replace('topic file missing complexity hint: ', '')}`);
    }
    console.error(
      '  Add `<!-- complexity: low|medium|high -->` on the line after the H1 title. See docs/superpowers/specs/2026-05-10-us-0179-memory-model-optimisation-design.md for the heuristic.',
    );
  }
  return result.ok ? 0 : 1;
}
```

- [ ] **Step 5: Run tests to confirm pass**

```bash
npx jest tests/unit/memory-validator.test.js --no-coverage 2>&1 | tail -5
```

Expected: all tests pass.

- [ ] **Step 6: Smoke-test validate**

```bash
cd /Users/Kamal_Syed/Projects/PlanVisualizer
node tools/memory.js validate
```

Expected: `[memory] OK` followed by warnings for all 12 topic files (since none have hints yet — that's Task 7).

- [ ] **Step 7: Commit**

```bash
git add tools/lib/memory-validator.js tools/memory.js tests/unit/memory-validator.test.js
git commit -m "feat(memory): validateMemory surfaces warnings for missing complexity hints"
```

---

### Task 5: Extend `memory-claude-md-patcher.js` with `patchSuggestModelItem`

**Files:**

- Modify: `tools/lib/memory-claude-md-patcher.js` (assumes US-0178 created this file)
- Modify: `tools/lib/memory-commit-orchestrator.js` (assumes US-0178 created this file)
- Modify: `tests/unit/memory-claude-md-patcher.test.js`

Add a new patch function that inserts the suggest-model item after US-0178's memory layout item and renumbers subsequent items. The orchestrator calls both patches in sequence.

- [ ] **Step 1: Write failing tests**

Append to `tests/unit/memory-claude-md-patcher.test.js`:

```js
describe('patchSuggestModelItem', () => {
  // Fixture reflects post-US-0178 state: memory layout item is item 3.
  const POST_US0178 = [
    '# CLAUDE.md',
    '',
    '## Mandatory Session Startup',
    '',
    '1. Read `AGENTS.md` in full before writing any code or using any tools.',
    '2. Read `MEMORY.md` and all linked topic files.',
    '3. Memory files live in `docs/memory/{topics,sessions,snapshots}/`. Read `MEMORY.md` (compact index) at session start; read specific topic files when their topic is relevant to the current task. Do not edit `MEMORY.md` directly — it is auto-regenerated by `generate-plan.js`.',
    '4. Read `PROMPT_LOG.md` to understand the prompt history.',
  ].join('\n');

  const { patchSuggestModelItem } = require('../../tools/lib/memory-claude-md-patcher');

  test('inserts new item 4 after US-0178 memory layout item', () => {
    const { text, changed } = patchSuggestModelItem(POST_US0178);
    expect(changed).toBe(true);
    const lines = text.split('\n');
    const item4Idx = lines.findIndex((l) => l.startsWith('4. Before dispatching'));
    expect(item4Idx).toBeGreaterThan(-1);
    expect(lines[item4Idx]).toMatch(/memory:suggest-model/);
  });

  test('renumbers subsequent items', () => {
    const { text } = patchSuggestModelItem(POST_US0178);
    expect(text).toContain('5. Read `PROMPT_LOG.md`');
    expect(text).not.toMatch(/^4\. Read `PROMPT_LOG/m);
  });

  test('is idempotent — second patch is no-op', () => {
    const { text } = patchSuggestModelItem(POST_US0178);
    const { changed } = patchSuggestModelItem(text);
    expect(changed).toBe(false);
  });
});
```

- [ ] **Step 2: Run to confirm failure**

```bash
npx jest tests/unit/memory-claude-md-patcher.test.js --no-coverage -t "patchSuggestModelItem" 2>&1 | tail -5
```

Expected: `patchSuggestModelItem is not a function`.

- [ ] **Step 3: Add `patchSuggestModelItem` to `tools/lib/memory-claude-md-patcher.js`**

Append to the file (do not modify the existing `patchClaudeMd` or its constants):

```js
const SUGGEST_MODEL_IDEMPOTENCY_MARKER = 'npm run memory:suggest-model';

const NEW_SUGGEST_MODEL_ITEM =
  '4. Before dispatching complex work to a sub-agent, run `npm run memory:suggest-model -- --task "<brief description>"` to get a model recommendation based on topic complexity in `docs/memory/`. The recommendation is `haiku` for low-complexity work or `sonnet` for medium/high; opus is never auto-recommended.';

function patchSuggestModelItem(text) {
  if (text.includes(SUGGEST_MODEL_IDEMPOTENCY_MARKER)) {
    return { text, changed: false };
  }

  const lines = text.split('\n');

  // Find the US-0178 memory layout item (item 3)
  let insertIdx = -1;
  for (let i = 0; i < lines.length; i++) {
    if (/^3\.\s+Memory files live/.test(lines[i])) {
      insertIdx = i;
      break;
    }
  }
  if (insertIdx === -1) {
    throw new Error('CLAUDE.md Mandatory Session Startup: cannot find US-0178 memory item — run US-0178 patch first');
  }

  lines.splice(insertIdx + 1, 0, NEW_SUGGEST_MODEL_ITEM);

  // Renumber subsequent numbered list items (+1 each)
  for (let i = insertIdx + 2; i < lines.length; i++) {
    const m = lines[i].match(/^(\d+)(\.\s+.*)/);
    if (m) lines[i] = `${parseInt(m[1], 10) + 1}${m[2]}`;
  }

  return { text: lines.join('\n'), changed: true };
}

module.exports = { patchClaudeMd, patchSuggestModelItem };
```

- [ ] **Step 4: Wire into `memory-commit-orchestrator.js`**

Find the CLAUDE.md patch step in the orchestrator. Add the second patch call after the existing `patchClaudeMd` call:

```js
const { patchClaudeMd, patchSuggestModelItem } = require('./memory-claude-md-patcher');

// ... inside the orchestrator function, after patchClaudeMd:

if (fs.existsSync(claudePath)) {
  const original = fs.readFileSync(claudePath, 'utf8');
  let after = original;
  let anyChanged = false;
  try {
    const r1 = patchClaudeMd(after);
    after = r1.text;
    if (r1.changed) anyChanged = true;
  } catch (e) {
    console.error('[migrate-commit] Abort:', e.message);
    return 1;
  }
  try {
    const r2 = patchSuggestModelItem(after);
    after = r2.text;
    if (r2.changed) anyChanged = true;
  } catch (e) {
    console.error('[migrate-commit] Abort:', e.message);
    return 1;
  }
  if (!dry && anyChanged) {
    fs.writeFileSync(claudePath, after);
  }
  if (dry && anyChanged) {
    console.log('[migrate-commit] dry-run: CLAUDE.md would be patched (US-0178 + US-0179).');
  }
}
```

- [ ] **Step 5: Run tests to confirm pass**

```bash
npx jest tests/unit/memory-claude-md-patcher.test.js --no-coverage 2>&1 | tail -5
```

Expected: all tests pass.

- [ ] **Step 6: Commit**

```bash
git add tools/lib/memory-claude-md-patcher.js tools/lib/memory-commit-orchestrator.js tests/unit/memory-claude-md-patcher.test.js
git commit -m "feat(memory): patchSuggestModelItem + wire into commit orchestrator"
```

---

### Task 6: Wire `suggest-model` subcommand into `tools/memory.js` + npm script

**Files:**

- Modify: `tools/memory.js`
- Modify: `package.json`
- Modify: `tests/unit/memory-cli.test.js`

Add `--task` and `--json` flags to `parseArgs`. Add `suggest-model` dispatch branch. Add `memory:suggest-model` npm script.

- [ ] **Step 1: Write failing tests**

Append to `tests/unit/memory-cli.test.js`:

```js
describe('parseArgs — suggest-model flags', () => {
  test('--task captures next argument', () => {
    const r = parseArgs(['node', 'memory.js', 'suggest-model', '--task', 'fix a bug']);
    expect(r.cmd).toBe('suggest-model');
    expect(r.task).toBe('fix a bug');
  });

  test('--json sets json:true', () => {
    const r = parseArgs(['node', 'memory.js', 'suggest-model', '--task', 'fix', '--json']);
    expect(r.json).toBe(true);
  });

  test('task with quotes works', () => {
    const r = parseArgs(['node', 'memory.js', 'suggest-model', '--task', 'fix "thing"']);
    expect(r.task).toBe('fix "thing"');
  });
});
```

- [ ] **Step 2: Update `parseArgs` in `tools/memory.js`**

Find the existing `parseArgs` function. It returns `{ cmd, dry, force, days, push, pr, noTest }` after US-0178. Extend the return:

```js
function parseArgs(argv) {
  const args = argv.slice(2);
  const cmd = args[0] || null;
  let dry = false;
  let force = false;
  let days = null;
  let push = false;
  let pr = false;
  let noTest = false;
  let task = null;
  let json = false;
  for (let i = 1; i < args.length; i++) {
    if (args[i] === '--dry' || args[i] === '--dry-run') dry = true;
    else if (args[i] === '--force') force = true;
    else if (args[i] === '--push') push = true;
    else if (args[i] === '--pr') {
      pr = true;
      push = true;
    } else if (args[i] === '--no-test') noTest = true;
    else if (args[i] === '--json') json = true;
    else if (args[i] === '--days' && args[i + 1]) {
      days = parseInt(args[i + 1], 10);
      i++;
    } else if (args[i] === '--task' && args[i + 1] !== undefined) {
      task = args[i + 1];
      i++;
    }
  }
  return { cmd, dry, force, days, push, pr, noTest, task, json };
}
```

- [ ] **Step 3: Add `suggest-model` dispatch branch**

In the `dispatch` function in `tools/memory.js`, add a branch after the existing `validate` branch and before the usage error:

```js
if (cmd === 'suggest-model') {
  if (!task) {
    console.error('Usage: npm run memory:suggest-model -- --task "<brief description>"');
    console.error('       (the `--` separator is required when invoking via npm)');
    console.error('       or: node tools/memory.js suggest-model --task "<brief description>" [--json]');
    return 1;
  }
  const { readEntries } = require('./lib/memory-index');
  const { suggestModel } = require('./lib/memory-model-suggester');
  const entries = readEntries(ROOT);
  if (entries.length === 0) {
    console.error('[memory] no topic files found — run migration first (node tools/memory.js migrate)');
    return 1;
  }
  let result;
  try {
    result = suggestModel(entries, task);
  } catch (e) {
    console.error(`[memory] ${e.message}`);
    return 1;
  }
  if (json) {
    process.stdout.write(JSON.stringify(result, null, 2) + '\n');
  } else {
    console.log(`Recommended: ${result.model}`);
    if (result.matched.length > 0) {
      console.log(`Matched ${result.matched.length} topics (score ≥ 2):`);
      for (const m of result.matched) {
        const tokensStr = m.matchedTokens.join(', ');
        console.log(
          `  - ${m.title} (${m.complexity}, ${m.complexitySource}) — score ${m.score} (matched: ${tokensStr})`,
        );
      }
    }
    console.log(`Reason: ${result.reason}`);
  }
  return 0;
}
```

Update the usage error string to mention the new command:

```js
console.error(
  'Usage: node tools/memory.js {compact|archive|migrate|migrate-commit|suggest-model|validate} [--dry] [--force] [--push] [--pr] [--no-test] [--days N] [--task "<text>"] [--json]',
);
```

- [ ] **Step 4: Add npm script**

In `package.json`, in the `scripts` object, add after `memory:validate`:

```json
"memory:suggest-model": "node tools/memory.js suggest-model"
```

- [ ] **Step 5: Run tests**

```bash
npx jest tests/unit/memory-cli.test.js --no-coverage 2>&1 | tail -5
```

Expected: all tests pass (including the new --task and --json tests).

- [ ] **Step 6: Smoke-test CLI**

```bash
cd /Users/Kamal_Syed/Projects/PlanVisualizer
node tools/memory.js suggest-model --task "update release plan format rules"
```

Expected output (no topic files have hints yet — Task 7 fixes that — so all matches default to medium → sonnet):

```
Recommended: sonnet
Matched 1 topics (score ≥ 2):
  - Release Plan Format Rules (medium, default) — score X (matched: release, plan, format, rules)
Reason: ... matched topics have no explicit complexity hints → sonnet (safe default for unknown)
```

Try with `--json` to confirm machine-readable output:

```bash
node tools/memory.js suggest-model --task "update release plan format rules" --json
```

- [ ] **Step 7: Commit**

```bash
git add tools/memory.js package.json tests/unit/memory-cli.test.js
git commit -m "feat(memory): wire suggest-model subcommand + memory:suggest-model npm script"
```

---

### Task 7: Seed 12 existing topic files with complexity hints

**Files:**

- Modify: `docs/memory/topics/active-dependencies.md`
- Modify: `docs/memory/topics/agents-md.md`
- Modify: `docs/memory/topics/at-risk-signals.md`
- Modify: `docs/memory/topics/cost-attribution.md`
- Modify: `docs/memory/topics/coverage-thresholds.md`
- Modify: `docs/memory/topics/git-branching-strategy.md`
- Modify: `docs/memory/topics/key-file-paths.md`
- Modify: `docs/memory/topics/parser-contracts.md`
- Modify: `docs/memory/topics/project-identity.md`
- Modify: `docs/memory/topics/release-plan-format-rules.md`
- Modify: `docs/memory/topics/retry-transient-error-parameters.md`
- Modify: `docs/memory/topics/technology.md`

Add `<!-- complexity: ... -->` hint on the line immediately after the H1 in each file, followed by a blank line.

- [ ] **Step 1: Apply hints per spec table**

For each file below, insert the indicated complexity hint comment on the line after the H1 title, with a blank line separator before the body content:

| File                                  | Hint     |
| ------------------------------------- | -------- |
| `active-dependencies.md`              | `low`    |
| `agents-md.md`                        | `low`    |
| `at-risk-signals.md`                  | `medium` |
| `cost-attribution.md`                 | `medium` |
| `coverage-thresholds.md`              | `low`    |
| `git-branching-strategy.md`           | `medium` |
| `key-file-paths.md`                   | `low`    |
| `parser-contracts.md`                 | `high`   |
| `project-identity.md`                 | `low`    |
| `release-plan-format-rules.md`        | `high`   |
| `retry-transient-error-parameters.md` | `low`    |
| `technology.md`                       | `low`    |

Example for `project-identity.md` — before:

```markdown
# Project Identity

- **Name:** PlanVisualizer
  ...
```

After:

```markdown
# Project Identity

<!-- complexity: low -->

- **Name:** PlanVisualizer
  ...
```

- [ ] **Step 2: Run validate to confirm zero warnings**

```bash
cd /Users/Kamal_Syed/Projects/PlanVisualizer
node tools/memory.js validate
```

Expected:

```
[memory] OK — MEMORY.md is in sync with docs/memory/.
```

(No warnings — all topic files now have explicit hints.)

- [ ] **Step 3: Regenerate compact MEMORY.md and verify badges**

```bash
node tools/memory.js compact
head -20 MEMORY.md
```

Expected: 12 topic entries each with a `○`, `◐`, or `●` badge per the hint table.

- [ ] **Step 4: Smoke-test suggest-model with real hints**

```bash
node tools/memory.js suggest-model --task "update release plan format rules"
```

Expected:

```
Recommended: sonnet
Matched 1 topics (score ≥ 2):
  - Release Plan Format Rules (high, explicit) — score X (matched: release, plan, format, rules)
Reason: Found high-complexity topic 'Release Plan Format Rules' → sonnet
```

Try a low-complexity task:

```bash
node tools/memory.js suggest-model --task "look up the project identity name"
```

Expected:

```
Recommended: haiku
Matched 1 topics (score ≥ 2):
  - Project Identity (low, explicit) — score X (matched: project, identity)
Reason: All 1 matched topics low-complexity → haiku
```

- [ ] **Step 5: Run full test suite**

```bash
npx jest --no-coverage 2>&1 | tail -3
```

Expected: all tests pass.

- [ ] **Step 6: Commit**

```bash
cd /Users/Kamal_Syed/Projects/PlanVisualizer
git add docs/memory/topics/ MEMORY.md
git commit -m "feat(memory): seed 12 topic files with complexity hints per heuristic"
```

---

## Final Verification

After all 7 tasks:

- [ ] **Run full test suite**

```bash
npx jest --no-coverage 2>&1 | tail -5
```

Expected: ≥1683 existing + ~20 new tests, all passing.

- [ ] **Run coverage check on new files**

```bash
npx jest --coverage 2>&1 | grep -E "All files|memory-model-suggester"
```

Expected: `memory-model-suggester.js` at ≥85% coverage; overall ≥80%.

- [ ] **Final smoke test on both compact + suggest-model**

```bash
node tools/memory.js compact && head -25 MEMORY.md
node tools/memory.js suggest-model --task "fix a parser contract bug" --json
```

Expected: compact MEMORY.md shows badges; suggest-model returns sonnet with Parser Contracts matched.

If all pass, branch is ready for PR.
