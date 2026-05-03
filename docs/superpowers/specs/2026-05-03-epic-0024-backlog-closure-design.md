# EPIC-0024 Backlog Closure — Design Spec

**Date:** 2026-05-03
**Session:** 37
**Stories:** US-0056, US-0169, US-0116, US-0117
**Next IDs at writing time:** EPIC-0024, US-0170, AC-0606, TC-0553, BUG-0253, L-0054

---

## Overview

EPIC-0024 closes the remaining Planned stories from earlier epics before EPIC-0025 begins. Three independent work streams shipped as separate feature PRs to `develop`.

---

## US-0056 — Trends Tab Date-Range Picker

### Problem

The existing `setTrendsRange(All/90d/30d/7d)` buttons slice charts by **snapshot count** (last N entries), not by calendar date. Users cannot select an arbitrary date window.

### Design

**UI:** Two `<input type="date">` fields (`id="trends-date-from"`, `id="trends-date-to"`) added to the right side of the existing `.trends-filter-bar` div. Label reads `From` / `To`. On mobile (`<640px`) the inputs wrap below the buttons.

**Logic:** A new `applyTrendsFilter()` helper replaces the body of `setTrendsRange`. It accepts either a count-based mode (buttons) or a date-range mode (inputs):

```
applyTrendsFilter({ mode: 'count', n })
applyTrendsFilter({ mode: 'date', from, to })
```

Both paths:

1. Compute `start` and `end` indices into `_trendsAllLabels` (ISO timestamp strings).
2. Slice `_trendsAllLabels` and each chart's `_allData[i]` to that window.
3. Call `ch.update('none')` on every chart except `chart-velocity-weekly` (ISO week labels — guard unchanged).

**Count mode** maps: `n = 'all'` → full array; else clamp to array length.

**Date mode** maps: find the first index where `label >= from` and last where `label <= to + "T23:59:59"`.

**State persistence:**

- Preset button active state saved to `localStorage('pv-trends-range')` (unchanged key).
- Date inputs saved to `localStorage('pv-trends-date-from')` / `localStorage('pv-trends-date-to')`.
- On `initTrendsCharts()`, restore whichever was last used.

**Interaction:** Typing in either date input clears the active-button state and calls `applyTrendsFilter({ mode: 'date', ... })`. Clicking a preset button clears both date inputs and calls count mode.

### Acceptance Criteria (new IDs)

- **AC-0606:** A `From` and `To` date input appear in the Trends filter bar beside the preset buttons.
- **AC-0607:** Selecting a date range filters all trend charts to snapshots within that window.
- **AC-0608:** Clicking a preset button (All/90d/30d/7d) clears the date inputs and restores count-based slicing.
- **AC-0609:** Date range selection persists in `localStorage`; it is restored on next page load.
- **AC-0610:** The `chart-velocity-weekly` chart is excluded from date-range filtering (ISO week axis incompatibility).

### Files changed

- `tools/lib/render-tabs.js` — add date inputs to filter bar HTML; replace `setTrendsRange` body with `applyTrendsFilter` wrapper.
- `tests/render-tabs.test.js` — unit tests for `applyTrendsFilter` date-mode index computation (via jsdom).

---

## US-0169 — Hierarchy Tab Risk UI Enhancements

### Problem

Risk scores are computed but their Hierarchy-tab surfacing is minimal (inline badge in story title). The five deferred ACs from EPIC-0010 need to land.

### Design

#### AC-0601 — Sort stories by risk score descending

A `Sort by Risk ↓` button added to the Hierarchy tab filter bar. Server-side render stamps each story `<tr>` with `data-risk-score="N.N"` and `data-risk-level="Low|Medium|High|Critical"`. The button triggers a client-side sort of `<tr>` elements within each `<tbody>` by `parseFloat(data-risk-score)` descending. A second click restores original DOM order (saved as `data-original-index`). Button text toggles between `Sort by Risk ↓` and `Restore Order`.

Stories with no risk score (Done/Retired/Cancelled) sort to the bottom in risk mode.

#### AC-0602 — Reference line on avg-risk trend chart

In `initTrendsCharts()`, the `chart-trends-avg-risk` chart gains a third dataset:

```js
{ label: 'High threshold', data: _trendsAllData.avgRisk.map(() => 2.0),
  borderColor: pvChartColors.risk, borderDash: [6,3], borderWidth: 1,
  backgroundColor: 'transparent', pointRadius: 0, fill: false }
```

The dataset is excluded from `_allData` slicing guard (constant value — slice is irrelevant but harmless). Legend shows it as a dashed entry labelled `High threshold`.

`setTrendsRange` / `applyTrendsFilter` must regenerate the constant array after slicing, since its length must match the label window. Solution: mark this dataset with `_isRefLine: true`; the filter loop regenerates it as `new Array(n).fill(2.0)` instead of slicing `_allData`.

#### AC-0603 — Epic header aggregate risk badge

In `renderHierarchyTab`, after looking up epic stories, compute:

```js
const epicRisk = data.risk && data.risk.byEpic ? data.risk.byEpic.get(epicId) : null;
```

If non-null and the epic is not Done/Retired, append to the epic header:

```html
<span class="risk-score-badge ml-2" style="color:{RISK_LEVEL_COLORS[epicRisk.level]}">
  {epicRisk.level} {epicRisk.avgScore.toFixed(1)}
</span>
```

#### AC-0604 — Epics sorted by risk score descending by default

In `renderHierarchyTab`, before the epic group iteration, sort epic IDs by `byEpic.get(id)?.avgScore ?? -1` descending. `_ungrouped` always last (existing rule preserved). This is server-side render order — no JS needed.

