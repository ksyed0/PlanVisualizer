# US-0243 Implementation Plan — Migration 001 (Normalise Fenced Blocks) + Pre-Flight Audit

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship `tools/lib/migrations/data_001-normalise-fenced-blocks.js` — a one-shot data migration that runs `parse → serialize → parse → serialize` against each managed markdown file (RELEASE_PLAN.md, BUGS.md, LESSONS.md, TEST_CASES.md, ID_REGISTRY.md), fails loud if `pass1 !== pass2` (`SerializerStabilityError`), skips write when `pass2 === input` (true no-op idempotency), and otherwise writes the normalised output back. Snapshots pre-mutation copies to `/tmp/docs-pre-norm/`. Procedural human approval gate via `git diff` (no `--apply` flag). Ships alongside a **pre-flight round-trip completeness audit** (spec §4.4) that runs against production markdown ONCE during this implementation and emits a triage report at `/tmp/docs-pre-norm/_round-trip-audit.txt`.

**Architecture:** One migration file, one audit script. Migration depends on the 7 serializers + 6 parsers from US-0240 (this story is gated on US-0240 having shipped — verify in Pre-Work). Migration uses the standard runner protocol (`up({root})` async function + `touches: string[]`) so it integrates with `tools/pv-upgrade.js` without changes to the runner.

**Tech Stack:** Node ≥20, Jest, existing migration runner (`tools/lib/migrations/index.js`).

---

## File Structure

| File                                                           | Action | Responsibility                                                                                                 |
| -------------------------------------------------------------- | ------ | -------------------------------------------------------------------------------------------------------------- |
| `tools/lib/migrations/data_001-normalise-fenced-blocks.js`     | Create | The migration. Implements spec §4.3 algorithm.                                                                 |
| `tools/lib/repository/round-trip-audit.js`                     | Create | Pre-flight audit harness — runs round-trip against each managed file + emits the report.                       |
| `tools/audit-round-trip.js`                                    | Create | CLI wrapper that invokes the audit and writes the report to `/tmp/docs-pre-norm/_round-trip-audit.txt`.        |
| `tests/unit/migrations/data_001-normalise.test.js`             | Create | 7 tests: no-op idempotency, normalisation happy path, stability error, snapshot creation, per-entity coverage. |
| `tests/integration/repository/migration-001-roundtrip.test.js` | Create | End-to-end: a fixture corpus → `pv:upgrade` → file changes match expectations + second run is no-op.           |
| `docs/architecture/round-trip-audit-2026-05-24.md`             | Create | The committed report from running the audit against THIS repo's production files. Documents triage decisions.  |

---

## Pre-Work

**Dependencies:** US-0240 must be on develop. Verify:

```bash
test -f tools/lib/repository/serializers/story-serializer.js \
  && test -f tools/lib/repository/serializers/bug-serializer.js \
  && test -f tools/lib/repository/serializers/lesson-serializer.js \
  && test -f tools/lib/repository/serializers/test-case-serializer.js \
  && test -f tools/lib/repository/markdown-mutator.js \
  && echo "US-0240 OK"
```

- [ ] **Pre-Step 1: Branch + commit plan**

```bash
cd /Users/Kamal_Syed/Projects/PlanVisualizer/.claude/worktrees/phase-e-impl
git fetch origin develop --quiet
git checkout -b feature/US-0243-migration-001-normalise origin/develop
git add docs/superpowers/plans/2026-05-24-us-0243-migration-001-normalise.md
git commit -m "docs: US-0243 implementation plan

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>"
```

- [ ] **Pre-Step 2: Verify migration runner accepts `data_001-` pattern**

```bash
grep -n "MIGRATION_FILENAME_RE" tools/lib/migrations/index.js
```

Expected: `/^(?:data_)?\d{3}-.*\.js$/` — accepts our naming.

---

## Task 1: Round-trip audit harness + CLI

**Why first:** Spec §4.4 mandates the audit as a prerequisite for the migration. Implement and run it before writing the migration so any divergences are triaged upfront.

**Files:**

- Create: `tools/lib/repository/round-trip-audit.js`
- Create: `tools/audit-round-trip.js`
- Create: `tests/unit/repository/round-trip-audit.test.js`

- [ ] **Step 1: Write the failing test**

````js
'use strict';

const fs = require('fs');
const os = require('os');
const path = require('path');
const { auditFile } = require('../../../tools/lib/repository/round-trip-audit');

