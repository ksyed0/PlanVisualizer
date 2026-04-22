# LESSONS.md — Hard-Won Lessons & Permanent Rules

Encode every bug fix and discovery as a permanent rule. Applied to all future sessions.

---

## L-0041 — Chart.js has no built-in data labels; use HTML bar charts when text annotations are required

**Rule:** When a spec requires text labels (score values, badges) alongside chart bars, do not use Chart.js canvas — it requires the `chartjs-plugin-datalabels` external dependency which is not in this project. Use an HTML/CSS bar chart instead: `<div style="width:${pct}%;background:${col}">` rows with adjacent text spans. This is simpler, controllable, and produces exactly the required output without adding a dependency.
_Learned during EPIC-0010 Task 5: the initial canvas implementation produced bars with no text at all. The spec reviewer flagged score labels and level badges as missing. Replaced with HTML bar chart in one pass._
**Date:** 2026-04-19

---

## L-0042 — STATUS_WEIGHTS must handle both 'In-Progress' (hyphen) and 'In Progress' (space)

**Rule:** The RELEASE*PLAN.md parser emits story status as `'In Progress'` (with a space), but design specs and weight tables often write it as `'In-Progress'` (with a hyphen). Any STATUS_WEIGHTS map must include both: `{ 'In-Progress': 2, 'In Progress': 2, ... }`. Missing the space variant silently defaults to weight 1 for all In Progress stories, skewing risk scores.
\_Learned during EPIC-0010 compute-risk.js implementation — the code quality reviewer caught the missing alias during review.*
**Date:** 2026-04-19

---

## L-0043 — Pure computation modules should duplicate small utility functions to avoid render-layer deps

**Rule:** `compute-risk.js` implements its own `_normalizeRef` instead of importing `normalizeStoryRef` from `render-utils.js`. This is correct: pulling a render-layer utility into a pure data module would create a cross-layer dependency and make the module harder to test in isolation. When a pure module needs a small utility that exists elsewhere, prefer duplicating the minimal logic rather than importing from a higher layer.
_Observed during EPIC-0010 final review. The tradeoff: regex changes in render-utils.js won't propagate to compute-risk.js. Document the duplication with a comment._
**Date:** 2026-04-19

---

## L-0039 — Spec reviewers without the actual spec file will hallucinate requirements

**Rule:** A spec compliance reviewer given only the feature files (no plan document) will invent requirements that sound plausible but don't exist — e.g., fabricating "Section 1 must cover prerequisites" when the real AC is just "document the adoption steps". Always pass the reviewer the exact plan file path and the AC IDs to check. When reviewer findings feel surprising, cross-check against the plan file directly before acting on them.
_Learned during EPIC-0019 Task 8 review: the reviewer invented section-numbering ACs (AC-0482: "Section 1 covers prerequisites", AC-0484: "Section 4 documents ≥5 commands") that don't exist. The real ACs were at different IDs with different requirements. Two unnecessary edits were almost made._
**Date:** 2026-04-18

---

## L-0040 — Distribution artifacts must be unignored and committed; don't gitignore things you ship

**Rule:** If a generated file is intended to be distributed to other projects (e.g., via an installer that does `cp source/file target/`), it must be committed to the repo — not gitignored. Gitignoring it means it won't exist in a fresh clone, and the installer silently fails or aborts. Audit `.gitignore` for any file referenced by install/copy scripts.
_Learned when `docs/dashboard.html` was in `.gitignore` but `scripts/install.sh §7` tried to `cp` it to target projects. The file didn't exist in fresh clones, causing a `set -euo pipefail` abort mid-install. Fixed by removing it from `.gitignore` and committing it._
**Date:** 2026-04-19

---

## L-0036 — GitHub Actions CI does not trigger on pushes after a force-push in the same session

**Rule:** After force-pushing a branch, subsequent regular pushes to the same branch sometimes do not trigger new GitHub Actions runs (zero check-runs on the new commit). Workaround: push an empty commit (`git commit --allow-empty`) to force a new `synchronize` event. Do not wait for CI that will never come — poll `gh api repos/.../commits/{sha}/check-runs` first; if `total_count` is 0 after 30+ seconds, use the empty-commit trigger.
_Learned during US-0126 CI remediation: after force-pushing the rebased branch, the Prettier fix push produced no CI runs. Empty commit unblocked it._
**Date:** 2026-04-18

---

## L-0037 — Auto-merge fires immediately on MERGEABLE; Prettier fix must be in the same push

**Rule:** When `gh pr merge --auto --squash` is set and the PR becomes MERGEABLE (e.g., after resolving conflicts), GitHub auto-merge can fire within seconds — before a follow-up Prettier fix can be pushed. Mitigate: always run `npx prettier --write .` and commit BEFORE rebasing and pushing, so the fix is included in the same force-push that resolves the conflict. Never rely on a second push to the same PR to catch a Prettier failure.
_Learned when PR #395 auto-merged at commit 333243a before the Prettier fix at 9be4c87 could be included, requiring two additional PRs (#397, #399) to clean up._
**Date:** 2026-04-18

