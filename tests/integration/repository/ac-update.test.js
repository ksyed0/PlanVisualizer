'use strict';

const fs = require('fs');
const os = require('os');
const path = require('path');
const { Repository } = require('../../../tools/lib/repository');
const { indexReleasePlan } = require('../../../tools/lib/repository/indexers/release-plan-indexer');

const SAMPLE = `# Plan

\`\`\`
EPIC-0001: Sample epic
Status: To Do
\`\`\`

\`\`\`
US-0001 (EPIC-0001): Sample story
Priority: High (P1)
Estimate: M
Status: To Do
Acceptance Criteria:
- [ ] AC-0001: first
- [ ] AC-0002: second
\`\`\`
`;

describe('US-0240: AcRepo.update', () => {
  let root;
  afterEach(() => {
    if (Repository._reset) Repository._reset();
    if (root) fs.rmSync(root, { recursive: true, force: true });
  });

  it('flips AC-0001 to checked + preserves AC-0002 + preserves story prose', async () => {
    root = fs.mkdtempSync(path.join(os.tmpdir(), 'us0240-ac-'));
    fs.mkdirSync(path.join(root, 'docs'), { recursive: true });
    fs.writeFileSync(path.join(root, 'package.json'), JSON.stringify({ name: 't', version: '1.0.0' }));
    fs.writeFileSync(path.join(root, 'docs', 'RELEASE_PLAN.md'), SAMPLE);
    if (Repository._reset) Repository._reset();
    const repo = Repository.getInstance({ root });
    indexReleasePlan({
      index: repo.index,
      markdown: repo.markdown,
      rel: 'docs/RELEASE_PLAN.md',
    });

    await repo.acs.update('AC-0001', (ac) => {
      ac.checked = true;
    });

    const after = fs.readFileSync(path.join(root, 'docs', 'RELEASE_PLAN.md'), 'utf8');
    expect(after).toContain('- [x] AC-0001: first');
    expect(after).toContain('- [ ] AC-0002: second');
    expect(after).toContain('US-0001 (EPIC-0001): Sample story');
  });

  it('throws when AC id does not exist', async () => {
    root = fs.mkdtempSync(path.join(os.tmpdir(), 'us0240-ac-'));
    fs.mkdirSync(path.join(root, 'docs'), { recursive: true });
    fs.writeFileSync(path.join(root, 'package.json'), JSON.stringify({ name: 't', version: '1.0.0' }));
    fs.writeFileSync(path.join(root, 'docs', 'RELEASE_PLAN.md'), SAMPLE);
    if (Repository._reset) Repository._reset();
    const repo = Repository.getInstance({ root });
    indexReleasePlan({
      index: repo.index,
      markdown: repo.markdown,
      rel: 'docs/RELEASE_PLAN.md',
    });
    await expect(repo.acs.update('AC-9999', () => {})).rejects.toThrow(/not found/i);
  });
});