function tmp(content, ext = '.md') {
  const p = path.join(os.tmpdir(), `audit-${Date.now()}-${Math.random()}${ext}`);
  fs.writeFileSync(p, content);
  return p;
}

describe('auditFile', () => {
  it('reports zero divergences when serializer is lossless against the input', () => {
    const p = tmp('```\nUS-0001 (EPIC-0001): T\nPriority: High (P1)\nEstimate: M\nStatus: To Do\n```\n', '.md');
    const report = auditFile({ path: p, kind: 'release-plan' });
    expect(report.entitiesParsed).toBeGreaterThanOrEqual(1);
    expect(report.divergences).toEqual([]);
  });

  it('reports a divergence when a story has a custom field the serializer drops', () => {
    // Synthetic case: a story block with a field the parser captures but the
    // serializer ignores (would never happen in production — this is harness
    // self-test).
    const p = tmp(
      '```\nUS-0001 (EPIC-0001): T\nPriority: High (P1)\nEstimate: M\nStatus: To Do\nLegacyField: dropped\n```\n',
      '.md',
    );
    const report = auditFile({ path: p, kind: 'release-plan' });
    // The harness compares parse(file) → serialize → parse and reports any
    // entity field that diverged. If parser drops LegacyField too (because
    // it's not in the field list), the divergences will be empty —
    // documenting the field is silently lost is the value of the audit.
    // For this test, just assert the report shape.
    expect(report).toHaveProperty('entitiesParsed');
    expect(report).toHaveProperty('divergences');
    expect(Array.isArray(report.divergences)).toBe(true);
  });

  it('throws when the file does not exist', () => {
    expect(() => auditFile({ path: '/tmp/nonexistent-xyz.md', kind: 'release-plan' })).toThrow();
  });
});
````

- [ ] **Step 2: Run, expect failure**

```bash
npx jest tests/unit/repository/round-trip-audit.test.js 2>&1 | tail -4
```

- [ ] **Step 3: Implement audit harness**

Create `tools/lib/repository/round-trip-audit.js`:

```js
'use strict';

const fs = require('fs');

const KIND_TO_PARSER = {
  'release-plan': () => require('../parse-release-plan'),
  bugs: () => require('../parse-bugs'),
  lessons: () => require('../parse-lessons'),
  'test-cases': () => require('../parse-test-cases'),
};

const KIND_TO_SERIALIZER = {
  story: () => require('./serializers/story-serializer'),
  epic: () => require('./serializers/epic-serializer'),
  bug: () => require('./serializers/bug-serializer'),
  lesson: () => require('./serializers/lesson-serializer'),
  testCase: () => require('./serializers/test-case-serializer'),
};

const KIND_ENTITIES = {
  'release-plan': ['story', 'epic'],
  bugs: ['bug'],
  lessons: ['lesson'],
  'test-cases': ['testCase'],
};

const KIND_PARSE_FNS = {
  'release-plan': (text) => ({
    story: require('../parse-release-plan').parseStories(text),
    epic: require('../parse-release-plan').parseEpics(text),
  }),
  bugs: (text) => ({ bug: require('../parse-bugs').parseBugs(text) }),
  lessons: (text) => ({ lesson: require('../parse-lessons').parseLessons(text) }),
  'test-cases': (text) => ({ testCase: require('../parse-test-cases').parseTestCases(text) }),
};

/**
 * Run the round-trip completeness audit against one file.
 *
 * Returns { entitiesParsed, divergences } where each divergence is
 *   { entityKind, entityId, field, original, roundTripped }
 */
function auditFile({ path: filePath, kind }) {
  if (!fs.existsSync(filePath)) throw new Error(`auditFile: ${filePath} not found`);
  const text = fs.readFileSync(filePath, 'utf8');
  const parsed = KIND_PARSE_FNS[kind](text);
  let entitiesParsed = 0;
  const divergences = [];
  for (const entityKind of KIND_ENTITIES[kind]) {
    const entities = parsed[entityKind] || [];
    entitiesParsed += entities.length;
    const serializer = KIND_TO_SERIALIZER[entityKind]();
    for (const ent of entities) {
      let serialized;
      try {
        serialized = serializer.serialize(ent);
      } catch (e) {
        divergences.push({
          entityKind,
          entityId: ent.id,
          field: '*serialize-error*',
          original: 'n/a',
          roundTripped: e.message,
        });
        continue;
      }
      // Re-parse the just-serialized output (with the same parser) and
      // compare field-by-field against the original entity.
      let reparsed;
      try {
        // Wrap for parsers that expect fenced docs.
        const wrap = kind === 'release-plan' ? `# Test\n\n\`\`\`\n${serialized}\`\`\`\n` : serialized;
        const round = KIND_PARSE_FNS[kind](wrap);
        reparsed = (round[entityKind] || [])[0];
      } catch (e) {
        divergences.push({
          entityKind,
          entityId: ent.id,
          field: '*reparse-error*',
          original: 'n/a',
          roundTripped: e.message,
        });
        continue;
      }
      if (!reparsed) {
        divergences.push({
          entityKind,
          entityId: ent.id,
          field: '*reparse-missing*',
          original: 'present',
          roundTripped: 'null',
        });
        continue;
      }
      // Field-by-field diff.
      const allKeys = new Set([...Object.keys(ent), ...Object.keys(reparsed)]);
      for (const k of allKeys) {
        const a = JSON.stringify(ent[k]);
        const b = JSON.stringify(reparsed[k]);
        if (a !== b) {
          divergences.push({ entityKind, entityId: ent.id, field: k, original: ent[k], roundTripped: reparsed[k] });
        }
      }
    }
  }
  return { entitiesParsed, divergences };
}

