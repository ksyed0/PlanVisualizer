# US-0186 — Dashboard Review-Gate Visualization

**Epic:** EPIC-0029 — Agentic Pipeline UX (new epic — first story is this one)
**Status:** Design (approved 2026-05-17)
**Author:** Conductor brainstorm with user
**Depends on:** US-0185 (Conductor Dispatch Protocol — done; provides `task.taskReview`)

> Note on epic naming: US-0185 closed EPIC-0028 (Agentic Orchestration Engine — the pipeline engine). EPIC-0029 covers UX work that surfaces the engine's behaviour to the operator. This story is its first.

---

## 1. Goal

Make the per-task two-phase review gate visible on the Agentic Dashboard so an operator can see at a glance which tasks have cleared review, which are in spec or quality review, which are mid-retry, and which have escalated. Extends the existing `patchTaskList()` (US-0183) — same task rows on active agent cards, now with review-gate decoration. Adds an S/M/L density toggle in the topbar so the operator can dial information density without leaving the dashboard.

**Standalone-value claim:** Without this, US-0185's review-gate loop is invisible — verdicts and findings live in `sdlc-status.json` and `progress.md` only. With this, the operator can watch a dispatch run live and intervene early when a task escalates instead of finding out after the fact.

---

## 2. Architecture

Single function extension. Everything lives in `tools/generate-dashboard.js`:

```
                       ┌─────────────────────────────┐
        Page load   →  │ initTaskDensity()           │
                       │  reads localStorage          │
                       │  → window.pvTaskDensity      │
                       │  → button .active class      │
                       └──────────────┬───────────────┘
                                      │
                       ┌──────────────▼───────────────┐
   refresh tick (5s)─▶ │ refreshState(status) {       │
                       │   window._pvLastStatus =     │
                       │     status;                  │
                       │   patchDOM(status);          │
                       │   patchTaskList(status); ←───┼─── reads window.pvTaskDensity
                       │ }                            │
                       └──────────────────────────────┘

   S/M/L click     →   setTaskDensity(d) {
                         window.pvTaskDensity = d;
                         localStorage.setItem(...);
                         button .active toggle;
                         patchTaskList(_pvLastStatus); ← immediate re-render
                       }

   patchTaskList()  →   for each task:
                         ds = deriveDisplayState(task.taskReview);
                         density === 'S' → renderReviewIconS(ds)
                         density === 'M' → renderReviewChipsM(ds)
                         density === 'L' → renderReviewLineL(ds)   ← default
```

**Tech stack:** vanilla JS (existing dashboard code), CSS theme tokens (`--ok`, `--warn`, `--risk`, `--live-accent`, `--text-mute`). No new dependencies.

---

## 3. Data Model

### 3.1 Fields read from `task.taskReview` (US-0185 schema)

| Field                           | Used for                                                                          |
| ------------------------------- | --------------------------------------------------------------------------------- |
| `taskReview.status`             | `spec_reviewing` / `quality_reviewing` / `forge_retry` / `approved` / `escalated` |
| `taskReview.specVerdict`        | `APPROVED` / `REQUEST_CHANGES` / null                                             |
| `taskReview.qualityVerdict`     | `APPROVED` / `REQUEST_CHANGES` / null                                             |
| `taskReview.forgeRetries`       | Retry counter — drives `↩ N/cap` display                                          |
| `taskReview.headSha === 'none'` | SKIP_REVIEW path — render nothing extra                                           |
| `taskReview` absent or null     | Pre-US-0185 task — render nothing extra (backward-compatible)                     |

`lastRetryTriggeredBy` is **not** used for display. The phase that failed is derived from the verdict fields directly (more reliable than `lastRetryTriggeredBy` which is null during the `forge_retry` window).

### 3.2 `deriveDisplayState(taskReview)` contract

Pure helper, returns `null` (no decoration) or a struct:

```js
{
  skipped: boolean,           // true when headSha === 'none'
  specIcon: '✓' | '⟳' | '✗' | null,
  qualityIcon: '✓' | '⟳' | '✗' | null,
  retryCount: number | null,  // current attempt number; null when no retry active
  retryCap: number,           // window.pvTaskReviewCap (injected from config)
  escalated: boolean,
  overall: '✓' | '⟳' | '✗' | null,  // for S mode — collapsed outcome
}
```

**Derivation rules:**

