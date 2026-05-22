'use strict';
const fs = require('fs');
const { createTryInsert } = require('../insert-helper');

// RETIRED — Phase D (EPIC-0039, US-0239/AC-1014, 2026-05-22).
// SQLite is now authoritative for sdlc-status; this indexer is no longer in
// the registry (see ../index.js MAP). It is retained as a reference for one
// release and will be deleted in Phase E.
// Do NOT re-add to the indexer registry — re-indexing the mirror back into
// SQL is circular (it DELETEs SQL state and re-ingests from JSON that was
// generated from that very SQL state) and crashes on the post-D.3 object-
// shape `tasks` key.
function indexSdlcStatusJson({ index, markdown, rel }) {
  const abs = markdown.absolute(rel);
  if (!fs.existsSync(abs)) return { counts: {}, warnings: [] };
  const data = JSON.parse(fs.readFileSync(abs, 'utf8'));
  const warnings = [];
  let taskCount = 0,
    eventCount = 0;
  index.transaction(() => {
    index.exec('DELETE FROM sdlc_tasks; DELETE FROM sdlc_events; DELETE FROM sdlc_programme;');
    const insTask = index.prepare(
      'INSERT INTO sdlc_tasks(id,story_id,agent,status,started_at,completed_at,plan_task_index,summary,model,model_rationale,task_review_json,base_sha,head_sha) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?)',
    );
    const insEvent = index.prepare('INSERT INTO sdlc_events(ts,kind,story_id,agent,payload_json) VALUES(?,?,?,?,?)');
    const insProg = index.prepare('INSERT INTO sdlc_programme(key,value_json) VALUES(?,?)');
    const tryInsert = createTryInsert({ warnings });
    for (const t of data.tasks || []) {
      if (
        tryInsert(
          () =>
            insTask.run(
              t.id,
              t.storyId || null,
              t.agent || null,
              t.status || null,
              t.startedAt || null,
              t.completedAt || null,
              t.planTaskIndex || null,
              t.summary || null,
              t.model || null,
              t.modelRationale || null,
              t.taskReview ? JSON.stringify(t.taskReview) : null,
              t.baseSha || null,
              t.headSha || null,
            ),
          t.id,
        )
      ) {
        taskCount++;
      }
    }
    for (const e of data.log || []) {
      const ts = e.ts || Date.now();
      const kind = e.kind || 'unknown';
      if (
        tryInsert(() => insEvent.run(ts, kind, e.storyId || null, e.agent || null, JSON.stringify(e)), `${kind}@${ts}`)
      ) {
        eventCount++;
      }
    }
    if (data.programme) {
      for (const [k, v] of Object.entries(data.programme)) {
        tryInsert(() => insProg.run(k, JSON.stringify(v)), k);
      }
    }
  });
  return { counts: { sdlc_tasks: taskCount, sdlc_events: eventCount }, warnings };
}
module.exports = { indexSdlcStatusJson };
