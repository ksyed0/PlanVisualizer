# BUGS.md — Bug Register

Append-only defect log. Never delete entries. Mark resolved bugs as Fixed or Closed.

---

BUG-0001: Lines Cov and Branch Cov badges show N/A
Severity: High
Related Story: US-0016
Related Task: TASK-0006
Steps to Reproduce:
  1. Push any commit to trigger plan-visualizer.yml
  2. Open the deployed plan-status.html
  3. Observe the Lines Cov and Branch Cov badges in the header
Expected: Badges show actual coverage percentages (e.g. 99.6% / 84.2%)
Actual: Both badges display "N/A" in grey text
Status: Fixed
Fix Branch: bugfix/BUG-0001-coverage-na
Lesson Encoded: Yes — see docs/LESSONS.md

BUG-0002: Test Coverage chart shows 0% on Charts tab
Severity: High
Related Story: US-0016
Related Task: TASK-0006
Steps to Reproduce:
  1. Push any commit to trigger plan-visualizer.yml
  2. Open deployed plan-status.html → Charts tab
  3. Observe Test Coverage doughnut chart
Expected: Chart shows split between covered (green) and gap (grey) based on actual coverage
Actual: Chart is entirely grey — rendered as [0, 100] due to coverage.overall === 0 fallback
Status: Fixed
Fix Branch: bugfix/BUG-0001-coverage-na
Lesson Encoded: Yes — see docs/LESSONS.md

BUG-0003: All test cases show "Not Run" in Traceability tab
Severity: Medium
Related Story: US-0021
Related Task: TASK-0019
Steps to Reproduce:
  1. Open deployed plan-status.html → Traceability tab
  2. Observe all TC cells in the matrix
Expected: TCs linked to Done stories show Pass status
Actual: All 23 TCs display amber "Not Run" — Status: [ ] Not Run in TEST_CASES.md was never updated
Status: Fixed
Fix Branch: bugfix/BUG-0003-tc-statuses
Lesson Encoded: Yes — see docs/LESSONS.md (L-0010)

BUG-0004: Header area scrolls off-screen when content is long
Severity: Medium
Related Story: US-0011
Related Task: TASK-0001
Steps to Reproduce:
  1. Open deployed plan-status.html → Hierarchy tab (which has many stories)
  2. Scroll down
Expected: Top bar, filter bar, and tab bar remain fixed at the top of the viewport
Actual: All three scroll off-screen; user loses navigation and filter access
Status: Fixed
Fix Branch: bugfix/BUG-0004-sticky-header
Lesson Encoded: Yes — see docs/LESSONS.md (L-0009)

BUG-0005: XSS via unescaped user data interpolated into generated HTML
Severity: Critical
Related Story: US-0009
Related Task: TASK-0001
Steps to Reproduce:
  1. Add a story title containing <script>alert(1)</script> to RELEASE_PLAN.md
  2. Run node tools/generate-plan.js
  3. Open docs/plan-status.html in a browser
Expected: User-supplied content is HTML-escaped and rendered as plain text
Actual: Raw HTML/JS from markdown files is injected verbatim into the dashboard — executable scripts run on load
Status: Fixed
Fix Branch: bugfix/BUG-0005-xss-escape-html
Lesson Encoded: No

BUG-0006: Hardcoded TSHIRT_HOURS and rate in render-html.js ignore config overrides
Severity: High
Related Story: US-0009
Related Task: TASK-0001
Steps to Reproduce:
  1. Override tshirtHours or hourlyRate in plan-visualizer.config.json
  2. Run node tools/generate-plan.js
  3. Observe projected cost values in the dashboard
Expected: Dashboard shows projected costs calculated from the configured hours and rate
Actual: Dashboard always uses hardcoded S=4, M=8, L=16, XL=32 hours at $100/hr regardless of config
Status: Fixed
Fix Branch: bugfix/BUG-0006-0009-0010-render-html
Lesson Encoded: No

