'use strict';

function parseCoverage(summaryJson) {
  const t = summaryJson.total;
  const lines = t.lines.pct;
  const statements = t.statements.pct;
  const functions = t.functions.pct;
  const branches = t.branches.pct;
  const overall = Math.min(lines, statements, functions, branches);
  return { lines, statements, functions, branches, overall, meetsTarget: overall >= 80 };
}

module.exports = { parseCoverage };
