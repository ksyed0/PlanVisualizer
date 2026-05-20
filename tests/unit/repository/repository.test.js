'use strict';
const fs = require('fs');
const path = require('path');
const os = require('os');
const { Repository } = require('../../../tools/lib/repository');

describe('Repository.getInstance', () => {
  let root;
  beforeEach(() => {
    root = fs.mkdtempSync(path.join(os.tmpdir(), 'rep-'));
    fs.mkdirSync(path.join(root, 'docs'));
    Repository._reset();
  });
  afterEach(() => {
    Repository._reset();
    fs.rmSync(root, { recursive: true, force: true });
  });

  test('returns the same instance', () => {
    const a = Repository.getInstance({ root });
    const b = Repository.getInstance({ root });
    expect(a).toBe(b);
  });

  test('exposes refresh() and warningsChannel', () => {
    const r = Repository.getInstance({ root });
    expect(typeof r.refresh).toBe('function');
    expect(r.warningsChannel).toBeDefined();
  });

  test('calls refresh() automatically on first getInstance', () => {
    const r = Repository.getInstance({ root });
    expect(r._refreshCount).toBe(1);
  });
});
