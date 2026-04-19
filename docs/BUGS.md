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
   Status: Fixed
   Fix Branch: develop (fixed in Session 16 — render-shell.js:20 + render-tabs.js:1254; BUGS.md status was stale)
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
   Status: Fixed
   Fix Branch: bugfix/BUG-0099-epic-header-filter-visibility
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
   Status: Fixed
   Fix Branch: feature/US-0097-semantic-badges
   Lesson Encoded: No
   Estimated Cost USD: 0.00

---

BUG-0111: Chart card containers mix Tailwind classes with --clr-\* tokens inconsistently
Severity: Low
Related Story: US-0095
Steps to Reproduce:

1. Inspect chart card elements in Status/Trends/Costs tabs
2. Observe the bg/border class list on each card
   Expected: All card containers use the --clr-panel-bg / --clr-border token system consistently
   Actual: Cards mix `bg-white dark:bg-slate-800` + `border border-slate-200 dark:border-slate-700` — bypasses the token system and complicates theme swaps or future refactors
   Status: Fixed
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
   Fix: Replaced `filter: brightness(1.05)` with `background: var(--clr-row-hover)` on `.ksw-swim-hdr:hover` — provides visible background-color shift in both light and dark modes
   Status: Fixed
   Fix Branch: feature/US-0101-kanban-polish
   Lesson Encoded: No
   Estimated Cost USD: 0.00

---

# Merged from legacy /BUGS.md (2026-04-14)

The following bugs were merged in from the deprecated root-level /BUGS.md file.
Original IDs conflicted with this file's numbering — entries have been renumbered here.
Title-based deduplication was applied: 0 entries skipped as duplicates, 44 merged as new IDs.

---

BUG-0113: No cross-link between SDLC dashboard and Plan Visualizer
Severity: Major
Related Story: n/a
Steps to Reproduce:

1. Originally logged as BUG-0011 in legacy /BUGS.md (renumbered during merge on 2026-04-14)
2. Found in: `tools/generate-dashboard.js`, `docs/dashboard.html`
   Description: The SDLC dashboard and Plan Visuali
   Status: Fixed
   Fix Branch: est/BUG-0011
   Lesson Encoded: No
   Estimated Cost USD: 0.00

---

BUG-0114: Dashboard is dark-mode only with low contrast text
Severity: Major
Related Story: n/a
Steps to Reproduce:

1. Originally logged as BUG-0014 in legacy /BUGS.md (renumbered during merge on 2026-04-14)
2. Found in: `tools/generate-dashboard.js`
   Description: Dashboard has no light mode toggle. Several text colors fail WCAG AA contrast: #666 on #1a1a2e = 2.8:1 ratio (requires 4.5:1). Card borders and metric dividers are nearly invisible.
   Fix: P1.9 — Add CSS variable theming, light/dark toggle with localStorage persistence, fix contrast ratios.
   Status: Fixed
   Fix Branch: est/BUG-0014
   Lesson Encoded: No
   Estimated Cost USD: 0.00

---

BUG-0115: Dashboard references EliteA instead of Claude Code
Severity: Major
Related Story: n/a
Steps to Reproduce:

1. Originally logged as BUG-0015 in legacy /BUGS.md (renumbered during merge on 2026-04-14)
2. Found in: `tools/generate-dashboard.js` lines 174, 314; `docs/sdlc-status.json` line 3
   Description: Dashboard subtitle and footer reference "EPAM EliteA" but the hackathon uses Claude Code as the agentic platform. EliteA is for the full production implementation.
   Fix: P1.10 — Replace "EPAM EliteA" with "Claude Code" in dashboard generator and status JSON.
   Status: Fixed
   Fix Branch: est/BUG-0015
   Lesson Encoded: No
   Estimated Cost USD: 0.00

---

BUG-0116: Unused `spin` CSS keyframe in dashboard
Severity: Minor
Related Story: n/a
Steps to Reproduce:

1. Originally logged as BUG-0016 in legacy /BUGS.md (renumbered during merge on 2026-04-14)
2. Found in: `tools/generate-dashboard.js` line 111
   Description: `@keyframes spin` is defined but never referenced by any CSS class. Dead code.
   Fix: P2.1 — Remove the unused keyframe.
   Status: Fixed
   Fix Branch: est/BUG-0016
   Lesson Encoded: No
   Estimated Cost USD: 0.00

---

BUG-0117: No convenience `build` script in package.json
Severity: Minor
Related Story: n/a
Steps to Reproduce:

1. Originally logged as BUG-0017 in legacy /BUGS.md (renumbered during merge on 2026-04-14)
2. Found in: `package.json`
   Description: Must run `plan:generate` and `dashboard` separately. No single command to regenerate all outputs.
   Fix: P2.2 — Add `"build": "npm run plan:generate && npm run dashboard"`.
   Status: Fixed
   Fix Branch: est/BUG-0017
   Lesson Encoded: No
   Estimated Cost USD: 0.00

---

BUG-0118: No hover states on dashboard interactive elements
Severity: Minor
Related Story: n/a
Steps to Reproduce:

1. Originally logged as BUG-0022 in legacy /BUGS.md (renumbered during merge on 2026-04-14)
2. Found in: `tools/generate-dashboard.js`
   Description: Agent cards and story rows have no hover feedback. Dashboard feels static when interacting.
   Fix: P1.9 — Add hover brightness filter to agent cards and story rows.
   Status: Fixed
   Fix Branch: est/BUG-0022
   Lesson Encoded: No
   Estimated Cost USD: 0.00

---

BUG-0119: Dashboard has no responsive layout for phones/tablets
Severity: Major
Related Story: n/a
Steps to Reproduce:

1. Originally logged as BUG-0023 in legacy /BUGS.md (renumbered during merge on 2026-04-14)
2. Found in: `tools/generate-dashboard.js`
   Description: Dashboard uses fixed desktop grid layouts (3-column metrics, 2-column story grid, 6-phase hori
   Status: Fixed
   Fix Branch: est/BUG-0023
   Lesson Encoded: No
   Estimated Cost USD: 0.00

---

BUG-0120: Dashboard has no About section or attribution
Severity: Minor
Related Story: n/a
Steps to Reproduce:

1. Originally logged as BUG-0024 in legacy /BUGS.md (renumbered during merge on 2026-04-14)
2. Found in: `tools/generate-dashboard.js`
   Description: No way for viewers to learn what the dashboard is, who built it, or find the source repo. Missing attribution and context for hackathon demo audience.
   Fix: Add "About" button in header with modal popup: title "AI-SDLC Orchestrator Visuali
   Status: Fixed
   Fix Branch: est/BUG-0024
   Lesson Encoded: No
   Estimated Cost USD: 0.00

---

BUG-0121: Agentic orchestration is coupled to Claude Code platform
Severity: Major
Related Story: n/a
Steps to Reproduce:

1. Originally logged as BUG-0031 in legacy /BUGS.md (renumbered during merge on 2026-04-14)
2. Found in: `docs/agents/DM_AGENT.md`, `README.md`
   Description: Agent spawning instructions, CLI invocations, and parallel execution patterns are hardcoded to Claude Code. Cannot run the same orchestration on Codex, Gemini, or open-source models without rewriting DM_AGENT.md and README.md. The agent instruction files themselves are platform-agnostic markdown, but the invocation and spawning mechanism is not.
   Fix: Create `orchestrator/` adapter layer with platform-specific spawn implementations. Abstract DM_AGENT.md spawning to use platform-agnostic patterns. Update README.md with multi-platform quick-start instructions.
   Status: Fixed
   Fix Branch: est/BUG-0031
   Lesson Encoded: No
   Estimated Cost USD: 0.00

---

BUG-0122: No CI checks on pull requests
Severity: Major
Related Story: n/a
Steps to Reproduce:

1. Originally logged as BUG-0032 in legacy /BUGS.md (renumbered during merge on 2026-04-14)
2. Found in: `.github/workflows/`
   Description: Only 1 GitHub Actions workflow exists (`plan-visuali
   Status: Fixed
   Fix Branch: est/BUG-0032
   Lesson Encoded: No
   Estimated Cost USD: 0.00

---

BUG-0123: ESLint not covering orchestrator/ or tests/ files
Severity: Major
Related Story: n/a
Steps to Reproduce:

1. Originally logged as BUG-0033 in legacy /BUGS.md (renumbered during merge on 2026-04-14)
2. Found in: `eslint.config.js`
   Description: ESLint only targeted `tools/**/*.js`. The `orchestrator/` adapter code and `tests/` unit tests were never linted. Test files failed lint with hundreds of `no-undef` errors for Jest globals (`describe`, `it`, `expect`). Orchestrator files had unused imports.
   Fix: Expand ESLint config to cover `orchestrator/**/*.js` and `tests/**/*.js`. Add Jest globals to test config block. Add Node.js timer globals (`setTimeout`, `clearTimeout`).
   Status: Fixed
   Fix Branch: est/BUG-0033
   Lesson Encoded: No
   Estimated Cost USD: 0.00

---

BUG-0124: Unused imports in orchestrator/spawn.js
Severity: Minor
Related Story: n/a
Steps to Reproduce:

1. Originally logged as BUG-0034 in legacy /BUGS.md (renumbered during merge on 2026-04-14)
2. Found in: `orchestrator/spawn.js` lines 19-20
   Description: `path` and `fs` modules were imported but never used, causing ESLint `no-unused-vars` warnings.
   Fix: Remove unused `path` and `fs` require statements.
   Status: Fixed
   Fix Branch: est/BUG-0034
   Lesson Encoded: No
   Estimated Cost USD: 0.00

---

BUG-0125: Useless assignment in generate-dashboard.js
Severity: Minor
Related Story: n/a
Steps to Reproduce:

1. Originally logged as BUG-0035 in legacy /BUGS.md (renumbered during merge on 2026-04-14)
2. Found in: `tools/generate-dashboard.js` line 454
   Description: `let spotlight = ''` was immediately overwritten in both branches of the following `if/else`, triggering ESLint `no-useless-assignment` error.
   Fix: Change to `let spotlight;` (uninitiali
   Status: Fixed
   Fix Branch: est/BUG-0035
   Lesson Encoded: No
   Estimated Cost USD: 0.00

---

BUG-0126: Error cause not preserved in generate-plan.js
Severity: Minor
Related Story: n/a
Steps to Reproduce:

1. Originally logged as BUG-0036 in legacy /BUGS.md (renumbered during merge on 2026-04-14)
2. Found in: `tools/generate-plan.js` line 159
   Description: When rethrowing a caught error for failed `package.json` read, the original error cause was not attached. ESLint `preserve-caught-error` rule flagged this as losing the error chain.
   Fix: Add `{ cause: err }` to the rethrown `new Error(msg, { cause: err })`.
   Status: Fixed
   Fix Branch: est/BUG-0036
   Lesson Encoded: No
   Estimated Cost USD: 0.00

---

BUG-0127: No code formatting standard enforced
Severity: Minor
Related Story: n/a
Steps to Reproduce:

1. Originally logged as BUG-0037 in legacy /BUGS.md (renumbered during merge on 2026-04-14)
2. Found in: Project-wide
   Description: No code formatter configured. Inconsistent formatting across JS files, markdown, and config files. No CI check to enforce formatting consistency.
   Fix: Added Prettier with `.prettierrc` config (semi, singleQuote, trailingComma all, printWidth 120), `.prettierignore`, `format` and `format:check` npm scripts, and CI job to enforce formatting on PRs.
   Status: Fixed
   Fix Branch: est/BUG-0037
   Lesson Encoded: No
   Estimated Cost USD: 0.00

---

BUG-0128: Dashboard does not render BLOCKED phase status
Severity: High
Related Story: n/a
Steps to Reproduce:

1. Originally logged as BUG-0038 in legacy /BUGS.md (renumbered during merge on 2026-04-14)
2. Found in: `tools/generate-dashboard.js` lines 151, 375
   Description: Phase pipeline only renders `pending`, `in-progress`, and `complete` states. No CSS class, icon, or visual treatment for `blocked` status. A blocked phase looks identical to pending, so human operators miss escalation events.
   Fix: Added `.phase-block.blocked` CSS (red background, red pulsing animation), ⛔ icon mapping, and light/dark theme support.
   Status: Fixed
   Fix Branch: est/BUG-0038
   Lesson Encoded: No
   Estimated Cost USD: 0.00

---

BUG-0129: Dashboard does not render BLOCKED agent status
Severity: High
Related Story: n/a
Steps to Reproduce:

1. Originally logged as BUG-0039 in legacy /BUGS.md (renumbered during merge on 2026-04-14)
2. Found in: `tools/generate-dashboard.js` lines 492-507
   Description: Agent card status color logic only handles `active` and `complete`. Blocked agents render with gray status (#888), indistinguishable from idle. No border highlight or animation for blocked agents.
   Fix: Added blocked handling to statusBg/statusColor logic, `.agent-card.blocked` CSS class with red border and pulse animation, and `cardClass` variable for dynamic class assignment.
   Status: Fixed
   Fix Branch: est/BUG-0039
   Lesson Encoded: No
   Estimated Cost USD: 0.00

---

BUG-0130: No alert banner when orchestration is BLOCKED
Severity: Critical
Related Story: n/a
Steps to Reproduce:

1. Originally logged as BUG-0040 in legacy /BUGS.md (renumbered during merge on 2026-04-14)
2. Found in: `tools/generate-dashboard.js`
   Description: When Conductor sets a phase/agent to `blocked` in sdlc-status.json, the dashboard shows no prominent notification. Humans must scroll to the phase pipeline to notice the blocked state — easy to miss.
   Fix: Added top-of-page red alert banner that appears when any phase or agent is blocked. Includes dynamic summary of which phases/agents are blocked, a dismiss button, and pulsing animation.
   Status: Fixed
   Fix Branch: est/BUG-0040
   Lesson Encoded: No
   Estimated Cost USD: 0.00

---

BUG-0131: No audio alert on BLOCK events
Severity: High
Related Story: n/a
Steps to Reproduce:

1. Originally logged as BUG-0041 in legacy /BUGS.md (renumbered during merge on 2026-04-14)
2. Found in: `tools/generate-dashboard.js`
   Description: When orchestration transitions to BLOCKED state, there is no audible notification. The dashboard auto-refreshes every 5 seconds but the human may not be watching the screen.
   Fix: Added Web Audio API three-tone ascending alert (440H
   Status: Fixed
   Fix Branch: est/BUG-0041
   Lesson Encoded: No
   Estimated Cost USD: 0.00

---

BUG-0132: No browser notification on BLOCK events
Severity: High
Related Story: n/a
Steps to Reproduce:

1. Originally logged as BUG-0042 in legacy /BUGS.md (renumbered during merge on 2026-04-14)
2. Found in: `tools/generate-dashboard.js`
   Description: No browser push notification when orchestration becomes BLOCKED. If the user has the dashboard in a background tab, they receive no notification that human input is required.
   Fix: Added Notification API integration that sends a persistent browser notification on BLOCK transitions. Requests permission on toggle, persists preference to localStorage, uses `requireInteraction: true` so notification stays until acknowledged.
   Status: Fixed
   Fix Branch: est/BUG-0042
   Lesson Encoded: No
   Estimated Cost USD: 0.00

---

BUG-0133: Prettier reformats test fixture breaking parse-bugs tests
Severity: Medium
Related Story: n/a
Steps to Reproduce:

1. Originally logged as BUG-0043 in legacy /BUGS.md (renumbered during merge on 2026-04-14)
2. Found in: `tests/fixtures/BUGS.md`
   Description: Prettier markdown formatting indented metadata fields (Status, Fix Branch, Estimated Cost USD) under a numbered list item. The `parseBugs` regex uses `^` anchors requiring column 0, causing 4 test failures in CI.
   Fix: Restructured fixture to keep numbered list items and metadata fields at separate paragraph levels so Prettier does not nest them.
   Status: Fixed
   Fix Branch: est/BUG-0043
   Lesson Encoded: No
   Estimated Cost USD: 0.00

---

BUG-0134: Race condition on sdlc-status.json during parallel agent writes
Severity: Critical
Related Story: n/a
Steps to Reproduce:

1. Originally logged as BUG-0044 in legacy /BUGS.md (renumbered during merge on 2026-04-14)
2. Found in: `docs/sdlc-status.json`, `docs/agents/DM_AGENT.md`
   Description: When Forge and Pixel run in parallel (Phase 3), both agents update `sdlc-status.json` to report progress. Without locking, one agent's write can overwrite the other's, losing status updates. This is a classic lost-update race condition.
   Fix: Added `orchestrator/file-lock.js` (mkdir-based locking with stale detection) and `orchestrator/atomic-write.js` (atomic read-modify-write via temp+rename). All agents must use `atomicReadModifyWriteJson()` for sdlc-status.json updates.
   Status: Fixed
   Fix Branch: est/BUG-0044
   Lesson Encoded: No
   Estimated Cost USD: 0.00

---

BUG-0135: Race condition on ID_REGISTRY.md causes duplicate IDs
Severity: Critical
Related Story: n/a
Steps to Reproduce:

1. Originally logged as BUG-0045 in legacy /BUGS.md (renumbered during merge on 2026-04-14)
2. Found in: `docs/ID_REGISTRY.md`
   Description: When parallel agents both need to allocate a new bug or task ID, they could read the same "next available" value from ID_REGISTRY.md simultaneously, producing duplicate IDs. This corrupts cross-references across BUGS.md, RELEASE_PLAN.md, and TEST_CASES.md.
   Fix: Added `reserveId(sequence)` in `orchestrator/atomic-write.js` that acquires a file lock, reads the registry, increments the sequence, and writes back atomically. Agents must use this instead of manual ID allocation.
   Status: Fixed
   Fix Branch: est/BUG-0045
   Lesson Encoded: No
   Estimated Cost USD: 0.00

---

BUG-0136: Interleaved writes to progress.md and AI_COST_LOG.md
Severity: High
Related Story: n/a
Steps to Reproduce:

1. Originally logged as BUG-0046 in legacy /BUGS.md (renumbered during merge on 2026-04-14)
2. Found in: `progress.md`, `docs/AI_COST_LOG.md`
   Description: Append-only log files written by multiple parallel agents can produce interleaved or corrupted entries when two processes append simultaneously. Markdown structure breaks when partial lines from different agents mix.
   Fix: Added `atomicAppend()` in `orchestrator/atomic-write.js` that acquires a file lock before appending. All log-style file writes must use this function.
   Status: Fixed
   Fix Branch: est/BUG-0046
   Lesson Encoded: No
   Estimated Cost USD: 0.00

---

BUG-0137: Git push failures during parallel agent branches
Severity: High
Related Story: n/a
Steps to Reproduce:

1. Originally logged as BUG-0047 in legacy /BUGS.md (renumbered during merge on 2026-04-14)
2. Found in: Orchestrator agent workflow
   Description: When parallel agents push to different branches simultaneously, network contention or remote rejections can cause silent push failures. Agents may believe code is pushed when it isn't, leading to lost work or stale PRs.
   Fix: Added `orchestrator/git-safe.js` with `safePush()` (exponential backoff retry, auto-pull on rejection), `detectConflicts()` (dry-run merge check), and `checkOverlap()` (overlapping file detection between branches).
   Status: Fixed
   Fix Branch: est/BUG-0047
   Lesson Encoded: No
   Estimated Cost USD: 0.00

---

BUG-0138: No merge conflict detection before parallel branch merges
Severity: High
Related Story: n/a
Steps to Reproduce:

1. Originally logged as BUG-0048 in legacy /BUGS.md (renumbered during merge on 2026-04-14)
2. Found in: `docs/agents/DM_AGENT.md`
   Description: When Conductor merges parallel branches (e.g., Forge's backend + Pixel's frontend), there is no pre-merge conflict check. If both branches modify shared files (package.json, types, test fixtures), the merge fails mid-way and requires manual intervention.
   Fix: Added `checkOverlap()` and `detectConflicts()` to `orchestrator/git-safe.js`. Conductor must run overlap check before merging parallel branches. Sequential merge order: first-in merges clean, second rebases on top.
   Status: Fixed
   Fix Branch: est/BUG-0048
   Lesson Encoded: No
   Estimated Cost USD: 0.00

---

BUG-0139: No pre-commit formatting enforcement
Severity: Medium
Related Story: n/a
Steps to Reproduce:

1. Originally logged as BUG-0049 in legacy /BUGS.md (renumbered during merge on 2026-04-14)
2. Found in: Project configuration
   Description: Prettier formatting was only enforced in CI. Developers and agents could commit unformatted code, causing CI failures on every PR. No local feedback loop before push.
   Fix: Added husky pre-commit hook with lint-staged. On commit, staged `.js`, `.json`, `.md`, `.yml`, `.yaml` files are auto-formatted with Prettier, and `.js` files are auto-fixed with ESLint.
   Status: Fixed
   Fix Branch: est/BUG-0049
   Lesson Encoded: No
   Estimated Cost USD: 0.00

---

BUG-0140: Agent registry hardcoded across 3 files
Severity: Major
Related Story: n/a
Steps to Reproduce:

1. Originally logged as BUG-0050 in legacy /BUGS.md (renumbered during merge on 2026-04-14)
2. Found in: `orchestrator/spawn.js`, `tools/generate-dashboard.js`, `tools/process-avatars.js`
   Description: Agent names, roles, icons, and colors were hardcoded independently in 3 separate files (spawn.js had the agent registry, generate-dashboard.js had duplicate role/color/icon maps, process-avatars.js had a hardcoded AGENTS_ORDER array). Adding or renaming an agent required changes in 3+ files, making the framework non-portable and error-prone.
   Fix: Created `agents.config.json` as the single source of truth for all agent definitions. Updated spawn.js, generate-dashboard.js, and process-avatars.js to load from config. Added `tools/init-sdlc-status.js` to generate sdlc-status.json from config. Any project can now customi
   Status: Fixed
   Fix Branch: est/BUG-0050
   Lesson Encoded: No
   Estimated Cost USD: 0.00

---

BUG-0141: No project entry point for multi-platform agent discovery
Severity: Major
Related Story: n/a
Steps to Reproduce:

1. Originally logged as BUG-0053 in legacy /BUGS.md (renumbered during merge on 2026-04-14)
2. Found in: Project root
   Description: No single file existed for AI agents to discover project-specific context on startup. Each agent had project knowledge baked into its instruction file. Different AI platforms (Claude Code, Gemini, Codex, etc.) auto-read different convention files (CLAUDE.md, Gemini.md, etc.) but none existed.
   Fix: Created `project.md` as the single project entry point referencing all architecture docs, release plan, test cases, and tracking files. Created 7 platform symlinks in repo root (`CLAUDE.md`, `Gemini.md`, `Codex.md`, `EliteA.md`, `CodeMie.md`, `Qwen.md`, `MiniMax.md`) all pointing to `project.md` for auto-discovery.
   Status: Fixed
   Fix Branch: est/BUG-0053
   Lesson Encoded: No
   Estimated Cost USD: 0.00

---

BUG-0142: Dashboard title, footer, brand color, and repo URL hardcoded
Severity: Major
Related Story: n/a
Steps to Reproduce:

1. Originally logged as BUG-0054 in legacy /BUGS.md (renumbered during merge on 2026-04-14)
2. Found in: `tools/generate-dashboard.js` lines 84, 355, 577, 591; 11 occurrences of `#D52B1E`
   Description: Dashboard HTML had "Your Project" title, "Canadian Tire Corporation" footer, GitHub repo URL, and CTC brand color `#D52B1E` hardcoded throughout CSS and HTML. Changing the project required editing 15+ locations in the dashboard generator.
   Fix: Added `dashboard` section to `agents.config.json` with `title`, `subtitle`, `footer`, `repoUrl`, and `primaryColor` fields. Dashboard generator reads these from config, defaulting to the repo name from `package.json`. All `#D52B1E` CSS references replaced with `var(--brand-primary)` CSS variable set from config.
   Status: Fixed
   Fix Branch: est/BUG-0054
   Lesson Encoded: No
   Estimated Cost USD: 0.00

---

BUG-0143: XSS via unescaped data attributes in render-html.js
Severity: Critical
Related Story: n/a
Steps to Reproduce:

1. Originally logged as BUG-0055 in legacy /BUGS.md (renumbered during merge on 2026-04-14)
2. Found in: `tools/lib/render-html.js` lines 225, 284, 319, 549, 1096, 1205, 1206, 1355, 1369
   Description: Multiple `data-*` HTML attributes and `onclick` handler strings were interpolated without escaping. Malicious story/epic IDs or bug statuses could inject arbitrary HTML/JS. Affected: story cards, epic headers, bug table rows, bug card views.
   Fix: Applied `esc()` to all `data-*` attribute interpolations and `jsEsc()` to all `onclick` handler string interpolations across 9 locations.
   Status: Fixed
   Fix Branch: est/BUG-0055
   Lesson Encoded: No
   Estimated Cost USD: 0.00

---

BUG-0144: Command injection via unquoted branch names in git-safe.js
Severity: Critical
Related Story: n/a
Steps to Reproduce:

1. Originally logged as BUG-0056 in legacy /BUGS.md (renumbered during merge on 2026-04-14)
2. Found in: `orchestrator/git-safe.js` — `safePush`, `safePull`, `detectConflicts`, `branchFiles` functions
   Description: Branch names were interpolated into shell commands without quoting: `git push origin ${branch}`. A branch name containing shell metacharacters (`;`, `$()`, backticks) could execute arbitrary commands.
   Fix: Quoted all 6 branch name interpolations in git shell commands with double quotes.
   Status: Fixed
   Fix Branch: est/BUG-0056
   Lesson Encoded: No
   Estimated Cost USD: 0.00

---

BUG-0145: Infinite recursion in stale lock recovery (file-lock.js)
Severity: Major
Related Story: n/a
Steps to Reproduce:

1. Originally logged as BUG-0057 in legacy /BUGS.md (renumbered during merge on 2026-04-14)
2. Found in: `orchestrator/file-lock.js` — `tryAcquire()` function
   Description: If a stale lock's info file was repeatedly unreadable, `tryAcquire()` would recursively call itself with no depth limit, causing a stack overflow.
   Fix: Added `_depth` parameter with max depth of 2 retries. Throws explicit error on excessive retries.
   Status: Fixed
   Fix Branch: est/BUG-0057
   Lesson Encoded: No
   Estimated Cost USD: 0.00

---

BUG-0146: Race condition on temp file names in atomic-write.js
Severity: Major
Related Story: n/a
Steps to Reproduce:

1. Originally logged as BUG-0058 in legacy /BUGS.md (renumbered during merge on 2026-04-14)
2. Found in: `orchestrator/atomic-write.js` — `atomicWrite()` function
   Description: Temp file suffix used only `process.pid`, so two rapid writes from the same process to the same directory could collide.
   Fix: Added `Date.now()` to temp file suffix: `.${basename}.tmp.${pid}.${timestamp}`.
   Status: Fixed
   Fix Branch: est/BUG-0058
   Lesson Encoded: No
   Estimated Cost USD: 0.00

---

BUG-0147: Missing JSON parse error handling in atomic-write.js
Severity: Major
Related Story: n/a
Steps to Reproduce:

1. Originally logged as BUG-0059 in legacy /BUGS.md (renumbered during merge on 2026-04-14)
2. Found in: `orchestrator/atomic-write.js` — `atomicReadModifyWriteJson()` function
   Description: `JSON.parse()` call had no try-catch. A corrupt JSON file would throw an opaque error without identifying the problematic file.
   Fix: Wrapped in try-catch with descriptive error message including the file path.
   Status: Fixed
   Fix Branch: est/BUG-0059
   Lesson Encoded: No
   Estimated Cost USD: 0.00

---

BUG-0148: Missing JSON parse error handling in spawn.js
Severity: Minor
Related Story: n/a
Steps to Reproduce:

1. Originally logged as BUG-0060 in legacy /BUGS.md (renumbered during merge on 2026-04-14)
2. Found in: `orchestrator/spawn.js` — `loadAgentsConfig()` function
   Description: `JSON.parse()` of `agents.config.json` had no error handling. A malformed config file would crash with an unhelpful stack trace.
   Fix: Added try-catch with descriptive error message.
   Status: Fixed
   Fix Branch: est/BUG-0060
   Lesson Encoded: No
   Estimated Cost USD: 0.00

---

BUG-0149: Missing argument bounds checking in spawn.js CLI
Severity: Minor
Related Story: n/a
Steps to Reproduce:

1. Originally logged as BUG-0061 in legacy /BUGS.md (renumbered during merge on 2026-04-14)
2. Found in: `orchestrator/spawn.js` — `main()` function
   Description: `--agent` and `--task` flags accessed `args[idx + 1]` without bounds checking, producing `undefined` if the argument was missing.
   Fix: Added bounds checks with descriptive error messages and usage hints.
   Status: Fixed
   Fix Branch: est/BUG-0061
   Lesson Encoded: No
   Estimated Cost USD: 0.00

---

BUG-0150: Silent lock directory removal failure in file-lock.js
Severity: Minor
Related Story: n/a
Steps to Reproduce:

1. Originally logged as BUG-0062 in legacy /BUGS.md (renumbered during merge on 2026-04-14)
2. Found in: `orchestrator/file-lock.js` — `release()` function
   Description: `rmdirSync` in `release()` could fail silently if directory had unexpected contents, leaving stale locks that would eventually expire via timeout.
   Fix: Added separate try-catch for `rmdirSync` with warning log.
   Status: Fixed
   Fix Branch: est/BUG-0062
   Lesson Encoded: No
   Estimated Cost USD: 0.00

---

BUG-0151: Dashboard author info hardcoded in generate-dashboard.js
Severity: Minor
Related Story: n/a
Steps to Reproduce:

1. Originally logged as BUG-0063 in legacy /BUGS.md (renumbered during merge on 2026-04-14)
2. Found in: `tools/generate-dashboard.js` lines 594-595
   Description: Author name "Kamal Syed" and title "Director of Program Management, EPAM Systems" were hardcoded in the About modal HTML.
   Fix: Added `author` and `authorTitle` fields to `agents.config.json` dashboard config. Dashboard reads from config and conditionally renders.
   Status: Fixed
   Fix Branch: est/BUG-0063
   Lesson Encoded: No
   Estimated Cost USD: 0.00

---

BUG-0152: Project-specific branch examples in AGENTS.md and AGENT_PLAN.md
Severity: Minor
Related Story: n/a
Steps to Reproduce:

1. Originally logged as BUG-0065 in legacy /BUGS.md (renumbered during merge on 2026-04-14)
2. Found in: `AGENTS.md` lines 338-339, `docs/AGENT_PLAN.md` line 61
   Description: Branch naming examples contained specific story/bug IDs (US-0003, BUG-0007, BUG-0012) instead of generic placeholders.
   Fix: Replaced with generic placeholders (US-XXXX, BUG-XXXX).
   Status: Fixed
   Fix Branch: est/BUG-0065
   Lesson Encoded: No
   Estimated Cost USD: 0.00

---

BUG-0153: No SAST or secret scanning in CI pipeline
Severity: Major
Related Story: n/a
Steps to Reproduce:

1. Originally logged as BUG-0066 in legacy /BUGS.md (renumbered during merge on 2026-04-14)
2. Found in: `.github/workflows/ci.yml`
   Description: CI pipeline had lint, test, build, format check, and dependency audit but no static analysis security testing (SAST) or secret scanning. Code vulnerabilities and accidentally committed secrets would go undetected.
   Fix: Added CodeQL SAST job (javascript-typescript) and TruffleHog secret scanning job to CI pipeline.
   Status: Fixed
   Fix Branch: est/BUG-0066
   Lesson Encoded: No
   Estimated Cost USD: 0.00

---

BUG-0154: Dashboard shows no audio/notification alert when pipeline state changes — user has no signal to return to terminal
Severity: Medium
Related Story: Tooling
Steps to Reproduce:

1. Originally logged as BUG-0106 in legacy /BUGS.md (renumbered during merge on 2026-04-14)
2. Found in: `tools/generate-dashboard.js` (dashboard HTML generation)
   Description: The agentic SDLC dashboard auto-refreshes every 5 seconds but gives no audio or notification signal when pipeline phases complete, agents become blocked, or bugs are opened. Users stepping away from the terminal have no way to know when their attention is required.
   Fix: Added a `localStorage`-based state change detection system. Each generated page embeds a `DASH_SNAPSHOT` JSON object with current phase, bug count, agent statuses, and pipeline completion state. On page load, the snapshot is compared to the previous render stored in `localStorage`. When a meaningful change is detected (phase completes, agent blocked, pipeline finishes, new bugs opened), the system plays a Web Audio API tone and fires a browser `Notification`. A "🔔 Alerts" button in the header lets users grant notification permission. No new dependencies — uses only built-in browser APIs.
   Status: Fixed
   Lesson Encoded: No
   Estimated Cost USD: 0.00

---

BUG-0155: AI Cost Timeline chart inflated by est/\* estimated bug costs — diverged from header total
Severity: Minor
Related Story: N/A (tooling)
Steps to Reproduce:

1. Originally logged as BUG-0113 in legacy /BUGS.md (renumbered during merge on 2026-04-14)
2. Found in: `tools/generate-plan.js` (`sessionTimeline` computation)
   Description: `sessionTimeline` called `deduplicateSessions(costRows)` without filtering `est/*` branches. The 18 synthetic estimated-bug-cost rows (e.g. `est/BUG-0001`) — representing manual estimates injected into `AI_COST_LOG.md` for bugs without real session data — were included in the cumulative timeline, inflating it by $101.15. The header total (`_totals.costUsd`) correctly skips `est/*` branches in `aggregateCostByBranch`, causing the two metrics to diverge.
   Fix: Added `.filter((row) => !row.branch.startsWith('est/'))` to the `sessionTimeline` pipeline in `generate-plan.js`. Both metrics now end at $483.63.
   Status: Fixed
   Fix Branch: develop
   Lesson Encoded: No
   Estimated Cost USD: 0.00

---

BUG-0156: Plan Visualizer hierarchy card view renders blank — applyFilters hides all card epics on init
Severity: Minor
Related Story: N/A (tooling)
Steps to Reproduce:

1. Originally logged as BUG-0114 in legacy /BUGS.md (renumbered during merge on 2026-04-14)
2. Found in: `tools/lib/render-html.js` (`applyFilters` function, line ~1792)
   Description: `applyFilters` queried `.story-row` children of each `.epic-block` element to determine whether to show or hide the block. In the column view, story rows are children of `.epic-block`. In the card view, the `.epic-block` is only the collapsible header; story rows live in a sibling `epic-cards-*` div. So `block.querySelectorAll('.story-row')` always returned 0 children for card view epic-blocks, causing all of them to be set to `display: none` on page load. Switching to card view showed a completely blank panel.
   Fix: Changed the search scope from `block` to `wrapper.closest('.mb-8') || block` so story rows in sibling divs are found correctly for card view epic blocks.
   Status: Fixed
   Fix Branch: develop
   Lesson Encoded: No
   Estimated Cost USD: 0.00

---

BUG-0157: Console TypeError on plan-status.html load — search-body addEventListener called on null
Severity: Low
Related Story: n/a
Steps to Reproduce:

1. Open plan-status.html in a browser (any commit pre- or post- US-0097; Sentinel observed this on base 3c0adc2)
2. Open DevTools console
   Expected: Clean console load
   Actual: "TypeError: Cannot read properties of null (reading 'addEventListener')" at plan-status.html:~20215 — search-body element lookup returns null before wire-up runs
   Status: Fixed
   Fix Branch: bugfix/BUG-0157-search-body-null-fix
   Lesson Encoded: No
   Estimated Cost USD: 0.00
   Notes: Root cause: renderScripts() was called at line 224 of render-html.js, but #search-body is in the modal HTML at lines 225–232. Script ran synchronously, reached getElementById('search-body') before the element existed. Fix: moved modal HTML (search-backdrop, search-modal, aboutModal) to before renderScripts() call. Found by Sentinel during US-0097 Playwright verification.

---

BUG-0158: Bug epic grouping broken — 50 bugs in "No Epic" due to relatedStory parsing + release-plan-fence issues
Severity: High
Related Story: US-0108
Steps to Reproduce:

1. Open plan-status.html → Costs tab → scroll to Bug Fix Costs
2. Observe bugs are not grouped by epic — large "No Epic" pile
   Expected: Bugs grouped under their epic based on relatedStory
   Actual: 50 bugs fall into \_ungrouped bucket
   Root causes (3):
   a. Parser required exact "US-XXXX" match but some bugs used "US-0012 (capture-cost)" with parenthetical
   b. US-0085/0086/0087 live inside adjacent code-fence empty blocks in the Standalone Stories section — extractCodeBlocks's regex pairing treated them as outside any block so they never got an epicId
   c. 44 bugs merged from legacy /BUGS.md have relatedStory="n/a" — no way to retroactively map
   Status: Fixed
   Fix Branch: bugfix/BUG-0158-bug-epic-grouping
   Lesson Encoded: No
   Estimated Cost USD: 0.00
   Notes: Fix adds normalizeStoryRef() regex extraction in render-html.js + rewrites parseReleasePlan to scan chunks directly (no fence boundaries). 46 bugs still ungrouped after fix — all with n/a relatedStory from the legacy merge; those are a data concern for EPIC-0017 discovery.

---

BUG-0159: Agentic Dashboard 30s location.reload() wipes scroll position and modal state
Severity: High
Related Story: US-0111
Steps to Reproduce:

1. Open docs/dashboard.html in a browser
2. Scroll down into the agents list or the activity log
3. Wait up to 30 seconds
   Expected: Page refreshes polling data in place and preserves scroll position + any open modal/popup state
   Actual: setInterval fires location.reload(), the whole page reloads, scroll resets to top, and any open About modal / expanded card closes
   Status: Fixed
   Fix Branch: feature/US-0111-live-fetch-and-patch
   Lesson Encoded: No
   Estimated Cost USD: 0.00
   Notes: Fixed by US-0111 — the setInterval(location.reload, 30000) loop was replaced with setInterval(refreshState, 5000). refreshState() fetches docs/sdlc-status.json and invokes patchDOM(newStatus) + runAlertCheck(newStatus) so only changed nodes update; scroll position, open modals, and portrait popups now persist across ticks.

---

BUG-0160: playBeep() leaks AudioContext on every BLOCKED transition
Severity: Medium
Related Story: US-0122
Steps to Reproduce:

1. Open docs/dashboard.html
2. Simulate 20 rapid BLOCKED-state transitions (e.g. toggle status in sdlc-status.json)
3. Open DevTools → Application → Storage
   Expected: A single AudioContext instance exists and is reused across beeps
   Actual: playBeep() calls `new AudioContext()` on every invocation; browsers limit AudioContexts per page and the count climbs until the limit is hit
   Status: Fixed
   Fix Branch: feature/US-0122-alerts-incident-ticker
   Lesson Encoded: No
   Estimated Cost USD: 0.00
   Notes: Fixed by US-0122 — playBeep now reuses a singleton module-level AudioContext via getAudioContext(), eliminating the per-call leak.

---

BUG-0161: Agent-card hover filter:brightness(1.12) is nearly invisible in light mode
Severity: Medium
Related Story: US-0119
Steps to Reproduce:

1. Open docs/dashboard.html in light mode
2. Hover over an agent card in the agent grid
   Expected: A visible hover affordance indicates the card is interactive
   Actual: brightness(1.12) on an already-light surface produces almost no visible shift; users can't tell the card is hoverable
   Status: Fixed
   Fix Branch: feature/US-0119-agent-spotlight-stations
   Lesson Encoded: No
   Estimated Cost USD: 0.00
   Notes: Fixed in US-0119 (AC-0405). .agent-card:hover now applies a 4px agent-color outline glow via box-shadow 0 0 0 4px var(--agent-color-ring) — an rgba-40% variant of the per-agent color pulled from agents.config.json. The previous filter:brightness(1.12) has been removed. The active-station 3px box-shadow glow (AC-0403) is preserved and layers with the hover glow so active+hover produces a combined outline. Verified visible in both dark and light themes since the agent color ring is a saturated hue regardless of surface brightness.

---

BUG-0162: Agentic Dashboard header gradient hardcodes #8B1A12 dark red which reads as warning state
Severity: Low
Related Story: US-0114
Steps to Reproduce:

1. Open docs/dashboard.html (any healthy pipeline state)
2. Observe the header
   Expected: Header neutral/healthy when system is healthy; alert color reserved for incident states
   Actual: Header uses `linear-gradient(135deg, var(--brand-primary) 0%, #8B1A12 100%)` — the hardcoded dark red reads visually as "alert" even when nothing is blocked
   Status: Fixed
   Fix Branch: feature/US-0114-header-3-zone
   Lesson Encoded: No
   Estimated Cost USD: 0.00
   Notes: Fixed by US-0114: replaced gradient with neutral #0b0d12 bg + 1px divider border. Red reserved for .header-blocked accent only.

---

BUG-0163: Agent portraits exist in docs/agents/images/ but are not wired into agents.config.json or the dashboard renderer
Severity: Low
Related Story: US-0113
Steps to Reproduce:

1. Inspect docs/agents/images/ — see 9 agent PNG portraits (conductor, compass, keystone, lens, palette, forge, pixel, sentinel, circuit)
2. Open docs/dashboard.html
3. Inspect any agent card
   Expected: Each agent card shows its portrait photo
   Actual: Cards render emoji-only because the renderer has no avatar path to use — agents.config.json has no `avatar` field and generate-dashboard.js doesn't read one
   Status: Fixed
   Fix Branch: feature/US-0113-agent-portraits
   Lesson Encoded: No
   Estimated Cost USD: 0.00
   Notes: To be fixed by US-0113. Portraits are raw 7-9MB PNGs so preprocessing to WebP at 64/160/320 sizes is required before wiring, otherwise page weight balloons to 70+ MB. Optimized variants already exist under docs/agents/images/optimized/ from Session 17 — US-0113 just needs to wire config and renderer.

BUG-0164: Agentic Dashboard USER STORIES panel shows "undefined" titles and duplicates the epic label
Severity: Medium
Related Story: n/a
Steps to Reproduce:

1. Open docs/dashboard.html
2. Observe the USER STORIES panel
   Expected: Each story row shows the story ID, title, and status; each epic header shows the epic ID once followed by its human-readable title
   Actual: Story title column reads "undefined" because docs/sdlc-status.json stories have no `title` field; epic header renders the epic ID twice ("EPIC-0015 EPIC-0015") because `status.epics` is an empty object and the fallback uses the same ID
   Status: Fixed
   Fix Branch: bugfix/BUG-0164-0166-dashboard-honesty
   Lesson Encoded: No
   Estimated Cost USD: 0.00
   Notes: Fixed by enriching stories with titles from docs/plan-status.json at generate time in tools/generate-dashboard.js, suppressing the duplicate epic label when no human-readable name is available, and adding `min-width: 0` to the `.story-title` flex child so long titles truncate with ellipsis inside the fixed-width panel instead of overrunning horizontally.

---

BUG-0165: Plan Visualizer Bugs tab does not match the Hierarchy tab's epic grouping appearance
Severity: Low
Related Story: n/a
Steps to Reproduce:

1. Open docs/plan-status.html
2. Compare the Hierarchy tab with the Bugs tab
   Expected: Both tabs show epic groupings with the same visual treatment — left-border accent in the epic color, epic ID + status badge + title in the header, and an aggregate counter on the right
   Actual: Hierarchy uses `.epic-block` cards with a 4px left accent border and status badge in the header; Bugs uses a plain `<tbody>` top-border with no left accent, no status badge, and only a `(N)` count
   Status: Fixed
   Fix Branch: bugfix/BUG-0164-0166-dashboard-honesty
   Lesson Encoded: No
   Estimated Cost USD: 0.00
   Notes: Fixed in tools/lib/render-html.js renderBugsTab — each per-epic header+rows pair is now wrapped in a `.bug-epic-block` tbody styled with the same left-accent bar and padding as Hierarchy, and the header renders the epic status badge plus an "N open · M total" aggregate.

---

BUG-0166: Agentic Dashboard metric cards show stale and incorrect data (including "4 / 0" for Tasks Done)
Severity: High
Related Story: n/a
Steps to Reproduce:

1. Open docs/dashboard.html
2. Observe the Phase Progress, Quality, and Reviews metric cards
   Expected: All metric counts reflect the live state of the project — tasks/stories/bugs/tests/coverage derived from the authoritative sources (RELEASE_PLAN.md, BUGS.md, coverage-summary.json)
   Actual: Tasks Done renders "4 / 0" because `tasksTotal` is never bumped off its init-time zero default; Stories Done counts only pipeline-fired stories (5/6) not the project's 125; Bugs Open/Fixed are both frozen at 0 despite 130+ bug entries; Tests Passed 1861 is a stale sticky value from an earlier session
   Status: Fixed
   Fix Branch: bugfix/BUG-0164-0166-dashboard-honesty
   Lesson Encoded: No
   Estimated Cost USD: 0.00
   Notes: Fixed in tools/generate-dashboard.js by deriving story/task/bug counts from docs/plan-status.json at render time (same source Plan Visualizer uses), and guarding all progress-bar denominators against zero to prevent the "4/0" display regression. Coverage is now derived from plan-status.coverage.statements. **Follow-up (EPIC-0017):** Tests Passed / Tests Total still read from the stale sdlc-status.json `metrics` fields because no jest-summary file is persisted in the repo. Proper fix requires either (a) writing a jest test-summary file into docs/coverage/ during CI and reading it here, or (b) resetting testsPassed at cycle boundary when EPIC-0019's cycle-history lands. Phases Complete / Reviews Approved are left as-is (they reflect current-run pipeline state, not project totals) and should also be reset per cycle.

BUG-0167: Plan Visualizer Bugs tab column view is default-expanded, not collapsed
Severity: Low
Related Story: n/a
Steps to Reproduce:

1. Open docs/plan-status.html
2. Click the Bugs tab (Column view)
   Expected: Epic groups are default-collapsed (arrow ▶), matching the Hierarchy tab convention documented in MEMORY.md
   Actual: Groups are default-expanded (arrow ▼) and every bug row renders, making the list very long
   Status: Fixed
   Fix Branch: bugfix/dashboard-polish-round-2
   Lesson Encoded: No
   Estimated Cost USD: 0.00
   Notes: Fixed in tools/lib/render-html.js renderBugsTab column view — arrow template changed from &#9660; to &#9654; and the bug-rows tbody now gets `class="hidden"` by default. Card view was already default-collapsed; this aligns the two views.

---

BUG-0168: Plan Visualizer Bugs tab card view uses mb-6 instead of Hierarchy's mb-2 spacing
Severity: Low
Related Story: n/a
Steps to Reproduce:

1. Open docs/plan-status.html
2. Switch the Bugs tab to Card view
3. Compare vertical spacing between epic groups to the Hierarchy tab
   Expected: Same tight spacing (mb-2) between epic groupings across Hierarchy, Bugs, and Costs
   Actual: Bugs card view uses mb-6, producing ~3x wider vertical gaps than Hierarchy
   Status: Fixed
   Fix Branch: bugfix/dashboard-polish-round-2
   Lesson Encoded: No
   Estimated Cost USD: 0.00
   Notes: Single mb-6 → mb-2 on the bug-epic-card wrapper in tools/lib/render-html.js renderBugsTab card view.

---

BUG-0169: Cost Breakdown chart is not vertically centered in its panel
Severity: Low
Related Story: n/a
Steps to Reproduce:

1. Open docs/plan-status.html
2. Click the Charts tab
3. Observe the Cost Breakdown (Projected vs AI) card in the first row of the 2-column grid
   Expected: The chart sits vertically centered within the card's render height
   Actual: Chart is pinned to the top of the card with empty space below, because the sibling Epic Progress card is forced to ~648px (18 epics × 36px), and the grid equal-height layout stretches Cost Breakdown to match while its canvas is fixed at 300px
   Status: Fixed
   Fix Branch: bugfix/dashboard-polish-round-2
   Lesson Encoded: No
   Estimated Cost USD: 0.00
   Notes: Fixed in tools/lib/render-html.js by making the Cost Breakdown card a flex column (`flex flex-col`) and wrapping the 300px-tall canvas in a `flex-1 flex items-center justify-center` parent so the chart centers vertically regardless of how much extra height the grid row imposes. Other similarly-sized chart cards (Test Coverage, AI Cost Timeline, etc.) retain their existing layout for now — extend the pattern if further centering issues surface.

BUG-0170: `chore/version-bump-*` branches are not auto-deleted after PR merge
Severity: Low
Related Story: n/a
Steps to Reproduce:

1. Merge any PR to develop (triggers .github/workflows/version-bump.yml)
2. The workflow creates `chore/version-bump-<sha>`, opens a PR, auto-merges with `gh pr merge --squash --auto`
3. Inspect remote branches: `git branch -r | grep version-bump`
   Expected: branch deleted after the auto-merge completes
   Actual: branch persists on origin; 25+ orphan version-bump branches accumulate after a typical epic (one per develop-advance)
   Status: Fixed
   Fix Branch: chore/branch-cleanup-tooling
   Lesson Encoded: Yes — see docs/LESSONS.md
   Estimated Cost USD: 0.00
   Notes: Fixed by adding `--delete-branch` to the `gh pr merge` invocation in .github/workflows/version-bump.yml line 44. `gh pr merge --squash --auto --delete-branch`.

---

BUG-0171: Agent worktrees under `.claude/worktrees/agent-*` are not cleaned up after feature-branch PR merges
Severity: Medium
Related Story: n/a
Steps to Reproduce:

1. Run a multi-story epic through the DM_AGENT pipeline, spawning Pixel/Lens/Sentinel/Circuit with `isolation: "worktree"` per story
2. Let each story's PR merge via `gh pr merge --auto --squash --delete-branch`
3. Inspect worktrees: `git worktree list` and `ls .claude/worktrees/`
   Expected: worktrees removed after each story merges; only the main repo worktree remains
   Actual: every agent-spawn worktree persists until manually removed; 14-story epic leaves 16+ worktrees (Pixel retries leave extras)
   Status: Fixed
   Fix Branch: chore/branch-cleanup-tooling
   Lesson Encoded: Yes — see docs/LESSONS.md
   Estimated Cost USD: 0.00
   Notes: Fixed by (a) strengthening the "Post-merge — sync main repo" section of docs/agents/DM_AGENT.md with a "why this step is mandatory" rationale and (b) shipping scripts/cleanup-branches.sh as a safety-net sweep (npm run cleanup:branches) for end-of-epic cleanup. Root cause: gh pr merge --delete-branch deletes the REMOTE branch but can't delete the LOCAL branch while a worktree holds the ref — the worktree must be removed first.

---

BUG-0172: Squash-merged feature branches leave local refs that `git branch -d` refuses to delete
Severity: Low
Related Story: n/a
Steps to Reproduce:

1. Squash-merge a feature branch into develop via a PR
2. On the local repo where the feature branch exists, run `git branch -d feature/US-XXXX-name`
   Expected: local branch is deleted (it's merged upstream)
   Actual: git refuses because the branch's tip is not an ancestor of develop (squash created a NEW commit with a different SHA)
   Status: Fixed
   Fix Branch: chore/branch-cleanup-tooling
   Lesson Encoded: Yes — see docs/LESSONS.md
   Estimated Cost USD: 0.00
   Notes: Fixed in scripts/cleanup-branches.sh step 4 — force-delete with -D after verifying the PR is MERGED on origin. Safe because the PR is the authoritative record; the local ref is just a stale pointer at the original (pre-squash) tip.

BUG-0173: `scripts/cleanup-branches.sh` step 5 raced the version-bump workflow and closed its auto-merge PR
Severity: Medium
Related Story: n/a
Steps to Reproduce:

1. Run `npm run cleanup:branches` (or the script directly) while a `chore/version-bump-*` PR is OPEN (not yet merged)
2. Script step 5 unconditionally deletes every `chore/version-bump-*` remote branch
3. Deleting the branch while its PR is still open closes the PR without merging
   Expected: only orphan version-bump branches (no PR or PR already MERGED/CLOSED) are deleted; open auto-merge PRs are left alone to complete
   Actual: PR #341 was auto-created by the version-bump workflow after PR #340 merged, my cleanup script ran seconds later and deleted the branch, PR #341 closed without merging, version bump was skipped
   Status: Fixed
   Fix Branch: chore/cleanup-script-pr-gate
   Lesson Encoded: Yes — see docs/LESSONS.md
   Estimated Cost USD: 0.00
   Notes: Fixed by gating step 5 on PR state via `gh pr list --state all --head <branch> --json state` exactly like step 6 already did. Delete only when state is MERGED, CLOSED, or NO_PR. Skip when state is OPEN. Self-inflicted wound from trusting "version-bump branches are always safe to nuke" — they're safe only when the auto-merge has completed. Added a manual `npm version patch` to this commit to compensate for the missed 1.0.208 version.

BUG-0174: `scripts/install.sh` does not propagate branch hygiene tooling to target projects
Severity: Low
Related Story: n/a
Steps to Reproduce:

1. Run `bash scripts/install.sh` in a fresh target project
2. Inspect the target project's `scripts/` directory
3. Inspect the target project's `package.json` scripts
   Expected: `scripts/cleanup-branches.sh` is present and `plan:cleanup` / `plan:cleanup:dry` npm scripts are registered, matching what PlanVisualizer itself ships with
   Actual: only `tools/`, `tests/`, `jest.config.js`, `eslint.config.js`, `plan_visualizer.md`, and the Pages workflow get copied. Branch hygiene tooling stays behind — target projects running DM_AGENT pipelines accumulate 50+ stale refs per epic with no bundled sweep command.
   Status: Fixed
   Fix Branch: chore/install-cleanup-tooling-propagation
   Lesson Encoded: Yes — see docs/LESSONS.md
   Estimated Cost USD: 0.00
   Notes: Fixed by (a) adding a `scripts/cleanup-branches.sh` copy step (new § 1.5) to `scripts/install.sh` so installed/upgraded projects get the branch hygiene tooling, (b) extending the npm-scripts merge in § 3 to register `plan:cleanup` and `plan:cleanup:dry`, and (c) documenting the commands + upgrade path in README.md ("Branch hygiene" subsection under Usage, `What gets overwritten on update` list in the Updating section). Re-running `scripts/install.sh` (idempotent) upgrades existing installs in place.

BUG-0175: PlanVisualizer has no config schema migrator for upgrades — target projects with older `plan-visualizer.config.json` or `agents.config.json` silently miss fields the latest tools expect
Severity: Medium
Related Story: n/a
Steps to Reproduce:

1. Install PlanVisualizer into a project at version v1.0.200 (pre-US-0113 and pre-`docs.lessons`)
2. Upgrade by re-running `scripts/install.sh` from the latest PlanVisualizer repo
3. Generate the dashboard: `npm run plan:generate`
   Expected: lessons tab renders; agent portraits resolve to optimized PNGs via the `avatar` key per agent
   Actual: `config.docs.lessons` is undefined so `parseLessons` throws or returns empty; agent cards fall back to headshots because `agents.<name>.avatar` is missing from the existing config; user has no automated way to know which fields to add
   Status: Fixed
   Fix Branch: chore/config-schema-migration
   Lesson Encoded: Yes — see docs/LESSONS.md
   Estimated Cost USD: 0.00
   Notes: Shipped `tools/migrate-config.js` — an idempotent schema migrator that adds missing required fields (currently `docs.lessons` and `agents.<name>.avatar`) to existing configs while preserving every user value. Invoked automatically from `scripts/install.sh` step 4.5 in `--auto` mode (silent unless it actually migrates something). Also exposed as `npm run plan:migrate-config` / `plan:migrate-config:dry` for explicit user invocation. Updated `plan-visualizer.config.example.json` and `agents.config.example.json` so future first-time installs start on the current schema without needing migration. 10 unit tests in `tests/unit/migrate-config.test.js` cover the ensureKey primitive, happy-path migrations, idempotency, missing-file fallbacks, invalid-JSON graceful skip, and user-value preservation.

BUG-0176: Kanban column headers allegedly show no gradient background or 2px accent border
Severity: Low
Related Story: US-0101
Steps to Reproduce:

1. Generate dashboard and inspect Kanban tab at small viewport
2. Check column header styling
   Expected: Headers show gradient background and 2px accent border-bottom
   Actual: QA screenshot appeared to show plain headers
   Status: Retired
   Fix Branch: feature/US-0101-kanban-polish
   Lesson Encoded: No
   Estimated Cost USD: 0.00
   Notes: Retired: CSS/HTML confirmed present; screenshot resolution artifact. `.ksw-status-cell` CSS rule contains `linear-gradient` and `border-bottom: 2px solid` in generated HTML.

BUG-0177: Kanban story cards allegedly show no P0/P1 priority left stripe
Severity: Low
Related Story: US-0101
Steps to Reproduce:

1. Generate dashboard and inspect Kanban tab cards at small viewport
2. Check priority stripe styling on P0/P1 cards
   Expected: P0 cards show danger-color left stripe; P1 show warn-color left stripe
   Actual: QA screenshot appeared to show cards without color stripes
   Status: Retired
   Fix Branch: feature/US-0101-kanban-polish
   Lesson Encoded: No
   Estimated Cost USD: 0.00
   Notes: Retired: CSS/HTML confirmed present; screenshot resolution artifact. Card elements have `border-left:3px solid var(--badge-danger-text,#dc2626)` inline styles for P0/P1 in generated HTML.

BUG-0178: Kanban WIP count allegedly shows no colored pill styling
Severity: Low
Related Story: US-0101
Steps to Reproduce:

1. Generate dashboard and inspect Kanban column header WIP count at small viewport
2. Check WIP count element styling
   Expected: WIP count shows as a styled colored pill element
   Actual: QA screenshot appeared to show plain text WIP count
   Status: Retired
   Fix Branch: feature/US-0101-kanban-polish
   Lesson Encoded: No
   Estimated Cost USD: 0.00
   Notes: Retired: CSS/HTML confirmed present; screenshot resolution artifact. `.wip-pill` CSS class and `<span class="wip-pill...">` elements are present in generated HTML.

BUG-0179: Status tab missing "Financial" section grouping — only "Delivery" section rendered
Severity: Medium
Status: Retired
Related Story: US-0103
Fix Branch:
Description: Expected two named section groupings on the Status tab — "Delivery" (epic progress + test results charts) and "Financial" (budget/cost charts) — per the US-0103 AC. Observed in charts-light.png and charts-dark.png: only the "DELIVERY" section heading is visible with the epic progress bars and doughnut chart. No "FINANCIAL" section heading or financial charts (budget by epic, AI cost) appear in the viewport. The section may be absent from the rendered output or not reached by the screenshot viewport.
Retired: Financial section confirmed present in HTML (grep returns 11 matches for "Financial" in plan-status.html); screenshot viewport limitation only.

BUG-0180: Bugs tab table view renders no bug rows despite 142 bugs counted in header
Severity: Low
Related Story: US-0106
Steps to Reproduce:

1. Open plan-status.html → Bugs tab → Column view
2. Observe bug rows in the table body
   Expected: Bug rows are visible in the table with epic header rows showing even in collapsed state
   Actual: QA screenshot appeared to show no bug rows rendered (report from Sentinel QA pass)
   Root Cause: False positive. Bugs tab defaults to collapsed epic sections — bug rows are hidden behind collapsed accordions until user expands an epic. The bug-epic-header rows (57) and bug-row elements (291) are confirmed present in the generated HTML. This is the intended UX, not a rendering failure.
   Status: Retired
   Fix Branch:
   Lesson Encoded: No
   Estimated Cost USD: 0.00
   Notes: Retired: Bug rows confirmed present in HTML (57 epic headers, 291 bug rows); default collapsed epic sections are by design — not a rendering failure. Investigated in US-0106 closure.

---

BUG-0181: DM_AGENT post-merge step missing RELEASE_PLAN.md story status write-back
Severity: Medium
Related Story: US-0126
Steps to Reproduce:

1. Run any story through the DM_AGENT canonical pipeline (Pixel → Lens → Sentinel → Circuit → PR merge)
2. After gh pr merge --auto --squash --delete-branch completes, inspect docs/RELEASE_PLAN.md
   Expected: Story block shows Status: Done with all ACs checked ([x])
   Actual: Story block still shows Status: Planned with all ACs unchecked ([ ]) — no agent in the pipeline writes back to RELEASE_PLAN.md after the PR merges
   Root Cause: The "Post-merge — sync main repo" section of DM_AGENT.md contains only 3 git commands (checkout develop, pull, worktree remove). There is no step instructing the Conductor to update the merged story's Status field and AC checkboxes in RELEASE_PLAN.md.
   Status: Fixed
   Fix Branch: chore/session-20-close
   Lesson Encoded: No
   Estimated Cost USD: 0.00
   Notes: Fixed by adding explicit Conductor step 4 in the "Post-merge — sync main repo" section of docs/agents/DM_AGENT.md: after pulling develop, open RELEASE_PLAN.md and change Status: Planned → Status: Done and all [ ] ACs → [x] for the merged story. This is the authoritative write-back that per-story PRs cannot do (agents only write code, not doc status).

---

BUG-0182: Session close checklist missing per-story RELEASE_PLAN.md audit
Severity: Low
Related Story: US-0126
Steps to Reproduce:

1. Complete an epic (all story PRs merged to develop)
2. Execute the session close checklist (CLAUDE.md "Session Close Checklist")
   Expected: Checklist includes a step to verify all merged stories show Status: Done in RELEASE_PLAN.md
   Actual: Checklist covers progress.md, MEMORY.md, PROMPT_LOG.md, MIGRATION_LOG.md, LESSONS.md, and coverage — but has no step to audit RELEASE_PLAN.md story statuses against merged PRs. The EPIC-0016 session close (PR #338) updated the epic-level Status: Complete but all 13 story blocks remained Planned.
   Root Cause: The session close procedure was designed before the PR-based merge workflow (adopted 2026-04-14). It predates the pattern where per-story PRs ship code without updating the RELEASE_PLAN.md markdown.
   Status: Fixed
   Fix Branch: chore/session-20-close
   Lesson Encoded: No
   Estimated Cost USD: 0.00
   Notes: Fixed by adding a RELEASE_PLAN.md audit step to the Session Close Checklist in CLAUDE.md: "Verify all stories shipped this session show Status: Done and have all ACs checked in docs/RELEASE_PLAN.md."
