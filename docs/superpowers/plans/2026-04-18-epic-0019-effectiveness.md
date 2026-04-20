# EPIC-0019 Agentic Dashboard Effectiveness Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix 17 schema/generalization/integration gaps in the Agentic SDLC Dashboard and turn it into a configurable product any project can adopt.

**Architecture:** Three sequential tracks — (A) schema generalization: replace `hackathon` key with `project` config, externalize phase definitions, remove hardcoded HTML strings; (B) CLI completeness: epic lifecycle, session reset, coverage/bug/phase wiring; (C) new features: cycle history and extraction guide. Track A must land before B; B before C. Within each track, stories are parallelizable across branches.

**Tech Stack:** Node.js (CLI tools), vanilla JS (dashboard.html live patching), Jest (tests), Bash (install.sh).

---

## File Map

| File                                    | Action | Responsibility                                                                                                                                                           |
| --------------------------------------- | ------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `agents.config.json`                    | Modify | Add `project` and `phases` top-level sections                                                                                                                            |
| `tools/init-sdlc-status.js`             | Modify | Read `project`/`phases` from config; write to `sdlc-status.json`; drop `hackathon`                                                                                       |
| `tools/update-sdlc-status.js`           | Modify | Remove `PHASE_DEFS`; add `session-start`, `epic-start`, `epic-complete`, `bug-open`, `bug-fix`, `cycle-complete`; fix log time to ISO; `story-complete` auto-idles agent |
| `docs/sdlc-status.json`                 | Modify | Migrate `hackathon` → `project`; add `cycles: []`; add `epics` init                                                                                                      |
| `docs/dashboard.html`                   | Modify | Dynamic project identity via `patchDOM`; epic-progress strip; cycle history lap strip + telemetry                                                                        |
| `docs/agents/DM_AGENT.md`               | Modify | Add `session-start`, `epic-start/complete`, `phase`, `coverage`, `bug-open/fix`, `cycle-complete` to Conductor checklists                                                |
| `docs/dashboard-extraction.md`          | Create | Step-by-step adoption guide for other projects                                                                                                                           |
| `scripts/install.sh`                    | Modify | Add §7 dashboard setup section                                                                                                                                           |
| `docs/RELEASE_PLAN.md`                  | Modify | Add US-0127–0134 under EPIC-0019; update EPIC-0019 description; mark EPIC-0017 Done                                                                                      |
| `docs/ID_REGISTRY.md`                   | Modify | Advance US → US-0135, AC counter after write-back                                                                                                                        |
| `tests/unit/update-sdlc-status.test.js` | Modify | Update broken tests (PHASE_DEFS, ISO time); add tests for all new commands                                                                                               |
| `tests/unit/generate-dashboard.test.js` | Modify | Update `hackathon` fixture to `project`                                                                                                                                  |

---

## Task 1 — Schema Generalization: agents.config.json + init-sdlc-status.js (US-0127)

**Files:**

- Modify: `agents.config.json`
- Modify: `tools/init-sdlc-status.js`
- Modify: `tests/unit/generate-dashboard.test.js`

- [ ] **Step 1.1: Write failing test for init — project key written to status**

Add to `tests/unit/generate-dashboard.test.js` after the existing imports (around line 16):

```js
// --- US-0127: init-sdlc-status reads project + phases from config ---
const path = require('path');
const os = require('os');
const fs = require('fs');

describe('init-sdlc-status — project and phases seeding', () => {
  let tmpDir, statusPath, initScript;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'sdlc-test-'));
    statusPath = path.join(tmpDir, 'docs', 'sdlc-status.json');
    fs.mkdirSync(path.join(tmpDir, 'docs'), { recursive: true });
    // Write a minimal agents.config.json with project + phases
    fs.writeFileSync(
      path.join(tmpDir, 'agents.config.json'),
      JSON.stringify({
        project: {
          name: 'TestProj',
          description: 'A test project',
          repoUrl: 'https://github.com/test/proj',
          startDate: '2026-01-01',
        },
        phases: [
          { name: 'Build', agents: ['Dev'], deliverables: ['code'] },
          { name: 'Test', agents: ['QA'], deliverables: ['report'] },
        ],
        agents: {
          Dev: { role: 'Backend Developer' },
        },
      }),
    );
    initScript = require('../../tools/init-sdlc-status');
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
    jest.resetModules();
  });

  it('writes project block (not hackathon) to sdlc-status.json', () => {
    // Call the internal buildStatus function directly
    // (or re-require after setting process.env.STATUS_PATH)
    const status = initScript.buildStatus(path.join(tmpDir, 'agents.config.json'));
    expect(status.project).toBeDefined();
    expect(status.project.name).toBe('TestProj');
    expect(status.project.repoUrl).toBe('https://github.com/test/proj');
    expect(status.hackathon).toBeUndefined();
  });

  it('seeds phases from config with id, status:pending, startedAt:null', () => {
    const status = initScript.buildStatus(path.join(tmpDir, 'agents.config.json'));
    expect(status.phases).toHaveLength(2);
    expect(status.phases[0]).toMatchObject({
      id: 1,
      name: 'Build',
      status: 'pending',
      startedAt: null,
      completedAt: null,
    });
    expect(status.phases[1]).toMatchObject({ id: 2, name: 'Test', status: 'pending' });
  });

  it('seeds cycles as empty array', () => {
    const status = initScript.buildStatus(path.join(tmpDir, 'agents.config.json'));
    expect(status.cycles).toEqual([]);
  });
});
```

- [ ] **Step 1.2: Run test to verify it fails**

```bash
npx jest tests/unit/generate-dashboard.test.js --testNamePattern="project and phases" -t "project block" 2>&1 | tail -20
```

Expected: FAIL — `initScript.buildStatus is not a function`

- [ ] **Step 1.3: Add `project` and `phases` to agents.config.json**

Open `agents.config.json`. After the opening `{`, add before `"agents"`:

```json
"project": {
  "name": "PlanVisualizer",
  "description": "Agentic AI SDLC",
  "repoUrl": "https://github.com/ksyed0/PlanVisualizer",
  "startDate": "2026-03-10"
},
"phases": [
  { "name": "Blueprint",   "agents": ["Compass"],              "deliverables": ["refined ACs", "priority list"] },
  { "name": "Architect",   "agents": ["Keystone"],             "deliverables": ["scaffold", "types", "service stubs"] },
  { "name": "Build",       "agents": ["Pixel","Forge","Palette"], "deliverables": ["implementation", "unit tests"] },
  { "name": "Integration", "agents": ["Pixel"],                "deliverables": ["wired services", "e2e flows"] },
  { "name": "Test",        "agents": ["Sentinel","Circuit"],   "deliverables": ["test report", "coverage"] },
  { "name": "Polish",      "agents": ["Pixel","Forge"],        "deliverables": ["bug fixes", "demo prep"] }
],
```

- [ ] **Step 1.4: Refactor init-sdlc-status.js to export buildStatus and use config**

Replace the `main()` function and add `buildStatus` export. The full updated `tools/init-sdlc-status.js`:

