# CI Pipeline Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Expand the existing `ci.yml` into a consolidated 4-job pipeline with ESLint, an 80% coverage gate, npm audit, and CodeQL — plus Dependabot for automated dependency updates.

**Architecture:** ESLint + Jest coverage threshold are added as local tooling first (verifiable locally), then the GitHub Actions workflow is updated to run all jobs in parallel. CodeQL runs only on PRs, pushes to main, and a weekly schedule to avoid burning CI minutes on every branch push.

**Tech Stack:** ESLint 9 (flat config), Jest 29 (existing), GitHub Actions, CodeQL v3, Dependabot

---

## Task 1: Install ESLint and create config

**Files:**
- Modify: `package.json`
- Create: `eslint.config.js`

**Step 1: Install ESLint**

```bash
npm install --save-dev eslint@9
```

Expected: `eslint` appears in `package.json` devDependencies.

**Step 2: Add lint script to `package.json`**

In the `"scripts"` block, add:

```json
"lint": "eslint tools/**/*.js"
```

Full scripts block after change:

```json
"scripts": {
  "test": "jest",
  "test:coverage": "jest --coverage",
  "lint": "eslint tools/**/*.js"
}
```

**Step 3: Create `eslint.config.js` in project root**

```js
// eslint.config.js
'use strict';

const js = require('@eslint/js');

module.exports = [
  js.configs.recommended,
  {
    files: ['tools/**/*.js'],
    rules: {
      'no-unused-vars': 'warn',
      'no-console': 'warn',
      'eqeqeq': 'error',
      'no-eval': 'error',
      'no-implied-eval': 'error',
    },
  },
];
```

**Step 4: Run lint to see baseline**

```bash
npm run lint
```

Expected: output listing any errors/warnings. Errors (red) must be fixed before proceeding. Warnings (yellow) are acceptable.

**Step 5: Fix any ESLint errors**

If `eqeqeq`, `no-eval`, or `no-implied-eval` violations appear, fix them in the flagged files. Warnings (`no-unused-vars`, `no-console`) do not need fixing — they are informational.

**Step 6: Run lint again to confirm zero errors**

```bash
npm run lint
```

Expected: exits with code 0 (no errors; warnings are fine).

**Step 7: Commit**

```bash
git add package.json package-lock.json eslint.config.js
git commit -m "chore: add ESLint with recommended + security rules"
```

---

## Task 2: Add coverage threshold to Jest config

**Files:**
- Modify: `jest.config.js`

**Step 1: Verify current coverage before adding gate**

```bash
npm run test:coverage
```

Expected output (confirm all four metrics are ≥ 80% before adding the gate):
```
All files  |   97.55 |    84.18 |    96.2  |   99.58
```

**Step 2: Add `coverageThreshold` to `jest.config.js`**

Current file:
```js
module.exports = {
  testEnvironment: 'node',
  testMatch: ['**/tests/unit/**/*.test.js'],
  collectCoverageFrom: ['tools/lib/**/*.js'],
  coverageReporters: ['text', 'lcov', 'json-summary'],
};
```

Updated file — add `coverageThreshold` block:
```js
module.exports = {
  testEnvironment: 'node',
  testMatch: ['**/tests/unit/**/*.test.js'],
  collectCoverageFrom: ['tools/lib/**/*.js'],
  coverageReporters: ['text', 'lcov', 'json-summary'],
  coverageThreshold: {
    global: {
      lines: 80,
      branches: 80,
      functions: 80,
      statements: 80,
    },
  },
};
```

**Step 3: Run coverage to confirm gate passes**

```bash
npm run test:coverage
```

Expected: all 9 suites pass, no coverage threshold failure message. If you see `Jest: "global" coverage threshold for lines (80%) not met`, the gate is failing — do NOT lower the threshold, instead add tests to cover the gap.

**Step 4: Commit**

```bash
git add jest.config.js
git commit -m "test: enforce 80% coverage threshold in jest config"
```

---

## Task 3: Replace ci.yml with consolidated 4-job workflow

**Files:**
- Modify: `.github/workflows/ci.yml`

**Step 1: Replace the entire content of `.github/workflows/ci.yml`**

```yaml
name: CI

on:
  push:
    branches: ['**']
  pull_request:

jobs:
  lint:
    name: Lint
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - uses: actions/setup-node@v4
        with:
          node-version: '20'
          cache: npm

      - name: Install dependencies
        run: npm ci

      - name: Run ESLint
        run: npm run lint

  test:
    name: Test & Coverage Gate
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - uses: actions/setup-node@v4
        with:
          node-version: '20'
          cache: npm

      - name: Install dependencies
        run: npm ci

      - name: Run tests with coverage
        run: npm run test:coverage -- --ci
        env:
          CI: true

  audit:
    name: Dependency Audit
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - uses: actions/setup-node@v4
        with:
          node-version: '20'
          cache: npm

      - name: Install dependencies
        run: npm ci

      - name: Audit dependencies
        run: npm audit --audit-level=moderate

  codeql:
    name: CodeQL Analysis
    runs-on: ubuntu-latest
    permissions:
      actions: read
      contents: read
      security-events: write
    on:
      push:
        branches: [main]
      pull_request:
      schedule:
        - cron: '0 8 * * 1'
    steps:
      - uses: actions/checkout@v4

      - name: Initialize CodeQL
        uses: github/codeql-action/init@v3
        with:
          languages: javascript
          queries: security-extended

      - name: Perform CodeQL Analysis
        uses: github/codeql-action/analyze@v3
```

