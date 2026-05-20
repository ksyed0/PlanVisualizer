// tests/unit/repository/refresh.test.js
const fs = require('fs');
const path = require('path');
const os = require('os');
const { openIndexDatastore } = require('../../../tools/lib/repository/index-datastore');
const { applySchemaMigrations } = require('../../../tools/lib/repository/schema');
const { MarkdownDatastore } = require('../../../tools/lib/repository/markdown-datastore');
const { refresh } = require('../../../tools/lib/repository/refresh');

let index, root;

afterEach(() => {
  if (index) {
    try {
      index.close();
    } catch {
      /* ignore */
    }
    index = undefined;
  }
  if (root) {
    fs.rmSync(root, { recursive: true, force: true });
    root = undefined;
  }
});

test('refresh detects changed files', () => {
  root = fs.mkdtempSync(path.join(os.tmpdir(), 'rf-'));
  fs.mkdirSync(path.join(root, 'docs'));
  fs.writeFileSync(path.join(root, 'docs', 'a.md'), 'x');
  index = openIndexDatastore({ path: path.join(root, '.cache', 'pv.db') });
  applySchemaMigrations(index);
  const markdown = new MarkdownDatastore({ root });
  let r = refresh({ datastores: { index, markdown }, sources: ['docs/a.md'] });
  expect(r.sources).toEqual(['docs/a.md']);
  index
    .prepare('INSERT INTO meta_sources(path,mtime,size,hash,last_indexed) VALUES(?,?,?,?,?)')
    .run('docs/a.md', ...Object.values(markdown.sourceMeta('docs/a.md')), Date.now());
  r = refresh({ datastores: { index, markdown }, sources: ['docs/a.md'] });
  expect(r.sources).toEqual([]);
  fs.writeFileSync(path.join(root, 'docs', 'a.md'), 'changed');
  fs.utimesSync(path.join(root, 'docs', 'a.md'), Date.now() / 1000 + 5, Date.now() / 1000 + 5);
  r = refresh({ datastores: { index, markdown }, sources: ['docs/a.md'] });
  expect(r.sources).toEqual(['docs/a.md']);
});
