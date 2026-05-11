# US-0180 — Agent Model Selection Design Spec

**Date:** 2026-05-10
**Status:** Planned
**Story:** US-0180 (EPIC-0014)
**Scope:** Per-agent `## Model Selection` tables in `docs/agents/*.md`; scenario quick-reference in `DM_AGENT.md`; `--model` + `--model-rationale` flags on `agent-start`; model chip on agentic dashboard's Agent Workload widget.
**Depends on:** None

---

## Overview

The Conductor (DM_AGENT) and 8 specialist agents in the agentic SDLC pipeline today dispatch at whatever default model the platform provides. US-0180 makes the model choice per-dispatch and per-task, driven by a small table in each agent's instruction file. The Conductor reads the target agent's table, matches the task to a row, and dispatches with the chosen model via the platform's existing spawning mechanism (in Claude Code: the Task tool's `model` parameter).

**Mechanism:** prompt-driven. Each agent file declares its task → model mapping in a `## Model Selection` section; the Conductor's instructions are updated to consult it. No new dispatcher code; we use the existing Task tool.

**Tier scope:** three-tier (`haiku`, `sonnet`, `opus`). Opus is rare — only Architect (system design), BE Dev (schema/security), and Code Reviewer (security/architecture review) have opus rows.

**Audit:** `agent-start --model <tier> [--model-rationale "<why>"]` logs the choice into `sdlcStatus.log` AND sets `sdlcStatus.agents.<name>.model`. The agentic dashboard's Agent Workload widget shows the current model as an inline chip alongside the existing Active/Idle status chip.

---

## CLI Surface

### `tools/update-sdlc-status.js` extensions

`agent-start` gains two new optional flags:

```bash
node tools/update-sdlc-status.js agent-start \
  --agent Pixel \
  --story US-0181 \
  --task "implement dashboard widget" \
  --model sonnet \
  --model-rationale "non-trivial UI integration across 3 components"
```

| Flag                | Type                                          | Behaviour                                                                                                                                                              |
| ------------------- | --------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `--model`           | optional string, one of `haiku\|sonnet\|opus` | Records the model chosen for this dispatch. Missing → defaults to `sonnet` with a log note "model not specified, defaulting to sonnet". Invalid value → error, exit 1. |
| `--model-rationale` | optional string                               | Free-form justification for the chosen model. Required when `--model opus` is passed; recommended when the chosen model differs from the agent's table recommendation. |

`agent-done` is extended: clears `agents.<name>.model` (sets to `null`). No new flag.

### Schema additions

`docs/sdlc-status.json` gains a `model` field on agent state:

```json
"agents": {
  "Pixel": {
    "status": "active",
    "currentTask": "implement dashboard widget",
    "currentStory": "US-0181",
    "model": "sonnet"     // NEW. null when idle. undefined for pre-migration data.
  }
}
```

The log array gains `model` and `modelRationale` fields on dispatch events:

```json
"log": [
  {
    "timestamp": "2026-05-10T20:15:03Z",
    "agent": "Pixel",
    "type": "agent-start",
    "story": "US-0181",
    "task": "implement dashboard widget",
    "model": "sonnet",          // NEW
    "modelRationale": null      // NEW. String when --model-rationale was passed.
  }
]
```

Both are non-breaking — existing consumers ignore unknown fields. The historical log entry enables future spend-by-model analytics (future work item).

---

## Dispatch Ritual (DM_AGENT.md addition)

Verbatim prose inserted into `docs/agents/DM_AGENT.md`, in the "How to Spawn Sub-Agents" section, as a new subsection:

```markdown
### Model Selection Ritual

Before spawning any sub-agent:

1. Read the target agent's `## Model Selection` section in `docs/agents/<Agent>_AGENT.md`.
2. Match the dispatch task to a row in the table. If no row matches, default to `sonnet`.
3. Record the dispatch with the chosen model:
   `node tools/update-sdlc-status.js agent-start --agent <name> --story <id> --task "<desc>" --model <tier>`
4. Spawn the sub-agent using the platform's model-override mechanism (in Claude Code: pass `model: <tier>` to the Task tool).
5. If the table's recommendation does not fit the task — i.e., you have a deliberate reason to override — add `--model-rationale "<short justification>"` to step 3.

**Ordering rule:** log after spawn lands. If the spawn fails, do not log; if the log fails after a successful spawn, surface as an event but do not block.

