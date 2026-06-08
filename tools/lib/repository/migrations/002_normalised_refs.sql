-- tools/lib/repository/migrations/002_normalised_refs.sql
CREATE TABLE IF NOT EXISTS story_dependencies (
  story_id TEXT NOT NULL REFERENCES stories(id) ON DELETE CASCADE,
  depends_on_story_id TEXT NOT NULL REFERENCES stories(id) ON DELETE CASCADE,
  PRIMARY KEY (story_id, depends_on_story_id)
);

CREATE TABLE IF NOT EXISTS epic_dependencies (
  epic_id TEXT NOT NULL REFERENCES epics(id) ON DELETE CASCADE,
  depends_on_epic_id TEXT NOT NULL REFERENCES epics(id) ON DELETE CASCADE,
  PRIMARY KEY (epic_id, depends_on_epic_id)
);

CREATE TABLE IF NOT EXISTS lesson_agents (
  lesson_id TEXT NOT NULL REFERENCES lessons(id) ON DELETE CASCADE,
  agent_name TEXT NOT NULL,
  PRIMARY KEY (lesson_id, agent_name)
);

CREATE TABLE IF NOT EXISTS bug_stories (
  bug_id TEXT NOT NULL REFERENCES bugs(id) ON DELETE CASCADE,
  story_id TEXT NOT NULL REFERENCES stories(id) ON DELETE CASCADE,
  PRIMARY KEY (bug_id, story_id)
);