BUG-0007: parseCoverage() throws TypeError when coverage JSON has unexpected shape
Severity: High
Related Story: US-0005
Related Task: TASK-0001
Steps to Reproduce:
  1. Pass null, {}, or { total: {} } to parseCoverage()
  2. Observe the error
Expected: Returns zero-coverage fallback object without throwing
Actual: Throws TypeError: Cannot read properties of undefined — crashes the generator
Status: Fixed
Fix Branch: bugfix/BUG-0007-0011-parser-fixes
Lesson Encoded: No

BUG-0008: DEFAULTS object in generate-plan.js uses uppercase 'docs' paths — breaks on Linux
Severity: High
Related Story: US-0013
Related Task: TASK-0001
Steps to Reproduce:
  1. Remove or rename plan-visualizer.config.json so the tool falls back to DEFAULTS
  2. Run node tools/generate-plan.js on a Linux filesystem
Expected: Generator reads from docs/ (lowercase) matching the actual directory structure
Actual: Generator attempts to read from docs/ (uppercase) — silently produces empty data on Linux
Status: Fixed
Fix Branch: bugfix/BUG-0008-0014-0015-0016-misc
Lesson Encoded: No

BUG-0009: f-type filter control (Stories + Bugs / Stories only / Bugs only) has no effect
Severity: Medium
Related Story: US-0010
Related Task: TASK-0001
Steps to Reproduce:
  1. Open docs/plan-status.html in a browser
  2. Change the type filter dropdown to "Stories only" or "Bugs only"
  3. Observe the dashboard content
Expected: Content is filtered to show only the selected type
Actual: Filter selection is ignored — applyFilters() never reads the f-type value; all content remains visible
Status: Fixed
Fix Branch: bugfix/BUG-0006-0009-0010-render-html
Lesson Encoded: No

BUG-0010: Coverage N/A heuristic misidentifies genuine 0% coverage as N/A
Severity: Medium
Related Story: US-0009
Related Task: TASK-0001
Steps to Reproduce:
  1. Produce a coverage-summary.json where actual coverage is 0% (e.g. delete all test files)
  2. Run node tools/generate-plan.js
  3. Observe the Lines Cov and Branch Cov badges
Expected: Badges show 0.0% (correct measured value)
Actual: Badges show N/A — the > 0 guard cannot distinguish "no coverage file" from "0% coverage measured"
Status: Fixed
Fix Branch: bugfix/BUG-0006-0009-0010-render-html
Lesson Encoded: No

BUG-0011: parse-progress.js returns sessions in file order — reverse-chronological order not enforced
Severity: Medium
Related Story: US-0006
Related Task: TASK-0001
Steps to Reproduce:
  1. Append a new session entry at the bottom of progress.md (ascending order)
  2. Call parseProgress() with the content
  3. Inspect result[0].date
Expected: Most recent session is always first regardless of file order (AC-0013 requires reverse-chronological)
Actual: Sessions are returned in the order they appear in the file — if appended at bottom, oldest appears first
Status: Fixed (false positive — progress.md is written newest-first; regression test added)
Fix Branch: bugfix/BUG-0007-0011-parser-fixes
Lesson Encoded: No

BUG-0012: GitHub Actions workflow steps pinned to mutable version tags, not commit digests
Severity: High
Related Story: US-0016
Related Task: TASK-0009
Steps to Reproduce:
  1. Review .github/workflows/ci.yml, codeql.yml, plan-visualizer.yml
  2. Observe actions/checkout@v6, actions/setup-node@v6, etc.
Expected: All actions pinned to immutable full commit SHAs (e.g. actions/checkout@11bd71901bbe5b1630ceea73d27597364c9af683)
Actual: Actions use mutable semver tags — a force-push to @v6 by the upstream maintainer would silently change CI behaviour
Status: Fixed
Fix Branch: bugfix/BUG-0012-0013-0017-ci-config-fixes
Lesson Encoded: No

BUG-0013: package.json devDependencies use ^ floating ranges in violation of AGENTS.md §19
Severity: Low
Related Story: US-0016
Related Task: TASK-0008
Steps to Reproduce:
  1. Open package.json and inspect devDependencies
  2. Note: jest: "^30.3.0", eslint: "^10.0.3", @eslint/js: "^9.39.4"
