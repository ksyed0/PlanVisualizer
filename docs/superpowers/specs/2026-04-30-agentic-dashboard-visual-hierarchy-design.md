# Agentic Dashboard Visual Hierarchy Fix — Design Spec

**Date:** 2026-04-30
**Bugs addressed:** BUG-0185, BUG-0186, BUG-0187, BUG-0188, BUG-0189
**Approach:** B — Expanded active card + promoted event log (unified layout restructure)
**Estimated implementation time:** ~2.5 hours
**Primary file:** `tools/generate-dashboard.js`
**Secondary file:** `tools/lib/render-shell.js`
**New test files:** `tests/dashboard-structure.test.js`, `tests/e2e/dashboard-hierarchy.spec.js`

---

## Root Diagnosis

All five bugs share two root causes:

1. **No clear visual hierarchy** — all 9 agent cards carry the same visual weight; active state (small amber border-left) does not outweigh idle state enough to be scannable at a glance.
2. **Information architecture mismatch** — the event log (highest real-time value) is buried in a 300px sidebar, while the pipeline strip redundantly encodes the same "who is doing what" information as the agent roster.

---

## Section 1 — Layout & Visual Hierarchy (`generate-dashboard.js`)

### 1.1 Active Agent Card (fixes BUG-0185, BUG-0186)

Replace the current `.mc-agent-row.mc-agent-active` card with a new `.active-card` component with a stacked layout:

**Portrait banner (top):**

- Full-width container, 200px tall, `background: #080800`
- `<img>` with `src="agents/images/<avatar>.png"` (original landscape file, ~2816×1536), `object-fit: contain`, `object-position: center center`
- Fallback `onerror`: fall back to `agents/images/optimized/<avatar>-160.png`
- CSS gradient overlay: `linear-gradient(to bottom, transparent 55%, #0f0e00 100%)` via `::after` pseudo-element — fades bottom edge into info row
- Pulsing green status dot: `position: absolute; top: 10px; right: 10px`, `animation: pulse 2s infinite`, `box-shadow: 0 0 8px #22c55e88`
- Border: `border-left: 5px solid #f59e0b`, `box-shadow: 0 0 28px rgba(245,158,11,.10)`

**Info row (below portrait):**

- Agent name (17px, `#fde68a`), role (10px, `#d97706`), `ACTIVE` badge (amber pill, right-aligned)
- Story block: `US-XXXX` ID + description in a dark rounded box
- Meta row (monospace, 9px): Branch · Started · Blockers count

**Conductor "Last Dispatch" strip (fixes BUG-0186):**

- Rendered immediately below the active card, always visible regardless of Conductor's current status
- Shows the most recent `dispatch` event from the event log: `Conductor → <agent> · <story> · <phase>`
- Layout: 32px circular Conductor portrait (`optimized/conductor-64.png`) + label/value text + timestamp right-aligned
- Border: `border-left: 4px solid #3b82f6` (blue accent, distinct from active amber)
- This permanently surfaces Conductor's last action without requiring it to hold `is-active` state through a DOM refresh cycle

**DOM ID:** Active card gets `id="mc-active-card"`. Conductor strip gets `id="mc-conductor-dispatch"` with `data-agent="Conductor"`.

### 1.2 Idle Roster Grid (fixes BUG-0185 contrast)

Replace the current 2-column `agent-grid` for idle agents with a **4-column stacked thumbnail grid**:

- Each idle card: `flex-direction: column`, `align-items: center`, `overflow: hidden`
- Portrait: full-width square (`aspect-ratio: 1`), `<img src="optimized/<avatar>-64.png">`, `object-fit: cover`, `object-position: center top`
- Below: agent name (9px, `#6b7280`) → role (7.5px, `#374151`) → `IDLE` badge (dark pill)
- Cards render at **65% opacity** (`opacity: 0.65`); `opacity: 1` on `:hover`
- The active card's full-bleed portrait + amber glow creates sufficient contrast that 65% opacity on idle cards is readable but clearly secondary

**DOM:** Grid container gets `id="mc-idle-roster"`. Individual cards keep `data-agent-name` attribute for `patchDOM()` compatibility.

### 1.3 Pipeline Strip (fixes BUG-0187)

Remove agent-name display from each phase station:

- Delete the `phase.agents` rendering block inside each `.phase-block` — the `agents` field in phase data is still parsed but no longer rendered
- Keep: phase number circle, phase name, status icon/checkmark, elapsed-time footer, partial-progress fill bar, beacon animation for blocked state
- The roster exclusively owns "who is doing what right now"; the pipeline exclusively owns "how far through the cycle are we"

No changes to phase DOM IDs (`phase-N`, `phase-N-icon`, etc.) — `patchDOM()` harness continues to work unchanged.

### 1.4 Event Log Promotion (fixes BUG-0188)

The event log HTML block already exists in `generate-dashboard.js` with comment `<!-- US-0145: Event Log — primary column widget (hidden; sidebar version shown) -->`. Changes:

- Remove the `hidden` class / `display:none` style from the primary column event log block
- Update the sidebar activity pane to show **last 3 events only** (trimmed from current 10) with reduced contrast — it is now a secondary feed, not the primary one
- Event log in main column: full-width, terminal monospace styling (already implemented in `.log-body`), `id="mc-event-log"` retained
- No `patchDOM()` changes required — `appendEventLog()` already targets `#mc-event-log`

---

