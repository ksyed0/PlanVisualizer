'use strict';
const { selectForArchive, scopeFromTitle } = require('../../tools/lib/memory-archiver');

describe('scopeFromTitle', () => {
  test('extracts scope before first paren', () => {
    expect(scopeFromTitle('Project Completion Status (as of 2026-05-05)')).toBe('project completion status');
    expect(scopeFromTitle('Coverage Status (as of 2026-04-15)')).toBe('coverage status');
  });
  test('returns full title lowercased when no paren', () => {
    expect(scopeFromTitle('Some Snapshot')).toBe('some snapshot');
  });
});

describe('selectForArchive', () => {
  const NOW = new Date('2026-05-10T00:00:00Z').getTime();
  const days = (n) => NOW - n * 86400 * 1000;

  test('topic older than staleDays is archived', () => {
    const files = [
      { path: 'docs/memory/topics/old.md', mtime: days(100), category: 'topics' },
      { path: 'docs/memory/topics/new.md', mtime: days(30), category: 'topics' },
    ];
    const result = selectForArchive(files, { now: NOW, staleDays: 90 });
    expect(result.map((f) => f.path)).toEqual(['docs/memory/topics/old.md']);
  });

  test('session older than staleDays is archived', () => {
    const files = [{ path: 'docs/memory/sessions/old.md', mtime: days(100), category: 'sessions' }];
    expect(selectForArchive(files, { now: NOW, staleDays: 90 })).toHaveLength(1);
  });

  test('snapshot supersession — keep newest in scope, archive rest regardless of age', () => {
    const files = [
      {
        path: 'docs/memory/snapshots/2026-05-05.md',
        mtime: days(5),
        category: 'snapshots',
        scope: 'project completion status',
        date: '2026-05-05',
      },
      {
        path: 'docs/memory/snapshots/2026-05-04.md',
        mtime: days(6),
        category: 'snapshots',
        scope: 'project completion status',
        date: '2026-05-04',
      },
      {
        path: 'docs/memory/snapshots/2026-05-03.md',
        mtime: days(7),
        category: 'snapshots',
        scope: 'project completion status',
        date: '2026-05-03',
      },
    ];
    const result = selectForArchive(files, { now: NOW, staleDays: 90 });
    expect(result.map((f) => f.path).sort()).toEqual([
      'docs/memory/snapshots/2026-05-03.md',
      'docs/memory/snapshots/2026-05-04.md',
    ]);
  });

  test('snapshots in different scopes are independent', () => {
    const files = [
      { path: 'a.md', mtime: days(5), category: 'snapshots', scope: 'project completion status', date: '2026-05-05' },
      { path: 'b.md', mtime: days(5), category: 'snapshots', scope: 'coverage status', date: '2026-05-05' },
    ];
    expect(selectForArchive(files, { now: NOW, staleDays: 90 })).toEqual([]);
  });

  test('snapshot age does NOT trigger archive when only one in scope', () => {
    const files = [
      {
        path: 'old.md',
        mtime: days(200),
        category: 'snapshots',
        scope: 'project completion status',
        date: '2026-04-01',
      },
    ];
    expect(selectForArchive(files, { now: NOW, staleDays: 90 })).toEqual([]);
  });

  test('topic at exactly staleDays boundary is NOT archived', () => {
    const files = [{ path: 'edge.md', mtime: days(90), category: 'topics' }];
    expect(selectForArchive(files, { now: NOW, staleDays: 90 })).toEqual([]);
  });
});
