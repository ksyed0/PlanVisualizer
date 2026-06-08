'use strict';

const fs = require('fs');
const path = require('path');

const { serialize } = require('../../../../tools/lib/repository/serializers/task-serializer');
const { ValidationError } = require('../../../../tools/lib/repository/errors');

const DIR = path.join(__dirname, '..', '..', '..', 'fixtures', 'serializers', 'tasks');
const FIXTURES = fs
  .readdirSync(DIR)
  .filter((f) => f.endsWith('.md'))
  .sort();

// Inline mini-parser for tasks since no parseTask module exists
function parseTaskLine(line) {
  const m = line.match(/^(TASK-\d+):\s*(.+?)(?:\s*\(story:\s*(US-\d+|EPIC-\d+)\))?(?:\s*\[(.+?)\])?\s*$/);
  if (!m) return [];
  return [{ id: m[1], title: m[2].trim(), story: m[3], status: m[4] }];
}

function parseTask(text) {
  const trimmed = text.trim();
  return parseTaskLine(trimmed);
}

describe('task-serializer', () => {
  describe.each(FIXTURES)('%s', (name) => {
    const input = fs.readFileSync(path.join(DIR, name), 'utf8');
    const parsed = parseTask(input);

    it('parses to exactly one task', () => {
      expect(parsed).toHaveLength(1);
    });

    it('round-trip: parse(serialize(parse(input))) deep-equals parse(input)', () => {
      const out = serialize(parsed[0]);
      const reparsed = parseTask(out);
      expect(reparsed).toEqual(parsed);
    });
  });

  describe('validation', () => {
    it('throws ValidationError on invalid id', () => {
      expect(() =>
        serialize({
          id: 'BAD-1',
          title: 'x',
        }),
      ).toThrow(ValidationError);
    });

    it('throws ValidationError on missing title', () => {
      expect(() =>
        serialize({
          id: 'TASK-9999',
        }),
      ).toThrow(ValidationError);
    });

    it('throws ValidationError on null', () => {
      expect(() => serialize(null)).toThrow(ValidationError);
    });
  });
});
