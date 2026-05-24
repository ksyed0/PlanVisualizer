'use strict';
const { indexReleasePlan } = require('./release-plan-indexer');
const { indexBugs } = require('./bugs-indexer');
const { indexLessons } = require('./lessons-indexer');
const { indexTestCases } = require('./test-cases-indexer');
const { indexIdRegistry } = require('./id-registry-indexer');
// sdlc-status-indexer was retired by Phase D (US-0239/AC-1014) and the file
// was deleted in Phase E (US-0261). Do not re-add — see L-0082.

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
