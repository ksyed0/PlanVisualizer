'use strict';
const { computeBudgetMetrics, generateBudgetCSV } = require('../../tools/lib/budget');

describe('computeBudgetMetrics', () => {
  const baseData = {
    epics: [
      { id: 'EPIC-0001', title: 'Test Epic 1' },
      { id: 'EPIC-0002', title: 'Test Epic 2' },
    ],
    stories: [
      { id: 'US-0001', epicId: 'EPIC-0001', status: 'Done', estimate: 'M' },
      { id: 'US-0002', epicId: 'EPIC-0001', status: 'In Progress', estimate: 'S' },
      { id: 'US-0003', epicId: 'EPIC-0002', status: 'Done', estimate: 'L' },
    ],
    costs: {
      _totals: { costUsd: 50, inputTokens: 1000, outputTokens: 500 },
      'US-0001': { costUsd: 30, inputTokens: 600, outputTokens: 300 },
      'US-0002': { costUsd: 10, inputTokens: 200, outputTokens: 100 },
      'US-0003': { costUsd: 10, inputTokens: 200, outputTokens: 100 },
    },
  };

  it('returns hasBudget false when no budget configured', () => {
    const result = computeBudgetMetrics(baseData, { budget: {} }, []);
    expect(result.hasBudget).toBe(false);
  });

  it('calculates total spent correctly', () => {
    const result = computeBudgetMetrics(baseData, { budget: { totalUsd: 100 } }, []);
    expect(result.totalSpent).toBe(50);
  });

  it('calculates percent used', () => {
    const result = computeBudgetMetrics(baseData, { budget: { totalUsd: 100 } }, []);
    expect(result.percentUsed).toBe(50);
    expect(result.hasBudget).toBe(true);
  });

  it('calculates crossed thresholds', () => {
    const result = computeBudgetMetrics(baseData, { budget: { totalUsd: 100, thresholds: [25, 50, 75] } }, []);
    expect(result.crossedThresholds).toEqual([25, 50]);
  });

  it('calculates per-epic budgets', () => {
    const result = computeBudgetMetrics(
      baseData,
      {
        budget: { totalUsd: 100, byEpic: { 'EPIC-0001': 50, 'EPIC-0002': 30 } },
      },
      [],
    );
    expect(result.epicBudgets).toHaveLength(2);
    const epic1 = result.epicBudgets.find((e) => e.id === 'EPIC-0001');
    expect(epic1.budget).toBe(50);
    expect(epic1.spent).toBe(40);
    expect(epic1.remaining).toBe(10);
    expect(epic1.percentUsed).toBe(80);
  });

  it('handles missing costs gracefully', () => {
    const dataNoCosts = { epics: [], stories: [], costs: {} };
    const result = computeBudgetMetrics(dataNoCosts, { budget: { totalUsd: 100 } }, []);
    expect(result.totalSpent).toBe(0);
    expect(result.hasBudget).toBe(true);
  });

  it('calculates burn rate from snapshots', () => {
    const snapshots = [
      { generatedAt: '2026-03-01T10:00:00Z', data: { costs: { _totals: { costUsd: 0 } } } },
      { generatedAt: '2026-03-02T10:00:00Z', data: { costs: { _totals: { costUsd: 10 } } } },
      { generatedAt: '2026-03-03T10:00:00Z', data: { costs: { _totals: { costUsd: 20 } } } },
    ];
    const result = computeBudgetMetrics(baseData, { budget: { totalUsd: 100 } }, snapshots);
    expect(result.burnRate).toBe(10);
    expect(result.daysRemaining).toBe(5);
  });
});

describe('generateBudgetCSV', () => {
  it('returns empty string when no budgetMetrics', () => {
    const result = generateBudgetCSV({}, null, []);
    expect(result).toBe('');
  });

  it('generates CSV with budget data', () => {
    const data = {
      epics: [{ id: 'EPIC-0001', title: 'Test Epic' }],
      stories: [],
      costs: {},
    };
    const metrics = {
      burnRate: 1.5,
      daysRemaining: 30,
      epicBudgets: [{ id: 'EPIC-0001', title: 'Test Epic', budget: 100, spent: 50, remaining: 50, percentUsed: 50 }],
    };
    const result = generateBudgetCSV(data, metrics, []);
    expect(result).toContain('Date,Epic ID,Epic Title,Budget,Spent,Remaining,% Used,Burn Rate,Projected Exhaustion');
    expect(result).toContain('EPIC-0001');
    expect(result).toContain('50.00');
    expect(result).toContain('30 days');
  });

  it('handles missing epic budgets', () => {
    const data = { epics: [], stories: [], costs: {} };
    const metrics = { burnRate: 0, daysRemaining: null, epicBudgets: [] };
    const result = generateBudgetCSV(data, metrics, []);
    expect(result).toContain('Date,Epic ID,Epic Title,Budget,Spent,Remaining,% Used,Burn Rate,Projected Exhaustion');
  });
});
