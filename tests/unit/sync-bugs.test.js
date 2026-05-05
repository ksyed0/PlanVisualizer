'use strict';
const { classifyBugChanges } = require('../../tools/lib/sync-bugs');

describe('sync-bugs — classifyBugChanges', () => {
  const config = {
    repo: 'owner/repo',
    labelMap: { Critical: 'critical', High: 'high', Medium: 'medium', Low: 'low' },
    defaultLabels: ['planvisualizer'],
  };

  it('marks new bugs (no ghIssueNumber) as CREATE', () => {
    const bugs = [{ id: 'BUG-0253', title: 'Crash', severity: 'High', status: 'Open' }];
    const changes = classifyBugChanges(bugs, [], [], config);
    expect(changes).toHaveLength(1);
    expect(changes[0].action).toBe('create');
    expect(changes[0].bug.id).toBe('BUG-0253');
  });

  it('marks Fixed bugs with open GH issue as CLOSE', () => {
    const bugs = [{ id: 'BUG-0253', title: 'Crash', severity: 'High', status: 'Fixed', ghIssueNumber: 42 }];
    const stateEntries = [
      { id: 'BUG-0253', ghIssueNumber: 42, lastKnownGhStatus: 'open', lastSyncedAt: '2026-05-01T00:00:00Z' },
    ];
    const ghIssues = [{ number: 42, state: 'open', title: '[BUG-0253] Crash' }];
    const changes = classifyBugChanges(bugs, stateEntries, ghIssues, config);
    expect(changes[0].action).toBe('close');
  });

  it('marks Open bugs with closed GH issue as REOPEN', () => {
    const bugs = [{ id: 'BUG-0253', title: 'Crash', severity: 'High', status: 'Open', ghIssueNumber: 42 }];
    const stateEntries = [
      { id: 'BUG-0253', ghIssueNumber: 42, lastKnownGhStatus: 'closed', lastSyncedAt: '2026-05-01T00:00:00Z' },
    ];
    const ghIssues = [{ number: 42, state: 'closed', title: '[BUG-0253] Crash' }];
    const changes = classifyBugChanges(bugs, stateEntries, ghIssues, config);
    expect(changes[0].action).toBe('reopen');
  });

  it('marks already-in-sync entries as SKIP', () => {
    const bugs = [{ id: 'BUG-0253', title: 'Crash', severity: 'High', status: 'Open', ghIssueNumber: 42 }];
    const stateEntries = [
      { id: 'BUG-0253', ghIssueNumber: 42, lastKnownGhStatus: 'open', lastSyncedAt: '2026-05-01T00:00:00Z' },
    ];
    const ghIssues = [{ number: 42, state: 'open', title: '[BUG-0253] Crash' }];
    const changes = classifyBugChanges(bugs, stateEntries, ghIssues, config);
    expect(changes[0].action).toBe('skip');
  });

  it('marks externally-closed GH issue (bug still Open) as PULL_CLOSE', () => {
    const now = new Date().toISOString();
    const bugs = [{ id: 'BUG-0253', title: 'Crash', severity: 'High', status: 'Open', ghIssueNumber: 42 }];
    const stateEntries = [
      { id: 'BUG-0253', ghIssueNumber: 42, lastKnownGhStatus: 'open', lastSyncedAt: '2026-04-01T00:00:00Z' },
    ];
    const ghIssues = [{ number: 42, state: 'closed', closed_at: now, title: '[BUG-0253] Crash' }];
    const changes = classifyBugChanges(bugs, stateEntries, ghIssues, config);
    expect(changes[0].action).toBe('pull_close');
  });

  it('Retired bugs are treated as Fixed (close GH issue)', () => {
    const bugs = [{ id: 'BUG-0253', title: 'Crash', severity: 'High', status: 'Retired', ghIssueNumber: 42 }];
    const stateEntries = [
      { id: 'BUG-0253', ghIssueNumber: 42, lastKnownGhStatus: 'open', lastSyncedAt: '2026-05-01T00:00:00Z' },
    ];
    const ghIssues = [{ number: 42, state: 'open' }];
    const changes = classifyBugChanges(bugs, stateEntries, ghIssues, config);
    expect(changes[0].action).toBe('close');
  });
});

describe('sync-bugs — loadSyncState / saveSyncState / buildStateEntry', () => {
  const { loadSyncState, buildStateEntry } = require('../../tools/lib/sync-bugs');

  it('loadSyncState returns empty entries when file absent', () => {
    const state = loadSyncState('/nonexistent/path.json');
    expect(state.entries).toEqual([]);
    expect(state.lastSyncAt).toBeNull();
  });

  it('buildStateEntry produces correct shape', () => {
    const entry = buildStateEntry('BUG-0253', 42, 'open');
    expect(entry.id).toBe('BUG-0253');
    expect(entry.ghIssueNumber).toBe(42);
    expect(entry.lastKnownGhStatus).toBe('open');
    expect(typeof entry.lastSyncedAt).toBe('string');
  });
});
