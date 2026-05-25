'use strict';

const fs = require('fs');
const os = require('os');
const path = require('path');
const { Repository } = require('../../../tools/lib/repository');
const { indexReleasePlan } = require('../../../tools/lib/repository/indexers/release-plan-indexer');
const { indexIdRegistry } = require('../../../tools/lib/repository/indexers/id-registry-indexer');

describe('US-0242 / AC-0946: multi-entity atomic transaction', () => {
  let root;
  afterEach(() => {
    if (Repository._reset) Repository._reset();
    if (root) {
      fs.rmSync(root, { recursive: true, force: true });
      root = null;
    }
  });

  it('story update + AC update + ID allocation commit together', async () => {
    root = fs.mkdtempSync(path.join(os.tmpdir(), 'us0242-multi-'));
    fs.mkdirSync(path.join(root, 'docs'), { recursive: true });
    fs.writeFileSync(path.join(root, 'package.json'), JSON.stringify({ name: 't', version: '1.0.0' }));
    fs.writeFileSync(
      path.join(root, 'docs', 'RELEASE_PLAN.md'),
      '# Plan\n\n```\nEPIC-0001: e\nStatus: To Do\n```\n\n```\nUS-0001 (EPIC-0001): A\nPriority: High (P1)\nEstimate: M\nStatus: To Do\nAcceptance Criteria:\n- [ ] AC-0001: first\n```\n',
    );
    fs.writeFileSync(
      path.join(root, 'docs', 'ID_REGISTRY.md'),
      '| **Sequence** | **Next Available ID** | **Last Assigned** |\n| ------------ | --------------------- | ----------------- |\n| US           | US-0002               | US-0001           |\n',
    );
    if (Repository._reset) Repository._reset();
    const repo = Repository.getInstance({ root });
    indexReleasePlan({
      index: repo.index,
      markdown: repo.markdown,
      rel: 'docs/RELEASE_PLAN.md',
    });
    indexIdRegistry({
      index: repo.index,
      markdown: repo.markdown,
      rel: 'docs/ID_REGISTRY.md',
    });

    const newId = await repo.transaction(async (tx) => {
      await tx.stories.update('US-0001', (s) => {
        s.status = 'Done';
      });
      await tx.acs.update('AC-0001', (a) => {
        a.checked = true;
      });
      return tx.idRegistry.allocate('US');
    });

    expect(newId).toBe('US-0002');
    const planText = fs.readFileSync(path.join(root, 'docs', 'RELEASE_PLAN.md'), 'utf8');
    expect(planText).toContain('Status: Done');
    expect(planText).toContain('- [x] AC-0001: first');
    const regText = fs.readFileSync(path.join(root, 'docs', 'ID_REGISTRY.md'), 'utf8');
    expect(regText).toContain('| US           | US-0003               | US-0002           |');
  });

  it('throw mid-tx leaves ALL files byte-identical to seed', async () => {
    root = fs.mkdtempSync(path.join(os.tmpdir(), 'us0242-multi-rb-'));
    fs.mkdirSync(path.join(root, 'docs'), { recursive: true });
    fs.writeFileSync(path.join(root, 'package.json'), JSON.stringify({ name: 't', version: '1.0.0' }));
    const SEED_PLAN =
      '# Plan\n\n```\nEPIC-0001: e\nStatus: To Do\n```\n\n```\nUS-0001 (EPIC-0001): A\nPriority: High (P1)\nEstimate: M\nStatus: To Do\n```\n';
    const SEED_REG =
      '| **Sequence** | **Next Available ID** | **Last Assigned** |\n| ------------ | --------------------- | ----------------- |\n| US           | US-0002               | US-0001           |\n';
    fs.writeFileSync(path.join(root, 'docs', 'RELEASE_PLAN.md'), SEED_PLAN);
    fs.writeFileSync(path.join(root, 'docs', 'ID_REGISTRY.md'), SEED_REG);
    if (Repository._reset) Repository._reset();
    const repo = Repository.getInstance({ root });
    indexReleasePlan({
      index: repo.index,
      markdown: repo.markdown,
      rel: 'docs/RELEASE_PLAN.md',
    });
    indexIdRegistry({
      index: repo.index,
      markdown: repo.markdown,
      rel: 'docs/ID_REGISTRY.md',
    });

    await expect(
      repo.transaction(async (tx) => {
        await tx.stories.update('US-0001', (s) => {
          s.status = 'Done';
        });
        await tx.idRegistry.allocate('US');
        throw new Error('boom');
      }),
    ).rejects.toThrow('boom');

    expect(fs.readFileSync(path.join(root, 'docs', 'RELEASE_PLAN.md'), 'utf8')).toBe(SEED_PLAN);
    expect(fs.readFileSync(path.join(root, 'docs', 'ID_REGISTRY.md'), 'utf8')).toBe(SEED_REG);
    expect(repo.stories.get('US-0001').status).toBe('To Do');
  });
});
