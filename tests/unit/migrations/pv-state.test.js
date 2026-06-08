// tests/unit/migrations/pv-state.test.js
const fs = require('fs');
const path = require('path');
const os = require('os');
const { readState, writeState, readLocalState, writeLocalState } = require('../../../tools/lib/migrations/pv-state');

let root;

beforeEach(() => {
  root = fs.mkdtempSync(path.join(os.tmpdir(), 'pvs-'));
});

afterEach(() => {
  fs.rmSync(root, { recursive: true, force: true });
});

test('readState returns defaults when file missing', () => {
  expect(readState({ root })).toEqual({ planvisualizerVersion: '0.0.0', appliedMigrations: [] });
});

test('writeState persists shared fields only', () => {
  fs.mkdirSync(path.join(root, 'docs'));
  writeState({ root, state: { planvisualizerVersion: '2.5.0', appliedMigrations: ['001'] } });
  const raw = JSON.parse(fs.readFileSync(path.join(root, 'docs', '.pv-state.json'), 'utf8'));
  expect(raw.planvisualizerVersion).toBe('2.5.0');
  expect(raw.appliedMigrations).toEqual(['001']);
  expect(raw.lastUpgradeAt).toBeUndefined();
});

test('writeLocalState persists local fields only', () => {
  fs.mkdirSync(path.join(root, 'docs'));
  writeLocalState({ root, state: { lastUpgradeAt: '2026-05-19T14:00:00Z', lastUpgradeBy: 'k' } });
  const raw = JSON.parse(fs.readFileSync(path.join(root, 'docs', '.pv-state.local.json'), 'utf8'));
  expect(raw.lastUpgradeAt).toBe('2026-05-19T14:00:00Z');
});

test('readLocalState returns {} when file missing', () => {
  expect(readLocalState({ root })).toEqual({});
});

test('readLocalState round-trips written state', () => {
  fs.mkdirSync(path.join(root, 'docs'));
  writeLocalState({ root, state: { lastUpgradeAt: '2026-05-19T14:00:00Z', lastUpgradeBy: 'k' } });
  const result = readLocalState({ root });
  expect(result.lastUpgradeAt).toBe('2026-05-19T14:00:00Z');
  expect(result.lastUpgradeBy).toBe('k');
});
