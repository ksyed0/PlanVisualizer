#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const SDLC_PATH = path.join(ROOT, 'docs/sdlc-status.json');

function parseArgs(argv) {
  const args = argv.slice(2);
  const cmd = args[0] || null;
  const out = {
    cmd,
    story: null,
    gate: null,
    verdict: null,
    reason: null,
    field: null,
    value: null,
    findingsFile: null,
    author: null,
    dir: null,
    state: null,
    phase: null,
    uiSurface: null,
  };
  for (let i = 1; i < args.length; i++) {
    const a = args[i];
    const next = args[i + 1];
    if (a === '--story' && next) {
      out.story = next;
      i++;
    } else if (a === '--gate' && next) {
      out.gate = next;
      i++;
    } else if (a === '--verdict' && next) {
      out.verdict = next;
      i++;
    } else if (a === '--reason' && next !== undefined) {
      out.reason = next;
      i++;
    } else if (a === '--field' && next) {
      out.field = next;
      i++;
    } else if (a === '--value' && next !== undefined) {
      out.value = next;
      i++;
    } else if (a === '--findings-file' && next) {
      out.findingsFile = next;
      i++;
    } else if (a === '--author' && next) {
      out.author = next;
      i++;
    } else if (a === '--dir' && next) {
      out.dir = next;
      i++;
    } else if (a === '--state' && next) {
      out.state = next;
      i++;
    } else if (a === '--phase' && next) {
      out.phase = next;
      i++;
    } else if (a === '--ui-surface' && next !== undefined) {
      out.uiSurface = next;
      i++;
    }
  }
  return out;
}

function main() {
  const opts = parseArgs(process.argv);
  if (!opts.cmd) {
    console.error('Usage: node tools/agent-spec-plan.js <command> [--story US-XXXX] [--gate ac|spec|plan] ...');
    console.error('Commands: spec-start, spec-update, spec-review-result, spec-await-ac, spec-await-final,');
    console.error('          plan-start, plan-spec-gap, plan-review-result, plan-await-approval,');
    console.error('          approve, reject, apply-pending, list, status, show-pending, escalate');
    return 1;
  }
  // Dispatch happens in next task
  console.error(`[agent-spec-plan] dispatch not yet implemented for '${opts.cmd}'`);
  return 1;
}

module.exports = { parseArgs, main };

if (require.main === module) {
  process.exit(main());
}
