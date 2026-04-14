# Release Plan — PlanVisualizer

> **Parser note:** All EPIC, US, and TASK definitions below must remain inside triple-backtick fenced code blocks for `parse-release-plan.js` to extract them. Prose commentary outside the fences is ignored by the parser.

---

## Keeping Story Status Accurate

The dashboard derives all progress bars, Kanban columns, and at-risk signals directly from the `Status:` field on each story. If the dashboard shows incorrect completion percentages or wrong Kanban placement, update the status values here.

**Valid status values:** `To Do` · `Planned` · `In Progress` · `Blocked` · `Done`

**To update statuses**, ask your AI assistant:

> "Review `docs/RELEASE_PLAN.md`. For each story in EPIC-XXXX, check whether the described work has actually been completed. Update `Status:` to reflect reality — use `Done` only when all ACs are checked `[x]`, `In Progress` when work has started but ACs are incomplete, and `To Do` when no work has started."

Also mark acceptance criteria done by changing `[ ]` to `[x]` as each AC is completed. The dashboard Hierarchy tab shows AC completion inline with each story.

---

## Epics

```
EPIC-0001: Core Parsing Engine
Description: Regex-based parsers for all AGENTS.md markdown file formats — release plan, test cases, bugs, cost log, coverage JSON, and progress log.
Release Target: MVP (v1.0)
Status: Done
Dependencies: None

EPIC-0002: HTML Dashboard Renderer
Description: Static HTML generation with six tabs (Hierarchy, Kanban, Traceability, Charts, Costs, Bugs), top bar stats, filters, and recent activity panel.
Release Target: MVP (v1.0)
Status: Done
Dependencies: EPIC-0001

EPIC-0003: Installation and Distribution
Description: One-command bash installer, JSON config system, and Claude Code stop hook for automated cost capture.
Release Target: MVP (v1.0)
Status: Done
Dependencies: EPIC-0001, EPIC-0002

EPIC-0004: CI/CD Pipeline
Description: Consolidated GitHub Actions pipeline with ESLint, Jest coverage gate, npm audit, CodeQL analysis, GitHub Pages deployment, and Dependabot.
Release Target: Release 1.1
Status: Done
Dependencies: EPIC-0001

EPIC-0005: Project Self-Documentation
Description: Full AGENTS.md-compliant documentation including design doc, architecture, release plan, test cases, ID registry, and all supporting project files.
Release Target: Release 1.1
Status: Done
Dependencies: None

EPIC-0006: Dashboard UX & Quality Improvements
Description: Mobile-responsive layout fixes, display accuracy improvements, navigation state persistence, and developer-experience enhancements for the generated dashboard.
Release Target: Release 1.2
Status: Done
Dependencies: EPIC-0002

EPIC-0007: Dashboard Visual Design Overhaul
Description: Replace the generic Tailwind slate palette and default blue accent with a distinctive dark design system. Improvements span the colour palette, badge styling, tab indicator, typography, hover interactions, and background texture to produce a visually unique dashboard.
Release Target: Release 1.3
Status: Done
Dependencies: EPIC-0006

EPIC-0008: Trend Analysis & Historical Tracking
Description: Capture and visualise project metrics over time. Store snapshots of dashboard data on each generation and display trend charts showing progress, costs, coverage, and velocity.
Release Target: Release 1.4
Status: Done
Dependencies: EPIC-0007

EPIC-0009: Budget Forecasting
Description: Track burn rate and predict when budget exhausts. Alert when projected costs exceed thresholds. Help teams stay on budget by visualising spend velocity and forecasting future costs.
Release Target: Release 1.5
Status: Done
Dependencies: EPIC-0008

EPIC-0010: Risk Analytics
Description: Composite risk scoring per story, risk trend charts, velocity-based completion prediction, at-risk epic summary, and Monte Carlo delivery simulation.
Release Target: Release 1.6
Status: Planned
Dependencies: EPIC-0009

EPIC-0011: Search
Description: Global search across all stories, bugs, and lessons. Quick jump to any item by ID.
Release Target: Release 1.7
Status: Done
Dependencies: EPIC-0010

EPIC-0012: Stakeholder View
Description: Non-technical stakeholder dashboard with milestone progress, budget traffic lights, PDF export, email digests, and password protection.
Release Target: Release 1.8
Status: Planned
Dependencies: EPIC-0011

EPIC-0013: Agentic SDLC Dashboard
Description: Secondary dashboard visualising the multi-agent orchestration layer — agent roles, delegation flow, session timeline, and SDLC metrics.
Release Target: Release 1.5
Status: Done
Dependencies: EPIC-0002

EPIC-0014: Follow-Up Changes
Description: Planned and in-progress work that was added after its original epic was marked Done. Collects follow-up stories to preserve the integrity of completed epics.
Release Target: Backlog
Status: Planned
Dependencies: None

EPIC-0015: UI Review and Redesign
Description: Editorial Operations Dashboard aesthetic pass. Promotes PlanVisualizer from "generic utility dashboard" to a refined, information-dense interface with display typography, semantic badge tokens, shadow-based cards, zebra-striped tables, and per-tab polish across Hierarchy, Kanban, Traceability, Status, Trends, Costs, Bugs, and Lessons.
Release Target: Release 1.9
Status: In Progress
Dependencies: EPIC-0007

EPIC-0017: Agentic Dashboard Effectiveness Review
Description: Discovery / retrospective epic. Review the Agentic SDLC Dashboard (originally built for a hackathon demo, now extracted as a reusable component) and define what it takes to make it genuinely effective as a general-purpose agentic pipeline visualization. Output: a gap analysis and a set of implementation stories in a follow-on epic. Complements EPIC-0016 (Mission Control aesthetic redesign) by focusing on schema, data model, workflow coverage, and integration patterns — not just visual polish.
Release Target: Release 2.0
Status: Planned
Dependencies: EPIC-0013, EPIC-0016
```

---

## User Stories — EPIC-0001: Core Parsing Engine

```
US-0001 (EPIC-0001): As a developer, I want to parse RELEASE_PLAN.md into structured epics, stories, and tasks, so that the dashboard can visualise project hierarchy.
Priority: High (P0)
Estimate: L
Status: Done
Branch: feature/US-0001-parse-release-plan
Acceptance Criteria:
  - [x] AC-0001: Epics are extracted from fenced code blocks with id, title, status, and releaseTarget fields
  - [x] AC-0002: Stories are associated with their parent epic via epicId
  - [x] AC-0003: Acceptance criteria items are parsed with done/undone state
Dependencies: None

US-0002 (EPIC-0001): As a developer, I want to parse TEST_CASES.md, so that test cases can be linked to stories in the traceability matrix.
Priority: High (P0)
Estimate: M
Status: Done
Branch: feature/US-0002-parse-test-cases
Acceptance Criteria:
  - [x] AC-0004: Test cases are extracted with id, title, relatedStory, relatedAC, type, and status fields
  - [x] AC-0005: Status is normalised to Pass, Fail, or Not Run from checkbox syntax
Dependencies: None

US-0003 (EPIC-0001): As a developer, I want to parse BUGS.md, so that bugs are displayed in the Bugs tab and linked to stories.
Priority: High (P0)
Estimate: S
Status: Done
Branch: feature/US-0003-parse-bugs
Acceptance Criteria:
  - [x] AC-0006: Bugs are extracted with id, title, severity, status, relatedStory, fixBranch, and lessonEncoded fields
  - [x] AC-0007: Multiple bugs are correctly separated using sliding-window slicing
Dependencies: None

US-0004 (EPIC-0001): As a developer, I want to parse AI_COST_LOG.md and aggregate costs by branch, so that AI spend can be attributed to user stories.
Priority: High (P0)
Estimate: M
Status: Done
Branch: feature/US-0004-parse-cost-log
Acceptance Criteria:
  - [x] AC-0008: All pipe-delimited table rows are parsed into typed cost objects
  - [x] AC-0009: Token counts and costs are summed correctly per branch
  - [x] AC-0010: Sessions on the same branch are accumulated, not overwritten
Dependencies: None

US-0005 (EPIC-0001): As a developer, I want to parse Jest coverage-summary.json, so that coverage metrics appear in the dashboard top bar.
Priority: Medium (P1)
Estimate: S
Status: Done
Branch: feature/US-0005-parse-coverage
Acceptance Criteria:
  - [x] AC-0011: Lines, statements, functions, and branches percentages are extracted
  - [x] AC-0012: overall is computed as the minimum of all four metrics; meetsTarget is true when overall >= 80
Dependencies: None

US-0006 (EPIC-0001): As a developer, I want to parse progress.md for recent session summaries, so that the dashboard shows recent activity.
Priority: Low (P2)
Estimate: S
Status: Done
Branch: feature/US-0006-parse-progress
Acceptance Criteria:
  - [x] AC-0013: Sessions are extracted in reverse-chronological order
  - [x] AC-0014: The What Was Done section is summarised to 3 lines maximum
Dependencies: None

US-0007 (EPIC-0001): As a developer, I want to compute projected and actual AI costs per story, so that the Costs tab shows budget vs. spend.
Priority: Medium (P1)
Estimate: S
Status: Done
Branch: feature/US-0007-compute-costs
Acceptance Criteria:
  - [x] AC-0015: Projected cost is computed from t-shirt size × hourly rate
  - [x] AC-0016: AI cost is attributed to stories by exact branch name match
Dependencies: US-0004

US-0008 (EPIC-0001): As a developer, I want at-risk stories to be automatically detected, so that I can see which stories need attention without reading every file.
Priority: High (P0)
Estimate: S
Status: Done
Branch: feature/US-0008-detect-at-risk
Acceptance Criteria:
  - [x] AC-0017: Stories with ACs but no linked TCs are flagged missingTCs
  - [x] AC-0018: In-Progress stories with no branch are flagged noBranch
  - [x] AC-0019: Stories with a Fail TC and no defect raised are flagged failedTCNoBug
Dependencies: US-0002
```

---

## User Stories — EPIC-0002: HTML Dashboard Renderer

```
US-0009 (EPIC-0002): As a developer, I want a static HTML dashboard with six tabs, so that I can view all project dimensions in one file.
Priority: High (P0)
Estimate: XL
Status: Done
Branch: feature/US-0009-render-html
Acceptance Criteria:
  - [x] AC-0020: All six tabs (Hierarchy, Kanban, Traceability, Charts, Costs, Bugs) render without error
  - [x] AC-0021: The top bar shows project name, progress bar, and all six stat tiles
  - [x] AC-0022: The generated HTML is self-contained and opens in any browser without a server
Dependencies: US-0001, US-0002, US-0003, US-0004, US-0005, US-0006, US-0007, US-0008

US-0010 (EPIC-0002): As a developer, I want real-time filters for epic, status, priority, and search, so that I can focus on the subset of stories I care about.
Priority: Medium (P1)
Estimate: M
Status: Done
Branch: feature/US-0009-render-html
Acceptance Criteria:
  - [x] AC-0023: Selecting an epic hides stories from other epics in both Hierarchy and Kanban tabs
  - [x] AC-0024: Free-text search filters by story ID and title
Dependencies: US-0009
```

---

## User Stories — EPIC-0003: Installation and Distribution

```
US-0011 (EPIC-0003): As a developer, I want to install PlanVisualizer into my project with a single bash command, so that setup takes under 5 minutes.
Priority: High (P0)
Estimate: M
Status: Done
Branch: feature/US-0011-install-script
Acceptance Criteria:
  - [x] AC-0025: The install script copies tools/, tests/, and jest.config.js to the target project
  - [x] AC-0026: The script merges plan:test, plan:test:coverage, and plan:generate scripts into package.json without overwriting existing scripts
  - [x] AC-0027: The script is idempotent — safe to re-run for updates
Dependencies: None

US-0012 (EPIC-0003): As a developer, I want Claude Code session costs to be captured automatically, so that AI_COST_LOG.md is always up to date without manual entry.
Priority: High (P0)
Estimate: S
Status: Done
Branch: feature/US-0012-capture-cost
Acceptance Criteria:
  - [x] AC-0028: The stop hook appends one row per session to AI_COST_LOG.md using append-safe file open
  - [x] AC-0029: The header row is written only when the file is empty
Dependencies: None

US-0013 (EPIC-0003): As a developer, I want to configure all file paths and project metadata in a single JSON file, so that PlanVisualizer works with any project structure.
Priority: Medium (P1)
Estimate: S
Status: Done
Branch: feature/US-0013-config-system
Acceptance Criteria:
  - [x] AC-0030: All config keys have sensible defaults — the tool runs with zero config
  - [x] AC-0031: User-supplied values deep-merge over defaults without clobbering unspecified keys
Dependencies: None

US-0029 (EPIC-0003): As a developer installing PlanVisualizer, I want the install script to update my AGENTS.md non-destructively, so that my existing agent operating standards are never overwritten or require manual merging.
Priority: High (P0)
Estimate: S
Status: Done
Branch: feature/docs-update-readme-update-prompt
Acceptance Criteria:
  - [x] AC-0078: plan_visualizer.md is copied to the target project root, containing exact format specs for all 5 source files
  - [x] AC-0079: The install script appends a PlanVisualizer reference section to AGENTS.md rather than overwriting it
  - [x] AC-0080: If AGENTS.md does not exist, a minimal one is created with the reference section
  - [x] AC-0081: Re-running the install script does not duplicate the reference section (idempotent)
Dependencies: US-0011

US-0030 (EPIC-0003): As a project manager, I want to see AI costs attributed to bug fixes on the Costs tab, so that I can understand total spend including defect resolution.
Priority: Medium (P1)
Estimate: S
Status: Done
Branch: feature/US-0030-bug-fix-costs-tab
Acceptance Criteria:
  - [x] AC-0082: Bug Fix Costs section appears below the story costs table when bugs exist
  - [x] AC-0083: Each bug row shows BUG-ID, title, severity, status, related story, fix branch, AI cost, and token counts
  - [x] AC-0084: Bugs with no fix branch or no logged cost show $0.00 (not hidden)
  - [x] AC-0085: Bug Fix Costs section is absent when bugs array is empty
Dependencies: US-0029

US-0082 (EPIC-0003): As a developer, I want the source code and npm packages to be cleanly separated in the install script, so that the target project only gets runtime dependencies and not development tools.
Priority: Medium (P1)
Estimate: S
Status: Done
Branch: feature/EPIC-0009-budget-forecasting
Acceptance Criteria:
  - [x] AC-0258: The install script copies only the generated output files (tools/lib/*.js, scripts/, .github/workflows/) to the target project
  - [x] AC-0259: DevDependencies (jest, eslint) remain in the PlanVisualizer repo and are NOT copied to target projects
  - [x] AC-0260: The target project's package.json receives only runtime scripts (plan:test, plan:generate)
  - [x] AC-0261: Users installing PlanVisualizer do not need to run npm install for devDependencies
Dependencies: US-0011
```

