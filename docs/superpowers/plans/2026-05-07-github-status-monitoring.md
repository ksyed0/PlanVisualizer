# GitHub Status Monitoring Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Surface GitHub PR status, CI check results, and deployment history in both the plan-status and agentic pipeline dashboards.

**Architecture:** A new pure module `fetch-github-status.js` wraps the existing `github-client.js` to fetch PR/CI/deployment data. For plan-status, `generate-plan.js` calls it at generate time and passes the result through the render pipeline. For dashboard.html, the Conductor writes GitHub status into `sdlc-status.json` via a new `github-status` command in `update-sdlc-status.js`; `generate-dashboard.js` reads it and renders live surfaces. A poll-until loop in `--watch` mode keeps CI status fresh when checks are pending.

**Tech Stack:** Node.js, GitHub REST API v3, Jest (tests), existing `github-client.js` + `atomicReadModifyWriteJson` infrastructure.

**Parallelisation note:** Tasks 1–2 are foundational and must complete first. Tasks 3–6 (plan-status track) and Tasks 7–10 (dashboard track) are independent of each other and can be worked in parallel.

---

## File Map

| Action | File                                     | Responsibility                                                                                   |
| ------ | ---------------------------------------- | ------------------------------------------------------------------------------------------------ |
| Create | `tools/lib/fetch-github-status.js`       | Fetch PRs, CI checks, deployment from GitHub API                                                 |
| Create | `tests/unit/fetch-github-status.test.js` | Unit tests for fetch module                                                                      |
| Modify | `tools/lib/render-utils.js`              | Add `timeAgo(isoString)` helper + export                                                         |
| Modify | `tests/unit/render-utils.test.js`        | Tests for `timeAgo`                                                                              |
| Modify | `tools/generate-plan.js`                 | Make `main()` async, call `fetchGitHubStatus`, set `data.githubStatus`                           |
| Modify | `tools/lib/render-shell.js`              | Add GitHub CI + open-PR chips to `renderMasthead()`                                              |
| Modify | `tools/lib/render-tabs.js`               | Deployment banner, CI kpi tile, PR list, story row badges                                        |
| Modify | `tools/update-sdlc-status.js`            | Add async `github-status` handler with change detection + `ciPollUntil`                          |
| Modify | `tools/generate-dashboard.js`            | GITHUB sidebar widget, Needs Attention line, live bar CI chip, Event Log events, poll-until loop |

---

## Task 1: `fetch-github-status.js`

**Files:**

- Create: `tools/lib/fetch-github-status.js`
- Create: `tests/unit/fetch-github-status.test.js`

- [ ] **Step 1: Write the failing tests**

```js
// tests/unit/fetch-github-status.test.js
'use strict';
jest.mock('../../tools/lib/github-client');
const { githubRequest, batchedRequests } = require('../../tools/lib/github-client');
const { fetchGitHubStatus } = require('../../tools/lib/fetch-github-status');

const config = { enabled: true, repo: 'owner/repo' };
const token = 'ghp_test';

describe('fetchGitHubStatus', () => {
  beforeEach(() => jest.clearAllMocks());

  test('returns null when disabled', async () => {
    expect(await fetchGitHubStatus({ enabled: false, repo: 'x/y' }, token)).toBeNull();
  });

  test('returns null when token absent', async () => {
    expect(await fetchGitHubStatus(config, '')).toBeNull();
  });

  test('returns null when token is undefined', async () => {
    expect(await fetchGitHubStatus(config, undefined)).toBeNull();
  });

  test('fetches PRs, CI checks, and deployment', async () => {
    githubRequest
      .mockResolvedValueOnce([
        {
          number: 1,
          title: 'feat: US-0001 test',
          html_url: 'https://github.com/owner/repo/pull/1',
          head: { ref: 'feature/US-0001-test', sha: 'abc123' },
          requested_reviewers: [{ login: 'reviewer1' }],
          created_at: '2026-05-01T00:00:00Z',
        },
      ])
      .mockResolvedValueOnce({ check_runs: [{ conclusion: 'success', status: 'completed' }] })
      .mockResolvedValueOnce([{ id: 99, environment: 'gh-pages', ref: 'v2.2.0', created_at: '2026-05-07T10:00:00Z' }])
      .mockResolvedValueOnce([{ state: 'success', target_url: 'https://example.com' }]);

    batchedRequests.mockImplementation(async (items, fn) => Promise.all(items.map(fn)));

    const result = await fetchGitHubStatus(config, token);

    expect(result.prs).toHaveLength(1);
    expect(result.prs[0].number).toBe(1);
    expect(result.prs[0].storyId).toBe('US-0001');
    expect(result.prs[0].bugId).toBeNull();
    expect(result.prs[0].ciStatus).toBe('success');
    expect(result.prs[0].reviewCount).toBe(1);
    expect(result.prs[0].createdAt).toBe('2026-05-01T00:00:00Z');
    expect(result.ciSummary).toEqual({ total: 1, passing: 1, failing: 0, pending: 0 });
    expect(result.deployment.environment).toBe('gh-pages');
    expect(result.deployment.status).toBe('success');
    expect(result.deployment.ref).toBe('v2.2.0');
    expect(result.fetchedAt).toBeTruthy();
  });

  test('extracts BUG id from branch name', async () => {
    githubRequest
      .mockResolvedValueOnce([
        {
          number: 2,
          title: 'fix: BUG-0012',
          html_url: 'https://github.com/owner/repo/pull/2',
          head: { ref: 'bugfix/BUG-0012-crash', sha: 'def456' },
          requested_reviewers: [],
          created_at: '2026-05-06T00:00:00Z',
        },
      ])
      .mockResolvedValueOnce({ check_runs: [] })
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([]);

    batchedRequests.mockImplementation(async (items, fn) => Promise.all(items.map(fn)));

    const result = await fetchGitHubStatus(config, token);
    expect(result.prs[0].storyId).toBeNull();
    expect(result.prs[0].bugId).toBe('BUG-0012');
    expect(result.prs[0].ciStatus).toBeNull();
  });

  test('handles CI check-run fetch failure gracefully', async () => {
    githubRequest
      .mockResolvedValueOnce([
        {
          number: 3,
          title: 'chore: cleanup',
          html_url: 'https://github.com/owner/repo/pull/3',
          head: { ref: 'chore/cleanup', sha: 'ghi789' },
          requested_reviewers: [],
          created_at: '2026-05-05T00:00:00Z',
        },
      ])
      .mockRejectedValueOnce(new Error('API error'))
      .mockResolvedValueOnce([]);

    batchedRequests.mockImplementation(async (items, fn) => Promise.all(items.map(fn)));

    const result = await fetchGitHubStatus(config, token);
    expect(result.prs[0].ciStatus).toBeNull();
  });
});

describe('summarizeCIStatus (via fetchGitHubStatus)', () => {
  beforeEach(() => jest.clearAllMocks());

  test('returns failure if any check failed', async () => {
    githubRequest
      .mockResolvedValueOnce([
        {
          number: 1,
          title: 't',
          html_url: 'u',
          head: { ref: 'feature/US-0001-t', sha: 'a' },
          requested_reviewers: [],
          created_at: '2026-05-01T00:00:00Z',
        },
      ])
      .mockResolvedValueOnce({
        check_runs: [
          { conclusion: 'success', status: 'completed' },
          { conclusion: 'failure', status: 'completed' },
        ],
      })
      .mockResolvedValueOnce([]);

    batchedRequests.mockImplementation(async (items, fn) => Promise.all(items.map(fn)));
    const result = await fetchGitHubStatus(config, token);
    expect(result.prs[0].ciStatus).toBe('failure');
  });

  test('returns pending if any check is in_progress and none failed', async () => {
    githubRequest
      .mockResolvedValueOnce([
        {
          number: 1,
          title: 't',
          html_url: 'u',
          head: { ref: 'feature/US-0001-t', sha: 'a' },
          requested_reviewers: [],
          created_at: '2026-05-01T00:00:00Z',
        },
      ])
      .mockResolvedValueOnce({
        check_runs: [
          { conclusion: 'success', status: 'completed' },
          { conclusion: null, status: 'in_progress' },
        ],
      })
      .mockResolvedValueOnce([]);

    batchedRequests.mockImplementation(async (items, fn) => Promise.all(items.map(fn)));
    const result = await fetchGitHubStatus(config, token);
    expect(result.prs[0].ciStatus).toBe('pending');
  });
});
```