---

## L-0038 — Memory ID snapshots go stale fast; always read ID_REGISTRY.md directly

**Rule:** MEMORY.md ID snapshots (US next, AC next, etc.) are frozen at the time of the last memory write. If multiple stories shipped between sessions, the snapshot is wrong. Always `cat docs/ID_REGISTRY.md` before creating any artefact — never rely on memory for ID values.
_Learned when memory said next US = US-0110 but 16 stories had shipped since Session 17 (next was actually US-0126). Would have created a duplicate ID._
**Date:** 2026-04-18

---

## L-0034 — Sequential-merge cascade: pre-allocate ID ranges and expect per-PR rebases

**Rule:** When closing multiple stories that all write to the same docs files (TEST*CASES.md, ID_REGISTRY.md, RELEASE_PLAN.md, BUGS.md), pre-allocate non-overlapping ID ranges in the plan so branches can be written in parallel. Accept that each branch will need at least one rebase after the previous PR merges — budget for this in the pipeline. Keep rebase conflict resolution simple: always combine all changes from both sides additively (all TCs in sequential order, ID counters at the max value).
\_Learned when closing EPIC-0015 (4 stories, 18 TCs): US-0102 needed 1 rebase, US-0103 needed 1, US-0106 needed 2, due to each successive develop advance after merging the prior story.*
**Date:** 2026-04-18

---

## L-0035 — Spec/code reviewers check local files; verify actual PR content via git diff

**Rule:** When a spec reviewer reports all deliverables missing, confirm whether it's checking the local develop/chore branch or the actual PR feature branch. Use `git diff origin/develop...origin/feature/BRANCH` to see the true PR diff. Reviewer agents dispatched without explicit branch context will default to whatever's checked out locally.
_Learned when spec reviewers for US-0101 and US-0106 reported all TCs/fixes missing — they were checking local files on a non-feature branch. The PR branches were correct._
**Date:** 2026-04-18

---

## L-0032 — isolation:worktree uses main repo HEAD at spawn time; always be on develop before spawning

**Rule:** Before dispatching any Agent with `isolation: "worktree"`, verify the main repo's current HEAD is the correct base branch (develop). Run `pwd && git branch --show-current && git log --oneline -1` before spawning. If the shell's CWD has drifted to a worktree directory, commands run against the wrong repo state.
_Learned when Pixel agent for US-0053 was spawned but the CWD was `.claude/worktrees/agent-a394fc02` (an old base at 893e4c3) rather than the main repo on develop (a317683). The split was done on stale code, test counts diverged (370 vs 419), and the rebase produced an unresolvable conflict. Fix: always `cd /path/to/main/repo` and confirm branch before spawning._
**Date:** 2026-04-18

---

## L-0033 — Parallel-wave merge conflicts: keep all CSS and test describe blocks from both sides

**Rule:** When two parallel stories both modify `render-html.js` CSS and the same test file, the merge conflict resolution is always additive: include BOTH CSS blocks (different class names = no overlap) and BOTH describe blocks (each properly closed). Git's conflict representation places closing `});` after `>>>>>>>` as shared suffix — re-add them explicitly to each block.
_Learned when US-0104 (Trends CSS) and US-0105 (Costs CSS) both modified render-html.js CSS section and tests/unit/render-html.test.js. PR #378 showed CONFLICTING; resolved by keeping both CSS sections and both describe blocks with correct closing braces._
**Date:** 2026-04-18

---

## L-0001 — Jest upgrade eliminates transitive deprecation warnings

**Rule:** Always upgrade Jest to the latest stable major when transitive dependencies emit deprecation warnings — do not attempt to override or suppress them with resolutions.
_Learned when `inflight@1.0.6` and `glob@7` deprecation warnings appeared after `npm install`. Both are transitive dependencies of `jest@29` and could not be directly overridden. Upgrading to `jest@30` eliminated both with zero test changes._
**Date:** 2026-03-10

---

## L-0002 — CodeQL requires its own workflow file for custom triggers

**Rule:** Never place CodeQL in the same workflow file as other CI jobs if you need to restrict its triggers. GitHub Actions does not support per-job `on:` conditions — the trigger applies to the entire workflow.
_Learned when designing the CI pipeline. A single ci.yml with CodeQL would run CodeQL on every branch push, burning CI minutes unnecessarily. The fix was a separate codeql.yml with its own `on:` block._
**Date:** 2026-03-10

---

## L-0007 — All config paths must use lowercase to match Linux filesystem

**Rule:** Every path in `plan-visualizer.config.json` must match the actual directory casing on Linux (lowercase `docs/`). macOS is case-insensitive so `docs/` and `docs/` silently resolve to the same place; Linux treats them as separate directories. Always verify all config paths are lowercase-consistent with the workflow's `publish_dir`.
_Learned when the workflow deployed `./docs` but the generator wrote to `docs/` (from `outputDir: "docs"` in config), so `plan-status.html` never appeared in the deployed gh-pages branch._
**Date:** 2026-03-10

