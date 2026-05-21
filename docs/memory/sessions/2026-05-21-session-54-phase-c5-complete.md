# Session 54 — Phase C.5 Indexer Hardening (EPIC-0042 Done, AC-0911 Closed)

**Date:** 2026-05-21
**Branch:** `claude/phase-c5-impl`
**Complexity:** ◐ medium

## Summary

Shipped EPIC-0042 Phase C.5 in full, closing three indexer gaps captured as lessons in Session 53 (L-0075 prose-node scan, L-0076 silent CHECK rejections, L-0077 priority shape divergence). The release-plan indexer was migrated to delegate to `parseReleasePlan()` as the canonical extraction source, eliminating dual-extraction divergence. AC-0911 (the deferred `PV_DASHBOARD_VIA_REPO` default flip) was closed as C5.5, and the `planning_tasks` table was incidentally fixed to populate correctly from the parsed plan.

## What Shipped

| SHA       | Story   | Message                                                                                    | Files Touched                                                                      |
| --------- | ------- | ------------------------------------------------------------------------------------------ | ---------------------------------------------------------------------------------- |
| `36e520a` | US-0254 | [feat] US-0254: Migration 003 — widen epics+stories status CHECK to include Retired        | `tools/lib/repository/migrations/003_widen_status_check.sql`, migration runner     |
| `e0ed122` | US-0254 | [feat] US-0254: surface CHECK rejections as check-rejected warnings                        | `tools/lib/indexers/release-plan-indexer.js`, `tools/lib/warnings-channel.js`      |
| `34b54dc` | US-0254 | [chore] US-0254: explain the temporary PRIMARYKEY catch arm (removed in C5.3)              | `tools/lib/indexers/release-plan-indexer.js` (comment only)                        |
| `3e83366` | US-0253 | [feat] US-0253: indexer rewrite via parseReleasePlan() + planning_tasks populate           | `tools/lib/indexers/release-plan-indexer.js`, `tools/lib/parse-release-plan.js`    |
| `ebb7f43` | US-0253 | [fix] US-0253: parseReleasePlan handles alt-format epics; classify duplicate-ac as warning | `tools/lib/parse-release-plan.js`, `tools/lib/indexers/release-plan-indexer.js`    |
| `b82cce7` | US-0255 | [refactor] US-0255: priority normalised at write time; shim overlays from repo             | `tools/lib/indexers/release-plan-indexer.js`, `tools/lib/dashboard-repo-reader.js` |
| `dd9de5b` | AC-0911 | [feat] AC-0911: flip PV_DASHBOARD_VIA_REPO default to on                                   | `tools/generate-plan.js`                                                           |

## Hard Gate

Parity diff between default (repo path, `PV_DASHBOARD_VIA_REPO` on) and explicit `PV_DASHBOARD_VIA_REPO=0` (legacy escape hatch) on production `docs/RELEASE_PLAN.md`: **zero non-timestamp differences**. Hard gate: PASS.

## Tests

- Full suite: **1363 tests, all pass** (84 suites)
- Coverage: above 80% gate

## Findings Surfaced

`plan:lint` after the rewrite: `errors: 0, warnings: 14, reports: 0`. The 14 warnings are all `duplicate-ac` entries — pre-existing data drift in production `docs/RELEASE_PLAN.md` where AC-0150..AC-0153 and AC-0334..AC-0343 appear twice. These were previously silently swallowed by `INSERT OR IGNORE` (L-0076 class). The C.5 rewrite surfaced them; it did not cause them. Captured as **ENH-0004** for follow-up cleanup.

## Lessons Updated

- **[L-0075](../../LESSONS.md#l-0075)** — Resolution postscript added: indexer now delegates to `parseReleasePlan()`, dual-extraction divergence eliminated.
- **[L-0076](../../LESSONS.md#l-0076)** — Resolution postscript added: `INSERT OR IGNORE` replaced with explicit `INSERT`+`try/catch`; CHECK violations routed to warnings channel; Migration 003 widens epics+stories status CHECK.
- **[L-0077](../../LESSONS.md#l-0077)** — Resolution postscript added: priority normalized at write time via parseReleasePlan; shim priority-preference workaround removed.

## Deferred

| Item         | Notes                                                                                                                                                     |
| ------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **ENH-0003** | `bugs.status` CHECK constraint diverges from `BUGS.md` documented status conventions — latent L-0076 class. See `docs/ENHANCEMENTS.md`.                   |
| **ENH-0004** | 14 duplicate AC declarations in production `docs/RELEASE_PLAN.md` (AC-0150..0153, AC-0334..0343). Surfaced by C.5 `plan:lint`. Clean up when prioritized. |

## Next Session: Phase D — SdlcStatus Cutover (EPIC-0039)

Phase D promotes SQLite to authoritative for tool-emitted lifecycle state. `sdlc-status.json` becomes a per-event mirror. Four lifecycle writers migrate in one coordinated PR. See `docs/superpowers/plans/2026-05-19-step-1-repository-abstraction.md` Phase D section for the full plan. Dependency: EPIC-0042 (this session) is now Done.
