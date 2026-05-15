#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');
const Assembler = require('./lib/agent-context-assembler');

const DEFAULT_ROOT = path.join(__dirname, '..');

function parseArgs(argv) {
  const args = argv.slice(2);
  const out = { cmd: args[0] || null, story: null, agent: null, taskId: null };
  for (let i = 1; i < args.length; i++) {
    const a = args[i];
    const next = args[i + 1];
    if (a === '--story' && next) {
      out.story = next;
      i++;
    } else if (a === '--agent' && next) {
      out.agent = next;
      i++;
    } else if (a === '--task-id' && next) {
      out.taskId = next;
      i++;
    }
  }
  return out;
}

function readFileOrNull(p) {
  try {
    return fs.readFileSync(p, 'utf8');
  } catch {
    return null;
  }
}

function dispatch(opts, ctx = {}) {
  const root = ctx.root || DEFAULT_ROOT;
  const stdout = ctx.stdout || ((s) => process.stdout.write(s));
  const stderr = ctx.stderr || ((s) => process.stderr.write(s + '\n'));

  if (opts.cmd !== 'generate') {
    stderr(
      `[agent-context] unknown command '${opts.cmd}'. Usage: agent-context.js generate --story X --agent Y --task-id Z`,
    );
    return 1;
  }
  if (!opts.story) {
    stderr('[agent-context] --story required');
    return 1;
  }
  if (!opts.agent) {
    stderr('[agent-context] --agent required');
    return 1;
  }
  if (!opts.taskId) {
    stderr('[agent-context] --task-id required');
    return 1;
  }
  if (!Assembler.CANONICAL_AGENTS.includes(opts.agent)) {
    stderr(`[agent-context] unknown agent '${opts.agent}'. Canonical names: ${Assembler.CANONICAL_AGENTS.join(', ')}`);
    return 1;
  }

  const sdlcPath = path.join(root, 'docs/sdlc-status.json');
  let sdlc;
  try {
    sdlc = JSON.parse(fs.readFileSync(sdlcPath, 'utf8'));
  } catch (e) {
    stderr(`[agent-context] cannot read ${sdlcPath}: ${e.message}`);
    return 1;
  }

  const task = (sdlc.tasks || {})[opts.taskId];
  if (!task) {
    stderr(`[agent-context] task '${opts.taskId}' not found in sdlc-status.json`);
    return 1;
  }

  const story = (sdlc.stories || {})[opts.story] || {};
  const specPath = story.specPhase && story.specPhase.specPath;
  const planPath = story.planPhase && story.planPhase.planPath;

  const specContent = specPath ? readFileOrNull(path.join(root, specPath)) : null;
  const planContent = planPath ? readFileOrNull(path.join(root, planPath)) : null;
  const lessonsContent = readFileOrNull(path.join(root, 'docs/LESSONS.md')) || '';

  const ACs = specContent ? Assembler.parseStoryACs(specContent) : null;
  const planParsed =
    planContent && typeof task.planTaskIndex === 'number'
      ? Assembler.parsePlanBlock(planContent, task.planTaskIndex)
      : null;
  const lessons = Assembler.filterLessons(lessonsContent, opts.agent);

  const priorTasks = Object.values(sdlc.tasks || {}).filter(
    (t) => t.story === opts.story && t.id !== opts.taskId && (t.state === 'done' || t.state === 'done_with_concerns'),
  );

  const payload = Assembler.assemble({
    story: opts.story,
    agent: opts.agent,
    task,
    planTaskIndex: task.planTaskIndex,
    totalTasks: planParsed ? planParsed.totalTasks : 0,
    ACs,
    planBlock: planParsed ? planParsed.block : null,
    priorTasks,
    lessons,
  });

  stdout(payload);
  return 0;
}

function main() {
  const opts = parseArgs(process.argv);
  return dispatch(opts);
}

if (require.main === module) {
  process.exit(main());
}

module.exports = { parseArgs, dispatch, main };
