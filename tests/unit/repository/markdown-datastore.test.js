'use strict';
const fs = require('fs');
const path = require('path');
const os = require('os');
const { MarkdownDatastore } = require('../../../tools/lib/repository/markdown-datastore');

describe('MarkdownDatastore (read)', () => {
  let root;
  beforeEach(() => {
    root = fs.mkdtempSync(path.join(os.tmpdir(), 'mdds-'));
    fs.mkdirSync(path.join(root, 'docs'));
    fs.writeFileSync(path.join(root, 'docs', 'RELEASE_PLAN.md'), '# X\n\n```\nEPIC-0001: One\nStatus: Done\n```\n');
  });
  afterEach(() => fs.rmSync(root, { recursive: true, force: true }));

  test('readAst parses a managed file', () => {
    const ds = new MarkdownDatastore({ root });
    const ast = ds.readAst('docs/RELEASE_PLAN.md');
    expect(ast.find((n) => n.kind === 'fenced')).toBeDefined();
  });

  test('sourceMeta returns mtime/size/hash', () => {
    const ds = new MarkdownDatastore({ root });
    const meta = ds.sourceMeta('docs/RELEASE_PLAN.md');
    expect(meta.size).toBeGreaterThan(0);
    expect(meta.mtime).toBeGreaterThan(0);
    expect(meta.hash).toMatch(/^[a-f0-9]{64}$/);
  });

  test('writeAst round-trips through readAst', async () => {
    const ds = new MarkdownDatastore({ root });
    const tmpFile = 'docs/ROUND_TRIP.md';
    fs.writeFileSync(path.join(root, tmpFile), '# Round Trip\n\n```json\n{"key":"value"}\n```\n');
    const original = ds.readAst(tmpFile);
    await ds.writeAst(tmpFile, original);
    const reloaded = ds.readAst(tmpFile);
    expect(reloaded.find((n) => n.kind === 'fenced')).toBeDefined();
    expect(reloaded.find((n) => n.kind === 'fenced').body).toBe(original.find((n) => n.kind === 'fenced').body);
  });
});
