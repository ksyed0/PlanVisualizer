'use strict';
const fs = require('fs');
const { parseReleasePlan } = require('../../parse-release-plan');

/**
 * Index docs/RELEASE_PLAN.md into SQLite using parseReleasePlan() as the
 * canonical entity extractor. Phase C.5 (EPIC-0042): the previous AST-based
 * implementation missed entities in prose nodes (L-0075) and silently dropped
 * rows on CHECK violations (L-0076). This rewrite delegates parsing to the
 * same regex-based extractor the dashboard read path uses, then INSERTs each
 * entity with try/catch routing CHECK violations to the warnings channel.
 */
function indexReleasePlan({ index, markdown, rel }) {
  const abs = markdown.absolute(rel);
  if (!fs.existsSync(abs)) return { counts: {}, warnings: [] };
  const raw = fs.readFileSync(abs, 'utf8');
  const { epics, stories, tasks } = parseReleasePlan(raw);
  const warnings = [];
  const counts = { epics: 0, stories: 0, acs: 0, tasks: 0 };
  const epicIds = new Set(epics.map((e) => e.id));
  const storyIds = new Set(stories.map((s) => s.id));
  const seenAcs = new Set();

  index.transaction(() => {
    index.exec(
      'DELETE FROM epic_dependencies; DELETE FROM story_dependencies; DELETE FROM acs; DELETE FROM planning_tasks; DELETE FROM stories; DELETE FROM epics;',
    );

    const insEpic = index.prepare(
      'INSERT INTO epics(id,title,status,release_target,source_file,source_line) VALUES(?,?,?,?,?,?)',
    );
    const insStory = index.prepare(
      'INSERT INTO stories(id,epic_id,title,status,priority,estimate,branch,pr_number,spec_path,plan_path,source_file,source_line) VALUES(?,?,?,?,?,?,?,?,?,?,?,?)',
    );
    const insAc = index.prepare('INSERT INTO acs(id,story_id,checked,text,position) VALUES(?,?,?,?,?)');
    const insTask = index.prepare('INSERT INTO planning_tasks(id,story_id,status) VALUES(?,?,?)');

    const tryInsert = (fn, entityId) => {
      try {
        fn();
        return true;
      } catch (e) {
        if (e.code === 'SQLITE_CONSTRAINT_CHECK') {
          warnings.push({ code: 'check-rejected', entityId, message: e.message });
          return false;
        }
        throw e;
      }
    };

    for (const e of epics) {
      if (tryInsert(() => insEpic.run(e.id, e.title, e.status || 'To Do', e.releaseTarget || null, rel, null), e.id)) {
        counts.epics++;
      }
    }
    for (const s of stories) {
      if (!epicIds.has(s.epicId)) {
        warnings.push({
          code: 'dangling-dependency',
          entityId: s.id,
          missing: s.epicId,
          message: `Story ${s.id} references epic ${s.epicId} not found in ${rel}`,
        });
        continue;
      }
      const inserted = tryInsert(
        () =>
          insStory.run(
            s.id,
            s.epicId,
            s.title,
            s.status || 'To Do',
            s.priority || null,
            s.estimate || null,
            s.branch || null,
            s.prNumber,
            s.specPath,
            s.planPath,
            rel,
            null,
          ),
        s.id,
      );
      if (!inserted) continue;
      counts.stories++;
      let acPos = 0;
      for (const a of s.acs) {
        if (seenAcs.has(a.id)) {
          warnings.push({
            code: 'duplicate-ac',
            entityId: a.id,
            message: `AC ${a.id} declared more than once; later occurrence ignored`,
          });
          continue;
        }
        if (tryInsert(() => insAc.run(a.id, s.id, a.done ? 1 : 0, a.text, acPos), a.id)) {
          seenAcs.add(a.id);
          counts.acs++;
          acPos++;
        }
      }
    }
    for (const t of tasks) {
      if (!storyIds.has(t.storyId)) {
        warnings.push({
          code: 'dangling-dependency',
          entityId: t.id,
          missing: t.storyId,
          message: `Task ${t.id} references story ${t.storyId} not found in ${rel}`,
        });
        continue;
      }
      if (tryInsert(() => insTask.run(t.id, t.storyId, t.status || null), t.id)) {
        counts.tasks++;
      }
    }
  });
  return { counts, warnings };
}

module.exports = { indexReleasePlan };
