# ENHANCEMENTS.md — Future Enhancement Roadmap

Append-only roadmap for ideas and improvements not yet scoped into a story or epic. Each entry captures an opportunity, its origin, the impact of acting (or not acting), and the recommended path to convert into work when prioritized. Promote an entry to a story by creating a US-XXXX in `docs/RELEASE_PLAN.md` and referencing the ENH-ID in the story's `Related Enhancement:` field.

---

## ENH-0001 — Agentic pipeline test-scope-decision gap

**Surface:** Agentic orchestration engine (EPIC-0028)
**Status:** Backlog
**Origin:** Session 53 brainstorming (Phase C.5 spec discussion, 2026-05-20)

**Opportunity:**
The BLAST Test phase has two executors — Sentinel (functional) and Circuit (automation) — but no agent owns:

1. **Test-case authorship.** TCs land in `docs/TEST_CASES.md` ad-hoc, often retroactively via "TC audit" stories (e.g. US-0152). No formal step translates ACs into TCs with category, type, and priority.
2. **Test-type decisions.** Only functional + automated unit/component testing is covered. No agent owns performance, security, accessibility, smoke, or end-to-end testing categories.

**Impact if unaddressed:**

- For target projects with broader requirements (multi-tenant SaaS, healthcare, regulated industries) the pipeline can't produce a complete test plan. Performance regressions, security gaps, and accessibility violations slip past the Test phase because no agent is looking for them.
- Even within PlanVisualizer, TC coverage drifts as new ACs land — the gap surfaces as ad-hoc "TC audit" stories rather than continuous coverage.
- The `DM_AGENT.md` spec says "DM will provide specific coverage targets" but does not specify how those targets are derived — no source feeds DM the per-AC test plan.

**Proposed path (when prioritized):**

- Add a **Drafter** agent (or extend `PO_AGENT.md`) with the duty: "For each new AC in RELEASE_PLAN.md, generate corresponding TC entries with `Type: [manual|automated|perf|security|a11y]` and `Category:` fields."
- Extend `docs/TEST_CASES.md` schema with `Type:` and `Category:` fields. Update the regex parser accordingly.
- Add routing logic so Sentinel/Circuit filter TCs by type. Introduce specialist Test-phase agents for the missing categories — e.g. **Anvil** (performance), **Vault** (security), **Beacon** (accessibility), **Scout** (end-to-end).
- Update `DM_AGENT.md` to audit TC coverage before spawning the Test phase, escalating if ACs lack matching TCs of the required types.

**Pre-work:**

- Audit current `TEST_CASES.md` to see whether the existing schema can absorb the new fields without a full parser rewrite (the parser is regex-based per `docs/architecture/ARCHITECTURE.md` §"Regex, not a markdown parser").
- Survey existing AGENT specs to identify any test categories the pipeline already covers implicitly that should be promoted to first-class.
- Decide whether the new specialist agents are part of the default BLAST phase or opt-in via project configuration.

**Reference:** Session 53 conversation log (2026-05-20).

---

## ENH-0002 — Surface ENHANCEMENTS on the status dashboard

**Surface:** Static dashboard (`plan-status.html`)
**Status:** Backlog
**Origin:** Session 53 brainstorming (companion to ENH-0001)

**Opportunity:**
This file (`docs/ENHANCEMENTS.md`) joins BUGS, LESSONS, TEST_CASES, and RELEASE_PLAN as a managed planning artefact, but is not currently parsed or rendered anywhere. The dashboard lacks a view to surface what's queued for future work distinct from bugs (defects) and stories (committed scope).

**Impact if unaddressed:**

- `ENHANCEMENTS.md` becomes "write-only" — entries are added but never reviewed during planning sessions because they don't appear on the dashboard. Backlog drift is invisible.
- Stakeholders can't see proposed-but-not-committed work at a glance, weakening the prioritization conversation.
- The promotion path ENH-XXXX → US-XXXX has no UI affordance, making the bridge between roadmap and committed scope friction-heavy.

**Proposed path (when prioritized):**

