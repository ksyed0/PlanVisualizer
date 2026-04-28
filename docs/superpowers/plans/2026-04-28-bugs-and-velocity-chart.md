# Bug Fixes (BUG-0227–0232) + US-0159 Velocity Chart — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix 6 open bugs (BUG-0229, BUG-0227, BUG-0228, BUG-0230, BUG-0231, BUG-0232) and implement the US-0159 Velocity Chart, delivered across 4 PRs targeting `develop`.

**Architecture:** Bugs 0229/0231/0232 are isolated JS changes; 0227 is a new Markdown file; 0228/0230 remove CDN `<link>`/`<script>` tags and replace Tailwind utility classes with named CSS classes using `var(--clr-*)` tokens. US-0159 adds a `velocityByWeek()` function to `tools/lib/snapshot.js` and a new Chart.js mixed bar+line chart in `tools/lib/render-tabs.js`.

**Tech Stack:** Node.js, Jest (`npx jest --coverage`, gate ≥80% statements), Chart.js (already inlined), CSS custom properties via `tools/lib/theme.js`.

**Test location:** All tests in `tests/unit/`

---

## File Map

| File                                    | Action | Reason                                                                                                  |
| --------------------------------------- | ------ | ------------------------------------------------------------------------------------------------------- |
| `package.json`                          | Modify | BUG-0229: add `plan:generate` / `plan:watch` aliases                                                    |
| `tools/generate-dashboard.js`           | Modify | BUG-0228: remove Google Fonts links; BUG-0231: add dispatch counter; BUG-0232: add `(N done)` sub-label |
| `tools/lib/render-html.js`              | Modify | BUG-0230: remove Tailwind + Chart.js CDN + Fonts links; replace budget alert Tailwind classes           |
| `tools/lib/render-shell.js`             | Modify | BUG-0230: replace filter bar + select + search Tailwind classes                                         |
| `docs/AGENT_PLAN.md`                    | Create | BUG-0227: missing referenced file                                                                       |
| `docs/RELEASE_PLAN.md`                  | Modify | US-0160 Done, US-0159 in progress markers                                                               |
| `docs/BUGS.md`                          | Modify | Mark BUG-0227–0232 Fixed with Fix Branch                                                                |
| `tools/lib/snapshot.js`                 | Modify | US-0159: add `velocityByWeek()` and `isoWeek()`                                                         |
| `tools/generate-plan.js`                | Modify | US-0159: import `velocityByWeek`, attach to `data.trends`                                               |
| `tools/lib/render-tabs.js`              | Modify | US-0159: add Weekly Velocity chart in `renderTrendsTab()`                                               |
| `tests/unit/generate-dashboard.test.js` | Modify | BUG-0231/0232 tests                                                                                     |
| `tests/unit/snapshot.test.js`           | Modify | US-0159 `velocityByWeek` tests                                                                          |
| `tests/unit/render-tabs.test.js`        | Modify | US-0159 chart canvas + no-hex tests                                                                     |
| `docs/ID_REGISTRY.md`                   | Modify | Update TC sequence after adding new TCs                                                                 |

---

## PR 1 — BUG-0229, BUG-0231, BUG-0232 (Quick Wins)

**Branch:** `bugfix/BUG-0229-0231-0232-quick-wins`

```bash
git checkout develop && git pull origin develop
git checkout -b bugfix/BUG-0229-0231-0232-quick-wins
```

---

### Task 1: BUG-0229 — Add `plan:generate` / `plan:watch` npm aliases

**Files:**

- Modify: `package.json`

- [ ] **Step 1: Add the two script aliases**

Open `package.json`. After the `"generate:watch"` entry in `scripts`, add:

```json
"plan:generate": "node tools/generate-plan.js",
"plan:watch":    "node tools/generate-plan.js --watch",
```

The scripts block should now contain both the original aliases and the new ones.

- [ ] **Step 2: Verify the aliases work**

```bash
node -e "const p = require('./package.json'); console.log(p.scripts['plan:generate'], '|', p.scripts['plan:watch'])"
```

Expected output: `node tools/generate-plan.js | node tools/generate-plan.js --watch`

- [ ] **Step 3: Commit**

```bash
git add package.json
git commit -m "[fix] BUG-0229: add plan:generate and plan:watch npm script aliases"
```

---

### Task 2: BUG-0232 — Agent Workload `(N done)` sub-label

**Files:**

- Modify: `tools/generate-dashboard.js` (around line 218–231)
- Modify: `tests/unit/generate-dashboard.test.js`

- [ ] **Step 1: Write failing test**

Open `tests/unit/generate-dashboard.test.js`. Find the `describe('generate-dashboard — US-0147 agent workload live data'` block (around line 577). Append a new test at the end of that describe block:

```js
it('renders (N done) sub-label in workload rows', () => {
  const { generateHTML } = require('../../tools/generate-dashboard.js');
  const fixture = makeHealthyFixture();
  fixture.stories['US-0010'] = { title: 'Done story', status: 'Done', epic: 'EPIC-0016', agent: 'Pixel' };
  fixture.stories['US-0011'] = { title: 'Active story', status: 'In Progress', epic: 'EPIC-0016', agent: 'Pixel' };
  const html = generateHTML(fixture);
  expect(html).toContain('pv-workload-done');
  expect(html).toContain('(1 done)');
});
```

- [ ] **Step 2: Run test to confirm it fails**

```bash
npx jest tests/unit/generate-dashboard.test.js --testNamePattern="N done" -t "N done" 2>&1 | tail -15
```

Expected: FAIL — `pv-workload-done` not found.

- [ ] **Step 3: Implement the fix in `tools/generate-dashboard.js`**

Find `renderAgentWorkload` (around line 206). Locate the line computing `inFlight` and the row template. Make these changes:

**Before** (~line 219–226):

```js
const inFlight = assigned.filter((s) => !/done|complete/i.test(s.status || '')).length;

const pct = total > 0 ? Math.round((inFlight / total) * 100) : 0;

  `<div class="pv-workload-row">` +
  `<span class="pv-workload-name">${esc(name)}</span>` +
  `<div class="pv-workload-track"><div class="pv-workload-bar" style="width:${pct}%"></div></div>` +
  `<span class="pv-workload-count">${inFlight}</span>` +
```

**After**:

```js
const inFlight = assigned.filter((s) => !/done|complete/i.test(s.status || '')).length;
const done = total - inFlight;

const pct = total > 0 ? Math.round((inFlight / total) * 100) : 0;

  `<div class="pv-workload-row">` +
  `<span class="pv-workload-name">${esc(name)}</span>` +
  `<div class="pv-workload-track"><div class="pv-workload-bar" style="width:${pct}%"></div></div>` +
  `<span class="pv-workload-count">${inFlight}</span>` +
  `<span class="pv-workload-done">(${done} done)</span>` +
```

