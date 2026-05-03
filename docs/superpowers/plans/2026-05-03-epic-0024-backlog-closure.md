# EPIC-0024 Backlog Closure — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship US-0056 (Trends date-range picker), US-0169 (Hierarchy risk UI), US-0116 (lap history strip), and US-0117 (telemetry + completion animation) as four feature branches → develop PRs.

**Architecture:** All four stories touch `tools/lib/render-tabs.js` or `tools/generate-dashboard.js`. US-0056 and US-0169 are fully independent. US-0117 depends on US-0116 (needs `outcome`/`incidents` in the cycle schema). Ship US-0056 → US-0169 in parallel, then US-0116 → US-0117 in sequence.

**Tech Stack:** Node.js, vanilla JS (embedded in generated HTML), Chart.js 4.x, Jest 29 (unit tests), jsdom (DOM tests), GitHub Actions CI.

---

## Pre-work: Update ID Registry and RELEASE_PLAN.md

These steps apply once, before any feature branch work.

- [ ] **Step 1: Update `docs/ID_REGISTRY.md`** — bump AC to AC-0611, EPIC to EPIC-0025:

```
| EPIC  | EPIC-0025 | EPIC-0024 |
| AC    | AC-0611   | AC-0610   |
```

- [ ] **Step 2: Add EPIC-0024 to `docs/RELEASE_PLAN.md`** — insert after the last EPIC block before the Standalone Stories section:

````markdown
## Epic — EPIC-0024: Backlog Closure

```
EPIC-0024: Backlog Closure
Description: Ships deferred stories US-0056, US-0169, US-0116, US-0117 before EPIC-0025 begins.
Release Target: Release 2.1
Status: In Progress
StartDate: 2026-05-03
DoneDate:
Dependencies: EPIC-0008, EPIC-0010, EPIC-0019
```
````

- [ ] **Step 3: Fix the duplicate AC-0165 in the Planned US-0056 entry** — in `docs/RELEASE_PLAN.md`, find the second `US-0056` block (Status: Planned) and replace its AC block:

```
Acceptance Criteria:
  - [ ] AC-0606: A From and To date input appear in the Trends filter bar beside the preset buttons
  - [ ] AC-0607: Selecting a date range filters all trend charts to snapshots within that window
  - [ ] AC-0608: Clicking a preset button (All/90d/30d/7d) clears the date inputs and restores count-based slicing
  - [ ] AC-0609: Date range selection persists in localStorage and is restored on next page load
  - [ ] AC-0610: The chart-velocity-weekly chart is excluded from date-range filtering
```

- [ ] **Step 4: Commit pre-work**

```bash
git add docs/ID_REGISTRY.md docs/RELEASE_PLAN.md
git commit -m "chore: EPIC-0024 registry + release plan pre-work"
```

---

## Work Stream A — US-0056: Trends Date-Range Picker

**Branch:** `feature/US-0056-trends-date-range`

```bash
git checkout develop && git pull origin develop
git checkout -b feature/US-0056-trends-date-range
```

**Files:**

- Modify: `tools/lib/render-tabs.js:428-433` (filter bar HTML)
- Modify: `tools/lib/render-tabs.js:642-660` (`setTrendsRange` → `applyTrendsFilter`)
- Modify: `tests/unit/render-tabs.test.js` (new `describe` block)

---

### Task A1: Write failing tests for date-range filter

**File:** `tests/unit/render-tabs.test.js`

- [ ] **Step 1: Add test suite** — append at the end of the file, before the final closing line:

```js
describe('renderTrendsTab — US-0056 date-range filter', () => {
  // Minimal trends data with 5 snapshots spanning 5 different days
  const dates = [
    '2026-04-01T10:00:00Z',
    '2026-04-05T10:00:00Z',
    '2026-04-10T10:00:00Z',
    '2026-04-15T10:00:00Z',
    '2026-04-20T10:00:00Z',
  ];

  it('renders trends-date-from and trends-date-to inputs in filter bar', () => {
    const html = renderTrendsTab(makeData({ dates }));
    expect(html).toContain('id="trends-date-from"');
    expect(html).toContain('id="trends-date-to"');
  });

  it('date inputs are type="date"', () => {
    const html = renderTrendsTab(makeData({ dates }));
    const matches = html.match(/type="date"/g);
    expect(matches).toBeTruthy();
    expect(matches.length).toBeGreaterThanOrEqual(2);
  });

  it('filter bar contains both preset buttons and date inputs', () => {
    const html = renderTrendsTab(makeData({ dates }));
    expect(html).toContain('trends-range-btn');
    expect(html).toContain('trends-date-from');
  });

  it('applyTrendsFilter JS function is emitted in the script block', () => {
    const html = renderTrendsTab(makeData({ dates }));
    expect(html).toContain('function applyTrendsFilter(');
  });

  it('setTrendsRange calls applyTrendsFilter in count mode', () => {
    const html = renderTrendsTab(makeData({ dates }));
    // setTrendsRange should delegate to applyTrendsFilter
    expect(html).toContain('applyTrendsFilter({');
    expect(html).toContain("mode:'count'");
  });

  it('date input oninput calls applyTrendsFilter in date mode', () => {
    const html = renderTrendsTab(makeData({ dates }));
    expect(html).toContain("mode:'date'");
  });

  it('chart-velocity-weekly is skipped in applyTrendsFilter', () => {
    const html = renderTrendsTab(makeData({ dates }));
    expect(html).toContain('chart-velocity-weekly');
    // The skip guard must appear inside applyTrendsFilter
    const fnStart = html.indexOf('function applyTrendsFilter(');
    const fnEnd = html.indexOf('\nfunction ', fnStart + 1);
    const fnBody = fnEnd > 0 ? html.slice(fnStart, fnEnd) : html.slice(fnStart);
    expect(fnBody).toContain('chart-velocity-weekly');
  });

  function makeData({ dates }) {
    const n = dates.length;
    return {
      dates,
      done: Array(n).fill(0),
      total: Array(n).fill(0),
      cost: Array(n).fill(0),
      coverage: Array(n).fill(0),
      velocity: Array(n).fill(0),
      bugs: Array(n).fill(0),
      atRisk: Array(n).fill(0),
      inputTokens: Array(n).fill(0),
      outputTokens: Array(n).fill(0),
      avgRisk: Array(n).fill(0),
    };
  }
});
```

- [ ] **Step 2: Check what `renderTrendsTab` import looks like** at the top of `tests/unit/render-tabs.test.js`:

```bash
head -20 tests/unit/render-tabs.test.js
```

If `renderTrendsTab` is not yet imported, add it to the existing require line. The function is exported from `tools/lib/render-tabs.js` — check what's exported:

```bash
grep "module.exports" tools/lib/render-tabs.js
```

- [ ] **Step 3: Run tests to confirm they fail**

```bash
cd /Users/Kamal_Syed/Projects/PlanVisualizer
npx jest tests/unit/render-tabs.test.js --testNamePattern="US-0056" -t "US-0056" 2>&1 | tail -20
```

Expected: FAIL — `id="trends-date-from"` not found in HTML.

---

