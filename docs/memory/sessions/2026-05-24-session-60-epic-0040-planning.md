# Session 60 — EPIC-0040 Planning (Brainstorm → Spec → 8 Plans → Cross-Plan Review → Merge)

**Date:** 2026-05-24
**Branch base:** develop (post-EPIC-0045 close-out, tip `4e09d2e`)
**Outcome:** EPIC-0040 (Planning Writers, Phase E sibling) fully scoped, specced, and planned. 2 PRs merged. Execution-ready for session 61.
**Followed:** L-0086 (this session encoded the lesson — cross-plan review caught 4 blockers per-plan review missed)

---

## Shipped

| PR    | Title                                              | Develop commit | Merged               |
| ----- | -------------------------------------------------- | -------------- | -------------------- |
| #1118 | docs: EPIC-0040 design spec                        | (squashed)     | 2026-05-24 22:24 UTC |
| #1119 | docs: EPIC-0040 — 8 per-story implementation plans | (squashed)     | 2026-05-24 22:25 UTC |

No code changes. Two docs-only PRs that establish the executable EPIC-0040 work package.

## Work arc

1. **Continuation from session 59.** Session 59 had closed EPIC-0045 (Phase E consumer-side). User asked "what's next" → chose to brainstorm EPIC-0040 (Planning Writers, the writer-side Phase E sibling).
2. **Brainstorming (5 design decisions locked).** Walked all 4 design calls per the `superpowers:brainstorming` skill, with one user re-frame ("I genuinely don't understand the trade-offs in the question") that triggered an explicit code-example reformulation. Decisions:
   - Transaction read semantics: Read-Your-Own-Writes (RYOW).
   - Migration 001 approval gate: procedural (git-as-gate), no `--apply` flag.
   - Serializer architecture: per-entity modules + shared `_fence-utils.js`.
   - Phase E naming disambiguation: keep "Phase E" for EPIC-0040; prose-only disambiguation.
3. **Spec written** (`docs/superpowers/specs/2026-05-24-epic-0040-planning-writers-design.md`, 459 lines). 7 sections + 11 references. 8 self-critical observations folded in during user review. Pushed as PR #1118.
4. **Plan structure chosen.** User picked "8 per-story plans, all written in this session." Plans written in dependency order: US-0240 → 0241 → 0242 → 0243 → 0244 → 0245 → 0246 → 0247 (~5,600 lines total). Pushed as PR #1119.
5. **Cross-plan review** (this session's contribution to L-0086). Dispatched `pr-review-toolkit:code-reviewer` on the 9 files (spec + 8 plans). Found 4 blockers + 2 important findings the per-plan self-reviews missed. Fixed inline on PR #1119 via follow-up commit `8682317`.
6. **CI + merge.** Both PRs needed `gh pr update-branch` (BEHIND on develop). All 7 visible checks passed (CodeQL correctly skipped for docs-only). Squash-merged both.
7. **Session close-out** (this commit).

## Architecture decisions captured in the spec

- **Per-entity serializers** at `tools/lib/repository/serializers/<entity>-serializer.js` + shared `_fence-utils.js`. Each serializer is the inverse of its parser (`tools/lib/parse-<entity>.js`).
- **Anchored-block replacement** as the update mechanic (regex-anchor on entity-ID line → slice → parse → mutate → serialize → splice back; surrounding prose byte-identical). Spec §3.3.
- **`repo.transaction((tx) => ...)` with RYOW** + lex-ordered file-lock acquisition via existing `acquireMany`. Spec §3.4.
- **`id-allocator.js` bypasses SQLite** (registry is meta-state; would create bootstrap cycle). Spec §4.1.
- **Migration 001 algorithm:** parse → serialize → parse → serialize; fail loud if pass1 ≠ pass2; skip write if pass2 === input. Spec §4.3.
- **Pre-flight round-trip completeness audit** (§4.4) — mandatory before Migration 001 lands; harness + report committed under `docs/architecture/`.
- **Three consumer migrations** flip `fs.write` to `repo.X.update(...)` / `repo.sdlcTasks.upsert(...)` in `agent-context.js`, `generate-plan.js`, `sync-github.js`.

## Cross-plan review findings (full enumeration → L-0086)

| #   | Severity | Finding                                                                                     | Fix                                                                                                                                       |
| --- | -------- | ------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------- |
| B1  | BLOCKER  | `replaceBlock({transform})` in US-0240 table vs `mutator` everywhere else                   | Aligned table to `{mutator}`; explicitly documented sibling helpers (`replaceBlockInText`, `replaceUnfencedRange`)                        |
| B2  | BLOCKER  | Story/epic/bug `ALLOWED_STATUS` mismatched the SQLite CHECK constraint                      | Aligned to post-003 `{To Do, Planned, In Progress, Blocked, Done, Retired}` for stories/epics; post-004 case-sensitive `WontFix` for bugs |
| B3  | BLOCKER  | Plans said `tasks` table; real table is `planning_tasks` with `{id, story_id, status}` only | TaskRepo bound to right table; title stays in markdown only                                                                               |
| B4  | BLOCKER  | Bug/lesson/test-case `mapXxx` sketches referenced columns the schema doesn't have           | Pre-Step 3 rewritten with verbatim column lists; thin mapping; `.get()` override pattern documented (re-parse markdown on demand)         |
| I1  | IMPORT   | `tests/integration/sync-github-flow.test.js` doesn't exist; US-0247 asserts it does         | US-0246 changed `Modify or Create` → `Create`; added Task 2.5 with minimal integration test                                               |
| I2  | IMPORT   | Spec + plans PR-merge ordering unclear                                                      | US-0240 Pre-Work clarifies #1118 + #1119 must merge before branching for US-0240                                                          |
| N1  | NICE     | `MANAGED` paths set duplicated across 3 test files                                          | Left as-is; extract later                                                                                                                 |

## Lessons surfaced

- **L-0086** added (cross-plan consistency review): `docs/LESSONS.md` head.

## Follow-on work

- **Session 61 onward — EPIC-0040 execution.** 8 stories, ~2-3 sessions of `superpowers:subagent-driven-development` execution per the comprehensive sequential-execution prompt offered at end of session 60.
- **EPIC-0041 (Phase F — Lock-Down)** structurally unblocked after EPIC-0040 close. ESLint rule enforcing the no-managed-`fs.write` contract.

## Metrics

- 2 PRs merged (one spec, one 8-plan bundle).
- Plans total ~5,600 lines across 8 files.
- 0 code changes.
- Test suite unchanged (no execution this session): 107 suites / 1596 tests on develop tip.

## What the next session needs

- Confirm PRs #1118 + #1119 merged — they are, as of 2026-05-24 22:25 UTC.
- Open a fresh Claude Code session (clean context for subagent dispatch).
- Use the comprehensive sequential-execution prompt provided at end of session 60 (saved in this session's transcript). It encodes the dependency order, haiku-model directive, auto-merge consent for stories 1-7, manual gate on US-0247, and the 5 STOP conditions.

## Sequencing handed off to session 61

```
US-0240 (foundation — XL)
  ↓
US-0241 (id-allocator — M) — parallel-safe with US-0243; serial recommended
US-0243 (Migration 001 + audit — M)
  ↓
US-0242 (transaction wrapper — L)
  ↓
US-0244 (agent-context — S) — parallel-safe trio
US-0245 (generate-plan — M)
US-0246 (sync-github — S) — must Create sync-github-flow.test.js
  ↓
US-0247 (Phase E hard gate + close-out — S) — manual merge gate
```
