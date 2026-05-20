# Session 53 — Phase C First Read Consumer (EPIC-0038 Done)

**Date:** 2026-05-20
**Branch:** `claude/phase-c-entities`
**Complexity:** ◐ medium

## Summary

Shipped EPIC-0038 Phase C in full. C.1 added entity read APIs (BaseRepo + epic/story/AC repos wired into Repository). C.2 migrated the dashboard read path to use those APIs behind a `PV_DASHBOARD_VIA_REPO=1` feature flag. Parity gate verified: zero semantic diff between legacy and repo paths on production data. Default remains OFF — flag flip deferred to Phase C.5.

## What Shipped

### C.1 — Entity Read APIs (US-0230)

| File                                          | Description                                                               |
| --------------------------------------------- | ------------------------------------------------------------------------- |
| `tools/lib/repository/entities/base-repo.js`  | BaseRepo with `get(id)`, `list(filters)`, `_root` path placeholder        |
| `tools/lib/repository/entities/epic-repo.js`  | EpicRepo extending BaseRepo; list filter: `status`                        |
| `tools/lib/repository/entities/story-repo.js` | StoryRepo; list filters: `epicId`, `status`                               |
| `tools/lib/repository/entities/ac-repo.js`    | AcRepo; list filters: `storyId`, `status`                                 |
| `tools/lib/repository/index.js`               | Modified — wires entity repos as `repo.epics`, `repo.stories`, `repo.acs` |

### C.2 — Dashboard Repo Migration (US-0231, flag-guarded)

| File                                 | Description                                                                             |
| ------------------------------------ | --------------------------------------------------------------------------------------- |
| `tools/lib/dashboard-repo-reader.js` | `mergeRepoData(legacy, repo)` shim — overlays structural data on legacy computed fields |
| `tools/generate-plan.js`             | Modified — `PV_DASHBOARD_VIA_REPO=1` branch; second `indexAll` gated to flag-off        |

### New Tests

| File                                          | Tests                                                                     |
| --------------------------------------------- | ------------------------------------------------------------------------- |
| `tests/unit/repository/entities-read.test.js` | 4 unit tests — BaseRepo, EpicRepo, StoryRepo, AcRepo; status-array filter |
| `tests/integration/dashboard-parity.test.js`  | 4 integration tests — parity diff between legacy and repo paths           |

### Commits

| SHA       | Message                                                                              |
| --------- | ------------------------------------------------------------------------------------ |
| `6e2c88b` | [feat] US-0230: read APIs for stories, epics, ACs via base-repo                      |
| `7ee3bcf` | [test] US-0230: cover status-array filter; document BaseRepo.\_root                  |
| `d09f43a` | [feat] US-0231: dashboard reads epics/stories/acs via repository (flag-guarded)      |
| `baec131` | [refactor] US-0231: tighten repo shim — ?? for required fields, gate second indexAll |

## Hard Gate Result

Parity diff between `PV_DASHBOARD_VIA_REPO=0` (legacy) and `PV_DASHBOARD_VIA_REPO=1` (repo) paths on production data: **timestamps only**. Zero semantic diff. Hard gate: ✅ PASS.

## Test Results

- Full suite: **1352 tests, all pass**
- 8 new Phase C tests (4 unit + 4 integration), all pass
- Coverage: **87.68%** (≥80% gate ✅)

## Lessons (see docs/LESSONS.md)

- **L-0075** — Indexer prose-node gap: fenced-only scan misses ~31 entities in prose nodes
- **L-0076** — CHECK constraint rejects `Retired` status; `INSERT OR IGNORE` silently drops US-0049
- **L-0077** — `priority` field shape divergence: normalize at write time in the indexer
- **L-0078** — Snapshot side-effects: warm up legacy path twice before parity diff
- **L-0079** — Develop auto-version-bump: plan rebase before opening PR, not after

## Deferred Items

| Item                                   | Notes                                                                                                                                                                                                 |
| -------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **AC-0911** — flag default flip        | `PV_DASHBOARD_VIA_REPO=1` as default deferred to Phase C.5. AC annotated "(deferred to Phase C.5)" in RELEASE_PLAN.md.                                                                                |
| **Phase D blocker — prose-node gap**   | ~26 stories + ~5 epics live in prose AST nodes and never enter SQLite. Shim hides this; Phase D "delete legacy" change would surface ~31 missing entities. Widen indexer or enforce fenced placement. |
| **Phase D blocker — `Retired` status** | Schema CHECK only allows `To Do \| Planned \| In Progress \| Blocked \| Done`. Add `Retired` in Phase D schema migration. Add rejected-rows warning channel to `plan:lint`.                           |
| **Phase D blocker — `priority` shape** | Legacy: `"P0"`. Repo: `"High (P0)"`. Canonicalize at write time (indexer), never let two shapes coexist in the database.                                                                              |

## Next Session: Phase D — SdlcStatus Cutover (EPIC-0039)

Phase D promotes SQLite to authoritative for tool-emitted lifecycle state. `sdlc-status.json` becomes a per-event mirror. Four lifecycle writers migrate in one coordinated PR. Key stories: US-0232 (SdlcEventRepo + SdlcTaskRepo + re-query-inside-lock JSON mirror), US-0233 (agent-lifecycle.js write-through), US-0234 (update-sdlc-status.js write-through), US-0235 (agent-task-review.js + agent-spec-plan.js write-through), US-0236 (pv:upgrade / pv:rollback write-capable). Hard gate: `npm run plan:lint` 0 errors after migration 002 ingests existing JSON.