Expected: All dependency versions are pinned exactly (no ^ or ~ ranges)
Actual: ^ ranges allow automatic minor/patch upgrades on npm install in fresh environments
Status: Fixed
Fix Branch: bugfix/BUG-0012-0013-0017-ci-config-fixes
Lesson Encoded: No

BUG-0014: detectAtRisk() accepts an unused `bugs` parameter — misleading API contract
Severity: Low
Related Story: US-0008
Related Task: TASK-0001
Steps to Reproduce:
  1. Read tools/lib/detect-at-risk.js signature: detectAtRisk(stories, testCases, bugs)
  2. Search for any usage of the bugs parameter inside the function body
Expected: bugs parameter is used to flag stories with open Critical/High bugs as at-risk
Actual: bugs is declared but never read — function silently ignores bug data; ESLint reports no-unused-vars
Status: Fixed
Fix Branch: bugfix/BUG-0008-0014-0015-0016-misc
Lesson Encoded: No

BUG-0015: generate-plan.js silently swallows config parse errors with no user-facing diagnostic
Severity: Low
Related Story: US-0013
Related Task: TASK-0001
Steps to Reproduce:
  1. Create a malformed plan-visualizer.config.json (invalid JSON)
  2. Run node tools/generate-plan.js
Expected: Tool prints a warning that the config file failed to parse and is using defaults
Actual: JSON.parse error is caught silently — tool falls back to DEFAULTS with no message; user is unaware
Status: Fixed
Fix Branch: bugfix/BUG-0008-0014-0015-0016-misc
Lesson Encoded: No

BUG-0016: generate-plan.js main() has no top-level error handler — unhandled throws expose raw stack traces
Severity: Low
Related Story: US-0009
Related Task: TASK-0001
Steps to Reproduce:
  1. Introduce any uncaught error in a parser (e.g. pass malformed JSON to parseCoverage before BUG-0007 fix)
  2. Run node tools/generate-plan.js
Expected: Human-readable error message per AGENTS.md §13; no raw stack trace exposed to user
Actual: Node.js prints an unformatted stack trace and exits with code 1 — violates §13 error handling standard
Status: Fixed
Fix Branch: bugfix/BUG-0008-0014-0015-0016-misc
Lesson Encoded: No

BUG-0017: peaceiris/actions-gh-pages@v4 uses deprecated Node.js 20 runtime
Severity: Medium
Related Story: US-0019
Related Task: TASK-0016
Steps to Reproduce:
  1. Push a commit to trigger plan-visualizer.yml
  2. Observe the GitHub Actions run logs
Expected: generate-and-deploy job completes without deprecation warnings
Actual: CI logs warn "peaceiris/actions-gh-pages@v4 is running on Node.js 20 and may not work as expected" — Node.js 20 will be forced off by June 2026
Status: Fixed
Fix Branch: bugfix/BUG-0012-0013-0017-ci-config-fixes
Lesson Encoded: No

BUG-0018: plan-visualizer.yml deploy fails on develop — github-pages environment does not allow develop branch
Severity: High
Related Story: US-0019
Related Task: TASK-0016
Steps to Reproduce:
  1. Push any commit to develop that matches the workflow path filter
  2. Observe the plan-visualizer.yml CI run
Expected: Dashboard deploys successfully from both main and develop
Actual: GitHub rejects the deploy-pages step: "Branch develop is not allowed to deploy to github-pages due to environment protection rules"
Status: Fixed
Fix Branch: n/a — fixed via repo Settings → Environments → github-pages → add develop to allowed branches
Lesson Encoded: No

BUG-0019: actions/deploy-pages and actions/upload-artifact running on deprecated Node.js 20 runtime
Severity: Medium
Related Story: US-0019
Related Task: TASK-0016
Steps to Reproduce:
  1. Trigger plan-visualizer.yml
  2. Observe CI logs in the generate-and-deploy job