```js
#!/usr/bin/env node
'use strict';

/**
 * init-sdlc-status.js — Generate sdlc-status.json from agents.config.json
 *
 * Creates or resets the SDLC status file with agent entries derived from config.
 * Safe to re-run — only creates if missing or if --force is passed.
 *
 * Usage:
 *   node tools/init-sdlc-status.js            # Create if missing
 *   node tools/init-sdlc-status.js --force     # Overwrite existing
 */

const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const CONFIG_PATH = path.join(ROOT, 'agents.config.json');
const STATUS_PATH = path.join(ROOT, 'docs', 'sdlc-status.json');

function loadConfig(configPath) {
  if (!fs.existsSync(configPath)) {
    console.error(`[init-sdlc-status] ${configPath} not found.`);
    process.exit(1);
  }
  return JSON.parse(fs.readFileSync(configPath, 'utf8'));
}

function buildAgentStatus(role) {
  const base = { status: 'idle', currentTask: null, tasksCompleted: 0 };
  const lower = role.toLowerCase();
  if (lower.includes('reviewer')) {
    base.reviewsCompleted = 0;
    base.blockers = 0;
  }
  if (lower.includes('functional tester')) {
    base.testsPassed = 0;
    base.testsFailed = 0;
  }
  if (lower.includes('automation tester')) {
    base.coveragePercent = 0;
  }
  return base;
}

function buildStatus(configPath) {
  const config = loadConfig(configPath || CONFIG_PATH);

  const agents = {};
  for (const [name, cfg] of Object.entries(config.agents || {})) {
    agents[name] = buildAgentStatus(cfg.role);
  }

  const phases = (config.phases || []).map((p, i) => ({
    id: i + 1,
    name: p.name,
    agents: (p.agents || []).slice(),
    deliverables: (p.deliverables || []).slice(),
    status: 'pending',
    startedAt: null,
    completedAt: null,
  }));

  return {
    project: {
      name: config.project?.name || 'My Project',
      description: config.project?.description || 'Agentic AI SDLC',
      repoUrl: config.project?.repoUrl || '',
      startDate: config.project?.startDate || new Date().toISOString().split('T')[0],
    },
    currentPhase: 0,
    phases,
    agents,
    epics: {},
    stories: {},
    cycles: [],
    metrics: {
      storiesCompleted: 0,
      storiesTotal: 0,
      tasksCompleted: 0,
      tasksTotal: 0,
      testsPassed: 0,
      testsFailed: 0,
      testsTotal: 0,
      bugsOpen: 0,
      bugsFixed: 0,
      coveragePercent: 0,
      reviewsApproved: 0,
      reviewsBlocked: 0,
    },
    log: [],
  };
}

function main() {
  const force = process.argv.includes('--force');
  const status = buildStatus(CONFIG_PATH);
  const content = JSON.stringify(status, null, 2) + '\n';
  fs.mkdirSync(path.dirname(STATUS_PATH), { recursive: true });

  if (force) {
    fs.writeFileSync(STATUS_PATH, content, 'utf8');
    console.log(`[init-sdlc-status] Generated docs/sdlc-status.json (forced).`);
  } else {
    try {
      fs.writeFileSync(STATUS_PATH, content, { encoding: 'utf8', flag: 'wx' });
      const agentNames = Object.keys(JSON.parse(content).agents);
      console.log(`[init-sdlc-status] Generated docs/sdlc-status.json with ${agentNames.length} agents.`);
    } catch (err) {
      if (err.code === 'EEXIST') {
        console.log('[init-sdlc-status] docs/sdlc-status.json already exists. Use --force to overwrite.');
        return;
      }
      throw err;
    }
  }
}

if (require.main === module) {
  main();
}

module.exports = { buildStatus, loadConfig };
```

- [ ] **Step 1.5: Run tests to verify they pass**

```bash
npx jest tests/unit/generate-dashboard.test.js --testNamePattern="project and phases" 2>&1 | tail -20
```

Expected: PASS — 3 tests pass

- [ ] **Step 1.6: Update generate-dashboard.test.js fixture — replace hackathon with project**

In `tests/unit/generate-dashboard.test.js`, find the `makeHealthyFixture` function's `hackathon` block (around line 40) and replace:

```js
// OLD:
hackathon: {
  name: 'SDLC Dashboard',
  date: '2026-04-15',
  startTime: '09:00',
  endTime: '17:00',
},

// NEW:
project: {
  name: 'SDLC Dashboard',
  description: 'Agentic AI SDLC',
  repoUrl: 'https://github.com/ksyed0/PlanVisualizer',
  startDate: '2026-04-15',
},
cycles: [],
```

- [ ] **Step 1.7: Run full test suite to confirm no regressions**

```bash
npx jest tests/unit/generate-dashboard.test.js 2>&1 | tail -15
```

Expected: All existing generate-dashboard tests pass.

- [ ] **Step 1.8: Migrate live sdlc-status.json**

Open `docs/sdlc-status.json`. Replace the `hackathon` block:

```json
// REMOVE this block:
"hackathon": {
  "name": "SDLC Dashboard",
  "date": "2026-04-16",
  "startTime": "09:00",
  "endTime": "17:00"
},

// ADD this block in its place:
"project": {
  "name": "PlanVisualizer",
  "description": "Agentic AI SDLC",
  "repoUrl": "https://github.com/ksyed0/PlanVisualizer",
  "startDate": "2026-03-10"
},
```

Also add `"cycles": []` after `"epics": {}`.

- [ ] **Step 1.9: Commit**

```bash
git add agents.config.json tools/init-sdlc-status.js docs/sdlc-status.json tests/unit/generate-dashboard.test.js
git commit -m "feat: US-0127 schema generalization — replace hackathon with project config, seed phases from agents.config.json"
```

---

## Task 2 — Dashboard Dynamic Project Identity (US-0128)

**Files:**

- Modify: `docs/dashboard.html` (lines 1112–1113 header, 1602 about panel, 1671 repo link, 2143 patchDOM)
- Modify: `tools/update-sdlc-status.js` (log time → ISO)
- Modify: `tests/unit/update-sdlc-status.test.js` (fix time format assertion)

- [ ] **Step 2.1: Update log time format test**

In `tests/unit/update-sdlc-status.test.js`, find the test that checks `time` format (around line 179):

```js
// OLD:
expect(data.log[0].time).toMatch(/^\d{2}:\d{2}$/);

// NEW:
expect(data.log[0].time).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/);
```

- [ ] **Step 2.2: Run test to verify it fails**

```bash
npx jest tests/unit/update-sdlc-status.test.js -t "appends a generic log entry" 2>&1 | tail -10
```

Expected: FAIL — time does not match ISO pattern

- [ ] **Step 2.3: Change nowLocalHHMM to nowISO in appendLog**

In `tools/update-sdlc-status.js`, find `appendLog`:

```js
// OLD:
function appendLog(data, agent, message) {
  data.log = data.log || [];
  data.log.push({ time: nowLocalHHMM(), agent: agent || 'Conductor', message });

// NEW:
function appendLog(data, agent, message) {
  data.log = data.log || [];
  data.log.push({ time: nowISO(), agent: agent || 'Conductor', message });
```

- [ ] **Step 2.4: Run test to verify it passes**

```bash
npx jest tests/unit/update-sdlc-status.test.js -t "appends a generic log entry" 2>&1 | tail -10
```

Expected: PASS

- [ ] **Step 2.5: Add patchProject helper to patchDOM in dashboard.html**

In `docs/dashboard.html`, find the `patchDOM` function (line 2143) and add a project-patching block immediately after the opening `if (!status ...) return;` guard:

```js
// After: if (!status || typeof status !== 'object') return;
// ADD:

// --- Project identity (US-0128) ------------------------------------------
var proj = status.project;
if (proj) {
  var titleEl = document.querySelector('.header-title');
  if (titleEl && proj.name) titleEl.textContent = proj.name;
  var subtitleEl = document.querySelector('.header-subtitle');
  if (subtitleEl && proj.description) subtitleEl.textContent = proj.description;
  var aboutH3 = document.querySelector('.about-right h3');
  if (aboutH3 && proj.name) aboutH3.textContent = proj.name;
  var aboutDesc = document.querySelector('.about-right p');
  if (aboutDesc && proj.description) aboutDesc.textContent = proj.description;
  if (proj.repoUrl) {
    document.querySelectorAll('a.repo-link, .about-links-row a[href*="yourorg"]').forEach(function (a) {
      a.href = proj.repoUrl;
      a.textContent = proj.repoUrl;
    });
  }
  // Patch <title> on first render only
  if (!document._projectTitlePatched && proj.name) {
    document.title = proj.name + ' \u2014 SDLC Live Dashboard';
    document._projectTitlePatched = true;
  }
}
```

- [ ] **Step 2.6: Patch log time display in patchDOM**

Find where the activity log entries are rendered in `patchDOM`. Search for `data.log` or the log rendering section. Add a time formatter before the log rendering. In the log rendering code (search for `logEl` or `activity-log`), ensure each `entry.time` is formatted:

```js
// Add this helper near the top of the <script> block (before patchDOM):
function fmtLogTime(t) {
  if (!t) return '';
  // ISO string: show HH:MM; legacy HH:MM string: pass through
  if (t.includes('T')) {
    var d = new Date(t);
    return isNaN(d) ? t : String(d.getHours()).padStart(2, '0') + ':' + String(d.getMinutes()).padStart(2, '0');
  }
  return t;
}
```

Then in log rendering find `entry.time` and replace with `fmtLogTime(entry.time)`.

- [ ] **Step 2.7: Run full suite and verify no regressions**

```bash
npx jest 2>&1 | tail -15
```

Expected: All tests pass.

- [ ] **Step 2.8: Commit**

```bash
git add docs/dashboard.html tools/update-sdlc-status.js tests/unit/update-sdlc-status.test.js
git commit -m "feat: US-0128 dashboard dynamic project identity — patchDOM reads project.name/repoUrl, log time → ISO"
```

---

## Task 3 — Phase Config Externalization (US-0129)

**Files:**

- Modify: `tools/update-sdlc-status.js` (remove PHASE_DEFS, update phase handler)
- Modify: `tests/unit/update-sdlc-status.test.js` (update phase tests to pre-seed phases)

- [ ] **Step 3.1: Update the phase handler tests to pre-seed phases**

