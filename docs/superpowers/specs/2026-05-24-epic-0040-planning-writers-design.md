# EPIC-0040 — Planning Writers (Design Spec)

**Epic:** EPIC-0040 — Step 1 Persistence — Planning Writers ("Phase E sibling" to EPIC-0045)
**Date:** 2026-05-24
**Status:** Draft (pending PR review)
**Predecessors:** EPIC-0045 close-out — `docs/memory/sessions/2026-05-24-session-59-phase-e-complete.md`
**Stories:** US-0240 .. US-0247 (8 stories, pre-allocated in `RELEASE_PLAN.md:4429-4554`)
**ACs:** AC-0938 .. AC-0963 (26 ACs, pre-allocated)
**Naming note:** the original Step 1 roadmap labelled this work "Phase E" — but EPIC-0045 (Consumer Migration & Cleanup, now shipped) was also labelled "Phase E." This doc disambiguates by referring to this epic as **"Phase E (Planning Writers, EPIC-0040)"** at first mention. The other "Phase E" (Consumer Migration, EPIC-0045) is done; live "Phase E" work means EPIC-0040 unless otherwise stated.

---

## 1. Context

EPIC-0045 shipped the **reader-side** half of Phase E: a dual-read accessor (`tools/lib/repository/sdlc-status-reader.js`), dashboard + non-dashboard consumer migrations, canonical init seed, Migration 006 (legacy top-level → SQL), and the three deletions that closed the four Phase E hard gates. The on-disk `docs/sdlc-status.json` is now a pure function of SQL state.

EPIC-0040 is the **writer-side** half. The planning entities that live in human-edited markdown files (`docs/RELEASE_PLAN.md`, `docs/BUGS.md`, `docs/LESSONS.md`, `docs/TEST_CASES.md`, `docs/ID_REGISTRY.md`) gain typed write APIs: `repo.stories.update(id, fn)`, `repo.bugs.create(...)`, `repo.idRegistry.allocate(...)`, etc. Three remaining writer tools (`tools/agent-context.js`, `tools/generate-plan.js`, `tools/sync-github.js`) migrate from direct `fs.writeFileSync` calls to the repo API. A migration normalises the existing markdown so post-EPIC-0040 writes start from a canonical baseline. A transaction wrapper (`repo.transaction((tx) => ...)`) batches markdown mutations across multiple entities atomically.

EPIC-0040 sets up **EPIC-0041 (Phase F — Lock-Down)** to enforce "no `fs.write` to managed paths outside the repo" via a custom ESLint rule. Phase F is structurally impossible until the three consumer migrations (US-0244, US-0245, US-0246) land here.

---

## 2. Hard Gates

Verbatim from the original Step 1 plan + AC-0963:

1. **Round-trip byte-identity** — `tests/integration/repository/round-trip.test.js` asserts byte-identical (not just idempotent) output after Migration 001 has normalised the corpus.
2. **No direct writes to managed paths in the three migrated tools** — `grep -nE "fs\.write|fs\.append" tools/agent-context.js tools/generate-plan.js tools/sync-github.js` returns only writes to exempt paths (test fixtures, debug output, etc.).
3. **plan:lint zero errors** — `npm run plan:lint` reports `0/0/0`.
4. **All existing tests pass** — including the three per-consumer integration suites that gate US-0244/0245/0246.

EPIC-0040 is not complete until all four gates pass on `develop`.

---

## 3. Architecture

### 3.1 Component map