- [ ] **Step 2: Run to confirm all tests fail**

```bash
cd /Users/Kamal_Syed/Projects/PlanVisualizer
npx jest tests/unit/fetch-github-status.test.js --no-coverage 2>&1 | tail -10
```

Expected: `Cannot find module '../../tools/lib/fetch-github-status'`

- [ ] **Step 3: Create `tools/lib/fetch-github-status.js`**

```js
// tools/lib/fetch-github-status.js
'use strict';
const { githubRequest, batchedRequests } = require('./github-client');

function summarizeCIStatus(checkRuns) {
  if (!checkRuns || checkRuns.length === 0) return null;
  const states = checkRuns.map((r) => r.conclusion || r.status);
  if (states.some((s) => s === 'failure' || s === 'timed_out' || s === 'cancelled')) return 'failure';
  if (states.some((s) => s === 'in_progress' || s === 'queued' || s === null)) return 'pending';
  if (states.every((s) => s === 'success' || s === 'skipped' || s === 'neutral')) return 'success';
  return 'pending';
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
      reviewCount: pr.requested_reviewers ? pr.requested_reviewers.length : 0,
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

module.exports = { fetchGitHubStatus };
```

- [ ] **Step 4: Run tests to confirm they pass**

```bash
npx jest tests/unit/fetch-github-status.test.js --no-coverage
```

Expected: all tests PASS

- [ ] **Step 5: Commit**

```bash
git add tools/lib/fetch-github-status.js tests/unit/fetch-github-status.test.js
git commit -m "feat: add fetch-github-status.js module with PR/CI/deployment fetch"
```

---

## Task 2: `timeAgo()` helper

**Files:**

- Modify: `tools/lib/render-utils.js`
- Modify: `tests/unit/render-utils.test.js`

- [ ] **Step 1: Write the failing tests**

Add to `tests/unit/render-utils.test.js` (find the existing describe block and append):

```js
describe('timeAgo', () => {
  const { timeAgo } = require('../../tools/lib/render-utils');

  test('returns empty string for null/undefined', () => {
    expect(timeAgo(null)).toBe('');
    expect(timeAgo(undefined)).toBe('');
    expect(timeAgo('')).toBe('');
  });

  test('returns "just now" for sub-minute timestamps', () => {
    const iso = new Date(Date.now() - 30000).toISOString();
    expect(timeAgo(iso)).toBe('just now');
  });

  test('returns Xm ago for minutes', () => {
    const iso = new Date(Date.now() - 5 * 60000).toISOString();
    expect(timeAgo(iso)).toBe('5m ago');
  });

  test('returns Xh ago for hours', () => {
    const iso = new Date(Date.now() - 3 * 3600000).toISOString();
    expect(timeAgo(iso)).toBe('3h ago');
  });

  test('returns >1d ago for older timestamps', () => {
    const iso = new Date(Date.now() - 25 * 3600000).toISOString();
    expect(timeAgo(iso)).toBe('>1d ago');
  });
});
```

- [ ] **Step 2: Run to confirm tests fail**

```bash
npx jest tests/unit/render-utils.test.js --no-coverage -t timeAgo 2>&1 | tail -5
```

Expected: `timeAgo is not a function`

- [ ] **Step 3: Add `timeAgo` to `render-utils.js`**

Open `tools/lib/render-utils.js`. Find the `module.exports` line at the bottom and add `timeAgo` to it. Add the function before `module.exports`:

```js
function timeAgo(isoString) {
  if (!isoString) return '';
  const diffMs = Date.now() - new Date(isoString).getTime();
  const diffMin = Math.floor(diffMs / 60000);
  if (diffMin < 1) return 'just now';
  if (diffMin < 60) return `${diffMin}m ago`;
  const diffHr = Math.floor(diffMin / 60);
  if (diffHr < 24) return `${diffHr}h ago`;
  return '>1d ago';
}
```

Add `timeAgo` to the existing `module.exports` object.

- [ ] **Step 4: Run tests to confirm pass**

```bash
npx jest tests/unit/render-utils.test.js --no-coverage -t timeAgo
```

Expected: all timeAgo tests PASS

- [ ] **Step 5: Commit**

```bash
git add tools/lib/render-utils.js tests/unit/render-utils.test.js
git commit -m "feat: add timeAgo() helper to render-utils"
```

---

## Task 3: Wire `fetchGitHubStatus` into `generate-plan.js`

**Files:**

- Modify: `tools/generate-plan.js`

- [ ] **Step 1: Add the require at the top of `generate-plan.js`**

After the existing `require` statements (around line 27), add:

```js
const { fetchGitHubStatus } = require('./lib/fetch-github-status');
```

- [ ] **Step 2: Make `main()` async**

Find the `function main()` declaration and change it to `async function main()`.

Find the bottom of the file where `main()` is called:

```js
try {
  main();
  if (process.argv.includes('--watch')) {
    watch(loadConfig());
  }
} catch (e) {
  console.error('[generate-plan] Fatal:', e.message);
  console.error('[generate-plan] Stack:', e.stack);
  process.exit(1);
}
```

Replace with:

```js
main()
  .then(() => {
    if (process.argv.includes('--watch')) {
      watch(loadConfig());
    }
  })
  .catch((e) => {
    console.error('[generate-plan] Fatal:', e.message);
    console.error('[generate-plan] Stack:', e.stack);
    process.exit(1);
  });
```

- [ ] **Step 3: Add the GitHub status fetch inside `main()`**

Find the existing GitHub sync block inside `main()` (around line 393):

```js
if (config.github && config.github.enabled) {
  require('child_process').execFileSync(process.execPath, [path.join(__dirname, 'sync-github.js')], {
```

