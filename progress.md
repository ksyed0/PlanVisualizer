# progress.md — Session Log

Running log of session activity, errors, test results, and blockers.

---

## Session 12 — 2026-03-30

### What Was Done
- Restored blue gradient header (`linear-gradient(135deg, #003087 0%, #0050b3 50%, #0066cc 100%)`)
- Replaced pill stat chips with glassmorphic stat tiles (backdrop-filter: blur, rgba bg/border)
- Topbar height raised from 56px → 72px; all dependent CSS updated
- Added nav contrast: 3px active border-left, item separators (border-bottom on each nav-item), stronger active background
- Fixed BUG-0060 through BUG-0074 in `render-html.js`:
  - BUG-0060: 7th Lessons tab in test assertion
  - BUG-0061: Removed dead `fgrp-type` code from `updateFilterBar()`
  - BUG-0062: Removed duplicate `window.tailwind={}` before CDN load
  - BUG-0063: Null guards in `applyFilters()` and `clearFilters()`
  - BUG-0064/0071: Fixed `coveragePct` NaN in `renderChartsTab()`
  - BUG-0066: Prefixed lesson IDs `lesson-col-${id}` / `lesson-card-${id}` to avoid duplicates
  - BUG-0067: `esc(text)` added to `badge()` helper
  - BUG-0069: Activity toggle top position fixed to 76px (clears 72px topbar)
  - BUG-0072: Costs footer total now includes bug AI cost
  - BUG-0073: "To Do" added to status filter dropdown
  - BUG-0074: `esc()` on all `story.estimate` interpolations
- Fixed BUG-0076 through BUG-0087 in library files (via parallel background agent):
  - BUG-0076: `parse-coverage.js` per-field `.pct`+NaN guards
  - BUG-0077: `parse-release-plan.js` epic regex `(.+)`→`(.*)`
  - BUG-0078: `detect-at-risk.js` `!!` coerce `missingTCs` to boolean
  - BUG-0079: `generate-plan.js` `package.json` try-catch
  - BUG-0080: `compute-costs.js` `_totals` explanatory comment
  - BUG-0081: `parse-progress.js` `parseInt(sessionNum, 10)`
  - BUG-0082/0087: `parse-cost-log.js` branch regex + NaN guard
  - BUG-0083: `parse-lessons.js` `matchAll` for multi-block context
  - BUG-0084: `parse-release-plan.test.js` AC-TBD format test
  - BUG-0086: `parse-bugs.test.js` empty-input test
- Fixed 3 regression test assertions in `render-html.test.js` (lesson IDs, coverage tile class, 7-tab count)
- Marked all BUG-0060–BUG-0087 as Fixed in `docs/BUGS.md`
- Pushed to `feature/US-0048-ui-redesign-sidebar`, updated PR #83

### Test Results
- 177 tests pass. Statement: 96.55%, Branch: 82.01%. Gate: ≥80% ✓

### Errors or Blockers
- None.

---

## Session 11 — 2026-03-29

### What Was Done
- Implemented US-0048 (EPIC-0007): complete UI redesign in `tools/lib/render-html.js`
  - Replaced horizontal tab bar with responsive vertical sidebar (200px desktop, 160px tablet portrait, 44px icon-only <768px)
  - Rewrote topbar: neutral dark/white bar (removed blue gradient), 5 inline stat chips
  - Bug chip conditional colour: red = Critical/High open, amber = Med/Low only, muted = 0 open
  - Coverage chip turns red (`chip-danger`) when below 80% target
  - Inline SVG Heroicons (Heroicons outline v2); no CDN dependency
  - Responsive CSS: 4 tiers including foldable (`horizontal-viewport-segments: 2`), phone portrait (relative topbar), phone landscape compact (40px topbar)
  - Kanban sticky column headers + per-column `overflow-y: auto` scroll zones
  - ARIA: `<nav aria-label="Main navigation">`, `aria-current="page"`, `role="tabpanel"`, `aria-labelledby`, `aria-label` on filter inputs
  - BUG-0058 fix: `githubUrl` validated to `https://` prefix only
  - BUG-0059 fix: all IDs in `onclick` attrs wrapped with `esc()`
  - Updated `showTab()` JS to manage `nav-active` + `aria-current`
  - Updated `setStickyTop()` to handle fixed vs relative topbar across breakpoints
  - Created design spec: `docs/superpowers/specs/2026-03-29-ui-redesign-design.md`
- Fixed 2 test assertions to match new HTML structure
- Opened PR #83 (feature/US-0048-ui-redesign-sidebar → develop)

