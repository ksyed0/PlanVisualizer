# EPIC-0010 Risk Analytics — Design Spec

**Date:** 2026-04-19  
**Epic:** EPIC-0010  
**Stories in scope:** US-0064, US-0065, US-0066, US-0067  
**Deferred:** US-0068 (Monte Carlo simulation)

---

## 1. Overview

Add composite risk scoring, risk visualisation, and velocity-based completion prediction to the PlanVisualizer dashboard. Risk data flows through a new pure-function compute module and is surfaced in three existing tabs plus a new sub-topbar banner.

Existing binary at-risk flags in `detect-at-risk.js` (`missingTCs`, `noBranch`, `failedTCNoBug`, `openCriticalBug`) are **unchanged** and coexist with the new numeric risk score as separate concerns: process-quality signals vs delivery-risk scores.

---

## 2. Architecture & Data Flow

```
generate-plan.js
  parse-* modules        (unchanged)
  compute-risk.js        (NEW — pure data transform)
  render-html.js         (extended — 4 render touch-points)
```

`generate-plan.js` calls `computeAllRisk(stories, bugs)` after all parse steps complete, attaches the result to `data.risk`, and passes it to the renderer.

`snapshot.js` adds an `avgRisk` field per snapshot entry for the Trends tab time-series.

---

## 3. Risk Formula

```
score = (priorityWeight × 0.4) + (severityWeight × 0.3) + (statusWeight × 0.3)
```

Score is rounded to one decimal place.

### Weight Tables

| Priority | Weight                 |
| -------- | ---------------------- |
| P1       | 4                      |
| P2       | 3                      |
| P3       | 2 (default when unset) |
| P4       | 1                      |

| Max open linked bug severity | Weight |
| ---------------------------- | ------ |
| Critical                     | 4      |
| High                         | 3      |
| Medium                       | 2      |
| Low                          | 1      |
| None (no open bugs)          | 0      |

| Story status   | Weight |
| -------------- | ------ |
| Blocked        | 4      |
| In-Progress    | 2      |
| Planned        | 1      |
| Done / Retired | 0      |
| (unrecognised) | 1      |

"Open" bugs: any bug whose status does not match `/^(Fixed|Retired|Cancelled)/i`.  
Severity weight uses the **maximum** severity across all open linked bugs for that story.

### Score → Level

| Score   | Level    | Color   |
| ------- | -------- | ------- |
| < 1.0   | Low      | #22c55e |
| 1.0–1.9 | Medium   | #3b82f6 |
| 2.0–2.9 | High     | #f59e0b |
| ≥ 3.0   | Critical | #ef4444 |

---

## 4. `compute-risk.js` Module

**Path:** `tools/lib/compute-risk.js`

Pure functions only — no file I/O, no side effects.

### Exports

```js
computeStoryRisk(story, (linkedBugs = []));
// → { score: number, level: 'Low'|'Medium'|'High'|'Critical' }

computeAllRisk(stories, bugs);
// → {
//     byStory: Map<storyId, { score, level }>,
//     byEpic:  Map<epicId,  { avgScore, maxScore, level, counts: { Low, Medium, High, Critical } }>
//   }

// Also exports weight tables for tests:
(PRIORITY_WEIGHTS, SEVERITY_WEIGHTS, STATUS_WEIGHTS);
```

### Epic Aggregation Rules

- Only non-Done, non-Retired stories contribute to the epic aggregate.
- `avgScore`: mean score across contributing stories (0 if none).
- `maxScore`: highest individual score.
- `level`: derived from `avgScore` using the same threshold table.
- `counts`: story count per level across contributing stories.
- Bug-to-story matching uses `normalizeStoryRef()` (already in `render-utils.js`) to extract `US-\d{4}` from arbitrary `relatedStory` text.

---

## 5. Render Touch-Points

### 5.1 Hierarchy Tab — Story Card Risk Badge (US-0064)

Each non-Done, non-Retired story card gets an inline risk badge:

```
[ High  2.3 ]   ← level label + score, colored by level
```

Badge is suppressed on Done/Retired stories (no delivery risk remains).  
Badge sits alongside existing at-risk flag badges.

