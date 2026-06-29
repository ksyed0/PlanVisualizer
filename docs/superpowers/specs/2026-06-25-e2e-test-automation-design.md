# E2E Test Automation Design Spec

## EPIC-0047 + EPIC-0048

**Date:** 2026-06-25
**Status:** Draft
**Author:** Keystone (Architect Agent)
**Epics:** EPIC-0047 (Infrastructure), EPIC-0048 (Scenarios)

---

## 1. Problem Statement

PlanVisualizer has 2715 unit and integration tests covering individual tools and
library modules, but no automated coverage for:

- `scripts/install.sh` / `scripts/update.sh` — the primary user-facing surface
- The full `npm run build` pipeline producing both dashboards
- Agentic CLI state tools (`agent-lifecycle`, `agent-spec-plan`, `deploy-status`)
  exercised in sequence as a real pipeline would use them
- Dashboard HTML correctness as a function of pipeline state (not just as a
  function of a hand-crafted fixture)
- The live dashboard JS behaviors (ticker, density toggle, flag download)
- The Layer 2 scenario: Conductor → Compass → Keystone producing project
  documents from a brief (the Shelf initialization prompt)

This spec defines the architecture for closing those gaps.

---

## 2. Scope

### In scope

- Install and update script testing (local, no network after initial clone)
- Full `npm run build` pipeline with deterministic Layer 1 fixtures
- Agentic CLI state machine: lifecycle, spec/plan gate, deploy status
- Dashboard HTML correctness via `generateHTML()` + HTML string inspection
- Dashboard live behaviors via Playwright (gated by env var)
- Layer 2 GitHub-connected test: Shelf init prompt driving live Conductor
- Visual regression snapshots for both light and dark dashboard themes

### Out of scope

- Testing the Claude Code agent responses themselves (those are model outputs,
  not deterministic)
- Performance benchmarking
- Multi-user or concurrent pipeline scenarios (v1 is single-user)
- Windows / non-POSIX environments

---

## 3. Architecture

### 3.1 Test Layers

```
┌─────────────────────────────────────────────────────────┐
│  Layer 2 — GitHub-connected (opt-in, E2E_GITHUB_TOKEN)  │
│  Live Conductor → Compass → Keystone on pv-e2e-target   │
│  Polls gh pr list, asserts branch file contents         │
├─────────────────────────────────────────────────────────┤
│  Layer 1 — Local, deterministic (always runs)           │
│  Static fixtures + CLI commands + HTML inspection        │
├─────────────────────────────────────────────────────────┤
│  Playwright — Dashboard behaviors (PLAYWRIGHT_E2E=true) │
│  Headless Chromium, interaction + visual regression     │
└─────────────────────────────────────────────────────────┘
```

### 3.2 File Layout

```
tests/
  e2e/
    helpers/
      index.js              # createTempProject, runScript, assertHtml,
                            # assertSdlcState, waitForPR
    fixtures/
      RELEASE_PLAN.md       # Layer 1 fixture — T-namespace IDs
      BUGS.md               # Layer 1 fixture
      LESSONS.md            # Layer 1 fixture
      sdlc-status-init.json # known sdlc-status.json for dashboard tests
      fixtures.smoke.test.js
    snapshots/
      dashboard-light.png   # committed Playwright snapshot
      dashboard-dark.png
    install.spec.js
    update.spec.js
    pipeline-local.spec.js
    pipeline-agentic.spec.js
    dashboard-playwright.spec.js
    pipeline-github.spec.js   # Layer 2, skipped without token
jest.e2e.config.js
.github/workflows/e2e.yml
```

### 3.3 Jest Config (e2e)

```javascript
// jest.e2e.config.js
module.exports = {
  testEnvironment: 'node',
  testMatch: ['**/tests/e2e/**/*.spec.js'],
  testPathIgnorePatterns: ['/node_modules/', '/fixtures/'],
  testTimeout: 120000, // 2 min per test; Layer 2 overrides per-test
  setupFilesAfterFramework: [],
};
```

### 3.4 Helpers Contract

