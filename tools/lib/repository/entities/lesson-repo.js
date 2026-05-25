'use strict';
const path = require('path');
const fs = require('fs');
const { BaseRepo } = require('./base-repo');
const { withFileLock } = require('../file-lock');
const { replaceUnfencedRange } = require('../markdown-mutator');
const { serialize: serializeLesson } = require('../serializers/lesson-serializer');
const { parseLessons } = require('../../parse-lessons');
const { ValidationError } = require('../errors');
const { indexLessons } = require('../indexers/lessons-indexer');

function mapLesson(r) {
  return { id: r.id, sourceFile: r.source_file, sourceLine: r.source_line };
}

class LessonRepo extends BaseRepo {
  constructor(index, root, markdown) {
    super({ index, table: 'lessons', mapRow: mapLesson, root });
    this._lessonsPath = path.join(root, 'docs', 'LESSONS.md');
    this._markdown = markdown;
  }

  // Override .get to return the FULL entity (re-parse markdown on demand)
  get(id) {
    if (!fs.existsSync(this._lessonsPath)) return null;
    const text = fs.readFileSync(this._lessonsPath, 'utf8');
    return parseLessons(text).find((l) => l.id === id) || null;
  }

  _upsertRow(lesson) {
    this.index
      .prepare(
        `
      INSERT INTO lessons (id, text, source_file, source_line)
      VALUES (@id, @text, @sourceFile, @sourceLine)
      ON CONFLICT(id) DO UPDATE SET
        text=excluded.text,
        source_file=excluded.source_file, source_line=excluded.source_line
    `,
      )
      .run({
        id: lesson.id,
        text: lesson.rule || lesson.text || '',
        sourceFile: lesson.sourceFile || 'docs/LESSONS.md',
        sourceLine: lesson.sourceLine || null,
      });
  }

  async update(id, fn, opts = {}) {
    const idLine = new RegExp(`^## ${id}`);
    const nextLesson = /^## L-\d+/;

    if (opts.tx) {
      // Transaction mode: get the lesson from staged or cached, mutate it, validate,
      // then stage the mutation and SQL upsert without acquiring file lock.
      const current = opts.tx.stagedWrites.get(`lesson:${id}`) || this.get(id);
      if (!current) throw new Error(`LessonRepo.update: ${id} not found`);

      // Deep-clone so the mutator doesn't accidentally affect cached state.
      const draft = JSON.parse(JSON.stringify(current));

      fn(draft);

      // Serialize and validate (throws ValidationError on invalid state).
      const newBody = serializeLesson(draft);

      // Stage the mutation and SQL upsert without acquiring file lock.
      opts.tx.pendingFileMutations.push({
        path: this._lessonsPath,
        mutator: (text) => replaceUnfencedRange(text, idLine, nextLesson, () => newBody),
      });
      opts.tx.stagedWrites.set(`lesson:${id}`, draft);
      this._upsertRow(draft);
      return;
    }

    // Non-transaction mode: existing behavior (file-locked write + re-index).
    const current = this.get(id);
    if (!current) throw new Error(`LessonRepo.update: ${id} not found`);
    await withFileLock(this._lessonsPath, async () => {
      const text = fs.readFileSync(this._lessonsPath, 'utf8');
      const next = replaceUnfencedRange(text, idLine, nextLesson, (body) => {
        const parsed = parseLessons(body);
        if (parsed.length !== 1) throw new Error(`LessonRepo.update: expected 1, got ${parsed.length}`);
        fn(parsed[0]);
        return serializeLesson(parsed[0]);
      });
      if (next !== text) {
        fs.writeFileSync(this._lessonsPath + '.tmp', next);
        fs.renameSync(this._lessonsPath + '.tmp', this._lessonsPath);
      }
    });
    indexLessons({ index: this.index, markdown: this._markdown, rel: 'docs/LESSONS.md' });
  }

  async create(entity, opts = {}) {
    const existing = (opts.tx && opts.tx.stagedWrites.get(`lesson:${entity.id}`)) || this.get(entity.id);
    if (existing) {
      throw new ValidationError(`LessonRepo.create: ${entity.id} exists`, { code: 'DUPLICATE_ID' });
    }
    const body = serializeLesson(entity);

    if (opts.tx) {
      // Transaction mode: stage the mutation (append to EOF) and upsert SQL without file lock.
      opts.tx.pendingFileMutations.push({
        path: this._lessonsPath,
        mutator: (text) => {
          const sep = text.endsWith('\n') || text === '' ? '\n' : '\n\n';
          return text + sep + body;
        },
      });
      opts.tx.stagedWrites.set(`lesson:${entity.id}`, entity);
      this._upsertRow(entity);
      return;
    }

    // Non-transaction mode: existing behavior (file-locked write + re-index).
    await withFileLock(this._lessonsPath, async () => {
      const text = fs.existsSync(this._lessonsPath) ? fs.readFileSync(this._lessonsPath, 'utf8') : '';
      const sep = text.endsWith('\n') || text === '' ? '\n' : '\n\n';
      fs.writeFileSync(this._lessonsPath + '.tmp', text + sep + body);
      fs.renameSync(this._lessonsPath + '.tmp', this._lessonsPath);
    });
    indexLessons({ index: this.index, markdown: this._markdown, rel: 'docs/LESSONS.md' });
  }
}
module.exports = { LessonRepo };
