'use strict';
const path = require('path');
const fs = require('fs');
const {
  getSnapshotFilename,
  saveSnapshot,
  loadSnapshots,
  extractTrends,
  SNAPSHOT_REGEX,
} = require('../../tools/lib/snapshot');

describe('getSnapshotFilename', () => {
  it('generates valid filename matching regex', () => {
    const fn = getSnapshotFilename();
    expect(SNAPSHOT_REGEX.test(fn)).toBe(true);
  });

  it('filename ends with .json', () => {
    const fn = getSnapshotFilename();
    expect(fn.endsWith('.json')).toBe(true);
  });
});

describe('saveSnapshot', () => {
  const testDir = path.join(__dirname, '../fixtures/.test-history');

  beforeAll(() => {
    if (fs.existsSync(testDir)) {
      fs.rmSync(testDir, { recursive: true });
    }
  });

  afterAll(() => {
    if (fs.existsSync(testDir)) {
      fs.rmSync(testDir, { recursive: true });
    }
  });

  it('creates history directory if absent', () => {
    expect(fs.existsSync(testDir)).toBe(false);
    saveSnapshot({ stories: [] }, { historyDir: testDir });
    expect(fs.existsSync(testDir)).toBe(true);
  });

  it('saves a valid JSON file', () => {
    const data = { stories: [{ id: 'US-0001', status: 'Done' }] };
    const result = saveSnapshot(data, { historyDir: testDir, commit: 'abc123' });
    expect(result.filename).toMatch(SNAPSHOT_REGEX);
    expect(fs.existsSync(result.filepath)).toBe(true);
    const saved = JSON.parse(fs.readFileSync(result.filepath, 'utf8'));
    expect(saved.generatedAt).toBeDefined();
    expect(saved.commit).toBe('abc123');
    expect(saved.data).toEqual(data);
  });

  it('returns filename and filepath', () => {
    const result = saveSnapshot({ stories: [] }, { historyDir: testDir });
    expect(result.filename).toBeDefined();
    expect(result.filepath).toBeDefined();
    expect(result.filepath).toContain(result.filename);
  });
});

describe('loadSnapshots', () => {
  const testDir = path.join(__dirname, '../fixtures/.test-history');

  beforeAll(() => {
    if (!fs.existsSync(testDir)) {
      fs.mkdirSync(testDir, { recursive: true });
    }
    fs.writeFileSync(path.join(testDir, '2026-03-01T10-00-00Z.json'), JSON.stringify({
      generatedAt: '2026-03-01T10:00:00Z',
      commit: 'aaa',
      data: { stories: [{ id: 'US-0001', status: 'Done' }], costs: {}, coverage: {} },
    }));
    fs.writeFileSync(path.join(testDir, '2026-03-02T10-00-00Z.json'), JSON.stringify({
      generatedAt: '2026-03-02T10:00:00Z',
      commit: 'bbb',
      data: { stories: [{ id: 'US-0001', status: 'Done' }, { id: 'US-0002', status: 'Done' }], costs: {}, coverage: {} },
    }));
    fs.writeFileSync(path.join(testDir, 'invalid.txt'), 'not a json file');
    fs.writeFileSync(path.join(testDir, 'bad.json'), '{ invalid');
  });

  afterAll(() => {
    if (fs.existsSync(testDir)) {
      fs.rmSync(testDir, { recursive: true });
    }
  });

  it('returns empty array if history dir does not exist', () => {
    const result = loadSnapshots({ historyDir: '/nonexistent/path' });
    expect(result).toEqual([]);
  });

  it('loads valid snapshots sorted by date', () => {
    const snaps = loadSnapshots({ historyDir: testDir });
    expect(snaps).toHaveLength(2);
    expect(new Date(snaps[0].generatedAt) < new Date(snaps[1].generatedAt)).toBe(true);
  });

  it('skips invalid files without crashing', () => {
    const snaps = loadSnapshots({ historyDir: testDir });
    expect(snaps).toHaveLength(2);
  });

  it('extracts filename and commit from each snapshot', () => {
    const snaps = loadSnapshots({ historyDir: testDir });
    expect(snaps[0].filename).toBe('2026-03-01T10-00-00Z.json');
    expect(snaps[0].commit).toBe('aaa');
    expect(snaps[1].commit).toBe('bbb');
  });
});

