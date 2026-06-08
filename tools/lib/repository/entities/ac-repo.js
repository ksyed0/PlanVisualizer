'use strict';
const { BaseRepo } = require('./base-repo');

function mapAc(r) {
  return { id: r.id, storyId: r.story_id, checked: !!r.checked, text: r.text, position: r.position };
}

class AcRepo extends BaseRepo {
  constructor(index, root, storyRepoGetter) {
    super({ index, table: 'acs', mapRow: mapAc, root });
    this._getStoryRepo = storyRepoGetter;
  }
  list({ storyId } = {}) {
    if (storyId)
      return this.index.prepare('SELECT * FROM acs WHERE story_id=? ORDER BY position').all(storyId).map(mapAc);
    return this.index.prepare('SELECT * FROM acs ORDER BY story_id, position').all().map(mapAc);
  }

  async update(id, fn, opts = {}) {
    const current = this.get(id);
    if (!current) throw new Error(`AcRepo.update: ${id} not found`);
    const storyRepo = this._getStoryRepo();
    await storyRepo.update(
      current.storyId,
      (story) => {
        const target = (story.acs || []).find((a) => a.id === id);
        if (!target)
          throw new Error(`AcRepo.update: ${id} present in SQL index but absent from story ${current.storyId} block`);
        fn(target);
      },
      opts,
    );
  }
}
module.exports = { AcRepo };
