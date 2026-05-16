# US-0184 — Context Curator

**Epic:** EPIC-0028 — Agentic Orchestration Engine
**Status:** Design (approved 2026-05-14)
**Author:** Conductor brainstorm with user
**Depends on:** US-0182 (Pre-Dispatch Spec & Plan Orchestration — done), US-0183 (Task Lifecycle Protocol — done)

---

## 1. Goal

Add a context generator so the Conductor stops asking specialist agents to "go read everything yourself." Given a story ID, agent name, and task UUID, `tools/agent-context.js generate` assembles a structured markdown payload — task description, story acceptance criteria, the relevant plan excerpt, prior-task summaries, and lessons tagged for the receiving agent — and prints it to stdout. The Conductor captures the payload via `$()` and injects it at the top of every sub-agent dispatch message.

**Standalone-value claim:** even if US-0185 never lands, US-0184 immediately reduces the "cold start" cost of every dispatch. Specialist agents receive exactly the context they need instead of burning tokens discovering it.

---

## 2. Architecture

```
┌─ Conductor calls (during §Per-Task Dispatch Ritual) ───────────┐
│ CONTEXT=$(node tools/agent-context.js generate \               │
│            --story US-XXXX --agent Forge --task-id <uuid>)     │
│ (inject $CONTEXT at top of sub-agent dispatch message)         │
└────────────────────────────────────────────────────────────────┘
                                 ↓
┌─ tools/agent-context.js (CLI wrapper, owns all I/O) ───────────┐
│  reads:                                                        │
│    docs/sdlc-status.json   → task record + completed tasks     │
│    spec doc (specPath)     → story acceptance criteria         │
│    plan doc (planPath)     → task block at planTaskIndex       │
│    docs/LESSONS.md         → entries tagged for the agent      │
└────────────────────────────────────────────────────────────────┘
                                 ↓
┌─ tools/lib/agent-context-assembler.js (pure function) ─────────┐
│  assemble({task, ACs, planBlock, priorTasks, lessons,          │
│            agent, story, totalTasks})                          │
│  → markdown string                                             │
└────────────────────────────────────────────────────────────────┘
                                 ↓
                              stdout
```

**Tech stack:** Node.js 18+, Jest 30, no new dependencies. Pattern mirrors `agent-lifecycle.js` + `agent-lifecycle-state.js` (CLI wrapper + pure state module).

**Key architectural property:** the assembler has zero filesystem access. All inputs are plain in-memory objects/strings. This keeps the core logic fully unit-testable without filesystem mocks and matches the established pattern of every other CLI in `tools/`.

---

## 3. CLI Surface — `tools/agent-context.js`

```
node tools/agent-context.js generate
  --story  US-XXXX     # required — story ID
  --agent  <Name>      # required — receiving agent persona (canonical names below)
  --task-id <uuid>     # required — task UUID from agent-lifecycle.js start
```

**Exit codes:**

- `0` — payload written to stdout
- `1` — invalid args, story not found, task not found, or invalid agent name

Error messages go to stderr with one-line summaries; stdout is reserved for the payload itself so `$()` capture stays clean.

**Canonical agent names** (must match exactly, case-sensitive):

`Compass`, `Palette`, `Pixel`, `Keystone`, `Lens`, `Forge`, `Sentinel`, `Circuit`, `Conductor`

These mirror the persona handles already used throughout DM_AGENT.md and the `@compass / @pixel / ...` Lens findings tags. The orchestrator's canonical persona name is **Conductor** (the `DM_AGENT.md` filename is unchanged).

---

## 4. Bundled Schema Extensions (US-0183 patches)

These are small enough to ship as part of US-0184 rather than a separate story, mirroring how US-0183 bundled the `plan-update` command and `specApprove()` idempotency from US-0182.

### 4.1 `--summary` on `agent-lifecycle.js done`

```bash
node tools/agent-lifecycle.js done --task-id <uuid> --summary "<one-line handoff>"
```

The `--summary` flag is **optional**. When provided, the text is stored on the task record and rendered in future tasks' "Prior work" section. When omitted, prior-work entries fall back to bare `Task N (done)` lines.

