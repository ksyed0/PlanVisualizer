# Agentic Pipeline Architecture

**Version:** 1.0
**Status:** Active
**Last Updated:** 2026-05-18
**Covers:** EPIC-0028 (Agentic Orchestration Engine) + EPIC-0029 (Agentic Pipeline UX)

This document is the authoritative reference for how PlanVisualizer's agentic pipeline works end-to-end — from a user requesting a story to the Conductor dispatching specialists, gating their work through reviews, and displaying live state on the Agentic Dashboard.

For the static dashboard architecture (parsers, renderers, plan-status.html), see `ARCHITECTURE.md`. For product vision and user profile, see `DESIGN.md`.

---

## 1. System Layers

```mermaid
flowchart TB
  subgraph Source["Markdown source of truth"]
    RP[RELEASE_PLAN.md<br/>epics · stories · ACs]
    LM[LESSONS.md<br/>@agent: tagged]
    SP[Spec docs<br/>docs/superpowers/specs/]
    PL[Plan docs<br/>docs/superpowers/plans/]
    PG[progress.md<br/>session log]
    SDLC[sdlc-status.json<br/>runtime state]
  end

  subgraph Engine["Agentic Orchestration Engine (EPIC-0028)"]
    SPP[agent-spec-plan.js<br/>US-0182<br/>spec/plan phase state machine]
    LF[agent-lifecycle.js<br/>US-0183<br/>per-task state machine]
    CX[agent-context.js<br/>US-0184<br/>context curator]
    TR[agent-task-review.js<br/>US-0185<br/>review-gate state machine]
  end

  subgraph Personas["Specialist personas (dispatched as sub-agents)"]
    COND[Conductor<br/>orchestrator]
    COMP[Compass<br/>PO]
    KEY[Keystone<br/>architect]
    PAL[Palette<br/>UI design]
    PIX[Pixel<br/>frontend]
    FRG[Forge<br/>backend]
    LNS[Lens<br/>reviewer]
    SNT[Sentinel<br/>QA]
    CIR[Circuit<br/>DevOps]
  end

  subgraph Display["Static + live UI"]
    SH[plan-status.html<br/>static report]
    DH[dashboard.html<br/>Agentic Dashboard<br/>live, 5s refresh]
    DTR[dashboard-task-review.js<br/>US-0186<br/>review-gate visualization]
  end

  COND -->|reads & writes| SDLC
  COND -->|drives| SPP
  COND -->|drives| LF
  COND -->|spawns| Personas
  COND -->|calls| CX
  COND -->|drives| TR

  SPP --> SDLC
  LF --> SDLC
  TR --> SDLC

  CX -->|reads| SP
  CX -->|reads| PL
  CX -->|reads| LM
  CX -->|reads| SDLC

  SDLC --> DH
  DTR -.injected via fn.toString.-> DH
  RP --> SH
  PG --> SH
```

**Key invariant:** every mutation to runtime state goes through `sdlc-status.json` via one of the four CLI tools. The dashboard reads, never writes. Personas write via the Conductor's CLI invocations, never directly.

---

## 2. Personas

The orchestration engine treats each role as a **persona** — a stable handle used in dispatch, lifecycle records, and lesson tagging. Persona names are independent of the markdown agent files (`docs/agents/*.md`) so the engine doesn't depend on filenames.

