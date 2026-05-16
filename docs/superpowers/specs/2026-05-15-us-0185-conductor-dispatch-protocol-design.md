# US-0185 — Conductor Dispatch Protocol with Per-Task Review Gates

**Epic:** EPIC-0028 — Agentic Orchestration Engine
**Status:** Design (approved 2026-05-15)
**Author:** Conductor brainstorm with user
**Depends on:** US-0182 (Pre-Dispatch Spec & Plan Orchestration — done), US-0183 (Task Lifecycle Protocol — done), US-0184 (Context Curator — done)

---

## 1. Goal

Close the EPIC-0028 self-hosting loop. After Forge completes a task, the Conductor automatically dispatches Lens twice — first for spec compliance against the task's acceptance criteria, then for code quality against the diff. Either review can route findings back to Forge for a fix (capped at 2 retries) before escalating to the user. Separately, when Forge reports `blocked`, the Conductor automatically resolves `MORE_CONTEXT` and `UPGRADE_MODEL` cases without human intervention; `SPLIT_TASK` and `ESCALATE_HUMAN` always surface.

**Standalone-value claim:** US-0185 is the last story in EPIC-0028. With it, the pipeline runs end-to-end — spec → plan → dispatch → per-task review → next task — without a human watching between tasks. Without it, the pipeline is still useful (humans can run the review manually using `superpowers:subagent-driven-development`) but the Conductor stops short of full autonomy.

---

## 2. Architecture

```
After Forge marks a task done (or done_with_concerns):

  BASE_SHA  (Conductor captured before dispatch)
  HEAD_SHA  (parsed from Forge's --summary [sha:...] token by agent-lifecycle.js done)
        ↓
  node tools/agent-task-review.js start --task-id $TASK_ID --base-sha --head-sha
        → stdout = SKIP_REVIEW (if headSha === "none") or READY_FOR_SPEC
        ↓
  Conductor dispatches Lens [spec compliance]
        → diff = git diff $BASE_SHA..$HEAD_SHA
        → context = task description + story ACs + plan task block
        ↓ Lens verdict
  node tools/agent-task-review.js spec-verdict --verdict APPROVED|REQUEST_CHANGES [--findings <md>]
        → stdout = PROCEED_TO_QUALITY | RETRY_FORGE | ESCALATE
        ↓
  (RETRY_FORGE) → forge-retry --triggered-by spec → resets quality verdict too → loop back
  (PROCEED_TO_QUALITY)
        ↓
  Conductor dispatches Lens [code quality]
        → same diff + code quality criteria
        ↓ Lens verdict
  node tools/agent-task-review.js quality-verdict --verdict APPROVED|REQUEST_CHANGES [--findings <md>]
        → stdout = TASK_CLEARED | RETRY_FORGE | ESCALATE
        ↓
  (RETRY_FORGE) → forge-retry --triggered-by quality → keeps spec verdict → skips spec re-review → loop quality only
  (TASK_CLEARED)
        ↓
  Conductor moves to next task in the plan

BLOCKED path (separate from review — fires when Forge cannot start or finish a task):

  ROUTING=$(node tools/agent-lifecycle.js blocked --task-id $TASK_ID --reason "<why>")
        case $ROUTING in
          MORE_CONTEXT   → regenerate context + splice blocked reason → resolve + redispatch Forge (same model)
          UPGRADE_MODEL  → next tier (haiku→sonnet→opus) → resolve + redispatch Forge (higher tier)
          SPLIT_TASK     → halt automation, write ## TASK BLOCKED — split required, surface to user
          ESCALATE_HUMAN → halt, write ## TASK BLOCKED — <reason>, surface to user
        esac
```

**Two new files — same split as every prior EPIC-0028 story:**

```
tools/
  agent-task-review.js              ← CLI wrapper, owns all I/O, ~200 LOC
  lib/
    agent-task-review-state.js     ← pure state machine, no fs access, ~150 LOC
```

**Tech stack:** Node.js 18+, Jest 30, no new dependencies. Mirrors `agent-spec-plan.js` + `agent-spec-plan-state.js` and `agent-lifecycle.js` + `agent-lifecycle-state.js`.

---

## 3. CLI Surface — `tools/agent-task-review.js`

Five commands. State recording always exits 0; the _next action_ is emitted to stdout as a token. Exit 1 is reserved for actual errors (missing args, task not found, invalid state).