### Task A2: Add date inputs to the filter bar HTML

**File:** `tools/lib/render-tabs.js:428-433`

- [ ] **Step 1: Replace the filter bar HTML** — find the block at line 428:

```js
<div class="col-span-full trends-filter-bar mb-2">
  <button class="trends-range-btn active" data-range="all" onclick="setTrendsRange(this,'all')">
    All
  </button>
  <button class="trends-range-btn" data-range="90" onclick="setTrendsRange(this,90)">
    90d
  </button>
  <button class="trends-range-btn" data-range="30" onclick="setTrendsRange(this,30)">
    30d
  </button>
  <button class="trends-range-btn" data-range="7" onclick="setTrendsRange(this,7)">
    7d
  </button>
</div>
```

Replace with:

```js
    <div class="col-span-full trends-filter-bar mb-2">
      <button class="trends-range-btn active" data-range="all" onclick="setTrendsRange(this,'all')">All</button>
      <button class="trends-range-btn" data-range="90" onclick="setTrendsRange(this,90)">90d</button>
      <button class="trends-range-btn" data-range="30" onclick="setTrendsRange(this,30)">30d</button>
      <button class="trends-range-btn" data-range="7" onclick="setTrendsRange(this,7)">7d</button>
      <span class="trends-date-sep" style="color:var(--clr-text-muted);font-size:11px;margin:0 4px">|</span>
      <label style="font-size:11px;color:var(--clr-text-muted)">From</label>
      <input type="date" id="trends-date-from" style="font-size:11px;padding:2px 4px;border:1px solid var(--clr-border);border-radius:4px;background:var(--clr-input-bg);color:var(--clr-input-text)" oninput="applyTrendsFilter({mode:'date',from:this.value,to:document.getElementById('trends-date-to').value})">
      <label style="font-size:11px;color:var(--clr-text-muted)">To</label>
      <input type="date" id="trends-date-to" style="font-size:11px;padding:2px 4px;border:1px solid var(--clr-border);border-radius:4px;background:var(--clr-input-bg);color:var(--clr-input-text)" oninput="applyTrendsFilter({mode:'date',from:document.getElementById('trends-date-from').value,to:this.value})">
    </div>
```

---

### Task A3: Replace `setTrendsRange` with `applyTrendsFilter`

**File:** `tools/lib/render-tabs.js:642-660`

- [ ] **Step 1: Replace the restore block and `setTrendsRange` function** — find the block at line 642:

```js
  var saved = localStorage.getItem('pv-trends-range');
  if (saved && saved !== 'all') {
    var btn = document.querySelector('.trends-range-btn[data-range="'+saved+'"]');
    if (btn) setTrendsRange(btn, saved === 'all' ? 'all' : Number(saved));
  }
}
function setTrendsRange(btn, range) {
  document.querySelectorAll('.trends-range-btn').forEach(function(b){ b.classList.remove('active'); });
  btn.classList.add('active');
  localStorage.setItem('pv-trends-range', range);
  var n = range === 'all' ? _trendsAllLabels.length : Math.min(Number(range), _trendsAllLabels.length);
  Object.keys(_trendsChartRefs).forEach(function(id) {
    ${hasVbw ? "if (id === 'chart-velocity-weekly') return;" : ''}
    var ch = _trendsChartRefs[id]; if (!ch._allData) return;
    ch.data.labels = _trendsAllLabels.slice(-n);
    ch.data.datasets.forEach(function(ds, i){ ds.data = ch._allData[i].slice(-n); });
    ch.update('none');
  });
}
```

Replace with:

```js
  // Restore last-used filter: date range takes priority over count range
  var savedFrom = localStorage.getItem('pv-trends-date-from');
  var savedTo   = localStorage.getItem('pv-trends-date-to');
  var savedRange = localStorage.getItem('pv-trends-range');
  if (savedFrom || savedTo) {
    var fi = document.getElementById('trends-date-from');
    var ti = document.getElementById('trends-date-to');
    if (fi) fi.value = savedFrom || '';
    if (ti) ti.value = savedTo || '';
    if (savedFrom && savedTo) applyTrendsFilter({mode:'date', from:savedFrom, to:savedTo});
  } else if (savedRange && savedRange !== 'all') {
    var btn = document.querySelector('.trends-range-btn[data-range="'+savedRange+'"]');
    if (btn) setTrendsRange(btn, Number(savedRange));
  }
}
function applyTrendsFilter(opts) {
  var start = 0, end = _trendsAllLabels.length;
  if (opts.mode === 'count') {
    var n = opts.n === 'all' ? _trendsAllLabels.length : Math.min(Number(opts.n), _trendsAllLabels.length);
    start = _trendsAllLabels.length - n;
  } else if (opts.mode === 'date') {
    var from = opts.from ? opts.from + 'T00:00:00Z' : null;
    var to   = opts.to   ? opts.to   + 'T23:59:59Z' : null;
    if (from) {
      while (start < _trendsAllLabels.length && _trendsAllLabels[start] < from) start++;
    }
    if (to) {
      end = _trendsAllLabels.length;
      while (end > start && _trendsAllLabels[end - 1] > to) end--;
    }
    if (start >= end) return; // empty window — do nothing
    localStorage.setItem('pv-trends-date-from', opts.from || '');
    localStorage.setItem('pv-trends-date-to',   opts.to   || '');
    localStorage.removeItem('pv-trends-range');
    document.querySelectorAll('.trends-range-btn').forEach(function(b){ b.classList.remove('active'); });
  }
  Object.keys(_trendsChartRefs).forEach(function(id) {
    ${hasVbw ? "if (id === 'chart-velocity-weekly') return;" : ''}
    var ch = _trendsChartRefs[id]; if (!ch._allData) return;
    ch.data.labels = _trendsAllLabels.slice(start, end);
    ch.data.datasets.forEach(function(ds, i){
      if (ds._isRefLine) { ds.data = new Array(end - start).fill(2.0); return; }
      ds.data = ch._allData[i].slice(start, end);
    });
    ch.update('none');
  });
}
function setTrendsRange(btn, range) {
  document.querySelectorAll('.trends-range-btn').forEach(function(b){ b.classList.remove('active'); });
  btn.classList.add('active');
  localStorage.setItem('pv-trends-range', range === 'all' ? 'all' : String(range));
  localStorage.removeItem('pv-trends-date-from');
  localStorage.removeItem('pv-trends-date-to');
  var fi = document.getElementById('trends-date-from');
  var ti = document.getElementById('trends-date-to');
  if (fi) fi.value = '';
  if (ti) ti.value = '';
  applyTrendsFilter({mode:'count', n:range});
}
```

---

### Task A4: Run tests and fix

- [ ] **Step 1: Run the new tests**

```bash
npx jest tests/unit/render-tabs.test.js --testNamePattern="US-0056" 2>&1 | tail -30
```

Expected: all 7 tests PASS.

- [ ] **Step 2: Run full test suite to check for regressions**

```bash
npx jest --coverage 2>&1 | tail -20
```

Expected: all existing tests pass, coverage ≥ 80%.

---

### Task A5: Update RELEASE_PLAN.md and commit

