'use strict';
const {
  computeProjectedCost,
  attributeAICosts,
  attributeBugCosts,
  cacheHitRatio,
  computeCacheHitSeries,
} = require('../../tools/lib/compute-costs');

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
    main: { costUsd: 0.42, inputTokens: 45000, outputTokens: 12000, sessions: 1 },
  };

  it('attributes cost to matching story by branch', () => {
    const result = attributeAICosts(stories, costByBranch);
    expect(result['US-0001'].costUsd).toBeCloseTo(0.68);
  });

  it('story with no branch gets share of unattributed cost', () => {
    const result = attributeAICosts(stories, costByBranch);
    expect(result['US-0002'].costUsd).toBeCloseTo(0.21);
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
    'bugfix/BUG-0001-crash': { costUsd: 0.25, inputTokens: 30000, outputTokens: 8000, sessions: 3 },
    main: { costUsd: 0.1, inputTokens: 10000, outputTokens: 3000, sessions: 1 },
  };

  it('attributes cost to bug by fixBranch', () => {
    const result = attributeBugCosts(bugs, costByBranch);
    expect(result['BUG-0001'].costUsd).toBeCloseTo(0.25);
    expect(result['BUG-0001'].inputTokens).toBe(30000);
    expect(result['BUG-0001'].outputTokens).toBe(8000);
    expect(result['BUG-0001'].sessions).toBe(3);
    expect(result['BUG-0001'].isEstimated).toBe(false);
  });

  it('returns zero cost for bug with no fixBranch', () => {
    const result = attributeBugCosts(bugs, costByBranch);
    expect(result['BUG-0002'].costUsd).toBe(0);
    expect(result['BUG-0002'].inputTokens).toBe(0);
    expect(result['BUG-0002'].outputTokens).toBe(0);
    expect(result['BUG-0002'].sessions).toBe(0);
    expect(result['BUG-0002'].isEstimated).toBe(false);
  });

  it('returns zero cost for bug whose fixBranch is not in costByBranch', () => {
    const result = attributeBugCosts(bugs, costByBranch);
    expect(result['BUG-0003'].costUsd).toBe(0);
    expect(result['BUG-0003'].sessions).toBe(0);
  });

  it('returns _totals summing only matched bug branches', () => {
    const result = attributeBugCosts(bugs, costByBranch);
    expect(result._totals.costUsd).toBeCloseTo(0.25);
    expect(result._totals.inputTokens).toBe(30000);
    expect(result._totals.outputTokens).toBe(8000);
  });

  it('handles empty bugs array', () => {
    const result = attributeBugCosts([], costByBranch);
    expect(result._totals).toEqual({
      costUsd: 0,
      inputTokens: 0,
      outputTokens: 0,
      cacheReadTokens: 0,
      cacheHitRatio: null,
    });
  });

  it('uses estimatedCostUsd fallback when branch has no cost log entry', () => {
    const bugsWithEstimate = [{ id: 'BUG-0003', fixBranch: 'bugfix/BUG-0003-no-match', estimatedCostUsd: 0.3 }];
    const result = attributeBugCosts(bugsWithEstimate, costByBranch);
    expect(result['BUG-0003'].costUsd).toBeCloseTo(0.3);
    expect(result['BUG-0003'].isEstimated).toBe(true);
    expect(result._totals.costUsd).toBeCloseTo(0.3);
  });

  it('does not set isEstimated when estimatedCostUsd is 0', () => {
    const bugsNoEstimate = [{ id: 'BUG-0004', fixBranch: 'bugfix/BUG-0004-no-match' }];
    const result = attributeBugCosts(bugsNoEstimate, costByBranch);
    expect(result['BUG-0004'].isEstimated).toBe(false);
    expect(result['BUG-0004'].costUsd).toBe(0);
  });

  // BUG-0224: bugs sharing a fix branch must split the branch cost, not duplicate it.
  it('splits branch cost equally across bugs sharing the same fixBranch', () => {
    const sharedBugs = [
      { id: 'BUG-1001', fixBranch: 'bugfix/BUG-1001-1002-shared' },
      { id: 'BUG-1002', fixBranch: 'bugfix/BUG-1001-1002-shared' },
      { id: 'BUG-1003', fixBranch: 'bugfix/BUG-1001-1002-shared' },
      { id: 'BUG-1004', fixBranch: 'bugfix/BUG-1001-1002-shared' },
    ];
    const sharedByBranch = {
      'bugfix/BUG-1001-1002-shared': { costUsd: 4.0, inputTokens: 100000, outputTokens: 20000, sessions: 4 },
    };
    const result = attributeBugCosts(sharedBugs, sharedByBranch);
    expect(result['BUG-1001'].costUsd).toBeCloseTo(1.0);
    expect(result['BUG-1002'].costUsd).toBeCloseTo(1.0);
    expect(result['BUG-1003'].costUsd).toBeCloseTo(1.0);
    expect(result['BUG-1004'].costUsd).toBeCloseTo(1.0);
    // _totals must equal branch total exactly (no double-counting).
    expect(result._totals.costUsd).toBeCloseTo(4.0);
    // Tokens & sessions are also split.
    expect(result['BUG-1001'].inputTokens).toBe(25000);
    expect(result['BUG-1001'].outputTokens).toBe(5000);
    expect(result['BUG-1001'].sessions).toBe(1);
  });

  it('does not divide cost when only one bug claims a branch', () => {
    const oneBug = [{ id: 'BUG-2001', fixBranch: 'bugfix/BUG-2001-solo' }];
    const byBranch = {
      'bugfix/BUG-2001-solo': { costUsd: 3.0, inputTokens: 30000, outputTokens: 9000, sessions: 2 },
    };
    const result = attributeBugCosts(oneBug, byBranch);
    expect(result['BUG-2001'].costUsd).toBeCloseTo(3.0);
    expect(result['BUG-2001'].inputTokens).toBe(30000);
    expect(result['BUG-2001'].outputTokens).toBe(9000);
    expect(result['BUG-2001'].sessions).toBe(2);
  });
});

