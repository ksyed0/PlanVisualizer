# Superpowers Skills Integration

Reference doc for how the superpowers Claude Code plugin integrates with the DM_AGENT pipeline.
Each agent instruction file contains a `## Superpowers Skills` section listing which skills to invoke and when.

---

## Installation

Run inside a Claude Code session:

```bash
/plugin install superpowers@claude-plugins-official
```

## Detection

```bash
[ -d ~/.claude/plugins/cache/claude-plugins-official/superpowers ]
```

`scripts/install.sh` checks this path at install time and prompts to install if absent.

---

## Full Agent × Skill × Stage Map

| Agent                              | Skill                             | When to invoke                                             |
| ---------------------------------- | --------------------------------- | ---------------------------------------------------------- |
| Conductor (DM_AGENT)               | `brainstorming`                   | Before Phase 1 Blueprint — writing or refining stories     |
| Conductor (DM_AGENT)               | `writing-plans`                   | After PO output, before spawning Architect                 |
| Conductor (DM_AGENT)               | `dispatching-parallel-agents`     | Before spawning parallel agents (Phase 3 / Phase 5)        |
| Conductor (DM_AGENT)               | `finishing-a-development-branch`  | Before creating the PR in Phase 6 Polish                   |
| Compass (PO_AGENT)                 | `brainstorming`                   | Before writing or refining any user stories or ACs         |
| Keystone (ARCHITECT_AGENT)         | `writing-plans`                   | Before producing the scaffold plan                         |
| Keystone (ARCHITECT_AGENT)         | `executing-plans`                 | When executing the scaffold tasks                          |
| Pixel (FE_DEV_AGENT)               | `test-driven-development`         | Before writing any implementation code                     |
| Pixel (FE_DEV_AGENT)               | `executing-plans`                 | When working through assigned tasks                        |
| Pixel (FE_DEV_AGENT)               | `finishing-a-development-branch`  | Before pushing the final commit on the branch              |
| Pixel (FE_DEV_AGENT)               | `verification-before-completion`  | Before reporting implementation complete                   |
| Forge (BE_DEV_AGENT)               | `test-driven-development`         | Before writing any implementation code                     |
| Forge (BE_DEV_AGENT)               | `executing-plans`                 | When working through assigned tasks                        |
| Forge (BE_DEV_AGENT)               | `finishing-a-development-branch`  | Before pushing the final commit on the branch              |
| Forge (BE_DEV_AGENT)               | `verification-before-completion`  | Before reporting implementation complete                   |
| Palette (UI_DESIGNER_AGENT)        | `brainstorming`                   | Before exploring design directions                         |
| Palette (UI_DESIGNER_AGENT)        | `frontend-design:frontend-design` | When producing visual specs, mockups, or component designs |
| Lens (CODE_REVIEWER_AGENT)         | `requesting-code-review`          | Before issuing a review verdict                            |
| Lens (CODE_REVIEWER_AGENT)         | `receiving-code-review`           | When the original agent applies Lens's requested changes   |
| Sentinel (FUNCTIONAL_TESTER_AGENT) | `systematic-debugging`            | When a defect or unexpected behaviour is found             |
| Sentinel (FUNCTIONAL_TESTER_AGENT) | `verification-before-completion`  | Before reporting all test cases pass                       |
| Circuit (AUTOMATION_TESTER_AGENT)  | `test-driven-development`         | Before writing any new test suites                         |
| Circuit (AUTOMATION_TESTER_AGENT)  | `systematic-debugging`            | When diagnosing a failing test or coverage gap             |
| Circuit (AUTOMATION_TESTER_AGENT)  | `verification-before-completion`  | Before reporting coverage results                          |

---

## Skill Catalogue

| Skill                             | Purpose                                                                   |
| --------------------------------- | ------------------------------------------------------------------------- |
| `brainstorming`                   | Turn requirements into validated designs before any implementation begins |
| `writing-plans`                   | Produce step-by-step implementation plans from approved designs           |
| `executing-plans`                 | Work through a written plan task-by-task with discipline                  |
| `dispatching-parallel-agents`     | Launch independent sub-agents concurrently and coordinate their results   |
| `test-driven-development`         | Write failing tests before implementation code (red → green → refactor)   |
| `finishing-a-development-branch`  | Ensure a branch is clean, tested, and PR-ready before merging             |
| `verification-before-completion`  | Run a final checklist before claiming any task is done                    |
| `systematic-debugging`            | Diagnose failures methodically rather than guessing at fixes              |
| `requesting-code-review`          | Frame review requests with context so reviewers can give precise verdicts |
| `receiving-code-review`           | Apply review feedback systematically without regressing other areas       |
| `frontend-design:frontend-design` | Produce production-grade UI specs, tokens, and component designs          |
| `subagent-driven-development`     | Drive implementation via spawned sub-agents rather than inline code edits |