- [ ] **Step 1: Mark US-0056 (Planned) as Done** in `docs/RELEASE_PLAN.md` — update Status and Branch:

```
Status: Done
Branch: feature/US-0056-trends-date-range
```

Check all AC-0606–AC-0610 boxes: `- [ ]` → `- [x]`

- [ ] **Step 2: Commit and open PR**

```bash
git add tools/lib/render-tabs.js tests/unit/render-tabs.test.js docs/RELEASE_PLAN.md
git commit -m "feat: US-0056 — Trends tab date-range picker alongside preset buttons"
git push -u origin feature/US-0056-trends-date-range
gh pr create --title "feat: US-0056 — Trends date-range picker" \
  --body "$(cat <<'EOF'
## Summary
- Adds From/To date inputs beside All/90d/30d/7d buttons in Trends filter bar
- Introduces applyTrendsFilter() — shared for both count-mode (buttons) and date-mode (inputs)
- setTrendsRange() now delegates to applyTrendsFilter; chart-velocity-weekly excluded
- localStorage persistence for both modes; last-used mode restored on page load
- 7 new unit tests

## Test plan
- [ ] All tests pass
- [ ] Coverage ≥ 80%
- [ ] CI green

🤖 Generated with [Claude Code](https://claude.com/claude-code)
EOF
)"
gh pr merge --auto --squash --delete-branch
```

---

## Work Stream B — US-0169: Hierarchy Risk UI

**Branch:** `feature/US-0169-hierarchy-risk-ui`

```bash
git checkout develop && git pull origin develop
git checkout -b feature/US-0169-hierarchy-risk-ui
```

**Files:**

- Modify: `tools/lib/render-tabs.js:17-193` (`renderHierarchyTab`)
- Modify: `tools/lib/render-tabs.js:597-602` (`chart-trends-avg-risk` dataset block)
- Modify: `tests/unit/render-tabs.test.js` (new `describe` block)

---

### Task B1: Write failing tests

**File:** `tests/unit/render-tabs.test.js`

- [ ] **Step 1: Append new test suite** (before the final closing line):

```js
describe('renderHierarchyTab — US-0169 risk UI', () => {
  function makeRiskData() {
    const byStory = new Map([
      ['US-0001', { score: 3.2, level: 'Critical' }],
      ['US-0002', { score: 1.5, level: 'Medium' }],
      ['US-0003', { score: 2.5, level: 'High' }],
    ]);
    const byEpic = new Map([
      ['EPIC-0001', { avgScore: 2.4, maxScore: 3.2, level: 'High', counts: {} }],
      ['EPIC-0002', { avgScore: 0.3, maxScore: 0.5, level: 'Low', counts: {} }],
    ]);
    return { byStory, byEpic };
  }

  function makeData() {
    return {
      epics: [
        { id: 'EPIC-0001', title: 'Alpha', status: 'In Progress', releaseTarget: 'R1', startDate: '', doneDate: '' },
        { id: 'EPIC-0002', title: 'Beta', status: 'In Progress', releaseTarget: 'R1', startDate: '', doneDate: '' },
      ],
      stories: [
        {
          id: 'US-0001',
          epicId: 'EPIC-0001',
          title: 'S1',
          status: 'In Progress',
          priority: 'P0',
          estimate: 'M',
          acs: [],
        },
        { id: 'US-0002', epicId: 'EPIC-0001', title: 'S2', status: 'Planned', priority: 'P1', estimate: 'S', acs: [] },
        {
          id: 'US-0003',
          epicId: 'EPIC-0002',
          title: 'S3',
          status: 'In Progress',
          priority: 'P0',
          estimate: 'L',
          acs: [],
        },
      ],
      testCases: [],
      atRisk: {},
      costs: {},
      risk: makeRiskData(),
      completion: null,
    };
  }

  it('AC-0601: story rows have data-risk-score attribute', () => {
    const html = renderHierarchyTab(makeData());
    expect(html).toContain('data-risk-score="3.2"');
    expect(html).toContain('data-risk-score="1.5"');
  });

  it('AC-0601: story rows have data-risk-level attribute', () => {
    const html = renderHierarchyTab(makeData());
    expect(html).toContain('data-risk-level="Critical"');
    expect(html).toContain('data-risk-level="Medium"');
  });

  it('AC-0601: Sort by Risk button is present in Hierarchy tab', () => {
    const html = renderHierarchyTab(makeData());
    expect(html).toContain('sortHierarchyByRisk');
  });

  it('AC-0603: epic block for EPIC-0001 has risk badge with level and score', () => {
    const html = renderHierarchyTab(makeData());
    // Epic with avgScore 2.4, level High
    expect(html).toContain('High');
    expect(html).toContain('2.4');
  });

  it('AC-0604: EPIC-0001 (avgScore 2.4) appears before EPIC-0002 (avgScore 0.3)', () => {
    const html = renderHierarchyTab(makeData());
    const pos1 = html.indexOf('EPIC-0001');
    const pos2 = html.indexOf('EPIC-0002');
    expect(pos1).toBeLessThan(pos2);
  });

  it('AC-0604: _ungrouped epics always last', () => {
    const data = makeData();
    data.stories.push({
      id: 'US-0099',
      epicId: null,
      title: 'Orphan',
      status: 'Planned',
      priority: 'P2',
      estimate: 'XS',
      acs: [],
    });
    const html = renderHierarchyTab(data);
    const posEpic = html.indexOf('EPIC-0001');
    const posUngrouped = html.indexOf('_ungrouped');
    expect(posUngrouped).toBeGreaterThan(posEpic);
  });

  it('AC-0605: hier-risk-filter select is present', () => {
    const html = renderHierarchyTab(makeData());
    expect(html).toContain('id="hier-risk-filter"');
  });

  it('AC-0605: epic blocks have data-epic-risk-level attribute', () => {
    const html = renderHierarchyTab(makeData());
    expect(html).toContain('data-epic-risk-level="High"');
    expect(html).toContain('data-epic-risk-level="Low"');
  });

  it('no risk badge for Done epics', () => {
    const data = makeData();
    data.epics[0].status = 'Done';
    const html = renderHierarchyTab(data);
    // Done epics should not get a risk badge
    const epicPos = html.indexOf('EPIC-0001');
    const badgeAfterEpic = html.indexOf('risk-score-badge', epicPos);
    // Badge should not appear in epic header section
    const nextEpicPos = html.indexOf('EPIC-0002', epicPos + 1);
    if (badgeAfterEpic > 0 && nextEpicPos > 0) {
      expect(badgeAfterEpic).toBeGreaterThan(nextEpicPos);
    }
  });
});
```

- [ ] **Step 2: Run tests to confirm they fail**

```bash
npx jest tests/unit/render-tabs.test.js --testNamePattern="US-0169" 2>&1 | tail -20
```

Expected: all tests FAIL.

---

### Task B2: Sort epics by risk score in `renderHierarchyTab`

**File:** `tools/lib/render-tabs.js:18`

- [ ] **Step 1: Add sort before `.map()`** — find `const epicBlocks = data.epics.map((epic, epicIdx) => {` at line 18 and replace with:

