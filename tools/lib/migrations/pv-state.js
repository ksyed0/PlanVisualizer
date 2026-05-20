// tools/lib/migrations/pv-state.js
'use strict';
const fs = require('fs');
const path = require('path');

function statePath(root) {
  return path.join(root, 'docs', '.pv-state.json');
}
function localStatePath(root) {
  return path.join(root, 'docs', '.pv-state.local.json');
}

function readState({ root }) {
  const f = statePath(root);
  if (!fs.existsSync(f)) return { planvisualizerVersion: '0.0.0', appliedMigrations: [] };
  return JSON.parse(fs.readFileSync(f, 'utf8'));
}

function writeState({ root, state }) {
  const f = statePath(root);
  fs.mkdirSync(path.dirname(f), { recursive: true });
  const out = {
    planvisualizerVersion: state.planvisualizerVersion,
    appliedMigrations: state.appliedMigrations || [],
  };
  fs.writeFileSync(f, JSON.stringify(out, null, 2) + '\n');
}

function readLocalState({ root }) {
  const f = localStatePath(root);
  if (!fs.existsSync(f)) return {};
  return JSON.parse(fs.readFileSync(f, 'utf8'));
}

function writeLocalState({ root, state }) {
  const f = localStatePath(root);
  fs.mkdirSync(path.dirname(f), { recursive: true });
  fs.writeFileSync(f, JSON.stringify(state, null, 2) + '\n');
}

module.exports = { readState, writeState, readLocalState, writeLocalState, statePath, localStatePath };