---

## L-0004 — GitHub Actions: gitignored files cannot be committed back from a workflow

**Rule:** Never add a `git add / git commit` step for files listed in `.gitignore`. The deployment artifact (`plan-status.html`) is gitignored by design; `peaceiris/actions-gh-pages` deploys the entire `publish_dir` directly from the filesystem — no commit-back step is needed or possible.
_Learned when plan-visualizer.yml failed with `fatal: pathspec 'docs/plan-status.html' did not match any files`. The file is generated by the workflow but gitignored in the repo, so `git add` silently ignores it, causing a non-zero exit. Removing the commit step entirely fixed the workflow._
**Date:** 2026-03-10

---

## L-0005 — GitHub Pages falls back to README.md when no index.html exists

**Rule:** Always include an `index.html` in the `publish_dir` for GitHub Pages. Without it, Pages serves the first alphabetically-matching fallback — usually `README.md`. Use a `<meta http-equiv="refresh">` redirect when the real entry point has a different filename.
_Learned when the Pages site showed README.md instead of the dashboard. Adding `docs/index.html` with a redirect to `plan-status.html` fixed it._
**Date:** 2026-03-10

---

## L-0006 — Add workflow_dispatch to any workflow that uses path filters

**Rule:** Any workflow with a `paths:` filter must also include a `workflow_dispatch:` trigger. When the workflow itself changes (or a file not in the path list changes), there is no other way to trigger a run manually via `gh workflow run` or the GitHub UI.
_Learned when docs/index.html and the workflow file edits didn't match the path filter, making `gh workflow run plan-visualizer.yml` fail with "no workflow_dispatch event trigger"._
**Date:** 2026-03-10

---

## L-0008 — Always run test:coverage before generate-plan.js in the Pages workflow

**Rule:** Always run `npm ci` and `npm run test:coverage` as steps before `node tools/generate-plan.js` in any CI workflow that deploys the dashboard. The `coverage/coverage-summary.json` file is gitignored and must be regenerated in CI on every deploy.
_Learned when coverage badges showed N/A in the deployed dashboard because `coverage-summary.json` was absent at generation time. Without the file, `parseCoverage()` returns the `{ overall: 0 }` fallback, causing both the header badges and the Charts tab doughnut to show zero._
**Date:** 2026-03-10

---

## L-0009 — Use position:sticky on a shared wrapper div for multi-section headers

**Rule:** When a header area is composed of multiple stacked components (top bar, filter bar, tab bar), wrap them all in a single `<div style="position:sticky;top:0;z-index:40">` rather than applying sticky to each element individually. A single sticky wrapper is simpler and avoids z-index conflicts.
_Learned when the top bar, filter bar, and tab bar all scrolled off-screen on content-heavy tabs. A single sticky wrapper fixed all three in one change. The activity panel at z-index:50 naturally overlays it._
**Date:** 2026-03-10

---

## L-0010 — Always update TEST_CASES.md Status fields when a story is marked Done

**Rule:** Whenever a user story is marked Done, immediately update the Status field of all linked test cases in `docs/TEST_CASES.md` from `[ ] Not Run` to `[x] Pass` (or `[x] Fail` if any test actually failed). Never leave TC statuses stale when stories are complete.
_Learned when BUG-0003 caused all 23 TCs to show "Not Run" in the Traceability tab despite all linked stories being complete. The parser was always correct — the data was simply never updated._
**Date:** 2026-03-10

---

## L-0011 — HTML-escape all user-supplied strings before DOM injection

**Rule:** Every field sourced from user-controlled markdown files (story titles, epic titles, AC text, bug titles, branch names, project name, tagline) must be run through an HTML-escape helper before being interpolated into template literals that produce HTML. Add a single `esc()` helper at the top of any renderer. Internally-generated fields (commit SHA, ISO timestamps) do not need escaping.
_Learned when BUG-0005 showed that unescaped `<script>alert(1)</script>` in a story title was injected verbatim into `plan-status.html`, executing on load._
**Date:** 2026-03-10

---

## L-0012 — Use a boolean `available` flag to distinguish "no coverage file" from genuine 0%

**Rule:** Never use `value > 0` to test whether coverage data is present. Instead, return `available: false` in all FALLBACK/fallback paths and `available: true` on valid data. The heuristic `> 0` conflates "coverage file absent" with "all code paths untested", causing N/A to incorrectly appear when coverage is genuinely 0%. Both `parseCoverage()` and any inline fallback in `main()` must set `available: false`.
_Learned when BUG-0010 was found: `cov.overall > 0` returned false for both missing file and genuine 0%, making it impossible to tell the difference._
**Date:** 2026-03-10

---

## L-0013 — progress.md is written newest-first; do not reverse or sort

