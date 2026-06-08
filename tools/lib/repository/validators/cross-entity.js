'use strict';

function maxId(rows) {
  let max = -1;
  for (const r of rows) {
    const n = parseInt(String(r.id).replace(/^\D+-/, ''), 10);
    if (n > max) max = n;
  }
  return max;
}

function runCrossEntityChecks({ index }) {
  const warnings = [];

  // Dangling story deps
  for (const r of index
    .prepare(
      'SELECT sd.story_id, sd.depends_on_story_id FROM story_dependencies sd LEFT JOIN stories s ON s.id=sd.depends_on_story_id WHERE s.id IS NULL',
    )
    .all()) {
    warnings.push({ code: 'dangling-dependency', entityId: r.story_id, missing: r.depends_on_story_id });
  }

  // Dangling epic deps
  for (const r of index
    .prepare(
      'SELECT ed.epic_id, ed.depends_on_epic_id FROM epic_dependencies ed LEFT JOIN epics e ON e.id=ed.depends_on_epic_id WHERE e.id IS NULL',
    )
    .all()) {
    warnings.push({ code: 'dangling-dependency', entityId: r.epic_id, missing: r.depends_on_epic_id });
  }

  // ID-registry drift
  // tbl is only ever one of the hardcoded values below — never user input — so interpolation is safe
  const sequenceToTable = {
    EPIC: 'epics',
    US: 'stories',
    AC: 'acs',
    TASK: 'planning_tasks',
    BUG: 'bugs',
    L: 'lessons',
    TC: 'test_cases',
  };
  for (const reg of index.prepare('SELECT sequence,next_id FROM id_registry').all()) {
    const tbl = sequenceToTable[reg.sequence];
    if (!tbl) continue;
    const rows = index.prepare(`SELECT id FROM ${tbl}`).all();
    if (!rows.length) continue;
    const max = maxId(rows);
    const next = parseInt(String(reg.next_id).replace(/^\D+-/, ''), 10);
    if (next <= max)
      warnings.push({ code: 'id-registry-drift', sequence: reg.sequence, next: reg.next_id, actualMax: max });
  }

  // Orphan ACs
  for (const r of index
    .prepare('SELECT a.id, a.story_id FROM acs a LEFT JOIN stories s ON s.id=a.story_id WHERE s.id IS NULL')
    .all()) {
    warnings.push({ code: 'orphan-ac', entityId: r.id, missingStory: r.story_id });
  }

  return warnings;
}

module.exports = { runCrossEntityChecks };
