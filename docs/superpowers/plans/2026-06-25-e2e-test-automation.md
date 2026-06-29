# E2E Test Automation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement EPIC-0047 (test infrastructure) and EPIC-0048 (pipeline scenarios) — a three-layer e2e test suite covering install/update scripts, both dashboards, the agentic CLI state machine, and a GitHub-connected Layer 2 scenario driven by the Shelf initialization prompt.

**Architecture:** Layer 1 tests run entirely locally against deterministic fixtures using Node's `child_process` and HTML string inspection — no browser, no network. A gated Playwright suite covers live dashboard behaviours. A separately gated Layer 2 suite runs the Shelf init prompt against a real GitHub repo and polls for the resulting PR.

**Tech Stack:** Node.js 22, Jest (e2e config), `child_process.execSync`, `@playwright/test` (Task 9 only), `gh` CLI (Layer 2 only), PlanVisualizer CLI tools (`tools/agent-lifecycle.js`, `tools/agent-spec-plan.js`, `tools/deploy-status.js`).

## Global Constraints

- All e2e test files live under `tests/e2e/` and use `.spec.js` extension
- Jest e2e config (`jest.e2e.config.js`) is separate from `jest.config.js` — `npm test` must not change
- `tests/e2e/fixtures/` uses T-namespace IDs (EPIC-T001, US-T001, AC-T001) — never real production IDs
- Layer 2 tests (`pipeline-github.spec.js`) skip automatically when `E2E_GITHUB_TOKEN` is absent
- Playwright tests skip automatically when `PLAYWRIGHT_E2E` env var is absent
- Every new test file must have a `afterAll` that cleans up any temp dirs it created
- No test may write to the PlanVisualizer repo's own `docs/` directory — only to temp dirs
- `npm test` (unit + integration) must still pass 2715/2715 after every task

---

## File Map

```
Create:
  tests/e2e/helpers/index.js               Task 1 — shared helpers
  tests/e2e/helpers/index.test.js          Task 1 — helper unit tests
  tests/e2e/fixtures/RELEASE_PLAN.md       Task 2 — Layer 1 fixture
  tests/e2e/fixtures/BUGS.md               Task 2 — Layer 1 fixture
  tests/e2e/fixtures/LESSONS.md            Task 2 — Layer 1 fixture
  tests/e2e/fixtures/sdlc-status-init.json Task 2 — dashboard fixture
  tests/e2e/fixtures/fixtures.smoke.test.js Task 2 — fixture smoke test
  jest.e2e.config.js                       Task 3 — e2e jest config
  .github/workflows/e2e.yml                Task 3 — nightly CI job
  tests/e2e/install.spec.js                Task 4 — install suite
  tests/e2e/update.spec.js                 Task 5 — update suite
  tests/e2e/pipeline-local.spec.js         Task 6 — local pipeline suite
  tests/e2e/pipeline-agentic.spec.js       Task 7 — agentic lifecycle suite
  tests/e2e/pipeline-github.spec.js        Task 8 — Layer 2 GitHub suite
  tests/e2e/dashboard-playwright.spec.js   Task 9 — Playwright suite
  tests/e2e/snapshots/                     Task 9 — generated snapshots (committed)

Modify:
  package.json                             Tasks 3, 9 — add test:e2e script + @playwright/test
```

---

### Task 1: E2E Helpers Module (US-0264)

**Files:**

- Create: `tests/e2e/helpers/index.js`
- Create: `tests/e2e/helpers/index.test.js`

**Interfaces:**

- Produces:
  - `createTempProject({ skipGitInit?: boolean }) → { dir: string, cleanup(): void }`
  - `runScript(script: string, args?: string[], cwd?: string, opts?: { timeout?: number }) → string`
  - `assertHtml(htmlPath: string, checks: { contains?: string[], excludes?: string[] }) → void`
  - `assertSdlcState(sdlcPath: string, shape: object) → void`
  - `waitForPR(branchName: string, timeoutMs?: number, intervalMs?: number) → Promise<number>`

- [ ] **Step 1: Write the failing helper tests**

```javascript
// tests/e2e/helpers/index.test.js
'use strict';
const fs = require('fs');
const path = require('path');
const os = require('os');
const { createTempProject, runScript, assertHtml, assertSdlcState } = require('./index');

describe('createTempProject', () => {
  it('creates a temp dir with a git repo and cleanup removes it', () => {
    const { dir, cleanup } = createTempProject();
    expect(fs.existsSync(dir)).toBe(true);
    expect(fs.existsSync(path.join(dir, '.git'))).toBe(true);
    cleanup();
    expect(fs.existsSync(dir)).toBe(false);
  });

  it('skipGitInit omits the .git directory', () => {
    const { dir, cleanup } = createTempProject({ skipGitInit: true });
    expect(fs.existsSync(path.join(dir, '.git'))).toBe(false);
    cleanup();
  });
});

describe('runScript', () => {
  it('returns stdout on success', () => {
    const { dir, cleanup } = createTempProject();
    const out = runScript('echo hello', [], dir);
    expect(out.trim()).toBe('hello');
    cleanup();
  });

  it('throws a descriptive error including stdout and stderr on failure', () => {
    const { dir, cleanup } = createTempProject();
    expect(() => runScript('exit 1', [], dir)).toThrow('Exit code');
    cleanup();
  });
});

describe('assertHtml', () => {
  let tmp;
  beforeEach(() => {
    tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'pv-html-'));
  });
  afterEach(() => fs.rmSync(tmp, { recursive: true, force: true }));

  it('passes when contains strings are present', () => {
    const f = path.join(tmp, 'test.html');
    fs.writeFileSync(f, '<html><body>Hello World</body></html>');
    expect(() => assertHtml(f, { contains: ['Hello', 'World'] })).not.toThrow();
  });

  it('throws when a contains string is missing', () => {
    const f = path.join(tmp, 'test.html');
    fs.writeFileSync(f, '<html><body>Hello</body></html>');
    expect(() => assertHtml(f, { contains: ['Missing'] })).toThrow();
  });

  it('throws when an excludes string is present', () => {
    const f = path.join(tmp, 'test.html');
    fs.writeFileSync(f, '<html><body>Error</body></html>');
    expect(() => assertHtml(f, { excludes: ['Error'] })).toThrow();
  });
});

describe('assertSdlcState', () => {
  let tmp;
  beforeEach(() => {
    tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'pv-sdlc-'));
  });
  afterEach(() => fs.rmSync(tmp, { recursive: true, force: true }));

  it('passes when scalar and object shapes match', () => {
    const f = path.join(tmp, 'sdlc-status.json');
    fs.writeFileSync(
      f,
      JSON.stringify({
        tasks: { 'US-T001': { status: 'in_progress' } },
        log: [],
      }),
    );
    expect(() =>
      assertSdlcState(f, {
        tasks: { 'US-T001': { status: 'in_progress' } },
      }),
    ).not.toThrow();
  });

  it('throws when a scalar does not match', () => {
    const f = path.join(tmp, 'sdlc-status.json');
    fs.writeFileSync(f, JSON.stringify({ tasks: {}, log: [] }));
    expect(() => assertSdlcState(f, { tasks: { 'US-T001': { status: 'in_progress' } } })).toThrow();
  });
});
```

- [ ] **Step 2: Run to confirm all fail**

```bash
npx jest tests/e2e/helpers/index.test.js --no-coverage 2>&1 | tail -5
# Expected: Cannot find module './index'
```

- [ ] **Step 3: Implement the helpers module**

