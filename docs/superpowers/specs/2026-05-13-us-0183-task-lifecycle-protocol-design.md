# US-0183 — Task Lifecycle Protocol

**Epic:** EPIC-0028 — Agentic Orchestration Engine
**Status:** Design (approved 2026-05-13)
**Author:** DM_AGENT (Conductor) brainstorm with user
**Depends on:** US-0182 (Pre-Dispatch Spec & Plan Orchestration — done)

---

## 1. Goal

Add per-task lifecycle tracking so each unit of work within a story is tracked at task granularity. When a specialist agent works a story, its individual tasks emit `DONE`, `DONE_WITH_CONCERNS`, `NEEDS_CONTEXT`, or `BLOCKED` status transitions. The Conductor uses these transitions to detect stalls, route context, and escalate rather than silently failing or spinning.

Also bundles three small engine gaps discovered during the US-0182 real-world test:

1. `plan-update` command (set `planPath` on `sdlc-status.json` after plan-start)
2. `specApprove()` idempotency guard (double-approve should no-op)
3. Verbal-cue fallback: DM_AGENT.md needs a rule that the agent runs CLI on user's behalf when the user replies `approve` or `reject: reason`

**Standalone-value claim:** US-0183 ships useful task-level visibility and stall detection even if US-0184/US-0185 never land. The Conductor becomes significantly more reliable — it no longer has to assume "no news is good news" from a running agent.

---

## 2. Architecture

```
┌─── Per-story dispatch (DM_AGENT → specialist) ──────────────┐
│ DM_AGENT spawns Forge to implement US-XXXX                  │
│   Forge spawns sub-subagents (or works inline) per task     │
│   ↓ for each task:                                          │
│   node tools/agent-lifecycle.js start --story X --task "..."│
│   ... work happens ...                                       │
│   node tools/agent-lifecycle.js done  --story X --task-id Y │
│         or                                                   │
│   node tools/agent-lifecycle.js blocked --story X --task-id Y│
│         --reason "..."                                       │
└─────────────────────────────────────────────────────────────┘
                          ↓
         docs/sdlc-status.json  tasks.<id>  object
                          ↓
     patchDOM / Agentic Dashboard: task list per story card
```

**Tech stack:** Node.js 18+, Jest 30, no new dependencies. Pattern mirrors `agent-spec-plan.js` (CLI wrapper + pure state module).

---

## 3. Status Protocol

Four status values, each with a defined escalation path:

| Status               | Meaning                                  | Conductor action                                                                  |
| -------------------- | ---------------------------------------- | --------------------------------------------------------------------------------- |
| `DONE`               | Task complete, no concerns               | Proceed to next task                                                              |
| `DONE_WITH_CONCERNS` | Complete but agent flagged a doubt       | Read concerns before proceeding; if correctness concern, address before next task |
| `NEEDS_CONTEXT`      | Blocked waiting for specific information | Provide the missing context, re-dispatch same task                                |
| `BLOCKED`            | Cannot proceed — smart routing applies   | See §4                                                                            |

---

## 4. BLOCKED Smart Routing

When a task reports `BLOCKED`, the CLI pattern-matches the `--reason` text and emits one of four resolution hints:

| Pattern keywords                                                | Suggested resolution                                                |
| --------------------------------------------------------------- | ------------------------------------------------------------------- |
| `missing`, `not found`, `undefined`, `no such`, `cannot find`   | `MORE_CONTEXT` — provide additional context, re-dispatch same model |
| `ambiguous`, `unclear`, `which`, `conflicting`, `contradiction` | `MORE_CONTEXT` — clarify the ambiguity explicitly                   |
| `complex`, `too many`, `large`, `too big`, `scope`              | `SPLIT_TASK` — break into two smaller sub-tasks                     |
| `permission`, `access`, `auth`, `credentials`                   | `ESCALATE_HUMAN` — human must provide credentials                   |
| anything else                                                   | `UPGRADE_MODEL` — try same task with more capable model tier        |

**Resolution tracking:**

```json
"blockedResolutions": [
  {
    "attempt": 1,
    "reason": "cannot find the config file",
    "suggestion": "MORE_CONTEXT",
    "resolvedBy": "Conductor",
    "resolvedAt": "...",
    "outcome": "RETRY"
  }
]
```

**Escalation cap:** After 2 failed resolution attempts, `agent-lifecycle.js` auto-transitions the task to `escalated`. The Conductor writes a `## TASK BLOCKED` entry to `progress.md` and halts the story (does not proceed to the next task). Human resolution required.

---

## 5. State Storage Schema

Extends `docs/sdlc-status.json` with a `tasks` object. Existing `agents`, `stories`, `log`, `phases` unchanged.

