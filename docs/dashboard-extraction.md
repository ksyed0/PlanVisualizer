# Dashboard Extraction Guide

Step-by-step guide for adopting the Agentic SDLC Dashboard in another project.

## What You Get

- `docs/dashboard.html` — self-contained live dashboard (no build step required)
- `docs/sdlc-status.json` — runtime state file updated by the Conductor
- `tools/update-sdlc-status.js` — CLI for the Conductor to update state
- `tools/init-sdlc-status.js` — initializes sdlc-status.json from your config

## Prerequisites

- Node.js 18+
- An `agents.config.json` in your project root (see Step 2)

## Steps

### 1. Copy the files

```bash
mkdir -p docs tools orchestrator
cp /path/to/PlanVisualizer/docs/dashboard.html docs/
cp /path/to/PlanVisualizer/tools/update-sdlc-status.js tools/
cp /path/to/PlanVisualizer/tools/init-sdlc-status.js tools/
cp /path/to/PlanVisualizer/orchestrator/atomic-write.js orchestrator/
```

Or run the interactive installer:

```bash
bash /path/to/PlanVisualizer/scripts/install.sh
```

### 2. Add `project` and `phases` to agents.config.json

```json
{
  "project": {
    "name": "Your Project Name",
    "description": "A short description",
    "repoUrl": "https://github.com/yourorg/your-project",
    "startDate": "2026-01-01"
  },
  "phases": [
    { "name": "Build",  "agents": ["Dev"],  "deliverables": ["implementation"] },
    { "name": "Test",   "agents": ["QA"],   "deliverables": ["test report"] }
  ],
  "agents": {
    "Dev":  { "role": "Backend Developer" },
    "QA":   { "role": "Functional Tester" }
  }
}
```

### 3. Initialize the status file

```bash
node tools/init-sdlc-status.js
```

This creates `docs/sdlc-status.json` seeded with your project config. The dashboard reads this file every 5 seconds.

### 4. Open the dashboard

Serve `docs/` with any static server or open `docs/dashboard.html` directly in a browser:

```bash
npx serve docs
```

### 5. Wire the Conductor

At the start of each pipeline session:

```bash
node tools/update-sdlc-status.js session-start --stories 5
node tools/update-sdlc-status.js epic-start --epic EPIC-0001 --name "My Epic" --stories 5
```

At each phase transition:

```bash
node tools/update-sdlc-status.js phase --number 1 --status in-progress
node tools/update-sdlc-status.js phase --number 1 --status complete
```

See `docs/agents/DM_AGENT.md` §Conductor Pipeline Checklists for the full command reference.

### 6. End of session

```bash
node tools/update-sdlc-status.js epic-complete --epic EPIC-0001
node tools/update-sdlc-status.js cycle-complete
```

`cycle-complete` snapshots metrics into `cycles[]` and resets runtime state for the next session.
