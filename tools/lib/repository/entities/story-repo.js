'use strict';
const path = require('path');
const fs = require('fs');
const { BaseRepo } = require('./base-repo');
const { replaceBlock } = require('../markdown-mutator');
const { serialize: serializeStory } = require('../serializers/story-serializer');
const { parseReleasePlan } = require('../../parse-release-plan');
const { ValidationError } = require('../errors');
const { withFileLock } = require('../file-lock');
const { indexReleasePlan } = require('../indexers/release-plan-indexer');

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
  constructor(index, root, markdown) {
    super({ index, table: 'stories', mapRow: mapStory, root });
    this._markdown = markdown;
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

  async update(id, fn) {
    const current = this.get(id);
    if (!current) throw new Error(`StoryRepo.update: ${id} not found`);

    const idRegex = new RegExp(`^${id}\\b`);
    const releasePlanPath = path.join(this._root, 'docs', 'RELEASE_PLAN.md');

    await replaceBlock({
      path: releasePlanPath,
      idRegex,
      mutator: (body) => {
        const parsed = parseReleasePlan('```\n' + body + '```\n');
        if (parsed.stories.length !== 1) {
          throw new Error(`StoryRepo.update: expected 1 parsed story, got ${parsed.stories.length}`);
        }
        const draft = parsed.stories[0];
        // Normalize AC objects to use 'checked' instead of 'done' for consistency with AcRepo schema
        if (Array.isArray(draft.acs)) {
          for (const ac of draft.acs) {
            if ('done' in ac && !('checked' in ac)) {
              ac.checked = ac.done;
              delete ac.done;
            }
          }
        }
        fn(draft);
        // Normalize back to 'done' for serialization
        if (Array.isArray(draft.acs)) {
          for (const ac of draft.acs) {
            if ('checked' in ac && !('done' in ac)) {
              ac.done = ac.checked;
              delete ac.checked;
            }
          }
        }
        return serializeStory(draft);
      },
    });

    // Re-ingest via existing indexer (idempotent, delete-then-insert).
    indexReleasePlan({
      index: this.index,
      markdown: {
        absolute: (rel) => path.join(this._root, rel),
      },
      rel: 'docs/RELEASE_PLAN.md',
    });
  }

  async create(entity) {
    if (this.get(entity.id)) {
      throw new ValidationError(`StoryRepo.create: ${entity.id} already exists`, {
        code: 'DUPLICATE_ID',
        details: { id: entity.id },
      });
    }

    // Serialize and validate.
    const body = serializeStory(entity);

    const releasePlanPath = path.join(this._root, 'docs', 'RELEASE_PLAN.md');
    await withFileLock(releasePlanPath, async () => {
      const text = fs.readFileSync(releasePlanPath, 'utf8');
      const sep = text.endsWith('\n') ? '\n' : '\n\n';
      const next = text + sep + '```\n' + body + '```\n';
      const tmp = releasePlanPath + '.tmp';
      fs.writeFileSync(tmp, next);
      fs.renameSync(tmp, releasePlanPath);
    });

    // Re-ingest.
    indexReleasePlan({
      index: this.index,
      markdown: {
        absolute: (rel) => path.join(this._root, rel),
      },
      rel: 'docs/RELEASE_PLAN.md',
    });
  }
}
module.exports = { StoryRepo };
