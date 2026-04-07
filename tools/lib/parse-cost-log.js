'use strict';

const COST_LOG_REGEX =
  /^\|\s*(\d{4}-\d{2}-\d{2})\s*\|\s*(\S+)\s*\|\s*([^|]+?)\s*\|\s*(\d+)\s*\|\s*(\d+)\s*\|\s*(\d+)\s*\|\s*([\d.]+)\s*\|/;

function parseCostLog(markdown) {
  const rows = [];
  const lines = markdown.split('\n');
  for (const line of lines) {
    const m = line.match(COST_LOG_REGEX);
    if (!m) continue;
    rows.push({
      date: m[1],
      sessionId: m[2],
      branch: m[3],
      inputTokens: parseInt(m[4], 10),
      outputTokens: parseInt(m[5], 10),
      cacheReadTokens: parseInt(m[6], 10),
      costUsd: parseFloat(m[7]) || 0,
    });
  }
  return rows;
}

function deduplicateSessions(rows) {
  // The Stop hook fires on every turn, appending cumulative rows for the same session.
  // Keep only the last row per session_id (the highest cumulative total).
  const seen = new Map();
  for (const row of rows) {
    seen.set(row.sessionId, row);
  }
  return Array.from(seen.values());
}

function aggregateCostByBranch(rows) {
  const deduped = deduplicateSessions(rows);
  const agg = {};
  for (const row of deduped) {
    if (!agg[row.branch]) {
      agg[row.branch] = {
        inputTokens: 0,
        outputTokens: 0,
        cacheReadTokens: 0,
        costUsd: 0,
        sessions: 0,
      };
    }
    agg[row.branch].inputTokens += row.inputTokens;
    agg[row.branch].outputTokens += row.outputTokens;
    agg[row.branch].cacheReadTokens += row.cacheReadTokens;
    agg[row.branch].costUsd += row.costUsd;
    agg[row.branch].sessions += 1;
  }
  return agg;
}

module.exports = { parseCostLog, deduplicateSessions, aggregateCostByBranch };
