# Post-C.5 Indexer Hygiene (Design Spec)

**Status:** Draft → ready for plan
**Date:** 2026-05-21
**Epic:** EPIC-0043
**Stories:** US-0256 (ENH-0003), US-0257 (ENH-0004)
**Position:** Standalone follow-up to EPIC-0042 (Phase C.5). Closes ENH-0003 and ENH-0004 from `docs/ENHANCEMENTS.md`. Lands before Phase D (EPIC-0039) starts so D contributors begin with `plan:lint` at `0/0/0`.

---

## 1. Goal

Three concrete outcomes:

1. **`plan:lint` returns `errors: 0, warnings: 0, reports: 0`** on production data — currently `0/14/0` because of duplicate-AC declarations C.5 surfaced.
2. **All 5 remaining indexers** (`bugs`, `lessons`, `test-cases`, `id-registry`, `sdlc-status`) gain the same `INSERT OR IGNORE` → `INSERT` + `try/catch` observability that C.5 brought to `release-plan-indexer`. Silent drops in any indexer now surface as warnings.
3. **`bugs.status` CHECK widened** to a canonical set (`Open | In Progress | Fixed | Verified | WontFix | Closed`) matching an updated `BUGS.md` format-doc convention. Closes the schema-vs-convention divergence the C.5 audit found.

**Hard gate:** after both stories land, `npm run plan:lint` returns `errors: 0, warnings: 0, reports: 0`. Full test suite still green.

---

## 2. Approach summary

**One PR, two logical commits per story = 4 code commits + 1 docs commit = 5 total.**

1. **US-0256 part 1 — Migration 004 + shared `tryInsert` helper.** Table-rebuild migration for `bugs` adding `Verified` and `Closed`, renaming `Wontfix` → `WontFix` (no existing rows affected — audited). Extract the C5.2 `tryInsert` logic from `release-plan-indexer.js` into a shared helper at `tools/lib/repository/insert-helper.js`. Add a dedicated unit test for the helper.

2. **US-0256 part 2 — Sweep all 5 remaining indexers.** Each of `bugs-indexer.js`, `lessons-indexer.js`, `test-cases-indexer.js`, `id-registry-indexer.js`, `sdlc-status-indexer.js` swaps `INSERT OR IGNORE` for `INSERT` + the shared helper. Routes `SQLITE_CONSTRAINT_CHECK` → `check-rejected` warnings, `SQLITE_CONSTRAINT_PRIMARYKEY`/`UNIQUE` → `duplicate-id` warnings. Also refactors `release-plan-indexer.js` to import the shared helper instead of its inline copy from C5.2. Update `BUGS.md` format-doc convention line to include `WontFix`.

3. **US-0257 — Resolve duplicate IDs in production data.** Diff each pair of the 14 duplicate AC declarations (AC-0150..0153 in cluster 1, AC-0334..0343 in cluster 2) and the 3 duplicate BUG IDs (BUG-0098, BUG-0099, BUG-0100); keep the better occurrence; delete the loser. Hard gate `plan:lint` 0/0/0.

4. **Session close.** Tick ACs in RELEASE_PLAN, mark EPIC-0043 and stories Done, update ENH-0003 + ENH-0004 with "Resolved" postscripts, update the BUGS.md format-doc convention, prepend the session memory, append to PROMPT_LOG / progress.md.

**Net diff: 3 new files + 10 modified files. ~half a day of work.**

---

## 3. Story partition

| Story                  | Owns                                                                                                                                                                                                                                                                  |
| ---------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **US-0256** (ENH-0003) | Migration 004 (bugs.status CHECK widening) · `tools/lib/repository/insert-helper.js` (shared `createTryInsert`) · all 5 indexers sweep · `release-plan-indexer.js` refactored to use the shared helper · BUGS.md format-doc line updated · dedicated helper unit test |
| **US-0257** (ENH-0004) | 14 duplicate AC declarations resolved in `docs/RELEASE_PLAN.md` · 3 duplicate BUG declarations resolved in `docs/BUGS.md` (BUG-0098, BUG-0099, BUG-0100) · `plan:lint` returns `0/0/0`                                                                                |

---

## 4. Architecture changes

### 4.1 Files created (3)

