# EPIC-0010 Risk Analytics Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add composite risk scoring, risk charts, and a velocity-based completion banner to PlanVisualizer across four user stories (US-0064–US-0067).

**Architecture:** A new pure-function `compute-risk.js` module computes risk scores from stories + bugs and is wired into `generate-plan.js` before the render step. Risk data flows through the existing `data` object into four render touch-points: Hierarchy tab badges, Status tab charts, Trends tab avgRisk line, and a sub-topbar completion banner.

**Tech Stack:** Node.js, Jest (tests), Chart.js (Status/Trends chart canvases already in use)

---

## File Map

| File                              | Action     | Responsibility                                                                             |
| --------------------------------- | ---------- | ------------------------------------------------------------------------------------------ |
| `tools/lib/compute-risk.js`       | **CREATE** | Pure risk computation: `computeStoryRisk`, `computeAllRisk`, weight tables, `LEVEL_COLORS` |
| `tools/lib/snapshot.js`           | **MODIFY** | Add `avgRisk` field to `extractTrends()` output                                            |
| `tools/generate-plan.js`          | **MODIFY** | Call `computeAllRisk` → `data.risk`; call `computeCompletion` → `data.completion`          |
| `tools/lib/render-tabs.js`        | **MODIFY** | Story card risk badge (Hierarchy), risk charts + summary (Status), avgRisk chart (Trends)  |
| `tools/lib/render-shell.js`       | **MODIFY** | `renderCompletionBanner(data)` — sub-topbar completion strip                               |
| `tools/lib/render-html.js`        | **MODIFY** | Call `renderCompletionBanner` between topbar and app-shell                                 |
| `tests/unit/compute-risk.test.js` | **CREATE** | Unit tests for compute-risk module                                                         |
| `tests/unit/render-html.test.js`  | **MODIFY** | Regression cases for all new render features                                               |

---

## Task 1: Create `compute-risk.js` — `computeStoryRisk`

**Files:**

- Create: `tools/lib/compute-risk.js`
- Create: `tests/unit/compute-risk.test.js`

- [ ] **Step 1.1: Write the failing tests for `computeStoryRisk`**

Create `tests/unit/compute-risk.test.js`:

```js
'use strict';
const { computeStoryRisk } = require('../../tools/lib/compute-risk');

describe('computeStoryRisk', () => {
  it('P1 Blocked + Critical open bug → score 4.0, Critical', () => {
    const story = { priority: 'P1', status: 'Blocked' };
    const bugs = [{ severity: 'Critical', status: 'Open' }];
    const r = computeStoryRisk(story, bugs);
    // (4×0.4)+(4×0.3)+(4×0.3) = 1.6+1.2+1.2 = 4.0
    expect(r.score).toBe(4.0);
    expect(r.level).toBe('Critical');
  });

  it('P4 Done, no bugs → score 0.4, Low', () => {
    const story = { priority: 'P4', status: 'Done' };
    const r = computeStoryRisk(story);
    // (1×0.4)+(0×0.3)+(0×0.3) = 0.4
    expect(r.score).toBe(0.4);
    expect(r.level).toBe('Low');
  });

  it('no priority set defaults to weight 2 → score 1.1, Medium', () => {
    const story = { status: 'Planned' };
    const r = computeStoryRisk(story);
    // (2×0.4)+(0×0.3)+(1×0.3) = 0.8+0+0.3 = 1.1
    expect(r.score).toBe(1.1);
    expect(r.level).toBe('Medium');
  });

  it('Fixed/Retired/Cancelled bugs count as severity 0 → score 1.5', () => {
    const story = { priority: 'P2', status: 'Planned' };
    const bugs = [
      { severity: 'Critical', status: 'Fixed' },
      { severity: 'High', status: 'Retired' },
      { severity: 'Medium', status: 'Cancelled' },
    ];
    const r = computeStoryRisk(story, bugs);
    // (3×0.4)+(0×0.3)+(1×0.3) = 1.2+0+0.3 = 1.5
    expect(r.score).toBe(1.5);
    expect(r.level).toBe('Medium');
  });

  it('score exactly 1.0 → Medium (boundary)', () => {
    // P4 In-Progress no bugs: (1×0.4)+(0×0.3)+(2×0.3) = 0.4+0+0.6 = 1.0
    const story = { priority: 'P4', status: 'In-Progress' };
    const r = computeStoryRisk(story);
    expect(r.score).toBe(1.0);
    expect(r.level).toBe('Medium');
  });

  it('score exactly 2.0 → High (boundary)', () => {
    // P3 In-Progress + Medium bug: (2×0.4)+(2×0.3)+(2×0.3) = 0.8+0.6+0.6 = 2.0
    const story = { priority: 'P3', status: 'In-Progress' };
    const bugs = [{ severity: 'Medium', status: 'Open' }];
    const r = computeStoryRisk(story, bugs);
    expect(r.score).toBe(2.0);
    expect(r.level).toBe('High');
  });

  it('score exactly 3.0 → Critical (boundary)', () => {
    // P2 In-Progress + Critical bug: (3×0.4)+(4×0.3)+(2×0.3) = 1.2+1.2+0.6 = 3.0
    const story = { priority: 'P2', status: 'In-Progress' };
    const bugs = [{ severity: 'Critical', status: 'Open' }];
    const r = computeStoryRisk(story, bugs);
    expect(r.score).toBe(3.0);
    expect(r.level).toBe('Critical');
  });

  it('uses max severity across multiple open bugs', () => {
    // Two open bugs: Low + High → uses High(3)
    // P3 Planned: (2×0.4)+(3×0.3)+(1×0.3) = 0.8+0.9+0.3 = 2.0 → High
    const story = { priority: 'P3', status: 'Planned' };
    const bugs = [
      { severity: 'Low', status: 'Open' },
      { severity: 'High', status: 'Open' },
    ];
    const r = computeStoryRisk(story, bugs);
    expect(r.score).toBe(2.0);
    expect(r.level).toBe('High');
  });
});
```

