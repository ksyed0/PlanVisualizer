'use strict';

const fs = require('fs');
const path = require('path');

const { serialize } = require('../../../../tools/lib/repository/serializers/story-serializer');
const { parseReleasePlan } = require('../../../../tools/lib/parse-release-plan');
const { ValidationError } = require('../../../../tools/lib/repository/errors');

const FIXTURE_DIR = path.join(__dirname, '..', '..', '..', 'fixtures', 'serializers', 'stories');

function loadFixture(name) {
  return fs.readFileSync(path.join(FIXTURE_DIR, name), 'utf8');
}

const FIXTURES = [
  'story-minimal.md',
  'story-with-deps.md',
  'story-with-related-bug.md',
  'story-completed.md',
  'story-multiline-ac-text.md',
  'story-with-branch-only.md',
];

describe('story-serializer', () => {
  describe.each(FIXTURES)('%s', (name) => {
    const input = loadFixture(name);
    const doc = '# Test\n\n```\n' + input + '```\n';
    const { stories: parsed } = parseReleasePlan(doc);

    it('parses to exactly one story', () => {
      expect(parsed).toHaveLength(1);
    });

    it('round-trip: parse(serialize(parse(input))) deep-equals parse(input)', () => {
      const blockText = serialize(parsed[0]);
      const doc2 = '# Test\n\n```\n' + blockText + '```\n';
      const { stories: reparsed } = parseReleasePlan(doc2);
      expect(reparsed).toEqual(parsed);
    });
  });

  describe('validation', () => {
    it('throws ValidationError when status is not in the allowed enum', () => {
      const bad = {
        id: 'US-9999',
        epicId: 'EPIC-0001',
        title: 'x',
        status: 'Maybe',
        priority: 'High',
        estimate: 'M',
        acs: [],
      };
      expect(() => serialize(bad)).toThrow(ValidationError);
    });

    it('throws ValidationError when id does not match US-\\d+', () => {
      const bad = {
        id: 'WAT-0001',
        epicId: 'EPIC-0001',
        title: 'x',
        status: 'To Do',
        priority: 'High',
        estimate: 'M',
        acs: [],
      };
      expect(() => serialize(bad)).toThrow(ValidationError);
    });
  });
});
