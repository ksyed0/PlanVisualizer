'use strict';
const fs = require('fs');
const path = require('path');
const os = require('os');
const { Repository } = require('../../../../tools/lib/repository');

describe('Migration 003: widen status CHECK to include Retired', () => {
  let root, repo;

  beforeEach(() => {
    root = fs.mkdtempSync(path.join(os.tmpdir(), 'mig003-'));
    fs.mkdirSync(path.join(root, 'docs'));
    fs.writeFileSync(path.join(root, 'docs', 'RELEASE_PLAN.md'), '');
    Repository._reset();
    repo = Repository.getInstance({ root });
  });
  afterEach(() => {
    Repository._reset();
    fs.rmSync(root, { recursive: true, force: true });
  });

  test('epics.status accepts Retired post-migration', () => {
    expect(() =>
      repo.index
        .prepare(
          "INSERT INTO epics(id,title,status,release_target,source_file,source_line) VALUES('EPIC-9999','Retired Epic','Retired',NULL,'docs/RELEASE_PLAN.md',NULL)",
        )
        .run(),
    ).not.toThrow();
    expect(repo.index.prepare("SELECT status FROM epics WHERE id='EPIC-9999'").get().status).toBe('Retired');
  });

  test('stories.status accepts Retired post-migration', () => {
    repo.index
      .prepare(
        "INSERT INTO epics(id,title,status,release_target,source_file,source_line) VALUES('EPIC-9998','Parent','Done',NULL,'docs/RELEASE_PLAN.md',NULL)",
      )
      .run();
    expect(() =>
      repo.index
        .prepare(
          "INSERT INTO stories(id,epic_id,title,status,priority,estimate,branch,pr_number,spec_path,plan_path,source_file,source_line) VALUES('US-9999','EPIC-9998','Retired Story','Retired',NULL,NULL,NULL,NULL,NULL,NULL,'docs/RELEASE_PLAN.md',NULL)",
        )
        .run(),
    ).not.toThrow();
  });

  test('still rejects unknown status', () => {
    expect(() =>
      repo.index
        .prepare(
          "INSERT INTO epics(id,title,status,release_target,source_file,source_line) VALUES('EPIC-9997','Bad','Cancelled',NULL,'docs/RELEASE_PLAN.md',NULL)",
        )
        .run(),
    ).toThrow(/CHECK constraint failed/);
  });

  test('migration is idempotent (re-running getInstance is a no-op)', () => {
    Repository._reset();
    const repo2 = Repository.getInstance({ root });
    expect(repo2.index.prepare('SELECT COUNT(*) AS n FROM epics').get().n).toBe(0);
  });
});
