# Deploy Agent (EPIC-0046) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add Deploy (DevOps Engineer) as the tenth agent in the PlanVisualizer agentic pipeline — Phase 7 by default, on-demand out-of-band — with a CLI state tool, dashboard panel, and alert integration.

**Architecture:** `tools/deploy-status.js` mirrors `tools/update-sdlc-status.js` exactly (exports `HANDLERS` + `parseArgs`, uses `atomicReadModifyWriteJson`). `tools/generate-dashboard.js` reads `docs/deploy-status.json` at generation time and renders a static Deploy panel; client-side `refreshState()` also fetches `deploy-status.json` dynamically for live alerts. Agent identity lives in `agents.config.json`; instruction files live in `docs/agents/`.

**Tech Stack:** Node.js 20+, Jest, `orchestrator/atomic-write.js` (existing), `agents.config.json` (existing).

## Global Constraints

- All new JS files: `'use strict';` header, CommonJS modules (`require`/`module.exports`)
- CLI tool exports: `HANDLERS`, `parseArgs`, `BLANK_STATUS` — same surface as `update-sdlc-status.js`
- `atomicReadModifyWriteJson` import path from `tools/`: `require('../orchestrator/atomic-write')`
- `docs/deploy-status.json` path: `path.join(__dirname, '..', 'docs', 'deploy-status.json')`
- Test file: `tests/unit/deploy-status.test.js` — run with `npm test`
- Commit message format: `[TYPE] US-XXXX: Short description` (max 72 chars)
- All tests must pass before each commit: `npm test`
- Coverage must stay above 80%: `npm run test:coverage`
- No new external dependencies

---

## File Map

### New files

| File                               | Purpose                                              |
| ---------------------------------- | ---------------------------------------------------- |
| `docs/agents/DEPLOY_AGENT.md`      | Deploy agent instruction file                        |
| `docs/templates/ci-contract.md`    | CI contract template Keystone fills in               |
| `tools/deploy-status.js`           | CLI tool — 9 commands, mirrors update-sdlc-status.js |
| `tests/unit/deploy-status.test.js` | Unit tests — all 9 command handlers                  |

### Modified files

| File                                    | Change                                                                                                                                        |
| --------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------- |
| `agents.config.json`                    | Add Deploy agent entry + Phase 7                                                                                                              |
| `docs/agents/ARCHITECT_AGENT.md`        | Add ## CI Contract section                                                                                                                    |
| `docs/agents/DM_AGENT.md`               | Add Deploy sub-agent, Phase 7, out-of-band dispatch, incident response                                                                        |
| `package.json`                          | Add 9 `agent:deploy-*` npm scripts                                                                                                            |
| `scripts/install.sh`                    | §7: copy `tools/deploy-status.js` to target                                                                                                   |
| `scripts/update.sh`                     | §7: copy `tools/deploy-status.js` to target                                                                                                   |
| `tools/generate-dashboard.js`           | Add `DEPLOY_STATUS_PATH`, `renderDeployPanel()`, extend `generateHTML()` and `generate()`, extend inline `refreshState()` and `runAlertCheck` |
| `tests/unit/generate-dashboard.test.js` | Update agent fixture count 9→10, add 2 Deploy panel tests                                                                                     |
| `docs/dashboard-extraction.md`          | Document `npm run agent:deploy-init` alongside `init:status`                                                                                  |

---

## Task 1: Agent Identity & Instruction Files (US-0264)

**Files:**

- Create: `docs/agents/DEPLOY_AGENT.md`
- Create: `docs/templates/ci-contract.md`
- Modify: `agents.config.json`
- Modify: `docs/agents/ARCHITECT_AGENT.md`

**Interfaces:**

- Produces: `agents.config.json["Deploy"]` entry consumed by Tasks 4 and 5 (dashboard agent card rendering)

---

- [ ] **Step 1: Add Deploy to `agents.config.json`**

Open `agents.config.json`. After the `"Circuit"` entry in the `agents` object, add:

```json
"Deploy": {
  "role": "DevOps Engineer",
  "icon": "🚀",
  "color": "oklch(48% 0.20 195)",
  "avatar": "deploy",
  "instructionFile": "docs/agents/DEPLOY_AGENT.md"
}
```

Then add Phase 7 to the `phases` array (after the existing `"Polish"` entry):

```json
{
  "name": "Deploy",
  "agents": ["Deploy"],
  "deliverables": ["deployed sha", "environment health report", "open incidents"]
}
```

- [ ] **Step 2: Validate JSON**

```bash
node -e "JSON.parse(require('fs').readFileSync('agents.config.json','utf8')); console.log('valid')"
```

Expected: `valid`

- [ ] **Step 3: Create `docs/agents/DEPLOY_AGENT.md`**