```json
{
  "tasks": {
    "task-<uuid>": {
      "id": "task-<uuid>",
      "story": "US-XXXX",
      "agent": "Forge",
      "model": "sonnet",
      "description": "Implement the token parser for route-key extraction",
      "state": "DONE",
      "concerns": null,
      "blockedReason": null,
      "blockedResolutions": [],
      "startedAt": "2026-05-13T10:00:00Z",
      "completedAt": "2026-05-13T10:14:00Z",
      "retryCount": 0
    }
  }
}
```

**State enum:** `in_progress | done | done_with_concerns | needs_context | blocked | escalated`

**`tasks` is keyed by UUID** (generated at `start` time, returned to caller) so multiple tasks can run for the same story without collision.

**Overall task state derived by Conductor:**

- Any task `escalated` → story blocked
- All tasks `done` or `done_with_concerns` → story complete (pending Conductor review of concerns)
- Any task `needs_context` or `blocked` → story paused

---

## 6. CLI Surface — `tools/agent-lifecycle.js`

```
node tools/agent-lifecycle.js <command> [options]

Commands:
  start            --story US-XXXX --agent Forge --model sonnet
                   --task "<description>"
                   → prints task-id to stdout; records in_progress

  done             --task-id <uuid> [--story US-XXXX]
                   → transitions in_progress → done

  concerns         --task-id <uuid> --note "<text>"
                   → transitions in_progress → done_with_concerns

  needs-context    --task-id <uuid> --missing "<what is needed>"
                   → transitions in_progress → needs_context

  blocked          --task-id <uuid> --reason "<why blocked>"
                   → transitions in_progress → blocked
                   → emits routing suggestion on stdout: MORE_CONTEXT | SPLIT_TASK | UPGRADE_MODEL | ESCALATE_HUMAN
                   → after 2 prior resolutions: auto-escalates, exits 1

  resolve          --task-id <uuid> --action MORE_CONTEXT|SPLIT_TASK|UPGRADE_MODEL|ESCALATE_HUMAN
                   --note "<resolution detail>"
                   → records resolution attempt, transitions blocked → in_progress (or escalated if cap)

  list             --story US-XXXX [--state in_progress|blocked|done]
                   → prints task list for story

  status           --task-id <uuid>
                   → prints task record as JSON
```

**Exit codes:**

- `0` — success
- `1` — error (invalid state transition, task not found, escalation cap reached)

**`start` stdout format** (stdout only, no stderr):

```
task-a3f9b12c
```

Caller captures this and passes it to subsequent commands.

**Implementation structure:**

- `tools/agent-lifecycle.js` — CLI wrapper + dispatch
- `tools/lib/agent-lifecycle-state.js` — pure state machine (transition validators, smart routing)
- `tests/unit/agent-lifecycle-state.test.js` — state machine tests
- `tests/unit/agent-lifecycle-cli.test.js` — CLI tests

---

## 7. DM_AGENT.md Protocol Updates

New section **§Per-Task Dispatch Ritual** (inserted after the existing §Spawn Pattern):