- [ ] **Step 1.2: Run test to verify it fails**

```bash
npx jest tests/unit/compute-risk.test.js --no-coverage
```

Expected: FAIL — `Cannot find module '../../tools/lib/compute-risk'`

- [ ] **Step 1.3: Create `tools/lib/compute-risk.js` with `computeStoryRisk`**

```js
'use strict';

const PRIORITY_WEIGHTS = { P1: 4, P2: 3, P3: 2, P4: 1 };
const SEVERITY_WEIGHTS = { Critical: 4, High: 3, Medium: 2, Low: 1 };
const STATUS_WEIGHTS = { Blocked: 4, 'In-Progress': 2, Planned: 1, Done: 0, Retired: 0 };
const LEVEL_COLORS = { Critical: '#ef4444', High: '#f59e0b', Medium: '#3b82f6', Low: '#22c55e' };

function scoreToLevel(score) {
  if (score >= 3) return 'Critical';
  if (score >= 2) return 'High';
  if (score >= 1) return 'Medium';
  return 'Low';
}

function computeStoryRisk(story, linkedBugs = []) {
  const pw = PRIORITY_WEIGHTS[story.priority] ?? 2;
  const openBugs = linkedBugs.filter((b) => !/^(Fixed|Retired|Cancelled)/i.test(b.status));
  const sw = openBugs.reduce((max, b) => Math.max(max, SEVERITY_WEIGHTS[b.severity] ?? 0), 0);
  const stw = STATUS_WEIGHTS[story.status] ?? 1;
  const score = Math.round((pw * 0.4 + sw * 0.3 + stw * 0.3) * 10) / 10;
  return { score, level: scoreToLevel(score) };
}

module.exports = { computeStoryRisk, PRIORITY_WEIGHTS, SEVERITY_WEIGHTS, STATUS_WEIGHTS, LEVEL_COLORS, scoreToLevel };
```

- [ ] **Step 1.4: Run tests to verify they pass**

```bash
npx jest tests/unit/compute-risk.test.js --no-coverage
```

Expected: All 8 tests PASS.

- [ ] **Step 1.5: Commit**

```bash
git add tools/lib/compute-risk.js tests/unit/compute-risk.test.js
git commit -m "feat: US-0064 add computeStoryRisk to compute-risk.js"
```

---

## Task 2: Add `computeAllRisk` to `compute-risk.js`

**Files:**

- Modify: `tools/lib/compute-risk.js`
- Modify: `tests/unit/compute-risk.test.js`

- [ ] **Step 2.1: Add failing tests for `computeAllRisk`**

Append to `tests/unit/compute-risk.test.js`:

```js
const { computeAllRisk } = require('../../tools/lib/compute-risk');

describe('computeAllRisk', () => {
  it('returns empty Maps for empty input', () => {
    const { byStory, byEpic } = computeAllRisk([], []);
    expect(byStory.size).toBe(0);
    expect(byEpic.size).toBe(0);
  });

  it('scores stories and aggregates per epic, excluding Done stories', () => {
    const stories = [
      { id: 'US-0001', epicId: 'EPIC-0001', priority: 'P1', status: 'In-Progress' },
      { id: 'US-0002', epicId: 'EPIC-0001', priority: 'P2', status: 'Done' },
    ];
    const { byStory, byEpic } = computeAllRisk(stories, []);
    // US-0001: (4×0.4)+(0×0.3)+(2×0.3) = 1.6+0+0.6 = 2.2 → High
    expect(byStory.get('US-0001').score).toBe(2.2);
    expect(byStory.get('US-0001').level).toBe('High');
    // US-0002: (3×0.4)+(0×0.3)+(0×0.3) = 1.2 → Medium (still scored)
    expect(byStory.get('US-0002').score).toBe(1.2);
    // EPIC-0001: only US-0001 contributes (Done excluded)
    const ep = byEpic.get('EPIC-0001');
    expect(ep.avgScore).toBe(2.2);
    expect(ep.level).toBe('High');
    expect(ep.counts.High).toBe(1);
    expect(ep.counts.Low).toBe(0);
  });

  it('matches bugs to stories via normalizeStoryRef on relatedStory', () => {
    const stories = [{ id: 'US-0003', epicId: 'EPIC-0002', priority: 'P2', status: 'Planned' }];
    const bugs = [{ severity: 'Critical', status: 'Open', relatedStory: 'US-0003 (some context)' }];
    const { byStory } = computeAllRisk(stories, bugs);
    // (3×0.4)+(4×0.3)+(1×0.3) = 1.2+1.2+0.3 = 2.7 → High
    expect(byStory.get('US-0003').score).toBe(2.7);
    expect(byStory.get('US-0003').level).toBe('High');
  });

  it('excludes Retired stories from epic aggregation', () => {
    const stories = [
      { id: 'US-0004', epicId: 'EPIC-0003', priority: 'P3', status: 'Retired' },
      { id: 'US-0005', epicId: 'EPIC-0003', priority: 'P4', status: 'Planned' },
    ];
    const { byEpic } = computeAllRisk(stories, []);
    // Only US-0005: (1×0.4)+(0×0.3)+(1×0.3) = 0.4+0+0.3 = 0.7 → Low
    const ep = byEpic.get('EPIC-0003');
    expect(ep.avgScore).toBe(0.7);
    expect(ep.counts.Low).toBe(1);
    expect(ep.counts.Medium).toBe(0);
  });

  it('epic with all Done stories gets avgScore 0', () => {
    const stories = [{ id: 'US-0006', epicId: 'EPIC-0004', priority: 'P1', status: 'Done' }];
    const { byEpic } = computeAllRisk(stories, []);
    const ep = byEpic.get('EPIC-0004');
    expect(ep.avgScore).toBe(0);
  });
});
```

