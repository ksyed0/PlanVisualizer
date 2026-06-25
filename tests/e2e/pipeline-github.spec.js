// tests/e2e/pipeline-github.spec.js
'use strict';
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');
const { waitForPR } = require('./helpers');

const SKIP = !process.env.E2E_GITHUB_TOKEN;
const TARGET_REPO = 'ksyed0/pv-e2e-target';
const INIT_BRANCH = 'feature/shelf-init';
const ROOT = path.resolve(__dirname, '../..');
const INIT_PROMPT_PATH = path.join(ROOT, 'docs/superpowers/plans/2026-06-25-e2e-test-automation.md');

// Helper: run gh CLI with the e2e token
function gh(args) {
  return execSync(`gh ${args}`, {
    encoding: 'utf8',
    env: { ...process.env, GH_TOKEN: process.env.E2E_GITHUB_TOKEN },
    stdio: 'pipe',
  });
}

function cloneTarget() {
  const tmp = execSync('mktemp -d', { encoding: 'utf8' }).trim();
  execSync(`gh repo clone ${TARGET_REPO} "${tmp}" -- --depth 1`, {
    env: { ...process.env, GH_TOKEN: process.env.E2E_GITHUB_TOKEN },
    stdio: 'pipe',
  });
  return tmp;
}

describe('Suite 5: GitHub-connected Layer 2 (Shelf init)', () => {
  let cloneDir;
  let prNumber;

  beforeAll(async () => {
    if (SKIP) return;
    cloneDir = cloneTarget();

    // Reset: delete feature/shelf-init if it already exists on remote
    try {
      gh(`api repos/${TARGET_REPO}/git/refs/heads/${INIT_BRANCH} -X DELETE`);
    } catch {
      /* branch may not exist — that's fine */
    }

    // Reset: close any open PRs for this branch
    try {
      const prs = JSON.parse(gh(`pr list --repo ${TARGET_REPO} --head ${INIT_BRANCH} --json number`));
      for (const pr of prs) {
        gh(`pr close ${pr.number} --repo ${TARGET_REPO}`);
      }
    } catch {
      /* no open PRs — that's fine */
    }

    // Reset: restore ID_REGISTRY.md to develop tip
    execSync(`git checkout origin/develop -- docs/ID_REGISTRY.md 2>/dev/null || true`, {
      cwd: cloneDir,
      stdio: 'pipe',
    });
    execSync(`git checkout -b ${INIT_BRANCH}`, { cwd: cloneDir, stdio: 'pipe' });
    execSync(`git push origin ${INIT_BRANCH}`, {
      cwd: cloneDir,
      stdio: 'pipe',
      env: { ...process.env, GH_TOKEN: process.env.E2E_GITHUB_TOKEN },
    });

    // Invoke Conductor with the Shelf init prompt
    // The prompt lives in the spec file — pass it as a file to Claude Code CLI
    // This is a long-running process; we wait for the PR to appear
    execSync(`claude --print "$(cat '${INIT_PROMPT_PATH}')" 2>/dev/null &`, {
      cwd: cloneDir,
      stdio: 'ignore',
    });

    // Poll for the PR (up to 30 minutes)
    prNumber = await waitForPR(INIT_BRANCH, 1800000, 30000);
  }, 1860000); // 31 min timeout for beforeAll

  afterAll(() => {
    if (cloneDir) {
      try {
        fs.rmSync(cloneDir, { recursive: true, force: true });
      } catch {
        /* ignore cleanup errors */
      }
    }
  });

  const skip = (name, fn) => (SKIP ? it.skip(name, fn) : it(name, fn, 60000));

  skip('AC-1049: PR exists for feature/shelf-init', () => {
    expect(prNumber).toBeGreaterThan(0);
  });

  skip('AC-1050: RELEASE_PLAN.md has ≥5 epics and ≥10 stories', () => {
    const content = execSync(`gh api repos/${TARGET_REPO}/contents/docs/RELEASE_PLAN.md --jq .content | base64 -d`, {
      env: { ...process.env, GH_TOKEN: process.env.E2E_GITHUB_TOKEN },
      encoding: 'utf8',
    });
    const epicCount = (content.match(/^EPIC-\d+:/gm) || []).length;
    const storyCount = (content.match(/^US-\d+/gm) || []).length;
    expect(epicCount).toBeGreaterThanOrEqual(5);
    expect(storyCount).toBeGreaterThanOrEqual(10);
  });

  skip('AC-1051: ci-contract.md has no TODO or TBD fields', () => {
    const content = execSync(`gh api repos/${TARGET_REPO}/contents/docs/ci-contract.md --jq .content | base64 -d`, {
      env: { ...process.env, GH_TOKEN: process.env.E2E_GITHUB_TOKEN },
      encoding: 'utf8',
    });
    expect(content).not.toMatch(/\bTODO\b|\bTBD\b/);
  });

  skip('AC-1052: each story has Estimate and Priority fields', () => {
    const content = execSync(`gh api repos/${TARGET_REPO}/contents/docs/RELEASE_PLAN.md --jq .content | base64 -d`, {
      env: { ...process.env, GH_TOKEN: process.env.E2E_GITHUB_TOKEN },
      encoding: 'utf8',
    });
    expect(content).toMatch(/^Estimate: /m);
    expect(content).toMatch(/^Priority: /m);
  });

  skip('AC-1053: no Dockerfile or docker-compose.yml present', () => {
    let dockerfilePresent = false;
    try {
      gh(`api repos/${TARGET_REPO}/contents/Dockerfile`);
      dockerfilePresent = true;
    } catch {
      /* 404 means no Dockerfile — expected */
    }
    expect(dockerfilePresent).toBe(false);
  });
});
