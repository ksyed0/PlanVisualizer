'use strict';
const { computeProjectedCost, attributeAICosts } = require('../../tools/lib/compute-costs');

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
