'use strict';
const https = require('https');

function githubRequest(token, method, apiPath, body) {
  return new Promise((resolve, reject) => {
    const data = body ? JSON.stringify(body) : null;
    const req = https.request(
      {
        hostname: 'api.github.com',
        path: apiPath,
        method,
        headers: {
          Authorization: `Bearer ${token}`,
          'User-Agent': 'PlanVisualizer/1.0',
          Accept: 'application/vnd.github+json',
          'X-GitHub-Api-Version': '2022-11-28',
          ...(data ? { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(data) } : {}),
        },
      },
      (res) => {
        let raw = '';
        res.on('data', (chunk) => {
          raw += chunk;
        });
        res.on('end', () => {
          if (res.statusCode >= 400) {
            return reject(new Error(`GitHub API ${method} ${apiPath} → ${res.statusCode}: ${raw}`));
          }
          resolve(res.statusCode === 204 ? null : JSON.parse(raw));
        });
      },
    );
    req.on('error', reject);
    if (data) req.write(data);
    req.end();
  });
}

function buildIssueTitle(id, title) {
  return `[${id}] ${title}`;
}

function buildIssueBody(entry) {
  const lines = [`**${entry.id}** — ${entry.severity || ''} | ${entry.status || ''}\n`];
  if (entry.stepsToReproduce) {
    lines.push('### Steps to Reproduce', entry.stepsToReproduce, '');
  }
  if (entry.expected) lines.push('### Expected', entry.expected, '');
  if (entry.actual) lines.push('### Actual', entry.actual, '');
  lines.push('---', '_Synced by [PlanVisualizer](https://github.com/ksyed0/PlanVisualizer)_');
  return lines.join('\n');
}

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

async function batchedRequests(items, fn, batchSize = 10, delayMs = 100) {
  const results = [];
  for (let i = 0; i < items.length; i++) {
    if (i > 0 && i % batchSize === 0) await sleep(delayMs);
    results.push(await fn(items[i], i));
  }
  return results;
}

module.exports = {
  githubRequest,
  buildIssueTitle,
  buildIssueBody,
  batchedRequests,
  sleep,
  createIssue: (token, repo, { title, body, labels }) =>
    githubRequest(token, 'POST', `/repos/${repo}/issues`, { title, body, labels }),
  closeIssue: (token, repo, number) =>
    githubRequest(token, 'PATCH', `/repos/${repo}/issues/${number}`, { state: 'closed' }),
  reopenIssue: (token, repo, number) =>
    githubRequest(token, 'PATCH', `/repos/${repo}/issues/${number}`, { state: 'open' }),
  listIssues: (token, repo, label) =>
    githubRequest(
      token,
      'GET',
      `/repos/${repo}/issues?labels=${encodeURIComponent(label)}&state=all&per_page=100`,
      null,
    ),
};
