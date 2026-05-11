# US-0181 — Pre-Dispatch Spec & Plan Orchestration

**Epic:** EPIC-0028 — Agentic Orchestration Engine
**Status:** Design (approved 2026-05-11)
**Author:** DM_AGENT (Conductor) brainstorm with user
**Depends on:** none (independent first story of EPIC-0028)

---

## 1. Goal

Add an orchestration engine that drives every story through a structured **spec → plan → ready_for_dispatch** flow before any specialist agent starts implementation work.

The engine produces reviewed, approved spec and plan artifacts on disk for every story. Implementation (the dispatch phase) is the responsibility of US-0182+ and is **out of scope here**.

**Standalone-value claim:** even if US-0182/US-0183/US-0184/US-0185 never ship, US-0181 alone produces high-quality spec and plan documents that a human developer (or any other tool) can pick up and implement manually. The artifacts are valuable on their own.

---

## 2. Architecture Overview

```
┌─── US-0181 — Pre-Dispatch (story-level orchestration) ──────────┐
│                                                                 │
│ DM_AGENT receives story to implement                            │
│   ↓                                                             │
│ Spawn Compass (PO) → ACs + scope                                │
│   ↓                                                             │
│ AC USER APPROVAL GATE 🛑                                        │
│   ↓                                                             │
│ If uiSurface → Spawn Palette (design system)                    │
│              → Spawn Pixel (interactive mockup)                 │
│   ↓                                                             │
│ Spawn Keystone (technical design section)                       │
│   ↓                                                             │
│ Spawn Lens → spec review → loop until APPROVED (cap 3)          │
│   ↓                                                             │
│ SPEC USER APPROVAL GATE 🛑                                      │
│   ↓                                                             │
│ Spawn Keystone (plan author, writing-plans skill or fallback)   │
│   ↓                                                             │
│ Plan author self-reviews (writing-plans checklist)              │
│   ↓ (if SPEC_GAP found → reopens spec phase)                    │
│ Spawn Lens → plan review → loop until APPROVED (cap 3)          │
│   ↓                                                             │
│ PLAN USER APPROVAL GATE 🛑                                      │
│   ↓                                                             │
│ Story state = ready_for_dispatch                                │
│ (US-0182+ takes over from here)                                 │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

**Tech stack:** Node.js 18+, Jest 30. No new dependencies. Pure Node.js CLI + state machine + flag scanner.

**Tiered fallback:**

- **With superpowers installed:** Compass invokes `superpowers:brainstorming` skill (Compass owns the persona, skill drives dialogue). Keystone invokes `superpowers:writing-plans` skill. Lens follows `requesting-code-review` patterns.
- **Without superpowers:** all three agents follow manual protocols documented in their respective `docs/agents/*_AGENT.md` files.

The state machine and CLI tool work identically in both modes.

---

## 3. Spec Phase Orchestration

**Trigger:** DM_AGENT receives a story to implement (from `RELEASE_PLAN.md` or user request).

### Step-by-step

1. **DM_AGENT calls `node tools/agent-spec-plan.js spec-start --story US-XXXX`.**
   State transition: `specPhase.state: pending → in_progress`.

2. **DM_AGENT spawns Compass with the story ID and rough scope.**
   Compass:
   - Logs `agent-start` (so it appears in `log[]`)
   - Reads story from `RELEASE_PLAN.md`
   - Brainstorms with user (via superpowers `brainstorming` skill if installed, else manual dialogue per `PO_AGENT.md#Spec-Brainstorming-Protocol`)
   - Writes acceptance criteria + functional behaviour to `docs/superpowers/specs/<date>-<story>-design.md`
   - **Decides:** does this story have UI surface? Sets a flag in the spec frontmatter: `uiSurface: true|false`
   - Calls `node tools/agent-spec-plan.js spec-update --story US-XXXX --field uiSurface --value true`
   - Logs `agent-done`

3. **DM_AGENT calls `spec-await-ac --story US-XXXX`.**
   CLI exits with code 2 (await signal). State: `specPhase.state: awaiting_ac_approval`.
   DM_AGENT pauses orchestration. User receives an AC checkpoint via chat + the dashboard's Pending Approvals widget.

4. **User approves ACs** (CLI fast-path or dashboard flag-download path; see §5).
   State: `specPhase.state: awaiting_ac_approval → in_progress`.
   `specPhase.acApprovedAt` recorded.

5. **If `uiSurface === true`, DM_AGENT spawns Palette:**
   - Logs `agent-start`
   - Reads draft spec
   - Defines design tokens (colors, spacing, typography), references existing OKLCH palette
   - Writes `## Design System` section to the spec
   - Logs `agent-done`

6. **If Palette flagged custom UI, DM_AGENT spawns Pixel:**
   - Logs `agent-start`
   - Reads spec + Palette's design section
   - Builds interactive HTML mockup at `docs/superpowers/mockups/<story-id>/index.html` (+ supporting CSS/JS)
   - Uses existing design tokens, no external dependencies, no build step
   - Adds `## UI Preview` section to spec linking to the mockup path
   - Logs `agent-done`

7. **DM_AGENT spawns Keystone:**
   - Logs `agent-start`
   - Reads spec + Palette/Pixel additions (if present)
   - Writes `## Technical Design` section — architecture, file structure, integration points
   - Logs `agent-done`

8. **DM_AGENT spawns Lens for spec review.**
   Lens:
   - Reads complete spec + mockup if present
   - Reviews against AGENTS.md standards, PROJECT.md constitution, design system rules, story scope
   - Emits verdict in structured format (see §7 — Lens findings format)
   - DM_AGENT calls `spec-review-result --story US-XXXX --verdict APPROVED|REQUEST_CHANGES --findings-file <path>`

9. **If `REQUEST_CHANGES`:**
   - `spec-review-result` increments `specPhase.reviewIterations`
   - DM_AGENT parses findings, routes each finding to its `@persona` primary owner
   - Owning agent fixes the spec (sub-section edit)
   - DM_AGENT re-spawns Lens for re-review
   - Loop until `APPROVED` OR iteration cap reached (default 3, configurable via `plan-visualizer.config.json`)
   - Cap reached → state `escalated`, exit 1, manual resolution required

10. **On Lens APPROVED, DM_AGENT calls `spec-await-final --story US-XXXX`.**
    Exit 2. State: `specPhase.state: awaiting_spec_approval`.
    User receives spec checkpoint.

11. **User approves spec.**
    State: `specPhase.state: approved`. `specPhase.specApprovedAt` recorded. Plan phase begins.

---

## 4. Plan Phase Orchestration

**Trigger:** `specPhase.state === "approved"` and user approved final spec.

### Step-by-step

1. **DM_AGENT calls `plan-start --story US-XXXX --author Keystone`.**
   State: `planPhase.state: pending → in_progress`.

2. **DM_AGENT spawns Keystone as plan author.**
   - Logs `agent-start`
   - With superpowers: invokes `superpowers:writing-plans` skill
   - Without superpowers: follows manual protocol per `ARCHITECT_AGENT.md#Plan-Writing-Protocol` (same discipline: one action per step, exact file paths, complete code in every step, no placeholders, TDD-friendly)
   - Writes plan to `docs/superpowers/plans/<date>-<story>.md`
   - **Self-reviews** per the writing-plans checklist (placeholder scan, type consistency, spec coverage)
   - **If SPEC_GAP discovered during writing:** calls `plan-spec-gap --story US-XXXX --reason "..."`. State: `planPhase.state: spec_gap`. Spec phase reopens (`specPhase.state: approved → review`). Plan phase resets to `pending` until spec re-approves.
   - On successful self-review: logs `agent-done`

3. **DM_AGENT spawns Lens for plan review.**
   Lens reviews against:
   - Spec coverage (every spec section has implementation tasks)
   - Task granularity (appropriately sized — no formal time metric)
   - Placeholder scan (no "TBD", "implement later", "add error handling")
   - Type/method consistency across tasks
   - TDD discipline (test before implementation in each task)

   Emits verdict via structured findings:
   - `@plan-author` (= Keystone): structural / granularity issues
   - `@compass`: spec coverage gaps requiring AC reconciliation
   - `@keystone`: technical design contradictions in plan

   DM_AGENT calls `plan-review-result --story US-XXXX --verdict ... --findings-file ...`

4. **If `REQUEST_CHANGES`:**
   - Increment `planPhase.reviewIterations`
   - Route findings by primary tag, re-engage owner
   - Loop until APPROVED OR iteration cap reached (default 3)
   - Cap reached → `escalated`

5. **On Lens APPROVED, DM_AGENT calls `plan-await-approval --story US-XXXX`.**
   Exit 2. State: `planPhase.state: awaiting_plan_approval`. User receives plan checkpoint.

6. **User approves plan.**
   State: `planPhase.state: approved`. Story is now `ready_for_dispatch` (derived). US-0181's responsibility ends here.

---

## 5. User Approval Gates

Three gates: **AC**, **Spec**, **Plan**. Each behaves identically.

### Two approval paths (both work)

**Path A — CLI (fast-path, terminal users):**

```bash
node tools/agent-spec-plan.js approve --story US-XXXX --gate ac
node tools/agent-spec-plan.js approve --story US-XXXX --gate spec
node tools/agent-spec-plan.js approve --story US-XXXX --gate plan

# Reject with reason:
node tools/agent-spec-plan.js reject --story US-XXXX --gate spec --reason "..."

# npm script aliases:
npm run agent:approve -- --story US-XXXX --gate ac
npm run agent:reject  -- --story US-XXXX --gate spec --reason "..."
```

**Path B — Dashboard widget (remote/visual review path):**

The Status tab gains a **"Pending Approvals" widget** when any story has an open gate. Per story row:

- Story ID, gate label (AC/Spec/Plan), elapsed time
- Links to spec/plan/mockup paths
- **Approve** button → triggers browser download of `approve-US-XXXX-<gate>.flag` (JSON content: `{story, gate, action: "approve", timestamp}`)
- **Reject** button → opens reason textarea, downloads `reject-US-XXXX-<gate>.flag` with reason embedded

User saves the downloaded flag file to `docs/pending-approvals/` (gitignored), then either:

- Manually runs `npm run agent:apply` to flush pending flags
- OR waits for the next `node tools/generate-plan.js` invocation, which auto-flushes pending flags as its first step

The flag scanner validates each flag against the current story state. Mismatched or stale flags are logged and skipped (file not deleted, so user can retry after resolving the mismatch).

### Path selection guidance

- **CLI is the fast path.** If the user is at the terminal (which they usually are when running the orchestration), the CLI is one command — no download, no file move.
- **Dashboard exists for two cases:** (a) user reviewing on a different machine, (b) user wants to view the mockup in browser and approve in the same window.

User-facing docs (README + agent files) present CLI as fast-path, dashboard as remote/visual-review path. Both are valid; the dashboard is not the primary flow.

### Gate rejection flow

- **AC rejection** → `specPhase.state: awaiting_ac_approval → in_progress` (Compass re-engages with the reject reason)
- **Spec rejection** → `specPhase.state: awaiting_spec_approval → in_progress` (DM_AGENT re-routes to relevant agent based on reason text)
- **Plan rejection** → `planPhase.state: awaiting_plan_approval → in_progress` (Keystone re-engages)
- Rejection always appends the reason to `progress.md` for audit.

---

## 6. State Storage Schema

Extends `docs/sdlc-status.json`. Adds new fields on existing `stories.<id>` records. Existing `agents`, `metrics`, `log`, `phases` unchanged.

```json
{
  "stories": {
    "US-0181": {
      "status": "InProgress",
      "assignedAgent": null,

      "specPhase": {
        "state": "approved",
        "specPath": "docs/superpowers/specs/2026-05-11-us-0181-pre-dispatch-spec-plan-orchestration-design.md",
        "mockupPath": null,
        "uiSurface": false,
        "reviewIterations": 2,
        "reviewIterationCap": 3,
        "lastReviewVerdict": "APPROVED",
        "acApprovedAt": "2026-05-11T13:10:00Z",
        "specApprovedAt": "2026-05-11T14:23:00Z"
      },

      "planPhase": {
        "state": "approved",
        "planPath": "docs/superpowers/plans/2026-05-11-us-0181.md",
        "author": "Keystone",
        "reviewIterations": 1,
        "reviewIterationCap": 3,
        "lastReviewVerdict": "APPROVED",
        "planApprovedAt": "2026-05-11T15:08:00Z"
      },

      "phaseHistory": [
        { "phase": "spec", "enteredAt": "...", "exitedAt": "..." },
        { "phase": "plan", "enteredAt": "...", "exitedAt": "..." }
      ]
    }
  }
}
```

### State enums

```
specPhase.state:
  pending | in_progress | review | awaiting_ac_approval
  | awaiting_spec_approval | approved | escalated

planPhase.state:
  pending | in_progress | review | spec_gap
  | awaiting_plan_approval | approved | escalated

overall.state:  DERIVED — not stored
  if planPhase.state == "approved"       → "ready_for_dispatch"
  elif planPhase.state in [in_progress, review, ...]
       OR specPhase.state == "approved" → "plan"
  elif anything in spec phase             → "spec"
  else                                    → "pending"
```

### Notes

- `overall.state` is derived on read (no stored field) — eliminates drift between phase states and aggregate.
- `mockupPath` is `null` when `uiSurface === false`.
- `agentsInvolved` is **not** stored — derive from `log[]` entries by filtering on story ID and phase timestamps.
- `phaseHistory[]` is the single source of truth for phase entry/exit timing.
- **Reviewer findings are NOT stored in JSON state.** They are appended to `progress.md` per iteration. JSON state holds only the latest verdict + counter. This keeps `sdlc-status.json` small and makes findings human-readable as audit data.

---

## 7. CLI Surface — `tools/agent-spec-plan.js`

Single Node.js entry point. All commands read/write `docs/sdlc-status.json` atomically (read → mutate → write).

```
node tools/agent-spec-plan.js <command> [options]

Commands:
  spec-start          --story US-XXXX [--ui-surface true|false]
  spec-update         --story US-XXXX --field <path> --value <val>
  spec-review-result  --story US-XXXX --verdict APPROVED|REQUEST_CHANGES
                      [--findings-file <path>]
  spec-await-ac       --story US-XXXX
  spec-await-final    --story US-XXXX

  plan-start          --story US-XXXX --author Keystone
  plan-spec-gap       --story US-XXXX --reason "..."
  plan-review-result  --story US-XXXX --verdict APPROVED|REQUEST_CHANGES
                      [--findings-file <path>]
  plan-await-approval --story US-XXXX

  approve             --story US-XXXX --gate ac|spec|plan
  reject              --story US-XXXX --gate ac|spec|plan --reason "..."

  apply-pending       [--dir docs/pending-approvals/]
  list                [--state ready_for_dispatch|spec|plan|...]
  status              --story US-XXXX
  show-pending
  escalate            --story US-XXXX --phase spec|plan
```

### Exit codes

- `0` — success
- `1` — error (bad args, invalid state transition, story not found, iteration cap reached)
- `2` — awaiting approval (signal to DM_AGENT to pause orchestration)

### State transition validation

The tool enforces legal transitions. Examples:

- `plan-start` when `specPhase.state !== "approved"` → exit 1, "Cannot start plan: spec is in 'in_progress' state"
- `approve --gate plan` when story is `awaiting_ac_approval` → exit 1, "Mismatched gate"
- `spec-review-result --verdict REQUEST_CHANGES` when `reviewIterations === reviewIterationCap` → auto-transition to `escalated`, exit 1, "Iteration cap reached"

### `apply-pending` behaviour

- Scans `docs/pending-approvals/` for `*.flag` files
- Sorts by timestamp ascending (deterministic order)
- For each: validate JSON shape, validate gate against current story state, apply if valid (calls into the same `approve`/`reject` code paths), delete flag file on success
- Malformed or stale flags are logged to stderr and skipped (file NOT deleted — user can fix and retry)
- **Auto-invoked from `generate-plan.js`** as its first step (so dashboard regeneration picks up applied approvals automatically)
- Also runnable standalone: `npm run agent:apply`

### npm script aliases (added to `package.json`)

```json
"agent:approve":  "node tools/agent-spec-plan.js approve",
"agent:reject":   "node tools/agent-spec-plan.js reject",
"agent:pending":  "node tools/agent-spec-plan.js show-pending",
"agent:apply":    "node tools/agent-spec-plan.js apply-pending",
"agent:list":     "node tools/agent-spec-plan.js list",
"agent:status":   "node tools/agent-spec-plan.js status"
```

### Implementation structure

- `tools/agent-spec-plan.js` — CLI wrapper, argument parsing, dispatch
- `tools/lib/agent-spec-plan-state.js` — state machine + transition validators (pure functions, fully testable)
- `tools/lib/agent-spec-plan-flags.js` — flag file scanner + applier
- `tools/lib/lens-findings-parser.js` — parses Lens's markdown findings list into `{primary, cc[], text}` per finding

---

## 8. DM_AGENT.md Protocol Updates

### New top-level section in `docs/agents/DM_AGENT.md`

Inserted **before** the existing `## Orchestration Playbook` section:

```markdown
## Pre-Dispatch Spec & Plan Orchestration

Before any specialist agent is dispatched to implement a story, the spec and plan
phases must complete. A story enters dispatch only when `planPhase.state === "approved"`.

This section specifies WHO to spawn and WHEN. For HOW to spawn (worktree isolation,
model selection ritual, log via agent-start/agent-done), see §How to Spawn Sub-Agents.

### Spec phase sequence

1. node tools/agent-spec-plan.js spec-start --story <id>
2. Spawn Compass → ACs + scope (uses superpowers:brainstorming skill if available)
3. spec-await-ac → halts at exit 2 → user approves AC checkpoint
4. If uiSurface: spawn Palette, then Pixel (interactive mockup)
5. Spawn Keystone for technical design section
6. Spawn Lens for spec review
7. Loop on REQUEST_CHANGES (cap 3) → route findings by @persona primary tag
8. On Lens APPROVED → spec-await-final → user approves spec
9. Spec phase complete

### Plan phase sequence

1. plan-start --author Keystone
2. Spawn Keystone (uses superpowers:writing-plans skill if available)
3. Keystone self-reviews; if SPEC_GAP → plan-spec-gap → spec phase reopens
4. Spawn Lens for plan review
5. Loop on REQUEST_CHANGES (cap 3) → route findings
6. On Lens APPROVED → plan-await-approval → user approves plan
7. Story is ready_for_dispatch (US-0182+ takes over)

### Tiered fallback

- WITH superpowers installed: Compass invokes superpowers:brainstorming skill;
  Keystone invokes superpowers:writing-plans skill; Lens follows requesting-code-review patterns.
- WITHOUT superpowers: agents follow manual protocols in their \_AGENT.md files.

### Lens findings format (structured for routing)

Lens emits findings as markdown bullets tagged with @persona:

- @compass: AC-007 missing edge case for empty list
- @palette: contrast ratio of orange chip is 3.2:1 (needs ≥ 4.5:1)
- @pixel: form field has no error state in mockup
- @keystone: technical design omits retry policy

Canonical persona tags (lowercase): @compass, @palette, @pixel, @keystone,
@lens, @forge, @sentinel, @circuit, @plan-author (synonym for current plan owner).

First tag = primary owner (receives finding for fix).
Additional tags = CC'd (informed via log entry, not directed to fix).

### Iteration cap

Default 3 per phase. When reviewIterations === reviewIterationCap, the CLI auto-transitions
to "escalated". DM_AGENT writes a ## ESCALATION block to progress.md with current
findings and stops orchestration. Human resolution required.
```

### Per-agent protocol subsections

Each updated agent file gets a focused subsection. Spawn pattern (worktree isolation, model selection ritual, agent-start/agent-done logging) is reused from DM_AGENT.md's existing §How to Spawn Sub-Agents — NOT duplicated.

| Agent file                       | Subsection title                 | Content                                                                                                                                                                                                                                                                                                                      |
| -------------------------------- | -------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `PO_AGENT.md`                    | `## Spec Brainstorming Protocol` | When superpowers installed: invoke `superpowers:brainstorming` skill. Otherwise: manual dialogue checklist (purpose, constraints, success criteria, scope decomposition, propose 2-3 approaches). Spec output schema: write to `docs/superpowers/specs/<date>-<story>-design.md`, required sections, `uiSurface` flag rules. |
| `PO_AGENT.md`                    | `## Spec Output Schema`          | File path convention, required spec sections, frontmatter fields including `uiSurface`.                                                                                                                                                                                                                                      |
| `ARCHITECT_AGENT.md`             | `## Plan Writing Protocol`       | When superpowers installed: invoke `superpowers:writing-plans` skill. Otherwise: manual protocol mirroring writing-plans discipline (one action per step, exact file paths, complete code, no placeholders, TDD-friendly).                                                                                                   |
| `ARCHITECT_AGENT.md`             | `## Self-Review Checklist`       | Copy of superpowers' writing-plans self-review checklist: placeholder scan, type consistency, spec coverage, TDD ordering.                                                                                                                                                                                                   |
| `UI_DESIGNER_AGENT.md` (Palette) | `## Spec Contribution Protocol`  | Reads draft spec, writes `## Design System` section with tokens + layout rules, sets flag indicating whether custom UI mockup needed.                                                                                                                                                                                        |
| `FE_DEV_AGENT.md` (Pixel)        | `## UI Mockup Protocol`          | Builds self-contained interactive HTML at `docs/superpowers/mockups/<story-id>/index.html`. Uses existing OKLCH tokens. No CDN, no build step. Adds `## UI Preview` section to spec linking the mockup.                                                                                                                      |
| `CODE_REVIEWER_AGENT.md` (Lens)  | `## Spec/Plan Review Protocol`   | Review templates for spec vs plan, structured-finding output format with canonical `@persona` tag list, verdict format expected by `agent-spec-plan.js`.                                                                                                                                                                     |

All agents dispatched during spec/plan phase MUST call `node tools/update-sdlc-status.js agent-start` at entry and `agent-done` at exit — this is how the `agentsInvolved` set is derived from `log[]`.

---

## 9. Testing Strategy

### Test files

| File                                             | Purpose                                                                                                                              | Target coverage |
| ------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------ | --------------- |
| `tests/unit/agent-spec-plan-state.test.js`       | State machine transitions (every legal + illegal)                                                                                    | ≥95%            |
| `tests/unit/agent-spec-plan-flags.test.js`       | Flag scanner: parse, validate, apply, delete                                                                                         | ≥90%            |
| `tests/unit/agent-spec-plan-cli.test.js`         | CLI arg parsing + exit code semantics                                                                                                | ≥85%            |
| `tests/unit/lens-findings-parser.test.js`        | Parse markdown bullets, extract `@persona` tags, primary-first                                                                       | ≥95%            |
| `tests/unit/dashboard-pending-approvals.test.js` | Pending Approvals widget rendering                                                                                                   | ≥85%            |
| `tests/unit/agent-files-protocol.test.js`        | Each updated agent file contains required protocol subsections (public-API contract — exact match required, brittleness intentional) | format contract |
| `tests/integration/agent-spec-plan-flow.test.js` | End-to-end happy path + sad paths                                                                                                    | smoke only      |
| `tests/e2e/agent-spec-plan-download.spec.js`     | Playwright smoke: Approve button triggers flag download                                                                              | smoke only      |

### Key test scenarios

**State machine:**

- All legal transitions succeed; all illegal transitions throw with informative message
- Iteration cap auto-escalates exactly when `reviewIterations === reviewIterationCap`
- `spec_gap` from plan phase resets specPhase to `review` and pauses planPhase
- Derived `overall.state` returns correct value for each `(specPhase, planPhase)` pair
- AC approval transitions `awaiting_ac_approval → in_progress`
- Rejection logs reason and resets state correctly

**Flag scanner:**

- Parses `approve-US-XXXX-<gate>.flag` filename correctly
- Validates JSON shape (`{story, gate, action, reason?, timestamp}`)
- Rejects malformed flags with logged warning (doesn't crash)
- Applies in deterministic order (sorted by timestamp ascending)
- Skips mismatched-gate flags (logs reason, does NOT delete file)
- Deletes flag file after successful application
- Edge cases: concurrent flags for same story (timestamp-ordered), stale flags (state moved on), CRLF vs LF JSON parsing

**Lens findings parser:**

- Single-tag findings: primary = tag, cc = []
- Multi-tag findings: primary = first tag, cc = rest
- Unknown persona tag: documented fallback (e.g., log warning, attempt fuzzy match against canonical list, or skip)
- Malformed bullets: skip with warning
- Empty findings list: return empty array (no error)

**CLI:**

- All commands parse args correctly
- Exit code 2 for `*-await-*` commands; 1 for state-transition failures; 0 for success
- npm script aliases resolve correctly

**Integration (smoke):**

- Happy path: pending → spec-start → ac-await → approve(ac) → ... → ready_for_dispatch
- Sad path: plan-spec-gap reopens specPhase
- Cap reached: 3 REQUEST_CHANGES → escalated state, exit 1

**Format contract (`agent-files-protocol.test.js`):**

- DM_AGENT.md contains `## Pre-Dispatch Spec & Plan Orchestration`
- PO_AGENT.md contains `## Spec Brainstorming Protocol` + `## Spec Output Schema`
- ARCHITECT_AGENT.md contains `## Plan Writing Protocol` + `## Self-Review Checklist`
- UI_DESIGNER_AGENT.md contains `## Spec Contribution Protocol`
- FE_DEV_AGENT.md contains `## UI Mockup Protocol`
- CODE_REVIEWER_AGENT.md contains `## Spec/Plan Review Protocol` + canonical `@persona` tag list
- **NOTE TO MAINTAINERS:** these section names are the protocol's public API. Renames require coordinated updates across all listed files AND this test. Brittleness is intentional.

**Dashboard widget:**

- Renders empty state when no pending approvals
- One row per story with open gate; correct gate label + story title
- Approve button has correct `data-*` attributes and click handler wired to trigger download with correct filename + JSON content
- Reject button shows reason textarea, downloads `reject-*.flag`
- Tests use jsdom mocks for browser APIs; one Playwright spec for E2E smoke

### Manual smoke procedure

Documented at `docs/test-procedures/agent-spec-plan-smoke.md`:

- Run a representative story through pending → ready_for_dispatch with real Claude agents
- Verify each gate fires and resumes correctly
- Verify Lens findings parsing routes to correct agents
- Verify dashboard widget appears/disappears correctly

---

## 10. Scope Boundaries

### In scope for US-0181

- ✅ State machine + storage schema (`specPhase`, `planPhase`, derived `overall`) on `stories.<id>` in `sdlc-status.json`
- ✅ `tools/agent-spec-plan.js` CLI with full command surface from §7
- ✅ Flag-file approval mechanism (download flag → drop in folder → `apply-pending` flushes)
- ✅ Auto-invoke `apply-pending` from `generate-plan.js`
- ✅ "Pending Approvals" widget on Status tab with Approve/Reject buttons
- ✅ DM_AGENT.md `## Pre-Dispatch Spec & Plan Orchestration` section
- ✅ Protocol subsections in PO_AGENT, ARCHITECT_AGENT, UI_DESIGNER_AGENT, FE_DEV_AGENT, CODE_REVIEWER_AGENT
- ✅ Lens findings parser (`tools/lib/lens-findings-parser.js`)
- ✅ Tiered fallback: superpowers `brainstorming` + `writing-plans` skills when available, manual protocol otherwise
- ✅ Iteration cap (3 default, configurable via plan-visualizer.config.json)
- ✅ Spec gap kick-back from plan phase to spec phase
- ✅ `list` CLI command for surfacing stories by state
- ✅ `.gitignore` entry for `docs/pending-approvals/`
- ✅ All tests from §9
- ✅ Smoke procedure documented at `docs/test-procedures/agent-spec-plan-smoke.md`

### Out of scope (handled by other stories in EPIC-0028)

- ❌ **Per-task lifecycle during dispatch** — DONE/DONE_WITH_CONCERNS/NEEDS_CONTEXT/BLOCKED → **US-0182**
- ❌ **Per-task review gates** — spec compliance + code quality reviews during implementation → **US-0183**
- ❌ **Context curator** — structured context payloads for spawned agents → **US-0184**
- ❌ **Full DM_AGENT protocol upgrade** for dispatch phase — review loops, BLOCKED smart routing → **US-0185**

### Out of scope (deferred or never)

- ❌ Local HTTP server for direct approve/reject (would skip the flag-file download step). Possible future story if friction proves real.
- ❌ AI-suggested fixes for Lens findings (Lens just emits findings; agents fix manually).
- ❌ Spec/plan versioning + diff (we keep one version per story; supersession via `spec_gap` resets spec to `in_progress`).
- ❌ Cross-story scheduling (each story's phases run independently; no batching, no priorities beyond RELEASE_PLAN.md).
- ❌ Reviewer findings stored in JSON state (they live in `progress.md` per iteration; JSON has counter + verdict only).
- ❌ Automated stakeholder notifications (Slack/email when a gate opens). Future story if requested.
- ❌ Separate approval audit log (we reuse `progress.md` as the single audit trail).

### What US-0181 produces as a working iteration

After US-0181 ships, a user can:

1. Tell DM_AGENT to start a new story
2. Compass writes ACs with brainstorming
3. User receives an AC checkpoint via chat + dashboard widget
4. User approves (CLI or dashboard download path)
5. Palette/Pixel/Keystone fire (if `uiSurface`) and produce spec + mockup
6. Lens reviews spec → APPROVED → user gets spec checkpoint
7. User approves → Keystone writes plan
8. Lens reviews plan → APPROVED → user gets plan checkpoint
9. User approves → story state = `ready_for_dispatch`

The artifacts on disk (spec.md, plan.md, mockup/) are **complete and usable** at this point. A human developer (or any other tool) can implement the story from those artifacts.

**Standalone-value claim:** US-0181 produces real value even if US-0182/3/4/5 never ship. The spec and plan are the deliverables.

### Implementation order

To preserve TDD safety:

1. Write `tests/unit/agent-files-protocol.test.js` first (expected to fail — agent files don't have the sections yet)
2. Then add protocol subsections to each agent file (test goes green)
3. Standard TDD discipline for everything else: tests first, code second

### Dependencies

- **None** — US-0181 is the first story in EPIC-0028 and ships independently.
- Soft dependency: superpowers plugin installation enhances UX but is not required. Manual fallback is fully functional.

### Effort estimate

~10-12 days for a focused engineer (1-2 calendar weeks):

- 5-7 days implementation
- 3 days tests
- 1 day docs
- 1 day smoke

---

## 11. Open Questions and Future Considerations

None at design approval time. Items deferred to follow-up stories are listed in §10 "Out of scope (handled by other stories in EPIC-0028)".

If the dashboard flag-download flow proves friction-heavy in real use, a follow-up story can add a local HTTP server option (B4 from the earlier design discussion) so Approve/Reject directly mutate state without the file-move step.

If reviewer findings in `progress.md` grow unwieldy over many stories, a follow-up story can introduce rotation/archival.
