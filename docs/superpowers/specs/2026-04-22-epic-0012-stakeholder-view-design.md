# EPIC-0012: Stakeholder View — Design Spec

**Date:** 2026-04-22
**Epic:** EPIC-0012
**Status:** Approved
**Dependencies:** EPIC-0011 (Done), EPIC-0020 (Done — theme tokens)

---

## Scope

### In scope

- US-0073 — Dedicated Stakeholder tab in the sidebar nav
- US-0074 — Milestone progress view (expandable epic rows with story + AC drill-down)
- US-0075 — Budget summary tile with traffic-light indicator
- US-0076 — PDF export via browser print-to-PDF (`window.print()`)

### Deferred (not in this epic)

- US-0077 — Weekly email digests (Low priority, L estimate, depends on snapshot infra US-0054)
- US-0078 — Password protection (deployment-level access control is sufficient for now)
- html2pdf.js branded PDF export (future roadmap — noted in US-0076)

---

## Architecture

### Approach: new tab renderer (Option A)

Add `renderStakeholderTab(data)` to the existing tab-renderer pipeline. No new parsers, no new scripts, no pipeline changes. The `data` object already carries everything needed.

### Files changed

| File                             | Change                                                |
| -------------------------------- | ----------------------------------------------------- |
| `tools/lib/render-tabs.js`       | Add `renderStakeholderTab(data)` export (~200 lines)  |
| `tools/lib/render-shell.js`      | Add Stakeholder entry to `renderSidebar()` nav list   |
| `tools/lib/render-scripts.js`    | Extend `@media print` with stakeholder-specific rules |
| `tools/lib/render-html.js`       | Wire `renderStakeholderTab` into tab render chain     |
| `tests/unit/render-tabs.test.js` | New `describe('renderStakeholderTab')` block          |

---

## Data Flow

`renderStakeholderTab(data)` derives all content from the existing `data` object:

```
data.epics          → milestone rows (sorted ascending by EPIC ID; "No Epic" last)
data.stories        → story list per epic; AC list per story
data.costs[id]      → projectedUsd, actualUsd aggregated per epic
data.costs._totals  → global spend for summary tile
data.bugs           → open Critical/High count for risk tile
```

**Epic progress %** = `Done stories / non-Retired stories` for that epic (AC-0229).

**Epic-level cost aggregation** = sum of `data.costs[storyId].projectedUsd` (estimated) and `data.costs[storyId].costUsd` (actual AI spend) for all stories in that epic. Rendered only when `data.costs` is non-null.

**Burn rate narrative** — shown only when `budget.totalUsd` is configured:

- `weeklyBurnRate = data.costs._totals.costUsd / weeksElapsed`
- `weeksElapsed` = weeks since earliest entry in `data.progress` (falls back to 1 to avoid division by zero)
- `weeksRemaining = (budget.totalUsd - data.costs._totals.costUsd) / weeklyBurnRate`
- Rendered as: "At current pace, budget lasts N more weeks" (N rounded to nearest integer). Omitted if `weeksElapsed < 1` or `weeklyBurnRate === 0`.

---

## Plain Language Status Mapping

A lookup table at the top of `renderStakeholderTab`:

| Raw status                    | Displayed as    | Chip class  |
| ----------------------------- | --------------- | ----------- |
| `Done`                        | Complete        | `chip-ok`   |
| `In Progress` / `In-Progress` | Being Worked On | `chip-warn` |
| `Planned`                     | Planned         | `chip-mute` |
| `Blocked`                     | Needs Attention | `chip-risk` |
| `At Risk`                     | Needs Attention | `chip-risk` |

**Epic-level status** derived from story composition:

- All non-Retired stories Done → **Complete** (ok, green dot)
- Any Blocked story OR ≥1 open Critical/High bug linked to this epic → **Needs Attention** (warn, amber dot)
- ≥1 story Done or In Progress, none Blocked → **On Track** (info, blue dot)
- All Planned → **Planned** (mute, grey dot)

**Hidden technical fields** — never rendered in this tab: branch names, token counts, TC IDs, lesson IDs, bug fix branches, raw per-epic cost breakdowns.

---

## Tab Layout

Three vertical sections, top-to-bottom:

### 1. Summary bar (3 tiles, CSS grid 1fr 2fr 1fr)

**Tile 1 — Overall Progress**

- Large `%` value (JetBrains Mono, 22px) with story count inline to the right on the same baseline: `74% · 120 of 162 stories done`

**Tile 2 — Budget Health**

- Traffic-light dot (green/amber/red based on spend vs budget cap thresholds: <50% green, 50–80% amber, >80% red)
- Status label inline to right on same baseline: `On track · Est. $4,280 USD · AI spend $312.40 USD · At current pace, budget lasts 18 more weeks`
- If no `budget.totalUsd` configured: dot omitted, show spend figures only

**Tile 3 — Open Risks**

- Count of open Critical/High severity bugs + Blocked stories
- Sub-label: `N high bugs · N blocked stories`

### 2. Milestones section

Section header: `MILESTONES` (9px, uppercase, muted).

Epic rows wrapped in a flex column container at **4px gap**. Each row:

```
[dot] [EPIC-XXXX Name]          [progress bar] [XX%] [Status chip] [▾/▸]
      [Est. $NNN · AI spend $N]
```

