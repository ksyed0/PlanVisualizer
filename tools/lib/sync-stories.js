'use strict';
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '../..');

function classifyStoryChanges(stories, stateEntries, ghIssues) {
  const stateMap = new Map(stateEntries.map((e) => [e.id, e]));
  const ghMap = new Map(ghIssues.map((i) => [i.number, i]));
  const changes = [];

  for (const story of stories) {
    if (story.status === 'Retired' || story.status === 'Cancelled') {
      changes.push({ action: 'skip', story, reason: 'retired/cancelled' });
      continue;
    }

    const effectiveIssueNumber = story.ghIssueNumber || stateMap.get(story.id)?.ghIssueNumber || null;

    if (!effectiveIssueNumber) {
      changes.push({ action: 'create', story });
      continue;
    }

    if (!story.ghIssueNumber) story.ghIssueNumber = effectiveIssueNumber;

    const ghIssue = ghMap.get(effectiveIssueNumber);
    if (!ghIssue) {
      changes.push({ action: 'skip', story, reason: 'GH issue not found' });
      continue;
    }

    const pvDone = story.status === 'Done';
    const ghClosed = ghIssue.state === 'closed';

    if (pvDone && !ghClosed) changes.push({ action: 'close', story });
    else if (!pvDone && ghClosed) changes.push({ action: 'reopen', story });
    else changes.push({ action: 'skip', story });
  }

  return changes;
}

function writeStoryIssueNumber(storyId, issueNumber) {
  const planPath = path.join(ROOT, 'docs/RELEASE_PLAN.md');
  let content = fs.readFileSync(planPath, 'utf8');
  // Block-scoped: extract story block first
  const blockRe = new RegExp(`(^${storyId}:.+?)(?=\\n(?:US|EPIC|TASK)-\\d+:|\\Z)`, 'ms');
  const blockMatch = content.match(blockRe);
  if (!blockMatch) return;
  const block = blockMatch[1];
  if (/GH Issue:/.test(block)) return;
  // Insert after Branch line
  const branchRe = /^([ \t]*)(Branch:[^\n]+\n)/m;
  if (!branchRe.test(block)) return;
  const newBlock = block.replace(
    branchRe,
    (_, indent, branchLine) => `${indent}${branchLine}${indent}GH Issue: #${issueNumber}\n`,
  );
  content = content.slice(0, blockMatch.index) + newBlock + content.slice(blockMatch.index + block.length);
  fs.writeFileSync(planPath, content, 'utf8');
}

module.exports = { classifyStoryChanges, writeStoryIssueNumber };
