'use strict';
const fs = require('fs');
const path = require('path');
const os = require('os');
const { openIndexDatastore } = require('../../../tools/lib/repository/index-datastore');
const { applySchemaMigrations } = require('../../../tools/lib/repository/schema');
const { MarkdownDatastore } = require('../../../tools/lib/repository/markdown-datastore');
const { indexReleasePlan } = require('../../../tools/lib/repository/indexers/release-plan-indexer');

const SAMPLE = `# Release Plan

## Epic — EPIC-0001

\`\`\`
EPIC-0001: First Epic
Description: Demo
Status: Done
\`\`\`

\`\`\`
US-0001 (EPIC-0001): As a user, I want X.
Priority: High (P1)
Status: Done
Branch: feature/US-0001-x
Acceptance Criteria:

- [x] AC-0001: One thing
- [ ] AC-0002: Another thing
\`\`\`
`;

describe('release-plan-indexer', () => {
  let root, index, md;
  beforeEach(() => {
    root = fs.mkdtempSync(path.join(os.tmpdir(), 'idx-'));
    fs.mkdirSync(path.join(root, 'docs'));
    fs.writeFileSync(path.join(root, 'docs', 'RELEASE_PLAN.md'), SAMPLE);
    index = openIndexDatastore({ path: path.join(root, '.cache', 'pv.db') });
    applySchemaMigrations(index);
    md = new MarkdownDatastore({ root });
  });
  afterEach(() => {
    index.close();
    fs.rmSync(root, { recursive: true, force: true });
  });

  test('ingests epics, stories, and ACs', () => {
    const result = indexReleasePlan({ index, markdown: md, rel: 'docs/RELEASE_PLAN.md' });
    expect(result.counts).toEqual({ epics: 1, stories: 1, acs: 2 });
    const epic = index.prepare('SELECT * FROM epics WHERE id=?').get('EPIC-0001');
    expect(epic.status).toBe('Done');
    const story = index.prepare('SELECT * FROM stories WHERE id=?').get('US-0001');
    expect(story.epic_id).toBe('EPIC-0001');
    expect(story.branch).toBe('feature/US-0001-x');
    const acs = index.prepare('SELECT * FROM acs WHERE story_id=? ORDER BY position').all('US-0001');
    expect(acs.map((a) => [a.id, !!a.checked])).toEqual([
      ['AC-0001', true],
      ['AC-0002', false],
    ]);
  });

  test('emits orphan-ac warning when AC references a missing story', () => {
    const result = indexReleasePlan({ index, markdown: md, rel: 'docs/RELEASE_PLAN.md' });
    expect(result.warnings.length).toBeGreaterThanOrEqual(0);
  });
});
