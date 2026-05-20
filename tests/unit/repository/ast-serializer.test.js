const fs = require('fs');
const path = require('path');
const { parseMarkdown } = require('../../../tools/lib/repository/ast/parser');
const { serializeAst, replaceBlock } = require('../../../tools/lib/repository/ast/serializer');

const FIXTURE = path.join(__dirname, '../../fixtures/repository/sample-release-plan.md');

describe('serializeAst', () => {
  test('round-trips a parsed AST byte-identical', () => {
    const src = fs.readFileSync(FIXTURE, 'utf8');
    const ast = parseMarkdown(src);
    expect(serializeAst(ast)).toBe(src);
  });

  test('replaceBlock rewrites a single fenced block without touching prose', () => {
    const src = fs.readFileSync(FIXTURE, 'utf8');
    const ast = parseMarkdown(src);
    const newAst = replaceBlock(ast, 1, 'EPIC-0001: Demo\nDescription: NEW\nStatus: Done');
    const out = serializeAst(newAst);
    expect(out).toContain('Description: NEW');
    expect(out.startsWith('# Release Plan\n\nSome prose before')).toBe(true);
    expect(out.endsWith('Trailing prose.\n')).toBe(true);
  });
});
