# Stakeholder Hero + Epic Start/Done Dates — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add `StartDate`/`DoneDate` to epic data and display them in the Stakeholder tab, and replace the Stakeholder tab's summary bar with the full Status tab hero (verdict, sparklines, KPI tiles, Overall Progress, Epic Progress, Top Risks, This Week).

**Architecture:** Feature 1 adds two optional fields to `parseEpicBlock()` and populates `docs/RELEASE_PLAN.md`; the display is a one-liner in `renderStakeholderTab`. Feature 2 replaces the `summaryBar` template in `renderStakeholderTab` with calls to the already-existing `_renderStatusHero(data)` and `_renderDecisionWidgets(data)` functions — no new data pipelines needed.

**Tech Stack:** Node.js, Jest (`npx jest --coverage`, gate ≥80% statements). All changes in `tools/lib/` and `tests/unit/`.

**Test location:** `tests/unit/`

---

## File Map

| File                                    | Action | Why                                                       |
| --------------------------------------- | ------ | --------------------------------------------------------- |
| `tests/fixtures/RELEASE_PLAN.md`        | Modify | Add `StartDate`/`DoneDate` to one epic in fixture         |
| `tools/lib/parse-release-plan.js`       | Modify | Return `startDate`/`doneDate` from `parseEpicBlock`       |
| `tests/unit/parse-release-plan.test.js` | Modify | Tests for startDate/doneDate parsing                      |
| `docs/RELEASE_PLAN.md`                  | Modify | Add StartDate/DoneDate to all 22 epics                    |
| `tools/lib/render-tabs.js`              | Modify | (1) Show dates in epic rows; (2) swap summaryBar for hero |
| `tests/unit/render-tabs.test.js`        | Modify | Tests for Stakeholder hero presence and date display      |

---

## Task 1: Parse `StartDate` / `DoneDate` from epic blocks

**Files:**

- Modify: `tests/fixtures/RELEASE_PLAN.md`
- Modify: `tools/lib/parse-release-plan.js:43-58`
- Modify: `tests/unit/parse-release-plan.test.js`

- [ ] **Step 0: Create the feature branch**

```bash
cd /Users/Kamal_Syed/Projects/PlanVisualizer
git checkout develop && git pull origin develop
git checkout -b feature/US-0162-stakeholder-hero-epic-dates
```

All Tasks 1–5 work on this branch.

- [ ] **Step 1: Update test fixture to include date fields**

Open `tests/fixtures/RELEASE_PLAN.md`. In the Epics block, update `EPIC-0001` to include both fields and leave `EPIC-0002` without them:

```markdown

```

EPIC-0001: Code Editing
Description: Core editor.
Release Target: MVP (v0.1)
Status: In Progress
StartDate: 2026-03-05
DoneDate: 2026-03-10
Dependencies: None

EPIC-0002: File Management
Description: File Explorer.
Release Target: MVP (v0.1)
Status: Planned
Dependencies: EPIC-0001

```

```

- [ ] **Step 2: Write failing tests**

Open `tests/unit/parse-release-plan.test.js`. In the `describe('epics', ...)` block (around line 13), append these tests:

```js
it('parses epic startDate when present', () => expect(result.epics[0].startDate).toBe('2026-03-05'));
it('parses epic doneDate when present', () => expect(result.epics[0].doneDate).toBe('2026-03-10'));
it('returns null startDate when field absent', () => expect(result.epics[1].startDate).toBeNull());
it('returns null doneDate when field absent', () => expect(result.epics[1].doneDate).toBeNull());
```

Also add a standalone test for the inline-markdown path (after the existing multi-dep test):

````js
it('parses StartDate and DoneDate from inline epic block', () => {
  const md =
    '```\nEPIC-0012: Dated\nDescription: Test\nRelease Target: v1\nStatus: Done\nStartDate: 2026-04-01\nDoneDate: 2026-04-15\nDependencies: None\n```';
  const r = parseReleasePlan(md);
  expect(r.epics[0].startDate).toBe('2026-04-01');
  expect(r.epics[0].doneDate).toBe('2026-04-15');
});
````

- [ ] **Step 3: Run tests to confirm they fail**

```bash
npx jest tests/unit/parse-release-plan.test.js --testNamePattern="startDate|doneDate|DoneDate|StartDate" 2>&1 | tail -10
```

Expected: FAIL — `startDate` is `undefined`, not `'2026-03-05'`.

- [ ] **Step 4: Implement — update `parseEpicBlock` in `tools/lib/parse-release-plan.js`**

Open `tools/lib/parse-release-plan.js`. Find `parseEpicBlock` (line 43). Change the returned object:

**Before (lines 50-57):**

```js
return {
  id: idTitle[1],
  title: idTitle[2].trim(),
  description: get('Description'),
  releaseTarget: get('Release Target'),
  status: get('Status'),
  dependencies: parseDeps(get('Dependencies')),
};
```

**After:**

```js
return {
  id: idTitle[1],
  title: idTitle[2].trim(),
  description: get('Description'),
  releaseTarget: get('Release Target'),
  status: get('Status'),
  startDate: get('StartDate') || null,
  doneDate: get('DoneDate') || null,
  dependencies: parseDeps(get('Dependencies')),
};
```

- [ ] **Step 5: Run tests to confirm they pass**

```bash
npx jest tests/unit/parse-release-plan.test.js 2>&1 | tail -10
```

Expected: all pass.

- [ ] **Step 6: Run full suite**

```bash
npx jest --coverage 2>&1 | tail -8
```

Expected: all pass, ≥80% coverage.

- [ ] **Step 7: Commit**

```bash
git add tools/lib/parse-release-plan.js tests/unit/parse-release-plan.test.js tests/fixtures/RELEASE_PLAN.md
git commit -m "[feat] US-0162: parse StartDate/DoneDate from epic blocks in RELEASE_PLAN.md"
```

---

## Task 2: Populate `RELEASE_PLAN.md` with epic dates

**Files:**

- Modify: `docs/RELEASE_PLAN.md`

- [ ] **Step 1: Create the branch for this feature**

```bash
git checkout develop && git pull origin develop
git checkout -b feature/US-0162-stakeholder-hero-epic-dates
```

Then cherry-pick or rebase the Task 1 commit onto this branch if it was made on develop.

> Note: All remaining tasks work on `feature/US-0162-stakeholder-hero-epic-dates`.

- [ ] **Step 2: Add `StartDate` / `DoneDate` to every epic in `docs/RELEASE_PLAN.md`**

For each epic below, find its block in `docs/RELEASE_PLAN.md` and add the two lines immediately **after** the `Status:` line and **before** the `Dependencies:` line. Use the dates from the spec table:

| Epic      | StartDate               | DoneDate               |
| --------- | ----------------------- | ---------------------- |
| EPIC-0001 | _(omit — predates log)_ | _(omit)_               |
| EPIC-0002 | _(omit)_                | _(omit)_               |
| EPIC-0003 | _(omit)_                | _(omit)_               |
| EPIC-0004 | 2026-03-11              | 2026-04-13             |
| EPIC-0005 | 2026-03-11              | 2026-03-11             |
| EPIC-0006 | 2026-03-16              | 2026-03-16             |
| EPIC-0007 | 2026-03-16              | 2026-04-13             |
| EPIC-0008 | 2026-03-30              | 2026-04-13             |
| EPIC-0009 | 2026-04-08              | 2026-04-27             |
| EPIC-0010 | 2026-04-19              | _(omit — Planned)_     |
| EPIC-0011 | 2026-04-08              | 2026-04-08             |
| EPIC-0012 | 2026-04-22              | _(omit — Planned)_     |
| EPIC-0013 | 2026-04-13              | 2026-04-27             |
| EPIC-0014 | 2026-04-13              | 2026-04-27             |
| EPIC-0015 | 2026-04-13              | 2026-04-18             |
| EPIC-0016 | 2026-04-13              | 2026-04-27             |
| EPIC-0017 | 2026-04-13              | 2026-04-18             |
| EPIC-0019 | 2026-04-15              | 2026-04-27             |
| EPIC-0020 | 2026-04-21              | 2026-04-27             |
| EPIC-0021 | 2026-04-27              | 2026-04-27             |
| EPIC-0022 | 2026-04-24              | _(omit — in progress)_ |

Example — EPIC-0004 block **before**:

```
EPIC-0004: CI/CD Pipeline
Description: ...
Release Target: Release 1.1
Status: Done
Dependencies: EPIC-0001
```

**After**:

```
EPIC-0004: CI/CD Pipeline
Description: ...
Release Target: Release 1.1
Status: Done
StartDate: 2026-03-11
DoneDate: 2026-04-13
Dependencies: EPIC-0001
```

- [ ] **Step 3: Verify dates are parsed**

```bash
npm run generate 2>&1 | tail -3
node -e "const d = require('./docs/plan-status.json'); const ep = d.epics.find(e => e.id === 'EPIC-0004'); console.log(ep.id, ep.startDate, ep.doneDate)"
```

Expected: `EPIC-0004 2026-03-11 2026-04-13`

- [ ] **Step 4: Commit**

