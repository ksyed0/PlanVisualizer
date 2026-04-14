# Installation — PlanVisualizer

> Step-by-step instructions to get this solution running on your machine.

## Prerequisites

### Software & Accounts

| Requirement | Version / Details | How to Get It |
|------------|-------------------|--------------|
| Node.js | v18 or later | https://nodejs.org |
| npm | Comes with Node.js | — |
| Git | Any recent version | https://git-scm.com |
| Claude Code CLI | Latest version | `npm install -g @anthropic-ai/claude-code` |

No additional accounts, API keys, or cloud services are required. PlanVisualizer is fully self-contained.

### EPAM-Specific Access

- No EPAM VPN or internal access is required to install or run this solution.
- If you plan to deploy the generated dashboards to GitHub Pages, you will need appropriate repository permissions.

## Installation Steps

### Step 1: Clone the Repository

```bash
git clone https://github.com/ksyed0/PlanVisualizer.git
cd PlanVisualizer
```

Or, if you are adding PlanVisualizer to an existing project, copy the following files and folders into your project root:

```
tools/                         # All generator scripts and lib modules
plan-visualizer.config.json    # Configuration file
agents.config.json             # Agent registry (for SDLC dashboard)
.claude/settings.json          # Stop hook registration
AGENTS.md                      # AI agent operating framework
CLAUDE.md                      # Claude Code platform instructions
package.json                   # NPM manifest (scripts and devDependencies)
```

### Step 2: Install Developer Dependencies

```bash
npm install
```

This installs the test runner (Jest), linter (ESLint), and formatter (Prettier). There are no runtime dependencies — the generators use only Node.js built-ins.

### Step 3: Copy and Edit the Configuration File

```bash
cp plan-visualizer.config.example.json plan-visualizer.config.json
```

Open `plan-visualizer.config.json` and update each field to match your project:

```json
{
  "project": {
    "name": "Your Project Name",
    "tagline": "A short description of your project.",
    "githubUrl": "https://github.com/your-org/your-repo"
  },
  "docs": {
    "releasePlan": "docs/RELEASE_PLAN.md",
    "testCases": "docs/TEST_CASES.md",
    "bugs": "docs/BUGS.md",
    "costLog": "docs/AI_COST_LOG.md",
    "lessons": "docs/LESSONS.md",
    "outputDir": "docs"
  },
  "coverage": {
    "summaryPath": "coverage/coverage-summary.json"
  },
  "progress": {
    "path": "progress.md"
  },
  "costs": {
    "hourlyRate": 100,
    "tshirtHours": { "XS": 2, "S": 4, "M": 8, "L": 16, "XL": 32 }
  },
  "budget": {
    "totalUsd": null,
    "byEpic": {},
    "thresholds": [50, 75, 90, 100]
  }
}
```

**Important:** All paths under `docs` are relative to the project root and are case-sensitive on Linux CI runners. Use lowercase `docs/` consistently.

### Step 4: Create the Required Markdown Documents

If they don't already exist, create the source documents that PlanVisualizer reads:

```bash
mkdir -p docs
touch docs/RELEASE_PLAN.md docs/TEST_CASES.md docs/BUGS.md docs/AI_COST_LOG.md docs/LESSONS.md
touch progress.md
```

PlanVisualizer will generate an empty but valid dashboard from blank files. Populate them following the format in the existing PlanVisualizer documents — see `docs/RELEASE_PLAN.md` for the epic/story/task structure, `docs/BUGS.md` for the bug format, and so on.

### Step 5: Configure the Claude Code Stop Hook

The Stop hook automatically logs AI session costs. Register it by editing `.claude/settings.json` in your project root (create the file if it doesn't exist):

```json
{
  "hooks": {
    "Stop": [
      {
        "hooks": [
          {
            "type": "command",
            "command": "node /absolute/path/to/your/project/tools/capture-cost.js",
            "timeout": 10,
            "statusMessage": "Capturing session cost..."
          }
        ]
      }
    ]
  }
}
```

**Replace `/absolute/path/to/your/project/` with the actual path to your project root.** The path must be absolute because the hook runs from a different working directory than your project.

Find the absolute path with:

```bash
pwd
```

### Step 6: (Optional) Configure the SDLC Agentic Dashboard

If you plan to use the multi-agent SDLC dashboard, copy and edit the agent configuration:

```bash
cp agents.config.example.json agents.config.json
```

Edit `agents.config.json` to reflect your agent roster, roles, and branding. At minimum, update the `dashboard` section:

```json
{
  "dashboard": {
    "title": "Your Project Name",
    "subtitle": "Agentic AI SDLC",
    "footer": "Your Org | Agentic AI SDLC",
    "repoUrl": "https://github.com/your-org/your-repo",
    "primaryColor": "#1565C0",
    "platform": "Claude Code"
  }
}
```

Then initialise the SDLC status file:

```bash
node tools/init-sdlc-status.js
```

## Verify It Works

Run the plan generator:

```bash
node tools/generate-plan.js
```

**Expected output:**

```
[generate-plan] Reading source files...
[generate-plan] Saving snapshot...
[generate-plan] Loading historical snapshots...
[generate-plan] Computing budget metrics...
[generate-plan] Written /path/to/your/project/docs/plan-status.json
[generate-plan] Written /path/to/your/project/docs/plan-status.html
[generate-plan] Done. N epics, N stories, N TCs, N bugs, N lessons.
```

Open `docs/plan-status.html` in your browser. You should see the PlanVisualizer dashboard with your project name in the header.

To verify the Stop hook:

1. Start a Claude Code session in the project directory: `claude`
2. Ask it anything, then end the session
3. Open `docs/AI_COST_LOG.md` — a new row should have been appended with the session cost

## Troubleshooting

### `[generate-plan] Fatal: Failed to read package.json`

The generator must be run from the project root (the directory containing `package.json`). Change to the project root before running:

```bash
cd /path/to/your/project
node tools/generate-plan.js
```

### Source files show `0 stories` or `0 bugs`

Check that the paths in `plan-visualizer.config.json` exactly match your actual file paths (case-sensitive). Verify the files exist:

```bash
ls -la docs/RELEASE_PLAN.md docs/BUGS.md
```

### Stop hook not logging costs

- Confirm the `command` path in `.claude/settings.json` is an absolute path to `capture-cost.js`
- Check Claude Code settings with: `claude settings`
- Verify the hook fires by watching stderr at the end of a session — you should see `[capture-cost] $X.XX | in=N out=M ...`
- Restart Claude Code after editing `.claude/settings.json`

### `Cannot find module './lib/...'`

All commands must be run from the project root. Do not run `node tools/generate-plan.js` from inside the `tools/` subdirectory.

### Getting Help

Reach out to Kamal Syed via Teams or post in the AI Enthusiasts channel.

## Uninstalling

1. Remove the Stop hook entry from `.claude/settings.json` (or delete the file)
2. Delete the `tools/` directory, `plan-visualizer.config.json`, and `agents.config.json`
3. Remove `devDependencies` from `package.json` if you no longer need Jest, ESLint, or Prettier
