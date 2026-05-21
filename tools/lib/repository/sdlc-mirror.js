'use strict';

const fs = require('fs');
const path = require('path');
const { withFileLock } = require('./file-lock');

/**
 * SdlcMirror — writes `docs/sdlc-status.json` from SQL under a file lock.
 *
 * The lock guarantees that concurrent `record()`/`upsert()`/`set()` calls
 * never leave the JSON behind reality: each writer's `write()` re-queries
 * the full state from SQLite INSIDE the lock, so the last writer to release
 * the lock observes — and serialises — every committed SQL row.
 *
 * The mirror is fully re-rendered on every write rather than patched, so
 * the output is a pure function of SQL state and therefore byte-identical
 * across all four Phase D writers (agent-lifecycle, update-sdlc-status,
 * agent-task-review, agent-spec-plan).
 */
class SdlcMirror {
  constructor({ root, index }) {
    this.root = root;
    this.file = path.join(root, 'docs', 'sdlc-status.json');
    this.index = index;
  }

  async write() {
    fs.mkdirSync(path.dirname(this.file), { recursive: true });
    // Touch the file so proper-lockfile can acquire a lock on it.
    if (!fs.existsSync(this.file)) fs.writeFileSync(this.file, '{}');
    await withFileLock(this.file, async () => {
      const out = this._renderFromSql();
      const tmp = this.file + '.tmp';
      fs.writeFileSync(tmp, JSON.stringify(out, null, 2));
      fs.renameSync(tmp, this.file);
    });
  }

  _renderFromSql() {
    const tasks = this.index.prepare('SELECT * FROM sdlc_tasks').all().map(rowToTask);
    const log = this.index
      .prepare('SELECT * FROM sdlc_events ORDER BY id')
      .all()
      .map((r) => ({
        ts: r.ts,
        kind: r.kind,
        storyId: r.story_id,
        agent: r.agent,
        ...JSON.parse(r.payload_json),
      }));
    const programme = {};
    for (const r of this.index.prepare('SELECT * FROM sdlc_programme').all()) {
      programme[r.key] = JSON.parse(r.value_json);
    }
    return { tasks, log, programme };
  }
}

function rowToTask(r) {
  return {
    id: r.id,
    storyId: r.story_id,
    agent: r.agent,
    status: r.status,
    startedAt: r.started_at,
    completedAt: r.completed_at,
    planTaskIndex: r.plan_task_index,
    summary: r.summary,
    model: r.model,
    modelRationale: r.model_rationale,
    taskReview: r.task_review_json ? JSON.parse(r.task_review_json) : null,
    baseSha: r.base_sha,
    headSha: r.head_sha,
  };
}

module.exports = { SdlcMirror, rowToTask };