---

## User Stories — EPIC-0004: CI/CD Pipeline

```
US-0014 (EPIC-0004): As a developer, I want ESLint to run on every push and PR, so that code quality issues are caught before merge.
Priority: High (P0)
Estimate: S
Status: Done
Branch: develop
Acceptance Criteria:
  - [x] AC-0032: eslint.config.js uses eslint:recommended with no-eval and eqeqeq as errors
  - [x] AC-0033: npm run lint exits 0 on all current source files
  - [x] AC-0034: The lint job in ci.yml fails the workflow if ESLint reports any error
Dependencies: None

US-0015 (EPIC-0004): As a developer, I want the CI pipeline to gate on 80% coverage, so that test coverage cannot silently regress.
Priority: High (P0)
Estimate: S
Status: Done
Branch: develop
Acceptance Criteria:
  - [x] AC-0035: jest.config.js defines coverageThreshold with 80% for lines, branches, functions, and statements
  - [x] AC-0036: npm run test:coverage fails with a descriptive message when any metric falls below 80%
  - [x] AC-0037: The test job in ci.yml fails the workflow when the threshold is not met
Dependencies: None

US-0016 (EPIC-0004): As a developer, I want npm audit to run on every push and PR, so that known vulnerabilities in dependencies are caught automatically.
Priority: High (P0)
Estimate: S
Status: Done
Branch: develop
Acceptance Criteria:
  - [x] AC-0038: The audit job runs npm audit --audit-level=moderate
  - [x] AC-0039: The workflow fails if any moderate, high, or critical vulnerability is found
Dependencies: None

US-0017 (EPIC-0004): As a developer, I want CodeQL to analyse the codebase on every PR and push to main, so that security vulnerabilities are caught before they reach production.
Priority: High (P0)
Estimate: M
Status: Done
Branch: develop
Acceptance Criteria:
  - [x] AC-0040: codeql.yml runs on pull_request, push to main, and a weekly Monday schedule
  - [x] AC-0041: The security-extended query pack is used for JavaScript analysis
  - [x] AC-0042: Results are uploaded to the GitHub Security tab as SARIF
Dependencies: None

US-0018 (EPIC-0004): As a developer, I want Dependabot to open automated PRs for outdated dependencies, so that the project stays secure without manual monitoring.
Priority: Medium (P1)
Estimate: S
Status: Done
Branch: develop
Acceptance Criteria:
  - [x] AC-0043: dependabot.yml configures weekly npm updates with a 5-PR limit
  - [x] AC-0044: GitHub Actions dependencies are also monitored weekly
Dependencies: None

US-0083 (EPIC-0014): As a developer, I want all GitHub Actions steps to use Node.js 24-compatible action versions, so that no deprecation warnings appear in CI runs after June 2, 2026.
Priority: Medium (P1)
Estimate: S
Status: Planned
Branch: feature/US-0083-actions-node24-upgrade
Acceptance Criteria:
  - [ ] AC-0262: actions/checkout updated to v5 (or later) in plan-visualizer.yml
  - [ ] AC-0263: actions/setup-node updated to v5 (or later) in plan-visualizer.yml
Dependencies: None
```

---

## User Stories — EPIC-0005: Project Self-Documentation

```
US-0019 (EPIC-0005): As a contributor, I want a design document and technical architecture reference, so that I can understand the project's goals and implementation without reading all the source code.
Priority: High (P0)
Estimate: M
Status: Done
Branch: feature/US-0019-design-docs
Acceptance Criteria:
  - [x] AC-0045: docs/architecture/DESIGN.md covers product vision, user profile, core concepts, feature set, and design system
  - [x] AC-0046: docs/architecture/ARCHITECTURE.md covers module structure, data flow, parser contract, renderer design, and CI architecture
  - [x] AC-0047: Both documents are committed to main
Dependencies: None

US-0020 (EPIC-0005): As a contributor, I want a complete release plan with epics, stories, tasks, and ID registry, so that project scope and progress can be tracked in the dashboard.
Priority: High (P0)
Estimate: M
Status: Done
Branch: feature/US-0020-release-plan
Acceptance Criteria:
  - [x] AC-0048: docs/RELEASE_PLAN.md contains all 5 epics with correct AGENTS.md format
  - [x] AC-0049: All user stories include priority, estimate, status, branch, and acceptance criteria
  - [x] AC-0050: docs/ID_REGISTRY.md is populated with correct next-available IDs
Dependencies: None

US-0021 (EPIC-0005): As a contributor, I want a human-readable test plan and test cases document, so that QA verification is reproducible and stories cannot close without test evidence.
Priority: High (P0)
Estimate: M
Status: Done
Branch: feature/US-0021-test-cases
Acceptance Criteria:
  - [x] AC-0051: docs/TEST_CASES.md contains at least one TC per user story
  - [x] AC-0052: Every acceptance criterion (AC) has a corresponding TC — TC-0001 through TC-0057 cover all 56 ACs
  - [x] AC-0053: TC format is parseable by parse-test-cases.js and renders in the Traceability tab
Dependencies: US-0020

US-0022 (EPIC-0005): As a contributor, I want all AGENTS.md-required project files to exist and be populated, so that any AI agent can pick up this project without missing context.
Priority: High (P0)
Estimate: M
Status: Done
Branch: feature/US-0022-project-files
Acceptance Criteria:
  - [x] AC-0054: MEMORY.md, PROMPT_LOG.md, MIGRATION_LOG.md, findings.md, progress.md, task_plan.md exist and are populated
  - [x] AC-0055: docs/LESSONS.md and architecture/ERROR_TAXONOMY.md exist
  - [x] AC-0056: node tools/generate-plan.js runs successfully and produces a valid plan-status.html
Dependencies: None
```

---

## Tasks — EPIC-0004: CI/CD Pipeline

```
TASK-0001 (US-0014): Install eslint@9 and @eslint/js as devDependencies
Type: Dev
Assignee: Agent
Status: Done
Branch: develop
Notes: npm install --save-dev eslint@9 @eslint/js

TASK-0002 (US-0014): Create eslint.config.js with recommended + security rules
Type: Dev
Assignee: Agent
Status: Done
Branch: develop
Notes: Use flat config format; scope to tools/**/*.js

TASK-0003 (US-0014): Add lint script to package.json and verify clean run
Type: Dev
Assignee: Agent
Status: Done
Branch: develop
Notes: npm run lint must exit 0 on current codebase

TASK-0004 (US-0014): Add lint job to ci.yml
Type: Infra
Assignee: Agent
Status: Done
Branch: develop
Notes: Runs on all branches and PRs

TASK-0005 (US-0015): Add coverageThreshold block to jest.config.js
Type: Dev
Assignee: Agent
Status: Done
Branch: develop
Notes: 80% for lines, branches, functions, statements globally

TASK-0006 (US-0015): Verify npm run test:coverage passes threshold
Type: Test
Assignee: Agent
Status: Done
Branch: develop
Notes: Current coverage is well above 80% — should pass immediately

TASK-0007 (US-0015): Add test job to ci.yml replacing existing test job
Type: Infra
Assignee: Agent
Status: Done
Branch: develop
Notes: Keep --ci flag for GitHub Actions

TASK-0008 (US-0016): Add audit job to ci.yml
Type: Infra
Assignee: Agent
Status: Done
Branch: develop
Notes: npm audit --audit-level=moderate

TASK-0009 (US-0017): Create .github/workflows/codeql.yml
Type: Infra
Assignee: Agent
Status: Done
Branch: develop
Notes: Triggers: pull_request, push to main, schedule (Monday 08:00 UTC)

TASK-0010 (US-0018): Create .github/dependabot.yml
Type: Infra
Assignee: Agent
Status: Done
Branch: develop
Notes: npm + github-actions ecosystems; weekly; 5-PR limit
```

---

## Tasks — EPIC-0005: Project Self-Documentation

```
TASK-0011 (US-0019): Write docs/architecture/DESIGN.md
Type: docs
Assignee: Agent
Status: Done
Branch: feature/US-0019-design-docs
Notes: Cover vision, user profile, core concepts, features, design system, data flow

TASK-0012 (US-0019): Write docs/architecture/ARCHITECTURE.md
Type: docs
Assignee: Agent
Status: Done
Branch: feature/US-0019-design-docs
Notes: Cover module structure, data flow, parser contract, renderer, CI/CD

TASK-0013 (US-0020): Write docs/RELEASE_PLAN.md with all 5 epics and 22 stories
Type: docs
Assignee: Agent
Status: Done
Branch: feature/US-0020-release-plan
Notes: Must use AGENTS.md format inside fenced code blocks

TASK-0014 (US-0020): Write docs/ID_REGISTRY.md
Type: docs
Assignee: Agent
Status: Done
Branch: feature/US-0020-release-plan
Notes: Track next available ID per sequence

TASK-0015 (US-0021): Write docs/TEST_CASES.md with one TC per story AC
Type: docs
Assignee: Agent
Status: Done
Branch: feature/US-0021-test-cases
Notes: Use TC format parseable by parse-test-cases.js

TASK-0016 (US-0022): Create MEMORY.md with project knowledge base
Type: docs
Assignee: Agent
Status: Done
Branch: feature/US-0022-project-files
Notes: Organised by topic, not chronologically

TASK-0017 (US-0022): Create progress.md, PROMPT_LOG.md, MIGRATION_LOG.md, findings.md, task_plan.md
Type: docs
Assignee: Agent
Status: Done
Branch: feature/US-0022-project-files
Notes: Bootstrap initial entries for each file

TASK-0018 (US-0022): Create docs/LESSONS.md and architecture/ERROR_TAXONOMY.md
Type: docs
Assignee: Agent
Status: Done
Branch: feature/US-0022-project-files
Notes: Encode Jest upgrade lesson; define error taxonomy

TASK-0019 (US-0022): Create plan-visualizer.config.json for this project
Type: Infra
Assignee: Agent
Status: Done
Branch: feature/US-0022-project-files
Notes: project.name = PlanVisualizer; commit this file (remove from .gitignore for this repo)

TASK-0020 (US-0022): Run node tools/generate-plan.js and verify output
Type: Test
Assignee: Agent
Status: Done
Branch: feature/US-0022-project-files
Notes: Output should render all tabs with real project data
```

---

## User Stories — EPIC-0006: Dashboard UX & Quality Improvements

