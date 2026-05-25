'use strict';

const fs = require('fs');
const path = require('path');

const { serialize } = require('../../../../tools/lib/repository/serializers/lesson-serializer');
const { parseLessons } = require('../../../../tools/lib/parse-lessons');
const { ValidationError } = require('../../../../tools/lib/repository/errors');

const DIR = path.join(__dirname, '..', '..', '..', 'fixtures', 'serializers', 'lessons');
const FIXTURES = fs
  .readdirSync(DIR)
  .filter((f) => f.endsWith('.md'))
  .sort();

describe('lesson-serializer', () => {
  describe.each(FIXTURES)('%s', (name) => {
    const input = fs.readFileSync(path.join(DIR, name), 'utf8');
    const parsed = parseLessons(input);

    it('parses to exactly one lesson', () => {
      expect(parsed).toHaveLength(1);
    });

    it('round-trip: parse(serialize(parse(input))) deep-equals parse(input)', () => {
      const out = serialize(parsed[0]);
      const reparsed = parseLessons(out);
      expect(reparsed).toEqual(parsed);
    });
  });

  describe('validation', () => {
    it('throws ValidationError on invalid id', () => {
      expect(() =>
        serialize({
          id: 'BAD-1',
          title: 'x',
          rule: 'y',
        }),
      ).toThrow(ValidationError);
    });

    it('throws ValidationError on missing title', () => {
      expect(() =>
        serialize({
          id: 'L-9999',
          rule: 'y',
        }),
      ).toThrow(ValidationError);
    });

    it('does NOT throw on missing rule — production has 15 rule-less lessons (L-0044, L-0051..0074)', () => {
      // Rule is optional. Serializer skips the **Rule:** line if absent.
      const out = serialize({ id: 'L-9999', title: 'x' });
      expect(out).toContain('## L-9999 — x');
      expect(out).not.toContain('**Rule:**');
    });

    it('throws ValidationError on null', () => {
      expect(() => serialize(null)).toThrow(ValidationError);
    });
  });
});
