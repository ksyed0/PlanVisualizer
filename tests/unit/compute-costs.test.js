'use strict';
const { computeProjectedCost, attributeAICosts, attributeBugCosts } = require('../../tools/lib/compute-costs');

const HOURS = { S: 4, M: 8, L: 16, XL: 32 };
const RATE = 100;

describe('computeProjectedCost', () => {
  it('S = $400', () => expect(computeProjectedCost('S', HOURS, RATE)).toBe(400));
  it('M = $800', () => expect(computeProjectedCost('M', HOURS, RATE)).toBe(800));
  it('L = $1600', () => expect(computeProjectedCost('L', HOURS, RATE)).toBe(1600));
  it('XL = $3200', () => expect(computeProjectedCost('XL', HOURS, RATE)).toBe(3200));
  it('unknown size returns 0', () => expect(computeProjectedCost('XXL', HOURS, RATE)).toBe(0));
  it('empty estimate returns 0', () => expect(computeProjectedCost('', HOURS, RATE)).toBe(0));
});

describe('attributeAICosts', () => {
  const stories = [
    { id: 'US-0001', branch: 'feature/US-0001-open-file' },
    { id: 'US-0002', branch: '' },
  ];
  const costByBranch = {
    'feature/US-0001-open-file': { costUsd: 0.47, inputTokens: 50000, outputTokens: 14000, sessions: 2 },
    'main': { costUsd: 0.42, inputTokens: 45000, outputTokens: 12000, sessions: 1 },
  };

  it('attributes cost to matching story by branch', () => {
    const result = attributeAICosts(stories, costByBranch);
    expect(result['US-0001'].costUsd).toBeCloseTo(0.47);
  });

  it('story with no branch gets 0 cost', () => {
    const result = attributeAICosts(stories, costByBranch);
    expect(result['US-0002'].costUsd).toBe(0);
  });

  it('returns totalAiCost across all branches', () => {
    const result = attributeAICosts(stories, costByBranch);
    expect(result._totals.costUsd).toBeCloseTo(0.89);
  });
});

describe('attributeBugCosts', () => {
  const bugs = [
    { id: 'BUG-0001', fixBranch: 'bugfix/BUG-0001-crash' },
    { id: 'BUG-0002', fixBranch: '' },
    { id: 'BUG-0003', fixBranch: 'bugfix/BUG-0003-no-match' },
  ];
  const costByBranch = {
    'bugfix/BUG-0001-crash': { costUsd: 0.25, inputTokens: 30000, outputTokens: 8000 },
    'main': { costUsd: 0.10, inputTokens: 10000, outputTokens: 3000 },
  };

  it('attributes cost to bug by fixBranch', () => {
    const result = attributeBugCosts(bugs, costByBranch);
    expect(result['BUG-0001'].costUsd).toBeCloseTo(0.25);
    expect(result['BUG-0001'].inputTokens).toBe(30000);
    expect(result['BUG-0001'].outputTokens).toBe(8000);
  });

  it('returns zero cost for bug with no fixBranch', () => {
    const result = attributeBugCosts(bugs, costByBranch);
    expect(result['BUG-0002'].costUsd).toBe(0);
    expect(result['BUG-0002'].inputTokens).toBe(0);
    expect(result['BUG-0002'].outputTokens).toBe(0);
  });

  it('returns zero cost for bug whose fixBranch is not in costByBranch', () => {
    const result = attributeBugCosts(bugs, costByBranch);
    expect(result['BUG-0003'].costUsd).toBe(0);
  });

  it('handles empty bugs array', () => {
    const result = attributeBugCosts([], costByBranch);
    expect(result).toEqual({});
  });
});
