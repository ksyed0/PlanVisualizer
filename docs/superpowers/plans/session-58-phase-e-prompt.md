# Session 58 — Start Phase E: Consumer Migration & Cleanup (EPIC-0045)

## Context

Sessions 50–57 are complete. The repository-abstraction epic chain has shipped through Phase D (EPIC-0039): all four SdlcStatus writers route through the D.1 entity repos, SQL is authoritative, `docs/sdlc-status.json` is a regenerated mirror, and `pv:upgrade` / `pv:rollback` are live.

Develop tip is the squash-merge of [PR #1093](https://github.com/ksyed0/PlanVisualizer/pull/1093) (Phase D) plus [PR #1092](https://github.com/ksyed0/PlanVisualizer/pull/1092) (spec salvage) and follow-up bookkeeping.

`plan:lint` returns `0/0/0` and `npm run pv:upgrade && npm run plan:index` is clean.

## Current State

- **Branch:** `develop` at HEAD
- **Plan:** TBD — Phase E has no canonical plan yet. **Spec-drafting is the first deliverable.**
- **Registry next-available** (verify before claiming): EPIC-0045, US-0259, AC-1015, TASK-0066, BUG-0264, L-0083

## Phase E — Consumer Migration & Cleanup

**Hard gate:** all four of the following are removed or migrated, with regression tests proving the absence:

1. `tools/lib/repository/sdlc-mirror.js:32-43` — the "preserve unknown top-level JSON keys" scaffolding (added in D.5 to let D.4-owned legacy fields coexist with D.3-owned tasks pre-cutover).
2. `tools/lib/repository/indexers/sdlc-status-indexer.js` — retained as reference per AC-1014; delete entirely.
3. Dashboard reader (`tools/generate-dashboard.js:~4137`, the 5-second `fetch('./sdlc-status.json')` poll) reads only `{tasks, log, programme}`.
4. `docs/sdlc-status.json` contains exactly `{tasks, log, programme}` — verified by a post-`pv:upgrade` test that asserts `Object.keys(json).sort()` equals exactly `["log","programme","tasks"]`.

**Estimated effort:** 4–6 working days.

### Tasks E.1–E.8

| Task | Story   | Description                                                                                                                                 |
| ---- | ------- | ------------------------------------------------------------------------------------------------------------------------------------------- |
| E.1  | US-0xxx | Audit: build a dependency map of every consumer reading legacy top-level keys. Output a table in the spec                                   |
| E.2  | US-0xxx | Migrate dashboard reader to the consolidated `{tasks, log, programme}` shape                                                                |
| E.3  | US-0xxx | Migrate any non-dashboard consumers surfaced by E.1                                                                                         |
| E.4  | US-0xxx | Remove `sdlc-mirror.js:32-43` preservation block; add a regression test asserting the mirror emits only the canonical triple                |
| E.5  | US-0xxx | Delete `sdlc-status-indexer.js` (verify no remaining require sites first)                                                                   |
| E.6  | US-0xxx | Migration 006: one-time on-disk cleanup of legacy top-level keys (idempotent via post-cleanup hash; integrates with `pv:upgrade` snapshots) |
| E.7  | US-0xxx | Rename one of the two "Migration 005" files (L-0081) — e.g. `data_005-ingest-sdlc-status.js`                                                |
| E.8  | US-0xxx | Gitignore `docs/.pv-state.json`; audit `pv:upgrade` / `pv:rollback` for other escaping runtime artifacts                                    |

## Instructions

1. Create a worktree from develop:

   ```bash
   git worktree add .claude/worktrees/phase-e-impl -b claude/phase-e-impl origin/develop
   cd .claude/worktrees/phase-e-impl
   npm install
   ```

2. Read in order:
   - `AGENTS.md` (full file)
   - `CLAUDE.md`
   - `docs/memory/sessions/2026-05-22-session-57-phase-d-complete.md` — Phase D close-out; the "Transitional Debt" section names what Phase E inherits
   - `MIGRATION_LOG.md` 2026-05-22 block — contracts Phase E must respect
   - `docs/LESSONS.md` L-0075..L-0082 (especially L-0080, L-0081, L-0082)
   - `tools/lib/repository/sdlc-mirror.js:32-43` (the comment AND the code)

3. **Spec-first.** Use `superpowers:brainstorming`, then draft `docs/superpowers/specs/YYYY-MM-DD-phase-e-consumer-migration-design.md`. The spec must include:
   - The completed E.1 audit table (not a placeholder)
   - Per-legacy-key mapping (each of `agents`, `metrics`, `stories`, `epics`, `phases`, `cycles`, `currentPhase`, `githubStatus`, `project` → either consolidated triple / different entity / dead state)
   - Migration 006 design (idempotency strategy, snapshot integration, rollback safety)
   - Test plan covering the four hard-gate items
   - Risk register (minimum: missed consumer breaking the dashboard; mirror divergence during the brief window between E.4 landing and any remaining downstream reader migrating)

4. Open the spec as a docs-only PR (`docs/phase-e-spec → develop`). **Do not start implementation until the spec PR merges.**

5. Claim story IDs from `docs/ID_REGISTRY.md` (verify next-available first), commit the registry bump, push immediately (L-0080).

6. Execute via `superpowers:subagent-driven-development`. Sequential for E.1 → E.2/E.3 → E.4/E.5/E.6 (these share the mirror / its consumers). E.7 and E.8 can run in parallel with each other and with anything after E.1.

7. **End-of-Phase-E hard gates:**

   ```bash
   # Files removed
   test ! -f tools/lib/repository/indexers/sdlc-status-indexer.js
   ! grep -q "preserve any extra top-level keys" tools/lib/repository/sdlc-mirror.js

   # On-disk JSON has only the canonical triple
   npm run pv:upgrade && node -e "
     const k = Object.keys(JSON.parse(require('fs').readFileSync('docs/sdlc-status.json','utf8'))).sort();
     if (JSON.stringify(k) !== '[\"log\",\"programme\",\"tasks\"]') { console.error('FAIL:', k); process.exit(1); }
   "

   # Standard gates
   npm test && npm run plan:lint && npm run lint
   ```

8. Session close: update `progress.md`, append a consolidated Session 58 block at the top of `PROMPT_LOG.md` (one block, not per-subagent fragments), regenerate `MEMORY.md` via `node tools/generate-plan.js`, add a `MIGRATION_LOG.md` consumer-migration entry, write `docs/memory/sessions/YYYY-MM-DD-session-58-phase-e-complete.md`.

## Critical Context (Gotchas)

- **L-0082 trap.** `docs/sdlc-status.json` is gitignored. Any regression test that asserts "the file does not contain key X" must materialize the file in a test-owned temp root — never rely on the live repo file as a fixture.

- **AC-1014 retirement boundary.** Before deleting `sdlc-status-indexer.js`, run `grep -rn "indexSdlcStatusJson\|sdlc-status-indexer" tools/ tests/` and confirm zero hits.

- **D.4's bridge is structurally different** from D.3/D.5/D.6 (programme-level vs task-level). The E.1 audit must handle this asymmetrically — don't assume the four writers share a consumer interface.

- **Snapshot must capture before stripping.** Migration 006's `pv:upgrade` integration extends the existing snapshot to capture legacy keys before removal, so rollback can restore. Update `docs/architecture/pv-backup-format.md`.

- **L-0081 — two Migration 005s.** `tools/lib/repository/migrations/005_sdlc_task_lifecycle_fields.sql` (D.3 schema) and `tools/lib/migrations/005-ingest-sdlc-status.js` (D.2 data). E.7 renames one. Suggested: prefix the JS data migration as `data_005-*`.

## Session Close Checklist

- [ ] `progress.md` updated
- [ ] `MEMORY.md` regenerated via `node tools/generate-plan.js`
- [ ] `PROMPT_LOG.md` — Session 58 block appended at top
- [ ] `docs/LESSONS.md` — any Phase-E-specific lessons
- [ ] `MIGRATION_LOG.md` — Phase E consumer-migration entry
- [ ] `docs/memory/sessions/YYYY-MM-DD-session-58-phase-e-complete.md`
- [ ] `docs/AI_COST_LOG.md` synced before any branch-switch
- [ ] Coverage ≥ 80%
- [ ] All Phase E story statuses `Done` with ACs ticked
- [ ] EPIC-0045 marked `Done`
- [ ] PR merged to develop
