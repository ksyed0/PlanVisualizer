# Changelog

All notable changes to PlanVisualizer are documented here.

## [Unreleased]

### Fixed

- **BUG-0268 — pipeline phases all inactive after session-start** — `proper-lockfile` was missing from `node_modules` despite being declared in `package.json`. `SdlcMirror.write()` threw on every call, so `sdlc-status.json` stayed in the pre-migration flat format. The reader reads exclusively from `status.programme.phases`, returning `[]`. Fixed by restoring `proper-lockfile` via `npm install`.
- **BUG-0267 — Conductor Last Dispatch strip always shows 'No dispatches yet'** — `lastDispatch` filter searched for `e.tag === 'dispatch'` or `message.startsWith('dispatch')`, but `appendLog()` never writes a `tag` field and `agent-start` messages begin with `'started '`. Fixed filter to `startsWith('started ')`.
- **BUG-0266 — active-agent hero card task text unreadable in light theme** — the hero card's text palette is designed for a dark surface, but `.agent-card.is-active` (higher specificity) leaked a light background in light theme, dropping the current-task text to ~1.1:1 contrast. The card is now pinned dark in light theme too, restoring all four text elements to ≥7:1 (WCAG AA).
- **BUG-0265 — jest scans phantom tests in nested git worktrees** — `jest.config.js` now sets `testPathIgnorePatterns`/`modulePathIgnorePatterns` to exclude `/.claude/`, so a stale `.claude/worktrees/<name>/` tree no longer makes `npm test` discover and fail on worktree-local test copies (whose `node_modules` may be absent). CI is unaffected; this fixes local runs only.
- **BUG-0264 — claude-mem Stop hook crash (`Cannot find module 'zod/v3'`)** — `install.sh`/`update.sh` now verify the active claude-mem worker can resolve its dependencies after install/update, attempt repair via `npx claude-mem install` if not, and flag stale non-pinned plugin-cache versions (the actual trigger after an interrupted upgrade). The crash originated in the third-party claude-mem worker, not PlanVisualizer's own `capture-cost.js` Stop hook.

## [2.4.0] — 2026-05-17

### Added — EPIC-0028 Agentic Orchestration Engine

- **US-0182 Pre-Dispatch Spec & Plan Gate** — Conductor produces a spec + plan + acceptance checks before any code agent is dispatched; PO approves via `agent:approve` / rejects via `agent:reject` from CLI; pending approvals widget surfaces decisions on the dashboard.
- **US-0183 Per-Task Lifecycle Protocol** — every dispatched task is tracked through `in_progress` → `done` / `done_with_concerns` / `needs_context` / `blocked` via `tools/agent-task-lifecycle.js`; lifecycle state persists in `sdlc-status.json` and feeds the dashboard.
- **US-0184 Context Curator** — `tools/agent-context-curator.js` assembles a per-task context bundle (spec excerpts, related code paths, lessons, prior decisions) so dispatched agents start with curated, scoped context instead of cold-loading the repo.
- **US-0185 Per-Task Lens Review Gates** — two-phase review state machine (`spec_reviewing` → `quality_reviewing` → `forge_retry` → `approved` / `escalated`); `[sha:<commit>]` token convention lets Forge report the commit SHA back to the Conductor; automated BLOCKED routing for `MORE_CONTEXT` and `UPGRADE_MODEL`, with `SPLIT_TASK` / `ESCALATE_HUMAN` halting for human input.

### Added — EPIC-0029 Agentic Pipeline UX

- **US-0186 Dashboard Review-Gate Visualization** — S / M / L density toggle in the agentic dashboard topbar; small renders compact review icons, medium renders chips per phase, large renders a full per-task line with phase progress and outcome; preference persists in `localStorage`; respects `prefers-reduced-motion` (animations and transitions disable together).

### Added — CLI