Then find the CSS block for `.pv-workload-count` (around line 1517) and add after it:

```js
`.pv-workload-done { font-size: 10px; color: var(--text-muted); min-width: 52px; }` +
```

- [ ] **Step 4: Run test to confirm it passes**

```bash
npx jest tests/unit/generate-dashboard.test.js --testNamePattern="N done" 2>&1 | tail -10
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add tools/generate-dashboard.js tests/unit/generate-dashboard.test.js
git commit -m "[fix] BUG-0232: add (N done) sub-label to Agent Workload widget"
```

---

### Task 3: BUG-0231 — Conductor dispatch counter

**Files:**

- Modify: `tools/generate-dashboard.js`
- Modify: `tests/unit/generate-dashboard.test.js`

- [ ] **Step 1: Write failing tests**

Append to the `describe('generate-dashboard — US-0143 conductor dispatch hold'` block (around line 478):

```js
it('Conductor card has data-agent attribute matching setConductorActive selector', () => {
  const { generateHTML } = require('../../tools/generate-dashboard.js');
  const fixture = makeHealthyFixture();
  const html = generateHTML(fixture);
  expect(html).toContain('data-agent="Conductor"');
});

it('Conductor card contains conductor-dispatch-count element', () => {
  const { generateHTML } = require('../../tools/generate-dashboard.js');
  const fixture = makeHealthyFixture();
  const html = generateHTML(fixture);
  expect(html).toContain('conductor-dispatch-count');
  expect(html).toContain('0 dispatched');
});

it('setConductorActive increments dispatch counter in JS source', () => {
  const src = require('fs').readFileSync(require('path').join(__dirname, '../../tools/generate-dashboard.js'), 'utf8');
  expect(src).toContain('_dispatchCount++');
  expect(src).toContain('conductor-dispatch-count');
});
```

- [ ] **Step 2: Run tests to confirm they fail**

```bash
npx jest tests/unit/generate-dashboard.test.js --testNamePattern="dispatch" 2>&1 | tail -20
```

Expected: FAIL — `data-agent="Conductor"` and `conductor-dispatch-count` not found.

- [ ] **Step 3: Add `data-agent` attribute to the agent row template**

In `tools/generate-dashboard.js`, find the agent row template (around line 2156). The current template starts with:

```js
return `    <div class="mc-agent-row ${rowCls} agent-card ...
  id="agent-${esc(name)}" data-agent-name="${esc(name)}" data-agent-status="${esc(statusStr)}"
```

Add `data-agent="${esc(name)}"` alongside `data-agent-name`:

```js
return `    <div class="mc-agent-row ${rowCls} agent-card ${isActive ? 'is-active active' : isBlocked ? 'is-blocked' : isReview ? 'is-review' : 'is-idle'}" id="agent-${esc(name)}" data-agent-name="${esc(name)}" data-agent="${esc(name)}" data-agent-status="${esc(statusStr)}" style="--agent-color:${color};--agent-color-ring:${color}40;">
```

- [ ] **Step 4: Add the dispatch counter element inside the Conductor card**

In the same agent row template, locate the section that renders `mc-agent-identity`. After the `mc-agent-task-line` div, add the counter element conditionally for the Conductor only:

Find:

```js
          <div class="mc-agent-task-line" id="agent-${esc(name)}-task">${taskDisplay}</div>
        </div>
```

Change to:

```js
          <div class="mc-agent-task-line" id="agent-${esc(name)}-task">${taskDisplay}</div>
          ${name === dmAgentName ? `<div class="conductor-dispatch-count" id="conductor-dispatch-count">0 dispatched</div>` : ''}
        </div>
```

Note: `dmAgentName` is already defined in scope at the top of the ROSTER section IIFE (around line 2121).

- [ ] **Step 5: Add CSS for the dispatch count element**

In the CSS block (search for `.pv-workload-done` you just added), add after it:

```js
`.conductor-dispatch-count { font-size: 11px; color: var(--text-muted); margin-top: 2px; }` +
```

- [ ] **Step 6: Update `setConductorActive` to increment the counter**

Find `setConductorActive` (around line 2574). Before it, add the module-level counter:

```js
var _dispatchCount = 0;
```

Inside `setConductorActive`, after the first line (`var card = ...`), add:

```js
_dispatchCount++;
var dispEl = document.getElementById('conductor-dispatch-count');
if (dispEl) dispEl.textContent = _dispatchCount + ' dispatched';
```

- [ ] **Step 7: Run tests to confirm they pass**

```bash
npx jest tests/unit/generate-dashboard.test.js --testNamePattern="dispatch" 2>&1 | tail -10
```

Expected: all 3 new tests PASS.

- [ ] **Step 8: Run full test suite**

```bash
npx jest --coverage 2>&1 | tail -20
```

Expected: all existing tests pass, coverage ≥80%.

- [ ] **Step 9: Mark bugs fixed in `docs/BUGS.md`**

For BUG-0229, find its entry and update:

```
Status: Fixed
Fix Branch: bugfix/BUG-0229-0231-0232-quick-wins
```

For BUG-0231:

```
Status: Fixed
Fix Branch: bugfix/BUG-0229-0231-0232-quick-wins
```

For BUG-0232:

```
Status: Fixed
Fix Branch: bugfix/BUG-0229-0231-0232-quick-wins
```

- [ ] **Step 10: Regenerate dashboard to include fixes**

```bash
npm run dashboard
```

Then verify:

```bash
grep "conductor-dispatch-count" docs/dashboard.html | head -3
grep "pv-workload-done" docs/dashboard.html | head -3
```

Both should return matches.

- [ ] **Step 11: Commit and open PR**

```bash
git add tools/generate-dashboard.js tests/unit/generate-dashboard.test.js docs/BUGS.md docs/dashboard.html
git commit -m "[fix] BUG-0231/BUG-0232: Conductor dispatch counter + Agent Workload (N done) sub-label"

gh pr create \
  --title "fix: BUG-0229/0231/0232 — npm aliases, dispatch counter, workload done label" \
  --body "$(cat <<'EOF'
## Summary
- BUG-0229: Add `plan:generate` / `plan:watch` npm script aliases to `package.json`
- BUG-0231: Add `data-agent` attribute and `conductor-dispatch-count` element to Conductor card; wire `_dispatchCount` increment in `setConductorActive`
- BUG-0232: Add `(N done)` sub-label to Agent Workload widget rows

## Test plan
- [ ] `node -e "require('./package.json').scripts['plan:generate']"` prints the right command
- [ ] `grep "conductor-dispatch-count" docs/dashboard.html` returns a match
- [ ] `grep "pv-workload-done" docs/dashboard.html` returns a match
- [ ] `npx jest --coverage` passes with ≥80% statements

🤖 Generated with [Claude Code](https://claude.com/claude-code)
EOF
)" \
  --base develop
```

