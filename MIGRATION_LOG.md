# MIGRATION_LOG.md — Cross-Platform Change Log

Log every change that must propagate to other platforms, modules, or installations.

---

## 2026-05-22 — Session 57 (EPIC-0039 / Phase D — SdlcStatus Cutover to SQLite)

**SQLite is now authoritative for sdlc-status; `docs/sdlc-status.json` is a regenerated mirror (BREAKING for downstream consumers that wrote the JSON directly)**

- **What changed:** All four lifecycle writers (`tools/agent-lifecycle.js`, `tools/update-sdlc-status.js`, `tools/agent-task-review.js`, `tools/agent-spec-plan.js`) now route every state mutation through `SdlcEventRepo` / `SdlcTaskRepo` / `SdlcProgrammeRepo`. Direct `fs.writeFileSync` and `atomicReadModifyWriteJson` on `docs/sdlc-status.json` are forbidden — hard-gate grep enforces this. The JSON file is regenerated under file lock from SQL on every write via `SdlcMirror`.
- **Files:** `tools/agent-lifecycle.js`, `tools/update-sdlc-status.js`, `tools/agent-task-review.js`, `tools/agent-spec-plan.js`, `tools/lib/repository/sdlc-mirror.js`, `tools/lib/repository/entities/sdlc-{event,task,programme}-repo.js`, `tools/lib/agent-cli-repo-helpers.js`
- **Platforms/modules affected:** Any downstream agent or tool that writes `docs/sdlc-status.json` directly will overwrite SQL state. They must migrate to call the writer CLIs or import the repo entity classes.
- **PR:** Phase D PR (TBD #) — `claude/phase-d-impl → develop`

**Migration 005 — JSON → SQLite one-time ingest (idempotent via post-ingest mirror hash)**

- **What changed:** New data migration `tools/lib/migrations/005-ingest-sdlc-status.js` ingests an existing `docs/sdlc-status.json` into SQL via the D.1 repos on first `pv:upgrade`. Idempotency uses `meta_status('migration_005_hash')` storing a sha256 of the **post-ingest mirror** (not the source bytes — a source-hash strategy is broken by the mirror-on-every-write design). A re-run with matching hash returns `{skipped: 'idempotent'}` with no duplicate rows.
- **Files:** `tools/lib/migrations/005-ingest-sdlc-status.js`, `tools/lib/repository/migrations/005_sdlc_task_lifecycle_fields.sql` (separate SQL schema migration from D.3 — note the two unrelated artifacts both numbered 005)
- **Platforms/modules affected:** Any project upgrading from a pre-Phase-D PlanVisualizer must run `npm run pv:upgrade` once. Snapshots land in `docs/.pv-backup/pre-upgrade-<timestamp>/`.
- **PR:** Phase D PR

**New CLIs: `pv:upgrade` and `pv:rollback` (write-capable, snapshot-backed)**

- **What changed:** `npm run pv:upgrade` runs pending migrations after taking a JSON-row snapshot of all three SQL tables + `meta_status` + the JSON mirror into `docs/.pv-backup/pre-upgrade-<timestamp>/`. `npm run pv:rollback --to <label>` restores the SQL tables, then rewrites the JSON mirror from SQL (not from the snapshotted JSON — SQL is the canonical re-render). `--dry-run` and refuse-to-clobber on uncommitted writes are both supported.
- **Files:** `tools/pv-upgrade.js`, `tools/pv-rollback.js`, `tools/lib/migrations/sdlc-snapshot.js`, `docs/architecture/pv-backup-format.md`, `package.json` (`pv:upgrade` / `pv:rollback` scripts)
- **Platforms/modules affected:** Adopting projects gain explicit upgrade/rollback ergonomics. The snapshot format (JSON rows, manifest-bearing) is documented at `docs/architecture/pv-backup-format.md`.
- **PR:** Phase D PR

**`sdlc-status-indexer.js` retired from the indexer registry (AC-1014)**

- **What changed:** `docs/sdlc-status.json` removed from the indexer `MAP` in `tools/lib/repository/indexers/index.js` and from `MANAGED_SOURCES` in `tools/lib/repository/index.js`. The indexer file itself is retained as a reference with a retirement comment; deletion deferred to Phase E so the registry diff and file deletion land together.
- **Platforms/modules affected:** Any downstream tool that called `indexAll()` against a post-pv:upgrade tree would have crashed (`TypeError: object is not iterable` against the post-D.3 object-shape `tasks` key). The crash is now removed; no migration required by downstream tools.
- **PR:** Phase D PR

**Writers throw, indexers warn (AC-1013)**

- **What changed:** The `createTryInsert` helper (EPIC-0043) is **reserved for indexer-side use**. All Phase D writers propagate `SQLITE_CONSTRAINT_*` errors as exceptions. Any downstream code that imports `createTryInsert` for a write path is doing the wrong thing — it will silently swallow constraint violations.
- **Files:** `tools/lib/repository/entities/sdlc-event-repo.js`, `sdlc-task-repo.js`, `sdlc-programme-repo.js`, `tools/lib/agent-cli-repo-helpers.js`
- **Platforms/modules affected:** Any future indexer or writer must follow the same contract. Documented in AC-1013.

---

## 2026-05-17 — Session 47 (US-0185 + US-0186)

**AGENTS.md §CI Pipeline table updated (cross-platform)**

- **What changed:** The "CI Pipeline" table was updated from 6 jobs to 8 checks. Added Secret Scanning (trufflehog) and CodeQL (Analyze JavaScript) rows. Added note that CodeQL is skipped on docs-only PRs (`*.md`, `docs/**`). Dependency Audit row updated to note "no install needed".
- **Files:** `AGENTS.md` (§CI Pipeline), `CLAUDE.md` (§Git Branching Quick Reference — branch-protection line)
- **Platforms/modules affected:** All AI agents reading `AGENTS.md` for CI guidance
- **PR:** #1048

**`.github/workflows/ci.yml` — CodeQL SAST job removed**

- **What changed:** Removed `codeql` job (duplicate of codeql.yml). Removed `npm ci` from Dependency Audit job.
- **Files:** `.github/workflows/ci.yml`, `.github/workflows/codeql.yml`
- **Platforms/modules affected:** All PRs to main/develop
- **PR:** #1046

**`tools/agent-lifecycle.js done` — `[sha:<commit>]` token now required**

- **What changed:** `markDone` now requires `--summary` to end with `[sha:<7-40 hex>]` or `[sha:none]`. Any agent dispatch workflow calling `agent-lifecycle.js done` must be updated.
- **Files:** `tools/lib/agent-lifecycle-state.js`, `tools/agent-lifecycle.js`, `docs/agents/BE_DEV_AGENT.md`, `docs/agents/FE_DEV_AGENT.md`, `docs/agents/DM_AGENT.md`
- **Platforms/modules affected:** Any agent calling `agent-lifecycle.js done` (Forge, any Conductor dispatch script)
- **PR:** #1048

---

## 2026-04-19 — docs/dashboard.html committed to repo (removed from .gitignore)

**Files changed:** `.gitignore`, `docs/dashboard.html` (now tracked)
**Platforms / modules affected:** Any project that cloned PlanVisualizer before this change and cached a `.gitignore` that excludes `docs/dashboard.html`.

**What changed:** `docs/dashboard.html` was previously gitignored (generated artifact). It is now committed to the repo so that `scripts/install.sh §7` can copy it to adopting projects. The file is still regenerated by `node tools/generate-dashboard.js` — the committed version serves as the distributable baseline.

**Action required for existing installs:** None — the dashboard is a client-side file fetched at runtime. Existing target projects that already have `docs/dashboard.html` are unaffected (install.sh §7 skips them via the idempotency guard).

**Action required for PlanVisualizer contributors:** If you previously had `docs/dashboard.html` in a local `.gitignore` override, remove that override so the committed file is visible.

---

## 2026-04-18 — EPIC-0019: sdlc-status.json schema updated (hackathon → project; phases array added)

**Files changed:** `tools/init-sdlc-status.js`, `tools/update-sdlc-status.js`, `agents.config.json`
**Platforms / modules affected:** Any project that adopted the Agentic SDLC Dashboard before EPIC-0019.

**What changed:** The `hackathon` key in `sdlc-status.json` is replaced by a `project` block (`name`, `description`, `repoUrl`, `startDate`). A `phases` array (seeded from `agents.config.json`) replaces the hardcoded `PHASE_DEFS` constant. New top-level keys: `epics: {}`, `cycles: []`.

**Action required:** Re-run `node tools/init-sdlc-status.js --force` after adding `project` and `phases` to `agents.config.json`. See `docs/dashboard-extraction.md` for the full adoption guide.

---

## 2026-03-18 — Install script: AGENTS.md overwrite replaced by plan_visualizer.md

**Files changed:** `scripts/install.sh`, `README.md`, `plan_visualizer.md` (new)
**Platforms / modules affected:** All target projects that install or update PlanVisualizer via `scripts/install.sh`
**What changed:**

- `plan_visualizer.md` is now the canonical format reference for PlanVisualizer source files. It replaces the previous approach of copying the full PlanVisualizer `AGENTS.md` into the target project.
- `install.sh` no longer offers to overwrite `AGENTS.md`. It instead copies `plan_visualizer.md` and appends a mandatory reference section to the target's `AGENTS.md` (append-only, idempotent, creates a minimal `AGENTS.md` if none exists).
- README manual setup, install prompt, and update sections updated accordingly.

**Adaptations completed:** Done in PlanVisualizer repo.
**Adaptations still needed for existing installs:**

1. Copy `plan_visualizer.md` from the PlanVisualizer repo into the project root.
2. Append the following to `AGENTS.md` (if not already present):
   ```
   ## PlanVisualizer Format Requirements
   Read plan_visualizer.md for the exact document formats required for RELEASE_PLAN.md,
   TEST_CASES.md, BUGS.md, AI_COST_LOG.md, and progress.md.
   ```
3. The old `AGENTS-new.md` file (if it exists from a previous install) can be deleted.
4. Optionally remove the PlanVisualizer BLAST framework sections from `AGENTS.md` if they were previously merged in and you have your own operating standards.

---

## 2026-03-10 — Jest 29 → 30

**Files changed:** `package.json`, `package-lock.json`
**Platforms / modules affected:** All target projects that have installed PlanVisualizer via `scripts/install.sh`
**What changed:** `jest` devDependency version `29.7.0` → `30.x`
**Why:** Eliminates `inflight@1.0.6` and `glob@7` deprecation warnings from transitive dependencies.
**Adaptations completed:** Updated in PlanVisualizer repo.
**Adaptations still needed:** Target projects that ran `install.sh` before 2026-03-10 still have `jest@29` in their `package.json`. They should run `npm install jest@30 --save-dev` to update.

---

## 2026-03-10 — GitHub Pages deployment fix

**Files changed:** `.github/workflows/plan-visualizer.yml`, `docs/index.html` (new)
**Platforms / modules affected:** PlanVisualizer repo GitHub Pages deployment only
**What changed:**

1. Removed the "Commit generated files" step from plan-visualizer.yml — `peaceiris/actions-gh-pages` deploys directly from the `./docs` filesystem; a commit-back step was never needed and failed because `plan-status.html` is gitignored.
2. Created `docs/index.html` with a `<meta http-equiv="refresh">` redirect to `plan-status.html` so GitHub Pages serves the dashboard instead of README.md.
3. Added `workflow_dispatch:` trigger so the workflow can be manually triggered when changes don't touch the `paths:` filter.
   **Adaptations completed:** Done. Workflow re-triggered manually; dashboard now deploys correctly.
   **Adaptations still needed:** None.

---

## 2026-03-10 — plan-visualizer.config.json outputDir case fix

**Files changed:** `plan-visualizer.config.json`
**Platforms / modules affected:** PlanVisualizer repo GitHub Pages deployment only
**What changed:** `docs.outputDir` changed from `"docs"` → `"docs"` to match the lowercase `docs/` directory and the workflow's `publish_dir: ./docs`.
**Why:** On macOS the filesystem is case-insensitive so `docs/` and `docs/` resolve identically. On Linux (GitHub Actions) they are separate directories — the generator wrote `plan-status.html` to `docs/` but the deploy action read from `docs/`, so the file was never deployed and the Pages site returned 404.
**Adaptations completed:** Done. Re-triggered workflow confirmed `plan-status.html` now appears in gh-pages branch.
**Adaptations still needed:** Any target project using `install.sh` that added `outputDir: "docs"` to their config should verify it matches `"docs"`.

---

## 2026-03-10 — plan-visualizer.config.json committed to this repo

**Files changed:** `.gitignore` (removal of `plan-visualizer.config.json` entry), new `plan-visualizer.config.json`
**Platforms / modules affected:** PlanVisualizer repo only — does not affect target project installations (their .gitignore is set up separately by install.sh)
**What changed:** Config file now tracked in PlanVisualizer's own repo for self-documentation and plan-visualizer.yml workflow
**Adaptations completed:** Done.
**Adaptations still needed:** None.

## 2026-04-16 — EPIC-0016 Agentic Dashboard Mission Control Redesign (14 stories + 7 interrupt BUGs)

**Files changed:**

- `tools/generate-dashboard.js` — full architectural rewrite: live fetch-and-patch replaces 30s reload, 6-phase pipeline timeline, differentiated metric cards, redesigned spotlight + stations, terminal activity log, 3-zone header, singleton AudioContext, BLOCKED border + incident ticker, agent portraits wired, 2-column About modal
- `tools/lib/theme.js` — NEW shared module with BADGE_TONE + badge() (extracted from render-html.js)
- `tools/lib/render-html.js` — now imports from theme.js (drift eliminated); Bugs tab matches Hierarchy visual
- `tests/unit/generate-dashboard.test.js` — NEW harness (6 baseline + parameterised tests per wave)
- `tests/unit/theme.test.js` — NEW, 13 assertions
- `agents.config.json` — added `avatar` field per agent, set `author: "Kamal Syed"`
- `docs/BUGS.md` — 7 bugs closed (BUG-0159 through BUG-0169)

**Platforms affected:**

- **GitHub Pages deploy**: `docs/sdlc-status.json` is gitignored — the deployed dashboard will show STALE ticker unless the Pages build step runs `npm run init:status` before deploy. Follow-up required.
- **Local dev**: opening `docs/dashboard.html` via `file://` protocol blocks the live fetch via CORS — recommend `npx serve docs/` or `python3 -m http.server` for local inspection.

**Cross-platform notes:**

- `tools/lib/theme.js` is the new single source of truth for semantic tone tokens. Any future generator (plan-status, dashboard, anything) must import badge/BADGE_TONE from here rather than inline.
- Google Fonts loaded: Departure Mono, Geist (US-0110), JetBrains Mono (US-0111). Stable across both light and dark themes.
- 27 optimized agent portraits in `docs/agents/images/optimized/` — referenced via `avatar` config key, not hardcoded paths.

**Follow-ups tracked (EPIC-0017 scope):**

- Test counts in sdlc-status.metrics remain stale (1861 from prior session). Derive from jest-summary during CI.
- Phases Complete / Reviews Approved cumulative — need cycle-reset when EPIC-0019 cycle-history lands.
- Harden `getElementById('agent-' + name)` for non-ASCII agent names (flagged by Lens US-0111 review).