**Rule:** `parseRecentActivity()` should return sessions in document order. The convention for `progress.md` is that the most recent session is always prepended at the top. Adding `.reverse()` before `.slice()` would invert correct output into oldest-first. If AC requires newest-first, add a regression test asserting descending dates — do not change the parser.
_Learned when BUG-0011 proposed `.reverse()` to fix sort order, but existing tests broke because the fixture (and real file) are already newest-first. BUG-0011 was a false positive._
**Date:** 2026-03-10

---

## L-0003 — Release plan artifacts must be inside fenced code blocks

**Rule:** Never place EPIC/US/TASK definitions outside of triple-backtick fenced code blocks in RELEASE*PLAN.md. The parser (`parse-release-plan.js`) only reads content inside fenced blocks — narrative prose outside is silently ignored.
\_Learned when writing the first version of RELEASE_PLAN.md. Artifacts outside code blocks produced zero parsed results.*
**Date:** 2026-03-10

---

## L-0014 — generate-plan.js and render-html.js must use identical key names for cost data

**Rule:** Any field written into the `costs[storyId]` object in `generate-plan.js` must be read using the same key name in `render-html.js`. The data passes through a JSON file with no runtime type checking, so a key mismatch silently evaluates to `undefined → 0` with no error. The totals row reads `costs._totals.costUsd` directly and so is unaffected — making the bug appear as "stories show $0 but total is correct."
_Learned when BUG-0023 was found: generate-plan.js stored `aiCostUsd` but render-html.js read `costUsd`. Renamed to `costUsd` throughout._
**Date:** 2026-03-16

---

## L-0015 — Use dual y-axes when Chart.js datasets differ by 3+ orders of magnitude

**Rule:** When two datasets on the same bar chart differ by roughly 1,000× or more, sharing a single y-axis makes the smaller series render at sub-pixel height and become invisible. Use `yAxisID` on each dataset and define two `scales` entries (`position: 'left'` and `position: 'right'`). Set `grid.drawOnChartArea: false` on the secondary axis to avoid double grid lines.
_Learned when BUG-0024 showed projected costs ($1,600–$4,000/epic) and AI costs ($1–$7/epic) on the same axis, making AI bars invisible._
**Date:** 2026-03-16

---

## L-0016 — Override Tailwind CDN utilities with !important in a <style> block for mobile

**Rule:** Tailwind CSS loaded via CDN generates utility classes at runtime with standard specificity. To override them in a `@media` block inside a `<style>` tag, append `!important` to each property. Without `!important`, the CDN-generated utilities (which are injected after the static `<style>` tag) will win the specificity race.
_Learned when BUG-0020 mobile CSS fixes had no effect until `!important` was added to every property in the `@media (max-width: 767px)` block._
**Date:** 2026-03-16

---

## L-0018 — GitHub Actions cannot push directly to a protected branch; use an auto-merge PR instead

**Rule:** If a branch requires PRs and status checks, a GitHub Actions workflow using `GITHUB_TOKEN` cannot push commits directly to it — the push is rejected with `GH006: Protected branch update failed`. The correct pattern is: create a short-lived branch, push the commit there, open a PR to the protected branch, and call `gh pr merge --auto` so it merges as soon as CI passes. Also add `pull-requests: write` to the job's `permissions` block, and ensure the repo has "Allow auto-merge" enabled (Settings → General).
_Learned when version-bump.yml failed with GH006 trying to push `chore: bump patch version` directly to `develop`._
**Date:** 2026-03-16

---

## L-0019 — Separate format specifications from operating protocols in AGENTS.md

**Rule:** Never bundle tool-specific document format requirements into the project's general `AGENTS.md`. Operating protocols (session startup, git workflow, testing standards) belong in `AGENTS.md`. Parser-level format requirements (what fields a specific tool expects, what regex a parser uses) belong in a dedicated format spec file (e.g., `plan_visualizer.md`). Reference the spec file from `AGENTS.md` with a single line. This makes installs non-destructive, keeps AGENTS.md portable, and ensures AI agents consult the correct source for format decisions.
_Learned when the install script's AGENTS.md overwrite/prompt caused friction for users with existing agent standards. The solution — a standalone `plan_visualizer.md` auto-referenced from AGENTS.md — eliminated the conflict entirely._
**Date:** 2026-03-18

---

## L-0017 — Place a panel's close button inside the panel, not outside it

**Rule:** When a panel overlays part of the screen (e.g. `position:fixed; top:0; right:0; width:280px`), any close button positioned at the same coordinates outside the panel will be covered by the panel once it opens. Always place the close button as a child element inside the panel header so it is never obscured. For desktop-only toggle buttons outside the panel, verify the panel dimensions do not reach that coordinate.
_Learned when BUG-0022 showed the `≡ Activity` toggle at `fixed top-4 right-4` was covered by the panel (`fixed top-0 right-0 width:280px`) after opening, making it impossible to close. Fixed by adding a `×` button inside the panel with `md:hidden`._
**Date:** 2026-03-16

---

## L-0020 — `position:fixed` topbar with auto-height breaks on phone portrait