- 15 new `agent:*` npm script aliases for lifecycle, context curator, and review gate tools (see README's "What's New in v2.4.0" section); install.sh / update.sh now register them automatically.

### Documentation

- `docs/architecture/AGENTIC_PIPELINE.md` — authoritative reference for EPIC-0028 + EPIC-0029 with 9 mermaid diagrams (state machines, flow charts, sequence diagram).
- ARCHITECTURE.md bumped to v1.6 (top-level system diagram + orchestration scope note); DESIGN.md bumped to v1.4 (vision expanded to cover orchestration engine).

### Fixed

- Pending Approvals widget now uses `patchDOM` live-patch instead of meta-refresh (no page flash).
- `agent-start` / `agent-done` regenerate the agentic dashboard automatically; `dashboard:watch` exposes a 5s auto-refresh loop.

## [2.3.0] — 2026-05-11

### Added — EPIC-0026 Memory Token Optimisation

- **US-0175 Compact Memory Index** — `MEMORY.md` becomes a thin index pointing to `docs/memory/` topic files; token cost at session startup drops sharply for large repos.
- **US-0176 MEMORY Widget** — dashboard widget surfaces current memory layout, archive size, and last-compact timestamp.
- **US-0177 Memory Compact / Archive** — `tools/memory.js compact` and `archive` subcommands; retrospectively logged as US-0177.
- **US-0178 Migrate-Commit** — `memory:migrate-commit` automates the PR-B migration pipeline (compact → migrate → commit) so the layout transition is a single command.
- **US-0179 Suggest-Model** — `memory:suggest-model` recommends Claude / GPT model tiers per topic file with complexity badges and topic hints.
- **US-0180 Per-Agent Model Selection** — `agents.config.json` gains per-agent model tables; agentic dashboard renders a model chip on each agent card.

### Added — GitHub Status Monitoring (US-0174)

- Both dashboards surface PR / CI / deployment status from the GitHub API with caching and rate-limit safety.

### Added — Plugins

- Optional `superpowers` + `claude-mem` plugin integration in install.sh / update.sh (opt-in prompts).

### Fixed

- BUG-0254..0257: dashboard UX and data fidelity fixes (idle agent portrait sizing, info-row line wrap, etc.).

## [2.2.0] — 2026-05-05

### Added — EPIC-0025 GitHub Issues Sync

- **US-0171 Sync Engine** — bi-directional sync between `BUGS.md` artefacts and GitHub Issues with state-map fallback when issue numbers are missing.
- **US-0172 Settings Tab** — UI for GitHub Issues Sync configuration: token status, last-sync summary, repo binding.
- **US-0173 Opt-In Story Sync** — Stories can be mirrored to GitHub Issues alongside bugs (opt-in to keep the default surface minimal).

### Added — Misc

- **US-0170 Variable-Length Artefact IDs** — removes the 4-digit regex cap on IDs (EPIC-XXXXX, US-XXXXX, etc.).
- install.sh / update.sh hardened to bootstrap `CLAUDE.md`, hooks, directories, and the agentic dashboard.

### Fixed

- BUG-0253: duplicate of BUG-0104, meta-refresh already removed (marked Fixed).
- Topbar gap regression — stale `body { padding-top: 52px }` removed; `pv-chrome` is sticky, not fixed.

## [2.1.0] — 2026-05-03

### Added — EPIC-0024 Backlog Closure

- **US-0056 Trends Date-Range Picker** — Trends tab gains a date-range selector so velocity / burn-up charts can be scoped to a window.
- **US-0116 Lap History Strip** — agentic dashboard renders a per-cycle history strip with segmented phase bars plus per-cycle outcome and incidents.
- **US-0117 Cycle Completion Animation** — pipeline phase bar plays a completion animation when a cycle finishes (respects `prefers-reduced-motion`).
- **US-0169 Hierarchy Risk Polish** — Hierarchy tab gains risk-based sort, risk filter, per-epic risk badges, and an average-risk reference line on the risk chart.

### Documentation

- README and `plan-visualizer.config.example.json` updated for v2.1.0; `tools/migrate-config.js` migrates older configs.

### Fixed

- BUG-0253 / BUG-0254: idle agent portrait sized to 160px with a single-line info row (regression from v2.0 hero card work).

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
