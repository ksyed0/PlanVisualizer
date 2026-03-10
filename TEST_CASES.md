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
Actual Result:
Status: [ ] Not Run
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
Actual Result:
Status: [ ] Not Run
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
Actual Result:
Status: [ ] Not Run
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
Actual Result:
Status: [ ] Not Run
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
Actual Result:
Status: [ ] Not Run
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
Actual Result:
Status: [ ] Not Run
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
Actual Result:
Status: [ ] Not Run
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
Actual Result:
Status: [ ] Not Run
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
Actual Result:
Status: [ ] Not Run
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
Actual Result:
Status: [ ] Not Run
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
Actual Result:
Status: [ ] Not Run
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
Actual Result:
Status: [ ] Not Run
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
Actual Result:
Status: [ ] Not Run
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
Actual Result:
Status: [ ] Not Run
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
Actual Result:
Status: [ ] Not Run
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
Actual Result:
Status: [ ] Not Run
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
Actual Result:
Status: [ ] Not Run
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
Actual Result:
Status: [ ] Not Run
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
Actual Result:
Status: [ ] Not Run
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
Actual Result:
Status: [ ] Not Run
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
Actual Result:
Status: [ ] Not Run
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
Actual Result:
Status: [ ] Not Run
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
Actual Result:
Status: [ ] Not Run
Defect Raised: None
Notes:
