const fs = require('fs');
const path = require('path');
const { parseMarkdown } = require('../../../tools/lib/repository/ast/parser');

const FIXTURE = path.join(__dirname, '../../fixtures/repository/sample-release-plan.md');

describe('parseMarkdown', () => {
  test('returns ordered AST of prose and fenced blocks', () => {
    const src = fs.readFileSync(FIXTURE, 'utf8');
    const ast = parseMarkdown(src);
    const kinds = ast.map((n) => n.kind);
    expect(kinds).toEqual(['prose', 'fenced', 'prose', 'fenced', 'prose']);
    expect(ast[1].body).toContain('EPIC-0001: Demo');
    expect(ast[3].body).toContain('US-0001 (EPIC-0001)');
  });

  test('preserves trailing newline and exact prose whitespace', () => {
    const src = '# X\n\nprose\n\n```\nblock\n```\n\nafter\n';
    const ast = parseMarkdown(src);
    expect(ast[0].text).toBe('# X\n\nprose\n\n');
    expect(ast[2].text).toBe('\n\nafter\n');
  });

  test('handles file with no fenced blocks', () => {
    const ast = parseMarkdown('just prose\nno blocks\n');
    expect(ast).toEqual([{ kind: 'prose', text: 'just prose\nno blocks\n' }]);
  });

  test('handles file starting with a fenced block', () => {
    const ast = parseMarkdown('```\nx\n```\nafter\n');
    expect(ast[0].kind).toBe('fenced');
    expect(ast[1].kind).toBe('prose');
  });
});