---

## PR 2 — BUG-0227 (`docs/AGENT_PLAN.md`)

**Branch:** `bugfix/BUG-0227-agent-plan-doc`

```bash
git checkout develop && git pull origin develop
git checkout -b bugfix/BUG-0227-agent-plan-doc
```

---

### Task 4: BUG-0227 — Create `docs/AGENT_PLAN.md`

**Files:**

- Create: `docs/AGENT_PLAN.md`
- Modify: `docs/BUGS.md`

- [ ] **Step 1: Verify the source content in `DM_AGENT.md`**

```bash
grep -n "Blueprint\|Architect\|Build\|Integration\|Test\|Polish\|BLOCK\|PR.*lifecycle\|gh pr" DM_AGENT.md | head -30
```

Use the output to identify the exact section references for each pipeline phase.

- [ ] **Step 2: Create `docs/AGENT_PLAN.md`**

Create the file at `docs/AGENT_PLAN.md` with this structure (fill content from `DM_AGENT.md`):

```markdown
# AGENT_PLAN.md — Agent Pipeline Reference

> Source of truth for the 6-phase delivery pipeline, PR review lifecycle,
> and BLOCK recovery protocol. Content derived from `DM_AGENT.md`.

---

## 1. 6-Phase Pipeline Overview

| Phase       | Agent(s)              | Purpose                         | Key Deliverable                  |
| ----------- | --------------------- | ------------------------------- | -------------------------------- |
| Blueprint   | Compass               | Refine ACs, prioritise tasks    | Approved AC list, priority order |
| Architect   | Keystone              | Scaffold, types, service stubs  | File structure + interfaces      |
| Build       | Pixel, Forge, Palette | Implementation + unit tests     | Passing tests, feature code      |
| Integration | Pixel                 | Wire services, end-to-end flows | Integration tests green          |
| Test        | Sentinel, Circuit     | Formal TC execution, coverage   | Test report, ≥80% coverage       |
| Polish      | Pixel, Forge          | Bug fixes, demo prep            | Shippable artefact               |

---

## 2. Phase Entry / Exit Criteria

### Blueprint

- **Entry:** Story assigned, ACs exist in RELEASE_PLAN.md
- **Exit:** ACs are unambiguous and prioritised; Compass has confirmed scope with Conductor

### Architect

- **Entry:** Blueprint approved by Conductor
- **Exit:** Scaffold merged to feature branch; all interfaces defined; no implementation yet

### Build

- **Entry:** Architecture approved; implementation plan written (see `docs/superpowers/plans/`)
- **Exit:** All unit tests pass; coverage ≥80%; no lint errors; Prettier clean

### Integration

- **Entry:** Build phase complete; feature branch rebased on latest `develop`
- **Exit:** All integration paths exercised; no regressions against existing test suite

### Test

- **Entry:** Integration complete; PR open against `develop`
- **Exit:** All formal TCs executed with Pass/Fail recorded; BUGs filed for all Fail TCs

### Polish

- **Entry:** Test phase complete; all Fail TCs have open BUG entries
- **Exit:** All critical/high BUGs fixed; story marked Done in RELEASE_PLAN.md

---

## 3. PR Review Lifecycle
```

1. gh pr create --base develop --title "[TYPE] US-XXXX: description"
2. Lens reviews (gh pr review --comment with specific findings)
3. CI gates must pass:
   - Lint (ESLint)
   - Test & Coverage Gate (≥80% statements)
   - Build (npm run build)
   - Prettier (format:check)
   - Dependency Audit (npm audit)
   - CodeQL SAST
   - Secret Scan
4. gh pr merge --auto --squash --delete-branch
   (auto-merge fires once all CI gates green)

```

---

## 4. BLOCK Recovery Protocol

A story is BLOCKED when it cannot progress without external intervention.

**Steps:**
1. Log the blocker in `docs/BUGS.md` with severity and root cause.
2. Conductor notifies the user in `progress.md`.
3. Respawn Pixel with full context: the failing step, the error output, and the story spec.
4. Maximum 1 retry. If still blocked after retry, escalate to Conductor for manual resolution.
5. Conductor may re-scope the story or split it before re-entering the pipeline.
```

- [ ] **Step 3: Verify the file exists and is readable**

```bash
ls -la docs/AGENT_PLAN.md && head -10 docs/AGENT_PLAN.md
```

- [ ] **Step 4: Mark BUG-0227 fixed in `docs/BUGS.md`**

Find the BUG-0227 entry and update:

```
Status: Fixed
Fix Branch: bugfix/BUG-0227-agent-plan-doc
```

- [ ] **Step 5: Run tests (no new tests needed — this is a doc-only fix)**

```bash
npx jest --coverage 2>&1 | tail -10
```

Expected: all pass, coverage ≥80%.

- [ ] **Step 6: Commit and open PR**

```bash
git add docs/AGENT_PLAN.md docs/BUGS.md
git commit -m "[fix] BUG-0227: create docs/AGENT_PLAN.md with 6-phase pipeline reference"

gh pr create \
  --title "fix: BUG-0227 — create docs/AGENT_PLAN.md" \
  --body "$(cat <<'EOF'
## Summary
- Creates `docs/AGENT_PLAN.md` documenting the 6-phase pipeline (Blueprint → Polish), PR review lifecycle, and BLOCK recovery protocol — content derived from DM_AGENT.md
- Satisfies AC-0280 referenced by TC-0352

## Test plan
- [ ] `ls docs/AGENT_PLAN.md` — file exists
- [ ] File contains all 6 phase names and entry/exit criteria
- [ ] `npx jest --coverage` passes

🤖 Generated with [Claude Code](https://claude.com/claude-code)
EOF
)" \
  --base develop
```

---

## PR 3 — BUG-0228, BUG-0230, US-0160 (CDN Removal)

**Branch:** `bugfix/BUG-0228-0230-remove-cdn-deps`

```bash
git checkout develop && git pull origin develop
git checkout -b bugfix/BUG-0228-0230-remove-cdn-deps
```

---