```
tools/lib/repository/
├── serializers/                          ← NEW (per-entity)
│   ├── _fence-utils.js                   ← shared: delimiter, line-width, escape
│   ├── story-serializer.js
│   ├── epic-serializer.js
│   ├── ac-serializer.js
│   ├── bug-serializer.js
│   ├── lesson-serializer.js
│   ├── test-case-serializer.js
│   └── task-serializer.js
├── entities/                             ← existing (read APIs from Phases B/C/D)
│   ├── story-repo.js                     ← gain .update(id, fn) + .create(entity)
│   ├── epic-repo.js                      ← same
│   ├── ac-repo.js                        ← same
│   ├── bug-repo.js                       ← same
│   ├── lesson-repo.js                    ← same
│   ├── test-case-repo.js                 ← same
│   └── task-repo.js                      ← same
├── id-allocator.js                       ← NEW (file-locked ID_REGISTRY.md mutator)
├── transaction.js                        ← NEW (batched multi-entity tx wrapper)
└── (existing files unchanged)

tools/lib/migrations/
└── data_001-normalise-fenced-blocks.js   ← NEW (one-shot AST round-trip)

tools/                                    ← MODIFIED (3 consumer migrations)
├── agent-context.js                      ← task-summary write via repo.sdlcTasks.upsert
├── generate-plan.js                      ← status patches via repo.stories.update
└── sync-github.js                        ← PR-number writes via repo.stories.update
```

### 3.2 Per-entity serializer architecture (design call resolved)

Each entity gets its own `<entity>-serializer.js` exporting `serialize(entity) → fenced-block string`. The seven serializers share a small `_fence-utils.js` for the cross-entity commonality (fence delimiter, line-width rule, escape handling, ID-line formatting).

**Rationale:** the entities differ in non-trivial ways (stories embed AC checkbox lists, bugs have multi-line `Steps:` fields, lessons have free-form prose, `ID_REGISTRY` is a table). A "shared engine with per-entity schemas" would have to absorb every entity's quirks and become a complex DSL — generality is a debt. Per-entity matches the existing parser layout (`tools/lib/parse-{release-plan,bugs,lessons,test-cases,...}.js`) so the next reader's mental model stays symmetrical.

Each `<entity>-serializer.js` is the **inverse** of its `parse-<entity>.js` counterpart, with a round-trip property unit test (`parse(serialize(parse(input))) === parse(input)` for every fixture).

### 3.3 Update flow — "anchored-block replacement," not AST manipulation

The phrase "AST-preserving" in AC-0942 oversells the mechanic. The actual update flow is simpler and worth being explicit about:

```
repo.stories.update('US-0001', s => { s.status = 'Done' })

  1. acquire withFileLock(RELEASE_PLAN.md)
  2. read full file (text)
  3. locate the fenced block whose first line matches ^US-0001\b
     (regex-anchored on the entity-ID line — every entity's serializer
      MUST emit a parseable ID-line as the first non-empty line)
  4. slice out just that block
  5. parse it via parse-release-plan.js → entity object
  6. apply fn(entity) → mutated entity
  7. serialize mutated entity via story-serializer.js → new block text
  8. character-for-character replace the original block range with
     the new block text
  9. write the full file back
 10. release lock
 11. mirror the mutated entity to SQL via the existing index path
```

"Byte-identical surrounding prose" (AC-0942) follows trivially: steps 8-9 only touch the matched block range; everything outside is untouched. This is **anchored-block replacement** — not AST traversal. The implementation is straightforward; the regression test is a fixture-driven assertion that surrounding prose (including blank lines, comments, fence whitespace) survives `update()` byte-for-byte.

### 3.4 `repo.transaction((tx) => ...)` — RYOW with lex-ordered lock acquisition

The transaction wrapper batches multi-entity, multi-file writes atomically. Design call resolved as **Read-Your-Own-Writes (RYOW)** — staged writes are visible to subsequent reads inside the same transaction.

**Mental model (matches SQL `BEGIN/COMMIT`):**

```js
await repo.transaction(async (tx) => {
  const story = tx.stories.get('US-0001'); // pre-tx state
  await tx.stories.update('US-0001', (s) => {
    s.status = 'Done';
  });
  const refetched = tx.stories.get('US-0001'); // RYOW: 'Done' (staged)
});
```

**Transaction context shape:**

```ts
type TxCtx = {
  sqliteTxBegun: boolean;
  stagedWrites: Map<EntityKey, FullEntity>; // for RYOW reads
  pendingFileMutations: Array<{
    path: string; // absolute path
    mutator: (currentText: string) => string; // applied at flush
  }>;
};
type EntityKey = `${EntityType}:${EntityId}`; // e.g., 'story:US-0001'
```

**Commit protocol:**