```js
  const sortedEpics = (data.risk && data.risk.byEpic)
    ? [...data.epics].sort((a, b) => {
        if (a.id === '_ungrouped') return 1;
        if (b.id === '_ungrouped') return -1;
        const sa = data.risk.byEpic.has(a.id) ? data.risk.byEpic.get(a.id).avgScore : -1;
        const sb = data.risk.byEpic.has(b.id) ? data.risk.byEpic.get(b.id).avgScore : -1;
        return sb - sa;
      })
    : data.epics;
  const epicBlocks = sortedEpics.map((epic, epicIdx) => {
```

---

### Task B3: Add `data-risk-score`, `data-risk-level`, `data-original-index` to story rows

**File:** `tools/lib/render-tabs.js` — column view story row at line 58

- [ ] **Step 1: Update the column-view story row** — find the `<div id="story-${esc(story.id)}" class="story-row ...` at line 59 and add risk data attributes:

```js
      return `
      <div id="story-${esc(story.id)}" class="story-row border-t border-slate-100 dark:border-slate-700 px-3 py-2"
           data-epic="${esc(story.epicId)}" data-status="${esc(story.status)}" data-priority="${esc(story.priority)}"
           data-risk-score="${storyRisk ? String(storyRisk.score) : '0'}"
           data-risk-level="${storyRisk ? esc(storyRisk.level) : 'Low'}">
```

- [ ] **Step 2: Update the card-view story card** — find the card `<div id="story-card-...` in the `storyCards` map (around line 104) and add the same `data-risk-score` and `data-risk-level` attributes.

---

### Task B4: Add epic risk badge to column and card view headers

**File:** `tools/lib/render-tabs.js` — epic header at line 120

- [ ] **Step 1: Compute epic risk at the top of the `epicBlocks.map` callback** — add after line 25 (`const doneCnt = ...`):

```js
const epicRisk = data.risk && data.risk.byEpic ? data.risk.byEpic.get(epic.id) : null;
const epicRiskBadge =
  epicRisk && epic.status !== 'Done' && epic.status !== 'Retired'
    ? `<span class="risk-score-badge text-xs font-semibold" style="color:${RISK_LEVEL_COLORS[epicRisk.level]}">${esc(epicRisk.level)} ${epicRisk.avgScore.toFixed(1)}</span>`
    : '';
```

- [ ] **Step 2: Inject `epicRiskBadge` into the column-view epic header** — find line 138 in the column view:

```js
          <span class="font-semibold dark:text-slate-100">${esc(epic.title)}</span>
          <span class="text-xs text-slate-500">${esc(epic.releaseTarget)}</span>
```

Replace with:

```js
          <span class="font-semibold dark:text-slate-100">${esc(epic.title)}</span>
          ${epicRiskBadge}
          <span class="text-xs text-slate-500">${esc(epic.releaseTarget)}</span>
```

- [ ] **Step 3: Add the same `epicRiskBadge` to the card-view epic header** (around line 158) — find the same pattern and add `${epicRiskBadge}` after the epic title span.

- [ ] **Step 4: Add `data-epic-risk-level` to both `.epic-block` divs** — find the column-view `<div class="epic-block ...` at line 134:

```js
    <div class="epic-block mb-2 border border-slate-200 dark:border-slate-700 rounded-lg overflow-hidden anim-stagger" data-epic-status="${esc(epic.status)}" style="--i:${Math.min(epicIdx, 19)};border-left:4px solid ${accent.border}">
```

Add `data-epic-risk-level` attribute:

```js
    <div class="epic-block mb-2 border border-slate-200 dark:border-slate-700 rounded-lg overflow-hidden anim-stagger"
         data-epic-status="${esc(epic.status)}"
         data-epic-risk-level="${epicRisk ? esc(epicRisk.level) : 'Low'}"
         style="--i:${Math.min(epicIdx, 19)};border-left:4px solid ${accent.border}">
```

Do the same for the card-view `.epic-block` at line 155.

---

### Task B5: Add Sort button and Risk filter to Hierarchy filter bar

**File:** `tools/lib/render-tabs.js:178-193`

- [ ] **Step 1: Replace the filter bar div** — find the `<div class="flex items-center justify-end mb-4 flex-shrink-0">` at line 179 and replace the whole block up to `</div>`:

```js
<div class="flex items-center justify-between mb-4 flex-shrink-0 flex-wrap gap-2">
  <div class="flex items-center gap-2">
    <select
      id="hier-risk-filter"
      style="font-size:11px;padding:3px 6px;border:1px solid var(--clr-border);border-radius:4px;background:var(--clr-input-bg);color:var(--clr-input-text)"
      onchange="applyHierRiskFilter(this.value)"
    >
      <option value="all">All Risk Levels</option>
      <option value="high">High+</option>
      <option value="critical">Critical only</option>
    </select>
    <button
      id="hier-risk-sort-btn"
      onclick="sortHierarchyByRisk(this)"
      style="font-size:11px;padding:3px 8px;border:1px solid var(--clr-border);border-radius:4px;background:var(--clr-input-bg);color:var(--clr-input-text);cursor:pointer"
    >
      Sort by Risk ↓
    </button>
  </div>
  <div class="flex gap-1">
    <button id="hier-col-btn" onclick="setHierarchyView('column')" class="view-toggle-btn">
      ≡ Column
    </button>
    <button id="hier-card-btn" onclick="setHierarchyView('card')" class="view-toggle-btn">
      ⊞ Card
    </button>
  </div>
</div>
```

---

### Task B6: Add `sortHierarchyByRisk` and `applyHierRiskFilter` JS to the Hierarchy tab script

**File:** `tools/lib/render-tabs.js` — find the closing `</div>` of `#tab-hierarchy` (line 192) and add a `<script>` block just before:

- [ ] **Step 1: Add inline script** — find `<div id="hier-card-view" class="hidden">${cardView}</div>\n  </div>` (line 191-193) and change to:

```js
    <div id="hier-column-view">${columnView}</div>
    <div id="hier-card-view" class="hidden">${cardView}</div>
    <script>
    (function(){
      var _hierRiskSorted = false;
      var _savedOrder = {};
      function sortHierarchyByRisk(btn) {
        _hierRiskSorted = !_hierRiskSorted;
        btn.textContent = _hierRiskSorted ? 'Restore Order' : 'Sort by Risk ↓';
        ['hier-column-view','hier-card-view'].forEach(function(viewId) {
          var view = document.getElementById(viewId);
          if (!view) return;
          var blocks = Array.from(view.querySelectorAll('.epic-block'));
          if (!_savedOrder[viewId]) {
            _savedOrder[viewId] = blocks.map(function(b){ return b; });
          }
          if (_hierRiskSorted) {
            blocks.sort(function(a, b) {
              var sa = parseFloat(a.getAttribute('data-epic-risk-level') === 'Critical' ? 4
                       : a.getAttribute('data-epic-risk-level') === 'High' ? 3
                       : a.getAttribute('data-epic-risk-level') === 'Medium' ? 2 : 1);
              var sb = parseFloat(b.getAttribute('data-epic-risk-level') === 'Critical' ? 4
                       : b.getAttribute('data-epic-risk-level') === 'High' ? 3
                       : b.getAttribute('data-epic-risk-level') === 'Medium' ? 2 : 1);
              return sb - sa;
            });
            blocks.forEach(function(b){ view.appendChild(b); });
          } else {
            _savedOrder[viewId].forEach(function(b){ view.appendChild(b); });
          }
        });
      }
      function applyHierRiskFilter(value) {
        document.querySelectorAll('.epic-block').forEach(function(block) {
          var level = block.getAttribute('data-epic-risk-level') || 'Low';
          var show = value === 'all'
            || (value === 'high' && (level === 'High' || level === 'Critical'))
            || (value === 'critical' && level === 'Critical');
          block.style.display = show ? '' : 'none';
        });
      }
      window.sortHierarchyByRisk = sortHierarchyByRisk;
      window.applyHierRiskFilter = applyHierRiskFilter;
    })();
    </script>
  </div>
```