```markdown
# Deploy — DevOps Engineer Agent

> **Read this file in full before starting any work.**
> **You own the deployment surface. You do NOT write application code.**

## Role

You are **Deploy**, the DevOps Engineer Agent. You own CI/CD workflow files,
infrastructure-as-code, and the dev → staging → production environment promotion
ladder. You run as Phase 7 at the end of each pipeline cycle and can be dispatched
out-of-band by Conductor for hotfix releases, new CI pipelines, environment setup,
and infra-as-code changes.

You report structured incident triage to Conductor — never raw logs. You auto-rollback
on hard failures and escalate ambiguous failures for Conductor's decision.

## BLAST Phase

**Phase 7: Deploy** (primary). Available out-of-band at any phase.

## Mandatory Startup

1. Read `docs/agents/DEPLOY_AGENT.md` (this file) in full
2. Read `docs/deploy-status.json` (current environment state — create via `npm run agent:deploy-init` if absent)
3. Read `docs/sdlc-status.json` (active cycle/story context)
4. Read `agents.config.json` (project identity, repo URL)
5. Read `AGENTS.md` (operating standards)

## Core Responsibilities

| #   | Responsibility                                                                                                      |
| --- | ------------------------------------------------------------------------------------------------------------------- |
| 1   | **CI/CD pipeline creation** — scaffold `.github/workflows/*.yml` from `docs/ci-contract.md` when no workflows exist |
| 2   | **CI/CD pipeline updates** — modify existing workflows for new test steps, environments, or secrets                 |
| 3   | **Infrastructure-as-code** — own `Dockerfile`, `docker-compose.yml`, deployment manifests, env variable files       |
| 4   | **Environment promotion** — gate dev→staging on CI green; gate staging→production on Conductor approval             |
| 5   | **CI monitoring** — poll active workflow runs, parse check results, detect regressions                              |
| 6   | **Structured incident triage** — classify failure type and suggest resolution owner before escalating               |
| 7   | **Auto-rollback** — execute on hard failures (health check down); log with `npm run agent:deploy-rollback`          |
| 8   | **Dependency scanning** — run `npm audit` during deploy gate; block promotion on critical vulnerabilities           |
| 9   | **Environment variable auditing** — verify required env vars present before each promotion step                     |
| 10  | **Deploy receipt** — post a structured summary to `sdlc-status.json` log on every deploy attempt                    |

## CI Contract Protocol

Before creating or updating any `.github/workflows/*.yml` file:

1. Read `docs/ci-contract.md` (authoritative CI requirements from Keystone)
2. If `docs/ci-contract.md` does not exist, read `docs/templates/ci-contract.md` and ask Conductor to have Keystone fill it in before proceeding
3. For optimization-only tasks (no new check requirements), audit `package.json` scripts, existing workflow files, and `Dockerfile` directly

## Environment Promotion Protocol
```

dev → staging: requires CI green on target SHA
staging → prod: requires explicit Conductor approval in spawn prompt

````

Record each promotion:
```bash
npm run agent:deploy-promote -- --from staging --to production --sha <sha> --story <US-XXXX>
````

## Incident Triage Protocol

Classify every failure before escalating:

| Failure type                          | Deploy action                     | Escalate to                |
| ------------------------------------- | --------------------------------- | -------------------------- |
| Code bug in deployed artifact         | File incident, do NOT rollback    | Conductor → Forge or Pixel |
| Architecture / infra misconfiguration | File incident                     | Conductor → Keystone       |
| Flaky test (retry resolves)           | Retry once, log result            | No escalation if resolved  |
| Missing secrets / config              | File incident, block promotion    | Conductor → human          |
| Health check down (hard failure)      | Auto-rollback, then file incident | Conductor (post-rollback)  |
| Degraded but alive (ambiguous)        | File incident, await Conductor    | Conductor                  |

## Rollback Protocol

Auto-rollback ONLY on objective hard failure (health check returning non-2xx, error rate spike >50%):

```bash
npm run agent:deploy-rollback -- --env production --to-sha <last-good-sha> --reason "<what failed>"
```

Then immediately file an incident and report to Conductor.

## Reporting Format to Conductor

```
INCIDENT — <SEVERITY> — <ENV>
Type:                    <infra|code|flaky-test|config>
Description:             <what failed and how>
SHA:                     <deployed sha>
Story:                   <US-XXXX>
Suggested resolution:    <specific action>
Suggested owner:         <agent name or "human">
Auto-remediation:        <yes/no — what was tried>
CLI filed:               npm run agent:deploy-incident -- --env <env> ...
```

## Superpowers Skills

If superpowers is installed, invoke at these stages:

- **Before any work:** `superpowers:verification-before-completion`
- **After completing Phase 7:** `superpowers:finishing-a-development-branch`
- **If blocked:** `superpowers:systematic-debugging`

````

- [ ] **Step 4: Create `docs/templates/ci-contract.md`**

```markdown
# CI Contract

> **For Keystone:** Copy this file to `docs/ci-contract.md` and fill in all fields
> during Phase 2 (Architect). Deploy reads `docs/ci-contract.md` before creating
> or updating any CI/CD workflow files.

## Test Commands

- Unit tests: `<command>`
- Coverage: `<command>`
- Coverage threshold: <N>%

## Lint

- Command: `<command>`
- Fail on: errors only (warnings allowed)

## Build

- Command: `<command>` (or "none" if no build step)

## Required Secrets

- `<SECRET_NAME>`: <purpose>

## Deploy Targets

- staging: <platform> (branch/trigger: <branch>)
- production: <platform> (branch/trigger: <branch>)

## Additional Checks

- Dependency audit: `<command>`
- CodeQL: <yes/no — language, query pack>
- Other: <any additional CI steps>
````

- [ ] **Step 5: Add `## CI Contract` section to `docs/agents/ARCHITECT_AGENT.md`**

Find the deliverables section in `ARCHITECT_AGENT.md` and add after it:

```markdown
## CI Contract

At Phase 2, copy `docs/templates/ci-contract.md` to `docs/ci-contract.md` and fill
in all fields: test commands, coverage threshold, lint command, build command, required
secrets, deploy targets, and additional checks.

This file is Deploy's authoritative source for CI requirements. If the file already
exists, update only sections affected by the current story's architectural changes.
```

- [ ] **Step 6: Verify dashboard renders Deploy agent card**

```bash
npm run dashboard
```

Open `docs/dashboard.html` in a browser. Verify "Deploy" appears in the agent roster with a 🚀 icon. (Portrait images `deploy-64/160/320.png` are already present and will be picked up automatically.)

- [ ] **Step 7: Commit**

```bash
git add agents.config.json docs/agents/DEPLOY_AGENT.md docs/templates/ci-contract.md docs/agents/ARCHITECT_AGENT.md
git commit -m "[feat] US-0264: add Deploy agent identity, instruction file, CI contract template"
```

---

## Task 2: CLI Tool & State File (US-0265)

**Files:**

- Create: `tools/deploy-status.js`
- Create: `tests/unit/deploy-status.test.js`
- Modify: `package.json` (add 9 npm scripts)
- Modify: `scripts/install.sh` (§7 copy)
- Modify: `scripts/update.sh` (§7 copy)
- Modify: `docs/dashboard-extraction.md` (document init)

**Interfaces:**

- Consumes: `orchestrator/atomic-write.js` — `atomicReadModifyWriteJson(filePath, transformFn)`
- Produces: `module.exports = { HANDLERS, parseArgs, BLANK_STATUS }` — consumed by tests and by future integrations

---

- [ ] **Step 1: Write the failing tests**

Create `tests/unit/deploy-status.test.js`:

```javascript
'use strict';

const { HANDLERS, parseArgs, BLANK_STATUS } = require('../../tools/deploy-status');

function baseState() {
  return JSON.parse(JSON.stringify(BLANK_STATUS));
}

// ── parseArgs ──────────────────────────────────────────────────────────────

describe('deploy-status — parseArgs', () => {
  it('parses command and flag pairs', () => {
    const { cmd, opts } = parseArgs([
      'node',
      'x',
      'deploy-start',
      '--env',
      'staging',
      '--sha',
      'abc123',
      '--story',
      'US-0264',
    ]);
    expect(cmd).toBe('deploy-start');
    expect(opts.env).toBe('staging');
    expect(opts.sha).toBe('abc123');
    expect(opts.story).toBe('US-0264');
  });

  it('sets boolean true for lone flags', () => {
    const { opts } = parseArgs(['node', 'x', 'init', '--no-overwrite']);
    expect(opts['no-overwrite']).toBe(true);
  });
});

// ── init ───────────────────────────────────────────────────────────────────

describe('deploy-status — init', () => {
  it('returns blank status with all three environments idle', () => {
    const result = HANDLERS.init({}, {});
    expect(result.environments.dev.status).toBe('idle');
    expect(result.environments.staging.status).toBe('idle');
    expect(result.environments.production.status).toBe('idle');
    expect(result.activeDeployment).toBeNull();
    expect(result.ciRuns).toEqual([]);
    expect(result.incidents).toEqual([]);
    expect(result.promotionHistory).toEqual([]);
  });
});

// ── deploy-start ───────────────────────────────────────────────────────────

describe('deploy-status — deploy-start', () => {
  it('sets env to deploying and records activeDeployment', () => {
    const data = baseState();
    const result = HANDLERS['deploy-start'](data, { env: 'staging', sha: 'abc123', story: 'US-0264', from: 'dev' });
    expect(result.environments.staging.status).toBe('deploying');
    expect(result.activeDeployment).toMatchObject({ to: 'staging', sha: 'abc123', story: 'US-0264', from: 'dev' });
    expect(result.activeDeployment.startedAt).toBeTruthy();
  });

  it('throws if --env missing', () => {
    expect(() => HANDLERS['deploy-start'](baseState(), { sha: 'abc', story: 'US-0264' })).toThrow('--env required');
  });

  it('throws if --sha missing', () => {
    expect(() => HANDLERS['deploy-start'](baseState(), { env: 'staging', story: 'US-0264' })).toThrow('--sha required');
  });
});

// ── deploy-complete ────────────────────────────────────────────────────────

describe('deploy-status — deploy-complete', () => {
  it('sets env healthy, records sha, clears activeDeployment', () => {
    const data = baseState();
    data.environments.staging.status = 'deploying';
    data.activeDeployment = {
      from: 'dev',
      to: 'staging',
      sha: 'abc123',
      story: 'US-0264',
      startedAt: new Date().toISOString(),
    };
    const result = HANDLERS['deploy-complete'](data, { env: 'staging', sha: 'abc123', story: 'US-0264' });
    expect(result.environments.staging.status).toBe('healthy');
    expect(result.environments.staging.sha).toBe('abc123');
    expect(result.environments.staging.lastDeployStory).toBe('US-0264');
    expect(result.environments.staging.lastDeployAt).toBeTruthy();
    expect(result.activeDeployment).toBeNull();
  });

  it('throws if --env missing', () => {
    expect(() => HANDLERS['deploy-complete'](baseState(), { sha: 'abc' })).toThrow('--env required');
  });
});

// ── deploy-fail ────────────────────────────────────────────────────────────

describe('deploy-status — deploy-fail', () => {
  it('sets env to degraded and clears activeDeployment', () => {
    const data = baseState();
    data.activeDeployment = { to: 'production', sha: 'abc', story: 'US-0264', startedAt: '' };
    const result = HANDLERS['deploy-fail'](data, { env: 'production', reason: 'health check failed' });
    expect(result.environments.production.status).toBe('degraded');
    expect(result.activeDeployment).toBeNull();
  });

  it('throws if --reason missing', () => {
    expect(() => HANDLERS['deploy-fail'](baseState(), { env: 'production' })).toThrow('--reason required');
  });
});

// ── rollback ───────────────────────────────────────────────────────────────

describe('deploy-status — rollback', () => {
  it('sets env to rolled-back, updates sha, appends rollback to promotionHistory', () => {
    const data = baseState();
    data.environments.production.sha = 'bad123';
    const result = HANDLERS.rollback(data, { env: 'production', 'to-sha': 'good456', reason: 'health check down' });
    expect(result.environments.production.status).toBe('rolled-back');
    expect(result.environments.production.sha).toBe('good456');
    expect(result.environments.production.lastDeployAt).toBeTruthy();
    expect(result.promotionHistory).toHaveLength(1);
    expect(result.promotionHistory[0].rollback).toBe(true);
    expect(result.promotionHistory[0].reason).toBe('health check down');
  });

  it('trims promotionHistory to last 100', () => {
    const data = baseState();
    data.promotionHistory = Array.from({ length: 100 }, (_, i) => ({ id: i }));
    const result = HANDLERS.rollback(data, { env: 'staging', 'to-sha': 'abc', reason: 'test' });
    expect(result.promotionHistory).toHaveLength(100);
  });

  it('throws if --to-sha missing', () => {
    expect(() => HANDLERS.rollback(baseState(), { env: 'production', reason: 'x' })).toThrow('--to-sha required');
  });
});

// ── promote ────────────────────────────────────────────────────────────────

describe('deploy-status — promote', () => {
  it('appends a promotion entry to promotionHistory', () => {
    const data = baseState();
    const result = HANDLERS.promote(data, { from: 'staging', to: 'production', sha: 'abc123', story: 'US-0264' });
    expect(result.promotionHistory).toHaveLength(1);
    expect(result.promotionHistory[0]).toMatchObject({
      from: 'staging',
      to: 'production',
      sha: 'abc123',
      story: 'US-0264',
    });
    expect(result.promotionHistory[0].promotedAt).toBeTruthy();
  });

  it('trims promotionHistory to last 100', () => {
    const data = baseState();
    data.promotionHistory = Array.from({ length: 100 }, (_, i) => ({ id: i }));
    const result = HANDLERS.promote(data, { from: 'staging', to: 'production', sha: 'abc' });
    expect(result.promotionHistory).toHaveLength(100);
  });

  it('throws if --from missing', () => {
    expect(() => HANDLERS.promote(baseState(), { to: 'production', sha: 'abc' })).toThrow('--from required');
  });
});

// ── health-check ───────────────────────────────────────────────────────────

describe('deploy-status — health-check', () => {
  it('maps ok → healthy', () => {
    const result = HANDLERS['health-check'](baseState(), { env: 'dev', status: 'ok' });
    expect(result.environments.dev.status).toBe('healthy');
  });

  it('maps warn → degraded', () => {
    const result = HANDLERS['health-check'](baseState(), { env: 'staging', status: 'warn' });
    expect(result.environments.staging.status).toBe('degraded');
  });

  it('maps fail → down', () => {
    const result = HANDLERS['health-check'](baseState(), { env: 'production', status: 'fail' });
    expect(result.environments.production.status).toBe('down');
  });

  it('throws if --env missing', () => {
    expect(() => HANDLERS['health-check'](baseState(), { status: 'ok' })).toThrow('--env required');
  });
});

// ── ci-status ──────────────────────────────────────────────────────────────

describe('deploy-status — ci-status', () => {
  it('appends a ciRun entry with recordedAt timestamp', () => {
    const data = baseState();
    const result = HANDLERS['ci-status'](data, { workflow: 'plan-visualizer.yml', status: 'passed' });
    expect(result.ciRuns).toHaveLength(1);
    expect(result.ciRuns[0]).toMatchObject({ workflow: 'plan-visualizer.yml', status: 'passed' });
    expect(result.ciRuns[0].recordedAt).toBeTruthy();
  });

  it('trims ciRuns to last 20', () => {
    const data = baseState();
    data.ciRuns = Array.from({ length: 20 }, (_, i) => ({ id: i }));
    const result = HANDLERS['ci-status'](data, { workflow: 'x', status: 'passed' });
    expect(result.ciRuns).toHaveLength(20);
  });

  it('throws if --workflow missing', () => {
    expect(() => HANDLERS['ci-status'](baseState(), { status: 'passed' })).toThrow('--workflow required');
  });
});

// ── incident ───────────────────────────────────────────────────────────────

describe('deploy-status — incident', () => {
  it('appends an incident with auto-incremented id', () => {
    const data = baseState();
    const result = HANDLERS.incident(data, {
      env: 'production',
      type: 'code',
      severity: 'high',
      description: 'Null pointer in auth handler',
      resolution: 'Dispatch Forge to fix auth.js',
      owner: 'Forge',
    });
    expect(result.incidents).toHaveLength(1);
    expect(result.incidents[0].id).toBe(1);
    expect(result.incidents[0].severity).toBe('high');
    expect(result.incidents[0].suggestedOwner).toBe('Forge');
    expect(result.incidents[0].resolvedAt).toBeNull();
    expect(result.incidents[0].openedAt).toBeTruthy();
  });

  it('auto-increments id based on existing incidents length', () => {
    const data = baseState();
    data.incidents = [{ id: 1 }, { id: 2 }];
    const result = HANDLERS.incident(data, {
      env: 'staging',
      type: 'infra',
      severity: 'low',
      description: 'Slow response',
      resolution: 'Restart service',
    });
    expect(result.incidents[2].id).toBe(3);
  });

  it('trims incidents to last 50', () => {
    const data = baseState();
    data.incidents = Array.from({ length: 50 }, (_, i) => ({ id: i + 1 }));
    const result = HANDLERS.incident(data, {
      env: 'production',
      type: 'infra',
      severity: 'low',
      description: 'test',
      resolution: 'test',
    });
    expect(result.incidents).toHaveLength(50);
    expect(result.incidents[49].id).toBe(51);
  });

  it('throws if --description missing', () => {
    expect(() =>
      HANDLERS.incident(baseState(), { env: 'production', type: 'code', severity: 'high', resolution: 'fix it' }),
    ).toThrow('--description required');
  });

  it('throws if --resolution missing', () => {
    expect(() =>
      HANDLERS.incident(baseState(), { env: 'production', type: 'code', severity: 'high', description: 'broke' }),
    ).toThrow('--resolution required');
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
npm test -- --testPathPattern=deploy-status
```

Expected: `Cannot find module '../../tools/deploy-status'`

- [ ] **Step 3: Create `tools/deploy-status.js`**

```javascript
#!/usr/bin/env node
'use strict';

/**
 * deploy-status.js — Event-driven updater for docs/deploy-status.json
 *
 * Called by the Deploy agent at each deployment phase transition to record
 * environment state, CI run results, and incidents.
 *
 * Uses atomicReadModifyWriteJson for safe concurrent updates.
 *
 * Usage:
 *   node tools/deploy-status.js init
 *   node tools/deploy-status.js deploy-start --env staging --sha abc123 --story US-0264
 *   node tools/deploy-status.js deploy-complete --env staging --sha abc123 --story US-0264
 *   node tools/deploy-status.js deploy-fail --env staging --reason "health check failed"
 *   node tools/deploy-status.js rollback --env production --to-sha good456 --reason "down"
 *   node tools/deploy-status.js promote --from staging --to production --sha abc123
 *   node tools/deploy-status.js health-check --env production --status ok
 *   node tools/deploy-status.js ci-status --workflow plan-visualizer.yml --status passed
 *   node tools/deploy-status.js incident --env production --type code --severity high \
 *     --description "Null pointer" --resolution "Dispatch Forge"
 */