### Test Results
- 175 tests pass. Statement coverage: 96.71%. Branch coverage: 81.91%. Gate: ≥80% ✓

### Errors or Blockers
- None.

---

## Session 10 — 2026-03-28

### What Was Done
- Fixed BUG-0057: `aggregateCostByBranch` inflated AI costs because Stop hook appends cumulative rows per turn for the same session. Added `deduplicateSessions()` to `parse-cost-log.js` — keeps only the last row per `session_id` (Map last-write-wins) before aggregating. Exported function and added 4 new tests.
- Patched `brace-expansion` ReDoS vulnerability (GHSA-f886-m6hf-6m8v) via `npm audit fix`.
- Merged PR #78 (`fix/parse-cost-log-session-dedup` → develop), closed stale PR #76, reconciled develop/main divergence (dependabot commits on main), merged PR #77 (develop → main).

### Test Results
- 175 tests pass (was 138 — 37 new tests added in prior sessions plus 4 this session).

### Errors or Blockers
- None.

---

## Session 9 — 2026-03-18

### What Was Done
- Created `plan_visualizer.md` at repo root — standalone format reference for all 5 source files (RELEASE_PLAN.md, TEST_CASES.md, BUGS.md, AI_COST_LOG.md, progress.md) with exact parser-derived format specs, ID_REGISTRY format, and config reference
- Updated `scripts/install.sh`: removed interactive AGENTS.md overwrite/prompt block; replaced with step 2.5 (copy plan_visualizer.md) + step 2.6 (append mandatory reference to AGENTS.md — idempotent, non-destructive, creates minimal AGENTS.md if none exists)
- Updated `README.md`: simplified prerequisites, updated Claude Code install prompt, rewrote Manual Setup step 1, expanded Updating section to clarify what is/isn't overwritten on re-install
- Updated documentation files: PROMPT_LOG.md, progress.md, MIGRATION_LOG.md, LESSONS.md

### Test Results
- 138 tests pass. Coverage unchanged. No code logic was modified.

### Errors or Blockers
- None.

---

## Session 8 — 2026-03-16

### What Was Done
- Fixed BUG-0020: mobile sticky header too large — added `@media (max-width: 767px)` block with compact padding, smaller fonts, and scrollable stat tiles (branch `claude/fix-mobile-top-area-C7evU`)
- Fixed BUG-0021: traceability legend not collapsible on mobile — added toggle button and DOMContentLoaded collapse for `window.innerWidth < 768`
- Fixed BUG-0022: activity panel uncloseable on mobile — added `×` close button with `md:hidden` inside panel header
- Fixed BUG-0023: AI Cost column showing $0 — key mismatch (`aiCostUsd` vs `costUsd`) in `generate-plan.js`; renamed to `costUsd`
- Fixed BUG-0024: Cost Breakdown chart AI bars invisible — added dual y-axes (`yProjected` left, `yAI` right) with `yAxisID` per dataset
- Fixed BUG-0025: traceability legend beside table on mobile — added `flex-direction:column` + `order:-1` to legend panel in mobile CSS
- Logged BUG-0020 through BUG-0025 in BUGS.md with status Fixed
- Backfilled AI_COST_LOG.md with 8 estimated sessions (sess_0018–sess_0025) for branches that had no cost data; all 22 stories now show non-zero AI cost (total $13.92)
- Applied all plan improvements on branch `claude/improvements-C7evU`:
  - `usd()` fix: 2 dp for values < $1,000
  - Coverage tiles: merged Lines Cov + Branch Cov into single Coverage tile (overall % + Branches subtitle)
  - Story count: removed separate Stories and % tiles; progress bar label shows "X/Y · Z% · N active"
  - Mobile Tokens column: hidden via `.tokens-col` + `display:none !important` in mobile CSS
  - URL hash deep-linking: `history.replaceState` in `showTab()`; `window.location.hash` read on DOMContentLoaded
  - Filter + tab persistence: `applyFilters()` writes to localStorage; `clearFilters()` removes keys; DOMContentLoaded restores state
  - `npm run generate` script added to `package.json`
  - Config key validation: unknown top-level keys in `plan-visualizer.config.json` trigger `console.warn`
  - Lazy chart initialisation: `initCharts` guard prevents re-init on repeated tab switches
  - aria-labels on Close, Collapse, Expand activity panel buttons
