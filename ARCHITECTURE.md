# PlanVisualizer — Technical Architecture

**Version:** 1.1
**Last Updated:** 2026-03-10

---

## 1. Overview

PlanVisualizer is a Node.js CLI tool with no production runtime dependencies. It reads markdown files, parses them with regex-based parsers, and renders a self-contained HTML dashboard. The output is a single `.html` file deployable anywhere.

---

## 2. Technology Stack

| Layer | Technology | Version | Justification |
|-------|-----------|---------|---------------|
| Runtime | Node.js | 18+ | LTS, available everywhere; `fs` and `path` are sufficient |
| Test framework | Jest | 30.x | Industry standard; supports coverage reporting |
| Linter | ESLint | 9.x | Flat config; `eslint:recommended` + security rules |
| CSS | Tailwind CSS | CDN | Zero build step; utility-first for rapid UI |
| Charts | Chart.js | 4.x CDN | Zero build step; covers all required chart types |
| Fonts | Google Fonts | CDN | Inter + JetBrains Mono |
| CI | GitHub Actions | — | Native to repo; free for public repos |
| Hosting | GitHub Pages | — | Zero-config static hosting |

---

## 3. Module Structure

```
tools/
  generate-plan.js        CLI entry point; orchestrates all parsers and the renderer
  capture-cost.js         Claude Code stop hook; appends session cost row to AI_COST_LOG.md
  lib/
    parse-release-plan.js  Extracts EPIC/US/TASK artefacts from fenced code blocks
    parse-test-cases.js    Extracts TC artefacts from markdown
    parse-bugs.js          Extracts BUG artefacts from markdown
    parse-cost-log.js      Parses pipe-delimited table rows; aggregates by branch
    parse-coverage.js      Normalises Jest coverage-summary.json into a flat object
    parse-progress.js      Extracts recent session summaries from progress.md
    compute-costs.js       Calculates projected costs; attributes AI costs to stories
    detect-at-risk.js      Flags stories matching at-risk signals
    render-html.js         Assembles complete HTML from a data object

tests/
  unit/                   One test file per lib module (9 suites, 121+ tests)
  fixtures/               Deterministic markdown/JSON samples shared across suites

scripts/
  install.sh              Idempotent bash installer for target projects

.github/
  workflows/
    ci.yml                Lint + test + audit (all branches + PRs)
    codeql.yml            CodeQL analysis (PRs + main + weekly schedule)
    plan-visualizer.yml   Generate + commit plan-status.html + deploy to GitHub Pages
  dependabot.yml          Weekly npm and Actions updates
```

---

## 4. Data Flow

```
                 ┌─────────────────────────────────────┐
                 │         generate-plan.js              │
                 │                                       │
  Markdown ──────►  parseReleasePlan()  → epics[]        │
  files          │  parseTestCases()   → testCases[]     │
                 │  parseBugs()        → bugs[]           │──► data{} ──► renderHtml()
                 │  parseCostLog()     → costRows[]       │
  JSON   ────────►  parseCoverage()    → coverage{}      │         │
                 │  parseRecentActivity() → activity[]   │         ▼
                 │                                       │   plan-status.html
                 │  computeProjectedCost()               │   plan-status.json
                 │  attributeAICosts() → costs{}         │
                 │  detectAtRisk()     → atRisk{}        │
                 └─────────────────────────────────────┘
```

---

## 5. Parser Design Pattern

All parsers follow a consistent contract:

```js
/**
 * @param {string} markdown  — raw file content (empty string if file missing)
 * @returns {Array}          — typed array of parsed objects (never throws)
 */
function parseXxx(markdown) { ... }
```

**Key design decisions:**
- **Regex, not a markdown parser.** No dependencies. Parsers target the specific format defined in AGENTS.md.
- **Never throw.** Missing fields default to empty string or zero. The renderer handles absent data gracefully.
- **Fenced code block extraction** (`parse-release-plan.js` only). Epic/story/task definitions must live inside triple-backtick fences to support narrative commentary outside the parseable content.
- **Sliding window slicing** (`parse-bugs.js`, `parse-test-cases.js`). Each artefact block is extracted by finding the next artefact's start index and slicing the markdown between them.

---

## 6. Renderer Architecture

`renderHtml(data)` in `render-html.js` orchestrates 11 sub-renderers, each returning an HTML string:

| Function | Output |
|----------|--------|
| `renderTopBar(data)` | Project name, progress bar, 6 stat tiles |
| `renderFilterBar(data)` | Epic / status / priority / search dropdowns |
| `renderTabs()` | 6 tab buttons |
| `renderHierarchyTab(data)` | Collapsible epic → story → AC tree |
| `renderKanbanTab(data)` | 5-column kanban board |
| `renderTraceabilityTab(data)` | Story × TC matrix |
| `renderChartsTab(data)` | 6 Chart.js canvases + inline `<script>` |
| `renderCostsTab(data)` | Per-story cost table with totals |
| `renderBugsTab(data)` | Bug register table |
| `renderRecentActivity(data)` | Floating activity panel |
| `renderScripts(data)` | Tab switching + filter logic |

**Inline JavaScript** handles all interactivity. No frameworks. Tab switching, filter application, and chart initialisation are implemented as plain functions serialised into the HTML output.

**Chart initialisation** is lazy: charts are only initialised when the Charts tab is first activated (`initCharts()` is nulled after first call to prevent re-render).

---

## 7. Configuration System

`loadConfig()` in `generate-plan.js` merges user config over DEFAULTS using spread:

```js
const config = {
  project: { ...DEFAULTS.project, ...raw.project },
  docs:    { ...DEFAULTS.docs,    ...raw.docs    },
  // ...
};
```

The `plan-visualizer.config.json` is gitignored by default so target projects keep their own local config. `plan-visualizer.config.example.json` is committed as a template.

---

## 8. Cost Attribution System

**Capture** (`capture-cost.js`):
1. Claude Code invokes the stop hook, passing session data as JSON via stdin.
2. The hook reads `cost_usd`, `usage.input_tokens`, `usage.output_tokens`, `usage.cache_read_input_tokens`, and `session_id` from stdin.
3. The current git branch is resolved via `git rev-parse --abbrev-ref HEAD`.
4. A pipe-delimited row is appended to `AI_COST_LOG.md` using `fs.openSync` with the `'a'` flag (append-safe; never overwrites).

**Attribution** (`compute-costs.js`):
1. `parseCostLog()` parses all rows from the log.
2. `aggregateCostByBranch()` sums tokens and cost per branch name.
3. `attributeAICosts()` matches `story.branch` to the aggregated branch map — returning `{ costUsd, inputTokens, outputTokens, sessions }` per story, and `_totals` across all branches.

---

## 9. At-Risk Detection

`detectAtRisk(stories, testCases, bugs)` evaluates three signals per story:

| Signal | Condition | Meaning |
|--------|-----------|---------|
| `missingTCs` | Story has ≥1 AC but zero linked TCs | Story lacks test coverage |
| `noBranch` | `status === 'In Progress'` AND `branch === ''` | Active story has no git branch |
| `failedTCNoBug` | A linked TC has `status === 'Fail'` AND `defect === 'None'` | Known failure not tracked as a bug |

A story is `isAtRisk` if any signal is true. The ⚠ badge and tooltip are rendered in the Hierarchy tab.

---

## 10. CI/CD Architecture

### ci.yml (all branches + PRs)
Three parallel jobs, all required:
- **lint** — ESLint with `eslint:recommended` + security rules on `tools/**/*.js`
- **test** — Jest with `--coverage`, 80% threshold enforced via `jest.config.js`
- **audit** — `npm audit --audit-level=moderate`

### codeql.yml (PRs + main + weekly)
- GitHub CodeQL JavaScript analysis with `security-extended` query pack
- Results uploaded to GitHub Security tab as SARIF
- Runs on a Monday schedule to avoid burning minutes on every feature branch

### plan-visualizer.yml (Docs file changes on main/develop)
- Triggers when `RELEASE_PLAN.md`, `TEST_CASES.md`, `BUGS.md`, `AI_COST_LOG.md`, or `progress.md` change
- Runs `node tools/generate-plan.js`, commits the output, and deploys to GitHub Pages

### dependabot.yml
- Weekly npm updates (Monday 09:00 UTC)
- Weekly GitHub Actions updates (Monday 09:00 UTC)
- Max 5 open PRs per ecosystem

---

## 11. GitHub Pages Deployment

The `plan-visualizer.yml` workflow deploys `Docs/` to the `gh-pages` branch using `peaceiris/actions-gh-pages@v4`. The `plan-status.html` file is the dashboard entry point. `keep_files: true` preserves any other files in the `gh-pages` branch.

**Access:** `https://ksyed0.github.io/PlanVisualizer/plan-status.html`

---

## 12. Performance Characteristics

| Operation | Typical time | Notes |
|-----------|-------------|-------|
| `generate-plan.js` full run | < 200ms | Pure Node.js I/O + regex |
| Jest test suite (121 tests) | < 1s | No I/O mocking needed |
| ESLint on `tools/**/*.js` | < 2s | ~11 source files |
| `npm audit` | < 10s | Network call to npm registry |
| CodeQL analysis | 3–5 min | Depends on codebase size |
| GitHub Pages deploy | 1–2 min | Commit + peaceiris action |
