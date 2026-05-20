const fs = require('fs');
const path = require('path');
const os = require('os');
const { Repository } = require('../../../tools/lib/repository');
const { indexAll } = require('../../../tools/lib/repository/indexers');

const SAMPLE = `\`\`\`
EPIC-0001: Demo
Status: Done
\`\`\`
\`\`\`
US-0001 (EPIC-0001): A
Status: Done
Acceptance Criteria:

- [x] AC-0001: one
\`\`\`
`;

describe('entity read APIs', () => {
  let root, repo;
  beforeEach(() => {
    root = fs.mkdtempSync(path.join(os.tmpdir(), 'erd-'));
    fs.mkdirSync(path.join(root, 'docs'));
    fs.writeFileSync(path.join(root, 'docs', 'RELEASE_PLAN.md'), SAMPLE);
    Repository._reset();
    repo = Repository.getInstance({ root });
    indexAll({ index: repo.index, markdown: repo.markdown, warningsChannel: repo.warningsChannel });
  });
  afterEach(() => {
    Repository._reset();
    fs.rmSync(root, { recursive: true, force: true });
  });

  test('repo.epics.get / list', () => {
    expect(repo.epics.get('EPIC-0001').title).toBe('Demo');
    expect(repo.epics.list().length).toBe(1);
  });
  test('repo.stories.get / list with filters', () => {
    expect(repo.stories.get('US-0001').epicId).toBe('EPIC-0001');
    expect(repo.stories.list({ epicId: 'EPIC-0001' }).length).toBe(1);
    expect(repo.stories.list({ status: 'Done' }).length).toBe(1);
    expect(repo.stories.list({ status: 'Planned' }).length).toBe(0);
  });
  test('repo.acs.list returns ordered ACs for a story', () => {
    const acs = repo.acs.list({ storyId: 'US-0001' });
    expect(acs.map((a) => a.id)).toEqual(['AC-0001']);
    expect(acs[0].checked).toBe(true);
  });
  test('repo.stories.list accepts an array of statuses (IN clause)', () => {
    expect(repo.stories.list({ status: ['Done', 'Planned'] }).length).toBe(1);
    expect(repo.stories.list({ status: ['Planned', 'In Progress'] }).length).toBe(0);
  });
});
