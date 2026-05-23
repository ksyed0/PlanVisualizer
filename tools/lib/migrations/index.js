// tools/lib/migrations/index.js
'use strict';
const fs = require('fs');
const path = require('path');
const { readState, writeState, readLocalState, writeLocalState } = require('./pv-state');
const { snapshot } = require('./backup');

// US-0263 (L-0081): JS data migrations are prefixed `data_` to disambiguate from
// the schema migrations in tools/lib/repository/migrations/. The pattern accepts
// either the legacy `NNN-` or the renamed `data_NNN-` form so older checkouts
// keep working until pv-state.json's appliedMigrations catches up.
const MIGRATION_FILENAME_RE = /^(?:data_)?\d{3}-.*\.js$/;

function listMigrations() {
  return fs
    .readdirSync(__dirname)
    .filter((f) => MIGRATION_FILENAME_RE.test(f))
    .sort();
}

function pending({ root }) {
  const state = readState({ root });
  const applied = new Set(state.appliedMigrations || []);
  return listMigrations()
    .map((f) => ({ id: f.replace(/\.js$/, ''), file: path.join(__dirname, f) }))
    .filter((m) => !applied.has(m.id));
}

async function run({ root, dryRun = false, actor = process.env.USER || 'unknown' }) {
  const todo = pending({ root });
  const results = [];
  for (const m of todo) {
    const mod = require(m.file);
    if (!dryRun) {
      snapshot({ root, label: `pre-${m.id}`, files: mod.touches || [] });
      await mod.up({ root });
      const state = readState({ root });
      state.appliedMigrations = [...(state.appliedMigrations || []), m.id];
      state.planvisualizerVersion = require(path.join(root, 'package.json')).version;
      writeState({ root, state });
      writeLocalState({
        root,
        state: { ...readLocalState({ root }), lastUpgradeAt: new Date().toISOString(), lastUpgradeBy: actor },
      });
    }
    results.push({ id: m.id, dryRun });
  }
  return results;
}

module.exports = { listMigrations, pending, run };