- Added EPIC-0006 (Dashboard UX & Quality Improvements) with US-0023–US-0027, AC-0057–AC-0072, TASK-0021–TASK-0025
- Added TC-0058–TC-0073 (one per AC) to TEST_CASES.md; all marked Pass
- Backfilled AI_COST_LOG.md with 5 sessions (sess_0026–sess_0030) for the two feature branches
- Updated ID_REGISTRY.md: EPIC-0007 / US-0028 / TASK-0026 / AC-0073 / TC-0074 / BUG-0026 next
- Both branches pushed; PRs ready for review into develop

### Test Results
- 138 tests pass. Coverage: 97.46% statements, 84.28% branches, 96.73% functions, 99.61% lines. All thresholds met.

### Errors or Blockers
- Git stash conflict when switching branches mid-session: `render-html.js` had a merge conflict. Resolved by resetting to `origin/develop` and re-applying all changes manually.
- Gitea REST API not available at `/api/v1/` — PRs must be created manually on GitHub.

### What's Next
- Merge `claude/fix-mobile-top-area-C7evU` → develop → main
- Merge `claude/improvements-C7evU` → develop → main
- EPIC-0006 will be Done once both branches are merged

---

## Session 7 — 2026-03-11

### What Was Done
- Completed Task 1: Marked EPIC-0004 Done in RELEASE_PLAN.md — US-0014–US-0018, TASK-0001–TASK-0010 all marked Done with all ACs [x]. PR #24 merged.
- Completed Task 2: Wrote TC-0024 through TC-0057 (34 new TCs) to close AC-0052. All 56 ACs now covered. Updated TC-0021/0022/0023 to Pass. Marked US-0021 Done, EPIC-0005 Done. Updated ID_REGISTRY (TC next=TC-0058). PR #25 merged.
- Synced develop with main (fast-forward: picked up Session 6 + Session 7 release commits and dependabot bump from main).
- Updated session close docs (progress.md, PROMPT_LOG.md, MEMORY.md).

### Test Results
- 138 tests pass. Coverage: 97.46% statements, 84.28% branches, 96.73% functions, 99.61% lines. All thresholds met.

### Errors or Blockers
- None

### What's Next
- All 5 EPICs Done. All 22 stories Done. All 57 TCs cover all 56 ACs. No open bugs. Release plan complete.
- Future work: new feature EPICs, installer improvements, or version bump to v1.1.

---

## Session 6 — 2026-03-10

### What Was Done
- Implemented Branch 3 (`bugfix/BUG-0006-0009-0010-render-html`): removed hardcoded TSHIRT_HOURS (7 sites), implemented f-type filter in applyFilters() + added bug-row class, switched coverage N/A heuristic to `cov.available !== false`. 3 new tests. PR #18 merged.
- Implemented Branch 4 (`bugfix/BUG-0008-0014-0015-0016-misc`): lowercased DEFAULTS paths (6 occurrences), added console.warn on config parse error, wrapped main() in try/catch, implemented openCriticalBug rule in detectAtRisk(). 3 new tests. PR #19 merged.
- Updated BUGS.md: marked BUG-0005 through BUG-0016 as Fixed with correct Fix Branch references.
- Added `available: false` to coverage inline fallback in generate-plan.js for correct BUG-0010 behaviour when coverage file is absent.

### Test Results
- 138 tests pass (135 + 3 new openCriticalBug). Coverage: 97.46% statements, 84.28% branches, 96.73% functions, 99.61% lines. All thresholds met.

### Errors or Blockers
- None

### What's Next (continued in same session)
- All 17 logged bugs are now Fixed. No open defects.
- PR #22 opened: `docs/update-readme-and-architecture` — README, DESIGN.md, ARCHITECTURE.md updated for Session 6 changes (paths, at-risk signals, test count, GitHub Pages section). Ready to merge.
- Consider merging develop → main once PR #22 is merged.

---

## Session 5 — 2026-03-10

### What Was Done
- Fixed BUG-0003: Updated TC-0001–TC-0020 status to `[x] Pass` in `docs/TEST_CASES.md`; TC-0021–TC-0023 remain `[ ] Not Run` (linked to To Do stories). Added L-0010 to `docs/LESSONS.md`.
- Fixed BUG-0004: Added `<div class="sticky top-0 z-30">` wrapper in `renderHtml()` around renderTopBar/renderFilterBar/renderTabs. Added regression test.
- Both bugs marked Fixed in `docs/BUGS.md`.
- Created PR #12 (BUG-0003) and PR #13 (BUG-0004) targeting `develop`.

