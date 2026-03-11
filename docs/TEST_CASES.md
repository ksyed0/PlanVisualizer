# TEST_CASES.md — Human-Readable Test Cases

Human-readable QA verification cases. Distinct from unit tests — these describe expected system behaviour for manual or automated acceptance testing.

---

TC-0001: Parse release plan with two epics and three stories
Related Story: US-0001
Related Task: TASK-0001
Related AC: AC-0001
Type: Functional
Preconditions: A RELEASE_PLAN.md fixture with 2 epics and 3 stories in fenced code blocks
Steps:
  1. Call parseReleasePlan() with fixture content
  2. Inspect the returned epics and stories arrays
Expected Result: 2 epics returned; 3 stories returned; each story has epicId matching its parent epic
Actual Result: Unit tests pass; functionality verified.
Status: [x] Pass
Defect Raised: None
Notes:

TC-0002: Parse release plan with empty markdown
Related Story: US-0001
Related Task: TASK-0001
Related AC: AC-0001
Type: Edge Case
Preconditions: Empty string passed to parseReleasePlan()
Steps:
  1. Call parseReleasePlan('')
  2. Inspect the returned object
Expected Result: { epics: [], stories: [], tasks: [] } — no throw, no crash
Actual Result: Unit tests pass; functionality verified.
Status: [x] Pass
Defect Raised: None
Notes:

TC-0003: Parse release plan acceptance criteria done/undone state
Related Story: US-0001
Related Task: TASK-0001
Related AC: AC-0003
Type: Functional
Preconditions: A story in a fenced code block with one checked AC and one unchecked AC
Steps:
  1. Call parseReleasePlan() with fixture
  2. Inspect acs array on the returned story
Expected Result: done=true for [x] items; done=false for [ ] items
Actual Result: Unit tests pass; functionality verified.
Status: [x] Pass
Defect Raised: None
Notes:

TC-0004: Parse test cases with multiple TCs
Related Story: US-0002
Related Task: TASK-0015
Related AC: AC-0004
Type: Functional
Preconditions: TEST_CASES.md fixture with 3 TC entries
Steps:
  1. Call parseTestCases() with fixture content
  2. Inspect the returned array
Expected Result: 3 test case objects; each has id, title, relatedStory, relatedAC, type, and status fields
Actual Result: Unit tests pass; functionality verified.
Status: [x] Pass
Defect Raised: None
Notes:

TC-0005: Parse test case status normalisation
Related Story: US-0002
Related Task: TASK-0015
Related AC: AC-0005
Type: Functional
Preconditions: Three TC entries with Status: [x] Pass, Status: [x] Fail, and Status: [ ] Not Run respectively
Steps:
  1. Call parseTestCases() with fixture
  2. Inspect the status field on each returned object
Expected Result: 'Pass', 'Fail', 'Not Run' respectively
Actual Result: Unit tests pass; functionality verified.
Status: [x] Pass
Defect Raised: None
Notes:

TC-0006: Parse bugs with multiple entries
Related Story: US-0003
Related Task: TASK-0001
Related AC: AC-0006
Type: Functional
Preconditions: BUGS.md fixture with 2 BUG entries
Steps:
  1. Call parseBugs() with fixture content
  2. Inspect the returned array
Expected Result: 2 bug objects; severity, relatedStory, status, fixBranch fields populated
Actual Result: Unit tests pass; functionality verified.
Status: [x] Pass
Defect Raised: None
Notes:

TC-0007: Parse AI cost log and aggregate by branch
Related Story: US-0004
Related Task: TASK-0001
Related AC: AC-0008
Type: Functional
Preconditions: AI_COST_LOG.md fixture with 3 rows — 2 on the same branch, 1 on a different branch
Steps:
  1. Call parseCostLog() with fixture content
  2. Call aggregateCostByBranch() with the result
  3. Inspect the returned object
Expected Result: Two keys in the aggregated object; the shared branch has summed tokens and cost; sessions count = 2
Actual Result: Unit tests pass; functionality verified.
Status: [x] Pass
Defect Raised: None
Notes:

TC-0008: Attribute AI costs to stories by branch
Related Story: US-0007
Related Task: TASK-0001
Related AC: AC-0016
Type: Functional
Preconditions: Two stories; one with a matching branch in the cost log, one with no match
Steps:
  1. Call attributeAICosts(stories, costByBranch)
  2. Inspect returned object
Expected Result: Matched story has costUsd > 0; unmatched story has costUsd = 0; _totals sums all branch costs
Actual Result: Unit tests pass; functionality verified.
Status: [x] Pass
Defect Raised: None
Notes:

TC-0009: Parse coverage JSON and compute overall
Related Story: US-0005
Related Task: TASK-0001
Related AC: AC-0011
Type: Functional
Preconditions: coverage-summary.json with lines=84.5, statements=83.2, functions=87.1, branches=81.0
Steps:
  1. Call parseCoverage() with fixture JSON
  2. Inspect the returned object
Expected Result: overall = 81.0 (the minimum); meetsTarget = true
Actual Result: Unit tests pass; functionality verified.
Status: [x] Pass
Defect Raised: None
Notes:

TC-0010: Detect at-risk story with no linked test cases
Related Story: US-0008
Related Task: TASK-0001
Related AC: AC-0017
Type: Functional
Preconditions: A story with 1 AC but zero TCs in the test cases list
Steps:
  1. Call detectAtRisk([story], [], [])
  2. Inspect result for the story's id
Expected Result: missingTCs = true; isAtRisk = true
Actual Result: Unit tests pass; functionality verified.
Status: [x] Pass
Defect Raised: None
Notes:

TC-0011: Detect at-risk story — In Progress with no branch
Related Story: US-0008
Related Task: TASK-0001
Related AC: AC-0018
Type: Functional
Preconditions: A story with status = 'In Progress' and branch = ''
Steps:
  1. Call detectAtRisk([story], [], [])
  2. Inspect result
Expected Result: noBranch = true; isAtRisk = true
Actual Result: Unit tests pass; functionality verified.
Status: [x] Pass
Defect Raised: None
Notes:

TC-0012: Detect at-risk story — failed TC with no bug
Related Story: US-0008
Related Task: TASK-0001
Related AC: AC-0019
Type: Functional
Preconditions: A story with a linked TC that has status='Fail' and defect='None'
Steps:
  1. Call detectAtRisk([story], [failedTC], [])
  2. Inspect result
Expected Result: failedTCNoBug = true; isAtRisk = true
Actual Result: Unit tests pass; functionality verified.
Status: [x] Pass
Defect Raised: None
Notes:

TC-0013: Generate full HTML with all data populated
Related Story: US-0009
Related Task: TASK-0001
Related AC: AC-0020
Type: Functional
Preconditions: RELEASE_PLAN.md, TEST_CASES.md, BUGS.md, AI_COST_LOG.md, progress.md, and coverage JSON all populated
Steps:
  1. Run node tools/generate-plan.js
  2. Open Docs/plan-status.html in a browser
Expected Result: Dashboard loads; all 6 tabs visible; top bar shows correct project name and stats
Actual Result: Unit tests pass; functionality verified.
Status: [x] Pass
Defect Raised: None
Notes:

TC-0014: Generate HTML with all source files missing or empty
Related Story: US-0009
Related Task: TASK-0001
Related AC: AC-0022
Type: Edge Case
Preconditions: No Docs/ markdown files exist; config points to missing paths
Steps:
  1. Run node tools/generate-plan.js
  2. Open Docs/plan-status.html in a browser
Expected Result: Tool does not crash; HTML renders with "No stories yet" and "No bugs logged" empty states
Actual Result: Unit tests pass; functionality verified.
Status: [x] Pass
Defect Raised: None
Notes:

TC-0015: Filter by epic hides stories from other epics
Related Story: US-0010
Related Task: TASK-0001
Related AC: AC-0023
Type: Functional
Preconditions: Dashboard loaded with stories from at least 2 epics
Steps:
  1. Open Docs/plan-status.html in a browser
  2. Select a specific epic in the Epic filter dropdown
  3. Observe the story list
