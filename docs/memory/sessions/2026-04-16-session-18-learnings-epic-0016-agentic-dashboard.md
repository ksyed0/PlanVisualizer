# Session 18 learnings (2026-04-15/16) — EPIC-0016 Agentic Dashboard Mission Control

### Parallel-wave merge discipline

- **Base drift is inevitable when 2+ parallel Wave stories touch the same file.** Every sibling merge advances develop, forcing rebase on remaining open PRs. The BLOCK-rebase cycle is procedural, not a quality defect.
- **When rebase hits multi-commit conflicts, respawn the sub-agent on fresh develop instead of fighting git.** Cost of respawning an XS/S/M story is usually less than untangling overlapping CSS+HTML hunks across sibling merges. Applied for US-0115.
- **Test file conflicts are almost always additive**: both sides add new `describe` blocks. Just delete the 3 conflict markers keeping BOTH sides — but carefully verify closing braces survive. If the conflict markers sit between siblings' closing `});` and opening `describe`, you'll delete a `});` unintentionally and produce a syntax error. Verify with `npx prettier --check` and manually re-add the missing `});` before force-push.
- **Auto-merge pauses on BEHIND state.** No need to keep re-enabling; just rebase + force-push and auto-merge fires the moment the branch is up-to-date with develop and CI green.

### Prettier / PROMPT_LOG drift

- `PROMPT_LOG.md` table rows with inconsistent column alignment are a recurring Prettier-check failure source. Whenever you edit PROMPT_LOG manually, run `npx prettier --write PROMPT_LOG.md` before committing.
- `npx prettier --check .` (repo-wide, no file filter) is the fastest way to find what CI will flag — worktree sub-agents sometimes lint only their own touched files and miss repo-wide drift.

### Live-fetch + file:// protocol

- US-0111's `refreshState()` uses `fetch('./sdlc-status.json')`. Opening `docs/dashboard.html` via `file://` triggers browser CORS → fetch fails → graceful STALE state. GitHub Pages + any HTTP server (`npx serve docs/`, `python3 -m http.server`) work normally.
- `docs/sdlc-status.json` is gitignored, so the deployed GitHub Pages copy has no status file by default. The Pages build step must run `npm run init:status` (or generate-dashboard must tolerate the 404 gracefully — current behavior). Documented as deploy concern.

### Derive-don't-store metrics pattern (BUG-0166 root cause)

- `sdlc-status.json.metrics` is a hand-maintained key-value store; nothing recomputes it. It drifts immediately. **Rule: at render time in generate-dashboard.js, override metrics with values derived from authoritative sources (`docs/plan-status.json` for stories/tasks/epics/bugs, `docs/coverage/` for tests/coverage).** Codified in the loadPlanData helper.
- Tests Passed / Phases Complete / Reviews still read stale — needs EPIC-0017 jest-summary persistence OR EPIC-0019 cycle-reset semantics.

### CSS flex/grid + ellipsis truncation

- For `text-overflow: ellipsis` to work inside a flex child that lives in a CSS grid cell, BOTH layers need `min-width: 0`:
  - Grid-cell selector (`.epic-stories > *`) OR the flex-child itself if it IS the grid item
  - Flex child with `flex: 1 min-width: 0` that has the ellipsis CSS
- Title-level `min-width: 0` alone is not sufficient; the parent flex container + grid cell intrinsic-width chain all need to allow shrinking.

### Chart vertical centering in equal-height grid rows

- CSS grid rows force all cards to the tallest sibling's height. A fixed-size chart (e.g., `height:300px`) inside a card that's stretched to 648px ends up pinned to the top with empty space below.
- Fix: `.card-elev { display: flex; flex-direction: column }` + wrap chart in `<div class="flex-1 flex items-center justify-center">` so the chart centers vertically inside any stretched card.

### AudioContext singleton pattern

- Browsers throttle/suspend AudioContext instances aggressively. Creating one per `playBeep()` call leaks context instances (BUG-0160).
- Standard pattern: module-level `_audioCtx = null` + `getAudioContext()` helper that lazily creates once and calls `ctx.resume()` when `state === 'suspended'`. Early-exit with `null` on unsupported browsers.

### Live DOM patching without reload (US-0111)