| Path                                                        | Purpose                                                                                                                                                                                                                                                                                                                                                                                                                                                                |
| ----------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `tools/lib/repository/migrations/004_bugs_status_widen.sql` | Table-rebuild migration for `bugs` matching the C.5 Migration 003 pattern. New CHECK: `IN ('Open','In Progress','Fixed','Verified','WontFix','Closed')`. Bugs table has 5 columns (id, status, severity, source_file, source_line) — preserve all. No FKs from bugs to other tables; `bug_stories` (from Migration 002) references bugs.id but `PRAGMA foreign_keys = OFF` during the rebuild handles that. ~25 lines of SQL.                                          |
| `tools/lib/repository/insert-helper.js`                     | Exports `createTryInsert({warnings})` — factory that returns a `tryInsert(fn, entityId)` closure. Closure catches `SQLITE_CONSTRAINT_CHECK` (→ `check-rejected` warning), `SQLITE_CONSTRAINT_PRIMARYKEY`/`UNIQUE` (→ `duplicate-id` warning), and rethrows other errors. ~15 LOC. Lives in `repository/` (not `repository/indexers/`) so it's siblings with `file-lock.js`/`markdown-datastore.js` — `indexers/` stays a directory of per-source indexer modules only. |
| `tests/unit/repository/insert-helper.test.js`               | Dedicated unit test: 5 cases — (a) successful insert returns true, (b) `SQLITE_CONSTRAINT_CHECK` produces `check-rejected` warning + returns false, (c) `SQLITE_CONSTRAINT_PRIMARYKEY` produces `duplicate-id` warning + returns false, (d) `SQLITE_CONSTRAINT_UNIQUE` same, (e) other errors rethrow. Uses a tmpdir SQLite instance with a trivial CHECK constraint for the CHECK case.                                                                               |

### 4.2 Files modified (11)

| Path                                                             | Change                                                                                                                                                                                                                                                                                                                                                                                                                         |
| ---------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `tools/lib/repository/indexers/release-plan-indexer.js`          | Refactor: delete the inline `tryInsert` declaration added in C5.2; `require` the shared helper instead; call `createTryInsert({warnings})` once at the top of the transaction body. Net: −10 LOC, +2 LOC.                                                                                                                                                                                                                      |
| `tools/lib/repository/indexers/bugs-indexer.js`                  | `INSERT OR IGNORE` → `INSERT` + shared helper. Catches CHECK (bugs has the only CHECK left after Migration 004) AND duplicate IDs.                                                                                                                                                                                                                                                                                             |
| `tools/lib/repository/indexers/lessons-indexer.js`               | `INSERT OR IGNORE` → `INSERT` + shared helper. No CHECK on the lessons table; only `duplicate-id` warnings can fire.                                                                                                                                                                                                                                                                                                           |
| `tools/lib/repository/indexers/test-cases-indexer.js`            | Same pattern. No CHECK on test_cases.status.                                                                                                                                                                                                                                                                                                                                                                                   |
| `tools/lib/repository/indexers/id-registry-indexer.js`           | Same pattern.                                                                                                                                                                                                                                                                                                                                                                                                                  |
| `tools/lib/repository/indexers/sdlc-status-indexer.js`           | Same pattern. Note in commit: Phase D will replace this indexer when SQLite becomes authoritative for sdlc-status.                                                                                                                                                                                                                                                                                                             |
| `tests/unit/repository/migrations/004-bugs-status-widen.test.js` | NEW — mirrors C.5's `003-widen-status-check.test.js`. 4 cases: migration applies; existing rows preserved; new statuses accepted; unknown statuses still rejected.                                                                                                                                                                                                                                                             |
| `tests/unit/repository/indexers.test.js`                         | Likely needs minor updates if existing tests assert on indexer return shapes (warnings array grows with `check-rejected` / `duplicate-id` entries on fixtures with bad data — but production fixtures should be clean, so test assertions should pass without changes). Audit during implementation.                                                                                                                           |
| `docs/BUGS.md`                                                   | (a) Update the format-doc convention line from `Status: Open \| In Progress \| Fixed \| Verified \| Closed` to `Status: Open \| In Progress \| Fixed \| Verified \| WontFix \| Closed`. (b) Resolve the 3 duplicate BUG IDs: BUG-0098, BUG-0099, BUG-0100. For each: read both occurrences; pick the canonical one (likely the one with more complete fields or the later text if it represents refinement); delete the loser. |
| `docs/RELEASE_PLAN.md`                                           | Resolve the 14 duplicate AC declarations: AC-0150, AC-0151, AC-0152, AC-0153 (cluster 1, near US-? lookup during implementation) and AC-0334, AC-0335, AC-0336, AC-0337, AC-0338, AC-0339, AC-0340, AC-0341, AC-0342, AC-0343 (cluster 2). Same diff-each-pair process.                                                                                                                                                        |
| `tools/lib/repository/validation.js`                             | No change. `check-rejected` and `duplicate-id` rules already registered from C.5 and pre-existing schemas.                                                                                                                                                                                                                                                                                                                     |

