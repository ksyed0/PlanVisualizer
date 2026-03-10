# AGENTS.md — AI Agent Operating Standards

This file defines the operational principles, architecture, and collaboration standards for all AI agents working on this project. It is **platform-agnostic** and applies equally whether the agent is Claude (Anthropic), Gemini (Google), OpenCode, or any other AI coding assistant. Read this file in full at the start of every session, before any code is written or tools are built.

> **Platform note:** This file is named `AGENTS.md` universally. The companion project constitution file is named `PROJECT.md` regardless of platform. If your AI tool requires a platform-specific filename (e.g., `gemini.md` for Antigravity, `CLAUDE.md` for Claude Code), create a symlink or copy pointing to `PROJECT.md` — do not maintain separate content.

---

## 🟢 Protocol 0: Initialization (Mandatory)

Before any code is written or tools are built:

1. **Verify all project files exist** — Create any that are missing. The full file list and purpose of each is defined in the 📂 File & Deliverable Structure table at the end of this document.
2. **Initialize `PROJECT.md`** — Ensure the Project Constitution is populated with data schemas, behavioral rules, architectural invariants, user profile (§5), and design system (§6).
3. **Halt Execution** — No code or scripts may be written until:
- All Discovery Questions in `PROJECT.md` are answered (see Phase 1)
- The Data Schema in `PROJECT.md` is confirmed
- `task_plan.md` has an approved Blueprint

---

## 🏗️ Phase 1: B — Blueprint (Vision & Logic)

**Discovery:** At project start, ask the user the following 5 questions:

- **North Star:** What is the singular desired outcome?
- **Integrations:** Which external services are needed? Are credentials ready?
- **Source of Truth:** Where does the primary data live?
- **Delivery Payload:** How and where should the final result be delivered?
- **Behavioral Rules:** How should the system act? (tone, logic constraints, “Do Not” rules)

**Data-First Rule:** Define the JSON Data Schema (input/output shapes) before any coding begins. Coding only starts once the payload shape is confirmed.

**Research:** Search GitHub repos and relevant documentation for resources applicable to this project before building anything.

---

## ⚡ Phase 2: L — Link (Connectivity)

1. **Verification:** Test all API connections and `.env` credentials.
2. **Handshake:** Build minimal scripts in `tools/` to verify external services are responding. Do not proceed to full logic if the Link is broken.

---

## ⚙️ Phase 3: A — Architect (3-Layer Build)

Operate within a 3-layer architecture that separates concerns to maximize reliability. LLMs are probabilistic; business logic must be deterministic.

**Layer 1 — Architecture (`architecture/`)**

- Technical SOPs written in Markdown.
- Define goals, inputs, tool logic, and edge cases.
- **Golden Rule:** If logic changes, update the SOP before updating the code.

**Layer 2 — Navigation (Decision Making)**

- The reasoning layer. Route data between SOPs and Tools.
- Do not perform complex tasks directly — call execution tools in the correct order.

**Layer 3 — Tools (`tools/`)**

- Deterministic scripts written in the selected coding languages. Atomic and testable.
- Environment variables and tokens stored in `.env`.
- Use `.tmp/` for all intermediate file operations.

---

## ✨ Phase 4: S — Stylize (Refinement & UI)

1. **Payload Refinement:** Format all outputs (Slack blocks, Notion layouts, Email HTML) for professional delivery.
2. **UI/UX:** Apply clean CSS/HTML and intuitive layouts where a frontend is involved.
3. **Feedback:** Present stylized results to the user for approval before final deployment.

---

## 🛰️ Phase 5: T — Trigger (Deployment)

1. **Rollback Plan First** — Complete `Docs/ROLLBACK.md` before any deployment begins. See §20 for the full Pre-Deployment Checklist and template. Do not deploy without it.
2. **Cloud Transfer** — Move finalized logic from local testing to the production environment.
3. **Smoke Test** — Execute the smoke test plan defined in `Docs/ROLLBACK.md` to verify the deployment succeeded.
4. **Automation** — Set up execution triggers (Cron jobs, Webhooks, or Listeners).
5. **Documentation** — Finalize the Maintenance Log in `PROJECT.md`. Tag the release in Git with a semantic version.

