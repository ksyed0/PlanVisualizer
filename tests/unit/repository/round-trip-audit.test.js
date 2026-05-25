'use strict';

const fs = require('fs');
const os = require('os');
const path = require('path');
const { auditFile } = require('../../../tools/lib/repository/round-trip-audit');

function tmp(content, ext = '.md') {
  const p = path.join(os.tmpdir(), `audit-${Date.now()}-${Math.random()}${ext}`);
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
});