After that entire `if` block, add:

```js
// GitHub status monitoring (read-only — fetches PR/CI/deployment state)
if (config.github && config.github.enabled && process.env.GITHUB_TOKEN) {
  try {
    data.githubStatus = await fetchGitHubStatus(config.github, process.env.GITHUB_TOKEN);
    console.log(
      '[generate-plan] GitHub status fetched:',
      data.githubStatus ? `${data.githubStatus.prs.length} PRs` : 'null',
    );
  } catch (e) {
    console.warn('[generate-plan] GitHub status fetch failed:', e.message);
    data.githubStatus = null;
  }
} else {
  data.githubStatus = null;
}
```

- [ ] **Step 4: Verify the generator still runs**

```bash
cd /Users/Kamal_Syed/Projects/PlanVisualizer
node tools/generate-plan.js 2>&1 | tail -5
```

Expected: `[generate-plan] Done. N epics, N stories...` (no errors; GitHub status fetch will be skipped if `GITHUB_TOKEN` is unset)

- [ ] **Step 5: Run the full test suite**

```bash
npx jest --no-coverage 2>&1 | tail -10
```

Expected: all existing tests still pass

- [ ] **Step 6: Commit**

```bash
git add tools/generate-plan.js
git commit -m "feat: wire fetchGitHubStatus into generate-plan.js"
```

---

## Task 4: GitHub chips in `renderMasthead()`

**Files:**

- Modify: `tools/lib/render-shell.js`
- Modify: `tests/unit/render-shell.test.js`

- [ ] **Step 1: Write the failing tests**

Find `tests/unit/render-shell.test.js`. Add a describe block for the GitHub chips:

```js
describe('renderMasthead GitHub chips', () => {
  const { renderMasthead } = require('../../tools/lib/render-shell');

  const baseData = {
    projectName: 'TestProject',
    release: 'R1',
    stories: [{ id: 'US-0001', status: 'Done' }],
    coverage: { available: true, overall: 90 },
    costs: { _totals: { costUsd: 100 }, 'US-0001': { projectedUsd: 200 } },
    bugs: [],
  };

  test('renders no GitHub chips when githubStatus is null', () => {
    const html = renderMasthead({ ...baseData, githubStatus: null });
    expect(html).not.toContain('PRs ✓ CI');
    expect(html).not.toContain('open PRs');
  });

  test('renders CI chip and open PRs chip when githubStatus is present', () => {
    const gs = {
      prs: [{ number: 1, ciStatus: 'success' }],
      ciSummary: { total: 1, passing: 1, failing: 0, pending: 0 },
      fetchedAt: new Date().toISOString(),
    };
    const html = renderMasthead({ ...baseData, githubStatus: gs });
    expect(html).toContain('1/1 PRs ✓ CI');
    expect(html).toContain('1 open PRs');
  });

  test('hides CI chip when total === 0', () => {
    const gs = {
      prs: [],
      ciSummary: { total: 0, passing: 0, failing: 0, pending: 0 },
      fetchedAt: new Date().toISOString(),
    };
    const html = renderMasthead({ ...baseData, githubStatus: gs });
    expect(html).not.toContain('PRs ✓ CI');
    expect(html).toContain('0 open PRs');
  });

  test('uses risk color when any CI failing', () => {
    const gs = {
      prs: [{ ciStatus: 'failure' }, { ciStatus: 'success' }],
      ciSummary: { total: 2, passing: 1, failing: 1, pending: 0 },
      fetchedAt: new Date().toISOString(),
    };
    const html = renderMasthead({ ...baseData, githubStatus: gs });
    expect(html).toContain('var(--risk)');
    expect(html).toContain('1/2 PRs ✓ CI');
  });
});
```

- [ ] **Step 2: Run to confirm tests fail**

```bash
npx jest tests/unit/render-shell.test.js --no-coverage -t "GitHub chips" 2>&1 | tail -5
```

Expected: tests fail (chip HTML not present yet)

- [ ] **Step 3: Add GitHub chips to `renderMasthead` in `render-shell.js`**

In `renderMasthead(data)`, add this computation near the top (after `openBugs`):

```js
const gs = data.githubStatus || null;
const ciChip = (() => {
  if (!gs || gs.ciSummary.total === 0) return '';
  const { passing, failing, pending, total } = gs.ciSummary;
  const color = failing > 0 ? 'var(--risk)' : pending > 0 ? 'var(--warn)' : 'var(--ok)';
  return `<div class="pv-meta-item pv-meta-item--hide-sm">
    <span class="pv-meta-lbl" style="color:${color}">${passing}/${total} PRs ✓ CI</span>
  </div>`;
})();
const prChip = gs
  ? `<div class="pv-meta-item pv-meta-item--hide-sm">
    <span class="pv-meta-lbl">Open PRs</span>
    <span class="pv-meta-val tnum">${gs.ciSummary.total}</span>
  </div>`
  : '';
```

Then in the returned HTML template, add `${ciChip}${prChip}` after the last existing `pv-meta-item` (the AI spend item):

```html
<div class="pv-meta-item pv-meta-item--hide-sm">
  <span class="pv-meta-lbl">AI spend</span>
  <span class="pv-meta-val tnum">${usd(totalAI)}</span>
</div>
${ciChip}${prChip}
```

- [ ] **Step 4: Run tests**

```bash
npx jest tests/unit/render-shell.test.js --no-coverage -t "GitHub chips"
```

Expected: all new tests PASS

- [ ] **Step 5: Full test suite**

```bash
npx jest --no-coverage 2>&1 | tail -5
```

Expected: all tests pass

- [ ] **Step 6: Commit**

```bash
git add tools/lib/render-shell.js tests/unit/render-shell.test.js
git commit -m "feat: add GitHub CI + open-PR chips to renderMasthead"
```

---

## Task 5: Status tab additions (deployment banner + CI tile + PR list)

**Files:**

- Modify: `tools/lib/render-tabs.js`
- Modify: `tests/unit/render-tabs.test.js`

- [ ] **Step 1: Write failing tests**

Add a describe block to `tests/unit/render-tabs.test.js`:

```js
describe('renderStatusTab GitHub surfaces', () => {
  const { renderStatusTab } = require('../../tools/lib/render-tabs');

  const baseData = () => ({
    projectName: 'Test',
    release: 'R1',
    stories: [
      { id: 'US-0001', status: 'Done', epicId: 'EPIC-0001', title: 'T', acs: [], priority: 'P1', estimate: 'S' },
    ],
    epics: [{ id: 'EPIC-0001', title: 'E', status: 'Done' }],
    bugs: [],
    testCases: [],
    lessons: [],
    coverage: { available: true, overall: 90 },
    costs: { _totals: { costUsd: 0 }, 'US-0001': { projectedUsd: 0 } },
    atRisk: {},
    risk: { byStory: new Map(), byEpic: new Map() },
    trends: null,
    completion: null,
    githubStatus: null,
  });

  test('deployment banner hidden when githubStatus is null', () => {
    const html = renderStatusTab(baseData());
    expect(html).not.toContain('pv-gh-deploy-banner');
  });

  test('deployment banner rendered when deployment present', () => {
    const data = baseData();
    data.githubStatus = {
      prs: [],
      ciSummary: { total: 0, passing: 0, failing: 0, pending: 0 },
      deployment: {
        environment: 'gh-pages',
        status: 'success',
        ref: 'v2.2.0',
        createdAt: new Date(Date.now() - 7200000).toISOString(),
        url: null,
      },
      fetchedAt: new Date().toISOString(),
    };
    const html = renderStatusTab(data);
    expect(html).toContain('pv-gh-deploy-banner');
    expect(html).toContain('v2.2.0');
    expect(html).toContain('gh-pages');
  });

  test('CI tile hidden when githubStatus is null', () => {
    const html = renderStatusTab(baseData());
    expect(html).not.toContain('CI STATUS');
  });

  test('CI tile rendered when githubStatus present with PRs', () => {
    const data = baseData();
    data.githubStatus = {
      prs: [
        {
          number: 1,
          ciStatus: 'success',
          storyId: 'US-0001',
          bugId: null,
          url: 'u',
          title: 't',
          reviewCount: 0,
          createdAt: new Date().toISOString(),
        },
      ],
      ciSummary: { total: 1, passing: 1, failing: 0, pending: 0 },
      deployment: null,
      fetchedAt: new Date().toISOString(),
    };
    const html = renderStatusTab(data);
    expect(html).toContain('CI STATUS');
    expect(html).toContain('Passing');
  });

  test('open PRs list rendered when PRs present', () => {
    const data = baseData();
    data.githubStatus = {
      prs: [
        {
          number: 994,
          ciStatus: 'success',
          storyId: 'US-0001',
          bugId: null,
          url: 'https://github.com/x/y/pull/994',
          title: 'feat: test',
          reviewCount: 1,
          createdAt: new Date().toISOString(),
        },
      ],
      ciSummary: { total: 1, passing: 1, failing: 0, pending: 0 },
      deployment: null,
      fetchedAt: new Date().toISOString(),
    };
    const html = renderStatusTab(data);
    expect(html).toContain('#994');
    expect(html).toContain('feat: test');
  });
});
```

- [ ] **Step 2: Run to confirm tests fail**

```bash
npx jest tests/unit/render-tabs.test.js --no-coverage -t "renderStatusTab GitHub" 2>&1 | tail -5
```

Expected: tests fail

- [ ] **Step 3: Add helpers to `render-tabs.js`**

Import `timeAgo` at the top of `render-tabs.js` — find the existing require line for `render-utils`:

```js
const {
  esc,
  jsEsc,
  usd,
  sparkline,
  deltaArrow,
  fmtNum,
  normalizeStoryRef,
  EPIC_ACCENT_COLORS,
  badge,
  BADGE_TONE,
} = require('./render-utils');
```

Add `timeAgo` to the destructured imports.

Add this local helper function near the top of `render-tabs.js` (after the require statements):

```js
function renderGhBadge(id, githubStatus) {
  if (!githubStatus || !githubStatus.prs) return '';
  const pr = githubStatus.prs.find((p) => p.storyId === id || p.bugId === id);
  if (!pr) return '';
  const ciClass = pr.ciStatus === 'success' ? 'ok' : pr.ciStatus === 'failure' ? 'risk' : 'warn';
  const ciLabel = pr.ciStatus === 'success' ? '✓' : pr.ciStatus === 'failure' ? '✗' : '⟳';
  return (
    `<span class="chip ${ciClass}" style="font-size:9px;padding:1px 5px">${ciLabel}</span>` +
    `<a href="${esc(pr.url)}" target="_blank" rel="noopener" style="font-size:10px;color:var(--plan-accent)">#${pr.number}&thinsp;→</a>`
  );
}
```

- [ ] **Step 4: Add deployment banner to `renderStatusTab`**

In `renderStatusTab`, find the line:

```js
    ${_renderFullStatusHero(data)}
```

Replace with:

```js
    ${_renderFullStatusHero(data)}
    ${(() => {
      const gs = data.githubStatus;
      if (!gs || !gs.deployment) return '';
      const d = gs.deployment;
      const statusClass = d.status === 'success' ? 'ok' : d.status === 'failure' ? 'risk' : 'warn';
      const statusDot = d.status === 'success' ? '●' : d.status === 'failure' ? '✗' : '⟳';
      return `<div class="pv-gh-deploy-banner card mb-4" style="display:flex;align-items:center;gap:10px;padding:8px 14px;font-size:12px;flex-wrap:wrap">
        <span style="font-weight:600;color:var(--plan-accent)">↑ Latest deployment</span>
        <span class="chip ${statusClass}" style="font-size:10px">${statusDot} ${esc(d.status)}</span>
        <span>${esc(d.ref)} → <code style="font-size:11px">${esc(d.environment)}</code></span>
        <span style="color:var(--text-mute)">${timeAgo(d.createdAt)}</span>
        ${d.url ? `<a href="${esc(d.url)}" target="_blank" rel="noopener" style="font-size:11px;color:var(--plan-accent)">view on GitHub →</a>` : ''}
        <span style="margin-left:auto;font-size:10px;color:var(--text-mute)">GitHub · last updated ${timeAgo(gs.fetchedAt)}</span>
      </div>`;
    })()}
```

- [ ] **Step 5: Add CI STATUS tile to `_renderFullStatusHero`**

In `_renderFullStatusHero`, find the kpiTiles IIFE. Specifically the line:

```js
    return `<div style="display:grid;grid-template-columns:repeat(4,1fr);gap:12px;margin-bottom:16px">
      ${kpiTile('Overall Progress', ...)}
      ${kpiTile('Test Coverage', ...)}
      ${kpiTile('Open Bugs', ...)}
      ${kpiTile('AI Spend', ...)}
    </div>`;
```

Replace the outer `return` with (note the dynamic grid columns):

```js
const gs = data.githubStatus;
const ciTile = gs
  ? (() => {
      const { passing, failing, pending, total } = gs.ciSummary;
      const ciColor = failing > 0 ? 'var(--risk)' : pending > 0 ? 'var(--warn)' : 'var(--ok)';
      const ciIcon = failing > 0 ? '⚠' : pending > 0 ? '⟳' : '●';
      const ciLabel = failing > 0 ? `${failing} failing` : pending > 0 ? 'Pending' : 'Passing';
      return `<div class="card" style="padding:14px 16px;position:relative;overflow:hidden">
            <div style="font-size:10px;font-weight:700;letter-spacing:.08em;text-transform:uppercase;color:var(--text-mute);margin-bottom:4px">CI STATUS</div>
            <div style="font-family:var(--font-display);font-size:clamp(18px,2vw,24px);font-weight:700;line-height:1;margin-bottom:5px;color:${ciColor}">${ciIcon} ${ciLabel}</div>
            <div style="font-size:12px;color:var(--text-mute)">${passing} / ${total} PRs passing</div>
          </div>`;
    })()
  : '';
