# task_plan.md — Current Blueprint

Active implementation plan for the current development phase.

---

## Phase: Release 1.1 — CI/CD Pipeline + Self-Documentation

**Goal:** Complete the CI/CD pipeline setup (EPIC-0004) and create all project self-documentation (EPIC-0005). Both epics must be Done before Release 1.1 is tagged.

---

## Sprint: CI Pipeline Implementation

**Branch:** `feature/US-0014-eslint-ci` / `feature/US-0015-coverage-gate` etc.

| # | Task | US | Status |
|---|------|----|--------|
| 1 | Install ESLint + create eslint.config.js | US-0014 | To Do |
| 2 | Add lint script + verify clean run locally | US-0014 | To Do |
| 3 | Add coverageThreshold to jest.config.js | US-0015 | To Do |
| 4 | Verify npm run test:coverage passes threshold | US-0015 | To Do |
| 5 | Replace ci.yml with consolidated 3-job workflow (lint + test + audit) | US-0014, US-0015, US-0016 | To Do |
| 6 | Create .github/workflows/codeql.yml | US-0017 | To Do |
| 7 | Create .github/dependabot.yml | US-0018 | To Do |
| 8 | Push to main, verify all CI jobs green on GitHub | All | To Do |

**Reference:** Full step-by-step plan in `docs/plans/2026-03-10-ci-pipeline.md`

---

## Sprint: Self-Documentation

**Branch:** `feature/US-0019-design-docs` / `feature/US-0022-project-files`

| # | Task | US | Status |
|---|------|----|--------|
| 1 | Write docs/architecture/DESIGN.md | US-0019 | Done |
| 2 | Write docs/architecture/ARCHITECTURE.md | US-0019 | Done |
| 3 | Write docs/RELEASE_PLAN.md | US-0020 | Done |
| 4 | Write docs/ID_REGISTRY.md | US-0020 | Done |
| 5 | Write docs/TEST_CASES.md | US-0021 | Done |
| 6 | Write docs/BUGS.md | US-0022 | Done |
| 7 | Write docs/AI_COST_LOG.md | US-0022 | Done |
| 8 | Write MEMORY.md, findings.md, progress.md, PROMPT_LOG.md, MIGRATION_LOG.md | US-0022 | Done |
| 9 | Write docs/LESSONS.md + architecture/ERROR_TAXONOMY.md | US-0022 | Done |
| 10 | Create plan-visualizer.config.json | US-0022 | Done |
| 11 | Run node tools/generate-plan.js and verify dashboard output | US-0022 | To Do |
| 12 | Commit all documentation files to main | US-0022 | To Do |

---

## Acceptance Criteria for Release 1.1

- [ ] All CI jobs green on main (lint, test, audit, codeql)
- [ ] npm run lint exits 0 with zero errors
- [ ] npm run test:coverage: all 9 suites pass, all metrics ≥ 80%
- [ ] npm audit: 0 vulnerabilities
- [ ] docs/RELEASE_PLAN.md parses correctly (all 5 epics, 22 stories rendered in dashboard)
- [ ] docs/TEST_CASES.md parses correctly (all 23 TCs visible in Traceability tab)
- [ ] plan-status.html deployed to GitHub Pages and accessible
- [ ] All AGENTS.md-required files present and populated