**Opus discipline:** Opus dispatches require `--model-rationale "<reason>"` even when the table recommends opus. The rationale becomes the audit trail for high-cost decisions.

**Fallback rule:** If no row in the target agent's table matches the task, default to `sonnet`. Record `--model-rationale "no table match"` so adherence can be measured over time.
```

---

## Per-Agent `## Model Selection` Sections

Each of the 8 specialist agent files (PO, Architect, UI Designer, FE Dev, BE Dev, Code Reviewer, Functional Tester, Automation Tester) gets a `## Model Selection` section with a three-column table. Format:

```markdown
| Task type          | Model               | Rationale       |
| ------------------ | ------------------- | --------------- |
| <task description> | haiku\|sonnet\|opus | <why this tier> |
```

**Cognitive-work framing** used in all rationale columns:

- **haiku** → pattern application (answer follows from documented rules / existing examples)
- **sonnet** → integration judgment (answer requires combining multiple sources or design choices)
- **opus** → irreversible architecture (answer cascades across the codebase, hard to reverse)

### Initial assignments

#### `PO_AGENT.md`

| Task type                                                | Model  | Rationale                                                          |
| -------------------------------------------------------- | ------ | ------------------------------------------------------------------ |
| Status check, story field update, AC marking complete    | haiku  | Pattern application — rules already documented                     |
| Story breakdown, AC writing, bug triage, roadmap shaping | sonnet | Integration judgment — combining context, requirements, priorities |

#### `ARCHITECT_AGENT.md`

| Task type                                                                 | Model  | Rationale                                              |
| ------------------------------------------------------------------------- | ------ | ------------------------------------------------------ |
| Routine code structure question, lookup, clarification                    | haiku  | Pattern application                                    |
| Refactor planning, design doc within existing patterns, component diagram | sonnet | Integration judgment within established architecture   |
| System design, new architectural pattern, cross-cutting decision          | opus   | Irreversible — cascades through every downstream agent |

#### `UI_DESIGNER_AGENT.md`

| Task type                                                        | Model  | Rationale                                           |
| ---------------------------------------------------------------- | ------ | --------------------------------------------------- |
| Style adjustment, single-component tweak following design system | haiku  | Pattern application — design system is documented   |
| Mockup creation, design system update, new screen                | sonnet | Integration judgment across screens / design tokens |

#### `FE_DEV_AGENT.md`

| Task type                                                                        | Model  | Rationale            |
| -------------------------------------------------------------------------------- | ------ | -------------------- |
| Style fix, format change, pattern-following implementation (Nth tab, Nth widget) | haiku  | Pattern application  |
| Net-new feature with non-trivial design choices, cross-cutting refactor          | sonnet | Integration judgment |

#### `BE_DEV_AGENT.md`

| Task type                                                | Model  | Rationale                                          |
| -------------------------------------------------------- | ------ | -------------------------------------------------- |
| Constants change, pattern-following endpoint addition    | haiku  | Pattern application                                |
| Net-new feature, integration logic, multi-file bugfix    | sonnet | Integration judgment                               |
| Database schema migration, security-sensitive auth logic | opus   | Irreversible — hard to roll back without data loss |

#### `CODE_REVIEWER_AGENT.md`

| Task type                                            | Model  | Rationale                                     |
| ---------------------------------------------------- | ------ | --------------------------------------------- |
| Syntax/style review, lint check, format verification | haiku  | Pattern application — rules are deterministic |
| Feature PR review, multi-file diff review            | sonnet | Integration judgment across the diff          |
| Security review, architectural PR review             | opus   | Irreversible if a flaw ships                  |

#### `FUNCTIONAL_TESTER_AGENT.md`

| Task type                                                  | Model  | Rationale                            |
| ---------------------------------------------------------- | ------ | ------------------------------------ |
| Manual test execution, regression run, snapshot verify     | haiku  | Pattern application — runbook-driven |
| Test case writing, edge case identification, test strategy | sonnet | Integration judgment about coverage  |

#### `AUTOMATION_TESTER_AGENT.md`

| Task type                                               | Model  | Rationale                                         |
| ------------------------------------------------------- | ------ | ------------------------------------------------- |
| Automated test run, flake re-run, simple fixture update | haiku  | Pattern application                               |
| New test suite, fixture design, framework refactor      | sonnet | Integration judgment across the test architecture |

**Tally:** 19 rows across 8 files. 3 opus rows (Architect, BE Dev, Code Reviewer) — 16% of all rows. Realistic dispatch profile: ~70% haiku, ~25% sonnet, ~5% opus.

