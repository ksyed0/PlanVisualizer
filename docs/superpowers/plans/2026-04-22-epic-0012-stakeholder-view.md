# EPIC-0012 Stakeholder View — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a dedicated Stakeholder tab to the PlanVisualizer dashboard that shows milestone progress, budget health, and open risks — exportable to PDF via the browser's print dialog.

**Architecture:** `renderStakeholderTab(data)` is added to `tools/lib/render-tabs.js` alongside the existing 9 tab renderers. The sidebar nav entry goes in `render-shell.js`. Print CSS extends `render-scripts.js`. `render-html.js` wires the new renderer into the tab-content block. No new parsers or scripts.

**Tech Stack:** Node.js (CommonJS), string-template HTML, OKLCH CSS tokens from `theme.js`, `window.print()` for PDF export, Jest for tests.

---

## File Map

| File                             | Change                                                             |
| -------------------------------- | ------------------------------------------------------------------ |
| `tests/unit/render-tabs.test.js` | **Create** — 15 tests for `renderStakeholderTab`                   |
| `tools/lib/render-tabs.js`       | **Modify** — add `renderStakeholderTab(data)` function + export    |
| `tools/lib/render-shell.js`      | **Modify** — add Stakeholder item to `renderSidebar()` items array |
| `tools/lib/render-scripts.js`    | **Modify** — add stakeholder chip CSS + extend `@media print`      |
| `tools/lib/render-html.js`       | **Modify** — import + call `renderStakeholderTab` in tab-content   |

---

## Task 1: Write the failing tests

**Files:**

- Create: `tests/unit/render-tabs.test.js`

- [ ] **Step 1: Create the test file**

```js
'use strict';
const { renderStakeholderTab } = require('../../tools/lib/render-tabs');

// Minimal but complete data fixture for stakeholder tab tests
const mkData = (overrides = {}) => ({
  epics: [
    { id: 'EPIC-0001', title: 'Authentication', status: 'Done' },
    { id: 'EPIC-0002', title: 'Dashboard', status: 'In Progress' },
    { id: 'EPIC-0003', title: 'Retired Epic', status: 'Retired' },
  ],
  stories: [
    {
      id: 'US-0001',
      epicId: 'EPIC-0001',
      title: 'Login form',
      status: 'Done',
      acs: [{ id: 'AC-0001', text: 'User can log in with email', done: true }],
    },
    { id: 'US-0002', epicId: 'EPIC-0001', title: 'Session management', status: 'Done', acs: [] },
    {
      id: 'US-0003',
      epicId: 'EPIC-0002',
      title: 'Kanban board',
      status: 'In Progress',
      acs: [{ id: 'AC-0002', text: 'Board loads within 2s', done: false }],
    },
    { id: 'US-0004', epicId: 'EPIC-0002', title: 'Analytics view', status: 'Blocked', acs: [] },
    { id: 'US-0005', epicId: null, title: 'Ungrouped story', status: 'Planned', acs: [] },
    { id: 'US-0006', epicId: 'EPIC-0003', title: 'Retired story', status: 'Retired', acs: [] },
  ],
  bugs: [
    { id: 'BUG-0001', severity: 'Critical', status: 'Open', relatedStory: 'US-0003', epicId: 'EPIC-0002' },
    { id: 'BUG-0002', severity: 'Low', status: 'Open', relatedStory: 'US-0001', epicId: 'EPIC-0001' },
  ],
  costs: {
    'US-0001': { projectedUsd: 200, costUsd: 5.5 },
    'US-0002': { projectedUsd: 100, costUsd: 2.0 },
    'US-0003': { projectedUsd: 400, costUsd: 12.0 },
    _totals: { costUsd: 19.5 },
  },
  budget: {
    totalBudget: 1000,
    totalSpent: 19.5,
    totalProjected: 700,
    percentUsed: 2,
    burnRate: 0.065,
    daysRemaining: 150,
    hasBudget: true,
  },
  recentActivity: [{ date: '2026-04-01', summary: 'Setup', sessionNum: 1 }],
  ...overrides,
});

describe('renderStakeholderTab', () => {
  let html;
  beforeAll(() => {
    html = renderStakeholderTab(mkData());
  });

  // Test 1
  it('renders #tab-stakeholder container', () => {
    expect(html).toContain('id="tab-stakeholder"');
  });

  // Test 2
  it('summary bar — progress tile shows % and story count', () => {
    // 4 non-Retired stories total, 2 Done → 50%
    expect(html).toMatch(/50%/);
    expect(html).toMatch(/2\s+of\s+4/);
  });

  // Test 3
  it('summary bar — budget tile shows Est. and AI spend in USD', () => {
    expect(html).toMatch(/Est\./);
    expect(html).toMatch(/AI spend/i);
    expect(html).toMatch(/USD/);
  });

  // Test 4
  it('summary bar — risk tile shows open bug count and blocked story count', () => {
    // 1 open Critical/High bug, 1 blocked story
    expect(html).toMatch(/1\s*(high|critical)?\s*bug/i);
    expect(html).toMatch(/1\s*blocked/i);
  });

  // Test 5
  it('epic rows — one .epic-row per non-Retired epic', () => {
    const matches = html.match(/class="[^"]*epic-row[^"]*"/g) || [];
    // EPIC-0001 and EPIC-0002 (non-Retired), EPIC-0003 is Retired
    expect(matches.length).toBe(2);
  });

  // Test 6
  it('epic cost line — Est. and AI spend rendered when data.costs available', () => {
    // EPIC-0001: Est. $300 USD, AI spend $7.50 USD
    expect(html).toMatch(/\$300/);
    expect(html).toMatch(/\$7\.50/);
  });

  // Test 7
  it('no cost elements when data.costs is null', () => {
    const noCostData = mkData({ costs: null });
    const noCostHtml = renderStakeholderTab(noCostData);
    expect(noCostHtml).toContain('id="tab-stakeholder"');
    expect(noCostHtml).not.toContain('epic-costs');
  });

  // Test 8
  it('plain language — In Progress renders as "Being Worked On"', () => {
    expect(html).toContain('Being Worked On');
    expect(html).not.toMatch(/chip[^"]*">[^<]*In Progress/);
  });

  // Test 9
  it('plain language — Blocked renders as "Needs Attention"', () => {
    expect(html).toContain('Needs Attention');
    expect(html).not.toMatch(/chip[^"]*">[^<]*Blocked/);
  });

  // Test 10
  it('story rows present inside expanded epic HTML structure', () => {
    expect(html).toContain('story-row');
    expect(html).toContain('US-0001');
    expect(html).toContain('US-0003');
  });

  // Test 11
  it('AC rows present inside story structure', () => {
    expect(html).toContain('AC-0001');
    expect(html).toContain('User can log in with email');
    expect(html).toContain('AC-0002');
  });

  // Test 12
  it('no technical fields — branch names and token counts absent', () => {
    // The data has no branch/token fields but the renderer must not expose any
    expect(html).not.toMatch(/feature\/|bugfix\//);
    expect(html).not.toMatch(/inputTokens|outputTokens|token.count/i);
    expect(html).not.toMatch(/TC-\d{4}/);
  });

  // Test 13
  it('export bar present with window.print() call', () => {
    expect(html).toContain('stakeholder-export-bar');
    expect(html).toContain('window.print()');
  });

  // Test 14
  it('retired epics produce no epic row', () => {
    // EPIC-0003 is Retired — must not appear as an epic-row
    expect(html).not.toMatch(/epic-row[^>]*>[^<]*EPIC-0003/);
    // Its title also must not appear in an epic context
    expect(html).not.toContain('Retired Epic');
  });

  // Test 15
  it('"No Epic" group appears after all EPIC-* rows', () => {
    const epic1Pos = html.indexOf('EPIC-0001');
    const epic2Pos = html.indexOf('EPIC-0002');
    const ungroupedPos = html.indexOf('No Epic');
    expect(epic1Pos).toBeGreaterThan(-1);
    expect(epic2Pos).toBeGreaterThan(-1);
    expect(ungroupedPos).toBeGreaterThan(-1);
    expect(ungroupedPos).toBeGreaterThan(Math.max(epic1Pos, epic2Pos));
  });
});
```