```
1. SQLite BEGIN DEFERRED (acquires lock only on first write)
2. Run user callback. During callback:
   - tx.X.get(id):
       if stagedWrites.has(`X:${id}`) return staged value (RYOW)
       else read from underlying repo (sees committed-at-tx-start state
            via SQLite snapshot isolation)
   - tx.X.update(id, fn) / tx.X.create(entity):
       a. read current entity (RYOW-aware)
       b. apply fn or use passed entity to compute newEntity
       c. validate via serializer (throws on invalid Status, dup ID, etc.)
       d. store newEntity in stagedWrites
       e. enqueue file mutator into pendingFileMutations (idempotent —
          multiple updates to the same path coalesce into one mutator
          chain)
       f. upsert the entity row into the SQLite index from newEntity,
          synchronously inside the SQLite tx. Reasons: (i) subsequent
          arbitrary SQL queries inside the tx see the new state — the
          stagedWrites Map only covers RYOW via tx.X.get(id), not
          general SQL queries; (ii) ROLLBACK undoes the index update
          via SQLite's transactional semantics; (iii) simpler than
          deferring index updates to commit.

          Note on terminology: "index update" here means upserting an
          entity row into a SQLite table from the entity object —
          opposite direction from Phase D's `SdlcMirror.write()`, which
          renders `docs/sdlc-status.json` FROM SQL. Different mechanism,
          different direction, same word used historically. The EPIC-0040
          codebase prefers "index update" for the planning-entity case
          and "mirror render" for the sdlc-status.json case.
3. End of callback (no throw):
   - Group pendingFileMutations by path
   - acquireMany(uniquePaths)        ← existing lib, lex-ordered, deadlock-free
   - For each path: read text → apply mutator chain → write text → close
   - Release file locks (acquireMany's returned release fn)
   - SQLite COMMIT
4. End of callback (throw):
   - Discard stagedWrites + pendingFileMutations
   - SQLite ROLLBACK
   - No file locks acquired (or any held are released)
   - Rethrow the original error
```

**Lock acquisition order (canonical definition for ddl freedom):**

- Locks are acquired in default JavaScript string sort order of **absolute paths** (UTF-16 code units; ASCII-equivalent for our paths).
- `tools/lib/repository/file-lock.js#acquireMany(files)` already implements this exact ordering: `[...new Set(files)].sort()`. The transaction wrapper uses `acquireMany` directly; does NOT invent its own ordering.
- Deadlock-free guarantee holds as long as every multi-file writer (the transaction wrapper, Migration 001, any future tool) acquires via `acquireMany` or sorts by the same rule.

**ID allocator inside a transaction (AC-0948):**

- `tx.idRegistry.allocate('US', count)` reserves the next `count` IDs in memory (bumps an in-tx counter) but does NOT write `ID_REGISTRY.md` until commit.
- At commit, the transaction wrapper synthesizes a single `ID_REGISTRY.md` mutator that bumps `next_id` and `last_assigned` to the highest reserved value (across all sequences touched in the tx). This becomes one of the file mutators in `pendingFileMutations`.
- Another process that calls `repo.idRegistry.allocate(...)` outside the transaction blocks on the `ID_REGISTRY.md` lock until our `COMMIT` releases it.

### 3.5 SQL/markdown atomicity gap (known limitation)

The commit protocol above flushes markdown writes BEFORE `SQLite COMMIT`. If `SQLite COMMIT` fails after markdown flush succeeds (rare — disk full, SQLite corruption), the on-disk markdown is fresher than SQL.

**This is non-atomic at the SQL/markdown boundary by design.** Two distinct authoritativeness models in play, depending on which entity is being written:

- **Planning entities** (stories, epics, ACs, bugs, lessons, test cases, planning tasks — touched by US-0245/US-0246 and the `repo.X.update(...)` API): markdown is authoritative (the human source of truth); SQL is a derived index. If the SQLite COMMIT fails after markdown flush succeeds, the next indexer pass (`npm run plan:index` or any other indexer-triggering action) re-syncs SQL from markdown. Self-healing.
- **`sdlc-status.json` entities** (tasks, log, programme — touched by US-0244 via `repo.sdlcTasks.upsert(...)` and the Phase D writer protocol): SQL is authoritative; the JSON file is a mirror re-rendered from SQL on every write. Here the SDLC mirror's atomicity story is Phase D / EPIC-0045's responsibility, not EPIC-0040's — `repo.sdlcTasks.upsert` already runs inside its own file-lock-and-mirror-write protocol. EPIC-0040's transaction wrapper does NOT need to provide additional atomicity for these writes; consumers calling `tx.sdlcTasks.upsert(...)` get the same mirror-on-every-write guarantee as before.

