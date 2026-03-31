#!/usr/bin/env node
'use strict';

/**
 * Claude Code stop hook — appends session cost to the configured AI cost log.
 * Receives session metadata as JSON via stdin (session_id, transcript_path, cwd, gitBranch).
 * Reads token usage from the JSONL transcript because the Stop hook stdin does NOT include
 * cost_usd or usage fields.
 *
 * Token column "Input Tokens" includes both direct input tokens and cache-write tokens.
 * Rates used: Input $3/MTok · Cache Write $3.75/MTok · Output $15/MTok · Cache Read $0.30/MTok
 */

const fs = require('fs');
const path = require('path');
const readline = require('readline');
const { execSync } = require('child_process');

const ROOT = path.join(__dirname, '..');

const DEFAULTS = {
  docs: { costLog: 'docs/AI_COST_LOG.md' },
};

// Pricing per million tokens (Claude Sonnet 4.6)
const RATES = {
  input:       3.00,
  cacheWrite:  3.75,
  output:     15.00,
  cacheRead:   0.30,
};

function loadConfig() {
  const cfgPath = path.join(ROOT, 'plan-visualizer.config.json');
  if (!fs.existsSync(cfgPath)) return DEFAULTS;
  try {
    const raw = JSON.parse(fs.readFileSync(cfgPath, 'utf8'));
    return { docs: { ...DEFAULTS.docs, ...raw.docs } };
  } catch { return DEFAULTS; }
}

const HEADER =
  '# AI Cost Log\n\n' +
  'Append-only ledger of AI session costs. Never edit or delete rows.\n' +
  'Updated automatically by the Claude Code stop hook (`tools/capture-cost.js`).\n\n' +
  'Rows marked `[est]` are manually estimated for sessions that predate the capture-cost hook.\n' +
  'Pricing basis: Claude Sonnet 4.6 — Input $3/MTok · Output $15/MTok · Cache Read $0.30/MTok\n\n' +
  '---\n\n' +
  '## Keeping Costs Accurate\n\n' +
  '**If the AI Cost column in the dashboard is blank or zero for a story**, it means no cost log row has a `Branch` value matching that story\'s `Branch:` field exactly. Two common causes:\n\n' +
  '1. **Sessions predating the capture-cost hook** — add estimated rows manually using the `-est` suffix convention (e.g. `sess_NNNN-est`).\n' +
  '2. **Branch name mismatch** — the branch in the cost log row must exactly match the `Branch:` field in RELEASE_PLAN.md (case-sensitive).\n\n' +
  '**To estimate and backfill costs**, ask your AI assistant:\n\n' +
  '> "Look at `docs/AI_COST_LOG.md` and `docs/RELEASE_PLAN.md`. For any story whose branch has no matching cost log row, estimate the token usage based on the work described and the t-shirt size, then append new `[est]` rows. Use Claude Sonnet 4.6 pricing: Input $3/MTok · Output $15/MTok · Cache Read $0.30/MTok."\n\n' +
  '**Human cost** is computed automatically from t-shirt size × hourly rate in `plan-visualizer.config.json`. To update the hourly rate, change `costs.hourlyRate` in the config.\n\n' +
  '---\n\n' +
  '| Date | Session ID | Branch | Input Tokens | Output Tokens | Cache Read Tokens | Cost USD |\n' +
  '|---|---|---|---|---|---|---|\n';

/**
 * Parse a JSONL transcript and sum token usage across all assistant messages.
 * Only counts entries that have output_tokens > 0 (final turns, not streaming intermediates).
 * Returns { inputTokens, cacheWriteTokens, cacheReadTokens, outputTokens }.
 */
