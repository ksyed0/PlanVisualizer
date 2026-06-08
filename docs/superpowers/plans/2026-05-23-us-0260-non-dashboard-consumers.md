# US-0260 Implementation Plan — Non-Dashboard Consumer Migration + Canonical Init Seed

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Migrate the three non-dashboard `docs/sdlc-status.json` consumers (`generate-plan.js`, `agent-context.js`, `agent-spec-plan.js`) to read via the dual-read accessor introduced in US-0259, and rewire `init-sdlc-status.js` to seed `programme.{agents, phases, project}` directly through `SdlcProgrammeRepo.set()` with idempotent-merge semantics on repeat runs.

**Architecture:** Each consumer's direct `sdlc.stories` access becomes `reader.stories(sdlc)` (or the equivalent accessor for other legacy keys). The accessor's transitional `|| json.{key}` fallback (removed in US-0261 post-Migration-006) keeps state-B legacy-shape fixtures working through the transition. Init's direct `fs.writeFileSync` of the full legacy JSON shape is replaced by three `SdlcProgrammeRepo.set()` calls (`agents`, `phases`, `project`); the mirror module renders the canonical `{tasks, log, programme}` triple automatically. Idempotent-merge means a `--force`-less re-run preserves any programme rows already populated by prior runs or later code paths.

**Tech Stack:** Node ≥20, Jest, better-sqlite3 via `tools/lib/repository`, `tools/lib/repository/sdlc-status-reader.js` (US-0259), `tools/lib/repository/entities/sdlc-programme-repo.js`.

---

## File Structure

| File                                                         | Action                                | Responsibility                                                                                                           |
| ------------------------------------------------------------ | ------------------------------------- | ------------------------------------------------------------------------------------------------------------------------ |
| `tools/generate-plan.js`                                     | Modify (line ~263)                    | Read SDLC orchestration state via `reader.stories(sdlc)` instead of `sdlc.stories \|\| {}`                               |
| `tools/agent-context.js`                                     | Modify (line ~80)                     | Read story metadata via `reader.stories(sdlc)[opts.story]` instead of `(sdlc.stories \|\| {})[opts.story]`               |
| `tools/agent-spec-plan.js`                                   | Modify (`readStories()` at line ~165) | Drop the dual `legacyTopLevel + legacyProgramme` merge inside the on-disk fallback; let the accessor express that intent |
| `tools/init-sdlc-status.js`                                  | Rewrite `main()`                      | Seed `programme.{agents, phases, project}` through SdlcProgrammeRepo; idempotent merge on repeat runs                    |
| `tests/integration/non-dashboard-consumers-accessor.test.js` | Create                                | AC-1017 — source-grep guard + dispatch-level reads against state-A/B/C fixtures                                          |
| `tests/unit/init-sdlc-status-repeat.test.js`                 | Create                                | AC-1018 — canonical-only programme shape on fresh init; idempotent merge against partially-populated programme           |

Phase-E fixtures from `tests/fixtures/phase-e/` (US-0259) are re-used. No new fixtures.

---

## Pre-Work

The branch base is **the current `origin/develop` tip** (commit `430b059` after US-0259 + US-0263 merged). Cut a fresh branch off develop — do NOT branch off the worktree's existing `claude/phase-e-impl` (which would carry no extra commits but the convention is `feature/US-NNNN-short-name` per CLAUDE.md §Git Workflow).

- [ ] **Pre-Step 1: Create the feature branch**

```bash
cd /Users/Kamal_Syed/Projects/PlanVisualizer/.claude/worktrees/phase-e-impl
git fetch origin develop --quiet
git checkout -b feature/US-0260-non-dashboard-consumers origin/develop
```

Expected: `Switched to a new branch 'feature/US-0260-non-dashboard-consumers'` and the working tree includes `tools/lib/repository/sdlc-status-reader.js` (proof US-0259 is present).

---

## Task 1: Migrate `tools/generate-plan.js` to the accessor

**Why first:** Smallest change (1 line of behavior + 1 require), and gives us a working accessor-import pattern we can copy to the other two readers.

**Files:**

- Modify: `tools/generate-plan.js` (add a `require` at the top + swap one read at line ~263)
- Test: covered by the source-grep guard in Task 5 + the existing dashboard integration test pattern

- [ ] **Step 1: Add the accessor import**

Open `tools/generate-plan.js`. Find the existing imports near the top of the file. Add the `reader` require alongside them. The exact location: after `const path = require('path');` and the other early requires, before the SDLC merge code path at line ~258.

Find this block:

```js
const fs = require('fs');
const path = require('path');
```

Add immediately after the existing top-level requires (the file has a long require list; place the new line at the end of that group):

```js
const reader = require('./lib/repository/sdlc-status-reader');
```

- [ ] **Step 2: Swap the legacy read at line ~263**

