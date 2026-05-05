#!/usr/bin/env node
'use strict';
const path = require('path');
const fs = require('fs');

const ROOT = path.join(__dirname, '..');
const STATE_PATH = path.join(ROOT, 'docs/github-sync-state.json');

const {
  loadSyncState,
  saveSyncState,
  buildStateEntry,
  classifyBugChanges,
  writeBugIssueNumber,
  updateBugStatus,
} = require('./lib/sync-bugs');
const {
  createIssue,
  closeIssue,
  reopenIssue,
  listIssues,
  buildIssueTitle,
  buildIssueBody,
  batchedRequests,
} = require('./lib/github-client');

const dryRun = process.argv.includes('--dry-run');

async function run() {
  let config;
  try {
    const raw = JSON.parse(fs.readFileSync(path.join(ROOT, 'plan-visualizer.config.json'), 'utf8'));
    config = raw.github;
  } catch (e) {
    console.warn('[sync-github] Could not read plan-visualizer.config.json:', e.message);
    process.exit(0);
  }

  if (!config || !config.enabled) {
    console.log('[sync-github] GitHub sync disabled — skipping.');
    process.exit(0);
  }

  const token = process.env.GITHUB_TOKEN;
  if (!token) {
    console.warn('[sync-github] GITHUB_TOKEN not set — skipping.');
    process.exit(0);
  }

  const { repo, labelMap = {}, defaultLabels = ['planvisualizer'] } = config;

  if (dryRun) console.log('[sync-github] DRY RUN — no API calls or file writes will occur.');

  const state = loadSyncState(STATE_PATH);
  let lastError = null;
  const summary = { created: 0, closed: 0, reopened: 0, pulled: 0, skipped: 0 };

  try {
    const { parseBugs } = require('./lib/parse-bugs');
    const bugsRaw = fs.readFileSync(path.join(ROOT, 'docs/BUGS.md'), 'utf8');
    const bugs = parseBugs(bugsRaw);

    const ghIssues = dryRun ? [] : await listIssues(token, repo, defaultLabels[0]);

    const changes = classifyBugChanges(bugs, state.entries, ghIssues, { repo, labelMap, defaultLabels });

    // Write back GH Issue numbers for bugs resolved from state (not yet in BUGS.md)
    if (!dryRun) {
      for (const bug of bugs) {
        if (!bug.ghIssueNumber) {
          const stateEntry = state.entries.find((e) => e.id === bug.id);
          if (stateEntry?.ghIssueNumber) {
            writeBugIssueNumber(bug.id, stateEntry.ghIssueNumber);
          }
        }
      }
    }

    // Pull unlinked GH issues → new BUGS.md entries
    const linkedNumbers = new Set(state.entries.map((e) => e.ghIssueNumber));
    const unlinkedGhIssues = ghIssues.filter((i) => !linkedNumbers.has(i.number) && i.state === 'open');
    for (const ghIssue of unlinkedGhIssues) {
      const severityFromLabel = { critical: 'Critical', high: 'High', medium: 'Medium', low: 'Low' };
      const matchedLabel = (ghIssue.labels || []).map((l) => l.name).find((n) => severityFromLabel[n]);
      const severity = matchedLabel ? severityFromLabel[matchedLabel] : 'Medium';
      const title = ghIssue.title.replace(/^\[BUG-\d+\]\s*/, '');

      if (!dryRun) {
        const { reserveId, atomicAppend } = require('../orchestrator/atomic-write');
        const newBugId = await reserveId('BUG');
        const entry = [
          '',
          `${newBugId}: ${title}`,
          `Severity: ${severity}`,
          `Related Story:`,
          `Steps to Reproduce:`,
          ``,
          `   1. Reported via GitHub Issue #${ghIssue.number}`,
          `   Expected:`,
          `   Actual:`,
          `   Status: Open`,
          `   GH Issue: #${ghIssue.number}`,
          `   Fix Branch:`,
          `   Lesson Encoded: No`,
          '',
          '---',
        ].join('\n');
        const bugsPath = path.join(ROOT, 'docs/BUGS.md');
        const existing = fs.readFileSync(bugsPath, 'utf8');
        const separator = existing.endsWith('\n') ? '' : '\n';
        fs.writeFileSync(bugsPath, existing + separator + entry, 'utf8');
        state.entries.push(buildStateEntry(newBugId, ghIssue.number, 'open'));
      } else {
        console.log(`  [dry-run] PULL_CREATE BUG from GH #${ghIssue.number}: ${title}`);
      }
      summary.pulled = (summary.pulled || 0) + 1;
    }

    await batchedRequests(changes, async (change) => {
      const { action, bug } = change;

      if (action === 'create') {
        if (!dryRun) {
          const labels = [labelMap[bug.severity] || 'low', ...defaultLabels];
          const issue = await createIssue(token, repo, {
            title: buildIssueTitle(bug.id, bug.title),
            body: buildIssueBody(bug),
            labels,
          });
          writeBugIssueNumber(bug.id, issue.number);
          state.entries.push(buildStateEntry(bug.id, issue.number, 'open'));
        } else {
          console.log(`  [dry-run] CREATE issue for ${bug.id}: ${bug.title}`);
        }
        summary.created++;
      } else if (action === 'close') {
        if (!dryRun) {
          await closeIssue(token, repo, bug.ghIssueNumber);
          const e = state.entries.find((x) => x.id === bug.id);
          if (e) e.lastKnownGhStatus = 'closed';
        } else {
          console.log(`  [dry-run] CLOSE #${bug.ghIssueNumber} for ${bug.id}`);
        }
        summary.closed++;
      } else if (action === 'reopen') {
        if (!dryRun) {
          await reopenIssue(token, repo, bug.ghIssueNumber);
          const e = state.entries.find((x) => x.id === bug.id);
          if (e) e.lastKnownGhStatus = 'open';
        } else {
          console.log(`  [dry-run] REOPEN #${bug.ghIssueNumber} for ${bug.id}`);
        }
        summary.reopened++;
      } else if (action === 'pull_close') {
        if (!dryRun) {
          updateBugStatus(bug.id, 'Fixed');
          const e = state.entries.find((x) => x.id === bug.id);
          if (e) e.lastKnownGhStatus = 'closed';
        } else {
          console.log(`  [dry-run] PULL_CLOSE ${bug.id} → Fixed (GH closed externally)`);
        }
        summary.pulled++;
      } else {
        summary.skipped++;
      }
    });

    // Story sync (optional)
    if (config.syncStories) {
      const { parseReleasePlan } = require('./lib/parse-release-plan');
      const releasePlanRaw = fs.readFileSync(path.join(ROOT, 'docs/RELEASE_PLAN.md'), 'utf8');
      const { stories } = parseReleasePlan(releasePlanRaw);
      const { classifyStoryChanges, writeStoryIssueNumber } = require('./lib/sync-stories');
      const storyChanges = classifyStoryChanges(stories, state.entries, dryRun ? [] : ghIssues);

      await batchedRequests(storyChanges, async (change) => {
        const { action, story } = change;
        if (action === 'create') {
          if (!dryRun) {
            const labels = [...defaultLabels, 'story'];
            const issue = await createIssue(token, repo, {
              title: buildIssueTitle(story.id, story.title),
              body: `**${story.id}** — ${story.priority || ''} | ${story.status || ''}\n\n${story.description || ''}`,
              labels,
            });
            writeStoryIssueNumber(story.id, issue.number);
            state.entries.push(buildStateEntry(story.id, issue.number, 'open'));
          } else {
            console.log(`  [dry-run] CREATE issue for ${story.id}: ${story.title}`);
          }
          summary.created++;
        } else if (action === 'close') {
          if (!dryRun) {
            await closeIssue(token, repo, story.ghIssueNumber);
          } else console.log(`  [dry-run] CLOSE #${story.ghIssueNumber} for ${story.id}`);
          summary.closed++;
        } else if (action === 'reopen') {
          if (!dryRun) {
            await reopenIssue(token, repo, story.ghIssueNumber);
          } else console.log(`  [dry-run] REOPEN #${story.ghIssueNumber} for ${story.id}`);
          summary.reopened++;
        } else {
          summary.skipped++;
        }
      });
    }
  } catch (err) {
    lastError = err.message;
    console.error('[sync-github] Error:', err.message);
  }

  if (!dryRun) {
    saveSyncState(STATE_PATH, {
      lastSyncAt: new Date().toISOString(),
      lastError,
      summary,
      entries: state.entries,
    });
  }

  console.log(
    `[sync-github] Done. created:${summary.created} closed:${summary.closed} reopened:${summary.reopened} pulled:${summary.pulled} skipped:${summary.skipped}`,
  );
  if (lastError) process.exit(1);
}

run().catch((e) => {
  console.error('[sync-github] Fatal:', e.message);
  process.exit(1);
});
