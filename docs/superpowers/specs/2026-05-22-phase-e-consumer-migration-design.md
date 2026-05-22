# Phase E — Consumer Migration & Cleanup (Design Spec)

**Epic:** EPIC-0045 — Consumer Migration & Cleanup (SDLC Repository Abstraction, Phase E)
**Date:** 2026-05-22
**Status:** Draft (pending PR review)
**Predecessors:** Phase D close-out — `docs/memory/sessions/2026-05-22-session-57-phase-d-complete.md`
**Source prompt:** `docs/superpowers/plans/session-58-phase-e-prompt.md`

---

## 1. Context

Phase D (EPIC-0039) consolidated all four SDLC lifecycle writers behind the D.1 entity repos (`SdlcTaskRepo`, `SdlcEventRepo`, `SdlcProgrammeRepo`). SQL is now authoritative; `docs/sdlc-status.json` is a regenerated mirror, re-rendered under a file lock on every write.

Phase D left three knowingly-temporary scaffolds behind:

1. **`tools/lib/repository/sdlc-mirror.js:32-43`** — a "preserve unknown top-level JSON keys" block that copies legacy top-level fields (`agents`, `metrics`, `stories`, `epics`, `phases`, `cycles`, `currentPhase`, `githubStatus`, `project`) forward across mirror writes, so D.3's task-level writes do not silently wipe D.4's programme-level state.
2. **`tools/lib/repository/indexers/sdlc-status-indexer.js`** — retained as a reference file per AC-1014; no longer in the indexer `MAP`; safe to delete once no imports remain.
3. **Dual-shape on disk** — the JSON mirror still surfaces the 9 legacy keys at top level alongside the canonical `{tasks, log, programme}` triple.

Phase E retires all three. The hard gate is the canonical-only shape on disk plus its absence in code.

---

## 2. Hard Gates

Verbatim from the prompt. Phase E is **not complete** until all four pass:

1. `tools/lib/repository/sdlc-mirror.js:32-43` — the "preserve unknown top-level JSON keys" scaffolding is removed.
2. `tools/lib/repository/indexers/sdlc-status-indexer.js` is deleted entirely.
3. Dashboard reader (`tools/generate-dashboard.js:~4137` + the inline JS at `docs/dashboard.html:3488`) reads only `{tasks, log, programme}`.
4. `docs/sdlc-status.json` contains exactly `{tasks, log, programme}` — verified by a post-`pv:upgrade` test that asserts `Object.keys(json).sort() === ["log","programme","tasks"]`.

**Verification commands** (lifted from the prompt, run at end of Phase E):

```bash
# Files removed
test ! -f tools/lib/repository/indexers/sdlc-status-indexer.js
! grep -q "preserve any extra top-level keys" tools/lib/repository/sdlc-mirror.js

# On-disk JSON has only the canonical triple
npm run pv:upgrade && node -e "
  const k = Object.keys(JSON.parse(require('fs').readFileSync('docs/sdlc-status.json','utf8'))).sort();
  if (JSON.stringify(k) !== '[\"log\",\"programme\",\"tasks\"]') { console.error('FAIL:', k); process.exit(1); }
"

# Standard gates
npm test && npm run plan:lint && npm run lint
```

---

## 3. E.1 Audit — Consumers of `docs/sdlc-status.json`

This audit replaces the runtime story originally numbered E.1; it is a spec deliverable.

### 3.1 Readers