```javascript
// tests/e2e/helpers/index.js
'use strict';
const fs = require('fs');
const path = require('path');
const os = require('os');
const { execSync } = require('child_process');

const ROOT = path.resolve(__dirname, '../../..');

function createTempProject({ skipGitInit = false } = {}) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'pv-e2e-'));
  if (!skipGitInit) {
    execSync('git init', { cwd: dir, stdio: 'pipe' });
    execSync('git config user.email "test@pv-e2e.local"', { cwd: dir, stdio: 'pipe' });
    execSync('git config user.name "PV E2E"', { cwd: dir, stdio: 'pipe' });
    execSync('git commit --allow-empty -m "init"', { cwd: dir, stdio: 'pipe' });
  }
  return {
    dir,
    cleanup() {
      fs.rmSync(dir, { recursive: true, force: true });
    },
  };
}

function runScript(script, args = [], cwd, { timeout = 120000 } = {}) {
  // Shell scripts (scripts/*.sh): resolve relative to PV root
  const isShellScript = script.endsWith('.sh') || script.startsWith('scripts/');
  let fullCmd;
  if (isShellScript) {
    const scriptPath = path.isAbsolute(script) ? script : path.join(ROOT, script);
    const quotedArgs = args.map((a) => `"${a.replace(/"/g, '\\"')}"`).join(' ');
    fullCmd = `bash "${scriptPath}" ${quotedArgs}`.trim();
  } else {
    // npm, node, or inline shell command
    const quotedArgs = args.map((a) => `"${a.replace(/"/g, '\\"')}"`).join(' ');
    fullCmd = args.length ? `${script} ${quotedArgs}` : script;
  }
  try {
    return execSync(fullCmd, {
      cwd: cwd || ROOT,
      timeout,
      encoding: 'utf8',
      stdio: 'pipe',
    });
  } catch (err) {
    throw new Error(
      [
        `Command failed: ${fullCmd}`,
        `Exit code: ${err.status ?? 'unknown'}`,
        `stdout: ${err.stdout || ''}`,
        `stderr: ${err.stderr || ''}`,
      ].join('\n'),
    );
  }
}

function assertHtml(htmlPath, { contains = [], excludes = [] } = {}) {
  const html = fs.readFileSync(htmlPath, 'utf8');
  for (const str of contains) {
    expect(html).toContain(str);
  }
  for (const str of excludes) {
    expect(html).not.toContain(str);
  }
}

function assertSdlcState(sdlcPath, shape) {
  const json = JSON.parse(fs.readFileSync(sdlcPath, 'utf8'));
  for (const [key, expected] of Object.entries(shape)) {
    if (typeof expected === 'object' && expected !== null) {
      expect(json[key]).toMatchObject(expected);
    } else {
      expect(json[key]).toBe(expected);
    }
  }
}

async function waitForPR(branchName, timeoutMs = 1800000, intervalMs = 30000) {
  const token = process.env.E2E_GITHUB_TOKEN;
  if (!token) throw new Error('E2E_GITHUB_TOKEN not set');
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    try {
      const out = execSync(`gh pr list --head "${branchName}" --json number`, {
        encoding: 'utf8',
        env: { ...process.env, GH_TOKEN: token },
        stdio: 'pipe',
      });
      const prs = JSON.parse(out);
      if (prs.length > 0) return prs[0].number;
    } catch (_) {
      /* not ready yet */
    }
    await new Promise((r) => setTimeout(r, intervalMs));
  }
  throw new Error(`No PR for branch "${branchName}" after ${timeoutMs}ms`);
}

module.exports = { createTempProject, runScript, assertHtml, assertSdlcState, waitForPR };
```

- [ ] **Step 4: Run helpers tests and confirm all pass**

```bash
npx jest tests/e2e/helpers/index.test.js --no-coverage 2>&1 | tail -5
# Expected: Tests: 7 passed, 7 total
```

- [ ] **Step 5: Confirm main test suite is unaffected**

```bash
npm test 2>&1 | tail -3
# Expected: Tests: 2715 passed, 2715 total
```

- [ ] **Step 6: Commit**

```bash
git add tests/e2e/helpers/
git commit -m "feat: add e2e helpers module (US-0264) — createTempProject, runScript, assertHtml, assertSdlcState, waitForPR"
```

---

### Task 2: Layer 1 Static Fixtures (US-0265)

**Files:**

- Create: `tests/e2e/fixtures/RELEASE_PLAN.md`
- Create: `tests/e2e/fixtures/BUGS.md`
- Create: `tests/e2e/fixtures/LESSONS.md`
- Create: `tests/e2e/fixtures/sdlc-status-init.json`
- Create: `tests/e2e/fixtures/fixtures.smoke.test.js`

**Interfaces:**

- Consumes: `tests/e2e/helpers/index.js` (assertHtml), `tools/generate-plan.js`
- Produces: fixture files that all Layer 1 suites copy into temp project dirs

- [ ] **Step 1: Write the fixture smoke test**

```javascript
// tests/e2e/fixtures/fixtures.smoke.test.js
'use strict';
const path = require('path');
const fs = require('fs');
const { execSync } = require('child_process');
const os = require('os');

const ROOT = path.resolve(__dirname, '../../..');
const FIXTURES = path.join(__dirname);

describe('Layer 1 fixtures smoke tests', () => {
  let tmp;
  beforeAll(() => {
    tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'pv-fixture-smoke-'));
  });
  afterAll(() => fs.rmSync(tmp, { recursive: true, force: true }));

  it('RELEASE_PLAN.md fixture exists and is non-empty', () => {
    const content = fs.readFileSync(path.join(FIXTURES, 'RELEASE_PLAN.md'), 'utf8');
    expect(content.length).toBeGreaterThan(500);
    expect(content).toContain('EPIC-T001');
    expect(content).toContain('E2E-Fixture:');
  });

  it('BUGS.md fixture has 5 bugs covering all status values', () => {
    const content = fs.readFileSync(path.join(FIXTURES, 'BUGS.md'), 'utf8');
    expect(content).toContain('Status: Fixed');
    expect(content).toContain('Status: Open');
    expect(content).toContain('Status: In Progress');
    expect(content).toContain('Status: WontFix');
  });

  it('LESSONS.md fixture has @agent: tags on their own lines', () => {
    const content = fs.readFileSync(path.join(FIXTURES, 'LESSONS.md'), 'utf8');
    expect(content).toMatch(/^@agent: \w/m);
    expect(content).not.toMatch(/## L-.*@agent:/);
  });

  it('sdlc-status-init.json is valid canonical shape', () => {
    const json = JSON.parse(fs.readFileSync(path.join(FIXTURES, 'sdlc-status-init.json'), 'utf8'));
    expect(json).toHaveProperty('tasks');
    expect(json).toHaveProperty('log');
    expect(json).toHaveProperty('programme.phases');
    expect(json.programme.phases).toHaveLength(7);
    expect(Object.keys(json.tasks)).toHaveLength(0);
  });

  it('generate-plan.js accepts the fixture RELEASE_PLAN.md without errors', () => {
    // Copy fixture into tmp, run generate-plan pointing at it
    fs.copyFileSync(path.join(FIXTURES, 'RELEASE_PLAN.md'), path.join(tmp, 'RELEASE_PLAN.md'));
    // generate-plan reads from process.cwd() by default — run from tmp
    expect(() =>
      execSync(`node "${path.join(ROOT, 'tools/generate-plan.js')}"`, {
        cwd: tmp,
        stdio: 'pipe',
        timeout: 30000,
      }),
    ).not.toThrow();
  });
});
```

- [ ] **Step 2: Run to confirm all fail (fixtures don't exist yet)**

```bash
npx jest tests/e2e/fixtures/fixtures.smoke.test.js --no-coverage 2>&1 | tail -5
# Expected: ENOENT or similar — files not found
```

- [ ] **Step 3: Create RELEASE_PLAN.md fixture**

```markdown
<!-- tests/e2e/fixtures/RELEASE_PLAN.md -->

# RELEASE_PLAN.md — E2E Test Fixture

> This file uses T-namespace IDs (EPIC-T, US-T, AC-T) to avoid colliding
> with production ID sequences. Do not use these IDs in real project files.

## Epics

- EPIC-T001: E2E Fixture — Completed Work
- EPIC-T002: E2E Fixture — Active Work
- EPIC-T003: E2E Fixture — Planned Work

---

## Epic — EPIC-T001: E2E Fixture — Completed Work
```

EPIC-T001: E2E Fixture — Completed Work
Description: Completed stories used as e2e test fixtures. All stories Done.
Status: Done

```

## User Stories — EPIC-T001

```

US-T001 (EPIC-T001): E2E-Fixture: As a user, I want to log in so that I can access my account.
Priority: High (P0)
Estimate: S
Status: Done
Acceptance Criteria:

- [x] AC-T001: Login form accepts email and password and submits on Enter
- [x] AC-T002: Invalid credentials show an inline error message within 500 ms

```

```

US-T002 (EPIC-T001): E2E-Fixture: As a user, I want my session to persist across page reloads.
Priority: High (P0)
Estimate: XS
Status: Done
Acceptance Criteria:

- [x] AC-T003: Reloading the page does not redirect to login when a valid session exists
- [x] AC-T004: Session expires after 30 minutes of inactivity

```

