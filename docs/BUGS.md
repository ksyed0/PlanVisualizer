# BUGS.md — Bug Register

Append-only defect log. Never delete entries. Mark resolved bugs as Fixed or Closed.

---

BUG-0183: Plan-Status Status tab is sparse — lacks release-health summary and forecast
Severity: Low
Related Story: US-0135 (EPIC-0020)
Steps to Reproduce:

1. Open docs/plan-status.html → Status tab
   Expected: A single-glance answer to "is the release on track?" with forecast, velocity, and top risks
   Actual: The tab leans on stat tiles and the Charts-style doughnut without an editorial hero summary; users have to visit 3+ tabs to infer health
   Status: Open
   Notes: Tracked as visual/IA change under EPIC-0020 (CD-Redesign). See US-0135 Status Hero card.

---

BUG-0184: Chart palette drifts between Status, Charts and Trends tabs
Severity: Low
Related Story: US-0140 (EPIC-0020)
Steps to Reproduce:

1. Open Status → doughnut (green/grey)
2. Open Charts → Epic progress bars (chart.js default green/amber)
3. Open Trends → Coverage line (blue)
   Expected: All charts share a single semantic palette (ok/warn/risk/info/accent) so the same color always means the same thing
   Actual: Each tab uses a different legend and fill palette; "Done" is several different greens across tabs
   Status: Open
   Notes: Fix by routing every chart through a shared palette token map (see AC in US-0140).

---

BUG-0185: Active agents are hard to pick out on the Agentic dashboard at a glance
Severity: Medium
Related Story: US-0142 (EPIC-0020)
Steps to Reproduce:

1. Open docs/dashboard.html with 2–4 active agents
2. Glance at the agent grid
   Expected: A 2-second glance identifies who is currently working
   Actual: All 9 agent cards carry the same visual weight; status pill is small, and the "now on air" dot is subtle; the currently-executing agent is not visually promoted
   Status: Open
   Notes: Fix by adding a left accent rail, tinted background, and outline glow on is-active cards; see US-0142.

---

BUG-0186: Conductor rarely shown as Active because dispatches complete in milliseconds
Severity: Medium
Related Story: US-0143 (EPIC-0020)
Steps to Reproduce:

1. Watch docs/dashboard.html during a live dispatch cycle
2. Observe the Conductor agent card
   Expected: Conductor's role in each hand-off is visible (it did just dispatch a task)
   Actual: Conductor transitions to active and back to idle faster than the 1s refresh can render, so the card is near-permanently idle and hand-offs appear to happen by magic
   Status: Open
   Notes: Fix by holding a visible "dispatching" state for a minimum of N seconds, and by promoting the most recent dispatch into the event ticker. See US-0143.

---

BUG-0187: Timeline pipeline and agent roster encode overlapping information
Severity: Low
Related Story: US-0144 (EPIC-0020)
Steps to Reproduce:

1. Open docs/dashboard.html
2. Compare the 6-phase Pipeline strip and the Agent Roster
   Expected: Each widget earns its space — pipeline shows macro phase progress, roster shows micro agent state
   Actual: Both widgets double-encode which agent is doing what right now (phase.agents field duplicates the active agent card); the pipeline loses its job as a cycle-progress artifact
   Status: Open
   Notes: Fix by trimming the pipeline to phase name + elapsed + partial fill, and letting the roster own "who is doing what." See US-0144.

---

BUG-0188: Activity events are buried in the right rail on the Agentic dashboard
Severity: Low
Related Story: US-0145 (EPIC-0020)
Steps to Reproduce:

1. Open docs/dashboard.html
2. Look for a chronological log of what the agents just did
   Expected: Event log is one of the most prominent artefacts on a mission-control surface
   Actual: The "recent activity" pane is a 320px sidebar card with low contrast and no dedicated terminal-style event stream
   Status: Open
   Notes: Fix by promoting the stream to a full-width Event Log card in the main column with terminal monospace styling, while keeping a compressed feed in the rail. See US-0145.

---

BUG-0189: Corporate navy gradient header is the dominant visual element on both dashboards
Severity: Low
Related Story: US-0136 (EPIC-0020)
Steps to Reproduce:

1. Open either dashboard
2. Observe the first ~72px of page chrome
   Expected: Chrome is quiet; content leads
   Actual: Saturated navy gradient overpowers content — especially in light mode — and makes the two dashboards hard to distinguish because the header dominates identity
   Status: Open
   Notes: Fix by replacing with a thin neutral chrome + mode badge (REPORT / LIVE) and per-dashboard accent ornaments. See US-0136.

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
   Status: Rejected
   Fix Branch: bugfix/BUG-0007-0011-parser-fixes
   Lesson Encoded: No
   Estimated Cost USD: 0.25
   Notes: Rejected as false positive — progress.md is written newest-first by convention; no parser change needed. Regression test added to confirm ordering.

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

---

BUG-0190: Dark mode applies only to topbar/sidebar — body and content areas remain light
Severity: High
Related Story: US-0135 (EPIC-0020)
Steps to Reproduce:

1. Open plan-status.html in a browser with system dark mode preference OR click the moon icon
2. Observe the page appearance
   Expected: All surfaces (body background, panels, tab content, cards) switch to dark palette
   Actual: Only the topbar/sidebar update; the main content area stays white (uses --clr-_ tokens unresolved to any value)
   Root Cause: Two compounding defects: (1) EPIC-0020 replaced --clr-_ CSS variable names with new OKLCH tokens (--bg, --text, --surface, --border, etc.) but left all CSS consumers still referencing the old --clr-_ names, so those resolved to empty strings. (2) Tailwind darkMode:'class' requires a .dark class on <html>, but setTheme() only set data-theme attribute — making all dark:_ Tailwind variants no-ops.
   Status: Fixed
   Fix Branch: bugfix/BUG-0190-0197-ui-fixes
   Lesson Encoded: No
   Estimated Cost USD: 0.00
   Notes: Fixed by: (a) Adding --clr-\* backward-compat alias variables in generateCssTokens() in theme.js, mapping each old token to its new OKLCH equivalent in both [data-theme="light"] and [data-theme="dark"] blocks; (b) Adding classList.toggle('dark', t==='dark') in setTheme() in render-scripts.js; (c) Adding classList.add('dark') in the inline theme-init script in render-html.js.

---

BUG-0191: Blank white area (52px) appears at top of page below topbar
Severity: Medium
Related Story: US-0135 (EPIC-0020)
Steps to Reproduce:

1. Open plan-status.html in any browser
2. Observe the space between the topbar and the first content element
   Expected: Content starts immediately below the sticky topbar with no gap
   Actual: A blank 52px white strip appears between the topbar and content, caused by stale body { padding-top: 52px } left over from when .pv-chrome was position:fixed
   Root Cause: EPIC-0020 changed .pv-chrome from position:fixed to position:sticky (in-flow layout), eliminating the need for body padding-top offset. The padding rule was not removed during the migration.
   Status: Fixed
   Fix Branch: bugfix/BUG-0190-0197-ui-fixes
   Lesson Encoded: No
   Estimated Cost USD: 0.00
   Notes: Fixed by changing body { padding-top: 52px } to body { padding-top: 0 } in the embedded CSS block in render-html.js and removing redundant responsive padding-top overrides.

---

BUG-0192: Story title wraps instead of truncating with ellipsis in hierarchy column view
Severity: Medium
Related Story: US-0131 (EPIC-0019)
Steps to Reproduce:

1. Open plan-status.html → Hierarchy tab → Column view
2. Find any story with a long title (e.g., "Implement cross-tab filter persistence and deep-link support")
3. Observe the story row
   Expected: Title truncates at available width with trailing ellipsis; badge labels appear at line end on a single row
   Actual: The full title wraps onto multiple lines, pushing labels to a new line and misaligning the row with its fixed-width sibling columns
   Root Cause: Row container used flex flex-wrap allowing unconstrained width; title element lacked min-w-0 + truncate constraints; status/ID columns lacked min-width floor; labels lacked ml-auto + flex-shrink-0 anchoring.
   Status: Fixed
   Fix Branch: bugfix/BUG-0190-0197-ui-fixes
   Lesson Encoded: No
   Estimated Cost USD: 0.00
   Notes: Fixed in render-tabs.js story row template: changed wrapper to flex items-center gap-2 min-w-0, added flex-shrink-0 on ID/status/epic columns, added min-width:5.5rem floor on ID/status, applied min-w-0 truncate with title attribute on the story title span, and ml-auto flex-shrink-0 on the right-side labels group.

---

BUG-0193: Global search (⌘K) button missing from page header
Severity: Medium
Related Story: US-0131 (EPIC-0019)
Steps to Reproduce:

1. Open plan-status.html
2. Look at the top-right area of the header/topbar
   Expected: A search button (⌘K keyboard shortcut affordance) is visible between the mode badge and the About button
   Actual: No search button rendered; the searchBox element exists in DOM but has no visible trigger in the masthead
   Root Cause: renderChrome() in render-shell.js never included the ⌘K trigger button in the masthead markup; it was designed but omitted during the EPIC-0020 shell refactor.
   Status: Fixed
   Fix Branch: bugfix/BUG-0190-0197-ui-fixes
   Lesson Encoded: No
   Estimated Cost USD: 0.00
   Notes: Fixed by adding a <button id="searchBtn"> with ⌘K label and SVG icon between the mode badge and About button in renderChrome() in render-shell.js.

---

BUG-0194: Card view epic headers disappear when any filter is applied
Severity: High
Related Story: US-0106 (EPIC-0015)
Steps to Reproduce:

1. Open plan-status.html → Hierarchy tab → Card view
2. Apply any filter (e.g., status = "In Progress")
3. Observe epic section headers
   Expected: Epic headers remain visible; only story cards outside the filter are hidden
   Actual: All epic headers vanish — the entire card view becomes an empty page with only matching story cards and no grouping headers
   Root Cause: applyFilters() scoped story-row searches via block.closest('.mb-8') to find the ancestor epic wrapper. Card view wrappers used class mb-4 (not mb-8), so closest('.mb-8') returned null for every story — the filter logic resolved to a scope of 0 rows per header, hiding every epic section.
   Status: Fixed
   Fix Branch: bugfix/BUG-0190-0197-ui-fixes
   Lesson Encoded: No
   Estimated Cost USD: 0.00
   Notes: Fixed by changing the card view epic wrapper class from mb-4 to mb-8 in the renderHierarchyCardView template in render-tabs.js, matching the class applyFilters() expects.

---

BUG-0195: Estimated project cost missing from page masthead
Severity: Low
Related Story: US-0135 (EPIC-0020)
Steps to Reproduce:

1. Open plan-status.html
2. Inspect the metadata row in the masthead (below the project name/tagline)
   Expected: A meta tile labelled "Est. budget" shows the total projected USD cost derived from t-shirt sizing
   Actual: The meta row shows Stories, Open Bugs, Coverage, and Last Updated — but no cost figure
   Root Cause: renderMasthead() in render-shell.js did not compute or render a budget meta tile; the feature was specified in US-0135 ACs but omitted during EPIC-0020 implementation.
   Status: Fixed
   Fix Branch: bugfix/BUG-0190-0197-ui-fixes
   Lesson Encoded: No
   Estimated Cost USD: 0.00
   Notes: Fixed by computing totalProjected (sum of data.costs[st.id].projectedUsd across active stories) in renderMasthead() and adding a pv-meta-item tile with pv-meta-item--hide-sm class to keep it off small viewports.

---

BUG-0196: Status badge column too narrow — "In Progress" and "Planned" text overflows into title column
Severity: Medium
Related Story: US-0131 (EPIC-0019)
Steps to Reproduce:

1. Open plan-status.html → Hierarchy tab → Column view
2. Scroll to any story with status "In Progress" or "Planned"
3. Observe alignment relative to stories with shorter statuses like "Done"
   Expected: All status badges align in a fixed-width column; title column begins at the same x-position for every row
   Actual: "In Progress" text overflows the status column and pushes the story title to the right (or causes wrap); "Planned" likewise overflows
   Root Cause: Status span had no min-width floor — it shrank to fit "Done" and then overflowed for longer strings. Combined with BUG-0192 flex-wrap issue, rows were visually misaligned.
   Status: Fixed
   Fix Branch: bugfix/BUG-0190-0197-ui-fixes
   Lesson Encoded: No
   Estimated Cost USD: 0.00
   Notes: Fixed as part of BUG-0192 row layout overhaul: added inline style min-width:5.5rem on the status badge span in render-tabs.js, ensuring all rows reserve the same floor width for the status column regardless of text length.

---

BUG-0197: Traceability tab legend text is invisible (white-on-white in light mode)
Severity: Medium
Related Story: US-0131 (EPIC-0019)
Steps to Reproduce:

1. Open plan-status.html → Traceability tab → Light mode
2. Observe the legend at the bottom of the SVG canvas
   Expected: Legend labels (e.g., "Story", "Test Case", "Bug") are readable in a dark-on-light colour
   Actual: Legend text renders in white (CSS class trace-caption used rgba(255,255,255,0.5) as its fallback colour) and is invisible against the white panel background
   Root Cause: render-scripts.js set .trace-caption colour fallback to rgba(255,255,255,0.5) — visible only in dark mode. The EPIC-0020 token migration broke the light-mode value; --clr-text-secondary was unresolved (see BUG-0190 root cause).
   Status: Fixed
   Fix Branch: bugfix/BUG-0190-0197-ui-fixes
   Lesson Encoded: No
   Estimated Cost USD: 0.00
   Notes: Fixed by changing the .trace-caption fallback colour in render-scripts.js from rgba(255,255,255,0.5) to #64748b (slate-500), which is readable in both light and dark modes as a secondary text tone.

---

BUG-0198: Trends tab date-range selector button text is invisible
Severity: Medium
Related Story: US-0131 (EPIC-0019)
Steps to Reproduce:

1. Open plan-status.html → Trends tab
2. Observe the date-range selector buttons (4W / 8W / 12W / All)
   Expected: Button labels are clearly readable; selected range button has a highlighted background
   Actual: Button text is invisible (white text on white/near-white background); unselected state offers no contrast
   Root Cause: Range button styles relied on --clr-text-primary which was unresolved due to the BUG-0190 EPIC-0020 token migration gap. The active-range class also lost its background reference.
   Status: Fixed
   Fix Branch: bugfix/BUG-0190-0197-ui-fixes
   Lesson Encoded: No
   Estimated Cost USD: 0.00
   Notes: Fixed as a side effect of BUG-0190 --clr-\* alias restoration in theme.js. The --clr-text-primary alias maps to var(--text) in both themes, resolving button text colour. No separate CSS change was required.

---