```
US-0023 (EPIC-0006): As a user, I want the dashboard to be usable on a mobile device, so that I can check project status on the go.
Priority: Medium (P1)
Estimate: M
Status: Done
Branch: claude/fix-mobile-top-area-C7evU
Acceptance Criteria:
  - [x] AC-0057: Sticky header fits within the top ⅓ of the screen on viewports ≤ 767px via compact padding and reduced font sizes
  - [x] AC-0058: Traceability legend is collapsed by default on mobile and has a toggle button to expand
  - [x] AC-0059: Activity panel has a × close button visible only on mobile (md:hidden) that hides the panel on tap
  - [x] AC-0060: Traceability legend panel renders above the matrix table on mobile (flex-direction: column; order: -1)
  - [x] AC-0061: Tokens column is hidden in the Costs table on mobile viewports
Dependencies: US-0009

US-0024 (EPIC-0006): As a project manager, I want accurate AI cost data in the dashboard, so that per-story spend is correctly attributed and charted.
Priority: High (P0)
Estimate: S
Status: Done
Branch: claude/fix-mobile-top-area-C7evU
Acceptance Criteria:
  - [x] AC-0062: AI Cost column on the Costs tab shows the correct per-story AI spend (non-zero) for stories with matching cost log entries
  - [x] AC-0063: Cost Breakdown chart uses dual y-axes so AI cost bars are visible at their true scale alongside projected cost bars
Dependencies: US-0007, US-0009

US-0025 (EPIC-0006): As a user, I want accurate and uncluttered top-bar statistics, so that key project metrics are clear at a glance.
Priority: Medium (P1)
Estimate: S
Status: Done
Branch: claude/improvements-C7evU
Acceptance Criteria:
  - [x] AC-0064: usd() displays exactly 2 decimal places for values between $0.01 and $999.99 (e.g. $13.92 not $14)
  - [x] AC-0065: The top bar shows one Coverage tile with overall percentage and a Branches subtitle, replacing the separate Lines Cov and Branch Cov tiles
  - [x] AC-0066: Story count appears once in the progress bar label as "X/Y · Z% · N active"; the separate Stories and % tiles are removed
Dependencies: US-0009

US-0026 (EPIC-0006): As a user, I want the dashboard to remember my last active tab and filter selections, so that I do not have to reconfigure the view on every page load.
Priority: Low (P2)
Estimate: S
Status: Done
Branch: claude/improvements-C7evU
Acceptance Criteria:
  - [x] AC-0067: Opening plan-status.html#<tab-name> (e.g. #costs) activates that tab directly on load
  - [x] AC-0068: Filter selections (epic, status, priority, type, search) are persisted to localStorage and restored on next page load
Dependencies: US-0009, US-0010

US-0028 (EPIC-0006): As a user, I want an About dialog on the dashboard, so that I can quickly see the project version, build number, GitHub link, and author without leaving the page.
Priority: Low (P2)
Estimate: S
Status: Done
Branch: feature/US-0023-about-dialog
Acceptance Criteria:
  - [x] AC-0073: An "About" button appears beside the project title in the top bar on all viewport sizes
  - [x] AC-0074: Clicking About opens a modal showing project name, tagline, GitHub repository link, version (vX.Y.Z from package.json), build number (#N from git commit count), commit SHA, last-updated date, and "Implemented by Kamal Syed, 2026"
  - [x] AC-0075: The modal closes via the ✕ button, clicking the backdrop overlay, or pressing Escape; body scroll is locked while the modal is open
  - [x] AC-0076: The modal is responsive — a centred max-w-sm card with no overflow on viewports ≤ 375 px
  - [x] AC-0077: .github/workflows/version-bump.yml auto-bumps the patch version in package.json and package-lock.json when a PR is merged to develop; creates a short-lived chore/version-bump-* PR with auto-merge enabled so the bump lands on develop once CI passes (requires repo setting: Settings → General → Allow auto-merge)
Dependencies: US-0009

US-0027 (EPIC-0006): As a developer, I want code quality and accessibility improvements to the generator, so that it is more robust and the dashboard is more accessible.
Priority: Low (P2)
Estimate: S
Status: Done
Branch: claude/improvements-C7evU
Acceptance Criteria:
  - [x] AC-0069: npm run generate in package.json runs node tools/generate-plan.js
  - [x] AC-0070: Unknown top-level keys in plan-visualizer.config.json trigger a console warning and are ignored without crashing
  - [x] AC-0071: Chart.js charts are initialised only when the Charts tab is first activated (lazy initialisation)
  - [x] AC-0072: Activity panel Close, Collapse, and Expand buttons have descriptive aria-label attributes
Dependencies: US-0009, US-0013

US-0031 (EPIC-0006): As a user, I want a dark/light mode toggle and improved visual readability, so that the dashboard is comfortable to use in any lighting condition and secondary text is clearly legible.
Priority: Medium (P1)
Estimate: S
Status: Done
Branch: feature/dark-mode-readability
Acceptance Criteria:
  - [x] AC-0086: A sun/moon toggle button appears in the top-bar header; clicking it switches between dark and light themes
  - [x] AC-0087: The chosen theme persists across page loads via localStorage; the system prefers-color-scheme is used as the default if no preference has been saved
  - [x] AC-0088: All secondary text on white/light backgrounds uses at minimum text-slate-500 (no near-invisible text-slate-400 on light backgrounds)
  - [x] AC-0089: The "Updated" timestamp in the top bar shows both the date and the time in UTC (e.g. "2026-03-18 21:00 UTC")
  - [x] AC-0090: Traceability epic rows are coloured red when any child story has a Fail TC, amber when any has a Not Run TC, and grey otherwise; a badge label is shown in the row
Dependencies: US-0009

US-0032 (EPIC-0006): As a team member, I want to browse and cross-reference hard-won lessons in the dashboard, so that institutional knowledge is immediately accessible without navigating raw markdown files.
Priority: Medium (P2)
Estimate: S
Status: Done
Branch: feature/US-0032-lessons-tab
Acceptance Criteria:
  - [x] AC-0091: A Lessons tab appears in the tab bar after the Bugs tab
  - [x] AC-0092: Column view renders all lessons with ID, Rule, Context, Date, and Bug Ref columns
  - [x] AC-0093: Card view renders the same data in a card-per-lesson grid layout
  - [x] AC-0094: A toggle switches between column and card view; preference persists in localStorage
  - [x] AC-0095: Bug Ref cells in the Lessons tab link to the referencing bug row on the Bugs tab
  - [x] AC-0096: Lesson column on Bugs tab shows ✓ L-XXXX ↗ as a clickable link when a lesson ID is present
Dependencies: US-0009
```

---

## Tasks — EPIC-0006: Dashboard UX & Quality Improvements

```
TASK-0026 (US-0028): Add About button, modal dialog, version/build metadata, and version-bump workflow
Type: Dev
Assignee: Agent
Status: Done
Branch: feature/US-0023-about-dialog
Notes: About button in renderTopBar() wraps h1 in flex row; modal HTML injected before </body> in renderHtml(); openAbout/closeAbout/Escape JS in renderScripts(); data.version from package.json, data.buildNumber from git rev-list --count HEAD, data.githubUrl from config; version-bump.yml creates a chore/version-bump-* branch + auto-merge PR to develop on each PR merge; direct push to protected develop rejected by GH006 (fixed via auto-merge PR pattern)

TASK-0027 (US-0030): Implement attributeBugCosts() and wire into generate-plan.js
Type: Dev
Assignee: Agent
Status: Done
Branch: feature/US-0030-bug-fix-costs-tab
Notes: New function in compute-costs.js mirrors attributeAICosts() pattern; matches bug.fixBranch to costByBranch; result stored as costs._bugs in generate-plan.js

TASK-0028 (US-0030): Render Bug Fix Costs section in renderCostsTab()
Type: Dev
Assignee: Agent
Status: Done
Branch: feature/US-0030-bug-fix-costs-tab
Notes: Second table appended after closing </table> of story costs; only renders when data.bugs.length > 0; columns: Bug ID, Title, Severity, Status, Related Story, Fix Branch, AI Cost, Tokens

TASK-0029 (US-0030): Add unit tests for attributeBugCosts()
Type: Test
Assignee: Agent
Status: Done
Branch: feature/US-0030-bug-fix-costs-tab
Notes: 4 tests added to compute-costs.test.js; covers branch match, no branch, unmatched branch, empty array

TASK-0021 (US-0023): Implement mobile-responsive CSS overrides and traceability legend collapse
Type: Dev
Assignee: Agent
Status: Done
Branch: claude/fix-mobile-top-area-C7evU
Notes: @media (max-width: 767px) block compacts top bar; legend toggle via DOMContentLoaded; × close button added; flex-direction:column + order:-1 for trace layout; tokens-col hidden

TASK-0022 (US-0024): Fix AI cost key mismatch and add dual y-axis to Cost Breakdown chart
Type: Dev
Assignee: Agent
Status: Done
Branch: claude/fix-mobile-top-area-C7evU
Notes: Renamed aiCostUsd → costUsd in generate-plan.js costs object; added yAxisID per dataset + yProjected (left) / yAI (right) scale definitions in renderChartsTab

TASK-0023 (US-0025): Fix usd() rounding and consolidate top-bar stat tiles
Type: Dev
Assignee: Agent
Status: Done
Branch: claude/improvements-C7evU
Notes: usd() uses toFixed(2) for 0 < n < 1000; merged Lines Cov + Branch Cov into one Coverage tile; removed Stories and % tiles; progress bar label format "X/Y · Z% · N active"

TASK-0024 (US-0026): Add URL hash deep-linking and localStorage filter/tab persistence
Type: Dev
Assignee: Agent
Status: Done
Branch: claude/improvements-C7evU
Notes: history.replaceState in showTab(); applyFilters() saves all five filter values; clearFilters() removes them; DOMContentLoaded reads hash then localStorage to restore tab and filters

TASK-0025 (US-0027): Add npm generate script, config key validation, lazy chart init, and aria-labels
Type: Dev
Assignee: Agent
Status: Done
Branch: claude/improvements-C7evU
Notes: "generate" script added to package.json; KNOWN_KEYS check in loadConfig() logs warning for unknowns; initCharts guard via function reassignment; aria-label on Close/Collapse/Expand buttons

TASK-0030 (US-0031): Implement dark/light mode toggle, readability improvements, traceability epic row coloring, and header timestamp
Type: Dev
Assignee: Agent
Status: Done
Branch: feature/dark-mode-readability
Notes: tailwind.config={darkMode:'class'} + IIFE flash-prevention script in <head>; toggleTheme() in renderScripts(); dark: variants added to all tabs, filter bar, kanban, hierarchy, traceability, charts, costs, bugs, activity panel; text-slate-400 raised to text-slate-500 on light backgrounds; traceability epic rows compute hasFail/hasNotRun from child TCs; generatedAt.slice(11,16) appended to header date string

TASK-0031 (US-0032): Implement parse-lessons.js
Type: Dev
Assignee: Agent
Status: Done
Branch: feature/US-0032-lessons-tab

TASK-0032 (US-0032): Wire parseLessons into generate-plan.js
Type: Dev
Assignee: Agent
Status: Done
Branch: feature/US-0032-lessons-tab

TASK-0033 (US-0032): renderLessonsTab() with column/card views and Bugs tab lesson hyperlink
Type: Dev
Assignee: Agent
Status: Done
Branch: feature/US-0032-lessons-tab

TASK-0034 (US-0032): Unit tests for parseLessons and renderLessonsTab
Type: Dev
Assignee: Agent
Status: Done
Branch: feature/US-0032-lessons-tab
```

```
US-0033 (EPIC-0006): As a contributor, I want all dashboard colours defined as CSS custom properties, so that the light/dark theme is controlled from a single source of truth and extending the palette requires changing only one place.
Priority: Medium (P2)
Estimate: S
Status: Done
Branch: feature/US-0032-lessons-tab
Acceptance Criteria:
  - [x] AC-0097: All colour values in render-html.js are expressed as CSS custom properties (--clr-*); no standalone hex literals remain in CSS property rules
  - [x] AC-0098: Theme tokens are declared in :root (light defaults) and html.dark (dark overrides) blocks in renderPrintCSS()
  - [x] AC-0099: All tabs, filter bar, table headers, and chart text apply theme tokens and render correctly in both light and dark mode
Dependencies: US-0031

US-0034 (EPIC-0006): As a team member, I want to view the Hierarchy tab in either a column (tree) layout or a card layout, so that I can quickly scan stories grouped by epic.
Priority: Low (P3)
Estimate: S
Status: Done
Branch: feature/US-0032-lessons-tab
Acceptance Criteria:
  - [x] AC-0100: Hierarchy tab has ≡ Column and ⊞ Card toggle buttons at the top of the tab
  - [x] AC-0101: Column view shows the existing collapsible epic → story → AC tree
  - [x] AC-0102: Card view shows story cards grouped by epic in a responsive grid layout
  - [x] AC-0103: The selected view persists in localStorage and is restored on page reload
Dependencies: US-0009

US-0035 (EPIC-0006): As a dashboard user, I want the filter bar to show only the filters relevant to the currently active tab, so that irrelevant controls do not cause confusion.
Priority: Medium (P2)
Estimate: S
Status: Done
Branch: feature/US-0032-lessons-tab
Acceptance Criteria:
  - [x] AC-0104: Filter bar is positioned in the sticky navigation area immediately below the tab bar
  - [x] AC-0105: Story filters (epic, status, priority, search) are shown only when the Hierarchy or Kanban tab is active
  - [x] AC-0106: Bug filters (status, search) are shown only when the Bugs tab is active
  - [x] AC-0107: The filter bar is hidden entirely on Traceability, Charts, Costs, and Lessons tabs
Dependencies: US-0025

US-0036 (EPIC-0006): As a QA engineer, I want to filter the Bugs tab by status and free-text search, so that I can quickly find open or specific bugs.
Priority: Medium (P2)
Estimate: S
Status: Done
Branch: feature/US-0032-lessons-tab
Acceptance Criteria:
  - [x] AC-0108: Bug rows carry a data-status attribute matching the bug's Status field
  - [x] AC-0109: The f-bug-status dropdown filters bug rows by status in real time
  - [x] AC-0110: The search text box filters bug rows by matching text across ID, title, severity, story, and fix branch columns
Dependencies: US-0032

US-0037 (EPIC-0006): As a team member, I want Recent Activity entries to show the session number alongside the date, so that I can correlate activity items with specific session logs in progress.md.
Priority: Low (P3)
Estimate: XS
Status: Done
Branch: feature/US-0032-lessons-tab
Acceptance Criteria:
  - [x] AC-0111: Each Recent Activity entry displays the session number and date in the format 'Session N · YYYY-MM-DD'
  - [x] AC-0112: parse-progress.js captures sessionNum from the ## Session N — YYYY-MM-DD heading and returns it on each activity object
  - [x] AC-0113: Session number is displayed in a distinct style before the date
Dependencies: US-0009
```

