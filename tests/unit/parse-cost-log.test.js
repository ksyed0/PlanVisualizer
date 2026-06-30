'use strict';
const path = require('path');
const fs = require('fs');
const {
  parseCostLog,
  deduplicateSessions,
  aggregateCostByBranch,
  normalizeBranch,
  backfillUnattributed,
  stripConflictMarkers,
} = require('../../tools/lib/parse-cost-log');

const fixture = fs.readFileSync(path.join(__dirname, '../fixtures/AI_COST_LOG.md'), 'utf8');
const corruptedFixture = fs.readFileSync(path.join(__dirname, '../fixtures/AI_COST_LOG_corrupted.md'), 'utf8');

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

  it('attributes rows with null branch using git log', () => {
    const nullBranchRows = [{ date: '2026-04-14', branch: null, costUsd: 0.5 }];
    const gitLogEntry = [{ branch: 'feature/US-0100-foo', date: '2026-04-14' }];
    const result = backfillUnattributed(nullBranchRows, gitLogEntry);
    expect(result[0].branch).toBe('feature/US-0100-foo');
    expect(result[0].backfilled).toBe(true);
  });
});

describe('stripConflictMarkers (BUG-0269)', () => {
  it('drops conflict-marker lines but keeps both row blocks they bracket', () => {
    const cleaned = stripConflictMarkers(corruptedFixture);
    expect(cleaned).not.toMatch(/^<{7}/m);
    expect(cleaned).not.toMatch(/^={7}/m);
    expect(cleaned).toContain('sess_002');
    expect(cleaned).toContain('sess_003');
  });

  it('strips the corrupted "> > > > > > > " prefix from affected rows', () => {
    const cleaned = stripConflictMarkers(corruptedFixture);
    expect(cleaned).not.toMatch(/^> > > > > > > /m);
    expect(cleaned).toContain('| 2026-04-14 | sess_004');
  });

  it('removes the standalone "Stashed changes" header line', () => {
    const cleaned = stripConflictMarkers(corruptedFixture);
    expect(cleaned).not.toContain('Stashed changes');
  });

  it('every row is parseable after cleanup, recovering previously-hidden rows', () => {
    const beforeRows = parseCostLog(corruptedFixture);
    const afterRows = parseCostLog(stripConflictMarkers(corruptedFixture));
    // sess_004 and sess_005 were invisible pre-cleanup (line started with ">")
    expect(beforeRows.map((r) => r.sessionId)).not.toContain('sess_004');
    expect(afterRows.map((r) => r.sessionId)).toEqual(
      expect.arrayContaining(['sess_001', 'sess_002', 'sess_003', 'sess_004', 'sess_005']),
    );
  });

  it('is idempotent — re-running on already-clean content is a no-op', () => {
    const cleaned = stripConflictMarkers(corruptedFixture);
    expect(stripConflictMarkers(cleaned)).toBe(cleaned);
  });
});

describe('WORKTREE_BRANCH_RE export', () => {
  it('exports WORKTREE_BRANCH_RE regex', () => {
    const { WORKTREE_BRANCH_RE } = require('../../tools/lib/parse-cost-log');
    expect(WORKTREE_BRANCH_RE).toBeInstanceOf(RegExp);
    expect(WORKTREE_BRANCH_RE.test('claude/some-branch')).toBe(true);
    expect(WORKTREE_BRANCH_RE.test('feature/US-0100-foo')).toBe(false);
  });
});
