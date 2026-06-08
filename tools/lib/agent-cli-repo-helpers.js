'use strict';

/**
 * agent-cli-repo-helpers.js — shared legacy-bridge helpers for Phase D
 * writer CLIs (agent-lifecycle.js, agent-task-review.js, agent-spec-plan.js).
 *
 * Extracted in D.6 (US-0237 / TASK-0062) to satisfy the rule-of-three after
 * D.3 + D.4 + D.5 each independently grew near-identical copies of:
 *
 *   - resolveRoot / ensureDocsDir / adoptLegacySdlcPath / syncLegacySdlcPath:
 *     translate a legacy `ctx.sdlcPath` into a canonical
 *     `<root>/docs/sdlc-status.json` location and mirror the canonical write
 *     back to the test's path so existing read-back assertions keep working.
 *
 *   - readMirror(root): materialise the rich legacy-shape `{ tasks, log,
 *     programme }` from the on-disk JSON mirror so State helpers (which
 *     mutate `data.tasks[id]` in place) keep working unchanged.
 *
 *   - seedTasksFromLegacyJson(repo, root): one-shot ingestion of a
 *     pre-existing on-disk JSON `tasks` map into SQL. Idempotent —
 *     re-running on an already-seeded repo is a no-op.
 *
 *   - taskToUpsert / parseTimestamp: translate LifeState's legacy in-memory
 *     task shape (camelCase `story`/`state`) into the SdlcTaskRepo upsert
 *     shape (`storyId`/`status`).
 *
 *   - getRepoForCtx(ctx, { Repository }): resolve root, ensure docs/, adopt
 *     any legacy sdlcPath, reset the Repository singleton and open a fresh
 *     instance pointing at the resolved root.
 *
 *   - regenDashboard(ctx, { root }): silently re-run generate-dashboard.js.
 *     Best-effort — failure never blocks the caller (matches the per-writer
 *     contract that dashboard regen is a side-effect, not a hard step).
 *
 * Contract reminders (AC-1013, L-0076):
 *   - Writers THROW; indexers warn. None of these helpers swallow errors
 *     from the typed entity repos.
 *   - Mirror is fully re-rendered on every repo write — these helpers never
 *     write `docs/sdlc-status.json` directly outside the SdlcMirror.
 */

const fs = require('fs');
const path = require('path');

const DEFAULT_ROOT = path.join(__dirname, '..', '..');
const DEFAULT_SDLC_RELATIVE = path.join('docs', 'sdlc-status.json');
const EMPTY_MIRROR_SHAPE = Object.freeze({ tasks: {}, log: [], programme: {} });

/**
 * Resolve the repository root from the call context.
 *
 * The Phase D writer CLIs accept `ctx.sdlcPath` as an arbitrary file path
 * (used by tests to redirect writes into a tmpdir). The repo singleton needs
 * a `root` whose `docs/` subdirectory will hold `sdlc-status.json`. We
 * derive root by stripping the trailing `docs/sdlc-status.json` (if present)
 * — and otherwise treating the file's parent as the synthetic root.
 *
 * Honours `ctx.root` verbatim when set.
 */
function resolveRoot(ctx, { defaultRoot = DEFAULT_ROOT } = {}) {
  if (ctx && ctx.root) return ctx.root;
  const sdlcPath = (ctx && ctx.sdlcPath) || path.join(defaultRoot, DEFAULT_SDLC_RELATIVE);
  const docsDir = path.dirname(sdlcPath);
  if (path.basename(docsDir) === 'docs') return path.dirname(docsDir);
  return docsDir;
}

function ensureDocsDir(root) {
  fs.mkdirSync(path.join(root, 'docs'), { recursive: true });
}

/**
 * Tests historically created `<tmp>/sdlc-status.json` directly (not inside a
 * docs/ subdir). When we detect that shape, migrate the file into
 * `<tmp>/docs/sdlc-status.json` so the SdlcMirror can take it over.
 *
 * No-op if the file is already at the canonical path.
 */
function adoptLegacySdlcPath(ctx, root) {
  if (!ctx || !ctx.sdlcPath) return;
  const canonical = path.join(root, 'docs', 'sdlc-status.json');
  if (path.resolve(ctx.sdlcPath) === path.resolve(canonical)) return;
  ensureDocsDir(root);
  // Use exclusive-create flags to avoid a TOCTOU race between the
  // existsSync checks and the subsequent write (CodeQL js/file-system-race;
  // see L-0071). EEXIST means another process created the canonical file
  // first — that's the desired end state, so it's safe to ignore.
  if (fs.existsSync(ctx.sdlcPath)) {
    try {
      fs.copyFileSync(ctx.sdlcPath, canonical, fs.constants.COPYFILE_EXCL);
    } catch (e) {
      if (e.code !== 'EEXIST') throw e;
    }
  } else {
    try {
      fs.writeFileSync(canonical, JSON.stringify({ tasks: {}, log: [], programme: {} }, null, 2), { flag: 'wx' });
    } catch (e) {
      if (e.code !== 'EEXIST') throw e;
    }
  }
}

/**
 * After every repo write, the SdlcMirror writes the canonical
 * `<root>/docs/sdlc-status.json`. For backward-compat with tests that pass
 * a non-canonical `ctx.sdlcPath`, copy the canonical output back to that
 * path so the tests' read-back assertions still work.
 */