```
TASK-0035 (US-0033): Replace hardcoded hex colours with CSS custom properties in render-html.js
Type: Dev
Assignee: Agent
Status: Done
Branch: feature/US-0032-lessons-tab
Notes: Defined --clr-body-bg, --clr-panel-bg, --clr-surface-raised, --clr-border, --clr-header-bg, --clr-header-text, --clr-input-bg, --clr-input-border, --clr-chart-text, --clr-accent and text tokens in :root and html.dark blocks; replaced all hex colour strings in CSS sections with var(--clr-*); added .tab-fill flexbox class; scroll-table thead th background rule for opaque sticky headers; chartTextColor() reads via getComputedStyle

TASK-0036 (US-0034): Add column/card view toggle and card view grid to renderHierarchyTab()
Type: Dev
Assignee: Agent
Status: Done
Branch: feature/US-0032-lessons-tab
Notes: Both views rendered server-side; JS setHierarchyView(v) toggles hidden class and persists selection to localStorage under 'hierarchyView'; card view groups story cards in a responsive grid under each epic heading; toggle buttons use hier-col-btn / hier-card-btn IDs

TASK-0037 (US-0035): Restructure renderFilterBar() with per-tab visibility; add updateFilterBar() JS
Type: Dev
Assignee: Agent
Status: Done
Branch: feature/US-0032-lessons-tab
Notes: fgrp-story span wraps epic/status/priority/search controls; fgrp-bug span wraps bug status/search controls; updateFilterBar(tabName) called from showTab() on every tab switch; hides entire bar on Charts/Costs/Traceability/Lessons; f-type select removed

TASK-0038 (US-0036): Add data-status to bug rows; add f-bug-status select; extend applyFilters() for Bugs tab
Type: Dev
Assignee: Agent
Status: Done
Branch: feature/US-0032-lessons-tab
Notes: <tr> elements in renderBugsTab() gain data-status="${bug.status}" and class="bug-row"; applyFilters() reads f-bug-status value and search text to filter .bug-row elements; clearFilters() resets f-bug-status to empty

TASK-0039 (US-0037): Update parse-progress.js to capture sessionNum; update renderRecentActivity()
Type: Dev
Assignee: Agent
Status: Done
Branch: feature/US-0032-lessons-tab
Notes: Regex updated to /^## Session (\d+) — (\d{4}-\d{2}-\d{2})/gm capturing sessionNum as group 1 and date as group 2; push call includes { sessionNum, date, summary }; renderRecentActivity() displays 'Session N · YYYY-MM-DD' in each activity entry
```

```
US-0038 (EPIC-0006): As a user, I want to view the Costs tab in a card layout, so that I can scan story and bug cost data at a glance without reading a dense table.
Priority: Low
Estimate: S
Status: Done
Branch: feature/US-0032-lessons-tab
Dependencies: US-0024
Acceptance Criteria:
  - [x] AC-0114: Column/card toggle appears at the top of the Costs tab; preference persists in localStorage
  - [x] AC-0115: Card view shows story cards grouped by epic with Projected and AI Actual values
  - [x] AC-0116: Bug Fix Costs card section shows one card per bug with severity, status, projected, and AI actual
```

```
TASK-0040 (US-0038): Implement card view and column/card toggle in renderCostsTab()
Type: Dev
Assignee: Agent
Status: Done
Branch: feature/US-0032-lessons-tab
Notes: setCostsView(v) toggles costs-column-view / costs-card-view; story cards grouped by epic; bug cards in grid; both sections in card view share overflow-y scroll container; tab-fill applied
```

```
US-0039 (EPIC-0006): As a user, I want to view the Bugs tab in a card layout, so that I can see key bug attributes in a compact, scannable grid.
Priority: Low
Estimate: S
Status: Done
Branch: feature/US-0032-lessons-tab
Dependencies: US-0036
Acceptance Criteria:
  - [x] AC-0117: Column/card toggle appears at the top of the Bugs tab; preference persists in localStorage
  - [x] AC-0118: Card view shows one card per bug with severity, status, related story, fix branch, and lesson link
  - [x] AC-0119: Bug status filter and text search apply to both column and card views
```

```
TASK-0041 (US-0039): Implement card view and column/card toggle in renderBugsTab()
Type: Dev
Assignee: Agent
Status: Done
Branch: feature/US-0032-lessons-tab
Notes: setBugsView(v) toggles bugs-column-view / bugs-card-view; card divs carry .bug-row class and data-status so existing applyFilters() works on both views without changes; setBugsView called in inline script on DOMContentLoaded
```

---

## Epic — EPIC-0007: Dashboard Visual Design Overhaul

```
EPIC-0007: Dashboard Visual Design Overhaul
Description: Replace the generic Tailwind slate palette and default blue accent with a distinctive dark design system. Improvements span the colour palette, badge styling, tab indicator, typography, hover interactions, and background texture to produce a visually unique dashboard.
Release Target: Release 1.3
Status: Done
Dependencies: EPIC-0006
```

---

## User Stories — EPIC-0007: Dashboard Visual Design Overhaul

```
US-0040 (EPIC-0007): As a user, I want the dashboard dark mode to use a custom near-black palette instead of Tailwind slate defaults, so that the design feels distinctive rather than template-like.
Priority: High (P0)
Estimate: S
Status: Done
Branch: feature/US-0040-visual-design-overhaul
Acceptance Criteria:
  - [x] AC-0120: CSS custom properties in html.dark are replaced with custom dark values: body-bg #0b0d12, panel-bg #111318, surface-raised #1a1d24, border #252831, border-mid #32363f
  - [x] AC-0121: All dark: Tailwind class references to bg-slate-800/700/900 in render-html.js are updated to use var(--clr-*) tokens or removed in favour of the CSS variable fallbacks
  - [x] AC-0122: node tools/generate-plan.js regenerates plan-status.html with the new palette and no regression in light mode or existing tests
Dependencies: US-0033
```

```
US-0041 (EPIC-0007): As a user, I want the accent colour to be a distinctive indigo/violet instead of the default Tailwind blue-500, so that active states, links, and focus indicators feel intentional rather than generic.
Priority: High (P0)
Estimate: S
Status: Done
Branch: feature/US-0040-visual-design-overhaul
Acceptance Criteria:
  - [x] AC-0123: --clr-accent in both :root and html.dark is changed from #3b82f6 to #7c3aed (violet-600); all var(--clr-accent) usages automatically pick up the new value
  - [x] AC-0124: Hard-coded blue-600 / text-blue-600 colour literals in epic headers, tab active underline, and about modal title are updated to use the new accent token
Dependencies: US-0033
```

```
US-0042 (EPIC-0007): As a user, I want status and priority badges to use a dark outlined style instead of pastel fills, so that they are visually sharp and legible on dark backgrounds.
Priority: Medium (P1)
Estimate: S
Status: Done
Branch: feature/US-0040-visual-design-overhaul
Acceptance Criteria:
  - [x] AC-0125: The badge() function in render-html.js is updated so each status/priority key maps to border + tinted dark background + bright text (e.g. Done → bg-[#052e16] text-[#4ade80] border border-[#166534])
  - [x] AC-0126: All seven statuses (Done, In Progress, Planned, To Do, Blocked, Open, Fixed) and all priority levels (P0, P1, P2, Critical, High, Medium, Low, Pass, Fail, Not Run) have distinct outlined dark styles; no pastel bg-*-100 classes remain
Dependencies: US-0040
```

```
US-0043 (EPIC-0007): As a user, I want the active tab to be indicated by a filled pill/capsule rather than an underline, so that the navigation looks distinctive and modern.
Priority: Medium (P1)
Estimate: XS
Status: Done
Branch: feature/US-0040-visual-design-overhaul
Acceptance Criteria:
  - [x] AC-0127: renderTabs() removes the border-b-2 underline pattern; the active tab button receives a filled background (e.g. bg-[#7c3aed] text-white rounded-md) while inactive buttons are unstyled text with hover highlight
  - [x] AC-0128: The JS showTab() function updates the active class to apply the filled pill style and remove it from all other tabs; localStorage tab persistence continues to work
Dependencies: US-0041
```

```
US-0044 (EPIC-0007): As a user, I want subtle hover transforms on story cards and top-bar stat tiles, so that the dashboard feels responsive and interactive.
Priority: Medium (P1)
Estimate: XS
Status: Done
Branch: feature/US-0040-visual-design-overhaul
Acceptance Criteria:
  - [x] AC-0129: Story cards in card view (renderHierarchyTab) and kanban cards gain transition-transform duration-150 and hover:scale-[1.02] via an inline style or class addition
  - [x] AC-0130: Top-bar stat tiles (.topbar-tile) gain transition-transform duration-150 and hover:-translate-y-0.5 via a CSS rule so they lift slightly on hover
Dependencies: US-0040
```

```
US-0045 (EPIC-0007): As a user, I want bolder, more dramatically scaled typography in the dashboard header and section labels, so that information hierarchy is immediately clear.
Priority: Medium (P2)
Estimate: XS
Status: Done
Branch: feature/US-0040-visual-design-overhaul
Acceptance Criteria:
  - [x] AC-0131: The project title h1 in renderTopBar() uses text-4xl font-black tracking-tight (up from text-3xl font-bold) on desktop; mobile override is adjusted proportionally
  - [x] AC-0132: Section header labels (epic IDs, table column headers, kanban column titles) use uppercase tracking-widest text-xs font-semibold styling to create clear visual separation from body text
Dependencies: US-0040
```

```
US-0046 (EPIC-0007): As a user, I want a subtle dot-grid texture on the page background, so that the flat solid background gains visual depth without being distracting.
Priority: Low (P2)
Estimate: XS
Status: Done
Branch: feature/US-0040-visual-design-overhaul
Acceptance Criteria:
  - [x] AC-0133: The body element (or a full-height wrapper) receives a CSS background-image using a repeating radial-gradient that produces a faint dot grid (e.g. radial-gradient(rgba(255,255,255,0.03) 1px, transparent 1px) at 24px × 24px)
  - [x] AC-0134: The dot grid is visible in dark mode and invisible/negligible in light mode; it does not interfere with print styles (@media print hides it)
Dependencies: US-0040
```

```
US-0047 (EPIC-0007): As a user, I want each epic block to have a distinct left-border accent line using a per-epic colour, so that epics are visually differentiated at a glance in the Hierarchy tab.
Priority: Low (P3)
Estimate: S
Status: Done
Branch: feature/US-0040-visual-design-overhaul
Acceptance Criteria:
  - [x] AC-0135: renderHierarchyTab() defines a fixed palette of 6–8 accent colours (one per epic slot, cycling if there are more epics than colours); each epic block receives a border-l-4 left border in its assigned colour
  - [x] AC-0136: The left-border accent colour is also used to tint the epic header background very subtly (e.g. bg-[color]/10) so the visual association between border and header is clear; story rows within the epic retain standard card styling
Dependencies: US-0040

US-0048 (EPIC-0007): As a user, I want the dashboard to use a sidebar navigation, blue gradient header with glassmorphic stat tiles, and epic swimlanes on the Kanban board, so that the layout is more navigable and visually distinctive.
Priority: High (P1)
Estimate: L
Status: Done
Branch: feature/US-0048-ui-redesign-sidebar
Acceptance Criteria:
  - [x] AC-0137: Dashboard replaces horizontal tab strip with a vertical sidebar nav (200px on desktop, icon-only on mobile) with inline SVG icons and active state highlighting
  - [x] AC-0138: Topbar uses a blue gradient background with glassmorphic stat tiles showing Stories, In Progress, Bugs Open, Coverage, AI Cost, and Estimated projected cost
  - [x] AC-0139: Kanban tab groups stories into Epic swimlanes within each status column
  - [x] AC-0140: All 87 open bugs from prior sessions are resolved and marked Fixed
Dependencies: US-0047

US-0049 (EPIC-0007): As a user, I want the Kanban board to group stories into Epic swimlanes within each status column, so that I can see how each epic is progressing across the board at a glance.
Priority: Medium (P2)
Estimate: S
Status: Retired
Branch: feature/US-0048-ui-redesign-sidebar
Acceptance Criteria:
  - [x] AC-0141: Each status column groups its stories by Epic, with a coloured swimlane header (10px uppercase, epic ID) and a matching left border using a per-epic accent colour from a fixed 8-colour palette
  - [x] AC-0142: Stories with no epicId are rendered ungrouped after all swimlane groups in the column
Dependencies: US-0048

US-0050 (EPIC-0007): As a user, I want the Kanban board to display Epic swimlane rows that span all status columns, with collapsible rows, so that I can see the full picture of an epic across all statuses and hide epics I'm not focused on.
Priority: High (P1)
Estimate: M
Status: Done
Branch: feature/US-0048-ui-redesign-sidebar
Acceptance Criteria:
  - [x] AC-0143: Kanban is restructured as a 2D CSS grid — Epic rows (Y) × Status columns (X) — where each swimlane header row spans the full board width and each cell contains stories matching that epic + status combination
  - [x] AC-0144: Clicking an epic swimlane header collapses/expands its story row (▼/▶ toggle) using toggleKsw(); collapsed state is reflected in the arrow indicator
Dependencies: US-0049

US-0051 (EPIC-0007): As a user, I want the Bug Fix Costs section in the Costs tab to group bugs by their related epic (collapsible, ascending order), so that bug remediation spend is visible in the same structure as story costs.
Priority: Medium (P2)
Estimate: S
Status: Done
Branch: feature/US-0048-ui-redesign-sidebar
Acceptance Criteria:
  - [x] AC-0145: Bug Fix Costs column view groups bugs into collapsible per-epic <tbody> sections with accent-coloured headers showing epic ID, title, count, and per-epic projected/AI/token totals
  - [x] AC-0146: Bug Fix Costs card view groups bugs into collapsible bordered accordion blocks matching the story costs card view style
  - [x] AC-0147: All bug epic groups (Bugs tab and Bug Fix Costs) are sorted in ascending epic ID order with ungrouped bugs appearing last
Dependencies: US-0050

US-0052 (EPIC-0007): As a user, I want all epic group sections to start collapsed by default, the traceability epic header to match the hierarchy style, and the Stories chip to exclude Retired stories, so that the dashboard loads in a clean compact state with consistent visuals.
Priority: Medium (P2)
Estimate: S
Status: Done
Branch: feature/US-0048-ui-redesign-sidebar
Acceptance Criteria:
  - [x] AC-0148: All epic group accordion sections across Hierarchy, Kanban, Costs, Bugs, Lessons, and Traceability tabs render with hidden content and ▶ arrow on initial page load
  - [x] AC-0149: The Traceability tab epic header row uses EPIC_ACCENT_COLORS (tinted background, 4px coloured left border, mono uppercase epic ID, status badge) matching the Hierarchy tab epic header style
Dependencies: US-0051
```

---

## Technical Debt

