'use strict';

const fs = require('fs');
const path = require('path');

const FILE = path.join(__dirname, '..', '..', 'tools', 'sync-github.js');

const MANAGED_FILENAMES = new Set([
  'RELEASE_PLAN.md',
  'BUGS.md',
  'LESSONS.md',
  'TEST_CASES.md',
  'ID_REGISTRY.md',
  'sdlc-status.json',
]);

describe('US-0246 / AC-0961: sync-github.js managed-path write gate', () => {
  const source = fs.readFileSync(FILE, 'utf8');

  it('no fs.write/append call has a managed filename in its 200-char window', () => {
    const re = /fs\.(writeFileSync|appendFileSync)\s*\(/g;
    const hits = [];
    let m;
    while ((m = re.exec(source)) !== null) {
      const lineNum = source.slice(0, m.index).split('\n').length;
      const ctx = source.slice(Math.max(0, m.index - 200), Math.min(source.length, m.index + 200));
      for (const fname of MANAGED_FILENAMES) {
        if (ctx.includes(fname)) hits.push({ line: lineNum, filename: fname });
      }
    }
    if (hits.length > 0) {
      throw new Error(
        `sync-github.js managed-path writes:\n` + hits.map((h) => `  L${h.line} → ${h.filename}`).join('\n'),
      );
    }
  });

  it('does not import parse-bugs / parse-release-plan for write purposes', () => {
    expect(source).not.toMatch(/require\(['"][^'"]*parse-bugs['"]\)/);
    expect(source).not.toMatch(/require\(['"][^'"]*parse-release-plan['"]\)/);
  });
});
