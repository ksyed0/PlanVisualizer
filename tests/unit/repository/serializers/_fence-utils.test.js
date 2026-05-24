'use strict';

const { findBlockRange, joinLines } = require('../../../../tools/lib/repository/serializers/_fence-utils');

describe('findBlockRange', () => {
  const SAMPLE = [
    '# Header',
    '',
    '```',
    'US-0001 (EPIC-0010): Title A',
    'Status: Done',
    '```',
    '',
    'prose between blocks',
    '',
    '```',
    'US-0002 (EPIC-0010): Title B',
    'Status: To Do',
    '```',
    '',
  ].join('\n');

  it('locates the first block whose body starts with US-0001', () => {
    const r = findBlockRange(SAMPLE, /^US-0001\b/);
    expect(r).not.toBeNull();
    expect(SAMPLE.slice(r.start, r.end)).toContain('US-0001 (EPIC-0010): Title A');
    expect(SAMPLE.slice(r.start, r.end)).toContain('Status: Done');
    expect(SAMPLE.slice(r.start, r.end)).not.toContain('US-0002');
    expect(SAMPLE.slice(r.start, r.start + 3)).toBe('```');
  });

  it('locates the second block (US-0002) — anchor regex picks correct block', () => {
    const r = findBlockRange(SAMPLE, /^US-0002\b/);
    expect(SAMPLE.slice(r.start, r.end)).toContain('US-0002 (EPIC-0010): Title B');
    expect(SAMPLE.slice(r.start, r.end)).not.toContain('US-0001');
  });

  it('returns null when no matching block is found', () => {
    expect(findBlockRange(SAMPLE, /^US-9999\b/)).toBeNull();
  });

  it('ignores fenced blocks whose body does not match (different ID-line, different prefix)', () => {
    const doc = '```\nrandom text\n```\n```\nUS-0001: real\n```\n';
    const r = findBlockRange(doc, /^US-0001\b/);
    expect(doc.slice(r.start, r.end)).toContain('US-0001: real');
  });
});

describe('joinLines', () => {
  it('joins with \\n + trailing newline (matches existing file convention)', () => {
    expect(joinLines(['a', 'b', 'c'])).toBe('a\nb\nc\n');
  });
  it('handles empty array → empty string', () => {
    expect(joinLines([])).toBe('');
  });
});
