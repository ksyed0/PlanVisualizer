'use strict';
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '../..');

function classifyBugChanges(bugs, stateEntries, ghIssues, config) {
  const stateMap = new Map(stateEntries.map((e) => [e.id, e]));
  const ghMap = new Map(ghIssues.map((i) => [i.number, i]));
  const changes = [];

  for (const bug of bugs) {
    const state = stateMap.get(bug.id);
    const pvClosed = /^(Fixed|Retired|Cancelled)/i.test(bug.status);

    if (!bug.ghIssueNumber) {
      changes.push({ action: 'create', bug });
      continue;
    }

    const ghIssue = ghMap.get(bug.ghIssueNumber);
    if (!ghIssue) {
      changes.push({ action: 'skip', bug, reason: 'GH issue not found' });
      continue;
    }

    const ghClosed = ghIssue.state === 'closed';

    if (!state) {
      if (pvClosed && !ghClosed) changes.push({ action: 'close', bug });
      else if (!pvClosed && ghClosed) changes.push({ action: 'reopen', bug });
      else changes.push({ action: 'skip', bug });
      continue;
    }

    const lastSyncedAt = new Date(state.lastSyncedAt).getTime();
    const ghChangedAt = ghIssue.closed_at || ghIssue.updated_at;
    const ghChangeTime = ghChangedAt ? new Date(ghChangedAt).getTime() : 0;

    const ghChangedSinceSync = ghChangeTime > lastSyncedAt;
    const pvStatusMatchesLastSync = state.lastKnownGhStatus === 'open' ? !pvClosed : pvClosed;

    if (ghChangedSinceSync && pvStatusMatchesLastSync && ghClosed && !pvClosed) {
      changes.push({ action: 'pull_close', bug });
    } else if (pvClosed && !ghClosed) {
      changes.push({ action: 'close', bug });
    } else if (!pvClosed && ghClosed) {
      changes.push({ action: 'reopen', bug });
    } else {
      changes.push({ action: 'skip', bug });
    }
  }

  return changes;
}

function writeBugIssueNumber(bugId, issueNumber) {
  const bugsPath = path.join(ROOT, 'docs/BUGS.md');
  let content = fs.readFileSync(bugsPath, 'utf8');
  const alreadyLinked = new RegExp(`${bugId}[\\s\\S]*?GH Issue:`).test(content);
  if (alreadyLinked) return;
  content = content.replace(
    new RegExp(`(${bugId}:[^\\n]+\\n[\\s\\S]*?Status:[^\\n]+\\n)`),
    `$1GH Issue: #${issueNumber}\n`,
  );
  fs.writeFileSync(bugsPath, content, 'utf8');
}

function updateBugStatus(bugId, newStatus) {
  const bugsPath = path.join(ROOT, 'docs/BUGS.md');
  let content = fs.readFileSync(bugsPath, 'utf8');
  content = content.replace(new RegExp(`(${bugId}:[\\s\\S]*?)(Status:\\s*\\S+)`), `$1Status: ${newStatus}`);
  fs.writeFileSync(bugsPath, content, 'utf8');
}

function loadSyncState(stateFilePath) {
  try {
    const abs = path.isAbsolute(stateFilePath) ? stateFilePath : path.join(ROOT, stateFilePath);
    return JSON.parse(fs.readFileSync(abs, 'utf8'));
  } catch {
    return { lastSyncAt: null, lastError: null, summary: {}, entries: [] };
  }
}

function saveSyncState(stateFilePath, state) {
  const abs = path.isAbsolute(stateFilePath) ? stateFilePath : path.join(ROOT, stateFilePath);
  fs.writeFileSync(abs, JSON.stringify(state, null, 2) + '\n', 'utf8');
}

function buildStateEntry(id, ghIssueNumber, lastKnownGhStatus) {
  return { id, ghIssueNumber, lastKnownGhStatus, lastSyncedAt: new Date().toISOString() };
}

module.exports = {
  classifyBugChanges,
  writeBugIssueNumber,
  updateBugStatus,
  loadSyncState,
  saveSyncState,
  buildStateEntry,
};
