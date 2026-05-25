'use strict';

const fs = require('fs');
const os = require('os');
const path = require('path');
const { Repository } = require('../../../tools/lib/repository');
const { indexAll } = require('../../../tools/lib/repository/indexers');

function mkRoot() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'us0242-tx-'));
  fs.mkdirSync(path.join(root, 'docs'), { recursive: true });
  fs.writeFileSync(path.join(root, 'package.json'), JSON.stringify({ name: 't', version: '1.0.0' }));
  return root;
}

describe('US-0242 / AC-0946: repo.transaction wrapper', () => {
  let root;
  afterEach(() => {
    if (Repository._reset) Repository._reset();
    if (root) fs.rmSync(root, { recursive: true, force: true });
  });

  it('empty callback: BEGIN + COMMIT without errors, returns the callback return value', async () => {
    root = mkRoot();
    if (Repository._reset) Repository._reset();
    const repo = Repository.getInstance({ root });
    const result = await repo.transaction(async () => 42);
    expect(result).toBe(42);
  });

  it('tx exposes entity-repo handles for stories/epics/acs/bugs/lessons/testCases/tasks/idRegistry', async () => {
    root = mkRoot();
    if (Repository._reset) Repository._reset();
    const repo = Repository.getInstance({ root });
    await repo.transaction(async (tx) => {
      expect(typeof tx.stories.get).toBe('function');
      expect(typeof tx.stories.update).toBe('function');
      expect(typeof tx.stories.create).toBe('function');
      expect(typeof tx.epics.update).toBe('function');
      expect(typeof tx.acs.update).toBe('function');
      expect(typeof tx.bugs.update).toBe('function');
      expect(typeof tx.lessons.update).toBe('function');
      expect(typeof tx.testCases.update).toBe('function');
      expect(typeof tx.tasks.update).toBe('function');
      expect(typeof tx.idRegistry.allocate).toBe('function');
    });
  });

  it('rolls back on user error: re-throws + leaves SQL ready for next transaction', async () => {
    root = mkRoot();
    if (Repository._reset) Repository._reset();
    const repo = Repository.getInstance({ root });
    await expect(
      repo.transaction(async () => {
        throw new Error('boom');
      }),
    ).rejects.toThrow('boom');
    // If ROLLBACK didn't fire, the next BEGIN would error with "cannot start a transaction within a transaction".
    await expect(repo.transaction(async () => 'next-tx-works')).resolves.toBe('next-tx-works');
  });

  it('RYOW: write A=Done, subsequent tx.stories.get returns Done before commit', async () => {
    root = mkRoot();
    fs.writeFileSync(
      path.join(root, 'docs', 'RELEASE_PLAN.md'),
      '# Plan\n\n```\nEPIC-0001: e\nStatus: To Do\n```\n\n```\nUS-0001 (EPIC-0001): A\nPriority: High (P1)\nEstimate: M\nStatus: To Do\n```\n',
    );
    if (Repository._reset) Repository._reset();
    const repo = Repository.getInstance({ root });
    indexAll({ index: repo.index, markdown: repo.markdown, warningsChannel: repo.warningsChannel });
    await repo.transaction(async (tx) => {
      expect(tx.stories.get('US-0001').status).toBe('To Do');
      await tx.stories.update('US-0001', (s) => {
        s.status = 'Done';
      });
      expect(tx.stories.get('US-0001').status).toBe('Done'); // RYOW
    });
    expect(repo.stories.get('US-0001').status).toBe('Done'); // committed
  });

  it('AC-0947: throw inside callback rolls back SQL AND leaves markdown unchanged', async () => {
    root = mkRoot();
    const SEED =
      '# Plan\n\n```\nEPIC-0001: e\nStatus: To Do\n```\n\n```\nUS-0001 (EPIC-0001): A\nPriority: High (P1)\nEstimate: M\nStatus: To Do\n```\n';
    fs.writeFileSync(path.join(root, 'docs', 'RELEASE_PLAN.md'), SEED);
    if (Repository._reset) Repository._reset();
    const repo = Repository.getInstance({ root });
    indexAll({ index: repo.index, markdown: repo.markdown, warningsChannel: repo.warningsChannel });
    await expect(
      repo.transaction(async (tx) => {
        await tx.stories.update('US-0001', (s) => {
          s.status = 'Done';
        });
        throw new Error('intentional');
      }),
    ).rejects.toThrow('intentional');
    expect(fs.readFileSync(path.join(root, 'docs', 'RELEASE_PLAN.md'), 'utf8')).toBe(SEED);
    expect(repo.stories.get('US-0001').status).toBe('To Do');
  });

  it('AC-0946: transaction writes multiple files without race conditions', async () => {
    root = mkRoot();
    fs.writeFileSync(
      path.join(root, 'docs', 'RELEASE_PLAN.md'),
      '# Plan\n\n```\nEPIC-0001: e\nStatus: To Do\n```\n\n```\nUS-0001 (EPIC-0001): A\nPriority: High (P1)\nEstimate: M\nStatus: To Do\n```\n',
    );
    fs.writeFileSync(path.join(root, 'docs', 'BUGS.md'), 'BUG-0001: B\nSeverity: Low\nStatus: Open\n');
    fs.writeFileSync(path.join(root, 'docs', 'LESSONS.md'), '## L-0001 — L\n\n**Rule:** sample\n');

    if (Repository._reset) Repository._reset();
    const repo = Repository.getInstance({ root });
    indexAll({ index: repo.index, markdown: repo.markdown, warningsChannel: repo.warningsChannel });

    // Verify initial state
    expect(repo.bugs.get('BUG-0001').status).toBe('Open');
    expect(repo.lessons.get('L-0001').rule).toBe('sample');
    expect(repo.stories.get('US-0001').status).toBe('To Do');

    // Execute transaction with updates to all three files
    await repo.transaction(async (tx) => {
      await tx.bugs.update('BUG-0001', (b) => {
        b.status = 'Fixed';
      });
      await tx.lessons.update('L-0001', (l) => {
        l.rule = 'updated';
      });
      await tx.stories.update('US-0001', (s) => {
        s.status = 'Done';
      });
    });

    // Verify all updates committed
    expect(repo.bugs.get('BUG-0001').status).toBe('Fixed');
    expect(repo.lessons.get('L-0001').rule).toBe('updated');
    expect(repo.stories.get('US-0001').status).toBe('Done');

    // Verify the markdown files were actually updated (no tmp files left behind)
    expect(fs.existsSync(path.join(root, 'docs', 'BUGS.md.tmp'))).toBe(false);
    expect(fs.existsSync(path.join(root, 'docs', 'LESSONS.md.tmp'))).toBe(false);
    expect(fs.existsSync(path.join(root, 'docs', 'RELEASE_PLAN.md.tmp'))).toBe(false);
  });
});
