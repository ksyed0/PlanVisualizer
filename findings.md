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

| Package    | Version | Purpose                  | Licence | Last Active |
| ---------- | ------- | ------------------------ | ------- | ----------- |
| jest       | 30.3.0  | Unit test framework      | MIT     | Active      |
| eslint     | 9.x     | Code quality linter      | MIT     | Active      |
| @eslint/js | latest  | ESLint recommended rules | MIT     | Active      |

All CDN dependencies (Tailwind, Chart.js, Google Fonts) are loaded at runtime by the generated HTML. They are not npm packages and are not subject to npm audit.

---

## 2026-03-18 — Dashboard UX Improvements & Lessons Tab

### CSS custom property theming

Replacing hardcoded hex colours with CSS custom properties (`--clr-*`) requires a single canonical `:root` block (light theme defaults) and an `html.dark` override block. All CSS property values reference `var(--clr-*)` — hex literals only appear inside these two blocks. `chartTextColor()` must read the resolved value via `getComputedStyle` rather than returning a hardcoded string.

### Chart.js aspect ratio conflict

Doughnut charts default to `aspectRatio:1` (square) while bar and line charts default to `aspectRatio:2` (landscape). This produces mismatched heights when charts sit side-by-side. Fix: set `maintainAspectRatio:false` on **all** charts and give every canvas wrapper a fixed pixel height (e.g. 300 px).

### Kanban per-column scroll

CSS `position:sticky` inside a container that has `overflow-y:auto` does not work: the sticky element scrolls with the container. The correct approach for a kanban where column headers should stay visible is per-column independent scroll — each column is a flex column with its own `overflow-y:auto` body, and the column header `<h3>` sits above that scrolling area (outside the overflow container), so it never scrolls away.

### Tab viewport-fill with flex

A tab container with `max-height` collapses to content height when content is short, leaving blank space. The fix is a flex-column pattern: the tab container gets `height:calc(100vh - var(--sticky-top))` and `display:flex; flex-direction:column`. The inner scroll region gets `flex:1; min-height:0` — this stretches it to fill remaining vertical space while still being scrollable when content overflows.

### Per-tab filter bar

A single filter bar with groups hidden by JS (`updateFilterBar(tabName)`) is simpler than rendering multiple filter bars. `showTab()` calls `updateFilterBar` on every tab switch, so the bar state is always correct regardless of how the tab is changed (click, hash, localStorage restore).

### At-risk guard for Done stories

`detectAtRisk()` must exclude Done stories before evaluating any signal. A Done story with no TCs is not "at risk" — it is completed. The guard `story.status !== 'Done'` must be the first condition in the `isAtRisk` expression to prevent false positives.