/**
 * Run the audit against an array of (path, kind) pairs and return a
 * combined report.
 */
function auditAll(targets) {
  const report = { totalFiles: targets.length, totalEntities: 0, totalDivergences: 0, perFile: [] };
  for (const t of targets) {
    const r = auditFile(t);
    report.totalEntities += r.entitiesParsed;
    report.totalDivergences += r.divergences.length;
    report.perFile.push({ ...t, ...r });
  }
  return report;
}

module.exports = { auditFile, auditAll };
```

- [ ] **Step 4: Run, expect green**

```bash
npx jest tests/unit/repository/round-trip-audit.test.js 2>&1 | tail -4
```

Expected: 3 passed (or 2 — the synthetic-divergence test asserts shape only).

- [ ] **Step 5: Create the CLI wrapper**

Create `tools/audit-round-trip.js`:

```js
#!/usr/bin/env node
'use strict';
const fs = require('fs');
const path = require('path');
const { auditAll } = require('./lib/repository/round-trip-audit');

const ROOT = process.cwd();
const TARGETS = [
  { path: path.join(ROOT, 'docs', 'RELEASE_PLAN.md'), kind: 'release-plan' },
  { path: path.join(ROOT, 'docs', 'BUGS.md'), kind: 'bugs' },
  { path: path.join(ROOT, 'docs', 'LESSONS.md'), kind: 'lessons' },
  { path: path.join(ROOT, 'docs', 'TEST_CASES.md'), kind: 'test-cases' },
];

const OUT_DIR = '/tmp/docs-pre-norm';
fs.mkdirSync(OUT_DIR, { recursive: true });
const OUT_PATH = path.join(OUT_DIR, '_round-trip-audit.txt');

const report = auditAll(TARGETS.filter((t) => fs.existsSync(t.path)));
const lines = [];
lines.push(`Round-trip completeness audit — ${new Date().toISOString()}`);
lines.push(`Total files: ${report.totalFiles}`);
lines.push(`Total entities parsed: ${report.totalEntities}`);
lines.push(`Total divergences: ${report.totalDivergences}`);
lines.push('');
for (const f of report.perFile) {
  lines.push(`=== ${f.path} (${f.kind}) ===`);
  lines.push(`  entities parsed: ${f.entitiesParsed}`);
  lines.push(`  divergences: ${f.divergences.length}`);
  for (const d of f.divergences) {
    lines.push(`    - ${d.entityKind}/${d.entityId} field=${d.field}`);
    lines.push(`        original:     ${JSON.stringify(d.original)}`);
    lines.push(`        roundTripped: ${JSON.stringify(d.roundTripped)}`);
  }
  lines.push('');
}
fs.writeFileSync(OUT_PATH, lines.join('\n'));
console.log(`Wrote ${OUT_PATH} (${report.totalDivergences} divergences across ${report.totalEntities} entities).`);
if (report.totalDivergences > 0) process.exit(1);
```

- [ ] **Step 6: Run the audit against THIS repo's production files**

```bash
node tools/audit-round-trip.js 2>&1 | tail -4
cat /tmp/docs-pre-norm/_round-trip-audit.txt | head -60
```

This is the critical pre-flight step. Two outcomes:

**Outcome A: zero divergences.** Proceed to Task 2.

**Outcome B: divergences found.** STOP. For each divergence, decide one of:

1. **Fix the serializer to be lossless** — adjust `<entity>-serializer.js` to emit the field, regenerate the audit, commit the serializer fix in this PR, then proceed.
2. **Accept the field as intentionally dropped** — document in `docs/architecture/round-trip-audit-2026-05-24.md` (Task 7) and add a regression fixture so the audit harness can be extended to know-it-drops-this.

Either way, the audit report is preserved in `/tmp/docs-pre-norm/` and committed to the repo as `docs/architecture/round-trip-audit-2026-05-24.md` in Task 7.

- [ ] **Step 7: Commit the harness + CLI**

```bash
git add tools/lib/repository/round-trip-audit.js tools/audit-round-trip.js tests/unit/repository/round-trip-audit.test.js
git commit -m "[feat] US-0243 | E.4: round-trip completeness audit harness (spec §4.4)