**Spec acknowledgment:** This trade-off is intentional. Full atomic SQL+markdown commit would require either two-phase commit infrastructure (heavy) or a write-ahead log (heavy). The "self-healing via next indexer pass" approach for planning entities, plus the existing Phase D protocol for `sdlc-status.json`, is proportional to the actual failure rate.

### 3.6 Callback-runs-while-SQLite-BEGIN-open hazard (documented guideline)

The transaction wrapper opens `BEGIN DEFERRED` at the START of the callback (not at commit). `DEFERRED` means SQLite acquires no lock until the first write inside the callback. Pure-read transactions therefore don't block other writers. But: as soon as the first write fires (typical case — transactions exist precisely to batch writes), SQLite holds a write lock until commit.

**Guideline (must be in module-level JSDoc of `transaction.js`):**

> Transaction callbacks must be minimal — stage your writes and return. Do NOT `await` network I/O, `fs.readFile` on unrelated files, or `setTimeout` inside `repo.transaction(...)`. A slow callback holds the SQLite write lock and blocks concurrent writers.

No enforcement at runtime; this is a documentation-only constraint. The plan's per-consumer integration tests (US-0244/0245/0246) implicitly validate by virtue of completing quickly — if a consumer hangs, it's because of this anti-pattern.

---

## 4. Component-specific notes

### 4.1 `id-allocator.js`

- API: `allocate(sequence, count = 1)` → `string | string[]`.
- Reads `docs/ID_REGISTRY.md` INSIDE `withFileLock(path)`, parses the row for `sequence` (e.g., `US`), bumps `next_id` by `count`, sets `last_assigned` to highest allocated, rewrites the row IN PLACE preserving column alignment (padding spaces to match the existing pipe-table layout).
- `count == 1` → returns a single string (e.g., `'US-0264'`).
- `count > 1` → returns an array of contiguous IDs (e.g., `['US-0264', 'US-0265', 'US-0266']`).
- Bypasses the SQLite index entirely. Rationale: ID_REGISTRY is meta-state, not entity-state; putting it in SQLite would create a bootstrap dependency cycle (the index needs IDs to exist before it can register them).
- Inside a transaction (`tx.idRegistry.allocate(...)`): reserves IDs in-memory, defers the registry mutation to commit. See §3.4 above.

### 4.2 `transaction.js`

- API: `repo.transaction(async (tx) => { ... })` → resolves with the callback's return value on commit, or rejects with the callback's thrown error on rollback.
- Implementation: see §3.4 commit protocol verbatim.
- Each entity repo gains an `<EntityRepo>InTransaction` helper (or — see §8 — an `update(id, fn, {tx})` parameter) that the transaction proxy delegates to. Stages writes into `ctx.pendingFileMutations` and `ctx.stagedWrites` instead of writing directly.
- The transaction proxy (`tx`) is a thin facade: `tx.stories` exposes `get`, `update`, `create`, `delete` matching the underlying entity repo but routed through the staging machinery.

### 4.3 Migration 001 — fence normalisation

**File:** `tools/lib/migrations/data_001-normalise-fenced-blocks.js` (using the `data_NNN-` naming convention from L-0081 / US-0263, even though this is a markdown migration not a JSON one — the runner regex `/^(?:data_)?\d{3}-.*\.js$/` accepts either form).

**Algorithm:**

