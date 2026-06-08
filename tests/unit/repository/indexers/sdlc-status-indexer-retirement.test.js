'use strict';

// AC-1014 (Phase D / EPIC-0039 / US-0239) — regression guard for the indexer
// retirement. After Phase D, `docs/sdlc-status.json` is a SQL-rendered mirror,
// not an indexable source. Re-indexing the mirror back into SQL is circular
// and crashes on the post-D.3 object-shape `tasks` key. This test pins the
// retirement so a future change to the registry can't silently reintroduce
// the crash.

const fs = require('fs');
const path = require('path');
const os = require('os');

const { indexAll } = require('../../../../tools/lib/repository/indexers');
const { MANAGED_SOURCES, Repository } = require('../../../../tools/lib/repository');

describe('sdlc-status indexer retirement (AC-1014)', () => {
  test('docs/sdlc-status.json is not in MANAGED_SOURCES', () => {
    expect(MANAGED_SOURCES).not.toContain('docs/sdlc-status.json');
  });

  test('indexAll does not crash when docs/sdlc-status.json has object-shape tasks', () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'pv-indexer-retire-'));
    try {
      fs.mkdirSync(path.join(root, 'docs'), { recursive: true });
      // Write a minimal mirror in the post-D.3 object-map shape that crashed
      // the legacy indexer (TypeError: object is not iterable).
      fs.writeFileSync(
        path.join(root, 'docs', 'sdlc-status.json'),
        JSON.stringify({
          tasks: { 'task-a': { id: 'task-a', status: 'running' } },
          log: [],
          programme: {},
        }),
      );
      // Seed an empty RELEASE_PLAN so other indexers don't error on absence.
      fs.writeFileSync(path.join(root, 'docs', 'RELEASE_PLAN.md'), '# Release Plan\n');

      Repository._reset();
      const repo = new Repository({ root, dbPath: path.join(root, '.cache', 'pv.db') });
      try {
        // The act under test — must not throw.
        const result = indexAll({
          index: repo.index,
          markdown: repo.markdown,
          warningsChannel: repo.warningsChannel,
        });
        expect(result.warnings.find((w) => /not iterable/i.test(w.message || ''))).toBeUndefined();
      } finally {
        repo.close();
        Repository._reset();
      }
    } finally {
      fs.rmSync(root, { recursive: true, force: true });
    }
  });
});