```
US-0053 (EPIC-0014): As a developer, I want the render-html.js module to be split into smaller focused files, so that the codebase is easier to maintain and debug.
Priority: Low (P3)
Estimate: M
Status: Planned
Branch:
Acceptance Criteria:
  - [ ] AC-0150: render-html.js is refactored into separate modules (e.g., render-header.js, render-tabs.js, render-charts.js, render-scripts.js)
  - [ ] AC-0151: Each module exports a single render function that follows the existing contract
  - [ ] AC-0152: All existing tests pass after refactoring
  - [ ] AC-0153: The generate-plan.js orchestrator imports from the new module files
Dependencies: None
```

---

## Epic — EPIC-0008: Trend Analysis & Historical Tracking

```
EPIC-0008: Trend Analysis & Historical Tracking
Description: Capture and visualise project metrics over time. Store snapshots of dashboard data on each generation and display trend charts showing progress, costs, coverage, and velocity.
Release Target: Release 1.4
Status: Done
Dependencies: EPIC-0007
```

---

## User Stories — EPIC-0008: Trend Analysis & Historical Tracking

```
US-0054 (EPIC-0008): As a user, I want the dashboard to store a JSON snapshot on each generation, so that historical data can be analysed over time.
Priority: High (P0)
Estimate: S
Status: Done
Branch: feature/EPIC-0008-trends-snapshots
Acceptance Criteria:
  - [x] AC-0150: A .history/ directory is created in the project root (gitignored) if it does not exist
  - [x] AC-0151: On each generate-plan.js run, a timestamped JSON file (e.g., 2026-03-30T14-00-00Z.json) is saved to .history/ containing all parsed dashboard data (epics, stories, bugs, costs, coverage, lessons, progress)
  - [x] AC-0152: The snapshot includes a generation timestamp, Git commit SHA (if available), and all data sections that would otherwise be rendered to HTML
  - [x] AC-0153: Invalid or corrupt JSON files in .history/ are gracefully skipped without crashing
Dependencies: None

US-0055 (EPIC-0008): As a user, I want to view a progress trend chart showing story completion over time, so that I can see whether the project is accelerating or decelerating.
Priority: High (P0)
Estimate: S
Status: Done
Branch: feature/EPIC-0008-trends-snapshots
Acceptance Criteria:
  - [x] AC-0154: The Charts tab displays a new "Progress Over Time" line chart with dates on X-axis and cumulative Done story count on Y-axis
  - [x] AC-0155: Data is sourced from .history/ snapshots; each point represents a generation timestamp
  - [x] AC-0156: If fewer than 2 snapshots exist, the chart shows a placeholder message "Generate the dashboard at least twice to see trends"
  - [x] AC-0157: Hovering a data point shows a tooltip with the date and Done/Total story count
Dependencies: US-0054

US-0056 (EPIC-0008): As a user, I want to view a cost trend chart showing AI spend over time, so that I can track budget burn rate.
Priority: Medium (P1)
Estimate: S
Status: Done
Branch: feature/EPIC-0008-trends-snapshots
Acceptance Criteria:
  - [x] AC-0158: The Charts tab displays a new "AI Cost Over Time" line chart with dates on X-axis and cumulative AI spend ($) on Y-axis
  - [x] AC-0159: Data is sourced from .history/ snapshots; the line shows total spend to date
  - [x] AC-0160: If fewer than 2 snapshots exist, the chart shows the same placeholder as AC-0156
  - [x] AC-0161: Hovering a data point shows a tooltip with the date and total spend
Dependencies: US-0054

US-0057 (EPIC-0008): As a user, I want to view a coverage trend chart showing test coverage over time, so that I can verify coverage improvements are sustained.
Priority: Medium (P1)
Estimate: S
Status: Done
Branch: feature/EPIC-0008-trends-snapshots
Acceptance Criteria:
  - [x] AC-0162: The Charts tab displays a new "Coverage Over Time" line chart with dates on X-axis and overall coverage % on Y-axis
  - [x] AC-0163: Data is sourced from .history/ snapshots; each point shows the overall coverage percentage from that snapshot
  - [x] AC-0164: A horizontal reference line at 80% is drawn to visualise the coverage target
  - [x] AC-0165: If fewer than 2 snapshots exist, the chart shows the placeholder message
Dependencies: US-0054

US-0058 (EPIC-0008): As a user, I want to view a velocity chart showing story points completed per release, so that I can predict future delivery dates.
Priority: Medium (P1)
Estimate: S
Status: Done
Branch: feature/EPIC-0008-trends-snapshots
Acceptance Criteria:
  - [x] AC-0166: The Charts tab displays a new "Velocity" bar chart with release names on X-axis and total completed story points (Done) on Y-axis
  - [x] AC-0167: Points are summed from story estimates (L=5, M=3, S=1, XS=0.5) where status is Done
  - [x] AC-0168: If no stories have estimates, the chart shows a placeholder "Add estimates to stories to see velocity"
Dependencies: US-0054

US-0079 (EPIC-0008): As a user, I want to backfill historical trend data when no real snapshots exist, so that the Trends charts are useful from the first generation.
Priority: High (P0)
Estimate: S
Status: Done
Branch: feature/EPIC-0009-budget-forecasting
Acceptance Criteria:
  - [x] AC-0247: A backfillHistory(options) function in tools/lib/historical-sim.js generates synthetic snapshots going back ~30 days from project start
  - [x] AC-0248: Backfill distributes actual costs proportionally across simulated time periods using average tokens per story estimate from Done stories
  - [x] AC-0249: The function is exported as a module and can be called programmatically
  - [x] AC-0250: The install.sh script prompts users "Would you like to estimate historical data? (y/n)" and runs backfillHistory() if yes
Dependencies: US-0054

US-0080 (EPIC-0008): As a user, I want the Trends charts to show bug count and risk trends over time, so that I can visualise defect and at-risk story trends.
Priority: Medium (P2)
Estimate: S
Status: Done
Branch: feature/EPIC-0008-trends-snapshots
Acceptance Criteria:
  - [x] AC-0251: Trends tab displays an "Open Bugs Over Time" line chart sourced from .history/ snapshots
  - [x] AC-0252: Trends tab displays an "At-Risk Stories Over Time" line chart sourced from .history/ snapshots
  - [x] AC-0253: Trends tab displays a "Token Usage Over Time" stacked area chart showing input/output tokens over time
Dependencies: US-0054

US-0084 (EPIC-0008): As a user, I want the Trends charts to be visually polished, so that x-axis labels are readable, token values are abbreviated, grid lines work in dark mode, and the At-Risk chart is not misleadingly scaled.
Priority: Medium (P1)
Estimate: S
Status: Done
Branch: feature/US-0084-trends-ui-polish
Spec: docs/superpowers/specs/2026-04-08-trends-ui-dashboard-date-design.md
Plan: docs/superpowers/plans/2026-04-08-trends-ui-dashboard-date.md
Acceptance Criteria:
  - [x] AC-0264: X-axis shows ≤8 short date labels (M/D format) with no overlap across all 7 Trends charts
  - [x] AC-0265: Token chart y-axis shows abbreviated numbers (e.g., 45M not 45,000,000)
  - [x] AC-0266: Grid lines are subtle in dark mode (rgba(255,255,255,0.07)) and standard in light mode (#e2e8f0)
  - [x] AC-0267: At-Risk chart y-axis uses suggestedMax: 5 — never collapses to 0–1.0 scale
Dependencies: US-0054
```

---

## Epic — EPIC-0009: Budget Forecasting

```
EPIC-0009: Budget Forecasting
Description: Track burn rate and predict when budget exhausts. Alert when projected costs exceed thresholds. Help teams stay on budget by visualising spend velocity and forecasting future costs.
Release Target: Release 1.5
Status: Done
Dependencies: EPIC-0008
```

---

## User Stories — EPIC-0009: Budget Forecasting

```
US-0059 (EPIC-0009): As a project manager, I want to set a total budget ceiling and per-epic budget limits, so that I can track spend against defined limits.
Priority: High (P0)
Estimate: S
Status: Done
Branch: feature/EPIC-0009-budget-forecasting
Acceptance Criteria:
  - [x] AC-0169: plan-visualizer.config.json accepts a "budget" object with "totalUsd" (number) and "byEpic" (object mapping epicId to budget amounts)
  - [x] AC-0170: The dashboard displays a budget progress bar in the top bar showing "Spent $X / $Y Budget" with a percentage
  - [x] AC-0171: If total spend exceeds budget, the progress bar turns red and shows an warning icon
  - [x] AC-0172: Config validation warns if budget values are not positive numbers
Dependencies: None

US-0060 (EPIC-0009): As a project manager, I want to see a burn rate calculation (daily/weekly spend), so that I can predict when the budget will be exhausted.
Priority: High (P0)
Estimate: M
Status: Done
Branch: feature/EPIC-0009-budget-forecasting
Acceptance Criteria:
  - [x] AC-0173: Using .history/ snapshots, calculate the average daily spend over the last 30 days (or available history)
  - [x] AC-0174: The Costs tab displays "Burn Rate: $X/day" and "Projected Exhaustion: Y days remaining" based on current spend velocity
  - [x] AC-0175: If burn rate is zero or negative (no recent spend), show "No recent spend data" instead of a projection
  - [x] AC-0176: A line on the Cost Trend chart extrapolates forward using the calculated burn rate, shown as a dotted line
Dependencies: US-0054, US-0059

US-0061 (EPIC-0009): As a project manager, I want to receive alerts when projected costs exceed configurable thresholds, so that I can take action before going over budget.
Priority: Medium (P1)
Estimate: S
Status: Done
Branch: feature/EPIC-0009-budget-forecasting
Acceptance Criteria:
  - [x] AC-0177: Config accepts "budget.thresholds" as an array of percentage triggers (e.g., [50, 75, 90, 100])
  - [x] AC-0178: When spend crosses a threshold, a dismissible alert banner appears at the top of the dashboard: "Budget Alert: X% of budget consumed"
  - [x] AC-0179: Alert state is stored in localStorage so it doesn't reappear after being dismissed for the current generation
  - [x] AC-0180: Alerts are colour-coded: green (50%), amber (75%), red (90%+)
Dependencies: US-0059, US-0060

US-0062 (EPIC-0009): As a project manager, I want to see per-epic budget breakdown and remaining amounts, so that I can identify which epics are over/under budget.
Priority: Medium (P1)
Estimate: S
Status: Done
Branch: feature/EPIC-0009-budget-forecasting
Acceptance Criteria:
  - [x] AC-0181: The Costs tab displays a per-epic budget table with columns: Epic ID, Budget, Spent, Remaining, % Used
  - [x] AC-0182: Rows are sorted by % Used descending (most over-budget first); epics without defined budgets are shown at the bottom with "—"
  - [x] AC-0183: Per-epic budget rows use the same accent colours as the epic swimlanes for visual consistency
Dependencies: US-0059

US-0063 (EPIC-0009): As a developer, I want to export a budget report as CSV, so that I can share financial status with stakeholders who don't use the dashboard.
Priority: Low (P2)
Estimate: S
Status: Done
Branch: feature/EPIC-0009-budget-forecasting
Acceptance Criteria:
  - [x] AC-0184: A "Export Budget CSV" button appears on the Costs tab
  - [x] AC-0185: Clicking downloads a CSV with columns: Date, Epic ID, Epic Title, Budget, Spent, Remaining, % Used, Burn Rate, Projected Exhaustion
  - [x] AC-0186: CSV includes all historical snapshots as rows for trend analysis in external tools
Dependencies: US-0060

US-0081 (EPIC-0009): As a project manager, I want the budget to automatically estimate Planned story costs and set total budget to actuals plus estimated, so that I don't have to manually configure budgets.
Priority: High (P0)
Estimate: S
Status: Done
Branch: feature/EPIC-0009-budget-forecasting
Acceptance Criteria:
  - [x] AC-0254: computeBudgetMetrics() calculates average tokens per story estimate (XS, S, M, L, XL) from Done stories
  - [x] AC-0255: For each Planned story, estimated cost is calculated using average tokens × rates ($3/M input, $15/M output tokens)
  - [x] AC-0256: Total budget = actual spent + sum of estimated Planned story costs (auto-calculated if not manually configured)
  - [x] AC-0257: Per-epic budgets are estimated proportionally if not manually configured
Dependencies: US-0059, US-0079
```

---

## Epic — EPIC-0010: Risk Analytics

```
EPIC-0010: Risk Analytics
Description: More sophisticated risk scoring weighted by priority and severity. Risk trend chart over time. Predict project completion date based on velocity.
Release Target: Release 1.6
Status: Planned
Dependencies: EPIC-0009
```

---

## User Stories — EPIC-0010: Risk Analytics

