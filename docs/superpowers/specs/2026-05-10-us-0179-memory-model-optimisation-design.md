# US-0179 — Memory Model Optimisation Design Spec

**Date:** 2026-05-10
**Status:** Planned
**Story:** US-0179 (EPIC-0026)
**Scope:** New `tools/memory.js suggest-model` subcommand + complexity hint parsing in topic files + complexity badges in compact MEMORY.md
**Depends on:** US-0178 (merged) — for the CLAUDE.md insertion point

---

## Overview

`tools/memory.js suggest-model --task "<description>"` recommends a Claude model (`haiku` or `sonnet`) for a given task by matching the task description against topic files in `docs/memory/` and aggregating complexity hints from the matched topics.

Topic files declare their own complexity via a `<!-- complexity: low|medium|high -->` comment near the top of the file. Aggregation rule: any non-low → `sonnet`, all-low → `haiku`. Opus is never auto-recommended (conservative two-tier mapping per EPIC-0026 design).

The compact MEMORY.md gains symbolic complexity badges (○ low, ◐ medium, ● high) so authors can scan complexity at a glance without running the CLI.

---

## CLI Surface

```bash
node tools/memory.js suggest-model --task "<brief description>" [--json]
```

| Flag              | Effect                                                                                                    |
| ----------------- | --------------------------------------------------------------------------------------------------------- |
| `--task "<text>"` | Required. Free-form description of the work being dispatched. Empty string or missing flag → usage error. |
| `--json`          | Emit machine-readable JSON instead of human-readable text.                                                |

npm script: `memory:suggest-model` → `node tools/memory.js suggest-model`

Invoked via: `npm run memory:suggest-model -- --task "fix bug in render-tabs.js"` (the `--` separator passes args through to the script). Missing `--task` prints a usage message that **explicitly shows the `--` separator** since this is a common npm footgun.

### Default output (human-readable)

Task tokens after filtering: `[update, release, plan, run, coverage, checks]`.

```
$ npm run memory:suggest-model -- --task "update the release plan and run coverage checks"
Recommended: sonnet
Matched 2 topics (score ≥ 2):
  - Release Plan Format Rules (high, explicit) — score 4 (title hits: release, plan)
  - Coverage Thresholds (low, explicit) — score 2 (title hit: coverage)
Reason: Found high-complexity topic 'Release Plan Format Rules' → sonnet
```

### JSON output (with `--json`)

```json
{
  "model": "sonnet",
  "matched": [
    {
      "title": "Release Plan Format Rules",
      "file": "docs/memory/topics/release-plan-format-rules.md",
      "complexity": "high",
      "complexitySource": "explicit",
      "score": 4,
      "matchedTokens": ["release", "plan"]
    },
    {
      "title": "Coverage Thresholds",
      "file": "docs/memory/topics/coverage-thresholds.md",
      "complexity": "low",
      "complexitySource": "explicit",
      "score": 2,
      "matchedTokens": ["coverage"]
    }
  ],
  "reason": "Found high-complexity topic 'Release Plan Format Rules' → sonnet"
}
```

---

## Library Structure

```
tools/lib/memory-model-suggester.js   ← NEW. Pure: (entries, task) → { model, matched, reason }
tools/lib/memory-index.js (modify)    ← readEntries returns extended shape with complexity + headBody
tools/lib/memory-validator.js (modify) ← warn on topic files missing complexity hints (non-fatal)
tools/memory.js (modify)              ← parseArgs adds --task + --json; dispatch adds suggest-model branch
```

`memory-classifier.js` and `memory-archiver.js` are unchanged.

### `readEntries` extended return shape

```ts
{
  category: 'topics' | 'sessions' | 'snapshots',
  title: string,           // existing
  file: string,            // existing
  date: string | null,     // existing
  complexity: 'low' | 'medium' | 'high' | null,   // NEW
  headBody: string         // NEW — first 5 content lines after the H1 (see definition below)
}
```

