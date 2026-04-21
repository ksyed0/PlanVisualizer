# EPIC-0020 Cross-Dashboard Redesign — Design Spec

**Date:** 2026-04-21  
**Epic:** EPIC-0020  
**Stories:** US-0135–US-0146  
**Release Target:** Release 1.11  
**Source:** Claude Design handoff bundle (Redesign.html + chat transcripts)

---

## 1. Problem Statement

Both dashboards share a dominant navy gradient header that overpowers content, use inconsistent chart palettes across tabs, and differ too subtly for peripheral-vision identification. The Status tab lacks a single-glance release health summary. The Agentic dashboard makes active agents hard to distinguish and buries the event log in a narrow sidebar rail. The Conductor rarely appears active because its dispatches complete faster than the 1s refresh.

---

## 2. Design Direction

**Editorial × Mission Control hybrid.** Plan-Status is a calm editorial report; Agentic is a live broadcast surface. They share a token set and chrome but differentiate through accent hue and mode badge.

---

## 3. Architecture

No structural changes to the parser layer or CLI. All changes are within the render pipeline and the dashboard generator.

| File                          | Change type | Summary                                                                                                  |
| ----------------------------- | ----------- | -------------------------------------------------------------------------------------------------------- |
| `tools/lib/theme.js`          | Extend      | Add OKLCH token objects; keep existing `BADGE_TONE` exports                                              |
| `tools/lib/render-html.js`    | Update      | Replace hardcoded hex literals in `:root` CSS block with generated CSS custom properties from `theme.js` |
| `tools/lib/render-shell.js`   | Update      | Replace `renderTopBar()` with `renderChrome()`; add `renderModeBadge()`                                  |
| `tools/lib/render-tabs.js`    | Update      | Status tab: hero card + decision widgets + shared chart palette                                          |
| `tools/generate-dashboard.js` | Update      | Active-agent prominence, conductor hold, event log, pipeline scope, live bar                             |
| `tests/unit/theme.test.js`    | New         | Token completeness + no-color-literal lint rule                                                          |
| `docs/RELEASE_PLAN.md`        | Append      | EPIC-0020 + US-0135..0146 (from handoff bundle)                                                          |
| `docs/BUGS.md`                | Prepend     | BUG-0183..0189 (from handoff bundle)                                                                     |

**Note on `generate-dashboard.js`:** At 138KB this file is already large. If Layer 4 changes make it unwieldy, split it following the same pattern used for `render-html.js` in Session 19. Decision deferred to implementer.

---

## 4. Token System (US-0137 + US-0141)

### 4.1 Color Palette — OKLCH throughout

```js
// Neutrals — warm-cool hybrid, very low chroma
ink-0:  oklch(99% 0.004 95)   // near-white
ink-10: oklch(6%  0.018 95)   // near-black

// Dashboard accents — same chroma, different hues
--plan-accent:      oklch(62% 0.19 268)   // indigo/violet — calm, editorial
--plan-accent-soft: oklch(62% 0.19 268 / 0.14)
--plan-accent-ink:  oklch(42% 0.18 268)

--live-accent:      oklch(72% 0.19 38)    // amber/signal — live, broadcast
--live-accent-soft: oklch(72% 0.19 38 / 0.18)
--live-accent-ink:  oklch(55% 0.18 38)

// Semantic
--ok:   oklch(68% 0.15 150)   // green
--warn: oklch(74% 0.16 78)    // amber
--risk: oklch(64% 0.20 25)    // red
--info: oklch(66% 0.14 240)   // blue
```

Browser support: Chrome 111+, Firefox 113+, Safari 15.4+.

### 4.2 Theme Mapping

Replace `html.dark` class with `data-theme` attribute on `<html>`:

```css
[data-theme="light"] { --bg: ink-1; --surface: ink-0; --text: ink-9; … }
[data-theme="dark"]  { --bg: ink-10; --surface: ink-9; --text: ink-1; … }
```

Dark theme uses low-chroma warm neutral base (not pure black). Light theme uses near-white with subtly tinted canvas (not `#FFF`). Cards separated by 1px border + subtle shadow so they render in print.

### 4.3 Typography

```
--font-sans:    'Inter Tight', ui-sans-serif, system-ui, sans-serif
--font-display: 'Inter Tight', ui-sans-serif, system-ui, sans-serif
--font-mono:    'JetBrains Mono', ui-monospace, monospace
```

**Drop Fraunces** — loaded in the prototype but never referenced via `--font-display`. Saves a font round-trip. Can be added back later as a one-line token change.

### 4.4 Chart Palette

```js
// theme.js export
export const chartColors = { ok, warn, risk, info, accent, mute };
```