### Task 5: BUG-0228 — Remove Google Fonts from `docs/dashboard.html`

**Files:**

- Modify: `tools/generate-dashboard.js`

- [ ] **Step 1: Confirm the Google Fonts links exist**

```bash
grep -n "fonts.googleapis" tools/generate-dashboard.js | head -5
```

Note the exact line numbers for the three `<link>` tags.

- [ ] **Step 2: Remove the Google Fonts `<link>` tags**

In `tools/generate-dashboard.js`, find and delete these three lines (exact content may vary slightly from the template string):

```html
<link rel="preconnect" href="https://fonts.googleapis.com" />
<link
  rel="stylesheet"
  href="https://fonts.googleapis.com/css2?family=Departure+Mono&family=Geist:wght@400;500;600;700&display=swap"
/>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=JetBrains+Mono:wght@400;500;600&display=swap" />
```

- [ ] **Step 3: Add system font stack to the dashboard CSS**

In the same file, find the CSS block for `body` or `html` (near the top of the `<style>` section). Add font-family declarations:

```css
body,
.mc-agent-name-line,
.mc-agent-role-text,
.mc-status-badge {
  font-family:
    system-ui,
    -apple-system,
    'Segoe UI',
    sans-serif;
}
code,
.mono,
.pv-workload-name,
.evt-time {
  font-family: ui-monospace, 'JetBrains Mono', 'Cascadia Code', 'Fira Code', monospace;
}
```

- [ ] **Step 4: Regenerate dashboard and verify**

```bash
npm run dashboard
grep "fonts.googleapis" docs/dashboard.html
```

Expected: no output (zero matches).

- [ ] **Step 5: Commit**

```bash
git add tools/generate-dashboard.js docs/dashboard.html
git commit -m "[fix] BUG-0228: replace Google Fonts CDN with system font stack in dashboard.html"
```

---

### Task 6: BUG-0230 + US-0160 — Remove CDN dependencies from `plan-status.html`

**Files:**

- Modify: `tools/lib/render-html.js`
- Modify: `tools/lib/render-shell.js`

- [ ] **Step 1: Confirm current CDN tags in `render-html.js`**

```bash
sed -n '40,55p' tools/lib/render-html.js
```

You should see lines 43–48 containing the Tailwind CDN script, Chart.js CDN script, and Google Fonts links.

- [ ] **Step 2: Remove the 5 CDN lines from `render-html.js`**

Delete these lines from `tools/lib/render-html.js` (around lines 43–48):

```js
  <script src="https://cdn.tailwindcss.com"></script>
  <script>tailwind.config={darkMode:'class'}</script>
  <script src="https://cdn.jsdelivr.net/npm/chart.js@4/dist/chart.umd.min.js"></script>
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link href="https://fonts.googleapis.com/css2?family=Inter+Tight:ital,wght@0,400;0,500;0,600;0,700;1,400&family=JetBrains+Mono:wght@400;500;600;700&display=swap" rel="stylesheet">
```

- [ ] **Step 3: Replace the budget alert Tailwind classes in `render-html.js`**

Find the budget alert div (around line 371). Currently:

```js
  <div id="budget-alert" class="fixed top-0 left-0 right-0 z-50 px-4 py-2 flex items-center justify-between ${data.budget.percentUsed >= 90 ? 'bg-red-600' : data.budget.percentUsed >= 75 ? 'bg-orange-500' : 'bg-amber-500'} text-white">
    <span class="font-medium">
      ${data.budget.percentUsed >= 90 ? '⛔' : '⚠️'} Budget Alert: ${data.budget.percentUsed}% of budget consumed
    </span>
    <button onclick="dismissBudgetAlert()" class="text-white hover:text-gray-200 text-sm font-bold px-2">✕</button>
```

Replace with:

```js
  <div id="budget-alert" class="budget-alert ${data.budget.percentUsed >= 90 ? 'budget-alert-critical' : data.budget.percentUsed >= 75 ? 'budget-alert-warn' : 'budget-alert-caution'}">
    <span class="budget-alert-text">
      ${data.budget.percentUsed >= 90 ? '⛔' : '⚠️'} Budget Alert: ${data.budget.percentUsed}% of budget consumed
    </span>
    <button onclick="dismissBudgetAlert()" class="budget-alert-dismiss">✕</button>
```

Also fix the `<body>` tag — remove `min-h-screen` (Tailwind utility):

Find:

```js
<body class="min-h-screen ${data.budget && ...
```

Replace with:

```js
<body class="${data.budget && ...
```

- [ ] **Step 4: Add CSS for budget alert and body to `render-html.js`**

In the `<style>` block (find `body {` or the existing alert CSS near line 52), add these rules:

```css
body {
  min-height: 100vh;
}
.budget-alert {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  z-index: 50;
  padding: 8px 16px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  color: #fff;
}
.budget-alert-critical {
  background: oklch(45% 0.22 25);
}
.budget-alert-warn {
  background: oklch(58% 0.18 55);
}
.budget-alert-caution {
  background: oklch(65% 0.17 80);
}
.budget-alert-text {
  font-weight: 500;
}
.budget-alert-dismiss {
  color: inherit;
  font-size: 13px;
  font-weight: 700;
  background: none;
  border: none;
  cursor: pointer;
  padding: 2px 8px;
  opacity: 0.85;
}
.budget-alert-dismiss:hover {
  opacity: 1;
}
```

Also add system font stack:

```css
body {
  font-family:
    system-ui,
    -apple-system,
    'Segoe UI',
    sans-serif;
}
code,
.font-mono {
  font-family: ui-monospace, 'JetBrains Mono', 'Cascadia Code', monospace;
}
```

- [ ] **Step 5: Replace Tailwind classes in `render-shell.js` — filter bar**

Open `tools/lib/render-shell.js`. Find the `renderFilterBar` function (around line 83). Make these changes:

**Change the `sel` variable** (around line 88):

```js
// BEFORE
const sel =
  'border border-slate-300 dark:border-slate-600 rounded px-2 py-1 text-sm dark:bg-slate-700 dark:text-slate-100';

// AFTER
const sel = 'filter-select';
```

**Change the filter-bar div** (around line 90):

```js
// BEFORE
<div class="bg-white dark:bg-slate-800 border-b border-slate-200 dark:border-slate-700 px-6 py-2 flex flex-wrap gap-2 items-center hidden" id="filter-bar">

// AFTER
<div class="filter-bar hidden" id="filter-bar">
```

**Change the fgrp spans** (lines 91 and 104):

