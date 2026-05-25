US-0243 (EPIC-0040): As an upgrading user, I want Migration 001 to normalise all managed markdown via two-pass AST round-trip, so that Phase E writes start from a canonical baseline.
Priority: High (P1)
Estimate: M
Status: To Do
Plan Task: E.4
Dependencies: US-0218 (EPIC-0036)
Related Bug: BUG-0250
Acceptance Criteria:

- [ ] AC-0950: migrations/001-normalise-fenced-blocks.js applies parse→serialise→parse→serialise to RELEASE_PLAN.md, BUGS.md, LESSONS.md, TEST_CASES.md, ID_REGISTRY.md
- [ ] AC-0951: writes back only when result differs from input; second run is a no-op
- [ ] AC-0952: user reviews the diff against /tmp/docs-pre-norm before committing; explicit human approval gate