Expected: No Node.js deprecation warnings in CI logs
Actual: "actions/deploy-pages and actions/upload-artifact@v4 are running on Node.js 20 and may not work as expected; will be forced off by June 2026"
Status: Fixed
Fix Branch: bugfix/BUG-0019-node24-actions
Lesson Encoded: No

BUG-0020: Mobile top non-scrollable area too large on iPhone Pro Max
Severity: Medium
Related Story: US-0001
Related Task: n/a
Steps to Reproduce:
  1. Open plan-status.html on iPhone Pro Max (or any viewport ≤ 767px)
  2. Observe the sticky header area (top bar + filter bar + tab bar)
Expected: Header fits within the top ⅓ of the screen, leaving scrollable content visible below
Actual: Header occupies more than ⅓ of the screen height due to large fonts, padding, and stat tiles
Status: Fixed
Fix Branch: claude/fix-mobile-top-area-C7evU
Lesson Encoded: No

BUG-0021: Traceability legend not collapsible on mobile, takes valuable screen space
Severity: Low
Related Story: US-0021
Related Task: n/a
Steps to Reproduce:
  1. Open plan-status.html on a mobile device (viewport ≤ 767px)
  2. Navigate to the Traceability tab
  3. Observe the legend panel on the right
Expected: Legend is collapsed by default on mobile with a toggle button to expand
Actual: Legend is always expanded, pushing the table content left and wasting screen space
Status: Fixed
Fix Branch: claude/fix-mobile-top-area-C7evU
Lesson Encoded: No

BUG-0022: Activity panel cannot be closed on mobile after opening
Severity: Medium
Related Story: n/a
Related Task: n/a
Steps to Reproduce:
  1. Open plan-status.html on a mobile viewport (≤ 767px)
  2. Tap the "≡ Activity" toggle button (fixed top-4 right-4, z-50)
  3. Try tapping the button again to close the panel
Expected: Tapping the toggle button again closes the activity panel
Actual: The panel (z-index:50, fixed top-0 right-0 width:280px) covers the toggle button at the same z-level once opened; the button is unreachable so the panel cannot be dismissed
Status: Fixed
Fix Branch: claude/fix-mobile-top-area-C7evU
Lesson Encoded: No

BUG-0023: AI Cost column shows $0 for all individual stories on Costs tab
Severity: High
Related Story: US-0007
Related Task: n/a
Steps to Reproduce:
  1. Open plan-status.html → Costs tab
  2. Observe the AI Cost column for any individual story row
Expected: Each story row shows the AI spend attributed to its branch
Actual: Every story shows $0; only the Totals footer row is correct
Root Cause: generate-plan.js stored the field as `aiCostUsd` but render-html.js read `costUsd` — the key mismatch caused undefined → 0 for every story. The totals row was unaffected because it reads directly from costs._totals.costUsd
Status: Fixed
Fix Branch: claude/fix-mobile-top-area-C7evU
Lesson Encoded: No

BUG-0024: Cost Breakdown chart AI Cost bars appear as zero/invisible
Severity: Medium
Related Story: US-0007
Related Task: n/a
Steps to Reproduce:
  1. Open plan-status.html → Charts tab → Cost Breakdown chart
  2. Observe the AI Cost (teal) bars
Expected: AI Cost bars are visibly proportional to the AI spend per epic
Actual: AI Cost bars are sub-pixel tall and invisible — projected costs ($1,600–$4,000/epic) and AI costs ($1–$7/epic) differ by ~3 orders of magnitude; sharing one y-axis makes the AI bars render with no visible height
Status: Fixed
Fix Branch: claude/fix-mobile-top-area-C7evU
Lesson Encoded: No

BUG-0025: Traceability legend renders beside table on mobile instead of above it
Severity: Low
Related Story: US-0021
Related Task: n/a
Steps to Reproduce:
  1. Open plan-status.html on a mobile viewport (≤ 767px) → Traceability tab
  2. Observe the layout of the legend panel relative to the matrix table
Expected: Legend panel appears above the scrollable table on mobile
Actual: Legend panel renders to the right of the table (flex-row layout), compressing the table and making both hard to read on a narrow screen
Status: Fixed
Fix Branch: claude/fix-mobile-top-area-C7evU
Lesson Encoded: No

