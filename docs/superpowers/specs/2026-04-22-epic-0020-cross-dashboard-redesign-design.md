# EPIC-0020 — Cross-Dashboard Redesign: Design Spec

**Date:** 2026-04-22
**Epic:** EPIC-0020 · Cross-Dashboard Redesign (CD-Redesign)
**Stories:** US-0135–US-0147
**Release Target:** Release 1.11
**Status:** Design Approved — ready for implementation planning

---

## Context

Both dashboards (Plan-Status and Agentic) have diverged visually and architecturally. Plan-Status uses an OKLCH design-token system (`theme.js` → `generateCssTokens()`), while `generate-dashboard.js` hardcodes hex values. The chrome differs entirely — Plan-Status has a frosted navbar; the Agentic dashboard has a saturated navy gradient. Chart palettes differ across every tab. Active agents are indistinguishable from idle ones at a glance.

This epic unifies both surfaces under a shared token system and design language: one chrome component, one palette, differentiated only by accent colour and a REPORT vs LIVE mode badge.

---

## Decisions Made

| Decision            | Choice                                                                  | Rationale                                                                                          |
| ------------------- | ----------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------- |
| Rollout sequence    | Sequential: Foundation → Plan-Status → Agentic                          | Clean dependency gates; each track tested before the next begins                                   |
| Chrome code sharing | New `render-chrome.js` module (Option B)                                | Matches existing decomposition pattern; drift between dashboards becomes structurally impossible   |
| Chrome visual style | Dark neutral — `#1e293b`, 1px `rgba(255,255,255,.06)` border (Option C) | Identical in light + dark mode; doesn't compete with content; replaces the saturated navy gradient |
| Mode badge — REPORT | Indigo tinted pill `rgba(99,102,241,.25)`, static pip                   | Calm, editorial feel for the reporting surface                                                     |
| Mode badge — LIVE   | Orange tinted pill `rgba(249,115,22,.2)`, 1.6s pulsing pip              | Broadcast urgency without being garish                                                             |
| Status Hero density | L / M / S toggle anchored inside green verdict section                  | Toggle floats over safe green space — no overlap with stats or viz in any layout                   |
| Status Hero default | **M**                                                                   | Preserves narrative context without L's three-row height cost                                      |
| US-0141 placement   | Track 1 (alongside US-0137)                                             | Dual theme active from day one of Track 2 testing                                                  |

---

## Module Architecture

### New file: `tools/lib/render-chrome.js`

Shared chrome component imported by both generators.

```
Exports:
  renderChrome(mode, data)          → full <header> HTML string
  renderModeBadge(mode)             → pill span ('report' | 'live')
  renderDashboardSwitcher(active)   → Plan-Status / Pipeline segment tabs
  renderThemeToggle()               → ☀ / ☾ toggle
```

**Chrome anatomy (both dashboards):**

```
<header class="pv-chrome">                   height: 52px, bg: #1e293b
  [brand]  [Plan-Status | Pipeline]  [spacer]  [mode-badge]  [⌘K]  [ⓘ]  [☀ ☾]
</header>
```

### Extended: `tools/lib/theme.js`

New exports added alongside existing `palette`, `badge`, `BADGE_TONE`, `chartColors`, `generateCssTokens`:

| New export                     | Purpose                                                                        |
| ------------------------------ | ------------------------------------------------------------------------------ |
| `type`                         | Font stack object: `sans`, `display`, `mono`                                   |
| `radius`                       | Border radius scale: `sm`, `md`, `lg`, `full`                                  |
| `shadow`                       | Shadow scale: `card`, `cardHover`, `modal`                                     |
| `spacing`                      | Spacing scale (4px base): `1`–`16`                                             |
| `generateDashboardCssTokens()` | Same OKLCH tokens formatted for `generate-dashboard.js` inline `<style>` block |

### Dependency topology after EPIC-0020

```
render-utils
     ↓
render-chrome  ←── NEW (imported by render-html.js AND generate-dashboard.js)
render-shell
render-tabs
render-scripts
     ↓
render-html.js          generate-dashboard.js
```

Only two shared entry points cross the boundary: `renderChrome` and `generateCssTokens` / `generateDashboardCssTokens`.

---

## Track 1 — Foundation (US-0137 + US-0141)

**Goal:** Single source of truth for every token. No hex literal survives in either dashboard.

### US-0137 — Shared Token Module