**Rule:** A `position:fixed` topbar with `height:auto` and wrapping content (e.g. stat chips on 2 rows) doesn't scroll with the page, leaving content hidden under it. For <480px phone portrait where the topbar height is variable, switch to `position:relative` so the topbar flows in the document — then `body { padding-top: 0 }` and sidebar `top: 0`. This means the topbar scrolls away on small screens, which is acceptable trade-off over unreachable content.
_Learned during US-0048 responsive layout design — fixed-height topbar assumption broke when chips wrapped to 2 rows on narrow screens._
**Date:** 2026-03-29

---

## L-0021 — Hover doesn't exist on touch devices; mobile nav patterns must use tap

**Rule:** When designing icon-only sidebars or collapsed nav for mobile, never rely on `:hover` to reveal labels — touch screens have no hover state. The three valid patterns are: (a) tap icon = navigate directly, (b) tap icon = open a drawer, (c) long-press = show tooltip. "Tap to navigate" is the simplest and requires no extra UI state; use it as the default for utility dashboards.
_Learned during US-0048 brainstorm when user asked "how does hover work on tablets and phones" — the answer was it doesn't, and the design was corrected._
**Date:** 2026-03-29

---

## L-0022 — Prettier indents markdown fields under list items; parsers must tolerate leading whitespace

**Rule:** When Prettier formats markdown with numbered-list items and subsequent fields like `Status:`, `Severity:`, `Fix Branch:`, it indents those fields with 3 spaces as list-item continuations. Any regex parser that anchors field matches to column 0 (e.g. `^Status:`) will silently drop those fields after Prettier runs, yielding empty-string values. Fix: use `^[ \t]*${key}:` to tolerate optional leading whitespace. Apply this pattern to every field parser in the project (parse-bugs.js, parse-test-cases.js, and any future parser).
**Bugs:** BUG-0043
_Learned when BUG-0043 first surfaced (fixture test break) and re-learned in Session 17 when both parse-bugs.js AND parse-test-cases.js had the same issue — all 139 TCs showed "Not Run" and all bugs had empty fixBranch/relatedStory/severity._
**Date:** 2026-04-13

---

## L-0023 — Adjacent code-fence pairs break sequential regex extraction

**Rule:** Patterns like ` ```\n\n``` ` (two backtick fences with only a blank line between them) appear in markdown after Prettier reformats certain structures. A `[\s\S]*?`-style sequential regex pairs consecutive backticks, treating each pair as a block. When the file has `...code1 ``` \n\n ``` code2 ``` \n\n ``` code3...`, the regex captures `code1`, the empty block, and the empty block — missing `code2` entirely. Fix: either (a) parse structurally with a line-by-line state machine flipping on each fence, or (b) abandon code-fence extraction altogether and split the full markdown by blank lines, filtering chunks that match header patterns. Option (b) is more robust because it doesn't care about fence balance.
**Bugs:** BUG-0158
_Learned when US-0085/0086/0087 in the Standalone Stories section of RELEASE_PLAN.md were silently dropped by `extractCodeBlocks`. Replaced with chunk-based parsing — stories now parse regardless of fence placement._
**Date:** 2026-04-14

---

## L-0024 — Normalize cross-references with regex extraction, not exact match

**Rule:** When cross-referencing between data files by ID (e.g. bug.relatedStory → story.id), don't assume the reference is in canonical form. Real-world data contains extras: parenthetical context (`"US-0012 (capture-cost)"`), trailing whitespace, stale text ("n/a"), or typos. Use a regex-extract helper that pulls the canonical ID (`US-\d{4}`) out of arbitrary text, returning null if no match. Apply to every map lookup involving user-provided reference fields.
**Bugs:** BUG-0158
_Learned when BUG-0056's relatedStory `"US-0012 (capture-cost)"` failed exact-string lookup and the bug fell to `_ungrouped` on Costs tab despite having a valid US reference. Fixed via `normalizeStoryRef()` in render-html.js._
**Date:** 2026-04-14

---

## L-0025 — Snapshot-based cumulative metrics must enforce monotonicity post-hoc

**Rule:** If a time-series chart plots a cumulative metric (e.g. total AI cost over time) sourced from periodic snapshots of a mutable state file, the raw snapshot values may NOT be monotonically non-decreasing. Reasons: entries get removed or filtered differently between runs, the calculation changes, stop-hook races cause missed data. If the chart title implies monotonicity ("cumulative", "total to date"), enforce it explicitly: carry forward the running maximum when building the series. Never trust raw snapshot values for monotonic display.
**Bugs:** N/A (fixed inline during Session 17)
_Learned when the AI Cost Over Time chart on the Trends tab showed costs dropping backward at two points. Root cause: different snapshots stored different totals (est/\* branches filter was added between runs). Fix: `maxCost = Math.max(maxCost, rawCost)` in extractTrends._
**Date:** 2026-04-14

---

## L-0026 — Worktree `isolation` inherits .claude/settings.local.json permissions

