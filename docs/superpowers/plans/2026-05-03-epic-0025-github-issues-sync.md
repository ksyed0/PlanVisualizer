# EPIC-0025 GitHub Issues Sync — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add optional bidirectional sync between BUGS.md/RELEASE_PLAN.md and GitHub Issues, with a Settings tab in plan-status.html to configure and monitor it.

**Architecture:** Four independent work streams shipped as separate PRs in order: US-0170 (ID regex fix, prerequisite) → US-0171 (core sync engine) → US-0173 (story sync extension) → US-0172 (Settings UI). The sync engine is a standalone CLI (`tools/sync-github.js`) called at the end of `generate-plan.js::main()` when `config.github.enabled` is true.

**Tech Stack:** Node.js `https` (no extra runtime deps), Jest 29, GitHub REST API v2022-11-28, existing `orchestrator/atomic-write.js` for atomic file writes and ID allocation.

---

## Work Stream 0 — US-0170: Remove 4-digit ID cap (prerequisite, ship first)

**Branch:** `feature/US-0170-id-regex-variable-length`

```bash
git checkout develop && git pull origin develop
git checkout -b feature/US-0170-id-regex-variable-length
```

**Files:**

- Modify: `tools/lib/parse-bugs.js`
- Modify: `tools/lib/parse-release-plan.js`
- Modify: `tools/lib/parse-test-cases.js`
- Modify: `tools/lib/parse-lessons.js`
- Modify: `tools/lib/render-utils.js`
- Modify: `tools/lib/compute-risk.js`
- Modify: `docs/ID_REGISTRY.md`

---

### Task 0.1: Write failing tests for 5-digit IDs

**File:** `tests/unit/render-tabs.test.js` (append to existing file)

- [ ] **Step 1: Add test**

```js
describe('US-0170: variable-length artefact IDs', () => {
  it('normalizeStoryRef handles 5-digit US IDs (US-10000)', () => {
    const { normalizeStoryRef } = require('../../tools/lib/render-utils');
    expect(normalizeStoryRef('US-10000')).toBe('US-10000');
    expect(normalizeStoryRef('US-10000 (some title)')).toBe('US-10000');
  });
});
```

- [ ] **Step 2: Run to confirm failure**

```bash
cd /Users/Kamal_Syed/Projects/PlanVisualizer
npx jest tests/unit/render-tabs.test.js -t "US-0170" 2>&1 | tail -10
```

Expected: FAIL — `normalizeStoryRef('US-10000')` returns `null` because the current regex requires exactly 4 digits.

---

### Task 0.2: Fix regex in all 6 files

Run this to find all the patterns that need updating:

```bash
grep -rn "\\\\d{4}" tools/lib/ --include="*.js"
```

- [ ] **Step 1: Fix `tools/lib/render-utils.js`** — find `normalizeStoryRef`:

```bash
grep -n "normalizeStoryRef\|US-\\\\d" tools/lib/render-utils.js | head -5
```

Find the regex like `/US-\d{4}/` and change `\d{4}` to `\d+`:

```js
// Before:
function normalizeStoryRef(ref) {
  if (!ref) return null;
  const m = String(ref).match(/US-\d{4}/);
  return m ? m[0] : null;
}

// After:
function normalizeStoryRef(ref) {
  if (!ref) return null;
  const m = String(ref).match(/US-\d+/);
  return m ? m[0] : null;
}
```

- [ ] **Step 2: Fix `tools/lib/compute-risk.js`** — find `_normalizeRef`:

```bash
grep -n "_normalizeRef\|US-\\\\d" tools/lib/compute-risk.js | head -5
```

Same change: `/US-\d{4}/` → `/US-\d+/`

- [ ] **Step 3: Fix `tools/lib/parse-bugs.js`** — find BUG ID regex:

```bash
grep -n "BUG-\\\\d\|\\\\d{4}" tools/lib/parse-bugs.js | head -10
```

Change any `\d{4}` pattern in BUG-ID regexes to `\d+`.

- [ ] **Step 4: Fix `tools/lib/parse-release-plan.js`** — US/EPIC/TASK/AC patterns:

```bash
grep -n "\\\\d{4}" tools/lib/parse-release-plan.js | head -15
```

Change all `\d{4}` occurrences to `\d+`.

- [ ] **Step 5: Fix `tools/lib/parse-test-cases.js`** — TC patterns:

```bash
grep -n "\\\\d{4}" tools/lib/parse-test-cases.js | head -10
```

Change `\d{4}` → `\d+`.

- [ ] **Step 6: Fix `tools/lib/parse-lessons.js`** — L-XXXX patterns:

```bash
grep -n "\\\\d{4}" tools/lib/parse-lessons.js | head -10
```

Change `\d{4}` → `\d+`.

- [ ] **Step 7: Update `docs/ID_REGISTRY.md` — add note on zero-padding**

Find the Rules section and add a line:

```markdown
- Zero-padding to 4 digits is cosmetic. IDs beyond 9999 use 5+ digits naturally (e.g. AC-10000). All parser regexes accept variable-length digit sequences.
```

---

### Task 0.3: Run tests and open PR

- [ ] **Step 1: Run new tests**