- [ ] **Step 2.2: Run tests to verify new tests fail**

```bash
npx jest tests/unit/compute-risk.test.js --no-coverage
```

Expected: `computeAllRisk` tests FAIL — `computeAllRisk is not a function`.

- [ ] **Step 2.3: Add `computeAllRisk` to `compute-risk.js`**

Add after `computeStoryRisk` and before `module.exports`:

```js
function _normalizeRef(raw) {
  if (!raw) return null;
  const m = String(raw).match(/US-\d{4}/);
  return m ? m[0] : null;
}

function computeAllRisk(stories, bugs) {
  const bugsByStory = new Map();
  for (const bug of bugs) {
    const id = _normalizeRef(bug.relatedStory);
    if (!id) continue;
    if (!bugsByStory.has(id)) bugsByStory.set(id, []);
    bugsByStory.get(id).push(bug);
  }

  const byStory = new Map();
  const epicAccum = new Map();

  for (const story of stories) {
    const result = computeStoryRisk(story, bugsByStory.get(story.id) || []);
    byStory.set(story.id, result);

    if (story.status === 'Done' || story.status === 'Retired') continue;
    const eid = story.epicId || '_ungrouped';
    if (!epicAccum.has(eid)) epicAccum.set(eid, { scores: [], counts: { Low: 0, Medium: 0, High: 0, Critical: 0 } });
    const acc = epicAccum.get(eid);
    acc.scores.push(result.score);
    acc.counts[result.level]++;
  }

  const byEpic = new Map();
  for (const [eid, { scores, counts }] of epicAccum) {
    const avg = scores.length ? Math.round((scores.reduce((s, v) => s + v, 0) / scores.length) * 10) / 10 : 0;
    byEpic.set(eid, {
      avgScore: avg,
      maxScore: scores.length ? Math.max(...scores) : 0,
      level: scoreToLevel(avg),
      counts,
    });
  }

  return { byStory, byEpic };
}
```

Update `module.exports`:

```js
module.exports = {
  computeStoryRisk,
  computeAllRisk,
  scoreToLevel,
  PRIORITY_WEIGHTS,
  SEVERITY_WEIGHTS,
  STATUS_WEIGHTS,
  LEVEL_COLORS,
};
```

- [ ] **Step 2.4: Run all compute-risk tests**

```bash
npx jest tests/unit/compute-risk.test.js --no-coverage
```

Expected: All 13 tests PASS.

- [ ] **Step 2.5: Commit**

```bash
git add tools/lib/compute-risk.js tests/unit/compute-risk.test.js
git commit -m "feat: US-0064 add computeAllRisk with epic aggregation"
```

---

## Task 3: Wire `compute-risk` into `generate-plan.js`

**Files:**

- Modify: `tools/generate-plan.js`

- [ ] **Step 3.1: Add `computeAllRisk` require and `data.risk` assignment**

In `tools/generate-plan.js`, add require near top (after the existing `detectAtRisk` require on line 22):

```js
const { computeAllRisk } = require('./lib/compute-risk');
```

After the `const atRisk = detectAtRisk(stories, testCases, bugs);` line (≈line 213), add:

```js
const risk = computeAllRisk(stories, bugs);
```

In the `data` object literal (≈line 260), add `risk` alongside `atRisk`:

```js
  atRisk,
  risk,
```

- [ ] **Step 3.2: Add `computeCompletion` and `data.completion`**

Add this function anywhere in `generate-plan.js` before the `run()` function (e.g. near the other utility functions):

```js
function computeCompletion(stories, trends) {
  if (!trends || !trends.dates || trends.dates.length < 2) return null;
  const TSHIRT = { XS: 0.5, S: 1, M: 3, L: 5, XL: 8 };
  const pts = (s) => {
    const e = s.estimate ? s.estimate.toUpperCase() : null;
    return (e && TSHIRT[e]) || 1;
  };
  const done = stories.filter((s) => s.status === 'Done');
  if (done.length < 2) return null;
  const completedPts = done.reduce((sum, s) => sum + pts(s), 0);
  const remainingPts = stories
    .filter((s) => s.status !== 'Done' && s.status !== 'Retired')
    .reduce((sum, s) => sum + pts(s), 0);
  if (remainingPts === 0) return null;
  const firstDate = new Date(trends.dates[0]);
  const lastDate = new Date(trends.dates[trends.dates.length - 1]);
  const weeksElapsed = (lastDate - firstDate) / (7 * 24 * 60 * 60 * 1000);
  if (weeksElapsed < 1) return null;
  const ptsPerWeek = completedPts / weeksElapsed;
  if (ptsPerWeek <= 0) return null;
  const weeksRemaining = remainingPts / ptsPerWeek;
  const likelyMs = lastDate.getTime() + weeksRemaining * 7 * 24 * 60 * 60 * 1000;
  const rangeMs = weeksRemaining * 0.2 * 7 * 24 * 60 * 60 * 1000;
  const fmt = (d) => d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  return {
    likelyDate: fmt(new Date(likelyMs)),
    rangeStart: fmt(new Date(likelyMs - rangeMs)),
    rangeEnd: fmt(new Date(likelyMs + rangeMs)),
    velocityWeeks: Math.round(weeksElapsed),
  };
}
```

