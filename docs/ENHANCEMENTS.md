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
