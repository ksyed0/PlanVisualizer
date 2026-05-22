# Session 57 — Phase D Complete (SdlcStatus Cutover, EPIC-0039 Done)

**Date:** 2026-05-21 / 2026-05-22
**Branch:** `claude/phase-d-impl`
**Complexity:** ● high

## Summary

Shipped Phase D end-to-end across one continuous session: all four lifecycle writers (`agent-lifecycle.js`, `update-sdlc-status.js`, `agent-task-review.js`, `agent-spec-plan.js`) now route through the D.1 entity repos; SQL is authoritative for SdlcStatus; `docs/sdlc-status.json` is a regenerated mirror under file lock on every write. Migration 005 ingests legacy JSON into SQL with post-ingest mirror-hash idempotency. `pv:upgrade` / `pv:rollback` provide write-capable, snapshot-backed forward and reverse paths. Cross-writer parity, SQL-as-source-of-truth across process restarts, and live-dashboard read parity all verified by integration test. **The kickoff prompt's hard gate is satisfied:** `grep -rn "fs.writeFileSync.*sdlc-status\|atomicReadModifyWriteJson.*sdlc-status" tools/ | grep -v test` returns empty.

8 stories (US-0232..US-0239) ship `Status: Done` with all ACs ticked; EPIC-0039 closed; AC-1013 (writers-throw / indexers-warn invariant) and AC-1014 (post-Phase-D indexer retirement) added mid-flight to encode architectural decisions discovered during execution.