After the `data.budget = budgetMetrics;` line (≈line 316), add:

```js
data.completion = computeCompletion(data.stories, trends);
```

- [ ] **Step 3.3: Run full test suite to confirm no regressions**

```bash
npx jest --coverage
```

Expected: All existing tests pass; coverage ≥ 80%.

- [ ] **Step 3.4: Commit**

```bash
git add tools/generate-plan.js
git commit -m "feat: US-0064 wire computeAllRisk + computeCompletion into generate-plan.js"
```

---

## Task 4: Hierarchy tab — story risk badges

**Files:**

- Modify: `tools/lib/render-tabs.js`
- Modify: `tests/unit/render-html.test.js`

- [ ] **Step 4.1: Write failing tests**

Append to `tests/unit/render-html.test.js`:

```js
describe('renderHtml — risk badges (US-0064)', () => {
  const riskData = {
    ...sampleData,
    risk: {
      byStory: new Map([['US-0001', { score: 2.3, level: 'High' }]]),
      byEpic: new Map([
        [
          'EPIC-0001',
          { avgScore: 2.3, maxScore: 2.3, level: 'High', counts: { Low: 0, Medium: 0, High: 1, Critical: 0 } },
        ],
      ]),
    },
  };

  it('shows risk score badge on In-Progress story', () => {
    const h = renderHtml(riskData);
    expect(h).toContain('High');
    expect(h).toContain('2.3');
  });

  it('does not show numeric risk badge on Done story', () => {
    const doneData = {
      ...riskData,
      stories: [{ ...sampleData.stories[0], status: 'Done' }],
      risk: {
        byStory: new Map([['US-0001', { score: 0.4, level: 'Low' }]]),
        byEpic: new Map(),
      },
    };
    const h = renderHtml(doneData);
    // The score badge should not appear for Done story
    expect(h).not.toContain('risk-score-badge');
  });
});
```

- [ ] **Step 4.2: Run to verify tests fail**

```bash
npx jest tests/unit/render-html.test.js --no-coverage -t "risk badges"
```

Expected: FAIL — `risk-score-badge` class and score text not found.

- [ ] **Step 4.3: Add `RISK_LEVEL_COLORS` constant to `render-tabs.js`**

Add after the `require` block at the top of `tools/lib/render-tabs.js`:

```js
const RISK_LEVEL_COLORS = { Critical: '#ef4444', High: '#f59e0b', Medium: '#3b82f6', Low: '#22c55e' };
```

- [ ] **Step 4.4: Update column-view story rows in `renderHierarchyTab`**

In the `storyRows` mapping (≈line 30), after the existing `const risk = data.atRisk[story.id] || {};` line, add:

```js
const storyRisk = data.risk && data.risk.byStory ? data.risk.byStory.get(story.id) : null;
const riskScoreBadge =
  storyRisk && story.status !== 'Done' && story.status !== 'Retired'
    ? `<span class="risk-score-badge text-xs font-semibold ml-1" style="color:${RISK_LEVEL_COLORS[storyRisk.level]}">${storyRisk.level} ${storyRisk.score}</span>`
    : '';
```

Then in the story row HTML, add `${riskScoreBadge}` after `${riskBadge}`:

```js
          <span class="text-sm font-medium">${esc(story.title)}</span>
          ${riskBadge}
          ${riskScoreBadge}
          <span class="ml-auto text-xs text-slate-500">
```

- [ ] **Step 4.5: Update card-view story cards in `renderHierarchyTab`**

In the `storyCards` mapping (≈line 70), after `const risk = data.atRisk[story.id] || {};`, add:

```js
const storyRisk = data.risk && data.risk.byStory ? data.risk.byStory.get(story.id) : null;
const riskScoreBadge =
  storyRisk && story.status !== 'Done' && story.status !== 'Retired'
    ? `<span class="risk-score-badge text-xs font-semibold" style="color:${RISK_LEVEL_COLORS[storyRisk.level]}">${storyRisk.level} ${storyRisk.score}</span>`
    : '';
```

In the card bottom-bar HTML, add `${riskScoreBadge}` before the `ml-auto` riskBadge span:

```js
          ${acTotal ? `<span class="cursor-pointer" onclick="toggleCardACs('${jsEsc(story.id)}')">${acDone}/${acTotal} ACs ▾</span>` : ''}
          ${riskScoreBadge}
          <span class="ml-auto">${riskBadge}</span>
```

- [ ] **Step 4.6: Run tests**

```bash
npx jest tests/unit/render-html.test.js --no-coverage -t "risk badges"
```

Expected: PASS.

- [ ] **Step 4.7: Run full suite**

```bash
npx jest --no-coverage
```

Expected: All tests pass.

- [ ] **Step 4.8: Commit**

