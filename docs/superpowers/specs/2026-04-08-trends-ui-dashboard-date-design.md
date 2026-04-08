# Trends Tab UI Polish + Agentic Dashboard Date — Design

**Date:** 2026-04-08
**Stories:** US-0084 (EPIC-0008), US-0085
**Status:** Approved

## Problem

Screenshot review of the live dashboard revealed:

1. Trends x-axis: ~40 overlapping date labels (one per snapshot)
2. Token y-axis: raw integers like `45,000,000` — hard to read
3. At-Risk chart: y-axis 0–1.0 makes near-zero data invisible
4. Grid lines: hardcoded `#e2e8f0` — too bright in dark mode
5. Agentic dashboard footer: only shows time (`HH:MM AM/PM`), no date

## Decisions

| #   | Decision                                                                         | Rationale                                                |
| --- | -------------------------------------------------------------------------------- | -------------------------------------------------------- |
| 1   | `maxTicksLimit: 8` on all 7 Trends chart x-axes                                  | Readable at any zoom; Chart.js picks evenly-spaced ticks |
| 2   | Short date callback: `(m+1) + '/' + d`                                           | Compact (`3/2`, `4/8`), matches en-US convention         |
| 3   | Token axis abbreviation (M/K callback)                                           | Matches common dashboard conventions                     |
| 4   | `suggestedMax: 5` on At-Risk y-axis                                              | Expands naturally with real data, never stays at 1.0     |
| 5   | Conditional grid color via `document.documentElement.classList.contains('dark')` | No state variable needed — reads live DOM class          |
| 6   | `toLocaleString('en-US', { month, day, year, hour, minute })`                    | Readable, locale-aware, no external libraries            |

## Files Modified

- `tools/generate-dashboard.js` — US-0085: "Last refreshed" full datetime
- `tools/lib/render-html.js` — US-0084: Trends chart options (lines 671–732)
