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

| Package    | Version | Purpose                   |
| ---------- | ------- | ------------------------- |
| jest       | 30.x    | Unit test framework       |
| eslint     | 9.x     | Code quality linting      |
| @eslint/js | latest  | ESLint recommended config |

---

## Parser Contracts

All parsers: `(markdown: string) → Array` — never throw, empty string input returns `[]`.

| Module                  | Input                 | Key output fields                                                                                                                |
| ----------------------- | --------------------- | -------------------------------------------------------------------------------------------------------------------------------- |
| `parse-release-plan.js` | RELEASE_PLAN.md       | `epics[]`, `stories[]`, `tasks[]`                                                                                                |
| `parse-test-cases.js`   | TEST_CASES.md         | `testCases[{ id, relatedStory, relatedAC, status }]`                                                                             |
| `parse-bugs.js`         | BUGS.md               | `bugs[{ id, severity, relatedStory, status, fixBranch }]`                                                                        |
| `parse-cost-log.js`     | AI_COST_LOG.md        | `rows[{ date, branch, inputTokens, outputTokens, costUsd }]`                                                                     |
| `parse-coverage.js`     | coverage-summary.json | `{ lines, statements, functions, branches, overall, meetsTarget, available }` — `available: false` when file absent or malformed |
| `parse-progress.js`     | progress.md           | `activity[{ date, summary }]`                                                                                                    |

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
Type: Dev | Test | Design | docs | Infra | Bug
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
4. `openCriticalBug` — story has a linked Open/In Progress bug with severity Critical or High

---

## Project Completion Status (as of 2026-04-22 Session 25)

20 EPICs active (EPIC-0010/0014/0015/0016/0017/0019 Done; EPIC-0020 in progress), 147 active stories, 210 bugs.
Open PRs: #416 (bugfix/BUG-0202-0208-ui-polish → develop) — 12 UI bugs fixed across Sessions 24–25.
Next IDs: EPIC-0021, US-0148, TASK-0055, AC-0539, TC-0158, BUG-0211.

Key additions (Session 25):

- `data.agents` added to generate-plan.js data object (loaded from `agents.config.json`) — consumed by About modal agent roster.
- `classList.add/remove('dark')` added to inline theme-init script (Tailwind darkMode:'class' requires it — BUG-0190 fully resolved).
- All view-toggle functions (setCostsView, setBugsView, setLessonsView) migrated from inline styles to `classList.toggle('active-view', …)`.
- Lessons tab epic headers now match Bugs tab format across column and card views.
- US-0147 (EPIC-0020): Agent Workload widget to read from sdlc-status.json — added as Planned.

Architecture decision: `Assignee:` field in RELEASE_PLAN.md stories is not meaningful for the multi-agent pipeline. Agent Workload widget should read from `docs/sdlc-status.json` instead.

---

## Coverage Thresholds

Jest coverage gate: 80% statements (global).
Current coverage (2026-04-22 Session 25): ~93% statements, ~80% branches, ~94% functions. 1164 tests, 48 suites.

---

## Key File Paths

| File                             | Purpose                                          |
| -------------------------------- | ------------------------------------------------ |
| `tools/generate-plan.js`         | Main CLI, orchestrates everything                |
| `tools/capture-cost.js`          | Claude Code stop hook                            |
| `tools/lib/*.js`                 | Parser and renderer modules                      |
| `docs/RELEASE_PLAN.md`           | Epics, stories, tasks                            |
| `docs/TEST_CASES.md`             | Human-readable test cases                        |
| `docs/BUGS.md`                   | Bug register                                     |
| `docs/AI_COST_LOG.md`            | Append-only cost ledger                          |
| `docs/index.html`                | GitHub Pages redirect to plan-status.html        |
| `docs/plan-status.html`          | Generated dashboard (gitignored; deployed by CI) |
| `progress.md`                    | Session logs                                     |
| `MEMORY.md`                      | This file                                        |
| `PROMPT_LOG.md`                  | Session prompt audit trail                       |
| `MIGRATION_LOG.md`               | Cross-platform change log                        |
| `findings.md`                    | Research and discoveries                         |
| `docs/ID_REGISTRY.md`            | Next available IDs                               |
| `docs/LESSONS.md`                | Encoded hard-won lessons                         |
| `architecture/ERROR_TAXONOMY.md` | Error classification                             |