```
specIcon =
  specVerdict === 'APPROVED'         → '✓'
  specVerdict === 'REQUEST_CHANGES'  → '✗'
  status === 'spec_reviewing' (and specVerdict null) → '⟳'
  otherwise                          → null

qualityIcon =
  qualityVerdict === 'APPROVED'         → '✓'
  qualityVerdict === 'REQUEST_CHANGES'  → '✗'
  status === 'quality_reviewing' (and qualityVerdict null) → '⟳'
  otherwise                             → null

retryCount =
  forgeRetries > 0 OR status === 'forge_retry' → forgeRetries + (status === 'forge_retry' ? 1 : 0)
  otherwise                                     → null

escalated = (status === 'escalated')

overall (S mode) =
  specIcon === '✓' && qualityIcon === '✓'          → '✓'
  specIcon === '✗' || qualityIcon === '✗'          → '✗'
  specIcon === '⟳' || qualityIcon === '⟳'          → '⟳'
  otherwise                                         → null
```

### 3.3 Cap value injection

`window.pvTaskReviewCap` is emitted as a JS literal in the generated dashboard HTML at build time:

```html
<script>
  window.pvTaskReviewCap = 2; // injected from plan-visualizer.config.json
</script>
```

`generate-dashboard.js` reads `config.orchestration.iterationCap.taskReview` (default 2 if absent) and emits the literal. The pure `deriveDisplayState()` helper reads `window.pvTaskReviewCap` for the `retryCap` field.

---

## 4. Density Modes — Rendered States

**L mode (default)** — review status on a dedicated second line, indented to the task description column:

```
DONE   Implement parseTaskBlock()
       Spec ✓ · Quality ✓                       (cleared)

DONE   Implement parseTaskBlock()
       Spec ✓ · Quality ⟳                       (quality reviewing)

DONE   Write failing tests
       Spec ⟳                                    (initial spec review, no prior retries)

DONE   Write failing tests
       Spec ⟳ · retry 1/2                       (re-review after a spec retry — forgeRetries > 0)

DONE   Failed spec compliance
       Spec ✗ · retry 1/2                       (spec just failed, retry about to start)

DONE   Failed code quality
       Spec ✓ · Quality ✗ · retry 1/2           (quality retry running)

DONE   Could not satisfy spec review
       Spec ✗ · escalated                       (spec cap exhausted)

DONE   Could not satisfy quality review
       Spec ✓ · Quality ✗ · escalated           (quality cap exhausted)

DONE   Reviewed design doc only
       (no second line — taskReview.headSha === 'none')
```

**M mode** — chips right-aligned, after the description:

```
DONE   Implement parseTaskBlock()       [SPEC ✓] [QUAL ✓]
DONE   Implement parseTaskBlock()       [SPEC ✓] [QUAL ⟳]
DONE   Write failing tests              [SPEC ⟳]
DONE   Failed spec compliance           [SPEC ✗] [RETRY 1/2]
DONE   Failed code quality              [SPEC ✓] [QUAL ✗] [RETRY 1/2]
DONE   Spec exhausted cap               [SPEC ✗] [ESCALATED]
DONE   Quality exhausted cap            [SPEC ✓] [QUAL ✗] [ESCALATED]
DONE   Reviewed design only             (no chips)
```

**S mode** — collapsed to a single outcome icon, far-right:

```
DONE   Implement parseTaskBlock()                ✓        (cleared)
DONE   Implement parseTaskBlock()                ⟳        (any review in progress)
DONE   Failed spec compliance                    ✗        (any failure/retry/escalation)
DONE   Reviewed design only                              (no icon)
```

S mode deliberately collapses the spec/quality distinction — three glyphs total (`✓` / `⟳` / `✗`). For finer detail, switch to M or L.

### 4.1 Title attributes (accessibility)

Every chip and icon has a `title=` attribute spelling out the state. Examples:

- `<span class="pv-rev-chip ok" title="Spec compliance review: approved">SPEC ✓</span>`
- `<span class="pv-rev-chip risk" title="Spec compliance review: changes requested — retry 1 of 2">SPEC ✗</span>`
- `<span class="pv-rev-icon review" title="Quality review in progress">⟳</span>`

Screen readers read the title; sighted users see it on hover.

---

## 5. Density Toggle UI

### 5.1 Markup

Inserted in `mc-topbar-right`, immediately before the existing `LIVE` badge:

```html
<div class="pv-density-toggle" role="radiogroup" aria-label="Task review density">
  <button data-density="S" onclick="setTaskDensity('S')" title="Compact — single outcome icon per task">S</button>
  <button data-density="M" onclick="setTaskDensity('M')" title="Medium — phase chips per task">M</button>
  <button data-density="L" onclick="setTaskDensity('L')" title="Large — phase status on a second line">L</button>
</div>
<span class="mc-live-badge" ...>LIVE</span>
```

### 5.2 Handler + initialization

```js
function setTaskDensity(d) {
  if (d !== 'S' && d !== 'M' && d !== 'L') return;
  window.pvTaskDensity = d;
  try {
    localStorage.setItem('pv-task-density', d);
  } catch (e) {
    /* private mode */
  }
  document.querySelectorAll('.pv-density-toggle button').forEach(function (b) {
    b.classList.toggle('active', b.dataset.density === d);
  });
  if (window._pvLastStatus) patchTaskList(window._pvLastStatus);
}

(function initTaskDensity() {
  var saved;
  try {
    saved = localStorage.getItem('pv-task-density');
  } catch (e) {}
  var d = saved === 'S' || saved === 'M' || saved === 'L' ? saved : 'L';
  setTaskDensity(d);
})();
```

`window._pvLastStatus` is set in the existing `refreshState` loop right before `patchDOM` / `patchTaskList` are called.

---

## 6. Transition Animations

### 6.1 Continuous spin on `⟳`

```css
@keyframes pv-rev-spin {
  from {
    transform: rotate(0deg);
  }
  to {
    transform: rotate(360deg);
  }
}
.pv-rev-icon.review,
.pv-rev-chip.review .pv-rev-spin-glyph {
  display: inline-block;
  animation: pv-rev-spin 1.4s linear infinite;
}
```

Applied to the literal `⟳` glyph in `review` state across all three modes. Conveys "something is happening" without requiring the operator to compare consecutive 5s ticks.

### 6.2 Chip appear fade

```css
@keyframes pv-rev-appear {
  from {
    opacity: 0;
    transform: translateY(-1px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}
.pv-rev-chip,
.pv-rev-line,
.pv-rev-icon {
  animation: pv-rev-appear 200ms ease-out;
}
```

Each render replaces `innerHTML` (via `patchTaskList`), so the animation fires on every refresh tick where a chip/line/icon is present. This is acceptable — the animation is brief (200ms) and barely perceptible. It would only be obvious if the user is staring at the same task row.

**Note:** transitioning the _colour_ of a chip between renders (e.g., blue → green when `⟳` becomes `✓`) does not work because the chip element is freshly created each tick. The fade-in is the trade-off — gentle visual cue without DOM diffing.

### 6.3 Density toggle button transitions

```css
.pv-density-toggle button {
  transition:
    background-color 150ms ease,
    color 150ms ease;
}
```

Smooths the active-state switch when the operator clicks a different density.

### 6.4 `prefers-reduced-motion`

```css
@media (prefers-reduced-motion: reduce) {
  .pv-rev-icon.review,
  .pv-rev-chip.review .pv-rev-spin-glyph {
    animation: none;
  }
  .pv-rev-chip,
  .pv-rev-line,
  .pv-rev-icon {
    animation: none;
  }
  .pv-density-toggle button {
    transition: none;
  }
}
```

Respects the OS-level reduced-motion preference. The `⟳` glyph still appears, just static.

---

## 7. Implementation Details

### 7.1 Files touched

| Path                                                   | Action                                                                                                                                                                                                                                                                                                                                                          |
| ------------------------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `tools/generate-dashboard.js`                          | Extend `patchTaskList()`; add `deriveDisplayState()`, `renderReviewIconS()`, `renderReviewChipsM()`, `renderReviewLineL()`; add topbar pill HTML; add density toggle JS + `initTaskDensity`; cache `_pvLastStatus` in refresh loop; emit `window.pvTaskReviewCap` literal at generation time; add CSS for chips, second-line, icons, animations, reduced-motion |
| `tests/unit/generate-dashboard.test.js`                | Add tests for `deriveDisplayState`, each render function, topbar HTML presence                                                                                                                                                                                                                                                                                  |
| `tests/unit/dashboard-density-toggle.test.js`          | NEW — `setTaskDensity` and `initTaskDensity` behaviour                                                                                                                                                                                                                                                                                                          |
| `tests/integration/dashboard-task-review-flow.test.js` | NEW — render fixture with various `taskReview` states, assert markup in each mode                                                                                                                                                                                                                                                                               |

