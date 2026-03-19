# PlanVisualizer — Design Document

**Version:** 1.3
**Status:** Active
**Last Updated:** 2026-03-18

---

## 1. Product Vision

PlanVisualizer turns markdown-based project management files into a beautiful, self-contained HTML dashboard — with zero runtime dependencies, no server, and no build step. It is the visual layer on top of the AGENTS.md workflow.

---

## 2. Problem Statement

Claude Code projects following the AGENTS.md workflow maintain all project state in plain markdown files: epics, stories, tasks, test cases, bugs, AI costs, and session logs. These files are precise and portable, but invisible. There is no way to see at a glance:

- How many stories are done vs. in-progress vs. blocked?
- Which stories are at risk (no tests, no branch, failing TCs)?
- How much has the project cost in AI tokens so far?
- Is test coverage meeting the 80% target?

PlanVisualizer solves this by parsing those same markdown files and generating a single `plan-status.html` that can be opened in any browser or deployed to GitHub Pages.

---

## 3. User Profile

**Primary user:** A solo developer or small team using Claude Code with the AGENTS.md workflow. They are technically proficient, work primarily in the terminal, and maintain project state in markdown files committed to git. They want visibility into project health without adopting heavyweight project management tools.

**Secondary user:** A stakeholder or reviewer who needs a read-only view of project status without access to the raw markdown files.

**Non-user:** Teams using Jira, Linear, or GitHub Projects. PlanVisualizer is not a replacement for those tools — it is a companion to the markdown-first AGENTS.md workflow.

---

## 4. Core Concepts

### Markdown as source of truth
`RELEASE_PLAN.md`, `TEST_CASES.md`, `BUGS.md`, `AI_COST_LOG.md`, and `progress.md` are the authoritative records. PlanVisualizer reads from them; it never writes to them (except `AI_COST_LOG.md` via the capture-cost hook).

### Zero runtime dependencies
The generated `plan-status.html` is fully self-contained except for two CDN resources (Tailwind CSS, Chart.js). No Node.js, no server, no database. The file can be emailed, shared, or deployed as-is.

### Cost attribution by branch
AI session costs are attributed to user stories by matching the git branch name in `AI_COST_LOG.md` to the `Branch:` field in each story. This gives per-story AI spend with no manual tagging.

### At-risk detection
Four automated signals flag a story as ⚠ At Risk:
1. **Missing TCs** — story has acceptance criteria but no linked test cases
2. **No branch** — story is "In Progress" but has no git branch set
3. **Failed TC, no bug** — a test case for the story has status "Fail" but no defect has been raised
4. **Open critical/high bug** — an open Critical or High severity bug is linked to this story

Stories with status `Done` are never flagged at risk regardless of the above signals.

---

## 5. Feature Set

### Dashboard Tabs

| Tab | Content |
|-----|---------|
| **Hierarchy** | Epic → Story → AC tree (column view) or story card grid per epic (card view); toggle persists to localStorage |
| **Kanban** | 5-column board (To Do / Planned / In Progress / Blocked / Done); each column scrolls independently |
| **Traceability** | Story × Test Case matrix showing Pass/Fail/Not Run linkage |
| **Charts** | Epic progress, cost breakdown, coverage donut, AI cost timeline, burndown, burn rate; all charts at uniform 300 px height |
| **Costs** | Per-story projected vs. actual AI cost table with totals; Bug Fix Costs sub-table with totals row |
| **Bugs** | Bug register with severity, status, fix branch, lesson-encoded flag; filterable by status and free-text search |
| **Lessons** | Lesson register (column/card view) parsed from LESSONS.md; Bug Ref column cross-links to referencing bugs |

### Top Bar
Displays project name, tagline, last-generated timestamp (date + time UTC), commit SHA, overall progress bar, stories done/in-progress count, projected cost, actual AI cost, line coverage %, and branch coverage %.

### Filters
The filter bar is positioned below the tab bar and shows only the controls relevant to the active tab:
- **Hierarchy / Kanban tabs:** epic, status, priority, and free-text search filters
- **Bugs tab:** status dropdown and free-text search
- **All other tabs:** filter bar hidden

