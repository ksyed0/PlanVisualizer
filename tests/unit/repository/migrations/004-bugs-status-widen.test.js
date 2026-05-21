'use strict';
const fs = require('fs');
const path = require('path');
const os = require('os');
const { Repository } = require('../../../../tools/lib/repository');

describe('Migration 004: widen bugs.status CHECK', () => {
  let root, repo;

  beforeEach(() => {
    root = fs.mkdtempSync(path.join(os.tmpdir(), 'mig004-'));
    fs.mkdirSync(path.join(root, 'docs'));
    Repository._reset();
    repo = Repository.getInstance({ root });
  });
  afterEach(() => {
    Repository._reset();
    fs.rmSync(root, { recursive: true, force: true });
  });

  test('bugs.status accepts Verified post-migration', () => {
    expect(() =>
      repo.index
        .prepare(
          "INSERT INTO bugs(id,status,severity,source_file,source_line) VALUES('BUG-9999','Verified',NULL,'docs/BUGS.md',NULL)",
        )
        .run(),
    ).not.toThrow();
    expect(repo.index.prepare("SELECT status FROM bugs WHERE id='BUG-9999'").get().status).toBe('Verified');
  });

  test('bugs.status accepts WontFix post-migration', () => {
    expect(() =>
      repo.index
        .prepare(
          "INSERT INTO bugs(id,status,severity,source_file,source_line) VALUES('BUG-9998','WontFix',NULL,'docs/BUGS.md',NULL)",
        )
        .run(),
    ).not.toThrow();
  });

  test('bugs.status accepts Closed post-migration', () => {
    expect(() =>
      repo.index
        .prepare(
          "INSERT INTO bugs(id,status,severity,source_file,source_line) VALUES('BUG-9997','Closed',NULL,'docs/BUGS.md',NULL)",
        )
        .run(),
    ).not.toThrow();
  });

  test('bugs.status still rejects unknown status', () => {
    expect(() =>
      repo.index
        .prepare(
          "INSERT INTO bugs(id,status,severity,source_file,source_line) VALUES('BUG-9996','Cancelled',NULL,'docs/BUGS.md',NULL)",
        )
        .run(),
    ).toThrow(/CHECK constraint failed/);
  });
});
