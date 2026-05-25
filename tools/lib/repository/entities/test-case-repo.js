'use strict';
const path = require('path');
const fs = require('fs');
const { BaseRepo } = require('./base-repo');
const { withFileLock } = require('../file-lock');
const { replaceUnfencedRange } = require('../markdown-mutator');
const { serialize: serializeTestCase } = require('../serializers/test-case-serializer');
const { parseTestCases } = require('../../parse-test-cases');
const { ValidationError } = require('../errors');
const { indexTestCases } = require('../indexers/test-cases-indexer');

function mapTestCase(r) {
  return { id: r.id, status: r.status, sourceFile: r.source_file, sourceLine: r.source_line };
}

class TestCaseRepo extends BaseRepo {
  constructor(index, root, markdown) {
    super({ index, table: 'test_cases', mapRow: mapTestCase, root });
    this._testCasesPath = path.join(root, 'docs', 'TEST_CASES.md');
    this._markdown = markdown;
  }

  // Override .get to return the FULL entity (re-parse markdown on demand)
  get(id) {
    if (!fs.existsSync(this._testCasesPath)) return null;
    const text = fs.readFileSync(this._testCasesPath, 'utf8');
    return parseTestCases(text).find((t) => t.id === id) || null;
  }

  async update(id, fn) {
    const current = this.get(id);
    if (!current) throw new Error(`TestCaseRepo.update: ${id} not found`);
    const idLine = new RegExp(`^${id}:`);
    const nextTestCase = /^TC-\d+:/;
    await withFileLock(this._testCasesPath, async () => {
      const text = fs.readFileSync(this._testCasesPath, 'utf8');
      const next = replaceUnfencedRange(text, idLine, nextTestCase, (body) => {
        const parsed = parseTestCases(body);
        if (parsed.length !== 1) throw new Error(`TestCaseRepo.update: expected 1, got ${parsed.length}`);
        fn(parsed[0]);
        return serializeTestCase(parsed[0]);
      });
      if (next !== text) {
        fs.writeFileSync(this._testCasesPath + '.tmp', next);
        fs.renameSync(this._testCasesPath + '.tmp', this._testCasesPath);
      }
    });
    indexTestCases({ index: this.index, markdown: this._markdown, rel: 'docs/TEST_CASES.md' });
  }

  async create(entity) {
    if (this.get(entity.id)) {
      throw new ValidationError(`TestCaseRepo.create: ${entity.id} exists`, { code: 'DUPLICATE_ID' });
    }
    const body = serializeTestCase(entity);
    await withFileLock(this._testCasesPath, async () => {
      const text = fs.existsSync(this._testCasesPath) ? fs.readFileSync(this._testCasesPath, 'utf8') : '';
      const sep = text.endsWith('\n') || text === '' ? '\n' : '\n\n';
      fs.writeFileSync(this._testCasesPath + '.tmp', text + sep + body);
      fs.renameSync(this._testCasesPath + '.tmp', this._testCasesPath);
    });
    indexTestCases({ index: this.index, markdown: this._markdown, rel: 'docs/TEST_CASES.md' });
  }
}
module.exports = { TestCaseRepo };
