# Plan-Status Quality Sweep Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix BUG-0183, BUG-0184, BUG-0223 — make the Status tab hero prominent and accurate, unify chart colours across all tabs, and confirm the Bugs tab collapse behaviour is correct.

**Architecture:** All three bugs are in `tools/lib/render-tabs.js`. BUG-0223 is already fixed in code (card view has `class="hidden"` and `▶`) — Task 1 just adds a regression test and marks it Fixed. BUG-0184 and BUG-0183 require edits to `_renderFullStatusHero()` (~line 773), tested via `renderStatusTab()` which calls it. One PR, one branch: `bugfix/BUG-0183-0184-0223-plan-status-quality`.

**Tech Stack:** Node.js, Jest 30, `tools/lib/render-tabs.js`, `tests/unit/render-tabs.test.js`

**Spec:** `docs/superpowers/specs/2026-05-01-plan-status-quality-sweep-design.md`

---

## File Map

| File                             | Change                                                                  |
| -------------------------------- | ----------------------------------------------------------------------- |
| `tools/lib/render-tabs.js`       | BUG-0184 colour fixes + BUG-0183 hero layout in `_renderFullStatusHero` |
| `tests/unit/render-tabs.test.js` | New tests for all 3 bugs                                                |
| `docs/BUGS.md`                   | BUG-0183, BUG-0184, BUG-0223 marked Fixed                               |
| `docs/LESSONS.md`                | L-0053 added                                                            |
| `docs/ID_REGISTRY.md`            | L-0053 assigned, L-0054 next                                            |

---

## Task 1: BUG-0223 — Regression test + mark Fixed

**Files:**

- Modify: `tests/unit/render-tabs.test.js`
- Modify: `docs/BUGS.md`

**Context:** BUG-0223 ("Bugs tab card view epic groups expanded by default") is already fixed in the code — `renderBugsTab` already renders card-view group content with `class="p-3 hidden"` and arrow spans with `▶`. Task 1 adds a regression test so this doesn't silently regress, then marks the bug Fixed.

`renderBugsTab` is exported from `render-tabs.js` and requires a `data` object with `epics`, `stories`, `bugs`, `costs`, `trends`, and `lessons` fields.

- [ ] **Step 1.1: Write the regression test**

Add this `describe` block to `tests/unit/render-tabs.test.js`, after the existing tests:

```javascript
const { renderBugsTab } = require('../../tools/lib/render-tabs');

const mkBugsData = () => ({
  epics: [
    { id: 'EPIC-0001', title: 'Core', status: 'In Progress' },
    { id: 'EPIC-0002', title: 'UX', status: 'Planned' },
  ],
  stories: [
    { id: 'US-0001', epicId: 'EPIC-0001', title: 'Parser', status: 'Done', acs: [] },
    { id: 'US-0002', epicId: 'EPIC-0002', title: 'Nav', status: 'Planned', acs: [] },
  ],
  bugs: [
    { id: 'BUG-0001', title: 'Parser crash', severity: 'High', status: 'Open', relatedStory: 'US-0001', fixBranch: '' },
    { id: 'BUG-0002', title: 'Nav overflow', severity: 'Low', status: 'Open', relatedStory: 'US-0002', fixBranch: '' },
    {
      id: 'BUG-0003',
      title: 'Old bug',
      severity: 'Low',
      status: 'Fixed',
      relatedStory: 'US-0001',
      fixBranch: 'feature/fix',
    },
  ],
  costs: { _totals: { costUsd: 0 } },
  trends: null,
  lessons: [],
  snapshots: [],
  completion: null,
  coverage: null,
  risk: null,
});

describe('renderBugsTab — BUG-0223 regression', () => {
  let html;
  beforeAll(() => {
    html = renderBugsTab(mkBugsData());
  });

  test('BUG-0223: card-view epic group content is hidden by default', () => {
    // bugs-card-ep-EPIC-0001 content div must have class hidden
    expect(html).toMatch(/id="bugs-card-ep-EPIC-0001"[^>]*class="[^"]*hidden/);
  });

  test('BUG-0223: card-view epic group arrow shows ▶ not ▼', () => {
    // arrow span for bugs-card-ep-EPIC-0001 must contain ▶
    expect(html).toContain('id="bugs-card-ep-EPIC-0001-arrow"');
    const arrowIdx = html.indexOf('id="bugs-card-ep-EPIC-0001-arrow"');
    const arrowSnippet = html.slice(arrowIdx, arrowIdx + 80);
    expect(arrowSnippet).toContain('▶');
    expect(arrowSnippet).not.toContain('▼');
  });
});
```