```
node tools/agent-task-review.js <command> [options]

Commands:

  start            --task-id <uuid>
                   --base-sha <git-sha-or-none>
                   --head-sha <git-sha-or-none>
                   → initializes tasks.<uuid>.taskReview
                   → stdout: SKIP_REVIEW (if head-sha === "none") or READY_FOR_SPEC
                   → exit 0 on success, 1 on bad args

  spec-verdict     --task-id <uuid>
                   --verdict APPROVED|REQUEST_CHANGES
                   [--findings "<markdown>"]
                   → writes specVerdict and specFindings to task record
                   → stdout: PROCEED_TO_QUALITY (APPROVED) | RETRY_FORGE (REQUEST_CHANGES, retries<cap) | ESCALATE (REQUEST_CHANGES, retries===cap)
                   → exit 0 on success, 1 on bad args / invalid state

  quality-verdict  --task-id <uuid>
                   --verdict APPROVED|REQUEST_CHANGES
                   [--findings "<markdown>"]
                   → writes qualityVerdict and qualityFindings to task record
                   → stdout: TASK_CLEARED (APPROVED) | RETRY_FORGE (REQUEST_CHANGES, retries<cap) | ESCALATE (REQUEST_CHANGES, retries===cap)
                   → exit 0 on success, 1 on bad args / invalid state

  forge-retry      --task-id <uuid>
                   --triggered-by spec|quality
                   --new-head-sha <git-sha>
                   → increments forgeRetries
                   → spec retry: resets specVerdict AND qualityVerdict (full re-review of new code)
                   → quality retry: resets qualityVerdict only (spec verdict preserved, skip spec phase)
                   → updates taskReview.headSha to --new-head-sha (the new commit Forge produced on retry)
                   → stdout: READY_FOR_SPEC (spec retry) or READY_FOR_QUALITY (quality retry)
                   → exit 0 on success, 1 on bad args

                   Note on --new-head-sha source: On retry, Forge does NOT call
                   `agent-lifecycle.js done` again (the task is already in `done`
                   state). Instead, Forge makes new commits in its worktree and
                   reports back to the Conductor in its response text, which must
                   end with the same `[sha:<commit>]` token convention as the
                   original done summary. The Conductor parses this token from
                   Forge's response and passes it as --new-head-sha.

  status           --task-id <uuid>
                   → prints tasks.<uuid>.taskReview as JSON to stdout
                   → exit 0 on success, 1 if task not found
```

**Stdout token contract:** every command (except `status`) emits exactly one token on stdout as its final newline-terminated output line. The Conductor's protocol scripts read this token with `$()` and branch on it. The token is the _next action_, not a status. This contract makes Conductor scripts robust to `set -e`: command-level success and phase outcome are cleanly separated.

---

## 4. State Schema — `tasks.<uuid>.taskReview`

US-0185 extends the existing `tasks.<uuid>` object (defined in US-0183, extended in US-0184) with a single new field `taskReview` plus two SHA companions on the task record itself.

```json
{
  "tasks": {
    "task-<uuid>": {
      // existing US-0183 + US-0184 fields ...
      "planTaskIndex": 3,
      "summary": "Implemented parseTaskBlock() with 3 tests",
      "headSha": "abc1234",                  // NEW US-0185 — parsed from [sha:...] token in summary

      "taskReview": {                        // NEW US-0185
        "status": "pending|spec_reviewing|quality_reviewing|forge_retry|approved|escalated",
        "baseSha": "1234567",
        "headSha": "abc1234",                // mirrored from task.headSha; updated by forge-retry
        "specVerdict": null | "APPROVED" | "REQUEST_CHANGES",
        "specFindings": null | "<markdown findings text>",
        "qualityVerdict": null | "APPROVED" | "REQUEST_CHANGES",
        "qualityFindings": null | "<markdown findings text>",
        "forgeRetries": 0,
        "lastRetryTriggeredBy": null | "spec" | "quality",
        "startedAt": "ISO timestamp",
        "completedAt": null | "ISO timestamp"
      }
    }
  }
}
```

**Field semantics:**

