# Session 55 — Post-C.5 Indexer Hygiene (EPIC-0043 Done, ENH-0003/0004 resolved)

**Date:** 2026-05-21
**Branch:** `claude/post-c5-hygiene-impl`
**Complexity:** ◐ medium

## Summary

Shipped EPIC-0043 in full, closing ENH-0003 (indexer sweep + Migration 004 widening `bugs.status` CHECK) and ENH-0004 (ID-collision cleanup in production markdown). The items flagged as "duplicates" by `plan:lint` turned out to be distinct entities sharing IDs — the resolution was renumber-not-delete, with 17 new IDs allocated (AC-0996..AC-1009, BUG-0261..0263) and zero data lost. `plan:lint` now returns `0/0/0` and all 1372 tests pass, unblocking Phase D.

## What Shipped

| SHA       | Story   | Message                                                                         | Files Touched                                                                                                                                                   |
| --------- | ------- | ------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `fde0372` | US-0257 | [fix] US-0257: resolve 14 duplicate AC declarations in RELEASE_PLAN.md          | `docs/RELEASE_PLAN.md` (AC IDs renumbered), `docs/TEST_CASES.md` (16 TC cross-refs updated)                                                                     |
| `c70a59b` | US-0257 | [fix] US-0257: resolve 3 duplicate BUG declarations + update BUGS.md format-doc | `docs/BUGS.md` (BUG IDs renumbered + format-doc status set updated)                                                                                             |
| `8d56849` | US-0256 | [feat] US-0256: Migration 004 widens bugs.status CHECK + shared insert-helper   | `tools/lib/repository/migrations/004_widen_bugs_status.sql`, `tools/lib/repository/insert-helper.js`, helper unit tests                                         |
| `190035c` | US-0256 | [feat] US-0256: sweep all indexers via shared insert-helper                     | All 6 indexers: `release-plan-indexer.js`, `bugs-indexer.js`, `lessons-indexer.js`, `test-cases-indexer.js`, `id-registry-indexer.js`, `sdlc-status-indexer.js` |
| (this)    | docs    | docs: Session 55 close — Post-C.5 hygiene complete (EPIC-0043, ENH-0003/0004)   | `docs/RELEASE_PLAN.md`, `docs/ENHANCEMENTS.md`, `MEMORY.md`, `PROMPT_LOG.md`, `progress.md`, this session file                                                  |

## Key Finding

The 14 ACs and 3 BUGs flagged as "duplicates" by `plan:lint` were **distinct entities sharing IDs**, not redundant data. The likely cause: bulk copy-paste during past story migrations where AC/BUG blocks were duplicated without renumbering. The initial plan called for "diff-each-pair, delete the lesser duplicate" — but diffing revealed both members of each pair contained unique content. The approach evolved to **renumber-rather-than-delete**: every second occurrence was assigned a fresh ID from the registry.

Net effect:

- 14 new AC IDs allocated: AC-0996..AC-1009
- 3 new BUG IDs allocated: BUG-0261, BUG-0262, BUG-0263
- 16 TC cross-references in `TEST_CASES.md` updated to point to new AC IDs
- Zero data lost

## Hard Gate

- `plan:lint`: **errors: 0, warnings: 0, reports: 0** ✅
- Full test suite: **1372/1372 pass** ✅
- Coverage: above 80% gate ✅

## Findings Deferred

Two additional duplicate-content blocks were identified during Task 1 but NOT addressed:

1. **US-0083 AC-0262/0263 duplicate** — two AC declarations with identical text under US-0083. Not a `plan:lint` error today (different IDs). Flagged for follow-up.
2. **Orphaned planning block AC-0154..0164** — a block of ACs referencing a story that no longer exists in RELEASE_PLAN. Also not a `plan:lint` error. Flagged for follow-up.

These are content/structure issues, not ID collisions. Not blocking Phase D.

## Next Session: Phase D — SdlcStatus Cutover (EPIC-0039)

Phase D promotes SQLite to authoritative for tool-emitted lifecycle state. `sdlc-status.json` becomes a per-event mirror. Four lifecycle writers migrate in one coordinated PR. See `docs/superpowers/plans/2026-05-19-step-1-repository-abstraction.md` Phase D section for the full plan.

**Note:** The Phase D plan doc (`RELEASE_PLAN.md` EPIC-0039 description) refers to "Migration 002 ingests JSON" — that's now actually **Migration 005** post-this-PR (Migrations 003 and 004 shipped in C.5 and EPIC-0043 respectively). The migration numbering in the plan doc is stale and should be updated at the start of Phase D.