```bash
npx jest tests/unit/render-tabs.test.js -t "US-0170" 2>&1 | tail -10
```

Expected: PASS.

- [ ] **Step 2: Run full suite**

```bash
npx jest --coverage 2>&1 | tail -5
```

Expected: all pass, coverage ≥ 80%.

- [ ] **Step 3: Update RELEASE_PLAN.md** — find US-0170 (Status: Planned) and set Status: Done, Branch: feature/US-0170-id-regex-variable-length, check AC-0611–AC-0614.

- [ ] **Step 4: Commit and open PR**

```bash
git add tools/lib/parse-bugs.js tools/lib/parse-release-plan.js tools/lib/parse-test-cases.js \
        tools/lib/parse-lessons.js tools/lib/render-utils.js tools/lib/compute-risk.js \
        docs/ID_REGISTRY.md tests/unit/render-tabs.test.js docs/RELEASE_PLAN.md
git commit -m "feat: US-0170 — variable-length artefact IDs, remove 4-digit regex cap"
git push -u origin feature/US-0170-id-regex-variable-length
gh pr create --title "feat: US-0170 — Remove 4-digit artefact ID cap" \
  --body "$(cat <<'EOF'
## Summary
- 6 parser/render files: all \\d{4} artefact ID regexes changed to \\d+
- IDs beyond 9999 (e.g. AC-10000) now parse and render correctly
- Existing 4-digit IDs unchanged
- ID_REGISTRY.md documents variable-length convention

## Test plan
- [ ] All tests pass
- [ ] Coverage >= 80%
- [ ] CI green

🤖 Generated with [Claude Code](https://claude.com/claude-code)
EOF
)"
gh pr merge --auto --squash --delete-branch
```

---

## Work Stream 1 — US-0171: Core Sync Engine

**Branch:** `feature/US-0171-github-sync-engine`

> Wait for US-0170 to merge first, then: `git checkout develop && git pull origin develop`

```bash
git checkout -b feature/US-0171-github-sync-engine
```

**Files:**

- Create: `tools/lib/github-client.js`
- Create: `tools/lib/sync-bugs.js`
- Create: `tools/sync-github.js`
- Modify: `tools/generate-plan.js:379-383` (add sync call after HTML write)
- Modify: `plan-visualizer.config.json` (add github block)
- Create: `tests/unit/github-client.test.js`
- Create: `tests/unit/sync-bugs.test.js`

---

### Task 1.1: `github-client.js` — thin GitHub REST wrapper

- [ ] **Step 1: Write failing tests** — Create `tests/unit/github-client.test.js`:

```js
'use strict';
const { buildIssueBody, buildIssueTitle } = require('../../tools/lib/github-client');

describe('github-client — buildIssueTitle', () => {
  it('formats BUG ID correctly', () => {
    expect(buildIssueTitle('BUG-0253', 'Session fails silently')).toBe('[BUG-0253] Session fails silently');
  });

  it('formats US ID correctly', () => {
    expect(buildIssueTitle('US-0171', 'GitHub sync engine')).toBe('[US-0171] GitHub sync engine');
  });
});

describe('github-client — buildIssueBody', () => {
  it('includes steps, expected, actual when provided', () => {
    const bug = {
      id: 'BUG-0253',
      title: 'Session fails',
      severity: 'High',
      status: 'Open',
      stepsToReproduce: '1. Do X',
      expected: 'Works',
      actual: 'Crashes',
    };
    const body = buildIssueBody(bug);
    expect(body).toContain('Steps to Reproduce');
    expect(body).toContain('1. Do X');
    expect(body).toContain('Expected');
    expect(body).toContain('Works');
    expect(body).toContain('Actual');
    expect(body).toContain('Crashes');
    expect(body).toContain('BUG-0253');
  });

  it('handles missing fields gracefully', () => {
    const bug = { id: 'BUG-0254', title: 'Crash', severity: 'Low', status: 'Open' };
    expect(() => buildIssueBody(bug)).not.toThrow();
  });
});
```

- [ ] **Step 2: Run to confirm failure**

```bash
npx jest tests/unit/github-client.test.js 2>&1 | tail -10
```

Expected: FAIL — `github-client.js` not found.

- [ ] **Step 3: Create `tools/lib/github-client.js`**

```js
'use strict';
const https = require('https');

/**
 * Make a GitHub REST API request.
 * @param {string} token - GITHUB_TOKEN
 * @param {string} method - HTTP method
 * @param {string} apiPath - Path starting with /repos/...
 * @param {object|null} body - JSON body or null
 * @returns {Promise<object|null>}
 */
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
```

- [ ] **Step 4: Run tests to confirm they pass**

```bash
npx jest tests/unit/github-client.test.js 2>&1 | tail -10
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add tools/lib/github-client.js tests/unit/github-client.test.js
git commit -m "feat: US-0171 — github-client.js REST wrapper + buildIssueTitle/Body helpers"
```

---

### Task 1.2: `sync-bugs.js` — bidirectional bug sync logic

- [ ] **Step 1: Write failing tests** — Create `tests/unit/sync-bugs.test.js`:

```js
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
    const stateEntries = [];
    const ghIssues = [];
    const changes = classifyBugChanges(bugs, stateEntries, ghIssues, config);
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
    // GH was closed AFTER last sync
    const stateEntries = [
      { id: 'BUG-0253', ghIssueNumber: 42, lastKnownGhStatus: 'open', lastSyncedAt: '2026-04-01T00:00:00Z' },
    ];
    const ghIssues = [{ number: 42, state: 'closed', closed_at: now, title: '[BUG-0253] Crash' }];
    const changes = classifyBugChanges(bugs, stateEntries, ghIssues, config);
    expect(changes[0].action).toBe('pull_close');
  });

  it('AC-0616: GH issues not in stateEntries are returned with action pull_create (via sync-github.js direct)', () => {
    // classifyBugChanges only handles PV bugs; unlinked GH issue detection is in sync-github.js
    // This test verifies the linkedNumbers Set logic works correctly
    const stateEntries = [
      { id: 'BUG-0010', ghIssueNumber: 10, lastKnownGhStatus: 'open', lastSyncedAt: '2026-05-01T00:00:00Z' },
    ];
    const ghIssues = [
      { number: 10, state: 'open', labels: [] },
      { number: 99, state: 'open', labels: [{ name: 'high' }] }, // unlinked
    ];
    const linkedNumbers = new Set(stateEntries.map((e) => e.ghIssueNumber));
    const unlinked = ghIssues.filter((i) => !linkedNumbers.has(i.number) && i.state === 'open');
    expect(unlinked).toHaveLength(1);
    expect(unlinked[0].number).toBe(99);
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
```

- [ ] **Step 2: Run to confirm failure**

```bash
npx jest tests/unit/sync-bugs.test.js 2>&1 | tail -10
```

Expected: FAIL — `sync-bugs.js` not found.

- [ ] **Step 3: Create `tools/lib/sync-bugs.js`**

```js
'use strict';
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '../..');

/**
 * Determine what action to take for each bug by comparing PlanVisualizer state,
 * GitHub Issue state, and the last sync state.
 * Returns an array of { bug, action, ghIssueNumber? } objects.
 * Actions: 'create' | 'close' | 'reopen' | 'pull_close' | 'skip'
 */
function classifyBugChanges(bugs, stateEntries, ghIssues, config) {
  const stateMap = new Map(stateEntries.map((e) => [e.id, e]));
  const ghMap = new Map(ghIssues.map((i) => [i.number, i]));
  const changes = [];

  for (const bug of bugs) {
    const state = stateMap.get(bug.id);
    const pvClosed = /^(Fixed|Retired|Cancelled)/i.test(bug.status);

    if (!bug.ghIssueNumber) {
      // No linked issue — create one
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
      // No previous sync state — use current values as ground truth
      if (pvClosed && !ghClosed) changes.push({ action: 'close', bug });
      else if (!pvClosed && ghClosed) changes.push({ action: 'reopen', bug });
      else changes.push({ action: 'skip', bug });
      continue;
    }

    const lastSyncedAt = new Date(state.lastSyncedAt).getTime();
    const ghChangedAt = ghIssue.closed_at || ghIssue.updated_at;
    const ghChangeTime = ghChangedAt ? new Date(ghChangedAt).getTime() : 0;

    // Detect external GH changes (after last sync, PV status unchanged since last sync)
    const ghChangedSinceSync = ghChangeTime > lastSyncedAt;
    const pvStatusMatchesLastSync = (state.lastKnownGhStatus === 'open') === !pvClosed;

    if (ghChangedSinceSync && pvStatusMatchesLastSync && ghClosed && !pvClosed) {
      // GH closed externally → pull that close into PV
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

/**
 * Write GH issue number back into BUGS.md for a given bug ID.
 * Inserts "GH Issue: #NNN" after the "Status:" line.
 */
function writeBugIssueNumber(bugId, issueNumber) {
  const bugsPath = path.join(ROOT, 'docs/BUGS.md');
  let content = fs.readFileSync(bugsPath, 'utf8');
  // Only insert if not already present
  const alreadyLinked = new RegExp(`${bugId}[\\s\\S]*?GH Issue:`).test(content);
  if (alreadyLinked) return;
  // Insert after "Status: ..." line in this bug's block
  content = content.replace(
    new RegExp(`(${bugId}:[^\\n]+\\n[\\s\\S]*?Status:[^\\n]+\\n)`),
    `$1GH Issue: #${issueNumber}\n`,
  );
  fs.writeFileSync(bugsPath, content, 'utf8');
}

/**
 * Update bug Status in BUGS.md (for pull_close).
 */
function updateBugStatus(bugId, newStatus) {
  const bugsPath = path.join(ROOT, 'docs/BUGS.md');
  let content = fs.readFileSync(bugsPath, 'utf8');
  // Find bug block and replace its Status line
  content = content.replace(new RegExp(`(${bugId}:[\\s\\S]*?)(Status:\\s*\\S+)`), `$1Status: ${newStatus}`);
  fs.writeFileSync(bugsPath, content, 'utf8');
}

