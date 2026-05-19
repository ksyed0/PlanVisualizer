# Persistence & Multi-User Strategy

**Classification:** Strategic Direction
**Status:** Brainstorm output captured 2026-05-19. Not a roadmap commitment; not yet broken down into epics/stories.
**Foundation:** PlanVisualizer v2.4.0; the Enterprise Agentic SDLC roadmap (`docs/architecture/enterprise-agentic-sdlc-spec-v2.md`).

---

## 0. Purpose of this document

To capture the architectural thinking that emerged from a 2026-05-19 brainstorming session, so the analysis isn't lost between now and when the work is scheduled. **This document does not commit PlanVisualizer to any specific delivery date or backlog item.** It records:

- The honest assessment of where the current markdown persistence layer holds up and where it breaks.
- The open-core path forward — why it's the recommended shape and what each step looks like.
- What's in scope at each step, what's deferred, and what's explicitly out of scope.
- Links to the Step 1 design spec, which is the only step currently brainstormed in detail.

When work is ready to be scheduled, individual steps move from this document into the normal planning ritual (epics → stories → ACs in `docs/RELEASE_PLAN.md`).

---

## 1. Where PlanVisualizer is today

- **One human orchestrator**, one 9-agent team (Conductor + Compass + Keystone + Lens + Palette + Forge + Pixel + Sentinel + Circuit), one machine.
- **Markdown + JSON as the persistence layer.** `RELEASE_PLAN.md`, `BUGS.md`, `TEST_CASES.md`, `LESSONS.md`, `ID_REGISTRY.md`, `AI_COST_LOG.md`, plus `sdlc-status.json` and a handful of generated coverage / dashboard outputs.
- **No data-access layer.** ~10 tools (`agent-lifecycle.js`, `update-sdlc-status.js`, `agent-context.js`, `generate-plan.js`, `agent-spec-plan.js`, etc.) call `fs.read/write` and parsers directly. Concurrency primitives (`file-lock.js`, `atomic-write.js`, `git-safe.js`) exist as utilities, not as an enforced boundary.
- **The Enterprise Agentic SDLC roadmap (EPIC-0030..0035)** extends to multi-team (Programme Conductor + 3 team meshes + Deploy + Retrospective) but keeps the single human + single machine assumption.

## 2. Why this question now

The markdown layer is already showing strain at single-user scale:

- `RELEASE_PLAN.md` has crossed 4,000 lines. Two parallel sessions guarantee merge conflicts.
- `ID_REGISTRY.md` drifts in practice (EPIC-0029 referenced in commits before the registry was bumped — we just resynced it).
- Parser fragility: one mis-indented backtick silently drops records.
- `sdlc-status.json` is rewritten 20–50 times per story by lifecycle events, all serialised through one file lock.
- The multi-team roadmap will multiply concurrent agent count from ~9 to ~30. The single-file bottleneck becomes the binding constraint, not the human, not the CPU.

If we ship EPIC-0030..0035 against the current persistence layer, agent dispatch latency will be dominated by file-lock contention. The work below addresses that — and lays groundwork for scaling beyond a single machine without rewriting the product.

## 3. The three independent scaling problems

"Scalable" hides three distinct problems that have different solutions and different costs:

| Problem                                              | Scope                                                  | Solved by                                            |
| ---------------------------------------------------- | ------------------------------------------------------ | ---------------------------------------------------- |
| **Concurrent access** to shared state                | 30 agents writing at once on one machine               | Transactions / row-level locks / partitioned storage |
| **Identity** — who is acting                         | Multiple humans sharing the same machine or repo       | A `User` concept and `actor` recorded on every write |
| **Network boundary** — single machine to distributed | Humans on different laptops, agents on different hosts | Server + network repository implementation           |

The order they bite is concurrency → network → identity (concurrency at multi-team scale; network when humans separate; identity at any point but most painful once shared by multiple humans). The right sequence is to solve concurrency first because it blocks the current roadmap; defer network and identity until they're actually needed.

## 4. The open-core decision

Three product shapes were considered:

| Shape                                                 | Description                                                                           | Verdict                                                                                       |
| ----------------------------------------------------- | ------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------- |
| **(a) Single product with mode flags**                | `PV_MODE=local\|team\|enterprise` switches behaviour                                  | Maintainable initially; tends to produce two products living in one codebase, neither clean   |
| **(b) Open-core** _(chosen)_                          | OSS local-only is the on-ramp; enterprise tier adds server, auth, RBAC, multi-tenancy | Best path to a sustainable business model; same code through Steps 1-2; clean split at Step 3 |
| **(c) Two separate products sharing only a protocol** | Single-user and enterprise are different codebases                                    | Premature; appropriate only if the two product visions diverge irreconcilably                 |

PlanVisualizer commits to **(b) open-core**. The OSS edition is and remains the entry point. Enterprise capabilities are additive and live behind a future package boundary (e.g. `@planvisualizer/server`, `@planvisualizer/auth`). No enterprise feature is built speculatively before the OSS edition needs it.

## 5. The roadmap, at architecture level

Four steps. Each is independently shippable; each opens the door for the next without committing to it.

### Step 1 — Repository abstraction + indexed SQLite + upgrade tooling

**Target:** single user, single machine, multi-team load (30 concurrent agents).

