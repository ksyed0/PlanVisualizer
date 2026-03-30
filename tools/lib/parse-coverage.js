'use strict';

const FALLBACK = { lines: 0, statements: 0, functions: 0, branches: 0, overall: 0, meetsTarget: false, available: false };

function parseCoverage(summaryJson) {
  if (!summaryJson || !summaryJson.total) return FALLBACK;
  const t = summaryJson.total;
  const lines      = t.lines      && t.lines.pct      != null ? t.lines.pct      : undefined;
  const statements = t.statements && t.statements.pct != null ? t.statements.pct : undefined;
  const functions  = t.functions  && t.functions.pct  != null ? t.functions.pct  : undefined;
  const branches   = t.branches   && t.branches.pct   != null ? t.branches.pct   : undefined;
  if (lines === undefined || statements === undefined || functions === undefined || branches === undefined) return FALLBACK;
  if (isNaN(lines) || isNaN(statements) || isNaN(functions) || isNaN(branches)) return FALLBACK;
  const overall = Math.min(lines, statements, functions, branches);
  return { lines, statements, functions, branches, overall, meetsTarget: overall >= 80, available: true };
}

module.exports = { parseCoverage };
