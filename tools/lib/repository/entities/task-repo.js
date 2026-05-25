'use strict';
const { BaseRepo } = require('./base-repo');

function mapTask(r) {
  return { id: r.id, storyId: r.story_id, status: r.status };
}

class TaskRepo extends BaseRepo {
  constructor(index, root, storyRepoGetter) {
    super({ index, table: 'planning_tasks', mapRow: mapTask, root });
    this._getStoryRepo = storyRepoGetter;
  }

  async update(id, fn) {
    const current = this.get(id);
    if (!current) throw new Error(`TaskRepo.update: ${id} not found`);
    const storyRepo = this._getStoryRepo();
    await storyRepo.update(current.storyId, (story) => {
      // Tasks are stored on story.tasks
      const tasks = story.tasks || [];
      const target = tasks.find((t) => t.id === id);
      if (!target) throw new Error(`TaskRepo.update: ${id} not in story ${current.storyId} block`);
      fn(target);
    });
  }
}
module.exports = { TaskRepo };
