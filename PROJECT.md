# PROJECT.md — PlanVisualizer Project Constitution

> This is the project-specific constitution referenced by `AGENTS.md`. It contains data schemas, behavioral rules, architectural invariants, user profile, and the design system. Update this file whenever a schema changes, a rule is added, or architecture is modified.

---

## §1 Project Overview

**Name:** PlanVisualizer
**Purpose:** A self-contained Node.js tool that parses a project's markdown documentation files and generates a static single-file HTML dashboard for project tracking.

**North Star:** Any engineer or AI agent can open the generated `plan-status.html` and immediately understand project status, risk, costs, and coverage without a backend or build tool.

**Integrations:** None (no external APIs). Reads local files; outputs a single HTML file deployed to GitHub Pages.

**Source of Truth:** `docs/RELEASE_PLAN.md`, `docs/TEST_CASES.md`, `docs/BUGS.md`, `docs/AI_COST_LOG.md`, `coverage/coverage-summary.json`, `progress.md`.

**Delivery Payload:** `docs/plan-status.html` — a self-contained HTML file deployed to GitHub Pages at `https://ksyed0.github.io/PlanVisualizer/`.

---

## §2 Data Schemas

### Input: plan-visualizer.config.json

```json
{
  "projectName": "string",
  "tagline": "string",
  "releasePlanPath": "docs/RELEASE_PLAN.md",
  "testCasesPath": "docs/TEST_CASES.md",
  "bugsPath": "docs/BUGS.md",
  "costLogPath": "docs/AI_COST_LOG.md",
  "coveragePath": "coverage/coverage-summary.json",
  "progressPath": "progress.md",
  "outputDir": "docs",
  "outputFile": "plan-status.html"
}
```

### Parser Output Contracts

All parsers: `(markdown: string) → Array` — never throw; empty string returns `[]`.

| Parser                  | Key fields returned                                                             |
| ----------------------- | ------------------------------------------------------------------------------- |
| `parse-release-plan.js` | `epics[]`, `stories[]`, `tasks[]`                                               |
| `parse-test-cases.js`   | `testCases[{ id, relatedStory, relatedAC, status, defect, title, type }]`       |
| `parse-bugs.js`         | `bugs[{ id, title, severity, status, relatedStory, fixBranch, lessonEncoded }]` |
| `parse-cost-log.js`     | `rows[{ date, branch, inputTokens, outputTokens, costUsd }]`                    |
| `parse-coverage.js`     | `{ lines, statements, functions, branches, overall, meetsTarget }`              |
| `parse-lessons.js`      | `lessons[{ id, title, rule, context, date }]`                                   |
| `parse-progress.js`     | `activity[{ sessionNum, date, summary }]`                                       |

### compute-costs.js Output

```js
{
  [storyId]: { projectedUsd, aiCostUsd: costUsd, inputTokens, outputTokens },
  _totals: { costUsd, inputTokens, outputTokens }
}
```

**Note:** The cost key is `costUsd` (not `aiCostUsd`). Branch name in `AI_COST_LOG.md` must exactly match `Branch:` field in the story for attribution to work.

---

## §3 Architectural Invariants

1. **No production dependencies.** The tool must run with `node tools/generate-plan.js` on any machine with Node.js 18+ and no `npm install`.
2. **Single output file.** The dashboard is always one self-contained HTML file. No external file references except CDN links (Tailwind, Chart.js).
3. **Parsers never throw.** All parsers return empty arrays on bad input; errors are surfaced by the orchestrator.
4. **Parsers are pure functions.** No side effects; input is a markdown string; output is a data array.
5. **render-html.js is the only renderer.** All HTML generation lives in one file; no templating engine.

---

## §4 Behavioral Rules

- Dashboard must show overall completion % in the header.
- At-risk stories are flagged with ⚠ when: missing TCs, no branch while In Progress, or failed TC without a linked bug. Stories with status `Done` are never flagged at risk.
- Coverage displays red when `meetsTarget: false` (below 80%).
- Costs tab groups stories by epic with subtotal rows; Bug Fix Costs sub-table includes a totals row.
- Filter bar is positioned below the tab bar and shows only the controls applicable to the active tab: story filters for Hierarchy/Kanban, bug filters for Bugs, hidden for all other tabs.
- Lessons tab surfaces LESSONS.md entries with column/card view and Bug Ref cross-links.
- Recent Activity panel is fixed right, 280px expanded / 40px collapsed, persisted in `localStorage`. Each entry shows "Session N · YYYY-MM-DD".
- Print CSS hides all panels and navigation.
- CSS colour tokens (`--clr-*`) defined in `:root` (light) and `html.dark` (dark) are the sole source of colour values; no hardcoded hex in CSS property rules.

---

## §5 User Profile

**Primary user:** The project owner / lead developer — technically proficient, comfortable with markdown and Git, monitors progress via the dashboard between coding sessions.

**Secondary user:** AI coding agents — read AGENTS.md and PROJECT.md to understand project state before taking action.

**Usage context:** Dashboard opened in a desktop browser. Not optimised for mobile. Print-to-PDF for sharing.

---

## §6 Design System

**Framework:** Tailwind CSS (CDN) — no build step.

**Dark mode:** Controlled via `html.dark` class toggled by `toggleTheme()`; preference persisted to `localStorage`. All colours are expressed as CSS custom properties (`--clr-*`).

**Colour tokens:**

| Token              | Value                               | Usage                |
| ------------------ | ----------------------------------- | -------------------- |
| Tab bar background | `bg-slate-800`                      | Navigation tab bar   |
| Tab active text    | `text-blue-300` / `border-blue-400` | Active tab indicator |
| Tab inactive text  | `text-slate-400`                    | Inactive tabs        |
| At-risk badge      | `bg-amber-100 text-amber-800`       | Risk warnings        |
| Done badge         | `bg-green-100 text-green-800`       | Completed status     |
| In Progress badge  | `bg-blue-100 text-blue-800`         | Active status        |
| Planned badge      | `bg-purple-100 text-purple-700`     | Planned status       |
| Blocked badge      | `bg-red-100 text-red-800`           | Blocked status       |

**Charts:** Chart.js v4 (CDN). All charts render at 300 px height (`maintainAspectRatio:false`). Coverage: doughnut. AI Costs: bar. Story status: doughnut.

**Typography:** Inter (Google Fonts) for body; JetBrains Mono for monospace.

---

## §7 Maintenance Log

| Date       | Change                                                                                                                                                                                                                                                                                 | Who               |
| ---------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------- |
| 2026-03-10 | Initial constitution created                                                                                                                                                                                                                                                           | Claude Sonnet 4.6 |
| 2026-03-18 | Added parse-lessons.js; sessionNum to parse-progress output; per-tab filter bar; Hierarchy card view; Bug tab filtering; CSS theme tokens; at-risk Done exclusion; Lessons tab; uniform chart heights; viewport-fill tabs; Bug Fix Costs totals row; session number in Recent Activity | Claude Sonnet 4.6 |