```bash
git add docs/RELEASE_PLAN.md docs/plan-status.json docs/plan-status.html
git commit -m "[feat] US-0162: populate StartDate/DoneDate for all epics in RELEASE_PLAN.md"
```

---

## Task 3: Display epic dates in Stakeholder tab epic rows

**Files:**

- Modify: `tools/lib/render-tabs.js` (the `epicRows` map in `renderStakeholderTab`, around line 2824)
- Modify: `tests/unit/render-tabs.test.js`

- [ ] **Step 1: Write failing test**

Open `tests/unit/render-tabs.test.js`. Add a new describe block at the end:

```js
describe('renderStakeholderTab — epic dates', () => {
  function mkStakeholderData(epicOverrides = {}) {
    return {
      epics: [
        {
          id: 'EPIC-0001',
          title: 'Core',
          status: 'Done',
          startDate: '2026-03-05',
          doneDate: '2026-03-10',
          ...epicOverrides,
        },
        { id: 'EPIC-0002', title: 'Renderer', status: 'In Progress', startDate: '2026-03-11', doneDate: null },
        { id: 'EPIC-0003', title: 'No Dates', status: 'Planned', startDate: null, doneDate: null },
      ],
      stories: [],
      bugs: [],
      costs: null,
      budget: { hasBudget: false },
      recentActivity: [],
      coverage: { available: false },
      trends: null,
      risk: { byStory: new Map(), byEpic: new Map() },
    };
  }

  it('shows formatted date range for Done epic with both dates', () => {
    const html = renderStakeholderTab(mkStakeholderData());
    expect(html).toContain('sh-epic-dates');
    expect(html).toContain('Mar 5, 2026');
    expect(html).toContain('Mar 10, 2026');
  });

  it('shows start date and "in progress" for epic with only startDate', () => {
    const html = renderStakeholderTab(mkStakeholderData());
    expect(html).toContain('in progress');
  });

  it('omits date line for epic with no dates', () => {
    const html = renderStakeholderTab(mkStakeholderData());
    // EPIC-0003 has no dates — its row should have no sh-epic-dates span
    // We verify this by checking the count: 2 epics have dates, 1 does not
    const dateDivCount = (html.match(/class="sh-epic-dates"/g) || []).length;
    expect(dateDivCount).toBe(2);
  });
});
```

- [ ] **Step 2: Run failing test**

```bash
npx jest tests/unit/render-tabs.test.js --testNamePattern="epic dates" 2>&1 | tail -10
```

Expected: FAIL — `sh-epic-dates` not found.

- [ ] **Step 3: Add date display to `renderStakeholderTab` epic row**

Open `tools/lib/render-tabs.js`. Inside the `epicRows` map in `renderStakeholderTab`, find the epic row HTML (around line 2824). The block that builds `sh-epic-name-block` currently is:

```js
<div class="sh-epic-name-block">
  <div class="sh-epic-name">
    <span class="sh-epic-id">${esc(epic.id)}</span>${esc(epic.title)}
  </div>
  ${costLine}
</div>
```

Replace with:

```js
<div class="sh-epic-name-block">
  <div class="sh-epic-name">
    <span class="sh-epic-id">${esc(epic.id)}</span>${esc(epic.title)}
  </div>
  $
  {(() => {
    const fmt = (d) =>
      d
        ? new Date(d + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
        : null;
    const start = fmt(epic.startDate);
    const done = fmt(epic.doneDate);
    if (!start && !done) return '';
    const end = done ? done : '<em>in progress</em>';
    return `<div class="sh-epic-dates">${start} → ${end}</div>`;
  })()}
  ${costLine}
</div>
```

- [ ] **Step 4: Add CSS for `sh-epic-dates`**

In `render-html.js`, find the block of `sh-*` CSS rules. Add:

```css
.sh-epic-dates {
  font-size: 11px;
  font-family: ui-monospace, 'JetBrains Mono', monospace;
  color: var(--clr-text-muted);
  margin-top: 2px;
}
```

Search for `.sh-epic-costs` in `render-html.js` and add the new rule directly after it.

- [ ] **Step 5: Run test to confirm pass**

```bash
npx jest tests/unit/render-tabs.test.js --testNamePattern="epic dates" 2>&1 | tail -10
```

Expected: all 3 tests PASS.

- [ ] **Step 6: Regenerate and verify**

```bash
npm run generate
grep -A2 "sh-epic-dates" docs/plan-status.html | head -10
```

Should show date ranges like `Mar 11, 2026 → Apr 13, 2026`.

- [ ] **Step 7: Commit**

