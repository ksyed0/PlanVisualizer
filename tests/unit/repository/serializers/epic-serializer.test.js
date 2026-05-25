'use strict';

const fs = require('fs');
const path = require('path');
const { serialize } = require('../../../../tools/lib/repository/serializers/epic-serializer');
const { parseReleasePlan } = require('../../../../tools/lib/parse-release-plan');
const { ValidationError } = require('../../../../tools/lib/repository/errors');

const DIR = path.join(__dirname, '..', '..', '..', 'fixtures', 'serializers', 'epics');
const FIXTURES = ['epic-minimal.md', 'epic-with-deps.md', 'epic-with-dates.md'];

describe('epic-serializer', () => {
  describe.each(FIXTURES)('%s', (name) => {
    let parsed;

    beforeAll(() => {
      const input = fs.readFileSync(path.join(DIR, name), 'utf8');
      const doc = '# Test\n\n```\n' + input + '\n```\n';
      const { epics } = parseReleasePlan(doc);
      parsed = epics;
    });

    it('parses to exactly one epic', () => expect(parsed).toHaveLength(1));

    it('round-trip', () => {
      const out = serialize(parsed[0]);
      const { epics: reparsed } = parseReleasePlan('# Test\n\n```\n' + out + '\n```\n');
      expect(reparsed).toEqual(parsed);
    });
  });

  it('throws ValidationError when id is not EPIC-XXXX', () => {
    expect(() => serialize({ id: 'WAT', title: 'x', status: 'To Do' })).toThrow(ValidationError);
  });

  it('throws ValidationError when title is missing', () => {
    expect(() => serialize({ id: 'EPIC-0001', status: 'To Do' })).toThrow(ValidationError);
  });

  it('throws ValidationError when status not in enum', () => {
    expect(() => serialize({ id: 'EPIC-0001', title: 'x', status: 'Maybe' })).toThrow(ValidationError);
  });
});