```mermaid
flowchart LR
  subgraph Orchestration
    Conductor["**Conductor**<br/>(DM_AGENT.md)<br/><br/>Drives spec → plan → dispatch loop<br/>Owns sdlc-status.json mutations<br/>Spawns specialists in worktrees"]
  end

  subgraph Spec_Plan["Spec & plan phase"]
    Compass["**Compass**<br/>(PO_AGENT.md)<br/><br/>Brainstorms ACs<br/>Writes spec doc<br/>Defines uiSurface flag"]
    Keystone["**Keystone**<br/>(ARCHITECT_AGENT.md)<br/><br/>Writes technical-design section<br/>Authors implementation plan<br/>Self-review checklist"]
    Palette["**Palette**<br/>(UI_DESIGNER_AGENT.md)<br/><br/>Design tokens<br/>Component specs<br/>HTML mockups (frontend-design skill)"]
  end

  subgraph Implementation["Implementation"]
    Pixel["**Pixel**<br/>(FE_DEV_AGENT.md)<br/><br/>Frontend code<br/>Browser-side JS<br/>HTML/CSS"]
    Forge["**Forge**<br/>(BE_DEV_AGENT.md)<br/><br/>Backend code<br/>Tools, parsers, lib modules<br/>Reports [sha:&lt;commit&gt;] tokens"]
  end

  subgraph Review_QA["Review & QA"]
    Lens["**Lens**<br/>(CODE_REVIEWER_AGENT.md)<br/><br/>Spec compliance + code quality<br/>Two-phase per-task review<br/>Emits findings tagged by @persona"]
    Sentinel["**Sentinel**<br/>(AUTOMATION_TESTER_AGENT.md)<br/><br/>Test design & coverage<br/>Snapshot/integration tests"]
    Circuit["**Circuit**<br/>(DEVOPS_AGENT.md)<br/><br/>CI/CD workflows<br/>Release process<br/>Dependabot, version bumps"]
  end

  Conductor -.spawns.-> Compass
  Conductor -.spawns.-> Keystone
  Conductor -.spawns.-> Palette
  Conductor -.spawns.-> Pixel
  Conductor -.spawns.-> Forge
  Conductor -.spawns.-> Lens
  Conductor -.spawns.-> Sentinel
  Conductor -.spawns.-> Circuit
```

Each persona's `_AGENT.md` file declares its `## Model Selection` table (haiku/sonnet/opus rationale per task type — US-0180). The Conductor reads this before every dispatch.

---

## 3. End-to-End Story Flow

The high-level lifecycle from "implement US-XXXX" to "task cleared, next task":

```mermaid
sequenceDiagram
  autonumber
  actor User
  participant Conductor
  participant Compass
  participant Keystone
  participant Lens
  participant Forge
  participant SDLC as sdlc-status.json

  User->>Conductor: "Implement US-XXXX"

  Note over Conductor,Lens: PRE-DISPATCH PHASE (US-0182)
  Conductor->>SDLC: spec-start US-XXXX
  Conductor->>Compass: write ACs<br/>(brainstorming skill)
  Compass-->>Conductor: spec.md draft
  Conductor->>User: AC gate — approve / reject
  User-->>Conductor: approve
  Conductor->>Keystone: write technical design + plan<br/>(writing-plans skill)
  Keystone-->>Conductor: plan.md
  Conductor->>Lens: review spec + plan
  Lens-->>Conductor: APPROVED
  Conductor->>User: Plan gate — approve / reject
  User-->>Conductor: approve
  Conductor->>SDLC: planPhase.state = approved

  Note over Conductor,Forge: DISPATCH PHASE (US-0183 + US-0184 + US-0185)
  loop for each task in plan
    Conductor->>SDLC: lifecycle.start --plan-task-index N
    Conductor->>Conductor: agent-context.js generate<br/>(payload: task, ACs, plan block,<br/>prior summaries, agent lessons)
    Conductor->>Forge: dispatch with context payload<br/>(isolation: worktree, model from agent file)
    Forge-->>Conductor: done --summary "...[sha:abc1234]"

    Conductor->>SDLC: lifecycle.done (parses sha, stores headSha)
    Conductor->>SDLC: task-review.start

    Note over Conductor,Lens: TWO-PHASE REVIEW (US-0185)
    Conductor->>Lens: spec compliance + diff
    Lens-->>Conductor: APPROVED | REQUEST_CHANGES + findings
    Conductor->>SDLC: spec-verdict
    alt APPROVED
      Conductor->>Lens: code quality + diff
      Lens-->>Conductor: APPROVED
      Conductor->>SDLC: quality-verdict (TASK_CLEARED)
    else REQUEST_CHANGES (retries < cap)
      Conductor->>Forge: redispatch with findings
      Forge-->>Conductor: response ends with [sha:new]
      Conductor->>SDLC: forge-retry --triggered-by spec --new-head-sha
      Note right of Conductor: loop back to spec review
    else REQUEST_CHANGES (cap exhausted)
      Conductor->>User: ## TASK REVIEW BLOCKED (escalation)
    end
  end

  Conductor->>User: story complete
```

---

## 4. Per-Task Lifecycle State Machine (US-0183)

The lifecycle of a single task within a story dispatch. Driven entirely by `tools/agent-lifecycle.js`.

