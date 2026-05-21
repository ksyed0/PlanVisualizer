# Phase C.5 — Indexer Hardening (Design Spec)

**Status:** Draft → ready for plan
**Date:** 2026-05-21
**Epic:** EPIC-0042
**Stories:** US-0253, US-0254, US-0255 (plus AC-0911 closure)
**Phase position:** Between Phase C (First Read Consumer, shipped) and Phase D (SdlcStatus Cutover, planned). Phase D depends on Phase C.5.

---

## 1. Goal

Close three silent-data-loss bugs the Phase C parity gate surfaced ([L-0075](../../LESSONS.md), [L-0076](../../LESSONS.md), [L-0077](../../LESSONS.md)) so Phase D's SdlcStatus cutover begins with a complete, normalized SQLite baseline. Close the deferred [AC-0911](../../RELEASE_PLAN.md) (`PV_DASHBOARD_VIA_REPO=1` default flip). Incidentally fix the empty `planning_tasks` table.

**Hard gate for the PR:** the existing `tests/integration/dashboard-parity.test.js` run on production `docs/RELEASE_PLAN.md` shows zero "entities in legacy, not in repo" drops with `PV_DASHBOARD_VIA_REPO=1`. This is the same gate Phase C used, applied to the new code paths.

---

## 2. Approach summary

**One PR, four logical commits:**

1. **US-0254 — Migration 003 + CHECK-rejection observability.** Adds `Retired` to the `epics.status` and `stories.status` CHECK constraints via a table-rebuild migration (SQLite cannot ALTER a CHECK in place). Establishes the post-INSERT `try/catch` pattern that routes `SQLITE_CONSTRAINT_CHECK` violations to the existing `WarningsChannel`, increments a `rejectedRows` counter in the indexer's return value, and surfaces the count in `plan:lint`.

2. **US-0253 — Indexer rewrite as `parseReleasePlan()` shim.** Replaces `release-plan-indexer.js`'s bespoke AST extraction with a thin wrapper around the legacy regex parser (`tools/lib/parse-release-plan.js`). Adds pre-INSERT foreign-key validation for orphan-epic story references, wraps the DELETE+INSERT batch in a SQLite transaction, calls `WarningsChannel.truncate()` at the start of each run, and starts populating `planning_tasks` (currently empty since Phase B shipped).

3. **US-0255 — Priority normalization closure + shim cleanup.** Verifies the indexer now writes normalized `priority` values (the side-effect of US-0253 calling `parseReleasePlan()`, which already normalizes). Removes the `dashboard-repo-reader.js` shim's `priority`-fallback branch. Updates `tests/integration/dashboard-parity.test.js` to drop the "semantic gap" assertions that are no longer valid.

4. **AC-0911 closure.** Flips `PV_DASHBOARD_VIA_REPO` default to on (`!== '0'`) in `tools/generate-plan.js`. Updates the post-render `indexAll()` gate condition (currently `!== '1'`, becomes `=== '0'`) so the post-render indexer only runs in explicit legacy mode and the no-double-index property from Phase C survives. Adds a postscript to the Phase C session memory file noting the flip happened.

**Phase B invariant trade-off (called out explicitly):** Phase B's "Indexer as Spectator" design intended the indexer to own entity extraction independently of the legacy parser. Phase C surfaced that this duplicated extraction created two divergent code paths (the L-0075 prose-node gap and the L-0077 priority-shape gap). C.5 collapses the divergence by making `parseReleasePlan()` the canonical entity extractor. The indexer remains the SQLite writer; it just delegates parsing. **`tools/lib/parse-release-plan.js` is therefore no longer "legacy" — it survives Phase E.** Phase E should rename and relocate it to `tools/lib/repository/parsers/release-plan-parser.js` so the filename matches its role, but does NOT delete it.

---

## 3. Story partition (definitive)