```
For each managed file F in [RELEASE_PLAN, BUGS, LESSONS, TEST_CASES, ID_REGISTRY]:
  1. Read F's current text into `input`.
  2. Snapshot input to /tmp/docs-pre-norm/<basename>.
  3. Pass 1: parse(input) → entity objects → serialize(...) → `pass1output`.
  4. Pass 2: parse(pass1output) → entity objects → serialize(...) → `pass2output`.
  5. If pass1output !== pass2output: FAIL LOUD. Write a diff between the two
     to /tmp/docs-pre-norm/_pass1-vs-pass2-<basename>.diff and throw a
     SerializerStabilityError. This indicates a non-idempotent serializer
     bug; do not proceed.
  6. If pass2output === input: NO-OP for this file (already normalised).
     Do NOT write back (preserves mtime, avoids `git status` pollution).
  7. Else: write pass2output back to F. Print: "normalised F (snapshot
     at /tmp/docs-pre-norm/<basename>)".

After all files processed, print to stderr:
  ✅ Normalised N file(s). Review with:
       diff -r /tmp/docs-pre-norm/ docs/
     or just `git diff`
  Then `git commit` to keep the changes, or `git checkout .` to revert.
```

**Idempotency (AC-0951):** Step 6 guarantees a second run is a TRUE no-op (no mtime change, no `git status` entry). The check is content-based in memory, not file-stat-based.

**Human approval gate (AC-0952):** Procedural / git-as-gate. Design call resolved as Option A in the brainstorm. No interactive prompt; no `--apply` flag. The snapshot at `/tmp/docs-pre-norm/` plus the stderr guidance is the rollback affordance. `pv:upgrade` already refuses dirty trees by default (Phase D), so the migration cannot mix its changes with the user's in-progress work.

### 4.4 Pre-Migration-001 round-trip completeness audit (NEW)

**Risk:** if `parse-bugs.js` doesn't capture some field that `bug-serializer.js` would emit, the two-pass round-trip silently drops it. Production data could be permanently lost.

**Mitigation:** Before US-0243 (Migration 001) is allowed to land in production, US-0243 includes a **mandatory pre-step**: run the round-trip harness against ALL production markdown files. The audit produces a report (`/tmp/docs-pre-norm/_round-trip-audit.txt`) that for each file lists:

- Number of entities parsed.
- Number of fields per entity that re-serialise to a value !== the original substring.
- Per-divergence: the entity ID, the field name, the original value, the round-trip value.

If divergences exist, the human reviewer decides PER DIVERGENCE: fix the serializer to be lossless, OR document the field as intentionally dropped (e.g., legacy fields no longer in the schema).

This audit is a **prerequisite to running Migration 001 against production**, not a runtime check. It runs ONCE during US-0243 implementation; the resulting decisions are encoded as test fixtures in the round-trip harness for permanent regression.

### 4.5 Consumer migrations (US-0244, US-0245, US-0246)

**`tools/agent-context.js` (US-0244):** Any task-summary update becomes `repo.sdlcTasks.upsert(...)`. This is mostly already done via Phase D's writer migration; US-0244 is the cleanup pass that audits for any remaining `fs.write` to managed paths and routes them.

