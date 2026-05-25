'use strict';
const path = require('path');
const fs = require('fs');
const { BaseRepo } = require('./base-repo');
const { replaceBlock, replaceBlockInText } = require('../markdown-mutator');
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

  _upsertRow(story) {
    this.index
      .prepare(
        `
      INSERT INTO stories (id, epic_id, title, status, priority, estimate, branch, pr_number, spec_path, plan_path, source_file, source_line)
      VALUES (@id, @epicId, @title, @status, @priority, @estimate, @branch, @prNumber, @specPath, @planPath, @sourceFile, @sourceLine)
      ON CONFLICT(id) DO UPDATE SET
        epic_id=excluded.epic_id, title=excluded.title, status=excluded.status,
        priority=excluded.priority, estimate=excluded.estimate, branch=excluded.branch,
        pr_number=excluded.pr_number, spec_path=excluded.spec_path, plan_path=excluded.plan_path,
        source_file=excluded.source_file, source_line=excluded.source_line
    `,
      )
      .run({
        id: story.id,
        epicId: story.epicId || null,
        title: story.title,
        status: story.status,
        priority: story.priority || null,
        estimate: story.estimate || null,
        branch: story.branch || null,
        prNumber: story.prNumber || null,
        specPath: story.specPath || null,
        planPath: story.planPath || null,
        sourceFile: story.sourceFile || 'docs/RELEASE_PLAN.md',
        sourceLine: story.sourceLine || null,
      });
  }

  async update(id, fn, opts = {}) {
    const idRegex = new RegExp(`^${id}\\b`);
    const releasePlanPath = path.join(this._root, 'docs', 'RELEASE_PLAN.md');

    if (opts.tx) {
      // Transaction mode: get the story from staged or cached, mutate it, validate,
      // then stage the mutation and SQL upsert without acquiring file lock.
      const current = opts.tx.stagedWrites.get(`story:${id}`) || this.get(id);
      if (!current) throw new Error(`StoryRepo.update: ${id} not found`);

      // Deep-clone so the mutator doesn't accidentally affect cached state.
      const draft = JSON.parse(JSON.stringify(current));

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

      // Serialize and validate (throws ValidationError on invalid state).
      const newBody = serializeStory(draft);

      // Stage the mutation and SQL upsert without acquiring file lock.
      opts.tx.pendingFileMutations.push({
        path: releasePlanPath,
        mutator: (text) => replaceBlockInText(text, idRegex, () => newBody),
      });
      opts.tx.stagedWrites.set(`story:${id}`, draft);
      this._upsertRow(draft);
      return;
    }

    // Non-transaction mode: existing behavior (parse from markdown, mutate, write, re-index).
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

  async create(entity, opts = {}) {
    const existing = (opts.tx && opts.tx.stagedWrites.get(`story:${entity.id}`)) || this.get(entity.id);
    if (existing) {
      throw new ValidationError(`StoryRepo.create: ${entity.id} already exists`, {
        code: 'DUPLICATE_ID',
        details: { id: entity.id },
      });
    }

    // Serialize and validate (throws ValidationError on invalid state).
    const body = serializeStory(entity);

    const releasePlanPath = path.join(this._root, 'docs', 'RELEASE_PLAN.md');

    if (opts.tx) {
      // Transaction mode: stage the mutation (append to EOF) and upsert SQL without file lock.
      opts.tx.pendingFileMutations.push({
        path: releasePlanPath,
        mutator: (text) => {
          const sep = text.endsWith('\n') ? '\n' : '\n\n';
          return text + sep + '```\n' + body + '```\n';
        },
      });
      opts.tx.stagedWrites.set(`story:${entity.id}`, entity);
      this._upsertRow(entity);
      return;
    }

    // Non-transaction mode: existing behavior (file-locked write + re-index).
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