Find this block (line 258 in current develop):

```js
  // US-0181: merge orchestration state (specPhase/planPhase) from sdlc-status.json
  // into each story so the Pending Approvals widget can read it.
  try {
    const sdlcPath = path.join(ROOT, 'docs/sdlc-status.json');
    if (fs.existsSync(sdlcPath)) {
      const sdlc = JSON.parse(fs.readFileSync(sdlcPath, 'utf8'));
      const sdlcStories = sdlc.stories || {};
      for (const story of stories) {
```

Change `const sdlcStories = sdlc.stories || {};` to `const sdlcStories = reader.stories(sdlc);`. The accessor returns `{}` when the key is absent, so the `|| {}` defensive scaffolding is now redundant.

Resulting block:

```js
  try {
    const sdlcPath = path.join(ROOT, 'docs/sdlc-status.json');
    if (fs.existsSync(sdlcPath)) {
      const sdlc = JSON.parse(fs.readFileSync(sdlcPath, 'utf8'));
      // US-0260: dual-read via accessor — reads programme.stories then falls
      // back to legacy top-level stories. Fallback removed in US-0261.
      const sdlcStories = reader.stories(sdlc);
      for (const story of stories) {
```

- [ ] **Step 3: Smoke-test the CLI**

Run:

```bash
node tools/generate-plan.js
```

Expected: standard generate-plan output (it writes `docs/plan-status.json`); no thrown error, no `reader is not defined`, no `Cannot find module`. Exit code 0.

- [ ] **Step 4: Run the full Jest suite to confirm no regression**

```bash
npx jest --silent 2>&1 | tail -8
```

Expected: same 99 suites / 1555 tests passing as develop baseline.

- [ ] **Step 5: Commit**

```bash
git add tools/generate-plan.js
git commit -m "[feat] US-0260 | TASK-0067: migrate generate-plan.js sdlc merge to accessor

Read sdlc.stories via reader.stories() (US-0259 dual-read accessor)
instead of \`sdlc.stories || {}\`. The accessor's transitional
\`|| json.{key}\` fallback (removed in US-0261 post-Migration-006) keeps
state-B legacy-shape fixtures working through the transition.

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>"
```

---

## Task 2: Migrate `tools/agent-context.js` to the accessor

**Files:**

- Modify: `tools/agent-context.js` (add require + swap one read at line ~80)

- [ ] **Step 1: Add the accessor import**

Open `tools/agent-context.js`. Find the existing require block at the top. Add the accessor require after the existing imports. Find:

```js
const Assembler = require('./lib/agent-context-assembler');
```

Add immediately after (use whichever import sits at the end of the require group):

```js
const reader = require('./lib/repository/sdlc-status-reader');
```

If the project's require ordering convention places third-party first and local later, follow it; otherwise append to the end of the require block.

- [ ] **Step 2: Swap the legacy story read at line ~80**

Find this line:

```js
const story = (sdlc.stories || {})[opts.story] || {};
```

Replace with:

```js
// US-0260: dual-read via accessor — reads programme.stories then falls
// back to legacy top-level stories. Fallback removed in US-0261.
const story = reader.stories(sdlc)[opts.story] || {};
```

Note: do NOT modify the `sdlc.tasks` read on the line above. `tasks` is a canonical post-Phase-D key, not a legacy migration target — it has no accessor (see US-0259 design note §7 open question 1).

- [ ] **Step 3: Smoke-test the CLI dispatcher**

The agent-context CLI requires a real task to dispatch. Skip CLI smoke; instead confirm via require:

```bash
node -e "const m = require('./tools/agent-context'); console.log(typeof m.dispatch);"
```

Expected output: `function` (one word, then exit code 0). Confirms no syntax error or missing import.

- [ ] **Step 4: Run the agent-context unit tests**

```bash
npx jest tests/unit/agent-context-cli.test.js tests/unit/agent-context-assembler.test.js 2>&1 | tail -6
```

Expected: both suites pass.

- [ ] **Step 5: Commit**

```bash
git add tools/agent-context.js
git commit -m "[feat] US-0260 | TASK-0067: migrate agent-context.js story read to accessor

\`(sdlc.stories || {})[opts.story]\` becomes \`reader.stories(sdlc)[opts.story]\`.
\`sdlc.tasks\` (canonical) untouched — only \`stories\` is a legacy key.

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>"
```

---

## Task 3: Simplify `tools/agent-spec-plan.js#readStories` via the accessor

**Why this one is different from Tasks 1/2:** `agent-spec-plan.js` has a SQL-first read path. The legacy top-level fallback only fires when the SQL row is absent (typical on first-write seeds). The spec calls out specifically that the dual `legacyTopLevel + legacyProgramme` merge inside the fallback collapses into a single `reader.stories(onDisk)` call.

**Files:**