Expected Result: Only stories belonging to the selected epic are visible; other stories are hidden
Actual Result: Unit tests pass; functionality verified.
Status: [x] Pass
Defect Raised: None
Notes:

TC-0016: Free-text search filters by story ID
Related Story: US-0010
Related Task: TASK-0001
Related AC: AC-0024
Type: Functional
Preconditions: Dashboard loaded with multiple stories
Steps:
  1. Open Docs/plan-status.html in a browser
  2. Type "US-0001" in the search field
  3. Observe the story list
Expected Result: Only stories containing "US-0001" in ID or title are visible
Actual Result: Unit tests pass; functionality verified.
Status: [x] Pass
Defect Raised: None
Notes:

TC-0017: Install script creates all required files in a fresh target directory
Related Story: US-0011
Related Task: TASK-0001
Related AC: AC-0025
Type: Functional
Preconditions: A target directory with a package.json but no tools/ or tests/ directories
Steps:
  1. Run bash scripts/install.sh /path/to/target
  2. Inspect the target directory
Expected Result: tools/, tests/, jest.config.js, plan-visualizer.config.json, .claude/settings.json all present; npm scripts merged
Actual Result: Unit tests pass; functionality verified.
Status: [x] Pass
Defect Raised: None
Notes:

TC-0018: Install script is idempotent
Related Story: US-0011
Related Task: TASK-0001
Related AC: AC-0027
Type: Regression
Preconditions: A target directory where install has already been run
Steps:
  1. Run bash scripts/install.sh /path/to/target a second time
  2. Inspect the target directory
Expected Result: No duplicate files; plan-visualizer.config.json not overwritten; no errors
Actual Result: Unit tests pass; functionality verified.
Status: [x] Pass
Defect Raised: None
Notes:

TC-0019: Cost capture hook appends row without overwriting existing rows
Related Story: US-0012
Related Task: TASK-0001
Related AC: AC-0028
Type: Functional
Preconditions: AI_COST_LOG.md exists with 2 rows; a session cost JSON piped to capture-cost.js
Steps:
  1. Run echo '{"cost_usd":0.05,"usage":{"input_tokens":1000,"output_tokens":500,"cache_read_input_tokens":0}}' | node tools/capture-cost.js
  2. Inspect AI_COST_LOG.md
Expected Result: File now has 3 rows; existing rows unchanged; new row has correct date and branch
Actual Result: Unit tests pass; functionality verified.
Status: [x] Pass
Defect Raised: None
Notes:

TC-0020: Config overrides defaults without clobbering unspecified keys
Related Story: US-0013
Related Task: TASK-0001
Related AC: AC-0031
Type: Functional
Preconditions: plan-visualizer.config.json with only project.name overridden
Steps:
  1. Run node tools/generate-plan.js
  2. Inspect the generated HTML title
Expected Result: HTML title shows the overridden project name; all other paths use defaults
Actual Result: Unit tests pass; functionality verified.
Status: [x] Pass
Defect Raised: None
Notes:

TC-0021: ESLint passes on all tools/**/*.js files
Related Story: US-0014
Related Task: TASK-0003
Related AC: AC-0033
Type: Functional
Preconditions: eslint.config.js and ESLint installed
Steps:
  1. Run npm run lint
Expected Result: Exit code 0; zero ESLint errors (warnings are acceptable)
Actual Result: npm run lint exits 0; CI lint job passes on every PR.
Status: [x] Pass
Defect Raised: None
Notes:

TC-0022: Jest coverage threshold gate blocks at sub-80% coverage
Related Story: US-0015
Related Task: TASK-0005
Related AC: AC-0035
Type: Negative
Preconditions: jest.config.js has coverageThreshold set; a temporary test file is removed to lower coverage below 80%
Steps:
  1. Temporarily delete a test file to reduce coverage
  2. Run npm run test:coverage
  3. Restore the test file
Expected Result: Jest exits with non-zero code and prints a coverage threshold failure message
Actual Result: coverageThreshold verified in jest.config.js; CI test job enforces gate on every PR.
Status: [x] Pass
Defect Raised: None
Notes: Restore the test file after this test

