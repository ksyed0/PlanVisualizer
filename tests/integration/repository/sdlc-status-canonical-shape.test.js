'use strict';

/**
 * US-0261 / AC-1020 hard-gate #3: after pv:upgrade runs against a
 * state-B fixture (legacy top-level keys only), the on-disk
 * docs/sdlc-status.json has exactly {tasks, log, programme} — no
 * lingering top-level legacy keys.
 *
 * Models the test on tests/integration/repository/data_006-rollback-
 * roundtrip.test.js (US-0262). Same tmpdir setup, same runCli helper.
 *
 * Spec §6.1 row 4 / spec §2 hard gate 4.
 */

const fs = require('fs');
const os = require('os');
const path = require('path');

const { Repository } = require('../../../tools/lib/repository');
const upgrade = require('../../../tools/pv-upgrade');

const FIXTURE_DIR = path.join(__dirname, '..', '..', 'fixtures', 'phase-e');
const loadFixture = (name) => JSON.parse(fs.readFileSync(path.join(FIXTURE_DIR, name), 'utf8'));

function mkRoot() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'us0261-shape-'));
  fs.mkdirSync(path.join(root, 'docs'), { recursive: true });
  fs.writeFileSync(path.join(root, 'package.json'), JSON.stringify({ name: 't', version: '1.0.0' }));
  return root;
}

function runCli(mod, argv) {
  const out = [];
  return mod.main({ argv, stdout: (s) => out.push(s) }).then((rc) => ({ rc, stdout: out.join('\n') }));
}

describe('US-0261 / AC-1020: post-pv:upgrade JSON has canonical {tasks, log, programme} shape', () => {
  afterEach(() => Repository._reset());

  test('state-B → pv:upgrade → on-disk JSON has top-level keys === [log, programme, tasks]', async () => {
    const root = mkRoot();
    try {
      // Seed state-B (legacy top-level keys, empty programme).
      const stateB = loadFixture('state-b.json');
      fs.writeFileSync(path.join(root, 'docs', 'sdlc-status.json'), JSON.stringify(stateB, null, 2));

      // Run pv:upgrade. Migration 005 ingests tasks/log into SQL;
      // Migration 006 ingests the 9 legacy top-level keys into
      // sdlc_programme. Mirror re-renders post-each-migration; with
      // the preservation block deleted in Task 2, the final output
      // is canonical-only.
      Repository._reset();
      const up = await runCli(upgrade, ['--root', root]);
      expect(up.rc).toBe(0);
      expect(up.stdout).toMatch(/data_006-ingest-legacy-programme/);

      // Assert the canonical-only shape.
      const json = JSON.parse(fs.readFileSync(path.join(root, 'docs', 'sdlc-status.json'), 'utf8'));
      expect(Object.keys(json).sort()).toEqual(['log', 'programme', 'tasks']);

      // Spot-check programme was populated by Migration 006.
      expect(json.programme).toBeDefined();
      expect(Object.keys(json.programme).length).toBeGreaterThanOrEqual(9);
    } finally {
      Repository._reset();
      fs.rmSync(root, { recursive: true, force: true });
    }
  });
});
