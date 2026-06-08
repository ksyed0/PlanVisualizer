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

  _upsertRow(testCase) {
    this.index
      .prepare(
        `
      INSERT INTO test_cases (id, story_id, title, status)
      VALUES (@id, @storyId, @title, @status)
      ON CONFLICT(id) DO UPDATE SET
        story_id=excluded.story_id, title=excluded.title, status=excluded.status
    `,
      )
      .run({
        id: testCase.id,
        storyId: testCase.storyId || null,
        title: testCase.title || '',
        status: testCase.status || 'Not Run',
      });
  }

  async update(id, fn, opts = {}) {
    const idLine = new RegExp(`^${id}:`);
    const nextTestCase = /^TC-\d+:/;

    if (opts.tx) {
      // Transaction mode: get the test case from staged or cached, mutate it, validate,
      // then stage the mutation and SQL upsert without acquiring file lock.
      const current = opts.tx.stagedWrites.get(`testCase:${id}`) || this.get(id);
      if (!current) throw new Error(`TestCaseRepo.update: ${id} not found`);

      // Deep-clone so the mutator doesn't accidentally affect cached state.
      const draft = JSON.parse(JSON.stringify(current));

      fn(draft);

      // Serialize and validate (throws ValidationError on invalid state).
      const newBody = serializeTestCase(draft);

      // Stage the mutation and SQL upsert without acquiring file lock.
      opts.tx.pendingFileMutations.push({
        path: this._testCasesPath,
        mutator: (text) => replaceUnfencedRange(text, idLine, nextTestCase, () => newBody),
      });
      opts.tx.stagedWrites.set(`testCase:${id}`, draft);
      this._upsertRow(draft);
      return;
    }

    // Non-transaction mode: existing behavior (file-locked write + re-index).
    const current = this.get(id);
    if (!current) throw new Error(`TestCaseRepo.update: ${id} not found`);
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

  async create(entity, opts = {}) {
    const existing = (opts.tx && opts.tx.stagedWrites.get(`testCase:${entity.id}`)) || this.get(entity.id);
    if (existing) {
      throw new ValidationError(`TestCaseRepo.create: ${entity.id} exists`, { code: 'DUPLICATE_ID' });
    }
    const body = serializeTestCase(entity);

    if (opts.tx) {
      // Transaction mode: stage the mutation (append to EOF) and upsert SQL without file lock.
      opts.tx.pendingFileMutations.push({
        path: this._testCasesPath,
        mutator: (text) => {
          const sep = text.endsWith('\n') || text === '' ? '\n' : '\n\n';
          return text + sep + body;
        },
      });
      opts.tx.stagedWrites.set(`testCase:${entity.id}`, entity);
      this._upsertRow(entity);
      return;
    }

    // Non-transaction mode: existing behavior (file-locked write + re-index).
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
