'use strict';
const path = require('path');
const fs = require('fs');
const { parseBugs } = require('../../tools/lib/parse-bugs');

const fixture = fs.readFileSync(
  path.join(__dirname, '../fixtures/BUGS.md'), 'utf8'
);

describe('parseBugs', () => {
  let result;
  beforeAll(() => { result = parseBugs(fixture); });

  it('extracts one bug', () => expect(result).toHaveLength(1));
  it('parses id', () => expect(result[0].id).toBe('BUG-0001'));
  it('parses title', () => expect(result[0].title).toMatch(/empty file/));
  it('parses severity', () => expect(result[0].severity).toBe('High'));
  it('parses relatedStory', () => expect(result[0].relatedStory).toBe('US-0001'));
  it('parses status', () => expect(result[0].status).toBe('Open'));
  it('parses fixBranch', () => expect(result[0].fixBranch).toBe('bugfix/BUG-0001-empty-file-crash'));
  it('parses lessonEncoded', () => expect(result[0].lessonEncoded).toBe('No'));
});

describe('parseBugs — multiple bugs', () => {
  it('slices correctly between two bugs', () => {
    const md = `BUG-0002: First bug\nSeverity: Medium\nRelated Story: US-0001\nRelated Task:\nStatus: Open\nFix Branch: bugfix/BUG-0002\nLesson Encoded: No\n\nBUG-0003: Second bug\nSeverity: Low\nRelated Story: US-0002\nRelated Task:\nStatus: Fixed\nFix Branch: bugfix/BUG-0003\nLesson Encoded: Yes\n`;
    const result = parseBugs(md);
    expect(result).toHaveLength(2);
    expect(result[0].id).toBe('BUG-0002');
    expect(result[0].relatedStory).toBe('US-0001');
    expect(result[1].id).toBe('BUG-0003');
    expect(result[1].status).toBe('Fixed');
  });
});