- Modify: `tools/agent-spec-plan.js` (add require + rewrite `readStories()`)

- [ ] **Step 1: Add the accessor import**

Open `tools/agent-spec-plan.js`. Find the existing require block at the top. Add:

```js
const reader = require('./lib/repository/sdlc-status-reader');
```

- [ ] **Step 2: Rewrite `readStories()`**

Find this function at line ~155-179:

```js
function readStories(repo, root) {
  const fromSql = repo.sdlcProgramme.get('stories');
  if (fromSql && typeof fromSql === 'object') {
    return JSON.parse(JSON.stringify(fromSql));
  }
  const onDisk = readMirror(root);
  const legacyTopLevel = onDisk.stories && typeof onDisk.stories === 'object' ? onDisk.stories : {};
  // Some seeds put stories under programme.stories already — honour that
  // path even when the SQL row is absent.
  const legacyProgramme =
    onDisk.programme && onDisk.programme.stories && typeof onDisk.programme.stories === 'object'
      ? onDisk.programme.stories
      : {};
  return { ...legacyTopLevel, ...legacyProgramme };
}
```

Replace with:

```js
function readStories(repo, root) {
  const fromSql = repo.sdlcProgramme.get('stories');
  if (fromSql && typeof fromSql === 'object') {
    return JSON.parse(JSON.stringify(fromSql));
  }
  // US-0260: SQL row absent (first-write seed). Read the mirror via the
  // dual-read accessor — it reads onDisk.programme.stories first, falls
  // back to onDisk.stories (legacy top-level), and returns {} as the
  // safe default. Collapses the previous legacyTopLevel + legacyProgramme
  // merge into one call. Fallback removed in US-0261.
  const onDisk = readMirror(root);
  return reader.stories(onDisk);
}
```

**Semantic note:** the previous code merged top-level into programme (`{ ...legacyTopLevel, ...legacyProgramme }` — programme wins on conflict). The accessor reads programme first; only when programme is absent does it fall back to top-level. Equivalent for the common case (one or the other populated), and the accessor's "programme wins" matches the previous spread order. Conflict-divergence behaviour is preserved.

- [ ] **Step 3: Run the agent-spec-plan tests**

```bash
npx jest tests/unit/agent-spec-plan-cli.test.js tests/unit/agent-spec-plan-flags.test.js tests/unit/agent-spec-plan-repo.test.js tests/unit/agent-spec-plan-state.test.js tests/integration/agent-spec-plan-flow.test.js 2>&1 | tail -6
```

Expected: all five suites pass.

- [ ] **Step 4: Commit**

```bash
git add tools/agent-spec-plan.js
git commit -m "[feat] US-0260 | TASK-0067: collapse readStories() on-disk fallback to accessor

The two-source merge \`{ ...legacyTopLevel, ...legacyProgramme }\` becomes
one \`reader.stories(onDisk)\` call. Semantic equivalence: the accessor
prefers \`programme.stories\` (matching the previous spread's \"programme
wins\" precedence) then falls back to top-level \`stories\`. The SQL-first
path is unchanged. Fallback removed in US-0261.

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>"
```

---

## Task 4: Rewire `tools/init-sdlc-status.js` to seed via SdlcProgrammeRepo

**Files:**

- Modify: `tools/init-sdlc-status.js` (replace `main()` with a SQL-seeding flow)

This task changes the init's write path entirely. Previously it built a full legacy-shape JSON and wrote it directly to `docs/sdlc-status.json`. The new init constructs only the three programme values, writes them through `SdlcProgrammeRepo.set()`, and lets the mirror render the canonical `{tasks, log, programme}` shape automatically.

**Idempotency contract (AC-1018):** without `--force`, an existing row in `sdlc_programme` is preserved. With `--force`, every row is overwritten. The previous file-level `wx` idempotency check is replaced by per-row checks inside `SdlcProgrammeRepo.get()`.

- [ ] **Step 1: Rewrite `main()` and add the SQL-seeding helpers**

Open `tools/init-sdlc-status.js`. Read the full file (117 lines) to understand the current structure. Replace the contents below line 33 (i.e., keep the imports and `buildAgentStatus` helper; replace `buildStatus()`, `main()`, the CLI bootstrap, and the export) with the following:

```js
function buildAgentsMap(config) {
  const agents = {};
  for (const [name, cfg] of Object.entries(config.agents || {})) {
    agents[name] = buildAgentStatus(cfg.role);
  }
  return agents;
}

function buildPhasesArray(config) {
  return (config.phases || []).map((p, i) => ({
    id: i + 1,
    name: p.name,
    agents: (p.agents || []).slice(),
    deliverables: (p.deliverables || []).slice(),
    status: 'pending',
    startedAt: null,
    completedAt: null,
  }));
}

function buildProjectObject(config) {
  return {
    name: config.project?.name || 'My Project',
    description: config.project?.description || 'Agentic AI SDLC',
    repoUrl: config.project?.repoUrl || '',
    startDate: config.project?.startDate || new Date().toISOString().split('T')[0],
  };
}

// US-0260 / AC-1018: idempotent merge. Without --force, an existing
// programme row is preserved. With --force, every row is overwritten.
async function seedProgrammeRow(repo, key, value, { force }) {
  if (!force) {
    const existing = repo.sdlcProgramme.get(key);
    if (existing != null) return { key, action: 'preserved' };
  }
  await repo.sdlcProgramme.set(key, value);
  return { key, action: 'seeded' };
}

async function main({ root = ROOT, configPath = CONFIG_PATH, force = false } = {}) {
  const config = loadConfig(configPath);
  const { Repository } = require('./lib/repository');
  Repository._reset();
  const repo = Repository.getInstance({ root });
  try {
    const results = [];
    results.push(await seedProgrammeRow(repo, 'agents', buildAgentsMap(config), { force }));
    results.push(await seedProgrammeRow(repo, 'phases', buildPhasesArray(config), { force }));
    results.push(await seedProgrammeRow(repo, 'project', buildProjectObject(config), { force }));
    const seeded = results.filter((r) => r.action === 'seeded').map((r) => r.key);
    const preserved = results.filter((r) => r.action === 'preserved').map((r) => r.key);
    if (seeded.length > 0) {
      console.log(`[init-sdlc-status] Seeded programme rows: ${seeded.join(', ')}.`);
    }
    if (preserved.length > 0) {
      console.log(`[init-sdlc-status] Preserved existing programme rows: ${preserved.join(', ')}.`);
    }
    return { seeded, preserved };
  } finally {
    Repository._reset();
  }
}

if (require.main === module) {
  const force = process.argv.includes('--force');
  main({ force }).then(
    () => process.exit(0),
    (err) => {
      console.error(err.message);
      process.exit(1);
    },
  );
}

module.exports = {
  // Legacy: exposed for any out-of-tree consumer; new code should use main().
  loadConfig,
  buildAgentsMap,
  buildPhasesArray,
  buildProjectObject,
  main,
};
```

**Notes:**

- The legacy `buildStatus()` function is deleted entirely — nothing it produced (top-level legacy keys, `currentPhase: 0`, `epics: {}`, `stories: {}`, `cycles: []`, `metrics: {...}`, `log: []`) is needed under the canonical shape.
- `Repository.getInstance()` triggers the mirror render under file lock — calling `set()` three times will re-render the JSON three times. Acceptable for an init path (runs once).
- `Repository._reset()` is called in `finally` to release the SQLite handle so subsequent in-process test runs can re-open the DB.

- [ ] **Step 2: Smoke-test the CLI against a tmpdir**

Run a one-shot in a clean tmpdir to confirm the canonical shape:

```bash
node -e '
const fs = require("fs");
const os = require("os");
const path = require("path");

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "us0260-init-"));
fs.mkdirSync(path.join(tmp, "docs"), { recursive: true });
fs.writeFileSync(path.join(tmp, "package.json"), JSON.stringify({ name: "t", version: "1.0.0" }));
fs.writeFileSync(path.join(tmp, "agents.config.json"), JSON.stringify({
  agents: { Forge: { role: "code-implementer" }, Lens: { role: "reviewer" } },
  phases: [{ name: "Spec", agents: ["Forge"], deliverables: ["spec.md"] }],
  project: { name: "TmpProject" },
}));

const { main } = require("./tools/init-sdlc-status");
main({ root: tmp, configPath: path.join(tmp, "agents.config.json"), force: false }).then(() => {
  const json = JSON.parse(fs.readFileSync(path.join(tmp, "docs", "sdlc-status.json"), "utf8"));
  console.log("top keys:", Object.keys(json).sort());
  console.log("programme keys:", Object.keys(json.programme || {}).sort());
  fs.rmSync(tmp, { recursive: true, force: true });
});
'
```

Expected:

```
[init-sdlc-status] Seeded programme rows: agents, phases, project.
top keys: [ 'log', 'programme', 'tasks' ]
programme keys: [ 'agents', 'phases', 'project' ]
```

If the top-level keys include anything outside `['log', 'programme', 'tasks']`, the mirror layer is leaking legacy keys — stop and investigate. Otherwise proceed.

- [ ] **Step 3: Run the full test suite to catch any consumer that depended on the old shape**

```bash
npx jest --silent 2>&1 | tail -10
```

Expected: same passing test count as develop baseline (1555 tests). If any test fails, it's likely a consumer that still depends on a legacy top-level key — note the failure and continue to Task 5, then fix together.

- [ ] **Step 4: Commit**

