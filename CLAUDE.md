# CLAUDE.md — Claude Code Session Instructions

> **Platform file for Claude Code.** The authoritative operating standards are in `AGENTS.md`. This file adds Claude-specific directives and serves as the session entry point.

---

## Mandatory Session Startup

1. Read `AGENTS.md` in full before writing any code or using any tools.
2. Read `MEMORY.md` and all linked topic files.
3. Read `PROMPT_LOG.md` to understand the prompt history and where the last session ended.
4. Check `docs/ID_REGISTRY.md` before creating any new artefact (epic, story, task, AC, TC, bug).

---

## Project at a Glance

- **Repo:** `ksyed0/PlanVisualizer`
- **Purpose:** Parse project markdown files and generate a static HTML dashboard.
- **Entry point:** `node tools/generate-plan.js`
- **Dashboard:** `https://ksyed0.github.io/PlanVisualizer/plan-status.html`
- **Project Constitution:** `PROJECT.md` (create if missing; see AGENTS.md §3)

---

## Key Protocols (from AGENTS.md)

| Protocol | Rule |
|----------|------|
| §1 Sequential Execution | **Disabled** — parallel agents permitted |
| §4 Prompt Logging | Log every user prompt to `PROMPT_LOG.md` with timestamp |
| §8 Unit Testing | ≥80% coverage; all tests pass before any commit |
| §11 Git Workflow | `feature/*` → `develop` (PR) → `main` (PR). Never push directly to `main` or `develop` |
| §14 Session Close | Update `progress.md`, `MEMORY.md`, `PROMPT_LOG.md`, `LESSONS.md`, `MIGRATION_LOG.md` before ending |

---

## Git Branching Quick Reference

```
feature/US-XXXX-short-name    → squash-merge into develop via PR
bugfix/BUG-XXXX-short-name    → squash-merge into develop via PR
release/X.Y.Z                 → merge into main via PR
hotfix/BUG-XXXX-short-name    → branch from main, merge into main + develop
```

Both `main` and `develop` are **protected** — CI (Lint + Test & Coverage Gate + Dependency Audit) must pass.

---

## Commit Message Format

```
[TYPE] US-XXXX | TASK-XXXX: Short imperative description (max 72 chars)
```

Types: `feat`, `fix`, `test`, `docs`, `refactor`, `chore`, `style`, `perf`

---

## Session Close Checklist

- [ ] All changes committed to feature branch, PR opened to `develop`
- [ ] `progress.md` updated with what was done, test results, blockers
- [ ] `MEMORY.md` updated with new learnings
- [ ] `PROMPT_LOG.md` updated with all prompts from this session
- [ ] `MIGRATION_LOG.md` updated if cross-platform changes were made
- [ ] `docs/LESSONS.md` updated if bugs were fixed or lessons learned
- [ ] Coverage verified above 80%
