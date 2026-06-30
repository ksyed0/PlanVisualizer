# BUG-0269: AI_COST_LOG.md corruption cleanup + regression guard — Design

**Date:** 2026-06-30 · **Session:** 67 · **Branch:** `bugfix/BUG-0269-cost-log-corruption-cleanup`

## Problem

`docs/AI_COST_LOG.md` carries uncleaned `git stash pop` conflict markers from
`bugfix/BUG-0252-stash-recovery` (May 2026), committed to develop:

- Lines 498/502: literal `<<<<<<< Updated upstream` / `=======` markers (no
  trailing `>>>>>>>` — the closing marker was apparently hand-deleted during
  a botched cleanup attempt, leaving the file in a permanently-conflicted
  shape).
- A stray `> > > > > > > Stashed changes` line follows, then every cost-log
  row from there to EOF (~360 rows, lines ~507–866) carries a literal
  `> > > > > > > ` (seven `>` chars space-separated, trailing space) prefix —
  residue of a failed manual strip that removed the marker syntax but left
  the spaced-out character sequence behind.

**Data-loss consequence, not just cosmetic:** `parse-cost-log.js`'s row regex
requires lines to start with `|`. Every prefixed row currently fails to
match and is silently dropped from cost aggregation — roughly 360 sessions'
worth of cost data (2026-05-05 through 2026-06-30) are invisible to
`compute-costs.js` and the dashboard today. Cleanup is a correctness fix,
not just hygiene.

Every PR touching this file produces phantom merge conflicts inside the
corrupted region (hit 3× in Session 66: PRs #1168, #1170, #1172).

## Decisions

1. **One PR, two commits.** `bugfix/BUG-0269-cost-log-corruption-cleanup` →
   `develop`. Commit 1 = data cleanup only (mechanical, reviewable as a
   pure diff). Commit 2 = lint guard + parser test fixture (the regression
   guard, logically separate from the data fix). Splitting into two PRs
   would add CI/review overhead for no isolation benefit — the guard is
   meaningless without the cleanup it protects.
2. **Cleanup mechanics:**
   - Delete the `<<<<<<< Updated upstream` line and the `=======` line.
     Both row blocks on either side are genuine distinct cost-log rows
     (same branch, same day, different cumulative totals from successive
     Stop-hook fires) — keep both, in original order, no dedup.
   - Delete the standalone `> > > > > > > Stashed changes` line (it carries
     no data).
   - For every remaining line starting with `> > > > > > > `, strip exactly
     that literal prefix, leaving the `| ... |` row intact.
3. **Lint guard lives in `tools/lib/repository/validators/cost-log.js`**, a
   new pure-function validator (no DB/index dependency — it reads
   `docs/AI_COST_LOG.md` directly), wired into `tools/plan-lint.js`
   alongside `runCrossEntityChecks`. New violation code
   `cost-log-corruption` is registered as `TIER.ERROR` in
   `tools/lib/repository/validation.js` (fails CI, consistent with
   `duplicate-id`/`malformed-block`). Rejected CI-only-grep because it
   would live outside the existing single-source-of-truth lint pipeline
   that `npm run plan:lint` already runs locally and in CI; rejected
   bundling into `pv-doctor.js` because no such file exists in this repo
   (`tools/plan-lint.js` is the established lint entry point).
   - Checks: any line matching `^(<{7}|={7}|>{7})\s*$` (conflict markers on
     their own line) or `^> > > > > > > ` (the corrupted prefix).
4. **Verification:** new fixture-based unit tests in
   `tests/unit/parse-cost-log.test.js` covering (a) a fixture with both
   corruption types, asserting `parseCostLog` recovers zero rows pre-strip
   and all rows post-strip, and (b) a `tests/unit/cost-log-validator.test.js`
   covering the new validator against clean/corrupted fixtures. After the
   real-file cleanup, run `node tools/plan-lint.js` locally and confirm
   zero `cost-log-corruption` violations, plus diff the row count from
   `parseCostLog` before/after cleanup on the real file to confirm no rows
   were lost (only un-hidden).
5. **Traceability:** commit 1's message footer references
   `Fixes BUG-0269. Root cause: bugfix/BUG-0252-stash-recovery (May 2026).`

## Out of scope

- No changes to `compute-costs.js` aggregation logic — that's Part 2
  (ENH-0005) and benefits from this fix landing first (clean rolling-window
  data).
- No backfill/correction of historical dashboard reports that were
  generated while data was hidden — those are stale build artifacts, not
  source-of-truth state.