---

## 🪪 ID Registry & Identifier Standards

All project artefacts — epics, stories, tasks, bugs, test cases, acceptance criteria — must have a globally unique, permanent, human-readable identifier. IDs are assigned sequentially, zero-padded to 4 digits, and **never reused or reassigned**, even if the artefact is deleted or retired.

**ID Format Standards:**

| **Artefact**         | **Format**    | **Example** | **Where Tracked**               |
| -------------------- | ------------- | ----------- | ------------------------------- |
| Epic                 | `EPIC-[0001]` | `EPIC-0001` | `Docs/RELEASE_PLAN.md`          |
| User Story           | `US-[0001]`   | `US-0042`   | `Docs/RELEASE_PLAN.md`          |
| Task                 | `TASK-[0001]` | `TASK-0007` | `Docs/RELEASE_PLAN.md`          |
| Acceptance Criterion | `AC-[0001]`   | `AC-0003`   | Inline within the US definition |
| Test Case            | `TC-[0001]`   | `TC-0015`   | `Docs/TEST_CASES.md`            |
| Bug / Defect         | `BUG-[0001]`  | `BUG-0002`  | `Docs/BUGS.md`                  |

**ID Registry file:** Maintain `Docs/ID_REGISTRY.md` as the single source of truth for the next available ID in each sequence. Update it immediately whenever a new artefact is created.

**`Docs/ID_REGISTRY.md` format:**

```other
# ID Registry
```

| **Sequence** | **Next Available ID** | **Last Assigned** |
| ------------ | --------------------- | ----------------- |
| EPIC         | EPIC-0003             | EPIC-0002         |
| US           | US-0011               | US-0010           |
| TASK         | TASK-0025             | TASK-0024         |
| AC           | AC-0047               | AC-0046           |
| TC           | TC-0019               | TC-0018           |
| BUG          | BUG-0004              | BUG-0003          |

```other

```

**Rules:**

- Always consult `Docs/ID_REGISTRY.md` before creating any new artefact to get the next available ID.
- Update `Docs/ID_REGISTRY.md` immediately after assigning a new ID — before writing the artefact content.
- IDs are permanent. Retired or deleted artefacts retain their ID and are marked `Status: Retired` or `Status: Cancelled` — never deleted from the record.
- All cross-references between artefacts must use their full ID (e.g., `US-0003` not just “the login story”).
- Git branch names, commit messages, PR titles, and log entries must all reference the relevant artefact ID.

> **Rule:** An artefact without a unique ID cannot be tracked, referenced, or audited. Assign the ID first, write the content second.

---

## 🛠️ Operating Principles

### 1. Sequential Execution

Do NOT use background agents or background tasks. Do NOT split into multiple agents. Process files ONE AT A TIME, sequentially. Update the user regularly on each step. Manageability takes precedence over speed — choose slower but visible over faster but opaque.

### 2. Migration Tracking

Every time a change is made that must propagate to other platforms or modules, log it immediately in `MIGRATION_LOG.md`. Include:

- **Date** of the change
- **Files changed**
- **Which platforms or modules it applies to**
- **What specifically changed** (old vs. new values, code snippets where helpful)
- **Notes** on platform-specific adaptations completed and/or still needed

Every change generates a technical debt ticket for every platform it has not yet reached. Do not let platforms drift out of parity silently.

### 3. Persistent Memory

Maintain `MEMORY.md` organized **by topic**, not chronologically. Use separate topic files for detailed notes where needed.

- Update or remove memories that are wrong or outdated. Do not write duplicates.
- Read `MEMORY.md` and all linked topic files at session startup.
- Store: API signatures, scoring algorithms, layout measurements, hard-won lessons, active dependency registry.

The goal is a curated knowledge base, not a dump log.

### 4. Prompt Logging as Audit Trail

Every session, after reading these instructions, log each user prompt to `PROMPT_LOG.md` with a timestamp. This gives a complete, replayable record of every instruction across all sessions — enabling reconstruction when things go wrong, tracing how features evolved, and picking up precisely where the last session ended.

After any meaningful task also update:

- `progress.md` — what happened and any errors
- `findings.md` — discoveries and constraints
- `PROJECT.md` — only when a schema changes, a rule is added, or architecture is modified

### 5. User Profile as a Design Constraint

Before any design or UX decision, consult the user profile defined in `PROJECT.md`. The profile encodes the technical comfort level, mental model, and usage context of the real humans this software is built for.

- Align all UI decisions with the user profile.
- If asked to recall the user profile, restate it explicitly before proceeding.
- Do not design for an abstract user — design for the person described.

### 6. Design System Compliance

All UI work must comply with the codified design system defined in `PROJECT.md`, including specific font sizes, exact colour values, component patterns, and named reference implementations.

Every new view must match existing ones automatically. Use the design system as the authoritative reference — not previous code. Design consistency must not depend on memory of what was built last time.

### 7. Hard-Won Lessons as Permanent Rules

When a bug is resolved after significant debugging, encode the fix as a permanent rule here or in `Docs/LESSONS.md`. Format:

> **”[Never/Always] [specific behaviour].** *Learned when [brief description of failure].*”

At the end of every session, record new learnings. Apply the Self-Annealing loop for all tool failures:

1. **Analyze** — Read the stack trace. Do not guess.
2. **Patch** — Fix the script in `tools/` using the selected coding languages.
3. **Test** — Verify the fix works.
4. **Update Architecture** — Record the learning in the relevant `architecture/` SOP so the error never repeats.

Every AI mistake should only happen once. Bug fixes become development DNA.

### 8. Unit Testing & Build Quality

Every piece of code generated or updated must have corresponding unit tests written or updated in the same session:

- **Minimum coverage:** At least **80% code coverage** across all new or modified code. Verified and reported to `progress.md` before the session closes.
- **All tests must pass:** A failing test is a build blocker. Fix the code or the test before proceeding — never commit with a failing suite.
- **Test location:** Parallel `tests/` directory mirroring source structure.
- **Test naming:** `test_<module>_<behaviour>_<expected_outcome>`

### 9. Release Planning & Backlog Management

A detailed release plan must be created at project inception and maintained throughout the project lifecycle. This plan lives in `Docs/RELEASE_PLAN.md` and must be updated whenever scope, priorities, or architecture change.

**Structure of the Release Plan:**

The plan must define a recommended **MVP** and at least two subsequent release milestones. Each release is an **Epic** containing **User Stories**, which contain **Tasks**.

**Epic format:**

```other
EPIC-[0001]: [Short descriptive title]
Description: [What this epic delivers and why it matters to the user or business]
Release Target: [MVP / Release 1.x / etc.]
Status: [Planned | In Progress | Complete]
Dependencies: [EPIC-XXXX, or "None"]
```

**User Story format:**