### 4.3 Out of scope

- The other validators (`tools/lib/repository/validators/*`) — separate concern, no surfaced issues.
- The dashboard read path (`tools/lib/dashboard-repo-reader.js`) — no behavior change needed.
- Phase D plan doc renumbering. The current plan doc text says "Migration 002 ingests existing JSON"; the actual number when Phase D ships will be 005 (after C.5's 003 and this PR's 004). Capture as a finding for the Phase D start session — do NOT preemptively renumber here.

---

## 5. Data flow & error handling

### 5.1 Indexer call pattern (all 5 swept indexers)

```
markdown.readAst(rel) / parseReleasePlan(raw)
   │
   ▼
{ epics?, stories?, acs?, tasks?, bugs?, lessons?, test_cases?, ... }   ← whatever the indexer's source returns
   │
   ▼
index.transaction(() => {
  DELETE FROM <tables>;
  const tryInsert = createTryInsert({ warnings });   ← from shared helper
  for (entity of entities) {
    if (tryInsert(() => insStmt.run(entity.fields...), entity.id)) {
      counts.<entityType>++;
    }
  }
})
   │
   ▼
return { counts, warnings }
   │
   ▼
indexAll wrapper appends each warning to warningsChannel
   │
   ▼
plan:lint reads in-band warnings, classifies via validation.js RULES
```

### 5.2 Error class routing (definitive)

| Error code                     | Routed to                        | Warning shape                                               |
| ------------------------------ | -------------------------------- | ----------------------------------------------------------- |
| `SQLITE_CONSTRAINT_CHECK`      | `warnings` (in-band)             | `{code: 'check-rejected', entityId, message}`               |
| `SQLITE_CONSTRAINT_PRIMARYKEY` | `warnings`                       | `{code: 'duplicate-id', entityId, message}`                 |
| `SQLITE_CONSTRAINT_UNIQUE`     | `warnings`                       | `{code: 'duplicate-id', entityId, message}`                 |
| any other error                | rethrow → transaction rolls back | indexer call fails up to `generate-plan.js` outer try/catch |

`check-rejected` and `duplicate-id` are both already in `validation.js` RULES (check-rejected from C.5, duplicate-id from pre-existing schemas). `check-rejected` is TIER.WARNING. `duplicate-id` is TIER.ERROR — which means after this PR lands, any duplicate ID in any source file surfaces as a `plan:lint` ERROR (exit code 1).

### 5.3 Implication of `duplicate-id` being TIER.ERROR

`plan:lint` will fail (exit 1) if any duplicate-id surfaces post-sweep. For the hard gate (`0/0/0`) to hold, US-0257 must complete BEFORE US-0256's sweep lands the bugs/lessons/test-cases indexers — OR they need to land in the same commit. Otherwise the bisect window between US-0256 and US-0257 has CI broken.

**Implementation order:** US-0257 ships in commits 1+2 (clean data first). US-0256 ships in commits 3+4 (sweep with already-clean data). No bisect window of broken CI.

---

## 6. Testing approach

**Categories:** unit (Jest) + integration (Jest). No perf/security/e2e (same as C.5).

**Coverage target:** ≥80% (CI-enforced). New files expected at 95%+ given the small surface.

### 6.1 New test files (2)

| File                                                             | Asserts                                                                                                                                                                                                           |
| ---------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `tests/unit/repository/insert-helper.test.js`                    | 5 cases for `createTryInsert`: successful insert; CHECK violation → check-rejected; PRIMARYKEY → duplicate-id; UNIQUE → duplicate-id; unexpected error rethrows. Uses tmpdir SQLite with a minimal CHECK fixture. |
| `tests/unit/repository/migrations/004-bugs-status-widen.test.js` | Mirrors 003-widen-status-check.test.js: 4 cases. Migration applies cleanly; existing rows preserved; INSERT of new status (Verified, WontFix, Closed) accepted; INSERT of unknown status still rejected.          |