### 4.2 `--plan-task-index` on `agent-lifecycle.js start`

```bash
TASK_ID=$(node tools/agent-lifecycle.js start \
  --story <id> --agent <name> --model <tier> \
  --task "<description>" \
  --plan-task-index 3)
```

The `--plan-task-index` flag is **optional** — not every task has a plan (ad-hoc bug fixes, exploratory work). When provided, the integer is stored on the task record and used by `agent-context.js generate` to locate the matching task block in the plan doc. When absent, `generate` omits the "Plan excerpt" section entirely and still produces the rest of the payload.

### 4.3 Task schema additions

Extends the `tasks.<uuid>` object defined in US-0183:

```json
"task-<uuid>": {
  // existing US-0183 fields ...
  "planTaskIndex": 3,
  "summary": "Added parseHeading() helper to plan-parser.js"
}
```

Both new fields default to `null`. Existing tests update to assert the fields exist with `null` defaults on `start`.

---

## 5. Markdown Payload Template

Exactly this format is printed to stdout by `generate`. Sections are emitted only when they have content (suppression rules below).

```markdown
## Context for Forge — US-0184 (Task 3/7)

### Your task

Implement parseTaskBlock() in tools/lib/plan-parser.js

### Story acceptance criteria

- AC-0720: agent-context.js exports a `generate` command that writes a markdown payload to stdout
- AC-0721: payload includes task, ACs, plan excerpt, prior work, lessons — sections suppressed when empty
- AC-0722: --plan-task-index and --summary added to agent-lifecycle.js as optional flags

### Plan excerpt

> Task 3: Implement parseTaskBlock()
> Files: tools/lib/plan-parser.js (modify), tests/unit/plan-parser.test.js (extend)
> Steps:
>
> 1. Read the plan doc content as a string
> 2. Split on `## Task N:` headings
> 3. Return the block at index N (1-indexed)
>    Acceptance: parseTaskBlock(content, 3) returns the third task block

### Prior work on this story

- Task 1 (done): Added parseHeading() helper to plan-parser.js
- Task 2 (done_with_concerns): Wrote initial tests
  - Concern: edge case for empty plans untested

### Relevant lessons for Forge

- **L-0057** — Use try/catch ENOENT instead of existsSync+readFileSync (CodeQL js/file-system-race)
- **L-0054** — Always dispatch subagents from absolute paths
```

**Header logic:**

- `Task N/M` shows the 1-indexed `planTaskIndex` over total task blocks parsed from the plan doc.
- When `planTaskIndex` is missing, render `## Context for Forge — US-0184` (no `(Task N/M)` suffix).

**Section suppression rules:**

| Section                   | Suppressed when                                                  |
| ------------------------- | ---------------------------------------------------------------- |
| Story acceptance criteria | `specPath` missing or spec doc has no AC list                    |
| Plan excerpt              | `planTaskIndex` missing or `planPath` missing or block not found |
| Prior work on this story  | No prior completed tasks for the story (e.g., this is task 1)    |
| Relevant lessons          | No lessons tagged `@agent: <name>` or `@agent: all`              |

A section is "suppressed" by omitting both its `###` heading and its body. "Your task" is always rendered (the task description is the irreducible minimum payload).

**`concerns` rendering:** when a prior task is `done_with_concerns`, render the concern text as an indented sub-bullet rather than inline, to keep multi-sentence concerns readable.

---

## 6. LESSONS.md Tagging Convention

Each lesson entry in `docs/LESSONS.md` gets an `@agent:` line immediately under its heading:

```markdown
## L-0057 — Use try/catch ENOENT instead of existsSync+readFileSync

@agent: Forge

Body of the lesson...
```

**Tag value forms:**

- Single agent: `@agent: Forge`
- Multiple agents: `@agent: Forge, Sentinel` (comma-separated, whitespace tolerant)
- Cross-cutting: `@agent: all` (every agent sees it)

