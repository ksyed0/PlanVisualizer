---
name: US-0126 Superpowers Skills Integration
description: Design spec for wiring superpowers skills into each DM_AGENT pipeline agent and the install/upgrade scripts
type: spec
story: US-0126
epic: EPIC-0017
date: 2026-04-18
---

# US-0126 — Superpowers Skills Integration Design

## Overview

Map every superpowers skill to the DM_AGENT pipeline stage where it adds the most value, wire those
invocations into each agent instruction file, and ensure the install/upgrade scripts detect whether
the plugin is present and guide users to install it if not.

**Outputs:**
1. `scripts/install.sh` — new §0 that detects the superpowers plugin and prompts to install
2. Each of the 8 `docs/agents/*.md` files — new `## Superpowers Skills` section at the top
3. `docs/skills-integration.md` — rollup reference doc (agent × skill × stage table + catalogue)

**No application code changes.** All deliverables are documentation and shell script edits.

---

## 1. Install Script — Superpowers Detection

### Location

New section `── 0. Check superpowers plugin ──` inserted as the very first step in
`scripts/install.sh`, before step 1 (Copy tool files).

### Detection logic

```bash
# ── 0. Check superpowers plugin ─────────────────────────────────────────────
SP_BASE="$HOME/.claude/plugins/cache/claude-plugins-official/superpowers"
if [ ! -d "$SP_BASE" ]; then
  echo "[install] superpowers plugin not detected at $SP_BASE"
  read -p "[install] Install superpowers for enhanced agent workflows? (y/n) " -n 1 -r; echo
  if [[ $REPLY =~ ^[Yy]$ ]]; then
    echo ""
    echo "[install] Run the following command inside a Claude Code session, then re-run install.sh:"
    echo ""
    echo "  /plugin install superpowers@claude-plugins-official"
    echo ""
    exit 0
  else
    echo "[install] Skipping superpowers. Agent scripts will note skills are optional."
  fi
else
  SP_VER=$(ls "$SP_BASE" | sort -V | tail -1)
  echo "[install] superpowers plugin detected (version: $SP_VER) ✓"
fi
```

### Behaviour table

| State | User answers | Outcome |
|-------|-------------|---------|
| Plugin present | n/a | Silent ✓, continue install |
| Plugin absent | Y | Print slash command, exit 0 (user installs, re-runs) |
| Plugin absent | N | Print skip note, continue install |

### Why exit on Y

`/plugin install superpowers@claude-plugins-official` is a Claude Code slash command — it cannot
be invoked from bash. Exiting cleanly after printing the command is the correct UX: the user
installs in their Claude Code session, then re-runs `install.sh`, which will find the plugin on
the second pass and proceed silently.

---

## 2. Agent Instruction Files — `## Superpowers Skills` Section

### Format

Each agent file receives a new `## Superpowers Skills` section inserted **immediately after the
role header** (the `> Read this file...` callout), before any other content.

```markdown
## Superpowers Skills

> **Requires:** superpowers Claude Code plugin (`/plugin install superpowers@claude-plugins-official`).
> **Check:** `[ -d ~/.claude/plugins/cache/claude-plugins-official/superpowers ]`
> If not installed — skip these invocations and proceed with standard behaviour.

| Stage | Skill to invoke |
|-------|----------------|
| [stage description] | `skill-name` |
```

Only rows applicable to the agent's role are included — no agent carries the full table.

### Per-agent skill tables

**DM_AGENT.md (Conductor)**

| Stage | Skill to invoke |
|-------|----------------|
| Before Phase 1 Blueprint — writing or refining stories | `brainstorming` |
| After PO output, before spawning Architect | `writing-plans` |
| Before spawning parallel agents (Phase 3 Build / Phase 5 Test) | `dispatching-parallel-agents` |
| Before creating the PR in Phase 6 Polish | `finishing-a-development-branch` |

**PO_AGENT.md (Compass)**

| Stage | Skill to invoke |
|-------|----------------|
| Before writing or refining any user stories or ACs | `brainstorming` |

**ARCHITECT_AGENT.md (Keystone)**

| Stage | Skill to invoke |
|-------|----------------|
| Before producing the scaffold plan | `writing-plans` |
| When executing the scaffold tasks | `executing-plans` |

**FE_DEV_AGENT.md (Pixel)**

| Stage | Skill to invoke |
|-------|----------------|
| Before writing any implementation code | `test-driven-development` |
| When working through assigned tasks | `executing-plans` |
| Before pushing the final commit on the branch | `finishing-a-development-branch` |
| Before reporting implementation complete | `verification-before-completion` |

**BE_DEV_AGENT.md (Forge)**

| Stage | Skill to invoke |
|-------|----------------|
| Before writing any implementation code | `test-driven-development` |
| When working through assigned tasks | `executing-plans` |
| Before pushing the final commit on the branch | `finishing-a-development-branch` |
| Before reporting implementation complete | `verification-before-completion` |

**UI_DESIGNER_AGENT.md (Palette)**

