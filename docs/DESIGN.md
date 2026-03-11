# PlanVisualizer — Design Document

**Version:** 1.2
**Status:** Active
**Last Updated:** 2026-03-11

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

---

## 5. Feature Set

### Dashboard Tabs

| Tab | Content |
|-----|---------|
| **Hierarchy** | Epic → Story → AC tree, collapsible, with status badges and risk warnings |
| **Kanban** | 5-column board (To Do / Planned / In Progress / Blocked / Done) |
| **Traceability** | Story × Test Case matrix showing Pass/Fail/Not Run linkage |
| **Charts** | Epic progress, cost breakdown, coverage donut, AI cost timeline, burndown, burn rate |
| **Costs** | Per-story projected vs. actual AI cost table with token counts |
| **Bugs** | Bug register with severity, status, fix branch, and lesson-encoded flag |

### Top Bar
Displays project name, tagline, last-generated timestamp, commit SHA, overall progress bar, stories done/in-progress count, projected cost, actual AI cost, line coverage %, and branch coverage %.

### Filters
Epic, status, priority, type (stories/bugs/both), and free-text search filters apply across the Hierarchy and Kanban tabs in real-time.

### Recent Activity
A floating panel shows the 5 most recent session summaries parsed from `progress.md`.

---

## 6. Design System

| Token | Value |
|-------|-------|
| Primary font | Inter (Google Fonts) |
| Monospace font | JetBrains Mono (Google Fonts) |
| Framework | Tailwind CSS (CDN) |
| Charts | Chart.js v4 (CDN) |
| Background | `bg-slate-50` |
| Top bar | `bg-gradient-to-r from-slate-900 via-slate-800 to-slate-900` |
| Accent (primary) | `text-blue-400` / `bg-blue-500` |
| Success | `text-green-400` / `bg-green-100` |
| Warning | `text-orange-500` / `bg-yellow-100` |
| Danger | `text-red-400` / `bg-red-100` |

Status badge colours are defined in `render-html.js` `badge()` function and must not be overridden inline.

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
RELEASE_PLAN.md ──► parseReleasePlan()  ─┐
TEST_CASES.md   ──► parseTestCases()    ─┤
BUGS.md         ──► parseBugs()         ─┤
AI_COST_LOG.md  ──► parseCostLog()      ─┤──► data{} ──► renderHtml() ──► plan-status.html
coverage.json   ──► parseCoverage()     ─┤              plan-status.json
progress.md     ──► parseRecentActivity()─┤
                    computeCosts()       ─┤
                    detectAtRisk()      ─┘
```

---

## 9. Constraints & Non-Goals

- **Not a live dashboard.** The HTML is static; it reflects the state of the markdown files at generation time.
- **Not a Markdown editor.** PlanVisualizer reads markdown but never modifies it (except the cost hook appending to AI_COST_LOG.md).
- **Not a replacement for git.** Branch names in stories must match actual git branches for cost attribution to work.
- **No authentication.** The generated HTML is public. Do not include sensitive data in the source markdown files.
- **No offline CDN.** Tailwind and Chart.js are loaded from CDN. The dashboard requires internet access to render correctly.
