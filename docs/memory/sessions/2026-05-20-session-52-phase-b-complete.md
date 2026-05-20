# Session 52 — Phase B complete: indexers + plan:lint, EPIC-0037 Done

**Date:** 2026-05-20
**Branch:** `docs/session-52-close` (session close only)
**Complexity:** ◐ medium

## Summary

Merged Phase A (PR #1067 after conflict resolution + security fixes), shipped all of Phase B (EPIC-0037), and merged PR #1069. Six open PRs merged (housekeeping + dependabot). Stale branches deleted.

## Phase A merge work

- Resolved 3-way conflict on RELEASE_PLAN.md, ID_REGISTRY.md, package-lock.json
- Fixed 3 CodeQL security alerts:
  - TOCTOU race in `sourceMeta()` → `openSync/fstatSync/readFileSync(fd)`
  - Insecure temp file in `file-lock.test.js` → `mkdtempSync`

## Phase B delivered (EPIC-0037 Done)

| Task | Story   | Key module                                                                           |
| ---- | ------- | ------------------------------------------------------------------------------------ |
| B.1  | US-0226 | 6 indexers + `indexAll`, missing-file guards, two-pass FK-safe, multi-format support |
| B.2  | US-0227 | `plan-index.js` CLI, `generate-plan.js` hook (non-fatal)                             |
| B.3  | US-0228 | `validators/cross-entity.js` — dangling deps, orphan ACs, id-registry drift          |
| B.4  | US-0229 | `plan-lint.js`, Phase B hard gate: **0 warnings** on production data                 |

## Key bugs fixed during Phase B

- **FK ordering**: DELETE must be children-first (epic_dependencies → story_dependencies → acs → planning_tasks → stories → epics) when `foreign_keys=ON`
- **Multi-entity blocks**: Early RELEASE_PLAN.md sections put multiple epics in one fenced block; `body.match()` finds only the first. Fix: `splitEntitySections()` splits block body into per-entity sub-sections.
- **Alt-format epics**: EPIC-0021/0022 use `EPIC-XXXX\nTitle: ...` not `EPIC-XXXX: title`. Fix: `EPIC_HEAD_ALT` fallback regex + `kv.Title`.

## Phase B hard gate result

`npm run plan:lint` on production data: **errors=0, warnings=0, reports=0**

## New lessons

- **L-0071**: TOCTOU fix — `openSync/fstatSync/readFileSync(fd)` for atomic metadata+content
- **L-0072**: Insecure temp file — always `mkdtempSync`, never predictable filename
- **L-0073**: Multi-entity fenced blocks — `splitEntitySections()` pattern
- **L-0074**: Alt-format epics — `EPIC_HEAD_ALT` fallback

## What's next

Phase C (EPIC-0038): entity read APIs (`repo.stories`, `repo.epics`, `repo.acs`) + migrate dashboard read path under `PV_DASHBOARD_VIA_REPO=1` flag with snapshot parity test.