| Reader (`path:line`)                                     | Keys consumed today                                                                                    | Post-Phase-E location                                                                                                                                   | Notes                                                                                                                    |
| -------------------------------------------------------- | ------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------ |
| `tools/generate-dashboard.js:~4137` (5s polling fetch)   | `agents`, `stories`, `metrics`, `epics`, `phases`, `cycles`, `currentPhase`, `project`, `tasks`, `log` | `programme.*` for the 9 legacy keys; `tasks`/`log` unchanged                                                                                            | Heavy consumer; caches blob in `window._pvLastStatus`                                                                    |
| `docs/dashboard.html:3488` (inline JS, `refreshState()`) | Same 9 + `tasks`, `log`                                                                                | Same                                                                                                                                                    | Compiled from the dashboard generator; same migration                                                                    |
| `tools/generate-plan.js:263`                             | `stories` (per-story `specPhase`, `planPhase`, `phaseHistory`)                                         | `programme.stories`                                                                                                                                     | Read at startup                                                                                                          |
| `tools/agent-context.js:69`                              | `tasks`, `stories`                                                                                     | `tasks` unchanged; `stories` → `programme.stories`                                                                                                      | Already partially-migrated                                                                                               |
| `tools/update-sdlc-status.js:*`                          | All 9 programme fields (read-modify via HANDLERS)                                                      | All writes go through `SdlcProgrammeRepo`; in-memory HANDLERS continue to operate on the rich-state shape unchanged (per the file's own header comment) | D.4 already routes writes through SQL; no on-disk read of legacy top-level needed                                        |
| `tools/agent-spec-plan.js:171`                           | `stories`, `programme`                                                                                 | `programme.stories` only                                                                                                                                | Falls back through `readMirror()`; remove the legacy fallback                                                            |
| `tools/init-sdlc-status.js:39–96`                        | `agents`, `phases`, `project` (writes them, then reads back at line 96)                                | Writes `programme.{agents, phases, project}` directly                                                                                                   | Critical: if init still writes legacy top-level, every fresh project lands in state B and Migration 006 re-fires forever |
| `tools/pv-rollback.js:54–126`                            | Metadata check only (no key extraction)                                                                | Unchanged                                                                                                                                               | Safe                                                                                                                     |

### 3.2 Per-Legacy-Key Mapping

Every one of the 9 legacy top-level keys relocates under `programme.{key}` — no exceptions, no dead keys, no schema changes:

| Legacy key     | Destination              | Owner               | Storage                                  |
| -------------- | ------------------------ | ------------------- | ---------------------------------------- |
| `agents`       | `programme.agents`       | `SdlcProgrammeRepo` | Row in `sdlc_programme` (`key='agents'`) |
| `metrics`      | `programme.metrics`      | `SdlcProgrammeRepo` | Row in `sdlc_programme`                  |
| `stories`      | `programme.stories`      | `SdlcProgrammeRepo` | Row in `sdlc_programme`                  |
| `epics`        | `programme.epics`        | `SdlcProgrammeRepo` | Row in `sdlc_programme`                  |
| `phases`       | `programme.phases`       | `SdlcProgrammeRepo` | Row in `sdlc_programme`                  |
| `cycles`       | `programme.cycles`       | `SdlcProgrammeRepo` | Row in `sdlc_programme`                  |
| `currentPhase` | `programme.currentPhase` | `SdlcProgrammeRepo` | Row in `sdlc_programme`                  |
| `githubStatus` | `programme.githubStatus` | `SdlcProgrammeRepo` | Row in `sdlc_programme`                  |
| `project`      | `programme.project`      | `SdlcProgrammeRepo` | Row in `sdlc_programme`                  |

Rationale: `sdlc_programme` is already a key/value SQL table (`SdlcProgrammeRepo.set(key, value)` → one row per key, mirror re-renders `programme.{key}: value`). D.4 already writes through this repo via `update-sdlc-status.js`. What Migration 005 left undone — ingesting these 9 fields into SQL — Migration 006 finishes.

### 3.3 Three On-Disk States Migration 006 Must Handle

| State                          | Top-level shape                                | `programme.*` shape     | When it occurs                                                               |
| ------------------------------ | ---------------------------------------------- | ----------------------- | ---------------------------------------------------------------------------- |
| B (pre-D.4 / pre-Phase-E live) | 9 legacy keys at top level                     | absent or `{}`          | Live main repo as of 2026-05-22; Migration 005 ingested only `tasks` + `log` |
| C (preservation-doubled)       | 9 legacy keys + identical `programme.*` mirror | populated by D.4 writes | Any repo where D.4 ran post-005, before Phase E                              |
| A (canonical-only)             | `{tasks, log, programme}` only                 | populated               | Post-Phase-E target                                                          |

---

## 4. Architecture & Data Flow

### 4.1 Shared Accessor Helper

A single source of truth for "where does each formerly-legacy key live now":

```
// tools/lib/repository/sdlc-status-reader.js
function programme(json)    { return json.programme || {}; }
function agents(json)       { return programme(json).agents       || json.agents       || []; }  // dual-read fallback (transitional)
function stories(json)      { return programme(json).stories      || json.stories      || {}; }
function metrics(json)      { return programme(json).metrics      || json.metrics      || {}; }
function epics(json)        { return programme(json).epics        || json.epics        || {}; }
function phases(json)       { return programme(json).phases       || json.phases       || []; }
function cycles(json)       { return programme(json).cycles       || json.cycles       || []; }
function currentPhase(json) { return programme(json).currentPhase || json.currentPhase || null; }
function githubStatus(json) { return programme(json).githubStatus || json.githubStatus || {}; }
function project(json)      { return programme(json).project      || json.project      || {}; }
```

**The `|| json.{key}` dual-read fallback is transitional.** It protects developers who pull `develop` in the window between US-0259 merging (consumers read `programme.*`) and US-0262 merging (Migration 006 ingests legacy top-level into SQL). Without the fallback, that window shows an empty dashboard.

**The fallback is removed in US-0261**, after Migration 006 has provably run and the preservation block is deleted. Same PR, same diff.

### 4.2 Migration 006 — Algorithm

```text
1. Check migrations-applied table for "006" — if present, return {skipped: 'idempotent'}.
2. Extend the existing pv:upgrade snapshot to capture the PRE-migration
   docs/sdlc-status.json into docs/.pv-backup/pre-upgrade-<ts>/
   (rollback safety — must happen BEFORE any SQL write).
3. Open a single SQLite transaction.
4. For each legacy key K in [agents, metrics, stories, epics, phases,
   cycles, currentPhase, githubStatus, project]:
     a. If json[K] exists AND programme[K] is absent:
        repo.sdlcProgramme.set(K, json[K])    # state B → C
     b. If json[K] exists AND programme[K] exists:
        # state C: SQL is canonical. Divergence indicates manual
        # tampering — log a warning but do not overwrite.
        if (JSON.stringify(json[K]) !== JSON.stringify(programme[K])) {
          warningsChannel.push('migration_006_conflict_' + K);
        }
        # No write either way.
5. Commit SQLite transaction.
6. Trigger ONE mirror re-render (post-transaction). Until E.4 lands,
   the preservation block will still copy top-level legacy keys
   forward — Migration 006 itself does NOT strip them. The strip
   happens organically once the preservation block is removed in
   US-0261.
7. Insert row into migrations-applied with hash of the canonical
   post-render mirror output.
```

**Why the strip is organic, not explicit:** As long as the preservation block exists, any explicit strip in Migration 006 would be undone on the very next mirror write. The clean cutover is: ingest in 006 → remove preservation in E.4 → next mirror write naturally produces canonical-only output. This means `pv:upgrade` between US-0262 merge and US-0261 merge still produces state C (acceptable — readers handle it via the dual-read accessor).

**Performance note:** `SdlcProgrammeRepo.set()` calls `mirror.write()` after every set. Naively, 9 sets = 9 mirror writes during the migration. This is acceptable for one-shot code that runs once per machine forever (total wall time < 1 second). Optimizing via a `setMany` API is YAGNI; if implementation reveals it's slow, file a follow-up enhancement (ENH-0005+).

### 4.3 Sequencing

Story merge order (within Phase E):

```
US-0259 (dashboard reads programme.* via dual-read helper)
        ↓
US-0260 (non-dashboard consumers + init-sdlc-status seeds canonical)
        ↓
US-0262 (Migration 006 — ingest + snapshot, preservation still alive)
        ↓
US-0261 (remove preservation block + delete sdlc-status-indexer.js
         + remove dual-read fallback from accessor — single PR)
        ↓
US-0263 (housekeeping: rename data_005-*, gitignore .pv-state.json,
         audit other escaping artifacts) — parallelizable with anything
         after US-0259
```

At every point in this sequence:

- Every consumer reads via the accessor helper (handles both shapes).
- The on-disk shape is either state B, state C, or state A — accessor handles all three.
- No reader ever sees a half-migrated empty value.

---

## 5. Stories

### US-0259 — Dashboard reader migration + shared accessor (TASK-0066)

**Scope:**

- Create `tools/lib/repository/sdlc-status-reader.js` with the 9 dual-read accessor functions (Section 4.1).
- Migrate `tools/generate-dashboard.js:4137` and the inline JS in `docs/dashboard.html:3488` to read via the accessor. No direct `status.agents`, `status.stories`, etc. remain.

**Acceptance Criteria:**

- **AC-1015** — Accessor helper exports the 9 dual-read functions; fixture tests prove both shapes (legacy top-level only, `programme.*` only) return the same values.
- **AC-1016** — Dashboard renders correctly against three fixture JSONs (state A, B, C). No `ReferenceError`, all dashboard regions (agent cards, metrics, cycle strip, etc.) populated.

**Out of scope:** removing the dual-read fallback (deferred to US-0261).

---

### US-0260 — Non-dashboard consumer migration + canonical init seed (TASK-0067)

**Scope:**

- `tools/generate-plan.js:263` reads `sdlc.programme.stories[id].*Phase` via the accessor.
- `tools/agent-context.js:69` reads `sdlc.programme.stories[id]` via the accessor.
- `tools/agent-spec-plan.js:171` `readMirror()` fallback to legacy `onDisk.stories` is removed (replaced by accessor; SQL is canonical).
- `tools/init-sdlc-status.js` seeds `programme.{agents, phases, project}` directly via `SdlcProgrammeRepo.set()` — no top-level legacy writes.

**Acceptance Criteria:**

- **AC-1017** — All three non-dashboard consumers read via the accessor; integration tests pass against state A/B/C fixtures.
- **AC-1018** — `init-sdlc-status` output, freshly run in a tmpdir, has `Object.keys(json.programme).sort() === ['agents','phases','project']` and empty top-level legacy keys.

---

### US-0262 — Migration 006: ingest legacy top-level into SQL (TASK-0068)

**Scope:**

- Create `tools/lib/repository/migrations/006-ingest-legacy-programme.js` implementing the algorithm in Section 4.2.
- Extend `pv:upgrade` snapshot to capture pre-006 JSON (preservation of legacy top-level keys in `docs/.pv-backup/pre-upgrade-<ts>/sdlc-status.json`).
- Update `docs/architecture/pv-backup-format.md` to describe the extended snapshot contents.
- Idempotency: migrations-applied row keyed on `"006"`.
- `pv:rollback` integration: rolling back across 006 restores pre-006 JSON byte-identical.

**Acceptance Criteria:**

- **AC-1019** — Migration runs cleanly against state-B fixture (top-level → `programme.*` ingested into SQL; rollback restores byte-identical state B). Migration is no-op against state-A fixture. Migration logs `migration_006_conflict_{K}` warnings against synthetic state-C divergence fixture; SQL value unchanged.
- Idempotency: second invocation in same root returns `{skipped: 'idempotent'}` without re-snapshotting.

**Notes:** Migration 006 does NOT strip top-level legacy keys. The strip happens organically once US-0261 removes the preservation block.

---

### US-0261 — Remove preservation block + delete indexer + remove dual-read fallback (TASK-0069)

**Scope:**

- Delete `tools/lib/repository/sdlc-mirror.js:32-43` (the preservation `try { ... } catch {}` block + its `TRANSITIONAL DEBT` comment).
- Delete `tools/lib/repository/indexers/sdlc-status-indexer.js` entirely. Verify zero hits first: `grep -rn "indexSdlcStatusJson\|sdlc-status-indexer" tools/ tests/`.
- Strip the `|| json.{key}` dual-read fallback from the 9 accessor functions in `tools/lib/repository/sdlc-status-reader.js`. Accessors now read `programme.*` only.

**Acceptance Criteria:**

- **AC-1020** — Both hard-gate tests pass:
  - **Code gate:** `tests/repository/sdlc-mirror-no-preservation.test.js` greps `sdlc-mirror.js` source and asserts the preservation comment + loop pattern are absent.
  - **Behavior gate:** `tests/integration/sdlc-status-canonical-shape.test.js` spawns `pv:upgrade` in a tmpdir-rooted fixture (per L-0082) and asserts `Object.keys(json).sort() === ['log','programme','tasks']`.
  - **Indexer gate:** `fs.existsSync('tools/lib/repository/indexers/sdlc-status-indexer.js') === false`.

**Dependency:** must merge after US-0259, US-0260, and US-0262. Enforced via PR review; the spec PR documents this ordering and orchestrator dispatch respects it.

---

### US-0263 — Housekeeping: data_005 rename + gitignore + artifact audit (TASK-0070)

**Scope:**

- Rename `tools/lib/migrations/005-ingest-sdlc-status.js` → `tools/lib/migrations/data_005-ingest-sdlc-status.js`. Update all `require`/`import` sites. (Resolves L-0081.)
- Add `docs/.pv-state.json` to `.gitignore`. (Addresses BUG follow-up from Phase D close-out.)
- Audit `pv:upgrade` and `pv:rollback` for other runtime artifacts that escape into the working tree but aren't ignored: scan `tools/pv-upgrade.js`, `tools/pv-rollback.js`, and any path mentioned in `docs/.pv-backup/`. Add any discovered escapees to `.gitignore`.

**Acceptance Criteria:**

- **AC-1021** — `tests/repository/migrations-no-collision.test.js` walks `tools/lib/repository/migrations/` and `tools/lib/migrations/` and asserts no two migration files share the same numeric prefix. CI fails if any collision exists. (Note: schema migration `005_sdlc_task_lifecycle_fields.sql` keeps its prefix; the data migration is the one that renames to `data_005-*`.)
- **AC-1022** — `docs/.pv-state.json` does not appear in `git status` after `pv:upgrade` in a fresh checkout. Audit report (a 3-5 line summary in the PR description) documents any additional artifacts discovered and gitignored.

**Parallel-safe:** can be developed in parallel with any of US-0259..US-0262.

---

## 6. Test Plan

### 6.1 Hard-gate tests (one per prompt-mandated gate)

| Gate                        | Test file                                               | Type                            | Assertion                                                                                                       |
| --------------------------- | ------------------------------------------------------- | ------------------------------- | --------------------------------------------------------------------------------------------------------------- |
| Preservation removed        | `tests/repository/sdlc-mirror-no-preservation.test.js`  | Code grep                       | `fs.readFileSync('tools/lib/repository/sdlc-mirror.js')` does not contain `"preserve any extra top-level keys"` |
| Indexer deleted             | Same file                                               | Filesystem                      | `fs.existsSync('tools/lib/repository/indexers/sdlc-status-indexer.js') === false`                               |
| Dashboard canonical-only    | `tests/integration/dashboard-canonical-shape.test.js`   | Headless DOM                    | Render against fixture with only `{tasks, log, programme}`; no `ReferenceError`; all regions populated          |
| JSON canonical-only on disk | `tests/integration/sdlc-status-canonical-shape.test.js` | Materialized-temp-root (L-0082) | Spawn `pv:upgrade` in tmpdir; assert `Object.keys(json).sort() === ['log','programme','tasks']`                 |

### 6.2 Migration 006 tests

| Scenario                        | Fixture                                            | Assertion                                                                           |
| ------------------------------- | -------------------------------------------------- | ----------------------------------------------------------------------------------- |
| State B → C (ingest happy path) | Full 9 legacy keys at top-level, empty programme   | All 9 rows present in `sdlc_programme`; values byte-identical to input              |
| State A (already canonical)     | Empty top-level legacy keys, populated programme   | No-op; migrations-applied row written; snapshot empty (or absent)                   |
| State C (divergence)            | Top-level `agents` differs from `programme.agents` | Warning logged via `warningsChannel`; SQL value unchanged                           |
| Idempotency                     | Run twice                                          | Second run returns `{skipped: 'idempotent'}`; no second snapshot                    |
| Rollback roundtrip              | State B → migrate → `pv:rollback`                  | On-disk JSON byte-identical to pre-migration state B                                |
| Snapshot completeness           | After state-B → C migration                        | `docs/.pv-backup/pre-upgrade-<ts>/sdlc-status.json` has all 9 legacy top-level keys |

### 6.3 Consumer migration tests

- `tests/integration/dashboard-reads-programme.test.js` — populated `programme.*`, empty top-level → dashboard renders fully.
- `tests/integration/dashboard-dual-read.test.js` — populated top-level, empty `programme.*` → dashboard renders fully (proves transitional fallback). Deleted in US-0261.
- `tests/tools/generate-plan-reads-programme.test.js` — assert `generate-plan.js` reads `sdlc.programme.stories[id].specPhase`.
- `tests/tools/init-sdlc-status-canonical-seed.test.js` — assert fresh `init-sdlc-status` output has populated `programme.*` and empty top-level legacy keys.
- `tests/repository/migrations-no-collision.test.js` — assert no two migration files share a numeric prefix across `tools/lib/repository/migrations/` and `tools/lib/migrations/`.

### 6.4 Coverage targets

- ≥80% on all changed code (AGENTS.md §8 baseline).
- ≥90% on `tools/lib/repository/sdlc-status-reader.js` and `tools/lib/repository/migrations/006-ingest-legacy-programme.js` (one-shot code that's painful to debug after the fact).

---

## 7. Risk Register

| #   | Risk                                                                                             | Likelihood                    | Impact                                                            | Mitigation                                                                                                                                                                                                                                                                                                                                     |
| --- | ------------------------------------------------------------------------------------------------ | ----------------------------- | ----------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| R1  | Missed consumer reading a legacy key (audit in §3 misses one)                                    | Medium                        | High — empty UI region or runtime error                           | Two safety nets: (a) transitional dual-read fallback in accessor masks the bug long enough for surveillance; (b) CI grep crawl: `grep -rn "\.(agents\|stories\|metrics\|epics\|phases\|cycles\|currentPhase\|githubStatus\|project)\b" tools/ docs/dashboard.html` and assert every hit reads via the accessor module. New violations fail CI. |
| R2  | Dashboard window: empty `programme.*` between US-0259 merge and Migration 006 run                | Medium                        | Medium — empty dashboard for any dev pulling `develop` in the gap | Transitional dual-read fallback in accessor (Section 4.1). Removed in US-0261.                                                                                                                                                                                                                                                                 |
| R3  | Migration 006 conflict between top-level and `programme.*` (state C divergence)                  | Low                           | Low — effectively impossible in normal operation                  | Warning channel logs `migration_006_conflict_{K}`; SQL value preserved; manual reconciliation if it ever fires                                                                                                                                                                                                                                 |
| R4  | Migration 006 corrupts SQL on partial failure                                                    | Low                           | Critical — production state loss                                  | Pre-006 snapshot captured BEFORE any SQL write; all 9 `set()` calls wrapped in a single SQLite transaction (partial failure rolls back, migrations-applied row absent, next `pv:upgrade` retries); `pv:rollback` restores from snapshot                                                                                                        |
| R5  | Mirror divergence between E.4 landing and any remaining consumer still reading top-level         | Low                           | Medium                                                            | US-0261 (E.4) is sequenced after US-0259 + US-0260 + US-0262 (Section 4.3) — enforced via PR review and orchestrator dispatch order                                                                                                                                                                                                            |
| R6  | Snapshot bloat: pre-006 snapshots persist on disk doubling archive size                          | Low                           | Low                                                               | Existing `pv:upgrade` snapshot rotation already prunes old snapshots; no new code needed                                                                                                                                                                                                                                                       |
| R7  | L-0080 ID-registry drift if US-0259..US-0263 claimed but spec PR doesn't merge same session      | Medium                        | Medium                                                            | Registry bump commit lands as part of the spec PR (first commit, pushed immediately); subsequent implementation PRs use already-claimed IDs                                                                                                                                                                                                    |
| R8  | L-0081 not actually resolved (rename creates a new collision elsewhere)                          | Low                           | Low                                                               | AC-1021 includes `tests/repository/migrations-no-collision.test.js`; CI fails if any two migration files share a numeric prefix anywhere under `tools/lib/`                                                                                                                                                                                    |
| R9  | L-0082 hidden gate trap: regression test passes because gitignored file masks the failure        | Medium                        | Medium                                                            | Two gates required for E.4: (a) code-presence grep against `sdlc-mirror.js` source; (b) materialized-temp-root behavior test that builds JSON from scratch                                                                                                                                                                                     |
| R10 | `init-sdlc-status` left writing legacy top-level — Migration 006 re-fires on every fresh project | Low (now that AC-1018 exists) | High if missed                                                    | AC-1018 explicitly asserts canonical seed shape; without it, this risk is High likelihood                                                                                                                                                                                                                                                      |

---

## 8. Out of Scope (Deliberate YAGNI)

Flagged here so the next phase author doesn't think these were oversights:

- **Decomposing `programme.*` into separate repos** (`SdlcAgentsRepo`, `SdlcMetricsRepo`, etc.). The "junk drawer" shape is structurally legitimate; reconsider in a future epic if any sub-key grows past ~1MB or develops query patterns that warrant typed columns.
- **Schema CHECK constraints on `sdlc_programme.key`** to enforce the 9-key allowlist. AC-1013 already requires writers to throw; a schema constraint would duplicate enforcement.
- **Migration 007+ collapsing `sdlc_programme` into typed columns.** Speculative; requires a real performance or query motivation.
- **`SdlcProgrammeRepo.setMany()` batched-write API.** Migration 006 is the only caller that would benefit; 9 mirror writes in a one-shot migration is acceptable. File as ENH if implementation reveals a real cost.
- **Dashboard polling-rate change.** The 5s polling loop in `generate-dashboard.js:4137` is unchanged; Phase E is a shape migration, not a transport migration.

---

## 9. Definition of Done

Phase E is complete when:

- [ ] All 5 stories (US-0259, US-0260, US-0261, US-0262, US-0263) have `Status: Done` in `docs/RELEASE_PLAN.md` with all ACs ticked.
- [ ] EPIC-0045 marked `Done`.
- [ ] All 4 hard-gate verification commands (Section 2) pass on `develop`.
- [ ] All tests pass (`npm test`); `npm run plan:lint` returns `0/0/0`; `npm run lint` clean.
- [ ] Coverage ≥80% on all changed code per AGENTS.md §8.
- [ ] `progress.md`, `MEMORY.md`, `PROMPT_LOG.md`, `MIGRATION_LOG.md`, `docs/LESSONS.md`, `docs/AI_COST_LOG.md` all updated per session-close checklist.
- [ ] Session memory written to `docs/memory/sessions/YYYY-MM-DD-session-58-phase-e-complete.md`.

---

## 10. Registry Claims (Confirmed)

This spec PR bumps `docs/ID_REGISTRY.md` to:

| Sequence | Was                    | Now                                      |
| -------- | ---------------------- | ---------------------------------------- |
| EPIC     | EPIC-0045 (next-avail) | EPIC-0046 — EPIC-0045 claimed            |
| US       | US-0259 (next-avail)   | US-0264 — US-0259..US-0263 claimed       |
| TASK     | TASK-0066 (next-avail) | TASK-0071 — TASK-0066..TASK-0070 claimed |
| AC       | AC-1015 (next-avail)   | AC-1023 — AC-1015..AC-1022 claimed       |

Per L-0080, the registry bump is part of this spec PR's first commit and pushed immediately. If this spec PR is abandoned, the bumps must be reverted before session close.

---

## 11. References

- **Prompt:** `docs/superpowers/plans/session-58-phase-e-prompt.md`
- **Phase D close-out:** `docs/memory/sessions/2026-05-22-session-57-phase-d-complete.md`
- **Phase D contracts:** `MIGRATION_LOG.md` (2026-05-22 block)
- **Lessons:** `docs/LESSONS.md` L-0075..L-0082 (especially L-0080, L-0081, L-0082)
- **Preservation block:** `tools/lib/repository/sdlc-mirror.js:32-43`
- **D.4 writer (programme bridge):** `tools/update-sdlc-status.js:56-72`
- **Programme repo:** `tools/lib/repository/entities/sdlc-programme-repo.js`
- **Migration 005 (the precedent):** `tools/lib/migrations/005-ingest-sdlc-status.js`
