'use strict';

/**
 * US-0261: pv:doctor un-upgraded-clone detection.
 *
 * Scenario: a developer pulls develop with US-0259/0260/0261/0262 all
 * merged but hasn't yet run pv:upgrade locally. Their docs/sdlc-status.json
 * still has legacy top-level keys (state-B or state-C shape). Their
 * pv-state.json's appliedMigrations does NOT include
 * 'data_006-ingest-legacy-programme'. The dashboard would render empty
 * because the accessor's fallback is now gone (US-0261).
 *
 * pv:doctor must detect this state and print a clear remediation:
 * "Run `npm run pv:upgrade` to migrate state."
 */

const fs = require('fs');
const os = require('os');
const path = require('path');

const doctor = require('../../tools/pv-doctor');
const { Repository } = require('../../tools/lib/repository');

function mkRoot(prefix) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), prefix));
  fs.mkdirSync(path.join(root, 'docs'), { recursive: true });
  fs.writeFileSync(path.join(root, 'package.json'), JSON.stringify({ name: 't', version: '1.0.0' }));
  return root;
}

function writePvState(root, applied) {
  fs.mkdirSync(path.join(root, 'docs'), { recursive: true });
  fs.writeFileSync(
    path.join(root, 'docs', '.pv-state.json'),
    JSON.stringify({ planvisualizerVersion: '1.0.0', appliedMigrations: applied }, null, 2) + '\n',
  );
}

function writeStateBJson(root) {
  // Minimal state-B shape: legacy top-level keys present, programme empty.
  fs.writeFileSync(
    path.join(root, 'docs', 'sdlc-status.json'),
    JSON.stringify(
      {
        tasks: [],
        log: [],
        agents: { Forge: { status: 'idle' } },
        metrics: { storiesTotal: 5 },
      },
      null,
      2,
    ),
  );
}

function captureStdout(fn) {
  const lines = [];
  const orig = console.log;
  console.log = (s) => lines.push(String(s));
  try {
    fn();
  } finally {
    console.log = orig;
  }
  return lines.join('\n');
}

describe('US-0261: pv:doctor detects un-upgraded clone', () => {
  afterEach(() => Repository._reset());

  it('prints remediation when sdlc-status.json has legacy keys AND data_006 is not applied', () => {
    const root = mkRoot('us0261-doctor-needs-');
    try {
      writePvState(root, ['data_005-ingest-sdlc-status']); // 005 applied, 006 NOT
      writeStateBJson(root);

      const out = captureStdout(() => doctor.main({ root }));

      // Look for the remediation marker.
      expect(out).toMatch(/Run `npm run pv:upgrade`/);
      // The detection message names the migration.
      expect(out).toMatch(/data_006/);
    } finally {
      Repository._reset();
      fs.rmSync(root, { recursive: true, force: true });
    }
  });

  it('does NOT print remediation when data_006 is already applied', () => {
    const root = mkRoot('us0261-doctor-ok-');
    try {
      writePvState(root, ['data_005-ingest-sdlc-status', 'data_006-ingest-legacy-programme']);
      writeStateBJson(root);

      const out = captureStdout(() => doctor.main({ root }));
      expect(out).not.toMatch(/Run `npm run pv:upgrade`/);
    } finally {
      Repository._reset();
      fs.rmSync(root, { recursive: true, force: true });
    }
  });

  it('does NOT print remediation when sdlc-status.json has no legacy top-level keys', () => {
    const root = mkRoot('us0261-doctor-canonical-');
    try {
      writePvState(root, ['data_005-ingest-sdlc-status']); // 006 not applied but no legacy state to migrate
      fs.writeFileSync(
        path.join(root, 'docs', 'sdlc-status.json'),
        JSON.stringify({ tasks: [], log: [], programme: {} }, null, 2),
      );

      const out = captureStdout(() => doctor.main({ root }));
      expect(out).not.toMatch(/Run `npm run pv:upgrade`/);
    } finally {
      Repository._reset();
      fs.rmSync(root, { recursive: true, force: true });
    }
  });
});