In `tests/unit/update-sdlc-status.test.js`, find the `update-sdlc-status — phase` describe block (around line 149) and update `baseState()` calls to pre-seed phases:

```js
describe('update-sdlc-status — phase', () => {
  function seededPhaseState() {
    const data = baseState();
    // Simulate phases seeded by init-sdlc-status.js from agents.config.json
    data.phases = [
      {
        id: 1,
        name: 'Blueprint',
        agents: ['Compass'],
        deliverables: ['refined ACs'],
        status: 'pending',
        startedAt: null,
        completedAt: null,
      },
      {
        id: 2,
        name: 'Architect',
        agents: ['Keystone'],
        deliverables: ['scaffold'],
        status: 'pending',
        startedAt: null,
        completedAt: null,
      },
      {
        id: 3,
        name: 'Build',
        agents: ['Pixel', 'Forge', 'Palette'],
        deliverables: ['implementation'],
        status: 'pending',
        startedAt: null,
        completedAt: null,
      },
      {
        id: 4,
        name: 'Integration',
        agents: ['Pixel'],
        deliverables: ['e2e flows'],
        status: 'pending',
        startedAt: null,
        completedAt: null,
      },
      {
        id: 5,
        name: 'Test',
        agents: ['Sentinel', 'Circuit'],
        deliverables: ['test report'],
        status: 'pending',
        startedAt: null,
        completedAt: null,
      },
      {
        id: 6,
        name: 'Polish',
        agents: ['Pixel', 'Forge'],
        deliverables: ['bug fixes'],
        status: 'pending',
        startedAt: null,
        completedAt: null,
      },
    ];
    return data;
  }

  it('sets currentPhase + updates pre-seeded phase status', () => {
    const data = seededPhaseState();
    HANDLERS.phase(data, { number: '3', status: 'in-progress' });
    expect(data.currentPhase).toBe(3);
    expect(data.phases[2].name).toBe('Build');
    expect(data.phases[2].agents).toEqual(['Pixel', 'Forge', 'Palette']);
    expect(data.phases[2].status).toBe('in-progress');
    expect(data.phases[2].startedAt).toBeTruthy();
  });

  it('records completedAt on complete', () => {
    const data = seededPhaseState();
    HANDLERS.phase(data, { number: '1', status: 'in-progress' });
    HANDLERS.phase(data, { number: '1', status: 'complete' });
    expect(data.phases[0].status).toBe('complete');
    expect(data.phases[0].completedAt).toBeTruthy();
  });
});
```

- [ ] **Step 3.2: Run tests to verify they fail**

```bash
npx jest tests/unit/update-sdlc-status.test.js -t "phase" 2>&1 | tail -15
```

