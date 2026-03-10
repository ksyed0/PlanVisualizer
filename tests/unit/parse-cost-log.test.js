'use strict';
const path = require('path');
const fs = require('fs');
const { parseCostLog, aggregateCostByBranch } = require('../../tools/lib/parse-cost-log');

const fixture = fs.readFileSync(
  path.join(__dirname, '../fixtures/AI_COST_LOG.md'), 'utf8'
);

describe('parseCostLog', () => {
  let rows;
  beforeAll(() => { rows = parseCostLog(fixture); });

  it('parses 3 rows', () => expect(rows).toHaveLength(3));
  it('parses date', () => expect(rows[0].date).toBe('2026-03-09'));
  it('parses sessionId', () => expect(rows[0].sessionId).toBe('sess_001'));
  it('parses branch', () => expect(rows[0].branch).toBe('main'));
  it('parses inputTokens as number', () => expect(rows[0].inputTokens).toBe(45000));
  it('parses outputTokens as number', () => expect(rows[0].outputTokens).toBe(12000));
  it('parses cacheReadTokens as number', () => expect(rows[0].cacheReadTokens).toBe(8000));
  it('parses costUsd as number', () => expect(rows[0].costUsd).toBeCloseTo(0.42));
});

describe('aggregateCostByBranch', () => {
  let agg;
  beforeAll(() => { agg = aggregateCostByBranch(parseCostLog(fixture)); });

  it('sums two sessions on same branch', () => {
    expect(agg['feature/US-0001-open-file'].costUsd).toBeCloseTo(0.47);
  });
  it('sums tokens across sessions', () => {
    expect(agg['feature/US-0001-open-file'].inputTokens).toBe(50000);
  });
  it('tracks main separately', () => {
    expect(agg['main'].costUsd).toBeCloseTo(0.42);
  });
});
