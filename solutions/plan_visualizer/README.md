# PlanVisualizer

> **Author:** Kamal Syed | **Role:** Delivery Manager | **Last Updated:** 2026-04-10

## Problem Statement

Managing an AI-assisted software project means accumulating dozens of markdown files — release plans, bug logs, test cases, cost logs, coverage reports, and session notes — with no unified view. Each week, assembling a status update required opening five or six files, mentally joining story statuses to test coverage numbers to open bug counts, with no sense of trend or burn rate. When the AI agent completed a session, understanding what it cost required manually parsing a log file. Identifying which stories were at risk required cross-referencing test cases, bugs, and coverage by hand.

## Solution Overview

PlanVisualizer is a self-contained Node.js dashboard generator that reads your project's markdown source-of-truth files and produces two interactive static HTML dashboards — no server, no cloud service, no authentication required.

The **Plan Visualizer dashboard** (`plan-status.html`) provides an eight-tab view of your project: a story hierarchy with epic grouping, a Kanban board, a traceability matrix linking stories to test cases and bugs, status charts, trend graphs for velocity and AI costs, a cost breakdown by epic, a bug register, and an encoded lessons log. A global search (⌘K / Ctrl+K) lets you find any story, bug, or test case instantly.

The **SDLC Agentic dashboard** (`dashboard.html`) shows a live snapshot of the multi-agent pipeline — which agents are active, session logs, and agent status — designed for projects using specialised Claude Code sub-agents.

A Claude Code Stop hook (`capture-cost.js`) automatically appends session token usage and cost to `docs/AI_COST_LOG.md` every time a session ends, keeping the cost ledger up to date without any manual logging.

## Who Is This For?

- **Primary audience:** Delivery Managers and Architects managing AI-assisted software projects on Claude Code
- **Also useful for:** Program Managers needing project health visibility, developers who want a self-documenting project dashboard, anyone using AGENTS.md-style release planning

## Key Benefits

- Eliminates manual status aggregation — run `node tools/generate-plan.js` and the full project picture is ready in under two seconds
- AI cost tracking is fully automatic — the Stop hook logs every session without any user action
- Trend charts reveal velocity, burn rate, and coverage trajectory over time, enabling data-driven forecasting
- No dependencies on external services — works offline, no API keys, no cloud accounts
- Designed to work alongside Claude Code and Superpowers — the AGENTS.md framework, ID registry, and session protocols are built in

## AI Tools & Platforms Used

| Tool/Platform | Version / Variant | Purpose in Solution |
|--------------|-------------------|---------------------|
| Claude Code CLI | Latest (tested with Sonnet 4.6) | Primary development environment; Stop hook captures session costs automatically |
| Claude Desktop | Optional | Can be used as an alternative interface for querying dashboard data |

## MCP Servers & Integrations

None. PlanVisualizer is entirely self-contained. All data is read from local markdown files and the Claude Code session transcript. No external APIs or MCP servers are required at runtime.

The Claude Code Stop hook reads from the local JSONL session transcript at `~/.claude/projects/<project-dir>/<session_id>.jsonl` — this is a local file, not a network call.

## Quick Links

- [Architecture](ARCHITECTURE.md) — How it's designed
- [Installation](INSTALLATION.md) — How to set it up
- [Usage Guide](USAGE.md) — How to use it day-to-day

## Status

- [ ] In development
- [ ] Working for me, not yet tested by others
- [ ] Tested by at least one other team member
- [x] Stable and recommended for general use

## Screenshots / Demo

<!-- ![Plan Visualizer dashboard](assets/plan-status-screenshot.png) -->
<!-- ![SDLC Agentic dashboard](assets/dashboard-screenshot.png) -->