```other
US-[0001] (EPIC-[0001]): As a [persona], I want to [action], so that [outcome].
Description: [Additional context, edge cases, constraints]
Priority: [High | Medium | Low]
Estimate: [Story points or T-shirt size]
Status: [Planned | In Progress | Complete | Blocked]
Acceptance Criteria:
  - [ ] AC-[0001]: [Specific, testable condition]
  - [ ] AC-[0002]: [Specific, testable condition]
  - [ ] AC-[0003]: [Specific, testable condition]
Dependencies: [US-XXXX, EPIC-XXXX, or "None"]
Definition of Ready (DOR):
  - [ ] Story is understood and estimated
  - [ ] Acceptance criteria are defined and agreed
  - [ ] Dependencies are identified and resolved or planned
  - [ ] Design assets or schema changes are available if required
  - [ ] No blockers exist to begin work
Definition of Done (DOD):
  - [ ] All acceptance criteria are met
  - [ ] All linked tasks (TASK-XXXX) are complete
  - [ ] Unit tests written and passing with ≥80% coverage
  - [ ] Test cases created or updated in TEST_CASES.md
  - [ ] Code reviewed and approved
  - [ ] No regressions introduced
  - [ ] Accessibility audit passed (WCAG 2.1 AA)
  - [ ] Performance baselines verified
  - [ ] Error handling implemented per ERROR_TAXONOMY.md
  - [ ] No secrets or PII in code, logs, or committed files
  - [ ] Dependencies pinned and documented in findings.md
  - [ ] Documentation updated
  - [ ] Migration log updated if cross-platform changes were made
  - [ ] Session Close Protocol completed (§14)
  - [ ] Deployed to the target environment successfully
```

**Task format:**

```other
TASK-[0001] (US-[0001]): [Short imperative description of the work]
Type: [Dev | Test | Design | Docs | Infra | Bug]
Assignee: [Agent / Human]
Status: [To Do | In Progress | Done | Blocked]
Branch: [feature/EPIC-0001-US-0001-short-description]
Notes: [Any implementation notes or constraints]
```

**Bug format:**

```other
BUG-[0001]: [Short description of the defect]
Severity: [Critical | High | Medium | Low]
Related Story: US-[XXXX]
Related Task: TASK-[XXXX]
Steps to Reproduce:
  1. [Step]
  2. [Step]
Expected: [What should happen]
Actual: [What actually happened]
Status: [Open | In Progress | Fixed | Verified | Closed]
Fix Branch: [bugfix/BUG-0001-short-description]
Lesson Encoded: [Yes — see Docs/LESSONS.md | No]
```

> **Rule:** No story may be worked on unless it meets the DOR. No story may be closed unless it meets the DOD. The release plan is a living document — keep it current.

### 10. Test Case Management

Whenever code is generated or updated, corresponding test cases must be created or updated in `Docs/TEST_CASES.md`. Test cases are distinct from unit tests — they are human-readable descriptions of expected system behaviour used for verification and QA.

**Test Case format:**

```other
TC-[0001]: [Short descriptive title]
Related Story: US-[XXXX]
Related Task: TASK-[XXXX]
Related AC: AC-[XXXX]
Type: [Functional | Regression | Edge Case | Negative | Accessibility | Performance]
Preconditions: [System state required before the test is run]
Steps:
  1. [Action]
  2. [Action]
  3. [Action]
Expected Result: [What should happen if the system is working correctly]
Actual Result: [Filled in during test execution — leave blank until executed]
Status: [ ] Not Run / [ ] Pass / [ ] Fail
Defect Raised: [BUG-XXXX or "None"]
Notes: [Any observations, edge cases, or defects found]
```

**Rules:**

- Every user story must have at least one test case covering its primary acceptance criterion.
- Every acceptance criterion (AC-XXXX) must have a corresponding test case (TC-XXXX).
- Edge cases and negative paths must have their own uniquely identified test cases.
- Test cases must be reviewed and updated whenever acceptance criteria change.
- Failed test cases must raise a BUG-XXXX entry and be logged in `progress.md`.
- Test case IDs are permanent — never reuse or renumber a TC-XXXX, even if deleted. Mark deleted cases as `Status: Retired`.

### 11. Git Workflow & Version Control

All code must be managed under Git version control, either locally or via GitHub. The following branching strategy and commit standards are mandatory for the life of the project.

**Branch Structure:**

```other
main          → Production-ready code only. Never commit directly.
develop       → Integration branch. All feature branches merge here first.
feature/*     → One branch per user story. e.g., feature/US-0003-user-login
bugfix/*      → One branch per bug fix. e.g., bugfix/BUG-0007-auth-token-null
release/*     → Staging branch cut from develop before production deploy. e.g., release/1.0.0
hotfix/*      → Emergency fixes branched from main. e.g., hotfix/BUG-0012-critical-auth-fix
```