- [ ] **Step 2: Run tests to confirm they all fail**

```bash
cd /Users/Kamal_Syed/Projects/PlanVisualizer/.claude/worktrees/gifted-johnson-5e162a
npx jest tests/unit/render-tabs.test.js --no-coverage 2>&1 | head -30
```

Expected: `renderStakeholderTab is not a function` or similar — all 15 tests fail.

---

## Task 2: Implement `renderStakeholderTab`

**Files:**

- Modify: `tools/lib/render-tabs.js` (append before `module.exports`)
- Modify: `tools/lib/render-tabs.js` (add to `module.exports`)

- [ ] **Step 1: Append `renderStakeholderTab` to render-tabs.js before `module.exports`**

Add the following function at line 2233, immediately before `module.exports = {`:

```js
// ── EPIC-0012: Stakeholder View ──────────────────────────────────────────────

const STATUS_LABELS = {
  Done: 'Complete',
  'In Progress': 'Being Worked On',
  'In-Progress': 'Being Worked On',
  Planned: 'Planned',
  Blocked: 'Needs Attention',
  'At Risk': 'Needs Attention',
};

const STATUS_CHIP = {
  Done: 'chip-ok',
  'In Progress': 'chip-warn',
  'In-Progress': 'chip-warn',
  Planned: 'chip-mute',
  Blocked: 'chip-risk',
  'At Risk': 'chip-risk',
};

const DOT_COLOR = {
  ok: 'var(--ok)',
  warn: 'var(--warn)',
  info: 'var(--info)',
  mute: 'var(--text-mute)',
};

function storyLabel(status) {
  return STATUS_LABELS[status] || esc(status);
}
function storyChip(status) {
  return STATUS_CHIP[status] || 'chip-mute';
}

function epicCompositeStatus(epicId, stories, bugs) {
  const epicStories = stories.filter((s) => s.epicId === epicId && s.status !== 'Retired');
  if (!epicStories.length) return { label: 'Planned', chipClass: 'chip-mute', dotKey: 'mute' };

  const allDone = epicStories.every((s) => /^done$/i.test(s.status));
  const anyBlocked = epicStories.some((s) => /^blocked$/i.test(s.status));
  const hasOpenCritical = (bugs || []).some(
    (b) =>
      b.epicId === epicId && /^(Critical|High)$/i.test(b.severity) && !/^(Fixed|Retired|Cancelled)/i.test(b.status),
  );
  const anyActive = epicStories.some((s) => /^(done|in.progress)$/i.test(s.status));
  const allPlanned = epicStories.every((s) => /^planned$/i.test(s.status));

  if (allDone) return { label: 'Complete', chipClass: 'chip-ok', dotKey: 'ok' };
  if (anyBlocked || hasOpenCritical) return { label: 'Needs Attention', chipClass: 'chip-warn', dotKey: 'warn' };
  if (anyActive) return { label: 'On Track', chipClass: 'chip-info', dotKey: 'info' };
  if (allPlanned) return { label: 'Planned', chipClass: 'chip-mute', dotKey: 'mute' };
  return { label: 'In Progress', chipClass: 'chip-warn', dotKey: 'warn' };
}

function usdLabel(n) {
  const num = Number(n);
  if (num >= 1000) return '$' + Math.round(num).toLocaleString('en-US') + ' USD';
  if (num > 0) return '$' + num.toFixed(2) + ' USD';
  return '$0.00 USD';
}

function renderStakeholderTab(data) {
  const costs = data.costs || null;
  const budget = data.budget || {};
  const stories = data.stories || [];
  const epics = data.epics || [];
  const bugs = data.bugs || [];

  // ── Summary bar ─────────────────────────────────────────────────────────────
  const nonRetired = stories.filter((s) => s.status !== 'Retired');
  const doneCnt = nonRetired.filter((s) => /^done$/i.test(s.status)).length;
  const totalCnt = nonRetired.length;
  const overallPct = totalCnt ? Math.round((doneCnt / totalCnt) * 100) : 0;

  // Traffic-light based on percentUsed vs thresholds: <50 green, 50-80 amber, >80 red
  const pctUsed = budget.percentUsed != null ? budget.percentUsed : null;
  let tlColor = 'var(--ok)';
  let tlLabel = 'On track';
  if (pctUsed !== null && pctUsed > 80) {
    tlColor = 'var(--risk)';
    tlLabel = 'At risk';
  } else if (pctUsed !== null && pctUsed >= 50) {
    tlColor = 'var(--warn)';
    tlLabel = 'Watch';
  }

  const totalSpent = (costs && costs._totals && costs._totals.costUsd) || 0;
  const totalProjected = costs
    ? Object.entries(costs)
        .filter(([k]) => k !== '_totals')
        .reduce((sum, [, c]) => sum + (c && c.projectedUsd ? c.projectedUsd : 0), 0)
    : 0;

  let budgetNarrative = '';
  if (budget.hasBudget) {
    budgetNarrative = ` · ${esc(tlLabel)} · Est. ${usdLabel(totalProjected)} · AI spend ${usdLabel(totalSpent)}`;
    if (budget.daysRemaining != null && budget.burnRate > 0) {
      const wks = Math.round(budget.daysRemaining / 7);
      if (wks >= 1) budgetNarrative += ` · At current pace, budget lasts ${wks} more week${wks !== 1 ? 's' : ''}`;
    }
  } else if (costs) {
    budgetNarrative = ` · Est. ${usdLabel(totalProjected)} · AI spend ${usdLabel(totalSpent)}`;
  }

  const openHighBugs = bugs.filter(
    (b) => /^(Critical|High)$/i.test(b.severity) && !/^(Fixed|Retired|Cancelled)/i.test(b.status),
  );
  const blockedStoriesCnt = stories.filter((s) => /^blocked$/i.test(s.status)).length;

  const summaryBar = `
  <div class="sh-summary-bar">
    <div class="sh-tile">
      <div class="sh-tile-label">Overall Progress</div>
      <div class="sh-tile-value">
        <span class="sh-big-num">${overallPct}%</span>
        <span class="sh-tile-sub">${doneCnt}&nbsp;of&nbsp;${totalCnt} stories done</span>
      </div>
    </div>
    <div class="sh-tile sh-tile-wide">
      <div class="sh-tile-label">Budget Health</div>
      <div class="sh-tile-value">
        ${budget.hasBudget ? `<span class="sh-tl-dot" style="background:${tlColor}"></span>` : ''}
        <span class="sh-tile-sub">${budgetNarrative}</span>
      </div>
    </div>
    <div class="sh-tile">
      <div class="sh-tile-label">Open Risks</div>
      <div class="sh-tile-value">
        <span class="sh-big-num">${openHighBugs.length + blockedStoriesCnt}</span>
        <span class="sh-tile-sub">${openHighBugs.length} high bug${openHighBugs.length !== 1 ? 's' : ''} · ${blockedStoriesCnt} blocked ${blockedStoriesCnt !== 1 ? 'stories' : 'story'}</span>
      </div>
    </div>
  </div>`;

  // ── Milestones section ───────────────────────────────────────────────────────
  const activeEpics = epics.filter((e) => e.status !== 'Retired');
  activeEpics.sort((a, b) => {
    if (a.id === '_ungrouped') return 1;
    if (b.id === '_ungrouped') return -1;
    return a.id.localeCompare(b.id);
  });

  // Stories without an epicId form a "_ungrouped" virtual epic shown last
  const ungroupedStories = stories.filter((s) => !s.epicId && s.status !== 'Retired');
  const epicGroups = [
    ...activeEpics.map((e) => ({
      epic: e,
      epicStories: stories.filter((s) => s.epicId === e.id && s.status !== 'Retired'),
    })),
    ...(ungroupedStories.length
      ? [{ epic: { id: '_ungrouped', title: 'No Epic' }, epicStories: ungroupedStories }]
      : []),
  ];

  const epicRows = epicGroups
    .map(({ epic, epicStories }) => {
      const isUngrouped = epic.id === '_ungrouped';
      const {
        label: statusLabel,
        chipClass,
        dotKey,
      } = isUngrouped
        ? { label: 'Planned', chipClass: 'chip-mute', dotKey: 'mute' }
        : epicCompositeStatus(epic.id, stories, bugs);

      const epicDone = epicStories.filter((s) => /^done$/i.test(s.status)).length;
      const epicTotal = epicStories.length;
      const pct = epicTotal ? Math.round((epicDone / epicTotal) * 100) : 0;

      // Epic-level cost aggregation
      let costLine = '';
      if (costs) {
        const epicProjected = epicStories.reduce((s, st) => s + ((costs[st.id] && costs[st.id].projectedUsd) || 0), 0);
        const epicSpent = epicStories.reduce((s, st) => s + ((costs[st.id] && costs[st.id].costUsd) || 0), 0);
        costLine = `<div class="sh-epic-costs epic-costs">
        <span><span class="sh-cost-label">Est.</span>&nbsp;<span class="sh-cost-val">${usdLabel(epicProjected)}</span></span>
        <span><span class="sh-cost-label">AI spend</span>&nbsp;<span class="sh-cost-val">${usdLabel(epicSpent)}</span></span>
      </div>`;
      }

      const epicRowId = `sh-epic-${esc(epic.id.replace(/[^a-zA-Z0-9]/g, '-'))}`;
      const storiesId = `${epicRowId}-stories`;
      const toggleId = `${epicRowId}-toggle`;

      // Story rows
      const storyRows = epicStories
        .map((story) => {
          const icon = /^done$/i.test(story.status) ? '✓' : '○';
          const iconColor = /^done$/i.test(story.status)
            ? 'var(--ok)'
            : /^blocked$/i.test(story.status)
              ? 'var(--risk)'
              : 'var(--warn)';
          const chipHtml =
            story.status === 'Done'
              ? ''
              : `<span class="chip ${storyChip(story.status)}">${storyLabel(story.status)}</span>`;

          const acsId = `sh-acs-${esc(story.id)}`;
          const acRows = story.acs
            .map(
              (ac) =>
                `<div class="sh-ac-row"><span class="sh-ac-id">${esc(ac.id)}</span>${ac.done ? '✓ ' : ''}${esc(ac.text)}</div>`,
            )
            .join('');
          const acToggle = story.acs.length
            ? `<button class="sh-ac-toggle" onclick="shToggle('${jsEsc(acsId)}',this)">&#9658; ${story.acs.length} AC${story.acs.length !== 1 ? 's' : ''}</button>`
            : '';
          const acsArea = story.acs.length
            ? `<div id="${esc(acsId)}" class="sh-acs-area" style="display:none">${acRows}</div>`
            : '';

          return `<div class="sh-story-row">
        <div class="sh-story-header">
          <span class="sh-story-icon" style="color:${iconColor}">${icon}</span>
          <div class="sh-story-name"><span class="sh-story-id">${esc(story.id)}</span>${esc(story.title)}</div>
          ${chipHtml}
          ${acToggle}
        </div>
        ${acsArea}
      </div>`;
        })
        .join('');

      return `<div class="sh-epic-row epic-row">
      <div class="sh-epic-header" onclick="shToggle('${jsEsc(storiesId)}', document.getElementById('${jsEsc(toggleId)}'))">
        <span class="sh-dot" style="background:${DOT_COLOR[dotKey]}"></span>
        <div class="sh-epic-name-block">
          <div class="sh-epic-name"><span class="sh-epic-id">${esc(epic.id)}</span>${esc(epic.title)}</div>
          ${costLine}
        </div>
        <div class="sh-progress-track"><div class="sh-progress-fill" style="width:${pct}%;background:${DOT_COLOR[dotKey]}"></div></div>
        <span class="sh-pct" style="color:${DOT_COLOR[dotKey]}">${pct}%</span>
        <span class="chip ${chipClass}">${statusLabel}</span>
        <span id="${esc(toggleId)}" class="sh-toggle">&#9658;</span>
      </div>
      <div id="${esc(storiesId)}" class="sh-stories-area" style="display:none">
        <div class="sh-stories-label">Stories</div>
        ${storyRows || '<div class="sh-story-empty">No stories</div>'}
      </div>
    </div>`;
    })
    .join('');

  // ── Export bar ───────────────────────────────────────────────────────────────
  const exportBar = `
  <div class="stakeholder-export-bar">
    <span class="sh-export-hint">Opens your browser's Save as PDF dialog</span>
    <button class="sh-export-btn" onclick="window.print()">Export PDF</button>
  </div>`;

  return `
  <div id="tab-stakeholder" class="p-6 hidden tab-fill" role="tabpanel" aria-labelledby="tab-btn-stakeholder">
    ${summaryBar}
    <div class="sh-milestone-section">
      <div class="sh-section-label">Milestones</div>
      <div class="sh-epics-list">
        ${epicRows}
      </div>
    </div>
    ${exportBar}
  </div>
  <script>
  function shToggle(id, toggleEl) {
    var el = document.getElementById(id);
    if (!el) return;
    var open = el.style.display !== 'none';
    el.style.display = open ? 'none' : '';
    if (toggleEl) toggleEl.innerHTML = open ? '&#9658;' : '&#9660;';
  }
  </script>`;
}
```

- [ ] **Step 2: Add `renderStakeholderTab` to `module.exports` in render-tabs.js**

Find the `module.exports` block at line 2233 (now offset due to new code) and update it:

```js
module.exports = {
  renderStatusTab,
  renderHierarchyTab,
  renderKanbanTab,
  renderTraceabilityTab,
  renderTrendsTab,
  renderChartsTab,
  renderCostsTab,
  renderBugsTab,
  renderLessonsTab,
  renderRecentActivity,
  renderStakeholderTab,
};
```

- [ ] **Step 3: Run the render-tabs tests to see them pass**

```bash
npx jest tests/unit/render-tabs.test.js --no-coverage 2>&1 | tail -20
```

Expected output: `Tests: 15 passed, 15 total`

- [ ] **Step 4: Commit**

```bash
git add tests/unit/render-tabs.test.js tools/lib/render-tabs.js
git commit -m "feat: US-0073/US-0074/US-0075/US-0076 | EPIC-0012: add renderStakeholderTab with 15 tests"
```

---

## Task 3: Add sidebar nav entry

**Files:**

- Modify: `tools/lib/render-shell.js:107-153`

- [ ] **Step 1: Add Stakeholder item to the `items` array in `renderSidebar()`**

In `tools/lib/render-shell.js`, find the `items` array starting at line 108. Add the Stakeholder entry **after** the existing `lessons` entry (just before the closing `]`):

The current last item is:

```js
    {
      id: 'lessons',
      label: 'Lessons',
      path: 'M12 18v-5.25m0 0a6.01 6.01 0 001.5-.189m-1.5.189a6.01 6.01 0 01-1.5-.189m3.75 7.478a12.06 12.06 0 01-4.5 0m3.75 2.383a14.406 14.406 0 01-3 0M14.25 18v-.192c0-.983.658-1.823 1.508-2.316a7.5 7.5 0 10-7.517 0c.85.493 1.509 1.333 1.509 2.316V18',
    },
  ];