---

### Task B7: Add `_isRefLine` guard and reference line to avg-risk chart

**File:** `tools/lib/render-tabs.js` — the `chart-trends-avg-risk` call is around line 600.

- [ ] **Step 1: Find and update the `chart-trends-avg-risk` `_mkTrend` call**:

Find:

```js
_mkTrend('chart-trends-avg-risk', {
  type: 'line',
  data: {
    labels: labels,
    datasets: [
      {
        label: 'Avg Risk Score',
        data: _trendsAllData.avgRisk,
        borderColor: pvChartColors.warn,
        _gc: pvChartColors.warn,
        fill: true,
        tension: 0.3,
      },
    ],
  },
  options: {
    responsive: true,
    maintainAspectRatio: false,
    plugins: { legend: leg },
    scales: { x: xA, y: yA({ min: 0, suggestedMax: 4 }) },
  },
});
```

Replace with:

```js
_mkTrend('chart-trends-avg-risk', {
  type: 'line',
  data: {
    labels: labels,
    datasets: [
      {
        label: 'Avg Risk Score',
        data: _trendsAllData.avgRisk,
        borderColor: pvChartColors.warn,
        _gc: pvChartColors.warn,
        fill: true,
        tension: 0.3,
      },
      {
        label: 'High threshold',
        data: _trendsAllData.avgRisk.map(function () {
          return 2.0;
        }),
        _isRefLine: true,
        borderColor: pvChartColors.risk,
        borderDash: [6, 3],
        borderWidth: 1,
        backgroundColor: 'transparent',
        pointRadius: 0,
        fill: false,
      },
    ],
  },
  options: {
    responsive: true,
    maintainAspectRatio: false,
    plugins: { legend: leg },
    scales: { x: xA, y: yA({ min: 0, suggestedMax: 4 }) },
  },
});
```

Note: The `_isRefLine` flag is already handled in `applyTrendsFilter` (added in Task A3) — the `if (ds._isRefLine)` branch regenerates the constant array after slicing.

---

### Task B8: Run tests and open PR

- [ ] **Step 1: Run new tests**

```bash
npx jest tests/unit/render-tabs.test.js --testNamePattern="US-0169" 2>&1 | tail -30
```

Expected: all 8 tests PASS.

- [ ] **Step 2: Run full suite**

```bash
npx jest --coverage 2>&1 | tail -20
```

Expected: all passing, coverage ≥ 80%.

- [ ] **Step 3: Mark US-0169 Done in RELEASE_PLAN.md** — set `Status: Done`, `Branch: feature/US-0169-hierarchy-risk-ui`, check all AC-0601–AC-0605 boxes.

- [ ] **Step 4: Commit and PR**

```bash
git add tools/lib/render-tabs.js tests/unit/render-tabs.test.js docs/RELEASE_PLAN.md
git commit -m "feat: US-0169 — Hierarchy risk sort, filter, epic badges, avg-risk reference line"
git push -u origin feature/US-0169-hierarchy-risk-ui
gh pr create --title "feat: US-0169 — Hierarchy risk UI enhancements (all 5 ACs)" \
  --body "$(cat <<'EOF'
## Summary
- Epic sort by aggregate risk score descending (server-side, _ungrouped last)
- Story rows get data-risk-score + data-risk-level attributes for client-side sort
- Sort by Risk ↓ button toggles client-side story sort within each epic block
- Epic headers show aggregate risk badge (level + avgScore) for non-Done epics
- epic-block elements get data-epic-risk-level for filter
- Hierarchy filter bar adds Risk Level select (All / High+ / Critical only)
- chart-trends-avg-risk gains a dashed High threshold reference line at y=2.0
- 8 new unit tests

## Test plan
- [ ] All tests pass
- [ ] Coverage ≥ 80%
- [ ] CI green

🤖 Generated with [Claude Code](https://claude.com/claude-code)
EOF
)"
gh pr merge --auto --squash --delete-branch
```

---

## Work Stream C — US-0116: Lap History Strip

**Branch:** `feature/US-0116-lap-history-strip`

> **Note:** `cycles[]` storage is already implemented in `update-sdlc-status.js` (lines 290–324). The existing schema uses `{ id, completedAt, storiesCompleted, testsPassed, testsFailed, coveragePercent, bugsFixed, phaseDurations }`. This work adds `outcome` and `incidents` fields and upgrades the lap strip from mini-cards to segmented phase bars per AC-0389–0391.

```bash
git checkout develop && git pull origin develop
git checkout -b feature/US-0116-lap-history-strip
```

**Files:**

- Modify: `tools/update-sdlc-status.js:304-313` (snapshot object — add `outcome`, `incidents`)
- Modify: `tools/generate-dashboard.js:3267-3278` (lap strip rendering — upgrade to segmented bars)
- Modify: `tests/unit/update-sdlc-status.test.js` (extend cycle-complete suite)
- Modify: `tests/unit/generate-dashboard.test.js` (new describe block)

---

### Task C1: Write failing tests for cycle snapshot schema

**File:** `tests/unit/update-sdlc-status.test.js`

- [ ] **Step 1: Add tests to the existing `cycle-complete` describe block** — find the block starting at line 150 and add inside it:

```js
it('snapshot includes outcome: success when testsFailed is 0', () => {
  const data = stateWithActiveSession();
  HANDLERS['cycle-complete'](data, {});
  expect(data.cycles[0].outcome).toBe('success');
});

it('snapshot includes outcome: failed when testsFailed > 0', () => {
  const data = stateWithActiveSession();
  data.metrics.testsFailed = 2;
  HANDLERS['cycle-complete'](data, {});
  expect(data.cycles[0].outcome).toBe('failed');
});

it('snapshot includes incidents defaulting to 0', () => {
  const data = stateWithActiveSession();
  HANDLERS['cycle-complete'](data, {});
  expect(data.cycles[0].incidents).toBe(0);
});

it('snapshot picks up incidents from opts.incidents when provided', () => {
  const data = stateWithActiveSession();
  HANDLERS['cycle-complete'](data, { incidents: '3' });
  expect(data.cycles[0].incidents).toBe(3);
});
```