Side quest: spec-salvage of the abandoned `chore/epic-0030-0035-enterprise-agentic-sdlc-plan` branch onto a clean `docs/enterprise-agentic-sdlc-spec` branch ([PR #1092](https://github.com/ksyed0/PlanVisualizer/pull/1092)) with a salvage-note header.

## What Shipped (Phase D)

| Task    | Story   | Commit(s)                         | Description                                                                                                                                               |
| ------- | ------- | --------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------- |
| D.1     | US-0232 | `bd31e12` / `69506b3`             | SdlcEventRepo / SdlcTaskRepo / SdlcProgrammeRepo + file-locked SQL→JSON `SdlcMirror`                                                                      |
| D.2     | US-0233 | `3a27373` / `90733fa`             | Migration 005 (JSON→SQLite ingest, idempotent via post-ingest mirror-hash); AC-1013                                                                       |
| pre     | —       | `b972b84`                         | Registry pre-allocation for parallel D.3 + D.4 dispatch                                                                                                   |
| D.3     | US-0234 | `4ca37ef` (+ merge `6d42396`)     | `agent-lifecycle.js` repo writes; SQL schema migration `005_sdlc_task_lifecycle_fields`                                                                   |
| D.4     | US-0235 | `5b310a2` (+ merge `5956339`)     | `update-sdlc-status.js` repo writes via `readState` / `writeState` bridge                                                                                 |
| D.5     | US-0236 | `9a56055`                         | `agent-task-review.js` repo writes; transitional-debt marker added in `sdlc-mirror.js`                                                                    |
| D.6     | US-0237 | `12b5c01` (refactor) / `08d1496`  | `agent-spec-plan.js` repo writes; shared bridge helpers extracted to `tools/lib/agent-cli-repo-helpers.js`; BUG-0183 idempotency guard preserved verbatim |
| D.7     | US-0238 | `d239b7c` / `fdd2803` / `decc96d` | Cross-writer parity + SQL-source-of-truth + dashboard live-read integration test                                                                          |
| D.8     | US-0239 | `6f6c67e` / `b0eb14e`             | `pv:upgrade` + `pv:rollback` CLIs; JSON-row snapshot format; 6 integration tests                                                                          |
| AC-1014 | US-0239 | `5f0c621`                         | Retire `sdlc-status-indexer.js` from the registry — closes circular ingest crash                                                                          |

**Final state:** `claude/phase-d-impl` at `5f0c621`, 16 commits ahead of develop, pushed.

## Hard Gates (end-of-Phase-D)

| Check                      | Result                                                                                                                   |
| -------------------------- | ------------------------------------------------------------------------------------------------------------------------ |
| `npm test`                 | 1441 / 1441 tests passing across 96 suites                                                                               |
| Coverage (statements)      | **88.20%** (from 87.95% baseline post-D.6, drifted up across the phase)                                                  |
| `npm run plan:lint`        | `0 / 0 / 0`                                                                                                              |
| `npm run lint`             | 0 errors / 43 pre-existing warnings                                                                                      |
| Hard-gate grep             | empty across `tools/` (excluding tests) for `fs.writeFileSync.*sdlc-status` and `atomicReadModifyWriteJson.*sdlc-status` |
| `pv:upgrade && pv:upgrade` | second run emits `no-op (already up to date, mirror matches SQL)`                                                        |
| `pv:upgrade && plan:index` | clean (was the AC-1014 crash)                                                                                            |

## Findings (encoded as lessons / ACs)

**AC-1013 — Writers throw, indexers warn.** Made explicit mid-flight under US-0232 after the D.2 agent observed the `createTryInsert` helper (EPIC-0043) was being conflated across read- and write-side. Indexers must swallow `SQLITE_CONSTRAINT_*` into a warnings channel; writers must propagate them as exceptions. Verified by a canary test in `sdlc-repos.test.js`.

**AC-1014 — `docs/sdlc-status.json` removed from indexer registry.** Surfaced by D.7's parity-test author and confirmed reproducible: after `pv:upgrade` creates the JSON mirror, any subsequent `plan:index` crashes at `sdlc-status-indexer.js:23` with `TypeError: object is not iterable` because D.3 reshaped `tasks` to an object-map while the indexer still iterates the legacy array shape. The hard-gate test suite missed it because `docs/sdlc-status.json` is gitignored — the file doesn't exist in the test tree, so the indexer short-circuits at the `existsSync` check. **Fix is retirement, not reshaping:** re-indexing the SQL-rendered mirror back into SQL is circular and contradicts Phase D's authoritative-SQLite claim.

**Post-ingest mirror hash (D.2 deviation, ratified).** The canonical plan stored a source-bytes hash for Migration 005's idempotency. That breaks under D.1's mirror-on-every-write design: by the time ingest finishes, the source file has been overwritten by the canonical mirror, so the next run can never match the stored source hash. D.2 stored the post-ingest mirror hash instead. AC-0917 text was edited in the same commit (`3a27373`) to match — that's plan debt correction, not retconning.

**Helper extraction at the rule of three.** D.3, D.4, D.5 each independently re-wrote near-identical legacy-bridge code (`seedTasksFromLegacyJson`, `readMirror`, `writeState`, `dispatchAsync` plumbing). D.6's brief required extraction into `tools/lib/agent-cli-repo-helpers.js` before the fourth copy could land. D.4's bridge was deliberately NOT pulled into the shared module — it operates at programme level via SQL state, structurally different from D.3/D.5/D.6's task-level file-bridge pattern. Forcing all four into one helper would have created a one-of-each abstraction.

**Two "Migration 005s."** This codebase now has two unrelated artifacts numbered Migration 005 in different directories: `tools/lib/repository/migrations/005_sdlc_task_lifecycle_fields.sql` (schema migration from D.3) and `tools/lib/migrations/005-ingest-sdlc-status.js` (data migration from D.2). D.7's agent looked in the SQL directory only and incorrectly reported `meta_status('migration_005_hash')` didn't exist. New lesson encoded.

**ID Registry can drift silently when a planning branch is abandoned mid-flight.** Pre-existing finding from the spec-salvage analysis: `ddb4a36` claimed EPIC-0030..0035, US-0187..0214, AC-0731..0852 but was never pushed; later sessions read the live registry and reassigned the same IDs to unrelated work. Encoded as L-0080.

## Transitional Debt (carried into Phase E)

Three knowingly-temporary scaffolds are in place and must be removed by Phase E's consumer-migration work:

1. **`sdlc-mirror.js:32-43`** — preservation of unknown top-level JSON keys so D.4's `programme.*` storage and any leftover legacy top-level keys can coexist without one writer wiping the other. D.5's transitional-debt comment documents the lifecycle.
2. **Dual-shape on disk** — the JSON mirror still surfaces legacy top-level keys (`agents`, `metrics`, `stories`, `epics`, …) alongside the canonical `{tasks, log, programme}` triple. Phase E's dashboard reader migration is the consumer of that consolidation.
3. **`sdlc-status-indexer.js` reference file** — retained but no longer in the registry (AC-1014). Slated for deletion in Phase E so the registry diff and the file deletion can land in the same PR.

## Side Quest — Spec Salvage

Salvaged `docs/architecture/enterprise-agentic-sdlc-spec-v2.md` (926 lines) verbatim from abandoned commit `ddb4a36` onto branch `docs/enterprise-agentic-sdlc-spec` with a header note explaining the dead ID claims. Lesson L-0080 ("ID Registry can drift silently when a planning branch is abandoned mid-flight") encoded alongside. [PR #1092](https://github.com/ksyed0/PlanVisualizer/pull/1092) open against develop, ready for review independent of Phase D.

## Next Session

**Phase E — Consumer Migration (TBD epic ID — claim from registry's next-available EPIC-0045+).** Scope tentatively:

- Migrate dashboard read path (`tools/generate-dashboard.js:~4137`, the 5-second `fetch('./sdlc-status.json')` poll) to read from the SQL-owned keys (`{tasks, log, programme}`) and accept the consolidated shape.
- Remove `sdlc-mirror.js:32-43` unknown-top-level-key preservation.
- Delete `sdlc-status-indexer.js` reference file.
- Delete legacy top-level keys (`agents`, `metrics`, `stories`, `epics`, `phases`, `cycles`, `currentPhase`, `githubStatus`, `project`) from `docs/sdlc-status.json` after their consumers migrate.
- Spec-revival follow-up: re-decompose `docs/architecture/enterprise-agentic-sdlc-spec-v2.md` into stories against then-current next-available IDs.
- Address the `docs/.pv-state.json` gitignore gap surfaced during the AC-1014 verification (state file created by `pv:upgrade` is not gitignored alongside `docs/sdlc-status.json` and `docs/.pv-state.local.json`).
