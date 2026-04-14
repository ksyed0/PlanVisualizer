# Architecture — PlanVisualizer

> This document describes how the solution is designed, what components it uses, and how they connect.

## Architecture Overview

```
Markdown source files          Node.js generators           Static HTML output
─────────────────────          ──────────────────           ──────────────────
docs/RELEASE_PLAN.md  ──┐
docs/TEST_CASES.md    ──┤
docs/BUGS.md          ──┤──► generate-plan.js ──────────► docs/plan-status.html
docs/AI_COST_LOG.md   ──┤         │                        docs/plan-status.json
docs/LESSONS.md       ──┤    lib/ parsers
coverage-summary.json ──┘    lib/ renderers
                                   │
docs/sdlc-status.json ──────► generate-dashboard.js ──────► docs/dashboard.html
agents.config.json    ──┘

Claude Code session ──────► capture-cost.js (Stop hook) ──► docs/AI_COST_LOG.md
  (JSONL transcript)
```

The generators are pure Node.js scripts with no runtime dependencies. They parse markdown and JSON files, compute derived metrics (costs, at-risk signals, trends, budget), and render everything into self-contained HTML files with inline CSS and JavaScript.

## Components

### 1. `tools/generate-plan.js`

- **What it is:** Main CLI entry point for the Plan Visualizer dashboard
- **Role:** Orchestrates all parsers, computes derived data (projected costs, at-risk signals, trends, budget), saves a time-series snapshot, and renders the HTML dashboard
- **Location:** `tools/generate-plan.js`
- **Key outputs:** `docs/plan-status.html`, `docs/plan-status.json`, `.history/<timestamp>.json`

### 2. `tools/generate-dashboard.js`

- **What it is:** CLI entry point for the SDLC Agentic dashboard
- **Role:** Reads `docs/sdlc-status.json` and `agents.config.json`, renders the agent pipeline dashboard with session logs and agent status
- **Location:** `tools/generate-dashboard.js`
- **Key output:** `docs/dashboard.html`

### 3. `tools/capture-cost.js`

- **What it is:** Claude Code Stop hook script
- **Role:** Automatically runs at the end of every Claude Code session; reads the JSONL transcript to extract token counts, computes cost using current Claude Sonnet rates, and appends a ledger row to `docs/AI_COST_LOG.md`
- **Location:** `tools/capture-cost.js`
- **Triggered by:** `.claude/settings.json` Stop hook — runs automatically, no user action required

### 4. `tools/lib/` — Parser and Renderer Library

Sixteen focused modules, each with a single responsibility:

| Module | Purpose |
|--------|---------|
| `parse-release-plan.js` | Parses `RELEASE_PLAN.md` into epics, stories, tasks, and acceptance criteria |
| `parse-test-cases.js` | Parses `TEST_CASES.md` into structured test case objects |
| `parse-bugs.js` | Parses `BUGS.md` into bug records with severity, status, and fix branch |
| `parse-cost-log.js` | Parses `AI_COST_LOG.md`, deduplicates sessions, aggregates by branch |
| `parse-coverage.js` | Reads Jest coverage JSON; returns coverage percentages and `available` flag |
| `parse-progress.js` | Parses `progress.md` (newest-first session log) |
| `parse-lessons.js` | Parses `LESSONS.md` into structured lesson records |
| `compute-costs.js` | Attributes AI costs to stories by branch; distributes unattributed costs proportionally |
| `detect-at-risk.js` | Identifies at-risk stories (missing TCs, no branch, failed TC with no bug, open critical bug) |
| `snapshot.js` | Saves and loads time-series snapshots in `.history/`; extracts trend data |
| `historical-sim.js` | Backfills 30 days of simulated history when fewer than 2 real snapshots exist |
| `budget.js` | Computes per-epic budget allocation, burn rate, and projected exhaustion |
| `render-html.js` | Renders the complete `plan-status.html` (eight-tab dashboard) |
| `search-index.js` | Builds the global search index embedded in the HTML |

### 5. `plan-visualizer.config.json`

- **What it is:** Project-specific configuration file
- **Role:** Maps source file paths, sets cost rates, configures budget thresholds
- **Location:** `plan-visualizer.config.json` (project root)

### 6. `agents.config.json`

- **What it is:** Agent registry for the SDLC Agentic dashboard
- **Role:** Defines agent names, roles, icons, colours, and instruction file paths; configures dashboard title and branding
- **Location:** `agents.config.json` (project root)

## AI Configuration

### Stop Hook (Automatic Cost Capture)

- **Location:** `.claude/settings.json`
- **Key behaviour:** Every time a Claude Code session ends, `capture-cost.js` runs automatically and appends the session cost to `docs/AI_COST_LOG.md`. No manual log entry is needed.
- **Configuration:** The hook is registered in `.claude/settings.json` and fires on the `Stop` event.

```json
{
  "hooks": {
    "Stop": [
      {
        "hooks": [
          {
            "type": "command",
            "command": "node /path/to/your/project/tools/capture-cost.js",
            "timeout": 10,
            "statusMessage": "Capturing session cost..."
          }
        ]
      }
    ]
  }
}
```

### AGENTS.md — Operating Framework