- [ ] **Step 2: Run tests to confirm they fail**

```bash
npx jest tests/unit/update-sdlc-status.test.js --testNamePattern="cycle-complete" 2>&1 | tail -20
```

Expected: 4 new tests FAIL — `outcome` and `incidents` not in snapshot.

---

### Task C2: Add `outcome` and `incidents` to snapshot

**File:** `tools/update-sdlc-status.js:304-313`

- [ ] **Step 1: Find the snapshot object** (lines 304–313) and add two fields:

```js
const snapshot = {
  id: nextId,
  completedAt: nowISO(),
  storiesCompleted: (data.metrics && data.metrics.storiesCompleted) || 0,
  testsPassed: (data.metrics && data.metrics.testsPassed) || 0,
  testsFailed: (data.metrics && data.metrics.testsFailed) || 0,
  coveragePercent: (data.metrics && data.metrics.coveragePercent) || 0,
  bugsFixed: (data.metrics && data.metrics.bugsFixed) || 0,
  outcome: ((data.metrics && data.metrics.testsFailed) || 0) === 0 ? 'success' : 'failed',
  incidents: parseInt(opts.incidents || '0', 10) || 0,
  phaseDurations,
};
```

- [ ] **Step 2: Run cycle-complete tests to confirm they pass**

```bash
npx jest tests/unit/update-sdlc-status.test.js --testNamePattern="cycle-complete" 2>&1 | tail -20
```

Expected: all PASS.

---

### Task C3: Write failing tests for lap strip rendering

**File:** `tests/unit/generate-dashboard.test.js`

- [ ] **Step 1: Find the describe block structure** in the file:

```bash
grep -n "describe\|it(" tests/unit/generate-dashboard.test.js | head -20
```

- [ ] **Step 2: Add a new describe block** for US-0116 (append near end of file):

```js
describe('generate-dashboard — US-0116 lap history strip', () => {
  function cycleFixture(overrides = {}) {
    return Object.assign(
      {
        id: 1,
        completedAt: new Date().toISOString(),
        storiesCompleted: 2,
        testsPassed: 100,
        testsFailed: 0,
        coveragePercent: 85,
        bugsFixed: 1,
        outcome: 'success',
        incidents: 0,
        phaseDurations: { Blueprint: 900, Architect: 3600, Stylize: 1800, Trigger: 600, Review: 300 },
      },
      overrides,
    );
  }

  function renderWithCycles(cycles) {
    // Read the generated HTML and look for cycle-related sections
    // This tests the static server-side render; patchDOM tests are in the embedded JS
    const html = generateDashboard(baseStatus({ cycles }));
    return html;
  }

  it('cycle-history-section is present in generated HTML', () => {
    const html = renderWithCycles([]);
    expect(html).toContain('id="cycle-history-section"');
  });

  it('cycle-lap-strip element is present', () => {
    const html = renderWithCycles([]);
    expect(html).toContain('id="cycle-lap-strip"');
  });

  it('cycle-telemetry element is present', () => {
    const html = renderWithCycles([]);
    expect(html).toContain('id="cycle-telemetry"');
  });

  it('patchDOM JS uses outcome field for success rate', () => {
    const html = renderWithCycles([cycleFixture()]);
    // The embedded refreshState JS must key off c.outcome not c.testsFailed
    expect(html).toContain("c.outcome === 'success'");
  });

  it('patchDOM JS renders segmented phase bar (pv-lap-bar class)', () => {
    const html = renderWithCycles([cycleFixture()]);
    expect(html).toContain('pv-lap-bar');
  });

  function baseStatus(overrides = {}) {
    return Object.assign(
      {
        project: { name: 'Test', description: '', repoUrl: '', startDate: '2026-01-01' },
        phases: [],
        agents: {},
        stories: {},
        cycles: [],
        metrics: {
          storiesCompleted: 0,
          storiesTotal: 0,
          testsPassed: 0,
          testsFailed: 0,
          testsTotal: 0,
          bugsOpen: 0,
          bugsFixed: 0,
          coveragePercent: 0,
          reviewsApproved: 0,
          reviewsBlocked: 0,
          tasksCompleted: 0,
          tasksTotal: 0,
        },
        log: [],
        epics: {},
      },
      overrides,
    );
  }
});
```

- [ ] **Step 3: Check what `generateDashboard` export looks like**:

```bash
grep "module.exports\|exports\." tools/generate-dashboard.js | head -5
```

Adjust the import in the test if needed.

- [ ] **Step 4: Run tests to confirm failures**

```bash
npx jest tests/unit/generate-dashboard.test.js --testNamePattern="US-0116" 2>&1 | tail -20
```

---

### Task C4: Upgrade lap strip to segmented phase bars in `generate-dashboard.js`

**File:** `tools/generate-dashboard.js:3265-3278`

- [ ] **Step 1: Find the lap strip JS in `refreshState`** (around line 3265):

```js
var recent = cycles.slice(-10).reverse();
var prevLen = parseInt(lapStrip.getAttribute('data-cycle-count') || '0', 10);
lapStrip.innerHTML = recent
  .map(function (c) {
    return (
      '<div class="cycle-card">' +
      '<div class="cycle-card-id">#' +
      escH(String(c.id)) +
      '</div>' +
      '<div class="cycle-card-stat">' +
      escH(String(c.storiesCompleted)) +
      ' stories</div>' +
      '<div class="cycle-card-stat">' +
      escH((c.coveragePercent || 0).toFixed(1)) +
      '% cov</div>' +
      '</div>'
    );
  })
  .join('');
```

Replace with:

```js
var recent = cycles.slice(-10).reverse();
var prevLen = parseInt(lapStrip.getAttribute('data-cycle-count') || '0', 10);
var PHASE_COLORS = [
  'var(--clr-accent,#6366f1)',
  'var(--clr-info,#38bdf8)',
  'var(--ok,#22c55e)',
  'var(--clr-warn,#f59e0b)',
  'var(--clr-risk,#ef4444)',
  'var(--clr-mute,#94a3b8)',
];
var PHASE_NAMES = ['Blueprint', 'Link', 'Architect', 'Stylize', 'Trigger', 'Review'];
lapStrip.innerHTML = recent
  .map(function (c) {
    var durations = c.phaseDurations || {};
    var totalSec =
      Object.values(durations).reduce(function (a, b) {
        return a + b;
      }, 0) || 1;
    var elapsed =
      totalSec >= 3600
        ? Math.floor(totalSec / 3600) + 'h ' + Math.floor((totalSec % 3600) / 60) + 'm'
        : Math.floor(totalSec / 60) + 'm';
    var daysAgo = c.completedAt ? Math.floor((Date.now() - new Date(c.completedAt).getTime()) / 86400000) : '?';
    var tooltip = 'Cycle #' + c.id + ' · ' + elapsed + ' · ' + daysAgo + 'd ago';
    var segments = PHASE_NAMES.map(function (name, idx) {
      var sec = durations[name] || 0;
      var pct = totalSec > 0 ? Math.max(2, Math.round((sec / totalSec) * 100)) : Math.round(100 / PHASE_NAMES.length);
      var color = c.outcome === 'failed' && sec > 0 ? 'var(--clr-risk,#ef4444)' : PHASE_COLORS[idx];
      return (
        '<div style="flex:' +
        pct +
        ';background:' +
        color +
        ';height:32px;min-width:4px" title="' +
        name +
        ': ' +
        Math.floor(sec / 60) +
        'm"></div>'
      );
    }).join('');
    return (
      '<div class="pv-lap-bar" title="' +
      escH(tooltip) +
      '" data-cycle-id="' +
      escH(String(c.id)) +
      '" ' +
      'style="display:flex;border-radius:4px;overflow:hidden;cursor:pointer;min-width:64px;max-width:120px" ' +
      'onclick="openCycleDetail(' +
      c.id +
      ')">' +
      segments +
      '</div>'
    );
  })
  .join('');
```