```js
// BEFORE
<span id="fgrp-story" class="hidden flex-wrap gap-2 flex">
// AFTER
<span id="fgrp-story" class="fgrp hidden">

// BEFORE
<span id="fgrp-bug" class="hidden flex-wrap gap-2 flex">
// AFTER
<span id="fgrp-bug" class="fgrp hidden">
```

**Change the search input** (around line 118):

```js
// BEFORE
class="${sel} w-full sm:w-48 dark:placeholder-slate-400" aria-label="Search" />
// AFTER
class="${sel} filter-search" aria-label="Search" />
```

**Change the Clear button** (around line 119):

```js
// BEFORE
class="text-sm text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100 underline"
// AFTER
class="filter-clear"
```

- [ ] **Step 6: Add CSS for filter bar to `render-html.js`**

In the `<style>` block, add these new rules (after the existing filter/search CSS):

```css
.filter-bar {
  background: var(--clr-panel-bg);
  border-bottom: 1px solid var(--clr-border);
  padding: 8px 24px;
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  align-items: center;
}
.filter-bar.hidden {
  display: none;
}
.fgrp {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}
.fgrp.hidden {
  display: none;
}
.filter-select {
  border: 1px solid var(--clr-input-border);
  border-radius: 4px;
  padding: 2px 8px;
  font-size: 13px;
  background: var(--clr-input-bg);
  color: var(--clr-input-text);
}
.filter-select:focus {
  outline: 2px solid var(--clr-accent);
  outline-offset: -1px;
}
.filter-search {
  width: 100%;
  max-width: 192px;
}
.filter-clear {
  font-size: 13px;
  color: var(--clr-text-secondary);
  text-decoration: underline;
  background: none;
  border: none;
  cursor: pointer;
  padding: 2px 4px;
}
.filter-clear:hover {
  color: var(--clr-text-primary);
}
```

- [ ] **Step 7: Regenerate plan-status and verify CDN removal**

```bash
npm run generate
grep "cdn.tailwindcss\|cdn.jsdelivr\|googleapis" docs/plan-status.html
```

Expected: no output (zero matches).

- [ ] **Step 8: Run the test suite**

```bash
npx jest tests/unit/render-html.test.js --coverage 2>&1 | tail -20
```

Expected: all pass.

- [ ] **Step 9: Check AC-0498 equivalent — no new hex literals**

```bash
grep -oE '#[0-9a-fA-F]{3,6}\b' docs/plan-status.html | sort -u | head -10
```

Expected: empty (any matches should be scrutinised — `oklch()` is fine, `#RGB` is not).

- [ ] **Step 10: Mark BUG-0228 and BUG-0230 fixed in `docs/BUGS.md`, mark US-0160 Done in `docs/RELEASE_PLAN.md`**

In `docs/BUGS.md`, find BUG-0228 and update:

```
Status: Fixed
Fix Branch: bugfix/BUG-0228-0230-remove-cdn-deps
```

Find BUG-0230 and update:

```
Status: Fixed
Fix Branch: bugfix/BUG-0228-0230-remove-cdn-deps
```

In `docs/RELEASE_PLAN.md`, find US-0160 and update:

```
Status: Done
Branch: bugfix/BUG-0228-0230-remove-cdn-deps
```

Check all US-0160 ACs (AC-0581–0585).

- [ ] **Step 11: Commit and open PR**

```bash
git add tools/generate-dashboard.js tools/lib/render-html.js tools/lib/render-shell.js \
        docs/dashboard.html docs/plan-status.html docs/BUGS.md docs/RELEASE_PLAN.md
git commit -m "[fix] BUG-0228/BUG-0230 + US-0160: remove Google Fonts, Tailwind, Chart.js CDN dependencies"

gh pr create \
  --title "fix: BUG-0228/0230 + US-0160 — remove all external CDN dependencies" \
  --body "$(cat <<'EOF'
## Summary
- BUG-0228: Remove Google Fonts CDN from `tools/generate-dashboard.js`; use system font stack
- BUG-0230: Remove Tailwind CDN, Chart.js CDN, Google Fonts from `tools/lib/render-html.js`; replace Tailwind utility classes with named CSS classes using `var(--clr-*)` tokens
- US-0160: Tailwind removal in plan-status satisfies all AC-0581–0585; marked Done

## Test plan
- [ ] `grep "cdn.tailwindcss\|cdn.jsdelivr\|googleapis" docs/plan-status.html` → empty
- [ ] `grep "fonts.googleapis" docs/dashboard.html` → empty
- [ ] Filter bar, search input, clear button, budget alert render visually correct
- [ ] `npx jest --coverage` passes with ≥80% statements

🤖 Generated with [Claude Code](https://claude.com/claude-code)
EOF
)" \
  --base develop
```

---

## PR 4 — US-0159 Velocity Chart

**Branch:** `feature/US-0159-velocity-chart`

```bash
git checkout develop && git pull origin develop
git checkout -b feature/US-0159-velocity-chart
```

---

### Task 7: US-0159 — `velocityByWeek()` data function

**Files:**

- Modify: `tools/lib/snapshot.js`
- Modify: `tests/unit/snapshot.test.js`

- [ ] **Step 1: Write failing tests for `velocityByWeek`**

Open `tests/unit/snapshot.test.js`. Add this import to the top `require` call:

```js
const {
  getSnapshotFilename,
  saveSnapshot,
  loadSnapshots,
  extractTrends,
  velocityByWeek, // ADD THIS
  SNAPSHOT_REGEX,
} = require('../../tools/lib/snapshot');
```

Then append a new describe block at the end of the file:

```js
describe('velocityByWeek', () => {
  const tshirtPts = { XS: 0.5, S: 1, M: 3, L: 5, XL: 8 };

  function makeSnap(dateStr, stories) {
    return { generatedAt: dateStr, data: { stories, costs: {}, coverage: {} } };
  }

  it('returns empty arrays for 0 snapshots', () => {
    const result = velocityByWeek([]);
    expect(result).toEqual({ labels: [], points: [], rollingAvg: [] });
  });

  it('returns empty arrays for 1 snapshot', () => {
    const snaps = [makeSnap('2026-04-07T10:00:00Z', [{ id: 'US-0001', status: 'Done', estimate: 'M' }])];
    const result = velocityByWeek(snaps);
    expect(result).toEqual({ labels: [], points: [], rollingAvg: [] });
  });

  it('single week: points[0] equals cumulative points of that week', () => {
    // Both snapshots in the same ISO week; first snap has 0 done, second has 1 M-story done
    const snaps = [
      makeSnap('2026-04-07T08:00:00Z', []),
      makeSnap('2026-04-09T10:00:00Z', [{ id: 'US-0001', status: 'Done', estimate: 'M' }]),
    ];
    const result = velocityByWeek(snaps);
    expect(result.labels).toHaveLength(1);
    expect(result.points[0]).toBeCloseTo(3, 1); // M = 3 points
  });

  it('two different weeks: computes per-week delta', () => {
    const snaps = [
      // Week 14: 1 S-story done (1pt cumulative)
      makeSnap('2026-04-01T10:00:00Z', [{ id: 'US-0001', status: 'Done', estimate: 'S' }]),
      // Week 15: 1 L-story done (1+5=6pt cumulative)
      makeSnap('2026-04-08T10:00:00Z', [
        { id: 'US-0001', status: 'Done', estimate: 'S' },
        { id: 'US-0002', status: 'Done', estimate: 'L' },
      ]),
    ];
    const result = velocityByWeek(snaps);
    expect(result.labels).toHaveLength(2);
    expect(result.points[0]).toBeCloseTo(1, 1); // Week 14: 1pt
    expect(result.points[1]).toBeCloseTo(5, 1); // Week 15: delta = 5pt
  });

  it('clamps negative delta to 0', () => {
    // Retroactive status change: week 2 shows fewer done than week 1
    const snaps = [
      makeSnap('2026-04-01T10:00:00Z', [
        { id: 'US-0001', status: 'Done', estimate: 'L' },
        { id: 'US-0002', status: 'Done', estimate: 'M' },
      ]),
      makeSnap('2026-04-08T10:00:00Z', [{ id: 'US-0001', status: 'Done', estimate: 'L' }]),
    ];
    const result = velocityByWeek(snaps);
    expect(result.points[1]).toBe(0);
  });

  it('4-period rolling average uses available data for early periods', () => {
    const snaps = [
      makeSnap('2026-03-25T00:00:00Z', [{ id: 'US-0001', status: 'Done', estimate: 'M' }]), // 3
      makeSnap('2026-04-01T00:00:00Z', [
        { id: 'US-0001', status: 'Done', estimate: 'M' },
        { id: 'US-0002', status: 'Done', estimate: 'S' },
      ]), // cumul 4, delta=1
      makeSnap('2026-04-08T00:00:00Z', [
        { id: 'US-0001', status: 'Done', estimate: 'M' },
        { id: 'US-0002', status: 'Done', estimate: 'S' },
        { id: 'US-0003', status: 'Done', estimate: 'L' },
      ]), // cumul 9, delta=5
      makeSnap('2026-04-15T00:00:00Z', [
        { id: 'US-0001', status: 'Done', estimate: 'M' },
        { id: 'US-0002', status: 'Done', estimate: 'S' },
        { id: 'US-0003', status: 'Done', estimate: 'L' },
        { id: 'US-0004', status: 'Done', estimate: 'XS' },
      ]), // cumul 9.5, delta=0.5
    ];
    const result = velocityByWeek(snaps);
    // points: [3, 1, 5, 0.5]
    // rollingAvg[0] = 3.0
    // rollingAvg[1] = (3+1)/2 = 2.0
    // rollingAvg[2] = (3+1+5)/3 = 3.0
    // rollingAvg[3] = (3+1+5+0.5)/4 = 2.375 → rounded to 1dp = 2.4
    expect(result.rollingAvg[0]).toBeCloseTo(3.0, 1);
    expect(result.rollingAvg[1]).toBeCloseTo(2.0, 1);
    expect(result.rollingAvg[2]).toBeCloseTo(3.0, 1);
    expect(result.rollingAvg[3]).toBeCloseTo(2.4, 1);
  });

  it('two snapshots in same ISO week uses snapshot with higher cumulative velocity', () => {
    const snaps = [
      // Same week, different times — second has more done
      makeSnap('2026-04-07T06:00:00Z', [{ id: 'US-0001', status: 'Done', estimate: 'S' }]), // 1pt
      makeSnap('2026-04-07T14:00:00Z', [
        { id: 'US-0001', status: 'Done', estimate: 'S' },
        { id: 'US-0002', status: 'Done', estimate: 'M' },
      ]), // 4pt — this one wins
      makeSnap('2026-04-14T10:00:00Z', [
        { id: 'US-0001', status: 'Done', estimate: 'S' },
        { id: 'US-0002', status: 'Done', estimate: 'M' },
        { id: 'US-0003', status: 'Done', estimate: 'L' },
      ]), // 9pt — delta = 5
    ];
    const result = velocityByWeek(snaps);
    expect(result.labels).toHaveLength(2);
    expect(result.points[0]).toBeCloseTo(4, 1); // Week 15: max of [1pt, 4pt] = 4pt
    expect(result.points[1]).toBeCloseTo(5, 1); // Week 16: delta from 4pt baseline
  });
});
```

- [ ] **Step 2: Run tests to confirm they fail**

```bash
npx jest tests/unit/snapshot.test.js --testNamePattern="velocityByWeek" 2>&1 | tail -15
```

Expected: FAIL — `velocityByWeek is not a function`.

- [ ] **Step 3: Implement `isoWeek()` and `velocityByWeek()` in `tools/lib/snapshot.js`**

Open `tools/lib/snapshot.js`. Before `module.exports`, add:

```js
function isoWeek(date) {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  d.setUTCDate(d.getUTCDate() + 4 - (d.getUTCDay() || 7));
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  const week = Math.ceil(((d - yearStart) / 86400000 + 1) / 7);
  return `${d.getUTCFullYear()}-W${String(week).padStart(2, '0')}`;
}

const TSHIRT_POINTS = { XS: 0.5, S: 1, M: 3, L: 5, XL: 8 };

function snapshotCumulativeVelocity(snap) {
  const stories = snap.data.stories || [];
  return stories
    .filter((st) => st.status === 'Done')
    .reduce((sum, st) => {
      const est = (st.estimate || '').toUpperCase();
      return sum + (TSHIRT_POINTS[est] || 0);
    }, 0);
}

function velocityByWeek(snapshots) {
  if (!snapshots || snapshots.length < 2) {
    return { labels: [], points: [], rollingAvg: [] };
  }

  // Group snapshots by ISO week; keep snapshot with highest cumulative velocity per week
  const weekMap = new Map();
  for (const snap of snapshots) {
    const week = isoWeek(new Date(snap.generatedAt));
    const cumul = snapshotCumulativeVelocity(snap);
    if (!weekMap.has(week) || cumul > weekMap.get(week).cumul) {
      weekMap.set(week, { week, cumul });
    }
  }

  // Sort weeks chronologically
  const weeks = Array.from(weekMap.values()).sort((a, b) => a.week.localeCompare(b.week));

  if (weeks.length < 2) {
    return { labels: [], points: [], rollingAvg: [] };
  }

  const labels = weeks.map((w) => w.week);
  const points = weeks.map((w, i) => {
    const prev = i === 0 ? 0 : weeks[i - 1].cumul;
    return Math.max(0, Math.round((w.cumul - prev) * 10) / 10);
  });

  const rollingAvg = points.map((_, i) => {
    const window = points.slice(Math.max(0, i - 3), i + 1);
    const avg = window.reduce((s, v) => s + v, 0) / window.length;
    return Math.round(avg * 10) / 10;
  });

  return { labels, points, rollingAvg };
}
```

