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
- **Cache discipline matters disproportionately more on Opus tiers.** Cache reads are always 10% of base input, so an Opus 4.7 cache hit ($0.50/MTok) vs miss ($5.00/MTok) is a 10× swing per token — same multiplier as Sonnet 5 ($0.20 vs $2.00) but ~2.5× more absolute dollars at stake per cached MTok. Sessions that mix Opus + Haiku subagents (which will become more common as ENH-0007 and ENH-0010 land) will see the highest payoff from cache-hit % as an actionable metric.

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
Rates are hardcoded to Claude Sonnet 4.6 across both the hook (`RATES` const + header comment at `tools/capture-cost.js:11,26-30`) and `tools/lib/compute-costs.js`. Sessions run on Opus 4.7, Opus 4.8, Sonnet 5, or Haiku 4.5 — and mixed-model agent fan-outs — are mispriced. The mispricing compounds as the model mix shifts, and the static rate table cannot represent the **tokenizer change** introduced with Sonnet 5 / Opus 4.7+ (newer tokenizer produces ~30% more tokens for the same English text).

**Impact if unaddressed:**

- Recorded `Cost USD` diverges from actual Anthropic billing — undermines budget tile and per-story cost columns.
- Decisions like "should we move this workflow to Haiku?" or "is Sonnet 5 actually cheaper than Sonnet 4.6 when we include the +30% tokenizer effect?" cannot be A/B'd from the ledger.
- Adding new model tiers (Opus 4.9, future Haiku rev) requires editing code in two places, easy to drift.
- Fast-mode usage on Opus 4.7 ($30 input / $150 output — 6× standard) is invisible — fast-mode sessions read as if they ran at standard rates.