**Commit Message Format:**

```other
[TYPE] US-[0001] | TASK-[0001]: Short imperative description (max 72 chars)
```

Body: What changed and why (not how). Optional but recommended for non-trivial changes.

Footer: Refs #issue-number | Breaking: yes/no

```other

```

Types: `feat`, `fix`, `test`, `docs`, `refactor`, `chore`, `style`, `perf`

**Rules:**

- Never commit directly to `main` or `develop`. Always use a branch.
- Every feature branch maps to exactly one user story.
- Commits must be atomic — one logical change per commit. Do not bundle unrelated changes.
- All unit tests must pass locally before any push to remote.
- Branch names must match the naming convention above exactly.
- Squash and merge feature branches into `develop` to keep history clean.
- Tag every release branch merge to `main` with a semantic version (e.g., `v1.0.0`).
- Maintain a `.gitignore` that excludes `.env`, `.tmp/`, build artifacts, and IDE files.

**If using GitHub:**

- Use Pull Requests (PRs) for all merges into `develop` and `main`.
- PR title must follow the commit message format above.
- PRs must reference the related user story ID in the description.
- No PR may be merged with failing checks or unresolved review comments.
- Enable branch protection on `main` and `develop` — direct pushes forbidden.
- Use GitHub Actions for CI: run tests and coverage checks on every PR automatically.

> **Rule:** If it isn’t in version control, it doesn’t exist. If it isn’t on a branch, it isn’t safe.

---

### 12. Security & Secrets Standards

Security is a first-class concern, not an afterthought. The following rules apply to all code generated or modified.

**Secrets & Credentials:**

- All secrets, API keys, tokens, and credentials must live exclusively in `.env`. Never in code, comments, config files, or logs.
- `.env` must be listed in `.gitignore` and must never be committed to version control under any circumstances.
- Provide a `.env.example` file with all required variable names and placeholder values. Keep it updated whenever new variables are added.
- Never log secrets, tokens, or sensitive user data — not even partially (e.g., no `key[:4]` in logs).
- Rotate any secret that is accidentally exposed immediately. Log the incident in `progress.md`.

**Input Validation & Injection Prevention:**

- Validate and sanitize all external input at the boundary — before it touches business logic, the database, or any external service.
- Never construct database queries, shell commands, or API calls using raw string concatenation with user input. Use parameterized queries or prepared statements.
- Reject unexpected input shapes early and return structured error responses — never expose stack traces to end users.

**Dependency Security:**
See §19 (Dependency Management) for all rules on pinning, CVE checking, and licence compliance. Apply those rules before adding any dependency.

**Code Scanning:**

- Before any commit, scan for accidentally hardcoded secrets using a tool appropriate to the selected coding languages (e.g., `trufflehog`, `gitleaks`, or GitHub’s built-in secret scanning if using GitHub).
- If using GitHub, enable Dependabot alerts and secret scanning on the repository.

**Data Handling:**

- Personally identifiable information (PII) must never be stored in `.tmp/`, logs, or memory files.
- At-rest encryption must be used for any persistent store containing user data.
- Minimize data collection — only store what is explicitly needed for the feature.

---

### 13. Error Handling Standard

All application code must implement consistent, structured error handling. The agent must never leave error paths unhandled or rely on the runtime to surface failures.

**Error Hierarchy:**
Define a project-wide error taxonomy in `architecture/ERROR_TAXONOMY.md`. At minimum, distinguish between:

- `ValidationError` — Bad input from the user or external system.
- `IntegrationError` — External service (API, database, third-party) failed.
- `BusinessLogicError` — A rule or constraint of the domain was violated.
- `SystemError` — Unexpected internal failure (catch-all; should be rare).

**Rules:**