```bash
git add tools/lib/render-tabs.js tests/unit/render-html.test.js
git commit -m "feat: US-0064 add risk score badges to Hierarchy tab story cards"
```

---

## Task 5: Status tab — risk score bar chart + distribution chart

**Files:**

- Modify: `tools/lib/render-tabs.js`
- Modify: `tests/unit/render-html.test.js`

- [ ] **Step 5.1: Write failing tests**

Append to `tests/unit/render-html.test.js`:

```js
describe('renderHtml — Status tab risk charts (US-0064)', () => {
  const riskData = {
    ...sampleData,
    risk: {
      byStory: new Map([['US-0001', { score: 2.3, level: 'High' }]]),
      byEpic: new Map([
        [
          'EPIC-0001',
          { avgScore: 2.3, maxScore: 2.3, level: 'High', counts: { Low: 0, Medium: 0, High: 1, Critical: 0 } },
        ],
      ]),
    },
  };

  it('Status tab contains Risk Score by Epic heading', () => {
    const h = renderHtml(riskData);
    expect(h).toContain('Risk Score by Epic');
  });

  it('Status tab contains Story Risk Distribution heading', () => {
    const h = renderHtml(riskData);
    expect(h).toContain('Story Risk Distribution');
  });
});
```

- [ ] **Step 5.2: Run to verify tests fail**

```bash
npx jest tests/unit/render-html.test.js --no-coverage -t "Status tab risk charts"
```

Expected: FAIL.

- [ ] **Step 5.3: Add risk data preparation to `renderChartsTab`**

In `renderChartsTab(data)`, add after the existing variable declarations (after `const totalStories = ...`):

```js
// Risk chart data
const riskEpics =
  data.risk && data.risk.byEpic ? [...data.risk.byEpic.entries()].sort((a, b) => b[1].avgScore - a[1].avgScore) : [];
const epicRiskLabels = JSON.stringify(riskEpics.map(([id]) => id));
const epicRiskScores = JSON.stringify(riskEpics.map(([, r]) => r.avgScore));
const epicRiskColors = JSON.stringify(
  riskEpics.map(([, r]) => ({ Critical: '#ef4444', High: '#f59e0b', Medium: '#3b82f6', Low: '#22c55e' })[r.level]),
);

const riskCounts = { Low: 0, Medium: 0, High: 0, Critical: 0 };
let totalRiskScore = 0,
  activeStoryCount = 0;
if (data.risk && data.risk.byStory) {
  for (const story of data.stories) {
    if (story.status === 'Done' || story.status === 'Retired') continue;
    const sr = data.risk.byStory.get(story.id);
    if (sr) {
      riskCounts[sr.level]++;
      totalRiskScore += sr.score;
      activeStoryCount++;
    }
  }
}
const avgRiskScore = activeStoryCount > 0 ? (totalRiskScore / activeStoryCount).toFixed(1) : '—';
const highCritCount = riskCounts.High + riskCounts.Critical;
const riskDistCounts = JSON.stringify([riskCounts.Low, riskCounts.Medium, riskCounts.High, riskCounts.Critical]);

const atRiskEpics = riskEpics.filter(([, r]) => r.avgScore >= 2.0);
```

- [ ] **Step 5.4: Add Risk section HTML to `renderChartsTab` return value**

In the `return` template string of `renderChartsTab`, add before the closing `</div>` of the grid (after the Financial section, before `</div>\n  </div>`):

```js
      <div class="chart-supertitle">Risk</div>

      <div class="card-elev rounded-lg p-4 anim-stagger" style="--i:6">
        <div class="chart-header-rule">
          <span class="display-title">Risk Score by Epic</span>
          <span class="chart-subtitle">avg score, active stories</span>
        </div>
        <div style="height:${Math.max(200, riskEpics.length * 36)}px;position:relative">
          <canvas id="chart-risk-by-epic"></canvas>
        </div>
      </div>

      <div class="card-elev rounded-lg p-4 anim-stagger" style="--i:7">
        <div class="chart-header-rule">
          <span class="display-title">Story Risk Distribution</span>
          <span class="chart-subtitle">stories by risk level</span>
        </div>
        <div style="height:200px;position:relative"><canvas id="chart-risk-distribution"></canvas></div>
        <div style="display:flex;gap:8px;margin-top:12px">
          <div style="flex:1;background:var(--clr-card,#1e293b);border-radius:6px;padding:8px 10px;border-left:3px solid #f59e0b">
            <div style="font-size:10px;color:#64748b">Avg score</div>
            <div style="font-size:18px;font-weight:700;color:#f59e0b">${avgRiskScore}</div>
          </div>
          <div style="flex:1;background:var(--clr-card,#1e293b);border-radius:6px;padding:8px 10px;border-left:3px solid #ef4444">
            <div style="font-size:10px;color:#64748b">High + Critical</div>
            <div style="font-size:18px;font-weight:700;color:#ef4444">${highCritCount} stories</div>
          </div>
        </div>
      </div>
```

- [ ] **Step 5.5: Add chart init code to the `initCharts()` function in the `<script>` block**

Inside `initCharts()` in `renderChartsTab`'s `<script>` block, add after `_charts.burnRate = ...`:

```js
    if (document.getElementById('chart-risk-by-epic')) {
      _charts.riskByEpic = new Chart(document.getElementById('chart-risk-by-epic'), {
        type: 'bar',
        data: { labels: ${epicRiskLabels}, datasets: [{ label: 'Avg Risk Score', data: ${epicRiskScores}, backgroundColor: ${epicRiskColors} }] },
        options: { indexAxis: 'y', responsive: true, maintainAspectRatio: false,
          plugins: { legend: { display: false } },
          scales: { x: { ticks: { color: tc }, max: 4 }, y: { ticks: { color: tc, autoSkip: false } } } }
      });
    }
    if (document.getElementById('chart-risk-distribution')) {
      _charts.riskDist = new Chart(document.getElementById('chart-risk-distribution'), {
        type: 'bar',
        data: { labels: ['Low','Medium','High','Critical'], datasets: [{ data: ${riskDistCounts}, backgroundColor: ['#22c55e','#3b82f6','#f59e0b','#ef4444'] }] },
        options: { responsive: true, maintainAspectRatio: false,
          plugins: { legend: { display: false } },
          scales: { x: { ticks: { color: tc } }, y: { ticks: { color: tc }, beginAtZero: true } } }
      });
    }
```

- [ ] **Step 5.6: Run tests**

```bash
npx jest tests/unit/render-html.test.js --no-coverage -t "Status tab risk charts"
```

Expected: PASS.

- [ ] **Step 5.7: Run full suite**

```bash
npx jest --no-coverage
```

Expected: All tests pass.

- [ ] **Step 5.8: Commit**

```bash
git add tools/lib/render-tabs.js tests/unit/render-html.test.js
git commit -m "feat: US-0064 add risk charts to Status tab"
```

---

## Task 6: Status tab — at-risk epic summary (US-0067)

**Files:**

- Modify: `tools/lib/render-tabs.js`
- Modify: `tests/unit/render-html.test.js`

- [ ] **Step 6.1: Write failing test**

Append to `tests/unit/render-html.test.js`:

```js
describe('renderHtml — at-risk epic summary (US-0067)', () => {
  it('Status tab shows At-Risk Epics heading when epics score >= 2.0', () => {
    const d = {
      ...sampleData,
      risk: {
        byStory: new Map([['US-0001', { score: 2.3, level: 'High' }]]),
        byEpic: new Map([
          [
            'EPIC-0001',
            { avgScore: 2.3, maxScore: 2.3, level: 'High', counts: { Low: 0, Medium: 0, High: 1, Critical: 0 } },
          ],
        ]),
      },
    };
    expect(renderHtml(d)).toContain('At-Risk Epics');
  });

  it('Status tab omits At-Risk Epics section when all epics score < 2.0', () => {
    const d = {
      ...sampleData,
      risk: {
        byStory: new Map([['US-0001', { score: 0.7, level: 'Low' }]]),
        byEpic: new Map([
          [
            'EPIC-0001',
            { avgScore: 0.7, maxScore: 0.7, level: 'Low', counts: { Low: 1, Medium: 0, High: 0, Critical: 0 } },
          ],
        ]),
      },
    };
    expect(renderHtml(d)).not.toContain('At-Risk Epics');
  });
});
```

- [ ] **Step 6.2: Run to verify they fail**

```bash
npx jest tests/unit/render-html.test.js --no-coverage -t "at-risk epic summary"
```

Expected: FAIL.

- [ ] **Step 6.3: Add at-risk summary HTML after the distribution chart card**

Note: `atRiskEpics` was computed in Task 5 Step 5.3. Confirm it is already present in `renderChartsTab` before adding the HTML below.

In `renderChartsTab` return string, after the Story Risk Distribution card (after its closing `</div>`), add:

```js
      ${atRiskEpics.length > 0 ? `
      <div class="col-span-full card-elev rounded-lg p-4 anim-stagger" style="--i:8">
        <div class="chart-header-rule">
          <span class="display-title">At-Risk Epics</span>
          <span class="chart-subtitle">avg score ≥ 2.0</span>
        </div>
        <div style="display:flex;flex-direction:column;gap:6px;margin-top:8px">
          ${atRiskEpics.map(([id, r]) => `
          <div style="display:flex;align-items:center;gap:10px;padding:6px 10px;background:var(--clr-card,#1e293b);border-radius:6px;border-left:3px solid ${{ Critical: '#ef4444', High: '#f59e0b', Medium: '#3b82f6', Low: '#22c55e' }[r.level]}">
            <span style="font-family:monospace;font-size:12px;font-weight:700;color:#e2e8f0">${esc(id)}</span>
            <span style="font-size:13px;font-weight:700;color:${{ Critical: '#ef4444', High: '#f59e0b', Medium: '#3b82f6', Low: '#22c55e' }[r.level]}">${r.avgScore}</span>
            <span style="background:${{ Critical: '#ef4444', High: '#f59e0b', Medium: '#3b82f6', Low: '#22c55e' }[r.level]};color:${r.level === 'High' ? '#1e293b' : 'white'};font-size:10px;padding:1px 6px;border-radius:3px">${r.level}</span>
            <span style="font-size:11px;color:#64748b;margin-left:auto">${r.counts.High + r.counts.Critical} High+Critical stories</span>
          </div>`).join('')}
        </div>
      </div>` : ''}
```

Note: the inline color map `{ Critical: '#ef4444', ... }[r.level]` is intentional — it avoids adding a JS variable that would be string-interpolated into the template string.

- [ ] **Step 6.4: Run tests**

```bash
npx jest tests/unit/render-html.test.js --no-coverage -t "at-risk epic summary"
```

Expected: PASS.

