// tools/lib/fetch-github-status.js
'use strict';
const { githubRequest, batchedRequests } = require('./github-client');

function summarizeCIStatus(checkRuns) {
  if (!checkRuns || checkRuns.length === 0) return null;
  const states = checkRuns.map((r) => r.conclusion || r.status);
  if (states.some((s) => s === 'failure' || s === 'timed_out' || s === 'cancelled')) return 'failure';
  if (states.some((s) => s === 'in_progress' || s === 'queued' || s === null)) return 'pending';
  // If we reach here, no failures and no pending states were found
  return 'success';
}

async function fetchGitHubStatus(config, token) {
  if (!token || !config || !config.enabled) return null;
  const repo = config.repo;

  // 1. Open PRs
  const rawPrs = await githubRequest(token, 'GET', `/repos/${repo}/pulls?state=open&per_page=30`);

  // 2. CI check-runs per PR (batched, errors isolated per PR)
  const prs = await batchedRequests(rawPrs, async (pr) => {
    let ciStatus = null;
    try {
      const runs = await githubRequest(token, 'GET', `/repos/${repo}/commits/${pr.head.sha}/check-runs`);
      ciStatus = summarizeCIStatus(runs.check_runs || []);
    } catch (_) {
      // Leave ciStatus null on API error for this PR
    }
    const storyMatch = pr.head.ref.match(/US-(\d{4,})/i);
    const bugMatch = pr.head.ref.match(/BUG-(\d{4,})/i);
    return {
      number: pr.number,
      title: pr.title,
      url: pr.html_url,
      headBranch: pr.head.ref,
      storyId: storyMatch ? `US-${storyMatch[1]}` : null,
      bugId: bugMatch ? `BUG-${bugMatch[1]}` : null,
      ciStatus,
      reviewCount: pr.requested_reviewers ? pr.requested_reviewers.length : 0, // pending review requests, not completed reviews
      createdAt: pr.created_at,
    };
  });

  // 3. Latest deployment
  let deployment = null;
  try {
    const deployments = await githubRequest(token, 'GET', `/repos/${repo}/deployments?per_page=1`);
    if (deployments.length > 0) {
      const d = deployments[0];
      const statuses = await githubRequest(token, 'GET', `/repos/${repo}/deployments/${d.id}/statuses?per_page=1`);
      const s = statuses[0] || null;
      deployment = {
        environment: d.environment,
        status: s ? s.state : 'unknown',
        ref: d.ref,
        createdAt: d.created_at,
        url: (s && s.target_url) || null,
      };
    }
  } catch (_) {
    // Deployments not available for this repo
  }

  const passing = prs.filter((p) => p.ciStatus === 'success').length;
  const failing = prs.filter((p) => p.ciStatus === 'failure').length;
  const pending = prs.filter((p) => p.ciStatus === 'pending').length;

  return {
    prs,
    ciSummary: { total: prs.length, passing, failing, pending },
    deployment,
    fetchedAt: new Date().toISOString(),
  };
}

module.exports = { fetchGitHubStatus, summarizeCIStatus };
