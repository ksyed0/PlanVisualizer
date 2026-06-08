'use strict';
const fs = require('fs');

function refresh({ datastores, sources }) {
  const { index, markdown } = datastores;
  if (index.mode === 'no-index') return { sources: [], entitiesAffected: [] };
  const changed = [];
  for (const rel of sources) {
    const abs = markdown.absolute(rel);
    if (!fs.existsSync(abs)) continue;
    const meta = markdown.sourceMeta(rel);
    const row = index.prepare('SELECT mtime, size, hash FROM meta_sources WHERE path=?').get(rel);
    if (!row || row.mtime !== meta.mtime || row.size !== meta.size) {
      // second-pass: only re-hash if mtime+size differ
      if (!row || row.hash !== meta.hash) changed.push(rel);
    }
  }
  return { sources: changed, entitiesAffected: [] /* filled in by per-entity refreshers in B+ */ };
}

module.exports = { refresh };