Expected: FAIL — `seededPhaseState` is a new helper, tests should fail only if PHASE_DEFS is still used (actually they'll pass with current code since phases are pre-seeded). Note the test to verify PHASE_DEFS is gone comes next.

- [ ] **Step 3.3: Remove PHASE_DEFS from update-sdlc-status.js and update phase handler**

In `tools/update-sdlc-status.js`, find the `phase` handler (around line 208). Remove the entire `PHASE_DEFS` constant. Update the handler to read from `data.phases`:

```js
phase: (data, opts) => {
  const n = parseInt(opts.number, 10);
  const status = opts.status || 'in-progress';
  data.currentPhase = n;
  data.phases = data.phases || [];
  // Auto-expand only if phases weren't seeded by init-sdlc-status.js
  while (data.phases.length < n) {
    const i = data.phases.length;
    data.phases.push({
      id: i + 1,
      name: `Phase ${i + 1}`,
      agents: [],
      deliverables: [],
      status: 'pending',
      startedAt: null,
      completedAt: null,
    });
  }
  const phase = data.phases[n - 1];
  phase.status = status;
  if (status === 'in-progress' && !phase.startedAt) phase.startedAt = nowISO();
  if (status === 'complete' && !phase.completedAt) phase.completedAt = nowISO();
  appendLog(data, 'Conductor', `Phase ${n} (${phase.name}) → ${status}`);
  return data;
},
```

- [ ] **Step 3.4: Run phase tests to verify they pass**

```bash
npx jest tests/unit/update-sdlc-status.test.js -t "phase" 2>&1 | tail -15
```

Expected: PASS

- [ ] **Step 3.5: Run full suite**

```bash
npx jest 2>&1 | tail -15
```

Expected: All tests pass.

- [ ] **Step 3.6: Commit**

```bash
git add tools/update-sdlc-status.js tests/unit/update-sdlc-status.test.js
git commit -m "feat: US-0129 phase config externalization — remove PHASE_DEFS, phase handler reads from seeded data.phases"
```

---

## Task 4 — Epic Lifecycle Commands (US-0130)

**Files:**

- Modify: `tools/update-sdlc-status.js` (add epic-start, epic-complete handlers; update story-complete)
- Modify: `docs/dashboard.html` (add epic-progress strip HTML + patchDOM rendering)
- Modify: `tests/unit/update-sdlc-status.test.js` (add epic tests)

- [ ] **Step 4.1: Write failing tests for epic-start and epic-complete**

Add to `tests/unit/update-sdlc-status.test.js`:

```js
describe('update-sdlc-status — epic lifecycle', () => {
  it('epic-start creates epics entry with correct shape', () => {
    const data = baseState();
    data.epics = {};
    HANDLERS['epic-start'](data, { epic: 'EPIC-0019', name: 'Dashboard Effectiveness', stories: '8' });
    expect(data.epics['EPIC-0019']).toBeDefined();
    expect(data.epics['EPIC-0019'].status).toBe('in-progress');
    expect(data.epics['EPIC-0019'].storiesTotal).toBe(8);
    expect(data.epics['EPIC-0019'].storiesCompleted).toBe(0);
    expect(data.epics['EPIC-0019'].startedAt).toBeTruthy();
    expect(data.epics['EPIC-0019'].completedAt).toBeNull();
    expect(data.log[0].message).toContain('EPIC-0019');
  });

  it('epic-complete sets status and completedAt', () => {
    const data = baseState();
    data.epics = {
      'EPIC-0019': {
        status: 'in-progress',
        storiesCompleted: 8,
        storiesTotal: 8,
        startedAt: '2026-01-01T00:00:00Z',
        completedAt: null,
      },
    };
    HANDLERS['epic-complete'](data, { epic: 'EPIC-0019' });
    expect(data.epics['EPIC-0019'].status).toBe('complete');
    expect(data.epics['EPIC-0019'].completedAt).toBeTruthy();
  });

  it('story-complete increments epic storiesCompleted when epic exists', () => {
    const data = baseState();
    data.epics = {
      'EPIC-0019': {
        status: 'in-progress',
        storiesCompleted: 2,
        storiesTotal: 8,
        startedAt: '2026-01-01T00:00:00Z',
        completedAt: null,
      },
    };
    HANDLERS['story-complete'](data, { story: 'US-0127', epic: 'EPIC-0019' });
    expect(data.epics['EPIC-0019'].storiesCompleted).toBe(3);
  });
});
```

- [ ] **Step 4.2: Run tests to verify they fail**

```bash
npx jest tests/unit/update-sdlc-status.test.js -t "epic lifecycle" 2>&1 | tail -15
```

Expected: FAIL — `epic-start` is not a handler

- [ ] **Step 4.3: Add epic-start and epic-complete handlers to update-sdlc-status.js**

Add inside the `HANDLERS` object in `tools/update-sdlc-status.js`:

```js
'epic-start': (data, opts) => {
  data.epics = data.epics || {};
  data.epics[opts.epic] = {
    name: opts.name || opts.epic,
    status: 'in-progress',
    startedAt: nowISO(),
    completedAt: null,
    storiesCompleted: 0,
    storiesTotal: parseInt(opts.stories || '0', 10),
  };
  appendLog(data, 'Conductor', `Epic ${opts.epic} (${opts.name || opts.epic}) started`);
  return data;
},

'epic-complete': (data, opts) => {
  data.epics = data.epics || {};
  if (data.epics[opts.epic]) {
    data.epics[opts.epic].status = 'complete';
    data.epics[opts.epic].completedAt = nowISO();
  }
  appendLog(data, 'Conductor', `Epic ${opts.epic} complete`);
  return data;
},
```

- [ ] **Step 4.4: Update story-complete to increment epic counter**

In the `story-complete` handler, after `data.metrics.storiesCompleted = ...`, add:

```js
// Increment epic storiesCompleted if story is linked to an epic
const epicId = opts.epic || story.epic;
if (epicId && data.epics && data.epics[epicId]) {
  data.epics[epicId].storiesCompleted = (data.epics[epicId].storiesCompleted || 0) + 1;
}
```

- [ ] **Step 4.5: Run epic tests to verify they pass**

```bash
npx jest tests/unit/update-sdlc-status.test.js -t "epic lifecycle" 2>&1 | tail -15
```

Expected: PASS — 3 tests pass

- [ ] **Step 4.6: Add epic-progress strip to dashboard.html**

Find the pipeline section in `docs/dashboard.html` (search for `<div class="pipeline"`). Add the following HTML immediately after the closing `</div>` of the pipeline block:

```html
<!-- US-0130: Epic progress strip — rendered by patchDOM on each tick -->
<div
  id="epic-strip"
  style="display:none; margin-bottom:16px; background:var(--bg-card); border:1px solid var(--bg-card-border); border-radius:10px; padding:10px 16px; font-family:var(--font-sans); font-size:12px;"
>
  <div
    style="font-size:10px; text-transform:uppercase; letter-spacing:0.08em; color:var(--text-dim); margin-bottom:8px;"
  >
    Epic Progress
  </div>
  <div id="epic-strip-rows"></div>
</div>
```

- [ ] **Step 4.7: Add epic-strip rendering in patchDOM**

In `docs/dashboard.html`, inside `patchDOM(status)`, add after the project identity block:

```js
// --- Epic progress strip (US-0130) ----------------------------------------
var epics = status.epics || {};
var epicKeys = Object.keys(epics);
var epicStripEl = document.getElementById('epic-strip');
var epicRowsEl = document.getElementById('epic-strip-rows');
if (epicStripEl && epicRowsEl) {
  if (epicKeys.length === 0) {
    epicStripEl.style.display = 'none';
  } else {
    epicStripEl.style.display = '';
    epicRowsEl.innerHTML = epicKeys
      .map(function (id) {
        var ep = epics[id];
        var pct = ep.storiesTotal > 0 ? Math.round((ep.storiesCompleted / ep.storiesTotal) * 100) : 0;
        var badgeColor = ep.status === 'complete' ? '#34A853' : ep.status === 'in-progress' ? '#F57C00' : '#888';
        return (
          '<div style="display:flex;align-items:center;gap:10px;margin-bottom:4px;">' +
          '<span style="font-weight:600;color:var(--text-primary);min-width:90px;">' +
          id +
          '</span>' +
          '<span style="color:var(--text-secondary);flex:1;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">' +
          (ep.name || '') +
          '</span>' +
          '<span style="min-width:60px;text-align:right;color:var(--text-muted);">' +
          ep.storiesCompleted +
          '/' +
          ep.storiesTotal +
          '</span>' +
          '<div style="width:80px;height:4px;background:var(--bg-progress);border-radius:2px;overflow:hidden;">' +
          '<div style="height:100%;width:' +
          pct +
          '%;background:' +
          badgeColor +
          ';border-radius:2px;transition:width 0.6s;"></div>' +
          '</div>' +
          '<span style="min-width:32px;text-align:right;color:' +
          badgeColor +
          ';font-weight:600;">' +
          pct +
          '%</span>' +
          '</div>'
        );
      })
      .join('');
  }
}
```

- [ ] **Step 4.8: Run full suite**

```bash
npx jest 2>&1 | tail -15
```

Expected: All tests pass.

- [ ] **Step 4.9: Commit**

```bash
git add tools/update-sdlc-status.js docs/dashboard.html tests/unit/update-sdlc-status.test.js
git commit -m "feat: US-0130 epic lifecycle commands — epic-start/epic-complete handlers, story-complete increments epic counter, dashboard epic-progress strip"
```

---

## Task 5 — Session Reset & CLI Validation (US-0131)

**Files:**

- Modify: `tools/update-sdlc-status.js` (add session-start handler, --agent validation)
- Modify: `tests/unit/update-sdlc-status.test.js` (session-start tests, validation tests)

- [ ] **Step 5.1: Write failing tests**

Add to `tests/unit/update-sdlc-status.test.js`:

```js
describe('update-sdlc-status — session-start', () => {
  it('resets stories, phases status, and metrics but preserves project, agents, cycles, epics, log', () => {
    const data = baseState();
    data.project = { name: 'TestProj', description: 'Desc', repoUrl: '', startDate: '2026-01-01' };
    data.agents = { Pixel: { status: 'active', currentTask: 'old task', tasksCompleted: 5 } };
    data.cycles = [{ id: 1, completedAt: '2026-01-01T00:00:00Z', storiesCompleted: 3 }];
    data.epics = { 'EPIC-0001': { status: 'complete' } };
    data.stories = { 'US-0001': { status: 'InProgress' } };
    data.metrics.storiesCompleted = 4;
    data.metrics.testsPassed = 100;
    data.phases = [{ id: 1, name: 'Build', status: 'complete', startedAt: '...', completedAt: '...' }];

    HANDLERS['session-start'](data, { stories: '8' });

    expect(data.stories).toEqual({});
    expect(data.metrics.storiesCompleted).toBe(0);
    expect(data.metrics.testsPassed).toBe(0);
    expect(data.metrics.storiesTotal).toBe(8);
    expect(data.currentPhase).toBe(0);
    expect(data.phases[0].status).toBe('pending');
    expect(data.phases[0].startedAt).toBeNull();
    // preserved:
    expect(data.project.name).toBe('TestProj');
    expect(data.agents.Pixel).toBeDefined();
    expect(data.cycles).toHaveLength(1);
    expect(data.epics['EPIC-0001']).toBeDefined();
  });

  it('sets storiesTotal from --stories argument', () => {
    const data = baseState();
    HANDLERS['session-start'](data, { stories: '5' });
    expect(data.metrics.storiesTotal).toBe(5);
  });
});

describe('update-sdlc-status — --agent validation', () => {
  it('agent-start throws when --agent is missing', () => {
    const data = baseState();
    expect(() => HANDLERS['agent-start'](data, { task: 'work' })).toThrow('--agent is required');
  });

  it('agent-start throws when --agent is the string "undefined"', () => {
    const data = baseState();
    expect(() => HANDLERS['agent-start'](data, { agent: 'undefined', task: 'work' })).toThrow('--agent is required');
  });

  it('agent-done throws when --agent is missing', () => {
    const data = baseState();
    expect(() => HANDLERS['agent-done'](data, {})).toThrow('--agent is required');
  });
});
```

- [ ] **Step 5.2: Run tests to verify they fail**

```bash
npx jest tests/unit/update-sdlc-status.test.js -t "session-start|agent validation" 2>&1 | tail -15
```

Expected: FAIL

- [ ] **Step 5.3: Add session-start handler and agent validation to update-sdlc-status.js**

Add a shared `resetSession` helper and a `session-start` handler. Add validation to `agent-start` and `agent-done`:

```js
// Add above HANDLERS:
function requireAgent(opts) {
  if (!opts.agent || opts.agent === 'undefined') {
    throw new Error('--agent is required');
  }
}

function resetSession(data, storiesTotal) {
  data.stories = {};
  data.currentPhase = 0;
  if (Array.isArray(data.phases)) {
    data.phases = data.phases.map((p) => ({
      ...p,
      status: 'pending',
      startedAt: null,
      completedAt: null,
    }));
  }
  data.metrics = {
    storiesCompleted: 0,
    storiesTotal: parseInt(storiesTotal || '0', 10),
    tasksCompleted: 0,
    tasksTotal: 0,
    testsPassed: 0,
    testsFailed: 0,
    testsTotal: 0,
    bugsOpen: 0,
    bugsFixed: 0,
    coveragePercent: 0,
    reviewsApproved: 0,
    reviewsBlocked: 0,
  };
  return data;
}
```

Add `session-start` to `HANDLERS`:

```js
'session-start': (data, opts) => {
  resetSession(data, opts.stories);
  appendLog(data, 'Conductor', `Session started — ${opts.stories || 0} stories planned`);
  return data;
},
```

Update `agent-start` to call `requireAgent`:

```js
'agent-start': (data, opts) => {
  requireAgent(opts);
  // ... rest of handler unchanged
```

Update `agent-done` to call `requireAgent`:

```js
'agent-done': (data, opts) => {
  requireAgent(opts);
  // ... rest of handler unchanged
```

Also export `resetSession` at the bottom:

```js
module.exports = { HANDLERS, parseArgs, resetSession };
```

- [ ] **Step 5.4: Remove storiesTotal mutation from story-start handler**

In `tools/update-sdlc-status.js`, find `story-start` handler and remove the line:

```js
// REMOVE this line from story-start:
data.metrics.storiesTotal = Math.max(data.metrics.storiesTotal || 0, Object.keys(data.stories).length);
```

- [ ] **Step 5.5: Update existing story-start test that checks storiesTotal bump**

In `tests/unit/update-sdlc-status.test.js`, find:

```js
it('story-start sets InProgress + startedAt + bumps storiesTotal', () => {
```

Update the assertion:

```js
it('story-start sets InProgress + startedAt (does not modify storiesTotal)', () => {
  const data = baseState();
  data.metrics.storiesTotal = 5; // set externally by session-start
  HANDLERS['story-start'](data, { story: 'US-0096', epic: 'EPIC-0015' });
  expect(data.stories['US-0096'].status).toBe('InProgress');
  expect(data.stories['US-0096'].epic).toBe('EPIC-0015');
  expect(data.stories['US-0096'].startedAt).toBeTruthy();
  expect(data.metrics.storiesTotal).toBe(5); // unchanged
});
```

- [ ] **Step 5.6: Run all session/validation tests**

```bash
npx jest tests/unit/update-sdlc-status.test.js 2>&1 | tail -15
```

Expected: All tests pass.

- [ ] **Step 5.7: Commit**

```bash
git add tools/update-sdlc-status.js tests/unit/update-sdlc-status.test.js
git commit -m "feat: US-0131 session reset and CLI validation — session-start command, --agent required validation, storiesTotal declared at session start"
```

---

## Task 6 — Coverage, Bug Metrics & DM_AGENT.md Wiring (US-0132)

**Files:**

- Modify: `tools/update-sdlc-status.js` (bug-open, bug-fix, story-complete auto-idle)
- Modify: `docs/agents/DM_AGENT.md` (add phase/coverage/bug/epic/session call sites)
- Modify: `tests/unit/update-sdlc-status.test.js` (bug and auto-idle tests)

- [ ] **Step 6.1: Write failing tests**

Add to `tests/unit/update-sdlc-status.test.js`:

```js
describe('update-sdlc-status — bug metrics', () => {
  it('bug-open increments bugsOpen', () => {
    const data = baseState();
    HANDLERS['bug-open'](data, { story: 'US-0127' });
    expect(data.metrics.bugsOpen).toBe(1);
    expect(data.log[0].message).toContain('bug opened');
  });

  it('bug-fix decrements bugsOpen and increments bugsFixed', () => {
    const data = baseState();
    data.metrics.bugsOpen = 2;
    HANDLERS['bug-fix'](data, { story: 'US-0127' });
    expect(data.metrics.bugsOpen).toBe(1);
    expect(data.metrics.bugsFixed).toBe(1);
  });

  it('bug-fix floors bugsOpen at 0', () => {
    const data = baseState();
    data.metrics.bugsOpen = 0;
    HANDLERS['bug-fix'](data, { story: 'US-0127' });
    expect(data.metrics.bugsOpen).toBe(0);
    expect(data.metrics.bugsFixed).toBe(1);
  });
});

describe('update-sdlc-status — story-complete auto-idles agent', () => {
  it('auto-idles the assignedAgent on story-complete', () => {
    const data = baseState();
    HANDLERS['agent-start'](data, { agent: 'Pixel', story: 'US-0127', task: 'implement' });
    HANDLERS['story-complete'](data, { story: 'US-0127', epic: 'EPIC-0019' });
    expect(data.agents.Pixel.status).toBe('idle');
    expect(data.agents.Pixel.currentTask).toBeNull();
  });

  it('story-complete with no assignedAgent does not crash', () => {
    const data = baseState();
    expect(() => HANDLERS['story-complete'](data, { story: 'US-0127' })).not.toThrow();
  });
});
```

- [ ] **Step 6.2: Run tests to verify they fail**

```bash
npx jest tests/unit/update-sdlc-status.test.js -t "bug metrics|auto-idles" 2>&1 | tail -15
```

Expected: FAIL

- [ ] **Step 6.3: Add bug-open and bug-fix handlers**

Add to `HANDLERS` in `tools/update-sdlc-status.js`:

```js
'bug-open': (data, opts) => {
  data.metrics = data.metrics || {};
  data.metrics.bugsOpen = (data.metrics.bugsOpen || 0) + 1;
  appendLog(data, opts.agent || 'Conductor', `bug opened on ${opts.story || 'unknown story'}`);
  return data;
},

'bug-fix': (data, opts) => {
  data.metrics = data.metrics || {};
  data.metrics.bugsOpen = Math.max(0, (data.metrics.bugsOpen || 0) - 1);
  data.metrics.bugsFixed = (data.metrics.bugsFixed || 0) + 1;
  appendLog(data, opts.agent || 'Conductor', `bug fixed on ${opts.story || 'unknown story'}`);
  return data;
},
```

- [ ] **Step 6.4: Update story-complete to auto-idle the assigned agent**

In `tools/update-sdlc-status.js`, in the `story-complete` handler, after setting `story.completedAt`, add:

```js
// Auto-idle the assigned agent
const agentName = story.assignedAgent;
if (agentName && data.agents && data.agents[agentName]) {
  data.agents[agentName].status = 'idle';
  data.agents[agentName].currentTask = null;
}
```

- [ ] **Step 6.5: Run tests**

```bash
npx jest tests/unit/update-sdlc-status.test.js 2>&1 | tail -15
```

Expected: All tests pass.

- [ ] **Step 6.6: Update DM_AGENT.md — add Conductor checklists**

In `docs/agents/DM_AGENT.md`, find the update-sdlc-status command table (around line 243) and add the new commands:

```markdown
| Session start | `node tools/update-sdlc-status.js session-start --stories N` |
| Epic start | `node tools/update-sdlc-status.js epic-start --epic EPIC-XXXX --name "..." --stories N` |
| Epic complete | `node tools/update-sdlc-status.js epic-complete --epic EPIC-XXXX` |
| Bug opened | `node tools/update-sdlc-status.js bug-open --story US-XXXX` |
| Bug fixed | `node tools/update-sdlc-status.js bug-fix --story US-XXXX` |
| Cycle complete | `node tools/update-sdlc-status.js cycle-complete` |
```

Find the "Post-merge checklist" or phase transition section and add:

```markdown
**Before first story of a new epic:**

1. `node tools/update-sdlc-status.js session-start --stories <N>`
2. `node tools/update-sdlc-status.js epic-start --epic EPIC-XXXX --name "..." --stories <N>`

**At each phase transition:**

- Start: `node tools/update-sdlc-status.js phase --number <N> --status in-progress`
- Complete: `node tools/update-sdlc-status.js phase --number <N> --status complete`

**After Test phase (Circuit reports coverage):**

- `node tools/update-sdlc-status.js coverage --agent Circuit --percent <N>`

**When a bug is filed during the pipeline:**

- `node tools/update-sdlc-status.js bug-open --story US-XXXX`

**When a bug is resolved:**

- `node tools/update-sdlc-status.js bug-fix --story US-XXXX`

**After all stories in an epic merge:**

- `node tools/update-sdlc-status.js epic-complete --epic EPIC-XXXX`
- `node tools/update-sdlc-status.js cycle-complete`
```

- [ ] **Step 6.7: Run full suite**

```bash
npx jest 2>&1 | tail -15
```

Expected: All tests pass.

- [ ] **Step 6.8: Commit**

```bash
git add tools/update-sdlc-status.js docs/agents/DM_AGENT.md tests/unit/update-sdlc-status.test.js
git commit -m "feat: US-0132 coverage and bug metrics wiring — bug-open/fix commands, story-complete auto-idles agent, DM_AGENT.md phase/coverage/bug/epic checklists"
```

---

## Task 7 — Cycle History (US-0133)

**Files:**

- Modify: `tools/update-sdlc-status.js` (add cycle-complete handler using resetSession)
- Modify: `docs/dashboard.html` (lap-history strip HTML + CSS + patchDOM rendering + cycle animation)
- Modify: `tests/unit/update-sdlc-status.test.js` (cycle-complete tests)

- [ ] **Step 7.1: Write failing tests for cycle-complete**

Add to `tests/unit/update-sdlc-status.test.js`:

```js
describe('update-sdlc-status — cycle-complete', () => {
  function stateWithActiveSession() {
    const data = baseState();
    data.project = { name: 'TestProj', description: '', repoUrl: '', startDate: '2026-01-01' };
    data.cycles = [];
    data.metrics = {
      storiesCompleted: 4,
      storiesTotal: 4,
      tasksCompleted: 12,
      tasksTotal: 0,
      testsPassed: 200,
      testsFailed: 0,
      testsTotal: 200,
      bugsOpen: 0,
      bugsFixed: 2,
      coveragePercent: 91.5,
      reviewsApproved: 8,
      reviewsBlocked: 0,
    };
    data.phases = [
      {
        id: 1,
        name: 'Build',
        status: 'complete',
        startedAt: '2026-04-18T09:00:00Z',
        completedAt: '2026-04-18T10:30:00Z',
      },
      {
        id: 2,
        name: 'Test',
        status: 'complete',
        startedAt: '2026-04-18T10:30:00Z',
        completedAt: '2026-04-18T11:00:00Z',
      },
    ];
    return data;
  }

  it('appends a cycle snapshot to cycles[]', () => {
    const data = stateWithActiveSession();
    HANDLERS['cycle-complete'](data, {});
    expect(data.cycles).toHaveLength(1);
    expect(data.cycles[0].id).toBe(1);
    expect(data.cycles[0].storiesCompleted).toBe(4);
    expect(data.cycles[0].coveragePercent).toBeCloseTo(91.5);
    expect(data.cycles[0].completedAt).toBeTruthy();
  });

  it('captures phaseDurations in seconds', () => {
    const data = stateWithActiveSession();
    HANDLERS['cycle-complete'](data, {});
    expect(data.cycles[0].phaseDurations.Build).toBe(5400); // 1.5h = 5400s
    expect(data.cycles[0].phaseDurations.Test).toBe(1800); // 0.5h = 1800s
  });

  it('resets runtime state after snapshotting', () => {
    const data = stateWithActiveSession();
    HANDLERS['cycle-complete'](data, {});
    expect(data.metrics.storiesCompleted).toBe(0);
    expect(data.stories).toEqual({});
    expect(data.currentPhase).toBe(0);
    // cycles preserved
    expect(data.cycles).toHaveLength(1);
  });

  it('increments cycle id across calls', () => {
    const data = stateWithActiveSession();
    HANDLERS['cycle-complete'](data, {});
    // Simulate another active session
    data.metrics.storiesCompleted = 2;
    HANDLERS['cycle-complete'](data, {});
    expect(data.cycles).toHaveLength(2);
    expect(data.cycles[1].id).toBe(2);
  });
});
```

- [ ] **Step 7.2: Run tests to verify they fail**

```bash
npx jest tests/unit/update-sdlc-status.test.js -t "cycle-complete" 2>&1 | tail -15
```

Expected: FAIL — `cycle-complete` not a handler

- [ ] **Step 7.3: Add cycle-complete handler to update-sdlc-status.js**

Add to `HANDLERS`:

```js
'cycle-complete': (data, opts) => {
  data.cycles = data.cycles || [];
  const nextId = data.cycles.length + 1;

  // Compute phaseDurations in seconds from phases startedAt/completedAt
  const phaseDurations = {};
  (data.phases || []).forEach(function(p) {
    if (p.startedAt && p.completedAt) {
      const ms = Date.parse(p.completedAt) - Date.parse(p.startedAt);
      if (isFinite(ms) && ms >= 0) {
        phaseDurations[p.name] = Math.round(ms / 1000);
      }
    }
  });

  const snapshot = {
    id: nextId,
    completedAt: nowISO(),
    storiesCompleted: (data.metrics && data.metrics.storiesCompleted) || 0,
    testsPassed: (data.metrics && data.metrics.testsPassed) || 0,
    coveragePercent: (data.metrics && data.metrics.coveragePercent) || 0,
    bugsFixed: (data.metrics && data.metrics.bugsFixed) || 0,
    phaseDurations,
  };
  data.cycles.push(snapshot);

  // Trim to last 50 cycles
  if (data.cycles.length > 50) data.cycles = data.cycles.slice(-50);

  // Reset runtime state (shared logic with session-start)
  resetSession(data, '0');
  appendLog(data, 'Conductor', `Cycle ${nextId} complete — ${snapshot.storiesCompleted} stories, ${snapshot.coveragePercent.toFixed(1)}% coverage`);
  return data;
},
```

- [ ] **Step 7.4: Run cycle tests**

```bash
npx jest tests/unit/update-sdlc-status.test.js -t "cycle-complete" 2>&1 | tail -15
```

Expected: All 4 cycle tests pass.

- [ ] **Step 7.5: Add cycle history HTML to dashboard.html**

Find the end of the main container section in `docs/dashboard.html` (search for `<!-- end container` or near the bottom of the visible sections before the `<script>` tag). Add the cycle history section:

```html
<!-- US-0133: Cycle history — lap strip + telemetry row -->
<div id="cycle-history-section" style="display:none; margin-bottom:24px;">
  <div
    style="font-family:var(--font-display),monospace; font-size:11px; text-transform:uppercase; letter-spacing:0.08em; color:var(--text-dim); margin-bottom:8px;"
  >
    Cycle History
  </div>
  <!-- Telemetry row -->
  <div id="cycle-telemetry" style="display:flex; gap:16px; margin-bottom:10px; flex-wrap:wrap;"></div>
  <!-- Lap strip -->
  <div id="cycle-lap-strip" style="display:flex; gap:8px; overflow-x:auto; padding-bottom:4px;"></div>
</div>
```

- [ ] **Step 7.6: Add cycle history CSS to dashboard.html**

In the `<style>` block of `docs/dashboard.html`, add:

```css
.cycle-card {
  flex: 0 0 auto;
  background: var(--bg-card);
  border: 1px solid var(--bg-card-border);
  border-radius: 8px;
  padding: 8px 12px;
  min-width: 120px;
  font-family: var(--font-sans);
  font-size: 11px;
}
.cycle-card-id {
  font-family: var(--font-display), monospace;
  font-size: 18px;
  font-weight: 700;
  color: var(--text-primary);
}
.cycle-card-stat {
  color: var(--text-muted);
  margin-top: 2px;
}
.cycle-telemetry-tile {
  background: var(--bg-card);
  border: 1px solid var(--bg-card-border);
  border-radius: 8px;
  padding: 8px 14px;
  text-align: center;
  font-family: var(--font-sans);
  min-width: 100px;
}
.cycle-telemetry-tile .tile-value {
  font-family: var(--font-display), monospace;
  font-size: 20px;
  font-weight: 700;
  color: var(--text-primary);
}
.cycle-telemetry-tile .tile-label {
  font-size: 10px;
  text-transform: uppercase;
  letter-spacing: 0.08em;
  color: var(--text-dim);
  margin-top: 2px;
}
```

- [ ] **Step 7.7: Add cycle history rendering in patchDOM**

In `docs/dashboard.html` inside `patchDOM(status)`, add after the epic strip block:

```js
// --- Cycle history (US-0133) -----------------------------------------------
var cycles = Array.isArray(status.cycles) ? status.cycles : [];
var cycleSection = document.getElementById('cycle-history-section');
var lapStrip = document.getElementById('cycle-lap-strip');
var telemetryRow = document.getElementById('cycle-telemetry');
if (cycleSection && lapStrip && telemetryRow) {
  if (cycles.length === 0) {
    cycleSection.style.display = 'none';
  } else {
    cycleSection.style.display = '';
    // Telemetry
    var avgMs =
      cycles.reduce(function (sum, c) {
        var total = Object.values(c.phaseDurations || {}).reduce(function (a, b) {
          return a + b;
        }, 0);
        return sum + total;
      }, 0) / cycles.length;
    var avgMin = Math.round(avgMs / 60);
    var today = new Date().toDateString();
    var cyclesToday = cycles.filter(function (c) {
      return c.completedAt && new Date(c.completedAt).toDateString() === today;
    }).length;
    var successRate =
      cycles.length > 0
        ? Math.round(
            (cycles.filter(function (c) {
              return (c.testsFailed || 0) === 0;
            }).length /
              cycles.length) *
              100,
          )
        : 0;
    telemetryRow.innerHTML = [
      { label: 'Cycles Total', value: cycles.length },
      { label: 'Today', value: cyclesToday },
      { label: 'Avg Cycle (min)', value: avgMin || '–' },
      { label: 'Success Rate', value: successRate + '%' },
    ]
      .map(function (t) {
        return (
          '<div class="cycle-telemetry-tile"><div class="tile-value">' +
          t.value +
          '</div><div class="tile-label">' +
          t.label +
          '</div></div>'
        );
      })
      .join('');
    // Lap strip — last 10 cycles, newest first
    var recent = cycles.slice(-10).reverse();
    var prevLen = parseInt(lapStrip.getAttribute('data-cycle-count') || '0', 10);
    lapStrip.innerHTML = recent
      .map(function (c) {
        return (
          '<div class="cycle-card">' +
          '<div class="cycle-card-id">#' +
          c.id +
          '</div>' +
          '<div class="cycle-card-stat">' +
          c.storiesCompleted +
          ' stories</div>' +
          '<div class="cycle-card-stat">' +
          (c.coveragePercent || 0).toFixed(1) +
          '% cov</div>' +
          '</div>'
        );
      })
      .join('');
    // Completion animation — play when cycle count increases
    if (cycles.length > prevLen && prevLen > 0 && typeof playBeep === 'function') {
      playBeep(523, 0.15); // C5
      setTimeout(function () {
        playBeep(659, 0.15);
      }, 150); // E5
      setTimeout(function () {
        playBeep(784, 0.2);
      }, 300); // G5
    }
    lapStrip.setAttribute('data-cycle-count', String(cycles.length));
  }
}
```

- [ ] **Step 7.8: Run full suite**

```bash
npx jest 2>&1 | tail -15
```

Expected: All tests pass.

- [ ] **Step 7.9: Commit**

```bash
git add tools/update-sdlc-status.js docs/dashboard.html tests/unit/update-sdlc-status.test.js
git commit -m "feat: US-0133 cycle history — cycle-complete command with resetSession, dashboard lap strip, telemetry row, completion animation"
```

---

## Task 8 — Dashboard Extraction Guide (US-0134)

**Files:**

- Create: `docs/dashboard-extraction.md`
- Modify: `scripts/install.sh` (add §7 dashboard setup)
- Modify: `README.md` (add Dashboard section with link)

- [ ] **Step 8.1: Create docs/dashboard-extraction.md**

````markdown
# Dashboard Extraction Guide

Step-by-step guide for adopting the Agentic SDLC Dashboard in another project.

## What You Get

- `docs/dashboard.html` — self-contained live dashboard (no build step)
- `docs/sdlc-status.json` — runtime state file updated by the Conductor
- `tools/update-sdlc-status.js` — CLI for the Conductor to update state
- `tools/init-sdlc-status.js` — initializes sdlc-status.json from your config

## Prerequisites

- Node.js 18+
- An `agents.config.json` in your project root (see step 2)

## Steps

### 1. Copy the files

```bash
cp /path/to/PlanVisualizer/docs/dashboard.html docs/
cp /path/to/PlanVisualizer/tools/update-sdlc-status.js tools/
cp /path/to/PlanVisualizer/tools/init-sdlc-status.js tools/
cp /path/to/PlanVisualizer/orchestrator/atomic-write.js orchestrator/
```
````

### 2. Add `project` and `phases` to agents.config.json

```json
{
  "project": {
    "name": "Your Project Name",
    "description": "A short description",
    "repoUrl": "https://github.com/yourorg/your-project",
    "startDate": "2026-01-01"
  },
  "phases": [
    { "name": "Build", "agents": ["Dev"], "deliverables": ["implementation"] },
    { "name": "Test", "agents": ["QA"], "deliverables": ["test report"] }
  ],
  "agents": {
    "Dev": { "role": "Backend Developer" },
    "QA": { "role": "Functional Tester" }
  }
}
```

### 3. Initialize the status file

```bash
node tools/init-sdlc-status.js
```

This creates `docs/sdlc-status.json` seeded with your project config. The dashboard reads it every 5 seconds via a local fetch.

### 4. Open the dashboard

Serve `docs/` with any static server (or open `docs/dashboard.html` directly in a browser for local use):

```bash
npx serve docs
```

### 5. Wire the Conductor

At the start of each pipeline session:

```bash
node tools/update-sdlc-status.js session-start --stories 5
node tools/update-sdlc-status.js epic-start --epic EPIC-0001 --name "My Epic" --stories 5
```

At each phase transition:

```bash
node tools/update-sdlc-status.js phase --number 1 --status in-progress
node tools/update-sdlc-status.js phase --number 1 --status complete
```

See `docs/agents/DM_AGENT.md` §Conductor Checklists for the full command reference.

### 6. End of session

```bash
node tools/update-sdlc-status.js epic-complete --epic EPIC-0001
node tools/update-sdlc-status.js cycle-complete
```

`cycle-complete` snapshots metrics into `cycles[]` and resets runtime state for the next session.

````

- [ ] **Step 8.2: Add §7 to scripts/install.sh**

At the end of `scripts/install.sh`, before the final `echo "[install] Done."` block, add:

```bash
# ── 7. Dashboard setup ────────────────────────────────────────────────────────
echo ""
echo "[install] Agentic SDLC Dashboard setup"
read -p "[install] Copy dashboard files to ${TARGET}/docs? (y/n) " -n 1 -r; echo
if [[ $REPLY =~ ^[Yy]$ ]]; then
  mkdir -p "${TARGET}/docs" "${TARGET}/tools" "${TARGET}/orchestrator"
  for f in docs/dashboard.html; do
    if [ -f "${REPO_ROOT}/${f}" ] && [ ! -f "${TARGET}/${f}" ]; then
      cp "${REPO_ROOT}/${f}" "${TARGET}/${f}"
      echo "[install] Copied ${f}"
    else
      echo "[install] Skipping ${f} (already exists)"
    fi
  done
  for f in tools/update-sdlc-status.js tools/init-sdlc-status.js; do
    [ -f "${REPO_ROOT}/${f}" ] && cp "${REPO_ROOT}/${f}" "${TARGET}/${f}" && echo "[install] Copied ${f}"
  done
  [ -f "${REPO_ROOT}/orchestrator/atomic-write.js" ] && cp "${REPO_ROOT}/orchestrator/atomic-write.js" "${TARGET}/orchestrator/atomic-write.js"
  echo "[install] Run: node tools/init-sdlc-status.js   (after adding project/phases to agents.config.json)"
  echo "[install] See: docs/dashboard-extraction.md for full adoption guide"
fi
````

- [ ] **Step 8.3: Add Dashboard section to README.md**

In `README.md`, find the section list or add after the main description:

```markdown
## Agentic SDLC Dashboard

A live dashboard that visualises pipeline agent activity at `docs/dashboard.html`.

**Adopting in another project:** see [`docs/dashboard-extraction.md`](docs/dashboard-extraction.md).
```

- [ ] **Step 8.4: Run full suite to confirm no regressions**

```bash
npx jest 2>&1 | tail -10
```

Expected: All tests pass.

- [ ] **Step 8.5: Commit**

```bash
git add docs/dashboard-extraction.md scripts/install.sh README.md
git commit -m "feat: US-0134 dashboard extraction guide — adoption docs, install.sh §7 dashboard setup"
```

---

## Task 9 — RELEASE_PLAN.md Write-Back & EPIC-0017 Closure

**Files:**

- Modify: `docs/RELEASE_PLAN.md` (update EPIC-0019 description; add US-0127–US-0134; mark EPIC-0017 Done)
- Modify: `docs/ID_REGISTRY.md` (advance US, AC, TC counters)

- [ ] **Step 9.1: Update EPIC-0019 description in RELEASE_PLAN.md**

Find the `EPIC-0019` code block in `docs/RELEASE_PLAN.md` and replace the `Description:` line:

```
Description: Comprehensive effectiveness improvement for the Agentic SDLC Dashboard. Covers three tracks: (A) schema generalization — replacing hackathon framing with a project config block, externalizing phase definitions, and removing hardcoded project identity from the HTML; (B) CLI completeness — epic lifecycle commands, session reset, coverage/bug/phase wiring in DM_AGENT.md; (C) new features — cycle history lap strip, aggregate telemetry, and a dashboard extraction guide for adopting projects. Supersedes the original narrow cycle-history scope.
```

Also update `Status: Planned` → `Status: In Progress`.

- [ ] **Step 9.2: Add US-0127–US-0134 under EPIC-0019 in RELEASE_PLAN.md**

Under `## User Stories — EPIC-0019`, add the following story blocks after any existing stories:

```
US-0127 (EPIC-0019): As a project adopter, I want sdlc-status.json to use a project config block instead of hackathon, so that the schema is meaningful for any ongoing project.
Priority: High (P0)
Estimate: S
Status: Planned
Branch: feature/US-0127-schema-generalization
Acceptance Criteria:
  - [ ] AC-0441: agents.config.json gains project section with name, description, repoUrl, startDate fields
  - [ ] AC-0442: init-sdlc-status.js reads config.project and writes it as sdlc-status.json.project
  - [ ] AC-0443: sdlc-status.json no longer contains a hackathon key
  - [ ] AC-0444: update-sdlc-status.js handlers preserve data.project on every mutation
  - [ ] AC-0445: sdlc-status.json migration maps hackathon.name → project.name, hackathon.date → project.startDate
  - [ ] AC-0446: init-sdlc-status.js exports buildStatus for unit testing; unit tests cover init and mutation preservation
Dependencies: None

US-0128 (EPIC-0019): As a project adopter, I want the dashboard to read its title and repo links from sdlc-status.json, so that I do not need to edit HTML to adopt it.
Priority: High (P0)
Estimate: S
Status: Planned
Branch: feature/US-0128-dashboard-dynamic-identity
Acceptance Criteria:
  - [ ] AC-0447: title tag is updated at page load from state.project.name on first successful fetch
  - [ ] AC-0448: header-title and header-subtitle elements are patched to project.name and project.description on each refreshState tick
  - [ ] AC-0449: about panel h3 and GitHub repo links read from project.name and project.repoUrl
  - [ ] AC-0450: log time field changed to ISO 8601 in update-sdlc-status.js; dashboard formats it as HH:MM for display
  - [ ] AC-0451: all hardcoded My Project and yourorg/your-project strings removed from dashboard.html
  - [ ] AC-0452: unit test covers patchDOM with mock state containing project fields
Dependencies: US-0127

US-0129 (EPIC-0019): As a project adopter, I want phase names and agents to come from agents.config.json, so that my project phases appear correctly without editing update-sdlc-status.js.
Priority: High (P0)
Estimate: M
Status: Planned
Branch: feature/US-0129-phase-config-externalization
Acceptance Criteria:
  - [ ] AC-0453: agents.config.json gains a phases array with name, agents, deliverables fields per phase
  - [ ] AC-0454: init-sdlc-status.js seeds sdlc-status.json.phases from config.phases with id, status:pending, startedAt:null, completedAt:null
  - [ ] AC-0455: update-sdlc-status.js phase handler reads definitions from data.phases (already seeded) with generic fallback
  - [ ] AC-0456: PHASE_DEFS constant is removed from update-sdlc-status.js
  - [ ] AC-0457: unit tests updated to pre-seed phases before calling phase handler
Dependencies: US-0127

US-0130 (EPIC-0019): As a Conductor agent, I want epic-start and epic-complete CLI commands, so that the dashboard shows epic-level progress alongside story progress.
Priority: High (P0)
Estimate: M
Status: Planned
Branch: feature/US-0130-epic-lifecycle-commands
Acceptance Criteria:
  - [ ] AC-0458: epic-start creates epics[id] entry with name, status:in-progress, startedAt, completedAt:null, storiesCompleted:0, storiesTotal:N
  - [ ] AC-0459: epic-complete sets status:complete and completedAt on epics[id]
  - [ ] AC-0460: story-complete with --epic increments epics[id].storiesCompleted if epic entry exists
  - [ ] AC-0461: dashboard renders a compact epic-progress strip showing name, storiesCompleted/storiesTotal, percent bar, status
  - [ ] AC-0462: DM_AGENT.md updated with epic-start and epic-complete Conductor calls
  - [ ] AC-0463: unit tests cover epic-start, epic-complete, and story-complete epic increment
Dependencies: US-0127

US-0131 (EPIC-0019): As a Conductor agent, I want a session-start command and validated required flags, so that each new pipeline session begins with clean state and ghost data cannot accumulate.
Priority: High (P0)
Estimate: M
Status: Planned
Branch: feature/US-0131-session-reset
Acceptance Criteria:
  - [ ] AC-0464: session-start --stories N resets phases, stories, metrics while preserving project, agents, epics, cycles, log
  - [ ] AC-0465: agent-start and agent-done exit non-zero with --agent is required if opts.agent is undefined or the string undefined
  - [ ] AC-0466: story-start no longer modifies storiesTotal; storiesTotal is set by session-start
  - [ ] AC-0467: DM_AGENT.md updated: Conductor calls session-start before first story of each epic
  - [ ] AC-0468: unit tests cover session-start reset, flag validation, and storiesTotal initialization
Dependencies: US-0127

US-0132 (EPIC-0019): As a Conductor agent, I want coverage, bug, and phase transition calls in the standard pipeline checklist, so that dashboard metrics reflect real execution state.
Priority: High (P0)
Estimate: S
Status: Planned
Branch: feature/US-0132-metrics-wiring
Acceptance Criteria:
  - [ ] AC-0469: bug-open --story US-XXXX increments metrics.bugsOpen
  - [ ] AC-0470: bug-fix --story US-XXXX decrements metrics.bugsOpen (floored at 0) and increments metrics.bugsFixed
  - [ ] AC-0471: story-complete auto-idles the story assignedAgent (status:idle, currentTask:null) if agent exists
  - [ ] AC-0472: DM_AGENT.md post-phase checklist gains phase command calls at start and complete of each phase
  - [ ] AC-0473: DM_AGENT.md Test-phase exit gains coverage command call with Circuit percent
  - [ ] AC-0474: unit tests cover bug-open, bug-fix (including floor guard), and story-complete agent auto-idle
Dependencies: US-0130, US-0131

US-0133 (EPIC-0019): As a Conductor reviewing pipeline performance, I want completed cycle snapshots in the dashboard, so that I can see lap history, average cycle time, and trend data.
Priority: High (P0)
Estimate: L
Status: Planned
Branch: feature/US-0133-cycle-history
Acceptance Criteria:
  - [ ] AC-0475: sdlc-status.json gains a cycles:[] array at root level
  - [ ] AC-0476: cycle-complete snapshots metrics (storiesCompleted, testsPassed, coveragePercent, bugsFixed, phaseDurations) into cycles[] with id and completedAt
  - [ ] AC-0477: phaseDurations computed from phase startedAt/completedAt in seconds
  - [ ] AC-0478: cycle-complete applies the same reset as session-start via shared resetSession() function (not recursive CLI call)
  - [ ] AC-0479: dashboard renders a lap-history strip of the last 10 cycles as compact cards
  - [ ] AC-0480: dashboard renders an aggregate telemetry row (total cycles, today count, avg cycle time, success rate)
  - [ ] AC-0481: a three-note audio animation plays when cycles.length increases between refreshState ticks
  - [ ] AC-0482: DM_AGENT.md updated: Conductor calls cycle-complete after all epic stories merge
  - [ ] AC-0483: unit tests cover cycle-complete snapshot, reset side-effect, phaseDurations computation
Dependencies: US-0131

US-0134 (EPIC-0019): As a developer adopting PlanVisualizer's dashboard for a new project, I want a documented extraction procedure and install step, so that I can set up the dashboard without manual search-and-replace.
Priority: Medium (P1)
Estimate: S
Status: Planned
Branch: feature/US-0134-extraction-guide
Acceptance Criteria:
  - [ ] AC-0484: docs/dashboard-extraction.md documents step-by-step adoption: copy files, populate agents.config.json project and phases, run init, open dashboard, wire Conductor
  - [ ] AC-0485: scripts/install.sh §7 copies dashboard.html, update-sdlc-status.js, init-sdlc-status.js, atomic-write.js to target; prompts user before copying
  - [ ] AC-0486: install.sh §7 is skipped (with note) if docs/dashboard.html already exists in target
  - [ ] AC-0487: docs/dashboard-extraction.md is linked from README.md under a Dashboard section
Dependencies: US-0128, US-0129
```

- [ ] **Step 9.3: Mark EPIC-0017 Done in RELEASE_PLAN.md**

Find the EPIC-0017 code block and update:

```
Status: Done
```

- [ ] **Step 9.4: Update ID_REGISTRY.md**

Open `docs/ID_REGISTRY.md` and update:

| Sequence | Next Available | Last Assigned |
| -------- | -------------- | ------------- |
| US       | US-0135        | US-0134       |
| AC       | AC-0488        | AC-0487       |
| TC       | TC-0158        | TC-0157       |

- [ ] **Step 9.5: Run full suite one final time**

```bash
npx jest --coverage 2>&1 | tail -20
```

Expected: All tests pass; coverage ≥ 80% statements.

- [ ] **Step 9.6: Commit**

```bash
git add docs/RELEASE_PLAN.md docs/ID_REGISTRY.md
git commit -m "docs: US-0127-0134 write-back to RELEASE_PLAN.md, EPIC-0017 marked Done, ID_REGISTRY updated"
```

---

## Self-Review Checklist

**Spec coverage:**

- G1.1 (epics empty) → Task 4 ✅
- G1.2 (undefined agent) → Task 5 ✅
- G1.3 (tasksTotal 0) → Task 5 ✅
- G1.4 (coveragePercent 0) → Task 6 ✅
- G1.5 (stale stories) → Task 5 ✅
- G1.6 (log time no date) → Task 2 ✅
- G2.1 (hackathon key) → Task 1 ✅
- G2.2 (PHASE_DEFS hardcoded) → Task 3 ✅
- G2.3 (My Project hardcoded) → Task 2 ✅
- G2.4 (config/state mixed) → Task 1 ✅
- G2.5 (no extraction path) → Task 8 ✅
- G3.1 (phase never called) → Task 6 ✅
- G3.2 (coverage not in checklist) → Task 6 ✅
- G3.3 (story-complete no auto-idle) → Task 6 ✅
- G3.4 (no session-start) → Task 5 ✅
- G3.5 (storiesTotal dynamic) → Task 5 ✅
- G3.6 (bug metrics never updated) → Task 6 ✅

**All 8 US IDs → Tasks 1–9 ✅**
**RELEASE_PLAN.md write-back → Task 9 ✅**
**ID_REGISTRY update → Task 9 ✅**