- `complexity` is parsed from the file body using the regex `/<!--\s*complexity:\s*(low|medium|high)\s*-->/i`. Case-insensitive on the value. Whitespace-tolerant. Returns `null` when no hint is present.
- `headBody` is the first 5 **content lines** after the H1 title, joined by `\n`. A "content line" is any line that contains at least one non-whitespace character AND is not entirely an HTML comment (e.g., the `<!-- complexity: ... -->` hint line is skipped). Used by the suggester for scoring. Other callers ignore it.
- Existing callers (`renderIndex`, `validateMemory`) continue to work — the new fields are additive.

---

## Matching & Aggregation Algorithm

Implemented in `memory-model-suggester.js`. Pure function `suggestModel(entries, task) → { model, matched, reason }`.

### Tokenisation (on `--task` text)

1. Lowercase.
2. Split on whitespace + punctuation regex `/[\s,./!?;:()\[\]"'`-]+/`.
3. Drop tokens shorter than 3 characters.
4. Drop stopwords: `a, an, and, are, as, at, be, by, for, from, has, he, in, is, it, its, of, on, that, the, to, was, were, will, with`.

Example: `"fix the bug in render-tabs.js"` → `['fix', 'bug', 'render', 'tabs']`.

**Edge case:** If tokenisation produces zero tokens (e.g. `--task "the"`), error: `task description too short after filtering stopwords`. Exit 1.

### Per-topic scoring

For each entry in `entries` (lowercased title and headBody):

For each token, use **word-boundary regex matching** (not substring):

- Pattern: `new RegExp('\\b' + escapeRegex(token), 'i')`.
- Hit in title → score `+2`.
- Hit in headBody → score `+1`.

`escapeRegex` is a one-liner the implementer adds at the top of `memory-model-suggester.js`:

```js
const escapeRegex = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
```

This prevents tokens containing regex special chars (e.g., `c++`, `node.js`) from crashing the matcher.

A topic is "matched" only if its total score `>= 2`. This filters out drive-by single-body matches that pull in unrelated topics.

### Aggregation

For each matched topic, take its complexity. If `null`, treat as `medium` (safe default) and record `complexitySource: 'default'` for reporting.

Rule (two-tier, no opus):

- If any matched complexity (explicit or default) is `medium` or `high` → recommend `sonnet`.
- If all matched complexities are `low` (and at least one match exists) → recommend `haiku`.

### Fallback (zero topics matched)

Recommend `sonnet`. Reason: `"No topics matched task description → sonnet (safe default)"`.

This is the same conservative path as if every topic defaulted to medium — i.e., no information means we err toward sonnet.

### Reason string (always present in output)

One sentence summarising the decision. Examples:

- `"All 3 matched topics low-complexity → haiku"`
- `"Found high-complexity topic 'Parser Contracts' → sonnet"`
- `"Found medium-complexity topic 'Cost Attribution' → sonnet"`
- `"2 matched topics have no explicit complexity hints → sonnet (safe default for unknown)"`
- `"No topics matched task description → sonnet (safe default)"`

---

## MEMORY.md Compact Index — Complexity Badges

`renderIndex` (in `memory-index.js`) is extended to emit complexity badges before each entry's title.

**Badge legend** (one-line, added below the existing introductory paragraph):

```
**Complexity badges:** ○ low → haiku · ◐ medium → sonnet · ● high → sonnet · (no badge) unknown
```

**Per-entry rendering:**

| Category    | Complexity source | Badge        |
| ----------- | ----------------- | ------------ |
| `topics`    | explicit `low`    | `○`          |
| `topics`    | explicit `medium` | `◐`          |
| `topics`    | explicit `high`   | `●`          |
| `topics`    | no hint (null)    | _(no badge)_ |
| `sessions`  | _(always)_        | `◐`          |
| `snapshots` | _(always)_        | `◐`          |

Sessions and snapshots never have explicit complexity hints — they always default to `medium` per the category rule, and the badge reflects that consistently.

**Updated entry format** (badge prefix, then existing format unchanged):

```markdown
- ○ [Project Identity](docs/memory/topics/project-identity.md)
- ◐ [Plugin Install Integration (Session 42)](docs/memory/sessions/2026-05-10-...) · 2026-05-10
```

When a topic has no badge (unknown complexity), the existing format renders without the badge prefix:

```markdown
- [Some New Topic](docs/memory/topics/some-new-topic.md)
```

---

## Topic File Seeding — Heuristic

US-0179 implementation adds `<!-- complexity: ... -->` hints to all existing topic files at implementation time (not just today's 12). The seeding step iterates all files under `docs/memory/topics/` and applies the heuristic below to suggest a hint; the implementation plan codifies a small helper or table for the initial seed.

### Heuristic

| Content type                                                                                                                        | Complexity |
| ----------------------------------------------------------------------------------------------------------------------------------- | ---------- |
| Static lookups, constants, file path lists, version tables, pointers to other docs                                                  | `low`      |
| Workflow rules, branching strategy, non-trivial logic, threshold definitions, attribution formulas                                  | `medium`   |
| Critical format invariants, parser contracts, schema definitions where getting it wrong silently breaks dashboards or other tooling | `high`     |

### Applied to today's topic files (initial seed)

| Topic                                 | Hint     |
| ------------------------------------- | -------- |
| `project-identity.md`                 | `low`    |
| `technology.md`                       | `low`    |
| `agents-md.md`                        | `low`    |
| `active-dependencies.md`              | `low`    |
| `coverage-thresholds.md`              | `low`    |
| `key-file-paths.md`                   | `low`    |
| `retry-transient-error-parameters.md` | `low`    |
| `at-risk-signals.md`                  | `medium` |
| `cost-attribution.md`                 | `medium` |
| `git-branching-strategy.md`           | `medium` |
| `parser-contracts.md`                 | `high`   |
| `release-plan-format-rules.md`        | `high`   |

Hint placement: second line of the file, immediately after the H1, with a blank line before the body content:

```markdown
# Project Identity