**Rule:** An outdated or incorrect memory claim about Claude Code worktree Bash permissions can gate the entire DM*AGENT pipeline unnecessarily. Before accepting "worktrees don't work" as a persistent constraint, spawn a trivial test agent with `isolation: "worktree"` asking it to run `pwd`, `git branch`, `node --version`, `npx jest --version`. If they all succeed, the constraint is stale. Update the memory. The typical source of worktree-Bash failure is global `.claude/settings.json` having a restrictive allow-list — adding to `.claude/settings.local.json` (dev-local, gitignored) is inherited into worktree sub-agents.
**Bugs:** N/A (memory correction)
\_Learned at Session 17 start when MEMORY.md claimed "Bash denied in worktrees" but a test revealed it worked fine. Unlocked the full DM_AGENT pipeline (parallel Pixel/Forge, parallel Sentinel/Circuit).*
**Date:** 2026-04-14

---

## L-0027 — Worktree spawn uses main-repo HEAD; pull develop before every spawn

**Rule:** When Claude Code provisions a worktree via `isolation: "worktree"`, it branches from the main repo's current HEAD at spawn time. If the main repo is on a stale develop or a feature branch, the worktree inherits that state — so the sub-agent's work will be based on an older codebase, and merging it back will conflict. Always perform `git checkout develop && git pull origin develop` in the main repo immediately before spawning any agent. Additionally, before spawning Lens (reviewer), rebase the returned feature branch onto origin/develop to catch any parallel drift.
**Bugs:** N/A (process discipline)
_Learned when Pixel's US-0097 branch was cut from the EPIC-0015 scaffold commit (4 commits behind develop) and merge-conflict bombed on integration. Resolved by adding rebase-before-review to DM_AGENT.md._
**Date:** 2026-04-14

---

## L-0028 — PR-based merges unlock CI gate enforcement

**Rule:** Direct `git push` to protected branches requires `--admin` override and skips CI. Using `gh pr create → gh pr merge --auto --squash --delete-branch` makes every story commit pass through the full CI suite (Lint, Test, Coverage, Format, Audit, SAST, Secret Scan, etc.) before landing. The ~2 min latency per story is worth it for (a) enforced quality gates, (b) authentic agentic-SDLC demonstration (Lens comments on actual PR pages), (c) one-click rollback via `gh pr revert`, (d) no more fighting branch protection. Precondition: baseline branches must pass CI — fix format/lint drift in a `chore/` PR before switching workflow.
**Bugs:** N/A (process)
_Learned when develop baseline had Prettier warnings blocking first PR. Fixed via `chore/prettier-baseline` PR #288, then switched entire EPIC-0015 remaining work to PR-based._
**Date:** 2026-04-14

---

## L-0029 — Live dashboard sync needs a dedicated CLI tool, not manual JSON edits

**Rule:** When a dashboard reads from a state file (e.g. docs/sdlc-status.json) that updates at pipeline transitions, no one will remember to update the file by hand-editing. Build a thin CLI helper (e.g. `tools/update-sdlc-status.js`) with event-shaped commands (story-start, agent-start, review, test-pass, phase, story-complete, log) that mutates the state atomically. Document the expected call-sites in the pipeline's instruction file so agents (or the orchestrator) invoke them at each transition. Use `atomicReadModifyWriteJson` if parallel agents may write.
**Bugs:** N/A (tooling)
_Learned at Session 17 when the agentic dashboard was found frozen on hackathon-era state despite the pipeline running live. Root cause: the DM_AGENT spec said "update sdlc-status.json after each phase" but without a tool, the Conductor silently skipped it. The CLI fixed the gap._
**Date:** 2026-04-14

---

## L-0030 — Legacy file + canonical file drift: pick one, migrate, delete

**Rule:** When a project has two files with overlapping purposes (e.g. root `/BUGS.md` and `docs/BUGS.md`), they WILL drift. The parser reads only one; the other accumulates stale or parallel data. Don't try to keep them in sync. Pick the canonical file (the one the tool reads), migrate content via title-based dedup + renumber (not ID-based — IDs collide semantically), update any code references, and delete the legacy file. Document the migration in a commit message with the renumbering table so historical cross-references can still be traced.
**Bugs:** N/A (one-time cleanup)
_Learned when Session 17 discovered `/BUGS.md` had 44 bugs NOT in `docs/BUGS.md` (parser canonical). ID-dedup was impossible because IDs collided with entirely different content. Title-dedup + renumber to BUG-0113-0156 preserved all content. Root file deleted._
**Date:** 2026-04-14

---

## L-0031 — Epic is Done → work freezes. New work goes to a different epic.

**Rule:** Once an epic is marked `Status: Done`, no new stories, bugs, or tasks may be added to it. Treat Done epics as immutable. If related work surfaces after the epic closes, file it under (a) the next planned epic in the roadmap, (b) a dedicated Follow-Up Changes epic (EPIC-0014 in this project), or (c) a new purposed epic. This preserves epic-level velocity metrics and keeps "Done" meaningful. Do NOT re-open a Done epic just to add one story; the accounting becomes incoherent.
**Bugs:** N/A (governance)
_Learned when Session 17 had to decide where US-0108 (sdlc-status CLI) belonged — EPIC-0013 was Done. Chose EPIC-0014 Follow-Up Changes. Same pattern later applied to US-0083 and US-0053 which had been attached to Done epics 0004 and 0007._
**Date:** 2026-04-14

