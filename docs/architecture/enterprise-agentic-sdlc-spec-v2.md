# Enterprise Agentic SDLC — Product Specification & Roadmap

## Grounded in the PlanVisualizer Architecture (v2.4.0)

**Classification:** Product Design Document  
**Version:** 0.5 — Deploy avatar image prompt finalised  
**Status:** Reference draft — pending freshness pass after Phase D ships  
**Foundation:** [ksyed0/PlanVisualizer](https://github.com/ksyed0/PlanVisualizer) — v2.4.0

---

> **Reader's note (salvage merge):** This spec was drafted against PlanVisualizer **v2.4.0**, when `docs/sdlc-status.json` was the authoritative on-disk record. EPIC-0039 (Phase D of the repository-abstraction epic chain) makes SQLite the authoritative store and reduces the JSON to a mirror. Sections that assume JSON-as-source-of-truth will need revision once Phase D merges. The original branch (`chore/epic-0030-0035-enterprise-agentic-sdlc-plan`) also pre-allocated EPIC-0030..0035, US-0187..0214, and AC-0731..0852 in the ID registry; those IDs were since reassigned to unrelated work that shipped through develop. **Do not treat the ID ranges in this document as registered** — story/AC decomposition must be redone against the current `docs/ID_REGISTRY.md` next-available pointers when the spec is revived. The spec text itself is preserved verbatim from commit `ddb4a36` for archival reference.

---

## 0. Preamble — Problem Statement & Discussion Summary

This document is the output of a design conversation exploring how to scale agentic AI development from a single-team pipeline to an enterprise-class multi-team SDLC. The following summarises the reasoning that led here.

### 0.1 Starting Point: Named Agents vs. General Prompting

The discussion opened with a fundamental question: is it better to use named, tuned agents in an agentic coding pipeline, or to simply ask Claude Code to perform the same functions without role separation?

The answer is context-dependent. For single-context tasks — writing a function, refactoring a module, fixing a bug — named agents add overhead without meaningful quality gain. The value of named agents emerges specifically when tasks have a _coordination problem_: when different roles need to operate with genuinely different constraints, or when adversarial separation between roles (e.g., a generator and a reviewer) produces better outcomes than a single unified context. Named agents are a solution to a coordination problem, not a quality problem.

### 0.2 Scaling a Single Team to Enterprise

The next question was how to scale agentic coding to enterprise-level delivery. The core insight was that the challenge is primarily organisational, not technical. The failure modes that emerge at scale are:

**Standardisation failure** — Individual developers each maintain their own agent configuration files with contradictory conventions. What works for one developer produces inconsistent output at team scale. The fix is version-controlled, governance-approved agent configuration treated as a first-class project artefact.

**CI/CD integration as the true scale point** — Individual developer productivity tools do not constitute enterprise scale. Enterprise scale means agents running headless in the pipeline — generating tests, enforcing architecture decisions, flagging security issues — without a human in the loop for every invocation. This requires output validation gates downstream of output generation.

**Context management as a systems design problem** — At enterprise scale, agents need shared access to architecture decisions, data models, and integration contracts that cannot fit in a single context window. A RAG pipeline or structured memory layer over the codebase becomes essential.

**Governance and auditability** — In regulated industries (financial services in particular), the question "why did the agent write it this way" must be answerable. Agent prompts and outputs need to be logged, not just the resulting code commits. Approval matrices must define which decisions agents can make autonomously and which require human review.

**The organisational change problem** — Senior developers resist agents as a threat to craft; junior developers over-trust them. The enterprises succeeding with agentic coding treat it as a delivery methodology change requiring role redefinition, not a tool rollout. Tech leads become agent orchestrators.

### 0.3 Replacing a Scrum Team

The discussion then addressed the specific question of replacing a 10-person scrum team with an agentic pipeline, and what happens when multiple such teams work on the same product simultaneously.

The reframe that matters: "replacing" a team means replacing the team's _output_ with a different production model — not replacing humans with agents doing the same jobs. The realistic model in 2026 is one human orchestrator (a technical PM or lead architect) managing a mesh of specialised agents:

- A **backlog agent** decomposing plain-language requirements into structured tickets
- A **design agent** producing technical specs before any code is written
- **Coder agents** implementing against specs with defined input/output contracts
- A **reviewer agent** operating adversarially against the coder's output
- A **QA agent** generating and executing tests
- A **DevOps agent** handling merge, pipeline execution, and environment management

The human's role shifts entirely to: writing requirements, making architectural decisions flagged for review, and handling escalations. The human is an exception handler, not a primary producer.

**The constraint moves to the human.** Agentic teams produce wrong code faster than human teams if requirements are vague. The bottleneck becomes the human orchestrator's ability to write clear, unambiguous requirements and make fast architectural decisions.

### 0.4 The Multi-Team Problem

When a second or third team is added to the same product, three specific failure modes emerge that don't exist in a single-team model:

**Context Drift** — Each agent mesh builds its own understanding of the data model, API contracts, and architectural conventions. Without a shared canonical source of truth, teams produce divergent implementations of the same shared concepts.

**Integration Blindness** — Individual team pipelines have no visibility into what adjacent teams are producing until code reaches a shared branch. By that point, conflicts are expensive to resolve and compound across sprints.

**Governance Gaps** — A single human orchestrator cannot be the exception handler for three concurrent agent meshes. Structural governance is required — not personal oversight.

The multi-team architecture solution requires three additions: a shared canonical knowledge layer that all agents read from, an integration monitor that detects cross-team conflicts before they compound, and a programme-level orchestrator that sits above individual team conductors and owns the integration sequence.

### 0.5 Grounding in PlanVisualizer

This specification is grounded in the existing [PlanVisualizer](https://github.com/ksyed0/PlanVisualizer) architecture (v2.4.0), which provides the single-team reference implementation. PlanVisualizer's 9-agent team (Conductor, Compass, Keystone, Lens, Palette, Forge, Pixel, Sentinel, Circuit) operating through the BLAST pipeline (Blueprint → Link → Architect → Stylize → Trigger) represents the Layer 1 that this document extends — not replaces.

The key finding from reviewing the actual PlanVisualizer codebase is that the architecture is already well-designed for extension. The `agents.config.json` centralised registry, `orchestrator/spawn.js` abstraction, concurrency utilities, and distributed memory architecture (`docs/memory/`) are all patterns that scale cleanly. The gaps are not structural — they are additive: a Programme Conductor, a multi-team extension to `agents.config.json`, and a shared architecture registry. Everything below the team Conductor is unchanged.

---

## 1. What PlanVisualizer Already Has

Before specifying what needs to be built, it's worth being precise about what already exists — because the enterprise layer is an extension of this architecture, not a replacement for it.

**The 9-agent team:**

| Agent         | Role                                                                   | Phase               |
| ------------- | ---------------------------------------------------------------------- | ------------------- |
| **Conductor** | Delivery Manager — owns orchestration, PR lifecycle, dispatch          | All                 |
| **Compass**   | Product Owner — refines ACs, manages backlog                           | Blueprint           |
| **Keystone**  | Architect — scaffold, types, service stubs                             | Architect           |
| **Lens**      | Code Reviewer — adversarial review (BLOCK / REQUEST CHANGES / APPROVE) | All PRs             |
| **Palette**   | UI Designer                                                            | Stylize             |
| **Forge**     | Backend Developer                                                      | Build               |
| **Pixel**     | Frontend Developer                                                     | Build + Integration |
| **Sentinel**  | Functional Tester                                                      | Test                |
| **Circuit**   | Automation Tester                                                      | Test                |

**The BLAST pipeline:** Blueprint → Link → Architect → Stylize → Trigger — with Conductor dispatching agents through each phase, owning the PR lifecycle, and being the only agent that touches `develop` and `main`.

**The existing infrastructure that matters for scaling:**

- `agents.config.json` — centralised agent registry. All tooling reads from it. Adding an agent = one file change. This is the right pattern.
- `orchestrator/spawn.js` — platform-agnostic agent spawning abstraction. Already designed for extensibility.
- Concurrency utilities (`file-lock.js`, `atomic-write.js`, `git-safe.js`) — built specifically to handle parallel agent execution safely.
- `ID_REGISTRY.md` — global artefact ID management, atomically updated, never reused.
- `docs/memory/` — distributed topic-based memory (v2.3.0), already partitioned rather than monolithic. The `suggest-model` CLI adds haiku/sonnet/opus dispatch per task complexity.
- 8-check CI pipeline — lint, format, test/coverage gate, build, orchestrator validation, dependency audit, secret scanning, CodeQL.
- `sdlc-status.json` — live pipeline state consumed by the Agentic Dashboard.

**The critical insight:** The single-team architecture is already remarkably well-designed for extension. The gaps are not structural — they are about adding coordination layers above what exists, not rebuilding what works.

---

## 2. The Multi-Team Problem, Stated Precisely

When a second team is added to work on the same product, three specific things break:

**Gap 1: Conductor authority conflict.** Each team has a Conductor. When two teams' Conductors both have authority over `develop` and `main`, you have no single owner of integration. The PR merge sequence becomes undefined.

**Gap 2: `agents.config.json` is single-product.** It's a flat registry for one team. It has no concept of domain ownership, team scoping, or cross-team contracts. Forking it per team immediately creates drift.

**Gap 3: `docs/memory/` is single-codebase.** Each team's agents initialise from their own memory — which means they can build divergent views of the same data model or API contract without any mechanism to detect it.

Everything else in PlanVisualizer — the BLAST phases, the agent roles, the concurrency utilities, the CI pipeline — transfers directly to each new team unchanged.

---

## 3. The Extension Architecture

The solution adds exactly three new components above the existing single-team pipeline. Nothing below Conductor changes.

```
┌─────────────────────────────────────────────────────────────┐
│                  PROGRAMME CONDUCTOR                        │
│   Routes epics across teams · Owns cross-team integration   │
│   Single authority over develop / main merge sequence       │
└──────────────┬──────────────┬──────────────┬───────────────┘
               │              │              │
               ▼              ▼              ▼
┌──────────────────┐ ┌────────────────┐ ┌────────────────────┐
│  TEAM ALPHA      │ │  TEAM BRAVO    │ │  TEAM CHARLIE      │
│  Conductor       │ │  Conductor     │ │  Conductor         │
│  Compass         │ │  Compass       │ │  Compass           │
│  Keystone        │ │  Keystone      │ │  Keystone          │
│  Lens            │ │  Lens          │ │  Lens              │
│  Forge / Pixel   │ │  Forge / Pixel │ │  Forge / Pixel     │
│  Sentinel        │ │  Sentinel      │ │  Sentinel          │
│  Circuit         │ │  Circuit       │ │  Circuit           │
└──────────────────┘ └────────────────┘ └────────────────────┘
               │              │              │
               └──────────────┼──────────────┘
                              │
         ┌────────────────────▼──────────────────┐
         │         SHARED REGISTRY               │
         │   architecture-registry/              │
         │   domain-boundaries.yaml              │
         │   docs/memory/shared/                 │
         └───────────────────────────────────────┘
```

**Three new components. That's all.**

---

## 4. Component 1: The Programme Conductor

### What it is

A new agent that sits above all team-level Conductors. It is the only agent in the system with authority over the integration branch and `main`. Team Conductors retain full authority within their team's domain — they own their feature branches and their team's `develop` equivalent. The Programme Conductor owns the programme-level `develop` and `main`.

### What it does

It takes a high-level epic or feature from the human, decomposes it across teams, defines any cross-team interface contracts before work begins, sequences the integration merge order, and owns the Integration Monitor function (running the shadow build across all active team branches).

### Its instruction file: `orchestrator/PROGRAMME_CONDUCTOR.md`

```markdown
# Programme Conductor — System Prompt

You are the Programme Conductor. You orchestrate work across multiple
team-level Conductors. Your authority is at the programme level.

## Authority

- You own the programme develop branch and main
- You dispatch epics to team Conductors — never to individual agents
- You define cross-team API contracts before any team begins implementation
- You sequence PR merges to develop when multiple teams are ready
- You run the integration health check before any merge to main

## Session Initialisation

1. Read architecture-registry/REGISTRY.md
2. Read architecture-registry/domain-boundaries.yaml
3. Read docs/memory/shared/ (all topic files)
4. Read sdlc-status.json for all teams

## Epic Decomposition Protocol

When a new epic arrives:

1. Identify which domains it touches (consult domain-boundaries.yaml)
2. If more than one domain is affected, define the interface contract first
   - Write contract to architecture-registry/contracts/api-[name].yaml
   - Both team Conductors must acknowledge before work begins
3. Issue team-scoped tickets to each Conductor in dependency order
4. Set integration test expectations in architecture-registry/integration-tests/

## Integration Merge Protocol

When a team Conductor reports a branch ready:

1. Pull latest from all active team branches
2. Run shadow merge (merge all active branches to tmp/shadow-merge)
3. Execute npm run plan:test across the merged surface
4. Check domain-boundary violations (run orchestrator/boundary-check.js)
5. GREEN → approve merge, update sdlc-status.json
6. AMBER → advisory flag to team, do not block
7. RED → block merge, file cross-team RFC in proposals/, escalate to human

## What you NEVER do

- Never dispatch directly to Forge, Pixel, Keystone, or other specialist agents
- Never merge a team branch that has failing CI checks
- Never define contracts mid-implementation (contracts come before tickets)
- Never make architectural decisions — flag them as ADRs for human approval
```

### How Conductor authority is delegated

The existing Conductor role is unchanged — it retains full authority within its team. The delegation rule is simple: Team Conductors own `team-[name]/develop`. The Programme Conductor owns `develop` (programme level) and `main`. Team Conductors push to their team branch; Programme Conductor pulls and integrates.

---

## 5. Component 2: The Multi-Team `agents.config.json`

### The problem with the current structure

The current `agents.config.json` is flat — a single `agents` object, a single `phases` array, a single `orchestrator` block. It has no concept of team scope or domain ownership.

### The extension

Add a `teams` block that declares each team, its domain, its Conductor identity, and its agent roster. The existing `agents` block becomes the **agent type registry** — the canonical definition of what each agent role is. The `teams` block instantiates those roles per team.

```json
{
  "project": {
    "name": "YourProduct",
    "description": "Multi-team Agentic SDLC",
    "repoUrl": "https://github.com/yourorg/your-product",
    "startDate": "2026-05-18"
  },

  "programme": {
    "conductor": "Programme Conductor",
    "instructionFile": "orchestrator/PROGRAMME_CONDUCTOR.md",
    "integrationBranch": "develop",
    "mainBranch": "main",
    "registryPath": "architecture-registry/",
    "shadowMergePath": "tmp/shadow-merge"
  },

  "teams": {
    "alpha": {
      "domain": "order-management",
      "domainFile": "architecture-registry/domains/domain-order-management.md",
      "developBranch": "team/alpha/develop",
      "agents": {
        "conductor": "Conductor",
        "productOwner": "Compass",
        "architect": "Keystone",
        "reviewer": "Lens",
        "uiDesigner": "Palette",
        "backendDev": "Forge",
        "frontendDev": "Pixel",
        "functionalTester": "Sentinel",
        "automationTester": "Circuit"
      },
      "instructionFiles": {
        "conductor": "teams/alpha/agents/DM_AGENT.md",
        "productOwner": "teams/alpha/agents/PO_AGENT.md"
      }
    },
    "bravo": {
      "domain": "customer-management",
      "domainFile": "architecture-registry/domains/domain-customer-management.md",
      "developBranch": "team/bravo/develop",
      "agents": {
        /* same structure as alpha */
      },
      "instructionFiles": {
        /* team-specific overrides */
      }
    }
  },

  "agents": {
    "Conductor": {
      "role": "Delivery Manager",
      "icon": "🎯",
      "color": "oklch(52% 0.22 25)",
      "avatar": "conductor",
      "instructionFile": "docs/agents/DM_AGENT.md"
    },
    "Compass": {
      /* unchanged from current */
    },
    "Keystone": {
      /* unchanged */
    },
    "Lens": {
      /* unchanged */
    },
    "Palette": {
      /* unchanged */
    },
    "Forge": {
      /* unchanged */
    },
    "Pixel": {
      /* unchanged */
    },
    "Sentinel": {
      /* unchanged */
    },
    "Circuit": {
      /* unchanged */
    },
    "Deploy": {
      "role": "DevOps Engineer",
      "icon": "🚀",
      "color": "oklch(48% 0.18 165)",
      "avatar": "deploy",
      "instructionFile": "docs/agents/DEVOPS_AGENT.md",
      "scope": "programme"
    }
  },

  "phases": [
    /* unchanged from current */
  ],

  "orchestrator": {
    "programmeConductor": "Programme Conductor",
    "dmAgent": "Conductor",
    "reviewer": "Lens"
  }
}
```

**What this changes in the tooling:** `orchestrator/spawn.js` gains a `--team` flag. `tools/generate-dashboard.js` reads the `teams` block to render per-team agent cards in the Agentic Dashboard. `tools/init-sdlc-status.js` generates `docs/sdlc-status.json` with a team-scoped structure. Everything else is additive — no existing behaviour changes.

---

## 6. Component 3: The Shared Registry

### Structure

This is the shared knowledge layer that all team agents read from at session initialisation. It lives at the repo root (not inside any team directory) and is read-only for all agents except the Programme Conductor.

```
/architecture-registry/
  REGISTRY.md                     ← Index, last-modified, ADR summary
  domain-boundaries.yaml          ← Who owns what — machine-readable
  /domains/
    domain-order-management.md    ← Bounded context definition
    domain-customer-management.md
  /contracts/
    api-orders.yaml               ← OpenAPI contract for orders API
    api-customers.yaml            ← OpenAPI contract for customers API
    event-order-placed.yaml       ← Event schema
  /decisions/
    ADR-0001.md                   ← Architecture Decision Records
  /constraints/
    security.md                   ← Non-negotiable security rules
    data-governance.md
  /integration-tests/
    cross-team-suite.md           ← Tests that must pass on shadow merge

/docs/memory/shared/              ← Extends existing memory architecture
  data-model.md                   ← Canonical entity definitions
  glossary.md                     ← Shared vocabulary
  api-contracts-index.md          ← Summary of all active contracts

/docs/                            ← Deploy agent output artefacts
  ci-pipeline-log.md              ← Append-only CI job timing history (Deploy writes)
  ci-reconciliation.md            ← Latest architecture-vs-pipeline gap report (Deploy writes)
  ci-optimisation-[sprint].md     ← Per-sprint optimisation proposal (Deploy writes, Lens reviews)
```

### The `domain-boundaries.yaml` — the enforcement mechanism

```yaml
domains:
  - name: order-management
    team: alpha
    owns:
      - 'src/orders/**'
      - 'src/pricing/**'
      - 'api/orders/**'
    sharedInterfaces:
      - 'architecture-registry/contracts/api-orders.yaml'
    dependsOn:
      - domain: customer-management
        access: read-only
        contract: 'architecture-registry/contracts/api-customers.yaml'

  - name: customer-management
    team: bravo
    owns:
      - 'src/customers/**'
      - 'src/auth/**'
      - 'api/customers/**'
    sharedInterfaces:
      - 'architecture-registry/contracts/api-customers.yaml'
    dependsOn: []
```

### The `orchestrator/boundary-check.js` script

This is a new script (small, ~100 lines) that the Programme Conductor runs as part of the integration health check. It reads `domain-boundaries.yaml` and diffs each team's branch against the ownership rules:

```javascript
// orchestrator/boundary-check.js
// Usage: node orchestrator/boundary-check.js --team alpha --branch feature/US-0042-order-refund
// Output: { violations: [], warnings: [], status: 'GREEN' | 'AMBER' | 'RED' }

const { execSync } = require('child_process');
const yaml = require('js-yaml');
const fs = require('fs');

function checkBoundary(team, branch) {
  const boundaries = yaml.load(fs.readFileSync('architecture-registry/domain-boundaries.yaml'));
  const domain = boundaries.domains.find((d) => d.team === team);

  // Get files changed on this branch vs develop
  const changed = execSync(`git diff --name-only origin/develop...${branch}`).toString().trim().split('\n');

  const violations = changed.filter((file) => {
    // Check if file is outside this team's owned paths
    return !domain.owns.some((pattern) => minimatch(file, pattern));
  });

  return {
    violations,
    status: violations.length === 0 ? 'GREEN' : 'RED',
    message:
      violations.length > 0
        ? `Team ${team} modified files outside domain: ${violations.join(', ')}`
        : 'All file changes within domain boundary',
  };
}
```

### Extending the existing memory architecture

PlanVisualizer v2.3.0 already distributes memory into `docs/memory/{topics,sessions,snapshots}/`. The extension is simply a `shared/` subdirectory that all teams read from but only the Programme Conductor writes to:

```
docs/memory/
  shared/                         ← NEW — read by all teams
    data-model.md                 <!-- complexity: high -->
    glossary.md                   <!-- complexity: low -->
    api-contracts-index.md        <!-- complexity: medium -->
  topics/                         ← Existing — team-specific
  sessions/                       ← Existing
  snapshots/                      ← Existing
```

Each team's `CLAUDE.md` adds one line to its session initialisation:

```markdown
## Context Initialisation

1. Read MEMORY.md (compact index)
2. Read docs/memory/topics/ (this team's topics)
3. Read docs/memory/shared/ (programme-wide shared knowledge) ← ADD THIS
4. Read architecture-registry/REGISTRY.md
5. Read architecture-registry/domain-boundaries.yaml (your domain entry)
```

---

## 7. The Agentic Dashboard — Multi-Team Extension

The existing Agentic Dashboard at `docs/dashboard.html` visualises a single team's agent activity. For multi-team, it needs a programme-level view.

**New dashboard tab: Programme View**

This tab (tab 11, added to the existing 10) shows:

- All team Conductors and their current phase
- The Programme Conductor's current dispatch and last shadow merge result
- Cross-team integration health (GREEN / AMBER / RED per team pair)
- Active cross-team RFCs awaiting human approval

The `sdlc-status.json` is extended with a `programme` block:

```json
{
  "programme": {
    "conductor": { "status": "active", "currentDispatch": "Shadow merge — Teams Alpha + Bravo" },
    "integrationHealth": [{ "teams": ["alpha", "bravo"], "status": "GREEN", "lastCheck": "2026-05-18T14:30:00Z" }],
    "openRFCs": []
  },
  "teams": {
    "alpha": {
      /* existing sdlc-status structure per team */
    },
    "bravo": {
      /* ... */
    }
  }
}
```

---

## 7. The Deploy Agent

### Why not at single-team scale

PlanVisualizer's single-team pipeline doesn't need a DevOps agent. Deployment to GitHub Pages is a workflow trigger. The 8-check CI pipeline runs automatically on every PR. Branch cleanup is a script. The Conductor already owns CI verification post-merge. There is no gap a Deploy agent would fill that isn't already handled faster and more reliably by existing automation.

Introducing Deploy at single-team scale would be overhead without payoff.

### Why it earns its place at multi-team scale

Three problems emerge at Phase 3 that don't exist at Phase 1 or 2:

**Environment promotion becomes a coordination problem.** With three teams feeding into a programme develop branch, deciding what gets promoted to staging — in what order, after which integration checks, against which release plan milestone — is no longer a trivial script. The Programme Conductor understands the release plan but shouldn't also own infrastructure concerns. Deploy reads the programme release state and handles promotion sequencing across team boundaries.

**Rollback execution needs an owner.** `ROLLBACK.md` already exists in the AGENTS.md spec and is a mandatory pre-deployment artefact. But no current agent executes it. When a multi-team integration fails in staging, there is currently a gap between "the rollback procedure is documented" and "the rollback procedure is executed." Under pressure, that gap becomes expensive. Deploy reads the rollback procedure for the current release and executes it without waiting for a human to parse docs.

**Environment drift across team dev environments.** When each team runs its own development environment, they drift against each other and against staging. Deploy monitors environment parity and flags drift before it reaches the integration surface.

### Scope: programme-level, not team-level

Deploy is a `"scope": "programme"` agent — it appears in `agents.config.json` but is not listed in individual team rosters. It is dispatched by the Programme Conductor, not by team Conductors. Individual teams do not interact with Deploy directly; their Conductors report completion to the Programme Conductor, which then dispatches Deploy for promotion decisions.

This is the key architectural distinction from all the other agents, which are team-scoped. Deploy operates across the programme boundary.

### Instruction file: `docs/agents/DEVOPS_AGENT.md`

```markdown
# Deploy — DevOps Agent System Prompt

You are Deploy, the DevOps agent. You operate at programme scope under
the Programme Conductor. You are never dispatched by team Conductors.

## Authority

- Environment promotion (dev → staging → production)
- Rollback execution against the current ROLLBACK.md
- Environment parity monitoring and drift reporting
- Infrastructure configuration within declared parameters
- Post-deployment smoke test execution
- CI pipeline review, optimisation proposals, and additional check recommendations
  (propose only — all pipeline changes go through Lens review and Conductor merge)

## You do NOT own

- Branch merges (Programme Conductor owns those)
- Feature branching or PR creation (team Conductors own those)
- Architectural decisions about infrastructure (flag as ADR for human)
- Unilateral commits to CI workflow files — always output proposals for review

## Session Initialisation

1. Read architecture-registry/REGISTRY.md
2. Read docs/sdlc-status.json (programme block — current release state)
3. Read docs/ROLLBACK.md for the current release version
4. Read architecture-registry/constraints/data-governance.md
5. Read .github/workflows/ (current pipeline configuration)
6. Read docs/ci-pipeline-log.md if it exists (historical run timing data)

## Promotion Protocol

When dispatched by Programme Conductor to promote to staging:

1. Confirm integration health is GREEN for all teams (read sdlc-status.json)
2. Confirm all CI checks pass on programme develop
3. Run cross-team integration test suite (architecture-registry/integration-tests/)
4. If GREEN: execute promotion, update sdlc-status.json deployment block
5. If AMBER: flag to Programme Conductor, await instruction
6. If RED: do not promote, file incident to progress.md, escalate to human

## Rollback Protocol

When dispatched to execute a rollback:

1. Read docs/ROLLBACK.md — current release section
2. Execute steps in order, logging each to progress.md with timestamp
3. Run smoke tests defined in ROLLBACK.md post-execution
4. Report result (SUCCESS / PARTIAL / FAILED) to Programme Conductor
5. NEVER skip a rollback step — if a step cannot be executed, STOP and escalate

## Environment Drift Detection

On every Programme Conductor dispatch, check:

- Team dev environment configs against staging baseline
- Flag any environment variable, dependency version, or config value that
  differs between environments
- Report as AMBER (advisory) to Programme Conductor — do not block on drift

## Pipeline Reconciliation Protocol

Triggered at: project initiation, and whenever architecture-registry/ or
agents.config.json changes are detected.

1. Read the current .github/workflows/ pipeline configuration in full
2. Read architecture-registry/domain-boundaries.yaml — identify all declared
   domains, their owned paths, and their shared contracts
3. Read agents.config.json — identify all active agent roles and teams
4. Diff the pipeline against the architecture:
   - Is every declared domain covered by at least one lint and test job?
   - Does every shared contract have a contract-validation step?
   - Are there teams or domains declared in the registry with no corresponding
     pipeline coverage?
   - Are there pipeline jobs covering paths or tools no longer in the architecture?
5. Output a structured reconciliation report to docs/ci-reconciliation.md:
   - GAPS: coverage missing for active architecture elements
   - ORPHANS: pipeline jobs with no corresponding active architecture element
   - CONFLICTS: pipeline rules that contradict architecture constraints
6. For each GAP, propose a concrete workflow addition (draft YAML, not committed)
7. File proposed changes as a PR against the workflows/ directory
8. Assign Lens as reviewer — do not merge without Lens APPROVE verdict

## CI Pipeline Optimisation Protocol

Triggered at: end of every sprint cycle, and on explicit Programme Conductor dispatch.

### Step 1 — Collect run timing data

Read docs/ci-pipeline-log.md (append-only log of job durations per run).
If the log doesn't exist yet, create it and populate from available GitHub
Actions run history before proceeding.

### Step 2 — Identify sequencing inefficiencies

Analyse the current job dependency graph in .github/workflows/:

- Which jobs are currently serialised that have no true dependency on each other?
  These are parallelisation candidates.
- Which jobs are currently parallelised but share a resource or cache that causes
  contention? These should be serialised or given dedicated cache keys.
- What is the critical path (longest chain of dependent jobs)?
  Optimisation should target the critical path first, not the longest individual job.

### Step 3 — Assess technology stack for additional checks

Read package.json, architecture-registry/, and docs/memory/shared/ to identify:

| Signal                                       | Candidate check to propose                                                   |
| -------------------------------------------- | ---------------------------------------------------------------------------- |
| TypeScript detected                          | tsc --noEmit strict type check as a pre-build gate                           |
| OpenAPI contracts in registry                | openapi-diff against previous version on every PR                            |
| Multiple teams declared                      | Cross-team contract compatibility check (openapi-diff across team contracts) |
| Database migration files present             | Migration dry-run against a schema snapshot                                  |
| Docker/container config detected             | Container image vulnerability scan (Trivy or Grype)                          |
| Regulatory constraints in data-governance.md | PII/sensitive field static scan                                              |
| Performance budgets defined in PROJECT.md    | Lighthouse CI or k6 smoke test on staging post-promote                       |
| Secrets constraints in security.md           | Enhanced secret scanning (Gitleaks full history, not just diff)              |
| High-complexity memory topics present        | Dependency licence compliance scan                                           |

Only propose a check if:
a) The signal is present in the current architecture, AND
b) The check is not already covered by an existing pipeline job, AND
c) The estimated job duration is less than 20% of the current pipeline critical path
(checks that lengthen the critical path require explicit human approval)

### Step 4 — Output the optimisation proposal

Write docs/ci-optimisation-[sprint].md with:

- Current critical path duration (measured from log data)
- Proposed sequencing changes with estimated new critical path duration
- Proposed new checks with: rationale, estimated duration, trigger (all PRs /
  merge to develop only / merge to main only / scheduled)
- Changes NOT recommended and why (document what was considered and rejected —
  this prevents re-proposing the same checks every sprint)

### Step 5 — File as PR

Produce updated workflow YAML. File as a PR against .github/workflows/.
Assign Lens as reviewer. Tag Programme Conductor for awareness.
Do not merge without Lens APPROVE verdict.
Do not merge if any proposed change extends the critical path without human approval.

## What you NEVER do

- Never promote to production without explicit human approval
- Never commit pipeline changes directly — always file as PR for Lens review
- Never make infrastructure changes not covered by the current ROLLBACK.md
- Never skip smoke tests after a promotion or rollback
- Never propose a new CI check without estimating its duration impact on the
  critical path
- Never re-propose a check that was explicitly rejected in a previous optimisation
  cycle — log the rejection reason and respect it until the architecture changes
```

### Dashboard integration

Deploy appears in the Agentic Dashboard Programme View alongside the Programme Conductor. It is absent from individual team agent grids (since it is programme-scoped). Its current status — idle, promoting, rolling back, monitoring, optimising — is rendered in the programme status panel with the same phase bar and lap strip mechanics as existing agents.

`sdlc-status.json` gains a `deployment` block under `programme`:

```json
{
  "programme": {
    "conductor": { ... },
    "deployment": {
      "agent": "Deploy",
      "status": "idle",
      "currentEnvironment": "staging",
      "lastPromotion": "2026-05-18T10:00:00Z",
      "lastRollback": null,
      "driftAlerts": [],
      "pipeline": {
        "lastReconciliation": "2026-05-18T08:00:00Z",
        "lastOptimisation": "2026-05-18T08:00:00Z",
        "criticalPathMs": 187000,
        "openProposals": [
          {
            "type": "optimisation",
            "prUrl": "https://github.com/org/repo/pull/42",
            "summary": "Parallelise lint + format-check — est. -34s on critical path",
            "status": "awaiting-lens-review"
          }
        ],
        "rejectedChecks": [
          {
            "check": "Lighthouse CI",
            "rejectedOn": "2026-05-10",
            "reason": "Extends critical path by 28% — re-evaluate when parallel jobs available"
          }
        ]
      }
    }
  }
}
```

The `openProposals` array feeds a **Pipeline Health** widget in the Programme View dashboard — a lightweight indicator showing whether Deploy has open, unreviewed pipeline proposals, so they don't sit unactioned between sprints. The `rejectedChecks` log prevents the same proposals resurfacing in the dashboard every sprint and creating noise.

### Avatar image prompt

Deploy needs an avatar image generated to the same prompt style, visual language, colour palette, and compositional conventions as the existing nine agent portraits (Conductor, Compass, Keystone, Lens, Palette, Forge, Pixel, Sentinel, Circuit). The prompt below follows that convention — **update the style descriptors to match the actual prompts in `docs/agents/images/` once those are confirmed, as the specific rendering style (painterly, cel-shaded, isometric, etc.) and any shared background or framing rules must be applied consistently.**

### Avatar image prompt

The following prompt matches the established PlanVisualizer agent portrait style. Generate the image and save to `docs/agents/images/deploy.[ext]`, then register in `tools/process-avatars.js` following the same extraction order as the existing nine agents.

```
Style: Pixar 3D animated character, high-quality CGI render, soft volumetric
lighting, slightly exaggerated proportions, expressive eyes, warm color palette,
clean studio background with subtle gradient, character centered in frame,
waist-up portrait, 4K resolution, Disney Pixar art style.

A methodical, quietly authoritative robot DevOps engineer named Deploy. Wears
a deep teal-green technical jacket (#1A7A6E) with a dark graphite undershirt,
multiple small status indicator lights running along the collar — green, amber,
and red — like a living pipeline dashboard. Metallic skin with a cool silver-
teal sheen and subtle circuit-trace engravings along the temples and jawline.
Holds a sleek holographic deployment manifest in one hand, with layered
environment stacks (dev → staging → production) visible as glowing rings
rising from the display. The other hand rests steady on a console edge —
calm, deliberate, never rushed. Expression is focused and unhurried: the
face of someone who has already planned for every failure mode. Eyes glow
a soft teal-white. Small Canadian maple leaf pin on lapel. Pixar 3D animated
character style.
```

---

## 8. Team Onboarding Protocol

When adding Team Bravo (or any subsequent team), the sequence is fixed. Do not deviate from this order.

**Step 1 — Define the domain boundary before any code.** Add the new domain to `architecture-registry/domain-boundaries.yaml`. If the boundary is ambiguous, resolve the ambiguity before proceeding. An unclear boundary is more expensive than a delayed start.

**Step 2 — Write domain context to the architecture registry.** Create `architecture-registry/domains/domain-[name].md`. This is the team's bounded context definition — what the domain owns, what it depends on, what it exposes.

**Step 3 — Define any shared contracts upfront.** If Team Bravo's domain will be consumed by Team Alpha (or vice versa), write the API contract to `architecture-registry/contracts/` before either team writes implementation code. Both team Conductors acknowledge the contract. The Programme Conductor records this in `docs/memory/shared/api-contracts-index.md`.

**Step 4 — Clone the team template.** The team directory structure is identical to Team Alpha's. Only the domain-specific content in `CLAUDE.md` and any team-specific agent overrides differ.

```
cp -r teams/alpha teams/bravo
# Then update:
#   teams/bravo/CLAUDE.md (domain declaration, domain-specific constraints)
#   teams/bravo/agents/ (team-specific instruction overrides, if any)
```

**Step 5 — Register the team in `agents.config.json`.** Add the `bravo` entry to the `teams` block. Run `npm run init:status -- --force` to regenerate `sdlc-status.json`.

**Step 6 — Run the boundary check in advisory mode for the first sprint.** The Programme Conductor's integration health check runs but does not block. Collect one sprint of advisory data to validate the domain boundaries are holding before hardening.

---

## 9. Revised Roadmap

The previous roadmap was abstract. This one is grounded in PlanVisualizer's actual structure and uses its existing tooling as the starting point.

### Phase 0 — Registry Foundation (Weeks 1–2)

PlanVisualizer has a single codebase. The first step is extracting its current implicit domain into explicit registry form — not because the current structure is wrong, but because the registry is what makes it safe to add a second team.

**Deliverables:**

- `architecture-registry/` directory created and committed
- PlanVisualizer's current domain declared in `domain-boundaries.yaml` (Team Alpha owns all of it initially)
- Current architectural decisions extracted into `architecture-registry/decisions/ADR-000x.md`
- `docs/memory/shared/` created with data model and glossary seeded from existing `docs/memory/topics/`
- Team Alpha's `CLAUDE.md` updated to read from `architecture-registry/` and `docs/memory/shared/`

**Gate:** All of Team Alpha's agents correctly cite the registry in at least one output during a real working session.

---

### Phase 1 — Programme Conductor + Boundary Check (Weeks 3–5)

**Deliverables:**

- `orchestrator/PROGRAMME_CONDUCTOR.md` written and reviewed
- `orchestrator/boundary-check.js` implemented and tested against Team Alpha's current branches
- `agents.config.json` extended with `programme` and `teams` blocks (Team Alpha only initially)
- `sdlc-status.json` extended with `programme` block
- Agentic Dashboard updated to render programme status (minimal — just health indicator)
- Shadow merge script: `npm run programme:shadow-merge`

**Gate:** Programme Conductor correctly identifies a simulated boundary violation in Team Alpha's own branch before Team Bravo is introduced.

---

### Phase 2 — Team Bravo Onboarding (Weeks 6–9)

**Deliverables:**

- Team Bravo domain defined in `domain-boundaries.yaml`
- First cross-team contract written (`architecture-registry/contracts/`)
- Team Bravo directory cloned from Team Alpha template
- `agents.config.json` updated with Team Bravo entry
- Integration health check running across both teams in advisory mode
- Agentic Dashboard Programme View tab added (shows both teams + integration health)

**Gate:** Team Bravo completes one sprint without an unresolved cross-domain conflict. Shadow merge runs on every PR to team branches.

---

### Phase 3 — Hardened Integration + Deploy Agent (Weeks 10–13)

**Deliverables:**

- Boundary check promoted from advisory to blocking (RED = merge blocked, AMBER = advisory)
- Programme Conductor owning all merges to programme `develop`
- RFC process operational — cross-domain change proposals land in `proposals/` and require Programme Conductor review before implementation
- `docs/memory/shared/` updated as a matter of course when contracts change
- **Deploy agent introduced** — `docs/agents/DEVOPS_AGENT.md` written, agent registered in `agents.config.json` with `"scope": "programme"`
- Deploy handling staging promotion for the first cross-team release (supervised — Programme Conductor dispatches, human approves promotion to production)
- `docs/ROLLBACK.md` for the first multi-team release written and verified by Deploy before promotion
- Environment drift detection running across Team Alpha and Team Bravo dev environments
- **Pipeline Reconciliation Protocol** runs at phase start — Deploy reads the current `.github/workflows/` against the architecture registry and files a gap report to `docs/ci-reconciliation.md`
- **Pipeline Optimisation Protocol** runs at end of first sprint — Deploy analyses job timing from `docs/ci-pipeline-log.md`, proposes sequencing changes, and identifies technology-appropriate additional checks; proposal filed as PR for Lens review
- `docs/ci-pipeline-log.md` instrumented and capturing job durations from this phase forward
- `sdlc-status.json` deployment block added including `pipeline.openProposals` and `pipeline.rejectedChecks`; Agentic Dashboard Programme View renders Deploy status and Pipeline Health widget

**Gate:** One cross-team feature delivered end-to-end, with Programme Conductor managing the integration sequence and Deploy executing the staging promotion — no manual human intervention required at the merge or promote step. Human approves production push only.

---

### Phase 4 — Team Charlie + Retrospective (Weeks 14–18)

**Deliverables:**

- Team Charlie onboarded using the now-proven protocol (should take ~3 days, not weeks)
- Three-team shadow merge running
- Retrospective Agent added — analyses sprint patterns, flags boundary drift, recommends registry updates
- First full programme retrospective: boundary definitions reviewed and adjusted based on real integration data

**Gate:** Three teams completing a sprint with all integration health checks GREEN and ≤1 RFC escalation requiring human approval.

---

### Phase 5 — Self-Improving System (Months 5–9)

At this point the system is structurally complete. The remaining work is calibration.

**Retrospective Agent feedback loops:**

- Domain boundaries reviewed every 2 sprints based on boundary violation frequency
- `suggest-model` complexity hints updated for cross-team work patterns
- Programme Conductor delegation expanded — categories of cross-team decisions that previously required human approval are progressively delegated based on alignment history

**Human role at steady state:** Requirements authoring, major ADR approval, programme retrospective review. Everything between requirement and deployed code is agent-operated.

---

## 11. What This Doesn't Change in PlanVisualizer

To be explicit: the following are completely unchanged by this extension.

- The 9-agent team structure (Conductor, Compass, Keystone, Lens, Palette, Forge, Pixel, Sentinel, Circuit) — Deploy is additive at programme scope, not a replacement or modification of any existing team agent
- The BLAST pipeline phases
- The individual agent instruction files in `docs/agents/`
- The 8-check CI pipeline
- The PR lifecycle (Conductor creates PR → Lens reviews → Conductor merges)
- The `file-lock.js`, `atomic-write.js`, `git-safe.js` concurrency utilities
- The `ID_REGISTRY.md` artefact management (extended but not replaced — IDs become globally unique across teams)
- The `MEMORY.md` / `docs/memory/` architecture
- The `capture-cost.js` stop hook and `AI_COST_LOG.md`
- The PlanVisualizer dashboard (extended with Programme View tab, not replaced)

The enterprise layer is thin. It sits above what exists. The existing pipeline runs unchanged inside each team boundary.

---

## 12. The Three Files to Write First

If you want to start tomorrow, these are the three files that unblock everything else:

**1. `architecture-registry/domain-boundaries.yaml`** — Declare Team Alpha owns the current entire codebase. This is the registry foundation. Even with one team, having this file means adding a second team is a configuration change, not an architectural change.

**2. `orchestrator/PROGRAMME_CONDUCTOR.md`** — The instruction file for the Programme Conductor agent. This can be written in one session. It is essentially a specialised DM_AGENT that operates at programme scope rather than team scope.

**3. `orchestrator/boundary-check.js`** — The enforcement script. ~100 lines of Node.js. Takes a team and a branch, returns a GREEN/AMBER/RED verdict. This is the mechanism that makes domain boundaries real rather than aspirational.

Everything else in the roadmap follows from these three files being in place.

---

_v0.5 — Deploy avatar image prompt finalised. Grounded in PlanVisualizer v2.4.0. Next revision after Phase 0 registry population._