- [ ] **Step 1.2: Run the tests to confirm they pass**

```bash
npx jest tests/unit/render-tabs.test.js --no-coverage -t "BUG-0223" 2>&1 | tail -8
```

Expected: 2 PASSes (bug is already fixed in code — we're confirming it works and adding the regression guard).

- [ ] **Step 1.3: Mark BUG-0223 Fixed in docs/BUGS.md**

Find the BUG-0223 entry and change:

```
Status: Open
Fix Branch:
Lesson Encoded: No
```

to:

```
Status: Fixed
Fix Branch: bugfix/BUG-0183-0184-0223-plan-status-quality
Lesson Encoded: No
```

- [ ] **Step 1.4: Commit**

```bash
git add tests/unit/render-tabs.test.js docs/BUGS.md
git commit -m "test: BUG-0223 — add regression guard for Bugs tab card-view collapse; mark Fixed

Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>"
```

---

## Task 2: BUG-0184 — Replace var(--plan-accent) with ok-green in status hero

**Files:**

- Modify: `tools/lib/render-tabs.js` (~lines 820–870, inside `_renderFullStatusHero`)
- Modify: `tests/unit/render-tabs.test.js`

**Context:** `_renderFullStatusHero` is a private function called by both `renderStatusTab` and `renderStakeholderTab`. It's not exported directly — test it via `renderStatusTab`. The function uses `var(--plan-accent)` (violet) for two things: the progress sparkline bars (done-story count bars) and the burn-up SVG. Both should be `oklch(66% 0.17 145)` (green = `pvChartColors.ok`) because they represent "done" work.

The exact strings to find and replace in `_renderFullStatusHero`:

1. Progress bars: `color-mix(in oklab,var(--plan-accent) ${Math.max(pct, 8)}%,var(--border))`
2. Burn SVG gradient stop: `stop-color="var(--plan-accent)"`
3. Burn SVG stroke: `stroke="var(--plan-accent)"`

- [ ] **Step 2.1: Write failing tests**

Add to `tests/unit/render-tabs.test.js` after the BUG-0223 block:

```javascript
const { renderStatusTab } = require('../../tools/lib/render-tabs');

const mkStatusData = () => ({
  ...mkBugsData(),
  completion: { likelyDate: '2026-05-28', rangeStart: '2026-05-21', rangeEnd: '2026-06-04', velocityWeeks: 4 },
  coverage: { overall: 93.0, available: true },
  trends: {
    dates: ['2026-04-01', '2026-04-08', '2026-04-15', '2026-04-22', '2026-04-29'],
    doneCounts: [2, 3, 4, 5, 6],
    totalStories: [10, 10, 10, 10, 10],
    coverage: [85, 88, 90, 92, 93],
    openBugs: [5, 4, 4, 3, 2],
    aiCosts: [10, 20, 35, 50, 65],
    velocity: [1, 2, 1, 2, 1],
    atRisk: [1, 1, 0, 0, 0],
  },
  risk: null,
  snapshots: [],
  recentActivity: [],
});

describe('renderStatusTab — BUG-0184 palette regression', () => {
  let html;
  beforeAll(() => {
    html = renderStatusTab(mkStatusData());
  });

  test('BUG-0184: progress sparkline bars do not use var(--plan-accent)', () => {
    // The color-mix for progress bars must not reference --plan-accent
    const progressBarMatch = html.match(/color-mix\(in oklab,[^)]+\)/g) || [];
    progressBarMatch.forEach((cm) => {
      expect(cm).not.toContain('plan-accent');
    });
  });

  test('BUG-0184: burn SVG stroke does not use var(--plan-accent)', () => {
    expect(html).not.toMatch(/stroke="var\(--plan-accent\)"/);
  });

  test('BUG-0184: burn SVG stop-color does not use var(--plan-accent)', () => {
    expect(html).not.toMatch(/stop-color="var\(--plan-accent\)"/);
  });

  test('BUG-0184: progress bars use oklch ok-green', () => {
    expect(html).toContain('oklch(66% 0.17 145)');
  });
});
```

- [ ] **Step 2.2: Run to confirm failures**

```bash
npx jest tests/unit/render-tabs.test.js --no-coverage -t "BUG-0184" 2>&1 | tail -10
```

Expected: 3–4 FAILures (plan-accent still present).

- [ ] **Step 2.3: Fix progress sparkline bars in \_renderFullStatusHero**

In `tools/lib/render-tabs.js`, inside `_renderFullStatusHero` (~line 828), find:

```javascript
style =
  'width:8px;background:color-mix(in oklab,var(--plan-accent) ${Math.max(pct, 8)}%,var(--border));border-radius:2px;height:${Math.max(Math.round((doneCounts[i] / maxDone) * 32), 4)}px;align-self:flex-end;flex-shrink:0';
```

Replace with:

```javascript
style =
  'width:8px;background:color-mix(in oklab,oklch(66% 0.17 145) ${Math.max(pct, 8)}%,var(--border));border-radius:2px;height:${Math.max(Math.round((doneCounts[i] / maxDone) * 32), 4)}px;align-self:flex-end;flex-shrink:0';
```

- [ ] **Step 2.4: Fix burn SVG gradient and stroke**

In the same `_renderFullStatusHero`, find the `burnUpSvg` IIFE (~line 855). Replace:

```javascript
stop-color="var(--plan-accent)" stop-opacity="0.35"/>
<stop offset="100%" stop-color="var(--plan-accent)" stop-opacity="0.03"/>
```

with:

```javascript
stop-color="oklch(66% 0.17 145)" stop-opacity="0.35"/>
<stop offset="100%" stop-color="oklch(66% 0.17 145)" stop-opacity="0.03"/>
```

And replace:

```javascript
stroke="var(--plan-accent)" stroke-width="1.5"
```

with:

```javascript
stroke="oklch(66% 0.17 145)" stroke-width="1.5"
```

- [ ] **Step 2.5: Run tests to confirm they pass**

```bash
npx jest tests/unit/render-tabs.test.js --no-coverage -t "BUG-0184" 2>&1 | tail -8
```

Expected: 4 PASSes.

- [ ] **Step 2.6: Run full unit suite**

```bash
npx jest tests/unit/ --no-coverage 2>&1 | tail -5
```

Expected: all pass.

- [ ] **Step 2.7: Commit**

```bash
git add tools/lib/render-tabs.js tests/unit/render-tabs.test.js
git commit -m "fix: BUG-0184 — replace var(--plan-accent) with oklch ok-green in status hero charts

Progress sparkline bars and burn SVG now use oklch(66% 0.17 145) (pvChartColors.ok)
instead of var(--plan-accent) (violet). Done-story count = green everywhere.

Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>"
```

---

## Task 3: BUG-0183 — Status hero prominence

**Files:**

- Modify: `tools/lib/render-tabs.js` (~lines 773–810, inside `_renderFullStatusHero`)
- Modify: `tests/unit/render-tabs.test.js`

**Context:** Four changes to `_renderFullStatusHero`:

1. Replace the small verdict chip with a 28px headline + "Release Health" eyebrow
2. Move forecast banner (likelyDate / range / velocity) before the sparkline columns
3. Increase sparkline bar max height from 32 → 48px; SVG H from 44 → 56
4. Replace "No history" / "No data" plain-text fallbacks with placeholder bars so the layout holds when `data.trends` is sparse

The function currently renders: `[verdict chip] [narrative] [3-col sparklines] [forecast row] [KPI tiles]`

After fix: `[eyebrow] [28px verdict] [narrative] [forecast banner] [3-col sparklines] [KPI tiles]`

- [ ] **Step 3.1: Write failing tests**

Add to `tests/unit/render-tabs.test.js`:

```javascript
describe('renderStatusTab — BUG-0183 hero prominence', () => {
  let html, htmlNoTrends;
  beforeAll(() => {
    html = renderStatusTab(mkStatusData());
    htmlNoTrends = renderStatusTab({ ...mkStatusData(), trends: null, completion: null });
  });

  test('BUG-0183: verdict uses 28px font-size', () => {
    expect(html).toContain('font-size:28px');
  });

  test('BUG-0183: "Release Health" eyebrow is present', () => {
    expect(html).toContain('Release Health');
  });

  test('BUG-0183: forecast banner appears before sparkline section', () => {
    const forecastIdx = html.indexOf('likely date');
    const sparklineIdx = html.indexOf('14 snapshots');
    expect(forecastIdx).toBeGreaterThan(-1);
    expect(sparklineIdx).toBeGreaterThan(-1);
    expect(forecastIdx).toBeLessThan(sparklineIdx);
  });

  test('BUG-0183: sparkline bar height uses 48 not 32', () => {
    // The height formula uses the max value 48
    expect(html).toMatch(/doneCounts\[i\] \/ maxDone\) \* 48|Math\.round.*\* 48/);
    // or check the rendered number appears in a height style
    expect(html).not.toMatch(/\* 32\b/);
  });

  test('BUG-0183: sparse-data fallback does not show "No history"', () => {
    expect(htmlNoTrends).not.toContain('No history');
    expect(htmlNoTrends).not.toContain('No data');
  });

  test('BUG-0183: forecast unavailable message shown when comp is null', () => {
    expect(htmlNoTrends).toContain('Forecast unavailable');
  });
});
```

- [ ] **Step 3.2: Run to confirm failures**

```bash
npx jest tests/unit/render-tabs.test.js --no-coverage -t "BUG-0183" 2>&1 | tail -10
```

Expected: 5–6 FAILures.

- [ ] **Step 3.3: Replace the verdict chip with eyebrow + 28px headline**

In `_renderFullStatusHero` (~line 803), find the section that renders the verdict. It currently produces a `<div class="pv-verdict-section">` or similar with a chip. Replace the entire verdict + narrative block with:

```javascript
return `<div style="border:1px solid var(--border);border-radius:12px;padding:20px 24px;margin-bottom:16px;background:var(--bg-card,var(--surface))">
    <div style="font-size:10px;font-weight:700;letter-spacing:.1em;text-transform:uppercase;color:var(--text-mute);margin-bottom:6px">Release Health</div>
    <div style="font-family:var(--font-display,system-ui);font-size:28px;font-weight:800;line-height:1;color:${verdictColor};margin-bottom:8px">${verdict}</div>
    <p style="font-size:13px;color:var(--text-secondary);margin-bottom:14px">${narrative}</p>
    ${forecastBanner}
    ${sparklineCols}
    ${kpiTiles}
  </div>`;
```

Where `forecastBanner` and `sparklineCols` are constructed earlier in the function (see steps 3.4 and 3.5).

**Note:** The exact structure of the existing return statement varies — read the current code around line 900–960 to find the return block, then replace it entirely with the structure above.

- [ ] **Step 3.4: Build the forecast banner variable**

Before the return statement, define `forecastBanner`:

```javascript
const forecastBanner = comp
  ? `<div style="display:flex;gap:0;background:var(--surface);border:1px solid var(--border);border-radius:8px;overflow:hidden;margin-bottom:14px">
        <div style="flex:1;padding:8px 12px;border-right:1px solid var(--border)">
          <div style="font-size:8px;color:var(--text-mute);text-transform:uppercase;letter-spacing:.07em;margin-bottom:3px">Forecast</div>
          <div style="font-size:14px;font-weight:700">${esc(forecastLabel)}</div>
          <div style="font-size:9px;color:var(--text-mute);margin-top:1px">likely date</div>
        </div>
        <div style="flex:1;padding:8px 12px;border-right:1px solid var(--border)">
          <div style="font-size:8px;color:var(--text-mute);text-transform:uppercase;letter-spacing:.07em;margin-bottom:3px">Range</div>
          <div style="font-size:12px;font-weight:700">${esc(rangeLabel)}</div>
          <div style="font-size:9px;color:var(--text-mute);margin-top:1px">80% confidence</div>
        </div>
        <div style="flex:1;padding:8px 12px">
          <div style="font-size:8px;color:var(--text-mute);text-transform:uppercase;letter-spacing:.07em;margin-bottom:3px">Velocity</div>
          <div style="font-size:14px;font-weight:700">${esc(velocityLabel)}</div>
          <div style="font-size:9px;color:var(--text-mute);margin-top:1px">rolling avg</div>
        </div>
      </div>`
  : `<div style="font-size:11px;color:var(--text-mute);font-style:italic;margin-bottom:14px;padding:8px 12px;background:var(--surface);border:1px solid var(--border);border-radius:8px">Forecast unavailable — insufficient velocity data</div>`;
```

- [ ] **Step 3.5: Increase sparkline bar height to 48px and fix SVG height**

Inside the `progressBars` IIFE, change `* 32` → `* 48`:

```javascript
// BEFORE:
height:${Math.max(Math.round((doneCounts[i] / maxDone) * 32), 4)}px
// AFTER:
height:${Math.max(Math.round((doneCounts[i] / maxDone) * 48), 4)}px
```

Inside the `burnUpSvg` IIFE, change `H = 44` → `H = 56`:

```javascript
// BEFORE:
const W = 200,
  H = 44;
// AFTER:
const W = 200,
  H = 56;
```

- [ ] **Step 3.6: Replace plain-text fallbacks with placeholder bars**

In the `progressBars` IIFE, change the early-return when data is sparse:

```javascript
// BEFORE:
if (!trends || !trends.dates || trends.dates.length < 2)
  return '<span style="font-size:11px;color:var(--text-mute)">No history</span>';
// AFTER:
if (!trends || !trends.dates || trends.dates.length < 2)
  return Array(14)
    .fill(null)
    .map(
      () =>
        `<div style="width:8px;background:var(--border);border-radius:2px;height:4px;align-self:flex-end;flex-shrink:0"></div>`,
    )
    .join('');
```

In the `coverageDots` IIFE, change the early-return:

```javascript
// BEFORE:
if (!trends || !trends.dates || trends.dates.length < 2)
  return '<span style="font-size:11px;color:var(--text-mute)">No history</span>';
// AFTER:
if (!trends || !trends.dates || trends.dates.length < 2)
  return Array(20)
    .fill(null)
    .map(
      () =>
        `<span style="display:inline-block;width:6px;height:6px;border-radius:50%;background:var(--border);margin:1px;opacity:0.3"></span>`,
    )
    .join('');
```

In the `burnUpSvg` IIFE, change the early-return:

```javascript
// BEFORE:
if (!trends || !trends.velocity || trends.velocity.length < 2)
  return '<span style="font-size:11px;color:var(--text-mute)">No data</span>';
// AFTER:
if (!trends || !trends.velocity || trends.velocity.length < 2)
  return `<svg viewBox="0 0 200 56" style="width:100%;height:56px" aria-hidden="true">
    <line x1="0" y1="52" x2="200" y2="52" stroke="var(--border)" stroke-width="1"/>
  </svg>`;
```

- [ ] **Step 3.7: Build the sparklineCols variable**

The existing return likely inlines the three sparkline columns. Refactor so they're a named variable before the return. Extract the three-column layout into `sparklineCols`:

```javascript
const sparklineCols = `<div style="display:grid;grid-template-columns:repeat(3,1fr);gap:10px;margin-bottom:14px">
    <div class="card" style="padding:12px">
      <div style="font-size:9px;font-weight:700;letter-spacing:.08em;text-transform:uppercase;color:var(--text-mute);margin-bottom:6px">Progress · 14 snapshots</div>
      <div style="display:flex;align-items:flex-end;gap:2px;height:48px">${progressBars}</div>
    </div>
    <div class="card" style="padding:12px">
      <div style="font-size:9px;font-weight:700;letter-spacing:.08em;text-transform:uppercase;color:var(--text-mute);margin-bottom:6px">Coverage · last 30</div>
      <div style="display:flex;flex-wrap:wrap;align-content:center;min-height:48px">${coverageDots}</div>
    </div>
    <div class="card" style="padding:12px">
      <div style="font-size:9px;font-weight:700;letter-spacing:.08em;text-transform:uppercase;color:var(--text-mute);margin-bottom:6px">Burn · cumulative</div>
      ${burnUpSvg}
    </div>
  </div>`;
```

**Note:** The existing return statement already has these three columns inlined. Find them and replace with `${sparklineCols}` in the return, after moving the content into this variable.

- [ ] **Step 3.8: Run tests to confirm they pass**

```bash
npx jest tests/unit/render-tabs.test.js --no-coverage -t "BUG-0183" 2>&1 | tail -10
```

Expected: 6 PASSes.

- [ ] **Step 3.9: Run full unit suite**

```bash
npx jest tests/unit/ --no-coverage 2>&1 | tail -5
```

Expected: all pass.

- [ ] **Step 3.10: Commit**

```bash
git add tools/lib/render-tabs.js tests/unit/render-tabs.test.js
git commit -m "fix: BUG-0183 — status hero 28px verdict, forecast above sparklines, 48px bars, sparse fallbacks

Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>"
```

---

## Task 4: Documentation + PR

**Files:**

- Modify: `docs/BUGS.md`
- Modify: `docs/LESSONS.md`
- Modify: `docs/ID_REGISTRY.md`

- [ ] **Step 4.1: Mark BUG-0183 and BUG-0184 Fixed in docs/BUGS.md**

For BUG-0183, find and change:

```
Status: Open
Fix Branch:
Lesson Encoded: No
```

to:

```
Status: Fixed
Fix Branch: bugfix/BUG-0183-0184-0223-plan-status-quality
Lesson Encoded: Yes
```

For BUG-0184, same change.

- [ ] **Step 4.2: Add L-0053 to docs/LESSONS.md**

Append to the end of `docs/LESSONS.md`:

```markdown
---

## L-0053 — Shared helper functions benefit from visual consistency audits at call sites

**Context:** `_renderFullStatusHero` is called from both `renderStatusTab` and `renderStakeholderTab`. When it used `var(--plan-accent)` (violet) for progress bars, both tabs showed violet "done" bars while the Charts/Trends tabs correctly used green for the same concept. The drift went unnoticed because the function only had one call site originally and no semantic-colour test.

**Fix:** Replace raw CSS token references in chart-colour positions with the correct semantic OKLCH literal. Audit every spot that uses a colour token for a chart element and ask: does this colour's meaning match the semantic intent?

**Prevention:** When writing a helper that renders charts or colour-coded data, add a test that asserts no `var(--plan-accent)` / `var(--live-accent)` appears in colour-bearing attributes (stroke, fill, background). These raw tokens are layout chrome — not data semantics.

**Bugs:** BUG-0183, BUG-0184
**Date:** 2026-05-01
```

- [ ] **Step 4.3: Update docs/ID_REGISTRY.md**

Change the Lesson row:

```
| Lesson       | L-0053                | L-0052            |
```

to:

```
| Lesson       | L-0054                | L-0053            |
```

- [ ] **Step 4.4: Run full test suite with coverage**

```bash
npx jest tests/unit/ --coverage 2>&1 | tail -10
```

Expected: all pass, ≥80% statement coverage.

- [ ] **Step 4.5: Create branch, commit docs, push, open PR**

```bash
git checkout -b bugfix/BUG-0183-0184-0223-plan-status-quality
git add docs/BUGS.md docs/LESSONS.md docs/ID_REGISTRY.md
git commit -m "docs: BUG-0183 BUG-0184 BUG-0223 Fixed; L-0053 visual consistency audit lesson

Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>"
git push -u origin bugfix/BUG-0183-0184-0223-plan-status-quality
gh pr create \
  --title "fix: BUG-0183/0184/0223 — status hero prominence + chart palette + bugs collapse" \
  --base develop \
  --body "$(cat <<'EOF'
## Summary

- **BUG-0223:** Bugs tab card-view epic groups already collapsed in code — added regression test, marked Fixed
- **BUG-0184:** Status hero progress bars + burn SVG changed from \`var(--plan-accent)\` (violet) to \`oklch(66% 0.17 145)\` (green = pvChartColors.ok). Done-story count = green everywhere across all tabs.
- **BUG-0183:** Status/Stakeholder hero improvements: 28px verdict headline, "Release Health" eyebrow, forecast banner promoted above sparklines, bar max height 32px → 48px, SVG H 44 → 56, sparse-data fallbacks replaced with placeholder bars

## Test plan
- [ ] \`npx jest tests/unit/ --coverage\` — all pass, ≥80% coverage
- [ ] Open plan-status.html → Status tab: "Release Health" eyebrow visible, verdict large, forecast above sparklines
- [ ] Open plan-status.html → Status tab sparklines: bars are green (not violet)
- [ ] Open plan-status.html → Bugs tab → switch to Card view: all groups collapsed on load

🤖 Generated with [Claude Code](https://claude.com/claude-code)
EOF
)"
gh pr merge --auto --squash --delete-branch
```

---

## Self-Review

**Spec coverage:**

- BUG-0223 card/compact collapse: Task 1 ✓ (compact already collapsed too; regression test added for card view)
- BUG-0184 progress bars colour: Task 2, Step 2.3 ✓
- BUG-0184 burn SVG stroke + gradient: Task 2, Step 2.4 ✓
- BUG-0184 coverage dots: Spec says change `var(--ok)` → OKLCH literals — these are semantically correct already; no change needed (kept out of scope per spec's "semantically correct" note) ✓
- BUG-0183 verdict 28px: Task 3, Step 3.3 ✓
- BUG-0183 eyebrow: Task 3, Step 3.3 ✓
- BUG-0183 forecast above sparklines: Task 3, Steps 3.4 + 3.3 ✓
- BUG-0183 48px bars: Task 3, Step 3.5 ✓
- BUG-0183 SVG H 56: Task 3, Step 3.5 ✓
- BUG-0183 sparse fallbacks: Task 3, Step 3.6 ✓
- BUGS.md + LESSONS.md + ID_REGISTRY: Task 4 ✓

**Placeholder scan:** Step 3.3 says "read the current code around line 900–960 to find the return block" — this is a direction not a placeholder. The implementer must read the file to locate the exact return. No TBDs. ✓

**Type consistency:** `mkBugsData()` defined in Task 1 is reused by `mkStatusData()` in Task 2 via spread — consistent. `forecastBanner`, `sparklineCols`, `progressBars`, `coverageDots`, `burnUpSvg` are all local variables in `_renderFullStatusHero` — consistent with existing code. ✓