<!-- complexity: low -->

- **Name:** PlanVisualizer
  ...
```

If new topic files exist at implementation time, the implementer applies the heuristic to each. The list above is the source of truth for the 12 existing files only.

---

## `validate` Warning for Missing Hints (non-fatal)

`tools/memory.js validate` is extended to emit a non-fatal warning when topic files lack complexity hints:

```
$ node tools/memory.js validate
[memory] OK — MEMORY.md is in sync with docs/memory/.
[memory] Warning: 2 topic files missing complexity hints:
  - docs/memory/topics/new-topic.md
  - docs/memory/topics/another-new.md
  Add `<!-- complexity: low|medium|high -->` on the line after the H1 title. See docs/superpowers/specs/2026-05-10-us-0179-memory-model-optimisation-design.md for the heuristic.
```

The warning is informational only — exit code stays 0 (otherwise CI would fail every time a new topic is added before the author annotates it).

**`validateMemory` return shape extension:**

```ts
// Before (US-0175):
{ ok: boolean, diff: string }

// After (US-0179):
{ ok: boolean, diff: string, warnings: string[] }
```

`warnings` is always present; empty array when no warnings. The CLI iterates `result.warnings` and prints each on its own line with `[memory] Warning:` prefix. Existing callers that destructure only `{ ok, diff }` continue to work; consumers wanting warnings opt in by reading the new field.

---

## CLAUDE.md Update

Depends on US-0178 having landed (which adds the "Memory files live in docs/memory/..." item to "Mandatory Session Startup" as item 3 and renumbers subsequent items).

US-0179 inserts a new item 4 (or after the US-0178 item, wherever it landed):

```
4. Before dispatching complex work to a sub-agent, run `npm run memory:suggest-model -- --task "<brief description>"` to get a model recommendation based on topic complexity in `docs/memory/`. The recommendation is `haiku` for low-complexity work or `sonnet` for medium/high; opus is never auto-recommended.
```

Renumber subsequent items by `+1` (same renumbering pattern as the US-0178 patcher).

**Implementation note:** the implementer extends `memory-claude-md-patcher.js` from US-0178 with a second patch function (`patchSuggestModelItem`) that follows the same idempotency + heading-walk pattern. The patcher remains a single shared module.

---

## Testing

```
tests/unit/memory-model-suggester.test.js   ← NEW, ~15 tests
  - tokenisation (stopwords removed, length-3 filter, punctuation split)
  - tokenisation edge case: --task "" → throws
  - tokenisation edge case: --task "the of and" → throws (all stopwords)
  - word-boundary matching: "render" matches "render-tabs" AND "renderer" (left-boundary prefix-match), but NOT "surrender" (no leading word boundary inside the word)
  - score threshold: single body hit (score=1) → not matched
  - score threshold: title hit (score=2) → matched
  - score threshold: 2 body hits (score=2) → matched
  - aggregation: all-low → haiku
  - aggregation: any-medium → sonnet
  - aggregation: any-high → sonnet
  - aggregation: explicit null treated as medium → sonnet
  - aggregation: complexitySource correctly labelled (explicit vs default)
  - fallback: zero matches → sonnet with reason
  - hint parsing: case-insensitive (`Low`, `LOW`, `low`)
  - hint parsing: whitespace-tolerant (`<!--complexity:low-->`)

