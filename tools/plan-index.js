#!/usr/bin/env node
'use strict';
const { Repository } = require('./lib/repository');
const { indexAll } = require('./lib/repository/indexers');

function main() {
  const root = process.cwd();
  const repo = Repository.getInstance({ root });
  try {
    const { counts, warnings } = indexAll({
      index: repo.index,
      markdown: repo.markdown,
      warningsChannel: repo.warningsChannel,
    });
    console.log('[plan:index] counts:', counts);
    console.log(`[plan:index] warnings emitted: ${warnings.length}`);
  } finally {
    try {
      repo.close();
    } catch {
      /* ignore */
    }
    Repository._reset();
  }
}
if (require.main === module) main();
module.exports = { main };
