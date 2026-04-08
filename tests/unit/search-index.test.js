'use strict';
const { scoreMatch, buildSearchIndex } = require('../../tools/lib/search-index');

const storyEntry = {
  type: 'story',
  id: 'US-0042',
  title: 'Build global search feature',
  epicId: 'EPIC-0011',
  tabName: 'hierarchy',
  domId: 'story-US-0042',
};
const bugEntry = {
  type: 'bug',
  id: 'BUG-0015',
  title: 'Auth redirect fails on mobile',
  severity: 'High',
  tabName: 'bugs',
  domId: 'bug-row-BUG-0015',
};
const lessonEntry = {
  type: 'lesson',
  id: 'L-0007',
  rule: 'Always validate auth tokens',
  tabName: 'lessons',
  domIdCol: 'lesson-col-L-0007',
  domIdCard: 'lesson-card-L-0007',
};

describe('scoreMatch', () => {
  test('empty query returns -1', () => {
    expect(scoreMatch(storyEntry, '')).toBe(-1);
    expect(scoreMatch(storyEntry, '   ')).toBe(-1);
  });

  test('exact ID match returns 4', () => {
    expect(scoreMatch(storyEntry, 'US-0042')).toBe(4);
    expect(scoreMatch(storyEntry, 'us-0042')).toBe(4); // case-insensitive
    expect(scoreMatch(bugEntry, 'BUG-0015')).toBe(4);
  });

  test('field starts-with returns 3', () => {
    expect(scoreMatch(storyEntry, 'Build')).toBe(3);
    expect(scoreMatch(storyEntry, 'build')).toBe(3);
    expect(scoreMatch(lessonEntry, 'Always')).toBe(3);
  });

  test('substring match returns 2', () => {
    expect(scoreMatch(storyEntry, 'global search')).toBe(2);
    expect(scoreMatch(bugEntry, 'redirect')).toBe(2);
  });

  test('fuzzy char-sequence returns 1', () => {
    // 'glbl srch' matches 'Build global search feature' by character sequence
    expect(scoreMatch(storyEntry, 'glbl srch')).toBe(1);
  });

  test('no match returns 0', () => {
    expect(scoreMatch(storyEntry, 'xyz999notaword')).toBe(0);
  });

  test('exact ID takes priority over starts-with', () => {
    // 'US-0042' exactly matches ID — should be 4, not 3
    expect(scoreMatch(storyEntry, 'US-0042')).toBe(4);
  });
});

const sampleData = {
  stories: [
    { id: 'US-0042', title: 'Build global search', epicId: 'EPIC-0011', status: 'Planned' },
    { id: 'US-0001', title: 'Init project', epicId: 'EPIC-0001', status: 'Done' },
  ],
  bugs: [{ id: 'BUG-0015', title: 'Auth redirect fails', severity: 'High', status: 'Open' }],
  lessons: [{ id: 'L-0007', rule: 'Validate tokens', context: 'Security' }],
};

describe('buildSearchIndex', () => {
  let index;
  beforeEach(() => {
    index = buildSearchIndex(sampleData);
  });

  test('returns an array', () => {
    expect(Array.isArray(index)).toBe(true);
  });

  test('contains one entry per story, bug, and lesson', () => {
    expect(index.filter((e) => e.type === 'story')).toHaveLength(2);
    expect(index.filter((e) => e.type === 'bug')).toHaveLength(1);
    expect(index.filter((e) => e.type === 'lesson')).toHaveLength(1);
  });

  test('story entry has correct shape', () => {
    const s = index.find((e) => e.id === 'US-0042');
    expect(s).toEqual({
      type: 'story',
      id: 'US-0042',
      title: 'Build global search',
      epicId: 'EPIC-0011',
      status: 'Planned',
      tabName: 'hierarchy',
      domId: 'story-US-0042',
    });
  });

  test('bug entry has correct shape', () => {
    const b = index.find((e) => e.id === 'BUG-0015');
    expect(b).toEqual({
      type: 'bug',
      id: 'BUG-0015',
      title: 'Auth redirect fails',
      severity: 'High',
      status: 'Open',
      tabName: 'bugs',
      domId: 'bug-row-BUG-0015',
    });
  });

  test('lesson entry has correct shape', () => {
    const l = index.find((e) => e.id === 'L-0007');
    expect(l).toEqual({
      type: 'lesson',
      id: 'L-0007',
      rule: 'Validate tokens',
      tabName: 'lessons',
      domIdCol: 'lesson-col-L-0007',
      domIdCard: 'lesson-card-L-0007',
    });
  });

  test('handles missing optional data arrays gracefully', () => {
    expect(() => buildSearchIndex({})).not.toThrow();
    expect(buildSearchIndex({})).toEqual([]);
  });

  test('XSS: title containing </script> does not appear unescaped in JSON output', () => {
    const dangerous = buildSearchIndex({
      stories: [{ id: 'US-X', title: '</script><script>alert(1)</script>', epicId: 'E', status: 'Planned' }],
      bugs: [],
      lessons: [],
    });
    const json = JSON.stringify(dangerous);
    expect(json).not.toContain('</script>');
  });
});