Chart.js global defaults (colors, grid, tooltip) initialised from `chartColors` on page load.

### 4.5 localStorage Migration

```js
// One-time migration shim on first load
const old = localStorage.getItem('theme');
if (old && !localStorage.getItem('pv-theme')) {
  localStorage.setItem('pv-theme', old);
  localStorage.removeItem('theme');
}
```

Key changes from `theme` → `pv-theme` (AC-0513).

### 4.6 Lint Rule

`tests/unit/theme.test.js` greps generated HTML output and fails if any `#[0-9a-fA-F]{3,6}` or `rgb(` literal appears outside the CSS token declaration block. Enforces AC-0498.

---

## 5. Chrome (US-0136 + US-0138)

`renderChrome()` replaces `renderTopBar()` in `render-shell.js`.

**EPIC-0010 preservation:** `render-shell.js` also exports `renderCompletionBanner()` (added in EPIC-0010, Session 23). This function is called independently of `renderTopBar()` and must be preserved unchanged. The new `renderChrome()` sits in the same position as the old topbar; `renderCompletionBanner()` continues to render immediately below it. Do not remove or alter `renderCompletionBanner()` as part of this work.

**Visual:** Frosted-glass neutral surface. `backdrop-filter: blur(12px) saturate(1.2)`. 1px bottom border. No gradient. Height ≤ 52px.

**Layout (left → right):**

1. Brand mark: `● Plan Visualizer` (dot = gradient indigo→amber)
2. Dashboard switcher: segmented control, `Plan-Status | Pipeline`
3. Spacer
4. Mode badge (see below)
5. About button (`ⓘ About`)
6. Theme toggle: `☀ Light | ☾ Dark`

**Mode badge (US-0138):**

- Pill with colored pip + uppercase mono text
- Plan-Status: static indigo pip, label `REPORT`
- Agentic: pulsing amber pip (1.6s), label `LIVE`
- `aria-label="Mode: Report"` / `aria-label="Mode: Live"` (AC-0503)
- Keyboard-focusable (AC-0503)

---

## 6. Status Tab (US-0135 + US-0139 + US-0140)

Three additions rendered **above** the existing EPIC-0010 charts in `render-tabs.js` `renderStatusTab()`. All existing Status tab content (Risk Score by Epic HTML bar chart, risk badge logic) is preserved below the new widgets — nothing is removed.

### 6.1 Status Hero Card (US-0135)

Full-width card at top of Status tab:

- **Verdict chip:** one word — `On track` (ok) / `At risk` (warn) / `Off track` (risk) — derived from open critical bugs + blocked stories + forecast vs. target date
- **One-sentence narrative:** e.g. "Release 1.11 is on track with 76% completion and no critical blockers."
- **Three stat blocks:** Forecast (P50 ship date ± buffer from `data.completion`), Velocity (stories/wk + week-over-week delta from trends), Budget (% of cap + absolute $ from `data.costs`)
- **Three mini-viz:** 14-week progress bars (from trends data), 30-day coverage heat strip (30 cells, colored by coverage level), cumulative AI spend burn line (sparkline from `parseCostLog`)
- Numeric fields use `tabular-nums` and `--font-display`; mini-viz use shared `chartColors` tokens

### 6.2 Decision Widgets Row (US-0139)

Three equal-width cards below the hero, collapsing to single-column at ≤1100px:

**Top Risks card** — severity-chipped list drawn from:

- Open Critical/High bugs (from `data.bugs`)
- Blocked stories (from `data.stories`)
- Overdue epics (target date passed, not Done)

**This Week card** — stats for the current 7-day window:

- Stories shipped, PRs merged, bugs opened, bugs fixed, AI spend
- Source: `progress.md` (newest-first, parse last 7 days) + `parseCostLog`

**Agent Workload card** — horizontal bar per agent, ranked by current story assignment count. Source: `data.stories` grouped by assigned agent (requires agent name in story metadata or defaults to "Unassigned").

### 6.3 Chart Palette (US-0140)

All existing `Chart.js` calls in `renderStatusTab()`, `renderChartsTab()`, `renderTrendsTab()` updated to read from `chartColors` token map. "Done" = `ok`, "In Progress" = `info`, "Blocked" = `risk`, "Planned" = `mute`. Doughnut center label, bar fill, line stroke, and legend swatches all from the same tokens.

---

## 7. Agentic Dashboard (US-0142–US-0146)

All changes in `generate-dashboard.js`.

### 7.1 Active Agent Prominence (US-0142)

When agent status = active:

- 3px left accent rail in `--live-accent`
- Card background tinted ~9% live-accent mix
- 1px outline border in `--live-accent`
- `box-shadow: 0 0 0 1px var(--live-accent)`
- Live-dot pulses at 1.4s; idle/blocked dots are static
- Status chip filled with `--live-accent` for active; neutral/risk tokens for idle/blocked
- Accessible focus ring does not conflict with the left rail (offset by 2px)

### 7.2 Conductor Dispatch Hold (US-0143)

When Conductor transitions active → idle:

- UI holds the active state for minimum 3s before fading back to idle (JS `setTimeout`)
- Each dispatch fires a "Dispatched US-XXXX → AgentName" entry at top of Event Log and live ticker
- Dispatch counter increments on Conductor card with CSS number animation

### 7.3 Event Log (US-0145)

Promoted from sidebar rail to main-column full-width card:

- Monospace rows: `timestamp · agent · message`
- Row colors by tag: `start` (live-accent-ink), `done` (ok), `review` (info), `block` (risk), `dispatch` (plan-accent-ink)
- Auto-scrolls on new events; pauses on pointer-enter; resumes on pointer-leave
- Compressed "Activity Stream" card remains in right rail for peripheral glance, newest-item accent rail

### 7.4 Pipeline Scope Reduction (US-0144)

Phase cards show only: phase number, name, agent-group label, partial-progress fill bar. Remove per-agent status and current task (roster owns that). Active phase: solid accent underline + pulsing corner beacon. Completed: `ok` token. Blocked: `risk` token. Layout: one row at ≥1200px, 3×2 at ≤1024px.

### 7.5 Live Bar (US-0146)

Thin strip between chrome and masthead, ~48px tall:

- Horizontal live-accent gradient wash (left 3px accent rail variant)
- Contains: `ON AIR` chip, `CYCLE NNN · elapsed`, rotating ticker of last 3 events, tabular `HH:MM:SS` clock
- Hidden entirely on Plan-Status (REPORT mode)
- `prefers-reduced-motion`: ticker becomes static most-recent event only

---

## 8. Implementation Sequence

| Layer          | Stories                                     | Constraint                                      |
| -------------- | ------------------------------------------- | ----------------------------------------------- |
| 1 — Foundation | US-0137, US-0141                            | No visual change; pure token + theme migration  |
| 2 — Chrome     | US-0138, US-0136                            | Requires Layer 1                                |
| 3 — Status tab | US-0135, US-0139, US-0140                   | Requires Layer 1; independent of Layer 2        |
| 4 — Agentic    | US-0142, US-0143, US-0145, US-0144, US-0146 | Requires Layer 1; can run parallel with Layer 3 |

Each layer ships as one PR per story, squash-merged into `develop`. CI gates: Lint, Test + Coverage (≥80%), Prettier, Dependency Audit. Coverage must stay ≥80% throughout.

---

## 9. Handoff Artifacts to Apply

Before beginning implementation, apply handoff bundle content:

1. **Append** `plan-visualizer/project/handoff/release-plan-epic.md` content to `docs/RELEASE_PLAN.md`
2. **Prepend** `plan-visualizer/project/handoff/bugs-append.md` content to `docs/BUGS.md`
3. **Update** `docs/ID_REGISTRY.md`: EPIC next = EPIC-0021, US next = US-0147, AC next = AC-0535, BUG next = BUG-0190, TC next = TC-0158 (unchanged)

---

## 10. EPIC-0010 Preservation Contract

The following EPIC-0010 artifacts are **not touched** by this redesign. Implementers must not remove or regress them:

| Artifact                       | Location                         | Notes                                               |
| ------------------------------ | -------------------------------- | --------------------------------------------------- |
| `renderCompletionBanner()`     | `render-shell.js`                | Called below chrome; keep position and logic intact |
| Risk Score by Epic chart       | `render-tabs.js` → Status tab    | Preserved below new hero/widget additions           |
| avgRisk trend line             | `render-tabs.js` → Trends tab    | Not in scope; no changes                            |
| Risk badges on story cards     | `render-tabs.js` → Hierarchy tab | Not in scope; no changes                            |
| `compute-risk.js`              | `tools/lib/`                     | Pure compute module; not touched                    |
| `data.risk`, `data.completion` | `generate-plan.js`               | Data pipeline; not touched                          |

The Status hero card (US-0135) reads `data.completion` to populate its Forecast stat block — this is a read-only dependency, not a modification.

---

## 11. Out of Scope

- Parser layer (`parse-*.js`) — no changes
- CLI entry point (`generate-plan.js`) — no changes
- CI configuration — no changes
- Mobile layout changes beyond what the prototype specifies
- Fraunces typeface (loaded in prototype but not used — excluded)
