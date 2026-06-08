-- tools/lib/repository/migrations/001_initial_schema.sql
CREATE TABLE IF NOT EXISTS meta_status (
  key TEXT PRIMARY KEY,
  value TEXT
);

CREATE TABLE IF NOT EXISTS meta_sources (
  path TEXT PRIMARY KEY,
  mtime INTEGER NOT NULL,
  size INTEGER NOT NULL,
  hash TEXT NOT NULL,
  last_indexed INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS warnings (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  ts INTEGER NOT NULL,
  level TEXT NOT NULL,
  entity_id TEXT,
  source_file TEXT,
  message TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS epics (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('To Do','Planned','In Progress','Blocked','Done')),
  release_target TEXT,
  source_file TEXT NOT NULL,
  source_line INTEGER,
  source_hash TEXT
);

CREATE TABLE IF NOT EXISTS stories (
  id TEXT PRIMARY KEY,
  epic_id TEXT REFERENCES epics(id),
  title TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('To Do','Planned','In Progress','Blocked','Done')),
  priority TEXT,
  estimate TEXT,
  branch TEXT,
  pr_number INTEGER,
  spec_path TEXT,
  plan_path TEXT,
  source_file TEXT NOT NULL,
  source_line INTEGER
);
CREATE INDEX IF NOT EXISTS idx_stories_epic_status ON stories(epic_id, status);

CREATE TABLE IF NOT EXISTS acs (
  id TEXT PRIMARY KEY,
  story_id TEXT REFERENCES stories(id) ON DELETE CASCADE,
  checked INTEGER NOT NULL DEFAULT 0,
  text TEXT NOT NULL,
  position INTEGER
);
CREATE INDEX IF NOT EXISTS idx_acs_story ON acs(story_id);

CREATE TABLE IF NOT EXISTS planning_tasks (
  id TEXT PRIMARY KEY,
  story_id TEXT REFERENCES stories(id) ON DELETE CASCADE,
  status TEXT
);

CREATE TABLE IF NOT EXISTS bugs (
  id TEXT PRIMARY KEY,
  status TEXT NOT NULL CHECK (status IN ('Open','In Progress','Fixed','Wontfix','Done')),
  severity TEXT,
  source_file TEXT NOT NULL,
  source_line INTEGER
);

CREATE TABLE IF NOT EXISTS lessons (
  id TEXT PRIMARY KEY,
  text TEXT NOT NULL,
  source_file TEXT NOT NULL,
  source_line INTEGER
);

CREATE TABLE IF NOT EXISTS test_cases (
  id TEXT PRIMARY KEY,
  story_id TEXT REFERENCES stories(id) ON DELETE CASCADE,
  title TEXT,
  status TEXT
);

CREATE TABLE IF NOT EXISTS id_registry (
  sequence TEXT PRIMARY KEY,
  next_id TEXT NOT NULL,
  last_assigned TEXT
);

CREATE TABLE IF NOT EXISTS sdlc_tasks (
  id TEXT PRIMARY KEY,
  story_id TEXT,
  agent TEXT,
  status TEXT,
  started_at INTEGER,
  completed_at INTEGER,
  plan_task_index INTEGER,
  summary TEXT,
  model TEXT,
  model_rationale TEXT,
  task_review_json TEXT,
  base_sha TEXT,
  head_sha TEXT
);
CREATE INDEX IF NOT EXISTS idx_sdlc_tasks_story ON sdlc_tasks(story_id);

CREATE TABLE IF NOT EXISTS sdlc_events (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  ts INTEGER NOT NULL,
  kind TEXT NOT NULL,
  story_id TEXT,
  agent TEXT,
  payload_json TEXT
);
CREATE INDEX IF NOT EXISTS idx_sdlc_events_story_ts ON sdlc_events(story_id, ts);

CREATE TABLE IF NOT EXISTS sdlc_programme (
  key TEXT PRIMARY KEY,
  value_json TEXT
);

CREATE TABLE IF NOT EXISTS cost_rows (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  ts INTEGER NOT NULL,
  session_id TEXT,
  tokens_in INTEGER,
  tokens_out INTEGER,
  model TEXT,
  story_id TEXT,
  source_file TEXT
);

CREATE TABLE IF NOT EXISTS coverage (
  snapshot_at INTEGER PRIMARY KEY,
  statements_pct REAL,
  branches_pct REAL,
  functions_pct REAL,
  lines_pct REAL
);
