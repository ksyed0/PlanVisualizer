const fs = require('fs');
const path = require('path');
const { parseMarkdown } = require('../../../tools/lib/repository/ast/parser');
const { serializeAst } = require('../../../tools/lib/repository/ast/serializer');

const ROOT = path.join(__dirname, '../../..');
const TARGETS = [
  'docs/RELEASE_PLAN.md',
  'docs/BUGS.md',
  'docs/LESSONS.md',
  'docs/TEST_CASES.md',
  'docs/ID_REGISTRY.md',
];

describe('round-trip on production files', () => {
  for (const rel of TARGETS) {
    test(`${rel} is idempotent on second pass`, () => {
      const abs = path.join(ROOT, rel);
      if (!fs.existsSync(abs)) return;
      const src = fs.readFileSync(abs, 'utf8');
      const once = serializeAst(parseMarkdown(src));
      const twice = serializeAst(parseMarkdown(once));
      expect(twice).toBe(once);
    });
  }
});