module.exports = { classifyBugChanges, writeBugIssueNumber, updateBugStatus };
```

- [ ] **Step 4: Run tests**

```bash
npx jest tests/unit/sync-bugs.test.js 2>&1 | tail -10
```

Expected: all 6 PASS.

- [ ] **Step 5: Commit**

```bash
git add tools/lib/sync-bugs.js tests/unit/sync-bugs.test.js
git commit -m "feat: US-0171 — sync-bugs.js classification logic + writeback helpers"
```

---

### Task 1.3: `sync-github.js` — CLI entry point and state management

- [ ] **Step 1: Write failing tests** — append to `tests/unit/sync-bugs.test.js`:

```js
describe('sync-bugs — loadSyncState / saveSyncState', () => {
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
```

- [ ] **Step 2: Add `loadSyncState` and `buildStateEntry` to `tools/lib/sync-bugs.js`**

```js
const path = require('path');
const fs = require('fs');

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
```

Export them from `sync-bugs.js`: add `loadSyncState`, `saveSyncState`, `buildStateEntry` to `module.exports`.

- [ ] **Step 3: Create `tools/sync-github.js`**

```js
#!/usr/bin/env node
'use strict';
const path = require('path');

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
  // Load config
  let config;
  try {
    const raw = require(path.join(ROOT, 'plan-visualizer.config.json'));
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
    // Load bugs
    const { parseBugs } = require('./lib/parse-bugs');
    const fs = require('fs');
    const bugsRaw = fs.readFileSync(path.join(ROOT, 'docs/BUGS.md'), 'utf8');
    const bugs = parseBugs(bugsRaw);

    // Fetch all GH issues with first defaultLabel
    const ghIssues = dryRun ? [] : await listIssues(token, repo, defaultLabels[0]);

    // Classify changes
    const changes = classifyBugChanges(bugs, state.entries, ghIssues, { repo, labelMap, defaultLabels });

    // AC-0616: Pull unlinked GH issues → new BUGS.md entries
    // Find GH issues with defaultLabels[0] that have no matching state entry
    const linkedNumbers = new Set(state.entries.map((e) => e.ghIssueNumber));
    const unlinkedGhIssues = ghIssues.filter((i) => !linkedNumbers.has(i.number) && i.state === 'open');
    const { reserveId } = require('../../orchestrator/atomic-write');
    const { atomicAppend } = require('../../orchestrator/atomic-write');
    for (const ghIssue of unlinkedGhIssues) {
      // Infer severity from labels
      const severityFromLabel = { critical: 'Critical', high: 'High', medium: 'Medium', low: 'Low' };
      const matchedLabel = (ghIssue.labels || []).map((l) => l.name).find((n) => severityFromLabel[n]);
      const severity = matchedLabel ? severityFromLabel[matchedLabel] : 'Medium';
      const title = ghIssue.title.replace(/^\[BUG-\d+\]\s*/, ''); // strip prefix if already there

      if (!dryRun) {
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
        const bugsPath = require('path').join(ROOT, 'docs/BUGS.md');
        const existing = require('fs').readFileSync(bugsPath, 'utf8');
        require('fs').writeFileSync(bugsPath, existing + entry, 'utf8');
        state.entries.push(buildStateEntry(newBugId, ghIssue.number, 'open'));
      } else {
        console.log(`  [dry-run] PULL_CREATE BUG from GH #${ghIssue.number}: ${title}`);
      }
      summary.pulled = (summary.pulled || 0) + 1;
    }

    // Apply changes in batches
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
```

- [ ] **Step 4: Add sync call to `tools/generate-plan.js`** — find the end of `main()` at line ~379:

```js
// After:
console.log(`[generate-plan] Written ${htmlPath}`);
console.log(
  `[generate-plan] Done. ${epics.length} epics, ${stories.length} stories, ${testCases.length} TCs, ${bugs.length} bugs, ${lessons.length} lessons.`,
);
// Add:
if (config.github && config.github.enabled) {
  try {
    await require('child_process').execFileSync(process.execPath, [path.join(__dirname, 'sync-github.js')], {
      env: process.env,
      stdio: 'inherit',
    });
  } catch (e) {
    console.warn('[generate-plan] GitHub sync failed (non-fatal):', e.message);
  }
}
```

Note: `main()` is currently sync. Since `sync-github.js` is a child process, this stays sync. `execFileSync` blocks until sync completes.

- [ ] **Step 5: Add `github` block to `plan-visualizer.config.json`**

```bash
cat plan-visualizer.config.json
```

Add after the existing last key (before the closing `}`):

```json
"github": {
  "enabled": false,
  "repo": "ksyed0/PlanVisualizer",
  "syncBugs": true,
  "syncStories": false,
  "labelMap": {
    "Critical": "critical",
    "High": "high",
    "Medium": "medium",
    "Low": "low"
  },
  "defaultLabels": ["planvisualizer"]
}
```

`enabled: false` — opt-in, safe default.

- [ ] **Step 6: Run all new tests**

```bash
npx jest tests/unit/sync-bugs.test.js tests/unit/github-client.test.js 2>&1 | tail -15
npx jest --coverage 2>&1 | tail -5
```

Expected: all pass, coverage ≥ 80%.

- [ ] **Step 7: Update RELEASE_PLAN.md** — find US-0171 (Status: Planned), set Done, Branch: feature/US-0171-github-sync-engine, check AC-0611–AC-0618.

- [ ] **Step 8: Commit and open PR**

```bash
git add tools/lib/github-client.js tools/lib/sync-bugs.js tools/sync-github.js \
        tools/generate-plan.js plan-visualizer.config.json \
        tests/unit/github-client.test.js tests/unit/sync-bugs.test.js \
        docs/RELEASE_PLAN.md
git commit -m "feat: US-0171 — GitHub Issues sync engine (bugs, bidirectional, --dry-run)"
git push -u origin feature/US-0171-github-sync-engine
gh pr create --title "feat: US-0171 — GitHub Issues sync engine" \
  --body "$(cat <<'EOF'
## Summary
- tools/lib/github-client.js: thin Node https wrapper, buildIssueTitle/Body helpers
- tools/lib/sync-bugs.js: classifyBugChanges (create/close/reopen/pull_close/skip), writeBugIssueNumber, updateBugStatus, loadSyncState/saveSyncState
- tools/sync-github.js: CLI entry point, batched API calls, --dry-run flag
- generate-plan.js: calls sync-github.js at pipeline end when config.github.enabled
- plan-visualizer.config.json: github block added (enabled: false by default)
- docs/github-sync-state.json: created on first sync run

## Test plan
- [ ] All tests pass
- [ ] Coverage >= 80%
- [ ] CI green

🤖 Generated with [Claude Code](https://claude.com/claude-code)
EOF
)"
gh pr merge --auto --squash --delete-branch
```

---

## Work Stream 2 — US-0173: Story Sync (opt-in extension)

**Branch:** `feature/US-0173-github-story-sync`

> Wait for US-0171 to merge first.

```bash
git checkout develop && git pull origin develop
git checkout -b feature/US-0173-github-story-sync
```

**Files:**

- Create: `tools/lib/sync-stories.js`
- Modify: `tools/sync-github.js` (call sync-stories when syncStories: true)
- Create: `tests/unit/sync-stories.test.js`

---

### Task 2.1: `sync-stories.js` — story sync classification

- [ ] **Step 1: Write failing tests** — Create `tests/unit/sync-stories.test.js`:

```js
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
```

- [ ] **Step 2: Run to confirm failure**

```bash
npx jest tests/unit/sync-stories.test.js 2>&1 | tail -10
```

Expected: FAIL.

- [ ] **Step 3: Create `tools/lib/sync-stories.js`**

```js
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

    if (!story.ghIssueNumber) {
      changes.push({ action: 'create', story });
      continue;
    }

    const ghIssue = ghMap.get(story.ghIssueNumber);
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
  const alreadyLinked = new RegExp(`${storyId}[\\s\\S]*?GH Issue:`).test(content);
  if (alreadyLinked) return;
  content = content.replace(
    new RegExp(`(${storyId}[^\\n]+\\n[\\s\\S]*?Branch:[^\\n]+\\n)`),
    `$1GH Issue: #${issueNumber}\n`,
  );
  fs.writeFileSync(planPath, content, 'utf8');
}

module.exports = { classifyStoryChanges, writeStoryIssueNumber };
```

- [ ] **Step 4: Integrate into `tools/sync-github.js`** — after the bugs sync block, add:

```js
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
```

- [ ] **Step 5: Run all tests**

```bash
npx jest tests/unit/sync-stories.test.js tests/unit/sync-bugs.test.js 2>&1 | tail -15
npx jest --coverage 2>&1 | tail -5
```

- [ ] **Step 6: Update RELEASE_PLAN.md** — US-0173: Done, Branch: feature/US-0173-github-story-sync, check AC-0625–AC-0627.

- [ ] **Step 7: Commit and PR**

```bash
git add tools/lib/sync-stories.js tools/sync-github.js \
        tests/unit/sync-stories.test.js docs/RELEASE_PLAN.md
git commit -m "feat: US-0173 — story sync (opt-in, syncStories: true)"
git push -u origin feature/US-0173-github-story-sync
gh pr create --title "feat: US-0173 — GitHub Issues story sync (opt-in)" \
  --body "$(cat <<'EOF'
## Summary
- sync-stories.js: classifyStoryChanges (create/close/reopen/skip), writeStoryIssueNumber
- sync-github.js: calls story sync when config.syncStories is true
- syncStories defaults to false — completely opt-in

## Test plan
- [ ] All tests pass
- [ ] Coverage >= 80%
- [ ] CI green

🤖 Generated with [Claude Code](https://claude.com/claude-code)
EOF
)"
gh pr merge --auto --squash --delete-branch
```

---

## Work Stream 3 — US-0172: Settings Panel UI

**Branch:** `feature/US-0172-settings-panel`

> Can run in parallel with US-0173 (no shared files).

```bash
git checkout develop && git pull origin develop
git checkout -b feature/US-0172-settings-panel
```

**Files:**

- Modify: `tools/lib/render-shell.js:127-178` (add Settings to sidebar)
- Modify: `tools/lib/render-tabs.js` (add `renderSettingsTab` function)
- Modify: `tools/lib/render-html.js` (pass github config + token flag; call renderSettingsTab)
- Modify: `tests/unit/render-tabs.test.js` (add Settings tab tests)

---

### Task 3.1: Write failing tests for Settings tab

- [ ] **Step 1: Append to `tests/unit/render-tabs.test.js`**

```js
describe('renderSettingsTab — US-0172', () => {
  const { renderSettingsTab } = require('../../tools/lib/render-tabs');

  const baseGithubConfig = {
    enabled: false,
    repo: 'owner/repo',
    syncBugs: true,
    syncStories: false,
    labelMap: { Critical: 'critical', High: 'high', Medium: 'medium', Low: 'low' },
    defaultLabels: ['planvisualizer'],
  };

  it('renders #tab-settings container', () => {
    const html = renderSettingsTab({ githubConfig: baseGithubConfig, githubTokenSet: false, syncState: null });
    expect(html).toContain('id="tab-settings"');
  });

  it('renders GitHub Sync section heading', () => {
    const html = renderSettingsTab({ githubConfig: baseGithubConfig, githubTokenSet: false, syncState: null });
    expect(html).toContain('GitHub Issues Sync');
  });

  it('renders repo field with current value', () => {
    const html = renderSettingsTab({ githubConfig: baseGithubConfig, githubTokenSet: false, syncState: null });
    expect(html).toContain('owner/repo');
  });

  it('shows token NOT SET when githubTokenSet is false', () => {
    const html = renderSettingsTab({ githubConfig: baseGithubConfig, githubTokenSet: false, syncState: null });
    expect(html).toContain('Not set');
  });

  it('shows token SET when githubTokenSet is true', () => {
    const html = renderSettingsTab({ githubConfig: baseGithubConfig, githubTokenSet: true, syncState: null });
    expect(html).toContain('Set');
  });

  it('renders Copy config JSON button', () => {
    const html = renderSettingsTab({ githubConfig: baseGithubConfig, githubTokenSet: false, syncState: null });
    expect(html).toContain('copyGithubConfig');
  });

  it('shows last sync summary when syncState provided', () => {
    const syncState = { lastSyncAt: '2026-05-03T14:32:00Z', summary: { created: 3, closed: 1 }, lastError: null };
    const html = renderSettingsTab({ githubConfig: baseGithubConfig, githubTokenSet: true, syncState });
    expect(html).toContain('2026-05-03');
    expect(html).toContain('3');
  });

  it('shows warning badge when lastError is set', () => {
    const syncState = { lastSyncAt: '2026-05-03T14:32:00Z', summary: {}, lastError: 'API 401' };
    const html = renderSettingsTab({ githubConfig: baseGithubConfig, githubTokenSet: true, syncState });
    expect(html).toContain('API 401');
  });
});
```

- [ ] **Step 2: Run to confirm failure**

```bash
npx jest tests/unit/render-tabs.test.js -t "US-0172" 2>&1 | tail -10
```

---

### Task 3.2: Add `renderSettingsTab` to `render-tabs.js`

- [ ] **Step 1: Add function** — append before `module.exports` in `tools/lib/render-tabs.js`:

```js
function renderSettingsTab({ githubConfig, githubTokenSet, syncState }) {
  const cfg = githubConfig || {};
  const enabled = cfg.enabled || false;
  const repo = esc(cfg.repo || '');
  const syncBugs = cfg.syncBugs !== false;
  const syncStories = cfg.syncStories || false;
  const defaultLabels = esc((cfg.defaultLabels || ['planvisualizer']).join(', '));
  const labelMap = cfg.labelMap || { Critical: 'critical', High: 'high', Medium: 'medium', Low: 'low' };

  const tokenStatus = githubTokenSet
    ? `<span style="color:var(--ok)">✓ Set</span>`
    : `<span style="color:var(--risk)">✗ Not set — export GITHUB_TOKEN before running generate-plan</span>`;

  let syncSummary = '<span style="opacity:.5">—</span>';
  let errorBanner = '';
  if (syncState) {
    const d = syncState.lastSyncAt
      ? new Date(syncState.lastSyncAt).toISOString().slice(0, 16).replace('T', ' ') + ' UTC'
      : '—';
    const s = syncState.summary || {};
    syncSummary = `${esc(d)} · ${s.created || 0} created · ${s.closed || 0} closed · ${s.reopened || 0} reopened`;
    if (syncState.lastError) {
      errorBanner = `<div class="card-elev rounded p-3 mb-4" style="border-left:3px solid var(--risk);background:var(--clr-panel-bg)">
        <span style="color:var(--risk);font-weight:600">⚠ Last sync failed:</span> ${esc(syncState.lastError)}
      </div>`;
    }
  }

  const configJson = JSON.stringify({ github: cfg }, null, 2);

  return `
  <div id="tab-settings" class="p-6 hidden" role="tabpanel" aria-labelledby="tab-btn-settings">
    <h2 class="display-title mb-6">Settings</h2>
    ${errorBanner}
    <div class="card-elev rounded-lg p-6 mb-6" style="max-width:640px">
      <h3 class="font-semibold text-sm uppercase tracking-widest mb-4" style="opacity:.6">GitHub Issues Sync</h3>

      <div class="flex items-center gap-3 mb-4">
        <span class="text-sm font-medium" style="min-width:120px">Enabled</span>
        <input type="checkbox" id="gh-enabled" ${enabled ? 'checked' : ''} onchange="ghSettingsChanged()">
      </div>
      <div class="flex items-center gap-3 mb-3">
        <label for="gh-repo" class="text-sm font-medium" style="min-width:120px">Repository</label>
        <input id="gh-repo" type="text" value="${repo}" placeholder="owner/repo"
          style="flex:1;font-size:12px;padding:4px 8px;border:1px solid var(--clr-border);border-radius:4px;background:var(--clr-input-bg);color:var(--clr-input-text)"
          oninput="ghSettingsChanged()">
      </div>
      <div class="flex items-center gap-3 mb-3">
        <span class="text-sm font-medium" style="min-width:120px">Sync bugs</span>
        <input type="checkbox" id="gh-sync-bugs" ${syncBugs ? 'checked' : ''} onchange="ghSettingsChanged()">
        <span class="text-sm font-medium ml-4">Sync stories</span>
        <input type="checkbox" id="gh-sync-stories" ${syncStories ? 'checked' : ''} onchange="ghSettingsChanged()">
      </div>
      <div class="flex items-center gap-3 mb-4">
        <label for="gh-default-labels" class="text-sm font-medium" style="min-width:120px">Default labels</label>
        <input id="gh-default-labels" type="text" value="${defaultLabels}"
          style="flex:1;font-size:12px;padding:4px 8px;border:1px solid var(--clr-border);border-radius:4px;background:var(--clr-input-bg);color:var(--clr-input-text)"
          oninput="ghSettingsChanged()">
      </div>

      <div class="mb-4" style="padding:10px 12px;background:var(--clr-surface);border-radius:6px;font-size:12px">
        <div style="opacity:.6;margin-bottom:4px">Token (GITHUB_TOKEN env var)</div>
        ${tokenStatus}
      </div>

      <div class="mb-4" style="padding:10px 12px;background:var(--clr-surface);border-radius:6px;font-size:12px">
        <div style="opacity:.6;margin-bottom:4px">Last sync</div>
        <div>${syncSummary}</div>
      </div>

      <div class="flex gap-2">
        <button onclick="copyGithubConfig()" class="chip info" style="cursor:pointer">Copy config JSON</button>
        <button onclick="resetGithubConfig()" class="chip mute" style="cursor:pointer">Reset to defaults</button>
      </div>
    </div>

    <script>
    var _ghDefaults = ${JSON.stringify(cfg)};
    function ghSettingsChanged() {
      var cfg = {
        enabled:      document.getElementById('gh-enabled').checked,
        repo:         document.getElementById('gh-repo').value.trim(),
        syncBugs:     document.getElementById('gh-sync-bugs').checked,
        syncStories:  document.getElementById('gh-sync-stories').checked,
        defaultLabels: document.getElementById('gh-default-labels').value.split(',').map(function(s){ return s.trim(); }).filter(Boolean),
        labelMap:     _ghDefaults.labelMap || { Critical:'critical', High:'high', Medium:'medium', Low:'low' },
      };
      localStorage.setItem('pv-github-config', JSON.stringify(cfg));
    }
    function copyGithubConfig() {
      var stored = localStorage.getItem('pv-github-config');
      var cfg = stored ? JSON.parse(stored) : _ghDefaults;
      var json = JSON.stringify({ github: cfg }, null, 2);
      navigator.clipboard && navigator.clipboard.writeText(json).then(function(){
        alert('Copied! Paste into plan-visualizer.config.json');
      }).catch(function(){ alert(json); });
    }
    function resetGithubConfig() {
      localStorage.removeItem('pv-github-config');
      document.getElementById('gh-enabled').checked      = _ghDefaults.enabled || false;
      document.getElementById('gh-repo').value           = _ghDefaults.repo || '';
      document.getElementById('gh-sync-bugs').checked    = _ghDefaults.syncBugs !== false;
      document.getElementById('gh-sync-stories').checked = _ghDefaults.syncStories || false;
      document.getElementById('gh-default-labels').value = (_ghDefaults.defaultLabels || ['planvisualizer']).join(', ');
    }
    </script>
  </div>`;
}
```

Add `renderSettingsTab` to `module.exports` at bottom of `render-tabs.js`.

---

### Task 3.3: Add Settings tab to sidebar and wire into render pipeline

- [ ] **Step 1: Add Settings to sidebar in `tools/lib/render-shell.js`** — find the `items` array ending at line 178 and add before the closing `]`:

```js
    {
      id: 'settings',
      label: 'Settings',
      path: 'M9.594 3.94c.09-.542.56-.94 1.11-.94h2.593c.55 0 1.02.398 1.11.94l.213 1.281c.063.374.313.686.645.87.074.04.147.083.22.127.324.196.72.257 1.075.124l1.217-.456a1.125 1.125 0 011.37.49l1.296 2.247a1.125 1.125 0 01-.26 1.431l-1.003.827c-.293.24-.438.613-.431.992a6.759 6.759 0 010 .255c-.007.378.138.75.43.99l1.005.828c.424.35.534.954.26 1.43l-1.298 2.247a1.125 1.125 0 01-1.369.491l-1.217-.456c-.355-.133-.75-.072-1.076.124a6.57 6.57 0 01-.22.128c-.331.183-.581.495-.644.869l-.213 1.28c-.09.543-.56.941-1.11.941h-2.594c-.55 0-1.02-.398-1.11-.94l-.213-1.281c-.062-.374-.312-.686-.644-.87a6.52 6.52 0 01-.22-.127c-.325-.196-.72-.257-1.076-.124l-1.217.456a1.125 1.125 0 01-1.369-.49l-1.297-2.247a1.125 1.125 0 01.26-1.431l1.004-.827c.292-.24.437-.613.43-.992a6.932 6.932 0 010-.255c.007-.378-.138-.75-.43-.99l-1.004-.828a1.125 1.125 0 01-.26-1.43l1.297-2.247a1.125 1.125 0 011.37-.491l1.216.456c.356.133.751.072 1.076-.124.072-.044.146-.087.22-.128.332-.183.582-.495.644-.869l.214-1.281z M15 12a3 3 0 11-6 0 3 3 0 016 0z',
    },