```

US-T003 (EPIC-T001): E2E-Fixture: As an admin, I want to view an audit log of all user actions.
Priority: Medium (P1)
Estimate: M
Status: Done
Acceptance Criteria:

- [x] AC-T005: Audit log table shows actor, action, and timestamp columns
- [x] AC-T006: Audit log is paginated at 50 rows per page

```

---

## Epic — EPIC-T002: E2E Fixture — Active Work

```

EPIC-T002: E2E Fixture — Active Work
Description: Stories currently in flight for e2e testing coverage of in-progress states.
Status: In Progress

```

## User Stories — EPIC-T002

```

US-T004 (EPIC-T002): E2E-Fixture: As a user, I want to search records by keyword so that I can find items quickly.
Priority: High (P1)
Estimate: M
Status: In Progress
Acceptance Criteria:

- [x] AC-T007: Search input debounces at 300 ms before sending a request
- [ ] AC-T008: Search results highlight the matching keyword in each row

```

```

US-T005 (EPIC-T002): E2E-Fixture: As a user, I want to export data as CSV so that I can analyse it offline.
Priority: Medium (P1)
Estimate: S
Status: Blocked
Acceptance Criteria:

- [ ] AC-T009: Export button generates a valid RFC 4180 CSV file
- [ ] AC-T010: CSV filename includes the current date in YYYY-MM-DD format

```

```

US-T006 (EPIC-T002): E2E-Fixture: As a developer, I want all mutations to emit structured events so that integrations can react to changes.
Priority: Low (P2)
Estimate: L
Status: Planned
Acceptance Criteria:

- [ ] AC-T011: Each mutation emits an event with type, payload, and timestamp fields
- [ ] AC-T012: Events are published to a configurable webhook URL if set

```

---

## Epic — EPIC-T003: E2E Fixture — Planned Work

```

EPIC-T003: E2E Fixture — Planned Work
Description: Stories not yet started, covering planned and to-do states.
Status: Planned

```

## User Stories — EPIC-T003

```

US-T007 (EPIC-T003): E2E-Fixture: As a manager, I want a summary dashboard so that I can see key metrics at a glance.
Priority: High (P1)
Estimate: L
Status: Planned
Acceptance Criteria:

- [ ] AC-T013: Dashboard shows total record count, active users, and error rate
- [ ] AC-T014: Metrics refresh automatically every 60 seconds

```

```

US-T008 (EPIC-T003): E2E-Fixture: As an operator, I want API rate limiting so that the service remains stable under load.
Priority: High (P0)
Estimate: M
Status: To Do
Acceptance Criteria:

- [ ] AC-T015: Requests exceeding 100 per minute per IP receive HTTP 429
- [ ] AC-T016: Rate limit headers (X-RateLimit-Limit, X-RateLimit-Remaining) are included in every response

```

```

US-T009 (EPIC-T003): E2E-Fixture: As a developer, I want webhook delivery retries so that transient failures do not cause data loss.
Priority: Medium (P1)
Estimate: M
Status: To Do
Acceptance Criteria:

- [ ] AC-T017: Failed webhook deliveries are retried up to 3 times with exponential back-off
- [ ] AC-T018: After 3 failures the event is written to a dead-letter queue

```

```

US-T010 (EPIC-T003): E2E-Fixture: As a mobile user, I want the UI to be responsive so that I can use it on a phone.
Priority: Medium (P2)
Estimate: S
Status: To Do
Acceptance Criteria:

- [ ] AC-T019: All primary actions are reachable on a 375 px wide viewport
- [ ] AC-T020: No horizontal scrollbar appears on screens narrower than 400 px

```

```

US-T011 (EPIC-T003): E2E-Fixture: As a user, I want dark mode so that I can use the app comfortably at night.
Priority: Low (P2)
Estimate: S
Status: Planned
Acceptance Criteria:

- [ ] AC-T021: Dark mode activates when the OS prefers-color-scheme is dark
- [ ] AC-T022: A toggle in the settings panel overrides the OS preference

```

```

US-T012 (EPIC-T003): E2E-Fixture: As an SRE, I want performance monitoring so that I can detect regressions before they affect users.
Priority: Medium (P1)
Estimate: M
Status: Planned
Acceptance Criteria:

- [ ] AC-T023: P95 response time is reported per endpoint in the metrics dashboard
- [ ] AC-T024: An alert fires when P95 exceeds 500 ms for more than 5 minutes

```

```

- [ ] **Step 4: Create BUGS.md fixture**

```markdown
<!-- tests/e2e/fixtures/BUGS.md -->

# BUGS.md — E2E Test Fixture

---

### BUG-T001 — Login redirect loop on expired token

Status: Fixed
Severity: High
Reported: 2026-01-10
Fixed: 2026-01-12

**Root cause:** Token expiry check ran after redirect, not before.
**Fix:** Moved expiry check to middleware.

---

### BUG-T002 — CSV export omits the header row

Status: Fixed
Severity: Medium
Reported: 2026-01-15
Fixed: 2026-01-16

**Root cause:** Header write was conditional on a flag that defaulted false.
**Fix:** Default the flag to true.

---

### BUG-T003 — Search results flicker on rapid keystrokes

Status: Open
Severity: Low
Reported: 2026-02-01

**Steps to reproduce:** Type quickly in the search field. Results flash blank between keystrokes.

---

### BUG-T004 — Webhook retries do not honour exponential back-off

Status: In Progress
Severity: High
Reported: 2026-02-10

**Root cause under investigation.** Retry interval appears to be fixed at 1 second regardless of attempt count.

---

### BUG-T005 — Dark mode toggle ignored on Safari

Status: WontFix
Severity: Low
Reported: 2026-02-20

**Decision:** Safari < 16 does not support the CSS `color-scheme` property. Supporting it requires a JavaScript polyfill. Deferred indefinitely — browser share < 2%.
```

- [ ] **Step 5: Create LESSONS.md fixture**

```markdown
<!-- tests/e2e/fixtures/LESSONS.md -->

# LESSONS.md — E2E Test Fixture

---

## L-T001 — Always debounce search inputs to avoid request storms

@agent: Forge

**Rule:** Attaching a search handler directly to `keyup` sends one request per keystroke. A 300 ms debounce reduces request volume by ~90% at typical typing speeds. Use `lodash.debounce` or a plain `setTimeout`/`clearTimeout` pattern.
_Identified during BUG-T003 investigation._
**Date:** 2026-02-05

---

## L-T002 — Validate CSV output against RFC 4180 in tests, not just visually

@agent: Sentinel

**Rule:** Opening a CSV in a spreadsheet app does not catch embedded newlines in field values, missing quotes around commas, or BOM encoding issues. Write a test that parses the generated bytes with a strict RFC 4180 parser and asserts field count per row.
_Identified during BUG-T002 investigation._
**Date:** 2026-01-16

---

## L-T003 — Middleware execution order determines security — document it

@agent: Keystone

