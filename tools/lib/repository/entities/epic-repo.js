'use strict';
const { BaseRepo } = require('./base-repo');

function mapEpic(r) {
  return {
    id: r.id,
    title: r.title,
    status: r.status,
    releaseTarget: r.release_target,
    sourceFile: r.source_file,
    sourceLine: r.source_line,
  };
}

class EpicRepo extends BaseRepo {
  constructor(index, root) {
    super({ index, table: 'epics', mapRow: mapEpic, root });
  }
  list({ status } = {}) {
    if (status) return this.index.prepare('SELECT * FROM epics WHERE status=? ORDER BY id').all(status).map(mapEpic);
    return this.index.prepare('SELECT * FROM epics ORDER BY id').all().map(mapEpic);
  }
}
module.exports = { EpicRepo };
