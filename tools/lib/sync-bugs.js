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

    // Use ghIssueNumber from parsed BUGS.md, fall back to state map for bugs
    // where writeBugIssueNumber may have written the field but parseBugs
    // hadn't been updated yet to read it back.
    const effectiveIssueNumber = bug.ghIssueNumber || state?.ghIssueNumber || null;

    if (!effectiveIssueNumber) {
      changes.push({ action: 'create', bug });
      continue;
    }

    // Attach resolved number so downstream code can use it
    if (!bug.ghIssueNumber) bug.ghIssueNumber = effectiveIssueNumber;

    const ghIssue = ghMap.get(effectiveIssueNumber);
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

  // Extract only this bug's block (stop at next BUG- header) to avoid
  // cross-block false-positive when checking for existing GH Issue field.
  const blockRe = new RegExp(`(^${bugId}:.+?)(?=\\nBUG-\\d+:|\\Z)`, 'ms');
  const blockMatch = content.match(blockRe);
  if (!blockMatch) return;

  const block = blockMatch[1];
  if (/GH Issue:/.test(block)) return; // already linked in this block

  // Find Status line and inject GH Issue after it
  const statusRe = /^([ \t]*)(Status:[^\n]+\n)/m;
  if (!statusRe.test(block)) return;
  const newBlock = block.replace(
    statusRe,
    (_, indent, statusLine) => `${indent}${statusLine}${indent}GH Issue: #${issueNumber}\n`,
  );
  content = content.slice(0, blockMatch.index) + newBlock + content.slice(blockMatch.index + block.length);
  fs.writeFileSync(bugsPath, content, 'utf8');
}

function updateBugStatus(bugId, newStatus) {
  const bugsPath = path.join(ROOT, 'docs/BUGS.md');
  let content = fs.readFileSync(bugsPath, 'utf8');
  content = content.replace(
    new RegExp(`(^${bugId}:[^\\n]+\\n[\\s\\S]*?)(Status:\\s*\\S+)`, 'm'),
    `$1Status: ${newStatus}`,
  );
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