- `headSha` on the task record itself is the SHA Forge committed; written by `agent-lifecycle.js done` after parsing `[sha:...]` from `--summary`. Lives on the task, not just on the review, because it's metadata about the task work itself.
- `taskReview.headSha` mirrors `task.headSha` at review start; updated separately by `forge-retry` (since the task can have one final SHA but the review tracks the SHA each retry produced).
- `taskReview.status` is computed-and-stored: derivable from the verdict fields but written explicitly for dashboard readability and audit. The state machine enforces consistency.
- `forgeRetries` counts re-dispatches of Forge for review fixes. Reset per task — not cumulative across tasks.
- `lastRetryTriggeredBy` records which phase triggered the most recent retry, so the next review pass knows whether to run both phases or only quality.

**Defaults:** `taskReview` is absent (or `null`) on initial task creation. Initialized by `start`.

---

## 5. Forge `[sha:...]` Convention

Forge runs in an isolated worktree. The Conductor cannot capture `HEAD_SHA` by running `git rev-parse HEAD` in its own working directory — that would return the Conductor's SHA, not Forge's. Solution: Forge appends a `[sha:<commit>]` token to its summary string when reporting `done`.

**Format:**

```
node tools/agent-lifecycle.js done --task-id $TASK_ID \
  --summary "<one-line handoff> [sha:<7-40 hex chars or 'none'>]"
```

**Examples:**

```
--summary "Implemented parseTaskBlock() with 3 tests [sha:abc1234]"
--summary "Reviewed design doc, no code changes [sha:none]"
--summary "Refactored validator and added 2 tests [sha:f9d2b1c8af3]"
```

**Parsing (in `agent-lifecycle.js done`):**

- Regex: `/\[sha:([0-9a-f]{7,40}|none)\]$/i` — anchored to the end of the summary string
- On match: extract group 1, store as `task.headSha`. Strip the entire `[sha:...]` token (plus trailing whitespace) from the stored `summary`. So the user-visible summary stays clean.
- On no match: exit 1 with stderr `[agent-lifecycle] --summary missing [sha:<commit>] token; see BE_DEV_AGENT.md §Commit SHA Reporting`. Forge must retry with the corrected format.

**No-commit handling (`[sha:none]`):**

- When Forge legitimately produced no commit (review-only task, design discussion, "verify and report"), Forge uses `[sha:none]`.
- `agent-lifecycle.js done` stores `task.headSha = "none"`.
- `agent-task-review.js start` detects `headSha === "none"` and emits stdout `SKIP_REVIEW`. The Conductor moves to the next task without dispatching Lens.

