#!/usr/bin/env node
'use strict';

/**
 * agent-lifecycle.js — CLI for the agentic-pipeline task lifecycle.
 *
 * Post-Phase-D (US-0234 / TASK-0058) this tool no longer writes
 * docs/sdlc-status.json directly. Every state mutation routes through the
 * D.1 entity repos:
 *
 *   - repo.sdlcTasks.upsert(task)  — task row in SQLite
 *   - repo.sdlcEvents.record(evt)  — append-only log row
 *
 * The SdlcMirror writes the JSON mirror under a file lock on every event,
 * re-rendering from SQL each time — see AC-1013 (writers throw, indexers
 * warn). The mirror is fully re-rendered on every write so the on-disk
 * JSON is a pure function of SQL state and therefore byte-identical across
 * all four Phase D writers.
 */

const fs = require('fs');
const path = require('path');
const LifeState = require('./lib/agent-lifecycle-state');
const { Repository } = require('./lib/repository');

const ROOT = path.join(__dirname, '..');
const SDLC_PATH = path.join(ROOT, 'docs/sdlc-status.json');

function parseArgs(argv) {
  const args = argv.slice(2);
  const cmd = args[0] || null;
  const out = {
    cmd,
    story: null,
    agent: null,
    model: null,
    task: null,
    taskId: null,
    note: null,
    missing: null,
    reason: null,
    action: null,
    state: null,
    planTaskIndex: null,
    summary: null,
  };
  for (let i = 1; i < args.length; i++) {
    const a = args[i];
    const next = args[i + 1];
    if (a === '--story' && next) {
      out.story = next;
      i++;
    } else if (a === '--agent' && next) {
      out.agent = next;
      i++;
    } else if (a === '--model' && next) {
      out.model = next;
      i++;
    } else if (a === '--task' && next !== undefined) {
      out.task = next;
      i++;
    } else if (a === '--task-id' && next) {
      out.taskId = next;
      i++;
    } else if (a === '--note' && next !== undefined) {
      out.note = next;
      i++;
    } else if (a === '--missing' && next !== undefined) {
      out.missing = next;
      i++;
    } else if (a === '--reason' && next !== undefined) {
      out.reason = next;
      i++;
    } else if (a === '--action' && next) {
      out.action = next;
      i++;
    } else if (a === '--state' && next) {
      out.state = next;
      i++;
    } else if (a === '--plan-task-index' && next !== undefined) {
      const n = parseInt(next, 10);
      out.planTaskIndex = Number.isNaN(n) ? null : n;
      i++;
    } else if (a === '--summary' && next !== undefined) {
      out.summary = next;
      i++;
    }
  }
  return out;
}

function regenDashboard(ctx) {
  if (ctx && ctx.skipRegen) return;
  try {
    const script = path.join(ROOT, 'tools/generate-dashboard.js');
    if (fs.existsSync(script)) require('./generate-dashboard');
  } catch {
    /* silent */
  }
}

/**
 * Resolve the repository root from the call context.
 *
 * The legacy CLI accepted `ctx.sdlcPath` as an arbitrary file path (used by
 * tests to redirect writes to a tmpdir). The repo singleton needs a
 * `root` whose `docs/` subdirectory will hold `sdlc-status.json`. We
 * derive root by stripping the trailing `docs/sdlc-status.json` (if
 * present) — and otherwise treating the file's parent's parent as root.
 */
function resolveRoot(ctx) {
  if (ctx && ctx.root) return ctx.root;
  const sdlcPath = ctx && ctx.sdlcPath ? ctx.sdlcPath : SDLC_PATH;
  // If `<root>/docs/sdlc-status.json`, root = <root>.
  const docsDir = path.dirname(sdlcPath);
  if (path.basename(docsDir) === 'docs') return path.dirname(docsDir);
  // Otherwise treat the file's directory as the docs/ for a synthetic root.
  // The test setup is: tmpdir/sdlc-status.json — we synthesise root = tmpdir
  // and rename the file into tmpdir/docs/sdlc-status.json.
  return docsDir;
}

function ensureDocsDir(root) {
  fs.mkdirSync(path.join(root, 'docs'), { recursive: true });
}

/**
 * Tests historically created `<tmp>/sdlc-status.json` directly (not inside
 * a docs/ subdir). When we detect that shape, migrate the file into
 * `<tmp>/docs/sdlc-status.json` so the SdlcMirror can take it over.
 *
 * No-op if the file is already at the canonical path.
 */
function adoptLegacySdlcPath(ctx, root) {
  if (!ctx || !ctx.sdlcPath) return;
  const canonical = path.join(root, 'docs', 'sdlc-status.json');
  if (path.resolve(ctx.sdlcPath) === path.resolve(canonical)) return;
  // The provided sdlcPath sits outside <root>/docs/. Move its contents
  // into the canonical location so the mirror writes there.
  ensureDocsDir(root);
  if (fs.existsSync(ctx.sdlcPath) && !fs.existsSync(canonical)) {
    fs.copyFileSync(ctx.sdlcPath, canonical);
  } else if (!fs.existsSync(canonical)) {
    fs.writeFileSync(canonical, JSON.stringify({ tasks: {}, log: [], programme: {} }, null, 2));
  }
}

