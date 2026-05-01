# AGENT_PLAN.md — Agent Pipeline Reference

> Source of truth for the 6-phase delivery pipeline, PR review lifecycle,
> and BLOCK recovery protocol. Content derived from `docs/agents/DM_AGENT.md`.

---

## 1. 6-Phase Pipeline Overview

| Phase              | Agent(s)                                                  | Purpose                                                               | Key Deliverable                                                              |
| ------------------ | --------------------------------------------------------- | --------------------------------------------------------------------- | ---------------------------------------------------------------------------- |
| 1 Blueprint        | Product Owner                                             | Review and prioritise the backlog; refine ACs and priority order      | Updated `docs/RELEASE_PLAN.md` with refined ACs and priority order           |
| 2 Architect        | Architect, Code Reviewer                                  | Scaffold the project; create types, service interfaces, providers     | Compiling scaffold on a pushed branch; Reviewer APPROVE                      |
| 3 Build (parallel) | UI Designer, Backend Dev, Frontend Dev, Code Reviewer     | Implement services, mock data, screens, and components                | Passing service tests + rendered screens; Reviewer APPROVE for both branches |
| 4 Integration      | Frontend Dev, Code Reviewer                               | Wire services to all screens via hooks; verify end-to-end flows       | End-to-end flows pass all ACs; Reviewer APPROVE                              |
| 5 Test (parallel)  | Functional Tester (Sentinel), Automation Tester (Circuit) | Execute test cases; raise bugs; generate coverage report              | Test execution report in `progress.md`; coverage report generated            |
| 6 Polish           | Backend Dev / Frontend Dev, Conductor                     | Fix critical bugs; final merge; update all docs; verify CI; demo prep | No critical bugs open; development branch merged; CI green; demo ready       |

---

## 2. Phase Entry / Exit Criteria

### Phase 1: Blueprint

**Entry:** Release plan exists with a backlog of stories and at least one unrefined epic.

**Spawn:**

- Product Owner — task: "Review and prioritise the backlog. Update `docs/RELEASE_PLAN.md` with refined ACs and priority order for the available time."

**Exit criteria (must all be true before advancing):**

- `docs/RELEASE_PLAN.md` updated with refined ACs and priority order.
- `progress.md` updated with the prioritised backlog.

---

### Phase 2: Architect

**Entry:** Blueprint exit criteria met; `docs/RELEASE_PLAN.md` has a final priority order.

**Spawn:**

1. Architect — task: scaffold project, create types, implement service interfaces, set up providers on an assigned branch.
2. Code Reviewer — review Architect's output.
   - If APPROVE → advance to Phase 3.
   - If REQUEST CHANGES → re-spawn Architect with fix instructions (max 2 retries).
   - If BLOCK → escalate to human.

**Exit criteria:**

- Architect's scaffold compiles (no errors).
- Code Reviewer verdict: APPROVE.
- Branch pushed to remote.
- `progress.md` and `RELEASE_PLAN.md` task statuses updated.

---

### Phase 3: Build (Parallel)

**Entry:** Architect's scaffold branch is approved and pushed.

**Spawn (parallel):** 0. UI Designer (if applicable) — define design tokens and component style specs.

1. Backend Dev — implement all service methods, create mock data on an assigned branch.
2. Frontend Dev — build all screens and components per design system on a separate branch.

Both agents run concurrently with `isolation: "worktree"`.

After both complete:

- Spawn Code Reviewer to review both branches.
- If REQUEST CHANGES → re-spawn the relevant agent (max 2 retries, then 1 review retry).
- If BLOCK → escalate to human.
- Merge branches and verify integration.

**Exit criteria:**

- Backend Dev's services have passing tests.
- Frontend Dev's screens render correctly.
- Code Reviewer verdict: APPROVE for both branches.

---

### Phase 4: Integration

**Entry:** Both Build branches are approved and merged.

**Spawn:**

1. Frontend Dev — merge and wire services to all screens via hooks; verify end-to-end flows per ACs on an assigned branch.
2. Code Reviewer — review integration.

**Exit criteria:**

- End-to-end flows work per all acceptance criteria.
- Code Reviewer verdict: APPROVE.
- `progress.md` updated.

---

### Phase 5: Test (Parallel)

**Entry:** Integration branch is approved and pushed.

**Spawn (parallel):**

1. Functional Tester (Sentinel) — execute test cases from `docs/TEST_CASES.md`; log results; raise bugs in `docs/BUGS.md`.
2. Automation Tester (Circuit) — create test suites for services and components; generate coverage report.

Both agents run concurrently with `isolation: "worktree"`.

After both complete:

- Review test results — route critical bugs back to Backend Dev or Frontend Dev.
- `progress.md` updated with test execution report.

**Exit criteria:**

- Functional Tester's report is in `progress.md`.
- Automation Tester's suites pass.
- Coverage report generated at `docs/coverage/coverage-summary.json`.

---

### Phase 6: Polish

**Entry:** Test phase exit criteria met.

**Steps:**

1. If critical bugs exist, spawn Backend Dev or Frontend Dev to fix them (max 1 retry per bug).
2. Final merge to main development branch.
3. Update all documentation: `RELEASE_PLAN.md`, `progress.md`, `docs/AI_COST_LOG.md`.
4. After pushing to remote, verify CI checks pass.
5. Prepare demo talking points.

**Exit criteria (no hard timeout for this phase):**

- All critical bugs fixed.
- Development branch has final merge.
- Demo talking points documented.

---

## 3. PR Review Lifecycle

Adopted 2026-04-14. Every user story flows through this exact sequence. Agents never merge themselves — the Conductor does.

### Step 1 — Pre-spawn: ensure a fresh baseline