const path = require('path');
const fs = require('fs');

const DEPLOY_STATUS_PATH = path.join(__dirname, '..', 'docs', 'deploy-status.json');

const BLANK_STATUS = {
  environments: {
    dev: { sha: null, status: 'idle', lastDeployAt: null, lastDeployStory: null },
    staging: { sha: null, status: 'idle', lastDeployAt: null, lastDeployStory: null },
    production: { sha: null, status: 'idle', lastDeployAt: null, lastDeployStory: null },
  },
  activeDeployment: null,
  ciRuns: [],
  incidents: [],
  promotionHistory: [],
};

function parseArgs(argv) {
  const cmd = argv[2];
  const opts = {};
  for (let i = 3; i < argv.length; i++) {
    if (argv[i].startsWith('--')) {
      const key = argv[i].slice(2);
      opts[key] = argv[i + 1] && !argv[i + 1].startsWith('--') ? argv[++i] : true;
    }
  }
  return { cmd, opts };
}

const HANDLERS = {
  init(_data, _opts) {
    return JSON.parse(JSON.stringify(BLANK_STATUS));
  },

  'deploy-start'(data, opts) {
    if (!opts.env) throw new Error('[deploy-status] --env required');
    if (!opts.sha) throw new Error('[deploy-status] --sha required');
    if (!opts.story) throw new Error('[deploy-status] --story required');
    const env = data.environments[opts.env];
    if (!env) throw new Error(`[deploy-status] unknown env: ${opts.env}`);
    env.status = 'deploying';
    data.activeDeployment = {
      from: opts.from || null,
      to: opts.env,
      sha: opts.sha,
      story: opts.story,
      startedAt: new Date().toISOString(),
    };
    return data;
  },

  'deploy-complete'(data, opts) {
    if (!opts.env) throw new Error('[deploy-status] --env required');
    if (!opts.sha) throw new Error('[deploy-status] --sha required');
    const env = data.environments[opts.env];
    if (!env) throw new Error(`[deploy-status] unknown env: ${opts.env}`);
    env.status = 'healthy';
    env.sha = opts.sha;
    env.lastDeployAt = new Date().toISOString();
    if (opts.story) env.lastDeployStory = opts.story;
    if (data.activeDeployment && data.activeDeployment.to === opts.env) {
      data.activeDeployment = null;
    }
    return data;
  },

  'deploy-fail'(data, opts) {
    if (!opts.env) throw new Error('[deploy-status] --env required');
    if (!opts.reason) throw new Error('[deploy-status] --reason required');
    const env = data.environments[opts.env];
    if (!env) throw new Error(`[deploy-status] unknown env: ${opts.env}`);
    env.status = 'degraded';
    if (data.activeDeployment && data.activeDeployment.to === opts.env) {
      data.activeDeployment = null;
    }
    return data;
  },

  rollback(data, opts) {
    if (!opts.env) throw new Error('[deploy-status] --env required');
    if (!opts['to-sha']) throw new Error('[deploy-status] --to-sha required');
    if (!opts.reason) throw new Error('[deploy-status] --reason required');
    const env = data.environments[opts.env];
    if (!env) throw new Error(`[deploy-status] unknown env: ${opts.env}`);
    env.status = 'rolled-back';
    env.sha = opts['to-sha'];
    env.lastDeployAt = new Date().toISOString();
    data.promotionHistory.push({
      from: opts.env,
      to: opts.env,
      sha: opts['to-sha'],
      story: opts.story || null,
      promotedAt: new Date().toISOString(),
      rollback: true,
      reason: opts.reason,
    });
    data.promotionHistory = data.promotionHistory.slice(-100);
    return data;
  },

  promote(data, opts) {
    if (!opts.from) throw new Error('[deploy-status] --from required');
    if (!opts.to) throw new Error('[deploy-status] --to required');
    if (!opts.sha) throw new Error('[deploy-status] --sha required');
    data.promotionHistory.push({
      from: opts.from,
      to: opts.to,
      sha: opts.sha,
      story: opts.story || null,
      promotedAt: new Date().toISOString(),
    });
    data.promotionHistory = data.promotionHistory.slice(-100);
    return data;
  },

  'health-check'(data, opts) {
    if (!opts.env) throw new Error('[deploy-status] --env required');
    if (!opts.status) throw new Error('[deploy-status] --status required');
    const env = data.environments[opts.env];
    if (!env) throw new Error(`[deploy-status] unknown env: ${opts.env}`);
    const map = { ok: 'healthy', warn: 'degraded', fail: 'down' };
    env.status = map[opts.status] || opts.status;
    return data;
  },

  'ci-status'(data, opts) {
    if (!opts.workflow) throw new Error('[deploy-status] --workflow required');
    if (!opts.status) throw new Error('[deploy-status] --status required');
    data.ciRuns.push({
      workflow: opts.workflow,
      status: opts.status,
      runId: opts['run-id'] || null,
      recordedAt: new Date().toISOString(),
    });
    data.ciRuns = data.ciRuns.slice(-20);
    return data;
  },

  incident(data, opts) {
    if (!opts.env) throw new Error('[deploy-status] --env required');
    if (!opts.type) throw new Error('[deploy-status] --type required');
    if (!opts.severity) throw new Error('[deploy-status] --severity required');
    if (!opts.description) throw new Error('[deploy-status] --description required');
    if (!opts.resolution) throw new Error('[deploy-status] --resolution required');
    data.incidents.push({
      id: data.incidents.length + 1,
      env: opts.env,
      type: opts.type,
      severity: opts.severity,
      description: opts.description,
      suggestedResolution: opts.resolution,
      suggestedOwner: opts.owner || null,
      autoRemediationAttempted: opts['auto-remediation'] === 'true',
      resolvedAt: null,
      openedAt: new Date().toISOString(),
    });
    data.incidents = data.incidents.slice(-50);
    return data;
  },
};

