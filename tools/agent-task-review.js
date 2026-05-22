#!/usr/bin/env node
'use strict';

/**
 * agent-task-review.js — CLI for the agentic-pipeline task-review gate.
 *
 * Post-Phase-D (US-0236 / TASK-0060) this tool no longer writes
 * `docs/sdlc-status.json` directly. Every mutation of the taskReview
 * substructure routes through the D.1 entity repos:
 *
 *   - repo.sdlcTasks.upsert({ id, taskReview, headSha, baseSha })
 *   - repo.sdlcEvents.record({ kind: 'task-review-*', ... })
 *
 * The SdlcMirror re-renders `docs/sdlc-status.json` under a file lock on
 * every write, so the on-disk JSON is a pure function of SQL state
 * (writers throw, indexers warn — AC-1013).
 */

const fs = require('fs');
const path = require('path');
const State = require('./lib/agent-task-review-state');
const { Repository } = require('./lib/repository');
const {
  resolveRoot,
  ensureDocsDir,
  adoptLegacySdlcPath,
  syncLegacySdlcPath,
  readMirror,
  seedTasksFromLegacyJson,
} = require('./lib/agent-cli-repo-helpers');

const DEFAULT_ROOT = path.join(__dirname, '..');
const DEFAULT_CAP = 2;

function parseArgs(argv) {
  const args = argv.slice(2);
  const out = {
    cmd: args[0] || null,
    taskId: null,
    baseSha: null,
    headSha: null,
    verdict: null,
    findings: null,
    triggeredBy: null,
    newHeadSha: null,
  };
  for (let i = 1; i < args.length; i++) {
    const a = args[i];
    const next = args[i + 1];
    if (a === '--task-id' && next) {
      out.taskId = next;
      i++;
    } else if (a === '--base-sha' && next) {
      out.baseSha = next;
      i++;
    } else if (a === '--head-sha' && next) {
      out.headSha = next;
      i++;
    } else if (a === '--verdict' && next) {
      out.verdict = next;
      i++;
    } else if (a === '--findings' && next !== undefined) {
      out.findings = next;
      i++;
    } else if (a === '--triggered-by' && next) {
      out.triggeredBy = next;
      i++;
    } else if (a === '--new-head-sha' && next) {
      out.newHeadSha = next;
      i++;
    }
  }
  return out;
}

function readJson(p) {
  return JSON.parse(fs.readFileSync(p, 'utf8'));
}

function readCap(root) {
  try {
    const cfg = readJson(path.join(root, 'plan-visualizer.config.json'));
    const v = cfg && cfg.orchestration && cfg.orchestration.iterationCap && cfg.orchestration.iterationCap.taskReview;
    return typeof v === 'number' && Number.isFinite(v) && v >= 1 ? v : DEFAULT_CAP;
  } catch {
    return DEFAULT_CAP;
  }
}

// Bridge helpers (resolveRoot / ensureDocsDir / adoptLegacySdlcPath /
// syncLegacySdlcPath / readMirror / seedTasksFromLegacyJson) live in
// tools/lib/agent-cli-repo-helpers.js — shared with agent-lifecycle.js
// (D.3) and agent-spec-plan.js (D.6).

async function dispatch(opts, ctx = {}) {
  const stdout = ctx.stdout || ((s) => process.stdout.write(s));
  const stderr = ctx.stderr || ((s) => process.stderr.write(s + '\n'));

  if (!opts.cmd) {
    stderr(
      '[agent-task-review] usage: agent-task-review.js <start|spec-verdict|quality-verdict|forge-retry|status> [options]',
    );
    return 1;
  }
  if (!opts.taskId) {
    stderr('[agent-task-review] --task-id required');
    return 1;
  }

  const root = resolveRoot(ctx);
  ensureDocsDir(root);
  adoptLegacySdlcPath(ctx, root);

  // Fresh repo per dispatch for test isolation — matches the D.3 pattern.
  Repository._reset();
  let repo;
  try {
    repo = Repository.getInstance({ root });
  } catch (e) {
    stderr(`[agent-task-review] cannot open repository: ${e.message}`);
    return 1;
  }

  try {
    await seedTasksFromLegacyJson(repo, root);
    const data = readMirror(root);

    switch (opts.cmd) {
      case 'start': {
        if (!opts.baseSha) {
          stderr('[agent-task-review] --base-sha required');
          return 1;
        }
        if (!opts.headSha) {
          stderr('[agent-task-review] --head-sha required');
          return 1;
        }
        const token = State.initTaskReview(data, opts.taskId, opts.baseSha, opts.headSha);
        const t = data.tasks[opts.taskId];
        await repo.sdlcTasks.upsert({
          id: opts.taskId,
          taskReview: t.taskReview,
          baseSha: opts.baseSha,
          headSha: opts.headSha,
        });
        await repo.sdlcEvents.record({
          kind: 'task-review-start',
          storyId: t.story || t.storyId || null,
          agent: t.agent || null,
          taskId: opts.taskId,
          baseSha: opts.baseSha,
          headSha: opts.headSha,
          token,
          ts: Date.now(),
        });
        syncLegacySdlcPath(ctx, root);
        stdout(token + '\n');
        return 0;
      }

      case 'spec-verdict': {
        if (!opts.verdict) {
          stderr('[agent-task-review] --verdict required (APPROVED or REQUEST_CHANGES)');
          return 1;
        }
        if (
          opts.verdict === 'REQUEST_CHANGES' &&
          (typeof opts.findings !== 'string' || opts.findings.trim().length === 0)
        ) {
          stderr('[agent-task-review] --findings required for REQUEST_CHANGES verdict');
          return 1;
        }
        const cap = readCap(root);
        const token = State.setSpecVerdict(data, opts.taskId, opts.verdict, opts.findings, cap);
        const t = data.tasks[opts.taskId];
        await repo.sdlcTasks.upsert({ id: opts.taskId, taskReview: t.taskReview });
        await repo.sdlcEvents.record({
          kind: 'task-review-spec-verdict',
          storyId: t.story || t.storyId || null,
          agent: t.agent || null,
          taskId: opts.taskId,
          verdict: opts.verdict,
          findings: opts.findings || null,
          token,
          ts: Date.now(),
        });
        syncLegacySdlcPath(ctx, root);
        stdout(token + '\n');
        return 0;
      }

      case 'quality-verdict': {
        if (!opts.verdict) {
          stderr('[agent-task-review] --verdict required (APPROVED or REQUEST_CHANGES)');
          return 1;
        }
        if (
          opts.verdict === 'REQUEST_CHANGES' &&
          (typeof opts.findings !== 'string' || opts.findings.trim().length === 0)
        ) {
          stderr('[agent-task-review] --findings required for REQUEST_CHANGES verdict');
          return 1;
        }
        const cap = readCap(root);
        const token = State.setQualityVerdict(data, opts.taskId, opts.verdict, opts.findings, cap);
        const t = data.tasks[opts.taskId];
        await repo.sdlcTasks.upsert({ id: opts.taskId, taskReview: t.taskReview });
        await repo.sdlcEvents.record({
          kind: 'task-review-quality-verdict',
          storyId: t.story || t.storyId || null,
          agent: t.agent || null,
          taskId: opts.taskId,
          verdict: opts.verdict,
          findings: opts.findings || null,
          token,
          ts: Date.now(),
        });
        syncLegacySdlcPath(ctx, root);
        stdout(token + '\n');
        return 0;
      }

      case 'forge-retry': {
        if (!opts.triggeredBy) {
          stderr('[agent-task-review] --triggered-by required (spec or quality)');
          return 1;
        }
        if (!opts.newHeadSha) {
          stderr('[agent-task-review] --new-head-sha required');
          return 1;
        }
        const token = State.forgeRetry(data, opts.taskId, opts.triggeredBy, opts.newHeadSha);
        const t = data.tasks[opts.taskId];
        await repo.sdlcTasks.upsert({
          id: opts.taskId,
          taskReview: t.taskReview,
          headSha: opts.newHeadSha,
        });
        await repo.sdlcEvents.record({
          kind: 'task-review-forge-retry',
          storyId: t.story || t.storyId || null,
          agent: t.agent || null,
          taskId: opts.taskId,
          triggeredBy: opts.triggeredBy,
          newHeadSha: opts.newHeadSha,
          token,
          ts: Date.now(),
        });
        syncLegacySdlcPath(ctx, root);
        stdout(token + '\n');
        return 0;
      }

      case 'status': {
        const t = (data.tasks || {})[opts.taskId];
        if (!t) {
          stderr(`[agent-task-review] task '${opts.taskId}' not found`);
          return 1;
        }
        if (!t.taskReview) {
          stderr(`[agent-task-review] task '${opts.taskId}' has no taskReview record`);
          return 1;
        }
        stdout(JSON.stringify(t.taskReview, null, 2));
        return 0;
      }

      default:
        stderr(`[agent-task-review] unknown command '${opts.cmd}'`);
        return 1;
    }
  } catch (e) {
    stderr(`[agent-task-review] ${e.message}`);
    return 1;
  } finally {
    Repository._reset();
  }
}

async function main() {
  const opts = parseArgs(process.argv);
  return dispatch(opts);
}

if (require.main === module) {
  main().then(
    (code) => process.exit(code),
    (e) => {
      console.error(`[agent-task-review] fatal: ${e.message}`);
      process.exit(1);
    },
  );
}

module.exports = { parseArgs, dispatch, main, readCap };
