-- tools/lib/repository/migrations/003_widen_status_check.sql
-- Widens epics.status and stories.status CHECK constraints to allow 'Retired'.
-- SQLite has no ALTER TABLE ... ALTER CHECK, so we rebuild the tables.
-- See L-0076 and design spec docs/superpowers/specs/2026-05-21-phase-c5-indexer-hardening-design.md.

PRAGMA foreign_keys = OFF;

CREATE TABLE epics_new (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('To Do','Planned','In Progress','Blocked','Done','Retired')),
  release_target TEXT,
  source_file TEXT NOT NULL,
  source_line INTEGER,
  source_hash TEXT
);
INSERT INTO epics_new SELECT * FROM epics;
DROP TABLE epics;
ALTER TABLE epics_new RENAME TO epics;

CREATE TABLE stories_new (
  id TEXT PRIMARY KEY,
  epic_id TEXT REFERENCES epics(id),
  title TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('To Do','Planned','In Progress','Blocked','Done','Retired')),
  priority TEXT,
  estimate TEXT,
  branch TEXT,
  pr_number INTEGER,
  spec_path TEXT,
  plan_path TEXT,
  source_file TEXT NOT NULL,
  source_line INTEGER
);
INSERT INTO stories_new SELECT * FROM stories;
DROP TABLE stories;
ALTER TABLE stories_new RENAME TO stories;
CREATE INDEX IF NOT EXISTS idx_stories_epic_status ON stories(epic_id, status);

PRAGMA foreign_keys = ON;