```

Replace that closing with:

```js
    {
      id: 'lessons',
      label: 'Lessons',
      path: 'M12 18v-5.25m0 0a6.01 6.01 0 001.5-.189m-1.5.189a6.01 6.01 0 01-1.5-.189m3.75 7.478a12.06 12.06 0 01-4.5 0m3.75 2.383a14.406 14.406 0 01-3 0M14.25 18v-.192c0-.983.658-1.823 1.508-2.316a7.5 7.5 0 10-7.517 0c.85.493 1.509 1.333 1.509 2.316V18',
    },
    {
      id: 'stakeholder',
      label: 'Stakeholder',
      path: 'M18 18.72a9.094 9.094 0 003.741-.479 3 3 0 00-4.682-2.72m.94 3.198l.001.031c0 .225-.012.447-.037.666A11.944 11.944 0 0112 21c-2.17 0-4.207-.576-5.963-1.584A6.062 6.062 0 016 18.719m12 0a5.971 5.971 0 00-.941-3.197m0 0A5.995 5.995 0 0012 12.75a5.995 5.995 0 00-5.058 2.772m0 0a3 3 0 00-4.681 2.72 8.986 8.986 0 003.74.477m.94-3.197a5.971 5.971 0 00-.94 3.197M15 6.75a3 3 0 11-6 0 3 3 0 016 0zm6 3a2.25 2.25 0 11-4.5 0 2.25 2.25 0 014.5 0zm-13.5 0a2.25 2.25 0 11-4.5 0 2.25 2.25 0 014.5 0z',
    },
  ];
