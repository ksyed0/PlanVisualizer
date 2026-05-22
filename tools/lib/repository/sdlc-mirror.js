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
      // Preserve any extra top-level keys that exist on the current
      // on-disk JSON (e.g. `stories`, `agents`, `metrics`) but are not yet
      // owned by a Phase D entity repo. Without this, a write from one
      // migrated writer (e.g. agent-lifecycle.js — D.3) would silently
      // drop state that other writers (update-sdlc-status.js — D.4) still
      // own in the JSON. Once every key has an entity repo this fallback
      // becomes unreachable. See US-0234 / TASK-0058.
      try {
        const existing = JSON.parse(fs.readFileSync(this.file, 'utf8'));
        if (existing && typeof existing === 'object' && !Array.isArray(existing)) {
          for (const [k, v] of Object.entries(existing)) {
            if (!(k in out)) out[k] = v;
          }
        }
      } catch {
        /* malformed or empty — fall through to pure SQL render */
      }
      const tmp = this.file + '.tmp';
      fs.writeFileSync(tmp, JSON.stringify(out, null, 2));
      fs.renameSync(tmp, this.file);
    });
  }

  _renderFromSql() {
    // Emit tasks as an object map keyed by id so downstream readers
    // (agent-context.js, the lifecycle CLI's `list`/`status` commands) can
    // continue to use `tasks[taskId]` and `Object.values(tasks)`. The map
    // shape is the pre-Phase-D legacy shape; preserving it keeps the JSON
    // mirror byte-compatible with consumers that have not migrated to read
    // through SQL yet.
    const tasks = {};
    for (const row of this.index.prepare('SELECT * FROM sdlc_tasks').all()) {
      const t = rowToTask(row);
      tasks[t.id] = t;
    }
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
  const blockedResolutions = r.blocked_resolutions_json ? JSON.parse(r.blocked_resolutions_json) : [];
  return {
    id: r.id,
    storyId: r.story_id,
    // Legacy `story` alias for callers (agent-context.js) that filter by
    // `t.story`. Keeping both keys avoids touching downstream readers.
    story: r.story_id,
    agent: r.agent,
    status: r.status,
    // Legacy `state` alias for callers that branch on `t.state`. The
    // canonical column is `status` — `state` is a read-only mirror.
    state: r.status,
    startedAt: r.started_at,
    completedAt: r.completed_at,
    planTaskIndex: r.plan_task_index,
    summary: r.summary,
    model: r.model,
    modelRationale: r.model_rationale,
    taskReview: r.task_review_json ? JSON.parse(r.task_review_json) : null,
    baseSha: r.base_sha,
    headSha: r.head_sha,
    description: r.description,
    concerns: r.concerns,
    blockedReason: r.blocked_reason,
    blockedResolutions,
    retryCount: r.retry_count,
  };
}

module.exports = { SdlcMirror, rowToTask };