```

- [ ] **Step 2: Pass github config and token flag through the render pipeline** — in `tools/lib/render-html.js`, find the function signature (it receives `data`) and add to the data object threaded through to `renderHtml`. Check the current call site:

```bash
grep -n "renderHtml\|renderSettingsTab\|githubConfig\|githubTokenSet" tools/lib/render-html.js | head -10
grep -n "renderHtml(" tools/generate-plan.js | head -5
```

In `generate-plan.js`, the call is `renderHtml(data, { trends, budgetCSV })`. Add the github fields to `data` before the call:

```js
data.githubConfig = config.github || null;
data.githubTokenSet = !!process.env.GITHUB_TOKEN;
data.syncState = (() => {
  try {
    return JSON.parse(fs.readFileSync(path.join(ROOT, 'docs/github-sync-state.json'), 'utf8'));
  } catch {
    return null;
  }
})();
```

- [ ] **Step 3: Call `renderSettingsTab` inside `renderHtml`** — in `tools/lib/render-html.js`, find where other tabs are rendered (look for `renderTrendsTab`, `renderStakeholderTab`, etc.) and add:

```js
const settingsTab = renderSettingsTab({
  githubConfig: data.githubConfig || null,
  githubTokenSet: data.githubTokenSet || false,
  syncState: data.syncState || null,
});
```

Then insert `${settingsTab}` alongside the other tab HTML in the main body.

- [ ] **Step 4: Import `renderSettingsTab` at top of `render-html.js`** — find the existing require of render-tabs:

```bash
grep -n "render-tabs\|renderTrendsTab\|renderStakeholderTab" tools/lib/render-html.js | head -5
```

Add `renderSettingsTab` to that destructured require.

---

### Task 3.4: Run tests and open PR

- [ ] **Step 1: Run new tests**

```bash
npx jest tests/unit/render-tabs.test.js -t "US-0172" 2>&1 | tail -15
```

Expected: all 8 PASS.

- [ ] **Step 2: Full suite**

```bash
npx jest --coverage 2>&1 | tail -5
```

- [ ] **Step 3: Update RELEASE_PLAN.md** — US-0172: Done, Branch: feature/US-0172-settings-panel, check AC-0619–AC-0624.

- [ ] **Step 4: Commit and PR**

```bash
git add tools/lib/render-shell.js tools/lib/render-tabs.js tools/lib/render-html.js \
        tools/generate-plan.js tests/unit/render-tabs.test.js docs/RELEASE_PLAN.md
