# Session 50 — Persistence Strategy + Step 1 Phase A Start

<!-- complexity: medium -->

**Date:** 2026-05-19 / 2026-05-20
**Branch:** claude/trusting-ptolemy-a305f1 (HEAD: 53e529b)

## Key decisions made

- **Open-core persistence path selected (Option B).** Markdown stays authoritative for human-edited entities. SQLite becomes authoritative for tool-emitted state (sdlc-status). A derived SQLite index enables fast queries + referential integrity. No identity, no server — single user, single machine.
- **Step 1 scoped:** repository abstraction (EPIC-0036..EPIC-0041, 38 stories). Steps 2–4 (multi-user, network, enterprise) deferred and documented in `docs/architecture/persistence-and-multi-user-strategy.md`.
- **Node 22 now required** (CI bumped from Node 20 to Node 22 in all 8 workflow occurrences). Needed for node:sqlite fallback in Task A.5.

## What exists now (new files this session)

- `docs/architecture/enterprise-agentic-sdlc-spec-v2.md` — 867-line multi-team SDLC spec (v0.5)
- `docs/architecture/persistence-and-multi-user-strategy.md` — open-core roadmap Steps 1–4
- `docs/superpowers/specs/2026-05-19-step-1-repository-abstraction-design.md` — Step 1 spec (4 review passes, 22 amendments)
- `docs/superpowers/plans/2026-05-19-step-1-repository-abstraction.md` — Step 1 implementation plan (38 tasks)
- `tools/lib/repository/file-lock.js` — `withFileLock` + `acquireMany` using `proper-lockfile`
- `tools/lib/repository/ast/parser.js` — character-offset markdown AST parser (NOT line-based; the plan reference was wrong)
- `tools/lib/repository/ast/serializer.js` — `serializeAst`, `replaceBlock`, `insertBlock`
- `tests/unit/repository/file-lock.test.js` — 3 tests
- `tests/unit/repository/ast-parser.test.js` — 4 tests
- `tests/unit/repository/ast-serializer.test.js` — 2 tests
- `tests/integration/repository/round-trip.test.js` — 5 tests (1 per production file)
- `tests/fixtures/repository/sample-release-plan.md` — fixture

## Phase A hard gate status

- **PASSED** — all 5 production markdown files (RELEASE_PLAN, BUGS, LESSONS, TEST_CASES, ID_REGISTRY) are idempotent-on-second-pass through the AST parser+serializer. Round-trip test in tests/integration/ confirms this runs on every test suite execution.

## Backlog state

- EPIC-0030..0035 (SDLC multi-team, 28 stories US-0187..US-0214) — Planned/To Do
- EPIC-0036..0041 (Step 1 persistence, 38 stories US-0215..US-0252) — 4 Done (US-0215..US-0218), rest Planned/To Do
- Next task: A.5 (US-0219) — IndexDatastore with better-sqlite3 → node:sqlite → --no-index fallback

## Bugs closed this session

- BUG-0258: ID_REGISTRY drift (evidence log; closed by EPIC-0036+0041 enforcement)
- BUG-0259: file-lock.js referenced but missing → closed by US-0216 (A.2)
- BUG-0260: engines.node vs CI Node version → closed by CI bump in same task (A.1)

## Critical learnings

- Plan reference code was buggy (L-0066). Character-offset parser is the correct implementation.
- engines.node and CI node-version must be changed atomically (L-0067).
- Design specs must verify referenced primitives exist before publication (L-0068).
