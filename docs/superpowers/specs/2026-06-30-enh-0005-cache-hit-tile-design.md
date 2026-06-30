# ENH-0005: Cache Hit % tile on the Costs tab — Design

**Date:** 2026-06-30 · **Session:** 67 · **Branch:** `feature/US-0273-cache-hit-ratio-tile`

## Problem

`docs/AI_COST_LOG.md` captures `Cache Read Tokens` per session but the
dashboard never surfaces `cacheHitRatio = cacheRead / (input + cacheRead)`.
Cache reads cost 10× less than direct/cache-write input at every tier
(confirmed in ENH-0007's pricing audit), so cache discipline is the single
biggest cost lever we have no visibility into.

## Pre-work resolved

- **Cache-write handling:** `tools/capture-cost.js:148-157` already folds
  `cacheWriteTokens` into the displayed `Input Tokens` column at capture
  time (`displayInput = inputTokens + cacheWriteTokens`). There is no
  separate cache-write column in `AI_COST_LOG.md` — cache-write is
  structurally already counted as "miss" via the existing Input Tokens
  field. No schema change needed; `cacheHitRatio = cacheRead / (input +
cacheRead)` is correct as specified in ENH-0005 with no further
  adjustment.
- **`[est]` rows:** 54 rows carry a `-est` sessionId suffix (pre-hook
  manual cost estimates from project inception, before `capture-cost.js`
  existed). Their cache-read values are fabricated round numbers, not real
  cache telemetry. These are excluded from the cache-hit ratio calculation
  by sessionId suffix match. (Separately, BUG-0269 cleanup is a
  prerequisite — it's already merged, so the full real-row dataset is
  available.)

## Decisions

1. **Scope: single tile (rolling-average, primary number) + sparkline
   trend** — not a new per-story/per-epic table column. The table-column
   variant (option c in the brainstorm) is materially larger UI surface
   for a first cut; a tile answers "is cache discipline trending well?" at
   a glance, which is the stated goal. Per-story/per-epic table columns
   are left as a clearly-scoped follow-on if the tile proves useful.
2. **Window size N = 14** sessions (not 7-day calendar window — session
   cadence is irregular, so a session-count window is more stable than a
   calendar window for a metric meant to catch trend, not just recency).
3. **Computation lives in `tools/lib/compute-costs.js`** (already the
   single place dashboard cost metrics are derived and unit-tested):
   - New `computeCacheHitSeries(costRows, { windowSize = 14 } = {})`:
     dedupes cost rows by session (last row per `sessionId` wins, matching
     existing Stop-hook cumulative-row semantics), excludes `-est` rows
     and any row with zero `input + cacheRead` (avoids NaN, e.g. degenerate
     test/seed rows), sorts by date, and returns `{ series, latest,
rollingAvg, windowSize, sampleCount }` — `series` is the full
     chronological list for the sparkline, `rollingAvg` is the simple mean
     of the last `windowSize` per-session ratios (each session weighted
     equally — a single huge session shouldn't dominate the trend signal).
   - `attributeAICosts` / `attributeBugCosts` extended to also accumulate
     `cacheReadTokens` (branch aggregates already carry this field via
     `aggregateCostByBranch`, it just wasn't being read) and expose a
     `cacheHitRatio` (or `null` if zero denominator) on every per-story,
     per-bug, and `_totals` result object. Computed and tested now even
     though not yet surfaced in the UI, since it's nearly free given the
     existing branch-aggregate plumbing and unblocks a future per-story
     column without re-touching this module.
4. **`generate-plan.js`** calls `computeCacheHitSeries(costRows)` once
   (mirroring the existing `sessionTimeline`/`costHistory` construction
   immediately below it) and attaches the result as `data.cacheHit`.
5. **Rendering** (`tools/lib/render-tabs.js#renderCostsTab`): a new tile
   row at the top of the Costs tab (above the budget section, always
   visible regardless of `hasBudget`), reusing the existing
   `.cycle-telemetry-tile` CSS pattern for visual consistency with the
   Cycle History telemetry row. One tile: value = `rollingAvg` formatted
   to one decimal (`62.3%`), or `–` when `null` (empty state — no
   real session rows yet). Threshold colour on the value text via inline
   `style="color:..."`: `var(--risk)` <50%, `var(--warn)` 50–70%,
   `var(--ok)` ≥70% (matches the existing budget-bar threshold pattern at
   render-tabs.js:1654-1663). A small sparkline (reusing
   `tools/lib/render-utils.js#sparkline()`, already dependency-free SVG —
   no new charting library) renders `series.map(s => s.ratio)` next to the
   value, with a `title` tooltip showing the latest single-session ratio
   for users who want the instantaneous number alongside the trend.
6. **Empty state:** `sampleCount === 0` → tile shows `–` and no sparkline
   (sparkline helper already no-ops below 2 points).

## Testing

- `tests/unit/compute-costs.test.js`: `computeCacheHitSeries` — excludes
  `-est` rows, excludes zero-denominator rows, dedupes by session keeping
  last, computes correct rolling average over exactly N and fewer-than-N
  samples, returns `null` rollingAvg/latest on empty input. `cacheHitRatio`
  on `attributeAICosts`/`attributeBugCosts` per-item and `_totals` results,
  including the `null`-on-zero-denominator case.
- `tests/unit/render-tabs.test.js` (or nearest existing costs-tab test
  file): tile renders the formatted percentage and correct threshold
  colour for each band, renders `–` for the empty-data case, sparkline
  markup present when `series.length >= 2`.

## Acceptance criteria (US-0273)

- AC-1057: Cache Hit % tile renders the rolling-14-session average to one
  decimal place on the Costs tab.
- AC-1058: Threshold colouring matches <50% red / 50–70% amber / ≥70%
  green.
- AC-1059: A sparkline of the per-session ratio series renders next to
  the tile value when ≥2 real sessions exist.
- AC-1060: `-est` rows and zero-denominator rows are excluded from the
  ratio calculation (unit-tested).
- AC-1061: Empty state (no real cost rows) renders `–`, not `NaN%`.
- AC-1062: `computeCacheHitSeries` and the extended `cacheHitRatio` fields
  on `attributeAICosts`/`attributeBugCosts` reach ≥80% branch coverage.
