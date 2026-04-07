# CI Pipeline Design

**Date:** 2026-03-10
**Status:** Approved

## Overview

Consolidate and expand the existing `ci.yml` into a single comprehensive workflow
with four parallel jobs: lint, test, security audit, and CodeQL analysis. Add
Dependabot for automated dependency updates.

## Goals

- Lint all JS files on every push and PR
- Gate merges on ≥80% unit test coverage (lines, branches, functions, statements)
- Run `npm audit` on every push/PR to catch moderate+ vulnerabilities
- Run CodeQL on PRs, pushes to main, and weekly schedule (not every branch push)
- Automate dependency updates via Dependabot

## Trigger Strategy

| Job       | All branch push | PR  | Push to main | Weekly schedule |
| --------- | --------------- | --- | ------------ | --------------- |
| lint      | ✓               | ✓   | ✓            |                 |
| test      | ✓               | ✓   | ✓            |                 |
| npm audit | ✓               | ✓   | ✓            |                 |
| CodeQL    |                 | ✓   | ✓            | ✓               |

## Job Designs

### lint

- Runner: `ubuntu-latest`, Node 20
- Install: `npm ci`
- Tool: ESLint with `eslint:recommended` + explicit rules:
  - `no-unused-vars: warn`
  - `no-console: warn`
  - `eqeqeq: error`
  - `no-eval: error`
  - `no-implied-eval: error`
- Scope: `tools/**/*.js` (excludes test fixtures)
- Fails PR if any ESLint error (warnings allowed)

### test

- Runner: `ubuntu-latest`, Node 20
- Install: `npm ci`
- Command: `npm run test:coverage -- --ci`
- Coverage thresholds added to `jest.config.js`:
  - lines: 80, branches: 80, functions: 80, statements: 80
- Fails PR if any threshold not met

### security (npm audit)

- Runner: `ubuntu-latest`, Node 20
- Install: `npm ci`
- Command: `npm audit --audit-level=moderate`
- Fails on moderate, high, or critical vulnerabilities

### codeql

- Runner: `ubuntu-latest`
- Language: javascript
- Triggers: PR, push to main, weekly Monday 08:00 UTC
- Uses: `github/codeql-action` (queries: security-extended)
- Uploads SARIF results to GitHub Security tab

## Supporting Files

| File                       | Change                                            |
| -------------------------- | ------------------------------------------------- |
| `.github/workflows/ci.yml` | Replace existing with consolidated 4-job workflow |
| `.github/dependabot.yml`   | New — weekly npm + Actions updates                |
| `.eslintrc.js`             | New — ESLint config                               |
| `jest.config.js`           | Add `coverageThreshold` block                     |
| `package.json`             | Add `eslint` devDependency + `lint` script        |

## What Is Not Changed

- `plan-visualizer.yml` — untouched, separate concern
- All existing test files and lib source files — no functional changes
- Existing `npm run test` and `test:coverage` scripts — preserved

## Risks & Mitigations

| Risk                           | Mitigation                                                             |
| ------------------------------ | ---------------------------------------------------------------------- |
| ESLint errors in existing code | Run lint locally first; fix before committing                          |
| Coverage currently below 80%   | Run `npm run test:coverage` to verify current state before adding gate |
| CodeQL false positives         | Review SARIF output; suppress with inline comments if needed           |