```

- [ ] **Step 2: Run the shell tests to confirm nothing broke**

```bash
npx jest tests/unit/render-shell.test.js --no-coverage 2>&1 | tail -10
```

Expected: all existing tests still pass.

- [ ] **Step 3: Commit**

```bash
git add tools/lib/render-shell.js
git commit -m "feat: US-0073 | EPIC-0012: add Stakeholder nav entry to sidebar"
```

---

## Task 4: Add stakeholder CSS and extend print rules

**Files:**

- Modify: `tools/lib/render-scripts.js` (two edits)

- [ ] **Step 1: Add stakeholder CSS classes before `@media print`**

In `tools/lib/render-scripts.js`, find the line:

```
  .bug-compact-row { display: flex;
```

(near line 777). Add the following CSS block **before** `@media print {` at line 740. The best insertion point is between the existing `.lesson-bug-inline summary { ... }` block and the `@media print` block. Insert after line 739 (the `.lesson-bug-inline summary { display: flex; }` line):

```css
/* EPIC-0012: Stakeholder tab ───────────────────────────── */
.sh-summary-bar {
  display: grid;
  grid-template-columns: 1fr 2fr 1fr;
  gap: 12px;
  margin-bottom: 20px;
}
.sh-tile {
  background: var(--surface);
  border: 1px solid var(--border);
  border-radius: 8px;
  padding: 12px 16px;
}
.sh-tile-wide {
  background: var(--surface);
  border: 1px solid var(--border);
  border-radius: 8px;
  padding: 12px 16px;
}
.sh-tile-label {
  font-size: 9px;
  font-weight: 600;
  letter-spacing: 0.1em;
  text-transform: uppercase;
  color: var(--text-mute);
  margin-bottom: 4px;
}
.sh-tile-value {
  display: flex;
  align-items: baseline;
  gap: 8px;
  flex-wrap: wrap;
}
.sh-big-num {
  font-family: var(--font-mono);
  font-size: 22px;
  font-weight: 600;
  color: var(--text);
}
.sh-tile-sub {
  font-size: 12px;
  color: var(--text-dim);
}
.sh-tl-dot {
  width: 10px;
  height: 10px;
  border-radius: 50%;
  flex-shrink: 0;
  display: inline-block;
}
.sh-section-label {
  font-size: 9px;
  font-weight: 600;
  letter-spacing: 0.1em;
  text-transform: uppercase;
  color: var(--text-mute);
  margin-bottom: 8px;
}
.sh-epics-list {
  display: flex;
  flex-direction: column;
  gap: 4px;
}
.sh-epic-row {
  background: var(--surface);
  border: 1px solid var(--border);
  border-radius: 8px;
  overflow: hidden;
}
.sh-epic-header {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 10px 14px;
  cursor: pointer;
}
.sh-dot {
  width: 10px;
  height: 10px;
  border-radius: 50%;
  flex-shrink: 0;
}
.sh-epic-name-block {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 2px;
}
.sh-epic-name {
  font-size: 12px;
  font-weight: 600;
  color: var(--text);
}
.sh-epic-id {
  font-family: var(--font-mono);
  font-size: 10px;
  font-weight: 500;
  color: var(--text-dim);
  margin-right: 5px;
}
.sh-epic-costs {
  display: flex;
  gap: 10px;
  font-size: 10px;
  color: var(--text-mute);
}
.sh-cost-label {
  font-size: 9px;
  text-transform: uppercase;
  letter-spacing: 0.06em;
}
.sh-cost-val {
  font-family: var(--font-mono);
  font-size: 10px;
  font-weight: 500;
  color: var(--text-dim);
}
.sh-progress-track {
  width: 72px;
  height: 6px;
  background: var(--border);
  border-radius: 3px;
  overflow: hidden;
  flex-shrink: 0;
}
.sh-progress-fill {
  height: 100%;
  border-radius: 3px;
}
.sh-pct {
  font-family: var(--font-mono);
  font-size: 11px;
  font-weight: 600;
  min-width: 32px;
  text-align: right;
  flex-shrink: 0;
}
.sh-toggle {
  font-size: 11px;
  color: var(--text-mute);
  flex-shrink: 0;
}
.sh-stories-area {
  padding: 10px 14px 12px;
  background: var(--bg-sunk);
  border-top: 1px solid var(--border);
  display: flex;
  flex-direction: column;
  gap: 5px;
}
.sh-stories-label {
  font-size: 9px;
  font-weight: 600;
  letter-spacing: 0.1em;
  text-transform: uppercase;
  color: var(--text-mute);
  margin-bottom: 3px;
}
.sh-story-row {
  background: var(--surface);
  border: 1px solid var(--border);
  border-radius: 6px;
  overflow: hidden;
}
.sh-story-header {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 7px 10px;
  cursor: default;
}
.sh-story-icon {
  font-size: 12px;
  flex-shrink: 0;
}
.sh-story-name {
  flex: 1;
  font-size: 11px;
  color: var(--text);
  min-width: 0;
}
.sh-story-id {
  font-family: var(--font-mono);
  font-size: 9px;
  font-weight: 500;
  color: var(--text-dim);
  margin-right: 4px;
}
.sh-ac-toggle {
  font-size: 10px;
  color: var(--text-mute);
  white-space: nowrap;
  flex-shrink: 0;
  background: none;
  border: none;
  cursor: pointer;
  padding: 0;
}
.sh-acs-area {
  padding: 7px 10px 8px 26px;
  background: var(--bg-sunk);
  border-top: 1px solid var(--border);
  display: flex;
  flex-direction: column;
  gap: 4px;
}
.sh-ac-row {
  font-size: 10px;
  color: var(--text);
  line-height: 1.4;
}
.sh-ac-id {
  font-family: var(--font-mono);
  font-size: 9px;
  font-weight: 500;
  color: var(--text-dim);
  margin-right: 4px;
}
.chip {
  font-size: 10px;
  padding: 2px 8px;
  border-radius: 20px;
  white-space: nowrap;
  font-weight: 500;
  flex-shrink: 0;
}
.chip-ok {
  background: var(--badge-success-bg);
  color: var(--badge-success-text);
  border: 1px solid var(--badge-success-border);
}
.chip-warn {
  background: var(--badge-warn-bg);
  color: var(--badge-warn-text);
  border: 1px solid var(--badge-warn-border);
}
.chip-risk {
  background: var(--badge-danger-bg);
  color: var(--badge-danger-text);
  border: 1px solid var(--badge-danger-border);
}
.chip-mute {
  background: var(--badge-neutral-bg);
  color: var(--badge-neutral-text);
  border: 1px solid var(--badge-neutral-border);
}
.chip-info {
  background: var(--badge-info-bg);
  color: var(--badge-info-text);
  border: 1px solid var(--badge-info-border);
}
.sh-milestone-section {
  margin-bottom: 80px;
}
.stakeholder-export-bar {
  position: fixed;
  bottom: 0;
  left: 54px;
  right: 0;
  display: none;
  align-items: center;
  justify-content: space-between;
  padding: 10px 20px;
  background: var(--surface);
  border-top: 1px solid var(--border);
  z-index: 30;
}
#tab-stakeholder.active-tab .stakeholder-export-bar,
#tab-stakeholder:not(.hidden) .stakeholder-export-bar {
  display: flex;
}
.sh-export-hint {
  font-size: 11px;
  color: var(--text-mute);
}
.sh-export-btn {
  background: var(--plan-accent);
  color: #fff;
  border: none;
  border-radius: 6px;
  padding: 6px 16px;
  font-size: 13px;
  font-weight: 600;
  cursor: pointer;
}
.sh-export-btn:hover {
  opacity: 0.88;
}
/* ─────────────────────────────────────────────────────── */
```

- [ ] **Step 2: Extend the existing `@media print` block**

Find the existing `@media print` block (lines 740–750):

```css
@media print {
  #filter-bar,
  #sidebar,
  #topbar-fixed,
  .fixed,
  .activity-panel {
    display: none !important;
  }
  body {
    padding: 0 !important;
  }
  #app-shell {
    display: block !important;
  }
  #main-content {
    display: block !important;
  }
  #tab-hierarchy,
  #tab-costs {
    display: block !important;
  }
  #tab-kanban,
  #tab-traceability,
  #tab-charts,
  #tab-bugs,
  #tab-lessons {
    display: none !important;
  }
  body {
    font-size: 11pt;
  }
  .bg-slate-900 {
    background: white !important;
    color: black !important;
  }
  .text-white,
  .text-blue-400,
  .text-slate-400 {
    color: black !important;
  }
}
```

Replace it with:

```css
@media print {
  #filter-bar,
  #sidebar,
  #topbar-fixed,
  .fixed,
  .activity-panel {
    display: none !important;
  }
  body {
    padding: 0 !important;
  }
  #app-shell {
    display: block !important;
  }
  #main-content {
    display: block !important;
  }
  #tab-hierarchy,
  #tab-costs {
    display: block !important;
  }
  #tab-kanban,
  #tab-traceability,
  #tab-charts,
  #tab-bugs,
  #tab-lessons {
    display: none !important;
  }
  body {
    font-size: 11pt;
  }
  .bg-slate-900 {
    background: white !important;
    color: black !important;
  }
  .text-white,
  .text-blue-400,
  .text-slate-400 {
    color: black !important;
  }
  /* Stakeholder print rules */
  #tab-stakeholder {
    display: block !important;
  }
  #tab-status,
  #tab-hierarchy,
  #tab-costs,
  #tab-kanban,
  #tab-traceability,
  #tab-charts,
  #tab-bugs,
  #tab-trends,
  #tab-lessons {
    display: none !important;
  }
  .stakeholder-export-bar {
    display: none !important;
  }
  .epic-costs {
    display: flex !important;
  }
}
```

- [ ] **Step 3: Run the full test suite to confirm nothing broke**

```bash
npx jest --no-coverage 2>&1 | tail -15
```

Expected: all existing tests still pass, render-tabs.test.js shows 15 passed.

- [ ] **Step 4: Commit**

```bash
git add tools/lib/render-scripts.js
git commit -m "feat: US-0076 | EPIC-0012: add stakeholder CSS and print rules"
```

---

## Task 5: Wire render-html.js

**Files:**

- Modify: `tools/lib/render-html.js:22` (import)
- Modify: `tools/lib/render-html.js:500` (call site in tab-content)

- [ ] **Step 1: Add `renderStakeholderTab` to the import from render-tabs**

Find the existing import block at lines 15–23:

```js
const {
  renderStatusTab,
  renderHierarchyTab,
  renderKanbanTab,
  renderTraceabilityTab,
  renderChartsTab,
  renderTrendsTab,
  renderCostsTab,
  renderBugsTab,
  renderLessonsTab,
  renderRecentActivity,
} = require('./render-tabs');
```

Add `renderStakeholderTab` to the destructure:

```js
const {
  renderStatusTab,
  renderHierarchyTab,
  renderKanbanTab,
  renderTraceabilityTab,
  renderChartsTab,
  renderTrendsTab,
  renderCostsTab,
  renderBugsTab,
  renderLessonsTab,
  renderRecentActivity,
  renderStakeholderTab,
} = require('./render-tabs');
```

- [ ] **Step 2: Call `renderStakeholderTab` in the tab-content block**

Find the tab-content block at lines 491–501:

```js
<div id="tab-content">
  ${renderStatusTab(data)}${renderHierarchyTab(data)}${renderKanbanTab(data)}${renderTraceabilityTab(data)}$
  {renderChartsTab(data)}${renderTrendsTab(data, options)}${renderCostsTab(data, options)}${renderBugsTab(data)}$
  {renderLessonsTab(data)}
