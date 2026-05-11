# Project Completion Status (as of 2026-04-30 Session 34)

23 EPICs (EPIC-0023 fully closed last session). 165+ active stories. 218 BUGs total — Session 34 closed 8 (BUG-0237/0238/0245/0246/0247 via drift sweep PR #505; BUG-0217/0221/0224 via cost-attribution PR #507; BUG-0249/0250/0251 via PRs #515/#513). Two new bugs **Open**: BUG-0249/BUG-0250 (already fixed in PR #515 actually — both closed) and BUG-0252 (stash-trap, deferred to a future session — see below).
Develop fully green throughout. Next IDs: always check `docs/ID_REGISTRY.md` — as of end of Session 34: Next BUG = BUG-0253, Next L = L-0051.

Key additions (Session 34):

- **5 chart-init fallback string locations** consolidated to `'oklch(78% 0.012 95)'` (light theme value, since light is default). Locations: `render-scripts.js:263`, `render-tabs.js:529` (Trends `pvChartColors.mute`), `render-tabs.js:663` (`updateTrendsChartTheme`), `render-tabs.js:1313` (Charts `pvChartColors.mute`), `render-tabs.js:1319` (`chartTextColor` for Charts tab). **There are TWO `pvChartColors` declarations** in render-tabs.js — one at ~520 for Trends and one at ~1304 for Charts — when fixing color tokens find both.
- **Theme localStorage key consolidated.** Agentic `pvSetTheme` now writes BOTH `'pv-theme'` (canonical, shared with plan-status) AND `'dashboard-theme'` (legacy mirror). Init reads `pv-theme` first with `dashboard-theme` as legacy fallback. `.dark` class on `<html>` toggled in agentic too (was missing — caused selector parity issues per BUG-0190).
- **Cost attribution math** (PR #507, L-0049): `attributeAICosts` and `attributeBugCosts` must DIVIDE branch cost by N (count of artefacts sharing the branch), not credit the full aggregate to each. `extractTrends` should prefer `_totals.costUsd` over `Object.values(costs).reduce(...)` to avoid double-counting `_totals` alongside per-story rows.
- **Cost log drift root cause** (BUG-0252, deferred to future session): ~33 git stash entries hold trapped `AI_COST_LOG.md` rows from 2026-04-20→04-28. Branch-switching with `git stash` carries the appended rows away; the next checkout reverts to the committed state, the hook appends on top, and the previous stash is orphaned. Recovery: `for s in $(seq 0 32); do git stash show -p "stash@{$s}" -- docs/AI_COST_LOG.md; done | grep "^+| 2026" | sort -u` then merge unique rows.
- **Session Close Checklist** in `CLAUDE.md` now explicitly includes `docs/AI_COST_LOG.md` as a file to commit at session close (per L-0050).
- **Anthropic org usage limit hit during Session 34.** Background subagents fail with "You've hit your org's monthly usage limit" once the org cap is reached. Foreground sessions continue but new subagent spawns return that error. Resets at next billing cycle. Plan parallel work accordingly.
- **Playwright is the right tool for dashboard automated testing.** `mcp__plugin_playwright_playwright__*` runs headless Chromium against a local HTTP server (Playwright blocks `file://`). `browser_evaluate` is the primary verification primitive — read runtime state directly rather than relying on visual screenshots. `getComputedStyle` reads in tests must account for default theme (light for plan-status, dark for agentic).

Key additions (Session 33):

- EPIC-0010 status corrected: `Planned` → `Done`, `DoneDate: 2026-04-19` (shipped Session 23, never updated in RELEASE_PLAN.md).
- EPIC-0012 DoneDate added: `2026-04-28`.
- EPIC-0023 closed: `Done`, `DoneDate: 2026-04-29`. All 5 stories Done.
- US-0169 created: deferred risk sort/filter ACs (AC-0601–0605) from EPIC-0010 US-0064/0065/0067.
- `Chart.defaults.color` must use `getComputedStyle` (see L-0048) — raw `'var(--text-muted)'` strings are silently ignored by canvas. Fix in `render-scripts.js`.
- `pvChartColors` singleton guard: `window.pvChartColors = window.pvChartColors || (function(){...})()` in `renderChartsTab` prevents double-declaration overwrite.
- `updateTrendsChartTheme()` added to Trends script block; called from `pvSetTheme()` — re-reads computed colors and calls `chart.update('none')` for each trend chart so light/dark switch live-updates axis labels.
- `_dispatchCount` in `generate-dashboard.js` now persisted via `localStorage` — seeded on page load, written on every increment.
- `snapshot.js` `openBugs` filter switched from allowlist to canonical denylist `!/^(Fixed|Retired|Cancelled|Rejected)/i`.
- BUG-0242: week label fixed at month boundaries (`Apr 28–May 4` correct, was `Apr 28–4`).

Key additions (Session 31):

- `velocityByWeek(snapshots)` exported from `tools/lib/snapshot.js` — ISO week bucketing, t-shirt point deltas, 4-period rolling average, negative clamping.
- Weekly Velocity bar+line chart in Trends tab (`renderTrendsTab`). Uses `pvChartColors.info`/`.warn`. Excluded from `setTrendsRange` (ISO week labels are not snapshot timestamps).
- CDN-free: plan-status.html and dashboard.html no longer load Tailwind, Chart.js CDN, or Google Fonts. All styling via system font stacks and `var(--clr-*)` custom properties.
- `docs/AGENT_PLAN.md` created — 6-phase pipeline reference (AC-0280).
- Conductor card: `data-agent` attribute added; `conductor-dispatch-count` element with `pv-dispatch-flash` animation wired to `_dispatchCount` counter.
- Agent Workload widget: `(N done)` sub-label added via `done = total - inFlight`.

Key additions (Sessions 26–28):

- EPIC-0020 Done (cross-dashboard redesign, OKLCH theme, CSS tokens).
- EPIC-0022 created (Analytics & Charting): US-0159 Velocity Chart (Planned), US-0160 Remove Tailwind (Planned), US-0161 About modal redesign (Done).
- `renderAboutModal(aboutData)` in `render-html.js` — shared function for both dashboards. CSS uses `pv-about-*` classes with `var(--clr-*, var(--brand-*))` fallback chains. No Tailwind, no hex literals.
- About modal layout: full-width 400px hero image → title + tagline inline → 3×3 roster grid → repo link + attribution row → meta section.
- `openAbout()`/`closeAbout()` in render-scripts.js target `id="about-modal"` with `.open` class (harmonised with agentic pattern).
- `generate-dashboard.js` must define `pvSetTheme()`, `openAbout()`, and `closeAbout()` — all called from shared `renderChrome()` output.
- `#${buildNumber}` in modal HTML triggers the AC-0498 hex-literal test — use `r${buildNumber}` instead.
- EPIC_ACCENT_COLORS in render-tabs.js must always use `% EPIC_ACCENT_COLORS.length` — crashes without modulo when epicIdx ≥ 8.

Architecture decision: `Assignee:` field in RELEASE_PLAN.md stories is not meaningful for the multi-agent pipeline. Agent Workload widget should read from `docs/sdlc-status.json` instead.

---
