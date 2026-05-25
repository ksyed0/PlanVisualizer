'use strict';

const { _parseRow, _bumpRow, _rewriteRow } = require('../../../tools/lib/repository/id-allocator');

const SAMPLE_REGISTRY = [
  '# ID Registry',
  '',
  'Single source of truth for the next available ID in every artefact sequence.',
  '**Update this file immediately whenever a new artefact is created.**',
  '',
  '| **Sequence** | **Next Available ID** | **Last Assigned** |',
  '| ------------ | --------------------- | ----------------- |',
  '| EPIC         | EPIC-0046             | EPIC-0045         |',
  '| US           | US-0264               | US-0263           |',
  '| TASK         | TASK-0071             | TASK-0070         |',
  '| AC           | AC-1023               | AC-1022           |',
  '| TC           | TC-0553               | TC-0552           |',
  '| BUG          | BUG-0264              | BUG-0263          |',
  '| Lesson       | L-0086                | L-0085            |',
  '| ENH          | ENH-0005              | ENH-0004          |',
  '',
  '**Rules:**',
  '',
].join('\n');

describe('_parseRow', () => {
  it('extracts the US row sequence/next/last', () => {
    const row = _parseRow(SAMPLE_REGISTRY, 'US');
    expect(row).toEqual({
      sequence: 'US',
      prefix: 'US',
      nextId: 'US-0264',
      nextNum: 264,
      lastAssigned: 'US-0263',
      lastNum: 263,
      lineText: '| US           | US-0264               | US-0263           |',
    });
  });

  it('extracts the Lesson row whose prefix is "L" not "Lesson"', () => {
    const row = _parseRow(SAMPLE_REGISTRY, 'Lesson');
    expect(row.prefix).toBe('L');
    expect(row.nextId).toBe('L-0086');
  });

  it('returns null when the sequence is not in the table', () => {
    expect(_parseRow(SAMPLE_REGISTRY, 'NOPE')).toBeNull();
  });
});

describe('_bumpRow', () => {
  it('count=1: allocates [US-0264], next becomes US-0265, last becomes US-0264', () => {
    const row = _parseRow(SAMPLE_REGISTRY, 'US');
    const { ids, newRow } = _bumpRow(row, 1);
    expect(ids).toEqual(['US-0264']);
    expect(newRow.nextId).toBe('US-0265');
    expect(newRow.lastAssigned).toBe('US-0264');
  });

  it('count=3: allocates 3 contiguous, next bumped by 3, last is the highest', () => {
    const row = _parseRow(SAMPLE_REGISTRY, 'US');
    const { ids, newRow } = _bumpRow(row, 3);
    expect(ids).toEqual(['US-0264', 'US-0265', 'US-0266']);
    expect(newRow.nextId).toBe('US-0267');
    expect(newRow.lastAssigned).toBe('US-0266');
  });

  it('preserves zero-padding width of the source row', () => {
    const row = _parseRow(SAMPLE_REGISTRY, 'AC');
    const { ids } = _bumpRow(row, 1);
    expect(ids).toEqual(['AC-1023']);
  });

  it('grows past zero-pad boundary naturally (5 digits past 9999)', () => {
    const row = {
      sequence: 'US',
      prefix: 'US',
      nextId: 'US-9998',
      nextNum: 9998,
      lastAssigned: 'US-9997',
      lastNum: 9997,
      lineText: '...',
    };
    const { ids, newRow } = _bumpRow(row, 3);
    expect(ids).toEqual(['US-9998', 'US-9999', 'US-10000']);
    expect(newRow.nextId).toBe('US-10001');
  });

  it('throws on count <= 0', () => {
    const row = _parseRow(SAMPLE_REGISTRY, 'US');
    expect(() => _bumpRow(row, 0)).toThrow(/count/);
    expect(() => _bumpRow(row, -1)).toThrow(/count/);
  });
});

describe('_rewriteRow', () => {
  it('replaces only the targeted row line, preserves column alignment', () => {
    const row = _parseRow(SAMPLE_REGISTRY, 'US');
    const { newRow } = _bumpRow(row, 1);
    const out = _rewriteRow(SAMPLE_REGISTRY, row, newRow);
    expect(out).toContain('| US           | US-0265               | US-0264           |');
    expect(out).toContain('| EPIC         | EPIC-0046             | EPIC-0045         |');
    expect(out).toContain('| Lesson       | L-0086                | L-0085            |');
    const newLine = out.split('\n').find((l) => l.match(/^\| US\s/));
    const oldLine = row.lineText;
    expect(newLine.length).toBe(oldLine.length);
  });
});