| Story       | Owns                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                 |
| ----------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| **US-0254** | Migration 003 (adds `Retired` to epics+stories status CHECK) · `try/catch` around each INSERT routing `SQLITE_CONSTRAINT_CHECK` to `WarningsChannel` with `{code:'CHECK_REJECTED', entity, id, reason, sqlite}` · `rejectedRows` field added to indexer return value · `plan:lint` reads `WarningsChannel` and prints `CHECK rejections: N` line plus up to 10 detail lines when N > 0                                                                                                                                                                                                                                                                                                                                                                                               |
| **US-0253** | Replaces `release-plan-indexer.js` body with `parseReleasePlan(markdown)` → INSERT loops · Pre-INSERT FK validation: builds Set of parsed epic IDs, skips+warns any story with `epicId` not in the set (`code:'FK_ORPHAN'`) · Wraps DELETE+INSERT batch in `db.transaction(() => {...})` so mid-run crash leaves DB in pre-run state · Calls `warningsChannel.truncate()` at start of each `indexAll()` so stale rejections from prior runs don't leak into the current count · Starts INSERTing into `planning_tasks` (was DELETEd every run, never repopulated) · Passes `source_line` as `NULL` (parser doesn't track it; no consumer reads it; removal candidate in Phase E) · Deletes the bespoke `splitEntitySections()` helper and AST traversal in `release-plan-indexer.js` |
| **US-0255** | New unit test: `Priority: High (P0)` in markdown → SQLite stores `'P0'` · New unit test at the read API: `repo.stories.get(id).priority === 'P0'` · `dashboard-repo-reader.js`: removes the `priority` field from the shim's overlay logic (the indexer now provides normalized values) · `tests/integration/dashboard-parity.test.js`: updates two priority-related comments and removes the "legacy preserved (semantic gap)" assertion                                                                                                                                                                                                                                                                                                                                            |
| **AC-0911** | `tools/generate-plan.js` line ~222: `PV_DASHBOARD_VIA_REPO === '1'` becomes `PV_DASHBOARD_VIA_REPO !== '0'` · `tools/generate-plan.js` line ~470 (post-render gate): `PV_DASHBOARD_VIA_REPO !== '1'` becomes `PV_DASHBOARD_VIA_REPO === '0'` · `docs/memory/sessions/2026-05-20-session-53-phase-c-complete.md`: add a postscript "Update 2026-05-21: AC-0911 flag default flipped to on as part of C.5 (commit `<sha>`)."                                                                                                                                                                                                                                                                                                                                                           |

---

## 4. Architecture changes

### 4.1 Files created (3)

| Path                                                                  | Purpose                                                                                                                                                                                                                                                                                                                                                                       |
| --------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `tools/lib/repository/migrations/003_widen_status_check.sql`          | Table-rebuild migration adding `Retired` to `epics.status` and `stories.status` CHECK constraints. Uses `PRAGMA foreign_keys = OFF` → create `_new` table with widened CHECK → `INSERT INTO _new SELECT * FROM original` → `DROP TABLE original` → `ALTER TABLE _new RENAME TO original` → recreate `idx_stories_epic_status` → `PRAGMA foreign_keys = ON`. ~30 lines of SQL. |
| `tests/unit/repository/migrations/003-widen-status-check.test.js`     | Verifies migration applies cleanly, is idempotent on re-run (hash check), preserves all existing rows, accepts `Retired` post-migration, still rejects unknown values.                                                                                                                                                                                                        |
| `tests/unit/repository/indexers/release-plan-indexer-rewrite.test.js` | Verifies prose-node entities land in SQLite, CHECK-rejection routes to WarningsChannel, FK-orphan story skipped with WarningsChannel entry, WarningsChannel truncated at start, transaction rollback on mid-batch crash, `planning_tasks` populated.                                                                                                                          |

### 4.2 Files modified (5)

| Path                                                    | Net change                                                                                                                                                                                                                |
| ------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `tools/lib/repository/indexers/release-plan-indexer.js` | -90 / +50 lines. Deletes `splitEntitySections()` and the AST traversal. New body: `const {epics, stories, tasks} = parseReleasePlan(markdown)`; FK Set; transactional DELETE+INSERT loops with try/catch on each INSERT.  |
| `tools/lib/parse-release-plan.js`                       | Top-of-file comment added: "Used by both the dashboard read path (`generate-plan.js`) AND the SQLite indexer (`release-plan-indexer.js`). Survives Phase E; rename to `release-plan-parser.js` then." No behavior change. |
| `tools/plan-lint.js`                                    | Reads `WarningsChannel`, filters entries by `code === 'CHECK_REJECTED'`, prints summary count and up to 10 detail lines. Adds to the existing `errors / warnings / reports` summary.                                      |
| `tools/lib/dashboard-repo-reader.js`                    | Removes the `priority` field from the story merge overlay. Net: -1 line.                                                                                                                                                  |
| `tools/generate-plan.js`                                | Two-line change: flag default flip + post-render gate condition flip.                                                                                                                                                     |

