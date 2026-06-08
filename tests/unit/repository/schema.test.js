// tests/unit/repository/schema.test.js
const fs = require('fs');
const path = require('path');
const os = require('os');
const { openIndexDatastore } = require('../../../tools/lib/repository/index-datastore');
const { applySchemaMigrations, getSchemaVersion } = require('../../../tools/lib/repository/schema');

describe('schema migrations', () => {
  let dbPath;
  let tmpDir;
  let ds;
  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 's-'));
    dbPath = path.join(tmpDir, 'pv.db');
  });
  afterEach(() => {
    if (ds) {
      try {
        ds.close();
      } catch {
        /* ignore */
      }
      ds = undefined;
    }
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  test('applies all migrations on a fresh db', () => {
    ds = openIndexDatastore({ path: dbPath });
    applySchemaMigrations(ds);
    expect(getSchemaVersion(ds)).toBe(5);
    const tables = ds
      .prepare("SELECT name FROM sqlite_master WHERE type='table' ORDER BY name")
      .all()
      .map((r) => r.name);
    expect(tables).toEqual(
      expect.arrayContaining([
        'epics',
        'stories',
        'acs',
        'planning_tasks',
        'bugs',
        'lessons',
        'test_cases',
        'id_registry',
        'story_dependencies',
        'epic_dependencies',
        'lesson_agents',
        'bug_stories',
        'sdlc_tasks',
        'sdlc_events',
        'sdlc_programme',
        'cost_rows',
        'coverage',
        'meta_sources',
        'meta_status',
        'warnings',
      ]),
    );
  });

  test('is idempotent — running twice does not fail', () => {
    ds = openIndexDatastore({ path: dbPath });
    applySchemaMigrations(ds);
    applySchemaMigrations(ds);
    expect(getSchemaVersion(ds)).toBe(5);
  });
});