```bash
git add tools/lib/render-tabs.js tools/lib/render-html.js tests/unit/render-tabs.test.js docs/plan-status.html docs/plan-status.json
git commit -m "[feat] US-0162: display epic start/done dates in Stakeholder tab epic rows"
```

---

## Task 4: Add Status hero to Stakeholder tab

**Files:**

- Modify: `tools/lib/render-tabs.js` (`renderStakeholderTab`, lines ~2663–2867)
- Modify: `tests/unit/render-tabs.test.js`

- [ ] **Step 1: Write failing tests**

Add another describe block in `tests/unit/render-tabs.test.js`:

```js
describe('renderStakeholderTab — hero section', () => {
  function mkFullData() {
    return {
      epics: [{ id: 'EPIC-0001', title: 'Core', status: 'Done', startDate: null, doneDate: null }],
      stories: [{ id: 'US-0001', epicId: 'EPIC-0001', title: 'T', status: 'Done', acs: [] }],
      bugs: [],
      costs: { _totals: { costUsd: 0, projectedUsd: 0 } },
      budget: { hasBudget: false, percentUsed: 0 },
      recentActivity: [],
      coverage: { available: false },
      trends: null,
      risk: { byStory: new Map(), byEpic: new Map() },
      sessionTimeline: [],
      atRisk: {},
    };
  }

  it('renders pv-hero-section in Stakeholder tab', () => {
    const html = renderStakeholderTab(mkFullData());
    expect(html).toContain('pv-hero-section');
  });

  it('renders pv-widgets section in Stakeholder tab', () => {
    const html = renderStakeholderTab(mkFullData());
    expect(html).toContain('pv-widgets');
  });

  it('does NOT render sh-summary-bar in Stakeholder tab', () => {
    const html = renderStakeholderTab(mkFullData());
    expect(html).not.toContain('sh-summary-bar');
  });

  it('export bar still renders in Stakeholder tab', () => {
    const html = renderStakeholderTab(mkFullData());
    expect(html).toContain('stakeholder-export-bar');
  });
});
```

- [ ] **Step 2: Run failing tests**

```bash
npx jest tests/unit/render-tabs.test.js --testNamePattern="hero section" 2>&1 | tail -10
```

Expected: FAIL — `pv-hero-section` not found; `sh-summary-bar` found (should not be).

- [ ] **Step 3: Remove `summaryBar` and its exclusive variables from `renderStakeholderTab`**

Open `tools/lib/render-tabs.js`. Inside `renderStakeholderTab` (around line 2663), **delete** these blocks entirely:

1. The `tlColor` / `tlLabel` block (lines ~2675–2682):

```js
let tlColor = 'var(--ok)';
let tlLabel = 'On track';
if (pctUsed !== null && pctUsed > 80) {
  tlColor = 'var(--risk)';
  tlLabel = 'At risk';
} else if (pctUsed !== null && pctUsed >= 50) {
  tlColor = 'var(--warn)';
  tlLabel = 'Watch';
}
```

2. The `budgetLine` block (lines ~2693–2702):

```js
let budgetLine = '';
if (budget.hasBudget) {
  budgetLine = `${esc(tlLabel)} · Est. ${shUsdLabel(totalProjected)} · AI spend ${shUsdLabel(totalSpent)}`;
  if (budget.daysRemaining !== null && budget.daysRemaining !== undefined && budget.burnRate > 0) {
    const wks = Math.round(budget.daysRemaining / 7);
    if (wks >= 1) budgetLine += ` · At current pace, budget lasts ${wks} more week${wks !== 1 ? 's' : ''}`;
  }
} else if (costs) {
  budgetLine = `Est. ${shUsdLabel(totalProjected)} · AI spend ${shUsdLabel(totalSpent)}`;
}
```

3. The `openHighBugs` and `blockedStoriesCnt` lines (keep checking if they're used by `epicRows` — they're not; `epicRows` uses its own inline `shEpicCompositeStatus` call):

```js
const openHighBugs = bugs.filter(
  (b) => /^(Critical|High)$/i.test(b.severity) && !/^(Fixed|Retired|Cancelled)/i.test(b.status),
);
const blockedStoriesCnt = stories.filter((s) => /^blocked$/i.test(s.status)).length;
```

4. The entire `summaryBar` template literal (lines ~2707–2769):

```js
const summaryBar = `
  <div class="sh-summary-bar">
    ...
  </div>`;
```

- [ ] **Step 4: Replace `${summaryBar}` with hero calls in the return template**

Find the `return \`` template in `renderStakeholderTab` (around line 2844). Change:

```js
  return `
  <div id="tab-stakeholder" class="p-6 hidden tab-fill" role="tabpanel" aria-labelledby="tab-btn-stakeholder">
    ${summaryBar}
    <div class="sh-milestone-section">
