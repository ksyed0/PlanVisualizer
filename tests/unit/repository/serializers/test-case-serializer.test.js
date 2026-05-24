'use strict';

const fs = require('fs');
const path = require('path');

const { serialize } = require('../../../../tools/lib/repository/serializers/test-case-serializer');
const { parseTestCases } = require('../../../../tools/lib/parse-test-cases');
const { ValidationError } = require('../../../../tools/lib/repository/errors');

const DIR = path.join(__dirname, '..', '..', '..', 'fixtures', 'serializers', 'test-cases');
const FIXTURES = fs
  .readdirSync(DIR)
  .filter((f) => f.endsWith('.md'))
  .sort();

describe('test-case-serializer', () => {
  describe.each(FIXTURES)('%s', (name) => {
    const input = fs.readFileSync(path.join(DIR, name), 'utf8');
    const parsed = parseTestCases(input);

    it('parses to exactly one test case', () => {
      expect(parsed).toHaveLength(1);
    });

    it('round-trip: parse(serialize(parse(input))) deep-equals parse(input)', () => {
      const out = serialize(parsed[0]);
      const reparsed = parseTestCases(out);
      expect(reparsed).toEqual(parsed);
    });
  });

  describe('validation', () => {
    it('throws ValidationError on invalid id', () => {
      expect(() =>
        serialize({
          id: 'BAD-1',
          title: 'x',
          status: 'Pass',
        }),
      ).toThrow(ValidationError);
    });

    it('throws ValidationError on missing title', () => {
      expect(() =>
        serialize({
          id: 'TC-9999',
          status: 'Pass',
        }),
      ).toThrow(ValidationError);
    });

    it('throws ValidationError on invalid status', () => {
      expect(() =>
        serialize({
          id: 'TC-9999',
          title: 'x',
          status: 'Maybe',
        }),
      ).toThrow(ValidationError);
    });

    it('throws ValidationError on null', () => {
      expect(() => serialize(null)).toThrow(ValidationError);
    });
  });
});