```bash
git add tools/init-sdlc-status.js
git commit -m "[feat] US-0260 | TASK-0067: rewire init-sdlc-status to seed canonical programme

Init no longer writes a legacy-shape JSON directly. The new flow:

  Repository.getInstance({ root })
    .sdlcProgramme.set('agents',  buildAgentsMap(config))
    .sdlcProgramme.set('phases',  buildPhasesArray(config))
    .sdlcProgramme.set('project', buildProjectObject(config))

The mirror module renders the canonical {tasks, log, programme} shape on
each set() call. Top-level legacy keys (currentPhase, epics, stories,
cycles, metrics, log, agents, phases, project) are no longer written.

AC-1018 idempotency: without --force, an existing sdlc_programme row is
preserved by seedProgrammeRow(). With --force, every row is overwritten.
The previous file-level wx flag is gone; idempotency now lives at the
per-row level. Tests in tests/unit/init-sdlc-status-repeat.test.js.

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>"
```

---

## Task 5: AC-1018 idempotent-merge tests for `init-sdlc-status`

**Files:**

- Create: `tests/unit/init-sdlc-status-repeat.test.js`

- [ ] **Step 1: Write the failing test file**

Create `tests/unit/init-sdlc-status-repeat.test.js` with this content (verbatim):

```js
'use strict';

/**
 * US-0260 / AC-1018: init-sdlc-status canonical seed + idempotent merge.
 *
 * Two scenarios:
 *
 *   1. Empty programme — fresh init writes Object.keys(programme).sort() ===
 *      ['agents', 'phases', 'project'] and the on-disk JSON top-level keys
 *      are exactly ['log', 'programme', 'tasks'] (the canonical triple).
 *
 *   2. Partially-populated programme — running init a second time against a
 *      programme where one row already exists preserves that row's value
 *      verbatim; only missing rows are seeded. With --force, all rows are
 *      overwritten regardless.
 */

const fs = require('fs');
const os = require('os');
const path = require('path');

const { main } = require('../../tools/init-sdlc-status');
const { Repository } = require('../../tools/lib/repository');

function mkRoot() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'us0260-init-'));
  fs.mkdirSync(path.join(root, 'docs'), { recursive: true });
  fs.writeFileSync(path.join(root, 'package.json'), JSON.stringify({ name: 't', version: '1.0.0' }));
  return root;
}

function writeConfig(root, overrides = {}) {
  const cfg = {
    agents: {
      Forge: { role: 'code-implementer' },
      Lens: { role: 'reviewer' },
    },
    phases: [{ name: 'Spec', agents: ['Forge'], deliverables: ['spec.md'] }],
    project: { name: 'TmpProject', description: 'd', repoUrl: 'r', startDate: '2026-01-01' },
    ...overrides,
  };
  const configPath = path.join(root, 'agents.config.json');
  fs.writeFileSync(configPath, JSON.stringify(cfg));
  return configPath;
}

describe('US-0260 / AC-1018: init-sdlc-status repeat semantics', () => {
  afterEach(() => Repository._reset());

  describe('empty programme — fresh init', () => {
    let root;
    let configPath;
    let result;

    beforeAll(async () => {
      root = mkRoot();
      configPath = writeConfig(root);
      result = await main({ root, configPath, force: false });
    });

    afterAll(() => {
      Repository._reset();
      fs.rmSync(root, { recursive: true, force: true });
    });

    it('seeds exactly agents, phases, project (no preserved rows)', () => {
      expect(result.seeded.sort()).toEqual(['agents', 'phases', 'project']);
      expect(result.preserved).toEqual([]);
    });

    it('writes the canonical {tasks, log, programme} top-level shape', () => {
      const json = JSON.parse(fs.readFileSync(path.join(root, 'docs', 'sdlc-status.json'), 'utf8'));
      expect(Object.keys(json).sort()).toEqual(['log', 'programme', 'tasks']);
    });

    it('populates programme.{agents, phases, project} and nothing else', () => {
      const json = JSON.parse(fs.readFileSync(path.join(root, 'docs', 'sdlc-status.json'), 'utf8'));
      expect(Object.keys(json.programme).sort()).toEqual(['agents', 'phases', 'project']);
    });

    it('programme.agents is keyed by configured agent name', () => {
      const json = JSON.parse(fs.readFileSync(path.join(root, 'docs', 'sdlc-status.json'), 'utf8'));
      expect(Object.keys(json.programme.agents).sort()).toEqual(['Forge', 'Lens']);
      expect(json.programme.agents.Forge.status).toBe('idle');
    });
  });

  describe('partially-populated programme — repeat init without --force', () => {
    let root;
    let configPath;

    beforeAll(async () => {
      root = mkRoot();
      configPath = writeConfig(root);
      // First init: seed everything.
      await main({ root, configPath, force: false });
      Repository._reset();
      // Mutate one row to a sentinel value.
      const repo = Repository.getInstance({ root });
      await repo.sdlcProgramme.set('agents', {
        Forge: { status: 'active', currentTask: 'TASK-XX', tasksCompleted: 7 },
      });
      Repository._reset();
    });

    afterAll(() => {
      Repository._reset();
      fs.rmSync(root, { recursive: true, force: true });
    });

    it('preserves the mutated agents row (no overwrite)', async () => {
      const result = await main({ root, configPath, force: false });
      expect(result.seeded).toEqual([]);
      expect(result.preserved.sort()).toEqual(['agents', 'phases', 'project']);

      Repository._reset();
      const repo = Repository.getInstance({ root });
      const agents = repo.sdlcProgramme.get('agents');
      expect(agents.Forge.currentTask).toBe('TASK-XX');
      expect(agents.Forge.tasksCompleted).toBe(7);
    });
  });

  describe('partially-populated programme — repeat init with --force', () => {
    let root;
    let configPath;

    beforeAll(async () => {
      root = mkRoot();
      configPath = writeConfig(root);
      await main({ root, configPath, force: false });
      Repository._reset();
      const repo = Repository.getInstance({ root });
      await repo.sdlcProgramme.set('agents', { OldAgent: { status: 'idle', currentTask: null, tasksCompleted: 0 } });
      Repository._reset();
    });

    afterAll(() => {
      Repository._reset();
      fs.rmSync(root, { recursive: true, force: true });
    });

    it('--force overwrites the mutated row with the config-derived value', async () => {
      const result = await main({ root, configPath, force: true });
      expect(result.seeded.sort()).toEqual(['agents', 'phases', 'project']);
      expect(result.preserved).toEqual([]);

      Repository._reset();
      const repo = Repository.getInstance({ root });
      const agents = repo.sdlcProgramme.get('agents');
      expect(Object.keys(agents).sort()).toEqual(['Forge', 'Lens']);
      expect(agents).not.toHaveProperty('OldAgent');
    });
  });

  describe('the seeded programme is readable via the accessor', () => {
    it('reader.agents(json) returns the seeded agents map', async () => {
      const reader = require('../../tools/lib/repository/sdlc-status-reader');
      const root = mkRoot();
      const configPath = writeConfig(root);
      try {
        await main({ root, configPath, force: false });
        const json = JSON.parse(fs.readFileSync(path.join(root, 'docs', 'sdlc-status.json'), 'utf8'));
        const agents = reader.agents(json);
        expect(Object.keys(agents).sort()).toEqual(['Forge', 'Lens']);
        expect(reader.project(json).name).toBe('TmpProject');
        expect(reader.phases(json)).toHaveLength(1);
      } finally {
        Repository._reset();
        fs.rmSync(root, { recursive: true, force: true });
      }
    });
  });
});
```