const cols = gs ? 5 : 4;
return `<div style="display:grid;grid-template-columns:repeat(${cols},1fr);gap:12px;margin-bottom:16px">
      ${kpiTile('Overall Progress', donePctSeries[n - 1] || donePct, '%', lastDelta(donePctSeries), '%', donePctSeries, true)}
      ${kpiTile('Test Coverage', covSeries[n - 1] !== undefined ? covSeries[n - 1].toFixed(1) : covPct !== null ? covPct.toFixed(1) : '—', '%', lastDelta(covSeries), '%', covSeries, true)}
      ${kpiTile('Open Bugs', bugSeries[n - 1] !== undefined ? bugSeries[n - 1] : openBugs.length, '', lastDelta(bugSeries), '', bugSeries, false)}
      ${kpiTile('AI Spend', usd(costSeries[n - 1] || totalAI), '', +((costSeries[n - 1] || 0) - (costSeries[n - 2] || 0)).toFixed(2), '', costSeries, null)}
      ${ciTile}
    </div>`;
```

- [ ] **Step 6: Add the Open PRs list to `renderStatusTab`**

At the bottom of the `renderStatusTab` return template (before the closing `</div>` of `id="tab-status"`), add:

```js
    ${(() => {
      const gs = data.githubStatus;
      if (!gs || gs.prs.length === 0) return '';
      const rows = gs.prs.map((pr) => {
        const ciClass = pr.ciStatus === 'success' ? 'ok' : pr.ciStatus === 'failure' ? 'risk' : pr.ciStatus === 'pending' ? 'warn' : 'mute';
        const ciLabel = pr.ciStatus === 'success' ? '✓ CI' : pr.ciStatus === 'failure' ? '✗ CI' : pr.ciStatus === 'pending' ? '⟳ CI' : '— CI';
        return `<tr>
          <td><a href="${esc(pr.url)}" target="_blank" rel="noopener" style="color:var(--plan-accent)">#${pr.number}</a></td>
          <td>${esc(pr.title)}</td>
          <td><span class="chip ${ciClass}" style="font-size:9px">${ciLabel}</span></td>
          <td>${pr.reviewCount}</td>
          <td style="color:var(--text-mute)">${timeAgo(pr.createdAt)}</td>
        </tr>`;
      }).join('');
      return `<details class="card mb-4" style="padding:0">
        <summary style="padding:10px 14px;cursor:pointer;font-size:11px;font-weight:700;letter-spacing:.06em;text-transform:uppercase;color:var(--text-mute)">
          Open Pull Requests (${gs.prs.length}) · GitHub · last updated ${timeAgo(gs.fetchedAt)}
        </summary>
        <table style="width:100%;font-size:12px;border-collapse:collapse">
          <thead><tr style="font-size:10px;text-transform:uppercase;letter-spacing:.06em;color:var(--text-mute)">
            <th style="padding:6px 14px;text-align:left">PR</th>
            <th style="padding:6px 14px;text-align:left">Title</th>
            <th style="padding:6px 14px;text-align:left">CI</th>
            <th style="padding:6px 14px;text-align:left">Reviews</th>
            <th style="padding:6px 14px;text-align:left">Age</th>
          </tr></thead>
          <tbody>${rows}</tbody>
        </table>
      </details>`;
    })()}
```

- [ ] **Step 7: Run new tests**

```bash
npx jest tests/unit/render-tabs.test.js --no-coverage -t "renderStatusTab GitHub"
```

Expected: all new tests PASS

- [ ] **Step 8: Full test suite**

```bash
npx jest --no-coverage 2>&1 | tail -5
```

Expected: all tests pass

- [ ] **Step 9: Commit**

```bash
git add tools/lib/render-tabs.js tests/unit/render-tabs.test.js
git commit -m "feat: add GitHub deployment banner, CI tile, and PR list to Status tab"
```

---

## Task 6: Story row CI badges (Hierarchy + Kanban)

**Files:**

- Modify: `tools/lib/render-tabs.js`
- Modify: `tests/unit/render-tabs.test.js`

- [ ] **Step 1: Write failing tests**

Add to the `tests/unit/render-tabs.test.js` describe block for Hierarchy:

```js
describe('renderHierarchyTab GitHub badges', () => {
  const { renderHierarchyTab } = require('../../tools/lib/render-tabs');

  const baseData = () => ({
    projectName: 'Test',
    release: 'R1',
    stories: [
      {
        id: 'US-0001',
        status: 'In Progress',
        epicId: 'EPIC-0001',
        title: 'My story',
        acs: [],
        priority: 'P1',
        estimate: 'S',
      },
    ],
    epics: [{ id: 'EPIC-0001', title: 'Epic One', status: 'In Progress' }],
    bugs: [],
    testCases: [],
    lessons: [],
    coverage: { available: false },
    costs: { 'US-0001': { projectedUsd: 0 } },
    atRisk: { 'US-0001': { isAtRisk: false } },
    risk: { byStory: new Map(), byEpic: new Map() },
    githubStatus: null,
  });

  test('no badge when githubStatus is null', () => {
    const html = renderHierarchyTab(baseData());
    expect(html).not.toContain('→</a>');
  });

  test('renders CI badge and PR link for matched story', () => {
    const data = baseData();
    data.githubStatus = {
      prs: [
        {
          number: 994,
          ciStatus: 'success',
          storyId: 'US-0001',
          bugId: null,
          url: 'https://github.com/x/y/pull/994',
          title: 't',
          reviewCount: 0,
          createdAt: new Date().toISOString(),
        },
      ],
      ciSummary: { total: 1, passing: 1, failing: 0, pending: 0 },
      fetchedAt: new Date().toISOString(),
    };
    const html = renderHierarchyTab(data);
    expect(html).toContain('#994');
    expect(html).toContain('class="chip ok"');
  });

  test('no badge for unmatched story', () => {
    const data = baseData();
    data.githubStatus = {
      prs: [
        {
          number: 999,
          ciStatus: 'success',
          storyId: 'US-9999',
          bugId: null,
          url: 'u',
          title: 't',
          reviewCount: 0,
          createdAt: new Date().toISOString(),
        },
      ],
      ciSummary: { total: 1, passing: 1, failing: 0, pending: 0 },
      fetchedAt: new Date().toISOString(),
    };
    const html = renderHierarchyTab(data);
    expect(html).not.toContain('#999');
  });
});
```

- [ ] **Step 2: Run to confirm tests fail**

```bash
npx jest tests/unit/render-tabs.test.js --no-coverage -t "renderHierarchyTab GitHub" 2>&1 | tail -5
```

Expected: tests fail

- [ ] **Step 3: Add badge to the Hierarchy list-view story row**

In `render-tabs.js`, find the story row HTML for the list view. Locate:

```js
          <span class="ml-auto text-xs text-slate-500">${esc(story.estimate || '?')} · ${usd(...)}</span>
```

Replace with:

```js
          ${renderGhBadge(story.id, data.githubStatus)}
          <span class="ml-auto text-xs text-slate-500">${esc(story.estimate || '?')} · ${usd(...)}</span>
