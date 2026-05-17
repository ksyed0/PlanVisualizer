#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');
const LifeState = require('./lib/agent-lifecycle-state');

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

function readSdlc(sdlcPath) {
  return JSON.parse(fs.readFileSync(sdlcPath, 'utf8'));
}

function writeSdlc(sdlcPath, data) {
  fs.writeFileSync(sdlcPath, JSON.stringify(data, null, 2) + '\n');
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

function dispatch(opts, ctx = {}) {
  const sdlcPath = ctx.sdlcPath || SDLC_PATH;
  const stdout = ctx.stdout || ((s) => process.stdout.write(s + '\n'));
  const stderr = ctx.stderr || ((s) => console.error(s));
  const cmd = opts.cmd;
  let data;
  try {
    data = readSdlc(sdlcPath);
  } catch (e) {
    console.error(`[agent-lifecycle] cannot read ${sdlcPath}: ${e.message}`);
    return 1;
  }
  try {
    switch (cmd) {
      case 'start': {
        if (!opts.story) {
          console.error('--story required');
          return 1;
        }
        if (!opts.agent) {
          console.error('--agent required');
          return 1;
        }
        const task = LifeState.initTask({
          story: opts.story,
          agent: opts.agent,
          model: opts.model,
          description: opts.task || '',
          planTaskIndex: opts.planTaskIndex,
        });
        LifeState.startTask(data, task);
        writeSdlc(sdlcPath, data);
        stdout(task.id);
        regenDashboard(ctx);
        return 0;
      }
      case 'done': {
        if (!opts.taskId) {
          console.error('--task-id required');
          return 1;
        }
        if (typeof opts.summary !== 'string' || opts.summary.trim().length === 0) {
          stderr(
            '[agent-lifecycle] done: --summary required ending with [sha:<commit>] token; see BE_DEV_AGENT.md §Commit SHA Reporting',
          );
          return 1;
        }
        try {
          LifeState.markDone(data, opts.taskId, opts.summary);
        } catch (e) {
          stderr(`[agent-lifecycle] ${e.message}`);
          return 1;
        }
        writeSdlc(sdlcPath, data);
        regenDashboard(ctx);
        return 0;
      }
      case 'concerns': {
        if (!opts.taskId) {
          console.error('--task-id required');
          return 1;
        }
        LifeState.markConcerns(data, opts.taskId, opts.note || '');
        writeSdlc(sdlcPath, data);
        regenDashboard(ctx);
        return 0;
      }
      case 'needs-context': {
        if (!opts.taskId) {
          console.error('--task-id required');
          return 1;
        }
        LifeState.markNeedsContext(data, opts.taskId, opts.missing || '');
        writeSdlc(sdlcPath, data);
        regenDashboard(ctx);
        return 0;
      }
      case 'blocked': {
        if (!opts.taskId) {
          console.error('--task-id required');
          return 1;
        }
        const suggestion = LifeState.markBlocked(data, opts.taskId, opts.reason || '');
        writeSdlc(sdlcPath, data);
        stdout(suggestion);
        regenDashboard(ctx);
        return 0;
      }
      case 'resolve': {
        if (!opts.taskId) {
          console.error('--task-id required');
          return 1;
        }
        try {
          LifeState.resolveBlocked(data, opts.taskId, { action: opts.action, note: opts.note });
          writeSdlc(sdlcPath, data);
          regenDashboard(ctx);
          return 0;
        } catch (e) {
          writeSdlc(sdlcPath, data);
          console.error(`[agent-lifecycle] ${e.message}`);
          return 1;
        }
      }
      case 'list': {
        const tasks = data.tasks || {};
        const rows = Object.values(tasks).filter((t) => {
          if (opts.story && t.story !== opts.story) return false;
          if (opts.state && t.state !== opts.state) return false;
          return true;
        });
        if (rows.length === 0) stdout('[agent-lifecycle] No matching tasks.');
        else rows.forEach((t) => stdout(`  ${t.id}  ${t.story || '—'}  ${t.agent}  ${t.state}  "${t.description}"`));
        return 0;
      }
      case 'status': {
        if (!opts.taskId) {
          console.error('--task-id required');
          return 1;
        }
        const t = (data.tasks || {})[opts.taskId];
        if (!t) {
          console.error(`[agent-lifecycle] task '${opts.taskId}' not found`);
          return 1;
        }
        stdout(JSON.stringify(t, null, 2));
        return 0;
      }
      default:
        console.error(`[agent-lifecycle] unknown command '${cmd}'`);
        return 1;
    }
  } catch (e) {
    console.error(`[agent-lifecycle] ${e.message}`);
    return 1;
  }
}

function main() {
  const opts = parseArgs(process.argv);
  if (!opts.cmd) {
    console.error('Usage: node tools/agent-lifecycle.js <command> [options]');
    console.error('Commands: start, done, concerns, needs-context, blocked, resolve, list, status');
    return 1;
  }
  return dispatch(opts);
}

module.exports = { parseArgs, dispatch, main };

if (require.main === module) process.exit(main());
