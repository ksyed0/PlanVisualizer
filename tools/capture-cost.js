#!/usr/bin/env node
'use strict';

/**
 * Claude Code stop hook — appends session cost to the configured AI cost log.
 * Receives session data as JSON via stdin.
 * Never overwrites existing rows.
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const ROOT = path.join(__dirname, '..');

const DEFAULTS = {
  docs: { costLog: 'Docs/AI_COST_LOG.md' },
};

function loadConfig() {
  const cfgPath = path.join(ROOT, 'plan-visualizer.config.json');
  if (!fs.existsSync(cfgPath)) return DEFAULTS;
  try {
    const raw = JSON.parse(fs.readFileSync(cfgPath, 'utf8'));
    return {
      docs: { ...DEFAULTS.docs, ...raw.docs },
    };
  } catch { return DEFAULTS; }
}

const HEADER = `# AI Cost Log\n\nAppend-only ledger of AI session costs. Never edit or delete rows.\nUpdated automatically by the Claude Code stop hook (\`tools/capture-cost.js\`).\n\n| Date | Session ID | Branch | Input Tokens | Output Tokens | Cache Read Tokens | Cost USD |\n|---|---|---|---|---|---|---|\n`;

async function main() {
  const config = loadConfig();
  const LOG_PATH = path.join(ROOT, config.docs.costLog);

  let input = '';
  for await (const chunk of process.stdin) input += chunk;

  let data = {};
  try { data = JSON.parse(input); } catch { /* no stdin data */ }

  const date = new Date().toISOString().slice(0, 10);
  const sessionId = data.session_id || `sess_${Date.now()}`;
  const costUsd = (data.cost_usd || data.total_cost || 0).toFixed(4);
  const usage = data.usage || {};
  const inputTokens = usage.input_tokens || 0;
  const outputTokens = usage.output_tokens || 0;
  const cacheRead = usage.cache_read_input_tokens || 0;

  let branch = 'unknown';
  try { branch = execSync('git rev-parse --abbrev-ref HEAD', { encoding: 'utf8' }).trim(); } catch {}

  const row = `| ${date} | ${sessionId} | ${branch} | ${inputTokens} | ${outputTokens} | ${cacheRead} | ${costUsd} |\n`;

  const fd = fs.openSync(LOG_PATH, 'a');
  try {
    if (fs.fstatSync(fd).size === 0) fs.writeSync(fd, Buffer.from(HEADER, 'utf8'));
    fs.writeSync(fd, Buffer.from(row, 'utf8'));
  } finally {
    fs.closeSync(fd);
  }
  process.stderr.write(`[capture-cost] Appended session cost: $${costUsd} on branch ${branch}\n`);
}

main().catch(err => process.stderr.write(`[capture-cost] Error: ${err.message}\n`));
