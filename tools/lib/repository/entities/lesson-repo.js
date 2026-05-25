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

  async update(id, fn) {
    const current = this.get(id);
    if (!current) throw new Error(`LessonRepo.update: ${id} not found`);
    const idLine = new RegExp(`^## ${id}`);
    const nextLesson = /^## L-\d+/;
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

  async create(entity) {
    if (this.get(entity.id)) {
      throw new ValidationError(`LessonRepo.create: ${entity.id} exists`, { code: 'DUPLICATE_ID' });
    }
    const body = serializeLesson(entity);
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
