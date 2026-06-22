# Deploy Agent — Design Spec

**Date:** 2026-06-21
**Epic:** EPIC-0046
**Status:** Approved for implementation
**Author:** Kamal Syed

---

## Overview

This spec defines the **Deploy agent** — a tenth member of the PlanVisualizer agentic pipeline with the role of DevOps Engineer. Deploy owns the full deployment surface: CI/CD workflow files, infrastructure-as-code, and the dev → staging → production environment promotion ladder. It runs as a new **Phase 7** at the end of each pipeline cycle and is also dispatchable out-of-band by Conductor for hotfix releases, environment setup, and CI pipeline creation or optimization.

Deploy reports structured incident triage back to Conductor rather than raw logs. It auto-rolls back on hard failures and escalates ambiguous failures for Conductor's decision. It never writes application code.

---

## Goals

- Add Deploy as a fully-specified tenth agent in `agents.config.json` and `docs/agents/DEPLOY_AGENT.md`
- Extend the 6-phase BLAST pipeline to 7 phases, with Phase 7: Deploy
- Create `tools/deploy-status.js` CLI and `docs/deploy-status.json` state file, mirroring the `update-sdlc-status.js` / `sdlc-status.json` pattern
- Update Conductor (`DM_AGENT.md`) with Phase 7 invocation, out-of-band dispatch, and incident response protocols
- Update Keystone (`ARCHITECT_AGENT.md`) to produce a `docs/ci-contract.md` at Phase 2
- Add a Deploy panel to the Agentic Dashboard (`tools/generate-dashboard.js`)
- Wire Deploy's portrait images (already present at `docs/agents/images/optimized/deploy-{64,160,320}.png`)
- Add Phase 7 to the dashboard pipeline timeline
- Extend dashboard alert system for environment `down` and `degraded` states

## Non-Goals

- Deploy does not write application code — that stays with Forge and Pixel
- Deploy does not manage cloud provider accounts, billing, or access control
- Claude Code agent wrapper files (`.claude/agents/pv-*.md`) are deferred to `US-0269` in `EPIC-0014`
- Full deployment history tab in the dashboard is deferred to a follow-up epic

---

## Design Decisions

| Question                | Decision                                                                                     | Rationale                                                                                            |
| ----------------------- | -------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------- |
| Pipeline placement      | Phase 7 (default) + on-demand out-of-band                                                    | Matches real DevOps: planned releases plus reactive hotfixes                                         |
| Environments            | dev → staging → production                                                                   | Full promotion ladder; dev→staging requires CI green; staging→production requires Conductor approval |
| Escalation model        | Classify then report (structured incident)                                                   | Conductor gets a categorized problem with suggested owner, not raw logs                              |
| CI/CD scope             | Full ownership: workflows + infra-as-code                                                    | Clean boundary — Deploy owns everything needed to ship, dev agents own everything needed to build    |
| Rollback authority      | Auto on hard failures; escalate ambiguous                                                    | Production restored immediately on objective failure; Conductor keeps oversight on judgment calls    |
| CI knowledge source     | Keystone produces `docs/ci-contract.md` at Phase 2; Deploy audits codebase for optimizations | Keystone knows intent; Deploy knows execution. Optimization-only passes use codebase audit alone     |
| Implementation approach | Structured agent + new CLI tool (Option B)                                                   | Consistent with existing `update-sdlc-status.js` pattern; clean separation of concerns               |

---

## Agent Identity

```json
"Deploy": {
  "role": "DevOps Engineer",
  "icon": "🚀",
  "color": "oklch(48% 0.20 195)",
  "avatar": "deploy",
  "instructionFile": "docs/agents/DEPLOY_AGENT.md"
}
```

Portrait images already exist at:

- `docs/agents/images/optimized/deploy-64.png` (agent grid)
- `docs/agents/images/optimized/deploy-160.png` (spotlight)
- `docs/agents/images/optimized/deploy-320.png` (About modal)

---

## Pipeline Integration

### Phase 7 Addition

`agents.config.json` phases array gains a seventh entry:

```json
{
  "name": "Deploy",
  "agents": ["Deploy"],
  "deliverables": ["deployed sha", "environment health report", "open incidents"]
}
```

### Normal Cycle Flow

```
Phase 6: Polish (Pixel, Forge) completes
    ↓
Conductor dispatches Deploy for Phase 7
    ↓
Deploy reads ci-contract.md + deploy-status.json
    ↓
Deploy promotes staging → production (if staging is healthy and Conductor approves)
    ↓
Deploy runs health checks, records SHA, files deploy-complete
    ↓
Deploy reports: environment health report + any open incidents
    ↓
Conductor logs cycle-complete
```

### Out-of-Band Dispatch Triggers

Conductor may invoke Deploy at any phase for:

| Trigger              | Example                                                            |
| -------------------- | ------------------------------------------------------------------ |
| Hotfix release       | Critical bug fixed on `hotfix/*` branch needs production deploy    |
| New CI pipeline      | New project or repo has no GitHub Actions workflows                |
| CI optimization      | Existing workflow is slow or broken; no new check requirements     |
| Environment setup    | New `staging` environment needs scaffolding                        |
| Infra-as-code change | Dockerfile or deployment config needs updating alongside a feature |

---

## CI Knowledge: The CI Contract

### Problem

Deploy needs to know _what_ CI checks are required — not just how to implement them.

### Solution

**Keystone produces `docs/ci-contract.md`** at Phase 2 (Architect). This file is Deploy's authoritative source for CI requirements. For optimization-only passes (no new requirements), Deploy audits `package.json` scripts, existing workflow files, and Dockerfiles directly.

### `docs/ci-contract.md` Schema

```markdown
# CI Contract

## Test Commands

- Unit tests: `npm test`
- Coverage: `npm run test:coverage`
- Coverage threshold: 80%

## Lint

- Command: `npm run lint`
- Fail on: errors only (warnings allowed)

## Build

- Command: `npm run build`

## Required Secrets

- `GITHUB_TOKEN`: GitHub Pages deployment
- `NPM_TOKEN`: (if publishing)

## Deploy Targets

- staging: GitHub Pages (branch: develop)
- production: GitHub Pages (branch: main)

## Additional Checks

- Dependency audit: `npm audit --audit-level=moderate`
- CodeQL: JavaScript, security-extended query pack
```

A template lives at `docs/templates/ci-contract.md`. Keystone fills it in; Deploy reads it before creating or updating any workflow files.

---

## CLI Tool: `tools/deploy-status.js`

Mirrors `tools/update-sdlc-status.js` exactly in structure. Uses `atomicReadModifyWriteJson` from `orchestrator/atomic-write.js` for all writes.

### Commands

| Command           | Flags                                                | Effect                                                                        |
| ----------------- | ---------------------------------------------------- | ----------------------------------------------------------------------------- |
| `init`            | `[--no-overwrite]`                                   | Seeds blank `docs/deploy-status.json`                                         |
| `deploy-start`    | `--env --sha --story`                                | Sets env status → `deploying`, records activeDeployment                       |
| `deploy-complete` | `--env --sha`                                        | Sets env status → `healthy`, clears activeDeployment, records SHA + timestamp |
| `deploy-fail`     | `--env --reason`                                     | Sets env status → `degraded` or `down`, opens incident                        |
| `rollback`        | `--env --to-sha --reason`                            | Sets env status → `rolled-back`, records in promotionHistory, logs incident   |
| `promote`         | `--from --to --sha`                                  | Records env-to-env promotion in promotionHistory                              |
| `health-check`    | `--env --status`                                     | Updates env status (`ok`→`healthy`, `warn`→`degraded`, `fail`→`down`)         |
| `ci-status`       | `--workflow --status [--run-id]`                     | Appends entry to ciRuns[], trims to last 20                                   |
| `incident`        | `--env --type --severity --description --resolution` | Appends to incidents[], marks env with incident flag                          |

### `docs/deploy-status.json` Schema

