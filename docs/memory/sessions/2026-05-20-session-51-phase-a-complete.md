# Session 51 — Step 1 Phase A Complete (US-0219..US-0225, EPIC-0036 Done)

**Date:** 2026-05-20  
**Branch:** `claude/trusting-ptolemy-a305f1`  
**Complexity:** ◐ medium

## Summary

Completed the remaining 7 Phase A tasks (US-0219..US-0225) of the Step 1 Repository Abstraction. EPIC-0036 is now **Done**.

## What shipped

| Task | Story   | Commit            | Key deliverable                                       |
| ---- | ------- | ----------------- | ----------------------------------------------------- |
| A.5  | US-0219 | 16b6b30 + 04ddea9 | `index-datastore.js` — 3-tier SQLite fallback         |
| A.6  | US-0220 | b124aeb + 400afc4 | `schema.js` + SQL migrations 001 + 002                |
| A.7  | US-0221 | 89871c4           | `markdown-datastore.js` — readAst/sourceMeta/writeAst |
| A.8  | US-0222 | 9ea5a4f + 08df07d | validation, warnings-channel, refresh                 |
| A.9  | US-0223 | 71331d4           | Repository.getInstance singleton + dispatch prelude   |
| A.10 | US-0224 | d208d17           | pv-state, backup, migration runner                    |
| A.11 | US-0225 | d137576 + eb58ef3 | pv:check-upgrade + pv:doctor CLIs                     |

## Phase A hard gate result

All four checks PASSED:

- Round-trip: 5/5 production markdown files idempotent
- better-sqlite3 smoke: OK (darwin arm64)
- pv:check-upgrade + pv:doctor: exit 0, correct output
- Repository.getInstance: opens/refreshes/closes cleanly

## Key decisions and patterns

- **IndexDatastore pattern**: Three-tier `try/catch` fallback (better-sqlite3 → node:sqlite → noop). Explicit `mode` param for testing. WAL + `synchronous=NORMAL` + `foreign_keys=ON` on open.
- **Schema version gating**: `meta_status('schema_version')` integer. Each migration run inside `ds.transaction()`. Idempotent: applied migrations tracked by ID in pv-state, not re-run.
- **Two-state files**: `.pv-state.json` (committed — planvisualizerVersion + appliedMigrations) vs `.pv-state.local.json` (gitignored — lastUpgradeAt + lastUpgradeBy).
- **Dispatch prelude**: `orchestrator/spawn.js#spawnCommand` now calls `Repository.getInstance().refresh()` wrapped in try/catch — repository failures never crash the orchestrator.

## New lessons

- **L-0069**: Git worktrees silently pruned — always recreate from branch (branch survives prune).
- **L-0070**: `sourceMeta()` double-read race (stat then readFile) — derive size from buffer instead. Deferred to Phase E.

## What's next

Phase B (EPIC-0037): indexers as read-only spectators wired into `generate-plan.js`. Per-entity indexer functions for epics, stories, ACs with `source_file`/`source_line` provenance. `plan:lint` CLI.
