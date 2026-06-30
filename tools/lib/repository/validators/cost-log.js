'use strict';
const fs = require('fs');
const path = require('path');

// Conflict markers on their own line (<<<<<<<, =======, >>>>>>>) and the
// space-separated ">" prefix left behind by a botched manual conflict-marker
// strip (BUG-0269). Both shapes are mechanically-introduced and must never
// re-land in the committed cost ledger.
const CONFLICT_MARKER_RE = /^(<{7}|={7}|>{7})(\s.*)?$/;
const CORRUPTED_PREFIX_RE = /^> > > > > > > /;

function lintCostLogContent(content) {
  const warnings = [];
  const lines = content.split('\n');
  lines.forEach((line, idx) => {
    if (CONFLICT_MARKER_RE.test(line) || CORRUPTED_PREFIX_RE.test(line)) {
      warnings.push({ code: 'cost-log-corruption', line: idx + 1, content: line });
    }
  });
  return warnings;
}

function lintCostLog({ root = process.cwd(), file = 'docs/AI_COST_LOG.md' } = {}) {
  const filePath = path.join(root, file);
  if (!fs.existsSync(filePath)) return [];
  const content = fs.readFileSync(filePath, 'utf8');
  return lintCostLogContent(content);
}

module.exports = { lintCostLog, lintCostLogContent };
