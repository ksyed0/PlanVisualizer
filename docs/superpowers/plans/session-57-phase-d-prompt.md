# Session 57 — Start Phase D: SdlcStatus Cutover (EPIC-0039)

## Context

Sessions 50–56 are complete:

- **Phase A** (EPIC-0036) — repository foundation, migrations 001–002
- **Phase B** (EPIC-0037) — indexers as spectators
- **Phase C** (EPIC-0038) — first read consumer (dashboard)
- **Phase C.5** (EPIC-0042) — indexer hardening (Migration 003, CHECK observability, parseReleasePlan canonical extractor, priority normalization, AC-0911 flag flip)
- **EPIC-0043** — post-C.5 hygiene (14 duplicate ACs renumbered, 3 duplicate bugs renumbered, Migration 004 widens bugs.status CHECK, shared `createTryInsert` helper, all 6 indexers swept)
- **EPIC-0044** — pre-Phase-D cleanup (orphaned blocks deleted, Migration 002→005 renumbered in plan doc and RELEASE_PLAN)

Develop tip is the squash-merge of PR #1088 (EPIC-0044) plus the auto version-bump PR #1089.

**`plan:lint` returns `0/0/0` on production data.** All known data drift resolved.

Phase D's migration is now correctly numbered **Migration 005** (was referenced as "Migration 002" in older drafts — fixed in PR #1088).

## Current State

- **Branch:** `develop` at HEAD (after PR #1088 + auto version-bump #1089)
- **Plan:** `docs/superpowers/plans/2026-05-19-step-1-repository-abstraction.md` §"Phase D" (D.1 through D.8)
- **Spec:** EPIC-0039 description in `docs/RELEASE_PLAN.md`
- **Registry next-available:** EPIC-0045, US-0259, AC-1013, BUG-0264
- **Stories already registered:** US-0232..US-0239 (8 stories under EPIC-0039) with `Status: To Do`
- **ACs already registered:** AC-0912..AC-0937 (26 ACs across those 8 stories)

## Phase D — SdlcStatus Cutover (SQLite-Authoritative)

**Hard gate:** all four sdlc-status writers (`agent-lifecycle.js`, `update-sdlc-status.js`, `agent-task-review.js`, `agent-spec-plan.js`) write via the repo only; `docs/sdlc-status.json` is generated from SQL on every event and byte-identical to legacy output for a fixture event stream; integration tests pass; dashboard live-update parity holds.

**Estimated effort:** 5–8 working days.

### Tasks D.1–D.8

| Task | Story   | Description                                                                              |
| ---- | ------- | ---------------------------------------------------------------------------------------- |
| D.1  | US-0232 | SdlcEventRepo, SdlcTaskRepo, SdlcProgrammeRepo (write side with file-locked JSON mirror) |
| D.2  | US-0233 | Migration 005 — JSON → SQLite ingest                                                     |
| D.3  | US-0234 | Migrate `tools/agent-lifecycle.js`                                                       |
| D.4  | US-0235 | Migrate `tools/update-sdlc-status.js`                                                    |
| D.5  | US-0236 | Migrate `tools/agent-task-review.js`                                                     |
| D.6  | US-0237 | Migrate `tools/agent-spec-plan.js`                                                       |
| D.7  | US-0238 | Live-dashboard parity test                                                               |
| D.8  | US-0239 | `pv:upgrade` and `pv:rollback` (write-capable)                                           |

## Instructions

1. Create a new worktree from `develop`:

   ```bash
   git worktree add .claude/worktrees/phase-d-impl -b claude/phase-d-impl origin/develop
   cd .claude/worktrees/phase-d-impl
   npm install
   ```

2. Read `docs/superpowers/plans/2026-05-19-step-1-repository-abstraction.md` from line ~4131 (start of Phase D) forward — that is the canonical plan with verbatim code for all 8 tasks.

3. Use `superpowers:subagent-driven-development` to execute. Same pattern as Phase C and EPIC-0043.

4. Honor the implementation order: **D.1 (entity repos) → D.2 (Migration 005) → D.3–D.6 (writer migrations) → D.7 (parity test) → D.8 (upgrade/rollback)**. D.3–D.6 can run in parallel after D.2 if subagent capacity allows; otherwise sequential is fine.

5. **Hard gate before merging:** verify all 4 lifecycle writers no longer call `fs.writeFileSync` on `sdlc-status.json`:

   ```bash
   grep -rn "fs.writeFileSync.*sdlc-status" tools/ | grep -v test
   ```

   This must return zero hits.

6. After all 8 stories ship, open PR `claude/phase-d-impl → develop`, run CI, merge.

7. Session close: tick ACs in RELEASE_PLAN; mark EPIC-0039 Done; note ENH-0001/ENH-0002 if relevant; new session memory file at `docs/memory/sessions/YYYY-MM-DD-session-57-phase-d-complete.md`.

## Critical Context (Gotchas)

- **SdlcMirror pattern:** writes go through SQL first, then re-query SQL inside the same file lock to regenerate `docs/sdlc-status.json`. The mirror is regenerated on every write, not patched incrementally — this guarantees byte-identical output across all writers.

- **Migration 005 idempotency:** ingests existing `docs/sdlc-status.json` at upgrade time. Idempotent via a hash of the source JSON stored in `meta_status('migration_005_hash')`.

- **Shared `createTryInsert` helper:** the 6 indexers all use `tools/lib/repository/insert-helper.js` (shipped in EPIC-0043). Any new Phase D indexer should use the same helper. Don't reinvent the pattern.

- **`parse-release-plan.js` survives:** do not rename or delete it. Phase E's plan will handle that.

- **Migration numbering:** `tools/lib/repository/migrations/` already contains 001, 002, 003, 004. Phase D's migration is 005.

## Session Close Checklist (After All 8 Stories Ship)

- [ ] `progress.md` updated
- [ ] `MEMORY.md` updated with Session 57 link prepended
- [ ] `PROMPT_LOG.md` updated with Session 57 block appended
- [ ] `docs/LESSONS.md` updated (any Phase D-specific lessons)
- [ ] `MIGRATION_LOG.md` updated — Phase D is a real migration with backup/restore considerations
- [ ] New session memory file at `docs/memory/sessions/YYYY-MM-DD-session-57-phase-d-complete.md`
- [ ] `docs/AI_COST_LOG.md` synced (commit before any branch-switch)
- [ ] Coverage ≥ 80%
- [ ] All US-0232..US-0239 statuses `Done` with ACs ticked
- [ ] EPIC-0039 marked `Done`
- [ ] PR merged to develop
