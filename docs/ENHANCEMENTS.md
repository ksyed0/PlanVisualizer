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