function main() {
  const { cmd, opts } = parseArgs(process.argv);

  if (!cmd) {
    console.error('[deploy-status] command required');
    process.exit(1);
  }

  // init is special — may create the file from scratch
  if (cmd === 'init') {
    if (opts['no-overwrite'] && fs.existsSync(DEPLOY_STATUS_PATH)) {
      console.log('[deploy-status] deploy-status.json already exists, skipping (--no-overwrite)');
      process.exit(0);
    }
    const blank = HANDLERS.init({}, opts);
    fs.writeFileSync(DEPLOY_STATUS_PATH, JSON.stringify(blank, null, 2));
    console.log('[deploy-status] init complete →', DEPLOY_STATUS_PATH);
    process.exit(0);
  }

  const handler = HANDLERS[cmd];
  if (!handler) {
    console.error(`[deploy-status] unknown command: ${cmd}`);
    process.exit(1);
  }

  try {
    const { atomicReadModifyWriteJson } = require('../orchestrator/atomic-write');
    atomicReadModifyWriteJson(DEPLOY_STATUS_PATH, (data) => handler(data, opts));
    console.log(`[deploy-status] ${cmd} ok`);
  } catch (err) {
    console.error(`[deploy-status] ${err.message}`);
    process.exit(1);
  }
}

if (require.main === module) main();

module.exports = { HANDLERS, parseArgs, BLANK_STATUS };
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
npm test -- --testPathPattern=deploy-status
```

Expected: All tests pass (26 tests).

- [ ] **Step 5: Add 9 npm scripts to `package.json`**

In the `"scripts"` section of `package.json`, add after the existing `agent:*` scripts:

```json
"agent:deploy-init":     "node tools/deploy-status.js init",
"agent:deploy-start":    "node tools/deploy-status.js deploy-start",
"agent:deploy-complete": "node tools/deploy-status.js deploy-complete",
"agent:deploy-fail":     "node tools/deploy-status.js deploy-fail",
"agent:deploy-rollback": "node tools/deploy-status.js rollback",
"agent:deploy-promote":  "node tools/deploy-status.js promote",
"agent:deploy-health":   "node tools/deploy-status.js health-check",
"agent:deploy-ci":       "node tools/deploy-status.js ci-status",
"agent:deploy-incident": "node tools/deploy-status.js incident"
```

- [ ] **Step 6: Verify init command works end-to-end**

```bash
npm run agent:deploy-init
cat docs/deploy-status.json
```

Expected: A valid JSON file with three environments all `idle`.

- [ ] **Step 7: Add `deploy-status.js` copy to `scripts/install.sh`**

Find the §7 block in `scripts/install.sh` that copies dashboard tools. Add alongside the existing copies:

```bash
cp "$SCRIPT_DIR/../tools/deploy-status.js" "$TARGET_DIR/tools/deploy-status.js"
```

- [ ] **Step 8: Mirror the same change in `scripts/update.sh`**

Find the equivalent §7 block in `scripts/update.sh` and add:

```bash
cp "$SCRIPT_DIR/../tools/deploy-status.js" "$TARGET_DIR/tools/deploy-status.js"
```

- [ ] **Step 9: Document `deploy-status init` in `docs/dashboard-extraction.md`**

Find the section listing `init-sdlc-status` and add after it:

````markdown
### Seed deploy state

```bash
npm run agent:deploy-init
```
````

Creates `docs/deploy-status.json` with all three environments (`dev`, `staging`, `production`) in `idle` state. Run once after installation, alongside `npm run init:status`.

````

- [ ] **Step 10: Run full test suite**

```bash
npm test
````

