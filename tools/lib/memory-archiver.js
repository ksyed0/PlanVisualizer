'use strict';

/**
 * Extract scope from a snapshot title — text before the first `(`, lowercased and trimmed.
 */
function scopeFromTitle(title) {
  const idx = title.indexOf('(');
  const scope = idx === -1 ? title : title.slice(0, idx);
  return scope.trim().toLowerCase();
}

/**
 * Select which files should be archived based on staleness + snapshot supersession.
 *
 * @param {Array<{path:string, mtime:number, category:string, scope?:string, date?:string}>} files
 * @param {{ now: number, staleDays: number }} opts
 * @returns {Array}
 */
function selectForArchive(files, opts) {
  const { now, staleDays } = opts;
  const thresholdMs = staleDays * 86400 * 1000;
  const archive = new Set();

  // Staleness rule: topics and sessions only.
  for (const f of files) {
    if ((f.category === 'topics' || f.category === 'sessions') && now - f.mtime > thresholdMs) {
      archive.add(f);
    }
  }

  // Snapshot supersession: group by scope; keep newest date per scope; archive the rest.
  const snapshots = files.filter((f) => f.category === 'snapshots');
  const byScope = new Map();
  for (const s of snapshots) {
    const scope = s.scope || '';
    if (!byScope.has(scope)) byScope.set(scope, []);
    byScope.get(scope).push(s);
  }
  for (const group of byScope.values()) {
    if (group.length <= 1) continue;
    group.sort((a, b) => (b.date || '').localeCompare(a.date || ''));
    for (let i = 1; i < group.length; i++) archive.add(group[i]);
  }

  return [...archive];
}

module.exports = { selectForArchive, scopeFromTitle };