```

- [ ] **Step 4: Add badge to Hierarchy card-view story card**

Find the card-view row's footer flex div (the one with `mt-auto pt-1 text-xs`). Locate:

```js
<span class="ml-auto">${riskBadge}</span>
```

Add before it:

```js
          ${renderGhBadge(story.id, data.githubStatus)}
```

- [ ] **Step 5: Run tests**

```bash
npx jest tests/unit/render-tabs.test.js --no-coverage -t "renderHierarchyTab GitHub"
```

Expected: all new tests PASS

- [ ] **Step 6: Full test suite**

```bash
npx jest --no-coverage 2>&1 | tail -5
```

Expected: all tests pass

- [ ] **Step 7: Commit**

```bash
git add tools/lib/render-tabs.js tests/unit/render-tabs.test.js
git commit -m "feat: add inline GitHub CI badges to Hierarchy story rows"
```

---

## Task 7: `github-status` handler in `update-sdlc-status.js`

**Files:**

- Modify: `tools/update-sdlc-status.js`
- Modify: `tests/unit/update-sdlc-status.test.js`

- [ ] **Step 1: Write failing tests**

Add a describe block to `tests/unit/update-sdlc-status.test.js`:

```js
describe('HANDLERS[github-status]', () => {
  jest.mock('../../tools/lib/fetch-github-status');
  const { fetchGitHubStatus } = require('../../tools/lib/fetch-github-status');
  const { HANDLERS } = require('../../tools/update-sdlc-status');

  function baseData() {
    return { githubStatus: null, log: [], metrics: {} };
  }

  beforeEach(() => jest.clearAllMocks());

  test('sets githubStatus on data', async () => {
    const gs = {
      prs: [],
      ciSummary: { total: 0, passing: 0, failing: 0, pending: 0 },
      deployment: null,
      fetchedAt: '2026-05-07T10:00:00Z',
    };
    fetchGitHubStatus.mockResolvedValue(gs);
    const data = baseData();
    const result = await HANDLERS['github-status'](data, { token: 'tok' });
    expect(result.githubStatus).toMatchObject({ ciSummary: { total: 0 }, fetchedAt: '2026-05-07T10:00:00Z' });
  });

  test('returns data unchanged when fetch returns null', async () => {
    fetchGitHubStatus.mockResolvedValue(null);
    const data = baseData();
    const result = await HANDLERS['github-status'](data, { token: 'tok' });
    expect(result.githubStatus).toBeNull();
    expect(result.log).toHaveLength(0);
  });

  test('sets ciPollUntil when any PR is pending', async () => {
    fetchGitHubStatus.mockResolvedValue({
      prs: [
        {
          number: 1,
          ciStatus: 'pending',
          storyId: null,
          bugId: null,
          url: 'u',
          title: 't',
          reviewCount: 0,
          createdAt: '2026-05-07T00:00:00Z',
        },
      ],
      ciSummary: { total: 1, passing: 0, failing: 0, pending: 1 },
      deployment: null,
      fetchedAt: new Date().toISOString(),
    });
    const data = baseData();
    const result = await HANDLERS['github-status'](data, { token: 'tok' });
    expect(result.githubStatus.ciPollUntil).toBeTruthy();
    const pollUntil = new Date(result.githubStatus.ciPollUntil);
    expect(pollUntil.getTime()).toBeGreaterThan(Date.now() + 14 * 60000);
  });

  test('clears ciPollUntil when no PR is pending', async () => {
    fetchGitHubStatus.mockResolvedValue({
      prs: [
        {
          number: 1,
          ciStatus: 'success',
          storyId: null,
          bugId: null,
          url: 'u',
          title: 't',
          reviewCount: 0,
          createdAt: '2026-05-07T00:00:00Z',
        },
      ],
      ciSummary: { total: 1, passing: 1, failing: 0, pending: 0 },
      deployment: null,
      fetchedAt: new Date().toISOString(),
    });
    const data = { ...baseData(), githubStatus: { ciPollUntil: '2026-05-07T12:00:00Z' } };
    const result = await HANDLERS['github-status'](data, { token: 'tok' });
    expect(result.githubStatus.ciPollUntil).toBeNull();
  });

  test('emits CI resolved event on pending → success transition', async () => {
    fetchGitHubStatus.mockResolvedValue({
      prs: [
        {
          number: 99,
          ciStatus: 'success',
          storyId: 'US-0001',
          bugId: null,
          url: 'u',
          title: 't',
          reviewCount: 0,
          createdAt: '2026-05-07T00:00:00Z',
        },
      ],
      ciSummary: { total: 1, passing: 1, failing: 0, pending: 0 },
      deployment: null,
      fetchedAt: new Date().toISOString(),
    });
    const data = {
      ...baseData(),
      githubStatus: {
        prs: [{ number: 99, ciStatus: 'pending' }],
        deployment: null,
        fetchedAt: '2026-05-07T09:00:00Z',
      },
      log: [],
    };
    const result = await HANDLERS['github-status'](data, { token: 'tok' });
    const ciEvent = result.log.find((e) => e.message && e.message.includes('#99'));
    expect(ciEvent).toBeTruthy();
    expect(ciEvent.message).toMatch(/CI.*passed|✓/i);
  });

  test('emits PR opened event for new PR', async () => {
    fetchGitHubStatus.mockResolvedValue({
      prs: [
        {
          number: 100,
          ciStatus: null,
          storyId: null,
          bugId: null,
          url: 'u',
          title: 'new PR',
          reviewCount: 0,
          createdAt: '2026-05-07T00:00:00Z',
        },
      ],
      ciSummary: { total: 1, passing: 0, failing: 0, pending: 0 },
      deployment: null,
      fetchedAt: new Date().toISOString(),
    });
    const data = { ...baseData(), githubStatus: { prs: [], deployment: null } };
    const result = await HANDLERS['github-status'](data, { token: 'tok' });
    const evt = result.log.find((e) => e.message && e.message.includes('#100'));
    expect(evt).toBeTruthy();
    expect(evt.message).toMatch(/opened/i);
  });
});
```

- [ ] **Step 2: Run to confirm tests fail**

```bash
npx jest tests/unit/update-sdlc-status.test.js --no-coverage -t "github-status" 2>&1 | tail -10
```

Expected: tests fail (handler not yet defined)

- [ ] **Step 3: Add the handler to `update-sdlc-status.js`**

At the top of the file, after the existing `require` statements, add:

```js
const { fetchGitHubStatus } = require('./lib/fetch-github-status');
```

Also add a require for the config reader (to get `github.repo`):

```js
const CONFIG_PATH = path.join(__dirname, '..', 'plan-visualizer.config.json');
```

Add to the `HANDLERS` object (at the end, before the closing `}`):

```js
  'github-status': async (data, opts) => {
    const token = opts.token || process.env.GITHUB_TOKEN;
    let config = null;
    try {
      config = JSON.parse(fs.readFileSync(CONFIG_PATH, 'utf8')).github;
    } catch (_) {}
    const newStatus = await fetchGitHubStatus(config, token);
    if (!newStatus) return data;

    const prev = data.githubStatus;
    const prevPrMap = prev && prev.prs ? new Map(prev.prs.map((p) => [p.number, p])) : new Map();

    // Change detection: CI transitions
    for (const pr of newStatus.prs) {
      const old = prevPrMap.get(pr.number);
      if (!old) {
        appendLog(data, 'GitHub', `PR #${pr.number} opened: ${pr.title}`, 'gh-pr');
      } else if (
        old.ciStatus === 'pending' &&
        (pr.ciStatus === 'success' || pr.ciStatus === 'failure')
      ) {
        const icon = pr.ciStatus === 'success' ? '✓' : '✗';
        appendLog(data, 'GitHub', `CI ${icon} ${pr.ciStatus} on #${pr.number}`, `gh-ci`);
      }
    }
    // PRs that disappeared (merged/closed)
    for (const [num] of prevPrMap) {
      if (!newStatus.prs.find((p) => p.number === num)) {
        appendLog(data, 'GitHub', `PR #${num} merged/closed`, 'gh-pr-merged');
      }
    }
    // Deployment status change
    if (prev && prev.deployment && newStatus.deployment) {
      if (
        prev.deployment.status !== newStatus.deployment.status &&
        (newStatus.deployment.status === 'success' || newStatus.deployment.status === 'failure')
      ) {
        const icon = newStatus.deployment.status === 'success' ? '↑' : '✗';
        appendLog(data, 'GitHub', `${icon} deployed ${newStatus.deployment.ref} → ${newStatus.deployment.environment}`, 'gh-deploy');
      }
    }

    // ciPollUntil: set when any PR is pending, clear when all terminal
    const hasPending = newStatus.prs.some((p) => p.ciStatus === 'pending');
    newStatus.ciPollUntil = hasPending ? new Date(Date.now() + 15 * 60 * 1000).toISOString() : null;

    data.githubStatus = newStatus;
    return data;
  },