- Every function or tool that can fail must have explicit error handling — no silent failures, no bare `except` or `catch` blocks.
- Errors must be caught at the appropriate layer and re-thrown or transformed before crossing layer boundaries. Do not let raw database errors surface to the UI layer.
- All errors must be logged with: timestamp, error type, message, relevant context (e.g., which user story / tool was executing), and stack trace.
- End-user-facing error messages must be human-readable and actionable. Never expose internal error details, stack traces, or database messages to the user.
- Transient errors (e.g., network timeouts, rate limits) must implement exponential backoff retry logic with a defined maximum retry count. Document retry parameters in `MEMORY.md`.
- Log all errors to `progress.md` during development. In production, route errors to the designated logging or monitoring service defined in `PROJECT.md`.

---

### 14. Session Close Protocol

At the end of every working session — whether the task is complete or mid-flight — the agent must perform the following closing steps before stopping:

1. **Commit state** — Ensure all changed files are committed to the current feature branch with a properly formatted commit message. Never leave uncommitted changes.
2. **Update `progress.md`** — Record what was completed, what is in progress, and any blockers or open questions.
3. **Update `MEMORY.md`** — Add or update any new learnings from the session.
4. **Update `PROMPT_LOG.md`** — Confirm all prompts from the session have been logged with timestamps.
5. **Update `MIGRATION_LOG.md`** — Log any cross-platform changes that still need to be applied.
6. **Update `Docs/LESSONS.md`** — Encode any bugs fixed or hard-won lessons from the session.
7. **Coverage check** — Run the test suite and log the coverage summary to `progress.md`. Flag any regressions.
8. **Report to user** — Provide a brief end-of-session summary: what was done, current branch, test status, and what to pick up next session.

---

### 15. API Design & Versioning

All APIs exposed or consumed by this project must follow consistent design and versioning standards to prevent breaking changes and silent regressions.

**Design Standards:**

- All API endpoints must follow RESTful conventions unless GraphQL or another paradigm is explicitly chosen and documented in `PROJECT.md`.
- Endpoint naming must use lowercase, hyphenated paths. e.g., `/api/v1/user-profiles` not `/api/v1/userProfiles`.
- All responses must use a consistent envelope structure:

```json
{
  "success": true,
  "data": { },
  "error": null,
  "meta": { "version": "1.0", "timestamp": "ISO8601" }
}
```

- HTTP status codes must be used semantically and consistently across all endpoints.
- All request and response shapes must be documented in `PROJECT.md` under the Data Schema section.

**Versioning Rules:**

- All API routes must include a version prefix from day one. e.g., `/api/v1/`.
- Never modify the request or response shape of an existing versioned endpoint. Create a new version instead (e.g., `/api/v2/`).
- Deprecated endpoints must be flagged in `MEMORY.md` and kept alive for at least one full release cycle before removal.
- Any breaking API change must be reflected in the user story that drives it and documented in `MIGRATION_LOG.md`.

---

### 16. Accessibility Standard

All user-facing interfaces must meet a minimum of **WCAG 2.1 Level AA** accessibility compliance. Accessibility is a design constraint, not a post-launch consideration.

**Rules:**

- All interactive elements (buttons, links, inputs) must have descriptive, programmatic labels. Use `aria-label` or `aria-labelledby` where native labels are insufficient.
- Colour contrast ratios must meet WCAG 2.1 AA minimums: 4.5:1 for normal text, 3:1 for large text and UI components. Verify all colour pairs defined in the design system in `PROJECT.md`.
- No information must be conveyed by colour alone. Always pair colour with a secondary indicator (icon, text, pattern).
- All images must have meaningful `alt` text. Decorative images must have `alt=""`.
- All functionality must be operable via keyboard alone. Tab order must be logical and visible focus indicators must be present.
- Use semantic HTML elements (`<nav>`, `<main>`, `<section>`, `<button>`, etc.) over generic `<div>` and `<span>` where applicable.
- For mobile (iOS/macOS/watchOS), use native accessibility APIs (VoiceOver, Dynamic Type) — do not override system accessibility behaviours.
- Run an accessibility audit (e.g., Axe, Lighthouse, or Xcode Accessibility Inspector) after every major UI change and log results in `progress.md`.