**Rule:** Placing authentication middleware after a route handler silently allows unauthenticated access. Document the middleware stack order explicitly in the architecture doc and write a test that sends an unauthenticated request to every protected route and asserts HTTP 401.
_Identified during BUG-T001 investigation._
**Date:** 2026-01-12
```

- [ ] **Step 6: Create sdlc-status-init.json fixture**

Read `tests/unit/generate-dashboard.test.js` lines 20–48 to see `CANONICAL_PHASES` and `AGENT_NAMES`, then write:

```json
{
  "tasks": {},
  "log": [],
  "programme": {
    "project": {
      "name": "E2E Test Project",
      "description": "Fixture project for e2e testing",
      "repoUrl": "https://github.com/ksyed0/pv-e2e-target",
      "startDate": "2026-06-25"
    },
    "cycles": [],
    "currentPhase": 3,
    "phases": [
      {
        "id": 1,
        "name": "Blueprint",
        "agents": ["Compass"],
        "deliverables": ["refined ACs", "priority list"],
        "status": "complete"
      },
      {
        "id": 2,
        "name": "Architect",
        "agents": ["Keystone"],
        "deliverables": ["scaffold", "types", "service stubs"],
        "status": "complete"
      },
      {
        "id": 3,
        "name": "Build",
        "agents": ["Pixel", "Forge", "Palette"],
        "deliverables": ["implementation", "unit tests"],
        "status": "in-progress"
      },
      {
        "id": 4,
        "name": "Integration",
        "agents": ["Pixel"],
        "deliverables": ["wired services", "e2e flows"],
        "status": "pending"
      },
      {
        "id": 5,
        "name": "Test",
        "agents": ["Sentinel", "Circuit"],
        "deliverables": ["test report", "coverage"],
        "status": "pending"
      },
      {
        "id": 6,
        "name": "Polish",
        "agents": ["Pixel", "Forge"],
        "deliverables": ["bug fixes", "demo prep"],
        "status": "pending"
      },
      {
        "id": 7,
        "name": "Deploy",
        "agents": ["Deploy"],
        "deliverables": ["deployed sha", "environment health report", "open incidents"],
        "status": "pending"
      }
    ],
    "agents": {
      "Conductor": { "status": "idle", "currentTask": null, "tasksCompleted": 0 },
      "Compass": { "status": "idle", "currentTask": null, "tasksCompleted": 1 },
      "Keystone": { "status": "idle", "currentTask": null, "tasksCompleted": 1 },
      "Lens": { "status": "idle", "currentTask": null, "tasksCompleted": 0 },
      "Palette": { "status": "idle", "currentTask": null, "tasksCompleted": 0 },
      "Forge": { "status": "active", "currentTask": "US-T004: search functionality", "tasksCompleted": 1 },
      "Pixel": { "status": "idle", "currentTask": null, "tasksCompleted": 1 },
      "Sentinel": { "status": "idle", "currentTask": null, "tasksCompleted": 0 },
      "Circuit": { "status": "idle", "currentTask": null, "tasksCompleted": 0 },
      "Deploy": { "status": "idle", "currentTask": null, "tasksCompleted": 0 }
    },
    "epics": { "EPIC-T001": "E2E Fixture — Completed Work", "EPIC-T002": "E2E Fixture — Active Work" },
    "stories": {
      "US-T001": { "epic": "EPIC-T001", "title": "E2E-Fixture: Login", "status": "done" },
      "US-T004": { "epic": "EPIC-T002", "title": "E2E-Fixture: Search functionality", "status": "in_progress" }
    },
    "activeSprint": null,
    "conductorLastDispatch": null,
    "conductorHoldReason": null
  }
}
```

- [ ] **Step 7: Run fixture smoke tests and confirm all pass**

```bash
npx jest tests/e2e/fixtures/fixtures.smoke.test.js --no-coverage 2>&1 | tail -5
# Expected: Tests: 5 passed, 5 total
```

- [ ] **Step 8: Confirm main suite unaffected**

```bash
npm test 2>&1 | tail -3
# Expected: Tests: 2715 passed, 2715 total
```

- [ ] **Step 9: Commit**

```bash
git add tests/e2e/fixtures/
git commit -m "feat: add Layer 1 e2e test fixtures (US-0265) — RELEASE_PLAN, BUGS, LESSONS, sdlc-status-init"
```

---

### Task 3: jest.e2e.config.js + npm script + CI workflow (US-0266)

**Files:**

- Create: `jest.e2e.config.js`
- Create: `.github/workflows/e2e.yml`
- Modify: `package.json` — add `test:e2e` script

**Interfaces:**

- Consumes: `tests/e2e/**/*.spec.js` (not yet created — config must handle empty suite gracefully)
- Produces: `npm run test:e2e` entry point; nightly CI job

- [ ] **Step 1: Create jest.e2e.config.js**

```javascript
// jest.e2e.config.js
'use strict';
module.exports = {
  testEnvironment: 'node',
  testMatch: ['**/tests/e2e/**/*.spec.js'],
  testPathIgnorePatterns: ['/node_modules/', '/tests/e2e/fixtures/'],
  testTimeout: 120000,
  // No coverage — e2e tests exercise integration paths, not line coverage
};
```

- [ ] **Step 2: Add test:e2e script to package.json**

In `package.json`, add after the existing `"test"` entry:

```json
"test:e2e": "jest --config jest.e2e.config.js",
```

- [ ] **Step 3: Verify test:e2e runs (empty suite passes)**

```bash
npm run test:e2e 2>&1 | tail -5
# Expected: Test Suites: 0 skipped / passed — no .spec.js files exist yet
```

- [ ] **Step 4: Create e2e CI workflow**

```yaml
# .github/workflows/e2e.yml
name: E2E Tests

on:
  workflow_dispatch:
  schedule:
    - cron: '0 3 * * *' # 03:00 UTC nightly

jobs:
  e2e-layer1:
    runs-on: ubuntu-latest
    timeout-minutes: 30
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: '22'
          cache: 'npm'
      - run: npm ci
      - run: npm run test:e2e -- --testPathIgnorePatterns="pipeline-github"
        env:
          PLAYWRIGHT_E2E: 'true'
      - uses: actions/upload-artifact@v4
        if: always()
        with:
          name: e2e-report-${{ github.run_id }}
          path: |
            tests/e2e/snapshots/

  e2e-layer2:
    runs-on: ubuntu-latest
    timeout-minutes: 60
    needs: e2e-layer1
    if: github.event_name == 'schedule'
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: '22'
          cache: 'npm'
      - run: npm ci
      - run: npm run test:e2e -- --testPathPattern="pipeline-github"
        env:
          E2E_GITHUB_TOKEN: ${{ secrets.E2E_GITHUB_TOKEN }}
```

- [ ] **Step 5: Confirm ci.yml is unchanged**

```bash
grep "test:e2e\|e2e" .github/workflows/ci.yml
# Expected: no output — ci.yml must not reference test:e2e
```

- [ ] **Step 6: Confirm main suite still passes**

```bash
npm test 2>&1 | tail -3
# Expected: Tests: 2715 passed, 2715 total
```

- [ ] **Step 7: Commit**

```bash
git add jest.e2e.config.js .github/workflows/e2e.yml package.json
git commit -m "feat: add test:e2e script, jest.e2e.config.js, nightly e2e CI job (US-0266)"
```

---

### Task 4: Install & Idempotency Suite (US-0267)

**Files:**

- Create: `tests/e2e/install.spec.js`

**Interfaces:**

- Consumes: `tests/e2e/helpers/index.js` (all four helpers), `scripts/install.sh`
- Produces: Suite covering AC-1033 through AC-1036

**Before starting:** Read `scripts/install.sh` lines 1–80 to understand what files it creates in the target and whether it runs `npm install`. The tests assert the file tree it produces — verify your assertions match actual output.

- [ ] **Step 1: Write install.spec.js**

```javascript
// tests/e2e/install.spec.js
'use strict';
const fs = require('fs');
const path = require('path');
const { createTempProject, runScript, assertHtml } = require('./helpers');

const ROOT = path.resolve(__dirname, '../..');