Expected: All tests pass.

- [ ] **Step 11: Commit**

```bash
git add tools/deploy-status.js tests/unit/deploy-status.test.js package.json scripts/install.sh scripts/update.sh docs/dashboard-extraction.md
git commit -m "[feat] US-0265: add deploy-status.js CLI tool and state file"
```

---

## Task 3: Conductor & Keystone Integration (US-0266)

**Files:**

- Modify: `docs/agents/DM_AGENT.md`

**Interfaces:**

- Consumes: `agents.config.json` Phase 7 entry (from Task 1)
- Produces: Updated `DM_AGENT.md` with 9-agent table, Phase 7 invocation, out-of-band dispatch, incident response

---

- [ ] **Step 1: Update sub-agent table in `DM_AGENT.md`**

Find the `## Your 8 Sub-Agents` section and update it:

```markdown
## Your 9 Sub-Agents

Read the agent roster from `agents.config.json`. The table below shows the generic roles — the config file has the authoritative names and instruction file paths.

| Role              | When to Spawn                       |
| ----------------- | ----------------------------------- |
| Product Owner     | Phase 1: Blueprint                  |
| Architect         | Phase 2: Architect                  |
| Code Reviewer     | After each phase, before merge      |
| UI Designer       | Phase 3: With Frontend Dev          |
| Backend Dev       | Phase 3: Parallel with Frontend     |
| Frontend Dev      | Phase 3: Parallel with Backend      |
| Functional Tester | Phase 5: After integration          |
| Automation Tester | Phase 5: Parallel with Func Tester  |
| Deploy            | Phase 7: After Polish; or on-demand |
```

- [ ] **Step 2: Add Phase 7 invocation instructions**

After the existing phase dispatch sections, add:

```markdown
## Phase 7: Dispatching Deploy

After Polish (Phase 6) completes and all Phase 6 branches are merged to `develop`:

1. Read `docs/deploy-status.json` — note current SHA on `staging`
2. Confirm staging is `healthy` (required before production promotion)
3. Spawn Deploy with this context:
```

Read docs/agents/DEPLOY_AGENT.md for your full instructions.
Read project.md for project-specific context.

Context:

- Current cycle: <cycle N>
- Story just completed: <US-XXXX>
- Staging SHA: <sha from deploy-status.json>
- CI status: <passed/failed from last ciRun entry>
- Production promotion approval: GRANTED (Conductor authorises this Phase 7 deploy)

Your task:

- Promote staging → production for SHA <sha>
- Run health checks on production after deploy
- Report back: environment health report + any open incidents

Work on branch: hotfix/<story> or develop (no new branch needed for deploy-only work)
When done: update deploy-status.json via CLI and report results.

````

- [ ] **Step 3: Add out-of-band dispatch protocol**

```markdown
## Out-of-Band Deploy Dispatch

Conductor may invoke Deploy at any phase for the following triggers:

| Trigger              | Context to pass                                             |
|----------------------|-------------------------------------------------------------|
| Hotfix release       | Fix branch, target SHA, environments to deploy              |
| New CI pipeline      | Point to docs/ci-contract.md; ask Deploy to scaffold        |
| CI optimization      | Current workflow file paths; describe the slowness/failure  |
| Environment setup    | Target environment name; describe infra requirements        |
| Infra-as-code change | Which files to update; what architectural change drives it  |

Always include: current story context, any relevant docs/ci-contract.md path, expected deliverable.
````

- [ ] **Step 4: Add incident response section**

```markdown
## Handling Deploy Incidents

When Deploy reports a structured incident, use this decision table:

| Incident type                | Next action                                           |
| ---------------------------- | ----------------------------------------------------- |
| `code`                       | Dispatch Forge (backend) or Pixel (frontend) to fix   |
| `infra`                      | Dispatch Keystone to redesign the affected component  |
| `flaky-test`                 | Ask Deploy if retry resolved it; if not → Sentinel    |
| `config`                     | Escalate to human — missing secrets need manual setup |
| Hard failure + auto-rollback | Confirm rollback successful; dispatch fix agent       |
| `degraded` (ambiguous)       | Investigate logs; decide fix vs accept vs rollback    |

