'use strict';
const path = require('path');
const fs = require('fs');
const { BaseRepo } = require('./base-repo');
const { withFileLock } = require('../file-lock');
const { replaceUnfencedRange } = require('../markdown-mutator');
const { serialize: serializeBug } = require('../serializers/bug-serializer');
const { parseBugs } = require('../../parse-bugs');
const { ValidationError } = require('../errors');
const { indexBugs } = require('../indexers/bugs-indexer');

function mapBug(r) {
  return { id: r.id, status: r.status, severity: r.severity, sourceFile: r.source_file, sourceLine: r.source_line };
}

class BugRepo extends BaseRepo {
  constructor(index, root, markdown) {
    super({ index, table: 'bugs', mapRow: mapBug, root });
    this._bugsPath = path.join(root, 'docs', 'BUGS.md');
    this._markdown = markdown;
  }

  // Override .get to return the FULL entity (re-parse markdown on demand)
  get(id) {
    if (!fs.existsSync(this._bugsPath)) return null;
    const text = fs.readFileSync(this._bugsPath, 'utf8');
    return parseBugs(text).find((b) => b.id === id) || null;
  }

  _upsertRow(bug) {
    this.index
      .prepare(
        `
      INSERT INTO bugs (id, status, severity, source_file, source_line)
      VALUES (@id, @status, @severity, @sourceFile, @sourceLine)
      ON CONFLICT(id) DO UPDATE SET
        status=excluded.status, severity=excluded.severity,
        source_file=excluded.source_file, source_line=excluded.source_line
    `,
      )
      .run({
        id: bug.id,
        status: bug.status || 'Open',
        severity: bug.severity || null,
        sourceFile: bug.sourceFile || 'docs/BUGS.md',
        sourceLine: bug.sourceLine || null,
      });
  }

  async update(id, fn, opts = {}) {
    const idLine = new RegExp(`^(?:#{1,4}\\s+)?${id}:`);
    const nextBug = /^(?:#{1,4}\s+)?BUG-\d+:/;

    if (opts.tx) {
      // Transaction mode: get the bug from staged or cached, mutate it, validate,
      // then stage the mutation and SQL upsert without acquiring file lock.
      const current = opts.tx.stagedWrites.get(`bug:${id}`) || this.get(id);
      if (!current) throw new Error(`BugRepo.update: ${id} not found`);

      // Deep-clone so the mutator doesn't accidentally affect cached state.
      const draft = JSON.parse(JSON.stringify(current));

      fn(draft);

      // Serialize and validate (throws ValidationError on invalid state).
      const newBody = serializeBug(draft);

      // Stage the mutation and SQL upsert without acquiring file lock.
      opts.tx.pendingFileMutations.push({
        path: this._bugsPath,
        mutator: (text) => replaceUnfencedRange(text, idLine, nextBug, () => newBody),
      });
      opts.tx.stagedWrites.set(`bug:${id}`, draft);
      this._upsertRow(draft);
      return;
    }

    // Non-transaction mode: existing behavior (file-locked write + re-index).
    const current = this.get(id);
    if (!current) throw new Error(`BugRepo.update: ${id} not found`);
    await withFileLock(this._bugsPath, async () => {
      const text = fs.readFileSync(this._bugsPath, 'utf8');
      const next = replaceUnfencedRange(text, idLine, nextBug, (body) => {
        const parsed = parseBugs(body);
        if (parsed.length !== 1) throw new Error(`BugRepo.update: expected 1, got ${parsed.length}`);
        fn(parsed[0]);
        return serializeBug(parsed[0]);
      });
      if (next !== text) {
        fs.writeFileSync(this._bugsPath + '.tmp', next);
        fs.renameSync(this._bugsPath + '.tmp', this._bugsPath);
      }
    });
    indexBugs({ index: this.index, markdown: this._markdown, rel: 'docs/BUGS.md' });
  }

  async create(entity, opts = {}) {
    const existing = (opts.tx && opts.tx.stagedWrites.get(`bug:${entity.id}`)) || this.get(entity.id);
    if (existing) {
      throw new ValidationError(`BugRepo.create: ${entity.id} exists`, { code: 'DUPLICATE_ID' });
    }
    const body = serializeBug(entity);

    if (opts.tx) {
      // Transaction mode: stage the mutation (append to EOF) and upsert SQL without file lock.
      opts.tx.pendingFileMutations.push({
        path: this._bugsPath,
        mutator: (text) => {
          const sep = text.endsWith('\n') || text === '' ? '\n' : '\n\n';
          return text + sep + body;
        },
      });
      opts.tx.stagedWrites.set(`bug:${entity.id}`, entity);
      this._upsertRow(entity);
      return;
    }

    // Non-transaction mode: existing behavior (file-locked write + re-index).
    await withFileLock(this._bugsPath, async () => {
      const text = fs.existsSync(this._bugsPath) ? fs.readFileSync(this._bugsPath, 'utf8') : '';
      const sep = text.endsWith('\n') || text === '' ? '\n' : '\n\n';
      fs.writeFileSync(this._bugsPath + '.tmp', text + sep + body);
      fs.renameSync(this._bugsPath + '.tmp', this._bugsPath);
    });
    indexBugs({ index: this.index, markdown: this._markdown, rel: 'docs/BUGS.md' });
  }
}
module.exports = { BugRepo };