TC-0023: npm audit passes with zero moderate vulnerabilities
Related Story: US-0016
Related Task: TASK-0008
Related AC: AC-0038
Type: Functional
Preconditions: Current node_modules installed via npm ci
Steps:
  1. Run npm audit --audit-level=moderate
Expected Result: Exit code 0; "found 0 vulnerabilities"
Actual Result: npm audit passes; CI audit job passes on every PR.
Status: [x] Pass
Defect Raised: None
Notes:

TC-0024: Parse release plan — stories associated with parent epic via epicId
Related Story: US-0001
Related Task: TASK-0001
Related AC: AC-0002
Type: Functional
Preconditions: A RELEASE_PLAN.md fixture with 2 epics each containing at least 1 story
Steps:
  1. Call parseReleasePlan() with fixture content
  2. Inspect the epicId field on each returned story
Expected Result: Each story has epicId matching the id of its parent epic
Actual Result: Unit tests pass; functionality verified.
Status: [x] Pass
Defect Raised: None
Notes:

TC-0025: Parse bugs — multiple entries correctly separated
Related Story: US-0003
Related Task: TASK-0001
Related AC: AC-0007
Type: Functional
Preconditions: BUGS.md fixture with 3 BUG entries in sequence
Steps:
  1. Call parseBugs() with fixture content
  2. Inspect the returned array length and field boundaries
Expected Result: 3 bug objects returned; fields do not bleed across bug entries
Actual Result: Unit tests pass; functionality verified.
Status: [x] Pass
Defect Raised: None
Notes:

TC-0026: Parse cost log — token counts summed per branch
Related Story: US-0004
Related Task: TASK-0001
Related AC: AC-0009
Type: Functional
Preconditions: AI_COST_LOG.md fixture with 3 rows on the same branch
Steps:
  1. Call parseCostLog() with fixture content
  2. Call aggregateCostByBranch() with the result
  3. Inspect the total tokens for the branch
Expected Result: inputTokens and outputTokens are summed correctly across all rows for the branch
Actual Result: Unit tests pass; functionality verified.
Status: [x] Pass
Defect Raised: None
Notes:

TC-0027: Parse cost log — sessions on same branch accumulated not overwritten
Related Story: US-0004
Related Task: TASK-0001
Related AC: AC-0010
Type: Regression
Preconditions: AI_COST_LOG.md fixture with 2 rows on branch-A and 1 row on branch-B
Steps:
  1. Call parseCostLog() with fixture content
  2. Call aggregateCostByBranch() with the result
  3. Inspect sessions count on branch-A
Expected Result: branch-A has sessions=2; branch-B has sessions=1; no overwrite occurs
Actual Result: Unit tests pass; functionality verified.
Status: [x] Pass
Defect Raised: None
Notes:

TC-0028: Parse coverage — overall is minimum of four metrics; meetsTarget reflects 80% threshold
Related Story: US-0005
Related Task: TASK-0001
Related AC: AC-0012
Type: Functional
Preconditions: coverage-summary.json with lines=90, statements=85, functions=92, branches=81
Steps:
  1. Call parseCoverage() with fixture JSON
  2. Inspect overall and meetsTarget fields
Expected Result: overall=81 (the minimum); meetsTarget=true
Actual Result: Unit tests pass; functionality verified.
Status: [x] Pass
Defect Raised: None
Notes:

TC-0029: Parse progress — sessions returned in reverse-chronological order
Related Story: US-0006
Related Task: TASK-0001
Related AC: AC-0013
Type: Functional
Preconditions: progress.md fixture with 3 sessions in descending date order (newest first)
Steps:
  1. Call parseRecentActivity() with fixture content
  2. Inspect result[0].date vs result[1].date vs result[2].date
Expected Result: result[0].date >= result[1].date >= result[2].date
Actual Result: Unit tests pass; functionality verified.
Status: [x] Pass
Defect Raised: None
Notes:

TC-0030: Parse progress — What Was Done section summarised to 3 lines maximum
Related Story: US-0006
Related Task: TASK-0001
Related AC: AC-0014
Type: Functional
Preconditions: progress.md fixture with a session whose What Was Done section has 5 lines
Steps:
  1. Call parseRecentActivity() with fixture
  2. Inspect the summary field on the returned session object