</div>
```

Replace with:

```js
<div id="tab-content">
  ${renderStatusTab(data)}${renderHierarchyTab(data)}${renderKanbanTab(data)}${renderTraceabilityTab(data)}$
  {renderChartsTab(data)}${renderTrendsTab(data, options)}${renderCostsTab(data, options)}${renderBugsTab(data)}$
  {renderLessonsTab(data)}${renderStakeholderTab(data)}
</div>
```

- [ ] **Step 3: Run the full test suite**

```bash
npx jest --coverage 2>&1 | tail -25
```

Expected:

- All tests pass (≥953 + 15 new = ≥968)
- Statement coverage remains above 80%
- `render-tabs.test.js`: 15 passed

- [ ] **Step 4: Run the dashboard generator to confirm no runtime errors**

```bash
node tools/generate-plan.js 2>&1 | tail -10
```

Expected: Exits 0 with `[generate-plan] Done.` — no uncaught exceptions.

- [ ] **Step 5: Commit**

```bash
git add tools/lib/render-html.js
git commit -m "feat: US-0073/US-0074/US-0075/US-0076 | EPIC-0012: wire renderStakeholderTab into render-html"
```

---

## Task 6: Final verification and PR

**Files:** None — housekeeping only.

- [ ] **Step 1: Run full test suite with coverage**

```bash
npx jest --coverage 2>&1 | grep -E "Tests:|Statements:|pass|fail"
```

Expected:

- `Tests: ≥968 passed`
- `Statements: ≥80%`

- [ ] **Step 2: Run Prettier**

```bash
npx prettier --write tools/lib/render-tabs.js tools/lib/render-shell.js tools/lib/render-scripts.js tools/lib/render-html.js tests/unit/render-tabs.test.js
```

- [ ] **Step 3: Commit Prettier formatting**

```bash
git add tools/lib/render-tabs.js tools/lib/render-shell.js tools/lib/render-scripts.js tools/lib/render-html.js tests/unit/render-tabs.test.js
git commit -m "style: EPIC-0012: prettier format stakeholder tab files"
```

- [ ] **Step 4: Open PR to develop**

```bash
git push -u origin claude/gifted-johnson-5e162a
gh pr create \
  --base develop \
  --title "feat: EPIC-0012 Stakeholder View (US-0073–US-0076)" \
  --body "$(cat <<'EOF'
