'use strict';
const path = require('path');
const fs = require('fs');
const { parseTestCases } = require('../../tools/lib/parse-test-cases');

const fixture = fs.readFileSync(
  path.join(__dirname, '../fixtures/TEST_CASES.md'), 'utf8'
);

describe('parseTestCases', () => {
  let result;
  beforeAll(() => { result = parseTestCases(fixture); });

  it('extracts one test case', () => expect(result).toHaveLength(1));
  it('parses TC id', () => expect(result[0].id).toBe('TC-0001'));
  it('parses title', () => expect(result[0].title).toMatch(/File picker/));
  it('parses relatedStory', () => expect(result[0].relatedStory).toBe('US-0001'));
  it('parses relatedTask', () => expect(result[0].relatedTask).toBe('TASK-0001'));
  it('parses relatedAC', () => expect(result[0].relatedAC).toBe('AC-0001'));
  it('parses type', () => expect(result[0].type).toBe('Functional'));
  it('parses status as Not Run', () => expect(result[0].status).toBe('Not Run'));
  it('parses defect as None', () => expect(result[0].defect).toBe('None'));
});

describe('parseTestCases — status branches', () => {
  it('parses [x] Pass status', () => {
    const md = `TC-0002: Some test\nRelated Story: US-0001\nRelated Task:\nRelated AC:\nType: Functional\nStatus: [x] Pass\nDefect Raised: None\n`;
    const result = parseTestCases(md);
    expect(result[0].status).toBe('Pass');
  });

  it('parses [x] Fail status', () => {
    const md = `TC-0003: Another test\nRelated Story: US-0001\nRelated Task:\nRelated AC:\nType: Functional\nStatus: [x] Fail\nDefect Raised: BUG-0001\n`;
    const result = parseTestCases(md);
    expect(result[0].status).toBe('Fail');
    expect(result[0].defect).toBe('BUG-0001');
  });

  it('defaults defect to None when Defect Raised field is absent', () => {
    const md = `TC-0009: No defect field\nRelated Story: US-0001\nRelated Task:\nRelated AC:\nType: Functional\nStatus: [ ] Not Run\n`;
    const result = parseTestCases(md);
    expect(result[0].defect).toBe('None');
  });

  it('handles multiple TCs, slicing correctly', () => {
    const md = `TC-0004: First\nRelated Story: US-0001\nRelated Task:\nRelated AC:\nType: Unit\nStatus: [ ] Not Run\nDefect Raised: None\n\nTC-0005: Second\nRelated Story: US-0002\nRelated Task:\nRelated AC:\nType: Unit\nStatus: [ ] Not Run\nDefect Raised: None\n`;
    const result = parseTestCases(md);
    expect(result).toHaveLength(2);
    expect(result[0].relatedStory).toBe('US-0001');
    expect(result[1].relatedStory).toBe('US-0002');
  });
});