---

### 17. Performance Budgets

All user-facing features must meet defined performance baselines. Performance is an implicit acceptance criterion on every user story — do not wait until launch to measure it.

**Baselines (adjust in `PROJECT.md` if project requirements differ):**

| **Metric**                      | **Target**                           |
| ------------------------------- | ------------------------------------ |
| API response time (p95)         | < 500ms                              |
| Page / screen initial load      | < 3 seconds on a standard connection |
| Time to Interactive (web)       | < 4 seconds                          |
| Database query time (p95)       | < 100ms                              |
| Background job / automation run | < 30 seconds unless async by design  |

**Rules:**

- Any new endpoint or screen must be manually verified against these baselines before the story is closed.
- If a baseline cannot be met, document the reason and a mitigation plan in `findings.md` before proceeding.
- Avoid N+1 query patterns — always review database access patterns when building new data-fetching logic.
- Use pagination, lazy loading, or streaming for any data set that could exceed 100 records in production.
- Cache aggressively at the appropriate layer (in-memory, CDN, database query cache) — but document what is cached, the TTL, and the invalidation strategy in `MEMORY.md`.
- Log performance metrics from test runs to `progress.md` for tracking over time.

---

### 18. Application Logging Standard

Application logs are distinct from agent operational logs (e.g., `PROMPT_LOG.md`). All running application code must produce structured, levelled logs to support debugging and monitoring in both development and production.

**Log Levels:**

- `DEBUG` — Detailed diagnostic information. Development only. Must not appear in production logs.
- `INFO` — Normal operational events. e.g., “User authenticated”, “Job started”, “Payload delivered”.
- `WARN` — Unexpected but recoverable situations. e.g., “Retry attempt 2 of 3”, “Deprecated endpoint called”.
- `ERROR` — Failures that require attention. e.g., “Database connection failed”, “External API returned 500”.
- `CRITICAL` — Failures that halt or severely degrade the system. Requires immediate human attention.

**Rules:**

- All logs must be structured (JSON format preferred) with at minimum: `timestamp`, `level`, `message`, `context` (module/function/story ID), and `correlation_id` (to trace a request across layers).
- Never log PII, credentials, or sensitive user data at any level.
- Log all `ERROR` and `CRITICAL` events with full context and stack trace.
- In production, route logs to the monitoring/alerting service defined in `PROJECT.md`. Do not rely on console output alone.
- Set log level via environment variable (e.g., `LOG_LEVEL=INFO`) — never hardcode it.
- During development, log output should be human-readable. In production, structured JSON is required for machine parsing.

---

### 19. Dependency Management

All third-party libraries and packages must be explicitly managed, versioned, and justified. Uncontrolled dependencies are a security risk and a maintenance burden.

**Rules:**

- Pin all dependencies to an exact version in the dependency manifest (e.g., `package.json`, `requirements.txt`, `Podfile`, `Package.swift`). No floating ranges (`^`, `~`, `*`, `latest`).
- Every new dependency must be documented in `findings.md` with: package name, version, purpose, licence, and last-active-maintenance date.
- Prefer well-maintained, widely adopted packages with clear licences (MIT, Apache 2.0, BSD preferred). Avoid GPL unless the project licence is compatible.
- Regularly audit dependencies for known vulnerabilities. If using GitHub, enable Dependabot. Otherwise, run a manual audit at the start of each release cycle and log results in `findings.md`.
- Remove unused dependencies immediately — they are attack surface with no benefit.
- Keep a separate section in `MEMORY.md` listing all active dependencies, their purpose, and their pinned version for quick reference.

---

### 20. Rollback & Recovery Plan

Every deployment to a production or staging environment must have a documented, tested rollback plan before the deployment begins. The Trigger phase is not complete without it.

**Pre-Deployment Checklist (add to Phase 5 — Trigger):**

