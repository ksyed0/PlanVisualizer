# Design Spec — Bug Fixes (BUG-0227–0232) + US-0159 Velocity Chart

**Date:** 2026-04-28  
**Session:** 31  
**Status:** Approved

---

## Scope

Fix 6 open bugs discovered by the EPIC-0021 TC audit and implement the US-0159 Velocity Chart from EPIC-0022.

### Items in scope

| ID       | Title                                                              | Type  | Priority  |
| -------- | ------------------------------------------------------------------ | ----- | --------- |
| BUG-0229 | `plan:generate` / `plan:watch` npm scripts missing                 | Bug   | Low       |
| BUG-0227 | `docs/AGENT_PLAN.md` does not exist                                | Bug   | Medium    |
| BUG-0228 | `dashboard.html` loads Google Fonts from CDN                       | Bug   | Medium    |
| BUG-0230 | `plan-status.html` loads Tailwind, Chart.js, Google Fonts from CDN | Bug   | Medium    |
| US-0160  | Remove Tailwind from plan-status (folded into BUG-0230)            | Story | Low/P2    |
| BUG-0231 | Conductor card missing dispatch counter element                    | Bug   | Low       |
| BUG-0232 | Agent Workload widget missing `(N done)` sub-label                 | Bug   | Low       |
| US-0159  | Velocity Chart in Trends tab                                       | Story | Medium/P1 |

---

## Bug Fix Designs

### BUG-0229 — npm script aliases

**File:** `package.json`

Add two alias entries to the `scripts` object:

```json
"plan:generate": "node tools/generate-plan.js",
"plan:watch":    "node tools/generate-plan.js --watch"
```

The existing `generate` and `generate:watch` scripts remain unchanged. These aliases satisfy AC-0304. One commit, no tests needed beyond running `npm run plan:generate` successfully.

---

### BUG-0227 — Create `docs/AGENT_PLAN.md`

**File:** `docs/AGENT_PLAN.md` (new)

Content distilled entirely from `DM_AGENT.md` — no new invention. Structure:

1. **6-Phase Pipeline overview table** — Blueprint → Architect → Build → Integration → Test → Polish, with one-line purpose per phase.
2. **Phase entry/exit criteria** — one section per phase listing: what must be true to enter, what must be true to exit (e.g. Build entry: spec approved + implementation plan written; exit: all tests pass at ≥80% coverage).
3. **PR Review Lifecycle** — `gh pr create` → Lens review (commented) → CI gates (Lint, Test+Coverage, Build, Prettier, Audit, CodeQL, Secret Scan) → `gh pr merge --auto --squash --delete-branch`.
4. **BLOCK Recovery Protocol** — if a story blocks: diagnose root cause, respawn Pixel with full conflict context, max 1 retry; if still blocked escalate to Conductor.

Target length: 150–200 lines Markdown. No new policy invented — all content sourced from `DM_AGENT.md`.

---

### BUG-0228 — Remove Google Fonts from `docs/dashboard.html`

**File:** `tools/generate-dashboard.js`

Remove the three Google Fonts `<link>` tags from the generated `<head>`:

```html
<!-- REMOVE these three lines -->
<link rel="preconnect" href="https://fonts.googleapis.com" />
<link
  rel="stylesheet"
  href="https://fonts.googleapis.com/css2?family=Departure+Mono&family=Geist:wght@400;500;600;700&display=swap"
/>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=JetBrains+Mono:wght@400;500;600&display=swap" />
```

Replace with a system font stack in the `<style>` block:

- Code/mono elements: `font-family: ui-monospace, 'JetBrains Mono', 'Cascadia Code', 'Fira Code', monospace`
- Body/UI elements: `font-family: system-ui, -apple-system, 'Segoe UI', sans-serif`

Regenerate `docs/dashboard.html`. Verify: `grep "fonts.googleapis" docs/dashboard.html` returns no matches.

---

### BUG-0230 + US-0160 — Remove CDN dependencies from `plan-status.html`

**File:** `tools/lib/render-html.js` (all three CDN tags are on lines 43–48 of this file)

Three CDN dependencies to eliminate:

#### 1. Tailwind CDN (AC-0581)

Remove from `render-html.js` (lines 43–44):

```html
<!-- REMOVE -->
<script src="https://cdn.tailwindcss.com"></script>
<script>
  tailwind.config = { darkMode: 'class' };
</script>
```

Replace all Tailwind utility classes in render output with named CSS classes:

- **Budget alert banner** — replace `bg-red-900/30 text-red-300 border border-red-700` etc. with `.budget-alert { background: var(--clr-danger-bg); color: var(--clr-danger-text); border: 1px solid var(--clr-danger-border); }`
- **Filter bar** — replace flex/spacing/color utilities with `.filter-bar { display:flex; gap:8px; ... }` using `var(--clr-*)` tokens
- **Search input** — replace `bg-slate-800 text-slate-200 border-slate-600 focus:ring-violet-500` with `.search-input { background: var(--bg-input); color: var(--text-primary); border: 1px solid var(--border); }` with `:focus` using `var(--clr-accent)`

Dark mode via `[data-theme=dark]` selectors (AC-0583), not Tailwind `dark:` variants.

#### 2. Chart.js CDN

Chart.js is already inlined in the generated file (confirmed: 21 references). Remove only the CDN `<script>` tag:

```html
<!-- REMOVE if present -->
<script src="https://cdn.jsdelivr.net/npm/chart.js@4/dist/chart.umd.min.js"></script>
```

Ensure render logic references only the inline Chart.js bundle.

#### 3. Google Fonts CDN

Same fix as BUG-0228 — replace with system font stack.

**Verification:** `grep "cdn.tailwindcss\|cdn.jsdelivr\|googleapis" docs/plan-status.html` returns no matches.

**Mark US-0160 Done** in `docs/RELEASE_PLAN.md` after fix is confirmed.

---

### BUG-0231 — Conductor dispatch counter

**File:** `tools/generate-dashboard.js`

The Conductor card renders via the `renderAgentRow` template. The Conductor row uses `data-agent-name="Conductor"` but `setConductorActive()` queries `[data-agent="Conductor"]` — the attribute names are inconsistent. Fix both:

1. In the agent row template, add `data-agent="${esc(name)}"` alongside the existing `data-agent-name` (keep both for backward compat with tests).
2. Add a dispatch counter element inside the Conductor card's `agent-info > mc-agent-identity` div:

```html
<div class="conductor-dispatch-count" id="conductor-dispatch-count">0 dispatched</div>
```

3. In `setConductorActive(dispatchMsg)`, increment a module-level counter and update the element:

```js
var _dispatchCount = 0;
function setConductorActive(dispatchMsg) {
  _dispatchCount++;
  var el = document.getElementById('conductor-dispatch-count');
  if (el) el.textContent = _dispatchCount + ' dispatched';
  // ... existing active/hold logic unchanged
}
```

4. Add CSS: `.conductor-dispatch-count { font-size: 11px; color: var(--text-muted); margin-top: 2px; }`

---

### BUG-0232 — Agent Workload `(N done)` sub-label

**File:** `tools/generate-dashboard.js`, `renderAgentWorkload()` (~line 218)

Current code computes `inFlight` but never renders a done count. Change:

```js
// BEFORE
const inFlight = assigned.filter((s) => !/done|complete/i.test(s.status || '')).length;
// row only shows inFlight count

// AFTER
const inFlight = assigned.filter((s) => !/done|complete/i.test(s.status || '')).length;
const done = total - inFlight;
// row appends: <span class="pv-workload-done">(${done} done)</span>
```

Updated row template:

```js
`<div class="pv-workload-row">` +
  `<span class="pv-workload-name">${esc(name)}</span>` +
  `<div class="pv-workload-track"><div class="pv-workload-bar" style="width:${pct}%"></div></div>` +
  `<span class="pv-workload-count">${inFlight}</span>` +
  `<span class="pv-workload-done">(${done} done)</span>` +
  `</div>`;
```

Add CSS: `.pv-workload-done { font-size: 10px; color: var(--text-muted); min-width: 52px; }`

---

## US-0159 — Velocity Chart Design

### Data Pipeline

**File:** `tools/lib/snapshot.js`

Add a new exported function `velocityByWeek(snapshots)`:

```
Input:  snapshots[]  (same array passed to extractTrends)
Output: { labels: string[], points: number[], rollingAvg: number[] }
```

**Algorithm:**

1. If fewer than 2 snapshots, return `{ labels: [], points: [], rollingAvg: [] }`.
2. Group snapshots by ISO week label derived from `generatedAt`:
   - `const week = isoWeek(new Date(s.generatedAt))` → `"2026-W17"`
   - Take the snapshot with the highest cumulative velocity (t-shirt points) per week as the week representative.