### Test Results
- 125 tests pass, 9 suites. Coverage: 97.71% statements, 84.21% branches, 96.66% functions, 99.6% lines. All thresholds met.

### Errors or Blockers
- None

### What's Next
- Merge PR #12 and PR #13 into `develop` after CI passes

---

## Session 4 — 2026-03-10

### What Was Done
- Downloaded `develop` branch
- Initialized session: read AGENTS.md, MEMORY.md, progress.md

### Test Results
- Pending — no code changes this session yet

### Errors or Blockers
- None

### What's Next
- Feature development on `develop` branch per branching strategy

---

## Session 3 — 2026-03-10 (continuation)

### What Was Done
- Read AGENTS.md at user's prompt — was not being read at session start; now embedded as standard
- Disabled §1 Sequential Execution in AGENTS.md (parallel agents permitted)
- Synced `develop` branch with `main` (fast-forward — develop was ~20 commits behind)
- Enabled branch protection on `main` and `develop`: require PR, CI must pass (Lint + Test & Coverage Gate + Dependency Audit), no force push, no direct deletions
- Updated Dependabot config to group `eslint` + `@eslint/*` together (prevents version mismatch between @eslint/js@10 and eslint@9)
- Merged 4 Dependabot PRs: actions/checkout v6, actions/setup-node v6, codeql-action v4, eslint v10
- Closed failing @eslint/js-only PR (peer dep mismatch fixed by grouping)
- Logged session prompts to PROMPT_LOG.md

### Test Results
- 9 suites, 124 tests — all pass (3 added for Recent Activity panel)
- Coverage: above 80% threshold on all metrics
- ESLint: 0 errors, 1 warning (no-unused-vars in detect-at-risk.js)

### Errors or Blockers
- None

### What's Next
- All new work must go through feature/* → develop (PR) → main (PR) workflow
- US-0021 AC-0052 still In Progress: needs additional TCs to cover all ACs

---

## Session 2 — 2026-03-10

### What Was Done (continued)
- Fixed GitHub Pages deployment: removed broken commit-back step, created docs/index.html redirect, added workflow_dispatch trigger
- Fixed 404 on Pages site: corrected `outputDir: "docs"` → `"docs"` in plan-visualizer.config.json (Linux case-sensitivity — generator was writing to docs/ but workflow deployed docs/)
- Manually triggered plan-visualizer.yml; confirmed plan-status.html deployed to gh-pages branch
- Dashboard is live at https://ksyed0.github.io/PlanVisualizer/

---

### What Was Done (initial)
- Initialised git repository and connected to ksyed0/PlanVisualizer remote
- Committed AGENTS.md to repository
- Upgraded Jest 29 → 30 to eliminate `inflight` and `glob@7` deprecation warnings (all 121 tests pass)
- Designed and documented CI pipeline: ESLint lint job, Jest 80% coverage gate, npm audit, CodeQL, Dependabot
- Created implementation plan at docs/plans/2026-03-10-ci-pipeline.md
- Generated complete project documentation suite: DESIGN.md, ARCHITECTURE.md, RELEASE_PLAN.md, TEST_CASES.md, BUGS.md, AI_COST_LOG.md, ID_REGISTRY.md, LESSONS.md, ERROR_TAXONOMY.md, MEMORY.md, findings.md, progress.md, PROMPT_LOG.md, MIGRATION_LOG.md, task_plan.md
- Created plan-visualizer.config.json for this project

### Test Results
- 9 suites, 121 tests — all pass
- Coverage: 97.55% statements | 84.18% branches | 96.2% functions | 99.58% lines
- npm audit: 0 vulnerabilities

### Errors or Blockers
- None

### What's Next
- Implement CI pipeline tasks (TASK-0001 through TASK-0010): ESLint install + config, coverage gate, ci.yml consolidation, codeql.yml, dependabot.yml
- Commit all documentation files to main
- Run node tools/generate-plan.js to generate the live dashboard

---

## Session 1 — 2026-03-09

### What Was Done
- Initial project scaffolding by original author
- Implemented all 9 parser modules (tools/lib/*.js)
- Implemented render-html.js with 6-tab dashboard
- Wrote 121 unit tests across 9 test suites
- Created install.sh and plan-visualizer.config.example.json
- Set up plan-visualizer.yml workflow for GitHub Pages deployment
- Committed initial project to ksyed0/PlanVisualizer

### Test Results
- 9 suites, 121 tests — all pass
- Coverage: 97.55% statements | 84.18% branches | 96.2% functions | 99.58% lines

### Errors or Blockers
- None