```json
{
  "environments": {
    "dev": { "sha": null, "status": "idle", "lastDeployAt": null, "lastDeployStory": null },
    "staging": { "sha": null, "status": "idle", "lastDeployAt": null, "lastDeployStory": null },
    "production": { "sha": null, "status": "idle", "lastDeployAt": null, "lastDeployStory": null }
  },
  "activeDeployment": null,
  "ciRuns": [],
  "incidents": [],
  "promotionHistory": []
}
```

**Valid environment statuses:** `idle | deploying | healthy | degraded | down | rolled-back`

**Incident object shape:**

```json
{
  "id": "INC-001",
  "env": "production",
  "type": "code|infra|flaky-test|config",
  "severity": "low|medium|high|critical",
  "description": "...",
  "suggestedResolution": "...",
  "suggestedOwner": "Forge|Keystone|Deploy|human",
  "autoRemediationAttempted": false,
  "resolvedAt": null,
  "openedAt": "2026-06-21T10:00:00Z"
}
```

### npm Scripts (full set)

9 new entries in `package.json`:

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

---

## `DEPLOY_AGENT.md` — Instruction File Design

### Structure

```
# Deploy — DevOps Engineer Agent
> Role callout block

## Role
## BLAST Phase
## Mandatory Startup
## Core Responsibilities
## CI Contract Protocol
## Environment Promotion Protocol
## Incident Triage Protocol
## Rollback Protocol
## Escalation Rules
## Superpowers Skills
## Reporting Format (to Conductor)
```

### Mandatory Startup (5 steps)

1. Read `docs/agents/DEPLOY_AGENT.md` (this file)
2. Read `docs/deploy-status.json` (current environment state)
3. Read `docs/sdlc-status.json` (active cycle/story context)
4. Read `agents.config.json` (project identity, repo URL)
5. Read `AGENTS.md` (operating standards)

### 10 Core Responsibilities

| #   | Responsibility                                                                                                           |
| --- | ------------------------------------------------------------------------------------------------------------------------ |
| 1   | **CI/CD pipeline creation** — scaffold `.github/workflows/*.yml` from `docs/ci-contract.md` when no workflows exist      |
| 2   | **CI/CD pipeline updates** — modify existing workflows for new test steps, environments, or secrets                      |
| 3   | **Infrastructure-as-code** — own `Dockerfile`, `docker-compose.yml`, deployment manifests, env variable files            |
| 4   | **Environment promotion** — gate dev→staging on CI green; gate staging→production on Conductor approval                  |
| 5   | **CI monitoring** — poll active workflow runs, parse check results, detect regressions across runs                       |
| 6   | **Structured incident triage** — classify failure type and suggest resolution owner before escalating                    |
| 7   | **Auto-rollback** — execute rollback on hard failures (health check down, error rate spike); log with `rollback` command |
| 8   | **Dependency scanning** — run `npm audit` during deploy gate; block promotion on critical vulnerabilities                |
| 9   | **Environment variable auditing** — verify required env vars (from ci-contract.md) are present before promoting          |
| 10  | **Deploy receipt** — post a structured summary to `sdlc-status.json` log on every deploy attempt                         |

### Incident Report Format (sent to Conductor)

```
INCIDENT — <SEVERITY> — <ENV>
Type:                    <infra|code|flaky-test|config>
Description:             <what failed and how>
SHA:                     <deployed sha>
Story:                   <US-XXXX>
Suggested resolution:    <specific action>
Suggested owner:         <agent name or "human">
Auto-remediation:        <attempted: yes/no — what was tried>
CLI filed:               npm run agent:deploy-incident -- --env <env> ...
```

### Escalation Rules

| Failure type                          | Deploy action                           | Escalate to                |
| ------------------------------------- | --------------------------------------- | -------------------------- |
| Code bug in deployed artifact         | File incident, do NOT rollback          | Conductor → Forge or Pixel |
| Architecture / infra misconfiguration | File incident                           | Conductor → Keystone       |
| Flaky test (retry resolves)           | Retry once autonomously, log result     | No escalation if resolved  |
| Missing secrets / config              | File incident, block promotion          | Conductor → human          |
| Health check down (hard failure)      | Auto-rollback, then file incident       | Conductor (post-rollback)  |
| Degraded but alive (ambiguous)        | File incident, await Conductor decision | Conductor                  |