- [ ] **Step 6.5: Run full suite**

```bash
npx jest --no-coverage
```

Expected: All tests pass.

- [ ] **Step 6.6: Commit**

```bash
git add tools/lib/render-tabs.js tests/unit/render-html.test.js
git commit -m "feat: US-0067 add at-risk epic summary to Status tab"
```

---

## Task 7: `avgRisk` in snapshot.js + Trends tab avgRisk chart (US-0065)

**Files:**

- Modify: `tools/lib/snapshot.js`
- Modify: `tools/lib/render-tabs.js`
- Modify: `tests/unit/render-html.test.js`

- [ ] **Step 7.1: Write failing test**

Append to `tests/unit/render-html.test.js`:

```js
describe('renderHtml — Trends tab avgRisk (US-0065)', () => {
  it('Trends tab HTML references avgRisk data series', () => {
    const h = renderHtml(sampleData, {
      trends: {
        dates: ['2026-01-01T00:00:00Z', '2026-02-01T00:00:00Z'],
        doneCounts: [1, 2],
        totalStories: [5, 5],
        aiCosts: [1.0, 2.0],
        coverage: [80, 85],
        velocity: [3, 5],
        openBugs: [2, 1],
        atRisk: [1, 0],
        inputTokens: [1000, 2000],
        outputTokens: [500, 1000],
        avgRisk: [1.8, 1.5],
      },
    });
    expect(h).toContain('avgRisk');
    expect(h).toContain('Avg Risk Score');
  });
});
```

- [ ] **Step 7.2: Run to verify test fails**

```bash
npx jest tests/unit/render-html.test.js --no-coverage -t "Trends tab avgRisk"
```

Expected: FAIL.

- [ ] **Step 7.3: Add `avgRisk` to `extractTrends` in `snapshot.js`**

In `tools/lib/snapshot.js`, add require at top:

```js
const { computeAllRisk } = require('./compute-risk');
```

Inside `extractTrends`, after the `openBugs` mapping, add:

```js
const avgRisk = snapshots.map((s) => {
  const stories = s.data.stories || [];
  const bugs = s.data.bugs || [];
  const active = stories.filter((st) => st.status !== 'Done' && st.status !== 'Retired');
  if (active.length === 0) return 0;
  const { byStory } = computeAllRisk(stories, bugs);
  const scores = active.map((st) => (byStory.get(st.id) || { score: 0 }).score);
  return Math.round((scores.reduce((a, v) => a + v, 0) / scores.length) * 10) / 10;
});
```

Add `avgRisk` to the return object in `extractTrends`:

```js
return {
  dates,
  doneCounts,
  totalStories,
  aiCosts,
  coverage,
  velocity,
  openBugs,
  atRisk,
  inputTokens,
  outputTokens,
  avgRisk,
};
```

- [ ] **Step 7.4: Add `avgRisk` chart to `renderTrendsTab`**

In `tools/lib/render-tabs.js`, inside `renderTrendsTab`, add after the `riskJson` line (≈line 392):

```js
const avgRiskJson = trends ? JSON.stringify((trends.avgRisk || []).map((v) => v.toFixed(2))) : '[]';
```

In the `_trendsAllData` object (in the `<script>` block), add `avgRisk`:

```js
var _trendsAllData = {
  done: ${doneJson}, total: ${totalJson}, cost: ${costJson},
  coverage: ${coverageJson}, velocity: ${velocityJson},
  bugs: ${bugsJson}, risk: ${riskJson},
  inputTokens: ${inputTokensJson}, outputTokens: ${outputTokensJson},
  avgRisk: ${avgRiskJson}
};
```

In the HTML grid section (inside `!hasData ? placeholder : \`...\``), add after the At-Risk Stories card:

```js
<div class="card-elev rounded-lg p-4 col-span-full anim-stagger" style="--i:7">
  <div class="chart-header-rule">
    <span class="display-title">Avg Risk Score</span>
    <span class="chart-subtitle">project-wide, over time</span>
  </div>
  <div style="height:250px;position:relative">
    <canvas id="chart-trends-avg-risk"></canvas>
  </div>
</div>
```

In `initTrendsCharts()`, after the `_mkTrend('chart-trends-risk', ...)` call, add:

```js
_mkTrend('chart-trends-avg-risk', {
  type: 'line',
  data: {
    labels: labels,
    datasets: [
      {
        label: 'Avg Risk Score',
        data: _trendsAllData.avgRisk,
        borderColor: '#f59e0b',
        _gc: '#f59e0b',
        fill: true,
        tension: 0.3,
      },
    ],
  },
  options: {
    responsive: true,
    maintainAspectRatio: false,
    plugins: { legend: leg },
    scales: { x: xA, y: yA({ min: 0, max: 4 }) },
  },
});
```

- [ ] **Step 7.5: Run tests**

```bash
npx jest tests/unit/render-html.test.js --no-coverage -t "Trends tab avgRisk"
```

Expected: PASS.

- [ ] **Step 7.6: Run full suite**

```bash
npx jest --no-coverage
```

Expected: All tests pass.

- [ ] **Step 7.7: Commit**

```bash
git add tools/lib/snapshot.js tools/lib/render-tabs.js tests/unit/render-html.test.js
git commit -m "feat: US-0065 add avgRisk to snapshot trends + Trends tab chart"
```

---

## Task 8: Completion banner — sub-topbar strip (US-0066)

**Files:**

