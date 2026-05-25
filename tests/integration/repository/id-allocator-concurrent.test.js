'use strict';

const fs = require('fs');
const os = require('os');
const path = require('path');
const { Repository } = require('../../../tools/lib/repository');

const SAMPLE_REGISTRY = [
  '# ID Registry',
  '',
  'intro',
  '',
  '| **Sequence** | **Next Available ID** | **Last Assigned** |',
  '| ------------ | --------------------- | ----------------- |',
  '| EPIC         | EPIC-0046             | EPIC-0045         |',
  '| US           | US-0264               | US-0263           |',
  '| BUG          | BUG-0264              | BUG-0263          |',
  '| Lesson       | L-0086                | L-0085            |',
  '',
].join('\n');

function mkRoot() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'us0241-alloc-'));
  fs.mkdirSync(path.join(root, 'docs'), { recursive: true });
  fs.writeFileSync(path.join(root, 'package.json'), JSON.stringify({ name: 't', version: '1.0.0' }));
  fs.writeFileSync(path.join(root, 'docs', 'ID_REGISTRY.md'), SAMPLE_REGISTRY);
  return root;
}

describe('US-0241 / AC-0943..0945: repo.idRegistry.allocate', () => {
  let root;
  afterEach(() => {
    if (Repository._reset) Repository._reset();
    if (root) fs.rmSync(root, { recursive: true, force: true });
  });

  it('single allocate returns a string + bumps the row on disk', async () => {
    root = mkRoot();
    if (Repository._reset) Repository._reset();
    const repo = Repository.getInstance({ root });
    const id = await repo.idRegistry.allocate('US');
    expect(typeof id).toBe('string');
    expect(id).toBe('US-0264');
    const after = fs.readFileSync(path.join(root, 'docs', 'ID_REGISTRY.md'), 'utf8');
    expect(after).toContain('| US           | US-0265               | US-0264           |');
  });

  it('count=3 returns array of contiguous IDs', async () => {
    root = mkRoot();
    if (Repository._reset) Repository._reset();
    const repo = Repository.getInstance({ root });
    const ids = await repo.idRegistry.allocate('US', 3);
    expect(ids).toEqual(['US-0264', 'US-0265', 'US-0266']);
    const after = fs.readFileSync(path.join(root, 'docs', 'ID_REGISTRY.md'), 'utf8');
    expect(after).toContain('| US           | US-0267               | US-0266           |');
  });

  it('Lesson allocate uses L- prefix despite "Lesson" sequence label', async () => {
    root = mkRoot();
    if (Repository._reset) Repository._reset();
    const repo = Repository.getInstance({ root });
    const id = await repo.idRegistry.allocate('Lesson');
    expect(id).toBe('L-0086');
  });

  it('AC-0943: concurrent allocations on the same sequence return non-overlapping IDs', async () => {
    root = mkRoot();
    if (Repository._reset) Repository._reset();
    const repo = Repository.getInstance({ root });
    const [a, b, c] = await Promise.all([
      repo.idRegistry.allocate('US'),
      repo.idRegistry.allocate('US'),
      repo.idRegistry.allocate('US'),
    ]);
    expect(new Set([a, b, c])).toEqual(new Set(['US-0264', 'US-0265', 'US-0266']));
    const after = fs.readFileSync(path.join(root, 'docs', 'ID_REGISTRY.md'), 'utf8');
    expect(after).toContain('| US           | US-0267               | US-0266           |');
  });

  it('throws when the sequence is missing from the registry', async () => {
    root = mkRoot();
    if (Repository._reset) Repository._reset();
    const repo = Repository.getInstance({ root });
    await expect(repo.idRegistry.allocate('NOPE')).rejects.toThrow(/NOPE.*not found/);
  });
});