---

BUG-0026: plan_visualizer.md config example shows wrong default coverage path
Severity: High
Related Story: US-0029
Related Task: TASK-TBD
Steps to Reproduce:
  1. Install PlanVisualizer into a new project using install.sh
  2. Copy the config example from plan_visualizer.md verbatim into plan-visualizer.config.json
  3. Run node tools/generate-plan.js
Expected: Coverage data appears in dashboard (summaryPath: "coverage/coverage-summary.json" as shown in spec)
Actual: No coverage data rendered — generate-plan.js default is docs/coverage/coverage-summary.json; the spec example points to the wrong path
Status: Fixed
Fix Branch: feature/docs-update-readme-update-prompt
Lesson Encoded: No

---

BUG-0027: install.sh idempotency guard matches any mention of "plan_visualizer.md" in AGENTS.md
Severity: Medium
Related Story: US-0029
Related Task: TASK-TBD
Steps to Reproduce:
  1. Create an AGENTS.md that mentions "plan_visualizer.md" in prose (e.g. "do not edit plan_visualizer.md directly")
  2. Run install.sh targeting that project
Expected: PlanVisualizer reference section is appended to AGENTS.md
Actual: grep -q "plan_visualizer.md" matches the prose; script prints "already references — skipping" and never injects the required section
Status: Fixed
Fix Branch: feature/docs-update-readme-update-prompt
Lesson Encoded: No

---

BUG-0028: README Claude Code prompts instruct "npm test" instead of "npm run plan:test"
Severity: Medium
Related Story: US-0029
Related Task: TASK-TBD
Steps to Reproduce:
  1. Use the Claude Code install or update prompt from README.md in a target project that has its own npm test script
  2. Claude runs "npm test" as instructed
Expected: PlanVisualizer's namespaced plan:test suite runs, confirming correct installation
Actual: Target project's own test suite runs instead (or "Missing script: test" error) — does not confirm PlanVisualizer installed correctly
Status: Fixed
Fix Branch: feature/docs-update-readme-update-prompt
Lesson Encoded: No

---

BUG-0029: install.sh step 2.5 has no existence guard on plan_visualizer.md source file
Severity: Medium
Related Story: US-0029
Related Task: TASK-TBD
Steps to Reproduce:
  1. Clone PlanVisualizer at a commit before plan_visualizer.md was added (or use a shallow/partial checkout)
  2. Run install.sh targeting any project
Expected: Script gracefully skips or prints an actionable [install]-prefixed error message
Actual: cp fails with raw "No such file or directory"; set -euo pipefail aborts the script at step 2.5 — npm scripts, config, and stop hook steps never run
Status: Fixed
Fix Branch: feature/docs-update-readme-update-prompt
Lesson Encoded: No

---

BUG-0030: install.sh claims full idempotency but step 5 does not re-add stop hook on re-run
Severity: Low
Related Story: US-0029
Related Task: TASK-TBD
Steps to Reproduce:
  1. Run install.sh — .claude/settings.json created with Stop hook
  2. Manually remove the Stop hook from .claude/settings.json
  3. Re-run install.sh to update
Expected: Stop hook verified and restored (idempotent as stated in script header: "Idempotent — safe to re-run")
Actual: Script sees .claude/settings.json exists, prints manual advisory, exits step 5 without verifying or restoring the hook
Status: Fixed
Fix Branch: feature/docs-update-readme-update-prompt
Lesson Encoded: No

<!-- When adding a bug, use this format:

BUG-XXXX: Short description of the defect
Severity: Critical | High | Medium | Low
Related Story: US-XXXX
Related Task: TASK-XXXX
Steps to Reproduce:
  1. Step
  2. Step
Expected: What should happen
Actual: What actually happened
Status: Open | In Progress | Fixed | Verified | Closed
Fix Branch: bugfix/BUG-XXXX-short-description
Lesson Encoded: Yes — see docs/LESSONS.md | No

-->
