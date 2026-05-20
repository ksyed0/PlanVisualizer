'use strict';
const fs = require('fs');
const path = require('path');
const os = require('os');
const { openIndexDatastore } = require('../../../tools/lib/repository/index-datastore');
const { applySchemaMigrations } = require('../../../tools/lib/repository/schema');
const { runCrossEntityChecks } = require('../../../tools/lib/repository/validators/cross-entity');

test('flags story with non-existent epic dependency', () => {
  const dbPath = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'ce-')), 'pv.db');
  const ds = openIndexDatastore({ path: dbPath });
  applySchemaMigrations(ds);
  ds.prepare('INSERT INTO epics(id,title,status,source_file) VALUES(?,?,?,?)').run('EPIC-0001', 'E1', 'Done', 'r.md');
  ds.prepare('INSERT INTO stories(id,epic_id,title,status,source_file) VALUES(?,?,?,?,?)').run(
    'US-0001',
    'EPIC-0001',
    'S1',
    'Done',
    'r.md',
  );
  // Temporarily disable FK enforcement to seed a dangling reference for test purposes
  ds.exec('PRAGMA foreign_keys = OFF');
  ds.prepare('INSERT INTO story_dependencies(story_id,depends_on_story_id) VALUES(?,?)').run('US-0001', 'US-9999');
  ds.exec('PRAGMA foreign_keys = ON');
  const w = runCrossEntityChecks({ index: ds });
  expect(w.find((x) => x.code === 'dangling-dependency')).toBeDefined();
  ds.close();
});

test('flags id-registry drift when next_id ≤ max(existing)', () => {
  const dbPath = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'ce-')), 'pv.db');
  const ds = openIndexDatastore({ path: dbPath });
  applySchemaMigrations(ds);
  ds.prepare('INSERT INTO epics(id,title,status,source_file) VALUES(?,?,?,?)').run('EPIC-0005', 'E', 'Done', 'r.md');
  ds.prepare('INSERT INTO id_registry(sequence,next_id,last_assigned) VALUES(?,?,?)').run(
    'EPIC',
    'EPIC-0005',
    'EPIC-0004',
  );
  const w = runCrossEntityChecks({ index: ds });
  expect(w.find((x) => x.code === 'id-registry-drift' && x.sequence === 'EPIC')).toBeDefined();
  ds.close();
});