```mermaid
stateDiagram-v2
  [*] --> in_progress: start<br/>(planTaskIndex, model)

  in_progress --> done: done<br/>--summary "...[sha:abc]"
  in_progress --> done_with_concerns: concerns<br/>--note "..."
  in_progress --> needs_context: needs-context<br/>--missing "..."
  in_progress --> blocked: blocked<br/>--reason "..."

  needs_context --> in_progress: (Conductor provides context, redispatch)

  blocked --> in_progress: resolve<br/>(blockedResolutions.length &lt; 2)
  blocked --> escalated: resolve<br/>(blockedResolutions.length &gt;= 2)

  done --> [*]: TASK_CLEARED<br/>(via task-review approval)
  done_with_concerns --> [*]: TASK_CLEARED
  escalated --> [*]: human required
```

**Smart BLOCKED routing** (`agent-lifecycle.js blocked` emits a routing token):

| Reason pattern                                        | Routing          | Conductor action                                                       |
| ----------------------------------------------------- | ---------------- | ---------------------------------------------------------------------- |
| `missing` / `not found` / `undefined` / `cannot find` | `MORE_CONTEXT`   | Regenerate context + splice blocked reason → redispatch (same model)   |
| `ambiguous` / `unclear` / `which` / `conflicting`     | `MORE_CONTEXT`   | Same as above                                                          |
| `complex` / `too many` / `too big` / `scope`          | `SPLIT_TASK`     | Halt + write `## TASK BLOCKED — split required` to progress.md → human |
| `permission` / `access` / `auth` / `credentials`      | `ESCALATE_HUMAN` | Halt + write `## TASK BLOCKED — <reason>` → human                      |
| anything else                                         | `UPGRADE_MODEL`  | Next tier haiku → sonnet → opus; at opus → escalate                    |

**Escalation cap:** after 2 `resolve` calls without a successful `done`, the next `blocked` forces `escalated`. Configurable via `orchestration.iterationCap.{spec,plan}` (not retroactive — the lifecycle cap is hardcoded at 2).

---

## 5. Per-Task Review Gate State Machine (US-0185)

Driven by `tools/agent-task-review.js`. Runs after a task transitions to `done` or `done_with_concerns`. State lives on `task.taskReview`.

```mermaid
stateDiagram-v2
  [*] --> spec_reviewing: start<br/>(baseSha, headSha)
  [*] --> approved: start with<br/>headSha == "none"<br/>→ SKIP_REVIEW

  spec_reviewing --> quality_reviewing: spec-verdict APPROVED<br/>→ PROCEED_TO_QUALITY
  spec_reviewing --> forge_retry: spec-verdict REQUEST_CHANGES<br/>(retries &lt; cap)<br/>→ RETRY_FORGE
  spec_reviewing --> escalated: spec-verdict REQUEST_CHANGES<br/>(retries == cap)<br/>→ ESCALATE

  quality_reviewing --> approved: quality-verdict APPROVED<br/>→ TASK_CLEARED
  quality_reviewing --> forge_retry: quality-verdict REQUEST_CHANGES<br/>(retries &lt; cap)<br/>→ RETRY_FORGE
  quality_reviewing --> escalated: quality-verdict REQUEST_CHANGES<br/>(retries == cap)<br/>→ ESCALATE

  forge_retry --> spec_reviewing: forge-retry --triggered-by spec<br/>(resets both verdicts)<br/>→ READY_FOR_SPEC
  forge_retry --> quality_reviewing: forge-retry --triggered-by quality<br/>(preserves spec verdict)<br/>→ READY_FOR_QUALITY

  approved --> [*]
  escalated --> [*]
```

**Stdout token contract:** every command emits exactly one _next-action_ token on stdout. Conductor scripts read with `$()` and `case` on the token. Exit 0 = state recorded; exit 1 = bad args / invalid state transition. This makes Conductor scripts robust to `set -e`.

**Cap:** `orchestration.iterationCap.taskReview` (default 2). Independent of the US-0183 escalation cap — a single task can exhaust both caps without overlap.

---

## 6. Automated BLOCKED Routing (US-0185)

