# US-0178 — Automated Memory Migration Commit (PR B Automation) Design Spec

**Date:** 2026-05-10
**Status:** Planned (depends on US-0175 PR A)
**Story:** US-0178 (EPIC-0026)
**Scope:** New `tools/memory.js migrate-commit` subcommand + CLAUDE.md templated patcher

---

## Overview

US-0175 PR A delivers the migration tooling. The actual migration ("PR B") is a manual three-step process today: run `migrate`, hand-edit CLAUDE.md, commit and push. US-0178 automates that into a single command — `node tools/memory.js migrate-commit` — that runs the migration, patches CLAUDE.md, stages all changes, runs tests, commits, and (optionally) creates a PR.

**Out of scope:** changes to the migration logic itself (handled in US-0175). This story is purely about the orchestration / automation layer on top.

---

## Why automate this?

The manual PR B workflow has four failure modes that automation eliminates:

1. **Forgotten CLAUDE.md edits.** Authors run `migrate` and commit the file changes but forget to update CLAUDE.md's "Mandatory Session Startup" and "Session Close Checklist" sections. The repo ships in a half-migrated state where memory layout is changed but instructions still say "edit MEMORY.md directly".
2. **Inconsistent commit messages.** Manual commits drift in wording, making the migration commit hard to find or revert.
3. **No test gate.** The author may forget to run the suite before committing; if `compactMemory` integration breaks something, it lands in develop.
4. **Skipped dry-run.** The spec recommends `migrate --dry` before the real run; humans skip this when they're confident, occasionally regretting it.

Automation enforces all four.

---

## CLI Surface

New subcommand on the existing `tools/memory.js`:

```bash
node tools/memory.js migrate-commit [--push] [--pr] [--no-test] [--dry]
```

| Flag        | Effect                                                                                                                   |
| ----------- | ------------------------------------------------------------------------------------------------------------------------ |
| (none)      | Run migrate, patch CLAUDE.md, run tests, stage, commit. Stop at commit.                                                  |
| `--push`    | After commit, push to `origin/<current-branch>`.                                                                         |
| `--pr`      | After push, run `gh pr create` with a standard title and body. Implies `--push`.                                         |
| `--no-test` | Skip the Jest run before commit (escape hatch for known-failing pre-existing tests; not recommended).                    |
| `--dry`     | Print every operation that would be performed, including the proposed CLAUDE.md diff and commit message. Writes nothing. |

npm script: `npm run memory:migrate-commit` (bare command, no flags). Power users invoke `node tools/memory.js migrate-commit --pr` directly.

---

## Pipeline Steps

The `migrate-commit` command runs this strict sequence and aborts on the first failure:

1. **Pre-flight checks**
   - Working tree must be clean (`git status --porcelain` returns empty). Abort if dirty — refuse to mix migration changes with unrelated edits.
   - Current branch must NOT be `develop` or `main`. Abort with message "create a feature branch first (suggested: `feature/US-0178-memory-migration`)".
   - `MEMORY.md` must exist at repo root.
   - `docs/memory/topics/` must NOT exist or must be empty (idempotency check; mirrors `migrate`'s rule). Override with `--force`.

2. **Migration**
   - Run `node tools/memory.js migrate --force=false` (uses `migrateMemory({root, dry: false, force: false})` from US-0175).
   - On any error, abort and leave repo in pre-migration state (migrator should not partially write; if it does, this step prints recovery instructions).

3. **CLAUDE.md patch**
   - Apply the templated patches described in the "CLAUDE.md Patch Specification" section below.
   - Use a deterministic AST-style approach (find section by heading, insert lines at known position). NOT regex on whole file — too fragile.
   - On a `--dry` run, print the unified diff and stop here.

4. **Verification**
   - Unless `--no-test`: run `npx jest --no-coverage`. Abort if any test fails. Print failure summary.
   - Run `node tools/memory.js validate`. Abort if drift detected (should not happen — it would mean migrate produced inconsistent output, which is a bug in US-0175).

5. **Stage + commit**
   - `git add docs/memory/ MEMORY.md CLAUDE.md docs/LESSONS.md docs/ID_REGISTRY.md`. Only these paths; NOT `git add -A`.
   - Commit with the templated message (see "Commit Message Template" below).

6. **Optional push**
   - If `--push` or `--pr`: `git push -u origin <current-branch>`.

7. **Optional PR**
   - If `--pr`: `gh pr create --base develop --head <current-branch> --title "..." --body "..."` (templated).

---

## CLAUDE.md Patch Specification

The patcher targets two named sections in CLAUDE.md. Each section is identified by its `## ` heading; insertion points within sections are deterministic.

**Patch 1 — Mandatory Session Startup section**

Find the line `## Mandatory Session Startup`. Walk forward past the existing list items. Locate the line beginning `2. Read \`MEMORY.md\``. Insert immediately after that bullet:

```
3. Memory files live in `docs/memory/{topics,sessions,snapshots}/`. Read `MEMORY.md` (compact index) at session start; read specific topic files when their topic is relevant to the current task. Do not edit `MEMORY.md` directly — it is auto-regenerated by `generate-plan.js`.
```

Renumber subsequent items in the list (3→4, 4→5, etc.). The renumbering rule: any line matching `^\d+\.\s+` after our insertion point gets its number incremented by 1, in document order.

**Patch 2 — Session Close Checklist section**

Find the line `## Session Close Checklist`. Locate the existing checkbox `- [ ] \`MEMORY.md\` updated with new learnings` (or similar — the canonical line ending with "updated with new learnings"). Replace it with the following four lines:

```
- [ ] Memory files updated in `docs/memory/{topics,sessions,snapshots}/`:
- [ ]   - For session learnings: `docs/memory/sessions/YYYY-MM-DD-<short-slug>.md` with `# <Title> (Session N, YYYY-MM-DD)` heading
- [ ]   - For new stable knowledge: `docs/memory/topics/<topic>.md` (no date prefix in filename)
- [ ]   - Do NOT edit `MEMORY.md` directly — it is auto-regenerated by `generate-plan.js`
```

If the checkbox text doesn't match exactly, abort with a message: "CLAUDE.md Session Close Checklist has been edited — manual reconciliation required". This is the safe failure mode; we'd rather refuse to patch than corrupt a customised CLAUDE.md.

**Patch idempotency:**

If the migration was already applied (the spec lines are already present in CLAUDE.md), the patcher detects this and is a no-op. Test: search for the literal string `Memory files live in \`docs/memory/{topics,sessions,snapshots}\`` — if found, skip both patches.

---

## Commit Message Template

```
chore(memory): bootstrap docs/memory/ layout (US-0175)

Migration commit produced by `tools/memory.js migrate-commit`.

- Splits monolithic MEMORY.md into per-topic files under docs/memory/{topics,sessions,snapshots}/
- Rewrites MEMORY.md as compact auto-generated index
- Archives N superseded snapshots to docs/memory/archive/snapshots/
- Triages ## Lessons Learned section against docs/LESSONS.md (M orphans appended, K dropped as canonical)
- Patches CLAUDE.md with new memory layout instructions

Counts:
- Topic files written: <T>
- Session files written: <S>
- Snapshot files written: <P>  (archived: <A>)
- Lesson orphans appended: <O>

Run `node tools/memory.js validate` to confirm MEMORY.md/topic file consistency.
```

`<T>`, `<S>`, `<P>`, `<A>`, `<O>` are filled in from the migrator's return object.

---

## PR Creation Template

If `--pr`:

```bash
gh pr create --base develop --head <branch> \
  --title "feat(memory): bootstrap memory layout migration (US-0175)" \
  --body "$(cat <<'EOF'
## Summary

Migration commit produced by tools/memory.js migrate-commit. This is PR B of the US-0175 split: PR A (#XXX) shipped the tooling inert; this PR runs it and ships the result.

- Topic files written: <T>
- Session files written: <S>
- Snapshot files written: <P> (archived: <A>)
- Lesson orphans appended: <O>
- CLAUDE.md patched (Mandatory Session Startup + Session Close Checklist)

## Test Plan

- [x] tools/memory.js migrate ran cleanly
- [x] CLAUDE.md patches applied without abort
- [x] Test suite passes
- [x] tools/memory.js validate exits 0
- [ ] Manual: open MEMORY.md and confirm it's the compact index, not the old monolithic file
- [ ] Manual: spot-check 2-3 topic files for verbatim section content
- [ ] Manual: confirm CLAUDE.md instructions read correctly

🤖 Generated with [Claude Code](https://claude.com/claude-code)
EOF
)"
```

The PR-A reference (`#XXX`) is auto-discovered via:

```bash
gh pr list --state merged --search "feature/US-0175 in:head" --limit 1 --json number
```

Use the returned PR number (or omit the parenthesised reference if `gh` returns empty).

---

## Library Structure

Adds two new lib modules:

```
tools/lib/memory-claude-md-patcher.js  ← AST-style patcher for CLAUDE.md sections
tools/lib/memory-commit-orchestrator.js ← Pipeline: pre-flight → migrate → patch → test → commit → push → PR
```

`tools/memory.js` gains a new branch in `dispatch()`:

```js
if (cmd === 'migrate-commit') {
  const { runMigrateCommit } = require('./lib/memory-commit-orchestrator');
  return runMigrateCommit({ root: ROOT, dry, push: argv.push, pr: argv.pr, noTest: argv.noTest });
}
```

---

## Testing

```
tests/unit/memory-claude-md-patcher.test.js   ← idempotency, abort on edited checklist, renumbering
tests/unit/memory-commit-orchestrator.test.js ← pipeline; mocks git/jest/gh; covers each abort path
```

The orchestrator test mocks `child_process.execFileSync` (already a project pattern in `tests/unit/orchestrator/atomic-write.test.js` etc.) so we don't actually shell out during test. Each abort condition gets a test:

| Abort condition               | Test                                                                          |
| ----------------------------- | ----------------------------------------------------------------------------- |
| Dirty working tree            | git status returns non-empty → expect abort with code 1                       |
| On develop/main branch        | git symbolic-ref returns `develop` → expect abort                             |
| Migrator fails                | mock migrateMemory throws → expect abort, no commit                           |
| CLAUDE.md checklist edited    | provide a CLAUDE.md fixture with a different checklist → expect abort         |
| Tests fail                    | mock execFileSync('npx', ['jest']) returns non-zero → expect abort, no commit |
| Validate fails post-migration | mock validateMemory returns ok:false → expect abort                           |
| Happy path no flags           | runs to commit, no push, no PR                                                |
| Happy path --pr               | runs to PR creation; mock gh pr create returns URL                            |

Coverage target ≥85% on new files; full suite ≥80%.

---

## CLAUDE.md Fixture for Patcher Tests

Tests use a small fixture CLAUDE.md, not the real one, to avoid coupling. Fixture:

```markdown
# CLAUDE.md

## Mandatory Session Startup

1. Read `AGENTS.md` in full before writing any code or using any tools.
2. Read `MEMORY.md` and all linked topic files.
3. Read `PROMPT_LOG.md` to understand the prompt history.

## Session Close Checklist

- [ ] All changes committed to feature branch
- [ ] `MEMORY.md` updated with new learnings
- [ ] `progress.md` updated
```

After patcher runs, expected:

```markdown
# CLAUDE.md

## Mandatory Session Startup

1. Read `AGENTS.md` in full before writing any code or using any tools.
2. Read `MEMORY.md` and all linked topic files.
3. Memory files live in `docs/memory/{topics,sessions,snapshots}/`. Read `MEMORY.md` (compact index) at session start; read specific topic files when their topic is relevant to the current task. Do not edit `MEMORY.md` directly — it is auto-regenerated by `generate-plan.js`.
4. Read `PROMPT_LOG.md` to understand the prompt history.

## Session Close Checklist

- [ ] All changes committed to feature branch
- [ ] Memory files updated in `docs/memory/{topics,sessions,snapshots}/`:
- [ ] - For session learnings: `docs/memory/sessions/YYYY-MM-DD-<short-slug>.md` with `# <Title> (Session N, YYYY-MM-DD)` heading
- [ ] - For new stable knowledge: `docs/memory/topics/<topic>.md` (no date prefix in filename)
- [ ] - Do NOT edit `MEMORY.md` directly — it is auto-regenerated by `generate-plan.js`
- [ ] `progress.md` updated
```

Notes: item `3. Read PROMPT_LOG.md` was renumbered to `4`. The Session Close `MEMORY.md` checkbox was replaced by 4 nested lines.

---

## Error Handling Matrix

| Failure                                              | Behaviour                                                                      |
| ---------------------------------------------------- | ------------------------------------------------------------------------------ |
| Pre-flight: dirty tree                               | Abort, exit 1, message `working tree must be clean`                            |
| Pre-flight: on develop/main                          | Abort, exit 1, suggest feature branch                                          |
| Pre-flight: docs/memory/topics/ exists, no `--force` | Abort, exit 1, "already migrated; pass --force"                                |
| Migrate: throws                                      | Abort, exit 1, print stack; user instructed to inspect partial state if any    |
| Patch: CLAUDE.md checklist edited                    | Abort, exit 1, "manual reconciliation required"                                |
| Patch: spec lines already present                    | No-op, continue (idempotency)                                                  |
| Test: failures                                       | Abort, exit 1, print first 50 lines of jest output                             |
| Validate: drift                                      | Abort, exit 1, print diff                                                      |
| Commit: fails                                        | Abort, exit 1, print git error                                                 |
| Push: fails                                          | Print warning; exit 0 (commit landed locally; user can push manually)          |
| PR create: fails                                     | Print warning; exit 0 (commit + push landed; user can `gh pr create` manually) |
| `--dry`: any read-only check fails                   | Abort with the same message as the wet run, but never write                    |

---

## Dependencies

- US-0175 (PR A) must be merged. The orchestrator imports from `tools/lib/memory-{migrator,validator,index}.js` — those don't exist until PR A lands.
- Project must have `gh` CLI installed for `--pr` flag to work. If absent, `--pr` aborts with message "gh CLI required for --pr; install via `brew install gh` or omit the flag".

---

## Out of Scope

- Multi-pass migration for projects that already partially migrated (e.g. some topic files exist but not all). The story assumes a fresh migration from monolithic state. If users hit a half-migrated repo, they reconcile by hand.
- Rollback / unmigrate. Use `git revert` on the migration commit.
- Migration on a project that has no MEMORY.md to begin with. The orchestrator's pre-flight aborts in that case ("MEMORY.md not found").
- Hooks (pre-commit, husky integration). Out of scope; users invoke `migrate-commit` explicitly.

---

## Future Work

- A `migrate-commit --interactive` mode that pauses between pipeline steps for human review.
- A GitHub Action that runs `migrate-commit --pr` automatically when a maintainer adds a `migrate-memory` label to an issue.
- Telemetry: log migration commit count + counts to AI_COST_LOG.md so trends can show "memory migration" as a tracked event.