### 6.2 Existing test files modified (1-2)

| File                                         | Change                                                                                                                                                                                              |
| -------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `tests/unit/repository/indexers.test.js`     | Audit during implementation. If existing tests construct fixtures that happen to contain duplicate IDs (relying on the silent-swallow behavior), those fixtures need updating. If clean, no change. |
| `tests/integration/dashboard-parity.test.js` | Likely no change — the merge-shim logic doesn't depend on which indexer ran. Run after US-0256 lands to confirm.                                                                                    |

### 6.3 Manual verification

After both stories land:

```bash
npm run plan:lint
# Expected: [plan:lint] errors: 0, warnings: 0, reports: 0
```

If non-zero: investigate the specific warning/error before merge.

### 6.4 Not tested

- The `INSERT OR IGNORE` → `INSERT` swap's transactional rollback behavior under simulated SQLite crash. The existing `index.transaction()` wrapping (from Phase A) handles this; we don't re-test.
- The 3 duplicate BUG resolution choices — these are editorial decisions, no test asserts on the chosen text.
- Phase D's `sdlc-status-indexer` post-rewrite behavior — out of scope.

---

## 7. Risks and mitigations

| Risk                                                                                                                                                                  | Mitigation                                                                                                                                                                                        |
| --------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| The sweep surfaces unanticipated duplicate-id errors in production data beyond the 3 BUGS dupes (e.g. in LESSONS.md, TEST_CASES.md, ID_REGISTRY.md, sdlc-status.json) | Pre-audit ran (Session 54 conversation): LESSONS/TEST_CASES/ID_REGISTRY clean. `sdlc-status.json` not audited because it's JSON-structured; risk exists but if found, resolve as part of US-0257. |
| Implementation order causes CI to break between commits (US-0256 lands before US-0257)                                                                                | Spec mandates US-0257 ships in commits 1+2 (data cleanup first), US-0256 in commits 3+4 (sweep with clean data).                                                                                  |
| BUGS.md format-doc convention line update conflicts with an in-flight commit by another contributor                                                                   | Solo project. Negligible.                                                                                                                                                                         |
| Migration 004 hits an unexpected FK constraint via `bug_stories`                                                                                                      | `PRAGMA foreign_keys = OFF` during the rebuild handles this. Same pattern as Migration 003.                                                                                                       |
| `sdlc-status-indexer` sweep is half-wasted because Phase D rewrites it                                                                                                | Accepted tradeoff per Q3 user decision. Phase D's rewrite preserves or improves the pattern.                                                                                                      |
| The 3 duplicate BUG entries have meaningful semantic differences (not just stale copy-paste)                                                                          | US-0257 diffs each pair explicitly; the implementer picks the canonical one per case. If both versions seem correct in different contexts, escalate to user before deleting either.               |

---

## 8. Out of scope (explicitly)

- Performance, security, accessibility testing
- The 4 other validators (`tools/lib/repository/validators/*`)
- Dashboard rendering of warnings (could be a future enhancement — captured implicitly as part of ENH-0002)
- Phase D plan doc renumbering (capture as a finding for D's start session)
- `parse-release-plan.js` rename to `release-plan-parser.js` (Phase E)
- Any new ENH entries surfaced by this work go into `docs/ENHANCEMENTS.md` for follow-up, not folded in here

---

## 9. Sequencing summary (for the implementation plan)

```
Commit 1: US-0257 — resolve 14 duplicate AC declarations in docs/RELEASE_PLAN.md
Commit 2: US-0257 — resolve 3 duplicate BUG declarations + update BUGS.md format-doc line
Commit 3: US-0256 — Migration 004 + shared insert-helper + dedicated helper test
Commit 4: US-0256 — sweep all 5 indexers + refactor release-plan-indexer to use shared helper
Commit 5: Session close — RELEASE_PLAN ticks, ENHANCEMENTS postscripts, session memory, MEMORY/PROMPT_LOG/progress
```

The data cleanup (commits 1+2) MUST precede the indexer sweep (commits 3+4) so the duplicate-id-as-error semantic doesn't break CI between commits.

End of spec.
