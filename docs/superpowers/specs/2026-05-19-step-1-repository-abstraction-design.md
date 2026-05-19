# Step 1 — Repository Abstraction with Indexed SQLite + Upgrade Tooling

**Classification:** Design Spec
**Status:** Brainstormed 2026-05-19. Awaiting `writing-plans` → implementation plan → scheduling.
**Strategy doc:** [`docs/architecture/persistence-and-multi-user-strategy.md`](../../architecture/persistence-and-multi-user-strategy.md)
**Scope marker:** Single user, single machine. No identity, no server, no network. Upgrade tooling for existing PlanVisualizer-using projects is _included_ in this step.

---

## 0. Goal & Non-Goals

**Goal:** introduce a repository / data-access boundary between PlanVisualizer's tools and its storage, with three concrete deliverables:

1. **Markdown remains authoritative** for human-edited entities (Epic, Story, AC, Task, Bug, Lesson, TestCase, IdRegistry).
2. **SQLite becomes authoritative** for tool-emitted state (sdlc-status records, agent lifecycle events). The legacy `docs/sdlc-status.json` becomes a build artifact mirrored from SQLite, preserving the live-dashboard behaviour.
3. **A derived SQLite index** of markdown-authoritative entities, used for fast queries and tiered referential-integrity validation.

Plus a **migration framework** and `pv:*` commands that make this safely upgradable for existing users.

**Non-Goals (deferred to later steps):**

- Identity / multi-user / authorization (Step 2)
- Network repository, server, multi-machine (Step 3)
- Partition of `RELEASE_PLAN.md` into per-epic files, of `BUGS.md` by status, of `AI_COST_LOG.md` by date (Step 1.5; the abstraction makes those internal changes)
- Real-time collaborative editing (out of roadmap)
- Replacing markdown as the human-readable input format (out of roadmap)

---

## Section 1 — Architecture

A two-layer repository pattern sits between tools and the existing parsers in `tools/lib/`:

```
   ~10 tools (agent-lifecycle, generate-plan, agent-context,
   update-sdlc-status, sync-github, agent-spec-plan, ...)
          │
          ▼
   ┌─────────────────────────────────────────────┐
   │  Repository.getInstance()  (singleton)      │
   │  per-entity repos: stories, epics, acs,     │
   │  tasks, bugs, lessons, testCases, idRegistry│
   │  sdlcStatus, costs (read-only), coverage    │
   └────────────────┬────────────────────────────┘
                    │
        ┌───────────┼────────────┐
        ▼           ▼            ▼
   MarkdownDatastore  IndexDatastore  FileLockManager
   (markdown auth)    (.cache/.db)    (existing primitives,
        │              ▲                  becomes repo-internal
        │  reads via   │  write-through    in Phase F)
        │  existing    │  on same-process
        │  parsers     │  writes; refresh()
        ▼              │  on session start
   docs/*.md ──────────┘
   docs/sdlc-status.json ◄── exported from SQLite as build artifact
                              (write-through for live-dashboard parity)
```

**Three entity classes, three datastore behaviours:**

| Class                | Entities                                                                | Datastore                                       | Write path                                                                                           |
| -------------------- | ----------------------------------------------------------------------- | ----------------------------------------------- | ---------------------------------------------------------------------------------------------------- |
| **Human-authored**   | Epic, Story, AC, Task, Bug, Lesson, TestCase, IdRegistry                | Markdown authoritative + SQLite index (derived) | Repo writes markdown (AST-preserving serializer), then mirrors to SQLite within same transaction     |
| **Tool-emitted**     | SdlcStatus tasks, agent lifecycle events, programme block, dispatch log | SQLite authoritative                            | Repo writes SQLite row; also writes JSON mirror to `docs/sdlc-status.json` for live-dashboard parity |
| **Append-from-hook** | CostRow (`AI_COST_LOG.md`), Coverage (JSON)                             | Markdown / JSON append, repo read-only          | Hooks/external processes write directly; repo offers `list()` only                                   |