- Add `tools/lib/parse-enhancements.js` mirroring `tools/lib/parse-lessons.js` / `tools/lib/parse-bugs.js`. Returns `{id, title, surface, status, origin, opportunity, impact, proposedPath, reference}` per entry.
- Wire the parser into `tools/generate-plan.js`; pass results into `renderHtml(...)`.
- Add an Enhancements section to the dashboard. Placement TBD — natural candidates are (a) a new tab alongside Bugs/Lessons, (b) a card on the Status tab grouped with backlog metrics, or (c) the Settings/About modal.
- Optionally surface a "Promote to story" action that scaffolds a US-XXXX with `Related Enhancement: ENH-XXXX` pre-filled.
- Add an `ENH` row to the SQLite indexer (`enhancements-indexer.js`) for the Phase B+ repository pipeline. Decide at that point whether enhancements are first-class entities in the index (Phase E+ writers) or read-only.

**Pre-work:**

- Decide enhancement-to-story promotion semantics: does promotion archive the ENH entry, or keep it linked to the resulting story?
- Survey existing dashboard tabs to find the least-intrusive placement.

**Reference:** Session 53 conversation log (2026-05-20).

---

## ENH-0003 — Bugs/lessons table CHECK constraint divergence from documented status conventions

**Surface:** Repository schema (`tools/lib/repository/migrations/001_initial_schema.sql`) + `docs/BUGS.md` format convention
**Status:** Backlog
**Origin:** Session 53 Phase C.5 brainstorming audit (2026-05-21)

**Opportunity:**
The `bugs` table CHECK constraint allows `Open | In Progress | Fixed | Wontfix | Done`. The `BUGS.md` format-doc convention line lists `Open | In Progress | Fixed | Verified | Closed`. The schema and the convention disagree on two values (`Wontfix` and `Done` are in the schema but not the docs convention; `Verified` and `Closed` are in the docs convention but not the schema). Future-written bugs using the convention values would be silently dropped by `INSERT OR IGNORE` in `bugs-indexer.js` — the same class of bug as L-0076 in the epics+stories table.

**Impact if unaddressed:**

- No current data loss — the only actual bug status in `docs/BUGS.md` today is `Status: Fixed` (which IS allowed by the CHECK).
- However, the divergence is a latent bug: any contributor who writes `Status: Verified` or `Status: Closed` following the documented convention will have their entry silently dropped from SQLite. The dashboard will be missing that bug from any repo-driven views.
- The convention vs schema mismatch is also confusing for maintainers — which is canonical?

**Proposed path (when prioritized):**

- Decide on a canonical set of bug statuses (probably the union: `Open | In Progress | Fixed | Wontfix | Verified | Closed | Done`, or a curated subset).
- Migration 004 widens the `bugs.status` CHECK to the canonical set.
- Update the `BUGS.md` format-doc line to match.
- Apply the same `try/catch` → `WarningsChannel` pattern (introduced for `release-plan-indexer` in Phase C.5) to `bugs-indexer.js` so future drift is visible at `plan:lint` time.
- Audit `lessons-indexer.js`, `test-cases-indexer.js`, and other indexers for the same class of CHECK-vs-doc drift; widen scope if found.

**Pre-work:**

- Audit other indexers' CHECK constraints vs their source documents.
- Decide whether the same `WarningsChannel` rollout should sweep all indexers in one PR or stay incremental.

**Reference:** Phase C.5 design spec, `docs/superpowers/specs/2026-05-21-phase-c5-indexer-hardening-design.md` §7.

**Resolved (2026-05-21, Session 55):** Migration 004 widened `bugs.status` CHECK to `Open | In Progress | Fixed | Verified | WontFix | Closed`. All 6 indexers (release-plan + bugs + lessons + test-cases + id-registry + sdlc-status) wrap INSERTs via the shared `createTryInsert` helper at `tools/lib/repository/insert-helper.js`. CHECK violations surface as `check-rejected` warnings; duplicate IDs surface as `duplicate-id` errors. `plan:lint` returns `0/0/0` post-cleanup.

---

## ENH-0004 — Clean up duplicate AC declarations in docs/RELEASE_PLAN.md