Pre-flight prerequisite for Migration 001. Compares parse(file) →
serialize → parse field-by-field and reports any non-identity field.
Surfaces serializer lossiness BEFORE migration runs against production.

Harness usage:
  node tools/audit-round-trip.js
Output:
  /tmp/docs-pre-norm/_round-trip-audit.txt
Exit code:
  0 = no divergences
  1 = divergences found (require triage per spec §4.4)

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>"
```

---

## Task 2: Migration 001 — pass1/pass2 stability check

**Files:**

- Create: `tools/lib/migrations/data_001-normalise-fenced-blocks.js`
- Create: `tests/unit/migrations/data_001-normalise.test.js`

- [ ] **Step 1: Write the failing unit tests**

Create `tests/unit/migrations/data_001-normalise.test.js`:

```js
'use strict';

const fs = require('fs');
const os = require('os');
const path = require('path');

const migration = require('../../../tools/lib/migrations/data_001-normalise-fenced-blocks');
const { SerializerStabilityError } = require('../../../tools/lib/repository/errors');

function mkRoot() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'us0243-mig-'));
  fs.mkdirSync(path.join(root, 'docs'), { recursive: true });
  fs.writeFileSync(path.join(root, 'package.json'), JSON.stringify({ name: 't', version: '1.0.0' }));
  return root;
}

const SAMPLE_PLAN = `# Plan\n\n\`\`\`\nUS-0001 (EPIC-0001): A\nPriority: High (P1)\nEstimate: M\nStatus: To Do\n\`\`\`\n`;

