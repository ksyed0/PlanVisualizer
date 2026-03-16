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
Status: In Progress
Dependencies: EPIC-0002
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
  - [x] AC-0045: docs/DESIGN.md covers product vision, user profile, core concepts, feature set, and design system
  - [x] AC-0046: docs/ARCHITECTURE.md covers module structure, data flow, parser contract, renderer design, and CI architecture
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
TASK-0011 (US-0019): Write docs/DESIGN.md
Type: docs
Assignee: Agent
Status: Done
Branch: feature/US-0019-design-docs
Notes: Cover vision, user profile, core concepts, features, design system, data flow

TASK-0012 (US-0019): Write docs/ARCHITECTURE.md
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
  - [x] AC-0077: .github/workflows/version-bump.yml auto-bumps the patch version in package.json and package-lock.json when a PR is merged to develop, committing with [skip ci]
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
```

---

## Tasks — EPIC-0006: Dashboard UX & Quality Improvements

```
TASK-0026 (US-0028): Add About button, modal dialog, version/build metadata, and version-bump workflow
Type: Dev
Assignee: Agent
Status: Done
Branch: feature/US-0023-about-dialog
Notes: About button in renderTopBar() wraps h1 in flex row; modal HTML injected before </body> in renderHtml(); openAbout/closeAbout/Escape JS in renderScripts(); data.version from package.json, data.buildNumber from git rev-list --count HEAD, data.githubUrl from config; version-bump.yml triggers on PR merge to develop and bumps patch via npm version patch --no-git-tag-version

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
```
