# US-0259 Accessor API — Pre-Implementation Design Note

**NOT A SPEC.** This is a pre-implementation interface sketch for `tools/lib/repository/sdlc-status-reader.js`. The authoritative design lives in `docs/superpowers/specs/2026-05-22-phase-e-consumer-migration-design.md` §4.1. This document refines the function signatures and return contracts based on a runtime-shape audit of the live `docs/sdlc-status.json` and the dashboard's current access patterns. Intended for the US-0259 implementer.

**Status:** Notes only. Not subject to spec-review process. May be revised inline during implementation.

---

## 1. Module shape

```js
// tools/lib/repository/sdlc-status-reader.js
'use strict';

module.exports = {
  programme, // returns the programme object or {}
  agents, // Record<string, AgentStatus>
  metrics, // Metrics
  stories, // Record<string, Story>
  epics, // Record<string, Epic>
  phases, // Phase[]
  cycles, // Cycle[]
  currentPhase, // number | null
  githubStatus, // GitHubStatus | null
  project, // Project | {}
};
```

Single-file module. No classes. Pure functions of the parsed JSON. No side effects, no file I/O, no async. Read-only contract.

---

## 2. Function contracts

Each accessor takes one argument — the parsed JSON object from `docs/sdlc-status.json` (or a fixture). All accessors are total: they NEVER throw on missing/malformed input. They return a safe default of the right type.

### `programme(json)` → object

```js
function programme(json) {
  return (json && json.programme) || {};
}
```

Returns `{}` if `json` is null/undefined or `json.programme` is missing. Always an object.

### `agents(json)` → `Record<string, AgentStatus>`

```js
function agents(json) {
  return programme(json).agents || json.agents || {};
}
```

**Shape (from runtime audit):** object keyed by agent name (string) → agent object with these properties:

| Property           | Type                                                | Required | Notes                            |
| ------------------ | --------------------------------------------------- | -------- | -------------------------------- |
| `status`           | `'idle' \| 'active' \| 'blocked' \| 'needs-review'` | yes      |                                  |
| `currentTask`      | `string \| null`                                    | yes      | null when idle                   |
| `tasksCompleted`   | number                                              | yes      |                                  |
| `testsPassed`      | number                                              | optional | only on test-runner agents       |
| `testsFailed`      | number                                              | optional |                                  |
| `coveragePercent`  | number                                              | optional | only on coverage-reporter agents |
| `reviewsCompleted` | number                                              | optional | only on reviewer agents          |
| `blockers`         | number                                              | optional |                                  |
| `model`            | `'haiku' \| 'sonnet' \| 'opus'`                     | optional |                                  |

**Default on missing:** `{}` (empty object). Dashboard iterates with `Object.entries(agents)` — an empty object iterates zero times, no crash.

### `metrics(json)` → `Metrics`

```js
function metrics(json) {
  return programme(json).metrics || json.metrics || {};
}
```

**Shape:** object with scalar numeric/boolean properties. All optional from the accessor's perspective; the dashboard reads with property-access fallbacks (`metrics.bugsOpen || 0`).

| Property                                                           | Type   |
| ------------------------------------------------------------------ | ------ |
| `storiesCompleted`, `storiesTotal`, `tasksCompleted`, `tasksTotal` | number |
| `testsPassed`, `testsFailed`, `testsTotal`                         | number |
| `bugsOpen`, `bugsFixed`                                            | number |
| `coveragePercent`                                                  | number |
| `reviewsApproved`, `reviewsBlocked`                                | number |

**Default on missing:** `{}`. Property reads on `{}` yield `undefined`, which the dashboard already handles via `|| 0`.

### `stories(json)` → `Record<string, Story>`

```js
function stories(json) {
  return programme(json).stories || json.stories || {};
}
```

**Shape:** object keyed by story ID (e.g., `"US-0259"`) → story object:

| Property                   | Type                                                | Notes                      |
| -------------------------- | --------------------------------------------------- | -------------------------- |
| `status`                   | `'ToDo' \| 'InProgress' \| 'Complete' \| 'Blocked'` |                            |
| `epic`                     | `string \| null`                                    | epic ID                    |
| `assignedAgent`            | `string \| null`                                    | agent name                 |
| `startedAt`, `completedAt` | `string \| null`                                    | ISO timestamps             |
| `specPhase`, `planPhase`   | `string \| null`                                    | per `generate-plan.js:263` |
| `phaseHistory`             | `Array<object>`                                     | per `generate-plan.js:263` |

**Default on missing:** `{}`.

### `epics(json)` → `Record<string, Epic>`

```js
function epics(json) {
  return programme(json).epics || json.epics || {};
}
```

**Shape:** object keyed by epic ID → `{name, status, startedAt, completedAt, storiesCompleted, storiesTotal}`.

**Default on missing:** `{}`.

### `phases(json)` → `Phase[]`

```js
function phases(json) {
  return programme(json).phases || json.phases || [];
}
```

**Shape:** ARRAY of `{id, name, agents: string[], deliverables: string[], status, startedAt, completedAt}`.

**Default on missing:** `[]` (not `{}` — type matters; dashboard does `.filter()` / `.map()`).

### `cycles(json)` → `Cycle[]`

```js
function cycles(json) {
  // Defensive: cycles MAY be a non-array in old fixtures.
  const fromProgramme = programme(json).cycles;
  if (Array.isArray(fromProgramme)) return fromProgramme;
  const fromTopLevel = json && json.cycles;
  if (Array.isArray(fromTopLevel)) return fromTopLevel;
  return [];
}
```

**Edge case:** the dashboard's existing inline code at `docs/dashboard.html:3005` uses `Array.isArray(status.cycles) ? status.cycles : []` defensively, suggesting `cycles` might historically be set to a non-array value (e.g., `null` or `{}`). The accessor preserves this defensive check.

**Shape:** ARRAY of cycle snapshot objects with `{id, completedAt, storiesCompleted, testsPassed, testsFailed, coveragePercent, bugsFixed, outcome, incidents, phaseDurations}`.

**Default on missing or non-array:** `[]`.

### `currentPhase(json)` → number | null

```js
function currentPhase(json) {
  const p = programme(json).currentPhase;
  if (typeof p === 'number') return p;
  const t = json && json.currentPhase;
  if (typeof t === 'number') return t;
  return null;
}
```

**Shape:** integer (phase number, 1-indexed; 0 means "not started"). The audit shows the dashboard uses `status && status.currentPhase` guards — undefined is acceptable downstream, but the accessor returns `null` explicitly for clarity. Dashboard code reading `null` behaves the same as reading `undefined` for the patterns observed (truthy checks, integer arithmetic with `|| 0`).

**Type-narrow check (`typeof === 'number'`):** prevents returning a string from a corrupted fixture.

### `githubStatus(json)` → object | null

```js
function githubStatus(json) {
  const gs = programme(json).githubStatus || (json && json.githubStatus);
  return gs && typeof gs === 'object' ? gs : null;
}
```

**Critical: this is the ONLY accessor that can return `null`** (besides `currentPhase`). The dashboard's existing code at `generate-dashboard.js:474` does `if (!gs || ...)` early-return — null is the expected absent-value signal. Do NOT default to `{}` or the dashboard's null-guard misfires.

**Shape when present:** `{prs: PR[], ciSummary, deployment, fetchedAt, ciPollUntil}`. See spec §3 for the full PR sub-shape.

### `project(json)` → object

```js
function project(json) {
  return programme(json).project || json.project || {};
}
```

**Shape:** `{name, description, repoUrl, startDate}`. Dashboard reads with `status && status.project && status.project.name` guards — `{}` default is safe (`{}.name` is undefined, falls through to the hardcoded `'PlanVisualizer'` fallback at `generate-dashboard.js:2155`).

---

## 3. Why the dual-read fallback is transitional

Per spec §4.1, every accessor reads `programme.{key}` first, falls back to `json.{key}`, then to the safe default. The fallback exists because:

- US-0259 lands first → consumers start reading `programme.*`.
- US-0262 (Migration 006) lands later → ingests legacy top-level into SQL.
- Between those two merges, any checkout that hasn't run `pv:upgrade` since the migration shipped will have `programme.*` empty and only top-level populated. Without the fallback: empty dashboard. With the fallback: dashboard works.
- US-0261 removes the fallback after Migration 006 has provably run.

**Implementer note:** the fallback chain `programme(json).agents || json.agents || {}` uses `||` which short-circuits on any falsy value. For accessors that legitimately return `[]` or `{}`, this is fine (empty object/array is truthy in JS). For `currentPhase: 0` (a valid not-started value), the chain WOULD incorrectly fall through — which is why `currentPhase` and `githubStatus` use explicit type checks instead of bare `||`.

---

## 4. Dashboard migration patterns

Every dashboard read of a legacy key becomes a call to the accessor. Concrete examples:

| Before (`tools/generate-dashboard.js`)               | After                                                        |
| ---------------------------------------------------- | ------------------------------------------------------------ |
| `const ag = status.agents \|\| {};`                  | `const ag = reader.agents(status);`                          |
| `Object.values(status.agents).map(...)`              | `Object.values(reader.agents(status)).map(...)`              |
| `status.phases.filter(p => p.status === 'complete')` | `reader.phases(status).filter(p => p.status === 'complete')` |
| `if (!status.githubStatus) return;`                  | `if (!reader.githubStatus(status)) return;`                  |
| `status.project.name`                                | `reader.project(status).name`                                |
| `status.currentPhase`                                | `reader.currentPhase(status)`                                |

**Net effect on dashboard code:** the existing `|| {}` / `|| []` / `Array.isArray() ? : []` defensive scaffolding becomes redundant — the accessor owns the defaults. The diff for US-0259 should _remove_ defensive checks at the call sites, not preserve them. (Removing redundancy makes the migration self-evident in review.)

Import sketch at top of `tools/generate-dashboard.js`:

```js
const reader = require('./lib/repository/sdlc-status-reader');
```

The same import goes into the `<script>` block in `docs/dashboard.html`. But the inline JS in `dashboard.html` is browser code — it cannot `require()`. Two options:

**A. Inline copy.** Paste the accessor function bodies into `dashboard.html`'s script block. Pro: no build step. Con: duplicates code; risk of drift.

**B. Generate.** `tools/generate-dashboard.js` reads `sdlc-status-reader.js`, transpiles to a browser-safe global, and injects into `dashboard.html` during generation. Pro: single source of truth. Con: adds a build step.

**Recommendation:** **option B.** The dashboard HTML is already generated from JS via `generate-dashboard.js`; injecting one more module is incremental. Drift between the two reader copies in option A would be invisible in code review and exactly the kind of bug Phase E exists to eliminate.

---

## 5. Edge cases the test fixtures must cover

Beyond the spec's §6.1.1 fixture set (state-A, state-B, state-C, state-c-conflict), US-0259 specifically should add:

- **Malformed programme:** `{programme: null}` — accessors must not crash.
- **Wrong-type values:** `{programme: {cycles: null}}` and `{cycles: "not an array"}` — accessor defaults to `[]`.
- **`currentPhase: 0`:** valid not-started value; must NOT fall through to fallback (regression test for the `||` chain bug).
- **`githubStatus: null`:** valid signal; accessor must return `null`, not `{}`.
- **Empty programme:** `{programme: {}}` — every accessor falls through to top-level then to default.

---

## 6. Acceptance criteria mapping

This note refines AC-1015 from the spec. Concrete test additions:

- `tests/lib/repository/sdlc-status-reader.test.js` — unit tests for all 10 functions against the 5 edge-case fixtures above plus the standard state-A/B/C fixtures from `tests/fixtures/phase-e/`. Coverage target ≥90% per spec §6.4.
- `tests/integration/dashboard-uses-accessor.test.js` — assertion that `tools/generate-dashboard.js` source contains no direct `status.{legacy-key}` access; all reads go through `reader.*`. Implementation: regex grep on the source file (the only place this guard is reliable since the dashboard is the single migration target).

---

## 7. Open questions to resolve during implementation

These are not blockers — flag them in the US-0259 PR description and the reviewer can decide:

1. **Does `tasks` need an accessor too?** It's not a legacy key — it's already canonical. But for symmetry, `reader.tasks(json)` would let future readers use the module as the single read API. Argument for: consistency. Argument against: scope creep on US-0259. Recommendation: don't add it; let US-0260 add `reader.tasks` if any non-dashboard consumer needs the symmetry.

2. **Does the accessor module need a "shape version" check?** E.g., refuse to operate on a JSON with `tasks` but no `programme` field (state B). Current design: silently fall back. Future-proof design: throw or warn after Migration 006 has run. Recommendation: don't add it now; the dual-read removal in US-0261 implicitly answers this.

3. **Should `githubStatus` accessor return a frozen object?** The dashboard is read-only by audit, but a defensive `Object.freeze` would enforce it. Cost: O(n) recursion on every call. Recommendation: skip; the audit confirmed no mutations; freezing is solving a hypothetical problem.