**Persona tag (lowercase, for Lens findings format consistency):** the canonical Lens-findings tag for orchestrator-level concerns is `@conductor`, mirroring the existing `@compass / @pixel / ...` convention in DM_AGENT.md.

**One-time migration pass** — bundled as Task 2 of the implementation plan:

- Walk all existing L-XXXX entries in `docs/LESSONS.md` (~60 entries)
- Read each lesson's title and first paragraph; assign `@agent: <name>` based on subject matter
- Default to `@agent: all` when a lesson is genuinely cross-cutting (e.g., git hygiene, CodeQL TOCTOU patterns)
- Validation helper `validateLessonsTags(lessonsContent)` returns `{taggedCount, untaggedCount, invalidNames}`; a new `npm` script (or extension of the existing memory-validate CI step) warns when `untaggedCount > 0` or any tag uses a non-canonical agent name

**Untagged lessons are not surfaced** by the generator. They remain in `LESSONS.md` and continue to be human-readable; they just don't appear in any context payload until tagged.

---

## 7. DM_AGENT.md Protocol Updates

Three small edits to `docs/agents/DM_AGENT.md` `§Per-Task Dispatch Ritual` (added in US-0183).

**Edit 1 — extend step 1 with `--plan-task-index`:**

```bash
TASK_ID=$(node tools/agent-lifecycle.js start \
  --story <id> --agent <name> --model <tier> \
  --task "<description>" \
  --plan-task-index 3)         # NEW, optional — when present, generate's payload includes the matching plan excerpt
```

**Edit 2 — insert new step 1b (between "Record task start" and "Agent works the task"):**

````markdown
1b. **Generate context payload and inject into the dispatch message:**

    ```bash
    CONTEXT=$(node tools/agent-context.js generate \
      --story <id> --agent <name> --task-id $TASK_ID)
    ```

    Include `$CONTEXT` verbatim at the top of the sub-agent dispatch message before
    any per-dispatch overrides. The agent reads the curated context first; any
    additional instructions follow below.
````

**Edit 3 — extend the `done` row of step 3 with `--summary`:**

```bash
node tools/agent-lifecycle.js done --task-id $TASK_ID \
  --summary "<one-line handoff summary>"
```

All references to the orchestrator within DM_AGENT.md continue to use the persona name **Conductor**.

---

## 8. State Storage Schema

US-0184 adds no new top-level keys to `sdlc-status.json`. It only extends the existing `tasks.<uuid>` object (defined in US-0183) with two optional fields:

```json
{
  "tasks": {
    "task-<uuid>": {
      "id": "task-<uuid>",
      "story": "US-XXXX",
      "agent": "Forge",
      "model": "sonnet",
      "description": "Implement parseTaskBlock() in tools/lib/plan-parser.js",
      "state": "in_progress",
      "concerns": null,
      "blockedReason": null,
      "blockedResolutions": [],
      "startedAt": "2026-05-14T10:00:00Z",
      "completedAt": null,
      "retryCount": 0,

      "planTaskIndex": 3,
      "summary": null
    }
  }
}
```

Spec and plan paths used by the generator are already on `sdlc-status.json` from US-0182:

- `stories.<id>.specPhase.specPath` — used to read story ACs
- `stories.<id>.planPhase.planPath` — used to read the plan excerpt

If either path is missing or the file does not exist, the corresponding payload section is suppressed (per Section 5 rules).

---

## 9. Implementation Module Layout

```
tools/
  agent-context.js                              # CLI wrapper (new, ~150 LOC est.)
  agent-lifecycle.js                            # extended: --summary, --plan-task-index flags
  lib/
    agent-context-assembler.js                  # pure assembler (new, ~200 LOC est.)
    agent-lifecycle-state.js                    # extended: new fields, new transitions accept summary

tests/
  unit/
    agent-context-assembler.test.js             # NEW
    agent-context-cli.test.js                   # NEW
    agent-lifecycle-state.test.js               # extended: +2 tests
    agent-lifecycle-cli.test.js                 # extended: +2 tests
    agent-files-protocol.test.js                # extended: DM_AGENT.md §Per-Task Dispatch Ritual content
    lessons-tagging.test.js                     # NEW — every L-XXXX has canonical @agent tag
  integration/
    agent-context-flow.test.js                  # NEW — start → done(summary) → start (next) → generate

docs/
  LESSONS.md                                    # one-time migration: tag every L-XXXX
  agents/DM_AGENT.md                            # three small edits per §7
```

