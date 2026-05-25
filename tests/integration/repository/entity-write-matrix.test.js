'use strict';

const fs = require('fs');
const os = require('os');
const path = require('path');
const { Repository } = require('../../../tools/lib/repository');

function mkRoot() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'us0240-matrix-'));
  fs.mkdirSync(path.join(root, 'docs'), { recursive: true });
  fs.writeFileSync(path.join(root, 'package.json'), JSON.stringify({ name: 't', version: '1.0.0' }));
  return root;
}

describe('US-0240 / AC-0939: epic .update + .create', () => {
  let root;
  afterEach(() => {
    if (Repository._reset) Repository._reset();
    if (root) fs.rmSync(root, { recursive: true, force: true });
  });

  it('update + create epic', async () => {
    root = mkRoot();
    fs.writeFileSync(path.join(root, 'docs', 'RELEASE_PLAN.md'), '```\nEPIC-0001: Sample epic\nStatus: To Do\n```\n');
    if (Repository._reset) Repository._reset();
    const repo = Repository.getInstance({ root });
    // Force initial index by calling the indexer directly to seed SQL
    const { indexReleasePlan } = require('../../../tools/lib/repository/indexers/release-plan-indexer');
    indexReleasePlan({ index: repo.index, markdown: repo.markdown, rel: 'docs/RELEASE_PLAN.md' });
    await repo.epics.update('EPIC-0001', (e) => {
      e.status = 'Done';
    });
    let after = fs.readFileSync(path.join(root, 'docs', 'RELEASE_PLAN.md'), 'utf8');
    expect(after).toMatch(/EPIC-0001: Sample epic[\s\S]*Status: Done/);
    await repo.epics.create({ id: 'EPIC-0002', title: 'New', status: 'To Do' });
    after = fs.readFileSync(path.join(root, 'docs', 'RELEASE_PLAN.md'), 'utf8');
    expect(after).toContain('EPIC-0002: New');
  });
});

describe('US-0240 / AC-0939: bug .update + .create', () => {
  let root;
  afterEach(() => {
    if (Repository._reset) Repository._reset();
    if (root) fs.rmSync(root, { recursive: true, force: true });
  });

  it('update + create bug', async () => {
    root = mkRoot();
    fs.writeFileSync(path.join(root, 'docs', 'BUGS.md'), 'BUG-0001: Sample bug\nSeverity: Low\nStatus: Open\n');
    if (Repository._reset) Repository._reset();
    const repo = Repository.getInstance({ root });
    const { indexBugs } = require('../../../tools/lib/repository/indexers/bugs-indexer');
    indexBugs({ index: repo.index, markdown: repo.markdown, rel: 'docs/BUGS.md' });
    await repo.bugs.update('BUG-0001', (b) => {
      b.status = 'Fixed';
    });
    let after = fs.readFileSync(path.join(root, 'docs', 'BUGS.md'), 'utf8');
    expect(after).toMatch(/BUG-0001: Sample bug[\s\S]*Status: Fixed/);
    await repo.bugs.create({ id: 'BUG-0002', title: 'New', status: 'Open', severity: 'Medium' });
    after = fs.readFileSync(path.join(root, 'docs', 'BUGS.md'), 'utf8');
    expect(after).toContain('BUG-0002: New');
  });
});

describe('US-0240 / AC-0939: lesson .update + .create', () => {
  let root;
  afterEach(() => {
    if (Repository._reset) Repository._reset();
    if (root) fs.rmSync(root, { recursive: true, force: true });
  });

  it('update + create lesson', async () => {
    root = mkRoot();
    fs.writeFileSync(path.join(root, 'docs', 'LESSONS.md'), '## L-0001 — Sample lesson\n\n**Rule:** sample\n');
    if (Repository._reset) Repository._reset();
    const repo = Repository.getInstance({ root });
    const { indexLessons } = require('../../../tools/lib/repository/indexers/lessons-indexer');
    indexLessons({ index: repo.index, markdown: repo.markdown, rel: 'docs/LESSONS.md' });
    await repo.lessons.update('L-0001', (l) => {
      l.rule = 'updated rule';
    });
    let after = fs.readFileSync(path.join(root, 'docs', 'LESSONS.md'), 'utf8');
    expect(after).toContain('**Rule:** updated rule');
    await repo.lessons.create({ id: 'L-0002', title: 'New lesson', rule: 'be careful' });
    after = fs.readFileSync(path.join(root, 'docs', 'LESSONS.md'), 'utf8');
    expect(after).toContain('## L-0002 — New lesson');
  });
});

describe('US-0240 / AC-0939: testCase .update + .create', () => {
  let root;
  afterEach(() => {
    if (Repository._reset) Repository._reset();
    if (root) fs.rmSync(root, { recursive: true, force: true });
  });

  it('update + create testCase', async () => {
    root = mkRoot();
    fs.writeFileSync(path.join(root, 'docs', 'TEST_CASES.md'), 'TC-0001: Sample\nType: unit\nStatus: [ ] Not Run\n');
    if (Repository._reset) Repository._reset();
    const repo = Repository.getInstance({ root });
    const { indexTestCases } = require('../../../tools/lib/repository/indexers/test-cases-indexer');
    indexTestCases({ index: repo.index, markdown: repo.markdown, rel: 'docs/TEST_CASES.md' });
    await repo.testCases.update('TC-0001', (t) => {
      t.status = 'Pass';
    });
    let after = fs.readFileSync(path.join(root, 'docs', 'TEST_CASES.md'), 'utf8');
    expect(after).toMatch(/TC-0001: Sample[\s\S]*Status: \[x\] Pass/);
    await repo.testCases.create({ id: 'TC-0002', title: 'New', status: 'Not Run', type: 'unit' });
    after = fs.readFileSync(path.join(root, 'docs', 'TEST_CASES.md'), 'utf8');
    expect(after).toContain('TC-0002: New');
  });
});