### 4.3 Files NOT touched (out of scope)

- Other 5 indexers (`bugs-indexer.js`, `lessons-indexer.js`, `id-registry-indexer.js`, `sdlc-status-indexer.js`, `test-cases-indexer.js`) — no surfaced bugs; YAGNI.
- `tools/lib/parse-release-plan.js` rename → deferred to Phase E.
- `bugs.status` CHECK divergence — captured separately as **ENH-0003** (to be filed before this PR opens). See §7.

---

## 5. Data flow & error handling

### 5.1 Indexer data flow (post-rewrite)

```
docs/RELEASE_PLAN.md
       │
       ▼
parseReleasePlan(markdown)       — single source of truth (also used by legacy reader)
       │
       ▼
{ epics: [...], stories: [...], tasks: [...] }
       │  • priority already normalized ("High (P0)" → "P0") by parseReleasePlan
       │  • per-story acs[] nested
       │  • no source_line tracking (passed as NULL on insert)
       ▼
release-plan-indexer.js: indexReleasePlan({ index, markdown, warningsChannel })
       │
       │  1. warningsChannel.truncate()  ← clear stale rejections from prior runs
       │  2. db.transaction(() => {       ← atomic batch; rollback on rethrown error
       │       DELETE FROM epic_dependencies, story_dependencies, acs,
       │                   planning_tasks, stories, epics;
       │       const epicIds = new Set(epics.map(e => e.id));   ← FK validation set
       │       for (const e of epics)   { try INSERT ... catch CHECK → warnings }
       │       for (const s of stories) {
       │         if (!epicIds.has(s.epicId)) { warnings.append({code:'FK_ORPHAN', ...}); continue; }
       │         try INSERT ... catch CHECK → warnings
       │         for (const ac of s.acs) try INSERT ... catch CHECK → warnings
       │       }
       │       for (const t of tasks)   { try INSERT ... catch CHECK → warnings }
       │     });
       │  3. return { counts: {epics, stories, acs, tasks}, rejectedRows: N }
       ▼
generate-plan.js: logs counts + rejectedRows
plan-lint.js: surfaces rejections from WarningsChannel
```

### 5.2 Error class routing

| Error                                                 | Route                                                                                                                                       | Effect                                                                                                                   |
| ----------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------ |
| `SQLITE_CONSTRAINT_CHECK` (status not in allowed set) | `warningsChannel.append({code:'CHECK_REJECTED', entity, id, reason: 'status "X" not in allowed set', sqlite: e.message})`; `rejectedRows++` | Row skipped; plan:lint surfaces it                                                                                       |
| FK orphan (story.epicId not in epics Set, pre-INSERT) | `warningsChannel.append({code:'FK_ORPHAN', entity:'story', id, reason: 'epicId "EPIC-XXXX" not found in document'})`; `rejectedRows++`      | Row skipped; plan:lint surfaces it                                                                                       |
| `SQLITE_CONSTRAINT_PRIMARYKEY`                        | Re-throw                                                                                                                                    | Should be impossible (DELETE precedes INSERT); fail fast if it happens                                                   |
| Any other error during transaction                    | Re-throw → transaction rolls back                                                                                                           | DB returns to pre-`indexAll` state; outer caller in `generate-plan.js` catches (existing behavior) and logs as non-fatal |
| Migration 003 SQL failure                             | Throws up to `applySchemaMigrations`                                                                                                        | Existing pattern; user sees stack                                                                                        |
| `parseReleasePlan()` throws (malformed markdown)      | Existing `try/catch` in `generate-plan.js` around `indexAll()`                                                                              | Non-fatal warning; legacy path still runs                                                                                |
| `WarningsChannel.append()` I/O failure                | Best-effort; logs but doesn't abort                                                                                                         | Same as existing Phase A behavior                                                                                        |

