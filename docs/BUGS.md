# BUGS.md — Bug Register

Append-only defect log. Never delete entries. Mark resolved bugs as Fixed or Closed.

---

BUG-0100: Coverage Over Time chart showed fabricated data — linear ramp from 2% to 61% instead of realistic values
Severity: High
Related Story: US-0084
Steps to Reproduce:

1. Open plan-status.html → Trends tab → Coverage Over Time chart
2. Observe x-axis from 3/2 to 3/31
   Expected: Coverage grows realistically from near 0% to ~95% as stories and tests were completed
   Actual: Chart showed a fake linear ramp (2%, 4%, 6%… 61%) capped at 70% of current coverage, bearing no relation to actual test coverage history; real statements coverage throughout March was ~95.74%
   Root Cause: historical-sim.js used `currentCoverage * progressRatio * 0.7` — a time-based linear ramp capped at 70%, with `overall` as the source metric. `overall` was set inconsistently (sometimes branch %, sometimes lines %, sometimes the simulated value). Additionally, `parse-coverage.js` sets `overall = lines` for real snapshots, but backfilled snapshots overwrote it with the simulated value — causing divergence.
   Status: Fixed
   Fix Branch: feature/US-0084-trends-ui-polish
   Lesson Encoded: No

---

BUG-0056: capture-cost.js produces all-zero rows — session costs never captured
Severity: Medium
Related Story: US-0012 (capture-cost)
Steps to Reproduce:

1. Install PlanVisualizer and register the Stop hook in .claude/settings.json
2. Run any Claude Code session
3. Check docs/AI_COST_LOG.md — new rows appended but all token counts and cost are 0
   Expected: Each session appends a cost row with real token counts and cost
   Actual: Rows appended with 0 | 0 | 0 | 0.0000 for all numeric fields
   Root Cause (two-part):
   Part A — Hook not registered: install.sh only created .claude/settings.json when
   the file was absent. When settings.json already existed the Stop hook was silently
   skipped with a manual instruction only.
   Part B — Script reads wrong data source: capture-cost.js read cost_usd and usage
   from stdin, but the Claude Code Stop hook stdin payload only contains session
   metadata (session_id, transcript_path, cwd, gitBranch). Token usage and cost are
   NOT included in the Stop hook stdin. The script always received zeroes.
   The actual token data lives in the JSONL transcript at
   ~/.claude/projects/<project>/<session_id>.jsonl inside each assistant message's
   usage object — but cost_usd is absent there too (Anthropic does not expose
   per-message cost in transcripts); cost must be computed from token counts.
   Status: Fixed
   Fix Branch: chore/fix-version-workflows
   Fix Summary:
   Part A fixes:
4. Created .claude/settings.json with the Stop hook registered
5. Updated scripts/install.sh step 5 to merge the Stop hook into an existing
   settings.json using node (idempotent), rather than printing a manual instruction
6. Updated README.md and install prompt accordingly
   Part B fixes:
7. Rewrote capture-cost.js to resolve the transcript path (from transcript_path
   in stdin, or via glob fallback ~/.claude/projects/\*/<session_id>.jsonl)
8. Streams the JSONL and sums usage from assistant entries with output_tokens > 0
   (skips streaming partial entries)
9. Computes cost using per-type rates: input $3/MTok, cache-write $3.75/MTok,
   cache-read $0.30/MTok, output $15/MTok
10. Input Tokens column = input_tokens + cache_creation_input_tokens (both
    input-side; cost uses their distinct rates internally)
11. Cleaned up the 5 all-zero rows appended during the broken session
    Estimated Cost USD: 0.10

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
   Estimated Cost USD: 0.50

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
   Estimated Cost USD: 0.50

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
   Estimated Cost USD: 0.25

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
   Estimated Cost USD: 0.25

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
   Estimated Cost USD: 0.50

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
   Estimated Cost USD: 0.45

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
   Estimated Cost USD: 0.45

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
   Estimated Cost USD: 0.45

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
   Estimated Cost USD: 0.25

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
   Estimated Cost USD: 0.25

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
   Estimated Cost USD: 0.25

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
   Estimated Cost USD: 0.45

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
   Estimated Cost USD: 0.20

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
   Estimated Cost USD: 0.20

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
   Estimated Cost USD: 0.20

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
   Estimated Cost USD: 0.20

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
   Estimated Cost USD: 0.25

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
   Estimated Cost USD: 0.20

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
   Estimated Cost USD: 0.25

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
   Estimated Cost USD: 0.25

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
   Estimated Cost USD: 0.20

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
   Estimated Cost USD: 0.25