```javascript
// tests/e2e/helpers/index.js

/**
 * Creates an isolated temp directory with a bare git repo.
 * Returns { dir, cleanup }.
 * cleanup() removes the directory recursively.
 */
function createTempProject(opts = {}) { ... }

/**
 * Runs a shell script in cwd. Throws with full stdout+stderr on failure.
 * Default timeout: 120 s.
 */
function runScript(script, args = [], cwd, opts = {}) { ... }

/**
 * Reads an HTML file and runs contains/excludes assertions.
 * checks: { contains?: string[], excludes?: string[] }
 */
function assertHtml(htmlPath, checks) { ... }

/**
 * Reads and parses docs/sdlc-status.json, asserts shape keys.
 * Scalar values use strict equality; object values use deep equality.
 */
function assertSdlcState(sdlcPath, shape) { ... }

/**
 * Polls `gh pr list --head branchName` every intervalMs until a PR
 * appears or timeout elapses. Returns the PR number.
 * Layer 2 only — requires E2E_GITHUB_TOKEN in env.
 */
async function waitForPR(branchName, timeoutMs = 1800000, intervalMs = 30000) { ... }
```

---

## 4. Layer 1 Fixtures

### 4.1 RELEASE_PLAN.md fixture

IDs use a `T` namespace (EPIC-T001, US-T001, AC-T001) to avoid any collision
with production sequences. The fixture covers every story status value so tests
can assert status-specific rendering:

| Epic      | Status      | Stories                                                                                                    |
| --------- | ----------- | ---------------------------------------------------------------------------------------------------------- |
| EPIC-T001 | Done        | US-T001 (Done), US-T002 (Done), US-T003 (Done)                                                             |
| EPIC-T002 | In Progress | US-T004 (In Progress), US-T005 (Blocked), US-T006 (Planned)                                                |
| EPIC-T003 | Planned     | US-T007 (Planned), US-T008 (To Do), US-T009 (To Do), US-T010 (To Do), US-T011 (Planned), US-T012 (Planned) |

All story titles begin with `"E2E-Fixture:"` so tests can anchor assertions
on this prefix without false positives from boilerplate text.

### 4.2 sdlc-status-init.json fixture

A minimal canonical `{ tasks: {}, log: [], programme: { phases: [...] } }`
structure with 6 phases (matching the healthy fixture already used in unit
tests) and 0 tasks. Used as the starting state for `pipeline-agentic.spec.js`.

---

## 5. Suite Designs

### 5.1 install.spec.js

```
beforeAll: createTempProject() → dir
test: fresh install
  runScript('scripts/install.sh', [dir])
  assert file tree
  runScript('npm run build', [], dir)
  assertHtml('plan-status.html', { contains: ['PlanVisualizer'] })
test: idempotency
  modify plan-visualizer.config.json (add sentinel key)
  runScript('scripts/install.sh', [dir])
  assert sentinel key still present
  assert Stop hook appears exactly once in .claude/settings.json
test: non-git target fails
  createTempProject({ skipGitInit: true })
  expect runScript to throw, message includes 'git'
test: check:ids passes on fresh install
  runScript('npm run check:ids', [], dir)
afterAll: cleanup()
```

### 5.2 update.spec.js

```
beforeAll: createTempProject() → fresh install → modify config
test: update preserves config
  runScript('scripts/update.sh', [], dir)
  assert sentinel key still present
  assert docs/.pv-state.json exists with version field
test: build still works after update
  copy Layer 1 RELEASE_PLAN.md fixture into dir
  runScript('npm run build', [], dir)
  assertHtml('plan-status.html', { contains: ['E2E-Fixture:'] })
afterAll: cleanup()
```

### 5.3 pipeline-local.spec.js

```
beforeAll:
  createTempProject() + install
  copy all Layer 1 fixtures into place
  runScript('npm run build', [], dir)
test: plan-status titles
  assertHtml('plan-status.html', {
    contains: fixture story titles (all non-Cancelled)
  })
test: dashboard HTML from init state
  const json = JSON.parse(fs.readFileSync('docs/sdlc-status.json'))
  const html = generateHTML(json)
  assert html contains each phase name from fixture
test: no corruption markers in output
  both HTML files: no '<<<', no literal 'undefined'
test: check:ids clean
  runScript('npm run check:ids', [], dir)
afterAll: cleanup()
```

### 5.4 pipeline-agentic.spec.js

