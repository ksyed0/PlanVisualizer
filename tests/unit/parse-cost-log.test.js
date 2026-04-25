'use strict';
const path = require('path');
const fs = require('fs');
const {
  parseCostLog,
  deduplicateSessions,
  aggregateCostByBranch,
  normalizeBranch,
  backfillUnattributed,
} = require('../../tools/lib/parse-cost-log');

const fixture = fs.readFileSync(path.join(__dirname, '../fixtures/AI_COST_LOG.md'), 'utf8');

describe('parseCostLog', () => {
  let rows;
  beforeAll(() => {
    rows = parseCostLog(fixture);
  });

  it('parses 5 rows', () => expect(rows).toHaveLength(5));
  it('parses date', () => expect(rows[0].date).toBe('2026-03-09'));
  it('parses sessionId', () => expect(rows[0].sessionId).toBe('sess_001'));
  it('parses branch', () => expect(rows[0].branch).toBe('main'));
  it('parses inputTokens as number', () => expect(rows[0].inputTokens).toBe(45000));
  it('parses outputTokens as number', () => expect(rows[0].outputTokens).toBe(12000));
  it('parses cacheReadTokens as number', () => expect(rows[0].cacheReadTokens).toBe(8000));
  it('parses costUsd as number', () => expect(rows[0].costUsd).toBeCloseTo(0.42));
});

describe('deduplicateSessions', () => {
  it('keeps only the last row per session_id', () => {
    const rows = [
      { sessionId: 'abc', branch: 'main', inputTokens: 100, outputTokens: 10, cacheReadTokens: 5, costUsd: 0.1 },
      { sessionId: 'abc', branch: 'main', inputTokens: 200, outputTokens: 20, cacheReadTokens: 10, costUsd: 0.2 },
      { sessionId: 'xyz', branch: 'main', inputTokens: 50, outputTokens: 5, cacheReadTokens: 2, costUsd: 0.05 },
    ];
    const deduped = deduplicateSessions(rows);
    expect(deduped).toHaveLength(2);
    expect(deduped.find((r) => r.sessionId === 'abc').costUsd).toBe(0.2);
  });

  it('returns all rows when all session_ids are unique', () => {
    const rows = [
      { sessionId: 'a', branch: 'main', inputTokens: 10, outputTokens: 1, cacheReadTokens: 0, costUsd: 0.01 },
      { sessionId: 'b', branch: 'main', inputTokens: 20, outputTokens: 2, cacheReadTokens: 0, costUsd: 0.02 },
    ];
    expect(deduplicateSessions(rows)).toHaveLength(2);
  });
});

describe('aggregateCostByBranch', () => {
  let agg;
  beforeAll(() => {
    agg = aggregateCostByBranch(parseCostLog(fixture));
  });

  it('sums two sessions on same branch', () => {
    expect(agg['feature/US-0001-open-file'].costUsd).toBeCloseTo(0.47);
  });
  it('sums tokens across sessions', () => {
    expect(agg['feature/US-0001-open-file'].inputTokens).toBe(50000);
  });
  it('tracks main separately', () => {
    expect(agg['main'].costUsd).toBeCloseTo(0.42);
  });

  it('deduplicates same session_id — counts session once, using last row', () => {
    const rows = parseCostLog(fixture).concat([
      {
        sessionId: 'sess_001',
        branch: 'main',
        inputTokens: 50000,
        outputTokens: 13000,
        cacheReadTokens: 9000,
        costUsd: 0.5,
      },
    ]);
    const a = aggregateCostByBranch(rows);
    // sess_001 appears twice — only the last (0.50) should be counted, not 0.42 + 0.50
    expect(a['main'].costUsd).toBeCloseTo(0.5);
    expect(a['main'].sessions).toBe(1);
  });
});

describe('normalizeBranch', () => {
  const gitLog = [
    { sha: 'abc1234', date: '2026-04-14T10:00:00Z', branch: 'feature/US-0147-workload-widget' },
    { sha: 'def5678', date: '2026-04-15T10:00:00Z', branch: 'feature/US-0073-stakeholder-view' },
  ];

  it('returns feature branch unchanged', () => {
    expect(normalizeBranch('feature/US-0147-workload-widget', gitLog)).toBe('feature/US-0147-workload-widget');
  });

  it('maps claude/* branch to nearest feature branch by date', () => {
    expect(normalizeBranch('claude/elastic-greider-52b5b1', gitLog, '2026-04-14T12:00:00Z')).toBe(
      'feature/US-0147-workload-widget',
    );
  });

  it('maps second claude/* branch to its nearest feature branch', () => {
    expect(normalizeBranch('claude/gifted-johnson-5e162a', gitLog, '2026-04-15T12:00:00Z')).toBe(
      'feature/US-0073-stakeholder-view',
    );
  });

  it('returns original branch when no gitLog provided', () => {
    expect(normalizeBranch('claude/some-branch', [])).toBe('claude/some-branch');
  });

  it('returns original branch for main', () => {
    expect(normalizeBranch('main', gitLog)).toBe('main');
  });
});

describe('backfillUnattributed', () => {
  const rows = [
    {
      date: '2026-04-14',
      sessionId: 'sess_004',
      branch: 'claude/elastic-greider-52b5b1',
      inputTokens: 35000,
      outputTokens: 9000,
      cacheReadTokens: 6000,
      costUsd: 0.31,
    },
    {
      date: '2026-04-15',
      sessionId: 'sess_005',
      branch: 'feature/US-0001-known',
      inputTokens: 10000,
      outputTokens: 2000,
      cacheReadTokens: 1000,
      costUsd: 0.09,
    },
  ];

  const gitLog = [{ sha: 'abc1', date: '2026-04-14T08:00:00Z', branch: 'feature/US-0147-workload-widget' }];

  it('rewrites claude/* branch to nearest feature branch', () => {
    const result = backfillUnattributed(rows, gitLog);
    const backfilled = result.find((r) => r.sessionId === 'sess_004');
    expect(backfilled.branch).toBe('feature/US-0147-workload-widget');
    expect(backfilled.backfilled).toBe(true);
  });

  it('leaves known feature branches unchanged', () => {
    const result = backfillUnattributed(rows, gitLog);
    const unchanged = result.find((r) => r.sessionId === 'sess_005');
    expect(unchanged.branch).toBe('feature/US-0001-known');
    expect(unchanged.backfilled).toBeUndefined();
  });

  it('returns a count of backfilled rows', () => {
    const { count } = backfillUnattributed(rows, gitLog, { returnCount: true });
    expect(count).toBe(1);
  });
});