BUG-0023: AI Cost column shows $0 for all individual stories on Costs tab
Severity: High
Related Story: US-0007
Related Task: n/a
Steps to Reproduce:

1. Open plan-status.html → Costs tab
2. Observe the AI Cost column for any individual story row
   Expected: Each story row shows the AI spend attributed to its branch
   Actual: Every story shows $0; only the Totals footer row is correct
   Root Cause: generate-plan.js stored the field as `aiCostUsd` but render-html.js read `costUsd` — the key mismatch caused undefined → 0 for every story. The totals row was unaffected because it reads directly from costs.\_totals.costUsd
   Status: Fixed
   Fix Branch: claude/fix-mobile-top-area-C7evU
   Lesson Encoded: No
   Estimated Cost USD: 0.45

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
   Estimated Cost USD: 0.25

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
   Estimated Cost USD: 0.20

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
   Estimated Cost USD: 0.35

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
   Estimated Cost USD: 0.25

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
   Estimated Cost USD: 0.20

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
   Estimated Cost USD: 0.25

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
   Estimated Cost USD: 0.20

BUG-0031: attributeBugCosts() omits sessions field — inconsistent with attributeAICosts() contract
Severity: Low
Related Story: US-0030
Related Task: TASK-0027
Steps to Reproduce:

1. Log AI costs on a bugfix branch in docs/AI_COST_LOG.md
2. Call attributeBugCosts() and inspect the returned object for a matched bug
   Expected: Return object includes sessions field (matching attributeAICosts() shape: { costUsd, inputTokens, outputTokens, sessions })
   Actual: Return object omits sessions field; shape is { costUsd, inputTokens, outputTokens } only — inconsistent with attributeAICosts() and the zero-cost fallback also lacks sessions: 0
   Status: Fixed
   Fix Branch: feature/US-0030-bug-fix-costs-tab
   Lesson Encoded: No
   Estimated Cost USD: 0.20

---

BUG-0032: attributeBugCosts() returns no \_totals key — asymmetric with attributeAICosts() which returns result.\_totals
Severity: Low
Related Story: US-0030
Related Task: TASK-0027
Steps to Reproduce:

1. Call attributeBugCosts(bugs, costByBranch) with any non-empty bugs array
2. Access result.\_totals
   Expected: result.\_totals exists with { costUsd, inputTokens, outputTokens } summed across all matched bug branches
   Actual: result.\_totals is undefined — function only returns per-bug keyed entries
   Status: Fixed
   Fix Branch: feature/US-0030-bug-fix-costs-tab
   Lesson Encoded: No
   Estimated Cost USD: 0.20

---

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

BUG-0033: BUG/US IDs wrap mid-string in Bugs and Costs tabs
Severity: Low
Related Story: US-0031
Related Task: n/a
Steps to Reproduce:

1. Open plan-status.html → Bugs tab
2. Observe BUG-0001 ID cell in a narrow browser window or on mobile
   Expected: BUG/US IDs display on a single line without mid-string line breaks
   Actual: Font-mono IDs like "BUG-0001" and "US-0001" wrap between characters — e.g. "BUG-\n0001" — due to missing whitespace-nowrap constraint on the TD element
   Status: Fixed
   Fix Branch: feature/US-0031-dashboard-ux-fixes
   Lesson Encoded: No

BUG-0034: TC-0078 shows Not Run despite version-bump workflow being verified
Severity: Low
Related Story: US-0028
Related Task: TASK-0026
Steps to Reproduce:

1. Open plan-status.html → Traceability tab
2. Locate TC-0078
   Expected: TC-0078 shows Pass — the version-bump workflow was verified via PRs #52 and #54
   Actual: TC-0078 displays "Not Run" because TEST_CASES.md status was never updated to [x] Pass
   Status: Fixed
   Fix Branch: feature/dark-mode-readability
   Lesson Encoded: No
   Estimated Cost USD: 0.00

BUG-0035: About modal hardcoded dark — does not respond to light/dark toggle
Severity: Medium
Related Story: US-0031
Related Task: TASK-0030
Steps to Reproduce:

1. Open plan-status.html in light mode
2. Click the "About" button in the header
   Expected: About modal adapts to light mode (white card, dark text)
   Actual: Modal always shows dark slate background and light text regardless of theme
   Status: Fixed
   Fix Branch: feature/dark-mode-readability
   Lesson Encoded: Yes — see docs/LESSONS.md
   Estimated Cost USD: 0.00

BUG-0036: AI Cost column uses text-teal-600, unreadable on white backgrounds
Severity: Medium
Related Story: US-0031
Related Task: TASK-0030
Steps to Reproduce:

1. Open plan-status.html in light mode
2. Navigate to Costs tab
3. Observe AI Cost column
   Expected: AI Cost values are clearly readable in both light and dark modes
   Actual: text-teal-600 (#0d9488) has insufficient contrast on white — WCAG AA fails
   Status: Fixed
   Fix Branch: feature/dark-mode-readability
   Lesson Encoded: Yes — see docs/LESSONS.md
   Estimated Cost USD: 0.00

BUG-0037: Bug token counts display 0/0 for estimated-cost bugs
Severity: Low
Related Story: US-0031
Related Task: TASK-0030
Steps to Reproduce:

1. Open plan-status.html → Costs tab → Bug Fix Costs section
2. Observe Tokens column for bugs with estimated costs
   Expected: Dash (—) for bugs whose token counts are unknown; real counts for bugs with cost log entries
   Actual: 0 / 0 displayed for all estimated-cost bugs — misleading, implies tokens were measured
   Status: Fixed
   Fix Branch: feature/dark-mode-readability
   Lesson Encoded: Yes — see docs/LESSONS.md
   Estimated Cost USD: 0.00

BUG-0038: Lesson column always shows ○ due to lessonEncoded partial-string mismatch
Severity: Low
Related Story: US-0031
Related Task: TASK-0030
Steps to Reproduce:

1. Open plan-status.html → Bugs tab
2. Observe Lesson column for any bug with Lesson Encoded: Yes — see docs/LESSONS.md
   Expected: ✓ shown for bugs with encoded lessons
   Actual: ○ always shown because renderer checks lessonEncoded === 'Yes' but parser returns full string "Yes — see docs/LESSONS.md"
   Status: Fixed
   Fix Branch: feature/dark-mode-readability
   Lesson Encoded: Yes — see docs/LESSONS.md
   Estimated Cost USD: 0.00

BUG-0039: Bugs tab Story column wraps on narrow viewports
Severity: Low
Related Story: US-0031
Related Task: n/a
Steps to Reproduce:

1. Open plan-status.html → Bugs tab
2. Narrow the browser window or view on mobile
   Expected: Story ID (e.g. US-0031) stays on one line in the Story column
   Actual: Story cell wraps mid-string due to missing whitespace-nowrap on the td element
   Status: Fixed
   Fix Branch: feature/dark-mode-readability
   Lesson Encoded: No
   Estimated Cost USD: 0.00

BUG-0040: Dark mode toggle changes About modal but not the rest of the page
Severity: High
Related Story: US-0031
Related Task: TASK-0030
Steps to Reproduce:

1. Open plan-status.html
2. Click the sun/moon toggle in the header
   Expected: Entire page switches between light and dark themes
   Actual: Only the About modal responds; rest of page unchanged — tailwind.config={darkMode:'class'} was set before the CDN loaded so tailwind was undefined, config never applied, CDN defaulted to prefers-color-scheme strategy
   Status: Fixed
   Fix Branch: feature/dark-mode-readability
   Lesson Encoded: Yes — see docs/LESSONS.md
   Estimated Cost USD: 0.00

BUG-0041: New bugs BUG-0034–0038 show $0.00 AI cost and 0/0 tokens in Costs tab
Severity: Low
Related Story: US-0031
Related Task: n/a
Steps to Reproduce:

1. Open plan-status.html → Costs tab → Bug Fix Costs section
2. Observe AI Cost and Tokens columns for BUG-0034 through BUG-0038
   Expected: AI cost and token columns show values from the feature/dark-mode-readability branch sessions
   Actual: $0.00 / 0/0 because no cost log entries existed for the fix branch and Estimated Cost USD was 0.00 so isEstimated stayed false (no — dash shown either)
   Status: Fixed
   Fix Branch: feature/dark-mode-readability
   Lesson Encoded: Yes — see docs/LESSONS.md
   Estimated Cost USD: 0.00

BUG-0042: dark:\* Tailwind variants not applied — dark mode toggle has no effect on page text/backgrounds
Severity: High
Related Story: US-0031
Related Task: TASK-0030
Steps to Reproduce:

1. Open plan-status.html; dark mode activates (via localStorage or prefers-color-scheme)
2. Observe Hierarchy tab story text — black text on dark background, unreadable
   Expected: All dark:text-_ and dark:bg-_ classes apply when html.dark is present
   Actual: Tailwind CDN generates styles using prefers-color-scheme strategy instead of class strategy because tailwind.config={darkMode:'class'} is set AFTER CDN loads; during initial CSS generation darkMode:'class' is unknown so dark: variants are never emitted
   Status: Fixed
   Fix Branch: feature/dark-mode-readability
   Lesson Encoded: Yes — see docs/LESSONS.md
   Estimated Cost USD: 0.00

BUG-0043: Header does not change when toggling dark/light mode
Severity: Medium
Related Story: US-0031
Related Task: TASK-0030
Steps to Reproduce:

1. Open plan-status.html in light mode
2. Click the sun/moon toggle
   Expected: Header gradient shifts to a darker blue variant in dark mode
   Actual: Header always shows the same EPAM blue gradient — inline style= cannot use dark: Tailwind variants, and no CSS rule overrides it in .dark context
   Status: Fixed
   Fix Branch: feature/dark-mode-readability
   Lesson Encoded: Yes — see docs/LESSONS.md
   Estimated Cost USD: 0.00

BUG-0044: Stories with status 'Done' incorrectly flagged as At Risk
Severity: Medium
Related Story: US-0032
Related Task: n/a
Steps to Reproduce:

1. Open plan-status.html → Hierarchy tab
2. Observe any story with Status: Done that has no linked test cases (e.g. US-0029, US-0031, US-0032)
   Expected: Done stories do not show ⚠ At Risk badge
   Actual: Done stories showed ⚠ At Risk badge because detectAtRisk() evaluated missingTCs/noBranch signals without excluding Done status
   Status: Fixed
   Fix Branch: feature/US-0032-lessons-tab
   Lesson Encoded: No
   Estimated Cost USD: 0.00

BUG-0045: Bug Fix Costs table on Costs tab missing totals row
Severity: Low
Related Story: US-0030
Related Task: TASK-0028
Steps to Reproduce:

1. Open plan-status.html → Costs tab
2. Scroll to Bug Fix Costs section
3. Observe the bottom of the table
   Expected: A totals row shows the sum of AI Cost and Token columns across all bug entries
   Actual: Table ends after the last bug row; no totals row rendered
   Status: Fixed
   Fix Branch: feature/US-0032-lessons-tab
   Lesson Encoded: No
   Estimated Cost USD: 0.00

BUG-0046: Bugs, Traceability, Lessons, and Kanban tabs do not fill viewport height
Severity: Low
Related Story: US-0032
Related Task: n/a
Steps to Reproduce:

1. Open plan-status.html → Bugs tab (or Traceability, Lessons, Kanban)
2. View when fewer rows exist than the visible area
   Expected: Tab container fills available viewport height; scroll region occupies remaining space
   Actual: Container collapses to content height — blank area below short lists
   Status: Fixed
   Fix Branch: feature/US-0032-lessons-tab
   Lesson Encoded: No
   Estimated Cost USD: 0.00

BUG-0047: Kanban column headers scroll off screen when column content overflows
Severity: Medium
Related Story: US-0032
Related Task: n/a
Steps to Reproduce:

1. Open plan-status.html → Kanban tab
2. Ensure at least one column has more cards than the visible area
3. Scroll down within the Kanban view
   Expected: Column header (e.g. "In Progress") remains pinned at the top of its column
   Actual: The whole Kanban board scrolled as one unit; column headers disappeared off screen
   Status: Fixed
   Fix Branch: feature/US-0032-lessons-tab
   Lesson Encoded: No
   Estimated Cost USD: 0.00

BUG-0048: Charts tab shows inconsistent heights between doughnut and bar/line charts
Severity: Low
Related Story: US-0031
Related Task: TASK-0030
Steps to Reproduce:

1. Open plan-status.html → Charts tab
2. Compare Test Coverage doughnut (top-left) with AI Cost Timeline line chart (top-right)
3. Compare Story Status doughnut (bottom-left) with Budget Burn Rate bar chart (bottom-right)
   Expected: All six charts render at the same height (300 px)
   Actual: Doughnut charts rendered shorter than bar/line charts because Chart.js defaulted to 1:1 aspect ratio for doughnuts and 2:1 for bar/line charts
   Status: Fixed
   Fix Branch: feature/US-0032-lessons-tab
   Lesson Encoded: No
   Estimated Cost USD: 0.00

BUG-0049: Filter bar displayed on tabs where no filters apply
Severity: Low
Related Story: US-0025
Related Task: TASK-0025
Steps to Reproduce:

1. Open plan-status.html
2. Click Charts tab, then Costs tab, then Traceability tab, then Lessons tab
3. Observe the filter bar below the tab strip on each tab
   Expected: Filter bar hidden on tabs where filters have no applicable rows
   Actual: Filter bar remained visible with story-type dropdowns on tabs where they had no effect
   Status: Fixed
   Fix Branch: feature/US-0032-lessons-tab
   Lesson Encoded: No
   Estimated Cost USD: 0.00

BUG-0050: Hierarchy tab filter included 'Stories + Bugs' type option — bugs do not appear on this tab
Severity: Low
Related Story: US-0025
Related Task: TASK-0025
Steps to Reproduce:

1. Open plan-status.html → Hierarchy tab
2. Expand the Type dropdown in the filter bar
3. Select 'Bugs only' or 'Stories + Bugs'
   Expected: Type dropdown should not include bug options on the Hierarchy tab since bugs are not rendered there
   Actual: Type dropdown showed 'Bugs only' and 'Stories + Bugs' options that returned zero results
   Status: Fixed
   Fix Branch: feature/US-0032-lessons-tab
   Lesson Encoded: No
   Estimated Cost USD: 0.00

BUG-0051: Lesson column link text wraps mid-string in the Bugs tab
Severity: Low
Related Story: US-0032
Related Task: TASK-0033
Steps to Reproduce:

1. Open plan-status.html → Bugs tab
2. Find a bug whose Lesson Encoded references a lesson ID (e.g. L-0010)
3. Observe the Lesson column cell at normal viewport width
   Expected: '✓ L-XXXX ↗' renders on a single line
   Actual: Text wrapped mid-string (e.g. '✓ L-0010' on line one and '↗' on line two)
   Status: Fixed
   Fix Branch: feature/US-0032-lessons-tab
   Lesson Encoded: No
   Estimated Cost USD: 0.00

BUG-0052: Lesson ID (L-XXXX) wraps onto a second line in the Lessons card view
Severity: Low
Related Story: US-0032
Related Task: TASK-0033
Steps to Reproduce:

1. Open plan-status.html → Lessons tab
2. Switch to Card view
3. Observe the top-left corner of any lesson card at a medium viewport width
   Expected: 'L-XXXX' ID token stays on a single line at all viewport widths
   Actual: ID text wrapped mid-value at certain card widths
   Status: Fixed
   Fix Branch: feature/US-0032-lessons-tab
   Lesson Encoded: No
   Estimated Cost USD: 0.00

BUG-0053: AI Actual header stat tile excluded bug fix costs
Severity: Medium
Related Story: US-0025
Related Task: TASK-0023
Steps to Reproduce:

1. Open plan-status.html
2. Observe the AI Actual stat tile in the top bar
3. Open Costs tab and note Bug Fix Costs table total
   Expected: AI Actual tile reflects total AI spend including bug fix sessions
   Actual: Tile showed only story branch costs from cost log; bug estimated costs and bug branch AI costs were excluded
   Status: Fixed
   Fix Branch: feature/US-0032-lessons-tab
   Lesson Encoded: No
   Estimated Cost USD: 0.25

BUG-0054: Bug Fix Costs Projected column used raw manual dollar amounts instead of t-shirt formula
Severity: Medium
Related Story: US-0025
Related Task: TASK-0023
Steps to Reproduce:

1. Open plan-status.html → Costs tab → Bug Fix Costs table
2. Observe the Projected column values (labelled 'Estimated' at the time)
   Expected: Projected column uses severity→t-shirt size×hourly rate (same formula as story Projected)
   Actual: Column showed raw Estimated Cost USD field values (e.g. $0.50) making values inconsistent with story projected costs ($800+)
   Status: Fixed
   Fix Branch: feature/US-0032-lessons-tab
   Lesson Encoded: No
   Estimated Cost USD: 0.25

BUG-0055: Header Projected tile excluded bug projected costs
Severity: Medium
Related Story: US-0025
Related Task: TASK-0023
Steps to Reproduce:

1. Open plan-status.html
2. Observe the Projected stat tile in the top bar
3. Open Costs tab and note story projected total and bug projected total
   Expected: Projected tile = sum of story projected costs + sum of bug projected costs
   Actual: Tile showed only story projected costs; bug projected costs omitted
   Status: Fixed
   Fix Branch: feature/US-0032-lessons-tab
   Lesson Encoded: No
   Estimated Cost USD: 0.25

BUG-0075: sessionTimeline in generate-plan.js built from raw cost rows — duplicates inflate cumulative cost chart
Severity: High
Related Story: US-0012
Related Task: TASK-0009
Steps to Reproduce:

1. Run a Claude Code session that appends multiple cumulative rows for same session_id to AI_COST_LOG.md
2. Generate plan-status.html → Charts tab → cumulative cost timeline
   Expected: Timeline reflects deduplicated session totals — same final figure as the Costs tab
   Actual: generate-plan.js:132 builds sessionTimeline from raw costRows (not deduplicateSessions); the same session's cost is summed multiple times, inflating the cumulative spend curve
   Status: Fixed
   Fix Branch: fix/parse-cost-log-session-dedup
   Lesson Encoded: No
   Estimated Cost USD: 0.10

BUG-0076: parse-coverage.js guard misses missing .pct sub-field — returns available:true with NaN metrics
Severity: High
Related Story: US-0005
Related Task: TASK-0004
Steps to Reproduce:

1. Create coverage-summary.json with a top-level key but no .pct field (e.g. "lines": {})
2. Generate plan-status.html
   Expected: available: false when .pct cannot be read; renderer shows N/A
   Actual: Guard at parse-coverage.js:8 checks key presence not .pct presence; available:true returned with overall:NaN; renderer displays NaN% to user
   Status: Fixed
   Fix Branch: feature/US-0048-ui-redesign-sidebar
   Lesson Encoded: No
   Estimated Cost USD: 0.02

---

BUG-0094: XSS via inline onclick handlers — esc() only escapes HTML, not JavaScript
Severity: High
Related Story: US-0009
Steps to Reproduce:

1. Add a story with ID containing a single quote (e.g., `US-0001'`) to RELEASE_PLAN.md
2. Generate dashboard and click to expand ACs
   Expected: ID safely rendered; no JS execution
   Actual: `onclick="toggleCardACs('${esc(story.id)}')"` breaks — esc() doesn't escape `'` in JS context
   Status: Fixed
   Fix Branch: feature/US-0048-ui-redesign-sidebar
   Lesson Encoded: No
   Estimated Cost USD: 0.15

---

BUG-0095: Complex inline IIFE in traceability onclick attribute — unmaintainable
Severity: Medium
Related Story: US-0009
Steps to Reproduce:

1. View render-html.js line 411
2. Note inline IIFE in onclick: `onclick="(function(){var rows=...})()"`
   Expected: Named function or event listener
   Actual: Inline IIFE is fragile and hard to debug
   Status: Fixed
   Fix Branch: feature/US-0048-ui-redesign-sidebar
   Lesson Encoded: No
   Estimated Cost USD: 0.10

---

BUG-0096: Priority parsing inconsistent — returns full string or regex match
Severity: Medium
Related Story: US-0001
Steps to Reproduce:

1. Parse story with `Priority: High` (no parens) vs `Priority: High (P0)`
   Expected: Consistent output format
   Actual: With parens returns `P0`, without returns full string
   Status: Fixed
   Fix Branch: feature/US-0048-ui-redesign-sidebar
   Lesson Encoded: No
   Estimated Cost USD: 0.05

---

BUG-0097: render-html.js ~1700 lines — monolithic file hard to maintain
Severity: Low
Related Story: US-0053
Steps to Reproduce:

1. Open tools/lib/render-html.js
   Expected: Modular functions in separate files
   Actual: Single 1700-line file
   Status: Retired
   Fix Branch:
   Lesson Encoded: No
   Estimated Cost USD: 0.00
   Notes: Moved to US-0053 in RELEASE_PLAN.md as a planned technical debt refactoring task

---

BUG-0098: parse-cost-log.js regex too complex to read
Severity: Low
Related Story: US-0004
Steps to Reproduce:

1. View line 7 of parse-cost-log.js
   Expected: Named regex constants
   Actual: Single 200+ char regex
   Status: Fixed
   Fix Branch: feature/US-0048-ui-redesign-sidebar
   Lesson Encoded: No
   Estimated Cost USD: 0.05

---

BUG-0099: detect-at-risk.js Array.isArray check may be unnecessary
Severity: Low
Related Story: US-0008
Steps to Reproduce:

1. View line 11 of detect-at-risk.js
   Expected: Comment explaining why check exists
   Actual: Check present but may be redundant
   Status: Fixed
   Fix Branch: feature/US-0048-ui-redesign-sidebar
   Lesson Encoded: No
   Estimated Cost USD: 0.02

---

BUG-0100: capture-cost.js silent failure when transcript not found
Severity: Low
Related Story: US-0012
Steps to Reproduce:

1. Run capture-cost.js with invalid session
   Expected: Warning printed
   Actual: Silent null returned
   Status: Fixed
   Fix Branch: feature/US-0048-ui-redesign-sidebar
   Lesson Encoded: No
   Estimated Cost USD: 0.05

BUG-0091: Topbar overlaps activity panel — last stat tile clipped on desktop
Severity: Medium
Related Story: US-0048
Related Task: TASK-0041
Steps to Reproduce:

1. Open plan-status.html on a desktop viewport (≥768px) with the activity panel visible
2. Observe the rightmost header tile — it is partially hidden behind the 280px activity panel
   Expected: All six topbar stat tiles are fully visible; topbar ends where the activity panel begins
   Actual: #topbar-fixed uses right:0 and spans full viewport width, causing the Estimated tile to be obscured by the activity panel overlay
   Status: Fixed
   Fix Branch: feature/US-0048-ui-redesign-sidebar
   Lesson Encoded: No
   Estimated Cost USD: 0.02

---

BUG-0098: Open bug count includes Retired bugs — shows incorrect count in header
Severity: Medium
Related Story: US-0036
Steps to Reproduce:

1. Open plan-status.html
2. Observe the Bugs Open stat tile in the top bar
3. Click the Bugs tab and apply a status filter
   Expected: Open bug count excludes Retired and Cancelled bugs; shows only truly open bugs
   Actual: Bugs with status "Retired" are counted as open because filter uses !/^Fixed/i which passes Retired
   Status: Open
   Fix Branch:
   Lesson Encoded: No

---

BUG-0099: Epic group headers remain visible when all children are filtered out
Severity: Medium
Related Story: US-0010
Steps to Reproduce:

1. Open plan-status.html → Hierarchy or Bugs tab
2. Apply a filter that results in zero matches for a specific epic group
3. Observe the epic group header
   Expected: Epic group headers with zero visible children are hidden; counts reflect filtered results
   Actual: Epic group headers remain visible even when all children are hidden by filters; counts show original totals
   Status: Open
   Fix Branch:
   Lesson Encoded: No

---

BUG-0101: Costs tab confined to viewport height — page does not scroll
Severity: Medium
Related Story: US-0084
Steps to Reproduce:

1. Open plan-status.html → Costs tab
2. Observe the Per-Epic Budget table and the Stories/Bug Fix Cost tables below
   Expected: Tab scrolls normally as a page; all sections visible by scrolling
   Actual: Tab uses fixed viewport height (tab-fill class); budget table and stories table are cramped and neither the page nor the sections scroll usably
   Status: Fixed
   Fix Branch: develop
   Lesson Encoded: No
   Estimated Cost USD: 0.00

---

BUG-0102: NaN% shown in Per-Epic Budget % Used column when budget and spend are both $0
Severity: Low
Related Story: US-0084
Steps to Reproduce:

1. Open plan-status.html → Costs tab → Per-Epic Budget table
2. Observe epics where Budget = $0.00 and Spent = $0.00
   Expected: % Used column shows — (dash) when no budget has been set
   Actual: % Used shows NaN% with a green progress bar
   Status: Fixed
   Fix Branch: develop
   Lesson Encoded: No
   Estimated Cost USD: 0.00

---

BUG-0103: Search modal returns no results for epics — epics not in search index
Severity: Medium
Related Story: US-0069
Steps to Reproduce:

1. Open plan-status.html → press ⌘K to open search
2. Type "EPIC-0001"
   Expected: Epic shown in results with title and status
   Actual: No results shown; epics were never added to buildSearchIndex()
   Status: Fixed
   Fix Branch: develop
   Lesson Encoded: No
   Estimated Cost USD: 0.00

---

BUG-0104: Agentic Dashboard About modal auto-closes every 5 seconds
Severity: Medium
Related Story: US-0085
Steps to Reproduce:

1. Open dashboard.html → click ℹ️ About
2. Wait 5 seconds without interacting
   Expected: Modal remains open until user closes it
   Actual: meta http-equiv="refresh" content="5" reloads the entire page, dismissing the modal
   Status: Fixed
   Fix Branch: develop
   Lesson Encoded: No
   Estimated Cost USD: 0.00

---

BUG-0105: Agent portraits blink every 5 seconds on Agentic Dashboard
Severity: Low
Related Story: US-0085
Steps to Reproduce:

1. Open dashboard.html
2. Watch agent portrait images over 10 seconds
   Expected: Portraits are stable; only animate on meaningful state change
   Actual: All images blink/reload every 5 seconds due to full page meta-refresh
   Status: Fixed
   Fix Branch: develop
   Lesson Encoded: No
   Estimated Cost USD: 0.00

---

BUG-0106: Bug and Lesson cards missing 3D hover effect present on other card views
Severity: Low
Related Story: US-0084
Steps to Reproduce:

1. Open plan-status.html → Hierarchy tab → card view → hover a story card (scale + shadow)
2. Switch to Bugs tab → card view → hover a bug card
   Expected: Same scale + shadow hover effect as story cards
   Actual: No hover effect; bug and lesson cards lack the story-card-hover class
   Status: Fixed
   Fix Branch: develop
   Lesson Encoded: No
   Estimated Cost USD: 0.00

---

BUG-0107: Alerts button on Agentic Dashboard is one-way — cannot be toggled off
Severity: Low
Related Story: US-0085
Steps to Reproduce:

1. Open dashboard.html → click 🔔 Alerts → grant notification permission
2. Button shows "🔔 On" — click it again
   Expected: Button toggles to 🔕 Off and stops sending notifications
   Actual: requestAlerts() calls Notification.requestPermission() again which returns 'granted' instantly; button stays "🔔 On"
   Status: Fixed
   Fix Branch: develop
   Lesson Encoded: No
   Estimated Cost USD: 0.00

---

BUG-0110: badge() function uses dark-mode-only hex values — badges render as dark rectangles in light mode
Severity: High
Related Story: US-0097
Steps to Reproduce:

1. Open plan-status.html in light mode
2. Scroll to any status/severity/priority badge (e.g., "Done", "High", "P0")
   Expected: Badges have readable background/text contrast in both light and dark modes
   Actual: All badges use very dark backgrounds (#0a1628, #031a0e) with light text; in light mode they appear as tiny dark rectangles, clashing with the surrounding light UI
   Status: Open
   Fix Branch: feature/US-0097-semantic-badges
   Lesson Encoded: No
   Estimated Cost USD: 0.00

---

BUG-0111: Chart card containers mix Tailwind classes with --clr-* tokens inconsistently
Severity: Low
Related Story: US-0095
Steps to Reproduce:

1. Inspect chart card elements in Status/Trends/Costs tabs
2. Observe the bg/border class list on each card
   Expected: All card containers use the --clr-panel-bg / --clr-border token system consistently
   Actual: Cards mix `bg-white dark:bg-slate-800` + `border border-slate-200 dark:border-slate-700` — bypasses the token system and complicates theme swaps or future refactors
   Status: Open
   Fix Branch: feature/US-0095-shadow-cards
   Lesson Encoded: No
   Estimated Cost USD: 0.00

---

BUG-0112: Kanban swimlane header hover effect nearly invisible in light mode
Severity: Medium
Related Story: US-0101
Steps to Reproduce:

1. Open plan-status.html → Kanban tab in light mode
2. Hover over any epic swimlane header
   Expected: Clear visual hover affordance (background-color shift or similar)
   Actual: Hover uses `filter: brightness(1.05)` which on already-light backgrounds produces almost no visible change; users can't tell which row they're about to click
   Status: Open
   Fix Branch: feature/US-0101-kanban-polish
   Lesson Encoded: No
   Estimated Cost USD: 0.00