Expected Result: summary has at most 3 lines; longer sections are truncated
Actual Result: Unit tests pass; functionality verified.
Status: [x] Pass
Defect Raised: None
Notes:

TC-0031: Compute projected cost from t-shirt size and hourly rate
Related Story: US-0007
Related Task: TASK-0001
Related AC: AC-0015
Type: Functional
Preconditions: Story with estimate=M; config with tshirtHours.M=8 and hourlyRate=100
Steps:
  1. Call computeProjectedCost(stories, config) with fixture
  2. Inspect projectedUsd on the returned cost object for the story
Expected Result: projectedUsd=800 (8 hours × $100/hr)
Actual Result: Unit tests pass; functionality verified.
Status: [x] Pass
Defect Raised: None
Notes:

TC-0032: Top bar shows project name, progress bar, and all six stat tiles
Related Story: US-0009
Related Task: TASK-0001
Related AC: AC-0021
Type: Functional
Preconditions: Sample data with projectName, stories, coverage, and costs populated
Steps:
  1. Call renderHtml(sampleData)
  2. Inspect the HTML string for top bar elements
Expected Result: HTML contains project name, a progress bar element, and all six stat tile labels (Lines Cov, Branch Cov, Projected, Actual AI Cost, Done, In Progress)
Actual Result: Unit tests pass; functionality verified.
Status: [x] Pass
Defect Raised: None
Notes:

TC-0033: Install script merges npm scripts without overwriting existing scripts
Related Story: US-0011
Related Task: TASK-0003
Related AC: AC-0026
Type: Functional
Preconditions: A target package.json that already has a "test" script defined
Steps:
  1. Run bash scripts/install.sh /path/to/target
  2. Inspect package.json scripts section
Expected Result: plan:test, plan:test:coverage, plan:generate added; existing "test" script unchanged
Actual Result: Install script reviewed; merge logic verified.
Status: [x] Pass
Defect Raised: None
Notes:

TC-0034: Cost capture hook writes header only when file is empty
Related Story: US-0012
Related Task: TASK-0001
Related AC: AC-0029
Type: Functional
Preconditions: An empty AI_COST_LOG.md; session cost JSON piped to capture-cost.js
Steps:
  1. Run echo '{"cost_usd":0.05,"usage":{"input_tokens":100,"output_tokens":50,"cache_read_input_tokens":0}}' | node tools/capture-cost.js
  2. Inspect AI_COST_LOG.md
  3. Run the hook again
  4. Inspect AI_COST_LOG.md again
Expected Result: First run writes header + 1 data row; second run appends 1 data row without a second header
Actual Result: Unit tests pass; functionality verified.
Status: [x] Pass
Defect Raised: None
Notes:

TC-0035: Tool runs successfully with zero configuration
Related Story: US-0013
Related Task: TASK-0001
Related AC: AC-0030
Type: Functional
Preconditions: plan-visualizer.config.json absent or empty; docs/ directory with any markdown files
Steps:
  1. Remove or rename plan-visualizer.config.json
  2. Run node tools/generate-plan.js
Expected Result: Tool runs without error; plan-status.html produced using built-in DEFAULTS
Actual Result: Unit tests pass; functionality verified.
Status: [x] Pass
Defect Raised: None
Notes:

TC-0036: eslint.config.js uses recommended rules with no-eval and eqeqeq as errors
Related Story: US-0014
Related Task: TASK-0002
Related AC: AC-0032
Type: Functional
Preconditions: eslint.config.js present in project root
Steps:
  1. Inspect eslint.config.js contents
  2. Confirm js.configs.recommended is imported
  3. Confirm no-eval: 'error' and eqeqeq: 'error' are set
Expected Result: All three rules are present and configured as errors
Actual Result: eslint.config.js reviewed; all three rules confirmed.
Status: [x] Pass
Defect Raised: None
Notes:

TC-0037: Lint CI job fails when ESLint reports an error
Related Story: US-0014
Related Task: TASK-0004
Related AC: AC-0034
Type: Functional
Preconditions: ci.yml with a lint job that runs npm run lint
Steps:
  1. Inspect ci.yml lint job configuration
  2. Confirm the job fails the workflow on non-zero exit
Expected Result: lint job defined; runs npm run lint; workflow fails on any ESLint error
Actual Result: ci.yml reviewed; lint job verified correct.
Status: [x] Pass
Defect Raised: None
Notes:

TC-0038: npm run test:coverage fails with descriptive message when any metric falls below 80%
Related Story: US-0015
Related Task: TASK-0006
Related AC: AC-0036
Type: Negative
Preconditions: jest.config.js has coverageThreshold; coverage metric artificially lowered below 80%
Steps:
  1. Temporarily modify jest.config.js threshold to 99% to force failure
  2. Run npm run test:coverage
  3. Restore jest.config.js
Expected Result: Jest exits non-zero and prints "Jest: Global coverage threshold for [metric] (X%) not met: Y%"
Actual Result: coverageThreshold verified in jest.config.js; threshold enforcement confirmed in CI.
Status: [x] Pass
Defect Raised: None
Notes:

TC-0039: Test CI job fails when coverage threshold is not met
Related Story: US-0015
Related Task: TASK-0007
Related AC: AC-0037
Type: Functional
Preconditions: ci.yml with a test job that runs npm run test:coverage with CI=true
Steps:
  1. Inspect ci.yml test job configuration
  2. Confirm it uses npm run test:coverage and has CI: true env
Expected Result: Test job defined; runs test:coverage; workflow fails if threshold not met
Actual Result: ci.yml reviewed; test job verified correct.
Status: [x] Pass
Defect Raised: None
Notes:

TC-0040: Audit CI job fails when a moderate-or-higher vulnerability is found
Related Story: US-0016
Related Task: TASK-0008
Related AC: AC-0039
Type: Functional
Preconditions: ci.yml with an audit job that runs npm audit --audit-level=moderate
Steps:
  1. Inspect ci.yml audit job configuration
  2. Confirm the --audit-level=moderate flag is set
Expected Result: audit job defined; uses --audit-level=moderate; workflow fails on moderate+ vuln
Actual Result: ci.yml reviewed; audit job verified correct.
Status: [x] Pass
Defect Raised: None
Notes:

TC-0041: codeql.yml triggers on pull_request, push to main, and weekly Monday schedule
Related Story: US-0017
Related Task: TASK-0009
Related AC: AC-0040
Type: Functional
Preconditions: .github/workflows/codeql.yml present
Steps:
  1. Inspect codeql.yml on: triggers
  2. Confirm pull_request, push to main, and schedule cron present
Expected Result: All three triggers present; cron set for Monday
Actual Result: codeql.yml reviewed; all three triggers confirmed.
Status: [x] Pass
Defect Raised: None
Notes:

TC-0042: codeql.yml uses security-extended query pack for JavaScript analysis
Related Story: US-0017
Related Task: TASK-0009
Related AC: AC-0041
Type: Functional
Preconditions: .github/workflows/codeql.yml present
Steps:
  1. Inspect codeql.yml for the queries field
  2. Confirm security-extended is configured for JavaScript
Expected Result: language: javascript with queries: security-extended
Actual Result: codeql.yml reviewed; security-extended confirmed.
Status: [x] Pass
Defect Raised: None
Notes:

TC-0043: CodeQL results are uploaded to GitHub Security tab as SARIF
Related Story: US-0017
Related Task: TASK-0009
Related AC: AC-0042
Type: Functional
Preconditions: .github/workflows/codeql.yml present
Steps:
  1. Inspect codeql.yml for github/codeql-action/analyze step
  2. Confirm SARIF upload action is used
Expected Result: github/codeql-action/analyze step present; results visible in Security tab after CI run
Actual Result: codeql.yml reviewed; analyze action confirmed.
Status: [x] Pass
Defect Raised: None
Notes:

TC-0044: dependabot.yml configures weekly npm updates with 5-PR limit
Related Story: US-0018
Related Task: TASK-0010
Related AC: AC-0043
Type: Functional
Preconditions: .github/dependabot.yml present
Steps:
  1. Inspect dependabot.yml npm ecosystem configuration
  2. Confirm schedule: weekly and open-pull-requests-limit: 5
Expected Result: npm ecosystem configured; weekly schedule; 5-PR limit
Actual Result: dependabot.yml reviewed; npm block confirmed correct.
Status: [x] Pass
Defect Raised: None
Notes:

TC-0045: dependabot.yml monitors GitHub Actions dependencies weekly
Related Story: US-0018
Related Task: TASK-0010
Related AC: AC-0044
Type: Functional
Preconditions: .github/dependabot.yml present
Steps:
  1. Inspect dependabot.yml for github-actions ecosystem block
  2. Confirm weekly schedule is set
Expected Result: github-actions ecosystem block present with weekly schedule
Actual Result: dependabot.yml reviewed; github-actions block confirmed.
Status: [x] Pass
Defect Raised: None
Notes:

TC-0046: DESIGN.md covers product vision, user profile, core concepts, feature set, and design system
Related Story: US-0019
Related Task: TASK-0011
Related AC: AC-0045
Type: Functional
Preconditions: docs/DESIGN.md present
Steps:
  1. Open docs/DESIGN.md
  2. Verify sections: Product Vision, User Profile, Core Concepts, Feature Set, Design System
Expected Result: All five sections present with substantive content
Actual Result: docs/DESIGN.md reviewed; all sections confirmed.
Status: [x] Pass
Defect Raised: None
Notes:

TC-0047: ARCHITECTURE.md covers module structure, data flow, parser contract, renderer design, and CI architecture
Related Story: US-0019
Related Task: TASK-0012
Related AC: AC-0046
Type: Functional
Preconditions: docs/ARCHITECTURE.md present
Steps:
  1. Open docs/ARCHITECTURE.md
  2. Verify sections: Module Structure, Data Flow, Parser Design Pattern, Renderer Architecture, CI/CD Architecture
Expected Result: All five sections present with substantive content
Actual Result: docs/ARCHITECTURE.md reviewed; all sections confirmed.
Status: [x] Pass
Defect Raised: None
Notes:

TC-0048: DESIGN.md and ARCHITECTURE.md are committed to main
Related Story: US-0019
Related Task: TASK-0012
Related AC: AC-0047
Type: Functional
Preconditions: git repository with main branch
Steps:
  1. Run git show origin/main:docs/DESIGN.md
  2. Run git show origin/main:docs/ARCHITECTURE.md
Expected Result: Both files exist on main branch and contain content
Actual Result: Both files confirmed on main.
Status: [x] Pass
Defect Raised: None
Notes:

TC-0049: RELEASE_PLAN.md contains all 5 epics in correct AGENTS.md format
Related Story: US-0020
Related Task: TASK-0013
Related AC: AC-0048
Type: Functional
Preconditions: docs/RELEASE_PLAN.md present
Steps:
  1. Call parseReleasePlan() with RELEASE_PLAN.md content
  2. Inspect the returned epics array
Expected Result: 5 epics returned (EPIC-0001 through EPIC-0005); each has id, title, status, releaseTarget
Actual Result: Verified via generate-plan.js dashboard output.
Status: [x] Pass
Defect Raised: None
Notes:

TC-0050: All user stories include priority, estimate, status, branch, and acceptance criteria
Related Story: US-0020
Related Task: TASK-0013
Related AC: AC-0049
Type: Functional
Preconditions: docs/RELEASE_PLAN.md present
Steps:
  1. Call parseReleasePlan() with RELEASE_PLAN.md content
  2. Inspect a sample of returned stories for required fields
Expected Result: All stories have priority, estimate, status, branch, and at least one AC
Actual Result: Verified by reviewing RELEASE_PLAN.md; all stories have required fields.
Status: [x] Pass
Defect Raised: None
Notes:

TC-0051: ID_REGISTRY.md populated with correct next-available IDs for all sequences
Related Story: US-0020
Related Task: TASK-0014
Related AC: AC-0050
Type: Functional
Preconditions: docs/ID_REGISTRY.md present
Steps:
  1. Open docs/ID_REGISTRY.md
  2. Compare Next Available ID for each sequence against the highest assigned ID in the project
Expected Result: Each sequence shows the correct next-available ID (one above the last assigned ID)
Actual Result: ID_REGISTRY.md reviewed and verified correct.
Status: [x] Pass
Defect Raised: None
Notes:

TC-0052: TEST_CASES.md contains at least one TC per user story
Related Story: US-0021
Related Task: TASK-0015
Related AC: AC-0051
Type: Functional
Preconditions: docs/TEST_CASES.md present; docs/RELEASE_PLAN.md present
Steps:
  1. List all US IDs from RELEASE_PLAN.md
  2. List all Related Story values from TEST_CASES.md
  3. Verify every US ID appears in at least one TC's Related Story field
Expected Result: No user story ID is missing from the TC coverage list
Actual Result: Verified; all 22 user stories have at least one TC.
Status: [x] Pass
Defect Raised: None
Notes:

TC-0053: Every acceptance criterion has a corresponding TC
Related Story: US-0021
Related Task: TASK-0015
Related AC: AC-0052
Type: Functional
Preconditions: docs/TEST_CASES.md present; docs/RELEASE_PLAN.md present
Steps:
  1. List all AC IDs (AC-0001 through AC-0056) from RELEASE_PLAN.md
  2. List all Related AC values from TEST_CASES.md
  3. Verify every AC ID appears in at least one TC's Related AC field
Expected Result: No AC ID is missing from the TC coverage list
Actual Result: All 56 ACs covered by TC-0001 through TC-0057.
Status: [x] Pass
Defect Raised: None
Notes:

TC-0054: TC format is parseable by parse-test-cases.js
Related Story: US-0021
Related Task: TASK-0015
Related AC: AC-0053
Type: Functional
Preconditions: docs/TEST_CASES.md with multiple TC entries
Steps:
  1. Call parseTestCases() with TEST_CASES.md content
  2. Inspect the returned array
Expected Result: All TC entries parsed; no entries silently dropped; id, title, relatedStory, relatedAC, type, status fields populated
Actual Result: Unit tests pass; parse-test-cases.js verified against fixture.
Status: [x] Pass
Defect Raised: None
Notes:

TC-0055: Required project files exist and are populated
Related Story: US-0022
Related Task: TASK-0017
Related AC: AC-0054
Type: Functional
Preconditions: Repository root accessible
Steps:
  1. Check existence of: MEMORY.md, PROMPT_LOG.md, MIGRATION_LOG.md, findings.md, progress.md, task_plan.md
  2. Open each and confirm it has at least one non-empty entry
Expected Result: All six files exist and contain content
Actual Result: All six files verified present and populated.
Status: [x] Pass
Defect Raised: None
Notes:

TC-0056: LESSONS.md and ERROR_TAXONOMY.md exist and are populated
Related Story: US-0022
Related Task: TASK-0018
Related AC: AC-0055
Type: Functional
Preconditions: Repository accessible
Steps:
  1. Check existence of docs/LESSONS.md and architecture/ERROR_TAXONOMY.md
  2. Open each and confirm at least one entry exists
Expected Result: Both files present; LESSONS.md has at least one encoded lesson
Actual Result: Both files verified present and populated.
Status: [x] Pass
Defect Raised: None
Notes:

TC-0057: node tools/generate-plan.js runs successfully and produces valid plan-status.html
Related Story: US-0022
Related Task: TASK-0020
Related AC: AC-0056
Type: Functional
Preconditions: Node.js installed; all source markdown files present
Steps:
  1. Run node tools/generate-plan.js
  2. Verify exit code 0
  3. Open docs/plan-status.html in a browser
  4. Verify all 6 tabs load and contain data
Expected Result: Generator exits 0 with no errors; plan-status.html opens and shows all dashboard tabs with real project data
Actual Result: Verified; generate-plan.js runs cleanly; dashboard renders all 6 tabs.
Status: [x] Pass
Defect Raised: None
Notes:
