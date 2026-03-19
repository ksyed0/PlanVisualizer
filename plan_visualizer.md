# PlanVisualizer — Format Requirements

This file defines the exact document formats that PlanVisualizer parses to generate
`plan-status.html`. Read this whenever creating or updating tracked project files.

**Source files read by `node tools/generate-plan.js`:**

| File | Parser | Dashboard use |
|------|--------|---------------|
| `docs/RELEASE_PLAN.md` | `parse-release-plan.js` | Epics, stories, tasks, ACs |
| `docs/TEST_CASES.md` | `parse-test-cases.js` | Traceability tab, at-risk detection |
| `docs/BUGS.md` | `parse-bugs.js` | Bugs tab, at-risk detection |
| `docs/AI_COST_LOG.md` | `parse-cost-log.js` | Costs tab, session timeline |
| `docs/LESSONS.md` | `parse-lessons.js` | Lessons tab, Bug Ref cross-links |
| `progress.md` | `parse-progress.js` | Recent activity feed (with session number) |

All paths are relative to the project root and can be overridden in `plan-visualizer.config.json`.
Files that are missing or empty produce empty sections — the generator will not fail.

---

## `docs/RELEASE_PLAN.md`

Epics, User Stories, Tasks, and Acceptance Criteria must be written inside **fenced code blocks**
(` ``` ` … ` ``` `). Each artefact block is separated by a **blank line**. Multiple blocks per
file are supported.

### Epic

```
EPIC-0001: Short descriptive title
Description: What this epic delivers and why it matters
Release Target: MVP
Status: Planned
Dependencies: None
```

`Status` values: `Planned` | `In Progress` | `Complete`

### User Story

```
US-0001 (EPIC-0001): As a [persona], I want [action], so that [outcome].
Priority: High
Estimate: M
Status: Planned
Branch: feature/US-0001-short-name
Dependencies: None
Acceptance Criteria:
  - [ ] AC-0001: Specific, testable condition
  - [ ] AC-0002: Specific, testable condition
```

`Priority` values: `High` | `Medium` | `Low`
`Estimate` values: `S` | `M` | `L` | `XL` (mapped to hours via `plan-visualizer.config.json`)
`Status` values: `Planned` | `In Progress` | `Complete` | `Blocked`
ACs use `- [ ]` (open) or `- [x]` (done) followed by `AC-XXXX: text`

### Task

```
TASK-0001 (US-0001): Short imperative description of the work
Type: Dev
Assignee: Agent
Status: To Do
Branch: feature/US-0001-short-name
Notes:
```

`Type` values: `Dev` | `Test` | `Design` | `Docs` | `Infra` | `Bug`
`Status` values: `To Do` | `In Progress` | `Done` | `Blocked`

---

## `docs/TEST_CASES.md`

Free-form markdown. Each test case block starts with `TC-XXXX:` at the beginning of a line.
The parser reads until the next `TC-XXXX:` line.

```
TC-0001: Short descriptive title
Related Story: US-0001
Related Task: TASK-0001
Related AC: AC-0001
Type: Functional
Status: [ ] Not Run
Defect Raised: None
```

`Type` values: `Functional` | `Regression` | `Edge Case` | `Negative` | `Accessibility` | `Performance`
`Status` values: `[ ] Not Run` | `[x] Pass` | `[x] Fail`
`Defect Raised`: `None` or `BUG-XXXX`

---

## `docs/BUGS.md`

Free-form markdown. Each bug block starts with `BUG-XXXX:` at the beginning of a line.
The parser reads until the next `BUG-XXXX:` line.

```
BUG-0001: Short description of the defect
Severity: High
Related Story: US-0001
Related Task: TASK-0001
Status: Open
Fix Branch: bugfix/BUG-0001-short-description
Lesson Encoded: No
```

`Severity` values: `Critical` | `High` | `Medium` | `Low`
`Status` values: `Open` | `In Progress` | `Fixed` | `Verified` | `Closed`
`Lesson Encoded`: `Yes — see docs/LESSONS.md` | `No`

