# Usage Guide — PlanVisualizer

> How to use this solution in your day-to-day work.

## Getting Started

After installation, generate your first dashboard:

```bash
cd /path/to/your/project
node tools/generate-plan.js
```

Open `docs/plan-status.html` in your browser. The dashboard has eight tabs accessible from the left sidebar:

| Tab              | What it shows                                                                                 |
| ---------------- | --------------------------------------------------------------------------------------------- |
| **Hierarchy**    | Epics → Stories → Tasks with status badges and acceptance criteria                            |
| **Kanban**       | Stories organised by status column (Planned, In Progress, Done, Retired)                      |
| **Traceability** | Each story linked to its test cases and bugs                                                  |
| **Status**       | Static snapshot charts — story status by epic, test results, bug severity, coverage, budget   |
| **Trends**       | Time-series charts — velocity, AI cost over time, token usage, coverage trajectory, open bugs |
| **Costs**        | AI spend by epic and story, with projected costs for remaining work                           |
| **Bugs**         | Full bug register with severity, status, fix branch, and linked lessons                       |
| **Lessons**      | Encoded lessons learned with linked stories and bugs                                          |

Press **⌘K** (macOS) or **Ctrl+K** (Windows/Linux) to open global search across all stories, bugs, and test cases.

## Core Workflows

### Workflow 1: Daily Dashboard Refresh

**When to use:** After any Claude Code session, or whenever you want a current view of project health.

**Steps:**

1. Ensure you're in the project root directory
2. Run the generator:

```bash
node tools/generate-plan.js
```

3. Open (or refresh) `docs/plan-status.html` in your browser

**Example prompt (if using Claude Code to trigger it):**

```
Generate the plan dashboard
```

**Expected output:** Updated `docs/plan-status.html` with the latest story statuses, cost data, and a new time-series snapshot saved to `.history/`.

---

### Workflow 2: Review AI Cost Spend

**When to use:** Before a sprint review, budget check-in, or when planning upcoming work.

**Steps:**

1. Regenerate the dashboard (`node tools/generate-plan.js`)
2. Navigate to the **Costs** tab
3. Review per-epic AI spend vs. projected cost
4. Check the **Trends** tab for the cumulative cost chart and daily burn rate

**What to look for:**

- Epics where `Spent > Projected` signal that work is taking more AI iterations than estimated
- The burn-rate forecast (visible in the budget banner at the top) shows when the budget will be exhausted at the current rate

---

### Workflow 3: Identify At-Risk Stories

**When to use:** During sprint planning or before a release cut.

**Steps:**

1. Regenerate the dashboard
2. Look for the **At Risk** chip in the top bar — it shows the count of at-risk stories
3. Navigate to the **Traceability** tab — at-risk stories are highlighted with a warning badge
4. Common at-risk signals:
   - No test cases linked (story has no TC-XXXX reference)
   - No branch — story has never been started in git
   - A test case is failing with no bug logged
   - An open Critical or High severity bug is linked to the story

---

### Workflow 4: End-of-Session Documentation Update

**When to use:** At the end of every Claude Code session (this workflow is partly automated).

**Steps:**

1. The Stop hook fires automatically — `docs/AI_COST_LOG.md` is updated without any action from you
2. Update `progress.md` with what was accomplished and any blockers (prepend new entries to the top)
3. Update story statuses in `docs/RELEASE_PLAN.md` — mark completed stories as `Done`, check off acceptance criteria
4. If new bugs were found, add them to `docs/BUGS.md`
5. If a lesson was learned, add it to `docs/LESSONS.md`
6. Regenerate: `node tools/generate-plan.js`

---

### Workflow 5: Share Project Status with the Team

**When to use:** Weekly status updates, milestone reviews, or ad-hoc stakeholder questions.

**Steps:**

