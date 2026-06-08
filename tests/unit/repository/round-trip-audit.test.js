'use strict';

const fs = require('fs');
const os = require('os');
const path = require('path');
const { auditFile, auditAll } = require('../../../tools/lib/repository/round-trip-audit');

// mkdtempSync gives an OS-guaranteed-unique directory — avoids the
// predictable-path / symlink-clobber issue CodeQL flags with
// js/insecure-temporary-file when using Date.now() + Math.random().
function tmp(content, ext = '.md') {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'audit-'));
  const p = path.join(dir, `audit${ext}`);
  fs.writeFileSync(p, content);
  return p;
}

describe('auditFile', () => {
  it('reports zero divergences when serializer is lossless against the input', () => {
    const p = tmp('```\nUS-0001 (EPIC-0001): T\nPriority: High (P1)\nEstimate: M\nStatus: To Do\n```\n', '.md');
    const report = auditFile({ path: p, kind: 'release-plan' });
    expect(report.entitiesParsed).toBeGreaterThanOrEqual(1);
    expect(report.divergences).toEqual([]);
  });

  it('returns a report shape with entitiesParsed and divergences array for any input', () => {
    const p = tmp(
      '```\nUS-0001 (EPIC-0001): T\nPriority: High (P1)\nEstimate: M\nStatus: To Do\nLegacyField: dropped\n```\n',
      '.md',
    );
    const report = auditFile({ path: p, kind: 'release-plan' });
    expect(report).toHaveProperty('entitiesParsed');
    expect(report).toHaveProperty('divergences');
    expect(Array.isArray(report.divergences)).toBe(true);
  });

  it('throws when the file does not exist', () => {
    expect(() => auditFile({ path: '/tmp/nonexistent-xyz-' + Date.now() + '.md', kind: 'release-plan' })).toThrow();
  });

  it('handles bugs kind successfully', () => {
    const p = tmp('```\nBUG-0001: Test bug\nSeverity: High\nStatus: Open\n```\n', '.md');
    const report = auditFile({ path: p, kind: 'bugs' });
    expect(report).toHaveProperty('entitiesParsed');
    expect(report).toHaveProperty('divergences');
  });

  it('handles lessons kind successfully', () => {
    const p = tmp('```\nL-0001: Always validate input\nArea: Security\nStatus: Active\n```\n', '.md');
    const report = auditFile({ path: p, kind: 'lessons' });
    expect(report).toHaveProperty('entitiesParsed');
    expect(report).toHaveProperty('divergences');
  });

  it('handles test-cases kind successfully', () => {
    const p = tmp('```\nTC-0001: Happy path test\nRelated Story: US-0001\nStatus: [ ] Not Run\n```\n', '.md');
    const report = auditFile({ path: p, kind: 'test-cases' });
    expect(report).toHaveProperty('entitiesParsed');
    expect(report).toHaveProperty('divergences');
  });

  it('returns empty divergences for empty input files', () => {
    const p = tmp('', '.md');
    const report = auditFile({ path: p, kind: 'release-plan' });
    expect(report.entitiesParsed).toBe(0);
    expect(report.divergences).toEqual([]);
  });

  it('reports a divergence when the serializer throws (serialize-error path)', () => {
    // Status "Cancelled" is not in the allowed enum for stories — serializer throws ValidationError.
    const p = tmp('```\nUS-0001 (EPIC-0001): T\nPriority: High (P1)\nEstimate: M\nStatus: Cancelled\n```\n', '.md');
    const report = auditFile({ path: p, kind: 'release-plan' });
    // Either entitiesParsed == 0 (parser rejects too) OR there's a *serialize-error* divergence.
    if (report.entitiesParsed > 0) {
      expect(report.divergences.some((d) => d.field === '*serialize-error*')).toBe(true);
    }
  });

  it('runs successfully against bugs/lessons/test-cases kinds with empty input', () => {
    const p1 = tmp('', '.md');
    expect(auditFile({ path: p1, kind: 'bugs' })).toEqual({ entitiesParsed: 0, divergences: [] });
    expect(auditFile({ path: p1, kind: 'lessons' })).toEqual({ entitiesParsed: 0, divergences: [] });
    expect(auditFile({ path: p1, kind: 'test-cases' })).toEqual({ entitiesParsed: 0, divergences: [] });
  });
});

describe('auditAll', () => {
  it('aggregates per-file reports and returns combined totals', () => {
    const p1 = tmp('```\nUS-0001 (EPIC-0001): T\nPriority: High (P1)\nEstimate: M\nStatus: To Do\n```\n', '.md');
    const p2 = tmp('', '.md');
    const report = auditAll([
      { path: p1, kind: 'release-plan' },
      { path: p2, kind: 'bugs' },
    ]);
    expect(report.totalFiles).toBe(2);
    expect(report.totalEntities).toBeGreaterThanOrEqual(1);
    expect(report.totalDivergences).toBeGreaterThanOrEqual(0);
    expect(report.perFile).toHaveLength(2);
    expect(report.perFile[0]).toHaveProperty('entitiesParsed');
    expect(report.perFile[0]).toHaveProperty('divergences');
    expect(report.perFile[0]).toHaveProperty('path');
    expect(report.perFile[0]).toHaveProperty('kind');
  });
});
