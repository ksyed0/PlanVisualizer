#!/usr/bin/env node
'use strict';
const fs = require('fs');
const path = require('path');
const { Repository } = require('./lib/repository');
const { readState } = require('./lib/migrations/pv-state');

const LEGACY_TOP_LEVEL_KEYS = [
  'agents',
  'metrics',
  'stories',
  'epics',
  'phases',
  'cycles',
  'currentPhase',
  'githubStatus',
  'project',
];

const MIGRATION_006_ID = 'data_006-ingest-legacy-programme';

function detectUnMigratedClone(root) {
  const sdlcPath = path.join(root, 'docs', 'sdlc-status.json');
  if (!fs.existsSync(sdlcPath)) return null;
  let json;
  try {
    json = JSON.parse(fs.readFileSync(sdlcPath, 'utf8'));
  } catch {
    return null;
  }
  const hasLegacy = LEGACY_TOP_LEVEL_KEYS.some((k) => Object.prototype.hasOwnProperty.call(json, k));
  if (!hasLegacy) return null;
  const state = readState({ root });
  const applied = new Set(state.appliedMigrations || []);
  if (applied.has(MIGRATION_006_ID)) return null;
  return {
    legacyKeys: LEGACY_TOP_LEVEL_KEYS.filter((k) => Object.prototype.hasOwnProperty.call(json, k)),
  };
}

function main({ root = process.cwd() } = {}) {
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

    // US-0261: detect un-upgraded clone and print remediation.
    const needs = detectUnMigratedClone(root);
    if (needs) {
      console.log('');
      console.log('⚠ Un-upgraded clone detected:');
      console.log(`  docs/sdlc-status.json has legacy top-level keys: ${needs.legacyKeys.join(', ')}`);
      console.log(`  ${MIGRATION_006_ID} is not in appliedMigrations.`);
      console.log('  Run `npm run pv:upgrade` to migrate state.');
    }
  } finally {
    try {
      repo.close();
    } catch {
      /* ignore */
    }
  }
}
if (require.main === module) main();
module.exports = { main, detectUnMigratedClone };