## Session 18 lessons (EPIC-0016 Agentic Dashboard)

### **Always respawn on fresh develop when parallel-wave rebase conflicts get complex.**

_Learned during US-0115 pipeline timeline — multi-commit rebase after US-0118 and US-0119 merged hit irreconcilable conflicts in the same generate-dashboard.js region. A fresh respawn finished in ~5 min vs hours of manual conflict resolution._

### **Test file conflicts between sibling PRs need manual `});` verification after conflict-marker removal.**

_Learned during US-0120/US-0121 rebase — both added new `describe` blocks; removing conflict markers dropped a closing `});` boundary between them, producing a silent SyntaxError that prettier caught but jest tolerated (tests passed but file was malformed). Always `npx prettier --check` AND verify `grep describe(` produces balanced open/close counts after manual test-file conflict resolution._

### **Derive live metrics from authoritative sources at render time; never trust hand-maintained kv stores.**

_Learned from BUG-0166 — sdlc-status.json.metrics had "4 / 0" tasks, 0 bugs despite 130+ entries, stale 1861 tests. The fix (reading docs/plan-status.json at generate time) solved the displayed-data honesty problem permanently. Rule: any metric that can be derived from source of truth MUST be, otherwise it drifts._

### **For `text-overflow: ellipsis` inside flex-child-in-grid-cell layouts, set `min-width: 0` at BOTH the grid item AND the flex child.**

_Learned during BUG-0164 — titles overflowed panel width despite `.story-title { flex: 1; overflow: hidden; text-overflow: ellipsis }`. Root cause: `.story-row` was the grid item (`grid-template-columns: 1fr 1fr`) and grid items default to `min-width: auto`, forcing the cell wider than 1fr when content is `nowrap`. Fix: `min-width: 0` on both `.epic-stories > _`(grid items) and`.story-row` (flex container).\*

### **AudioContext must be singleton'd at module level — never per-call.**

_Learned from BUG-0160 — playBeep() was doing `new AudioContext()` every call. Rapid BLOCKED transitions produced 20+ leaked contexts. Pattern: module-level `_audioCtx = null` + `getAudioContext()` lazy-init with `ctx.resume()` on suspended state + graceful null-return on unsupported browsers._

### **Live DOM patching requires stable IDs on every volatile element + append-only log pattern.**

_Learned during US-0111 — replacing `location.reload()` with `fetch + patchDOM` needs every dynamic value to be `getElementById`-able. Phase pills, agent statuses, metric values, log entries all got stable IDs at generate time. Activity log uses `data-log-key` dedup + prepend for new entries._

### **Auto-merge pauses on BEHIND; the fix is rebase + force-push, not re-enabling.**

_Learned during Wave 1-4 parallel merges — `gh pr merge --auto --squash` stays armed through rebases. When a sibling PR lands and another goes BEHIND, rebase + force-push is enough; auto-merge fires when CI goes green on the new tip._

### **Prettier failures on sibling PRs often trace back to `PROMPT_LOG.md` table formatting.**

_Learned during multiple Wave 3+4 PRs — PROMPT_LOG markdown tables with inconsistent column alignment break Prettier on every PR until re-formatted. Run `npx prettier --check .` repo-wide after manual PROMPT_LOG edits._

### **`file://` protocol breaks `fetch('./sdlc-status.json')` via CORS — by design.**

_Learned during US-0111 testing — opening dashboard via Finder double-click triggers STALE state. Graceful degradation is correct; document the HTTP-server workaround (`npx serve docs/`) for local dev._

## Session 19 lessons (branch hygiene)

### **Every GitHub Actions workflow that opens a PR MUST pass `--delete-branch` to `gh pr merge`.**

_Learned from BUG-0170 — `.github/workflows/version-bump.yml` auto-created a `chore/version-bump-<sha>` branch per develop commit and auto-merged it, but forgot `--delete-branch`. After EPIC-0016 there were 25+ orphan version-bump branches on origin. Fix: one-flag addition to line 44 of the workflow. Rule: audit every workflow file before merging it; `gh pr merge` without `--delete-branch` accumulates cruft forever._

### **Worktree removal is a MANDATORY post-merge step, not optional cleanup.**

_Learned from BUG-0171 — `gh pr merge --delete-branch` deletes the REMOTE branch on merge, but the LOCAL feature branch stays because the worktree holds a ref lock. After EPIC-0016, 16 `.claude/worktrees/agent-_`directories and matching`worktree-agent-_`local branches accumulated. Rule: the DM_AGENT post-merge protocol's`git worktree remove <path> --force` is required; skipping it for speed creates tech debt that compounds every story._