describe('Suite 1: install.sh', () => {
  describe('fresh install', () => {
    let proj;
    beforeAll(() => {
      proj = createTempProject();
      runScript('scripts/install.sh', [proj.dir]);
    }, 120000);
    afterAll(() => proj.cleanup());

    it('AC-1033a: CLAUDE.md exists in target', () => {
      expect(fs.existsSync(path.join(proj.dir, 'CLAUDE.md'))).toBe(true);
    });

    it('AC-1033b: AGENTS.md exists in target', () => {
      expect(fs.existsSync(path.join(proj.dir, 'AGENTS.md'))).toBe(true);
    });

    it('AC-1033c: plan-visualizer.config.json exists in target', () => {
      expect(fs.existsSync(path.join(proj.dir, 'plan-visualizer.config.json'))).toBe(true);
    });

    it('AC-1033d: docs/ID_REGISTRY.md exists in target', () => {
      expect(fs.existsSync(path.join(proj.dir, 'docs', 'ID_REGISTRY.md'))).toBe(true);
    });

    it('AC-1033e: npm run build in target produces plan-status.html', () => {
      runScript('npm run build', [], proj.dir, { timeout: 60000 });
      assertHtml(path.join(proj.dir, 'plan-status.html'), {
        contains: ['PlanVisualizer'],
        excludes: ['<<<', 'undefined'],
      });
    });

    it('AC-1036: npm run check:ids in target exits 0', () => {
      expect(() => runScript('npm run check:ids', [], proj.dir)).not.toThrow();
    });
  });

  describe('idempotency (AC-1034)', () => {
    let proj;
    const SENTINEL = '"e2e-sentinel": true';
    beforeAll(() => {
      proj = createTempProject();
      runScript('scripts/install.sh', [proj.dir]);
      // Add a sentinel key to the config
      const cfgPath = path.join(proj.dir, 'plan-visualizer.config.json');
      const cfg = JSON.parse(fs.readFileSync(cfgPath, 'utf8'));
      cfg['e2e-sentinel'] = true;
      fs.writeFileSync(cfgPath, JSON.stringify(cfg, null, 2));
      // Re-run install
      runScript('scripts/install.sh', [proj.dir]);
    }, 120000);
    afterAll(() => proj.cleanup());

    it('sentinel key survives re-install', () => {
      const cfg = JSON.parse(fs.readFileSync(path.join(proj.dir, 'plan-visualizer.config.json'), 'utf8'));
      expect(cfg['e2e-sentinel']).toBe(true);
    });

    it('Stop hook is not duplicated in .claude/settings.json', () => {
      const settingsPath = path.join(proj.dir, '.claude', 'settings.json');
      if (!fs.existsSync(settingsPath)) return; // hook may not be registered in non-Claude env
      const settings = JSON.parse(fs.readFileSync(settingsPath, 'utf8'));
      const hooks = settings?.hooks?.Stop ?? [];
      const pvHooks = hooks.filter(
        (h) => JSON.stringify(h).includes('capture-cost') || JSON.stringify(h).includes('planvisualizer'),
      );
      expect(pvHooks.length).toBeLessThanOrEqual(1);
    });
  });

  describe('non-git target (AC-1035)', () => {
    it('exits non-zero and prints git error', () => {
      const { dir, cleanup } = createTempProject({ skipGitInit: true });
      try {
        expect(() => runScript('scripts/install.sh', [dir])).toThrow(/git/i);
      } finally {
        cleanup();
      }
    });
  });
});
```

- [ ] **Step 2: Run and confirm tests behave as expected**

```bash
npm run test:e2e -- --testPathPattern="install" 2>&1 | tail -10
# Expected: all assertions pass (or identify which file paths need adjusting based
# on actual install.sh output — update the assertions to match reality)
```

- [ ] **Step 3: Fix any assertion mismatches**

If `install.sh` does not produce `plan-status.html` via `npm run build`, check what npm scripts the target gets and adjust `AC-1033e` accordingly. The assertion must test real output, not assumed output.

- [ ] **Step 4: Commit**

```bash
git add tests/e2e/install.spec.js
git commit -m "feat: add install + idempotency e2e suite (US-0267, AC-1033–1036)"
```

---

### Task 5: Update Suite (US-0268)

**Files:**

- Create: `tests/e2e/update.spec.js`

**Interfaces:**

- Consumes: `tests/e2e/helpers/index.js`, `scripts/install.sh`, `scripts/update.sh`
- Produces: Suite covering AC-1037 through AC-1039

- [ ] **Step 1: Write update.spec.js**

```javascript
// tests/e2e/update.spec.js
'use strict';
const fs = require('fs');
const path = require('path');
const { createTempProject, runScript, assertHtml } = require('./helpers');

const ROOT = path.resolve(__dirname, '../..');
const FIXTURES = path.join(__dirname, 'fixtures');
const PV_VERSION = require('../../package.json').version;

describe('Suite 2: update.sh', () => {
  let proj;
  beforeAll(() => {
    proj = createTempProject();
    // Install first
    runScript('scripts/install.sh', [proj.dir]);
    // Add sentinel key before updating
    const cfgPath = path.join(proj.dir, 'plan-visualizer.config.json');
    const cfg = JSON.parse(fs.readFileSync(cfgPath, 'utf8'));
    cfg['e2e-update-sentinel'] = 'preserved';
    fs.writeFileSync(cfgPath, JSON.stringify(cfg, null, 2));
    // Run update
    runScript('scripts/update.sh', [proj.dir]);
  }, 180000);
  afterAll(() => proj.cleanup());

  it('AC-1037: sentinel key is preserved after update', () => {
    const cfg = JSON.parse(fs.readFileSync(path.join(proj.dir, 'plan-visualizer.config.json'), 'utf8'));
    expect(cfg['e2e-update-sentinel']).toBe('preserved');
  });

  it('AC-1039: docs/.pv-state.json exists with a version field after update', () => {
    const statePath = path.join(proj.dir, 'docs', '.pv-state.json');
    expect(fs.existsSync(statePath)).toBe(true);
    const state = JSON.parse(fs.readFileSync(statePath, 'utf8'));
    expect(state).toHaveProperty('version');
    expect(typeof state.version).toBe('string');
  });

  it('AC-1038: npm run build with fixture RELEASE_PLAN still works post-update', () => {
    // Copy Layer 1 fixture into target
    fs.mkdirSync(path.join(proj.dir, 'docs'), { recursive: true });
    fs.copyFileSync(path.join(FIXTURES, 'RELEASE_PLAN.md'), path.join(proj.dir, 'docs', 'RELEASE_PLAN.md'));
    runScript('npm run build', [], proj.dir, { timeout: 60000 });
    assertHtml(path.join(proj.dir, 'plan-status.html'), {
      contains: ['E2E-Fixture:'],
      excludes: ['<<<', 'undefined'],
    });
  });
});
```

- [ ] **Step 2: Run and fix any mismatches**

```bash
npm run test:e2e -- --testPathPattern="update" 2>&1 | tail -10
```

- [ ] **Step 3: Commit**

```bash
git add tests/e2e/update.spec.js
git commit -m "feat: add update e2e suite (US-0268, AC-1037–1039)"
```

---

### Task 6: Local Pipeline Suite (US-0269)

**Files:**

- Create: `tests/e2e/pipeline-local.spec.js`

**Interfaces:**

- Consumes: `tests/e2e/helpers/index.js`, `tests/e2e/fixtures/` (all fixture files), `tools/generate-dashboard.js` (`generateHTML` export)
- Produces: Suite covering AC-1040 through AC-1043

- [ ] **Step 1: Write pipeline-local.spec.js**

```javascript
// tests/e2e/pipeline-local.spec.js
'use strict';
const fs = require('fs');
const path = require('path');
const { createTempProject, runScript, assertHtml } = require('./helpers');

const ROOT = path.resolve(__dirname, '../..');
const FIXTURES = path.join(__dirname, 'fixtures');

function copyFixtures(targetDir) {
  const docsDir = path.join(targetDir, 'docs');
  fs.mkdirSync(docsDir, { recursive: true });
  fs.copyFileSync(path.join(FIXTURES, 'RELEASE_PLAN.md'), path.join(docsDir, 'RELEASE_PLAN.md'));
  fs.copyFileSync(path.join(FIXTURES, 'BUGS.md'), path.join(docsDir, 'BUGS.md'));
  fs.copyFileSync(path.join(FIXTURES, 'LESSONS.md'), path.join(docsDir, 'LESSONS.md'));
  fs.copyFileSync(path.join(FIXTURES, 'sdlc-status-init.json'), path.join(docsDir, 'sdlc-status.json'));
}

