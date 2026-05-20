#!/usr/bin/env node
'use strict';
const { Repository } = require('./lib/repository');
const { readState } = require('./lib/migrations/pv-state');

function main() {
  const root = process.cwd();
  const repo = Repository.getInstance({ root });
  try {
    const state = readState({ root });
    const warnings = repo.warningsChannel.readAll();
    const totalWarnings = warnings.length;
    const counts = warnings.reduce((acc, w) => {
      acc[w.code] = (acc[w.code] || 0) + 1;
      return acc;
    }, {});
    console.log(`Repository mode: ${repo.index.mode}`);
    console.log(`Project state version: ${state.planvisualizerVersion}`);
    console.log(`Applied migrations: ${(state.appliedMigrations || []).join(', ') || '(none)'}`);
    console.log(`Warnings file: ${repo.warningsChannel.file}`);
    console.log(`Total warnings: ${totalWarnings}${totalWarnings > 10_000 ? ' ⚠ exceeds 10k threshold' : ''}`);
    for (const [code, n] of Object.entries(counts).sort()) console.log(`  ${code}: ${n}`);
  } finally {
    try {
      repo.close();
    } catch {
      /* ignore */
    }
  }
}
if (require.main === module) main();
module.exports = { main };
