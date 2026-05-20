'use strict';
const { BaseRepo } = require('./base-repo');

function mapAc(r) {
  return { id: r.id, storyId: r.story_id, checked: !!r.checked, text: r.text, position: r.position };
}

class AcRepo extends BaseRepo {
  constructor(index, root) {
    super({ index, table: 'acs', mapRow: mapAc, root });
  }
  list({ storyId } = {}) {
    if (storyId)
      return this.index.prepare('SELECT * FROM acs WHERE story_id=? ORDER BY position').all(storyId).map(mapAc);
    return this.index.prepare('SELECT * FROM acs ORDER BY story_id, position').all().map(mapAc);
  }
}
module.exports = { AcRepo };