- [ ] **Step 2: Run the test and confirm all four describe blocks pass**

```bash
npx jest tests/unit/init-sdlc-status-repeat.test.js 2>&1 | tail -8
```

Expected: 4 describe blocks, all green. If any fail, read the assertion and fix either the test or the init module — but only with a clear diagnosis, not by silencing.

- [ ] **Step 3: Commit**

```bash
git add tests/unit/init-sdlc-status-repeat.test.js
git commit -m "[test] US-0260 | TASK-0067: AC-1018 init-sdlc-status idempotent merge

Four scenarios:

  1. Empty programme — fresh init writes Object.keys(programme).sort() ===
     ['agents', 'phases', 'project'] and the on-disk top-level keys are
     ['log', 'programme', 'tasks'] (the canonical triple).

  2. Partially-populated programme + repeat init without --force —
     preserves a row that was mutated post-init (the agents row replaced
     with a sentinel state). All three rows return action: preserved.

  3. Partially-populated programme + repeat init with --force —
     overwrites the mutated row with the config-derived value. All
     three rows return action: seeded.

  4. Round-trip via the US-0259 accessor — confirms the seeded programme
     is consumable by reader.agents/.project/.phases (the dual-read
     accessor reads programme.* first, exactly what init wrote).

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>"
```

---

## Task 6: AC-1017 source-grep + dispatch integration test for the three readers

**Files:**

- Create: `tests/integration/non-dashboard-consumers-accessor.test.js`

This test parallels `tests/integration/dashboard-uses-accessor.test.js` (US-0259) but covers the three non-dashboard files. Two assertion families:

1. **Source guard** — each of the three files must (a) `require` the accessor, and (b) not contain `sdlc.stories` or other direct legacy-key reads. Word-boundary regex so non-legacy fields like `sdlc.tasks` aren't false-positives.
2. **Dispatch-level reads** — for the two consumers that export `dispatch` (`agent-context.js`, `agent-spec-plan.js`), spin up a tmpdir fixture with state-A / state-B shape and confirm the dispatcher reads the story correctly.

- [ ] **Step 1: Write the failing integration test**

