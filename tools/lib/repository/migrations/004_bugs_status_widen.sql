-- tools/lib/repository/migrations/004_bugs_status_widen.sql
-- Widens bugs.status CHECK to the canonical set:
--   Open | In Progress | Fixed | Verified | WontFix | Closed
-- Drops the previous values Wontfix and Done (no production rows use them).
-- SQLite has no ALTER TABLE ... ALTER CHECK, so we rebuild the table.
-- See ENH-0003 design spec.

PRAGMA foreign_keys = OFF;

CREATE TABLE bugs_new (
  id TEXT PRIMARY KEY,
  status TEXT NOT NULL CHECK (status IN ('Open','In Progress','Fixed','Verified','WontFix','Closed')),
  severity TEXT,
  source_file TEXT NOT NULL,
  source_line INTEGER
);
INSERT INTO bugs_new SELECT * FROM bugs;
DROP TABLE bugs;
ALTER TABLE bugs_new RENAME TO bugs;

PRAGMA foreign_keys = ON;
