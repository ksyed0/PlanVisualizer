'use strict';
const { scoreMatch } = require('../../tools/lib/search-index');

const storyEntry  = { type: 'story',  id: 'US-0042',  title: 'Build global search feature', epicId: 'EPIC-0011', tabName: 'hierarchy', domId: 'story-US-0042' };
const bugEntry    = { type: 'bug',    id: 'BUG-0015', title: 'Auth redirect fails on mobile', severity: 'High', tabName: 'bugs', domId: 'bug-row-BUG-0015' };
const lessonEntry = { type: 'lesson', id: 'L-0007',   rule: 'Always validate auth tokens',   tabName: 'lessons', domIdCol: 'lesson-col-L-0007', domIdCard: 'lesson-card-L-0007' };

describe('scoreMatch', () => {
  test('empty query returns -1', () => {
    expect(scoreMatch(storyEntry, '')).toBe(-1);
    expect(scoreMatch(storyEntry, '   ')).toBe(-1);
  });

  test('exact ID match returns 4', () => {
    expect(scoreMatch(storyEntry, 'US-0042')).toBe(4);
    expect(scoreMatch(storyEntry, 'us-0042')).toBe(4); // case-insensitive
    expect(scoreMatch(bugEntry,   'BUG-0015')).toBe(4);
  });

  test('field starts-with returns 3', () => {
    expect(scoreMatch(storyEntry, 'Build')).toBe(3);
    expect(scoreMatch(storyEntry, 'build')).toBe(3);
    expect(scoreMatch(lessonEntry, 'Always')).toBe(3);
  });

  test('substring match returns 2', () => {
    expect(scoreMatch(storyEntry, 'global search')).toBe(2);
    expect(scoreMatch(bugEntry,   'redirect')).toBe(2);
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
