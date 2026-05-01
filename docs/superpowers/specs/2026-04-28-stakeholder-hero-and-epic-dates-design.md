# Design Spec — Stakeholder Tab Hero + Epic Start/Done Dates

**Date:** 2026-04-28
**Session:** 31
**Status:** Approved

---

## Scope

Two related enhancements to the plan-status dashboard:

1. **Epic start/done dates** — add optional `StartDate:` and `DoneDate:` fields to each epic in `RELEASE_PLAN.md`; parse and display them in the Stakeholder tab epic progress rows.
2. **Stakeholder tab hero section** — add the Status tab's release-health hero (verdict, sparklines, KPI tiles, Overall Progress, Epic Progress, Top Risks, This Week) to the top of the Stakeholder tab, replacing the current redundant summary bar.

---

## Feature 1 — Epic Start/Done Dates

### Data Format

Add two optional fields to each epic block in `docs/RELEASE_PLAN.md`. Both are optional — missing means `null` in the parsed output.

```
EPIC-0001: Core Parsing Engine
Description: ...
Release Target: MVP (v1.0)
Status: Done
StartDate: 2026-03-05
DoneDate: 2026-03-10
Dependencies: None
```

**Rationale for explicit fields over session-log parsing:** Explicit fields are authoritative, simple to parse (one regex per field), resilient to session log format changes, and trivially updated when dates need correction.

### Parser Changes

**File:** `tools/lib/parse-release-plan.js`, `parseEpicBlock(text)`

Add `startDate` and `doneDate` to the returned object using the existing `get()` helper. Return `null` (not empty string) when absent:

```js
return {
  id: idTitle[1],
  title: idTitle[2].trim(),
  description: get('Description'),
  releaseTarget: get('Release Target'),
  status: get('Status'),
  startDate: get('StartDate') || null,
  doneDate: get('DoneDate') || null,
  dependencies: parseDeps(get('Dependencies')),
};
```

### Data Entry

Pre-populate `RELEASE_PLAN.md` with dates derived from `progress.md` session scan. Epics that predate the session log (EPIC-0001, EPIC-0002) will have `StartDate:` left blank (null). The full table of derived dates:

| Epic      | StartDate  | DoneDate      | Source               |
| --------- | ---------- | ------------- | -------------------- |
| EPIC-0001 | (unknown)  | (unknown)     | Predates session log |
| EPIC-0002 | (unknown)  | (unknown)     | Predates session log |
| EPIC-0003 | (unknown)  | (unknown)     | Predates session log |
| EPIC-0004 | 2026-03-11 | 2026-04-13    | S7–S17               |
| EPIC-0005 | 2026-03-11 | 2026-03-11    | S7                   |
| EPIC-0006 | 2026-03-16 | 2026-03-16    | S8                   |
| EPIC-0007 | 2026-03-16 | 2026-04-13    | S8–S17               |
| EPIC-0008 | 2026-03-30 | 2026-04-13    | S14–S17              |
| EPIC-0009 | 2026-04-08 | 2026-04-27    | S15–S30              |
| EPIC-0010 | 2026-04-19 | 2026-04-19    | S23                  |
| EPIC-0011 | 2026-04-08 | 2026-04-08    | S15                  |
| EPIC-0012 | 2026-04-22 | 2026-04-22    | S26                  |
| EPIC-0013 | 2026-04-13 | 2026-04-27    | S17–S30              |
| EPIC-0014 | 2026-04-13 | 2026-04-27    | S17–S30              |
| EPIC-0015 | 2026-04-13 | 2026-04-18    | S17–S20              |
| EPIC-0016 | 2026-04-13 | 2026-04-27    | S17–S30              |
| EPIC-0017 | 2026-04-13 | 2026-04-18    | S22                  |
| EPIC-0019 | 2026-04-15 | 2026-04-27    | S18–S30              |
| EPIC-0020 | 2026-04-21 | 2026-04-27    | S24–S30              |
| EPIC-0021 | 2026-04-27 | 2026-04-27    | S30                  |
| EPIC-0022 | 2026-04-24 | (in progress) | S28                  |

### Display

Show dates inline in the Stakeholder tab's epic progress rows — immediately below the epic title/status, in muted monospace text:

```
EPIC-0004  CI/CD Pipeline  [Done]
Mar 11, 2026 → Apr 13, 2026
```