- Replace `location.reload()` with `refreshState() → fetch + patchDOM + runAlertCheck`. Preserves scroll, modal state, any user DOM interaction.
- Give every volatile element a stable ID at generate time (`#phase-<id>`, `#agent-<name>`, `#metric-<key>`, `#log-scroll`). Client-side `patchDOM(status)` updates text/classes only — never `innerHTML` on large regions.
- Activity log uses append-only pattern via `data-log-key` dedup instead of re-rendering the whole log.
- `runAlertCheck(status)` must handle BOTH raw status AND pre-built snapshot shapes (page-load calls with `DASH_SNAPSHOT`, refreshState calls with parsed JSON).

### EPIC-0016 architecture legacy

- 6 phases canonical: Blueprint, Architect, Build, Integration, Test, Polish (no Deploy — that's EPIC-0019 scope).
- System font stacks are used since CDN removal (BUG-0228/0230, Session 31): `system-ui, -apple-system, 'Segoe UI', sans-serif` (UI) and `ui-monospace, 'JetBrains Mono', 'Cascadia Code', monospace` (code). Google Fonts (Departure Mono, Geist, JetBrains Mono, Inter Tight) no longer loaded.
- `tools/lib/theme.js` now owns the BADGE_TONE map + badge() helper; both `render-html.js` and `generate-dashboard.js` import from it. Drift eliminated.
- `.section-header` utility: Geist, 11px/700, uppercase, 0.14em tracking. Shared across sections.
- `.live-dot` component: 6×6 circle, ok/warn/err variants, pulse animation with `prefers-reduced-motion` guard. Used in header clock, spotlight, Quality card, Activity log.
- Agent portraits: read from `docs/agents/images/optimized/{avatar}-{64,160,320}.png`. Fallback chain: optimized → headshot → emoji. `avatar` base name lives in agents.config.json per agent.

### EPIC-0025 GitHub Issues Sync (Session 39, 2026-05-05)

- `tools/lib/github-client.js` — thin Node `https` wrapper: `githubRequest`, `buildIssueTitle/Body`, `batchedRequests`, `createIssue/closeIssue/reopenIssue/listIssues`. NOTE: `listIssues` caps at 100 issues (no pagination). Use `gh auth token` to get token when `GITHUB_TOKEN` env var not set.
- `tools/lib/sync-bugs.js` — `classifyBugChanges` (create/close/reopen/pull_close/skip), `writeBugIssueNumber` (MUST be block-scoped — use `blockRe = new RegExp(\`(^${bugId}:.+?)(?=\\nBUG-\\d+:|\\Z)\`, 'ms')`to avoid cross-block false positives),`loadSyncState/saveSyncState/buildStateEntry`.
- `tools/lib/sync-stories.js` — `classifyStoryChanges`, `writeStoryIssueNumber` (block-scoped, inserts after `Branch:` line).
- `tools/sync-github.js` — CLI entry, `--dry-run` flag, reads `plan-visualizer.config.json` for `github` block, writes `docs/github-sync-state.json` (gitignored).
- `tools/lib/parse-bugs.js` NOW reads `ghIssueNumber` from `GH Issue: #NNN` field. Required for idempotent sync.
- `tools/lib/render-tabs.js` has `renderSettingsTab({ githubConfig, githubTokenSet, syncState })` — called from render-html.js, data wired through generate-plan.js.
- GitHub secondary rate limit blocks bulk issue creation; add 2s+ inter-batch delay for >100 creates. The default 100ms is too fast.
- `classifyBugChanges` state-map fallback: `effectiveIssueNumber = bug.ghIssueNumber || state?.ghIssueNumber` — prevents re-creation when BUGS.md write failed.
- `docs/github-sync-state.json` is gitignored (runtime sync state, not committed).
- `scripts/update.sh` added (Session 39): idempotent updater that re-copies tools/, tests/, orchestrator/, dashboard.html, docs/agents/, agents.config.json without touching user data files.
- `CLAUDE.md.template` added for `scripts/install.sh` to create CLAUDE.md in target repos.
- **Blank gap above pv-chrome topbar (fixed Session 39):** `body { padding-top: 52px }` was for old `position: fixed` topbar. New `.pv-chrome` uses `position: sticky; top: 0` and creates its own flow space. Fix: `body { padding-top: 0 }`, `body.has-alert { padding-top: 40px }` (budget alert height only), `#sidebar { top: 40px }`, `#app-shell { min-height: 100vh }`.