---

## Conductor & Keystone Changes

### `DM_AGENT.md` Changes

1. **Sub-agent table**: updated from 8 → 9 agents; Deploy row added with "Phase 7: Deploy" trigger
2. **Phase 7 invocation**: when Polish completes, Conductor reads `deploy-status.json` and spawns Deploy with: active cycle context, target SHA, Conductor approval flag for production promotion
3. **Out-of-band dispatch**: table of triggers (hotfix, new CI, optimization, env setup, infra change) with context to pass in each case
4. **Incident response**: how to parse Deploy's structured incident report; decision table mapping incident type → next dispatch

### `ARCHITECT_AGENT.md` Changes

New `## CI Contract` section added after the existing deliverables section:

> At Phase 2, produce `docs/ci-contract.md` using the template at `docs/templates/ci-contract.md`. This file is Deploy's authoritative source for CI requirements. Fill in: test commands, coverage threshold, lint command, build command, required secrets, deploy targets, and any additional checks. If the file already exists, update only the sections relevant to the current story's architectural changes.

---

## Dashboard Integration

### Deploy Panel (new widget in `generate-dashboard.js`)

Reads `docs/deploy-status.json` at generation time. Rendered in the main dashboard layout.

```
┌─ DEPLOY ──────────────────────────────────────────┐
│  ENVIRONMENTS                                      │
│  dev         ● healthy    sha: a3f2c1  US-0264    │
│  staging     ● deploying  sha: a3f2c1  US-0264    │
│  production  ● healthy    sha: 9b1e44  US-0261    │
│                                                    │
│  ACTIVE DEPLOYMENT                                 │
│  staging → production · US-0264 · 2m 14s          │
│                                                    │
│  LAST CI RUN                                       │
│  plan-visualizer.yml · passed · 3m ago            │
│                                                    │
│  INCIDENTS        0 open                           │
└────────────────────────────────────────────────────┘
```

Status dot colours (reuse existing `.live-dot` variants):

- `healthy` → `.ok` (green)
- `deploying` → `.warn` (amber, pulsing)
- `degraded` → `.warn` (amber, static)
- `down` / `rolled-back` → `.err` (red)
- `idle` → muted grey, no dot

Empty state: "No deployments yet" when `deploy-status.json` is absent or all envs are `idle`.

### Alert System Extension

`runAlertCheck()` gains two new triggers:

| Condition                   | Alert type | Visual                                                           |
| --------------------------- | ---------- | ---------------------------------------------------------------- |
| Any env status → `down`     | CRITICAL   | Red 4px viewport border + incident strip (same as agent BLOCKED) |
| Any env status → `degraded` | WARN       | Amber notification only                                          |

### Phase 7 Timeline

Handled automatically — `agents.config.json` phase 7 addition means the existing pipeline timeline renderer picks it up with no code changes.

### Agent Card

Deploy appears in roster row and agent grid via the standard renderer. `avatar: "deploy"` in `agents.config.json` wires up the pre-existing portraits automatically.

### Test Harness

`tests/unit/generate-dashboard.test.js`:

- Fixture agent count: 9 → 10; assert `"Deploy"` renders
- New fixture: healthy `deploy-status.json` with active deployment → Deploy panel renders correctly
- New fixture: `deploy-status.json` with one `critical` incident → alert markup present

---

## install.sh Wiring

`scripts/install.sh` §7 (dashboard extraction) gains Deploy CLI to its copy list:

```bash
# Existing copies:
cp tools/update-sdlc-status.js "$TARGET/tools/"
cp tools/init-sdlc-status.js   "$TARGET/tools/"
# New:
cp tools/deploy-status.js      "$TARGET/tools/"
```

`scripts/update.sh` §7 mirrors the same addition.

---