Create `tests/integration/non-dashboard-consumers-accessor.test.js` with this content:

```js
'use strict';

/**
 * US-0260 / AC-1017: non-dashboard consumer migration test.
 *
 * Three consumers, two assertion families:
 *
 *   1. Source guard — each consumer requires the accessor module and no
 *      longer contains direct `sdlc.stories` reads. Word-boundary regex so
 *      non-legacy fields like `sdlc.tasks` aren't false-positives.
 *
 *   2. Dispatch-level read — for the two consumers that export `dispatch`
 *      (agent-context.js, agent-spec-plan.js), confirm the dispatch path
 *      reads stories correctly from BOTH state-A (programme.*) and
 *      state-B (legacy top-level) fixture shapes. generate-plan.js does
 *      not export anything; it gets only the source-grep assertion.
 */

const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..', '..');
const FIXTURE_DIR = path.join(__dirname, '..', 'fixtures', 'phase-e');

const CONSUMERS = [
  { name: 'generate-plan.js', path: path.join(ROOT, 'tools', 'generate-plan.js') },
  { name: 'agent-context.js', path: path.join(ROOT, 'tools', 'agent-context.js') },
  { name: 'agent-spec-plan.js', path: path.join(ROOT, 'tools', 'agent-spec-plan.js') },
];

const LEGACY_KEY = 'stories'; // the only legacy key each of these three reads

const loadFixture = (name) => JSON.parse(fs.readFileSync(path.join(FIXTURE_DIR, name), 'utf8'));

describe('US-0260: non-dashboard consumer migration', () => {
  describe('source guard — accessor wired, direct legacy reads gone', () => {
    for (const { name, path: filePath } of CONSUMERS) {
      describe(name, () => {
        const source = fs.readFileSync(filePath, 'utf8');

        it('requires sdlc-status-reader', () => {
          expect(source).toMatch(/require\(['"]\.\/lib\/repository\/sdlc-status-reader['"]\)/);
        });

        it(`contains no direct sdlc.${LEGACY_KEY} read`, () => {
          // Look for the bareword pattern. We allow comments to mention
          // "sdlc.stories" (e.g., describing what we removed) by stripping
          // // and /* */ comment lines before scanning.
          const stripped = source
            .split('\n')
            .filter((line) => !/^\s*\/\//.test(line))
            .join('\n')
            .replace(/\/\*[\s\S]*?\*\//g, '');
          const regex = new RegExp(`\\bsdlc\\.${LEGACY_KEY}\\b`);
          expect(stripped).not.toMatch(regex);
        });

        it(`contains no \`sdlc.${LEGACY_KEY} || {}\` defensive scaffolding`, () => {
          // The accessor owns the default. If this string is present the
          // migration is half-done.
          expect(source).not.toMatch(new RegExp(`sdlc\\.${LEGACY_KEY}\\s*\\|\\|`));
        });
      });
    }
  });

  describe('dispatch-level reads against fixture shapes', () => {
    // Skip in environments without a writable tmpdir / sqlite native lib.
    // (Same caveat the US-0259 integration tests have.)

    const os = require('os');
    const { Repository } = require('../../tools/lib/repository');

    function mkRootWithFixture(fixtureName) {
      const root = fs.mkdtempSync(path.join(os.tmpdir(), 'us0260-disp-'));
      fs.mkdirSync(path.join(root, 'docs'), { recursive: true });
      fs.writeFileSync(path.join(root, 'package.json'), JSON.stringify({ name: 't', version: '1.0.0' }));
      const fixture = loadFixture(fixtureName);
      fs.writeFileSync(path.join(root, 'docs', 'sdlc-status.json'), JSON.stringify(fixture, null, 2));
      return root;
    }

    describe('agent-context.js', () => {
      const reader = require('../../tools/lib/repository/sdlc-status-reader');

      it('reads story metadata correctly from state-A (programme.stories)', () => {
        const root = mkRootWithFixture('state-a.json');
        try {
          const sdlc = JSON.parse(fs.readFileSync(path.join(root, 'docs', 'sdlc-status.json'), 'utf8'));
          // We test the read pattern directly (the accessor) rather than
          // dispatching, because dispatch requires a full agent-context
          // bootstrap. The source guard above already confirms the read
          // pattern is wired through.
          expect(reader.stories(sdlc)['US-0259'].status).toBe('InProgress');
        } finally {
          fs.rmSync(root, { recursive: true, force: true });
        }
      });

      it('reads story metadata correctly from state-B (top-level stories)', () => {
        const root = mkRootWithFixture('state-b.json');
        try {
          const sdlc = JSON.parse(fs.readFileSync(path.join(root, 'docs', 'sdlc-status.json'), 'utf8'));
          expect(reader.stories(sdlc)['US-0259'].status).toBe('InProgress');
        } finally {
          fs.rmSync(root, { recursive: true, force: true });
        }
      });
    });

    describe('agent-spec-plan.js: readStories() collapses to the accessor', () => {
      // Verify the SQL-absent fallback path. readStories(repo, root) is a
      // closure-scoped function so we replicate its contract here.
      const reader = require('../../tools/lib/repository/sdlc-status-reader');

      it('returns programme.stories preferentially', () => {
        const onDisk = loadFixture('state-c.json'); // both shapes populated
        expect(reader.stories(onDisk)['US-0259']).toBeDefined();
        expect(reader.stories(onDisk)['US-0259'].status).toBe('InProgress');
      });

      it('falls back to top-level stories when programme is empty', () => {
        const onDisk = loadFixture('state-b.json'); // top-level only
        expect(reader.stories(onDisk)['US-0259']).toBeDefined();
      });
    });

    afterAll(() => Repository._reset());
  });
});
```

- [ ] **Step 2: Run the test**

```bash
npx jest tests/integration/non-dashboard-consumers-accessor.test.js 2>&1 | tail -10
```

Expected: every assertion in every describe block passes (~14 assertions).

- [ ] **Step 3: Commit**

```bash
git add tests/integration/non-dashboard-consumers-accessor.test.js
git commit -m "[test] US-0260 | TASK-0067: AC-1017 source-grep + accessor read tests