describe('US-0243 / AC-0950..0952: Migration 001', () => {
  let root;
  afterEach(() => {
    if (root) fs.rmSync(root, { recursive: true, force: true });
  });

  it('declares touches[] for the snapshot mechanism', () => {
    expect(Array.isArray(migration.touches)).toBe(true);
    expect(migration.touches).toContain('docs/RELEASE_PLAN.md');
    expect(migration.touches).toContain('docs/BUGS.md');
    expect(migration.touches).toContain('docs/LESSONS.md');
    expect(migration.touches).toContain('docs/TEST_CASES.md');
  });

  it('AC-0951: second run is a true no-op (no mtime change, no rewrite)', async () => {
    root = mkRoot();
    // Seed with already-canonical content (the serializer round-trip output).
    const { serialize: serializeStory } = require('../../../tools/lib/repository/serializers/story-serializer');
    const { parseStories } = require('../../../tools/lib/parse-release-plan');
    const canonicalBody = serializeStory(parseStories(SAMPLE_PLAN)[0]);
    const canonical = `# Plan\n\n\`\`\`\n${canonicalBody}\`\`\`\n`;
    const filePath = path.join(root, 'docs', 'RELEASE_PLAN.md');
    fs.writeFileSync(filePath, canonical);
    const mtimeBefore = fs.statSync(filePath).mtimeMs;
    await new Promise((r) => setTimeout(r, 5));
    await migration.up({ root });
    const mtimeAfter = fs.statSync(filePath).mtimeMs;
    expect(mtimeAfter).toBe(mtimeBefore); // not rewritten
  });

  it('AC-0950: non-canonical file is normalised (rewritten with serializer output)', async () => {
    root = mkRoot();
    const filePath = path.join(root, 'docs', 'RELEASE_PLAN.md');
    fs.writeFileSync(filePath, SAMPLE_PLAN);
    await migration.up({ root });
    const after = fs.readFileSync(filePath, 'utf8');
    // The story still parses correctly.
    const { parseStories } = require('../../../tools/lib/parse-release-plan');
    expect(parseStories(after)).toHaveLength(1);
    expect(parseStories(after)[0].id).toBe('US-0001');
    expect(parseStories(after)[0].status).toBe('To Do');
  });

  it('AC-0950: snapshots pre-mutation copy to /tmp/docs-pre-norm/', async () => {
    root = mkRoot();
    const filePath = path.join(root, 'docs', 'RELEASE_PLAN.md');
    fs.writeFileSync(filePath, SAMPLE_PLAN);
    // Pre-clean to avoid pollution from prior runs.
    const snapPath = '/tmp/docs-pre-norm/RELEASE_PLAN.md';
    if (fs.existsSync(snapPath)) fs.unlinkSync(snapPath);
    await migration.up({ root });
    expect(fs.existsSync(snapPath)).toBe(true);
    expect(fs.readFileSync(snapPath, 'utf8')).toBe(SAMPLE_PLAN);
  });

  it('throws SerializerStabilityError if pass1 !== pass2 (simulated via mocked serializer)', async () => {
    // This test is HARD to trigger naturally — we'd need a buggy serializer.
    // Instead, mock the serializer so its second call returns different text.
    root = mkRoot();
    const filePath = path.join(root, 'docs', 'RELEASE_PLAN.md');
    fs.writeFileSync(filePath, SAMPLE_PLAN);
    const storySer = require('../../../tools/lib/repository/serializers/story-serializer');
    const real = storySer.serialize;
    let calls = 0;
    storySer.serialize = (s) => {
      calls++;
      // Pass1 emits canonical; pass2 emits a different body to fake instability.
      if (calls === 2) return real(s) + '# fake-second-pass-divergence\n';
      return real(s);
    };
    try {
      await expect(migration.up({ root })).rejects.toThrow(SerializerStabilityError);
    } finally {
      storySer.serialize = real;
    }
  });
});
```

- [ ] **Step 2: Run, expect failure**

```bash
npx jest tests/unit/migrations/data_001-normalise.test.js 2>&1 | tail -4
```

Expected: module-not-found.

- [ ] **Step 3: Implement the migration**

Create `tools/lib/migrations/data_001-normalise-fenced-blocks.js`:

```js
'use strict';

const fs = require('fs');
const path = require('path');

const { SerializerStabilityError } = require('../repository/errors');

const SNAPSHOT_DIR = '/tmp/docs-pre-norm';

/**
 * Per-kind round-trip: parse → serialize-all → return canonical text.
 *
 * release-plan: contains stories + epics inside fenced blocks; we use the
 *   markdown-mutator to replace each entity block in place rather than
 *   re-emit the whole file (which would lose the surrounding prose like
 *   the Phase headers).
 * bugs / lessons / test-cases: entity-only files; we re-emit each
 *   entity in order, joined by blank lines.
 */
const KIND_RENDER = {
  'release-plan': renderReleasePlan,
  bugs: renderBugs,
  lessons: renderLessons,
  'test-cases': renderTestCases,
};

function renderReleasePlan(text) {
  const { parseStories, parseEpics } = require('../parse-release-plan');
  const storySer = require('../repository/serializers/story-serializer');
  const epicSer = require('../repository/serializers/epic-serializer');
  const { replaceBlockInText } = require('../repository/markdown-mutator');
  let out = text;
  for (const story of parseStories(text)) {
    const body = storySer.serialize(story);
    out = replaceBlockInText(out, new RegExp(`^${story.id}\\b`), () => body);
  }
  for (const epic of parseEpics(text)) {
    const body = epicSer.serialize(epic);
    out = replaceBlockInText(out, new RegExp(`^${epic.id}\\b`), () => body);
  }
  return out;
}

function renderBugs(text) {
  const { parseBugs } = require('../parse-bugs');
  const { serialize } = require('../repository/serializers/bug-serializer');
  const bugs = parseBugs(text);
  if (bugs.length === 0) return text;
  const body = bugs.map(serialize).join('\n');
  // Preserve any leading header content (lines before the first BUG- line).
  const firstBugIdx = text.indexOf(bugs[0].id);
  const header = firstBugIdx > 0 ? text.slice(0, firstBugIdx) : '';
  return header + body;
}