## Epic & User Stories

### EPIC-0046: Deploy Agent

```
EPIC-0046: Deploy Agent
Description: Add Deploy (DevOps Engineer) as a tenth agent in the agentic pipeline. Deploy owns CI/CD workflows, infrastructure-as-code, and the dev→staging→production environment ladder. Runs as Phase 7 by default; dispatchable out-of-band by Conductor for hotfix releases and infra changes. Includes tools/deploy-status.js CLI, docs/deploy-status.json state file, and a Deploy panel in the Agentic Dashboard.
Release Target: Release 2.3
Status: To Do
StartDate:
DoneDate:
Dependencies: EPIC-0013, EPIC-0016, EPIC-0019
```

---

### US-0264 — Agent Identity & Instruction File

```
US-0264 (EPIC-0046): As a Conductor, I want a Deploy agent with a full instruction file and CI contract template, so that I can dispatch it for DevOps tasks with clear responsibilities and escalation rules.
Priority: High (P0)
Estimate: M
Status: To Do
Branch: feature/US-0264-deploy-agent-identity
Dependencies: None
Acceptance Criteria:
  - [ ] AC-1023: agents.config.json gains a Deploy entry with role "DevOps Engineer", icon 🚀, color oklch(48% 0.20 195), avatar "deploy", instructionFile "docs/agents/DEPLOY_AGENT.md"
  - [ ] AC-1024: DEPLOY_AGENT.md created with mandatory startup (5 steps), BLAST Phase 7, 10 core responsibilities, CI contract protocol, environment promotion protocol, incident triage protocol, rollback protocol, escalation rules table, and Conductor reporting format
  - [ ] AC-1025: ARCHITECT_AGENT.md gains a ## CI Contract section instructing Keystone to produce docs/ci-contract.md during Phase 2
  - [ ] AC-1026: docs/templates/ci-contract.md created with all required fields: test commands, coverage threshold, lint command, build command, required secrets, deploy targets, additional checks
```

---

### US-0265 — CLI Tool & State File

```
US-0265 (EPIC-0046): As a Deploy agent, I want a structured CLI tool and state file, so that environment state is auditable and readable by the dashboard without parsing logs.
Priority: High (P0)
Estimate: L
Status: To Do
Branch: feature/US-0265-deploy-status-cli
Dependencies: US-0264
Acceptance Criteria:
  - [ ] AC-1027: tools/deploy-status.js implements all 9 commands (init, deploy-start, deploy-complete, deploy-fail, rollback, promote, health-check, ci-status, incident) using atomicReadModifyWriteJson from orchestrator/atomic-write.js
  - [ ] AC-1028: docs/deploy-status.json schema: environments map (dev/staging/production each with sha, status, lastDeployAt, lastDeployStory), activeDeployment, ciRuns[], incidents[], promotionHistory[]
  - [ ] AC-1029: init command seeds a blank deploy-status.json; idempotent with --no-overwrite flag; ci-status command trims ciRuns[] to the last 20 entries to prevent unbounded growth; init is documented in docs/dashboard-extraction.md alongside init-sdlc-status so new pipeline setups seed both state files
  - [ ] AC-1030: All 9 agent:deploy-* npm scripts added to package.json (init, start, complete, fail, rollback, promote, health, ci, incident)
  - [ ] AC-1031: scripts/install.sh §7 and update.sh §7 copy tools/deploy-status.js to target projects alongside existing dashboard tools
  - [ ] AC-1032: Unit tests cover all 9 command handlers in tests/unit/deploy-status.test.js
```

---

### US-0266 — Conductor & Keystone Integration