/**
 * After every repo write, the SdlcMirror writes the canonical
 * `<root>/docs/sdlc-status.json`. For backward-compat with tests that
 * pass a non-canonical `ctx.sdlcPath`, copy the canonical output back to
 * that path so the tests' read-back assertions still work.
 */
function syncLegacySdlcPath(ctx, root) {
  if (!ctx || !ctx.sdlcPath) return;
  const canonical = path.join(root, 'docs', 'sdlc-status.json');
  if (path.resolve(ctx.sdlcPath) === path.resolve(canonical)) return;
  if (fs.existsSync(canonical)) {
    fs.copyFileSync(canonical, ctx.sdlcPath);
  }
}

function getRepo(ctx) {
  const root = resolveRoot(ctx);
  ensureDocsDir(root);
  adoptLegacySdlcPath(ctx, root);
  // Always reset the singleton for test isolation — every dispatch call
  // gets a fresh repository pointing at the resolved root.
  Repository._reset();
  const repo = Repository.getInstance({ root });
  return { repo, root };
}

/**
 * Translate a LifeState task object (the legacy in-memory shape used by
 * agent-lifecycle-state.js) into the camelCase keys the SdlcTaskRepo
 * understands. The legacy code uses `state` for what the schema calls
 * `status`, and uses `story` for what the schema calls `storyId`.
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
 * Read the current `tasks` map back out of the JSON mirror (canonical
 * post-D.3 shape — `tasks` is an object keyed by id, with `state`
 * aliased to `status`). The LifeState helpers consume this shape.
 *
 * Falls back to an empty `{ tasks: {} }` if the mirror file doesn't
 * exist yet (first ever call on a fresh root).
 */
function readMirror(root) {
  const file = path.join(root, 'docs', 'sdlc-status.json');
  if (!fs.existsSync(file)) return { tasks: {}, log: [], programme: {} };
  try {
    const parsed = JSON.parse(fs.readFileSync(file, 'utf8'));
    if (!parsed.tasks) parsed.tasks = {};
    // The legacy seed JSON tests use sometimes carries `tasks` as an
    // object map of arbitrary shape — preserve it as-is.
    return parsed;
  } catch {
    return { tasks: {}, log: [], programme: {} };
  }
}

