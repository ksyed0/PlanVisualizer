# EPIC-0015 Remaining Stories — Design Spec

**Date:** 2026-04-18  
**Stories:** US-0101, US-0102, US-0103, US-0106  
**Epic:** EPIC-0015 UI Review and Redesign  
**Status:** Approved — ready for implementation

---

## Context

EPIC-0015 has 4 stories marked "Planned" in RELEASE_PLAN.md that are functionally complete — all acceptance criteria were implemented in prior sessions but the stories were never formally closed. The only real code gap is AC-0333 / BUG-0112 (light-mode hover shadow broken on Kanban cards, using hardcoded `rgba(0,0,0,0.35)` instead of a theme-aware CSS variable).

**Goal:** Run a Playwright Sentinel QA pass to catch visual regressions, file bugs, then close all 4 stories in parallel via worktree agents.

---

## Verified Implementation State

| Story   | Title                 | ACs Done | Remaining                                                                  |
| ------- | --------------------- | -------- | -------------------------------------------------------------------------- |
| US-0101 | Kanban Polish         | 4/5      | AC-0333 (BUG-0112): fix light-mode hover shadow in `render-scripts.js:709` |
| US-0102 | Traceability Redesign | 4/4      | No test cases                                                              |
| US-0103 | Status Tab Editorial  | 4/4      | No test cases                                                              |
| US-0106 | Bugs Severity Triage  | 5/5      | No test cases                                                              |

---

## Pipeline

### Phase 1 — Sentinel QA Agent (Serial)

Generate the dashboard, screenshot 4 tabs × 2 modes (light/dark), audit each AC visually, file BUG-0159+ for any issues found.

**Per-tab audit checklist:**

| Tab          | What to verify                                                                                                                                         |
| ------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Kanban       | Gradient column headers; P0=red/P1=amber priority stripes; In-Progress pulse animation; WIP pill turns red when >3; hover shadow visible in light mode |
| Traceability | Colored dots (not letters); crosshair hover; sticky story column; inline caption with live counts                                                      |
| Status       | Hairline rule + display titles; "Delivery"/"Financial" supertitles; doughnut hero numbers; Inter legend font                                           |
| Bugs         | Severity badge (2px/small-caps) distinct from status badge; 4px left stripe; copy-on-hover icon; lesson pill "L-XXXX ↗"; Compact view toggle           |

Bugs found are assigned to the corresponding story's Phase 2 agent. Critical/High bugs block story closure.

---

### Phase 2 — Parallel Story Closure (4 Worktree Agents)

All 4 agents launch simultaneously after Phase 1 completes.

#### US-0101 — Kanban Polish

**Branch:** `feature/US-0101-kanban-polish`  
**Fix:** `render-scripts.js:709` — replace hardcoded shadow with `var(--shadow-card-hover)`; add `--shadow-card-hover` token to light and dark `:root` blocks  
**TCs:** TC-0140–TC-0144

| TC      | Assertion                                                                   |
| ------- | --------------------------------------------------------------------------- |
| TC-0140 | Column headers have gradient background and 2px accent border-bottom        |
| TC-0141 | P0 card renders danger-color border-left; P1 renders warn-color             |
| TC-0142 | In-Progress column cell has `ksw-inprogress` class                          |
| TC-0143 | WIP pill gets `wip-over` class when count > threshold                       |
| TC-0144 | `.story-card-hover:hover` box-shadow uses CSS variable (not hardcoded rgba) |

#### US-0102 — Traceability Redesign

**Branch:** `feature/US-0102-traceability-redesign`  
**TCs:** TC-0145–TC-0148

| TC      | Assertion                                                                         |
| ------- | --------------------------------------------------------------------------------- |
| TC-0145 | Test cells render `<td class="tc-dot tc-dot-{tone}">` with no letter text content |
| TC-0146 | First `<th>` and story `<td>` have `trace-sticky-col` class                       |
| TC-0147 | `<caption>` contains pass/fail/not-run counts with `.tc-dot` legend elements      |
| TC-0148 | TC header `<th>` elements have `data-col` attributes for crosshair JS             |

#### US-0103 — Status Tab Editorial

**Branch:** `feature/US-0103-status-editorial`  
**TCs:** TC-0149–TC-0152

| TC      | Assertion                                                                      |
| ------- | ------------------------------------------------------------------------------ |
| TC-0149 | Charts render with `.chart-header-rule` + `.display-title` + `.chart-subtitle` |
| TC-0150 | HTML contains two `.chart-supertitle` elements: "Delivery" and "Financial"     |
| TC-0151 | Doughnut containers include `.chart-center-overlay` with `.hero-num` child     |
| TC-0152 | Chart.js config objects include `font.family` containing `'Inter'`             |

#### US-0106 — Bugs Severity Triage

**Branch:** `feature/US-0106-bugs-severity`  
**TCs:** TC-0153–TC-0157

| TC      | Assertion                                                                                 |
| ------- | ----------------------------------------------------------------------------------------- |
| TC-0153 | Severity badge renders `badge-sev` class (2px radius + small-caps)                        |
| TC-0154 | Bug rows/cards include `border-left: 4px solid` with severity color                       |
| TC-0155 | Fix Branch cell has `title` attribute and `.copy-btn` element                             |
| TC-0156 | Lesson link renders as `.lesson-pill` with ID text + ↗                                    |
| TC-0157 | Three view toggle buttons present: `.bugs-col-btn`, `.bugs-card-btn`, `.bugs-compact-btn` |

---

## ID Pre-allocation

| Story   | TC range        | BUG range                    |
| ------- | --------------- | ---------------------------- |
| US-0101 | TC-0140–TC-0144 | any Phase-1 bugs → BUG-0159+ |
| US-0102 | TC-0145–TC-0148 | —                            |
| US-0103 | TC-0149–TC-0152 | —                            |
| US-0106 | TC-0153–TC-0157 | —                            |

After all stories close: TC next = TC-0158, BUG next = BUG-0159 + count of Phase-1 bugs filed.

---

## Key Files

| File                          | Role                                 |
| ----------------------------- | ------------------------------------ |
| `tools/lib/render-scripts.js` | CSS tokens; BUG-0112 fix at line 709 |
| `tools/lib/render-tabs.js`    | Tab renderers for all 4 stories      |
| `docs/RELEASE_PLAN.md`        | Story status + TC entries            |
| `docs/BUGS.md`                | New bugs from Sentinel QA            |
| `docs/ID_REGISTRY.md`         | TC + BUG counter updates             |
| `tests/render-tabs.test.js`   | Primary Jest file for new TCs        |

---

## Verification

After all 4 PRs merge to develop:

1. `npx jest --coverage` — all tests green, ≥80% statements
2. `node tools/generate-plan.js` — generates without errors
3. Open `plan-status.html` — all 4 tabs render correctly in light + dark mode
4. RELEASE_PLAN.md shows US-0101/0102/0103/0106 as Done
5. EPIC-0015 status → Done

---

## Future Story Note

**US-0110 (EPIC-0017):** Research and integrate superpowers skills and frontend-design skill into the DM_AGENT.md pipeline. Formally define which skills apply at each Conductor/Pixel/Lens/Sentinel stage. Spec this story in a dedicated EPIC-0017 brainstorming session.