### **Squash-merged local branches need `git branch -D` (force), not `-d`.**

_Learned from BUG-0172 — a squash merge creates a new commit on develop that isn't a descendant of the feature branch's tip. `git branch -d` refuses "branch not merged" because it checks for ancestry, not upstream-PR merge state. Rule: after confirming via `gh pr list --state merged --head <branch>` that the PR is MERGED, use `git branch -D` safely. The cleanup-branches.sh script gates this behind an origin PR-state check so it never force-deletes a legitimately unmerged branch._

### **Ship a cleanup script so the next-epic Conductor has a safety net.**

_Learned during session 19 — hand-auditing 52 stale branches (48 local + 46 remote) after a 14-story epic isn't sustainable. `scripts/cleanup-branches.sh` (`npm run cleanup:branches`) codifies the recipe: remove worktrees → prune remotes → delete gone-upstream locals → force-delete squash-merged locals → delete orphan version-bump remotes → delete merged feature-branch remotes (guarded by PR-state check). Runs idempotently; has a `--dry-run` for preview. Rule: if a cleanup pattern surfaces in a post-mortem, turn it into a script immediately; the next epic will need it._

### **Cleanup scripts MUST gate branch-delete on PR state, uniformly across every branch pattern.**

_Learned from BUG-0173 (self-inflicted) — first version of `scripts/cleanup-branches.sh` gated step 6 (feature/bugfix/chore-session) on PR state but NOT step 5 (chore/version-bump-\*). The assumption "version-bump branches are ephemeral, always safe to nuke" is false when the auto-merge PR is still open; deleting the branch mid-flight closes the PR. Rule: any branch-delete loop in automation must check `gh pr list --state all --head <branch>` and skip when state=OPEN, regardless of how "trivial" the branch pattern looks._

### **Every schema-bearing config file needs a paired migrator script, invoked on install/upgrade.**

_Learned during the post-EPIC-0016 cleanup audit (BUG-0175) — US-0113 added `agents.<name>.avatar` and an earlier change required `docs.lessons` in `plan-visualizer.config.json`, but `scripts/install.sh` only created configs from the example when absent; upgrading an existing install quietly skipped both. Target projects on older configs silently lost features. Rule: whenever a field becomes required (code dereferences it without a sane undefined-path), add it to the corresponding example AND to `tools/migrate-config.js` at the same commit. The migrator must be idempotent (re-runnable), preserve user values, and run automatically from install.sh. Expose `plan:migrate-config:dry` so users can preview before applying._

## Session 25 lessons (UI consistency, agentic pipeline design)

### **Worktree test files are included in the main repo's jest run — they must stay in sync with the implementation.**

_Learned from BUG-0190 re-fix — the worktree lives at `.claude/worktrees/<name>/` inside the main repo directory, which is not excluded by jest's testMatch globs. After updating render-html.js to add `classList.add('dark')`, the worktree's stale test (`.not.toContain(...)`) caused a suite-level failure in the main repo's `npx jest` run. Rule: when you update a source file that also exists in the worktree, check whether the worktree's test file has a conflicting assertion and update it immediately._

### **Static `Assignee:` in RELEASE_PLAN.md does not fit the multi-agent pipeline model.**

_Raised during session 25 Agent Workload discussion — in a traditional board, one person owns a story. In the agentic pipeline, a single story passes through 4–6 agents (Compass → Keystone → Pixel/Forge → Lens → Sentinel/Circuit). A single static `Assignee:` field only captures one phase and goes stale immediately. Rule: for the Agent Workload widget, read live data from `docs/sdlc-status.json` (maintained by `tools/update-sdlc-status.js`) rather than any field in RELEASE_PLAN.md. Captured as US-0147 (EPIC-0020)._

### **All view-toggle JS functions must use `classList.toggle('active-view', …)` — never inline `style.fontWeight/background`.**

_Learned from BUG-0205 re-audit — `setHierarchyView` was already updated to use `classList.toggle('active-view', ...)` in render-scripts.js, but `setCostsView`, `setBugsView`, and `setLessonsView` in render-tabs.js still used `style.fontWeight` / `style.background` inline. The `.active-view` CSS class was defined in render-html.js and should be the single definition point. Inline styles are invisible in devtools CSS cascade and can't be overridden by media queries or themes. Rule: any active/selected button state must use a CSS class, never inline styles, so the CSS lives in one place and the JS remains a toggle operation._

### **Tabs developed independently will drift from each other's header conventions — enforce a shared pattern early.**

_Learned from BUG-0210 — Lessons and Bugs tabs both have epic group headers, but were developed at different times. Bugs established the definitive format (monospaced EPIC-XXXX + badge + title + accent border), but Lessons was never updated. The pattern should have been extracted to a shared helper function `_epicGroupHeader(epicId, epic, accent, countLabel)` from the start. Rule: whenever a second tab adopts a pattern pioneered by the first, immediately extract it into a shared helper and wire both tabs to it — don't leave duplication to drift._