**Estimated savings vs all-sonnet baseline:** ~65% on dispatch costs.

---

## DM_AGENT Scenario Quick-Reference

`DM_AGENT.md` gains a scenario-indexed quick reference. This is a **scenario → agent** index, NOT a duplicate model decision table. The agent's own `## Model Selection` section is the canonical source of model assignments.

Insert into `DM_AGENT.md` as a new section after "Orchestration Playbook":

```markdown
## Model Selection — Scenario Quick-Reference

Scenario → agent index. Consult the target agent's `## Model Selection` section for the model choice.

| Scenario                                       | Target agent                          | Notes                                             |
| ---------------------------------------------- | ------------------------------------- | ------------------------------------------------- |
| story-start (analysis, AC writing, breakdown)  | PO                                    | —                                                 |
| story-start (architecture review)              | Architect                             | opus when introducing a new architectural pattern |
| feature implementation                         | FE Dev / BE Dev                       | —                                                 |
| code review / release prep / pre-release audit | Code Reviewer                         | opus for security or architecture-level review    |
| test execution (automated or manual)           | Automation Tester / Functional Tester | —                                                 |
| design, mockups, design-system work            | UI Designer                           | —                                                 |
| bug triage / priority update                   | PO                                    | —                                                 |

**Fallback rule:** if no scenario matches, default to `sonnet`. Record `--model-rationale "no scenario match"` on the agent-start call.

