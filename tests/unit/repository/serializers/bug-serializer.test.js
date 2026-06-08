'use strict';

const fs = require('fs');
const path = require('path');

const { serialize } = require('../../../../tools/lib/repository/serializers/bug-serializer');
const { parseBugs } = require('../../../../tools/lib/parse-bugs');
const { ValidationError } = require('../../../../tools/lib/repository/errors');

const DIR = path.join(__dirname, '..', '..', '..', 'fixtures', 'serializers', 'bugs');
const FIXTURES = fs
  .readdirSync(DIR)
  .filter((f) => f.endsWith('.md'))
  .sort();

describe('bug-serializer', () => {
  describe.each(FIXTURES)('%s', (name) => {
    const input = fs.readFileSync(path.join(DIR, name), 'utf8');
    const parsed = parseBugs(input);

    it('parses to exactly one bug', () => {
      expect(parsed).toHaveLength(1);
    });

    it('round-trip: parse(serialize(parse(input))) deep-equals parse(input)', () => {
      const out = serialize(parsed[0]);
      const reparsed = parseBugs(out);
      expect(reparsed).toEqual(parsed);
    });
  });

  describe('validation', () => {
    it('throws ValidationError on invalid id', () => {
      expect(() =>
        serialize({
          id: 'BAD-1',
          title: 'x',
          status: 'Fixed',
        }),
      ).toThrow(ValidationError);
    });

    it('throws ValidationError on missing title', () => {
      expect(() =>
        serialize({
          id: 'BUG-9999',
          status: 'Fixed',
        }),
      ).toThrow(ValidationError);
    });

    it('throws ValidationError on invalid status', () => {
      expect(() =>
        serialize({
          id: 'BUG-9999',
          title: 'test',
          status: 'Maybe',
        }),
      ).toThrow(ValidationError);
    });

    it('throws ValidationError on null', () => {
      expect(() => serialize(null)).toThrow(ValidationError);
    });
  });
});
