'use strict';

const fs = require('fs');
const path = require('path');
const { validateLessonsTags } = require('../../tools/lib/agent-context-assembler');

test('every L-XXXX entry in LESSONS.md has a canonical @agent: tag', () => {
  const content = fs.readFileSync(path.join(__dirname, '../../docs/LESSONS.md'), 'utf8');
  const result = validateLessonsTags(content);
  expect(result.untaggedCount).toBe(0);
  expect(result.invalidNames).toEqual([]);
  expect(result.taggedCount).toBeGreaterThan(0);
});