3. Sort weeks chronologically.
4. Compute per-week delta: `points[i] = weekMax[i].cumulativeVelocity - weekMax[i-1].cumulativeVelocity`
   - For the first week: `points[0] = weekMax[0].cumulativeVelocity` (all points from the start)
   - Clamp negative deltas to 0 (retroactive story status changes can't reduce velocity)
5. Compute 4-period rolling average:
   - `rollingAvg[i] = mean(points[max(0, i-3) .. i])` (uses available data for first 3 periods)
   - Round to 1 decimal.
6. Return `{ labels, points, rollingAvg }`.

**T-shirt point scale** (same as existing `extractTrends`): `{ XS: 0.5, S: 1, M: 3, L: 5, XL: 8 }`

**Attach to trends object** in `generate-plan.js`:

```js
data.trends.velocityByWeek = velocityByWeek(snapshots);
```

**ISO week helper** — implement inline (no external dependency):

```js
function isoWeek(date) {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  d.setUTCDate(d.getUTCDate() + 4 - (d.getUTCDay() || 7));
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  const week = Math.ceil(((d - yearStart) / 86400000 + 1) / 7);
  return `${d.getUTCFullYear()}-W${String(week).padStart(2, '0')}`;
}
```

---

### Rendering

**File:** `tools/lib/render-tabs.js`, `renderTrendsTab()`

Add a new chart section after the existing "Story Velocity" chart. Keep the existing cumulative chart (rename label to "Cumulative Story Points" for clarity). The new chart:

- **Title:** "Weekly Velocity"
- **Canvas id:** `chart-velocity-weekly`
- **Container:** `<div style="height:250px;position:relative"><canvas id="chart-velocity-weekly"></canvas></div>`
- **Empty state:** If `!data.trends || !data.trends.velocityByWeek || data.trends.velocityByWeek.labels.length < 2`, render a `<p class="text-muted">Not enough snapshot data yet.</p>` placeholder.

**Inline JS data** (alongside existing trend data vars):

```js
const velWeeklyLabels = JSON.stringify(data.trends.velocityByWeek?.labels ?? []);
const velWeeklyPoints = JSON.stringify(data.trends.velocityByWeek?.points ?? []);
const velWeeklyAvg = JSON.stringify(data.trends.velocityByWeek?.rollingAvg ?? []);
```

**Chart initialisation** in `initTrendsCharts()`:

```js
_mkTrend('chart-velocity-weekly', {
  type: 'bar',
  data: {
    labels: JSON.parse(velWeeklyLabels),
    datasets: [
      {
        type: 'bar',
        label: 'Points completed',
        data: JSON.parse(velWeeklyPoints),
        backgroundColor: pvChartColors.info,
      },
      {
        type: 'line',
        label: '4-wk rolling avg',
        data: JSON.parse(velWeeklyAvg),
        borderColor: pvChartColors.warn,
        borderWidth: 2,
        pointRadius: 3,
        tension: 0.3,
        fill: false,
      },
    ],
  },
  options: { scales: { y: { title: { display: true, text: 't-shirt points' } } } },
});
```

**Theme compliance (AC-0580):** Uses only `pvChartColors.info` and `pvChartColors.warn` from `theme.js`. No hardcoded hex literals. Chart inherits `[data-theme=dark]` grid/label colours from existing `_mkTrend` helper.

---

### Test Coverage

**`__tests__/snapshot.test.js`** — new `velocityByWeek` tests:

- Returns empty arrays for 0 or 1 snapshot
- Single week: points[0] = cumulative velocity of that week
- Two weeks same ISO week: uses the snapshot with higher cumulative velocity
- Negative delta clamped to 0
- Rolling average: first period = points[0], second period = mean(points[0..1]), etc.
- 4+ periods: rolling average uses exactly last 4

**`__tests__/render-tabs.test.js`** — new Trends tab tests:

- `chart-velocity-weekly` canvas present in output
- Empty-state placeholder rendered when `velocityByWeek.labels` has fewer than 2 entries
- No hardcoded hex literals in chart initialisation JS (AC-0580 equivalent)

---

## Conventions

- Branch naming: `bugfix/BUG-XXXX-short-name` for bugs, `feature/US-XXXX-name` for stories
- Commit format: `[fix] BUG-XXXX: description` / `[feat] US-XXXX: description`
- Tests: `npx jest --coverage` — gate ≥80% statements
- After each bug fix: mark `Status: Fixed` + `Fix Branch:` in `docs/BUGS.md`
- After BUG-0230/US-0160 ships: mark `Status: Done` in `docs/RELEASE_PLAN.md`
- ID Registry at session start: next TC = TC-0553, next BUG = BUG-0233, next Lesson = L-0046

---

## Grouping Strategy

To keep PRs small and CI fast, group work as follows:

| PR  | Items                        | Branch                                 |
| --- | ---------------------------- | -------------------------------------- |
| 1   | BUG-0229, BUG-0231, BUG-0232 | `bugfix/BUG-0229-0231-0232-quick-wins` |
| 2   | BUG-0227                     | `bugfix/BUG-0227-agent-plan-doc`       |
| 3   | BUG-0228, BUG-0230 + US-0160 | `bugfix/BUG-0228-0230-remove-cdn-deps` |
| 4   | US-0159                      | `feature/US-0159-velocity-chart`       |