```mermaid
flowchart TD
  Start([blocked<br/>--reason]) --> Route[agent-lifecycle.js<br/>pattern matches reason]

  Route --> MC{MORE_CONTEXT}
  Route --> UM{UPGRADE_MODEL}
  Route --> ST{SPLIT_TASK}
  Route --> EH{ESCALATE_HUMAN}

  MC --> CTX[agent-context.js generate]
  CTX --> Splice[Splice blocked reason into payload:<br/>'Previous attempt was blocked.<br/>You reported: ...']
  Splice --> Resolve1[lifecycle.resolve --action MORE_CONTEXT]
  Resolve1 --> Redispatch1[Redispatch Forge<br/>same model + enriched context]

  UM --> Tier{Current tier?}
  Tier -->|haiku| Sonnet[Next: sonnet]
  Tier -->|sonnet| Opus[Next: opus]
  Tier -->|opus| MaxOut[Write ## TASK BLOCKED —<br/>at max model tier]
  Sonnet --> Resolve2[lifecycle.resolve --action UPGRADE_MODEL]
  Opus --> Resolve2
  Resolve2 --> Redispatch2[Redispatch Forge<br/>with higher tier]
  MaxOut --> Halt1([Halt — surface to user])

  ST --> Split[Write ## TASK BLOCKED —<br/>split required<br/>+ reason + task]
  Split --> Halt2([Halt — surface to user])

  EH --> Esc[Write ## TASK BLOCKED — &lt;reason&gt;]
  Esc --> Halt3([Halt — surface to user])

  style Halt1 fill:#fee
  style Halt2 fill:#fee
  style Halt3 fill:#fee
  style MaxOut fill:#fee
  style Redispatch1 fill:#efe
  style Redispatch2 fill:#efe
```

`MORE_CONTEXT` and `UPGRADE_MODEL` resolve without human intervention. `SPLIT_TASK` and `ESCALATE_HUMAN` always halt and surface — the task may be too large or require credentials only a human can supply. Auto-split via Keystone is deliberately deferred (plan-doc mutation risk).

---

## 7. Context Curation Flow (US-0184)

Before every Forge dispatch (including retries), the Conductor calls `agent-context.js generate` to produce a structured markdown payload.

```mermaid
flowchart LR
  subgraph Inputs
    Task[Task record<br/>from sdlc-status.json]
    Spec[Spec doc<br/>via specPath]
    Plan[Plan doc<br/>via planPath + planTaskIndex]
    Lessons[LESSONS.md<br/>filtered by @agent tag]
    Prior[Prior completed tasks<br/>for same story<br/>with summaries]
  end

  subgraph Tool[agent-context.js generate]
    Reader[Reads:<br/>sdlc-status.json<br/>+ spec/plan/LESSONS]
    Assembler[Pure assembler<br/>tools/lib/agent-context-assembler.js]
  end

  Inputs --> Reader
  Reader --> Assembler

  Assembler --> Out[Structured markdown payload<br/>printed to stdout]
  Out --> Conductor[Conductor captures via $(...)<br/>injects at top of dispatch prompt]
```

**Payload sections** (each suppressed if empty — task description is the irreducible minimum):

1. **Header** — `## Context for {Agent} — {Story} (Task N/M)`
2. **Your task** — task description verbatim
3. **Story acceptance criteria** — parsed from spec doc
4. **Plan excerpt** — task block from plan doc at `planTaskIndex`
5. **Prior work on this story** — bullets per completed task with `summary` and `concerns`
6. **Relevant lessons for {Agent}** — LESSONS.md entries tagged `@agent: {Agent}` or `@agent: all`

The assembler is a pure function — zero filesystem access. The CLI owns all I/O.

---

## 8. Dashboard Visualization (US-0186)

The Agentic Dashboard reads `sdlc-status.json` every 5 seconds and patches the DOM. US-0186 added review-gate visualization on each task row.