// BUG-0217: stories sharing a branch (e.g. multiple stories that all merged via develop)
// must split that branch's cost so a single $X cost is not double-counted across N stories.
describe('attributeAICosts — multi-story branch sharing (BUG-0217)', () => {
  it('splits a shared branch cost equally across all stories that claim it', () => {
    const stories = [
      { id: 'US-1001', branch: 'develop' },
      { id: 'US-1002', branch: 'develop' },
      { id: 'US-1003', branch: 'develop' },
      { id: 'US-1004', branch: 'develop' },
    ];
    const costByBranch = {
      develop: { costUsd: 4.0, inputTokens: 80000, outputTokens: 16000, sessions: 4 },
    };
    const result = attributeAICosts(stories, costByBranch);
    expect(result['US-1001'].costUsd).toBeCloseTo(1.0);
    expect(result['US-1002'].costUsd).toBeCloseTo(1.0);
    expect(result['US-1003'].costUsd).toBeCloseTo(1.0);
    expect(result['US-1004'].costUsd).toBeCloseTo(1.0);
    // _totals == branch total (no inflation).
    expect(result._totals.costUsd).toBeCloseTo(4.0);
  });

  it('keeps full branch cost on a story that uniquely claims it', () => {
    const stories = [
      { id: 'US-2001', branch: 'feature/US-2001-solo' },
      { id: 'US-2002', branch: 'feature/US-2002-other' },
    ];
    const costByBranch = {
      'feature/US-2001-solo': { costUsd: 2.0, inputTokens: 50000, outputTokens: 12000, sessions: 1 },
      'feature/US-2002-other': { costUsd: 1.5, inputTokens: 30000, outputTokens: 8000, sessions: 1 },
    };
    const result = attributeAICosts(stories, costByBranch);
    expect(result['US-2001'].costUsd).toBeCloseTo(2.0);
    expect(result['US-2002'].costUsd).toBeCloseTo(1.5);
    expect(result._totals.costUsd).toBeCloseTo(3.5);
  });

  it('still distributes truly-unattributed cost across all stories', () => {
    // Branch "main" is in cost log but no story claims it.
    const stories = [
      { id: 'US-3001', branch: 'feature/US-3001' },
      { id: 'US-3002', branch: 'feature/US-3002' },
    ];
    const costByBranch = {
      'feature/US-3001': { costUsd: 1.0, inputTokens: 10000, outputTokens: 2000, sessions: 1 },
      'feature/US-3002': { costUsd: 1.0, inputTokens: 10000, outputTokens: 2000, sessions: 1 },
      main: { costUsd: 0.4, inputTokens: 5000, outputTokens: 1000, sessions: 1 },
    };
    const result = attributeAICosts(stories, costByBranch);
    // Each story gets its own $1.00 + $0.20 share of orphan main cost.
    expect(result['US-3001'].costUsd).toBeCloseTo(1.2);
    expect(result['US-3002'].costUsd).toBeCloseTo(1.2);
    expect(result._totals.costUsd).toBeCloseTo(2.4);
  });
});

describe('cacheHitRatio (ENH-0005)', () => {
  it('computes cacheRead / (input + cacheRead)', () => {
    expect(cacheHitRatio(70, 30)).toBeCloseTo(0.7);
  });

  it('returns null when both inputs are zero', () => {
    expect(cacheHitRatio(0, 0)).toBeNull();
  });

  it('returns null when inputs are missing', () => {
    expect(cacheHitRatio(undefined, undefined)).toBeNull();
  });

  it('returns 1 when input is zero but cacheRead is positive', () => {
    expect(cacheHitRatio(100, 0)).toBe(1);
  });
});

describe('attributeAICosts — cacheHitRatio (ENH-0005)', () => {
  it('attaches per-story cacheHitRatio derived from the branch aggregate', () => {
    const stories = [{ id: 'US-0001', branch: 'feature/US-0001-open-file' }];
    const costByBranch = {
      'feature/US-0001-open-file': {
        costUsd: 0.47,
        inputTokens: 30000,
        outputTokens: 14000,
        cacheReadTokens: 70000,
        sessions: 2,
      },
    };
    const result = attributeAICosts(stories, costByBranch);
    expect(result['US-0001'].cacheReadTokens).toBe(70000);
    expect(result['US-0001'].cacheHitRatio).toBeCloseTo(0.7);
    expect(result._totals.cacheHitRatio).toBeCloseTo(0.7);
  });

  it('returns null cacheHitRatio for an unmatched story', () => {
    const stories = [{ id: 'US-0002', branch: '' }];
    const result = attributeAICosts(stories, {});
    expect(result['US-0002'].cacheHitRatio).toBeNull();
  });
});