**Applies to:** `done` and `done_with_concerns` only. Not `needs-context` (Forge is asking for help, not finishing). Not `blocked` (Forge isn't reporting completion).

**Forge agent files updated** (BE_DEV_AGENT.md, FE_DEV_AGENT.md): see §8.

---

## 6. Automated BLOCKED Routing

When `agent-lifecycle.js blocked` returns a routing suggestion on stdout, the Conductor automatically acts on `MORE_CONTEXT` and `UPGRADE_MODEL`. `SPLIT_TASK` and `ESCALATE_HUMAN` always surface to the user.

| Routing suggestion | Conductor automatic action                                                                                                                                                                                                                                                                                                     |
| ------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `MORE_CONTEXT`     | Regenerate context payload via `agent-context.js generate`; **splice the blocked reason into the redispatch message as additional context** (see below); call `agent-lifecycle.js resolve --action MORE_CONTEXT --note "<reason>"`; redispatch Forge with same model                                                           |
| `UPGRADE_MODEL`    | Determine next tier (`haiku` → `sonnet` → `opus`); call `agent-lifecycle.js resolve --action UPGRADE_MODEL --note "previous tier: <old>"`; redispatch Forge with higher tier. If current tier is already `opus`: write `## TASK BLOCKED — at max model tier (opus)` to `progress.md` and halt — no further automation possible |
| `SPLIT_TASK`       | Halt automation; write `## TASK BLOCKED — split required\nReason: <blocked reason>\nTask: <task description>` to `progress.md`; surface to user with verbal cue: _"Task N is too large to complete. Reason: <reason>. Reply: split with two replacement task descriptions, or different model, or skip this task."_            |
| `ESCALATE_HUMAN`   | Halt; write `## TASK BLOCKED — <reason>` to `progress.md`; surface to user verbally                                                                                                                                                                                                                                            |

### 6.1 The MORE_CONTEXT spliced message

A naive "call agent-context.js again and redispatch" would send Forge the **same** context payload it just got blocked on. To make MORE_CONTEXT meaningful, the Conductor must inject Forge's blocked-reason text into the next dispatch. The redispatch message becomes:

```markdown
## Context for Forge — US-XXXX (Task N/M)

<entire original payload from agent-context.js generate ...>

---

### Previous attempt was blocked

Your previous attempt at this task was blocked. You reported:

> <blocked reason text verbatim>

Address that specifically. If you cannot proceed because of the same issue, mark the task `needs-context` with a precise statement of what additional information you need, rather than `blocked` again.
```

The Conductor splices the "Previous attempt was blocked" section in by hand for US-0185. A future enhancement could add `--prior-block "<reason>"` to `agent-context.js generate`; out of scope for US-0185.

### 6.2 Two independent caps

Two iteration caps apply to the same task. They are independent counters:

- **US-0183 escalation cap** (existing): max 2 BLOCKED → resolve cycles per task before forced escalation. Tracks Forge's ability to recover from a block.
- **US-0185 taskReview cap** (new): max 2 Forge re-dispatches due to review findings before forced escalation. Tracks Forge's ability to satisfy review.

Both caps can fire on the same task without overlap. A task could be blocked twice (cap A reached), recover, finish, fail spec review twice (cap B reached), and escalate on either path independently.

---

## 7. DM_AGENT.md Protocol Updates

Six edits to `§Per-Task Dispatch Ritual`. Each edit is small and localized.

### 7.1 Edit 1 — Capture BASE_SHA before dispatch (modify step 1)

Insert a line before the existing `TASK_ID=$(...)` line:

```bash
BASE_SHA=$(git rev-parse HEAD)
TASK_ID=$(node tools/agent-lifecycle.js start \
  --story <id> --agent Forge --model <tier> \
  --task "<desc>" --plan-task-index <N>)
```

### 7.2 Edit 2 — Insert step 3b: Start review after done/done_with_concerns

After step 3's `done` or `concerns` row fires:

```bash
HEAD_SHA=$(node tools/agent-lifecycle.js status --task-id $TASK_ID | jq -r .headSha)

NEXT=$(node tools/agent-task-review.js start \
  --task-id $TASK_ID --base-sha $BASE_SHA --head-sha $HEAD_SHA)

case "$NEXT" in
  SKIP_REVIEW)      # no commit produced; move to next task
    continue
    ;;
  READY_FOR_SPEC)   # proceed to step 3c
    ;;
esac
```

### 7.3 Edit 3 — Insert step 3c: Lens spec compliance review

```bash
# Conductor dispatches Lens with:
#   - The task description
#   - The story ACs (from spec doc, via agent-context.js or directly)
#   - The diff: git diff $BASE_SHA..$HEAD_SHA
#   - The plan task block at planTaskIndex
# Lens returns verdict + findings markdown.

NEXT=$(node tools/agent-task-review.js spec-verdict \
  --task-id $TASK_ID --verdict APPROVED)
# OR
NEXT=$(node tools/agent-task-review.js spec-verdict \
  --task-id $TASK_ID --verdict REQUEST_CHANGES --findings "$LENS_FINDINGS")

case "$NEXT" in
  PROCEED_TO_QUALITY)
    ;; # → step 3d
  RETRY_FORGE)
    # Redispatch Forge with findings spliced into the context payload.
    # Forge makes commits in its worktree and reports back in its response text
    # ending with [sha:<new-commit>]. The Conductor parses NEW_HEAD from that token.
    # (Forge does NOT call agent-lifecycle.js done again — the task is already in done state.)
    node tools/agent-task-review.js forge-retry \
      --task-id $TASK_ID --triggered-by spec --new-head-sha "$NEW_HEAD"
    # Loop back to step 3c with the new diff range.
    ;;
  ESCALATE)
    # Write ## TASK REVIEW BLOCKED — spec compliance cap exhausted to progress.md
    # Halt the story.
    ;;
esac
```

### 7.4 Edit 4 — Insert step 3d: Lens code quality review

Same shape as 3c, but `quality-verdict`. On `RETRY_FORGE` from quality phase, `forge-retry --triggered-by quality`. The next iteration of the loop will see `taskReview.specVerdict === APPROVED` preserved and skip step 3c, going directly to step 3d after Forge re-completes.

### 7.5 Edit 5 — Replace step 4 with automated BLOCKED routing

```bash
ROUTING=$(node tools/agent-lifecycle.js blocked --task-id $TASK_ID --reason "<why>")

case "$ROUTING" in
  MORE_CONTEXT)
    CONTEXT=$(node tools/agent-context.js generate \
      --story <id> --agent Forge --task-id $TASK_ID)
    SPLICED_MESSAGE="$CONTEXT

---

### Previous attempt was blocked

Your previous attempt at this task was blocked. You reported:

> $REASON

Address that specifically. If you cannot proceed because of the same issue, mark the task \`needs-context\` rather than \`blocked\` again."

    node tools/agent-lifecycle.js resolve --task-id $TASK_ID --action MORE_CONTEXT --note "$REASON"
    # Redispatch Forge with $SPLICED_MESSAGE as the prompt prefix. Same model.
    ;;

  UPGRADE_MODEL)
    CURRENT_MODEL=$(node tools/agent-lifecycle.js status --task-id $TASK_ID | jq -r .model)
    case "$CURRENT_MODEL" in
      haiku)  NEXT_TIER=sonnet ;;
      sonnet) NEXT_TIER=opus ;;
      opus)
        echo "## TASK BLOCKED — at max model tier (opus)" >> progress.md
        echo "Reason: $REASON" >> progress.md
        # Halt, surface to user.
        exit 1
        ;;
    esac
    node tools/agent-lifecycle.js resolve --task-id $TASK_ID --action UPGRADE_MODEL --note "previous tier: $CURRENT_MODEL"
    # Redispatch Forge with $NEXT_TIER model.
    ;;

  SPLIT_TASK)
    echo "## TASK BLOCKED — split required" >> progress.md
    echo "Reason: $REASON" >> progress.md
    echo "Task: $TASK_DESC" >> progress.md
    # Surface to user with verbal cue.
    exit 1
    ;;

  ESCALATE_HUMAN)
    echo "## TASK BLOCKED — $REASON" >> progress.md
    # Surface to user verbally.
    exit 1
    ;;
esac
```

### 7.6 Edit 6 — Update step 5 (escalation cap exhausted)

The existing step 5 text says "On escalation cap exhausted (exit 1 from `resolve`): halt the story, write `## TASK BLOCKED` to `progress.md`, surface to user." Extend to mention the new taskReview cap path:

> On any escalation (`agent-lifecycle.js resolve` exit 1, or `agent-task-review.js spec-verdict`/`quality-verdict` stdout = ESCALATE): halt the story, write `## TASK BLOCKED — <reason>` or `## TASK REVIEW BLOCKED — <phase> cap exhausted` to `progress.md`, surface to user.

---

## 8. Forge Agent File Updates

Both `docs/agents/BE_DEV_AGENT.md` and `docs/agents/FE_DEV_AGENT.md` (the two Forge persona files) gain a new section before the existing `## Model Selection` section:

````markdown
## Commit SHA Reporting

When you complete a task and call `agent-lifecycle.js done`, your `--summary` argument must end with a `[sha:<commit>]` token. This lets the Conductor capture the commit SHA your work produced without needing to know your worktree path.

Format: `[sha:<7-40 hex chars>]` or `[sha:none]` for tasks that produced no commit.

Examples:

```bash
# Normal case: task produced a commit
node tools/agent-lifecycle.js done --task-id $TASK_ID \
  --summary "Implemented parseTaskBlock() with 3 tests [sha:abc1234]"

# Review-only or design-only task: no commit produced
node tools/agent-lifecycle.js done --task-id $TASK_ID \
  --summary "Reviewed design doc, no code changes [sha:none]"
```
````

If the `[sha:...]` token is missing, `agent-lifecycle.js done` exits 1 with a clear error message. You must retry the command with the correct format.

This convention applies to `done` and `done_with_concerns` only. It does not apply to `needs-context` or `blocked` (you are not reporting completion in those cases).

````

---

## 9. Configuration

Extend `plan-visualizer.config.json` schema with `orchestration.iterationCap.taskReview` (default 2):

```json
{
  "orchestration": {
    "iterationCap": {
      "spec": 3,
      "plan": 3,
      "taskReview": 2
    }
  }
}
````

`agent-task-review-state.js` reads this value via the existing config loader and falls back to 2 if absent. Projects can raise the cap for complex domains or lower it for tighter feedback loops.

`tools/migrate-config.js` adds a no-op default-injection migration so existing project configs gain the new key on next regenerate (consistent with how prior config additions migrated).

---

## 10. Implementation Module Layout

```
tools/
  agent-task-review.js                          # NEW — CLI wrapper, ~200 LOC
  agent-lifecycle.js                            # modified: done command extracts [sha:...] token
  lib/
    agent-task-review-state.js                  # NEW — pure state machine, ~150 LOC
    agent-lifecycle-state.js                    # modified: markDone accepts headSha; new field on task

tests/
  unit/
    agent-task-review-state.test.js             # NEW
    agent-task-review-cli.test.js               # NEW
    agent-lifecycle-state.test.js               # extended: [sha:...] parser, headSha field
    agent-lifecycle-cli.test.js                 # extended: done with/without [sha:...] token
    agent-files-protocol.test.js                # extended: DM_AGENT.md 6 edits, BE_DEV_AGENT.md + FE_DEV_AGENT.md SHA section
  integration/
    agent-task-review-flow.test.js              # NEW — start → spec → quality flow + retry + escalate paths

docs/
  agents/DM_AGENT.md                            # 6 edits in §Per-Task Dispatch Ritual
  agents/BE_DEV_AGENT.md                        # NEW §Commit SHA Reporting
  agents/FE_DEV_AGENT.md                        # NEW §Commit SHA Reporting
  superpowers/specs/2026-05-15-us-0185-conductor-dispatch-protocol-design.md  # THIS FILE
  superpowers/plans/2026-05-15-us-0185-conductor-dispatch-protocol.md         # to be written by writing-plans

plan-visualizer.config.json                     # modified: orchestration.iterationCap.taskReview default 2
tools/migrate-config.js                         # modified: inject taskReview default on migration
```

**Public API of `agent-task-review-state.js`:**

```javascript
module.exports = {
  initTaskReview(data, taskId, baseSha, headSha),  // → returns updated state, throws on bad input
  setSpecVerdict(data, taskId, verdict, findings), // → returns next action token string
  setQualityVerdict(data, taskId, verdict, findings),  // → returns next action token string
  forgeRetry(data, taskId, triggeredBy, newHeadSha),   // → returns ready_for_spec | ready_for_quality
  getReview(data, taskId),                         // → read-only accessor
  TASK_REVIEW_STATES,                              // exported enum
  NEXT_ACTION_TOKENS,                              // exported enum: SKIP_REVIEW, READY_FOR_SPEC, PROCEED_TO_QUALITY, RETRY_FORGE, ESCALATE, TASK_CLEARED, READY_FOR_QUALITY
};
```

Each function is pure: takes plain objects, returns plain objects or strings, throws on invalid transitions. Zero filesystem access.

---

## 11. Testing Strategy

| File                                               | Coverage target | What it asserts                                                                                                                                                                                                                                                                                                                                                                                                                      |
| -------------------------------------------------- | --------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | -------------- | ------------------ | ----------- | -------- | ------------ | --------------------------------------------------------------------------------------------------------------------- |
| `tests/unit/agent-task-review-state.test.js`       | ≥95%            | All state transitions; cap enforcement; `lastRetryTriggeredBy` logic (spec retry resets quality verdict; quality retry preserves spec verdict); SKIP_REVIEW on `headSha === "none"`; invalid transitions throw                                                                                                                                                                                                                       |
| `tests/unit/agent-task-review-cli.test.js`         | ≥85%            | All 5 commands; stdout tokens (`SKIP_REVIEW                                                                                                                                                                                                                                                                                                                                                                                          | READY_FOR_SPEC | PROCEED_TO_QUALITY | RETRY_FORGE | ESCALATE | TASK_CLEARED | READY_FOR_QUALITY`); exit 0 on success and exit 1 only on actual errors (missing args, task not found, invalid state) |
| `tests/integration/agent-task-review-flow.test.js` | smoke           | Real flow: start → spec APPROVED → quality APPROVED → cleared (happy path); start → spec REQUEST_CHANGES → forge-retry → spec APPROVED → quality APPROVED → cleared (single spec retry); start → spec APPROVED → quality REQUEST_CHANGES → forge-retry quality → quality APPROVED (no spec re-review on quality retry); cap exhaustion on spec → ESCALATE; cap exhaustion on quality → ESCALATE; SKIP_REVIEW on `headSha === "none"` |
| `tests/unit/agent-lifecycle-state.test.js`         | extended        | `markDone` extracts `[sha:abc1234]` from summary and stores `task.headSha`; accepts `[sha:none]`; rejects malformed (`[sha:ZZZ]`, missing brackets, no token); strips the token from stored `summary`                                                                                                                                                                                                                                |
| `tests/unit/agent-lifecycle-cli.test.js`           | extended        | `done --summary "...[sha:abc1234]"` writes `headSha: "abc1234"`; `done --summary "..."` without token exits 1 with stderr message                                                                                                                                                                                                                                                                                                    |
| `tests/unit/agent-files-protocol.test.js`          | extended        | DM_AGENT.md §Per-Task Dispatch Ritual contains all 6 edits (BASE_SHA capture, step 3b/3c/3d new content, automated BLOCKED routing block, escalation extension); BE_DEV_AGENT.md and FE_DEV_AGENT.md each contain §Commit SHA Reporting section                                                                                                                                                                                      |

**Critical scenarios:**

State machine:

- `start` with valid SHAs → status = `pending`, both verdicts = null, forgeRetries = 0
- `start` with `head-sha === "none"` → next-action = `SKIP_REVIEW`, status auto-transitions to `approved`, completedAt set
- `spec-verdict APPROVED` → next-action = `PROCEED_TO_QUALITY`, status = `quality_reviewing`
- `spec-verdict REQUEST_CHANGES` with forgeRetries < 2 → next-action = `RETRY_FORGE`, status = `forge_retry`
- `spec-verdict REQUEST_CHANGES` with forgeRetries === 2 → next-action = `ESCALATE`, status = `escalated`, completedAt set
- `forge-retry --triggered-by spec` → forgeRetries++, specVerdict = null, qualityVerdict = null, lastRetryTriggeredBy = `spec`, status = `spec_reviewing`
- `forge-retry --triggered-by quality` → forgeRetries++, qualityVerdict = null, specVerdict **preserved**, lastRetryTriggeredBy = `quality`, status = `quality_reviewing`
- `quality-verdict APPROVED` → next-action = `TASK_CLEARED`, status = `approved`, completedAt set
- Invalid transitions (e.g., quality-verdict before spec passes) throw

CLI:

- `start` without required args exits 1 with clear stderr
- `spec-verdict REQUEST_CHANGES` without `--findings` exits 1 with stderr
- `status` for non-existent task exits 1
- Happy path stdout matches expected tokens exactly (no extra newlines, no extra text)

`[sha:...]` parser:

- `--summary "x [sha:abc1234]"` → task.summary = `"x"`, task.headSha = `"abc1234"`
- `--summary "x [sha:none]"` → task.summary = `"x"`, task.headSha = `"none"`
- `--summary "x"` (missing token) → exit 1 with stderr
- `--summary "x [sha:ZZZ]"` (invalid hex) → exit 1 with stderr
- `--summary "x [sha:abc] y"` (token not at end) → exit 1 with stderr (strict format)

Integration:

- Two-task story: task 1 done → review approved both phases → task 2 dispatched with prior-work containing task 1's summary (cross-check with US-0184's context generation)
- BLOCKED flow: blocked with `cannot find spec` → MORE_CONTEXT routing → resolve → redispatch with spliced reason → Forge completes → review approved → task cleared
- BLOCKED flow: blocked with `task too complex` → SPLIT_TASK routing → halts, progress.md entry written, no automatic action

---

## 12. Scope Boundaries

**In scope for US-0185:**

- ✅ `tools/agent-task-review.js` (CLI wrapper)
- ✅ `tools/lib/agent-task-review-state.js` (pure state machine)
- ✅ `taskReview` schema on `tasks.<uuid>` (per §4)
- ✅ `headSha` field on the task record itself
- ✅ `[sha:...]` parser in `agent-lifecycle.js done` (extract, validate, store on `task.headSha`); accept `[sha:none]` for no-commit tasks
- ✅ DM_AGENT.md §Per-Task Dispatch Ritual — 6 edits (per §7)
- ✅ BE_DEV_AGENT.md + FE_DEV_AGENT.md §Commit SHA Reporting (per §8)
- ✅ Automated BLOCKED routing for `MORE_CONTEXT` (with spliced blocked-reason) and `UPGRADE_MODEL` (linear tier progression)
- ✅ `SPLIT_TASK` and `ESCALATE_HUMAN` both halt and surface to user
- ✅ `plan-visualizer.config.json` → `orchestration.iterationCap.taskReview` (default 2) + migration
- ✅ All tests from §11
- ✅ RELEASE_PLAN.md status update for US-0185 (Planned → In Progress on merge → Done on completion)
- ✅ ID_REGISTRY.md remains as-is (already reserved AC-0726–0730)

**Out of scope (US-0186 or later):**

- ❌ Dashboard task-card review-state visualization → US-0186 (separate UI story; brought up by user during US-0185 brainstorm)
- ❌ SPLIT_TASK automation via Keystone (auto-decomposition into sub-tasks) → future story; risk of plan-doc corruption is too high without iteration on the protocol first
- ❌ `--prior-block <reason>` flag on `agent-context.js generate` → future enhancement; US-0185 splices the blocked reason into the dispatch message manually via shell
- ❌ Cross-task context propagation (review findings auto-injected into the next task's context payload) → future story; current context curator does not surface review history
- ❌ Reviewer agent selection configuration (Lens for both phases is hardcoded) → YAGNI; revisit only if a project wants Sentinel for quality review
- ❌ Separate audit log for review verdicts → YAGNI; verdicts live on the task record and review findings are written to `progress.md` on escalation, which is enough audit trail
- ❌ Parallel review dispatches (spec + quality run simultaneously) → out of scope; sequential by design — quality runs only if spec passes, which both saves work and produces cleaner findings
- ❌ CI workflow optimization (CodeQL deduplication, paths-ignore for docs PRs, `npm ci` reduction) → US-0186 candidate identified during US-0185 brainstorm; tracked separately

**Effort estimate:** ~8–10 days (XL). Larger than US-0184 because:

- Two-phase state machine is more complex than US-0184's pure-function assembler
- BLOCKED routing automation touches the Conductor's dispatch loop in DM_AGENT.md (substantial protocol surface area)
- Forge convention changes require updates to two agent files plus the `agent-lifecycle.js done` parser
- Integration testing requires simulating the full dispatch cycle (start → done → review → next task)
- Cross-cap interaction (US-0183 escalation cap + US-0185 taskReview cap) needs explicit test coverage to prove the caps are independent

---

## 13. Open Questions — None

All design decisions settled in the brainstorming session (2026-05-15):

- **Scope:** Review gates + automated BLOCKED routing (full automation for MORE_CONTEXT and UPGRADE_MODEL; SPLIT_TASK and ESCALATE_HUMAN halt)
- **SHA tracking:** Forge reports the commit SHA via `[sha:<commit>]` token at the end of `--summary`; accept `[sha:none]` for no-commit tasks
- **Review dispatches:** Two sequential — Lens for spec compliance first, then Lens again for code quality. Quality runs only if spec passes
- **Iteration cap:** Separate configurable key `orchestration.iterationCap.taskReview`, default 2
- **Retry triggered-by:** Spec retry resets quality verdict (full re-review of new code); quality retry preserves spec verdict (skip spec, re-run only quality)
- **SPLIT_TASK routing:** Escalate to human in US-0185; Keystone auto-split deferred to a future story (plan-doc mutation risk too high)
- **Module structure:** CLI wrapper + pure state module — same pattern as every prior EPIC-0028 story
- **MORE_CONTEXT splicing:** Conductor injects the blocked reason as additional context in the redispatch message; otherwise the regenerated payload would be identical to the previous one
- **Exit code semantics:** Exit 0 = state recorded; stdout = next action token. Exit 1 reserved for actual errors (missing args, invalid state). Mirrors `agent-lifecycle.js blocked` which already emits routing on stdout
- **Dashboard:** Out of scope for US-0185; deferred to US-0186 as a separate UI story
- **Persona:** All references to the orchestrator use **Conductor** (consistent with DM_AGENT.md body text and the `@conductor` Lens-findings tag established in US-0184)