### 7.2 Theme-token-driven CSS (no hex literals — L-0064)

```css
/* Chips (M mode) */
.pv-rev-chip {
  padding: 1px 5px;
  border-radius: 3px;
  font-size: 9px;
  font-weight: 700;
  white-space: nowrap;
}
.pv-rev-chip.ok {
  background: color-mix(in oklab, var(--ok) 18%, transparent);
  color: var(--ok);
}
.pv-rev-chip.warn {
  background: color-mix(in oklab, var(--warn) 18%, transparent);
  color: var(--warn);
}
.pv-rev-chip.risk {
  background: color-mix(in oklab, var(--risk) 18%, transparent);
  color: var(--risk);
}
.pv-rev-chip.review {
  background: color-mix(in oklab, var(--live-accent) 18%, transparent);
  color: var(--live-accent);
}

/* Second line (L mode) */
.pv-rev-line {
  padding-left: 80px;
  font-size: 9.5px;
  margin-top: 1px;
}
.pv-rev-line .ok {
  color: var(--ok);
}
.pv-rev-line .warn {
  color: var(--warn);
}
.pv-rev-line .risk {
  color: var(--risk);
}
.pv-rev-line .review {
  color: var(--live-accent);
}

/* Icon (S mode) */
.pv-rev-icon {
  font-weight: 700;
  margin-left: auto;
}
.pv-rev-icon.ok {
  color: var(--ok);
}
.pv-rev-icon.warn {
  color: var(--warn);
}
.pv-rev-icon.risk {
  color: var(--risk);
}
.pv-rev-icon.review {
  color: var(--live-accent);
}

/* Density toggle pill */
.pv-density-toggle {
  display: flex;
  gap: 2px;
  background: var(--bg-card-inner);
  border-radius: 4px;
  padding: 2px;
}
.pv-density-toggle button {
  padding: 2px 8px;
  border: 0;
  background: transparent;
  color: var(--text-muted);
  font-size: 10px;
  font-weight: 700;
  cursor: pointer;
  border-radius: 3px;
}
.pv-density-toggle button.active {
  background: var(--live-accent);
  color: var(--text-inverse, #fff);
}
```

### 7.3 Render function shapes

```js
function renderReviewIconS(ds) {
  if (ds.skipped || !ds.overall) return '';
  var cls = ds.overall === '✓' ? 'ok' : ds.overall === '⟳' ? 'review' : 'risk';
  var titleMap = { '✓': 'Review cleared', '⟳': 'Review in progress', '✗': 'Review needs changes or escalated' };
  return '<span class="pv-rev-icon ' + cls + '" title="' + titleMap[ds.overall] + '">' + ds.overall + '</span>';
}

function renderReviewChipsM(ds) {
  if (ds.skipped) return '';
  var chips = [];
  if (ds.specIcon) chips.push(specChip(ds));
  if (ds.qualityIcon) chips.push(qualityChip(ds));
  if (ds.escalated) chips.push('<span class="pv-rev-chip risk" title="Review cap exhausted">ESCALATED</span>');
  else if (ds.retryCount)
    chips.push(
      '<span class="pv-rev-chip warn" title="Forge retry in progress">RETRY ' +
        ds.retryCount +
        '/' +
        ds.retryCap +
        '</span>',
    );
  return chips.join(' ');
}

function renderReviewLineL(ds) {
  if (ds.skipped) return '';
  var parts = [];
  if (ds.specIcon) parts.push('<span class="' + iconCls(ds.specIcon) + '">Spec ' + ds.specIcon + '</span>');
  if (ds.qualityIcon) parts.push('<span class="' + iconCls(ds.qualityIcon) + '">Quality ' + ds.qualityIcon + '</span>');
  if (ds.escalated) parts.push('<span class="risk">escalated</span>');
  else if (ds.retryCount) parts.push('<span class="warn">retry ' + ds.retryCount + '/' + ds.retryCap + '</span>');
  return '<div class="pv-rev-line">' + parts.join(' · ') + '</div>';
}
```

The exact HTML structure is contractually defined by these shapes — tests assert against them.

---

## 8. Testing Strategy