Format: `MMM D, YYYY → MMM D, YYYY` using `toLocaleDateString('en-US', {month:'short', day:'numeric', year:'numeric'})`. If only `startDate` is present: `MMM D, YYYY → in progress`. If neither is present: omit the date line entirely.

---

## Feature 2 — Stakeholder Tab Hero Section

### Current State

The Stakeholder tab currently opens with a `sh-summary-bar` tile row (Overall Progress %, Budget Health, Open Bugs, Blocked) followed by the per-epic story table. The summary bar is redundant with the Status tab and provides less information than the Status hero.

### New Structure

The Stakeholder tab will open with the full Status tab hero section, then the per-epic content below. The existing `sh-summary-bar` is **removed** (its data is fully covered by the hero).

```
┌─────────────────────────────────────────────────────┐
│  Release Health hero                                  │
│  (verdict chip + narrative + Forecast/Velocity/Budget) │
│  Sparklines (Progress · Coverage · Burn)             │
│  4 KPI tiles (Overall % · Coverage % · Open Bugs · AI$) │
├──────────────────┬──────────────────┬────────────────┤
│ Overall Progress │ Epic Progress    │ Top Risks      │
│ (completion bar, │ (top 3 bars +    │ (BUG IDs kept, │
│  counts)         │  expand link)    │  severity dot) │
├──────────────────┴──────────────────┴────────────────┤
│ This Week (Stories Shipped · Bugs · AI Spend)        │
├─────────────────────────────────────────────────────┤
│  ── existing Stakeholder content below ──            │
│  Per-epic story table (unchanged)                    │
│  Export bar (unchanged)                              │
└─────────────────────────────────────────────────────┘
```

### Implementation

**Files:** `tools/lib/render-tabs.js`

The Status tab already calls:

```js
${_renderStatusHero(data)}
${_renderDecisionWidgets(data)}
```

`renderStakeholderTab(data)` will add the same calls at the top, replacing the `${summaryBar}` variable:

```js
// BEFORE
return `
<div id="tab-stakeholder" ...>
  ${summaryBar}
  ${epicRows}
  ...
`;

// AFTER
return `
<div id="tab-stakeholder" ...>
  ${_renderStatusHero(data)}
  ${_renderDecisionWidgets(data)}
  ${epicRows}
  ...
`;
```

The `summaryBar` template literal and all variables used exclusively by it (`tlColor`, `tlLabel`, `budgetLine`) are removed.

**No data pipeline changes required** — `_renderStatusHero` and `_renderDecisionWidgets` consume the same `data` object already passed to `renderStakeholderTab`.

### Epic Dates in Hero

The Epic Progress widget (`_renderDecisionWidgets`) currently shows bare epic IDs and titles. After Feature 1 lands, the dates will appear inline in the Stakeholder epic rows (rendered by `renderStakeholderTab`'s own epic table), not inside the hero widget. The hero's Epic Progress bars remain unchanged — they show completion percentage only.

### Export Bar

The `position:fixed` export bar currently uses `#tab-stakeholder:not(.hidden) .stakeholder-export-bar { display: flex }` — this remains unchanged and will continue to work correctly since the tab ID doesn't change.

---

## Test Plan

### Feature 1 — Epic dates

- `parseEpicBlock` returns `startDate`/`doneDate` as `YYYY-MM-DD` strings when present
- Returns `null` for both when fields absent
- Stakeholder tab epic rows show formatted date range for Done epics
- Stakeholder tab epic rows show `→ in progress` for in-progress epics with only startDate
- Stakeholder tab epic rows omit date line for epics with no dates

### Feature 2 — Stakeholder hero

- Stakeholder tab renders `pv-hero-section` at top (same structure as Status tab)
- `pv-widgets` section (Overall Progress, Epic Progress, Top Risks, This Week) renders in Stakeholder tab
- `sh-summary-bar` is absent from the Stakeholder tab HTML
- Export bar still renders and `display:flex` activates when tab is shown
- `npx jest --coverage` passes ≥80% statements

---

## Artefact IDs

Read `docs/ID_REGISTRY.md` before creating any artefacts. From current state:

- Next US: US-0162
- Next AC: AC-0591
- Next TC: TC-0553

Both features should be registered as stories under EPIC-0022 (Analytics & Charting Enhancements) or EPIC-0012 (Stakeholder View) — confirm correct epic association before writing artefacts.