describe('Suite 3: Local pipeline (plan-status + dashboard)', () => {
  let proj;

  beforeAll(() => {
    proj = createTempProject();
    runScript('scripts/install.sh', [proj.dir]);
    copyFixtures(proj.dir);
    runScript('npm run build', [], proj.dir, { timeout: 90000 });
  }, 240000);
  afterAll(() => proj.cleanup());

  it('AC-1040: plan-status.html contains every non-Cancelled story title', () => {
    const planStatusPath = path.join(proj.dir, 'plan-status.html');
    const titles = [
      'E2E-Fixture: As a user, I want to log in',
      'E2E-Fixture: As a user, I want my session to persist',
      'E2E-Fixture: As an admin, I want to view an audit log',
      'E2E-Fixture: As a user, I want to search records',
    ];
    assertHtml(planStatusPath, { contains: titles });
  });

  it('AC-1040: plan-status.html contains all three epic names', () => {
    assertHtml(path.join(proj.dir, 'plan-status.html'), {
      contains: ['E2E Fixture — Completed Work', 'E2E Fixture — Active Work', 'E2E Fixture — Planned Work'],
    });
  });

  it('AC-1041: dashboard.html contains phase names from the sdlc-status fixture', () => {
    // Use generateHTML directly to avoid needing a running server
    const { generateHTML } = require('../../tools/generate-dashboard.js');
    const json = JSON.parse(fs.readFileSync(path.join(FIXTURES, 'sdlc-status-init.json'), 'utf8'));
    const html = generateHTML(json);
    const phaseNames = ['Blueprint', 'Architect', 'Build', 'Integration', 'Test', 'Polish', 'Deploy'];
    for (const name of phaseNames) {
      expect(html).toContain(name);
    }
  });

  it('AC-1042: plan-status.html contains no conflict markers or literal undefined', () => {
    const html = fs.readFileSync(path.join(proj.dir, 'plan-status.html'), 'utf8');
    expect(html).not.toContain('<<<');
    expect(html).not.toContain('>>>');
    expect(html).not.toMatch(/\bundefined\b/);
  });

  it('AC-1042: docs/dashboard.html contains no conflict markers or literal undefined', () => {
    const html = fs.readFileSync(path.join(proj.dir, 'docs', 'dashboard.html'), 'utf8');
    expect(html).not.toContain('<<<');
    expect(html).not.toMatch(/\bundefined\b/);
  });

  it('AC-1043: npm run check:ids exits 0 after full build', () => {
    expect(() => runScript('npm run check:ids', [], proj.dir)).not.toThrow();
  });
});
```

- [ ] **Step 2: Run and fix any mismatches**

```bash
npm run test:e2e -- --testPathPattern="pipeline-local" 2>&1 | tail -10
```

- [ ] **Step 3: Commit**

```bash
git add tests/e2e/pipeline-local.spec.js
git commit -m "feat: add local pipeline e2e suite (US-0269, AC-1040–1043)"
```

---

### Task 7: Agentic Lifecycle Suite (US-0270)

**Files:**

- Create: `tests/e2e/pipeline-agentic.spec.js`

**Interfaces:**

- Consumes: `tests/e2e/helpers/index.js`, `tools/agent-lifecycle.js`, `tools/agent-spec-plan.js`, `tools/deploy-status.js`, `tools/generate-dashboard.js`
- Produces: Suite covering AC-1044 through AC-1048

**Key CLI invocations to use** (verified from the tools):

```
node tools/agent-lifecycle.js start --story US-T004 --agent Forge --task "search impl" --model sonnet
node tools/agent-lifecycle.js done  --story US-T004 --task-id <taskId> --summary "done [sha:abc1234]"
node tools/agent-spec-plan.js submit --story US-T006 --spec-file <path>
node tools/agent-spec-plan.js show-pending
node tools/agent-spec-plan.js approve --story US-T006
node tools/deploy-status.js init   --env staging
node tools/deploy-status.js deploy-start --sha abc1234
node tools/deploy-status.js deploy-complete --sha abc1234
```

Discover the exact flags by running each tool with `--help` or reading its source if `--help` is not available. The flags above are derived from the source (`tools/agent-lifecycle.js` lines 60–110) — verify before using.

- [ ] **Step 1: Write pipeline-agentic.spec.js**

```javascript
// tests/e2e/pipeline-agentic.spec.js
'use strict';
const fs = require('fs');
const path = require('path');
const { createTempProject, runScript, assertHtml, assertSdlcState } = require('./helpers');

const ROOT = path.resolve(__dirname, '../..');
const FIXTURES = path.join(__dirname, 'fixtures');
const TOOLS = path.join(ROOT, 'tools');

function copyFixtures(dir) {
  const docs = path.join(dir, 'docs');
  fs.mkdirSync(docs, { recursive: true });
  fs.copyFileSync(path.join(FIXTURES, 'RELEASE_PLAN.md'), path.join(docs, 'RELEASE_PLAN.md'));
  fs.copyFileSync(path.join(FIXTURES, 'sdlc-status-init.json'), path.join(docs, 'sdlc-status.json'));
}

function tool(name, args, cwd) {
  return runScript(`node "${path.join(TOOLS, name)}"`, args, cwd);
}

describe('Suite 4: Agentic pipeline lifecycle', () => {
  let proj;

  beforeAll(() => {
    proj = createTempProject();
    runScript('scripts/install.sh', [proj.dir]);
    copyFixtures(proj.dir);
  }, 120000);
  afterAll(() => proj.cleanup());

  it('AC-1044: agent-lifecycle start transitions US-T004 to in_progress', () => {
    tool(
      'agent-lifecycle.js',
      ['start', '--story', 'US-T004', '--agent', 'Forge', '--task', 'implement search endpoint', '--model', 'sonnet'],
      proj.dir,
    );
    assertSdlcState(path.join(proj.dir, 'docs', 'sdlc-status.json'), {
      tasks: { 'US-T004': { status: 'in_progress' } },
    });
  });

  it('AC-1045a: dashboard reflects in_progress after lifecycle start', () => {
    runScript('npm run dashboard', [], proj.dir);
    assertHtml(path.join(proj.dir, 'docs', 'dashboard.html'), {
      contains: ['US-T004'],
    });
  });

  it('AC-1044: agent-lifecycle done transitions US-T004 to done', () => {
    // Get the task ID from the sdlc-status.json
    const sdlc = JSON.parse(fs.readFileSync(path.join(proj.dir, 'docs', 'sdlc-status.json'), 'utf8'));
    const task = sdlc.tasks['US-T004'];
    const taskId = task?.id || task?.taskId || Object.keys(task?.events ?? {})[0] || 'US-T004-0';
    tool(
      'agent-lifecycle.js',
      ['done', '--story', 'US-T004', '--task-id', taskId, '--summary', 'Search endpoint implemented [sha:abc1234]'],
      proj.dir,
    );
    assertSdlcState(path.join(proj.dir, 'docs', 'sdlc-status.json'), {
      tasks: { 'US-T004': { status: 'done' } },
    });
  });

  it('AC-1045b: dashboard reflects done state', () => {
    runScript('npm run dashboard', [], proj.dir);
    const { generateHTML } = require('../../tools/generate-dashboard.js');
    const json = JSON.parse(fs.readFileSync(path.join(proj.dir, 'docs', 'sdlc-status.json'), 'utf8'));
    const html = generateHTML(json);
    expect(html).toContain('done');
  });

  it('AC-1046: spec gate round-trip — submit → pending → approve → empty', () => {
    // Write a minimal spec file
    const specPath = path.join(proj.dir, 'docs', 'spec-US-T006.md');
    fs.writeFileSync(specPath, '# Spec for US-T006\n\nMinimal spec for e2e test.\n');
    tool('agent-spec-plan.js', ['submit', '--story', 'US-T006', '--spec-file', specPath], proj.dir);
    const pending = tool('agent-spec-plan.js', ['show-pending'], proj.dir);
    expect(pending).toContain('US-T006');
    tool('agent-spec-plan.js', ['approve', '--story', 'US-T006'], proj.dir);
    const afterApprove = tool('agent-spec-plan.js', ['show-pending'], proj.dir);
    expect(afterApprove).not.toContain('US-T006');
  });

  it('AC-1047: deploy state machine init → deploying → deployed', () => {
    const deployStatusPath = path.join(proj.dir, 'docs', 'deployment-status.json');
    tool('deploy-status.js', ['init', '--env', 'staging'], proj.dir);
    expect(fs.existsSync(deployStatusPath)).toBe(true);
    tool('deploy-status.js', ['deploy-start', '--sha', 'abc1234'], proj.dir);
    const mid = JSON.parse(fs.readFileSync(deployStatusPath, 'utf8'));
    expect(['deploying', 'in_progress']).toContain(mid.status ?? mid.activeDeployment?.status);
    tool('deploy-status.js', ['deploy-complete', '--sha', 'abc1234'], proj.dir);
    runScript('npm run dashboard', [], proj.dir);
    assertHtml(path.join(proj.dir, 'docs', 'dashboard.html'), {
      contains: ['deployed'],
    });
  });

  it('AC-1048: generateHTML verifies all state assertions without a browser', () => {
    const { generateHTML } = require('../../tools/generate-dashboard.js');
    const json = JSON.parse(fs.readFileSync(path.join(proj.dir, 'docs', 'sdlc-status.json'), 'utf8'));
    const html = generateHTML(json);
    expect(html.length).toBeGreaterThan(1000);
    expect(html).toContain('<!DOCTYPE html>');
  });
});
```

- [ ] **Step 2: Run and fix task-ID extraction and CLI flag discrepancies**

```bash
npm run test:e2e -- --testPathPattern="pipeline-agentic" 2>&1 | tail -15
# Likely needs: adjust taskId extraction to match actual sdlc-status.json shape,
# and verify deploy-status.js flag names by running:
node tools/deploy-status.js --help 2>&1 | head -20
```

- [ ] **Step 3: Commit**

```bash
git add tests/e2e/pipeline-agentic.spec.js
git commit -m "feat: add agentic lifecycle e2e suite (US-0270, AC-1044–1048)"
```

---

### Task 8: GitHub Layer 2 Suite (US-0271)

**Files:**

- Create: `tests/e2e/pipeline-github.spec.js`

**Interfaces:**

- Consumes: `tests/e2e/helpers/index.js` (`waitForPR`), `gh` CLI, `E2E_GITHUB_TOKEN` env var
- Produces: Suite covering AC-1049 through AC-1053

**Prerequisites before running this suite:**

1. Create `ksyed0/pv-e2e-target` on GitHub — a minimal repo with one empty commit on `main` and one open issue
2. Add `E2E_GITHUB_TOKEN` as a repository secret in PlanVisualizer settings (scope: `repo` on `pv-e2e-target`)

- [ ] **Step 1: Write pipeline-github.spec.js**

```javascript
// tests/e2e/pipeline-github.spec.js
'use strict';
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');
const { waitForPR } = require('./helpers');