**Surface:** Repository data (`docs/RELEASE_PLAN.md`)
**Status:** Backlog
**Origin:** Session 54 Phase C.5 (2026-05-21)

**Opportunity:**
Production `docs/RELEASE_PLAN.md` declares AC-0150..AC-0153 and AC-0334..AC-0343 twice — 14 duplicates total. The Phase C.5 indexer rewrite surfaced them as `duplicate-ac` warnings via `plan:lint`. Previously they were silently swallowed by `INSERT OR IGNORE` (L-0076 class).

**Impact if unaddressed:**

- `plan:lint` shows 14 warnings on every run, eroding signal-to-noise.
- The second declaration of each AC is silently ignored by the indexer (only the first hits SQLite). Editors who update the second occurrence see no effect.
- Future dedup logic in entity repos has to keep accounting for these.

**Proposed path (when prioritized):**

- For each duplicate AC ID, diff the two declarations. Decide which is canonical (probably the first, which is the one indexed today).
- Delete the duplicate text. Verify the surrounding story still parses cleanly.
- Confirm `plan:lint` returns `errors: 0, warnings: 0, reports: 0`.

**Pre-work:**

- Audit the duplicates to understand WHY they exist (copy-paste mistake during a story migration? Two stories pointing to the same AC?). The pattern of consecutive IDs (0150-0153, 0334-0343) suggests bulk copy-paste rather than gradual drift.

**Reference:** Session 54 conversation log (2026-05-21). plan:lint output at commit `dd9de5b`.

**Resolved (2026-05-21, Session 55):** 14 AC ID collisions (cluster AC-0150..0153 + cluster AC-0334..0343) resolved by renumbering the second occurrence in each pair to AC-0996..AC-1009 (16 TC cross-references in TEST_CASES.md updated). 3 BUG ID collisions resolved similarly: BUG-0098/0099/0100 second occurrences renumbered to BUG-0262/0263/0261. The "duplicates" turned out to be distinct entities sharing IDs, not redundant data — renumbering preserved all content.

---

## ENH-0005 — Cache-hit ratio metric + optimization surface

**Surface:** AI cost telemetry (`tools/lib/compute-costs.js`, dashboard cost tab)
**Status:** Backlog
**Origin:** Session telemetry review (2026-06-05)

**Opportunity:**
`docs/AI_COST_LOG.md` already captures `Cache Read Tokens` per session, but the dashboard never surfaces the cache-hit ratio (`cacheRead / (input + cacheRead)`). This is the single biggest lever for cost reduction on long sessions — cache reads cost $0.30/MTok vs $3/MTok for direct input (10× cheaper).

**Impact if unaddressed:**

- We cannot tell whether a session was expensive because of work volume or because of poor cache utilization (e.g. context resets, frequent tool-output churn that invalidates the prefix).
- No feedback loop to drive prompt-stability discipline (reading files in stable order, batching edits, etc.).
- Cost regressions caused by hook or prompt changes are invisible until the monthly total ticks up.

**Proposed path (when prioritized):**

- Extend `compute-costs.js` to derive `cacheHitRatio` per row, per story, per epic, and a rolling 7-day average.
- Add a Cache Hit % tile to the cost tab next to existing Total / Spent / Remaining cards.
- Add a sparkline of cache-hit % over the last N sessions to spot regressions.
- Define a target threshold (e.g. ≥70%) and badge sessions below it for review.

**Pre-work:**

- Decide whether `cache-write` tokens count toward "miss" or are reported separately (they cost $3.75/MTok and represent first-time cache priming — useful but expensive).
- Confirm the existing parser keeps the cache-read column on `[est]` rows (older estimates may not have realistic values).

**Reference:** Session telemetry conversation (2026-06-05).

---

## ENH-0006 — Per-turn / per-tool token attribution

**Surface:** AI cost capture (`tools/capture-cost.js`, `docs/AI_COST_LOG.md` schema)
**Status:** Backlog
**Origin:** Session telemetry review (2026-06-05)

