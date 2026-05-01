# Session 33 Design — EPIC-0023 Closure + Low-Severity Bug Sweep

**Date:** 2026-04-29  
**Epic:** EPIC-0023 (Dashboard Quality & Reliability)  
**Status:** Approved

---

## Scope

Three parallel implementation groups targeting distinct files:

| Group | Files                                               | Work Items                                 |
| ----- | --------------------------------------------------- | ------------------------------------------ |
| A     | `tools/lib/render-tabs.js`, `tools/lib/snapshot.js` | US-0164 (AC-0591–0594), BUG-0242, BUG-0244 |
| B     | `tools/generate-dashboard.js`                       | US-0166 AC-0600                            |
| C     | `docs/RELEASE_PLAN.md`                              | EPIC-0010/0012 audit, EPIC-0023 closure    |

---

## Group A — Chart Correctness + Bug Fixes

### US-0164: Chart axis label/color correctness

**AC-0591 — Chart.defaults.color via getComputedStyle**  
At chart-init time, resolve the color via:

```js
getComputedStyle(document.documentElement).getPropertyValue('--text-mute').trim();
```

Assign this resolved value to `Chart.defaults.color` and `Chart.defaults.borderColor`, not the raw `'var(--text-mute)'` string. Canvas `fillStyle` cannot resolve CSS custom properties.

**AC-0592 — Gradient color stops: comma syntax**  
Replace all `rgb(r g b / a)` space-separated gradient stop strings with `rgba(r, g, b, a)` comma-separated syntax for cross-browser canvas compatibility.

**AC-0593 — pvChartColors singleton**  
Change the second declaration in `renderChartsTab` from:

```js
var pvChartColors = (function(){...})()
```

to:

```js
window.pvChartColors = window.pvChartColors || (function(){...})()
```

The first tab to render wins; the second is a no-op. Prevents silent overwrite from the `var` global re-declaration.

**AC-0594 — Theme-switch updates trend chart colors**  
Add `updateTrendsChartTheme()` that:

1. Re-reads computed color values via `getComputedStyle`
2. Updates `chart.options.scales.x.ticks.color`, `chart.options.scales.y.ticks.color`, `chart.options.scales.x.grid.color`, `chart.options.scales.y.grid.color` for each trend chart
3. Calls `chart.update()`

Call `updateTrendsChartTheme()` from `pvSetTheme()`.

### BUG-0242 — Week label month boundary

**File:** `render-tabs.js` ~line 2464  
**Fix:** Prefix `wEnd.getDate()` with `MONTHS[wEnd.getMonth()] + ' '` when `wEnd.getMonth() !== wStart.getMonth()`:

```js
const endLabel =
  wEnd.getMonth() !== wStart.getMonth() ? `${MONTHS[wEnd.getMonth()]} ${wEnd.getDate()}` : `${wEnd.getDate()}`;
const label = `${MONTHS[wStart.getMonth()]} ${wStart.getDate()}–${endLabel}`;
```

### BUG-0244 — openBugs series uses allowlist

**File:** `tools/lib/snapshot.js` ~line 136  
**Fix:** Replace:

```js
b.status === 'Open' || b.status === 'In Progress';
```

with:

```js
!/^(Fixed|Retired|Cancelled|Rejected)/i.test(b.status);
```

Aligns with the canonical denylist used everywhere else in the codebase.

---

## Group B — \_dispatchCount localStorage Persistence

### US-0166 AC-0600

**File:** `tools/generate-dashboard.js`

On init (after `var _dispatchCount = 0`):

```js
_dispatchCount = parseInt(localStorage.getItem('pv-dispatch-count') || '0', 10);
// seed display element with persisted value
var _dispEl = document.getElementById('conductor-dispatch-count');
if (_dispEl) _dispEl.textContent = _dispatchCount + ' dispatched';
```

On each increment in `setConductorActive`:

```js
_dispatchCount++;
localStorage.setItem('pv-dispatch-count', _dispatchCount);
```

---

## Group C — RELEASE_PLAN.md Docs Audit

### EPIC-0010 (Risk Analytics)

- Current status: `Planned` (incorrect — shipped Session 23)
- Fix: `Status: Planned` → `Status: Done`, add `DoneDate: 2026-04-19`
- Deferred ACs: AC-0190, AC-0193, AC-0201, AC-0202, AC-0203 (sort/filter UI enhancements)
- US-0068 (Monte Carlo): remains `Status: Planned` — complex, not built
- Action: Log deferred sort/filter ACs as new story `US-0169` under a future epic

### EPIC-0012 (Stakeholder View)

- Current status: `Done` (correct) but `DoneDate` is missing
- Fix: add `DoneDate: 2026-04-28`
- US-0077 (email digests) and US-0078 (password protection): remain `Planned` — out-of-scope for core delivery, no action needed

### EPIC-0023 (Dashboard Quality & Reliability)

- After Groups A + B merge: `Status: In-Progress` → `Status: Done`, add `DoneDate: 2026-04-29`
- Mark US-0164 `Status: Done`, check all ACs `[x]`
- Mark US-0166 `Status: Done`, check AC-0600 `[x]`

---

## Merge Strategy

Three PRs into `develop`:

1. `feature/US-0164-BUG-0242-0244-chart-fixes` (Group A) — render-tabs.js + snapshot.js
2. `feature/US-0166-AC-0600-dispatch-persistence` (Group B) — generate-dashboard.js
3. `docs/session33-epic-closure` (Group C) — RELEASE_PLAN.md only

All three run in parallel worktree sub-agents. CI gates: Lint + Test + Coverage (≥80%) + Prettier + Audit.
