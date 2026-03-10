# MEMORY.md — PlanVisualizer

Persistent semantic knowledge base. Organised by topic. Updated every session.

---

## Project Identity

- **Name:** PlanVisualizer
- **Repo:** `ksyed0/PlanVisualizer` (public)
- **Purpose:** Parse AGENTS.md-style markdown files and generate a static HTML project dashboard.
- **Entry point:** `node tools/generate-plan.js`
- **Config:** `plan-visualizer.config.json` (gitignored for target installs; committed here for own project)
- **Dashboard URL:** `https://ksyed0.github.io/PlanVisualizer/plan-status.html`

---

## Technology

- Node.js 18+, no production runtime dependencies
- Jest 30 for testing (upgraded from 29 on 2026-03-10 to eliminate `inflight` deprecation warning)
- ESLint 9 flat config (`eslint.config.js`) — `eslint:recommended` + `no-eval`, `eqeqeq`, `no-implied-eval` as errors
- Tailwind CSS (CDN) + Chart.js v4 (CDN) in generated HTML
- GitHub Actions for CI (ci.yml + codeql.yml + plan-visualizer.yml)
- Dependabot for weekly npm + Actions updates

---

## Git Branching Strategy

- **`main`** — production-ready only; protected (requires PR + CI pass)
- **`develop`** — integration branch; protected (requires PR + CI pass)
- **`feature/US-XXXX-*`** — one branch per user story; squash-merge into develop
- **`bugfix/BUG-XXXX-*`** — one branch per bug; squash-merge into develop
- **`release/*`** — staging branch cut from develop before production deploy
- **`hotfix/*`** — emergency fixes branched from main

**Rule:** Never push directly to `main` or `develop`. Always open a PR.

---

## AGENTS.md

The project has an `AGENTS.md` at repo root. Read it at the start of every session.
§1 Sequential Execution is **disabled** (parallel agents permitted). All other sections apply.

---

## Active Dependencies

| Package | Version | Purpose |
|---------|---------|---------|
| jest | 30.x | Unit test framework |
| eslint | 9.x | Code quality linting |
| @eslint/js | latest | ESLint recommended config |

---

## Parser Contracts

All parsers: `(markdown: string) → Array` — never throw, empty string input returns `[]`.

| Module | Input | Key output fields |
|--------|-------|------------------|
| `parse-release-plan.js` | RELEASE_PLAN.md | `epics[]`, `stories[]`, `tasks[]` |
| `parse-test-cases.js` | TEST_CASES.md | `testCases[{ id, relatedStory, relatedAC, status }]` |
| `parse-bugs.js` | BUGS.md | `bugs[{ id, severity, relatedStory, status, fixBranch }]` |
| `parse-cost-log.js` | AI_COST_LOG.md | `rows[{ date, branch, inputTokens, outputTokens, costUsd }]` |
| `parse-coverage.js` | coverage-summary.json | `{ lines, statements, functions, branches, overall, meetsTarget }` |
| `parse-progress.js` | progress.md | `activity[{ date, summary }]` |

---

## Release Plan Format Rules

Artifacts (EPIC/US/TASK) must be inside triple-backtick fenced code blocks. Within each block, artifacts are separated by blank lines (2+ newlines). Format:

```
EPIC-XXXX: Title
Description: ...
Release Target: MVP (v1.0)
Status: Done | In Progress | Planned
Dependencies: None | EPIC-XXXX

US-XXXX (EPIC-XXXX): As a ..., I want ..., so that ...
Priority: High (P0) | Medium (P1) | Low (P2)
Estimate: S | M | L | XL
Status: Done | In Progress | Planned | Blocked | To Do
Branch: feature/US-XXXX-short-name
Acceptance Criteria:
  - [ ] AC-XXXX: Text
  - [x] AC-XXXX: Text (done)
Dependencies: None | US-XXXX

TASK-XXXX (US-XXXX): Imperative description
Type: Dev | Test | Design | Docs | Infra | Bug
Assignee: Agent | Human
Status: To Do | In Progress | Done | Blocked
Branch: feature/...
Notes: ...
```

---

## Cost Attribution

Branch name in `AI_COST_LOG.md` row must exactly match `Branch:` field in story for attribution to work. Costs are summed per branch then matched by exact string equality.

---

## At-Risk Signals

1. `missingTCs` — story has ACs but zero linked TCs
2. `noBranch` — status is "In Progress" but branch is empty
3. `failedTCNoBug` — a linked TC has status "Fail" but defect is "None"

---

## Coverage Thresholds

Jest coverage gate: 80% lines, branches, functions, statements (all global).
Current coverage (2026-03-10): 97.55% statements, 84.18% branches, 96.2% functions, 99.58% lines.

---

## Key File Paths

| File | Purpose |
|------|---------|
| `tools/generate-plan.js` | Main CLI, orchestrates everything |
| `tools/capture-cost.js` | Claude Code stop hook |
| `tools/lib/*.js` | Parser and renderer modules |
| `docs/RELEASE_PLAN.md` | Epics, stories, tasks |
| `docs/TEST_CASES.md` | Human-readable test cases |
| `docs/BUGS.md` | Bug register |
| `docs/AI_COST_LOG.md` | Append-only cost ledger |
| `docs/index.html` | GitHub Pages redirect to plan-status.html |
| `docs/plan-status.html` | Generated dashboard (gitignored; deployed by CI) |
| `progress.md` | Session logs |
| `MEMORY.md` | This file |
| `PROMPT_LOG.md` | Session prompt audit trail |
| `MIGRATION_LOG.md` | Cross-platform change log |
| `findings.md` | Research and discoveries |
| `docs/ID_REGISTRY.md` | Next available IDs |
| `docs/LESSONS.md` | Encoded hard-won lessons |
| `architecture/ERROR_TAXONOMY.md` | Error classification |

---

## Retry / Transient Error Parameters

- No external API calls in the main tool. `capture-cost.js` does not retry on failure (it writes locally).
- CI jobs do not implement retry — flaky failures should be investigated, not auto-retried.

---

## Lessons Learned

- **Always upgrade Jest when transitive deps emit deprecation warnings.** Jest 29 → 30 eliminated the `inflight` and `glob@7` deprecation warnings with zero test changes. (2026-03-10)
- **CodeQL cannot be scoped with per-job `on:` triggers** — it requires its own workflow file (`codeql.yml`) to control trigger conditions independently from the main CI workflow.
- **GitHub Pages: always include docs/index.html.** Without it Pages falls back to README.md. Use `<meta http-equiv="refresh">` to redirect to the real entry point.
- **peaceiris/actions-gh-pages deploys the full filesystem.** Never add a `git add / commit` step for the generated artifact — it's gitignored and the deploy action works directly from disk.
- **Add workflow_dispatch to any workflow with path filters.** This is the only way to trigger the workflow manually when the changed files don't match the path filter (e.g. when editing the workflow file itself).