tests/unit/memory-index.test.js (extend)    ← +5 tests
  - readEntries surfaces complexity from hint comment
  - readEntries returns complexity:null when no hint
  - readEntries returns headBody (first 5 content lines after H1, skipping the complexity hint comment line)
  - renderIndex includes legend line
  - renderIndex renders correct badge per category/complexity combination

tests/unit/memory-validator.test.js (extend) ← +2 tests
  - validate emits warning for topic files missing complexity hints
  - validate exit code stays 0 even with missing hints (non-fatal)

tests/unit/memory-cli.test.js (extend)      ← +5 tests
  - parseArgs --task captures next argument
  - parseArgs --json sets json:true
  - dispatch suggest-model with missing --task errors with usage message including `--` separator
  - dispatch suggest-model with --task "" errors same as missing
  - dispatch suggest-model --json outputs valid JSON

tests/unit/memory-claude-md-patcher.test.js (extend) ← +3 tests
  - patchSuggestModelItem inserts after US-0178 memory item
  - patchSuggestModelItem renumbers subsequent items
  - patchSuggestModelItem is idempotent
```

Coverage target: ≥85% on `memory-model-suggester.js`. Full suite stays ≥80%.

---

## Error Handling

| Failure                                                                           | Behaviour                                                                 |
| --------------------------------------------------------------------------------- | ------------------------------------------------------------------------- |
| Missing `--task`                                                                  | Print usage with `--` separator highlighted; exit 1                       |
| `--task ""`                                                                       | Same as missing; exit 1                                                   |
| `--task` produces zero tokens after filtering                                     | Error: `"task description too short after filtering stopwords"`; exit 1   |
| `docs/memory/` missing entirely                                                   | Error: `"no topic files found — run migration first"`; exit 1             |
| Topic file has malformed complexity comment (e.g. `<!-- complexity: unknown -->`) | Treated as `null` (no hint); no error                                     |
| `--json` with valid `--task` but zero matches                                     | Valid JSON with `model: "sonnet"`, `matched: []`, `reason: "..."`; exit 0 |
| `validate` warns on missing hints                                                 | Print warning, exit 0 (non-fatal)                                         |

---

## Out of Scope

- Configurable stopword lists (English-only; can be added later if needed)
- Configurable score thresholds (the `>= 2` threshold is hardcoded)
- Configurable mapping (always `low → haiku`, `medium/high → sonnet`, no opus)
- Per-task model override (no `--force-model sonnet` flag — users wanting to force a model just dispatch it manually)
- Caching of suggestions (each invocation re-reads topic files; performance is fine for ~50 files)
- Semantic similarity / embeddings (deterministic keyword matching only)

---

## Dependencies

- **US-0178 must be merged before US-0179 starts implementation.** The `memory-claude-md-patcher.js` module created in US-0178 is extended (not replaced) by US-0179. The CLAUDE.md insertion point also assumes US-0178's "Memory files live in..." item is present.

---

## Future Work

- A `--explain` mode showing the full tokenisation, scoring, and aggregation steps in human-readable form for debugging
- Caching the suggestion result keyed by `--task` hash so repeated calls within a session are free
- Auto-annotation: a `node tools/memory.js suggest-complexity <file>` subcommand that reads a topic file and proposes a complexity based on content heuristics, for use during topic-file authoring
- Embedding-based semantic matching as an opt-in `--semantic` mode
