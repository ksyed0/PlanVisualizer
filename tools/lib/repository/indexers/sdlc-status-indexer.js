'use strict';
const fs = require('fs');

function indexSdlcStatusJson({ index, markdown, rel }) {
  const abs = markdown.absolute(rel);
  if (!fs.existsSync(abs)) return { counts: {}, warnings: [] };
  const data = JSON.parse(fs.readFileSync(abs, 'utf8'));
  let taskCount = 0,
    eventCount = 0;
  index.transaction(() => {
    index.exec('DELETE FROM sdlc_tasks; DELETE FROM sdlc_events; DELETE FROM sdlc_programme;');
    const insTask = index.prepare(
      'INSERT INTO sdlc_tasks(id,story_id,agent,status,started_at,completed_at,plan_task_index,summary,model,model_rationale,task_review_json,base_sha,head_sha) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?)',
    );
    const insEvent = index.prepare('INSERT INTO sdlc_events(ts,kind,story_id,agent,payload_json) VALUES(?,?,?,?,?)');
    const insProg = index.prepare('INSERT INTO sdlc_programme(key,value_json) VALUES(?,?)');
    for (const t of data.tasks || []) {
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
      );
      taskCount++;
    }
    for (const e of data.log || []) {
      insEvent.run(e.ts || Date.now(), e.kind || 'unknown', e.storyId || null, e.agent || null, JSON.stringify(e));
      eventCount++;
    }
    if (data.programme) for (const [k, v] of Object.entries(data.programme)) insProg.run(k, JSON.stringify(v));
  });
  return { counts: { sdlc_tasks: taskCount, sdlc_events: eventCount }, warnings: [] };
}
module.exports = { indexSdlcStatusJson };