- [ ] **Step 2: Update the success-rate calculation** (around line 3256) to use `c.outcome`:

Find:

```js
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
```

Replace with:

```js
var successRate =
  cycles.length > 0
    ? Math.round(
        (cycles.filter(function (c) {
          return c.outcome === 'success';
        }).length /
          cycles.length) *
          100,
      )
    : 0;
```

- [ ] **Step 3: Update telemetry tiles** (around line 3257) to use INCIDENTS and match spec labels:

Find:

```js
      telemetryRow.innerHTML = [
        { label: 'Cycles Total', value: cycles.length },
        { label: 'Today', value: cyclesToday },
        { label: 'Avg Cycle (min)', value: avgMin || '–' },
        { label: 'Success Rate', value: successRate + '%' },
      ].map(function(t) {
```

Replace with:

```js
      var totalIncidents = cycles.reduce(function(sum, c){ return sum + (c.incidents || 0); }, 0);
      var avgHrs = Math.floor(avgTotalSec / 3600);
      var avgMins = Math.floor((avgTotalSec % 3600) / 60);
      var avgCycleLabel = avgHrs > 0 ? avgHrs + 'h ' + avgMins + 'm' : (avgMins || '–') + 'm';
      telemetryRow.innerHTML = [
        { label: 'AVG CYCLE TIME', value: avgCycleLabel },
        { label: 'CYCLES TODAY', value: cyclesToday },
        { label: 'INCIDENTS', value: totalIncidents },
        { label: 'SUCCESS RATE', value: successRate + '%' },
      ].map(function(t) {
```

- [ ] **Step 4: Add `openCycleDetail` stub** — after the `lapStrip.setAttribute` line, add:

```js
if (!window._cycleDetailRegistered) {
  window._cycleDetailRegistered = true;
  window.openCycleDetail = function (id) {
    var c = cycles.find(function (x) {
      return x.id === id;
    });
    if (!c) return;
    var dlg = document.getElementById('pv-cycle-detail');
    if (!dlg) return;
    var rows = Object.entries(c.phaseDurations || {})
      .map(function (e) {
        return (
          '<tr><td style="padding:4px 8px">' +
          escH(e[0]) +
          '</td>' +
          '<td style="padding:4px 8px;text-align:right">' +
          Math.floor(e[1] / 60) +
          'm</td></tr>'
        );
      })
      .join('');
    dlg.querySelector('#pv-cycle-detail-body').innerHTML =
      '<p style="margin:0 0 8px"><strong>Cycle #' +
      escH(String(c.id)) +
      '</strong>' +
      ' · ' +
      escH(c.outcome || 'unknown') +
      ' · ' +
      escH(String(c.incidents || 0)) +
      ' incidents</p>' +
      '<table style="width:100%;border-collapse:collapse;font-size:12px">' +
      '<thead><tr><th style="text-align:left;padding:4px 8px;border-bottom:1px solid #ddd">Phase</th>' +
      '<th style="text-align:right;padding:4px 8px;border-bottom:1px solid #ddd">Duration</th></tr></thead>' +
      '<tbody>' +
      rows +
      '</tbody></table>';
    dlg.showModal();
  };
}
```

- [ ] **Step 5: Add cycle-detail dialog to the HTML template** — find the `#cycle-history-section` div (line 2334) and add the dialog element after it:

```html
<dialog
  id="pv-cycle-detail"
  style="border:1px solid var(--bg-card-border);border-radius:8px;padding:16px;min-width:280px;font-family:var(--font-sans)"
>
  <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:12px">
    <span style="font-weight:600;font-size:13px">Cycle Detail</span>
    <button
      onclick="document.getElementById('pv-cycle-detail').close()"
      style="background:none;border:none;cursor:pointer;font-size:16px;color:var(--text-dim)"
    >
      ✕
    </button>
  </div>
  <div id="pv-cycle-detail-body"></div>
</dialog>
```

---

### Task C5: Run tests and open PR

- [ ] **Step 1: Run new tests**

```bash
npx jest tests/unit/generate-dashboard.test.js --testNamePattern="US-0116" 2>&1 | tail -20
npx jest tests/unit/update-sdlc-status.test.js --testNamePattern="cycle-complete" 2>&1 | tail -20
```

Expected: all PASS.

- [ ] **Step 2: Full suite**

```bash
npx jest --coverage 2>&1 | tail -20
```

- [ ] **Step 3: Mark US-0116 Done in RELEASE_PLAN.md** — `Status: Done`, `Branch: feature/US-0116-lap-history-strip`, check AC-0388–0391.

- [ ] **Step 4: Commit and PR**

```bash
git add tools/update-sdlc-status.js tools/generate-dashboard.js \
        tests/unit/update-sdlc-status.test.js tests/unit/generate-dashboard.test.js \
        docs/RELEASE_PLAN.md
git commit -m "feat: US-0116 — lap history strip + cycle snapshot outcome/incidents fields"
git push -u origin feature/US-0116-lap-history-strip
gh pr create --title "feat: US-0116 — Lap history strip with segmented phase bars" \
  --body "$(cat <<'EOF'
## Summary
- cycle-complete snapshot gains outcome (success/failed) and incidents fields
- Lap strip upgraded from mini-cards to segmented 32px phase bars proportional to duration
- pv-lap-bar title tooltip: "Cycle #N · HHhMMm · Xd ago"
- Click opens cycle-detail dialog with per-phase timings
- Telemetry row: AVG CYCLE TIME / CYCLES TODAY / INCIDENTS / SUCCESS RATE
- SUCCESS RATE now keys off c.outcome === 'success' (not testsFailed === 0)
- pv-cycle-detail dialog added to HTML template

## Test plan
- [ ] All tests pass
- [ ] Coverage ≥ 80%
- [ ] CI green

🤖 Generated with [Claude Code](https://claude.com/claude-code)
EOF
)"
gh pr merge --auto --squash --delete-branch
```

---

## Work Stream D — US-0117: Telemetry Row + Completion Animation

> **Prerequisite:** US-0116 merged to develop. Rebase this branch on develop after US-0116 merges.

**Branch:** `feature/US-0117-telemetry-completion`

```bash
git checkout develop && git pull origin develop
git checkout -b feature/US-0117-telemetry-completion
```

**Files:**