## Summary

- Adds dedicated **Stakeholder** tab to the sidebar nav (US-0073)
- Milestone progress view: expandable epic rows with story + AC drill-down, plain-language status labels (US-0074)
- Budget summary tile with traffic-light indicator and burn-rate narrative (US-0075)
- PDF export via `window.print()` with stakeholder-specific print CSS (US-0076)

## Files changed

| File | Change |
|------|--------|
| `tools/lib/render-tabs.js` | +`renderStakeholderTab(data)` (~170 lines) |
| `tools/lib/render-shell.js` | Stakeholder nav item added |
| `tools/lib/render-scripts.js` | Stakeholder CSS + extended `@media print` |
| `tools/lib/render-html.js` | Import + call site wired |
| `tests/unit/render-tabs.test.js` | New file — 15 tests |

## Test plan

- [ ] `npx jest tests/unit/render-tabs.test.js` — 15 new tests pass
- [ ] `npx jest --coverage` — all existing tests still pass, coverage ≥80%
- [ ] `node tools/generate-plan.js` — generates without errors
- [ ] Open generated `plan-status.html` in browser — Stakeholder tab visible in sidebar
- [ ] Click each epic row — expands to show stories
- [ ] Click a story with ACs — expands to show ACs
- [ ] Click **Export PDF** — browser print dialog opens
- [ ] Dark mode toggle — colors adapt correctly