Then update `module.exports`:

```js
module.exports = {
  getSnapshotFilename,
  saveSnapshot,
  loadSnapshots,
  extractTrends,
  velocityByWeek,
  SNAPSHOT_REGEX,
};
```

- [ ] **Step 4: Run tests to confirm they pass**

```bash
npx jest tests/unit/snapshot.test.js --testNamePattern="velocityByWeek" 2>&1 | tail -15
```

Expected: all 6 tests PASS.

- [ ] **Step 5: Commit**

```bash
git add tools/lib/snapshot.js tests/unit/snapshot.test.js
git commit -m "[feat] US-0159: add velocityByWeek() to snapshot.js with isoWeek helper"
```

---

### Task 8: US-0159 — Wire `velocityByWeek` into `generate-plan.js`

**Files:**

- Modify: `tools/generate-plan.js`

- [ ] **Step 1: Update the import in `generate-plan.js`**

Find the line (around line 24):

```js
const { saveSnapshot, loadSnapshots, extractTrends } = require('./lib/snapshot');
```

Update to:

```js
const { saveSnapshot, loadSnapshots, extractTrends, velocityByWeek } = require('./lib/snapshot');
```

- [ ] **Step 2: Attach `velocityByWeek` to `data.trends`**

Find the section (around line 356–364):

```js
const trends = extractTrends(snapshots);
// ...
data.trends = trends;
```

After `data.trends = trends;`, add:

```js
if (data.trends) {
  data.trends.velocityByWeek = velocityByWeek(snapshots);
}
```

- [ ] **Step 3: Verify by running generate**

```bash
npm run generate 2>&1 | tail -5
node -e "const d = require('./docs/plan-status.json'); console.log('velocityByWeek keys:', Object.keys(d.trends.velocityByWeek || {}))"
```

Expected: `velocityByWeek keys: [ 'labels', 'points', 'rollingAvg' ]`

- [ ] **Step 4: Commit**

```bash
git add tools/generate-plan.js
git commit -m "[feat] US-0159: wire velocityByWeek into data.trends in generate-plan.js"
```

---

### Task 9: US-0159 — Velocity Chart in `render-tabs.js`

**Files:**

- Modify: `tools/lib/render-tabs.js`
- Modify: `tests/unit/render-tabs.test.js`

- [ ] **Step 1: Write failing tests**

Open `tests/unit/render-tabs.test.js`. Add this import at the top alongside the existing `require`:

```js
const { renderTrendsTab } = require('../../tools/lib/render-tabs');
```

Add a helper and new describe block at the end of the file:

```js
function mkTrendsData(overrides = {}) {
  return {
    epics: [],
    stories: [],
    bugs: [],
    costs: {},
    budget: { hasBudget: false },
    recentActivity: [],
    coverage: { available: false },
    trends: {
      dates: ['2026-04-01T00:00:00Z', '2026-04-08T00:00:00Z'],
      doneCounts: [2, 4],
      totalStories: [5, 5],
      aiCosts: [1.0, 2.0],
      coverage: [80, 85],
      velocity: [5, 8],
      openBugs: [3, 2],
      atRisk: [1, 1],
      inputTokens: [1000, 2000],
      outputTokens: [500, 1000],
      avgRisk: [1.0, 0.8],
      velocityByWeek: {
        labels: ['2026-W14', '2026-W15'],
        points: [3, 5],
        rollingAvg: [3.0, 4.0],
      },
      ...overrides.trends,
    },
    ...overrides,
  };
}

describe('renderTrendsTab — US-0159 Weekly Velocity chart', () => {
  it('renders chart-velocity-weekly canvas in Trends tab', () => {
    const html = renderTrendsTab(mkTrendsData());
    expect(html).toContain('chart-velocity-weekly');
  });

  it('renders velWeeklyLabels, velWeeklyPoints, velWeeklyAvg JS vars', () => {
    const html = renderTrendsTab(mkTrendsData());
    expect(html).toContain('velWeeklyLabels');
    expect(html).toContain('velWeeklyPoints');
    expect(html).toContain('velWeeklyAvg');
  });

  it('renders empty-state placeholder when velocityByWeek has fewer than 2 labels', () => {
    const data = mkTrendsData({
      trends: { velocityByWeek: { labels: ['2026-W14'], points: [3], rollingAvg: [3] } },
    });
    const html = renderTrendsTab(data);
    expect(html).not.toContain('chart-velocity-weekly');
  });

  it('renders empty-state placeholder when velocityByWeek is absent', () => {
    const data = mkTrendsData({ trends: { velocityByWeek: null } });
    const html = renderTrendsTab(data);
    expect(html).not.toContain('chart-velocity-weekly');
  });

  it('uses pvChartColors.info and pvChartColors.warn — no hardcoded hex in chart JS', () => {
    const html = renderTrendsTab(mkTrendsData());
    // Extract the initTrendsCharts function portion
    const chartSection = html.slice(html.indexOf('chart-velocity-weekly'), html.indexOf('chart-velocity-weekly') + 500);
    expect(chartSection).not.toMatch(/#[0-9a-fA-F]{3,6}\b/);
  });
});
```

- [ ] **Step 2: Run tests to confirm they fail**

```bash
npx jest tests/unit/render-tabs.test.js --testNamePattern="US-0159" 2>&1 | tail -15
```

Expected: FAIL — `renderTrendsTab is not a function` (not exported yet) or chart canvas not found.

- [ ] **Step 3: Verify `renderTrendsTab` is exported**

```bash
node -e "const m = require('./tools/lib/render-tabs'); console.log(typeof m.renderTrendsTab)"
```

Expected: `function` (it is already exported — no change needed).

- [ ] **Step 4: Add inline data vars for the weekly velocity chart**

