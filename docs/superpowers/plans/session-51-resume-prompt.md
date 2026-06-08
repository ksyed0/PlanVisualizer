# Session 51 Resume Prompt — Step 1 Repository Abstraction (Phase A continued)

Paste the block below as the opening message of Session 51.

---

**Context:**

Session 50 completed Tasks A.1–A.4 of the Step 1 Repository Abstraction plan (EPIC-0036). Resume from Task A.5.

**Branch:** `claude/trusting-ptolemy-a305f1` at commit `53e529b`
**Plan:** `docs/superpowers/plans/2026-05-19-step-1-repository-abstraction.md`
**Spec:** `docs/superpowers/specs/2026-05-19-step-1-repository-abstraction-design.md`
**Backlog:** EPIC-0036..EPIC-0041 in `docs/RELEASE_PLAN.md`

**What's already in place (Tasks A.1–A.4 complete):**

- `better-sqlite3` + `proper-lockfile` installed; 6 `pv:*` npm scripts registered; `.gitignore` updated
- CI bumped to Node 22 (engines.node ≥22 required for node:sqlite fallback)
- `tools/lib/repository/file-lock.js` — `withFileLock` + `acquireMany` (proper-lockfile, lexicographic order)
- `tools/lib/repository/ast/parser.js` — character-offset AST parser (use this, NOT the plan's reference code which was buggy)
- `tools/lib/repository/ast/serializer.js` — `serializeAst`, `replaceBlock`, `insertBlock`
- `tests/integration/repository/round-trip.test.js` — Phase A hard gate, all 5 production files PASSED
- BUG-0259 and BUG-0260 both Fixed

**Next task — A.5 (US-0219): IndexDatastore with better-sqlite3 → node:sqlite → --no-index fallback**

This is the SQLite abstraction layer. From the plan:

- `tools/lib/repository/index-datastore.js` exports `openIndexDatastore({path, mode})`
- Auto-detects in order: better-sqlite3 → node:sqlite (Node 22+, `--experimental-sqlite`) → no-index noop
- WAL mode enabled on open; `foreign_keys = ON`; `synchronous = NORMAL`
- `PV_NO_INDEX=1` env var forces no-index mode
- Jest tests at `tests/unit/repository/index-datastore.test.js` (4 tests: opens via better-sqlite3, WAL mode, no-index noop, prepare+transaction)
- Commit: `feat(repo): IndexDatastore with better-sqlite3 → node:sqlite → no-index fallback (US-0219)`
- Mark US-0219 Status: Done, AC-0868..AC-0871 checked in RELEASE_PLAN.md

**Instructions:**
Use `superpowers:subagent-driven-development` skill to execute the plan task-by-task.
Start with Task A.5, then proceed through A.6, A.7, A.8, A.9, A.10, A.11 (all 7 remaining Phase A tasks).
After all 11 Phase A tasks are done, run the Phase A hard-gate check (see plan section "Phase A hard gate check").

Two-stage review per task (spec compliance → code quality), same loop as Session 50.
After each task: mark the corresponding story Status: Done and ACs [x] in RELEASE_PLAN.md, then commit.

**Key constraint:** The parser in `tools/lib/repository/ast/parser.js` uses character-offset tracking (NOT line-based). Do not replace it with the line-based version from the plan document — the plan reference code was verified wrong (L-0066).

**Session close checklist** (at end): progress.md, PROMPT_LOG.md, LESSONS.md, MEMORY.md, RELEASE_PLAN.md story statuses. EPIC-0036 status should flip to "Done" once all 11 Phase A stories are Done.