- **Colour dot** matches status: green (ok), amber (warn), blue (info), grey (mute)
- **EPIC-ID** in JetBrains Mono, `--text-dim`, prefixed inline before name
- **Cost line** — second line under name: `Est. $NNN USD · AI spend $NNN USD` in 10px mono, `--text-mute` labels / `--text-dim` values. Hidden if no cost data.
- **Progress bar** — 72px wide, 6px tall, fills in status colour
- **%** — JetBrains Mono, coloured to match status
- **Status chip** — plain language label, themed chip

**Expanded epic** reveals a stories area (`--bg-sunk` background, 4px border-top):

```
STORIES label (9px uppercase muted)
  [✓/○] [US-XXXX Story title]               [▸ N ACs / ▾ N ACs]
```

- Story icon: `✓` in `--ok` (Done), `○` in `--warn` (In Progress), `○` in `--risk` (Blocked)
- US-ID in JetBrains Mono, `--text-dim`, prefixed inline
- Status chip shown for non-Done stories only
- No cost figures at story level

**Expanded story** reveals ACs indented below:

```
  [AC-XXXX] ✓ Acceptance criterion text
```

- AC-ID in JetBrains Mono, `--text-dim`, prefixed inline
- ✓ prefix for checked ACs

### 3. Export footer bar

Sticky bottom bar (`position: fixed`, sits above `left: 54px` to clear sidebar):

- Left: hint text "Opens your browser's Save as PDF dialog" (`--text-mute`, 11px)
- Right: **Export PDF** button (accent background, white text)
- Hidden in all other tabs (guarded by `showTab()` active-tab logic)

---

## PDF Export (`@media print`)

Extends existing `@media print` block in `render-scripts.js`:

```css
@media print {
  /* show only the stakeholder tab */
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

  /* hide interactive chrome */
  .stakeholder-export-bar {
    display: none !important;
  }

  /* ensure cost lines print */
  .epic-costs {
    display: flex !important;
  }

  body {
    font-size: 11pt;
  }
}
```

The `Export PDF` button calls `window.print()`. No library dependency.

**Future roadmap:** replace with html2pdf.js for branded gradient header, pixel-perfect page breaks, and direct download. Tracked as a follow-up to US-0076.

---

## Visual Design

All colours drawn from `theme.js` OKLCH token palette — no hardcoded hex values.

| Token              | Light value           | Dark value            |
| ------------------ | --------------------- | --------------------- |
| `--text`           | `oklch(10% 0.018 95)` | `oklch(97% 0.004 95)` |
| `--text-dim` (IDs) | `oklch(38% 0.015 95)` | `oklch(82% 0.008 95)` |
| `--text-mute`      | `oklch(52% 0.015 95)` | `oklch(70% 0.012 95)` |
| `--surface`        | `oklch(99% 0.004 95)` | `oklch(10% 0.018 95)` |
| `--bg-sunk`        | `oklch(94% 0.006 95)` | `oklch(10% 0.018 95)` |
| `--border`         | `oklch(88% 0.008 95)` | `oklch(22% 0.018 95)` |

**Typography:**

- Body / labels: `Inter Tight`
- All ID prefixes (`EPIC-`, `US-`, `AC-`), cost values, percentages: `JetBrains Mono`

---

## Testing

New `describe('renderStakeholderTab')` in `tests/unit/render-tabs.test.js`:

| #   | Test                         | Assertion                                                     |
| --- | ---------------------------- | ------------------------------------------------------------- |
| 1   | Renders tab container        | `#tab-stakeholder` present in HTML                            |
| 2   | Summary bar — progress tile  | Contains `%` figure and story count                           |
| 3   | Summary bar — budget tile    | Contains Est. and AI spend figures                            |
| 4   | Summary bar — risk tile      | Contains open bug + blocked story count                       |
| 5   | Epic rows present            | One `.epic-row` per non-Retired epic                          |
| 6   | Epic cost line               | Est. + AI spend rendered per epic when `data.costs` available |
| 7   | No cost line when costs null | Renders cleanly, no cost elements                             |
| 8   | Plain language — In Progress | Output contains "Being Worked On", not "In Progress"          |
| 9   | Plain language — Blocked     | Output contains "Needs Attention", not "Blocked"              |
| 10  | Story rows present           | Story rows inside expanded epic                               |
| 11  | AC rows present              | AC rows inside expanded story                                 |
| 12  | No technical fields          | Branch names, token counts absent from output                 |
| 13  | Export bar present           | `.stakeholder-export-bar` in output                           |
| 14  | Retired epics excluded       | Retired epics produce no epic row                             |
| 15  | No Epic group last           | `_ungrouped` stories appear after all EPIC-\* rows            |

Target: ≥15 new tests. Overall coverage must remain above 80% statements gate.

---

## Out of Scope

- US-0077 (email digests) — deferred, depends on US-0054 snapshot infra
- US-0078 (password gate) — deferred, deployment-level access control sufficient
- Story-level cost display — deferred, epic-level sufficient for stakeholders
- html2pdf.js — future roadmap item

## Future Stories

**Customisable currency support** — all cost figures in the Stakeholder View currently display in USD (hardcoded postfix). A future story should add a `costs.currency` field to `plan-visualizer.config.json` (default: `"USD"`) and an optional `costs.currencySymbol` (default: `"$"`). The `usd()` helper in `render-utils.js` should be updated to read from config so all cost surfaces — Stakeholder View, Costs tab, masthead tile — honour the configured currency without requiring per-call changes. This story should also consider locale-aware number formatting via `Intl.NumberFormat`.