In `tools/lib/render-tabs.js`, find `renderTrendsTab()` (around line 389). Near the top of the function, after the existing `velocityJson` variable, add:

```js
const vbw = (data.trends && data.trends.velocityByWeek) || null;
const hasVbw = vbw && Array.isArray(vbw.labels) && vbw.labels.length >= 2;
const velWeeklyLabels = hasVbw ? JSON.stringify(vbw.labels) : '[]';
const velWeeklyPoints = hasVbw ? JSON.stringify(vbw.points) : '[]';
const velWeeklyAvg = hasVbw ? JSON.stringify(vbw.rollingAvg) : '[]';
```

- [ ] **Step 5: Add the chart block in the Trends tab HTML**

In `renderTrendsTab()`, find the existing velocity chart canvas (around line 436):

```js
<div style="height:250px;position:relative">
  <canvas id="chart-trends-velocity"></canvas>
</div>
```

After the entire velocity chart section (after its closing `</div>`), add the new weekly velocity section:

```js
      <h3 class="trends-section-title" style="margin:20px 0 8px">Weekly Velocity</h3>
      ${hasVbw
        ? `<div style="height:250px;position:relative"><canvas id="chart-velocity-weekly"></canvas></div>`
        : `<p style="color:var(--text-mute);font-size:13px;padding:16px 0;">Not enough snapshot data yet — run generate at least twice in different weeks.</p>`
      }
```

- [ ] **Step 6: Add inline JS data vars to the renderTrendsTab output**

Find the section where inline JS data is written (around line 520), e.g.:

```js
coverage: ${coverageJson}, velocity: ${velocityJson},
```

Add the new vars after `velocity`:

```js
coverage: ${coverageJson}, velocity: ${velocityJson},
```

Find the template literal block that assigns the data values to the JS var and add:

```js
const velWeeklyLabels = ${velWeeklyLabels};
const velWeeklyPoints = ${velWeeklyPoints};
const velWeeklyAvg    = ${velWeeklyAvg};
```

(Place these adjacent to the other `const` declarations in the same `<script>` block.)

- [ ] **Step 7: Add chart initialisation in `initTrendsCharts()`**

Find `initTrendsCharts()` (around line 550). After the existing `_mkTrend('chart-trends-velocity', ...)` call, add:

```js
if (velWeeklyLabels && velWeeklyLabels.length >= 2) {
  _mkTrend('chart-velocity-weekly', {
    type: 'bar',
    data: {
      labels: velWeeklyLabels,
      datasets: [
        {
          type: 'bar',
          label: 'Points completed',
          data: velWeeklyPoints,
          backgroundColor: pvChartColors.info,
        },
        {
          type: 'line',
          label: '4-wk rolling avg',
          data: velWeeklyAvg,
          borderColor: pvChartColors.warn,
          borderWidth: 2,
          pointRadius: 3,
          tension: 0.3,
          fill: false,
        },
      ],
    },
    options: {
      scales: { y: { title: { display: true, text: 't-shirt points' } } },
    },
  });
}
```

- [ ] **Step 8: Run tests to confirm they pass**

```bash
npx jest tests/unit/render-tabs.test.js --testNamePattern="US-0159" 2>&1 | tail -15
```

Expected: all 5 new tests PASS.

- [ ] **Step 9: Run full test suite**

```bash
npx jest --coverage 2>&1 | tail -25
```

Expected: all tests pass, ≥80% coverage.

- [ ] **Step 10: Regenerate plan-status and visually verify**

```bash
npm run generate
grep "chart-velocity-weekly" docs/plan-status.html | head -3
grep "velWeeklyLabels" docs/plan-status.html | head -3
```

Both should return matches. Open `docs/plan-status.html` in a browser and confirm the Trends tab shows a "Weekly Velocity" chart.

- [ ] **Step 11: Update `docs/ID_REGISTRY.md`**

The new tests don't add formal TCs (they're unit tests), but if any TCs were added to `TEST_CASES.md`, update the TC sequence. Update the AC sequence if new ACs were assigned. In this case only the ID_REGISTRY AC row needs checking — no new formal TCs added.

- [ ] **Step 12: Commit and open PR**

```bash
git add tools/lib/snapshot.js tools/generate-plan.js tools/lib/render-tabs.js \
        tests/unit/snapshot.test.js tests/unit/render-tabs.test.js \
        docs/plan-status.html docs/plan-status.json docs/ID_REGISTRY.md
git commit -m "[feat] US-0159: Velocity Chart — velocityByWeek data pipeline + render-tabs bar/line chart"

gh pr create \
  --title "feat: US-0159 — Weekly Velocity Chart in Trends tab" \
  --body "$(cat <<'EOF'
## Summary
- Adds `velocityByWeek(snapshots)` to `tools/lib/snapshot.js`: groups snapshots by ISO week, computes per-week t-shirt point deltas (XS=0.5 … XL=8), clamps negatives to 0, overlays 4-period rolling average
- Wires `data.trends.velocityByWeek` in `tools/generate-plan.js`
- Adds "Weekly Velocity" bar+line Chart.js chart to Trends tab in `tools/lib/render-tabs.js`
- Empty-state placeholder shown when fewer than 2 weeks of snapshot data exist

## ACs verified
- [x] AC-0577: Bar chart with one bar per ISO week, height = t-shirt points
- [x] AC-0578: Data from existing snapshot infrastructure, no new data-source files
- [x] AC-0579: 4-period rolling average trend line overlaid
- [x] AC-0580: Uses `pvChartColors.info`/`pvChartColors.warn` from theme.js — no hex literals

## Test plan
- [ ] `npx jest tests/unit/snapshot.test.js` — all velocityByWeek tests pass
- [ ] `npx jest tests/unit/render-tabs.test.js` — all US-0159 tests pass
- [ ] `grep "chart-velocity-weekly" docs/plan-status.html` returns a match
- [ ] `npx jest --coverage` passes with ≥80% statements

🤖 Generated with [Claude Code](https://claude.com/claude-code)
EOF
)" \
  --base develop
```

---

## Session Close

After all 4 PRs are merged:

- [ ] Update `docs/RELEASE_PLAN.md`: mark US-0159 `Status: Done`, check all ACs (AC-0577–0580)
- [ ] Update `progress.md` (prepend Session 31 entry)
- [ ] Update `MEMORY.md` (velocityByWeek pipeline, CDN removal approach, Tailwind replacement pattern)
- [ ] Update `PROMPT_LOG.md` (append session prompt)
- [ ] Update `docs/LESSONS.md` if any new lessons discovered
- [ ] Verify `docs/ID_REGISTRY.md` is current