- **Location:** `AGENTS.md` (project root)
- **Key behaviours configured:** Defines the complete operating protocol for the AI agent: the B-L-A-S-T framework (Blueprint, Link, Architect, Stylize, Trigger), ID registry standards (EPIC-XXXX, US-XXXX, BUG-XXXX, TC-XXXX), git workflow, testing standards (≥80% statement coverage), session close protocol, and the CLAUDE.md/MEMORY.md/PROMPT_LOG.md/LESSONS.md documentation loop.
- **Persona:** The AI acts as an autonomous software delivery team member following delivery management disciplines.

### CLAUDE.md — Platform-Specific Directives

- **Location:** `CLAUDE.md` (project root)
- **Key behaviours configured:** Claude Code–specific session startup checklist, commit message format, branching strategy, and session close checklist tailored to this repository.

### Skills / Plugins

| Name | Type | Purpose |
|------|------|---------|
| Superpowers plugin suite | Claude Code plugin | Provides brainstorming, planning, subagent-driven development, and branch-finishing workflows |

## MCP Servers

None. This solution does not use MCP servers.

## External Integrations (Non-MCP)

### Claude Code JSONL Transcript

- **Type:** Local file read
- **Purpose:** `capture-cost.js` reads the session transcript to extract token usage for cost calculation
- **Authentication:** None — local file access only
- **Rate limits:** N/A

### Jest Coverage Report

- **Type:** Local JSON file read
- **Purpose:** `parse-coverage.js` reads `coverage/coverage-summary.json` (generated by `npx jest --coverage`) to display statement, branch, function, and line coverage percentages
- **Authentication:** None
- **Rate limits:** N/A

### GitHub Pages (optional)

- **Type:** Static hosting
- **Purpose:** The generated HTML files can be deployed to GitHub Pages for team-wide access
- **Authentication:** GitHub Actions CI handles deployment automatically
- **Rate limits:** N/A

## Data Flow

1. **Input:** Developer runs `node tools/generate-plan.js` (or `npm run generate`) from the project root
2. **Parsing:** Each `tools/lib/parse-*.js` module reads its corresponding markdown file and returns structured data
3. **Computation:** `compute-costs.js`, `detect-at-risk.js`, and `budget.js` derive metrics from the parsed data
4. **Snapshot:** A time-series JSON snapshot is saved to `.history/<timestamp>.json`; if fewer than 2 snapshots exist, `historical-sim.js` backfills 30 days of simulated history
5. **Rendering:** `render-html.js` assembles all data into a single self-contained HTML file with inline CSS, JavaScript, and a global search index
6. **Output:** `docs/plan-status.html` and `docs/plan-status.json` are written to the configured output directory

For the SDLC dashboard: `docs/sdlc-status.json` + `agents.config.json` → `generate-dashboard.js` → `docs/dashboard.html`.

For cost capture: Claude Code session ends → Stop hook fires → `capture-cost.js` reads JSONL transcript → appends row to `docs/AI_COST_LOG.md`.

## Design Decisions

### Decision: Pure static HTML, no framework

- **Context:** The dashboard needed to be shareable without a server, deployable to GitHub Pages, and viewable without any local toolchain.
- **Choice:** Single self-contained HTML file with inline CSS and JavaScript.
- **Rationale:** Zero runtime dependencies, works offline, opens directly in a browser, trivially deployable anywhere that serves files.

### Decision: Append-only cost log

- **Context:** Token cost data must be accurate for budget forecasting; sessions can be replayed or re-processed.
- **Choice:** `docs/AI_COST_LOG.md` is append-only. Each session gets one row keyed by session UUID. `parse-cost-log.js` deduplicates by session ID (last row wins) when aggregating.
- **Rationale:** Prevents accidental data loss; enables safe re-processing without corrupting historical data.

### Decision: Markdown as source of truth

- **Context:** The project needed a format that both humans and AI agents could read and write reliably, without a database or web service.
- **Choice:** All project artefacts (epics, stories, test cases, bugs, lessons) live in versioned markdown files checked into the repository.
- **Rationale:** Git history provides a full audit trail; markdown is diff-friendly; no sync issues between tool and reality; AI agents can update files directly.

### Decision: No runtime dependencies

- **Context:** EPAM colleagues need to run this without `npm install` requiring network access or resolving conflicts with existing projects.
- **Choice:** All code is plain Node.js (v18+) with no `node_modules` runtime dependencies.
- **Rationale:** Zero installation friction; no supply-chain risk; works in any Node.js environment.

## Known Limitations

- Trend charts seeded by the 30-day historical backfill show today's data projected backwards — this is expected behaviour, not a data bug, but it means early trend data is simulated rather than real.
- The SDLC Agentic dashboard (`dashboard.html`) reads `docs/sdlc-status.json`; this file must be updated manually or by the agent orchestrator.
- Cost attribution works by matching a story's branch name to the cost log. Stories with no branch, or branches that don't appear in the cost log, receive a proportional share of unattributed costs rather than a direct attribution.
- Coverage data requires running `npx jest --coverage` before generating the dashboard — an `available: false` state is displayed if the coverage file is absent.

## Future Improvements

- [ ] Live reload mode: rebuild dashboard on file save without a full page reload
- [ ] Per-agent cost attribution in the SDLC dashboard
- [ ] Export budget summary to CSV directly from the dashboard UI
