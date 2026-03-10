// tests/unit/parse-progress.test.js
'use strict';
const path = require('path');
const fs = require('fs');
const { parseRecentActivity } = require('../../tools/lib/parse-progress');

const fixture = fs.readFileSync(
  path.join(__dirname, '../fixtures/progress.md'), 'utf8'
);

describe('parseRecentActivity', () => {
  let result;
  beforeAll(() => { result = parseRecentActivity(fixture, 3); });

  it('returns at most 3 sessions', () => expect(result.length).toBeLessThanOrEqual(3));
  it('returns sessions in reverse-chronological order', () =>
    expect(result[0].date).toBe('2026-03-10'));
  it('parses session date', () => expect(result[0].date).toMatch(/\d{4}-\d{2}-\d{2}/));
  it('parses summary text', () => expect(result[0].summary).toMatch(/FileSystemBridge/));
});

describe('parseRecentActivity — edge cases', () => {
  it('uses default limit of 5 when not specified', () => {
    const md = require('fs').readFileSync(
      require('path').join(__dirname, '../fixtures/progress.md'), 'utf8'
    );
    const result = parseRecentActivity(md);
    expect(result.length).toBeLessThanOrEqual(5);
  });

  it('returns empty string summary when no What Was Done section', () => {
    const md = `## Session 1 — 2026-03-08\n\n### Blockers\n- None\n`;
    const result = parseRecentActivity(md, 3);
    expect(result[0].summary).toBe('');
  });
});
