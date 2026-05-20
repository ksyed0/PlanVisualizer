// tools/lib/migrations/index.js
'use strict';
const fs = require('fs');
const path = require('path');
const { readState, writeState, readLocalState, writeLocalState } = require('./pv-state');
const { snapshot } = require('./backup');

function listMigrations() {
  return fs
    .readdirSync(__dirname)
    .filter((f) => /^\d{3}-.*\.js$/.test(f))
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