describe('attributeBugCosts — cacheHitRatio (ENH-0005)', () => {
  it('attaches per-bug cacheHitRatio derived from the branch aggregate', () => {
    const bugs = [{ id: 'BUG-0001', fixBranch: 'bugfix/BUG-0001-crash' }];
    const costByBranch = {
      'bugfix/BUG-0001-crash': {
        costUsd: 0.25,
        inputTokens: 20000,
        outputTokens: 8000,
        cacheReadTokens: 80000,
        sessions: 3,
      },
    };
    const result = attributeBugCosts(bugs, costByBranch);
    expect(result['BUG-0001'].cacheReadTokens).toBe(80000);
    expect(result['BUG-0001'].cacheHitRatio).toBeCloseTo(0.8);
  });

  it('zeroes cacheReadTokens and cacheHitRatio for an estimated branch', () => {
    const bugs = [{ id: 'BUG-9001', fixBranch: 'est/BUG-9001' }];
    const costByBranch = {
      'est/BUG-9001': { costUsd: 0.1, inputTokens: 1000, outputTokens: 100, cacheReadTokens: 9000, sessions: 1 },
    };
    const result = attributeBugCosts(bugs, costByBranch);
    expect(result['BUG-9001'].cacheReadTokens).toBe(0);
    expect(result['BUG-9001'].cacheHitRatio).toBeNull();
    expect(result['BUG-9001'].isEstimated).toBe(true);
  });
});

describe('computeCacheHitSeries (ENH-0005)', () => {
  const rows = [
    { date: '2026-06-01', sessionId: 's1', inputTokens: 100, cacheReadTokens: 100 }, // 0.5
    { date: '2026-06-02', sessionId: 's2', inputTokens: 25, cacheReadTokens: 75 }, // 0.75
    { date: '2026-06-03', sessionId: 's3', inputTokens: 50, cacheReadTokens: 50 }, // 0.5
  ];

  it('returns a chronological series with one ratio per session', () => {
    const result = computeCacheHitSeries(rows);
    expect(result.series.map((r) => r.sessionId)).toEqual(['s1', 's2', 's3']);
    expect(result.series[1].ratio).toBeCloseTo(0.75);
  });

  it('computes rollingAvg as the simple mean of per-session ratios within the window', () => {
    const result = computeCacheHitSeries(rows, { windowSize: 14 });
    expect(result.rollingAvg).toBeCloseTo((0.5 + 0.75 + 0.5) / 3);
    expect(result.sampleCount).toBe(3);
  });

  it('latest is the most recent session ratio', () => {
    expect(computeCacheHitSeries(rows).latest).toBeCloseTo(0.5);
  });

  it('windowSize smaller than sample count only averages the most recent N', () => {
    const result = computeCacheHitSeries(rows, { windowSize: 2 });
    expect(result.sampleCount).toBe(2);
    expect(result.rollingAvg).toBeCloseTo((0.75 + 0.5) / 2);
  });

  it('excludes "-est" sessionId rows from the series', () => {
    const withEst = rows.concat([
      { date: '2026-03-09', sessionId: 'sess_0001-est', inputTokens: 90000, cacheReadTokens: 45000 },
    ]);
    const result = computeCacheHitSeries(withEst);
    expect(result.series.map((r) => r.sessionId)).not.toContain('sess_0001-est');
  });

  it('excludes rows with zero input and zero cacheRead (no NaN in series)', () => {
    const withZero = rows.concat([{ date: '2026-06-04', sessionId: 's4', inputTokens: 0, cacheReadTokens: 0 }]);
    const result = computeCacheHitSeries(withZero);
    expect(result.series.map((r) => r.sessionId)).not.toContain('s4');
  });

  it('dedupes a session to its last row (highest cumulative totals)', () => {
    const cumulative = [
      { date: '2026-06-05', sessionId: 's5', inputTokens: 100, cacheReadTokens: 100 }, // 0.5
      { date: '2026-06-05', sessionId: 's5', inputTokens: 100, cacheReadTokens: 300 }, // 0.75, last wins
    ];
    const result = computeCacheHitSeries(cumulative);
    expect(result.series).toHaveLength(1);
    expect(result.series[0].ratio).toBeCloseTo(0.75);
  });

  it('returns nulls and empty series for no input', () => {
    const result = computeCacheHitSeries([]);
    expect(result.series).toEqual([]);
    expect(result.latest).toBeNull();
    expect(result.rollingAvg).toBeNull();
    expect(result.sampleCount).toBe(0);
  });

  it('defaults windowSize to 14', () => {
    expect(computeCacheHitSeries([]).windowSize).toBe(14);
  });
});
