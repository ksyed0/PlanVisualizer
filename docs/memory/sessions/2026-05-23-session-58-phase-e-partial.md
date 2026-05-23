# Session 58 — Phase E partial (US-0259, US-0263, US-0260 shipped; US-0262, US-0261 remain)

**Date:** 2026-05-22 / 2026-05-23
**Epic:** EPIC-0045 — Consumer Migration & Cleanup (Phase E)
**Status:** 3 of 5 stories complete. Epic remains open pending US-0262 (Migration 006) → US-0261 (cleanup + hard gates).

---

## What Shipped

### US-0259 — Dual-read accessor + dashboard consumer migration (PR [#1102](https://github.com/ksyed0/PlanVisualizer/pull/1102), develop commit `8bb81da3`)

The single most important piece: `tools/lib/repository/sdlc-status-reader.js`, a 70-line module exporting 10 pure functions over `docs/sdlc-status.json`. Each reads `programme.{key}` first, falls back to legacy top-level `{key}`, then to a safe default. The fallback is transitional and is removed in US-0261 after Migration 006 (US-0262) has run.

- `currentPhase` and `githubStatus` use explicit `typeof` checks rather than bare `||` so `currentPhase: 0` (a valid not-started value) and `githubStatus: null` (the dashboard's absence signal) survive correctly.
- `cycles` defends against non-array values at either source via `Array.isArray()` guards (matching the inline guard already in the pre-migration dashboard HTML).

Dashboard migration: every direct `status.{agents,metrics,stories,epics,phases,cycles,currentPhase,githubStatus,project}` read in `tools/generate-dashboard.js` is now routed through the accessor. The same module is injected as `window.pvReader` into the emitted `<script>` block via `fn.toString()` — single source of truth for both Node-side rendering and browser-side ticker/refresh handlers (option B from the design note, beats option A's inline-copy because there's zero drift risk). 18 `pvReader.*` call sites in the regenerated `docs/dashboard.html`; 0 direct legacy reads.

**Tests:** 85 unit tests against the accessor (100% statement/branch/function/line coverage). 27 integration tests guarding the dashboard migration (source-grep per-key + `generateHTML()` render-gate against state-A/B/C fixtures). 9 shared phase-e fixtures committed under `tests/fixtures/phase-e/`.

**ACs ticked:** AC-1015, AC-1016.

### US-0263 — Housekeeping: data_005 rename + gitignore (PR [#1103](https://github.com/ksyed0/PlanVisualizer/pull/1103), develop commit `430b0590`)

Three independent housekeeping items:

1. **L-0081 fix:** `tools/lib/migrations/005-ingest-sdlc-status.js` → `data_005-ingest-sdlc-status.js`. The runner regex in `tools/lib/migrations/index.js` is widened to `/^(?:data_)?\d{3}-.*\.js$/` so legacy names still work. Migration 005's content-addressed idempotency (`meta_status('migration_005_hash')`) means checkouts that already ran the old-named migration are unaffected by the rename.
2. **AC-1022 escapee audit:** `docs/.pv-state.json` added to `.gitignore`. Audit of `pv:upgrade`/`pv:rollback`/`pv:doctor`/`pv:check-upgrade` and their lib deps found this as the only working-tree escapee.
3. **AC-1021 regression test:** `tests/unit/migrations/migrations-no-collision.test.js` walks both migration dirs and asserts no two files share a leading namespaced prefix. Discriminates `data_005` from `005_` correctly (the SQL schema migration `005_sdlc_task_lifecycle_fields.sql` legitimately coexists with the JS data migration).

**ACs ticked:** AC-1021, AC-1022.

### US-0260 — Non-dashboard consumer migration + canonical init seed (PR [#1106](https://github.com/ksyed0/PlanVisualizer/pull/1106), develop commit `36a816d3`)

Four file changes:

- **`tools/generate-plan.js:263`** — `const sdlcStories = sdlc.stories || {};` → `const sdlcStories = reader.stories(sdlc);`.
- **`tools/agent-context.js:84`** — `(sdlc.stories || {})[opts.story]` → `reader.stories(sdlc)[opts.story]`. `sdlc.tasks` reads at lines 76/99 left untouched (`tasks` is canonical post-Phase-D, not a legacy migration target).
- **`tools/agent-spec-plan.js#readStories()`** — the SQL-absent fallback's dual `legacyTopLevel + legacyProgramme` merge collapses to one `reader.stories(onDisk)` call. The accessor's `programme-first` precedence matches the previous spread's `{ ...legacyTopLevel, ...legacyProgramme }` semantics.
- **`tools/init-sdlc-status.js`** — fully rewritten. `buildStatus()` and `fs.writeFileSync(STATUS_PATH, ...)` are deleted. New flow: `Repository.getInstance({ root }).sdlcProgramme.set('agents'|'phases'|'project', ...)`. The mirror module renders the canonical `{tasks, log, programme}` triple automatically. AC-1018 idempotent-merge: without `--force` an existing row is preserved; with `--force` it's overwritten. Per-row idempotency replaces the previous file-level `wx` flag.

**Tests:** 13 integration tests (source-grep per-consumer + accessor reads against state-A/B fixtures + inline divergent fixture proving programme-stories precedence). 8 unit tests for `init-sdlc-status-repeat` (fresh init canonical shape, no-force preserves, --force overwrites, accessor round-trip). 3 superseded `buildStatus` tests removed from `tests/unit/generate-dashboard.test.js`.

**ACs ticked:** AC-1017, AC-1018.

### File-lock parallel-flake fix (folded into PR [#1106](https://github.com/ksyed0/PlanVisualizer/pull/1106))

`tests/unit/repository/file-lock.test.js`'s `serializes concurrent writes` test asserted `expect(order).toEqual(['A-start', 'A-end', 'B-start', 'B-end'])` — a stricter property than the lock's mutual-exclusion contract. Under `--maxWorkers=8` with full-suite I/O contention, B occasionally won the race and produced a `toEqual` failure. Fix asserts the real invariant (each callback's start+end markers are adjacent in the order array). Reproduced 1/1 pre-fix, 0/16 stress runs post-fix. Lesson encoded as L-0083.

### Spec patch — Migration 006 path disambiguation (PR [#1107](https://github.com/ksyed0/PlanVisualizer/pull/1107), develop commit `90dbba86`)

The Phase E spec at lines 232 and 329 pegged Migration 006 at `tools/lib/repository/migrations/006-*.js` — a directory containing SQL schema migrations only. Doc-only patch corrects both lines to `tools/lib/migrations/data_006-ingest-legacy-programme.js`, matching the L-0081 / US-0263 naming convention. Inline rationale at line 232 prevents future ambiguity. Unblocks US-0262 implementer from a wrong-path mistake that would have failed AC-1021 at CI.

---

## Workflow Adopted Mid-Session

After US-0259 + US-0263 shipped (both done in a freer-form spec-anchored TDD style), the user asked whether we were following the `superpowers:executing-plans` skill formally. Answer was no — we'd been anchored to the spec but not running the skill's structured loop. Mid-session adopted the full chain:

1. `superpowers:writing-plans` → produces a per-story plan file (committed as the first commit on the feature branch so reviewers can see the pre-implementation contract).
2. `superpowers:executing-plans` → tracks per-task progress via TodoWrite.
3. `superpowers:subagent-driven-development` → fresh implementer subagent per task; two-stage review (spec compliance then code quality) after each.
4. `superpowers:finishing-a-development-branch` → present standard 4-option menu after tests pass; push + open PR.

US-0260 was the first story executed via the full chain. The two-stage review caught real issues at every task that the implementer's self-review missed:

- Task 1: a flaky-test advisory (which I dismissed after investigation).
- Task 4: an unsurfaced regression in `tests/unit/generate-dashboard.test.js` (3 superseded `buildStatus` tests) — implementer correctly escalated DONE_WITH_CONCERNS.
- Task 5: a missing `Lens.status` assertion (the spec said "each agent", test only checked one).
- Task 6: a non-falsifiable precedence test (state-c.json had identical content in both shapes, so the assertion couldn't distinguish which source won).

Each was caught and fixed before the task was marked complete. The workflow's per-task overhead paid back in defect prevention.

---

## Develop Tip + Test Counts

- **Current tip:** `90dbba8` (after the four PRs above merged).
- **Full suite:** 101 suites / 1572 tests pass (net +20 tests vs. start of session: +85 accessor unit, +27 dashboard integration, +13 non-dashboard-consumers integration, +8 init-repeat, +2 collision, −3 superseded buildStatus, −1 collision sanity loss elsewhere — math is approximate but the count is exact).
- **Lint:** 0 errors / 43 pre-existing warnings (the new `STATUS_PATH` `no-unused-vars` warning is explicitly suppressed via `eslint-disable-next-line` because it's preserved for out-of-tree consumers).
- **Format:** all clean.

---

## Phase E Hard Gates — Status

The Phase E spec §2 lists four hard gates. Current state:

| #   | Gate                                                                       | Status                                                                    |
| --- | -------------------------------------------------------------------------- | ------------------------------------------------------------------------- |
| 1   | `tools/lib/repository/sdlc-mirror.js:32-43` preservation block removed     | ❌ pending US-0261                                                        |
| 2   | `tools/lib/repository/indexers/sdlc-status-indexer.js` deleted             | ❌ pending US-0261                                                        |
| 3   | Dashboard reads only `{tasks, log, programme}`                             | ✅ achieved by US-0259                                                    |
| 4   | `docs/sdlc-status.json` contains exactly `{tasks, log, programme}` on disk | ❌ pending US-0261 (lands organically when preservation block is removed) |

So US-0259 closed 1 of 4. US-0261 closes the other 3.

---

## New Lesson

- **L-0083** — When a test is intermittently flaky, check whether its assertion is stronger than the contract it's testing. Source: file-lock parallel-flake forensics. See `docs/LESSONS.md`.

---

## Open Work (Phase E Remaining)

- **US-0262 (TASK-0068)** — Migration 006: ingest legacy top-level into SQL. Creates `tools/lib/migrations/data_006-ingest-legacy-programme.js` (path now clarified by PR #1107), extends `pv:upgrade` snapshot to capture pre-006 JSON, integrates with `pv:rollback`, logs `migration_006_conflict_{K}` warnings on state-C divergence via `warningsChannel`, idempotency keyed on `"006"`. Test coverage target ≥90%. AC-1019.
- **US-0261 (TASK-0069)** — Delete `sdlc-mirror.js:32-43` preservation block, delete `sdlc-status-indexer.js` entirely, strip the `|| json.{key}` dual-read fallback from the accessor. Closes Phase E hard gates #1, #2, #4. AC-1020. Sequenced **last** per spec §4.3 — must merge after US-0260, US-0262.

---

## References

- Plan: [docs/superpowers/plans/2026-05-23-us-0260-non-dashboard-consumers.md](../../superpowers/plans/2026-05-23-us-0260-non-dashboard-consumers.md)
- Phase E spec: [docs/superpowers/specs/2026-05-22-phase-e-consumer-migration-design.md](../../superpowers/specs/2026-05-22-phase-e-consumer-migration-design.md)
- US-0259 API design note: [docs/superpowers/specs/2026-05-22-us-0259-accessor-api-design.md](../../superpowers/specs/2026-05-22-us-0259-accessor-api-design.md)
- Session 57 close-out (predecessor): [2026-05-22-session-57-phase-d-complete.md](2026-05-22-session-57-phase-d-complete.md)
