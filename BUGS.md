# Bugs — PlanVisualizer

<!-- Add bugs in BUG-XXXX format as they are discovered. -->

## P1 — Dashboard & Tooling Bugs

### BUG-0011: No cross-link between SDLC dashboard and Plan Visualizer

- **Severity:** Major
- **Status:** Fixed
- **Fix Branch:** est/BUG-0011
- **Found in:** `tools/generate-dashboard.js`, `docs/dashboard.html`
- **Description:** The SDLC dashboard and Plan Visualizer are separate HTML files with no navigation between them. Users must know both URLs.
- **Fix:** P1.6 — Add Plan Visualizer link in dashboard footer.

### BUG-0014: Dashboard is dark-mode only with low contrast text

- **Severity:** Major
- **Status:** Fixed
- **Fix Branch:** est/BUG-0014
- **Found in:** `tools/generate-dashboard.js`
- **Description:** Dashboard has no light mode toggle. Several text colors fail WCAG AA contrast: #666 on #1a1a2e = 2.8:1 ratio (requires 4.5:1). Card borders and metric dividers are nearly invisible.
- **Fix:** P1.9 — Add CSS variable theming, light/dark toggle with localStorage persistence, fix contrast ratios.

### BUG-0015: Dashboard references EliteA instead of Claude Code

- **Severity:** Major
- **Status:** Fixed
- **Fix Branch:** est/BUG-0015
- **Found in:** `tools/generate-dashboard.js` lines 174, 314; `docs/sdlc-status.json` line 3
- **Description:** Dashboard subtitle and footer reference "EPAM EliteA" but the hackathon uses Claude Code as the agentic platform. EliteA is for the full production implementation.
- **Fix:** P1.10 — Replace "EPAM EliteA" with "Claude Code" in dashboard generator and status JSON.

## P2 — Minor (Polish)

### BUG-0016: Unused `spin` CSS keyframe in dashboard

- **Severity:** Minor
- **Status:** Fixed
- **Fix Branch:** est/BUG-0016
- **Found in:** `tools/generate-dashboard.js` line 111
- **Description:** `@keyframes spin` is defined but never referenced by any CSS class. Dead code.
- **Fix:** P2.1 — Remove the unused keyframe.

### BUG-0017: No convenience `build` script in package.json

- **Severity:** Minor
- **Status:** Fixed
- **Fix Branch:** est/BUG-0017
- **Found in:** `package.json`
- **Description:** Must run `plan:generate` and `dashboard` separately. No single command to regenerate all outputs.
- **Fix:** P2.2 — Add `"build": "npm run plan:generate && npm run dashboard"`.

### BUG-0022: No hover states on dashboard interactive elements

- **Severity:** Minor
- **Status:** Fixed
- **Fix Branch:** est/BUG-0022
- **Found in:** `tools/generate-dashboard.js`
- **Description:** Agent cards and story rows have no hover feedback. Dashboard feels static when interacting.
- **Fix:** P1.9 — Add hover brightness filter to agent cards and story rows.

### BUG-0023: Dashboard has no responsive layout for phones/tablets

- **Severity:** Major
- **Status:** Fixed
- **Fix Branch:** est/BUG-0023
- **Found in:** `tools/generate-dashboard.js`
- **Description:** Dashboard uses fixed desktop grid layouts (3-column metrics, 2-column story grid, 6-phase horizontal pipeline). On phones and tablets in portrait or landscape, UI elements overflow, get cut off, or become unreadable. No media queries exist.
- **Fix:** Add responsive CSS media queries for tablet portrait (768-1024px), tablet landscape, phone landscape (up to 767px), phone portrait (up to 480px), and small phone (up to 375px). Pipeline stacks vertically on phones, grids collapse to fewer columns, deliverables/agent tasks hide on small screens.

### BUG-0024: Dashboard has no About section or attribution

