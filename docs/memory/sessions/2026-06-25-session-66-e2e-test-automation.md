# Session 66 — EPIC-0047/0048 E2E Test Automation Complete (PR #1163)

**Date:** 2026-06-25
**Develop HEAD after merge:** `02b1bbe`

## What Shipped

EPIC-0047 (E2E Test Infrastructure) + EPIC-0048 (E2E Pipeline Scenarios) — 9 user stories, 33 ACs, merged via PR #1163. Process: SDD (subagent-driven development) from plan `docs/superpowers/plans/2026-06-25-e2e-test-automation.md`.

| Story   | Key file(s)                                                              |
| ------- | ------------------------------------------------------------------------ |
| US-0264 | `tests/e2e/helpers/index.js`                                             |
| US-0265 | `tests/e2e/fixtures/{RELEASE_PLAN,BUGS,LESSONS}.md`, sdlc-status-init    |
| US-0266 | `jest.e2e.config.js`, `test:e2e` npm script, `.github/workflows/e2e.yml` |
| US-0267 | `tests/e2e/install.spec.js` (9 tests)                                    |
| US-0268 | `tests/e2e/update.spec.js` (3 tests)                                     |
| US-0269 | `tests/e2e/pipeline-local.spec.js` (6 tests)                             |
| US-0270 | `tests/e2e/pipeline-agentic.spec.js` (15 tests)                          |
| US-0271 | `tests/e2e/pipeline-github.spec.js` (5 tests, skip w/o token)            |
| US-0272 | `tests/e2e/dashboard-playwright.spec.js` (5 tests, skip w/o env)         |

## Test Counts

- Unit + integration: **2727 tests** pass
- E2E: **33 pass, 5 skip**

## Key Technical Learnings

### 1. Hardcoded ROOT in generation tools

`generate-plan.js` and `generate-dashboard.js` use `ROOT = path.join(__dirname, '..')` — they ignore `cwd`. E2E tests calling these tools either (a) must run from project ROOT and use `afterAll` git-restore, or (b) must call underlying dispatch functions with injected paths directly.

### 2. runScript input option for interactive scripts

`install.sh` has 5 `read -p` prompts; `update.sh` has 3. An `execSync`-based `runScript` blocks forever without stdin. Extended `runScript` with an `input` option that pipes a string to the child process's stdin — tests that hit prompts must pass pre-canned responses.

### 3. SdlcMirror isolation across describe blocks

`SdlcMirror.write()` re-renders `sdlc-status.json` from SQLite on every call, wiping any fixture-seeded `programme.stories` data. Each `describe` block in `pipeline-agentic.spec.js` needs its own `mkRoot()` + `Repository._reset()` to get a clean isolated state; sharing a single root across blocks causes inter-test contamination.

### 4. Playwright snapshot paths

Playwright stores `toMatchSnapshot()` screenshots in `{specfile}-snapshots/` (sibling to the spec file), not in a central `tests/e2e/snapshots/` directory. Adjust `.gitignore` and CI artifact paths accordingly.

### 5. jest.e2e.config.js testMatch activates dormant Playwright specs

`testMatch: ['**/tests/e2e/**/*.spec.js']` picks up `@playwright/test` spec files. When Jest (not Playwright) tries to run them it throws `Test is not defined`. Solution: list dormant Playwright specs explicitly in `testPathIgnorePatterns` in `jest.e2e.config.js`.

### 6. pipeline-local.spec.js afterAll git-restore

Because ROOT is hardcoded to the real `docs/` directory, `pipeline-local.spec.js` generates files into the live repo tree. An `afterAll` hook must run `git restore docs/` (or targeted file restores) to keep the working tree clean after the test run.