**Opportunity:**
The Stop hook writes one row per session — a single bag of tokens with no breakdown by turn, tool, or activity (Bash vs Read vs Agent fan-out). Without that granularity, we can't answer "what is expensive?" — only "was this session expensive?".

**Impact if unaddressed:**

- Optimization is guesswork. We cannot prove that switching from N Read calls to one batched Read saved tokens, or that a Workflow fan-out is paying for itself.
- Pathological loops (a tool returning huge output on every turn) cannot be detected from the ledger.
- Agent/subagent attribution (ENH-0010) is impossible without per-turn data as a foundation.

**Proposed path (when prioritized):**

- Add a sibling artefact `docs/AI_COST_TURNS.jsonl` (append-only JSONL, one row per turn): `{sessionId, turnIndex, inputTokens, outputTokens, cacheReadTokens, toolCalls: [{name, count}]}`. JSONL keeps the monthly markdown ledger small while enabling drill-down.
- Update `capture-cost.js` to walk the transcript turn-by-turn rather than collapsing the whole session.
- Add a per-tool roll-up view on the dashboard (table of tool name × total tokens × % of session cost).
- Decide retention policy (full history vs rolling 90 days) — JSONL grows fast.

**Pre-work:**

- Sample a few transcripts to confirm the JSONL schema can be derived from existing fields (`message.usage`, `tool_use` blocks).
- Decide whether per-turn rows are committed to the repo (privacy / repo bloat) or kept local-only with the markdown ledger as the committed summary.

**Reference:** Session telemetry conversation (2026-06-05).

---

## ENH-0007 — Multi-model pricing + Model dimension in cost log

**Surface:** AI cost pipeline (`tools/capture-cost.js`, `tools/lib/compute-costs.js`, `plan-visualizer.config.json`)
**Status:** Backlog
**Origin:** Session telemetry review (2026-06-05)

**Opportunity:**
Rates are hardcoded to Claude Sonnet 4.6 across both the hook (header comment + `RATES` const in `capture-cost.js`) and `compute-costs.js`. Sessions run on Opus 4.7, Haiku 4.5, or mixed-model agent fan-outs are mispriced. Opus output is ~5× Sonnet; Haiku is ~⅓. The mispricing compounds as model mix shifts.

**Impact if unaddressed:**

- Recorded `Cost USD` diverges from actual Anthropic billing — undermines budget tile and per-story cost columns.
- Decisions like "should we move this workflow to Haiku?" cannot be A/B'd from the ledger.
- Adding new model tiers (Opus 4.8, future Haiku rev) requires editing code in two places, easy to drift.

**Proposed path (when prioritized):**

- Add a `Model` column to `docs/AI_COST_LOG.md` (default `sonnet-4.6` for backfill).
- Move pricing out of `capture-cost.js` and `compute-costs.js` into `plan-visualizer.config.json` under `costs.modelRates`: a map of `{modelId: {input, cacheWrite, output, cacheRead}}`. Both modules read from config.
- For mixed-model sessions (subagents on a different model), record the **primary** model in the column and capture the per-model breakdown in the per-turn JSONL from ENH-0006.
- Add a per-model rollup on the dashboard.

**Pre-work:**