### Recent Activity
A floating panel shows the 5 most recent session summaries parsed from `progress.md`. Each entry displays "Session N · YYYY-MM-DD" alongside the session summary.

---

## 6. Design System

| Token | Value |
|-------|-------|
| Primary font | Inter (Google Fonts) |
| Monospace font | JetBrains Mono (Google Fonts) |
| Framework | Tailwind CSS (CDN) |
| Charts | Chart.js v4 (CDN) |
| Accent (primary) | `text-blue-400` / `bg-blue-500` |
| Success | `text-green-400` / `bg-green-100` |
| Warning | `text-orange-500` / `bg-yellow-100` |
| Danger | `text-red-400` / `bg-red-100` |

### CSS Theme Tokens
All dashboard colours are defined as CSS custom properties (`--clr-*`) in `:root` (light theme) and `html.dark` (dark theme) blocks inside the generated HTML. No hardcoded hex literals appear in CSS property rules. Dark mode is activated by adding the `dark` class to `<html>` via `toggleTheme()`; the chosen preference is persisted to `localStorage`.

Key tokens: `--clr-body-bg`, `--clr-panel-bg`, `--clr-surface-raised`, `--clr-border`, `--clr-header-bg`, `--clr-header-text`, `--clr-input-bg`, `--clr-input-border`, `--clr-chart-text`, `--clr-accent`, and semantic text tokens.

Status badge colours are defined in `render-html.js` `badge()` function and must not be overridden inline.

### Viewport-Fill Tabs
Tabs that contain scrollable tables (Bugs, Traceability, Lessons, Kanban) use the `.tab-fill` CSS class: `display:flex; flex-direction:column; height:calc(100vh - var(--sticky-top))`. The inner scroll container gets `flex:1; min-height:0` so it fills remaining space rather than collapsing to content height.

---

## 7. Configuration

All configuration lives in `plan-visualizer.config.json` (gitignored; created from `plan-visualizer.config.example.json`). Keys:

| Key | Default | Purpose |
|-----|---------|---------|
| `project.name` | `"My Project"` | Dashboard title |
| `project.tagline` | `"A short description."` | Dashboard subtitle |
| `docs.releasePlan` | `"docs/RELEASE_PLAN.md"` | Release plan source |
| `docs.testCases` | `"docs/TEST_CASES.md"` | Test cases source |
| `docs.bugs` | `"docs/BUGS.md"` | Bug log source |
| `docs.costLog` | `"docs/AI_COST_LOG.md"` | AI cost log source |
| `docs.outputDir` | `"docs"` | Output directory |
| `coverage.summaryPath` | `"docs/coverage/coverage-summary.json"` | Jest coverage output |
| `progress.path` | `"progress.md"` | Session progress log |
| `costs.hourlyRate` | `100` | USD/hr for projected cost |
| `costs.tshirtHours` | `{S:4, M:8, L:16, XL:32}` | Hours per size estimate |

---

## 8. Data Flow

```
RELEASE_PLAN.md ──► parseReleasePlan()   ─┐
TEST_CASES.md   ──► parseTestCases()     ─┤
BUGS.md         ──► parseBugs()          ─┤
AI_COST_LOG.md  ──► parseCostLog()       ─┤──► data{} ──► renderHtml() ──► plan-status.html
coverage.json   ──► parseCoverage()      ─┤              plan-status.json
LESSONS.md      ──► parseLessons()       ─┤
progress.md     ──► parseRecentActivity()─┤
                    (+ sessionNum)        ─┤
                    computeCosts()        ─┤
                    detectAtRisk()       ─┘
```

---

## 9. Constraints & Non-Goals

- **Not a live dashboard.** The HTML is static; it reflects the state of the markdown files at generation time.
- **Not a Markdown editor.** PlanVisualizer reads markdown but never modifies it (except the cost hook appending to AI_COST_LOG.md).
- **Not a replacement for git.** Branch names in stories must match actual git branches for cost attribution to work.
- **No authentication.** The generated HTML is public. Do not include sensitive data in the source markdown files.
- **No offline CDN.** Tailwind and Chart.js are loaded from CDN. The dashboard requires internet access to render correctly.
