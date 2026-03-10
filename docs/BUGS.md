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
Status: Open
Fix Branch: bugfix/BUG-0004-sticky-header
Lesson Encoded: No

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
Status: Open
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
Status: Open
Fix Branch: bugfix/BUG-0006-tshirt-hours-config
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
Status: Open
Fix Branch: bugfix/BUG-0007-parse-coverage-guard
Lesson Encoded: No

BUG-0008: DEFAULTS object in generate-plan.js uses uppercase 'Docs' paths — breaks on Linux
Severity: High
Related Story: US-0013
Related Task: TASK-0001
Steps to Reproduce:
  1. Remove or rename plan-visualizer.config.json so the tool falls back to DEFAULTS
  2. Run node tools/generate-plan.js on a Linux filesystem
Expected: Generator reads from docs/ (lowercase) matching the actual directory structure
Actual: Generator attempts to read from Docs/ (uppercase) — silently produces empty data on Linux
Status: Open
Fix Branch: bugfix/BUG-0008-defaults-lowercase-paths
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
Status: Open
Fix Branch: bugfix/BUG-0009-ftype-filter-not-applied
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
Status: Open
Fix Branch: bugfix/BUG-0010-coverage-na-heuristic
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
Status: Open
Fix Branch: bugfix/BUG-0011-progress-sort-order
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
Status: Open
Fix Branch: bugfix/BUG-0012-pin-actions-digests
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
Status: Open
Fix Branch: bugfix/BUG-0013-pin-dep-versions
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
Status: Open
Fix Branch: bugfix/BUG-0014-detect-at-risk-unused-bugs
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
Status: Open
Fix Branch: bugfix/BUG-0015-config-parse-warning
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
Status: Open
Fix Branch: bugfix/BUG-0016-main-error-handler
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
Lesson Encoded: Yes — see Docs/LESSONS.md | No

-->
