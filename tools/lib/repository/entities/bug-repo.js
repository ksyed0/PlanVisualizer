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

  async update(id, fn) {
    const current = this.get(id);
    if (!current) throw new Error(`BugRepo.update: ${id} not found`);
    const idLine = new RegExp(`^(?:#{1,4}\\s+)?${id}:`);
    const nextBug = /^(?:#{1,4}\s+)?BUG-\d+:/;
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

  async create(entity) {
    if (this.get(entity.id)) {
      throw new ValidationError(`BugRepo.create: ${entity.id} exists`, { code: 'DUPLICATE_ID' });
    }
    const body = serializeBug(entity);
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