```

To:

```js
  return `
  <div id="tab-stakeholder" class="p-6 hidden tab-fill" role="tabpanel" aria-labelledby="tab-btn-stakeholder">
    ${_renderStatusHero(data)}
    ${_renderDecisionWidgets(data)}
    <div class="sh-milestone-section">
```

- [ ] **Step 5: Also remove variables only used by `summaryBar`**

After the deletions in Step 3, these variables may now be unused: `totalProjected`, `totalSpent`, `pctUsed`. Check if `epicRows` uses any of them — it uses `epicProjected`/`epicSpent` computed inline, not these. Remove them:

```js
// DELETE these if not used by epicRows:
const pctUsed = budget.percentUsed !== null && budget.percentUsed !== undefined ? budget.percentUsed : null;
const totalSpent = (costs && costs._totals && costs._totals.costUsd) || 0;
const totalProjected = costs
  ? Object.entries(costs)
      .filter(([k]) => k !== '_totals')
      .reduce((sum, [, c]) => sum + (c && c.projectedUsd ? c.projectedUsd : 0), 0)
  : 0;
```

**Important:** Only delete variables that are no longer referenced anywhere in the function. Run `npx eslint tools/lib/render-tabs.js` to confirm — ESLint will report unused variables.

- [ ] **Step 6: Run failing tests again**

```bash
npx jest tests/unit/render-tabs.test.js --testNamePattern="hero section" 2>&1 | tail -15
```

Expected: all 4 tests PASS.

- [ ] **Step 7: Run full test suite**

```bash
npx jest --coverage 2>&1 | tail -10
```

Expected: all pass, ≥80% coverage.

- [ ] **Step 8: Regenerate and verify**

```bash
npm run generate
grep -c "pv-hero-section" docs/plan-status.html
grep -c "sh-summary-bar" docs/plan-status.html
```

Expected: `pv-hero-section` count ≥ 2 (Status + Stakeholder); `sh-summary-bar` count = 0.

Open `docs/plan-status.html` in a browser. Navigate to the Stakeholder tab and confirm the hero section renders at the top.

- [ ] **Step 9: Mark US-0162 and US-0163 in RELEASE_PLAN.md (or create if not yet registered)**

After verifying the implementation works, check `docs/ID_REGISTRY.md` for the next story IDs. Create story entries if they don't exist, or update existing ones to `Status: Done`.

- [ ] **Step 10: Mark BUG entries in BUGS.md if any bugs were discovered and fixed during implementation**

Use next available BUG ID from `docs/ID_REGISTRY.md`.

- [ ] **Step 11: Commit**

```bash
git add tools/lib/render-tabs.js tests/unit/render-tabs.test.js docs/plan-status.html docs/plan-status.json
git commit -m "[feat] US-0163: add Status hero section to Stakeholder tab; remove redundant summary bar"
```

---

## Task 5: Open PR and close

- [ ] **Step 1: Run full suite one final time**

```bash
npx jest --coverage 2>&1 | tail -10
```

All pass, ≥80%.

- [ ] **Step 2: Check Prettier**

```bash
npx prettier --check tools/lib/render-tabs.js tools/lib/render-html.js tests/unit/render-tabs.test.js tests/unit/parse-release-plan.test.js
```

Fix any issues: `npx prettier --write <file>`.

- [ ] **Step 3: Open PR**

```bash
git push -u origin feature/US-0162-stakeholder-hero-epic-dates
gh pr create \
  --title "feat: US-0162/US-0163 — Epic dates + Stakeholder hero" \
  --body "$(cat <<'EOF'
## Summary
- **US-0162**: Add `StartDate`/`DoneDate` fields to epic blocks in RELEASE_PLAN.md; parser extracts them as `startDate`/`doneDate` (null when absent); Stakeholder tab epic rows display formatted date range
- **US-0163**: Replace Stakeholder tab summary bar with full Status tab hero (Release Health verdict, sparklines, KPI tiles, Overall Progress, Epic Progress, Top Risks, This Week); removes redundant summary bar

## Test plan
- [ ] `npx jest --coverage` passes ≥80%
- [ ] Stakeholder tab shows Release Health hero at top
- [ ] Stakeholder tab epic rows show date ranges (e.g. `Mar 11, 2026 → Apr 13, 2026`)
- [ ] `sh-summary-bar` no longer present in generated HTML

🤖 Generated with [Claude Code](https://claude.com/claude-code)
EOF
)" \
  --base develop
```

- [ ] **Step 4: Enable auto-merge**

```bash
gh pr merge <PR-number> --squash --delete-branch --auto
```
