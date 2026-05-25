'use strict';

const fs = require('fs');
const os = require('os');
const path = require('path');
const { Repository } = require('../../tools/lib/repository');

function mkRoot() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'us0246-syncgh-'));
  fs.mkdirSync(path.join(root, 'docs'), { recursive: true });
  fs.writeFileSync(path.join(root, 'package.json'), JSON.stringify({ name: 't', version: '1.0.0' }));
  return root;
}

describe('US-0246 / AC-0960: sync-github BUGS.md create path goes through repo', () => {
  let root;
  afterEach(() => {
    if (Repository._reset) Repository._reset();
    if (root) fs.rmSync(root, { recursive: true, force: true });
  });

  it('repo.bugs.create writes a canonical BUG block to BUGS.md (mirrors sync-github BUGS.md path)', async () => {
    root = mkRoot();
    fs.writeFileSync(path.join(root, 'docs', 'BUGS.md'), '# Bugs\n\n');
    if (Repository._reset) Repository._reset();
    const repo = Repository.getInstance({ root });
    await repo.bugs.create({
      id: 'BUG-9000',
      title: 'Pulled from GH',
      severity: 'Low',
      status: 'Open',
      ghIssueNumber: 12345,
    });
    const after = fs.readFileSync(path.join(root, 'docs', 'BUGS.md'), 'utf8');
    expect(after).toContain('BUG-9000: Pulled from GH');
    expect(after).toContain('Status: Open');
    expect(after).toContain('GH Issue: #12345');
    expect(repo.bugs.get('BUG-9000')).toBeTruthy();
  });
});
