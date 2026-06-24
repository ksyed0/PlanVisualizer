# Session 65 — Merge Conflict Resolution + PR #1159 Merge

**Date:** 2026-06-24
**Branch:** hotfix/BUG-0258-claude-mem-worker-deps → develop
**PR:** #1159 (merged)

## What Happened

Context-compacted resume. The session started mid-merge: `git merge origin/develop` had left 4 files in conflicted state (CHANGELOG.md, PROMPT_LOG.md, docs/ID_REGISTRY.md, docs/LESSONS.md).

## Conflict Resolutions

| File                  | Strategy                                                                    |
| --------------------- | --------------------------------------------------------------------------- |
| `CHANGELOG.md`        | Keep both sides — added BUG-0267/0268 entries above develop's BUG-0265/0266 |
| `PROMPT_LOG.md`       | Keep both sides; renumbered our sessions +1 (develop owned Session 62)      |
| `docs/ID_REGISTRY.md` | Take `max()` per sequence: BUG-0269/0268, L-0096/0095, ENH-0011/0010        |
| `docs/LESSONS.md`     | Keep all entries from both branches; fix L-0094/0095 tag format             |

## Bugs Fixed In Prior Context (this same session window)

- **BUG-0267** — `lastDispatch` filter searched for `e.tag === 'dispatch'` / `startsWith('dispatch')`. `appendLog()` never sets `tag`; agent-start messages begin with `'started '`. Fixed filter to `startsWith('started ')`.
- **BUG-0268** — `proper-lockfile` missing from `node_modules`. `SdlcMirror.write()` threw → `sdlc-status.json` stuck in flat format → `reader.phases()` returned `[]`. Fixed by `npm install`.

## Test Fix

- `npm rebuild better-sqlite3` — ABI mismatch (141 vs 127) caused sqlite test failures. Rebuild against current Node fixed all 2715 tests.

## Key Rules

- ID_REGISTRY merge: always take `max(HEAD, theirs)` per sequence — it's a monotonically-increasing counter
- PROMPT_LOG session numbering: first committer to develop owns the number; renumber later branches +1
- `@agent:` tag in LESSONS.md must be on its own line, not inline in the `##` heading