```
US-0064 (EPIC-0010): As a project manager, I want stories to have a composite risk score based on priority, severity, and status, so that I can prioritise mitigation efforts.
Priority: High (P0)
Estimate: M
Status: Planned
Branch:
Acceptance Criteria:
  - [ ] AC-0187: Each story receives a risk score calculated as: (priorityWeight × 0.4) + (severityWeight × 0.3) + (statusWeight × 0.3)
  - [ ] AC-0188: Priority weights: P0=4, P1=3, P2=2, P3=1; Severity weights (for bugs): Critical=4, High=3, Medium=2, Low=1; Status weights: Blocked=4, In Progress=3, Planned=2, To Do=1, Done=0
  - [ ] AC-0189: The Hierarchy tab displays a risk badge (Low/Medium/High/Critical) on each story card based on score thresholds (0-1: Low, 1.1-2: Medium, 2.1-3: High, 3.1+: Critical)
  - [ ] AC-0190: Stories can be sorted by risk score descending in the Hierarchy tab
Dependencies: None

US-0065 (EPIC-0010): As a project manager, I want a risk trend chart showing aggregate risk over time, so that I can see if the project is becoming more or less risky.
Priority: Medium (P1)
Estimate: S
Status: Planned
Branch:
Acceptance Criteria:
  - [ ] AC-0191: The Charts tab displays a "Risk Trend" line chart with dates on X-axis and average risk score on Y-axis
  - [ ] AC-0192: Data is sourced from .history/ snapshots; each point is the average risk score of all stories at that point in time
  - [ ] AC-0193: A horizontal reference line at 2.0 (High threshold) helps identify when risk crosses into critical territory
  - [ ] AC-0194: If fewer than 2 snapshots exist, show placeholder message
Dependencies: US-0054, US-0064

US-0066 (EPIC-0010): As a project manager, I want to predict the project completion date based on current velocity, so that I can set realistic delivery expectations.
Priority: High (P0)
Estimate: M
Status: Planned
Branch:
Acceptance Criteria:
  - [ ] AC-0195: Using .history/ data, calculate weekly velocity as the average story points completed per week over the last 4 weeks
  - [ ] AC-0196: Remaining story points = sum of estimates for all non-Done stories
  - [ ] AC-0197: Projected completion = today + (remainingPoints / weeklyVelocity × 7 days)
  - [ ] AC-0198: The dashboard displays "Estimated Completion: YYYY-MM-DD (based on N weeks of velocity data)" in the top bar
  - [ ] AC-0199: If insufficient velocity data (< 2 weeks), show "Insufficient data for completion estimate"
Dependencies: US-0054, US-0058

US-0067 (EPIC-0010): As a project manager, I want to see an at-risk epic summary highlighting which epics are most likely to miss deadlines, so that I can focus rescue efforts.
Priority: Medium (P1)
Estimate: S
Status: Planned
Branch:
Acceptance Criteria:
  - [ ] AC-0200: Each epic receives an aggregate risk score = average of all story risk scores within that epic
  - [ ] AC-0201: The Hierarchy tab epic headers display a risk indicator (Low/Medium/High/Critical) matching the epic's aggregate score
  - [ ] AC-0202: Epics are sorted by risk score descending by default within each tab that shows epics
  - [ ] AC-0203: A filter allows showing only High/Critical risk epics
Dependencies: US-0064

US-0068 (EPIC-0010): As a project manager, I want to see a Monte Carlo simulation for completion date range, so that I can provide stakeholders with optimistic, likely, and pessimistic delivery dates.
Priority: Low (P2)
Estimate: L
Status: Planned
Branch:
Acceptance Criteria:
  - [ ] AC-0204: Using historical velocity data, run 1000 Monte Carlo iterations sampling from weekly velocity distribution
  - [ ] AC-0205: Display three completion dates: Optimistic (10th percentile), Likely (50th percentile), Pessimistic (90th percentile)
  - [ ] AC-0206: Show as a date range in the top bar: "Completion: Mar 15 — Apr 20 (likely Apr 1)"
  - [ ] AC-0207: If velocity data is insufficient (< 4 weeks), fall back to the simple projection from US-0066
Dependencies: US-0066
```

---

## Epic — EPIC-0011: Search

```
EPIC-0011: Search
Description: Global search across all stories, bugs, and lessons. Quick jump to any item by ID.
Release Target: Release 1.7
Status: Done
Dependencies: EPIC-0010
```

---

## User Stories — EPIC-0011: Search

```
US-0069 (EPIC-0011): As a user, I want a global search bar that searches across all content types, so that I can quickly find any story, bug, or lesson.
Priority: High (P0)
Estimate: M
Status: Done
Branch: feature/US-0069-global-search
Acceptance Criteria:
  - [x] AC-0208: A global search input appears in the sidebar (or top bar on mobile) with placeholder "Search stories, bugs, lessons..."
  - [x] AC-0209: Search indexes: story ID, title, description; bug ID, title, severity; lesson ID, rule, context
  - [x] AC-0210: Results appear in a dropdown as the user types (debounced 200ms); max 10 results shown
  - [x] AC-0211: Each result shows: type icon (story/bug/lesson), ID, title, and parent context (e.g., "in EPIC-0003")
  - [x] AC-0212: Clicking a result navigates to the relevant tab and scrolls to/expands the item
Dependencies: None

US-0070 (EPIC-0011): As a user, I want to jump directly to any item by typing its ID, so that I can quickly access known items without searching.
Priority: High (P0)
Estimate: S
Status: Done
Branch: feature/US-0069-global-search
Acceptance Criteria:
  - [x] AC-0213: Typing a known ID (e.g., "US-0042", "BUG-0015", "TC-0099") in the global search immediately shows that single result
  - [x] AC-0214: If the ID exists, the result is highlighted with a "Jump to" label
  - [x] AC-0215: Pressing Enter with a valid ID navigates directly to the item
  - [x] AC-0216: Invalid IDs show "No results found" rather than an empty dropdown
Dependencies: US-0069

US-0071 (EPIC-0011): As a user, I want search to support fuzzy matching, so that I can find items even with typos or partial matches.
Priority: Medium (P1)
Estimate: S
Status: Done
Branch: feature/US-0069-global-search
Acceptance Criteria:
  - [x] AC-0217: Search uses fuzzy matching (e.g., "stor" matches "story", "bug" matches all bugs)
  - [x] AC-0218: Results are sorted by relevance score (exact match > starts with > contains)
  - [x] AC-0219: Matched text portions are highlighted in results (e.g., "<strong>stor</strong>y")
Dependencies: US-0069

US-0072 (EPIC-0011): As a user, I want recent searches to be remembered, so that I can quickly re-run previous searches.
Priority: Low (P2)
Estimate: S
Status: Done
Branch: feature/US-0069-global-search
Acceptance Criteria:
  - [x] AC-0220: The last 5 unique search queries are stored in localStorage under 'recentSearches'
  - [x] AC-0221: When the search input is focused but empty, show a "Recent Searches" section with clickable pills
  - [x] AC-0222: Clicking a recent search populates the input and runs the search
  - [x] AC-0223: A clear (×) button clears the recent searches list
Dependencies: US-0069
```

---

## Epic — EPIC-0012: Stakeholder View

```
EPIC-0012: Stakeholder View
Description: Simplified read-only view for non-technical stakeholders. Exportable summary report.
Release Target: Release 1.8
Status: Planned
Dependencies: EPIC-0011
```

---

## User Stories — EPIC-0012: Stakeholder View

```
US-0073 (EPIC-0012): As a project manager, I want a stakeholder-friendly view that hides technical details, so that non-technical team members can understand project status without confusion.
Priority: High (P0)
Estimate: M
Status: Planned
Branch:
Acceptance Criteria:
  - [ ] AC-0224: A "Stakeholder View" toggle appears in the sidebar (or top bar) next to the theme toggle
  - [ ] AC-0225: When enabled, the dashboard switches to a simplified layout: only shows Progress, Milestones (epics), Risks, and Budget sections
  - [ ] AC-0226: Technical elements are hidden: branch names, token counts, test case details, lesson IDs, bug fix branches
  - [ ] AC-0227: Status labels use plain language: "In Progress" → "Being Worked On", "To Do" → "Planned", "At Risk" → "Needs Attention"
Dependencies: None

US-0074 (EPIC-0012): As a stakeholder, I want to see a high-level milestone progress view, so that I can understand which epics are on track.
Priority: High (P0)
Estimate: S
Status: Planned
Branch:
Acceptance Criteria:
  - [ ] AC-0228: The Stakeholder View displays each epic as a milestone card with: Epic ID, Title, Status, Progress bar (% Done), and Key Risks
  - [ ] AC-0229: Progress is calculated as Done stories / Total stories for that epic
  - [ ] AC-0230: Each card shows a simplified status: "On Track" (Done + In Progress > 50%), "At Risk" (Blocked or In Progress < 50%), "Complete" (all Done)
  - [ ] AC-0231: Clicking a milestone card expands to show top-level story summaries (no AC details)
Dependencies: US-0073

US-0075 (EPIC-0012): As a stakeholder, I want to see a budget summary with simple traffic-light indicators, so that I can understand financial health at a glance.
Priority: Medium (P1)
Estimate: S
Status: Planned
Branch:
Acceptance Criteria:
  - [ ] AC-0232: Budget section shows: Total Budget, Spent, Remaining, and a traffic light (🟢 <50%, 🟡 50-80%, 🔴 >80%)
  - [ ] AC-0233: Burn rate and projected exhaustion date are shown in plain language: "At current pace, budget lasts X more weeks"
  - [ ] AC-0234: All technical details (exact token counts, per-epic breakdowns) are hidden
Dependencies: US-0073, US-0060

US-0076 (EPIC-0012): As a project manager, I want to export a PDF summary report for stakeholders, so that I can share status via email without granting dashboard access.
Priority: High (P0)
Estimate: M
Status: Planned
Branch:
Acceptance Criteria:
  - [ ] AC-0235: An "Export PDF" button appears in the Stakeholder View header
  - [ ] AC-0236: Clicking generates a PDF with: project name, date, overall progress, milestone cards, budget summary, and top 3 risks
  - [ ] AC-0237: The PDF uses a clean, branded layout suitable for executive presentation
  - [ ] AC-0238: PDF generation happens client-side using the browser's print-to-PDF or a library (e.g., html2pdf.js)
Dependencies: US-0073, US-0074, US-0075

US-0077 (EPIC-0012): As a stakeholder, I want to subscribe to weekly email digests, so that I receive updates without accessing the dashboard.
Priority: Low (P2)
Estimate: L
Status: Planned
Branch:
Acceptance Criteria:
  - [ ] AC-0239: A "Subscribe to Updates" form in the Stakeholder View accepts an email address
  - [ ] AC-0240: Email subscriptions are stored in a JSON file (e.g., stakeholders.json) in the project
  - [ ] AC-0241: A new script (tools/email-digest.js) generates a plain-text or HTML email summary from the latest .history/ snapshot
  - [ ] AC-0242: The script can be run manually or via cron; it outputs an email-ready HTML fragment (not a full dashboard)
Dependencies: US-0054, US-0076

US-0078 (EPIC-0012): As a developer, I want to password-protect the stakeholder view, so that sensitive project data is not exposed to unintended audiences.
Priority: Medium (P1)
Estimate: S
Status: Planned
Branch:
Acceptance Criteria:
  - [ ] AC-0243: plan-visualizer.config.json accepts a "stakeholderPassword" string field
  - [ ] AC-0244: When set, accessing the dashboard prompts for a password; stakeholder view is only accessible after authentication
  - [ ] AC-0245: Password is hashed (bcrypt) or compared client-side (simpler for static deployment)
  - [ ] AC-0246: The regular dashboard view remains accessible without password; only stakeholder view requires it
Dependencies: US-0073
```

Acceptance Criteria:

- [ ] AC-0154: generate-plan.js saves a snapshot JSON to docs/snapshots/YYYY-MM-DD.json on each run
- [ ] AC-0155: Snapshot contains: timestamp, story counts by status, epic counts, costs totals, coverage metrics, bug counts, lesson counts
- [ ] AC-0156: Config option snapshots.enabled (default: true) controls whether snapshots are saved
- [ ] AC-0157: Config option snapshots.path (default: docs/snapshots) specifies the output directory
- [ ] AC-0158: Snapshot file names use ISO date format (YYYY-MM-DD) and are sorted chronologically
      Dependencies: None

```

```

US-0055 (EPIC-0008): As a user, I want a Trends tab that shows charts of project metrics over time, so that I can visualise progress, costs, and coverage trends.
Priority: High (P0)
Estimate: M
Status: Planned
Branch:
Acceptance Criteria:

- [ ] AC-0159: A new "Trends" tab appears in the sidebar navigation after Lessons
- [ ] AC-0160: Progress Burn-down chart shows stories completed over time (line chart)
- [ ] AC-0161: Cost Accumulation chart shows cumulative AI spend over time (line chart)
- [ ] AC-0162: Coverage Trend chart shows lines % and branch % over time (dual-line chart)
- [ ] AC-0163: Bug Burn chart shows open vs closed bugs over time (stacked area chart)
- [ ] AC-0164: Each chart includes at least 2 data points; shows message if insufficient data
      Dependencies: US-0054

```

```

US-0056 (EPIC-0008): As a user, I want to filter trend charts by date range, so that I can focus on specific time periods.
Priority: Medium (P1)
Estimate: S
Status: Planned
Branch:
Acceptance Criteria:

- [ ] AC-0165: Date range picker allows selecting start and end dates
- [ ] AC-0166: All trend charts update to show only data within the selected range
- [ ] AC-0167: Quick filters for "Last 7 days", "Last 30 days", "All time"
      Dependencies: US-0055

```

```

US-0057 (EPIC-0008): As a user, I want to see velocity metrics in the trends, so that I can predict project completion and budget burn rate.
Priority: Medium (P1)
Estimate: S
Status: Planned
Branch:
Acceptance Criteria:

- [ ] AC-0168: Velocity chart shows stories completed per session/week
- [ ] AC-0169: Average velocity (stories per session) displayed as a dashed reference line
- [ ] AC-0170: Projected completion date calculated based on remaining stories and average velocity
      Dependencies: US-0055

```

```

US-0058 (EPIC-0008): As a user, I want snapshot storage to be managed automatically, so that old snapshots don't accumulate indefinitely.
Priority: Low (P2)
Estimate: S
Status: Planned
Branch:
Acceptance Criteria:

- [ ] AC-0171: Config option snapshots.retainDays (default: 90) deletes snapshots older than N days
- [ ] AC-0172: Config option snapshots.maxCount (default: 100) limits total snapshot count, keeping most recent
- [ ] AC-0173: Cleanup runs on each generate-plan.js execution
      Dependencies: US-0054

```

---

## Standalone Stories

```

