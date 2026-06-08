#!/usr/bin/env node
'use strict';
const { Repository } = require('./lib/repository');
const { indexAll } = require('./lib/repository/indexers');
const { runCrossEntityChecks } = require('./lib/repository/validators/cross-entity');
const { classify, TIER } = require('./lib/repository/validation');

function main() {
  const root = process.cwd();
  const repo = Repository.getInstance({ root });
  try {
    const indexResult = indexAll({ index: repo.index, markdown: repo.markdown, warningsChannel: repo.warningsChannel });
    const crossWarnings = runCrossEntityChecks({ index: repo.index });
    for (const w of crossWarnings) repo.warningsChannel.append(w);
    const all = [...indexResult.warnings, ...crossWarnings];
    const tiered = { error: [], warning: [], report: [] };
    for (const w of all) tiered[classify(w)].push(w);
    console.log(
      `[plan:lint] errors: ${tiered.error.length}, warnings: ${tiered.warning.length}, reports: ${tiered.report.length}`,
    );
    for (const e of tiered.error) console.log('  ERROR  ', JSON.stringify(e));
    for (const w of tiered.warning) console.log('  warn   ', JSON.stringify(w));
    for (const r of tiered.report.slice(0, 20)) console.log('  report ', JSON.stringify(r));
    if (tiered.error.length > 0) process.exitCode = 1;
  } finally {
    try {
      repo.close();
    } catch {
      /* ignore */
    }
    Repository._reset();
  }
}
if (require.main === module) main();
module.exports = { main };