function syncLegacySdlcPath(ctx, root) {
  if (!ctx || !ctx.sdlcPath) return;
  const canonical = path.join(root, 'docs', 'sdlc-status.json');
  if (path.resolve(ctx.sdlcPath) === path.resolve(canonical)) return;
  if (fs.existsSync(canonical)) {
    fs.copyFileSync(canonical, ctx.sdlcPath);
  }
}

/**
 * Read the current on-disk mirror back as the legacy `{ tasks, log,
 * programme, ...preserved }` shape so State helpers can mutate it in place.
 *
 * Falls back to the empty shape if the file doesn't exist or is malformed
 * (matches the pre-existing D.3/D.5 behaviour — they both defaulted to
 * `{ tasks: {}, log: [], programme: {} }` on missing / malformed input).
 */
function readMirror(root) {
  const file = path.join(root, 'docs', 'sdlc-status.json');
  if (!fs.existsSync(file)) return { ...EMPTY_MIRROR_SHAPE, tasks: {}, log: [], programme: {} };
  try {
    const parsed = JSON.parse(fs.readFileSync(file, 'utf8'));
    if (!parsed.tasks) parsed.tasks = {};
    return parsed;
  } catch {
    return { ...EMPTY_MIRROR_SHAPE, tasks: {}, log: [], programme: {} };
  }
}

/**
 * Translate a LifeState task object (the legacy in-memory shape used by
 * agent-lifecycle-state.js) into the camelCase keys the SdlcTaskRepo
 * understands. Legacy `state` aliases SQL `status`; legacy `story` aliases
 * SQL `storyId`.
 */
function taskToUpsert(t) {
  return {
    id: t.id,
    storyId: t.story,
    agent: t.agent,
    status: t.state,
    startedAt: parseTimestamp(t.startedAt),
    completedAt: parseTimestamp(t.completedAt),
    planTaskIndex: t.planTaskIndex,
    summary: t.summary,
    model: t.model,
    headSha: t.headSha,
    description: t.description,
    concerns: t.concerns,
    blockedReason: t.blockedReason,
    blockedResolutions: t.blockedResolutions,
    retryCount: t.retryCount,
  };
}

function parseTimestamp(v) {
  if (v === null || v === undefined) return null;
  if (typeof v === 'number') return v;
  const n = Date.parse(v);
  return Number.isNaN(n) ? null : n;
}

/**
 * Ingest any tasks present in the on-disk JSON `tasks` map into SQL via
 * SdlcTaskRepo.upsert(). Idempotent — tasks already present in SQL are
 * skipped via `repo.sdlcTasks.get(id)`.
 *
 * This bridges the gap that the schema indexer iterates `data.tasks || []`
 * (array form), so a pre-seeded object-map shape is NOT auto-ingested on
 * Repository.getInstance.
 *
 * Writer contract: errors from `repo.sdlcTasks.upsert()` propagate — we do
 * NOT swallow them (AC-1013).
 */
async function seedTasksFromLegacyJson(repo, root) {
  const file = path.join(root, 'docs', 'sdlc-status.json');
  if (!fs.existsSync(file)) return;
  let raw;
  try {
    raw = JSON.parse(fs.readFileSync(file, 'utf8'));
  } catch {
    return;
  }
  const tasks = raw && raw.tasks;
  if (!tasks || Array.isArray(tasks) || typeof tasks !== 'object') return;
  for (const [id, t] of Object.entries(tasks)) {
    if (!id) continue;
    if (repo.sdlcTasks.get(id)) continue;
    await repo.sdlcTasks.upsert({
      id,
      storyId: t.storyId || t.story || null,
      agent: t.agent || null,
      status: t.status || t.state || null,
      summary: t.summary || null,
      headSha: t.headSha || null,
      baseSha: t.baseSha || null,
      taskReview: t.taskReview || null,
    });
  }
}

/**
 * Resolve the root, ensure docs/, adopt any legacy sdlcPath, reset the
 * Repository singleton, and return a fresh `{ repo, root }`.
 *
 * The Repository module is passed in (rather than required here) because the
 * helpers module sits ABOVE the writer CLIs in the dependency graph and we
 * want to keep this file free of the repo's transitive dependencies for
 * isolated unit testing.
 */
function getRepoForCtx(ctx, { Repository }) {
  const root = resolveRoot(ctx);
  ensureDocsDir(root);
  adoptLegacySdlcPath(ctx, root);
  Repository._reset();
  const repo = Repository.getInstance({ root });
  return { repo, root };
}

/**
 * Silently re-run generate-dashboard.js after a state-mutating command.
 * Errors are swallowed — regen is best-effort and must never block the CLI.
 *
 * `ctx.skipRegen` short-circuits (test isolation).
 */
function regenDashboard(ctx, { root = DEFAULT_ROOT } = {}) {
  if (ctx && ctx.skipRegen) return;
  try {
    const script = path.join(root, 'tools/generate-dashboard.js');
    if (fs.existsSync(script)) require(script);
  } catch {
    /* silent */
  }
}

module.exports = {
  resolveRoot,
  ensureDocsDir,
  adoptLegacySdlcPath,
  syncLegacySdlcPath,
  readMirror,
  taskToUpsert,
  parseTimestamp,
  seedTasksFromLegacyJson,
  getRepoForCtx,
  regenDashboard,
  DEFAULT_ROOT,
  EMPTY_MIRROR_SHAPE,
};