1. Extend `theme.js` with `type`, `radius`, `shadow`, `spacing`, `generateDashboardCssTokens()`.
2. Create `tools/lib/render-chrome.js` (exports above). CSS classes: `.pv-chrome`, `.pv-seg`, `.pv-seg-active`, `.mode-badge`, `.mode-report`, `.mode-live`, `.pv-iconbtn`, `.pv-theme-segs`, `.pv-theme-btn`.
3. Wire `render-html.js` to import `renderChrome` from `render-chrome.js` (remove existing inline chrome HTML from `render-shell.js`).
4. Wire `generate-dashboard.js` to import `renderChrome` and `generateDashboardCssTokens` — replacing its hardcoded gradient header and hex color block entirely.
5. **AC-0498 lint rule** in `tests/unit/theme.test.js`: generate full HTML output for both dashboards and assert zero matches of `/#[0-9a-fA-F]{3,6}\b|rgb\(|rgba\(/` in the output. This is the acceptance gate — do not mark US-0137 done until this passes.

> ⚠️ **Implementation note:** `generate-dashboard.js` is 3,124 lines with pervasive hardcoded hex. Budget extra time for the token migration. Migrate colour-by-colour, running the lint rule incrementally to track progress.

### US-0141 — Dual Theme

Extend `generateCssTokens()` light and dark declarations:

| Token       | Light                  | Dark                  |
| ----------- | ---------------------- | --------------------- |
| `--bg`      | `ink1` (97% lightness) | `ink10` (6%)          |
| `--surface` | `ink0` (99%)           | `ink8` (16%)          |
| `--text`    | `ink9` (10%)           | `ink1` (97%)          |
| `--border`  | `ink3` (88%)           | `oklch(28% 0.018 95)` |

Rules:

- Dark theme base: low-chroma warm neutral, NOT pure black.
- Light theme base: near-white with subtly tinted canvas, NOT `#fff`.
- Every card uses `border: 1px solid var(--border)` in addition to shadow — required for print legibility.
- Theme persists in `localStorage` key `pv-theme`; falls back to `prefers-color-scheme`.

---

## Track 2 — Plan-Status (US-0138 → US-0136 → US-0140 → US-0135 → US-0139)

### US-0138 — Mode Badge

`renderModeBadge(mode)` in `render-chrome.js`:

```html
<!-- REPORT -->
<span class="mode-badge mode-report" aria-label="Mode: Report"> <span class="mode-pip"></span> REPORT </span>

<!-- LIVE -->
<span class="mode-badge mode-live" aria-label="Mode: Live"> <span class="mode-pip mode-pip-pulse"></span> LIVE </span>
```

CSS: `.mode-pip-pulse` animates `opacity` + `scale` at 1.6s ease-in-out. Both badges keyboard-focusable.

### US-0136 — Neutral Chrome

Replace Plan-Status's frosted navbar and Agentic's navy gradient with the shared `renderChrome()`:

- `background: #1e293b`
- `border-bottom: 1px solid rgba(255,255,255,.06)`
- Height: `52px` max
- Does NOT repeat page title (title lives in the masthead / agentic header below chrome)
- Dashboard identity comes exclusively from the mode badge accent colour

### US-0140 — Unified Chart Palette

`chartColors` already exists in `theme.js`. Wire Chart.js global defaults on page load in `render-scripts.js`:

```js
Chart.defaults.color = 'var(--text-muted)';
Chart.defaults.borderColor = 'var(--border)';
// Apply chartColors to ok/warn/risk/info/accent/mute keys
```

All doughnut, bar, and line charts inherit from this; no per-chart color overrides permitted.

### US-0135 — Status Hero Card

**Layout:** L / M / S density toggle anchored `position: absolute; top: 8px; right: 10px` inside `position: relative` verdict section (green box). Toggle tinted to match green background — not a floating white pill.

**Default density: M.**

| Zone    | L (Full)                                       | M (Mid)                   | S (Compact)               |
| ------- | ---------------------------------------------- | ------------------------- | ------------------------- |
| Verdict | Full-width banner                              | Left 36% column, green bg | Left 34% column, green bg |
| Stats   | 3 columns, centred                             | 3 columns, centred        | 3 columns                 |
| Viz     | 3 panels (14-wk bars, 30-day heat, spend burn) | 3 panels                  | 14-wk bars + spend only   |

**Shared viz behaviour (all sizes):**

- Progress bars: `flex: 1` per bar, `width: 100%` on container — stretch to fill.
- Coverage heat: `flex: 1` per cell, single row — stretch to fill.
- Spend burn: `width: 100%`.
- All stat and viz boxes: `display: flex; flex-direction: column; justify-content: center` — vertically centred content.

**S layout verdict section specifics:**

- "ON TRACK" on one line (`white-space: nowrap`).
- Narrative text to the right of the verdict word in a flex row.
- Green background + narrative matches M layout intent.