US-0085: As a user, I want the agentic dashboard footer to show the full date and time of the last generation, so that I know how fresh the data is.
Priority: Medium (P1)
Estimate: XS
Status: Done
Branch: feature/US-0084-trends-ui-polish
Spec: docs/superpowers/specs/2026-04-08-trends-ui-dashboard-date-design.md
Plan: docs/superpowers/plans/2026-04-08-trends-ui-dashboard-date.md
Acceptance Criteria:

- [x] AC-0268: Footer shows "Last refreshed: [date and time]", e.g. "Last refreshed: Apr 8, 2026, 04:32 PM"
- [x] AC-0269: Date/time uses en-US locale with month (short), day, year, hour, minute, hour12 format
      Dependencies: None

```

```

US-0086: As a user, I want the Bugs, Traceability, and Lessons tabs to have a search/filter bar so I can quickly find entries without scrolling through all items.
Priority: Medium (P1)
Estimate: S
Status: Done
Branch: develop
Acceptance Criteria:

- [x] AC-0270: Bugs tab filter bar shows Epic, Status, and Severity dropdowns plus text search
- [x] AC-0271: Traceability and Lessons tabs show the shared text search box in the filter bar
- [x] AC-0272: Filter bar Clear button resets all filters including the new bug epic/severity dropdowns
- [x] AC-0273: Bug cards and lesson cards include data-severity attribute enabling severity filter to work on card view
      Dependencies: US-0069

```

```

US-0087: As a user, I want the Plan Visualizer topbar buttons to use the same pill style as the Agentic Dashboard so both pages feel visually consistent.
Priority: Low (P2)
Estimate: XS
Status: Done
Branch: develop
Acceptance Criteria:

- [x] AC-0274: Topbar buttons use rounded pill shape (border-radius: 20px) with semitransparent fill matching Agentic Dashboard btn-header style
- [x] AC-0275: About button shows ℹ️ icon prefix; Agent Dashboard link shows ← Agentic Dashboard
- [x] AC-0276: Theme toggle shows "☀️ Light" or "🌙 Dark" text instead of a bare symbol
      Dependencies: US-0085

```

```

---

### Epic 13: Agentic SDLC Pipeline & Live Dashboard

```
EPIC-0013: Agentic SDLC Pipeline & Live Dashboard
Description: The orchestration framework, agent roster, multi-platform spawn helper, concurrency safety utilities, live HTML dashboard, sdlc-status schema, and plan visualizer that powered the agentic build of the CTC-Mobile-Wishlist POC and now ship as features of PlanVisualizer.
Release Target: Tooling (internal)
Status: Done
Dependencies: None
```

```
US-0088 (EPIC-0013): As a pipeline engineer, I want a documented agent roster and orchestration framework with named roles, icons, and prompt templates, so that any team member can understand and extend the agentic pipeline.
Priority: High
Estimate: M
Status: Done
Branch: develop
Dependencies: None
Acceptance Criteria:
  - [x] AC-0277: agents.config.json exists as the single source of truth, defining name, role, icon, color, and instructionFile for each agent
  - [x] AC-0278: Nine agent roles are defined — Conductor (DM), Compass (PO), Keystone (Architect), Lens (Reviewer), Palette (UI Designer), Forge (BE Dev), Pixel (FE Dev), Sentinel (Functional Tester), Circuit (Automation Tester)
  - [x] AC-0279: Each agent has a dedicated instruction file in docs/agents/ with mandatory startup steps, responsibilities, and tool instructions
  - [x] AC-0280: docs/AGENT_PLAN.md documents the full 6-phase pipeline (Blueprint → Architect → Build → Integration → Test → Polish) with phase entry/exit criteria, the PR review lifecycle, BLOCK recovery protocol, and execution mode options
```

```
TASK-0042 (US-0088): Create agents.config.json with 9 agent definitions and dashboard/orchestrator metadata
Type: Dev
Assignee: Agent
Status: Done
Branch: develop
Notes: Single JSON file; agents map, dashboard branding block, orchestrator.dmAgent/reviewer/avatarGrid; loaded by spawn.js, generate-dashboard.js, process-avatars.js, and init-sdlc-status.js
```

```
TASK-0043 (US-0088): Write 9 agent instruction files in docs/agents/ with roles, responsibilities, and prompt templates
Type: Dev
Assignee: Agent
Status: Done
Branch: develop
Notes: DM_AGENT.md, PO_AGENT.md, ARCHITECT_AGENT.md, CODE_REVIEWER_AGENT.md, UI_DESIGNER_AGENT.md, BE_DEV_AGENT.md, FE_DEV_AGENT.md, FUNCTIONAL_TESTER_AGENT.md, AUTOMATION_TESTER_AGENT.md
```

```
TASK-0044 (US-0088): Write docs/AGENT_PLAN.md — 6-phase pipeline, PR/review flow, BLOCK recovery, execution modes, concurrency safety rules, and config-driven setup guide
Type: Dev
Assignee: Agent
Status: Done
Branch: develop
Notes: Covers sequential, parallel, Agent-tool delegation, and spawn helper execution modes; references all concurrency utilities
```

```
US-0089 (EPIC-0013): As a pipeline engineer, I want a CLI spawn helper that generates correct launch commands for any supported AI coding platform, so that agents can be started consistently across environments without manual prompt assembly.
Priority: High
Estimate: M
Status: Done
Branch: develop
Dependencies: US-0088
Acceptance Criteria:
  - [x] AC-0281: orchestrator/spawn.js supports --list-platforms, --list-agents, --agent <name>, and --print-all flags
  - [x] AC-0282: Seven platform adapters exist for claude-code, codex-cli, gemini-cli, aider, codemie, elitea, and opencode
  - [x] AC-0283: spawn.js loads all agent definitions from agents.config.json — no hardcoded agent data in the script
  - [x] AC-0284: Running --print-all outputs a complete prompt block for every agent on the detected platform
  - [x] AC-0285: Running --agent <name> outputs a ready-to-paste launch command with the agent's instruction file path resolved
```

```
TASK-0045 (US-0089): Implement orchestrator/spawn.js with CLI flag parsing and dynamic agent/platform resolution from agents.config.json
Type: Dev
Assignee: Agent
Status: Done
Branch: develop
Notes: Reads agents.config.json; delegates to adapter modules; supports all 4 CLI flags; prints platform-specific spawn syntax
```

```
TASK-0046 (US-0089): Implement 7 platform adapter modules in orchestrator/adapters/ (claude-code.js, codex-cli.js, gemini-cli.js, aider.js, codemie.js, elitea.js, opencode.js)
Type: Dev
Assignee: Agent
Status: Done
Branch: develop
Notes: Each adapter exports formatSpawnCommand(agent, config); adapters differ in flag syntax and instruction file handling
```

```
US-0090 (EPIC-0013): As a pipeline engineer, I want atomic file utilities for shared state during parallel agent execution, so that simultaneous agents cannot corrupt shared pipeline files.
Priority: High
Estimate: M
Status: Done
Branch: develop
Dependencies: US-0088
Acceptance Criteria:
  - [x] AC-0286: orchestrator/file-lock.js provides withLock() and withLockSync() using mkdir-based locking with configurable stale timeout
  - [x] AC-0287: orchestrator/atomic-write.js provides atomicReadModifyWriteJson() for safe concurrent JSON mutation, atomicAppend() for locked log appends, and reserveId() for race-free ID allocation
  - [x] AC-0288: orchestrator/git-safe.js provides safePush() with exponential backoff (4 retries) and checkOverlap() to detect conflicting file edits across parallel branches before merging
  - [x] AC-0289: All shared pipeline files (sdlc-status.json, progress.md, BUGS.md, ID_REGISTRY.md, AI_COST_LOG.md) are protected by these utilities in agent instruction files
```

```
TASK-0047 (US-0090): Implement orchestrator/file-lock.js — mkdir-based mutual exclusion with stale lock detection and configurable retry backoff
Type: Dev
Assignee: Agent
Status: Done
Branch: develop
Notes: Uses fs.mkdirSync as atomic lock primitive; stale detection via mtime; exposes withLock(path, fn) and withLockSync(path, fn)
```

```
TASK-0048 (US-0090): Implement orchestrator/atomic-write.js — atomicReadModifyWriteJson, atomicAppend, reserveId backed by file-lock.js
Type: Dev
Assignee: Agent
Status: Done
Branch: develop
Notes: atomicReadModifyWriteJson parses, calls transform fn, writes back atomically; reserveId reads ID_REGISTRY, increments, writes back; atomicAppend acquires lock before fs.appendFileSync
```

```
TASK-0049 (US-0090): Implement orchestrator/git-safe.js — safePush with retry/backoff and checkOverlap for parallel branch conflict detection
Type: Dev
Assignee: Agent
Status: Done
Branch: develop
Notes: safePush wraps git push; retries on exit code 1 with pull-rebase; checkOverlap diffs two branches and reports overlapping file paths
```

```
US-0091 (EPIC-0013): As a pipeline engineer, I want a self-contained HTML dashboard that visualises real-time phase progress, agent statuses, and delivery metrics, so that I can monitor the agentic build at a glance without reading JSON.
Priority: High
Estimate: L
Status: Done
Branch: develop
Dependencies: US-0088, US-0092
Acceptance Criteria:
  - [x] AC-0290: tools/generate-dashboard.js reads sdlc-status.json and agents.config.json and emits a self-contained docs/dashboard.html with no external dependencies
  - [x] AC-0291: Dashboard displays the 6-phase pipeline as a visual flow with per-phase completion status (planned/in-progress/done/blocked)
  - [x] AC-0292: Dashboard shows a status card per agent with icon, role, current status (idle/active/done/blocked), and active task label; icons and colours are driven by agents.config.json
  - [x] AC-0293: Dashboard shows a metrics panel: stories done/total, tasks done/total, tests passed, code coverage percentage, and open bug count
  - [x] AC-0294: Dashboard auto-refreshes every 30 seconds via JS interval; skips reload when a modal is open
  - [x] AC-0295: Dashboard plays distinct audio tones and surfaces browser notifications when a phase completes, an agent transitions to blocked, or a new critical bug is opened; alert toggle persists via localStorage
  - [x] AC-0296: All dashboard branding (title, subtitle, footer, primary colour, author, repo URL) is driven by the dashboard section of agents.config.json — no hardcoded project values in the generator
  - [x] AC-0297: npm run dashboard runs a one-shot generation; npm run dashboard:watch re-generates on every sdlc-status.json change
```

```
TASK-0050 (US-0091): Implement tools/generate-dashboard.js — reads sdlc-status.json + agents.config.json, renders phase pipeline, agent cards, metrics panel, and alert triggers into a single self-contained HTML file
Type: Dev
Assignee: Agent
Status: Done
Branch: develop
Notes: Generator; getDashboardMeta() reads branding from config; 30s JS-based reload (skips when modal open); all CSS/JS inlined; audio context for tone alerts
```

```
TASK-0051 (US-0091): Add config-driven branding layer to generate-dashboard.js — title, subtitle, footer, primaryColor, author, authorTitle, repoUrl all sourced from agents.config.json dashboard block
Type: Dev
Assignee: Agent
Status: Done
Branch: develop
Notes: getDashboardMeta() falls back to package.json name only when config is absent
```

```
TASK-0052 (US-0091): Add audio alert and browser notification system to generated dashboard — distinct tones for phase-complete, agent-blocked, and bug-opened events
Type: Dev
Assignee: Agent
Status: Done
Branch: develop
Notes: Web Audio API oscillator tones; Notification API with on/off toggle persisted in localStorage; event detection compares previous vs current sdlc-status.json on each poll cycle; tested via docs/alert-test.html
```

```
US-0092 (EPIC-0013): As a pipeline engineer, I want a typed sdlc-status.json schema and an initialiser script, so that any new project can bootstrap a clean dashboard state from agents.config.json in a single command.
Priority: Medium
Estimate: S
Status: Done
Branch: develop
Dependencies: US-0088
Acceptance Criteria:
  - [x] AC-0298: docs/sdlc-status.json schema captures currentPhase, phases array (each with id, name, status, stories), agents map (each with status, currentTask), and metrics (storiesDone, tasksTotal, testsPassed, coveragePercent, bugsOpen)
  - [x] AC-0299: tools/init-sdlc-status.js generates a valid sdlc-status.json from agents.config.json with all agents initialised to idle and all phases to planned
  - [x] AC-0300: npm run init:status runs the initialiser; subsequent npm run dashboard immediately renders a blank but valid dashboard
```

```
TASK-0053 (US-0092): Implement tools/init-sdlc-status.js — generates docs/sdlc-status.json from agents.config.json, producing all phases planned and all agents idle
Type: Dev
Assignee: Agent
Status: Done
Branch: develop
Notes: Reads agents.config.json; writes sdlc-status.json; idempotent — safe to re-run; does not overwrite if --no-overwrite flag is passed
```

```
US-0093 (EPIC-0013): As a pipeline engineer, I want a plan visualizer that renders epic and story progress from RELEASE_PLAN.md as a navigable HTML page, so that stakeholders can track delivery status without reading raw markdown.
Priority: Medium
Estimate: M
Status: Done
Branch: develop
Dependencies: None
Acceptance Criteria:
  - [x] AC-0301: tools/generate-plan.js parses RELEASE_PLAN.md and emits a self-contained docs/plan-status.html
  - [x] AC-0302: Plan visualizer shows all epics with story and task counts, grouped by Done / In Progress / To Do
  - [x] AC-0303: Each story row shows its ID, title, status badge, estimate, and linked acceptance criteria completion ratio
  - [x] AC-0304: npm run plan:generate runs a one-shot generation; npm run plan:watch re-generates on RELEASE_PLAN.md changes
  - [x] AC-0305: plan-status.html is fully self-contained — no external CSS, JS, or font dependencies
```