### 5.3 Idempotency

- Migration 003 hash-checked by existing migrations runner; second run is a no-op.
- `indexAll()` is idempotent: `truncate() → DELETE → INSERT` produces the same final state regardless of prior state.
- `rejectedRows` counter is per-run (not cumulative); `WarningsChannel` file grows append-only between truncates.

---

## 6. Testing approach

**Categories:** unit (Jest) + integration (Jest). No perf, security, a11y, or e2e (same as Phases A–C).
**Coverage target:** ≥80% project gate (CI-enforced). New files expected at 90%+ given the deterministic data flow.

### 6.1 New test files (3)

| File                                                                  | Asserts                                                                                                                                                                                                                                                                                                                                                                                                                                                                                   |
| --------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `tests/unit/repository/migrations/003-widen-status-check.test.js`     | Migration applies to Migration-001/002 baseline; idempotent on re-run; existing rows preserved; `INSERT INTO epics(...status='Retired'...)` succeeds; `INSERT ...status='InvalidValue'` still throws `SQLITE_CONSTRAINT_CHECK`.                                                                                                                                                                                                                                                           |
| `tests/unit/repository/indexers/release-plan-indexer-rewrite.test.js` | Fixture with 2 fenced + 2 prose entities — all 4 indexed (regression guard for L-0075); CHECK-rejected row writes `code:'CHECK_REJECTED'` to WarningsChannel and increments `rejectedRows`; FK-orphan story writes `code:'FK_ORPHAN'` and is skipped; `warningsChannel.truncate()` invoked at start (prior-run entries don't leak); transaction rollback: injected error mid-batch aborts whole transaction, DB returns to pre-run state; `planning_tasks` populated with TASK-XXXX rows. |
| `tests/unit/plan-lint-rejection-surface.test.js`                      | `plan:lint` reads WarningsChannel; prints `CHECK rejections: N` when N > 0; lists up to 10 details; zero rejections produces no extra output (no noise).                                                                                                                                                                                                                                                                                                                                  |

### 6.2 Existing test files modified (2)

| File                                          | Change                                                                                                                                                                                                                                                                                                                                                                                       |
| --------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `tests/integration/dashboard-parity.test.js`  | Drop the `// legacy normalises ("P0"), repo doesn't — must come from legacy` comment (incorrect post-C.5). Drop the `expect(s.priority).toBe('P1'); // legacy preserved (semantic gap)` assertion in the mock-merge test case (no longer a semantic gap). Optionally add `expect(repoData.stories[0].priority).toBe('P0')` to verify the indexer-side normalization independent of the shim. |
| `tests/unit/repository/entities-read.test.js` | Add a test fixture with `Priority: High (P0)`; assert `repo.stories.get(id).priority === 'P0'`. Verifies normalization is visible at the read API, not just the write side.                                                                                                                                                                                                                  |

### 6.3 What is NOT tested (deliberate scope discipline)

- No perf tests for Migration 003 (dev data ~250 rows; not perf-sensitive).
- No tests for `WarningsChannel` concurrent-write race (Phase A's design accepts best-effort).
- No tests for the other 5 indexers (out of scope per YAGNI).
- No tests for the `PV_DASHBOARD_VIA_REPO=0` rollback path beyond the existing parity test.

### 6.4 Manual verification before merge

```bash
node tools/generate-plan.js > /dev/null && \
  cp docs/plan-status.html /tmp/before.html && \
  PV_DASHBOARD_VIA_REPO=0 node tools/generate-plan.js > /dev/null && \
  diff /tmp/before.html docs/plan-status.html | grep -v "T2[0-3]:\|2026-" | wc -l
```

After the flag flip, default (now repo path) vs explicit `=0` (legacy escape hatch) must produce identical output modulo timestamps. Captures any subtle regression the integration test misses on production data.

---

## 7. Audit deferrals (captured for follow-up)

**bugs.status CHECK divergence.** The bugs table CHECK allows `Open | In Progress | Fixed | Wontfix | Done`. The BUGS.md format-doc convention line lists `Open | In Progress | Fixed | Verified | Closed`. The schema and convention disagree on `Wontfix`/`Done` vs `Verified`/`Closed`. In practice today, the only actual bug status in BUGS.md is `Fixed` (allowed), so no rows are silently dropping right now. But future-written bugs using the convention values (`Verified`, `Closed`) would silently drop.

**Decision: do NOT fix in C.5.** Separate problem class (schema-vs-convention drift, not parsing-vs-indexing drift). No live data loss today. Captured as **ENH-0003** (to be filed before this PR opens; placeholder ID reserved against current registry tip `ENH-0003`).

---

## 8. Risks and mitigations

| Risk                                                                                                                                                   | Mitigation                                                                                                                                                               |
| ------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Indexer rewrite changes a `source_line` value something secretly depended on                                                                           | Audit done: only the entity repos themselves echo it. No consumer. Plan-doc note explains.                                                                               |
| Transaction wrapping changes behavior on partial failure                                                                                               | Existing test suite (1352 tests) passes pre/post; new test specifically asserts rollback semantics.                                                                      |
| Flag flip surfaces a parity bug in production data the test fixtures don't catch                                                                       | Manual diff step (§6.4) on real `docs/RELEASE_PLAN.md` before merge; CI runs the integration parity test on every PR. `PV_DASHBOARD_VIA_REPO=0` remains as escape hatch. |
| `WarningsChannel.truncate()` discards in-flight warnings from concurrent processes                                                                     | Phase A's design accepts best-effort; `indexAll` is not expected to run concurrent with itself. If concurrent runs become a Phase D concern, add a lock at that time.    |
| `parseReleasePlan()` survives Phase E means its tests survive too — but they currently live in `tests/unit/parse-release-plan.test.js` (legacy naming) | Rename when the function is relocated in Phase E; not a C.5 concern.                                                                                                     |

---

## 9. Out of scope (explicitly)

- The other 5 indexers (`bugs-indexer.js`, `lessons-indexer.js`, `id-registry-indexer.js`, `sdlc-status-indexer.js`, `test-cases-indexer.js`)
- Rename `tools/lib/parse-release-plan.js` → `tools/lib/repository/parsers/release-plan-parser.js` (Phase E)
- bugs.status CHECK divergence (→ ENH-0003)
- Performance testing on large indexes
- Security or accessibility testing
- WarningsChannel concurrency lock
- Removal of `source_line` column from schema (Phase E candidate)

---

## 10. Phase D dependency

This spec corresponds to **EPIC-0042**, which is a new dependency of **EPIC-0039** (Phase D — SdlcStatus Cutover). The dependency was recorded in [RELEASE_PLAN.md](../../RELEASE_PLAN.md) when EPIC-0042 was queued (PR #1076).

The existing Phase D implementation plan in [`docs/superpowers/plans/2026-05-19-step-1-repository-abstraction.md`](../plans/2026-05-19-step-1-repository-abstraction.md) was written before Phase C surfaced these indexer gaps. A dependency callout at the top of the Phase D section pointing to EPIC-0042 and this spec is included alongside this design doc in the same PR. The note prevents someone from starting D.1 against a partial index.

---

## 11. Sequencing summary (for the implementation plan)

All work below lands in a single PR. The session-close artefacts (step 7) are committed at the end of the session that ships C.5, per the standard checklist in `CLAUDE.md`.

```
1. US-0254 commit  → Migration 003 + CHECK-catch infrastructure + plan:lint surface
2. US-0253 commit  → Indexer rewrite as parseReleasePlan shim + FK + transaction + truncate + planning_tasks
3. US-0255 commit  → Priority test + shim cleanup + parity-test updates
4. AC-0911 commit  → Flag default flip + post-render gate update + session memory postscript
5. ENH-0003 entry  → docs/ENHANCEMENTS.md appended + ID_REGISTRY.md bumped (bugs.status divergence follow-up)
6. Phase D note    → already committed alongside this spec doc; verify still present at PR open
7. Session close   → progress.md, MEMORY.md, PROMPT_LOG.md, session memory file, LESSONS.md update
                     (L-0075/L-0076/L-0077 "Prevention" sections updated to reflect actual resolution path —
                      e.g. L-0075 prevention becomes "unify on parseReleasePlan(), eliminating the dual-extraction
                      divergence" rather than the original "widen the indexer to scan prose nodes")
```

End of spec.
