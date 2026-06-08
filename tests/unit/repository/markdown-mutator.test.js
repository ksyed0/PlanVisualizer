'use strict';

const fs = require('fs');
const os = require('os');
const path = require('path');
const { replaceBlockInText, replaceBlock } = require('../../../tools/lib/repository/markdown-mutator');

const DOC = [
  '# Header',
  '',
  'intro prose',
  '',
  '```',
  'US-0001 (EPIC-0010): Title A',
  'Status: To Do',
  '```',
  '',
  'middle prose with **markdown**',
  '',
  '```',
  'US-0002 (EPIC-0010): Title B',
  'Status: Done',
  '```',
  '',
  'trailing prose',
  '',
].join('\n');

describe('replaceBlockInText', () => {
  it('replaces the US-0001 block body with a new body, leaves the rest byte-identical', () => {
    const out = replaceBlockInText(DOC, /^US-0001\b/, () => 'US-0001 (EPIC-0010): Title A\nStatus: Done\n');
    expect(out).toContain('```\nUS-0001 (EPIC-0010): Title A\nStatus: Done\n```');
    expect(out).toContain('intro prose');
    expect(out).toContain('middle prose with **markdown**');
    expect(out).toContain('trailing prose');
    expect(out).toContain('US-0002 (EPIC-0010): Title B\nStatus: Done');
  });

  it('throws when the id-regex does not match any block', () => {
    expect(() => replaceBlockInText(DOC, /^US-9999\b/, () => 'irrelevant')).toThrow(/not found/i);
  });

  it('passes the original block body to the mutator (for inspection / partial mutation)', () => {
    let captured = null;
    replaceBlockInText(DOC, /^US-0001\b/, (body) => {
      captured = body;
      return body;
    });
    expect(captured).toContain('US-0001 (EPIC-0010): Title A');
    expect(captured).toContain('Status: To Do');
    expect(captured).not.toContain('```');
  });

  it('preserves the trailing newline at end-of-file when replacing the LAST block', () => {
    const lastBlockDoc = '```\nUS-0001: only\nStatus: Done\n```\n';
    const out = replaceBlockInText(lastBlockDoc, /^US-0001\b/, () => 'US-0001: only\nStatus: To Do\n');
    expect(out).toBe('```\nUS-0001: only\nStatus: To Do\n```\n');
  });
});

describe('replaceBlock (filesystem)', () => {
  let tmpDir;
  let filePath;
  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'mutator-'));
    filePath = path.join(tmpDir, 'doc.md');
  });
  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it('writes the mutated block to disk and reports changed=true', async () => {
    fs.writeFileSync(filePath, '# H\n\n```\nUS-0001: t\nStatus: To Do\n```\n');
    const result = await replaceBlock({
      path: filePath,
      idRegex: /^US-0001\b/,
      mutator: () => 'US-0001: t\nStatus: Done\n',
    });
    expect(result).toEqual({ changed: true });
    const after = fs.readFileSync(filePath, 'utf8');
    expect(after).toContain('Status: Done');
    expect(after).toContain('# H');
  });

  it('reports changed=false and leaves the file untouched when mutator returns the same body', async () => {
    const original = '# H\n\n```\nUS-0001: t\nStatus: To Do\n```\n';
    fs.writeFileSync(filePath, original);
    const result = await replaceBlock({
      path: filePath,
      idRegex: /^US-0001\b/,
      mutator: (body) => body,
    });
    expect(result).toEqual({ changed: false });
    expect(fs.readFileSync(filePath, 'utf8')).toBe(original);
  });
});