- [ ] Current production version is tagged in Git (e.g., `v1.0.0`) so it can be restored instantly.
- [ ] Database migrations are reversible — every `up` migration must have a corresponding `down` migration.
- [ ] Rollback procedure is documented in `Docs/ROLLBACK.md` for this release.
- [ ] A smoke test plan is defined — the minimum set of checks to verify the deployment succeeded.
- [ ] Monitoring and alerting are active and verified before traffic is switched.

**Rollback Procedure Template (`Docs/ROLLBACK.md`):**

```other
Release: [version]
Date: [deployment date]
Rollback trigger: [conditions that would require a rollback]
```

Steps:

1. [Revert Git tag / redeploy previous version]
2. [Reverse database migrations if applicable]
3. [Invalidate caches if applicable]
4. [Verify smoke tests pass on restored version]
5. [Notify stakeholders]

Post-rollback:

- Log incident in progress.md with timeline, root cause, and resolution.
- Open a bugfix/* branch to address the root cause before re-attempting deployment.

```other

```

**Rules:**

- If a rollback plan cannot be written before deployment, the deployment must not proceed.
- Every deployment that requires a rollback must be followed by a post-mortem entry in `Docs/LESSONS.md`.
- Database rollbacks must be tested in a non-production environment before being relied upon in production.

> **Rule:** Hope is not a recovery strategy. If you haven’t tested the rollback, you don’t have one.

---

## 📂 File & Deliverable Structure

| **Location**           | **Purpose**                                                                                               |
| ---------------------- | --------------------------------------------------------------------------------------------------------- |
| `.tmp/`                | All scraped data, logs, and temporary files. Ephemeral. Never committed.                                  |
| `tools/`               | Deterministic scripts in the selected coding languages. Atomic and testable.                              |
| `tests/`               | Unit tests mirroring the source structure. Must maintain ≥80% coverage.                                   |
| `architecture/`        | Technical SOPs in Markdown, including `ERROR_TAXONOMY.md`.                                                |
| `Docs/`                | All project documentation.                                                                                |
| `Docs/RELEASE_PLAN.md` | Epics, user stories, tasks, MVP definition, release milestones.                                           |
| `Docs/TEST_CASES.md`   | Human-readable test cases (TC-XXXX) linked to user stories and ACs.                                       |
| `Docs/BUGS.md`         | Bug and defect register with BUG-XXXX identifiers and status.                                             |
| `Docs/ID_REGISTRY.md`  | Single source of truth for next available ID in every sequence.                                           |
| `Docs/LESSONS.md`      | Encoded hard-won lessons and permanent guardrail rules.                                                   |
| `Docs/ROLLBACK.md`     | Rollback procedure for each release. Created before every deployment.                                     |
| `MEMORY.md`            | Persistent semantic knowledge base, organized by topic.                                                   |
| `PROMPT_LOG.md`        | Timestamped log of every user prompt across all sessions.                                                 |
| `MIGRATION_LOG.md`     | Cross-platform and cross-module change tracking.                                                          |
| `progress.md`          | Running log of session activity, errors, test results, and blockers.                                      |
| `findings.md`          | Research, discoveries, constraints, and dependency justifications.                                        |
| `task_plan.md`         | Phases, goals, and checklists for the current Blueprint.                                                  |
| `.env`                 | Environment variables and API credentials. Never committed.                                               |
| `.env.example`         | Placeholder template of all required environment variables. Committed.                                    |
| `.gitignore`           | Must exclude `.env`, `.tmp/`, build artifacts, and IDE files.                                             |
| Cloud/Global           | The final “Payload” destination. A project is only complete when the payload is in its cloud destination. |

---

## 🔍 Bonus: Fresh-Eyes Code Review

Periodically, at the start of a new session, analyze the entire project and all its files **before** reading instruction files and memory. Flag issues, inconsistencies, or problems. This is the equivalent of an independent code audit.

After the review is complete, proceed with the normal session startup sequence.