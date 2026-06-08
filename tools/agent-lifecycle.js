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
const {
  ensureDocsDir,
  adoptLegacySdlcPath,
  syncLegacySdlcPath,
  readMirror,
  taskToUpsert,
  getRepoForCtx,
} = require('./lib/agent-cli-repo-helpers');

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

// Bridge helpers (resolveRoot / ensureDocsDir / adoptLegacySdlcPath /
// syncLegacySdlcPath / readMirror / taskToUpsert / parseTimestamp) and the
// per-dispatch repo factory (getRepoForCtx) live in
// tools/lib/agent-cli-repo-helpers.js — shared with agent-task-review.js
// (D.5) and agent-spec-plan.js (D.6).

function getRepo(ctx) {
  return getRepoForCtx(ctx, { Repository });
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
