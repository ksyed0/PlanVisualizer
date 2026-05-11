'use strict';
const fs = require('fs');
const path = require('path');
const os = require('os');
const { parseFlagFilename, readFlag, scanPendingDir } = require('../../tools/lib/agent-spec-plan-flags');

describe('parseFlagFilename', () => {
  test('parses approve filename', () => {
    expect(parseFlagFilename('approve-US-0181-spec.flag')).toEqual({
      action: 'approve',
      story: 'US-0181',
      gate: 'spec',
    });
  });

  test('parses reject filename', () => {
    expect(parseFlagFilename('reject-US-0181-plan.flag')).toEqual({
      action: 'reject',
      story: 'US-0181',
      gate: 'plan',
    });
  });

  test('parses ac gate', () => {
    expect(parseFlagFilename('approve-US-0181-ac.flag')).toEqual({
      action: 'approve',
      story: 'US-0181',
      gate: 'ac',
    });
  });

  test('returns null for invalid filename', () => {
    expect(parseFlagFilename('whatever.txt')).toBeNull();
    expect(parseFlagFilename('approve-bad.flag')).toBeNull();
    expect(parseFlagFilename('approve-US-0181.flag')).toBeNull();
  });
});

describe('readFlag', () => {
  let tmpdir;
  beforeEach(() => {
    tmpdir = fs.mkdtempSync(path.join(os.tmpdir(), 'agt-flags-'));
  });
  afterEach(() => fs.rmSync(tmpdir, { recursive: true, force: true }));

  test('reads valid JSON flag', () => {
    const fp = path.join(tmpdir, 'approve-US-0181-spec.flag');
    fs.writeFileSync(
      fp,
      JSON.stringify({
        story: 'US-0181',
        gate: 'spec',
        action: 'approve',
        timestamp: '2026-05-11T12:00:00Z',
      }),
    );
    const r = readFlag(fp);
    expect(r.ok).toBe(true);
    expect(r.payload.story).toBe('US-0181');
  });

  test('rejects malformed JSON with logged reason', () => {
    const fp = path.join(tmpdir, 'approve-US-0181-spec.flag');
    fs.writeFileSync(fp, 'not json');
    const r = readFlag(fp);
    expect(r.ok).toBe(false);
    expect(r.reason).toMatch(/parse/i);
  });

  test('rejects flag with missing required fields', () => {
    const fp = path.join(tmpdir, 'approve-US-0181-spec.flag');
    fs.writeFileSync(fp, JSON.stringify({ story: 'US-0181' }));
    const r = readFlag(fp);
    expect(r.ok).toBe(false);
    expect(r.reason).toMatch(/missing field/i);
  });

  test('reads reject flag with reason', () => {
    const fp = path.join(tmpdir, 'reject-US-0181-spec.flag');
    fs.writeFileSync(
      fp,
      JSON.stringify({
        story: 'US-0181',
        gate: 'spec',
        action: 'reject',
        reason: 'scope creep',
        timestamp: '2026-05-11T12:00:00Z',
      }),
    );
    const r = readFlag(fp);
    expect(r.ok).toBe(true);
    expect(r.payload.reason).toBe('scope creep');
  });

  test('handles CRLF line endings in JSON', () => {
    const fp = path.join(tmpdir, 'approve-US-0181-spec.flag');
    fs.writeFileSync(
      fp,
      '{\r\n"story":"US-0181","gate":"spec","action":"approve","timestamp":"2026-05-11T12:00:00Z"\r\n}',
    );
    const r = readFlag(fp);
    expect(r.ok).toBe(true);
  });
});

describe('scanPendingDir', () => {
  let tmpdir;
  beforeEach(() => {
    tmpdir = fs.mkdtempSync(path.join(os.tmpdir(), 'agt-flags-'));
  });
  afterEach(() => fs.rmSync(tmpdir, { recursive: true, force: true }));

  function writeFlag(name, payload) {
    fs.writeFileSync(path.join(tmpdir, name), JSON.stringify(payload));
  }

  test('returns flags sorted by timestamp ascending', () => {
    writeFlag('approve-US-A-spec.flag', {
      story: 'US-A',
      gate: 'spec',
      action: 'approve',
      timestamp: '2026-05-11T12:00:00Z',
    });
    writeFlag('approve-US-B-spec.flag', {
      story: 'US-B',
      gate: 'spec',
      action: 'approve',
      timestamp: '2026-05-11T10:00:00Z',
    });
    const flags = scanPendingDir(tmpdir);
    expect(flags[0].payload.story).toBe('US-B');
    expect(flags[1].payload.story).toBe('US-A');
  });

  test('returns empty array when dir empty', () => {
    expect(scanPendingDir(tmpdir)).toEqual([]);
  });

  test('returns empty array when dir does not exist', () => {
    expect(scanPendingDir(path.join(tmpdir, 'nonexistent'))).toEqual([]);
  });

  test('ignores non-.flag files', () => {
    writeFlag('approve-US-0181-spec.flag', {
      story: 'US-0181',
      gate: 'spec',
      action: 'approve',
      timestamp: '2026-05-11T12:00:00Z',
    });
    fs.writeFileSync(path.join(tmpdir, '.gitkeep'), '');
    fs.writeFileSync(path.join(tmpdir, 'readme.md'), '');
    const flags = scanPendingDir(tmpdir);
    expect(flags).toHaveLength(1);
  });

  test('attaches malformed flags with ok:false and reason', () => {
    fs.writeFileSync(path.join(tmpdir, 'approve-US-0181-spec.flag'), 'not json');
    const flags = scanPendingDir(tmpdir);
    expect(flags[0].ok).toBe(false);
    expect(flags[0].reason).toBeTruthy();
  });
});