```mermaid
flowchart TD
  subgraph Browser
    Load([Page load]) --> Init[initTaskDensity<br/>reads localStorage 'pv-task-density'<br/>fallback 'L']
    Init --> Active[setTaskDensity 'S'|'M'|'L'<br/>updates window.pvTaskDensity<br/>toggles .active class]

    Tick([5s refresh tick]) --> Fetch[refreshState fetches<br/>sdlc-status.json]
    Fetch --> Cache[window._pvLastStatus = status]
    Cache --> Patch[patchTaskList&lpar;status&rpar;]

    Click([User clicks S/M/L]) --> Save[setTaskDensity<br/>writes localStorage<br/>toggles .active]
    Save --> Rerender[patchTaskList&lpar;_pvLastStatus&rpar;<br/>immediate re-render]
    Save --> Active

    Patch --> Loop[For each active agent card<br/>+ each task in story]
    Rerender --> Loop

    Loop --> Derive[deriveDisplayState&lpar;task.taskReview&rpar;]
    Derive --> Mode{window.pvTaskDensity}
    Mode -->|S| RS[renderReviewIconS]
    Mode -->|M| RM[renderReviewChipsM]
    Mode -->|L| RL[renderReviewLineL]
    RS --> DOM[innerHTML of task row]
    RM --> DOM
    RL --> DOM
  end

  subgraph Source["Function source"]
    Mod[tools/lib/dashboard-task-review.js<br/>require'd server-side for tests]
    Inject[generate-dashboard.js<br/>injects fn.toString'd source<br/>into HTML script block]
    Mod -.same source.-> Inject
    Inject -.embedded.-> Derive
    Inject -.embedded.-> RS
    Inject -.embedded.-> RM
    Inject -.embedded.-> RL
  end
```

**`fn.toString()` injection** is the architectural trick: the same JS source runs in Jest (CommonJS require) and in the browser (embedded literal). No bundler, no IIFE wrapping, no code duplication. Documented as L-0068.

**Three render modes** (chosen by topbar S/M/L pill, persisted to localStorage):

- **S** — compact single icon (`✓` / `⟳` / `✗`) appended to row
- **M** — small chips `[SPEC ✓] [QUAL ⟳]` right-aligned
- **L** (default) — second indented line `Spec ✓ · Quality ⟳ · retry 1/2`

---

## 9. Data Schema — `sdlc-status.json`

The runtime state file. Mutated only via the four orchestration tools.

```mermaid
classDiagram
  class sdlcStatus {
    +stories: Map~storyId, StoryState~
    +tasks: Map~taskId, TaskState~
    +agents: Map~name, AgentState~
    +log: Array~LogEntry~
    +phases: Map~name, PhaseState~
  }

  class StoryState {
    +specPhase: SpecPhase
    +planPhase: PlanPhase
  }

  class SpecPhase {
    +state: pending|in_progress|awaiting_ac|in_review|awaiting_spec|approved|escalated
    +specPath: string?
    +reviewIterations: number
    +findings: string?
  }

  class PlanPhase {
    +state: pending|in_progress|in_review|awaiting_approval|approved|escalated
    +planPath: string?
    +reviewIterations: number
  }

  class TaskState {
    +id: task-uuid
    +story: US-XXXX
    +agent: persona name
    +model: haiku|sonnet|opus
    +description: string
    +state: in_progress|done|done_with_concerns|needs_context|blocked|escalated
    +planTaskIndex: number?
    +summary: string?
    +headSha: hex 7-40 chars or "none"?
    +concerns: string?
    +blockedReason: string?
    +blockedResolutions: Array~Resolution~
    +retryCount: number
    +startedAt: ISO timestamp
    +completedAt: ISO timestamp?
    +taskReview: TaskReview?
  }

  class TaskReview {
    +status: pending|spec_reviewing|quality_reviewing|forge_retry|approved|escalated
    +baseSha: string
    +headSha: string
    +specVerdict: APPROVED|REQUEST_CHANGES?
    +specFindings: markdown?
    +qualityVerdict: APPROVED|REQUEST_CHANGES?
    +qualityFindings: markdown?
    +forgeRetries: number
    +lastRetryTriggeredBy: spec|quality?
    +startedAt: ISO timestamp
    +completedAt: ISO timestamp?
  }

  class AgentState {
    +status: idle|active|review|blocked
    +currentStory: US-XXXX?
    +currentTask: task-uuid?
    +model: haiku|sonnet|opus?
    +modelRationale: string?
  }

  sdlcStatus "1" *-- "many" StoryState: stories
  sdlcStatus "1" *-- "many" TaskState: tasks
  sdlcStatus "1" *-- "many" AgentState: agents
  StoryState *-- SpecPhase
  StoryState *-- PlanPhase
  TaskState o-- TaskReview: taskReview
```

**Field provenance:**

- `tasks.{uuid}.taskReview` — added in **US-0185**
- `tasks.{uuid}.{summary,headSha,planTaskIndex}` — added in **US-0184** and **US-0185**
- `tasks.{uuid}.blockedResolutions` + `retryCount` — added in **US-0183**
- `stories.{id}.{specPhase,planPhase}` — added in **US-0182**
- `agents.{name}.{model,modelRationale}` — added in **US-0180**

