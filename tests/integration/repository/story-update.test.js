'use strict';

const fs = require('fs');
const os = require('os');
const path = require('path');
const { Repository } = require('../../../tools/lib/repository');
const { indexReleasePlan } = require('../../../tools/lib/repository/indexers/release-plan-indexer');

function mkRoot() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'us0240-story-update-'));
  fs.mkdirSync(path.join(root, 'docs'), { recursive: true });
  fs.writeFileSync(path.join(root, 'package.json'), JSON.stringify({ name: 't', version: '1.0.0' }));
  return root;
}

function indexSetup(repo) {
  indexReleasePlan({
    index: repo.index,
    markdown: repo.markdown,
    rel: 'docs/RELEASE_PLAN.md',
  });
}

const SAMPLE_DOC = `# Plan

intro prose with **markdown** that must survive byte-identical

\`\`\`
EPIC-0001: Test Epic
Status: In Progress
\`\`\`

\`\`\`
US-0001 (EPIC-0001): Sample story
Priority: High (P1)
Estimate: M
Status: To Do
Acceptance Criteria:

- [ ] AC-0001: do the thing
- [ ] AC-0002: do the other thing
\`\`\`

middle prose
- a bullet list
- another bullet

\`\`\`
US-0002 (EPIC-0001): Second story
Priority: Medium (P2)
Estimate: S
Status: To Do
\`\`\`

trailing prose
`;

describe('US-0240 / AC-0938 + AC-0942: StoryRepo.update', () => {
  let root;
  afterEach(() => {
    if (Repository._reset) Repository._reset();
    if (root) fs.rmSync(root, { recursive: true, force: true });
  });

  it('updates US-0001.status to "Done" and leaves surrounding prose byte-identical', async () => {
    root = mkRoot();
    fs.writeFileSync(path.join(root, 'docs', 'RELEASE_PLAN.md'), SAMPLE_DOC);

    if (Repository._reset) Repository._reset();
    const repo = Repository.getInstance({ root });
    indexSetup(repo);

    await repo.stories.update('US-0001', (s) => {
      s.status = 'Done';
    });

    const after = fs.readFileSync(path.join(root, 'docs', 'RELEASE_PLAN.md'), 'utf8');
    expect(after).toMatch(/US-0001 \(EPIC-0001\): Sample story[\s\S]+?Status: Done/);
    const us0002Original = SAMPLE_DOC.match(/```\s*\nUS-0002[\s\S]+?```/)[0];
    const us0002After = after.match(/```\s*\nUS-0002[\s\S]+?```/)[0];
    expect(us0002After).toBe(us0002Original);
    expect(after).toContain('intro prose with **markdown** that must survive byte-identical');
    expect(after).toContain('middle prose\n- a bullet list\n- another bullet');
    expect(after).toContain('trailing prose');
    expect(repo.stories.get('US-0001').status).toBe('Done');
  });

  it('throws ValidationError when fn produces an invalid status', async () => {
    root = mkRoot();
    fs.writeFileSync(path.join(root, 'docs', 'RELEASE_PLAN.md'), SAMPLE_DOC);
    if (Repository._reset) Repository._reset();
    const repo = Repository.getInstance({ root });
    indexSetup(repo);
    const { ValidationError } = require('../../../tools/lib/repository/errors');
    await expect(
      repo.stories.update('US-0001', (s) => {
        s.status = 'Maybe';
      }),
    ).rejects.toThrow(ValidationError);
    const after = fs.readFileSync(path.join(root, 'docs', 'RELEASE_PLAN.md'), 'utf8');
    expect(after).toBe(SAMPLE_DOC);
  });

  it('throws when the id does not exist', async () => {
    root = mkRoot();
    fs.writeFileSync(path.join(root, 'docs', 'RELEASE_PLAN.md'), SAMPLE_DOC);
    if (Repository._reset) Repository._reset();
    const repo = Repository.getInstance({ root });
    indexSetup(repo);
    await expect(
      repo.stories.update('US-9999', (s) => {
        s.status = 'Done';
      }),
    ).rejects.toThrow(/not found/i);
  });
});

describe('US-0240 / AC-0938: StoryRepo.create', () => {
  let root;
  afterEach(() => {
    if (Repository._reset) Repository._reset();
    if (root) fs.rmSync(root, { recursive: true, force: true });
  });

  it('appends a new story block at end-of-file and indexes it', async () => {
    root = mkRoot();
    fs.writeFileSync(path.join(root, 'docs', 'RELEASE_PLAN.md'), SAMPLE_DOC);
    if (Repository._reset) Repository._reset();
    const repo = Repository.getInstance({ root });
    indexSetup(repo);

    await repo.stories.create({
      id: 'US-0003',
      epicId: 'EPIC-0001',
      title: 'Newly minted',
      status: 'To Do',
      priority: 'Low (P3)',
      estimate: 'S',
      acs: [],
    });
    const after = fs.readFileSync(path.join(root, 'docs', 'RELEASE_PLAN.md'), 'utf8');
    expect(after).toMatch(/US-0003 \(EPIC-0001\): Newly minted/);
    expect(repo.stories.get('US-0003').title).toBe('Newly minted');
    expect(after).toContain('intro prose with **markdown**');
  });

  it('throws ValidationError when id collides with an existing story', async () => {
    root = mkRoot();
    fs.writeFileSync(path.join(root, 'docs', 'RELEASE_PLAN.md'), SAMPLE_DOC);
    if (Repository._reset) Repository._reset();
    const repo = Repository.getInstance({ root });
    indexSetup(repo);
    const { ValidationError } = require('../../../tools/lib/repository/errors');
    await expect(
      repo.stories.create({
        id: 'US-0001',
        epicId: 'EPIC-0001',
        title: 'dup',
        status: 'To Do',
        priority: 'High (P1)',
        estimate: 'M',
        acs: [],
      }),
    ).rejects.toThrow(ValidationError);
  });
});