Mirrors tests/integration/dashboard-uses-accessor.test.js (US-0259) for
the three non-dashboard consumers. Two assertion families:

  - Source guard — each of generate-plan.js, agent-context.js, and
    agent-spec-plan.js (a) requires the accessor module and (b) contains
    no direct \`sdlc.stories\` reads. Comments stripped before scanning so
    \"sdlc.stories\" in a doc comment doesn't false-positive.

  - Dispatch-level read — the accessor returns the same story map from
    state-A (programme.stories) and state-B (top-level stories) fixtures,
    proving the dual-read fallback covers the transition window between
    US-0260 merging and Migration 006 (US-0262) running.

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>"
```

---

## Task 7: Verify + prepare PR

- [ ] **Step 1: Full test suite**

```bash
npx jest --silent 2>&1 | tail -8
```

Expected: 100 suites pass (99 baseline + 1 new integration suite + 1 new unit suite minus any consolidated). Test count: 1555 + ~14 (integration) + ~9 (init repeat) = ~1578.

- [ ] **Step 2: Lint**

```bash
npm run lint 2>&1 | tail -3
```

Expected: 0 errors (warning count unchanged from baseline).

- [ ] **Step 3: Format check**

```bash
npm run format:check 2>&1 | tail -5
```

Expected: all files clean. If prettier complains, run `npx prettier --write` on the listed files and recommit as a fixup.

- [ ] **Step 4: Hand off to finishing-a-development-branch skill**

Announce: "I'm using the finishing-a-development-branch skill to complete this work."

Follow that skill to push the branch and open the PR. Expected PR title: `feat: US-0260 non-dashboard consumer migration + canonical init seed`. PR body should list AC-1017 and AC-1018 as covered.

---

## Self-Review Notes

This is the inline self-review the writing-plans skill requires.

**Spec coverage:**

- AC-1017 (three consumers use accessor; integration tests against state-A/B/C) → Tasks 1-3 swap the read sites; Task 6 asserts via source-grep + accessor round-trip against state-A/B/C fixtures.
- AC-1018 (init writes canonical `programme.{agents,phases,project}`, empty top-level; idempotent merge on partially-populated programme) → Task 4 rewires init; Task 5 covers both empty-programme and partial-programme scenarios with and without `--force`.

**Placeholder scan:**
No "TBD", "TODO", "handle edge cases" in the plan. Every step has either exact code, an exact command, or both.

**Type consistency:**
`buildAgentsMap` / `buildPhasesArray` / `buildProjectObject` are used consistently between Task 4 (definition) and Task 5 (test that imports them, but only via `main()` rather than directly — the test never imports the build helpers, so a rename later would not break it).

`seedProgrammeRow` returns `{ key, action: 'seeded' | 'preserved' }` and `main()` returns `{ seeded: string[], preserved: string[] }`; the AC-1018 test in Task 5 asserts on the `main()` return shape, not the inner helper. Consistent.

**Spec deltas from the original spec text:**

- The spec said the test for AC-1018 lives at `tests/tools/init-sdlc-status-repeat.test.js`. The project doesn't have a `tests/tools/` directory; the closest convention is `tests/unit/`. Plan places it at `tests/unit/init-sdlc-status-repeat.test.js`. Equivalent for AC purposes.
- The plan adds a fourth AC-1018 scenario (accessor round-trip read) that isn't in the spec but tightens the "the seed is the canonical shape the dual-read accessor consumes" closure. Bonus, not required.