**Density persists in `localStorage` key `pv-hero-density`.**

### US-0139 — Rich Status Tab

Three decision-grade widget cards below the hero:

| Widget         | Data source                                                 | Layout                                    |
| -------------- | ----------------------------------------------------------- | ----------------------------------------- |
| Top Risks      | Open bugs (Critical/High) + blocked stories + overdue epics | Severity-chipped list                     |
| This Week      | Stories shipped, PRs merged, bugs opened/fixed, AI spend    | Stat grid                                 |
| Agent Workload | `data.sdlcStatus` from `sdlc-status.json`                   | Bar per agent, ranked by assignment count |

All three collapse to single-column at ≤1100px.

---

## Track 3 — Agentic (US-0142 → US-0145 → US-0144 → US-0146 → US-0143 → US-0147)

### US-0142 — Active Agent Prominence

Active agent cards (`is-active` class):

- `border-left: 3px solid var(--live-accent)`
- `background: color-mix(in oklab, var(--live-accent) 9%, transparent)`
- `border: 1px solid var(--live-accent)`
- Live dot: `animation: pulse 1.4s ease-in-out infinite`
- Status chip: filled `var(--live-accent)` background

Idle/blocked: static dot, neutral/risk chip, no accent rail.

### US-0145 — Event Log Terminal

- Promoted to **main-column full-width card** (not sidebar).
- Row format: `HH:MM:SS · AgentName · message` in monospace.
- Row colour keyed by tag: `start` (info), `done` (ok), `review` (warn), `block` (risk), `dispatch` (accent).
- Auto-scrolls on new events; pauses on `pointerenter`; resumes on `pointerleave`.
- Compressed Activity Stream card remains in right rail.

### US-0144 — Pipeline Scope

Phase cards show: phase number, name, agent-group label, partial-fill progress bar. Remove per-agent status and current-task fields (roster's job). Active phase: solid accent underline + pulsing beacon. Wraps 3×2 at ≤1024px.

### US-0146 — Live Bar

```
position: sticky; top: 52px; height: 48px;
background: linear-gradient(90deg, var(--live-accent-soft), transparent);
```

Contents: ON AIR chip · CYCLE NNN · elapsed · rotating 3-event ticker · HH:MM:SS clock.
Hidden on Plan-Status: `[data-mode="report"] .live-bar { display: none }`.
`prefers-reduced-motion`: ticker shows only most-recent event, no rotation.

### US-0143 — Conductor Dispatch Hold

- `dispatchHoldMs = 3000` — Conductor card holds `is-active` for 3s after dispatch completes.
- Each dispatch fires: `"Dispatched US-XXXX → AgentName"` entry into Event Log + Live Bar ticker.
- Dispatch counter on Conductor card increments and briefly animates on change.

### US-0147 — Agent Workload Live Data

- Reads `data.sdlcStatus.stories` keyed by agent name.
- Active = story in-flight for that agent's phase. Completed stories shown as `(N done)` sub-label.
- Agent rows use colour + icon from `agents.config.json`.
- Fallback when `sdlc-status.json` absent or unparseable: "No live data" empty state (no error thrown).

---

## Open Bugs Resolved by This Epic

| Bug      | Story   | Resolution                                      |
| -------- | ------- | ----------------------------------------------- |
| BUG-0183 | US-0135 | Status Hero card answers "on track?" directly   |
| BUG-0184 | US-0140 | Unified chartColors wired to Chart.js globals   |
| BUG-0185 | US-0142 | Active agent cards visually promoted            |
| BUG-0186 | US-0143 | Conductor dispatch hold (3s minimum)            |
| BUG-0187 | US-0144 | Pipeline trimmed; roster owns agent detail      |
| BUG-0188 | US-0145 | Event Log promoted to main column               |
| BUG-0189 | US-0136 | Navy gradient replaced with dark neutral chrome |

---

## Testing Strategy

- **Unit:** `theme.test.js` — AC-0498 lint rule (no hex literals in generated HTML). Token export shape assertions.
- **Unit:** `render-chrome.test.js` — REPORT/LIVE badge markup, aria-labels, segment tab active states.
- **Unit:** `render-tabs.test.js` (existing) — Status Hero HTML structure, density class toggling.
- **Integration:** Run `node tools/generate-plan.js` + `node tools/generate-dashboard.js` and assert both produce valid HTML with shared chrome class names.
- **Coverage gate:** ≥80% statements (currently ~93% — must not regress).
- **Manual:** Toggle L/M/S density; switch light/dark theme; verify `localStorage` persistence across reload.