- **Severity:** Minor
- **Status:** Fixed
- **Fix Branch:** est/BUG-0024
- **Found in:** `tools/generate-dashboard.js`
- **Description:** No way for viewers to learn what the dashboard is, who built it, or find the source repo. Missing attribution and context for hackathon demo audience.
- **Fix:** Add "About" button in header with modal popup: title "AI-SDLC Orchestrator Visualizer", author "by Kamal Syed", GitHub repo link, and close button. Modal has backdrop blur and closes on overlay click or close button.

## P0 — Critical (Orchestration Loop Failures)

### BUG-0031: Agentic orchestration is coupled to Claude Code platform

- **Severity:** Major
- **Status:** Fixed
- **Fix Branch:** est/BUG-0031
- **Found in:** `docs/agents/DM_AGENT.md`, `README.md`
- **Description:** Agent spawning instructions, CLI invocations, and parallel execution patterns are hardcoded to Claude Code. Cannot run the same orchestration on Codex, Gemini, or open-source models without rewriting DM_AGENT.md and README.md. The agent instruction files themselves are platform-agnostic markdown, but the invocation and spawning mechanism is not.
- **Fix:** Create `orchestrator/` adapter layer with platform-specific spawn implementations. Abstract DM_AGENT.md spawning to use platform-agnostic patterns. Update README.md with multi-platform quick-start instructions.

### BUG-0032: No CI checks on pull requests

- **Severity:** Major
- **Status:** Fixed
- **Fix Branch:** est/BUG-0032
- **Found in:** `.github/workflows/`
- **Description:** Only 1 GitHub Actions workflow exists (`plan-visualizer.yml`) which auto-generates dashboards. No CI checks run on pull requests — PRs can be merged with broken code, failing tests, or lint errors. Conductor has no awareness of CI status after pushing code.
- **Fix:** Add `.github/workflows/ci.yml` with 4 jobs (lint, test+coverage, build, orchestrator validation) on all PRs to main/develop. Add CI verification step to Conductor Phase 6. Expand ESLint targets to include orchestrator/ files.

### BUG-0033: ESLint not covering orchestrator/ or tests/ files

- **Severity:** Major
- **Status:** Fixed
- **Fix Branch:** est/BUG-0033
- **Found in:** `eslint.config.js`
- **Description:** ESLint only targeted `tools/**/*.js`. The `orchestrator/` adapter code and `tests/` unit tests were never linted. Test files failed lint with hundreds of `no-undef` errors for Jest globals (`describe`, `it`, `expect`). Orchestrator files had unused imports.
- **Fix:** Expand ESLint config to cover `orchestrator/**/*.js` and `tests/**/*.js`. Add Jest globals to test config block. Add Node.js timer globals (`setTimeout`, `clearTimeout`).

### BUG-0034: Unused imports in orchestrator/spawn.js

- **Severity:** Minor
- **Status:** Fixed
- **Fix Branch:** est/BUG-0034
- **Found in:** `orchestrator/spawn.js` lines 19-20
- **Description:** `path` and `fs` modules were imported but never used, causing ESLint `no-unused-vars` warnings.
- **Fix:** Remove unused `path` and `fs` require statements.

### BUG-0035: Useless assignment in generate-dashboard.js

- **Severity:** Minor
- **Status:** Fixed
- **Fix Branch:** est/BUG-0035
- **Found in:** `tools/generate-dashboard.js` line 454
- **Description:** `let spotlight = ''` was immediately overwritten in both branches of the following `if/else`, triggering ESLint `no-useless-assignment` error.
- **Fix:** Change to `let spotlight;` (uninitialized declaration).

### BUG-0036: Error cause not preserved in generate-plan.js

- **Severity:** Minor
- **Status:** Fixed
- **Fix Branch:** est/BUG-0036
- **Found in:** `tools/generate-plan.js` line 159
- **Description:** When rethrowing a caught error for failed `package.json` read, the original error cause was not attached. ESLint `preserve-caught-error` rule flagged this as losing the error chain.
- **Fix:** Add `{ cause: err }` to the rethrown `new Error(msg, { cause: err })`.

### BUG-0037: No code formatting standard enforced

