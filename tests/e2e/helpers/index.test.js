// tests/e2e/helpers/index.test.js
'use strict';
const fs = require('fs');
const path = require('path');
const os = require('os');
const { createTempProject, runScript, assertHtml, assertSdlcState } = require('./index');

describe('createTempProject', () => {
  it('creates a temp dir with a git repo and cleanup removes it', () => {
    const { dir, cleanup } = createTempProject();
    expect(fs.existsSync(dir)).toBe(true);
    expect(fs.existsSync(path.join(dir, '.git'))).toBe(true);
    cleanup();
    expect(fs.existsSync(dir)).toBe(false);
  });

  it('skipGitInit omits the .git directory', () => {
    const { dir, cleanup } = createTempProject({ skipGitInit: true });
    expect(fs.existsSync(path.join(dir, '.git'))).toBe(false);
    cleanup();
  });
});

describe('runScript', () => {
  it('returns stdout on success', () => {
    const { dir, cleanup } = createTempProject();
    const out = runScript('echo hello', [], dir);
    expect(out.trim()).toBe('hello');
    cleanup();
  });

  it('throws a descriptive error including stdout and stderr on failure', () => {
    const { dir, cleanup } = createTempProject();
    expect(() => runScript('exit 1', [], dir)).toThrow('Exit code');
    cleanup();
  });
});

describe('assertHtml', () => {
  let tmp;
  beforeEach(() => {
    tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'pv-html-'));
  });
  afterEach(() => fs.rmSync(tmp, { recursive: true, force: true }));

  it('passes when contains strings are present', () => {
    const f = path.join(tmp, 'test.html');
    fs.writeFileSync(f, '<html><body>Hello World</body></html>');
    expect(() => assertHtml(f, { contains: ['Hello', 'World'] })).not.toThrow();
  });

  it('throws when a contains string is missing', () => {
    const f = path.join(tmp, 'test.html');
    fs.writeFileSync(f, '<html><body>Hello</body></html>');
    expect(() => assertHtml(f, { contains: ['Missing'] })).toThrow();
  });

  it('throws when an excludes string is present', () => {
    const f = path.join(tmp, 'test.html');
    fs.writeFileSync(f, '<html><body>Error</body></html>');
    expect(() => assertHtml(f, { excludes: ['Error'] })).toThrow();
  });
});

describe('assertSdlcState', () => {
  let tmp;
  beforeEach(() => {
    tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'pv-sdlc-'));
  });
  afterEach(() => fs.rmSync(tmp, { recursive: true, force: true }));

  it('passes when scalar and object shapes match', () => {
    const f = path.join(tmp, 'sdlc-status.json');
    fs.writeFileSync(
      f,
      JSON.stringify({
        tasks: { 'US-T001': { status: 'in_progress' } },
        log: [],
      }),
    );
    expect(() =>
      assertSdlcState(f, {
        tasks: { 'US-T001': { status: 'in_progress' } },
      }),
    ).not.toThrow();
  });

  it('throws when a scalar does not match', () => {
    const f = path.join(tmp, 'sdlc-status.json');
    fs.writeFileSync(f, JSON.stringify({ tasks: {}, log: [] }));
    expect(() => assertSdlcState(f, { tasks: { 'US-T001': { status: 'in_progress' } } })).toThrow();
  });
});