```
US-0266 (EPIC-0046): As a pipeline engineer, I want Conductor briefed on Deploy's Phase 7 role and out-of-band dispatch protocols, and Keystone briefed on producing CI contracts, so that the full 7-phase pipeline operates without manual coordination.
Priority: High (P0)
Estimate: S
Status: To Do
Branch: feature/US-0266-conductor-keystone-integration
Dependencies: US-0264
Acceptance Criteria:
  - [ ] AC-1033: DM_AGENT.md sub-agent table updated from 8 to 9 agents; Deploy row added with Phase 7 trigger
  - [ ] AC-1034: DM_AGENT.md gains Phase 7 invocation instructions: when to dispatch Deploy, what context to pass (active cycle, target SHA, production approval flag), what to expect back
  - [ ] AC-1035: DM_AGENT.md gains out-of-band dispatch protocol table: hotfix releases, new CI pipeline, CI optimization, environment setup, infra-as-code changes
  - [ ] AC-1036: DM_AGENT.md gains incident response section: how to interpret Deploy's structured incident report and decision table mapping incident type to next dispatch
  - [ ] AC-1037: agents.config.json phases array gains Phase 7: { "name": "Deploy", "agents": ["Deploy"], "deliverables": ["deployed sha", "environment health report", "open incidents"] }
```

---

### US-0267 — Dashboard Deploy Panel

```
US-0267 (EPIC-0046): As a pipeline engineer, I want a Deploy panel in the Agentic Dashboard showing live environment state, so that I can see where each environment stands at a glance without reading JSON.
Priority: High (P0)
Estimate: M
Status: To Do
Branch: feature/US-0267-dashboard-deploy-panel
Dependencies: US-0265, US-0266
Acceptance Criteria:
  - [ ] AC-1038: generate-dashboard.js reads docs/deploy-status.json at generation time and passes environment state to the template
  - [ ] AC-1039: Deploy panel renders environment ladder (dev / staging / production) with status dot, current SHA (first 7 chars), and related story reference
  - [ ] AC-1040: Active deployment row shows source→target env, related story, and elapsed time when activeDeployment is non-null
  - [ ] AC-1041: Last CI run result (workflow name, status, age) and open incident count render in the panel footer
  - [ ] AC-1042: Panel renders a graceful "No deployments yet" empty state when deploy-status.json is absent or all environments are idle
```

---

### US-0268 — Dashboard Alerts, Phase 7 Timeline & Test Harness

```
US-0268 (EPIC-0046): As a pipeline engineer, I want the dashboard to alert on environment failures, show Phase 7 in the pipeline timeline, and have test coverage for the Deploy panel, so that deploy incidents are as visible as agent blocks.
Priority: Medium (P1)
Estimate: S
Status: To Do
Branch: feature/US-0268-dashboard-alerts-tests
Dependencies: US-0267
Acceptance Criteria:
  - [ ] AC-1043: runAlertCheck() extended: environment status down fires a CRITICAL browser notification and triggers the red 4px viewport border + incident strip; degraded fires a WARN notification
  - [ ] AC-1044: Phase 7 Deploy segment renders in the pipeline timeline (automatic via agents.config.json phase update from US-0266; verify it renders correctly)
  - [ ] AC-1045: generate-dashboard.test.js updated to assert "Deploy" renders in the agent roster (fixture agent count updated to 10)
  - [ ] AC-1046: New fixture test: healthy deploy-status.json with one active deployment renders the Deploy panel environment ladder and active deployment row correctly
  - [ ] AC-1047: New fixture test: deploy-status.json with one open critical incident triggers the alert markup (red border class or incident strip element present in rendered HTML)
```

---

## Deferred Work

| Item                                                                         | Deferred to                            |
| ---------------------------------------------------------------------------- | -------------------------------------- |
| Claude Code agent wrapper files (`.claude/agents/pv-*.md`) for all 10 agents | US-0269 in EPIC-0014                   |
| Deployment history tab in the dashboard                                      | Future epic (EPIC-0047 or later)       |
| Cloud provider integrations (AWS, GCP, Vercel deploy targets)                | Future epic                            |
| Deploy agent model selection guidance                                        | US-0180 (already planned in EPIC-0014) |

---

## ID Registry Impact

After implementing this epic, update `docs/ID_REGISTRY.md`:

| Sequence | New Next Available |
| -------- | ------------------ |
| EPIC     | EPIC-0047          |
| US       | US-0269            |
| AC       | AC-1048            |