async function sumTokensFromTranscript(transcriptPath) {
  const totals = { inputTokens: 0, cacheWriteTokens: 0, cacheReadTokens: 0, outputTokens: 0 };
  if (!fs.existsSync(transcriptPath)) return totals;

  const seen = new Set();
  const rl = readline.createInterface({ input: fs.createReadStream(transcriptPath), crlfDelay: Infinity });

  for await (const line of rl) {
    let d;
    try { d = JSON.parse(line); } catch { continue; }
    if (d.type !== 'assistant') continue;

    const uid = d.uuid;
    if (uid && seen.has(uid)) continue;
    if (uid) seen.add(uid);

    const usage = d.message && d.message.usage;
    if (!usage || !usage.output_tokens) continue;   // skip streaming partial entries

    totals.inputTokens      += usage.input_tokens || 0;
    totals.cacheWriteTokens += usage.cache_creation_input_tokens || 0;
    totals.cacheReadTokens  += usage.cache_read_input_tokens || 0;
    totals.outputTokens     += usage.output_tokens;
  }

  return totals;
}

async function main() {
  const config = loadConfig();
  const LOG_PATH = path.join(ROOT, config.docs.costLog);

  let raw = '';
  for await (const chunk of process.stdin) raw += chunk;

  let data = {};
  try { data = JSON.parse(raw); } catch { /* stdin may be empty */ }

  const date = new Date().toISOString().slice(0, 10);
  const sessionId = data.session_id || `sess_${Date.now()}`;
  const gitBranch = data.gitBranch || null;

  // Resolve transcript path — prefer what the hook provides, fall back to fs search by session ID
  let transcriptPath = data.transcript_path || null;
  if (!transcriptPath && sessionId) {
    try {
      const claudeProjects = path.join(process.env.HOME || '', '.claude', 'projects');
      if (fs.existsSync(claudeProjects) && fs.statSync(claudeProjects).isDirectory()) {
        const projectDirs = fs.readdirSync(claudeProjects, { withFileTypes: true });
        for (const entry of projectDirs) {
          if (!entry.isDirectory()) continue;
          const candidate = path.join(claudeProjects, entry.name, `${sessionId}.jsonl`);
          if (fs.existsSync(candidate)) {
            transcriptPath = candidate;
            break;
          }
        }
      }
    } catch {
      /* leave null */
    }
  }

  const { inputTokens, cacheWriteTokens, cacheReadTokens, outputTokens } =
    await sumTokensFromTranscript(transcriptPath || '');

  if (!transcriptPath || (inputTokens === 0 && outputTokens === 0)) {
    process.stderr.write(`[capture-cost] Warning: No transcript found for session ${sessionId}; costs will be zeroed\n`);
  }

  // Cost: input and cache-write at their respective rates; fold into displayed "Input Tokens"
  const costUsd = (
    inputTokens      * RATES.input      / 1_000_000 +
    cacheWriteTokens * RATES.cacheWrite / 1_000_000 +
    cacheReadTokens  * RATES.cacheRead  / 1_000_000 +
    outputTokens     * RATES.output     / 1_000_000
  ).toFixed(4);

  // Input Tokens column = direct input + cache-write (both are "input-side" tokens)
  const displayInput = inputTokens + cacheWriteTokens;

  // Branch: prefer transcript payload, fall back to git
  let branch = gitBranch || 'unknown';
  if (!gitBranch) {
    try {
      branch = execSync('git rev-parse --abbrev-ref HEAD', { encoding: 'utf8' }).trim();
    } catch { /* ignore - use default branch value */ }
  }

  const row = `| ${date} | ${sessionId} | ${branch} | ${displayInput} | ${outputTokens} | ${cacheReadTokens} | ${costUsd} |\n`;

  const fd = fs.openSync(LOG_PATH, 'a');
  try {
    if (fs.fstatSync(fd).size === 0) fs.writeSync(fd, Buffer.from(HEADER, 'utf8'));
    fs.writeSync(fd, Buffer.from(row, 'utf8'));
  } finally {
    fs.closeSync(fd);
  }

  process.stderr.write(`[capture-cost] $${costUsd} | in=${displayInput} out=${outputTokens} cacheR=${cacheReadTokens} | branch=${branch}\n`);
}

main().catch(err => process.stderr.write(`[capture-cost] Error: ${err.message}\n`));
