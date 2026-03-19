'use strict';
const { parseLessons } = require('../../tools/lib/parse-lessons');

const sample = `
# LESSONS.md — Hard-Won Lessons

---

## L-0001 — Jest upgrade eliminates transitive deprecation warnings
**Rule:** Always upgrade Jest to the latest stable major when transitive dependencies emit deprecation warnings.
*Learned when inflight@1.0.6 and glob@7 appeared after npm install. Upgrading to jest@30 eliminated both.*
**Date:** 2026-03-10

---

## L-0007 — All config paths must use lowercase
**Rule:** Every path in plan-visualizer.config.json must match the actual directory casing on Linux.
*Learned when the workflow deployed ./docs but the generator wrote to Docs/.*
**Date:** 2026-03-10

---

## L-0011 — HTML-escape all user-supplied strings before DOM injection
**Rule:** Every field sourced from user-controlled markdown files must be run through an HTML-escape helper.
*Learned when BUG-0005 showed that unescaped script tag in a story title executed on page load.*
**Date:** 2026-03-10
`;

describe('parseLessons', () => {
  let lessons;
  beforeAll(() => { lessons = parseLessons(sample); });

  it('returns an array', () => expect(Array.isArray(lessons)).toBe(true));
  it('parses all lesson entries', () => expect(lessons).toHaveLength(3));
  it('parses L-0001 id correctly', () => expect(lessons[0].id).toBe('L-0001'));
  it('parses L-0007 id correctly', () => expect(lessons[1].id).toBe('L-0007'));
  it('parses title correctly', () => expect(lessons[0].title).toMatch(/Jest upgrade/));
  it('parses rule text', () => expect(lessons[0].rule).toMatch(/Always upgrade Jest/));
  it('parses context text', () => expect(lessons[0].context).toMatch(/inflight/));
  it('parses date', () => expect(lessons[0].date).toBe('2026-03-10'));
  it('preserves document order (non-sequential IDs)', () => {
    expect(lessons.map(l => l.id)).toEqual(['L-0001', 'L-0007', 'L-0011']);
  });
  it('handles empty markdown', () => expect(parseLessons('')).toEqual([]));
  it('handles markdown with no lessons', () => expect(parseLessons('# Title\nSome text\n')).toEqual([]));
});
