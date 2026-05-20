#!/usr/bin/env node
'use strict';
const path = require('path');
const { readState } = require('./lib/migrations/pv-state');
const { pending } = require('./lib/migrations');

function main() {
  const root = process.cwd();
  const state = readState({ root });
  const pkgVersion = require(path.join(root, 'package.json')).version;
  const todo = pending({ root });
  console.log(`PlanVisualizer state:`);
  console.log(`  installed:     ${pkgVersion}`);
  console.log(`  project state: ${state.planvisualizerVersion}`);
  console.log(`  applied:       ${(state.appliedMigrations || []).join(', ') || '(none)'}`);
  console.log(`  pending:       ${todo.map((t) => t.id).join(', ') || '(none)'}`);
  if (state.planvisualizerVersion !== pkgVersion) {
    console.log('');
    console.log(
      '⚠  Installed version differs from project state. Run `npm run pv:upgrade` to apply pending migrations.',
    );
    process.exitCode = 0; // read-only; never blocks
  }
}
if (require.main === module) main();
module.exports = { main };
