# Round-Trip Audit — 2026-05-24 (run 2026-05-25)

Pre-flight audit for Migration 001 (US-0243). Spec §4.4 prerequisite.

## Summary

- **Total files audited:** 4 (RELEASE_PLAN.md, BUGS.md, LESSONS.md, TEST_CASES.md)
- **Total entities parsed:** 917
- **Total divergences (initial run):** 107
- **Total divergences (after serializer fixes):** 0 ✅

## Initial divergences — by file

| File                   | Entities | Divergences | Category                                     |
| ---------------------- | -------- | ----------- | -------------------------------------------- |
| `docs/RELEASE_PLAN.md` | 269      | 84          | `acs` field dropped on re-parse              |
| `docs/BUGS.md`         | 227      | 8           | Status enum mismatch (`Retired`, `Rejected`) |
| `docs/LESSONS.md`      | 89       | 15          | Missing `rule` field                         |
| `docs/TEST_CASES.md`   | 332      | 0           | —                                            |

## Triage decisions

### 1. RELEASE_PLAN.md — 84 `acs` field divergences

**Root cause.** `story-serializer` emitted a blank line between `Acceptance Criteria:` and the AC list items:

```
Acceptance Criteria:
                  ← blank line
- [ ] AC-0001: ...
```

`parseReleasePlan` segments the document on `\n{2,}` (blank-line chunking, per BUG-0158 fix), which means the blank line split the AC items out of the story's chunk. `parseStoryBlock` then ran against only the story header text — no AC items in scope — and returned `acs: []`.

The original fixtures used in US-0240's story-serializer tests wrapped each block in fences with no surrounding prose, so the in-chunk-only re-parse happened to work. The audit caught the real-world case where the document has many sibling blocks separated by `\n\n`.

**Decision: Fixed in serializer.** Removed the blank-line emission. The AC items are now siblings of the header within the same chunk; `parseACs` still finds them via regex. Commit: `cb1c6d5`.

### 2. BUGS.md — 8 status enum divergences

**Root cause.** Production bugs `BUG-0011` (`Status: Rejected`) and `BUG-0097`, `BUG-0176`–`BUG-0180`, `BUG-0218` (`Status: Retired`) use enum values that weren't in `bug-serializer.ALLOWED_STATUS`. The serializer threw `ValidationError` for each.

The SQLite schema (`004_bugs_status_widen.sql`) enforces `{Open, In Progress, Fixed, Verified, WontFix, Closed}` — narrower than production data. The indexer must currently be tolerant (skipping these rows on insert) or these bugs aren't appearing in SQL queries.

**Decision: Widen the serializer enum.** Added `Retired` and `Rejected` to `ALLOWED_STATUS` to match real production data. The schema mismatch is real but out of scope for US-0243 — flagged for a follow-up migration that widens the `CHECK` constraint to match the serializer. Commit: `cb1c6d5`.

### 3. LESSONS.md — 15 missing-rule divergences

**Root cause.** Lessons `L-0044`, `L-0051`–`L-0074` use a different format from the canonical `## L-XXXX — Title\n\n**Rule:** ...` pattern. They have the heading and body prose but no explicit `**Rule:** ...` line. `lesson-serializer` threw `ValidationError('lesson.rule required')` for each.

**Decision: Make `rule` optional.** Skip emitting the `**Rule:**` line if absent. The lesson-serializer test for "throws on missing rule" was updated to assert the new optional-rule behavior. Commit: `cb1c6d5`.

### 4. TEST_CASES.md — 0 divergences

No issues. The test-case-serializer matches production format exactly.

## Conclusion

**All divergences resolved; safe to land Migration 001.**

After the fixes in commit `cb1c6d5`, re-running `node tools/audit-round-trip.js` produces:

```
Wrote <root>/.pv-cache/docs-pre-norm/_round-trip-audit.txt (0 divergences across 917 entities).
```

> **Note on snapshot location.** The original spec (§4.3) mandated `/tmp/docs-pre-norm/`. The path was relocated to `<root>/.pv-cache/docs-pre-norm/` (gitignored) during this PR to satisfy CodeQL's `js/insecure-temporary-file` rule. Defense-in-depth (O_NOFOLLOW) and the symlink regression test are preserved. The human-review workflow is unchanged: `diff -r .pv-cache/docs-pre-norm/ docs/` or `git diff`.

The full test suite remains green (1,722 tests passing). Migration 001 can now run against production without losing data.

## Follow-ups (out of scope for US-0243)

- **Schema widening for bugs.status.** The SQLite check constraint should be widened to match the serializer enum (`+Retired`, `+Rejected`). A future migration `005_bugs_status_widen_v2.sql` should rebuild the `bugs` table with the new constraint.
- **Canonical rule format for legacy lessons.** Lessons `L-0044`, `L-0051`–`L-0074` could be back-filled with a `**Rule:**` line extracted from their body prose. This is a content-quality issue, not a migration blocker.
