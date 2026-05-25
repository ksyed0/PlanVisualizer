'use strict';
const path = require('path');
const fs = require('fs');
const { BaseRepo } = require('./base-repo');
const { replaceBlock, replaceBlockInText } = require('../markdown-mutator');
const { serialize: serializeEpic } = require('../serializers/epic-serializer');
const { parseReleasePlan } = require('../../parse-release-plan');
const { ValidationError } = require('../errors');
const { withFileLock } = require('../file-lock');
const { indexReleasePlan } = require('../indexers/release-plan-indexer');

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
  constructor(index, root, markdown) {
    super({ index, table: 'epics', mapRow: mapEpic, root });
    this._markdown = markdown;
  }
  list({ status } = {}) {
    if (status) return this.index.prepare('SELECT * FROM epics WHERE status=? ORDER BY id').all(status).map(mapEpic);
    return this.index.prepare('SELECT * FROM epics ORDER BY id').all().map(mapEpic);
  }

  _upsertRow(epic) {
    this.index
      .prepare(
        `
      INSERT INTO epics (id, title, status, release_target, source_file, source_line, source_hash)
      VALUES (@id, @title, @status, @releaseTarget, @sourceFile, @sourceLine, @sourceHash)
      ON CONFLICT(id) DO UPDATE SET
        title=excluded.title, status=excluded.status,
        release_target=excluded.release_target,
        source_file=excluded.source_file, source_line=excluded.source_line,
        source_hash=excluded.source_hash
    `,
      )
      .run({
        id: epic.id,
        title: epic.title,
        status: epic.status,
        releaseTarget: epic.releaseTarget || null,
        sourceFile: epic.sourceFile || 'docs/RELEASE_PLAN.md',
        sourceLine: epic.sourceLine || null,
        sourceHash: null,
      });
  }

  async update(id, fn, opts = {}) {
    const idRegex = new RegExp(`^${id}\\b`);
    const releasePlanPath = path.join(this._root, 'docs', 'RELEASE_PLAN.md');

    if (opts.tx) {
      // Transaction mode: get the epic from staged or cached, mutate it, validate,
      // then stage the mutation and SQL upsert without acquiring file lock.
      const current = opts.tx.stagedWrites.get(`epic:${id}`) || this.get(id);
      if (!current) throw new Error(`EpicRepo.update: ${id} not found`);

      // Deep-clone so the mutator doesn't accidentally affect cached state.
      const draft = JSON.parse(JSON.stringify(current));

      fn(draft);

      // Serialize and validate (throws ValidationError on invalid state).
      const newBody = serializeEpic(draft);

      // Stage the mutation and SQL upsert without acquiring file lock.
      opts.tx.pendingFileMutations.push({
        path: releasePlanPath,
        mutator: (text) => replaceBlockInText(text, idRegex, () => newBody),
      });
      opts.tx.stagedWrites.set(`epic:${id}`, draft);
      this._upsertRow(draft);
      return;
    }

    // Non-transaction mode: existing behavior (parse from markdown, mutate, write, re-index).
    await replaceBlock({
      path: releasePlanPath,
      idRegex,
      mutator: (body) => {
        const parsed = parseReleasePlan('```\n' + body + '```\n');
        if (parsed.epics.length !== 1) {
          throw new Error(`EpicRepo.update: expected 1 parsed epic, got ${parsed.epics.length}`);
        }
        const draft = parsed.epics[0];
        fn(draft);
        return serializeEpic(draft);
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
    const existing = (opts.tx && opts.tx.stagedWrites.get(`epic:${entity.id}`)) || this.get(entity.id);
    if (existing) {
      throw new ValidationError(`EpicRepo.create: ${entity.id} already exists`, {
        code: 'DUPLICATE_ID',
        details: { id: entity.id },
      });
    }

    // Serialize and validate (throws ValidationError on invalid state).
    const body = serializeEpic(entity);

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
      opts.tx.stagedWrites.set(`epic:${entity.id}`, entity);
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
module.exports = { EpicRepo };