```

- [ ] **Step 4: Run new tests**

```bash
npx jest tests/unit/update-sdlc-status.test.js --no-coverage -t "github-status"
```

Expected: all new tests PASS

- [ ] **Step 5: Full test suite**

```bash
npx jest --no-coverage 2>&1 | tail -5
```

Expected: all tests pass

- [ ] **Step 6: Commit**

```bash
git add tools/update-sdlc-status.js tests/unit/update-sdlc-status.test.js
git commit -m "feat: add async github-status handler to update-sdlc-status"
```

---

## Task 8: GITHUB sidebar widget + Needs Attention in `generate-dashboard.js`

**Files:**

- Modify: `tools/generate-dashboard.js`

- [ ] **Step 1: Add the GITHUB sidebar widget**

In `generate-dashboard.js`, find the `mc-sidebar` block that contains `<!-- NEEDS ATTENTION panel -->` and `<!-- EVENT LOG panel -->`. Add a new panel between them:

```js
  <!-- GITHUB sidebar widget -->
  ${(() => {
    const gs = sdlcStatus && sdlcStatus.githubStatus;
    if (!gs) return `
  <div class="mc-sidebar-panel">
    <div class="mc-sidebar-title">GITHUB</div>
    <div style="font-size:11px;color:var(--mc-muted);font-style:italic;">Starting up — no data yet</div>
  </div>`;
    const prRows = (gs.prs || []).slice(0, 4).map((pr) => {
      const color = pr.ciStatus === 'success' ? 'var(--ok)' : pr.ciStatus === 'failure' ? 'var(--risk)' : 'var(--mc-muted)';
      return `<div style="font-size:11px;color:var(--mc-muted);margin-bottom:2px">
        <a href="${escH(pr.url)}" target="_blank" rel="noopener" style="color:var(--info)">#${pr.number}</a>
        <span style="color:${color}">${pr.ciStatus === 'success' ? '✓' : pr.ciStatus === 'failure' ? '✗' : '⟳'}</span>
        ${escH(pr.title.slice(0, 32))}${pr.title.length > 32 ? '…' : ''}
      </div>`;
    }).join('');
    const deployLine = gs.deployment
      ? `<div style="font-size:10px;color:var(--mc-dim);margin-top:4px">↑ ${escH(gs.deployment.ref)} · ${escH(gs.deployment.environment)}</div>`
      : '';
    const staleLabel = gs.fetchedAt
      ? `<div style="font-size:9px;color:var(--mc-dim);margin-top:4px">last updated ${escH(timeAgoJS(gs.fetchedAt))}</div>`
      : '';
    return `
  <div class="mc-sidebar-panel">
    <div class="mc-sidebar-title">GITHUB</div>
    ${prRows || '<div style="font-size:11px;color:var(--mc-muted);font-style:italic;">No open PRs</div>'}
    ${deployLine}
    ${staleLabel}
  </div>`;
  })()}
```

**Note:** `escH` and a `timeAgoJS` helper are used here because this is inside a template literal in a JS file rendered server-side. `escH` is the existing HTML-escaping function already defined in `generate-dashboard.js`. Add `timeAgoJS` near the top of `generate-dashboard.js`, before the template literal (this is server-side formatting, separate from the client-side `escH`):

```js
function timeAgoJS(isoString) {
  if (!isoString) return '';
  const diffMs = Date.now() - new Date(isoString).getTime();
  const diffMin = Math.floor(diffMs / 60000);
  if (diffMin < 1) return 'just now';
  if (diffMin < 60) return `${diffMin}m ago`;
  const diffHr = Math.floor(diffMin / 60);
  if (diffHr < 24) return `${diffHr}h ago`;
  return '>1d ago';
}
```

- [ ] **Step 2: Add "N PRs need review" to Needs Attention**

In the NEEDS ATTENTION panel, find the line that builds `mc-attn-chips`:

```js
`<div class="mc-attn-chips">
        <span class="mc-attn-chip${blockedCount > 0 ? ' risk' : ''}">${blockedCount} blocked</span>
        <span class="mc-attn-chip${reviewCount > 0 ? ' info' : ''}">${reviewCount} review</span>
        <span class="mc-attn-chip${bugsCount > 0 ? ' warn' : ''}">${bugsCount} bugs</span>
      </div>`;
