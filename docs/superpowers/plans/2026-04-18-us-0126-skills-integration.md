# US-0126 Superpowers Skills Integration — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Wire superpowers skill invocations into every DM_AGENT pipeline agent file, add superpowers detection to the install script, and create a single reference doc mapping all agents to their skills.

**Architecture:** Pure documentation and shell script edits — no application code changes. All agent files get a `## Superpowers Skills` section inserted after their opening callout block. `scripts/install.sh` gets a §0 detection block. A new `docs/skills-integration.md` consolidates the full map.

**Tech Stack:** Bash (install.sh), Markdown (agent files + reference doc), no new dependencies.

---

## Task 1: Register US-0126 in RELEASE_PLAN.md and update ID_REGISTRY.md

**Files:**
- Modify: `docs/RELEASE_PLAN.md` (EPIC-0017 section, currently at bottom of file — search for `## User Stories — EPIC-0017`)
- Modify: `docs/ID_REGISTRY.md`

- [ ] **Step 1: Read the EPIC-0017 section in RELEASE_PLAN.md**

Run: `grep -n "EPIC-0017" docs/RELEASE_PLAN.md`
Find the line: `_(No stories yet — this epic starts with a review/gap analysis session. Stories will be added after the review concludes.)_`

- [ ] **Step 2: Replace the placeholder with the US-0126 story block**

Replace the placeholder line with:

```markdown
```
US-0126 (EPIC-0017): As a developer onboarding to PlanVisualizer, I want the install script to detect and prompt for the superpowers plugin, and as a Conductor or sub-agent, I want each agent instruction file to explicitly list which superpowers skills to invoke at which pipeline stage, so that the full DM_AGENT workflow leverages structured skill discipline without requiring me to remember which skills apply where.
Priority: High (P0)
Estimate: S
Status: Planned
Branch: feature/US-0126-skills-integration
Acceptance Criteria:
  - [ ] AC-0435: scripts/install.sh §0 detects ~/.claude/plugins/cache/claude-plugins-official/superpowers/; if absent prompts Y/N; if Y prints the slash command and exits; if N continues
  - [ ] AC-0436: All 8 docs/agents/*.md files have a ## Superpowers Skills section immediately after the opening callout block listing applicable skills and stages
  - [ ] AC-0437: The conditional note ("If not installed — skip these invocations") is present in every agent file's Skills section
  - [ ] AC-0438: docs/skills-integration.md is created with installation instructions, full agent × skill × stage table, and skill catalogue
  - [ ] AC-0439: docs/skills-integration.md skill catalogue covers all 12 skills listed in the design spec
  - [ ] AC-0440: docs/ID_REGISTRY.md AC sequence updated to AC-0441 after this story is written
Dependencies: EPIC-0013, EPIC-0016
```
```

- [ ] **Step 3: Update ID_REGISTRY.md**

In `docs/ID_REGISTRY.md`, update two rows:

```
| US           | US-0127               | US-0126           |
| AC           | AC-0441               | AC-0440           |
```

- [ ] **Step 4: Verify**

Run: `grep -A 3 "US-0126" docs/RELEASE_PLAN.md`
Expected: Story block with `Status: Planned` is present.

Run: `grep "US-0127\|AC-0441" docs/ID_REGISTRY.md`
Expected: Both lines present.

- [ ] **Step 5: Commit**

```bash
git add docs/RELEASE_PLAN.md docs/ID_REGISTRY.md
git commit -m "[docs] US-0126: register story in RELEASE_PLAN + update ID registry"
```

---

## Task 2: Add superpowers detection to scripts/install.sh

**Files:**
- Modify: `scripts/install.sh` (insert new §0 before the existing `# ── 1. Copy tool files` line)

- [ ] **Step 1: Read the top of install.sh to find the insertion point**

Run: `grep -n "── 1. Copy tool files" scripts/install.sh`
Note the line number. The new §0 block goes immediately before that line.

- [ ] **Step 2: Insert the §0 detection block**

Insert the following block immediately before the `# ── 1. Copy tool files` line:

```bash
# ── 0. Check superpowers plugin ─────────────────────────────────────────────
# superpowers enhances agent workflows via structured skill invocations.
# Cannot be auto-installed — it requires a Claude Code slash command.
SP_BASE="$HOME/.claude/plugins/cache/claude-plugins-official/superpowers"
if [ ! -d "$SP_BASE" ]; then
  echo ""
  echo "[install] superpowers plugin not detected at $SP_BASE"
  read -p "[install] Install superpowers for enhanced agent workflows? (y/n) " -n 1 -r; echo
  if [[ $REPLY =~ ^[Yy]$ ]]; then
    echo ""
    echo "[install] Run the following inside a Claude Code session, then re-run install.sh:"
    echo ""
    echo "  /plugin install superpowers@claude-plugins-official"
    echo ""
    exit 0
  else
    echo "[install] Skipping superpowers. Agent files note skills are optional when not installed."
    echo ""
  fi
else
  SP_VER=$(ls "$SP_BASE" | sort -V | tail -1)
  echo "[install] superpowers plugin detected (v${SP_VER}) ✓"
fi

```

- [ ] **Step 3: Verify the script is syntactically valid**

Run: `bash -n scripts/install.sh`
Expected: no output (exit 0 = valid syntax).

- [ ] **Step 4: Verify the detection path logic**

Run: `grep -A 20 "── 0. Check superpowers" scripts/install.sh`
Expected: Full block with `SP_BASE`, `read -p`, `exit 0` on Y path, and the else-continue path.

- [ ] **Step 5: Commit**

```bash
git add scripts/install.sh
git commit -m "[feat] US-0126: add superpowers detection to install.sh (AC-0435)"
```

---

## Task 3: Create docs/skills-integration.md

**Files:**
- Create: `docs/skills-integration.md`

- [ ] **Step 1: Create the file with full content**

Create `docs/skills-integration.md` with exactly:

```markdown
# Superpowers Skills Integration

Reference doc for how the [superpowers Claude Code plugin](https://claude.com/plugins/superpowers)
integrates with the DM_AGENT pipeline. Each agent instruction file contains a `## Superpowers Skills`
section that lists which skills to invoke and when.

---

## Installation

```bash
# Run inside a Claude Code session:
/plugin install superpowers@claude-plugins-official
```

## Detection

```bash
[ -d ~/.claude/plugins/cache/claude-plugins-official/superpowers ]
```

`scripts/install.sh` checks this path at install time and prompts to install if absent.

---

## Full Agent × Skill × Stage Map

| Agent | Skill | When to invoke |
|-------|-------|----------------|
| Conductor (DM_AGENT) | `brainstorming` | Before Phase 1 Blueprint — writing or refining stories |
| Conductor (DM_AGENT) | `writing-plans` | After PO output, before spawning Architect |
| Conductor (DM_AGENT) | `dispatching-parallel-agents` | Before spawning parallel agents (Phase 3 / Phase 5) |
| Conductor (DM_AGENT) | `finishing-a-development-branch` | Before creating the PR in Phase 6 Polish |
| Compass (PO_AGENT) | `brainstorming` | Before writing or refining any user stories or ACs |
| Keystone (ARCHITECT_AGENT) | `writing-plans` | Before producing the scaffold plan |
| Keystone (ARCHITECT_AGENT) | `executing-plans` | When executing the scaffold tasks |
| Pixel (FE_DEV_AGENT) | `test-driven-development` | Before writing any implementation code |
| Pixel (FE_DEV_AGENT) | `executing-plans` | When working through assigned tasks |
| Pixel (FE_DEV_AGENT) | `finishing-a-development-branch` | Before pushing the final commit on the branch |
| Pixel (FE_DEV_AGENT) | `verification-before-completion` | Before reporting implementation complete |
| Forge (BE_DEV_AGENT) | `test-driven-development` | Before writing any implementation code |
| Forge (BE_DEV_AGENT) | `executing-plans` | When working through assigned tasks |
| Forge (BE_DEV_AGENT) | `finishing-a-development-branch` | Before pushing the final commit on the branch |
| Forge (BE_DEV_AGENT) | `verification-before-completion` | Before reporting implementation complete |
| Palette (UI_DESIGNER_AGENT) | `brainstorming` | Before exploring design directions |
| Palette (UI_DESIGNER_AGENT) | `frontend-design:frontend-design` | When producing visual specs, mockups, or component designs |
| Lens (CODE_REVIEWER_AGENT) | `requesting-code-review` | Before issuing a review verdict |
| Lens (CODE_REVIEWER_AGENT) | `receiving-code-review` | When the original agent applies Lens's requested changes |
| Sentinel (FUNCTIONAL_TESTER_AGENT) | `systematic-debugging` | When a defect or unexpected behaviour is found |
| Sentinel (FUNCTIONAL_TESTER_AGENT) | `verification-before-completion` | Before reporting all test cases pass |
| Circuit (AUTOMATION_TESTER_AGENT) | `test-driven-development` | Before writing any new test suites |
| Circuit (AUTOMATION_TESTER_AGENT) | `systematic-debugging` | When diagnosing a failing test or coverage gap |
| Circuit (AUTOMATION_TESTER_AGENT) | `verification-before-completion` | Before reporting coverage results |

---

## Skill Catalogue

| Skill | Purpose |
|-------|---------|
| `brainstorming` | Turn requirements into validated designs before any implementation begins |
| `writing-plans` | Produce step-by-step implementation plans from approved designs |
| `executing-plans` | Work through a written plan task-by-task with discipline |
| `dispatching-parallel-agents` | Launch independent sub-agents concurrently and coordinate their results |
| `test-driven-development` | Write failing tests before implementation code (red → green → refactor) |
| `finishing-a-development-branch` | Ensure a branch is clean, tested, and PR-ready before merging |
| `verification-before-completion` | Run a final checklist before claiming any task is done |
| `systematic-debugging` | Diagnose failures methodically rather than guessing at fixes |
| `requesting-code-review` | Frame review requests with context so reviewers can give precise verdicts |
| `receiving-code-review` | Apply review feedback systematically without regressing other areas |
| `frontend-design:frontend-design` | Produce production-grade UI specs, tokens, and component designs |
| `subagent-driven-development` | Drive implementation via spawned sub-agents rather than inline code edits |
```

- [ ] **Step 2: Verify the file was created and has all 24 table rows**

Run: `grep -c "^|" docs/skills-integration.md`
Expected: 28 (4 header rows + 24 data rows).

- [ ] **Step 3: Commit**

```bash
git add docs/skills-integration.md
git commit -m "[docs] US-0126: create skills-integration.md reference doc (AC-0438, AC-0439)"
```

---

## Task 4: Add ## Superpowers Skills to DM_AGENT.md

**Files:**
- Modify: `docs/agents/DM_AGENT.md` (insert after line 4 — after the `> **You are the orchestrator...` callout)

- [ ] **Step 1: Verify insertion point**

Run: `head -6 docs/agents/DM_AGENT.md`
Expected output:
```
# Conductor — Delivery Manager Agent

> **Read this file in full before starting any work.**
> **You are the orchestrator. You do NOT write application code. You coordinate agents.**

## Role
```

- [ ] **Step 2: Insert the Superpowers Skills section**

Insert the following block between the closing `>` callout line and the `## Role` heading (i.e., replace the blank line between them):

```markdown

## Superpowers Skills

> **Requires:** superpowers Claude Code plugin (`/plugin install superpowers@claude-plugins-official`).
> **Check:** `[ -d ~/.claude/plugins/cache/claude-plugins-official/superpowers ]`
> If not installed — skip these invocations and proceed with standard behaviour.

| Stage | Skill to invoke |
|-------|----------------|
| Before Phase 1 Blueprint — writing or refining stories | `brainstorming` |
| After PO output, before spawning Architect | `writing-plans` |
| Before spawning parallel agents (Phase 3 Build / Phase 5 Test) | `dispatching-parallel-agents` |
| Before creating the PR in Phase 6 Polish | `finishing-a-development-branch` |

```

- [ ] **Step 3: Verify**

Run: `grep -A 10 "## Superpowers Skills" docs/agents/DM_AGENT.md | head -12`
Expected: The section header, the `>` prerequisite block, and the 4-row table.

- [ ] **Step 4: Commit**

```bash
git add docs/agents/DM_AGENT.md
git commit -m "[docs] US-0126: add Superpowers Skills section to DM_AGENT.md"
```

---

## Task 5: Add ## Superpowers Skills to PO_AGENT.md

**Files:**
- Modify: `docs/agents/PO_AGENT.md` (insert after the opening `>` callout, before `## Role`)

- [ ] **Step 1: Verify insertion point**

Run: `head -6 docs/agents/PO_AGENT.md`
Expected: `# Compass — Product Owner Agent` → `> **Read this file...` → blank line → `## Role`

- [ ] **Step 2: Insert the section**

Insert between the callout and `## Role`:

```markdown

## Superpowers Skills

> **Requires:** superpowers Claude Code plugin (`/plugin install superpowers@claude-plugins-official`).
> **Check:** `[ -d ~/.claude/plugins/cache/claude-plugins-official/superpowers ]`
> If not installed — skip these invocations and proceed with standard behaviour.

| Stage | Skill to invoke |
|-------|----------------|
| Before writing or refining any user stories or ACs | `brainstorming` |

```

- [ ] **Step 3: Verify**

Run: `grep -A 8 "## Superpowers Skills" docs/agents/PO_AGENT.md`
Expected: Section with 1-row table.

- [ ] **Step 4: Commit**

```bash
git add docs/agents/PO_AGENT.md
git commit -m "[docs] US-0126: add Superpowers Skills section to PO_AGENT.md"
```

---

## Task 6: Add ## Superpowers Skills to ARCHITECT_AGENT.md

**Files:**
- Modify: `docs/agents/ARCHITECT_AGENT.md`

- [ ] **Step 1: Verify insertion point**

Run: `head -6 docs/agents/ARCHITECT_AGENT.md`
Expected: `# Keystone — Architect Agent` → `> **Read this file...` → blank line → `## Role`

- [ ] **Step 2: Insert the section**

```markdown

## Superpowers Skills

> **Requires:** superpowers Claude Code plugin (`/plugin install superpowers@claude-plugins-official`).
> **Check:** `[ -d ~/.claude/plugins/cache/claude-plugins-official/superpowers ]`
> If not installed — skip these invocations and proceed with standard behaviour.

| Stage | Skill to invoke |
|-------|----------------|
| Before producing the scaffold plan | `writing-plans` |
| When executing the scaffold tasks | `executing-plans` |

```

- [ ] **Step 3: Verify**

Run: `grep -A 9 "## Superpowers Skills" docs/agents/ARCHITECT_AGENT.md`
Expected: Section with 2-row table.

- [ ] **Step 4: Commit**

```bash
git add docs/agents/ARCHITECT_AGENT.md
git commit -m "[docs] US-0126: add Superpowers Skills section to ARCHITECT_AGENT.md"
```

---

## Task 7: Add ## Superpowers Skills to FE_DEV_AGENT.md

**Files:**
- Modify: `docs/agents/FE_DEV_AGENT.md`

- [ ] **Step 1: Verify insertion point**

Run: `head -6 docs/agents/FE_DEV_AGENT.md`
Expected: `# Pixel — Frontend Developer Agent` → `> **Read this file...` → blank line → `## Role`

- [ ] **Step 2: Insert the section**

```markdown

## Superpowers Skills

> **Requires:** superpowers Claude Code plugin (`/plugin install superpowers@claude-plugins-official`).
> **Check:** `[ -d ~/.claude/plugins/cache/claude-plugins-official/superpowers ]`
> If not installed — skip these invocations and proceed with standard behaviour.

| Stage | Skill to invoke |
|-------|----------------|
| Before writing any implementation code | `test-driven-development` |
| When working through assigned tasks | `executing-plans` |
| Before pushing the final commit on the branch | `finishing-a-development-branch` |
| Before reporting implementation complete | `verification-before-completion` |

```

- [ ] **Step 3: Verify**

Run: `grep -A 11 "## Superpowers Skills" docs/agents/FE_DEV_AGENT.md`
Expected: Section with 4-row table.

- [ ] **Step 4: Commit**

```bash
git add docs/agents/FE_DEV_AGENT.md
git commit -m "[docs] US-0126: add Superpowers Skills section to FE_DEV_AGENT.md"
```

---

## Task 8: Add ## Superpowers Skills to BE_DEV_AGENT.md

**Files:**
- Modify: `docs/agents/BE_DEV_AGENT.md`

- [ ] **Step 1: Verify insertion point**

Run: `head -6 docs/agents/BE_DEV_AGENT.md`
Expected: `# Forge — Backend Developer Agent` → `> **Read this file...` → blank line → `## Role`

- [ ] **Step 2: Insert the section**

```markdown

## Superpowers Skills

> **Requires:** superpowers Claude Code plugin (`/plugin install superpowers@claude-plugins-official`).
> **Check:** `[ -d ~/.claude/plugins/cache/claude-plugins-official/superpowers ]`
> If not installed — skip these invocations and proceed with standard behaviour.

| Stage | Skill to invoke |
|-------|----------------|
| Before writing any implementation code | `test-driven-development` |
| When working through assigned tasks | `executing-plans` |
| Before pushing the final commit on the branch | `finishing-a-development-branch` |
| Before reporting implementation complete | `verification-before-completion` |

```

- [ ] **Step 3: Verify**

Run: `grep -A 11 "## Superpowers Skills" docs/agents/BE_DEV_AGENT.md`
Expected: Section with 4-row table (identical to Pixel — both dev agents share the same discipline).

- [ ] **Step 4: Commit**

```bash
git add docs/agents/BE_DEV_AGENT.md
git commit -m "[docs] US-0126: add Superpowers Skills section to BE_DEV_AGENT.md"
```

---

## Task 9: Add ## Superpowers Skills to UI_DESIGNER_AGENT.md

**Files:**
- Modify: `docs/agents/UI_DESIGNER_AGENT.md`

- [ ] **Step 1: Verify insertion point**

Run: `head -6 docs/agents/UI_DESIGNER_AGENT.md`
Expected: `# Palette — UI Designer Agent` → `> **Read this file...` → blank line → `## Role`

- [ ] **Step 2: Insert the section**

```markdown

## Superpowers Skills

> **Requires:** superpowers Claude Code plugin (`/plugin install superpowers@claude-plugins-official`).
> **Check:** `[ -d ~/.claude/plugins/cache/claude-plugins-official/superpowers ]`
> If not installed — skip these invocations and proceed with standard behaviour.
> **Also requires:** frontend-design plugin (`/plugin install frontend-design@claude-plugins-official`) for the design skill row.

| Stage | Skill to invoke |
|-------|----------------|
| Before exploring design directions | `brainstorming` |
| When producing visual specs, mockups, or component designs | `frontend-design:frontend-design` |

```

- [ ] **Step 3: Verify**

Run: `grep -A 10 "## Superpowers Skills" docs/agents/UI_DESIGNER_AGENT.md`
Expected: Section with 4-line `>` block (extra frontend-design note) and 2-row table.

- [ ] **Step 4: Commit**

```bash
git add docs/agents/UI_DESIGNER_AGENT.md
git commit -m "[docs] US-0126: add Superpowers Skills section to UI_DESIGNER_AGENT.md"
```

---

## Task 10: Add ## Superpowers Skills to CODE_REVIEWER_AGENT.md

**Files:**
- Modify: `docs/agents/CODE_REVIEWER_AGENT.md`

- [ ] **Step 1: Verify insertion point**

Run: `head -7 docs/agents/CODE_REVIEWER_AGENT.md`
Expected: `# Lens — Code Reviewer Agent` → two `>` callout lines → blank line → `## Role` (or similar section)

- [ ] **Step 2: Insert the section**

Insert after the last `>` callout line and before the next `##` heading:

```markdown

## Superpowers Skills

> **Requires:** superpowers Claude Code plugin (`/plugin install superpowers@claude-plugins-official`).
> **Check:** `[ -d ~/.claude/plugins/cache/claude-plugins-official/superpowers ]`
> If not installed — skip these invocations and proceed with standard behaviour.

| Stage | Skill to invoke |
|-------|----------------|
| Before issuing a review verdict | `requesting-code-review` |
| When the original agent applies Lens's requested changes | `receiving-code-review` |

```

- [ ] **Step 3: Verify**

Run: `grep -A 9 "## Superpowers Skills" docs/agents/CODE_REVIEWER_AGENT.md`
Expected: Section with 2-row table.

- [ ] **Step 4: Commit**

```bash
git add docs/agents/CODE_REVIEWER_AGENT.md
git commit -m "[docs] US-0126: add Superpowers Skills section to CODE_REVIEWER_AGENT.md"
```

---

## Task 11: Add ## Superpowers Skills to FUNCTIONAL_TESTER_AGENT.md

**Files:**
- Modify: `docs/agents/FUNCTIONAL_TESTER_AGENT.md`

- [ ] **Step 1: Verify insertion point**

Run: `head -6 docs/agents/FUNCTIONAL_TESTER_AGENT.md`
Expected: `# Sentinel — Functional Tester Agent` → `> **Read this file...` → blank line → `## Role`

- [ ] **Step 2: Insert the section**

```markdown

## Superpowers Skills

> **Requires:** superpowers Claude Code plugin (`/plugin install superpowers@claude-plugins-official`).
> **Check:** `[ -d ~/.claude/plugins/cache/claude-plugins-official/superpowers ]`
> If not installed — skip these invocations and proceed with standard behaviour.

| Stage | Skill to invoke |
|-------|----------------|
| When a defect or unexpected behaviour is found | `systematic-debugging` |
| Before reporting all test cases pass | `verification-before-completion` |

```

- [ ] **Step 3: Verify**

Run: `grep -A 9 "## Superpowers Skills" docs/agents/FUNCTIONAL_TESTER_AGENT.md`
Expected: Section with 2-row table.

- [ ] **Step 4: Commit**

```bash
git add docs/agents/FUNCTIONAL_TESTER_AGENT.md
git commit -m "[docs] US-0126: add Superpowers Skills section to FUNCTIONAL_TESTER_AGENT.md"
```

---

## Task 12: Add ## Superpowers Skills to AUTOMATION_TESTER_AGENT.md

**Files:**
- Modify: `docs/agents/AUTOMATION_TESTER_AGENT.md`

- [ ] **Step 1: Verify insertion point**

Run: `head -6 docs/agents/AUTOMATION_TESTER_AGENT.md`
Expected: `# Circuit — Automation Tester Agent` → `> **Read this file...` → blank line → `## Role`

- [ ] **Step 2: Insert the section**

```markdown

## Superpowers Skills

> **Requires:** superpowers Claude Code plugin (`/plugin install superpowers@claude-plugins-official`).
> **Check:** `[ -d ~/.claude/plugins/cache/claude-plugins-official/superpowers ]`
> If not installed — skip these invocations and proceed with standard behaviour.

| Stage | Skill to invoke |
|-------|----------------|
| Before writing any new test suites | `test-driven-development` |
| When diagnosing a failing test or coverage gap | `systematic-debugging` |
| Before reporting coverage results | `verification-before-completion` |

```

- [ ] **Step 3: Verify**

Run: `grep -A 10 "## Superpowers Skills" docs/agents/AUTOMATION_TESTER_AGENT.md`
Expected: Section with 3-row table.

- [ ] **Step 4: Commit**

```bash
git add docs/agents/AUTOMATION_TESTER_AGENT.md
git commit -m "[docs] US-0126: add Superpowers Skills section to AUTOMATION_TESTER_AGENT.md"
```

---

## Task 13: Final verification and branch push

- [ ] **Step 1: Verify all 8 agent files have the section**

Run:
```bash
for f in docs/agents/*.md; do
  echo -n "$(basename $f): "
  grep -c "Superpowers Skills" "$f" && echo "✓" || echo "MISSING"
done
```
Expected: Each file shows `1` (exactly one occurrence).

- [ ] **Step 2: Verify install.sh syntax**

Run: `bash -n scripts/install.sh && echo "syntax OK"`
Expected: `syntax OK`

- [ ] **Step 3: Verify skills-integration.md row count**

Run: `grep -c "^|" docs/skills-integration.md`
Expected: 28 or more.

- [ ] **Step 4: Mark US-0126 Done in RELEASE_PLAN.md and check all ACs**

In `docs/RELEASE_PLAN.md`, update the US-0126 block:
- `Status: Planned` → `Status: Done`
- All `- [ ] AC-04xx` → `- [x] AC-04xx`

- [ ] **Step 5: Push branch**

```bash
git push origin feature/US-0126-skills-integration
```

- [ ] **Step 6: Open PR**

```bash
gh pr create \
  --base develop \
  --head feature/US-0126-skills-integration \
  --title "[docs] US-0126 (EPIC-0017): superpowers skills integration across all agents" \
  --body "$(cat <<'EOF'
## Summary
- Adds superpowers plugin detection + install prompt to scripts/install.sh (AC-0435)
- Adds ## Superpowers Skills section to all 8 docs/agents/*.md files with per-agent skill/stage tables (AC-0436, AC-0437)
- Creates docs/skills-integration.md with full agent × skill × stage map and skill catalogue (AC-0438, AC-0439)
- Updates docs/RELEASE_PLAN.md and docs/ID_REGISTRY.md

## Test plan
- [ ] Run `bash -n scripts/install.sh` — syntax clean
- [ ] Verify all 8 agent files contain exactly one `## Superpowers Skills` section
- [ ] Verify docs/skills-integration.md exists and contains 24 data rows in the map table
- [ ] CI passes (Lint, Prettier, Test & Coverage Gate)

🤖 Generated with [Claude Code](https://claude.com/claude-code)
EOF
)"
```

- [ ] **Step 7: Auto-merge**

```bash
gh pr merge --auto --squash --delete-branch
```