🤖 Generated with [Claude Code](https://claude.com/claude-code)
EOF
)"
```

---

## Self-Review Checklist

**Spec coverage:**

- US-0073 Stakeholder sidebar tab ✓ (Task 3 + Task 5)
- US-0074 Milestone progress view with story + AC drill-down ✓ (Task 2)
- US-0075 Budget summary tile with traffic-light ✓ (Task 2)
- US-0076 PDF export via window.print() ✓ (Task 2 + Task 4)
- Epic progress % = Done/non-Retired ✓ (Task 2 `epicCompositeStatus`)
- Epic-level cost aggregation (Est. + AI spend) ✓ (Task 2 `costLine`)
- Cost line hidden when `data.costs` null ✓ (Task 2 + Test 7)
- Burn rate narrative shown only when budget configured ✓ (Task 2 `budgetNarrative`)
- Plain language status mapping table ✓ (Task 2 `STATUS_LABELS`)
- Epic status from story composition ✓ (Task 2 `epicCompositeStatus`)
- Hidden technical fields (branch, tokens, TC IDs) ✓ (Test 12 + renderer never emits them)
- Summary bar 3 tiles (1fr 2fr 1fr) ✓ (Task 4 CSS + Task 2 HTML)
- Progress tile: % + `N of M stories done` inline ✓ (Task 2)
- Budget tile: dot + On track + Est. + AI spend + burn rate ✓ (Task 2)
- Risk tile: bug + blocked story counts ✓ (Task 2)
- Milestone epic rows at 4px gap ✓ (Task 4 `.sh-epics-list gap:4px`)
- Export bar fixed position left:54px ✓ (Task 4 CSS)
- Retired epics excluded ✓ (Task 2 `filter e.status !== 'Retired'`)
- `_ungrouped` appears last ✓ (Task 2 sort + Test 15)
- @media print hides all other tabs + shows stakeholder ✓ (Task 4)
- 15 tests ✓

**Placeholder scan:** No TBD/TODO in plan — all steps have complete code.

**Type consistency:** `renderStakeholderTab` export name consistent across render-tabs.js, render-html.js import, and test require. `usdLabel()` helper is local to the function (not exported, not conflicting with global `usd()`). `shToggle()` is the client-side JS toggle — consistent with `sh-` prefix used throughout.