**Cache-coherence properties (the amended Option C from the brainstorm):**

- `repo.refresh()` runs on session start (mtime-incremental against `meta_sources` table).
- Within a single writing process, writes are reflected immediately in the index (no own-stale-read possible).
- Across processes, an `fs.watch` on `docs/` triggers incremental rebuild during live sessions.
- ID allocation and task claim semantics **always bypass the index** — they read markdown under a write lock to avoid stale-read corruption.
- Validation errors block writes; warnings log to `.cache/repo-warnings.jsonl`; reports surface via `npm run plan:lint`.

---

## Section 2 — Schema, Components & API

### 2.1 Entity model (SQLite tables)

```sql
-- Core planning entities (markdown-authoritative, mirrored to SQLite)
epics(id PK, title, status CHECK, release_target, source_file, source_line, source_hash);
stories(id PK, epic_id FK, title, status CHECK, priority, estimate, branch,
        pr_number, spec_path, plan_path, source_file, source_line);
acs(id PK, story_id FK, checked INT, text, position INT);
planning_tasks(id PK, story_id FK, status);
bugs(id PK, status CHECK, severity, source_file, source_line);
lessons(id PK, text, source_file, source_line);
test_cases(id PK, story_id FK, title, status);
id_registry(sequence PK, next_id, last_assigned);

-- Normalised references (so SQL enforces referential integrity)
story_dependencies(story_id FK, depends_on_story_id FK);
epic_dependencies(epic_id FK, depends_on_epic_id FK);
lesson_agents(lesson_id FK, agent_name);
bug_stories(bug_id FK, story_id FK);

-- Tool-emitted (SQLite-authoritative)
sdlc_tasks(id PK, story_id, agent, status, started_at, completed_at,
           plan_task_index, summary, model, model_rationale,
           task_review_json, base_sha, head_sha);
sdlc_events(id PK AUTOINCREMENT, ts, kind, story_id, agent, payload_json);
sdlc_programme(key PK, value_json);  -- programme conductor state (post-EPIC-0031)

-- Read-only (append-from-hook)
cost_rows(ts, session_id, tokens_in, tokens_out, model, story_id, source_file);
coverage(snapshot_at, statements_pct, branches_pct, functions_pct, lines_pct);

-- Meta (cache coherence + observability)
meta_sources(path PK, mtime, size, hash, last_indexed);
meta_status(key PK, value);
   -- 'schema_version', 'stale', 'refreshing', 'committing', 'built_at'
warnings(id PK AUTOINCREMENT, ts, level, entity_id, source_file, message);
```

Indexes on FK columns and on commonly-queried fields (`stories(epic_id, status)`, `acs(story_id)`, `sdlc_events(story_id, ts)`, etc.).

### 2.2 On-disk component layout

```
tools/lib/repository/
  index.js                       # Repository.getInstance() singleton
  markdown-datastore.js          # AST-aware read/write of markdown files
  index-datastore.js             # SQLite ops (better-sqlite3, WAL mode)
  refresh.js                     # mtime-based incremental rebuild
  validation.js                  # tiered rules — errors / warnings / reports
  warnings-channel.js            # writes to .cache/repo-warnings.jsonl
  id-allocator.js                # ID_REGISTRY direct read/write under lock
  transactions.js                # multi-entity transaction primitive
  ast/
    parser.js                    # markdown → ordered AST of [Prose, FencedBlock]
    serializer.js                # ordered AST → markdown (byte-preserving)
  entities/
    base-repo.js                 # generic EntityRepo<T> CRUD
    story-repo.js                # uses base + custom queries
    epic-repo.js                 # ...
    ac-repo.js
    task-repo.js
    bug-repo.js
    lesson-repo.js
    test-case-repo.js
    id-registry-repo.js          # bypasses index for allocate()
    sdlc-status-repo.js          # SQLite-authoritative; JSON mirror via export
    cost-row-repo.js             # read-only
    coverage-repo.js             # read-only
  migrations/                    # SQLite schema migrations
    001_initial_schema.sql
    002_normalised_refs.sql
    ...
  internal/
    file-lock.js                 # moved here in Phase F (with deprecation shim)
    atomic-write.js
```

