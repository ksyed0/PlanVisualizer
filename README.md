# PlanVisualizer

A self-contained project dashboard for Claude Code projects. Parses your `RELEASE_PLAN.md`, `TEST_CASES.md`, `BUGS.md`, `AI_COST_LOG.md`, coverage JSON, and `progress.md` into a static `plan-status.html` with six tabs:

**Hierarchy · Kanban · Traceability · Charts · Costs · Bugs**

No runtime dependencies — Node.js and git only.

---

## Prerequisites

- Node.js 18+
- git
- A project with `RELEASE_PLAN.md`, `TEST_CASES.md`, and `AI_COST_LOG.md` (files can be empty to start)

---

## Quickstart

### Install via script

```bash
# From your project root:
git clone https://github.com/ksyed0/PlanVisualizer.git /tmp/PlanVisualizer
bash /tmp/PlanVisualizer/scripts/install.sh
rm -rf /tmp/PlanVisualizer
```

The script copies `tools/`, `tests/`, `jest.config.js`, merges npm scripts into your `package.json`, creates `plan-visualizer.config.json` from the example template, and sets up the Claude Code stop hook.

### Install via Claude Code

Paste this prompt directly into Claude Code in your target repo:

```
Install the PlanVisualizer tool into this project from the ksyed0/PlanVisualizer
GitHub repo. Clone it to a temp directory, run scripts/install.sh targeting this
project root, create plan-visualizer.config.json with the correct project name and
file paths for this project, add the .claude/settings.json Stop hook for
capture-cost.js, copy the .github/workflows/plan-visualizer.yml workflow, run
npm test from the repo root to confirm all 9 suites pass, then commit all added
files to the current branch. Also copy AGENTS.md from the repo root into this
project root — if an AGENTS.md already exists, ask before overwriting; if
declined, save it as AGENTS-new.md and tell the user to manually copy the key
sections (especially the BLAST phases and §19 Dependency Management) into their
existing AGENTS.md, then delete AGENTS-new.md.
```

---

## Configuration

After installation, edit `plan-visualizer.config.json` in your project root:

| Key | Default | Description |
|-----|---------|-------------|
| `project.name` | `"My Project"` | Display name shown in the dashboard title |
| `project.tagline` | `"A short description."` | Subtitle shown in the dashboard header |
| `project.githubUrl` | `""` | GitHub repository URL shown in the About dialog |
| `docs.releasePlan` | `"docs/RELEASE_PLAN.md"` | Path to release plan (EPICs, stories, tasks) |
| `docs.testCases` | `"docs/TEST_CASES.md"` | Path to test cases |
| `docs.bugs` | `"docs/BUGS.md"` | Path to bug log |
| `docs.costLog` | `"docs/AI_COST_LOG.md"` | Path to AI cost ledger |
| `docs.outputDir` | `"docs"` | Directory where `plan-status.html` is written |
| `coverage.summaryPath` | `"docs/coverage/coverage-summary.json"` | Path to Jest `coverage-summary.json` |
| `progress.path` | `"progress.md"` | Path to session progress log |
| `costs.hourlyRate` | `100` | Hourly rate (USD) for projected cost estimates |
| `costs.tshirtHours` | `{S:4, M:8, L:16, XL:32}` | Hours per t-shirt size estimate |

All paths are relative to the project root. If no config file is present, built-in defaults are used.

> **Case sensitivity:** File and directory paths are case-sensitive on Linux (including GitHub Actions). Make sure the case in your config exactly matches the actual file and directory names on disk — e.g. `docs/BUGS.md` and `docs/bugs.md` are different paths. Mismatches that work locally on macOS will fail in CI.

---

## Usage

```bash
# Generate the dashboard
node tools/generate-plan.js
# → writes docs/plan-status.html and docs/plan-status.json

# Run tool unit tests
npm run plan:test

# Run with coverage
npm run plan:test:coverage
```

The Claude Code stop hook (`tools/capture-cost.js`) appends session token usage and cost to `AI_COST_LOG.md` automatically after every Claude Code session.

### Continuous Deployment

The included `.github/workflows/plan-visualizer.yml` workflow triggers on pushes to `main` or `develop` when any of the tracked docs files change. It runs tests with coverage, generates `plan-status.html`, and deploys to GitHub Pages automatically.

> **Note:** To allow deploys from `develop`, go to **Settings → Environments → github-pages → Deployment branches** and add `develop` to the allowed list.

---

## Manual Setup

If you prefer not to use the install script:

1. Copy `AGENTS.md` from the PlanVisualizer repo into your project root. If an `AGENTS.md` already exists and you choose not to overwrite it, save the PlanVisualizer version as `AGENTS-new.md` and manually merge the key sections (especially the BLAST phases and §19 Dependency Management) into your own `AGENTS.md`, then delete `AGENTS-new.md`.
2. Copy `tools/`, `tests/`, `jest.config.js` into your project root
3. Add to your `package.json` scripts:
   ```json
   "plan:test": "jest --watchAll=false",
   "plan:test:coverage": "jest --watchAll=false --coverage",
   "plan:generate": "node tools/generate-plan.js"
   ```
4. Copy `plan-visualizer.config.example.json` to `plan-visualizer.config.json` and edit it
5. Add to `.claude/settings.json`:
   ```json
   {
     "hooks": {
       "Stop": [{ "matcher": "", "hooks": [{ "type": "command", "command": "node tools/capture-cost.js" }] }]
     }
   }
   ```
6. Add `docs/coverage/` to your `.gitignore`

---

## Updating

Re-run the install script to update to the latest version:

```bash
git clone https://github.com/ksyed0/PlanVisualizer.git /tmp/PlanVisualizer
bash /tmp/PlanVisualizer/scripts/install.sh
rm -rf /tmp/PlanVisualizer
```

### Update via Claude Code

Paste this prompt directly into Claude Code in your target repo:

```
Update the PlanVisualizer tool in this project from the ksyed0/PlanVisualizer
GitHub repo. Clone it to a temp directory, run scripts/install.sh targeting this
project root (your plan-visualizer.config.json will not be overwritten), run
npm test from the repo root to confirm all suites pass, then commit all changed
files to the current branch.
```

Your `plan-visualizer.config.json` is never overwritten.

---

## Credits

The `AGENTS.md` operating framework included with this tool is based on the **BLAST framework** originally developed by **Jack Roberts** ([Jack@JackRoberts.ai](mailto:Jack@JackRoberts.ai)).

---

## License

MIT