- Modify: `tools/lib/render-shell.js`
- Modify: `tools/lib/render-html.js`
- Modify: `tests/unit/render-html.test.js`

- [ ] **Step 8.1: Write failing tests**

Append to `tests/unit/render-html.test.js`:

```js
describe('renderHtml — completion banner (US-0066)', () => {
  it('shows completion banner when data.completion is set', () => {
    const d = {
      ...sampleData,
      completion: { likelyDate: 'May 14', rangeStart: 'Apr 28', rangeEnd: 'Jun 3', velocityWeeks: 4 },
    };
    const h = renderHtml(d);
    expect(h).toContain('completion-banner');
    expect(h).toContain('May 14');
    expect(h).toContain('Apr 28');
    expect(h).toContain('4-wk velocity');
  });

  it('omits completion banner when data.completion is null', () => {
    const d = { ...sampleData, completion: null };
    expect(renderHtml(d)).not.toContain('completion-banner');
  });
});
```

- [ ] **Step 8.2: Run to verify tests fail**

```bash
npx jest tests/unit/render-html.test.js --no-coverage -t "completion banner"
```

Expected: FAIL.

- [ ] **Step 8.3: Add `renderCompletionBanner` to `render-shell.js`**

In `tools/lib/render-shell.js`, add this function before `module.exports`:

```js
function renderCompletionBanner(data) {
  if (!data.completion) return '';
  const { likelyDate, rangeStart, rangeEnd, velocityWeeks } = data.completion;
  return `
  <div id="completion-banner" style="background:#0f172a;border-bottom:1px solid #1e293b;padding:6px 24px;display:flex;align-items:center;gap:8px;font-size:12px;flex-wrap:wrap">
    <span style="color:#94a3b8">📅 Estimated completion:</span>
    <span style="color:#fbbf24;font-weight:600">${esc(likelyDate)} (likely)</span>
    <span style="color:#475569">·</span>
    <span style="color:#c4b5fd">${esc(rangeStart)} – ${esc(rangeEnd)} range</span>
    <span style="color:#475569;font-size:11px;margin-left:auto">based on ${velocityWeeks}-wk velocity</span>
  </div>`;
}
```

Update `module.exports` in `render-shell.js`:

```js
module.exports = { renderTopBar, renderFilterBar, renderSidebar, renderCompletionBanner };
```

- [ ] **Step 8.4: Wire `renderCompletionBanner` into `render-html.js`**

In `tools/lib/render-html.js`, update the require:

```js
const { renderTopBar, renderFilterBar, renderSidebar, renderCompletionBanner } = require('./render-shell');
```

In the HTML template, add `${renderCompletionBanner(data)}` between `renderTopBar` and `<div id="app-shell">`:

```js
  ${renderTopBar(data)}
  ${renderCompletionBanner(data)}
  <div id="app-shell">
```

- [ ] **Step 8.5: Run tests**

```bash
npx jest tests/unit/render-html.test.js --no-coverage -t "completion banner"
```

Expected: PASS.

- [ ] **Step 8.6: Run full suite with coverage**

```bash
npx jest --coverage
```

Expected: All tests pass; statement coverage ≥ 80%.

- [ ] **Step 8.7: Commit**

```bash
git add tools/lib/render-shell.js tools/lib/render-html.js tests/unit/render-html.test.js
git commit -m "feat: US-0066 add velocity-based completion banner below topbar"
```

---

## Task 9: BUGS.md + RELEASE_PLAN.md housekeeping

**Files:**

- Modify: `docs/BUGS.md` (if new bugs found during implementation)
- Modify: `docs/RELEASE_PLAN.md` (mark US-0064–US-0067 Done)

- [ ] **Step 9.1: Run final test suite**

```bash
npx jest --coverage
```

Expected: All tests pass; coverage ≥ 80%.

- [ ] **Step 9.2: Mark stories Done in `docs/RELEASE_PLAN.md`**

Set `Status: Done` and check all ACs for US-0064, US-0065, US-0066, US-0067 in RELEASE_PLAN.md.

- [ ] **Step 9.3: Final commit**

```bash
git add docs/RELEASE_PLAN.md
git commit -m "docs: mark US-0064/0065/0066/0067 Done in RELEASE_PLAN.md"
```

- [ ] **Step 9.4: Open PR to develop**

```bash
gh pr create \
  --base develop \
  --title "feat: EPIC-0010 risk analytics (US-0064/0065/0066/0067)" \
  --body "$(cat <<'EOF'
## Summary
- US-0064: Composite risk scores computed in new `compute-risk.js`, surfaced as badges on Hierarchy tab story cards and two charts in Status tab
- US-0065: `avgRisk` trend line added to Trends tab
- US-0066: Velocity-based completion date banner below topbar
- US-0067: At-risk epic summary widget in Status tab
- US-0068: Monte Carlo deferred (±20% confidence range used instead)

## Test plan
- [ ] `npx jest --coverage` passes, coverage ≥ 80%
- [ ] `node tools/generate-plan.js` runs without errors
- [ ] Risk badges visible on In-Progress stories in Hierarchy tab
- [ ] Status tab shows "Risk Score by Epic", "Story Risk Distribution", and "At-Risk Epics" sections
- [ ] Trends tab shows Avg Risk Score chart
- [ ] Completion banner appears below topbar (if ≥ 2 done stories + ≥ 1 week of snapshot history)

🤖 Generated with [Claude Code](https://claude.com/claude-code)
EOF
)"
```