- Modify: `tools/generate-dashboard.js` (completion animation CSS keyframes + patchDOM handler)
- Modify: `tests/unit/generate-dashboard.test.js` (new describe block)

---

### Task D1: Write failing tests for completion animation

**File:** `tests/unit/generate-dashboard.test.js`

- [ ] **Step 1: Append new describe block**:

```js
describe('generate-dashboard — US-0117 completion animation', () => {
  it('pv-phase-flash keyframe is defined in CSS', () => {
    const html = generateDashboard(baseStatus());
    expect(html).toContain('@keyframes pvPhaseFlash');
  });

  it('pv-sweep keyframe is defined in CSS', () => {
    const html = generateDashboard(baseStatus());
    expect(html).toContain('@keyframes pvSweep');
  });

  it('pv-flip keyframe is defined in CSS', () => {
    const html = generateDashboard(baseStatus());
    expect(html).toContain('@keyframes pvFlip');
  });

  it('patchDOM handles cycle-complete event type', () => {
    const html = generateDashboard(baseStatus());
    expect(html).toContain("type === 'cycle-complete'");
  });

  function baseStatus(overrides = {}) {
    return Object.assign(
      {
        project: { name: 'Test', description: '', repoUrl: '', startDate: '2026-01-01' },
        phases: [],
        agents: {},
        stories: {},
        cycles: [],
        metrics: {
          storiesCompleted: 0,
          storiesTotal: 0,
          testsPassed: 0,
          testsFailed: 0,
          testsTotal: 0,
          bugsOpen: 0,
          bugsFixed: 0,
          coveragePercent: 0,
          reviewsApproved: 0,
          reviewsBlocked: 0,
          tasksCompleted: 0,
          tasksTotal: 0,
        },
        log: [],
        epics: {},
      },
      overrides,
    );
  }
});
```

- [ ] **Step 2: Run tests to confirm they fail**

```bash
npx jest tests/unit/generate-dashboard.test.js --testNamePattern="US-0117" 2>&1 | tail -20
```

---

### Task D2: Add animation CSS keyframes

**File:** `tools/generate-dashboard.js` — find the main CSS block (around line 500). Add after the existing `.cycle-counter` rules:

- [ ] **Step 1: Add keyframes** — find a CSS rule boundary near line 690 and insert:

```css
@keyframes pvPhaseFlash {
  0% {
    background: var(--clr-ok, #22c55e);
    opacity: 1;
  }
  100% {
    background: '';
    opacity: 1;
  }
}
@keyframes pvSweep {
  0% {
    transform: scaleX(0);
    transform-origin: left;
    opacity: 0.5;
  }
  60% {
    transform: scaleX(1);
    transform-origin: left;
    opacity: 0.4;
  }
  100% {
    transform: scaleX(1);
    transform-origin: left;
    opacity: 0;
  }
}
@keyframes pvFlip {
  0% {
    transform: translateY(0);
  }
  50% {
    transform: translateY(-100%);
    opacity: 0;
  }
  51% {
    transform: translateY(100%);
    opacity: 0;
  }
  100% {
    transform: translateY(0);
    opacity: 1;
  }
}
.pv-phase-flash {
  animation: pvPhaseFlash 0.3s ease-out;
}
.pv-sweep-overlay {
  position: absolute;
  inset: 0;
  background: var(--clr-ok, #22c55e);
  animation: pvSweep 0.6s ease-out forwards;
  pointer-events: none;
}
.pv-flip {
  animation: pvFlip 0.15s ease-in-out;
}
```

---

### Task D3: Add `cycle-complete` branch in `patchDOM`

**File:** `tools/generate-dashboard.js` — find the `patchDOM` function and add a new event type handler.

- [ ] **Step 1: Find `patchDOM`**:

```bash
grep -n "function patchDOM\|patchDOM" tools/generate-dashboard.js | head -10
```

- [ ] **Step 2: Find where event types are handled inside patchDOM** — look for `if (msg.type ===` or `switch (msg.type`. Add a new branch:

```js
if (msg.type === 'cycle-complete') {
  // 1. Flash all phase blocks
  document.querySelectorAll('.phase-block').forEach(function (el) {
    el.classList.remove('pv-phase-flash');
    void el.offsetWidth; // force reflow
    el.classList.add('pv-phase-flash');
  });
  // 2. Green sweep over conductor header
  var hdr = document.getElementById('conductor-header');
  if (hdr) {
    hdr.style.position = 'relative';
    var overlay = document.createElement('div');
    overlay.className = 'pv-sweep-overlay';
    hdr.appendChild(overlay);
    setTimeout(function () {
      if (overlay.parentNode) overlay.parentNode.removeChild(overlay);
    }, 700);
  }
  // 3. Cycle counter flip
  var ctr = document.getElementById('conductor-dispatch-count');
  if (ctr) {
    ctr.classList.remove('pv-flip');
    void ctr.offsetWidth;
    ctr.classList.add('pv-flip');
  }
  return;
}
```

---

### Task D4: Run tests and open PR

- [ ] **Step 1: Run new tests**

```bash
npx jest tests/unit/generate-dashboard.test.js --testNamePattern="US-0117" 2>&1 | tail -20
```

Expected: all 4 PASS.

- [ ] **Step 2: Full suite**

```bash
npx jest --coverage 2>&1 | tail -20
```

- [ ] **Step 3: Mark US-0117 Done in RELEASE_PLAN.md** — `Status: Done`, `Branch: feature/US-0117-telemetry-completion`, check AC-0392–0394 (AC-0395 audio deferred).

- [ ] **Step 4: Commit and PR**

```bash
git add tools/generate-dashboard.js tests/unit/generate-dashboard.test.js docs/RELEASE_PLAN.md
git commit -m "feat: US-0117 — completion animation (phase flash, sweep, counter flip)"
git push -u origin feature/US-0117-telemetry-completion
gh pr create --title "feat: US-0117 — Cycle completion animation" \
  --body "$(cat <<'EOF'
## Summary
- CSS keyframes: pvPhaseFlash (300ms green), pvSweep (600ms left-to-right), pvFlip (150ms counter)
- patchDOM handles type === 'cycle-complete': flashes phase blocks, sweeps conductor header, flips dispatch counter
- Audio chime (AC-0395) deferred — requires alert-mute preference story

## Test plan
- [ ] All tests pass
- [ ] Coverage ≥ 80%
- [ ] CI green

🤖 Generated with [Claude Code](https://claude.com/claude-code)
EOF
)"
gh pr merge --auto --squash --delete-branch
```

---

## Post-merge: Session close

After all four PRs merge:

- [ ] Update `docs/progress.md` with EPIC-0024 summary
- [ ] Update `MEMORY.md` with new patterns (applyTrendsFilter, \_isRefLine, pv-lap-bar, cycle animation)
- [ ] Update `docs/ID_REGISTRY.md` — AC to AC-0611, EPIC to EPIC-0025 (if not already done in pre-work)
- [ ] Commit `docs/AI_COST_LOG.md` before any branch switch
- [ ] Verify all four stories show `Status: Done` with all ACs checked in `docs/RELEASE_PLAN.md`