## Section 2 — Chrome (both dashboards, fixes BUG-0189)

**File:** `tools/lib/render-shell.js` — `SHELL_CHROME_CSS` constant and `renderChrome()` function.

### Changes to `SHELL_CHROME_CSS`:

| Property      | Before                                               | After                          |
| ------------- | ---------------------------------------------------- | ------------------------------ |
| Background    | `linear-gradient(135deg, #003087, #0050b3, #0066cc)` | `#111827` (neutral near-black) |
| Height        | `72px`                                               | `40px`                         |
| Border-bottom | none                                                 | `1px solid #1f2937`            |

### Mode badge (new element injected by `renderChrome()`):

```html
<!-- mode === 'live' -->
<span class="pv-mode-badge pv-mode-live">LIVE</span>

<!-- mode === 'report' -->
<span class="pv-mode-badge pv-mode-report">REPORT</span>
```

CSS:

```css
.pv-mode-badge {
  font-size: 9px;
  font-weight: 700;
  letter-spacing: 0.1em;
  padding: 2px 8px;
  border-radius: 3px;
}
.pv-mode-live {
  background: #dc2626;
  color: #fff;
}
.pv-mode-report {
  background: #374151;
  color: #9ca3af;
}
```

The mode parameter is already passed correctly by both callers:

- `generate-dashboard.js`: `renderChrome({ ... }, 'live')`
- `generate-plan.js` (via `render-shell.js`): `renderChrome({ ... }, 'report')`

All existing topbar content (project name, gen-time, theme toggle, stat tiles) uses `var(--chrome-*)` CSS custom properties — no colour cascade issues.

---

## Section 3 — Regression Test Suite

### 3.1 Jest — DOM Structure (`tests/dashboard-structure.test.js`, new)

Uses a minimal `mockStatus` fixture with one active agent (Pixel, `status: 'InProgress'`, `story: 'US-0171'`) and eight idle agents. Calls the dashboard HTML generator and parses output with `jsdom`.

**Assertions:**

- `#mc-active-card` exists
- `#mc-active-card img[src*="agents/images/pixel.png"]` exists (full portrait path)
- `.active-portrait-banner` exists inside `#mc-active-card`
- `#mc-conductor-dispatch` exists and is visible (not `display:none`)
- No `.phase-block` element contains text matching agent names (BUG-0187 guard)
- `#mc-event-log` is a descendant of `.mc-main`, not `.mc-sidebar` (BUG-0188 guard)
- All `.mc-agent-card[data-status="idle"]` elements have CSS class `mc-agent-idle` (opacity guard for BUG-0185)

**Chrome assertions** (added to existing `tests/render-shell.test.js`):

- `renderChrome({...}, 'live')` output contains `.pv-mode-live` and text `LIVE`
- `renderChrome({...}, 'report')` output contains `.pv-mode-report` and text `REPORT`
- Output does not contain `#003087` or `linear-gradient` in inline styles (BUG-0189 guard)
- `.pv-chrome` element height attribute/style is absent or `≤ 44px` (validated via CSS string match)

### 3.2 Playwright — Visual Hierarchy (`tests/e2e/dashboard-hierarchy.spec.js`, new)

Uses existing `playwright.config.js`. Loads `docs/dashboard.html` with a pre-baked `docs/sdlc-status.json` fixture (same fixture as Jest: 1 active agent, 8 idle).

**Assertions:**

- Active card computed `border-left-color` equals `rgb(245, 158, 11)` (amber)
- Active card `boundingBox().height` > any single idle card `boundingBox().height` (visual prominence)
- `#mc-event-log` is inside `.mc-main`: `await page.locator('.mc-main #mc-event-log').count()` > 0
- `.pv-chrome` computed height ≤ 44px
- `#mc-conductor-dispatch` is visible when Conductor `status` is `'idle'`
- No element with class `pv-chrome` has a computed `background-image` containing `linear-gradient` (BUG-0189)

**`plan-status.html` chrome additions** (appended to existing Playwright suite):

- `.pv-chrome` height ≤ 44px
- `.pv-mode-report` element exists and is visible
- `.pv-chrome` computed `background-color` is not `rgb(0, 48, 135)` (BUG-0189)

---

## Files Changed

| File                                    | Change type                                                          |
| --------------------------------------- | -------------------------------------------------------------------- |
| `tools/generate-dashboard.js`           | Modify — active card, idle grid, pipeline strip, event log promotion |
| `tools/lib/render-shell.js`             | Modify — chrome height, background, mode badge                       |
| `tests/dashboard-structure.test.js`     | New — Jest DOM structure assertions                                  |
| `tests/e2e/dashboard-hierarchy.spec.js` | New — Playwright visual hierarchy assertions                         |
| `tests/render-shell.test.js`            | Modify — add chrome regression assertions                            |
| `docs/BUGS.md`                          | Modify — BUG-0185→0189 marked Fixed                                  |
| `docs/LESSONS.md`                       | Modify — add lesson on visual hierarchy / IA separation              |

---

## Out of Scope

- Dark mode variants of the new active card (existing `[data-theme="dark"]` CSS already inherits correctly via `var(--mc-surface)`)
- Responsive / mobile breakpoints for the new active card (existing breakpoints collapse to 1-col; active card stacks naturally)
- Agent portrait images for the plan-status dashboard (only the agentic dashboard has agent cards)
- Any changes to `sdlc-status.json` schema or `update-sdlc-status.js`
