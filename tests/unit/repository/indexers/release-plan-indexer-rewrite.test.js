'use strict';
const fs = require('fs');
const path = require('path');
const os = require('os');
const { Repository } = require('../../../../tools/lib/repository');
const { indexReleasePlan } = require('../../../../tools/lib/repository/indexers/release-plan-indexer');

const FIXTURE_FENCED_ONLY = `
\`\`\`
EPIC-0001: Fenced Epic
Status: Done
\`\`\`
\`\`\`
US-0001 (EPIC-0001): Fenced Story
Status: Done
Acceptance Criteria:
- [x] AC-0001: one
\`\`\`
`;

const FIXTURE_MIXED = `
\`\`\`
EPIC-0001: Fenced Epic
Status: Done
\`\`\`

EPIC-0002: Prose Epic
Status: In Progress

\`\`\`
US-0001 (EPIC-0001): Fenced Story
Status: Done
Acceptance Criteria:
- [x] AC-0001: one
\`\`\`

US-0002 (EPIC-0002): Prose Story
Status: To Do
Acceptance Criteria:
- [ ] AC-0002: two
`;

const FIXTURE_WITH_TASK = `
\`\`\`
EPIC-0001: E
Status: Done
\`\`\`
\`\`\`
US-0001 (EPIC-0001): S
Status: Done
\`\`\`
\`\`\`
TASK-0001 (US-0001): T
Type: Implementation
Status: Done
\`\`\`
`;

function setup(fixture) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'rpi-rewrite-'));
  fs.mkdirSync(path.join(root, 'docs'));
  fs.writeFileSync(path.join(root, 'docs', 'RELEASE_PLAN.md'), fixture);
  Repository._reset();
  const repo = Repository.getInstance({ root });
  return { root, repo };
}

describe('release-plan-indexer rewrite — parseReleasePlan as canonical extractor', () => {
  let root, repo;

  afterEach(() => {
    Repository._reset();
    if (root) fs.rmSync(root, { recursive: true, force: true });
  });

  test('indexes fenced entities (regression guard)', () => {
    ({ root, repo } = setup(FIXTURE_FENCED_ONLY));
    indexReleasePlan({ index: repo.index, markdown: repo.markdown, rel: 'docs/RELEASE_PLAN.md' });
    expect(
      repo.index
        .prepare('SELECT id FROM epics ORDER BY id')
        .all()
        .map((r) => r.id),
    ).toEqual(['EPIC-0001']);
    expect(
      repo.index
        .prepare('SELECT id FROM stories ORDER BY id')
        .all()
        .map((r) => r.id),
    ).toEqual(['US-0001']);
    expect(
      repo.index
        .prepare('SELECT id FROM acs ORDER BY id')
        .all()
        .map((r) => r.id),
    ).toEqual(['AC-0001']);
  });

  test('indexes prose-node entities (closes L-0075)', () => {
    ({ root, repo } = setup(FIXTURE_MIXED));
    indexReleasePlan({ index: repo.index, markdown: repo.markdown, rel: 'docs/RELEASE_PLAN.md' });
    const epicIds = repo.index
      .prepare('SELECT id FROM epics ORDER BY id')
      .all()
      .map((r) => r.id);
    const storyIds = repo.index
      .prepare('SELECT id FROM stories ORDER BY id')
      .all()
      .map((r) => r.id);
    expect(epicIds).toEqual(['EPIC-0001', 'EPIC-0002']);
    expect(storyIds).toEqual(['US-0001', 'US-0002']);
  });

  test('populates planning_tasks (closes incidental empty-table bug)', () => {
    ({ root, repo } = setup(FIXTURE_WITH_TASK));
    indexReleasePlan({ index: repo.index, markdown: repo.markdown, rel: 'docs/RELEASE_PLAN.md' });
    const taskIds = repo.index
      .prepare('SELECT id FROM planning_tasks ORDER BY id')
      .all()
      .map((r) => r.id);
    expect(taskIds).toEqual(['TASK-0001']);
  });
});
