# findings.md — Research, Discoveries & Constraints

---

## 2026-03-10 — Project Setup & CI Pipeline

### Parser format constraint
`parse-release-plan.js` requires EPIC/US/TASK definitions to be inside triple-backtick fenced code blocks. Artifacts within a block must be separated by at least one blank line (2+ newlines). This is by design: it allows narrative prose to coexist with parseable artifact definitions in the same markdown file.

### Cost attribution by branch
AI cost attribution is exact-match on branch name. If `story.branch` is `feature/US-0001-open-file`, the cost log row's branch column must be exactly `feature/US-0001-open-file`. Partial matches, case differences, or remote prefix (`origin/`) will result in zero attribution.

### Jest 29 → 30 upgrade
Jest 29 carries `glob@7` as a transitive dependency, which in turn depends on the deprecated `inflight@1.0.6` package. Upgrading to Jest 30 replaces `glob@7` with `glob@11`, eliminating both deprecation warnings. All 121 tests pass unchanged on Jest 30.

### CodeQL trigger limitation
GitHub Actions does not support per-job `on:` triggers within a single workflow file. To run CodeQL only on PRs, pushes to main, and weekly (not on every branch push), it must live in its own dedicated workflow file (`codeql.yml`).

### ESLint 9 flat config
ESLint 9 uses a flat config (`eslint.config.js`) instead of the legacy `.eslintrc.*` format. The `@eslint/js` package provides the `recommended` config. The legacy format still works but emits deprecation warnings.

### plan-visualizer.config.json gitignore behaviour
The file is gitignored so that when PlanVisualizer is installed as a tool into a target project, the target project's config remains local and doesn't pollute the PlanVisualizer source repo. For PlanVisualizer's own self-documentation use, the config is committed to this repo.

---

## Active Dependencies

| Package | Version | Purpose | Licence | Last Active |
|---------|---------|---------|---------|-------------|
| jest | 30.3.0 | Unit test framework | MIT | Active |
| eslint | 9.x | Code quality linter | MIT | Active |
| @eslint/js | latest | ESLint recommended rules | MIT | Active |

All CDN dependencies (Tailwind, Chart.js, Google Fonts) are loaded at runtime by the generated HTML. They are not npm packages and are not subject to npm audit.
