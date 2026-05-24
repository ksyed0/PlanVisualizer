'use strict';

/**
 * US-0261 / AC-1020 hard-gate #1: the sdlc-mirror.js preservation block
 * (Phase D scaffolding that copied legacy top-level JSON keys forward
 * across mirror writes) must be deleted in Phase E.
 *
 * Source-grep test rather than behavior test because the absence of code
 * is precisely what's being asserted. Spec §6.1 row 1.
 */

const fs = require('fs');
const path = require('path');

const SDLC_MIRROR_PATH = path.join(__dirname, '..', '..', '..', 'tools', 'lib', 'repository', 'sdlc-mirror.js');

describe('US-0261 / AC-1020: sdlc-mirror.js has no preservation block', () => {
  const source = fs.readFileSync(SDLC_MIRROR_PATH, 'utf8');

  it('contains no "Preserve any extra top-level keys" comment', () => {
    // The exact wording in the comment block from the original
    // preservation scaffolding.
    expect(source).not.toMatch(/Preserve any extra top-level keys/);
  });

  it('contains no "TRANSITIONAL DEBT" marker', () => {
    // The marker phrase the original block used to flag itself for removal.
    expect(source).not.toMatch(/TRANSITIONAL DEBT/);
  });

  it('contains no copy-forward loop iterating Object.entries of the on-disk JSON', () => {
    // The structural pattern of the preservation loop: reading the on-disk
    // JSON and copying keys not already in `out`. If this pattern survives
    // in any form, the gate fails.
    expect(source).not.toMatch(/Object\.entries\(existing\)/);
  });
});