**Authoritative current rates (verified against [platform.claude.com pricing](https://platform.claude.com/docs/en/docs/about-claude/pricing) on 2026-06-30 — supersedes earlier placeholder rates in this ENH):**

| Model                                               | Input  | 5m Cache Write | 1h Cache Write | Cache Read | Output  | Tokenizer  |
| --------------------------------------------------- | ------ | -------------- | -------------- | ---------- | ------- | ---------- |
| Claude Sonnet 5 (intro, through 2026-08-31)         | $2.00  | $2.50          | $4.00          | $0.20      | $10.00  | `claude-5` |
| Claude Sonnet 5 (std, from 2026-09-01)              | $3.00  | $3.75          | $6.00          | $0.30      | $15.00  | `claude-5` |
| Claude Sonnet 4.6                                   | $3.00  | $3.75          | $6.00          | $0.30      | $15.00  | `claude-4` |
| Claude Sonnet 4.5                                   | $3.00  | $3.75          | $6.00          | $0.30      | $15.00  | `claude-4` |
| Claude Opus 4.8                                     | $5.00  | $6.25          | $10.00         | $0.50      | $25.00  | `claude-5` |
| Claude Opus 4.7                                     | $5.00  | $6.25          | $10.00         | $0.50      | $25.00  | `claude-5` |
| Claude Opus 4.6 / 4.5                               | $5.00  | $6.25          | $10.00         | $0.50      | $25.00  | `claude-4` |
| Claude Opus 4.7 _fast mode_ (deprecated 2026-07-24) | $30.00 | —              | —              | —          | $150.00 | `claude-5` |
| Claude Opus 4.8 _fast mode_                         | $10.00 | —              | —              | —          | $50.00  | `claude-5` |
| Claude Haiku 4.5                                    | $1.00  | $1.25          | $2.00          | $0.10      | $5.00   | `claude-4` |
| Claude Fable 5                                      | $10.00 | $12.50         | $20.00         | $1.00      | $50.00  | `claude-5` |

Notes from the pricing page:

- Cache-write and cache-read are fixed multipliers of base input: **5m write = 1.25× input**, **1h write = 2× input**, **cache hit = 0.10× input**. Config can store just `input + output` per model and derive the cache columns, OR store all four for clarity. Recommend storing all four to keep the lookup explicit.
- Batch API discount: 50% off both input and output. Not currently relevant (we don't use Batch), but the config schema should leave room (`batchInput`, `batchOutput` or a `batchMultiplier: 0.5` field).
- Data residency (`inference_geo: "us"`): 1.1× multiplier on every category. Currently not used; config should leave room.

**Tokenizer dimension — why the rate card isn't enough:**

Sonnet 5 and Opus 4.7+ ship a newer tokenizer that produces approximately **30% more tokens** for the same English text vs Sonnet 4.6 / 4.5 and earlier. This means:

- **Sonnet 4.6 → Sonnet 5 (intro):** rates drop 33% per MTok, but tokens rise ~30%, so the _effective_ cost reduction is roughly **10%**, not 33%.
- **Sonnet 4.6 → Opus 4.7:** rates rise 1.67× per MTok, tokens rise ~30%, so _effective_ cost is **~2.17×**, not 1.67×.
- Comparing Sonnet 5 ↔ Opus 4.7 (both `claude-5` tokenizer): apples-to-apples, ratio is a clean 2.5× during intro pricing or 1.67× from Sep 2026 onward.

Implication: rate-card swaps need an effective-cost adjustment when the tokenizer family changes. The dashboard's per-model rollup (proposed below) must call this out, or it will lie to anyone reasoning about model swaps across the 4.x/5.x boundary.

**Proposed path (when prioritized):**

- Add a `Model` column to `docs/AI_COST_LOG.md` (default `claude-sonnet-4-6` for backfill — current hardcoded basis).
- Move pricing out of `tools/capture-cost.js` (`RATES` const) and `tools/lib/compute-costs.js` into `plan-visualizer.config.json` under `costs.modelRates`. Use the full per-model rate object plus a `tokenizer` field:

  ```json
  "costs": {
    "defaultModel": "claude-sonnet-4-6",
    "modelRates": {
      "claude-sonnet-5":      {"input":2.00,"cacheWrite5m":2.50,"cacheWrite1h":4.00,"cacheRead":0.20,"output":10.00,"tokenizer":"claude-5","validUntil":"2026-08-31"},
      "claude-sonnet-5-std":  {"input":3.00,"cacheWrite5m":3.75,"cacheWrite1h":6.00,"cacheRead":0.30,"output":15.00,"tokenizer":"claude-5","validFrom":"2026-09-01"},
      "claude-sonnet-4-6":    {"input":3.00,"cacheWrite5m":3.75,"cacheWrite1h":6.00,"cacheRead":0.30,"output":15.00,"tokenizer":"claude-4"},
      "claude-opus-4-8":      {"input":5.00,"cacheWrite5m":6.25,"cacheWrite1h":10.00,"cacheRead":0.50,"output":25.00,"tokenizer":"claude-5"},
      "claude-opus-4-7":      {"input":5.00,"cacheWrite5m":6.25,"cacheWrite1h":10.00,"cacheRead":0.50,"output":25.00,"tokenizer":"claude-5"},
      "claude-opus-4-7-fast": {"input":30.00,"output":150.00,"tokenizer":"claude-5","deprecatesOn":"2026-07-24"},
      "claude-opus-4-8-fast": {"input":10.00,"output":50.00,"tokenizer":"claude-5"},
      "claude-haiku-4-5":     {"input":1.00,"cacheWrite5m":1.25,"cacheWrite1h":2.00,"cacheRead":0.10,"output":5.00,"tokenizer":"claude-4"}
    }
  }
  ```

  Both modules read from config; if `modelRates[modelId]` is missing, fall back to `defaultModel` and warn at `plan:lint` time.

- For mixed-model sessions (subagents on a different model), record the **primary** model in the column and capture the per-model breakdown in the per-turn JSONL from ENH-0006.
- Add a per-model rollup on the dashboard. Include a column for `tokenizer` so users see the 4.x↔5.x split at a glance, and an "effective-cost vs Sonnet 4.6 baseline" multiplier on each row that accounts for the tokenizer family.
- Fast mode detection: `capture-cost.js` reads `message.usage.service_tier` or equivalent flag from the transcript; if `fast`, look up the `<model>-fast` variant.

**Pre-work:**

- Audit the Stop hook payload to confirm the active model ID is reachable (it is — `message.model` in the transcript). Also confirm fast-mode flag location.
- Decide migration: re-cost historical rows at their actual model (risky — we don't know what they ran on) vs leave them stamped as `claude-sonnet-4-6` and start clean. Recommended: start clean. The pre-migration rows' tokenizer was `claude-4` and Sonnet-4.6-priced, so leaving them as-is is approximately correct.
- Decide cache-write granularity: store 5m / 1h separately in the rate config (as above) vs collapse to one `cacheWrite` field. Recommended: keep separate, since 1h cache will become relevant when ENH-0006 per-turn data shows long-lived prefix patterns.
- Decide schema additions: `batchInput`/`batchOutput` and `inferenceGeoUsMultiplier` slots in config now, populated when needed. Costs nothing today, future-proofs the table.

**Cross-references:**

- **ENH-0005 (cache-hit ratio):** Cache discipline matters disproportionately more on Opus tiers — an Opus 4.7 cache hit costs $0.50/MTok, but the corresponding _miss_ costs $5.00/MTok (10× difference, same as the cache-multiplier definition). Cache-hit % tile becomes a stronger optimisation signal as the model mix shifts toward Opus.
- **ENH-0006 (per-turn JSONL):** Per-turn model attribution is the prerequisite for accurate cost rollups when a session uses multiple models (e.g. Opus main + Haiku subagents).
- **ENH-0010 (subagent attribution):** Subagent rows in the JSONL must carry their own model ID, since they often run on a different tier than the parent.

**Reference:** Session telemetry conversation (2026-06-05). Pricing verified from [platform.claude.com pricing](https://platform.claude.com/docs/en/docs/about-claude/pricing) on 2026-06-30 (Session 66 follow-up). Supersedes earlier placeholder rates in this ENH that incorrectly quoted Opus 4.1 prices ($15 input / $75 output) for Opus 4.7.

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

---

## ENH-0013 — OpenTelemetry adoption (three-level rollout)

**Surface:** AI cost telemetry pipeline + agentic orchestrator (`tools/capture-cost.js`, `tools/agent-lifecycle.js`, dashboard cost tab)
**Status:** Backlog
**Origin:** Session 66 telemetry conversation (2026-06-29)

**Opportunity:**
The project today runs a DIY telemetry stack — a Stop hook parses transcripts, a markdown ledger stores rows, custom JS recomputes costs, the dashboard renders. OpenTelemetry (OTel) offers a vendor-neutral observability standard with three signal types — traces, metrics, logs — and Claude Code itself already speaks the protocol via `CLAUDE_CODE_ENABLE_TELEMETRY=1` + `OTEL_*` env vars. Adoption could replace bespoke layers with industry-standard ones and unlock GenAI semantic conventions (`gen_ai.usage.input_tokens`, `gen_ai.request.model`, etc.) for free integration with Honeycomb / Datadog / Grafana / Phoenix / Langfuse.

**Impact if unaddressed:**

- Per-turn / per-tool / per-subagent attribution (ENH-0006 / ENH-0010) remains DIY work. OTel solves the parent-child span model natively — distributed tracing is exactly what subagent attribution needs.
- Cannot easily share cost telemetry with stakeholders who don't read markdown. No multi-developer central view.
- Adding alerts (ENH-0009) and trend charts (ENH-0008) requires bespoke code in `tools/lib/budget.js`; OTel Collectors handle thresholds and aggregations natively.
- Mispriced multi-model sessions (ENH-0007) — OTel GenAI conventions already standardise `gen_ai.request.model`, so once instrumented the model dimension drops in automatically.

**Proposed path (when prioritized) — three independently shippable levels:**

- **Level 1 (~30 min):** Turn on Claude Code's built-in OTel exporter. Add `CLAUDE_CODE_ENABLE_TELEMETRY=1`, `OTEL_METRICS_EXPORTER=otlp`, `OTEL_LOGS_EXPORTER=otlp`, `OTEL_EXPORTER_OTLP_ENDPOINT=http://localhost:4317` to env / `.claude/settings.json`. Run a local `otelcol` Collector that writes to JSON-file. Existing markdown ledger keeps running alongside — OTel is read-only verification at this stage. Wins: ENH-0006 / ENH-0007 partially solved for free. Trade-off: long-running local process.
- **Level 2:** Replace transcript-walking in `capture-cost.js` with Collector → SQLite pipeline. Markdown ledger becomes a projection of the DB rather than the source of truth. Wins: ENH-0006 fully solved; per-tool attribution via span attributes; cache-hit ratio (ENH-0005) is a one-line metric pipeline. Trade-off: `[est]` backfill convention moves into a SQL seed file; some workflow loss.
- **Level 3:** Instrument the orchestrator itself. Replace `tools/agent-lifecycle.js` start/done/blocked events with real OTel spans wrapping each BLAST phase. `cycles[]` in `sdlc-status.json` becomes a derived view of trace data. Wins: full subagent attribution (ENH-0010) via native span nesting; flamegraph view of any cycle. Trade-off: 2-3 story refactor of the orchestrator state machine.

**Pre-work:**

- Sample Claude Code's current OTel output against the GenAI semantic-convention spec to confirm `gen_ai.*` attributes are emitted (and identify gaps that would need extending the SDK or wrapping in a custom Collector processor).
- Decide which Collector exporter backend to standardise on at Level 1 (JSON-file for the experiment; longer-term TBD — Prometheus + Grafana for self-hosted, Honeycomb / Phoenix for SaaS).
- Confirm Claude Code's exporter emits subagent spans (likely incomplete today — would inform Level 3 effort).

**Dependencies:** None to start. Level 1 unblocks ENH-0005, ENH-0006, ENH-0007, ENH-0008, ENH-0009, ENH-0010 by giving them a richer source than the markdown ledger.

**Reference:** Session 66 conversation (2026-06-29).

---

## ENH-0014 — Graph-based retrieval (`graphify`-style) for cost reduction

**Surface:** Agent prompts + `tools/lib/repository/` indexers + `CLAUDE.md` project rules
**Status:** Backlog
**Origin:** Session 66 telemetry conversation (2026-06-29)

**Opportunity:**
Every time the agent reads a 2000-line file to find one symbol, prefill burns ~6k input tokens unnecessarily. A code graph (symbol → file:line, callers, callees, imports) lets the agent fetch just the relevant slice — typically 50–300 lines. On long sessions this compounds: cache hits get larger and more stable. The `claude-mem:smart-explore` skill (tree-sitter AST search) and the project's SQLite repository pattern (`tools/lib/repository/`) already provide ~80% of the infrastructure — this ENH is about wiring them in by default.

**Impact if unaddressed:**

- Token spend stays inflated by whole-file reads when symbol-scoped reads would suffice.
- Cache-hit ratio (ENH-0005) measurement is meaningful only if there is something to optimise — without retrieval-side levers, the metric becomes a passive number rather than a feedback signal.
- Refactor confidence (e.g. "find every caller of `parseReleasePlan` before changing it") costs a full-tree grep (~3k tokens) when a graph lookup would cost ~600 tokens.

**Proposed path (when prioritized) — three layers, smallest first:**

- **Layer 1 (zero new code):** Add a `CLAUDE.md` project rule — "For any file >300 lines, use `claude-mem:smart-explore` (outline first) before `Read`. Read full only when modifying or when the outline is insufficient." Expected ~30–50% input-token reduction on exploratory sessions. Trade-off: one extra tool call per file; worth it past ~300 lines, not below.
- **Layer 2:** Symbol index in SQLite (`tools/lib/repository/migrations/005_symbols.sql`). New table `symbols(name, kind, file, start_line, end_line, signature)`; indexer walks `tools/**/*.js` with tree-sitter at `plan:index` time. New CLI `tools/lookup-symbol.js <name>` emits `file:line-line`. Cost win: "Read budget.js to find `computeBudget`" (200 lines) becomes "lookup `computeBudget` → Read budget.js:42-78" (~36 lines). Trade-off: index drift mitigated by a dirty-flag Stop hook that triggers reindex next session.
- **Layer 3:** Reference graph as a separate table `symbol_refs(from_symbol, to_symbol, file, line)`. Populated by the same indexer. Unlocks caller/callee queries without full-tree grep. Trade-off: tree-sitter is not type-aware; dynamic dispatch and string-based requires will be missed. Acceptable for a markdown-parsing toolchain.

**Pre-work:**

- Measure baseline `inputTokens / turn` on a sample of 5 recent sessions (depends on ENH-0006 per-turn JSONL for accurate numbers).
- A/B Layer 1 with a one-week rule-on / rule-off comparison once ENH-0006 is in place.
- Confirm `claude-mem:smart-explore` handles all source-file types in this repo (JS, MD, SQL, JSON).

**Dependencies:** Layer 1 ships without dependencies. Measurability of impact depends on ENH-0006 (per-turn JSONL) — without it, A/B comparisons are anecdotal. ENH-0005 (cache-hit ratio tile) provides the visible feedback signal.

**Reference:** Session 66 conversation (2026-06-29).

---

## ENH-0015 — Per-session trace viewer (`tools/render-session-trace.js`)

**Surface:** New tool `tools/render-session-trace.js` + new dashboard tab / link from cost-log rows
**Status:** Backlog
**Origin:** Session 66 telemetry conversation (2026-06-29)

**Opportunity:**
Today there is no way to see "what did this session actually do, and where did the time / tokens go?" The cycle lap-strip (US-0133) visualises phase-level durations at the project rollup, but a single Claude Code session — with its tree of tool calls, agent invocations, and subagent fan-outs — is opaque. The transcript JSONL (`~/.claude/projects/<encoded-cwd>/<sessionId>.jsonl`) already contains timestamps on every message and `tool_use` block; pairing them with `tool_result` blocks by `id` yields durations directly. A self-contained HTML flamegraph would close the visibility gap without new infrastructure.

**Impact if unaddressed:**

- "Where did that 2-hour session burn the time?" stays unanswerable. Debugging long sessions or pathological agent loops requires reading the raw JSONL by hand.
- Subagent attribution (ENH-0010) is hard to design without first being able to _see_ the parent-child relationships in a real session.
- Cost-optimisation hypotheses (graphify Layer 1 from ENH-0014, batched Reads, agent-vs-direct-tool tradeoffs) cannot be visually validated.

**Proposed path (when prioritized):**

- Build `tools/render-session-trace.js` (~150 lines):
  1. Read the transcript JSONL by session ID (or path).
  2. Walk turns; pair `tool_use` with `tool_result` by `id`; compute durations.
  3. For `Agent` / `Workflow` tool calls, recursively read the child session's JSONL (each subagent has its own JSONL under the same `projects/` dir) and nest its turns inside the parent's span.
  4. Emit `docs/traces/<sessionId>.html` — a self-contained Gantt / flamegraph using either [d3-flame-graph](https://github.com/spiermar/d3-flame-graph) or the hand-rolled SVG pattern already used in the lap-strip at `tools/generate-dashboard.js:3677`.
- Wire a "Trace" link onto each cost-log row in the dashboard that opens the matching HTML file.
- Add a metric toggle (top-right of the trace view): duration · tokens · cost. Same data, different bar lengths.
- Optional: collapse-by-default tree where the main session row expands to show its subagent contributions (label · model · tokens · cost · wall-clock).

**Pre-work:**

- Inspect a real `Workflow` session transcript to confirm subagent JSONLs are linked by `tool_use_id` in a stable way.
- Decide depth cap for the recursive subagent walk (recommend 2 — sum deeper agents into "deeper agents").
- Decide where the generated HTML lives — committed under `docs/traces/` (full history, repo growth) vs untracked under `.tmp/traces/` (local-only, regeneratable on demand).

**Dependencies:** None hard. Output is richer when ENH-0006 (per-turn JSONL) is in place — the transcript walk would be replaced by direct JSONL reads, eliminating the recursive subagent walk. ENH-0013 Level 1 (OTel) would also obsolete this tool in favour of Jaeger UI; this ENH stays useful for users who don't want a Collector running.

**Reference:** Session 66 conversation (2026-06-29).