```
TASK-0054 (US-0093): Implement tools/generate-plan.js — parses RELEASE_PLAN.md fenced blocks, extracts epics/stories/tasks/ACs, and renders docs/plan-status.html with status grouping and progress bars
Type: Dev
Assignee: Agent
Status: Done
Branch: develop
Notes: tools/lib/parse-release-plan.js handles markdown parsing; requires (EPIC-XXXX) in US headers to associate stories; stories without an epic tag are excluded from grouping
```

---

## Epic — EPIC-0014: Follow-Up Changes

```
EPIC-0014: Follow-Up Changes
Description: Planned and in-progress work that was added after its original epic was marked Done. Collects follow-up stories to preserve the integrity of completed epics.
Release Target: Backlog
Status: Planned
Dependencies: None
```

---

## User Stories — EPIC-0014: Follow-Up Changes

```
US-0083 (EPIC-0014): As a developer, I want all GitHub Actions steps to use Node.js 24-compatible action versions, so that no deprecation warnings appear in CI runs after June 2, 2026.
Priority: Medium (P1)
Estimate: S
Status: Planned
Branch: feature/US-0083-actions-node24-upgrade
Acceptance Criteria:
  - [ ] AC-0262: actions/checkout updated to v5 (or later) in plan-visualizer.yml
  - [ ] AC-0263: actions/setup-node updated to v5 (or later) in plan-visualizer.yml
Dependencies: None
```

```
US-0053 (EPIC-0014): As a developer, I want the render-html.js module to be split into smaller focused files, so that the codebase is easier to maintain and debug.
Priority: Low (P3)
Estimate: M
Status: Planned
Branch:
Acceptance Criteria:
  - [ ] AC-0150: render-html.js is refactored into separate modules (e.g., render-header.js, render-tabs.js, render-charts.js, render-scripts.js)
  - [ ] AC-0151: Each module exports a single render function that follows the existing contract
  - [ ] AC-0152: All existing tests pass after refactoring
  - [ ] AC-0153: The generate-plan.js orchestrator imports from the new module files
Dependencies: None
```

```
US-0108 (EPIC-0014): As a Conductor agent, I want a CLI tool to update docs/sdlc-status.json at each pipeline phase transition, so that the agentic dashboard stays live without manual JSON editing and without each sub-agent needing to understand the file schema.
Priority: High (P0)
Estimate: S
Status: Done
Branch: feature/US-0108-sdlc-status-updater
Acceptance Criteria:
  - [x] AC-0334: `tools/update-sdlc-status.js` exposes 10 commands (agent-start, agent-done, review, test-pass, test-fail, coverage, story-start, story-complete, phase, log) with --flag parsing
  - [x] AC-0335: Uses `atomicReadModifyWriteJson` from orchestrator/atomic-write for safe concurrent updates
  - [x] AC-0336: Canonical phase definitions (name, agents, deliverables) auto-seeded when phase handler auto-expands the phases array
  - [x] AC-0337: Log array is trimmed to last 200 entries to prevent unbounded growth
  - [x] AC-0338: DM_AGENT.md updated with the command table replacing the manual JSON-edit instructions
  - [x] AC-0339: Unit tests cover all 10 command handlers (17 tests in tests/unit/update-sdlc-status.test.js)
Dependencies: EPIC-0013
```

```
EPIC-0015: UI Review and Redesign
Description: Editorial Operations Dashboard aesthetic pass. Promotes PlanVisualizer from "generic utility dashboard" to a refined, information-dense interface with display typography, semantic badge tokens, shadow-based cards, zebra-striped tables, and per-tab polish across Hierarchy, Kanban, Traceability, Status, Trends, Costs, Bugs, and Lessons.
Release Target: Release 1.9
Status: In Progress
Dependencies: EPIC-0007
```

---

## User Stories — EPIC-0015: UI Review and Redesign

```
US-0094 (EPIC-0015): As a user, I want distinctive display typography for section headers and KPIs, so that the dashboard has a clear editorial voice and tabular numeric data aligns cleanly.
Priority: Medium (P1)
Estimate: S
Status: Done
Branch: feature/US-0094-typography-upgrade
Acceptance Criteria:
  - [x] AC-0306: A display face (Instrument Serif / Fraunces / Geist) is loaded via Google Fonts with font-display:swap
  - [x] AC-0307: Tab supertitles and topbar H1 use the new display face
  - [x] AC-0308: All numeric/monetary cells use font-variant-numeric:tabular-nums
  - [x] AC-0309: A .display-title utility class exists and is consistently applied
Dependencies: None
```

```
US-0095 (EPIC-0015): As a user, I want cards to use layered shadows instead of hard 1px borders, so that the interface feels refined and depth-aware.
Priority: Medium (P1)
Estimate: S
Status: Done
Branch: feature/US-0095-shadow-cards
Acceptance Criteria:
  - [x] AC-0310: A --shadow-card token exists with light and dark mode variants
  - [x] AC-0311: All chart/story/bug/lesson card containers use box-shadow instead of 1px borders
  - [x] AC-0312: BUG-0111 (mixed bg-white/slate-800 tokens) is resolved
Dependencies: None
```

```
US-0096 (EPIC-0015): As a user, I want zebra striping and hover highlighting on all tables, so that rows are easier to scan and track.
Priority: Medium (P1)
Estimate: S
Status: Done
Branch: feature/US-0096-zebra-tables
Acceptance Criteria:
  - [x] AC-0313: A --clr-row-alt token with light/dark variants exists
  - [x] AC-0314: All .scroll-table tbody rows alternate background colour
  - [x] AC-0315: A --clr-row-hover token drives hover-row highlighting in all tables
Dependencies: None
```

```
US-0097 (EPIC-0015): As a user, I want status/severity/priority badges to adapt to light and dark modes, so that they render correctly regardless of theme.
Priority: High (P0)
Estimate: S
Status: Done
Branch: feature/US-0097-semantic-badges
Acceptance Criteria:
  - [x] AC-0316: The badge() function uses five semantic CSS variable triples (success/warn/danger/info/neutral)
  - [x] AC-0317: A .badge-dot variant is available for dense contexts
  - [x] AC-0318: BUG-0110 (dark-mode-only badges) is resolved
Dependencies: None
```

```
US-0098 (EPIC-0015): As a user, I want tab content to animate in with a staggered reveal, so that the interface feels alive without feeling busy.
Priority: Medium (P2)
Estimate: XS
Status: Planned
Branch: feature/US-0098-staggered-reveals
Acceptance Criteria:
  - [ ] AC-0319: Epic blocks, table rows, and chart cards animate with a fadeInUp of 240ms
  - [ ] AC-0320: Stagger delay uses --i custom property (20ms per item, first 20 items)
  - [ ] AC-0321: Animation is CSS-only (no JS library dependency)
Dependencies: None
```

```
US-0099 (EPIC-0015): As a user, I want KPI numbers to be visually prominent, so that my eye lands on the most important metrics first.
Priority: Medium (P1)
Estimate: S
Status: Done
Branch: feature/US-0099-hero-numbers
Acceptance Criteria:
  - [x] AC-0322: A .hero-num class applies display-font sizing with clamp() and tabular figures
  - [x] AC-0323: Budget totals, coverage %, and bug count tiles adopt .hero-num
  - [x] AC-0324: No more than 3 hero numbers appear per tab
Dependencies: US-0094
```

```
US-0100 (EPIC-0015): As a user, I want the Hierarchy tab to have stronger epic identity and AC visual structure, so that I can scan a 90+ story backlog quickly.
Priority: Medium (P1)
Estimate: S
Status: Planned
Branch: feature/US-0100-hierarchy-polish
Acceptance Criteria:
  - [ ] AC-0325: Epic headers render the ID in display face as "EPIC / XXXX" tracked-out in accent colour
  - [ ] AC-0326: Each epic header has a 2px progress rule filled to done/total ratio
  - [ ] AC-0327: AC lists have a left vertical guide line creating a tree-structure visual
  - [ ] AC-0328: Card-view story cards show a small accent dot mapping back to their epic
Dependencies: US-0094
```

```
US-0101 (EPIC-0015): As a user, I want the Kanban board to differentiate columns and priority visually, so that WIP and high-priority work stand out at a glance.
Priority: Medium (P1)
Estimate: S
Status: Planned
Branch: feature/US-0101-kanban-polish
Acceptance Criteria:
  - [ ] AC-0329: Column headers use a subtle gradient and 2px bottom accent rule
  - [ ] AC-0330: Cards have a left priority stripe (P0=danger, P1=warn, else transparent)
  - [ ] AC-0331: The In-Progress column has a subtle CSS pulse animation
  - [ ] AC-0332: WIP count renders as a coloured pill (red if >configured threshold)
  - [ ] AC-0333: BUG-0112 (invisible hover in light mode) is resolved
Dependencies: US-0097
```

```
US-0102 (EPIC-0015): As a user, I want the Traceability matrix to be scannable at a glance, so that I can spot coverage gaps without translating P/F/N letters.
Priority: High (P0)
Estimate: M
Status: Planned
Branch: feature/US-0102-traceability-redesign
Acceptance Criteria:
  - [ ] AC-0334: Pass/Fail/Not Run are rendered as filled colour dots (8px) instead of letters
  - [ ] AC-0335: Cross-hair hover highlights the full row and TC column header on cell hover
  - [ ] AC-0336: Legend moves inline with the table caption and shows live counts
  - [ ] AC-0337: First column (story ID + title) is sticky during horizontal scroll
Dependencies: US-0097
```

```
US-0103 (EPIC-0015): As a user, I want the Status tab charts to read like an editorial report, so that it's clear what each chart means at a glance.
Priority: Medium (P1)
Estimate: S
Status: Planned
Branch: feature/US-0103-status-editorial
Acceptance Criteria:
  - [ ] AC-0338: Chart boxes are replaced with hairline top rule + display-face title + subtitle
  - [ ] AC-0339: Charts are grouped under "Delivery" and "Financial" supertitles
  - [ ] AC-0340: All doughnut charts have a centered hero number
  - [ ] AC-0341: Chart.js legends use Inter font family with point-style circular dots
Dependencies: US-0094, US-0095, US-0099
```

```
US-0104 (EPIC-0015): As a user, I want to filter Trends by time range and see charts grouped by theme, so that I can focus on the analysis question at hand.
Priority: Medium (P1)
Estimate: M
Status: Planned
Branch: feature/US-0104-trends-polish
Acceptance Criteria:
  - [ ] AC-0342: A time-range toggle (7d / 30d / 90d / All) filters all Trends charts client-side
  - [ ] AC-0343: Charts are grouped under "Progress", "Cost & Spend", "Quality" supertitles
  - [ ] AC-0344: Line charts use stroke-gradient fills via Chart.js createLinearGradient
  - [ ] AC-0345: Empty state shows an animated SVG placeholder instead of text-only copy
Dependencies: US-0095
```

```
US-0105 (EPIC-0015): As a user, I want the Costs tab to show cost trends inline and highlight big numbers, so that budget analysis is fast.
Priority: Medium (P1)
Estimate: M
Status: Planned
Branch: feature/US-0105-costs-polish
Acceptance Criteria:
  - [ ] AC-0346: Budget totals use .hero-num with delta arrows
  - [ ] AC-0347: Each story/epic row shows a 24x12 SVG sparkline of cumulative cost
  - [ ] AC-0348: Cost columns use lighter-weight $ sign and tabular figures
  - [ ] AC-0349: Progress bars use a reusable .progress-bar component with three threshold classes
  - [ ] AC-0350: Token column is split into IN/OUT with labels, or hidden by default
Dependencies: US-0094, US-0099
```

```
US-0106 (EPIC-0015): As a user, I want severity and status to be visually distinct on bug cards, so that I can triage by severity at a glance.
Priority: Medium (P1)
Estimate: S
Status: Planned
Branch: feature/US-0106-bugs-severity
Acceptance Criteria:
  - [ ] AC-0351: Severity badges use a different shape/style from status badges
  - [ ] AC-0352: Bug cards have a 4px severity stripe down the full left edge
  - [ ] AC-0353: Fix Branch field has a title attribute and copy-on-hover micro-icon
  - [ ] AC-0354: Lesson link renders as a full pill (e.g., L-0003 ↗) not a bare arrow
  - [ ] AC-0355: A compact timeline view is available as a third view mode
Dependencies: US-0097
```

```
US-0107 (EPIC-0015): As a user, I want Lesson cards to visually link back to their source epic and category, so that patterns are easier to discover.
Priority: Low (P2)
Estimate: XS
Status: Planned
Branch: feature/US-0107-lessons-polish
Acceptance Criteria:
  - [ ] AC-0356: Lesson cards have a left accent bar using the epic accent colour cycle
  - [ ] AC-0357: A category icon (security/performance/testing) is derived from keyword match in the rule text
  - [ ] AC-0358: Related bugs expand inline with severity dots
Dependencies: US-0097
```

---

## Epic — EPIC-0017: Agentic Dashboard Effectiveness Review

```
EPIC-0017: Agentic Dashboard Effectiveness Review
Description: Discovery / retrospective epic. Review the Agentic SDLC Dashboard (originally built for a hackathon demo, now extracted as a reusable component) and define what it takes to make it genuinely effective as a general-purpose agentic pipeline visualization. Output: a gap analysis and a set of implementation stories in a follow-on epic. Complements EPIC-0016 (Mission Control aesthetic redesign) by focusing on schema, data model, workflow coverage, and integration patterns — not just visual polish.
Release Target: Release 2.0
Status: Planned
Dependencies: EPIC-0013, EPIC-0016
```

---

## User Stories — EPIC-0017: Agentic Dashboard Effectiveness Review

_(No stories yet — this epic starts with a review/gap analysis session. Stories will be added after the review concludes.)_
