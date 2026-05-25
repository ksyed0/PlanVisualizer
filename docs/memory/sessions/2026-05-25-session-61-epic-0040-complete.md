# Session 61 — EPIC-0040 COMPLETE (8 stories shipped, 4 hard gates closed)

**Date:** 2026-05-25
**Branch base:** develop
**Outcome:** EPIC-0040 (Step 1 Persistence — Planning Writers, Phase E) marked Status: Done.

## Shipped

| Story   | PR                                                          | What                                                                                     |
| ------- | ----------------------------------------------------------- | ---------------------------------------------------------------------------------------- |
| US-0240 | [#1124](https://github.com/ksyed0/PlanVisualizer/pull/1124) | Writer APIs + 7 serializers + anchored-block `.update`/.create                           |
| US-0241 | [#1126](https://github.com/ksyed0/PlanVisualizer/pull/1126) | `id-allocator.js` with file-locked ID_REGISTRY.md mutation                               |
| US-0242 | [#1131](https://github.com/ksyed0/PlanVisualizer/pull/1131) | `repo.transaction(fn)` with RYOW + lex-ordered locks                                     |
| US-0243 | [#1129](https://github.com/ksyed0/PlanVisualizer/pull/1129) | Migration 001 normalise-fenced-blocks + round-trip audit                                 |
| US-0244 | [#1133](https://github.com/ksyed0/PlanVisualizer/pull/1133) | `agent-context.js` managed-write hard-gate (audit + lock)                                |
| US-0245 | [#1135](https://github.com/ksyed0/PlanVisualizer/pull/1135) | `generate-plan.js` managed-write hard-gate (audit + lock)                                |
| US-0246 | [#1137](https://github.com/ksyed0/PlanVisualizer/pull/1137) | `sync-github.js` managed-write hard-gate (real migration this time)                      |
| US-0247 | (this)                                                      | EPIC close-out: 4-gate consolidated hard-gate test + RELEASE_PLAN/MEMORY/LESSONS updates |

## Hard gates closed (per spec §2)

1. **Round-trip byte-identity** on post-Migration-001 corpus — `tests/integration/repository/epic-0040-hard-gates.test.js` describe block 1. 917 entities verified: 231 stories, 38 epics, 227 bugs, 89 lessons, 332 test cases. Every entity round-trips deep-equal AND serializer output is idempotent (serialize twice == identical text).
2. **No managed-path `fs.write*`** in the 3 migrated consumers (`agent-context.js`, `generate-plan.js`, `sync-github.js`) — describe block 2. Allowlist accepts only `/tmp/`, `*.cache`, generated outputs (`plan-status.json/.html`).
3. **`plan:lint` reports 0/0/0** — describe block 3.
4. **Per-consumer integration tests exist** — describe block 4 covers the 6 required test files.

## Lessons surfaced

- **L-0087**: Round-trip property tests against single-block fixtures don't catch parser-segmentation losses. The audit caught 84 `acs` field-drops on production RELEASE_PLAN.md that US-0240's fixture-based round-trip tests passed cleanly.
- **L-0088**: GitHub-hosted CodeQL doesn't honor inline `// codeql[<rule-id>]` suppressions; only UI/API dismissal or path relocation works. Don't waste a commit attempting suppression — relocate to a project-local path instead.
- **L-0089**: BEGIN-DEFERRED-while-async is a SQLite transaction footgun. Document it in module JSDoc + verify via "callback completes quickly" integration tests. No runtime enforcement is practical.

## Process observations

- **6 of 8 stories used `gh pr merge --squash` directly** (clean linear history). 2 stories (US-0245, US-0246) needed `--auto` because the prior PR landed during the CI cycle and `gh` rejected the stale base. `--auto` is the right default for sequential-PR pipelines.
- **2 of 8 stories were "Outcome A"** (audit revealed nothing to migrate) — US-0244 and US-0245. The audit-and-close pattern paid off: ~5 min per story instead of ~1 hour.
- **The hard-gate test caught a real bug at landing**: US-0246 Task 4 ran the source-grep gate and immediately flagged `parseBugs` import I'd missed in the audit. Fix added `BugRepo.listAll()` and replaced the L59 import. Without the gate, the migration would have "shipped" while still importing a write-purpose parser.

## Follow-on work

- **EPIC-0041 (Phase F — Lock-Down)** is now unblocked. The ESLint rule enforcing the no-managed-`fs.write` contract is now structurally possible because of US-0244/0245/0246.
- **Schema follow-up**: bugs.status CHECK constraint should be widened to include `Retired` and `Rejected` (currently in the serializer enum but not the SQLite schema). Future migration `005_bugs_status_widen_v2.sql`.
- **TaskRepo.update end-to-end roundtrip**: needs parser extension (parseReleasePlan doesn't surface tasks into `story.tasks`). Flagged in US-0240 PR body; can be addressed in a Phase E.2+ story.
- **L-0089 enforcement**: a static-analysis or runtime-warn linter could catch `await fetch(...)` / `await sleep(...)` inside `repo.transaction(...)` callbacks. Currently documentation-only.
- **Brittle test-count assertions**: `tests/integration/repository/pv-upgrade-rollback.test.js` hardcodes the pending-migration count. Replace with a structural assertion (contains-specific-IDs) in a future cleanup.

## Metrics

- **Final test count**: 132 suites / 2,669 tests (1,683 before EPIC-0040, +986 during the epic — most from the 917-entity it.each in the hard-gate test)
- **Coverage**: 89%+ statements across affected modules (per-task ≥80% gate enforced)
- **8 PRs landed** in sequence
- **~85 individual commits** before squash (most stories landed as 1-13 commits each)