describe('extractTrends', () => {
  it('returns null if fewer than 2 snapshots', () => {
    const snaps = [{ generatedAt: '2026-03-01T10:00:00Z', data: { stories: [], costs: {}, coverage: {} } }];
    expect(extractTrends(snaps)).toBeNull();
  });

  it('extracts done story counts', () => {
    const snaps = [
      { generatedAt: '2026-03-01T10:00:00Z', data: { stories: [{ status: 'Done' }, { status: 'In Progress' }], costs: {}, coverage: {} } },
      { generatedAt: '2026-03-02T10:00:00Z', data: { stories: [{ status: 'Done' }, { status: 'Done' }], costs: {}, coverage: {} } },
    ];
    const trends = extractTrends(snaps);
    expect(trends.doneCounts).toEqual([1, 2]);
  });

  it('extracts total story counts', () => {
    const snaps = [
      { generatedAt: '2026-03-01T10:00:00Z', data: { stories: [{ status: 'Done' }], costs: {}, coverage: {} } },
      { generatedAt: '2026-03-02T10:00:00Z', data: { stories: [{ status: 'Done' }, { status: 'Planned' }], costs: {}, coverage: {} } },
    ];
    const trends = extractTrends(snaps);
    expect(trends.totalStories).toEqual([1, 2]);
  });

  it('extracts AI costs', () => {
    const snaps = [
      { generatedAt: '2026-03-01T10:00:00Z', data: { stories: [], costs: { 'US-0001': { costUsd: 10.5 } }, coverage: {} } },
      { generatedAt: '2026-03-02T10:00:00Z', data: { stories: [], costs: { 'US-0001': { costUsd: 10.5 }, 'US-0002': { costUsd: 5.25 } }, coverage: {} } },
    ];
    const trends = extractTrends(snaps);
    expect(trends.aiCosts).toEqual([10.5, 15.75]);
  });

  it('extracts coverage', () => {
    const snaps = [
      { generatedAt: '2026-03-01T10:00:00Z', data: { stories: [], costs: {}, coverage: { available: true, overall: 95.5 } } },
      { generatedAt: '2026-03-02T10:00:00Z', data: { stories: [], costs: {}, coverage: { available: true, overall: 96.0 } } },
    ];
    const trends = extractTrends(snaps);
    expect(trends.coverage).toEqual([95.5, 96.0]);
  });

  it('handles missing coverage gracefully', () => {
    const snaps = [
      { generatedAt: '2026-03-01T10:00:00Z', data: { stories: [], costs: {}, coverage: {} } },
      { generatedAt: '2026-03-02T10:00:00Z', data: { stories: [], costs: {}, coverage: { available: true, overall: 96 } } },
    ];
    const trends = extractTrends(snaps);
    expect(trends.coverage).toEqual([null, 96]);
  });

  it('extracts velocity from tshirt estimates', () => {
    const snaps = [
      { generatedAt: '2026-03-01T10:00:00Z', data: { stories: [{ status: 'Done', estimate: 'M' }], costs: {}, coverage: {} } },
      { generatedAt: '2026-03-02T10:00:00Z', data: { stories: [{ status: 'Done', estimate: 'M' }, { status: 'Done', estimate: 'L' }], costs: {}, coverage: {} } },
    ];
    const trends = extractTrends(snaps);
    expect(trends.velocity).toEqual([3, 8]);
  });

  it('extracts open bugs count', () => {
    const snaps = [
      { generatedAt: '2026-03-01T10:00:00Z', data: { stories: [], bugs: [{ status: 'Open' }, { status: 'Fixed' }], costs: {}, coverage: {} } },
      { generatedAt: '2026-03-02T10:00:00Z', data: { stories: [], bugs: [{ status: 'Open' }, { status: 'In Progress' }], costs: {}, coverage: {} } },
    ];
    const trends = extractTrends(snaps);
    expect(trends.openBugs).toEqual([1, 2]);
  });

  it('extracts at-risk stories', () => {
    const snaps = [
      { generatedAt: '2026-03-01T10:00:00Z', data: { stories: [{ atRisk: true }, { atRisk: false }], bugs: [], costs: {}, coverage: {} } },
      { generatedAt: '2026-03-02T10:00:00Z', data: { stories: [{ atRisk: true }, { atRisk: true }], bugs: [], costs: {}, coverage: {} } },
    ];
    const trends = extractTrends(snaps);
    expect(trends.atRisk).toEqual([1, 2]);
  });

  it('extracts token usage', () => {
    const snaps = [
      { generatedAt: '2026-03-01T10:00:00Z', data: { stories: [], costs: { 'US-0001': { inputTokens: 1000, outputTokens: 500 } }, coverage: {} } },
      { generatedAt: '2026-03-02T10:00:00Z', data: { stories: [], costs: { 'US-0001': { inputTokens: 1000, outputTokens: 500 }, 'US-0002': { inputTokens: 2000, outputTokens: 800 } }, coverage: {} } },
    ];
    const trends = extractTrends(snaps);
    expect(trends.inputTokens).toEqual([1000, 3000]);
    expect(trends.outputTokens).toEqual([500, 1300]);
  });
});
