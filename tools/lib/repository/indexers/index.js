'use strict';
const { indexReleasePlan } = require('./release-plan-indexer');
const { indexBugs } = require('./bugs-indexer');
const { indexLessons } = require('./lessons-indexer');
const { indexTestCases } = require('./test-cases-indexer');
const { indexIdRegistry } = require('./id-registry-indexer');
// NOTE: indexSdlcStatusJson is retired by Phase D (EPIC-0039, US-0239/AC-1014).
// SQLite is now authoritative for sdlc-status; the on-disk JSON is a mirror
// rendered FROM SQL, not a source for ingest. Re-indexing the mirror back into
// SQL would be circular (DELETE + re-ingest from JSON that was just generated
// from that very SQL state) and crashes on the new object-shape `tasks` key.
// The implementation file `sdlc-status-indexer.js` is kept for one release as
// reference; delete in Phase E.

const MAP = {
  'docs/RELEASE_PLAN.md': indexReleasePlan,
  'docs/BUGS.md': indexBugs,
  'docs/LESSONS.md': indexLessons,
  'docs/TEST_CASES.md': indexTestCases,
  'docs/ID_REGISTRY.md': indexIdRegistry,
};

function indexAll({ index, markdown, warningsChannel }) {
  const counts = {};
  const warnings = [];
  for (const [rel, fn] of Object.entries(MAP)) {
    const result = fn({ index, markdown, rel });
    Object.assign(counts, result.counts);
    for (const w of result.warnings) {
      warningsChannel.append({ ...w, source_file: rel });
      warnings.push(w);
    }
  }
  return { counts, warnings };
}
module.exports = { indexAll };