---

## Retry / Transient Error Parameters

- No external API calls in the main tool. `capture-cost.js` does not retry on failure (it writes locally).
- CI jobs do not implement retry — flaky failures should be investigated, not auto-retried.

---

## Lessons Learned

- **Always upgrade Jest when transitive deps emit deprecation warnings.** Jest 29 → 30 eliminated the `inflight` and `glob@7` deprecation warnings with zero test changes. (2026-03-10)
- **CodeQL cannot be scoped with per-job `on:` triggers** — it requires its own workflow file (`codeql.yml`) to control trigger conditions independently from the main CI workflow.
- **GitHub Pages: always include docs/index.html.** Without it Pages falls back to README.md. Use `<meta http-equiv="refresh">` to redirect to the real entry point.
- **Chart.js has no built-in data labels.** When bars need score/badge text, use an HTML/CSS bar chart instead of a canvas. No extra dependency required. (L-0041, 2026-04-19)
- **STATUS_WEIGHTS must include both `'In-Progress'` and `'In Progress'`.** The parser emits the space variant; missing it silently defaults all In-Progress stories to the fallback weight. (L-0042, 2026-04-19)
- **Use `MONTH_NAMES` array for date formatting in server-rendered strings** — `toLocaleDateString` fails on slim-ICU Node (Alpine CI). (2026-04-19)
- **Pure computation modules should duplicate tiny utilities** rather than import from render-layer modules — avoids cross-layer deps and keeps the module independently testable. (L-0043, 2026-04-19)
- **peaceiris/actions-gh-pages deploys the full filesystem.** Never add a `git add / commit` step for the generated artifact — it's gitignored and the deploy action works directly from disk.
- **Add workflow_dispatch to any workflow with path filters.** This is the only way to trigger the workflow manually when the changed files don't match the path filter (e.g. when editing the workflow file itself).
- **Worktree test files are picked up by jest in the main repo.** The worktree lives inside the repo directory and is not excluded by jest globs. When source files change, sync the worktree test assertions too or the main `npx jest` run will fail. (2026-04-22 Session 25)
- **View-toggle active state must use a CSS class, not inline styles.** `classList.toggle('active-view', bool)` is the correct pattern — `style.fontWeight/background` inline is invisible to devtools cascade and cannot be overridden by themes or media queries. (2026-04-22)
- **Multi-agent pipeline: `Assignee:` per story is the wrong model.** Stories pass through 4–6 agents; no single one "owns" it. Agent Workload widget should read from `docs/sdlc-status.json` (live) not a static field. Captured as US-0147. (2026-04-22)
- **Tab-level patterns need a shared helper from the moment they appear in a second tab.** Epic group headers were invented in Bugs; Lessons duplicated them manually and drifted. Extract to a named function immediately. (2026-04-22)
- **Always update TEST_CASES.md Status fields when a story is marked Done.** The parser is correct; stale Not Run statuses are a data problem. (L-0010, BUG-0003, 2026-03-10)
- **Sticky header: wrap renderTopBar + renderFilterBar + renderTabs in `<div class="sticky top-0 z-30">` in renderHtml().** Activity panel uses z-index:50, so z-30 keeps header below it. (L-0009, BUG-0004, 2026-03-10)
- **HTML-escape all user-supplied strings before interpolation into HTML template literals.** Use a single `esc()` helper; apply to every title, summary, AC text, epic description, bug branch. Do NOT escape internally-generated fields (SHA, timestamps). (L-0011, BUG-0005, 2026-03-10)
- **Use an `available` boolean flag, not `> 0`, to distinguish "file absent" from genuine 0% coverage.** `parseCoverage()` sets `available: true` on valid data and `available: false` in all fallback paths. The inline fallback in `generate-plan.js` must also set `available: false`. (L-0012, BUG-0010, 2026-03-10)
- **progress.md is written newest-first; do not sort or reverse.** The fixture and real file both place the most recent session at the top. If a test requires reverse-chronological order, add a regression test that asserts descending dates without changing the parser. (L-0013, BUG-0011 false positive, 2026-03-10)
- **AI cost attribution uses exact branch name matching.** `attributeAICosts()` matches `story.branch` against cost log `Branch` values — case-sensitive exact match. Backfill missing cost rows with `[est]` entries when a branch has no matching rows. (BUG-0023, 2026-03-16)
- **Generate-plan.js and render-html.js must use identical key names for cost data.** Any field passed through the JSON data object must use the same key in both files. The `aiCostUsd` vs `costUsd` mismatch caused all per-story AI costs to show $0 while the totals row (which reads `costs._totals.costUsd` directly) was unaffected. (L-0014, BUG-0023, 2026-03-16)
- **Dual y-axes are required when Chart.js datasets differ by 3+ orders of magnitude.** Sharing one y-axis makes the smaller dataset sub-pixel. Use `yAxisID` on each dataset and define two separate `scales` entries (position: left / right). (L-0015, BUG-0024, 2026-03-16)
- **Mobile layout: use `@media (max-width: 767px)` with `!important` to override Tailwind CDN utilities.** Tailwind CDN emits utility classes at runtime — inline `!important` overrides in a `<style>` block are needed to beat specificity. (L-0016, BUG-0020, 2026-03-16)
- **Activity panel z-order: give the close button a higher z-index than the panel, or place it inside the panel.** The toggle button was at `z-50` but the panel covered it once opened. Fixed by adding a `×` button inside the panel header with `md:hidden`. (L-0017, BUG-0022, 2026-03-16)
- **Bug status `Fixed (...)` strings must use prefix regex, not equality.** `!/^Fixed/i.test(b.status)` catches extended status strings like "Fixed (false positive — …)". Plain `=== 'Fixed'` would count those bugs as open. (BUG-0011, 2026-03-30)
- **Default collapsed state: set `hidden` class on content elements + ▶ (&#9654;) on arrows in templates.** `toggleSection()` logic uses `classList.toggle('hidden')` and sets arrow based on resulting hidden state — no JS init code needed. Use `replace_all` on `&#9660;</span>` → `&#9654;</span>` to batch-change all template arrows without touching JS toggle logic. (Session 13, 2026-03-30)
- **Sort epic groups in comparators: always put `_ungrouped` last.** Sort: `if (a === '_ungrouped') return 1; if (b === '_ungrouped') return -1; return a.localeCompare(b)`. Cover all comparator branches in tests by using data with 2 named epics + 1 ungrouped bug. (Session 13, 2026-03-30)
- **Retired stories should be excluded from the Stories chip denominator.** Filter with `status !== 'Retired'` before counting Done/total. Retired work is abandoned scope, not incomplete work. (Session 13, 2026-03-30)

## Session 18 learnings (2026-04-15/16) — EPIC-0016 Agentic Dashboard Mission Control

### Parallel-wave merge discipline

- **Base drift is inevitable when 2+ parallel Wave stories touch the same file.** Every sibling merge advances develop, forcing rebase on remaining open PRs. The BLOCK-rebase cycle is procedural, not a quality defect.
- **When rebase hits multi-commit conflicts, respawn the sub-agent on fresh develop instead of fighting git.** Cost of respawning an XS/S/M story is usually less than untangling overlapping CSS+HTML hunks across sibling merges. Applied for US-0115.
- **Test file conflicts are almost always additive**: both sides add new `describe` blocks. Just delete the 3 conflict markers keeping BOTH sides — but carefully verify closing braces survive. If the conflict markers sit between siblings' closing `});` and opening `describe`, you'll delete a `});` unintentionally and produce a syntax error. Verify with `npx prettier --check` and manually re-add the missing `});` before force-push.
- **Auto-merge pauses on BEHIND state.** No need to keep re-enabling; just rebase + force-push and auto-merge fires the moment the branch is up-to-date with develop and CI green.

### Prettier / PROMPT_LOG drift

- `PROMPT_LOG.md` table rows with inconsistent column alignment are a recurring Prettier-check failure source. Whenever you edit PROMPT_LOG manually, run `npx prettier --write PROMPT_LOG.md` before committing.
- `npx prettier --check .` (repo-wide, no file filter) is the fastest way to find what CI will flag — worktree sub-agents sometimes lint only their own touched files and miss repo-wide drift.

### Live-fetch + file:// protocol

- US-0111's `refreshState()` uses `fetch('./sdlc-status.json')`. Opening `docs/dashboard.html` via `file://` triggers browser CORS → fetch fails → graceful STALE state. GitHub Pages + any HTTP server (`npx serve docs/`, `python3 -m http.server`) work normally.
- `docs/sdlc-status.json` is gitignored, so the deployed GitHub Pages copy has no status file by default. The Pages build step must run `npm run init:status` (or generate-dashboard must tolerate the 404 gracefully — current behavior). Documented as deploy concern.

### Derive-don't-store metrics pattern (BUG-0166 root cause)

- `sdlc-status.json.metrics` is a hand-maintained key-value store; nothing recomputes it. It drifts immediately. **Rule: at render time in generate-dashboard.js, override metrics with values derived from authoritative sources (`docs/plan-status.json` for stories/tasks/epics/bugs, `docs/coverage/` for tests/coverage).** Codified in the loadPlanData helper.
- Tests Passed / Phases Complete / Reviews still read stale — needs EPIC-0017 jest-summary persistence OR EPIC-0019 cycle-reset semantics.

### CSS flex/grid + ellipsis truncation

- For `text-overflow: ellipsis` to work inside a flex child that lives in a CSS grid cell, BOTH layers need `min-width: 0`:
  - Grid-cell selector (`.epic-stories > *`) OR the flex-child itself if it IS the grid item
  - Flex child with `flex: 1 min-width: 0` that has the ellipsis CSS
- Title-level `min-width: 0` alone is not sufficient; the parent flex container + grid cell intrinsic-width chain all need to allow shrinking.

### Chart vertical centering in equal-height grid rows

- CSS grid rows force all cards to the tallest sibling's height. A fixed-size chart (e.g., `height:300px`) inside a card that's stretched to 648px ends up pinned to the top with empty space below.
- Fix: `.card-elev { display: flex; flex-direction: column }` + wrap chart in `<div class="flex-1 flex items-center justify-center">` so the chart centers vertically inside any stretched card.

### AudioContext singleton pattern

- Browsers throttle/suspend AudioContext instances aggressively. Creating one per `playBeep()` call leaks context instances (BUG-0160).
- Standard pattern: module-level `_audioCtx = null` + `getAudioContext()` helper that lazily creates once and calls `ctx.resume()` when `state === 'suspended'`. Early-exit with `null` on unsupported browsers.

### Live DOM patching without reload (US-0111)

- Replace `location.reload()` with `refreshState() → fetch + patchDOM + runAlertCheck`. Preserves scroll, modal state, any user DOM interaction.
- Give every volatile element a stable ID at generate time (`#phase-<id>`, `#agent-<name>`, `#metric-<key>`, `#log-scroll`). Client-side `patchDOM(status)` updates text/classes only — never `innerHTML` on large regions.
- Activity log uses append-only pattern via `data-log-key` dedup instead of re-rendering the whole log.
- `runAlertCheck(status)` must handle BOTH raw status AND pre-built snapshot shapes (page-load calls with `DASH_SNAPSHOT`, refreshState calls with parsed JSON).

### EPIC-0016 architecture legacy

- 6 phases canonical: Blueprint, Architect, Build, Integration, Test, Polish (no Deploy — that's EPIC-0019 scope).
- Departure Mono (display), Geist (sans), JetBrains Mono (monospace tickers/coverage %) are the 3 dashboard typefaces.
- `tools/lib/theme.js` now owns the BADGE_TONE map + badge() helper; both `render-html.js` and `generate-dashboard.js` import from it. Drift eliminated.
- `.section-header` utility: Geist, 11px/700, uppercase, 0.14em tracking. Shared across sections.
- `.live-dot` component: 6×6 circle, ok/warn/err variants, pulse animation with `prefers-reduced-motion` guard. Used in header clock, spotlight, Quality card, Activity log.
- Agent portraits: read from `docs/agents/images/optimized/{avatar}-{64,160,320}.png`. Fallback chain: optimized → headshot → emoji. `avatar` base name lives in agents.config.json per agent.