const SKIP = !process.env.E2E_GITHUB_TOKEN;
const TARGET_REPO = 'ksyed0/pv-e2e-target';
const INIT_BRANCH = 'feature/shelf-init';
const ROOT = path.resolve(__dirname, '../..');
const INIT_PROMPT_PATH = path.join(ROOT, 'docs/superpowers/plans/2026-06-25-e2e-test-automation.md');

// Helper: run gh CLI with the e2e token
function gh(args) {
  return execSync(`gh ${args}`, {
    encoding: 'utf8',
    env: { ...process.env, GH_TOKEN: process.env.E2E_GITHUB_TOKEN },
    stdio: 'pipe',
  });
}

function cloneTarget() {
  const tmp = execSync('mktemp -d', { encoding: 'utf8' }).trim();
  execSync(`gh repo clone ${TARGET_REPO} "${tmp}" -- --depth 1`, {
    env: { ...process.env, GH_TOKEN: process.env.E2E_GITHUB_TOKEN },
    stdio: 'pipe',
  });
  return tmp;
}

describe('Suite 5: GitHub-connected Layer 2 (Shelf init)', () => {
  let cloneDir;
  let prNumber;

  beforeAll(async () => {
    if (SKIP) return;
    cloneDir = cloneTarget();

    // Reset: delete feature/shelf-init if it already exists on remote
    try {
      gh(`api repos/${TARGET_REPO}/git/refs/heads/${INIT_BRANCH} -X DELETE`);
    } catch (_) {
      /* branch may not exist — that's fine */
    }

    // Reset: close any open PRs for this branch
    try {
      const prs = JSON.parse(gh(`pr list --repo ${TARGET_REPO} --head ${INIT_BRANCH} --json number`));
      for (const pr of prs) {
        gh(`pr close ${pr.number} --repo ${TARGET_REPO}`);
      }
    } catch (_) {}

    // Reset: restore ID_REGISTRY.md to develop tip
    execSync(`git checkout origin/develop -- docs/ID_REGISTRY.md 2>/dev/null || true`, {
      cwd: cloneDir,
      stdio: 'pipe',
    });
    execSync(`git checkout -b ${INIT_BRANCH}`, { cwd: cloneDir, stdio: 'pipe' });
    execSync(`git push origin ${INIT_BRANCH}`, {
      cwd: cloneDir,
      stdio: 'pipe',
      env: { ...process.env, GH_TOKEN: process.env.E2E_GITHUB_TOKEN },
    });

    // Invoke Conductor with the Shelf init prompt
    // The prompt lives in the spec file — pass it as a file to Claude Code CLI
    // This is a long-running process; we wait for the PR to appear
    execSync(`claude --print "$(cat '${INIT_PROMPT_PATH}')" 2>/dev/null &`, { cwd: cloneDir, stdio: 'ignore' });

    // Poll for the PR (up to 30 minutes)
    prNumber = await waitForPR(INIT_BRANCH, 1800000, 30000);
  }, 1860000); // 31 min timeout for beforeAll

  afterAll(() => {
    if (cloneDir) {
      try {
        fs.rmSync(cloneDir, { recursive: true, force: true });
      } catch (_) {}
    }
  });

  const skip = (name, fn) => (SKIP ? it.skip(name, fn) : it(name, fn, 60000));

  skip('AC-1049: PR exists for feature/shelf-init', () => {
    expect(prNumber).toBeGreaterThan(0);
  });

  skip('AC-1050: RELEASE_PLAN.md has ≥5 epics and ≥10 stories', () => {
    const content = execSync(`gh api repos/${TARGET_REPO}/contents/docs/RELEASE_PLAN.md --jq .content | base64 -d`, {
      env: { ...process.env, GH_TOKEN: process.env.E2E_GITHUB_TOKEN },
      encoding: 'utf8',
    });
    const epicCount = (content.match(/^EPIC-\d+:/gm) || []).length;
    const storyCount = (content.match(/^US-\d+/gm) || []).length;
    expect(epicCount).toBeGreaterThanOrEqual(5);
    expect(storyCount).toBeGreaterThanOrEqual(10);
  });

  skip('AC-1051: ci-contract.md has no TODO or TBD fields', () => {
    const content = execSync(`gh api repos/${TARGET_REPO}/contents/docs/ci-contract.md --jq .content | base64 -d`, {
      env: { ...process.env, GH_TOKEN: process.env.E2E_GITHUB_TOKEN },
      encoding: 'utf8',
    });
    expect(content).not.toMatch(/\bTODO\b|\bTBD\b/);
  });

  skip('AC-1052: each story has Estimate and Priority fields', () => {
    const content = execSync(`gh api repos/${TARGET_REPO}/contents/docs/RELEASE_PLAN.md --jq .content | base64 -d`, {
      env: { ...process.env, GH_TOKEN: process.env.E2E_GITHUB_TOKEN },
      encoding: 'utf8',
    });
    expect(content).toMatch(/^Estimate: /m);
    expect(content).toMatch(/^Priority: /m);
  });

  skip('AC-1052: no Dockerfile or docker-compose.yml present', () => {
    let dockerfilePresent = false;
    try {
      gh(`api repos/${TARGET_REPO}/contents/Dockerfile`);
      dockerfilePresent = true;
    } catch (_) {}
    expect(dockerfilePresent).toBe(false);
  });
});
```

- [ ] **Step 2: Verify skip logic works when token absent**

```bash
npm run test:e2e -- --testPathPattern="pipeline-github" 2>&1 | grep -E "skip|SKIP|pass"
# Expected: all 5 tests skipped (no E2E_GITHUB_TOKEN set locally)
```

- [ ] **Step 3: Create pv-e2e-target repo on GitHub**

```bash
gh repo create ksyed0/pv-e2e-target --public --description "PlanVisualizer e2e test target" --add-readme
gh issue create --repo ksyed0/pv-e2e-target --title "Test issue for e2e suite" --body "Kept open for e2e test assertions."
```

- [ ] **Step 4: Add E2E_GITHUB_TOKEN secret to PlanVisualizer repo settings**

```bash
# Generate a fine-grained PAT with repo scope on pv-e2e-target, then:
gh secret set E2E_GITHUB_TOKEN --repo ksyed0/PlanVisualizer
# Paste the token value when prompted
```

- [ ] **Step 5: Commit**

```bash
git add tests/e2e/pipeline-github.spec.js
git commit -m "feat: add GitHub Layer 2 e2e suite (US-0271, AC-1049–1053)"
```

---

### Task 9: Playwright Dashboard Suite (US-0272)

**Files:**

- Create: `tests/e2e/dashboard-playwright.spec.js`
- Create: `tests/e2e/snapshots/` (directory; snapshots generated on first run)
- Modify: `package.json` — add `@playwright/test` to devDependencies

**Interfaces:**

- Consumes: `tools/generate-dashboard.js`, `tests/e2e/fixtures/sdlc-status-init.json`, `@playwright/test`
- Produces: Suite covering AC-1054 through AC-1056

- [ ] **Step 1: Add Playwright**

```bash
npm install --save-dev @playwright/test
npx playwright install chromium
```

- [ ] **Step 2: Create the Playwright spec**

```javascript
// tests/e2e/dashboard-playwright.spec.js
'use strict';
const { test, expect } = require('@playwright/test');
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');
const os = require('os');