> **At-risk detection:** A story is flagged at-risk if it has a linked `Critical` or `High`
> bug with status `Open` or `In Progress`.

---

## `docs/LESSONS.md`

Each lesson block starts with `## L-XXXX — Title` at the beginning of a line. The parser reads
until the next `## L-XXXX` heading. Lessons are displayed on the **Lessons tab** in column and
card views. Bug Ref cross-links are generated automatically when a `BUG-XXXX` entry's
`Lesson Encoded` field contains the lesson's ID.

```markdown
## L-0001 — Short lesson title
**Rule:** The actionable rule derived from the lesson.
*Context paragraph describing when this lesson was learned.*
**Date:** 2026-03-18
```

Required fields per lesson block: `Rule:`, `Date:`. The context italics paragraph is optional.
Lesson IDs must be sequential and registered in `docs/ID_REGISTRY.md`.

---

## `docs/AI_COST_LOG.md`

A markdown table appended automatically by the Claude Code Stop hook (`tools/capture-cost.js`).
**Do not edit the column order.** Add a header if the file is new:

```markdown
| Date       | Session ID | Branch | Input | Output | Cache Read | Cost USD |
|------------|------------|--------|-------|--------|------------|----------|
| 2026-03-18 | abc123def  | main   | 1000  | 500    | 200        | 0.0150   |
```

Columns (positional, all required):
1. `Date` — `YYYY-MM-DD`
2. `Session ID` — short alphanumeric identifier (no spaces)
3. `Branch` — current git branch at session end
4. `Input` — input token count (integer)
5. `Output` — output token count (integer)
6. `Cache Read` — cache-read token count (integer)
7. `Cost USD` — total session cost in USD (decimal)

---

## `progress.md`

Prepend new sessions at the **top** of the file (newest-first). The parser looks for
`## Session N — YYYY-MM-DD` headings and extracts up to the first 3 bullets under
`### What Was Done` for the 5 most recent sessions.

```markdown
## Session 2 — 2026-03-18
### What Was Done
- Implemented the feature
- Fixed the bug
- Updated tests

---

## Session 1 — 2026-03-17
### What Was Done
- Initial scaffold
```

---

## `docs/ID_REGISTRY.md`

Not parsed by the generator, but **required for agents** to avoid ID collisions. Maintain this
manually — update it immediately whenever a new artefact is created.

```markdown
# ID Registry

| Sequence | Next Available ID | Last Assigned |
|----------|-------------------|---------------|
| EPIC     | EPIC-0002         | EPIC-0001     |
| US       | US-0002           | US-0001       |
| TASK     | TASK-0002         | TASK-0001     |
| AC       | AC-0002           | AC-0001       |
| TC       | TC-0002           | TC-0001       |
| BUG      | BUG-0001          | —             |
```

IDs are permanent. Retired or deleted artefacts keep their ID marked `Status: Retired` — never
reuse or renumber.

---

## Configuration

Override default file paths in `plan-visualizer.config.json` at the project root:

```json
{
  "project": { "name": "My Project", "tagline": "A short description.", "githubUrl": "" },
  "docs": {
    "releasePlan": "docs/RELEASE_PLAN.md",
    "testCases":   "docs/TEST_CASES.md",
    "bugs":        "docs/BUGS.md",
    "costLog":     "docs/AI_COST_LOG.md",
    "lessons":     "docs/LESSONS.md",
    "outputDir":   "docs"
  },
  "coverage": { "summaryPath": "docs/coverage/coverage-summary.json" },
  "progress": { "path": "progress.md" },
  "costs": { "hourlyRate": 100, "tshirtHours": { "S": 4, "M": 8, "L": 16, "XL": 32 } }
}
```

> **Case sensitivity:** Paths are case-sensitive on Linux (including GitHub Actions CI).
> `docs/BUGS.md` and `docs/bugs.md` are different files. Mismatches that work on macOS will
> fail in CI.