### 5.2 Status Tab — Risk Section (US-0064 / US-0067)

Two stacked sub-sections under a single "Risk" heading:

**Risk Score by Epic** (horizontal bar chart)

- One bar per epic, sorted by `avgScore` descending.
- Bar fill and score label colored by level.
- Level badge (e.g., `Critical`) after the score.
- Matches visual style of existing "Story Status by Epic" bar chart.

**Story Risk Distribution** (column chart + KPI tiles)

- Four columns: Low / Medium / High / Critical, heights proportional to story count.
- Two KPI tiles below: "Avg score" (project-wide) and "High+Critical" (story count).
- Columns colored by level.

### 5.3 Trends Tab — Risk Trend Line (US-0065)

`snapshot.js:extractTrends()` adds one field per snapshot:

```js
avgRisk: <mean score across all non-Done/Retired stories at that snapshot>
```

Rendered as a line chart in the Trends tab alongside existing velocity and open-bugs lines.  
Old snapshots lacking the field are skipped gracefully (line starts from first entry that has it).

### 5.4 Sub-Topbar Completion Banner (US-0066)

Thin strip directly below the topbar, above the filter bar:

```
📅 Estimated completion: May 14 (likely) · Apr 28 – Jun 3 range    based on 4-wk velocity
```

**Velocity calculation:**  
`estimatedWeeksRemaining = remainingPoints / (completedPoints / weeksElapsed)`  
Falls back to story count if no story points are defined.  
Confidence range: ±20% of the point estimate (simple bound; Monte Carlo deferred).

**Visibility rule:** Hidden when fewer than 2 done stories or fewer than 1 week of elapsed data — insufficient signal to estimate.

---

## 6. At-Risk Epic Summary (US-0067)

A summary widget in the Status tab (below the two risk charts from §5.2) listing epics whose `avgScore ≥ 2.0` (High or Critical), sorted by score descending. Each entry shows: epic ID, avg score, level badge, and count of High+Critical stories.

---

## 7. Deferred

**US-0068 — Monte Carlo Delivery Simulation:** Deferred. Requires historical velocity variance data and is disproportionately complex relative to current project size. The ±20% confidence range in the completion banner (§5.4) provides a simple substitute.

---

## 8. Testing

### New: `tests/unit/compute-risk.test.js`

- Score formula correct for all weight boundary values (P1/P4 × Critical/none × Blocked/Done)
- Default priority fallback (no priority → weight 2)
- Severity = 0 when all linked bugs are Fixed/Retired/Cancelled
- Epic aggregation: Done/Retired stories excluded from avg and counts
- Epic avg score and level correct for mixed-level story set
- Level thresholds: scores at exactly 1.0, 2.0, 3.0 resolve to correct level
- `computeAllRisk` with empty stories/bugs returns empty Maps without error

### Extensions to `tests/unit/render-html.test.js`

- Risk badge present on non-Done story card in Hierarchy tab HTML
- Risk badge absent on Done story card
- Status tab HTML contains both "Risk Score by Epic" and "Story Risk Distribution" headings
- Sub-topbar banner present in HTML when sufficient velocity data; absent when <2 done stories
- Trends tab HTML contains `avgRisk` data series reference

---

## 9. Files Changed

| File                              | Change                                                                           |
| --------------------------------- | -------------------------------------------------------------------------------- |
| `tools/lib/compute-risk.js`       | NEW                                                                              |
| `tools/lib/snapshot.js`           | Add `avgRisk` to trend snapshot                                                  |
| `tools/generate-plan.js`          | Call `computeAllRisk`, attach to `data.risk`                                     |
| `tools/lib/render-html.js`        | Pass `data.risk` through to render modules                                       |
| `tools/lib/render-tabs.js`        | Story card badge, Status tab risk charts, Trends risk line, at-risk epic summary |
| `tools/lib/render-shell.js`       | Sub-topbar completion banner                                                     |
| `tests/unit/compute-risk.test.js` | NEW                                                                              |
| `tests/unit/render-html.test.js`  | New regression cases (see §8)                                                    |