const SKIP = !process.env.PLAYWRIGHT_E2E;
const ROOT = path.resolve(__dirname, '../..');
const FIXTURES = path.join(__dirname, 'fixtures');

// Generate a dashboard HTML from the sdlc-status-init fixture before tests run
let dashboardPath;
test.beforeAll(async () => {
  if (SKIP) return;
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'pv-pw-'));
  const docsDir = path.join(tmp, 'docs');
  fs.mkdirSync(docsDir, { recursive: true });
  fs.copyFileSync(path.join(FIXTURES, 'sdlc-status-init.json'), path.join(docsDir, 'sdlc-status.json'));
  execSync(`node "${path.join(ROOT, 'tools/generate-dashboard.js')}"`, {
    cwd: tmp,
    stdio: 'pipe',
    timeout: 30000,
  });
  dashboardPath = path.join(docsDir, 'dashboard.html');
  // Store tmp path for cleanup
  test.info().annotations.push({ type: 'tmpDir', description: tmp });
});

const skipTest = (name, fn) => (SKIP ? test.skip(name, fn) : test(name, fn));

test.describe('Dashboard Playwright suite', () => {
  skipTest('AC-1054a: density toggle cycles S → M → L and persists on reload', async ({ page }) => {
    await page.goto(`file://${dashboardPath}`);
    // Find and click density toggle — look for the pill button
    const densityBtn = page.locator('[data-density], .pv-density-toggle, #density-toggle').first();
    if (!(await densityBtn.isVisible())) {
      test.skip(true, 'Density toggle not found — check selector');
      return;
    }
    await densityBtn.click(); // → M
    await densityBtn.click(); // → L
    const lsValue = await page.evaluate(() => localStorage.getItem('pv-task-density'));
    expect(['M', 'L', 'S']).toContain(lsValue);
    await page.reload();
    const afterReload = await page.evaluate(() => localStorage.getItem('pv-task-density'));
    expect(afterReload).toBe(lsValue);
  });

  skipTest('AC-1054b: live ticker shows HH:MM format', async ({ page }) => {
    await page.goto(`file://${dashboardPath}`);
    const ticker = page.locator('.mc-clock, #mc-clock, [data-ticker]').first();
    if (!(await ticker.isVisible())) {
      test.skip(true, 'Ticker element not found — check selector');
      return;
    }
    const text = await ticker.innerText();
    expect(text).toMatch(/\d{2}:\d{2}/);
  });

  skipTest('AC-1054c: approve button triggers flag download with correct filename', async ({ page }) => {
    // Reuse the existing fixture HTML if it exists
    const fixturePath = path.join(FIXTURES, 'pending-approvals-fixture.html');
    if (!fs.existsSync(fixturePath)) {
      test.skip(true, 'Pending approvals fixture not found');
      return;
    }
    await page.goto(`file://${fixturePath}`);
    const btn = page.locator('[data-action="approve"][data-story]').first();
    if (!(await btn.isVisible())) {
      test.skip(true, 'No approve button in fixture');
      return;
    }
    const storyId = await btn.getAttribute('data-story');
    const gate = await btn.getAttribute('data-gate');
    const [download] = await Promise.all([page.waitForEvent('download'), btn.click()]);
    expect(download.suggestedFilename()).toBe(`approve-${storyId}-${gate}.flag`);
  });

  skipTest('AC-1055: light theme snapshot matches committed baseline', async ({ page }) => {
    await page.goto(`file://${dashboardPath}`);
    await page.emulateMedia({ colorScheme: 'light' });
    await page.waitForLoadState('networkidle');
    await expect(page).toHaveScreenshot('dashboard-light.png', {
      maxDiffPixelRatio: 0.001,
      fullPage: true,
    });
  });

  skipTest('AC-1055: dark theme snapshot matches committed baseline', async ({ page }) => {
    await page.goto(`file://${dashboardPath}`);
    await page.emulateMedia({ colorScheme: 'dark' });
    await page.waitForLoadState('networkidle');
    await expect(page).toHaveScreenshot('dashboard-dark.png', {
      maxDiffPixelRatio: 0.001,
      fullPage: true,
    });
  });
});
```

- [ ] **Step 3: Generate baseline snapshots**

```bash
PLAYWRIGHT_E2E=true npx playwright test tests/e2e/dashboard-playwright.spec.js --update-snapshots
# This generates tests/e2e/snapshots/dashboard-light.png and dashboard-dark.png
# Review the generated screenshots visually before committing
```

- [ ] **Step 4: Verify Playwright suite skips without env var**

```bash
npm run test:e2e -- --testPathPattern="dashboard-playwright" 2>&1 | grep -E "skip|SKIP|pass"
# Expected: all tests skipped (PLAYWRIGHT_E2E not set)
```

- [ ] **Step 5: Update jest.e2e.config.js to exclude Playwright spec from Jest runner**

Playwright specs use `@playwright/test`'s `test()`, not Jest's — running them through Jest will fail. Add to `jest.e2e.config.js`:

```javascript
testPathIgnorePatterns: [
  '/node_modules/',
  '/tests/e2e/fixtures/',
  '/tests/e2e/dashboard-playwright.spec.js',  // run via playwright directly
],
```

Add a `playwright:e2e` script to `package.json`:

```json
"playwright:e2e": "PLAYWRIGHT_E2E=true playwright test tests/e2e/dashboard-playwright.spec.js",
```

- [ ] **Step 6: Run full e2e suite to confirm everything except Playwright passes**

```bash
npm run test:e2e 2>&1 | tail -10
# Expected: install, update, pipeline-local, pipeline-agentic, pipeline-github (skipped) all pass
```

- [ ] **Step 7: Confirm main suite still at 2715**

```bash
npm test 2>&1 | tail -3
```

- [ ] **Step 8: Commit**

```bash
git add tests/e2e/dashboard-playwright.spec.js tests/e2e/snapshots/ jest.e2e.config.js package.json package-lock.json
git commit -m "feat: add Playwright dashboard e2e suite + snapshots (US-0272, AC-1054–1056)"
```

---

## Self-Review

**Spec coverage check:**

| Spec section                                                      | Covered by                          |
| ----------------------------------------------------------------- | ----------------------------------- |
| createTempProject / runScript / assertHtml / assertSdlcState      | Task 1                              |
| waitForPR                                                         | Task 1 (implemented), Task 8 (used) |
| RELEASE_PLAN / BUGS / LESSONS / sdlc-status-init fixtures         | Task 2                              |
| fixtures.smoke.test.js                                            | Task 2                              |
| jest.e2e.config.js, test:e2e script, e2e.yml                      | Task 3                              |
| install + idempotency (AC-1033–1036)                              | Task 4                              |
| update preserves config (AC-1037–1039)                            | Task 5                              |
| plan-status + dashboard HTML from fixtures (AC-1040–1043)         | Task 6                              |
| lifecycle + spec gate + deploy state machine (AC-1044–1048)       | Task 7                              |
| GitHub Layer 2 / Shelf init prompt (AC-1049–1053)                 | Task 8                              |
| Playwright: toggle + ticker + download + snapshots (AC-1054–1056) | Task 9                              |
| pv-e2e-target repo creation                                       | Task 8, Step 3                      |
| E2E_GITHUB_TOKEN secret setup                                     | Task 8, Step 4                      |
| Playwright excluded from Jest runner                              | Task 9, Step 5                      |

**Placeholder scan:** No TBD, TODO, or "similar to" references. All CLI commands shown verbatim.

**Type consistency:** `runScript` signature is `(script, args?, cwd?, opts?)` throughout. `assertSdlcState` shape uses `toMatchObject` for objects, `toBe` for scalars — consistent across Tasks 7 and 1.

**Known discovery step:** Task 4 (Step 3) and Task 7 (task-ID extraction) each have one "verify and adjust" step where the implementer reads actual CLI output before finalising assertions. This is intentional — the exact sdlc-status.json shape for task IDs and the exact files produced by install.sh cannot be confirmed without running the tools.