After dispatching a fix, re-dispatch Deploy once the fix branch is merged to verify the environment recovers.
```

- [ ] **Step 5: Run full test suite**

```bash
npm test
```

Expected: All tests pass (no regressions from docs-only changes).

- [ ] **Step 6: Commit**

```bash
git add docs/agents/DM_AGENT.md
git commit -m "[docs] US-0266: update DM_AGENT with Phase 7, out-of-band dispatch, incident response"
```

---

## Task 4: Dashboard Deploy Panel (US-0267)

**Files:**

- Modify: `tools/generate-dashboard.js` (add `DEPLOY_STATUS_PATH`, `renderDeployPanel()`, extend `generateHTML()` and `generate()`)

**Interfaces:**

- Consumes: `docs/deploy-status.json` — `{ environments, activeDeployment, ciRuns, incidents, promotionHistory }`
- Consumes: `formatElapsed(date)` — already exported from `generate-dashboard.js`, returns `"Xm Ys"` string
- Produces: `renderDeployPanel(deploy)` — returns HTML string for the Deploy panel widget

---

- [ ] **Step 1: Add `DEPLOY_STATUS_PATH` constant**

In `tools/generate-dashboard.js`, find the block near line 72:

```javascript
const STATUS_PATH = path.join(GIT_ROOT, 'docs', 'sdlc-status.json');
```

Add immediately after:

```javascript
const DEPLOY_STATUS_PATH = path.join(GIT_ROOT, 'docs', 'deploy-status.json');
```

- [ ] **Step 2: Add `renderDeployPanel()` function**

Find the `function generateHTML(status)` declaration (line 316). Add the following function immediately before it:

```javascript
function renderDeployPanel(deploy) {
  const allIdle =
    deploy && Object.values(deploy.environments || {}).every((e) => e.status === 'idle') && !deploy.activeDeployment;

  if (!deploy || allIdle) {
    return `<div class="deploy-panel" id="deploy-panel">
      <div class="section-header">DEPLOY</div>
      <p style="color:var(--mc-dim);font-size:12px;margin-top:8px;font-style:italic;">No deployments yet</p>
    </div>`;
  }

  function dotFor(status) {
    const pulse = status === 'deploying' ? 'style="animation:livePulse 1s infinite"' : '';
    const cls = { healthy: 'ok', deploying: 'ok', degraded: 'warn', down: 'err', 'rolled-back': 'err' }[status] || '';
    return `<span class="live-dot ${cls}" ${pulse}></span>`;
  }

  const envRows = ['dev', 'staging', 'production']
    .map((name) => {
      const e = (deploy.environments || {})[name] || { status: 'idle', sha: null, lastDeployStory: null };
      const sha = e.sha
        ? `<code style="font-size:10px;opacity:.8">${esc(e.sha.slice(0, 7))}</code>`
        : '<span style="opacity:.4">—</span>';
      const story = e.lastDeployStory
        ? `<span style="color:var(--mc-dim);font-size:10px;margin-left:4px">${esc(e.lastDeployStory)}</span>`
        : '';
      return `<div class="deploy-env-row">${dotFor(e.status)}<span class="deploy-env-name">${esc(name)}</span>${sha}${story}</div>`;
    })
    .join('');

  let activeRow = '';
  if (deploy.activeDeployment) {
    const ad = deploy.activeDeployment;
    const from = ad.from ? `${esc(ad.from)} → ` : '';
    const elapsed = ad.startedAt ? formatElapsed(new Date(ad.startedAt)) : '';
    activeRow = `<div class="deploy-section-label" style="margin-top:8px">ACTIVE DEPLOYMENT</div>
      <div class="deploy-active-row" style="font-size:11px;font-family:var(--mc-mono)">${from}${esc(ad.to)} · ${esc(ad.story || '—')} · ${esc(elapsed)}</div>`;
  }

  const lastCi = deploy.ciRuns && deploy.ciRuns.length ? deploy.ciRuns[deploy.ciRuns.length - 1] : null;
  const ciText = lastCi ? `<span style="font-size:11px">${esc(lastCi.workflow)} · ${esc(lastCi.status)}</span>` : '';

  const openCount = (deploy.incidents || []).filter((i) => !i.resolvedAt).length;
  const incBadge =
    openCount > 0
      ? `<span style="color:var(--mc-danger);font-weight:600" class="deploy-incident-count">${openCount} open</span>`
      : `<span style="color:var(--mc-ok)" class="deploy-incident-count">0 open</span>`;

  return `<div class="deploy-panel" id="deploy-panel">
    <div class="section-header">DEPLOY</div>
    <div class="deploy-envs" style="margin-top:6px">${envRows}</div>
    ${activeRow}
    <div class="deploy-footer" style="margin-top:8px;font-size:11px;display:flex;gap:12px;flex-wrap:wrap">
      <span class="deploy-section-label">LAST CI</span>${ciText}
      <span class="deploy-section-label">INCIDENTS</span>${incBadge}
    </div>
  </div>`;
}
```

- [ ] **Step 3: Extend `generateHTML` to accept `deployStatus`**

Change the function signature from:

```javascript
function generateHTML(status) {
```

to:

```javascript
function generateHTML(status, deployStatus) {
```

Then find where the HTML string is assembled and insert the Deploy panel. Search for a section like `renderPipelineSection` or `renderMetricsStrip` and add after it:

```javascript
${renderDeployPanel(deployStatus || null)}
```

Place it in the main content area, after the pipeline section and before the agent roster or activity log — search for the comment block referencing US-0148/AC-0541 (the pipeline section) and insert after it.

- [ ] **Step 4: Extend `generate()` to read `deploy-status.json`**

Find `function generate()` (line 4322). Find where it reads `STATUS_PATH` (sdlc-status.json). Add deploy-status.json reading alongside it:

```javascript
// Read deploy-status.json (optional — may not exist for new projects)
let deployStatus = null;
try {
  if (fs.existsSync(DEPLOY_STATUS_PATH)) {
    deployStatus = JSON.parse(fs.readFileSync(DEPLOY_STATUS_PATH, 'utf8'));
  }
} catch (e) {
  console.warn('[generate-dashboard] could not read deploy-status.json:', e.message);
}
```

Then pass it to `generateHTML`:

```javascript
const html = generateHTML(status, deployStatus);
```

- [ ] **Step 5: Run dashboard generation and verify panel**

```bash
npm run dashboard
```

Open `docs/dashboard.html`. Verify the Deploy panel renders. Since `deploy-status.json` was created in Task 2, it should show "No deployments yet" (all envs idle).

To test with active data:

```bash
npm run agent:deploy-start -- --env staging --sha abc1234 --from dev --story US-0264
npm run dashboard
```

Open `docs/dashboard.html`. Verify the Deploy panel shows `staging` as `deploying` with sha `abc1234`.

Reset afterwards:

```bash
npm run agent:deploy-init
```

- [ ] **Step 6: Run full test suite**

```bash
npm test
```

Expected: All tests pass.

- [ ] **Step 7: Commit**

```bash
git add tools/generate-dashboard.js
git commit -m "[feat] US-0267: add Deploy panel to Agentic Dashboard"
```

---

## Task 5: Dashboard Alerts, Phase 7 Timeline & Test Harness (US-0268)

**Files:**

- Modify: `tools/generate-dashboard.js` (extend inline JS: `refreshState`, add `runDeployAlertCheck`, `patchDeployPanel`)
- Modify: `tests/unit/generate-dashboard.test.js` (update agent count 9→10, add 2 Deploy fixtures)

**Interfaces:**

- Consumes: `renderDeployPanel(deploy)` from Task 4
- Consumes: `generateHTML(status, deployStatus)` from Task 4
- Produces: extended `refreshState()` that also fetches `deploy-status.json`

---

- [ ] **Step 1: Write the failing tests**

Open `tests/unit/generate-dashboard.test.js`. The agent names and phases are declared as constants at the top of the file (~lines 20–29). Update both:

```javascript
// Replace CANONICAL_PHASES (~line 20) — add Phase 7:
const CANONICAL_PHASES = [
  { id: 1, name: 'Blueprint', agents: ['Compass'], deliverables: ['refined ACs', 'priority list'] },
  { id: 2, name: 'Architect', agents: ['Keystone'], deliverables: ['scaffold', 'types', 'service stubs'] },
  { id: 3, name: 'Build', agents: ['Pixel', 'Forge', 'Palette'], deliverables: ['implementation', 'unit tests'] },
  { id: 4, name: 'Integration', agents: ['Pixel'], deliverables: ['wired services', 'e2e flows'] },
  { id: 5, name: 'Test', agents: ['Sentinel', 'Circuit'], deliverables: ['test report', 'coverage'] },
  { id: 6, name: 'Polish', agents: ['Pixel', 'Forge'], deliverables: ['bug fixes', 'demo prep'] },
  {
    id: 7,
    name: 'Deploy',
    agents: ['Deploy'],
    deliverables: ['deployed sha', 'environment health report', 'open incidents'],
  },
];

// Replace AGENT_NAMES (~line 29) — add Deploy:
const AGENT_NAMES = [
  'Conductor',
  'Compass',
  'Keystone',
  'Lens',
  'Palette',
  'Forge',
  'Pixel',
  'Sentinel',
  'Circuit',
  'Deploy',
];
```

The existing AC-0426 and AC-0427 tests iterate these constants automatically — no other changes needed for those tests.

Then add two new test cases at the end of the file:

````javascript
describe('Deploy panel rendering', () => {
  const { generateHTML } = require('../../tools/generate-dashboard.js');

  it('renders deploy panel with active deployment when deployStatus provided', () => {
    const deployStatus = {
      environments: {
        dev:        { sha: 'aaa1111', status: 'healthy',   lastDeployAt: new Date().toISOString(), lastDeployStory: 'US-0264' },
        staging:    { sha: 'bbb2222', status: 'deploying', lastDeployAt: new Date().toISOString(), lastDeployStory: 'US-0264' },
        production: { sha: 'ccc3333', status: 'healthy',   lastDeployAt: new Date().toISOString(), lastDeployStory: 'US-0261' },
      },
      activeDeployment: { from: 'staging', to: 'production', sha: 'bbb2222', story: 'US-0264', startedAt: new Date().toISOString() },
      ciRuns: [{ workflow: 'plan-visualizer.yml', status: 'passed', runId: null, recordedAt: new Date().toISOString() }],
      incidents: [],
      promotionHistory: [],
    };
    const html = generateHTML(makeHealthyFixture(), deployStatus);
    expect(html).toContain('id="deploy-panel"');
    expect(html).toContain('staging');
    expect(html).toContain('production');
    expect(html).toContain('bbb2222');
    expect(html).toContain('plan-visualizer.yml');
    expect(html).toContain('0 open');
  });

  it('renders critical incident badge when deploy-status has open incident', () => {
    const deployStatus = {
      environments: {
        dev:        { sha: null, status: 'idle', lastDeployAt: null, lastDeployStory: null },
        staging:    { sha: null, status: 'idle', lastDeployAt: null, lastDeployStory: null },
        production: { sha: 'abc1234', status: 'down', lastDeployAt: new Date().toISOString(), lastDeployStory: 'US-0264' },
      },
      activeDeployment: null,
      ciRuns: [],
      incidents: [{
        id: 1, env: 'production', type: 'infra', severity: 'critical',
        description: 'Health check failing', suggestedResolution: 'Rollback',
        suggestedOwner: 'Deploy', autoRemediationAttempted: false,
        resolvedAt: null, openedAt: new Date().toISOString(),
      }],
      promotionHistory: [],
    };
    const html = generateHTML(makeHealthyFixture(), deployStatus);
    expect(html).toContain('id="deploy-panel"');
    expect(html).toContain('1 open');
  });
});

- [ ] **Step 2: Run tests to verify they fail**

```bash
npm test -- --testPathPattern=generate-dashboard
````

Expected: The agent count test fails (10 expected, 9 found), and the two new Deploy panel tests fail.

- [ ] **Step 3: Fix the agent count test**

The 10-agent fixture (added in Step 1) already covers AC-1043 once `generateHTML` accepts the updated fixture. Run tests again after ensuring the fixture has the Deploy entry. The agent roster test should now pass.

- [ ] **Step 4: Verify the Deploy panel tests pass**

The `renderDeployPanel` function added in Task 4 already handles the fixtures above. Run:

```bash
npm test -- --testPathPattern=generate-dashboard
```

Expected: All generate-dashboard tests pass including the 2 new ones.

- [ ] **Step 5: Extend inline `refreshState()` to also fetch `deploy-status.json`**

In `tools/generate-dashboard.js`, find the `refreshState` function in the inline JS string (near line 4159). The function currently ends with:

```javascript
runAlertCheck(newStatus);
_lastFetchedAt = Date.now();
```

Add deploy-status.json fetching immediately after the `runAlertCheck(newStatus)` line:

```javascript
// Fetch deploy-status.json for live Deploy panel updates and alerts
try {
  var dRes = await fetch('./deploy-status.json', { cache: 'no-store' });
  if (dRes && dRes.ok) {
    var deployStatus = await dRes.json();
    patchDeployPanel(deployStatus);
    runDeployAlertCheck(deployStatus);
  }
} catch (_e) {
  // deploy-status.json may not exist — silent skip, static panel remains
}
```

- [ ] **Step 6: Add `runDeployAlertCheck` to inline JS**

Find `function runAlertCheck(status)` in the inline JS (near line 3428). Add the following new function immediately after it. This mirrors the existing `runAlertCheck` pattern — it collects alerts, plays audio, and calls `sendNotification` (the same helpers already used on lines 3492–3503):

```javascript
function runDeployAlertCheck(deployStatus) {
  if (!deployStatus || !deployStatus.environments) return;
  var criticals = [];
  var warnings = [];
  Object.keys(deployStatus.environments).forEach(function (envName) {
    var state = deployStatus.environments[envName];
    if (state.status === 'down') {
      _applyBlockedUI({ agent: 'Deploy', task: envName + ' is DOWN — check deploy-status.json' });
      criticals.push({
        title: 'CRITICAL: ' + envName + ' environment is down',
        body: 'Deploy reports ' + envName + ' is unreachable. Check deploy-status.json for incident details.',
      });
    } else if (state.status === 'degraded') {
      warnings.push({
        title: 'WARNING: ' + envName + ' environment degraded',
        body: envName + ' is responding but degraded. Monitor deploy-status.json.',
      });
    }
  });
  if (criticals.length > 0) {
    playBeep(440, 0.25, 'square');
    setTimeout(function () {
      playBeep(880, 0.25, 'square');
    }, 280);
    setTimeout(function () {
      playBeep(440, 0.25, 'square');
    }, 560);
    criticals.forEach(function (a) {
      sendNotification(a.title, a.body);
    });
  } else if (warnings.length > 0) {
    playBeep(880, 0.3);
    setTimeout(function () {
      playBeep(1046, 0.4);
    }, 350);
    warnings.forEach(function (a) {
      sendNotification(a.title, a.body);
    });
  }
}
```

- [ ] **Step 7: Add `patchDeployPanel` to inline JS**

Add immediately after `runDeployAlertCheck`:

```javascript
function patchDeployPanel(deployStatus) {
  var panel = document.getElementById('deploy-panel');
  if (!panel || !deployStatus) return;
  // Update open incident count without a full re-render
  var badge = panel.querySelector('.deploy-incident-count');
  if (badge) {
    var openCount = (deployStatus.incidents || []).filter(function (i) {
      return !i.resolvedAt;
    }).length;
    badge.textContent = openCount + ' open';
    badge.style.color = openCount > 0 ? 'var(--mc-danger)' : 'var(--mc-ok)';
  }
}
```

- [ ] **Step 8: Verify Phase 7 renders in pipeline timeline**

```bash
npm run init:status
npm run dashboard
```

Open `docs/dashboard.html`. Verify the pipeline timeline shows 7 segments: Blueprint, Architect, Build, Integration, Test, Polish, Deploy.

- [ ] **Step 9: Run full test suite and coverage check**

```bash
npm test
npm run test:coverage
```

Expected: All tests pass, coverage ≥ 80%.

- [ ] **Step 10: Commit**

```bash
git add tools/generate-dashboard.js tests/unit/generate-dashboard.test.js
git commit -m "[feat] US-0268: deploy alerts, Phase 7 timeline, test harness for Deploy panel"
```

---

## Task 6: Mark BUG-0254, BUG-0255, BUG-0256 as Fixed (verification + BUGS.md update)

**Files:**

- Modify: `docs/BUGS.md` (Status: Open → Fixed for three bugs)

**Context:** All three bugs were already fixed in earlier sessions before this plan was written. The code evidence:

- BUG-0254: `tools/lib/render-shell.js` lines 131–146 — `f-hier-risk` and `f-hier-sort` are both inside `fgrp-hier` within the unified `filter-bar`, and `f-hier-sort` has 6 sort options (default/id/status/priority/estimate/risk/cost).
- BUG-0255: `tools/lib/render-tabs.js` lines 963–964 — `velocityLabel` correctly uses `comp.storiesPerWeek.toFixed(1) + ' st/wk'`; `velocitySublabel` uses `comp.velocityWeeks` as a sub-label only.
- BUG-0256: `tools/lib/render-tabs.js` lines 2476–2487 — comment literally says `// BUG-0256: deterministic order`; sort is by L-ID descending within epic groups, epics ascending, `_ungrouped` last.

---

- [ ] **Step 1: Verify BUG-0254 in the code**

```bash
grep -n "fgrp-hier\|f-hier-risk\|f-hier-sort" tools/lib/render-shell.js
```

Expected output: lines showing `f-hier-risk` and `f-hier-sort` both inside `fgrp-hier` with 6 sort options. If both appear, the bug is fixed.

- [ ] **Step 2: Verify BUG-0255 in the code**

```bash
grep -n "velocityLabel\|velocitySublabel\|storiesPerWeek\|velocityWeeks" tools/lib/render-tabs.js
```

Expected: `velocityLabel` on its own line using `storiesPerWeek.toFixed(1)`. If present, the bug is fixed.

- [ ] **Step 3: Verify BUG-0256 in the code**

```bash
grep -n "BUG-0256\|lessonIdNum\|L-ID descending" tools/lib/render-tabs.js
```

Expected: The BUG-0256 comment and the sort function using `lessonIdNum`. If present, the bug is fixed.

- [ ] **Step 4: Update BUGS.md — mark all three Fixed**

In `docs/BUGS.md`, for each of the three bugs, change:

```
    Status: Open
    GH Issue:
    Fix Branch:
    Lesson Encoded: No
```

For **BUG-0254** replace with:

```
    Status: Fixed
    GH Issue: #1155
    Fix Branch: (pre-dates this plan — fix was in render-shell.js, commit unknown)
    Fix: Both risk filter and sort dropdown rendered inside `fgrp-hier` span in the unified filter-bar (render-shell.js:131-146). Sort dropdown offers 6 options: default/id/status/priority/estimate/risk/cost.
    Lesson Encoded: No
```

For **BUG-0255** replace with:

```
    Status: Fixed
    GH Issue: #1156
    Fix Branch: (pre-dates this plan — fix was in render-tabs.js)
    Fix: velocityLabel correctly uses `comp.storiesPerWeek.toFixed(1) + ' st/wk'` (render-tabs.js:963). velocityWeeks appears only in velocitySublabel as context label.
    Lesson Encoded: No
```

For **BUG-0256** replace with:

```
    Status: Fixed
    GH Issue: #1157
    Fix Branch: (pre-dates this plan — fix was in render-tabs.js)
    Fix: renderLessonsTab() sorts lessons by L-ID descending within each epic group, epics ascending, _ungrouped last (render-tabs.js:2476-2487). Fix comment references this bug ID.
    Lesson Encoded: No
```

- [ ] **Step 5: Run full test suite to confirm no regressions**

```bash
npm test
```

Expected: All tests pass.

- [ ] **Step 6: Commit**

```bash
git add docs/BUGS.md
git commit -m "[docs] BUG-0254/BUG-0255/BUG-0256: mark as Fixed — all resolved in earlier sessions"
```

---

## Task 7: BUG-0258 — ID Registry resync + standalone check script

**Files:**

- Create: `tools/check-id-registry.js`
- Modify: `docs/ID_REGISTRY.md` (resync all sequences for this session)
- Modify: `package.json` (add `check:ids` npm script)
- Modify: `docs/BUGS.md` (mark BUG-0258 Fixed)

**Context:** EPIC-0036's cross-entity validator (`tools/lib/repository/validators/cross-entity.js:52`) already emits `'id-registry-drift'` warnings at write time through the repository layer. BUG-0258's fix is a standalone CLI that non-repository tooling can run (e.g., pre-commit, CI) to detect drift against raw markdown, plus an immediate resync for IDs assigned in this session (EPIC-0046, US-0264–US-0268, AC-1023–AC-1047).

---

- [ ] **Step 1: Create `tools/check-id-registry.js`**

```javascript
#!/usr/bin/env node
'use strict';

/**
 * check-id-registry.js — Validate docs/ID_REGISTRY.md against actual IDs in use.
 *
 * Scans source markdown files for the highest ID in each sequence and compares
 * against the "Next Available ID" in ID_REGISTRY.md.
 *
 * Usage:
 *   node tools/check-id-registry.js           # report drift only
 *   node tools/check-id-registry.js --fix     # also update ID_REGISTRY.md
 */

const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const REGISTRY_PATH = path.join(ROOT, 'docs', 'ID_REGISTRY.md');

const SOURCES = {
  EPIC: ['docs/RELEASE_PLAN.md', 'docs/BUGS.md'],
  US: ['docs/RELEASE_PLAN.md', 'docs/BUGS.md'],
  TASK: ['docs/RELEASE_PLAN.md'],
  AC: ['docs/RELEASE_PLAN.md'],
  TC: ['docs/TEST_CASES.md', 'docs/RELEASE_PLAN.md'],
  BUG: ['docs/BUGS.md'],
  L: ['docs/LESSONS.md'],
  ENH: ['docs/RELEASE_PLAN.md', 'docs/BUGS.md'],
};

function findMax(files, prefix) {
  const re = new RegExp(`\\b${prefix}-(\\d+)\\b`, 'g');
  let max = 0;
  for (const rel of files) {
    const abs = path.join(ROOT, rel);
    if (!fs.existsSync(abs)) continue;
    const text = fs.readFileSync(abs, 'utf8');
    let m;
    while ((m = re.exec(text)) !== null) {
      const n = parseInt(m[1], 10);
      if (n > max) max = n;
    }
  }
  return max;
}

function readRegistry() {
  return fs.readFileSync(REGISTRY_PATH, 'utf8');
}

function parseRegistryNext(content, prefix) {
  const re = new RegExp(`^\\|\\s*${prefix}\\s*\\|\\s*${prefix}-(\\d+)\\s*\\|`, 'm');
  const m = content.match(re);
  return m ? parseInt(m[1], 10) : null;
}

function updateRegistryNext(content, prefix, nextNum) {
  const padded = String(nextNum).padStart(4, '0');
  const lastNum = String(nextNum - 1).padStart(4, '0');
  // Match the table row for this prefix and replace both ID columns
  return content.replace(
    new RegExp(`(\\|\\s*${prefix}\\s*\\|\\s*)${prefix}-\\d+(\\s*\\|\\s*)${prefix}-\\d+(\\s*\\|)`, 'm'),
    `$1${prefix}-${padded}$2${prefix}-${lastNum}$3`,
  );
}

const fix = process.argv.includes('--fix');
let content = readRegistry();
let anyDrift = false;
let anyFix = false;

console.log(`\nID Registry check — ${REGISTRY_PATH}\n`);

for (const [prefix, files] of Object.entries(SOURCES)) {
  const maxActual = findMax(files, prefix);
  const currentNext = parseRegistryNext(content, prefix);

  if (currentNext === null) {
    console.log(`  SKIP  ${prefix}: not found in registry`);
    continue;
  }

  const needsNext = maxActual + 1;
  if (currentNext <= maxActual) {
    anyDrift = true;
    const curStr = `${prefix}-${String(currentNext).padStart(4, '0')}`;
    const maxStr = `${prefix}-${String(maxActual).padStart(4, '0')}`;
    const fixStr = `${prefix}-${String(needsNext).padStart(4, '0')}`;
    if (fix) {
      content = updateRegistryNext(content, prefix, needsNext);
      anyFix = true;
      console.log(`  FIXED ${prefix}: ${curStr} → ${fixStr}  (max in use: ${maxStr})`);
    } else {
      console.log(`  DRIFT ${prefix}: registry=${curStr} but max in use=${maxStr}, should be ${fixStr}`);
    }
  } else {
    const maxStr = maxActual > 0 ? `${prefix}-${String(maxActual).padStart(4, '0')}` : '(none found)';
    console.log(`  OK    ${prefix}: next=${prefix}-${String(currentNext).padStart(4, '0')}  (max in use: ${maxStr})`);
  }
}

if (anyFix) {
  fs.writeFileSync(REGISTRY_PATH, content);
  console.log('\n✅  ID_REGISTRY.md updated. Run again to verify.\n');
} else if (anyDrift) {
  console.error('\n⚠  Drift detected. Run with --fix to update ID_REGISTRY.md.\n');
  process.exit(1);
} else {
  console.log('\n✅  All sequences in sync.\n');
}
```

- [ ] **Step 2: Run the check to see current drift**

```bash
node tools/check-id-registry.js
```

Expected: Drift reported for EPIC (0046 used, registry says 0046 = next), US (0264–0268 used), and AC (1023–1047 used). Any other drifted sequences will also appear.

- [ ] **Step 3: Fix the drift**

```bash
node tools/check-id-registry.js --fix
```

Expected: `✅  ID_REGISTRY.md updated.`

- [ ] **Step 4: Verify the fix**

```bash
node tools/check-id-registry.js
```

Expected: `✅  All sequences in sync.`

- [ ] **Step 5: Add `check:ids` npm script to `package.json`**

In the `"scripts"` section of `package.json`:

```json
"check:ids": "node tools/check-id-registry.js"
```

- [ ] **Step 6: Verify script works**

```bash
npm run check:ids
```

Expected: `✅  All sequences in sync.`

- [ ] **Step 7: Update BUG-0258 in `docs/BUGS.md`**

Find the BUG-0258 entry and change `Status: Open` to:

```
    Status: Fixed
    GH Issue: #1158
    Fix Branch: (this plan)
    Fix: tools/check-id-registry.js added — detects and optionally fixes drift against raw markdown. EPIC-0036's cross-entity validator (tools/lib/repository/validators/cross-entity.js:52) provides write-time enforcement via the repository layer. Run `npm run check:ids` before any session close.
    Lesson Encoded: No
```

- [ ] **Step 8: Run full test suite**

```bash
npm test
```

Expected: All tests pass.

- [ ] **Step 9: Commit**

```bash
git add tools/check-id-registry.js package.json docs/ID_REGISTRY.md docs/BUGS.md
git commit -m "[fix] BUG-0258: add check-id-registry.js; resync registry for EPIC-0046 session"
```

---

## Final Verification

- [ ] Run `npm test` — all tests pass
- [ ] Run `npm run test:coverage` — coverage ≥ 80%
- [ ] Run `npm run lint` — no errors
- [ ] Run `npm run check:ids` — all sequences in sync
- [ ] Run `npm run dashboard` — dashboard renders with Deploy agent card, 7-phase timeline, and Deploy panel
- [ ] Verify `deploy-64.png`, `deploy-160.png`, `deploy-320.png` portraits appear in the agent roster
- [ ] Open PR `feature/US-0264-deploy-agent-identity` → `develop` (or squash all tasks into one PR per story)