BUG-0199: Bugs section on Costs tab expanded by default — should be collapsed like Stories
Severity: Low
Related Story: US-0116 (EPIC-0016)
Steps to Reproduce:

1. Open plan-status.html → Costs tab
2. Observe the Bug Fix Costs section
   Expected: Bug Fix Costs section is collapsed by default, consistent with the Stories section; user clicks to expand
   Actual: Bug Fix Costs section is fully expanded on page load, adding excessive scroll depth to the Costs tab
   Root Cause: The bug-fix cost section markup had no collapsible wrapper or toggleSection() handler — it was rendered as an always-visible block, inconsistent with the collapsible-by-default pattern used for the Stories section.
   Status: Fixed
   Fix Branch: bugfix/BUG-0190-0197-ui-fixes
   Lesson Encoded: No
   Estimated Cost USD: 0.00
   Notes: Fixed by wrapping the bug fix column and card sections in a collapsible panel with a toggleSection() handler in render-tabs.js. The section body element has the hidden class set by default, matching the collapsed-by-default behaviour of the Stories section.

---

BUG-0200: Long bug status text (e.g., "Fixed (false positive…)") breaks Costs tab column layout
Severity: Medium
Related Story: US-0116 (EPIC-0016)
Steps to Reproduce:

1. Open plan-status.html → Costs tab → Bug Fix Costs section
2. Find bug BUG-0011 (or any bug with a parenthetical explanation in its Status field)
   Expected: Status cell shows a short badge keyword ("Fixed", "Rejected", etc.); full explanation is accessible via tooltip/title
   Actual: The entire status string including the parenthetical explanation renders in the badge, expanding the status column to 300px+ and misaligning all other rows
   Root Cause: badge() is called with the full status string including parenthetical suffixes. BUGS.md allows freeform status fields (e.g., "Fixed (false positive — …)").
   Status: Fixed
   Fix Branch: bugfix/BUG-0190-0197-ui-fixes
   Lesson Encoded: No
   Estimated Cost USD: 0.00
   Notes: Fixed in two parts: (1) BUG-0011 in docs/BUGS.md was updated — status changed to "Rejected" with a Notes: field containing the full explanation, removing the inline parenthetical from the status string. (2) All badge(bug.status) calls in render-tabs.js now use badge((bug.status||'').split(/[\s(]/)[0]) with a title attribute carrying the full status text for accessibility/tooltip display.

---

BUG-0201: Status tab (release-health hero, decision widgets, epic progress) never implemented despite EPIC-0020 being marked Done
Severity: Critical
Related Story: US-0135 (EPIC-0020)
Steps to Reproduce:

1. Open plan-status.html → Status tab (first nav item)
2. Compare against the EPIC-0020 design mockup / US-0135 ACs
   Expected: Release health editorial landing page with: verdict hero card (On track / At risk / Off track), forecast/velocity/budget stats, 14-week progress mini-bars, 30-day coverage sparkline, decision-widgets grid (Overall Progress, Epic Progress, Top Risks), quality/snapshot row
   Actual: The Status tab renders only a minimal placeholder — no hero, no charts, no decision widgets, no quality section. The tab was entirely absent from the render-tabs.js module.
   Root Cause: EPIC-0020 (PR #412) marked all US-0135–US-0146 stories as Done but the renderStatusTab() function was never written. The tab section in the HTML output contained no content. The gap was not caught by CI because no acceptance tests asserted on Status tab content rendering.
   Status: Fixed
   Fix Branch: bugfix/BUG-0190-0197-ui-fixes
   Lesson Encoded: No
   Estimated Cost USD: 0.00
   Notes: Fixed by implementing renderStatusTab(data) in render-tabs.js with the full US-0135/US-0139 scope: verdict computation from open bugs/blocked stories/budget, Release Health Hero card, 14-week progress mini-bars from trends data, 30-day coverage dots from coverage history, Decision Widgets grid (Overall Progress, Epic Progress, Top Risks cards), and Quality + Snapshot row. Function exported and called as first tab in render-html.js.

---

BUG-0202: Dark mode surface/background contrast too low — panels indistinguishable from page background
Severity: High
Related Story: US-0135 (EPIC-0020)
Steps to Reproduce:

1. Open plan-status.html in dark mode
2. Compare the page background colour to panel/card surface colours
   Expected: Cards and panels are visibly lighter than the page background — distinct layering
   Actual: --surface (ink9, oklch(10%)) sits only 4 percentage points above --bg (ink10, oklch(6%)) — imperceptible contrast at typical viewing distances; panels appear to float on an identical-tone background
   Root Cause: EPIC-0020 chose ink9/ink8 for dark surface/surface-2, producing ~1.2:1 contrast ratio between layers. Good dark-mode layering requires at least 1.4:1 per layer step.
   Status: Fixed
   Fix Branch: bugfix/BUG-0202-0208-ui-polish
   Lesson Encoded: No
   Estimated Cost USD: 0.00
   Notes: Fixed by bumping dark theme tokens in theme.js: --surface from ink9(10%) to ink8(16%), --surface-2 from ink8(16%) to ink7(24%), --border from oklch(22%) to oklch(28%). Gives ~1.45:1 contrast between bg and surface — visually distinct but still clearly dark.

---

BUG-0203: Plan-Status About modal is a narrow single-column card — doesn't match the wider two-column About design used on the agentic dashboard
Severity: Low
Related Story: US-0135 (EPIC-0020)
Steps to Reproduce:

1. Open plan-status.html → click the About button
2. Compare the modal to the agentic dashboard About modal
   Expected: Wide two-column modal with branding panel on left (icon, tool version, GitHub link) and project details on right (name, tagline, version, branch, build, generated-at)
   Actual: Narrow max-w-sm text-center single-column card with minimal project metadata — inconsistent with the unified About design implemented in the agentic dashboard (US-0123)
   Root Cause: render-html.js About modal was never updated to match the generate-dashboard.js two-column design adopted in US-0123.
   Status: Fixed
   Fix Branch: bugfix/BUG-0202-0208-ui-polish
   Lesson Encoded: No
   Estimated Cost USD: 0.00
   Notes: Fixed by rewriting the About modal in render-html.js to use a two-column sm:grid layout: left panel has branding icon + tool version + GitHub link; right panel has project name, tagline, version/branch/build rows, and generated-at. Max width bumped from max-w-sm to max-w-2xl.

---

BUG-0204: Top Risks widget shows "No active risks" when release health verdict is "At risk"
Severity: Medium
Related Story: US-0139 (EPIC-0020)
Steps to Reproduce:

1. Open plan-status.html → Status tab
2. Observe the Release Health hero (verdict "At risk") and the Top Risks decision widget
   Expected: Top Risks shows risk items consistent with the "At risk" verdict
   Actual: "No active risks — looking good 🎉" is displayed even though the verdict is "At risk" — completely contradictory
   Root Cause: The verdict's "At risk" condition triggers when openBugs.length > 3 even if all open bugs are Medium severity. The Top Risks widget only collects High/Critical bugs and blocked stories. When all open bugs are Medium-or-lower, the risks array is empty and the fallback message is displayed.
   Status: Fixed
   Fix Branch: bugfix/BUG-0202-0208-ui-polish
   Lesson Encoded: No
   Estimated Cost USD: 0.00
   Notes: Fixed in renderStatusTab() in render-tabs.js: after collecting criticalBugs/highBugs/blockedStories, if risks is still empty and hasRisk is true (i.e., openBugs.length > 3), add Medium-severity open bugs (up to 3) as MED risk items. If no Medium bugs either, add an aggregate "N open bugs require attention" item. This ensures the Top Risks widget is never empty when the verdict is At risk.

---

BUG-0205: Column / Card view toggle has no visual active-state — impossible to tell which view is selected
Severity: Medium
Related Story: US-0131 (EPIC-0019)
Steps to Reproduce:

1. Open plan-status.html → Hierarchy tab
2. Look at the Column / Card toggle buttons in the top-right of the tab
   Expected: The active view button is highlighted (filled background, contrasting text)
   Actual: Both buttons look identical — same border, same text, same background; no visual cue for active state
   Root Cause: setHierarchyView() applies classList.toggle('active-view', ...) correctly, but no CSS rule for button.active-view was ever defined — the class is toggled but has no visual effect.
   Status: Fixed
   Fix Branch: bugfix/BUG-0202-0208-ui-polish
   Lesson Encoded: No
   Estimated Cost USD: 0.00
   Notes: Fixed by adding button.active-view { background: var(--clr-accent) !important; color: #fff !important; border-color: var(--clr-accent) !important; } to the embedded CSS in render-scripts.js.

---

BUG-0206: Hierarchy tab epics all expanded by default — should start collapsed
Severity: Low
Related Story: US-0131 (EPIC-0019)
Steps to Reproduce:

1. Open plan-status.html → Hierarchy tab → Column view
2. Observe the epic sections on first load
   Expected: All epic sections are collapsed; user expands epics of interest
   Actual: Only Done-status epics auto-collapse; all active/in-progress epics are fully expanded, producing a very long page on initial load
   Root Cause: The DOMContentLoaded handler in render-scripts.js only collapsed epics matching [data-epic-status="Done"]. Active epics were intentionally left expanded by the original design but user preference is for all-collapsed.
   Status: Fixed
   Fix Branch: bugfix/BUG-0202-0208-ui-polish
   Lesson Encoded: No
   Estimated Cost USD: 0.00
   Notes: Fixed by extending the auto-collapse logic to target ALL epic-stories-_ and epic-cards-_ elements (not just Done ones) in the DOMContentLoaded handler in render-scripts.js.

---

BUG-0207: Epic section headers use inconsistent styling across tabs — Costs/Bugs lack the accent left-border used in Hierarchy
Severity: Low
Related Story: US-0131 (EPIC-0019)
Steps to Reproduce:

1. Open plan-status.html → Hierarchy tab. Note epic headers: accent left-border + EPIC / XXXX format
2. Open Costs tab (story section) and Costs tab (bug section). Note epic headers: only border-t-2, no accent border-left, no EPIC/XXXX format — visual inconsistency
   Expected: Epic headers across all tabs share the same accent left-border style and EPIC / XXXX ID format
   Actual: Hierarchy has 4px left-border accent + "EPIC / 0001" style; Costs and Bugs epic headers use only a top border and raw epic ID string — different look and feel
   Root Cause: The Costs and Bugs tab epic header tr elements were written before the Hierarchy unified epic header style was established.
   Status: Fixed
   Fix Branch: bugfix/BUG-0202-0208-ui-polish
   Lesson Encoded: No
   Estimated Cost USD: 0.00
   Notes: Fixed by adding border-left:4px solid ${accent.border} and the EPIC / XXXX format to the story-costs epic headers and bug-costs epic headers in render-tabs.js.

---

BUG-0208: Costs tab Per-Epic Budget table is flat — cannot expand an epic to see per-story cost breakdown
Severity: Medium
Related Story: US-0116 (EPIC-0016)
Steps to Reproduce:

1. Open plan-status.html → Costs tab → Per-Epic Budget section
2. Click on an epic row
   Expected: Epic row expands to reveal per-story rows (Story ID, title, estimate, projected cost, AI cost) — same expand pattern as the Bugs tab epic sections
   Actual: Epic rows are static table rows with no click handler and no expand behaviour; per-story data is only visible in the separate "Story Costs" section further down the page
   Root Cause: The Per-Epic Budget section was designed as a summary-only view. The expand/collapse pattern existed in the Story Costs section below but was never added to the budget summary table.
   Status: Fixed
   Fix Branch: bugfix/BUG-0202-0208-ui-polish
   Lesson Encoded: No
   Estimated Cost USD: 0.00
   Notes: Fixed by converting the Per-Epic Budget table from a flat tbody to a series of expandable tbody pairs (header row + hidden story sub-rows) using toggleSection(). Each epic header now expands to show per-story rows with Story ID, title, estimate, projected cost, and AI cost columns. Column headers updated to "Epic / Story", "Budget / Est.", "Spent / AI", "Remaining", "% Used" to reflect the dual-level data.

---

BUG-0209: Hierarchy tab — card view epic spacing wider than column view
Severity: Low
Related Story: US-0002 (EPIC-0002)
Steps to Reproduce:

1. Open plan-status.html → Hierarchy tab
2. Switch to Card view — note the gap between each epic group
3. Switch to Column view — gap is noticeably smaller
   Expected: Card and column views use the same vertical spacing between epic groups
   Actual: Card view wrapper used mb-4; column view used mb-2
   Root Cause: Card view template was written independently and never synced to column view spacing conventions.
   Status: Fixed
   Fix Branch: bugfix/BUG-0202-0208-ui-polish
   Lesson Encoded: No
   Estimated Cost USD: 0.00
   Notes: Changed mb-4 to mb-2 on the card view epic group wrapper div.

---

BUG-0210: Lessons tab — epic group headers don't match Bugs tab format
Severity: Low
Related Story: US-0107 (EPIC-0013)
Steps to Reproduce:

1. Open plan-status.html → Lessons tab (column or card view)
2. Observe the epic group headers: "EPIC-0003: Installation and Distribution (1)"
3. Compare to Bugs tab epic headers: "EPIC-0003 [Done] Installation and Distribution · N open · M total" with left accent bar
   Expected: Lessons epic headers use the same format as Bugs — EPIC-XXXX monospaced id + status badge + title + count, with border-left accent bar
   Actual: Lessons headers used a plain concatenated label string with no badge, no accent border, and old formatting
   Root Cause: Lessons tab was developed before the Bugs tab established the shared epic-header pattern; the pattern was never backported.
   Status: Fixed
   Fix Branch: bugfix/BUG-0202-0208-ui-polish
   Lesson Encoded: No
   Estimated Cost USD: 0.00
   Notes: Updated both lessonColGroups and lessonCardGroups to use the Bugs tab format: font-mono epic id + badge(epic.status) + title span + count, with border-left:4px solid ${accent.border} on the cell. Card view wrapper changed from mb-6 to mb-2 to match Bugs card view spacing.

---

BUG-0211: Status tab blank — no content renders below header stat row
Severity: High
Related Story: US-0135 (EPIC-0020)
Steps to Reproduce:

1. Open plan-status.html → Status tab
2. Observe main content area below "PLANVISUALIZER · Status REPORT" header is completely empty
   Expected: Status Hero card (verdict, density toggle, stat blocks, mini-viz) + Rich Status widgets render
   Actual: White blank area
   Status: Fixed
   Fix Branch: bugfix/BUG-0211-0226-dashboard-polish
   Lesson Encoded: No
   Estimated Cost USD: 0.00
   Notes: data.trends was extracted but never assigned to data object before JSON serialisation; fixed by adding data.trends = trends in generate-plan.js.

---

BUG-0212: Hierarchy tab — card view is blank
Severity: High
Related Story: US-0049 (EPIC-0006)
Steps to Reproduce:

1. Open plan-status.html → Hierarchy tab → switch to Card view
2. Observe no epic/story cards render
   Expected: Cards render with epic groupings and story cards
   Actual: Blank content area
   Status: Fixed
   Fix Branch: bugfix/BUG-0211-0226-dashboard-polish
   Lesson Encoded: No
   Estimated Cost USD: 0.00
   Notes: applyFilters used block.closest('.mb-8') — stale class after refactor. Fixed to .mb-2.

---

BUG-0213: Kanban tab — epic group headers missing Epic status label
Severity: Low
Related Story: US-0060 (EPIC-0007)
Steps to Reproduce:

1. Open plan-status.html → Kanban tab
2. Observe epic group headers
   Expected: Epic header includes status badge/label (Done, In Progress, Planned)
   Actual: No status label shown
   Status: Fixed
   Fix Branch: bugfix/BUG-0211-0226-dashboard-polish
   Lesson Encoded: No
   Estimated Cost USD: 0.00
   Notes: Added epicStatusMap + badge() call to Kanban swimlane header template.

---

BUG-0214: Epic header formatting inconsistent across tabs — should match Traceability tab style
Severity: Medium
Related Story: US-0049 (EPIC-0006)
Steps to Reproduce:

1. Compare epic group headers across Hierarchy, Kanban, Costs, Bugs, Lessons tabs
2. Compare to Traceability tab epic headers
   Expected: All tabs use same epic header format (monospaced EPIC-XXXX + status badge + title + count + left accent border)
   Actual: Each tab uses a different header style
   Status: Fixed
   Fix Branch: bugfix/BUG-0211-0226-dashboard-polish
   Lesson Encoded: No
   Estimated Cost USD: 0.00
   Notes: Kanban, Bugs card, and Lessons card views updated to use EPIC_ACCENT_COLORS with border-t-2 + border-left:4px accent style matching Traceability tab.

---

BUG-0215: Charts tab — L/M/S density toggle on "On Track" Status Hero bar has no effect
Severity: Medium
Related Story: US-0135 (EPIC-0020)
Steps to Reproduce:

1. Open plan-status.html → Charts/Status tab
2. Find the L/M/S density toggle on the hero "On Track" verdict section
3. Click L or S — layout does not change
   Expected: Hero card changes density (compact/medium/large)
   Actual: No visual change
   Status: Fixed
   Fix Branch: bugfix/BUG-0215-0222-dashboard-fixes
   Lesson Encoded: No
   Estimated Cost USD: 0.00
   Notes: No CSS rules consumed the data-density attribute. Added .pv-hero[data-density="M/S"] rules to render-scripts.js to hide vizrow at M/S and stats at S.

---

BUG-0216: Charts tab — Story Status Distribution chart does not scale to fill available width
Severity: Low
Related Story: US-0070 (EPIC-0010)
Steps to Reproduce:

1. Open plan-status.html → Charts tab
2. Observe Story Status Distribution doughnut chart
   Expected: Chart fills available column width responsively
   Actual: Chart renders at a fixed small size with large empty area around it
   Status: Fixed
   Fix Branch: bugfix/BUG-0215-0222-dashboard-fixes
   Lesson Encoded: No
   Estimated Cost USD: 0.00
   Notes: Container div was missing height:300px; Chart.js needs an explicit height on the container to size the canvas responsively.

---

BUG-0217: Costs tab — AI cost attribution incorrect (EPIC-0013 too high; EPIC-0016/0017/0020 show $0.00)
Severity: Medium
Related Story: US-0084 (EPIC-0008)
Steps to Reproduce:

1. Open plan-status.html → Costs tab
2. Expand EPIC-0016, EPIC-0017, EPIC-0020 — AI cost shows $0.00
3. Compare EPIC-0013 AI cost — appears inflated
   Expected: AI costs accurately attributed to epics via story branch matching
   Actual: Recent epics show $0; older epics may absorb costs that belong elsewhere
   Status: Open
   Fix Branch:
   Lesson Encoded: No
   Estimated Cost USD: 0.00
   Notes: Root cause — branch-name matching in parse-cost-log.js uses story branch prefix matching. Recent epics (0016/0017/0020) have branches whose prefixes aren't captured in the AI_COST_LOG.md session rows. Separate investigation needed.

---

BUG-0218: Costs tab — EPIC-0018 missing from epic cost breakdown
Severity: Medium
Related Story: US-0084 (EPIC-0008)
Steps to Reproduce:

1. Open plan-status.html → Costs tab
2. Scroll through epic list — EPIC-0018 is absent
   Expected: All epics including EPIC-0018 appear in the cost breakdown
   Actual: EPIC-0018 row is missing
   Status: Retired
   Fix Branch:
   Lesson Encoded: No
   Estimated Cost USD: 0.00
   Notes: Not a code bug. EPIC-0018 was never created — project numbering skips from EPIC-0017 to EPIC-0019. No row to display. Retiring as invalid.

---

BUG-0219: Status/Charts tab — Risk Score by Epic shows Done epics; should suppress them
Severity: Low
Related Story: US-0068 (EPIC-0010)
Steps to Reproduce:

1. Open plan-status.html → Charts or Status tab → Risk Score by Epic section
2. Observe Done epics appearing in the chart
   Expected: Only non-Done epics shown; a note states "Showing incomplete epics only"
   Actual: All epics including Done ones shown, cluttering the chart
   Status: Fixed
   Fix Branch: bugfix/BUG-0211-0226-dashboard-polish
   Lesson Encoded: No
   Estimated Cost USD: 0.00
   Notes: Added epicStatusMap filter — Risk Score chart now suppresses Done epics and renders a note "Showing incomplete epics only".

---

BUG-0220: Trends tab — Velocity chart ambiguous (cumulative vs per-session unclear); recent values appear inflated
Severity: Medium
Related Story: US-0055 (EPIC-0008)
Steps to Reproduce:

1. Open plan-status.html → Trends tab → Velocity chart
2. Observe Y-axis and recent data points — last few sessions show unusually high story counts
   Expected: Chart clearly labelled as "Stories Shipped per Session" with realistic values
   Actual: Axis label is ambiguous; recent sessions show values inconsistent with actual output
   Status: Fixed
   Fix Branch: bugfix/BUG-0215-0222-dashboard-fixes
   Lesson Encoded: No
   Estimated Cost USD: 0.00
   Notes: Velocity metric is cumulative (total done stories at each snapshot). Changed chart subtitle from "story points per session" to "cumulative done points".

---

BUG-0221: Trends tab — AI Costs and Token Usage charts show no change for recent sessions
Severity: Medium
Related Story: US-0055 (EPIC-0008)
Steps to Reproduce:

1. Open plan-status.html → Trends tab → AI Costs chart and Token Usage chart
2. Observe the last several sessions — values appear flat/unchanged
   Expected: Charts reflect actual AI spend and token counts per session
   Actual: Recent sessions show identical or zero values
   Status: Open
   Fix Branch:
   Lesson Encoded: No
   Estimated Cost USD: 0.00
   Notes: Architectural limitation — snapshot.js records cumulative AI_COST_LOG.md state at each progress.md snapshot. If new sessions don't generate new progress.md entries, no new snapshots are captured. Separate investigation needed to verify capture-cost.js is appending correctly.

---

BUG-0222: Costs tab — Budget section and Stories section use different epic header formatting
Severity: Low
Related Story: US-0084 (EPIC-0008)
Steps to Reproduce:

1. Open plan-status.html → Costs tab
2. Compare Budget epic group headers with Stories epic group headers
   Expected: Both sections use identical epic header format
   Actual: Budget and Stories use visually different header styles
   Status: Fixed
   Fix Branch: bugfix/BUG-0215-0222-dashboard-fixes
   Lesson Encoded: No
   Estimated Cost USD: 0.00
   Notes: Budget epic table rows now use accent.bg background and 4px accent left-border on the first td, matching the Stories section header style.

---

BUG-0223: Bugs tab — epic groups should be collapsed by default
Severity: Low
Related Story: US-0064 (EPIC-0007)
Steps to Reproduce:

1. Open plan-status.html → Bugs tab
2. Observe all epic groups are expanded on load
   Expected: All epic groups collapsed by default; user expands as needed
   Actual: All groups expanded, causing long scroll on first load
   Status: Open
   Fix Branch:
   Lesson Encoded: No
   Estimated Cost USD: 0.00
   Notes: Default collapsed state requires server-rendered hidden class on bug-group tbody + collapsed arrow state in markup. Deferred to a future polish story.

---

BUG-0224: Costs tab — Bug AI costs are identical across many bugs and do not match actual spend
Severity: Medium
Related Story: US-0084 (EPIC-0008)
Steps to Reproduce:

1. Open plan-status.html → Costs tab → expand any epic → view bug rows
2. Many bugs show identical AI cost values (e.g. $207.41); many show blank
   Expected: Each bug's AI cost attributed from sessions where it was fixed (via fix branch)
   Actual: Costs appear to be divided equally or mis-attributed
   Status: Open
   Fix Branch:
   Lesson Encoded: No
   Estimated Cost USD: 0.00
   Notes: Architectural limitation — attributeBugCosts() in compute-costs.js splits session cost equally across all bugs fixed in that session (identified by fix branch). True per-bug attribution would require sub-session timing data not available in AI_COST_LOG.md.

---

BUG-0225: Bugs tab compact view — bugs not sorted ascending by Bug ID by default
Severity: Low
Related Story: US-0064 (EPIC-0007)
Steps to Reproduce:

1. Open plan-status.html → Bugs tab → Compact view
2. Observe default sort order
   Expected: Bugs sorted ascending by BUG-XXXX ID by default
   Actual: Sort order is not ascending by ID
   Status: Fixed
   Fix Branch: bugfix/BUG-0211-0226-dashboard-polish
   Lesson Encoded: No
   Estimated Cost USD: 0.00
   Notes: Added .sort((a,b) => (a.id||'').localeCompare(b.id||'')) to compactRows in renderBugsTab.

---

BUG-0226: Multiple tabs — column view and card view use different epic header formatting on same tab
Severity: Low
Related Story: US-0049 (EPIC-0006)
Steps to Reproduce:

1. Open any tab with column/card toggle (Hierarchy, Bugs, Lessons, Costs)
2. Toggle between column and card view — epic group headers look different
   Expected: Epic headers are visually identical in both views
   Actual: Column view and card view render different header markup/styles
   Status: Fixed
   Fix Branch: bugfix/BUG-0211-0226-dashboard-polish
   Lesson Encoded: No
   Estimated Cost USD: 0.00
   Notes: Bugs card view and Lessons card view updated to use same flat row style as column view (border-t-2 + border-left:4px + accent.bg). Kanban also updated.

---

BUG-0227: docs/AGENT_PLAN.md referenced in DM_AGENT.md and BUGS.md but file does not exist
Severity: Medium
Related Story: US-0088 (EPIC-0013)
Steps to Reproduce:

1. Run `ls docs/AGENT_PLAN.md`
   Expected: File exists documenting the 6-phase pipeline per AC-0280
   Actual: `ls: docs/AGENT_PLAN.md: No such file or directory`
   Status: Fixed
   Fix Branch: bugfix/BUG-0227-agent-plan-doc
   Lesson Encoded: No
   Estimated Cost USD: 0.00
   Notes: Discovered via TC-0352 (AC-0280). DM_AGENT.md line 22 instructs agents to read the file; BUGS.md references it. File must be created to satisfy AC-0280.

---

BUG-0228: dashboard.html has external Google Fonts dependencies violating AC-0290 self-contained requirement
Severity: Medium
Related Story: US-0091 (EPIC-0013)
Steps to Reproduce:

1. Run `grep "fonts.googleapis" docs/dashboard.html | head -2`
   Expected: No external dependencies per AC-0290
   Actual: Two `<link rel="stylesheet" href="https://fonts.googleapis.com/...">` tags present
   Status: Fixed
   Fix Branch: bugfix/BUG-0228-0230-remove-cdn-deps
   Lesson Encoded: No
   Estimated Cost USD: 0.00
   Notes: Discovered via TC-0362 (AC-0290). dashboard.html loads Departure Mono and JetBrains Mono from Google Fonts CDN. To fix: inline the font-face declarations or use system font fallbacks.

---

BUG-0229: npm run plan:generate and plan:watch scripts not defined per AC-0304
Severity: Low
Related Story: US-0093 (EPIC-0013)
Steps to Reproduce:

1. Run `node -e "const p = require('./package.json'); console.log(p.scripts['plan:generate'])"`
   Expected: `node tools/generate-plan.js`
   Actual: `undefined` — scripts are named `generate` and `generate:watch` instead
   Status: Fixed
   Fix Branch: bugfix/BUG-0229-0231-0232-quick-wins
   Lesson Encoded: No
   Estimated Cost USD: 0.00
   Notes: Discovered via TC-0376 (AC-0304). Add `"plan:generate": "node tools/generate-plan.js"` and `"plan:watch": "node tools/generate-plan.js --watch"` to package.json scripts.

---

BUG-0230: plan-status.html loads Tailwind CSS, Chart.js, and Google Fonts from external CDNs, violating AC-0305
Severity: Medium
Related Story: US-0093 (EPIC-0013)
Steps to Reproduce:

1. Run `grep "cdn\.\|googleapis" docs/plan-status.html | head -3`
   Expected: No external dependencies per AC-0305
   Actual: Tailwind CSS via cdn.tailwindcss.com, Chart.js via cdn.jsdelivr.net, Google Fonts via fonts.googleapis.com
   Status: Fixed
   Fix Branch: bugfix/BUG-0228-0230-remove-cdn-deps
   Lesson Encoded: No
   Estimated Cost USD: 0.00
   Notes: Discovered via TC-0377 (AC-0305). plan-status.html has 3 external CDN dependencies. To fix: bundle Tailwind, inline Chart.js, and inline or remove Google Fonts.

---

BUG-0231: dashboard.html missing dispatch counter element on Conductor card (AC-0522)
Severity: Low
Related Story: US-0143 (EPIC-0020)
Steps to Reproduce:

1. Run `grep -n "dispatch.*counter\|dispatchCount\|dispatch-count\|tasks.*count\|counter.*dispatch" docs/dashboard.html | head -5`
2. Observe 0 matches for any dispatch counter element
   Expected: Conductor card contains a visible dispatch counter element (e.g. "37 tasks") that increments and animates on change
   Actual: No dispatch counter element found in dashboard.html; only setConductorActive toggling is implemented
   Status: Fixed
   Fix Branch: bugfix/BUG-0229-0231-0232-quick-wins
   Lesson Encoded: No
   Estimated Cost USD: 0.00
   Notes: TC-0536 verifies AC-0522 "Conductor card shows incrementing dispatch counter". The dispatch-counter/dispatchCount element is not present in docs/dashboard.html. Only setConductorActive toggling is implemented; no counter element is rendered.

---

BUG-0232: Agent Workload widget missing "(N done)" sub-label (AC-0537)
Severity: Low
Related Story: US-0147 (EPIC-0020)
Steps to Reproduce:

1. Run `grep -n "N done\|done.*sub-label\|pv-workload.*done" tools/generate-dashboard.js | head -3`
2. Observe 0 matches for any (N done) sub-label
   Expected: Agent Workload widget renders a "(N done)" sub-label showing the count of completed stories per agent
   Actual: Sub-label absent from dashboard.html output; inFlight filtering is implemented but the (N done) count is never rendered
   Status: Fixed
   Fix Branch: bugfix/BUG-0229-0231-0232-quick-wins
   Lesson Encoded: No
   Estimated Cost USD: 0.00
   Notes: TC-0551 verifies AC-0537 "Agent Workload bars show (N done) sub-label". The inFlight filtering in tools/generate-dashboard.js is implemented but the (N done) sub-label is never rendered.

---

BUG-0233: CDN removal regression — `.hidden` utility missing and Chart.js not inlined
Severity: Critical
Related Story: US-0160 (EPIC-0022)
Steps to Reproduce:

1. Open docs/plan-status.html in a browser after PR #470 merged
   Expected: Tabs switch correctly; charts render; epic headers collapse by default
   Actual: All tabs visible simultaneously (tab switching broken); no charts render; all epic headers expanded
   Status: Fixed
   Fix Branch: bugfix/BUG-0233-cdn-removal-regressions
   Lesson Encoded: No
   Estimated Cost USD: 0.00
   Notes: Two root causes: (1) Tailwind CDN provided a global `.hidden { display: none !important; }` utility used throughout the app for tab visibility, epic collapse, and filter bar toggling — removing Tailwind without adding this rule broke all hide/show behavior. Fix: add `.hidden { display: none !important; }` to the base CSS in render-html.js. (2) Chart.js was loaded entirely from CDN and was NOT inlined — the "21 references" claim in the original review referred to Chart.js API call sites (new Chart(), etc.) not the library itself. Fix: npm install chart.js as devDependency, read chart.umd.min.js at build time and inline as a <script> block in render-html.js.

---

BUG-0234: view-toggle button contrast — Column/Card buttons unreadable after Tailwind CDN removal
Severity: Medium
Related Story: US-0160 (EPIC-0022)
Steps to Reproduce:

1. Open docs/plan-status.html in a browser after Tailwind CDN removal
2. Navigate to Hierarchy, Costs, Bugs, or Lessons tab
   Expected: Column and Card toggle buttons are clearly styled with readable text and border
   Actual: Buttons render with no styling (browser defaults) — text and borders near-invisible on light backgrounds
   Status: Fixed
   Fix Branch: bugfix/BUG-0234-toggle-btn-contrast
   Lesson Encoded: No
   Estimated Cost USD: 0.00
   Notes: Nine Tailwind class strings on view-toggle buttons were not replaced during BUG-0230 CDN removal. Fixed by creating .view-toggle-btn CSS class with var(--clr-\*) tokens.

---

BUG-0235: comprehensive Tailwind utility regression — all tabs broken after CDN removal
Severity: Critical
Related Story: US-0160 (EPIC-0022)
Steps to Reproduce:

1. Open docs/plan-status.html after Tailwind CDN removal
2. Observe Costs/Bugs/Lessons/Hierarchy column views compressed to half width; card views lose padding/grid/borders; Charts/Trends not in 2-column layout; tab containers missing 24px padding
   Expected: All tabs render with correct spacing, full-width tables, and card grid layouts
   Actual: ~55 Tailwind utility classes (flex, grid, gap-_, p-_, w-full, etc.) had no CSS replacements, causing widespread layout breakage
   Status: Fixed
   Fix Branch: bugfix/BUG-0235-tailwind-utility-shim
   Lesson Encoded: No
   Estimated Cost USD: 0.00
   Notes: A CSS utility shim was added to render-html.js covering all remaining Tailwind utilities. Named grid classes (.charts-grid, .story-card-grid, .cost-detail-grid) replaced the Tailwind grid strings in render-tabs.js.

---

BUG-0236: Lessons card view grid class missed in BUG-0235 sweep
Severity: Low
Related Story: US-0160 (EPIC-0022)
Steps to Reproduce:

1. Open Lessons tab, switch to Card view after BUG-0235 fix
   Expected: Lessons render as multi-column card grid
   Actual: Cards stack vertically as full-width blocks (grid class used gap-4 not gap-3 and was missed by the sed replacement)
   Status: Fixed
   Fix Branch: bugfix/BUG-0236-remaining-tailwind-stragglers
   Lesson Encoded: No
   Estimated Cost USD: 0.00
   Notes: One remaining Tailwind grid class (grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4) in lessonCardGroups was not replaced. Fixed by replacing with .story-card-grid.

---

BUG-0237: Chart.defaults.color set to CSS custom property string — Chart.js ignores it
Severity: High
Related Story: US-0093 (EPIC-0013)
Steps to Reproduce:

1. Open Charts or Trends tab in dark mode
   Expected: Chart axis labels and grid lines use theme text/border colors
   Actual: Chart.js ignores CSS custom property strings (e.g. 'var(--text-muted)') — all text defaults to Chart.js built-in grey (#666)
   Status: Open
   Fix Branch:
   Lesson Encoded: No
   Estimated Cost USD: 0.00
   Notes: render-scripts.js sets Chart.defaults.color = 'var(--text-muted)' and Chart.defaults.borderColor = 'var(--border)'. Chart.js does not resolve CSS custom properties. The correct approach is to resolve via getComputedStyle at init time (pattern already used by pvChartColors helpers).

---

BUG-0238: Canvas gradient uses space-separated rgb() syntax — fails in some browsers
Severity: High
Related Story: US-0058 (EPIC-0008)
Steps to Reproduce:

1. Open Trends tab in Safari or older Chromium
   Expected: Chart area fills show gradient
   Actual: Area fills may be transparent — Canvas 2D addColorStop does not support space-separated rgb(r g b / a) syntax in all browsers
   Status: Open
   Fix Branch:
   Lesson Encoded: No
   Estimated Cost USD: 0.00
   Notes: \_trendGrad helper in render-tabs.js builds color stops as 'rgb(r g b / 0.35)'. Canvas 2D requires legacy rgba(r, g, b, a) comma-separated syntax. Fix: replace with rgba(${r}, ${g}, ${b}, 0.35).

---

BUG-0239: shEpicCompositeStatus checks b.epicId — field does not exist on bug objects
Severity: High
Related Story: US-0094 (EPIC-0013)
Steps to Reproduce:

1. Open Stakeholder tab for a project with open Critical/High bugs linked to stories in a non-Done epic
   Expected: That epic shows Needs Attention status
   Actual: Epic always shows On Track or In Progress — hasOpenCritical always false because b.epicId is never set on parsed bug objects (parser sets relatedStory, not epicId)
   Status: Fixed
   Fix Branch: bugfix/BUG-0239-0241-0248-stakeholder-fixes
   Lesson Encoded: No
   Estimated Cost USD: 0.00
   Notes: shEpicCompositeStatus in render-tabs.js filters data.bugs with b.epicId === epicId. Bugs have relatedStory (e.g. US-0012), not epicId. Fix: cross-reference via story→epic map (same as renderBugsTab and renderCostsTab normalizeStoryRef pattern).

---

BUG-0240: Trends tab "Burn Up" chart is not a burn-up — renders cumulative totals as bars
Severity: Medium
Related Story: US-0058 (EPIC-0008)
Steps to Reproduce:

1. Open Trends tab, observe "Story Velocity" chart
   Expected: Burn-up chart with two lines: total scope and completed work over time
   Actual: Bar chart of cumulative story points per snapshot — monotonically growing, visually misleading
   Status: Fixed
   Fix Branch: bugfix/BUG-0240-burnup-epic022-closure
   Lesson Encoded: No
   Estimated Cost USD: 0.00
   Notes: The chart uses the cumulative velocity array as bars. A true burn-up requires two datasets (done vs total scope). The existing velocityByWeek() in snapshot.js provides per-week deltas which would be more accurate for a velocity view.

---

BUG-0241: Open bug count inconsistent between \_renderStatusHero and renderStatusTab
Severity: Medium
Related Story: US-0093 (EPIC-0013)
Steps to Reproduce:

1. Open a project with bugs having status "Rejected"
   Expected: Open bug count consistent across Status hero and Status tab widgets
   Actual: renderStatusTab uses !/^(Fixed|Retired|Cancelled|Rejected)/i — \_renderStatusHero uses !/^(Fixed|Retired|Cancelled)/i (missing Rejected). Different counts show on same page.
   Status: Fixed
   Fix Branch: bugfix/BUG-0239-0241-0248-stakeholder-fixes
   Lesson Encoded: No
   Estimated Cost USD: 0.00
   Notes: Since Stakeholder tab now calls \_renderStatusHero, it also inherits the inconsistency. Fix: align all open-bug filters to the project canonical pattern.

---

BUG-0242: Week label truncates month name at month boundaries in "This Week" widget
Severity: Low
Related Story: US-0093 (EPIC-0013)
Steps to Reproduce:

1. Open dashboard when the current week spans two months (e.g. Apr 28 – May 4)
   Expected: "Apr 28–May 4"
   Actual: "Apr 28–4" — end month name dropped
   Status: Open
   Fix Branch:
   Lesson Encoded: No
   Estimated Cost USD: 0.00
   Notes: thisWeek label uses MONTHS[wStart.getMonth()] only. Fix: conditionally include MONTHS[wEnd.getMonth()] when wEnd.getMonth() !== wStart.getMonth().

---

BUG-0243: pvChartColors defined twice — second definition silently overwrites first
Severity: Low
Related Story: US-0058 (EPIC-0008)
Steps to Reproduce:

1. Open dashboard with both Charts and Trends tabs
   Expected: pvChartColors single authoritative definition
   Actual: var pvChartColors = ... declared in both renderChartsTab and renderTrendsTab inline scripts; second overwrites first silently
   Status: Open
   Fix Branch:
   Lesson Encoded: No
   Estimated Cost USD: 0.00
   Notes: Both tab scripts define the same top-level var. Fix: use window.pvChartColors = window.pvChartColors || (function(){...})() in both, or extract to a shared script block in render-html.js.

---

BUG-0244: Trends openBugs uses allowlist — undercounts vs all other open-bug counts
Severity: Low
Related Story: US-0058 (EPIC-0008)
Steps to Reproduce:

1. Add a bug with status "Blocked" or "Verified" to BUGS.md; open Trends tab
   Expected: Open Bugs trend line matches the open bug count shown on Status tab
   Actual: Trend only counts Open and In Progress; Blocked/Verified/Reopened excluded
   Status: Open
   Fix Branch:
   Lesson Encoded: No
   Estimated Cost USD: 0.00
   Notes: snapshot.js extractTrends openBugs uses status === 'Open' || status === 'In Progress' allowlist. Canonical pattern is !/^(Fixed|Retired|Cancelled)/i denylist.

---

BUG-0245: patchDOM textContent destroys branch link anchor in agent task cell (agentic dashboard)
Severity: High
Related Story: US-0143 (EPIC-0016)
Steps to Reproduce:

1. Set an agent's branch in sdlc-status.json; open dashboard; wait 5 seconds for first patchDOM tick
   Expected: Agent task cell shows clickable branch link
   Actual: textContent assignment destroys the server-rendered <a href="..."> — plain text URL, not clickable
   Status: Open
   Fix Branch:
   Lesson Encoded: No
   Estimated Cost UUID: 0.00
   Notes: patchDOM at generate-dashboard.js uses taskEl.textContent = newTask unconditionally. Server renderer has branch→link logic (line 2154) but client patcher does not replicate it. Fix: check if newTask value matches branch and render an anchor, or use innerHTML with escH.

---

BUG-0246: dispatch tag not in appendEventLog tone map — styled as story-start event (agentic dashboard)
Severity: Low
Related Story: US-0143 (EPIC-0016)
Steps to Reproduce:

1. Fire a dispatch event via setConductorActive
   Expected: Dispatch event appears with distinct styling in event log
   Actual: appendEventLog maps unknown tag to 'evt-start' tone — dispatch events visually identical to story-start events
   Status: Open
   Fix Branch:
   Lesson Encoded: No
   Estimated Cost USD: 0.00
   Notes: dispatch tag added in Session 31 was not added to appendEventLog tone-map or mc-evt-tag-dispatch CSS. Fix: add 'dispatch' → 'evt-dispatch' mapping and .mc-evt-tag-dispatch CSS rule.

---

BUG-0247: InProgress vs "In Progress" mismatch — story status badge wrong color (agentic dashboard)
Severity: Medium
Related Story: US-0119 (EPIC-0016)
Steps to Reproduce:

1. Set a story status to InProgress via update-sdlc-status.js agent-start command
2. Open dashboard
   Expected: Story renders with In Progress (amber) styling
   Actual: Story renders with Planned (grey) styling — isInProgress check uses 'In Progress' (space) but updater writes 'InProgress' (camelCase)
   Status: Open
   Fix Branch:
   Lesson Encoded: No
   Estimated Cost USD: 0.00
   Notes: generate-dashboard.js story section uses s.status === 'In Progress' (line 2270). update-sdlc-status.js writes 'InProgress'. Fix: use /^In[ -]?Progress$/i regex consistent with patchCycleCounter (line 3510).

---

BUG-0248: Stakeholder tab hero section shows simplified chip variant, not the full Status tab hero
Severity: High
Related Story: US-0163 (EPIC-0022)
Steps to Reproduce:

1. Open plan-status.html → navigate to Stakeholder tab
   Expected: Same hero as Status tab — "Release Health" eyebrow, large h2 verdict, 3-column sparkline row (Progress · past 14 snapshots, Coverage · last 30, Burn · cumulative), plus KPI tiles and decision widgets
   Actual: Simplified variant — small chip with verdict, one-line narrative, a 30-cell coverage heat strip only; missing the eyebrow label, h2, and sparkline columns
   Status: Fixed
   Fix Branch: bugfix/BUG-0239-0241-0248-stakeholder-fixes
   Lesson Encoded: No
   Estimated Cost USD: 0.00
   Notes: US-0163 called \_renderStatusHero(data) which is a compact helper used by the Charts tab — not the full inline hero rendered by renderStatusTab. The fix is to extract the Status tab's inline hero block into a proper shared function (e.g. \_renderFullStatusHero) that produces the complete layout, and call that from renderStakeholderTab instead.