> **Note on CodeQL triggers:** GitHub Actions does not support per-job `on:` triggers inside a workflow. To scope CodeQL correctly, it must live in its own workflow file. See Task 4 for the correct split.

**Step 2: Revert ci.yml to lint + test + audit only**

Remove the `codeql` job from `ci.yml`. The final `ci.yml` should have exactly three jobs: `lint`, `test`, `audit`.

```yaml
name: CI

on:
  push:
    branches: ['**']
  pull_request:

jobs:
  lint:
    name: Lint
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - uses: actions/setup-node@v4
        with:
          node-version: '20'
          cache: npm

      - name: Install dependencies
        run: npm ci

      - name: Run ESLint
        run: npm run lint

  test:
    name: Test & Coverage Gate
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - uses: actions/setup-node@v4
        with:
          node-version: '20'
          cache: npm

      - name: Install dependencies
        run: npm ci

      - name: Run tests with coverage
        run: npm run test:coverage -- --ci
        env:
          CI: true

  audit:
    name: Dependency Audit
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - uses: actions/setup-node@v4
        with:
          node-version: '20'
          cache: npm

      - name: Install dependencies
        run: npm ci

      - name: Audit dependencies
        run: npm audit --audit-level=moderate
```

**Step 3: Commit**

```bash
git add .github/workflows/ci.yml
git commit -m "ci: consolidate lint, test, and audit into ci.yml"
```

---

## Task 4: Add CodeQL in its own workflow file

**Files:**
- Create: `.github/workflows/codeql.yml`

**Step 1: Create `.github/workflows/codeql.yml`**

```yaml
name: CodeQL

on:
  push:
    branches: [main]
  pull_request:
  schedule:
    - cron: '0 8 * * 1'   # Every Monday at 08:00 UTC

jobs:
  analyze:
    name: Analyze JavaScript
    runs-on: ubuntu-latest
    permissions:
      actions: read
      contents: read
      security-events: write

    steps:
      - uses: actions/checkout@v4

      - name: Initialize CodeQL
        uses: github/codeql-action/init@v3
        with:
          languages: javascript
          queries: security-extended

      - name: Perform CodeQL Analysis
        uses: github/codeql-action/analyze@v3
        with:
          category: '/language:javascript'
```

**Step 2: Commit**

```bash
git add .github/workflows/codeql.yml
git commit -m "ci: add CodeQL analysis workflow (PRs + main + weekly schedule)"
```

---

## Task 5: Add Dependabot config

**Files:**
- Create: `.github/dependabot.yml`

**Step 1: Create `.github/dependabot.yml`**

```yaml
version: 2
updates:
  - package-ecosystem: npm
    directory: /
    schedule:
      interval: weekly
      day: monday
      time: '09:00'
    open-pull-requests-limit: 5
    labels:
      - dependencies

  - package-ecosystem: github-actions
    directory: /
    schedule:
      interval: weekly
      day: monday
      time: '09:00'
    open-pull-requests-limit: 5
    labels:
      - dependencies
      - github-actions
```

**Step 2: Commit**

```bash
git add .github/dependabot.yml
git commit -m "chore: add Dependabot for weekly npm and Actions updates"
```

---

## Task 6: Update .gitignore and push

**Files:**
- Modify: `.gitignore`

**Step 1: Add `node_modules` to `.gitignore` if not already present**

Current `.gitignore`:
```
node_modules/
Docs/coverage/
plan-visualizer.config.json
```

`node_modules/` is already present — no change needed.

**Step 2: Final local verification**

Run both checks locally to confirm everything is green before pushing:

```bash
npm run lint && npm run test:coverage
```

Expected: lint exits 0 (warnings ok), all 9 test suites pass, all coverage metrics ≥ 80%.

**Step 3: Push to origin**

```bash
git push origin main
```

Expected: GitHub Actions triggers `CI` workflow (lint + test + audit) and `CodeQL` workflow. All jobs green within ~3 minutes.

**Step 4: Verify on GitHub**

Open `https://github.com/ksyed0/PlanVisualizer/actions` and confirm:
- `CI` workflow shows 3 green jobs: Lint, Test & Coverage Gate, Dependency Audit
- `CodeQL` workflow shows 1 green job: Analyze JavaScript