```

Replace with:

```js
(() => {
  const gs = sdlcStatus && sdlcStatus.githubStatus;
  const prsNeedingReview = gs ? (gs.prs || []).filter((p) => p.reviewCount === 0).length : 0;
  return `<div class="mc-attn-chips">
          <span class="mc-attn-chip${blockedCount > 0 ? ' risk' : ''}">${blockedCount} blocked</span>
          <span class="mc-attn-chip${reviewCount > 0 ? ' info' : ''}">${reviewCount} review</span>
          <span class="mc-attn-chip${bugsCount > 0 ? ' warn' : ''}">${bugsCount} bugs</span>
          ${prsNeedingReview > 0 ? `<span class="mc-attn-chip warn">${prsNeedingReview} PRs need review</span>` : ''}
        </div>`;
})();
```

- [ ] **Step 3: Regenerate dashboard and visually verify sidebar widget appears**

```bash
node tools/generate-dashboard.js 2>&1 | tail -3
```

Open `docs/dashboard.html` in a browser and verify the GITHUB sidebar panel is visible (showing "Starting up — no data yet" if `sdlc-status.json` has no `githubStatus`).

- [ ] **Step 4: Commit**

```bash
git add tools/generate-dashboard.js
git commit -m "feat: add GITHUB sidebar widget and Needs Attention PR review chip to dashboard"
```

---

## Task 9: Live bar CI chip

**Files:**

- Modify: `tools/generate-dashboard.js`

- [ ] **Step 1: Add CI chip to the live bar**

Find the live bar HTML in `generate-dashboard.js` (around line 2113):

```html
<div class="pv-live-bar" id="pv-live-bar" role="status" aria-live="polite" style="display:none;">
  <div class="pv-live-col-left">
    <span class="pv-on-air">ON AIR</span>
  </div>
  <div class="pv-live-col-mid">
    <div class="pv-live-exec-lbl">NOW EXECUTING</div>
    <div class="pv-live-cycle" id="pv-live-cycle">CYCLE — · —:——</div>
  </div>
</div>
```

Add a CI chip element inside `pv-live-col-left`, after the `ON AIR` span:

```html
<div class="pv-live-col-left">
  <span class="pv-on-air">ON AIR</span>
  ${(() => { const gs = sdlcStatus && sdlcStatus.githubStatus; if (!gs || gs.ciSummary.total === 0) return ''; const {
  failing, pending } = gs.ciSummary; const color = failing > 0 ? 'var(--risk)' : pending > 0 ? 'var(--warn)' :
  'var(--ok)'; const label = failing > 0 ? '✗ CI' : pending > 0 ? '⟳ CI' : '✓ CI'; return `<span
    id="pv-lb-ci-chip"
    style="font-size:10px;font-weight:700;padding:2px 8px;border-radius:20px;background:color-mix(in oklab,${color} 15%,transparent);color:${color};border:1px solid color-mix(in oklab,${color} 40%,transparent)"
    >${label}</span
  >`; })()}
</div>
```

- [ ] **Step 2: Verify HTML generation**

```bash
node tools/generate-dashboard.js 2>&1 | tail -3
grep -c "pv-lb-ci-chip" docs/dashboard.html
```

Expected: `0` (no `githubStatus` in sdlc-status.json yet — chip is conditionally rendered)

- [ ] **Step 3: Commit**

```bash
git add tools/generate-dashboard.js
git commit -m "feat: add live bar CI chip to agentic dashboard"
```

---

## Task 10: Event log GitHub events + poll-until loop

**Files:**

- Modify: `tools/generate-dashboard.js`

- [ ] **Step 1: Event log already handles GitHub events**

The existing event log renders all entries from `sdlcStatus.log`. The `github-status` handler (Task 7) already appends events with `agent: 'GitHub'` using `appendLog`. The Event Log renders `entry.agent` as the card header.

To visually differentiate GitHub events with an indigo left-border, find the `mc-evt-card` template in the event log rendering:

```js
      return `      <div class="mc-evt-card">
```

Replace with:

```js
      const isGh = (entry.agent || '').toLowerCase() === 'github';
      return `      <div class="mc-evt-card" style="${isGh ? 'border-left:3px solid oklch(60% 0.18 260)' : ''}">
```

- [ ] **Step 2: Add the poll-until loop to `--watch` mode**

In `generate-dashboard.js`, find the `--watch` block. It contains a `fs.watch(STATUS_PATH, ...)` call. After the `fs.watch` call, add:

```js
// CI poll-until loop: keeps CI status fresh while checks are pending
const { HANDLERS: sdlcHandlers } = require('./update-sdlc-status');
const { atomicReadModifyWriteJson: atomicRMW } = require('../orchestrator/atomic-write');

let _pollTimer = null;

function _managePollTimer() {
  let sdlc;
  try {
    sdlc = JSON.parse(fs.readFileSync(STATUS_PATH, 'utf8'));
  } catch (_) {
    return;
  }
  const gs = sdlc && sdlc.githubStatus;
  const shouldPoll =
    gs &&
    gs.ciPollUntil &&
    new Date(gs.ciPollUntil) > new Date() &&
    gs.prs &&
    gs.prs.some((p) => p.ciStatus === 'pending');

  if (shouldPoll && !_pollTimer) {
    _pollTimer = setInterval(async () => {
      try {
        await atomicRMW(STATUS_PATH, (data) =>
          sdlcHandlers['github-status'](data, { token: process.env.GITHUB_TOKEN }),
        );
      } catch (e) {
        console.warn('[generate-dashboard] poll-until failed:', e.message);
      }
      _managePollTimer(); // re-evaluate after each poll
    }, 60000);
    console.log('[generate-dashboard] CI poll-until loop started');
  } else if (!shouldPoll && _pollTimer) {
    clearInterval(_pollTimer);
    _pollTimer = null;
    console.log('[generate-dashboard] CI poll-until loop stopped');
  }
}

// Wire into the existing fs.watch callback — call _managePollTimer after each re-generation
```

Find the `fs.watch` callback and add `_managePollTimer()` at the end of it:

```js
fs.watch(STATUS_PATH, () => {
  // ... existing regeneration code ...
  generateHTML();
  _managePollTimer(); // ← add this line
});

// Also call once on startup
_managePollTimer();
```

- [ ] **Step 3: Verify no errors in watch mode startup**

```bash
node tools/generate-dashboard.js --watch &
sleep 3 && kill %1
```

Expected: starts without error, prints `[generate-dashboard] CI poll-until loop` only if `ciPollUntil` is set in sdlc-status.json

- [ ] **Step 4: Full test suite**

```bash
npx jest --no-coverage 2>&1 | tail -10
```

Expected: all tests pass, coverage ≥ 80%

```bash
npx jest --coverage 2>&1 | grep "All files"
```

Expected: Stmts coverage ≥ 80%

- [ ] **Step 5: Commit**

```bash
git add tools/generate-dashboard.js
git commit -m "feat: add GitHub event log styling and CI poll-until loop to dashboard watch mode"
```

---

## End-to-end smoke test

After all tasks are complete:

- [ ] Set `GITHUB_TOKEN` to a valid PAT with `repo` scope and verify `config.github.enabled = true` in `plan-visualizer.config.json`
- [ ] Run `node tools/generate-plan.js` and confirm `[generate-plan] GitHub status fetched: N PRs` in output
- [ ] Open `docs/plan-status.html` — verify CI chip appears in masthead, deployment banner in Status tab, PR badges on story rows in Hierarchy
- [ ] Run `node tools/update-sdlc-status.js github-status` and confirm no errors; verify `docs/sdlc-status.json` has a `githubStatus` key
- [ ] Run `node tools/generate-dashboard.js` and open `docs/dashboard.html` — verify GITHUB sidebar widget shows PR list
