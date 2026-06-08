# Changelog

All notable changes to PlanVisualizer are documented here.

## [2.4.1] — 2026-06-08

### Fixed

- **BUG-0258 — claude-mem Stop hook crash (`Cannot find module 'zod/v3'`)** — `install.sh`/`update.sh` now verify the active claude-mem worker can resolve its dependencies after install/update, attempt repair via `npx claude-mem install` if not, and flag stale non-pinned plugin-cache versions (the actual trigger after an interrupted upgrade). The crash originated in the third-party claude-mem worker, not PlanVisualizer's own `capture-cost.js` Stop hook.

## [2.0.0] — 2026-05-01

### Added

- **Stakeholder Tab** — business-facing view with editorial verdict (On track / At risk / Off track), go/no-go decision widgets, epic progress in plain language, and forecast date
- **Status Tab Hero** — 28px verdict headline with "Release Health" eyebrow, forecast banner above sparklines, 48px-tall progress bars, placeholder fallbacks when trend data is sparse
- **Agentic Dashboard Visual Hierarchy** — active agent hero card with 200px landscape portrait banner; Conductor last-dispatch strip; 4-col idle roster at 65% opacity; event log promoted to main column; pipeline phase strip no longer shows agent names
- **Risk Analytics** — per-story and per-epic risk scores (EPIC-0010); risk level badges (Low / Medium / High / Critical); risk trend chart
- **Weekly Velocity Chart** — ISO-week grouped velocity with 4-period rolling average
- **Burn-up Chart** — two-dataset line chart (Completed vs Total Scope)
- **Playwright E2E Test Suite** — `tests/e2e/dashboard-hierarchy.spec.js` validates visual hierarchy invariants in CI
- **Superpowers Plugin Detection** — install.sh §0 checks for the superpowers Claude Code plugin and offers installation guidance
- **Agentic Dashboard Setup** — install.sh §7 copies `docs/dashboard.html` into adopting projects
- **agents.config.json Schema** — new top-level `project` (name, description, repoUrl, startDate) and `phases` (pipeline phase definitions) sections; auto-migrated by `tools/migrate-config.js`

### Changed

- **OKLCH Design System** — both dashboards now use a unified OKLCH colour palette; AC-0498 enforces no hex literals in generated output; agent colours migrate from hex to oklch values
- **Chrome Quieted** — shared chrome height reduced from 52px to 40px; navy gradient replaced with neutral background; LIVE/REPORT mode badge added (BUG-0189)
- **CDN Removal** — Tailwind CDN, Chart.js CDN, and Google Fonts removed; all styling uses CSS custom properties and system font stacks (BUG-0228-0230)
- **Cost Attribution** — branch costs now split evenly across all artefacts sharing a fix branch, fixing duplicated AI-cost totals (BUG-0217/0221/0224)
- **Chart Palette Consistency** — Status tab hero sparklines now use `pvChartColors.ok` (green) for done-story progress bars and burn SVG; eliminates `var(--plan-accent)` in data-semantic colour positions (BUG-0184)
- **Bugs Tab Collapse** — all three Bugs tab views (column, card, compact) default to collapsed epic groups on load (BUG-0223 regression guard added)

### Fixed

- BUG-0183: Status tab hero sparse — verdict now 28px, forecast above sparklines
- BUG-0185: Active agents hard to distinguish — full portrait hero card with amber glow
- BUG-0186: Conductor always shown idle — persistent last-dispatch strip
- BUG-0187: Pipeline + roster encoded same info — pipeline now shows cycle progress only
- BUG-0188: Activity log buried in sidebar — promoted to main column
- BUG-0189: Navy gradient chrome dominated — quieted to 40px neutral bar
- BUG-0240: Burn-up chart was a bar chart — now a line chart with Completed + Total Scope datasets
- BUG-0248: Stakeholder tab used simplified hero — now uses full `_renderFullStatusHero`
- BUG-0249: Chart-init OKLCH fallback matched dark theme — fixed to light theme default
- BUG-0250: Theme preference not synced between dashboards — unified to `pv-theme` localStorage key
- BUG-0251: AI_COST_LOG.md drifts from committed tree — session-close checklist now enforces sync
- BUG-0252: 172 cost-log rows trapped in git stashes — recovered and documented recovery technique (L-0051)

## [1.5.0] — 2026-04-13

- Agentic SDLC Dashboard (EPIC-0016): mission-control panel with 9 agent cards, 6-phase pipeline, event log, live metrics

## [1.0.0] — 2026-03-09

- Initial release: Hierarchy, Kanban, Traceability, Charts, Trends, Costs, Bugs, Lessons tabs