```markdown
### Per-Task Dispatch Ritual

For each task a specialist agent works:

1. Record task start, capture the UUID:
   `TASK_ID=$(node tools/agent-lifecycle.js start --story <id> --agent <name> --model <tier> --task "<desc>")`

2. Agent works the task (inline or as sub-subagent).

3. Agent reports status — Conductor interprets output and calls the matching command:
   - Agent says "done" → `node tools/agent-lifecycle.js done --task-id $TASK_ID`
   - Agent flags concern → `node tools/agent-lifecycle.js concerns --task-id $TASK_ID --note "<concern>"`
   - Agent needs info → `node tools/agent-lifecycle.js needs-context --task-id $TASK_ID --missing "<what>"`
   - Agent is stuck → `node tools/agent-lifecycle.js blocked --task-id $TASK_ID --reason "<why>"`
     → Read the routing suggestion from stdout, act accordingly.

4. On `ESCALATE_HUMAN` suggestion or escalation cap reached: halt the story, write `## TASK BLOCKED` to `progress.md`.
```

**Verbal-cue correction** (update to §User approval gates):

> When the user replies `approve` or `reject: <reason>` at a gate prompt, DM_AGENT runs the CLI command **on the user's behalf** — the user never types CLI commands. If DM_AGENT surfaces CLI command text in its reply, this is a protocol violation. The verbal-cue prompt must end with the response options and nothing else.

---

## 8. Bundled US-0182 Engine Gap Fixes

These are small enough to fold into Task 1 of this story:

### 8.1 `plan-update` command

Add `plan-update --story US-XXXX --field planPath --value <path>` to `agent-spec-plan.js`. Same pattern as existing `spec-update` command. Writes `planPhase.planPath` to `sdlc-status.json`.

### 8.2 `specApprove()` idempotency

In `tools/lib/agent-spec-plan-state.js`, `specApprove()` currently throws if `specPhase.state !== 'awaiting_spec_approval'`. When state is already `approved` (second call), it should silently return the unchanged orchestration object instead of throwing. Same guard for `planApprove()`.

### 8.3 DM_AGENT verbal-cue fallback

Per §7 above: DM_AGENT.md must include an explicit rule that surfacing CLI commands at approval gates is a protocol violation. The agent runs the command; the user only says `approve` or `reject: reason`.

---

## 9. Agentic Dashboard Updates

The `patchDOM()` function is extended to update a "Tasks" section on each active story card when `sdlc-status.json` contains task records for that story.

Rendered inline below the story ID on the active card:

```
Task 3/7: "Implement token parser" · DONE
Task 4/7: "Write failing tests" · IN PROGRESS
```

If any task is `blocked`:

```
Task 5/7: "Resolve config path" · BLOCKED (MORE_CONTEXT needed)
```

Implementation: add `patchTaskList(status)` to `tools/generate-dashboard.js`, called inside `patchDOM()`. Reads `status.tasks`, groups by story, renders inline below agent name on active cards.

---

## 10. Testing Strategy

| File                                             | Coverage target                                                        |
| ------------------------------------------------ | ---------------------------------------------------------------------- |
| `tests/unit/agent-lifecycle-state.test.js`       | ≥95% — all valid/invalid transitions, escalation cap, routing patterns |
| `tests/unit/agent-lifecycle-cli.test.js`         | ≥85% — all commands, UUID stdout, exit codes                           |
| `tests/integration/agent-lifecycle-flow.test.js` | smoke — happy path + blocked escalation                                |
| `tests/unit/agent-spec-plan-state.test.js`       | +2 tests for specApprove/planApprove idempotency                       |
| `tests/unit/agent-spec-plan-cli.test.js`         | +1 test for plan-update command                                        |
| `tests/unit/agent-files-protocol.test.js`        | Updated for new DM_AGENT.md sections                                   |

**Key test scenarios:**

State machine:

- All valid transitions succeed
- `start` generates a UUID and returns it
- `blocked` with <2 prior resolutions: transitions to blocked, returns routing suggestion
- `blocked` with ≥2 prior resolutions: transitions to escalated, exits 1
- `resolve` on `blocked` task: transitions → `in_progress`, increments `retryCount`
- `specApprove` on already-approved: no-op, returns 0 (idempotent)
- Routing pattern tests: each keyword bucket maps to the correct suggestion

CLI:

- `start` stdout is just the UUID (no other text)
- `blocked` stdout includes the routing suggestion line
- `list --state blocked` filters correctly
- `plan-update` writes planPath to correct field

---

## 11. Scope Boundaries

**In scope for US-0183:**

- `tools/agent-lifecycle.js` + `tools/lib/agent-lifecycle-state.js`
- `tasks.<id>` storage schema in `sdlc-status.json`
- DONE/DONE_WITH_CONCERNS/NEEDS_CONTEXT/BLOCKED status protocol
- Smart BLOCKED routing with 4 resolution types
- Escalation cap (2 attempts → escalated)
- `patchTaskList()` in `generate-dashboard.js` for live task visibility
- DM_AGENT.md §Per-Task Dispatch Ritual
- DM_AGENT.md verbal-cue fallback rule
- `plan-update` command in `agent-spec-plan.js`
- `specApprove()`/`planApprove()` idempotency
- All tests from §10

**Out of scope (handled by US-0184+):**

- ❌ Context curator (structured context payloads for spawned agents) → US-0184
- ❌ Full DM_AGENT protocol upgrade for dispatch phase → US-0185
- ❌ Task-level spec compliance + code quality reviews → US-0185
- ❌ Dashboard task-level test pass/fail counts per story card (separate enhancement)

**Effort estimate:** ~6-8 days (smaller than US-0182 — state machine is simpler, no approval gates, no flag files)

---

## 12. Open Questions — None

All design decisions settled in the EPIC-0028 brainstorm session (2026-05-11–13):

- Option B (state tracker): `tools/agent-lifecycle.js` is a pure tracker, not a spawner
- Option A (separate Lens): applies to US-0185 review gates, not this story
- Option C (hybrid dispatch): story-level DM_AGENT + task-level specialist → no dispatcher engine here
- Option A (extend sdlc-status.json): `tasks.<uuid>` object
- Option C (smart routing): pattern matching against reason text, 4 resolution buckets