| File                                                   | Coverage target | What it asserts                                                                                                                                                                                                                                                 |
| ------------------------------------------------------ | --------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `tests/unit/generate-dashboard.test.js`                | extended        | `deriveDisplayState()` for 12+ state combinations; `renderReviewIconS/M/L` emit expected markup; topbar HTML contains `.pv-density-toggle` with S/M/L buttons; `window.pvTaskReviewCap` literal injected                                                        |
| `tests/unit/dashboard-density-toggle.test.js`          | ≥90%            | `setTaskDensity()` updates global, writes localStorage, toggles `.active`, calls `patchTaskList(_pvLastStatus)`; `initTaskDensity()` reads localStorage with `'L'` fallback; invalid input ignored; localStorage failure (private mode) handled gracefully      |
| `tests/integration/dashboard-task-review-flow.test.js` | smoke           | Fixture sdlc-status.json with 4 tasks in different review states → render dashboard → assert L mode shows 4 `.pv-rev-line` variants, M mode shows 4 chip variants, S mode shows 4 single-icon variants; assert `prefers-reduced-motion` CSS disables animations |

**Critical scenarios for `deriveDisplayState`:**

| Input state                                                                          | Expected output                                                                    |
| ------------------------------------------------------------------------------------ | ---------------------------------------------------------------------------------- |
| `taskReview = null`                                                                  | returns `null` (pre-US-0185 task)                                                  |
| `headSha === 'none'`                                                                 | `{ skipped: true, overall: null }`                                                 |
| `status='spec_reviewing'`, no verdicts                                               | `{ specIcon: '⟳', qualityIcon: null, overall: '⟳' }`                               |
| `specVerdict='APPROVED'`, `status='quality_reviewing'`                               | `{ specIcon: '✓', qualityIcon: '⟳', overall: '⟳' }`                                |
| Both APPROVED                                                                        | `{ specIcon: '✓', qualityIcon: '✓', overall: '✓' }`                                |
| `specVerdict='REQUEST_CHANGES'`, `status='forge_retry'`, `forgeRetries=0`            | `{ specIcon: '✗', retryCount: 1, retryCap: 2, overall: '✗' }`                      |
| `specVerdict='REQUEST_CHANGES'`, `status='escalated'`, `forgeRetries=2`              | `{ specIcon: '✗', escalated: true, overall: '✗' }`                                 |
| `specVerdict='APPROVED'`, `qualityVerdict='REQUEST_CHANGES'`, `status='forge_retry'` | `{ specIcon: '✓', qualityIcon: '✗', retryCount: …, overall: '✗' }`                 |
| `forgeRetries=1`, `status='spec_reviewing'` (post-retry, re-reviewing)               | `{ specIcon: '⟳', qualityIcon: null, retryCount: 1 (display only), overall: '⟳' }` |

**Critical scenarios for density toggle:**

- First load (no localStorage) → `window.pvTaskDensity === 'L'`, L button has `.active`
- Reload with stored `'M'` → `window.pvTaskDensity === 'M'`, M has `.active`
- Click S button → global updated, localStorage written, button class toggled, `patchTaskList(_pvLastStatus)` invoked
- Invalid input (`setTaskDensity('XL')`) → no state change
- `localStorage.setItem` throws (private mode) → in-memory state still updates, no exception bubbles

**Integration smoke fixture:**

```json
{
  "tasks": {
    "task-1": {
      "id": "task-1",
      "story": "US-0186",
      "agent": "Forge",
      "state": "done",
      "taskReview": { "status": "approved", "specVerdict": "APPROVED", "qualityVerdict": "APPROVED", "forgeRetries": 0 }
    },
    "task-2": {
      "id": "task-2",
      "story": "US-0186",
      "agent": "Forge",
      "state": "done",
      "taskReview": {
        "status": "quality_reviewing",
        "specVerdict": "APPROVED",
        "qualityVerdict": null,
        "forgeRetries": 0
      }
    },
    "task-3": {
      "id": "task-3",
      "story": "US-0186",
      "agent": "Forge",
      "state": "done",
      "taskReview": {
        "status": "forge_retry",
        "specVerdict": "REQUEST_CHANGES",
        "qualityVerdict": null,
        "forgeRetries": 0
      }
    },
    "task-4": {
      "id": "task-4",
      "story": "US-0186",
      "agent": "Forge",
      "state": "done",
      "taskReview": { "status": "approved", "headSha": "none" }
    }
  }
}
```

Each of the three modes renders this fixture distinctly; tests assert each.

---

## 9. Scope Boundaries

**In scope for US-0186:**

