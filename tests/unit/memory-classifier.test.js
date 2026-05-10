'use strict';
const { classifySection, slugify, extractDate } = require('../../tools/lib/memory-classifier');

describe('extractDate', () => {
  test('extracts YYYY-MM-DD from parens', () => {
    expect(extractDate('Foo (Session 42, 2026-05-09/10)')).toBe('2026-05-10');
    expect(extractDate('Bar (as of 2026-05-05 Session 40)')).toBe('2026-05-05');
    expect(extractDate('Baz (2026-04-15/16)')).toBe('2026-04-16');
  });

  test('returns null when no date present', () => {
    expect(extractDate('Project Identity')).toBeNull();
    expect(extractDate('Technology')).toBeNull();
  });

  test('picks the latest date when range present', () => {
    expect(extractDate('Foo (2026-05-09/10)')).toBe('2026-05-10');
  });
});

describe('slugify', () => {
  test('basic slug', () => {
    expect(slugify('Project Identity')).toBe('project-identity');
    expect(slugify('Technology')).toBe('technology');
  });

  test('strips parentheses content', () => {
    expect(slugify('Foo (Session 42, 2026-05-09/10)')).toBe('foo');
  });

  test('strips em/en dashes', () => {
    expect(slugify('Foo — Bar – Baz')).toBe('foo-bar-baz');
  });

  test('handles AGENTS.md special chars', () => {
    expect(slugify('AGENTS.md')).toBe('agents-md');
  });

  test('truncates to 60 chars at word boundary', () => {
    const long = 'a'.repeat(70);
    expect(slugify(long).length).toBeLessThanOrEqual(60);
    expect(
      slugify('one two three four five six seven eight nine ten eleven twelve thirteen').length,
    ).toBeLessThanOrEqual(60);
  });

  test('collapses repeated dashes and trims', () => {
    expect(slugify('--foo---bar--')).toBe('foo-bar');
  });
});

describe('classifySection', () => {
  test('snapshot detection (as of)', () => {
    const r = classifySection('Project Completion Status (as of 2026-05-05 Session 40)');
    expect(r.category).toBe('snapshots');
    expect(r.slug).toBe('project-completion-status');
    expect(r.date).toBe('2026-05-05');
  });

  test('session detection (Session N)', () => {
    const r = classifySection('GitHub Status Monitoring (Session 41, 2026-05-08)');
    expect(r.category).toBe('sessions');
    expect(r.slug).toBe('github-status-monitoring');
    expect(r.date).toBe('2026-05-08');
  });

  test('session detection — title starts with Session N', () => {
    const r = classifySection('Session 18 learnings (2026-04-15/16) — EPIC-0016 Agentic Dashboard Mission Control');
    expect(r.category).toBe('sessions');
    expect(r.date).toBe('2026-04-16');
    expect(r.slug.length).toBeLessThanOrEqual(60);
  });

  test('lessons detection — special-cased', () => {
    const r = classifySection('Lessons Learned');
    expect(r.category).toBe('lessons');
  });

  test('topic detection — default', () => {
    const r = classifySection('Project Identity');
    expect(r.category).toBe('topics');
    expect(r.slug).toBe('project-identity');
    expect(r.date).toBeNull();
  });

  test('all 6 spec example titles produce expected filenames', () => {
    const cases = [
      { title: 'Project Identity', expected: 'project-identity.md' },
      { title: 'Technology', expected: 'technology.md' },
      {
        title: 'Plugin Install Integration + Dashboard Fixes (Session 42, 2026-05-09/10)',
        expected: '2026-05-10-plugin-install-integration-dashboard-fixes.md',
      },
      {
        title: 'GitHub Status Monitoring (Session 41, 2026-05-08)',
        expected: '2026-05-08-github-status-monitoring.md',
      },
      {
        title: 'Project Completion Status (as of 2026-05-05 Session 40)',
        expected: '2026-05-05-project-completion-status.md',
      },
      {
        title: 'Session 18 learnings (2026-04-15/16) — EPIC-0016 Agentic Dashboard Mission Control',
        expected: '2026-04-16-session-18-learnings-epic-0016-agentic-dashboard.md',
      },
    ];
    for (const c of cases) {
      const r = classifySection(c.title);
      const filename = r.date ? `${r.date}-${r.slug}.md` : `${r.slug}.md`;
      expect(filename).toBe(c.expected);
    }
  });
});