function renderLessons(text) {
  const { parseLessons } = require('../parse-lessons');
  const { serialize } = require('../repository/serializers/lesson-serializer');
  const lessons = parseLessons(text);
  if (lessons.length === 0) return text;
  const body = lessons.map(serialize).join('\n');
  const firstIdx = text.indexOf(`## ${lessons[0].id}`);
  const header = firstIdx > 0 ? text.slice(0, firstIdx) : '';
  return header + body;
}

function renderTestCases(text) {
  const { parseTestCases } = require('../parse-test-cases');
  const { serialize } = require('../repository/serializers/test-case-serializer');
  const tcs = parseTestCases(text);
  if (tcs.length === 0) return text;
  const body = tcs.map(serialize).join('\n');
  const firstIdx = text.indexOf(tcs[0].id);
  const header = firstIdx > 0 ? text.slice(0, firstIdx) : '';
  return header + body;
}

const TARGETS = [
  { rel: 'docs/RELEASE_PLAN.md', kind: 'release-plan' },
  { rel: 'docs/BUGS.md', kind: 'bugs' },
  { rel: 'docs/LESSONS.md', kind: 'lessons' },
  { rel: 'docs/TEST_CASES.md', kind: 'test-cases' },
];

const touches = TARGETS.map((t) => t.rel);

async function up({ root }) {
  fs.mkdirSync(SNAPSHOT_DIR, { recursive: true });
  const results = [];
  for (const target of TARGETS) {
    const filePath = path.join(root, target.rel);
    if (!fs.existsSync(filePath)) {
      results.push({ rel: target.rel, status: 'missing' });
      continue;
    }
    const input = fs.readFileSync(filePath, 'utf8');
    // Snapshot.
    const snapPath = path.join(SNAPSHOT_DIR, path.basename(filePath));
    fs.writeFileSync(snapPath, input);
    // Pass 1.
    const render = KIND_RENDER[target.kind];
    const pass1 = render(input);
    // Pass 2.
    const pass2 = render(pass1);
    if (pass1 !== pass2) {
      const diffPath = path.join(SNAPSHOT_DIR, `_pass1-vs-pass2-${path.basename(filePath)}.diff`);
      // Write the two outputs side-by-side as a poor-man's diff (we don't
      // want to shell out to diff(1) from a migration).
      fs.writeFileSync(diffPath, `=== pass1 ===\n${pass1}\n=== pass2 ===\n${pass2}\n`);
      throw new SerializerStabilityError(`Migration 001: pass1 !== pass2 for ${target.rel}; see ${diffPath}`, {
        pass1,
        pass2,
        diffPath,
      });
    }
    if (pass2 === input) {
      results.push({ rel: target.rel, status: 'no-op' });
      continue;
    }
    // Write back via tmp+rename.
    const tmp = filePath + '.tmp';
    fs.writeFileSync(tmp, pass2);
    fs.renameSync(tmp, filePath);
    results.push({ rel: target.rel, status: 'normalised', snapshot: snapPath });
    process.stderr.write(`normalised ${target.rel} (snapshot at ${snapPath})\n`);
  }
  const any = results.some((r) => r.status === 'normalised');
  if (any) {
    process.stderr.write(
      `\n✅ Normalised ${results.filter((r) => r.status === 'normalised').length} file(s). Review with:\n     diff -r ${SNAPSHOT_DIR}/ docs/\n   or just \`git diff\`.\n   Then \`git commit\` to keep the changes, or \`git checkout .\` to revert.\n`,
    );
  }
  return { results };
}

module.exports = { up, touches };
```

- [ ] **Step 4: Run, expect green**

```bash
npx jest tests/unit/migrations/data_001-normalise.test.js 2>&1 | tail -8
```

Expected: 5 passed.

- [ ] **Step 5: Commit**

```bash
git add tools/lib/migrations/data_001-normalise-fenced-blocks.js tests/unit/migrations/data_001-normalise.test.js
git commit -m "[feat] US-0243 | E.4: Migration 001 normalise-fenced-blocks

Implements spec §4.3:
  1. Snapshot each managed file to /tmp/docs-pre-norm/<basename>.
  2. Pass 1: parse → serialize-all → canonical text.
  3. Pass 2: parse(pass1) → serialize-all → confirm pass1 === pass2.
  4. If pass1 !== pass2: SerializerStabilityError with diff sidecar.
  5. If pass2 === input: true no-op (no mtime change, no rewrite).
  6. Else: write pass2 back via tmp+rename. Print stderr guidance.