- Audit the Stop hook payload to confirm the active model ID is reachable (it is — `message.model` in the transcript).
- Decide migration: re-cost historical rows at their actual model (risky — we don't know what they ran on) vs leave them stamped as `sonnet-4.6` and start clean.

**Reference:** Session telemetry conversation (2026-06-05).

---

## ENH-0008 — Cost trend chart + cost-per-unit-of-work metric

**Surface:** Dashboard (Costs tab) + `tools/lib/compute-costs.js`
**Status:** Backlog
**Origin:** Session telemetry review (2026-06-05)

**Opportunity:**
Risk has a trend chart (EPIC-0010); cost does not. There is no way to eyeball "are sessions getting more expensive per story-point?" — the core question for cost optimization. We have the inputs (per-story cost via branch join, per-story t-shirt size) but no derived `$ / story-point` or `$ / AC` metric and no chart.

**Impact if unaddressed:**

- Cost regressions from prompt/hook/model changes blend into noise. We notice only when monthly totals jump.
- No quantitative basis to defend optimization work — "did caching the agent prompt actually help?" remains anecdotal.
- Velocity vs cost cannot be reasoned about together.

**Proposed path (when prioritized):**

- In `compute-costs.js`, derive per-story `costPerPoint = totalCost / tShirtPoints` (using existing t-shirt → point mapping in `plan-visualizer.config.json`).
- Add a rolling chart on the Costs tab: per-week median `$/point` with min/max band.
- Add a per-epic table column: `Avg $/point` and `Trend` arrow vs prior epic.
- Optional: split AI cost vs human cost on the same chart to show the AI/human cost ratio.

**Pre-work:**

- Decide handling for stories with no cost rows (skip vs flag).
- Decide week boundary (ISO week vs sprint cadence — if sprints exist in config).
- Validate the t-shirt → point mapping is centralised and not duplicated across modules.

**Reference:** Session telemetry conversation (2026-06-05).

---

## ENH-0009 — Token/cost budget alert thresholds

**Surface:** Budget tile (`tools/lib/budget.js`, `tools/lib/render-tabs.js`) + optional Stop-hook warning
**Status:** Backlog
**Origin:** Session telemetry review (2026-06-05)

**Opportunity:**
The budget tile shows Total / Spent / Remaining but only post-hoc. There is no alerting threshold (e.g. ≥80% spent, ≥95% spent), no projection (`at current burn rate, budget exhausted in N days`), and no per-session warning when a single session crosses a configured cost ceiling.

**Impact if unaddressed:**

- Budget overruns are discovered after the fact — no warning while there is still room to course-correct.
- Outlier sessions (e.g. a runaway agent loop that burns $10 in one turn) are not flagged.
- Stakeholders cannot set "soft caps" that nudge behaviour without hard-stopping work.

**Proposed path (when prioritized):**

- Extend `plan-visualizer.config.json → costs` with `thresholds: {warn: 0.8, critical: 0.95}` and `perSessionWarnUSD: 5.0`.
- `budget.js` returns `{spent, remaining, percentUsed, level: 'ok'|'warn'|'critical', projectedExhaustionDate}` using a 7-day burn-rate average.
- Render-tabs colours the tile and adds a one-line callout when `level !== 'ok'`.
- `capture-cost.js` writes a one-line stderr warning when a session row crosses `perSessionWarnUSD`. Optional: append a `⚠` marker to the row.
- Optional escalation hook: when `level === 'critical'`, surface on every tab header, not just Costs.

**Pre-work:**

- Decide burn-rate window (7d default vs configurable).
- Decide whether alerts also fire in CI (PR comment when the branch's cumulative cost crosses a per-story threshold).

**Reference:** Session telemetry conversation (2026-06-05).

---

## ENH-0010 — Subagent / workflow cost attribution

**Surface:** AI cost capture (`tools/capture-cost.js`) + per-turn ledger (depends on ENH-0006)
**Status:** Backlog
**Origin:** Session telemetry review (2026-06-05)

**Opportunity:**
Agent-tool calls and `Workflow` fan-outs run subagents whose token usage is billed to the parent session row with no breakdown. A 10-agent workflow shows as one row of "expensive session" — we cannot see which subagent burned the budget or whether parallelism is paying off.

**Impact if unaddressed:**

- Cannot quantify ROI of multi-agent orchestration. "Was that workflow worth it?" stays unanswerable.
- Pathological subagents (one finder out of N that loops) hide inside the aggregate.
- Decisions like "swap this subagent to Haiku" lack data.

**Proposed path (when prioritized):**

- **Depends on ENH-0006** (per-turn JSONL) and **ENH-0007** (model dimension) — both are prerequisites.
- In the per-turn schema, add `parentTurnIndex` and `agentLabel` so subagent turns can be rolled up under the parent.
- In `capture-cost.js`, detect subagent invocations via `Agent` / `Workflow` tool-use blocks in the transcript and tag the produced turns with the agent label + model.
- Dashboard view: collapse-by-default tree where a parent session expands into its subagent contributions (label · model · tokens · cost · wall-clock).
- Add a "workflow efficiency" metric: `parallelWallClock / serialWallClock` to show fan-out savings.

**Pre-work:**

- Sample transcripts of a real `Workflow` run to confirm subagent turns are distinguishable in the JSONL (they are — subagent SDK turns carry their own session IDs).
- Decide whether subagent rows appear in the markdown ledger (probably not — too noisy; keep them in JSONL only).
- Coordinate with ENH-0006 schema design to avoid two passes at the per-turn format.

**Reference:** Session telemetry conversation (2026-06-05).

---

## ENH-0011 — Richer BUG schema (root cause, fix, verification, detection)

**Surface:** Bug schema in `AGENTS.md` §9 + parser `tools/lib/parse-bugs.js` + SQLite migration
**Status:** Backlog
**Origin:** Session telemetry / process review (2026-06-29)

**Opportunity:**
The current `BUG-XXXX` schema captures `Severity`, `Steps to Reproduce`, `Expected`, `Actual`, `Status`, `Fix Branch`, `Lesson Encoded`, `Related Story`, `Related Task` — but does not have structured fields for **Root Cause**, **Fix**, **Verification**, **Detected** (when/by-whom/how — user / CI / test / audit), or **Affected Version**. These details exist today only as prose inside bug entries, which means they are unsearchable, not indexed in SQLite, and not parseable for downstream views (audit reports, regression analysis, lesson generation).

**Impact if unaddressed:**

- "How was this bug detected?" cannot be answered across the corpus — we cannot tell whether CI catches most defects, whether users report most, or whether they slip in via audit. Tuning the test pipeline is guesswork.
- Root-cause clusters are invisible. We cannot answer "how many bugs were string-encoding issues?" without re-reading every entry.
- Fix descriptions and verification evidence are not tied to the bug record. Reviewers must hunt through PRs, commits, and progress.md to reconstruct what was actually done.
- The downstream `buildIssueBody` (see ENH-0012) cannot emit a complete defect record because the source schema is incomplete.
- LESSON generation today is manual (`Lesson Encoded: Yes` is a Boolean with a prose link). With structured root cause + fix fields, an agent could draft the LESSON automatically.

**Proposed path (when prioritized):**

- Extend the `BUG-XXXX` template in `AGENTS.md` §9 with:
  - `Detected: <date> by <source: user|CI|test|audit|review> (<context, e.g. PR #1142, TC-0541>)`
  - `Affected Version: <semver or commit SHA>`
  - `Root Cause:` (free prose, single field)
  - `Fix:` (free prose + commit/PR link)
  - `Verification:` (bulleted list — TCs run, CI status, manual steps)
  - Promote `Lesson Encoded` to reference `L-XXXX` directly when applicable (`Lesson Encoded: L-0091` instead of `Yes — see docs/LESSONS.md`).
- Update `tools/lib/parse-bugs.js` regex blocks to capture the new fields. Treat all new fields as optional during migration (only `Detected` and `Root Cause` become required for new bugs once the schema is rolled out).
- Add a SQLite migration (`005_bug_schema_v2.sql`) widening the `bugs` table with the new columns. Reuse the `createTryInsert` helper / `WarningsChannel` pattern (ENH-0003 precedent) so legacy bugs missing the fields surface as `warn` not `error`.
- Add a backfill script that walks `docs/BUGS.md`, infers `Root Cause` and `Fix` from existing prose where possible, flags the rest for manual fill.
- Add a `plan:lint` rule: warn if any new bug created post-migration is missing `Detected` / `Root Cause` / `Fix` / `Verification`.

**Pre-work:**

- Audit `docs/BUGS.md` to estimate how many of the existing ~260 bugs have inferrable root cause/fix in the prose (cheap LLM pass over a sample of 20).
- Decide whether `Detection Source` is a free string or a closed enum (closed enum gives better aggregation; free string is friendlier for edge cases).
- Confirm `WarningsChannel` rollout pattern works for missing-field warnings as well as CHECK violations.

**Dependencies:** None hard. ENH-0012 (richer GitHub issue body) consumes the new fields, so shipping ENH-0011 first unlocks it.

**Reference:** Session conversation 2026-06-29 (GitHub issue body comparison).

---

## ENH-0012 — Richer GitHub Issue bodies for bugs and stories

**Surface:** `tools/lib/github-client.js` (`buildIssueBody`), `tools/sync-github.js` (story-body inline at line ~170)
**Status:** Backlog
**Origin:** Session telemetry / process review (2026-06-29)

**Opportunity:**
The current GitHub issue body is thin:

- **Bug issues** emit only severity, status, Steps to Reproduce, Expected, Actual.
- **Story issues** emit only priority, status, description — the AC list, DOR, DOD, Estimate, Dependencies, Branch, Related Enhancement, and linked Test Cases are all dropped.

This makes GitHub Issues pointers back to the markdown source of truth rather than stand-alone records. Reviewers, stakeholders, and external contributors cannot understand a bug or story from the issue alone — they must clone the repo and read `docs/BUGS.md` or `docs/RELEASE_PLAN.md`.

**Impact if unaddressed:**

- External contributors (or stakeholders who don't read the repo) get an incomplete defect picture. Bug triage on GitHub is harder than it needs to be.
- Story ACs cannot be checked off in the GitHub UI because they don't exist on the issue. Reviewers track AC completion in markdown only.
- Lesson Encoded and Related Story (BUG → US back-link) never appear on the issue, so the "this bug came from US-0246" causal chain is invisible to GitHub watchers.
- Once ENH-0011 ships, the richer schema is wasted unless the issue body surfaces the new fields.

**Proposed path (when prioritized):**

- Split `buildIssueBody(entry)` in `tools/lib/github-client.js` into `buildBugBody(bug)` and `buildStoryBody(story)`. Move the story-body string in `tools/sync-github.js` line ~170 into `buildStoryBody`.
- **Bug body template** (depends on ENH-0011 fields):

  ```markdown
  **BUG-XXXX** — <severity> | <status>
  Detected: <date> by <source> (<context>)
  Affected: <version/commit>
  Related Story: US-XXXX · Related Task: TASK-XXXX

  ### Symptoms (Actual) / Expected / Steps to Reproduce

  ### Root Cause / Fix / Verification

  ### Lesson Encoded
  ```

- **Story body template** — render AC list as GitHub checkbox markdown so reviewers can tick boxes in the GitHub UI:

  ```markdown
  **US-XXXX** — <priority> | <status> · Epic: EPIC-XXXX · Estimate: <T-shirt>
  Branch: <feature/...> · Dependencies: <list> · Related Enhancement: ENH-XXXX

  ### Story / Acceptance Criteria (checkboxes) / Test Cases / DOD
  ```

- Decide round-trip semantics for AC checkboxes:
  - **One-way (markdown → GitHub)** — easy, ships immediately, GitHub ticks are cosmetic.
  - **Two-way (GitHub ticks → markdown)** — requires a webhook or poller; high value but a separate design problem. Defer to a follow-up story if not in scope.
- Update `tests/unit/github-client.test.js` (create if missing) with snapshot tests for both body templates.
- Add a CI check that re-renders all existing issue bodies in dry-run mode and reports diffs, so the migration is auditable before the next sync run pushes to GitHub.

**Pre-work:**

- Audit existing issues on `ksyed0/PlanVisualizer` to confirm sync currently overwrites bodies on update (it does — `sync-github.js` PATCH path). Confirm there is no manual issue-body content that would be clobbered.
- Decide whether `_Synced by PlanVisualizer_` footer should include a timestamp and source commit SHA so reviewers can tell which dashboard build produced the body.
- Decide one-way vs two-way AC sync (see above) and either include in scope or split out.

**Dependencies:** ENH-0011 (richer BUG schema). The bug-body template references fields the parser doesn't capture yet — shipping ENH-0012 before ENH-0011 would surface only the existing fields with the new layout (still valuable but partial).

**Reference:** Session conversation 2026-06-29 (`buildIssueBody` audit at `tools/lib/github-client.js:43`).
