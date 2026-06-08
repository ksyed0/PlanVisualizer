# Session 53 — Start Phase C: First Read Consumer (EPIC-0038)

## Context

Sessions 50–52 completed Phase A (repository foundation) and Phase B (indexer as spectator).
`develop` is now at the post-Phase-B tip with all code merged and 0 CI failures.

**Phase B hard gate achieved:** `npm run plan:lint` on production data → errors=0, warnings=0, reports=0.

## Current state

- **Branch:** `develop` (HEAD = latest after all housekeeping PRs merged)
- **Working worktrees:** none (all Phase A/B worktrees deleted after merge)
- **Plan:** `docs/superpowers/plans/2026-05-19-step-1-repository-abstraction.md`
- **Spec:** `docs/superpowers/specs/2026-05-19-step-1-repository-abstraction-design.md`
- **Phase C backlog:** EPIC-0038, US-0230 and US-0231 in `docs/RELEASE_PLAN.md`

## Phase C — First Read Consumer

**Hard gate:** the rendered `plan-status.html` is byte-identical (or semantically equivalent) when the dashboard reads come from the repository instead of re-parsing markdown.

**Effort:** 2–3 days.

### Task C.1 (US-0230): Base entity repo + Story / Epic / AC read APIs

**Files to create:**

- `tools/lib/repository/entities/base-repo.js`
- `tools/lib/repository/entities/story-repo.js`
- `tools/lib/repository/entities/epic-repo.js`
- `tools/lib/repository/entities/ac-repo.js`
- Modify: `tools/lib/repository/index.js` (expose `repo.stories`, `repo.epics`, `repo.acs`)
- Test: `tests/unit/repository/entities-read.test.js`

**ACs:** AC-0905, AC-0906, AC-0907

### Task C.2 (US-0231): Migrate dashboard read path

**Files to modify/create:**

- Modify: `tools/generate-plan.js` (add `PV_DASHBOARD_VIA_REPO=1` code path)
- Possibly: `tools/lib/dashboard-repo-reader.js` (shim layer)
- Test: `tests/integration/dashboard-parity.test.js` (snapshot comparison both paths)

**ACs:** AC-0908, AC-0909, AC-0910, AC-0911

The plan spec for C.1 and C.2 is at lines ~2564–2857 of
`docs/superpowers/plans/2026-05-19-step-1-repository-abstraction.md`.

## Instructions

1. Create a new worktree from `develop`:

   ```bash
   git worktree add .claude/worktrees/phase-c-entities -b claude/phase-c-entities origin/develop
   ```

2. Use `superpowers:subagent-driven-development` to execute C.1 then C.2 with the same two-stage review loop used in Phases A and B.

3. **Key constraint:** Run indexers first before testing the read path:

   ```bash
   node tools/plan-index.js
   ```

   The entity repos read from SQLite — the index must be populated.

4. **Phase C hard gate:** run both HTML generation paths and diff the output:

   ```bash
   node tools/generate-plan.js  # generates via legacy parse
   cp docs/plan-status.html docs/plan-status.html.legacy
   PV_DASHBOARD_VIA_REPO=1 node tools/generate-plan.js
   diff docs/plan-status.html docs/plan-status.html.legacy
   ```

   Diff must be empty (or only differ in known cosmetic fields).

5. After both tasks are done and gate passes, open a PR `claude/phase-c-entities → develop`.

## Critical context

- The indexer `release-plan-indexer.js` uses two-pass collection + `splitEntitySections()` to handle multi-entity blocks and alt-format epics. The entity repos can simply query SQLite — they don't need to know about these format quirks.
- `Repository.getInstance({root})` is the singleton facade. Add `repo.stories`, `repo.epics`, `repo.acs` to it in `tools/lib/repository/index.js`.
- The column→property mapping for stories: `epic_id → epicId`, `pr_number → prNumber`, `spec_path → specPath`, `plan_path → planPath`, `source_file → sourceFile`, `source_line → sourceLine`.
- `PV_DASHBOARD_VIA_REPO` flag default should flip to `1` only after parity is verified. Keep `0` as the fallback escape hatch.

## Session close checklist (at end)

- `progress.md`, `PROMPT_LOG.md`, `LESSONS.md`, `MEMORY.md`, `AI_COST_LOG.md`
- `docs/RELEASE_PLAN.md`: US-0230, US-0231 Done; EPIC-0038 Done
- Coverage ≥ 80%
- PR opened to `develop`