Closes AC-0950 (run against all 4 managed files), AC-0951 (true no-op
idempotency), AC-0952 (procedural human review via git diff + snapshot).

The runner picks this up via the existing data_NNN- naming convention
(L-0081 / US-0263).

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>"
```

---

## Task 3: Integration test — Migration 001 via pv:upgrade

**Files:**

- Create: `tests/integration/repository/migration-001-roundtrip.test.js`

- [ ] **Step 1: Write the integration test**

```js
'use strict';

const fs = require('fs');
const os = require('os');
const path = require('path');
const { Repository } = require('../../../tools/lib/repository');
const upgrade = require('../../../tools/pv-upgrade');

function mkRoot() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'us0243-mig001-'));
  fs.mkdirSync(path.join(root, 'docs'), { recursive: true });
  fs.writeFileSync(path.join(root, 'package.json'), JSON.stringify({ name: 't', version: '1.0.0' }));
  return root;
}

function runCli(mod, argv) {
  const out = [];
  return mod.main({ argv, stdout: (s) => out.push(s) }).then((rc) => ({ rc, stdout: out.join('\n') }));
}

describe('US-0243: Migration 001 via pv:upgrade', () => {
  let root;
  afterEach(() => {
    Repository._reset();
    if (root) fs.rmSync(root, { recursive: true, force: true });
  });

  it('applies migration on first upgrade, no-op on second', async () => {
    root = mkRoot();
    // Seed with a NON-canonical RELEASE_PLAN.md (extra blank lines etc).
    fs.writeFileSync(
      path.join(root, 'docs', 'RELEASE_PLAN.md'),
      `# Plan\n\n\n\`\`\`\nUS-0001 (EPIC-0001): A\nPriority: High (P1)\nEstimate: M\nStatus: To Do\n\`\`\`\n\n\n`,
    );
    Repository._reset();
    const up1 = await runCli(upgrade, ['--root', root]);
    expect(up1.rc).toBe(0);
    expect(up1.stdout).toMatch(/data_001-normalise-fenced-blocks/);
    const afterFirst = fs.readFileSync(path.join(root, 'docs', 'RELEASE_PLAN.md'), 'utf8');
    // Second run: no-op (the migration is in appliedMigrations now).
    Repository._reset();
    const up2 = await runCli(upgrade, ['--root', root]);
    expect(up2.rc).toBe(0);
    expect(up2.stdout).not.toMatch(/data_001-normalise/); // not re-run
    expect(fs.readFileSync(path.join(root, 'docs', 'RELEASE_PLAN.md'), 'utf8')).toBe(afterFirst);
  });
});
```

- [ ] **Step 2: Run, expect green**

```bash
npx jest tests/integration/repository/migration-001-roundtrip.test.js 2>&1 | tail -8
```

Expected: 1 passed.

- [ ] **Step 3: Commit**

```bash
git add tests/integration/repository/migration-001-roundtrip.test.js
git commit -m "[test] US-0243 | E.4: Migration 001 integration via pv:upgrade

End-to-end gate: upgrade applies the migration once, second invocation
is a no-op (the runner sees data_001 in appliedMigrations and skips).

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>"
```

---

## Task 4: Run audit against production + commit the report

**Files:**

- Create: `docs/architecture/round-trip-audit-2026-05-24.md`

- [ ] **Step 1: Run the audit**

```bash
node tools/audit-round-trip.js
cat /tmp/docs-pre-norm/_round-trip-audit.txt
```

- [ ] **Step 2: Wrap the report in a docs page**

Create `docs/architecture/round-trip-audit-2026-05-24.md` with this template:

```markdown
# Round-Trip Audit — 2026-05-24

Pre-flight audit for Migration 001 (US-0243). Spec §4.4.

## Summary

- Total files audited: <N>
- Total entities parsed: <M>
- Total divergences: <K>

## Divergences

<paste the body of /tmp/docs-pre-norm/\_round-trip-audit.txt here>

## Triage decisions

(For each divergence, document one of:

- "Fixed in serializer X — commit <sha>"
- "Accepted as intentionally dropped — field <name> is legacy / no longer in schema"
  )

## Conclusion

