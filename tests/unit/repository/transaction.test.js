'use strict';

const fs = require('fs');
const os = require('os');
const path = require('path');
const { Repository } = require('../../../tools/lib/repository');

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
});
