'use strict';

/**
 * US-0261 / AC-1020 hard-gate #2: the retired sdlc-status-indexer.js file
 * must be deleted in Phase E. The indexer was removed from the registry
 * in Phase D (US-0239/AC-1014) but the file was kept "for one release as
 * reference" — that grace period ends with this story.
 *
 * Spec §6.1 row 2. Simple filesystem assertion.
 */

const fs = require('fs');
const path = require('path');

const INDEXER_PATH = path.join(
  __dirname,
  '..',
  '..',
  '..',
  'tools',
  'lib',
  'repository',
  'indexers',
  'sdlc-status-indexer.js',
);

describe('US-0261 / AC-1020: sdlc-status-indexer.js is deleted', () => {
  it('the file does not exist on disk', () => {
    expect(fs.existsSync(INDEXER_PATH)).toBe(false);
  });
});