(Either "All divergences resolved; safe to land Migration 001." or
"Open divergences remain; Migration 001 BLOCKED until triage complete.")
```

Fill in the actual numbers + paste the actual report contents + write the actual triage decisions.

- [ ] **Step 3: Commit the report**

```bash
git add docs/architecture/round-trip-audit-2026-05-24.md
git commit -m "[docs] US-0243 | E.4: round-trip audit report (2026-05-24)

Spec §4.4 prerequisite. Audit ran against the production markdown corpus
on 2026-05-24. <N> files, <M> entities, <K> divergences.

(See file body for triage decisions.)

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>"
```

If divergences exist, fix the relevant serializers first (in this same branch) and re-run the audit until zero — only then commit the report.

---

## Task 5: Coverage + finishing-a-development-branch

- [ ] **Step 1: Coverage**

```bash
npx jest --coverage --runInBand tests/unit/migrations/data_001-normalise.test.js tests/unit/repository/round-trip-audit.test.js tests/integration/repository/migration-001-roundtrip.test.js 2>&1 | grep -E "data_001|round-trip-audit"
```

Expected: ≥80% on both modules.

- [ ] **Step 2: Full suite + lint**

```bash
npx jest --runInBand --silent 2>&1 | tail -4
npm run lint 2>&1 | tail -3
npm run format:check 2>&1 | tail -3
```

- [ ] **Step 3: Hand off**

Announce: "I'm using the finishing-a-development-branch skill to complete this work."

Expected PR title: `feat: US-0243 — Migration 001 normalise-fenced-blocks + round-trip audit`.

PR body should:

- List AC-0950..AC-0952.
- Link the committed audit report.
- Note any serializer fixes made during pre-flight (Task 1 Step 6 outcome B).
- Warn reviewers: this PR's merge will trigger normalisation on every `pv:upgrade` — they should `git diff` after upgrade and `git commit` only if the diff is acceptable.

---

## Self-Review

### Spec coverage

| Spec item                                                           | Task                                                                                                                                                                    |
| ------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| §4.3 parse → serialize → parse → serialize algorithm                | Task 2                                                                                                                                                                  |
| §4.3 fail-loud on pass1 != pass2 with diff sidecar                  | Task 2                                                                                                                                                                  |
| §4.3 true no-op when pass2 === input                                | Task 2                                                                                                                                                                  |
| §4.3 snapshot to /tmp/docs-pre-norm/                                | Task 2                                                                                                                                                                  |
| §4.3 stderr guidance message                                        | Task 2 impl                                                                                                                                                             |
| §4.4 pre-flight round-trip completeness audit                       | Tasks 1, 4                                                                                                                                                              |
| AC-0950 applies to RELEASE_PLAN/BUGS/LESSONS/TEST_CASES/ID_REGISTRY | Task 2 TARGETS — ID_REGISTRY excluded because its serializer doesn't exist (US-0241 manipulates pipe rows directly, no fenced blocks); note this in the migration JSDoc |
| AC-0951 second run is no-op                                         | Task 2 test                                                                                                                                                             |
| AC-0952 git-as-gate human review                                    | Task 2 stderr msg + Task 5 PR-body warning                                                                                                                              |

### Placeholder scan

No "TBD"/"TODO" tokens. Outcome B in Task 1 Step 6 explicitly enumerates the two triage paths.

### Type consistency

- `migration.up({root})` returns `Promise<{results: Array<{rel, status}>}>` — matches the runner's expectation.
- `migration.touches: string[]` — matches the snapshot mechanism in `tools/lib/migrations/backup.js`.
- `auditFile({path, kind})` and `auditAll(targets)` return the same `{entitiesParsed, divergences}` / `{totalFiles, totalEntities, totalDivergences, perFile}` shape.

### Deviation from spec — ID_REGISTRY normalisation

Spec §4.3 lists `ID_REGISTRY.md` as a target. The ID_REGISTRY format is a pipe-table, not fenced blocks — `id-allocator.js` mutates it via in-place row replacement, not via serializer round-trip. Migration 001 cannot normalise it through the parse→serialize protocol because there is no `id-registry-serializer`. **Decision:** exclude `ID_REGISTRY.md` from Migration 001's TARGETS list. Document in the migration's JSDoc. AC-0950 originally said "RELEASE_PLAN.md, BUGS.md, LESSONS.md, TEST_CASES.md, ID_REGISTRY.md" — the implementer should update the AC at merge time to read "...ID_REGISTRY.md (excluded — pipe-table format)".