1. Regenerate the dashboard
2. Either:
   - **Share the file directly:** Send `docs/plan-status.html` — it's fully self-contained and opens in any browser without a server
   - **Link to GitHub Pages:** If you've configured GitHub Pages for your repository, the dashboard is available at `https://<org>.github.io/<repo>/plan-status.html`

---

## Tips for Best Results

- **Regenerate before every review meeting.** The dashboard reflects the markdown files as they are at generation time — regenerate to pick up the latest story updates.
- **Keep `docs/AI_COST_LOG.md` append-only.** Never manually edit or delete rows. The deduplication logic (`parse-cost-log.js`) relies on session IDs being unique; editing rows can corrupt the cost aggregation.
- **Use t-shirt size estimates consistently.** The cost projection and velocity trend are both driven by story estimates (XS/S/M/L/XL). Stories without estimates are excluded from projections.
- **Name branches to match story IDs.** The cost attribution engine matches branch names to stories — `feature/US-0042-auth-flow` is correctly attributed to story US-0042. Branches that don't match any story contribute to the proportional unattributed pool shared across all stories.
- **At least two real snapshots are needed for accurate trends.** On first run, `historical-sim.js` generates 30 days of simulated history to seed the charts. Once you have real snapshots from at least two separate days, the charts will reflect actual project data.

## Common Scenarios

### "I want to use this for a different project"

Copy `plan-visualizer.config.json` to the new project root and update all paths to point to that project's markdown files. The generator reads everything through the config — no code changes are needed.

### "The coverage chart shows 0%"

Coverage data comes from `coverage/coverage-summary.json` (path is configurable). This file is only generated when you run `npx jest --coverage`. Run coverage first, then regenerate the dashboard.

### "The Trends tab shows flat lines from the start"

This is expected behaviour for the first 30 days. The initial backfill seeds the trend charts with simulated historical data based on today's project state. The charts will reflect real historical variation as more snapshots accumulate over time.

### "I need to add a budget cap"

In `plan-visualizer.config.json`, set:

```json
"budget": {
  "totalUsd": 5000,
  "thresholds": [50, 75, 90, 100]
}
```

The Costs tab and budget banner will show your spend as a percentage of the cap, with colour-coded warnings at each threshold.

### "My cost log has duplicate entries"

This can happen if `capture-cost.js` runs multiple times for the same session. It is safe to leave them — `parse-cost-log.js` deduplicates by session UUID (keeping the last row) before aggregating costs. No manual cleanup is needed.

## What This Solution Does NOT Do

- **Does not send or publish anything automatically** — dashboards are generated locally; deployment to GitHub Pages is a separate CI step
- **Does not pull from Jira, Azure DevOps, or any project management tool** — the source of truth is always local markdown files
- **Does not edit your markdown files** — it only reads them; all updates to `RELEASE_PLAN.md`, `BUGS.md`, etc. are made by you or your AI agent
- **Does not track non-Claude-Code AI spend** — `capture-cost.js` reads Claude Code session transcripts; costs from other AI tools must be added manually to `AI_COST_LOG.md`

## Troubleshooting Common Issues

### Output quality is poor (empty charts, missing data)

- Verify your markdown files follow the expected format — compare against the PlanVisualizer example documents
- Check that all paths in `plan-visualizer.config.json` are correct and the files exist
- Run `node tools/generate-plan.js` and check the console output for any warnings

### Stop hook is not logging costs

- Confirm `.claude/settings.json` has the correct absolute path to `capture-cost.js`
- Restart Claude Code after editing the settings file
- Run a short test session and watch for `[capture-cost]` output in the terminal when the session ends

### Dashboard looks different from the screenshots

- Check the version: `node -e "console.log(require('./package.json').version)"`
- Pull the latest changes: `git pull`

## Feedback & Improvements

Found a way to make this solution better? Please:

1. Try the improvement and document what changed
2. Open a feature branch (`feature/US-XXXX-short-name`) and commit your changes
3. Open a PR to `develop` and share it in the AI Enthusiasts channel
