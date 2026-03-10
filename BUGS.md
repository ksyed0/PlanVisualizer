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
Status: Open
Fix Branch: bugfix/BUG-0003-tc-statuses
Lesson Encoded: No

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