async function dispatch(opts, ctx = {}) {
  const stdout = ctx.stdout || ((s) => process.stdout.write(s + '\n'));
  const stderr = ctx.stderr || ((s) => console.error(s));
  const cmd = opts.cmd;

  let repo, root;
  try {
    ({ repo, root } = getRepo(ctx));
  } catch (e) {
    stderr(`[agent-lifecycle] cannot open repository: ${e.message}`);
    return 1;
  }

  try {
    switch (cmd) {
      case 'start': {
        if (!opts.story) {
          stderr('--story required');
          return 1;
        }
        if (!opts.agent) {
          stderr('--agent required');
          return 1;
        }
        const task = LifeState.initTask({
          story: opts.story,
          agent: opts.agent,
          model: opts.model,
          description: opts.task || '',
          planTaskIndex: opts.planTaskIndex,
        });
        await repo.sdlcTasks.upsert(taskToUpsert(task));
        await repo.sdlcEvents.record({
          kind: 'task-start',
          storyId: task.story,
          agent: task.agent,
          taskId: task.id,
          ts: Date.now(),
        });
        syncLegacySdlcPath(ctx, root);
        stdout(task.id);
        regenDashboard(ctx);
        return 0;
      }
      case 'done': {
        if (!opts.taskId) {
          stderr('--task-id required');
          return 1;
        }
        if (typeof opts.summary !== 'string' || opts.summary.trim().length === 0) {
          stderr(
            '[agent-lifecycle] done: --summary required ending with [sha:<commit>] token; see BE_DEV_AGENT.md §Commit SHA Reporting',
          );
          return 1;
        }
        const data = readMirror(root);
        try {
          LifeState.markDone(data, opts.taskId, opts.summary);
        } catch (e) {
          stderr(`[agent-lifecycle] ${e.message}`);
          return 1;
        }
        const t = data.tasks[opts.taskId];
        await repo.sdlcTasks.upsert(taskToUpsert(t));
        await repo.sdlcEvents.record({
          kind: 'task-done',
          storyId: t.story,
          agent: t.agent,
          taskId: t.id,
          summary: t.summary,
          headSha: t.headSha,
          ts: Date.now(),
        });
        syncLegacySdlcPath(ctx, root);
        regenDashboard(ctx);
        return 0;
      }
      case 'concerns': {
        if (!opts.taskId) {
          stderr('--task-id required');
          return 1;
        }
        const data = readMirror(root);
        LifeState.markConcerns(data, opts.taskId, opts.note || '');
        const t = data.tasks[opts.taskId];
        await repo.sdlcTasks.upsert(taskToUpsert(t));
        await repo.sdlcEvents.record({
          kind: 'task-concerns',
          storyId: t.story,
          agent: t.agent,
          taskId: t.id,
          note: t.concerns,
          ts: Date.now(),
        });
        syncLegacySdlcPath(ctx, root);
        regenDashboard(ctx);
        return 0;
      }
      case 'needs-context': {
        if (!opts.taskId) {
          stderr('--task-id required');
          return 1;
        }
        const data = readMirror(root);
        LifeState.markNeedsContext(data, opts.taskId, opts.missing || '');
        const t = data.tasks[opts.taskId];
        await repo.sdlcTasks.upsert(taskToUpsert(t));
        await repo.sdlcEvents.record({
          kind: 'task-needs-context',
          storyId: t.story,
          agent: t.agent,
          taskId: t.id,
          missing: t.blockedReason,
          ts: Date.now(),
        });
        syncLegacySdlcPath(ctx, root);
        regenDashboard(ctx);
        return 0;
      }
      case 'blocked': {
        if (!opts.taskId) {
          stderr('--task-id required');
          return 1;
        }
        const data = readMirror(root);
        const suggestion = LifeState.markBlocked(data, opts.taskId, opts.reason || '');
        const t = data.tasks[opts.taskId];
        await repo.sdlcTasks.upsert(taskToUpsert(t));
        await repo.sdlcEvents.record({
          kind: 'task-blocked',
          storyId: t.story,
          agent: t.agent,
          taskId: t.id,
          reason: t.blockedReason,
          suggestion,
          ts: Date.now(),
        });
        syncLegacySdlcPath(ctx, root);
        stdout(suggestion);
        regenDashboard(ctx);
        return 0;
      }
      case 'resolve': {
        if (!opts.taskId) {
          stderr('--task-id required');
          return 1;
        }
        const data = readMirror(root);
        let threw = null;
        try {
          LifeState.resolveBlocked(data, opts.taskId, { action: opts.action, note: opts.note });
        } catch (e) {
          threw = e;
        }
        const t = data.tasks[opts.taskId];
        if (t) {
          await repo.sdlcTasks.upsert(taskToUpsert(t));
          await repo.sdlcEvents.record({
            kind: threw ? 'task-escalated' : 'task-resolved',
            storyId: t.story,
            agent: t.agent,
            taskId: t.id,
            action: opts.action,
            note: opts.note,
            ts: Date.now(),
          });
        }
        syncLegacySdlcPath(ctx, root);
        regenDashboard(ctx);
        if (threw) {
          stderr(`[agent-lifecycle] ${threw.message}`);
          return 1;
        }
        return 0;
      }
      case 'list': {
        const data = readMirror(root);
        const tasks = data.tasks || {};
        const rows = Object.values(tasks).filter((t) => {
          if (opts.story && (t.story || t.storyId) !== opts.story) return false;
          if (opts.state && (t.state || t.status) !== opts.state) return false;
          return true;
        });
        if (rows.length === 0) stdout('[agent-lifecycle] No matching tasks.');
        else
          rows.forEach((t) =>
            stdout(
              `  ${t.id}  ${t.story || t.storyId || '—'}  ${t.agent}  ${t.state || t.status}  "${t.description || ''}"`,
            ),
          );
        return 0;
      }
      case 'status': {
        if (!opts.taskId) {
          stderr('--task-id required');
          return 1;
        }
        const data = readMirror(root);
        const t = (data.tasks || {})[opts.taskId];
        if (!t) {
          stderr(`[agent-lifecycle] task '${opts.taskId}' not found`);
          return 1;
        }
        stdout(JSON.stringify(t, null, 2));
        return 0;
      }
      default:
        stderr(`[agent-lifecycle] unknown command '${cmd}'`);
        return 1;
    }
  } catch (e) {
    stderr(`[agent-lifecycle] ${e.message}`);
    return 1;
  } finally {
    Repository._reset();
  }
}

async function main() {
  const opts = parseArgs(process.argv);
  if (!opts.cmd) {
    console.error('Usage: node tools/agent-lifecycle.js <command> [options]');
    console.error('Commands: start, done, concerns, needs-context, blocked, resolve, list, status');
    return 1;
  }
  return dispatch(opts);
}

module.exports = { parseArgs, dispatch, main };

if (require.main === module) {
  main().then(
    (code) => process.exit(code),
    (e) => {
      console.error(`[agent-lifecycle] fatal: ${e.message}`);
      process.exit(1);
    },
  );
}