- **Severity:** Minor
- **Status:** Fixed
- **Fix Branch:** est/BUG-0037
- **Found in:** Project-wide
- **Description:** No code formatter configured. Inconsistent formatting across JS files, markdown, and config files. No CI check to enforce formatting consistency.
- **Fix:** Added Prettier with `.prettierrc` config (semi, singleQuote, trailingComma all, printWidth 120), `.prettierignore`, `format` and `format:check` npm scripts, and CI job to enforce formatting on PRs.

### BUG-0038: Dashboard does not render BLOCKED phase status

- **Severity:** High
- **Status:** Fixed
- **Fix Branch:** est/BUG-0038
- **Found in:** `tools/generate-dashboard.js` lines 151, 375
- **Description:** Phase pipeline only renders `pending`, `in-progress`, and `complete` states. No CSS class, icon, or visual treatment for `blocked` status. A blocked phase looks identical to pending, so human operators miss escalation events.
- **Fix:** Added `.phase-block.blocked` CSS (red background, red pulsing animation), ⛔ icon mapping, and light/dark theme support.

### BUG-0039: Dashboard does not render BLOCKED agent status

- **Severity:** High
- **Status:** Fixed
- **Fix Branch:** est/BUG-0039
- **Found in:** `tools/generate-dashboard.js` lines 492-507
- **Description:** Agent card status color logic only handles `active` and `complete`. Blocked agents render with gray status (#888), indistinguishable from idle. No border highlight or animation for blocked agents.
- **Fix:** Added blocked handling to statusBg/statusColor logic, `.agent-card.blocked` CSS class with red border and pulse animation, and `cardClass` variable for dynamic class assignment.

### BUG-0040: No alert banner when orchestration is BLOCKED

- **Severity:** Critical
- **Status:** Fixed
- **Fix Branch:** est/BUG-0040
- **Found in:** `tools/generate-dashboard.js`
- **Description:** When Conductor sets a phase/agent to `blocked` in sdlc-status.json, the dashboard shows no prominent notification. Humans must scroll to the phase pipeline to notice the blocked state — easy to miss.
- **Fix:** Added top-of-page red alert banner that appears when any phase or agent is blocked. Includes dynamic summary of which phases/agents are blocked, a dismiss button, and pulsing animation.

### BUG-0041: No audio alert on BLOCK events

- **Severity:** High
- **Status:** Fixed
- **Fix Branch:** est/BUG-0041
- **Found in:** `tools/generate-dashboard.js`
- **Description:** When orchestration transitions to BLOCKED state, there is no audible notification. The dashboard auto-refreshes every 5 seconds but the human may not be watching the screen.
- **Fix:** Added Web Audio API three-tone ascending alert (440Hz, 554Hz, 659Hz square wave) that plays on BLOCK state transitions. Includes toggle switch in header to enable/disable, persisted to localStorage.

### BUG-0042: No browser notification on BLOCK events

- **Severity:** High
- **Status:** Fixed
- **Fix Branch:** est/BUG-0042
- **Found in:** `tools/generate-dashboard.js`
- **Description:** No browser push notification when orchestration becomes BLOCKED. If the user has the dashboard in a background tab, they receive no notification that human input is required.
- **Fix:** Added Notification API integration that sends a persistent browser notification on BLOCK transitions. Requests permission on toggle, persists preference to localStorage, uses `requireInteraction: true` so notification stays until acknowledged.

### BUG-0043: Prettier reformats test fixture breaking parse-bugs tests

- **Severity:** Medium
- **Status:** Fixed
- **Fix Branch:** est/BUG-0043
- **Found in:** `tests/fixtures/BUGS.md`
- **Description:** Prettier markdown formatting indented metadata fields (Status, Fix Branch, Estimated Cost USD) under a numbered list item. The `parseBugs` regex uses `^` anchors requiring column 0, causing 4 test failures in CI.
- **Fix:** Restructured fixture to keep numbered list items and metadata fields at separate paragraph levels so Prettier does not nest them.

### BUG-0044: Race condition on sdlc-status.json during parallel agent writes

- **Severity:** Critical
- **Status:** Fixed
- **Fix Branch:** est/BUG-0044
- **Found in:** `docs/sdlc-status.json`, `docs/agents/DM_AGENT.md`
- **Description:** When Forge and Pixel run in parallel (Phase 3), both agents update `sdlc-status.json` to report progress. Without locking, one agent's write can overwrite the other's, losing status updates. This is a classic lost-update race condition.
- **Fix:** Added `orchestrator/file-lock.js` (mkdir-based locking with stale detection) and `orchestrator/atomic-write.js` (atomic read-modify-write via temp+rename). All agents must use `atomicReadModifyWriteJson()` for sdlc-status.json updates.

### BUG-0045: Race condition on ID_REGISTRY.md causes duplicate IDs

- **Severity:** Critical
- **Status:** Fixed
- **Fix Branch:** est/BUG-0045
- **Found in:** `docs/ID_REGISTRY.md`
- **Description:** When parallel agents both need to allocate a new bug or task ID, they could read the same "next available" value from ID_REGISTRY.md simultaneously, producing duplicate IDs. This corrupts cross-references across BUGS.md, RELEASE_PLAN.md, and TEST_CASES.md.
- **Fix:** Added `reserveId(sequence)` in `orchestrator/atomic-write.js` that acquires a file lock, reads the registry, increments the sequence, and writes back atomically. Agents must use this instead of manual ID allocation.

### BUG-0046: Interleaved writes to progress.md and AI_COST_LOG.md

- **Severity:** High
- **Status:** Fixed
- **Fix Branch:** est/BUG-0046
- **Found in:** `progress.md`, `docs/AI_COST_LOG.md`
- **Description:** Append-only log files written by multiple parallel agents can produce interleaved or corrupted entries when two processes append simultaneously. Markdown structure breaks when partial lines from different agents mix.
- **Fix:** Added `atomicAppend()` in `orchestrator/atomic-write.js` that acquires a file lock before appending. All log-style file writes must use this function.

### BUG-0047: Git push failures during parallel agent branches

- **Severity:** High
- **Status:** Fixed
- **Fix Branch:** est/BUG-0047
- **Found in:** Orchestrator agent workflow
- **Description:** When parallel agents push to different branches simultaneously, network contention or remote rejections can cause silent push failures. Agents may believe code is pushed when it isn't, leading to lost work or stale PRs.
- **Fix:** Added `orchestrator/git-safe.js` with `safePush()` (exponential backoff retry, auto-pull on rejection), `detectConflicts()` (dry-run merge check), and `checkOverlap()` (overlapping file detection between branches).

### BUG-0048: No merge conflict detection before parallel branch merges

- **Severity:** High
- **Status:** Fixed
- **Fix Branch:** est/BUG-0048
- **Found in:** `docs/agents/DM_AGENT.md`
- **Description:** When Conductor merges parallel branches (e.g., Forge's backend + Pixel's frontend), there is no pre-merge conflict check. If both branches modify shared files (package.json, types, test fixtures), the merge fails mid-way and requires manual intervention.
- **Fix:** Added `checkOverlap()` and `detectConflicts()` to `orchestrator/git-safe.js`. Conductor must run overlap check before merging parallel branches. Sequential merge order: first-in merges clean, second rebases on top.

### BUG-0049: No pre-commit formatting enforcement

- **Severity:** Medium
- **Status:** Fixed
- **Fix Branch:** est/BUG-0049
- **Found in:** Project configuration
- **Description:** Prettier formatting was only enforced in CI. Developers and agents could commit unformatted code, causing CI failures on every PR. No local feedback loop before push.
- **Fix:** Added husky pre-commit hook with lint-staged. On commit, staged `.js`, `.json`, `.md`, `.yml`, `.yaml` files are auto-formatted with Prettier, and `.js` files are auto-fixed with ESLint.

### BUG-0050: Agent registry hardcoded across 3 files

- **Severity:** Major
- **Status:** Fixed
- **Fix Branch:** est/BUG-0050
- **Found in:** `orchestrator/spawn.js`, `tools/generate-dashboard.js`, `tools/process-avatars.js`
- **Description:** Agent names, roles, icons, and colors were hardcoded independently in 3 separate files (spawn.js had the agent registry, generate-dashboard.js had duplicate role/color/icon maps, process-avatars.js had a hardcoded AGENTS_ORDER array). Adding or renaming an agent required changes in 3+ files, making the framework non-portable and error-prone.
- **Fix:** Created `agents.config.json` as the single source of truth for all agent definitions. Updated spawn.js, generate-dashboard.js, and process-avatars.js to load from config. Added `tools/init-sdlc-status.js` to generate sdlc-status.json from config. Any project can now customize agents by editing one JSON file.

### BUG-0053: No project entry point for multi-platform agent discovery

- **Severity:** Major
- **Status:** Fixed
- **Fix Branch:** est/BUG-0053
- **Found in:** Project root
- **Description:** No single file existed for AI agents to discover project-specific context on startup. Each agent had project knowledge baked into its instruction file. Different AI platforms (Claude Code, Gemini, Codex, etc.) auto-read different convention files (CLAUDE.md, Gemini.md, etc.) but none existed.
- **Fix:** Created `project.md` as the single project entry point referencing all architecture docs, release plan, test cases, and tracking files. Created 7 platform symlinks in repo root (`CLAUDE.md`, `Gemini.md`, `Codex.md`, `EliteA.md`, `CodeMie.md`, `Qwen.md`, `MiniMax.md`) all pointing to `project.md` for auto-discovery.

### BUG-0054: Dashboard title, footer, brand color, and repo URL hardcoded

- **Severity:** Major
- **Status:** Fixed
- **Fix Branch:** est/BUG-0054
- **Found in:** `tools/generate-dashboard.js` lines 84, 355, 577, 591; 11 occurrences of `#D52B1E`
- **Description:** Dashboard HTML had "Your Project" title, "Canadian Tire Corporation" footer, GitHub repo URL, and CTC brand color `#D52B1E` hardcoded throughout CSS and HTML. Changing the project required editing 15+ locations in the dashboard generator.
- **Fix:** Added `dashboard` section to `agents.config.json` with `title`, `subtitle`, `footer`, `repoUrl`, and `primaryColor` fields. Dashboard generator reads these from config, defaulting to the repo name from `package.json`. All `#D52B1E` CSS references replaced with `var(--brand-primary)` CSS variable set from config.

### BUG-0055: XSS via unescaped data attributes in render-html.js

- **Severity:** Critical
- **Status:** Fixed
- **Fix Branch:** est/BUG-0055
- **Found in:** `tools/lib/render-html.js` lines 225, 284, 319, 549, 1096, 1205, 1206, 1355, 1369
- **Description:** Multiple `data-*` HTML attributes and `onclick` handler strings were interpolated without escaping. Malicious story/epic IDs or bug statuses could inject arbitrary HTML/JS. Affected: story cards, epic headers, bug table rows, bug card views.
- **Fix:** Applied `esc()` to all `data-*` attribute interpolations and `jsEsc()` to all `onclick` handler string interpolations across 9 locations.

### BUG-0056: Command injection via unquoted branch names in git-safe.js

- **Severity:** Critical
- **Status:** Fixed
- **Fix Branch:** est/BUG-0056
- **Found in:** `orchestrator/git-safe.js` — `safePush`, `safePull`, `detectConflicts`, `branchFiles` functions
- **Description:** Branch names were interpolated into shell commands without quoting: `git push origin ${branch}`. A branch name containing shell metacharacters (`;`, `$()`, backticks) could execute arbitrary commands.
- **Fix:** Quoted all 6 branch name interpolations in git shell commands with double quotes.

### BUG-0057: Infinite recursion in stale lock recovery (file-lock.js)

- **Severity:** Major
- **Status:** Fixed
- **Fix Branch:** est/BUG-0057
- **Found in:** `orchestrator/file-lock.js` — `tryAcquire()` function
- **Description:** If a stale lock's info file was repeatedly unreadable, `tryAcquire()` would recursively call itself with no depth limit, causing a stack overflow.
- **Fix:** Added `_depth` parameter with max depth of 2 retries. Throws explicit error on excessive retries.

### BUG-0058: Race condition on temp file names in atomic-write.js

- **Severity:** Major
- **Status:** Fixed
- **Fix Branch:** est/BUG-0058
- **Found in:** `orchestrator/atomic-write.js` — `atomicWrite()` function
- **Description:** Temp file suffix used only `process.pid`, so two rapid writes from the same process to the same directory could collide.
- **Fix:** Added `Date.now()` to temp file suffix: `.${basename}.tmp.${pid}.${timestamp}`.

### BUG-0059: Missing JSON parse error handling in atomic-write.js

- **Severity:** Major
- **Status:** Fixed
- **Fix Branch:** est/BUG-0059
- **Found in:** `orchestrator/atomic-write.js` — `atomicReadModifyWriteJson()` function
- **Description:** `JSON.parse()` call had no try-catch. A corrupt JSON file would throw an opaque error without identifying the problematic file.
- **Fix:** Wrapped in try-catch with descriptive error message including the file path.

### BUG-0060: Missing JSON parse error handling in spawn.js

- **Severity:** Minor
- **Status:** Fixed
- **Fix Branch:** est/BUG-0060
- **Found in:** `orchestrator/spawn.js` — `loadAgentsConfig()` function
- **Description:** `JSON.parse()` of `agents.config.json` had no error handling. A malformed config file would crash with an unhelpful stack trace.
- **Fix:** Added try-catch with descriptive error message.

### BUG-0061: Missing argument bounds checking in spawn.js CLI

- **Severity:** Minor
- **Status:** Fixed
- **Fix Branch:** est/BUG-0061
- **Found in:** `orchestrator/spawn.js` — `main()` function
- **Description:** `--agent` and `--task` flags accessed `args[idx + 1]` without bounds checking, producing `undefined` if the argument was missing.
- **Fix:** Added bounds checks with descriptive error messages and usage hints.

### BUG-0062: Silent lock directory removal failure in file-lock.js

- **Severity:** Minor
- **Status:** Fixed
- **Fix Branch:** est/BUG-0062
- **Found in:** `orchestrator/file-lock.js` — `release()` function
- **Description:** `rmdirSync` in `release()` could fail silently if directory had unexpected contents, leaving stale locks that would eventually expire via timeout.
- **Fix:** Added separate try-catch for `rmdirSync` with warning log.

### BUG-0063: Dashboard author info hardcoded in generate-dashboard.js

- **Severity:** Minor
- **Status:** Fixed
- **Fix Branch:** est/BUG-0063
- **Found in:** `tools/generate-dashboard.js` lines 594-595
- **Description:** Author name "Kamal Syed" and title "Director of Program Management, EPAM Systems" were hardcoded in the About modal HTML.
- **Fix:** Added `author` and `authorTitle` fields to `agents.config.json` dashboard config. Dashboard reads from config and conditionally renders.

### BUG-0065: Project-specific branch examples in AGENTS.md and AGENT_PLAN.md

- **Severity:** Minor
- **Status:** Fixed
- **Fix Branch:** est/BUG-0065
- **Found in:** `AGENTS.md` lines 338-339, `docs/AGENT_PLAN.md` line 61
- **Description:** Branch naming examples contained specific story/bug IDs (US-0003, BUG-0007, BUG-0012) instead of generic placeholders.
- **Fix:** Replaced with generic placeholders (US-XXXX, BUG-XXXX).

### BUG-0066: No SAST or secret scanning in CI pipeline

- **Severity:** Major
- **Status:** Fixed
- **Fix Branch:** est/BUG-0066
- **Found in:** `.github/workflows/ci.yml`
- **Description:** CI pipeline had lint, test, build, format check, and dependency audit but no static analysis security testing (SAST) or secret scanning. Code vulnerabilities and accidentally committed secrets would go undetected.
- **Fix:** Added CodeQL SAST job (javascript-typescript) and TruffleHog secret scanning job to CI pipeline.

---

## P1 — Major (functional test execution — found by Sentinel 2026-04-04)

### BUG-0106: Dashboard shows no audio/notification alert when pipeline state changes — user has no signal to return to terminal

- **Status:** Fixed
- **Severity:** Medium
- **Estimated Cost USD:** 3.50
- **Found in:** `tools/generate-dashboard.js` (dashboard HTML generation)
- **Story:** Tooling
- **Found by:** User (demo prep observation)
- **Description:** The agentic SDLC dashboard auto-refreshes every 5 seconds but gives no audio or notification signal when pipeline phases complete, agents become blocked, or bugs are opened. Users stepping away from the terminal have no way to know when their attention is required.
- **Fix:** Added a `localStorage`-based state change detection system. Each generated page embeds a `DASH_SNAPSHOT` JSON object with current phase, bug count, agent statuses, and pipeline completion state. On page load, the snapshot is compared to the previous render stored in `localStorage`. When a meaningful change is detected (phase completes, agent blocked, pipeline finishes, new bugs opened), the system plays a Web Audio API tone and fires a browser `Notification`. A "🔔 Alerts" button in the header lets users grant notification permission. No new dependencies — uses only built-in browser APIs.

---

## P2 — Minor (plan visualizer tooling — found 2026-04-06)

### BUG-0113: AI Cost Timeline chart inflated by est/\* estimated bug costs — diverged from header total

- **Severity:** Minor
- **Status:** Fixed
- **Fix Branch:** develop
- **Estimated Cost USD:** 0.50
- **Found in:** `tools/generate-plan.js` (`sessionTimeline` computation)
- **Story:** N/A (tooling)
- **Found by:** User (observation — header showed $483.63, timeline showed $573.68)
- **Description:** `sessionTimeline` called `deduplicateSessions(costRows)` without filtering `est/*` branches. The 18 synthetic estimated-bug-cost rows (e.g. `est/BUG-0001`) — representing manual estimates injected into `AI_COST_LOG.md` for bugs without real session data — were included in the cumulative timeline, inflating it by $101.15. The header total (`_totals.costUsd`) correctly skips `est/*` branches in `aggregateCostByBranch`, causing the two metrics to diverge.
- **Fix:** Added `.filter((row) => !row.branch.startsWith('est/'))` to the `sessionTimeline` pipeline in `generate-plan.js`. Both metrics now end at $483.63.

### BUG-0114: Plan Visualizer hierarchy card view renders blank — applyFilters hides all card epics on init

- **Severity:** Minor
- **Status:** Fixed
- **Fix Branch:** develop
- **Estimated Cost USD:** 1.00
- **Found in:** `tools/lib/render-html.js` (`applyFilters` function, line ~1792)
- **Story:** N/A (tooling)
- **Found by:** User (observation — card view appeared blank on switching from column view)
- **Description:** `applyFilters` queried `.story-row` children of each `.epic-block` element to determine whether to show or hide the block. In the column view, story rows are children of `.epic-block`. In the card view, the `.epic-block` is only the collapsible header; story rows live in a sibling `epic-cards-*` div. So `block.querySelectorAll('.story-row')` always returned 0 children for card view epic-blocks, causing all of them to be set to `display: none` on page load. Switching to card view showed a completely blank panel.
- **Fix:** Changed the search scope from `block` to `wrapper.closest('.mb-8') || block` so story rows in sibling divs are found correctly for card view epic blocks.

### BUG-0115: Agent Status card not fixed width — overflows grid and pushes User Stories panel offscreen

- **Severity:** Minor
- **Status:** Fixed
- **Fix Branch:** develop
- **Estimated Cost USD:** 0.25
- **Found in:** `tools/generate-dashboard.js` (`.grid-2` CSS rule)
- **Story:** N/A (tooling)
- **Found by:** User (screenshot — User Stories panel only partially visible at right edge)
- **Description:** The Agents + Stories section uses `.grid-2 { grid-template-columns: 2fr 1fr }`. CSS Grid does not automatically constrain grid items below their intrinsic content width — without `min-width: 0`, items can overflow their grid column. The Agent Status card contained an `agent-grid` with 3-column `repeat(3, 1fr)` cells that had non-wrapping text, causing the left column to expand and push the User Stories card off-screen to the right.
- **Fix:** Added `.grid-2 > * { min-width: 0; }` to force grid children to respect their column boundaries.
