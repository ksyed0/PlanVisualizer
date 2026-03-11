'use strict';

const FALLBACK = { lines: 0, statements: 0, functions: 0, branches: 0, overall: 0, meetsTarget: false, available: false };

function parseCoverage(summaryJson) {
  if (!summaryJson || !summaryJson.total) return FALLBACK;
  const t = summaryJson.total;
  if (!t.lines || !t.statements || !t.functions || !t.branches) return FALLBACK;
  const lines = t.lines.pct;
  const statements = t.statements.pct;
  const functions = t.functions.pct;
  const branches = t.branches.pct;
  const overall = Math.min(lines, statements, functions, branches);
  return { lines, statements, functions, branches, overall, meetsTarget: overall >= 80, available: true };
}

module.exports = { parseCoverage };