```
beforeAll: install + copy fixtures
test: lifecycle start → in_progress
  runScript('node tools/agent-lifecycle.js start --story US-T004 ...')
  assertSdlcState('docs/sdlc-status.json', {
    tasks: { 'US-T004': { status: 'in_progress' } }
  })
test: dashboard reflects in_progress
  runScript('npm run dashboard')
  assertHtml('docs/dashboard.html', { contains: ['US-T004'] })
test: lifecycle done → done
  runScript('node tools/agent-lifecycle.js done --story US-T004 ...')
  assertSdlcState(..., { tasks: { 'US-T004': { status: 'done' } } })
test: spec gate round-trip
  submit → assert pending → approve → assert empty pending
test: deploy state machine
  init → deploying → deployed
  assertSdlcState + assertHtml for each transition
afterAll: cleanup()
```

### 5.5 dashboard-playwright.spec.js (gated: PLAYWRIGHT_E2E=true)

```
beforeAll: build dashboard from fixture
test: density toggle persists
  click S → M → L → reload → assert L is selected
test: ticker shows HH:MM
  locate ticker element, assert text matches /\d{2}:\d{2}/
test: flag download filename
  click approve button → assert download filename
test: snapshot light theme
  page.emulateMedia({ colorScheme: 'light' })
  toMatchSnapshot('dashboard-light.png', { maxDiffPixelRatio: 0.001 })
test: snapshot dark theme
  toMatchSnapshot('dashboard-dark.png', ...)
```

### 5.6 pipeline-github.spec.js (gated: E2E_GITHUB_TOKEN)

```
beforeAll:
  if !E2E_GITHUB_TOKEN → skip all
  clone pv-e2e-target
  run cleanup/reset block from Shelf init prompt prerequisites
test: Conductor produces valid artifacts (timeout: 30 min)
  invoke Conductor with Shelf init prompt (as a Claude Code subprocess)
  waitForPR('feature/shelf-init', 1800000)
  checkout branch
  assert DoD checklist items (generate, check:ids, epics present, etc.)
test: ci-contract has no TODOs
  regex scan docs/ci-contract.md
test: no Dockerfile present
  assert no Dockerfile / docker-compose.yml in tree
```

---

## 6. CI Integration

### 6.1 Workflow: e2e.yml

```yaml
name: E2E Tests
on:
  workflow_dispatch:
  schedule:
    - cron: '0 3 * * *' # 3 AM UTC nightly

jobs:
  e2e-layer1:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with: { node-version: '22' }
      - run: npm ci
      - run: npm run test:e2e
        env:
          PLAYWRIGHT_E2E: 'true'
      - uses: actions/upload-artifact@v4
        with:
          name: e2e-report
          path: coverage/e2e/

  e2e-layer2:
    runs-on: ubuntu-latest
    needs: e2e-layer1
    if: github.event_name == 'schedule'
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with: { node-version: '22' }
      - run: npm ci
      - run: npm run test:e2e -- --testPathPattern=pipeline-github
        env:
          E2E_GITHUB_TOKEN: ${{ secrets.E2E_GITHUB_TOKEN }}
          PLAYWRIGHT_E2E: 'false'
```

### 6.2 Main CI (ci.yml) — no change

The existing CI workflow is unchanged. `npm test` continues to run only
`unit` and `integration` suites. `test:e2e` is not added to the PR gate.

---

## 7. Open Notes (carry forward to EPIC-0047/0048 implementation)

> **Note (US-0271 — test harness):** The Layer 2 test cannot block on a
> single process exit. Use `waitForPR(branchName, 1800000)` polling
> `gh pr list` every 30 s. Implement this helper in EPIC-0047 before any
> Layer 2 scenario test is authored.

> **Note (US-0270 — spec gate):** The spec/plan gate (US-0182) is exercised
> via CLI (`agent:pending` → `agent:approve`) without a live Conductor
> session. This validates the state machine and CLI tools but does not test
> the Conductor's orchestration of the gate. A separate manual smoke test
> is needed for the full Conductor-driven gate flow.

---

## 8. Acceptance Summary

| Story   | Key outcome                                                   |
| ------- | ------------------------------------------------------------- |
| US-0264 | Helpers module with 4 exports, unit-tested                    |
| US-0265 | Layer 1 fixtures pass smoke test                              |
| US-0266 | `test:e2e` script + nightly CI job, main gate unchanged       |
| US-0267 | Install fresh + idempotent + non-git-target error             |
| US-0268 | Update preserves config, build still works                    |
| US-0269 | Both dashboards populate correctly from Layer 1 fixtures      |
| US-0270 | Full CLI state machine: lifecycle + spec gate + deploy        |
| US-0271 | Shelf init prompt drives live pipeline, DoD checklist passes  |
| US-0272 | Playwright: toggle + ticker + download + light/dark snapshots |