**Cost ground rule:** opus dispatches require an irreversible-decision justification documented via `--model-rationale "..."`. If unsure whether opus is justified, sonnet is the right call.
```

Zero drift risk: per-agent tables are the only source of model assignments. Conductor table is purely the scenario routing index.

---

## Dashboard Badge UI

`dashboard.html` Agent Workload widget — each agent card currently shows portrait + name + role + status chip (`Active`/`Idle`). US-0180 adds a model chip **inline next to** the status chip when an agent is active.

### Visual layout

```
┌─────────────────────────┐
│   [portrait image]      │
│        Pixel            │
│      Frontend Dev       │
│  ┌──────┐ ┌──────┐      │
│  │Active│ │sonnet│      │
│  └──────┘ └──────┘      │
└─────────────────────────┘
```

Per-state rendering:

- Agent `active` with `model: sonnet` → both chips: `Active` + `sonnet`
- Agent `idle` (model is null) → only `Idle` chip; no model chip
- Pre-migration agent (model undefined) → only status chip; treated as "model unknown"; render no model chip; no error

### Tier colors (low-saturation, project oklch palette)

```css
.mc-agent-model-chip {
  font-size: 9px;
  padding: 1px 6px;
  border-radius: 8px;
  margin-left: 4px;
}
.mc-agent-model-chip.haiku {
  background: rgba(34, 197, 94, 0.1);
  color: oklch(60% 0.08 145);
}
.mc-agent-model-chip.sonnet {
  background: rgba(99, 102, 241, 0.1);
  color: oklch(60% 0.08 260);
}
.mc-agent-model-chip.opus {
  background: rgba(168, 85, 247, 0.1);
  color: oklch(60% 0.1 290);
}
```

Saturation is half the standard chip palette so the existing `Active` chip (orange, attention-grabbing) remains the visual focal point. Model chip is a quiet annotation.

### Implementation

`tools/generate-dashboard.js` reads `sdlcStatus.agents[name].model` per agent card. Renders `<span class="mc-agent-model-chip ${model}">${model}</span>` immediately after the existing status chip, in the same flex row. Conditional: only render when `model` is one of `haiku|sonnet|opus`; otherwise render nothing.

---

## Testing

### `tests/unit/update-sdlc-status.test.js` extension (+6 tests)

```
- agent-start with --model sonnet records model field on agents.<name>
- agent-start without --model defaults to 'sonnet' (with log note)
- agent-start --model haiku|sonnet|opus all accepted
- agent-start --model invalid_tier errors with exit 1
- agent-start --model-rationale stores rationale string in the log entry
- agent-done clears the model field (sets to null)
```

### `tests/unit/generate-dashboard.test.js` extension (+5 tests)

```
- agent card renders inline model chip when agents[name].model = 'sonnet'
- agent card renders no model chip when model is null (idle)
- agent card renders no model chip when model is undefined (pre-migration)
- haiku/sonnet/opus chips each get correct CSS class
- model chip is sibling of status chip (inline), not nested below
```

### `tests/unit/agent-files.test.js` (NEW, +4 tests)

```
- all 8 specialist agent files contain a `## Model Selection` section (file-presence)
- each Model Selection table has column headers exactly ["Task type", "Model", "Rationale"] (format contract)
- opus row count across all agent files is ≤ 20% of total rows (policy: opus stays rare; current state is 3/19 = 16%)
- DM_AGENT.md does NOT contain `## Model Selection` (it owns the scenario index instead)
```

The `≤ 20% opus rows` test is policy-driven rather than file-list-driven — if a future story needs to add an opus row to UI Designer (e.g., for major UX overhaul), it's allowed as long as the overall proportion stays low. The test enforces the principle ("opus rare") not today's specific assignments. Current state: 3 opus rows / 19 total = 16%.

The column-header test enforces the parsing contract the Conductor relies on. A maintainer who renames a column accidentally is caught by CI before it ships.

**Coverage target:** ≥85% on new code paths. Full suite stays ≥80%.

---

## Error Handling

| Failure                                                               | Behaviour                                                                               |
| --------------------------------------------------------------------- | --------------------------------------------------------------------------------------- |
| `agent-start --model` with no value                                   | Error, exit 1                                                                           |
| `agent-start --model unknown_tier`                                    | Error: "must be one of haiku, sonnet, opus", exit 1                                     |
| `agent-start` with no `--model` flag                                  | Default to `sonnet`, log note: "--model not specified, defaulting to sonnet"            |
| Reading `agents[name].model` returns `undefined` (pre-migration data) | Treat as null; render no badge; no error                                                |
| `agent-done` when model field is undefined                            | Set to null; no error                                                                   |
| `dashboard.html` reading a model value outside {haiku, sonnet, opus}  | Treat as unknown; render no badge; no error                                             |
| `--model-rationale` with no value                                     | Error, exit 1                                                                           |
| Opus dispatch without `--model-rationale`                             | Log a warning to stderr; do NOT block dispatch (the audit gap is itself a logged event) |

---

## Roll-out / Migration

Single PR. All changes are additive and non-breaking.

1. Modify `tools/update-sdlc-status.js`: add `--model` and `--model-rationale` to `agent-start`; clear `model` field on `agent-done`; include both fields in log entries.
2. Modify `tools/generate-dashboard.js`: render model chip inline next to status chip per Section "Dashboard Badge UI".
3. Add CSS for `.mc-agent-model-chip.haiku|.sonnet|.opus` (low-saturation palette) to the dashboard styles.
4. Add `## Model Selection` section to all 8 specialist agent files using the tables from Section "Per-Agent `## Model Selection` Sections".
5. Add `## Model Selection — Scenario Quick-Reference` section to `DM_AGENT.md` using the lean 7-row table from Section "DM_AGENT Scenario Quick-Reference".
6. Add the verbatim "Model Selection Ritual" subsection to `DM_AGENT.md` "How to Spawn Sub-Agents" per Section "Dispatch Ritual".
7. Add the 3 test files / extensions per Section "Testing".

No data migration required. Existing `sdlc-status.json` files work unchanged (model field undefined → treated as null).

---

## Out of Scope

- Active enforcement of the model choice via a code-level dispatcher (this is prompt-driven; Conductor adherence is measured by the audit trail, not enforced).
- Linting that validates opus dispatches have a `--model-rationale` (only a warning today; future work).
- Cost dashboards that aggregate `sdlcStatus.log` entries by model (the log captures the data; aggregation is future work, naturally surfaced on the Costs tab).
- Cross-session model recommendations for ad-hoc Claude Code work (covered by US-0179 `suggest-model`; this story is agent-pipeline only).
- Auto-tuning: log-driven adjustment of agent tables based on Conductor adherence patterns.

---

## Future Work

- `validate-model-rationale` lint that fails CI when opus dispatches lack `--model-rationale`.
- Per-agent model-spend totals in the Agent Workload widget (replace or augment the active/idle status with a "model-spend this cycle" annotation). Requires aggregating `sdlcStatus.log` entries by `model` field.
- Auto-tune assistance: a CLI command that reads recent log entries and flags rows in agent tables where the Conductor consistently picks a different model than the table recommends, suggesting the table be updated.
- Integration with US-0179: when a Conductor faces an ambiguous dispatch, optionally call `npm run memory:suggest-model -- --task "<dispatch task>"` as a tiebreaker, blending the memory-system's complexity hints with the agent's own table.