**Assembler public API:**

```javascript
// tools/lib/agent-context-assembler.js
module.exports = {
  assemble(input),                // input: { task, ACs, planBlock, priorTasks, lessons, agent, story, totalTasks } → string
  parsePlanBlock(planContent, n), // → { block: string, totalTasks: number } | null
  parseStoryACs(specContent),     // → string[] | null
  filterLessons(lessonsContent, agentName), // → Array<{ id, title }>
  validateLessonsTags(lessonsContent),       // → { taggedCount, untaggedCount, invalidNames: string[] }
};
```

Each pure function has a single responsibility, takes strings/objects, returns strings/objects, and is independently testable.

---

## 10. Testing Strategy

| File                                           | Coverage target | What it asserts                                                                                                                                                    |
| ---------------------------------------------- | --------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `tests/unit/agent-context-assembler.test.js`   | ≥95%            | Every section variant: all-populated, no-plan, no-prior-work, no-lessons, done_with_concerns sub-bullet, header with/without Task N/M, section-suppression rules   |
| `tests/unit/agent-context-cli.test.js`         | ≥85%            | Arg parsing, required-flag enforcement, file-not-found graceful behavior, stdout-only payload, stderr-only errors, exit 0/1                                        |
| `tests/integration/agent-context-flow.test.js` | smoke           | Real flow: `start --plan-task-index 1` → `done --summary "..."` → `start --plan-task-index 2` → `generate` → assert prior-work section contains the Task 1 summary |
| `tests/unit/agent-lifecycle-state.test.js`     | +2              | `planTaskIndex` defaults to null on `start`, persisted when passed; `summary` defaults to null on `done`, persisted when passed                                    |
| `tests/unit/agent-lifecycle-cli.test.js`       | +2              | `--summary` flag round-trips through `done`; `--plan-task-index` flag round-trips through `start`                                                                  |
| `tests/unit/agent-files-protocol.test.js`      | extended        | DM_AGENT.md §Per-Task Dispatch Ritual contains the three edits from §7                                                                                             |
| `tests/unit/lessons-tagging.test.js`           | NEW             | Every L-XXXX in LESSONS.md has an `@agent:` line; every agent name is canonical (matches §3 list or `all`); `validateLessonsTags()` returns expected shape         |

**Critical scenarios:**

State machine:

- `start` with `--plan-task-index 3` → task record has `planTaskIndex: 3`
- `start` without `--plan-task-index` → task record has `planTaskIndex: null`
- `done` with `--summary "..."` → task record has `summary: "..."`
- `done` without `--summary` → task record has `summary: null`

Assembler:

- All sections populated → renders header, your-task, ACs, plan excerpt, prior work, lessons in that order
- `planBlock = null` → "Plan excerpt" section omitted, header drops `(Task N/M)` suffix
- `ACs = null` → "Story acceptance criteria" section omitted
- `priorTasks = []` → "Prior work on this story" section omitted
- `lessons = []` → "Relevant lessons for <Agent>" section omitted
- Prior task in `done_with_concerns` state → sub-bullet renders the concern, not inline text
- Unknown agent name → throws / returns error string (caller decides)

CLI:

- Missing `--story` / `--agent` / `--task-id` → exit 1 with clear stderr
- Unknown agent name not in canonical list → exit 1 with clear stderr
- Task UUID not present in sdlc-status.json → exit 1 with clear stderr
- Spec doc missing → payload still prints, ACs section suppressed, exit 0
- Plan doc missing → payload still prints, Plan excerpt section suppressed, exit 0
- Happy path → stdout matches a snapshot fixture, no stderr output

Integration:

- Two-task flow: payload for task 2 contains task 1's summary
- Three-task flow with one `done_with_concerns`: payload for task 3 shows sub-bullet for task 2's concern

---

## 11. Scope Boundaries

**In scope for US-0184:**

- ✅ `tools/agent-context.js` (CLI wrapper)
- ✅ `tools/lib/agent-context-assembler.js` (pure assembler module)
- ✅ `--summary` flag on `agent-lifecycle.js done` (US-0183 schema patch)
- ✅ `--plan-task-index` flag on `agent-lifecycle.js start` (US-0183 schema patch)
- ✅ Task schema additions: `summary`, `planTaskIndex` (both optional, default null)
- ✅ LESSONS.md `@agent:` tagging convention
- ✅ One-time tagging migration pass over all existing L-XXXX entries
- ✅ `validateLessonsTags()` helper + CI check for untagged or invalid tags
- ✅ DM_AGENT.md §Per-Task Dispatch Ritual updates (three small edits)
- ✅ All tests from §10
- ✅ ID_REGISTRY.md and RELEASE_PLAN.md entries for the story and its ACs

**Out of scope (handled by US-0185 or later):**

- ❌ Full Conductor protocol upgrade for dispatch phase — review gates, BLOCKED smart-routing loops at the agent level → **US-0185**
- ❌ Task-level spec-compliance and code-quality reviews triggered by Conductor → **US-0185**
- ❌ Dashboard widget showing context-payload generation history or sizes → not planned (low ROI)
- ❌ Context payload caching or re-use across retries → YAGNI (regeneration is cheap)
- ❌ `--out-file` flag for persisted payloads → YAGNI (add only if a concrete debug need appears)
- ❌ Token budget caps / payload truncation → YAGNI (raise only if a real payload bloats unmanageably)
- ❌ Cross-story context (drawing prior-work from a different story) → out of scope (story-scoped by design)

**Effort estimate:** ~4-6 days. Smaller than US-0183 — the pure-function assembler is simple; the largest chunk of manual work is the one-time LESSONS.md tagging migration (~60 entries).

---

## 12. Acceptance Criteria (draft for RELEASE_PLAN.md)

- **AC-0720:** `tools/agent-context.js generate --story X --agent Y --task-id Z` writes a markdown payload to stdout and exits 0 on the happy path
- **AC-0721:** Payload includes "Your task", and (when content available) "Story acceptance criteria", "Plan excerpt", "Prior work on this story", and "Relevant lessons for <Agent>" — sections are suppressed entirely (heading and body) when content is empty
- **AC-0722:** `--summary` flag on `agent-lifecycle.js done` and `--plan-task-index` flag on `agent-lifecycle.js start` are added as optional flags; corresponding task fields default to null and persist when provided
- **AC-0723:** LESSONS.md `@agent:` tagging convention is documented; every existing L-XXXX entry receives a canonical tag; `validateLessonsTags()` returns zero untagged entries and zero invalid agent names
- **AC-0724:** DM_AGENT.md §Per-Task Dispatch Ritual is updated with `--plan-task-index` capture, the new step 1b context-generation block, and the `--summary` flag on the `done` row; the orchestrator persona is referred to as **Conductor** throughout
- **AC-0725:** Coverage gate (≥80% statements) remains green; all new test files meet the per-file targets in §10

---

## 13. Open Questions — None

All design decisions settled in the brainstorming session (2026-05-14):

- Output format: pre-formatted markdown to stdout (no JSON, no `--out-file` flag yet)
- File path discovery: parse the plan doc using `planTaskIndex`, no heuristics
- Prior-task output: dedicated `summary` field, optional with graceful fallback
- Lessons filtering: explicit `@agent:` tagging in LESSONS.md, one-time migration pass
- Module structure: CLI wrapper + pure assembler (mirrors `agent-lifecycle.js` pattern)
- Story ACs included in payload (single most consequential late addition during design review)
- Section suppression: empty sections omit both heading and body
- Orchestrator persona name: **Conductor** (consistent with existing DM_AGENT.md body text and Lens findings tag convention)
