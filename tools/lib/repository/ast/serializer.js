'use strict';

function serializeAst(ast) {
  return ast.map((n) => (n.kind === 'fenced' ? n.raw : n.text)).join('');
}

function replaceBlock(ast, index, newBody, opts = {}) {
  const node = ast[index];
  if (!node || node.kind !== 'fenced') throw new Error(`AST node at ${index} is not fenced`);
  const fence = opts.fence || node.fence;
  const info = opts.info !== undefined && opts.info !== null ? opts.info : node.info;
  const trailingNewline = node.raw.endsWith('\n') ? '\n' : '';
  const raw = `${fence}${info}\n${newBody}\n${fence}${trailingNewline}`;
  const next = ast.slice();
  next[index] = { kind: 'fenced', fence, info, body: newBody, raw };
  return next;
}

function insertBlock(ast, beforeIndex, body, opts = {}) {
  const fence = opts.fence || '```';
  const info = opts.info || '';
  const raw = `${fence}${info}\n${body}\n${fence}\n`;
  const block = { kind: 'fenced', fence, info, body, raw };
  const next = ast.slice();
  next.splice(beforeIndex, 0, block);
  return next;
}

module.exports = { serializeAst, replaceBlock, insertBlock };