**`tools/generate-plan.js` (US-0245):** Status patches (e.g., the dashboard's "story moved to Done" UI affordance) become `repo.stories.update(id, s => { s.status = newStatus; })`. The patchDOM-driven status writer is the primary surface area. Some legacy markdown writes may need outright deletion (per AC-0958: "legacy markdown writes removed from generate-plan.js (or routed via repo)").

**`tools/sync-github.js` (US-0246):** PR-number updates from GitHub events become `repo.stories.update(id, s => { s.prNumber = N; })`. Multiple stories per sync invocation → use `repo.transaction(...)` for atomicity.

### 4.6 Collateral test risk (NEW — explicit budget)

The accessor strip in US-0261 caused ~33 collateral test failures (fixtures using legacy-shape JSON). EPIC-0040 has analogous risk: tests that build planning-entity fixtures via `fs.writeFileSync` directly and then run a tool that NOW expects the file to be repo-mediated will break.

**Likely candidates:**

- `tests/integration/agent-context-flow.test.js` (already touched in US-0261)
- `tests/integration/agent-spec-plan-flow.test.js`
- Any test under `tests/integration/repository/` that constructs planning entities

**Plan must explicitly budget time for collateral fixture refactors** in US-0244, US-0245, US-0246. Pattern from EPIC-0045: convert fixture writes to `repo.X.update(...)` in test setup OR explicitly mark as `bypass: fs.writeFileSync` exempt path. The Phase F (EPIC-0041) ESLint rule will need an exemption allowlist for tests anyway.

---

## 5. Story Sequencing

```
US-0240 (writer APIs + 7 serializers + entity-repo .update)  ──┐
US-0241 (id-allocator.js)                                    ──┼── parallel-safe
US-0243 (Migration 001 + pre-flight audit step)              ──┘   off develop

US-0242 (transaction.js)  ← depends on US-0240 + US-0241

US-0244 (agent-context.js migration)   ──┐
US-0245 (generate-plan.js migration)   ──┼── parallel-safe; all depend on US-0240
US-0246 (sync-github.js migration)     ──┘

US-0247 (Phase E hard gate — round-trip + grep) ← depends on US-0243 + 0244 + 0245 + 0246
```

**Suggested PR sequence:** 8 PRs, mirroring EPIC-0045's per-story shape:

1. US-0240 (largest — writer APIs + 7 serializers + .update on each repo)
2. US-0241 (small — id-allocator)
3. US-0243 (medium — Migration 001 + the audit pre-step)
4. US-0242 (medium — transaction.js)
5. US-0244 (small — agent-context cleanup)
6. US-0245 (medium — generate-plan migration; touches dashboard)
7. US-0246 (small — sync-github migration)
8. US-0247 (small — gate test + Phase E hard-gate audit)

**Estimate:** 2-3 sessions for full execution via the `subagent-driven-development` skill chain, modelled on the EPIC-0045 cadence.

---

## 6. Test Plan

### 6.1 Per-entity serializer unit tests (7 suites)

For each entity type, one test file: `tests/unit/repository/serializers/<entity>-serializer.test.js`. Asserts:

- **Round-trip property** — for every fixture entity, `parse(serialize(parse(input))) === parse(input)` (semantic equality, not byte equality — the parse step normalises whitespace).
- **Byte-stability property** — for every PRE-NORMALIZED fixture, `serialize(parse(input)) === input` (byte-identical, the post-Migration-001 invariant).
- **Validation throws on invalid fixtures** — invalid Status enum, missing required fields, duplicate IDs, malformed fence headers.

### 6.2 ID allocator tests

`tests/unit/repository/id-allocator.test.js`:

- Single allocation returns a string; `count > 1` returns a contiguous array.
- Concurrent allocations (two `allocate('US')` calls in `Promise.all`) return non-overlapping IDs (validates the file lock).
- Column alignment preserved after mutation (regex check on the rewritten row).
- Round-trip with `tools/lib/parse-id-registry.js` — registry remains parseable after every allocation.

### 6.3 Transaction tests

`tests/unit/repository/transaction.test.js`:

- **RYOW**: write `A=1`, read returns `1`. Subsequent write `A=2`, read returns `2`.
- **Snapshot isolation against external writes**: another process writes `A=99` mid-transaction; tx reads still return the staged value (RYOW) or the tx-start value (for unstaged reads).
- **Rollback**: throw inside callback → SQL rolled back AND markdown unchanged (no file mutation observable post-tx).
- **Lex-ordered lock acquisition**: mock `acquireMany`, transact across files `b.md`, `a.md`, `c.md`; assert `acquireMany` called with `['a.md', 'b.md', 'c.md']`.
- **Multi-entity atomicity**: `tx.stories.update + tx.acs.create + tx.idRegistry.allocate` all commit together (or all roll back together).
- **In-tx ID allocation deferred**: `tx.idRegistry.allocate('US', 3)` returns IDs but doesn't write `ID_REGISTRY.md` until commit; another process's `repo.idRegistry.allocate('US')` blocks until our tx commits.

### 6.4 Migration 001 integration test

`tests/integration/repository/migration-001-normalise.test.js`:

- **Happy path**: run against a fixture corpus → produces normalised output → second run is a no-op (no file mutation).
- **Snapshot creation**: `/tmp/docs-pre-norm/` contains pre-mutation copies for each modified file.
- **Stability**: pass1 === pass2 always; if not, fails with `SerializerStabilityError`.
- **Round-trip completeness**: against a fixture with all 7 entity types populated, all fields round-trip without loss.

### 6.5 Per-consumer integration tests

- `tests/integration/agent-context-flow.test.js` (existing) — passes with the US-0244 changes; no legacy `fs.writeFileSync` of managed paths.
- `tests/integration/agent-spec-plan-flow.test.js` (existing) — covered by Phase D writers; revalidate.
- `tests/integration/sync-github-flow.test.js` (new or existing) — gates US-0246.
- `tests/integration/dashboard-uses-accessor.test.js` (existing — EPIC-0045) — confirms US-0245's writer changes don't regress dashboard rendering.

### 6.6 Phase E hard gate test

`tests/integration/repository/epic-0040-hard-gates.test.js`:

- **Round-trip byte-identity gate**: against the post-Migration-001 production files (or a snapshot thereof), `serialize(parse(input)) === input` for every entity. This is stronger than 6.1's per-entity check; it's a full-corpus assertion.
- **No-direct-writes gate**: `grep -nE "fs\.(write|append)"` against `tools/agent-context.js`, `tools/generate-plan.js`, `tools/sync-github.js` returns only writes to the exempt allowlist (test fixtures, debug output, `/tmp/...`).
- **plan:lint zero errors gate**: invokes `tools/plan-lint.js` and asserts `0/0/0`.

### 6.7 Coverage targets

- ≥80% on all changed code (per AGENTS.md §8).
- ≥90% on the 7 per-entity serializers (round-trip code is one-shot and painful to debug after the fact).
- ≥90% on `id-allocator.js` and `transaction.js`.

---

## 7. Risk Register

| #   | Risk                                                                                                          | Likelihood | Impact                                                         | Mitigation                                                                                                                                                                            |
| --- | ------------------------------------------------------------------------------------------------------------- | ---------- | -------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| R1  | Serializer is lossy for some production field → Migration 001 drops data                                      | Medium     | High — data loss                                               | §4.4 pre-Migration-001 audit. Per-divergence human triage before US-0243 lands.                                                                                                       |
| R2  | Two-pass round-trip is non-idempotent → Migration 001 enters infinite normalisation loop                      | Low        | Medium — manual remediation needed                             | §4.3 step 5: SerializerStabilityError fails loud with a diff file; migration aborts; user reports.                                                                                    |
| R3  | Transaction callback awaits slow IO → SQLite write lock held; concurrent writers block                        | Medium     | Low — observable hang, no data corruption                      | §3.6 module-level JSDoc guideline. Per-consumer integration tests catch by hanging.                                                                                                   |
| R4  | SQLite COMMIT failure after markdown flush succeeds → SQL/markdown drift                                      | Very Low   | Medium — temporarily inconsistent, self-heals via next indexer | §3.5 documented design trade-off. No mitigation beyond documentation.                                                                                                                 |
| R5  | Consumer migration breaks tests via fixture-shape assumptions (like US-0261 saw)                              | Medium     | Medium — added implementation time per consumer story          | §4.6 plan must explicitly budget collateral test refactor time. Pattern from EPIC-0045: convert fixture `fs.writeFileSync` calls to `repo.X.update(...)` or mark as `bypass:` exempt. |
| R6  | Lock-acquisition order divergence across writers → deadlock                                                   | Low        | High — both writers hang forever                               | §3.4 mandate: every multi-file writer uses `acquireMany` (or its sort rule). Spec PR includes a one-line ESLint rule prep (no direct `lockfile.lock()` calls outside `file-lock.js`). |
| R7  | ID allocator race between in-tx allocation and out-of-tx allocation                                           | Low        | High — duplicate IDs assigned                                  | §3.4 in-tx allocations hold the `ID_REGISTRY.md` lock from the moment the first `tx.idRegistry.allocate` is called until commit. Out-of-tx callers block on the lock.                 |
| R8  | `pv:upgrade` runs Migration 001 against a dirty tree → user's in-progress changes mix with normalisation diff | Medium     | Low — confusing `git diff` but reversible                      | Phase D's `pv:upgrade` already refuses dirty trees by default. Migration 001 inherits this protection.                                                                                |

---

## 8. Open implementation-time decisions (out of scope for spec)

These are intentionally deferred to the plan-write step or the implementer's judgment:

1. **`*InTransaction` suffix vs `update(id, fn, {tx})` opt-in.** The transaction proxy needs to route writes through staging. Two viable shapes: (a) `<EntityRepo>InTransaction` helper modules; (b) every `update(id, fn)` accepts an optional `{tx: ctx}` parameter and routes itself. Style call; either works.
2. **Where the `_fence-utils.js` lives.** Under `serializers/` (with the entity serializers) vs `tools/lib/repository/` (closer to parsers). Slight preference for under `serializers/` to keep the serializer surface area self-contained.
3. **`SerializerStabilityError` and `ValidationError` class definitions.** Either new classes in `tools/lib/repository/errors.js` (if it exists) or extend existing project Error subclasses. Implementer's call.
4. **Coverage tool config for the new modules.** Whether to add per-file coverage thresholds in `jest.config.js` or rely on the global 80% gate. Recommend per-file 90% for serializers, allocator, transaction; leave global at 80%.

---

## 9. Definition of Done

EPIC-0040 is complete when:

- [ ] All 8 stories (US-0240..US-0247) have `Status: Done` with all ACs ticked in `docs/RELEASE_PLAN.md`.
- [ ] EPIC-0040 marked `Status: Done`.
- [ ] All 4 hard-gate verification commands (Section 2) pass on `develop`.
- [ ] All tests pass (`npx jest`); `npm run plan:lint` returns `0/0/0`; `npm run lint` clean.
- [ ] Coverage ≥80% on all changed code, ≥90% on serializers + id-allocator + transaction per §6.7.
- [ ] `progress.md`, `MEMORY.md`, `PROMPT_LOG.md`, `MIGRATION_LOG.md`, `docs/LESSONS.md` all updated per session-close checklist.
- [ ] Session memory file written for the closing session.
- [ ] Round-trip audit report (§4.4) committed under `docs/architecture/` for future-implementer reference.

---

## 10. Registry Claims

US-0240..US-0247 and AC-0938..AC-0963 are pre-allocated by the original Step 1 plan (already present as `Status: To Do` entries in `RELEASE_PLAN.md:4429-4554`). No new registry bump needed for those.

The 8 stories use `Plan Task: E.1..E.8` labels rather than `TASK-XXXX` IDs (the convention at the time of original-plan authoring). The implementation plan (writing-plans next step) decides whether to allocate fresh `TASK-XXXX` IDs from the registry per-story (following EPIC-0045's TASK-0066..TASK-0070 precedent) or to keep the `E.N` labels. Either is acceptable; allocation cost is a one-line ID_REGISTRY bump per story.

| Sequence | Claimed                        | Reservation needed?  |
| -------- | ------------------------------ | -------------------- |
| US       | US-0240..US-0247               | No — pre-allocated   |
| AC       | AC-0938..AC-0963               | No — pre-allocated   |
| TASK     | None (using `E.1..E.8` labels) | Optional — see above |

---

## 11. References

- Previous EPIC close-out: `docs/memory/sessions/2026-05-24-session-59-phase-e-complete.md`
- EPIC-0045 spec (the consumer-side half of "Phase E"): `docs/superpowers/specs/2026-05-22-phase-e-consumer-migration-design.md`
- Phase D close-out (the writer migration that established the SQL-authoritative pattern for `sdlc-status.json`): `docs/memory/sessions/2026-05-22-session-57-phase-d-complete.md`
- L-0081 (two-Migration-005 lesson — informs `data_001-` naming): `docs/LESSONS.md`
- L-0084 (orphan-commit pattern): `docs/LESSONS.md`
- L-0085 (subagent scope-drift): `docs/LESSONS.md`
- Existing read-side entity repos: `tools/lib/repository/entities/*.js`
- Existing parsers (each will get a corresponding serializer): `tools/lib/parse-{release-plan,bugs,lessons,test-cases,...}.js`
- Existing file-lock infrastructure: `tools/lib/repository/file-lock.js`