- ✅ S/M/L density pill in `mc-topbar-right` of the Agentic Dashboard
- ✅ `window.pvTaskDensity` global + localStorage persistence (`'pv-task-density'` key)
- ✅ Default density: **L** on first load
- ✅ `deriveDisplayState(taskReview)` pure helper — verdict-field driven
- ✅ Three render functions: `renderReviewIconS`, `renderReviewChipsM`, `renderReviewLineL`
- ✅ `patchTaskList()` extension calls the right render based on `window.pvTaskDensity`
- ✅ `_pvLastStatus` cache + immediate re-render on toggle (no 5s wait)
- ✅ `window.pvTaskReviewCap` injected at dashboard generation time from `plan-visualizer.config.json → orchestration.iterationCap.taskReview`
- ✅ Theme-token-driven CSS (no hex literals per L-0064)
- ✅ `title=` attributes on chips and icons for accessibility
- ✅ Transition animations: continuous spin on `⟳`, brief fade-in for chips/lines/icons, button background transition; `prefers-reduced-motion` honored
- ✅ All tests from §8

**Out of scope (future stories):**

- ❌ Hover/click chip to see actual findings text — needs tooltip / modal flow
- ❌ Per-chip color transitions between renders (would require DOM diffing — meaningful complexity)
- ❌ Escalation banner at the top of the dashboard (existing alert system from US-0085 already handles BLOCKED notifications)
- ❌ Equivalent rendering on `plan-status.html` (this is Agentic Dashboard only)
- ❌ History view of past review verdicts on a story
- ❌ Configurable text in chip labels (e.g., "SPEC" → "S/C") — locked to current strings

**Effort estimate:** ~3 days (S). Single file change in `generate-dashboard.js`, ~200 LOC including helper + render functions + CSS + animations + toggle + init. Tests are mechanical given the well-defined `deriveDisplayState` contract.

---

## 10. Acceptance Criteria (draft for RELEASE_PLAN.md)

- **AC-0731:** Agentic Dashboard topbar has an S/M/L density pill in `mc-topbar-right`; default is L on first load; selection persists across reloads via `localStorage['pv-task-density']`
- **AC-0732:** Each `done` / `done_with_concerns` task row on an active agent card displays review-gate status in the format defined by the selected density mode (icon-only S / chips M / second-line L)
- **AC-0733:** `deriveDisplayState(taskReview)` returns the correct struct for all 9 documented state combinations (per §8 table); returns `null` for pre-US-0185 tasks; returns `{ skipped: true }` when `headSha === 'none'`
- **AC-0734:** All chips, lines, and icons use theme tokens (`--ok`, `--warn`, `--risk`, `--live-accent`) — no hex literals introduced
- **AC-0735:** `⟳` icon animates continuously via `@keyframes pv-rev-spin`; new chips/lines/icons fade in via `@keyframes pv-rev-appear` (200ms); density toggle button background transitions over 150ms; all animations disabled when `prefers-reduced-motion: reduce` is set
- **AC-0736:** All chips and icons carry `title=` attributes describing the state; `window.pvTaskReviewCap` is emitted as a JS literal in the generated HTML from `plan-visualizer.config.json → orchestration.iterationCap.taskReview`

---

## 11. Open Questions — None

All design decisions settled in the brainstorming session (2026-05-17):

- **What to display:** review-gate status per `done` / `done_with_concerns` task (not pre-US-0185 tasks)
- **Density modes:** 3 (S/M/L) — S collapses spec/quality to a single outcome icon; M chips per phase; L second-line text per phase
- **Default density:** L (most readable; matches user's preference for richer info by default)
- **Toggle placement:** `mc-topbar-right` next to the LIVE badge (always visible during a dispatch run)
- **Persistence:** `localStorage['pv-task-density']`
- **State→display mapping:** read directly from `specVerdict` and `qualityVerdict` (not `lastRetryTriggeredBy` which is null during `forge_retry`)
- **Cap value:** `window.pvTaskReviewCap` injected at generation time from project config; default 2
- **SKIP_REVIEW handling:** render nothing extra (no `(no review)` label — absence of chips is the signal)
- **Architecture:** Approach 1 — global variable read by `patchTaskList()` on every refresh tick; `_pvLastStatus` cache enables immediate re-render on toggle
- **Animations:** continuous spin on `⟳`, brief fade-in entry, button background transition; `prefers-reduced-motion` honored