git commit -m "feat: US-0172 — Settings tab (GitHub sync config UI, Copy config JSON, sync status)"
git push -u origin feature/US-0172-settings-panel
gh pr create --title "feat: US-0172 — Settings panel for GitHub Issues Sync" \
  --body "$(cat <<'EOF'
## Summary
- render-shell.js: Settings gear icon added to sidebar
- render-tabs.js: renderSettingsTab() — enabled toggle, repo field, label mapping, Copy config JSON button, token status, last sync summary, error banner
- render-html.js: imports and renders Settings tab, passes githubConfig/githubTokenSet/syncState from data
- generate-plan.js: populates data.githubConfig, data.githubTokenSet, data.syncState before renderHtml()

## Test plan
- [ ] All tests pass
- [ ] Coverage >= 80%
- [ ] CI green

🤖 Generated with [Claude Code](https://claude.com/claude-code)
EOF
)"
gh pr merge --auto --squash --delete-branch
```

---

## Post-merge: Session close

After all four PRs merge:

- [ ] Update `docs/progress.md` with EPIC-0025 design complete note
- [ ] Update `MEMORY.md` with new patterns (sync-github.js, github-sync-state.json, renderSettingsTab, variable-length IDs)
- [ ] Update `docs/RELEASE_PLAN.md` — add EPIC-0025 epic block and US-0171/0172/0173 story blocks
- [ ] Update `docs/ID_REGISTRY.md` — EPIC: EPIC-0026, US: US-0174, AC: AC-0628
- [ ] Commit `docs/AI_COST_LOG.md` before any branch switch