- A repository / data-access layer between tools and storage.
- Markdown remains authoritative for human-edited entities (Epic, Story, AC, Task, Bug, Lesson, TestCase, IdRegistry).
- SQLite becomes authoritative for tool-emitted state (`sdlc-status.json` records move into SQL).
- A derived SQLite index provides fast queries + referential integrity validation for the markdown-backed entities.
- A migration framework (`tools/lib/migrations/`) with `pv:check-upgrade` / `pv:upgrade` / `pv:rollback` / `pv:doctor` commands handles existing-user upgrades.
- Spec: [`docs/superpowers/specs/2026-05-19-step-1-repository-abstraction-design.md`](../superpowers/specs/2026-05-19-step-1-repository-abstraction-design.md).
- Status: brainstormed, awaiting `writing-plans` → implementation plan.
- Indicative effort: ~17–28 working days through the agent pipeline (~3–6 weeks calendar). Detailed sizing in the spec.
- Out of scope: identity, server, network, partition of `RELEASE_PLAN.md` into per-epic files.

### Step 1.5 — Partition (storage layout change behind the repo)

**Target:** unlock real concurrency for genuinely independent writes.

- `RELEASE_PLAN.md` → `docs/release-plan/EPIC-XXXX.md` (per epic).
- `TEST_CASES.md` → per-epic (mirrors stories).
- `BUGS.md` → `BUGS_Open.md` + `BUGS_Done.md` (status-based).
- `AI_COST_LOG.md` → `AI_COST_LOG/YYYY-MM.md` (date-based).
- `sdlc-status.json` → already SQL records as of Step 1 Phase D; no further partition needed.
- `LESSONS.md`, `ID_REGISTRY.md` → keep single (low write volume, no contention benefit from partition).
- Triggered by: measured single-file write contention impacting session latency, OR multi-team load actually arriving.
- The repository abstraction makes this an internal datastore-layout change — `repo.stories.create()` doesn't change, only where the data lands.
- User-visible repo layout changes; a migration guide and `MIGRATION.md` ship with this step.
- Status: future planning.

### Step 2 — Multi-user, single machine

**Target:** two or more humans sharing one repo on one machine (or shared dev box).

- Introduces an `Identity` / `User` model. Sessions are bound to a user.
- The repository records `actor` on every write. An audit trail emerges naturally.
- File locks become OS-level user locks; the existing `file-lock.js` mechanism is extended, not replaced.
- No server yet. Storage stays local; concurrency happens through the existing repository.
- Authorization remains trust-based (no RBAC).
- Status: future planning.

### Step 3 — Multi-machine (the open-core split begins)

**Target:** humans on different laptops with agents that may run on different hosts.

- A network repository implementation: `HTTPRepository` (or gRPC) that speaks to a central server.
- Server-side persistence is SQLite-backed for small teams, Postgres-backed at larger scale.
- Local CLI + agents stay OSS; the server is the enterprise product surface.
- Tools continue to call `repo.x()` — only the implementation swaps. Sync vs async API is the one refactor that has to happen at this step (probably).
- This is where the OSS package and the enterprise package physically diverge.
- Status: future planning.

### Step 4 — Enterprise scale

**Target:** organisations that need governance, compliance, and packaging.

- RBAC, SSO, audit retention, multi-tenant isolation.
- Pricing and packaging conversation, not architecture conversation.
- Status: future planning. Explicitly not a current product commitment.

## 6. What stays out of scope

The following are not on this roadmap and would each be a separate decision:

- **Replacing markdown as the human-readable surface.** Even at Step 4, hand-editable markdown remains a first-class input for human-authored entities. The architecture preserves that.
- **A real-time collaborative editing model** (CRDTs, OT). PlanVisualizer's write patterns are coarse-grained; transactional reads/writes are sufficient.
- **Vendor SaaS as the only deployment target.** Self-host stays a first-class option through Step 4.
- **Mobile clients.** The dashboard works in a browser; native mobile is outside the SDLC tool's identity.

## 7. How this relates to the existing roadmap

- **Step 1 should land before EPIC-0030..0035's multi-team load.** Without the repository abstraction, the multi-team work would be built directly on top of the file-lock-on-one-file bottleneck.
- **Step 1.5 (partition) is not a prerequisite for single-team operation.** It becomes necessary when concurrent-team contention is measurable.
- **Steps 2-4 are independent of EPIC-0030..0035.** The enterprise multi-team architecture is "many agent meshes one human." Steps 2-4 are "many humans, possibly many machines." Orthogonal axes.

## 8. Open questions deferred

These are real questions but answering them now would be premature.

- Identity provider model: local accounts vs SSO-only vs both.
- Where the Step 3 server runs by default: user-hosted vs PV-hosted SaaS vs both.
- Migration story between OSS local and enterprise hosted (export/import? federation? fork-and-relink?).
- Pricing model and edition naming for the eventual enterprise tier.
- Whether `sdlc-status.json` (now SQL-only after Step 1 Phase D) ever needs to be re-exported as JSON for tooling that hasn't been written yet.

## 9. References

- `docs/architecture/enterprise-agentic-sdlc-spec-v2.md` — multi-team architecture grounded in v2.4.0; EPIC-0030..0035 implements it.
- `docs/superpowers/specs/2026-05-19-step-1-repository-abstraction-design.md` — Step 1 design (this document's near-term work).
- The brainstorming session transcript that produced this document is preserved in the session log of 2026-05-19.

---

_Updates to this document accompany any change in strategic direction. Specific work is tracked in `docs/RELEASE_PLAN.md` when ready for the backlog._
