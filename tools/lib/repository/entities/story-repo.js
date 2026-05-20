'use strict';
const { BaseRepo } = require('./base-repo');

function mapStory(r) {
  return {
    id: r.id,
    epicId: r.epic_id,
    title: r.title,
    status: r.status,
    priority: r.priority,
    estimate: r.estimate,
    branch: r.branch,
    prNumber: r.pr_number,
    specPath: r.spec_path,
    planPath: r.plan_path,
    sourceFile: r.source_file,
    sourceLine: r.source_line,
  };
}

class StoryRepo extends BaseRepo {
  constructor(index, root) {
    super({ index, table: 'stories', mapRow: mapStory, root });
  }
  list({ epicId, status } = {}) {
    const where = [],
      args = [];
    if (epicId) {
      where.push('epic_id=?');
      args.push(epicId);
    }
    if (status) {
      if (Array.isArray(status)) {
        where.push(`status IN (${status.map(() => '?').join(',')})`);
        args.push(...status);
      } else {
        where.push('status=?');
        args.push(status);
      }
    }
    const sql = `SELECT * FROM stories${where.length ? ' WHERE ' + where.join(' AND ') : ''} ORDER BY id`;
    return this.index
      .prepare(sql)
      .all(...args)
      .map(mapStory);
  }
}
module.exports = { StoryRepo };
