'use strict';

/**
 * SdlcTaskRepo — upsert-by-id store of SDLC task state.
 *
 * `upsert(task)` reads the existing row (if any), merges only the fields
 * present on the input (camelCase keys → snake_case columns via FIELD_MAP),
 * then INSERTs or UPDATEs and asks the SdlcMirror to re-render JSON. Fields
 * not present on the input are preserved.
 */

const COLUMNS = [
  'id',
  'story_id',
  'agent',
  'status',
  'started_at',
  'completed_at',
  'plan_task_index',
  'summary',
  'model',
  'model_rationale',
  'task_review_json',
  'base_sha',
  'head_sha',
  // Added in schema migration 005 (US-0234 / TASK-0058) so the agent-lifecycle
  // CLI can round-trip its full task record through SQL without losing fields.
  'description',
  'concerns',
  'blocked_reason',
  'blocked_resolutions_json',
  'retry_count',
];

const FIELD_MAP = {
  id: 'id',
  storyId: 'story_id',
  agent: 'agent',
  status: 'status',
  startedAt: 'started_at',
  completedAt: 'completed_at',
  planTaskIndex: 'plan_task_index',
  summary: 'summary',
  model: 'model',
  modelRationale: 'model_rationale',
  taskReview: 'task_review_json',
  baseSha: 'base_sha',
  headSha: 'head_sha',
  description: 'description',
  concerns: 'concerns',
  blockedReason: 'blocked_reason',
  blockedResolutions: 'blocked_resolutions_json',
  retryCount: 'retry_count',
};

// camelCase keys whose values must be JSON.stringify-d before they hit SQL.
const JSON_FIELDS = new Set(['taskReview', 'blockedResolutions']);

class SdlcTaskRepo {
  constructor({ index, mirror }) {
    this.index = index;
    this.mirror = mirror;
  }

  async upsert(task) {
    const existing = task.id ? this.index.prepare('SELECT * FROM sdlc_tasks WHERE id=?').get(task.id) : null;
    const merged = { ...(existing || {}) };
    for (const [k, col] of Object.entries(FIELD_MAP)) {
      if (k in task) {
        merged[col] = JSON_FIELDS.has(k) ? JSON.stringify(task[k]) : task[k];
      }
    }
    if (existing) {
      const updatableCols = COLUMNS.filter((c) => c !== 'id');
      const sets = updatableCols.map((c) => `${c}=?`).join(',');
      const args = updatableCols.map((c) => (merged[c] === undefined ? null : merged[c]));
      this.index.prepare(`UPDATE sdlc_tasks SET ${sets} WHERE id=?`).run(...args, task.id);
    } else {
      const args = COLUMNS.map((c) => (merged[c] === undefined ? null : merged[c]));
      this.index
        .prepare(`INSERT INTO sdlc_tasks(${COLUMNS.join(',')}) VALUES(${COLUMNS.map(() => '?').join(',')})`)
        .run(...args);
    }
    await this.mirror.write();
    return this.index.prepare('SELECT * FROM sdlc_tasks WHERE id=?').get(task.id);
  }

  get(id) {
    return this.index.prepare('SELECT * FROM sdlc_tasks WHERE id=?').get(id);
  }

  list({ storyId } = {}) {
    if (storyId) return this.index.prepare('SELECT * FROM sdlc_tasks WHERE story_id=?').all(storyId);
    return this.index.prepare('SELECT * FROM sdlc_tasks').all();
  }
}

module.exports = { SdlcTaskRepo, COLUMNS, FIELD_MAP };
