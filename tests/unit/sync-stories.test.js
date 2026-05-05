'use strict';
const { classifyStoryChanges } = require('../../tools/lib/sync-stories');

describe('sync-stories — classifyStoryChanges', () => {
  it('marks new stories without GH issue as CREATE', () => {
    const stories = [{ id: 'US-0171', title: 'Sync engine', status: 'In Progress', priority: 'High (P0)' }];
    const changes = classifyStoryChanges(stories, [], []);
    expect(changes[0].action).toBe('create');
  });

  it('marks Done stories with open GH issue as CLOSE', () => {
    const stories = [{ id: 'US-0171', title: 'Sync engine', status: 'Done', ghIssueNumber: 99 }];
    const stateEntries = [
      { id: 'US-0171', ghIssueNumber: 99, lastKnownGhStatus: 'open', lastSyncedAt: '2026-05-01T00:00:00Z' },
    ];
    const ghIssues = [{ number: 99, state: 'open' }];
    const changes = classifyStoryChanges(stories, stateEntries, ghIssues);
    expect(changes[0].action).toBe('close');
  });

  it('skips Retired stories entirely', () => {
    const stories = [{ id: 'US-0171', title: 'Old story', status: 'Retired', ghIssueNumber: 99 }];
    const changes = classifyStoryChanges(stories, [], []);
    expect(changes[0].action).toBe('skip');
  });

  it('marks already-synced in-progress stories as SKIP', () => {
    const stories = [{ id: 'US-0171', title: 'Sync engine', status: 'In Progress', ghIssueNumber: 99 }];
    const stateEntries = [
      { id: 'US-0171', ghIssueNumber: 99, lastKnownGhStatus: 'open', lastSyncedAt: '2026-05-01T00:00:00Z' },
    ];
    const ghIssues = [{ number: 99, state: 'open' }];
    const changes = classifyStoryChanges(stories, stateEntries, ghIssues);
    expect(changes[0].action).toBe('skip');
  });
});