---

## 10. CLI Surface Summary

The four orchestration tools, with their command verbs:

| Tool                         | Commands                                                                                                                                                                                                                                               | Purpose                                                                                                                                                     |
| ---------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `tools/agent-spec-plan.js`   | `spec-start`, `spec-await-ac`, `spec-review-result`, `spec-await-final`, `plan-start`, `plan-update`, `plan-review-result`, `plan-await-approval`, `approve`, `reject`, `spec-gap`, `plan-spec-gap`, `apply-pending`, `show-pending`, `list`, `status` | Spec & plan phase orchestration with user approval gates (US-0182)                                                                                          |
| `tools/agent-lifecycle.js`   | `start`, `done`, `concerns`, `needs-context`, `blocked`, `resolve`, `list`, `status`                                                                                                                                                                   | Per-task lifecycle state machine + smart BLOCKED routing suggestions (US-0183); `start --plan-task-index N`, `done --summary "...[sha:abc]"` (US-0184/0185) |
| `tools/agent-context.js`     | `generate`                                                                                                                                                                                                                                             | Assemble structured context payload for a task (US-0184)                                                                                                    |
| `tools/agent-task-review.js` | `start`, `spec-verdict`, `quality-verdict`, `forge-retry`, `status`                                                                                                                                                                                    | Per-task two-phase review gate state machine (US-0185)                                                                                                      |

All tools share the same architecture: **thin CLI wrapper + pure state module**. The state module (`tools/lib/{tool}-state.js`) is fully unit-testable with in-memory fixtures; the CLI wrapper owns all I/O.

---

## 11. Story → Capability Map

| Story       | Capability added                                       | Tools / files                                                                                                                              |
| ----------- | ------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------ |
| **US-0182** | Pre-dispatch spec/plan orchestration with user gates   | `agent-spec-plan.js` + state module; DM_AGENT.md `§Pre-Dispatch Spec & Plan Orchestration`                                                 |
| **US-0183** | Per-task lifecycle tracking with smart BLOCKED routing | `agent-lifecycle.js` + state module; `tasks.{uuid}` schema; DM_AGENT.md `§Per-Task Dispatch Ritual`                                        |
| **US-0184** | Context Curator generates structured dispatch payloads | `agent-context.js` + assembler; LESSONS.md `@agent:` tagging convention; `--plan-task-index` + `--summary` schema patches                  |
| **US-0185** | Two-phase Lens review gate + automated BLOCKED routing | `agent-task-review.js` + state module; `taskReview` schema; `[sha:<commit>]` convention; BE_DEV_AGENT/FE_DEV_AGENT `§Commit SHA Reporting` |
| **US-0186** | Dashboard review-gate visualization (S/M/L modes)      | `tools/lib/dashboard-task-review.js`; `generate-dashboard.js` extensions; topbar density pill                                              |

---

## 12. Outstanding gaps (next stories)

- **EPIC-0029 backlog beyond US-0186:**
  - Surface BLOCKED routing decisions on the dashboard (which suggestion fired, retry count)
  - Lifecycle timeline view per story (visual: task 1 → 2 → 3 with elapsed times)
  - Model-tier escalation traces (haiku → sonnet → opus chain visualization)
- **Pipeline self-test:** dogfood the full loop on the next story end-to-end and watch the dashboard
- **SPLIT_TASK auto-decomposition via Keystone** — deferred from US-0185 (plan-doc mutation risk too high without iteration on protocol first)

---

## 13. Cross-references

- **Spec docs** (the source of truth for each story's contract):
  - `docs/superpowers/specs/2026-05-11-us-0181-pre-dispatch-spec-plan-orchestration-design.md`
  - `docs/superpowers/specs/2026-05-13-us-0183-task-lifecycle-protocol-design.md`
  - `docs/superpowers/specs/2026-05-14-us-0184-context-curator-design.md`
  - `docs/superpowers/specs/2026-05-15-us-0185-conductor-dispatch-protocol-design.md`
  - `docs/superpowers/specs/2026-05-17-us-0186-dashboard-review-gate-visualization-design.md`
- **Implementation plans** under `docs/superpowers/plans/`
- **Agent persona files** under `docs/agents/`
- **Static dashboard architecture:** `docs/architecture/ARCHITECTURE.md`
- **Product vision:** `docs/architecture/DESIGN.md`