| Stage | Skill to invoke |
|-------|----------------|
| Before exploring design directions | `brainstorming` |
| When producing visual specs, mockups, or component designs | `frontend-design:frontend-design` |

**CODE_REVIEWER_AGENT.md (Lens)**

| Stage | Skill to invoke |
|-------|----------------|
| Before issuing a review verdict | `requesting-code-review` |
| When the original agent applies Lens's requested changes | `receiving-code-review` |

**FUNCTIONAL_TESTER_AGENT.md (Sentinel)**

| Stage | Skill to invoke |
|-------|----------------|
| When a defect or unexpected behaviour is found | `systematic-debugging` |
| Before reporting all test cases pass | `verification-before-completion` |

**AUTOMATION_TESTER_AGENT.md (Circuit)**

| Stage | Skill to invoke |
|-------|----------------|
| Before writing any new test suites | `test-driven-development` |
| When diagnosing a failing test or coverage gap | `systematic-debugging` |
| Before reporting coverage results | `verification-before-completion` |

---

## 3. `docs/skills-integration.md` — Reference Doc

### Structure

```
# Superpowers Skills Integration

## Installation
## Detection
## Full Agent × Skill × Stage Map  (table: agent | skill | stage)
## Skill Catalogue                  (one-line per skill used)
```

### Skill catalogue entries (13 skills used across all agents)

| Skill | Purpose |
|-------|---------|
| `brainstorming` | Turn requirements into validated designs before any implementation begins |
| `writing-plans` | Produce step-by-step implementation plans from approved designs |
| `executing-plans` | Work through a written plan task-by-task with discipline |
| `dispatching-parallel-agents` | Launch independent sub-agents concurrently and coordinate their results |
| `subagent-driven-development` | Drive implementation via spawned sub-agents rather than inline code edits |
| `test-driven-development` | Write failing tests before writing implementation code (red → green → refactor) |
| `finishing-a-development-branch` | Ensure a branch is clean, tested, and PR-ready before merging |
| `verification-before-completion` | Run a final checklist before claiming any task is done |
| `systematic-debugging` | Diagnose failures methodically rather than guessing at fixes |
| `requesting-code-review` | Frame review requests with context so reviewers can give precise verdicts |
| `receiving-code-review` | Apply review feedback systematically without regressing other areas |
| `frontend-design:frontend-design` | Produce production-grade UI specs, tokens, and component designs |

---

## 4. RELEASE_PLAN.md Entry — US-0126

```
US-0126 (EPIC-0017): As a developer onboarding to PlanVisualizer, I want the install
script to detect and prompt for the superpowers plugin, and as a Conductor or sub-agent,
I want each agent instruction file to explicitly list which superpowers skills to invoke
at which pipeline stage, so that the full DM_AGENT workflow leverages structured skill
discipline without requiring me to remember which skills apply where.
Priority: High (P0)
Estimate: S
Status: Planned
Branch: feature/US-0126-skills-integration
Acceptance Criteria:
  - [ ] AC-0435: scripts/install.sh §0 detects ~/.claude/plugins/cache/claude-plugins-official/superpowers/; if absent prompts Y/N; if Y prints the slash command and exits; if N continues
  - [ ] AC-0436: All 8 docs/agents/*.md files have a ## Superpowers Skills section immediately after the role header listing applicable skills and stages
  - [ ] AC-0437: The conditional note ("If not installed — skip these invocations") is present in every agent file's Skills section
  - [ ] AC-0438: docs/skills-integration.md is created with installation instructions, the full agent × skill × stage table, and the skill catalogue
  - [ ] AC-0439: docs/skills-integration.md skill catalogue covers all 12 skills listed in §3 of this spec
  - [ ] AC-0440: docs/ID_REGISTRY.md AC sequence updated to AC-0441 after this story is written
```

---

## 5. Files Changed

| File | Change |
|------|--------|
| `scripts/install.sh` | Add §0 superpowers detection block |
| `docs/agents/DM_AGENT.md` | Add `## Superpowers Skills` section |
| `docs/agents/PO_AGENT.md` | Add `## Superpowers Skills` section |
| `docs/agents/ARCHITECT_AGENT.md` | Add `## Superpowers Skills` section |
| `docs/agents/FE_DEV_AGENT.md` | Add `## Superpowers Skills` section |
| `docs/agents/BE_DEV_AGENT.md` | Add `## Superpowers Skills` section |
| `docs/agents/UI_DESIGNER_AGENT.md` | Add `## Superpowers Skills` section |
| `docs/agents/CODE_REVIEWER_AGENT.md` | Add `## Superpowers Skills` section |
| `docs/agents/FUNCTIONAL_TESTER_AGENT.md` | Add `## Superpowers Skills` section |
| `docs/agents/AUTOMATION_TESTER_AGENT.md` | Add `## Superpowers Skills` section |
| `docs/skills-integration.md` | Create (new file) |
| `docs/RELEASE_PLAN.md` | Add US-0126 story block under EPIC-0017 |
| `docs/ID_REGISTRY.md` | Update AC next → AC-0441, US next → US-0127 |