```bash
# In the main repo checkout (NOT a worktree)
git checkout develop
git pull origin develop
# Verify CI is green before starting a new story
gh run list --branch develop --limit 1 --json conclusion --jq '.[].conclusion'  # must be "success"
```

If develop CI is failing, fix the baseline first via a `chore/*` PR before starting any story. A failing baseline blocks every story PR.

### Step 2 — Implementation (Phase 3 Build)

Spawn Pixel (Frontend Dev), Forge (Backend Dev), or both in parallel with `isolation: "worktree"`. Worktree inherits the fresh develop state.

- Agent creates `feature/US-XXXX-short-name`, implements, commits, pushes.
- Agent does **not** create a PR — the Conductor does that after review.

### Step 3 — Pre-review sync

```bash
cd <worktree>
git fetch origin develop
git rebase origin/develop
# If conflict: respawn Pixel with conflict context + "resolve and push --force-with-lease", max 1 retry
# If clean:
git push --force-with-lease origin feature/US-XXXX-short-name
```

### Step 4 — Code Review (Phase 3 cont.)

Spawn Lens (Code Reviewer) with `isolation: "worktree"` pointing at the feature branch. Lens returns:

- **APPROVE** → proceed to Phase 5 Test.
- **REQUEST CHANGES** → respawn the original agent with Lens's findings (max 1 retry), then back to pre-review sync.
- **BLOCK** → escalate to human per Escalation Workflow (section 4).

### Step 5 — Test (Phase 5)

Spawn Sentinel (Functional Tester) and Circuit (Automation Tester) in parallel, each with `isolation: "worktree"`:

- **Sentinel**: Playwright-based visual/behavioral verification; may open a new BUG-XXXX if defects found.
- **Circuit**: test coverage audit; adds missing parameterised assertions.

Both commit to the same feature branch — the Conductor merges everything together.

### Step 6 — Create PR and auto-merge (Phase 6 Polish)

```bash
gh pr create \
  --base develop \
  --head feature/US-XXXX-short-name \
  --title "[feat] US-XXXX (EPIC-YYYY): <summary>" \
  --body "<body citing Pixel/Lens/Sentinel/Circuit contributions, ACs satisfied, linked bugs>"

gh pr review <num> --approve --body "<Lens's verdict summary>"

# Auto-merge when CI goes green — Conductor does not wait
gh pr merge <num> --auto --squash --delete-branch
```

**CI gates that must pass:** Lint, Test + Coverage Gate, Build, Orchestrator, Prettier, Dependency Audit, CodeQL SAST, Secret Scan, Analyze JavaScript.

### Step 7 — Post-merge sync

```bash
git checkout develop
git pull origin develop          # gets the squashed commit
git worktree remove <worktree-path> --force
```

Then update `docs/RELEASE_PLAN.md` for the merged story:

- Change `Status: Planned` → `Status: Done`
- Change all `- [ ] AC-XXXX:` → `- [x] AC-XXXX:`

This is the authoritative write-back; per-story PRs (agents) only write code.

---

## 4. BLOCK Recovery Protocol

A BLOCK is issued by a Code Reviewer when the code has an issue that the Conductor cannot resolve by retrying the agent.

### Trigger: Reviewer returns BLOCK

1. **Pause orchestration** — do not spawn any more agents.
2. **Update `docs/sdlc-status.json`** — set the current phase status to `"blocked"` and the blocking agent's status to `"blocked"`.
3. **Write a BLOCKED entry in `progress.md`:**
   ```
   ### BLOCKED — [Phase Name]
   **Blocking issue:** [1-2 sentence description]
   **Reviewer verdict:** BLOCK
   **Affected branch:** [branch name]
   **Affected stories:** [story ID list]
   **What the human needs to do:** [specific action]
   **Resume from:** [exact step]
   ```
4. **Print to terminal:** `"ORCHESTRATION BLOCKED — see progress.md for details and resume instructions."`
5. **Stop.** Do not continue until the human resolves the issue and explicitly says "resume".

### Recovery after human fix

1. Verify the human committed fixes to the affected branch.
2. Re-spawn Code Reviewer with context: "Human fixed the BLOCK issue on `[branch]`. Re-review for merge readiness."
3. **If APPROVE** → merge and continue to next phase.
4. **If REQUEST CHANGES** → one retry of the original agent with reviewer findings.
5. **If BLOCK again** → re-escalate to human with updated details. **Do not loop.**

### Parallel agent failure coordination

When running agents in parallel (e.g., Backend Dev + Frontend Dev in Phase 3):

| Scenario                                 | Action                                                                                             |
| ---------------------------------------- | -------------------------------------------------------------------------------------------------- |
| One agent completes, other still running | Wait for both before proceeding to review                                                          |
| One agent fails (crash / bad output)     | Let the other finish. Retry failed agent per Error Handling SOP. Review both when ready.           |
| One agent's work is BLOCKed              | Other agent's work can still be reviewed and merged independently. Escalate only the blocked work. |
| Both agents fail                         | Retry each independently per max retry counts. If both exhaust retries, escalate the phase.        |
| Merge conflict between parallel branches | Resolve conflict before spawning reviewer. Prefer the branch merged first; rebase the second.      |

**Key rule:** A failure in one parallel agent does NOT automatically block the other.

### Retry state tracking

Track retry counts in `progress.md` to prevent infinite loops. Append after each retry:

```
### Retry Log
| Task | Agent | Attempt | Max | Outcome | Timestamp |
|------|-------|---------|-----|---------|-----------|
```

- Read the retry log before every re-spawn to check the current count.
- If `Attempt >= Max`, stop retrying — log failure, skip task, continue.
- Never reset retry counts for the same task.
