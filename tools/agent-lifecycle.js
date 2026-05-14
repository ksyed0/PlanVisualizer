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
    }
  }
  return out;
}

function main() {
  const opts = parseArgs(process.argv);
  if (!opts.cmd) {
    console.error('Usage: node tools/agent-lifecycle.js <command> [options]');
    console.error('Commands: start, done, concerns, needs-context, blocked, resolve, list, status');
    return 1;
  }
  console.error(`[agent-lifecycle] dispatch not yet implemented for '${opts.cmd}'`);
  return 1;
}

module.exports = { parseArgs, main };

if (require.main === module) process.exit(main());