### 2.3 API style

Sync (matches all current tools; uses `better-sqlite3`'s sync API). Per-entity. Function-update for mutations so the repo re-reads under lock and applies the diff atomically.

```js
const repo = Repository.getInstance();

// Reads — fast path through index after refresh()
const story = repo.stories.get('US-0187');
const planned = repo.stories.list({ epicId: 'EPIC-0030', status: ['Planned','In Progress'] });

// Writes — function-update under lock, AST-preserving serializer
repo.stories.update('US-0187', (s) => {
  s.status = 'In Progress';
  s.branch = 'feature/US-0187-registry';
});

// Multi-entity transactions
repo.transaction((tx) => {
  const acIds = tx.idRegistry.allocate('AC', 5);   // ['AC-0853'..'AC-0857']
  tx.stories.create({ id: 'US-0215', epicId: 'EPIC-0036', title: ..., status: 'Planned' });
  tx.acs.createMany(acIds.map((id, i) => ({ id, storyId: 'US-0215', text: ..., position: i })));
});

// ID allocation outside a transaction — still goes through markdown under lock
const next = repo.idRegistry.allocate('AC');       // 'AC-0853'

// Read-only entities
const costs = repo.costs.list({ storyId: 'US-0187' });   // may be one session stale

// Cache control
const result = repo.refresh();
// → { sources: ['RELEASE_PLAN.md', 'BUGS.md'], entitiesAffected: ['stories','acs','bugs'] }

// SdlcStatus — SQLite-authoritative, with JSON mirror written on each event
repo.sdlcStatus.recordEvent({ kind: 'agent-start', storyId: 'US-0187', agent: 'Forge', ... });
// internally: INSERT INTO sdlc_events ...; then export JSON to docs/sdlc-status.json
```

### 2.4 Key design choices

| Choice                                                                       | Reason                                                                                                                                              |
| ---------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------- |
| **`better-sqlite3`** (primary)                                               | Synchronous matches all current tools; prebuilds for darwin/linux/win; fastest Node option                                                          |
| **`node:sqlite` fallback**                                                   | Native build fails on niche platforms; Node 22+ built-in (via `--experimental-sqlite` until Node 24). Detected at install; documented manual switch |
| **`--no-index` legacy mode**                                                 | Final fallback if neither binding is available; runs parse-on-every-read; degraded performance, full functionality                                  |
| **WAL mode**                                                                 | Concurrent readers + one writer; required for the agent-mesh access pattern                                                                         |
| **AST-preserving markdown writes**                                           | Prose between fenced blocks is preserved verbatim; only the targeted block is rewritten                                                             |
| **Singleton via `getInstance()`**                                            | Prevents two in-process caches from drifting                                                                                                        |
| **Source provenance columns** (`source_file`, `source_line`) on every entity | Validation errors point at exact markdown locations; survives the Step 1.5 partition layout change                                                  |
| **Normalised join tables** for dependencies, agent tags, bug↔story refs      | SQL catches orphan refs at write time; honours the integrity goal                                                                                   |
| **Function-update mutation API**                                             | Repo re-reads from markdown inside the lock before applying the diff — eliminates the lost-write-on-stale-read pattern                              |
| **Multi-entity transactions in Step 1 scope**                                | Story creation is _always_ multi-entity; deferring this would leave every new-story call with a partial-failure window                              |
| **Validation tiers** — errors (block), warnings (log), reports (`plan:lint`) | Catches real corruption (duplicate IDs, invalid enums) without blocking legacy data                                                                 |

---

## Section 3 — Migration Path (Phases A–F)

Six phases, each independently shippable. **No file is in mixed-mode at any point** — a file is either fully repo-managed or fully not.

| Phase                                             | What ships                                                                                                                                                                                                                                                                 | Hard gate                                                                                                                                            | T-shirt |
| ------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------- | ------- |
| **A — Foundation**                                | `tools/lib/repository/` skeleton, base class, both datastores, migration framework (`tools/lib/migrations/`), `meta_*` tables, `.cache/` setup, AST parser, round-trip test harness, `pv:check-upgrade` / `pv:doctor` (read-only), better-sqlite3 smoke test on dev matrix | Every existing markdown source round-trips idempotent-on-second-pass (byte-identical after Migration 001 normalisation in E)                         | M       |
| **B — Indexer as spectator**                      | `tools/generate-plan.js` _also_ emits the index after build; warnings channel writes to `.cache/repo-warnings.jsonl`; `npm run plan:lint` reports; tier classification PR (which rules are errors vs warnings vs reports)                                                  | Full session produces index consistent with markdown; warnings rate < 10/session on real data                                                        | S       |
| **C — First read consumer**                       | Dashboard rendering reads from `repo.stories.list(...)`, etc., instead of re-parsing files                                                                                                                                                                                 | Snapshot test: rendered dashboard byte-identical to pre-migration output                                                                             | M       |
| **D — SdlcStatus cutover (SQLite-authoritative)** | `agent-lifecycle.js`, `update-sdlc-status.js`, `agent-task-review.js`, `agent-spec-plan.js` migrate. SQLite is authoritative; `docs/sdlc-status.json` is mirrored on every event for live-dashboard parity. **Migration 002** ingests existing JSON on first run           | All existing integration tests pass; no tool writes JSON directly; dashboard live-update parity holds                                                | XL      |
| **E — Planning writers**                          | All tools that mutate `RELEASE_PLAN.md` / `BUGS.md` / `LESSONS.md` / `TEST_CASES.md` / `ID_REGISTRY.md` migrate. **Migration 001** (normalisation) runs as a pre-Phase-E one-shot; user reviews diff explicitly                                                            | Round-trip + prose-preservation tests pass against the current production files (post-001); no markdown-write-via-fs outside `tools/lib/repository/` | XL      |
| **F — Lock-down + strict validation**             | `file-lock.js` moves to `internal/` with a deprecation shim at the old path. CI check forbids `fs.write*` against managed files outside the repo. Validation switches errors-tier from log-and-pass to fail-on-error                                                       | CI green on a clean main; orphan-ref count == 0                                                                                                      | M       |

**Total realistic effort: ~14–19 weeks single-developer, or ~7-9 sprints with the agent pipeline** (including Section 4 upgrade work which is woven through Phases A, D, E).

### 3.1 Two cutover moments worth drawing

**Phase D — SdlcStatus event flow:**

```
BEFORE Phase D:                      AFTER Phase D:
agent dispatch                       agent dispatch
   │                                    │
   ▼                                    ▼
fs.write(sdlc-status.json)           repo.sdlcStatus.recordEvent(...)
~50–200ms                               │
one file lock                           ├─► INSERT INTO sdlc_events (microseconds)
full rewrite                            └─► fs.write(sdlc-status.json) mirror
                                            (live-dashboard parity, smaller payload)
```

**Phase E — Story creation flow:**

```
BEFORE Phase E:                      AFTER Phase E:
add new story                        add new story
   │                                    │
   ▼                                    ▼
parse 4k lines, splice,              repo.transaction(tx => {
serialise 4k lines, write              const ids = tx.idRegistry.allocate('AC', 5);
                                       tx.stories.create({...});
                                       tx.acs.createMany(...);
                                     });
                                     AST-preserving serializer rewrites only
                                     the affected block; surrounding prose
                                     unchanged. Single multi-file lock.
```

### 3.2 Migration-period risks (and mitigations)

| Risk                                                 | Window               | Mitigation                                                                                                                                    |
| ---------------------------------------------------- | -------------------- | --------------------------------------------------------------------------------------------------------------------------------------------- |
| Mixed-mode writers race on a file                    | Phases C–E           | Hard gate: file enters repo management only when _all_ its writers migrate together in one PR                                                 |
| Round-trip serializer drift discovered in production | Phase E first commit | Run Phase E serializer against a _copy_ of production markdown first; require byte-identical re-serialise (post-Migration 001) before cutover |
| SdlcStatus schema misses a nested field              | Phase D              | Snapshot fixtures from real sessions; assert JSON-mirror output matches pre-migration JSON                                                    |
| Agents started during a refresh see partial state    | Phases B+            | `meta_status('refreshing', pid)` flag with timeout-and-retake                                                                                 |
| Schema migration deploys before code does in dev     | Phases A+            | `meta_status.schema_version` checked on open; mismatch triggers full rebuild from markdown — cache is disposable                              |
| WAL files (`-wal`, `-shm`) outlive crashes           | Phases A+            | `.cache/` cleanup script must not `rm` mid-session; auto-recovery on next open handles it                                                     |
| Two-process `refresh()` race                         | Phases B+            | `meta_status('refreshing', pid)` + `fs.watch` during live sessions; refresh is single-threaded per process                                    |
| AI_COST_LOG hook bypasses repo by design             | Always               | `plan:lint` exempts this file from the "no writes outside repo" check explicitly                                                              |

### 3.3 Step 1.5 hand-off (what partition looks like after F)

Once F is in, the partition decisions become internal datastore-layout concerns. The repository API is invariant.

| Source today                   | Partition (Step 1.5)                      | Implementation notes                                                                                 |
| ------------------------------ | ----------------------------------------- | ---------------------------------------------------------------------------------------------------- |
| `RELEASE_PLAN.md`              | `docs/release-plan/EPIC-XXXX.md` per-epic | Layout change is repo-internal; user-visible layout change requires migration guide + `MIGRATION.md` |
| `TEST_CASES.md`                | Mirror per-epic                           | Same                                                                                                 |
| `BUGS.md`                      | `BUGS_Open.md` + `BUGS_Done.md`           | Cross-status transitions are now safe because Step 1 provides multi-entity transactions              |
| `AI_COST_LOG.md`               | `AI_COST_LOG/YYYY-MM.md`                  | Independent of repo (append-from-hook)                                                               |
| `sdlc-status.json`             | Already SQL rows (Phase D)                | n/a                                                                                                  |
| `LESSONS.md`, `ID_REGISTRY.md` | Keep single                               | Partition has no benefit                                                                             |

---

## Section 4 — Upgrade & Migration

PlanVisualizer is installed into other projects via `scripts/install.sh` and `scripts/update.sh`. Existing users with hand-edited markdown files must be able to upgrade to v2.5.0 (Step 1) without breakage, prose mutation, or data loss.

### 4.1 Upgrade scenarios that must work

| ID     | Scenario                                          | Resolution path                                                                                                                                                                                       |
| ------ | ------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **S1** | Fresh install on a new project                    | `pv:upgrade` is a no-op against an empty `docs/`; index builds clean                                                                                                                                  |
| **S2** | Upgrade v2.4.x → v2.5                             | Migration 001 (normalisation) takes a backup, runs the AST serializer pass, user reviews the diff                                                                                                     |
| **S3** | Upgrade v2.5 (Phase D) → v2.5.x (Phase E)         | Migration 001 runs at this point if not earlier; idempotent                                                                                                                                           |
| **S4** | Upgrade across Step 1 → Step 1.5 (partition)      | Migration 003 is _opt-in_ (`pv:upgrade --partition`); explicit warning; backup + `MIGRATION.md` produced                                                                                              |
| **S5** | Mixed-version team (one dev on v2.4, one on v2.5) | `.pv-state.json` mismatch logs WARNING on every tool invocation; v2.4 dev's tools still work (legacy parser is permissive); v2.5 dev's index goes stale on cross-version edits, caught by `refresh()` |
| **S6** | Downgrade v2.5 → v2.4                             | `.cache/` deleted; markdown still parses with v2.4's legacy parser (post-Migration-001 markdown is a strict subset of what v2.4 accepted)                                                             |
| **S7** | Skipping versions (v2.3 → v2.6)                   | All applicable migrations run in order; pre-flight in `pv:check-upgrade` lists them                                                                                                                   |
| **S8** | Platform without better-sqlite3 prebuilds         | Install detects, falls back to `node:sqlite` (Node 22+) or `--no-index` legacy mode; documented `npm rebuild` recovery                                                                                |
| **S9** | User hand-edited `sdlc-status.json` (rare)        | Migration 002 ingests; unknown fields surface as warnings, not silent drop                                                                                                                            |

### 4.2 Migration framework (`tools/lib/migrations/`)

Distinct from SQLite schema migrations (which live under `tools/lib/repository/migrations/` and run on the index automatically). **Project-state migrations** operate on the user's docs.

```
tools/lib/migrations/
  index.js                              # detect state, run ordered migrations
  pv-state.js                           # read/write docs/.pv-state.json
  backup.js                             # backup to docs/.pv-backup/<version>/
  001-normalise-fenced-blocks.js        # one-time pre-Phase-E normalisation
  002-ingest-sdlc-status.js             # JSON → SQLite ingest, idempotent
  003-partition-release-plan.js         # Step 1.5 partition; opt-in
```

Each migration:

- Declares a `fromVersion` and `toVersion`.
- Is **idempotent** — running twice produces the same result; running on already-migrated data is a fast no-op.
- Takes a **backup** before mutating files into `docs/.pv-backup/<version>/<filename>`.
- Logs each step to `progress.md` as structured rows.
- Has a `rollback()` function where mechanically possible; explicitly one-way migrations are flagged.

State persisted at `docs/.pv-state.json` (project-local, gitignored):

```json
{
  "planvisualizerVersion": "2.5.0",
  "appliedMigrations": ["001-normalise-fenced-blocks", "002-ingest-sdlc-status"],
  "lastUpgradeAt": "2026-05-19T14:00:00Z",
  "backupsDir": "docs/.pv-backup/"
}
```

### 4.3 User-facing commands

| Command                              | Purpose                                                                                                                             | Safety                                                      |
| ------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------- |
| `npm run pv:check-upgrade`           | Pre-flight: detects current state, lists migrations that would run, reports risks (warnings, prose changes, partition implications) | **Read-only**; no mutation                                  |
| `npm run pv:upgrade`                 | Verifies clean git state → takes backup → runs migrations in order → updates `.pv-state.json` → prints next-steps                   | Refuses if uncommitted changes exist; `--force` to override |
| `npm run pv:upgrade --partition`     | Opt-in Step 1.5 partition migration                                                                                                 | Prints big warning; one-way unless backup restored          |
| `npm run pv:rollback --to <version>` | Restores from `docs/.pv-backup/<version>/`                                                                                          | One-step-back only; logs each restore                       |
| `npm run pv:doctor`                  | Diagnoses current state vs expected state for installed version; reports drift                                                      | Read-only                                                   |

### 4.4 Per-phase additions for upgrade tooling

- **Phase A** also ships `pv:check-upgrade` and `pv:doctor` (read-only, safe). The migration framework skeleton lands here.
- **Phase B** classifies warnings into "would-block-Phase-E-without-Migration-001" vs other; that classification surfaces in `pv:check-upgrade`.
- **Phase D** ships Migration 002 (`ingest-sdlc-status`). Idempotent: hash JSON before, skip if already ingested. Unknown fields surface as warnings, not silent drops.
- **Phase E** ships Migration 001 (`normalise-fenced-blocks`). `pv:upgrade` runs it; the resulting diff is the user's responsibility to review and commit.
- **Phase F** adds the mixed-version mismatch warning. Every tool invocation reads `.pv-state.json` + `package.json#version`; mismatch logs a one-line WARNING (suppressible by `--force`).

### 4.5 Integration with `scripts/update.sh`

`scripts/update.sh` is amended in Phase A to:

1. Run `git pull` (existing).
2. Run `npm install` (existing).
3. Run `npm run pv:check-upgrade` (new) and abort if it reports blocking issues.
4. Print: "Run `npm run pv:upgrade` to apply project-state migrations, or `npm run pv:doctor` if you want details first."
5. Do NOT auto-run `pv:upgrade` — it mutates user data and must be explicit.

### 4.6 `better-sqlite3` fallback chain

```
preferred:  better-sqlite3 (prebuild present)
fallback 1: better-sqlite3 (source build, requires build-essential / VS Build Tools)
fallback 2: node:sqlite (Node 22+, --experimental-sqlite until Node 24)
fallback 3: --no-index legacy mode (parse markdown every time, no SQLite at all)
```

Detection happens at install (postinstall script) and at first `Repository.getInstance()`. Fallback 3 is functional but slower — used as a graceful degradation rather than an error.

---

## Section 5 — Risk Register (consolidated)

| Category        | Risk                                                            | Mitigation                                                                                              |
| --------------- | --------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------- |
| **Corruption**  | Mixed-mode access during migration period                       | Hard gates per phase; CI check in F                                                                     |
| **Corruption**  | Split-brain on write failure (markdown OK, index throws)        | `meta_status('stale', 1)` set before index write; rebuild on next open                                  |
| **Corruption**  | Hand-edited markdown introducing duplicates                     | `fs.watch` during live sessions + `refresh()` on session start                                          |
| **Corruption**  | Round-trip drift in parsers vs serializers                      | AST parser + byte-identical round-trip tests as Phase A gate; per-file gate in Phase E                  |
| **Corruption**  | Two-process `refresh()` race                                    | `meta_status('refreshing', pid)` + timeout-and-retake                                                   |
| **Performance** | Write amplification from markdown rewrite + SQLite mirror       | Negligible at human scale; AST serializer rewrites only affected blocks (not whole file) at story scale |
| **Performance** | File-lock contention is the _real_ concurrency bottleneck       | Mostly addressed via SdlcStatus → SQLite in Phase D; remainder is Step 1.5 partition work               |
| **Performance** | First-session refresh cost grows with corpus                    | mtime-incremental from day one (`meta_sources.mtime`)                                                   |
| **Performance** | Single 4k-line markdown rewrite cost                            | AST serializer rewrites only affected blocks; near-O(1) per write                                       |
| **Upgrade**     | Existing user's hand-edited files don't survive first write     | Migration 001 normalises explicitly; user reviews diff                                                  |
| **Upgrade**     | better-sqlite3 native build fails on niche platforms            | Three-tier fallback chain; degraded but functional                                                      |
| **Upgrade**     | Mixed-version teams write inconsistently                        | Loud WARNING on every tool invocation if `.pv-state.json` ≠ `package.json#version`                      |
| **Future**      | Step 1.5 partition changes user-visible layout                  | Opt-in `--partition` flag; `MIGRATION.md` and `INDEX.md` ship with it                                   |
| **Future**      | Sync API has to become async at Step 3                          | Acknowledged; API surface change deferred until Step 3                                                  |
| **Future**      | `.cache/planvisualizer.db` schema is not a long-term commitment | `.cache/` is gitignored; format may change at any step boundary                                         |

---

## Section 6 — Verification

### 6.1 Phase gates (objective)

- **A:** Every existing markdown source round-trips idempotent-on-second-pass. better-sqlite3 smoke passes on darwin/linux/win matrix.
- **B:** Index emitted by `generate-plan.js` is consistent with markdown across a full real session. Warnings < 10/session on production data.
- **C:** Dashboard render byte-identical to pre-migration output (snapshot test).
- **D:** All existing integration tests pass. `sdlc-status.json` mirror byte-identical to pre-migration output for the same event stream. No tool writes JSON directly (grep audit).
- **E:** Round-trip tests pass on production files (post-Migration-001). Per-file gate: re-serialisation byte-identical. No `fs.write*` outside `tools/lib/repository/` (lint rule).
- **F:** CI green on clean main. `repo.warnings` count of orphan refs == 0 on a clean checkout.

### 6.2 Upgrade verification (CI matrix)

- Fixture project on v2.4.0 → `npm install planvisualizer@2.5.0` → `pv:upgrade` → assert all migrations applied, no data loss, dashboard renders.
- Same matrix on macOS-arm64, linux-x64, linux-arm64, windows-x64.
- Fallback chain: simulate `better-sqlite3` build failure, assert `node:sqlite` path works; simulate both unavailable, assert `--no-index` legacy mode runs.

### 6.3 Self-verification of this spec

- Sections 1-4 referenced in the implementation plan with explicit traceability.
- Risk register cross-checked against critique exchanges from the brainstorm session.
- No "TBD" or vague requirements (verified at write time; placeholders removed).
- Scope explicitly excluded items listed in §0 and §3.3.

---

## Section 7 — Deliverables Checklist

When Step 1 ships, the following exist:

- [ ] `tools/lib/repository/` populated per §2.2
- [ ] `tools/lib/migrations/` populated per §4.2
- [ ] `.cache/` gitignored
- [ ] `docs/.pv-state.json` gitignored
- [ ] `docs/.pv-backup/` gitignored
- [ ] `package.json` adds `better-sqlite3` (with `node:sqlite` and `--no-index` fallbacks documented)
- [ ] `npm run pv:check-upgrade`, `pv:upgrade`, `pv:rollback`, `pv:doctor` scripts
- [ ] `npm run plan:lint` script
- [ ] `npm run plan:index` script (manual rebuild)
- [ ] All ~10 storage-touching tools migrated to use the repository
- [ ] `scripts/update.sh` amended to run `pv:check-upgrade`
- [ ] AGENTS.md and CLAUDE.md updated with the new persistence rules (no `fs.write*` against managed files)
- [ ] Round-trip and integration tests at ≥80% coverage per project standard
- [ ] CI matrix for darwin/linux/windows
- [ ] Documentation: README section, migration guide, `pv:*` command reference

---

## Section 8 — What this spec does NOT decide

- Specific implementation order of _individual tools_ within Phases D and E (lives in the implementation plan from `writing-plans`).
- Exact warning thresholds for the tiered validation rules (Phase B's tier classification PR).
- The HTML format of `plan:lint` output (lives in implementation).
- The exact UX of `pv:upgrade` interactive prompts (lives in implementation).
- Whether to ship Step 1 as v2.5.0 or as a v2.5.0-beta.x sequence (release management decision at ship time).

---

## References

- Strategy: `docs/architecture/persistence-and-multi-user-strategy.md`
- Multi-team architecture: `docs/architecture/enterprise-agentic-sdlc-spec-v2.md`
- Existing persistence primitives: `tools/lib/file-lock.js`, `tools/lib/atomic-write.js`, `tools/lib/git-safe.js`
- Existing parsers (read side of MarkdownDatastore): `tools/lib/parse-bugs.js`, `tools/lib/parse-cost-log.js`, `tools/lib/parse-coverage.js`, the inline parser in `tools/generate-plan.js`
- Brainstorm session transcript: 2026-05-19 session log

---

_Brainstormed 2026-05-19. Next step: `writing-plans` skill converts this spec into a detailed implementation plan; that plan is then scheduled into `docs/RELEASE_PLAN.md` as epics/stories/ACs through the normal planning ritual._