#### AC-0605 — Filter: show only High/Critical risk epics

Add a `<select id="hier-risk-filter">` to the Hierarchy filter bar:

```
<option value="all">All Risk Levels</option>
<option value="high">High+</option>
<option value="critical">Critical only</option>
```

`onchange` handler hides/shows `.epic-block` elements based on whether the epic's aggregate risk level meets the threshold. Level stored as `data-epic-risk-level` attribute on `.epic-block`. Stories in hidden epics are excluded from any visible count.

### Files changed

- `tools/lib/render-tabs.js` — epic block `data-epic-risk-level`, story row `data-risk-score` / `data-risk-level` / `data-original-index`, epic sort logic, epic header badge, filter bar additions, JS sort + filter functions.
- `tools/lib/render-scripts.js` — `_isRefLine` guard in chart filter loop; reference line dataset in `chart-trends-avg-risk`.
- `tests/render-tabs.test.js` — epic sort order, badge presence, filter attribute tests.

---

## US-0116 — Lap History Strip

### Schema addition

`sdlc-status.json` gains `cycles: []`. The `cycle-complete` handler in `update-sdlc-status.js` snapshots the completed cycle before calling `resetSession`:

```json
{
  "id": 1,
  "implementationTarget": "US-0115",
  "startedAt": "2026-04-01T10:00:00Z",
  "endedAt": "2026-04-01T18:00:00Z",
  "phaseTimings": {
    "Blueprint": 900,
    "Link": 300,
    "Architect": 14400,
    "Stylize": 3600,
    "Trigger": 1800,
    "Review": 1200
  },
  "outcome": "success",
  "incidents": 0
}
```

Retention: `cycles.slice(-50)` applied on every write.

### Dashboard rendering (Tier B)

`generate-dashboard.js` renders a `<div class="pv-lap-strip">` in Tier B (below the agent workload row). Each cycle is a `<div class="pv-lap-bar">` containing 6 phase segments sized proportionally to phase duration. CSS: `display:flex; height:32px; border-radius:4px; overflow:hidden`. Failed outcome: phase segments that exceed avg by >50% render `var(--clr-risk)`.

Tooltip on hover: `"Cycle N · US-XXXX · HH:MM · Xd ago"` — implemented as `title` attribute (no JS tooltip library needed). Clicking a bar sets `data-cycle-id` on a `<dialog id="pv-cycle-detail">` and opens it.

Cycle detail dialog: table of per-phase timings + outcome + incidents. Close button or `Escape` dismisses.

Shows last 10 cycles; if fewer exist, shows what is available with a `—` placeholder for empty slots.

### Files changed

- `update-sdlc-status.js` — `cycle-complete` handler, `cycles` retention logic.
- `generate-dashboard.js` — lap-strip HTML renderer.
- `tests/update-sdlc-status.test.js` — cycles[] population, retention cap.
- `tests/generate-dashboard.test.js` — lap-strip render with 0, 1, 10+ cycles.

---

## US-0117 — Telemetry Row + Completion Animation

### Telemetry row (Tier C)

A `<div class="pv-telemetry-row">` below Tier B. Four stat tiles in `Departure Mono` tracked-out muted text:

```
AVG CYCLE TIME   CYCLES TODAY   INCIDENTS   SUCCESS RATE
    4h 12m            3             1          91.2%
```

Values derived from `cycles[]`:

- **AVG CYCLE TIME:** mean of `(endedAt - startedAt)` across all cycles.
- **CYCLES TODAY:** count where `endedAt` date equals today (UTC).
- **INCIDENTS:** sum of `incidents` across all cycles.
- **SUCCESS RATE:** `cycles.filter(c => c.outcome === 'success').length / cycles.length * 100`.

### Completion animation

When `patchDOM` receives `{ type: 'cycle-complete' }`:

1. All 6 phase cells flash to `var(--clr-ok)` for 300ms (`pv-phase-flash` keyframe).
2. A green overlay sweeps left-to-right across the conductor header (`pv-sweep` keyframe, 600ms).
3. The cycle counter (`#conductor-dispatch-count`) increments with a `pv-flip` keyframe (translateY −100% → 0, 150ms).
4. New lap bar is prepended to `#pv-lap-strip` via `insertAdjacentHTML('afterbegin', ...)`.

### Audio chime — **deferred**

AC-0395 requires `alert-mute` preference. That preference does not exist in the current schema. Audio deferred to a follow-on story.

### Files changed

- `generate-dashboard.js` — telemetry row renderer, animation CSS keyframes.
- `tests/generate-dashboard.test.js` — telemetry stat computation, animation class assertions.

---

## Delivery order

| Story   | Branch                                 | Depends on                |
| ------- | -------------------------------------- | ------------------------- |
| US-0056 | `feature/US-0056-trends-date-range`    | none                      |
| US-0169 | `feature/US-0169-hierarchy-risk-ui`    | none                      |
| US-0116 | `feature/US-0116-lap-history-strip`    | none                      |
| US-0117 | `feature/US-0117-telemetry-completion` | US-0116 (cycles[] schema) |

US-0056 and US-0169 are fully independent. US-0116 must merge before US-0117 (schema dependency).

---

## Out of scope

- Audio chime (AC-0395) — deferred pending alert-mute preference story.
- The duplicate `AC-0165` ID in the Planned US-0056 RELEASE_PLAN.md entry — corrected to AC-0606–AC-0610 in this spec; RELEASE_PLAN.md will be updated when the branch is created.
